// =====================================================================
// The end of voyage Chronicle.
//
// A finished voyage already shows a hard ledger: rounds played, peak
// Reputation, final Gold, taxes paid. The Chronicle is the prose layer
// on top of that, a one sentence headline and a three to five sentence
// body that turns the numbers into something a captain can quote in chat
// or pin to their Legacy card. Pure function: same numbers in, same
// prose out, no RNG, no clock, no dash characters in any line.
//
// Tone: natural and plain. Reads like a harbour gazette rather than a
// stat block, names the difficulty by its in game label, and never
// editorialises the outcome. A bankrupt voyage still gets a Chronicle,
// just one that says so plainly rather than dressing it up, and in a mode
// that sails on through insolvency the sentence says that too.
// =====================================================================
import type { Difficulty } from "../difficulty";

type ChronicleInput = {
  displayName: string;
  difficulty: Difficulty;
  rounds: number;
  peakReputation: number;
  finalReputation: number;
  largestTrade: number;
  lendCount: number;
  borrowCount: number;
  crowned: boolean;
  bankrupt: boolean;
  // [H7: Maroon and the Harbormaster] Whether the harbor put this captain
  // ashore. Here rather than only on the row because it belongs in the
  // prose: being voted off your own ship is the thing whoever reads this
  // back will want to know, and a chronicle that hid it would be recording
  // a voyage that did not happen.
  marooned: boolean;
  // Whether insolvency ended the voyage when it happened. Named after the
  // mode's own field (see ModeConfig.bankruptcyIsFinal) because it is that
  // field, read at the one moment prose has to know: "ran out of Gold
  // before the voyage was done" is the plain truth in a mode that ends
  // there, and a lie in a mode where the same captain sailed on.
  bankruptcyIsFinal: boolean;
  merchantRating: string;
  // [H9: the unlock code] The line the harbor hands a captain whose
  // voyage count just crossed the threshold, or null on every other
  // voyage. Handed in as prose rather than derived here, because what it
  // names is the world's own table of doors rather than anything about
  // this voyage, and this file is a pure function of one captain's
  // numbers: the count it would have to read lives on the account, and
  // the phrase it prints lives beside the mode it opens.
  unlockLine?: string | null;
};

type ChronicleOutput = {
  headline: string;
  body: string;
};

// The in game label for a difficulty tier, used so the Chronicle names the
// waters the captain actually sailed rather than the enum string. Falls
// back to the enum itself if a future tier hasn't been wired in here yet,
// so a new tier still produces a Chronicle rather than throwing.
function watersLabel(difficulty: Difficulty): string {
  switch (difficulty) {
    case "fair_winds":
      return "Fair Winds";
    case "open_waters":
      return "Open Waters";
    case "monsoon":
      return "the Monsoon Season";
    default:
      return String(difficulty);
  }
}

// Composes the headline. Always one sentence, always present tense, always
// names the captain and the waters. A crowned voyage leads with the
// crown; a marooned one with the vote; a bankrupt one with the loss;
// everything else leads with the homecoming.
//
// The order is the order the reader would lead with it, and a captain who
// ran out of Gold after being put ashore reads the vote first, because
// that is the story: the crown outranks both for the plain reason that a
// marooned captain can still take one, and a chronicle that led with the
// ship they lost would bury its own ending.
function buildHeadline(input: ChronicleInput): string {
  const waters = watersLabel(input.difficulty);
  if (input.crowned) {
    return `${input.displayName} took the crown sailing ${waters} and came home with ${input.finalReputation} Reputation.`;
  }
  if (input.marooned) {
    return `${input.displayName} was put ashore by a vote of the harbor and sailed ${waters} without a ship.`;
  }
  if (input.bankrupt) {
    return input.bankruptcyIsFinal
      ? `${input.displayName} sailed ${waters} and ran out of Gold before the voyage was done.`
      : `${input.displayName} sailed ${waters}, went bankrupt, and finished the voyage.`;
  }
  return `${input.displayName} sailed ${waters} and came home with ${input.finalReputation} Reputation.`;
}

// Composes the body. Three to five sentences, each carrying one fact a
// captain would want to quote. Sentence order is fixed: rounds, peak
// Reputation (with the round it landed in when known), largest single
// trade, lending and borrowing, and the closer, which is the crown, the
// vote, the bankruptcy or the merchant rating, whichever the voyage
// actually ended on. The harbor's own line, when this is the voyage that
// earned one, is the last sentence of all, which is where a gazette keeps
// the item that is not about the voyage in front of it.
function buildBody(input: ChronicleInput): string {
  const sentences: string[] = [];
  sentences.push(`The voyage ran ${input.rounds} rounds.`);
  sentences.push(`Peak Reputation hit ${input.peakReputation}.`);
  if (input.largestTrade > 0) {
    sentences.push(`The largest single trade paid ${input.largestTrade} Gold.`);
  }
  // Lending and borrowing share one sentence so a voyage with neither
  // stays at three sentences total rather than padding.
  if (input.lendCount > 0 || input.borrowCount > 0) {
    const parts: string[] = [];
    if (input.lendCount > 0) {
      parts.push(
        input.lendCount === 1
          ? `${input.displayName} lent once`
          : `${input.displayName} lent ${input.lendCount} times`,
      );
    }
    if (input.borrowCount > 0) {
      parts.push(
        input.borrowCount === 1
          ? `borrowed once`
          : `borrowed ${input.borrowCount} times`,
      );
    }
    const joined = parts.join(" and ");
    sentences.push(`${joined}.`);
  }
  if (input.crowned) {
    sentences.push(`The crown went home with ${input.displayName}.`);
  } else if (input.marooned) {
    sentences.push(
      `The harbor voted to put ${input.displayName} ashore, and the voyage went on without a ship under them.`,
    );
  } else if (input.bankrupt) {
    sentences.push(
      input.bankruptcyIsFinal
        ? `The voyage ended in bankruptcy before ${input.displayName} could finish.`
        : `The books ran out mid voyage, and ${input.displayName} sailed the rest of it bankrupt.`,
    );
  } else {
    sentences.push(`The harbor closed the books at ${input.merchantRating}.`);
  }
  if (input.unlockLine) sentences.push(input.unlockLine);
  return sentences.join(" ");
}

export function buildChronicle(input: ChronicleInput): ChronicleOutput {
  return {
    headline: buildHeadline(input),
    body: buildBody(input),
  };
}
