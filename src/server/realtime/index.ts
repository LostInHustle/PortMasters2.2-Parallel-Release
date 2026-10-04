// =====================================================================
// PortMasters 2.2 Parallel Release: realtime layer (Socket.IO).
//
// Mounted on the very same HTTP server as the Next.js app (see
// server.ts), so the site, the REST API and the realtime channel all
// share one origin and one port. There is no gateway in front of this
// and no second process to start.
//
// This file is the composition root. It creates the Socket.IO server,
// holds the cross module room teardown (the one list of every per room
// structure, and the callbacks a departure runs), and wires the
// connection. The frames themselves live one concern to a file under
// ./wiring, each of them a leaf nothing else imports, and this file names
// each one in the order the connection takes its shape. What is left here
// is the assembly no single feature module can do for itself, because
// this is the place that knows all of them.
//
// The endpoint keeps the library default of "/socket.io" so it can never
// shadow an application route. Cross origin access is deliberately left
// closed: every browser reaches this on the app's own origin, so nobody
// needs a CORS grant. The ping timings are generous so a captain who
// tabs away for a minute is not dropped in the middle of a voyage.
// =====================================================================
import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";

import { SOCKET_PATH } from "@/lib/realtime-endpoint";
import { db } from "@/lib/db";
import { authenticate } from "./auth";
import {
  rememberSocket,
  reconcileMembershipAfterBoot,
  forgetDetailRequests,
  type DepartureCleanup,
} from "./presence";
import { clearRoomStatuses } from "./status";
import {
  clearAdvanceWatch,
  disarmPhaseClock,
  roomCheckpoints,
} from "./checkpoint";
import {
  removeUserBarterOffers,
  clearBarterSilent,
  clearFlexibleAccepted,
} from "./barter";
import { escortContracts } from "./contracts";
import { refitContracts } from "./refits";
import { moduleTrades } from "./module-trades";
import { clearBazaarSilent } from "./bazaar";
import { removeUserAidRequest, clearAidSilent } from "./aid";
import { hydrateLoans, clearLoansSilent } from "./loans";
import { emitRoomMembers, clearMutedUsers, clearSessionChat } from "./chat";
import { concludedRooms, maybeConcludeVoyage } from "./conclusion";
// [D7: the draft, and switching] The room's half of the path draft, and its
// book of switches. It is dealt in the same breath as the alignment cards
// above and cleared in the same places they are, because the two are the
// same kind of thing: private information this process mints, hands to one
// captain, and takes back when the voyage it belonged to ends.
import { clearPathVoyageSilent } from "./draft";
import { clearPulseTallies } from "./pulse";
import { clearObjectiveTallies } from "./objective";
import { clearAudits } from "./audit";
import { clearBoonLedger } from "./boon-ledger";
import { clearMaroons } from "./maroon";
import { clearReveals } from "./reveal";
import { closeVoyageTelemetry, dropVoyageTelemetry } from "./telemetry";
// [B4: the log surfaces] The room's own log, which is a product surface
// rather than a measurement and is therefore opened by every voyage the
// spine above may or may not be recording.
import { clearVoyageLog } from "./voyage-log";
import { guardInbound } from "./inbound-limit";
import { clearDocksWinner } from "./docks";
import { clearSurge } from "./surge";
import { wireRoomJoin } from "./wiring/room-join";
import { wireStatusHeartbeat } from "./wiring/status-heartbeat";
import { wirePhaseReady } from "./wiring/phase-ready";
import { wirePulse } from "./wiring/pulse";
import { wireLegReport } from "./wiring/leg-report";
import { wireObjective } from "./wiring/objective";
import { wireAudit } from "./wiring/audit";
import { wireMaroon } from "./wiring/maroon";
import { wireBoons } from "./wiring/boons";
import { wireDocks } from "./wiring/docks";
import { wireVentures } from "./wiring/ventures";
import { wireBarter } from "./wiring/barter";
import { wireEscortContracts } from "./wiring/escort-contracts";
import { wireRefits } from "./wiring/refits";
import { wireModuleTrades } from "./wiring/module-trades";
import { wireBazaar } from "./wiring/bazaar";
import { wirePathDraft } from "./wiring/path-draft";
import { wireVoyageLog } from "./wiring/voyage-log";
import { wireAid } from "./wiring/aid";
import { wirePlayerDetail } from "./wiring/player-detail";
import { wireChat } from "./wiring/chat";
import { wirePresence } from "./wiring/presence";
import { wireStartVoyage } from "./wiring/start-voyage";
import { wireRestartVoyage } from "./wiring/restart-voyage";
import { wireQuickStart } from "./wiring/quickstart";
import { wireOperator } from "./wiring/operator";
import { wireDisconnect } from "./wiring/disconnect";

