/**
 * The dead surface check.
 *
 * Two claims about the tree, both of them the same claim: a thing that
 * nothing reads is a thing the tree pays for and gets nothing back. The
 * first is an exported name that no other file in the tree reads. The
 * second is a module under src/ that no other file in the tree imports.
 *
 * The tree has been swept for both by hand, several times, and the hand
 * sweep is what let ten dead exports survive it: the first pass at this
 * check matched a name only inside an import clause, so an inline type
 * import (`import { type X }`) read as an unused name, and a name that
 * only ever travels through a barrel read as unused as well. The scan
 * that found the ten answered the question the house rule actually asks,
 * which is not "is this name written inside an import clause" but "is
 * this name read anywhere outside the file that declares it", and that
 * question is what this check now asks on every run.
 *
 * What the check cannot catch, said out loud because a gate that reads as
 * stronger than it is worse than none: a name read only by a file that is
 * itself dead, since the orphan half runs on the same tree rather than
 * after it; a module reached only through a dynamic import, of which the
 * tree has two, both in server.ts and both written out in full; and a
 * page under src/app that no link in the tree points at, which the router
 * can still serve and which is a question about navigation rather than
 * about dead code.
 *
 * The App Router's own entries are exempt from the orphan half, because
 * the router loads them by their name rather than by an import, and the
 * names it loads them by are listed here rather than guessed at. The
 * exports the framework requires by their own names are exempt from the
 * export half, and only under src/app, because outside it they would be
 * ordinary dead exports.
 *
 * Run with npm run check:dead. Read only, and it reaches for neither the
 * socket client nor the database, so a gate that runs inside the build
 * can read the tree without either.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { walkSrc } from "./walk-src";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const APP = join(SRC, "app");

const sourceFiles = [
  ...walkSrc(SRC),
  ...walkSrc(join(ROOT, "scripts")),
  join(ROOT, "server.ts"),
];

const bodies = new Map<string, string>();
for (const file of sourceFiles) bodies.set(file, readFileSync(file, "utf8"));

/**
 * The names the App Router reads for itself, and the files it loads by
 * their name rather than by an import.
 *
 * Both lists are the framework's own vocabulary, and both are stated here
 * rather than inferred, so a file that is exempt is exempt because the
 * router asked for it and not because the scan could not see it.
 */
const ROUTER_EXPORTS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "generateMetadata",
  "generateStaticParams",
  "viewport",
  "metadata",
  "contentType",
  "alt",
  "size",
  "dynamic",
  "revalidate",
  "runtime",
  "preferredRegion",
  "default",
]);

const ROUTER_ENTRIES = new Set([
  "page.tsx",
  "layout.tsx",
  "route.ts",
  "loading.tsx",
  "error.tsx",
  "global-error.tsx",
  "not-found.tsx",
  "template.tsx",
  "default.tsx",
  "icon.tsx",
  "apple-icon.tsx",
  "opengraph-image.tsx",
  "twitter-image.tsx",
  "sitemap.ts",
  "robots.ts",
  "manifest.ts",
  "instrumentation.ts",
  "forbidden.tsx",
  "unauthorized.tsx",
]);

const findings: string[] = [];

// The export half.

const DECL =
  /export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|interface|type|enum|abstract class)\s+([A-Za-z_$][\w$]*)/g;
const LIST = /export\s*(?:type\s*)?\{([^}]*)\}/g;

for (const file of sourceFiles) {
  const body = bodies.get(file) as string;
  const underApp = file.startsWith(APP);
  const names = new Set<string>();
  for (const match of body.matchAll(DECL)) names.add(match[1]);
  for (const match of body.matchAll(LIST)) {
    for (const piece of match[1].split(",")) {
      const name = piece
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  for (const name of names) {
    if (underApp && ROUTER_EXPORTS.has(name)) continue;
    const pattern = new RegExp(`\\b${name}\\b`, "g");
    let reads = 0;
    for (const [other, otherBody] of bodies) {
      if (other === file) continue;
      for (const _ of otherBody.matchAll(pattern)) reads += 1;
    }
    if (reads === 0) {
      findings.push(
        `${relative(ROOT, file)} exports "${name}", and nothing in the tree reads it.`,
      );
    }
  }
}

// The orphan half.

/** Every module specifier the tree writes, paired with the file it names. */
const SPECIFIER = /(?:from|import|require)\s*\(?\s*["']([^"']+)["']/g;

const candidates = (base: string): string[] => [
  `${base}.ts`,
  `${base}.tsx`,
  join(base, "index.ts"),
  join(base, "index.tsx"),
];

// A specifier that carries its own extension names the file it means, and
// the candidates below would look for a second one.
const stripExtension = (base: string): string =>
  base.replace(/\.(ts|tsx|js|mjs|jsx)$/, "");

const imported = new Set<string>();

for (const [file, body] of bodies) {
  for (const match of body.matchAll(SPECIFIER)) {
    const specifier = match[1];
    let base: string | null = null;
    if (specifier.startsWith("@/")) {
      base = join(SRC, specifier.slice(2));
    } else if (specifier.startsWith(".") || specifier.startsWith("/")) {
      base = resolve(dirname(file), specifier);
    } else {
      // A bare specifier is a package, and the tree's own modules are
      // not reached by one.
      continue;
    }
    for (const candidate of candidates(stripExtension(base))) {
      if (existsSync(candidate) && bodies.has(candidate)) {
        imported.add(candidate);
        break;
      }
    }
  }
}

for (const file of walkSrc(SRC)) {
  if (imported.has(file)) continue;
  const rel = relative(ROOT, file);
  if (
    ROUTER_ENTRIES.has(rel.split("/").pop() as string) &&
    file.startsWith(APP)
  ) {
    continue;
  }
  findings.push(`${rel} is a module nothing imports.`);
}

// The verdict.

if (findings.length === 0) {
  console.log(
    `The surface is alive. ${sourceFiles.length} files read, no export without a reader and no module without an importer.`,
  );
  process.exit(0);
}

console.log(
  `The surface is not alive. ${findings.length} finding${findings.length === 1 ? "" : "s"}:\n`,
);
for (const finding of findings) console.log(`  ${finding}`);
console.log(
  "\nA finding is either a removal or a sentence in the audit explaining why the surface is an exception.",
);
process.exit(1);
