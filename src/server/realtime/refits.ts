// =====================================================================
// Realtime layer: the Loom's refit board.
//
// [D4: Loom: the Refit] The board Loom captains sell repair work from at a
// port. The machinery that holds it is the consent factory both of this
// epic's markets are made of (see ./consent), and what is left here is the
// binding: the event the bench speaks on and the payload it speaks in.
//
// This kind adds nothing to the shared visibility filter, and that absence
// is a decision rather than an omission: a contract carries one field that
// only its seller may read (what a raid would have taken, which is the
// number the seller is billed for), and a refit has no such field. A row of
// this board is the same row for everyone who may see it at all, so it
// reads the shared filter directly instead of taking a pass over the result.
//
// The board is room state because an agreement between two captains is an
// object no single client can be the authority over, and what a customer's
// client does with their side of it is the only place their clothes change
// (see applyRefitSide in @/lib/game/engine/refits).
// =====================================================================
import { visibleConsent, type RefitContract } from "@/lib/game/engine";
import { consentBoard } from "./consent";

export const refitContracts = consentBoard<RefitContract>({
  event: "refit:update",
  visible: visibleConsent,
  pack: (roomId, refits) => ({ roomId, refits }),
});
