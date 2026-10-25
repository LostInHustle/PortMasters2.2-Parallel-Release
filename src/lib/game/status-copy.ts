// PortMasters 2.2 Parallel Release: the status conventions.
//
// Every state a captain can see says what it
// is, why it happened, and the way back. This module is the one place
// those three clauses are authored: each family below carries a state, a
// cause and a remedy, and every surface composes its sentence from them
// rather than writing its own. scripts/status.ts gates the build on the
// clauses staying whole, and on no second file spelling a guarded one.
//
// The pattern is not new. The field report cycle left four engine log
// lines and two tooltips carrying why and the way back, and this module
// makes that shape the rule rather than six good instances of it. The
// defects it closes are specific: the bench's frozen row had lost the
// remedy its engine lines kept, the hunger sentence was written out per
// surface and would drift, and the rail rendered a shortage in color
// alone.
//
// A family's clauses are read back two ways. The validator holds every
// sentence to the clauses it declares, and holds every family to all
// three; the check script additionally sweeps the tree, because a
// sentence may be phrased around a clause and never author one again. What
// neither can hold is meaning: the clauses are guarded by their words,
// not their sense, which is why the sweep's comment says so out loud.
//
// The family cells stay authored in English, because they are what the
// validator and the sweep compare. The sentences are read through the
// pack (./i18n) at the moment they are composed: each function below
// hands t() the sentence and the family's own cells as token values, so
// the language a captain reads is the process's, and the English the
// suites pin is the same copy this module has always carried.

import { CREW_LOSS_AFTER_HUNGRY_ROUNDS } from "./constants/crew";
import { COLD_ROUND_WARMTH } from "./constants/garments";
import { t } from "./i18n";
import { line, type LedgerLine } from "./ledger";

/** The three clauses every status family carries. */
type StatusClause = "state" | "cause" | "remedy";

/** What a state is called, why it happened, and the way back. */
interface StatusFamily {
  /** The words a row or a compact surface leads with. */
  state: string;
  /** Why it happened. */
  cause: string;
  /** The way back to full strength. */
  remedy: string;
}

type StatusFamilyId = "frozen" | "hungry" | "idle";

// The cold. A hand it takes is still aboard, still eating and still on
// the payroll, so the sentence has to separate a laundry problem from a
// funeral: the state names the round, the cause names the clothes, and the
// remedy is the one purchase that ends it.
export const FROZEN_CREW: StatusFamily = {
  state: "Frozen out this round",
  cause: "went into the cold short of warm clothes",
  remedy: "A warmer layer before a cold round keeps every hand working",
};

// Short rations. The count in the rule is the engine's own
// (CREW_LOSS_AFTER_HUNGRY_ROUNDS decides the hand the crew loses), so no
// sentence can quote a patience the engine does not keep.
export const HUNGRY_CREW: StatusFamily = {
  state: "Short Rations",
  cause: "the crew is on short rations",
  remedy: "Fill the larder",
};

// An idle hand. The wage is why this state is worth a sentence: a task
// left unset costs the same at Resolve as one worked, which is the
// artisan trap the tutorial calls out, said again where the choice is
// actually made.
export const IDLE_HAND: StatusFamily = {
  state: "Idle",
  cause: "no task is set for this round",
  remedy: "Assign a task to put them to work",
};

// ==== The cold, as its surfaces say it ====

/** The bench row and the peek modal, through one function: a hand seen
    from either surface reads the same reason and the same promise. */
export function frozenBenchLine(): string {
  return t(
    "🥶 {FROZEN_CREW.state}: the crew {FROZEN_CREW.cause}. Back next round. {FROZEN_CREW.remedy}.",
    {
      "FROZEN_CREW.state": t(FROZEN_CREW.state),
      "FROZEN_CREW.cause": t(FROZEN_CREW.cause),
      "FROZEN_CREW.remedy": t(FROZEN_CREW.remedy),
    },
  );
}

// The English the assignment refusal is told in, named beside its two
// readers so the engine's ledger and the validator are reading the same
// sentence rather than two sentences that can drift.
const FROZEN_ASSIGN_REFUSAL =
  "❌ The only free hands are frozen out this round: the crew {FROZEN_CREW.cause}, and they are back next round. {FROZEN_CREW.remedy}.";

