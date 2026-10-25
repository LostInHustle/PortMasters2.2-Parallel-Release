/**
 * The tag check.
 *
 * The vocabulary's rule is that it is validated at load time rather than
 * by review, and this is the load. It reads the content the tree ships,
 * through the same walk every other reader uses, and exits nonzero if the
 * assignments break any of the nine things the rule module states.
 *
 * It is wired into `build` itself rather than left as a script somebody
 * remembers to run, because a card that names an item key, or an entry
 * that carries three tags, must fail the build. A check that runs only
 * when a person thinks of it is the review this check replaced.
 *
 * The counts it prints are the useful half of a green run: how many
 * entries carry how many tags is the shape a balance pass is about to
 * widen, and a vocabulary whose distribution nobody has looked at is one
 * that grows by accident.
 */
import { MAX_TAGS_PER_ENTRY, TAGS, type Tag } from "@/lib/game/constants/tags";
import { TAGGED_KINDS, taggedEntries, validateTagging } from "@/lib/game/tags";

const entries = taggedEntries();
const findings = validateTagging();

// How the entries carry the twelve, tag by tag: the pairs matter more than
// the totals, but a tag carried by one entry is a tag with one card of
// harbor.
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
    `The tags hold. ${entries.length} entries across ${TAGGED_KINDS.length} catalogues, at most ${MAX_TAGS_PER_ENTRY} tags each, ${pairs} of them carrying a pair.`,
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
