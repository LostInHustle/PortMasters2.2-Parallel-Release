// =====================================================================
// Realtime layer: the escort contract board.
//
// [D3: Convoy: the Escort Contract] The board Convoy captains sell from
// during Parley. The machinery that holds it is the consent factory this
// epic's second market shares (see ./consent), and what is left here is the
// binding: the event the market speaks on, the payload it speaks in, and the
// one rule this kind adds to the shared visibility filter, which is that a
// claimed contract's raid figure belongs to its seller.
//
// The board is room state because an agreement between two captains is an
// object no single client can be the authority over, and both clients apply
// their own side of it to their own state (see applyEscortSide in
// @/lib/game/engine/contracts). Every reader and writer in the room's
// socket layer goes through this object: an escort board has no second door.
// =====================================================================
import { visibleContracts, type EscortContract } from "@/lib/game/engine";
import { consentBoard } from "./consent";

export const escortContracts = consentBoard<EscortContract>({
  event: "contract:update",
  visible: visibleContracts,
  pack: (roomId, contracts) => ({ roomId, contracts }),
});
