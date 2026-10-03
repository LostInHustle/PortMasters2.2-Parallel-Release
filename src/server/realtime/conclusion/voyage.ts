// =====================================================================
// What the harbor knows the moment its voyage ends.
//
// Split out of ../conclusion.ts, which is the orchestrator: every function
// here answers one question the conclusion asks, in the order it asks it.
// The room's finished roster, the boards a finished voyage leaves behind,
// the saves and the marks on them, the voyage's own row and the deal that
// belongs to it, the loans a borrower never came back for, the two verdicts
// (a forged finish, and a crown), and the two frames the room is told the
// result with.
// =====================================================================
import { RevealedCaptain } from "@/types/realtime/voyage";
import { PublicUser } from "@/types/realtime/presence";
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { roomMemberIds } from "@/lib/rooms";
import {
  difficultyConfig,
  normalizeDifficulty,
  type Difficulty,
} from "@/lib/game/difficulty";
import { normalizeMode, voyageRoundsFor, type GameMode } from "@/lib/game/mode";
import {
  drawObjective,
  fleetTrace,
  objectiveSeed,
  type Objective,
} from "@/lib/game/objectives";
import { readPeerTradeProfit } from "@/lib/game/victory";
import { checkSave, describeFindings } from "@/lib/game/integrity";
import type { ObjectiveTraceEntry } from "@/lib/game/types";
import { clearBarter, clearFlexibleAccepted } from "../barter";
import { clearBazaar } from "../bazaar";
import { getCheckpoint } from "../checkpoint";
import { escortContracts } from "../contracts";
import { clearPathVoyage } from "../draft";
import { cardsInRoom } from "../gambit";
import {
  broadcastLoans,
  loanList,
  removeLoan,
  resolveBackingFor,
} from "../loans";
import { roomMembers, userSockets } from "../presence";
import { refitContracts } from "../refits";
import { moduleTrades } from "../module-trades";
import { recordReveal } from "../reveal";
import { parseSave } from "../save";
import { roomStatuses } from "../status";
import { closeVoyageTelemetry } from "../telemetry";
import { resolveExpiredVentures } from "../ventures";

// The hand this harbor was dealt, as the module that deals it answers.
type VoyageHand = Awaited<ReturnType<typeof cardsInRoom>>;

// One captain still seated in the voyage when it ended, as the room's own
// status cache last reported them.
export type FinishedCaptain = {
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
};

// One row of the voyage conclusion standings, as it is emitted on
// room:voyage_complete and handed to the reveal.
export type StandingRow = {
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
};

// Every captain still seated when the voyage ended, or null when the group
// is not all finished yet: a harbor that has emptied, a room with no
// statuses cached, and one member still sailing are the same answer to
// this question, which is that there is nothing to conclude.
export async function readFinishedCaptains(
  roomId: string,
): Promise<FinishedCaptain[] | null> {
  const memberIds = await roomMemberIds(roomId);
  if (memberIds.length === 0) return null;
  const statuses = roomStatuses.get(roomId);
  if (!statuses) return null;

  const finished: FinishedCaptain[] = [];
  for (const id of memberIds) {
    const st = statuses.get(id);
    const phase = st ? String(st.phase) : "";
    if (!st || (phase !== "endgame" && phase !== "bankruptcy")) return null;
    finished.push({
      userId: id,
      user: st.user,
      reputation: st.reputation,
      gold: st.gold,
      phase,
      bankrupt: st.bankrupt === true,
    });
  }
  return finished;
}

// Every board that dies with the voyage, swept in the order it always was.
export async function clearVoyageBoards(
  io: Server,
  roomId: string,
): Promise<void> {
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
  // [F3: modules in the shipyard ladder, and trading them between
  // captains] And the module market's, for the fourth time and the same
  // reason: a voyage that has ended stops moving its checkpoint, so
  // nothing else would ever sweep it, and a listing left standing would
  // be one about a leg nobody is going to sail.
  moduleTrades.clear(io, roomId);
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
}

// The harbor's saves, read once, at the moment the voyage ends: the readers
// of them each want a different thing out of the same rows, and reading
// them once is what keeps those readers from describing different voyages.
type HarborSaves = {
  // The blob each captain's save parsed into, or null for a row the read
  // could not parse.
  saves: Map<string, Record<string, unknown> | null>;
  // The peer ledger per captain, the one ending figure the Broker's
  // verdict turns on.
  peerTradeProfits: Map<string, number>;
  // The rows the ledger integrity pass marked, in the shape the verdict
  // reader wants them.
  marked: { userId: string; integrityNote: string | null }[];
};

