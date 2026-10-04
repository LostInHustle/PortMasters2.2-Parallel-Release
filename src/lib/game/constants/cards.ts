// =====================================================================
// [F2: the card record, and the mode weighting field] The shape every
// offered card is written in, and the vocabulary the shape is spelled
// with. One record for boons, modules and charters alike, carrying the
// plan's ten fields: identifier, kind, power, tags, path weight, trigger,
// condition, effect, mode list, and both language strings (see Epic F of
// docs/OCEAN_GAMBIT_AGILE_PLAN.md).
//
// This file is the vocabulary and nothing else, the same split F1 took
// with the tags: the words live here and the walk that reads them lives
// in ./cards, so a module that wants to ask a question about a card
// imports this one and a module that wants to answer one imports that
// one. Nothing here reads a game state, a world fact or a clock.
//
//   - The identifier is a string rather than a literal union. A tag list
//     is a closed twelve and a path is a closed five, so both derive their
//     id types from their own record; a card pool is not closed, it is
//     widened in waves (F2's own iteration says to ship it small and widen
//     it), and a union of literals would be a union that every wave edits
//     by hand. What holds a card id to the pool is the registry in ./cards
//     and the clause that no two records share one, both checkable at load
//     rather than at review.
//
//   - The kind names where a card can come from, and the trigger names the
//     draft that offers it. The three kinds are the plan's three, and the
//     trigger for each is written once in CARD_TRIGGER rather than beside
//     every card: a card that arrives at the boon draft and says so in its
//     own words is a card that can disagree with its own kind.
//
//   - Power is a card's weight in the balance ledger, authored rather than
//     derived, because F7 spends it as a budget ("Every card carries a
//     power budget and a captain's total is capped") and a derived number
//     is one nobody can retune without moving a rule. The mode list is
//     what turns it into a ceiling: a mode runs a ceiling and a card above
//     that ceiling is absent from that mode's pool, which is the plan's
//     own reading of the variance problem ("the base competitive mode
//     should run lower ceilings, since there your good luck is somebody
//     else's bad evening, while Ocean Gambit can run the wild pool,
//     because the headline objective is shared").
//
//   - Both language strings are carried from the beginning, which is what
//     makes the translation pass a pass rather than a rebuild (J3: "The
//     card record in F2 carries both strings from the beginning, so this
//     goal is a translation pass rather than a structural change"). The
//     shipped language is named rather than assumed, so the day a captain
//     picks one, the pick is one value and not a second copy of the pool.
//
//   - The condition is what makes an offer fit the captain it is offered
//     to, and it is a closed list of questions the engine already knows
//     how to ask. It deliberately reads tags and roles rather than goods
//     and ids, which is F1's rule ("No effect ever names an item key")
//     applied to the offer gate as well as to the effect: a card that
//     gates on a good named in its own record is a card the tag system
//     cannot widen later.
//
//   - Path weight is the lean, not the filter, and the plan is explicit
//     that this is the point: "Path weighting is what makes an offer feel
//     like it belongs to you without locking you out of the rest of the
//     pool, so the three presented cards are drawn from a weighted pool
//     rather than a filtered one." A weight below one leans away and a
//     weight above one leans toward; there is no weight that removes a
//     card from a path, and the validator holds that line.
// =====================================================================
import type { GameMode } from "../mode";
import type { PathId } from "../paths";
import type { ModifierKey } from "../types";
import type { Tag, TagList } from "./tags";
import { MILESTONE_TRIGGERS, type MilestoneTrigger } from "./milestones";

// The three things a captain can hold that are not goods, a position or a
// crew member. The two the engine drafts are the boons and the modules; a
// charter is a card a voyage offers once at leg four, ten of them since
// F6, two for each of the five paths.
export type CardKind = "boon" | "module" | "charter";
export const CARD_KINDS: readonly CardKind[] = ["boon", "module", "charter"];

// Where a card arrives. The draft that offers it is the only moment the
// tree offered a card at all until F4, which widens this list with the
// milestone moments a boon can be drafted at ("the first pathbound
// order, crossing a Renown threshold, surviving a cold leg with zero
// frostbite, contributing to a Joint Mandate, and losing a crew member",
// see ./milestones for the five and for the one reading taken in place
// of the plan's word Renown), as the comment here promised it would: a
// value added to this union rather than a new field.
export type CardTrigger =
  "boon_draft" | "shipyard_draft" | "charter_draft" | MilestoneTrigger;

// Which trigger each kind arrives at. One map rather than a field repeated
// on every record: a boon offered at the shipyard is a card whose kind and
// whose trigger disagree, and the clause that reads this map is what makes
// that a failed build rather than a card nobody can explain.
//
// The boon entry is the round draft's trigger, and it is a default rather
// than the only one a boon may carry, which is exactly what F4 changed:
// the map answers which trigger a kind arrives at when the kind decides
// it, and a boon's trigger is the card's own field because a milestone
// boon arrives at a moment rather than at a draft. The validator reads
// the two cases apart (see the pair of clauses in ../cards).
export const CARD_TRIGGER: Record<CardKind, CardTrigger> = {
  boon: "boon_draft",
  module: "shipyard_draft",
  charter: "charter_draft",
};

