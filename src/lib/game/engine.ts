// =====================================================================
// PortMasters 2.2 Parallel Release: game engine
//
// Ported faithfully from the original single player build. All wording,
// log messages, balance, and phase flow are preserved verbatim.
//
// [ONLINE EXTENSION] The one behavioural addition is a seedable PRNG
// (mulberry32) used for the session economy. Port market cards, trade
// orders, and the Broker's intel pool are generated deterministically from
// (roomId + userId + voyageEpoch + round), so each captain has their own
// market, orders, and intel: reproducible on reload, different from every
// other captain, and rerolled into a brand new voyage whenever the host
// restarts (which bumps voyageEpoch, see prisma/schema.prisma and
// src/lib/use-game-session.ts). Each captain's gold, reputation, inventory,
// workers, and personal luck (Salvage Crane refunds, Tax Evasion audits,
// boon offerings) are their own too.
//
// One new gameplay skill, Broker's Favor, is layered on top of the faithful
// port: a Renown gated, once per voyage guaranteed buyer (see
// callBrokersFavor). It draws with a captain's own live randomness, so it
// stays personal and never perturbs their seeded market.
//
// =====================================================================
// This file is now a barrel. The engine itself lives in ./engine/*, one
// module per subsystem, matching how ./backing.ts, ./convoy.ts and the
// rest of this directory were already organised. Nothing moved between
// subsystems and no behaviour changed; the split is purely about where
// the code sits.
//
// The barrel exists so that the files importing `@/lib/game/engine` never
// had to change, and so that this stays the one public entry point to the
// engine. Import from here, not from the individual modules, unless you
// are inside ./engine/ yourself.
//
// What the barrel carries is the surface an outside caller actually
// reads: everything a panel, a hook or a route needs. A subsystem's own
// internals are deliberately left out, since the only code that calls
// them lives beside them under ./engine/. Both of those rules are load
// bearing. An export nothing imports is the same dead weight as a dead
// function, and it is harder to spot, because it looks like a deliberate
// offering rather than an oversight.
//
// The dependency flow is one way and worth preserving:
//
//   core            no dependencies, used by nearly everything
//   pricing         core
//   market          core, pricing
//   orders          core, pricing, market
//   draft           orders (the two writes read the manifest's locks)
//   workers         core, pricing
//   barter          core
//   pirates         core
//   aid             owns the shared helper Reputation ceiling
//   backingState    aid
//   convoyState     no engine dependencies
//   boons           market
//   lifecycle       imports from nearly all of the above, and nothing
//                   imports from it
//
// Only lifecycle sits at the top, because only lifecycle sequences the
// others. Adding an import that points back down into it would create the
// first cycle in the engine, so please don't.
// =====================================================================

// ========== Primitives ==========
// addOwnedAmount is intentionally absent: it was private to the engine
// before the split and stays private to it now. hasModule is absent for
// the same reason, every caller sits under ./engine/ and asks it directly.
// moduleSlotsOpen is here because its callers are exactly the ones that
// rule was written for: the two shipyard screens outside ./engine/, the
// nudge in the action suggester, and F3's own trade panel, all of them
// asking a hull the same question and all of them wanting the same
// floored answer (see its own comment in ./engine/core for why a
// subtraction rather than a comparison).
export { getOwnedAmount, moduleSlotsOpen } from "./engine/core";

// ========== Pricing, taxes and wages ==========
// The explain* breakdowns are here because the tooltips are: Purchase,
// Orders and PriceTooltips all show a captain where a price came from, so
// they read the breakdown directly rather than rebuilding it.
// calcVAT and calcIncomeTax are not here. A sale and a payroll run are
// settled inside ./engine/, which is also where the only readers of those
// two sit.
export {
  basePriceRange,
  priceRatio,
  brokersFavorCommission,
  calcTransportCost,
  explainCardPrice,
  INCOME_TAX_RATE,
  VAT_RATE,
  explainExpectedPrice,
  explainTransportCost,
  explainVAT,
  getCardFinalCost,
  getHireCost,
  getIntelCost,
  type ExpectedPrice,
  type PriceBreakdown,
} from "./engine/pricing";

