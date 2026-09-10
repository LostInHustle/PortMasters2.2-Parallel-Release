// =====================================================================
// Realtime layer: Tidewatch Alerts.
//
// [MANIFEST 03] Never a difficulty dial: voyage length, tier content,
// and card count baseline all stay entirely the host's choice. This
// only reads Reputation every captain is already reporting through the
// ordinary game:status heartbeat and, once the room's combined total
// clears TIDEWATCH_SURGE_THRESHOLD, flips a one direction, one time
// flag for the room. roomSurges tracks which rooms have already
// triggered this voyage, so a status report arriving after the flip is
// a harmless no op, not a repeat trigger.
// =====================================================================
import { TIDEWATCH_SURGE_THRESHOLD } from "@/lib/game/constants";
import { roomStatuses } from "./status";

const roomSurges = new Set<string>();

export function combinedReputation(roomId: string): number {
  const statuses = roomStatuses.get(roomId);
  if (!statuses) return 0;
  let total = 0;
  for (const st of statuses.values()) total += st.reputation ?? 0;
  return total;
}

export function hasSurged(roomId: string): boolean {
  return roomSurges.has(roomId);
}

export function markSurged(roomId: string): void {
  roomSurges.add(roomId);
}

export function clearSurge(roomId: string): void {
  roomSurges.delete(roomId);
}

export { TIDEWATCH_SURGE_THRESHOLD };
