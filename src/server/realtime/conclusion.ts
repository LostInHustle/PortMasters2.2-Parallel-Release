// =====================================================================
// Realtime layer: voyage conclusion and Captain's Legacy.
//
// Fires once per room, the moment every current member has reported
// reaching either endgame or bankruptcy: the whole harbor's voyage is
// over for everyone still seated in it. Whoever reached endgame (not
// bankrupt) with the highest reported Reputation is crowned Sea Master.
//
// This is also the one place a CaptainLegacy row ever gets written:
// Reputation earned this voyage becomes Renown XP on every finisher's
// account, persisting across every future voyage they ever sail, unlike
// Gold, cargo, and ship level, which a restart wipes on purpose.
//
// concludedRooms guards against firing twice for the same voyage;
// room:restart clears it so a room that plays again can conclude, and
// be crowned, again.
//
// NEW for the manifest: records one VoyageChronicle row per finisher
// (using buildChronicle from the parent engine) and CaptainRival rows
// for every pair of finishers (using recordRivalOutcomes from rival.ts).
// =====================================================================
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { roomMemberIds } from "@/lib/rooms";
import {
  levelForRenownXP,
  parseStatsByDifficulty,
  recordVoyageInStats,
  renownTitleForLevel,
} from "@/lib/game/legacy";
import {
  BROKERS_FAVOR_UNLOCK_LEVEL,
  merchantRatingForScore,
} from "@/lib/game/constants";
import { meritById, qualifyingMerits } from "@/lib/game/merits";
import { checkSave, describeFindings } from "@/lib/game/integrity";
import {
  normalizeDifficulty,
  renownMultiplierFor,
  roundsFor,
} from "@/lib/game/difficulty";
import { buildChronicle } from "@/lib/game/engine/chronicle";
import type { PublicUser } from "@/types/realtime";
import { roomStatuses } from "./status";
import {
  loanList,
  removeLoan,
  resolveBackingFor,
  broadcastLoans,
} from "./loans";
import { resolveExpiredVentures } from "./ventures";
import { userSockets } from "./presence";
import { recordRivalOutcomes, type RivalStanding } from "./rival";

export const concludedRooms = new Set<string>();

// Defensively extracts the chronicle's extras from a saved GameState's
// JSON blob. The score field IS the reputation, so it's used as the
// peak figure (the heartbeat doesn't carry a separate peak). The
// loansGiven and debts arrays are outstanding counts at save time,
// which at endgame should be near zero after settleOutstandingDebts,
// but they're the best lending indicator available without a new
// schema field. Forged finishers get zeros across the board.
function extractChronicleExtras(
  rawData: string | null,
  forged: boolean,
  fallbackReputation: number,
): {
  peakReputation: number;
  largestTrade: number;
  lendCount: number;
  borrowCount: number;
} {
  if (forged || !rawData) {
    return {
      peakReputation: forged ? 0 : fallbackReputation,
      largestTrade: 0,
      lendCount: 0,
      borrowCount: 0,
    };
  }
  try {
    const data = JSON.parse(rawData) as Record<string, unknown>;
    return {
      peakReputation:
        typeof data.score === "number" && Number.isFinite(data.score)
          ? data.score
          : fallbackReputation,
      largestTrade: 0,
      lendCount: Array.isArray(data.loansGiven) ? data.loansGiven.length : 0,
      borrowCount: Array.isArray(data.debts) ? data.debts.length : 0,
    };
  } catch {
    return {
      peakReputation: fallbackReputation,
      largestTrade: 0,
      lendCount: 0,
      borrowCount: 0,
    };
  }
}

