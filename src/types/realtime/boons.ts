// =====================================================================
// PortMasters 2.2 Parallel Release: public offers, the fleet's ledger.
//
// [F5: public offers] The plan's feature is one sentence: every offer is
// public, the whole fleet sees the three cards you were shown and the one
// you kept. These two frames are that sentence on the wire.
//
// A report is one captain's own claim, sent by the claim hook when their
// boon record changes (see src/lib/use-boon-ledger.ts). A ledger is the
// whole table's answer, broadcast to the room after every accepted report
// and handed to a joiner (see src/server/realtime/boon-ledger.ts). The two
// carry the same record shape, so neither side needs a translator.
//
// It is the one broadcast besides the audit that is keyed by captain, and
// it is safe for the same reason the tally is: there is nowhere in the
// record to put a hold, a purse or an alignment. It carries card ids out
// of the public boon catalogue, the leg the choice was made in, and which
// milestone the pick answered, and nothing else. The names the room reads
// are looked up client side off the roster the room already has, so no
// frame here names anybody.
// =====================================================================

import type { BoonRecord } from "@/lib/game/types";

/**
 * One captain's claim about their own last boon decision, sent to the
 * server. The record rides whole; the room id is the seat check every
 * claim carries (see seated in src/server/realtime/auth.ts). The server
 * rechecks every field against the public catalogue before believing any
 * of it (see readBoonReport in src/server/realtime/wiring/boons.ts).
 */
export type BoonReport = BoonRecord & {
  roomId: string;
};

/**
 * The fleet's ledger as the room reads it: every captain's last recorded
 * decision, keyed by user id.
 *
 * Replaced rather than merged, like the audit's tally: the server sends
 * the whole map every time and the whole map is the truth, so a report
 * that was refused server side simply never appears. A captain with no
 * entry has not kept a boon since the voyage began, which is a state the
 * panels draw as absence rather than as a placeholder.
 */
export type BoonLedger = {
  roomId: string;
  entries: Record<string, BoonRecord>;
};
