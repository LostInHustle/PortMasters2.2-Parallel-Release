// PortMasters 2.2 Parallel Release, smoke run: The survival layer's own
// lines.
//
// The one check over the whole set the four survival families write. The
// Larder, the crew and the wardrobe each keep their own lines while
// their own article runs, and the rule is about all of them together, so
// the reading waits until the last of them has been handed back.
//
// The lines arrive in the order the families run in, which is the order
// they were written in when they were one file, so the set read here is
// the set that was read there.
import type { LedgerLine } from "@/lib/game/ledger";
import { CARRIES_A_DASH, check, ledgerSentences } from "../harness";

export function theSurvivalLinesSuite(
  families: readonly (readonly LedgerLine[])[],
): void {
  const survivalLines: LedgerLine[] = families.flatMap((lines) => [...lines]);
  // Every string the survival layer puts in front of a captain, read with
  // the same rule the manifest line above is read with. The house rule
  // covers every string a captain reads, and it is built out of code
  // points at the top of this file so that the check is never where the
  // dashes are kept. Every feature of this family writes into this one
  // accumulator, the wardrobe included, since a frostbite crossing a log
  // line is a captain facing string whatever wrote it, and the rule is
  // about the whole set.
  check(
    survivalLines.length > 0 &&
      ledgerSentences(survivalLines).every(
        (line) => !CARRIES_A_DASH.test(line),
      ),
    "and every line the survival layer writes for a captain, the Larder's shortage, the crew's own losses and the wardrobe's wear alike, is free of dashes, the same rule every other string in the game is held to",
  );
}