/** The assignment refusal: the line the engine logs when every free
    hand is standing the round down for the cold. */
export function frozenAssignRefusal(): string {
  return t(FROZEN_ASSIGN_REFUSAL, {
    "FROZEN_CREW.cause": t(FROZEN_CREW.cause),
    "FROZEN_CREW.remedy": t(FROZEN_CREW.remedy),
  });
}

/** The same refusal, as a line for a captain's own ledger.
 *
 * The ledger holds material rather than a finished sentence, so the
 * refusal is held the same way: a captain who reads their ledger in
 * another language reads the refusal in that language, and the family's
 * own clauses travel with the sentence rather than being frozen into it.
 */
export function frozenAssignRefusalLine(): LedgerLine {
  return line(FROZEN_ASSIGN_REFUSAL, {
    "FROZEN_CREW.cause": line(FROZEN_CREW.cause),
    "FROZEN_CREW.remedy": line(FROZEN_CREW.remedy),
  });
}

/** The per hand line in the voyage log, said for the hand whose work
    waits rather than for the crew. The task is the worker record's own
    word, so it is read here the same way the bench reads it. */
export function frozenWorkLog(name: string, task: string): string {
  return t(FROZEN_WORK_LOG, {
    name,
    task: t(task),
    "FROZEN_CREW.cause": t(FROZEN_CREW.cause),
    "FROZEN_CREW.remedy": t(FROZEN_CREW.remedy),
  });
}

// The English the per hand frozen line is told in, named beside its two
// readers for the reason the refusal's own English is named.
const FROZEN_WORK_LOG =
  "🥶 {name} is frozen out this round: the crew {FROZEN_CREW.cause}, and the work on {task} waits for next round. {FROZEN_CREW.remedy}.";

/** The same line, as a line for a captain's own ledger. The task is the
    worker record's own word, so it is read in the reader's language
    along with the rest of the sentence. */
export function frozenWorkLogLine(name: string, task: string): LedgerLine {
  return line(FROZEN_WORK_LOG, {
    name,
    task: line(task),
    "FROZEN_CREW.cause": line(FROZEN_CREW.cause),
    "FROZEN_CREW.remedy": line(FROZEN_CREW.remedy),
  });
}

/** The frostbite line: the one frozen sentence whose subject is the
    hand rather than the crew, so it names the bite itself as the state
    and lets the cause and the way back carry the rest. The label is the
    craft the crew record carries, read through the pack like the task
    above. */
export function frozenFrostbiteLog(name: string, label: string): string {
  return t(FROZEN_FROSTBITE_LOG, {
    name,
    label: t(label),
    "FROZEN_CREW.cause": t(FROZEN_CREW.cause),
    "FROZEN_CREW.remedy": t(FROZEN_CREW.remedy),
  });
}

// The English the frostbite line is told in, named beside its two readers
// for the reason the refusal's own English is named.
const FROZEN_FROSTBITE_LOG =
  "🥶 Frostbite: {name} the {label} {FROZEN_CREW.cause}, and is out of action next round. {FROZEN_CREW.remedy}.";

/** The same line, as a line for a captain's own ledger. The label is the
    craft the crew record carries, read through the pack in the reader's
    language along with the rest of the sentence. */
export function frozenFrostbiteLogLine(
  name: string,
  label: string,
): LedgerLine {
  return line(FROZEN_FROSTBITE_LOG, {
    name,
    label: line(label),
    "FROZEN_CREW.cause": line(FROZEN_CREW.cause),
    "FROZEN_CREW.remedy": line(FROZEN_CREW.remedy),
  });
}

// ==== The cold round chip, as the rail says it ====

/**
 * The rail's cold round chip: the weather read before the round settles,
 * which is the reason the chip is drawn at all (a warning that first
 * appears in the settlement has already cost the hand). The way back is
 * drawn with it rather than left to a hover title, because the captain
 * reading it on a phone has no hover, and because it is still
 * actionable while the chip is on screen: the bench's wardrobe closes
 * the warmth gap while the round is open, so the sentence points at the
 * clothes rather than at the next cold round. The weather itself, the
 * warmth sum the crew is wearing against what the round asks, is passed
 * in already written by the caller (see warmthText in ./garments),
 * which keeps this module clear of the garments reader.
 */
