// =====================================================================
// Realtime layer: voyage conclusion and Captain's Legacy.
//
// Fires once per room, the moment every current member has reported
// reaching either endgame or bankruptcy: the whole harbor's voyage is
// over for everyone still seated in it. Whoever reached endgame (not
// bankrupt) with the highest reported Reputation is crowned Sea Master.
//
// This is also where Reputation earned this voyage becomes Renown XP on
// every finisher's account, persisting across every future voyage they
// ever sail, unlike Gold, cargo, and ship level, which a restart wipes on
// purpose.
//
// concludedRooms guards against firing twice for the same voyage;
// room:restart clears it so a room that plays again can conclude, and
// be crowned, again.
//
// NEW for the manifest: records one VoyageChronicle row per finisher
// (using buildChronicle from chronicle.ts) and CaptainRival rows
// for every pair of finishers (using recordRivalOutcomes from rival.ts).
//
// [H8: the reveal and the replay ledger] And flips the cards: the whole
// hand, every verdict and the fleet's commission leg by leg go out as one
// voyage:reveal frame after the standings, in the one mode where a hand
// was dealt (see ./reveal.ts).
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
import { normalizeOrderFills } from "@/lib/game/audit";
import { difficultyConfig, normalizeDifficulty } from "@/lib/game/difficulty";
import { normalizeMode, modeConfig, voyageRoundsFor } from "@/lib/game/mode";
import {
  drawObjective,
  fleetTrace,
  objectiveProgress,
  objectiveSeed,
} from "@/lib/game/objectives";
import {
  evaluateVictory,
  readEnding,
  readPeerTradeProfit,
} from "@/lib/game/victory";
import type { ObjectiveTraceEntry } from "@/lib/game/types";
import { buildChronicle } from "@/lib/game/engine/chronicle";
import { unlockLineFor } from "@/lib/unlock";
import type { PublicUser, RevealedCaptain } from "@/types/realtime";
import { roomStatuses } from "./status";
import { maroonResultFor } from "./maroon";
import { cardsInRoom } from "./gambit";
import { recordReveal } from "./reveal";
import {
  loanList,
  removeLoan,
  resolveBackingFor,
  broadcastLoans,
} from "./loans";
import { resolveExpiredVentures } from "./ventures";
import { clearBarter, clearFlexibleAccepted } from "./barter";
import { escortContracts } from "./contracts";
import { refitContracts } from "./refits";
import { clearBazaar } from "./bazaar";
import { clearPathVoyage } from "./draft";
import { getCheckpoint } from "./checkpoint";
import { userSockets, roomMembers } from "./presence";
import { recordRivalOutcomes, type RivalStanding } from "./rival";
import { parseSave } from "./save";
import { closeVoyageTelemetry } from "./telemetry";

export const concludedRooms = new Set<string>();

// Defensively extracts the chronicle's extras from a save blob already
// parsed by parseSave. The score field IS the reputation, so it's used as
// the peak figure (the heartbeat doesn't carry a separate peak). The
// loansGiven and debts arrays are outstanding counts at save time,
// which at endgame should be near zero after settleOutstandingDebts,
// but they're the best lending indicator available without a new
// schema field. Forged finishers get zeros across the board.
function extractChronicleExtras(
  data: Record<string, unknown> | null,
  forged: boolean,
  fallbackReputation: number,
): {
  peakReputation: number;
  largestTrade: number;
  lendCount: number;
  borrowCount: number;
  objectiveTrace: ObjectiveTraceEntry[];
} {
  if (forged || !data) {
    return {
      peakReputation: forged ? 0 : fallbackReputation,
      largestTrade: 0,
      lendCount: 0,
      borrowCount: 0,
      // A forged save's commission record is exactly as trustworthy as the
      // Gold it reported, which is to say not at all, so it is dropped the
      // same way the peak reputation is.
      objectiveTrace: [],
    };
  }
  return {
    peakReputation:
      typeof data.score === "number" && Number.isFinite(data.score)
        ? data.score
        : fallbackReputation,
    largestTrade: 0,
    lendCount: Array.isArray(data.loansGiven) ? data.loansGiven.length : 0,
    borrowCount: Array.isArray(data.debts) ? data.debts.length : 0,
    objectiveTrace: readObjectiveTrace(data.objectiveTrace),
  };
}

