// Game modes. A mode is a harbor property: the host picks it once and every
// captain resolves the same record. It decides phase order and what a failed
// seat costs; difficulty only decides how hard the voyage is.

import { difficultyConfig } from "./difficulty";
import { AUDIT_FROM_ROUND, AUDIT_REVEAL_COUNT, AUDIT_WINDOW } from "./audit";
import { PORT_SHIFT_PERCENT, MAROON_VOTE_SHARE } from "./maroon";
import { getLocale, tFor, type Locale, type Params } from "./i18n";
import type { RoundPhase, Phase } from "./types";

export type GameMode = "classic" | "ocean_gambit";

export const DEFAULT_MODE: GameMode = "classic";
// One phase of a round as briefed before the voyage begins. phase ties the
// chart to the mode's lap. The phase's name, glyph, and color live with the
// phase (./phases.ts), so the two cannot call one phase by different names.
export interface BriefingPhase {
  phase: RoundPhase;
  // What happens here, and what it decides for the phases after it.
  body: string;
  setsUp: string;
}

// One way a mode differs from the founding voyage.
//
// The sentence is a template with braced tokens, and the figures it quotes
// ride beside it rather than being baked into the English. A rule constant
// that moves then moves the number a captain reads, and the pack's row
// still answers because the template itself never changed. `phrases`
// carries a token whose value is a phrase with a row of its own, so the
// words arrive translated rather than as the English the rule stores.
interface ModeDifference {
  readonly text: string;
  readonly params?: Params;
  readonly phrases?: Readonly<Record<string, string>>;
}

// How a mode describes its round on the Welcome screen. Classic uses a line;
// Gambit uses a chart because its whole argument is an order.
type ModeBriefing =
  | { kind: "line"; text: string }
  | { kind: "flow"; phases: readonly BriefingPhase[]; closes: string };

interface ModeConfig {
  // Display metadata read by the voyage and harbor cards.
  badge: string;
  icon: string;
  tagline: string;
  summary: string;

  // The mode's description in the captain's terms. Kept here so a mode cannot
  // brief its crew on another mode's order, and so every surface that teaches
  // a mode reads the same words. The round count is written inside the briefing
  // and nowhere else; a second count is the copy that rots.
  briefing: ModeBriefing;

  // What a failed seat costs, printed by the tutorial, guide, and lobby manual.
  // This sentence must agree with bankruptcyIsFinal and maroonFrom.
  failureRule: string;

  // Ways this mode differs from the founding voyage, in the captain's words.
  // Empty on Classic, which is what the others differ from.
  differences: readonly ModeDifference[];

  // Flags a mode still being built; the interface warns wherever it is selectable.
  experimental: boolean;

  // Requires the harbor unlock phrase (see src/lib/unlock.ts). Separate from
  // experimental: a sealed mode can be finished, and an unfinished one can be open.
  sealed: boolean;

  // The synchronized lap for this mode. Only these phases are gated behind the
  // harbor ready check; personal substates and terminal states never are. Rank
  // is index times lap length, so ranks are meaningful only within one mode.
  // Both modes run the same six phases, differing only in where Orders sits.
  checkpointPhaseOrder: readonly Phase[];

  // Whether a failed seat is finished with the voyage. Classic ends at the
  // bankruptcy screen; Gambit keeps the seat and marks it bankrupt instead.
  bankruptcyIsFinal: boolean;

  // First round the harbor may vote a captain ashore, or null if never. Separate
  // from bankruptcyIsFinal: keeping a failed seat need not hand out a weapon.
  maroonFrom: number | null;

  // First round the harbor may open a captain's manifest, or null if never.
  // Null keeps the audit entirely out of Classic.
  auditFrom: number | null;

  // Boundary for every system added after the frozen release. Classic must
  // stay exactly as it shipped. ./flags checks this before its own environment
  // switches, and systems without a switch read it directly.
  gambitSystems: boolean;

  // Whether this mode's seats run on a clock. Classic stays off regardless of
  // the environment's clock scale; the scale says how fast, this says whether.
  phaseClock: boolean;

  // Whether captains keep a standing order for seats they are not at.
  standingOrders: boolean;

  // Pinned voyage length, or null to use the tier's ladder. Reconciled with
  // the tier only in voyageRoundsFor. A voyage already under way keeps the
  // length pinned in its save, while server readers see a changed value.
  voyageRounds: number | null;
}

// Gambit's two rungs, named once each so the rule and its wording cannot drift.
const GAMBIT_ROUNDS = 12;
const GAMBIT_MAROON_FROM = 9;

