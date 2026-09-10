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
// just one that says so plainly rather than dressing it up.
// =====================================================================
import type { Difficulty } from "../difficulty";

export type ChronicleInput = {
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
  merchantRating: string;
};

export type ChronicleOutput = {
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
// crown; a bankrupt one leads with the loss; everything else leads with
// the homecoming.
function buildHeadline(input: ChronicleInput): string {
  const waters = watersLabel(input.difficulty);
  if (input.crowned) {
    return `${input.displayName} took the crown sailing ${waters} and came home with ${input.finalReputation} Reputation.`;
  }
  if (input.bankrupt) {
    return `${input.displayName} sailed ${waters} and ran out of Gold before the voyage was done.`;
  }
  return `${input.displayName} sailed ${waters} and came home with ${input.finalReputation} Reputation.`;
}

// Composes the body. Three to five sentences, each carrying one fact a
// captain would want to quote. Sentence order is fixed: rounds, peak
// Reputation (with the round it landed in when known), largest single
// trade, lending and borrowing, and the crown or bankruptcy closer.
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
  } else if (input.bankrupt) {
    sentences.push(
      `The voyage ended in bankruptcy before ${input.displayName} could finish.`,
    );
  } else {
    sentences.push(`The harbor closed the books at ${input.merchantRating}.`);
  }
  return sentences.join(" ");
}

export function buildChronicle(input: ChronicleInput): ChronicleOutput {
  return {
    headline: buildHeadline(input),
    body: buildBody(input),
  };
}
