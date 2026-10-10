/**
 * The status convention check.
 *
 * Every state a captain can see says what it is, why it happened, and the
 * way back, and every one of those clauses is authored once, in
 * src/lib/game/status-copy.ts. The convention answers a run of defects of
 * one shape: the bench's frozen row had lost the remedy its engine lines
 * kept, the hunger sentence was written out on five surfaces and could
 * drift one surface at a time, and two statuses rendered in colour or in
 * a hover title alone, which a touch screen never shows.
 *
 * Two halves. The validator (in the module, run here against the shipped
 * registry) holds the clause half: three clauses on every family, every
 * declared clause present in the sentence that declares it, a way back on
 * every sentence, and at least one whole telling per family. The sweep
 * holds the one source half: each family's cause and remedy, the rule's
 * tail and the star's legend are guarded fragments, and a guarded
 * fragment spelled anywhere else in src is a second authoring of a
 * sentence that already has a home.
 *
 * What the sweep cannot catch, said out loud because a gate that reads as
 * stronger than it is is worse than none: a second authoring that keeps
 * no verbatim fragment (a close paraphrase reads clean here), a sentence
 * assembled from fragments at runtime rather than spelled at the surface,
 * and anything outside src, so the docs may quote a sentence and are left
 * alone on purpose. It strips comments before reading, so a note that
 * explains a repair may quote the sentence it repaired, and it reads case
 * insensitively, so the same sentence in lower case is still a finding.
 *
 * Run with npm run check:status. The build runs it too, beside the tag
 * and card checks, because a convention is only one if the build refuses
 * to ship without it.
 */

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  STATUS_FAMILIES,
  STATUS_SENTENCES,
  statusGuardedFragments,
  validateStatusCopy,
} from "@/lib/game/status-copy";
import { walkSrc } from "./walk-src";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const MODULE = join(SRC, "lib", "game", "status-copy.ts");

/* The three comment shapes stripped before the sweep reads a file, the
   same three the smoke harness's withoutComments strips. It is kept here
   rather than imported because this script runs inside the build, and the
   harness's import graph carries the socket client and the database:
   nothing about a string check should need either. */
function withoutComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

const findings: string[] = validateStatusCopy();

const files = walkSrc(SRC);
const guarded = statusGuardedFragments();
for (const file of files) {
  if (file === MODULE) continue;
  const code = withoutComments(readFileSync(file, "utf8")).toLowerCase();
  for (const fragment of guarded) {
    if (code.includes(fragment.toLowerCase())) {
      findings.push(
        `${relative(ROOT, file)} spells a guarded clause ("${fragment}"), which is authored in src/lib/game/status-copy.ts and must not have a second home.`,
      );
    }
  }
}

if (findings.length === 0) {
  const families = Object.keys(STATUS_FAMILIES).length;
  console.log(
    `The status conventions hold. ${families} families and ${STATUS_SENTENCES.length} sentences; every declared clause present in the sentence that declares it, a way back on every sentence, the guarded clauses in one place across ${files.length - 1} other source files.`,
  );
  process.exit(0);
}

console.log(
  `The status conventions do not hold. ${findings.length} finding${findings.length === 1 ? "" : "s"}:\n`,
);
for (const finding of findings) console.log(`  ${finding}`);
console.log(
  "\nA finding is either a fix or a sentence in the audit explaining why the surface is an exception.",
);
process.exit(1);