export const MODES: Record<GameMode, ModeConfig> = {
  classic: {
    badge: "Classic",
    icon: "⚓",
    tagline: "The harbor as it has always run.",
    summary:
      "The founding voyage. Buy the port, work the orders, trade with the table between rounds, settle, and visit the shipyard.",
    experimental: false,
    // Never sealed: the founding voyage stays open to a first visitor.
    sealed: false,
    // The rules this mode shipped with.
    bankruptcyIsFinal: true,
    maroonFrom: null,
    // The shipped mode has no audit, no clock, and no standing orders.
    auditFrom: null,
    gambitSystems: false,
    phaseClock: false,
    standingOrders: false,
    // Keep the tier's ladder: null follows the tier where a copied number
    // would stop following.
    voyageRounds: null,
    // A line, matching the Welcome screen's long-standing sentence. It is
    // written out because ./phases reads ./types, which reads this file back.
    briefing: {
      kind: "line",
      text: "🧭 Dawn: Draft a Boon → 📦 Market: Buy at Ports → 🤝 Parley: Barter → 📜 Orders: Fill Trade Orders → 💸 Resolve: Pirates, Wages & Maintenance → 🚢 Dusk: Hull Upgrade",
    },
    failureRule:
      "Fall short on the bills and the voyage is over for that captain: the bankruptcy screen is the last of it, and the standings are read without them.",
    differences: [],
    // Port market, then the trade board, then the manifest: goods are sorted
    // before the conversation. The artisan bench is inside Market.
    checkpointPhaseOrder: [
      "harbor",
      "dawn",
      "market",
      "parley",
      "orders",
      "resolve",
      "dusk",
    ],
  },
  ocean_gambit: {
    badge: "Gambit",
    // A compass rather than a wave, which Open Waters already uses.
    icon: "🧭",
    // The card carries the experimental pill, so the tagline does not repeat it.
    tagline: "Orders lock before the table opens.",
    // Roughly the length of Classic's summary; the cards are read side by side.
    summary:
      "Trade orders are committed before the social window opens, so a promise about what you are going to do can be broken invisibly.",
    experimental: true,
    // Sealed: a host needs the harbor phrase, which is a harbor setting.
    sealed: true,
    // A failed seat keeps sailing, and from the ninth round the harbor may
    // vote one ashore. Gambit pins twelve rounds on every tier (see
    // voyageRounds below), so both votes are reachable whatever the tier.
    bankruptcyIsFinal: false,
    maroonFrom: GAMBIT_MAROON_FROM,
    // Opens at the same round on every tier; the difference sentence quotes it.
    auditFrom: AUDIT_FROM_ROUND,
    // The systems of this release live here; see ./flags for the switches inside.
    gambitSystems: true,
    // Gambit is built around the clock; the shipped default leaves it off.
    phaseClock: true,
    standingOrders: true,
    // Twelve rounds on every tier, long enough for both votes to be reachable.
    voyageRounds: GAMBIT_ROUNDS,
    // The round as a chart, which is the shape the mode's argument asks for.
    // Orders wears the committing verb, and Parley names the captains, because
    // those are the phases this mode changes. Phases shared with Classic match it.
    briefing: {
      kind: "flow",
      phases: [
        {
          phase: "dawn",
          body: "Three boons are dealt to you alone each round: cheaper buying, fuller workshops, a shelter from the tax, or a loan when the purse runs thin.",
          setsUp:
            "The one you take bends this round and no other, so read the rest of the round before you choose.",
        },
        {
          phase: "market",
          body: "Load the hold at the port market and set each artisan a task. Prices shift every round, every captain is quoted their own, and wages fall due working or idle.",
          setsUp:
            "What the artisans make lands at settlement, so their work answers the next manifest rather than the one you are about to fill.",
        },
        {
          phase: "orders",
          body: "The manifest deals and you commit: goods for Gold and Reputation, and nothing on the sheet can be revised once the fleet starts talking.",
          setsUp:
            "The fleet cannot see what you committed, which cuts both ways: your round stays hidden from them, and theirs from you.",
        },
        {
          phase: "parley",
          body: "The Captain's Exchange opens. Post what you can spare and name your price, or take what another captain has already set on the table.",
          setsUp:
            "A majority of the fleet can open one captain's manifest from this table, and calling it spends the rest of the table's trading.",
        },
        {
          phase: "resolve",
          body: "Pirates roll for every coin aboard. An escort buys the safe passage for a cut of what you carry, so the fee is cheapest exactly when you have the least to protect.",
          setsUp:
            "Then the wages and the ship maintenance fee come due, and what survives the bills is what you take to the yard.",
        },
        {
          phase: "dusk",
          body: "Spend what survived: a level of hull carries another module slot and cuts the cost of every haul, and a drafted module is bolted on for good.",
          setsUp:
            "What you spend here is what the next round's port cannot be bought with.",
        },
      ],
      closes:
        "The round closes at the yard and opens again at the ports, with whatever this one left in the hold.",
    },
    // Written for a captain, so a round is a round and not a round. Every figure
    // is quoted from the rule constants (see MAROON_VOTE_SHARE).
    failureRule:
      "No captain leaves the table here. Fall short on the bills and the harbor marks it against you for the rest of the voyage, and you sail on with your card, your vote and your say at the table.",
    differences: [
      {
        text: "The manifest closes before the table opens: Orders runs ahead of Parley, so you commit to your sheet first and nothing on it can be revised once the fleet starts talking.",
      },
      {
        text: "Every voyage here runs {rounds} rounds, whatever tier you sail. That is the length the harbor's two votes are tuned to.",
        params: { rounds: GAMBIT_ROUNDS },
      },
      {
        text: "Every seat runs on a clock. When the timer runs out, the harbor moves on whether or not you have readied, and a seat you left untouched is played by the engine's defaults.",
      },
      {
        text: "Standing orders let you write that default yourself: name the boon, the goods, the hire or the order you want, and an expired seat follows your instructions instead.",
      },
      {
        text: "Every captain is dealt a private card when the voyage leaves the dock, and no one else can see it: most are Honest Captains sailing the fleet's public objective, while a table of four or more hides a Pirate in the fleet and a table of six or more may hide a Broker beside them. Every card turns face up when the voyage ends.",
      },
      {
        text: "From round {auditFrom}, a simple majority of the fleet can open one captain's manifest at a Parley. The harbor is shown {revealCount} of that captain's last {window} fills, and calling the vote spends the rest of that Parley's trading.",
        params: {
          auditFrom: AUDIT_FROM_ROUND,
          revealCount: AUDIT_REVEAL_COUNT,
          window: AUDIT_WINDOW,
        },
      },
      {
        text: "From round {maroonFrom}, {share} of the captains still sailing can vote one captain ashore, once a voyage. The ship and its hold go to the harbor, half that captain's Gold stays aboard, and they take up the Harbormaster's hand: once a round, they name a port and lean every price there {portShift} percent either way.",
        params: {
          maroonFrom: GAMBIT_MAROON_FROM,
          portShift: PORT_SHIFT_PERCENT,
        },
        phrases: { share: MAROON_VOTE_SHARE },
      },
    ],
    // Orders before Parley is the mode's structural change: commit to the
    // manifest before the table opens, so nobody can trade on known information.
    // path_draft is this mode's own opening seat; lapOrder in ./checkpoint.ts
    // folds it out when the path draft switch is off.
    checkpointPhaseOrder: [
      "harbor",
      "path_draft",
      "dawn",
      "market",
      "orders",
      "parley",
      "resolve",
      "dusk",
    ],
  },
};

