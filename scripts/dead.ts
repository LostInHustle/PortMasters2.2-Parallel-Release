/**
 * The dead surface check.
 *
 * Two claims about the tree, both of them the same claim: a thing that
 * nothing reads is a thing the tree pays for and gets nothing back. The
 * first is an exported name that no other file in the tree reads. The
 * second is a source file or asset under src/, scripts/ or cloudflare/ that
 * is neither imported nor named as a package or framework entry point.
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
 * What the check cannot catch: an export read only by a file that is itself
 * dead, since the export half reads the whole tree before the orphan half
 * reports it; or a page under src/app that no link in the tree points at,
 * which the router can still serve and which is a question about
 * navigation rather than dead code.
 *
 * The smoke battery under scripts/smoke counts as readers on purpose. An
 * export the suites drive is exercised on every run, and deleting it would
 * delete the only evidence that the behavior it gates still works, so the
 * claim this gate makes is that nothing anywhere reads the name, not that
 * nothing outside a test does. An export reached only by a suite is a
 * question to raise in review, not a fact this check can settle.
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
import ts from "typescript";
import { walkFiles, walkSrc } from "./walk-src";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const APP = join(SRC, "app");
const WORKER = join(ROOT, "cloudflare/worker.ts");

const sourceFiles = [
  ...walkSrc(SRC),
  ...walkSrc(join(ROOT, "scripts")),
  ...walkSrc(join(ROOT, "cloudflare")),
  join(ROOT, "server.ts"),
];
const STATIC_FILE = /\.(?:css|json|svg)$/;
const staticFiles = [
  ...walkFiles(SRC, { match: (_file, name) => STATIC_FILE.test(name) }),
  join(ROOT, "public/robots.txt"),
];
const surfaceFiles = [...sourceFiles, ...staticFiles];
const surface = new Set(surfaceFiles);
const packageJson = JSON.parse(
  readFileSync(join(ROOT, "package.json"), "utf8"),
) as { scripts: Record<string, string> };
const scriptEntryPattern = /\btsx\s+(scripts\/[\w./-]+\.ts|server\.ts)\b/g;
const scriptEntries = new Set(
  Object.values(packageJson.scripts).flatMap((command) =>
    [...command.matchAll(scriptEntryPattern)].map((match) =>
      resolve(ROOT, match[1]),
    ),
  ),
);

const config = ts.readConfigFile(join(ROOT, "tsconfig.json"), ts.sys.readFile);
if (config.error) {
  throw new Error(
    ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
  );
}
const options = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  ROOT,
).options;
const program = ts.createProgram({ rootNames: sourceFiles, options });
const checker = program.getTypeChecker();

// TypeScript resolves references to their declaration, so a same named
// identifier in an unrelated file cannot keep an export alive.
const sources = new Map<string, ts.SourceFile>();
for (const file of sourceFiles) {
  const source = program.getSourceFile(file);
  if (source === undefined) throw new Error(`TypeScript did not load ${file}`);
  sources.set(file, source);
}

const references = new Map<ts.Symbol, Set<string>>();
const targetOf = (symbol: ts.Symbol | undefined): ts.Symbol | undefined => {
  if (symbol === undefined) return undefined;
  return symbol.flags & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol;
};

for (const [file, source] of sources) {
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node)) {
      const target = targetOf(checker.getSymbolAtLocation(node));
      if (target !== undefined) {
        const readers = references.get(target) ?? new Set<string>();
        readers.add(file);
        references.set(target, readers);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

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

// The Worker's exports are read by Wrangler rather than by an import: the
// class is named in wrangler.jsonc and the default object is the entry.
const WORKER_EXPORTS = new Set(["GameContainer", "default"]);

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
  "icon.svg",
  "twitter-image.tsx",
  "sitemap.ts",
  "robots.ts",
  "robots.txt",
  "manifest.ts",
  "instrumentation.ts",
  "forbidden.tsx",
  "unauthorized.tsx",
]);

const findings: string[] = [];

// The export half.

for (const file of sourceFiles) {
  const source = sources.get(file) as ts.SourceFile;
  const underApp = file.startsWith(APP);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (moduleSymbol === undefined) continue;
  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    const name = exported.getName();
    if (underApp && ROUTER_EXPORTS.has(name)) continue;
    if (file === WORKER && WORKER_EXPORTS.has(name)) continue;
    const target = targetOf(exported);
    const readers = target === undefined ? undefined : references.get(target);
    if (
      readers === undefined ||
      ![...readers].some((reader) => reader !== file)
    ) {
      findings.push(
        `${relative(ROOT, file)} exports "${name}", and nothing in the tree reads it.`,
      );
    }
  }
}

// The orphan half.

/** Module specifiers in actual import, re-export, dynamic import or require nodes. */
function moduleSpecifiers(source: ts.SourceFile): string[] {
  const specifiers: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

const candidates = (base: string): string[] => [
  base,
  `${base}.ts`,
  `${base}.tsx`,
  `${base}.json`,
  `${base}.css`,
  `${base}.svg`,
  join(base, "index.ts"),
  join(base, "index.tsx"),
];

// A specifier that carries its own extension names the file it means, and
// the candidates below would look for a second one.
const stripExtension = (base: string): string =>
  base.replace(/\.(ts|tsx|js|mjs|jsx)$/, "");

const imported = new Set<string>();

for (const [file, source] of sources) {
  for (const specifier of moduleSpecifiers(source)) {
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
      if (existsSync(candidate) && surface.has(candidate)) {
        imported.add(candidate);
        break;
      }
    }
  }
}

const CSS_IMPORT = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*;/g;
for (const file of staticFiles.filter((path) => path.endsWith(".css"))) {
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of css.matchAll(CSS_IMPORT)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    const importedFile = resolve(dirname(file), specifier);
    if (surface.has(importedFile)) imported.add(importedFile);
  }
}

for (const file of surfaceFiles) {
  if (imported.has(file)) continue;
  if (
    scriptEntries.has(file) ||
    file === resolve(ROOT, "server.ts") ||
    file === WORKER
  ) {
    continue;
  }
  const rel = relative(ROOT, file);
  if (
    ROUTER_ENTRIES.has(rel.split("/").pop() as string) &&
    file.startsWith(APP)
  ) {
    continue;
  }
  if (file === join(ROOT, "public/robots.txt")) continue;
  findings.push(`${rel} is a source file or asset nothing imports.`);
}

// The verdict.

if (findings.length === 0) {
  console.log(
    `The surface is alive. ${surfaceFiles.length} files read, no export without a reader and no source file or asset without a reference or entry point.`,
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
