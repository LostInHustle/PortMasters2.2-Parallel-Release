// =====================================================================
// Healing a voyage that came back off the server.
//
// Whatever the room answered is a blob a client wrote, possibly under an
// older build, so every field this build reads is given a shape before the
// first render: a missing array becomes an empty one, a missing tally
// becomes zero, and a value this tree cannot account for is read as the
// absence its readers already handle. Nothing here can invent a run a
// captain did not play.
//
// The steps are grouped by the slice that added the fields, and they run in
// the order the heal has always run in: the mode's reading is taken after
// the fields it is derived from, and the two authoritative sources, the
// room and the legacy row, are applied last so that they win.
// =====================================================================

import {
  normalizeInventory,
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
} from "@/lib/game/engine";
import { normalizeOrderFills } from "@/lib/game/audit";
import { normalizeCardTally } from "@/lib/game/cards";
import { normalizeCharter, normalizeHeldBoons } from "@/lib/game/held-cards";
import {
  normalizeMilestoneOffers,
  normalizeMilestonesAnswered,
} from "@/lib/game/milestones";
import { normalizeDifficulty, type Difficulty } from "@/lib/game/difficulty";
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
import { normalizePathSwitchLeg } from "@/lib/game/draft";

// What the room and the account answered at the moment this save was
// loaded, which is everything the heal cannot read out of the blob itself.
type LoadedSaveFacts = {
  // The room's live answer and the hint the lobby carried in, which are
  // allowed to disagree: the response is the room answering a moment ago,
  // the hint is what the lobby said before the request.
  apiMode?: GameMode;
  roomMode?: GameMode;
  roomDifficulty?: Difficulty;
  // The captain's Renown as the legacy row just reported it, or null when
  // that row could not be read. A row that did not arrive is not evidence
  // of a captain with no Renown, so null leaves the save's own value
  // standing rather than demoting anyone.
  legacyRenownLevel: number | null;
};

// Every field of a loaded voyage, healed in place. The steps below are the
// slices of the game the save accumulates, each one named for the part of
// the voyage it is about.
export function healLoadedVoyage(
  game: GameState,
  facts: LoadedSaveFacts,
): void {
  healSaveCollections(game);
  healCommissionAndHold(game);
  healVoyageTallies(game);
  healMarksAndLeans(game);
  // [C1: the Larder and Short Rations] The provisions a save was
  // carrying, healed the way every other saved field is. A voyage
  // saved before this layer existed holds no Larder and no stamp, so
  // it lands on a full hold and a leg no voyage has: an old save
  // loads provisioned, and the first Dawn after it loads is the
  // crew's first meal. A damaged number heals the same way rather
  // than putting a captain on short rations for a leg nobody played.
  //
  // The ceiling this one trims to is the mode's, so the mode is
  // settled first: the save's own stamp where it carries one, and
  // the room's live answer where it does not. A save written before
  // the field existed would otherwise be healed in the founding
  // mode, and the founding mode is the one whose hold has no
  // ceiling, which would quietly trim a voyage that was sailing
  // with one (see holdCapacityOn in ./game/hold).
  const saveMode = normalizeMode(game.mode ?? facts.apiMode ?? facts.roomMode);
  healProvisions(game, saveMode);
  // [C2: crew loss by name] The roster's faces, and the voyage's
  // own tally of hungry legs and of the hands it has lost. Run
  // here rather than inside normalizeWorkerRoster above, which
  // gives the roster its shape a few lines earlier: a drawn name
  // depends on the losses, the draw lives in the crew module, and
  // the crew module reads the type module, so the type module
  // could not do this for itself without a cycle. Every reader of
  // a name sits after both calls.
  healCrewIdentity(game);
  healWardrobe(game);
  healPapers(game);
  healConsentBoards(game);
  // [E1: the Supply Barge] The vendor's per leg tally and the voyage's two
  // food counters, healed the way every other added field is. A voyage
  // saved before this feature holds none of the three, so it loads as a
  // captain who has never bought from the Barge and whose food spending
  // starts being counted now: the first leg after loading is one the
  // vendor is full for rather than one the captain reads as already spent.
  normalizeBargeState(game);
  refreshVoyageFacts(game, facts);
}

