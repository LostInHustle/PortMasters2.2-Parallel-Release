import {
  DIFFICULTIES,
  difficultyConfig,
  mandateRounds,
  type Difficulty,
  type DifficultyConfig,
} from "../difficulty";
// The two pieces of copy below state how long the voyage runs, and that is
// the mode's number rather than the tier's alone: a mode whose length is
// pinned sails the same rounds on every tier (see voyageRounds in ./mode), so
// the tier's ladder would have the guide quoting a voyage the captain is
// not sailing. Read through the one selector, which returns the tier's own
// ladder for the founding mode and so leaves its copy byte for byte what it
// was.
//
// Everything else these three surfaces say about a mode comes out of the
// record itself: its badge, its tagline, its round, the rule for a failed
// seat and the list of what it changes. Copy about a mode is only safe
// beside the mode, so it lives in ./mode and these surfaces render it.
import {
  modeConfig,
  MODES,
  voyageRoundsFor,
  type GameMode,
  type BriefingPhase,
} from "../mode";
// The phase faces are what a round is called and drawn with, and they are
// read here rather than typed: the record names a round by its phase, and the
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
import { CONSENT_FEE_MAX, CONSENT_FEE_MIN } from "./paths";
import { PRODUCTS_TIER0, RESOURCES_TIER0 } from "./goods";
import { WORKER_TYPES } from "./crew";
import {
  basePriceRange,
  INCOME_TAX_RATE,
  INTEL_COST,
  VAT_RATE,
} from "../engine/pricing";
// The page a dealing mode adds, and the reader that decides whether it is
// drawn: the same openingPhase fold the Welcome screen names its first seat
// with, so the tutorial and the pier cannot disagree about what the voyage
// opens at.
import { openingPhase } from "../checkpoint";
import { pathFactText, pathGuide } from "../paths";
import { getLocale, listJoiner, t, tFor, type Locale } from "@/lib/game/i18n";

// =====================================================================
// Player facing copy. The wording is preserved from the original game; the
// numbers are not baked in any more, because they now depend on the harbor's
// difficulty tier (see ./difficulty). Every figure a captain could act on
// (voyage length, raid odds, escort fee, mandate rounds) is derived from the
// tier's config, so the guide can never quote a number the engine doesn't use.
// =====================================================================

// The sentences two channels share. The server sends each of these as
// wire text and a panel or a toast renders it, so the server's wording is
// the one every surface quotes: a second copy of a string that answers a
// press is a second answer to what the press did.
export const HOST_ONLY_RESTART = "Only the host can restart the voyage.";
export const STALE_OFFER = "That offer belongs to an earlier round.";
// The two refusals the priced wires share when a press arrives against a
// board that moved: the offer has gone, or it was aimed at another captain.
// One sentence each, because four copies of one refusal are four chances
// to drift apart.
export const OFFER_ALREADY_GONE = "That offer has already gone.";
export const OFFER_FOR_ANOTHER_CAPTAIN =
  "That offer was addressed to another captain.";
// The two busy refusals the consent markets share between their wires and
// their panels: the seller already at the bench this round, and the buyer
// already under cover. One sentence each, because a panel and a wire
// teaching two phrasings of one rule is how a table learns to distrust
// the pair.
export const REFIT_ALREADY_TAKEN =
  "That captain has already taken on a refit this round.";
export const ROUND_ALREADY_COVERED = "You are already covered for this round.";
// The refusal both doors into a harbor answer with, the socket's join
// handler and the REST save route: one sentence, so a stranger knocking
// at either door hears the same thing.
export const NOT_A_HARBOR_MEMBER = "Not a member of that harbor";
// The barter rule both composing surfaces state before a post, the trade
// form on the boards and the one on a chat: the good offered and the good
// asked for cannot be the same.
export const SAME_ITEM_OFFER = "Pick two different items to barter.";
// The barter composer's own parts, shared by the same two surfaces for the
// same reason: the four fields of the form on the boards and the one on a
// chat carry one set of labels, and a label that drifted would name one
// control two things depending on where the form was opened.
export const OFFER_GIVE_LABEL = "I'll give";
export const OFFER_POST_LABEL = "🤝 Post Offer";
export const OFFER_TARGET_LABEL = "Direct this offer to a specific captain";
export const OFFER_GIVE_AMOUNT_LABEL = "Amount to offer";
export const OFFER_GIVE_ITEM_LABEL = "Item to offer";
export const OFFER_WANT_AMOUNT_LABEL = "Amount to request";
export const OFFER_WANT_ITEM_LABEL = "Item to request";
// The warning the composer shows over a draft that offers more of a good
// than the hold carries, written as a sentence rather than assembled at
// each call site so the two surfaces cannot quote different figures.
export function offerOverdrawLine(owned: number, item: string): string {
  // The good arrives as an id and reads through t() here, the same way the
  // guide's price rows read theirs, so the sentence names it in the
  // language the captain is reading.
  return t("You only have {owned} {item}.", { owned, item: t(item) });
}
// The sentence a muted captain reads, once for both surfaces that carry it:
// the composer that swaps its input for it, and the toast that answers a
// stale tab's press after the mute has landed.
export const MUTED_NOTICE =
  "The host has muted you in the harbor chat for the rest of this voyage.";
