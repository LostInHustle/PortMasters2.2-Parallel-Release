import { type Difficulty } from "../difficulty";
import { modeConfig, voyageRoundsFor, type GameMode } from "../mode";
import { WAGES } from "./crew";

// The advice below is difficulty blind except for the one line about a
// loan running out: it names the round the harbor settles a debt on its
// own, and that round is the voyage's last one, which is the voyage's
// length rather than the tier's on a mode that pins one.
export function tipsText(mode: GameMode, difficulty: Difficulty): string {
  const rounds = voyageRoundsFor(mode, difficulty);
  const play = modeConfig(mode);
  // The heading and the note above the advice, both written for the mode
  // the captain is actually sailing: every strategy below is written for a
  // captain whose books can end the voyage, and on a mode that keeps a
  // failed seat sailing the first thing to say is so. The note is the
  // record's own sentence rather than a second one written here, so the
  // tutorial, the guide and this page cannot tell a captain three
  // different things about the same rule.
  const heading = play.bankruptcyIsFinal
    ? "⚓ Avoiding Bankruptcy Strategies:"
    : `⚓ Staying Afloat in ${play.badge}:`;
  // A block of its own between the heading and the advice, with a blank
  // line on either side of it. The founding mode prints nothing where it
  // would be, which is what leaves its page byte for byte what it was.
  const keptSeat = play.bankruptcyIsFinal
    ? ""
    : `\n🛟 If the Bills Beat You:\n${play.failureRule}\n`;
  return `${heading}
${keptSeat}
💰 Financial Management:
1. Always maintain reserve funds for expenses
2. Maintenance + Wages are fixed round costs
3. Calculate total expenditure before buying

👥 Worker Management:
1. Weaver Wage: ${WAGES.weaver} Gold / Round
2. Master Wage: ${WAGES.master} Gold / Round
3. Maker Wage: ${WAGES.sachet_maker} Gold / Round
4. Hire only as needed

🔮 Broker's Whisper Strategy:
1. Buy rumors early if you have spare gold
2. Hoard revealed items to guarantee Orders profits
3. Balance intel purchases with other investments

🛒 Buying Strategy:
1. Reserve funds for maintenance+wages first
2. Select high value for money goods
3. Prioritize port specialties + revealed intel

🔄 Bartering Strategy:
1. Trade away surplus raw materials for the one you're actually short on
2. A modest Gold offer can secure a needed item faster than waiting on the next round's market
3. Cancel an offer that's sitting unclaimed if you'd rather keep the material yourself

🤝 Trading Strategy:
1. Prioritize highest profit orders
2. Consider freight impact on margins
3. Finished orders yield high profit but incur VAT

⚠️ Risk Control:
1. Calculate fixed round costs: Maintenance + Wages
2. Keep funds consistently > fixed costs
3. Avoid overexpansion cash flow issues

🏴‍☠️ Pirates and Escorts:
1. The escort fee scales with your own Gold, so it's relatively cheap exactly when you're poor and the stakes are also low
2. Hire one when you're carrying enough Gold that losing it would actually hurt
3. Sailing without one is a fair bet when you have little to lose anyway

🆘 Borrowing and Lending:
1. Repay a loan as soon as you can afford it, instead of waiting for it to be deducted automatically at Round ${rounds}
2. Lending Gold raises your own reputation, so helping a captain who can clearly repay you is rarely a bad trade
3. Watch how much you've lent out across the voyage; it's still your Gold until it's actually repaid

🛡️ Backing Strategy:
1. Back a loan you'd have happily lent Gold on yourself; you're taking on the same risk without earning the lender's own full reputation rate
2. Only pledge what you can afford to lose outright, the same rule as lending directly
3. A loan to a captain who's clearly about to turn a profit is a safer backing bet than one taken late in the voyage with little runway left to repay it

💾 Save game progress frequently with Ctrl+S!`;
}
