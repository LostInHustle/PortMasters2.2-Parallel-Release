// What the harbor knows the moment its voyage ends.
//
// Every function here answers one question the conclusion asks, in the order it
// asks it: the finished roster, the boards left behind, the saves and their
// marks, the voyage row and its deal, unrepaid loans, the two verdicts, and the
// frames the harbor is told the result with.
import { RevealedCaptain, type StandingRow } from "@/types/realtime/voyage";
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
import { bankruptMark, leftTheVoyage } from "@/lib/seatMarks";
import { checkSave, describeFindings } from "@/lib/game/integrity";
import type { ObjectiveTraceEntry } from "@/lib/game/types";
import { clearBarter, clearFlexibleAccepted } from "../barter";
import { clearBazaar } from "../bazaar";
import { roomChannel } from "../channel";
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

// The hand this harbor was dealt, as the dealing module answers.
type VoyageHand = Awaited<ReturnType<typeof cardsInRoom>>;

// One captain still seated when the voyage ended, as the status cache last saw them.
export type FinishedCaptain = {
  userId: string;
  user: PublicUser;
  reputation: number;
  gold: number;
  phase: string;
  // The harbor's mark, as the captain last reported it. In Classic it is
  // redundant with the bankruptcy phase, which is why readers accept either; in
  // Ocean Gambit it is the only place the mark survives, since a bankrupt
  // captain goes on sailing. Null on a status from an older client.
  bankrupt: boolean;
};

