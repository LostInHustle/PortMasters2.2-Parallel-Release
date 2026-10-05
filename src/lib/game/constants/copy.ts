import {
  difficultyConfig,
  mandateRounds,
  type Difficulty,
  type DifficultyConfig,
} from "../difficulty";
// The two pieces of copy below state how long the voyage runs, and that is
// the mode's number rather than the tier's alone: a mode whose length is
// pinned sails the same legs on every tier (see voyageLegs in ./mode), so
// the tier's ladder would have the guide quoting a voyage the captain is
// not sailing. Read through the one selector, which returns the tier's own
// ladder for the founding mode and so leaves its copy byte for byte what it
// was.
//
// Everything else these three surfaces say about a mode comes out of the
// record itself: its badge, its tagline, its round, the rule for a failed
// seat and the list of what it changes. The tutorial used to draw the
// founding mode's four phases by hand over a count read from the mode, and
// to state the founding mode's bankruptcy rule to every crew, which meant a
// Gambit captain was taught Classic's lap and told that bankruptcy ends a
// voyage in a mode built on the opposite pillar. Copy about a mode is only
// safe beside the mode, so the copy moved to ./mode and these surfaces
// render it.
import { modeConfig, MODES, voyageRoundsFor, type GameMode } from "../mode";
// The phase faces are what a round is called and drawn with, and they are
// read here rather than typed: the record names a leg by its phase, and the
// name a captain reads is the face's rather than the mode's. One import and
// nothing back, since ./phases reads nothing but the phase types.
import { phaseFace } from "../phases";
import { APP_NAME } from "./brand";
import {
  CONVOY_VENTURE_FAILURE_REFUND_RATE,
  CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE,
  CONVOY_VENTURE_PAYOUT_MULTIPLIER,
  TIDEWATCH_SURGE_THRESHOLD,
  WORD_ON_THE_DOCKS_REWARD,
  WORD_ON_THE_DOCKS_THRESHOLD,
} from "./world";
import { PRODUCTS_TIER0, RESOURCES_TIER0 } from "./goods";
import { WORKER_TYPES } from "./crew";
import {
  basePriceRange,
  INCOME_TAX_RATE,
  INTEL_COST,
  VAT_RATE,
} from "../engine/pricing";

// =====================================================================
// Player facing copy. The wording is preserved from the original game; the
// numbers are not baked in any more, because they now depend on the room's
// difficulty tier (see ./difficulty). Every figure a captain could act on
// (voyage length, raid odds, escort fee, mandate rounds) is derived from the
// tier's config, so the guide can never quote a number the engine doesn't use.
// =====================================================================

// The sentences two channels share. The server sends each of these as
// wire text and a panel or a toast renders it, so the server's wording is
// the one every surface quotes: a second copy of a string that answers a
// press is a second answer to what the press did.
export const HOST_ONLY_RESTART = "Only the host can restart the voyage.";
export const STALE_OFFER = "That offer belongs to an earlier leg.";
export const RENOWN_BONUS_LINE =
  "Each Renown level grants a small Gold bonus at the start of your next fresh voyage";
// The refusal a wire answers when the captain it was aimed at is not
// visible to the room. The two chat handlers and the four trading wires
// all say this one sentence, spelled the long way on purpose: the smoke
// run asserts it word for word, so the shorter form the wires drifted
// into is the one that left.
export const TARGET_NOT_IN_HARBOR = "That captain is not in this harbor.";
// The audit and the maroon vote read the same roster, and a captain
// refused at either door is owed the same sentence whichever door they
// stood at.
export const SEAT_NOT_COUNTED = "The harbor is no longer counting your seat.";
export const TARGET_NOT_COUNTED =
  "That captain is not one the harbor is still counting.";
// The two admin refusals, shared by the socket layer, the balance route
// and the two console screens that draw them.
export const NOT_AN_ADMINISTRATOR = "This account is not an administrator.";
export const NO_LONGER_AN_ADMINISTRATOR =
  "This account is no longer an administrator.";

// "a 20% chance", or "a 22% chance that rises to 30% past the midpoint" on a
// tier whose raid odds step up at the halfway mark.
function raidCopy(cfg: DifficultyConfig): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const [first, second] = cfg.pirateChance;
  return second === undefined || second === first
    ? `There is a ${pct(first)} chance.`
    : `There is a ${pct(first)} chance, rising to ${pct(second)} past the midpoint.`;
}

