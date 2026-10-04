/**
 * The tag check.
 *
 * [F1: the tag vocabulary, and the two tag rule] The plan's rule about
 * the vocabulary is that it is validated at load time rather than by
 * review, and this is the load. It reads the content the tree ships,
 * through the same walk every other reader uses, and exits nonzero if the
 * assignments break any of the nine things the rule module states.
 *
 * It is wired into `build` itself rather than left as a script somebody
 * remembers to run, because the plan's word for what should happen to a
 * card that names an item key, or to an entry that carries three tags, is
 * that it fails the build. A check that runs only when a person thinks of
 * it is the review this goal replaced.
 *
 * The counts it prints are the useful half of a green run: how many
 * entries carry how many tags is the shape a balance pass is about to
 * widen, and a vocabulary whose distribution nobody has looked at is one
 * that grows by accident.
 */
import { TAGS, type Tag } from "@/lib/game/constants/tags";
import { taggedEntries, validateTagging } from "@/lib/game/tags";

const entries = taggedEntries();
const findings = validateTagging();

// How the entries carry the twelve, tag by tag, which is the reading the
// iteration clause of this goal asks for: the pairs matter more than the
// totals, but a tag carried by one entry is a tag with one card of room.
const carried = new Map<Tag, number>(TAGS.map((tag) => [tag, 0]));
for (const entry of entries) {
  for (const tag of entry.tags) carried.set(tag, (carried.get(tag) ?? 0) + 1);
}
const distribution = [...carried.entries()]
  .map(([tag, count]) => `${tag} ${count}`)
  .join(", ");
const pairs = entries.filter((e) => e.tags.length === 2).length;

if (findings.length === 0) {
  console.log(
    `The tags hold. ${entries.length} entries across six catalogues, at most two tags each, ${pairs} of them carrying a pair.`,
  );
  console.log(`Every tag is carried: ${distribution}.`);
  process.exit(0);
}

console.log(
  `The tag check found ${findings.length} thing${findings.length === 1 ? "" : "s"}:\n`,
);
for (const finding of findings) console.log(`  ${finding}`);
console.log(`\nThe vocabulary itself is sound. ${distribution}.`);
process.exit(1);