export function coldRoundChipLine(
  warmth: string,
  shortWarmth: boolean,
): string {
  const reading = t("❄️ A cold round: warmth {warmth} of {COLD_ROUND_WARMTH}", {
    warmth,
    COLD_ROUND_WARMTH,
  });
  return shortWarmth
    ? t("{reading}, so the cold will take a hand. {FROZEN_CREW.remedy}.", {
        reading,
        "FROZEN_CREW.remedy": t(FROZEN_CREW.remedy),
      })
    : t("{reading}, and the crew is dressed for it.", { reading });
}

// ==== Short rations, as its surfaces say it ====

// The tail of the rule, split from the count so the sweep can guard the
// wording while the count stays the engine's. A surface that retyped the
// sentence with a hardcoded number would keep this tail and be caught.
const HUNGRY_RULE_TAIL =
  "rounds in a row without rations costs the newest hand aboard.";

/** The rule on its own, for the surfaces that print it beside their own
    lead in: the tooltip, the provisions note, the engine's own line. */
export function hungryRule(): string {
  return t(HUNGRY_RULE, {
    CREW_LOSS_AFTER_HUNGRY_ROUNDS,
    HUNGRY_RULE_TAIL: t(HUNGRY_RULE_TAIL),
  });
}

// The English the rule is told in, named beside its two readers.
const HUNGRY_RULE = "{CREW_LOSS_AFTER_HUNGRY_ROUNDS} {HUNGRY_RULE_TAIL}";

/** The same rule, as a line for a captain's own ledger. */
function hungryRuleLine(): LedgerLine {
  return line(HUNGRY_RULE, {
    CREW_LOSS_AFTER_HUNGRY_ROUNDS,
    HUNGRY_RULE_TAIL: line(HUNGRY_RULE_TAIL),
  });
}

/** The tooltip the ticker marker, the roster pill and the rail's Larder
    cell all carry: the full sentence, for a pointer. */
export function hungryTooltip(): string {
  return t(
    "Going hungry: {HUNGRY_CREW.cause}, every artisan working at a slower pace, a quarter of the hold closed, and {hungryEffect} {HUNGRY_CREW.remedy} at the next Market.",
    {
      "HUNGRY_CREW.cause": t(HUNGRY_CREW.cause),
      hungryEffect: hungryRule(),
      "HUNGRY_CREW.remedy": t(HUNGRY_CREW.remedy),
    },
  );
}

/** The provisions panel's note: the surface that refills the larder
    ends on its own verb, because a captain standing at the fix is told
    the fix rather than sent to the Market. */
export function hungryProvisionsNote(): string {
  return t(
    "The larder is empty: {HUNGRY_CREW.cause}, so every artisan produces less, a quarter of the hold is closed, and {hungryEffect} {HUNGRY_CREW.remedy} before the next Dawn.",
    {
      "HUNGRY_CREW.cause": t(HUNGRY_CREW.cause),
      hungryEffect: hungryRule(),
      "HUNGRY_CREW.remedy": t(HUNGRY_CREW.remedy),
    },
  );
}

/** The engine's production line, said once per hungry round above the
    smaller numbers it explains. */
export function hungryProductionNote(): string {
  return t(HUNGRY_PRODUCTION_NOTE, {
    hungryEffect: hungryRule(),
    "HUNGRY_CREW.remedy": t(HUNGRY_CREW.remedy),
  });
}

// The English the production note is told in, named beside its two
// readers.
const HUNGRY_PRODUCTION_NOTE =
  "⚠️ The crew is on short rations, so every artisan works the round at a slower pace, and {hungryEffect} {HUNGRY_CREW.remedy} at the next Market.";

/** The same note, as a line for a captain's own ledger. The rule it
    quotes is held as material, so the whole note reads in one language
    rather than a Mandarin sentence wrapped around an English one. */
