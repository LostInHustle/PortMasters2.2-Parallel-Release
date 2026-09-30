// =====================================================================
// PortMasters 2.2 Parallel Release: the room's log.
//
// [B4: the log surfaces] The room's log.
//
// The public half of the pair above, and the contrast is the point: the
// private channel is addressed to one captain and to nobody else, and a
// line below goes to every socket in the room. Nothing here may carry a
// hidden thing, which is why an entry's only field beyond its kind is the
// sentence the server wrote: whatever is printed in a line is public the
// moment it is sent, so there is no shape here for a secret to travel in.
//
// The text travels with the entry for the same reason the private entry's
// does. The server writes the line and the surface prints what it was
// sent rather than assembling the sentence out of fields on this side of
// the wire, so one line cannot read two ways on two screens.
// =====================================================================

import type { VoyageLogEntry } from "@/lib/game/voyage-log";

export type VoyageLogDelivery = {
  roomId: string;
  entry: VoyageLogEntry;
};

// The whole log, to the one socket that asked for it. The round rides
// along because the client groups the lines by leg, and the leg a voyage
// is standing in is the server's fact rather than something a client can
// work out from the lines it happens to be holding.
export type VoyageLogHistory = {
  roomId: string;
  round: number;
  entries: VoyageLogEntry[];
};