// ========== Cross module room teardown ==========
// Called when a room is deleted after its last member departs. Tears
// down every per room structure so a future room (with a different id)
// doesn't inherit stale data from a room that no longer exists.
// Deliberately not through the individual clear* helpers that broadcast:
// the room row is already gone, the Loan rows went with it on cascade,
// and there is nobody left in the channel to broadcast an empty board to.
function clearRoomAllMaps(roomId: string): void {
  roomCheckpoints.delete(roomId);
  // [B2: hard timers, the server as timekeeper] The room's clock, which is
  // an in process timer for a room that no longer exists. It is disarmed
  // rather than dropped, because the deadline lives on the checkpoint this
  // function just deleted and a timer whose seat is gone has nothing left to
  // fire at.
  disarmPhaseClock(roomId);
  // And the watch on the last announcement this room ever made, which is a
  // timer for the same reason and outlives its room the same way. See
  // watchForReports in ./checkpoint: a fire here would find no checkpoint to
  // hand back and no members to hand it to, so it is stopped rather than
  // left to spend itself.
  clearAdvanceWatch(roomId);
  clearRoomStatuses(roomId);
  clearBarterSilent(roomId);
  escortContracts.clearSilent(roomId);
  refitContracts.clearSilent(roomId);
  // [F3: modules in the shipyard ladder, and trading them between
  // captains] And the module market's rows, silent for the reason the two
  // boards above are: the room row is already gone, so there is nobody
  // left in a channel to broadcast an empty board to.
  moduleTrades.clearSilent(roomId);
  // [D5: Aroma: the Bazaar Rumor] The bazaar's rows, which belong to the
  // voyage that ended with the room. Silent like the two boards above it,
  // because the room row is already gone and there is nobody left in the
  // channel to broadcast an empty board to.
  clearBazaarSilent(roomId);
  // [D7: the draft, and switching] And the path draft's two maps, silent for
  // the reason the boards above are: the room row is already gone, so there
  // is nobody standing in a draft to hand a null view to and nobody to tell
  // that a switch is forgotten.
  clearPathVoyageSilent(roomId);
  clearFlexibleAccepted(roomId);
  clearAidSilent(roomId);
  clearLoansSilent(roomId);
  clearPulseTallies(roomId);
  clearObjectiveTallies(roomId);
  clearAudits(roomId);
  clearBoonLedger(roomId);
  clearMaroons(roomId);
  clearReveals(roomId);
  clearDocksWinner(roomId);
  clearSurge(roomId);
  concludedRooms.delete(roomId);
  clearMutedUsers(roomId);
  clearSessionChat(roomId);
  // The detail questions waiting on captains in this harbor, which are
  // questions about a room that no longer exists.
  forgetDetailRequests(roomId);
  // [B4: the log surfaces] And the voyage's log, which belongs to the room
  // that held it. Dropped rather than written down, because a log is a
  // surface a table reads while it sails and there is no table left.
  clearVoyageLog(roomId);
  // [I1: the telemetry spine] And the voyage the spine was holding, which
  // is dropped and not written, because every caller that reaches this
  // function with a voyage still open has already written it. The reaper
  // writes an emptied record before it calls this, and the REST leave
  // writes one from tearDownIfRoomGone. What is left is the operator's
  // purge, where there is no measurement to take: the account is being
  // erased and the row written for it would name captains who no longer
  // exist.
  dropVoyageTelemetry(roomId);
}

// [D3: Convoy: the Escort Contract] [D4: Loom: the Refit] [F3: modules in
// the shipyard ladder, and trading them between captains] What a departure
// takes off the room's three consent boards, in one callback because a
// departure is one event rather than three.
//
// It lives here rather than in any board module because a board module
// knows one kind, and this is the only place that knows all three: the rule
// it applies is the factory's (see removeUser in ./consent, which is where
// the two conditions and the reason for each are written), and what is left
// for this function to say is which boards the room is holding.
function removeUserConsentBoards(
  io: Server,
  roomId: string,
  userId: string,
): void {
  escortContracts.removeUser(io, roomId, userId);
  refitContracts.removeUser(io, roomId, userId);
  moduleTrades.removeUser(io, roomId, userId);
}

// Builds the cleanup callbacks scheduleDeparture needs. Defined once
// per attachRealtime call so every scheduleDeparture invocation shares
// the same object.
function buildDepartureCleanup(): DepartureCleanup {
  return {
    removeUserBarterOffers,
    removeUserConsentBoards,
    removeUserAidRequest,
    emitRoomMembers,
    maybeConcludeVoyage,
    clearRoomAllMaps,
  };
}

// The REST leave and logout routes drop a room row from inside the
// Next.js bundle, which cannot reach the maps above: a route handler
// gets a different copy of this module (see the note on quickstart:join).
// A socket that then disconnects is repaired later by the departure
// grace timer, which is the other place clearRoomAllMaps is called from.
// A captain who leaves through the button and stays on the page is not:
// their socket never drops, so no timer is ever armed, and the room they
// just destroyed would leave its board and its conversation sitting in
// memory until the process restarted. The client's leave always sends
// room:leave straight after that route call, so this is where the check
// can be made.
//
// [I1: the telemetry spine] A room that is gone because its last seat was
// given up is a voyage that stopped, and this is the only place the last
// captain's own Leave can be noticed: the REST route that took the seat
// runs in a different copy of this module and cannot see the accumulator,
// and by the time the grace timer would have reaped them there is no seat
// left to take. So the record is written here, as emptied and with nobody
// present, before the maps are cleared underneath it.
async function tearDownIfRoomGone(roomId: string): Promise<void> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { id: true },
  });
  if (!room) {
    void closeVoyageTelemetry(roomId, "emptied", []);
    clearRoomAllMaps(roomId);
  }
}