// The departure button's label, shared by the control bar and the harbor
// screen's own start button: two spellings of one action on two screens of
// one harbor is how a table learns to distrust the pair. The solo labels
// stay distinct on purpose, because a harbor of one is practicing rather
// than racing, and both screens say so.
export const START_VOYAGE = "Start the Voyage";
export const RENOWN_BONUS_LINE =
  "Each Renown level grants a small Gold bonus at the start of your next fresh voyage";
// The refusal a wire answers when the captain it was aimed at is not
// visible to the harbor. The two chat handlers and the four trading wires
// all say this one sentence, spelled the long way on purpose: the smoke
// run asserts it word for word, so the shorter form the wires drifted
// into is the one that left.
export const TARGET_NOT_IN_HARBOR = "That captain is not in this harbor.";
// The consent fee's bounds, stated once for the three wires that refuse a
// fee out of them and the one desk that hints at them. The locale is a
// parameter because the three wires answer a captain and the server's
// process reader holds no captain's language: the desk at the browser
// takes the default, the same reader it was already composing with, and
// each wire passes its own socket's.
export function consentFeeRule(locale: Locale = getLocale()): string {
  return tFor(
    locale,
    "A fee is a whole number of Gold, at least {CONSENT_FEE_MIN} and at most {CONSENT_FEE_MAX}.",
    {
      CONSENT_FEE_MIN,
      CONSENT_FEE_MAX,
    },
  );
}
// The refusal the three priced desks show before the click when the purse
// cannot cover the fee (the escort board, the refit bench and the module
// market): one sentence, because three spellings of one shortfall read as
// three rules.
export function feeShortfallLine(hold: number, fee: number): string {
  return t(
    "A fee is paid at the handshake and you hold {hold} Gold: this offer costs {fee}.",
    { hold, fee },
  );
}
// The escort desk's rule for dead offers: one sentence for the intro that is
// always drawn, the empty state and the glossary's tooltip.
export const ESCORT_OFFER_DEATH =
  "An offer nobody takes before the Parley closes is gone.";

// The escort's share rule: the guide's pirate tip and the raid screen's
// own footnote read one sentence, so the wording lives here rather than
// on either page.
export const ESCORT_SHARE_RULE =
  "The escort costs a share of whatever you're carrying that round, so it's cheapest exactly when you have the least to protect.";
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
    ? t("There is a {chanceBefore} chance.", { chanceBefore: pct(first) })
    : t(
        "There is a {chanceBefore} chance, rising to {chanceAfter} past the midpoint.",
        { chanceBefore: pct(first), chanceAfter: pct(second) },
      );
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
 * One round of a mode's briefing, read: the phase's own face, and the two
 * lines the mode says about it.
 *
 * The tutorial charts the round and the guide prints it, and both read the
 * same round, so the reading lives here rather than in each of them. A mode
 * that changes what it says about a phase changes it in one place, and
 * the chart and the guide cannot end up describing the same phase two ways.
 *
 * The words are read here rather than at each use, because the guide and
 * the tutorial are read at the moment they are drawn and the mode's own
 * words are read the same way: what a captain sees is what the record
 * says, in the language they are reading in.
 */
type BriefingStep = {
  phase: string;
  icon: string;
  label: string;
  body: string;
  setsUp: string;
};

function briefingSteps(phases: readonly BriefingPhase[]): BriefingStep[] {
  return phases.map((phase) => {
    const face = phaseFace(phase.phase);
    return {
      phase: phase.phase,
      icon: face.icon,
      label: t(face.label),
      body: t(phase.body),
      setsUp: t(phase.setsUp),
    };
  });
}

/**
 * One round, as the tutorial renders it: the mode's own briefing, in the
 * shape the mode chose to brief in.
 *
 * Which shape a mode briefs in is the record's own decision (see
 * ModeBriefing), so this renders the record rather than keeping a second
 * copy of the lap for every mode that might move it.
 *
 * The accent is the phase's own CSS variable, named after the phase, which
 * is the pairing the palette already holds for all six of them, so a round
 * added to a chart is drawn in its own color without a table of them
 * living here. Classic's line keeps the accent its cards wore.
 */