function escortPct(cfg: DifficultyConfig): string {
  return `${Math.round(cfg.escortCostRate * 100)}%`;
}

// One page of the tutorial, named so the step a mode adds can be built
// beside the list rather than inside it. A mode with nothing to add
// spreads an empty array, which is what leaves the founding voyage's page
// count exactly what it has always been.
type TutorialStep = { title: string; content: string };

/**
 * One round, as the tutorial renders it: the mode's own briefing, in the
 * shape the mode chose to brief in.
 *
 * The step this feeds used to draw the founding mode's phases as cards,
 * by hand, above a count read from the mode. On a Gambit voyage that
 * taught Classic's lap, left one of the six phases out of the grid
 * entirely, and put the manifest after the table on a mode whose whole
 * argument is that it runs before it. Which shape a mode briefs in is the
 * record's own decision (see ModeBriefing), so this renders the record
 * rather than keeping a second copy of the lap for every mode that might
 * move it.
 *
 * The accent is the phase's own CSS variable, named after the phase, which
 * is the pairing the palette already holds for all six of them, so a leg
 * added to a chart is drawn in its own colour without a table of them
 * living here. Classic's line keeps the accent its cards wore.
 */
function roundStepHtml(mode: GameMode): string {
  const { briefing } = modeConfig(mode);
  if (briefing.kind === "line") {
    return `<div style="background:color-mix(in oklch, var(--gain) 12%, transparent);border-radius:6px;padding:12px;border-left:3px solid var(--gain);color:var(--foreground);line-height:1.9">${briefing.text}</div>`;
  }
  const legs = briefing.legs
    .map((leg) => {
      const face = phaseFace(leg.phase);
      return `  <div style="background:color-mix(in oklch, var(--w-${leg.phase}) 12%, transparent);border-radius:6px;padding:10px;border-left:3px solid var(--w-${leg.phase});color:var(--foreground)">
    <strong>${face.icon} ${face.label}</strong><br>
    <span style="font-size:13px">${leg.body}</span><br>
    <span style="font-size:12px;color:var(--muted-foreground)">${leg.setsUp}</span>
  </div>`;
    })
    .join("\n");
  return `<div style="display:grid;gap:8px;margin:12px 0">
${legs}
</div>
<p style="font-size:12px;color:var(--muted-foreground);margin:4px 0 0">${briefing.closes}</p>`;
}

/**
 * The same round the tutorial charts, as the guide prints it.
 *
 * The guide is the long surface and the tutorial is the short one, and
 * both say the same thing about the round because both read it from the
 * record: a mode that moves a phase moves both, and neither can be left
 * describing the lap of the other mode. The chart keeps its two lines per
 * leg here, where there is room for them, and a mode that briefs in one
 * sentence prints the sentence, which is the shape that mode chose.
 */
function roundLines(mode: GameMode): string {
  const { briefing } = modeConfig(mode);
  if (briefing.kind === "line") return briefing.text;
  const legs = briefing.legs.map((leg) => {
    const face = phaseFace(leg.phase);
    return `• ${face.icon} ${face.label}: ${leg.body}\n  ${leg.setsUp}`;
  });
  return [...legs, briefing.closes].join("\n");
}

/**
 * What this mode changes, as a page of the tutorial, or no page at all for
 * the founding voyage.
 *
 * The list is the record's own, so this page cannot say something the mode
 * does not do, and the sentence above it says the thing the list cannot:
 * that the rest of the voyage is the one a Classic captain already knows.
 * That sentence is the point of the page. A new captain opening a mode
 * they have never sailed has two questions, what changed and whether they
 * still know how to play, and the answer to the second one is yes.
 */
function differenceSteps(mode: GameMode): TutorialStep[] {
  const play = modeConfig(mode);
  if (play.differences.length === 0) return [];
  const items = play.differences.map((line) => `  <li>${line}</li>`).join("\n");
  return [
    {
      title: `🧭 ${play.badge}: what is different`,
      content: `<p>This voyage does not play like the founding one. Here is what <strong>${play.badge}</strong> changes about it, all of it:</p>
<ul style="padding-left:18px;line-height:1.9;font-size:14px">
${items}
</ul>
<p style="font-size:12px;color:var(--muted-foreground);margin:8px 0 0">Everything else is the voyage you would sail in Classic, so everything you learn there carries over. You can read the same list any time with F1.</p>`,
    },
  ];
}

