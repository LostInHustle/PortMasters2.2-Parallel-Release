// PortMasters 2.2 Parallel Release, smoke run: The Bilingual Harbor.
//
// The article for the language pack and its readers. The pack
// (src/lib/game/i18n/zh.json) is the one file the mapping document lifts
// into the repo: every captain facing string the tree prints, paired
// English to Mandarin, with braces for the values a call site fills in.
// The readers (src/lib/game/i18n/index.ts) are the t / tFor / tId the
// render boundary asks, and this suite holds the two together three
// ways. The book is read independently and held to its own contract
// (pairs of strings, simple tokens, no Mandarin a leaf does not pair, no
// dashes). Every leaf is then walked through the readers and has to come
// back exactly as the book carries it, tokens filled included. And the
// tree is walked for call sites, every literal a t(), tFor() or tId()
// hands over having to exist in the book. That last walk is proven on a
// synthetic file before the real one, so the check the tree passes is a
// check that has been watched fire, which is the same reading
// validateCards takes of its own clauses.
//
// Nothing here opens a harbor: the book and the readers are both in
// process, which is the shape the roster article beside it uses. The
// walk over the tree reads files rather than the live app for the same
// reason the dash checks do: the claim is about the source the ship
// carries, not about one screen somebody happened to open.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_LOCALE,
  LOCALES,
  getLocale,
  isLocale,
  setLocale,
  t,
  tFor,
  tId,
} from "@/lib/game/i18n";
import PACK from "@/lib/game/i18n/zh.json";
import { CARDS } from "@/lib/game/cards";
import { MODES } from "@/lib/game/mode";
import { DIFFICULTIES } from "@/lib/game/difficulty";
import {
  CARRIES_A_DASH,
  check,
  suffix,
  walkSrc,
  withoutComments,
} from "../harness";

// The token contract the pack was lifted under: a braced name is a plain
// identifier with no spaces and no nesting, and the Mandarin may drop a
// token the English carries but never invent one of its own, because a
// name the call site does not fill would print as itself on a screen.
const SIMPLE_TOKEN = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
const CJK = /[㐀-䶿一-鿿豈-﫿]/;

// The groups the book ships, in the order the document reads them. The
// lift wrote every one; a group that stops being the shape it was, or a
// new one that arrives without this list being told, is a change to the
// record rather than an accident of the file.
const GROUPS =
  "terms,phases,modes,difficulty,goods,food,crew,ports,paths,houses,renown,merits,tags,systems,moments,cards,ui,sentences,fragments";

// A string the book cannot carry, for the detector's own proof below.
// The suffix makes a true collision with a real row something that
// cannot happen by hand, so the synthetic file stays synthetic.
const ABSENT = "no row carries this string " + suffix;

type Leaf = { id: string; group: string; en: string; zh: string };