export function attachRealtime(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    // The library default, kept explicit so it stays obvious that this
    // layer only ever answers on /socket.io and never on an app route.
    path: SOCKET_PATH,
    // No cors block on purpose. The client is served from this same
    // origin, so allowing other origins would only widen the surface
    // without buying anything.
    pingTimeout: 60000,
    pingInterval: 25000,
    // The app ships its own client and its own server together, so the
    // version check can never be a mismatch worth rejecting a captain for.
    allowEIO3: false,
  });

  const departureCleanup = buildDepartureCleanup();

  // ========== Connection handling ==========
  io.on("connection", (socket: Socket) => {
    rememberSocket(socket.id, {
      userId: "",
      user: { id: "", username: "", displayName: "", avatarHue: 0 },
      roomId: null,
      authed: false,
      mode: null,
    });

    // [J2: the mute and the report] The socket's own frame budget, put in
    // front of every handler below. It goes here, before the auto
    // authentication on the next line, so that not even the auth frame can
    // arrive uncounted: the middleware runs per incoming packet, and a
    // packet it does not pass on is a packet no handler sees.
    guardInbound(socket);

    // Auto authenticate from the handshake cookie (sent with credentials).
    // The attempt is kept rather than dropped for the hold below, and it is
    // caught here so a connection that never sends another frame cannot
    // leave the rejection of a failed lookup unhandled. A thrown attempt
    // reads as no answer at all: the frames the hold was waiting with are
    // released and refused by their own handlers, which is the same outcome
    // the throw produced before the hold existed.
    const authAttempt = authenticate(socket, io).catch(() => null);

    // Frames that arrive before this connection's own authentication has
    // been answered wait for it rather than run against it. A captain whose
    // tab reloads emits the frames its screens ask for the moment their
    // socket connects, which can beat the handshake lookup to the table,
    // and every one of those frames would then be refused by requireAuth
    // with "Authenticate first": a string the client cannot tell apart
    // from a refused credential, so its session lost path takes the whole
    // screen down for a reload that merely arrived early. The refusals
    // stay where they are (see requireAuth in ./auth) and the suites that
    // drive them with raw sockets keep meeting them; the hold is the
    // ordering rule the rest of this file already assumes, that nothing
    // but the auth frame itself is handled before the connection has an
    // identity. Measured on the isolated copy: with the hold out, a reload
    // after a save loses the race outright and the harbor falls back to
    // the sign in screen.
    socket.use(async ([event], next) => {
      if (event !== "auth") await authAttempt;
      next();
    });

    socket.on("auth", async (payload: { token?: string } | undefined) => {
      await authenticate(socket, io, payload?.token);
    });

    // The connection's frames, one concern to a file. Each module
    // registers its own handlers on this connection and is imported by
    // nothing but this file, so what follows is the shape of a
    // connection stated in one place rather than the body of every
    // frame as well.
    wireRoomJoin(io, socket, tearDownIfRoomGone);
    wireStatusHeartbeat(io, socket);
    wirePhaseReady(io, socket);
    wirePulse(socket);
    wireLegReport(socket);
    wireObjective(io, socket);
    wireAudit(io, socket);
    wireMaroon(io, socket);
    wireBoons(io, socket);
    wireDocks(io, socket);
    wireVentures(io, socket);
    wireBarter(io, socket);
    wireEscortContracts(io, socket);
    wireRefits(io, socket);
    wireModuleTrades(io, socket);
    wireBazaar(io, socket);
    wirePathDraft(io, socket);
    wireVoyageLog(socket);
    wireAid(io, socket);
    wirePlayerDetail(io, socket);
    wireChat(io, socket);
    wirePresence(socket);
    wireStartVoyage(io, socket);
    wireRestartVoyage(io, socket);
    wireQuickStart(io, socket);
    wireOperator(io, socket, departureCleanup);
    wireDisconnect(io, socket, departureCleanup);
  });

  // ========== Boot time setup ==========
  void hydrateLoans();
  void reconcileMembershipAfterBoot(io, departureCleanup).catch((err) => {
    console.error("[realtime] boot reconciliation failed", err);
  });

  return io;
}

// ========== Ordered shutdown ==========
// Called from server.ts on SIGINT and SIGTERM, before the HTTP server is
// closed. Every live socket is dropped first so no handler can run
// against a half torn down process, then the engine releases its
// timers. Resolves either way: a shutdown that is already partly done
// must not be allowed to stall the exit.
export function closeRealtime(io: Server): Promise<void> {
  return new Promise((resolve) => {
    try {
      io.disconnectSockets(true);
    } catch (err) {
      console.error("[realtime] error while dropping sockets", err);
    }
    try {
      io.close(() => resolve());
    } catch (err) {
      console.error("[realtime] error while closing the engine", err);
      resolve();
    }
  });
}