function roundStepHtml(mode: GameMode): string {
  const { briefing } = modeConfig(mode);
  if (briefing.kind === "line") {
    return t(
      '<div style="background:color-mix(in oklch, var(--gain) 12%, transparent);border-radius:6px;padding:12px;border-left:3px solid var(--gain);color:var(--foreground);line-height:1.9">{briefing.text}</div>',
      { "briefing.text": t(briefing.text) },
    );
  }
  const steps = briefingSteps(briefing.phases)
    .map((step) => {
      return `  ${t(
        '<div style="background:color-mix(in oklch, var(--w-{step.phase}) 12%, transparent);border-radius:6px;padding:10px;border-left:3px solid var(--w-{step.phase});color:var(--foreground)">\n    <strong>{face.icon} {face.label}</strong><br>\n    <span style="font-size:13px">{step.body}</span><br>\n    <span style="font-size:12px;color:var(--muted-foreground)">{step.setsUp}</span>\n  </div>',
        {
          "step.phase": step.phase,
          "face.icon": step.icon,
          "face.label": step.label,
          "step.body": step.body,
          "step.setsUp": step.setsUp,
        },
      )}`;
    })
    .join("\n");
  return t(
    '<div style="display:grid;gap:8px;margin:12px 0">\n{steps}\n</div>\n<p style="font-size:12px;color:var(--muted-foreground);margin:4px 0 0">{briefing.closes}</p>',
    { steps, "briefing.closes": t(briefing.closes) },
  );
}

/**
 * The same round the tutorial charts, as the guide prints it.
 *
 * The guide is the long surface and the tutorial is the short one, and
 * both say the same thing about the round because both read it from the
 * record: a mode that moves a phase moves both, and neither can be left
 * describing the lap of the other mode. The chart keeps its two lines per
 * round here, where there is room for them, and a mode that briefs in one
 * sentence prints the sentence, which is the shape that mode chose.
 */
function roundLines(mode: GameMode): string {
  const { briefing } = modeConfig(mode);
  if (briefing.kind === "line") return t(briefing.text);
  const steps = briefingSteps(briefing.phases).map(
    (step) => `• ${step.icon} ${step.label}: ${step.body}\n  ${step.setsUp}`,
  );
  return [...steps, t(briefing.closes)].join("\n");
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
  const items = play.differences
    .map((line) => `  <li>${t(line)}</li>`)
    .join("\n");
  return [
    {
      title: t("🧭 {play.badge}: what is different", {
        "play.badge": t(play.badge),
      }),
      content: t(
        '<p>This voyage does not play like the founding one. Here is what <strong>{play.badge}</strong> changes about it, all of it:</p>\n<ul style="padding-left:18px;line-height:1.9;font-size:14px">\n{items}\n</ul>\n<p style="font-size:12px;color:var(--muted-foreground);margin:8px 0 0">Everything else is the voyage you would sail in Classic, so everything you learn there carries over. You can read the same list any time with F1.</p>',
        { "play.badge": t(play.badge), items },
      ),
    },
  ];
}

/**
 * The path page: the deal and the five cards, for the mode whose lap opens
 * at the draft.
 *
 * ONB-1's page, and it is built rather than written: every row is a guide
 * row from ../paths (see pathGuide), so the names, the sentences and the
 * numbers on this page are the record's own, and a retuned hold or ceiling
 * changes this page, the manual's page and the draft's cards together or
 * not at all. Whether the page is drawn at all is the same fold the
 * Welcome screen names its first seat with (see openingPhase in
 * ../checkpoint): a mode or build that deals no paths draws no page rather
 * than an empty one, which is what keeps the founding voyage's tutorial
 * exactly the length it has always been.
 */
function pathSteps(mode: GameMode): TutorialStep[] {
  if (openingPhase(mode) !== "path_draft") return [];
  const rows = pathGuide()
    .map(
      (entry) =>
        `  ${t(
          '<li><strong>{entry.crest} {entry.name}</strong>: {entry.signature}<br><span style="font-size:12px;color:var(--muted-foreground)">{pathFacts}</span></li>',
          {
            "entry.crest": entry.crest,
            "entry.name": t(entry.name),
            "entry.signature": t(entry.signature),
            pathFacts: entry.facts.map(pathFactText).join(" · "),
          },
        )}`,
    )
    .join("\n");
  return [
    {
      title: t("🃏 The Path Draft: keep one card"),
      content: t(
        '<p>The voyage opens with a deal rather than a market. Three cards land face down in front of you, and at each beat you keep one and pass the rest on. What you hold when the deal ends is your path, and it sails with you to the end of the voyage. One change of papers is allowed: at a port, for a fee in Gold that grows with your Renown, the path chip in your rail offers the switch.</p>\n<p>Your path decides three things about your seat: your hold, how far your Renown can climb, and which trade orders lock to you. An order demanding a locked good can only be filled by the captain holding the path that carries it.</p>\n<ul style="padding-left:18px;line-height:1.7;font-size:14px">\n{rows}\n</ul>\n<p style="font-size:12px;color:var(--muted-foreground);margin:8px 0 0">Every card in the deal carries these numbers, so what you read here is what the table deals you.</p>',
        { rows },
      ),
    },
  ];
}