export async function theBilingualHarborSuite(): Promise<void> {
  const book = PACK as unknown as Record<string, unknown>;

  // ========== A. The book, read independently and held to its contract ==========
  const groupNames = Object.keys(book).filter((group) => group !== "$meta");
  const leaves: Leaf[] = [];
  const shapeProblems: string[] = [];
  for (const group of groupNames) {
    const of = book[group];
    if (of === null || typeof of !== "object") {
      shapeProblems.push(group + " is not a group");
      continue;
    }
    for (const [id, raw] of Object.entries(of as Record<string, unknown>)) {
      const leaf = raw as { en?: unknown; zh?: unknown } | null;
      if (
        leaf === null ||
        typeof leaf !== "object" ||
        typeof leaf.en !== "string" ||
        typeof leaf.zh !== "string"
      ) {
        shapeProblems.push(id + " is not a pair of strings");
        continue;
      }
      leaves.push({ id, group, en: leaf.en, zh: leaf.zh });
    }
  }
  check(
    groupNames.join(",") === GROUPS && shapeProblems.length === 0,
    "the book is the shape the lift wrote it in: every group in the document's order, every leaf a pair of English and Mandarin strings, so a group that stopped being one or a row that arrived malformed is caught before any screen reads it",
  );

  // The leaf by leaf contract, and the flat text map rebuilt here as an
  // independent copy: the earlier leaf wins where one English string is
  // carried twice, which is the rule the readers keep as well.
  const contractProblems: string[] = [];
  const dashRows: string[] = [];
  const firstWins = new Map<string, string>();
  for (const { id, en, zh } of leaves) {
    if (!firstWins.has(en)) firstWins.set(en, zh);
    if (/\$\{/.test(en) || /\$\{/.test(zh))
      contractProblems.push(id + " carries ${");
    if (/\\[A-Za-z]/.test(en) || /\\[A-Za-z]/.test(zh)) {
      contractProblems.push(id + " carries a backslash escape");
    }
    if (CJK.test(en)) contractProblems.push(id + " has CJK in its English");
    if (en.trim() && !zh.trim()) contractProblems.push(id + " has no Mandarin");
    // A whitespace only row is layout glue (the lift counts one, a bare
    // newline both sides) and carries no words for any rule here.
    if (!en.trim() && !zh.trim()) continue;
    // The dash rule reads the words with the style carriers taken out:
    // `--` is how a CSS custom property is read, so the var() calls the
    // guide fragments wrap their colors in are the same exemption the
    // tree wide rule documents, not typography.
    const styleFree = (text: string) =>
      text.replace(/var\(--[^)]*\)/g, "var()");
    if (
      CARRIES_A_DASH.test(styleFree(en)) ||
      CARRIES_A_DASH.test(styleFree(zh))
    ) {
      dashRows.push(id);
    }
    const te = [...en.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]);
    const tz = [...zh.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]);
    for (const token of [...te, ...tz]) {
      if (token !== token.trim() || !SIMPLE_TOKEN.test(token)) {
        contractProblems.push(id + " carries the token {" + token + "}");
      }
    }
    const english = new Set(te);
    for (const token of tz) {
      if (!english.has(token))
        contractProblems.push(
          id + " reads a token only it has: {" + token + "}",
        );
    }
  }
  check(
    contractProblems.length === 0 && leaves.length >= 2241,
    "every row holds the token contract the lift was taken under, the book carries at least every row the lift counted, and no row kept a source spelling (a ${ or a backslash escape) that would print as itself instead of the value it stands for",
  );
  check(
    dashRows.length === 0,
    "and the house rule holds over both languages of the whole book: no dash and no doubled hyphen anywhere a captain could read one, the same line every spoken article in this run is held to",
  );

  // ========== B. The readers, walked over every leaf ==========
  setLocale(DEFAULT_LOCALE);
  const englishProblems = leaves.filter(({ en }) => t(en) !== en);
  check(
    englishProblems.length === 0,
    "every English string a call site hands the readers comes back untouched while the language is English: the pack never rewrites the source the smoke suites pin, and the switch to Mandarin is a lookup rather than a second copy of the tree",
  );

  const mandarinProblems = leaves.filter(
    ({ en }) => tFor("zh", en) !== firstWins.get(en),
  );
  check(
    mandarinProblems.length === 0,
    "and every string in the book maps back to the Mandarin the book carries beside it, the earlier leaf where one English string is carried twice, so the flat map the readers hold and the book on disk are one reading rather than two that happen to agree today",
  );

  // The tokens, filled: every name a leaf uses is handed a value of its
  // own, and the Mandarin has to come back with each of its own names
  // replaced and nothing else moved. This walks all of the rows rather
  // than one sample, because the sentences with counts in them are
  // exactly where a mistyped name between the two languages would hide.
  const fillProblems: string[] = [];
  for (const { id, en } of leaves) {
    const names = [
      ...new Set([...en.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1])),
    ];
    if (names.length === 0) continue;
    const params: Record<string, string> = {};
    for (const name of names) params[name] = "«" + name + "»";
    // The base is the flat map's answer rather than this row's own zh:
    // where one English string is carried twice the readers answer with
    // the earlier leaf (the check above reads that agreement), and this
    // check is about the tokens landing, not about which duplicate won.
    let want = firstWins.get(en) ?? "";
    for (const name of names)
      want = want.split("{" + name + "}").join("«" + name + "»");
    if (tFor("zh", en, params) !== want) fillProblems.push(id);
  }
  check(
    fillProblems.length === 0,
    "and a call site's own values land in the Mandarin under the same names the English uses, so a sentence with a count or a name in it reads whole in both languages and a token renamed on one side is caught here rather than on a screen",
  );

  // ========== C. The one word two surfaces read differently ==========
  const uiMarket = leaves.find(
    (leaf) => leaf.group === "ui" && leaf.id === "ui.market",
  );
  const phaseMarket = leaves.find((leaf) => leaf.id === "phase.market.label");
  setLocale("zh");
  check(
    uiMarket !== undefined &&
      phaseMarket !== undefined &&
      uiMarket.zh !== phaseMarket.zh &&
      firstWins.get(uiMarket.en) === phaseMarket.zh &&
      t(uiMarket.en) === phaseMarket.zh &&
      tId("ui.market") === uiMarket.zh &&
      tId("phase.market.label") === phaseMarket.zh,
    "the one English word two surfaces read differently is answered by id rather than by text: Market is the market phase's chip and it is also the market tab, the two part ways in Mandarin, the flat text map keeps the earlier reading for every plain t() call, and tId hands each of those two surfaces its own",
  );

  check(
    tId("ui.nothing_here") === "ui.nothing_here" &&
      t(ABSENT) === ABSENT &&
      tFor("zh", ABSENT) === ABSENT,
    "and a string or an id the book does not carry prints itself rather than vanishing, in either language: a missing row is a gap in the pack somebody can see and fix, never a sentence quietly shortened",
  );

  // ========== D. The readers' own edges ==========
  check(
    LOCALES.join(",") === "en,zh" &&
      DEFAULT_LOCALE === "en" &&
      isLocale("en") &&
      isLocale("zh") &&
      !isLocale("fr") &&
      !isLocale(null) &&
      !isLocale(7),
    "a value off storage, a cookie or a frame names a language only when the pack can print it, so a hand edited value lands on the shipped language rather than on a blank screen",
  );
  setLocale("zh");
  setLocale("fr" as never);
  check(
    getLocale() === "zh",
    "and a language the pack cannot print is ignored rather than stored, leaving the reader where it was rather than on a language with no book behind it",
  );
  setLocale(DEFAULT_LOCALE);
  check(
    t("{n} coins", { n: 0 }) === "0 coins" &&
      t("{n} coins") === "{n} coins" &&
      t("Harbor") === "Harbor",
    "and the one substitution reads a zero as a value rather than a blank, keeps a token no call filled on the page as written, and returns a plain string untouched, which together are the whole of what every captain facing line goes through",
  );

  // ========== E. The call sites, held to the book ==========
  // The three spellings the wiring uses, each read as the complete string
  // literal it is: t and tId take the string first, tFor takes it after the
  // locale. Both quote styles are read, because the guide's copy still
  // carries two single quoted calls (see copy.ts) and a walk that read only
  // double quotes would pass over them by being blind to the spelling they
  // happen to use. A literal that does not parse as a JSON string is taken
  // as written rather than dropped, because a walk that skipped what it
  // could not read would pass by being blind.
  const CALLS = [
    { re: /\bt\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, byId: false },
    { re: /\btId\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, byId: true },
    {
      re: /\btFor\([^,()]*,\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
      byId: false,
    },
  ];
  const ids = new Set(leaves.map((leaf) => leaf.id));
  function literalOf(raw: string): string {
    if (raw.startsWith('"')) {
      try {
        return JSON.parse(raw) as string;
      } catch {
        return raw;
      }
    }
    // Read a single quoted literal by restating it as the double quoted form
    // JSON can parse, so the newlines, tabs, and quote marks the guide's HTML
    // carries are decoded by the same rules the pack was written under
    // rather than by a second, thinner unescaper here.
    const body = raw.slice(1, -1);
    try {
      return JSON.parse(
        '"' + body.replace(/\\(['\\])/g, "$1").replace(/"/g, '\\"') + '"',
      ) as string;
    } catch {
      return body;
    }
  }
  function scan(source: string): string[] {
    const found: string[] = [];
    for (const { re, byId } of CALLS) {
      for (const match of source.matchAll(re)) {
        const literal = literalOf(match[1]);
        if (byId ? !ids.has(literal) : !firstWins.has(literal))
          found.push(literal);
      }
    }
    return found;
  }

  // The detector's own proof: one file with a carried string (in both
  // spellings), a carried id, and a carried string inside a comment (not a
  // call site), and one with strings and an id the book does not carry, all
  // named.
  const proof = scan(
    withoutComments(
      [
        `const plain = t("${uiMarket?.en ?? "Market"}");`,
        `const single = t('${uiMarket?.en ?? "Market"}');`,
        `const byId = tId("ui.market");`,
        `// t("${ABSENT}"); a note quoting a string that never shipped`,
        `const missing = t("${ABSENT}");`,
        `const missingSingle = t('${ABSENT}');`,
        `const missingId = tId("ui.nothing_here");`,
      ].join("\n"),
    ),
  );
  check(
    proof.length === 3 &&
      proof.filter((literal) => literal === ABSENT).length === 2 &&
      proof.includes("ui.nothing_here"),
    "the walk that holds the tree's call sites to the book has been watched fire: handed files carrying strings in both quote styles and an id the pack does not know, it names all three, while the same string inside a comment is not a call site at all",
  );

  // The real tree, then: every t(), tFor() and tId() literal under src
  // has to exist in the book. The walk reads the source rather than the
  // running app because the claim is about what the ship carries, the
  // same reading the dash checks take of the files they name.
  const srcDir = join(import.meta.dirname, "..", "..", "..", "src");
  const missing: string[] = [];
  let scanned = 0;
  for (const file of walkSrc(srcDir)) {
    const source = withoutComments(readFileSync(file, "utf8"));
    for (const literal of scan(source)) {
      missing.push(
        file.slice(srcDir.length + 1) +
          "  " +
          JSON.stringify(literal).slice(0, 90),
      );
    }
    scanned++;
  }
  // A failure is useful only if it names the rows that are missing, so the
  // walk prints them before the check records the failure.
  if (missing.length > 0) {
    console.log(`  missing (${missing.length}):`);
    for (const entry of missing.slice(0, 40)) console.log(`    ${entry}`);
    if (missing.length > 40) {
      console.log(`    and ${missing.length - 40} more`);
    }
  }
  check(
    missing.length === 0,
    "and every string and id the tree hands the readers today exists in the book, so the completeness of the pack is a property of the source rather than a promise (" +
      scanned +
      " files walked)",
  );

  // ========== F. The card records, held to their rows ==========
  // A card carries its own pair of strings in the record, which is what
  // every screen in fact prints (see cardText in ./game/cards), and the
  // book's cards group is the same pair written down for the mapping
  // document. The two are read as one document here: a card retuned
  // without its row, or a row left behind by a card that moved on, is
  // named rather than left for a captain to read in the wrong language.
  const cardRows = (book.cards ?? {}) as Record<
    string,
    { en?: unknown; zh?: unknown }
  >;
  const faceIds = new Set<string>();
  const mirrored: string[] = [];
  for (const card of CARDS) {
    for (const face of ["name", "desc"] as const) {
      const id = "card." + card.id + "." + face;
      faceIds.add(id);
      const row = cardRows[id];
      if (
        row === undefined ||
        row.en !== card.strings.en[face] ||
        row.zh !== card.strings.zh[face]
      ) {
        mirrored.push(id);
      }
    }
  }
  const orphanRows = Object.keys(cardRows).filter((id) => !faceIds.has(id));
  check(
    mirrored.length === 0 && orphanRows.length === 0,
    "and every card record and its row in the book carry the same two strings, both languages, with no row left behind by a card the pool no longer carries, so the book's cards group is a mirror of the records rather than a plan they have outgrown (" +
      CARDS.length +
      " records mirrored)",
  );

  // ========== G. The records, held to their rows ==========
  // A string can reach the readers without being a literal at the call
  // site: the mode record and the difficulty record carry their own
  // English, and the screens hand those to t() by name, so the walk in
  // section E cannot see them at all. The records are walked here
  // instead, field by field, and every word they carry has to exist in
  // the book. This is the drift the Ocean Gambit's own differences used
  // to carry: a record that said "room" where the book said "harbor"
  // printed its English in both languages, which is the shape of bug a
  // pack cannot see from inside itself.
  //
  // What the readers are given is prose, and what they are not is an
  // id: the icon a card wears, the phase a round names, the kind a
  // briefing is, the tags a tier carries and the order a mode walks are
  // all read as ids and are named as such here, so a record that grows
  // a new kind of field is caught by the field name rather than by a
  // list of values that would have to be rewritten by hand.
  const RECORD_IDS = new Set([
    "icon",
    "kind",
    "phase",
    "tags",
    "checkpointPhaseOrder",
  ]);

  const prose = (
    value: unknown,
    path: string,
    field: string,
    out: { path: string; text: string }[],
  ): void => {
    if (typeof value === "string") {
      if (!RECORD_IDS.has(field)) out.push({ path, text: value });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        prose(item, path + "[" + index + "]", field, out),
      );
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(
        value as Record<string, unknown>,
      )) {
        prose(item, path + "." + key, key, out);
      }
    }
  };

  const recordProse: { path: string; text: string }[] = [];
  for (const [key, mode] of Object.entries(MODES)) {
    prose(mode, "mode." + key, "", recordProse);
  }
  for (const [key, cfg] of Object.entries(DIFFICULTIES)) {
    prose(cfg, "difficulty." + key, "", recordProse);
  }

  // The detector's own proof, on a record shaped like the ones the tree
  // holds: a word the book does not carry is named, and an icon is not
  // a word and is left alone.
  const proofProse: { path: string; text: string }[] = [];
  prose({ badge: ABSENT, icon: "🌤" }, "proof", "", proofProse);
  check(
    proofProse.length === 1 &&
      proofProse[0].text === ABSENT &&
      proofProse[0].path === "proof.badge",
    "the walk that holds the records to the book has been watched fire: handed a record carrying one word the pack does not know beside one icon, it names the word and leaves the icon alone",
  );

  const recordMissing = recordProse.filter((row) => !firstWins.has(row.text));
  check(
    recordMissing.length === 0,
    "and every word the mode and difficulty records carry exists in the book, so a record that is retuned without its row is named here rather than printing its English in a Chinese column (" +
      recordProse.length +
      " record words walked, " +
      Object.keys(MODES).length +
      " modes and " +
      Object.keys(DIFFICULTIES).length +
      " tiers)",
  );
}
