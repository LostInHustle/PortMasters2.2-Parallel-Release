// Heals a voyage that came back off the server. The answer was written by a
// client, possibly under an older build, so every field gets a shape before
// first render and nothing here invents a run a captain did not play. Mode is
// resolved before its dependants; the authoritative sources are applied last.

import {
  normalizeInventory,
  normalizeLoans,
  normalizeWorkerRoster,
  type GameState,
} from "@/lib/game/types";
import {
  normalizeBargeState,
  normalizeConsentLedger,
  normalizeEscortState,
  normalizeModuleTradeState,
  normalizeOpportunistBorrows,
  normalizeRefitState,
  normalizeRumorLean,
  noHousePerks,
  reconcileModulePenalties,
} from "@/lib/game/engine";
import { normalizeOrderFills } from "@/lib/game/audit";
import { cardById, cardRunsInMode, normalizeCardTally } from "@/lib/game/cards";
import type { CardRecord } from "@/lib/game/constants/cards";
import { normalizeCharter, normalizeHeldBoons } from "@/lib/game/held-cards";
import {
  normalizeMilestoneOffers,
  normalizeMilestonesAnswered,
} from "@/lib/game/milestones";
import {
  difficultyConfig,
  normalizeDifficulty,
  type Difficulty,
} from "@/lib/game/difficulty";
import {
  MAX_SHIP_LEVEL,
  SHIP_UPGRADE_LADDER,
} from "@/lib/game/constants/ships";
import { normalizeMode, type GameMode } from "@/lib/game/mode";
import { normalizePortShift } from "@/lib/game/maroon";
import { normalizeLarder, normalizeLarderFedRound } from "@/lib/game/larder";
import {
  larderMeals,
  normalizeLarderLots,
  normalizeLarderSpoilRound,
} from "@/lib/game/foods";
import { healCrewIdentity } from "@/lib/game/crew";
import {
  normalizeGarments,
  normalizeGarmentsTickRound,
} from "@/lib/game/garments";
import { normalizeStandingOrders } from "@/lib/game/standing";
import { normalizePath } from "@/lib/game/paths";
import { normalizePathSwitchRound } from "@/lib/game/draft";
import { normalizePhase } from "@/lib/game/phases";

// What the harbor and the account answered at load time, which the heal
// cannot read out of the blob itself.
type LoadedSaveFacts = {
  // The harbor's live answer and the lobby's earlier hint, which may differ.
  apiMode?: GameMode;
  roomMode?: GameMode;
  roomDifficulty?: Difficulty;
  // The captain's Renown from the legacy row, or null when that row could
  // not be read. Null is not evidence of no Renown, so the save's own value
  // stands instead.
  legacyRenownLevel: number | null;
};

// Every field of a loaded voyage, healed in place.
export function healLoadedVoyage(
  game: GameState,
  facts: LoadedSaveFacts,
): void {
  // Resolved once with the harbor's authority: three heals below are mode
  // shaped (the hull, the held boons and the hold ceiling), and resolving it
  // once keeps them from disagreeing.
  const mode = normalizeMode(facts.apiMode ?? facts.roomMode ?? game.mode);
  healSaveCollections(game, mode);
  healCommissionAndHold(game);
  healVoyageTallies(game, mode);
  healMarksAndLeans(game);
  // A legacy phase token or one this build does not know would wedge the
  // table behind one captain's old save. normalizePhase answers the token's
  // own phase or the entry phase; a live screen passes through untouched.
  game.phase = normalizePhase(game.phase);
  // A save from before the Larder carries no provisions, and lands on a full
  // hold with a round no voyage has, so the first Dawn after loading is the
  // crew's first meal. The ceiling trimmed to is the mode's.
  healProvisions(game, mode);
  // The roster's faces and the voyage's own tally of losses. Kept out of
  // normalizeWorkerRoster above because the draw lives in the crew module,
  // which reads the types module, so the types module cannot call it.
  healCrewIdentity(game);
  healWardrobe(game);
  healPapers(game);
  healConsentBoards(game);
  // A voyage from before the Supply Barge loads as a captain who has never
  // bought from it, so the vendor's first round is full rather than spent.
  normalizeBargeState(game);
  refreshVoyageFacts(game, facts);
  // After the facts above: the fixed cost falls back to the settled tier's
  // maintenance, and the penalties are read back off the healed hull.
  healShipLedger(game);
}

