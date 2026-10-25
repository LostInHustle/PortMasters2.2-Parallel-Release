/**
 * The card content check.
 *
 * Every card shares one record shape, and the scan for item keys that
 * belongs with it has its home in the content validator: this is that
 * validator. It reads the pool the tree ships, through the record's own
 * walk, and exits nonzero if any card breaks a clause.
 *
 * It is wired into `build` itself rather than left as a script somebody
 * remembers to run, for the same reason as the tag check above it: a card
 * that names a good, or carries no second language, fails the build.
 *
 * The counts it prints are the useful half of a green run: how the power sits
 * against each mode's ceiling, and how many cards each mode runs, is the
 * reading the mode field exists to move, and a pool whose shape nobody has
 * looked at is one that widens by accident.
 */
import { modePoolShape, shippedCards, validateCards } from "@/lib/game/cards";
import { CARD_KINDS, MODE_POWER_CEILING } from "@/lib/game/constants/cards";
import type { GameMode } from "@/lib/game/mode";

const subject = shippedCards();
const findings = validateCards(subject);

// How many cards each mode runs, and how much power the widest of them
// carries. Read off the same records the validator reads rather than off a
// second count kept here.
const pools = modePoolShape();
const modes = Object.keys(MODE_POWER_CEILING) as GameMode[];
const shape = modes
  .map((mode) => {
    const pool = pools[mode];
    return `${mode} ${pool.count} cards (widest power ${pool.widest}, ceiling ${MODE_POWER_CEILING[mode]})`;
  })
  .join(", ");
const kinds = CARD_KINDS.map(
  (kind) => `${kind} ${subject.cards.filter((c) => c.kind === kind).length}`,
).join(", ");

if (findings.length === 0) {
  console.log(
    `The cards hold. ${subject.cards.length} records (${kinds}), one shape, two languages each.`,
  );
  console.log(`The modes run: ${shape}.`);
  process.exit(0);
}

console.log(
  `The card check found ${findings.length} thing${findings.length === 1 ? "" : "s"}:\n`,
);
for (const finding of findings) console.log(`  ${finding}`);
console.log(
  `\nThe pool: ${subject.cards.length} records. The modes run: ${shape}.`,
);
process.exit(1);
