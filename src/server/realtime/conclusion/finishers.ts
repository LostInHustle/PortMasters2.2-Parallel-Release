// =====================================================================
// One captain's finish, from the verdict to the rows it leaves.
//
// The loop in ../conclusion.ts walks every finisher and hands each one to
// concludeFinisher below, which is the whole of what happens to a captain:
// the four verdicts the harbor decided for them, the legacy that writes
// them onto the account, the merits that follow, the chronicle row, and the
// three rows the frames are built from.
//
// A forged finish runs the same path with every permanent field held: the
// captain keeps the voyage they played, the account simply does not
// remember it.
// =====================================================================
import { RevealedCaptain } from "@/types/realtime/voyage";
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import {
  levelForRenownXP,
  parseStatsByDifficulty,
  recordVoyageInStats,
  renownTitleForLevel,
} from "@/lib/game/legacy";
import { merchantRatingForScore } from "@/lib/game/constants/reputation";
import { BROKERS_FAVOR_UNLOCK_LEVEL } from "@/lib/game/constants/world";
import { meritById, qualifyingMerits } from "@/lib/game/merits";
import { normalizeOrderFills } from "@/lib/game/audit";
import { modeConfig } from "@/lib/game/mode";
import { objectiveProgress } from "@/lib/game/objectives";
import {
  evaluateVictory,
  readEnding,
  type CaptainEnding,
} from "@/lib/game/victory";
import type { ObjectiveTraceEntry } from "@/lib/game/types";
import { buildChronicle } from "@/lib/game/engine/chronicle";
import { unlockLineFor } from "@/lib/unlock";
import { maroonResultFor } from "../maroon";
import type { RivalStanding } from "../rival";
import type { FinishedCaptain, StandingRow, VoyageRun } from "./voyage";

// What the harbor decided about one captain before anything else is read
// about them.
export type FinisherFacts = {
  // The ledger integrity pass wrote them off.
  forged: boolean;
  // The crown is theirs.
  crowned: boolean;
  // They finished the voyage bankrupt, by either signal.
  bankrupt: boolean;
  // The Renown this voyage banks them, zero for a forged finish.
  xpGained: number;
};

// The captain's Legacy row as it stands, as the reader below answers it.
type LegacyRow = Awaited<ReturnType<typeof db.captainLegacy.findUnique>>;

// The counters this finish leaves on the account, which is what the merits
// step reads back off it.
type LegacyCounters = {
  newLevel: number;
  leveledUp: boolean;
  brokersFavorUnlocked: boolean;
  newVoyagesCompleted: number;
  newConsecutiveSolventVoyages: number;
  priorSeaMasterCrowns: number;
};

// Everything this finish leaves on the account: the counters the merits step
// reads, and the three figures only the row itself is written with.
type LegacyFigures = LegacyCounters & {
  newXP: number;
  newBestScore: number;
  newStatsByDifficulty: ReturnType<typeof parseStatsByDifficulty>;
};

// The two halves of one captain's finish, as the steps below hand it down.
export type FinisherOutcome = FinisherFacts & LegacyCounters;

// Everything the steps below read about the voyage rather than about the
// captain: the room, the run it sailed, the harbor's saves, the crown and
// the captains the harbor wrote off.
export type FinisherContext = {
  roomId: string;
  run: VoyageRun;
  saves: Map<string, Record<string, unknown> | null>;
  winnerId: string | null;
  forgedUsers: Set<string>;
};

// The rows one captain's finish produces, and the outcome the announcement
// is read from.
export type FinisherRows = {
  outcome: FinisherOutcome;
  newMerits: string[];
  revealed: RevealedCaptain;
  trace: ObjectiveTraceEntry[];
  standing: StandingRow;
  rival: RivalStanding;
};

// What was read about one captain's own voyage: the save, the chronicle's
// extras out of it, and every verdict decided on it. The win verdict is
// held as `verdict` rather than as `won` for a reason that has nothing to
// do with the reading: `won` is a name the private scan reserves for the
// three places allowed to hold it as a property, and this is a local
// reader rather than a fourth one. Every row either of the two writers
// below emits still carries it as `won`.
type CaptainRecord = {
  save: Record<string, unknown> | null;
  extras: ReturnType<typeof extractChronicleExtras>;
  objectiveMet: boolean;
  card: VoyageRun["cards"][string] | undefined;
  ending: CaptainEnding;
  verdict: boolean;
  marooned: boolean;
};

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

