// PortMasters 2.2 Parallel Release, smoke run: the status convention.
//
// [W3] Every state a captain can see says what it is, why it happened and
// the way back, and the clauses are authored once in
// @/lib/game/status-copy. This article holds the registry to its own
// rules the way the card record's article holds the card pool: first the
// shipped subject passes every clause, which is the run the build itself
// gates on, and then the validator is watched firing against subjects
// built by hand, each carrying the one thing wrong that clause is about,
// because a detector nobody has watched fire is a detector nobody has
// tested.
//
// The clauses it watches fire are the convention's whole argument: an
// emptied clause, a sentence that declares a clause and does not carry
// it, a sentence that drops the way back, and a family whose surfaces no
// longer carry one whole telling between them.
//
// Then the two engine contracts the sentences sit on, checked here so
// they cannot move quietly: the cold's way back is the exact promise the
// smoke oracle reads for at the engine's refusal line, and the hunger
// rule quotes the engine's own count rather than a retyped number.
//
// Last, the sweep's guard list itself, held to its contract: every
// family's cause and remedy is guarded, the star's legend is guarded,
// and the states are left out on purpose, because a state is a word
// screens may own and the sentence is what the convention holds.
//
// Nothing here needs a server, a captain or a harbor: the registry is
// static data and its validator is a pure function, so this article runs
// after the run has put its captains away, beside the card record's for
// the same reason.

import { CREW_LOSS_AFTER_HUNGRY_LEGS } from "@/lib/game/constants/crew";
import {
  FROZEN_CREW,
  HUNGRY_CREW,
  IDLE_HAND,
  SKILLED_LEGEND,
  STATUS_FAMILIES,
  STATUS_SENTENCES,
  frozenAssignRefusal,
  frozenBenchLine,
  frozenFrostbiteLog,
  frozenWorkLog,
  hungryPillLine,
  hungryProvisionsNote,
  hungryProductionNote,
  hungryRule,
  hungryTooltip,
  statusGuardedFragments,
  validateStatusCopy,
  type StatusSentence,
  type StatusSubject,
} from "@/lib/game/status-copy";
import { check } from "../harness";