// The collections and perk set a save may predate entirely.
function healSaveCollections(game: GameState, mode: GameState["mode"]): void {
  // Ensure required arrays exist (back compat).
  game.purchasedCards = game.purchasedCards ?? [];
  game.completedOrders = game.completedOrders ?? [];
  game.resourceCards = game.resourceCards ?? [];
  game.customerCards = game.customerCards ?? [];
  // The hull stores whole records, and a save from before the card record
  // carries the old module shape, which has no strings table. See healHull.
  game.equippedModules = healHull(
    (game as unknown as { equippedModules?: unknown }).equippedModules,
    mode,
  );
  // Fills in worker types the save predates, and reads pre-charter saves
  // that still carried separate weavers / masterWeavers / sachetMakers.
  game.workers = normalizeWorkerRoster(
    (game as unknown as { workers?: unknown }).workers,
    game as unknown as {
      weavers?: GameState["workers"]["weaver"];
      masterWeavers?: GameState["workers"]["master"];
      sachetMakers?: GameState["workers"]["sachet_maker"];
    },
  );
  // The banner and the market read .item and .port off each entry, so a null
  // or partial record is damage and is dropped rather than rendered.
  game.revealedIntel = (game.revealedIntel ?? []).filter((entry) => {
    const w = entry as unknown as Record<string, unknown> | null;
    return (
      w !== null &&
      typeof w === "object" &&
      typeof w.item === "string" &&
      typeof w.port === "string"
    );
  });
  // An old save carries this under its old name; it heals under the current
  // name and the legacy key is dropped.
  const legacyDemand = (game as unknown as { phase2DemandTags?: string[] })
    .phase2DemandTags;
  game.marketDemandTags = game.marketDemandTags ?? legacyDemand ?? [];
  delete (game as unknown as { phase2DemandTags?: string[] }).phase2DemandTags;
  game.modifierFlags = game.modifierFlags ?? {};
  // Wages, markets and pirates read the perk set. houseId is left as
  // recorded: a pledge applies to the next voyage, never mid voyage.
  game.housePerks = game.housePerks ?? noHousePerks();
  game.houseId = game.houseId ?? null;
  game.priceHistory = game.priceHistory ?? {};
}

// The hull, healed through the pool. Unknown ids, strings and nulls are
// damage and are dropped; duplicates are kept one entry per copy, which the
// sell and swap flows read. A module the current mode does not run is
// dropped, so a Gambit save rejoined in a Classic room loses it.
function healHull(raw: unknown, mode: GameState["mode"]): CardRecord[] {
  if (!Array.isArray(raw)) return [];
  const hull: CardRecord[] = [];
  for (const item of raw) {
    const id =
      item !== null && typeof item === "object"
        ? (item as Record<string, unknown>).id
        : null;
    const card = typeof id === "string" ? cardById(id) : null;
    if (card === null || card.kind !== "module") continue;
    if (!cardRunsInMode(card, mode)) continue;
    hull.push(card);
  }
  return hull;
}

// The fleet commission, the manifest audit and the hold.
function healCommissionAndHold(game: GameState): void {
  // The panel and the harbor report both read these fields.
  game.objectiveDelivered = game.objectiveDelivered ?? {};
  game.objectiveTrace = game.objectiveTrace ?? [];
  // The engine pushes unconditionally, so an old save without this array
  // would throw on the first order filled. The normalizer also bounds it.
  game.orderFills = normalizeOrderFills(game.orderFills);
  // Gives every good a key and scrubs NaN from old saves, where JSON stored
  // it as null.
  game.inventory = normalizeInventory(game.inventory);
}