// One captain's whole finish, in the order it has always happened in.
export async function concludeFinisher(
  f: FinishedCaptain,
  ctx: FinisherContext,
): Promise<FinisherRows> {
  const forged = ctx.forgedUsers.has(f.userId);
  const crowned = f.userId === ctx.winnerId;
  const bankrupt = f.bankrupt || f.phase === "bankruptcy";
  const xpGained = forged
    ? 0
    : Math.round(Math.max(0, f.reputation) * ctx.run.renownMultiplier);
  const facts: FinisherFacts = { forged, crowned, bankrupt, xpGained };

  const legacy = await bankCaptainLegacy(f, ctx.run, facts);
  const outcome: FinisherOutcome = { ...facts, ...legacy };
  const newMerits = await awardCaptainMerits(f, ctx.run, outcome);
  const record = readCaptainRecord(f, ctx, outcome);
  await writeChronicleRow(f, ctx, outcome, record);
  const revealed = revealRow(f, outcome, record);
  const standing = standingRow(f, outcome, record, newMerits);
  const rival = rivalRow(f, outcome);

  return {
    outcome,
    newMerits,
    revealed,
    trace: record.extras.objectiveTrace,
    standing,
    rival,
  };
}

// The voyage's Renown banked on the captain's account: the figures the row
// is written with, and the counters the merits step reads beside them.
async function bankCaptainLegacy(
  f: FinishedCaptain,
  run: VoyageRun,
  facts: FinisherFacts,
): Promise<LegacyCounters> {
  const prior = await db.captainLegacy.findUnique({
    where: { userId: f.userId },
  });
  const figures = legacyFigures(f, prior, run, facts);
  await writeLegacyRow(f, figures, facts);
  return figures;
}

// The Renown this voyage banks, and the two crossings read off it: the level
// it carries the captain to, and the Broker's Favor that opens with it.
type RenownStep = {
  newXP: number;
  newLevel: number;
  leveledUp: boolean;
  brokersFavorUnlocked: boolean;
};

function renownStep(prior: LegacyRow, facts: FinisherFacts): RenownStep {
  // The row as it stands, in the shape an account that has never finished
  // a voyage gives it: level 1 with nothing banked.
  const priorLevel = prior?.renownLevel ?? 1;
  const newXP = (prior?.renownXP ?? 0) + facts.xpGained;
  const newLevel = levelForRenownXP(newXP);
  return {
    newXP,
    newLevel,
    leveledUp: newLevel > priorLevel,
    brokersFavorUnlocked:
      priorLevel < BROKERS_FAVOR_UNLOCK_LEVEL &&
      newLevel >= BROKERS_FAVOR_UNLOCK_LEVEL,
  };
}

// Everything this finish leaves on the account, read off the row it started
// from. Every field holds at its prior value for a forged finish.
function legacyFigures(
  f: FinishedCaptain,
  prior: LegacyRow,
  run: VoyageRun,
  facts: FinisherFacts,
): LegacyFigures {
  const priorBest = prior?.bestScore ?? 0;
  const priorVoyages = prior?.voyagesCompleted ?? 0;
  const priorSolvent = prior?.consecutiveSolventVoyages ?? 0;
  const priorStats = parseStatsByDifficulty(prior?.statsByDifficulty);

  // A forged finish contributes nothing permanent at all, not merely
  // no Renown. Every field holds at its prior value; the captain
  // keeps the voyage they played, the account simply does not
  // remember it.
  const newBestScore = facts.forged
    ? priorBest
    : Math.max(priorBest, f.reputation);
  const newVoyagesCompleted = priorVoyages + (facts.forged ? 0 : 1);
  const newConsecutiveSolventVoyages = facts.forged
    ? priorSolvent
    : facts.bankrupt
      ? 0
      : priorSolvent + 1;
  const newStatsByDifficulty = facts.forged
    ? priorStats
    : recordVoyageInStats(priorStats, run.difficulty, {
        crowned: facts.crowned,
        reputation: f.reputation,
      });

  return {
    ...renownStep(prior, facts),
    newBestScore,
    newVoyagesCompleted,
    newConsecutiveSolventVoyages,
    newStatsByDifficulty,
    priorSeaMasterCrowns: prior?.seaMasterCrowns ?? 0,
  };
}

