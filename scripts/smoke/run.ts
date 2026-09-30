// =====================================================================
// PortMasters 2.2 Parallel Release: what one smoke run carries.
//
// The sockets the run holds open, the accounts that belong to no harbor,
// the harbors the voyage walk opened, and the flag that arms cleanup. It
// is the handful of facts two articles of the run have to agree on rather
// than a place to put things: what an article measures travels as an
// argument and a return value, so a reader can see it in a signature.
// =====================================================================
import type { Socket } from "socket.io-client";

import type { Captain } from "./wire";

export type SmokeRun = {
  // Accounts this run creates that belong to no harbor, so there is
  // nothing to tear down for them but the accounts themselves. The
  // messages they send each other cascade away with them.
  extraAccounts: Captain[];
  // Harbors opened for the one walk that sails a voyage rather than
  // probing a route. They are this run's, so cleanup deletes them, and
  // they are listed here rather than derived from anything above because
  // that walk needs a room whose whole voyage it drives itself.
  lapRoomIds: string[];
  sockets: Socket[];
  // Only armed once the first account has been proven visible to this
  // process's database connection. Until then, nothing is deleted.
  cleanupIsSafe: boolean;
  // Every harbor that already exists before this run starts, so cleanup
  // only ever deletes one this run created.
  preExistingRoomIds: Set<string>;
};