// The collections and the perk set a save may predate entirely: every one
// of these slots starts empty, so a voyage written before a slice existed
// loads as a captain who has none of it rather than as one carrying an
// undefined the first reader would trip over.
function healSaveCollections(game: GameState): void {
  // Ensure required arrays exist (back compat).
  game.purchasedCards = game.purchasedCards ?? [];
  game.completedOrders = game.completedOrders ?? [];
  game.resourceCards = game.resourceCards ?? [];
  game.customerCards = game.customerCards ?? [];
  game.equippedModules = game.equippedModules ?? [];
  // Rebuild the artisan roster defensively: fills in any type this
  // save predates, and reads a pre charter save that still carried
  // three separate weavers / masterWeavers / sachetMakers arrays.
  game.workers = normalizeWorkerRoster(
    (game as unknown as { workers?: unknown }).workers,
    game as unknown as {
      weavers?: GameState["workers"]["weaver"];
      masterWeavers?: GameState["workers"]["master"];
      sachetMakers?: GameState["workers"]["sachet_maker"];
    },
  );
  game.revealedIntel = game.revealedIntel ?? [];
  // The round's demand tags carried the market's share of an older lap
  // numbering in their name (phase2DemandTags), so a save written before
  // the rename heals under the name this build reads and the legacy key
  // is dropped rather than ridden along: one field, one name, in a fresh
  // save either way.
  const legacyDemand = (game as unknown as { phase2DemandTags?: string[] })
    .phase2DemandTags;
  game.marketDemandTags = game.marketDemandTags ?? legacyDemand ?? [];
  delete (game as unknown as { phase2DemandTags?: string[] }).phase2DemandTags;
  game.modifierFlags = game.modifierFlags ?? {};
  // A voyage saved before Great Houses existed carries no perk set
  // at all, and every wage, market and pirate path now reads one.
  // Healing it here keeps an old save loadable rather than turning
  // a missing field into a crash the first time a wage is paid.
  //
  // houseId is deliberately left as the save recorded it, not
  // refreshed from the legacy row above: a pledge made after this
  // voyage began applies to the next one, never mid voyage.
  game.housePerks = game.housePerks ?? noHousePerks();
  game.houseId = game.houseId ?? null;
  game.priceHistory = game.priceHistory ?? {};
}

// The fleet commission, the manifest audit and the hold: the three records
// a voyage's own decisions are written into, each with a normalizer of its
// own behind the missing field.
function healCommissionAndHold(game: GameState): void {
  // A voyage saved before the fleet commission existed carries
  // neither field, and both the panel and the report to the harbor
  // read them, so an unhealed save would turn a missing key into a
  // crash on the first render.
  game.objectiveDelivered = game.objectiveDelivered ?? {};
  game.objectiveTrace = game.objectiveTrace ?? [];
  // [H6: the Manifest Audit] A save written before the audit existed
  // carries no manifest, and the engine pushes onto this array
  // unconditionally, so without the heal the first order a captain
  // filled after loading an old save would throw. The normalizer
  // also bounds the list and throws away anything that could not be
  // a fulfillment, since the record is read back out to a whole
  // room rather than only by the captain who wrote it.
  game.orderFills = normalizeOrderFills(game.orderFills);
  // Guarantees a key for every catalogued good and scrubs any value a
  // pre catalogue save poisoned with NaN (stored as null by JSON), so
  // a damaged hold heals on load instead of staying broken forever.
  game.inventory = normalizeInventory(game.inventory);
}

