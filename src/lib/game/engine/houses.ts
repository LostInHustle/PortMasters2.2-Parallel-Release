// =====================================================================
// Great Houses.
//
// A captain's chosen House is a persistent, account level identity that
// colors a voyage without unbalancing it. Each House grants one small,
// thematic perk at the start of every fresh voyage and nothing else: no
// monthly fee, no gating, no perk that scales with Renown. The point is a
// flavorful leaning rather than a power pick, which is why every perk is
// either a one shot discount or a flat per round nudge rather than a
// multiplier on the things that compound.
//
// The three Houses map onto the three cornerstones of the voyage loop:
// Jade Pavilion rewards craft (the artisan economy), Vermilion Gate
// rewards trade (the market and cargo economy), Golden Lotus rewards risk
// (the wager economy). Captains can switch Houses between voyages from
// the Lobby; applyHousePerkAtStart runs on the next fresh start, never
// mid voyage.
//
// HouseId lives in ../legacy.ts so both the persistence layer (which
// writes the chosen House onto the CaptainLegacy row) and this module
// can read it without one importing the other. The list of them comes
// with it, so the table below is written against the list rather than
// beside it.
// =====================================================================
import { HOUSE_IDS, type HouseId } from "../legacy";
import type { GameState, HousePerks } from "../types";

// The perk flags of a captain who has pledged to no House, which is also
// what a voyage saved before any House existed should read as. Exported so
// the empty set has one definition: a field added here and forgotten in a
// hand written copy elsewhere is a crash waiting on the first captain to
// load a save from before that field, which is exactly the trap the save
// normalizer in use-game-session.ts would otherwise have to dodge by hand.
export function noHousePerks(): HousePerks {
  return {
    jadeFreeHireAvailable: false,
    vermilionExtraCard: false,
    goldenWageDiscount: false,
    goldenPirateBump: false,
  };
}

export type House = {
  id: HouseId;
  name: string;
  icon: string;
  motto: string;
  // One sentence, plain language. Shown on the Lobby's House picker and
  // the Legacy card. No dashes; natural speech only.
  perk: string;
  /**
   * The palette token this House wears.
   *
   * The token is a House fact rather than a string each place that draws
   * one carries: the crest, the tint and the bar are all built from it,
   * and the palette's own check reads the same list, so a House the
   * palette has not been told about is a House nobody can draw, rather
   * than a House that quietly falls back to a color nobody chose.
   */
  token: string;
};

// A House as the table holds it: the public record of the House, plus the
// flags it sets on a fresh voyage.
//
// The flags sit beside the House they belong to rather than in a list of
// their own, so a House's one line and the behavior behind it are read in
// one place. A House whose line says it hires free while its flags say
// something else is a House whose name and behavior disagree, and the two
// can only disagree here.
type HouseEntry = Omit<House, "id"> & {
  // The flags this House sets. A flag the House does not set is left off
  // rather than written false, so the table names only what a House
  // changes and the empty set is spelled once, in noHousePerks.
  perks?: Partial<HousePerks>;
};

// The House table, keyed by the id the list above names. The key is the
// whole point: a House the list knows and this table does not is a
// compile error, and a House this table knows and the list does not is
// one too, so the two cannot drift apart the way a pair of hand written
// lists can.
const HOUSE_TABLE: { [K in HouseId]: HouseEntry } = {
  jade_pavilion: {
    name: "Jade Pavilion",
    icon: "🪷",
    motto: "Patience polishes the stone.",
    perk: "Your first artisan each voyage joins at no cost: the first wage is on the House.",
    token: "house-jade",
    perks: { jadeFreeHireAvailable: true },
  },
  vermilion_gate: {
    name: "Vermilion Gate",
    icon: "🏮",
    motto: "The gate is open to every cargo.",
    perk: "One more cargo lot joins your Port Purchase board, every round.",
    token: "house-vermilion",
    perks: { vermilionExtraCard: true },
  },
  golden_lotus: {
    name: "Golden Lotus",
    icon: "🏵️",
    motto: "Fortune favors the bold wager.",
    perk: "Wages cost 20% less, but pirate raids strike 5% more often.",
    token: "house-lotus",
    perks: { goldenWageDiscount: true, goldenPirateBump: true },
  },
};

// The Houses in the order the list above names them, which is the order
// the standings and the leaderboard read them in. The flags are not part
// of a House the way the name and the crest are: they are how a voyage
// behaves, and the voyage is not what the standings and the leaderboard
// read. So the public House keeps the shape it has always had, and the
// flags are reached through the table the voyages read.
export const HOUSES: House[] = HOUSE_IDS.map((id) => {
  const { perks: _perks, ...house } = HOUSE_TABLE[id];
  return { id, ...house };
});

/**
 * The palette token each House wears, by House.
 *
 * The same list the House table carries, shaped for the callers that
 * want one token rather than a whole House: the palette's own check reads
 * it to learn which tokens are meaning colors rather than chrome, and
 * the screens that draw a House build their classes from it, so the
 * color a House wears is named once rather than spelled out in each
 * place that draws it.
 */
export const HOUSE_TOKENS: Record<HouseId, string> = Object.fromEntries(
  HOUSE_IDS.map((id) => [id, HOUSE_TABLE[id].token] as const),
) as Record<HouseId, string>;

// Applied once, at the head of createInitialGameState (or restartGame,
// which delegates to it), before the first Boon draft and before the
// first market is rolled. Stamps the chosen House onto the state and
// flips the per voyage perk flags the rest of the engine reads.
//
// The perk flags live on state.housePerks (a dedicated sub object) rather
// than on state.modifierFlags, for two reasons: the ModifierKey union is
// pinned to the Boon and module set, so a House key would have to be
// wedged into that union; and endRound resets modifierFlags wholesale at
// the end of every round, which would sweep a per voyage House perk away
// the first time it fired. housePerks is reset only by a fresh voyage.
//
// Jade Pavilion's free first artisan is consumed by hireWorker the first
// time it runs after this; Vermilion Gate's extra card is read by
// startMarket; Golden Lotus's wage discount stacks with hire_discount in
// getHireCost, and its pirate bump stacks with the broker corruption leak
// in resolvePirateAttack. None of those modules import this one: they
// read the flags straight off the state.
export function applyHousePerkAtStart(
  state: GameState,
  houseId: HouseId | null,
): void {
  state.houseId = houseId;
  // The flags come from the table rather than from a comparison per flag,
  // so a House and its behavior are one record: a House added to the
  // table with a flag of its own is live the moment it lands, and a flag
  // written here has no House to belong to.
  //
  // The spread builds a fresh object on every voyage, which matters
  // because the flags are written to rather than only read: hireWorker
  // spends Jade Pavilion's free first hire by clearing its flag, and a
  // flag handed out by reference would spend the perk for every captain
  // who ever chose that House.
  state.housePerks = {
    ...noHousePerks(),
    ...(houseId ? HOUSE_TABLE[houseId].perks : undefined),
  };
}