export function tutorialSteps(
  mode: GameMode,
  difficulty: Difficulty,
): TutorialStep[] {
  const cfg = difficultyConfig(difficulty);
  const rounds = voyageRoundsFor(mode, difficulty);
  const mandates = mandateRounds(cfg);
  const play = modeConfig(mode);
  return [
    {
      title: "⚓ Welcome aboard",
      content: `<p>${APP_NAME} puts you on the ancient Silk Road: one voyage of ${rounds} rounds, limited gold, and a lot of merchants trying to outmaneuver you at every port.</p>
<p>You are sailing <strong>${play.badge}</strong>: ${play.tagline}</p>
<p>These waters are <strong>${cfg.name}</strong>: ${cfg.tagline}</p>
<p>The rules are easy to pick up, but money is tight early on and a string of bad calls compounds quickly. This covers the things that catch new players out most.</p>
<p style="color:var(--muted-foreground);font-size:13px">Two minutes to read. Saves a lot of frustrated restarts.</p>`,
    },
    {
      title: "🏆 What you're playing for",
      content: `<p>After ${rounds} rounds, the player with the highest score wins the title of <strong>Sea Master</strong>. Score comes from trade profits and fulfilled orders.</p>
<p>${play.failureRule}</p>
<p>Starting gold is <strong>${cfg.startingGold}</strong>. That is enough to get going, but not enough to be careless with.</p>`,
    },
    {
      title: "🔄 How a round runs",
      content: `<p>A round is one lap of the voyage, and this voyage runs ${rounds} of them. Each round walks the phases below in the order your voyage puts them:</p>
${roundStepHtml(mode)}
<p style="font-size:12px;color:var(--muted-foreground);margin:4px 0 0"><kbd style="background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px">Ctrl+N</kbd> moves you between phases without clicking, and a voyage is one whole run of these rounds rather than a round of its own.</p>`,
    },
    ...differenceSteps(mode),
    {
      title: "🏪 Market: Buying",
      content: `<p>The port market has Hemp, Silk, and Tea at prices that shift every round. Buy here, barter with the other captains at Parley, and fill trade orders at Orders. Which of those two stops comes first is a rule of the voyage you are sailing rather than a choice you make, and the rail across the top of the board always shows the order. That is the core loop.</p>
<p>One thing worth knowing about: the <strong>Broker</strong>. Pay a small fee for a demand rumor and a specific trade order is <em>guaranteed</em> to appear when Orders opens. Useful when you have stocked a particular good and want to make sure a buyer shows up.</p>
<div style="background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">
  💡 For the first two or three voyages, stick to raw materials. You can fill an order with them the same round you buy them. No waiting and no risk.
</div>`,
    },
    {
      title: "🤝 Parley: Bartering",
      content: `<p>The Parley is a short window where captains trade directly with each other instead of through the market. Post an offer, like Hemp you don't need for Silk you do, and any other captain in the harbor can take it with one click.</p>
<p>Where it falls in the round is set by the voyage you are sailing rather than changing from round to round: ${MODES.classic.badge} runs it right after Market, and ${MODES.ocean_gambit.badge} runs it right after Orders, and the rail across the top of the board always shows which. Either way, it is the easiest way to recover from a bad draw. All Tea and no Silk, with a Sachet order already on the board? Someone else in the harbor has probably drawn the opposite problem.</p>
<div style="background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">
  A few ground rules: you can't offer an item for itself, both amounts have to be whole numbers of at least one, and you can never offer more than you currently have. The moment you post an offer, that amount is set aside until someone takes it or you cancel it.
</div>
<p style="font-size:13px;color:var(--muted-foreground);margin-top:8px">Nobody has to barter. If nothing on the board interests you, or nobody is offering anything, just move on to the next phase.</p>`,
    },
    {
      title: "📋 Orders: Filling trade orders",
      content: `<p>Trade orders appear and you match your cargo to them. Each one shows the goods needed, the reward, and the shipping fee. Your take is whatever is left after fees and tax.</p>
<p>You can fill as many orders as your cargo allows while Orders is open.</p>
<div style="background:color-mix(in oklch, var(--intel) 14%, transparent);border:1px solid var(--intel);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">
  📌 <strong>Finished goods</strong> (${PRODUCTS_TIER0.join(", ")}) pay two to three times more than raw materials. The catch is they need artisans, and the artisans deliver at Resolve. That is covered next.
</div>
${mandates.length ? `<p style="font-size:13px;margin-top:10px">📜 On round${mandates.length === 1 ? "" : "s"} ${mandates.join(", ")} the Emperor commissions a <strong>mandate</strong>: one large order at a fixed reward, and the only order exempt from VAT. It often asks for more than a single hold carries, so plan to barter or borrow to fill it.</p>` : ""}`,
    },
    {
      title: "⚠️ The artisan trap",
      content: `<p>Artisans turn raw materials into high value finished goods and collect wages at every Resolve. That part is simple. What catches most new players is this:</p>
<div style="background:color-mix(in oklch, var(--alarm) 18%, transparent);border:1px solid var(--alarm);color:var(--foreground);border-radius:6px;padding:12px;margin:12px 0;text-align:center;font-size:14px;font-weight:bold;line-height:1.7">
  Assign a task this round.<br>Wages come due at Resolve either way.
</div>
<p style="font-size:13px;color:var(--muted-foreground);line-height:1.6">Weavers (${wageOf("weaver")}g), Master Weavers (${wageOf("master")}g), and Sachet Makers (${wageOf("sachet_maker")}g) all charge wages <strong>every round</strong>, even when idle, so the bill comes round whether they worked or not. Only hire once you have enough gold to cover at least two rounds of wages alongside your other bills.</p>`,
    },
    {
      title: "🏴‍☠️ Pirates at Resolve",
      content: `<p>Before the bills below come due each round, ${raidCopy(cfg).toLowerCase()} Pirates find your ship and take every coin you're carrying.</p>
<p>You get one choice before that roll happens: hire an escort for ${escortPct(cfg)} of your current Gold and sail through guaranteed safe, or set sail anyway and keep the Gold if the pirates don't show.</p>
${cfg.brokerCorruption ? `<p>In these waters a broker can be corrupt. The rumor you buy is still true and still arrives, always, but a corrupt one also leaks your position to the pirates. The log says so plainly when it happens, and the odds you see already include it.</p>` : ""}
<div style="background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">
  💡 The escort costs a share of whatever you're carrying that round, so it's cheapest exactly when you have the least to protect. Often worth it once your funds are already thin.
</div>`,
    },
    {
      title: "Resolve: Settlement",
      content: `<p>Once the pirates are dealt with, two bills come due:</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0">
  <div style="background:color-mix(in oklch, var(--w-ship) 14%, transparent);border-radius:6px;padding:10px;text-align:center;color:var(--foreground)">
    <div style="font-size:22px;margin-bottom:4px">🔧</div>
    <strong>Ship Maintenance</strong><br>
    <span style="font-size:12px;color:var(--muted-foreground)">15 to 22 Gold each round, set by the waters you sail</span>
  </div>
  <div style="background:color-mix(in oklch, var(--w-market) 14%, transparent);border-radius:6px;padding:10px;text-align:center;color:var(--foreground)">
    <div style="font-size:22px;margin-bottom:4px">👥</div>
    <strong>Artisan Wages</strong><br>
    <span style="font-size:12px;color:var(--muted-foreground)">${ARTISAN_WAGE_MIN} to ${ARTISAN_WAGE_MAX} Gold per person per round</span>
  </div>
</div>
<p style="font-size:13px;color:var(--muted-foreground)">The <strong>Round End Obligations</strong> panel in the sidebar shows exactly what is owed. Check it before spending anything.</p>
<p style="font-size:13px;color:var(--muted-foreground)">Coming up short isn't the end on its own. Right there on the settlement screen, you can ask another captain in the harbor for a loan, and they can send it to you on the spot if they've got the Gold to spare. Just repay it before the voyage's last round ends, or it comes out of your funds automatically and goes straight to them.</p>`,
    },
    {
      title: "🚢 You are ready",
      content: `<p>Keep these points in mind as you play:</p>
<ul style="padding-left:18px;line-height:2.1;font-size:14px">
  <li>Start with raw material orders. Fast money, no complications.</li>
  <li>Always keep at least <strong>30 Gold above</strong> what Resolve will cost you.</li>
  <li>Hire artisans only when you can cover <strong>two full rounds of wages</strong>.</li>
  <li>Dusk ship upgrades compound quickly. Do not skip them.</li>
  <li>Caught short by pirates or a bad round? Ask the harbor for a loan before you assume the voyage is over.</li>
  <li>Every voyage's final Reputation becomes Renown on your account, forever, win or lose. Check your Captain's Legacy any time from the Lobby.</li>
  <li><kbd style="background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px">Ctrl+S</kbd> saves your run &nbsp;·&nbsp; <kbd style="background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px">F1</kbd> opens the full guide.</li>
</ul>
<div style="background:color-mix(in oklch, var(--gain) 14%, transparent);border:2px solid var(--gain);color:var(--foreground);border-radius:8px;padding:12px;text-align:center;margin-top:14px">
  <strong style="font-size:15px">Good winds and good margins, Captain. ⚓</strong>
</div>`,
    },
  ];
}