export function hungryProductionNoteLine(): LedgerLine {
  return line(HUNGRY_PRODUCTION_NOTE, {
    hungryEffect: hungryRuleLine(),
    "HUNGRY_CREW.remedy": line(HUNGRY_CREW.remedy),
  });
}

/** The roster pill's visible line: the state and the way back together,
    because a hover title is invisible on touch and the remedy is the
    half of the sentence a fleet reading its own board can act on. */
export function hungryPillLine(): string {
  return t("{HUNGRY_CREW.state}: {HUNGRY_CREW.remedy}", {
    "HUNGRY_CREW.state": t(HUNGRY_CREW.state),
    "HUNGRY_CREW.remedy": t(HUNGRY_CREW.remedy),
  });
}

/** The marker's visible label on the ticker and the rail: the state
    alone, which is all a glance has room for, with the full sentence in
    the title beside it. */
export function hungryMarkerLabel(): string {
  return t(HUNGRY_CREW.state);
}

// ==== An idle hand, as the bench and the peek modal say it ====

/** The bench row and the peek modal. The mark is kept where it was and
    explained by the legend beside the rows rather than in each one. */
export function idleBenchLine(skilled: boolean): string {
  return t(
    "{IDLE_HAND.state}{skillMark}: {IDLE_HAND.cause}, and the wage is still owed at Resolve. {IDLE_HAND.remedy}.",
    {
      "IDLE_HAND.state": t(IDLE_HAND.state),
      // The mark carries a leading space of its own, so the unskilled
      // row's fill is the empty string rather than a mark without one.
      skillMark: skilled ? t(" ⭐ Skilled") : "",
      "IDLE_HAND.cause": t(IDLE_HAND.cause),
      "IDLE_HAND.remedy": t(IDLE_HAND.remedy),
    },
  );
}

/** The star, defined once. A legend rather than a family: it is a
    definition of a mark, not a state with a way back, so it is not held
    to the three clauses. It renders on the staff surface and in the
    peek modal, which are the two places the star appears. */
export const SKILLED_LEGEND =
  "⭐ Skilled: a trained hand makes 2 goods a round where an untrained one makes 1.";

// ==== The registry, and the validator that holds it ====

/** One sentence a surface renders, and the clauses it is held to. A
    surface is free to phrase around its clauses; it is not free to drop
    one, which is the defect the convention exists for. */
export interface StatusSentence {
  /** Where it renders: the audit's words for the surface, so a finding
      names a place rather than a variable. */
  surface: string;
  family: StatusFamilyId;
  build: () => string;
  /** The clauses this sentence must carry, verbatim and case aside. */
  declares: readonly StatusClause[];
}

export const STATUS_FAMILIES: Record<StatusFamilyId, StatusFamily> = {
  frozen: FROZEN_CREW,
  hungry: HUNGRY_CREW,
  idle: IDLE_HAND,
};

