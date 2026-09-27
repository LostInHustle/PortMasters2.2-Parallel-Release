// =====================================================================
// PortMasters 2.2 Parallel Release: the survival edition's switches.
//
// [C4: three foods, spoilage and the split hold] The switch policy moved
// here out of ./larder when this epic's third and fourth families needed
// it. The policy itself is unchanged, down to the sentence: one reading
// function, one set of accepted values, one home. What changed is who
// reads it. When ./larder wrote it down, two switches read it, the layer
// itself and C2's loss rule. C3's wardrobe made three, C4's split hold
// makes four, and a policy that four families depend on belongs beside
// none of them rather than inside the first one that needed it.
//
// Pure: no state, no clock, no socket. The one thing this module touches
// is the process environment, and that is the whole of what it is for.
// =====================================================================

/**
 * The one place a survival switch is read, for every flag in this epic.
 *
 * The policy is written here once because four switches read it now (the
 * provisions layer in ./larder, C2's loss rule in ./crew, C3's wardrobe in
 * ./garments and C4's split hold in ./hold) and the cost of four copies is
 * a set that drifts: one flag accepting a value another refuses is a bug
 * that only shows the evening an operator tries it.
 *
 * Unset, empty and any value that is not the word off or the digit zero
 * all mean the switch is on, matched after trimming and lowering, so a
 * typo leaves the game playable rather than quietly deleting a system.
 *
 * The NEXT_PUBLIC_ prefix is not decoration, and the note is worth having
 * where the reading happens rather than only on each flag below: the rules
 * these switches gate run in the browser, where the engine runs, and a
 * value without that prefix is not present in a client bundle at all. The
 * cost of the prefix is real and it is stated where an operator will meet
 * it, in the rollback notes in docs/RELEASE_NOTES.md: the browser's copy
 * is fixed when the bundle is built, so rolling a layer back is a rebuild
 * and a restart rather than a restart alone.
 */
export function envFlagOn(name: string): boolean {
  const raw = (process.env[name] ?? "").trim().toLowerCase();
  return raw !== "off" && raw !== "0";
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
 * It is read through envFlagOn above, which carries the policy and the
 * price of the NEXT_PUBLIC_ prefix, and it is read live rather than
 * cached, which is the one place it differs from the clock's own scale
 * (see phaseBudgetSeconds in src/server/realtime/checkpoint.ts). That one
 * caches because it sits on a path that runs a zod parse a leg and its
 * value cannot move inside a process; this is read a handful of times a
 * leg, so a cache would buy nothing, and leaving it live is what lets the
 * suite hold both sides of every switch in a single run rather than one
 * process per value.
 */
export function survivalLayerOn(): boolean {
  return envFlagOn("NEXT_PUBLIC_SURVIVAL");
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
  return envFlagOn("NEXT_PUBLIC_SPLIT_HOLD");
}
