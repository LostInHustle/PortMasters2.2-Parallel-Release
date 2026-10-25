import { type Difficulty } from "../difficulty";
// The heading and the kept-seat note are read at the moment they are built,
// the way the page prints them. The advice body below the note has no pack
// row yet, so it stays English and is recorded in the gap list.
import { t } from "../i18n";
import { modeConfig, voyageRoundsFor, type GameMode } from "../mode";
import { WAGES } from "./crew";

// The line the advice page and the dialog that opens it lead with, written
// for the mode the captain is actually sailing: every strategy below is
// written for a captain whose books can end the voyage, and on a mode that
// keeps a failed seat sailing the first thing to say is so. One string in
// one place, because the dialog's own description and the page's first
// line are one sentence about the same mode.
export function tipsHeading(mode: GameMode): string {
  const play = modeConfig(mode);
  return play.bankruptcyIsFinal
    ? t("⚓ Avoiding Bankruptcy Strategies:")
    : t("⚓ Staying Afloat in {play.badge}:", { "play.badge": t(play.badge) });
}

// The advice below is difficulty blind except for the one line about a
// loan running out: it names the round the harbor settles a debt on its
// own, and that round is the voyage's last one, which is the voyage's
// length rather than the tier's on a mode that pins one.
export function tipsText(mode: GameMode, difficulty: Difficulty): string {
  const rounds = voyageRoundsFor(mode, difficulty);
  const play = modeConfig(mode);
  // The page's first line comes from the reader above, so this page and
  // the dialog that opens it cannot say two different things.
  const heading = tipsHeading(mode);
  // The note between the heading and the advice is the record's own
  // sentence rather than a second one written here, so the tutorial, the
  // guide and this page cannot tell a captain three different things
  // about the same rule. A block of its own, with a blank line on either
  // side of it: the founding mode prints nothing where it would be, which
  // is what leaves its page byte for byte what it was.
  const keptSeat = play.bankruptcyIsFinal
    ? ""
    : t("\n🛟 If the Bills Beat You:\n{play.failureRule}\n", {
        "play.failureRule": t(play.failureRule),
      });
  // The advice is one row of the pack's own template: the wage figures
  // and the round the harbor settles a loan on arrive as its tokens, and
  // the reading happens where the page is built so the page and the
  // dialog that opens it print in the captain's own language.
  const advice = t(
    "💰 Gold Management:\n1. Always keep reserve Gold for expenses\n2. Maintenance + Wages are fixed round costs\n3. Calculate total expenditure before buying\n\n👥 Artisan Management:\n1. Weaver Wage: {weaverWage} Gold / Round\n2. Master Weaver Wage: {masterWage} Gold / Round\n3. Sachet Maker Wage: {sachetWage} Gold / Round\n4. Hire only as needed\n\n🔮 Broker's Whisper Strategy:\n1. Buy whispers early if you have spare Gold\n2. Hoard revealed goods to guarantee Orders profits\n3. Balance whisper purchases with other investments\n\n🛒 Buying Strategy:\n1. Reserve Gold for maintenance and wages first\n2. Select high value for money goods\n3. Prioritize port specialties + goods named by whispers\n\n🔄 Bartering Strategy:\n1. Trade away surplus raw materials for the one you're actually short on\n2. A modest Gold offer can secure a needed item faster than waiting on the next round's market\n3. Cancel an offer that's sitting unclaimed if you'd rather keep the material yourself\n\n🤝 Trading Strategy:\n1. Prioritize highest profit orders\n2. Consider freight impact on margins\n3. Finished orders yield high profit but incur VAT\n\n⚠️ Risk Control:\n1. Calculate fixed round costs: Maintenance + Wages\n2. Keep Gold consistently above fixed costs\n3. Avoid overexpansion cash flow issues\n\n🏴‍☠️ Pirates and Escorts:\n1. The escort fee scales with your own Gold, so it's relatively cheap exactly when you're poor and the stakes are also low\n2. Hire one when you're carrying enough Gold that losing it would actually hurt\n3. Sailing without one is a fair bet when you have little to lose anyway\n\n🆘 Borrowing and Lending:\n1. Repay a loan as soon as you can afford it, instead of waiting for it to be deducted automatically at Round {rounds}\n2. Lending Gold raises your own Reputation, so helping a captain who can clearly repay you is rarely a bad trade\n3. Watch how much you've lent out across the voyage; it's still your Gold until it's actually repaid\n\n🛡️ Backing Strategy:\n1. Back a loan you'd have happily lent Gold on yourself; you're taking on the same risk without earning the lender's own full Reputation rate\n2. Only pledge what you can afford to lose outright, the same rule as lending directly\n3. A loan to a captain who's clearly about to turn a profit is a safer backing bet than one taken late in the voyage with little runway left to repay it\n\n💾 Save game progress frequently with Ctrl+S!",
    {
      weaverWage: WAGES.weaver,
      masterWage: WAGES.master,
      sachetWage: WAGES.sachet_maker,
      rounds,
    },
  );
  return `${heading}
${keptSeat}
${advice}`;
}
