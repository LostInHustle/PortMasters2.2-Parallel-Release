// Realtime layer: the roster a vote is counted against.
//
// Harbor members still in the voyage: membership minus anyone bankrupt or at
// the endgame screen. Based on durable membership rather than live sockets,
// so a slow-loading captain still counts. leftTheVoyage reads the phase, not
// seat marks, so a written-off Ocean Gambit seat keeps its place at the
// table.
//
// The helper lives here rather than in ./checkpoint because the checkpoint,
// the Manifest Audit and the maroon all read it, and checkpoint imports the
// maroon's clock while the maroon imports the count. Keeping the count in a
// module that imports none of them leaves the three in a line rather than a
// cycle.
import { roomMemberIds } from "@/lib/rooms";
import { leftTheVoyage } from "@/lib/seat-marks";
import { roomStatuses } from "./status";

export async function activeRosterSet(roomId: string): Promise<Set<string>> {
  const statuses = roomStatuses.get(roomId);
  const memberIds = await roomMemberIds(roomId);
  const out = new Set<string>();
  for (const id of memberIds) {
    if (!leftTheVoyage(statuses?.get(id))) out.add(id);
  }
  return out;
}
