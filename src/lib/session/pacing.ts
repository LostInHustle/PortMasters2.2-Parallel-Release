// =====================================================================
// PortMasters 2.2 Parallel Release: the cadence the live channels ride on.
//
// Three reports answer one change together (the status broadcast, the
// objective report, and the round report) and two heartbeats rebuild a
// harbor's cache after a restart (status and objective). The numbers and
// the one shot timer live here rather than in the status hook, so a
// module that only wants a number does not import React and a socket
// listener to get it.
// =====================================================================

// Enough to feel immediate, sparse enough that several changes in a row
// leave as one frame: a captain emptying a hold of six goods sends one
// report rather than six.
export const STATUS_BROADCAST_MS = 120;

// How often a client repeats what it already reported. The caches these
// rebuild are transient by design, so the clients are the record: one
// report every few seconds costs nothing and rebuilds a harbor's board
// from nothing after a restart.
export const HEARTBEAT_MS = 8000;

/**
 * One trailing report: a call inside an effect, with the effect's own
 * cleanup cancelling it, so only the last change in a burst reaches the
 * wire. Returns the destructor the effect hands back.
 */
export function trailingReport(ms: number, fire: () => void): () => void {
  const timer = setTimeout(fire, ms);
  return () => clearTimeout(timer);
}