// ========== Market: the port board ==========
export {
  applyBazaarLean,
  applyHarborPulse,
  applyMarketLeans,
  applyPortShift,
  applyTidewatchSurge,
  purchaseCard,
  tallyPurchasesByResource,
  type MarketLeans,
} from "./engine/market";

// ========== The bazaar: the rumor ==========
// [D5: Aroma: the Bazaar Rumor] The whole of the rule, and the split is
// the one the other path modules take: what a rumor is (the cooldown, the
// visibility rule, the lean and the healing) is here, and the room's board
// is beside the socket that speaks on it (see
// src/server/realtime/bazaar.ts). The server reads rumorCooldownLeft,
// rumorGoodAllowed, rumorId, rumorLean and publicRumors off this barrel
// and every one of them takes its rows and its leg as arguments, so the
// suite holds the rule without opening a server.
//
// canPublishRumor is the desk's, and it is the Aroma path's own reader
// rather than a second copy of the flag: it asks the switch and the path
// together, the same pair canSellRefit asks.
export {
  bazaarGoods,
  canPublishRumor,
  normalizeBazaarRumor,
  normalizeRumorLean,
  publicRumors,
  rumorCooldownLeft,
  rumorCooldownLine,
  rumorDirectionLine,
  rumorGoodAllowed,
  rumorId,
  rumorLean,
  rumorStanding,
  BAZAAR_SELLER_PATH,
  type BazaarRumor,
  type PublicRumor,
  type RumorDirection,
} from "./engine/bazaar";

// ========== Orders: the trade manifest ==========
// [D2: the nine slot order board] canFillOrder and its two path readers are
// here rather than staying module private, because the board now has to ask
// the same question the engine asks before it presses: which orders are
// this captain's, and why one of them is not. The answers are computed in
// ./engine/orders and nowhere else, so a card the board greys out is a card
// the engine refuses, by construction rather than by agreement.
export {
  callBrokersFavor,
  canFillOrder,
  claimWordOnTheDocksReward,
  completeOrder,
  lockedBehind,
  openOrderCount,
  pathOrderOf,
  purchaseIntel,
} from "./engine/orders";

// ========== The Free Captain's borrow ==========
// [D6: Free Captain: Opportunist] The allowance, the payout and the
// sentences the borrow is described with. Exported for the reason the
// other ability readers are: four layers read this rule and none of them
// owns it. The board asks what it may offer (opportunistMayBorrow) and
// what the offer pays (opportunistPayout, opportunistBorrowsLeft), the
// card and the ledger print the same sentence (opportunistLine) and the
// card alone prints what is left of the allowance (opportunistUsesLine,
// OPPORTUNIST_SPENT_LINE), the leg report files what a voyage spent
// (opportunistBorrowsTaken) and the save's heal reads
// normalizeOpportunistBorrows. completeOrder is the only caller that
// spends one, and it reads the same readers the board does, so what the
// button promises and what the engine pays cannot come apart.
//
// [F6: charters at leg four] The Factor made two of those answers stateful,
// and the block grew the readers with them: opportunistAllowance is the
// voyage's count under the charter, and opportunistIsBorrower is the door
// the path or the charter holds open, which the board's spent line asks
// rather than comparing a path itself.
export {
  normalizeOpportunistBorrows,
  opportunistAllowance,
  opportunistBorrowsLeft,
  opportunistBorrowsTaken,
  opportunistIsBorrower,
  opportunistLine,
  opportunistMayBorrow,
  opportunistPayout,
  opportunistUsesLine,
  OPPORTUNIST_PATH,
  OPPORTUNIST_SPENT_LINE,
} from "./engine/opportunist";

