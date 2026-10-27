// The public entry point for the game engine. The engine itself lives in
// ./engine/*, one module per subsystem; import from here unless you are
// already inside ./engine/.
//
// The barrel carries the surface an outside caller needs. A subsystem's
// internals stay private, since a second export of a step whose only caller
// is the lifecycle spine is how a second route around the lap appears.
//
// Dependency flow is one way: core, then pricing, market, orders, draft,
// workers and the rest, with lifecycle at the top because only lifecycle
// sequences the others. Adding an import back down into lifecycle would
// create the first cycle in the engine.

// addOwnedAmount and hasModule stay private to ./engine/. moduleSlotsOpen is
// exported because the shipyard screens, the action suggester and the module
// trade panel all ask a hull the same question. nextShipUpgradeCost is
// exported because the same three surfaces quote the next rung's price.
export {
  canPayFee,
  getOwnedAmount,
  moduleSlotsOpen,
  nextShipUpgradeCost,
} from "./engine/core";

// The explain* breakdowns are exported for the tooltips that show a captain
// where a price came from. calcVAT and calcIncomeTax stay inside ./engine/,
// where the only callers settle a sale or a payroll run.
export {
  basePriceRange,
  priceRatio,
  brokersFavorCommission,
  cardLineFitsCeiling,
  cardLineUnitPrice,
  cargoUnitsWithAllTags,
  cargoUnitsWithTag,
  calcTransportCost,
  explainCardPrice,
  INCOME_TAX_RATE,
  INTEL_COST,
  VAT_RATE,
  explainExpectedPrice,
  explainTransportCost,
  explainVAT,
  fleetOfTreasuresUnits,
  formatTaxRate,
  getCardFinalCost,
  getHireCost,
  getIntelCost,
  incomeTaxRate,
  incomeTaxRateWithOverride,
  type ExpectedPrice,
  type PriceBreakdown,
} from "./engine/pricing";

export {
  applyMarketLeans,
  applyPortShift,
  applyTidewatchSurge,
  purchaseCard,
  tallyPurchasesByResource,
  type MarketLeans,
} from "./engine/market";

// The whole of the rumor rule (cooldown, visibility, lean) is here; the
// harbor's board is beside the socket in src/server/realtime/bazaar.ts.
// Every reader takes its rows and round as arguments, so the suite can hold
// the rule without a server.
export {
  bazaarGoods,
  canPublishRumor,
  normalizeBazaarRumor,
  normalizeRumorLean,
  publicRumors,
  rumorCanLand,
  rumorClosingLine,
  rumorCooldownLeft,
  rumorCooldownLine,
  rumorDirectionLine,
  rumorGoodAllowed,
  rumorId,
  rumorLean,
  rumorNextRound,
  rumorSpokeIn,
  rumorStanding,
  BAZAAR_SELLER_PATH,
  type BazaarRumor,
  type PublicRumor,
  type RumorDirection,
} from "./engine/bazaar";

// canFillOrder and its path readers are public because the board must ask
// the engine's own question before it presses, so a card the board grays out
// is a card the engine refuses. quoteOrder is public so the card, the
// advisor and the settlement price an order through one chain.
export {
  callBrokersFavor,
  canFillOrder,
  claimWordOnTheDocksReward,
  completeOrder,
  lockedBehind,
  openOrderCount,
  orderRewardBonusSteps,
  pathOrderOf,
  purchaseIntel,
  quoteOrder,
} from "./engine/orders";

// The borrow's allowance, payout and sentences. Several layers read this
// rule and none owns it, so the board asks what it may offer, the card and
// ledger print the same sentence, and the round report and save heal read the
// same counts. completeOrder is the only spender.
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

// The two writes a path leaves in a save, plus the refusals their callers
// share. The draft rule itself lives in ./draft, which holds no state. The
// switch lines are exported so the panel, the frame handler and the harbor
// refuse in the engine's own words. The ledger lines stay private.
export {
  applyDraftPath,
  applyPathSwitch,
  pathSwitchBlocked,
  pathSwitchOpenLine,
  pathSwitchSpentLine,
} from "./engine/draft";

// The Ocean Gambit objective. It opens in the manifest phase but delivers
// against the mode's deck.
export {
  deliverToObjective,
  OBJECTIVE_DELIVERY_PHASE,
} from "./engine/objectives";

export {
  acceptBarterOffer,
  postBarterOffer,
  refundBarterOffer,
  settleBarterTrade,
} from "./engine/barter";
// Who may barter flexibly and how often. This is policy the callers apply
// around ./engine/barter, which does not consume it. The Captain's Exchange
// is not governed here.
export {
  flexibleBarterUnlocked,
  flexibleOffersLeft,
} from "./engine/barterAccess";

export {
  assignTask,
  fireWorker,
  hireWorker,
  maintenanceDue,
  payMaintenance,
  payWages,
  unlockedWorkerRoster,
  wageBill,
  wagesDue,
  workerBaseYield,
} from "./engine/workers";

