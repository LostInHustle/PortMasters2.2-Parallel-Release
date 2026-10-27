/**
 * The prose punctuation check.
 *
 * Captain facing copy is checked by the smoke suite, but the documents that
 * explain the game are written in the same voice and are read by the same
 * people. This gate holds the documentation to the rule the copy already
 * keeps: no em dashes, no en dashes, no doubled hyphens, and no hyphen
 * standing in for punctuation between two words. A single hyphen inside a
 * compound word is allowed.
 *
 * The scan reads Markdown, plain text, and the environment template. It
 * skips what is not prose: fenced code blocks, inline code spans, HTML
 * comments, URLs, Markdown table delimiter rows and horizontal rules. It
 * also masks the two code shapes a document legitimately prints in running
 * text, a CLI flag such as --skip-generate and a CSS custom property such as
 * var(--w-ship), so the gate does not read either as punctuation.
 *
 * Run with npm run check:prose. Read only, and it reaches for neither the
 * socket client nor the database, so it can run inside the build.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);
const PROSE_FILE = /\.(?:md|mdx|txt)$/;
// The environment template's comments are written in the same voice as the
// documents, and an operator reads them before the first launch, so its
// prose is held to the same rule even though its name carries no extension
// the pattern above can read.
const PROSE_NAMES = new Set([".env.example"]);

function isProse(name: string): boolean {
  return PROSE_FILE.test(name) || PROSE_NAMES.has(name);
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...walk(join(dir, entry.name)));
    } else if (isProse(entry.name)) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

/** The line with the code shaped parts removed and the flags masked. */
function readable(line: string): string {
  return line
    .replace(/`[^`]*`/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/var\(--[\w-]+\)/g, "VAR")
    .replace(/(^|\s)--[a-z][\w-]*/g, "$1FLAG");
}

// Built from their code points, the way the smoke harness builds the dash
// it searches for, so the gate does not carry a copy of the characters it
// forbids in its own text.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

function problem(line: string): string | null {
  if (line.includes(EM_DASH)) return "em dash";
  if (line.includes(EN_DASH)) return "en dash";
  if (line.includes("--")) return "doubled hyphen";
  if (/\s-\s/.test(line)) return "spaced hyphen";
  return null;
}

function check(file: string): string[] {
  const findings: string[] = [];
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  let fence: string | null = null;
  let comment = false;
  for (const [index, raw] of lines.entries()) {
    let line = raw;
    if (fence !== null) {
      const close = line.match(/^\s*(`{3,}|~{3,})\s*$/);
      if (
        close &&
        close[1][0] === fence[0] &&
        close[1].length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }
    if (comment) {
      const end = line.indexOf("-->");
      if (end === -1) continue;
      line = line.slice(end + 3);
      comment = false;
    }
    const opened = line.match(/^\s*(`{3,}|~{3,})/);
    if (opened) {
      fence = opened[1];
      continue;
    }
    // A horizontal rule and a table's delimiter row are both made of the
    // marks this gate is looking for, and neither carries prose.
    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) continue;
    if (line.includes("|") && /^[\s|:-]+$/.test(line) && line.includes("-")) {
      continue;
    }
    line = readable(line);
    const start = line.lastIndexOf("<!--");
    if (start !== -1 && line.indexOf("-->", start) === -1) {
      line = line.slice(0, start);
      comment = true;
    }
    // A list marker and a blockquote marker are layout, not punctuation.
    const text = line.replace(/^\s*(?:>\s*)+/, "").replace(/^\s*[-*+]\s+/, "");
    const found = problem(text);
    if (found !== null) {
      findings.push(
        `${relative(ROOT, file)}:${index + 1}: ${found} in "${raw.trim()}"`,
      );
    }
  }
  return findings;
}

const files = walk(ROOT).sort();
const findings = files.flatMap(check);

if (findings.length === 0) {
  console.log(
    `Prose is clean. ${files.length} files read, no banned dash in prose.`,
  );
  process.exit(0);
}

console.log(
  `Prose carries ${findings.length} banned dash${findings.length === 1 ? "" : "es"}:\n`,
);
for (const finding of findings) console.log(`  ${finding}`);
console.log(
  "\nUse a colon, a comma or a full stop. A single hyphen inside a compound word is allowed.",
);
process.exit(1);