// Every trigger a boon may carry: the round draft's, and the five
// moments. Written out here rather than folded into the map above,
// because the map answers for a kind and this answers for one kind's
// cards, and an author adding a sixth moment edits ./milestones alone.
export const BOON_TRIGGERS: readonly CardTrigger[] = [
  "boon_draft",
  ...MILESTONE_TRIGGERS,
];

// What has to be true of a captain for a card to be worth offering, and
// how strongly. Every arm carries the weight it answers with, and every
// arm but the first carries the weight it answers with when the question
// comes back false, so a condition is one comparison and no branching in
// the caller. A weight of zero means the card is not offered at all here,
// which is a legitimate answer for a question about what a captain holds
// (a weaving boon is nothing to a captain with no weavers) and never a
// legitimate answer for a question about who a captain is (see the path
// clause in ./cards).
export type CardCondition =
  | { kind: "always"; weight: number }
  | { kind: "gold_below"; amount: number; weight: number; otherwise: number }
  | { kind: "gold_above"; amount: number; weight: number; otherwise: number }
  | {
      kind: "holds_tag";
      tag: Tag;
      count: number;
      weight: number;
      otherwise: number;
    }
  | {
      kind: "crew_role";
      roles: readonly string[];
      weight: number;
      otherwise: number;
    };

// What a card does once it is in play. The engine has two answers today and
// the union has one arm for each, which is what keeps the pair checkable:
// a boon bends the round by writing the modifier flags, and a module bends
// the voyage by being bolted to the hull, which the engine reads by asking
// the equipped set for the module's own identifier (see hasModule). The
// hull arm therefore carries nothing and that is its honest shape rather
// than an unfinished field: a hull card's mechanism is its identifier, and
// what the arm buys is that a record claiming to be a module says so in
// the same place a boon says what it writes.
export type CardEffect =
  | { kind: "flags"; flags: Partial<Record<ModifierKey, number>> }
  | { kind: "hull" };

// The two modes, and what a card is worth in each. Zero means absent from
// that mode's pool rather than unlikely in it: a card the base mode does
// not run is a card the base mode does not offer, and the ceiling check in
// ./cards is what keeps the two halves of that statement from drifting.
export type ModeWeights = Record<GameMode, number>;

// The ceiling each mode runs. Classic is the competitive table, so it runs
// the tight one; Ocean Gambit shares its headline objective across the
// table, so it runs the wide one. Both are authored here from the start,
// which is the plan's rollback ("Keep both mode weightings authored from
// the start so switching between them is a config change").
export const MODE_POWER_CEILING: Record<GameMode, number> = {
  classic: 3,
  ocean_gambit: 5,
};

// The leaning weights a card carries when it leans nowhere, and the two
// modes it is offered in when it is offered in both. Shared, typed, and
// written once, for the reason pools.ts writes its empty list once: a bare
// literal repeated thirty times is thirty places a retune has to remember,
// and the empty lean is a value rather than an absence.
export const NO_LEAN: Partial<Record<PathId, number>> = {};
export const BOTH_MODES: ModeWeights = { classic: 1, ocean_gambit: 1 };

// The weighting a card carries when only Ocean Gambit runs it. Named
// rather than inlined because a reader should be able to tell which pool
// a card is in by reading the name rather than by comparing two numbers,
// and shared from here since it acquired its second family: the pool's
// own cards above Classic's ceiling, and F6's ten charters.
export const GAMBIT_ONLY: ModeWeights = { classic: 0, ocean_gambit: 1 };

// The card's two faces, per language. The name is what a captain reads on
// the card and in the ledger line it writes, and the description is the
// sentence under it, so both are carried together rather than in two maps
// that could arrive with a name in one language and a description in the
// other.
export type CardText = { name: string; desc: string };
export type Language = "en" | "zh";
export const LANGUAGES: readonly Language[] = ["en", "zh"];

// The language the tree prints. Named rather than implied, so J3's switch
// is a change to this line plus whatever reads it, and never a hunt for
// the places a pool was read in the wrong one.
export const SHIPPED_LANGUAGE: Language = "en";
export type CardStrings = Record<Language, CardText>;

// The record itself. Every field the plan's F2 names, in the plan's order.
export interface CardRecord {
  // The handle the engine and the save hold. Stable across a retune: a
  // card renamed for its captain keeps its id, because a standing order
  // and a saved voyage both store the id and neither is a migration.
  id: string;

  kind: CardKind;

  // How much card this is, against the ceiling its mode runs.
  power: number;

  // The glyph on the face. Language neutral, so it sits beside the strings
  // rather than inside them.
  icon: string;

  // The two tags F1 allows, and the reason an effect can say what it does
  // without naming a good.
  tags: TagList;

  // The lean toward each path, and nothing at all for a card that leans
  // nowhere. A lean of one is written as silence.
  pathWeight: Partial<Record<PathId, number>>;

  trigger: CardTrigger;

  condition: CardCondition;

  effect: CardEffect;

  modes: ModeWeights;

  strings: CardStrings;
}