// The tutorial and the guide draw their goods, wage and tax figures the
// same way every other surface does, off the tables the market and the
// engine read rather than typed into the sentences. A retune that moved a
// base price, a wage or a rate would otherwise leave these two surfaces
// quoting last fortnight's numbers, and the guide can never quote a figure
// the engine does not use.
const wageOf = (id: string): number =>
  WORKER_TYPES.find((w) => w.id === id)?.wage ?? 0;
// The wage range the settlement card prints, read off the same table the
// engine pays from: the cheapest hand and the dearest one are the two ends
// of the bill a captain can be handed, so a retuned wage moves the card
// with it rather than leaving a last fortnight's figure in a sentence.
const ARTISAN_WAGE_MIN = Math.min(...WORKER_TYPES.map((w) => w.wage));
const ARTISAN_WAGE_MAX = Math.max(...WORKER_TYPES.map((w) => w.wage));
const workerLine = (id: string, makes: string): string => {
  const w = WORKER_TYPES.find((x) => x.id === id);
  return `• ${w?.label ?? id} (${w?.wage ?? 0} Gold/Round): Makes ${makes}`;
};
const priceRangeLine = (items: readonly string[]): string =>
  items
    .map((item) => {
      const range = basePriceRange(item);
      return range ? `${item}(${range[0]} to ${range[1]}💰)` : item;
    })
    .join(", ");

