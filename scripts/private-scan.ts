/**
 * The private information scan.
 *
 * Every secret in this game rides a path that was chosen deliberately:
 * an alignment is dealt and delivered by one module, a flourish and an
 * ally travel inside that same delivery, a verdict is written to one
 * captain's own row and printed to the table once, at the reveal. The
 * paths are correct today, and what this script exists for is the day a
 * later slice adds a second one without knowing it was the second.
 * Nothing else in the toolchain would notice: TypeScript does not know
 * which fields are secret, ESLint does not read payloads, and the smoke
 * suite only sweeps the harbors it happens to sail.
 *
 * Eight rules. Each one names a single path and fails when a second
 * appears, and each one is worth a sentence about what it cannot catch,
 * because a gate that reads as stronger than it is is worse than none.
 *
 *   1. One delivery path for a private entry. The event name is handled
 *      in the two files that are the whole channel (the emitter and the
 *      client's one hook) and in the suite that sweeps it. A third file
 *      is a second path nobody reviewed.
 *   2. One reader of the alignment table. Only the module that deals the
 *      cards may read the rows back, so a slice that wants a card has to
 *      ask that module rather than the database.
 *   3. The verdict is a property in four places: the balance reader,
 *      the operator window, the wire type and the combination instrument.
 *      A fifth is a verdict that has learned to travel.
 *   4. No broadcast payload statement names a secret. This one reads the
 *      text of the emit rather than its meaning, so it catches a payload
 *      that says role or flourish or ally or alignment and passes one
 *      that smuggles the same value under another name.
 *   5. The tutorial's one dangerouslySetInnerHTML site. Its string is
 *      authored copy and the only values in it are constants, so the
 *      rule is that no second such site appears in the tree.
 *   6. The roster frame, which is the only thing that carries the mute
 *      list, addressed one captain at a time. A mute is the host's
 *      judgement of one captain, so a roster frame sent to a room is that
 *      judgement told to the room. What it cannot catch is the event name
 *      retyped at the emit or reached through a variable holding it, which
 *      is why the name is written out in full where it is sent.
 *   7. The draft frame, which carries a captain's hand, addressed one
 *      captain at a time. It is the sixth rule's shape for the sixth rule's
 *      reason: a hand is dealt to a seat, so a draft view sent to a room
 *      lays every seat's cards in front of the table. What it cannot catch
 *      is the same thing the sixth rule cannot catch, the event reached
 *      through a variable rather than written at the emit.
 *   8. The bazaar board, which carries one captain's own view of the rumor
 *      rows: a standing row's direction belongs to its publisher until the
 *      market it moves has been drawn, so a board sent to a room channel
 *      hands the whole table the lean the feature exists to keep. It is
 *      the sixth and seventh rules' shape for their reason, and its
 *      emitters are the union of theirs because two files deliver this
 *      frame rather than one. What it cannot catch is what they cannot
 *      catch either, the event reached through a variable holding it,
 *      which is how the client's own hook names it (see
 *      src/lib/use-bazaar-rumors.ts).
 *
 * Rules 1 to 4 are about the server and the client's one hook. They say
 * nothing about the save path, which the review reads by hand and which
 * rule 4 only partly covers: a save blob is written by a client and its
 * fields are judged by the integrity pass rather than by a name here.
 *
 * Run with npm run check:private.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

/* Rule 1. The private channel, end to end: the one emitter, the module that
   declares the payload and names the event in its own doc, the client's
   one hook, and the suite that sweeps the wire for leaks. The types live in
   a directory now, one module per slice of the wire, so the rule names the
   module that carries this channel rather than the one file it was. */
const PRIVATE_ENTRY_FILES = [
  "src/server/realtime/presence.ts",
  "src/types/realtime/private-entry.ts",
  "src/lib/use-private-log.ts",
];

/* Rule 2. The alignment table's one reader. The smoke reads rows back to
   check what was dealt, which is a test of the module rather than a
   second production reader, and it is named here so the exception is
   deliberate rather than discovered. */
