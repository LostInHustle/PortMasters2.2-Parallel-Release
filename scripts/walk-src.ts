/**
 * The walk over the source tree.
 *
 * Every source file under a directory, for a check whose claim is about
 * the tree rather than about a file. Read only, and only .ts and .tsx:
 * the claim every caller makes is about source.
 *
 * The comment stripper lives here as well, for the same reason the walk
 * does: a check that reads the code of a file rather than the words
 * around it needs the same three shapes taken out whichever tree it is
 * walking, and a second set of shapes is a second answer to what a file
 * says.
 *
 * One implementation for every reader: the smoke harness (and through it
 * the suites), and the status check, which is the gate that reads the
 * code of a file rather than the words around it. The other two gates
 * that sweep the tree, the private scan and the palette check, walk it
 * but read whole files, so they have no use for the stripper. It lives
 * beside the walk rather than inside the check that first needed it,
 * because a second feature needed one too and a second copy of a
 * directory walk is how two scans of the same tree end up reading
 * different files.
 *
 * Nothing here reaches for the socket client or the database, so a gate
 * that runs inside the build can read the tree without either.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export function walkSrc(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkSrc(full));
      continue;
    }
    if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * A component's source with its comments taken out, for a check about what
 * a screen prints rather than about what its file says.
 *
 * The two are different on purpose in this tree: a comment here quotes the
 * sentence it replaced, because that is what makes a repair readable a year
 * later, so a check that read the raw file would fail on the note that
 * explains the fix. Only the shapes this tree actually writes are stripped,
 * which makes this the codebase's own convention rather than a parser: a
 * JSX comment, a block comment, and a line whose first characters are two
 * slashes. A URL inside a string survives all three, since none of them
 * matches a line that begins with anything else.
 */
export function withoutComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}