// ========== The draft, and switching ==========
// [D7: the draft, and switching] The two writes a path leaves in a
// captain's save, and the one refusal that guards the second. The rule
// they read (the deck, the pass, the window and the fee) lives outside
// the engine, in ./draft, for the reason ./contracts and ./bazaar state
// about their own arithmetic: it holds no state, so the suite can hold it
// without a server, and only the two apply functions here touch a save.
//
// pathSwitchBlocked is exported because two callers ask it the same
// question and they have to agree: the panel that offers the switch, and
// the frame handler that applies it when the room publishes one, so a
// switch that arrives twice is a no-op rather than a second fee.
// pathSwitchOpenLine is the "when" half of that same guard, exported on
// its own because the third caller is across the wire: the room refuses a
// switch outside the window before it publishes one (see the path:switch
// handler), and it has to refuse it in the same words the engine would.
// pathSwitchSpentLine is the other half of that one sentence's trip, the
// once a voyage refusal, and it is out here for the same reason: the room
// reads a book of its own to answer whether the allowance was spent, and
// the answer it gives a captain has to be the engine's own words.
// forfeitPathOrders and the three ledger lines are deliberately absent:
// each is written for one caller and read nowhere else, and the two
// callers are the writes above, applyDraftPath for the line it takes and
// applyPathSwitch for the other two, so a reader out here would be a
// second surface printing a save's own log.
export {
  applyDraftPath,
  applyPathSwitch,
  pathSwitchBlocked,
  pathSwitchOpenLine,
  pathSwitchSpentLine,
} from "./engine/draft";

// ========== The fleet commission ==========
// The Ocean Gambit objective. Lives out here rather than in the Orders
// block above because the deck it delivers against is the mode's, not the
// manifest's, even though it opens in the manifest phase.
export {
  deliverToObjective,
  OBJECTIVE_DELIVERY_PHASE,
} from "./engine/objectives";

// ========== Parley: the trade table ==========
export {
  acceptBarterOffer,
  postBarterOffer,
  refundBarterOffer,
  settleBarterTrade,
} from "./engine/barter";
// Who may barter flexibly and how often. Kept out of the block above on
// purpose: nothing in ./engine/barter.ts consumes these, they are the
// policy the callers apply around it, and it is the flexible surface
// alone. The Captain's Exchange is not governed from here at all.
// bothFlexibleBarterUnlocked is deliberately absent: its callers are the
// server's two flexible offer handlers, and both of them read it from
// ./engine/barterAccess directly since they run outside this barrel.
export {
  flexibleBarterUnlocked,
  flexibleOffersLeft,
} from "./engine/barterAccess";

// ========== Artisans ==========
export {
  assignTask,
  fireWorker,
  hireWorker,
  payMaintenance,
  payWages,
  wageBill,
} from "./engine/workers";

// ========== A seat that failed ==========
// [H7: Maroon and the Harbormaster] The harbor's two ways of writing a
// captain off. Both are reached by name from a socket handler rather than
// from a button, which is why they are here rather than staying private to
// ./engine/seats: the maroon arrives as a broadcast the client has to
// apply, and the bankruptcy is applied by the settlement the client is
// already running.
export { failSeat, maroonSeat } from "./engine/seats";

// ========== Boons and ship modules ==========
export {
  cancelModuleDraft,
  finalizeModuleSwap,
  handleModuleSelect,
  // [F7: the power budget] The yard's draft-or-not question, forwarded
  // for the reason the rest of this block is: the Shipyard panel asks it
  // before the Draft button, and the answer has to be the roll's own
  // predicate rather than a second guess written at the button.
  moduleDraftPossible,
  // The load's own reconcile for the two surcharge fields, forwarded for
  // the reason the rest of this block is: the heal has to read the same
  // accounting the doors write rather than a second copy of the rules.
  reconcileModulePenalties,
  startBoonDrafting,
  startModuleDrafting,
  swapBoonChoices,
  swapModuleChoices,
  upgradeShip,
} from "./engine/boons";

// ========== Pirates and escorts ==========
// pirateChance and escortCost are the two numbers the Settlement panel
// prints, exported so it prints the ones the roll and the charge use rather
// than rebuilding either by hand.
export {
  escortCost,
  hireEscort,
  pirateChance,
  resolvePirateAttack,
} from "./engine/pirates";