const ALIGNMENT_TABLE_FILES = ["src/server/realtime/gambit.ts"];

/* The smoke suite, which the split moved from one file into scripts/smoke/.
   It is the exception the two rules above name either way: what they guard
   is a second production path, and a test that sweeps the wire for leaks is
   not one. The whole directory is covered because the suite is one suite
   however many files it is written across, and the one file is named beside
   it because the split left it in place while the new suite was read
   against it. */
const isSmoke = (file: string): boolean =>
  file === "scripts/smoke.ts" || file.startsWith("scripts/smoke/");

/* Rule 3. Where the win verdict is a property: the balance reader that
   counts it, the operator window that reads the count, the wire type
   the reveal is shaped by, and the combination instrument, whose whole
   reading is a reduction over rows that carry it (win rate by pair, see
   src/lib/game/combinations.ts). The fourth was added when the F7
   instrument landed, and it carries its sentence: the instrument
   counts verdicts it does not decide, and counting is not travelling. */
const VERDICT_PROPERTY_FILES = [
  "src/lib/game/balance.ts",
  "src/server/telemetry-window.ts",
  "src/types/realtime/voyage.ts",
  "src/lib/game/combinations.ts",
];

/* Rule 4. The shapes a payload must not take. Each one is a token rather
   than a word, because the first draft of this rule matched "ally" inside
   "finally" and reported four clean broadcasts as leaks: what a payload
   would actually say is the alignment itself, the word alignment, a
   flourish field, or an ally property. */
const SECRET_TOKENS: { label: string; pattern: RegExp }[] = [
  { label: "an alignment word", pattern: /"(honest|pirate|broker)"/ },
  { label: "the alignment field", pattern: /\balignment\b/ },
  { label: "a flourish field", pattern: /\bflourish/ },
  { label: "an ally property", pattern: /\bally:/ },
];

/* The emit statements allowed to name one of those tokens. Empty on
   purpose: today no broadcast does, and the first exception has to be an
   edit here plus the sentence in the review explaining it. */
const SECRET_PAYLOAD_SITES: string[] = [];

/* Rule 6. The frame that carries the mute list, and the emitters that may
   deliver it. Read off the event name rather than off the mute field,
   because the defect this guards is not a payload that mentions the list:
   it is the frame losing the captain it was addressed to. */
const ROSTER_FRAME_EVENT = '"room:members"';
const PER_RECIPIENT_EMITTERS = ["emitToUser(", "emitPrivate("];

/* Rule 7. The frame that carries a draft hand, and the emitters that may
   deliver it. It is the sixth rule's shape and for the same reason: a hand
   of cards belongs to one captain, so a draft view sent to a room channel
   lays every seat's cards in front of the table, and what leaks is the
   frame losing the captain it was addressed to rather than a payload that
   names something it should not. The four names below are the ones that
   reach exactly one socket: the two named delivery paths, a reply on the
   asking socket, and a to(socket.id) send, which is the same single
   recipient spelled the long way. */
const DRAFT_FRAME_EVENT = '"draft:update"';
const DRAFT_FRAME_EMITTERS = [
  ...PER_RECIPIENT_EMITTERS,
  "socket.emit(",
  "io.to(socket.id).emit(",
];

/* Rule 8. The frame that carries one captain's board of rumors, and the
   emitters that may deliver it. It is rules 6 and 7's shape for their
   reason: the direction a captain leaned is public only once the market it
   moves has been drawn, so the board a captain is sent is built for them
   and the frame losing its one recipient is what leaks. The list is the
   two named delivery paths, a reply on the asking socket, and both
   spellings of a send to one socket id, because this frame goes out from
   two files and the older of the two sends through the presence map's own
   socket id rather than through a reply (see broadcastBazaar in
   src/server/realtime/bazaar.ts). */
const BAZAAR_FRAME_EVENT = '"bazaar:update"';
const BAZAAR_FRAME_EMITTERS = [
  ...PER_RECIPIENT_EMITTERS,
  "socket.emit(",
  "io.to(socket.id).emit(",
  "io.to(sid).emit(",
];

