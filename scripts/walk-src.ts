/**
 * The walk over the source tree.
 *
 * Every source file under a directory, for a check whose claim is about
 * the tree rather than about a file. Read only, and only .ts and .tsx:
 * the claim every caller makes is about source.
 *
 * One implementation for every reader: the smoke harness (and through it
 * the suites), and the three build gates that sweep the tree, which are
 * the status check, the private scan, and the palette check. It lives
 * beside them all rather than inside the check that first needed it,
 * because a second feature needed one too and a second copy of a
 * directory walk is how two scans of the same tree end up reading
 * different files.
 *
 * The smoke oracle (scripts/smoke.ts) keeps a walk of its own, and that
 * is the one copy worth having: it runs on its own rather than importing
 * this folder's harness, which is what lets the oracle audit the tree
 * without standing on it.
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
