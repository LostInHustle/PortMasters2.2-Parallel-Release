// PortMasters 2.2 Parallel Release, smoke run: The ledger reads in your language.
//
// The article for the captain's own record, and the one that holds the
// promise the ledger makes: a line is not a sentence but the material a
// sentence is made of, and the sentence is built at the read, in the
// language the reader is holding.
//
// The fault this article exists to keep closed is a captain who picks
// another language halfway through a voyage. A ledger that stores
// sentences freezes the language it was written in, so the ledger ends
// up half in one language and half in another, and a table of captains
// reading the same harbor sees two different records of the same voyage.
//
// So the tree is walked in two halves here. The first is the ledger
// itself: a real voyage's worth of lines is written through the engine
// the way a captain writes them, and the same lines are then read in
// English and in Mandarin, and the Mandarin reading has to be Mandarin
// all the way down, values included, with the shape of the record
// untouched. The second half is the surfaces: the three places a captain
// reads their ledger are held to reading it at the read, because a
// ledger that holds the right material and a screen that prints a
// frozen sentence are two different defects and only one of them is
// closed by the ledger.
//
// Nothing here opens a harbor. Every line is written in process through
// the engine the ship carries, which is the shape the two hygiene walks
// beside it use.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getLocale, setLocale } from "@/lib/game/i18n";
import { cardName } from "@/lib/game/cards";
import {
  joined,
  ledgerText,
  line,
  renderLedger,
  type LedgerLine,
} from "@/lib/game/ledger";
import { applyPathSwitch } from "@/lib/game/engine/draft";
import { hireWorker, fireWorker } from "@/lib/game/engine/workers";
import { selectBoon } from "@/lib/game/engine/boons";
import { pathConfig } from "@/lib/game/paths";
import { check, voyageState, withoutComments } from "../harness";

// The three surfaces a captain reads their ledger through. All of them
// are held to reading at the read, because a ledger that holds the right
// material and a screen that prints a frozen sentence are two defects
// and the ledger only closes one of them.
//
// The third is the peek at another captain's record, which reads the
// lines of the captain being looked at rather than the lines of the one
// looking. It was left out of this list when the list was written, and a
// surface held by no check is a surface that can drift back to printing a
// frozen sentence without anything saying so.
const LEDGER_SURFACES = [
  "src/components/portmasters/game/GameLogPanel.tsx",
  "src/components/portmasters/GameRoom.tsx",
  "src/components/portmasters/game/PlayerDetailModal.tsx",
];

// A line the pack has no leaf for, so the fail-open reading can be
// held: a key no book carries still prints itself rather than
// vanishing, which is what keeps a flip from ever blanking a ledger.
const UNPACKED_KEY =
  "a sentence no book carries, which is the point of the sentence " +
  "that a missing leaf prints itself rather than nothing";