export function guideText(mode: GameMode, difficulty: Difficulty): string {
  const cfg = difficultyConfig(difficulty);
  const rounds = voyageRoundsFor(mode, difficulty);
  const mandates = mandateRounds(cfg);
  const play = modeConfig(mode);
  // The mode's own list, printed only by a mode that has one, which is
  // what its empty array says: the founding voyage differs from itself
  // nowhere, so a heading over an empty list would be the only trace of
  // the two modes ever having been one screen. See ModeConfig.differences.
  const changes = play.differences.length
    ? `\n🎲 How ${play.badge} Differs From ${MODES.classic.badge}:\n${play.differences.map((line) => `• ${line}`).join("\n")}\n`
    : "";
  return `⚓ ${APP_NAME}: Rules

🌊 These Waters: ${cfg.icon} ${cfg.name}
${cfg.summary}

🧭 This Voyage: ${play.badge}
${play.tagline}
${changes}
🚢 Objective:
Sail one voyage of ${rounds} rounds, and finish it with the most wealth and reputation in the harbor.

⚖️ If Your Books Fail:
${play.failureRule}

📦 Goods System:
Raw Materials: ${priceRangeLine(RESOURCES_TIER0)}
Finished Goods: ${priceRangeLine(PRODUCTS_TIER0)}

👥 Worker System:
${workerLine("weaver", "Linen or Cotton Clothes")}
${workerLine("master", "Linen, Cotton or Brocade")}
${workerLine("sachet_maker", "Sachets")}

🧾 Tax System:
• VAT: ${Math.round(VAT_RATE * 100)}% on finished product profit margin
• Income Tax: ${Math.round(INCOME_TAX_RATE * 100)}% on your net profit for the round, charged at Resolve after everything else is paid

🔮 Broker's Whisper:
• Market: Click "Broker's Rumor Board" to open the window
• Spend ${INTEL_COST} Gold to buy a "rumor" about Orders demand
• Revealed intel guarantees matching orders will appear
• A rumor is always true and always delivered, on every tier${cfg.brokerCorruption ? `\n• Here a broker may still be corrupt: you get the true rumor, but your position leaks and this round's raid risk rises, and the log tells you when` : ""}

🤝 Parley (Bartering):
• Trade directly with the other captains in your harbor while the Parley is open, whether it falls before or after Orders on your voyage
• Post what you have and what you want for it; anyone can accept it with one click
• An offer can't be an item for itself, and both amounts must be whole numbers of at least 1
• You can never offer more than you currently own, it's set aside the moment you post, and returned to you if you cancel or nobody takes it
• Want to make sure a specific captain gets your offer, not whoever clicks fastest? Pick their name under "With" when you post: only the two of you will ever see it

🔧 Ship Modules (NEW!):
• Dusk: Upgrade your ship to unlock Module Slots
• Draft powerful modules to create unique synergies
• Swap modules to adapt to your current run!

🏴‍☠️ Pirates and Escorts:
• Resolve: ${raidCopy(cfg)} Pirates take every Gold coin you carry.
• Hire an escort for ${escortPct(cfg)} of current Gold to sail safe
• Decide before the pirate roll happens that round${mandates.length ? `\n\n📜 Imperial Mandates:\n• On round${mandates.length === 1 ? "" : "s"} ${mandates.join(", ")} the Emperor commissions one large order at a fixed reward\n• A mandate is the only order exempt from VAT\n• Every captain in the harbor is dealt the same mandate, so it is a race` : ""}

📣 Word on the Docks:
• Whichever captain is first in the harbor to complete ${WORD_ON_THE_DOCKS_THRESHOLD} trade orders total this voyage wins ${WORD_ON_THE_DOCKS_REWARD} Gold on the spot
• It's a race against the rest of the room, not a scheduled event: it can land on any round, for any captain
• Announced to the whole harbor the moment it's won, same as any other harbor wide milestone

🌊 Tidewatch Alerts:
• Once everyone in the harbor's own Reputation adds up past ${TIDEWATCH_SURGE_THRESHOLD}, the harbor takes notice of a bustling crew
• From the next Port Purchase onward, every captain's board gets one extra cargo lot, for the rest of the voyage
• This never changes your voyage length or which tier's goods you see, only how busy the market gets

⚓ Ventures:
• Found on the Dues tab of your captain's rail: any captain can post a venture, a Gold target and a deadline round
• Anyone in the harbor, including the poster, can chip in Gold toward that target at any time before the deadline
• Reach the target in time and it fills: every contributor is paid back ${Math.round((CONVOY_VENTURE_PAYOUT_MULTIPLIER - 1) * 100)}% more Gold than they put in, split in exact proportion to their share
• Miss the deadline and it fails: every contributor only gets back ${Math.round(CONVOY_VENTURE_FAILURE_REFUND_RATE * 100)}% of their own stake, the rest is lost
• Contributing is a real wager on the rest of the harbor coming through, not a free favor
• Your whole harbor only ever gets one filled venture per voyage: the moment any venture fills, every other open venture is cancelled and fully refunded, and posting a new one is disabled until the next voyage
• A deadline can never land on your voyage's final round: it always leaves at least one full round afterward to actually spend whatever you're paid
• No single captain can ever fund more than ${Math.round(CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE * 100)}% of a venture's target alone: it always needs at least one other captain to fund the rest before it can fill

🆘 Financial Aid:
• Can't cover this round's wages or maintenance? Ask the harbor for a loan, right on the settlement screen
• Any captain with enough Gold can lend it to you on the spot; it's in your hands immediately
• Repay it any time before the voyage's last round ends, or it's taken from your funds automatically and handed to your lender
• Still short when the voyage finishes? That unpaid loan is what bankrupts you, not the round it was borrowed in
• Lending Gold raises your own reputation, scaled to how much you lent

🛡️ Backing:
• Every outstanding loan in your harbor is visible on the settlement screen, to everyone, not just the lender and borrower
• A third captain can back one: pledge some of their own Gold as a safety net for the lender, escrowed the instant they pledge it
• Only spent if the loan actually defaults, and only up to whatever was pledged; the lender still eats any shortfall past that
• Never called on when the loan is repaid in full? The whole pledge comes back, plus a small Reputation bonus for the risk paying off
• One backer per loan; you can't back a loan you're the lender or borrower on yourself

Captain's Legacy:
• Every voyage's final Reputation becomes Renown XP on your account the moment the voyage ends, win or lose
• Renown is permanent: it survives a restart and carries into every future voyage, in any harbor, unlike Gold, cargo, and ship level
• ${RENOWN_BONUS_LINE}
• Whoever ends a voyage with the highest Reputation among everyone who reached the endgame screen is crowned Sea Master
• Check your current Renown level, title, and Sea Master crowns any time from the Lobby

🌊 The Round:
${roundLines(mode)}

⌨️ Shortcuts:
• Ctrl+S: Save Game
• Ctrl+N: Next Phase
• Ctrl+H: Manage Workers
• Ctrl+R: Restart
• F1: Instructions

⚓ Bon Voyage and Good Luck!`;
}