// The row those figures are written to.
async function writeLegacyRow(
  f: FinishedCaptain,
  figures: LegacyFigures,
  facts: FinisherFacts,
): Promise<void> {
  await db.captainLegacy.upsert({
    where: { userId: f.userId },
    create: {
      userId: f.userId,
      renownXP: figures.newXP,
      renownLevel: figures.newLevel,
      voyagesCompleted: figures.newVoyagesCompleted,
      seaMasterCrowns: facts.crowned ? 1 : 0,
      bestScore: figures.newBestScore,
      consecutiveSolventVoyages: figures.newConsecutiveSolventVoyages,
      statsByDifficulty: JSON.stringify(figures.newStatsByDifficulty),
    },
    update: {
      renownXP: figures.newXP,
      renownLevel: figures.newLevel,
      ...(facts.forged ? {} : { voyagesCompleted: { increment: 1 } }),
      ...(facts.crowned ? { seaMasterCrowns: { increment: 1 } } : {}),
      bestScore: figures.newBestScore,
      consecutiveSolventVoyages: figures.newConsecutiveSolventVoyages,
      statsByDifficulty: JSON.stringify(figures.newStatsByDifficulty),
    },
  });
}

// The merits this voyage earns the captain, written to the account as the
// delta the file did not already hold.
async function awardCaptainMerits(
  f: FinishedCaptain,
  run: VoyageRun,
  outcome: FinisherOutcome,
): Promise<string[]> {
  // Captain's Merits: qualifyingMerits returns everything this account
  // currently qualifies for, so the existing rows on file are what
  // turn that into a delta. A forged finish earns no merits either.
  const existingMerits = await db.captainMerit.findMany({
    where: { userId: f.userId },
    select: { meritId: true },
  });
  const existingMeritIds = new Set(existingMerits.map((m) => m.meritId));
  const qualifying = qualifyingMerits({
    newVoyagesCompleted: outcome.newVoyagesCompleted,
    crowned: outcome.crowned,
    priorSeaMasterCrowns: outcome.priorSeaMasterCrowns,
    reputation: f.reputation,
    newRenownLevel: outcome.newLevel,
    consecutiveSolventVoyages: outcome.newConsecutiveSolventVoyages,
    difficulty: run.difficulty,
    bankrupt: outcome.bankrupt,
  });
  const newMerits = outcome.forged
    ? []
    : qualifying.filter((id) => !existingMeritIds.has(id));
  for (const meritId of newMerits) {
    await db.captainMerit.upsert({
      where: { userId_meritId: { userId: f.userId, meritId } },
      create: { userId: f.userId, meritId },
      update: {},
    });
  }
  return newMerits;
}