// Every captain still seated when the voyage ended, or null when there is
// nothing to conclude: an emptied harbor, no cached statuses, and one member
// still sailing are the same answer.
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
    // Every seat has to have left the voyage, read through the roster's own
    // predicate: no status and still sailing are the same answer here (see
    // leftTheVoyage in @/lib/seatMarks).
    if (!st || !leftTheVoyage(st)) return null;
    finished.push({
      userId: id,
      user: st.user,
      reputation: st.reputation,
      gold: st.gold,
      phase: String(st.phase),
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
  // The voyage is over, so the trade board goes with it. Nothing else would
  // sweep it: the board clears when the checkpoint moves, and a finished voyage
  // stops moving its checkpoint. Without this, an offer still standing would
  // leave its poster escrowed in the save they end with.
  clearBarter(io, roomId);
  // The two consent boards, same reason and shape: a finished voyage stops moving
  // its checkpoint, so a promise left standing would be about a round nobody sails.
  escortContracts.clear(io, roomId);
  refitContracts.clear(io, roomId);
  // The module market, same reason: a listing left standing would be about a round
  // nobody is going to sail.
  moduleTrades.clear(io, roomId);
  // The bazaar's rows, same reason. They carry no escrow, but a row is about a
  // round and the voyage has ended. The round is read here because every send from
  // this board is personalized by it, and the checkpoint is still in hand.
  clearBazaar(io, roomId, (await getCheckpoint(roomId)).round);
  // The path draft's maps, same reason. A draft that outlived the voyage would
  // be a hand dealt to a finished table, and could still write a path into a
  // save after the chronicle was drawn. The switch book goes with it.
  clearPathVoyage(io, roomId);
  // The flexible allowance goes too, so the next voyage opens on a full one and
  // the counter cannot carry a stale level's taken offers forward.
  clearFlexibleAccepted(roomId);
}

// The harbor's saves, read once when the voyage ends: each reader wants a
// different thing from the same rows, and reading once keeps them from
// describing different voyages.
type HarborSaves = {
  // Parsed save per captain, or null for a row that could not parse.
  saves: Map<string, Record<string, unknown> | null>;
  // The peer ledger per captain, the Broker's one ending figure.
  peerTradeProfits: Map<string, number>;
  // Rows the integrity pass marked, in the verdict reader's shape.
  marked: { userId: string; integrityNote: string | null }[];
};

export async function readHarborSaves(roomId: string): Promise<HarborSaves> {
  // The saves are read once, at the moment the voyage ends, and this is the one
  // moment they still exist as a set. The two non-concluding endings hand the
  // record no ledger: an emptied harbor takes its saves with it, and a wipe has
  // no conclusion behind it to have read one.
  //
  // Three readers want different things from these rows: the record's captain
  // lines need the peer ledger, the integrity marks come from the same rows, and
  // every verdict is decided on the blob its own chronicle came from.
  const saves = new Map<string, Record<string, unknown> | null>();
  // The peer ledger per captain, built from the same blob the verdict is decided
  // on, so a captain's line cannot report a profit the rule did not judge.
  const peerTradeProfits = new Map<string, number>();
  // Rows the integrity pass marked. A row marked impossible at any point
  // disqualifies, since live figures cannot see a save forged earlier and spent down.
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
  // The voyage concluded, and the record closes here rather than at the bottom
  // so the write is under way before the slower legacy, chronicle and rival
  // writes. Present captains are the harbor's live sockets, not its seats.
  // Not awaited: the spine logs a failed write rather than throwing into the handler.
  void closeVoyageTelemetry(
    roomId,
    "concluded",
    roomMembers(roomId).map((m) => m.id),
    peerTradeProfits,
  );
}

// The voyage this harbor sailed under, and the deal that belongs to it.
export type VoyageRun = {
  // The harbor's row, reduced to the one fact the steps read, or null if gone.
  room: { voyageEpoch: number } | null;
  difficulty: Difficulty;
  renownMultiplier: number;
  mode: GameMode;
  seats: number;
  rounds: number;
  // The fleet's commission, null in Classic.
  objective: Objective | null;
  // The hand the harbor was dealt, empty in Classic.
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

  // The commission, drawn from the same seed every client drew it from: room
  // id, epoch and the pinned seat count are the voyage, so the server arrives
  // at the same deck entry without being told. Both rung inputs must be here,
  // since this draw is what the met flag below reads.
  const roomMode = normalizeMode(roomForDifficulty?.mode);
  const roomSeats = roomForDifficulty?.voyageSeats ?? 0;
  // The voyage's length, read once and reused for the chronicle prose, the
  // chronicle row, and the finishers' ceiling. The tier's ladder is not the
  // voyage's length on a mode that pins one; using it would flag an honest
  // captain on a longer voyage.
  const roomRounds = voyageRoundsFor(roomMode, roomDifficulty);
  const objective =
    roomMode === "ocean_gambit"
      ? drawObjective(
          objectiveSeed(roomId, roomForDifficulty?.voyageEpoch ?? 0, roomSeats),
          roomSeats,
        )
      : null;

  // The hand, read once for the whole conclusion, the one reader outside the
  // table that needs it. Empty in Classic.
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
  // Force resolve every still open venture: the voyage is over, so none will fill.
  if (!room) return;
  await resolveExpiredVentures(io, roomId, room.voyageEpoch, 0, true);
}

export function sweepAbsentBorrowerLoans(
  io: Server,
  roomId: string,
  finished: FinishedCaptain[],
): void {
  // Sweep stale loans for absent borrowers. A still connected borrower
  // Sweep loans whose borrower is absent. A connected borrower may still be
  // settling, and sweeping would race their report; an absent one paid nothing,
  // so 0 is honest.
  //
  // Insolvency is final for this sweep in either mode: it runs when the voyage
  // concludes and there are no more rounds to earn anything back. A bankrupt
  // captain keeps a socket open to watch, so treating them as present stranded
  // their loans for good, and the pledge riding on the loan never resolved.
  // The mark is read through bankruptMark, which accepts either signal.
  const bankrupt = new Set(
    finished.filter((f) => bankruptMark(f)).map((f) => f.userId),
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

// The beat the conclusion stops for after its sweeps. The sweeps pay the last
// money out: escrow returns when the trade board clears, an open venture refunds
// its half, and each lands in a client and returns on its next broadcast. The
// status beacon follows within 120ms and autosave within 700ms, so a beat and a
// half stands past both. A verdict read early says a captain lost a goal their
// endgame screen says they met.
const SETTLEMENT_BEAT_MS = 1500;

export function awaitSettlementBeat(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, SETTLEMENT_BEAT_MS));
}

export function readForgedUsers(
  roomId: string,
  finished: FinishedCaptain[],
  marked: HarborSaves["marked"],
  rounds: number,
): Set<string> {
  // Two sources, both needed: live figures cannot catch a save forged at round
  // three and spent down since, and the mark is the memory of what was claimed.
  // Either one disqualifies.
  const forgedUsers = new Set<string>();
  for (const f of finished) {
    const verdict = checkSave({ money: f.gold, score: f.reputation }, rounds);
    if (verdict.severity !== "ok") {
      console.warn(
        `[integrity] ${verdict.severity} finish user=${f.userId} harbor=${roomId} ${describeFindings(verdict.findings)}`,
      );
    }
    if (verdict.severity === "impossible") forgedUsers.add(f.userId);
  }
  // The marks were read with the rest of the saves above; this turns them into disqualifications.
  for (const row of marked) {
    if (!forgedUsers.has(row.userId)) {
      console.warn(
        `[integrity] finish disqualified by an earlier save user=${row.userId} harbor=${roomId} ${row.integrityNote ?? ""}`,
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
  // The crown goes to the highest Reputation among captains the harbor has not
  // written off. The bankrupt flag makes that explicit, since a captain can now
  // finish at the endgame screen with the mark on them.
  const crownable = finished.filter(
    (f) => f.phase === "endgame" && !f.bankrupt && !forgedUsers.has(f.userId),
  );
  return crownable.length
    ? crownable.reduce((best, f) => (f.reputation > best.reputation ? f : best))
        .userId
    : null;
}

// The standings, emitted before anything else the conclusion sends.
export function publishStandings(
  io: Server,
  roomId: string,
  winnerId: string | null,
  standings: StandingRow[],
): void {
  io.to(roomChannel(roomId)).emit("room:voyage_complete", {
    roomId,
    winnerId,
    standings,
  });
}

// The reveal: the whole hand, every verdict and the fleet's trace, as one frame.
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
  // And then the cards come down. Emitted after the standings and never in place
  // of them: the result first, the ledger next. One frame to the whole harbor,
  // since the reveal is the table's moment and the only frame that names an
  // alignment to anyone but its holder. Classic deals no cards, so the guard
  // keeps an empty ledger off its screen.
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
