// =====================================================================
// PortMasters 2.2 Parallel Release: the epic's switches.
//
// [C4: three foods, spoilage and the split hold] The switch policy moved
// here out of ./larder when this epic's third and fourth families needed
// it. The policy itself is unchanged, down to the sentence: one reading
// function, one set of accepted values, one home. What changed is who
// reads it. When ./larder wrote it down, two switches read it, the layer
// itself and C2's loss rule. C3's wardrobe made three, C4's split hold
// made four, D2's path orders made five, D3's escort contracts made six,
// D4's refit made seven, D5's bazaar rumor made eight, D7's draft makes
// nine, F3's module trades make ten, F4's milestone boons make eleven and
// F6's charters make twelve, and a policy that twelve families depend on
// belongs beside none of them rather than inside the first one that
// needed it.
//
// [The mode boundary] Every switch here answers with two readings, and the
// order they are taken in is the rule: the mode first, the environment
// second.
//
// The systems this epic built are Ocean Gambit's, and Classic is the
// shipped release kept exactly as it was. That is a boundary rather than a
// default, so it is not the operator's to move: a deployment that exported
// NEXT_PUBLIC_BAZAAR=1 into a process serving both modes must not hand the
// bazaar to a Classic table, and the mode read is what stops it. The
// environment value is the switch the plan promises for each family, and it
// is read inside that boundary rather than beside it, so a switch can only
// ever take a system away from the mode it belongs to and never hand it to
// the one it does not.
//
// The mode read is folded in here rather than left at each call site for
// the reason the flag policy itself is here: thirty odd call sites writing
// two conditions is thirty odd chances to write them in the wrong order,
// and the order is the whole of the rule.
//
// Pure: no state, no clock, no socket. It touches the process environment
// and the mode record, and both of those are fixed for the life of the
// process: the environment because it is read from, and the record because
// it is a constant table rather than anything a voyage can move.
// =====================================================================

import { modeConfig } from "./mode";

/**
 * The one place a survival switch is judged, for every flag in this epic.
 *
 * The policy is written here once because twelve switches read it now.
 * Nine are judged in this file, the provisions layer, C4's split hold,
 * D2's path orders, D3's escort contracts, D5's bazaar rumor, D7's draft,
 * F3's module trades, F4's milestone boons and F6's charters, and three
 * read it from their own module, C2's loss rule in ./crew, C3's wardrobe
 * in ./garments and D4's bench in ./engine/refits.
 * The cost of a copy apiece is a set that drifts: one flag accepting a
 * value another refuses is a bug that only shows the evening an operator
 * tries it.
 *
 * Unset, empty and any value that is not the word off or the digit zero
 * all mean the switch is on, matched after trimming and lowering, so a
 * typo leaves the game playable rather than quietly deleting a system.
 *
 * The value is passed in rather than the name, and that is the browser's
 * doing rather than a taste in signatures. The rules these switches gate
 * run where the engine runs, which is the browser, and a browser has no
 * environment to read: it is handed the values its bundle was built with,
 * and it is handed them by a substitution that only matches a read written
 * out in full at the place the read happens. A policy function that took a
 * name and looked it up would compile to a lookup on an empty object,
 * which reads as unset, which means on: every switch would answer yes in
 * every build, and the rollback notes in docs/RELEASE_NOTES.md would be
 * describing a mechanism that never engaged. Measured on the isolated copy
 * rather than reasoned about, which is how it was found. So the name
 * belongs at the call site and the policy belongs here, and the one rule
 * to remember when the next switch lands is that its read has to be written
 * out the same way: the name at the read, the judgement here.
 */
function flagOn(raw: string | undefined): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  return value !== "off" && value !== "0";
}

/**
 * A switch's whole answer: the mode it belongs to, and the operator's
 * rollback inside it.
 *
 * Every switch below is this function with its own environment read at the
 * call site, which keeps the browser's rule about how a read has to be
 * written (see flagOn above) while giving the two conditions one spelling.
 * The mode is taken as unknown for the reason normalizeMode takes it that
 * way: a room row written before modes existed, a stale save and a
 * malformed request all land on the founding mode, and the founding mode
 * carries none of these systems.
 */
export function flagOnFor(mode: unknown, raw: string | undefined): boolean {
  return modeConfig(mode).gambitSystems && flagOn(raw);
}

/**
 * Whether the provisions layer is running at all.
 *
 * The plan's rollback is one flag, and this is it. With the switch off a
 * captain eats nothing, nothing is slower and nothing is drawn, which is
 * the base game exactly: no rules run, no numbers are read and no field
 * changes, so nothing about a voyage is stored differently either way. It
 * is also the switch the whole family stands behind, C4's hold included:
 * the capacity model is a rule about provisions, and a table that carries
 * no provisions has no provisions to make room for.
 *
 * It is read through flagOn above, which carries the policy and the
 * browser's own rule about how a read has to be written, and it is read
 * live rather than cached, which is the one place it differs from the
 * clock's own scale (see phaseBudgetSeconds in
 * src/server/realtime/checkpoint.ts). That one caches because it sits on a
 * path that runs a zod parse a leg and its value cannot move inside a
 * process; this is read a handful of times a leg, so a cache would buy
 * nothing, and leaving it live is what lets the suite hold both sides of
 * every switch in a single run rather than one process per value.
 */
