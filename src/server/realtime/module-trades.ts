// =====================================================================
// Realtime layer: the module market's board.
//
// [F3: modules in the shipyard ladder, and trading them between captains]
// The board a captain lists a bolted on module from at the Parley table.
// The machinery that holds it is the consent factory all three of this
// epic's markets are made of (see ./consent), and what is left here is the
// binding: the event the market speaks on and the payload it speaks in.
//
// This kind adds nothing to the shared visibility filter, for the reason
// the bench above it gives: a module trade carries no field that belongs to
// one side. Its term, the module, is a card id both captains read the same
// way, so a row of this board is the same row for everyone who may see it
// at all and the shared filter is read directly rather than taken a pass
// over.
//
// The board is room state because an agreement between two captains is an
// object no single client can be the authority over, and what each client
// does with their side of it is the only place their purse and their hull
// change (see applyModuleTradeSide in @/lib/game/engine/modules).
// =====================================================================
import { visibleConsent, type ModuleTrade } from "@/lib/game/engine";
import { consentBoard } from "./consent";

export const moduleTrades = consentBoard<ModuleTrade>({
  event: "module:update",
  visible: visibleConsent,
  pack: (roomId, moduleTrades) => ({ roomId, moduleTrades }),
});