// ========== The consent primitive ==========
// [D4: Loom: the Refit] The agreement shape two kinds of trade are made of,
// exported here because three callers read it and none of them is the kind
// that happens to share it. The room's two board modules read the policy
// helpers, visibleConsent, expireConsent, consentOfferStanding, agreeConsent
// and consentPartyBusy, which are the rules about what a price is, who sees
// a row, when an offer expires and what an accept consumes; they live in the
// game layer rather than in the socket closures for the reason ./convoy.ts
// gives about its own arithmetic, so a rule can be tested without a live
// server. The client layer reads consentFeeFor for the form a seller types
// into, and floorTallies, movementApplied and normalizeConsentLedger at the
// load site, where a save is healed.
//
// The type is the other half of the export and the more important one: both
// ends of the wire import ConsentTerms from here rather than each declaring
// a shape the other has to be kept in step with.
export {
  agreeConsent,
  consentFeeFor,
  consentOfferStanding,
  consentPartyBusy,
  expireConsent,
  floorTallies,
  markMovement,
  movementApplied,
  normalizeConsentLedger,
  resetConsentLedger,
  visibleConsent,
  type ConsentTerms,
} from "./engine/consent";

// ========== The escort contract ==========
// [D3: Convoy: the Escort Contract] The Convoy's market, split the way
// ./engine/pirates.ts was split from its own panel: the rules are here and
// the board that shows them is a component. Three callers read this block,
// and each reads a different part of it. The client layer that owns a
// captain's side of a contract reads applyEscortSide and coverFromBoard,
// both of them from the room, which is where a relay becomes a state change.
// The two screens that draw the market read the questions a captain asks of
// it: canSellEscort, escortCoverage and ESCORT_SELLER_PATH at the Parley
// table, and escortCoverOf on the Resolve screen, where it says whose guns
// are standing over the raid. That last one is read here rather than
// testing the switch and the field on the screen, so a build with the
// market off reads as uncovered wherever it is asked. visibleContracts is
// the board one captain sees, which is the shared privacy filter plus the
// one field only this kind carries.
//
// The board's other rules are not here because they are not this kind's:
// what a fee is, which rows are visible, when an offer expires, the accept
// that sweeps the rest and the ledger of applied movements are the consent
// primitive above, and a wrapper for each would be a second name for one
// rule. That includes the bound on a second cover, which the panel reads as
// consentPartyBusy(rows, "buyer", ...) with the side named where it is
// asked, since the side is the whole of what the two markets differ on
// there.
//
// escortClaimFrom is deliberately absent. Its one caller is the raid roll
// two blocks up, which is inside ./engine/ and reaches it directly.
// escortSellerLabels was here and is not, which is worth the line: it
// gathered the crest and the name a board draws, and the order board already
// answers that question by calling pathConfig on the id it was handed (see
// Orders.tsx). A second way to ask it would have been a second answer to
// what a path looks like.
export {
  applyEscortSide,
  canSellEscort,
  coverFromBoard,
  escortCoverage,
  escortCoverOf,
  normalizeEscortState,
  resetEscortLeg,
  visibleContracts,
  ESCORT_SELLER_PATH,
  type EscortContract,
} from "./engine/contracts";

// ========== The Loom's bench ==========
// [D4: Loom: the Refit] The three things the plan hands this path, in the
// order a captain meets them at the port. buyRag and reweaveRags are the
// crafting chain and the exclusive right to the harbor's pile; mendGarment
// and ragsAtPort are what a captain can do alone, which is the baseline the
// refit is priced against; refitSellerBusy, refitRoomFor and canSellRefit
// are the questions a Loom captain asks before offering; and applyRefitSide
// is the client layer's, where a relay becomes the one state change in this
// engine that a second captain asked for. The point a refit puts back is
// read through refitRoomFor rather than worked out on a screen, so the
// number an offer quotes and the number the warmth moves by are one number.
//
// refitsOn is exported with them rather than from ./flags, for the reason
// its own comment gives: it stands on the wardrobe, and ./garments already
// reads ./flags. normalizeRefitState is the load site's, healing the tally
// this build added, and ragsLeftAtPort is the bench panel's, which prints
// what is left of the pile rather than the pile.
export {
  applyRefitSide,
  buyRag,
  canSellRefit,
  mendGarment,
  normalizeRefitState,
  ragsAtPort,
  ragsLeftAtPort,
  refitRoomFor,
  refitsOn,
  refitSellerBusy,
  reweaveRags,
  REFIT_SELLER_PATH,
  type RefitContract,
} from "./engine/refits";