// The counters a voyage accumulates and the engine reads unconditionally.
function healVoyageTallies(game: GameState, mode: GameState["mode"]): void {
  game.boonChoices = game.boonChoices ?? [];
  // A normalizer, not a coalesce: the tally is read as a measurement, and a
  // stale card id must not print nameless.
  game.cardTally = normalizeCardTally(game.cardTally);
  // Held boons, queued moments and their marks. Retired ids, cards the mode
  // does not run and unknown moments are dropped. The flags are rebuilt at
  // the next write (see endRound and applyBoon), so drift cannot last long.
  game.heldBoons = normalizeHeldBoons(game.heldBoons, mode);
  game.milestoneOffers = normalizeMilestoneOffers(game.milestoneOffers);
  game.milestonesAnswered = normalizeMilestonesAnswered(
    game.milestonesAnswered,
  );
  // A charter reverts with the pool: an id the pool cannot answer or one
  // that is not a charter becomes null, and its flags rebuild next write.
  game.charter = normalizeCharter(game.charter, mode);
  // The last boon decision, carried as presence only: it records a pick, not
  // a value any rule reads, so there is nothing to scrub.
  game.boonRecord = game.boonRecord ?? null;
  // These gates record that a beat ran, so a truthy damaged value keeps the
  // gate closed. Reopening one would replay a settled beat; a wrongly closed
  // gate only costs an option the next round returns.
  game.boonSwapUsed = game.boonSwapUsed ?? false;
  game.moduleSwapUsed = game.moduleSwapUsed ?? false;
  game.pirateAttackResolved = game.pirateAttackResolved ?? false;
  game.escortHired = game.escortHired ?? false;
  game.brokerTippedPirates = game.brokerTippedPirates ?? false;
  // Both lists are walked with arithmetic at the last round's end, so a
  // damaged entry would carry NaN into the purse.
  game.debts = normalizeLoans(game.debts);
  game.loansGiven = normalizeLoans(game.loansGiven);
  // A running maximum folded with Math.max, which would hold NaN for the
  // rest of the voyage if the key were missing.
  game.largestTrade =
    typeof game.largestTrade === "number" && Number.isFinite(game.largestTrade)
      ? game.largestTrade
      : 0;
}

// The marks a failed voyage leaves and the leans on the market. Marks read
// strictly so damage cannot read as a verdict; leans go through their
// readers because a damaged lean would price a market.
function healMarksAndLeans(game: GameState): void {
  // Anything not exactly true is not a failure, so a truthy string cannot
  // reach the verdict or the Harbormaster's power.
  game.bankrupt = game.bankrupt === true;
  game.marooned = game.marooned === true;
  // The endgame reads this when the closing rank is dealt, so damage would
  // decide a captain's ranking. Not exactly true is not a default.
  game.defaultedDebt = game.defaultedDebt === true;
  // The same normalizer the server validates against, so pricing never sees
  // a port or direction that does not exist.
  game.portShift = normalizePortShift(game.portShift);
  // Read by a pricing function, so a damaged lean would price a market. An
  // old save heals to no lean, the market before the bazaar existed.
  game.bazaarLean = normalizeRumorLean(game.bazaarLean);
  // Read unconditionally when a seat is played, so an old save would hand
  // the evaluation undefined. The normalizer answers the default set.
  game.standingOrders = normalizeStandingOrders(game.standingOrders);
}

function healProvisions(game: GameState, saveMode: GameMode): void {
  game.larder = normalizeLarder(game.larder, saveMode);
  game.larderFedRound = normalizeLarderFedRound(game.larderFedRound);
  // A save from before the pantry lands on the one lot the old number was,
  // and an unknown lot is dropped rather than eaten. The lots are the more
  // specific fact, so the count follows the account; with no account, the
  // number stands. Nothing here can invent food.
  game.larderLots = normalizeLarderLots(game.larderLots, game.larder);
  game.larder = larderMeals(game);
  game.larderSpoilRound = normalizeLarderSpoilRound(game.larderSpoilRound);
}

function healWardrobe(game: GameState): void {
  // An old save lands on an empty wardrobe and an unknown garment is dropped
  // rather than worn. A damaged stamp lands on a round no voyage has.
  game.garments = normalizeGarments(game.garments);
  game.garmentsTickRound = normalizeGarmentsTickRound(game.garmentsTickRound);
}

