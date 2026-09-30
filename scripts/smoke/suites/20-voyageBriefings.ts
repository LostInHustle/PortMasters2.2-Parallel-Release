// PortMasters 2.2 Parallel Release, smoke run: The voyage briefings.

import { lapPhases } from "@/lib/game/checkpoint";
import { guideText, tutorialSteps } from "@/lib/game/constants/copy";
import { tipsText } from "@/lib/game/constants/tips";
import type { GameMode } from "@/lib/game/mode";
import { MODES, MODE_ORDER } from "@/lib/game/mode";
import { isLegPhase, phaseFace } from "@/lib/game/phases";
import type { Phase } from "@/lib/game/types";
import {
  CARRIES_A_DASH,
  CARRIES_A_HYPHEN,
  carriesADash,
  check,
  walkSrc,
  withoutComments,
} from "../harness";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function voyageBriefingsSuite(): Promise<void> {
  // What a mode hands a captain before the voyage begins: its badge, its
  // tagline, its summary, and the briefing it prints on the Welcome
  // screen. Nothing derives them. They are copy, written beside the lap
  // in the mode record, and that is why they are checked here rather
  // than trusted: the compiler cannot tell whether a sentence about the
  // shape of a round is true, so a briefing that disagrees with its own
  // lap is a lie only a player can catch. The bug this section was
  // written for is a real one rather than a hypothetical. The Gambit
  // briefing numbered four legs and listed five, and the pill above it
  // printed a fourth number of its own that matched neither.
  //
  // A mode briefs in one of two shapes, and each is held to the lap
  // from the side it can be held from. A line is prose, so it is read
  // through its words: every leg of the mode's own lap has to be named
  // by some step of the sentence, and the steps have to run in the order
  // the engine walks them. A chart is data, so it is read through the
  // checkpoints it names. Both claims are the same claim about the lap.

  // The house rule for every string a mode hands a captain, read with the
  // one rule a regex can hold this file to.
  const modeCopy = MODE_ORDER.flatMap((mode) => {
    const { badge, tagline, summary, failureRule, differences, briefing } =
      MODES[mode];
    return [
      badge,
      tagline,
      summary,
      failureRule,
      ...differences,
      ...(briefing.kind === "line"
        ? [briefing.text]
        : [
            ...briefing.legs.flatMap((leg) => {
              // A chart prints the phase's own face over each leg (see
              // PHASE_FACES), so the words a mode hands a captain are those
              // plus what the mode itself says the leg decides.
              const face = phaseFace(leg.phase);
              return [
                face.icon,
                face.gradient,
                face.label,
                face.short,
                leg.body,
                leg.setsUp,
              ];
            }),
            briefing.closes,
          ]),
    ];
  });
  check(
    modeCopy.every((line) => !CARRIES_A_DASH.test(line)),
    "no line a mode hands a captain carries an en dash, an em dash or a doubled hyphen",
  );
  // A field left blank is copy that renders as an empty row, which no
  // other check in this file would see: a missing body reads as a leg
  // with nothing to say rather than as a record that lost a string.
  check(
    modeCopy.every((line) => line.trim().length > 0),
    "and every string a mode hands a captain says something rather than opening empty",
  );

  // The same copy under the stricter rule, which is the one the mode's own
  // prose is held to: no hyphen at all. Built from the prose rather than
  // from the array above, and the difference is the point. What is left
  // out is the badge, the phase faces and the gradient classes, which are
  // identifiers rather than sentences, and the phase labels, which are
  // shared with the rail rather than written by the mode. What is in it is
  // every sentence a mode writes about itself: what it is, what it costs
  // to fail, what it changes, and what each leg of its round decides.
  const modeProse = MODE_ORDER.flatMap((mode) => {
    const { tagline, summary, failureRule, differences, briefing } =
      MODES[mode];
    return [
      tagline,
      summary,
      failureRule,
      ...differences,
      ...(briefing.kind === "line"
        ? [briefing.text]
        : [
            ...briefing.legs.flatMap((leg) => [leg.body, leg.setsUp]),
            briefing.closes,
          ]),
    ];
  });
  check(
    modeProse.every((line) => !CARRIES_A_HYPHEN.test(line)),
    "and every sentence a mode writes about itself is free of hyphens as well as dashes, which is the rule for the documentation a captain reads",
  );
  // The founding voyage is what the others differ from, so its list is
  // empty rather than absent, and a mode that claims to change nothing is
  // a mode someone forgot to write. The two claims are one check because
  // either one alone passes on a broken record: an empty list on both
  // modes passes the first, and a non empty list on Classic passes the
  // second.
  check(
    MODES.classic.differences.length === 0 &&
      MODES.ocean_gambit.differences.length > 0,
    "the founding voyage lists no differences from itself while the experimental one lists the ways it plays differently, which is the array every surface that explains a mode reads",
  );

  // What the three surfaces that teach the rules do with that array. Each
  // one is read for both modes and for every tier, and each one has to do
  // two things: print the record's own words rather than a version of
  // them written where they are shown, and say something different about
  // Gambit than it says about Classic. The defect this section was
  // written for was both at once: the tutorial taught Classic's lap and
  // promised that bankruptcy ends the voyage, on a mode built on the
  // opposite pillar, and nothing in this file could see it.
  for (const mode of MODE_ORDER) {
    const play = MODES[mode];
    const steps = tutorialSteps(mode, "fair_winds");
    const guide = guideText(mode, "fair_winds");
    const tips = tipsText(mode, "fair_winds");
    check(
      steps.some((step) => step.content.includes(play.failureRule)) &&
        guide.includes(play.failureRule) &&
        // The advice prints it where the rule is not the end of a voyage,
        // because every line under it is written for a captain whose
        // books can sink them, and that is what the note is for.
        (play.bankruptcyIsFinal || tips.includes(play.failureRule)) &&
        guide.includes(play.tagline) &&
        play.differences.every(
          (line) =>
            steps.some((step) => step.content.includes(line)) &&
            guide.includes(line),
        ),
      `every surface that teaches the ${play.badge} voyage prints the words the record states, so the tutorial, the guide and the advice cannot teach three versions of one rule`,
    );
  }
  for (const tier of ["fair_winds", "open_waters", "monsoon"] as const) {
    check(
      guideText("classic", tier) !== guideText("ocean_gambit", tier) &&
        tipsText("classic", tier) !== tipsText("ocean_gambit", tier) &&
        JSON.stringify(tutorialSteps("classic", tier)) !==
          JSON.stringify(tutorialSteps("ocean_gambit", tier)),
      `${MODES.ocean_gambit.badge} is documented on its own terms at ${tier}: the guide, the advice and the tutorial each word the experimental voyage differently from the founding one rather than sharing a page`,
    );
  }
  // The page count, which is the other half of the same claim: a mode with
  // nothing to say about itself adds no page, and a mode that changes
  // rules adds exactly one, so a new captain's manual is as long as the
  // mode they picked has something to teach them.
  check(
    tutorialSteps("ocean_gambit", "fair_winds").length ===
      tutorialSteps("classic", "fair_winds").length + 1 &&
      MODES.classic.differences.length === 0,
    "the experimental voyage adds one page to the tutorial, the list of what it changes, where the founding voyage's manual is the length it has always been",
  );
  // Every word those surfaces print, with the markup stripped: the
  // directive's rule applied to the documentation a captain reads. The
  // tags are stripped rather than the check narrowed, because a style
  // attribute carries hyphens of its own (font-size, color-mix) and they
  // are not words: what a captain reads is the text between the tags.
  const taughtProse = MODE_ORDER.flatMap((mode) =>
    (["fair_winds", "open_waters", "monsoon"] as const).flatMap((tier) => [
      ...tutorialSteps(mode, tier).flatMap((step) => [
        step.title,
        step.content.replace(/<[^>]*>/g, " "),
      ]),
      guideText(mode, tier),
      tipsText(mode, tier),
    ]),
  );
  check(
    taughtProse.every((line) => !CARRIES_A_HYPHEN.test(line)),
    "every word the tutorial, the guide and the advice print for either mode at any tier is free of dashes and hyphens, read with the markup stripped",
  );

  // The two surfaces a captain meets before the first round, which are
  // components rather than functions and so are read as source rather
  // than rendered: the lobby's manual and the room's Welcome screen. Each
  // one takes the mode and prints the record's own fields, and neither
  // states a mode's rules in words of its own. The sentence named in the
  // second check is the one the manual used to carry: it told every crew,
  // in the founding mode's voice, that failing the bills ends the voyage,
  // and no crew sailing the experimental mode had been told the truth.
  const manualSource = readFileSync(
    join(
      import.meta.dirname,
      "..",
      "..",
      "..",
      "src/components/portmasters/HowToPlayModal.tsx",
    ),
    "utf8",
  );
  const welcomeSource = readFileSync(
    join(
      import.meta.dirname,
      "..",
      "..",
      "..",
      "src/components/portmasters/game/phases/Welcome.tsx",
    ),
    "utf8",
  );
  // Read with the comments taken out, because these two checks are about
  // what a screen prints rather than about what its file says, and the
  // difference is real here: this tree's comments quote the sentence they
  // replaced, which is what makes a repair readable a year later, and the
  // first run of this check failed on the note that explains the fix
  // rather than on the defect. Stripping is the narrowest way to say
  // "the code": a comment that names play.failureRule no longer counts as
  // printing it either, so the check gets stronger as well as truer.
  const manualCode = withoutComments(manualSource);
  const welcomeCode = withoutComments(welcomeSource);
  check(
    manualCode.includes("modeConfig(mode)") &&
      manualCode.includes("play.failureRule") &&
      manualCode.includes("play.differences") &&
      !manualCode.includes("you go bankrupt"),
    "the lobby's manual takes the mode it is opened for and prints the record's own rule for a failed seat, rather than the sentence that told every crew the founding voyage's answer",
  );
  check(
    welcomeCode.includes("play.failureRule") &&
      !welcomeCode.includes("Voyages await"),
    "and the Welcome screen states the mode's own stake before the first Dawn, and counts rounds rather than calling each round a voyage",
  );
  // The last of the copy this defect reached, and the only line of it that
  // was wrong before the experimental mode existed: the lobby's Legacy
  // card named Fair Winds' eight rounds above the very screen a captain
  // chooses a voyage on, which is wrong for two of the three charters and
  // for every Gambit table as well, and it ended on the founding mode's
  // ending. The rule needs neither a number nor an ending.
  const lobbyCode = withoutComments(
    readFileSync(
      join(
        import.meta.dirname,
        "..",
        "..",
        "..",
        "src/components/portmasters/Lobby.tsx",
      ),
      "utf8",
    ),
  );
  check(
    !lobbyCode.includes("on the way to Round 8") &&
      !lobbyCode.includes("ends in bankruptcy"),
    "and the lobby's Legacy card states the Renown rule without naming a voyage's length or a mode's ending, so the card a captain reads before choosing a charter is true of the charter they choose",
  );
  check(
    !carriesADash("src/lib/game/mode.ts") &&
      !carriesADash("src/components/portmasters/HowToPlayModal.tsx") &&
      !carriesADash("src/components/portmasters/game/phases/Welcome.tsx") &&
      !carriesADash("src/components/portmasters/Lobby.tsx"),
    "and the four files this copy lands in carry no dash of any kind, comments included",
  );

  // The glyphs a captain reads, held by the same rule the words are: the
  // sequences that draw them are built from code points rather than
  // spelled, because a check that carries the sequence it verifies cannot
  // see the sequence change. What this guards is a real regression rather
  // than an imagined one. The pirate flag is a flag joined to a skull by a
  // zero width joiner, which is invisible in the source and to the
  // compiler, and a documentation pass over the settlement panel dropped
  // it: the flag rendered as a bare black flag with a skull beside it for
  // a release, and only a player could see it.
  const PIRATE_FLAG = String.fromCodePoint(0x1f3f4, 0x200d, 0x2620, 0xfe0f);
  const UNJOINED_FLAG_FORMS = [
    String.fromCodePoint(0x1f3f4, 0x2620, 0xfe0f),
    String.fromCodePoint(0x1f3f4, 0x2620),
  ];
  const pirateSites = walkSrc(
    join(import.meta.dirname, "..", "..", "..", "src"),
  );
  // The panel that draws the flag, which the settlement phase renders
  // before its bills come due. The phase is written across more than one
  // file, and this names the one that holds the glyph rather than the one
  // that routes to it.
  const settlementSource = pirateSites.find((file) =>
    file.endsWith(join("phases", "PirateAttack.tsx")),
  );
  check(
    settlementSource !== undefined &&
      readFileSync(settlementSource, "utf8").includes(PIRATE_FLAG) &&
      pirateSites.every((file) =>
        UNJOINED_FLAG_FORMS.every(
          (form) => !readFileSync(file, "utf8").includes(form),
        ),
      ),
    "the pirate flag is drawn with the zero width joiner that makes it one glyph, in the panel that shows it and in every other source file, so the icon cannot quietly lose it again",
  );

  // Where a mode's briefing puts a thing, as the words it prints for its
  // own legs. A line is split on its own arrow; a chart is its leg order.
  // Both are the mode saying this comes before that, which is the claim
  // the checks further down hold it to.
  const briefingOrder = (mode: GameMode): string[] => {
    const { briefing } = MODES[mode];
    return briefing.kind === "line"
      ? briefing.text.split("→").map((step) => step.trim())
      : briefing.legs.map((leg) => phaseFace(leg.phase).label);
  };

  // A line's own arithmetic, which the numbers used to carry and which
  // B1 moved onto the names: with the numerals retired, a sentence about
  // the shape of a round is held to the same claim the chart is, read
  // through its words. Each step must name one leg of the mode's own lap,
  // in the order the engine walks them, and the words are the faces
  // rather than typed here, so a phase renamed in the table renames the
  // check with it. An icon and a colon are the only things a step may
  // put in front of the name, which is what keeps this from passing on a
  // sentence that names the right legs in the wrong order.
  for (const mode of MODE_ORDER) {
    const { briefing } = MODES[mode];
    if (briefing.kind !== "line") continue;
    const steps = briefingOrder(mode);
    const lap = lapPhases(mode).filter(isLegPhase);
    check(
      steps.length === lap.length &&
        lap.every((phase, index) =>
          steps[index].includes(phaseFace(phase).label),
        ),
      `the ${MODES[mode].badge} briefing walks its own lap once each, in the order the engine walks it`,
    );
  }

  // A chart's hold on the lap, which is not arithmetic but identity:
  // every leg names the checkpoint it is, and the legs have to be the
  // mode's own lap, once each and in the order the engine walks them.
  // This is what keeps a chart honest the day a mode moves a phase, and
  // it is the reason the harbor is dropped rather than listed: waiting
  // to set sail is not a leg a captain pays for, which is the same
  // reason the voyage timeline leaves it off its rail.
  for (const mode of MODE_ORDER) {
    const { briefing } = MODES[mode];
    if (briefing.kind !== "flow") continue;
    const legs = briefing.legs.map((leg) => leg.phase);
    const lap = lapPhases(mode).filter(isLegPhase);
    check(
      legs.length === lap.length &&
        legs.every((phase, index) => phase === lap[index]),
      `the ${MODES[mode].badge} chart covers its own lap once each, in the order the engine walks it`,
    );
    check(
      new Set(legs).size === legs.length,
      "and draws no checkpoint on it twice",
    );
  }

  // The one move the two modes disagree about, and the reason the two
  // briefings differ at all: Classic deals with the table before the
  // manifest is filled, and Gambit fills it first so that the table has
  // nothing to trade against. Read off both sides, because the words and
  // the lap can disagree: a briefing that stated the move backwards
  // would be teaching a new captain the opposite game while the engine
  // ran the right one, and nothing else in this file would notice.
  for (const mode of MODE_ORDER) {
    const lap = lapPhases(mode);
    const ordersFirstOnTheLap = lap.indexOf("orders") < lap.indexOf("parley");
    // Probed by the label the briefing actually prints, so the check
    // follows a phase renamed in the face table rather than pinning the
    // old word here. Read as "the step that names this phase" rather than
    // as equality with the whole step, because the two shapes say
    // different amounts: a chart's leg is the name alone, while a line's
    // step is an icon, the name and a phrase about it, and this check is
    // about which comes first rather than about how much each one says.
    // What is asserted is the order, which is what the two modes disagree
    // about.
    const words = briefingOrder(mode);
    const stepFor = (phase: Phase) => {
      const label = phaseFace(phase).label;
      return words.findIndex((word) => word.includes(label));
    };
    const parleyAt = stepFor("parley");
    const ordersAt = stepFor("orders");
    check(
      ordersAt !== -1 &&
        parleyAt !== -1 &&
        ordersFirstOnTheLap === ordersAt < parleyAt,
      `the ${MODES[mode].badge} briefing runs its manifest and its table in the order its lap does`,
    );
  }
}