// The longest commission record worth keeping. A round appends at most one
// entry and no voyage runs past a couple of dozen, so this is headroom
// rather than a limit on honest play; it is here because the blob is
// written by a client, and an unbounded array from one would land in the
// Chronicle verbatim.
const MAX_TRACE_ENTRIES = 64;

// Reads the captain's own commission record back out of a save. Every field
// is treated as untrusted, the same discipline snapshotFromSave applies to
// money and score: an entry that is not exactly the shape expected is
// dropped rather than repaired, because a half read leg would be worse than
// an absent one. The most recent entries are the ones kept.
function readObjectiveTrace(raw: unknown): ObjectiveTraceEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: ObjectiveTraceEntry[] = [];
  for (const item of raw.slice(-MAX_TRACE_ENTRIES)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.round !== "number" ||
      !Number.isFinite(entry.round) ||
      typeof entry.at !== "number" ||
      !Number.isFinite(entry.at) ||
      !entry.delivered ||
      typeof entry.delivered !== "object" ||
      Array.isArray(entry.delivered)
    ) {
      continue;
    }
    const delivered: Record<string, number> = {};
    for (const [good, count] of Object.entries(
      entry.delivered as Record<string, unknown>,
    )) {
      if (typeof count === "number" && Number.isFinite(count)) {
        delivered[good] = count;
      }
    }
    entries.push({ round: entry.round, at: entry.at, delivered });
  }
  return entries;
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
    // [H7: Maroon and the Harbormaster] The harbor's mark, as the captain
    // last reported it. In Classic it is redundant with the bankruptcy
    // phase, which is why every reader below accepts either; in Ocean
    // Gambit it is the only place the mark survives, because a bankrupt
    // captain there goes on sailing and finishes at the endgame screen
    // like everyone else. Null on a status that never carried the field,
    // which is a status from a client older than this feature.
    bankrupt: boolean;
  }[] = [];
  for (const id of memberIds) {
    const st = statuses.get(id);
    const phase = st ? String(st.phase) : "";
    if (!st || (phase !== "endgame" && phase !== "bankruptcy")) return;
    finished.push({
      userId: id,
      user: st.user,
      reputation: st.reputation,
      gold: st.gold,
      phase,
      bankrupt: st.bankrupt === true,
    });
  }

  // The claim on this voyage, taken before any of the work below so a
  // second game:status arriving while the first captain's legacy write is
  // still in flight cannot slip through.
  //
  // Checked here rather than only at the door above, because the roster
  // read between the two is an await and this function is not the only
  // thing running: two finish reports that land in the same tick both pass
  // the check at the door, both come back to a voyage where every captain
  // has finished, and both go on to conclude it. One voyage that concludes
  // twice writes two chronicles, banks a second crown's worth of Renown,
  // records every rival row twice and sends the whole room two copies of
  // every frame this function ends with. Nothing between this check and
  // the claim below yields, so the captain who loses the race reads the
  // set here and leaves.
  if (concludedRooms.has(roomId)) return;
  concludedRooms.add(roomId);

  // The voyage is over, so the trade board goes with it. Nothing else
  // would ever sweep it: the board is cleared when the room's checkpoint
  // moves on, and a voyage that has finished stops moving its checkpoint
  // entirely, because endgame and bankruptcy are personal phases that
  // never become a room checkpoint. Without this, an offer still standing
  // when the last captain finishes would leave its poster escrowed in the
  // save they end the voyage with. Each client returns its own escrow as
  // the board empties.
  clearBarter(io, roomId);
  // [D3: Convoy: the Escort Contract] [D4: Loom: the Refit] And the two
  // consent boards, for the same reason and with the same shape: a voyage
  // that has ended stops moving its checkpoint, so nothing else would ever
  // sweep them, and a promise left standing on either would be one about a
  // leg nobody is going to sail.
  escortContracts.clear(io, roomId);
  refitContracts.clear(io, roomId);
  // [D5: Aroma: the Bazaar Rumor] And the bazaar's rows, for the third time
  // and the same reason. They carry no escrow and no promise, so nothing is
  // left hanging by them, but a row is about a voyage's leg and the voyage
  // it is about has ended: the next one starts with a bazaar nobody has
  // spoken at, which is also what every captain's cooldown is measured
  // from. The leg is read here rather than carried on the call, because
  // every send from this board is personalized by the room's leg and a
  // cleared board is still a send. This is a map lookup: the checkpoint
  // this voyage has been holding all along is still in hand.
  clearBazaar(io, roomId, (await getCheckpoint(roomId)).round);
  // [D7: the draft, and switching] And the path draft's two maps, for the
  // fourth time and the same reason. A draft that outlived the voyage would
  // be a hand of cards dealt to a table that has finished sailing, and it
  // would be the one thing left in this process that could still write a
  // path into a captain's save after the chronicle was drawn. The book of
  // switches goes with it: the voyage it counted is over, and the next one
  // hands every captain their one switch back. There is nothing to publish
  // here beyond the null views the clear sends, and no line for the log,
  // which has just been written up.
  clearPathVoyage(io, roomId);
  // The voyage is over, so the flexible allowance goes with it. Next
  // voyage opens on a full one, which is also the only moment a captain's
  // Renown can have moved, so the counter can never carry a stale level's
  // worth of taken offers into a voyage that allows more of them.
  clearFlexibleAccepted(roomId);
  // [I2: the two measurements most likely to be skipped] The harbor's
  // saves, read once, at the moment the voyage ends.
  //
  // This is the one moment they still exist as a set. A voyage that
  // concludes ends with every save in place; the two endings that do not
  // conclude hand the record no ledger at all, because a harbor that
  // empties takes its saves with it when the room row goes, and a wipe
  // closes its record at a moment with no conclusion behind it to have
  // read one.
  //
  // Three readers below want them and each wants a different thing out of
  // them, which is why the read is here rather than at any of the three:
  // the record's captain lines carry the peer ledger, the marks the
  // integrity pass left are read out of the same rows, and every verdict
  // below is decided on the blob its own chronicle's extras came from.
  // Reading them once is what keeps those three from describing three
  // different voyages, and it is the reading the record's own two fields
  // are documented as sharing with the rule.
  const saves = new Map<string, Record<string, unknown> | null>();
  // The peer ledger per captain, which is the one ending figure the
  // Broker's verdict turns on. Built here from the same blob the verdict
  // is decided on below, so a captain's line cannot report a profit the
  // rule did not judge them on.
  const peerTradeProfits = new Map<string, number>();
  // The rows the ledger integrity pass marked, in the shape the verdict
  // loop below reads them: it disqualifies every row marked impossible at
  // any point in the voyage, since the live figures alone cannot see a
  // save that was forged at round three and spent down since.
  const marked: { userId: string; integrityNote: string | null }[] = [];
  for (const row of await db.gameState.findMany({
    where: { roomId },
    select: {
      userId: true,
      data: true,
      integritySeverity: true,
      integrityNote: true,
    },
  })) {
    const save = parseSave(row.data);
    saves.set(row.userId, save);
    peerTradeProfits.set(row.userId, readPeerTradeProfit(save));
    if (row.integritySeverity === "impossible") {
      marked.push({ userId: row.userId, integrityNote: row.integrityNote });
    }
  }

  // [I1: the telemetry spine] The voyage concluded, which is the outcome
  // of the three an ending produces, and the record closes here rather
  // than at the bottom of this function so the write is on its way before
  // the legacy, chronicle and rival writes that follow, none of which are
  // measurement and all of which are slower. The captains still standing
  // are the room's live sockets: a member whose screen is dark is seated
  // but not present, and the plan's retention figure reads that
  // distinction rather than a seat count. Not awaited for the same reason
  // the restart does not await it, and a record that cannot be written is
  // logged by the spine rather than thrown into this handler.
  void closeVoyageTelemetry(
    roomId,
    "concluded",
    roomMembers(roomId).map((m) => m.id),
    peerTradeProfits,
  );

  const roomForDifficulty = await db.room.findUnique({
    where: { id: roomId },
    select: {
      difficulty: true,
      voyageEpoch: true,
      voyageSeats: true,
      mode: true,
    },
  });
  const roomDifficulty = normalizeDifficulty(roomForDifficulty?.difficulty);
  const renownMultiplier = difficultyConfig(roomDifficulty).renownXpMultiplier;

  // The commission this harbor was working on, drawn from the same seed
  // every client drew it from: the room's id is the harbor's id, and the
  // epoch and the pinned seat count are the voyage it sailed under, so the
  // server arrives at the identical deck entry without ever having been
  // told what it was. Both rung inputs have to be here rather than only in
  // the clamp: this draw is what the met flag below is read from, so a
  // conclusion that drew the founding board for a six seat voyage would
  // call every commission a full table filled unmet. Null in Classic,
  // where no objective is drawn and the columns stay empty.
  const roomMode = normalizeMode(roomForDifficulty?.mode);
  const roomSeats = roomForDifficulty?.voyageSeats ?? 0;
  // [I5: session length, and table size] The voyage's own length, read once
  // and reused by the three places that need it: the chronicle's prose, the
  // chronicle row, and the ceiling the finishers' saves are judged against.
  // The tier's ladder is not the voyage's length on a mode that pins one,
  // and reading it here would have judged a twelve leg Gambit voyage against
  // an eight round ceiling, which is a false forgery rather than a strict
  // check: the honest captain it flags is the one who played the longer
  // voyage well.
  const roomRounds = voyageRoundsFor(roomMode, roomDifficulty);
  const objective =
    roomMode === "ocean_gambit"
      ? drawObjective(
          objectiveSeed(roomId, roomForDifficulty?.voyageEpoch ?? 0, roomSeats),
          roomSeats,
        )
      : null;

  // The hand this harbor was dealt, read once for the whole conclusion,
  // which is the one reader outside the table that has any business
  // knowing it. Read here rather than inside the finisher loop below
  // because it is one row per seat and the loop walks every seat, and left
  // empty in Classic, where no hand was dealt and no win is judged.
  const cards = roomMode === "ocean_gambit" ? await cardsInRoom(roomId) : {};

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
  // Insolvency is final for the purposes of this sweep in either mode,
  // because the sweep runs at the moment the voyage concludes and there
  // are no more rounds to earn anything back in: a bankrupt captain keeps
  // their socket open to watch the standings rather than to pay anybody,
  // so treating them as present stranded their loans for good. This sweep
  // is the only thing that ever closes a loan its borrower never reports,
  // and with it skipped the pledge riding on the loan never resolved
  // either.
  //
  // The mark is read from either signal for the reason above: Classic
  // reports it as the bankruptcy phase, and Ocean Gambit, where the seat
  // survives, reports it as the flag.
  const bankrupt = new Set(
    finished
      .filter((f) => f.bankrupt || f.phase === "bankruptcy")
      .map((f) => f.userId),
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
      roomRounds,
    );
    if (verdict.severity !== "ok") {
      console.warn(
        `[integrity] ${verdict.severity} finish user=${f.userId} room=${roomId} ${describeFindings(verdict.findings)}`,
      );
    }
    if (verdict.severity === "impossible") forgedUsers.add(f.userId);
  }
  // The marks themselves were read with the rest of the harbor's saves
  // above, which is the same query this used to run a second time: one
  // read of the room's rows, and this is the reader that turns them into
  // disqualifications.
  for (const row of marked) {
    if (!forgedUsers.has(row.userId)) {
      console.warn(
        `[integrity] finish disqualified by an earlier save user=${row.userId} room=${roomId} ${row.integrityNote ?? ""}`,
      );
    }
    forgedUsers.add(row.userId);
  }
  const isForged = (userId: string) => forgedUsers.has(userId);

  // The crown goes to the highest Reputation among the captains the harbor
  // has not written off, which the bankrupt flag now says out loud. It used
  // to be implicit: only the endgame phase was crownable, and until H7 the
  // only way to be bankrupt was to be sitting in the bankruptcy phase
  // instead. Now that a captain can finish the voyage at the endgame screen
  // with the mark on them, the rule it always meant is written where it is
  // read.
  const crownable = finished.filter(
    (f) => f.phase === "endgame" && !f.bankrupt && !isForged(f.userId),
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
    // [H7: Maroon and the Harbormaster] Beside bankrupt rather than folded
    // into it: both are marks a failed voyage leaves, and a seat can carry
    // either, both or neither.
    marooned: boolean;
    xpGained: number;
    leveledUp: boolean;
    brokersFavorUnlocked: boolean;
    newMerits: string[];
  }[] = [];

  // The rival standings collected alongside the broadcast standings,
  // carrying the forged flag so recordRivalOutcomes can treat a forged
  // finisher as a tie rather than a win or loss.
  const rivalStandings: RivalStanding[] = [];

  // [H8: the reveal and the replay ledger] What the table is about to be
  // told, and the two things it is told it with: one row per captain, and
  // every captain's own record of how the commission stood leg by leg. The
  // rows are built here, inside the loop that is already reading each
  // captain's save and deciding their verdict, so the ledger prints what
  // the rules decided rather than a second walk over the same facts.
  const revealed: RevealedCaptain[] = [];
  const traces: ObjectiveTraceEntry[][] = [];

  for (const f of finished) {
    const forged = isForged(f.userId);
    const xpGained = forged
      ? 0
      : Math.round(Math.max(0, f.reputation) * renownMultiplier);
    const crowned = f.userId === winnerId;
    const bankrupt = f.bankrupt || f.phase === "bankruptcy";

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
    // The blob this captain's own save was parsed into, read with the rest
    // of the harbor's above and handed to both readers below: the
    // chronicle's extras and the win verdict. A captain the read found no
    // row for reads as the absence an unreadable save gives.
    const save = saves.get(f.userId) ?? null;
    const extras = extractChronicleExtras(save, forged, f.reputation);
    // Whether the commission was met is read from the last leg this
    // captain's client recorded, which is the only place it was ever
    // known: the fleet's total is transient server state and is gone by
    // the time the voyage concludes.
    const lastSeen = extras.objectiveTrace[extras.objectiveTrace.length - 1];
    // Whether the fleet's commission was met, computed once and used
    // twice, because the column below and the verdict under it must not be
    // able to disagree: a row recording one answer while the win was
    // decided on another is the one contradiction this row must never
    // carry.
    const objectiveMet = objective
      ? objectiveProgress(objective, lastSeen?.delivered ?? {}).met
      : false;
    // [H4: the Broker] Whether this captain won the game their card set
    // them. A forged finish wins nothing, the same way it banks no Renown:
    // the account keeps no memory of the voyage at all, and the verdict is
    // the last thing that should survive it. A captain the table dealt no
    // card to is not judged either, which is the honest reading of an empty
    // seat in the hand. The ending is read out of the same save the
    // chronicle's extras came from.
    const card = cards[f.userId];
    // Read once and handed to both readers below: the rule decides the
    // verdict on it, and the ledger prints it. A second read of the same
    // blob is how a verdict and the numbers printed under it come to be
    // two different voyages.
    const ending = readEnding(save, {
      gold: f.gold,
      reputation: f.reputation,
      bankrupt,
    });
    const won =
      !forged && objective && card
        ? evaluateVictory({
            role: card.role,
            objective,
            objectiveMet,
            flourish: card.flourish,
            ending,
          })
        : false;
    // [H7: Maroon and the Harbormaster] Whether the harbor voted this
    // captain ashore, read from the server's own record of the vote rather
    // than from the captain's status. It is the one fact in this row the
    // server watched happen, so it is the one fact that does not have to be
    // taken on a client's word.
    const marooned = maroonResultFor(roomId)?.target.userId === f.userId;
    const chronicle = buildChronicle({
      displayName: f.user.displayName,
      difficulty: roomDifficulty,
      rounds: roomRounds,
      peakReputation: extras.peakReputation,
      finalReputation: f.reputation,
      largestTrade: extras.largestTrade,
      lendCount: extras.lendCount,
      borrowCount: extras.borrowCount,
      crowned,
      bankrupt,
      marooned,
      // Read from the same room row the rest of this handler reads, so the
      // prose and the rule behind it cannot come from two different modes.
      bankruptcyIsFinal: modeConfig(roomMode).bankruptcyIsFinal,
      merchantRating: merchantRatingForScore(f.reputation).label,
      // [H9: the unlock code] The harbor's own line, on the one voyage it
      // belongs to. Read from the count this loop just wrote rather than
      // from the row it read, because the row holds the count from before
      // this voyage: a captain whose tenth voyage this was is the one the
      // line is for, and reading the prior value would hand it to whoever
      // sailed their eleventh.
      //
      // A forged finish is excluded by name rather than left to the count.
      // The count of a forged finish does not move, so a captain sitting on
      // ten who forges would otherwise be handed the harbor's line on every
      // voyage they fake, which is precisely the account memory the
      // integrity pass refuses to keep.
      unlockLine: forged ? null : unlockLineFor(newVoyagesCompleted),
    });
    await db.voyageChronicle
      .create({
        data: {
          userId: f.userId,
          roomId,
          voyageEpoch: roomForDifficulty?.voyageEpoch ?? 0,
          // The table size this voyage was dealt to, recorded beside the
          // epoch it sailed under: the two facts the commission's own draw
          // was built out of. Copied here rather than joined later, because
          // the room's column belongs to the voyage in progress and a later
          // join would read the next voyage's size.
          seats: roomSeats,
          difficulty: roomDifficulty,
          rounds: roomRounds,
          peakReputation: extras.peakReputation,
          finalReputation: f.reputation,
          finalGold: f.gold,
          largestTrade: extras.largestTrade,
          lendCount: extras.lendCount,
          borrowCount: extras.borrowCount,
          crowned,
          bankrupt,
          marooned,
          merchantRating: merchantRatingForScore(f.reputation).label,
          headline: chronicle.headline,
          body: chronicle.body,
          mode: roomMode,
          objectiveId: objective?.id ?? "",
          objectiveMet,
          objectiveTrace: JSON.stringify(extras.objectiveTrace),
          alignment: card?.role ?? "",
          won,
        },
      })
      .catch((err) => {
        console.error(`[chronicle] failed to write for ${f.userId}:`, err);
      });

    // [H8: the reveal and the replay ledger] This captain's row on the
    // ledger, built from the verdict and the marks decided just above. Two
    // fields are withheld from a forged finish rather than printed: what
    // they claimed to have handed the commission and what they claimed to
    // have taken in trade are exactly as trustworthy as the Gold their
    // forgery reported, so the ledger shows a captain whose books could
    // not be read rather than a contribution they invented.
    revealed.push({
      userId: f.userId,
      displayName: f.user.displayName,
      avatarHue: f.user.avatarHue,
      role: card?.role ?? null,
      flourishId: card?.flourish?.id ?? null,
      won,
      crowned,
      bankrupt,
      marooned,
      forged,
      gold: f.gold,
      reputation: f.reputation,
      peerTradeProfit: forged ? 0 : ending.peerTradeProfit,
      delivered: forged ? {} : ending.delivered,
      fills: forged ? [] : normalizeOrderFills(save?.orderFills),
    });
    // What this captain's client saw the fleet hand over, leg by leg, kept
    // for the merge below. A forged captain's record is dropped for the
    // same reason their trace never reached the Chronicle row.
    if (!forged) traces.push(extras.objectiveTrace);

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
      marooned,
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

  // [H8: the reveal and the replay ledger] And then the cards come down.
  //
  // Emitted after the standings rather than with them, and never in place
  // of them: a captain watching the end of a voyage is owed the result
  // first, and the ledger is what they read next. It goes out in one frame
  // to the whole room, because the reveal is the table's moment rather than
  // a private one, and it is the only frame in the mode that names an
  // alignment to anyone but its holder.
  //
  // Only where there was a hand to reveal. Classic deals no cards, so its
  // conclusion has no alignment to name and the guard below is what keeps
  // an empty ledger off its screen. The order is the standings':
  // `standings` was sorted a few lines up, and the ledger reads in the same
  // order so the two blocks on the screen tell one story.
  if (objective) {
    const rank = new Map(standings.map((s, index) => [s.userId, index]));
    revealed.sort(
      (a, b) => (rank.get(a.userId) ?? 0) - (rank.get(b.userId) ?? 0),
    );
    recordReveal(io, {
      roomId,
      objective,
      fleetTrace: fleetTrace(traces),
      captains: revealed,
    });
  }
}
