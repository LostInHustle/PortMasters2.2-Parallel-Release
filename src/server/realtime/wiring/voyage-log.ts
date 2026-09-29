// =====================================================================
// The voyage log's one frame: the request ../voyage-log answers.
// =====================================================================

import type { Socket } from "socket.io";

import { seated } from "../auth";
import { sendVoyageLogHistory } from "../voyage-log";

export function wireVoyageLog(socket: Socket): void {
  //
  // [B4: the log surfaces] The one request the log takes from a client.
  // A captain who arrives at Dusk asks for the voyage so far, and the
  // answer goes back to that socket rather than to the room: the room is
  // already holding its own copy, and a broadcast here would put the
  // whole log on every captain's screen once per request.
  //
  // It is asked for by the surface that draws it rather than sent on
  // arrival, which is why this is a request at all: the five state
  // requests a captain's own hooks make on mounting all cost a frame on
  // every room load, and a log nobody is looking at is not worth one.
  socket.on("voyage:log:request", (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    sendVoyageLogHistory(socket, roomId);
  });
}
