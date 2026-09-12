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
export { getOwnedAmount } from "./engine/core";

// ========== Pricing, taxes and wages ==========
// The explain* breakdowns are here because the tooltips are: Purchase,
// Orders and PriceTooltips all show a captain where a price came from, so
// they read the breakdown directly rather than rebuilding it.
// calcVAT and calcIncomeTax are not here. A sale and a payroll run are
// settled inside ./engine/, which is also where the only readers of those
// two sit.
export {
  brokersFavorCommission,
  calcTransportCost,
  explainCardPrice,
  explainExpectedPrice,
  explainTransportCost,
  explainVAT,
  getCardFinalCost,
  getHireCost,
  getIntelCost,
  type ExpectedPrice,
  type PriceBreakdown,
} from "./engine/pricing";

// ========== Phase 1: the port market ==========
export {
  applyHarborPulse,
  applyTidewatchSurge,
  completePhase1,
  purchaseCard,
  tallyPurchasesByResource,
} from "./engine/market";

// ========== Phase 2: the trade manifest ==========
export {
  callBrokersFavor,
  claimWordOnTheDocksReward,
  completeOrder,
  purchaseIntel,
  startPhase2,
} from "./engine/orders";

// ========== Bartering ==========
export {
  acceptBarterOffer,
  completeBarterPhase,
  postBarterOffer,
  refundBarterOffer,
  settleBarterTrade,
} from "./engine/barter";

// ========== Artisans ==========
export { assignTask, fireWorker, hireWorker } from "./engine/workers";

// ========== Boons and ship modules ==========
export {
  cancelModuleDraft,
  finalizeModuleSwap,
  handleModuleSelect,
  selectBoon,
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
export {
  completePhase2,
  finishSettlement,
  nextPhase,
  phaseLabel,
  restartGame,
  showWelcome,
  skipUpgrade,
  snapToCheckpoint,
} from "./engine/lifecycle";

// ========== Cross file lookups hosted in constants.ts for backwards
// compatibility. merchantRatingForScore used to live in
// ./engine/lifecycle.ts; the table it scans (MERCHANT_RATINGS) lives here
// too, so the lookup moved beside it. Forwarded through the same barrel
// so the files importing `@/lib/game/engine` keep working. ==========
export { merchantRatingForScore } from "./constants";

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