export function survivalLayerOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_SURVIVAL);
}

/**
 * Whether the hold has capacities, and whether they are split.
 *
 * C4's own rollback, and the plan asks for it by name: "the split ships
 * separately behind its own flag". With the switch off the hold is the
 * hold this game has always had, one unbounded pool for goods and the
 * Larder's own sixty meal ceiling for food, and with it on the hold is
 * two capacities, Cargo for the trade and Stores for the larder, whose
 * sizes live in ./constants and whose arithmetic lives in ./hold.
 *
 * It is a rollback inside the survival edition rather than a switch on
 * the base game: ./hold reads it together with survivalLayerOn above, so
 * a table with the provisions layer off plays the base game exactly, no
 * capacity read anywhere, whatever this one says.
 */
export function splitHoldOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_SPLIT_HOLD);
}

/**
 * Whether the manifest posts the paths' own orders.
 *
 * D2's own rollback, and the plan asks for it by name: "Flag off and the
 * three pathbound slots disappear, leaving the existing six." With the
 * switch off the board is the board this game has always had, because the
 * switch is read at both ends of the feature: the draw adds no slots (see
 * startOrders in ./engine/orders) and the lock rule answers that no card is
 * anyone's locked order (see pathOrderOf there), so a board dealt while the
 * switch was on plays as six ordinary orders rather than as a table where
 * three cards are grey forever. Nothing about a voyage is stored
 * differently either way: a marked card is a marked card, and this is what
 * decides whether the mark means anything.
 */
export function pathOrdersOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_PATH_ORDERS);
}

/**
 * Whether the Convoy sells protection on the Parley board.
 *
 * D3's own rollback, and the plan's clause is "contracts are transient room
 * state rather than durable, so this rolls back cleanly". With the switch
 * off no contract can be posted (the server refuses one, see the contract
 * handlers in src/server/realtime/index.ts), no board is drawn, and the
 * engine reads no cover at the raid roll (see escortCoverOf in
 * ./engine/contracts), so a voyage plays exactly the raid it played before
 * this feature existed. A contract already agreed when the switch goes off
 * loses its cover the same way a rolled back path order loses its lock: the
 * room's board is not drawn from and the engine's cover answers null, so
 * the buyer sails on their own luck and no claim can be raised.
 */
export function escortContractsOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_ESCORT_CONTRACTS);
}

/**
 * Whether an Aroma captain may publish a rumor about a price.
 *
 * D5's own rollback, and the plan's clause is "Rumor publication is one
 * action on a cooldown, so it reverts by disabling the action. The band
 * shift itself is a settlement step, so make sure it is skipped cleanly
 * rather than left half applied." The two halves of that sentence are the
 * two halves of this switch, and each is read where the thing it disables
 * would happen.
 *
 * With the switch off no rumor can be published: the server refuses one
 * (see the bazaar handlers in src/server/realtime/index.ts) and the desk is
 * not drawn at the Parley. And no band shift is applied, because the two
 * ends of the settlement read the same switch: the server sends no lean on
 * the advance that opens a market, and the engine folds none in when it
 * prices one (see startMarket in ./engine/market). That is what "skipped
 * cleanly rather than left half applied" costs, and it is the same pair of
 * reads the path orders already make.
 *
 * It is judged here rather than in ./engine/bazaar for the reason the
 * trailing note below gives about D4's bench read the other way around:
 * this feature stands on no other layer. A rumor is a rule about prices,
 * and prices are in the base game, so nothing has to be true of another
 * system before this one can answer.
 *
 * The plan's own words for this slice were that it "ships in the base mode,
 * not only in Ocean Gambit, and that is a deliberate call rather than an
 * oversight", and the call was reversed after the mode boundary was drawn:
 * a rumor is a system this branch added, and Classic is the shipped release
 * with nothing added to it, so the desk is Gambit's and the plan's sentence
 * is superseded rather than quietly outvoted. A rumor needs the mode read
 * like every other switch here, and the environment value is the rollback
 * inside it.
 */
export function bazaarRumorsOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_BAZAAR);
}

/**
 * Whether the fleet drafts its paths.
 *
 * D7's own rollback, and the plan's clause is "draft state transient; keep
 * previous assignment method behind the same flag". The previous method is
 * the one this game has always had, which is no method at all: every
 * captain is pathless, and has been for the whole life of the pathbound
 * orders, because nothing before this feature ever wrote state.path. So
 * with the switch off the deal is not made (see the deal on room:start in
 * src/server/realtime/index.ts), no card reaches a captain, and the fleet
 * sails the pathless voyage the D2 lock was written to be true about: a
 * pathless captain is locked out of every pathbound card, which is a
 * refusal the lock already answers without a single new rule.
 *
 * One switch covers the switch as well, and it is not an economy: a
 * captain changes the path they hold, and the only way to hold one is this
 * deal, so with the draft off the change has no precondition to meet and
 * pathSwitchBlocked says as much in its first sentence. There is no second
 * flag to write because there is no second state to roll back to.
 *
 * It is judged here rather than in ./draft because the rule module holds
 * no switch: ./engine/draft reads ./draft, and a switch read from there
 * would put the environment in a module whose whole point is that it is
 * pure. The read is written out in full at each call site, per the rule
 * flagOn's own comment states, and it has three: the deal on room:start,
 * the room's switch handler, and the panel that offers the voyage's one
 * change of papers.
 */