function healPapers(game: GameState): void {
  // A hand written file or a retired path lands on a captain who never drew,
  // the ordinary table. The membership test also rejects "constructor".
  game.path = normalizePath(game.path);
  // Nonsense where the stamp belongs must read as "not switched": the other
  // direction costs an innocent captain their one switch for the voyage. A
  // save from before the round vocabulary carries the stamp under the older
  // key, so both spellings are read.
  const legacy = game as unknown as { pathSwitchLeg?: unknown };
  game.pathSwitchRound = normalizePathSwitchRound(
    game.pathSwitchRound ?? legacy.pathSwitchLeg,
  );
}

function healConsentBoards(game: GameState): void {
  // Counts are floored like every other tally: undefined becomes NaN, and a
  // NaN score reads as forged to the Ledger Integrity Pass.
  //
  // The ledger stops a reload between an agreement and its Gold from moving
  // the Gold twice, so the previous build's field name has to be read rather
  // than dropped. The cast is that old spelling.
  normalizeConsentLedger(
    game,
    game as unknown as {
      escortSettled?: unknown;
      escortSettledRound?: unknown;
    },
  );
  normalizeEscortState(game);
  normalizeRefitState(game);
  // The trade's tally and per module ledger; a stale save carries neither,
  // so its reader answers empty and the first sale writes the first entry.
  normalizeModuleTradeState(game);
}

// The hull's own ledger. Each number is written at creation and read
// subtractively after, so damage here does not look wrong, it prices wrong:
// the upgrade row runs money minus NaN and maintenance carries NaN into the
// purse. Penalties are recomputed from the hull because one shipped build
// wrote both directions. Runs after refreshVoyageFacts for the tier.
function healShipLedger(game: GameState): void {
  if (!Number.isFinite(game.fixedCost)) {
    game.fixedCost = difficultyConfig(game.difficulty).maintenance;
  }
  // Healed against the canonical ladder; entries past the top are dropped.
  game.shipUpgradeCost = SHIP_UPGRADE_LADDER.map((fee, i) => {
    const held = game.shipUpgradeCost?.[i];
    return typeof held === "number" && Number.isFinite(held) ? held : fee;
  });
  // The count of upgrades taken, on a ladder of MAX_SHIP_LEVEL steps. Any
  // value off the ladder reads as no upgrades at all.
  const level = game.shipLevel;
  game.shipLevel = Number.isFinite(level)
    ? Math.min(MAX_SHIP_LEVEL, Math.max(0, Math.trunc(level)))
    : 0;
  reconcileModulePenalties(game);
}

// The facts from outside the save, applied last so that they win.
function refreshVoyageFacts(game: GameState, facts: LoadedSaveFacts): void {
  // A captain who leveled up since this voyage was saved gets the current
  // unlocks; the saved value, then 1, covers a missing legacy row.
  game.renownLevel = facts.legacyRenownLevel ?? game.renownLevel ?? 1;
  game.brokersFavorUsed = game.brokersFavorUsed ?? false;
  // An undefined borrow counter is NaN the first time one is spent. The
  // module's own reader also rejects fractions and negatives.
  game.opportunistBorrows = normalizeOpportunistBorrows(
    game.opportunistBorrows,
  );
  // Cumulative tallies read on the closing sheet. Undefined would become NaN
  // on the first write, which reads as forged to the Ledger Integrity Pass.
  game.helperReputationEarned = game.helperReputationEarned ?? 0;
  game.peerTradeProfit = game.peerTradeProfit ?? 0;
  game.boonGoldEarned = game.boonGoldEarned ?? 0;
  game.wagesPaid = game.wagesPaid ?? 0;
  game.maintenancePaid = game.maintenancePaid ?? 0;
  game.finesPaid = game.finesPaid ?? 0;
  // Old saves predate per voyage seeding. Their generated cards restore from
  // the blob untouched, so only a future round would reseed.
  game.voyageEpoch = game.voyageEpoch ?? 0;
  // The harbor is authoritative for the tier.
  game.difficulty = normalizeDifficulty(
    facts.roomDifficulty ?? game.difficulty,
  );
  // Mode decides the phase order. A save restored under a mode the harbor is
  // not keeping would run the right phases in the wrong order and silently
  // desynchronize, so the harbor wins; the hint covers a response without it.
  game.mode = normalizeMode(facts.apiMode ?? facts.roomMode ?? game.mode);
}