/* The scanner's own file. It holds the rule table above and the doc
   comments that describe it, so it names every token and every excluded
   path on purpose, and a gate that reports itself is a gate nobody reads. */
const SELF = "scripts/private-scan.ts";

type Problem = { file: string; line: number; message: string };

const problems: Problem[] = [];
const files = walk(SRC).concat(walk(join(ROOT, "scripts")));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

function rel(file: string): string {
  return relative(ROOT, file);
}

function lines(file: string): string[] {
  return readFileSync(file, "utf8").split("\n");
}

const scannedFiles = files.filter((file) => rel(file) !== SELF);

// ========== Rule 1: one delivery path ==========
for (const file of scannedFiles) {
  if (PRIVATE_ENTRY_FILES.includes(rel(file)) || isSmoke(rel(file))) continue;
  lines(file).forEach((text, index) => {
    if (!text.includes("private:entry")) return;
    problems.push({
      file: rel(file),
      line: index + 1,
      message:
        "names the private entry event. A third path is a delivery path nobody reviewed" +
        " (see PRIVATE_ENTRY_FILES in this script).",
    });
  });
}

// ========== Rule 2: one reader of the alignment table ==========
for (const file of scannedFiles) {
  if (ALIGNMENT_TABLE_FILES.includes(rel(file)) || isSmoke(rel(file))) continue;
  lines(file).forEach((text, index) => {
    if (!text.includes("voyageRole")) return;
    problems.push({
      file: rel(file),
      line: index + 1,
      message:
        "reads the alignment table. Ask the module that deals the cards for the card" +
        " (see ALIGNMENT_TABLE_FILES in this script).",
    });
  });
}

// ========== Rule 3: the verdict as a property ==========
// The product, not the scripts. The suite and the balance report write
// `won:` into fixture rows they then hand to the reader, which is a test
// saying what a row looks like rather than a verdict that learned to
// travel; the rule is about what the game ships.
for (const file of scannedFiles) {
  const relativePath = rel(file);
  if (!relativePath.startsWith("src/")) continue;
  if (VERDICT_PROPERTY_FILES.includes(relativePath)) continue;
  lines(file).forEach((text, index) => {
    if (!/\bwon:/.test(text)) return;
    problems.push({
      file: relativePath,
      line: index + 1,
      message:
        "writes the win verdict as a property. Four places hold it (see" +
        " VERDICT_PROPERTY_FILES in this script), and a fifth wants a sentence here.",
    });
  });
}

// ========== Rule 4: no broadcast payload names a secret ==========
for (const file of files) {
  const relativePath = rel(file);
  if (!relativePath.startsWith("src/")) continue;
  const text = lines(file);
  text.forEach((line, index) => {
    const at = line.indexOf(".emit(");
    if (at === -1) return;
    if (SECRET_PAYLOAD_SITES.includes(relativePath)) return;
    // The payload may be on this line or on one of the next few, so the
    // statement is gathered the way the parser would see it: until its
    // brackets close and its semicolon lands. A statement that never
    // closes (a template literal spanning a file) is gathered to the end
    // of the window and read as it stands.
    const statement = gather(text, index);
    const token = SECRET_TOKENS.find((t) => t.pattern.test(statement));
    if (!token) return;
    problems.push({
      file: relativePath,
      line: index + 1,
      message:
        `emits a payload whose statement carries ${token.label}. A broadcast carries what every` +
        " captain in the room may read, so this wants an entry in SECRET_PAYLOAD_SITES" +
        " and a paragraph in docs/SECURITY_REVIEW.md.",
    });
  });
}

// ========== Rule 5: one HTML injection site ==========
for (const file of scannedFiles) {
  const relativePath = rel(file);
  lines(file).forEach((text, index) => {
    if (!text.includes("dangerouslySetInnerHTML")) return;
    if (relativePath === "src/components/portmasters/game/GameModals.tsx")
      return;
    problems.push({
      file: relativePath,
      line: index + 1,
      message:
        "renders HTML rather than text. The tutorial's string is authored copy with" +
        " constants in it; a second site needs that same argument written down.",
    });
  });
}

