// =====================================================================
// PortMasters 2.2 Parallel Release: Lords of the Silk Road game engine
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
// ---------------------------------------------------------------------
// This file is now a barrel. The engine itself lives in ./engine/*, one
// module per subsystem, matching how ./backing.ts, ./convoy.ts and the
// rest of this directory were already organised. Nothing moved between
// subsystems and no behaviour changed; the split is purely about where
// the code sits.
//
// The barrel exists so that the twenty five files importing
// `@/lib/game/engine` never had to change, and so that this stays the one
// public entry point to the engine. Import from here, not from the
// individual modules, unless you are inside ./engine/ yourself.
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

// ---------- Primitives ----------
// addOwnedAmount is intentionally absent: it was private to the engine
// before the split and stays private to it now.
export { getOwnedAmount, hasModule } from "./engine/core";

// ---------- Pricing, taxes and wages ----------
export {
  brokersFavorCommission,
  calcIncomeTax,
  calcTransportCost,
  calcVAT,
  explainCardPrice,
  explainExpectedPrice,
  explainTransportCost,
  explainVAT,
  getCardFinalCost,
  getHireCost,
  getIntelCost,
  type ExpectedPrice,
  type PriceBreakdown,
  type PriceStep,
} from "./engine/pricing";

// ---------- Phase 1: the port market ----------
export {
  applyHarborPulse,
  applyTidewatchSurge,
  completePhase1,
  poolsFor,
  purchaseCard,
  startPhase1,
  tallyPurchasesByResource,
  type MarketPools,
} from "./engine/market";

// ---------- Phase 2: the trade manifest ----------
export {
  callBrokersFavor,
  claimWordOnTheDocksReward,
  completeOrder,
  purchaseIntel,
  startPhase2,
} from "./engine/orders";

// ---------- Bartering ----------
export {
  acceptBarterOffer,
  completeBarterPhase,
  postBarterOffer,
  refundBarterOffer,
  settleBarterTrade,
} from "./engine/barter";

// ---------- Artisans ----------
export {
  assignTask,
  fireWorker,
  hireWorker,
  payMaintenance,
  payWages,
  processProduction,
} from "./engine/workers";

// ---------- Boons and ship modules ----------
export {
  applyBoon,
  cancelModuleDraft,
  draftBoons,
  equipModule,
  finalizeModuleSwap,
  handleModuleSelect,
  selectBoon,
  startBoonDrafting,
  startModuleDrafting,
  swapBoonChoices,
  swapModuleChoices,
  upgradeShip,
} from "./engine/boons";

// ---------- Pirates and escorts ----------
export { hireEscort, resolvePirateAttack } from "./engine/pirates";

// ---------- Cross captain Gold: loans, backing, convoy ventures ----------
export {
  clearRedirectedLoan,
  grantLoan,
  receiveLoan,
  receiveRepayment,
  repayLoan,
  settleOutstandingDebts,
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

// ---------- Voyage lifecycle and phase orchestration ----------
export {
  completePhase2,
  endGame,
  endRound,
  finishSettlement,
  nextPhase,
  phaseLabel,
  restartGame,
  showWelcome,
  skipUpgrade,
  snapToCheckpoint,
  startPhase3,
  startPhase4,
} from "./engine/lifecycle";

// ---------- Cross file lookups hosted in constants.ts for backwards
// compatibility. merchantRatingForScore used to live in
// ./engine/lifecycle.ts; the table it scans (MERCHANT_RATINGS) lives here
// too, so the lookup moved beside it. Re-exported through the same barrel
// so the twenty five files importing `@/lib/game/engine` keep working. ----------
export { merchantRatingForScore } from "./constants";

// ---------- Manifest feature modules ----------
// New engine modules layered on top of the faithful port, each owned by
// its own file under ./engine/. Re-exported through the same barrel so
// the public entry point stays the only place callers import from.
export {
  AGES,
  currentAge,
  nextAgeChange,
  type Age,
  type AgeId,
} from "./engine/ages";
export {
  HOUSES,
  applyHousePerkAtStart,
  housePerkFor,
  houseStandingFor,
  type House,
} from "./engine/houses";
export {
  buildChronicle,
  type ChronicleInput,
  type ChronicleOutput,
} from "./engine/chronicle";
export {
  DETAIL_SUBJECT_MIN_LEVEL,
  DETAIL_VIEWER_MIN_LEVEL,
  bandFor,
  canSeeDetail,
} from "./engine/partialSight";
export {
  rivalKey,
  rivalSummary,
  type RivalOutcome,
  type RivalSummary,
} from "./engine/rival";
