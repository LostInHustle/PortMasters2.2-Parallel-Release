// =====================================================================
// PortMasters 2.2 Parallel Release: the epic's switches.
//
// [C4: three foods, spoilage and the split hold] The switch policy moved
// here out of ./larder when this epic's third and fourth families needed
// it. The policy itself is unchanged, down to the sentence: one reading
// function, one set of accepted values, one home. What changed is who
// reads it. When ./larder wrote it down, two switches read it, the layer
// itself and C2's loss rule. C3's wardrobe made three, C4's split hold
// made four, D2's path orders made five, D3's escort contracts make six,
// and a policy that six families depend on belongs beside none of them
// rather than inside the first one that needed it.
//
// Pure: no state, no clock, no socket. The one thing this module touches
// is the process environment, and that is the whole of what it is for.
// =====================================================================

/**
 * The one place a survival switch is judged, for every flag in this epic.
 *
 * The policy is written here once because six switches read it now. Four
 * are judged in this file, the provisions layer, C4's split hold, D2's path
 * orders and D3's escort contracts, and two read it from their own module,
 * C2's loss rule in ./crew and C3's wardrobe in ./garments. The cost of six
 * copies is a set that drifts: one flag accepting a value another refuses
 * is a bug that only shows the evening an operator tries it.
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
export function flagOn(raw: string | undefined): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  return value !== "off" && value !== "0";
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
export function survivalLayerOn(): boolean {
  return flagOn(process.env.NEXT_PUBLIC_SURVIVAL);
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
export function splitHoldOn(): boolean {
  return flagOn(process.env.NEXT_PUBLIC_SPLIT_HOLD);
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
export function pathOrdersOn(): boolean {
  return flagOn(process.env.NEXT_PUBLIC_PATH_ORDERS);
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
export function escortContractsOn(): boolean {
  return flagOn(process.env.NEXT_PUBLIC_ESCORT_CONTRACTS);
}