export async function theStatusConventionSuite(): Promise<void> {
  const shipped: StatusSubject = {
    families: STATUS_FAMILIES,
    sentences: STATUS_SENTENCES,
  };

  check(
    validateStatusCopy(shipped).length === 0,
    "the registry the tree ships passes every clause, which is the run the build itself gates on, so a sentence that breaks one of the rules below is a failed build rather than a surface somebody notices in a screenshot",
  );

  check(
    Object.values(STATUS_FAMILIES).every(
      (family) =>
        family.state.trim() && family.cause.trim() && family.remedy.trim(),
    ),
    "every family carries all three clauses, which is the convention's first sentence: a state without a cause is a mystery and a cause without a way back is a verdict",
  );

  // One clause is asked for its finding and for nothing else, since a
  // rule that fired alongside four others could be firing for the wrong
  // reason. The same idiom the card record's article reads its record
  // through.
  const sole = (subject: StatusSubject): string | null => {
    const found = validateStatusCopy(subject);
    return found.length === 1 ? found[0] : null;
  };

  check(
    sole({
      families: { ...STATUS_FAMILIES, frozen: { ...FROZEN_CREW, remedy: "" } },
      sentences: STATUS_SENTENCES,
    }) === "The frozen family carries an empty remedy.",
    "a family whose way back has been emptied away is caught, which is the shape of the defect this convention was planned for: the bench's frozen row read as a funeral because the one clause it had lost was the one that said it was laundry",
  );

  const droppedCause: StatusSentence = {
    surface: "a hand built row",
    family: "hungry",
    build: () => "Short Rations: Fill the larder.",
    declares: ["state", "cause", "remedy"],
  };
  check(
    sole({
      families: STATUS_FAMILIES,
      sentences: [...STATUS_SENTENCES, droppedCause],
    }) ===
      "The sentence on a hand built row declares the cause and does not carry it.",
    "a sentence that declares a clause and does not carry it is caught, so a surface cannot sign up for the full telling and then print less of it",
  );

  const noWayBack: StatusSentence = {
    surface: "a row that forgets the way back",
    family: "hungry",
    build: hungryPillLine,
    declares: ["state"],
  };
  check(
    sole({
      families: STATUS_FAMILIES,
      sentences: [...STATUS_SENTENCES, noWayBack],
    })?.includes("drops the way back") === true,
    "a sentence that declares no remedy is caught even when every clause it declares is present, because the way back is the one clause no sentence may go without, compact surfaces included: the pill's own line and the ticker's marker carry it, so a state with its answer only in a hover has no way left to ship",
  );

  const idleless: StatusSubject = {
    families: STATUS_FAMILIES,
    sentences: [
      ...STATUS_SENTENCES.filter((sentence) => sentence.family !== "idle"),
      {
        surface: "an idle fragment alone",
        family: "idle",
        build: () => IDLE_HAND.remedy,
        declares: ["remedy"],
      },
    ],
  };
  check(
    sole(idleless) ===
      "No sentence of the idle family carries all three clauses, so the family has surfaces but no whole telling.",
    "a family whose surfaces have all gone fragmentary is caught, because a fragment stamped everywhere with its reason nowhere is how a convention quietly ends: the fragments pass one at a time and the family has stopped explaining itself",
  );

  check(
    frozenAssignRefusal().includes("keeps every hand working"),
    "the engine's refusal still carries the promise the oracle reads for, so the sentence can only move by moving this check first rather than by a copy edit six files away",
  );

  check(
    [
      frozenBenchLine(),
      frozenAssignRefusal(),
      frozenWorkLog("A hand", "the nets"),
      frozenFrostbiteLog("A hand", "Weaver"),
    ].every((line) => line.includes(FROZEN_CREW.remedy)),
    "all four cold sentences give the same way back to within their wording, which is the drift this convention closes: the bench's row had dropped the remedy while the engine kept it, and one account of the cold is now one account",
  );

  check(
    hungryRule().includes(`${CREW_LOSS_AFTER_HUNGRY_LEGS} legs in a row`) &&
      hungryRule().includes("costs the newest hand aboard"),
    "the hunger rule quotes the engine's own count rather than a retyped number, so a balance pass that moves CREW_LOSS_AFTER_HUNGRY_LEGS moves every sentence that quotes it",
  );

  check(
    [hungryTooltip(), hungryProvisionsNote(), hungryProductionNote()].every(
      (line) => line.includes(hungryRule()),
    ),
    "the three long hunger sentences carry the one rule sentence whole, and the pill and the marker read below do not: the compact surfaces stay compact because the state and the way back are what a glance can hold",
  );

  check(
    !hungryPillLine().includes(hungryRule()) &&
      hungryPillLine().includes(HUNGRY_CREW.remedy),
    "the roster's pill carries the state and the way back and not the rule",
  );

  check(
    SKILLED_LEGEND.includes("2 goods") && SKILLED_LEGEND.includes("makes 1"),
    "the star's legend names both yields, so the mark the idle rows carry is defined against the same two numbers the engine's production line reads",
  );

  const guarded = statusGuardedFragments();
  check(
    Object.values(STATUS_FAMILIES).every(
      (family) =>
        guarded.includes(family.cause) && guarded.includes(family.remedy),
    ) && guarded.includes(SKILLED_LEGEND),
    "the sweep guards every family's cause and remedy and the star's legend, so a second surface that re-authors one of them is a failed build rather than a sentence that drifts between two files",
  );

  check(
    Object.values(STATUS_FAMILIES).every(
      (family) => !guarded.includes(family.state),
    ),
    "the states stay unguarded on purpose: a state is a word screens may own, and what a re-authoring would betray is the sentence around it",
  );
}