export async function theLedgerReadsInYourLanguageSuite(): Promise<void> {
  // ========== A. A voyage's worth of lines, written the way a captain writes them ==========
  //
  // The engine writes, not this article: every line below is written by
  // the same call a captain's own press makes, so the ledger this
  // article reads is the ledger the ship writes.
  const logs: LedgerLine[] = [];
  const state = voyageState();
  state.money = 1000;
  state.currentRound = 4;
  state.phase = "market";
  state.path = "convoy";
  hireWorker(state, "weaver", logs);
  selectBoon(state, "silk_wind", logs);
  applyPathSwitch(state, "loom", logs);
  fireWorker(state, "weaver", 0, logs);

  check(
    logs.length >= 4,
    "a captain's ledger fills the way one does: a hire, a boon, a change of papers and a dismissal, every one of them written by the engine rather than by this article",
  );

  // ========== B. The lines hold material, not sentences ==========
  //
  // A line is the English it was written in and the values it is
  // written with. The English is the key the book is held by, so the
  // material and the book's row are one string rather than two copies
  // of one sentence.
  check(
    logs.every(
      (entry) =>
        typeof entry.en === "string" &&
        entry.en.length > 0 &&
        (entry.params === undefined ||
          Object.values(entry.params).every(
            (value) =>
              typeof value === "string" ||
              typeof value === "number" ||
              typeof value === "function" ||
              (typeof value === "object" && value !== null),
          )),
    ),
    "a line holds the English it was written in and the values it is written with, and holds nothing else: no sentence, no frozen translation, nothing a second language could not be read into",
  );

  const english = renderLedger("en", logs);
  check(
    english.length === logs.length &&
      english.every((sentence) => sentence.trim().length > 0),
    "and every line reads as a sentence in the language it was written in, with a word in it",
  );

  // ========== C. The flip re-reads the whole ledger ==========
  //
  // The whole record, not the lines written after the flip. This is the
  // fault the ledger's own design is about: a line written before the
  // captain picked another language has to read in the language they are
  // holding now.
  const was = getLocale();
  setLocale("zh");
  const mandarin = renderLedger("zh", logs);

  check(
    mandarin.length === english.length,
    "the flip changes what the ledger says and not how much of it there is: the same number of lines, in the same order, read in the language the captain is now holding",
  );

  const changed = mandarin.filter(
    (sentence, i) => sentence !== english[i],
  ).length;
  check(
    changed === mandarin.length,
    "every line of the ledger reads in the new language, the ones written before the flip included: a captain who changes their language mid voyage does not end up holding a ledger that starts in one language and ends in another",
  );

  const stillEnglish = mandarin.filter(
    (sentence, i) => sentence === english[i] && /[A-Za-z]{3}/.test(sentence),
  );
  check(
    stillEnglish.length === 0,
    "and no line is left behind in the language it was written in: a ledger read in Mandarin holds no English sentence, so two captains reading the same harbor see one record rather than two",
  );

  // ========== D. The values travel with the sentence ==========
  //
  // The sentence is only half of a line. The name of a card, the name
  // of a path and the goods in an order are values, and a value that
  // stayed in the language of the write would leave a Mandarin line
  // carrying an English name, which is the same fault wearing a
  // different coat.
  const boonLine = logs.find((entry) =>
    entry.en.startsWith("🧭 Boon Locked In"),
  );
  const switchLine = logs.find((entry) =>
    entry.en.startsWith("🧭 You set aside"),
  );
  check(
    boonLine !== undefined &&
      switchLine !== undefined &&
      renderLedger("zh", [boonLine])[0].includes(cardName("silk_wind", "zh")) &&
      !renderLedger("zh", [boonLine])[0].includes(cardName("silk_wind", "en")),
    "a card's name travels with the sentence that quotes it: the boon a captain locked in is named in Mandarin in the Mandarin reading, not in the English the card was dealt in",
  );

  check(
    switchLine !== undefined &&
      renderLedger("zh", [switchLine])[0].includes(
        pathConfig("loom")!.name === "Loom" ? "织造" : "Loom",
      ) &&
      renderLedger("zh", [switchLine])[0].includes(
        pathConfig("convoy")!.name === "Convoy" ? "镖行" : "Convoy",
      ),
    "and a path's name travels the same way: the papers a captain set aside and the ones they took up are named in the reader's language, because a name the pack carries is read through the pack rather than handed over as a spelling",
  );

  // A list is joined at the read too, so the separator is the reader's
  // and not the language the voyage began in.
  const goods = joined([line("Hemp", undefined), line("Silk", undefined)])(
    "zh",
  );
  check(
    goods === "亚麻、丝绸" || goods.includes("、"),
    "and a list of goods is joined in the reader's language, so the separator between two of them is the reader's and not the one the voyage began in",
  );

  // ========== E. The read is pure, and the flip is not a one way door ==========
  //
  // Reading does not change the ledger. A captain who reads their
  // ledger in Mandarin and then puts their language back gets the
  // sentences they had, and the material itself never moved.
  const before = JSON.stringify(logs);
  renderLedger("zh", logs);
  renderLedger("en", logs);
  check(
    JSON.stringify(logs) === before,
    "reading a ledger changes nothing about it: the record is the material, and the sentences are drawn from it rather than written onto it",
  );

  const back = renderLedger("en", logs);
  check(
    back.every((sentence, i) => sentence === english[i]),
    "and a captain who reads their ledger in one language and then puts their language back reads exactly what they read first",
  );

  // ========== F. A line the book has no leaf for prints itself ==========
  //
  // The fail-open reading. A key the book does not carry still prints
  // in both languages, so a book that falls behind the tree costs a
  // line its translation and never costs the ledger a line.
  const unpacked = line(UNPACKED_KEY);
  check(
    ledgerText(unpacked) === UNPACKED_KEY &&
      renderLedger("zh", [unpacked])[0] === UNPACKED_KEY,
    "a line the book has no leaf for prints itself in either language rather than printing nothing, so a book that falls behind the tree costs a line its translation and never costs the ledger a line",
  );

  // ========== G. The surfaces read at the read ==========
  //
  // The ledger holding the right material is half the promise. The
  // other half is that the screens a captain reads print what the
  // ledger reads now, and not a sentence the ledger happened to be
  // written in.
  const surfaces = LEDGER_SURFACES.map((file) => ({
    file,
    source: withoutComments(
      readFileSync(join(import.meta.dirname, "..", "..", "..", file), "utf8"),
    ),
  }));
  check(
    surfaces.every(
      (surface) =>
        surface.source.includes("renderLedger") &&
        surface.source.includes("locale") &&
        !/logs\.map\(\s*\(?\s*log\s*\)?\s*=>\s*log\b/.test(surface.source),
    ),
    "every place a captain reads their ledger reads it through the ledger's own reader with the language they are holding, so the tab, the toast and the peek cannot print one sentence where the ledger reads another",
  );

  setLocale(was);
  check(
    getLocale() === was,
    "and the language the process was holding is put back where it was, so this article leaves the run reading in the language it found",
  );
}