// The counters a voyage accumulates as it is played, every one of which the
// engine reads unconditionally on the next action.
function healVoyageTallies(game: GameState): void {
  game.boonChoices = game.boonChoices ?? [];
  // [F2: the card record, and the mode weighting field] How often each card
  // was offered and how often one was taken. A voyage saved before this
  // field existed carries no tally at all, and the read is a normalizer
  // rather than a coalesce because the field is read back out as a
  // measurement: a count that is a fraction, a negative or a string is not
  // a small number, and the report would print it beside real ones. A card
  // this build does not know is dropped rather than carried, so a stale id
  // from a retired card cannot print as a nameless row.
  game.cardTally = normalizeCardTally(game.cardTally);
  // [F4: boons at milestone moments] The three fields a moment writes: the
  // boons held, the moments waiting to be answered and the mark each
  // trigger is answered to. All three heal through the pure module's own
  // readers, and that is the plan's rollback clause read as a load rule
  // ("any boon that grants a durable effect has to be unwound through the
  // same normalization path the rest of the state uses"): a held id the
  // pool no longer answers for (a retired card) and a queued moment this
  // build does not know are dropped rather than carried, and a mark keeps
  // only the shapes its trigger's units use. The flags the held boons
  // write are not rebuilt here, because every flag write rebuilds them
  // (see endRound in @/lib/game/engine/lifecycle and the merge in
  // applyBoon), so the list and the flags it rides cannot drift for longer
  // than a leg's own next write.
  game.heldBoons = normalizeHeldBoons(game.heldBoons);
  game.milestoneOffers = normalizeMilestoneOffers(game.milestoneOffers);
  game.milestonesAnswered = normalizeMilestonesAnswered(
    game.milestonesAnswered,
  );
  // [F6: charters at leg four] The voyage's one charter, healed through
  // the same pure reader the three fields above use, which is the plan's
  // rollback read as a load rule ("a charter is a modifier set on the
  // captain for the voyage, so it reverts with the pool"): an id the
  // pool no longer answers for, or one that is not a charter, drops to
  // null rather than being carried, and the flags it wrote are rebuilt
  // at the next write for the reason the boons' are (see endRound in
  // @/lib/game/engine/lifecycle).
  game.charter = normalizeCharter(game.charter);
  // [F5: public offers] The last boon decision, which a save written
  // before the ledger existed does not carry. Healed as a bare presence
  // default rather than through a normalizer, because it is the one field
  // here no rule reads: the claim hook only sends it out, and a record
  // already in a save is a fact that happened (the pick was made) rather
  // than a value a rule could be hurt by, so there is nothing to scrub.
  // An old save that heals to null simply reports nothing until the next
  // pick, which is the same screen a fresh voyage shows.
  game.boonRecord = game.boonRecord ?? null;
  game.boonSwapUsed = game.boonSwapUsed ?? false;
  game.moduleSwapUsed = game.moduleSwapUsed ?? false;
  game.pirateAttackResolved = game.pirateAttackResolved ?? false;
  game.escortHired = game.escortHired ?? false;
  game.brokerTippedPirates = game.brokerTippedPirates ?? false;
  game.debts = game.debts ?? [];
  game.loansGiven = game.loansGiven ?? [];
  game.defaultedDebt = game.defaultedDebt ?? false;
}

// The marks a failed voyage leaves and the leans a failed or a bribed
// harbor puts on the market. All three readers here are strict rather than
// coalescing, because a damaged value would otherwise be read as a verdict
// or priced into a market rather than merely looking wrong.
function healMarksAndLeans(game: GameState): void {
  // [H7: Maroon and the Harbormaster] The two marks a failed seat
  // carries, read strictly rather than coalesced: they are booleans
  // a save can only have written itself, and a damaged one would
  // read as a truthy string into the verdict and the Harbormaster's
  // power. Anything that is not exactly true is not a failure.
  game.bankrupt = game.bankrupt === true;
  game.marooned = game.marooned === true;
  // The port a Harbormaster leaned, read through the same normalizer
  // the server's own call validates against, so a save cannot hand
  // the pricing function a port that is not a port or a direction
  // that is not a direction.
  game.portShift = normalizePortShift(game.portShift);
  // [D5: Aroma: the Bazaar Rumor] The lean the market reads, healed
  // the way the shift above is and for the same reason: the bazaar's
  // lean is a client's blob like everything else in a save, and it is
  // read by a pricing function rather than by a screen, so a damaged
  // one would not look wrong, it would price a market. A save written
  // before this feature carries no field at all and heals to no lean,
  // which is the market every voyage priced before the bazaar existed.
  game.bazaarLean = normalizeRumorLean(game.bazaarLean);
  // [B3: standing orders] A voyage saved before the record existed
  // carries no set at all, and the engine reads it unconditionally
  // the moment the room's clock plays a seat, so an unhealed save
  // would hand the evaluation undefined the first time its captain
  // walked away from the table. The normalizer answers with the
  // default set, which is the shape an old save was already sailing:
  // the switch on and every seat left at the engine's own default.
  game.standingOrders = normalizeStandingOrders(game.standingOrders);
}