export async function maybeConcludeVoyage(
  io: Server,
  roomId: string,
): Promise<void> {
  if (concludedRooms.has(roomId)) return;
  const memberIds = await roomMemberIds(roomId);
  if (memberIds.length === 0) return;
  const statuses = roomStatuses.get(roomId);
  if (!statuses) return;

  const finished: {
    userId: string;
    user: PublicUser;
    reputation: number;
    gold: number;
    phase: string;
  }[] = [];
  for (const id of memberIds) {
    const st = statuses.get(id);
    const phase = st ? String(st.phase) : "";
    if (!st || (phase !== "endgame" && phase !== "bankruptcy")) return;
    finished.push({
      userId: id,
      user: st.user,
      reputation: st.reputation ?? 0,
      gold: st.gold ?? 0,
      phase,
    });
  }

  // Guard right after the roster check passes, before any await below,
  // so a second game:status arriving while the first captain's legacy
  // write is still in flight can't slip through.
  concludedRooms.add(roomId);

  const roomForDifficulty = await db.room.findUnique({
    where: { id: roomId },
    select: { difficulty: true, voyageEpoch: true },
  });
  const roomDifficulty = normalizeDifficulty(roomForDifficulty?.difficulty);
  const renownMultiplier = renownMultiplierFor(roomDifficulty);

  // Force resolve every still open venture: the voyage is over, so
  // anything still open never will fill.
  if (roomForDifficulty) {
    await resolveExpiredVentures(
      io,
      roomId,
      roomForDifficulty.voyageEpoch,
      0,
      true,
    );
  }

  // Sweep stale loans for absent borrowers. A still connected borrower
  // is one whose report may simply not have arrived yet; sweeping that
  // loan would race their genuine settlement. An absent borrower paid
  // nothing by definition, so 0 is the honest repaid amount.
  //
  // That reasoning holds for a captain who finished the voyage solvent
  // and may still be settling up. It does not hold for a bankrupt one.
  // Insolvency is final, there is nothing left to settle with, and a
  // bankrupt captain keeps their socket open to watch the standings
  // rather than to pay anybody, so treating them as present stranded
  // their loans for good: this sweep is the only thing that ever closes
  // a loan its borrower never reports, and with it skipped the pledge
  // riding on the loan never resolved either.
  const bankrupt = new Set(
    finished.filter((f) => f.phase === "bankruptcy").map((f) => f.userId),
  );
  let sweptAny = false;
  for (const loan of [...loanList(roomId)]) {
    const stillPresent =
      !bankrupt.has(loan.borrowerId) &&
      (userSockets.get(loan.borrowerId)?.size ?? 0) > 0;
    if (stillPresent) continue;
    removeLoan(roomId, loan.debtId);
    sweptAny = true;
    resolveBackingFor(io, roomId, loan, 0);
  }
  if (sweptAny) broadcastLoans(io, roomId);

  // Ledger integrity verdict: two sources, because the live figures
  // alone are not enough. A captain who forged a save at round three,
  // spent the Gold down, and reports an ordinary total at the end
  // would pass a check that only ever looks at what they finish
  // holding. The mark left on their saved state is the memory of what
  // they already claimed, so both are consulted and either one is
  // enough to disqualify.
  const forgedUsers = new Set<string>();
  for (const f of finished) {
    const verdict = checkSave(
      { money: f.gold, score: f.reputation },
      roundsFor(roomDifficulty),
    );
    if (verdict.severity !== "ok") {
      console.warn(
        `[integrity] ${verdict.severity} finish user=${f.userId} room=${roomId} ${describeFindings(verdict.findings)}`,
      );
    }
    if (verdict.severity === "impossible") forgedUsers.add(f.userId);
  }
  const marked = await db.gameState.findMany({
    where: { roomId, integritySeverity: "impossible" },
    select: { userId: true, integrityNote: true },
  });
  for (const row of marked) {
    if (!forgedUsers.has(row.userId)) {
      console.warn(
        `[integrity] finish disqualified by an earlier save user=${row.userId} room=${roomId} ${row.integrityNote ?? ""}`,
      );
    }
    forgedUsers.add(row.userId);
  }
  const isForged = (userId: string) => forgedUsers.has(userId);

  const crownable = finished.filter(
    (f) => f.phase === "endgame" && !isForged(f.userId),
  );
  const winnerId = crownable.length
    ? crownable.reduce((best, f) => (f.reputation > best.reputation ? f : best))
        .userId
    : null;

  const standings: {
    userId: string;
    displayName: string;
    avatarHue: number;
    reputation: number;
    crowned: boolean;
    bankrupt: boolean;
    xpGained: number;
    leveledUp: boolean;
    brokersFavorUnlocked: boolean;
    newMerits: string[];
  }[] = [];

  // The rival standings collected alongside the broadcast standings,
  // carrying the forged flag so recordRivalOutcomes can treat a forged
  // finisher as a tie rather than a win or loss.
  const rivalStandings: RivalStanding[] = [];

  for (const f of finished) {
    const forged = isForged(f.userId);
    const xpGained = forged
      ? 0
      : Math.round(Math.max(0, f.reputation) * renownMultiplier);
    const crowned = f.userId === winnerId;
    const bankrupt = f.phase === "bankruptcy";

    const prior = await db.captainLegacy.findUnique({
      where: { userId: f.userId },
    });
    const priorLevel = prior?.renownLevel ?? 1;
    const newXP = (prior?.renownXP ?? 0) + xpGained;
    const newLevel = levelForRenownXP(newXP);
    const leveledUp = newLevel > priorLevel;
    const brokersFavorUnlocked =
      priorLevel < BROKERS_FAVOR_UNLOCK_LEVEL &&
      newLevel >= BROKERS_FAVOR_UNLOCK_LEVEL;

    // A forged finish contributes nothing permanent at all, not merely
    // no Renown. Every field holds at its prior value; the captain
    // keeps the voyage they played, the account simply does not
    // remember it.
    const newBestScore = forged
      ? (prior?.bestScore ?? 0)
      : Math.max(prior?.bestScore ?? 0, f.reputation);
    const newVoyagesCompleted =
      (prior?.voyagesCompleted ?? 0) + (forged ? 0 : 1);
    const newConsecutiveSolventVoyages = forged
      ? (prior?.consecutiveSolventVoyages ?? 0)
      : bankrupt
        ? 0
        : (prior?.consecutiveSolventVoyages ?? 0) + 1;
    const priorStats = parseStatsByDifficulty(prior?.statsByDifficulty);
    const newStatsByDifficulty = forged
      ? priorStats
      : recordVoyageInStats(priorStats, roomDifficulty, {
          crowned,
          reputation: f.reputation,
        });

    await db.captainLegacy.upsert({
      where: { userId: f.userId },
      create: {
        userId: f.userId,
        renownXP: newXP,
        renownLevel: newLevel,
        voyagesCompleted: newVoyagesCompleted,
        seaMasterCrowns: crowned ? 1 : 0,
        bestScore: newBestScore,
        consecutiveSolventVoyages: newConsecutiveSolventVoyages,
        statsByDifficulty: JSON.stringify(newStatsByDifficulty),
      },
      update: {
        renownXP: newXP,
        renownLevel: newLevel,
        ...(forged ? {} : { voyagesCompleted: { increment: 1 } }),
        ...(crowned ? { seaMasterCrowns: { increment: 1 } } : {}),
        bestScore: newBestScore,
        consecutiveSolventVoyages: newConsecutiveSolventVoyages,
        statsByDifficulty: JSON.stringify(newStatsByDifficulty),
      },
    });

    // Captain's Merits: qualifyingMerits returns everything this account
    // currently qualifies for, so the existing rows on file are what
    // turn that into a delta. A forged finish earns no merits either.
    const existingMerits = await db.captainMerit.findMany({
      where: { userId: f.userId },
      select: { meritId: true },
    });
    const existingMeritIds = new Set(existingMerits.map((m) => m.meritId));
    const qualifying = qualifyingMerits({
      newVoyagesCompleted,
      crowned,
      priorSeaMasterCrowns: prior?.seaMasterCrowns ?? 0,
      reputation: f.reputation,
      newRenownLevel: newLevel,
      consecutiveSolventVoyages: newConsecutiveSolventVoyages,
      difficulty: roomDifficulty,
      bankrupt,
    });
    const newMerits = forged
      ? []
      : qualifying.filter((id) => !existingMeritIds.has(id));
    for (const meritId of newMerits) {
      await db.captainMerit.upsert({
        where: { userId_meritId: { userId: f.userId, meritId } },
        create: { userId: f.userId, meritId },
        update: {},
      });
    }

    // Record a VoyageChronicle row for this finisher. The chronicle is
    // a narrative record, not a gameplay number, so it's written for
    // every finisher including forged ones (whose extras will be zero,
    // producing a sparse but honest chronicle). A write failure is
    // logged rather than thrown so a chronicle problem can't break the
    // conclusion for everyone else.
    const gameState = await db.gameState.findUnique({
      where: { userId_roomId: { userId: f.userId, roomId } },
      select: { data: true },
    });
    const extras = extractChronicleExtras(
      gameState?.data ?? null,
      forged,
      f.reputation,
    );
    const chronicle = buildChronicle({
      displayName: f.user.displayName,
      difficulty: roomDifficulty,
      rounds: roundsFor(roomDifficulty),
      peakReputation: extras.peakReputation,
      finalReputation: f.reputation,
      largestTrade: extras.largestTrade,
      lendCount: extras.lendCount,
      borrowCount: extras.borrowCount,
      crowned,
      bankrupt,
      merchantRating: merchantRatingForScore(f.reputation).label,
    });
    await db.voyageChronicle
      .create({
        data: {
          userId: f.userId,
          roomId,
          voyageEpoch: roomForDifficulty?.voyageEpoch ?? 0,
          difficulty: roomDifficulty,
          rounds: roundsFor(roomDifficulty),
          peakReputation: extras.peakReputation,
          finalReputation: f.reputation,
          finalGold: f.gold,
          largestTrade: extras.largestTrade,
          lendCount: extras.lendCount,
          borrowCount: extras.borrowCount,
          crowned,
          bankrupt,
          merchantRating: merchantRatingForScore(f.reputation).label,
          headline: chronicle.headline,
          body: chronicle.body,
        },
      })
      .catch((err) => {
        console.error(`[chronicle] failed to write for ${f.userId}:`, err);
      });

    // Every field here is read by a screen. A row used to carry `gold`,
    // `renownLevel` and `renownTitle` as well, and nothing ever read any
    // of the three: the Endgame panel draws final funds from the captain's
    // own game state, and the Renown level and title from the legacy
    // record it fetches alongside this payload.
    standings.push({
      userId: f.userId,
      displayName: f.user.displayName,
      avatarHue: f.user.avatarHue,
      reputation: f.reputation,
      crowned,
      bankrupt,
      xpGained,
      leveledUp,
      brokersFavorUnlocked,
      newMerits,
    });

    rivalStandings.push({
      userId: f.userId,
      reputation: f.reputation,
      gold: f.gold,
      crowned,
      bankrupt,
      forged,
    });

    if (leveledUp) {
      io.to(`room:${roomId}`).emit("room:system", {
        roomId,
        content: `${f.user.displayName} reached Renown Level ${newLevel}: ${renownTitleForLevel(newLevel)}!`,
      });
    }
    for (const meritId of newMerits) {
      const merit = meritById(meritId);
      if (!merit) continue;
      io.to(`room:${roomId}`).emit("room:system", {
        roomId,
        content: `${f.user.displayName} earned the Captain's Merit: ${merit.name}!`,
      });
    }
  }

  standings.sort((a, b) => b.reputation - a.reputation);

  // Record one CaptainRival row for every unordered pair of finishers.
  // A forged finisher's rows are recorded as ties (see rival.ts).
  await recordRivalOutcomes(
    roomId,
    roomForDifficulty?.voyageEpoch ?? 0,
    rivalStandings,
  );

  io.to(`room:${roomId}`).emit("room:voyage_complete", {
    roomId,
    winnerId,
    standings,
  });
}
