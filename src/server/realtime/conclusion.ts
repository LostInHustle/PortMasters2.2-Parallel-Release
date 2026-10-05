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
import { clearAdvanceWatch } from "./checkpoint";
import { recordRivalOutcomes } from "./rival";
import {
  awaitSettlementBeat,
  clearVoyageBoards,
  closeVoyageRecord,
  pickSeaMaster,
  publishReveal,
  publishStandings,
  readFinishedCaptains,
  readForgedUsers,
  readHarborSaves,
  readVoyageRun,
  resolveOpenVentures,
  sweepAbsentBorrowerLoans,
} from "./conclusion/voyage";
import {
  concludeFinishers,
  type FinisherContext,
} from "./conclusion/finishers";

export const concludedRooms = new Set<string>();

// The whole conclusion of one voyage, in the order it has always happened
// in. Every step below is one of the questions this moment asks, and the
// two readers that walk the table are the two loops it always had: the
// finishers, one at a time, and the rival record over the rows they left.
export async function maybeConcludeVoyage(
  io: Server,
  roomId: string,
): Promise<void> {
  if (concludedRooms.has(roomId)) return;
  const finished = await readFinishedCaptains(roomId);
  if (!finished) return;

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

  // The watch on the last announcement of this voyage, stood down. The
  // promise it guards is that a report naming a later seat will move the
  // room's checkpoint, and the leg a voyage ends on keeps that promise in
  // the other currency: every captain who finished is standing on a phase
  // no lap contains, which has no rank and so can never move anything. Left
  // armed, it would fire a quarter minute after the crown was handed out
  // and tell a table that has finished sailing that the harbor is waiting
  // on them.
  clearAdvanceWatch(roomId);
  await clearVoyageBoards(io, roomId);
  const run = await readVoyageRun(roomId);
  await resolveOpenVentures(io, roomId, run.room);
  sweepAbsentBorrowerLoans(io, roomId, finished);
  // [bug cycle: the settled purse] The room's own sweeps just paid out:
  // an escrow came back to its poster when the trade board cleared, an
  // open venture refunded its half, and a loan the harbor had written
  // off settled at zero. Every one of those lands in the captain's own
  // client and comes back on that client's next broadcast, so the
  // verdicts below wait one beat for the room to speak again before the
  // numbers they are judged on are read. Without that beat, every purse
  // in the harbor was read one moment before the voyage paid it out:
  // the field report's own shape, 446 gold beside a 450 purse goal while
  // the captain's own screen was showing the refunded total.
  await awaitSettlementBeat();
  // The harbor's saves, read once, now behind the beat for the same
  // reason the roster below is: an escrow refund writes goods, not coin,
  // and the stock a flourish is judged on lives in the save a client
  // rewrites a beat after the change.
  const harbor = await readHarborSaves(roomId);
  closeVoyageRecord(roomId, harbor.peerTradeProfits);
  // The finished roster, read back once the room has had its beat. The
  // numbers every verdict below is judged on are therefore the numbers
  // the captains' clients just reported, which are the numbers their own
  // endgame screens are showing. A room whose members left during the
  // beat keeps the reading taken at the door, which is the only reading
  // there is.
  const settled = (await readFinishedCaptains(roomId)) ?? finished;
  const forgedUsers = readForgedUsers(
    roomId,
    settled,
    harbor.marked,
    run.rounds,
  );
  const winnerId = pickSeaMaster(settled, forgedUsers);
  const ctx: FinisherContext = {
    roomId,
    run,
    saves: harbor.saves,
    winnerId,
    forgedUsers,
  };

  const tally = await concludeFinishers(io, roomId, settled, ctx);
  const { standings, rivalStandings, revealed, traces } = tally;
  standings.sort((a, b) => b.reputation - a.reputation);

  // Record one CaptainRival row for every unordered pair of finishers.
  // A forged finisher's rows are recorded as ties (see rival.ts).
  await recordRivalOutcomes(roomId, run.room?.voyageEpoch ?? 0, rivalStandings);

  publishStandings(io, roomId, winnerId, standings);
  publishReveal(io, {
    roomId,
    objective: run.objective,
    standings,
    captains: revealed,
    traces,
  });
}