export function pathDraftOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_PATH_DRAFT);
}

/**
 * Whether a module may change hands between captains.
 *
 * [F3: modules in the shipyard ladder, and trading them between captains]
 * F3's own rollback, and the plan's clause is "Modules are durable, so the
 * rollback concern is data: keep the table and disable equipping, rather
 * than dropping the table and losing equipped modules." The table this
 * switch keeps is the hull's own: what a captain has bolted on lives in
 * their save beside their hold and their purse, nothing this feature added
 * writes to it, and turning the switch off takes the trade and leaves every
 * equipped module exactly where it was, which is the plan's sentence read
 * as a rule rather than as a hope.
 *
 * With the switch off no module can be listed (the server refuses one, see
 * the module handlers in src/server/realtime/wiring/module-trades.ts), no
 * board is drawn, and a row already agreed settles nothing on either side:
 * the seller keeps their module, the buyer keeps their Gold, and the module
 * that would have left a hull stays bolted to it. That is the same shape
 * the escort and the refit roll back in, and it is why the read sits at the
 * top of applyModuleTradeSide rather than at the panel alone.
 *
 * It is judged here rather than in ./engine/modules because the trade
 * stands on no other layer: a module is base game, the hull that carries
 * one has existed since the first shipyard, and nothing has to be true of
 * another system before this one can answer. That is the escort's reading
 * and not the refit's, and the difference is the point of keeping the
 * family's switches in one place: a reader can see, at one screen, which
 * features carry a dependency and which stand alone.
 */
export function moduleTradesOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_MODULE_TRADES);
}

/**
 * Whether a voyage deals boons at milestone moments.
 *
 * [F4: boons at milestone moments] F4's own rollback, and the plan's
 * clause is "boons are additive and rare, so a content revert is clean.
 * Any boon that grants a durable effect has to be unwound through the
 * same normalization path the rest of the state uses." The two halves of
 * that sentence are the two places this switch is read. With the switch
 * off no moment is armed (see queueMilestoneMoment in
 * ./engine/milestones), a moment left waiting in a save written while
 * the switch was on is simply not shown (see milestonePending in
 * ./milestones), and the boons already held keep their effects for the
 * voyage, which is the data half of the plan's sentence read the way F3
 * reads its own off state: nothing is unwritten and nothing is half
 * applied, and the load path's healing is the unwinding road (see
 * normalizeHeldBoons, which drops a retired or unknown card the same way
 * every other saved field heals).
 *
 * The trigger sources it leans on are read where the triggers are rather
 * than here: a moment whose source system is off never becomes due (the
 * loss rule never writes a loss, the wardrobe's own switch answers no
 * cold, and the pathbound site asks the lock's reader, which holds D2's
 * switch at its end), so the layered reading ./garments gives its own
 * switch arrives here for free rather than as a second list.
 *
 * It is judged here rather than in ./milestones for the reason the
 * eleven above it are judged here: it is a switch like them, and a
 * reader looking for one should not have to know which feature made it
 * a special case. (D4's bench is the exception that proves the rule, and
 * its trailing note below says why: it asks another layer's switch
 * before it answers, which is a cycle this module cannot hold.)
 */
export function milestoneBoonsOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_MILESTONE_BOONS);
}

/**
 * Whether a voyage offers a charter at leg four.
 *
 * [F6: charters at leg four] F6's own rollback, and the plan's clause is
 * "A charter is a modifier set on the captain for the voyage, so it
 * reverts with the pool." The two halves of that sentence are the two
 * places this switch is read, the same pair F4's reads. With the switch
 * off no charter is offered (see charterPending in ./charters), a
 * charter left waiting in a save written while the switch was on is
 * simply not shown, and the charter already held keeps its flags for the
 * voyage: nothing is unwritten and nothing is half applied, and the load
 * path's healing is the unwinding road (see normalizeCharter in
 * ./held-cards, which drops a retired or unknown card the same way every
 * other saved field heals).
 *
 * It is judged here rather than in ./charters for the reason the eleven
 * above it are judged here: it is a switch like them, and a reader
 * looking for one should not have to know which feature made it a
 * special case.
 */
export function chartersOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_CHARTERS);
}

/* D4's own switch is not judged here, and the reason is the cycle rather
   than a preference: ./engine/refits asks whether the wardrobe is on before
   it answers, and ./garments asks ./flags whether it is on, so a reader of
   the garment layer cannot live in this module. It is in ./engine/refits
   with the rest of the bench. */
