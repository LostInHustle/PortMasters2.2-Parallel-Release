// PortMasters 2.2 Parallel Release, smoke run: The first voyage.
//
// W5's article. What a new captain meets before the first market, held to
// the records the surfaces read: the guide rows the three path surfaces
// print, the tutorial's path page, the manual's path page, and the two
// lines the draft and the Welcome screen state. Nothing here opens a
// harbor: the surfaces are functions and source, so the article sits with
// the pure cluster at the run's end.

import { openingPhase } from "@/lib/game/checkpoint";
import { tutorialSteps } from "@/lib/game/constants/copy";
import { RENOWN_MAX_LEVEL, renownTitleForLevel } from "@/lib/game/legacy";
import {
  PATHS,
  PATH_IDS,
  pathFactText,
  pathGuide,
  type PathId,
} from "@/lib/game/paths";
import {
  CARRIES_A_DASH,
  CARRIES_A_HYPHEN,
  check,
  withoutComments,
} from "../harness";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(import.meta.dirname, "..", "..", "..");

function readSource(relative: string): string {
  return withoutComments(readFileSync(join(REPO, relative), "utf8"));
}

export async function theFirstVoyageSuite(): Promise<void> {
  const guide = pathGuide();
  const gambit = tutorialSteps("ocean_gambit", "fair_winds");
  const classic = tutorialSteps("classic", "fair_winds");

  // The three readings of a row, taken apart with the narrow that makes
  // each readable, rather than one cast apiece at every use below.
  const holdText = (id: PathId): string | undefined => {
    const fact = guide
      .find((entry) => entry.id === id)!
      .facts.find((f) => f.kind === "hold");
    return fact?.kind === "hold" ? fact.text : undefined;
  };
  const ordersText = (id: PathId): string | undefined => {
    const fact = guide
      .find((entry) => entry.id === id)!
      .facts.find((f) => f.kind === "orders");
    return fact?.kind === "orders" ? fact.text : undefined;
  };
  const renownTitle = (id: PathId): string | undefined => {
    const fact = guide
      .find((entry) => entry.id === id)!
      .facts.find((f) => f.kind === "renown");
    return fact?.kind === "renown" ? fact.title : undefined;
  };

  // The guide rows: one per path, in the record's own order, wearing the
  // record's own identity. This is the row set the draft's cards, the
  // tutorial's page and the manual's page all print, so a path that
  // reaches one surface and not another fails here rather than showing up
  // as a page a captain finds short.
  check(
    guide.length === PATH_IDS.length &&
      guide.every(
        (entry, index) =>
          entry.id === PATH_IDS[index] &&
          entry.name === PATHS[entry.id].name &&
          entry.crest === PATHS[entry.id].crest,
      ),
    "the guide carries one row per path, in the record's own order, each wearing the name and crest the record itself states",
  );

  // The three readings and their two edges: a hold line only where the
  // record claims a factor other than one, an order count only where the
  // path brings the board a pool, and a Renown rung on every row, named
  // by the ladder's own title reader. The two paths whose ability is an
  // action carry the rung alone, which is a reading of the design rather
  // than an unfinished row.
  check(
    holdText("convoy") ===
      `Hold ${Math.round(PATHS.convoy.cargoModifier * 100)}%` &&
      holdText("loom") === undefined &&
      holdText("aroma") === undefined &&
      holdText("free_captain") === undefined &&
      holdText("quartermaster") ===
        `Hold ${Math.round(PATHS.quartermaster.cargoModifier * 100)}%`,
    "the hold reading lands on the two paths whose record claims a factor other than one and nowhere else, printed as the record's own percentage",
  );
  check(
    ordersText("convoy") === undefined &&
      ordersText("free_captain") === undefined &&
      (["loom", "aroma", "quartermaster"] as const).every(
        (id) =>
          ordersText(id) === `${PATHS[id].orderPool.length} locked orders`,
      ),
    "the order count lands on the three paths that bring the board a pool and on neither of the two action paths, and it counts the pool the record itself holds",
  );
  check(
    guide.every(
      (entry) =>
        renownTitle(entry.id) ===
        renownTitleForLevel(PATHS[entry.id].renownCeiling),
    ) && renownTitle("quartermaster") === renownTitleForLevel(RENOWN_MAX_LEVEL),
    "every row's Renown reading is the rung its own ceiling reaches, read through the ladder's title reader, and the Quartermaster's reaches the top of the ladder",
  );

  // Every row under the house rule, plus the reader the plain surfaces
  // share: the composition of a fact is what the tutorial and the manual
  // print, so it is held here rather than trusted to two call sites.
  const factTexts = guide.flatMap((entry) => entry.facts.map(pathFactText));
  check(
    factTexts.every((text) => text.trim().length > 0) &&
      factTexts.every((text) => !CARRIES_A_DASH.test(text)) &&
      factTexts.every((text) => !CARRIES_A_HYPHEN.test(text)),
    "every reading a path row prints says something and is free of dashes and hyphens, the rule every string a captain reads is held to",
  );
  check(
    guide.every((entry) =>
      entry.facts.every((fact) =>
        fact.kind === "renown"
          ? pathFactText(fact) === `Renown to ${fact.title}`
          : pathFactText(fact) === fact.text,
      ),
    ),
    "the plain reading composes the Renown arm into its sentence and hands the other two arms through untouched, which is the whole difference between it and the draft's own rendering",
  );

  // The two pages the deal draws, held to the rows rather than to a copy
  // of them: the tutorial's page prints every name, every signature and
  // every reading, read through pathGuide, so this check and the page
  // fail together the day a row stops reaching it. The stripped prose is
  // also under the house rule, which is the rule suite 20 applies to the
  // rest of the tutorial.
  const page = gambit.find((step) => step.title.includes("The Path Draft"));
  const plain = page ? page.content.replace(/<[^>]*>/g, " ") : "";
  check(
    page !== undefined &&
      guide.every(
        (entry) =>
          plain.includes(entry.name) &&
          plain.includes(entry.signature) &&
          entry.facts.every((fact) => plain.includes(pathFactText(fact))),
      ),
    "the tutorial's path page prints every path's own name, sentence and readings, so the page a captain reads and the record a path is retuned in cannot disagree",
  );
  check(
    plain.length > 0 &&
      !CARRIES_A_HYPHEN.test(plain) &&
      !CARRIES_A_DASH.test(plain),
    "and every word of the page, markup stripped, is free of dashes and hyphens like the rest of the tutorial",
  );
  check(
    classic.every((step) =>
      guide.every((entry) => !step.content.includes(entry.signature)),
    ),
    "and the founding voyage's tutorial names none of the five paths, because its lap never deals one",
  );

  // This build's own answer, which the page count in suite 20 and the two
  // gates below rest on: the experimental voyage deals at departure and
  // the founding one never does. Stated rather than assumed, so a build
  // that flips the switch reads the page expectations honestly.
  check(
    openingPhase("ocean_gambit") === "path_draft" &&
      openingPhase("classic") !== "path_draft" &&
      page !== undefined,
    "this build opens the experimental voyage at the deal and the founding voyage somewhere else, which is the ground the two pages' gates stand on",
  );

  // The surfaces, as source: all three build from the guide rows, none of
  // them writes the readings arithmetic of its own, and the deal is
  // gated on the same reader everywhere, so the tutorial, the manual and
  // the pier cannot disagree about what the voyage opens at.
  const copyCode = readSource("src/lib/game/constants/copy.ts");
  const manualCode = readSource(
    "src/components/portmasters/HowToPlayModal.tsx",
  );
  const draftCode = readSource(
    "src/components/portmasters/game/phases/PathDraft.tsx",
  );
  const welcomeCode = readSource(
    "src/components/portmasters/game/phases/Welcome.tsx",
  );
  check(
    copyCode.includes("pathGuide(") &&
      manualCode.includes("pathGuide(") &&
      draftCode.includes("pathGuide("),
    "all three path surfaces build from the guide rows, so one retune reaches the draft's cards, the tutorial's page and the manual's page together",
  );
  check(
    !copyCode.includes("cargoModifier") &&
      !manualCode.includes("cargoModifier") &&
      !draftCode.includes("cargoModifier"),
    "and none of the three works the readings out again itself, so a second copy of the rule has nowhere to hide",
  );
  check(
    copyCode.includes('!== "path_draft"') &&
      manualCode.includes('!== "path_draft"') &&
      welcomeCode.includes('opening === "path_draft"'),
    "the three surfaces gate the deal on the same fold of the lap, so the tutorial, the manual and the pier cannot disagree about whether this voyage deals",
  );
  check(
    draftCode.includes("the deal comes first because every stop after"),
    "the draft's own screen states why the deal comes first, the line ONB-1 asked the panel to carry",
  );

  // BUG-7's deferred half, closed where W5 touched the manual it was
  // parked on: the artisan page's advice used to end on the manual's own
  // comparison of the two modes' stakes, a second telling of a rule the
  // mode record owns and prints a page earlier. The page is a function of
  // the mode now (the third of the manual's record-reading pages), and
  // the retyped sentence has nowhere left to sit. Read as source like
  // the checks above, with the comments stripped, so the note that
  // records the old sentence does not read as the sentence itself.
  check(
    manualCode.includes("function artisanPage(") &&
      manualCode.includes("play.failureRule") &&
      !manualCode.includes("ends the voyage in Classic and leaves a mark"),
    "the manual's artisan page ends on the voyage's own stake read off the mode record, so the retyped comparison of the two modes' consequences has no second home",
  );
}