export async function readHarborSaves(roomId: string): Promise<HarborSaves> {
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
  return { saves, peerTradeProfits, marked };
}

// The voyage's record, closed at the outcome it produced.
export function closeVoyageRecord(
  roomId: string,
  peerTradeProfits: Map<string, number>,
): void {
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
}

// The voyage this harbor sailed under, and the deal that belongs to it.
export type VoyageRun = {
  // The room's own row, reduced to the one fact the steps read, or null
  // for a room that has already gone.
  room: { voyageEpoch: number } | null;
  difficulty: Difficulty;
  renownMultiplier: number;
  mode: GameMode;
  seats: number;
  rounds: number;
  // The commission the fleet was working on, null in Classic, where no
  // objective is drawn and the columns stay empty.
  objective: Objective | null;
  // The hand the room was dealt, empty in Classic, where no hand was dealt
  // and no win is judged.
  cards: VoyageHand;
};

export async function readVoyageRun(roomId: string): Promise<VoyageRun> {
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

  return {
    room: roomForDifficulty
      ? { voyageEpoch: roomForDifficulty.voyageEpoch }
      : null,
    difficulty: roomDifficulty,
    renownMultiplier,
    mode: roomMode,
    seats: roomSeats,
    rounds: roomRounds,
    objective,
    cards,
  };
}

export async function resolveOpenVentures(
  io: Server,
  roomId: string,
  room: VoyageRun["room"],
): Promise<void> {
  // Force resolve every still open venture: the voyage is over, so
  // anything still open never will fill.
  if (!room) return;
  await resolveExpiredVentures(io, roomId, room.voyageEpoch, 0, true);
}

export function sweepAbsentBorrowerLoans(
  io: Server,
  roomId: string,
  finished: FinishedCaptain[],
): void {
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
}

export function readForgedUsers(
  roomId: string,
  finished: FinishedCaptain[],
  marked: HarborSaves["marked"],
  rounds: number,
): Set<string> {
  // Ledger integrity verdict: two sources, because the live figures
  // alone are not enough. A captain who forged a save at round three,
  // spent the Gold down, and reports an ordinary total at the end
  // would pass a check that only ever looks at what they finish
  // holding. The mark left on their saved state is the memory of what
  // they already claimed, so both are consulted and either one is
  // enough to disqualify.
  const forgedUsers = new Set<string>();
  for (const f of finished) {
    const verdict = checkSave({ money: f.gold, score: f.reputation }, rounds);
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
  return forgedUsers;
}

export function pickSeaMaster(
  finished: FinishedCaptain[],
  forgedUsers: Set<string>,
): string | null {
  // The crown goes to the highest Reputation among the captains the harbor
  // has not written off, which the bankrupt flag now says out loud. It used
  // to be implicit: only the endgame phase was crownable, and until H7 the
  // only way to be bankrupt was to be sitting in the bankruptcy phase
  // instead. Now that a captain can finish the voyage at the endgame screen
  // with the mark on them, the rule it always meant is written where it is
  // read.
  const crownable = finished.filter(
    (f) => f.phase === "endgame" && !f.bankrupt && !forgedUsers.has(f.userId),
  );
  return crownable.length
    ? crownable.reduce((best, f) => (f.reputation > best.reputation ? f : best))
        .userId
    : null;
}

// The standings, as the room reads them: emitted before anything else the
// conclusion sends.
export function publishStandings(
  io: Server,
  roomId: string,
  winnerId: string | null,
  standings: StandingRow[],
): void {
  io.to(`room:${roomId}`).emit("room:voyage_complete", {
    roomId,
    winnerId,
    standings,
  });
}

// The reveal: the whole hand, every verdict and the fleet's commission leg
// by leg, as one frame. Only where there was a hand to reveal.
export function publishReveal(
  io: Server,
  reveal: {
    roomId: string;
    objective: Objective | null;
    standings: StandingRow[];
    captains: RevealedCaptain[];
    traces: ObjectiveTraceEntry[][];
  },
): void {
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
  const { roomId, objective, standings, captains, traces } = reveal;
  if (!objective) return;
  const rank = new Map(standings.map((s, index) => [s.userId, index]));
  captains.sort(
    (a, b) => (rank.get(a.userId) ?? 0) - (rank.get(b.userId) ?? 0),
  );
  recordReveal(io, {
    roomId,
    objective,
    fleetTrace: fleetTrace(traces),
    captains,
  });
}