// Shipped mode first so the safe choice is the one a captain sees first.
export const MODE_ORDER: readonly GameMode[] = ["classic", "ocean_gambit"];

// Unknown values (stale saves, old rooms, bad requests) fall back to Classic.
export function normalizeMode(value: unknown): GameMode {
  return value === "classic" || value === "ocean_gambit" ? value : DEFAULT_MODE;
}

export function modeConfig(value: unknown): ModeConfig {
  return MODES[normalizeMode(value)];
}

/**
 * Whether a mode carries the systems added after the frozen release. The one
 * predicate boundaries read; unknown values resolve to Classic.
 */
export function gambitSystemsOn(value: unknown): boolean {
  return modeConfig(value).gambitSystems;
}

/**
 * The first round a harbor may open a manifest, or null if never.
 */
export function auditOpensAt(value: unknown): number | null {
  return modeConfig(value).auditFrom;
}

/**
 * The mode's pinned length, or the tier's ladder. The only place the two are
 * reconciled: the lap, the Chronicle row, and the integrity ceiling all read
 * it, so they cannot disagree. Unknown values resolve to Classic and entry tier.
 */
export function voyageRoundsFor(mode: unknown, difficulty: unknown): number {
  return modeConfig(mode).voyageRounds ?? difficultyConfig(difficulty).rounds;
}

/**
 * One line of a mode's difference list, in the language on screen.
 *
 * The one reader every surface that teaches a mode goes through, so the
 * figures and the phrase fill the template the same way in the tutorial,
 * the manual and the lobby card. A phrase token is translated first and
 * lowered for the middle of a sentence, which is how "Two thirds" reads
 * there; the pack carries the phrase under its own capitalised spelling.
 */
export function readModeDifference(line: ModeDifference): string {
  return readModeDifferenceFor(getLocale(), line);
}

/**
 * The same read in a language the caller names, for the checks that walk
 * both columns. The screen's reader above is this one with the process
 * language, so a suite cannot check a rule the screen does not use.
 */
export function readModeDifferenceFor(
  locale: Locale,
  line: ModeDifference,
): string {
  const params: Params = { ...line.params };
  for (const [token, phrase] of Object.entries(line.phrases ?? {})) {
    params[token] = tFor(locale, phrase).toLowerCase();
  }
  return tFor(locale, line.text, params);
}