export function tutorialSteps(
  mode: GameMode,
  difficulty: Difficulty,
): TutorialStep[] {
  const cfg = difficultyConfig(difficulty);
  const rounds = voyageRoundsFor(mode, difficulty);
  // The tier's schedule is written against Classic's ladder. A mode that
  // shortens the voyage keeps only the mandates it will actually reach:
  // Ocean Gambit runs twelve rounds, so Monsoon's round sixteen mandate
  // never fires there, and a guide naming it would promise a commission
  // the voyage ends before.
  const mandates = mandateRounds(cfg).filter((round) => round <= rounds);
  const play = modeConfig(mode);
  return [
    {
      title: t("⚓ Welcome aboard"),
      content: t(
        '<p>{APP_NAME} puts you on the ancient Silk Road: one voyage of {rounds} rounds, limited Gold, and a lot of merchants trying to outmaneuver you at every port.</p>\n<p>You are sailing <strong>{play.badge}</strong>: {play.tagline}</p>\n<p>These waters are <strong>{cfg.name}</strong>: {cfg.tagline}</p>\n<p>The rules are easy to pick up, but money is tight early on and a string of bad calls compounds quickly. This covers the things that catch new captains out most.</p>\n<p style="color:var(--muted-foreground);font-size:13px">Two minutes to read. Saves a lot of frustrated restarts.</p>',
        {
          APP_NAME,
          rounds,
          "play.badge": t(play.badge),
          "play.tagline": t(play.tagline),
          "cfg.name": t(cfg.name),
          "cfg.tagline": t(cfg.tagline),
        },
      ),
    },
    {
      title: t("🏆 What you're playing for"),
      content: t(
        "<p>After {rounds} rounds, the captain with the highest Reputation wins the title of <strong>Sea Master</strong>. Reputation comes from trade profits and fulfilled orders.</p>\n<p>{play.failureRule}</p>\n<p>Starting Gold is <strong>{cfg.startingGold}</strong>. That is enough to get going, but not enough to be careless with.</p>",
        {
          rounds,
          "play.failureRule": t(play.failureRule),
          "cfg.startingGold": cfg.startingGold,
        },
      ),
    },
    {
      title: t("🔄 How a round runs"),
      content: t(
        '<p>A round is one lap of the voyage, and this voyage runs {rounds} of them. Each round walks the phases below in the order your voyage puts them:</p>\n{roundSteps}\n<p style="font-size:12px;color:var(--muted-foreground);margin:4px 0 0"><kbd style="background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px">Ctrl+N</kbd> readies you for the next phase without clicking (the harbor sails on once every captain is ready), and a voyage is one whole run of these rounds rather than a round of its own.</p>',
        { rounds, roundSteps: roundStepHtml(mode) },
      ),
    },
    ...differenceSteps(mode),
    // The deal the mode opens at, for the mode that opens at it: one page
    // for the five paths, read from the record (see pathSteps).
    ...pathSteps(mode),
    {
      title: t("🏪 Market: Buying"),
      content: t(
        '<p>The port market has Hemp, Silk, and Tea at prices that shift every round. Buy here, barter with the other captains at Parley, and fill trade orders at Orders. Which of those two stops comes first is a rule of the voyage you are sailing rather than a choice you make, and your captain\'s rail always shows the order. That is the core loop.</p>\n<p>One thing worth knowing about: the <strong>Broker</strong>. Pay a small fee for a demand whisper and a specific trade order is <em>guaranteed</em> to appear when Orders opens. Useful when you have stocked a particular good and want to make sure a buyer shows up.</p>\n<div style="background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">\n  💡 For the first two or three voyages, stick to raw materials. You can fill an order with them the same round you buy them. No waiting and no risk.\n</div>',
      ),
    },
    {
      title: t("🤝 Parley: Bartering"),
      content: t(
        '<p>The Parley is a short window where captains trade directly with each other instead of through the market. Post an offer, like Hemp you don\'t need for Silk you do, and any other captain in the harbor can take it with one click.</p>\n<p>Where it falls in the round is set by the voyage you are sailing rather than changing from round to round: {MODES.classic.badge} runs it right after Market, and {MODES.ocean_gambit.badge} runs it right after Orders, and your captain\'s rail always shows which. Either way, it is the easiest way to recover from a bad draw. All Tea and no Silk, with a Sachet order already on the board? Someone else in the harbor has probably drawn the opposite problem.</p>\n<div style="background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">\n  A few ground rules: you can\'t offer an item for itself, both amounts have to be whole numbers of at least one, and you can never offer more than you currently have. The moment you post an offer, that amount is set aside until someone takes it or you cancel it.\n</div>\n<p style="font-size:13px;color:var(--muted-foreground);margin-top:8px">Nobody has to barter. If nothing on the board interests you, or nobody is offering anything, just move on to the next phase.</p>',
        {
          "MODES.classic.badge": t(MODES.classic.badge),
          "MODES.ocean_gambit.badge": t(MODES.ocean_gambit.badge),
        },
      ),
    },
    {
      title: t("📋 Orders: Filling trade orders"),
      content:
        t(
          '<p>Trade orders appear and you match your cargo to them. Each one shows the goods needed, the reward, and the freight cost. Your take is whatever is left after fees and tax.</p>\n<p>You can fill as many orders as your cargo allows while Orders is open.</p>\n<div style="background:color-mix(in oklch, var(--intel) 14%, transparent);border:1px solid var(--intel);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">\n  📌 <strong>Finished goods</strong> ({tier0List}) pay two to three times more than raw materials. The catch is they need artisans, and the artisans deliver at Resolve. That is covered next.\n</div>\n',
          {
            tier0List: PRODUCTS_TIER0.map((x) => t(x)).join(listJoiner()),
          },
        ) +
        (mandates.length
          ? `<p style="font-size:13px;margin-top:10px">${t(
              "📜 On round{pluralS} {mandateList} the Emperor commissions a <strong>mandate</strong>: one large order at a fixed reward, and the only order exempt from VAT. It often asks for more than a single hold carries, so plan to barter or borrow to fill it.",
              {
                pluralS: mandates.length === 1 ? "" : "s",
                mandateList: mandates.join(listJoiner()),
              },
            )}</p>`
          : ""),
    },
    {
      title: t("⚠️ The artisan trap"),
      content: t(
        '<p>Artisans turn raw materials into high value finished goods and collect wages at every Resolve. That part is simple. What catches most new captains is this:</p>\n<div style="background:color-mix(in oklch, var(--alarm) 18%, transparent);border:1px solid var(--alarm);color:var(--foreground);border-radius:6px;padding:12px;margin:12px 0;text-align:center;font-size:14px;font-weight:bold;line-height:1.7">\n  Assign a task this round.<br>Wages come due at Resolve either way.\n</div>\n<p style="font-size:13px;color:var(--muted-foreground);line-height:1.6">Weavers ({weaverWage} Gold), Master Weavers ({masterWage} Gold), and Sachet Makers ({sachetWage} Gold) all charge wages <strong>every round</strong>, even when idle, so the bill comes round whether they worked or not. Only hire once you have enough Gold to cover at least two rounds of wages alongside your other bills.</p>',
        {
          weaverWage: wageOf("weaver"),
          masterWage: wageOf("master"),
          sachetWage: wageOf("sachet_maker"),
        },
      ),
    },
    {
      title: t("🏴‍☠️ Pirates at Resolve"),
      content:
        t(
          "<p>Before the bills below come due each round, the pirates roll for your ship. {raidKind} A raid takes every coin you're carrying.</p>\n<p>You get one choice before that roll happens: hire an escort for {escortShare} of your current Gold and sail through guaranteed safe, or set sail anyway and keep the Gold if the pirates don't show.</p>\n",
          { raidKind: raidCopy(cfg), escortShare: escortPct(cfg) },
        ) +
        (cfg.brokerCorruption
          ? `<p>${t("In these waters a broker can be corrupt. The whisper you buy is still true and still arrives, always, but a corrupt one also leaks your position to the pirates. The log says so plainly when it happens, and the odds you see already include it.")}</p>`
          : "") +
        t(
          '\n<div style="background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">\n  💡 {ESCORT_SHARE_RULE} Often worth it once your Gold is already low.\n</div>',
          { ESCORT_SHARE_RULE: t(ESCORT_SHARE_RULE) },
        ),
    },
    {
      title: t("Resolve: Settlement"),
      content: t(
        '<p>Once the pirates are dealt with, two bills come due:</p>\n<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0">\n  <div style="background:color-mix(in oklch, var(--w-ship) 14%, transparent);border-radius:6px;padding:10px;text-align:center;color:var(--foreground)">\n    <div style="font-size:22px;margin-bottom:4px">🔧</div>\n    <strong>Ship Maintenance Fee</strong><br>\n    <span style="font-size:12px;color:var(--muted-foreground)">{MAINTENANCE_MIN} to {MAINTENANCE_MAX} Gold each round, set by the waters you sail</span>\n  </div>\n  <div style="background:color-mix(in oklch, var(--w-market) 14%, transparent);border-radius:6px;padding:10px;text-align:center;color:var(--foreground)">\n    <div style="font-size:22px;margin-bottom:4px">👥</div>\n    <strong>Artisan Wages</strong><br>\n    <span style="font-size:12px;color:var(--muted-foreground)">{ARTISAN_WAGE_MIN} to {ARTISAN_WAGE_MAX} Gold per person per round</span>\n  </div>\n</div>\n<p style="font-size:13px;color:var(--muted-foreground)">The <strong>Dues</strong> tab of your captain\'s rail shows exactly what is owed. Check it before spending anything.</p>\n<p style="font-size:13px;color:var(--muted-foreground)">Coming up short isn\'t the end on its own. Right there on the settlement screen, you can ask another captain in the harbor for a loan, and they can send it to you on the spot if they\'ve got the Gold to spare. Just repay it before the voyage\'s last round ends, or it comes out of your Gold automatically and goes straight to them.</p>',
        {
          ARTISAN_WAGE_MIN,
          ARTISAN_WAGE_MAX,
          MAINTENANCE_MIN,
          MAINTENANCE_MAX,
        },
      ),
    },
    {
      title: t("🚢 You are ready"),
      content: t(
        '<p>Keep these points in mind as you play:</p>\n<ul style="padding-left:18px;line-height:2.1;font-size:14px">\n  <li>Start with raw material orders. Fast money, no complications.</li>\n  <li>Always keep at least <strong>30 Gold above</strong> what Resolve will cost you.</li>\n  <li>Hire artisans only when you can cover <strong>two full rounds of wages</strong>.</li>\n  <li>Dusk hull upgrades compound quickly. Do not skip them.</li>\n  <li>Caught short by pirates or a bad round? When other captains are aboard, ask the harbor for a loan before you assume the voyage is over.</li>\n  <li>Every voyage\'s final Reputation becomes Renown on your account, forever, win or lose. Check your Captain\'s Legacy any time from the Lobby.</li>\n  <li><kbd style="background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px">Ctrl+S</kbd> saves your voyage &nbsp;·&nbsp; <kbd style="background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px">F1</kbd> opens the full guide.</li>\n</ul>\n<div style="background:color-mix(in oklch, var(--gain) 14%, transparent);border:2px solid var(--gain);color:var(--foreground);border-radius:8px;padding:12px;text-align:center;margin-top:14px">\n  <strong style="font-size:15px">Good winds and good margins, Captain. ⚓</strong>\n</div>',
      ),
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
// The maintenance range the same card prints, read off the tier table the
// Resolve bill charges from. The two ends are the gentlest and harshest
// waters, so a retuned bill moves the card rather than leaving a figure
// from a previous balance pass in the guide.
const MAINTENANCE_MIN = Math.min(
  ...Object.values(DIFFICULTIES).map((d) => d.maintenance),
);
const MAINTENANCE_MAX = Math.max(
  ...Object.values(DIFFICULTIES).map((d) => d.maintenance),
);
const workerLine = (id: string, makes: string): string => {
  const w = WORKER_TYPES.find((x) => x.id === id);
  return t("• {workerLabel} ({workerWage} Gold/Round): Makes {makes}", {
    workerLabel: t(w?.label ?? id),
    workerWage: w?.wage ?? 0,
    // What the hand turns out is a phrase of its own in both languages
    // ("Linen or Cotton Clothes" is a goods line rather than a word), so
    // the calls above hand over the record's English and the read happens
    // here, where the frame around it is already being read.
    makes: t(makes),
  });
};
// The goods names arrive as the table's own English and the frame around
// each pair of figures is the pack's row, so both the name and the frame
// are read here rather than printed as they arrive; the join between
// pairs is a language fact too (listJoiner), because a Mandarin column
// separates its items with its own comma rather than an English one.
const priceRangeLine = (items: readonly string[]): string =>
  items
    .map((item) => {
      const range = basePriceRange(item);
      return range
        ? t("{item}({lowPrice} to {highPrice}💰)", {
            item: t(item),
            lowPrice: range[0],
            highPrice: range[1],
          })
        : t(item);
    })
    .join(listJoiner());

// Every row names a key the window's keydown listener in GameRoom actually
// acts on, and the guide below and the shortcut help dialog both render this
// record, so the two surfaces cannot teach different keys. A shortcut that
// does nothing has no place on a screen whose whole job is to say which
// keys do something.
export type KeyboardShortcut = {
  keys: string[];
  label: string;
  group: "Game Actions" | "Navigation" | "Help";
};

export const SHORTCUTS: KeyboardShortcut[] = [
  { keys: ["Ctrl", "S"], label: "Save game state", group: "Game Actions" },
  {
    keys: ["Ctrl", "N"],
    label: "Next phase or continue",
    group: "Game Actions",
  },
  {
    keys: ["Ctrl", "R"],
    label: "Restart voyage (host only)",
    group: "Game Actions",
  },
  { keys: ["F1"], label: "Open the full navigation guide", group: "Help" },
  { keys: ["?"], label: "Open this shortcut help", group: "Help" },
  { keys: ["F2"], label: "Open this shortcut help", group: "Help" },
  { keys: ["Esc"], label: "Close this shortcut help", group: "Navigation" },
];

function shortcutLines(): string {
  return SHORTCUTS.map((s) => `• ${s.keys.join("+")}: ${t(s.label)}`).join(
    "\n",
  );
}

export function guideText(mode: GameMode, difficulty: Difficulty): string {
  const cfg = difficultyConfig(difficulty);
  const rounds = voyageRoundsFor(mode, difficulty);
  // Only the mandates this voyage reaches, for the reason the tutorial's
  // own list gives (see tutorialSteps above): the tier's schedule is
  // written against Classic's ladder, and Ocean Gambit's twelve rounds end
  // before Monsoon's last entry.
  const mandates = mandateRounds(cfg).filter((round) => round <= rounds);
  const play = modeConfig(mode);
  // The mode's own list, printed only by a mode that has one, which is
  // what its empty array says: the founding voyage differs from itself
  // nowhere, so a heading over an empty list would be the only trace of
  // the two modes ever having been one screen. See ModeConfig.differences.
  // The heading and the lines are read at the print site like the rest of
  // this page: the record keeps the final English the smoke suites hold
  // it to, and each line answers in Mandarin when the reader is, so a
  // difference the pack does not carry prints itself rather than leaving
  // a hole in the column (the row guard is suite 20's).
  const changes = play.differences.length
    ? `\n${t("🎲 How {play.badge} Differs From {MODES.classic.badge}:", {
        "play.badge": t(play.badge),
        "MODES.classic.badge": t(MODES.classic.badge),
      })}\n${play.differences.map((line) => `• ${t(line)}`).join("\n")}\n`
    : "";
  return `${t("⚓ {APP_NAME}: Rules", { APP_NAME })}

${t("🌊 These Waters: {cfg.icon} {cfg.name}", {
  "cfg.icon": cfg.icon,
  "cfg.name": t(cfg.name),
})}
${t(cfg.summary)}

${t("🧭 This Voyage: {play.badge}", { "play.badge": t(play.badge) })}
${t(play.tagline)}
${changes}
${t("🚢 Objective:\nSail one voyage of {rounds} rounds, and finish it with the highest Reputation in the harbor.", { rounds })}

${t("⚖️ If Your Books Fail:")}
${t(play.failureRule)}

${t("📦 Goods System:")}
${t("Raw Materials: {rawPrices}", {
  rawPrices: priceRangeLine(RESOURCES_TIER0),
})}
${t("Finished Goods: {productPrices}", {
  productPrices: priceRangeLine(PRODUCTS_TIER0),
})}

${t("👥 Artisan System:")}
${workerLine("weaver", "Linen or Cotton Clothes")}
${workerLine("master", "Linen, Cotton or Brocade")}
${workerLine("sachet_maker", "Sachets")}

${t("🧾 Tax System:")}
${t("• VAT: {vatPct}% on finished product profit margin", {
  vatPct: Math.round(VAT_RATE * 100),
})}
${t(
  "• Income Tax: {incomeTaxPct}% on your net profit for the round, charged at Resolve after everything else is paid",
  {
    incomeTaxPct: Math.round(INCOME_TAX_RATE * 100),
  },
)}

${t("🔮 Broker's Whisper:")}
${t('• Market: Click "Broker\'s Whisper Board" to open the window')}
${t("• Spend {INTEL_COST} Gold to buy a Broker's Whisper about Orders demand", {
  INTEL_COST,
})}
${t("• Each revealed whisper guarantees a matching order will appear")}
${t("• A whisper is always true and always delivered, on every tier")}${
    cfg.brokerCorruption
      ? `\n${t("• Here a broker may still be corrupt: you get the true whisper, but your position leaks and this round's raid risk rises, and the log tells you when")}`
      : ""
  }

${t("🤝 Parley (Bartering):")}
${t("• Trade directly with the other captains in your harbor while the Parley is open, whether it falls before or after Orders on your voyage")}
${t("• Post what you have and what you want for it; anyone can accept it with one click")}
${t("• An offer can't be an item for itself, and both amounts must be whole numbers of at least 1")}
${t("• You can never offer more than you currently own, it's set aside the moment you post, and returned to you if you cancel or nobody takes it")}
${t('• Want to make sure a specific captain gets your offer, not whoever clicks fastest? Pick their name under "With" when you post: only the two of you will ever see it')}

${t("🔧 Modules:")}
${t("• Dusk: Upgrade your hull to unlock Module Slots")}
${t("• Draft powerful modules to create unique synergies")}
${t("• Swap modules to adapt to your current voyage!")}

${t("🏴‍☠️ Pirates and Escorts:")}
${t("• Resolve: {raidKind} Pirates take every Gold coin you carry.", {
  raidKind: raidCopy(cfg),
})}
${t("• Hire an escort for {escortShare} of current Gold to sail safe", {
  escortShare: escortPct(cfg),
})}
${t("• Decide before the pirate roll happens that round")}${
    mandates.length
      ? `\n\n${t("📜 Imperial Mandates:")}\n${t("• On round{pluralS} {mandateList} the Emperor commissions one large order at a fixed reward", { pluralS: mandates.length === 1 ? "" : "s", mandateList: mandates.join(listJoiner()) })}\n${t("• A mandate is the only order exempt from VAT")}\n${t("• Every captain in the harbor is dealt the same mandate, so it is a race")}`
      : ""
  }

${t("📣 Word on the Docks:")}
${t(
  "• Whichever captain is first in the harbor to complete {WORD_ON_THE_DOCKS_THRESHOLD} trade orders total this voyage wins {WORD_ON_THE_DOCKS_REWARD} Gold on the spot",
  {
    WORD_ON_THE_DOCKS_THRESHOLD,
    WORD_ON_THE_DOCKS_REWARD,
  },
)}
${t("• It's a race against the rest of the harbor, not a scheduled event: it can land on any round, for any captain")}
${t("• Announced to the whole harbor the moment it's won, same as any other harbor wide milestone")}

${t("🌊 Tidewatch Alerts:")}
${t(
  "• Once everyone in the harbor's own Reputation adds up past {TIDEWATCH_SURGE_THRESHOLD}, the harbor takes notice of a bustling crew",
  {
    TIDEWATCH_SURGE_THRESHOLD,
  },
)}
${t("• From the next Port Purchase onward, every captain's board gets one extra cargo lot, for the rest of the voyage")}
${t("• This never changes your voyage length or which tier's goods you see, only how busy the market gets")}

${t("⚓ Ventures:")}
${t("• Found on the Dues tab of your captain's rail: any captain can post a venture, a Gold target and a deadline round")}
${t("• Anyone in the harbor, including the poster, can chip in Gold toward that target at any time before the deadline")}
${t(
  "• Reach the target in time and it fills: every contributor is paid back {payoutPct}% more Gold than they put in, split in exact proportion to their share",
  {
    payoutPct: Math.round((CONVOY_VENTURE_PAYOUT_MULTIPLIER - 1) * 100),
  },
)}
${t(
  "• Miss the deadline and it fails: every contributor only gets back {refundPct}% of their own stake, the rest is lost",
  {
    refundPct: Math.round(CONVOY_VENTURE_FAILURE_REFUND_RATE * 100),
  },
)}
${t("• Contributing is a real wager on the rest of the harbor coming through, not a free favor")}
${t("• Your whole harbor only ever gets one filled venture per voyage: the moment any venture fills, every other open venture is canceled and fully refunded, and posting a new one is disabled until the next voyage")}
${t("• A deadline can never land on your voyage's final round: it always leaves at least one full round afterward to actually spend whatever you're paid")}
${t(
  "• No single captain can ever fund more than {maxShare}% of a venture's target alone: it always needs at least one other captain to fund the rest before it can fill",
  {
    maxShare: Math.round(CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE * 100),
  },
)}

${t("🆘 Financial Aid:")}
${t("• Can't cover this round's wages or maintenance? When other captains are aboard, ask the harbor for a loan, right on the settlement screen")}
${t("• Any captain with enough Gold can lend it to you on the spot; it's in your hands immediately")}
${t("• Repay it any time before the voyage's last round ends, or it's taken from your Gold automatically and handed to your lender")}
${t("• Still short when the voyage finishes? That unpaid loan is what bankrupts you, not the round it was borrowed in")}
${t("• Lending Gold raises your own Reputation, scaled to how much you lent")}

${t("🛡️ Backing:")}
${t("• Every outstanding loan in your harbor is visible on the settlement screen, to everyone, not just the lender and borrower")}
${t("• A third captain can back one: pledge some of their own Gold as a safety net for the lender, escrowed the instant they pledge it")}
${t("• Only spent if the loan actually defaults, and only up to whatever was pledged; the lender still eats any shortfall past that")}
${t("• Never called on when the loan is repaid in full? The whole pledge comes back, plus a small Reputation bonus for the risk paying off")}
${t("• One backer per loan; you can't back a loan you're the lender or borrower on yourself")}

${t("Captain's Legacy:")}
${t("• Every voyage's final Reputation becomes Renown XP on your account the moment the voyage ends, win or lose")}
${t("• Renown is permanent: it survives a restart and carries into every future voyage, in any harbor, unlike Gold, cargo, and ship level")}
• ${t(RENOWN_BONUS_LINE)}
${t("• Whoever ends a voyage with the highest Reputation among everyone who reached the endgame screen is crowned Sea Master")}
${t("• Check your current Renown level, title, and Sea Master crowns any time from the Lobby")}

${t("🌊 The Round:")}
${roundLines(mode)}

${t("⌨️ Shortcuts:")}
${shortcutLines()}

${t("⚓ Bon Voyage and Good Luck!")}`;
}