// ========== The module trade ==========
// [F3: modules in the shipyard ladder, and trading them between captains]
// The third consent kind, split the way the two before it were: the rule
// is here and the two boards that show it are a component and a socket
// module. Three callers read this block and each reads a different part.
// The Parley panel asks the seller's question, canSellModule, and the
// listing lock, moduleListedThisLeg, which is the kind's own bound and
// bound to the row rather than to a side (see its own comment); the
// server's post handler asks isModuleId before it publishes a row, since
// a module id is the one thing about a listing it can check without
// reading anybody's save; the client layer that owns a captain's side of
// an agreement reads applyModuleTradeSide, which is both the seller's
// automatic unequip the plan asked for and the buyer's pay-then-bolt-on.
//
// normalizeModuleTradeState is the load site's, healing the tally this
// build added, and the two traffic readers are the plan's second
// evaluation: readModuleTraffic pairs what the saves carry against what
// they traded away, over a subject handed in rather than reached for, and
// shippedModuleTraffic is that reading against the pool this build
// shipped, which is what npm run report:modules prints. That report is
// also normalizeModulesTraded's second caller, which is the one reason
// the per module ledger's heal is exported on its own rather than staying
// inside the state heal above it.
//
// The sweep of one module listed twice, the one open offer per seller, the
// fee's shape, the visibility rule, the expiry and the ledger that makes a
// settle idempotent are the consent primitive's, not this kind's, and a
// wrapper for each would be a second name for one rule: that is the same
// sentence the escort block above carries, and it is the point of the
// primitive rather than a shortcut.
export {
  applyModuleTradeSide,
  canSellModule,
  isModuleId,
  moduleListedThisLeg,
  normalizeModulesTraded,
  normalizeModuleTradeState,
  readModuleTraffic,
  shippedModuleTraffic,
  type ModuleTrade,
  type ModuleTrafficRow,
  type ModuleTrafficSave,
  type ModuleTrafficSubject,
} from "./engine/modules";

// ========== Milestone boons ==========
// [F4: boons at milestone moments] The second way a boon reaches a
// captain, and the part of it that needs a public name is the answer:
// answerMilestone is the overlay's one call, taking the card the captain
// pressed off the head of the queue or refusing a card the head no
// longer deals (see ./engine/milestones for why a refusal is a real
// answer). The arming side stays inside ./engine/ and is not forwarded:
// queueMilestoneMoment is called by the two sweeps and the three site
// moments, and the sweeps are called by the dawn and the settlement
// beside their own ticks, so a caller outside ./engine/ meets a moment
// through the voyage rather than through a name.
export { answerMilestone } from "./engine/milestones";

// ========== Charters ==========
// [F6: charters at leg four] The voyage's one charter, and the part of it
// that needs a public name is the answer: answerCharter is the overlay's
// one call, taking the card the captain pressed off the trio or refusing
// a card the trio no longer deals (see ./engine/charters for why a
// refusal is a real answer). The reading side stays in ../charters and is
// not forwarded: the overlay imports what is due and what is offered from
// there, the way the boon draft imports its own pair, so a caller meets
// the question through the module that asks it.
export { answerCharter } from "./engine/charters";

// ========== The Supply Barge ==========
// [E1: the Supply Barge] The mode's fallback vendor, and the whole of the
// feature is one sale: buyFromBarge, at a premium the constants set and
// out of a lot drawn from the port and the leg. bargePortAtLeg,
// bargeLotAtPort, bargeRationPrice and bargeLeftAtPort are the four
// questions the provisions panel asks before it draws the row; bargeOn is
// the layer the vendor stands on, which is the provisions layer itself
// rather than a switch of its own, because the plan's rollback for this
// goal is reverting the mode (see barge); and normalizeBargeState is the
// load site's, healing the per leg tally and the voyage's two food
// counters.
//
// The two counters are read back off the leg report rather than exported
// to a reader here, for the reason every other feature's figures are: a
// number only one surface reads is a number that belongs to that surface
// (see dashboard).
export {
  bargeLeftAtPort,
  bargeLotAtPort,
  bargeOn,
  bargePortAtLeg,
  bargeRationPrice,
  buyFromBarge,
  normalizeBargeState,
} from "./engine/barge";