export const STATUS_SENTENCES: readonly StatusSentence[] = [
  {
    surface: "the bench's frozen row, and the same row in the peek modal",
    family: "frozen",
    build: frozenBenchLine,
    declares: ["state", "cause", "remedy"],
  },
  {
    surface: "the voyage log's assignment refusal",
    family: "frozen",
    build: frozenAssignRefusal,
    declares: ["state", "cause", "remedy"],
  },
  {
    surface: "the voyage log's per hand frozen line",
    family: "frozen",
    build: () => frozenWorkLog("A hand", "the nets"),
    declares: ["state", "cause", "remedy"],
  },
  {
    surface: "the voyage log's frostbite line",
    family: "frozen",
    build: () => frozenFrostbiteLog("A hand", "Weaver"),
    declares: ["cause", "remedy"],
  },
  {
    surface: "the rail's cold round chip while the warmth falls short",
    family: "frozen",
    build: () => coldRoundChipLine("1", true),
    // The state clause is left out on purpose: this chip's state is the
    // weather reading it leads with, and the family's name for the
    // aftermath ("Frozen out this round") belongs to the rounds that read
    // that row. The chip is held to the clause every surface must carry.
    declares: ["remedy"],
  },
  {
    surface:
      "the hungry tooltip under the ticker marker and on the roster pill",
    family: "hungry",
    build: hungryTooltip,
    declares: ["state", "cause", "remedy"],
  },
  {
    surface: "the provisions panel's short rations note",
    family: "hungry",
    build: hungryProvisionsNote,
    declares: ["state", "cause", "remedy"],
  },
  {
    surface: "the voyage log's hungry round line",
    family: "hungry",
    build: hungryProductionNote,
    declares: ["state", "cause", "remedy"],
  },
  {
    surface: "the roster's Short Rations pill",
    family: "hungry",
    build: hungryPillLine,
    declares: ["state", "remedy"],
  },
  {
    surface: "the ticker's hungry marker",
    family: "hungry",
    build: hungryPillLine,
    declares: ["state", "remedy"],
  },
  {
    surface:
      "the rail's Larder cell while the crew is hungry, its sentence on a tap",
    family: "hungry",
    build: hungryTooltip,
    declares: ["state", "cause", "remedy"],
  },
  {
    surface: "the bench's idle row, and the same row in the peek modal",
    family: "idle",
    build: () => idleBenchLine(false),
    declares: ["state", "cause", "remedy"],
  },
  {
    surface: "the bench's idle row for a trained hand",
    family: "idle",
    build: () => idleBenchLine(true),
    declares: ["state", "cause", "remedy"],
  },
];

/** What the validator reads: the families and the sentences, so a
    damaged pair can be handed in and the findings watched firing. */
export interface StatusSubject {
  families: Record<StatusFamilyId, StatusFamily>;
  sentences: readonly StatusSentence[];
}

const SHIPPED: StatusSubject = {
  families: STATUS_FAMILIES,
  sentences: STATUS_SENTENCES,
};

const carries = (sentence: string, clause: string): boolean =>
  sentence.toLowerCase().includes(clause.toLowerCase());

/**
 * Every way the convention can be broken, as findings. The caller prints
 * them (the check script) or asserts them firing (the suite), because a
 * detector nobody has watched fire is a detector nobody has tested.
 */
export function validateStatusCopy(subject: StatusSubject = SHIPPED): string[] {
  const findings: string[] = [];
  const families = Object.entries(subject.families) as [
    StatusFamilyId,
    StatusFamily,
  ][];

  for (const [id, family] of families) {
    for (const clause of ["state", "cause", "remedy"] as const) {
      if (!family[clause].trim()) {
        findings.push(`The ${id} family carries an empty ${clause}.`);
      }
    }
  }

  for (const sentence of subject.sentences) {
    const family = subject.families[sentence.family];
    const text = sentence.build();
    for (const clause of sentence.declares) {
      // An empty clause is the family's own finding above; the inclusion
      // test would read it as present, so it is skipped here.
      if (!family[clause].trim()) continue;
      if (!carries(text, family[clause])) {
        findings.push(
          `The sentence on ${sentence.surface} declares the ${clause} and does not carry it.`,
        );
      }
    }
    if (!sentence.declares.includes("remedy")) {
      findings.push(
        `The sentence on ${sentence.surface} drops the way back, which is the one clause no sentence may go without.`,
      );
    }
  }

  for (const [id] of families) {
    const whole = subject.sentences.some(
      (sentence) =>
        sentence.family === id &&
        sentence.declares.includes("state") &&
        sentence.declares.includes("cause") &&
        sentence.declares.includes("remedy"),
    );
    if (!whole) {
      findings.push(
        `No sentence of the ${id} family carries all three clauses, so the family has surfaces but no whole telling.`,
      );
    }
  }

  return findings;
}

/**
 * The fragments the check script holds the rest of the tree to: no file
 * outside this module may spell one. The states are left out on purpose,
 * since "Idle" and "Short Rations" are words a dozen screens may own, and
 * what this guards is the sentence rather than the vocabulary.
 */
export function statusGuardedFragments(): readonly string[] {
  return [
    ...Object.values(STATUS_FAMILIES).flatMap((family) => [
      family.cause,
      family.remedy,
    ]),
    HUNGRY_RULE_TAIL,
    SKILLED_LEGEND,
  ];
}