// The Larder, its lots and the leg it last spoiled in.
function healProvisions(game: GameState, saveMode: GameMode): void {
  game.larder = normalizeLarder(game.larder, saveMode);
  game.larderFedRound = normalizeLarderFedRound(game.larderFedRound);
  // [C4: three foods, spoilage and the split hold] What the rations
  // are, and the leg they last spoiled in. Aimed at the two shapes
  // the reads above are: a voyage saved before the pantry existed
  // lands on the one lot C1's plain number always was, a hold of
  // grain, and a lot this tree cannot account for is dropped rather
  // than eaten.
  //
  // The count is then set to what the account adds up to, and that
  // direction is the whole of the invariant (see ./foods): the lots
  // are the more specific fact, so a save whose number and account
  // disagree is read as the account, and a save with no account at
  // all is read as the number. Nothing here can invent food, which
  // is what keeps a doctored file from feeding a crew for free.
  game.larderLots = normalizeLarderLots(game.larderLots, game.larder);
  game.larder = larderMeals(game);
  game.larderSpoilRound = normalizeLarderSpoilRound(game.larderSpoilRound);
}

// The clothes a save was wearing, and the leg the settlement last read them
// in.
function healWardrobe(game: GameState): void {
  // [C3: garments and the cold] The clothes a save was wearing, and
  // the leg the settlement last read them in. Aimed at the same two
  // shapes the heal above is: a voyage saved before the layer
  // existed lands on an empty wardrobe, which is a crew with nothing
  // on, and a garment a save cannot account for is dropped rather
  // than worn. A damaged stamp lands on a leg no voyage has, so the
  // first settlement after loading reads the wardrobe rather than
  // treating the leg as one it already settled.
  game.garments = normalizeGarments(game.garments);
  game.garmentsTickRound = normalizeGarmentsTickRound(game.garmentsTickRound);
}

// The path this captain sailed and the leg they last changed their papers
// on.
function healPapers(game: GameState): void {
  // [D2: the nine slot order board] The path this captain sailed.
  // Every save this build writes carries a path it was dealt by the
  // draft or changed at a port (see D7 below), and every save from
  // before the draft carries null, so the heal exists for the two
  // shapes that can carry anything else: a file written by hand, and
  // a save whose path names something this build retired. Both land
  // on a captain who never drew, which is the ordinary table rather
  // than a locked one, and the membership test behind this call is
  // the one that keeps "constructor" from reading as a path.
  game.path = normalizePath(game.path);
  // [D7: the draft, and switching] And the leg this captain last
  // changed their papers on, read through the module's own reader
  // for the reason every counter this build added is: it is a stamp
  // rather than a boolean, and a save carrying nonsense where the
  // stamp belongs has to read as a captain who has not switched
  // rather than as one who has. The other direction would cost an
  // innocent captain the one switch their voyage allows, and it is
  // the same reading normalizeOpportunistBorrows takes below.
  game.pathSwitchLeg = normalizePathSwitchLeg(game.pathSwitchLeg);
}

