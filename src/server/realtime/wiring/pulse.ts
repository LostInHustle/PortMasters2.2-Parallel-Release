// =====================================================================
// The harbor pulse's one frame, reaching ../pulse.
// =====================================================================

import type { Socket } from "socket.io";

import { seated } from "../auth";
import { addPulseReport } from "../pulse";

export function wirePulse(socket: Socket): void {
  socket.on(
    "harbor:pulse:report",
    (payload: {
      roomId?: string;
      round?: number;
      tally?: Record<string, number>;
    }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      if (typeof payload?.round !== "number" || !payload.tally) return;
      addPulseReport(roomId, payload.round, payload.tally);
    },
  );
}