// ========== Cross captain Gold: loans, backing, convoy ventures ==========
export {
  clearRedirectedLoan,
  grantLoan,
  receiveLoan,
  receiveRepayment,
  repayLoan,
} from "./engine/aid";
export {
  pledgeBacking,
  receiveBackedCoverage,
  receiveBackingOutcome,
} from "./engine/backingState";
export {
  contributeToVenture,
  receiveVentureSettlement,
} from "./engine/convoyState";

// ========== Voyage lifecycle and phase orchestration ==========
// The departures are deliberately not forwarded. completeOrders,
// finishSettlement and skipUpgrade used to be here because the panels
// called them directly, which is what gave the engine a second route
// around the lap. Every panel reaches the spine through nextPhase or
// lockInBoon now, so those three are private to ./engine/lifecycle.ts.
//
// The same goes for the per phase enter and complete steps further up
// this file: completeMarket, startOrders, completeParley and selectBoon
// are each called by ./engine/lifecycle.ts and nothing else, and it
// reaches them through their own submodules rather than through here.
// Re-exporting a step whose only caller is the spine is what made the
// second route possible in the first place, so they stay off the public
// surface. A caller outside ./engine/ advances a voyage with nextPhase
// and never by naming a step.
//
// autoCommit is here beside nextPhase rather than among the private steps,
// because it is not a step either: it is the whole of a departure, the one a
// client runs when the room's clock ran out on a captain who was holding
// nothing (see [B2] in ./engine/lifecycle.ts). Its one caller is the phase
// sync hook.
//
// leavePhase and canLeavePhase are here for the same reason and have the same
// caller, with the press a captain makes by hand in place of the clock: they
// are the departure a generic "I am done with this seat" press makes, and the
// question of whether there is one. They are two names for one rule read at
// two moments, which is why they sit together: a press asks whether it may be
// sent before sending it, and the departure it sends is the same one the clock
// runs.
export {
  autoCommit,
  canLeavePhase,
  leavePhase,
  lockInBoon,
  nextPhase,
  phaseLabel,
  restartGame,
  showWelcome,
  snapToCheckpoint,
} from "./engine/lifecycle";

// ========== Cross file lookups hosted in constants/reputation.ts for backwards
// compatibility. merchantRatingForScore used to live in
// ./engine/lifecycle.ts; the table it scans (MERCHANT_RATINGS) lives here
// too, so the lookup moved beside it. Forwarded through the same barrel
// so the files importing `@/lib/game/engine` keep working. ==========
export { merchantRatingForScore } from "./constants/reputation";

// ========== Manifest feature modules ==========
// New engine modules layered on top of the faithful port, each owned by
// its own file under ./engine/. Forwarded through the same barrel so
// the public entry point stays the only place callers import from.
// WIDEST_BROKERS_FAVOR_PAYOUT_CAP is the one Age value an outside caller
// needs: the plausibility bound in ./integrity.ts has to allow for the
// widest cap any Age offers. The three effect accessors are deliberately
// not forwarded, since their only callers sit inside ./engine/.
export {
  WIDEST_BROKERS_FAVOR_PAYOUT_CAP,
  currentAge,
  nextAgeChange,
  type Age,
  type AgeId,
} from "./engine/ages";
export { HOUSES, noHousePerks, type House } from "./engine/houses";
// The two sight thresholds stay inside ./engine/: both are read by
// canSeeDetail and bandFor, which are what every caller actually asks for.
export { bandFor, canSeeDetail } from "./engine/partialSight";
export { rivalSummary, type RivalOutcome } from "./engine/rival";