// What this captain's own save says about the voyage: the chronicle's
// extras, the commission's standing, and the verdicts decided on them.
function readCaptainRecord(
  f: FinishedCaptain,
  ctx: FinisherContext,
  outcome: FinisherOutcome,
): CaptainRecord {
  // The blob this captain's own save was parsed into, read with the rest
  // of the harbor's above and handed to both readers below: the
  // chronicle's extras and the win verdict. A captain the read found no
  // row for reads as the absence an unreadable save gives.
  const save = ctx.saves.get(f.userId) ?? null;
  const extras = extractChronicleExtras(save, outcome.forged, f.reputation);
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
  const objectiveMet = ctx.run.objective
    ? objectiveProgress(ctx.run.objective, lastSeen?.delivered ?? {}).met
    : false;
  // [H4: the Broker] Whether this captain won the game their card set
  // them. A forged finish wins nothing, the same way it banks no Renown:
  // the account keeps no memory of the voyage at all, and the verdict is
  // the last thing that should survive it. A captain the table dealt no
  // card to is not judged either, which is the honest reading of an empty
  // seat in the hand. The ending is read out of the same save the
  // chronicle's extras came from.
  const card = ctx.run.cards[f.userId];
  // Read once and handed to both readers below: the rule decides the
  // verdict on it, and the ledger prints it. A second read of the same
  // blob is how a verdict and the numbers printed under it come to be
  // two different voyages.
  const ending = readEnding(save, {
    gold: f.gold,
    reputation: f.reputation,
    bankrupt: outcome.bankrupt,
  });
  const won =
    !outcome.forged && ctx.run.objective && card
      ? evaluateVictory({
          role: card.role,
          objective: ctx.run.objective,
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
  const marooned = maroonResultFor(ctx.roomId)?.target.userId === f.userId;
  return { save, extras, objectiveMet, card, ending, verdict: won, marooned };
}

// The prose this captain's chronicle is written in.
function chronicleInput(
  f: FinishedCaptain,
  ctx: FinisherContext,
  outcome: FinisherOutcome,
  record: CaptainRecord,
) {
  return {
    displayName: f.user.displayName,
    difficulty: ctx.run.difficulty,
    rounds: ctx.run.rounds,
    peakReputation: record.extras.peakReputation,
    finalReputation: f.reputation,
    largestTrade: record.extras.largestTrade,
    lendCount: record.extras.lendCount,
    borrowCount: record.extras.borrowCount,
    crowned: outcome.crowned,
    bankrupt: outcome.bankrupt,
    marooned: record.marooned,
    // Read from the same room row the rest of this handler reads, so the
    // prose and the rule behind it cannot come from two different modes.
    bankruptcyIsFinal: modeConfig(ctx.run.mode).bankruptcyIsFinal,
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
    unlockLine: outcome.forged
      ? null
      : unlockLineFor(outcome.newVoyagesCompleted),
  };
}

// The chronicle row itself, written for every finisher.
async function writeChronicleRow(
  f: FinishedCaptain,
  ctx: FinisherContext,
  outcome: FinisherOutcome,
  record: CaptainRecord,
): Promise<void> {
  // Record a VoyageChronicle row for this finisher. The chronicle is
  // a narrative record, not a gameplay number, so it's written for
  // every finisher including forged ones (whose extras will be zero,
  // producing a sparse but honest chronicle). A write failure is
  // logged rather than thrown so a chronicle problem can't break the
  // conclusion for everyone else.
  const chronicle = buildChronicle(chronicleInput(f, ctx, outcome, record));
  const { extras, card, verdict: won, marooned, objectiveMet } = record;
  await db.voyageChronicle
    .create({
      data: {
        userId: f.userId,
        roomId: ctx.roomId,
        voyageEpoch: ctx.run.room?.voyageEpoch ?? 0,
        // The table size this voyage was dealt to, recorded beside the
        // epoch it sailed under: the two facts the commission's own draw
        // was built out of. Copied here rather than joined later, because
        // the room's column belongs to the voyage in progress and a later
        // join would read the next voyage's size.
        seats: ctx.run.seats,
        difficulty: ctx.run.difficulty,
        rounds: ctx.run.rounds,
        peakReputation: extras.peakReputation,
        finalReputation: f.reputation,
        finalGold: f.gold,
        largestTrade: extras.largestTrade,
        lendCount: extras.lendCount,
        borrowCount: extras.borrowCount,
        crowned: outcome.crowned,
        bankrupt: outcome.bankrupt,
        marooned,
        merchantRating: merchantRatingForScore(f.reputation).label,
        headline: chronicle.headline,
        body: chronicle.body,
        mode: ctx.run.mode,
        objectiveId: ctx.run.objective?.id ?? "",
        objectiveMet,
        objectiveTrace: JSON.stringify(extras.objectiveTrace),
        alignment: card?.role ?? "",
        won,
      },
    })
    .catch((err) => {
      console.error(`[chronicle] failed to write for ${f.userId}:`, err);
    });
}

// The captain's row on the reveal ledger.
function revealRow(
  f: FinishedCaptain,
  outcome: FinisherOutcome,
  record: CaptainRecord,
): RevealedCaptain {
  // [H8: the reveal and the replay ledger] This captain's row on the
  // ledger, built from the verdict and the marks decided just above. Two
  // fields are withheld from a forged finish rather than printed: what
  // they claimed to have handed the commission and what they claimed to
  // have taken in trade are exactly as trustworthy as the Gold their
  // forgery reported, so the ledger shows a captain whose books could
  // not be read rather than a contribution they invented.
  const { card, ending, save, verdict: won, marooned } = record;
  return {
    userId: f.userId,
    displayName: f.user.displayName,
    avatarHue: f.user.avatarHue,
    role: card?.role ?? null,
    flourishId: card?.flourish?.id ?? null,
    won,
    crowned: outcome.crowned,
    bankrupt: outcome.bankrupt,
    marooned,
    forged: outcome.forged,
    gold: f.gold,
    reputation: f.reputation,
    peerTradeProfit: outcome.forged ? 0 : ending.peerTradeProfit,
    delivered: outcome.forged ? {} : ending.delivered,
    fills: outcome.forged ? [] : normalizeOrderFills(save?.orderFills),
  };
}

// The captain's row in the standings the room reads.
function standingRow(
  f: FinishedCaptain,
  outcome: FinisherOutcome,
  record: CaptainRecord,
  newMerits: string[],
): StandingRow {
  // Every field here is read by a screen. A row used to carry `gold`,
  // `renownLevel` and `renownTitle` as well, and nothing ever read any
  // of the three: the Endgame panel draws final funds from the captain's
  // own game state, and the Renown level and title from the legacy
  // record it fetches alongside this payload.
  return {
    userId: f.userId,
    displayName: f.user.displayName,
    avatarHue: f.user.avatarHue,
    reputation: f.reputation,
    crowned: outcome.crowned,
    bankrupt: outcome.bankrupt,
    marooned: record.marooned,
    xpGained: outcome.xpGained,
    leveledUp: outcome.leveledUp,
    brokersFavorUnlocked: outcome.brokersFavorUnlocked,
    newMerits,
  };
}

// The captain's row in the rival record, carrying the forged flag.
function rivalRow(f: FinishedCaptain, outcome: FinisherOutcome): RivalStanding {
  return {
    userId: f.userId,
    reputation: f.reputation,
    gold: f.gold,
    crowned: outcome.crowned,
    bankrupt: outcome.bankrupt,
    forged: outcome.forged,
  };
}

// What one voyage's finishes add up to: the rows the frames below are built
// from, and the trace each honest captain contributed to the merge.
export type FinisherTally = {
  standings: StandingRow[];
  rivalStandings: RivalStanding[];
  revealed: RevealedCaptain[];
  traces: ObjectiveTraceEntry[][];
};

// Every finisher, one at a time, in seat order.
export async function concludeFinishers(
  io: Server,
  roomId: string,
  finished: FinishedCaptain[],
  ctx: FinisherContext,
): Promise<FinisherTally> {
  // [H8: the reveal and the replay ledger] What the table is about to be
  // told, and the two things it is told it with: one row per captain, and
  // every captain's own record of how the commission stood leg by leg. The
  // rows are built here, inside the loop that is already reading each
  // captain's save and deciding their verdict, so the ledger prints what
  // the rules decided rather than a second walk over the same facts.
  const revealed: RevealedCaptain[] = [];
  const traces: ObjectiveTraceEntry[][] = [];

  const standings: StandingRow[] = [];

  // The rival standings collected alongside the broadcast standings,
  // carrying the forged flag so recordRivalOutcomes can treat a forged
  // finisher as a tie rather than a win or loss.
  const rivalStandings: RivalStanding[] = [];

  for (const f of finished) {
    const rows = await concludeFinisher(f, ctx);
    revealed.push(rows.revealed);
    // What this captain's client saw the fleet hand over, leg by leg, kept
    // for the merge below. A forged captain's record is dropped for the
    // same reason their trace never reached the Chronicle row.
    if (!rows.revealed.forged) traces.push(rows.trace);
    standings.push(rows.standing);
    rivalStandings.push(rows.rival);
    announceFinisher(io, roomId, f, rows);
  }

  return { standings, rivalStandings, revealed, traces };
}

// What the room is told about one captain's finish, right after their rows
// were built.
function announceFinisher(
  io: Server,
  roomId: string,
  f: FinishedCaptain,
  rows: FinisherRows,
): void {
  if (rows.outcome.leveledUp) {
    io.to(`room:${roomId}`).emit("room:system", {
      roomId,
      content: `${f.user.displayName} reached Renown Level ${rows.outcome.newLevel}: ${renownTitleForLevel(rows.outcome.newLevel)}!`,
    });
  }
  for (const meritId of rows.newMerits) {
    const merit = meritById(meritId);
    if (!merit) continue;
    io.to(`room:${roomId}`).emit("room:system", {
      roomId,
      content: `${f.user.displayName} earned the Captain's Merit: ${merit.name}!`,
    });
  }
}