// The two markets' tallies and the ledger they both settle through.
function healConsentBoards(game: GameState): void {
  // [D3: Convoy: the Escort Contract] [D4: Loom: the Refit] The two
  // markets' tallies and the ledger they both settle through.
  //
  // Three heals, and the third is the one that matters most. The
  // counts are floored the way every other added tally is, so a save
  // that predates a market reads as a captain who has never sold
  // cover, absorbed a raid or put a garment right, rather than as
  // one carrying an undefined that the first settlement would turn
  // into NaN. A NaN in a score is not merely wrong: the Ledger
  // Integrity Pass reads an impossible score as a forged one and
  // would cost an innocent captain their Renown.
  //
  // The ledger is the guard on the other side of the same problem.
  // It is what keeps a reload between an agreement and the Gold
  // that follows it from moving that Gold twice, so a save carrying
  // the name the previous build wrote has to have it read rather
  // than dropped: losing it to a rename would be losing the
  // protection, which is why the reader takes the old field (see
  // normalizeConsentLedger). The two names are read off the save as
  // it was written, which is what the cast is: everything above this
  // line is this build's GameState and this is the one field whose
  // old spelling still has to be understood.
  normalizeConsentLedger(
    game,
    game as unknown as {
      escortSettled?: unknown;
      escortSettledRound?: unknown;
    },
  );
  normalizeEscortState(game);
  normalizeRefitState(game);
  // [F3: modules in the shipyard ladder, and trading them between
  // captains] The trade's own tally and its per module ledger. Same
  // heal as the two kinds above and for the same reason on the
  // counters; the per module record is the one a stale save cannot
  // carry at all, so its reader answers an empty ledger rather than
  // undefined and the first sale writes the first entry (see
  // normalizeModuleTradeState).
  normalizeModuleTradeState(game);
}

// The answers that come from outside the save, applied last so that they
// win: the captain's Renown, their per voyage tallies, and the room's own
// tier and lap.
function refreshVoyageFacts(game: GameState, facts: LoadedSaveFacts): void {
  // Refresh Renown from the freshly loaded legacy so a captain who
  // leveled up since this voyage was saved gets the current unlock
  // state; fall back to the saved value (then 1) if legacy is missing.
  game.renownLevel = facts.legacyRenownLevel ?? game.renownLevel ?? 1;
  game.brokersFavorUsed = game.brokersFavorUsed ?? false;
  // [D6: Free Captain: Opportunist] A save written before the borrow
  // existed carries no counter at all, and an undefined counter is
  // NaN the first time one is spent, which would then ride the
  // voyage's figures into the record. The healing is the module's own
  // reader, so a save carrying a fraction or a negative is read here
  // the way the board and the engine read it rather than trusted
  // because it came off a disk.
  game.opportunistBorrows = normalizeOpportunistBorrows(
    game.opportunistBorrows,
  );
  // A save written before helping other captains had a per voyage
  // ceiling has no tally at all, and the ceiling is arithmetic:
  // cap minus undefined is NaN, which would then be added straight
  // into score the first time that captain lent anyone Gold. A NaN
  // score is not merely wrong, it reads as impossible to the Ledger
  // Integrity Pass and would cost an innocent captain their Renown.
  game.helperReputationEarned = game.helperReputationEarned ?? 0;
  // The same arithmetic and the same heal for the peer ledger a
  // Broker's card is measured on: a save written before it existed
  // carries no tally at all, and the first trade added to undefined
  // is NaN, which the Ledger Integrity Pass reads as impossible.
  game.peerTradeProfit = game.peerTradeProfit ?? 0;
  // Old saves predate per voyage seeding; default their epoch to 0.
  // Their already generated cards restore from the blob untouched, so
  // only a future round would reseed, which is fine.
  game.voyageEpoch = game.voyageEpoch ?? 0;
  // Refresh difficulty from the room (the authoritative source), the
  // same reason renownLevel is refreshed above; default an old save
  // that predates difficulty to whatever tier the room is on.
  game.difficulty = normalizeDifficulty(
    facts.roomDifficulty ?? game.difficulty,
  );
  // Refresh mode from the room for the same reason, and with more at
  // stake: mode decides which order this captain's phases run in. A
  // save that predates modes carries no mode at all, and one restored
  // under a lap the room is not keeping would run the right phases in
  // the wrong order and quietly desynchronize from everyone else. The
  // room is authoritative, so it wins; the caller's hint covers a
  // response that does not carry the field.
  game.mode = normalizeMode(facts.apiMode ?? facts.roomMode ?? game.mode);
}