// The harbor's two ways of writing a captain off. Both arrive from socket
// handlers rather than buttons: the maroon as a broadcast, the bankruptcy
// through the settlement.
export { failSeat, maroonSeat } from "./engine/seats";

export {
  cancelModuleDraft,
  finalizeModuleSwap,
  handleModuleSelect,
  // The heal reads the same surcharge accounting the doors write.
  reconcileModulePenalties,
  startBoonDrafting,
  startModuleDrafting,
  swapBoonChoices,
  swapModuleChoices,
  upgradeShip,
} from "./engine/boons";

// The Settlement panel prints these two numbers, exported so it quotes what
// the roll and charge use.
export {
  escortCost,
  expectedRaidLoss,
  hireEscort,
  pirateChance,
  raidGoldAtRisk,
  resolvePirateAttack,
} from "./engine/pirates";

// The agreement shape shared by several kinds of trade. The policy helpers
// (visibility, expiry, accept) live in the game layer so a rule can be
// tested without a server. ConsentTerms is exported so both ends of the wire
// import one shape rather than two that must be kept in step.
export {
  agreeConsent,
  consentFeeFor,
  consentOfferStanding,
  consentPartyBusy,
  consentSettled,
  expireConsent,
  normalizeConsentLedger,
  resetConsentLedger,
  visibleConsent,
  type ConsentTerms,
} from "./engine/consent";

// The Convoy's market. The rules live here and the board is a component.
// The client layer that owns a captain's side reads applyEscortSide and
// coverFromBoard; the market screens read canSellEscort, escortCoverage and
// escortCoverOf. The consent primitive above owns the fee, visibility,
// expiry and accept rules, so they are not repeated here.
export {
  applyEscortSide,
  canSellEscort,
  coverFromBoard,
  escortCoverage,
  escortCoverOf,
  normalizeEscortState,
  resetEscortRound,
  visibleContracts,
  ESCORT_SELLER_PATH,
  type EscortContract,
} from "./engine/contracts";

// The Loom's bench: the rag chain and exclusive pile, the solo mending
// baseline, the questions asked before offering, and the client write that
// applies another captain's accepted refit. The room a refit restores comes
// from refitRoomFor, so the offer and the warmth move by one number.
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

// The module trade kind: the seller and buyer questions, the listing lock,
// the server's id check, and the client write that unequips the seller and
// charges the buyer. The fee, visibility, expiry and idempotent ledger are
// the consent primitive's. readModuleTraffic and shippedModuleTraffic back
// the module report; normalizeModuleTradeState is the load site's.
export {
  applyModuleTradeSide,
  canSellModule,
  isModuleId,
  moduleListedThisRound,
  normalizeModulesTraded,
  normalizeModuleTradeState,
  readModuleTraffic,
  shippedModuleTraffic,
  type ModuleTrade,
  type ModuleTrafficSave,
} from "./engine/modules";

// answerMilestone is the overlay's call, taking the queued card or refusing
// one the queue no longer deals. Arming stays inside ./engine/, so a caller
// meets a moment through the voyage.
export { answerMilestone } from "./engine/milestones";

// answerCharter is the overlay's call, taking the offered card or refusing
// one the trio no longer deals. The overlay reads what is due and offered
// from ./charters directly.
export { answerCharter } from "./engine/charters";

// The Supply Barge, the mode's fallback vendor. buyFromBarge is the sale;
// the port, lot, price and stock readers drive the provisions panel, and
// the two ceiling readers keep sale and panel on one limit. bargeOn is the
// provisions layer itself.
export {
  bargeLeftAtPort,
  bargeLotAtPort,
  bargeOn,
  bargePortAtRound,
  bargePurseRations,
  bargeRationPrice,
  bargeRoomMeals,
  buyFromBarge,
  normalizeBargeState,
} from "./engine/barge";

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

// Departures stay private to ./engine/lifecycle.ts. Every panel reaches the
// spine through nextPhase or lockInBoon, and a second export of a step whose
// only caller is the spine would create a second route around the lap.
// autoCommit is a whole departure, not a step, so it sits beside nextPhase;
// leavePhase and canLeavePhase are the manual press version of the same
// departure.
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

// Forwarded from ./constants/reputation so callers keep one entry point.
export {
  merchantRatingForScore,
  endgameRatingFor,
} from "./constants/reputation";

// The later feature modules, forwarded so the barrel stays the only import
// point. WIDEST_BROKERS_FAVOR_PAYOUT_CAP is public because the integrity
// bound must allow the widest Age cap.
export {
  AGE_IDS,
  WIDEST_BROKERS_FAVOR_PAYOUT_CAP,
  currentAge,
  nextAgeChange,
  type Age,
  type AgeId,
} from "./engine/ages";
export {
  HOUSES,
  HOUSE_TOKENS,
  noHousePerks,
  type House,
} from "./engine/houses";
// The sight thresholds stay inside ./engine/; callers ask canSeeDetail or
// bandFor.
export { bandFor, canSeeDetail } from "./engine/partialSight";
export { rivalSummary, type RivalOutcome } from "./engine/rival";