// ========== Rule 6: the roster frame goes to one captain ==========
for (const file of scannedFiles) {
  const relativePath = rel(file);
  if (!relativePath.startsWith("src/")) continue;
  const text = lines(file);
  text.forEach((line, index) => {
    if (!line.includes(ROSTER_FRAME_EVENT)) return;
    const statement = gather(text, index);
    // A listener rather than a delivery: the client's own subscription
    // names the event and sends nothing.
    if (!statement.includes(".emit(")) return;
    if (PER_RECIPIENT_EMITTERS.some((name) => statement.includes(name))) {
      return;
    }
    problems.push({
      file: relativePath,
      line: index + 1,
      message:
        `delivers ${ROSTER_FRAME_EVENT} to a room. The mute list rides that frame and a mute is the` +
        " host's judgement of one captain, so it goes out through emitToUser or emitPrivate" +
        " (see PER_RECIPIENT_EMITTERS in this script) and never to a room channel.",
    });
  });
}

// ========== Rule 7: a draft hand goes to one captain ==========
for (const file of files) {
  const relativePath = rel(file);
  if (!relativePath.startsWith("src/")) continue;
  const text = lines(file);
  text.forEach((line, index) => {
    // Gathered from the emit rather than from the event, which is rule 4's
    // end of the statement: a delivery is written as a call whose first
    // argument may be lines below the name of the thing being sent.
    if (!line.includes(".emit(")) return;
    const statement = gather(text, index);
    if (!statement.includes(DRAFT_FRAME_EVENT)) return;
    if (DRAFT_FRAME_EMITTERS.some((name) => statement.includes(name))) {
      return;
    }
    problems.push({
      file: relativePath,
      line: index + 1,
      message:
        `delivers ${DRAFT_FRAME_EVENT} to a room. That frame carries a captain's hand, so it goes` +
        " out one socket at a time (see DRAFT_FRAME_EMITTERS in this script).",
    });
  });
}

// ========== Rule 8: the bazaar board goes to one captain ==========
for (const file of files) {
  const relativePath = rel(file);
  if (!relativePath.startsWith("src/")) continue;
  const text = lines(file);
  text.forEach((line, index) => {
    // Gathered from the emit, like the seventh rule: this frame is written
    // with its event name on the line below the call in the two places
    // that send it, so the delivery is the end of the statement to read
    // from rather than the name.
    if (!line.includes(".emit(")) return;
    const statement = gather(text, index);
    if (!statement.includes(BAZAAR_FRAME_EVENT)) return;
    if (BAZAAR_FRAME_EMITTERS.some((name) => statement.includes(name))) {
      return;
    }
    problems.push({
      file: relativePath,
      line: index + 1,
      message:
        `delivers ${BAZAAR_FRAME_EVENT} to a room. That frame is one captain's own board, since a` +
        " standing row's direction is stripped for every reader but its publisher," +
        " so it goes out one socket at a time (see BAZAAR_FRAME_EMITTERS in this script).",
    });
  });
}

function gather(text: readonly string[], from: number): string {
  let out = "";
  let depth = 0;
  let opened = false;
  for (let i = from; i < Math.min(text.length, from + 8); i++) {
    const line = text[i];
    out += line + "\n";
    for (const char of line) {
      if ("([{".includes(char)) {
        depth++;
        opened = true;
      }
      if (")]}".includes(char)) depth--;
    }
    if (opened && depth <= 0 && line.includes(";")) break;
  }
  return out;
}

const scanned = `${files.length} files scanned`;
if (problems.length === 0) {
  console.log(`The private paths hold. ${scanned}, eight rules, no finding.`);
  process.exit(0);
}

console.log(
  `The private scan found ${problems.length} thing${problems.length === 1 ? "" : "s"}:\n`,
);
for (const p of problems) console.log(`  ${p.file}:${p.line}  ${p.message}`);
console.log(
  `\n${scanned}. Every finding is either a fix or an entry in this script's allow list` +
    " with its reason written beside it.",
);
process.exit(1);
