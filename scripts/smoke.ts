// =====================================================================
// PortMasters 2.2 Parallel Release: end to end smoke test.
//
// Drives one honest voyage through the running app: two captains sign
// up, one opens a harbor, the other joins it by code, both open a socket
// and authenticate, and the test checks that the room and the presence
// channel agree about who is aboard.
//
// It talks to a server that is already running, over the same public
// HTTP and WebSocket surface a browser uses, so it exercises the routes,
// the database, the session tokens and the realtime layer together
// rather than any one of them in isolation.
//
// Start the app first, then in another terminal:
//
//   npm run dev
//   npm run test:smoke
//
// Point it somewhere else with SMOKE_BASE_URL, for example
// SMOKE_BASE_URL=http://localhost:8099 npm run test:smoke
//
// The two captains and the harbor it creates are deleted again on the
// way out, whether the run passed or failed, so the database is left
// exactly as it was found.
//
// That cleanup runs through Prisma, from this process, against whatever
// DATABASE_URL this process resolves. The server under test resolves its
// own. If those two ever disagree the cleanup would quietly delete
// nothing and leave the accounts behind while reporting success, so the
// first account created is checked against this connection before
// anything else happens, and a mismatch stops the run immediately.
// =====================================================================
import "@/server/env";
import {
  PlayerReportAck,
  RoomMembersPayload,
} from "@/types/realtime/moderation";
import { MaroonResult, PortShiftNotice } from "@/types/realtime/maroon";
import { DraftView, PathSwitched } from "@/types/realtime/draft";
import { BazaarBoard, EscortBoard, RefitBoard } from "@/types/realtime/boards";
import { AuditReveal } from "@/types/realtime/audit";
import { PORTS_TIER2 } from "@/lib/game/constants/world";
import { tipsText } from "@/lib/game/constants/tips";
import {
  CARGO_SLOTS,
  FOODS,
  FOODS_DRAW_ORDER,
  LARDER_MAX,
  LARDER_START,
  PRESERVE_MEALS_IN,
  PRESERVE_MEALS_OUT,
  RATION_PRICE,
  SHORT_RATIONS_CARGO,
  SHORT_RATIONS_YIELD,
  STORES_SLOTS,
} from "@/lib/game/constants/supplies";
import { MAX_SHIP_LEVEL } from "@/lib/game/constants/ships";
import {
  CONSENT_FEE_MAX,
  CONSENT_FEE_MIN,
  CONVOY_CANNON_SLOTS,
  CONVOY_RAID_COVERAGE,
  DRAFT_DEAL,
  DRAFT_QUARTERMASTER_MIN,
  DRAFT_STEP_SECONDS,
  OPPORTUNIST_PENALTY,
  OPPORTUNIST_USES,
  PATH_ORDER_SLOTS,
  PATH_SWITCH_FEE_BASE,
  PATH_SWITCH_FEE_MAX,
  PATH_SWITCH_FEE_PER_LEVEL,
  PATH_SWITCH_FROM_ROUND,
  PATH_SWITCH_TO_ROUND,
  QUARTERMASTER_HOLD_GAIN,
  RUMOR_COOLDOWN_ROUNDS,
  RUMOR_SHIFT_FRACTION,
} from "@/lib/game/constants/paths";
import {
  COMMODITIES,
  FLEXIBLE_BARTER_UNLOCK_LEVEL,
  ITEMS,
  MARKET_GOODS,
  PRODUCTS_TIER0,
  PRODUCT_PRICES,
  RAGS,
  RECIPES,
  RESOURCES,
  RESOURCES_TIER0,
  RESOURCES_TIER1,
  SILK_GOODS,
  STARTING_STOCK,
} from "@/lib/game/constants/goods";
import {
  COLD_LEG_CHANCE,
  COLD_LEG_WARMTH,
  GARMENTS,
  GARMENT_DECAY_COLD_LEG,
  GARMENT_DECAY_PER_LEG,
  MEND_GOLD_PER_POINT,
  RAGS_AT_PORT_COLD,
  RAG_SCRAP_VALUE,
  REFIT_POINTS,
  REWEAVE_GOOD,
  REWEAVE_RAGS,
} from "@/lib/game/constants/garments";
import { BOONS, MODULES } from "@/lib/game/constants/drafts";
import {
  CREW_LOSS_AFTER_HUNGRY_LEGS,
  CREW_NAMES,
} from "@/lib/game/constants/crew";
import { guideText, tutorialSteps } from "@/lib/game/constants/copy";
import { loadServerConfig } from "@/lib/config";
import { db } from "@/lib/db";
import {
  allyFor,
  dealCards,
  dealRoles,
  flourishById,
  flourishDeck,
  flourishLine,
  roleCard,
  hiddenCardCount,
  type Flourish,
  type GambitRole,
} from "@/lib/game/gambit";
import {
  AUDIT_FROM_ROUND,
  AUDIT_REVEAL_COUNT,
  AUDIT_WINDOW,
  auditCarried,
  auditSeed,
  drawAudit,
  fulfillmentLine,
  normalizeOrderFills,
} from "@/lib/game/audit";
import {
  OBJECTIVE_DECK,
  SEAT_BANDS,
  drawObjective,
  objectiveSeed,
  objectiveTotalItems,
  seatBand,
  widestObjectivePayout,
} from "@/lib/game/objectives";
import {
  TELEMETRY_FAMILY,
  TELEMETRY_VERSION,
  normalizeRecord,
  readStoredRecord,
  telemetryEvent,
  voyageIdFor,
  type TelemetryRecord,
} from "@/lib/game/telemetry";
import {
  WIN_RATE_TARGETS,
  bandVerdict,
  readSwings,
  readWinRates,
  type VoyageOutcome,
} from "@/lib/game/balance";
import {
  LAUNCH_GATE_IDS,
  readDashboard,
  type DashboardOutcome,
  type DashboardReading,
} from "@/lib/game/dashboard";
import { LAUNCH_MINIMUM_VOYAGES, readLaunchVerdict } from "@/lib/game/gates";
import { checkSave, snapshotFromSave } from "@/lib/game/integrity";
import {
  MODES,
  MODE_ORDER,
  auditOpensAt,
  modeConfig,
  voyageRoundsFor,
  type GameMode,
} from "@/lib/game/mode";
import {
  UNLOCKS,
  UNLOCK_EARNED_AT,
  UNLOCK_ORDER,
  normalizePhrase,
  unlockForPhrase,
  unlockLineFor,
} from "@/lib/unlock";
import {
  closesRound,
  isGatedPhase,
  lapPhases,
  lapSuccessor,
  openingPhase,
} from "@/lib/game/checkpoint";
import {
  ENTRY_PHASE,
  LEG_PHASE_ORDER,
  PHASE_FACES,
  isLegPhase,
  normalizePhase,
  phaseFace,
} from "@/lib/game/phases";
import {
  MAROON_SHARE,
  PORT_SHIFT_FRACTION,
  maroonCarried,
  maroonKeptGold,
  normalizePortShift,
  portShiftLine,
  portShiftMultiplier,
  type PortShift,
} from "@/lib/game/maroon";
import { marketCountsFor } from "@/lib/game/difficulty";
import { unlockedPorts } from "@/lib/game/pools";
import {
  BROKER_PAYOUT_TARGET,
  PIRATE_STANDING_FLOOR,
  evaluateVictory,
  flourishMet,
  readEnding,
  readPeerTradeProfit,
  victoryLine,
  type CaptainEnding,
} from "@/lib/game/victory";
import {
  createInitialGameState,
  flatWorkerRoster,
  type EscortClaim,
  type EscortCover,
  type GameContext,
  type GameState,
  type OrderCard,
  type OrderFill,
  type Phase,
  type Worker,
} from "@/lib/game/types";
import {
  crewSize,
  feedCrew,
  normalizeLarder,
  normalizeLarderFedRound,
  onShortRations,
  shortRationsYield,
} from "@/lib/game/larder";
import { survivalLayerOn } from "@/lib/game/flags";
// [C2: crew loss by name] The rule that takes a hand, beside the Larder it
// reads: hunger is one subject here, counted in one module and paid in the
// next, so the checks below import from both rather than reaching through
// either.
import {
  crewLossRuleOn,
  healCrewIdentity,
  normalizeCrewLost,
  normalizeHungryLegs,
  settleHunger,
} from "@/lib/game/crew";
// [C3: garments and the cold] The wardrobe, read beside the two layers it
// answers to: the clothes are goods the provisions layer governs and the
// weather is drawn from the voyage the crew above is sailing, so these
// checks import from all three rather than reaching through any one.
import {
  garmentSpec,
  garmentWarmth,
  garmentsLayerOn,
  isFrostbitten,
  legIsCold,
  normalizeGarments,
  normalizeGarmentsTickRound,
  shortOfWarmth,
  tickGarments,
  warmthScore,
  warmthText,
  wearGarment,
} from "@/lib/game/garments";
// [C4: three foods, spoilage and the split hold] The pantry, the hold it
// sits in and the two switches the split answers to, read together: what
// the crew eats, what the sea takes back and what the ship has room for
// are one subject down here, so these checks import from all three rather
// than reaching through any one.
import {
  addLot,
  drawMeals,
  foodRoomMeals,
  larderMeals,
  mealsOf,
  normalizeLarderLots,
  normalizeLarderSpoilRound,
  pantryLines,
  preserveFood,
  reconcileLarder,
  tickSpoilage,
} from "@/lib/game/foods";
import {
  cargoSlots,
  holdCapacityOn,
  storeRoomMeals,
  storesMealCeiling,
  storesSlots,
  usedCargoSlots,
  usedHoldSlots,
  usedStoreSlots,
} from "@/lib/game/hold";
import {
  bazaarRumorsOn,
  escortContractsOn,
  pathDraftOn,
  pathOrdersOn,
  splitHoldOn,
} from "@/lib/game/flags";
import { cargoCapacity, cargoRoom, provisionFood } from "@/lib/game/larder";
import {
  acceptBarterOffer,
  agreeConsent,
  applyEscortSide,
  applyMarketLeans,
  applyPortShift,
  assignTask,
  autoCommit,
  calcTransportCost,
  canFillOrder,
  canSellEscort,
  completeOrder,
  consentFeeFor,
  consentOfferStanding,
  consentPartyBusy,
  coverFromBoard,
  escortCoverage,
  escortCoverOf,
  expireConsent,
  failSeat,
  handleModuleSelect,
  hireWorker,
  lockedBehind,
  maroonSeat,
  nextPhase,
  normalizeConsentLedger,
  normalizeEscortState,
  openOrderCount,
  pathOrderOf,
  postBarterOffer,
  purchaseCard,
  refundBarterOffer,
  resetConsentLedger,
  resetEscortLeg,
  resolvePirateAttack,
  restartGame,
  settleBarterTrade,
  snapToCheckpoint,
  startBoonDrafting,
  tallyPurchasesByResource,
  visibleContracts,
  ESCORT_SELLER_PATH,
  type EscortContract,
  type MarketLeans,
} from "@/lib/game/engine";
// [D6: Free Captain: Opportunist] The borrow's own block, imported beside
// the bazaar's for the reason that one is imported at all: what the
// allowance is and what the order board does with it are one subject, and
// the checks below are about the second. canFillOrder and completeOrder
// are already imported above, because they are the manifest's own guards
// rather than this feature's, and the two functions here are the ability
// the guards ask about.
import {
  normalizeOpportunistBorrows,
  opportunistBorrowsLeft,
  opportunistBorrowsTaken,
  opportunistLine,
  opportunistMayBorrow,
  opportunistPayout,
  OPPORTUNIST_PATH,
} from "@/lib/game/engine";
// [D7: the draft, and switching] The deal's own arithmetic and the two
// writes a path leaves in a save, imported beside the borrow's for the
// reason every feature's block is imported here: what the rule means and
// what the engine does with it are one subject, and the checks below are
// about both. The rule module is pure, so the deck, the pass, the window
// and the fee are readable here without a server; the two apply functions
// and the guard the panel and the room share come from the engine, which is
// where they live.
import {
  applyDraftPath,
  applyPathSwitch,
  pathSwitchBlocked,
  pathSwitchOpenLine,
} from "@/lib/game/engine";
import {
  DRAFT_AUTO_PICK,
  draftComposition,
  draftDeck,
  draftHands,
  keepFrom,
  normalizePathSwitchLeg,
  passLeft,
  pathSwitchFee,
  pathSwitchPhase,
  pathSwitchWindow,
} from "@/lib/game/draft";
import { createRng } from "@/lib/game/rng";
// [D5: Aroma: the Bazaar Rumor] The bazaar's own block, imported beside the
// bench's for the reason that one is imported here at all: the record the
// table hears and what the market does with it are one subject, and the
// checks below are about the second. The one promise this file makes about
// the wire is the row shape, and the type below is the shape a client is
// handed rather than the one the room holds, which is the feature's secret
// written as a type.
import {
  canPublishRumor,
  bazaarGoods,
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
} from "@/lib/game/engine";
// [D4: Loom: the Refit] The bench's own block, imported beside the escort's
// for the reason that block is imported here at all: what the record means
// and what the engine does with it are one subject, and the checks below are
// about the second. The consent primitive's rules are above, because the two
// markets are made of them.
import {
  applyRefitSide,
  buyRag,
  canSellRefit,
  mendGarment,
  normalizeRefitState,
  ragsAtPort,
  ragsLeftAtPort,
  refitRoomFor,
  refitSellerBusy,
  refitsOn,
  reweaveRags,
  REFIT_SELLER_PATH,
  type RefitContract,
} from "@/lib/game/engine";
// The record a captain writes and the few readings of it the panel and the
// engine share. Imported beside the engine for the same reason the checks
// below sit where they do: what the record means and what the engine does
// with it are one subject.
import {
  MAX_STANDING_BUYS,
  defaultStandingOrders,
  normalizeStandingOrders,
  standingBoon,
  standingOrdersLive,
  type StandingOrders,
} from "@/lib/game/standing";
import {
  VOYAGE_LOG_CAP,
  VOYAGE_LOG_KINDS,
  appendVoyageLog,
  normalizeVoyageLog,
  normalizeVoyageLogEntry,
  voyageLogEntry,
  voyageLogLine,
  type VoyageLogEntry,
  type VoyageLogFacts,
  type VoyageLogKind,
} from "@/lib/game/voyage-log";
// [D1: the path configuration module, and the naming change] The record
// itself, the two knobs its two hold modifiers are built out of, and the
// Renown ladder its ceilings are read off. The checks below are about the
// shape of the record rather than about a voyage, so they import the
// record's own ingredients rather than reaching through it.
import {
  PATHS,
  PATH_IDS,
  lockingPathFor,
  normalizePath,
  pathConfig,
  pathLockLine,
  type PathId,
} from "@/lib/game/paths";
import { RENOWN_MAX_LEVEL, RENOWN_TITLES } from "@/lib/game/legacy";
import { BANNED_ACCOUNT_ERROR } from "@/lib/auth";
import { SOCKET_PATH } from "@/lib/realtime-endpoint";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { io as connect, type Socket } from "socket.io-client";

const BASE =
  process.env.SMOKE_BASE_URL ?? `http://localhost:${loadServerConfig().port}`;

const suffix = Math.random().toString(36).slice(2, 8);
const password = "smoke-test-password";

type Captain = {
  id: string;
  token: string;
  cookie: string;
  username: string;
};

// Just enough of each wire payload to make a claim about it. A message is
// named only by the fields the checks read, so an assertion here cannot
// quietly depend on something the server never promised.
type WireMessage = {
  id: string;
  content: string;
  createdAt: string;
  mine?: boolean;
  sender: { id: string };
  recipient?: { id: string };
};

// What a joiner is handed on `chat:history`: the harbor's conversation and
// only those private threads this captain is part of.
type WireHistory = {
  roomId: string;
  harbor: WireMessage[];
  direct: WireMessage[];
};

type WireOffer = {
  id: string;
  fromUserId: string;
  fromName: string;
  offerItem: string;
  offerAmount: number;
  requestItem: string;
  requestAmount: number;
  targetUserId?: string;
  createdAt: string;
  flexible?: boolean;
};

// One row of the operator console's roster, as far as these checks read
// it. The counts and the online flag are for the operator's eyes and are
// not asserted on here.
type WireAccount = {
  id: string;
  username: string;
  role: string;
  bannedAt: string | null;
};

// The roster a console is handed, on admin:accounts.
type WireRoster = { accounts: WireAccount[] };

// What a bulk action reports back on admin:bulk-result: how many accounts
// the request named, how many of them changed, and the reason for each one
// that did not.
type WireBulkReport = {
  action: string;
  requested: number;
  applied: number;
  skipped: string[];
};

// One entry off the private channel, and the room it belongs to. role is
// present only when the entry is a dealt card, which is the one wire
// field in the protocol that can name an alignment. The other two fields
// are the ones a dealt card may also carry: the personal goal an Honest
// captain was dealt, and the one other Pirate a pair of them is told
// about. Both are absent on every entry that has nothing to say, which is
// why they are optional here rather than nullable.
type WireDelivery = {
  roomId: string;
  entry: {
    kind: string;
    text: string;
    role?: string;
    flourish?: string;
    ally?: { userId: string; name: string };
  };
};

// [H8: the reveal and the replay ledger] One captain's card, face up, as
// far as these checks read it. The fields are the ones under test rather
// than the whole payload, so an assertion here cannot come to depend on
// something the frame never promised.
type WireRevealed = {
  userId: string;
  displayName: string;
  role: string | null;
  flourishId: string | null;
  won: boolean;
  crowned: boolean;
  bankrupt: boolean;
  marooned: boolean;
  forged: boolean;
  gold: number;
  reputation: number;
  peerTradeProfit: number;
  delivered: Record<string, number>;
  fills: {
    round: number;
    port: string;
    items: { type: string; qty: number }[];
    reward: number;
  }[];
};

type WireReveal = {
  roomId: string;
  objective: { id: string; name: string };
  fleetTrace: { round: number; delivered: Record<string, number> }[];
  captains: WireRevealed[];
};

const failures: string[] = [];

/**
 * Whether a string carries a dash of any kind: an en dash, an em dash, or a
 * doubled hyphen. The house rule for every line a captain reads, and the
 * one rule a regex can hold this file to.
 *
 * The two dash characters are built from their code points and the doubled
 * hyphen is spelled as a quantifier, so that the check which keeps those
 * sequences out of the tree does not keep a copy of them in it. Both halves
 * are deliberate. An escape sequence would do the same job at runtime and
 * stop doing it the moment this file makes another pass through a layer
 * that resolves escapes, which is exactly how the manifest line's own check
 * came to carry the characters it was written to forbid.
 */
const CARRIES_A_DASH = new RegExp(
  `[${String.fromCharCode(0x2013, 0x2014)}]|-{2}`,
);

/**
 * The stricter house rule for the words a mode hands a captain: no hyphen
 * of any kind, single or doubled, beside the two dash characters the rest
 * of the tree is held to.
 *
 * A second expression rather than a widening of the first, because the two
 * rules answer different questions. The tree wide rule is about typography
 * (a doubled hyphen standing in for an em dash), and it cannot be widened:
 * `--` is how a CSS custom property is read, so every `var(--w-dawn)` in
 * the tree would fail it. This one is about a mode's prose, where a hyphen
 * has no work to do.
 */
const CARRIES_A_HYPHEN = new RegExp(
  `[-${String.fromCharCode(0x2013, 0x2014)}]|-{2}`,
);

/**
 * Every source file under a directory, for a check whose claim is about
 * the tree rather than about a file.
 *
 * Here rather than inside the check that first needed it, because a second
 * feature needed one too and a second copy of a directory walk is how two
 * scans of the same tree end up reading different files. Read only, and
 * only .ts and .tsx: the claim every caller makes is about source.
 */
function walkSrc(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkSrc(full));
      continue;
    }
    if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * The same rule, read off a file rather than off a claim about it. Whole
 * files rather than the strings a captain reads, because the directive
 * asks the comments to hold it too, and every file named here is read by
 * whoever maintains the record next.
 *
 * The path is relative to this script's own directory rather than to the
 * working directory, so the check holds wherever the suite is run from.
 */
function carriesADash(relative: string): boolean {
  // A directory is read as all of it, for the file that became one: the
  // wire's shapes moved into src/types/realtime/, and a rule that read one
  // of the new modules would pass while the other fourteen carried a dash.
  const full = join(import.meta.dirname, "..", relative);
  const files = statSync(full).isDirectory() ? walkSrc(full) : [full];
  return files.some((file) => CARRIES_A_DASH.test(readFileSync(file, "utf8")));
}

/**
 * A component's source with its comments taken out, for a check about what
 * a screen prints rather than about what its file says.
 *
 * The two are different on purpose in this tree: a comment here quotes the
 * sentence it replaced, because that is what makes a repair readable a year
 * later, so a check that read the raw file would fail on the note that
 * explains the fix. Only the shapes this tree actually writes are stripped,
 * which makes this the codebase's own convention rather than a parser: a
 * JSX comment, a block comment, and a line whose first characters are two
 * slashes. A URL inside a string survives all three, since none of them
 * matches a line that begins with anything else.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

/**
 * Runs a read with one environment switch set, and always puts the switch
 * back the way it found it, including when the read throws: a leaked value
 * would make every check after this one read a build the operator did not
 * ask for.
 *
 * One helper rather than one per feature, because the survival layer is
 * two switches over one family (the Larder in C1, crew loss in C2) and a
 * second copy of this try/finally is how one of them ends up restoring the
 * wrong value. The variable name is passed in rather than closed over for
 * the same reason: the check that reads a switch has to name the one it is
 * actually testing.
 */
// The two harbors a switch is read in, named once each.
//
// Every switch this release added is Gambit's, so the feature blocks below
// read them in Gambit: a check that held a switch on in the shipped mode
// would be checking that a Classic table received a system the mode does
// not have, which is the bug the mode boundary exists to prevent rather
// than the behaviour any of them are about. CLASSIC is read by the one
// block that holds the boundary itself, at the end of the family.
const GAMBIT: GameMode = "ocean_gambit";
const CLASSIC: GameMode = "classic";

// One switch, read in one mode, as a thunk withEnv can hand an environment
// value to. The mode is bound here rather than written at each of the forty
// odd call sites below, which is the same reason the switch itself takes it
// as an argument: one place to get the reading right.
function switchFor(
  mode: GameMode,
  read: (mode: unknown) => boolean,
): () => boolean {
  return () => read(mode);
}

// A voyage of the mode the switches below belong to, which is the fixture
// every one of them is read against.
//
// It is a helper rather than a `mode` argument written out at each of the
// seventy odd call sites for the reason the switch's own reading is: one
// place to get it right. The failure it prevents is specific and it is the
// one this boundary makes possible, which is a check that reads a Classic
// state while claiming to read a switch. Every one of the nine layers is
// off in the founding mode whatever the environment says, so a fixture
// built without a mode measures the boundary and reports it as the rule
// under test: the layer would look switched off when it was merely outside
// its mode, and the check would pass for a reason that has nothing to do
// with what it says.
//
// An explicit `mode` in the init still wins, because the spread puts it
// last, which is what lets the couple of checks that compare the two modes
// build both of them through this one helper.
function voyageState(
  init: Parameters<typeof createInitialGameState>[0] = {},
): GameState {
  return createInitialGameState({ mode: GAMBIT, ...init });
}

function withEnv<T>(name: string, value: string | undefined, read: () => T): T {
  const was = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return read();
  } finally {
    if (was === undefined) delete process.env[name];
    else process.env[name] = was;
  }
}

// [H9: the unlock code] The phrase every sealed harbor in this file is
// opened with, read out of the table rather than typed here. A suite that
// spelled the words itself would be testing its own copy of them rather
// than the one a host types, and would go on passing after the table had
// moved to something else.
const LEDGER_PHRASE = UNLOCKS.second_ledger.phrase;

// The manual the repo ships, read from this file's own directory rather
// than from the working directory, so the checks that hold the manual to
// the table pass wherever this suite is run from.
const MANUAL = readFileSync(
  join(import.meta.dirname, "..", "README.md"),
  "utf8",
);

function check(condition: boolean, description: string): void {
  if (condition) {
    console.log(`  ok    ${description}`);
    return;
  }
  console.log(`  FAIL  ${description}`);
  failures.push(description);
}

async function call<T>(
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Promise<{ status: number; body: T }> {
  const { cookie, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(rest.headers ?? {}),
    },
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

function cookieFrom(res: Response): string {
  const raw = res.headers.getSetCookie?.() ?? [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

/**
 * Registers a captain and keeps the token and cookie the app hands back.
 *
 * The label has a short leash: a username is capped at 20 characters and
 * this builds `smoke_<label>_<6 random>`, so a label longer than eight
 * characters is refused by the server rather than by anything here.
 */
async function signUp(label: string): Promise<Captain> {
  const username = `smoke_${label}_${suffix}`;
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      displayName: `Smoke ${label}`,
    }),
  });
  const text = await res.text();
  if (res.status !== 200) {
    throw new Error(`Could not register ${username}: ${res.status} ${text}`);
  }
  const body = JSON.parse(text) as { user: { id: string }; token: string };
  return {
    id: body.user.id,
    token: body.token,
    cookie: cookieFrom(res),
    username,
  };
}

/**
 * Asks the realtime layer for a Quick Start seat and resolves with the
 * harbor it hands back, or null if no answer arrives.
 *
 * The emit is the actual queue request. A REST call cannot make it,
 * because the queue lives in the realtime layer's memory and a route
 * handler runs in a different bundle with its own empty copy of it.
 */
function requestQuickMatch(
  socket: Socket,
  difficulty: string,
): Promise<{ roomId: string } | null> {
  return new Promise((resolve) => {
    const onMatched = (data: { roomId: string }) => {
      clearTimeout(timer);
      socket.off("quickstart:matched", onMatched);
      socket.off("quickstart:error", onError);
      resolve(data);
    };
    const onError = () => {
      clearTimeout(timer);
      socket.off("quickstart:matched", onMatched);
      socket.off("quickstart:error", onError);
      resolve(null);
    };
    const timer = setTimeout(() => {
      socket.off("quickstart:matched", onMatched);
      socket.off("quickstart:error", onError);
      resolve(null);
    }, 12000);
    socket.on("quickstart:matched", onMatched);
    socket.on("quickstart:error", onError);
    socket.emit("quickstart:join", { difficulty });
  });
}

/**
 * Waits for one socket event, optionally only accepting payloads a
 * predicate agrees with, and resolves null if nothing arrives in time.
 */
function waitForEvent<T>(
  socket: Socket,
  event: string,
  match?: (payload: T) => boolean,
  timeoutMs = 8000,
): Promise<T | null> {
  return new Promise((resolve) => {
    const onEvent = (payload: T) => {
      if (match && !match(payload)) return;
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      resolve(null);
    }, timeoutMs);
    socket.on(event, onEvent);
  });
}

/** Opens a socket, authenticates it, and resolves once the server says yes. */
function openAuthedSocket(captain: Captain): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(BASE, {
      path: SOCKET_PATH,
      transports: ["websocket"],
      extraHeaders: { Cookie: captain.cookie },
      reconnection: false,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`Socket for ${captain.username} never authenticated.`));
    }, 10000);

    socket.on("connect", () => socket.emit("auth", { token: captain.token }));
    socket.on("auth:ok", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on("auth:fail", (payload: { error?: string }) => {
      clearTimeout(timer);
      socket.close();
      reject(new Error(`Socket auth refused: ${payload?.error ?? "unknown"}`));
    });
    socket.on("connect_error", (err: Error) => {
      clearTimeout(timer);
      socket.close();
      reject(err);
    });
  });
}

/**
 * [J1: the private information review] The shapes a hidden field takes on
 * the wire, and the sweep that reads for them.
 *
 * The private information sections used to look for the one hidden card's
 * role word. They now look for every shape a secret can be carried in:
 * an alignment, a personal goal, and a Pirate's ally, on every socket in
 * the harbor, with a card the only frame allowed to carry one.
 *
 * Fields rather than bare words, and each one matched with the value it
 * would have to hold. The mode's public copy names its own roles, and an
 * account row carries a role of "captain" or "admin", so a sweep that
 * searched for the word would report a guide and a roster as leaks and
 * would have to be narrowed until it stopped meaning anything. What a
 * leak actually looks like is a field: "role" with one of the three
 * alignments in it, a "flourish" id, or an "ally" object.
 *
 * The last shape is the alignment as a value under any name at all,
 * because the three above it are only as good as the field names this
 * tree happens to use. A payload that smuggled "pirate" under a key
 * called anything else would pass all three, and the word itself is
 * something no broadcast in these harbors has any reason to carry.
 *
 * Every shape carries a sample frame it must match, checked once before
 * any of it is pointed at a harbor, because a pattern that matches
 * nothing is a gate that cannot fail.
 */
const HIDDEN_FIELD_SHAPES = [
  {
    label: "a role field",
    pattern: /"role"\s*:\s*"(honest|pirate|broker)"/,
    sample: '{"role":"pirate"}',
  },
  {
    label: "a flourish field",
    pattern: /"flourish"\s*:\s*"/,
    sample: '{"flourish":"keep-the-cordage-dry"}',
  },
  {
    label: "an ally field",
    pattern: /"ally"\s*:\s*\{/,
    sample: '{"ally":{"userId":"one","name":"Two"}}',
  },
  {
    label: "an alignment under another name",
    pattern: /"(honest|pirate|broker)"/,
    sample: '{"mystery":"broker"}',
  },
];

/**
 * The hidden fields one socket's frames carry outside a card. A card is
 * the one frame allowed to hold any of them, and the checks that read a
 * dealt card back against the row it came from are what prove the values
 * in it belong to the captain holding it. Everything else on the wire is
 * a broadcast, and a broadcast carrying one of these is the defect the
 * private information sections exist to catch.
 */
function leakedHiddenFields(
  frames: readonly { event: string; text: string }[],
): string[] {
  const found: string[] = [];
  for (const frame of frames) {
    if (frame.event === "private:entry") continue;
    for (const shape of HIDDEN_FIELD_SHAPES) {
      if (shape.pattern.test(frame.text)) {
        found.push(`${frame.event} carries ${shape.label}`);
      }
    }
  }
  return found;
}

/**
 * Registers an operator through /api/admin/register. Separate from signUp
 * because this route takes the setup code and is the only way an account
 * with the administrator role comes into being.
 *
 * A refused setup code is an answer rather than an error here, since that
 * is one of the things the caller is checking for. Any other answer is
 * neither: it means the request itself was wrong, so it throws with the
 * server's own words rather than being reported as a refused code.
 */
async function registerOperator(
  label: string,
  setupCode: string,
): Promise<{
  status: number;
  error: string | null;
  role: string | null;
  captain: Captain | null;
}> {
  const username = `smoke_${label}_${suffix}`;
  const res = await fetch(`${BASE}/api/admin/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      displayName: `Smoke ${label}`,
      setupCode,
    }),
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as { error?: string }) : {};
  if (res.status === 403) {
    return {
      status: res.status,
      error: body.error ?? null,
      role: null,
      captain: null,
    };
  }
  if (res.status !== 200) {
    throw new Error(
      `The operator route answered ${res.status}: ${body.error ?? text}`,
    );
  }
  const made = JSON.parse(text) as {
    user: { id: string; role: string };
    token: string;
  };
  return {
    status: res.status,
    error: null,
    role: made.user.role,
    captain: {
      id: made.user.id,
      token: made.token,
      cookie: cookieFrom(res),
      username,
    },
  };
}

/** Signs an existing account in and hands back the session it made. */
async function signInAgain(
  username: string,
): Promise<{ cookie: string; token: string } | null> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (res.status !== 200) return null;
  const body = JSON.parse(await res.text()) as { token: string };
  return { cookie: cookieFrom(res), token: body.token };
}

/** One row out of a roster, or undefined when the account is not on it. */
function accountIn(
  roster: WireRoster | null,
  userId: string,
): WireAccount | undefined {
  return roster?.accounts.find((a) => a.id === userId);
}

async function main(): Promise<void> {
  console.log(`\nSmoke testing ${BASE}\n`);

  // Everything one smoke run accumulates, in one object. The sections of
  // the run are functions rather than one sixteen thousand line body, and
  // this is what they share: the captains this run signs up, the harbor it
  // opens, the sockets it holds open, and the flag that arms cleanup.
  //
  // It is one object rather than eleven closed over variables because a
  // section that reaches back into its caller's scope cannot be read on
  // its own, and reading a section on its own is the whole reason to split
  // a file this size. A field here is a fact about the run; a local inside
  // a section is that section's business.
  const run = {
    host: null as Captain | null,
    guest: null as Captain | null,
    third: null as Captain | null,
    // Accounts this run creates that belong to no harbor, so there is
    // nothing to tear down for them but the accounts themselves. The
    // messages they send each other cascade away with them.
    extraAccounts: [] as Captain[],
    roomId: null as string | null,
    quickStartRoomId: null as string | null,
    // Harbors opened for the one walk that sails a voyage rather than
    // probing a route. They are this run's, so cleanup deletes them, and
    // they are listed here rather than reused from the fields above
    // because that walk needs a room whose whole voyage it drives itself.
    lapRoomIds: [] as string[],
    sockets: [] as Socket[],
    // Only armed once the first account has been proven visible to this
    // process's database connection. Until then, nothing is deleted.
    cleanupIsSafe: false,
  };

  // Every harbor that already exists before this run starts. Cleanup only
  // ever deletes a room this run created, so a Quick Start that seats the
  // test captains into somebody's real open harbor cannot take that harbor
  // down with it.
  const preExistingRoomIds = new Set(
    (await db.room.findMany({ select: { id: true } })).map((r) => r.id),
  );

  try {
    console.log("Accounts");
    run.host = await signUp("host");

    // Safety interlock. The account was just written through the API; if
    // this connection cannot see it, the server and this script are on
    // different databases and the cleanup below would silently do
    // nothing. Stop now, before a second account and a room exist.
    const visible = await db.user.findUnique({
      where: { username: run.host.username },
      select: { id: true },
    });
    if (!visible || visible.id !== run.host.id) {
      throw new Error(
        `The server at ${BASE} is writing to a different database than this script reads.\n` +
          `This script resolves DATABASE_URL from this project's .env, so start the server the same way,\n` +
          `or export DATABASE_URL first. Nothing has been deleted.`,
      );
    }
    run.cleanupIsSafe = true;

    run.guest = await signUp("guest");
    check(Boolean(run.host.token), "the host receives a session token");
    check(Boolean(run.guest.token), "the guest receives a session token");

    console.log("\nThe signed in captain");
    const me = await call<{ user: { id: string } | null }>("/api/auth/me", {
      cookie: run.host.cookie,
    });
    check(me.status === 200, "GET /api/auth/me answers");
    check(
      me.body?.user?.id === run.host.id,
      "the session cookie identifies the host",
    );

    const anonymous = await call<{ user: unknown }>("/api/auth/me");
    check(
      anonymous.body?.user === null,
      "an anonymous visitor is not signed in",
    );

    console.log("\nThe Lobby keeps its messages");
    // The one conversation the app is meant to write down, and the reason
    // the rule about a voyage is specific rather than absolute. Two
    // captains who are both ashore have no voyage for their thread to
    // belong to, so it goes to the database and is meant to still be there
    // tomorrow. These two are signed up here and never take a seat
    // anywhere, which is the branch that reaches it.
    const ashore = await signUp("ashore");
    const quay = await signUp("quay");
    run.extraAccounts.push(ashore, quay);
    const ashoreSocket = await openAuthedSocket(ashore);
    const quaySocket = await openAuthedSocket(quay);
    run.sockets.push(ashoreSocket, quaySocket);

    const quayLine = "meet me at the quay before the tide turns";
    const heardAtQuay = waitForEvent<WireMessage>(
      quaySocket,
      "chat:dm",
      (payload) => payload?.content === quayLine,
    );
    const heardAtAshore = waitForEvent<WireMessage>(
      ashoreSocket,
      "chat:dm",
      (payload) => payload?.content === quayLine,
    );
    ashoreSocket.emit("chat:dm", { recipientId: quay.id, content: quayLine });
    const quayGot = await heardAtQuay;
    const ashoreGot = await heardAtAshore;
    check(quayGot?.content === quayLine, "an ashore captain reaches another");
    check(quayGot?.mine === false, "who does not read it as their own");
    check(ashoreGot?.mine === true, "and the sender is given their own copy");

    const writtenDown = await db.message.findMany({
      where: { senderId: ashore.id, recipientId: quay.id },
      select: { roomId: true, content: true },
    });
    check(
      writtenDown.length === 1,
      "a message between two captains ashore is written down",
    );
    check(
      writtenDown[0]?.roomId === null,
      "against no harbor, because it belongs to none",
    );
    check(
      writtenDown[0]?.content === quayLine,
      "and what was written is what was sent",
    );

    const lobbyHistory = await call<{ messages: Array<{ content: string }> }>(
      `/api/messages/dm/${quay.id}`,
      { cookie: ashore.cookie },
    );
    check(lobbyHistory.status === 200, "the history route answers");
    check(
      (lobbyHistory.body?.messages ?? []).some((m) => m.content === quayLine),
      "and hands the conversation back, which is what the Lobby shows",
    );

    console.log("\nThe harbor square");
    // The lobby's own channel, which is the public half of the rail's chat.
    // Public is a shape rather than a flag: the row has no harbor and no
    // recipient, and that absence is the whole of what lets every captain
    // ashore read it and no captain at sea hear it. These two are still
    // standing in the Lobby, so both of them are in the square.
    const squareLine = "the tide is turning at the north quay";
    const heardAtQuaySquare = waitForEvent<{ message: WireMessage }>(
      quaySocket,
      "chat:lobby",
      (payload) => payload?.message?.content === squareLine,
    );
    const heardAtAshoreSquare = waitForEvent<{ message: WireMessage }>(
      ashoreSocket,
      "chat:lobby",
      (payload) => payload?.message?.content === squareLine,
    );
    ashoreSocket.emit("chat:lobby", { content: squareLine });
    const quaySquare = await heardAtQuaySquare;
    const ashoreSquare = await heardAtAshoreSquare;
    check(
      quaySquare?.message?.content === squareLine,
      "a line on the square reaches the other captain in the Lobby",
    );
    check(
      quaySquare?.message?.mine === false,
      "who does not read it as their own",
    );
    check(
      ashoreSquare?.message?.mine === true,
      "and the sender is given their own copy",
    );

    const squareWritten = await db.message.findMany({
      where: { senderId: ashore.id, content: squareLine },
      select: { roomId: true, recipientId: true },
    });
    check(squareWritten.length === 1, "the square's line is written down");
    check(
      squareWritten[0]?.roomId === null &&
        squareWritten[0]?.recipientId === null,
      "with neither a harbor nor a recipient, which is what makes it public",
    );

    const squareHistory = await call<{ messages: Array<{ content: string }> }>(
      "/api/messages/lobby",
      { cookie: quay.cookie },
    );
    check(squareHistory.status === 200, "the square's history route answers");
    check(
      (squareHistory.body?.messages ?? []).some(
        (m) => m.content === squareLine,
      ),
      "and hands the square back to a captain who did not say it",
    );
    check(
      (squareHistory.body?.messages ?? []).every((m) => m.content !== quayLine),
      "without the private thread written at the same moment",
    );

    console.log("\nOpening and joining a harbor");
    const created = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: run.host.cookie,
        body: JSON.stringify({
          name: `Smoke harbor ${suffix}`,
          isPublic: false,
        }),
      },
    );
    check(created.status === 200, "the host can create a room");
    if (created.status !== 200) throw new Error("No room, stopping here.");
    run.roomId = created.body.room.id;
    const code = created.body.room.code;

    const joined = await call<{ room: { id: string } }>("/api/rooms/join", {
      method: "POST",
      cookie: run.guest.cookie,
      body: JSON.stringify({ code }),
    });
    check(joined.status === 200, "the guest can join with the room code");

    const detail = await call<{
      room: {
        memberCount: number;
        members: Array<{ username: string }>;
        host: { id: string };
      };
    }>(`/api/rooms/${run.roomId}`, { cookie: run.host.cookie });
    check(
      detail.body?.room?.memberCount === 2,
      "the harbor reads back two members",
    );
    check(
      detail.body?.room?.host?.id === run.host.id,
      "the host is recorded as the host",
    );

    console.log("\nThe realtime channel");
    const hostSocket = await openAuthedSocket(run.host);
    run.sockets.push(hostSocket);
    check(hostSocket.connected, "the host socket is connected on the app port");

    const guestSocket = await openAuthedSocket(run.guest);
    run.sockets.push(guestSocket);
    check(
      guestSocket.connected,
      "the guest socket is connected on the app port",
    );

    const presence = await new Promise<Array<{ username: string }>>(
      (resolve) => {
        const timer = setTimeout(() => resolve([]), 5000);
        hostSocket.on(
          "presence:update",
          (payload: { users?: Array<{ username: string }> }) => {
            clearTimeout(timer);
            resolve(payload?.users ?? []);
          },
        );
        hostSocket.emit("presence:request");
      },
    );
    const online = presence.map((u) => u.username);
    check(
      online.includes(run.host.username),
      "presence reports the host online",
    );
    check(
      online.includes(run.guest.username),
      "presence reports the guest online",
    );

    console.log("\nSeeing each other's live data");
    const hostId = run.host.id;
    const guestToken = run.guest.token;

    // Both captains take a seat in the harbor's socket channel. The
    // server only relays room traffic to sockets that have joined one.
    const joinedHost = waitForEvent(hostSocket, "room:members");
    const joinedGuest = waitForEvent(guestSocket, "room:members");
    hostSocket.emit("room:join", { roomId: run.roomId });
    guestSocket.emit("room:join", { roomId: run.roomId });
    const [hostRoster, guestRoster] = await Promise.all([
      joinedHost,
      joinedGuest,
    ]);
    check(hostRoster !== null, "the host joined the harbor channel");
    check(guestRoster !== null, "the guest joined the harbor channel");

    // The square belongs to the Lobby, and a captain at sea has no surface
    // for it. The guest has just taken a seat, so a line posted now is
    // heard by the two captains still ashore and by nobody who sailed.
    const squareLeaksToSea: string[] = [];
    guestSocket.on("chat:lobby", (payload: { message?: WireMessage }) => {
      squareLeaksToSea.push(payload?.message?.content ?? "");
    });
    const ashoreOnDeck = "the harbor gate is open for the evening watch";
    const heardAshoreAtSea = waitForEvent<{ message: WireMessage }>(
      ashoreSocket,
      "chat:lobby",
      (payload) => payload?.message?.content === ashoreOnDeck,
    );
    const heardQuayAtSea = waitForEvent<{ message: WireMessage }>(
      quaySocket,
      "chat:lobby",
      (payload) => payload?.message?.content === ashoreOnDeck,
    );
    quaySocket.emit("chat:lobby", { content: ashoreOnDeck });
    const [shoreHeard, quayHeard] = await Promise.all([
      heardAshoreAtSea,
      heardQuayAtSea,
    ]);
    check(
      shoreHeard?.message?.content === ashoreOnDeck &&
        quayHeard?.message?.content === ashoreOnDeck,
      "the square still reaches both captains ashore",
    );
    // Both Lobby sockets have taken delivery of frames the server emitted
    // in the same loop that would have carried the guest's, so a short
    // settle is enough to tell whether the guest was handed one too.
    await new Promise((resolve) => setTimeout(resolve, 300));
    check(
      squareLeaksToSea.length === 0,
      "and is never handed to a captain who took a seat",
    );

    // The host reports a live status, the same payload the voyage screen
    // emits on every game change. The guest must receive those numbers.
    const seenStatus = waitForEvent<{
      user: { id: string };
      round: number;
      phase: string;
      phaseLabel: string;
      gold: number;
      reputation: number;
      shipLevel: number;
      renownLevel?: number;
    }>(guestSocket, "game:status", (payload) => payload?.user?.id === hostId);

    // The phase is sent in the numbering this engine used before the six
    // phase leg landed, which is what a client still running the older
    // build reports, and it is sent on purpose: the room caches and
    // rebroadcasts this frame to every captain, so the value it holds is
    // read by the roster, by the active roster the ready check waits on and
    // by the phase report. Placed rather than passed through, it reaches the
    // room as the market; passed through, it would be a roster disagreeing
    // with the voyage for every captain looking at it.
    hostSocket.emit("game:status", {
      roomId: run.roomId,
      round: 3,
      phase: 1,
      phaseLabel: "Purchase",
      gold: 777,
      reputation: 42,
      shipLevel: 2,
      gameOver: false,
      renownLevel: 6,
    });

    const status = await seenStatus;
    check(status !== null, "the other captain receives the status broadcast");
    check(
      status?.user?.id === hostId,
      "the status is labelled with its captain",
    );
    check(status?.gold === 777, "the gold travels intact");
    check(status?.reputation === 42, "the reputation travels intact");
    check(status?.round === 3, "the round travels intact");
    check(
      status?.phase === "market",
      "and a phase reported in the older numbering reaches the room under its name",
    );
    check(
      status?.phaseLabel === "Purchase",
      "while the label a client puts on itself is passed through as sent",
    );
    // The roster gates the Partial Sight peek on both captains' Renown
    // levels, so a status without one hides that peek from everybody.
    check(
      status?.renownLevel === 6,
      "the Renown level travels with the status so the peek can be allowed",
    );

    console.log("\nThe detail popup's question and answer");
    // [J1: the private information review] The one place a captain asks
    // another for a snapshot of their hold. The server used to relay the
    // answer on the sender's own word for who had asked and which room
    // the answer was about, so any authenticated captain could push a
    // forged snapshot at any account in the tree. It now holds the
    // question between the ask and the answer, and relays only what it
    // wrote down itself. These are the three ways that can go.
    // Read out here rather than inside the callbacks below, where the
    // captain the suite is holding could have been signed out from under
    // them as far as the compiler is concerned.
    const askerId = run.guest.id;
    const detailQuestions: { requesterId?: string }[] = [];
    hostSocket.on(
      "player:detail:request",
      (payload: { requesterId?: string }) => {
        detailQuestions.push(payload);
      },
    );
    const guestAnswers: { targetUserId?: string; data?: unknown }[] = [];
    guestSocket.on(
      "player:detail:response",
      (payload: { targetUserId?: string; data?: unknown }) => {
        guestAnswers.push(payload);
      },
    );

    // One. The question reaches the captain it is about, and their answer
    // reaches the captain who asked, carrying the snapshot they sent.
    guestSocket.emit("player:detail:request", {
      roomId: run.roomId,
      targetUserId: hostId,
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    check(
      detailQuestions.some((question) => question.requesterId === askerId),
      "a captain asking for another captain's detail is relayed to that captain, labelled with the asker",
    );
    hostSocket.emit("player:detail:response", {
      roomId: run.roomId,
      targetUserId: hostId,
      requesterId: askerId,
      data: { gold: 1234 },
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    check(
      guestAnswers.length === 1 &&
        guestAnswers[0].targetUserId === hostId &&
        (guestAnswers[0].data as { gold?: number } | null)?.gold === 1234,
      "and the answer comes back to the asker with the snapshot in it",
    );

    // Two. A second answer to the question that has already been answered.
    // The hold is consumed by the first one, so this names a question
    // nobody is waiting on and is dropped rather than relayed.
    hostSocket.emit("player:detail:response", {
      roomId: run.roomId,
      targetUserId: hostId,
      requesterId: askerId,
      data: { gold: 9999 },
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    check(
      guestAnswers.length === 1,
      "a second answer to the same question is dropped, so one question relays one answer",
    );

    // Three. A question the asker walks away from. The answer arrives
    // after they have left the harbor, so there is nobody the frame is
    // about any more and it is dropped rather than delivered.
    guestSocket.emit("player:detail:request", {
      roomId: run.roomId,
      targetUserId: hostId,
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    guestSocket.emit("room:leave", { roomId: run.roomId });
    await new Promise((resolve) => setTimeout(resolve, 400));
    hostSocket.emit("player:detail:response", {
      roomId: run.roomId,
      targetUserId: hostId,
      requesterId: askerId,
      data: { gold: 5555 },
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    check(
      guestAnswers.length === 1,
      "and an answer to a captain who has left the harbor is dropped rather than delivered",
    );

    // The seat is taken back, so the rest of the suite finds the harbor
    // as this block left it. room:leave is only the socket's half of
    // leaving: the membership the route writes is untouched by it, and
    // the seat is waiting to be sat in again.
    const retaken = waitForEvent<{
      roomId: string;
      members: { id: string }[];
    }>(
      guestSocket,
      "room:members",
      (payload) =>
        payload?.roomId === run.roomId &&
        payload.members.some((member) => member.id === askerId),
    );
    guestSocket.emit("room:join", { roomId: run.roomId });
    check(
      (await retaken) !== null,
      "and the guest takes their seat back, so the harbor is as it was",
    );

    // A late joiner is hydrated from the server's cache rather than
    // waiting for the next heartbeat, which is what makes a captain who
    // reloads mid voyage still see everyone.
    const guestReloadSocket = connect(BASE, {
      path: SOCKET_PATH,
      transports: ["websocket"],
      extraHeaders: { Cookie: run.guest.cookie },
      reconnection: false,
    });
    run.sockets.push(guestReloadSocket);
    await new Promise<void>((resolve) => {
      guestReloadSocket.on("connect", () => {
        guestReloadSocket.emit("auth", { token: guestToken });
      });
      guestReloadSocket.on("auth:ok", () => resolve());
      setTimeout(resolve, 8000);
    });
    const hydrated = waitForEvent<{ user: { id: string }; gold: number }>(
      guestReloadSocket,
      "game:status",
      (payload) => payload?.user?.id === hostId,
    );
    guestReloadSocket.emit("room:join", { roomId: run.roomId });
    const hydratedStatus = await hydrated;
    check(
      hydratedStatus?.gold === 777,
      "a captain who reloads is hydrated with the last known status",
    );

    console.log("\nRecovering a session after a reload");
    const active = await call<{ room: { id: string } | null }>(
      "/api/rooms/active",
      {
        cookie: run.guest.cookie,
      },
    );
    check(
      active.body?.room?.id === run.roomId,
      "a reloaded captain lands back in the harbor",
    );

    console.log("\nQuick Start pairing");
    // Both captains ask in the same tick. That is the case the button
    // exists for, and the case that used to seat them in two separate
    // harbors: without serialized matching, both lookups find no open
    // harbor before either has created one, so each opens its own.
    // The host asks for a long voyage and the guest for a short one. The
    // host's request is sent first, so the host is the captain who opens
    // the room, and the room should carry the host's tier. The guest is
    // seated into that same room and sails at its tier, exactly as if they
    // had typed the room code in.
    const [hostMatch, guestMatch] = await Promise.all([
      requestQuickMatch(hostSocket, "monsoon"),
      requestQuickMatch(guestSocket, "fair_winds"),
    ]);
    check(hostMatch !== null, "the first captain asking for a match is seated");
    check(
      guestMatch !== null,
      "the second captain asking for a match is seated",
    );
    check(
      hostMatch !== null &&
        guestMatch !== null &&
        hostMatch.roomId === guestMatch.roomId,
      "both captains are paired into the same harbor",
    );
    run.quickStartRoomId = hostMatch?.roomId ?? guestMatch?.roomId ?? null;

    const quickRoom = run.quickStartRoomId
      ? await db.room.findUnique({
          where: { id: run.quickStartRoomId },
          select: { difficulty: true },
        })
      : null;
    check(
      quickRoom?.difficulty === "monsoon",
      "the harbor opens in the tier the first captain picked",
    );

    console.log("\nA conversation the voyage keeps to itself");
    // The third captain exists for one reason: a private thread is only
    // private if a captain who is not in it cannot be handed it.
    run.third = await signUp("third");
    const thirdJoined = await call<{ room: { id: string } }>(
      "/api/rooms/join",
      {
        method: "POST",
        cookie: run.third.cookie,
        body: JSON.stringify({ code }),
      },
    );
    check(thirdJoined.status === 200, "a third captain can join the harbor");

    const harborLine = "the tide is running high tonight";
    const dmLine = "two crates of hemp, and not a word to the others";
    const heardHarbor = waitForEvent<{ roomId: string; message: WireMessage }>(
      guestSocket,
      "chat:room",
      (payload) => payload?.message?.content === harborLine,
    );
    hostSocket.emit("chat:room", { roomId: run.roomId, content: harborLine });
    const heard = await heardHarbor;
    check(heard !== null, "a line in the harbor chat reaches the room");
    check(
      heard?.message?.sender?.id === hostId,
      "and is labelled with who said it",
    );

    const heardDm = waitForEvent<WireMessage>(
      guestSocket,
      "chat:dm",
      (payload) => payload?.sender?.id === hostId,
    );
    const heardOwnDm = waitForEvent<WireMessage>(
      hostSocket,
      "chat:dm",
      (payload) => payload?.sender?.id === hostId,
    );
    hostSocket.emit("chat:dm", { recipientId: run.guest.id, content: dmLine });
    const dmAtGuest = await heardDm;
    const dmAtHost = await heardOwnDm;
    check(
      dmAtGuest?.content === dmLine,
      "a direct message reaches its recipient",
    );
    check(dmAtGuest?.mine === false, "who does not read it as their own");
    check(
      dmAtHost?.content === dmLine,
      "and the sender is given their own copy",
    );
    check(dmAtHost?.mine === true, "marked as theirs");

    // The claim under test: a session conversation is held in the server's
    // memory and nowhere else. Anything written down for this room, or
    // between these two captains, would be a trace of the voyage.
    const storedForRoom = await db.message.count({
      where: { roomId: run.roomId },
    });
    check(
      storedForRoom === 0,
      "nothing said in the session was written against the room",
    );
    const storedBetween = await db.message.count({
      where: {
        OR: [
          { senderId: run.host.id, recipientId: run.guest.id },
          { senderId: run.guest.id, recipientId: run.host.id },
        ],
      },
    });
    check(
      storedBetween === 0,
      "and the private thread between the two was not written either",
    );

    const reloaded = await openAuthedSocket(run.guest);
    run.sockets.push(reloaded);
    const reloadedHistory = waitForEvent<WireHistory>(
      reloaded,
      "chat:history",
      (payload) => payload?.roomId === run.roomId,
    );
    reloaded.emit("room:join", { roomId: run.roomId });
    const seeded = await reloadedHistory;
    check(seeded !== null, "a captain who reloads is handed the conversation");
    check(
      (seeded?.harbor ?? []).some((m) => m.content === harborLine),
      "the harbor chat comes back from the server's memory",
    );
    check(
      (seeded?.direct ?? []).some(
        (m) => m.content === dmLine && m.mine === false,
      ),
      "so does the private thread, keeping whose message it was",
    );

    const thirdSocket = await openAuthedSocket(run.third);
    run.sockets.push(thirdSocket);
    const thirdHistory = waitForEvent<WireHistory>(
      thirdSocket,
      "chat:history",
      (payload) => payload?.roomId === run.roomId,
    );
    thirdSocket.emit("room:join", { roomId: run.roomId });
    const thirdSeen = await thirdHistory;
    check(thirdSeen !== null, "the third captain joined the harbor channel");
    check(
      (thirdSeen?.harbor ?? []).some((m) => m.content === harborLine),
      "the harbor chat belongs to the room, so they see it",
    );
    check(
      (thirdSeen?.direct ?? []).length === 0,
      "a thread between two other captains is not handed to them",
    );

    console.log("\nThe mute and the report");
    // The moderation surface, and the one part of this suite that is read
    // adversarially rather than happily. Both claims under test are about
    // what a captain is NOT told: the room is not told who the host
    // silenced, and the captain a report names is told nothing at all.
    // Neither can be checked by waiting for a frame that arrives, so every
    // socket records everything it hears from here on and the claims are
    // read off the record.
    // The two ids this section names, held as consts because every use of
    // them below is inside a callback the waiters own, and a captain read
    // out of the enclosing scope is a captain TypeScript cannot narrow.
    // The host's id is already a string in this scope.
    const guestCaptainId = run.guest.id;
    const thirdCaptainId = run.third.id;
    const frameLog: Record<string, Array<{ event: string; text: string }>> = {
      host: [],
      guest: [],
      third: [],
    };
    for (const [who, socket] of [
      ["host", hostSocket],
      ["guest", guestSocket],
      ["third", thirdSocket],
    ] as const) {
      socket.onAny((event: string, ...args: unknown[]) => {
        frameLog[who].push({ event, text: JSON.stringify(args) });
      });
    }

    const hostMuted = waitForEvent<RoomMembersPayload>(
      hostSocket,
      "room:members",
      (payload) => (payload?.mutedUserIds ?? []).includes(thirdCaptainId),
    );
    const thirdMuted = waitForEvent<RoomMembersPayload>(
      thirdSocket,
      "room:members",
      (payload) => (payload?.mutedUserIds ?? []).length > 0,
    );
    const guestTold = waitForEvent<RoomMembersPayload>(
      guestSocket,
      "room:members",
      () => true,
    );
    hostSocket.emit("chat:mute", {
      roomId: run.roomId,
      targetUserId: thirdCaptainId,
    });
    check((await hostMuted) !== null, "the host is handed the list they set");
    const thirdHears = await thirdMuted;
    check(
      thirdHears?.mutedUserIds?.length === 1 &&
        thirdHears.mutedUserIds[0] === thirdCaptainId,
      "the captain who was silenced is handed their own row of it, since it is their own state",
    );
    const guestHears = await guestTold;
    check(
      (guestHears?.mutedUserIds ?? []).length === 0,
      "and a captain who is neither is handed nothing: a mute is not the room's news",
    );

    const heardMuted = waitForEvent<{ roomId: string }>(
      thirdSocket,
      "chat:muted",
      (payload) => payload?.roomId === run.roomId,
    );
    const mutedLine = "the harbor should not hear this line";
    thirdSocket.emit("chat:room", { roomId: run.roomId, content: mutedLine });
    check(
      (await heardMuted) !== null,
      "a silenced captain is told their line did not land",
    );
    check(
      !frameLog.host.some(
        (frame) =>
          frame.event === "chat:room" && frame.text.includes(mutedLine),
      ),
      "and the harbor does not hear it",
    );

    const liftedLine = "and it reaches them again once the host relents";
    const hostHearsAgain = waitForEvent<{ message: WireMessage }>(
      hostSocket,
      "chat:room",
      (payload) => payload?.message?.content === liftedLine,
    );
    const thirdLifted = waitForEvent<RoomMembersPayload>(
      thirdSocket,
      "room:members",
      (payload) => (payload?.mutedUserIds ?? []).length === 0,
    );
    hostSocket.emit("chat:unmute", {
      roomId: run.roomId,
      targetUserId: thirdCaptainId,
    });
    check(
      (await thirdLifted) !== null,
      "unmuting is handed back to the captain it concerned",
    );
    thirdSocket.emit("chat:room", { roomId: run.roomId, content: liftedLine });
    check(
      (await hostHearsAgain) !== null,
      "and their next line reaches the room",
    );

    const strangerMute = waitForEvent<{ roomId: string; error: string }>(
      hostSocket,
      "room:error",
      (payload) => payload?.roomId === run.roomId,
    );
    hostSocket.emit("chat:mute", {
      roomId: run.roomId,
      targetUserId: "an-account-that-is-not-in-this-harbor",
    });
    check(
      (await strangerMute)?.error === "That captain is not in this harbor.",
      "a mute aimed at an account that is not in the harbor is refused rather than remembered",
    );

    // The report. It writes one row per pair per voyage, answers the
    // captain who filed it, and reaches nobody else: not the captain it
    // names, who would otherwise be handed something to hold against the
    // captain who filed it, and not the harbor either.
    const filedAck = waitForEvent<PlayerReportAck>(
      guestSocket,
      "player:report:filed",
      (payload) => payload?.targetUserId === hostId,
    );
    guestSocket.emit("player:report", {
      roomId: run.roomId,
      targetUserId: hostId,
    });
    const filed = await filedAck;
    check(
      filed?.alreadyFiled === false,
      "a report is filed and answered to the captain who filed it",
    );
    const filedRows = await db.report.count({
      where: {
        roomId: run.roomId,
        reporterId: guestCaptainId,
        targetUserId: hostId,
      },
    });
    check(
      filedRows === 1,
      "and is written down once, against the harbor it happened in",
    );

    const repeatedAck = waitForEvent<PlayerReportAck>(
      guestSocket,
      "player:report:filed",
      (payload) => payload?.targetUserId === hostId,
    );
    guestSocket.emit("player:report", {
      roomId: run.roomId,
      targetUserId: hostId,
    });
    check(
      (await repeatedAck)?.alreadyFiled === true,
      "a second report of the same captain in the same voyage is answered as already on the record",
    );
    check(
      (await db.report.count({
        where: {
          roomId: run.roomId,
          reporterId: guestCaptainId,
          targetUserId: hostId,
        },
      })) === 1,
      "and the row is not written twice",
    );

    const selfReport = waitForEvent<{ roomId: string; error: string }>(
      guestSocket,
      "room:error",
      (payload) => payload?.roomId === run.roomId,
    );
    guestSocket.emit("player:report", {
      roomId: run.roomId,
      targetUserId: guestCaptainId,
    });
    check(
      (await selfReport)?.error === "You can't report yourself.",
      "a captain cannot report themselves",
    );
    const strangerReport = waitForEvent<{ roomId: string; error: string }>(
      guestSocket,
      "room:error",
      (payload) => payload?.roomId === run.roomId,
    );
    guestSocket.emit("player:report", {
      roomId: run.roomId,
      targetUserId: "an-account-that-is-not-in-this-harbor",
    });
    check(
      (await strangerReport)?.error === "That captain is not in this harbor.",
      "and cannot report an account that is not in the harbor",
    );

    // What the captain the report named was told, and what the rest of the
    // harbor was told: nothing, on either count. Read off the event names,
    // because a frame about a report would have to be about a report:
    // there is no channel it could travel on where it would not say so.
    check(
      !frameLog.host.some((frame) => frame.event.includes("report")) &&
        !frameLog.third.some((frame) => frame.event.includes("report")),
      "the captain a report names, and every other captain in the harbor, are told nothing about it",
    );

    console.log("\nThe inbound budget");
    // [J2: the mute and the report] The one thing in the realtime layer
    // that decides whether to read a frame. It is checked here rather than
    // in a unit test because what it has to be true of is the app's own
    // client: the budget was read off that client's cadences, and the way
    // to know it is set above them is to run the frames the app itself
    // sends and watch them all land.
    //
    // The budget's own numbers are deliberately not in this file. What is
    // asserted is the shape: a burst the size of the client's tightest loop
    // is answered rather than refused, a flood far above any cadence a
    // captain can produce is cut, the captain behind it is told once, the
    // budget refills, and one socket's flood is not the captain on the
    // next socket's problem.
    //
    // One trap, learned from this probe failing its first full run:
    // presence:update is both the answer to this frame and the news a
    // connect broadcasts to every socket in the tree, so a count of it
    // read on a socket that is only listening counts other captains' news
    // as this captain's answers. The flood is therefore counted on the
    // socket it came from, where it is the loudest thing happening, and
    // the bystanding captain is counted as a difference across their own
    // frames rather than as a total, after a quiet moment that lets the
    // connect this probe caused finish reaching them.
    const floodSocket = await openAuthedSocket(run.third);
    run.sockets.push(floodSocket);
    let floodAnswered = 0;
    let floodNotices = 0;
    let politeAnswered = 0;
    floodSocket.on("presence:update", () => {
      floodAnswered += 1;
    });
    floodSocket.on("room:error", (payload: { error?: string }) => {
      if (
        payload?.error ===
        "Too many actions at once. Give the harbor a moment, then try again."
      ) {
        floodNotices += 1;
      }
    });
    guestSocket.on("presence:update", () => {
      politeAnswered += 1;
    });

    // Long enough for the new socket's arrival to have reached every other
    // socket and for every bucket in the harbor to refill past the twelve
    // frames below even from empty, so what follows measures the flood
    // rather than the frames this voyage has been sending all along.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const politeBefore = politeAnswered;
    const floodBefore = floodAnswered;
    const FLOOD_FRAMES = 200;
    const POLITE_FRAMES = 12;
    for (let i = 0; i < FLOOD_FRAMES; i++) floodSocket.emit("presence:request");
    for (let i = 0; i < POLITE_FRAMES; i++)
      guestSocket.emit("presence:request");
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const flooded = floodAnswered - floodBefore;
    const politeAnsweredHere = politeAnswered - politeBefore;

    check(
      flooded > 0 && flooded < FLOOD_FRAMES,
      `a flood of ${FLOOD_FRAMES} frames is cut rather than answered in full (${flooded} were answered)`,
    );
    check(
      flooded >= POLITE_FRAMES,
      "and its first frames, which are a cadence this app really sends, are answered rather than refused",
    );
    check(
      floodNotices === 1,
      "the captain behind it is told once, rather than once per frame",
    );
    check(
      politeAnsweredHere === POLITE_FRAMES,
      `one socket's flood is not the captain on the next socket's problem (they heard ${politeAnsweredHere} of ${POLITE_FRAMES})`,
    );

    // And the budget is a rate rather than a ban: a frame sent after the
    // refill window is answered again, which is what keeps a human who has
    // somehow reached the ceiling from being locked out of the harbor.
    const beforeRefill = floodAnswered;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    floodSocket.emit("presence:request");
    await new Promise((resolve) => setTimeout(resolve, 500));
    check(
      floodAnswered > beforeRefill,
      "and the socket is answered again once the budget refills",
    );

    // Closed here rather than left to the end of the run. A captain with a
    // second live socket is not a captain who has gone quiet, and the
    // bartering section below leans on the third captain having gone quiet:
    // their offer cannot be taken once they are unreachable. Leaving this
    // socket open is what made this probe's first full run fail there.
    floodSocket.close();

    console.log("\nBartering from anywhere");
    // Flexible bartering is the chat surface, and the only one of the two
    // that is earned. Every captain this run made is brand new, so the
    // gate is checked first, while they still hold no Renown at all.
    const gateRefusal = waitForEvent<{ error?: string }>(
      hostSocket,
      "barter:error",
      (payload) => Boolean(payload?.error),
    );
    hostSocket.emit("barter:post", {
      roomId: run.roomId,
      offerItem: "Hemp",
      offerAmount: 1,
      requestItem: "Gold",
      requestAmount: 1,
      flexible: true,
    });
    const refusedByGate = await gateRefusal;
    check(
      refusedByGate !== null,
      "a captain with no Renown cannot post a flexible offer",
    );
    check(
      Boolean(
        refusedByGate?.error?.includes(
          `Renown Level ${FLEXIBLE_BARTER_UNLOCK_LEVEL}`,
        ),
      ),
      "and is told which Renown Level unlocks it",
    );

    // The same captain, the same lack of Renown, posting an exchange
    // offer. The Captain's Exchange is not Renown gated at all, so what
    // turns this one away is only that the room is not sitting in the
    // Parley, which is the one time that board is on screen. That check is
    // what stops a chat composer claiming to be the exchange board to slip
    // past the gate above, and it is why the claim is pinned here rather
    // than taken on faith.
    const exchangeRefusal = waitForEvent<{ error?: string }>(
      hostSocket,
      "barter:error",
      (payload) => Boolean(payload?.error),
    );
    hostSocket.emit("barter:post", {
      roomId: run.roomId,
      offerItem: "Hemp",
      offerAmount: 1,
      requestItem: "Gold",
      requestAmount: 1,
      flexible: false,
    });
    const refusedOutsidePhase = await exchangeRefusal;
    check(
      refusedOutsidePhase !== null,
      "an exchange offer cannot be posted outside the Parley",
    );
    // Read off the phase's own face rather than typed here, so the refusal
    // and the word the rail prints for that phase cannot come apart: this
    // check caught the two disagreeing once already, when the server began
    // naming the Parley and this file was still looking for the old name.
    check(
      Boolean(refusedOutsidePhase?.error?.includes(phaseFace("parley").label)),
      "and the refusal names the phase that opens it",
    );

    // The gate reads the account row, not anything the client reports, so
    // a row at the unlock level is exactly what opens the board. Written
    // straight through Prisma rather than earned, since a voyage's worth
    // of play is not what this run is here to measure. The XP is set to
    // the curve's own value for that level so the row stays coherent.
    // Cleanup needs no special case: CaptainLegacy cascades on the user
    // delete the run already performs.
    const seedRenown = async (userId: string) => {
      await db.captainLegacy.upsert({
        where: { userId },
        create: {
          userId,
          renownLevel: FLEXIBLE_BARTER_UNLOCK_LEVEL,
          renownXP: 4500,
        },
        update: {
          renownLevel: FLEXIBLE_BARTER_UNLOCK_LEVEL,
          renownXP: 4500,
        },
      });
    };
    await seedRenown(hostId);
    await seedRenown(run.guest.id);
    await seedRenown(run.third!.id);
    // Both of the other two are read by name inside the event callbacks
    // below, and a callback can run at any point after the captain it
    // names was assigned, so neither is narrowed by the time one does.
    const guestId = run.guest.id;
    const thirdId = run.third!.id;

    // The chat composer's board, which is the flexible one: no phase has
    // been started, and the offer still posts, shows and closes exactly
    // as it would mid voyage.
    const boardAfterPost = waitForEvent<{ offers: WireOffer[] }>(
      hostSocket,
      "barter:update",
      (payload) => (payload?.offers ?? []).some((o) => o.fromUserId === hostId),
    );
    hostSocket.emit("barter:post", {
      roomId: run.roomId,
      offerItem: "Hemp",
      offerAmount: 3,
      requestItem: "Gold",
      requestAmount: 2,
      flexible: true,
    });
    const postedBoard = await boardAfterPost;
    const posted = postedBoard?.offers.find((o) => o.fromUserId === hostId);
    check(Boolean(posted), "a flexible offer posts with no phase asked for");
    check(
      posted?.flexible === true,
      "and the board is told it came from the chat, not the exchange",
    );
    check(
      typeof posted?.createdAt === "string" && posted.createdAt.length > 0,
      "it carries the moment it was posted, so a chat can place it",
    );

    // A second offer from the same captain, so the trade below can be
    // checked for retiring it. Advertising the same intent in more than
    // one place is the whole point of allowing it: posting is free, and
    // only a completed trade spends anything.
    const secondUp = waitForEvent<{ offers: WireOffer[] }>(
      hostSocket,
      "barter:update",
      (payload) =>
        (payload?.offers ?? []).filter((o) => o.fromUserId === hostId)
          .length === 2,
    );
    hostSocket.emit("barter:post", {
      roomId: run.roomId,
      offerItem: "Silk",
      offerAmount: 1,
      requestItem: "Gold",
      requestAmount: 1,
      flexible: true,
    });
    const bothUp = await secondUp;
    const second = bothUp?.offers.find(
      (o) => o.fromUserId === hostId && o.id !== posted?.id,
    );
    check(
      Boolean(second),
      "a captain can advertise two flexible offers at once",
    );

    // One from each of the other two as well, so the trade below has two
    // bystanders to leave standing and a second captain to take it.
    const guestUp = waitForEvent<{ offers: WireOffer[] }>(
      guestSocket,
      "barter:update",
      (payload) =>
        (payload?.offers ?? []).some((o) => o.fromUserId === guestId),
    );
    guestSocket.emit("barter:post", {
      roomId: run.roomId,
      offerItem: "Tea",
      offerAmount: 2,
      requestItem: "Silk",
      requestAmount: 1,
      flexible: true,
    });
    const guestPosted = (await guestUp)?.offers.find(
      (o) => o.fromUserId === guestId,
    );
    check(Boolean(guestPosted), "a second captain can post one of their own");

    const thirdUp = waitForEvent<{ offers: WireOffer[] }>(
      thirdSocket,
      "barter:update",
      (payload) =>
        (payload?.offers ?? []).some((o) => o.fromUserId === thirdId),
    );
    thirdSocket.emit("barter:post", {
      roomId: run.roomId,
      offerItem: "Spice",
      offerAmount: 1,
      requestItem: "Hemp",
      requestAmount: 2,
      flexible: true,
    });
    const thirdPosted = (await thirdUp)?.offers.find(
      (o) => o.fromUserId === thirdId,
    );
    check(Boolean(thirdPosted), "and a third can post one of theirs");

    const seenBoard = waitForEvent<{ offers: WireOffer[] }>(
      guestSocket,
      "barter:update",
      (payload) => (payload?.offers ?? []).some((o) => o.id === posted?.id),
    );
    guestSocket.emit("barter:state:request", { roomId: run.roomId });
    check((await seenBoard) !== null, "the rest of the harbor sees it");

    const fulfilledToTaker = waitForEvent<{ offer: WireOffer }>(
      guestSocket,
      "barter:fulfilled",
      (payload) => payload?.offer?.id === posted?.id,
    );
    const fulfilledToPoster = waitForEvent<{ offer: WireOffer }>(
      hostSocket,
      "barter:fulfilled",
      (payload) => payload?.offer?.id === posted?.id,
    );
    // One board view taken the moment the trade settles, so what it did
    // to all four offers can be read off a single payload.
    const settledBoard = waitForEvent<{
      offers: WireOffer[];
      flexibleOffersAccepted: number;
    }>(
      hostSocket,
      "barter:update",
      (payload) => !(payload?.offers ?? []).some((o) => o.id === posted?.id),
    );
    guestSocket.emit("barter:accept", {
      roomId: run.roomId,
      offerId: posted?.id,
    });
    check(
      (await fulfilledToTaker) !== null,
      "the captain who takes it is told the trade completed",
    );
    check(
      (await fulfilledToPoster) !== null,
      "and so is the captain who posted it",
    );
    const settled = await settledBoard;
    check(settled !== null, "the settled offer leaves the board");
    // Once a trade completes, the poster's other flexible offers go with
    // it. They promised the goods that have just left their hold, and
    // they share the one allowance, so leaving them up would advertise a
    // swap that can no longer be honoured.
    check(
      !(settled?.offers ?? []).some((o) => o.id === second?.id),
      "and the poster's other flexible offers are retired along with it",
    );
    check(
      (settled?.offers ?? []).some((o) => o.id === guestPosted?.id),
      "while the captain who took it keeps every offer of their own",
    );
    check(
      (settled?.offers ?? []).some((o) => o.id === thirdPosted?.id),
      "and so does everyone else in the harbor",
    );
    check(
      settled?.flexibleOffersAccepted === 1,
      "the server counts the trade against the poster's allowance",
    );

    // The captain whose own offer was just taken, taking somebody else's.
    // This is the whole of the second reported failure: a completed trade
    // used to leave the poster permanently shut out of both surfaces.
    // Taking an offer is never rationed on either surface, so this has to
    // work no matter how much of the poster's own allowance has gone.
    const takenByHost = waitForEvent<{ offer: WireOffer }>(
      hostSocket,
      "barter:fulfilled",
      (payload) => payload?.offer?.id === guestPosted?.id,
    );
    hostSocket.emit("barter:accept", {
      roomId: run.roomId,
      offerId: guestPosted?.id,
    });
    check(
      (await takenByHost) !== null,
      "a captain whose own offer was just taken can still take another",
    );

    // That trade was this captain's one allowance at the unlock level, and
    // the server counts it rather than trusting anyone to remember.
    const spentRefusal = waitForEvent<{ error?: string }>(
      hostSocket,
      "barter:error",
      (payload) => Boolean(payload?.error),
    );
    hostSocket.emit("barter:post", {
      roomId: run.roomId,
      offerItem: "Hemp",
      offerAmount: 1,
      requestItem: "Gold",
      requestAmount: 1,
      flexible: true,
    });
    const spent = await spentRefusal;
    check(
      spent !== null,
      "a captain whose flexible allowance is spent cannot post another",
    );
    check(
      Boolean(spent?.error?.includes("Captain's Exchange")),
      "and is pointed at the surface that still works for them",
    );

    // A trade the poster can never be told about is refused rather than
    // completed, because their side of it releases escrow when it sees the
    // offer go and would hand the goods back as well as to the taker.
    thirdSocket.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const refused = waitForEvent<{ offerId?: string; reason?: string }>(
      guestSocket,
      "barter:accept:fail",
      (payload) => payload?.offerId === thirdPosted?.id,
    );
    guestSocket.emit("barter:accept", {
      roomId: run.roomId,
      offerId: thirdPosted?.id,
    });
    const refusal = await refused;
    check(
      refusal !== null,
      "an offer whose owner has gone quiet cannot be taken",
    );
    check(
      Boolean(refusal?.reason?.includes("not here")),
      "and the refusal says so rather than failing silently",
    );
    const thirdLeft = await call<{ ok: boolean }>(
      `/api/rooms/${run.roomId}/leave`,
      { method: "POST", cookie: run.third.cookie },
    );
    check(thirdLeft.status === 200, "the third captain can leave the harbor");

    console.log("\nThe Captain's Exchange in its own phase");
    // The other surface, and the one nothing is asked of. This captain is
    // dropped back to level one first, so a working exchange cannot be
    // Renown doing the work: the same account is refused the flexible
    // offer below at exactly the level the exchange is served at.
    await db.captainLegacy.update({
      where: { userId: run.guest.id },
      data: { renownLevel: 1, renownXP: 0 },
    });
    // [J2: the mute and the report] A mute belongs to the table it was set
    // at, so setting sail lifts it. The host silences the guest here, with
    // the harbor still in the lobby, and the frame the departure sends is
    // what says the silence did not come along. The guest rather than the
    // third captain, who has just given up their seat: a mute can only be
    // aimed at a captain who is standing in the harbor.
    const mutedInLobby = waitForEvent<RoomMembersPayload>(
      guestSocket,
      "room:members",
      (payload) => (payload?.mutedUserIds ?? []).includes(guestId),
    );
    hostSocket.emit("chat:mute", {
      roomId: run.roomId,
      targetUserId: run.guest.id,
    });
    check(
      (await mutedInLobby) !== null,
      "the host can silence a captain in the lobby",
    );
    const liftedAtDeparture = waitForEvent<RoomMembersPayload>(
      guestSocket,
      "room:members",
      (payload) => (payload?.mutedUserIds ?? []).length === 0,
    );
    // The exchange only opens while the room is actually in the Parley,
    // and the checkpoint only follows a report from a voyage that has set
    // sail, so both of those have to happen before the board will take one.
    hostSocket.emit("room:start", { roomId: run.roomId });
    check(
      (await liftedAtDeparture) !== null,
      "and the voyage lifts it, because a mute is a judgement about a table rather than about a captain",
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    hostSocket.emit("game:status", {
      roomId: run.roomId,
      round: 1,
      phase: "parley",
      phaseLabel: "Parley",
      gold: 0,
      reputation: 0,
      shipLevel: 0,
      gameOver: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const exchangeUp = waitForEvent<{ offers: WireOffer[] }>(
      guestSocket,
      "barter:update",
      (payload) =>
        (payload?.offers ?? []).some((o) => o.fromUserId === guestId),
    );
    guestSocket.emit("barter:post", {
      roomId: run.roomId,
      offerItem: "Porcelain",
      offerAmount: 2,
      requestItem: "Tea",
      requestAmount: 1,
      flexible: false,
    });
    const exchangePosted = (await exchangeUp)?.offers.find(
      (o) => o.fromUserId === guestId,
    );
    check(
      Boolean(exchangePosted),
      "a captain with no Renown can post on the Captain's Exchange",
    );
    check(
      exchangePosted?.flexible === false,
      "and the board files it under the exchange rather than the chat",
    );

    // The gate belongs to the chat surface alone. If the phase had
    // inherited it, this is where that would show: the same captain, in
    // the very phase the exchange just worked in, cannot post a flexible
    // offer at all.
    const stillGated = waitForEvent<{ error?: string }>(
      guestSocket,
      "barter:error",
      (payload) => Boolean(payload?.error),
    );
    guestSocket.emit("barter:post", {
      roomId: run.roomId,
      offerItem: "Porcelain",
      offerAmount: 1,
      requestItem: "Tea",
      requestAmount: 1,
      flexible: true,
    });
    const gated = await stillGated;
    check(gated !== null, "the same captain still cannot post a flexible one");
    check(
      Boolean(
        gated?.error?.includes(`Renown Level ${FLEXIBLE_BARTER_UNLOCK_LEVEL}`),
      ),
      "because the flexible gate never moved onto the phase",
    );

    // And the exchange serves the taking side as well, at any level, for
    // a captain whose own flexible allowance has long since gone.
    const exchangeTaken = waitForEvent<{ offer: WireOffer }>(
      guestSocket,
      "barter:fulfilled",
      (payload) => payload?.offer?.id === exchangePosted?.id,
    );
    hostSocket.emit("barter:accept", {
      roomId: run.roomId,
      offerId: exchangePosted?.id,
    });
    check(
      (await exchangeTaken) !== null,
      "and any captain can take one off it, at any Renown level",
    );

    console.log("\nWiping the voyage");
    const clearedAtHost = waitForEvent<{ roomId: string }>(
      hostSocket,
      "chat:cleared",
      (payload) => payload?.roomId === run.roomId,
    );
    const clearedAtGuest = waitForEvent<{ roomId: string }>(
      guestSocket,
      "chat:cleared",
      (payload) => payload?.roomId === run.roomId,
    );
    hostSocket.emit("room:restart", { roomId: run.roomId });
    check(
      (await clearedAtHost) !== null,
      "restarting the voyage tells the room its conversation is gone",
    );
    check(
      (await clearedAtGuest) !== null,
      "and tells every captain in it the same",
    );

    const afterTheWipe = await openAuthedSocket(run.guest);
    run.sockets.push(afterTheWipe);
    const wipedHistory = waitForEvent<WireHistory>(
      afterTheWipe,
      "chat:history",
      (payload) => payload?.roomId === run.roomId,
    );
    afterTheWipe.emit("room:join", { roomId: run.roomId });
    const wiped = await wipedHistory;
    check(wiped !== null, "a captain who reloads still gets an answer");
    check(
      (wiped?.harbor ?? []).length === 0,
      "the harbor chat is gone with the voyage it belonged to",
    );
    check(
      (wiped?.direct ?? []).length === 0,
      "and so is every direct thread in it",
    );

    console.log("\nThe operator console");
    const setupCode = process.env.ADMIN_SETUP_CODE;
    if (!setupCode) {
      throw new Error(
        "ADMIN_SETUP_CODE is not set for this process, so the operator route cannot be exercised.\n" +
          "Start the server and this script with the same value, or run them in the same shell.",
      );
    }

    const wrongCode = await registerOperator("sneak", "not-the-setup-code");
    check(
      wrongCode.status === 403 && wrongCode.error !== null,
      "a wrong setup code is refused without making an account",
    );
    // Belt and braces: if that refusal were ever wrong, the account it
    // made has to be cleaned up like any other this run created.
    if (wrongCode.captain) run.extraAccounts.push(wrongCode.captain);

    const made = await registerOperator("keeper", setupCode);
    check(made.status === 200, "the setup code admits an operator account");
    check(
      made.role === "admin",
      "and the account it makes is an administrator",
    );
    if (!made.captain) throw new Error("No operator account, stopping here.");
    const operator = made.captain;
    run.extraAccounts.push(operator);
    const operatorSocket = await openAuthedSocket(operator);
    run.sockets.push(operatorSocket);

    // A captain who is not an operator asks for the roster. The console
    // only ever hides itself; the server is what has to refuse.
    const refusedList = waitForEvent<{ error: string }>(
      hostSocket,
      "admin:error",
    );
    const leakedList = waitForEvent<WireRoster>(
      hostSocket,
      "admin:accounts",
      undefined,
      1500,
    );
    hostSocket.emit("admin:list");
    check(
      (await refusedList) !== null,
      "a captain who is not an operator is refused the roster",
    );
    check((await leakedList) === null, "and is sent no roster at all");

    const asked = waitForEvent<WireRoster>(operatorSocket, "admin:accounts");
    operatorSocket.emit("admin:list");
    const roster = await asked;
    check(roster !== null, "the operator is handed the roster");
    check(
      accountIn(roster, run.host.id)?.username === run.host.username,
      "and it lists the captains it is there to manage",
    );

    // The ban, with every listener registered before the ban goes out so
    // nothing can arrive in the gap.
    const toldTheBanned = waitForEvent<{ error: string }>(
      guestSocket,
      "auth:fail",
    );
    const bannedSocketClosed = waitForEvent<unknown>(
      guestSocket,
      "disconnect",
      undefined,
      3000,
    );
    const afterBan = waitForEvent<WireRoster>(operatorSocket, "admin:accounts");
    operatorSocket.emit("admin:ban", { userId: run.guest.id });
    check(
      (await toldTheBanned) !== null,
      "a banned captain's socket is told why it is being closed",
    );
    check((await bannedSocketClosed) !== null, "and is closed");
    check(
      accountIn(await afterBan, run.guest.id)?.bannedAt != null,
      "the roster shows the account banned",
    );
    const noLongerSignedIn = await call<{ user: unknown }>("/api/auth/me", {
      cookie: run.guest.cookie,
    });
    check(
      noLongerSignedIn.body?.user === null,
      "the ban took the session the account already had",
    );
    const bannedLogin = await call<{ error: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: run.guest.username, password }),
    });
    check(bannedLogin.status === 403, "a banned captain cannot sign back in");
    check(
      bannedLogin.body?.error === BANNED_ACCOUNT_ERROR,
      "and is told the account is banned, not that the password is wrong",
    );

    const afterUnban = waitForEvent<WireRoster>(
      operatorSocket,
      "admin:accounts",
    );
    operatorSocket.emit("admin:unban", { userId: run.guest.id });
    check(
      accountIn(await afterUnban, run.guest.id)?.bannedAt === null,
      "unbanning clears the ban",
    );
    // The signed in session has to come back too, and the smoke run needs
    // one for the sign out check at the end, so the fresh session is kept.
    const signedBackIn = await signInAgain(run.guest.username);
    check(signedBackIn !== null, "and the captain can sign in again");
    if (signedBackIn) {
      run.guest.cookie = signedBackIn.cookie;
      run.guest.token = signedBackIn.token;
    }

    const afterGrant = waitForEvent<WireRoster>(
      operatorSocket,
      "admin:accounts",
    );
    operatorSocket.emit("admin:grant", { userId: run.host.id });
    check(
      accountIn(await afterGrant, run.host.id)?.role === "admin",
      "an operator can hand the role to another captain",
    );
    // The role is read from the account row on every event, so the socket
    // this captain already had is enough. Nothing was reconnected.
    const promotedList = waitForEvent<WireRoster>(
      hostSocket,
      "admin:accounts",
      undefined,
      3000,
    );
    hostSocket.emit("admin:list");
    check(
      (await promotedList) !== null,
      "and that captain can read the roster on the socket they already had",
    );

    const toldTheDemoted = waitForEvent<{ error: string }>(
      hostSocket,
      "admin:error",
    );
    const afterRevoke = waitForEvent<WireRoster>(
      operatorSocket,
      "admin:accounts",
    );
    operatorSocket.emit("admin:revoke", { userId: run.host.id });
    check(
      accountIn(await afterRevoke, run.host.id)?.role === "captain",
      "and take the role away again",
    );
    const demotion = await toldTheDemoted;
    check(
      demotion !== null,
      "telling the demoted captain's own console that it has lost the console",
    );
    const afterDemotion = waitForEvent<WireRoster>(
      hostSocket,
      "admin:accounts",
      undefined,
      1500,
    );
    hostSocket.emit("admin:list");
    check(
      (await afterDemotion) === null,
      "and the roster is refused from that socket from then on",
    );

    // Nothing here should be able to lock the operator out of their own
    // console, and a self ban or self deletion is never what was meant.
    const refusedSelfBan = waitForEvent<{ error: string }>(
      operatorSocket,
      "admin:error",
    );
    operatorSocket.emit("admin:ban", { userId: operator.id });
    check((await refusedSelfBan) !== null, "an operator cannot ban themselves");
    const refusedSelfPurge = waitForEvent<{ error: string }>(
      operatorSocket,
      "admin:error",
    );
    operatorSocket.emit("admin:purge", {
      userId: operator.id,
      confirmUsername: operator.username,
    });
    check((await refusedSelfPurge) !== null, "nor delete their own account");

    // A harbor with a captain sitting in it, belonging to an account that
    // is about to be deleted.
    const doomed = await signUp("doomed");
    const crew = await signUp("crew");
    run.extraAccounts.push(doomed, crew);
    const doomedSocket = await openAuthedSocket(doomed);
    const crewSocket = await openAuthedSocket(crew);
    run.sockets.push(doomedSocket, crewSocket);

    const doomedRoom = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: doomed.cookie,
        body: JSON.stringify({
          name: `Smoke doomed harbor ${suffix}`,
          isPublic: false,
        }),
      },
    );
    if (doomedRoom.status !== 200) {
      throw new Error("No harbor for the deletion checks, stopping here.");
    }
    const doomedRoomId = doomedRoom.body.room.id;
    // Two steps, because the harbor has to have a member before the
    // socket will seat anyone in it: the membership row is written over
    // REST, and the seat itself is taken on the socket.
    const joinedDoomed = await call<{ room: { id: string } }>(
      "/api/rooms/join",
      {
        method: "POST",
        cookie: crew.cookie,
        body: JSON.stringify({ code: doomedRoom.body.room.code }),
      },
    );
    check(
      joinedDoomed.status === 200,
      "a captain joins the harbor about to be deleted",
    );
    const takenASeat = waitForEvent<{ roomId: string }>(
      crewSocket,
      "chat:history",
      (payload) => payload?.roomId === doomedRoomId,
    );
    crewSocket.emit("room:join", { roomId: doomedRoomId });
    check((await takenASeat) !== null, "and takes a seat in it");

    const refusedConfirm = waitForEvent<{ error: string }>(
      operatorSocket,
      "admin:error",
    );
    operatorSocket.emit("admin:purge", {
      userId: doomed.id,
      confirmUsername: "a-different-name",
    });
    check(
      (await refusedConfirm) !== null,
      "a deletion the operator did not confirm by name is refused",
    );
    check(
      (await db.user.findUnique({
        where: { id: doomed.id },
        select: { id: true },
      })) !== null,
      "and the account is still there",
    );

    const harborClosed = waitForEvent<{ roomId: string; reason?: string }>(
      crewSocket,
      "room:closed",
      (payload) => payload?.roomId === doomedRoomId,
    );
    const toldTheDeleted = waitForEvent<{ error: string }>(
      doomedSocket,
      "auth:fail",
    );
    const deletedSocketClosed = waitForEvent<unknown>(
      doomedSocket,
      "disconnect",
      undefined,
      3000,
    );
    const afterPurge = waitForEvent<WireRoster>(
      operatorSocket,
      "admin:accounts",
    );
    operatorSocket.emit("admin:purge", {
      userId: doomed.id,
      confirmUsername: doomed.username,
    });
    check(
      (await harborClosed) !== null,
      "the captains sitting in that account's harbor are told it is closing",
    );
    check(
      (await toldTheDeleted) !== null,
      "the deleted account's own socket is told why",
    );
    check((await deletedSocketClosed) !== null, "and is closed");
    check(
      accountIn(await afterPurge, doomed.id) === undefined,
      "the account is gone from the roster",
    );
    check(
      (await db.user.findUnique({
        where: { id: doomed.id },
        select: { id: true },
      })) === null,
      "and gone from the database",
    );
    check(
      (await db.room.findUnique({
        where: { id: doomedRoomId },
        select: { id: true },
      })) === null,
      "the harbor it hosted went with it",
    );
    const crewStillAboard = await call<{ user: { id: string } | null }>(
      "/api/auth/me",
      { cookie: crew.cookie },
    );
    check(
      crewStillAboard.body?.user?.id === crew.id,
      "and a captain who was only sitting there keeps their account",
    );

    // Everything the single account actions just proved, asked again for a
    // whole selection at once. The accounts used here are new ones rather
    // than the captains above, so a bulk ban landing on somebody cannot
    // change the answer to a check that already ran.
    console.log("\nActing on a selection");
    const crowdA = await signUp("crowd_a");
    const crowdB = await signUp("crowd_b");
    const outcast = await signUp("outcast");
    run.extraAccounts.push(crowdA, crowdB, outcast);

    // One account is put out of standing on its own first, so that the
    // selection below has a refusal to report and not only successes.
    const bannedOutcast = waitForEvent<WireRoster>(
      operatorSocket,
      "admin:accounts",
    );
    operatorSocket.emit("admin:ban", { userId: outcast.id });
    check(
      accountIn(await bannedOutcast, outcast.id)?.bannedAt != null,
      "one account is banned on its own, to be skipped in the batch",
    );

    const bulkBan = waitForEvent<{ report: WireBulkReport }>(
      operatorSocket,
      "admin:bulk-result",
    );
    const rosterAfterBulkBan = waitForEvent<WireRoster>(
      operatorSocket,
      "admin:accounts",
    );
    operatorSocket.emit("admin:bulk", {
      action: "ban",
      userIds: [crowdA.id, crowdB.id, outcast.id, operator.id],
    });
    const banReport = (await bulkBan)?.report;
    check(
      banReport?.applied === 2,
      "a selection of four bans the two captains it can",
    );
    check(
      banReport?.requested === 4 && banReport?.skipped.length === 2,
      "and reports the whole request, with the two accounts it could not change",
    );
    check(
      (banReport?.skipped ?? []).some((reason) =>
        reason.includes("already banned"),
      ),
      "including the one that was already banned",
    );
    check(
      (banReport?.skipped ?? []).some((reason) =>
        reason.includes("your own account"),
      ),
      "and the operator's own account, which no selection may take",
    );
    const bannedInBulk = await rosterAfterBulkBan;
    check(
      accountIn(bannedInBulk, crowdA.id)?.bannedAt != null &&
        accountIn(bannedInBulk, crowdB.id)?.bannedAt != null,
      "the roster comes back with both of them banned",
    );
    // The bulk path runs the same single account function the row buttons
    // run, so the parts of a ban that are not the flag have to be there
    // too: the sessions are meant to be gone with it.
    const crowdASession = await call<{ user: unknown }>("/api/auth/me", {
      cookie: crowdA.cookie,
    });
    check(
      crowdASession.body?.user === null,
      "the ban took their sessions with it, exactly as a single ban does",
    );

    const refusedEmpty = waitForEvent<{ error: string }>(
      operatorSocket,
      "admin:error",
    );
    const rosterForNothing = waitForEvent<WireRoster>(
      operatorSocket,
      "admin:accounts",
      undefined,
      1200,
    );
    operatorSocket.emit("admin:bulk", { action: "ban", userIds: [] });
    check(
      (await refusedEmpty) !== null,
      "a selection with nothing in it is refused",
    );
    check(
      (await rosterForNothing) === null,
      "and there is no change for a roster to describe",
    );

    const refusedNothing = waitForEvent<{ error: string }>(
      operatorSocket,
      "admin:error",
    );
    const rosterForNoChange = waitForEvent<WireRoster>(
      operatorSocket,
      "admin:accounts",
      undefined,
      1200,
    );
    operatorSocket.emit("admin:bulk", {
      action: "unban",
      userIds: [run.host.id],
    });
    const noChange = await refusedNothing;
    check(
      noChange !== null,
      "an action that would change none of the accounts it named is refused rather than reported as done",
    );
    check(
      noChange?.error.includes("not banned") === true,
      "carrying the reason the single account path would have given",
    );
    check(
      (await rosterForNoChange) === null,
      "and no roster is sent, because none of it moved",
    );

    const bulkUnban = waitForEvent<{ report: WireBulkReport }>(
      operatorSocket,
      "admin:bulk-result",
    );
    const rosterAfterBulkUnban = waitForEvent<WireRoster>(
      operatorSocket,
      "admin:accounts",
    );
    operatorSocket.emit("admin:bulk", {
      action: "unban",
      userIds: [crowdA.id, crowdB.id],
    });
    const unbanReport = (await bulkUnban)?.report;
    check(
      unbanReport?.applied === 2 && unbanReport?.skipped.length === 0,
      "a selection every account applies to reports a clean run",
    );
    check(
      accountIn(await rosterAfterBulkUnban, crowdA.id)?.bannedAt === null,
      "and the roster shows them in good standing",
    );

    const bulkGrant = waitForEvent<{ report: WireBulkReport }>(
      operatorSocket,
      "admin:bulk-result",
    );
    const rosterAfterBulkGrant = waitForEvent<WireRoster>(
      operatorSocket,
      "admin:accounts",
    );
    operatorSocket.emit("admin:bulk", {
      action: "grant",
      userIds: [crowdA.id, crowdB.id],
    });
    check(
      (await bulkGrant)?.report.applied === 2,
      "a selection can be handed the administrator role together",
    );
    const promotedInBulk = await rosterAfterBulkGrant;
    check(
      accountIn(promotedInBulk, crowdA.id)?.role === "admin" &&
        accountIn(promotedInBulk, crowdB.id)?.role === "admin",
      "and both of them wear it in the roster",
    );

    const refusedBatchCount = waitForEvent<{ error: string }>(
      operatorSocket,
      "admin:error",
    );
    operatorSocket.emit("admin:bulk", {
      action: "purge",
      userIds: [crowdA.id],
      confirmCount: 2,
    });
    check(
      (await refusedBatchCount) !== null,
      "a deletion whose typed count does not match the selection is refused",
    );
    check(
      (await db.user.findUnique({
        where: { id: crowdA.id },
        select: { id: true },
      })) !== null,
      "and the account it named is still there",
    );

    // The operator is deliberately inside the selection. A typed count of
    // three has to delete the two accounts and leave the third, which is
    // the one thing a selection must never be able to do.
    const bulkPurge = waitForEvent<{ report: WireBulkReport }>(
      operatorSocket,
      "admin:bulk-result",
    );
    const rosterAfterBulkPurge = waitForEvent<WireRoster>(
      operatorSocket,
      "admin:accounts",
    );
    operatorSocket.emit("admin:bulk", {
      action: "purge",
      userIds: [crowdA.id, crowdB.id, operator.id],
      confirmCount: 3,
    });
    const purgeReport = (await bulkPurge)?.report;
    check(
      purgeReport?.applied === 2,
      "a typed count of three deletes the two accounts and stops there",
    );
    check(
      (purgeReport?.skipped ?? []).some((reason) =>
        reason.includes("your own account"),
      ),
      "because a selection still cannot delete the operator's own account",
    );
    const afterBatch = await rosterAfterBulkPurge;
    check(
      accountIn(afterBatch, crowdA.id) === undefined &&
        accountIn(afterBatch, crowdB.id) === undefined,
      "both accounts are gone from the roster",
    );
    check(
      (await db.user.findUnique({
        where: { id: operator.id },
        select: { id: true },
      })) !== null,
      "and the operator is still holding the console",
    );

    console.log("\nThe private information spine");
    // Ocean Gambit's foundation, and the one part of this tree that has to
    // be tested adversarially rather than happily: a card that reaches the
    // wrong captain makes the mode worthless, and it does so silently, so
    // "the right captain got a card" proves nothing on its own. Every
    // frame every socket in the harbor receives is kept below and read
    // back afterwards, which is the only way a leak would be seen at all.

    // The counting rule first, which needs no sockets. The sizes are the
    // plan's: four or five captains deal one hidden card, six deal two, and
    // a larger harbor is capped rather than dealt a third.
    const rosterOf = (n: number) =>
      Array.from({ length: n }, (_, i) => `captain-${i}`);
    check(
      hiddenCardCount(3) === 0,
      "a three captain table is dealt no hidden card at all",
    );
    check(
      hiddenCardCount(4) === 1 && hiddenCardCount(5) === 1,
      "four and five captains yield one",
    );
    check(hiddenCardCount(6) === 2, "six captains yield two");
    check(
      hiddenCardCount(9) === 2,
      "and a larger harbor is capped at two rather than dealt a third",
    );

    const seed = "a-seed-of-its-own";
    const drawn = dealRoles(rosterOf(6), seed);
    const hiddenCards = Object.values(drawn).filter((r) => r !== "honest");
    check(
      hiddenCards.length === 2 && hiddenCards.includes("pirate"),
      "a six captain draw holds two hidden cards, one of them a Pirate",
    );
    check(
      hiddenCards.filter((role) => role === "broker").length <= 1,
      "and never two Brokers, since a Broker sails alone",
    );
    check(
      JSON.stringify(dealRoles(rosterOf(6), seed)) === JSON.stringify(drawn),
      "the same seed deals the same hand twice",
    );
    check(
      JSON.stringify(dealRoles(rosterOf(6).reverse(), seed)) ===
        JSON.stringify(drawn),
      "and deals it whatever order the roster arrives in",
    );

    // The hand a captain actually holds adds the personal goal an Honest
    // card carries, and the rule for it is an authoring rule before it is
    // a draw: a flourish belongs to its own commission, so it has to be
    // about the goods that commission asks for rather than about anything
    // the deck felt like naming.
    for (const objective of OBJECTIVE_DECK) {
      const deck = flourishDeck(objective.id);
      check(
        deck.length >= 2,
        `the ${objective.name} has flourishes of its own`,
      );
      check(
        deck.every(
          (flourish) =>
            flourish.kind !== "stock" ||
            objective.resources.some((r) => r.type === flourish.good),
        ),
        "and every stock a flourish asks a captain to keep is one the commission names",
      );
      // The sentence and the number are written from one record, so this
      // holds by construction. It is asserted anyway, because a flourish
      // that prints one number and is measured on another is the kind of
      // defect a captain reads off the card and the code never sees.
      check(
        deck.every((flourish) =>
          flourishLine(flourish).includes(String(flourish.amount)),
        ),
        "and the sentence a flourish prints carries its own number",
      );
    }
    const flourishIds = OBJECTIVE_DECK.flatMap((objective) =>
      flourishDeck(objective.id).map((flourish) => flourish.id),
    );
    check(
      new Set(flourishIds).size === flourishIds.length,
      "every flourish in the deck is its own id",
    );
    check(
      flourishIds.every((id) => flourishById(id)?.id === id),
      "and every one of them reads back out of the deck by id",
    );

    const fullHand = dealCards(rosterOf(6), seed, "hemp_cordage");
    check(
      JSON.stringify(dealCards(rosterOf(6), seed, "hemp_cordage")) ===
        JSON.stringify(fullHand),
      "the same seed deals the same hand twice",
    );
    check(
      JSON.stringify(dealCards(rosterOf(6).reverse(), seed, "hemp_cordage")) ===
        JSON.stringify(fullHand),
      "and deals it whatever order the roster arrives in",
    );
    check(
      Object.entries(fullHand).every(
        ([userId, card]) => card.role === drawn[userId],
      ),
      "and dealing the hand moves no role a seed already dealt",
    );
    const cordageDeck = flourishDeck("hemp_cordage");
    check(
      Object.values(fullHand).every((card) =>
        card.role === "honest"
          ? cordageDeck.some((flourish) => flourish.id === card.flourishId)
          : card.flourishId === null,
      ),
      "every Honest card carries a flourish off its own commission's deck, and no hidden card carries one",
    );

    // The Pirate pair. A seed where the second hidden card came up Pirate is
    // looked for rather than assumed, because at six captains that seat is
    // a coin toss between the two roles and a test that waits on a coin is
    // a test that fails once in a while.
    let pairSeed = "";
    for (let i = 0; i < 500 && pairSeed === ""; i++) {
      const candidate = dealCards(rosterOf(6), `pair-${i}`, "hemp_cordage");
      if (
        Object.values(candidate).filter((card) => card.role === "pirate")
          .length === 2
      ) {
        pairSeed = `pair-${i}`;
      }
    }
    const paired = dealCards(rosterOf(6), pairSeed, "hemp_cordage");
    const pairIds = Object.keys(paired).filter(
      (id) => paired[id].role === "pirate",
    );
    check(
      pairIds.length === 2 &&
        allyFor(paired, pairIds[0]) === pairIds[1] &&
        allyFor(paired, pairIds[1]) === pairIds[0],
      "each of two Pirates names the other, and neither names a third",
    );
    check(
      Object.keys(paired)
        .filter((id) => paired[id].role === "honest")
        .every((id) => allyFor(paired, id) === null),
      "and an Honest captain at that table is told about nobody",
    );

    // The lone Pirate: the only hidden card a four captain table deals, with
    // no second seat for it to know.
    const lone = dealCards(rosterOf(4), seed, "hemp_cordage");
    const loneId = Object.keys(lone).find((id) => lone[id].role === "pirate");
    check(
      loneId !== undefined && allyFor(lone, loneId) === null,
      "a Pirate with no second Pirate at the table is told about nobody",
    );

    // And the Broker, which sails alone by design whether or not the table
    // dealt a Pirate beside it.
    let brokerSeed = "";
    for (let i = 0; i < 500 && brokerSeed === ""; i++) {
      const candidate = dealRoles(rosterOf(6), `broker-${i}`);
      if (Object.values(candidate).includes("broker")) {
        brokerSeed = `broker-${i}`;
      }
    }
    const brokerTable = dealCards(rosterOf(6), brokerSeed, "hemp_cordage");
    check(
      Object.keys(brokerTable).every((id) => allyFor(brokerTable, id) === null),
      "a table holding a Broker tells nobody about a partner, the Broker least of all",
    );

    const gambitHost = await signUp("gamb_a");
    const gambitSecond = await signUp("gamb_b");
    const gambitThird = await signUp("gamb_c");
    const gambitFourth = await signUp("gamb_d");
    run.extraAccounts.push(gambitHost, gambitSecond, gambitThird, gambitFourth);
    const gambitCrew = [gambitHost, gambitSecond, gambitThird, gambitFourth];

    const gambitRoom = await call<{
      room: { id: string; code: string; mode?: string };
    }>("/api/rooms", {
      method: "POST",
      cookie: gambitHost.cookie,
      body: JSON.stringify({
        name: `Smoke gambit harbor ${suffix}`,
        isPublic: false,
        mode: "ocean_gambit",
        // [H9: the unlock code] The phrase, on every sealed harbor this
        // file charters. It reads it out of the table for the reason
        // LEDGER_PHRASE gives, and the H9 section at the end of the suite
        // is where the gate over it is proved.
        unlock: LEDGER_PHRASE,
      }),
    });
    if (gambitRoom.status !== 200) {
      throw new Error("No Gambit harbor to test with, stopping here.");
    }
    const gambitRoomId = gambitRoom.body.room.id;
    check(
      gambitRoom.body.room.mode === "ocean_gambit",
      "a harbor can be opened on the Ocean Gambit lap",
    );

    const gambitSeats = await Promise.all(
      gambitCrew.slice(1).map((captain) =>
        call<{ room: { id: string } }>("/api/rooms/join", {
          method: "POST",
          cookie: captain.cookie,
          body: JSON.stringify({ code: gambitRoom.body.room.code }),
        }),
      ),
    );
    check(
      gambitSeats.every((seat) => seat.status === 200),
      "and the other three captains join it",
    );

    // Four sockets, each with a recorder attached before it takes its
    // seat, so the frames under test include everything the harbor said
    // rather than only the card that was expected.
    type Frame = { event: string; text: string };
    const seated: Array<{
      captain: Captain;
      socket: Socket;
      frames: Frame[];
    }> = [];
    for (const captain of gambitCrew) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      const frames: Frame[] = [];
      socket.onAny((event: string, ...args: unknown[]) => {
        frames.push({ event, text: JSON.stringify(args) });
      });
      const takenASeat = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === gambitRoomId,
      );
      socket.emit("room:join", { roomId: gambitRoomId });
      const seat = await takenASeat;
      check(
        seat !== null,
        `${captain.username} takes a seat in the Gambit harbor`,
      );
      seated.push({ captain, socket, frames });
    }

    const dealtCards = seated.map((seat) =>
      waitForEvent<WireDelivery>(
        seat.socket,
        "private:entry",
        (payload) => payload?.roomId === gambitRoomId,
      ),
    );
    seated[0].socket.emit("room:start", { roomId: gambitRoomId });
    const cards = await Promise.all(dealtCards);
    check(
      cards.every((card) => card !== null),
      "every captain at the table is dealt a card when the voyage sets sail",
    );

    const dealtRows = await db.voyageRole.findMany({
      where: { roomId: gambitRoomId },
      select: { userId: true, role: true },
    });
    const roleOf = (userId: string) =>
      dealtRows.find((row) => row.userId === userId)?.role;
    check(
      dealtRows.length === gambitCrew.length,
      "and one row per captain is written and no more",
    );
    const hidden = dealtRows.filter((row) => row.role !== "honest");
    check(
      hidden.length === 1,
      "the harbor holds exactly one hidden card at four captains",
    );
    for (const [index, seat] of seated.entries()) {
      const card = cards[index];
      check(
        card?.entry?.kind === "card",
        `${seat.captain.username} is handed a card rather than a bare line`,
      );
      check(
        card?.entry?.role === roleOf(seat.captain.id),
        "and it is the card this table dealt them, read back from the row",
      );
    }

    // Each shape the sweep reads for is matched against the frame it is
    // looking for before any of it is pointed at a harbor. Without this
    // the sweep could be narrowed to nothing by a later edit and go on
    // passing every run, which is the failure mode a leak check has.
    for (const shape of HIDDEN_FIELD_SHAPES) {
      check(
        shape.pattern.test(shape.sample),
        `the sweep matches ${shape.label} when a frame carries one, so it can fail`,
      );
    }

    // Let the departure's broadcasts land before the frames are read
    // back, since the leak this is looking for would ride one of them.
    await new Promise((resolve) => setTimeout(resolve, 600));
    const secret = hidden[0]?.role ?? "pirate";
    const leaks: string[] = [];
    for (const seat of seated) {
      for (const leak of leakedHiddenFields(seat.frames)) {
        leaks.push(`${seat.captain.username} on ${leak}`);
      }
    }
    check(
      leaks.length === 0,
      "no broadcast in the harbor carries a role, a flourish, an ally or an alignment word, on any socket",
    );
    // The sweep above only means something if the shapes it looks for
    // were really on the wire. Every captain at this table is dealt their
    // own role field, so every socket holds one frame carrying one, and
    // the sweep had something to find on all four.
    for (const seat of seated) {
      const ownCard = seat.frames.find(
        (frame) => frame.event === "private:entry",
      );
      const role = roleOf(seat.captain.id);
      check(
        ownCard !== undefined &&
          new RegExp(`"role"\\s*:\\s*"${role}"`).test(ownCard.text),
        `${seat.captain.username}'s own card is the frame carrying their ${role} role, so the sweep had something to find`,
      );
    }
    check(
      seated.every(
        (seat) =>
          seat.frames.filter((frame) => frame.event === "private:entry")
            .length === 1,
      ),
      "and every socket received exactly one private entry, its own",
    );

    // The card carries two optional fields now, so the same question is
    // asked of them. The first is the personal goal every Honest captain
    // was dealt, which has to come off the deck authored for this
    // harbor's own commission rather than off any deck at all.
    const tableObjective = drawObjective(objectiveSeed(gambitRoomId, 0));
    const tableDeck = flourishDeck(tableObjective.id);
    for (const [index, seat] of seated.entries()) {
      const entry = cards[index]?.entry;
      const honest = roleOf(seat.captain.id) === "honest";
      check(
        honest === Boolean(entry?.flourish),
        `${seat.captain.username} is dealt a flourish exactly when their card is Honest`,
      );
      if (honest) {
        check(
          tableDeck.some((flourish) => flourish.id === entry?.flourish),
          "and it is one of the flourishes authored for this commission",
        );
      }
    }
    // The second is the ally, which at four captains must appear on no
    // socket at all: one hidden card is no pair, and nobody at this table
    // has a partner to be told about.
    check(
      seated.every((seat) =>
        seat.frames.every((frame) => !frame.text.includes('"ally"')),
      ),
      "and no socket at a one hidden card table carries an ally field",
    );

    // A reload is a captain asking for the card they already hold. The
    // row is read back rather than drawn again, which is what keeps a
    // refresh from moving every card at the table.
    const rejoining = await openAuthedSocket(gambitSecond);
    run.sockets.push(rejoining);
    const replayed = waitForEvent<WireDelivery>(
      rejoining,
      "private:entry",
      (payload) => payload?.roomId === gambitRoomId,
    );
    rejoining.emit("room:join", { roomId: gambitRoomId });
    const replayedCard = await replayed;
    check(
      replayedCard?.entry?.role === roleOf(gambitSecond.id),
      "a captain who reloads is handed the card they were already holding",
    );
    check(
      (await db.voyageRole.count({ where: { roomId: gambitRoomId } })) ===
        gambitCrew.length,
      "and nothing was dealt a second time",
    );

    seated[0].socket.emit("room:restart", { roomId: gambitRoomId });
    await new Promise((resolve) => setTimeout(resolve, 600));
    check(
      (await db.voyageRole.count({ where: { roomId: gambitRoomId } })) === 0,
      "restarting the voyage clears the hand it dealt",
    );
    const redealt = waitForEvent<WireDelivery>(
      seated[1].socket,
      "private:entry",
      (payload) => payload?.roomId === gambitRoomId,
    );
    seated[0].socket.emit("room:start", { roomId: gambitRoomId });
    check((await redealt) !== null, "and setting sail again deals a new one");

    // The Pirate pair, on the wire, at the one table size that deals two.
    // The hand is written by hand rather than drawn, for two reasons: at
    // six captains the second seat is a coin toss between the two roles
    // and a test that waits on a coin is a test that fails once in a
    // while, and a table that already holds rows is the path a reload
    // walks, so authoring the hand puts the idempotent half of the deal
    // under the same assertions as the draw.
    const gambitFifth = await signUp("gamb_e");
    const gambitSixth = await signUp("gamb_f");
    run.extraAccounts.push(gambitFifth, gambitSixth);
    const pairedCrew = [...gambitCrew, gambitFifth, gambitSixth];

    const pairedRoom = await call<{
      room: { id: string; code: string; mode?: string };
    }>("/api/rooms", {
      method: "POST",
      cookie: gambitHost.cookie,
      body: JSON.stringify({
        name: `Smoke gambit pair ${suffix}`,
        isPublic: false,
        mode: "ocean_gambit",
        unlock: LEDGER_PHRASE,
      }),
    });
    if (pairedRoom.status !== 200) {
      throw new Error("No six captain Gambit harbor to test with.");
    }
    const pairedRoomId = pairedRoom.body.room.id;
    const pairedJoins = await Promise.all(
      pairedCrew.slice(1).map((captain) =>
        call<{ room: { id: string } }>("/api/rooms/join", {
          method: "POST",
          cookie: captain.cookie,
          body: JSON.stringify({ code: pairedRoom.body.room.code }),
        }),
      ),
    );
    check(
      pairedJoins.every((joined) => joined.status === 200),
      "six captains can sit at one Gambit table",
    );
    check(
      hiddenCardCount(pairedCrew.length) === 2,
      "which is the one table size the mode deals two hidden cards to",
    );

    const pairedSeats: Array<{
      captain: Captain;
      socket: Socket;
      frames: Frame[];
    }> = [];
    for (const captain of pairedCrew) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      const frames: Frame[] = [];
      socket.onAny((event: string, ...args: unknown[]) => {
        frames.push({ event, text: JSON.stringify(args) });
      });
      const takenASeat = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === pairedRoomId,
      );
      socket.emit("room:join", { roomId: pairedRoomId });
      await takenASeat;
      pairedSeats.push({ captain, socket, frames });
    }

    // The authored hand: two Pirates, three Honest cards, and one Honest
    // card holding a flourish id that no deck can print. Two of the
    // flourishes are real, so the card can be checked against the deck
    // this harbor drew for itself; the third is the defensive read, which
    // has to drop an unprintable id rather than send a goal with no
    // sentence under it.
    const pairedObjective = drawObjective(objectiveSeed(pairedRoomId, 0));
    const pairedDeck = flourishDeck(pairedObjective.id);
    await db.voyageRole.createMany({
      data: [
        { roomId: pairedRoomId, userId: gambitHost.id, role: "pirate" },
        { roomId: pairedRoomId, userId: gambitSecond.id, role: "pirate" },
        {
          roomId: pairedRoomId,
          userId: gambitThird.id,
          role: "honest",
          flourish: pairedDeck[0].id,
        },
        {
          roomId: pairedRoomId,
          userId: gambitFourth.id,
          role: "honest",
          flourish: pairedDeck[1].id,
        },
        {
          roomId: pairedRoomId,
          userId: gambitFifth.id,
          role: "honest",
          flourish: "a-flourish-no-deck-can-print",
        },
        { roomId: pairedRoomId, userId: gambitSixth.id, role: "honest" },
      ],
    });

    const pairedCards = pairedSeats.map((seat) =>
      waitForEvent<WireDelivery>(
        seat.socket,
        "private:entry",
        (payload) => payload?.roomId === pairedRoomId,
      ),
    );
    pairedSeats[0].socket.emit("room:start", { roomId: pairedRoomId });
    const pairedHand = await Promise.all(pairedCards);
    check(
      pairedHand.every((card) => card !== null),
      "a hand already written down is the hand a table is dealt",
    );
    const pairedCardFor = new Map(
      pairedSeats.map((seat, index) => [seat.captain.id, pairedHand[index]]),
    );

    const firstAlly = pairedCardFor.get(gambitHost.id)?.entry?.ally;
    const secondAlly = pairedCardFor.get(gambitSecond.id)?.entry?.ally;
    check(
      firstAlly?.userId === gambitSecond.id &&
        firstAlly?.name === "Smoke gamb_b",
      "the first Pirate is handed the second by name and id",
    );
    check(
      secondAlly?.userId === gambitHost.id &&
        secondAlly?.name === "Smoke gamb_a",
      "and the second is handed the first",
    );
    check(
      pairedCardFor.get(gambitThird.id)?.entry?.flourish === pairedDeck[0].id &&
        pairedCardFor.get(gambitFourth.id)?.entry?.flourish ===
          pairedDeck[1].id,
      "an Honest captain is handed the flourish their own row holds",
    );
    check(
      pairedCardFor.get(gambitFifth.id)?.entry?.flourish === undefined,
      "a flourish id no deck can print is dropped rather than sent",
    );
    check(
      pairedCardFor.get(gambitSixth.id)?.entry?.flourish === undefined &&
        pairedCardFor.get(gambitSixth.id)?.entry?.ally === undefined,
      "and a card dealt neither carries neither",
    );

    // The sweep, on the table that has a secret worth leaking and a
    // partner worth telling. Two frames may carry the ally and both must
    // be the entry frames of the two captains it names, which is why the
    // count below reads every frame including the cards; nothing else on
    // any of the six sockets may carry any hidden field at all, which is
    // what the sweep under it reads for.
    await new Promise((resolve) => setTimeout(resolve, 600));
    const allyFrames: { captain: string; event: string }[] = [];
    const pairLeaks: string[] = [];
    for (const seat of pairedSeats) {
      for (const frame of seat.frames) {
        if (!frame.text.includes('"ally"')) continue;
        allyFrames.push({
          captain: seat.captain.username,
          event: frame.event,
        });
      }
      for (const leak of leakedHiddenFields(seat.frames)) {
        pairLeaks.push(`${seat.captain.username} on ${leak}`);
      }
    }
    check(
      allyFrames.length === 2 &&
        allyFrames.every((frame) => frame.event === "private:entry") &&
        new Set(allyFrames.map((frame) => frame.captain)).size === 2,
      "the ally field reaches two entry frames on two sockets and no other frame on any of them",
    );
    check(
      pairLeaks.length === 0,
      "and no broadcast at the paired table carries a role, a flourish, an ally or an alignment word either",
    );

    // The row is the record, so the flourish has to survive the write.
    const pairedRows = await db.voyageRole.findMany({
      where: { roomId: pairedRoomId },
      select: { userId: true, role: true, flourish: true },
    });
    check(
      pairedRows.length === pairedCrew.length &&
        pairedRows.find((row) => row.userId === gambitThird.id)?.flourish ===
          pairedDeck[0].id,
      "and every flourish is written down beside the role that drew it",
    );

    // A reload of a Pirate, which is the one path that has to work the
    // pairing out again rather than read it off the row it is sending.
    const pairedReload = await openAuthedSocket(gambitSecond);
    run.sockets.push(pairedReload);
    const pairedReplayed = waitForEvent<WireDelivery>(
      pairedReload,
      "private:entry",
      (payload) => payload?.roomId === pairedRoomId,
    );
    pairedReload.emit("room:join", { roomId: pairedRoomId });
    const replayedCard2 = await pairedReplayed;
    check(
      replayedCard2?.entry?.ally?.userId === gambitHost.id,
      "and a Pirate who reloads is handed their ally again",
    );

    // The other half of the guard: a harbor on the founding lap deals
    // nothing at all, so a Classic voyage is untouched by any of this.
    const classicRoom = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: gambitHost.cookie,
        body: JSON.stringify({
          name: `Smoke classic harbor ${suffix}`,
          isPublic: false,
        }),
      },
    );
    if (classicRoom.status !== 200) {
      throw new Error("No Classic harbor to test with, stopping here.");
    }
    const classicRoomId = classicRoom.body.room.id;
    await Promise.all(
      gambitCrew.slice(1).map((captain) =>
        call<{ room: { id: string } }>("/api/rooms/join", {
          method: "POST",
          cookie: captain.cookie,
          body: JSON.stringify({ code: classicRoom.body.room.code }),
        }),
      ),
    );
    const classicFrames: string[] = [];
    for (const seat of seated) {
      const takenASeat = waitForEvent<WireHistory>(
        seat.socket,
        "chat:history",
        (payload) => payload?.roomId === classicRoomId,
      );
      seat.socket.onAny((event: string, ...args: unknown[]) => {
        classicFrames.push(
          `${seat.captain.username}:${event}:${JSON.stringify(args)}`,
        );
      });
      seat.socket.emit("room:join", { roomId: classicRoomId });
      await takenASeat;
    }
    seated[0].socket.emit("room:start", { roomId: classicRoomId });
    await new Promise((resolve) => setTimeout(resolve, 600));
    check(
      !classicFrames.some((frame) => frame.includes("private:entry")),
      "a Classic harbor sends no private entry to anyone",
    );
    check(
      (await db.voyageRole.count({ where: { roomId: classicRoomId } })) === 0,
      "and writes no alignment at all",
    );

    console.log("\nThe victory rules");
    // H4. What a card is worth at the end of a voyage, which is arithmetic
    // over numbers other code produced, so all of it is settled here rather
    // than over a socket: the same reason the deck and the draw above are
    // checked without a connection between them. Where those numbers come
    // from is the other half, and the concluded voyage in the section below
    // is where that half is read back off the rows it left behind.

    // ---- The peer ledger ----
    // The one number a Broker is measured on. A trade has two sides and each
    // side runs on its own captain's client, so the property that matters is
    // that the two sides read the same trade: whatever one counts as profit,
    // the other counts as loss, and nothing else in the game moves either.
    const seller = createInitialGameState();
    const buyer = createInitialGameState();
    const tradeLogs: string[] = [];
    // A purse deep enough to pay with, set rather than earned: this block is
    // about what settles, not about how a captain afforded it. The seller's
    // side needs no such help, because the stock a voyage opens with is the
    // Hemp it escrows below.
    buyer.money = 500;
    const offerPosted = postBarterOffer(
      seller,
      "Hemp",
      4,
      "Gold",
      250,
      tradeLogs,
    );
    const taken = acceptBarterOffer(buyer, "Gold", 250, "Hemp", 4, tradeLogs);
    settleBarterTrade(seller, "Gold", 250, "Hemp", 4, tradeLogs);
    check(
      offerPosted && taken,
      "a trade of four Hemp for 250 Gold posts and is taken",
    );
    check(
      buyer.peerTradeProfit === -250,
      "and the captain who paid the Gold counts the whole payment against their profit",
    );
    check(
      seller.peerTradeProfit === 250,
      "while the one who took it counts that same trade as profit",
    );
    check(
      seller.peerTradeProfit + buyer.peerTradeProfit === 0,
      "so the two sides of one settled trade always sum to nothing at all",
    );

    // Escrow is not a trade. An offer that is withdrawn, or swept off the
    // board when the voyage moves on, moved goods and moved no coin, and a
    // ledger that counted it would pay a captain for changing their mind.
    const withdrawn = createInitialGameState();
    const refundLogs: string[] = [];
    postBarterOffer(withdrawn, "Hemp", 2, "Gold", 90, refundLogs);
    refundBarterOffer(withdrawn, "Hemp", 2, refundLogs);
    check(
      withdrawn.peerTradeProfit === 0,
      "and an offer that is withdrawn counts for nothing at all",
    );

    // The other half of the role's distinction: a trade that moved no coin
    // is a trade the card is not measured on, however much cargo changed
    // hands.
    const swapper = createInitialGameState();
    const swapped = createInitialGameState();
    const swapLogs: string[] = [];
    postBarterOffer(swapper, "Hemp", 3, "Silk", 2, swapLogs);
    acceptBarterOffer(swapped, "Silk", 2, "Hemp", 3, swapLogs);
    settleBarterTrade(swapper, "Silk", 2, "Hemp", 3, swapLogs);
    check(
      swapper.peerTradeProfit === 0 && swapped.peerTradeProfit === 0,
      "and goods traded for goods move the ledger on neither side",
    );

    // ---- The three cards ----
    // Every branch of every role, walked on an ending built for it. A
    // commission of this block's own is drawn rather than named, so the
    // delivery goal below is measured against whatever the deck deals. It is
    // deliberately not the harbor's, which is drawn further down.
    const victoryCommission = drawObjective("a-victory-commission");
    const endingOf = (over: Partial<CaptainEnding> = {}): CaptainEnding => ({
      ...readEnding(null, { gold: 0, reputation: 0, bankrupt: false }),
      ...over,
    });
    const judge = (
      role: GambitRole,
      met: boolean,
      ending: Partial<CaptainEnding>,
      flourish: Flourish | null = null,
    ) =>
      evaluateVictory({
        role,
        objective: victoryCommission,
        objectiveMet: met,
        flourish,
        ending: endingOf(ending),
      });

    check(
      judge("honest", true, {}),
      "an Honest captain wins a voyage whose commission the fleet met",
    );
    check(
      !judge("honest", false, {}),
      "and wins nothing when the fleet fell short of it",
    );

    // The four shapes a personal goal comes in, each one a line of
    // arithmetic against the ending, and each one checked at its boundary
    // rather than in the middle: a goal is met at the amount and unmet a
    // single unit below it.
    const purseGoal = {
      id: "smoke_purse",
      kind: "purse" as const,
      amount: 350,
    };
    const repGoal = {
      id: "smoke_rep",
      kind: "reputation" as const,
      amount: 120,
    };
    const stockGoal = {
      id: "smoke_stock",
      kind: "stock" as const,
      good: "Hemp",
      amount: 4,
    };
    check(
      judge("honest", true, { gold: 350 }, purseGoal) &&
        !judge("honest", true, { gold: 349 }, purseGoal),
      "a purse goal counts the Gold a captain ends the voyage holding",
    );
    check(
      judge("honest", true, { reputation: 120 }, repGoal) &&
        !judge("honest", true, { reputation: 119 }, repGoal),
      "a standing goal counts their rating",
    );
    check(
      judge("honest", true, { held: { Hemp: 4 } }, stockGoal) &&
        !judge("honest", true, { held: { Hemp: 3 } }, stockGoal),
      "and a hold goal counts what is still in the hold after the commission has been paid",
    );

    // The delivery goal is the one that is clamped, and the clamp is the
    // property worth checking: a captain can only hand over what the
    // commission still owed, so a save claiming more than that is claiming a
    // delivery the voyage could not have recorded.
    const fullDelivery: Record<string, number> = {};
    for (const owedGood of victoryCommission.resources) {
      fullDelivery[owedGood.type] = owedGood.required;
    }
    const wholeCommission = objectiveTotalItems(victoryCommission);
    check(
      flourishMet(
        {
          id: "smoke_delivery",
          kind: "delivery",
          amount: wholeCommission,
        },
        endingOf({ delivered: fullDelivery }),
        victoryCommission,
      ),
      `handing over the whole commission meets a goal as wide as the commission (${wholeCommission} items)`,
    );
    const overclaimed = { ...fullDelivery };
    overclaimed[victoryCommission.resources[0].type] += 100;
    check(
      !flourishMet(
        {
          id: "smoke_delivery",
          kind: "delivery",
          amount: wholeCommission + 1,
        },
        endingOf({ delivered: overclaimed }),
        victoryCommission,
      ),
      "and a save claiming a hundred items past the commission counts none of the excess",
    );

    // The Broker, which is the one card that does not care what the fleet
    // did. Both directions of that are checked together, because the design
    // claim is precisely that the commission is neither required nor a bar.
    check(
      judge("broker", false, { peerTradeProfit: BROKER_PAYOUT_TARGET }),
      "a Broker reaches the target and wins on a voyage the fleet fell short of",
    );
    check(
      judge("broker", true, { peerTradeProfit: BROKER_PAYOUT_TARGET + 1 }),
      "and wins a voyage the fleet completed too, which is the seat being greedy rather than hostile",
    );
    check(
      !judge("broker", true, { peerTradeProfit: BROKER_PAYOUT_TARGET - 1 }),
      "while one Gold short of the target is one Gold short of winning",
    );

    // The Pirate, which is the one card that needs the fleet to fail and
    // still has to be denied to a captain who spent the voyage hiding. The
    // three ways to be denied are checked one at a time.
    check(
      judge("pirate", false, { reputation: PIRATE_STANDING_FLOOR }),
      "a Pirate wins a voyage that fell short, from the floor and no lower",
    );
    check(
      !judge("pirate", true, { reputation: PIRATE_STANDING_FLOOR }),
      "and wins nothing on a voyage the fleet completed",
    );
    check(
      !judge("pirate", false, {
        reputation: PIRATE_STANDING_FLOOR,
        bankrupt: true,
      }),
      "nor one they ended bankrupt, however far short the fleet fell",
    );
    check(
      !judge("pirate", false, { reputation: PIRATE_STANDING_FLOOR - 1 }),
      "nor one they spent below the floor of standing the card demands",
    );

    check(
      victoryLine("broker", null).includes(String(BROKER_PAYOUT_TARGET)),
      "and the target printed on a Broker's card is read from the same knob the rule is",
    );

    // ---- Reading an ending ----
    // The rules are only as sound as the numbers they are handed, and those
    // arrive out of a save blob a client wrote. Every field is treated as
    // untrusted, the same discipline the Ledger Integrity Pass reads money
    // and score with.
    const reported = { gold: 40, reputation: 30, bankrupt: false };
    const unwritten = readEnding(null, reported);
    check(
      unwritten.held.Hemp === 0 &&
        unwritten.delivered.Hemp === 0 &&
        unwritten.peerTradeProfit === 0,
      "a blob with no hold, no deliveries and no ledger reads as a captain who kept none rather than as a broken one",
    );
    const written = readEnding(
      {
        inventory: { Hemp: 3 },
        objectiveDelivered: { Hemp: 6 },
        peerTradeProfit: 450,
      },
      reported,
    );
    check(
      written.held.Hemp === 3 &&
        written.delivered.Hemp === 6 &&
        written.peerTradeProfit === 450,
      "and a blob that carries them reads back as it was written",
    );
    check(
      readEnding({ peerTradeProfit: "2200" }, reported).peerTradeProfit === 0,
      "a ledger that is not a number is passed over rather than repaired",
    );
    check(
      readEnding({ gold: 999999, peerTradeProfit: 10 }, reported).gold ===
        reported.gold,
      "and no save can talk over the finish report the row is built from",
    );

    // ---- The pass that guards them ----
    // The Broker is the one role that wins alone, so a doctored save is the
    // cheapest win in the mode and the guard has to know the field.
    check(
      snapshotFromSave({ peerTradeProfit: 2200 })?.peerTradeProfit === 2200,
      "the Ledger Integrity Pass reads the peer ledger out of a save",
    );
    check(
      checkSave({ peerTradeProfit: 1e12 }, 3).severity === "impossible",
      "and a ledger no harbor could have produced is impossible",
    );
    check(
      checkSave({ peerTradeProfit: -500 }, 3).severity === "ok",
      "while a captain who spent more on trade than they took in is no forger",
    );

    console.log("\nThe voyage briefings");
    // What a mode hands a captain before the voyage begins: its badge, its
    // tagline, its summary, and the briefing it prints on the Welcome
    // screen. Nothing derives them. They are copy, written beside the lap
    // in the mode record, and that is why they are checked here rather
    // than trusted: the compiler cannot tell whether a sentence about the
    // shape of a round is true, so a briefing that disagrees with its own
    // lap is a lie only a player can catch. The bug this section was
    // written for is a real one rather than a hypothetical. The Gambit
    // briefing numbered four legs and listed five, and the pill above it
    // printed a fourth number of its own that matched neither.
    //
    // A mode briefs in one of two shapes, and each is held to the lap
    // from the side it can be held from. A line is prose, so it is read
    // through its words: every leg of the mode's own lap has to be named
    // by some step of the sentence, and the steps have to run in the order
    // the engine walks them. A chart is data, so it is read through the
    // checkpoints it names. Both claims are the same claim about the lap.

    // The house rule for every string a mode hands a captain, read with the
    // one rule a regex can hold this file to.
    const modeCopy = MODE_ORDER.flatMap((mode) => {
      const { badge, tagline, summary, failureRule, differences, briefing } =
        MODES[mode];
      return [
        badge,
        tagline,
        summary,
        failureRule,
        ...differences,
        ...(briefing.kind === "line"
          ? [briefing.text]
          : [
              ...briefing.legs.flatMap((leg) => {
                // A chart prints the phase's own face over each leg (see
                // PHASE_FACES), so the words a mode hands a captain are those
                // plus what the mode itself says the leg decides.
                const face = phaseFace(leg.phase);
                return [
                  face.icon,
                  face.gradient,
                  face.label,
                  face.short,
                  leg.body,
                  leg.setsUp,
                ];
              }),
              briefing.closes,
            ]),
      ];
    });
    check(
      modeCopy.every((line) => !CARRIES_A_DASH.test(line)),
      "no line a mode hands a captain carries an en dash, an em dash or a doubled hyphen",
    );
    // A field left blank is copy that renders as an empty row, which no
    // other check in this file would see: a missing body reads as a leg
    // with nothing to say rather than as a record that lost a string.
    check(
      modeCopy.every((line) => line.trim().length > 0),
      "and every string a mode hands a captain says something rather than opening empty",
    );

    // The same copy under the stricter rule, which is the one the mode's own
    // prose is held to: no hyphen at all. Built from the prose rather than
    // from the array above, and the difference is the point. What is left
    // out is the badge, the phase faces and the gradient classes, which are
    // identifiers rather than sentences, and the phase labels, which are
    // shared with the rail rather than written by the mode. What is in it is
    // every sentence a mode writes about itself: what it is, what it costs
    // to fail, what it changes, and what each leg of its round decides.
    const modeProse = MODE_ORDER.flatMap((mode) => {
      const { tagline, summary, failureRule, differences, briefing } =
        MODES[mode];
      return [
        tagline,
        summary,
        failureRule,
        ...differences,
        ...(briefing.kind === "line"
          ? [briefing.text]
          : [
              ...briefing.legs.flatMap((leg) => [leg.body, leg.setsUp]),
              briefing.closes,
            ]),
      ];
    });
    check(
      modeProse.every((line) => !CARRIES_A_HYPHEN.test(line)),
      "and every sentence a mode writes about itself is free of hyphens as well as dashes, which is the rule for the documentation a captain reads",
    );
    // The founding voyage is what the others differ from, so its list is
    // empty rather than absent, and a mode that claims to change nothing is
    // a mode someone forgot to write. The two claims are one check because
    // either one alone passes on a broken record: an empty list on both
    // modes passes the first, and a non empty list on Classic passes the
    // second.
    check(
      MODES.classic.differences.length === 0 &&
        MODES.ocean_gambit.differences.length > 0,
      "the founding voyage lists no differences from itself while the experimental one lists the ways it plays differently, which is the array every surface that explains a mode reads",
    );

    // What the three surfaces that teach the rules do with that array. Each
    // one is read for both modes and for every tier, and each one has to do
    // two things: print the record's own words rather than a version of
    // them written where they are shown, and say something different about
    // Gambit than it says about Classic. The defect this section was
    // written for was both at once: the tutorial taught Classic's lap and
    // promised that bankruptcy ends the voyage, on a mode built on the
    // opposite pillar, and nothing in this file could see it.
    for (const mode of MODE_ORDER) {
      const play = MODES[mode];
      const steps = tutorialSteps(mode, "fair_winds");
      const guide = guideText(mode, "fair_winds");
      const tips = tipsText(mode, "fair_winds");
      check(
        steps.some((step) => step.content.includes(play.failureRule)) &&
          guide.includes(play.failureRule) &&
          // The advice prints it where the rule is not the end of a voyage,
          // because every line under it is written for a captain whose
          // books can sink them, and that is what the note is for.
          (play.bankruptcyIsFinal || tips.includes(play.failureRule)) &&
          guide.includes(play.tagline) &&
          play.differences.every(
            (line) =>
              steps.some((step) => step.content.includes(line)) &&
              guide.includes(line),
          ),
        `every surface that teaches the ${play.badge} voyage prints the words the record states, so the tutorial, the guide and the advice cannot teach three versions of one rule`,
      );
    }
    for (const tier of ["fair_winds", "open_waters", "monsoon"] as const) {
      check(
        guideText("classic", tier) !== guideText("ocean_gambit", tier) &&
          tipsText("classic", tier) !== tipsText("ocean_gambit", tier) &&
          JSON.stringify(tutorialSteps("classic", tier)) !==
            JSON.stringify(tutorialSteps("ocean_gambit", tier)),
        `${MODES.ocean_gambit.badge} is documented on its own terms at ${tier}: the guide, the advice and the tutorial each word the experimental voyage differently from the founding one rather than sharing a page`,
      );
    }
    // The page count, which is the other half of the same claim: a mode with
    // nothing to say about itself adds no page, and a mode that changes
    // rules adds exactly one, so a new captain's manual is as long as the
    // mode they picked has something to teach them.
    check(
      tutorialSteps("ocean_gambit", "fair_winds").length ===
        tutorialSteps("classic", "fair_winds").length + 1 &&
        MODES.classic.differences.length === 0,
      "the experimental voyage adds one page to the tutorial, the list of what it changes, where the founding voyage's manual is the length it has always been",
    );
    // Every word those surfaces print, with the markup stripped: the
    // directive's rule applied to the documentation a captain reads. The
    // tags are stripped rather than the check narrowed, because a style
    // attribute carries hyphens of its own (font-size, color-mix) and they
    // are not words: what a captain reads is the text between the tags.
    const taughtProse = MODE_ORDER.flatMap((mode) =>
      (["fair_winds", "open_waters", "monsoon"] as const).flatMap((tier) => [
        ...tutorialSteps(mode, tier).flatMap((step) => [
          step.title,
          step.content.replace(/<[^>]*>/g, " "),
        ]),
        guideText(mode, tier),
        tipsText(mode, tier),
      ]),
    );
    check(
      taughtProse.every((line) => !CARRIES_A_HYPHEN.test(line)),
      "every word the tutorial, the guide and the advice print for either mode at any tier is free of dashes and hyphens, read with the markup stripped",
    );

    // The two surfaces a captain meets before the first round, which are
    // components rather than functions and so are read as source rather
    // than rendered: the lobby's manual and the room's Welcome screen. Each
    // one takes the mode and prints the record's own fields, and neither
    // states a mode's rules in words of its own. The sentence named in the
    // second check is the one the manual used to carry: it told every crew,
    // in the founding mode's voice, that failing the bills ends the voyage,
    // and no crew sailing the experimental mode had been told the truth.
    const manualSource = readFileSync(
      join(
        import.meta.dirname,
        "..",
        "src/components/portmasters/HowToPlayModal.tsx",
      ),
      "utf8",
    );
    const welcomeSource = readFileSync(
      join(
        import.meta.dirname,
        "..",
        "src/components/portmasters/game/phases/Welcome.tsx",
      ),
      "utf8",
    );
    // Read with the comments taken out, because these two checks are about
    // what a screen prints rather than about what its file says, and the
    // difference is real here: this tree's comments quote the sentence they
    // replaced, which is what makes a repair readable a year later, and the
    // first run of this check failed on the note that explains the fix
    // rather than on the defect. Stripping is the narrowest way to say
    // "the code": a comment that names play.failureRule no longer counts as
    // printing it either, so the check gets stronger as well as truer.
    const manualCode = withoutComments(manualSource);
    const welcomeCode = withoutComments(welcomeSource);
    check(
      manualCode.includes("modeConfig(mode)") &&
        manualCode.includes("play.failureRule") &&
        manualCode.includes("play.differences") &&
        !manualCode.includes("you go bankrupt"),
      "the lobby's manual takes the mode it is opened for and prints the record's own rule for a failed seat, rather than the sentence that told every crew the founding voyage's answer",
    );
    check(
      welcomeCode.includes("play.failureRule") &&
        !welcomeCode.includes("Voyages await"),
      "and the Welcome screen states the mode's own stake before the first Dawn, and counts rounds rather than calling each round a voyage",
    );
    // The last of the copy this defect reached, and the only line of it that
    // was wrong before the experimental mode existed: the lobby's Legacy
    // card named Fair Winds' eight rounds above the very screen a captain
    // chooses a voyage on, which is wrong for two of the three charters and
    // for every Gambit table as well, and it ended on the founding mode's
    // ending. The rule needs neither a number nor an ending.
    const lobbyCode = withoutComments(
      readFileSync(
        join(import.meta.dirname, "..", "src/components/portmasters/Lobby.tsx"),
        "utf8",
      ),
    );
    check(
      !lobbyCode.includes("on the way to Round 8") &&
        !lobbyCode.includes("ends in bankruptcy"),
      "and the lobby's Legacy card states the Renown rule without naming a voyage's length or a mode's ending, so the card a captain reads before choosing a charter is true of the charter they choose",
    );
    check(
      !carriesADash("src/lib/game/mode.ts") &&
        !carriesADash("src/components/portmasters/HowToPlayModal.tsx") &&
        !carriesADash("src/components/portmasters/game/phases/Welcome.tsx") &&
        !carriesADash("src/components/portmasters/Lobby.tsx"),
      "and the four files this copy lands in carry no dash of any kind, comments included",
    );

    // The glyphs a captain reads, held by the same rule the words are: the
    // sequences that draw them are built from code points rather than
    // spelled, because a check that carries the sequence it verifies cannot
    // see the sequence change. What this guards is a real regression rather
    // than an imagined one. The pirate flag is a flag joined to a skull by a
    // zero width joiner, which is invisible in the source and to the
    // compiler, and a documentation pass over the settlement panel dropped
    // it: the flag rendered as a bare black flag with a skull beside it for
    // a release, and only a player could see it.
    const PIRATE_FLAG = String.fromCodePoint(0x1f3f4, 0x200d, 0x2620, 0xfe0f);
    const UNJOINED_FLAG_FORMS = [
      String.fromCodePoint(0x1f3f4, 0x2620, 0xfe0f),
      String.fromCodePoint(0x1f3f4, 0x2620),
    ];
    const pirateSites = walkSrc(join(import.meta.dirname, "..", "src"));
    // The panel that draws the flag, which the settlement phase renders
    // before its bills come due. The phase is written across more than one
    // file, and this names the one that holds the glyph rather than the one
    // that routes to it.
    const settlementSource = pirateSites.find((file) =>
      file.endsWith(join("phases", "PirateAttack.tsx")),
    );
    check(
      settlementSource !== undefined &&
        readFileSync(settlementSource, "utf8").includes(PIRATE_FLAG) &&
        pirateSites.every((file) =>
          UNJOINED_FLAG_FORMS.every(
            (form) => !readFileSync(file, "utf8").includes(form),
          ),
        ),
      "the pirate flag is drawn with the zero width joiner that makes it one glyph, in the panel that shows it and in every other source file, so the icon cannot quietly lose it again",
    );

    // Where a mode's briefing puts a thing, as the words it prints for its
    // own legs. A line is split on its own arrow; a chart is its leg order.
    // Both are the mode saying this comes before that, which is the claim
    // the checks further down hold it to.
    const briefingOrder = (mode: GameMode): string[] => {
      const { briefing } = MODES[mode];
      return briefing.kind === "line"
        ? briefing.text.split("→").map((step) => step.trim())
        : briefing.legs.map((leg) => phaseFace(leg.phase).label);
    };

    // A line's own arithmetic, which the numbers used to carry and which
    // B1 moved onto the names: with the numerals retired, a sentence about
    // the shape of a round is held to the same claim the chart is, read
    // through its words. Each step must name one leg of the mode's own lap,
    // in the order the engine walks them, and the words are the faces
    // rather than typed here, so a phase renamed in the table renames the
    // check with it. An icon and a colon are the only things a step may
    // put in front of the name, which is what keeps this from passing on a
    // sentence that names the right legs in the wrong order.
    for (const mode of MODE_ORDER) {
      const { briefing } = MODES[mode];
      if (briefing.kind !== "line") continue;
      const steps = briefingOrder(mode);
      const lap = lapPhases(mode).filter(isLegPhase);
      check(
        steps.length === lap.length &&
          lap.every((phase, index) =>
            steps[index].includes(phaseFace(phase).label),
          ),
        `the ${MODES[mode].badge} briefing walks its own lap once each, in the order the engine walks it`,
      );
    }

    // A chart's hold on the lap, which is not arithmetic but identity:
    // every leg names the checkpoint it is, and the legs have to be the
    // mode's own lap, once each and in the order the engine walks them.
    // This is what keeps a chart honest the day a mode moves a phase, and
    // it is the reason the harbor is dropped rather than listed: waiting
    // to set sail is not a leg a captain pays for, which is the same
    // reason the voyage timeline leaves it off its rail.
    for (const mode of MODE_ORDER) {
      const { briefing } = MODES[mode];
      if (briefing.kind !== "flow") continue;
      const legs = briefing.legs.map((leg) => leg.phase);
      const lap = lapPhases(mode).filter(isLegPhase);
      check(
        legs.length === lap.length &&
          legs.every((phase, index) => phase === lap[index]),
        `the ${MODES[mode].badge} chart covers its own lap once each, in the order the engine walks it`,
      );
      check(
        new Set(legs).size === legs.length,
        "and draws no checkpoint on it twice",
      );
    }

    // The one move the two modes disagree about, and the reason the two
    // briefings differ at all: Classic deals with the table before the
    // manifest is filled, and Gambit fills it first so that the table has
    // nothing to trade against. Read off both sides, because the words and
    // the lap can disagree: a briefing that stated the move backwards
    // would be teaching a new captain the opposite game while the engine
    // ran the right one, and nothing else in this file would notice.
    for (const mode of MODE_ORDER) {
      const lap = lapPhases(mode);
      const ordersFirstOnTheLap = lap.indexOf("orders") < lap.indexOf("parley");
      // Probed by the label the briefing actually prints, so the check
      // follows a phase renamed in the face table rather than pinning the
      // old word here. Read as "the step that names this phase" rather than
      // as equality with the whole step, because the two shapes say
      // different amounts: a chart's leg is the name alone, while a line's
      // step is an icon, the name and a phrase about it, and this check is
      // about which comes first rather than about how much each one says.
      // What is asserted is the order, which is what the two modes disagree
      // about.
      const words = briefingOrder(mode);
      const stepFor = (phase: Phase) => {
        const label = phaseFace(phase).label;
        return words.findIndex((word) => word.includes(label));
      };
      const parleyAt = stepFor("parley");
      const ordersAt = stepFor("orders");
      check(
        ordersAt !== -1 &&
          parleyAt !== -1 &&
          ordersFirstOnTheLap === ordersAt < parleyAt,
        `the ${MODES[mode].badge} briefing runs its manifest and its table in the order its lap does`,
      );
    }

    console.log("\nThe leg clock");
    // [B1: the six phase leg, as data] What the release changed, held to
    // what it has to be rather than to what it was. Three separate claims
    // have to hold at once, and the compiler cannot see any of them: the
    // modes run the same six phases in different orders, the ready check
    // gates those six and nothing else, and a voyage that was already
    // sailing when this landed is placed where it was rather than dropped.
    //
    // Everything below reads the same two modules the engine and the room
    // read (./checkpoint and ./phases) rather than restating them, which is
    // the point: a lap written out here a second time would pass every
    // check in this section while the room walked a different one.
    for (const mode of MODE_ORDER) {
      const badge = MODES[mode].badge;
      const lap = lapPhases(mode);
      const legs = lap.filter(isLegPhase);
      check(
        lap[0] === ENTRY_PHASE &&
          legs.length === LEG_PHASE_ORDER.length &&
          LEG_PHASE_ORDER.every((phase) => legs.includes(phase)),
        `the ${badge} lap opens at the pier and visits every phase of the leg, once each`,
      );
      check(
        lap.filter((phase) => !isLegPhase(phase)).length === 1,
        "and carries nothing on it that is not a phase of the leg",
      );
      // Where a round actually opens, which is not the pier: the lap opens
      // there so the room has a lobby, and the first leg phase is what the
      // host's Set Sail opens the round at. Read as "the first entry that is
      // leg work" rather than as "the second entry", so a lap that listed
      // its phases in another order would still open correctly.
      check(
        openingPhase(mode) === lap[1] && isGatedPhase(mode, openingPhase(mode)),
        `the ${badge} round opens at the first phase of the leg, which is a seat the room waits on`,
      );
      // The room waits where the lap says it waits, which is every phase of
      // the leg and the pier nowhere in it. Bartering and artisan management
      // used to be checkpoints of their own; neither names a lap seat now,
      // so neither is a place the harbor can be made to wait.
      const gated = (Object.keys(PHASE_FACES) as Phase[]).filter((phase) =>
        isGatedPhase(mode, phase),
      );
      check(
        gated.length === LEG_PHASE_ORDER.length &&
          LEG_PHASE_ORDER.every((phase) => gated.includes(phase)),
        `the ${badge} ready check gates the six phases of the leg and nothing else`,
      );
      // Where a round closes, which is a property of the lap rather than of
      // a phase name: the last entry settles the books, and a lap that
      // closed anywhere else would run out of phases without settling.
      check(
        lap.filter((phase) => closesRound(mode, phase)).length === 1 &&
          closesRound(mode, lap[lap.length - 1]),
        `the ${badge} lap closes the round at its own last phase and nowhere else`,
      );
      check(
        lapSuccessor(mode, lap[lap.length - 1]) === ENTRY_PHASE,
        "and hands the closed round back to the pier it opened from",
      );
    }

    // Every phase value this engine has ever persisted, and where a voyage
    // that is already sailing is placed when it loads one. The six landed
    // together with [B1] and renamed the whole vocabulary, so a save written
    // the day before holds one of these, and a save that cannot be placed is
    // a voyage that cannot be resumed. This is the release's rollback
    // clause read forwards: the engine may run the new names, but it has to
    // keep understanding the old ones.
    const persistedBefore: [string, Phase][] = [
      ["0", "harbor"],
      ["5", "dawn"],
      ["1", "market"],
      ["2", "orders"],
      ["3", "resolve"],
      ["4", "dusk"],
      ["barter", "parley"],
      ["worker_mgmt", "market"],
    ];
    check(
      persistedBefore.every(
        ([written, placed]) => normalizePhase(written) === placed,
      ),
      "every phase value an older build wrote is placed at the phase it means now",
    );
    check(
      LEG_PHASE_ORDER.every((phase) => normalizePhase(phase) === phase),
      "and a phase named the way this build names it is left where it is",
    );
    check(
      normalizePhase("sail") === ENTRY_PHASE &&
        normalizePhase(undefined) === ENTRY_PHASE &&
        normalizePhase(7) === ENTRY_PHASE,
      "while a value no build ever wrote is placed at the pier rather than in a phase no lap contains",
    );

    // Every phase a captain can be standing in has a face, because the rail
    // and the panel read it off the phase rather than off a table of their
    // own, and an empty one would render as a blank cell rather than as an
    // error. The dash rule is the house rule for a string a captain reads,
    // held here for the same reason it is held over the mode copy above.
    const faces = Object.keys(PHASE_FACES) as Phase[];
    check(
      faces.every((phase) => {
        const face = phaseFace(phase);
        return (
          face.label.trim().length > 0 &&
          face.short.trim().length > 0 &&
          face.icon.trim().length > 0 &&
          face.gradient.trim().length > 0
        );
      }),
      "every phase wears a name, a short name, a glyph and an accent",
    );
    check(
      faces
        .flatMap((phase) => {
          const face = phaseFace(phase);
          return [face.label, face.short];
        })
        .every((line) => !CARRIES_A_DASH.test(line)),
      "and none of the words a captain reads on one carries an en dash, an em dash or a doubled hyphen",
    );

    console.log("\nA voyage end to end on the six phase leg");
    // [B1: the six phase leg, as data] The plan's evaluation for this slice,
    // read over live sockets rather than off the tables. A whole voyage has
    // to reach every seat of the lap, and both captains have to be told the
    // same checkpoint at every transition. What this catches that no data
    // check can is a phase that does not register with the checkpoint
    // protocol at all: the room sits at it forever, and that shows up here
    // as a harbor that never arrived rather than as one that is quietly
    // wrong.
    //
    // Classic sails its whole voyage, which is the run the evaluation names.
    // Gambit sails one full round: enough to prove its own order drives the
    // same protocol, without spending twelve rounds of wall clock on a lap
    // the leg clock section above already holds to the data. Between them,
    // every seat of both laps is walked by the room itself.
    //
    // Each captain here is brand new and holds exactly one socket, which
    // matters rather than being tidy: the status handler ignores a frame
    // from any socket that is not its captain's newest, so a captain with an
    // older live socket would have every report dropped and the walk would
    // stall for a reason that has nothing to do with the lap. The tag is the
    // short half of the two usernames, which are capped well below what a
    // label like the one the checks print would fit in.
    type LapStep = { round: number; phase: Phase };
    type LapFrame = LapStep & {
      event: "phase:ready_update" | "phase:advance";
      required?: string[];
    };
    const sailTheLap = async (
      label: string,
      tag: string,
      mode: GameMode,
      rounds: number,
      unlock?: string,
    ) => {
      const opening = await signUp(`${tag}a`);
      const crewmate = await signUp(`${tag}b`);
      run.extraAccounts.push(opening, crewmate);
      const opened = await call<{ room: { id: string; code: string } }>(
        "/api/rooms",
        {
          method: "POST",
          cookie: opening.cookie,
          body: JSON.stringify({
            name: `Smoke ${label} lap ${suffix}`,
            isPublic: false,
            mode,
            ...(unlock ? { unlock } : {}),
          }),
        },
      );
      if (opened.status !== 200) {
        throw new Error(`No ${label} harbor to sail a lap in, stopping here.`);
      }
      const room = opened.body.room.id;
      run.lapRoomIds.push(room);
      const joined = await call<{ room: { id: string } }>("/api/rooms/join", {
        method: "POST",
        cookie: crewmate.cookie,
        body: JSON.stringify({ code: opened.body.room.code }),
      });
      check(
        joined.status === 200,
        `the second captain joins the ${label} harbor`,
      );

      const crew: Array<{
        captain: Captain;
        socket: Socket;
        frames: LapFrame[];
      }> = [];
      for (const captain of [opening, crewmate]) {
        const socket = await openAuthedSocket(captain);
        run.sockets.push(socket);
        const frames: LapFrame[] = [];
        const record =
          (event: LapFrame["event"]) =>
          (payload: {
            roomId?: string;
            round?: number;
            phase?: Phase;
            requiredUserIds?: string[];
          }) => {
            if (payload?.roomId !== room) return;
            frames.push({
              event,
              round: payload.round ?? 0,
              phase: normalizePhase(payload.phase),
              required: payload.requiredUserIds,
            });
          };
        socket.on("phase:ready_update", record("phase:ready_update"));
        socket.on("phase:advance", record("phase:advance"));
        const aboard = waitForEvent<WireHistory>(
          socket,
          "chat:history",
          (payload) => payload?.roomId === room,
        );
        socket.emit("room:join", { roomId: room });
        await aboard;
        crew.push({ captain, socket, frames });
      }

      const departures = crew.map((seat) =>
        waitForEvent<{ roomId?: string }>(
          seat.socket,
          "room:started",
          (payload) => payload?.roomId === room,
        ),
      );
      crew[0].socket.emit("room:start", { roomId: room });
      await Promise.all(departures);

      // The run this walk is here to make, written out of the mode's own
      // lap: every seat of the round, repeated for as many rounds as the
      // voyage is long. Nothing about the order is typed in below, so a lap
      // that changed order would change what the room is expected to walk.
      const lap = lapPhases(mode).filter(isLegPhase);
      const expected: LapStep[] = [];
      for (let round = 1; round <= rounds; round++) {
        for (const phase of lap) expected.push({ round, phase });
      }

      const send = (seat: (typeof crew)[number], step: LapStep) => {
        seat.socket.emit("game:status", {
          roomId: room,
          round: step.round,
          phase: step.phase,
          phaseLabel: phaseFace(step.phase).label,
          gold: 100,
          reputation: 10,
          shipLevel: 0,
          gameOver: false,
          renownLevel: 3,
        });
      };
      const ready = (seat: (typeof crew)[number], step: LapStep) => {
        seat.socket.emit("phase:ready", {
          roomId: room,
          round: step.round,
          phase: step.phase,
        });
      };
      // The room's whole protocol, in the order a client runs it: stand
      // where you are, hear the room standing there too, then say you are
      // done. The middle step is not politeness. A ready vote is judged
      // against the checkpoint the server is holding, so a vote that
      // overtakes the report which put the room at this seat is refused as
      // out of step: the harbor would be short a vote, and the walk would
      // have stalled on its own haste rather than on anything the lap does.
      const stand = async (step: LapStep) => {
        for (const seat of crew) send(seat, step);
        for (let waited = 0; waited < 15000; waited += 50) {
          if (
            crew.every((seat) =>
              seat.frames.some(
                (frame) =>
                  frame.event === "phase:ready_update" &&
                  frame.round === step.round &&
                  frame.phase === step.phase,
              ),
            )
          ) {
            return true;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return false;
      };
      const arrived = async (step: LapStep) => {
        for (let waited = 0; waited < 15000; waited += 50) {
          if (
            crew.every((seat) =>
              seat.frames.some(
                (frame) =>
                  frame.event === "phase:advance" &&
                  frame.round === step.round &&
                  frame.phase === step.phase,
              ),
            )
          ) {
            return true;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return false;
      };

      // The claim the ready check makes, held once at the voyage's first
      // seat: a vote from one captain alone does not move the room. Without
      // this the walk would pass on a build that advanced the harbor on any
      // vote at all, since every later step sends both. The voyage opens
      // with the room already standing at this seat, because room:start put
      // it there and said so, so the frame this waits on is already
      // recorded rather than still to come.
      const first = expected[0];
      const standing = await stand(first);
      ready(crew[0], first);
      await new Promise((resolve) => setTimeout(resolve, 600));
      check(
        !crew.some((seat) =>
          seat.frames.some((f) => f.event === "phase:advance"),
        ),
        `one captain's ready vote does not move the ${label} harbor on its own`,
      );
      ready(crew[1], first);
      let reached = 0;
      if (standing && (await arrived(first))) reached = 1;
      // The rest of the voyage is those two steps repeated, once per seat of
      // the lap, for as long as the voyage runs.
      //
      // Paced, because the harbor has a budget for what it will read. The
      // inbound budget (see src/server/realtime/inbound-limit.ts) earns a
      // socket ten frames a second back on top of its burst of thirty, and
      // one step here costs each seat two frames, the report that moves the
      // room and the vote that releases it. A walk that steps as fast as
      // the server answers runs at twice the rate the budget pays out: it
      // drains the burst, and every frame after that is refused without a
      // word, which on this side of the wire looks exactly like a lap that
      // stopped advancing. A third of a second a step holds the walk under
      // seven frames a second a seat, which is inside the budget a shipped
      // client lives inside too.
      const pace = () => new Promise((resolve) => setTimeout(resolve, 300));
      for (const step of expected.slice(1)) {
        await pace();
        if (!(await stand(step))) break;
        ready(crew[0], step);
        ready(crew[1], step);
        if (!(await arrived(step))) break;
        reached++;
      }
      check(
        reached === expected.length,
        `the ${label} harbor reached every seat of its lap (the walk reached ${reached} of ${expected.length})`,
      );

      // Where the room went, as the two captains heard it. The advance frames
      // are the server naming the checkpoint the room is leaving, once per
      // transition, so the sequence they form is the voyage's shape.
      const walked = (seat: (typeof crew)[number]) =>
        seat.frames
          .filter((frame) => frame.event === "phase:advance")
          .map((frame) => `${frame.round}:${frame.phase}`);
      const want = expected.map((step) => `${step.round}:${step.phase}`);
      check(
        walked(crew[0]).join(" ") === want.join(" "),
        `and walked it in the mode's own order, round after round (${walked(crew[0]).slice(0, 7).join(" ")}...)`,
      );
      check(
        walked(crew[1]).join(" ") === want.join(" "),
        "with the second captain told the same thing at every one of them",
      );
      // Not just the same phase, the same frames: every broadcast the room
      // made, in the order it made them. Two clients that agree on the
      // phase but heard a different number of transitions would mean one of
      // them was being carried by a catch up path rather than by the room,
      // which is the failure the rollback clause of [B1] is about.
      check(
        JSON.stringify(crew[0].frames) === JSON.stringify(crew[1].frames),
        `both captains heard the same ${label} frames, in the same order, for the whole voyage`,
      );
      // And the room waited for both of them at every seat rather than
      // advancing around a captain it had stopped counting.
      const requiredBoth = crew[0].frames
        .filter((frame) => frame.event === "phase:ready_update")
        .every(
          (frame) =>
            frame.required?.length === 2 &&
            frame.required.includes(opening.id) &&
            frame.required.includes(crewmate.id),
        );
      check(
        requiredBoth,
        `every ${label} transition waited for a full crew of two`,
      );

      // The terminal is not a seat. A voyage that has finished reports
      // endgame, which no lap lists, so the room's checkpoint stays on the
      // last phase it actually walked rather than following a captain onto a
      // screen the rest of the harbor is not standing on.
      const last = expected[expected.length - 1];
      crew[0].socket.emit("game:status", {
        roomId: room,
        round: last.round,
        phase: "endgame" as Phase,
        phaseLabel: phaseFace("endgame").label,
        gold: 100,
        reputation: 10,
        shipLevel: 0,
        gameOver: true,
        renownLevel: 3,
      });
      await new Promise((resolve) => setTimeout(resolve, 600));
      const settled = await db.room.findUnique({
        where: { id: room },
        select: { currentRound: true, currentPhase: true },
      });
      check(
        settled?.currentRound === last.round &&
          normalizePhase(settled?.currentPhase) === last.phase,
        `and a finished ${label} voyage leaves the room where the lap last stood rather than on the endgame screen`,
      );
    };

    await sailTheLap(
      "Classic",
      "lapc",
      "classic",
      voyageRoundsFor("classic", "fair_winds"),
    );
    await sailTheLap("Gambit", "lapg", "ocean_gambit", 1, LEDGER_PHRASE);

    console.log("\nThe harbor clock");
    // [B2: hard timers, the server as timekeeper] A leg is a segment of real
    // time, and a table is not held hostage to a captain who closed a
    // laptop. Four harbors go through one window at once, because the
    // window is real time and a fact each would otherwise cost a minute of
    // it. The first three sail the mode the clock belongs to, because the
    // clock is the mode's before it is the operator's: a Classic table has
    // no seat that ends on a timer whatever PHASE_CLOCK says, which is what
    // the fourth harbor below is here to hold. What A, B and Q differ in is
    // who is still sitting in the room when the clock runs out:
    //
    //   A: two captains, both aboard and neither doing anything, so the
    //      clock is the only thing in the room that can end the leg.
    //   B: two captains and one of them gone, so the harbor is not hostage
    //      to the laptop that closed.
    //   Q: nobody at all, because an empty room is not a table waiting on a
    //      straggler and its clock does not move it.
    //   C: one captain under way in the founding mode, which the clock does
    //      not reach at all, on a server that is timing the other three.
    //
    // What only this section can hold is that the expiry announces the same
    // advance a unanimous ready set announces. The captains here are raw
    // sockets with no engine behind them, so the frame is all this side of
    // the wire can see; the auto commit that frame draws out of a client is
    // held by the browser check, where a page that never clicks still leaves
    // the leg.
    //
    // The budget is read from the phase table and the server's own scale
    // rather than typed in, for the same reason the lap walk reads the lap
    // rather than restating it. Deliberately read as the two inputs rather
    // than through the server's own helper: a budget this section shared
    // with the code under test would move with it, and a clock that fired at
    // the wrong moment would pass.
    if (loadServerConfig().phaseClockScale <= 0) {
      throw new Error(
        "The clock checks need the server under test to be timing its legs, so PHASE_CLOCK must be a number above zero.\n" +
          "It is off unless it is asked for, and the section below is the asking, so start the server and this script with the same value, or run them in the same shell.",
      );
    }
    const clockSeconds = (phase: Phase) =>
      Math.max(
        1,
        Math.round(
          (phaseFace(phase).seconds ?? 0) * loadServerConfig().phaseClockScale,
        ),
      );
    const dawnSeconds = clockSeconds("dawn");
    const marketSeconds = clockSeconds("market");
    // The empty harbor is judged on the clock's own branch rather than on a
    // room whose last seat was reaped, and those two are only
    // distinguishable while the budget runs out first. A closed socket is
    // reclaimed after thirty seconds (DEPARTURE_GRACE_MS in
    // ./src/server/realtime/presence.ts), and a room whose last seat is
    // taken is deleted with its voyage closed, which ends a clock for a
    // reason that has nothing to do with this slice.
    const GRACE_SECONDS = 30;
    if (dawnSeconds >= GRACE_SECONDS) {
      throw new Error(
        `The clock checks need a phase budget shorter than the ${GRACE_SECONDS} second departure grace, so a room nobody is sitting in is still a room when its clock runs out.\n` +
          `This run reads PHASE_CLOCK=${loadServerConfig().phaseClockScale}, which puts Dawn at ${dawnSeconds} seconds.`,
      );
    }

    // Enough of a frame to make a claim about it: the two numbers a
    // countdown is drawn from, and the tally a seat was left with. Named
    // only by the fields the checks below read, so nothing here can quietly
    // depend on something the server never promised.
    type ClockFrame = {
      event: "phase:advance" | "phase:ready_update" | "room:system";
      round?: number;
      phase?: Phase;
      endsAt?: number | null;
      seconds?: number | null;
      content?: string;
    };

    // One chartered harbor, seated and under way, with every frame of its
    // clock recorded as it arrives. The same shape the lap walk uses to get
    // a voyage sailing, since a harbor reaches the clock the way it reaches
    // anything else: by being started.
    const openClockRoom = async (
      label: string,
      tag: string,
      seats: number,
      mode: GameMode,
    ) => {
      const captains: Captain[] = [];
      for (let seat = 0; seat < seats; seat++) {
        captains.push(await signUp(`${tag}${seat}`));
      }
      run.extraAccounts.push(...captains);
      const opened = await call<{ room: { id: string; code: string } }>(
        "/api/rooms",
        {
          method: "POST",
          cookie: captains[0].cookie,
          body: JSON.stringify({
            name: `Smoke clock ${label} ${suffix}`,
            isPublic: false,
            mode,
            // The experimental voyage is sealed behind its phrase, the way
            // the lap walk opens one: a room that could not be chartered
            // would otherwise fail here as a harbor that does not exist
            // rather than as a door that was not opened.
            ...(mode === "ocean_gambit" ? { unlock: LEDGER_PHRASE } : {}),
          }),
        },
      );
      if (opened.status !== 200) {
        throw new Error(
          `No ${label} harbor to run a clock in, stopping here (${opened.status}).`,
        );
      }
      const roomId = opened.body.room.id;
      run.lapRoomIds.push(roomId);
      for (const captain of captains.slice(1)) {
        const seated = await call("/api/rooms/join", {
          method: "POST",
          cookie: captain.cookie,
          body: JSON.stringify({ code: opened.body.room.code }),
        });
        if (seated.status !== 200) {
          throw new Error(`A captain could not sit in the ${label} harbor.`);
        }
      }
      const crew: Array<{
        captain: Captain;
        socket: Socket;
        frames: ClockFrame[];
      }> = [];
      for (const captain of captains) {
        const socket = await openAuthedSocket(captain);
        run.sockets.push(socket);
        const frames: ClockFrame[] = [];
        socket.on(
          "phase:advance",
          (payload: { roomId?: string; round?: number; phase?: Phase }) => {
            if (payload?.roomId !== roomId) return;
            frames.push({
              event: "phase:advance",
              round: payload.round,
              phase: normalizePhase(payload.phase),
            });
          },
        );
        socket.on(
          "phase:ready_update",
          (payload: {
            roomId?: string;
            round?: number;
            phase?: Phase;
            phaseEndsAt?: number | null;
            phaseSeconds?: number | null;
          }) => {
            if (payload?.roomId !== roomId) return;
            frames.push({
              event: "phase:ready_update",
              round: payload.round,
              phase: normalizePhase(payload.phase),
              endsAt: payload.phaseEndsAt ?? null,
              seconds: payload.phaseSeconds ?? null,
            });
          },
        );
        socket.on(
          "room:system",
          (payload: { roomId?: string; content?: string }) => {
            if (payload?.roomId !== roomId) return;
            frames.push({
              event: "room:system",
              content: payload.content ?? "",
            });
          },
        );
        const aboard = waitForEvent<WireHistory>(
          socket,
          "chat:history",
          (payload) => payload?.roomId === roomId,
        );
        socket.emit("room:join", { roomId });
        await aboard;
        crew.push({ captain, socket, frames });
      }
      const departures = crew.map((seat) =>
        waitForEvent<{ roomId?: string }>(
          seat.socket,
          "room:started",
          (payload) => payload?.roomId === roomId,
        ),
      );
      crew[0].socket.emit("room:start", { roomId });
      await Promise.all(departures);
      return { roomId, crew, sailedAt: Date.now() };
    };

    // Waits for a frame a socket has already recorded rather than for the
    // next one to arrive, because the clock's frames can land between two
    // steps of this file and a listener registered after the fact would
    // wait out its window on news it had already missed.
    const waitForFrame = async (
      seat: { frames: ClockFrame[] },
      match: (frame: ClockFrame) => boolean,
      windowMs: number,
    ): Promise<ClockFrame | null> => {
      for (let waited = 0; waited < windowMs; waited += 250) {
        const found = seat.frames.find(match);
        if (found) return found;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return seat.frames.find(match) ?? null;
    };

    // The voyage a room left behind, read the way a later reader reads it,
    // or null if none was ever written.
    const clockRecord = async (roomId: string) => {
      for (let waited = 0; waited < 25000; waited += 250) {
        const row = await db.voyageTelemetry.findFirst({
          where: { roomId: roomId },
          select: { outcome: true, record: true },
        });
        if (row) {
          return { outcome: row.outcome, record: readStoredRecord(row.record) };
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return null;
    };

    const clockA = await openClockRoom("A", "clka", 2, GAMBIT);
    const clockB = await openClockRoom("B", "clkb", 2, GAMBIT);
    const clockQ = await openClockRoom("Q", "clkq", 1, GAMBIT);
    // The mode boundary, on the same server and inside the same window: a
    // founding-mode harbor whose seat is walked by hand. Nothing is closed
    // on it below, because there is nothing to wait for.
    const clockC = await openClockRoom("C", "clkc", 1, CLASSIC);
    // The two absences a clock has to survive: a captain who closed the tab
    // (B's crewmate) and a harbor with nobody left in it at all (Q's only
    // captain). Both are a socket closing, and neither is a vote.
    clockB.crew[1].socket.close();
    clockQ.crew[0].socket.close();

    // The wire first, while the room is still standing at the seat it
    // opened at: both halves of what a countdown is drawn from, checked
    // together, because a moment drawn on one client and a budget drawn on
    // another is the frame disagreeing with itself. The gap allowed is the
    // two seconds it takes the departure frame to reach this side.
    //
    // The frame read is the first one standing at a seat of the leg rather
    // than the first one on the socket, and the difference is not a detail:
    // joining a room hands the joiner the room's ready state as it stands
    // (src/server/realtime/index.ts:530), so a captain who walks into a
    // lobby is told about the pier first. That frame is the other half of
    // this pair rather than an obstacle to it, since the pier is the seat
    // with no clock, and a field that reads null there is the design: an
    // absence rather than a zero, which no client can draw as a countdown
    // that has already run out.
    const readyStates = clockA.crew[0].frames.filter(
      (frame) => frame.event === "phase:ready_update",
    );
    const pier = readyStates.find((frame) => frame.phase === "harbor");
    const opening = readyStates.find((frame) => frame.phase !== "harbor");
    check(
      pier !== undefined && pier.endsAt === null && pier.seconds === null,
      "the pier a harbor waits at publishes no clock at all, rather than a countdown of zero",
    );
    check(
      opening?.phase === "dawn" &&
        opening.seconds === dawnSeconds &&
        typeof opening.endsAt === "number" &&
        opening.endsAt > clockA.sailedAt &&
        opening.endsAt <= clockA.sailedAt + dawnSeconds * 1000 + 2000,
      `the seat a voyage opens at publishes both halves of its countdown (${dawnSeconds}s of Dawn)`,
    );
    // The same seat, on the same server, in the other mode. Read beside the
    // check above rather than on its own, because the two together are the
    // claim: one server, timing its legs, hands a clock to one harbor and
    // none to the other, and the difference between them is the mode rather
    // than anything the operator set.
    const cOpening = await waitForFrame(
      clockC.crew[0],
      (frame) =>
        frame.event === "phase:ready_update" && frame.phase !== "harbor",
      5000,
    );
    check(
      cOpening?.phase === "dawn" &&
        cOpening.endsAt === null &&
        cOpening.seconds === null,
      "a harbor in the founding mode stands at the same seat with no clock on it, on a server that is timing the other three",
    );

    // The long wait, and the only one this section spends: every clock
    // above was armed within a couple of seconds of the others, so the
    // window A needs covers all three. The settle afterwards is for B, whose
    // clock was armed a second or two later than A's and has to be given
    // that much again before its silence is a fact.
    const windowMs = (dawnSeconds + 20) * 1000;
    const advancedA = await waitForFrame(
      clockA.crew[0],
      (frame) => frame.event === "phase:advance",
      windowMs,
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));

    check(
      advancedA?.round === 1 && advancedA?.phase === "dawn",
      "a harbor nobody has voted in is moved on by the clock it was given",
    );
    // The other half of the boundary, taken at the only moment it can be:
    // the other three harbors have now been standing at Dawn for longer
    // than its whole budget, so a founding mode harbor that had a clock
    // would have been moved by now, and this one never was.
    check(
      clockC.crew.every((seat) =>
        seat.frames.every((frame) => frame.event !== "phase:advance"),
      ),
      "and a harbor in the founding mode is not moved by it at all, however long it is left standing",
    );
    check(
      clockA.crew.every((seat) =>
        seat.frames.some(
          (frame) =>
            frame.event === "phase:advance" &&
            frame.round === 1 &&
            frame.phase === "dawn",
        ),
      ),
      "and both of its captains were told what the room was doing",
    );
    check(
      clockA.crew[0].frames.some(
        (frame) =>
          frame.event === "room:system" &&
          (frame.content ?? "").includes("tide has run out"),
      ),
      "with the harbor saying why, on the channel it says everything else on",
    );
    check(
      clockB.crew[0].frames.some(
        (frame) =>
          frame.event === "phase:advance" &&
          frame.round === 1 &&
          frame.phase === "dawn",
      ),
      "a captain who closed a laptop mid leg does not hold the harbor to their socket",
    );
    // And the announcement is an announcement rather than a move. The
    // server still runs no game rules: the room's row is where the last
    // report put it, and a client that hears the frame is the one that
    // takes the room forward.
    const fired = await db.room.findUnique({
      where: { id: clockA.roomId },
      select: { currentRound: true, currentPhase: true },
    });
    check(
      fired?.currentRound === 1 &&
        normalizePhase(fired?.currentPhase) === "dawn",
      "the clock moved the room's captains without moving its checkpoint",
    );
    // The other half of spending the deadline: the seat is timed once, and
    // the next sign of life arms a fresh budget for the seat the room is
    // actually standing at. This is the path a returning captain takes,
    // since the report that moves the checkpoint is the same report that
    // puts the room back on the clock.
    clockA.crew[0].socket.emit("game:status", {
      roomId: clockA.roomId,
      round: 1,
      phase: "market" as Phase,
      phaseLabel: phaseFace("market").label,
      gold: 100,
      reputation: 10,
      shipLevel: 0,
      gameOver: false,
      renownLevel: 3,
    });
    const rearmed = await waitForFrame(
      clockA.crew[0],
      (frame) =>
        frame.event === "phase:ready_update" &&
        frame.round === 1 &&
        frame.phase === "market",
      8000,
    );
    check(
      rearmed?.seconds === marketSeconds &&
        typeof rearmed.endsAt === "number" &&
        rearmed.endsAt > Date.now() &&
        rearmed.endsAt <= Date.now() + marketSeconds * 1000,
      `and the first report after it puts the room back on the clock (${marketSeconds}s of Market)`,
    );

    // The empty harbor, read off the voyage it leaves behind. It is closed
    // as an emptied one when its last seat is reclaimed, which is the only
    // record a harbor nobody is sitting in can have, and the leg its clock
    // ran out on is not in it: the tally rides the spine the moment the
    // clock fires, so a room that had been moved would be readable here.
    const abandoned = await clockRecord(clockQ.roomId);
    check(
      abandoned?.outcome === "emptied",
      "a harbor abandoned by its last captain closes its voyage as an emptied one",
    );
    check(
      (abandoned?.record?.events ?? []).every(
        (event) => event.name !== "leg_timed_out",
      ),
      "and no leg of it was timed out, because a room nobody is sitting in is not moved by its clock",
    );

    // Room A's own record, flushed the way a host flushes one: restarting
    // the voyage the clock just moved, which closes the record as restarted
    // and leaves it readable.
    clockA.crew[0].socket.emit("room:restart", { roomId: clockA.roomId });
    await waitForEvent<{ roomId?: string }>(
      clockA.crew[0].socket,
      "room:restarted",
      (payload) => payload?.roomId === clockA.roomId,
    );
    const timedOut = await clockRecord(clockA.roomId);
    const tally = (timedOut?.record?.events ?? []).find(
      (event) => event.name === "leg_timed_out",
    );
    check(
      tally?.name === "leg_timed_out" &&
        tally.leg === 1 &&
        tally.ready === 0 &&
        tally.required === 2,
      "the leg the clock ended is on the record with the room it found (0 of 2 ready)",
    );

    console.log("\nStanding orders");
    // [B3: standing orders] The evaluation for this slice, and the one the
    // plan asks to be testable with no server: what the room's clock plays
    // for a captain who is not standing at their seat is a pure engine
    // function taking a state and a record. Every check below drives it
    // through the entry point the clock itself uses, autoCommit, so what is
    // held to is the seat rather than a copy of the seat. Nothing in this
    // section opens a socket.
    //
    // The first checks are about the record itself, because the record is
    // what makes this a change to the engine at all. A set a captain wrote
    // and a set somebody tampered with arrive through the same reader, and
    // the reader's whole job is that the second can only ever do what the
    // first could have done by hand.
    //
    // The boards below are dealt by snapToCheckpoint rather than written out
    // here, for the reason the lap walk reads the lap rather than restating
    // it: a fixture market would pass every check in this section while the
    // real one dealt something else. Where a check needs the board to
    // discriminate, the expectation is computed from the board it was dealt
    // rather than from a number chosen here, so the checks hold on any seed.
    const quiet = defaultStandingOrders();
    const sameOrders = (a: StandingOrders, b: StandingOrders) =>
      a.enabled === b.enabled &&
      a.boon === b.boon &&
      a.fill === b.fill &&
      a.shipyard === b.shipyard &&
      a.buy.length === b.buy.length &&
      a.buy.every(
        (line, i) =>
          line.good === b.buy[i].good && line.maxPrice === b.buy[i].maxPrice,
      );
    const sameIds = (a: readonly number[], b: readonly number[]) =>
      a.length === b.length && a.every((id, i) => id === b[i]);
    const sameTally = (
      a: Record<string, number>,
      b: Record<string, number>,
    ) => {
      const ka = Object.keys(a).sort();
      const kb = Object.keys(b).sort();
      return (
        ka.length === kb.length &&
        ka.every((key, i) => key === kb[i] && a[key] === b[key])
      );
    };
    const sumTally = (a: Record<string, number>, b: Record<string, number>) => {
      const out: Record<string, number> = { ...a };
      for (const [key, value] of Object.entries(b))
        out[key] = (out[key] ?? 0) + value;
      return out;
    };
    const standingCtx = {
      seedBase: "standing-orders:captain-a",
      harborId: "standing-orders",
    };
    // A fresh voyage stopped at one phase of round one, on the widest tier
    // the tree deals so the two boards below are wide enough to say
    // something about the lots and the orders that were left behind.
    const deal = (phase: Phase) => {
      const state = createInitialGameState({
        mode: "ocean_gambit",
        difficulty: "monsoon",
      });
      snapToCheckpoint(state, standingCtx, 1, phase, []);
      return state;
    };
    const deepPurse = (state: GameState) => {
      state.money = 100000;
      return state;
    };
    // The same purse over an empty hold, which is what the three price
    // checks below need: [C4] gave the cargo a size, and a voyage ships
    // the tree's own opening stock, so a board whose lots happen to run
    // large would measure the hold's room as well as the price list. The
    // line those checks hold is that the list reaches every lot, not that
    // the ship could carry every lot, and the seat that meets a hold with
    // no room left is read on its own beside them.
    const roomy = (state: GameState) => {
      deepPurse(state);
      state.inventory = {};
      return state;
    };
    const took = (logs: string[], needle: string) =>
      logs.some((line) => line.includes(needle));

    // The record itself, and what a captain who wrote nothing holds.
    check(
      quiet.enabled &&
        quiet.boon === null &&
        quiet.buy.length === 0 &&
        quiet.fill === "none" &&
        quiet.shipyard === "continue",
      "a captain who wrote nothing holds the switch on and no instruction under it, which is the seat every default already played",
    );
    check(
      !standingOrdersLive(quiet),
      "and a switch that is on over an empty set is a seat nothing is going to play, rather than a lit button promising one",
    );
    const garbage = [
      undefined,
      null,
      42,
      "orders",
      [],
      { enabled: "yes", boon: 7, fill: "some", shipyard: "scrap", buy: "Hemp" },
    ];
    check(
      garbage.every((raw) => sameOrders(normalizeStandingOrders(raw), quiet)),
      "and anything the vocabulary does not name is read back as that same record rather than trusted",
    );
    const goods = MARKET_GOODS;
    const littered = normalizeStandingOrders({
      enabled: true,
      buy: [
        { good: goods[0], maxPrice: 4.7 },
        { good: goods[0], maxPrice: 9 },
        { good: "Unobtainium", maxPrice: 5 },
        { good: goods[1], maxPrice: -3 },
        { good: goods[1], maxPrice: "12" },
        { good: goods[2], maxPrice: Number.NaN },
        { good: goods[3], maxPrice: Number.POSITIVE_INFINITY },
      ],
    });
    check(
      littered.buy.length === 1 &&
        littered.buy[0].good === goods[0] &&
        littered.buy[0].maxPrice === 4,
      "a shopping list keeps the first line for each good the tree can price, floors the price, and drops every line that is not a price",
    );
    const everyGood = normalizeStandingOrders({
      buy: goods.flatMap((good) => [
        { good, maxPrice: 1 },
        { good, maxPrice: 2 },
      ]),
    });
    check(
      MAX_STANDING_BUYS === goods.length &&
        everyGood.buy.length === MAX_STANDING_BUYS &&
        everyGood.buy.every((line) => line.maxPrice === 1),
      `and one line per good is the whole of what a list can say, however long the list it was read from was (${goods.length} goods)`,
    );
    // [D4: Loom: the Refit] The line the board can never answer. Rags is
    // cargo the Loom's bench buys off the quay rather than a good the port
    // merchant trades, so an instruction naming one would be a line the
    // merchant could never fill, and the reader drops it the same way it
    // drops a name no catalogue carries. This is the reason the cap above is
    // the board's list rather than the hold's: the two stopped being the
    // same list the day Rags arrived.
    const ragsLine = normalizeStandingOrders({
      enabled: true,
      buy: [{ good: RAGS, maxPrice: 999 }],
    });
    check(
      !(MARKET_GOODS as readonly string[]).includes(RAGS) &&
        (ITEMS as readonly string[]).includes(RAGS) &&
        ragsLine.buy.length === 0 &&
        MAX_STANDING_BUYS === MARKET_GOODS.length &&
        MAX_STANDING_BUYS < ITEMS.length,
      "a shopping list cannot name a rag, because a standing order buys a card and the merchant's cards are dealt from the goods the merchant trades, so the hold's catalogue and the board's are two lists rather than one",
    );
    // A set the captain wrote and then switched off is the rollback the
    // plan asks for, and it is measured against this one record below.
    const ordersWritten: StandingOrders = {
      ...quiet,
      boon: BOONS[0].id,
      buy: [{ good: goods[0], maxPrice: 9 }],
      fill: "all",
      shipyard: "upgrade",
    };
    const switchedOff = normalizeStandingOrders({
      ...ordersWritten,
      enabled: false,
    });
    check(
      !switchedOff.enabled &&
        switchedOff.boon === BOONS[0].id &&
        switchedOff.buy.length === 1 &&
        switchedOff.fill === "all" &&
        switchedOff.shipyard === "upgrade",
      "while the switch off keeps the set it was written with, because erasing it would punish a captain for a rollback they may take back",
    );
    check(
      standingBoon(ordersWritten)?.id === BOONS[0].id &&
        standingBoon(quiet) === null &&
        standingBoon({ ...quiet, boon: "no_such_boon" }) === null,
      "and a written boon is read as the catalogue entry it names, or as nothing at all when it names nothing the tree still ships",
    );

    // Dawn, the one seat whose work is a choice rather than a press. The
    // draft is the one board in the leg drawn with live randomness rather
    // than from the captain's seed, so every fixture below reads the hand
    // the state under test was actually dealt rather than a hand taken
    // from some other state and hoped for.
    const orderedDawn = deal("dawn");
    const writtenPick = orderedDawn.boonChoices[1];
    const firstOffer = orderedDawn.boonChoices[0];
    if (!writtenPick || !firstOffer)
      throw new Error(
        "The standing order checks need a draft holding more than one boon on it, or the written choice cannot be told apart from the board's own first offer.",
      );
    orderedDawn.standingOrders = { ...quiet, boon: writtenPick.id };
    const orderedDawnLogs: string[] = [];
    autoCommit(orderedDawn, standingCtx, orderedDawnLogs);
    check(
      took(orderedDawnLogs, writtenPick.name) &&
        !took(orderedDawnLogs, firstOffer.name) &&
        orderedDawn.modifierFlags === writtenPick.modifiers &&
        orderedDawn.boonChoices.length === 0 &&
        orderedDawn.phase !== "dawn",
      "an absent captain's Dawn takes the boon they wrote, off the board they were dealt rather than out of the catalogue",
    );
    const missedDawn = deal("dawn");
    const missedFirst = missedDawn.boonChoices[0];
    const offBoard = BOONS.find(
      (b) => !missedDawn.boonChoices.some((o) => o.id === b.id),
    );
    if (!missedFirst || !offBoard)
      throw new Error(
        "The standing order checks need a catalogue boon that is not on the drawn board, or the fallback they measure cannot be told apart from a written choice.",
      );
    missedDawn.standingOrders = { ...quiet, boon: offBoard.id };
    const missedDawnLogs: string[] = [];
    autoCommit(missedDawn, standingCtx, missedDawnLogs);
    check(
      took(missedDawnLogs, missedFirst.name) &&
        !took(missedDawnLogs, offBoard.name) &&
        missedDawn.phase !== "dawn",
      "a name the draft did not deal is passed over for the board's first offer, so a written order can never take a boon its captain was not shown",
    );
    const rollbackDawn = deal("dawn");
    const rollbackPick = rollbackDawn.boonChoices[1];
    const rollbackFirst = rollbackDawn.boonChoices[0];
    if (!rollbackPick || !rollbackFirst)
      throw new Error(
        "The standing order checks need a draft holding more than one boon on it, or the rollback they measure cannot be told apart from the written choice.",
      );
    rollbackDawn.standingOrders = {
      ...quiet,
      boon: rollbackPick.id,
      enabled: false,
    };
    const rollbackDawnLogs: string[] = [];
    autoCommit(rollbackDawn, standingCtx, rollbackDawnLogs);
    check(
      took(rollbackDawnLogs, rollbackFirst.name) &&
        !took(rollbackDawnLogs, rollbackPick.name),
      "and with the switch off the same written boon is passed over too, which is the rollback the plan asks for",
    );

    // Market. The purse is deep enough that affordability is not what is
    // being measured here; the price checks read the board they were dealt,
    // so they hold wherever the lots happen to fall.
    const boardTops = (state: GameState) => {
      const tops = new Map<string, number>();
      const floors = new Map<string, number>();
      for (const card of state.resourceCards)
        for (const r of card.resources) {
          const price = r.price ?? 0;
          tops.set(r.type, Math.max(tops.get(r.type) ?? price, price));
          floors.set(r.type, Math.min(floors.get(r.type) ?? price, price));
        }
      return { tops, floors };
    };
    const listFrom = (
      prices: Map<string, number>,
      spare: number,
    ): StandingOrders => ({
      ...quiet,
      buy: [...prices].map(([good, price]) => ({
        good,
        maxPrice: Math.max(0, price - spare),
      })),
    });

    const whole = roomy(deal("market"));
    const wholeLogs: string[] = [];
    const wholeBoard = whole.resourceCards.map((card) => card.id);
    whole.standingOrders = listFrom(boardTops(whole).tops, 0);
    autoCommit(whole, standingCtx, wholeLogs);
    check(
      wholeBoard.length > 1 &&
        sameIds(whole.purchasedCards, wholeBoard) &&
        whole.money === 100000 - whole.totalCosts &&
        took(wholeLogs, "Standing orders at the port board"),
      `orders pricing every good at the top the board itself asks buy the whole board and pay for it out of the captain's purse (${wholeBoard.length} lots)`,
    );
    // [C4: three foods, spoilage and the split hold] The same order on the
    // ship every captain actually starts in, with the tree's own opening
    // stock in the hold: the list still buys what the hold has room for,
    // and every lot it could not take is refused for room rather than for
    // price, which is the split hold's own rule arriving through the seat
    // that shops with nobody sitting at it. The board weighs twenty slots
    // against fourteen free, so this is not a corner of the draw.
    const crowded = deepPurse(deal("market"));
    const crowdedLogs: string[] = [];
    const crowdedBoard = crowded.resourceCards.map((card) => card.id);
    const largestLot = Math.max(
      ...crowded.resourceCards.map((card) =>
        card.resources.reduce((n, r) => n + (r.quantity ?? 0), 0),
      ),
    );
    crowded.standingOrders = listFrom(boardTops(crowded).tops, 0);
    autoCommit(crowded, standingCtx, crowdedLogs);
    const crowdedRefusals = crowdedLogs.filter((line) =>
      line.includes("No room in the hold"),
    ).length;
    check(
      crowded.purchasedCards.length > 0 &&
        crowded.purchasedCards.length < crowdedBoard.length &&
        crowdedRefusals ===
          crowdedBoard.length - crowded.purchasedCards.length &&
        crowded.money === 100000 - crowded.totalCosts &&
        usedCargoSlots(crowded) <= cargoCapacity(crowded) &&
        cargoRoom(crowded) < largestLot,
      `orders meeting a hold that is already carrying the opening stock buy what fits and are told why for each lot that does not (${crowded.purchasedCards.length} of ${crowdedBoard.length} lots)`,
    );
    const choosy = roomy(deal("market"));
    const choosyTops = boardTops(choosy).tops;
    const underTops = choosy.resourceCards.filter((card) =>
      card.resources.every(
        (r) => (r.price ?? 0) < (choosyTops.get(r.type) ?? 0),
      ),
    );
    choosy.standingOrders = listFrom(choosyTops, 1);
    autoCommit(choosy, standingCtx, []);
    check(
      sameIds(
        choosy.purchasedCards,
        underTops.map((card) => card.id),
      ),
      `and a list priced a gold under those tops buys exactly the lots whose every unit is under them, leaving the rest of the board alone (${underTops.length} of ${choosy.resourceCards.length})`,
    );
    const nothingPriced = roomy(deal("market"));
    const nothingPricedLogs: string[] = [];
    nothingPriced.standingOrders = listFrom(boardTops(nothingPriced).floors, 1);
    autoCommit(nothingPriced, standingCtx, nothingPricedLogs);
    check(
      nothingPriced.purchasedCards.length === 0 &&
        nothingPriced.money === 100000 &&
        !took(nothingPricedLogs, "Standing orders at the port board"),
      "a list priced a gold under the cheapest lot the board offers buys nothing and says nothing, rather than reporting work it did not do",
    );
    const broke = deal("market");
    broke.money = 0;
    const brokeLogs: string[] = [];
    broke.standingOrders = listFrom(boardTops(broke).tops, 0);
    autoCommit(broke, standingCtx, brokeLogs);
    check(
      broke.purchasedCards.length === 0 &&
        broke.money === 0 &&
        !took(brokeLogs, "Standing orders at the port board"),
      "and a purse that is empty buys nothing at all, because an order spends the same guard a hand does",
    );
    const reportedByHand = deepPurse(deal("market"));
    const handCard = reportedByHand.resourceCards[0];
    if (!handCard || reportedByHand.resourceCards.length < 2)
      throw new Error(
        "The standing order checks need a port board holding at least two lots, or the delta they measure cannot be told apart from the whole report.",
      );
    purchaseCard(reportedByHand, handCard.id, []);
    const beforeOrders = tallyPurchasesByResource(reportedByHand);
    reportedByHand.standingOrders = listFrom(boardTops(reportedByHand).tops, 0);
    autoCommit(reportedByHand, standingCtx, []);
    const orderDelta = reportedByHand._pendingPulseTally ?? {};
    check(
      Object.keys(orderDelta).length > 0 &&
        sameTally(
          sumTally(beforeOrders, orderDelta),
          tallyPurchasesByResource(reportedByHand),
        ),
      "and the lots the orders bought after a captain's own round ride the pulse as a delta on that report, which together are the lots the harbor counts",
    );

    // Orders. The hold is what decides this seat. Two fixtures decide it
    // without depending on how the board happened to fall: an empty hold
    // covers no order at all, because every order on the board asks for at
    // least one unit of something, and a hold loaded for the board's own
    // first order covers that one by construction, since nothing precedes
    // it on the board to spend the goods first.
    const loadFor = (state: GameState) => {
      const order = state.customerCards[0];
      for (const good of goods) state.inventory[good] = 0;
      if (!order)
        throw new Error(
          "The standing order checks need a trade board with at least one order on it.",
        );
      const hold: Record<string, number> = {};
      for (const r of order.resources) {
        const required = r.required ?? 0;
        state.inventory[r.type] = (state.inventory[r.type] ?? 0) + required;
        hold[r.type] = (hold[r.type] ?? 0) + required;
      }
      return { order, hold };
    };
    // The rule the panel promises a captain, written out here rather than
    // read off the engine: walk the board in order, fill what the hold
    // covers at that moment, and let every fill spend the goods it took.
    // Holding the engine to this is what makes the check about the rule
    // rather than about the engine agreeing with itself.
    //
    // [D2] The one thing the model does not restate is the pathbound lock,
    // because the lock is not a rule about the hold: it is asked through
    // lockedBehind, the same reader the trade board greys a card with and
    // the same one the engine's own guard asks, so a card this model would
    // cover and the engine would refuse cannot slip past here having been
    // checked nowhere.
    const greedyFills = (state: GameState, hold: Record<string, number>) => {
      const filled: number[] = [];
      for (const order of state.customerCards) {
        if (lockedBehind(state, order)) continue;
        const covered = order.resources.every(
          (r) => (hold[r.type] ?? 0) >= (r.required ?? 0),
        );
        if (!covered) continue;
        for (const r of order.resources) hold[r.type] -= r.required ?? 0;
        filled.push(order.id);
      }
      return filled;
    };
    const bare = deal("orders");
    for (const good of goods) bare.inventory[good] = 0;
    const bareLogs: string[] = [];
    bare.standingOrders = { ...quiet, fill: "all" };
    autoCommit(bare, standingCtx, bareLogs);
    check(
      bare.customerCards.length > 0 &&
        bare.completedOrders.length === 0 &&
        bare.totalOrdersCompleted === 0 &&
        !took(bareLogs, "Standing orders at the trade board"),
      `an order to fill every order the hold can cover fills none of them from an empty hold, rather than buying goods to chase one (${bare.customerCards.length} on the board)`,
    );
    const filledHold = deal("orders");
    const { order: firstOrder, hold: loadedHold } = loadFor(filledHold);
    const filledHoldLogs: string[] = [];
    filledHold.standingOrders = { ...quiet, fill: "all" };
    autoCommit(filledHold, standingCtx, filledHoldLogs);
    check(
      sameIds(
        filledHold.completedOrders,
        greedyFills(filledHold, loadedHold),
      ) &&
        filledHold.completedOrders[0] === firstOrder.id &&
        took(filledHoldLogs, "Standing orders at the trade board") &&
        goods.every((good) => (filledHold.inventory[good] ?? 0) >= 0),
      `a hold loaded for the first order on the board fills it, and then every later order it still covers, in board order and without overdrawing (${filledHold.completedOrders.length} of ${filledHold.customerCards.length} filled)`,
    );
    const skipping = deal("orders");
    // The same loaded hold as the fixture above, so the order left
    // standing below is the switch's doing and not an empty hold's.
    loadFor(skipping);
    const skippingLogs: string[] = [];
    skipping.standingOrders = { ...quiet, fill: "none" };
    autoCommit(skipping, standingCtx, skippingLogs);
    check(
      skipping.completedOrders.length === 0 &&
        skipping.totalOrdersCompleted === 0 &&
        !took(skippingLogs, "Standing orders at the trade board"),
      `and the trade board's default is still to fill nothing, which is the seat [B2] shipped (the hold was loaded for it, and it is left standing)`,
    );
    // [D2] The two seats below are the same board and the same hold, one
    // environment value apart in nothing at all: the only difference is the
    // path the captain sails. It is the check the lock was put inside
    // canFillOrder for, since that function is the one judgement the hand
    // and the seat both go through (see workStandingOrders), and the one
    // the board greys its cards with.
    const pathboundSeat = (withPath: boolean) => {
      const state = deal("orders");
      const card = state.customerCards.find((o) => o.isPathOrder);
      const owner = card ? pathOrderOf(card, GAMBIT) : null;
      if (!card || !owner)
        throw new Error(
          "The pathbound order checks need a marked card on the trade board.",
        );
      if (withPath) state.path = owner;
      for (const good of goods) state.inventory[good] = 0;
      for (const r of card.resources) {
        state.inventory[r.type] = r.required ?? 0;
      }
      state.standingOrders = { ...quiet, fill: "all" };
      autoCommit(state, standingCtx, []);
      return { state, card };
    };
    const pathless = pathboundSeat(false);
    const holding = pathboundSeat(true);
    check(
      !pathless.state.completedOrders.includes(pathless.card.id) &&
        holding.state.completedOrders.includes(holding.card.id),
      "a standing order leaves a pathbound card standing for a captain who holds no path and fills it for the captain it belongs to, from one board and one hold: the seat asks the same guard a hand does",
    );

    // Dusk, the shipyard's one standing choice, and the seat whose guard is
    // the engine's own: an order to upgrade that cannot be paid for does
    // nothing and costs nothing.
    const yard = deepPurse(deal("dusk"));
    const yardLogs: string[] = [];
    yard.standingOrders = { ...quiet, shipyard: "upgrade" };
    autoCommit(yard, standingCtx, yardLogs);
    check(
      yard.shipLevel === 1 && took(yardLogs, "Standing orders at the shipyard"),
      "an absent captain's Dusk buys the next hull the moment the yard opens, which is the one seat whose work is a purchase rather than a press",
    );
    const poor = deal("dusk");
    poor.money = 0;
    const poorLogs: string[] = [];
    poor.standingOrders = { ...quiet, shipyard: "upgrade" };
    autoCommit(poor, standingCtx, poorLogs);
    check(
      poor.shipLevel === 0 &&
        took(poorLogs, "Gold to upgrade the ship") &&
        !took(poorLogs, "Standing orders at the shipyard"),
      "and a yard the purse cannot pay for is refused by the engine rather than by the order, so a written upgrade costs a captain nothing",
    );
    const topped = deepPurse(deal("dusk"));
    topped.shipLevel = MAX_SHIP_LEVEL;
    const toppedLogs: string[] = [];
    topped.standingOrders = { ...quiet, shipyard: "upgrade" };
    autoCommit(topped, standingCtx, toppedLogs);
    check(
      topped.shipLevel === MAX_SHIP_LEVEL &&
        !took(toppedLogs, "Standing orders at the shipyard"),
      `and a hull already at its own ceiling (level ${MAX_SHIP_LEVEL}) is left where it is, because that guard is the yard's and not the order's`,
    );

    // The seat itself, through the clock's own entry point, which is where
    // the switch has to be read: with it off the whole seat is the seat
    // [B2] shipped, and with it on the written work happens before the
    // departure that would have happened anyway.
    const absent = deepPurse(deal("market"));
    autoCommit(absent, standingCtx, []);
    check(
      absent.purchasedCards.length === 0 &&
        absent._pendingPulseTally === undefined &&
        absent.phase !== "market",
      "a captain who wrote nothing is played exactly as [B2] played them: no lot bought, no report added, and the seat left on the lap's own terms",
    );
    const played = deepPurse(deal("market"));
    played.standingOrders = listFrom(boardTops(played).tops, 0);
    autoCommit(played, standingCtx, []);
    check(
      played.purchasedCards.length > 0 &&
        played._pendingPulseTally !== undefined &&
        played.phase !== "market",
      "and a captain who did write an order is played by it before the seat is left, which is the whole of what the clock does differently now",
    );
    const shutOff = deepPurse(deal("market"));
    shutOff.standingOrders = {
      ...listFrom(boardTops(shutOff).tops, 0),
      enabled: false,
    };
    autoCommit(shutOff, standingCtx, []);
    check(
      shutOff.purchasedCards.length === 0 &&
        shutOff._pendingPulseTally === undefined &&
        shutOff.phase !== "market",
      "while the same written set with the switch off buys nothing and reports nothing, and leaves the seat the way the seat is left anyway",
    );

    // Restart and the load heal, the two ways a record arrives at a voyage
    // it was not written during.
    const carried = createInitialGameState();
    carried.standingOrders = { ...ordersWritten };
    restartGame(carried, [], {});
    check(
      sameOrders(carried.standingOrders, ordersWritten),
      "restarting the voyage keeps the set a captain wrote, because a host setting sail again is not the captain changing their mind",
    );
    const damaged = createInitialGameState();
    damaged.standingOrders = "not a record" as unknown as StandingOrders;
    restartGame(damaged, [], {});
    check(
      sameOrders(damaged.standingOrders, quiet),
      "and a record the tree cannot read heals to the default rather than costing a captain their voyage",
    );
    const madeNow = createInitialGameState({ mode: "ocean_gambit" });
    check(
      sameOrders(
        normalizeStandingOrders(madeNow.standingOrders),
        madeNow.standingOrders,
      ),
      "which is what makes the heal a no op for a current save: a voyage this build creates holds a record the normalizer reads back unchanged",
    );

    // The copy rule, read off the files rather than off a claim about them.
    check(
      !carriesADash("src/lib/game/standing.ts") &&
        !carriesADash("src/lib/game/engine/standing.ts") &&
        !carriesADash(
          "src/components/portmasters/game/StandingOrdersModal.tsx",
        ) &&
        !carriesADash("src/components/portmasters/game/GameControlPanel.tsx"),
      "and none of the words a captain reads about standing orders, nor the comments that explain them, carries an en dash, an em dash or a doubled hyphen",
    );

    // =====================================================================
    // [B4: the log surfaces]
    //
    // The plan asks for two logs at Dusk, one the whole room reads and one
    // each captain holds, and what is held below is the contract between
    // them rather than the screen they are drawn on: the room's log carries
    // what the table already saw and never a hidden thing, and the private
    // channel carries what one captain was told and reaches no other
    // socket. That is the plan's own evaluation, a two client assertion
    // that no private entry appears in the other captain's transcript, read
    // here against the surface this slice adds.
    //
    // The vocabulary is checked first and without a server, so a failure
    // further down is never read as a server that declined to write a line.
    // =====================================================================
    console.log("\nThe voyage log");

    // Every kind, and the sentence a captain reads for it. The table is
    // typed by the union, so a tenth kind is a compile error here as well
    // as in the line writer, and the checks below walk the vocabulary
    // rather than a list written out a second time.
    const logFacts: Record<VoyageLogKind, VoyageLogFacts> = {
      voyage_started: { kind: "voyage_started" },
      leg_advanced: { kind: "leg_advanced", phase: "parley" },
      offer_posted: {
        kind: "offer_posted",
        captain: "Smoke logger1",
        offerItem: "Hemp",
        offerAmount: 3,
        requestItem: "Silk",
        requestAmount: 2,
      },
      offer_filled: {
        kind: "offer_filled",
        captain: "Smoke logger1",
        taker: "Smoke logger2",
        offerItem: "Hemp",
        offerAmount: 3,
        requestItem: "Silk",
        requestAmount: 2,
      },
      offer_expired: {
        kind: "offer_expired",
        captain: "Smoke logger1",
        offerItem: "Hemp",
        offerAmount: 3,
      },
      leg_timed_out: { kind: "leg_timed_out", phase: "market" },
      audit_carried: { kind: "audit_carried", target: "Smoke logger2" },
      maroon_carried: { kind: "maroon_carried", target: "Smoke logger2" },
      captain_left: { kind: "captain_left", captain: "Smoke logger1" },
      contract_posted: {
        kind: "contract_posted",
        captain: "Smoke logger1",
        fee: 12,
      },
      contract_agreed: {
        kind: "contract_agreed",
        captain: "Smoke logger1",
        taker: "Smoke logger2",
        fee: 12,
      },
      contract_claimed: {
        kind: "contract_claimed",
        captain: "Smoke logger1",
        taker: "Smoke logger2",
      },
      refit_posted: {
        kind: "refit_posted",
        captain: "Smoke logger1",
        good: "Linen Clothes",
        fee: 12,
      },
      refit_agreed: {
        kind: "refit_agreed",
        captain: "Smoke logger1",
        taker: "Smoke logger2",
        good: "Linen Clothes",
        fee: 12,
      },
      // [D5: Aroma: the Bazaar Rumor] The one fact this table carries that
      // is deliberately incomplete, and the line below says the same: the
      // captain and the good, with no direction, because the log is public
      // the moment it is written and the direction is not public yet.
      rumor_published: {
        kind: "rumor_published",
        captain: "Smoke logger1",
        good: "Silk",
      },
      // [D7: the draft, and switching] The identity pair, and the switch is
      // the line the plan asks for by name: "the switch is published to the
      // fleet log where everyone sees it." Both carry the path taken up and
      // never the path left, for the reason the writer's own note gives.
      path_taken: {
        kind: "path_taken",
        captain: "Smoke logger1",
        path: "loom",
      },
      path_switched: {
        kind: "path_switched",
        captain: "Smoke logger1",
        path: "quartermaster",
      },
    };
    const logLines: Record<VoyageLogKind, string> = {
      voyage_started: "The voyage leaves the dock.",
      leg_advanced: "The harbor weighs anchor for the Parley.",
      offer_posted: "Smoke logger1 posts 3 Hemp for 2 Silk.",
      offer_filled:
        "Smoke logger2 fills Smoke logger1's offer of 3 Hemp for 2 Silk.",
      offer_expired: "Smoke logger1's offer of 3 Hemp lapses with the leg.",
      leg_timed_out: "The tide runs out on the Market.",
      audit_carried: "The harbor audits Smoke logger2.",
      maroon_carried: "The harbor maroons Smoke logger2.",
      captain_left: "Smoke logger1 leaves the harbor.",
      contract_posted:
        "Smoke logger1 offers one leg of protection for 12 Gold.",
      contract_agreed:
        "Smoke logger2 buys a leg of protection from Smoke logger1 for 12 Gold.",
      contract_claimed:
        "Raiders bound for Smoke logger2 met Smoke logger1's guns.",
      refit_posted:
        "Smoke logger1 offers to put a Linen Clothes right for 12 Gold.",
      refit_agreed:
        "Smoke logger2 pays Smoke logger1 12 Gold to put the Linen Clothes right.",
      rumor_published:
        "Smoke logger1 publishes a rumor about Silk at the bazaar.",
      path_taken: "Smoke logger1 takes up the Loom path.",
      path_switched:
        "Smoke logger1 sets aside their old papers and takes up the Quartermaster path.",
    };
    for (const kind of VOYAGE_LOG_KINDS) {
      check(
        voyageLogLine(logFacts[kind]) === logLines[kind],
        `the ${kind} line reads the way a captain reads it, and reads it the same way wherever the log is drawn`,
      );
    }
    check(
      new Set(VOYAGE_LOG_KINDS.map((kind) => logLines[kind])).size ===
        VOYAGE_LOG_KINDS.length,
      "and no two kinds share a sentence, so a line a captain reads names the thing that happened",
    );
    check(
      LEG_PHASE_ORDER.every((phase) =>
        voyageLogLine({ kind: "leg_advanced", phase }).includes(
          phaseFace(phase).label,
        ),
      ),
      "the anchor line names each phase off the phase's own face rather than off a second list of names kept in the log",
    );

    // The round belongs to the log's own stamp rather than to the caller,
    // which is what lets a screen group a voyage by leg without working
    // out which leg a line fell in.
    const stamped = voyageLogEntry(3, logFacts.captain_left);
    check(
      stamped.round === 3 &&
        stamped.kind === "captain_left" &&
        stamped.text === logLines.captain_left,
      "a line carries the leg it happened on, the kind of thing it was and the sentence, and nothing else",
    );

    // The cap, which both sides of the wire share. The oldest line is the
    // one that goes: a bound on a live surface keeps the end a captain
    // reads.
    const logFlooded = Array.from({ length: VOYAGE_LOG_CAP + 10 }, (_, index) =>
      voyageLogEntry(index, logFacts.voyage_started),
    ).reduce<VoyageLogEntry[]>(
      (kept, entry) => appendVoyageLog(kept, entry),
      [],
    );
    check(
      logFlooded.length === VOYAGE_LOG_CAP &&
        logFlooded[0].round === 10 &&
        logFlooded[logFlooded.length - 1].round === VOYAGE_LOG_CAP + 9,
      `a voyage keeps the last ${VOYAGE_LOG_CAP} lines and drops the oldest, so a long voyage costs a surface a bounded amount`,
    );

    // The door every line off the wire comes through.
    check(
      normalizeVoyageLogEntry(stamped)?.kind === "captain_left" &&
        normalizeVoyageLogEntry(stamped)?.round === 3,
      "a line that is a line is read back as it was written, leg and all",
    );
    const notLines: unknown[] = [
      null,
      "The voyage leaves the dock.",
      {},
      { round: 1, kind: "captain_left" },
      { round: 1, kind: "captain_left", text: "" },
      { round: -1, kind: "captain_left", text: "Ari leaves the harbor." },
      { round: 1, kind: "mutiny", text: "Ari leaves the harbor." },
      { round: 1, kind: "captain_left", text: 7 },
    ];
    check(
      notLines.every((value) => normalizeVoyageLogEntry(value) === null),
      "and anything that is not a line is dropped rather than drawn, so a malformed frame cannot put a blank row in the middle of a voyage",
    );
    check(
      normalizeVoyageLog([stamped, null, { round: 1 }, stamped]).length === 2 &&
        normalizeVoyageLog("not a log").length === 0 &&
        normalizeVoyageLog(
          Array.from({ length: VOYAGE_LOG_CAP + 5 }, () => stamped),
        ).length === VOYAGE_LOG_CAP,
      "a whole log heals the same way and is capped the same way, and a log that is not a list is an empty log rather than a crash",
    );

    // Every kind has a writer. A vocabulary entry nothing produces is a
    // line the suite would hold to its sentence while no captain could ever
    // read it, and the scan is what makes adding a kind a two part change
    // rather than a one part one.
    //
    // Walked rather than listed, and by the same walker every other scan of
    // this tree uses: the layer keeps its frames in the modules under
    // ./wiring now, and a flat listing here would read the composition root
    // alone and report a vocabulary entry as unwritten that three leaves
    // write between them.
    const realtimeDir = join(
      import.meta.dirname,
      "..",
      "src",
      "server",
      "realtime",
    );
    const realtimeSource = walkSrc(realtimeDir)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    check(
      VOYAGE_LOG_KINDS.every((kind) =>
        realtimeSource.includes(`kind: "${kind}"`),
      ),
      "every kind the log can hold has a writer in the realtime layer, so no line of its vocabulary is one no captain can read",
    );

    // The copy rule, read off the files rather than off a claim about them.
    check(
      !carriesADash("src/lib/game/voyage-log.ts") &&
        !carriesADash("src/lib/use-voyage-log.ts") &&
        !carriesADash("src/server/realtime/voyage-log.ts") &&
        !carriesADash("src/components/portmasters/game/VoyageLogPanel.tsx"),
      "and none of the words a captain reads in either log, nor the comments that explain them, carries an en dash, an em dash or a doubled hyphen",
    );

    // ---- The two logs, in a real harbor ----
    // One Ocean Gambit harbor with two captains in it, because the pair
    // under test needs the private channel to carry something: a card is
    // dealt in this mode and nowhere else, and both captains hold one.
    const logHost = await signUp("logger1");
    const logMate = await signUp("logger2");
    run.extraAccounts.push(logHost, logMate);
    const logRoom = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: logHost.cookie,
        body: JSON.stringify({
          name: `Smoke voyage log ${suffix}`,
          isPublic: false,
          mode: "ocean_gambit",
          unlock: LEDGER_PHRASE,
        }),
      },
    );
    if (logRoom.status !== 200) {
      throw new Error("No harbor to keep a voyage log in, stopping here.");
    }
    const logRoomId = logRoom.body.room.id;
    const logMateJoined = await call<{ room: { id: string } }>(
      "/api/rooms/join",
      {
        method: "POST",
        cookie: logMate.cookie,
        body: JSON.stringify({ code: logRoom.body.room.code }),
      },
    );
    check(
      logMateJoined.status === 200,
      "two captains take a seat in a harbor that keeps a log",
    );

    type LogFrame = { event: string; text: string };
    const logSeats: Array<{
      captain: Captain;
      socket: Socket;
      frames: LogFrame[];
    }> = [];
    for (const captain of [logHost, logMate]) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      const frames: LogFrame[] = [];
      socket.onAny((event: string, ...args: unknown[]) => {
        frames.push({ event, text: JSON.stringify(args) });
      });
      const takenASeat = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === logRoomId,
      );
      socket.emit("room:join", { roomId: logRoomId });
      const seat = await takenASeat;
      check(seat !== null, `${captain.username} takes their seat`);
      logSeats.push({ captain, socket, frames });
    }
    const logHostSeat = logSeats[0];
    const logMateSeat = logSeats[1];

    // The lines a socket was sent, read off the frames it kept. Only the
    // room's log, since the private channel's frames are the other half of
    // this pair and the point of the checks below is to keep the two apart.
    const logEntriesOn = (frames: readonly LogFrame[]) =>
      frames
        .filter((frame) => frame.event === "voyage:log")
        .map(
          (frame) =>
            (
              JSON.parse(frame.text) as [
                { roomId: string; entry: VoyageLogEntry },
              ]
            )[0]?.entry,
        )
        .filter((entry): entry is VoyageLogEntry => Boolean(entry));
    const logTextOn = (frames: readonly LogFrame[]) =>
      logEntriesOn(frames).map((entry) => entry.text);

    const logCardFrames = logSeats.map((seat) =>
      waitForEvent<WireDelivery>(
        seat.socket,
        "private:entry",
        (payload) => payload?.roomId === logRoomId,
      ),
    );
    logHostSeat.socket.emit("room:start", { roomId: logRoomId });
    const logCards = await Promise.all(logCardFrames);
    check(
      logCards.every((card) => card?.entry?.kind === "card"),
      "and the voyage sets sail, dealing each of them a card the other captain cannot read",
    );
    await new Promise((resolve) => setTimeout(resolve, 300));

    check(
      logTextOn(logHostSeat.frames).includes(logLines.voyage_started) &&
        logTextOn(logMateSeat.frames).includes(logLines.voyage_started),
      "the room's log opens with the voyage and reaches every socket in the harbor, not only the host's",
    );
    // The seat a voyage opens in is entered by the host's start rather than
    // by a ready vote, and it is anchored all the same. A log whose first
    // anchor line belonged to the second seat would read as a leg nobody
    // played, and the opening seat of a Gambit voyage is not the pier: the
    // phase the mode opens at is where the crew actually stands.
    const logOpened = logEntriesOn(logHostSeat.frames);
    const openingSeat = openingPhase("ocean_gambit");
    check(
      logOpened[0]?.kind === "voyage_started" &&
        logOpened[0]?.round === 1 &&
        logOpened[1]?.kind === "leg_advanced" &&
        logOpened[1]?.round === 1 &&
        logOpened[1]?.text ===
          voyageLogLine({ kind: "leg_advanced", phase: openingSeat }),
      "and the seat the voyage opens in is anchored like every other, so the log's spine has no gap where its first leg should be",
    );

    // A leg moves, and the log's own stamp moves with it. The status
    // report is the real one a client sends, and it is what moves a room's
    // checkpoint; the two reports below take the room from the leg it
    // opened on to the Parley of the next one.
    // The two anchor lines the reports below write. Named once each, and
    // read again at the end of the section where the voyage is checked for
    // order, so the section holds one copy of each sentence it expects.
    const dawnAnchorLine = "The harbor weighs anchor for the Dawn.";
    const parleyAnchorLine = "The harbor weighs anchor for the Parley.";
    const anchored = waitForEvent<{ entry: VoyageLogEntry }>(
      logMateSeat.socket,
      "voyage:log",
      (payload) => payload?.entry?.text.includes("Dawn"),
    );
    logHostSeat.socket.emit("game:status", {
      roomId: logRoomId,
      round: 2,
      phase: "dawn",
    });
    const anchorFrame = await anchored;
    check(
      anchorFrame?.entry?.round === 2 &&
        anchorFrame.entry.text === dawnAnchorLine,
      "a leg that moves writes the anchor line for the seat being entered, stamped with the leg it is entering rather than the one it left",
    );

    const atParley = waitForEvent<{ entry: VoyageLogEntry }>(
      logMateSeat.socket,
      "voyage:log",
      (payload) => payload?.entry?.text.includes("Parley"),
    );
    logHostSeat.socket.emit("game:status", {
      roomId: logRoomId,
      round: 2,
      phase: "parley",
    });
    const parleyFrame = await atParley;
    check(
      parleyFrame?.entry?.round === 2 &&
        parleyFrame.entry.text === parleyAnchorLine,
      "and a phase that moves inside one leg keeps that leg's number, so a captain reading back sees the leg as one stretch rather than six",
    );

    // The offer board, which is the one surface whose whole life is worth
    // a line: posted, filled, and lapsed.
    const postedLine = waitForEvent<{ entry: VoyageLogEntry }>(
      logMateSeat.socket,
      "voyage:log",
      (payload) => payload?.entry?.kind === "offer_posted",
    );
    logHostSeat.socket.emit("barter:post", {
      roomId: logRoomId,
      offerItem: "Hemp",
      offerAmount: 3,
      requestItem: "Silk",
      requestAmount: 2,
    });
    const postedLog = await postedLine;
    check(
      postedLog?.entry?.text === "Smoke logger1 posts 3 Hemp for 2 Silk." &&
        postedLog.entry.round === 2,
      "an offer on the board writes the whole trade into the room's log, naming the captain who posted it",
    );

    // The settlement, taken by the second captain through the accept the
    // client's own board sends. The board is live server state rather than
    // a row, so the offer's id is read off the board itself: the host asks
    // for its own state and reads the answer, which is the same copy the
    // accepting client reads its id off. Asking rather than reading the
    // frames the room was already sent, because the line above and the
    // board update that follows it are two frames and the log's own is the
    // first of them, so the board is not on the socket yet when the line
    // arrives.
    const logBoardAfterPost = waitForEvent<{
      roomId: string;
      offers?: WireOffer[];
    }>(
      logHostSeat.socket,
      "barter:update",
      (payload) => payload?.roomId === logRoomId,
    );
    logHostSeat.socket.emit("barter:state:request", { roomId: logRoomId });
    const postedOffer = (await logBoardAfterPost)?.offers?.find(
      (offer) => offer.fromUserId === logHost.id,
    );
    check(
      postedOffer !== undefined,
      "the offer is standing on the room's board, so the settlement below has something to settle",
    );
    const filledLine = waitForEvent<{ entry: VoyageLogEntry }>(
      logHostSeat.socket,
      "voyage:log",
      (payload) => payload?.entry?.kind === "offer_filled",
    );
    logMateSeat.socket.emit("barter:accept", {
      roomId: logRoomId,
      offerId: postedOffer?.id,
    });
    const logFilled = await filledLine;
    check(
      logFilled?.entry?.text ===
        "Smoke logger2 fills Smoke logger1's offer of 3 Hemp for 2 Silk.",
      "and the captain who takes it writes the settlement into the log, naming both ends of the trade",
    );

    // The lapsed line, which is the board's other ending: an offer still
    // standing when the room leaves the Parley goes back to its poster.
    // The two lines this offer produces are named once each and read in
    // both places they are needed: here, and in the readback at the end of
    // the section, where the same voyage is checked for order.
    const secondPostLine = "Smoke logger1 posts 1 Silk for 4 Hemp.";
    const secondLapseLine =
      "Smoke logger1's offer of 1 Silk lapses with the leg.";
    const secondPosted = waitForEvent<{ entry: VoyageLogEntry }>(
      logHostSeat.socket,
      "voyage:log",
      (payload) => payload?.entry?.kind === "offer_posted",
    );
    logHostSeat.socket.emit("barter:post", {
      roomId: logRoomId,
      offerItem: "Silk",
      offerAmount: 1,
      requestItem: "Hemp",
      requestAmount: 4,
    });
    check(
      (await secondPosted)?.entry?.text === secondPostLine,
      "a second offer goes up while the room is still at the exchange",
    );
    const lapsedLine = waitForEvent<{ entry: VoyageLogEntry }>(
      logHostSeat.socket,
      "voyage:log",
      (payload) => payload?.entry?.kind === "offer_expired",
    );
    logHostSeat.socket.emit("game:status", {
      roomId: logRoomId,
      round: 2,
      phase: "resolve",
    });
    const lapsed = await lapsedLine;
    check(
      lapsed?.entry?.text === secondLapseLine,
      "and leaving the phase an offer stands in writes the line that says it lapsed, one entry per offer rather than one for the sweep",
    );

    // The departure, through the pair of calls the Leave button makes: the
    // seat is given up over REST and the socket follows it out.
    const leftLine = waitForEvent<{ entry: VoyageLogEntry }>(
      logHostSeat.socket,
      "voyage:log",
      (payload) => payload?.entry?.kind === "captain_left",
    );
    const gaveUpSeat = await call<{ ok: boolean }>(
      `/api/rooms/${logRoomId}/leave`,
      { method: "POST", cookie: logMate.cookie },
    );
    check(gaveUpSeat.status === 200, "a captain can give up their seat");
    logMateSeat.socket.emit("room:leave", { roomId: logRoomId });
    const left = await leftLine;
    const leavesTheHarbor = "Smoke logger2 leaves the harbor.";
    check(
      left?.entry?.text === leavesTheHarbor,
      "a seat that leaves the voyage writes one line into the room's log, and the log's own guard is what keeps the reap from writing a second",
    );
    check(
      logTextOn(logHostSeat.frames).filter((text) =>
        text.includes("leaves the harbor"),
      ).length === 1,
      "and that line stands alone rather than beside a copy of itself",
    );

    // The history the Dusk screen asks for, answered to the socket that
    // asked rather than to the room.
    const history = waitForEvent<{
      roomId: string;
      round: number;
      entries: VoyageLogEntry[];
    }>(
      logHostSeat.socket,
      "voyage:log:history",
      (payload) => payload?.roomId === logRoomId,
    );
    logHostSeat.socket.emit("voyage:log:request", { roomId: logRoomId });
    const historyFrame = await history;
    const readBack = historyFrame?.entries ?? [];
    const textBack = readBack.map((entry) => entry.text);
    // The voyage this section sailed, in the order it happened. Read as a
    // run of positions rather than as a membership list, so the check says
    // what its name says: a captain who asks for the log is handed the
    // voyage, not a bag of lines. A line the clock added on its own (a
    // phase that ran out while the room stood in it) is allowed to sit
    // between two of these without failing the run, which is why the
    // comparison is strictly increasing positions rather than equality
    // with the whole list.
    const orderedLines = [
      logLines.voyage_started,
      dawnAnchorLine,
      parleyAnchorLine,
      logLines.offer_posted,
      logLines.offer_filled,
      secondPostLine,
      secondLapseLine,
      leavesTheHarbor,
    ];
    const logOrder = orderedLines.map((line) => textBack.indexOf(line));
    check(
      historyFrame?.round === 2 &&
        logOrder.every(
          (at, index) => at >= 0 && (index === 0 || at > logOrder[index - 1]),
        ),
      "the log is handed back whole to the captain who asks for it, holding the voyage's own lines in the order they were written",
    );
    check(
      readBack.length === logEntriesOn(logHostSeat.frames).length &&
        readBack.every(
          (entry, index) =>
            entry.kind === logEntriesOn(logHostSeat.frames)[index]?.kind,
        ),
      "and it is the same log the room was reading as it happened, line for line, rather than a second copy assembled when it was asked for",
    );
    check(
      readBack.every(
        (entry) =>
          typeof entry.round === "number" &&
          typeof entry.kind === "string" &&
          typeof entry.text === "string" &&
          Object.keys(entry).length === 3,
      ) && readBack.length > 0,
      "and every line in it is a leg, a kind and a sentence, with no fourth field for anything hidden to travel in",
    );

    // The plan's own evaluation, read against this surface: the private
    // channel's material reaches the captain it was dealt to and appears
    // in no line the room can read.
    const cardTexts = logSeats
      .map((seat) => {
        const cardFrame = seat.frames.find(
          (frame) => frame.event === "private:entry",
        );
        if (!cardFrame) return null;
        return (
          JSON.parse(cardFrame.text) as [
            { entry?: { role?: string; text?: string } },
          ]
        )[0]?.entry;
      })
      .filter((entry): entry is { role?: string; text?: string } =>
        Boolean(entry?.text),
      );
    check(
      cardTexts.length === 2,
      "each captain holds a card of their own on the private channel, so the sweep below has something it could find",
    );
    check(
      logSeats.every((seat) => {
        const cardFrame = seat.frames.find(
          (frame) => frame.event === "private:entry",
        );
        return cardFrame !== undefined && /"role"\s*:\s*"/.test(cardFrame.text);
      }),
      "and each of those cards is a frame carrying a role, which is a shape no log line may carry",
    );
    const publicLeaks = logSeats.flatMap((seat) =>
      leakedHiddenFields(
        seat.frames.filter((frame) => frame.event === "voyage:log"),
      ).map((leak) => `${seat.captain.username} on ${leak}`),
    );
    check(
      publicLeaks.length === 0,
      "no line in the room's log carries a role, a flourish, an ally or an alignment word, on any socket in the harbor",
    );
    check(
      logSeats.every((seat) =>
        logTextOn(seat.frames).every((text) =>
          cardTexts.every((card) => !text.includes(card.text ?? "")),
        ),
      ),
      "and no private entry appears in the other captain's transcript, which is the plan's own evaluation for this slice",
    );

    // A restarted voyage is a new voyage, so the log goes with it and the
    // room is told. The request afterwards is answered with nothing rather
    // than with the voyage that just ended.
    const restarted = waitForEvent<{ roomId: string }>(
      logHostSeat.socket,
      "room:restarted",
      (payload) => payload?.roomId === logRoomId,
    );
    logHostSeat.socket.emit("room:restart", { roomId: logRoomId });
    check(
      (await restarted) !== null,
      "the host can wipe the voyage and sail again",
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    // A short wait rather than the usual one: nothing is expected here, so
    // this check costs the suite the length of its own timeout.
    const afterRestart = waitForEvent<{
      roomId: string;
      entries: VoyageLogEntry[];
    }>(
      logHostSeat.socket,
      "voyage:log:history",
      (payload) => payload?.roomId === logRoomId,
      1200,
    );
    logHostSeat.socket.emit("voyage:log:request", { roomId: logRoomId });
    check(
      (await afterRestart) === null,
      "and a restarted voyage has no log to hand back, because the log belonged to the voyage that was wiped",
    );

    console.log("\nThe fleet commission");
    // Ocean Gambit's one public surface, and the contrast with the section
    // above is the point of both: the alignment is a secret defended all
    // the way to the wire, and this is a shared number that only has to be
    // un-inflatable. So these checks are about the deck holding its own
    // authoring rule, about every captain hearing the same board, and about
    // a doctored report not moving it.

    // ---- The deck, which needs no sockets ----
    const foundingTier = new Set<string>([
      ...RESOURCES_TIER0,
      ...PRODUCTS_TIER0,
    ]);
    const openingHold = Object.values(STARTING_STOCK).reduce(
      (sum, held) => sum + held,
      0,
    );
    check(
      OBJECTIVE_DECK.every((objective) =>
        objective.resources.every((r) => foundingTier.has(r.type)),
      ),
      "every commission asks only for goods the founding tier can put on the table",
    );
    check(
      OBJECTIVE_DECK.every((objective) =>
        objective.resources.some(
          (r) => r.required > (STARTING_STOCK[r.type] ?? 0),
        ),
      ),
      "and every one asks for more of some good than a hold begins the voyage with",
    );
    check(
      OBJECTIVE_DECK.every(
        (objective) =>
          objective.resources.length >= 2 &&
          objectiveTotalItems(objective) > openingHold,
      ),
      "so no captain can fill one alone, and none of them is one round's work",
    );
    check(
      drawObjective(objectiveSeed("harbor-a", 3)).id ===
        drawObjective(objectiveSeed("harbor-a", 3)).id,
      "one harbor draws the same commission twice",
    );
    check(
      objectiveSeed("harbor-a", 3) === "harbor-a:V3:objective",
      "and its seed is the harbor and the voyage with no captain anywhere in it",
    );
    const voyageDraws = new Set(
      Array.from(
        { length: 40 },
        (_, epoch) => drawObjective(objectiveSeed("harbor-a", epoch)).id,
      ),
    );
    check(
      voyageDraws.size > 1,
      "a run of voyages pulls more than one entry off the deck",
    );

    // ---- The board, over the wire ----
    // A socket holds one harbor at a time, so the four captains sail back
    // into the Gambit room to report there. The commission is drawn here
    // the way both the server and a client draw it, from the harbor and
    // the voyage, which is also what makes the clamp check below a
    // statement about the two of them agreeing.
    const gambitNow = await db.room.findUnique({
      where: { id: gambitRoomId },
      select: { voyageEpoch: true },
    });
    const commission = drawObjective(
      objectiveSeed(gambitRoomId, gambitNow?.voyageEpoch ?? 0),
    );
    const owed = commission.resources[0];

    const backInHarbor = seated.map((seat) =>
      waitForEvent<WireHistory>(
        seat.socket,
        "chat:history",
        (payload) => payload?.roomId === gambitRoomId,
      ),
    );
    for (const seat of seated) {
      seat.socket.emit("room:join", { roomId: gambitRoomId });
    }
    await Promise.all(backInHarbor);

    const boardOn = (socket: Socket) =>
      waitForEvent<{
        roomId: string;
        total: Record<string, number>;
      }>(
        socket,
        "objective:progress",
        (payload) => payload?.roomId === gambitRoomId,
        4000,
      );

    // Every socket in the harbor is listened to at once, because a board
    // that reached only the captain who moved would still look right to
    // that captain.
    const heardByEveryone = seated.map((seat) => boardOn(seat.socket));
    seated[0].socket.emit("objective:report", {
      roomId: gambitRoomId,
      delivered: { [owed.type]: 2 },
    });
    const boardHeard = await Promise.all(heardByEveryone);
    check(
      boardHeard.every((frame) => frame?.total?.[owed.type] === 2),
      `a delivery of 2 ${owed.type} reaches every captain in the harbor`,
    );

    const summed = boardOn(seated[0].socket);
    seated[1].socket.emit("objective:report", {
      roomId: gambitRoomId,
      delivered: { [owed.type]: 3 },
    });
    check(
      (await summed)?.total?.[owed.type] === 5,
      "and a second captain's report adds to the same board",
    );

    const boardReplayed = boardOn(seated[0].socket);
    seated[0].socket.emit("objective:report", {
      roomId: gambitRoomId,
      delivered: { [owed.type]: 2 },
    });
    check(
      (await boardReplayed)?.total?.[owed.type] === 5,
      "a re-report of what was already sent does not count twice",
    );

    const walkedBack = boardOn(seated[0].socket);
    seated[1].socket.emit("objective:report", {
      roomId: gambitRoomId,
      delivered: { [owed.type]: 1 },
    });
    check(
      (await walkedBack)?.total?.[owed.type] === 5,
      "and a report that goes backwards cannot walk the board down",
    );

    const inflated = boardOn(seated[0].socket);
    seated[2].socket.emit("objective:report", {
      roomId: gambitRoomId,
      delivered: { [owed.type]: 999999, Unobtainium: 5 },
    });
    const clamped = await inflated;
    check(
      clamped?.total?.[owed.type] === owed.required,
      `a report claiming six figures is capped at the ${owed.required} the commission asks for`,
    );
    check(
      clamped !== null &&
        Object.keys(clamped.total).every((good) =>
          commission.resources.some((r) => r.type === good),
        ),
      "and the board names no good the deck does not",
    );

    const lateArrival = await openAuthedSocket(gambitThird);
    run.sockets.push(lateArrival);
    const greeted = boardOn(lateArrival);
    lateArrival.emit("room:join", { roomId: gambitRoomId });
    check(
      (await greeted)?.total?.[owed.type] === owed.required,
      "a captain who joins late is handed the board as it stands",
    );

    // The frames the two sections above collected, read back for the same
    // reason the alignment frames were: a payload with nowhere to put a
    // secret cannot leak one, so the claim is about the shape it carries.
    const boardFrames = seated.flatMap((seat) =>
      seat.frames.filter((frame) => frame.event === "objective:progress"),
    );
    check(
      boardFrames.length > 0,
      "the harbor's board really did ride the wire, so the next checks have something to read",
    );
    check(
      boardFrames.every((frame) => {
        const payload = JSON.parse(frame.text)[0] as Record<string, unknown>;
        return (
          JSON.stringify(Object.keys(payload).sort()) ===
          JSON.stringify(["roomId", "total"])
        );
      }),
      "and every frame of it carries exactly a room and a total, nothing else",
    );
    const secretPattern = new RegExp(`\\b${secret}\\b`);
    check(
      boardFrames.every((frame) => !secretPattern.test(frame.text)),
      `and none of them names the ${secret}, on any socket`,
    );

    // The tally this captain owns rides inside the per voyage save blob,
    // which nothing in this file covered before now.
    const saved = {
      objectiveDelivered: { [owed.type]: 4 },
      objectiveTrace: [
        { round: 2, at: Date.now(), delivered: { [owed.type]: 4 } },
      ],
    };
    const put = await call<{ ok: boolean }>("/api/game/state", {
      method: "PUT",
      cookie: gambitHost.cookie,
      body: JSON.stringify({ roomId: gambitRoomId, data: saved }),
    });
    check(
      put.status === 200,
      "a voyage state carrying a commission record saves",
    );
    const loaded = await call<{ state: string | null }>(
      `/api/game/state?roomId=${gambitRoomId}`,
      { cookie: gambitHost.cookie },
    );
    // The route hands back the stored blob as the text it is, and every
    // client parses it, so this reads it back the way a client does.
    const loadedState =
      typeof loaded.body.state === "string"
        ? (JSON.parse(loaded.body.state) as typeof saved)
        : null;
    check(
      loadedState?.objectiveDelivered?.[owed.type] === 4 &&
        loadedState?.objectiveTrace?.[0]?.round === 2,
      "and loads back with the tally and the trace it was given",
    );

    // [J1: the private information review] The save path's one bound,
    // which exists because a save is read by the harbor rather than only
    // by the captain who wrote it: the conclusion parses every blob at the
    // table and the Manifest Audit samples one of them, so an enormous
    // save is paid for by six captains, on the code path that has to
    // finish before a voyage can end. 64 KB is around twenty times the
    // largest real save, so this fills well past it and then reads both
    // halves of what a bound owes: the oversized save is refused, and the
    // good one already written to the row is still there afterwards.
    const enormous = {
      objectiveDelivered: { [owed.type]: 4 },
      objectiveTrace: Array.from({ length: 4000 }, (_, i) => ({
        round: 3,
        at: i,
        delivered: { [owed.type]: 1 },
      })),
    };
    check(
      JSON.stringify(enormous).length > 64 * 1024,
      "the probe save is larger than the cap, so the check below can fail",
    );
    const tooLarge = await call<{ error?: string }>("/api/game/state", {
      method: "PUT",
      cookie: gambitHost.cookie,
      body: JSON.stringify({ roomId: gambitRoomId, data: enormous }),
    });
    check(
      tooLarge.status === 413,
      "a save larger than the cap is refused rather than stored",
    );
    const afterRefusal = await call<{ state: string | null }>(
      `/api/game/state?roomId=${gambitRoomId}`,
      { cookie: gambitHost.cookie },
    );
    const untouched =
      typeof afterRefusal.body.state === "string"
        ? (JSON.parse(afterRefusal.body.state) as typeof saved)
        : null;
    check(
      untouched?.objectiveDelivered?.[owed.type] === 4 &&
        untouched?.objectiveTrace?.length === 1,
      "and the refusal left the voyage's own save exactly as it was",
    );

    // A restarted voyage starts the board empty, and this is the one check
    // in the section that cannot be satisfied by a client re-reporting: a
    // report of zero cannot clear a max merged tally, because max(old, 0)
    // is old. Without the clear in room:restart, the dead voyage's numbers
    // are still there and this report lands on top of them.
    seated[0].socket.emit("room:restart", { roomId: gambitRoomId });
    await new Promise((resolve) => setTimeout(resolve, 600));
    const nextRoom = await db.room.findUnique({
      where: { id: gambitRoomId },
      select: { voyageEpoch: true },
    });
    const nextCommission = drawObjective(
      objectiveSeed(gambitRoomId, nextRoom?.voyageEpoch ?? 0),
    );
    const nextOwed = nextCommission.resources[0];
    const freshBoard = boardOn(seated[0].socket);
    seated[0].socket.emit("objective:report", {
      roomId: gambitRoomId,
      delivered: { [nextOwed.type]: 2 },
    });
    check(
      (await freshBoard)?.total?.[nextOwed.type] === 2,
      "restarting the voyage starts the board empty rather than on the dead voyage's numbers",
    );

    // ---- What a concluded voyage leaves behind ----
    // The measurement half of the mode, and the one thing here no other
    // part of this file reaches: a voyage that ends writes the commission
    // onto its Chronicle rows, and a slice about telemetry that never
    // exercises the write would be claiming something it never checked.
    //
    // One captain ends holding a trace that met the commission and the
    // others end holding nothing, which is what makes the two branches of
    // the met flag both testable in one voyage.
    const fullBoard: Record<string, number> = {};
    for (const r of nextCommission.resources) fullBoard[r.type] = r.required;
    await call<{ ok: boolean }>("/api/game/state", {
      method: "PUT",
      cookie: gambitHost.cookie,
      body: JSON.stringify({
        roomId: gambitRoomId,
        data: {
          objectiveDelivered: fullBoard,
          objectiveTrace: [{ round: 4, at: Date.now(), delivered: fullBoard }],
        },
      }),
    });

    // Only a captain's newest socket may report a status, and the six
    // captain table above left a newer one behind for every captain here,
    // seated in a harbor this one is not. So each finisher is handed a
    // fresh socket seated in this harbor, which is both the newest socket
    // the server keeps for that captain and the one bound to this room,
    // and the report goes out from there. A report from any of the seats
    // taken earlier is refused, which is the rule under test rather than
    // an obstacle to it.
    const finishers: Socket[] = [];
    for (const captain of [
      gambitHost,
      gambitSecond,
      gambitThird,
      gambitFourth,
    ]) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      const seatedHere = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === gambitRoomId,
      );
      socket.emit("room:join", { roomId: gambitRoomId });
      await seatedHere;
      finishers.push(socket);
    }
    // The hand this voyage is judged on, written here rather than drawn:
    // one card per finisher, chosen so that the verdict each captain is owed
    // is known before the voyage ends. The harness owns the hand the same
    // way it owns the paired table's above, and the reason is the same one:
    // a drawn hand would make every check below unrepeatable.
    //
    // The saves those verdicts are read from are written here too, which is
    // the other half of the arrangement. gambitHost's was put above and met
    // the commission, and the two Brokers are handed the ledger their own
    // verdict turns on, one exactly at the target and one a single Gold
    // under it, so the boundary of the rule is what the voyage records.
    const writeCard = (userId: string, role: string) =>
      db.voyageRole.upsert({
        where: { roomId_userId: { roomId: gambitRoomId, userId } },
        create: { roomId: gambitRoomId, userId, role },
        update: { role, flourish: null },
      });
    const writeSave = (cookie: string, data: Record<string, unknown>) =>
      call<{ ok: boolean }>("/api/game/state", {
        method: "PUT",
        cookie,
        body: JSON.stringify({ roomId: gambitRoomId, data }),
      });
    await writeCard(gambitHost.id, "honest");
    await writeCard(gambitSecond.id, "broker");
    await writeCard(gambitThird.id, "broker");
    await writeCard(gambitFourth.id, "pirate");
    // The ledger a Broker's verdict turns on is the one ending figure the
    // client is trusted for, so this writes it and then reads the row back:
    // a failure here reads as "the save never reached the row" rather than
    // as a rule that decided wrongly under it.
    const brokerHand = await writeSave(gambitSecond.cookie, {
      peerTradeProfit: BROKER_PAYOUT_TARGET,
    });
    const nearMissHand = await writeSave(gambitThird.cookie, {
      peerTradeProfit: BROKER_PAYOUT_TARGET - 1,
    });
    const handedRow = await db.gameState.findUnique({
      where: {
        userId_roomId: { userId: gambitSecond.id, roomId: gambitRoomId },
      },
      select: { data: true },
    });
    check(
      brokerHand.status === 200 &&
        nearMissHand.status === 200 &&
        handedRow?.data?.includes(String(BROKER_PAYOUT_TARGET)) === true,
      "the harness can hand a captain the ledger their verdict is read from",
    );

    for (const socket of finishers) {
      socket.emit("game:status", {
        roomId: gambitRoomId,
        round: 5,
        phase: "endgame",
        phaseLabel: "Voyage Complete",
        gold: 40,
        reputation: 30,
        shipLevel: 2,
        gameOver: true,
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // The conclusion writes behind the last report rather than inside it,
    // so the rows are waited for rather than slept past: a fixed pause
    // long enough on this machine is the kind of check that fails the
    // first time it runs somewhere slower.
    const readChronicles = () =>
      db.voyageChronicle.findMany({
        where: { roomId: gambitRoomId },
        select: {
          userId: true,
          mode: true,
          objectiveId: true,
          objectiveMet: true,
          objectiveTrace: true,
          alignment: true,
          won: true,
        },
      });
    let chronicles = await readChronicles();
    for (
      let waited = 0;
      chronicles.length < finishers.length && waited < 10000;
      waited += 250
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      chronicles = await readChronicles();
    }
    check(
      chronicles.length === finishers.length,
      "a concluded voyage writes one chronicle per captain",
    );
    check(
      chronicles.every((row) => row.mode === "ocean_gambit"),
      "and every one records the lap it was sailed on",
    );
    check(
      chronicles.every((row) => row.objectiveId === nextCommission.id),
      `and names the commission the fleet was working on (${nextCommission.id})`,
    );
    const hostChronicle = chronicles.find(
      (row) => row.userId === gambitHost.id,
    );
    check(
      JSON.parse(hostChronicle?.objectiveTrace ?? "[]").length === 1,
      "and carries the per leg trace rather than dropping it",
    );
    check(
      hostChronicle?.objectiveMet === true &&
        chronicles
          .filter((row) => row.userId !== gambitHost.id)
          .every((row) => row.objectiveMet === false),
      "reading the met flag out of that trace, and never inventing one for a captain who kept none",
    );

    // ---- What the voyage decided about each card ----
    // The other half of the victory rules above: the card a captain sailed
    // under and whether the rule says they won it, read back off the rows
    // the conclusion wrote. The hand is the one written a few lines up, so
    // every verdict here is known in advance, and the four rows between them
    // cover a win, a win that needs no commission at all, and two ways to
    // lose.
    const verdictOf = (captainId: string) =>
      chronicles.find((row) => row.userId === captainId);
    check(
      chronicles.every(
        (row) =>
          row.alignment === "honest" ||
          row.alignment === "broker" ||
          row.alignment === "pirate",
      ),
      "every concluded voyage records the card its captain sailed under",
    );
    check(
      verdictOf(gambitHost.id)?.won === true,
      "an Honest captain whose fleet met the commission wins the voyage",
    );
    check(
      verdictOf(gambitSecond.id)?.won === true &&
        verdictOf(gambitSecond.id)?.objectiveMet === false,
      "and a Broker who reached the target wins it beside them, on a voyage the fleet did not finish",
    );
    check(
      verdictOf(gambitThird.id)?.won === false,
      "while a Broker one Gold short of the target wins nothing",
    );
    check(
      verdictOf(gambitFourth.id)?.won === false,
      "and a Pirate ends a voyage the fleet fell short of with nothing, from a rating below the floor the card demands",
    );

    // The mode is a room property the server reads for itself, so the
    // other half of the guard is that a Classic harbor has no board at
    // all, whatever it is sent.
    const boardRefused: string[] = [];
    const collector = (event: string, ...args: unknown[]) =>
      boardRefused.push(`${event}:${JSON.stringify(args)}`);
    seated[0].socket.onAny(collector);
    const backInClassic = waitForEvent<WireHistory>(
      seated[0].socket,
      "chat:history",
      (payload) => payload?.roomId === classicRoomId,
    );
    seated[0].socket.emit("room:join", { roomId: classicRoomId });
    await backInClassic;
    seated[0].socket.emit("objective:report", {
      roomId: classicRoomId,
      delivered: { [nextOwed.type]: 2 },
    });
    await new Promise((resolve) => setTimeout(resolve, 600));
    seated[0].socket.offAny(collector);
    check(
      !boardRefused.some((frame) => frame.startsWith("objective:progress")),
      "a Classic harbor is sent no commission board at all",
    );

    console.log("\nThe quota rung");
    // H5's difficulty rung: the commission's quotas scale with the size of
    // the fleet the voyage was dealt to, so the sabotage window is the same
    // width at four seats as at six. The gate that rung exists for is a
    // claim about win rates, so there are two halves here and both matter:
    // the band table's own arithmetic, and the plumbing that carries a
    // pinned size from the room into the board the server clamps against.
    // The second half is the one a unit test cannot reach, which is why it
    // is checked against a harbor that really set sail.

    // ---- The bands, which need no sockets ----
    check(
      seatBand(0).factor === 1 &&
        seatBand(1).factor === 1 &&
        seatBand(4).factor === 1,
      "a founding table's commission is the deck exactly as authored",
    );
    check(
      seatBand(5).factor > 1 && seatBand(6).factor > seatBand(5).factor,
      "and every band above it asks for more than the one below",
    );
    check(
      seatBand(6).factor === seatBand(9).factor && seatBand(5).label === "5",
      "with a table larger than the top band sailing on the top band",
    );
    check(
      SEAT_BANDS.every(
        (band, index) => index === 0 || band.min > SEAT_BANDS[index - 1].min,
      ),
      "the bands are ordered, so a walk over them cannot settle on the wrong floor",
    );

    // The anchor, good for good and string for string. This is the promise
    // the rung made to every voyage that predates it: a room whose pin is
    // missing reads as the anchor, and a voyage that begins at four seats
    // or fewer draws the board the deck would have drawn with no rung at
    // all, down to the entry.
    const anchorSeats = [0, 1, 2, 3, 4];
    check(
      anchorSeats.every(
        (seats) =>
          objectiveSeed("harbor-a", 3, seats) === "harbor-a:V3:objective",
      ),
      "a founding voyage's seed is the string it always was, at every size in the band",
    );
    check(
      anchorSeats.every(
        (seats) =>
          JSON.stringify(
            drawObjective(objectiveSeed("harbor-rung", 7, seats), seats),
          ) ===
          JSON.stringify(drawObjective(objectiveSeed("harbor-rung", 7), 0)),
      ),
      "and its board is the board the deck would have drawn unpinned",
    );
    check(
      objectiveSeed("harbor-a", 3, 5) === "harbor-a:V3:objective:S5",
      "while a wider voyage seeds from its size as well as its harbor and its epoch",
    );

    // The scaling itself, at one seed so the entry cannot move under it.
    const rungSeed = "harbor-rung:V7:objective:S6";
    const anchorAtSeed = drawObjective(rungSeed, 0);
    const wideAtSeed = drawObjective(rungSeed, 6);
    check(
      wideAtSeed.id === anchorAtSeed.id,
      "one seed draws one commission, whatever size the fleet at it is",
    );
    check(
      wideAtSeed.resources.every((row) => {
        const base = anchorAtSeed.resources.find((r) => r.type === row.type);
        // At least the band's factor and never a whole item past it: that
        // is the ceiling rule, stated without restating Math.ceil.
        return (
          base !== undefined &&
          row.required >= base.required * 1.5 &&
          row.required < base.required * 1.5 + 1
        );
      }),
      "and the rung scales every quota by the band's factor, rounding up",
    );
    check(
      wideAtSeed.resources.every(
        (row) =>
          row.price ===
          anchorAtSeed.resources.find((r) => r.type === row.type)?.price,
      ) && objectiveTotalItems(wideAtSeed) > objectiveTotalItems(anchorAtSeed),
      "for more cargo at the same price rather than the same cargo at a worse one",
    );

    // The ceiling the Ledger Integrity Pass reads is the one number in the
    // mode that a wider commission can falsify from a distance: a full six
    // seat hand over is real Gold, and a ceiling left at the founding
    // deck's own maximum would call it impossible.
    const anchorPayout = Math.max(
      ...OBJECTIVE_DECK.map((objective) =>
        objective.resources.reduce((sum, r) => sum + r.required * r.price, 0),
      ),
    );
    check(
      OBJECTIVE_DECK.every((objective) =>
        SEAT_BANDS.every(
          (band) =>
            objective.resources.reduce(
              (sum, r) => sum + Math.ceil(r.required * band.factor) * r.price,
              0,
            ) <= widestObjectivePayout(),
        ),
      ),
      "the payout ceiling covers every commission the deck can be drawn at, at every band",
    );
    check(
      widestObjectivePayout() > anchorPayout,
      "and is wider than the deck as authored, so a full table's payout cannot read as forged",
    );

    // ---- The instrument the gate is read with ----
    // Pure arithmetic over rows, exercised here because every claim the
    // epic's evaluation will make is made through it. The Classic row is
    // the one that has to fall out: no card was dealt there, and counting
    // its won flag would drag every rate toward zero.
    const voyageRows: VoyageOutcome[] = [
      { alignment: "honest", won: true, seats: 4 },
      { alignment: "honest", won: true, seats: 2 },
      { alignment: "honest", won: false, seats: 6 },
      { alignment: "pirate", won: true, seats: 6 },
      // A Classic voyage, in the table only to be left out of it again.
      { alignment: "", won: true, seats: 4 },
    ];
    const readings = readWinRates(voyageRows);
    check(
      readings.length === SEAT_BANDS.length * 3 &&
        readings[0].alignment === "honest" &&
        readings[0].band === SEAT_BANDS[0].label,
      "the reader reports every role at every table size, in the deck's band order",
    );
    check(
      readings.reduce((sum, reading) => sum + reading.played, 0) === 4,
      "counts the voyages that were dealt a card, and leaves the Classic ones out",
    );
    const honestAnchor = readings.find(
      (reading) =>
        reading.alignment === "honest" && reading.band === SEAT_BANDS[0].label,
    );
    check(
      honestAnchor?.played === 2 &&
        honestAnchor?.won === 2 &&
        honestAnchor?.rate === 1,
      "reads a band's rate off the rows in it",
    );
    const pirateSix = readings.find(
      (reading) =>
        reading.alignment === "pirate" && reading.band === seatBand(6).label,
    );
    const noVoyages = readings.find((reading) => reading.played === 0);
    check(
      pirateSix?.rate === 1 && noVoyages?.rate === null,
      "and reports a band nobody played as unknown rather than as a loss",
    );
    check(
      noVoyages !== undefined &&
        bandVerdict(noVoyages.alignment, noVoyages.rate) === "unplayed",
      "so an unplayed band is not read as a verdict either",
    );
    check(
      bandVerdict("pirate", 0.2) === "in" &&
        bandVerdict("pirate", 0.26) === "in" &&
        bandVerdict("pirate", 13 / 50) === "in",
      "a rate sitting on a role's floor or its ceiling is inside the band",
    );
    check(
      bandVerdict("pirate", 0.196) === "in" &&
        bandVerdict("pirate", 0.194) === "under" &&
        bandVerdict("pirate", 0.264) === "in" &&
        bandVerdict("pirate", 0.266) === "over",
      "and one within half a point of a boundary is read at the percent it rounds to",
    );
    check(
      bandVerdict("honest", 0.52) === "in" &&
        bandVerdict("broker", 0.45) === "in" &&
        bandVerdict("honest", 0.46) === "under",
      "each role is judged against its own target rather than a shared one",
    );
    check(
      readings.every((reading) => {
        const target = WIN_RATE_TARGETS[reading.alignment];
        return target.floor < target.ceiling;
      }) && WIN_RATE_TARGETS.honest.floor > WIN_RATE_TARGETS.pirate.ceiling,
      "every role the reader reports has a band of its own, and the fleet's worst is still the Pirate's best",
    );

    // ---- The swing reader ----
    // How far a role's rate moves across the bands it played. The command
    // line report prints it and the balance dashboard shows it, so the
    // arithmetic lives here rather than in either of them, and the two
    // cases that are not a number are told apart by the reader: a role that
    // played no band and a role that played one are different absences, and
    // a caller that could not tell them apart would print one as the other.
    const swings = readSwings(readings);
    check(
      swings.length === 3 &&
        swings.every(
          (swing, index) =>
            swing.alignment === readings[index * SEAT_BANDS.length]?.alignment,
        ),
      "the swing reader reports every role once, in the order the win rates are read in",
    );
    const swingFor = (alignment: GambitRole) =>
      swings.find((swing) => swing.alignment === alignment);
    // The Honest captain's three rows above land in two bands, two won of
    // two at the four seat table and none of one at the six, so the swing
    // is the whole distance between the two rates.
    check(
      swingFor("honest")?.bands === 2 && swingFor("honest")?.points === 100,
      "a role read across two bands swings the distance between them",
    );
    check(
      swingFor("pirate")?.bands === 1 && swingFor("pirate")?.points === null,
      "a role that played one band has no swing to read rather than a swing of nothing",
    );
    check(
      swingFor("broker")?.bands === 0 && swingFor("broker")?.points === null,
      "and a role that played none is the other absence, told apart by the band count beside it",
    );

    // ---- The pin, over the wire ----
    // Two voyages that really set sail and one that was restarted, which is
    // the whole life of the column: the six seat table from the paired
    // section pins its own size, a five seat harbor opened here pins the
    // band between the anchor and it, and the harbor from the commission
    // section was restarted before this line and holds nothing. A pin that
    // only ever landed at four would satisfy every check above this one.
    const pinned = (room: string) =>
      db.room.findUnique({
        where: { id: room },
        select: { voyageSeats: true },
      });
    // The harbor the commission section sailed from is in the lobby by now,
    // because that section restarts its voyage to prove the board clears,
    // and no start has followed. So its pin is the zero a room that never
    // pinned reads as, and a room that never pinned is a room that draws the
    // founding deck: the pure checks above are what hold that reading to the
    // board it drew before the rung existed.
    check(
      (await pinned(gambitRoomId))?.voyageSeats === 0,
      "a harbor whose voyage was restarted holds no pin until it sails again",
    );
    check(
      (await pinned(pairedRoomId))?.voyageSeats === pairedCrew.length,
      `and a voyage in flight pins the roster that set sail (${pairedCrew.length} at the paired harbor)`,
    );

    const rungRoom = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: gambitHost.cookie,
        body: JSON.stringify({
          name: `Smoke gambit rung ${suffix}`,
          isPublic: false,
          mode: "ocean_gambit",
          unlock: LEDGER_PHRASE,
        }),
      },
    );
    if (rungRoom.status !== 200) {
      throw new Error("No five captain Gambit harbor to test with.");
    }
    const rungRoomId = rungRoom.body.room.id;
    const rungCrew = [gambitSecond, gambitThird, gambitFourth, gambitFifth];
    const rungJoins = await Promise.all(
      rungCrew.map((captain) =>
        call<{ room: { id: string } }>("/api/rooms/join", {
          method: "POST",
          cookie: captain.cookie,
          body: JSON.stringify({ code: rungRoom.body.room.code }),
        }),
      ),
    );
    check(
      rungJoins.every((join) => join.status === 200),
      "five captains can be seated in a harbor for the middle band",
    );

    const rungSockets: Socket[] = [];
    for (const captain of [gambitHost, ...rungCrew]) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      const takenASeat = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === rungRoomId,
      );
      socket.emit("room:join", { roomId: rungRoomId });
      await takenASeat;
      rungSockets.push(socket);
    }

    const departure = rungSockets.map((socket) =>
      waitForEvent<{ roomId: string; seats?: number }>(
        socket,
        "room:started",
        (payload) => payload?.roomId === rungRoomId,
      ),
    );
    rungSockets[0].emit("room:start", { roomId: rungRoomId });
    const departures = await Promise.all(departure);
    check(
      departures.every((frame) => frame?.seats === 5),
      "setting sail tells every captain the size the voyage was dealt to",
    );
    check(
      (await pinned(rungRoomId))?.voyageSeats === 5,
      "and the room records the same number the departure carried",
    );

    // The reload path, which is the other frame a live client draws from: a
    // captain who comes back mid voyage has no lobby to have heard the
    // departure in, so the size has to ride with the save.
    const rungReload = await call<{ seats?: number }>(
      `/api/game/state?roomId=${rungRoomId}`,
      { cookie: gambitHost.cookie },
    );
    check(
      rungReload.body?.seats === 5,
      "a captain reloading mid voyage is handed that size alongside the save",
    );

    // The board itself, drawn here the way a client draws it and clamped
    // there the way the server does. If the server were still on the
    // founding board, the second report below would come back at the
    // founding quota, or not at all for a good that board never names.
    const rungRoomRow = await db.room.findUnique({
      where: { id: rungRoomId },
      select: { voyageEpoch: true },
    });
    const rungBoard = drawObjective(
      objectiveSeed(rungRoomId, rungRoomRow?.voyageEpoch ?? 0, 5),
      5,
    );
    const rungOwed = rungBoard.resources[0];
    const rungBoardHeard = (socket: Socket) =>
      waitForEvent<{ roomId: string; total: Record<string, number> }>(
        socket,
        "objective:progress",
        (payload) => payload?.roomId === rungRoomId,
      );
    const rungHand: Record<string, number> = {};
    for (const r of rungBoard.resources) rungHand[r.type] = r.required;
    const rungFullBoard = rungBoardHeard(rungSockets[0]);
    rungSockets[1].emit("objective:report", {
      roomId: rungRoomId,
      delivered: rungHand,
    });
    const filled = await rungFullBoard;
    check(
      rungBoard.resources.every((r) => filled?.total?.[r.type] === r.required),
      `a five seat commission takes the ${objectiveTotalItems(rungBoard)} items its own quotas ask for, good for good`,
    );
    const clampedWide = rungBoardHeard(rungSockets[0]);
    rungSockets[2].emit("objective:report", {
      roomId: rungRoomId,
      delivered: { [rungOwed.type]: 999999 },
    });
    check(
      (await clampedWide)?.total?.[rungOwed.type] === rungOwed.required,
      "and a report past it is clamped at the wider quota rather than the founding one",
    );

    // The pin belongs to the voyage, so it goes when the voyage does.
    rungSockets[0].emit("room:restart", { roomId: rungRoomId });
    let unpinned = (await pinned(rungRoomId))?.voyageSeats;
    for (let waited = 0; unpinned !== 0 && waited < 5000; waited += 250) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      unpinned = (await pinned(rungRoomId))?.voyageSeats;
    }
    check(
      unpinned === 0,
      "restarting the voyage clears the pin with the voyage it belonged to",
    );

    console.log("\nThe Manifest Audit");
    // [H6] The fleet's one evidence tool, and the only majority vote in
    // the game: from leg five, once a voyage, more than half of the
    // captains still sailing may open one captain's manifest and see two
    // of their last five order fulfillments.
    //
    // The checks come in the two halves the feature lives in. The sample
    // and the majority are pure arithmetic, so they are checked directly;
    // the vote itself is checked over the wire against a real harbor,
    // because a majority rule that is not wired to the checkpoint it is
    // called from is a rule that never fires.

    // ---- The sample, and the majority that asks for it ----
    const manifestFill = (
      round: number,
      port: string,
      type: string,
      qty: number,
      reward: number,
    ): OrderFill => ({ round, port, items: [{ type, qty }], reward });
    const sixFills: OrderFill[] = [
      manifestFill(1, "Quanzhou Port", "Tea", 2, 40),
      manifestFill(2, "Ningbo Port", "Silk", 1, 55),
      manifestFill(3, "Fuzhou Port", "Porcelain Clay", 3, 30),
      manifestFill(4, "Guangzhou Port", "Copper Ore", 2, 70),
      manifestFill(5, "Quanzhou Port", "Linen Clothes", 1, 90),
      manifestFill(6, "Ningbo Port", "Brocade", 2, 120),
    ];
    const auditKey = auditSeed("harbor-a", 1, 5, "captain-a");
    const drawnAudit = drawAudit(auditKey, sixFills);
    check(
      drawnAudit.length === AUDIT_REVEAL_COUNT &&
        JSON.stringify(drawAudit(auditKey, sixFills)) ===
          JSON.stringify(drawnAudit),
      `an audit of a full manifest reveals ${AUDIT_REVEAL_COUNT} lines, and the same seed draws the same ones every time`,
    );
    check(
      drawnAudit.every(
        (fill) =>
          sixFills.slice(-AUDIT_WINDOW).includes(fill) && fill.round !== 1,
      ) && new Set(drawnAudit).size === drawnAudit.length,
      `so a reveal can be checked against the record, and every line in it is a distinct one out of the last ${AUDIT_WINDOW}`,
    );
    check(
      new Set(
        Array.from({ length: 40 }, (_, i) =>
          JSON.stringify(drawAudit(`${auditKey}:${i}`, sixFills)),
        ),
      ).size > 1,
      "and it is a sample rather than the newest lines: different seeds draw different pairs out of the same five",
    );
    check(
      drawAudit(auditKey, sixFills.slice(0, 1)).length === 1 &&
        drawAudit(auditKey, []).length === 0,
      "a captain who has filed one order is shown one line, and a captain who has filed none is shown none",
    );
    check(
      auditSeed("harbor-a", 1, 5, "captain-a") !==
        auditSeed("harbor-a", 2, 5, "captain-a") &&
        auditSeed("harbor-a", 1, 6, "captain-a") !==
          auditSeed("harbor-a", 1, 5, "captain-a") &&
        auditSeed("harbor-a", 1, 5, "captain-b") !==
          auditSeed("harbor-a", 1, 5, "captain-a"),
      "the seed carries the voyage, the leg and the captain, so no two audits sample the same way",
    );

    // The majority. Strictly more than half, which is the plan's simple
    // majority read the only way it can be read: two captains cannot both
    // hold one, so there is no tie to break and the answer does not depend
    // on who answered first.
    const votesFor = (targets: string[]) =>
      new Map(targets.map((target, i) => [`voter-${i}`, target]));
    check(
      auditCarried(votesFor(["a", "a"]), 5) === null &&
        auditCarried(votesFor(["a", "a", "a"]), 5) === "a",
      "two of five is not a majority and three is",
    );
    check(
      auditCarried(votesFor(["a", "a", "a"]), 4) === "a" &&
        auditCarried(votesFor(["a", "a"]), 4) === null,
      "a table of four needs the same three, which is what a simple majority means at the smaller size",
    );
    check(
      auditCarried(votesFor(["a", "a", "a"]), 6) === null &&
        auditCarried(votesFor(["a", "a", "b", "a", "a"]), 6) === "a",
      "a table of six needs four, counted for whoever reaches it",
    );
    check(
      auditCarried(votesFor(["a", "b", "b"]), 5) === null &&
        auditCarried(new Map(), 5) === null,
      "a room split across two captains carries nothing, and neither does a room with no votes in it",
    );

    // The record behind the sample, which is the one thing in the mode a
    // whole table reads and believes, so its shape is judged here rather
    // than trusted.
    const messyManifest = normalizeOrderFills([
      manifestFill(1, "Quanzhou Port", "Tea", 2, 40),
      { round: 2, port: "Ningbo Port", items: [], reward: 10 },
      {
        round: 3,
        port: "Fuzhou Port",
        items: [{ type: "Tea", qty: 0 }],
        reward: 10,
      },
      { round: 4, port: "", items: [{ type: "Tea", qty: 1 }], reward: 10 },
      {
        round: 5,
        port: "Guangzhou Port",
        items: [{ type: "Tea", qty: 2 }],
        reward: -1,
      },
      {
        round: 5.8,
        port: "Ningbo Port",
        items: [{ type: "Tea", qty: 2 }],
        reward: 22.9,
      },
      "Leg 6: two Bundles of Tea to nowhere, 10 Gold",
    ]);
    check(
      messyManifest.length === 2 &&
        messyManifest[0].round === 1 &&
        messyManifest[1].round === 5 &&
        messyManifest[1].reward === 22,
      "a manifest is read for what it can hold: an empty line, a blank port, a zero count and a negative payout are dropped, and a fractional leg is floored",
    );
    const nineFills = Array.from({ length: 9 }, (_, i) =>
      manifestFill(i + 1, "Quanzhou Port", "Tea", 1, 10),
    );
    check(
      normalizeOrderFills(nineFills).length === AUDIT_WINDOW &&
        normalizeOrderFills(nineFills)[0].round === 9 - AUDIT_WINDOW + 1,
      `and a manifest of nine keeps the last ${AUDIT_WINDOW}, so the record the sample reads has a ceiling as well as a floor`,
    );
    check(
      normalizeOrderFills(undefined).length === 0 &&
        normalizeOrderFills("a manifest").length === 0 &&
        normalizeOrderFills([
          { round: 1, port: "Quanzhou Port", items: [{ type: "Tea", qty: 1 }] },
        ]).length === 0,
      "a save with no manifest, or with lines that are not one, reads as a captain who has filed nothing",
    );

    // [J1: the private information review] The bounds the review put on a
    // fill, read from both sides. A fill is printed to the whole table in
    // an audit reveal and in the ledger at the end of a voyage, and until
    // this pass the only bound on its text and its width was the client
    // that wrote it, so a doctored save could put a paragraph of its
    // choosing in front of six captains at the moment they were watching.
    // Each bound is deliberately generous, which is why both halves are
    // read here: what a real voyage produces survives, and what only a
    // doctored save could is dropped.
    const overlongPort = "A Port With A Name Long Enough To Fill A Line";
    const overlongGood = "A Good Named In A Sentence Rather Than In A Word";
    const longText = normalizeOrderFills([
      manifestFill(1, overlongPort, "Tea", 1, 10),
      manifestFill(2, "Ningbo Port", overlongGood, 1, 10),
      manifestFill(3, "Fuzhou Port", "Tea", 1, 10),
    ]);
    check(
      longText.length === 1 && longText[0].round === 3,
      "a port or a good named at a length no catalogue prints takes its whole line with it, and the ordinary line beside it stays",
    );
    const wideLines = normalizeOrderFills([
      {
        round: 1,
        port: "Quanzhou Port",
        items: Array.from({ length: 5 }, (_, i) => ({
          type: `Good ${i}`,
          qty: 1,
        })),
        reward: 10,
      },
      {
        round: 2,
        port: "Quanzhou Port",
        items: [{ type: "Tea", qty: 1000 }],
        reward: 10,
      },
      manifestFill(3, "Quanzhou Port", "Tea", 4, 10),
    ]);
    check(
      wideLines.length === 1 && wideLines[0].round === 3,
      "a line of five kinds of good and a line claiming a thousand units are dropped too, while four units of one good, the widest a real order asks for, is kept",
    );

    // The same list, read by the pass that guards every other number in a
    // save. It matters most here: this is the one record a room reads and
    // believes, so a save that could stuff it could lie to a whole table
    // at once.
    check(
      snapshotFromSave({ orderFills: sixFills.slice(-AUDIT_WINDOW) })
        ?.orderFills === AUDIT_WINDOW,
      "the Ledger Integrity Pass reads a manifest as the length of the list",
    );
    check(
      checkSave({ orderFills: 100000 }, 1).findings.some(
        (finding) => finding.field === "orderFills",
      ) && checkSave({ orderFills: AUDIT_WINDOW }, 5).severity === "ok",
      "so a manifest nobody could have filed is impossible and a full one is not",
    );

    // One manifest line, which is the reveal's whole vocabulary and the
    // only part of it a captain reads in words.
    const manifestLine = fulfillmentLine(
      manifestFill(6, "Ningbo Port", "Brocade", 2, 120),
    );
    check(
      manifestLine === "Leg 6: 2 Brocade to Ningbo Port, 120 Gold",
      "a manifest line names the leg, the goods, the port and what the order paid",
    );
    // Read with the same rule the briefings are read with, defined once at
    // the top of this file for the reason it is built out of code points:
    // a dash check should not be where the dashes are kept.
    check(
      !CARRIES_A_DASH.test(manifestLine),
      "and carries no dash of any kind, which is the house rule for every string a captain reads",
    );

    // ---- The vote, in a real harbor ----
    // Five captains, because five is the smallest table where a majority
    // is neither nearly everyone nor a coin toss: three carry and two do
    // not.
    const auditRoom = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: gambitHost.cookie,
        body: JSON.stringify({
          name: `Smoke audit ${suffix}`,
          isPublic: false,
          mode: "ocean_gambit",
          unlock: LEDGER_PHRASE,
        }),
      },
    );
    if (auditRoom.status !== 200) {
      throw new Error("No five captain harbor to call an audit in.");
    }
    const auditRoomId = auditRoom.body.room.id;
    const auditCrew = [gambitSecond, gambitThird, gambitFourth, gambitFifth];
    const auditSeats = await Promise.all(
      auditCrew.map((captain) =>
        call<{ room: { id: string } }>("/api/rooms/join", {
          method: "POST",
          cookie: captain.cookie,
          body: JSON.stringify({ code: auditRoom.body.room.code }),
        }),
      ),
    );
    check(
      auditSeats.every((join) => join.status === 200),
      "five captains can sit at the table an audit is called from",
    );

    const auditSockets: Socket[] = [];
    for (const captain of [gambitHost, ...auditCrew]) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      const takenASeat = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === auditRoomId,
      );
      socket.emit("room:join", { roomId: auditRoomId });
      await takenASeat;
      auditSockets.push(socket);
    }

    const auditTargetId = gambitFourth.id;
    const tallyFrames: Array<{ votes: Record<string, string> }> = [];
    const revealFrames: Array<{ socket: number; reveal: AuditReveal }> = [];
    auditSockets.forEach((socket, index) => {
      socket.on(
        "audit:tally",
        (payload: { votes?: Record<string, string> }) => {
          tallyFrames.push({ votes: payload?.votes ?? {} });
        },
      );
      socket.on("audit:reveal", (payload: AuditReveal) => {
        revealFrames.push({ socket: index, reveal: payload });
      });
    });
    const auditSettle = () =>
      new Promise((resolve) => setTimeout(resolve, 400));

    // Before the harbor has sailed there is no checkpoint to call a vote
    // from, which is the first of the three ways a nomination is refused.
    auditSockets[1].emit("audit:vote", {
      roomId: auditRoomId,
      round: AUDIT_FROM_ROUND,
      targetUserId: auditTargetId,
    });
    await auditSettle();
    check(
      tallyFrames.length === 0,
      "a nomination in a harbor that has not set sail is refused",
    );

    const auditDeparture = auditSockets.map((socket) =>
      waitForEvent<{ roomId: string }>(
        socket,
        "room:started",
        (payload) => payload?.roomId === auditRoomId,
      ),
    );
    auditSockets[0].emit("room:start", { roomId: auditRoomId });
    await Promise.all(auditDeparture);

    // And once it has sailed, the vote belongs to one checkpoint: the leg
    // five Parley. Anywhere else it is refused, which is what keeps the
    // audit's price (the rest of that leg's trading) a price for the audit
    // rather than a tax on the voyage.
    auditSockets[1].emit("audit:vote", {
      roomId: auditRoomId,
      round: AUDIT_FROM_ROUND,
      targetUserId: auditTargetId,
    });
    await auditSettle();
    check(
      tallyFrames.length === 0,
      "and one called from a checkpoint that is not the leg five Parley is refused",
    );

    // A harbor reaches leg five the way it reaches every leg: a captain
    // reports where they are standing and the room's checkpoint follows the
    // furthest report. Nothing here is special to the audit.
    auditSockets[1].emit("game:status", {
      roomId: auditRoomId,
      round: AUDIT_FROM_ROUND,
      phase: "parley",
      phaseLabel: "Parley",
      gold: 120,
      reputation: 12,
      shipLevel: 0,
      gameOver: false,
      renownLevel: 3,
    });
    const auditRoomRow = () =>
      db.room.findUnique({
        where: { id: auditRoomId },
        select: { currentRound: true, currentPhase: true, voyageEpoch: true },
      });
    let auditCheckpoint = await auditRoomRow();
    for (
      let waited = 0;
      (auditCheckpoint?.currentRound !== AUDIT_FROM_ROUND ||
        auditCheckpoint?.currentPhase !== "parley") &&
      waited < 5000;
      waited += 250
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      auditCheckpoint = await auditRoomRow();
    }
    check(
      auditCheckpoint?.currentRound === AUDIT_FROM_ROUND &&
        auditCheckpoint?.currentPhase === "parley",
      `the room's checkpoint is at leg ${AUDIT_FROM_ROUND}'s Parley, where the vote is called from`,
    );
    const auditVoyage = auditCheckpoint?.voyageEpoch ?? 0;

    // The manifest the audit is judged against, written through the route
    // a client saves through rather than into the row directly, so what the
    // reveal below is compared against arrived the way a captain's record
    // arrives. Five lines, so the window the sample reads is exactly what
    // was filed here and the reveal can be read line for line.
    const auditFills: OrderFill[] = [
      manifestFill(1, "Quanzhou Port", "Tea", 2, 40),
      manifestFill(2, "Ningbo Port", "Silk", 1, 55),
      manifestFill(3, "Fuzhou Port", "Porcelain Clay", 3, 30),
      manifestFill(4, "Guangzhou Port", "Copper Ore", 2, 70),
      manifestFill(5, "Quanzhou Port", "Linen Clothes", 1, 90),
    ];
    const auditSeeded = await call<{ ok: boolean }>("/api/game/state", {
      method: "PUT",
      cookie: gambitFourth.cookie,
      body: JSON.stringify({
        roomId: auditRoomId,
        data: { orderFills: auditFills },
      }),
    });
    const auditSeededRow = await db.gameState.findUnique({
      where: { userId_roomId: { userId: auditTargetId, roomId: auditRoomId } },
      select: { data: true },
    });
    const auditSeededData = auditSeededRow?.data
      ? (JSON.parse(auditSeededRow.data) as { orderFills?: unknown[] })
      : null;
    check(
      auditSeeded.status === 200 &&
        auditSeededData?.orderFills?.length === AUDIT_WINDOW,
      "the harness can hand a captain the manifest their audit is read from",
    );

    // A nomination is public: the room watches the count. Two of five is
    // not a majority, so the room hears who was named and no manifest
    // opens.
    auditSockets[1].emit("audit:vote", {
      roomId: auditRoomId,
      round: AUDIT_FROM_ROUND,
      targetUserId: auditTargetId,
    });
    await auditSettle();
    check(
      tallyFrames.length === auditSockets.length &&
        tallyFrames.every(
          (frame) => frame.votes[gambitSecond.id] === auditTargetId,
        ) &&
        revealFrames.length === 0,
      "a nomination reaches every captain in the harbor, and one of five opens nothing",
    );

    auditSockets[2].emit("audit:vote", {
      roomId: auditRoomId,
      round: AUDIT_FROM_ROUND,
      targetUserId: auditTargetId,
    });
    await auditSettle();
    check(
      tallyFrames.length === auditSockets.length * 2 &&
        revealFrames.length === 0,
      "two of five is still not a majority, so the count moves and the manifest stays shut",
    );

    // A nomination of a captain this harbor is not counting is dropped
    // rather than tallied: a majority is a share of this table, and a vote
    // counted for someone outside it would move a number with nobody
    // behind it.
    auditSockets[3].emit("audit:vote", {
      roomId: auditRoomId,
      round: AUDIT_FROM_ROUND,
      targetUserId: gambitSixth.id,
    });
    await auditSettle();
    check(
      tallyFrames.length === auditSockets.length * 2,
      "and a captain who is not in this harbor cannot be nominated into one",
    );

    // The third of five carries. What opens is the sample the seed draws
    // out of the manifest the captain filed, which is the property that
    // makes a reveal checkable rather than trusted: the server is the only
    // party that can read the record, but anyone holding it can arrive at
    // the identical two lines.
    const auditExpected = drawAudit(
      auditSeed(auditRoomId, auditVoyage, AUDIT_FROM_ROUND, auditTargetId),
      auditFills,
    );
    auditSockets[3].emit("audit:vote", {
      roomId: auditRoomId,
      round: AUDIT_FROM_ROUND,
      targetUserId: auditTargetId,
    });
    await auditSettle();
    check(
      tallyFrames.length === auditSockets.length * 3 &&
        revealFrames.length === auditSockets.length &&
        new Set(revealFrames.map((frame) => frame.socket)).size ===
          auditSockets.length,
      "the third of five carries: the count goes out and the manifest opens once on every socket",
    );
    check(
      revealFrames.every(
        (frame) =>
          JSON.stringify(frame.reveal?.fulfillments) ===
          JSON.stringify(auditExpected),
      ),
      "and the lines it opens are the sample the seed draws out of the record the captain filed",
    );
    check(
      revealFrames.every(
        (frame) =>
          frame.reveal?.roomId === auditRoomId &&
          frame.reveal?.round === AUDIT_FROM_ROUND &&
          frame.reveal?.target?.userId === auditTargetId &&
          frame.reveal?.target?.name === "Smoke gamb_d",
      ),
      "naming the harbor, the leg and the captain the majority named, by the name the table knows them by",
    );

    // What the reveal carries is its allow list read the other way round,
    // and that is a security property rather than a shape preference: the
    // same save holds this captain's Gold, their hold and their card, so
    // the check is that none of it came out with the manifest.
    //
    // [C1: the Larder and Short Rations] `larder` came out of this list
    // when C1 landed, and the change is worth reading closely because
    // pulling a word out of a sweep is exactly how a real leak would be
    // smuggled past one. The plan's audit clause names the Larder: the
    // reveal is two fulfillments plus the audited captain's current Larder,
    // and never the card, the Gold or the hold. So the word belongs in the
    // reveal and it is asserted below, positively and by shape, rather than
    // deleted and forgotten. Every other private word stays forbidden, and
    // the key list under this one is still exact, so a third field arriving
    // in the reveal is a failure whether or not anyone remembered to add
    // its name here.
    const auditBody = JSON.stringify({
      round: revealFrames[0]?.reveal?.round,
      target: revealFrames[0]?.reveal?.target,
      fulfillments: revealFrames[0]?.reveal?.fulfillments,
    }).toLowerCase();
    const auditForbidden = [
      "pirate",
      "broker",
      "honest",
      "traitor",
      "loyal",
      "role",
      "align",
      "card",
      "flourish",
      "ally",
      "gold",
      "purse",
      "hold",
      "inventory",
      "money",
      "score",
    ];
    check(
      auditForbidden.every((word) => !auditBody.includes(word)),
      "the reveal carries no alignment, no card, no Gold and no hold, word for word",
    );
    const auditRevealFrame = revealFrames[0]?.reveal;
    // The reveal's whole field list, one of exactly two shapes and never a
    // third. Which one depends on the provisions layer, which is read from
    // the frame itself rather than from this process's environment: the
    // harness and the server it is pointed at are two processes, and a
    // suite that assumed they shared a switch would pass here while lying
    // about a live deployment.
    const hasLarder = auditRevealFrame?.larder !== undefined;
    check(
      Object.keys(auditRevealFrame ?? {})
        .sort()
        .join(",") ===
        (hasLarder
          ? "fulfillments,larder,roomId,round,target"
          : "fulfillments,roomId,round,target"),
      "the reveal's fields are the plan's allow list and nothing else, with the Larder on it when the provisions layer is on",
    );
    check(
      !hasLarder ||
        (Number.isInteger(auditRevealFrame?.larder) &&
          (auditRevealFrame?.larder ?? -1) >= 0 &&
          (auditRevealFrame?.larder ?? -1) <= LARDER_MAX),
      "and the one number the reveal was always meant to open is a whole count inside the hold's own ends",
    );
    check(
      Object.keys(auditRevealFrame?.target ?? {})
        .sort()
        .join(",") === "name,userId" &&
        Object.keys(auditRevealFrame?.fulfillments?.[0] ?? {})
          .sort()
          .join(",") === "items,port,reward,round" &&
        Object.keys(auditRevealFrame?.fulfillments?.[0]?.items?.[0] ?? {})
          .sort()
          .join(",") === "qty,type",
      "and the frame's shape is that allow list, field for field",
    );

    // One audit a voyage. Nothing tells the room it is spent: a later
    // nomination, of anyone, is simply not the first one.
    auditSockets[4].emit("audit:vote", {
      roomId: auditRoomId,
      round: AUDIT_FROM_ROUND,
      targetUserId: gambitHost.id,
    });
    await auditSettle();
    check(
      tallyFrames.length === auditSockets.length * 3 &&
        revealFrames.length === auditSockets.length,
      "a harbor gets one audit a voyage: a later nomination changes nothing",
    );

    // The audit spends the leg's Parley, and the room leaves it the way a
    // room leaves every leg: every captain marks ready. What the server
    // does is tell the room what it found; the leaving is the clients',
    // and the ready votes below stand in for them. A server that emptied
    // the checkpoint's ready set on the room's behalf would move the
    // checkpoint while every client sat waiting to be told to move, which
    // is the one way to leave a harbor stuck forever, so what this
    // actually proves is that the vote left the room able to advance.
    const auditAdvances = auditSockets.map((socket) =>
      waitForEvent<{ roomId: string; round: number; phase: string }>(
        socket,
        "phase:advance",
        (payload) => payload?.roomId === auditRoomId,
      ),
    );
    for (const socket of auditSockets) {
      socket.emit("phase:ready", {
        roomId: auditRoomId,
        round: AUDIT_FROM_ROUND,
        phase: "parley",
      });
    }
    const auditLeft = await Promise.all(auditAdvances);
    check(
      auditLeft.every(
        (frame) =>
          frame?.round === AUDIT_FROM_ROUND && frame?.phase === "parley",
      ),
      "the room leaves the Parley the audit spent, carrying the checkpoint it was leaving",
    );

    // A captain who comes back after the vote sees what the harbor saw.
    // The finding is public because the room voted for it, and a table
    // arguing about an audit one of them cannot see is a table arguing
    // past each other.
    //
    // The reload is the path this hand-out actually serves, and the check
    // is written as one because a voyage in flight is closed to new seats
    // (see roomLockedFor): the same captain, a fresh socket, which is
    // what a client that comes back mid voyage opens.
    const auditReloadSocket = await openAuthedSocket(gambitFifth);
    run.sockets.push(auditReloadSocket);
    const handedReveal = waitForEvent<AuditReveal>(
      auditReloadSocket,
      "audit:reveal",
      (payload) => payload?.roomId === auditRoomId,
    );
    auditReloadSocket.emit("room:join", { roomId: auditRoomId });
    const auditHanded = await handedReveal;
    check(
      auditHanded?.target?.userId === auditTargetId &&
        JSON.stringify(auditHanded?.fulfillments) ===
          JSON.stringify(auditExpected),
      "a captain who reloads after the vote is handed the finding the harbor was shown",
    );
    await auditSettle();
    check(
      revealFrames.length === auditSockets.length,
      "and the captains who already saw it are not shown it twice",
    );

    // A restarted voyage has audited nobody, and that is the load bearing
    // half of the once per voyage rule: the reveal is the flag that spends
    // the audit, so a voyage that inherited one would find its own spent
    // before it began, and its first vote would vanish with no frame to
    // explain why.
    auditSockets[0].emit("room:restart", { roomId: auditRoomId });
    let auditReopened = await auditRoomRow();
    for (
      let waited = 0;
      (auditReopened?.currentRound !== 1 ||
        auditReopened?.currentPhase !== "harbor") &&
      waited < 5000;
      waited += 250
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      auditReopened = await auditRoomRow();
    }
    check(
      auditReopened?.currentRound === 1 &&
        auditReopened?.currentPhase === "harbor",
      "restarting the voyage reopens the harbor at its first checkpoint",
    );
    // The captain asking is one of the harbor's own, so the absence below
    // is the hand-out declining rather than the server refusing a stranger
    // the door: a captain who is not a member is turned away before any of
    // this and would prove nothing about the reveal.
    const auditRejoin = await openAuthedSocket(gambitFifth);
    run.sockets.push(auditRejoin);
    const staleReveal = waitForEvent<AuditReveal>(
      auditRejoin,
      "audit:reveal",
      (payload) => payload?.roomId === auditRoomId,
      1200,
    );
    auditRejoin.emit("room:join", { roomId: auditRoomId });
    check(
      (await staleReveal) === null,
      "and a harbor that has just reopened hands nobody the last voyage's finding",
    );

    console.log("\nMaroon, and the Harbormaster's hand");
    // [H7] The harbor's second vote, and the only thing in this game a
    // majority can take off one captain. From the mode's rung, once a
    // voyage, two thirds of the captains the room is still counting may put
    // one of them ashore: the ship and its hold go to the harbor, half the
    // Gold stays aboard, the seat stays at the table, and the captain is
    // handed the one power in the mode that is not about their own books.
    //
    // The checks come in the two halves the feature lives in, the way the
    // audit's do. What the vote takes, what it keeps, the market the hand
    // leans and the mark a failed settlement leaves are all pure, so they
    // are checked directly and to the Gold. The vote itself, and the leg
    // the power lands on, are checked over the wire against a real harbor,
    // because a majority that is not wired to the checkpoint it is called
    // from is a majority that never fires.

    // ---- What the harbor takes, and what it leaves ----
    check(
      modeConfig("ocean_gambit").maroonFrom === 9 &&
        modeConfig("classic").maroonFrom === null &&
        modeConfig("ocean_gambit").bankruptcyIsFinal === false &&
        modeConfig("classic").bankruptcyIsFinal === true,
      "the rung and the bankruptcy both belong to the mode: leg nine and a seat that keeps sailing in Ocean Gambit, and neither of them in Classic",
    );
    check(
      MAROON_SHARE === 0.5 && PORT_SHIFT_FRACTION === 0.1,
      "the harbor leaves half the purse aboard and leans a port by a tenth, which are the two numbers the plan names",
    );
    check(
      maroonKeptGold(100) === 50 &&
        maroonKeptGold(101) === 50 &&
        maroonKeptGold(3) === 1 &&
        maroonKeptGold(1) === 0,
      "a marooned captain keeps half their Gold, floored, so half of one coin is no coins at all",
    );
    check(
      maroonKeptGold(0) === 0 &&
        maroonKeptGold(-40) === 0 &&
        maroonKeptGold(Number.NaN) === 0,
      "and a captain with an empty purse, or with a figure that is not a number, keeps nothing rather than a negative",
    );

    // Two thirds, counted from the roster rather than from the votes. At six
    // the fraction lands on a whole seat and every reading of it agrees; at
    // three, strictly more than two thirds is unanimity, and unanimity is
    // not a vote.
    const nominations = (targets: string[]) =>
      new Map(targets.map((target, i) => [`voter-${i}`, target]));
    check(
      maroonCarried(nominations(["a", "a"]), 3) === "a" &&
        maroonCarried(nominations(["a"]), 3) === null,
      "two thirds of a table of three is two captains, so two carry the vote and one does not",
    );
    check(
      maroonCarried(nominations(["a", "a", "a"]), 6) === null &&
        maroonCarried(nominations(["a", "a", "a", "a"]), 6) === "a",
      "and three of six is not two thirds of six while four is, which is the pair the audit's simple majority never draws",
    );
    check(
      maroonCarried(nominations(["a", "a", "a", "b", "b", "b"]), 6) === null &&
        maroonCarried(new Map(), 6) === null &&
        maroonCarried(nominations(["a"]), 0) === null,
      "a room split down the middle puts nobody ashore, and neither does a room with no votes in it or no seats at all",
    );

    // ---- The port the hand leans ----
    check(
      portShiftMultiplier(
        { port: "Quanzhou Port", direction: 1 },
        "Quanzhou Port",
      ) ===
        1 + PORT_SHIFT_FRACTION &&
        portShiftMultiplier(
          { port: "Quanzhou Port", direction: -1 },
          "Quanzhou Port",
        ) ===
          1 - PORT_SHIFT_FRACTION,
      "a port the Harbormaster leaned is priced a tenth up or a tenth down",
    );
    check(
      portShiftMultiplier(
        { port: "Ningbo Port", direction: 1 },
        "Quanzhou Port",
      ) === 1 && portShiftMultiplier(null, "Quanzhou Port") === 1,
      "and every other port on the same card, and every port on a leg nobody called, is priced exactly as it always was",
    );
    check(
      normalizePortShift({ port: "Quanzhou Port", direction: -1 })
        ?.direction === -1 &&
        normalizePortShift({ port: "Quanzhou Port", direction: 1 })?.port ===
          "Quanzhou Port",
      "a call a client saved is read back as a port and a direction",
    );
    check(
      [
        null,
        "Quanzhou Port",
        [],
        {},
        { port: "", direction: 1 },
        { port: "Quanzhou Port", direction: 0 },
        { port: "Quanzhou Port", direction: 2 },
        { port: "Quanzhou Port", direction: "1" },
      ].every((saved) => normalizePortShift(saved) === null),
      "and a save that is not a call, or names no port, or leans by something that is not a tenth one way or the other, reads as a voyage where nothing was ever called",
    );

    const leanLine = portShiftLine({ port: "Quanzhou Port", direction: 1 });
    check(
      leanLine === "Quanzhou Port: every price 10 percent higher" &&
        portShiftLine({ port: "Ningbo Port", direction: -1 }) ===
          "Ningbo Port: every price 10 percent lower",
      "a call reads as one clause naming the port, the tenth and the way it moves, with no arithmetic left in the words",
    );
    check(
      !CARRIES_A_DASH.test(leanLine),
      "and carries no dash of any kind, which is the house rule for every string a captain reads",
    );

    // ---- The two ways a seat fails ----
    // Run against a real state rather than described, because the whole of
    // the mode's fourth pillar is the difference between these two lines.
    const classicFailure = createInitialGameState({ mode: "classic" });
    failSeat(classicFailure, []);
    check(
      classicFailure.bankrupt &&
        classicFailure.gameOver &&
        classicFailure.phase === "bankruptcy",
      "in Classic a captain who cannot pay is bankrupt, out of the voyage and standing on the bankruptcy screen",
    );
    const gambitFailure = createInitialGameState({ mode: "ocean_gambit" });
    const gambitFailureLogs: string[] = [];
    failSeat(gambitFailure, gambitFailureLogs);
    check(
      gambitFailure.bankrupt &&
        !gambitFailure.gameOver &&
        gambitFailure.phase !== "bankruptcy",
      "in Ocean Gambit the same failure marks the name and leaves the captain at the table with the voyage running",
    );
    failSeat(gambitFailure, gambitFailureLogs);
    check(
      gambitFailureLogs.filter((line) => line.includes("Bankrupt")).length ===
        1,
      "and the mark is written and said once, however many settlements the captain goes on to fail",
    );

    // The vote, applied to a real seat. Everything on the ship goes with
    // it, and the two modules below are the ones that carry a lasting
    // surcharge, installed through the draft the way a captain installs
    // them, so that the check after the vote is that the harbor taking the
    // hull takes their cost off the books with it.
    const maroonedSeat = createInitialGameState({
      mode: "ocean_gambit",
      difficulty: "monsoon",
    });
    maroonedSeat.money = 101;
    maroonedSeat.shipLevel = 2;
    maroonedSeat.inventory.Tea = 6;
    maroonedSeat.inventory.Brocade = 2;
    const heldModules = MODULES.filter((mod) =>
      ["bulk_hauler", "overdrive_engine"].includes(mod.id),
    );
    maroonedSeat._draftChoices = heldModules;
    const seatLogs: string[] = [];
    // Every pick is taken at the head of the batch rather than by counting
    // through it, because a direct install drops its own pick from the
    // pool: the second module a captain takes from a fresh draft of two is
    // the first one left in it.
    heldModules.forEach(() => handleModuleSelect(maroonedSeat, 0, seatLogs));
    check(
      maroonedSeat.equippedModules.length === 2 &&
        maroonedSeat.shipUpgradePenalty === 15 &&
        maroonedSeat.maintenancePenalty === 10,
      "a captain with a hold and a hull of two modules installed starts with the surcharges those two modules carry",
    );
    maroonSeat(maroonedSeat, seatLogs);
    check(
      maroonedSeat.money === 50 &&
        maroonedSeat.marooned &&
        maroonedSeat.shipLevel === 0 &&
        maroonedSeat.equippedModules.length === 0 &&
        Object.values(maroonedSeat.inventory).every((count) => count === 0),
      "the harbor taking the ship takes the slots, the hold and half the Gold, and leaves the captain the rest of the purse and their seat",
    );
    check(
      maroonedSeat.shipUpgradePenalty === 0 &&
        maroonedSeat.maintenancePenalty === 0,
      "and the surcharges those modules charged for as long as they were bolted on come off with them",
    );
    const keptAfterTheVote = maroonedSeat.money;
    maroonSeat(maroonedSeat, seatLogs);
    check(
      maroonedSeat.money === keptAfterTheVote,
      "and applying the vote twice takes nothing the second time, which is what a replayed broadcast needs it to do",
    );

    // ---- The market the hand lands on ----
    // The same leg drawn twice from one seed, for two captains who differ in
    // one thing only: one of them is standing under a call. The cards have
    // to come out identical and only the leaned port's prices may move,
    // which is also what proves the power is a price rather than a second
    // market nobody else can see.
    const marketCtx = { seedBase: "harbor-a:captain-a", harborId: "harbor-a" };
    const marketUnder = (shift: PortShift | null) => {
      const state = createInitialGameState({
        mode: "ocean_gambit",
        difficulty: "monsoon",
      });
      applyPortShift(state, shift);
      snapToCheckpoint(state, marketCtx, 10, "1", []);
      return state;
    };
    const plainMarket = marketUnder(null);
    // The leaning port is read off a drawn market rather than named, so the
    // check below is against a card that is really there. It is the port of
    // the dearest raw good on the board, because a tenth of a price that is
    // already high is a price that moves: a tenth of four Gold rounds away
    // and would leave the comparison asserting nothing.
    const dearestRaw = plainMarket.resourceCards
      .filter((card) => !card.isProductCard)
      .map((card) => ({
        port: card.port,
        top: Math.max(...card.resources.map((r) => r.price ?? 0)),
      }))
      .sort((a, b) => b.top - a.top)[0];
    const leaningPort = dearestRaw?.port ?? "";
    const leanedUpMarket = marketUnder({ port: leaningPort, direction: 1 });
    const leanedDownMarket = marketUnder({ port: leaningPort, direction: -1 });

    check(
      plainMarket.resourceCards.length > 1 &&
        dearestRaw !== undefined &&
        dearestRaw.top > 4,
      "a leg's board is dealt the same cards whoever is looking at it, and the port these checks lean is one with a real price at it",
    );
    const sameDraw = plainMarket.resourceCards.every((card, i) => {
      const other = leanedUpMarket.resourceCards[i];
      return (
        other.port === card.port &&
        other.isProductCard === card.isProductCard &&
        other.resources.length === card.resources.length &&
        card.resources.every(
          (r, j) =>
            other.resources[j].type === r.type &&
            other.resources[j].quantity === r.quantity,
        )
      );
    });
    check(
      sameDraw,
      "the same ports, the same goods and the same counts, so the hand moves a price and never the market",
    );
    const pricedByTheLean = (market: GameState, direction: 1 | -1) =>
      plainMarket.resourceCards.every((card, i) => {
        const priced = market.resourceCards[i];
        const leans = !card.isProductCard && card.port === leaningPort;
        return card.resources.every((r, j) => {
          const drawn = r.price ?? 0;
          const underTheLean = Math.max(
            1,
            Math.round(drawn * (1 + direction * PORT_SHIFT_FRACTION)),
          );
          return priced.resources[j].price === (leans ? underTheLean : drawn);
        });
      });
    check(
      pricedByTheLean(leanedUpMarket, 1) &&
        pricedByTheLean(leanedDownMarket, -1),
      "and every price at the port under the call is a tenth up or a tenth down, floored at one Gold, while every card at every other port is untouched",
    );

    // ---- The vote, in a real harbor ----
    // Six captains, and a Monsoon charter, for two reasons that are both
    // about the numbers rather than about the voyage. Six is the smallest
    // table where two thirds is its own number rather than a rephrasing of
    // unanimity, and it is the table the plan's own arithmetic is drawn at.
    // Monsoon because its charter opens late enough that leg ten still has
    // ports the room cannot see, which is what lets a call be refused for
    // naming one.
    type AdvanceFrame = {
      roomId: string;
      round: number;
      phase: string;
      portShift?: PortShift | null;
    };
    const maroonRoom = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: gambitHost.cookie,
        body: JSON.stringify({
          name: `Smoke maroon ${suffix}`,
          isPublic: false,
          mode: "ocean_gambit",
          unlock: LEDGER_PHRASE,
          difficulty: "monsoon",
        }),
      },
    );
    if (maroonRoom.status !== 200) {
      throw new Error("No six captain harbor to put a captain ashore in.");
    }
    const maroonRoomId = maroonRoom.body.room.id;
    const maroonCrew = [
      gambitSecond,
      gambitThird,
      gambitFourth,
      gambitFifth,
      gambitSixth,
    ];
    const maroonSeats = await Promise.all(
      maroonCrew.map((captain) =>
        call<{ room: { id: string } }>("/api/rooms/join", {
          method: "POST",
          cookie: captain.cookie,
          body: JSON.stringify({ code: maroonRoom.body.room.code }),
        }),
      ),
    );
    check(
      maroonSeats.every((join) => join.status === 200),
      "six captains can sit at the table a maroon is called from",
    );

    const maroonSockets: Socket[] = [];
    for (const captain of [gambitHost, ...maroonCrew]) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      const takenASeat = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === maroonRoomId,
      );
      socket.emit("room:join", { roomId: maroonRoomId });
      await takenASeat;
      maroonSockets.push(socket);
    }

    // The captain the harbor puts ashore and the captain it has already
    // written off are two different seats on purpose. The second is the one
    // a nomination has to be dropped for, and the first is the one the room
    // has to go on counting, since a marooned seat sails on with everyone
    // else.
    const maroonTargetId = gambitFifth.id;
    const maroonMarkedId = gambitSixth.id;

    const maroonTallies: Array<{
      round: number;
      votes: Record<string, string>;
    }> = [];
    const maroonResults: MaroonResult[] = [];
    const maroonCalls: PortShiftNotice[] = [];
    const maroonReadyStates: Array<{
      round: number;
      phase: string;
      requiredUserIds: string[];
    }> = [];
    maroonSockets.forEach((socket) => {
      socket.on(
        "maroon:tally",
        (payload: { round?: number; votes?: Record<string, string> }) => {
          maroonTallies.push({
            round: payload?.round ?? 0,
            votes: payload?.votes ?? {},
          });
        },
      );
      socket.on("maroon:result", (payload: MaroonResult) =>
        maroonResults.push(payload),
      );
      socket.on("maroon:shift", (payload: PortShiftNotice) =>
        maroonCalls.push(payload),
      );
      socket.on(
        "phase:ready_update",
        (payload: {
          round: number;
          phase: string;
          requiredUserIds: string[];
        }) => maroonReadyStates.push(payload),
      );
    });
    const maroonSettle = () =>
      new Promise((resolve) => setTimeout(resolve, 400));

    // The first way a nomination is dropped is the oldest one: there is no
    // voyage yet, so there is no checkpoint to call a vote from.
    maroonSockets[1].emit("maroon:vote", {
      roomId: maroonRoomId,
      round: 9,
      targetUserId: maroonTargetId,
    });
    await maroonSettle();
    check(
      maroonTallies.length === 0,
      "a nomination in a harbor that has not set sail is refused",
    );

    const maroonDeparture = maroonSockets.map((socket) =>
      waitForEvent<{ roomId: string }>(
        socket,
        "room:started",
        (payload) => payload?.roomId === maroonRoomId,
      ),
    );
    maroonSockets[0].emit("room:start", { roomId: maroonRoomId });
    await Promise.all(maroonDeparture);

    // Nothing here is special to the maroon: a harbor reaches a leg the way
    // it reaches every leg, by one captain reporting where they stand and
    // the room's checkpoint following the furthest report.
    const maroonRoomRow = () =>
      db.room.findUnique({
        where: { id: maroonRoomId },
        select: { currentRound: true, currentPhase: true, voyageEpoch: true },
      });
    // The phase is typed as the engine's own, so a checkpoint this suite
    // walks the room onto is one of the values the room actually gates. It
    // is still a string on the wire, which is what the two older names in
    // the leg clock section below are about.
    const parkMaroonCheckpoint = async (
      round: number,
      phase: Phase,
      phaseLabel: string,
    ) => {
      maroonSockets[1].emit("game:status", {
        roomId: maroonRoomId,
        round,
        phase,
        phaseLabel,
        gold: 120,
        reputation: 12,
        shipLevel: 0,
        gameOver: false,
        renownLevel: 3,
      });
      let row = await maroonRoomRow();
      for (
        let waited = 0;
        (row?.currentRound !== round || row?.currentPhase !== phase) &&
        waited < 5000;
        waited += 250
      ) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        row = await maroonRoomRow();
      }
      return row;
    };

    const beforeTheRung = await parkMaroonCheckpoint(8, "parley", "Parley");
    check(
      beforeTheRung?.currentRound === 8 &&
        beforeTheRung?.currentPhase === "parley",
      "and once it has sailed the room can be walked to the leg before the rung",
    );
    maroonSockets[1].emit("maroon:vote", {
      roomId: maroonRoomId,
      round: 8,
      targetUserId: maroonTargetId,
    });
    await maroonSettle();
    check(
      maroonTallies.length === 0,
      "a nomination for a leg before the mode's rung is refused, so the vote belongs to the back half of a voyage",
    );

    const atTheRung = await parkMaroonCheckpoint(9, "parley", "Parley");
    check(
      atTheRung?.currentRound === 9 && atTheRung?.currentPhase === "parley",
      "the room's checkpoint is at leg nine's Parley, which is where the vote is called from",
    );

    // The captain the harbor has already written off. The mark travels the
    // way every other fact about a seat travels, on a status, and it stays
    // in the roster: a bankrupt captain still holds a card, which is what
    // makes the arithmetic below a count of six.
    maroonSockets[5].emit("game:status", {
      roomId: maroonRoomId,
      round: 9,
      phase: "parley",
      phaseLabel: "Parley",
      gold: 0,
      reputation: 4,
      shipLevel: 0,
      gameOver: false,
      renownLevel: 3,
      bankrupt: true,
    });
    await maroonSettle();

    maroonSockets[1].emit("maroon:vote", {
      roomId: maroonRoomId,
      round: 9,
      targetUserId: run.guest.id,
    });
    await maroonSettle();
    check(
      maroonTallies.length === 0,
      "a captain who is not in this harbor cannot be nominated into one",
    );

    maroonSockets[1].emit("maroon:vote", {
      roomId: maroonRoomId,
      round: 9,
      targetUserId: maroonMarkedId,
    });
    await maroonSettle();
    check(
      maroonTallies.length === 0,
      "and a captain the harbor has already written off cannot be put ashore, since the vote would be arming a captain whose race is already run",
    );

    // The count, at the table. Four of six is what carries it, and the
    // three votes before that are the plan's own arithmetic rather than a
    // build up to the interesting one.
    maroonSockets[1].emit("maroon:vote", {
      roomId: maroonRoomId,
      round: 9,
      targetUserId: maroonTargetId,
    });
    await maroonSettle();
    check(
      maroonTallies.length === maroonSockets.length &&
        maroonTallies.every(
          (tally) => tally.votes[gambitSecond.id] === maroonTargetId,
        ) &&
        maroonResults.length === 0,
      "a nomination reaches every captain in the harbor, and one of six opens nothing",
    );

    maroonSockets[2].emit("maroon:vote", {
      roomId: maroonRoomId,
      round: 9,
      targetUserId: maroonTargetId,
    });
    await maroonSettle();
    check(
      maroonTallies.length === maroonSockets.length * 2 &&
        maroonResults.length === 0,
      "two of six is a third of the table and still nothing",
    );

    maroonSockets[3].emit("maroon:vote", {
      roomId: maroonRoomId,
      round: 9,
      targetUserId: maroonTargetId,
    });
    await maroonSettle();
    check(
      maroonTallies.length === maroonSockets.length * 3 &&
        maroonResults.length === 0,
      "and three of six is half of it, which the plan's arithmetic says is not two thirds",
    );

    maroonSockets[4].emit("maroon:vote", {
      roomId: maroonRoomId,
      round: 9,
      targetUserId: maroonTargetId,
    });
    await maroonSettle();
    check(
      maroonResults.length === maroonSockets.length &&
        maroonResults.every(
          (result) =>
            result.roomId === maroonRoomId &&
            result.round === 9 &&
            result.target.userId === maroonTargetId &&
            // The harness's own display name, which is the half of the
            // frame the room reads: who was put ashore, and nothing about
            // what it cost them.
            result.target.name === "Smoke gamb_e",
        ),
      "four of six carries it, and the harbor hears who was put ashore and nothing at all about their books",
    );

    maroonSockets[0].emit("maroon:vote", {
      roomId: maroonRoomId,
      round: 9,
      targetUserId: gambitSecond.id,
    });
    await maroonSettle();
    check(
      maroonTallies.length === maroonSockets.length * 4 &&
        maroonResults.length === maroonSockets.length,
      "and the vote is spent: a harbor cannot put a second captain ashore in one voyage",
    );

    // ---- The call, and the ports it may name ----
    // The charter's edge is derived rather than typed out, so the refusal
    // below is of a port this room really cannot see on the leg the market
    // lands on.
    const maroonPorts = unlockedPorts("monsoon", 10);
    const firstCallPort = maroonPorts[0];
    const secondCallPort = maroonPorts[maroonPorts.length - 1];
    const lockedCallPort =
      PORTS_TIER2.find((port) => !maroonPorts.includes(port)) ?? "";
    check(
      maroonPorts.length >= 2 && Boolean(lockedCallPort),
      "leg ten of a Monsoon charter has ports the room can see and ports it cannot, which is what the refusals below are read against",
    );

    maroonSockets[0].emit("maroon:shift", {
      roomId: maroonRoomId,
      round: 9,
      port: firstCallPort,
      direction: 1,
    });
    await maroonSettle();
    check(
      maroonCalls.length === 0,
      "a captain the harbor did not maroon has no hand on the market, whatever they send",
    );

    maroonSockets[4].emit("maroon:shift", {
      roomId: maroonRoomId,
      round: 9,
      port: firstCallPort,
      direction: 0,
    });
    maroonSockets[4].emit("maroon:shift", {
      roomId: maroonRoomId,
      round: 9,
      port: lockedCallPort,
      direction: 1,
    });
    maroonSockets[4].emit("maroon:shift", {
      roomId: maroonRoomId,
      round: 9,
      port: "Nowhere Port",
      direction: 1,
    });
    await maroonSettle();
    check(
      maroonCalls.length === 0,
      "and the captain who was marooned may lean a port by a tenth up or down and nothing else: not zero, not a port the charter has not opened, and not a port that does not exist",
    );

    maroonSockets[4].emit("maroon:shift", {
      roomId: maroonRoomId,
      round: 9,
      port: firstCallPort,
      direction: 1,
    });
    await maroonSettle();
    check(
      maroonCalls.length === maroonSockets.length &&
        maroonCalls.every(
          (call) =>
            call.round === 9 &&
            call.port === firstCallPort &&
            call.direction === 1 &&
            call.by.userId === maroonTargetId &&
            call.by.name === "Smoke gamb_e",
        ),
      "a call by a marooned captain is public: the room hears the port, the direction and the hand that named them",
    );

    // A Harbormaster who changes their mind in front of the table has done
    // what the mode asked, and the last word before the market opens is the
    // one that lands.
    maroonSockets[4].emit("maroon:shift", {
      roomId: maroonRoomId,
      round: 9,
      port: secondCallPort,
      direction: -1,
    });
    await maroonSettle();
    check(
      maroonCalls.length === maroonSockets.length * 2 &&
        maroonCalls[maroonSockets.length].port === secondCallPort &&
        maroonCalls[maroonSockets.length].direction === -1,
      "a second call in the same leg replaces the first rather than being refused, and both are read by the room",
    );

    // ---- The leg the hand lands on ----
    const maroonReadyAll = (round: number, phase: Phase) => {
      for (const socket of maroonSockets) {
        socket.emit("phase:ready", { roomId: maroonRoomId, round, phase });
      }
    };
    const nextMaroonAdvance = (from: number) =>
      waitForEvent<AdvanceFrame>(
        maroonSockets[0],
        "phase:advance",
        (payload) =>
          payload?.roomId === maroonRoomId && payload?.round === from,
        5000,
      );

    const beforeTheMarket = await parkMaroonCheckpoint(10, "dawn", "Dawn");
    check(
      beforeTheMarket?.currentRound === 10 &&
        beforeTheMarket?.currentPhase === "dawn",
      "the next checkpoint the room reaches is leg ten's boon draft, which is the step that opens its market",
    );
    const marketAdvance = nextMaroonAdvance(10);
    maroonReadyAll(10, "dawn");
    const atTheMarket = await marketAdvance;
    check(
      atTheMarket?.portShift?.port === secondCallPort &&
        atTheMarket?.portShift?.direction === -1,
      "and the market that opens there is priced against the call the Harbormaster made in the leg before it, which is the last one of the two",
    );

    // The seat survived the vote, which is the pillar the mode is built on
    // rather than a mercy: the leg the room left after the maroon still
    // waited for the captain it had put ashore.
    check(
      maroonReadyStates.some(
        (state) =>
          state.round === 10 && state.requiredUserIds.includes(maroonTargetId),
      ),
      "the room counted the marooned seat the whole way: the leg ten advance waited on the captain it had just put ashore",
    );

    maroonSockets[4].emit("maroon:shift", {
      roomId: maroonRoomId,
      round: 10,
      port: firstCallPort,
      direction: 1,
    });
    await maroonSettle();
    check(
      maroonCalls.length === maroonSockets.length * 2,
      "and the hand itself is a Parley power: a captain away from the table cannot lean the market they are standing in front of",
    );

    const afterTheMarket = await parkMaroonCheckpoint(11, "dawn", "Dawn");
    const clearAdvance = nextMaroonAdvance(11);
    maroonReadyAll(11, "dawn");
    const clearedMarket = await clearAdvance;
    check(
      afterTheMarket?.currentRound === 11 &&
        clearedMarket !== null &&
        "portShift" in clearedMarket &&
        clearedMarket.portShift === null,
      "the market after that one is priced as though nobody had ever called, because a hand that is not sent again is a hand that has to be taken off",
    );

    // A captain who comes back into a harbor that has already voted sees
    // what the room saw. The reload is the path this hand out serves, and a
    // voyage in flight is closed to new seats, so it is the same captain on
    // a fresh socket, which is what a client that comes back opens.
    const maroonReload = await openAuthedSocket(gambitFifth);
    run.sockets.push(maroonReload);
    const handedResult = waitForEvent<MaroonResult>(
      maroonReload,
      "maroon:result",
      (payload) => payload?.roomId === maroonRoomId,
    );
    const handedCall = waitForEvent<PortShiftNotice>(
      maroonReload,
      "maroon:shift",
      (payload) => payload?.roomId === maroonRoomId,
    );
    maroonReload.emit("room:join", { roomId: maroonRoomId });
    const [reloadedResult, reloadedCall] = await Promise.all([
      handedResult,
      handedCall,
    ]);
    check(
      reloadedResult?.target.userId === maroonTargetId &&
        reloadedCall?.port === secondCallPort,
      "a captain who reloads after the vote is handed the vote the harbor made and the call it produced",
    );

    // Once a leg rather than once a voyage: the power is the seat's, and the
    // seat sails on. The next Parley is the next leg, and a call made there
    // is a call the leg after it is priced against.
    const nextParley = await parkMaroonCheckpoint(11, "parley", "Parley");
    check(
      nextParley?.currentRound === 11 && nextParley?.currentPhase === "parley",
      "and the voyage reaches the next leg's Parley, with the marooned captain still in it",
    );
    maroonSockets[4].emit("maroon:shift", {
      roomId: maroonRoomId,
      round: 11,
      port: firstCallPort,
      direction: 1,
    });
    await maroonSettle();
    check(
      maroonCalls.length === maroonSockets.length * 3 &&
        maroonCalls[maroonSockets.length * 2].round === 11,
      "and every leg after the vote, the Harbormaster may lean one port once more",
    );

    // The one leg the console is hidden on. A call leans the market that
    // opens after the leg it was made in, so the closing leg of a voyage is
    // a call that would lean nothing.
    const closingLeg = await parkMaroonCheckpoint(16, "parley", "Parley");
    check(
      closingLeg?.currentRound === 16 && closingLeg?.currentPhase === "parley",
      "the voyage can be walked to its closing leg, the sixteenth of a Monsoon charter",
    );
    maroonSockets[4].emit("maroon:shift", {
      roomId: maroonRoomId,
      round: 16,
      port: firstCallPort,
      direction: 1,
    });
    await maroonSettle();
    check(
      maroonCalls.length === maroonSockets.length * 3,
      "where the hand is refused as well, since a market that never opens is not a market to lean",
    );

    // A restarted voyage has marooned nobody, which is the load bearing half
    // of the once per voyage rule: the result is what spends the vote, so a
    // voyage that inherited one would find its own spent before it began,
    // and its first vote would vanish with no frame to explain why.
    maroonSockets[0].emit("room:restart", { roomId: maroonRoomId });
    let maroonReopened = await maroonRoomRow();
    for (
      let waited = 0;
      (maroonReopened?.currentRound !== 1 ||
        maroonReopened?.currentPhase !== "harbor") &&
      waited < 5000;
      waited += 250
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      maroonReopened = await maroonRoomRow();
    }
    check(
      maroonReopened?.currentRound === 1 &&
        maroonReopened?.currentPhase === "harbor",
      "restarting the voyage reopens the harbor at its first checkpoint",
    );
    const maroonRejoin = await openAuthedSocket(gambitFifth);
    run.sockets.push(maroonRejoin);
    const staleResult = waitForEvent<MaroonResult>(
      maroonRejoin,
      "maroon:result",
      (payload) => payload?.roomId === maroonRoomId,
      1200,
    );
    const staleCall = waitForEvent<PortShiftNotice>(
      maroonRejoin,
      "maroon:shift",
      (payload) => payload?.roomId === maroonRoomId,
      1200,
    );
    maroonRejoin.emit("room:join", { roomId: maroonRoomId });
    check(
      (await Promise.all([staleResult, staleCall])).every(
        (frame) => frame === null,
      ),
      "and a harbor that has just reopened hands nobody the last voyage's maroon, so its own vote is still there to call",
    );

    console.log("\nThe reveal and the replay ledger");
    // H8, and the reason the mode is worth playing: a voyage spends an
    // hour defending one secret and then turns every card face up at once.
    // This section sails a harbor of its own to watch that happen, and it
    // has to be one of its own. A reveal names every alignment at its
    // table, which is exactly what the sweep in the private information
    // spine above forbids in the harbor that sweep is watching, so putting
    // the two in one room would mean weakening the sharpest check in this
    // file to make room for the feature that needs the rule relaxed.
    //
    // The hand is written rather than drawn, the way the fleet commission's
    // section writes its own, so every verdict below is known before the
    // voyage ends. Five seats cover what the ledger has to get right: every
    // card the deck holds, a seat the hand never reached, and a finish the
    // integrity pass refuses to read.

    const revHonest = await signUp("revhon");
    const revPirate = await signUp("revpir");
    const revBroker = await signUp("revbro");
    const revNew = await signUp("revnew");
    const revForged = await signUp("revfake");
    const revCrew = [revHonest, revPirate, revBroker, revNew, revForged];
    run.extraAccounts.push(...revCrew);

    const revRoom = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: revHonest.cookie,
        body: JSON.stringify({
          name: `Smoke reveal harbor ${suffix}`,
          isPublic: false,
          mode: "ocean_gambit",
          unlock: LEDGER_PHRASE,
        }),
      },
    );
    if (revRoom.status !== 200) {
      throw new Error("No reveal harbor to test with, stopping here.");
    }
    const revRoomId = revRoom.body.room.id;
    const revTaken = await Promise.all(
      revCrew.slice(1).map((captain) =>
        call<{ room: { id: string } }>("/api/rooms/join", {
          method: "POST",
          cookie: captain.cookie,
          body: JSON.stringify({ code: revRoom.body.room.code }),
        }),
      ),
    );
    check(
      revTaken.every((seat) => seat.status === 200),
      "five captains take a harbor of their own to watch the cards come down in",
    );

    // Every socket listens for the reveal from the moment it takes its
    // seat, and each seat's copies are kept apart, so the frame under test
    // is one this harbor actually broadcast to this captain rather than
    // one asked for afterwards.
    const revSockets: Socket[] = [];
    const revSeen = new Map<string, WireReveal[]>();
    for (const captain of revCrew) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      revSeen.set(captain.id, []);
      socket.on("voyage:reveal", (payload: WireReveal) => {
        revSeen.get(captain.id)?.push(payload);
      });
      const seatedHere = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === revRoomId,
      );
      socket.emit("room:join", { roomId: revRoomId });
      await seatedHere;
      revSockets.push(socket);
    }
    const revHeld = () => [...revSeen.values()].flat();

    // The voyage sets sail, which deals the harbor a hand and pins its size
    // the way any real voyage does. What that hand is does not matter
    // below, because every card in it is overwritten a few lines down.
    revSockets[0].emit("room:start", { roomId: revRoomId });
    await new Promise((resolve) => setTimeout(resolve, 800));
    check(
      (await db.voyageRole.count({ where: { roomId: revRoomId } })) ===
        revCrew.length,
      "the departure deals this harbor one card per seat",
    );
    check(
      revHeld().length === 0,
      "and a voyage in flight tells the room nothing about any of them, however loud its own ending will be",
    );

    // The commission this harbor is working on, drawn here the way every
    // client draws it: from the room's own id, epoch and pinned size, with
    // no captain's name anywhere in the seed. The flourish comes off that
    // commission's own deck for the same reason, since a goal about the
    // goods a fleet is not being asked for is a goal the mode never deals.
    const revRoomRow = await db.room.findUnique({
      where: { id: revRoomId },
      select: { voyageEpoch: true, voyageSeats: true },
    });
    const revSeatCount = revRoomRow?.voyageSeats ?? 0;
    const revObjective = drawObjective(
      objectiveSeed(revRoomId, revRoomRow?.voyageEpoch ?? 0, revSeatCount),
      revSeatCount,
    );
    const revFlourish = flourishDeck(revObjective.id)[0];
    const revSet = (
      userId: string,
      role: string,
      flourish: string | null = null,
    ) =>
      db.voyageRole.upsert({
        where: { roomId_userId: { roomId: revRoomId, userId } },
        create: { roomId: revRoomId, userId, role, flourish },
        update: { role, flourish },
      });
    await revSet(revHonest.id, "honest", revFlourish.id);
    await revSet(revPirate.id, "pirate");
    await revSet(revBroker.id, "broker");
    await revSet(revForged.id, "honest");
    // And the seat the hand never reached. The departure dealt them a card
    // like everybody else, so this is a deal being taken back rather than a
    // row that was never written: a captain who takes a berth after the
    // cards are down is a captain the mode has nothing to say about, and
    // the ledger has to be able to draw that seat.
    await db.voyageRole.deleteMany({
      where: { roomId: revRoomId, userId: revNew.id },
    });
    check(
      (await db.voyageRole.count({ where: { roomId: revRoomId } })) ===
        revCrew.length - 1,
      "and one of the five is taken back, leaving a table of five with four cards on it",
    );

    // The commission's own goods, so every figure below is one the board
    // could have carried. What a leg is short by is read off the drawn
    // commission rather than written down, because the quotas scale with
    // the fleet that was dealt them, and a hard coded number would be a
    // full delivery at one table size and short of it at another.
    //
    // The two captains who keep a trace disagree about what the fleet had
    // handed over, which is the case the merge exists for: their clients
    // wrote the harbor's number down at different moments, and the ledger
    // reads the higher of the two at every leg.
    const [revA, revB] = revObjective.resources;
    const revShortA = Math.max(0, revA.required - 1);
    const revShortB = Math.max(0, revB.required - 1);
    const revTrace = (
      early: Record<string, number>,
      late: Record<string, number>,
    ) => [
      { round: 1, at: Date.now(), delivered: early },
      { round: 3, at: Date.now(), delivered: late },
    ];
    const revSave = (cookie: string, data: Record<string, unknown>) =>
      call<{ ok: boolean }>("/api/game/state", {
        method: "PUT",
        cookie,
        body: JSON.stringify({ roomId: revRoomId, data }),
      });
    // The merchant's record ends with one good filled and none of the
    // second, which is a commission the fleet fell short of, and a short
    // commission is the one thing that decides the Pirate's voyage. The
    // met flag is read from this captain's own last recorded leg, so the
    // shortfall is arranged here rather than hoped for.
    const revFilled = await revSave(revHonest.cookie, {
      objectiveDelivered: { [revA.type]: revA.required },
      objectiveTrace: revTrace(
        { [revA.type]: 2 },
        { [revA.type]: revA.required },
      ),
      // An order fulfillment, so the ledger has a trade with a name, a leg
      // and a port on it rather than only a total.
      orderFills: [
        {
          round: 2,
          port: unlockedPorts("monsoon", 2)[0],
          items: [{ type: revA.type, qty: 2 }],
          reward: 40,
        },
      ],
    });
    const revBehind = await revSave(revPirate.cookie, {
      objectiveTrace: revTrace(
        { [revA.type]: 4 },
        { [revA.type]: revShortA, [revB.type]: revShortB },
      ),
    });
    // The ledger a Broker's verdict turns on, which is the one ending
    // figure a client is trusted for.
    const revBrokerHand = await revSave(revBroker.cookie, {
      peerTradeProfit: BROKER_PAYOUT_TARGET,
    });
    // And the forger's own record, which is written for one reason: the
    // ledger has to be seen dropping a book it could have read. With no
    // save on this row the two fields asserted below would be empty
    // because there was nothing to read rather than because the forgery
    // was refused, which is a check that cannot fail.
    const revForgedSave = await revSave(revForged.cookie, {
      objectiveDelivered: { [revA.type]: revA.required },
      peerTradeProfit: BROKER_PAYOUT_TARGET + 500,
      orderFills: [
        {
          round: 4,
          port: unlockedPorts("monsoon", 4)[0],
          items: [{ type: revA.type, qty: 3 }],
          reward: 60,
        },
      ],
    });
    const revForgedRow = await db.gameState.findUnique({
      where: { userId_roomId: { userId: revForged.id, roomId: revRoomId } },
      select: { data: true },
    });
    check(
      revFilled.status === 200 &&
        revBehind.status === 200 &&
        revBrokerHand.status === 200 &&
        revForgedSave.status === 200,
      "and the harbor's own clients have a record of the commission to read back",
    );
    check(
      revForgedRow?.data?.includes(String(BROKER_PAYOUT_TARGET + 500)) === true,
      "including the forger's, whose book really did reach the row the ledger would have read it from",
    );

    // A finish no voyage could have produced, proved here rather than
    // assumed. The number below is the fixture's, and the ceilings the
    // pass derives from the live game data are orders of magnitude under
    // it at any voyage length, so the disqualification further down is the
    // rule deciding rather than this table's difficulty happening to hide
    // a forgery that was not one.
    const revImpossible = checkSave({ money: 99_999_999 }, 12);
    check(
      revImpossible.severity === "impossible",
      "the finish this fixture reports as a forgery is one no harbor could have paid",
    );

    // Every finisher reports. Two of the five carry a mark of their own:
    // one claims a maroon the harbor never voted on, which is the claim
    // the conclusion must not believe, and one reports an honest
    // bankruptcy.
    const revReports: {
      captain: Captain;
      gold: number;
      reputation: number;
      bankrupt: boolean;
      marooned: boolean;
    }[] = [
      {
        captain: revHonest,
        gold: 120,
        reputation: 30,
        bankrupt: false,
        marooned: false,
      },
      {
        captain: revPirate,
        gold: 200,
        reputation: PIRATE_STANDING_FLOOR + 10,
        bankrupt: false,
        marooned: false,
      },
      {
        captain: revBroker,
        gold: 150,
        reputation: 25,
        bankrupt: false,
        marooned: true,
      },
      {
        captain: revNew,
        gold: 100,
        reputation: 20,
        bankrupt: true,
        marooned: false,
      },
      {
        captain: revForged,
        gold: 99_999_999,
        reputation: 40,
        bankrupt: false,
        marooned: false,
      },
    ];
    // The harbor's own copy of those reports, taken off the broadcast
    // rather than from the fixture, so a check below can prove a claim
    // reached the server before another says the server did not believe
    // it. The frame names its captain through the public user it carries,
    // the way every status frame does, rather than a bare id.
    const revStatuses: { user?: { id?: string }; marooned?: boolean }[] = [];
    revSockets[0].on(
      "game:status",
      (payload: { user?: { id?: string }; marooned?: boolean }) =>
        revStatuses.push(payload),
    );
    for (const {
      captain,
      gold,
      reputation,
      bankrupt,
      marooned,
    } of revReports) {
      revSockets[revCrew.indexOf(captain)].emit("game:status", {
        roomId: revRoomId,
        round: 6,
        phase: "endgame",
        phaseLabel: "Voyage Complete",
        gold,
        reputation,
        shipLevel: 2,
        gameOver: true,
        bankrupt,
        marooned,
      });
    }
    check(
      revHeld().length === 0,
      "no report is a reveal, since the ledger is the conclusion's to send",
    );

    // The conclusion writes behind the last report rather than inside it,
    // so the frame is waited for rather than slept past: a fixed pause long
    // enough on this machine is the kind of check that fails the first time
    // it runs somewhere slower. The wait is for the last socket rather than
    // the first, because one broadcast lands on five of them in its own
    // time and the claim under test is about the whole table: reading the
    // frame off whichever seat happened to hear it first and then counting
    // the others would be asserting on a race.
    const revArrived = () =>
      revCrew.every((captain) => (revSeen.get(captain.id)?.length ?? 0) > 0);
    for (let waited = 0; !revArrived() && waited < 10000; waited += 250) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const revPaid = revSeen.get(revPirate.id)?.[0];
    check(
      revPaid?.roomId === revRoomId,
      "a concluded voyage turns every card over to the room",
    );
    check(
      revArrived(),
      "every seat at the table was told, rather than the one the frame was read off",
    );
    check(
      revCrew.every((captain) => revSeen.get(captain.id)?.length === 1),
      "once per captain at the table, so every seat is told the whole hand rather than a share of it",
    );
    const revOf = (captain: Captain) =>
      revPaid?.captains.find((row) => row.userId === captain.id);
    check(
      revPaid?.captains.length === revCrew.length &&
        revCrew.every((captain) => revOf(captain) !== undefined),
      "and the ledger names every finisher at the table",
    );
    check(
      revPaid?.captains[0]?.userId === revPirate.id,
      "read back in the order the standings were, so the first card the table sees is the crowned one",
    );
    check(
      revPaid?.objective.id === revObjective.id,
      `and draws the commission the harbor was actually working on (${revObjective.id})`,
    );

    // The cards themselves. The hand was written above, so each row is the
    // captain it was written for and the verdict is the one the rule owes
    // them: the Pirate wins a commission the fleet fell short of and takes
    // the crown with it, the Broker wins on a ledger the fleet's failure
    // cannot touch, and the Honest captain of a short commission wins
    // nothing whatever their own goal did.
    check(
      revOf(revPirate)?.role === "pirate" &&
        revOf(revPirate)?.won === true &&
        revOf(revPirate)?.crowned === true,
      "the reveal names the Pirate, who wins the voyage the fleet did not finish and is crowned for it",
    );
    check(
      revOf(revBroker)?.role === "broker" &&
        revOf(revBroker)?.won === true &&
        revOf(revBroker)?.crowned === false,
      "and the Broker, who wins beside them on coin taken from the table rather than on the commission",
    );
    check(
      revOf(revHonest)?.role === "honest" &&
        revOf(revHonest)?.flourishId === revFlourish.id &&
        revOf(revHonest)?.won === false,
      "while an Honest card on a commission that fell short wins nothing, with the goal it was dealt named beside it",
    );
    check(
      revOf(revNew)?.role === null &&
        revOf(revNew)?.won === false &&
        revOf(revNew)?.bankrupt === true,
      "and a seat the hand never reached is drawn holding no card, and is judged on none",
    );
    check(
      revOf(revForged)?.forged === true && revOf(revForged)?.won === false,
      "a finish the ledger could not read is marked as a forgery and wins nothing",
    );
    check(
      Object.keys(revOf(revForged)?.delivered ?? { read: 1 }).length === 0 &&
        revOf(revForged)?.fills.length === 0 &&
        revOf(revForged)?.peerTradeProfit === 0,
      "and contributes no goods, no trades and no peer profit to it, since a forged book is not a book",
    );
    // The two halves of the maroon: that the claim really arrived, and that
    // the ledger did not take it. Read in that order for the reason the
    // save above was written at all, so the second check cannot pass
    // because the first never happened.
    check(
      revStatuses.some(
        (frame) => frame.user?.id === revBroker.id && frame.marooned === true,
      ),
      "the harbor did read the Broker's claim of a maroon nobody voted on",
    );
    check(
      revOf(revBroker)?.marooned === false,
      "and the ledger hands them none, since a vote is the harbor's own record rather than a captain's report",
    );

    // The curve. Two clients kept a record of the same commission and
    // disagreed about it, and what goes on the wire is one story rather
    // than two: the higher figure at each leg, in leg order.
    check(
      revPaid?.fleetTrace.length === 2 &&
        revPaid.fleetTrace[0]?.round === 1 &&
        revPaid.fleetTrace[1]?.round === 3,
      "the fleet's commission is read back leg by leg, in the order the voyage sailed it",
    );
    check(
      revPaid?.fleetTrace[0]?.delivered[revA.type] === 4,
      "and a leg two clients recorded differently reads as the further along of the two",
    );
    check(
      revPaid?.fleetTrace[1]?.delivered[revA.type] === revA.required &&
        revPaid?.fleetTrace[1]?.delivered[revB.type] === revShortB,
      "while the last leg is neither captain's copy of it, taking one good from the merchant's record and the other from the pirate's",
    );
    check(
      revOf(revHonest)?.delivered[revA.type] === revA.required &&
        revOf(revHonest)?.fills.length === 1 &&
        revOf(revHonest)?.fills[0]?.round === 2,
      "and each captain's own contribution and the trades left on their record are attributed to their own row",
    );

    // And the half a reloading captain gets. The voyage is over, so the
    // reveal is the only way a browser that arrives after it can be told
    // what the table saw, and the hand out is the same door the audit's
    // reveal and the commission's board come through.
    const revRejoin = await openAuthedSocket(revBroker);
    run.sockets.push(revRejoin);
    const revHanded = waitForEvent<WireReveal>(
      revRejoin,
      "voyage:reveal",
      (payload) => payload?.roomId === revRoomId,
    );
    revRejoin.emit("room:join", { roomId: revRoomId });
    const revBack = await revHanded;
    check(
      revBack !== null &&
        revBack.captains.length === revCrew.length &&
        revBack.captains.some((row) => row.userId === revPirate.id),
      "a captain who reloads onto the finished voyage is handed the same ledger the room watched",
    );

    // And a restarted voyage hands nobody the last one's cards, which is
    // the only way this frame could lie: it refuses nothing, so a harbor
    // that kept it would tell its next table a story about other people.
    revSockets[0].emit("room:restart", { roomId: revRoomId });
    const revStale = await (async () => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const socket = await openAuthedSocket(revNew);
      run.sockets.push(socket);
      const frame = waitForEvent<WireReveal>(
        socket,
        "voyage:reveal",
        (payload) => payload?.roomId === revRoomId,
        1200,
      );
      socket.emit("room:join", { roomId: revRoomId });
      return frame;
    })();
    check(
      revStale === null,
      "and a voyage that has restarted hands out no cards at all, since the hand it would show belongs to a voyage nobody sailed",
    );

    console.log("\nThe unlock code");
    // [H9] The harbor's one locked door, and the reason it is a phrase
    // rather than a permission: what the phrase buys a captain is a moment,
    // not a fence, and an entitlement kept per account would make the first
    // question at every table an administrative check. This section walks
    // the whole loop the plan asks for. It reads the table first, because a
    // suite that spelled the words itself would be testing its own copy of
    // them. Then it earns the phrase the way a captain does, on a tenth
    // completed voyage, reads it back out of the log that voyage left
    // behind, and opens a sealed table with it from an account that has
    // never sailed ten of anything.

    // ---- The table, read before anything is typed ----
    for (const id of UNLOCK_ORDER) {
      const unlock = UNLOCKS[id];
      check(
        normalizePhrase(unlock.phrase) === unlock.phrase &&
          unlockForPhrase(unlock.phrase) === id,
        `${unlock.label} keeps its phrase in the one form the normalizer produces, so the words in the table are words a host can type back into it`,
      );
      check(
        unlockForPhrase(`  ${unlock.phrase.toUpperCase()}.  `) === id &&
          unlockForPhrase(`${unlock.phrase} and more`) === null,
        "and a host who pastes it out of the manual in capitals with the full stop still opens the same door, while a phrase that is merely close opens nothing",
      );
      check(
        !CARRIES_A_DASH.test(unlock.label + unlock.phrase + unlock.manual),
        `and the copy on ${unlock.label} is free of every dash, which is the rule every line a captain reads is held to`,
      );
      check(
        unlock.manual.includes(unlock.phrase) &&
          MANUAL.includes(unlock.phrase) &&
          MODES[unlock.mode].sealed,
        `and the manual prints the phrase for the sealed ${MODES[unlock.mode].badge} voyage, on both the page the repo ships and the page a captain can open`,
      );
    }
    const sealedModes = MODE_ORDER.filter((mode) => MODES[mode].sealed);
    check(
      sealedModes.length === UNLOCK_ORDER.length &&
        sealedModes.every((mode) =>
          UNLOCK_ORDER.some((id) => UNLOCKS[id].mode === mode),
        ),
      "every sealed voyage has a phrase behind it and every phrase opens a sealed voyage, so neither record can be changed without the other being read",
    );
    const earnedLine = unlockLineFor(UNLOCK_EARNED_AT);
    check(
      unlockLineFor(UNLOCK_EARNED_AT - 1) === null &&
        earnedLine !== null &&
        earnedLine.includes(LEDGER_PHRASE) &&
        earnedLine.includes(String(UNLOCK_EARNED_AT)) &&
        unlockLineFor(UNLOCK_EARNED_AT + 1) === null,
      `the harbor's line is handed over on the voyage that reaches ${UNLOCK_EARNED_AT} and on no other, and it carries both the count it was granted at and the phrase itself rather than a hint at it`,
    );

    // ---- The voyage that earns it ----
    // Three seats, because the line has three cases to tell apart: the
    // captain whose tenth voyage this is, a captain on their first voyage
    // who must not be handed it, and a captain sitting at ten who forges
    // this finish, which the integrity pass refuses to bank and the line
    // has to refuse with it.
    //
    // The two counts are written rather than sailed, the way the barter
    // gate's own section writes the level it needs: nine voyages behind the
    // first captain are what makes this one the tenth, and ten behind the
    // forger are what makes the refusal the rule deciding rather than a
    // count that happened to be short.
    const unlHome = await signUp("unlhome");
    const unlNew = await signUp("unlnew");
    const unlFake = await signUp("unlfake");
    run.extraAccounts.push(unlHome, unlNew, unlFake);
    await db.captainLegacy.create({
      data: { userId: unlHome.id, voyagesCompleted: UNLOCK_EARNED_AT - 1 },
    });
    await db.captainLegacy.create({
      data: { userId: unlFake.id, voyagesCompleted: UNLOCK_EARNED_AT },
    });

    const unlLog = await call<{
      room: { id: string; code: string; unlock?: unknown };
    }>("/api/rooms", {
      method: "POST",
      cookie: unlHome.cookie,
      body: JSON.stringify({
        name: `Smoke unlock log ${suffix}`,
        isPublic: false,
      }),
    });
    check(
      unlLog.status === 200 && unlLog.body.room.unlock === null,
      "the harbor the tenth voyage is sailed in asks for no phrase at all, which is every harbor the game ever shipped with",
    );
    const unlLogId = unlLog.body.room.id;
    const unlSeats = await Promise.all(
      [unlNew, unlFake].map((captain) =>
        call<{ room: { id: string } }>("/api/rooms/join", {
          method: "POST",
          cookie: captain.cookie,
          body: JSON.stringify({ code: unlLog.body.room.code }),
        }),
      ),
    );
    check(
      unlSeats.every((seat) => seat.status === 200),
      "and three captains take it, one on a first voyage and one already at ten",
    );

    const unlCrew = [unlHome, unlNew, unlFake];
    const unlSockets: Socket[] = [];
    for (const captain of unlCrew) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      const seatedHere = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === unlLogId,
      );
      socket.emit("room:join", { roomId: unlLogId });
      await seatedHere;
      unlSockets.push(socket);
    }
    unlSockets[0].emit("room:start", { roomId: unlLogId });
    await new Promise((resolve) => setTimeout(resolve, 800));

    // The forger's finish is one no voyage could have paid, proved here
    // rather than assumed, the way the reveal's own fixture proves its own:
    // the number below is this fixture's, and it is orders of magnitude
    // over any ceiling the integrity pass derives from live game data.
    check(
      checkSave({ money: 99_999_999 }, 8).severity === "impossible",
      "the finish the forger reports in this harbor is one no harbor could have paid",
    );
    const unlReports = [
      { gold: 140, reputation: 34, bankrupt: false },
      { gold: 90, reputation: 18, bankrupt: false },
      { gold: 99_999_999, reputation: 40, bankrupt: false },
    ];
    unlCrew.forEach((_captain, index) =>
      unlSockets[index].emit("game:status", {
        roomId: unlLogId,
        round: 8,
        phase: "endgame",
        phaseLabel: "Voyage Complete",
        shipLevel: 1,
        gameOver: true,
        marooned: false,
        ...unlReports[index],
      }),
    );

    // The log is written behind the last report rather than inside it, so
    // the rows are waited for rather than slept past, and the wait is for
    // all three: reading the first one to land and counting the others
    // would be asserting on a race.
    const readUnlLog = () =>
      db.voyageChronicle.findMany({
        where: { roomId: unlLogId },
        select: { userId: true, body: true },
      });
    let unlRows = await readUnlLog();
    for (
      let waited = 0;
      unlRows.length < unlCrew.length && waited < 10000;
      waited += 250
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      unlRows = await readUnlLog();
    }
    const unlRowFor = (userId: string) =>
      unlRows.find((row) => row.userId === userId);
    const unlHomeRow = unlRowFor(unlHome.id);
    const unlNewRow = unlRowFor(unlNew.id);
    const unlFakeRow = unlRowFor(unlFake.id);
    const unlHomeLegacy = await db.captainLegacy.findUnique({
      where: { userId: unlHome.id },
      select: { voyagesCompleted: true },
    });
    const unlNewLegacy = await db.captainLegacy.findUnique({
      where: { userId: unlNew.id },
      select: { voyagesCompleted: true },
    });
    const unlFakeLegacy = await db.captainLegacy.findUnique({
      where: { userId: unlFake.id },
      select: { voyagesCompleted: true },
    });
    check(
      unlHomeLegacy?.voyagesCompleted === UNLOCK_EARNED_AT &&
        earnedLine !== null &&
        (unlHomeRow?.body ?? "").includes(earnedLine),
      "the tenth completed voyage counts as one and the log it leaves behind carries the harbor's line, so a captain is handed the phrase by the game they played",
    );
    check(
      unlNewRow !== undefined &&
        !unlNewRow.body.includes(LEDGER_PHRASE) &&
        unlNewLegacy?.voyagesCompleted === 1,
      "while a captain on their first voyage reads nothing about any door, because the line belongs to the voyage that crossed the count rather than to the log at large",
    );
    check(
      unlFakeRow !== undefined && !unlFakeRow.body.includes(LEDGER_PHRASE),
      "and a forged finish is handed nothing, even from a count that already stands at ten, since the account the integrity pass writes off keeps no memory of the voyage and the line is part of it",
    );
    check(
      unlFakeLegacy?.voyagesCompleted === UNLOCK_EARNED_AT,
      "which the count behind it says first: a forged voyage leaves the count exactly where it found it",
    );

    // ---- The door ----
    const unlAsk = (cookie: string, body: Record<string, unknown>) =>
      call<{
        room?: {
          id: string;
          code: string;
          mode?: string;
          unlock?: string | null;
        };
        error?: string;
      }>("/api/rooms", {
        method: "POST",
        cookie,
        body: JSON.stringify({
          name: `Smoke unlock door ${suffix}`,
          isPublic: false,
          ...body,
        }),
      });
    const unlSealed = await unlAsk(unlNew.cookie, { mode: "ocean_gambit" });
    check(
      unlSealed.status === 403 && typeof unlSealed.body?.error === "string",
      "a sealed voyage refuses a host who brought no phrase, with an answer rather than a room",
    );
    const unlMistyped = await unlAsk(unlNew.cookie, {
      mode: "ocean_gambit",
      unlock: "the first ledger",
    });
    check(
      unlMistyped.status === 403 &&
        unlMistyped.body.error !== unlSealed.body.error,
      "and a host whose words were wrong is told something else, so a mistyped phrase is never reported as a missing one",
    );
    const unlOtherDoor = await unlAsk(unlNew.cookie, {
      mode: "classic",
      unlock: LEDGER_PHRASE,
    });
    check(
      unlOtherDoor.status === 403,
      "while a phrase that opens another voyage is refused rather than quietly dropped, since a host who typed it is owed the door it opens rather than the one they clicked",
    );
    const unlOpened = await unlAsk(unlNew.cookie, {
      mode: "ocean_gambit",
      // The messy paste, because that is the honest way a host who read the
      // phrase out of a guide types it, and the route's own normalizer is
      // the only reason it opens anything.
      unlock: `  ${LEDGER_PHRASE.toUpperCase()}.  `,
    });
    check(
      unlOpened.status === 200 &&
        unlOpened.body.room?.mode === "ocean_gambit" &&
        unlOpened.body.room?.unlock === "second_ledger",
      "and the phrase opens the table for a captain with one voyage to their name, because the harbor reads the words rather than the account that typed them",
    );
    if (unlOpened.status !== 200 || !unlOpened.body.room) {
      throw new Error("No sealed harbor to test with, stopping here.");
    }
    const unlGate = unlOpened.body.room;
    const unlTaken = await call<{ room: { unlock?: string | null } }>(
      "/api/rooms/join",
      {
        method: "POST",
        cookie: unlHome.cookie,
        body: JSON.stringify({ code: unlGate.code }),
      },
    );
    check(
      unlTaken.status === 200 && unlTaken.body.room.unlock === "second_ledger",
      "and every captain who walks in afterwards is told which door the room was opened through, because the door belongs to the room rather than to whoever opened it",
    );

    // The voyage runs and then restarts, which is the one handler that
    // rewrites the room's voyage settings. The door is not one of them, so a
    // harbor that reopens is still the harbor it was opened as, which is
    // what the lobby card a captain reads it off promises either way.
    const unlGateSocket = await openAuthedSocket(unlNew);
    run.sockets.push(unlGateSocket);
    const unlGateSeated = waitForEvent<WireHistory>(
      unlGateSocket,
      "chat:history",
      (payload) => payload?.roomId === unlGate.id,
    );
    unlGateSocket.emit("room:join", { roomId: unlGate.id });
    await unlGateSeated;
    unlGateSocket.emit("room:start", { roomId: unlGate.id });
    await new Promise((resolve) => setTimeout(resolve, 800));
    const unlRestartFrame = waitForEvent<{ roomId?: string }>(
      unlGateSocket,
      "room:restarted",
      (payload) => payload?.roomId === unlGate.id,
      4000,
    );
    unlGateSocket.emit("room:restart", { roomId: unlGate.id });
    const unlReopened = await unlRestartFrame;
    const unlAfter = await call<{
      room: { mode?: string; unlock?: string | null };
    }>(`/api/rooms/${unlGate.id}`, { cookie: unlNew.cookie });
    check(
      unlReopened !== null &&
        unlAfter.body.room?.mode === "ocean_gambit" &&
        unlAfter.body.room?.unlock === "second_ledger",
      "and a harbor that has restarted its voyage is still the sealed one it was chartered as, phrase and all",
    );

    // =====================================================================
    // [I1: the telemetry spine]
    //
    // The plan's evaluation for this slice has two halves: a full voyage
    // leaves a complete record with no gaps, and a deliberately broken
    // voyage, one abandoned mid leg, leaves a record that explains where it
    // stopped. Both are read back off the server below, from the row it
    // actually wrote rather than from anything this file assembled.
    //
    // Three harbors do the work. The first sails to its end with every kind
    // of event the spine knows fired at least once, the second is abandoned
    // by its only captain and proves a record outlives the harbor it
    // describes, and the third is wiped by its host mid leg and proves the
    // spine forgets a voyage it has already closed.
    // =====================================================================
    console.log("\nThe telemetry spine");

    // ---- The vocabulary, on its own ----
    // The pure half is checked first and without a server, so a failure
    // here is never read as a server that declined to record something.
    const telVoyage = voyageIdFor("harbor-1", 4);
    check(
      telVoyage === "harbor-1:V4",
      "a voyage is named by its harbor and its epoch, which is the same string the commission and the order board already seed from",
    );
    const telPosted = telemetryEvent(
      "offer_posted",
      telVoyage,
      1_700_000_000_000,
      { leg: 2, actor: "captain-a", goods: 4 },
    );
    check(
      telPosted.v === TELEMETRY_VERSION &&
        telPosted.family === "market" &&
        telPosted.leg === 2 &&
        telPosted.voyageId === telVoyage,
      "an event carries the version, the voyage and the leg the plan asks for, and its family is read from the table rather than handed in by the caller",
    );
    check(
      TELEMETRY_FAMILY.leg_report === "loop" &&
        TELEMETRY_FAMILY.offer_expired === "market" &&
        TELEMETRY_FAMILY.maroon_carried === "social" &&
        TELEMETRY_FAMILY.captain_left === "business",
      "the family table says what each event measures, so a reader asks for a family instead of matching on names",
    );
    // A record that has been through JSON, which is how the accumulator
    // stores one: the header, the captain lines and the events all have to
    // come back out of it.
    const telRecord: TelemetryRecord = {
      version: TELEMETRY_VERSION,
      voyageId: telVoyage,
      roomId: "harbor-1",
      voyageEpoch: 4,
      mode: "ocean_gambit",
      difficulty: "fair_winds",
      seats: 3,
      sampleRate: 1,
      openedAt: 1_700_000_000_000,
      startedAt: 1_700_000_000_500,
      endedAt: 1_700_000_090_000,
      outcome: "emptied",
      endedAtLeg: 9,
      captains: [
        {
          userId: "captain-a",
          presentAtEnd: false,
          marooned: true,
          muted: true,
          peerTradeProfit: 1234,
        },
      ],
      events: [telPosted],
      truncated: false,
    };
    const telReadBack = normalizeRecord(JSON.parse(JSON.stringify(telRecord)));
    check(
      telReadBack !== null &&
        telReadBack.voyageId === telVoyage &&
        telReadBack.outcome === "emptied" &&
        telReadBack.endedAtLeg === 9 &&
        telReadBack.captains[0]?.presentAtEnd === false &&
        telReadBack.captains[0]?.marooned === true &&
        telReadBack.captains[0]?.muted === true &&
        telReadBack.captains[0]?.peerTradeProfit === 1234 &&
        telReadBack.events.length === 1,
      "and a record read back out of stored JSON keeps its header, its captains, the maroon, the mute and the peer ledger their lines carry, and its events",
    );
    check(
      normalizeRecord(null) === null &&
        normalizeRecord("record") === null &&
        normalizeRecord({}) === null,
      "while a row this build cannot read at all comes back as an absence rather than as an empty voyage",
    );
    const telStrange = normalizeRecord({
      voyageId: telVoyage,
      events: [telPosted, { name: "trade_settled", leg: 2 }],
      outcome: "sunk",
      captains: [{ presentAtEnd: true }, { userId: "captain-b" }],
    });
    check(
      telStrange !== null &&
        telStrange.events.length === 1 &&
        telStrange.outcome === "emptied" &&
        telStrange.captains.length === 1 &&
        telStrange.captains[0]?.userId === "captain-b",
      "and an event this build does not know, an outcome it does not know and a captain line with no captain in it are dropped or read as absence rather than carried",
    );
    // [I2: the two measurements most likely to be skipped] The peer ledger
    // on its own, which the Broker's verdict and the record's captain lines
    // both read through. A number is the number, a negative one included,
    // since a captain can come out of a voyage having paid out more than
    // they took; everything else is the absence of a ledger rather than a
    // ledger of zero.
    check(
      readPeerTradeProfit({ peerTradeProfit: 2200 }) === 2200 &&
        readPeerTradeProfit({ peerTradeProfit: -40 }) === -40 &&
        readPeerTradeProfit({}) === 0 &&
        readPeerTradeProfit({ peerTradeProfit: "2200" }) === 0 &&
        readPeerTradeProfit({ peerTradeProfit: Number.NaN }) === 0 &&
        readPeerTradeProfit(null) === 0 &&
        readPeerTradeProfit([2200]) === 0,
      "the peer ledger is read out of a save the way the rule reads it, so one reading of a save cannot become two numbers",
    );
    // The fields those two marks and the mute live on, on their way back
    // out of stored JSON, in the two shapes a reader can meet: a line an
    // older build wrote, which carries none of them, and a line whose
    // values are not the shapes this build writes. Both read as the absence
    // rather than as a hole, which is what lets a reader pass over a line
    // without special casing it.
    const telOlderLines = normalizeRecord({
      voyageId: telVoyage,
      captains: [
        { userId: "captain-a", presentAtEnd: true },
        {
          userId: "captain-b",
          presentAtEnd: false,
          marooned: "yes",
          muted: "yes",
          peerTradeProfit: Number.NaN,
        },
      ],
    });
    check(
      telOlderLines !== null &&
        telOlderLines.captains.length === 2 &&
        telOlderLines.captains[0]?.marooned === false &&
        telOlderLines.captains[0]?.muted === false &&
        telOlderLines.captains[0]?.peerTradeProfit === 0 &&
        telOlderLines.captains[1]?.marooned === false &&
        telOlderLines.captains[1]?.muted === false &&
        telOlderLines.captains[1]?.peerTradeProfit === 0,
      "and a captain line written before the voyage recorded any of them reads as a captain the harbor did not put ashore and did not silence, and who took nothing in trade, rather than as a line a reader has to guard",
    );

    // ---- The voyage that sails to its end ----
    // Every fixture below reads this process's own configuration, which is
    // the same file the server under test reads when both are run the way
    // the README says. A rate below one is refused here rather than
    // tolerated: these fixtures can only observe what was recorded, and a
    // suite that quietly recorded nothing would still report success.
    if (loadServerConfig().telemetrySampleRate < 1) {
      throw new Error(
        "The telemetry checks need every voyage recorded, so the server under test has to run with TELEMETRY_SAMPLE_RATE=1.",
      );
    }

    const telHome = await signUp("tel_a");
    const telMate = await signUp("tel_b");
    const telCast = await signUp("tel_c");
    const telDrift = await signUp("tel_d");
    const telWipe = await signUp("tel_e");
    run.extraAccounts.push(telHome, telMate, telCast, telDrift, telWipe);

    // One harbor, chartered, seated and started. The three fixtures differ
    // in what they then do to it rather than in how it comes into being,
    // so the shared part is written once: the room is opened through the
    // route a host uses, the rest of the crew joins by code, everyone takes
    // the channel, and the first of them sets sail.
    const telSail = async (
      label: string,
      crew: Captain[],
    ): Promise<{ roomId: string; crewSockets: Socket[] }> => {
      const opened = await call<{ room: { id: string; code: string } }>(
        "/api/rooms",
        {
          method: "POST",
          cookie: crew[0].cookie,
          body: JSON.stringify({
            name: `Smoke telemetry ${label} ${suffix}`,
            isPublic: false,
            mode: "ocean_gambit",
            unlock: LEDGER_PHRASE,
          }),
        },
      );
      if (opened.status !== 200) {
        throw new Error(`No harbor to record a ${label} voyage in.`);
      }
      const roomId = opened.body.room.id;
      const seats = await Promise.all(
        crew.slice(1).map((captain) =>
          call<{ room: { id: string } }>("/api/rooms/join", {
            method: "POST",
            cookie: captain.cookie,
            body: JSON.stringify({ code: opened.body.room.code }),
          }),
        ),
      );
      if (seats.some((seat) => seat.status !== 200)) {
        throw new Error(`A captain could not sit in the ${label} harbor.`);
      }
      const crewSockets: Socket[] = [];
      for (const captain of crew) {
        const socket = await openAuthedSocket(captain);
        run.sockets.push(socket);
        const aboard = waitForEvent<WireHistory>(
          socket,
          "chat:history",
          (payload) => payload?.roomId === roomId,
        );
        socket.emit("room:join", { roomId });
        await aboard;
        crewSockets.push(socket);
      }
      const departed = crewSockets.map((socket) =>
        waitForEvent<{ roomId?: string }>(
          socket,
          "room:started",
          (payload) => payload?.roomId === roomId,
        ),
      );
      crewSockets[0].emit("room:start", { roomId });
      await Promise.all(departed);
      return { roomId, crewSockets };
    };

    // A harbor reaches a leg the way it always does: a captain reports
    // where they are standing and the room's checkpoint follows the
    // furthest report. Nothing here is special to the spine, which is why
    // it is four lines and a wait rather than a fixture of its own.
    const telStand = async (
      socket: Socket,
      roomId: string,
      round: number,
      phase: Phase,
    ): Promise<void> => {
      socket.emit("game:status", {
        roomId: roomId,
        round,
        phase,
        phaseLabel: phase,
        gold: 100,
        reputation: 10,
        shipLevel: 0,
        gameOver: false,
        renownLevel: 3,
      });
      for (let waited = 0; waited < 5000; waited += 100) {
        const row = await db.room.findUnique({
          where: { id: roomId },
          select: { currentRound: true, currentPhase: true },
        });
        if (row?.currentRound === round && row.currentPhase === phase) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`The harbor never reached leg ${round} at ${phase}.`);
    };

    // The record as the server stored it, read the way a later reader reads
    // it: the columns it can be queried by, and the blob normalized back
    // into shape. A record that cannot be parsed at all reads as null here
    // rather than throwing, so a corrupt row is a failed check instead of a
    // suite that stopped early.
    const telStored = async (roomId: string) => {
      const rows = await db.voyageTelemetry.findMany({
        where: { roomId: roomId },
        select: {
          outcome: true,
          leg: true,
          sampleRate: true,
          voyageEpoch: true,
          record: true,
        },
      });
      // Read through the reader a later reader uses, rather than through a
      // parse of its own: a row that will not parse and a row whose shape
      // will not read are the same absence, and the suite has to see the
      // record the way the dashboard's own route sees it or it would be
      // checking a stricter reader than the one that ships.
      return rows.map((row) => ({
        row,
        record: readStoredRecord(row.record),
      }));
    };
    const telWaitForOne = async (roomId: string) => {
      for (let waited = 0; waited < 12000; waited += 250) {
        const found = await telStored(roomId);
        if (found.length) return found[0];
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return (await telStored(roomId))[0];
    };

    const sailRoom = await telSail("complete", [telHome, telMate, telCast]);
    const [sailHome, sailMate, sailCast] = sailRoom.crewSockets;
    const sailRoomId = sailRoom.roomId;

    // Leg one at the Parley, which is where a board opens and where both
    // votes below are called from.
    await telStand(sailHome, sailRoomId, 1, "parley");

    // ---- the market, all three of its lines ----
    // One offer taken, and one left standing to expire when the harbor
    // leaves the bartering phase.
    const takenBoard = waitForEvent<{ offers: WireOffer[] }>(
      sailMate,
      "barter:update",
      (payload) =>
        (payload?.offers ?? []).some((o) => o.fromUserId === telHome.id),
    );
    sailHome.emit("barter:post", {
      roomId: sailRoomId,
      offerItem: "Tea",
      offerAmount: 3,
      requestItem: "Silk",
      requestAmount: 2,
    });
    const takenOffer = (await takenBoard)?.offers.find(
      (o) => o.fromUserId === telHome.id,
    );
    check(
      takenOffer !== undefined,
      "a captain posts an offer in the harbor the record is being taken in",
    );
    const fulfilled = waitForEvent<{ accepterId?: string }>(
      sailHome,
      "barter:fulfilled",
      (payload) => payload?.accepterId === telMate.id,
    );
    sailMate.emit("barter:accept", {
      roomId: sailRoomId,
      offerId: takenOffer?.id,
    });
    check(
      (await fulfilled) !== null,
      "and another captain takes it, which is the one settlement a peer trade produces",
    );
    const standingBoard = waitForEvent<{ offers: WireOffer[] }>(
      sailMate,
      "barter:update",
      (payload) =>
        (payload?.offers ?? []).some((o) => o.fromUserId === telHome.id),
    );
    sailHome.emit("barter:post", {
      roomId: sailRoomId,
      offerItem: "Porcelain Clay",
      offerAmount: 5,
      requestItem: "Copper Ore",
      requestAmount: 4,
    });
    const standingOffer = (await standingBoard)?.offers.find(
      (o) => o.fromUserId === telHome.id,
    );
    check(
      standingOffer !== undefined,
      "a second offer is left on the board where nobody takes it",
    );

    // ---- talk, and the two figures only a captain's screen holds ----
    sailHome.emit("chat:room", {
      roomId: sailRoomId,
      content: "Leg one, good wind.",
    });
    sailMate.emit("chat:room", { roomId: sailRoomId, content: "Same to you." });
    const telLegReport = (
      socket: Socket,
      leg: number,
      ordersDealt: number,
      ordersFilled: number,
      distinctGoods: number,
      hold?: {
        holdSlots?: unknown;
        grainMeals?: unknown;
        saltFishMeals?: unknown;
        produceMeals?: unknown;
      },
      // [D6: Free Captain: Opportunist] The borrow counter rides here for
      // the reason the hold figures do: a report is a claim, and what the
      // checks below are about is what the spine does with one.
      ability?: { opportunistBorrows?: unknown },
    ) =>
      socket.emit("telemetry:leg", {
        roomId: sailRoomId,
        leg,
        ordersDealt,
        ordersFilled,
        distinctGoods,
        ...(hold ?? {}),
        ...(ability ?? {}),
      });
    telLegReport(sailHome, 1, 3, 1, 2);
    // The same captain, the same leg, reporting again after filling another
    // order: the last report for a leg is the one kept, so this is the pair
    // of figures the record has to close with. The borrow counter rides the
    // second of the two, so a reader can tell that the replacement kept the
    // whole report rather than the three figures it was filed for.
    telLegReport(sailHome, 1, 4, 2, 3, undefined, {
      opportunistBorrows: 3.7,
    });
    telLegReport(sailMate, 1, 2, 2, 1, undefined, {
      opportunistBorrows: "three",
    });
    // Two claims outside the voyage's reach, which the spine refuses rather
    // than keeping: a leg it never got to, and a leg that does not exist at
    // all. Both are filed about a captain who never filed a report of their
    // own, so a refusal is the only way either could appear.
    telLegReport(sailCast, 99, 1, 1, 1);
    telLegReport(sailCast, 0, 1, 1, 1);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // The Parley ends and the standing offer goes back to its poster, which
    // is the expired line. The checkpoint has to move forward off the table
    // for that to happen, so this stands the room at the phase after it on
    // this voyage's own lap, which is the one the room would open next.
    await telStand(sailHome, sailRoomId, 1, "resolve");
    await telStand(sailHome, sailRoomId, 2, "parley");
    // And a report filed one leg ahead of the harbor, which is the one leg
    // of slack the spine allows: a captain who has just finished counting a
    // leg is routinely ahead of a checkpoint that only moves when somebody
    // says they are standing at it. The same claim filed while the voyage
    // was still on leg one was refused, which is where the slack stops.
    //
    // [C4: three foods, spoilage and the split hold] That same report is
    // where the four figures a split hold adds ride. They are sent as a
    // number, a negative, a value that is not a number at all and one the
    // build never measured, so the spine's read of them is exercised rather
    // than assumed: a claim is floored and kept, a negative is clamped to
    // the empty hold it is, and a value that is not a number is dropped
    // rather than defaulted to a zero a reader would take for a real one.
    telLegReport(
      sailMate,
      3,
      5,
      0,
      4,
      {
        holdSlots: 27.9,
        grainMeals: 12,
        saltFishMeals: -4,
        produceMeals: "six",
      },
      // [D6: Free Captain: Opportunist] The borrow counter rides the same
      // report and the same spine reader as the four figures above, filed
      // as a negative here so the clamp is exercised rather than assumed.
      // It is deliberately not a report of its own: a second report for one
      // captain and one leg replaces the first, which would take the hold
      // figures off the record rather than add a figure to it.
      { opportunistBorrows: -2 },
    );
    await new Promise((resolve) => setTimeout(resolve, 300));

    // ---- the two votes, at their own rungs ----
    // Two of three carries both, and the record keeps the nominations and
    // the harbor's answer separately: the first is usage and the second is
    // the outcome.
    await telStand(sailHome, sailRoomId, 5, "parley");
    sailHome.emit("audit:vote", {
      roomId: sailRoomId,
      round: 5,
      targetUserId: telCast.id,
    });
    sailMate.emit("audit:vote", {
      roomId: sailRoomId,
      round: 5,
      targetUserId: telCast.id,
    });
    await new Promise((resolve) => setTimeout(resolve, 400));

    await telStand(sailHome, sailRoomId, 9, "parley");
    sailHome.emit("maroon:vote", {
      roomId: sailRoomId,
      round: 9,
      targetUserId: telCast.id,
    });
    sailMate.emit("maroon:vote", {
      roomId: sailRoomId,
      round: 9,
      targetUserId: telCast.id,
    });
    await new Promise((resolve) => setTimeout(resolve, 400));

    // ---- the captain who walks out ----
    // The ordinary Leave button, in the order the client sends it: the
    // route that gives up the seat, then the socket that says so. The
    // captain the harbor just put ashore is the one who goes, which is
    // what the retention figure reads later.
    const castSeat = await call<{ ok: boolean }>(
      `/api/rooms/${sailRoomId}/leave`,
      { method: "POST", cookie: telCast.cookie },
    );
    sailCast.emit("room:leave", { roomId: sailRoomId });
    const castMembership = await db.roomMember.findUnique({
      where: { userId_roomId: { userId: telCast.id, roomId: sailRoomId } },
      select: { id: true },
    });
    check(
      castSeat.status === 200 && castMembership === null,
      "a captain gives up their seat mid leg, through the same route the Leave button uses",
    );
    await new Promise((resolve) => setTimeout(resolve, 400));

    // ---- the ending ----
    const sailEnds = waitForEvent<{ roomId?: string }>(
      sailHome,
      "voyage:reveal",
      (payload) => payload?.roomId === sailRoomId,
      10000,
    );
    for (const socket of [sailHome, sailMate]) {
      socket.emit("game:status", {
        roomId: sailRoomId,
        round: 9,
        phase: "endgame",
        phaseLabel: "Voyage Complete",
        gold: 120,
        reputation: 20,
        shipLevel: 1,
        gameOver: true,
        renownLevel: 3,
        marooned: false,
      });
    }
    await sailEnds;

    const sailRow = await telWaitForOne(sailRoomId);
    const sailRecord = sailRow?.record ?? null;
    check(sailRecord !== null, "the voyage that concluded leaves a record");
    if (!sailRecord) {
      throw new Error("No recorded voyage to read the measurements off.");
    }
    const sailEvents = sailRecord.events;
    // The record's events, sorted by the name they carry. The event type is
    // a union keyed on that name, so reading a payload field off a line is
    // only sound once the name is spelled out: the filters below are what
    // tells the compiler which fields a line has.
    const sailLines = {
      advanced: sailEvents.filter((event) => event.name === "leg_advanced"),
      posted: sailEvents.filter((event) => event.name === "offer_posted"),
      filled: sailEvents.filter((event) => event.name === "offer_filled"),
      expired: sailEvents.filter((event) => event.name === "offer_expired"),
      talk: sailEvents.filter((event) => event.name === "message_sent"),
      auditAsked: sailEvents.filter((event) => event.name === "audit_asked"),
      auditCarried: sailEvents.filter(
        (event) => event.name === "audit_carried",
      ),
      maroonAsked: sailEvents.filter((event) => event.name === "maroon_asked"),
      maroonCarried: sailEvents.filter(
        (event) => event.name === "maroon_carried",
      ),
      left: sailEvents.filter((event) => event.name === "captain_left"),
      reports: sailEvents.filter((event) => event.name === "leg_report"),
    };
    const sailGoods = (list: ReadonlyArray<{ goods: number }>) =>
      list.reduce((sum, event) => sum + event.goods, 0);
    check(
      sailRow?.row.outcome === "concluded" &&
        sailRow?.row.leg === 9 &&
        sailRow?.row.sampleRate === loadServerConfig().telemetrySampleRate &&
        sailRow?.row.voyageEpoch === sailRecord.voyageEpoch,
      "and the columns it can be queried by say the same thing as the record inside them",
    );
    check(
      sailRecord.voyageId === voyageIdFor(sailRoomId, sailRecord.voyageEpoch) &&
        sailRecord.mode === "ocean_gambit" &&
        sailRecord.seats === 3 &&
        sailRecord.truncated === false,
      "the record is named by the voyage it belongs to, and carries the mode, the three seats it was dealt and no truncation",
    );
    check(
      sailRecord.openedAt <= sailRecord.startedAt &&
        sailRecord.startedAt <= sailRecord.endedAt,
      "and it is stamped in order, from the moment the harbor was charted to the moment the voyage closed, which is the two ends of the lobby fill time",
    );
    check(
      sailRecord.captains.length === 3 &&
        sailRecord.captains.filter((line) => line.presentAtEnd).length === 2 &&
        sailRecord.captains.find((line) => line.userId === telCast.id)
          ?.presentAtEnd === false,
      "every captain the voyage saw has a line, and the one who walked out is the one marked as gone at the end",
    );
    // [I2: the two measurements most likely to be skipped] The maroon, on
    // the captain the harbor actually voted ashore. It is the one field on
    // a line the server watched happen rather than read out of a save, and
    // it is a fact of its own beside the one above: this captain is gone
    // from the voyage *and* was put ashore, which is the pair the plan's
    // retention figure is read off. Of the captains this reads true for,
    // none were still there at the end, and that is the figure.
    check(
      sailRecord.captains.find((line) => line.userId === telCast.id)
        ?.marooned === true &&
        sailRecord.captains.filter((line) => line.marooned).length === 1 &&
        sailRecord.captains
          .filter((line) => line.marooned)
          .every((line) => line.presentAtEnd === false),
      "and the captain the harbor put ashore at leg nine is marked on their own line rather than left for a reader to join out of the events",
    );
    // The other field the same slice added, on a harbor whose captains
    // never wrote a save at all. Nothing here was read, so every line
    // carries the zero an unreadable save gives: the same reading, not a
    // missing number a reader would have to guard.
    check(
      sailRecord.captains.every((line) => line.peerTradeProfit === 0),
      "while a voyage whose captains never filed a save reads every peer ledger as the zero an unreadable save gives",
    );
    // The counts, one family at a time. The market's three lines count the
    // same side of an offer, so they have to add up: what was posted, less
    // what was filled and what expired, is what is still standing.
    check(
      sailLines.posted.length === 2 &&
        sailLines.filled.length === 1 &&
        sailLines.expired.length === 1 &&
        sailLines.filled[0]?.goods === 3 &&
        sailLines.expired[0]?.goods === 5 &&
        sailGoods(sailLines.posted) ===
          sailGoods(sailLines.filled) + sailGoods(sailLines.expired),
      "the market family records both offers, the one that was taken and the one that went back to its poster, and the three lines add up in the units their posters escrowed",
    );
    check(
      sailLines.talk.length === 2,
      "and the harbor's talk is counted once per message, from the captain who sent it",
    );
    check(
      sailLines.auditAsked.length === 2 &&
        sailLines.auditCarried.length === 1 &&
        sailLines.auditCarried[0]?.target === telCast.id &&
        sailLines.maroonAsked.length === 2 &&
        sailLines.maroonCarried.length === 1 &&
        sailLines.maroonCarried[0]?.target === telCast.id,
      "the social family keeps the two nominations and the one carried vote for each of the harbor's two votes, so usage and outcome are separate numbers",
    );
    check(
      sailLines.left.length === 1 &&
        sailLines.left[0]?.actor === telCast.id &&
        sailLines.left[0]?.leg === 9,
      "and the captain who gave up their seat is one abandonment, stamped with the leg it happened in",
    );
    check(
      sailLines.advanced.length === 3 &&
        sailLines.advanced.map((event) => event.leg).join(",") === "2,5,9",
      "the leg clock moves three times in a voyage that opens on leg one and ends on leg nine, and never twice for the same leg",
    );
    // The one report a client sends, and the two rules that keep it a
    // measurement rather than a chat log: one line per captain per leg,
    // and nothing from outside the voyage's own reach.
    const sailReports = sailLines.reports;
    const sailReportLines = sailReports.map(
      (event) => `${event.actor}:${event.leg}`,
    );
    check(
      sailReports.length === 3 &&
        new Set(sailReportLines).size === sailReports.length &&
        sailReportLines.includes(`${telHome.id}:1`) &&
        sailReportLines.includes(`${telMate.id}:1`) &&
        sailReportLines.includes(`${telMate.id}:3`),
      "one line per captain per leg is kept, and the three that were filed are the three that are there",
    );
    const homeLegOne = sailReports.find(
      (event) => event.actor === telHome.id && event.leg === 1,
    );
    check(
      homeLegOne?.ordersDealt === 4 &&
        homeLegOne?.ordersFilled === 2 &&
        homeLegOne?.distinctGoods === 3,
      "and a captain who reports the same leg twice closes it with the later figures, which is what a client that keeps trading produces",
    );
    // [C4: three foods, spoilage and the split hold] The four figures a
    // split hold adds to a report are claims like the three above them, and
    // the spine reads them the same way: a number is floored and kept, a
    // negative is clamped to the empty hold it describes, a value that is
    // not a number is dropped rather than read as a zero, and a report from
    // a leg that measured no hold leaves all four absent, which is how a
    // reader tells a survival voyage from one that never measured.
    const mateLegThree = sailReports.find(
      (event) => event.actor === telMate.id && event.leg === 3,
    );
    check(
      mateLegThree?.holdSlots === 27 &&
        mateLegThree?.grainMeals === 12 &&
        mateLegThree?.saltFishMeals === 0 &&
        mateLegThree?.produceMeals === undefined &&
        homeLegOne?.holdSlots === undefined &&
        homeLegOne?.grainMeals === undefined &&
        homeLegOne?.produceMeals === undefined,
      "and a hold reading on a report is a claim the spine floors, clamps or drops rather than a figure it trusts, while a leg that measured no hold carries none of the four",
    );
    // [D6: Free Captain: Opportunist] The borrow counter is read by that
    // same rule, and the three readings are the whole of it: a fraction
    // floors to the whole borrows it can stand for, a negative clamps to
    // the voyage that spent none, and a claim that is not a number at all
    // is dropped. The last is the one that matters most on this field,
    // because a zero here is a real reading rather than an empty one: it
    // says the allowance is unspent.
    const mateLegOne = sailReports.find(
      (event) => event.actor === telMate.id && event.leg === 1,
    );
    check(
      homeLegOne?.opportunistBorrows === 3 &&
        mateLegThree?.opportunistBorrows === 0 &&
        mateLegOne?.opportunistBorrows === undefined,
      "and the borrow counter rides the same reader, so a fraction floors to the whole borrows it stands for, a negative clamps to the voyage that spent none, and a value that is not a number is dropped rather than landing as a zero a reader could take for an unspent allowance",
    );
    check(
      !sailReportLines.some(
        (line) => line.endsWith(":99") || line.endsWith(":0"),
      ),
      "while a claim about a leg the voyage never reached, and one about a leg that does not exist, are refused rather than written down",
    );
    // The one invariant that covers every event in the record: nothing can
    // sit on a leg the voyage had not got to, and the only events allowed
    // to run one leg ahead are the captain's own reports, which is the
    // slack the client's own counting needs.
    const sailReached = new Set([
      1,
      ...sailLines.advanced.map((event) => event.leg),
    ]);
    check(
      sailEvents.every(
        (event) =>
          event.leg >= 1 &&
          event.leg <= sailRecord.endedAtLeg + 1 &&
          (sailReached.has(event.leg) || event.name === "leg_report"),
      ),
      "and every event in the record sits on a leg the voyage reached, or on the one leg its captain was allowed to be ahead on",
    );

    // ---- The two readings a captain's line carries ----
    // Both are read off harbors this run sailed earlier rather than off
    // fixtures of their own, because the point of each field is that it
    // carries something the game already decided with rather than something
    // a measurement invented.
    //
    // The first is the reveal harbor, which concluded with a Broker handed
    // exactly the ledger their own verdict turns on. That harbor is
    // restarted after the voyage ends, and the restart writes no second
    // record: the voyage it belonged to was already closed.
    const revLedgered =
      (await telStored(revRoomId)).find(
        (row) => row.record?.outcome === "concluded",
      )?.record ?? null;
    check(
      revLedgered !== null &&
        revLedgered.captains.find((line) => line.userId === revBroker.id)
          ?.peerTradeProfit === BROKER_PAYOUT_TARGET,
      "a captain's line carries the peer ledger their own save held, which is the number the Broker's verdict was decided on",
    );
    // The two absences a reader meets on the same lines: a save that is
    // there and holds no ledger, and a seat with no save at all. Neither is
    // a hole in the record.
    check(
      revLedgered !== null &&
        revLedgered.captains.find((line) => line.userId === revPirate.id)
          ?.peerTradeProfit === 0 &&
        revLedgered.captains.find((line) => line.userId === revNew.id)
          ?.peerTradeProfit === 0,
      "while a save holding no peer ledger and a captain with no save at all both read zero rather than a missing number",
    );
    // The maroon is the server's own fact rather than a client's claim, so
    // a captain reporting a maroon the harbor never called reaches the
    // record as it is rather than as it was reported: the same claim the
    // conclusion refuses, read here off the line it would have had to move
    // to be believed.
    check(
      revLedgered !== null &&
        revLedgered.captains.every((line) => line.marooned === false),
      "and a voyage that voted nobody ashore marks nobody, the captain who reported one included",
    );

    // The second is the six captain harbor that voted a captain ashore and
    // was then wiped by its host. This is the ending the mark exists for:
    // there is no conclusion to read it off, and the captain is still
    // standing in the harbor it happened in, which is the other half of the
    // retention figure the concluded voyage above carries.
    const maroonWiped =
      (await telStored(maroonRoomId)).find(
        (row) => row.record?.outcome === "restarted",
      )?.record ?? null;
    check(
      maroonWiped !== null &&
        maroonWiped.captains.find((line) => line.userId === maroonTargetId)
          ?.marooned === true &&
        maroonWiped.captains.filter((line) => line.marooned).length === 1 &&
        maroonWiped.captains.every((line) => line.presentAtEnd === true),
      "and a voyage its host wiped still carries the captain the harbor put ashore, since an ending with no conclusion is the one a mark derived from the events would have lost",
    );

    // ---- The voyage that is abandoned mid leg ----
    // One captain, alone in a harbor of their own, who walks out at leg
    // two. This is the plan's deliberately broken voyage, and the point of
    // it is that the record survives the harbor: the room is deleted the
    // moment its last seat goes, and a measurement that vanished with it
    // would read as a harbor where nobody ever abandons anything.
    const driftRoom = await telSail("abandoned", [telDrift]);
    const [driftSolo] = driftRoom.crewSockets;
    await telStand(driftSolo, driftRoom.roomId, 2, "parley");
    const driftLeft = await call<{ ok: boolean }>(
      `/api/rooms/${driftRoom.roomId}/leave`,
      { method: "POST", cookie: telDrift.cookie },
    );
    driftSolo.emit("room:leave", { roomId: driftRoom.roomId });
    const driftRoomRow = await db.room.findUnique({
      where: { id: driftRoom.roomId },
      select: { id: true },
    });
    check(
      driftLeft.status === 200 && driftRoomRow === null,
      "a harbor whose last seat is given up stops existing, which is the case a record has to outlive",
    );
    const driftRow = await telWaitForOne(driftRoom.roomId);
    const driftRecord = driftRow?.record ?? null;
    check(
      driftRecord !== null && driftRecord.outcome === "emptied",
      "and the voyage it was sailing leaves a record that says the harbor emptied out from under it",
    );
    if (!driftRecord) {
      throw new Error("No abandoned voyage to read the measurements off.");
    }
    check(
      driftRecord.endedAtLeg === 2 &&
        driftRecord.seats === 1 &&
        driftRecord.captains.length === 1 &&
        driftRecord.captains[0]?.userId === telDrift.id &&
        driftRecord.captains[0]?.presentAtEnd === false,
      "the record explains where the voyage stopped: leg two, one captain, and nobody in the harbor when it closed",
    );
    // The two fields goal I2 added on the ending with nothing to read them
    // from: the harbor emptied, so there is no conclusion and no save left
    // in the room, and the line still reads as a captain who was not put
    // ashore and who took nothing in trade. The same zero the concluded
    // voyage's unread captains get, which is what makes the field a reading
    // rather than a hole in the record.
    check(
      driftRecord.captains.every(
        (line) => line.marooned === false && line.peerTradeProfit === 0,
      ),
      "and it carries the two fields of a captain line as readings even though there was no conclusion to take them from",
    );
    const driftEvents = driftRecord.events;
    check(
      driftEvents.filter((event) => event.name === "leg_advanced").length ===
        1 &&
        driftEvents.filter(
          (event) =>
            event.name === "captain_left" &&
            event.actor === telDrift.id &&
            event.leg === 2,
        ).length === 1,
      "and it carries the leg the voyage reached and the abandonment that ended it",
    );

    // ---- The voyage its host wipes ----
    // A restart is the third way a voyage stops, and the one that has to
    // prove forgetting as well as writing: the record is closed by the
    // frame that reopens the harbor, and nothing the harbor does afterwards
    // belongs to it.
    const wipeRoom = await telSail("wiped", [telWipe]);
    const [wipeSolo] = wipeRoom.crewSockets;
    await telStand(wipeSolo, wipeRoom.roomId, 2, "parley");
    wipeSolo.emit("chat:room", {
      roomId: wipeRoom.roomId,
      content: "Wreck ahead.",
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const wipeFrame = waitForEvent<{ roomId?: string }>(
      wipeSolo,
      "room:restarted",
      (payload) => payload?.roomId === wipeRoom.roomId,
      8000,
    );
    wipeSolo.emit("room:restart", { roomId: wipeRoom.roomId });
    check(
      (await wipeFrame) !== null,
      "a host wipes the voyage they are sailing",
    );
    const wipeRow = await telWaitForOne(wipeRoom.roomId);
    const wipeRecord = wipeRow?.record ?? null;
    check(
      wipeRecord !== null &&
        wipeRecord.outcome === "restarted" &&
        wipeRecord.endedAtLeg === 2 &&
        wipeRecord.captains[0]?.presentAtEnd === true,
      "and the record says the voyage was wiped at leg two, with the captain who wiped it still standing in the harbor",
    );
    check(
      wipeRecord !== null &&
        wipeRecord.captains[0]?.marooned === false &&
        wipeRecord.captains[0]?.peerTradeProfit === 0,
      "with the two fields of their line read the same way, since a harbor that voted nobody ashore and left no save to read reads exactly this",
    );
    check(
      wipeRecord !== null &&
        wipeRecord.events.some((event) => event.name === "message_sent") &&
        wipeRecord.events.filter((event) => event.name === "leg_advanced")
          .length === 1,
      "carrying what happened before the wipe rather than only the wipe itself",
    );
    // The harbor is live again and the spine has forgotten it: a report
    // filed into the reopened lobby lands nowhere, which is the difference
    // between a record that was closed and one that was merely written
    // down so far.
    const wipeStored = wipeRow?.row.record ?? "";
    wipeSolo.emit("telemetry:leg", {
      roomId: wipeRoom.roomId,
      leg: 1,
      ordersDealt: 9,
      ordersFilled: 9,
      distinctGoods: 9,
    });
    wipeSolo.emit("chat:room", {
      roomId: wipeRoom.roomId,
      content: "New voyage.",
    });
    await new Promise((resolve) => setTimeout(resolve, 600));
    const wipeAfter = await telStored(wipeRoom.roomId);
    check(
      wipeAfter.length === 1 && wipeAfter[0]?.row.record === wipeStored,
      "and the voyage that follows is a new one: nothing after the wipe reaches the record that was closed, and no second record is written",
    );

    console.log("\nThe balance dashboard");
    // Goal I3's evaluation is that somebody on balance duty can answer three
    // questions off one page in under a minute, and the arithmetic behind
    // that page is pure, so most of what is checked here is the reduction
    // itself rather than the screen: a window in, and the reading the page
    // prints out. The two ends of it are checked over the wire at the
    // bottom, because a reduction nothing can reach is not a dashboard.
    //
    // One record, shaped the way the spine writes one. Only the fields a
    // fixture is about are set from the arguments; the rest are what an
    // ordinary Gambit voyage carries, so a fixture stays a record rather
    // than becoming a shape of its own.
    const dashRecord = (
      roomId: string,
      over: Partial<TelemetryRecord> = {},
    ): TelemetryRecord => ({
      version: TELEMETRY_VERSION,
      voyageId: voyageIdFor(roomId, 1),
      roomId: roomId,
      voyageEpoch: 1,
      mode: "ocean_gambit",
      difficulty: "fair_winds",
      seats: 5,
      sampleRate: 1,
      openedAt: 0,
      startedAt: 60_000,
      endedAt: 70 * 60_000,
      outcome: "concluded",
      endedAtLeg: 12,
      captains: [],
      events: [],
      truncated: false,
      ...over,
    });
    // One captain's line, with the fields the marks and the mute live on
    // read as the ordinary case unless a fixture says otherwise: a captain
    // who was still in the harbor when the voyage closed, who was not put
    // ashore, who was not silenced, and who took nothing in trade.
    const dashLine = (
      userId: string,
      over: Partial<TelemetryRecord["captains"][number]> = {},
    ): TelemetryRecord["captains"][number] => ({
      userId,
      presentAtEnd: true,
      marooned: false,
      muted: false,
      peerTradeProfit: 0,
      ...over,
    });
    // A band's worth of chronicle rows: the wins and the losses one role
    // took at one table size, which is all the win rate reader asks of a
    // row and all a fixture here needs to say.
    const dashRows = (
      alignment: GambitRole,
      won: number,
      lost: number,
      seats: number,
    ): DashboardOutcome[] => [
      ...Array.from({ length: won }, () => ({
        alignment,
        won: true,
        seats,
        bankrupt: false,
      })),
      ...Array.from({ length: lost }, () => ({
        alignment,
        won: false,
        seats,
        bankrupt: false,
      })),
    ];

    // ---- An empty window ----
    // The state the page opens in before the mode has been played, which is
    // the one a fresh database would show. Every gate is still named and
    // still answered for: a page that printed nothing, or a zero, for a
    // gate nobody has measured is the instrument the plan warns about.
    const emptyReading = readDashboard({
      records: [],
      outcomes: [],
      unreadable: 0,
    });
    check(
      emptyReading.window.voyages === 0 &&
        emptyReading.window.captains === 0 &&
        emptyReading.window.sampleRate === 1 &&
        emptyReading.window.truncated === 0 &&
        emptyReading.window.unreadable === 0,
      "a window with no voyage in it reads as empty rather than as a rate of zero",
    );
    check(
      emptyReading.panels.map((panel) => panel.id).join(",") ===
        "seat,staples,variance,floor",
      "and the page still carries its four panels, in the plan's order",
    );
    check(
      emptyReading.panels.every(
        (panel) =>
          panel.state === "no reading" &&
          panel.readings.length > 0 &&
          panel.readings.every(
            (line) =>
              line.label.length > 0 &&
              line.value.length > 0 &&
              line.target.length > 0,
          ),
      ),
      "with every gate named, and every one of them saying it has no source rather than showing a blank row",
    );
    check(
      JSON.stringify(emptyReading.panels[0]?.readings[0]) ===
        JSON.stringify(emptyReading.frontPage),
      "and the front page number is the Barge revenue share, held in the seat panel as its own first reading so the two cannot drift apart",
    );

    // Every gate goal I4 lists, matched by the label the page gives it and
    // the target it is judged against, which is the one check that would
    // catch a gate dropped from a panel rather than only a panel dropped
    // from the page. The empty window is where the set is complete: a
    // window with voyages in it has the same gates with values beside
    // them, so the names are asserted here and the readings are asserted
    // against built windows below.
    const gateLines = emptyReading.panels.flatMap((panel) => panel.readings);
    const gates: [string, string][] = [
      ["Quartermaster fill", "above 70%"],
      ["Path pick rate", "12 to 28%"],
      ["Free Captain pick rate", "15 to 22%"],
      ["The top card's share of winning builds", "no card above 35%"],
      ["The top card pairing", "no pair above 62% over 40 appearances"],
      ["Charter split deviation", "no deviation above 20%"],
      ["Distinct goods traded", "above 60%"],
      ["Bourse fills", "above 60%"],
      ["Median hold utilization", "55 to 80%"],
      ["Captains bankrupt at the reveal", "under 12%"],
      ["Marooned captains still standing at the close", "above 90%"],
      ["Parley participation", "above 66%"],
      ["Session length at five captains, charted to reveal", "62 to 74 min"],
    ];
    check(
      gates.every(([label, target]) =>
        gateLines.some(
          (line) => line.label === label && line.target === target,
        ),
      ),
      "and every gate the launch goal lists is on a panel under its own name and its own target, so a gate cannot be dropped from the page without a panel losing a row",
    );
    check(
      (["honest", "broker", "pirate"] as const).every((role) =>
        gateLines.some(
          (line) =>
            line.label.startsWith(`${roleCard(role).title}, `) &&
            line.target ===
              `${WIN_RATE_TARGETS[role].floor} to ${WIN_RATE_TARGETS[role].ceiling}%`,
        ),
      ),
      "with the three win rate bands carried under the deck's own name for the card and each judged against its own target",
    );
    check(
      emptyReading.frontPage.label ===
        "Barge revenue share of all food spending" &&
        emptyReading.frontPage.target === "waits on Epic E",
      "and the front page number is named as the share of all food spending the proposal identifies, waiting on the epic that would measure it",
    );

    // ---- The window ----
    // What the page is reading, counted from the records rather than asked
    // for: two voyages and three captains between them, one voyage recorded
    // under a rate below one, one truncated, and two rows the route could
    // not read at all.
    const windowReading = readDashboard({
      records: [
        dashRecord("dash-a", {
          sampleRate: 0.5,
          truncated: true,
          captains: [dashLine("dash-p1"), dashLine("dash-p2")],
        }),
        dashRecord("dash-b", { captains: [dashLine("dash-p3")] }),
      ],
      outcomes: [],
      unreadable: 2,
    });
    check(
      windowReading.window.voyages === 2 &&
        windowReading.window.captains === 3 &&
        windowReading.window.truncated === 1 &&
        windowReading.window.unreadable === 2,
      "the window counts the voyages, the captains in them, and the records that would not read",
    );
    check(
      windowReading.window.sampleRate === 0.5,
      "and reports the lowest rate its records were sampled at, so a window that spans a config change is never read as the whole run",
    );

    // ---- The variance panel, over the rows the report reads ----
    // Three rated bands, every one of them inside its target: four won of
    // seven at the five seat Honest table, one won of five Pirates at six,
    // and two won of five Brokers at four. The page does not compute a rate
    // of its own, so what is checked is that the cells it shows are the
    // reader's own cells, under the deck's name for the role and the
    // reader's own verdict.
    const inBandOutcomes: DashboardOutcome[] = [
      ...dashRows("honest", 4, 3, 5),
      ...dashRows("pirate", 1, 4, 6),
      ...dashRows("broker", 2, 3, 4),
    ];
    const inBand = readDashboard({
      records: [dashRecord("dash-v")],
      outcomes: inBandOutcomes,
      unreadable: 0,
    });
    const ratedCells = readWinRates(inBandOutcomes).filter(
      (cell) => cell.rate !== null,
    );
    const inBandVariance = inBand.panels.find(
      (panel) => panel.id === "variance",
    );
    check(
      inBandVariance !== undefined &&
        ratedCells.length === 3 &&
        ratedCells.every((cell) =>
          inBandVariance.readings.some(
            (line) =>
              line.label ===
                `${roleCard(cell.alignment).title}, ${cell.band} seats` &&
              line.verdict === bandVerdict(cell.alignment, cell.rate),
          ),
        ),
      "every band the report reads appears on the page under the deck's own name for the role and the reader's own verdict, so the two cannot disagree about a rate",
    );
    check(
      inBandVariance !== undefined &&
        inBandVariance.state === "clear" &&
        inBandVariance.answer.startsWith(
          "Every gate this window can read sits inside it",
        ),
      "and a window whose rated bands are all inside their targets reads as inside them rather than as a number to interpret",
    );

    // The same page with one band under its target. The panel has to say
    // which band and what it read, not only that something is out: a state
    // chip on its own is the data dump the plan's evaluation warns about.
    const underBand = readDashboard({
      records: [dashRecord("dash-v2")],
      outcomes: [...inBandOutcomes, ...dashRows("broker", 0, 4, 6)],
      unreadable: 0,
    });
    const underVariance = underBand.panels.find(
      (panel) => panel.id === "variance",
    );
    const underLabel = `${roleCard("broker").title}, ${seatBand(6).label} seats`;
    check(
      underVariance !== undefined &&
        underVariance.state === "watch" &&
        underVariance.readings.some(
          (line) => line.label === underLabel && line.verdict === "under",
        ) &&
        underVariance.answer.includes(underLabel),
      "and one band under its target moves the panel to watching and names the band in the answer",
    );

    // ---- The three readings the spine can already answer ----
    // Session length is a clock the record carries: charted to closed, at
    // the five captain tune target, and only over the voyages that
    // concluded. The three hour harbor is in the window to be sat beside
    // the two ordinary ones, because a median a single long lobby can move
    // is not a reading of the ordinary voyage, and the four seat and the
    // emptied voyage are in it to be left out.
    //
    // The lobby fill time is the other clock a record carries, and it is
    // read one table size band at a time because the plan asks whether six
    // seats are worth supporting at all rather than how long a lobby takes
    // on average.
    const clockReading = readDashboard({
      records: [
        dashRecord("dash-c1", { endedAt: 60 * 60_000 }),
        dashRecord("dash-c2", { endedAt: 70 * 60_000 }),
        dashRecord("dash-c3", { endedAt: 200 * 60_000 }),
        dashRecord("dash-c4", { seats: 4, endedAt: 300 * 60_000 }),
        dashRecord("dash-c5", {
          outcome: "emptied",
          endedAt: 400 * 60_000,
          endedAtLeg: 3,
        }),
      ],
      outcomes: [],
      unreadable: 0,
    });
    const clockPanel = clockReading.panels.find(
      (panel) => panel.id === "variance",
    );
    const sessionLine = clockPanel?.readings.find((line) =>
      line.label.includes("Session length"),
    );
    check(
      sessionLine !== undefined &&
        sessionLine.value === "70 min, median of 3" &&
        sessionLine.verdict === "in",
      "session length is the median of the concluded five captain voyages, and a harbor that sat open for three hours does not move it",
    );
    const stopLine = clockPanel?.readings.find((line) =>
      line.label.includes("stopped before the reveal"),
    );
    check(
      stopLine !== undefined &&
        stopLine.value === "1 of 5, stopping at leg 3 on the median" &&
        stopLine.verdict === "ungated",
      "and where the voyages that stopped early stopped is measured without being judged, since the plan sets no line on it",
    );

    // The lobby fill time, one band at a time. The four seat band holds two
    // voyages twenty minutes apart, so its median is thirty minutes; the
    // six seat band holds one at five; and the five seat record in the
    // window is a harbor that emptied without ever setting sail, which is
    // what a zero start and the emptied outcome together describe. It is in
    // the window and in no band's rate, because seating a voyage that never
    // started at zero minutes would read as a table that filled instantly,
    // and because a band of voyages that did not happen is the one answer
    // this row must not give.
    const fillReading = readDashboard({
      records: [
        dashRecord("dash-f1", {
          seats: 4,
          startedAt: 20 * 60_000,
          endedAt: 60 * 60_000,
        }),
        dashRecord("dash-f2", {
          seats: 4,
          startedAt: 40 * 60_000,
          endedAt: 90 * 60_000,
        }),
        dashRecord("dash-f3", {
          seats: 6,
          startedAt: 5 * 60_000,
          endedAt: 30 * 60_000,
        }),
        dashRecord("dash-f4", {
          seats: 5,
          outcome: "emptied",
          startedAt: 0,
          endedAt: 40 * 60_000,
        }),
      ],
      outcomes: [],
      unreadable: 0,
    });
    const fillPanel = fillReading.panels.find(
      (panel) => panel.id === "variance",
    );
    const fillLine = fillPanel?.readings.find((line) =>
      line.label.includes("Lobby fill time"),
    );
    check(
      fillLine !== undefined &&
        fillLine.value ===
          "4 or fewer seats 30 min of 2; 5 seats none in the window; 6 or more seats 5 min of 1" &&
        fillLine.target === "no threshold in the plan" &&
        fillLine.verdict === "ungated",
      "the lobby fill time reads one band at a time under the deck's own band names, a band that saw no voyage says so rather than reading as a zero, and the row is measured without being judged",
    );
    check(
      fillPanel !== undefined &&
        fillPanel.state === "no reading" &&
        !fillPanel.answer.includes("Lobby fill time") &&
        fillPanel.gaps.some((gap) => gap.includes("voyageLegs")),
      "and a panel whose only measured row is the fill time still says it has nothing to judge, while naming the voyage length as the knob the plan shortens when a session runs long, because a comparison between bands is not one of the sixteen gates",
    );
    const emptyFill = emptyReading.panels
      .flatMap((panel) => panel.readings)
      .find((line) => line.label.includes("Lobby fill time"));
    check(
      emptyFill !== undefined &&
        emptyFill.value === "no voyage in the window" &&
        emptyFill.verdict === "unplayed",
      "while a window with no voyage in it says as much, rather than printing three bands of nothing",
    );

    // ---- The floor ----
    // Retention is read off the two fields goal I2 added to a captain line,
    // and only over the voyages that closed with somebody standing: a
    // harbor that emptied has nobody left to be standing, so its lines
    // cannot answer the question and are left out of the denominator rather
    // than counted as departures.
    const floorReading = readDashboard({
      records: [
        dashRecord("dash-f1", {
          captains: [
            dashLine("dash-f-present-a", { marooned: true }),
            dashLine("dash-f-present-b", { marooned: true }),
            dashLine("dash-f-away", { marooned: true, presentAtEnd: false }),
          ],
        }),
        dashRecord("dash-f2", {
          outcome: "emptied",
          captains: [
            dashLine("dash-f-emptied", {
              marooned: true,
              presentAtEnd: false,
            }),
          ],
        }),
      ],
      outcomes: [
        { alignment: "honest", won: true, seats: 5, bankrupt: false },
        { alignment: "honest", won: false, seats: 5, bankrupt: true },
        { alignment: "pirate", won: false, seats: 5, bankrupt: false },
        { alignment: "broker", won: false, seats: 5, bankrupt: false },
      ],
      unreadable: 0,
    });
    const floorPanel = floorReading.panels.find(
      (panel) => panel.id === "floor",
    );
    const retentionLine = floorPanel?.readings.find((line) =>
      line.label.includes("Marooned captains"),
    );
    check(
      retentionLine !== undefined &&
        retentionLine.value === "66.7% of 3" &&
        retentionLine.verdict === "under",
      "retention is the share of the captains put ashore who were still standing at the close, over the voyages that had a close, and it is judged against the plan's ninety percent",
    );
    const bankruptcyLine = floorPanel?.readings.find((line) =>
      line.label.includes("bankrupt"),
    );
    check(
      bankruptcyLine !== undefined &&
        bankruptcyLine.value === "25.0% of 4" &&
        bankruptcyLine.verdict === "over",
      "and bankruptcy is a share of the chronicle rows in the window rather than of the records, since it is the one launch fact the record does not carry",
    );
    check(
      floorPanel !== undefined && floorPanel.state === "watch",
      "so a floor with two of its gates out of band reads as one to watch rather than as a clear one",
    );
    // The reading is a statement about the mode rather than about the
    // people in it. The captain lines retention is read from carry a user
    // id, and the reduction has to leave it behind: a page that shipped one
    // would be a page an operator could read a captain's voyage off.
    check(
      !JSON.stringify(floorReading).includes("dash-f-present-a"),
      "and nothing in the reading names a captain, since the page is about the mode rather than about who sailed it",
    );

    // ---- The route the page reads ----
    // The page's own check is a convenience that keeps a captain from being
    // shown a dashboard, so the gate is checked here the way the console's
    // is: the server is what has to refuse, against the account row.
    const noBalance = await call<{ error?: string }>("/api/admin/balance");
    check(
      noBalance.status === 401,
      "a stranger asking for the balance reading is refused",
    );
    const captainBalance = await call<{ error?: string }>(
      "/api/admin/balance",
      {
        cookie: run.host.cookie,
      },
    );
    check(
      captainBalance.status === 403 &&
        captainBalance.body?.error === "This account is not an administrator.",
      "and a signed in captain is refused in the words the realtime layer uses, so the two surfaces cannot describe one refusal two ways",
    );
    const operatorBalance = await call<{ reading?: DashboardReading }>(
      "/api/admin/balance",
      { cookie: operator.cookie },
    );
    const liveReading = operatorBalance.body?.reading;
    check(
      operatorBalance.status === 200 && liveReading !== undefined,
      "the operator is handed the reading",
    );
    check(
      liveReading !== undefined &&
        liveReading.window.voyages > 0 &&
        liveReading.window.captains > 0,
      "over the Gambit voyages this run recorded rather than over an empty window",
    );
    check(
      liveReading !== undefined &&
        liveReading.panels.map((panel) => panel.id).join(",") ===
          "seat,staples,variance,floor" &&
        liveReading.frontPage.verdict === "unmeasured",
      "carrying the four panels in the plan's order, with the front page number held in its slot",
    );
    check(
      liveReading !== undefined &&
        !JSON.stringify(liveReading).includes(telHome.id),
      "and naming no captain on the wire, exactly as on the page",
    );

    // ---- The page itself ----
    // The route above is the page's only wire, so the last thing to check
    // is that the page is served at all. It is a client component, so what
    // the server sends is the sentence it waits on, which is the one string
    // it can be recognized by before any reading has arrived.
    const balancePage = await fetch(`${BASE}/admin/balance`);
    const balanceHtml = await balancePage.text();
    check(
      balancePage.status === 200 &&
        balanceHtml.includes("Reading the balance..."),
      "GET /admin/balance serves the dashboard page",
    );

    console.log("\nThe launch gates");
    // Goal I4's ship decision, over the readings the dashboard has just
    // built. The verdict is a reduction with no database behind it, so what
    // is checked here is that it withholds the decision in every way the
    // plan says it must and gives it only over the whole of what the plan
    // asks for. The last two checks are the run's own window, over the wire.
    const emptyVerdict = readLaunchVerdict(emptyReading);
    check(
      emptyVerdict.gates.length === LAUNCH_GATE_IDS.length &&
        emptyVerdict.gates.map((gate) => gate.id).join(",") ===
          LAUNCH_GATE_IDS.join(","),
      "the verdict reads the plan's sixteen gates in the plan's order, whatever state each one is in",
    );
    check(
      LAUNCH_GATE_IDS.every((id) => gateLines.some((line) => line.gate === id)),
      "and every one of them is carried by a row on the page, so a gate the plan lists and the page forgets cannot leave the decision short by one",
    );
    check(
      emptyVerdict.state === "unjudged" &&
        emptyVerdict.answer ===
          `No verdict yet: the run stands at 0 of ${LAUNCH_MINIMUM_VOYAGES} recorded voyages.`,
      "an empty window reads as no verdict rather than as a clear one, and says what it is short of",
    );
    check(
      emptyVerdict.tally ===
        "0 of 16 gates inside their bands, 0 out of band, 9 with no source, 7 with no voyage to read.",
      "and the tally counts the gates by where they stand, keeping the zeroes rather than dropping them, so a quiet line and a good line cannot read the same",
    );

    // A reading whose every gate is inside its band, over a full run. The
    // mode cannot produce this yet, since thirteen of the sixteen gates have
    // no source and three have no voyage, so the fixture forces them: what
    // is being checked is the verdict's own rule about what a clear mode
    // costs rather than what the mode has built.
    const forcedIn = emptyReading.panels.map((panel) => ({
      ...panel,
      state: "clear" as const,
      readings: panel.readings.map((line) => ({
        ...line,
        verdict: "in" as const,
      })),
    }));
    const fullRun: DashboardReading = {
      ...emptyReading,
      window: {
        ...emptyReading.window,
        voyages: LAUNCH_MINIMUM_VOYAGES,
        captains: 1500,
      },
      panels: forcedIn,
    };
    const clearVerdict = readLaunchVerdict(fullRun);
    check(
      clearVerdict.state === "clear" &&
        clearVerdict.gaps.length === 0 &&
        clearVerdict.answer ===
          `Clear to ship: all 16 gates sit inside their bands over ${LAUNCH_MINIMUM_VOYAGES} recorded voyages.`,
      "a full run with every gate inside its band clears the mode to ship in one sentence",
    );
    check(
      readLaunchVerdict({
        ...fullRun,
        window: { ...fullRun.window, voyages: LAUNCH_MINIMUM_VOYAGES - 1 },
      }).answer ===
        `No verdict yet: the run stands at ${
          LAUNCH_MINIMUM_VOYAGES - 1
        } of ${LAUNCH_MINIMUM_VOYAGES} recorded voyages.`,
      "and one voyage short of the plan's three hundred withholds it, because a gate read over fewer is a reading rather than evidence",
    );
    // The three window facts that make a window a sample of the run rather
    // than the run: a rate below one, a record that hit the event cap, and a
    // record that would not read. Each one alone withholds the decision over
    // an otherwise perfect window, and each is then the only reason left.
    const thinning = [
      { sampleRate: 0.5, truncated: 0, unreadable: 0 },
      { sampleRate: 1, truncated: 1, unreadable: 0 },
      { sampleRate: 1, truncated: 0, unreadable: 1 },
    ];
    check(
      thinning.every((window) => {
        const verdict = readLaunchVerdict({
          ...fullRun,
          window: { ...fullRun.window, ...window },
        });
        return verdict.state === "unjudged" && verdict.gaps.length === 1;
      }),
      "a window recorded at a sample rate below one, or holding a record that hit the event cap or would not read, withholds it too, since the floor is voyages that happened rather than voyages that were kept",
    );

    // The one way to be held: a gate out of band. The priority rule is
    // exercised in both directions, because a rule naming one gate as
    // untouchable has to say nothing when some other gate is the one that
    // failed.
    const heldBy = (label: string, verdict: "under" | "over") =>
      readLaunchVerdict({
        ...fullRun,
        panels: fullRun.panels.map((panel) => ({
          ...panel,
          state: "watch" as const,
          readings: panel.readings.map((line) =>
            line.label === label ? { ...line, verdict } : line,
          ),
        })),
      });
    const heldByPriority = heldBy("Free Captain pick rate", "under");
    check(
      heldByPriority.state === "held" &&
        heldByPriority.failing.length === 1 &&
        heldByPriority.untradeable?.id === "free_captain_pick_rate" &&
        heldByPriority.answer.includes("cannot be traded against the others"),
      "a gate out of band holds the mode, and a failure in the plan's own priority is named as the gate that cannot be traded away when two of them conflict",
    );
    const heldByOther = heldBy(
      "The top card's share of winning builds",
      "over",
    );
    check(
      heldByOther.state === "held" &&
        heldByOther.failing.length === 1 &&
        heldByOther.untradeable === null &&
        !heldByOther.answer.includes("cannot be traded"),
      "while a gate off the priority list failing holds the mode without claiming the priority, which is the rule in the direction it does not apply",
    );
    const floorVerdict = readLaunchVerdict(floorReading);
    check(
      // Five rather than the floor's own two: the role rates read off the
      // same four chronicle rows are out of band as well, so this check
      // fails if the verdict stops gathering gates from the whole page.
      floorVerdict.state === "held" &&
        floorVerdict.failing.length === 5 &&
        floorVerdict.failing.some((gate) => gate.id === "maroon_retention") &&
        floorVerdict.failing.some((gate) => gate.id === "bankruptcy") &&
        floorVerdict.answer.includes(
          "Marooned captains still standing at the close",
        ) &&
        floorVerdict.answer.includes("Captains bankrupt at the reveal"),
      "and the floor the dashboard built holds the mode alongside the three role rates the same chronicle rows read, naming the gates rather than printing a chip a reader has to interpret",
    );

    // Gates waiting on a voyage, over a window whose other fourteen are
    // read: the sentence has to say how many rather than sixteen, because a
    // reader on balance duty should not have to work out which it is
    // talking about. Two wait here, and each for its own reason: retention,
    // since the voyage in the window had nobody put ashore, and utilization,
    // since no captain of it filed a leg report from a split hold.
    const oneUnplayed = readLaunchVerdict(
      readDashboard({
        records: [dashRecord("dash-lone")],
        outcomes: inBandOutcomes,
        unreadable: 0,
      }),
    );
    check(
      oneUnplayed.unplayed.length === 2 &&
        oneUnplayed.gaps.some((gap) =>
          gap.includes("2 of the 16 gates have no voyage to read"),
        ),
      "and gates waiting on a voyage are described by their count, since two gates and sixteen are not the same finding",
    );

    // A gate whose row stopped carrying it. It cannot happen while the page
    // and the plan's list agree, which is checked above, and the verdict
    // fails closed on the day they stop: a decision taken over fifteen gates
    // is not the decision the plan asks for.
    const droppedGate = readLaunchVerdict({
      ...fullRun,
      panels: fullRun.panels.map((panel) => ({
        ...panel,
        readings: panel.readings.map((line) =>
          line.gate === "free_captain_pick_rate"
            ? { ...line, gate: undefined }
            : line,
        ),
      })),
    });
    check(
      droppedGate.state === "unjudged" &&
        droppedGate.unmeasured.length === 1 &&
        droppedGate.gaps.some((gap) => gap.includes("free_captain_pick_rate")),
      "and a gate the page stopped carrying withholds the decision rather than being skipped out of it, failing closed on the day the page and the plan disagree",
    );

    // ---- The run's own window ----
    const runVerdict =
      liveReading === undefined ? null : readLaunchVerdict(liveReading);
    check(
      runVerdict !== null &&
        runVerdict.voyages === liveReading?.window.voyages &&
        runVerdict.gates.length === LAUNCH_GATE_IDS.length &&
        runVerdict.state !== "clear" &&
        runVerdict.gaps.some((gap) =>
          gap.includes(`of ${LAUNCH_MINIMUM_VOYAGES} recorded voyages`),
        ),
      "the verdict over the run's own voyages reads the same window the page does and withholds the ship decision, naming the voyages it is short of",
    );
    check(
      runVerdict !== null && !JSON.stringify(runVerdict).includes(telHome.id),
      "and names no captain either, since the decision is about the mode rather than about who sailed it",
    );

    // ---- The voyage's length, and the table that sails it ----
    // [I5: session length, and table size] The plan makes the mode's length
    // a configuration restriction rather than a system of its own: the
    // ladder stays the founding mode's, and a mode that runs a different
    // voyage pins its own number on its own record. What is checked here is
    // that the pin is read through the one selector, that the state a
    // captain is handed carries it, that the copy a captain reads quotes
    // the voyage rather than the tier, and that a four captain harbor sails
    // the twelve legs to the end and is paid into the chronicle as a four
    // seat voyage. Four is also the smallest table the mode deals a
    // hidden card into, so the last fixture is the plan's "four has to be
    // genuinely good rather than a degraded mode" read end to end.
    check(
      (["fair_winds", "open_waters", "monsoon"] as const)
        .map((tier) => voyageRoundsFor("classic", tier))
        .join(",") === "8,12,16",
      "the founding mode keeps the tier's ladder, eight legs at Fair Winds and sixteen at Monsoon, so nothing about the base game's length moved",
    );
    check(
      (["fair_winds", "open_waters", "monsoon"] as const).every(
        (tier) => voyageRoundsFor("ocean_gambit", tier) === 12,
      ) &&
        MODES.ocean_gambit.voyageLegs === 12 &&
        MODES.classic.voyageLegs === null,
      "and a Gambit voyage runs twelve legs on every tier, pinned on the mode's own record rather than copied out of the tier beside it",
    );
    check(
      voyageRoundsFor("nonsense", "nonsense") === 8,
      "while a mode and a tier nobody recognises read as the founding voyage's eight legs, the same fallback every other reader of a mode or a tier makes",
    );

    // The state the captain is handed. This is the number the lap, the
    // chronicle row and the integrity ceiling all read, so it is checked
    // where it is minted rather than only where each of them uses it.
    check(
      voyageState({ mode: "ocean_gambit", difficulty: "fair_winds" })
        .maxRounds === 12 &&
        voyageState({ mode: "ocean_gambit", difficulty: "monsoon" })
          .maxRounds === 12 &&
        voyageState({ mode: "classic", difficulty: "fair_winds" }).maxRounds ===
          8,
      "a Gambit voyage is handed twelve legs whatever tier it is charted at, while the founding voyage still sails its tier's own ladder",
    );

    // The copy a captain reads. All three of these quoted the tier before
    // this feature, which was the same number as the voyage until a mode
    // could pin one, and the loan line's round is the voyage's last leg.
    // The wording is the record's, and it counts rounds: a voyage is the
    // whole run, so the guide's objective line is what states its length.
    check(
      guideText("ocean_gambit", "fair_winds").includes(
        "Sail one voyage of 12 rounds",
      ) &&
        tipsText("ocean_gambit", "fair_winds").includes("Round 12") &&
        tutorialSteps("ocean_gambit", "fair_winds")[0]?.content.includes(
          "one voyage of 12 rounds",
        ) &&
        guideText("classic", "fair_winds").includes(
          "Sail one voyage of 8 rounds",
        ) &&
        tipsText("classic", "fair_winds").includes("Round 8"),
      "the guide, the advice and the tutorial quote the voyage's own length, so a twelve round table is never briefed on the eight round voyage its tier would have run",
    );

    // A four captain harbor, sailed to its end. The crew walks the legs the
    // way every harbor walks them, one checkpoint move at a time, and then
    // reports the endgame the way a finished voyage does: currentRound one
    // past the last leg, which is the number the engine's own endgame check
    // crosses. The endgame is a personal phase and never becomes a room
    // checkpoint, so the leg the record carries is the twelfth.
    const sizeHome = await signUp("size_a");
    const sizeMate = await signUp("size_b");
    const sizeThird = await signUp("size_c");
    const sizeFourth = await signUp("size_d");
    run.extraAccounts.push(sizeHome, sizeMate, sizeThird, sizeFourth);
    const sizeRoom = await telSail("four seat", [
      sizeHome,
      sizeMate,
      sizeThird,
      sizeFourth,
    ]);
    const sizeRoomId = sizeRoom.roomId;
    const sizeEnds = waitForEvent<{ roomId?: string }>(
      sizeRoom.crewSockets[0],
      "voyage:reveal",
      (payload) => payload?.roomId === sizeRoomId,
      10000,
    );
    for (let leg = 1; leg <= 12; leg++) {
      await telStand(sizeRoom.crewSockets[0], sizeRoomId, leg, "parley");
    }
    for (const socket of sizeRoom.crewSockets) {
      socket.emit("game:status", {
        roomId: sizeRoomId,
        round: 13,
        phase: "endgame",
        phaseLabel: "Voyage Complete",
        gold: 150,
        reputation: 30,
        shipLevel: 1,
        gameOver: true,
        renownLevel: 3,
        marooned: false,
      });
    }
    await sizeEnds;

    const sizeRow = await telWaitForOne(sizeRoomId);
    const sizeRecord = sizeRow?.record ?? null;
    check(
      sizeRow?.row.outcome === "concluded" &&
        sizeRecord?.mode === "ocean_gambit" &&
        sizeRecord?.seats === 4 &&
        sizeRecord?.endedAtLeg === 12 &&
        sizeRecord?.captains.length === 4,
      "four captains sail a Gambit voyage its twelve legs to the reveal, and the record it leaves carries the four seats it was sailed with and the twelfth leg as the one it ended on",
    );
    const sizeChronicle = await db.voyageChronicle.findMany({
      where: { roomId: sizeRoomId },
      select: { rounds: true, seats: true, mode: true },
    });
    check(
      sizeChronicle.length === 4 &&
        sizeChronicle.every(
          (row) =>
            row.rounds === 12 && row.seats === 4 && row.mode === "ocean_gambit",
        ),
      "and every chronicle row the voyage writes names the twelve legs and the four seats together, which is the pair a later reader groups the four seat band by",
    );

    // ---- The Larder, and the crew that eats from it ----
    // [C1: the Larder and Short Rations] The crew is the artisan roster and
    // the Larder is what it eats: one ration a head a leg, bought at the
    // market, and a shortage when the count reaches zero. Three things are
    // checked here and they are worth naming before the first assertion.
    //
    // The switch is read from both sides inside one run, which is the whole
    // reason survivalLayerOn is not cached. Rollback is the plan's own test
    // of this layer: with the flag off a captain eats nothing, nothing is
    // slower and nothing is drawn, and a suite that could only hold one
    // value would be checking a build the operator is not necessarily
    // running.
    //
    // The reduction is checked through the engine's own settlement rather
    // than beside it. Walking the lap from Orders into Resolve is what
    // every captain does every leg, so if the slowdown only worked when
    // processProduction was called directly, this is where that shows.
    //
    // The buy is checked against both ceilings, because the hold's room and
    // the purse are two different reasons a purchase stops and a store that
    // confused them would sell a captain rations they cannot carry.
    //
    // Everything captain facing that the survival layer produces is dash
    // checked at the end of it, in one place, for the reason the manifest
    // line above is: the house rule covers every string a captain reads, and
    // the log lines these features write are read by the table. The crew's
    // own block below writes into that same accumulator rather than into a
    // second one.
    check(
      [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
        withEnv(
          "NEXT_PUBLIC_SURVIVAL",
          value,
          switchFor(GAMBIT, survivalLayerOn),
        ),
      ) &&
        ["off", "0", "OFF", " off ", "Off"].every(
          (value) =>
            !withEnv(
              "NEXT_PUBLIC_SURVIVAL",
              value,
              switchFor(GAMBIT, survivalLayerOn),
            ),
        ),
      "the provisions layer is on for every value except the word off and the digit zero, so a typo in the switch leaves the game playable rather than quietly deleting a system",
    );

    // [The mode boundary] And the other half of every switch's answer, held
    // here rather than inside each family's own block.
    //
    // The families below each check their own switch against the
    // environment, because that is the dial their slice of the plan
    // promised. What none of them can check is the rule that stands in
    // front of all nine, because the rule is about them together: Classic
    // is the shipped release and no system this branch added may reach it,
    // whatever an operator exported into the process. A check written per
    // family would be nine copies of one sentence, and the ninth is the one
    // a later feature would forget.
    //
    // So the nine are listed once, with the environment forced on rather
    // than left to whatever the runner exported, and every one of them has
    // to answer no in the shipped mode. The environment value is a real one
    // rather than undefined on purpose: a switch that answered no here
    // because the runner happened to leave the variable unset would be a
    // check that passes for the wrong reason.
    check(
      (
        [
          ["NEXT_PUBLIC_SURVIVAL", survivalLayerOn],
          ["NEXT_PUBLIC_CREW_LOSS", crewLossRuleOn],
          ["NEXT_PUBLIC_GARMENTS", garmentsLayerOn],
          ["NEXT_PUBLIC_SPLIT_HOLD", splitHoldOn],
          ["NEXT_PUBLIC_PATH_ORDERS", pathOrdersOn],
          ["NEXT_PUBLIC_ESCORT_CONTRACTS", escortContractsOn],
          ["NEXT_PUBLIC_REFITS", refitsOn],
          ["NEXT_PUBLIC_BAZAAR", bazaarRumorsOn],
          ["NEXT_PUBLIC_PATH_DRAFT", pathDraftOn],
        ] as ReadonlyArray<[string, (mode: unknown) => boolean]>
      ).every(
        ([name, read]) =>
          withEnv(name, "1", () => read(CLASSIC) === false) &&
          withEnv(name, undefined, () => read(CLASSIC) === false) &&
          withEnv(name, "1", () => read(GAMBIT) === true),
      ),
      "every switch of this release answers no in the shipped mode whatever the environment says, and yes in the mode that owns it: the boundary is the mode rather than the operator's export, so a deployment serving both harbors cannot hand a Classic table a system the mode does not have",
    );

    // The same boundary for the systems that have no switch of their own,
    // because they are gated by the mode record rather than by a dial: the
    // audit's rung, the standing order and the leg clock. A rung of null is
    // the whole of the first, and the two booleans below are the whole of
    // the other two.
    check(
      auditOpensAt(CLASSIC) === null &&
        auditOpensAt(GAMBIT) === AUDIT_FROM_ROUND &&
        modeConfig(CLASSIC).standingOrders === false &&
        modeConfig(GAMBIT).standingOrders === true &&
        modeConfig(CLASSIC).phaseClock === false &&
        modeConfig(GAMBIT).phaseClock === true &&
        modeConfig(CLASSIC).gambitSystems === false &&
        modeConfig(GAMBIT).gambitSystems === true,
      "the systems with no switch of their own go off with the mode as well: the shipped voyage opens no manifest, keeps no standing order and runs on no clock, and both records carry the two rungs they gate and the boundary every switch reads",
    );

    // Held on for every rule below, so this block reads the same rules
    // whatever the operator set at the door.
    const survivalLines: string[] = [];
    withEnv("NEXT_PUBLIC_SURVIVAL", "1", () => {
      const larderCrew = voyageState();
      larderCrew.money = 1000;
      check(
        crewSize(larderCrew) === 0 && !onShortRations(larderCrew),
        "a fresh captain has nobody aboard, and an empty larder over an empty roster is not a shortage: there is nobody going without",
      );
      hireWorker(larderCrew, "weaver", survivalLines);
      hireWorker(larderCrew, "weaver", survivalLines);
      check(
        crewSize(larderCrew) === 2 &&
          flatWorkerRoster(larderCrew).length === crewSize(larderCrew) &&
          larderCrew.workers.weaver.length === 2,
        "hiring artisans is what puts a crew aboard, counted through the one helper that flattens the roster rather than in a second place that could disagree with it",
      );

      // Eating, once a leg. The stamp is what makes "once" true rather than
      // hopeful, and the check is written as a second call in the same leg
      // because that is the shape of the defect it prevents: a leg opens
      // through more than one path, and charging a captain twice for one
      // leg is silent in every screen.
      larderCrew.larder = 10;
      larderCrew.currentRound = 3;
      feedCrew(larderCrew, survivalLines);
      feedCrew(larderCrew, survivalLines);
      const ateOnce =
        larderCrew.larder === 8 && larderCrew.larderFedRound === 3;
      larderCrew.currentRound = 4;
      feedCrew(larderCrew, survivalLines);
      check(
        ateOnce && larderCrew.larder === 6 && larderCrew.larderFedRound === 4,
        "the crew eats one ration a head and the leg is stamped, so a second call in the same leg eats nothing more while the next leg eats again",
      );

      // The floor, and the line that says so. A larder the crew emptied
      // reads as empty rather than in debt, and the leg the shortage begins
      // is the one that says it.
      larderCrew.larder = 1;
      larderCrew.currentRound = 5;
      const shortLines: string[] = [];
      feedCrew(larderCrew, shortLines);
      survivalLines.push(...shortLines);
      check(
        larderCrew.larder === 0 &&
          onShortRations(larderCrew) &&
          shortLines.length === 1 &&
          shortLines[0].includes("Short rations") &&
          shortLines[0].includes(`${Math.round(SHORT_RATIONS_YIELD * 100)}%`) &&
          !CARRIES_A_DASH.test(shortLines[0]),
        "a larder the crew empties reads as empty rather than in debt, and the leg announces the shortage at the pace the rule actually applies",
      );

      check(
        shortRationsYield(6) === 3 &&
          shortRationsYield(4) === 2 &&
          shortRationsYield(3) === 1 &&
          shortRationsYield(2) === 1 &&
          shortRationsYield(1) === 1 &&
          shortRationsYield(0) === 1,
        "a hungry crew works at half pace, floored at one item, because a task spends its recipe when it is assigned and a yield that rounded away to nothing would take the goods and return silence",
      );

      // The reduction through the engine's own lap. Three workshops walked
      // from Orders into Resolve with the same artisan and the same
      // materials, so the only difference between any two holds is the one
      // being read: the larder for the first pair, and the module for the
      // second. The third is hungry as well as equipped, because what it
      // settles is that the module's bonus is applied before the shortage
      // takes its share rather than after, and a fed workshop would settle
      // nothing about the order the two run in.
      const larderCtx: GameContext = {
        seedBase: `smoke:larder:${suffix}`,
        harborId: `smoke-larder-${suffix}`,
      };
      const shops: Array<{ state: GameState; label: string }> = [];
      for (const label of ["fed", "hungry", "workshop"]) {
        const state = voyageState();
        state.money = 1000;
        hireWorker(state, "weaver", []);
        state.workers.weaver[0].isSkilled = true;
        if (label === "workshop") {
          const workshop = MODULES.find((m) => m.id === "artisans_workshop");
          if (workshop) state.equippedModules.push(workshop);
        }
        assignTask(state, "weaver", "Linen Clothes", []);
        state.phase = "orders";
        // Every workshop but the fed one goes into the leg with an empty
        // larder, so the shortage is the state under test rather than a
        // side effect of how much the crew happened to have.
        state.larder = label === "fed" ? LARDER_START : 0;
        shops.push({ state, label });
      }
      const before = shops.map(
        (shop) => shop.state.inventory["Linen Clothes"] ?? 0,
      );
      // Pressed until the books are settled rather than pressed once, because
      // which phase follows Orders is the mode's own decision: the founding
      // lap goes straight from the manifest to the settlement, and the lap
      // this layer belongs to puts the exchange between them. A single press
      // would walk one of those two modes into a leg that makes nothing and
      // the check would read the empty hold as the rule under test. The bound
      // is the longest lap plus a margin, and it is a bound rather than a
      // count so that a lap that grows a leg still walks.
      for (const shop of shops) {
        for (let step = 0; step < 8 && shop.state.phase !== "resolve"; step++) {
          nextPhase(shop.state, larderCtx, []);
        }
      }
      const made = shops.map(
        (shop, index) =>
          (shop.state.inventory["Linen Clothes"] ?? 0) - before[index],
      );
      check(
        made[0] === 2 && made[1] === 1,
        "walking the lap into Resolve makes a skilled artisan's two goods while the crew is fed and one while it is not, so the plan's slower crafting lands through the engine every captain already walks rather than beside it",
      );
      check(
        made[2] === 1,
        "and an Artisan's Workshop's third good is halved to one as well, so the module's bonus is applied before the shortage takes its share rather than after",
      );

      // Buying. Two ceilings and a floor, each read on its own state so one
      // cannot be mistaken for another.
      const buyer = voyageState();
      buyer.money = 1000;
      hireWorker(buyer, "weaver", []);
      hireWorker(buyer, "weaver", []);
      // Emptied first, because a fresh voyage is handed a full opening hold
      // (see LARDER_START) and what this check is about is what a purchase
      // adds to it rather than what it was already carrying.
      buyer.larder = 0;
      const buyLines: string[] = [];
      const boughtLegs = provisionFood(buyer, "Grain", 2, buyLines);
      check(
        boughtLegs === 2 &&
          buyer.larder === 4 &&
          buyer.money === 1000 - 4 * RATION_PRICE &&
          buyer.roundCosts === 4 * RATION_PRICE &&
          buyer.totalCosts === 4 * RATION_PRICE &&
          // The panel's own read of what still fits, made the way the panel
          // makes it: the stores' room for the food being bought, over the
          // crew it has to feed.
          Math.floor(foodRoomMeals(buyer, "Grain") / crewSize(buyer)) === 28,
        "provisioning buys a leg at a time for the crew aboard, and what it spends is booked where every other purchase is booked",
      );
      const filledRoom = Math.floor(
        foodRoomMeals(buyer, "Grain") / crewSize(buyer),
      );
      const filledLegs = provisionFood(buyer, "Grain", 999, buyLines);
      check(
        filledLegs === filledRoom &&
          buyer.larder === LARDER_MAX &&
          provisionFood(buyer, "Grain", 1, buyLines) === 0 &&
          buyLines[buyLines.length - 1] === "🧺 The larder is full.",
        "a request past the hold's room fills it and stops there, and a full larder says so rather than taking a press and returning nothing",
      );

      const thin = voyageState();
      thin.money = 100;
      hireWorker(thin, "weaver", []);
      thin.money = 1;
      const thinLines: string[] = [];
      check(
        provisionFood(thin, "Grain", 1, thinLines) === 0 && thin.money === 1,
        "and a purse that cannot cover one leg of rations buys nothing rather than going into debt for it",
      );
      const crewless = voyageState();
      crewless.money = 100;
      const crewlessLines: string[] = [];
      check(
        provisionFood(crewless, "Grain", 1, crewlessLines) === 0 &&
          crewSize(crewless) === 0 &&
          crewlessLines.length === 1,
        "while a captain with nobody aboard has nothing to provision and is told so in one line, which is the same answer that case already gives a buyer",
      );

      // Every line this block produced, gathered here rather than threaded
      // through each check, since the dash rule is about the whole set.
      survivalLines.push(...buyLines, ...thinLines, ...crewlessLines);

      // A save read back. The end a count is clamped to is the hold the
      // build is actually running, which [C4] moved: the stores' own
      // ceiling under the split and the Larder's old sixty without it. The
      // check reads that end from the model rather than writing it down,
      // so it follows the hold rather than a number the split left behind.
      const larderEnd = holdCapacityOn(GAMBIT)
        ? storesMealCeiling()
        : LARDER_MAX;
      check(
        normalizeLarder(undefined, GAMBIT) === LARDER_START &&
          normalizeLarder("seven", GAMBIT) === LARDER_START &&
          normalizeLarder(NaN, GAMBIT) === LARDER_START &&
          normalizeLarder(7.8, GAMBIT) === 7 &&
          normalizeLarder(-4, GAMBIT) === 0 &&
          normalizeLarder(larderEnd + 90, GAMBIT) === larderEnd &&
          normalizeLarderFedRound(undefined) === 0 &&
          normalizeLarderFedRound(-2) === 0 &&
          normalizeLarderFedRound(2.5) === 2,
        "a save this build cannot read heals to a full hold rather than to a hungry one, a count outside the hold's ends is clamped rather than dropped, and a missing leg stamp lands on a leg no voyage has",
      );
    });

    // ---- The crew, by name ----
    // [C2: crew loss by name] Two legs hungry in a row cost the newest hand
    // aboard, by name and for good. Three things are checked here, and they
    // are worth naming before the first assertion.
    //
    // The run is counted rather than reconstructed, so it is checked the way
    // it is advanced: one call a leg, with the reset read on both sides of
    // it. The leg the crew eats in between is the one that matters, because
    // a run that counted hungry legs ever rather than in a row would pass
    // every other check down here and still take a hand from a captain who
    // provisioned through the shortage.
    //
    // The victim is a rule rather than a roll, and the rule is the newest
    // aboard, so the check reads the two names apart rather than the count
    // down: a roster of two that loses a member says nothing about which
    // hand went.
    //
    // The tick is checked through the engine's own Dawn rather than beside
    // it, for the reason the Larder's reduction is checked through the lap.
    // startBoonDrafting is the one function every leg opens through, and a
    // price that only landed when settleHunger was called directly is
    // exactly the defect a check that called it directly would miss. The
    // second call in the same leg is in there because that is the shape of
    // the defect it prevents: a leg opens through more than one path.
    //
    // And a save written before any of this existed is read back, because
    // every voyage in flight the day this ships is one of those. The roster
    // has to heal to named hands rather than to blanks, and the two new
    // fields have to heal to the state of a captain who never went hungry.
    check(
      [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
        withEnv(
          "NEXT_PUBLIC_CREW_LOSS",
          value,
          switchFor(GAMBIT, crewLossRuleOn),
        ),
      ) &&
        ["off", "0", "OFF", " off ", "Off"].every(
          (value) =>
            !withEnv(
              "NEXT_PUBLIC_CREW_LOSS",
              value,
              switchFor(GAMBIT, crewLossRuleOn),
            ),
        ),
      "the crew loss rule is on for every value except the word off and the digit zero, read through the same policy the provisions layer is read through rather than through a second copy of it",
    );

    withEnv("NEXT_PUBLIC_SURVIVAL", "1", () =>
      withEnv("NEXT_PUBLIC_CREW_LOSS", "1", () => {
        // The pool the names come out of, checked before the rule that
        // spends it: a duplicate or a two word name in here is damage no
        // rule below could produce, and every roster of every voyage would
        // inherit it.
        check(
          CREW_NAMES.length > 0 &&
            CREW_NAMES.every((name) => /^[A-Za-z]+$/.test(name)) &&
            new Set(CREW_NAMES).size === CREW_NAMES.length,
          "every name the crew is drawn from is one word of letters and no name appears twice, so a hand can be named in a line the table reads and the pool itself cannot hand two hands one name",
        );

        // The run, the hand, and the ledger. The round is set rather than
        // inherited, so the leg on the record is a number this check chose
        // and a record that wrote the wrong one cannot pass.
        const hungry = voyageState();
        hungry.money = 1000;
        hungry.currentRound = 7;
        hireWorker(hungry, "weaver", survivalLines);
        hireWorker(hungry, "weaver", survivalLines);
        const longestAboard = hungry.workers.weaver[0].name;
        const newestAboard = hungry.workers.weaver[1].name;
        hungry.larder = 0;
        const lossLines: string[] = [];
        settleHunger(hungry, lossLines);
        const oneLegIn =
          hungry.hungryLegs === 1 && hungry.crewLost.length === 0;
        settleHunger(hungry, lossLines);
        survivalLines.push(...lossLines);
        check(
          oneLegIn &&
            hungry.hungryLegs === 0 &&
            hungry.crewLost.length === 1 &&
            hungry.crewLost[0].name === newestAboard &&
            hungry.crewLost[0].round === 7 &&
            hungry.workers.weaver.length === 1 &&
            hungry.workers.weaver[0].name === longestAboard &&
            lossLines.some((line) => line.includes(newestAboard)) &&
            lossLines.some((line) =>
              line.includes(`${CREW_LOSS_AFTER_HUNGRY_LEGS} legs`),
            ),
          "the second leg hungry in a row takes the newest hand aboard by name, writes the leg it happened on beside them, resets the run and says so, while the artisan who was already at the bench keeps it",
        );

        // A name once spent is not handed out again while the voyage
        // remembers it, the lost as much as the living, and the hand who
        // replaces them is the newest aboard for the next loss.
        hireWorker(hungry, "weaver", survivalLines);
        const aboard = flatWorkerRoster(hungry).map((worker) => worker.name);
        const remembered = hungry.crewLost.map((loss) => loss.name);
        const replacement =
          hungry.workers.weaver[hungry.workers.weaver.length - 1];
        check(
          aboard.length === 2 &&
            aboard.every((name) => CREW_NAMES.includes(name)) &&
            new Set([...aboard, ...remembered]).size ===
              aboard.length + remembered.length &&
            replacement.seq > hungry.workers.weaver[0].seq,
          "a name this voyage has already spent is not handed to the next hire, and the hand who joins is the newest aboard, so the one lost over the side is not quietly replaced by a stranger wearing their name",
        );

        // A fed leg resets the run rather than pausing it.
        const fed = voyageState();
        fed.money = 1000;
        hireWorker(fed, "weaver", survivalLines);
        fed.larder = 0;
        settleHunger(fed, []);
        fed.larder = 4;
        settleHunger(fed, []);
        const afterMeal = fed.hungryLegs === 0;
        fed.larder = 0;
        settleHunger(fed, []);
        check(
          afterMeal &&
            fed.hungryLegs === 1 &&
            fed.crewLost.length === 0 &&
            fed.workers.weaver.length === 1,
          "a leg the crew eats resets the run, so hunger that a purchase breaks and then lets return counts again from the first bad leg rather than taking a hand for a shortage the captain already provisioned through",
        );

        // The price is settled at the one moment the leg's meal is, through
        // the function every leg opens through.
        const dawn = voyageState();
        dawn.money = 1000;
        hireWorker(dawn, "weaver", survivalLines);
        dawn.larder = 0;
        startBoonDrafting(dawn, []);
        startBoonDrafting(dawn, []);
        const onceALeg = dawn.hungryLegs === 1 && dawn.crewLost.length === 0;
        dawn.currentRound += 1;
        startBoonDrafting(dawn, []);
        check(
          onceALeg &&
            dawn.hungryLegs === 0 &&
            dawn.crewLost.length === 1 &&
            dawn.workers.weaver.length === 0,
          "the run advances at the one moment a leg's meal is settled, so a Dawn a client reaches twice charges one leg of hunger once and the next leg is the one that takes the hand",
        );

        // A save written before the crew had names. Every member is written
        // the way the build before this one wrote them: no identity at all.
        const legacy = voyageState();
        legacy.money = 1000;
        hireWorker(legacy, "weaver", []);
        hireWorker(legacy, "potter", []);
        for (const worker of flatWorkerRoster(legacy)) {
          delete (worker as Partial<Worker>).name;
          delete (worker as Partial<Worker>).seq;
        }
        legacy.hungryLegs = Number.NaN;
        healCrewIdentity(legacy);
        const healed = flatWorkerRoster(legacy);
        check(
          healed.length === 2 &&
            healed.every(
              (worker) =>
                CREW_NAMES.includes(worker.name) &&
                Number.isInteger(worker.seq) &&
                worker.seq >= 1,
            ) &&
            new Set(healed.map((worker) => worker.name)).size === 2 &&
            new Set(healed.map((worker) => worker.seq)).size === 2 &&
            legacy.hungryLegs === 0 &&
            legacy.crewLost.length === 0,
          "a save written before the crew had names heals to a roster of people rather than of blanks, each with a name from the pool and a number of their own, and a run it cannot read heals to nobody hungry yet",
        );

        // Two hands claiming one name, which the draw exists to prevent and
        // a hand written save can still produce.
        const twins = voyageState();
        twins.money = 1000;
        hireWorker(twins, "weaver", survivalLines);
        hireWorker(twins, "weaver", survivalLines);
        const claimant = twins.workers.weaver[0].name;
        twins.workers.weaver[1].name = claimant;
        healCrewIdentity(twins);
        check(
          twins.workers.weaver[0].name === claimant &&
            twins.workers.weaver[1].name !== claimant &&
            CREW_NAMES.includes(twins.workers.weaver[1].name) &&
            twins.workers.weaver[0].seq !== twins.workers.weaver[1].seq,
          "a stored name is kept rather than redrawn, and two hands claiming one name resolve to one claimant and one fresh draw, since a roster of two people called Ada is exactly what the draw is for",
        );

        check(
          normalizeHungryLegs(undefined) === 0 &&
            normalizeHungryLegs(Number.NaN) === 0 &&
            normalizeHungryLegs(-3) === 0 &&
            normalizeHungryLegs(2.9) === 2 &&
            normalizeCrewLost(undefined).length === 0 &&
            normalizeCrewLost("Runa").length === 0 &&
            normalizeCrewLost([{ name: "Runa", round: 4.8 }, null, 7, {}])
              .length === 1 &&
            normalizeCrewLost([{ name: "Runa", round: 4.8 }])[0].round === 4,
          "a run or a record of losses this build cannot read heals to none rather than to an invented hand, while a loss that does name one survives the read with the leg it was taken on",
        );

        // The same two legs with the rule switched off, read inside the
        // layer that is on. Read anywhere else this check would pass for the
        // wrong reason: with the provisions off there is no shortage to lose
        // anyone to, and the check would be measuring that instead.
        check(
          withEnv("NEXT_PUBLIC_CREW_LOSS", "off", () => {
            const spared = voyageState();
            spared.money = 1000;
            hireWorker(spared, "weaver", []);
            spared.larder = 0;
            const sparedLines: string[] = [];
            settleHunger(spared, sparedLines);
            settleHunger(spared, sparedLines);
            return (
              !crewLossRuleOn(GAMBIT) &&
              spared.hungryLegs === 0 &&
              spared.crewLost.length === 0 &&
              spared.workers.weaver.length === 1 &&
              spared.workers.weaver[0].name.length > 0 &&
              sparedLines.length === 0
            );
          }),
          "with the loss rule switched off hunger never takes a hand: the run stays at zero, the record stays empty and no line is spoken, while the roster keeps the names it already carries, so the rule can be rolled back without erasing anyone",
        );

        // And the layer governs it from above, which is why the two switches
        // are separate readings rather than one.
        check(
          withEnv("NEXT_PUBLIC_SURVIVAL", "off", () => {
            const unfed = voyageState();
            unfed.money = 1000;
            hireWorker(unfed, "weaver", []);
            unfed.larder = 0;
            settleHunger(unfed, []);
            settleHunger(unfed, []);
            return (
              crewLossRuleOn(GAMBIT) &&
              unfed.hungryLegs === 0 &&
              unfed.crewLost.length === 0 &&
              unfed.workers.weaver.length === 1
            );
          }),
          "and with the provisions switched off a captain loses nobody whatever the loss rule says, because a shortage the layer is not counting is not a shortage a hand can be taken for",
        );
      }),
    );

    // The two files this feature owns, read as files rather than asserted
    // about, so the rule covers their comments as well as the lines they
    // write. It is the same reading the standing order record and the
    // voyage log are held to, and it is the one check down here that no
    // runtime case can make.
    check(
      !carriesADash("src/lib/game/crew.ts") &&
        !carriesADash("src/lib/use-game-session.ts") &&
        !carriesADash(
          "src/components/portmasters/game/phases/WorkerMgmt.tsx",
        ) &&
        !carriesADash("src/components/portmasters/game/phases/Endgame.tsx"),
      "and the module the rule lives in, the hook that heals a voyage on load and the two panels a captain reads the crew on hold the house rule in their comments as well as in their code",
    );

    // The other side of the switch, read on its own so the check above can
    // stay about the rules rather than about the flag.
    check(
      withEnv("NEXT_PUBLIC_SURVIVAL", "off", () => {
        const dark = voyageState();
        dark.money = 100;
        hireWorker(dark, "weaver", []);
        dark.larder = 0;
        const darkLines: string[] = [];
        feedCrew(dark, darkLines);
        const boughtNothing = provisionFood(dark, "Grain", 3, darkLines) === 0;
        return (
          !survivalLayerOn(GAMBIT) &&
          !onShortRations(dark) &&
          dark.larder === 0 &&
          dark.larderFedRound === 0 &&
          dark.money === 100 &&
          boughtNothing &&
          darkLines.length === 0
        );
      }),
      "with the switch off nothing is eaten, nothing is bought, no leg is stamped and no shortage is claimed, so the base game is exactly as it was",
    );

    // The fleet sees a hungry crew. The plan asks for the state to be
    // publicly visible and its implementation clause says the visibility
    // rides the status broadcast the room already carries, so what is
    // checked here is the frame every captain is already listening to
    // rather than a channel built for this. A fed crew reports no mark at
    // all, which is the allow list read run the other way: only an
    // explicit true is a hungry crew, so a client that never had a larder
    // reads as fed rather than as unknown.
    const larderHome = await signUp("lard_h");
    run.extraAccounts.push(larderHome);
    const larderRoom = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: larderHome.cookie,
        body: JSON.stringify({
          name: `Smoke larder ${suffix}`,
          isPublic: false,
        }),
      },
    );
    if (larderRoom.status !== 200) {
      throw new Error("No harbor to report a hungry crew in.");
    }
    const larderRoomId = larderRoom.body.room.id;
    const larderSocket = await openAuthedSocket(larderHome);
    run.sockets.push(larderSocket);
    const larderSeated = waitForEvent<WireHistory>(
      larderSocket,
      "chat:history",
      (payload) => payload?.roomId === larderRoomId,
    );
    larderSocket.emit("room:join", { roomId: larderRoomId });
    await larderSeated;

    const larderFrames: Array<{ shortRations?: boolean }> = [];
    larderSocket.on(
      "game:status",
      (payload: { user?: { id?: string }; shortRations?: boolean }) => {
        if (payload?.user?.id !== larderHome.id) return;
        larderFrames.push(payload);
      },
    );
    const reportLarder = (shortRations: boolean) => {
      larderSocket.emit("game:status", {
        roomId: larderRoomId,
        round: 1,
        phase: "market",
        phaseLabel: "Market",
        gold: 100,
        reputation: 0,
        shipLevel: 0,
        gameOver: false,
        shortRations,
      });
    };
    reportLarder(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    reportLarder(false);
    await new Promise((resolve) => setTimeout(resolve, 400));
    check(
      larderFrames.length === 2 &&
        larderFrames[0].shortRations === true &&
        larderFrames[1].shortRations === undefined,
      "a hungry crew reaches the fleet on the status frame every captain already listens to, and a fed one reports no mark at all",
    );

    // ---- The clothes, and the cold ----
    // [C3: garments and the cold] One data model for three jobs: a garment
    // is a good with a warmth rating and a durability, a leg carries a
    // weather tag, and the check between them decides who freezes. Four
    // things about that are worth naming before the first assertion.
    //
    // The tag is drawn rather than stored, so what is checked is that it
    // belongs to the room rather than to a captain: the same voyage answers
    // the same way on every read, two captains holding different goods read
    // the same leg the same way, and a save carried through a round trip
    // answers it the same way again. That is what lets the forecast be read
    // in the browser with no wire field behind it and no clock in it.
    //
    // The check is read on both sides of its own line. A rule that only ever
    // bit or only ever spared would pass every other check down here, so one
    // cold leg is sailed twice, once bare and once dressed, and the two
    // voyages have to come out differently.
    //
    // The decay is read in the units the plan gives it and read twice in one
    // leg, because a leg opens through more than one path and a wardrobe
    // that decayed twice for one leg is a durability bar the player cannot
    // see moving.
    //
    // And the whole thing is walked once through the engine's own Resolve,
    // for the reason the Larder's reduction is walked through the lap: the
    // plan puts the tick inside settlement on the deterministic resolve
    // step, and a tick that only landed when it was called by name is
    // exactly the defect that check exists to catch.
    check(
      [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
        withEnv(
          "NEXT_PUBLIC_GARMENTS",
          value,
          switchFor(GAMBIT, garmentsLayerOn),
        ),
      ) &&
        ["off", "0", "OFF", " off ", "Off"].every(
          (value) =>
            !withEnv(
              "NEXT_PUBLIC_GARMENTS",
              value,
              switchFor(GAMBIT, garmentsLayerOn),
            ),
        ),
      "the garments layer is on for every value except the word off and the digit zero, read through the same policy the two switches above it are read through rather than through a third copy of it",
    );

    withEnv("NEXT_PUBLIC_SURVIVAL", "1", () =>
      withEnv("NEXT_PUBLIC_GARMENTS", "1", () => {
        // The catalogue, before any rule that reads it.
        check(
          Object.keys(GARMENTS).length === 3 &&
            GARMENTS["Linen Clothes"].warmth === 1 &&
            GARMENTS["Linen Clothes"].durability === 6 &&
            GARMENTS["Cotton Clothes"].warmth === 2 &&
            GARMENTS["Cotton Clothes"].durability === 8 &&
            GARMENTS.Brocade.warmth === 3 &&
            GARMENTS.Brocade.durability === 10,
          "the three garments carry the plan's own numbers, one warmth with six of durability, two with eight and three with ten, and nothing else in the tree is clothes",
        );
        check(
          garmentSpec("Brocade") !== null &&
            garmentSpec("Linen") === null &&
            garmentSpec("toString") === null &&
            garmentSpec(7) === null &&
            garmentWarmth(null) === 0 &&
            garmentWarmth({ good: "Sachet", durability: 9 }) === 0,
          "and a good is read as a garment only when the catalogue says so, so a save naming a raw material, a key the object's prototype happens to carry, or the one finished good the plan leaves out is read as a captain with nothing on rather than as warmth nobody can account for",
        );

        // Wearing, and the three ways it refuses. The hire writes into a
        // throwaway log so the four lines counted below are the wardrobe's
        // own.
        const wardrobe = voyageState();
        wardrobe.money = 1000;
        const dressLines: string[] = [];
        const crewless = wearGarment(wardrobe, "Brocade", dressLines) === false;
        hireWorker(wardrobe, "weaver", []);
        const emptyHold =
          wearGarment(wardrobe, "Brocade", dressLines) === false;
        wardrobe.inventory.Brocade = 2;
        const notClothes = wearGarment(wardrobe, "Linen", dressLines) === false;
        const wornNow = wearGarment(wardrobe, "Brocade", dressLines);
        check(
          crewless &&
            emptyHold &&
            notClothes &&
            wornNow &&
            wardrobe.inventory.Brocade === 1 &&
            wardrobe.garments.length === 1 &&
            wardrobe.garments[0].good === "Brocade" &&
            wardrobe.garments[0].durability === GARMENTS.Brocade.durability &&
            dressLines.length === 4 &&
            dressLines[3].includes(`Warmth ${GARMENTS.Brocade.warmth}`),
          "putting a garment on takes it out of the hold and onto the crew at its full durability, and the three ways it can fail each say why: nobody aboard, nothing of that good in the hold, or a good that is not clothing at all",
        );

        // The sum, and the multiplier under it.
        const tailor = voyageState();
        tailor.money = 1000;
        hireWorker(tailor, "weaver", []);
        for (const good of ["Linen Clothes", "Cotton Clothes", "Brocade"]) {
          tailor.inventory[good] = 1;
          wearGarment(tailor, good, []);
        }
        const aWholeBack = warmthScore(tailor) === 1 + 2 + 3;
        tailor.garments[1].durability = 4;
        tailor.garments[2].durability = 8;
        const partWorn = warmthScore(tailor);
        check(
          aWholeBack &&
            warmthText(warmthScore(voyageState())) === "0" &&
            Math.abs(garmentWarmth(tailor.garments[2]) - 2.4) < 1e-9 &&
            Math.abs(partWorn - 4.4) < 1e-9 &&
            warmthText(partWorn) === "4.4",
          "the warmth score is the plan's sum, one and two and three for a whole back and four and four tenths once the sea has had part of two of them, because a garment is worth its rating times the fraction of itself that is left rather than a number that steps down a rung at a time",
        );

        // The tag: drawn, deterministic, room wide and replayable.
        const weather = voyageState();
        weather.voyageEpoch = 4242;
        weather.currentRound = 4;
        const thisLeg = legIsCold(weather);
        const mate = voyageState();
        mate.voyageEpoch = 4242;
        mate.currentRound = 4;
        mate.money = 77;
        mate.score = 19;
        mate.inventory.Brocade = 3;
        hireWorker(mate, "potter", []);
        const recalled = JSON.parse(JSON.stringify(weather)) as GameState;
        check(
          legIsCold(weather) === thisLeg &&
            legIsCold(mate) === thisLeg &&
            legIsCold(recalled) === thisLeg,
          "the leg's weather is drawn rather than stored: the same voyage answers the same way on every read, a second captain holding different goods and a different purse reads the same leg the same way, and a save carried through a round trip answers it the same way again",
        );
        // Over a hundred legs of one voyage the draw has to be a rate rather
        // than a rule, so the count is read against the chance the constants
        // file states rather than against a number written down here. The
        // bounds are wide enough to hold the rate and far too narrow to hold
        // a tag that always says the same thing.
        const weatherRun = voyageState();
        weatherRun.voyageEpoch = 4242;
        let coldLegs = 0;
        for (let leg = 1; leg <= 100; leg++) {
          weatherRun.currentRound = leg;
          if (legIsCold(weatherRun)) coldLegs++;
        }
        check(
          coldLegs >= 100 * COLD_LEG_CHANCE * 0.5 &&
            coldLegs <= 100 * COLD_LEG_CHANCE * 1.5,
          "and across a hundred legs of one voyage roughly three in ten come up cold, so the weather is a rate a captain sails through rather than a rule that always bites or never does",
        );

        // The two rounds the checks below stand on, found by asking the rule
        // rather than written down as numbers that were cold once.
        const calendar = voyageState();
        calendar.voyageEpoch = 4242;
        const findRound = (cold: boolean) => {
          for (let round = 1; round <= 60; round++) {
            calendar.currentRound = round;
            if (legIsCold(calendar) === cold) return round;
          }
          return -1;
        };
        const coldRound = findRound(true);
        const mildRound = findRound(false);
        check(
          coldRound > 0 && mildRound > 0,
          "and a cold leg and a mild one both turn up in the first sixty of a voyage, which is the floor the rest of these checks stand on",
        );

        // The same cold leg, sailed bare.
        const freezing = voyageState();
        freezing.voyageEpoch = 4242;
        freezing.money = 1000;
        freezing.currentRound = coldRound;
        hireWorker(freezing, "weaver", []);
        hireWorker(freezing, "weaver", []);
        const elderHand = freezing.workers.weaver[0].name;
        const newestHand = freezing.workers.weaver[1].name;
        const bareLines: string[] = [];
        const warned = shortOfWarmth(freezing);
        tickGarments(freezing, bareLines);
        check(
          warned &&
            freezing.garmentsTickRound === coldRound &&
            isFrostbitten(freezing.workers.weaver[1], coldRound + 1) &&
            freezing.workers.weaver[1].frostbittenRound === coldRound + 1 &&
            !isFrostbitten(freezing.workers.weaver[0], coldRound + 1) &&
            bareLines.some((line) => line.includes("falls short")) &&
            bareLines.some(
              (line) => line.includes("Frostbite") && line.includes(newestHand),
            ) &&
            !bareLines.some(
              (line) => line.includes("Frostbite") && line.includes(elderHand),
            ),
          "a cold leg met with nothing on takes the newest hand by name and stands them down for the leg after the one they froze through, so the rule that chooses who pays for the cold is the same newest aboard the loss of a hand is taken from rather than a second draw",
        );

        // And the same leg again, dressed. Two of warmth is what the leg
        // asks, so this is the check read on its other side.
        const warmCrew = voyageState();
        warmCrew.voyageEpoch = 4242;
        warmCrew.money = 1000;
        warmCrew.currentRound = coldRound;
        hireWorker(warmCrew, "weaver", []);
        warmCrew.inventory["Cotton Clothes"] = 1;
        wearGarment(warmCrew, "Cotton Clothes", []);
        // Read before the tick, because the tick is the leg that just ended:
        // what the check is about is the warmth the crew met the leg with,
        // and by the time the settlement returns, the same pair is worth less
        // than the leg asked for and reads as short for the next one.
        const dressedInTime =
          warmthScore(warmCrew) >= COLD_LEG_WARMTH && !shortOfWarmth(warmCrew);
        const warmLines: string[] = [];
        tickGarments(warmCrew, warmLines);
        check(
          dressedInTime &&
            warmCrew.workers.weaver[0].frostbittenRound === undefined &&
            warmLines.some((line) => line.includes("enough")) &&
            !warmLines.some((line) => line.includes("Frostbite")),
          "while the same cold leg met with two of warmth costs nobody anything: one pair of Cotton Clothes is enough for it, the settlement says so, and the hand who froze on the bare voyage beside this one is still at the bench",
        );

        // The mark lasts the one leg it names.
        freezing.currentRound = coldRound + 1;
        freezing.garments = [
          { good: "Brocade", durability: GARMENTS.Brocade.durability },
        ];
        tickGarments(freezing, []);
        const downForTheirLeg = isFrostbitten(
          freezing.workers.weaver[1],
          coldRound + 1,
        );
        freezing.currentRound = coldRound + 2;
        freezing.garments = [
          { good: "Brocade", durability: GARMENTS.Brocade.durability },
        ];
        tickGarments(freezing, []);
        check(
          downForTheirLeg &&
            freezing.workers.weaver[1].frostbittenRound === undefined &&
            freezing.workers.weaver.length === 2,
          "the hand stands down for exactly the leg the mark names and is back at the bench the leg after, because the tick clears the marks whose leg is over as it walks, and the cold costs them the work of one leg rather than their place aboard",
        );

        // The wear, in the plan's units, and once a leg.
        const sea = voyageState();
        sea.voyageEpoch = 4242;
        sea.money = 1000;
        sea.currentRound = mildRound;
        hireWorker(sea, "weaver", []);
        sea.garments = [
          { good: "Brocade", durability: GARMENTS.Brocade.durability },
        ];
        tickGarments(sea, []);
        const afterOneLeg = sea.garments[0].durability;
        tickGarments(sea, []);
        const stampedOnce = sea.garments[0].durability === afterOneLeg;
        sea.currentRound = coldRound;
        tickGarments(sea, []);
        check(
          afterOneLeg === GARMENTS.Brocade.durability - GARMENT_DECAY_PER_LEG &&
            stampedOnce &&
            sea.garments[0].durability ===
              GARMENTS.Brocade.durability -
                GARMENT_DECAY_PER_LEG -
                GARMENT_DECAY_COLD_LEG,
          "clothes lose one of their warmth a leg and two on a cold one, and a leg that arrives twice wears them once, since the tick stamps the round it read before it reads anything else",
        );

        // The rags at the bottom of that, and what they pay.
        const ragged = voyageState();
        ragged.voyageEpoch = 4242;
        ragged.money = 100;
        ragged.currentRound = mildRound;
        hireWorker(ragged, "weaver", []);
        ragged.garments = [{ good: "Linen Clothes", durability: 1 }];
        const ragLines: string[] = [];
        tickGarments(ragged, ragLines);
        check(
          ragged.garments.length === 0 &&
            ragged.money === 100 + RAG_SCRAP_VALUE &&
            ragLines.some((line) =>
              line.includes(`scrapped for ${RAG_SCRAP_VALUE} Gold`),
            ),
          "a garment the sea has had all of leaves the wardrobe and is scrapped for the plan's four Gold in the same breath, so the hold and the purse agree about a good that stopped being wearable rather than the garment vanishing quietly",
        );

        // And the whole of it through the engine's own Resolve.
        const settling = voyageState();
        settling.money = 1000;
        settling.voyageEpoch = 4242;
        settling.currentRound = coldRound;
        hireWorker(settling, "weaver", []);
        settling.garments = [
          {
            good: "Cotton Clothes",
            durability: GARMENTS["Cotton Clothes"].durability,
          },
        ];
        settling.phase = "resolve";
        settling.pirateAttackResolved = true;
        const settleLines: string[] = [];
        nextPhase(
          settling,
          {
            seedBase: `smoke:garments:${suffix}`,
            harborId: `smoke-garments-${suffix}`,
          },
          settleLines,
        );
        check(
          settling.garmentsTickRound === coldRound &&
            settling.garments[0].durability ===
              GARMENTS["Cotton Clothes"].durability - GARMENT_DECAY_COLD_LEG &&
            settleLines.some((line) => line.includes("The Cold and the Cloth")),
          "and the wear lands through the engine's own Resolve rather than beside it, so the tick is part of the deterministic settlement step every leg already passes through rather than a rule that only fires when something calls it by name",
        );

        // Every line this family wrote, gathered here rather than threaded
        // through each check, since the dash rule is about the whole set.
        survivalLines.push(
          ...dressLines,
          ...bareLines,
          ...warmLines,
          ...ragLines,
        );

        // The switch off, read on its own so the checks above can stay about
        // the rules rather than about the flag.
        check(
          withEnv("NEXT_PUBLIC_GARMENTS", "off", () => {
            const dark = voyageState();
            dark.voyageEpoch = 4242;
            dark.money = 1000;
            dark.currentRound = coldRound;
            hireWorker(dark, "weaver", []);
            dark.inventory.Brocade = 1;
            dark.garments = [
              { good: "Brocade", durability: GARMENTS.Brocade.durability },
            ];
            const darkLines: string[] = [];
            const refused = wearGarment(dark, "Brocade", darkLines) === false;
            tickGarments(dark, darkLines);
            return (
              !garmentsLayerOn(GAMBIT) &&
              refused &&
              dark.inventory.Brocade === 1 &&
              dark.garments.length === 1 &&
              dark.garments[0].durability === GARMENTS.Brocade.durability &&
              dark.garmentsTickRound === 0 &&
              !shortOfWarmth(dark) &&
              dark.workers.weaver[0].frostbittenRound === undefined &&
              darkLines.length === 0
            );
          }),
          "with the switch off no garment is worn, nothing wears out, no leg is stamped and nobody freezes, while the clothes a voyage is already carrying are left on it exactly as they were read, so the layer rolls back without taking anybody's wardrobe with it",
        );

        // And the layer above, which is why the two switches are separate
        // readings rather than one.
        check(
          withEnv("NEXT_PUBLIC_SURVIVAL", "off", () =>
            withEnv("NEXT_PUBLIC_GARMENTS", "1", () => {
              const unfed = voyageState();
              unfed.voyageEpoch = 4242;
              unfed.money = 1000;
              unfed.currentRound = coldRound;
              hireWorker(unfed, "weaver", []);
              unfed.inventory.Brocade = 1;
              unfed.garments = [{ good: "Brocade", durability: 5 }];
              const unfedLines: string[] = [];
              const refused =
                wearGarment(unfed, "Brocade", unfedLines) === false;
              tickGarments(unfed, unfedLines);
              return (
                !garmentsLayerOn(GAMBIT) &&
                refused &&
                unfed.garments[0].durability === 5 &&
                unfed.garmentsTickRound === 0 &&
                !shortOfWarmth(unfed) &&
                unfedLines.length === 0
              );
            }),
          ),
          "and the provisions layer governs this one from above, because the clothes belong to the same family: a build with the Larder off has no cold whatever the garments switch says, so a table can be rolled back one switch at a time without a wardrobe outliving the rule it belonged to",
        );

        // A save read back, with the switch off, because the healing is the
        // save's business rather than the rule's and has to hold either way.
        const many = (count: number) =>
          Array.from({ length: count }, () => ({
            good: "Brocade",
            durability: GARMENTS.Brocade.durability,
          }));
        check(
          withEnv("NEXT_PUBLIC_GARMENTS", "off", () => {
            return (
              normalizeGarments(undefined).length === 0 &&
              normalizeGarments("Brocade").length === 0 &&
              normalizeGarments([{ good: "Sable", durability: 9 }, null, 7, {}])
                .length === 0 &&
              normalizeGarments([{ good: "Brocade", durability: 40 }])[0]
                .durability === GARMENTS.Brocade.durability &&
              normalizeGarments([{ good: "Brocade", durability: -1 }])
                .length === 0 &&
              normalizeGarments([{ good: "Brocade", durability: 6.8 }])[0]
                .durability === 6 &&
              normalizeGarments(many(12)).length === 12 &&
              normalizeGarments(many(13)).length === 12 &&
              normalizeGarments(many(40)).length === 12 &&
              normalizeGarmentsTickRound(undefined) === 0 &&
              normalizeGarmentsTickRound(Number.NaN) === 0 &&
              normalizeGarmentsTickRound(-2) === 0 &&
              normalizeGarmentsTickRound(3.9) === 3
            );
          }),
          "a save written before this layer existed heals to a crew with nothing on, since a voyage should meet its first cold leg the way a fresh one does rather than in clothes a save invented for it, and a wardrobe it can read is clamped to the catalogue's own ends: entries for goods that are not clothes are dropped, a durability is floored into the garment, a garment already in rags is not worn, the back holds twelve, and a stamp it cannot read lands on a leg no voyage has",
        );
      }),
    );

    // The files this feature owns, read as files rather than asserted about,
    // so the rule covers their comments as well as the lines they write. It
    // is the same reading the crew's own files are held to above, and the
    // bench the wardrobe is drawn on is read there with them.
    check(
      !carriesADash("src/lib/game/garments.ts") &&
        !carriesADash("src/lib/game/engine/workers.ts") &&
        !carriesADash("src/lib/game/engine/lifecycle.ts") &&
        !carriesADash("src/components/portmasters/game/GameStatusPanel.tsx"),
      "and the module the clothes live in and the three files the cold reaches, the bench that assigns work, the settlement that ticks it and the rail a captain reads the forecast on, hold the house rule in their comments as well as in their code",
    );

    // ---- [C4: three foods, spoilage and the split hold] ----
    // The catalogue first, because every number below is read off it: three
    // foods of three densities, one of them never turning, the order they
    // are eaten in, and the two sizes the split hold is built out of.
    check(
      Object.keys(FOODS).length === 3 &&
        FOODS.Grain.mealsPerSlot === 1 &&
        FOODS.Grain.keeps === null &&
        FOODS["Salt Fish"].mealsPerSlot === 2 &&
        FOODS["Salt Fish"].keeps === 6 &&
        FOODS.Produce.mealsPerSlot === 3 &&
        FOODS.Produce.keeps === 2 &&
        FOODS_DRAW_ORDER.join(",") === "Produce,Salt Fish,Grain" &&
        CARGO_SLOTS === 30 &&
        STORES_SLOTS === LARDER_MAX &&
        SHORT_RATIONS_CARGO === 0.75 &&
        PRESERVE_MEALS_IN === 3 &&
        PRESERVE_MEALS_OUT === 2,
      "three foods of three densities and three clocks, eaten in the order the sea takes them back: produce turns after two legs, salt fish after six, grain never, and the split hold is thirty slots of cargo and the Larder's own sixty of stores",
    );

    // The split's own switch, read through the same policy function the
    // provisions switch is read through, so one typo cannot leave a table
    // half switched: the capacity model is a rule about provisions, so a
    // build without the Larder plays the base game whatever the split says.
    check(
      [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
        withEnv(
          "NEXT_PUBLIC_SPLIT_HOLD",
          value,
          switchFor(GAMBIT, splitHoldOn),
        ),
      ) &&
        ["off", "0", "OFF", " off ", "Off"].every(
          (value) =>
            !withEnv(
              "NEXT_PUBLIC_SPLIT_HOLD",
              value,
              switchFor(GAMBIT, splitHoldOn),
            ),
        ) &&
        withEnv("NEXT_PUBLIC_SURVIVAL", "off", () =>
          withEnv(
            "NEXT_PUBLIC_SPLIT_HOLD",
            "1",
            switchFor(GAMBIT, holdCapacityOn),
          ),
        ) === false &&
        withEnv("NEXT_PUBLIC_SURVIVAL", "1", () =>
          withEnv(
            "NEXT_PUBLIC_SPLIT_HOLD",
            "off",
            switchFor(GAMBIT, holdCapacityOn),
          ),
        ) === false &&
        withEnv("NEXT_PUBLIC_SURVIVAL", "1", () =>
          withEnv(
            "NEXT_PUBLIC_SPLIT_HOLD",
            "1",
            switchFor(GAMBIT, holdCapacityOn),
          ),
        ) === true,
      "the split hold is on for every value except the word off and the digit zero, and the provisions layer governs it from above, so a table can be rolled back one switch at a time without a hold size outliving the rule it belonged to",
    );

    withEnv("NEXT_PUBLIC_SPLIT_HOLD", "1", () => {
      const splitLines: string[] = [];
      const rationCrew = 2;
      const rationLeg = rationCrew * RATION_PRICE;
      const staff = (state: GameState) => {
        for (let hired = 0; hired < rationCrew; hired += 1) {
          hireWorker(state, "weaver", []);
        }
        state.money = 1000;
      };

      // ---- what a voyage leaves the pier with ----
      // The opening hold is grain, and it is the same twelve meals C1
      // shipped, which is the continuity the whole split rests on: grain
      // fills one slot with one meal, so the account and the plain number
      // agree to the meal until a captain buys something else.
      const storeFresh = voyageState();
      check(
        storeFresh.larder === LARDER_START &&
          larderMeals(storeFresh) === LARDER_START &&
          storeFresh.larderLots.length === 1 &&
          storeFresh.larderLots[0].food === "Grain" &&
          storeFresh.larderLots[0].meals === LARDER_START &&
          usedStoreSlots(storeFresh) === LARDER_START &&
          usedCargoSlots(storeFresh) === 16 &&
          usedHoldSlots(storeFresh) ===
            usedCargoSlots(storeFresh) + usedStoreSlots(storeFresh),
        "a voyage leaves the pier with its opening twelve rations as one lot of grain, and the hold reads as two halves that add up to the whole: sixteen slots of stock and twelve of stores",
      );
      check(
        storesSlots() === LARDER_MAX &&
          storesMealCeiling() === LARDER_MAX * 3 &&
          cargoSlots(false) === CARGO_SLOTS &&
          cargoSlots(true) === Math.floor(CARGO_SLOTS * SHORT_RATIONS_CARGO) &&
          storeRoomMeals(storeFresh, "Grain") === LARDER_MAX - LARDER_START &&
          foodRoomMeals(storeFresh, "Grain") === LARDER_MAX - LARDER_START &&
          foodRoomMeals(storeFresh, "Produce") ===
            (LARDER_MAX - LARDER_START) * 3,
        "the stores are the Larder's old ceiling to the slot, so the same sixty slots hold sixty meals of grain, a hundred and twenty of salt fish or a hundred and eighty of produce, and what a captain can still buy is read in legs off the food they are buying",
      );

      // ---- buying, by the food ----
      // Two legs of salt fish, twice, because the second purchase is the
      // one that would show a doubled lot or a count that drifted: the
      // same food bought in the same leg merges into the lot already
      // aboard, and the price of a meal does not move with the food.
      const buyFoods = voyageState();
      staff(buyFoods);
      const buyFoodLines: string[] = [];
      const firstBuy = provisionFood(buyFoods, "Salt Fish", 2, buyFoodLines);
      const secondBuy = provisionFood(buyFoods, "Salt Fish", 2, buyFoodLines);
      splitLines.push(...buyFoodLines);
      check(
        firstBuy === 2 &&
          secondBuy === 2 &&
          buyFoods.larder === LARDER_START + 8 &&
          mealsOf(buyFoods, "Salt Fish") === 8 &&
          buyFoods.larderLots.filter((lot) => lot.food === "Salt Fish")
            .length === 1 &&
          buyFoods.money === 1000 - 4 * rationLeg &&
          buyFoods.roundCosts === 4 * rationLeg &&
          usedStoreSlots(buyFoods) === LARDER_START + 4 &&
          buyFoodLines.length === 2,
        "salt fish buys at two meals a slot, four meals for two legs of a crew of two at the same price a meal of grain costs, and a second purchase in the same leg merges into the lot already aboard rather than starting a second one with the same age",
      );

      // ---- the order the sea takes things back ----
      // One meal a leg for a crew of one, out of a pantry holding all
      // three foods, walked leg by leg so a reader sees which food fed
      // which leg: produce first because it turns soonest, then salt
      // fish, then the grain nothing can be wrong about.
      const eatOrder = voyageState();
      eatOrder.money = 1000;
      hireWorker(eatOrder, "weaver", []);
      eatOrder.larder = 17;
      eatOrder.larderLots = [];
      addLot(eatOrder, "Grain", 12, 0);
      addLot(eatOrder, "Salt Fish", 2, 0);
      addLot(eatOrder, "Produce", 3, 4);
      const drewOrder: string[] = [];
      for (let round = 4; round <= 10; round += 1) {
        eatOrder.currentRound = round;
        const before = FOODS_DRAW_ORDER.map((food) => mealsOf(eatOrder, food));
        feedCrew(eatOrder, []);
        FOODS_DRAW_ORDER.forEach((food, index) => {
          if (mealsOf(eatOrder, food) < before[index]) drewOrder.push(food);
        });
      }
      check(
        drewOrder.join(",") ===
          "Produce,Produce,Produce,Salt Fish,Salt Fish,Grain,Grain" &&
          eatOrder.larder === 10 &&
          mealsOf(eatOrder, "Grain") === 10 &&
          mealsOf(eatOrder, "Produce") === 0 &&
          mealsOf(eatOrder, "Salt Fish") === 0,
        "the crew eats what spoils first, one meal a leg: three legs of produce, then two of salt fish, then grain, and the count follows the account down whichever food the meal came out of",
      );

      // The draw read for what it returns rather than for what it was
      // asked: a pantry that cannot cover the meal takes what is there and
      // says so, which is the answer the meal above uses to leave a
      // shortage standing rather than to conjure rations.
      const shortDraw = voyageState();
      shortDraw.larder = 2;
      shortDraw.larderLots = [{ food: "Produce", meals: 2, boughtRound: 0 }];
      check(
        drawMeals(shortDraw, 5.9) === 2 && larderMeals(shortDraw) === 0,
        "a draw for more meals than the pantry holds takes what is there rather than conjuring the difference, and a fraction of a meal is not a meal",
      );

      // ---- spoilage, stamped once a leg ----
      // Produce bought at one market is food for that leg and the one
      // after it and is gone at the second Dusk, counted from the leg it
      // was bought in. The stamp is what makes "once a leg" true rather
      // than hopeful, the same way the meal's own stamp does, and the
      // second tick in the same leg is written out because that is the
      // shape of the defect it prevents.
      const turnPot = voyageState();
      turnPot.larder = 18;
      turnPot.larderLots = [];
      addLot(turnPot, "Grain", 12, 0);
      addLot(turnPot, "Produce", 6, 1);
      turnPot.currentRound = 1;
      const turnLines: string[] = [];
      tickSpoilage(turnPot, turnLines);
      turnPot.currentRound = 2;
      tickSpoilage(turnPot, turnLines);
      const keptFresh =
        turnLines.length === 0 &&
        turnPot.larder === 18 &&
        mealsOf(turnPot, "Produce") === 6;
      turnPot.currentRound = 3;
      tickSpoilage(turnPot, turnLines);
      tickSpoilage(turnPot, turnLines);
      splitLines.push(...turnLines);
      check(
        keptFresh &&
          turnPot.larder === 12 &&
          mealsOf(turnPot, "Produce") === 0 &&
          mealsOf(turnPot, "Grain") === 12 &&
          turnPot.larderLots.length === 1 &&
          turnPot.larderSpoilRound === 3 &&
          turnLines.length === 1 &&
          turnLines[0].includes("🥬") &&
          turnLines[0].includes("6 rations of Produce turned at sea") &&
          turnLines[0].includes("12 left in the larder"),
        "produce is food for the leg it arrived in and the one after it, and on the second Dusk it turns: the count comes down with the account in the same statement, and a second tick in the same leg is not a second loss",
      );

      // Salt fish lasts six, so the same walk one food over turns on the
      // seventh leg rather than the third, and grain is never asked at
      // all: a food whose keeping is null is a lot no Dusk can touch.
      const keepPot = voyageState();
      keepPot.larder = 4;
      keepPot.larderLots = [{ food: "Salt Fish", meals: 4, boughtRound: 1 }];
      keepPot.currentRound = 6;
      const keepPotLines: string[] = [];
      tickSpoilage(keepPot, keepPotLines);
      const heldSix =
        keepPot.larder === 4 && mealsOf(keepPot, "Salt Fish") === 4;
      keepPot.currentRound = 7;
      tickSpoilage(keepPot, keepPotLines);
      splitLines.push(...keepPotLines);
      check(
        heldSix &&
          keepPot.larder === 0 &&
          keepPotLines.length === 1 &&
          keepPotLines[0].includes("🐟"),
        "salt fish keeps six legs from the market it was bought at and turns on the seventh, which is the long clock a preserve buys",
      );
      const everGrain = voyageState();
      everGrain.currentRound = 40;
      const everLines: string[] = [];
      tickSpoilage(everGrain, everLines);
      check(
        everLines.length === 0 &&
          everGrain.larder === LARDER_START &&
          larderMeals(everGrain) === LARDER_START,
        "and grain is never asked: a food that keeps forever is a lot no leg, however long the voyage, can take back",
      );

      // The pantry as a screen reads it, which is the number the market's
      // own keeping line is built from: what is aboard and how many legs
      // the oldest of it has left.
      const lotScreen = voyageState();
      lotScreen.larder = 3;
      lotScreen.larderLots = [];
      addLot(lotScreen, "Produce", 3, 4);
      lotScreen.currentRound = 5;
      const atFive = pantryLines(lotScreen);
      lotScreen.currentRound = 6;
      const atSix = pantryLines(lotScreen);
      lotScreen.currentRound = 9;
      const atNine = pantryLines(lotScreen);
      check(
        atFive.length === 1 &&
          atFive[0].food === "Produce" &&
          atFive[0].meals === 3 &&
          atFive[0].legsLeft === 1 &&
          atSix[0].legsLeft === 0 &&
          atNine[0].legsLeft === 0,
        "the pantry a captain reads says what is aboard and how many legs the oldest of it has left, floored at the Dusk it turns rather than counting into the past",
      );

      // ---- preserving, at the plan's own ratio ----
      // Three meals of produce into two of salt fish at the same slot and
      // the same price, so the third meal is what a captain pays for a
      // fresh clock. The trade is about keeping rather than quantity, and
      // the hold it costs is the same hold either way.
      const cookPot = voyageState();
      cookPot.larder = 7;
      cookPot.larderLots = [{ food: "Produce", meals: 7, boughtRound: 0 }];
      const slotsBefore = usedStoreSlots(cookPot);
      const cookPotLines: string[] = [];
      const batches = preserveFood(cookPot, cookPotLines);
      const refusedPotLines: string[] = [];
      const secondBatches = preserveFood(cookPot, refusedPotLines);
      splitLines.push(...cookPotLines, ...refusedPotLines);
      check(
        batches === 2 &&
          cookPot.larder === 5 &&
          mealsOf(cookPot, "Produce") === 1 &&
          mealsOf(cookPot, "Salt Fish") === 4 &&
          Math.abs(usedStoreSlots(cookPot) - slotsBefore) < 1e-9 &&
          cookPotLines.length === 1 &&
          cookPotLines[0].includes(
            "Preserved 6 rations of Produce into 4 of Salt Fish",
          ) &&
          secondBatches === 0 &&
          refusedPotLines.length === 1 &&
          refusedPotLines[0].includes("Not enough Produce"),
        "preserving turns three meals of produce into two of salt fish at the same slots and the same price, and a pantry with less than a batch aboard is told why rather than served a fraction of one",
      );

      // ---- the ceiling, reached rather than overshot ----
      // A captain who asks for more legs than the stores have room for
      // buys the room exactly, and the next meal of grain is the purchase
      // that finds them full, which is the line C1 shipped and the reason
      // the ration purchase kept its old name: a captain buying rations
      // without naming a food is buying the food that never turns.
      const fullPot = voyageState();
      staff(fullPot);
      const fullPotLines: string[] = [];
      const fillLegs = provisionFood(fullPot, "Produce", 999, fullPotLines);
      const fullRoom = foodRoomMeals(fullPot, "Grain");
      const overfill = provisionFood(fullPot, "Grain", 1, fullPotLines);
      splitLines.push(...fullPotLines);
      check(
        fillLegs === 72 &&
          fullPot.larder === LARDER_START + 144 &&
          usedStoreSlots(fullPot) === STORES_SLOTS &&
          fullRoom === 0 &&
          overfill === 0 &&
          fullPotLines[1] === "🧺 The larder is full.",
        "the stores are reached rather than overshot: a captain asking for more legs than fit buys the hold exactly full of the food that fills it densest, and the next purchase is told the larder is full in the words C1 shipped",
      );

      // ---- the quarter a hungry crew costs the cargo ----
      // C1's own clause, landed on the single capacity read: a quarter off
      // the cargo while the crew is on short rations, and nothing at all
      // when the hold has no size. The card below is refused by the
      // market rather than by the hold, because the market is the door
      // that sells, and the same card buys without complaint one meal
      // later, which is what makes the shortage a cost rather than a wall.
      const hungryShip = voyageState();
      staff(hungryShip);
      hungryShip.larder = 0;
      hungryShip.larderLots = [];
      const heavyCard = {
        id: 9001,
        port: "Smoke Harbor",
        resources: [{ type: "Hemp", quantity: 7, price: 10, materialCost: 0 }],
        totalCost: 20,
        isProductCard: false,
      };
      hungryShip.resourceCards = [heavyCard];
      const quarterLines: string[] = [];
      purchaseCard(hungryShip, heavyCard.id, quarterLines);
      const stayedHungry =
        quarterLines.length === 1 &&
        quarterLines[0].includes("it takes 7 slots and 6 are free") &&
        hungryShip.inventory.Hemp === 8 &&
        hungryShip.money === 1000 &&
        cargoCapacity(hungryShip) ===
          Math.floor(CARGO_SLOTS * SHORT_RATIONS_CARGO) &&
        cargoRoom(hungryShip) === 6;
      hungryShip.larder = LARDER_START;
      hungryShip.larderLots = [];
      addLot(hungryShip, "Grain", LARDER_START, 0);
      const fedShipLines: string[] = [];
      purchaseCard(hungryShip, heavyCard.id, fedShipLines);
      splitLines.push(...quarterLines, ...fedShipLines);
      check(
        stayedHungry &&
          hungryShip.inventory.Hemp === 15 &&
          hungryShip.money === 1000 - heavyCard.totalCost &&
          cargoCapacity(hungryShip) === CARGO_SLOTS &&
          cargoRoom(hungryShip) === CARGO_SLOTS - 23,
        "a crew on short rations costs the cargo a quarter, so a lot one slot too large for the hungry hold is turned away with the numbers it was measured against, and the same lot buys the moment the crew has eaten",
      );

      // ---- a save written by hand ----
      // The same reading the Larder's own number gets, one family down:
      // lots the catalogue does not know are dropped rather than carried,
      // a lot with nothing in it is not a lot, a save with no account
      // heals onto the count as grain, and a count is clamped to the hold
      // it is actually in rather than to the ceiling a build once had.
      check(
        normalizeLarderLots(undefined, LARDER_START)[0].food === "Grain" &&
          normalizeLarderLots(undefined, LARDER_START)[0].meals ===
            LARDER_START &&
          normalizeLarderLots("Brocade", 5)[0].meals === 5 &&
          normalizeLarderLots([], 0).length === 0 &&
          normalizeLarderLots(
            [
              { food: "Brocade", meals: 3, boughtRound: 1 },
              null,
              7,
              {},
              { food: "Produce", meals: -2, boughtRound: 0 },
              { food: "Grain", meals: 0, boughtRound: 0 },
              { food: "Produce", meals: 6.8, boughtRound: 2.9 },
            ],
            LARDER_START,
          ).length === 1 &&
          normalizeLarderLots(
            [{ food: "Produce", meals: 6.8, boughtRound: 2.9 }],
            0,
          )[0].meals === 6 &&
          normalizeLarderLots(
            Array.from({ length: 70 }, () => ({
              food: "Produce",
              meals: 3,
              boughtRound: 0,
            })),
            0,
          ).length === 64 &&
          normalizeLarderSpoilRound(undefined) === 0 &&
          normalizeLarderSpoilRound(-2) === 0 &&
          normalizeLarderSpoilRound(3.9) === 3,
        "a pantry read off a save drops the lots the catalogue does not know, floors what a portion is and what leg it was bought at, keeps the sixty four lots a voyage can legitimately carry, and reads a missing stamp as a leg no voyage has",
      );
      check(
        normalizeLarder(180, GAMBIT) === 180 &&
          normalizeLarder(-4, GAMBIT) === 0 &&
          normalizeLarder("sixty", GAMBIT) === LARDER_START &&
          normalizeLarder(3.9, GAMBIT) === 3 &&
          withEnv("NEXT_PUBLIC_SPLIT_HOLD", "off", () =>
            normalizeLarder(180, GAMBIT),
          ) === LARDER_MAX,
        "a Larder read off a save is clamped to the hold it is actually in: the stores' own ceiling under the split, which is sixty meals of grain or a hundred and eighty of produce, and the old sixty with the split switched off",
      );

      // ---- a count and an account that have parted ----
      // The one writer that makes them agree, read in both directions,
      // because a hand that writes one of the two and not the other is
      // what every scenario in this file is: the count is the game's and
      // the account is what a crew eats from, and grain is what absorbs
      // the difference either way.
      const partedPot = voyageState();
      partedPot.larder = 0;
      const partedLines = pantryLines(partedPot);
      reconcileLarder(partedPot);
      const emptied =
        partedPot.larderLots.length === 0 && larderMeals(partedPot) === 0;
      partedPot.larder = 30;
      reconcileLarder(partedPot);
      check(
        partedLines.length === 1 &&
          partedLines[0].meals === LARDER_START &&
          emptied &&
          larderMeals(partedPot) === 30 &&
          mealsOf(partedPot, "Grain") === 30 &&
          partedPot.larderLots.length === 1,
        "a pantry a screen draws while the count says zero is the account rather than the count, and reconciling a state parted either way lands the difference on grain: the food that never turns is the one that can take an unknown age without lying about one",
      );

      // ---- the tick through the engine's own lap ----
      // The plan puts spoilage on the deterministic resolve step rather
      // than on a clock, so the check walks the phase every captain
      // already walks: a leg ends, the settlement tick reads the pantry,
      // and the produce the voyage carried through it is gone.
      const spoilWalk = voyageState();
      spoilWalk.money = 1000;
      spoilWalk.larder = 18;
      spoilWalk.larderLots = [];
      addLot(spoilWalk, "Grain", 12, 0);
      addLot(spoilWalk, "Produce", 6, 0);
      spoilWalk.currentRound = 2;
      spoilWalk.phase = "resolve";
      spoilWalk.pirateAttackResolved = true;
      const spoilWalkLines: string[] = [];
      nextPhase(
        spoilWalk,
        {
          seedBase: `smoke:foods:${suffix}`,
          harborId: `smoke-foods-${suffix}`,
        },
        spoilWalkLines,
      );
      splitLines.push(
        ...spoilWalkLines.filter((line) => line.includes("turned at sea")),
      );
      check(
        spoilWalk.larderSpoilRound === 2 &&
          mealsOf(spoilWalk, "Produce") === 0 &&
          mealsOf(spoilWalk, "Grain") === 12 &&
          spoilWalk.larder === LARDER_START &&
          spoilWalkLines.some((line) => line.includes("turned at sea")),
        "the settlement tick is where the sea takes its food back, in the phase every captain already walks and on the leg number rather than on any clock",
      );

      // ---- the switch, off ----
      // The rollback the plan asks for is one switch, and with it off this
      // feature is not running at all: no meal, no rot, no purchase, no
      // conversion, no stamp written and no mark left, and the room reads
      // the Larder's own ceiling again rather than the stores'.
      check(
        withEnv("NEXT_PUBLIC_SURVIVAL", "off", () => {
          const darkShip = voyageState();
          darkShip.money = 1000;
          darkShip.currentRound = 3;
          hireWorker(darkShip, "weaver", []);
          darkShip.larder = 0;
          darkShip.larderLots = [];
          const darkLines: string[] = [];
          const fed = feedCrew(darkShip, darkLines);
          const ateStamp = darkShip.larderFedRound;
          tickSpoilage(darkShip, darkLines);
          const spoilStamp = darkShip.larderSpoilRound;
          const bought = provisionFood(darkShip, "Produce", 2, darkLines);
          const preserved = preserveFood(darkShip, darkLines);
          return (
            !fed &&
            ateStamp === 0 &&
            spoilStamp === 0 &&
            bought === 0 &&
            preserved === 0 &&
            darkLines.length === 0 &&
            holdCapacityOn(GAMBIT) === false &&
            cargoCapacity(darkShip) === Number.POSITIVE_INFINITY &&
            foodRoomMeals(darkShip, "Produce") === LARDER_MAX &&
            normalizeLarder(180, GAMBIT) === LARDER_MAX
          );
        }),
        "with the provisions layer off the pantry is a plain number again: no meal drawn, nothing turned, nothing bought or preserved and no stamp written, and the room a captain reads is the Larder's own ceiling rather than a stores the rule is not running",
      );
      // Every line this feature wrote, into the one accumulator the family
      // is read through at the end of this section, so the dash rule
      // covers the pantry's own sentences as well as the Larder's.
      survivalLines.push(...splitLines);
    });

    // The files this feature owns, read as files rather than asserted
    // about, the same reading the crew's own files get above, so the house
    // rule covers their comments as well as the strings they build. The
    // two files that carry the spine's own banners are read by the checks
    // that own them instead, since a banner is drawn with the characters
    // the rule is about.
    check(
      !carriesADash("src/lib/game/foods.ts") &&
        !carriesADash("src/lib/game/hold.ts") &&
        !carriesADash("src/lib/game/flags.ts") &&
        !carriesADash("src/lib/game/larder.ts") &&
        !carriesADash("src/lib/game/engine/lifecycle.ts"),
      "and the four modules the pantry, the hold and the two switches live in, and the settlement that ticks them, hold the house rule in their comments as well as in their code",
    );
    check(
      !carriesADash("src/lib/game/engine/market.ts") &&
        !carriesADash("src/lib/game/dashboard.ts") &&
        !carriesADash("src/lib/game/integrity.ts") &&
        !carriesADash("src/lib/use-leg-report.ts") &&
        !carriesADash("src/types/realtime") &&
        !carriesADash("src/server/realtime/index.ts") &&
        !carriesADash("src/components/portmasters/game/phases/Purchase.tsx"),
      "and the four screens and the wire the split reaches, the market that refuses a lot for room, the dashboard that reads the hold, the integrity note, the leg report and its server side, and the Provisions panel a captain buys from, hold it too",
    );

    // Every string the survival layer puts in front of a captain, read with
    // the same rule the manifest line above is read with. The house rule
    // covers every string a captain reads, and it is built out of code
    // points at the top of this file so that the check is never where the
    // dashes are kept. Every feature of this family writes into this one
    // accumulator, the wardrobe included, since a frostbite crossing a log
    // line is a captain facing string whatever wrote it, and the rule is
    // about the whole set.
    check(
      survivalLines.length > 0 &&
        survivalLines.every((line) => !CARRIES_A_DASH.test(line)),
      "and every line the survival layer writes for a captain, the Larder's shortage, the crew's own losses and the wardrobe's wear alike, is free of dashes, the same rule every other string in the game is held to",
    );

    // =====================================================================
    // [D1: the path configuration module, and the naming change]
    //
    // The plan asks for one record per path carrying crest, signature
    // ability, goods, order pool, cargo modifier and Renown ceiling, in the
    // shape the difficulty ladder already uses, so that adding or retuning
    // a path is one entry and no other server code to touch. What is held
    // below is that record read as a record: the facts it claims, the
    // properties that make it one source of truth, and the naming change it
    // carried, which is the half of this slice a later reader is likeliest
    // to undo by accident.
    //
    // Nothing here talks to the server, because there is no server side to
    // this feature: a path is content, and the module holding it reads no
    // clock, no database and no socket. Every check is also written to
    // survive the day a sixth path is added, because the plan's own
    // evaluation adds one to prove that no other module has to move, and a
    // suite that failed on that edit would itself be the second place the
    // paths are listed.
    // =====================================================================
    console.log("\nThe paths");

    // The plan's five, with the names the plan gives them, read through
    // pathConfig rather than off the record behind it, so the check
    // exercises the door every other module reads them through.
    const PLAN_PATHS: ReadonlyArray<readonly [PathId, string]> = [
      ["convoy", "Convoy"],
      ["loom", "Loom"],
      ["aroma", "Aroma"],
      ["free_captain", "Free Captain"],
      ["quartermaster", "Quartermaster"],
    ];
    check(
      PLAN_PATHS.every(([id, name]) => pathConfig(id)?.name === name),
      "the plan's five paths are all in the record and carry the plan's own names, read through the same door every other module reads them through",
    );
    check(
      PATH_IDS.join(",") === Object.keys(PATHS).join(",") &&
        PATH_IDS.every((id) => normalizePath(id) === id),
      "and the id list is the record's own keys rather than a second list written out beside it, which is what makes a sixth path one entry here and a sixth path everywhere else",
    );

    // Names and crests, the two things a locked card wears. The board D2
    // builds greys three of them at once, so two paths sharing either make
    // two cards nobody can tell apart.
    const pathNames = PATH_IDS.map((id) => PATHS[id].name);
    const pathCrests = PATH_IDS.map((id) => PATHS[id].crest);
    check(
      pathNames.every((name) => name.length > 0) &&
        new Set(pathNames).size === pathNames.length,
      "no two paths print the same name, so a locked card cannot be labelled for one path and stamped for another",
    );
    check(
      pathCrests.every((crest) => crest.length > 0) &&
        new Set(pathCrests).size === pathCrests.length,
      "and no two wear the same crest, for the same reason read from the other end: a repeated glyph makes two of the three greyed cards the same card",
    );

    // The hold, which is where a path's structural poverty or plenty lives.
    // Convoy's is the plan's own account of the path: the cannons that make
    // its contract worth buying are cargo it cannot carry, so the number is
    // the subtraction of those two constants rather than a literal typed
    // beside it, and it is read against them here so a retune of either
    // moves this check with it rather than past it.
    const pathModifiers = PATH_IDS.map((id) => PATHS[id].cargoModifier);
    check(
      PATHS.convoy.cargoModifier ===
        (CARGO_SLOTS - CONVOY_CANNON_SLOTS) / CARGO_SLOTS &&
        PATHS.convoy.cargoModifier > 0 &&
        PATHS.convoy.cargoModifier < 1,
      "the Convoy's hold is the slots its cannons occupy subtracted from the hold, written as that subtraction rather than as a number beside it, and it stays a fraction of a hold rather than a hold that owes slots back",
    );
    check(
      PATHS.quartermaster.cargoModifier === 1 + QUARTERMASTER_HOLD_GAIN &&
        Math.max(...pathModifiers) === PATHS.quartermaster.cargoModifier &&
        pathModifiers.filter((m) => m === PATHS.quartermaster.cargoModifier)
          .length === 1,
      "the Quartermaster's is the largest hold at the table and the only one at that size, because a second path carrying it would be the same seat twice",
    );
    check(
      ["loom", "aroma", "free_captain"].every(
        (id) => PATHS[id as PathId].cargoModifier === 1,
      ),
      "and every path the plan claims nothing about carries exactly one, which is a value rather than an absent field: one means the hold is the hold",
    );

    // The ceilings, read off the ladder the profile and the merits already
    // read. The plan gives one relation between the five and no numbers, so
    // what is held here is that relation against the ladder rather than the
    // numbers it currently works out to.
    const ladderRungs = RENOWN_TITLES.map((title) => title.minLevel);
    check(
      PATH_IDS.every((id) => ladderRungs.includes(PATHS[id].renownCeiling)),
      "every ceiling is a rung the Renown ladder actually has, so a path banks toward a title that exists rather than toward a level nobody can be promoted into",
    );
    check(
      PATHS.quartermaster.renownCeiling === RENOWN_MAX_LEVEL &&
        PATH_IDS.every((id) => PATHS[id].renownCeiling <= RENOWN_MAX_LEVEL),
      "the Quartermaster's is the top of the ladder and no path reads above it, derived from the ladder so a title added above the top moves it rather than stranding it",
    );
    const besideCeiling = ladderRungs[ladderRungs.length - 2];
    check(
      PLAN_PATHS.filter(([id]) => id !== "quartermaster").every(
        ([id]) => PATHS[id].renownCeiling === besideCeiling,
      ) && besideCeiling < RENOWN_MAX_LEVEL,
      "and the four beside it cap one rung beneath, which is the plan's only other word on the subject and is read off the ladder rather than written in twice",
    );

    // The goods, read against the tables they were sourced from rather than
    // against a list retyped here. A check that wrote the seven commodities
    // out again would be the second copy this module exists to avoid, and
    // it would pass on the day the catalogue grew and the record did not.
    check(
      PATHS.loom.goods.join(",") === Object.keys(GARMENTS).join(",") &&
        PATHS.aroma.goods.join(",") === Object.keys(COMMODITIES).join(",") &&
        PATHS.quartermaster.goods.join(",") === Object.keys(FOODS).join(","),
      "each order path's goods are its own table read rather than retyped, so a fourth garment or a wider commodity list reaches the record without an edit inside it",
    );

    // The pools, and with them the lock reason D2 computes rather than
    // writes onto a card. The three errand paths bring the board an order
    // of their own and the two action paths do not, which is a reading of
    // the plan rather than a gap: selling a contract and borrowing an order
    // are actions, and a board that greyed a card for them would have
    // invented an errand the design never gave them.
    const catalogue = new Set<string>([
      ...ITEMS,
      ...Object.keys(GARMENTS),
      ...Object.keys(COMMODITIES),
      ...Object.keys(FOODS),
    ]);
    check(
      ["loom", "aroma", "quartermaster"].every(
        (id) => PATHS[id as PathId].orderPool.length > 0,
      ) &&
        PATHS.convoy.orderPool.length === 0 &&
        PATHS.free_captain.orderPool.length === 0,
      "the three paths whose ability is an errand carry an order pool and the two whose ability is an action carry none, which is where D2's three greyed cards are drawn from",
    );
    check(
      PATH_IDS.every((id) =>
        PATHS[id].orderPool.every((good) => catalogue.has(good)),
      ),
      "and every good a pool names is a good the catalogue knows, so the board can never grey a card for an order nobody could fill",
    );
    const claimed = new Map<string, number>();
    for (const id of PATH_IDS) {
      for (const good of PATHS[id].orderPool) {
        claimed.set(good, (claimed.get(good) ?? 0) + 1);
      }
    }
    check(
      [...claimed.values()].every((count) => count === 1),
      "and no good is claimed by two paths at once, because lockingPathFor answers with the first pool holding it and a good in two would make that answer depend on the record's order",
    );

    // The reader, which is the whole of what D2 calls and the one place a
    // locked card's reason comes from.
    check(
      lockingPathFor("Brocade") === "loom" &&
        lockingPathFor("Silk") === "aroma" &&
        lockingPathFor("Salt Fish") === "quartermaster",
      "a good finds its locking path by being looked up in the pools rather than by a label written onto the card, so what the board greys out and what the card says cannot come apart",
    );
    check(
      lockingPathFor("") === null && lockingPathFor("sachet") === null,
      "and a value no pool holds locks nothing rather than being guessed at, since the lookup is exact: an empty string and a good's name in the wrong case both come back unowned",
    );
    check(
      [...catalogue].some((good) => lockingPathFor(good) === null),
      "and the catalogue still holds goods no path claims, which is what keeps the board's ordinary orders ordinary and the locked ones the exception D2 greys out",
    );

    // The door every other module reads a saved value through, and the
    // naming change held at the interface: the two retired words are
    // refused as path ids here rather than remembered as a convention.
    check(
      normalizePath("aroma") === "aroma" && pathConfig("aroma") === PATHS.aroma,
      "a saved value reads back as the path it names, and the record it reads back is the record itself rather than a copy that could fall out of step with it",
    );
    check(
      normalizePath("Variable") === null &&
        normalizePath("faction") === null &&
        normalizePath("") === null &&
        normalizePath(4) === null &&
        normalizePath({ path: "loom" }) === null,
      "and nothing else does: the two retired words, an empty string, a number and an object all read as no path rather than as a path nobody chose, which is the naming change held where it can be checked",
    );
    check(
      normalizePath("constructor") === null &&
        normalizePath("toString") === null,
      "with the prototype chain refused on purpose, since these are string keys and the cheaper membership test would have answered for both of them",
    );
    check(
      pathConfig(undefined) === null && pathConfig(null) === null,
      "and a save that predates paths, or a captain who has not drawn one, reads as no path at all, which is the honest state of every captain until the draft that deals one lands",
    );

    // The module's own claim that a path is content: no environment value
    // behind it, no server module under it. Read off the file rather than
    // asserted about it, so the day a path is gated behind a switch the
    // switch has to live where the other switches do, in ./flags, and the
    // sentence in this module's header stays true.
    const pathsSource = readFileSync(
      join(import.meta.dirname, "..", "src/lib/game/paths.ts"),
      "utf8",
    );
    check(
      !pathsSource.includes("process.env") &&
        !pathsSource.includes("@/server") &&
        !pathsSource.includes("@/lib/db"),
      "and the record reads no environment value and reaches for no server module, so retuning a path is an edit to one file rather than a deploy",
    );

    // The copy, under the house rule. A signature line is what D2 prints on
    // a locked card, so it is a string a captain reads in the strictest
    // sense, and the two modules the sweep wrote hold the rule in their
    // comments as well as in their copy.
    check(
      PATH_IDS.every(
        (id) =>
          PATHS[id].signature.length > 0 &&
          !CARRIES_A_DASH.test(PATHS[id].signature) &&
          !CARRIES_A_DASH.test(PATHS[id].name),
      ),
      "every name and signature line a locked card would print is free of dashes, the same rule every other string a captain reads is held to",
    );
    check(
      !carriesADash("src/lib/game/paths.ts") &&
        !carriesADash("src/lib/game/gambit.ts"),
      "and the record itself, and the alignment module whose hidden card the sweep renamed, hold it in their comments as well as in their copy",
    );

    // =================================================================
    // [D2: the nine slot order board] The manifest's pathbound slots, read
    // against the plan's own clause for the feature: "Six basic orders open,
    // three pathbound orders greyed out, each stamped with the crest of the
    // path that would unlock it and labeled in plain language."
    //
    // The boards below are dealt through the real lifecycle rather than
    // assembled by hand: snapToCheckpoint runs the engine's own startOrders,
    // so what is read here is the board a captain meets in the Orders phase.
    // =================================================================
    console.log("\nThe pathbound order board");

    const dealOrders = (suffix: string) => {
      const state = voyageState();
      snapToCheckpoint(
        state,
        { seedBase: `smoke:path-orders:${suffix}`, harborId: "harbor-a" },
        1,
        "orders",
        [],
      );
      return state;
    };

    // The switch's own policy, read through the function every other switch
    // in this tree is read through, so one typo cannot leave the board half
    // switched.
    check(
      [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
        withEnv(
          "NEXT_PUBLIC_PATH_ORDERS",
          value,
          switchFor(GAMBIT, pathOrdersOn),
        ),
      ) &&
        ["off", "0", "OFF", " off ", "Off"].every(
          (value) =>
            !withEnv(
              "NEXT_PUBLIC_PATH_ORDERS",
              value,
              switchFor(GAMBIT, pathOrdersOn),
            ),
        ),
      "the pathbound board is on for every value except the word off and the digit zero, which is the policy every switch in this tree is read through",
    );

    withEnv("NEXT_PUBLIC_PATH_ORDERS", "1", () => {
      const board = dealOrders("a");
      const pathCards = board.customerCards.filter((o) => o.isPathOrder);
      const plainCards = board.customerCards.filter((o) => !o.isPathOrder);
      // The tier's own draw, read off the charter's schedule rather than off
      // a number typed here, so a tier that widens its board moves this check
      // with it.
      const scheduled = marketCountsFor(
        board.difficulty,
        board.currentRound,
      ).order;
      check(
        plainCards.length === scheduled &&
          pathCards.length === PATH_ORDER_SLOTS &&
          board.customerCards.length === scheduled + PATH_ORDER_SLOTS,
        `a fair winds board is the tier's own draw plus the paths' three, which is the plan's nine slot board (${plainCards.length} open, ${pathCards.length} pathbound)`,
      );

      // Every pathbound card is a one good errand whose good belongs to a
      // path and to the manifest both. The second half of that is the
      // property that keeps the Quartermaster's provisions off this board: a
      // food is pantry goods bought at RATION_PRICE a meal and never sold, so
      // a card demanding one would be a Gold press rather than a trade (see
      // the orderPool note in ./paths).
      check(
        pathCards.every(
          (o) =>
            o.resources.length === 1 &&
            lockingPathFor(o.resources[0].type) !== null &&
            (ITEMS as readonly string[]).includes(o.resources[0].type) &&
            pathOrderOf(o, GAMBIT) === lockingPathFor(o.resources[0].type),
        ),
        "each of the three demands exactly one good, a good some path's pool claims and a good the hold itself trades, so a pathbound card is an errand the manifest could really post and a captain could really fill once they hold the path",
      );
      // Which path a card waits on is computed from the good every time,
      // which is what makes the good the whole of the label.
      check(
        pathCards.every((o) => {
          const config = pathConfig(pathOrderOf(o, GAMBIT));
          return (
            config !== null &&
            config.crest.length > 0 &&
            config.name.length > 0 &&
            config.orderPool.includes(o.resources[0].type)
          );
        }),
        "and each is stamped with the crest and the name of the path whose pool owns its good, read off the record rather than written onto the card, which is the plan's own instruction for the lock reason",
      );
      // The good's kind is the card's kind, which is the claim that a
      // pathbound errand is priced by the generator every other card of that
      // good is priced by rather than at a rate of its own.
      check(
        pathCards.every((o) =>
          (RESOURCES as readonly string[]).includes(o.resources[0].type)
            ? !o.isProductOrder
            : o.isProductOrder &&
              PRODUCT_PRICES[o.resources[0].type] !== undefined,
        ),
        "and each is priced by the generator its own kind of good is priced by, raw as raw and finished as finished, so a pathbound card asks what the manifest pays for that good and never at a discount",
      );

      // The lock itself. A captain with no path is locked out of every
      // pathbound card, and every captain is pathless until D7's draft deals
      // one, so this is the state of the table this build ships: the rule
      // teaches by being true rather than by being staged.
      const marked = pathCards[0];
      const owner = marked ? pathOrderOf(marked, GAMBIT) : null;
      check(
        marked !== undefined &&
          pathCards.every(
            (o) => lockedBehind(board, o) === pathOrderOf(o, GAMBIT),
          ) &&
          lockedBehind(board, marked) !== null,
        "a captain who holds no path is locked out of all three, which is the ordinary table until the draft that deals a path lands",
      );
      check(
        owner !== null &&
          pathCards.every((o) =>
            pathOrderOf(o, GAMBIT) === owner
              ? lockedBehind({ ...board, path: owner }, o) === null
              : lockedBehind({ ...board, path: owner }, o) ===
                pathOrderOf(o, GAMBIT),
          ),
        "and holding one path opens the cards it posted while leaving the other path's cards locked, which is what makes the board a set of doors rather than one door",
      );

      // The guard, on one card and one hold: stocked for the locked card and
      // refused with the goods aboard, then the same card and the same stock
      // to the captain it waits on.
      const good = marked?.resources[0].type ?? "";
      const need = marked?.resources[0].required ?? 0;
      const seatFor = (path: PathId | null) => {
        const state = dealOrders("a");
        const card = state.customerCards.find((o) => o.id === marked?.id);
        if (!card)
          throw new Error(
            "The pathbound order checks need the same board dealt twice.",
          );
        state.path = path;
        state.inventory[good] = need;
        state.money = 100;
        return { state, card };
      };
      if (marked && owner) {
        const refused = seatFor(null);
        const refusal: string[] = [];
        completeOrder(refused.state, refused.card.id, refusal);
        check(
          canFillOrder(refused.state, refused.card) === false &&
            refused.state.money === 100 &&
            !refused.state.completedOrders.includes(refused.card.id) &&
            refusal.some((line) => line.includes(pathLockLine(owner))),
          "a locked card is refused even with the goods aboard, and the refusal is the same sentence the board prints on the card rather than a second one written for the ledger",
        );
        const opened = seatFor(owner);
        const fillable = canFillOrder(opened.state, opened.card);
        completeOrder(opened.state, opened.card.id, []);
        check(
          fillable === true &&
            opened.state.money > 100 &&
            opened.state.completedOrders.includes(opened.card.id),
          "and the same card, stocked the same way, opens for the captain holding the path it waits on, who is paid for it like any other order: the path decides who may press the card, not what the card pays",
        );
      }

      // The draw this feature never touched. An ordinary card that demands a
      // pooled good is nobody's locked card, marker and all: the lock hangs
      // on the marker rather than on the good, which is what keeps the six a
      // captain has always been dealt exactly as open as they were.
      const pooledPath = PATH_IDS.find((id) => PATHS[id].orderPool.length > 0);
      const pooledGood = pooledPath ? PATHS[pooledPath].orderPool[0] : "";
      const ordinary: OrderCard = {
        id: 999,
        demandPort: "Hangzhou Port",
        resources: [{ type: pooledGood, required: 1 }],
        reward: 40,
        totalItems: 1,
        isProductOrder: false,
      };
      check(
        pooledPath !== undefined &&
          lockingPathFor(pooledGood) === pooledPath &&
          pathOrderOf(ordinary, GAMBIT) === null &&
          lockedBehind(board, ordinary) === null &&
          lockedBehind({ ...board, path: pooledPath }, ordinary) === null,
        "and an ordinary order demanding the very same good is open to every captain, marker and all, so the lock is the marker's doing and never the good's",
      );

      // The count the leg report files, which the balance dashboard's
      // expired orders are read off: a locked card is not an order anybody
      // failed to fill, so it is not a dealt one either.
      check(
        owner !== null &&
          openOrderCount(board) === scheduled &&
          openOrderCount({ ...board, path: owner }) ===
            scheduled +
              pathCards.filter((o) => pathOrderOf(o, GAMBIT) === owner).length,
        "and the dealt count a leg report files leaves the locked cards out, counting the tier's own draw when the captain holds no path and adding back exactly the cards the path they hold posted",
      );
    });

    // The switch, at the other end: the same seed and the same round with
    // path orders off. This is the plan's rollback clause read literally
    // ("Flag off and the three pathbound slots disappear, leaving the
    // existing six"), and it is this feature's backward compatibility read at
    // the same time: the six the draw deals are the same six, card for card,
    // whether the feature is on or off, because the pathbound slots are drawn
    // from a stream of their own.
    const pathOffBoard = withEnv("NEXT_PUBLIC_PATH_ORDERS", "off", () =>
      dealOrders("a"),
    );
    const pathOnBoard = dealOrders("a");
    check(
      pathOffBoard.customerCards.length ===
        pathOnBoard.customerCards.length - PATH_ORDER_SLOTS &&
        pathOffBoard.customerCards.every((o, i) => {
          const on = pathOnBoard.customerCards[i];
          return (
            !o.isPathOrder &&
            on !== undefined &&
            o.id === on.id &&
            o.resources[0]?.type === on.resources[0]?.type &&
            o.reward === on.reward
          );
        }),
      "with the switch off the three slots are gone from the board and the orders that remain are the very same orders, card for card and reward for reward, which is what the separate draw buys",
    );
    check(
      pathOffBoard.customerCards.every(
        (o) =>
          pathOrderOf(o, GAMBIT) === null &&
          lockedBehind(pathOffBoard, o) === null,
      ) && openOrderCount(pathOffBoard) === pathOffBoard.customerCards.length,
      "and a board dealt with the switch off carries no locked card at all, which is the base game exactly",
    );
    // The same reading for a card already dealt: a marked card is a marker
    // on a card, so a build with the switch off plays it as an ordinary
    // order rather than leaving it grey forever.
    const markedCards = pathOnBoard.customerCards.filter((o) => o.isPathOrder);
    check(
      markedCards.length === PATH_ORDER_SLOTS &&
        withEnv("NEXT_PUBLIC_PATH_ORDERS", "off", () =>
          markedCards.every(
            (o) =>
              pathOrderOf(o, GAMBIT) === null &&
              lockedBehind(pathOnBoard, o) === null,
          ),
        ),
      "and a card already dealt by a build with the switch on is an ordinary order to a build with it off, so rolling the feature back mid voyage leaves nobody holding a card no one can fill",
    );

    // The plan's definition of done asks new state to round trip through a
    // save, and the marker is new state on a persisted object: the board is
    // written into the save blob, so a marked card has to come back marked
    // and be read the same way at both ends of the switch after a trip
    // through JSON as it was read before one.
    const carriedBoard = JSON.parse(JSON.stringify(pathOnBoard)) as GameState;
    check(
      withEnv("NEXT_PUBLIC_PATH_ORDERS", "1", () => {
        const carriedMarks = carriedBoard.customerCards.filter(
          (o) => o.isPathOrder,
        );
        return (
          carriedMarks.length === PATH_ORDER_SLOTS &&
          carriedMarks.every((o) => pathOrderOf(o, GAMBIT) !== null) &&
          openOrderCount(carriedBoard) ===
            carriedBoard.customerCards.length - PATH_ORDER_SLOTS
        );
      }) &&
        withEnv("NEXT_PUBLIC_PATH_ORDERS", "off", () =>
          carriedBoard.customerCards.every(
            (o) =>
              pathOrderOf(o, GAMBIT) === null &&
              lockedBehind(carriedBoard, o) === null,
          ),
        ),
      "a dealt board round trips through a save with its marks intact, and the same board carried back under the switch off is nine ordinary orders with nobody locked out of any of them",
    );

    // The label, under the house rule: the lock line is computed from the
    // record, names the path it waits on, and differs for every path, so two
    // cards on one board can never explain themselves with one sentence.
    check(
      PATH_IDS.every((id) => {
        const line = pathLockLine(id);
        return line.includes(PATHS[id].name) && !CARRIES_A_DASH.test(line);
      }) &&
        new Set(PATH_IDS.map((id) => pathLockLine(id))).size ===
          PATH_IDS.length,
      "the lock line names the path it waits on for every path, reads free of dashes under the house rule, and is never the same sentence for two paths",
    );
    // The plan's instruction for this feature, held by a scan of the tree
    // rather than by memory: the lock reason is computed from the path config
    // rather than written into the card. The stem below is the part of the
    // sentence that is literal in the source (the rest is the path's own
    // name), and it is swept for across every source file, so finding it in
    // one file is finding the sentence in one file however a second copy of
    // it might be spelled.
    const lockStem = pathLockLine(PATH_IDS[0]).split(
      PATHS[PATH_IDS[0]].name,
    )[0];
    const lockCarriers = walkSrc(join(import.meta.dirname, "..", "src")).filter(
      (file) => readFileSync(file, "utf8").includes(lockStem),
    );
    check(
      lockStem.length > 0 &&
        lockCarriers.length === 1 &&
        lockCarriers[0].endsWith(join("game", "paths.ts")),
      "the lock sentence a card prints appears in one file in the whole tree, the path record, so a retuned path cannot desynchronize from the words the board explains it with",
    );

    console.log("\nThe escort contract");

    // ---- The rules, on a captain's own machine ----

    // The switch's own policy, read through the function every other switch
    // in this tree is read through, so one typo cannot leave the market half
    // switched.
    check(
      [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
        withEnv(
          "NEXT_PUBLIC_ESCORT_CONTRACTS",
          value,
          switchFor(GAMBIT, escortContractsOn),
        ),
      ) &&
        ["off", "0", "OFF", " off ", "Off"].every(
          (value) =>
            !withEnv(
              "NEXT_PUBLIC_ESCORT_CONTRACTS",
              value,
              switchFor(GAMBIT, escortContractsOn),
            ),
        ),
      "the escort market is on for every value except the word off and the digit zero, which is the policy every switch in this tree is read through",
    );

    // A fee, as the one reader both the form and the socket go through
    // reads it.
    check(
      consentFeeFor(CONSENT_FEE_MIN) === CONSENT_FEE_MIN &&
        consentFeeFor(CONSENT_FEE_MAX) === CONSENT_FEE_MAX &&
        consentFeeFor(50) === 50 &&
        consentFeeFor(CONSENT_FEE_MAX + 0.6) === CONSENT_FEE_MAX &&
        consentFeeFor(1.9) === 1,
      "a fee inside the contract's own bounds is accepted, and a fraction of a Gold coin is floored rather than refused, because a form that hands back a value a hair over what was typed is a form and not a cheat",
    );
    check(
      [
        0,
        -1,
        CONSENT_FEE_MIN - 1,
        CONSENT_FEE_MAX + 1,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        "50",
        null,
        undefined,
        {},
        true,
      ].every((value) => consentFeeFor(value) === null),
      "and a fee outside them, or one that is not a number at all, is refused outright rather than clamped, because a fee somebody typed wrong is not the fee they meant",
    );

    // What the guns beat off, which is the one number the ability's power is
    // written as.
    check(
      escortCoverage() === CONVOY_RAID_COVERAGE &&
        escortCoverage() > 0 &&
        escortCoverage() < 1,
      "the guns' share of a raid is the one number the constants carry, and it leaves part of the boarding party for the escort's hold to eat",
    );

    // Who may sell, read off the path record the way every other path rule
    // in this tree is read.
    check(
      withEnv("NEXT_PUBLIC_ESCORT_CONTRACTS", "1", () =>
        PATH_IDS.every(
          (id) =>
            canSellEscort({ path: id, mode: GAMBIT }) ===
            (id === ESCORT_SELLER_PATH),
        ),
      ) &&
        withEnv(
          "NEXT_PUBLIC_ESCORT_CONTRACTS",
          "1",
          () => !canSellEscort({ path: null, mode: GAMBIT }),
        ) &&
        !withEnv("NEXT_PUBLIC_ESCORT_CONTRACTS", "off", () =>
          canSellEscort({ path: ESCORT_SELLER_PATH, mode: GAMBIT }),
        ),
      "one path sells protection and no other does, and the switch refuses a Convoy captain as flatly as it refuses everyone else, because the flag is the operator's rollback and the path is the captain's identity",
    );

    // The mirror the raid roll consults, which is a read of one field and
    // never a question about the board.
    const aCover: EscortCover = { contractId: "c1", sellerName: "Smoke S" };
    check(
      withEnv(
        "NEXT_PUBLIC_ESCORT_CONTRACTS",
        "1",
        () =>
          escortCoverOf({ escortCover: aCover, mode: GAMBIT })?.contractId ===
          "c1",
      ) &&
        withEnv(
          "NEXT_PUBLIC_ESCORT_CONTRACTS",
          "off",
          () => escortCoverOf({ escortCover: aCover, mode: GAMBIT }) === null,
        ) &&
        escortCoverOf({ escortCover: null, mode: GAMBIT }) === null,
      "the raid roll's cover is the mirror itself while the market runs, nothing at all with the switch off whatever the mirror still says, and nothing at all on a captain nobody covered",
    );

    // One contract, in whatever shape a check below needs it.
    //
    // The phase is the one field no check here varies, so it is the one field
    // the fixture refuses to take an override for: every row on this market
    // was made at the Parley, which is where the board is drawn, and a helper
    // that could place a contract in another phase would let a check describe
    // a board the market cannot produce.
    const contractOn = (
      over: Partial<Omit<EscortContract, "phase">>,
    ): EscortContract => ({
      id: "c1",
      sellerUserId: "seller",
      sellerName: "Smoke Seller",
      buyerUserId: "buyer",
      buyerName: "Smoke Buyer",
      fee: 40,
      round: 3,
      phase: "parley",
      status: "agreed",
      ...over,
    });

    // What a board answers about the captain reading it.
    check(
      coverFromBoard([contractOn({})], "buyer", 3)?.contractId === "c1" &&
        coverFromBoard([contractOn({})], "buyer", 4) === null &&
        coverFromBoard([contractOn({})], "seller", 3) === null &&
        coverFromBoard([contractOn({ status: "offered" })], "buyer", 3) ===
          null &&
        coverFromBoard([contractOn({ status: "claimed" })], "buyer", 3) !==
          null,
      "a contract covers the captain it names as its buyer, in the leg it was made for: an offer nobody took protects nobody, another captain's contract is not this captain's cover, and the leg it no longer matches leaves them sailing on their own luck",
    );
    check(
      coverFromBoard([], "buyer", 3) === null,
      "and a board that carries no contract covers nobody, which is the whole of what a seller's departure takes from the buyer they were covering",
    );
    check(
      consentPartyBusy([contractOn({})], "buyer", "buyer", 3) &&
        !consentPartyBusy([contractOn({})], "buyer", "buyer", 4) &&
        !consentPartyBusy(
          [contractOn({ status: "offered" })],
          "buyer",
          "buyer",
          3,
        ) &&
        !consentPartyBusy([contractOn({})], "buyer", "seller", 3) &&
        consentPartyBusy([contractOn({})], "seller", "seller", 3),
      "one agreement per captain per leg, asked on the side the market bounds: an agreement somebody actually holds makes that party busy, an offer they have not taken is not, a captain on the other side of the table is not, and the side is the whole of what the two markets differ on, so the escort asks about its buyer while the Loom's bench asks about its seller",
    );

    // The board's own three policies: who sees a row, what an expiry takes
    // away, and what an accept consumes.
    const openOffer = contractOn({
      id: "open",
      status: "offered",
      buyerUserId: null,
      buyerName: null,
    });
    const directOffer = contractOn({ id: "direct", status: "offered" });
    const claimedRow = contractOn({
      id: "claimed",
      status: "claimed",
      raidGold: 250,
    });
    check(
      visibleContracts([openOffer, directOffer], "stranger").length === 1 &&
        visibleContracts([openOffer, directOffer], "buyer").length === 2 &&
        visibleContracts([openOffer, directOffer], "seller").length === 2,
      "an open offer is the market and a direct offer is the business of the two captains it names, which is the privacy the exchange board gives a targeted trade",
    );
    check(
      visibleContracts([claimedRow], "seller")[0]?.raidGold === 250 &&
        visibleContracts([claimedRow], "buyer")[0]?.raidGold === undefined &&
        visibleContracts([claimedRow], "stranger")[0]?.raidGold === undefined &&
        visibleContracts([claimedRow], "stranger")[0]?.status === "claimed",
      "and a claimed contract is public while the figure it carries is not: the seller reads what the raid would have taken, and everyone else reads that it was claimed",
    );
    check(
      expireConsent([openOffer], { phase: "orders", round: 3 }).length === 0 &&
        expireConsent([directOffer], { phase: "orders", round: 3 }).length ===
          0 &&
        expireConsent([claimedRow], { phase: "orders", round: 3 }).length ===
          1 &&
        expireConsent([claimedRow], { phase: "parley", round: 4 }).length === 0,
      "an offer nobody took dies with the Parley it was posted in, because an offer nobody accepted is not binding on anyone, while a contract the two captains did agree survives the phase it was made in and lives exactly the leg it protects",
    );
    check(
      consentOfferStanding([openOffer], "seller", null) &&
        !consentOfferStanding([openOffer], "seller", "buyer") &&
        !consentOfferStanding([openOffer], "buyer", null) &&
        !consentOfferStanding([claimedRow], "seller", "buyer"),
      "a seller's rows are bounded by the table they are selling at: an offer for anyone is not a second offer to a named captain, another captain's row is not this seller's standing offer, and a contract already agreed is not an offer",
    );
    const sweptBoard = agreeConsent(
      [
        openOffer,
        directOffer,
        contractOn({
          id: "other",
          status: "offered",
          sellerUserId: "seller2",
          sellerName: "Smoke Seller Two",
        }),
      ],
      "direct",
      { userId: "buyer", name: "Smoke Buyer" },
    );
    check(
      sweptBoard.find((c) => c.id === "direct")?.status === "agreed" &&
        sweptBoard.find((c) => c.id === "direct")?.buyerName ===
          "Smoke Buyer" &&
        !sweptBoard.some((c) => c.id === "other") &&
        sweptBoard.some((c) => c.id === "open"),
      "an accept writes the buyer onto the contract and takes every other offer that named them off the board in the same pass, while an offer addressed to nobody is left standing for whoever wants it",
    );

    // ---- What a contract does to a purse ----
    //
    // One function for both sides, applied by each captain to their own
    // state and to nobody else's, which is this tree's standing model for
    // cross captain Gold.
    const purseOf = (gold: number): GameState => {
      const state = voyageState();
      state.money = gold;
      return state;
    };
    withEnv("NEXT_PUBLIC_ESCORT_CONTRACTS", "1", () => {
      const buyer = purseOf(500);
      const seller = purseOf(500);
      const contract = contractOn({});
      check(
        applyEscortSide(buyer, contract, "buyer", []) &&
          applyEscortSide(seller, contract, "seller", []) &&
          buyer.money === 460 &&
          seller.money === 540 &&
          buyer.escortBought === 1 &&
          buyer.escortFeesPaid === 40 &&
          seller.escortSold === 1 &&
          seller.escortFeesEarned === 40,
        "the fee moves once on each side of the contract, out of the buyer's purse and into the seller's, and each captain's own tally counts their own side of it",
      );
      check(
        !applyEscortSide(buyer, contract, "buyer", []) &&
          buyer.money === 460 &&
          buyer.escortBought === 1,
        "and a movement already applied does not move again, so a reload between the handshake and the frame that carries it cannot pay the same fee twice",
      );
      check(
        !applyEscortSide(buyer, contract, "stranger", []) &&
          buyer.money === 460 &&
          buyer.escortFeesPaid === 40,
        "and a captain who is neither party to a contract is not touched by it at all, which is the rule that leaves every purse with one owner",
      );

      const short = purseOf(15);
      applyEscortSide(short, contractOn({}), "buyer", []);
      check(
        short.money === 0 && short.escortFeesPaid === 15,
        "a buyer whose purse moved between the handshake and the payment pays the Gold that is actually there rather than going into debt",
      );

      // The absorbed raid, priced on the seller's own machine because the
      // seller is the one whose Gold it comes out of.
      const raided = purseOf(500);
      const eaten = 100 - Math.floor(100 * escortCoverage());
      applyEscortSide(
        raided,
        contractOn({ status: "claimed", raidGold: 100 }),
        "seller",
        [],
      );
      check(
        raided.money === 500 - eaten &&
          raided.escortClaims === 1 &&
          raided.escortAbsorbed === eaten,
        "the escort eats the share of the raid its guns did not beat off, out of its own hold, and a claim of a hundred Gold costs the escort the rest of it",
      );
      const bare = purseOf(0);
      applyEscortSide(
        bare,
        contractOn({ status: "claimed", raidGold: 100 }),
        "seller",
        [],
      );
      check(
        bare.money === 0 &&
          bare.escortAbsorbed === 0 &&
          bare.escortClaims === 1,
        "and a seller whose own hold is bare answers for nothing rather than going into debt, while the raid they answered is still counted as one their guns turned away",
      );
      const spared = purseOf(500);
      check(
        !applyEscortSide(
          spared,
          contractOn({ status: "claimed", raidGold: 100 }),
          "buyer",
          [],
        ) && spared.money === 500,
        "and the captain the raid was meant for pays nothing for having been covered, because the Gold they kept is the whole of what they bought",
      );
    });
    check(
      withEnv("NEXT_PUBLIC_ESCORT_CONTRACTS", "off", () => {
        const buyer = purseOf(500);
        const seller = purseOf(500);
        return (
          !applyEscortSide(buyer, contractOn({}), "buyer", []) &&
          !applyEscortSide(seller, contractOn({}), "seller", []) &&
          buyer.money === 500 &&
          seller.money === 500
        );
      }),
      "and with the market switched off a contract still sitting on the board moves no Gold on either side of it, so the rollback is clean at the moment money would have moved rather than only at the moment a market was drawn",
    );

    // The ledger, which is the idempotence and the leg stamp both.
    const ledgerLeftOver = purseOf(500);
    ledgerLeftOver.currentRound = 5;
    ledgerLeftOver.settledMovements = ["c1:fee"];
    ledgerLeftOver.settledRound = 4;
    applyEscortSide(ledgerLeftOver, contractOn({}), "buyer", []);
    check(
      ledgerLeftOver.money === 460 &&
        ledgerLeftOver.settledMovements.length === 1 &&
        ledgerLeftOver.settledMovements[0] === "c1:fee",
      "a ledger left over from an earlier leg answers for nothing: the movement applies and the list is replaced rather than grown, so an id that comes round again on a new leg still settles",
    );
    const leaving = purseOf(500);
    leaving.currentRound = 4;
    leaving.escortCover = aCover;
    leaving.pendingEscortClaim = { contractId: "c1", raidGold: 100 };
    leaving.settledMovements = ["c1:fee", "c1:claim"];
    leaving.settledRound = 4;
    // The two calls the Dawn makes, in the order it makes them, because the
    // ledger stopped being the escort's when the primitive arrived (see
    // startBoonDrafting): one takes the leg's cover and its waiting claim,
    // and the other empties the leg's settlement ledger and stamps it.
    resetEscortLeg(leaving);
    resetConsentLedger(leaving);
    check(
      leaving.escortCover === null &&
        leaving.pendingEscortClaim === null &&
        leaving.settledMovements.length === 0 &&
        leaving.settledRound === 4,
      "the Dawn that opens a leg takes the cover, the claim waiting to be relayed and the ledger with it, and stamps the new leg so the list is emptied there rather than at the next settlement",
    );

    // ---- The raid roll, which is the one place the cover is spent ----
    //
    // A roll that always raids rather than a tier that happens to be harsh,
    // so the branch below is read for certain instead of usually.
    const forced = (value: number, run: () => void): void => {
      const real = Math.random;
      Math.random = () => value;
      try {
        run();
      } finally {
        Math.random = real;
      }
    };
    const coveredHold = purseOf(400);
    coveredHold.escortCover = aCover;
    withEnv("NEXT_PUBLIC_ESCORT_CONTRACTS", "1", () =>
      forced(0, () => resolvePirateAttack(coveredHold, [])),
    );
    check(
      coveredHold.money === 400 &&
        coveredHold.pendingEscortClaim?.contractId === "c1" &&
        coveredHold.pendingEscortClaim?.raidGold === 400,
      "a raid on a covered hold takes nothing: the Gold stays where it was, and what the raiders would have taken is left on the state as the claim the client relays to the seller",
    );
    const emptyCovered = purseOf(0);
    emptyCovered.escortCover = aCover;
    withEnv("NEXT_PUBLIC_ESCORT_CONTRACTS", "1", () =>
      forced(0, () => resolvePirateAttack(emptyCovered, [])),
    );
    check(
      emptyCovered.pendingEscortClaim === null && emptyCovered.money === 0,
      "and a raid that would have taken nothing raises no claim, because a bill of zero Gold is not a loss and would put a loss on the seller's ledger that never happened",
    );
    const raidedHold = purseOf(400);
    withEnv("NEXT_PUBLIC_ESCORT_CONTRACTS", "1", () =>
      forced(0, () => resolvePirateAttack(raidedHold, [])),
    );
    check(
      raidedHold.money === 0 && raidedHold.pendingEscortClaim === null,
      "a raid on an uncovered hold still takes every coin, which is the voyage this feature did not change",
    );
    const rolledBackHold = purseOf(400);
    rolledBackHold.escortCover = aCover;
    withEnv("NEXT_PUBLIC_ESCORT_CONTRACTS", "off", () =>
      forced(0, () => resolvePirateAttack(rolledBackHold, [])),
    );
    check(
      rolledBackHold.money === 0 && rolledBackHold.pendingEscortClaim === null,
      "and with the market switched off the same captain sails the raid they sailed before this feature existed, cover or no cover",
    );

    // ---- The heal, and the save ----
    const ancient = voyageState();
    const stripped = ancient as unknown as Record<string, unknown>;
    for (const field of [
      "escortCover",
      "pendingEscortClaim",
      "settledMovements",
      "settledRound",
      "escortSold",
      "escortBought",
      "escortFeesEarned",
      "escortFeesPaid",
      "escortClaims",
      "escortAbsorbed",
    ]) {
      stripped[field] = undefined;
    }
    const wounded = voyageState();
    wounded.escortSold = -3;
    wounded.escortAbsorbed = Number.NaN;
    wounded.settledMovements = ["c1:fee", 7] as unknown as string[];
    wounded.settledRound = 2.7;
    wounded.escortCover = { contractId: 5 } as unknown as EscortCover;
    wounded.pendingEscortClaim = {
      contractId: "c1",
      raidGold: "100",
    } as unknown as EscortClaim;
    normalizeEscortState(ancient);
    normalizeConsentLedger(ancient);
    normalizeEscortState(wounded);
    normalizeConsentLedger(wounded);
    check(
      ancient.escortSold === 0 &&
        ancient.escortAbsorbed === 0 &&
        ancient.escortCover === null &&
        ancient.pendingEscortClaim === null &&
        ancient.settledMovements.length === 0 &&
        ancient.settledRound === 0,
      "a save written before this feature reads as a captain who has bought nothing, sold nothing and owes nobody, rather than as one whose next raid roll throws",
    );
    check(
      wounded.escortSold === 0 &&
        wounded.escortAbsorbed === 0 &&
        wounded.settledMovements.length === 1 &&
        wounded.settledMovements[0] === "c1:fee" &&
        wounded.settledRound === 2 &&
        wounded.escortCover === null &&
        wounded.pendingEscortClaim === null,
      "and a save carrying the fields in shapes the engine would not survive is healed to the same reading: counts floored, the ledger filtered to strings rather than left holding a key that would never match, and a cover or a claim missing its own fields dropped outright",
    );
    const keptWhole = voyageState();
    keptWhole.escortCover = aCover;
    keptWhole.pendingEscortClaim = { contractId: "c1", raidGold: 250 };
    keptWhole.escortSold = 2;
    normalizeEscortState(keptWhole);
    check(
      keptWhole.escortCover?.contractId === "c1" &&
        keptWhole.pendingEscortClaim?.raidGold === 250 &&
        keptWhole.escortSold === 2,
      "and a save that already holds a leg's contract facts keeps them, so the pass is a heal rather than a reset",
    );
    const carriedCover = JSON.parse(JSON.stringify(keptWhole)) as GameState;
    check(
      carriedCover.escortCover?.sellerName === "Smoke S" &&
        carriedCover.pendingEscortClaim?.raidGold === 250 &&
        withEnv(
          "NEXT_PUBLIC_ESCORT_CONTRACTS",
          "1",
          () => escortCoverOf(carriedCover)?.contractId === "c1",
        ),
      "and the cover round trips through a save with the same meaning on the far side, which is the value the raid roll reads when the captain comes back to a voyage in flight",
    );

    // ---- The market, in a real harbor ----
    //
    // Three captains at a table of their own, so nothing here leans on the
    // harbor the rest of this run shares: that harbor is still standing at
    // the end of this section, and the checks after it read it.
    //
    // The harbor is a Gambit one, and that is the fixture rather than a
    // preference: the exchange is a system of that mode, so a founding mode
    // table would refuse every post below for a reason the checks would
    // report as the board's own rule. The phrase is the one every sealed
    // harbor in this script is opened with.
    const escortSeller = await signUp("esc_s");
    const escortBuyer = await signUp("esc_b");
    const escortForeigner = await signUp("esc_f");
    run.extraAccounts.push(escortSeller, escortBuyer, escortForeigner);

    const escortRoom = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: escortSeller.cookie,
        body: JSON.stringify({
          name: `Smoke escort ${suffix}`,
          isPublic: false,
          mode: "ocean_gambit",
          unlock: LEDGER_PHRASE,
        }),
      },
    );
    if (escortRoom.status !== 200) {
      throw new Error("No harbor to sell protection in.");
    }
    const escortRoomId = escortRoom.body.room.id;
    const escortCrew = [escortSeller, escortBuyer, escortForeigner];
    const escortJoins = await Promise.all(
      escortCrew.slice(1).map((captain) =>
        call<{ room: { id: string } }>("/api/rooms/join", {
          method: "POST",
          cookie: captain.cookie,
          body: JSON.stringify({ code: escortRoom.body.room.code }),
        }),
      ),
    );
    check(
      escortJoins.every((join) => join.status === 200),
      "three captains can sit at a table where protection is sold",
    );

    // Each socket's newest board, and every row that board has ever carried.
    // The second is what makes the privacy checks below a claim about what a
    // captain was told rather than about what they happened to read last.
    const escortBoards = new Map<string, EscortContract[]>();
    const escortSeen = new Map<string, Set<string>>();
    const escortSockets = new Map<string, Socket>();
    for (const captain of escortCrew) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      const seatedHere = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === escortRoomId,
      );
      socket.emit("room:join", { roomId: escortRoomId });
      await seatedHere;
      socket.on("contract:update", (payload: EscortBoard) => {
        if (payload?.roomId !== escortRoomId) return;
        escortBoards.set(captain.id, payload.contracts);
        const seen = escortSeen.get(captain.id) ?? new Set<string>();
        for (const contract of payload.contracts) seen.add(contract.id);
        escortSeen.set(captain.id, seen);
      });
      escortSockets.set(captain.id, socket);
    }
    const socketOf = (captain: Captain): Socket => {
      const found = escortSockets.get(captain.id);
      if (!found) throw new Error(`No socket for ${captain.username}.`);
      return found;
    };
    const boardOf = (captain: Captain): EscortContract[] =>
      escortBoards.get(captain.id) ?? [];
    const settle = () => new Promise((resolve) => setTimeout(resolve, 500));
    // The emit and the wait are one call, so no frame can arrive between
    // them: a refusal waited for after the fact is a refusal this run might
    // have already missed.
    const refusedFrom = async (
      captain: Captain,
      event: string,
      frame: Record<string, unknown>,
    ): Promise<string | null> => {
      const refused = waitForEvent<{ roomId: string; error: string }>(
        socketOf(captain),
        "contract:error",
        (payload) => payload?.roomId === escortRoomId && Boolean(payload.error),
      );
      socketOf(captain).emit(event, { roomId: escortRoomId, ...frame });
      return (await refused)?.error ?? null;
    };
    const boardSettles = (
      captain: Captain,
      match: (board: EscortContract[]) => boolean,
    ) =>
      waitForEvent<EscortBoard>(
        socketOf(captain),
        "contract:update",
        (payload) =>
          payload?.roomId === escortRoomId && match(payload?.contracts ?? []),
      );

    socketOf(escortSeller).emit("room:start", { roomId: escortRoomId });
    await settle();

    // The market belongs to the Parley, and the departure puts the room at
    // its opening seat rather than at one, so this is posted out of season
    // by construction rather than by a clock the run has to wait on.
    const outOfSeason = await refusedFrom(escortSeller, "contract:post", {
      fee: 50,
    });
    check(
      outOfSeason !== null && outOfSeason.includes(phaseFace("parley").label),
      "an offer cannot be posted outside the Parley, and the refusal names the phase that opens it",
    );

    // The room's seat, moved the way this suite moves any room's seat: a
    // captain reports the phase they are standing in and the checkpoint
    // follows a report that is further along. No engine stands behind these
    // sockets, so what they send is all this side of the wire can see.
    const reportSeat = (captain: Captain, round: number, phase: Phase) =>
      socketOf(captain).emit("game:status", {
        roomId: escortRoomId,
        round,
        phase,
        phaseLabel: phaseFace(phase).label,
        gold: 0,
        reputation: 0,
        shipLevel: 0,
        gameOver: false,
      });
    reportSeat(escortSeller, 1, "parley");
    await settle();

    const badFee = await refusedFrom(escortSeller, "contract:post", { fee: 0 });
    check(
      badFee !== null &&
        badFee.includes(String(CONSENT_FEE_MIN)) &&
        badFee.includes(String(CONSENT_FEE_MAX)),
      "a fee outside the contract's bounds is refused by the server rather than clamped, and the refusal states both ends of the range it will take",
    );

    const selfSell = await refusedFrom(escortSeller, "contract:post", {
      fee: 50,
      targetUserId: escortSeller.id,
    });
    check(
      selfSell !== null,
      "and a captain cannot sell protection to themselves",
    );

    const openPosted = boardSettles(escortForeigner, (board) =>
      board.some(
        (c) => c.sellerUserId === escortSeller.id && c.status === "offered",
      ),
    );
    socketOf(escortSeller).emit("contract:post", {
      roomId: escortRoomId,
      fee: 40.7,
    });
    const openRow = ((await openPosted)?.contracts ?? []).find(
      (c) => c.sellerUserId === escortSeller.id && c.status === "offered",
    );
    check(
      openRow !== undefined &&
        openRow.fee === 40 &&
        openRow.buyerUserId === null &&
        openRow.round === 1,
      "an open offer lands on the whole table's board at the fee the form meant, floored to whole Gold, addressed to nobody and stamped with the leg it was posted in",
    );
    check(
      openRow !== undefined && boardOf(escortForeigner).length === 1,
      "and it is the only row the third captain is handed, because an offer to the room is the one every captain may take",
    );

    const doubled = await refusedFrom(escortSeller, "contract:post", {
      fee: 40,
    });
    check(
      doubled !== null,
      "a second offer of the same shape from the same seller is refused, so one client cannot paper the board",
    );

    // A real account standing somewhere else. The membership check is per
    // harbor, which is the only thing that makes aiming an offer at a
    // captain a check at all.
    if (!run.host) {
      throw new Error("No captain in another harbor to aim an offer at.");
    }
    const strangerTarget = await refusedFrom(escortSeller, "contract:post", {
      fee: 50,
      targetUserId: run.host.id,
    });
    check(
      strangerTarget !== null,
      "and an offer cannot be addressed at a captain who is not in this harbor, whoever they are in another one",
    );

    // Asked at a quiet moment, so the next board this captain is handed is
    // the answer to the question rather than a broadcast that happened to
    // overtake it.
    const askedForBoard = waitForEvent<EscortBoard>(
      socketOf(escortBuyer),
      "contract:update",
      (payload) => payload?.roomId === escortRoomId,
    );
    socketOf(escortBuyer).emit("contract:state:request", {
      roomId: escortRoomId,
    });
    const answeredBoard = (await askedForBoard)?.contracts ?? [];
    check(
      openRow !== undefined &&
        answeredBoard.length === 1 &&
        answeredBoard[0]?.id === openRow.id,
      "a captain who asks for the board is handed the same board the room broadcast, personalised by the same rules",
    );

    const directPosted = boardSettles(escortBuyer, (board) =>
      board.some(
        (c) => c.buyerUserId === escortBuyer.id && c.status === "offered",
      ),
    );
    socketOf(escortSeller).emit("contract:post", {
      roomId: escortRoomId,
      fee: 60,
      targetUserId: escortBuyer.id,
    });
    const directRow = ((await directPosted)?.contracts ?? []).find(
      (c) => c.buyerUserId === escortBuyer.id && c.status === "offered",
    );
    check(
      directRow !== undefined && directRow.fee === 60,
      "a direct offer lands for the captain it names, at the price that was asked",
    );
    await settle();
    check(
      directRow !== undefined &&
        escortSeen.get(escortBuyer.id)?.has(directRow.id) === true &&
        escortSeen.get(escortForeigner.id)?.has(directRow.id) === false,
      "and no board the third captain was ever handed carried it, which is the privacy a targeted trade is worth",
    );

    const takenByThird = await refusedFrom(escortForeigner, "contract:accept", {
      contractId: directRow?.id ?? "",
    });
    check(
      takenByThird !== null && takenByThird.includes("addressed to another"),
      "an offer addressed to one captain cannot be taken by another, even though the board never showed it to them",
    );
    const soldBySeller = await refusedFrom(escortSeller, "contract:accept", {
      contractId: openRow?.id ?? "",
    });
    check(
      soldBySeller !== null,
      "and the captain selling the protection is not the captain who takes it",
    );

    const agreedBoard = boardSettles(escortSeller, (board) =>
      board.some((c) => c.id === directRow?.id && c.status === "agreed"),
    );
    socketOf(escortBuyer).emit("contract:accept", {
      roomId: escortRoomId,
      contractId: directRow?.id ?? "",
    });
    const agreedRow = ((await agreedBoard)?.contracts ?? []).find(
      (c) => c.id === directRow?.id,
    );
    // The name the row wears is the one the account is registered under,
    // read from the row the server itself read it from rather than typed
    // here, so the check cannot pass on a name this file made up.
    const buyerAccount = await db.user.findUnique({
      where: { id: escortBuyer.id },
      select: { displayName: true },
    });
    check(
      agreedRow?.status === "agreed" &&
        agreedRow.buyerUserId === escortBuyer.id &&
        agreedRow.buyerName === buyerAccount?.displayName,
      "a captain takes the cover by taking the offer, and the row that was an ask is now a contract with their own name written on it",
    );

    const alreadyCovered = await refusedFrom(escortBuyer, "contract:accept", {
      contractId: openRow?.id ?? "",
    });
    check(
      alreadyCovered !== null && alreadyCovered.includes("already covered"),
      "and a captain who is covered for a leg cannot take a second cover in it, because one buyer's cover is one field rather than a set",
    );

    const withdrawRefused = await refusedFrom(escortSeller, "contract:cancel", {
      contractId: directRow?.id ?? "",
    });
    check(
      withdrawRefused !== null,
      "a contract the two captains agreed cannot be withdrawn by the seller, so the one captain who regrets a price is left with the gap rather than with a button",
    );

    const cancelledBoard = boardSettles(escortForeigner, (board) =>
      board.every((c) => c.id !== openRow?.id),
    );
    socketOf(escortSeller).emit("contract:cancel", {
      roomId: escortRoomId,
      contractId: openRow?.id ?? "",
    });
    check(
      (await cancelledBoard) !== null,
      "while an offer nobody has taken is the seller's own to take back",
    );

    const sellerClaim = await refusedFrom(escortSeller, "contract:claim", {
      contractId: directRow?.id ?? "",
      raidGold: 250,
    });
    check(
      sellerClaim !== null && sellerClaim.includes("covers another"),
      "the seller cannot claim against a cover of their own making, because the claim is the covered captain's report of a raid rather than the seller's bill",
    );

    const silentZero = waitForEvent<{ roomId: string; error: string }>(
      socketOf(escortBuyer),
      "contract:error",
      (payload) => Boolean(payload?.error),
      900,
    );
    socketOf(escortBuyer).emit("contract:claim", {
      roomId: escortRoomId,
      contractId: directRow?.id ?? "",
      raidGold: 0,
    });
    check(
      (await silentZero) === null,
      "a claim of nothing is dropped rather than refused, because there is no captain doing anything wrong in an empty hold",
    );

    const sellerSawClaim = boardSettles(escortSeller, (board) =>
      board.some((c) => c.id === directRow?.id && c.status === "claimed"),
    );
    const thirdSawClaim = boardSettles(escortForeigner, (board) =>
      board.some((c) => c.id === directRow?.id && c.status === "claimed"),
    );
    socketOf(escortBuyer).emit("contract:claim", {
      roomId: escortRoomId,
      contractId: directRow?.id ?? "",
      raidGold: 250,
    });
    const claimedForSeller = ((await sellerSawClaim)?.contracts ?? []).find(
      (c) => c.id === directRow?.id,
    );
    const claimedForThird = ((await thirdSawClaim)?.contracts ?? []).find(
      (c) => c.id === directRow?.id,
    );
    check(
      claimedForSeller?.raidGold === 250,
      "the covered captain reports the raid once, and the seller reads the Gold it would have taken, because that figure turns into a bill on exactly one captain's ledger",
    );
    check(
      claimedForThird?.status === "claimed" &&
        claimedForThird?.raidGold === undefined &&
        claimedForThird?.buyerName !== null,
      "and the rest of the table reads that the cover was spent without reading what it cost, which is a filtering rule rather than a field the wire leaves out",
    );

    const doubleClaim = await refusedFrom(escortBuyer, "contract:claim", {
      contractId: directRow?.id ?? "",
      raidGold: 250,
    });
    check(
      doubleClaim !== null && doubleClaim.includes("no agreed contract"),
      "and a second claim against the same cover is refused, so one raid cannot be billed to the guns twice",
    );

    // The leg moves on. Everything on the board was sold for the leg that
    // just ended, so the sweep is what takes the whole of it away.
    reportSeat(escortSeller, 2, "parley");
    await settle();
    check(
      boardOf(escortSeller).length === 0 &&
        boardOf(escortBuyer).length === 0 &&
        boardOf(escortForeigner).length === 0,
      "the leg a contract was sold for is the leg it lives, and the move to the next one takes the whole board off every captain's screen",
    );
    const lateClaim = await refusedFrom(escortBuyer, "contract:claim", {
      contractId: directRow?.id ?? "",
      raidGold: 250,
    });
    check(
      lateClaim !== null,
      "and a claim a leg late is refused rather than applied to a contract the board no longer remembers",
    );

    const reopenedBoard = boardSettles(escortForeigner, (board) =>
      board.some(
        (c) => c.sellerUserId === escortSeller.id && c.status === "offered",
      ),
    );
    socketOf(escortSeller).emit("contract:post", {
      roomId: escortRoomId,
      fee: 30,
    });
    const reopenedRow = ((await reopenedBoard)?.contracts ?? []).find(
      (c) => c.sellerUserId === escortSeller.id,
    );
    check(
      reopenedRow?.round === 2 && reopenedRow?.fee === 30,
      "and the market opens again on the new leg, which is what makes the plan's count of contracts per leg a count rather than a ceiling on the voyage",
    );

    // The house rule, over the copy this feature added: the sentences a
    // captain reads here are the contract's own, and the files that carry
    // them are held whole, comments included.
    check(
      !carriesADash("src/lib/game/engine/contracts.ts") &&
        !carriesADash("src/lib/use-escort-contracts.ts") &&
        !carriesADash("src/components/portmasters/game/EscortContracts.tsx") &&
        !carriesADash(
          "src/components/portmasters/game/phases/Settlement.tsx",
        ) &&
        !carriesADash("src/server/realtime/contracts.ts") &&
        !carriesADash("src/lib/game/convoy.ts"),
      "every file the escort contract's copy lives in reads free of en dashes, em dashes and doubled hyphens, which is the house rule for every string a captain reads",
    );

    console.log("\nLoom: the refit");

    // ---- The bench, on a captain's own machine ----
    //
    // The wardrobe is switched on for the whole block, because the bench
    // stands on it (see refitsOn), and the bench's own switch is switched on
    // for everything but the checks that are about that switch. A run that
    // left either one at whatever the environment happened to say would make
    // the checks below pass for the wrong reason.
    withEnv("NEXT_PUBLIC_GARMENTS", "1", () => {
      check(
        [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
          withEnv("NEXT_PUBLIC_REFITS", value, switchFor(GAMBIT, refitsOn)),
        ) &&
          ["off", "0", "OFF", " off ", "Off"].every(
            (value) =>
              !withEnv(
                "NEXT_PUBLIC_REFITS",
                value,
                switchFor(GAMBIT, refitsOn),
              ),
          ),
        "the Loom's bench is on for every value of its own switch except the word off and the digit zero, which is the policy every switch in this tree is read through",
      );
      check(
        !withEnv("NEXT_PUBLIC_GARMENTS", "off", () =>
          withEnv("NEXT_PUBLIC_REFITS", "1", switchFor(GAMBIT, refitsOn)),
        ),
        "and it stands on the wardrobe rather than beside it: a table with no clothes layer has nothing to put right, so the bench's own switch cannot open it alone",
      );

      // One voyage, in whatever shape a check below needs it, and one helper
      // that keeps the lines a refusal writes. Every function on this bench
      // answers yes or no and says why, so the checks below hold the sentence
      // as well as the answer: a captain who presses a button is owed one.
      const benchState = (over: Partial<GameState> = {}): GameState => ({
        ...voyageState({ voyageEpoch: 7 }),
        path: REFIT_SELLER_PATH,
        money: 500,
        ...over,
      });
      const attempt = (
        trade: (logs: string[]) => boolean,
      ): { ok: boolean; said: string } => {
        const logs: string[] = [];
        const ok = trade(logs);
        return { ok, said: logs[logs.length - 1] ?? "" };
      };

      withEnv("NEXT_PUBLIC_REFITS", "1", () => {
        check(
          PATH_IDS.every(
            (id) =>
              canSellRefit({ path: id, mode: GAMBIT }) ===
              (id === REFIT_SELLER_PATH),
          ) && !canSellRefit({ path: null, mode: GAMBIT }),
          "one path works the bench and no other does, so the question a captain asks before offering is answered by the path record rather than by a name written into a screen",
        );

        // The two legs this block needs, found by asking the sea rather than
        // by naming rounds that happen to be cold. The weather is drawn from
        // the voyage's own numbers (see legIsCold), so a block that listed its
        // legs would be holding its own copy of the draw and would go on
        // passing after the draw moved.
        const legAt = (round: number): GameState =>
          benchState({ currentRound: round });
        const rounds = Array.from({ length: 60 }, (_, index) => index + 1);
        const coldRound = rounds.find((round) => legIsCold(legAt(round)));
        const warmRound = rounds.find((round) => !legIsCold(legAt(round)));
        if (coldRound === undefined || warmRound === undefined) {
          // A precondition rather than a claim: a sixty leg window of one
          // fixed draw that came back all one kind would make every check
          // below a statement about a weather system this voyage does not
          // have, and the checks are about the pile rather than the sea.
          throw new Error("This voyage's weather carried no leg of one kind.");
        }
        const coldLeg = legAt(coldRound);
        const warmLeg = legAt(warmRound);
        const pile = ragsAtPort(coldLeg);
        check(
          pile >= 1 &&
            pile <= RAGS_AT_PORT_COLD &&
            ragsLeftAtPort(coldLeg) === pile &&
            ragsAtPort(warmLeg) === 0 &&
            ragsLeftAtPort(warmLeg) === 0,
          "the harbor's pile fills on a cold leg, inside the bound the constants carry, and there is no pile at all after a fair one, which is the plan's tension written as a number: a Loom is poor in fair weather and busy in cold",
        );
        check(
          ragsAtPort(legAt(coldRound)) === pile &&
            ragsAtPort(benchState({ currentRound: coldRound, path: null })) ===
              pile,
          "and the pile is drawn from the voyage's own numbers rather than from the captain reading it, so two Loom captains at one table each take their own share of the same pile, and a reload answers the way it answered before",
        );
        check(
          ragsLeftAtPort({
            ...coldLeg,
            ragsRound: coldRound,
            ragsTaken: pile,
          }) === 0 &&
            ragsLeftAtPort({
              ...coldLeg,
              ragsRound: coldRound - 1,
              ragsTaken: pile + 4,
            }) === pile &&
            ragsLeftAtPort({
              ...coldLeg,
              ragsRound: coldRound,
              ragsTaken: pile + 4,
            }) === 0,
          "the share counts down as it is taken and floors at nothing, and a count stamped with an earlier leg is not subtracted from this one's, which is what lets a save written mid leg be read at the next Dawn without a heal",
        );

        const noPath = attempt((logs) =>
          buyRag(benchState({ currentRound: coldRound, path: null }), logs),
        );
        check(
          noPath.ok === false && noPath.said.includes("Only a Loom captain"),
          "only a Loom captain buys rags off the harbor pile, and the refusal is a sentence rather than a silent false, because the exclusivity the plan asks for is this line rather than a greyed out button",
        );
        const spent = benchState({
          currentRound: coldRound,
          ragsRound: coldRound,
          ragsTaken: pile,
        });
        const spentTry = attempt((logs) => buyRag(spent, logs));
        check(
          spentTry.ok === false &&
            spentTry.said.includes("no rags left") &&
            spent.money === 500 &&
            (spent.inventory[RAGS] ?? 0) === 0,
          "and a captain whose share of the pile is spent is refused with the Gold still in the purse and the rag still on the quay",
        );
        const shortPurse = benchState({
          currentRound: coldRound,
          money: RAG_SCRAP_VALUE - 1,
        });
        const shortTry = attempt((logs) => buyRag(shortPurse, logs));
        check(
          shortTry.ok === false &&
            shortTry.said.includes(String(RAG_SCRAP_VALUE)) &&
            shortPurse.money === RAG_SCRAP_VALUE - 1,
          "and a purse that cannot cover the scrap is refused with the price named in the sentence, rather than being drained into a negative hold",
        );
        // The hold's own room, which is two switches of its own rather than
        // this bench's (see holdCapacityOn). Named here so the check cannot
        // pass on a build whose hold is unbounded.
        withEnv("NEXT_PUBLIC_SURVIVAL", "1", () =>
          withEnv("NEXT_PUBLIC_SPLIT_HOLD", "1", () => {
            const fullHold = benchState({ currentRound: coldRound });
            fullHold.inventory = { Hemp: cargoCapacity(fullHold) };
            const fullTry = attempt((logs) => buyRag(fullHold, logs));
            check(
              cargoRoom(fullHold) === 0 &&
                fullTry.ok === false &&
                fullTry.said.includes("no room") &&
                (fullHold.inventory[RAGS] ?? 0) === 0,
              "and a hold with no room left is refused in words, because a rag takes a slot in exactly the way a bolt of silk does: the bench reads the one capacity reader rather than working the room out for itself",
            );
          }),
        );
        const loom = benchState({ currentRound: coldRound });
        const bought = attempt((logs) => buyRag(loom, logs));
        check(
          bought.ok &&
            loom.money === 500 - RAG_SCRAP_VALUE &&
            loom.inventory[RAGS] === 1 &&
            loom.ragsBought === 1 &&
            loom.ragsTaken === 1 &&
            loom.ragsRound === coldRound &&
            bought.said.includes(`${pile - 1} left`),
          "the purchase takes the scrap out of the purse, puts one rag in the hold and stamps the leg it was taken in, and the line it writes is the count the captain has left rather than the count the harbor started with",
        );
        const drained = benchState({ currentRound: coldRound });
        drained.inventory = {};
        let taken = 0;
        while (buyRag(drained, [])) taken += 1;
        check(
          taken === pile &&
            ragsLeftAtPort(drained) === 0 &&
            (drained.inventory[RAGS] ?? 0) === pile &&
            drained.money === 500 - pile * RAG_SCRAP_VALUE,
          "and one captain can take the whole share and not a rag more, one at a time, which is the count the plan bounds the reweave with: three rags at the quay is one coat and a spare rather than an industry",
        );

        const tooFew = benchState({
          currentRound: coldRound,
          inventory: { [RAGS]: REWEAVE_RAGS - 1 },
        });
        const fewTry = attempt((logs) => reweaveRags(tooFew, logs));
        check(
          fewTry.ok === false &&
            fewTry.said.includes(String(REWEAVE_RAGS)) &&
            (tooFew.inventory[REWEAVE_GOOD] ?? 0) === 0,
          "a reweave takes the two rags the constants name and is refused when the hold has fewer, with the count in the sentence rather than the hold quietly losing what it had",
        );
        const strangerWeave = benchState({
          path: null,
          inventory: { [RAGS]: REWEAVE_RAGS },
        });
        const strangerWove = attempt((logs) =>
          reweaveRags(strangerWeave, logs),
        );
        check(
          strangerWove.ok === false &&
            strangerWove.said.includes("Only a Loom captain") &&
            (strangerWeave.inventory[RAGS] ?? 0) === REWEAVE_RAGS,
          "and nobody but the path that holds the chain works rags back into cloth, which is what makes the pile worth buying in the first place",
        );
        const weaver = benchState({
          currentRound: coldRound,
          inventory: { [RAGS]: REWEAVE_RAGS },
        });
        const wove = attempt((logs) => reweaveRags(weaver, logs));
        check(
          wove.ok &&
            (weaver.inventory[RAGS] ?? 0) === 0 &&
            (weaver.inventory[REWEAVE_GOOD] ?? 0) === 1 &&
            weaver.ragsRewoven === 1 &&
            wove.said.includes(REWEAVE_GOOD),
          "a reweave spends the rags and returns one coat, which is the weaver's recipe read from the other end: what the path is paid for is the shortcut rather than a cheaper garment",
        );
        // The tie the constants state and this check holds: the chain the
        // Loom holds is the recipe's own, minus the worker and the hemp, so a
        // recipe retuned to three materials fails here rather than quietly
        // moving the price of the chain with it.
        const recipeMaterials = Object.values(
          RECIPES[REWEAVE_GOOD].materials,
        ).reduce((total, count) => total + count, 0);
        check(
          REWEAVE_RAGS === recipeMaterials,
          "and the rags it takes are the materials the recipe it replaces takes, which is the one place the two numbers are held together",
        );

        // The port mend: what every captain can do alone, and the price a
        // refit is measured against.
        const worn = garmentSpec(REWEAVE_GOOD);
        if (!worn) {
          throw new Error("The catalogue carries no garment to mend.");
        }
        const wearing = (durability: number, money = 500): GameState =>
          benchState({
            currentRound: coldRound,
            money,
            garments: [{ good: REWEAVE_GOOD, durability }],
          });
        const notAGood = attempt((logs) =>
          mendGarment(benchState({ currentRound: coldRound }), "Sails", logs),
        );
        check(
          notAGood.ok === false &&
            notAGood.said.includes("not something the harbor can put right"),
          "the harbor tailors refuse a good that is not a garment before they read anything else, because what they are asked to put right comes from the wardrobe table rather than from the request",
        );
        const nothingWorn = attempt((logs) =>
          mendGarment(
            benchState({ currentRound: coldRound }),
            REWEAVE_GOOD,
            logs,
          ),
        );
        check(
          nothingWorn.ok === false && nothingWorn.said.includes("no worn"),
          "and a crew wearing none of that good has nothing for the tailors to work on, so the button is refused where it is charged rather than only where it is drawn",
        );
        const mender = wearing(worn.durability - 2, MEND_GOLD_PER_POINT);
        const mended = attempt((logs) =>
          mendGarment(mender, REWEAVE_GOOD, logs),
        );
        check(
          mended.ok &&
            mender.garments[0]?.durability === worn.durability - 1 &&
            mender.money === 0 &&
            mender.mendsMade === 1 &&
            mender.mendRound === coldRound &&
            mended.said.includes(String(MEND_GOLD_PER_POINT)),
          "the harbor tailors put one point back for the five Gold the constants carry and stamp the leg they worked in rather than clearing a flag, which is what lets a save written mid leg be read at the next Dawn without a heal",
        );
        const twice = attempt((logs) =>
          mendGarment(mender, REWEAVE_GOOD, logs),
        );
        check(
          twice.ok === false && twice.said.includes("already worked"),
          "and a second mend in the same leg is refused rather than sold, so the once a leg rule belongs to the engine and not to the panel that draws the button",
        );
        const whole = wearing(worn.durability);
        const wholeTry = attempt((logs) =>
          mendGarment(whole, REWEAVE_GOOD, logs),
        );
        check(
          wholeTry.ok === false &&
            wholeTry.said.includes("no worn") &&
            whole.money === 500 &&
            whole.garments[0]?.durability === worn.durability,
          "and a mend on a garment already whole is refused rather than sold, because the tailors are paid for the work that happened and there was none to do",
        );
        const thinPurse = wearing(worn.durability - 2, MEND_GOLD_PER_POINT - 1);
        const thinTry = attempt((logs) =>
          mendGarment(thinPurse, REWEAVE_GOOD, logs),
        );
        check(
          thinTry.ok === false &&
            thinTry.said.includes("purse is short") &&
            thinPurse.garments[0]?.durability === worn.durability - 2,
          "and a purse that cannot cover the mend is refused with the garment left exactly as it was, so nothing is ever half paid for",
        );

        check(
          refitRoomFor(wearing(worn.durability - 1), REWEAVE_GOOD) === 1 &&
            refitRoomFor(wearing(1), REWEAVE_GOOD) === REFIT_POINTS &&
            refitRoomFor(
              wearing(worn.durability - (REFIT_POINTS + 1)),
              REWEAVE_GOOD,
            ) === REFIT_POINTS &&
            refitRoomFor(wearing(worn.durability), REWEAVE_GOOD) === 0 &&
            refitRoomFor(benchState(), REWEAVE_GOOD) === 0 &&
            refitRoomFor(benchState(), "Sails") === 0,
          "a refit is worth the three points the constants carry, cut down to whatever the garment's own maximum leaves room for: a coat that has lost one point is a one point refit, and a coat already whole is not a refit at all",
        );

        // One refit, in whatever shape a check below needs it. The phase is
        // the one field no check here varies: every row on this bench was
        // posted at the Market, which is where the board is drawn.
        const refitOn = (
          over: Partial<Omit<RefitContract, "phase">>,
        ): RefitContract => ({
          id: "r1",
          sellerUserId: "loom",
          sellerName: "Smoke Loom",
          buyerUserId: "customer",
          buyerName: "Smoke Customer",
          fee: 30,
          round: 3,
          phase: "market",
          status: "offered",
          good: REWEAVE_GOOD,
          ...over,
        });
        check(
          refitSellerBusy([refitOn({ status: "agreed" })], "loom", 3) &&
            !refitSellerBusy([refitOn({})], "loom", 3) &&
            !refitSellerBusy([refitOn({ status: "agreed" })], "loom", 4) &&
            !refitSellerBusy([refitOn({ status: "agreed" })], "customer", 3),
          "the bench bounds the seller rather than the customer: a refit that was actually taken makes the Loom busy for that leg, an offer nobody took does not, the next leg frees the hands again, and the customer who bought the work is not the party this market runs out of hands",
        );
        check(
          expireConsent([refitOn({})], { phase: "orders", round: 3 }).length ===
            0 &&
            expireConsent([refitOn({})], { phase: "market", round: 3 })
              .length === 1 &&
            expireConsent([refitOn({ status: "agreed" })], {
              phase: "orders",
              round: 3,
            }).length === 1 &&
            expireConsent([refitOn({ status: "agreed" })], {
              phase: "market",
              round: 4,
            }).length === 0,
          "an offer nobody took dies with the Market it was posted in, while a refit the two captains agreed survives the rest of the leg and dies with it, which is the same expiry the escort contract lives under because it is the same primitive",
        );

        // What a refit does to two purses, which is the whole of the trade.
        const agreedRefit = refitOn({ id: "r2", status: "agreed" });
        const seller = benchState({ currentRound: 3 });
        const customer = benchState({
          currentRound: 3,
          garments: [{ good: REWEAVE_GOOD, durability: 2 }],
        });
        const sellerLogs: string[] = [];
        const customerLogs: string[] = [];
        check(
          applyRefitSide(seller, agreedRefit, "loom", sellerLogs) &&
            applyRefitSide(customer, agreedRefit, "customer", customerLogs) &&
            seller.money === 530 &&
            customer.money === 470 &&
            customer.garments[0]?.durability === 2 + REFIT_POINTS &&
            seller.refitsSold === 1 &&
            seller.refitFeesEarned === 30 &&
            customer.refitsBought === 1 &&
            customer.refitFeesPaid === 30,
          "one function settles both sides of a refit: the customer pays the fee the two of them agreed and their own garment takes the points back on their own machine, the seller is paid it, and neither captain's state is ever written by the other's machine",
        );
        check(
          !applyRefitSide(customer, agreedRefit, "customer", []) &&
            !applyRefitSide(seller, agreedRefit, "loom", []) &&
            customer.money === 470 &&
            seller.money === 530,
          "and applying the same side twice moves nothing the second time, because the ledger is what keeps a reload between the agreement and the broadcast that carries it from charging the same fee twice",
        );
        const bystander = benchState({ currentRound: 3 });
        check(
          !applyRefitSide(bystander, agreedRefit, "other", []) &&
            bystander.money === 500 &&
            bystander.refitsSold === 0,
          "and a captain who is neither side of the agreement is not moved by it, which is the whole of what the two names on the row are for",
        );
        const broke = benchState({
          currentRound: 3,
          money: 5,
          garments: [{ good: REWEAVE_GOOD, durability: 2 }],
        });
        const brokeLogs: string[] = [];
        check(
          applyRefitSide(broke, agreedRefit, "customer", brokeLogs) &&
            broke.money === 0 &&
            broke.refitFeesPaid === 5 &&
            broke.garments[0]?.durability === 2 + REFIT_POINTS &&
            brokeLogs.some((line) => line.includes("paid 5 Gold")),
          "a purse that moved between the accept and the settlement pays what it has rather than a negative hold, and the work still happens, because the price was agreed in the open and the purse is the customer's own business",
        );
        const bare = benchState({ currentRound: 3 });
        const bareLogs: string[] = [];
        check(
          applyRefitSide(bare, agreedRefit, "customer", bareLogs) &&
            bareLogs.some((line) => line.includes("no worn")),
          "and a customer whose wardrobe lost the garment between the accept and the settlement reads a sentence saying so, which is the line for a state that moved underneath an agreement rather than for an ordinary leg",
        );
        const dark = benchState({ currentRound: 3 });
        check(
          !withEnv("NEXT_PUBLIC_REFITS", "off", () =>
            applyRefitSide(dark, agreedRefit, "customer", []),
          ) && dark.money === 500,
          "and an agreement settled with the bench switched off moves nobody, which is the plan's rollback read at the one place a refit would have changed a state",
        );

        // The load site, where every field this build added is healed.
        const ancient = voyageState();
        const stripped = ancient as unknown as Record<string, unknown>;
        for (const field of [
          "refitsSold",
          "refitsBought",
          "refitFeesEarned",
          "refitFeesPaid",
          "mendsMade",
          "mendRound",
          "ragsBought",
          "ragsRewoven",
          "ragsTaken",
          "ragsRound",
        ]) {
          stripped[field] = undefined;
        }
        normalizeRefitState(ancient);
        check(
          ancient.refitsSold === 0 &&
            ancient.refitFeesPaid === 0 &&
            ancient.mendsMade === 0 &&
            ancient.ragsRewoven === 0 &&
            ancient.mendRound === 0 &&
            ancient.ragsRound === 0,
          "a save written before this feature reads as a captain who has never mended anything, bought a rag or sold a refit, and both stamps heal to a leg no voyage has rather than to one that reads as already spent",
        );
        const wounded = voyageState();
        wounded.refitsSold = -3;
        wounded.refitFeesEarned = Number.NaN;
        wounded.mendsMade = 2.7;
        wounded.ragsBought = Number.POSITIVE_INFINITY;
        wounded.ragsTaken = -1;
        wounded.mendRound = 2.7;
        wounded.ragsRound = -4;
        normalizeRefitState(wounded);
        const carried = JSON.parse(JSON.stringify(wounded)) as GameState;
        check(
          wounded.refitsSold === 0 &&
            wounded.refitFeesEarned === 0 &&
            wounded.mendsMade === 2 &&
            wounded.ragsBought === 0 &&
            wounded.ragsTaken === 0 &&
            wounded.mendRound === 2 &&
            wounded.ragsRound === 0 &&
            carried.mendsMade === 2 &&
            carried.mendRound === 2,
          "and a save carrying the fields in shapes the engine would not survive is healed to the same reading, floored to whole counts with anything that is not a number read as none, and it round trips through a save with the same meaning on the far side",
        );
      });

      // The bench from the other side of its own switch. The plan's rollback
      // is to remove the Refit action and leave the consent primitive in
      // place for later use, so every reader this feature added answers
      // nothing at all rather than half of it answering. Which leg this state
      // stands in does not matter: the pile is not drawn at all with the
      // bench switched off.
      const offLeg = benchState();
      check(
        !withEnv("NEXT_PUBLIC_REFITS", "off", () =>
          canSellRefit({ path: REFIT_SELLER_PATH, mode: GAMBIT }),
        ) &&
          withEnv("NEXT_PUBLIC_REFITS", "off", () =>
            refitRoomFor(offLeg, REWEAVE_GOOD),
          ) === 0 &&
          withEnv("NEXT_PUBLIC_REFITS", "off", () => ragsAtPort(offLeg)) ===
            0 &&
          withEnv("NEXT_PUBLIC_REFITS", "off", () => ragsLeftAtPort(offLeg)) ===
            0 &&
          !withEnv("NEXT_PUBLIC_REFITS", "off", () => buyRag(offLeg, [])) &&
          !withEnv("NEXT_PUBLIC_REFITS", "off", () =>
            reweaveRags(offLeg, []),
          ) &&
          !withEnv("NEXT_PUBLIC_REFITS", "off", () =>
            mendGarment(offLeg, REWEAVE_GOOD, []),
          ) &&
          offLeg.money === 500 &&
          (offLeg.inventory[RAGS] ?? 0) === 0,
        "with the bench switched off every reader this feature added answers nothing at all, which is what makes the rollback a bench that is gone rather than one that is half running",
      );
    });

    // ---- The bench, in a real harbor ----
    //
    // Three captains at a table of their own, for the reason the market above
    // gave: the harbor this run shares is still standing at the end of this
    // section, and the checks after it read that one.
    const loomSeller = await signUp("loom_s");
    const loomBuyer = await signUp("loom_b");
    const loomForeigner = await signUp("loom_f");
    run.extraAccounts.push(loomSeller, loomBuyer, loomForeigner);

    const loomRoom = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: loomSeller.cookie,
        body: JSON.stringify({
          name: `Smoke loom ${suffix}`,
          isPublic: false,
          mode: "ocean_gambit",
          unlock: LEDGER_PHRASE,
        }),
      },
    );
    if (loomRoom.status !== 200) {
      throw new Error("No harbor to put a garment right in.");
    }
    const loomRoomId = loomRoom.body.room.id;
    const loomCrew = [loomSeller, loomBuyer, loomForeigner];
    const loomJoins = await Promise.all(
      loomCrew.slice(1).map((captain) =>
        call<{ room: { id: string } }>("/api/rooms/join", {
          method: "POST",
          cookie: captain.cookie,
          body: JSON.stringify({ code: loomRoom.body.room.code }),
        }),
      ),
    );
    check(
      loomJoins.every((join) => join.status === 200),
      "three captains can sit at a table where garments are put right",
    );

    // Each socket's newest bench, and every row that bench has ever carried.
    // The second is what makes the privacy check below a claim about what a
    // captain was told rather than about what they happened to read last.
    const loomBoards = new Map<string, RefitContract[]>();
    const loomSeen = new Map<string, Set<string>>();
    const loomSockets = new Map<string, Socket>();
    for (const captain of loomCrew) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      const seatedHere = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === loomRoomId,
      );
      socket.emit("room:join", { roomId: loomRoomId });
      await seatedHere;
      socket.on("refit:update", (payload: RefitBoard) => {
        if (payload?.roomId !== loomRoomId) return;
        loomBoards.set(captain.id, payload.refits);
        const seen = loomSeen.get(captain.id) ?? new Set<string>();
        for (const refit of payload.refits) seen.add(refit.id);
        loomSeen.set(captain.id, seen);
      });
      loomSockets.set(captain.id, socket);
    }
    const loomSocketOf = (captain: Captain): Socket => {
      const found = loomSockets.get(captain.id);
      if (!found) throw new Error(`No socket for ${captain.username}.`);
      return found;
    };
    const loomBoardOf = (captain: Captain): RefitContract[] =>
      loomBoards.get(captain.id) ?? [];
    const loomSettle = () => new Promise((resolve) => setTimeout(resolve, 500));
    // The emit and the wait are one call, for the reason the market above
    // gives: a refusal waited for after the fact is a refusal this run might
    // already have missed.
    const loomRefused = async (
      captain: Captain,
      event: string,
      frame: Record<string, unknown>,
    ): Promise<string | null> => {
      const refused = waitForEvent<{ roomId: string; error: string }>(
        loomSocketOf(captain),
        "refit:error",
        (payload) => payload?.roomId === loomRoomId && Boolean(payload.error),
      );
      loomSocketOf(captain).emit(event, { roomId: loomRoomId, ...frame });
      return (await refused)?.error ?? null;
    };
    const loomSettles = (
      captain: Captain,
      match: (board: RefitContract[]) => boolean,
    ) =>
      waitForEvent<RefitBoard>(
        loomSocketOf(captain),
        "refit:update",
        (payload) =>
          payload?.roomId === loomRoomId && match(payload?.refits ?? []),
      );

    loomSocketOf(loomSeller).emit("room:start", { roomId: loomRoomId });
    await loomSettle();

    // The bench belongs to the Market, and the departure puts the room at its
    // opening seat rather than at one, so this is posted out of season by
    // construction rather than by a clock the run has to wait on.
    const loomOffSeason = await loomRefused(loomSeller, "refit:post", {
      fee: 20,
      good: REWEAVE_GOOD,
    });
    check(
      loomOffSeason !== null &&
        loomOffSeason.includes(phaseFace("market").label),
      "a refit cannot be offered outside the Market, and the refusal names the phase that opens the bench, because a refit is offered at a port rather than at sea",
    );

    // The room's seat, moved the way this suite moves any room's seat.
    const loomSeat = (captain: Captain, round: number, phase: Phase) =>
      loomSocketOf(captain).emit("game:status", {
        roomId: loomRoomId,
        round,
        phase,
        phaseLabel: phaseFace(phase).label,
        gold: 0,
        reputation: 0,
        shipLevel: 0,
        gameOver: false,
      });
    loomSeat(loomSeller, 1, "market");
    await loomSettle();

    const loomBadFee = await loomRefused(loomSeller, "refit:post", {
      fee: CONSENT_FEE_MAX + 1,
      good: REWEAVE_GOOD,
    });
    check(
      loomBadFee !== null &&
        loomBadFee.includes(String(CONSENT_FEE_MIN)) &&
        loomBadFee.includes(String(CONSENT_FEE_MAX)),
      "a fee outside the bounds is refused by the server rather than clamped, and the refusal states both ends of the range it will take, because the form and the socket go through one reader",
    );

    const notAGarment = await loomRefused(loomSeller, "refit:post", {
      fee: 20,
      good: "Sails",
    });
    check(
      notAGarment !== null && notAGarment.includes("garment the crew can wear"),
      "and a refit naming a good nobody can wear is refused at the door, because a row no customer could take would sit on the bench for a whole leg",
    );

    const loomSelfSell = await loomRefused(loomSeller, "refit:post", {
      fee: 20,
      good: REWEAVE_GOOD,
      targetUserId: loomSeller.id,
    });
    check(
      loomSelfSell !== null,
      "and a captain cannot sell a refit to themselves",
    );

    // A real account standing somewhere else. The membership check is per
    // harbor, which is the only thing that makes aiming an offer at a captain
    // a check at all.
    if (!run.host) {
      throw new Error("No captain in another harbor to aim an offer at.");
    }
    const loomStrangerTarget = await loomRefused(loomSeller, "refit:post", {
      fee: 20,
      good: REWEAVE_GOOD,
      targetUserId: run.host.id,
    });
    check(
      loomStrangerTarget !== null,
      "and an offer cannot be addressed at a captain who is not in this harbor, whoever they are in another one",
    );

    const loomOpenPosted = loomSettles(loomForeigner, (board) =>
      board.some(
        (row) => row.sellerUserId === loomSeller.id && row.status === "offered",
      ),
    );
    loomSocketOf(loomSeller).emit("refit:post", {
      roomId: loomRoomId,
      fee: 21.7,
      good: REWEAVE_GOOD,
    });
    const loomOpenRow = ((await loomOpenPosted)?.refits ?? []).find(
      (row) => row.sellerUserId === loomSeller.id && row.status === "offered",
    );
    check(
      loomOpenRow !== undefined &&
        loomOpenRow.fee === 21 &&
        loomOpenRow.good === REWEAVE_GOOD &&
        loomOpenRow.buyerUserId === null &&
        loomOpenRow.phase === "market" &&
        loomOpenRow.round === 1,
      "an open offer lands on the whole table's bench at the fee the form meant, floored to whole Gold, naming the garment, addressed to nobody and stamped with the leg and the phase it was posted in",
    );
    check(
      loomOpenRow !== undefined && loomBoardOf(loomForeigner).length === 1,
      "and it is the only row the third captain is handed, because an offer to the room is the one every captain may take",
    );

    const loomDoubled = await loomRefused(loomSeller, "refit:post", {
      fee: 21,
      good: REWEAVE_GOOD,
    });
    check(
      loomDoubled !== null,
      "a second offer of the same shape from the same seller is refused, so one client cannot paper the bench",
    );

    const loomDirectPosted = loomSettles(loomBuyer, (board) =>
      board.some(
        (row) => row.buyerUserId === loomBuyer.id && row.status === "offered",
      ),
    );
    loomSocketOf(loomSeller).emit("refit:post", {
      roomId: loomRoomId,
      fee: 30,
      good: REWEAVE_GOOD,
      targetUserId: loomBuyer.id,
    });
    const loomDirectRow = ((await loomDirectPosted)?.refits ?? []).find(
      (row) => row.buyerUserId === loomBuyer.id && row.status === "offered",
    );
    check(
      loomDirectRow !== undefined && loomDirectRow.fee === 30,
      "a direct offer lands for the captain it names, at the price that was asked",
    );
    await loomSettle();
    check(
      loomDirectRow !== undefined &&
        loomSeen.get(loomBuyer.id)?.has(loomDirectRow.id) === true &&
        loomSeen.get(loomForeigner.id)?.has(loomDirectRow.id) === false,
      "and no bench the third captain was ever handed carried it, which is the privacy a targeted trade is worth",
    );

    // Asked at a quiet moment, so the next bench this captain is handed is
    // the answer to the question rather than a broadcast that overtook it.
    const askedForBench = waitForEvent<RefitBoard>(
      loomSocketOf(loomForeigner),
      "refit:update",
      (payload) => payload?.roomId === loomRoomId,
    );
    loomSocketOf(loomForeigner).emit("refit:state:request", {
      roomId: loomRoomId,
    });
    const answeredBench = (await askedForBench)?.refits ?? [];
    check(
      loomOpenRow !== undefined &&
        answeredBench.length === 1 &&
        answeredBench[0]?.id === loomOpenRow.id,
      "a captain who asks for the bench is handed the same bench the room broadcast, personalised by the same rules, so the row addressed to somebody else is absent from the answer as well",
    );

    const loomTakenByThird = await loomRefused(loomForeigner, "refit:accept", {
      contractId: loomDirectRow?.id ?? "",
    });
    check(
      loomTakenByThird !== null &&
        loomTakenByThird.includes("addressed to another"),
      "an offer addressed to one captain cannot be taken by another, even though the bench never showed it to them",
    );
    const loomSoldBySeller = await loomRefused(loomSeller, "refit:accept", {
      contractId: loomOpenRow?.id ?? "",
    });
    check(
      loomSoldBySeller !== null,
      "and the captain selling the work is not the captain who takes it",
    );

    const loomAgreedBoard = loomSettles(loomSeller, (board) =>
      board.some(
        (row) => row.id === loomDirectRow?.id && row.status === "agreed",
      ),
    );
    loomSocketOf(loomBuyer).emit("refit:accept", {
      roomId: loomRoomId,
      contractId: loomDirectRow?.id ?? "",
    });
    const loomAgreedRow = ((await loomAgreedBoard)?.refits ?? []).find(
      (row) => row.id === loomDirectRow?.id,
    );
    // The name the row wears is the one the account is registered under, read
    // from the row the server itself read it from rather than typed here, so
    // the check cannot pass on a name this file made up.
    const loomAccount = await db.user.findUnique({
      where: { id: loomBuyer.id },
      select: { displayName: true },
    });
    check(
      loomAgreedRow?.status === "agreed" &&
        loomAgreedRow.buyerUserId === loomBuyer.id &&
        loomAgreedRow.buyerName === loomAccount?.displayName,
      "a captain takes the work by taking the offer, and the row that was an ask is now an agreement with their own name written on it",
    );

    const handsFull = await loomRefused(loomBuyer, "refit:accept", {
      contractId: loomOpenRow?.id ?? "",
    });
    check(
      handsFull !== null && handsFull.includes("already taken on a refit"),
      "and a Loom captain whose hands are full is refused a second customer, because one pair of hands works one garment and a leg is how long they have",
    );

    const loomWithdrawRefused = await loomRefused(loomSeller, "refit:cancel", {
      contractId: loomDirectRow?.id ?? "",
    });
    check(
      loomWithdrawRefused !== null,
      "an agreement the two captains made cannot be withdrawn by the seller, so the one captain who regrets a price is left with the gap rather than with a button",
    );

    const loomCancelledBoard = loomSettles(loomForeigner, (board) =>
      board.every((row) => row.id !== loomOpenRow?.id),
    );
    loomSocketOf(loomSeller).emit("refit:cancel", {
      roomId: loomRoomId,
      contractId: loomOpenRow?.id ?? "",
    });
    check(
      (await loomCancelledBoard) !== null,
      "while an offer nobody has taken is the seller's own to take back",
    );

    // A captain who is not the seller of a row has no button for it, and the
    // silence is the answer rather than an error: reading a row that is
    // somebody else's is not a mistake anybody has made.
    const silentForeign = waitForEvent<{ roomId: string; error: string }>(
      loomSocketOf(loomForeigner),
      "refit:error",
      (payload) => Boolean(payload?.error),
      900,
    );
    loomSocketOf(loomForeigner).emit("refit:cancel", {
      roomId: loomRoomId,
      contractId: loomDirectRow?.id ?? "",
    });
    check(
      (await silentForeign) === null,
      "and a captain who is not the seller of a row cannot take it back, which the server answers with silence rather than with an error",
    );

    // The room's log, which is the other place the trade is written down.
    const loomLog = waitForEvent<{
      roomId: string;
      entries: VoyageLogEntry[];
    }>(
      loomSocketOf(loomForeigner),
      "voyage:log:history",
      (payload) => payload?.roomId === loomRoomId,
    );
    loomSocketOf(loomForeigner).emit("voyage:log:request", {
      roomId: loomRoomId,
    });
    const loomLines = ((await loomLog)?.entries ?? []).map(
      (entry) => entry.text,
    );
    // The two lines are built from the rows the server itself broadcast, so
    // the check is a claim about the bench and the log agreeing rather than
    // about this file's copy of a sentence.
    const loomPostedLine = voyageLogLine({
      kind: "refit_posted",
      captain: loomOpenRow?.sellerName ?? "",
      good: loomOpenRow?.good ?? "",
      fee: loomOpenRow?.fee ?? 0,
    });
    const loomAgreedLine = voyageLogLine({
      kind: "refit_agreed",
      captain: loomAgreedRow?.sellerName ?? "",
      taker: loomAgreedRow?.buyerName ?? "",
      good: loomAgreedRow?.good ?? "",
      fee: loomAgreedRow?.fee ?? 0,
    });
    check(
      loomOpenRow !== undefined &&
        loomAgreedRow !== undefined &&
        loomLines.includes(loomPostedLine) &&
        loomLines.includes(loomAgreedLine),
      "the room's log carries the trade as the bench wrote it, the offer and the agreement, with the price and the garment on both lines and the taker named on the second",
    );

    // The leg moves on. Everything on the bench was sold for the leg that
    // just ended, so the sweep is what takes the whole of it away.
    loomSeat(loomSeller, 2, "market");
    await loomSettle();
    check(
      loomBoardOf(loomSeller).length === 0 &&
        loomBoardOf(loomBuyer).length === 0 &&
        loomBoardOf(loomForeigner).length === 0,
      "the leg a refit was sold for is the leg it lives, and the move to the next one takes the whole bench off every captain's screen",
    );

    const loomReopenedBench = loomSettles(loomForeigner, (board) =>
      board.some(
        (row) => row.sellerUserId === loomSeller.id && row.status === "offered",
      ),
    );
    loomSocketOf(loomSeller).emit("refit:post", {
      roomId: loomRoomId,
      fee: 12,
      good: REWEAVE_GOOD,
    });
    const loomReopenedRow = ((await loomReopenedBench)?.refits ?? []).find(
      (row) => row.sellerUserId === loomSeller.id,
    );
    check(
      loomReopenedRow?.round === 2 && loomReopenedRow?.fee === 12,
      "and the bench opens again on the new leg, which is what makes the one refit a leg a bound the voyage reads a leg at a time rather than a ceiling on the trade",
    );

    // The house rule, over the copy this feature added: the sentences a
    // captain reads at the bench are the bench's own, and the files that
    // carry them are held whole, comments included.
    check(
      !carriesADash("src/lib/game/engine/refits.ts") &&
        !carriesADash("src/lib/game/engine/consent.ts") &&
        !carriesADash("src/lib/use-refit-contracts.ts") &&
        !carriesADash("src/lib/use-consent-board.ts") &&
        !carriesADash("src/components/portmasters/game/RefitBench.tsx") &&
        !carriesADash("src/server/realtime/refits.ts") &&
        !carriesADash("src/server/realtime/consent.ts"),
      "every file the refit's copy lives in reads free of en dashes, em dashes and doubled hyphens, which is the house rule for every string a captain reads",
    );

    // =====================================================================
    console.log("\nAroma: the bazaar rumor");

    // ---- The board, on a captain's own machine ----
    //
    // The switch is switched on for the whole block, the same way the
    // bench's is, so every check below that is not about the switch is
    // about the rule rather than about whatever the environment happened
    // to say. Nothing in this feature moves Gold or goods, so unlike the
    // two consent markets above there is no settlement to check and no
    // ledger to heal: what a rumor does to a voyage is lean a price, and
    // the market at the end of this half is where that is measured.
    withEnv("NEXT_PUBLIC_BAZAAR", "1", () => {
      check(
        [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
          withEnv(
            "NEXT_PUBLIC_BAZAAR",
            value,
            switchFor(GAMBIT, bazaarRumorsOn),
          ),
        ) &&
          ["off", "0", "OFF", " off ", "Off"].every(
            (value) =>
              !withEnv(
                "NEXT_PUBLIC_BAZAAR",
                value,
                switchFor(GAMBIT, bazaarRumorsOn),
              ),
          ),
        "the bazaar is on for every value of its own switch except the word off and the digit zero, which is the policy every switch in this tree is read through",
      );
      check(
        PATH_IDS.every(
          (id) =>
            canPublishRumor({ path: id, mode: GAMBIT }) ===
            (id === BAZAAR_SELLER_PATH),
        ) && !canPublishRumor({ path: null, mode: GAMBIT }),
        "one path works the bazaar and no other does, so the question a captain asks before speaking is answered by the path record rather than by a name written into a screen",
      );
      check(
        !withEnv("NEXT_PUBLIC_BAZAAR", "off", () =>
          canPublishRumor({ path: BAZAAR_SELLER_PATH, mode: GAMBIT }),
        ),
        "and the switch is read before the path rather than beside it: a build with the bazaar rolled back refuses an Aroma captain as flatly as it refuses everyone else",
      );

      // The goods a rumor may name, read the way the desk and the server
      // read them: one leg ahead, against the room's own charter. Fair
      // Winds never opens a tier and Open Waters opens one at leg four,
      // which is what gives the checks below a real commodity the coming
      // market does not trade and a real commodity that unlocks on the
      // very leg a rumor would move.
      const tierOne = RESOURCES_TIER1[0] ?? "";
      const goodsAt = (difficulty: string, round: number) =>
        bazaarGoods(difficulty, round);
      check(
        goodsAt("fair_winds", 3).length > 0 &&
          goodsAt("fair_winds", 3).every((good) => good in COMMODITIES) &&
          RESOURCES_TIER0.every((good) =>
            goodsAt("fair_winds", 3).includes(good),
          ) &&
          !goodsAt("fair_winds", 9).includes(tierOne),
        "the bazaar's goods are the goods the port trades, read off the one list the market draws from and narrowed to the goods the pricing table carries, so a rumor always lands on a price rather than on nothing",
      );
      check(
        !goodsAt("open_waters", 3).includes(tierOne) &&
          goodsAt("open_waters", 4).includes(tierOne),
        "and a tier is nameable one leg before the port stocks it, because a rumor is a claim about the market the room has not reached yet: a captain can speak about a cargo before the harbor has the goods, which is the fiction the plan asks for",
      );
      check(
        rumorGoodAllowed("Hemp", "fair_winds", 3) &&
          !rumorGoodAllowed(tierOne, "fair_winds", 3) &&
          !rumorGoodAllowed(
            Object.keys(PRODUCT_PRICES)[0] ?? "",
            "fair_winds",
            3,
          ) &&
          !rumorGoodAllowed("", "fair_winds", 3) &&
          !rumorGoodAllowed(null, "fair_winds", 3) &&
          !rumorGoodAllowed(7, "fair_winds", 3),
        "and the server's check is a membership test on that same list rather than a second set of conditions, so a good the desk offers and a good the server refuses cannot come apart: a finished good is refused with the raws, because the market a rumor prices draws raw goods",
      );

      // The wait, which is the one rule in this feature a client cannot
      // carry: it is measured off the room's own rows.
      const speaker = "captain-a";
      const spoke = (rounds: number[], who = speaker) =>
        rounds.map((round) => ({ publisherUserId: who, round }));
      check(
        rumorCooldownLeft([], speaker, 5) === 0 &&
          rumorCooldownLeft(spoke([4], "captain-b"), speaker, 5) === 0,
        "a captain who has never spoken waits for nothing, and neither does a captain whose table has been busy, because the wait is measured off a captain's own rows rather than off the board",
      );
      check(
        [3, 4, 5, 6, 9]
          .map((round) => rumorCooldownLeft(spoke([3]), speaker, round))
          .join(",") === `${RUMOR_COOLDOWN_ROUNDS},2,1,0,0`,
        "the wait counts down from the leg the captain spoke in and reaches nothing on the third leg after it, where it stays rather than going negative, which is the once every three legs the plan asks for",
      );
      check(
        rumorCooldownLeft(spoke([1, 5]), speaker, 6) === 2 &&
          rumorCooldownLeft(spoke([5, 1]), speaker, 6) === 2,
        "and it is measured from the newest row rather than the oldest, in whichever order the board happens to hold them, because a captain who has spoken twice is waiting on the second time",
      );
      check(
        rumorCooldownLine(0) === "The bazaar will hear you again." &&
          rumorCooldownLine(1).includes("one more leg") &&
          rumorCooldownLine(2).includes("2 more legs") &&
          !rumorCooldownLine(1).includes("2"),
        "the wait is said in legs and in a sentence rather than as a bare number: a captain with one leg to wait is told so in words, and a captain whose wait is over is told that rather than told nothing",
      );

      // One row, as the room holds it and as three readers may see it.
      const rumorRow: BazaarRumor = {
        id: rumorId(speaker, 5),
        publisherUserId: speaker,
        publisherName: "Smoke aroma",
        good: "Silk",
        direction: 1,
        round: 5,
      };
      const rowBy = (over: Partial<BazaarRumor>): BazaarRumor => ({
        ...rumorRow,
        ...over,
      });
      const asPublisher = publicRumors([rumorRow], speaker, 5)[0];
      const asOther = publicRumors([rumorRow], "captain-b", 5)[0];
      const asLater = publicRumors([rumorRow], "captain-b", 6)[0];
      check(
        rumorStanding(rumorRow, 5) &&
          !rumorStanding(rumorRow, 6) &&
          !rumorStanding(rumorRow, 7),
        "a rumor stands in the leg it was spoken in and in no leg after it, which is the one question the whole visibility rule turns on",
      );
      check(
        asPublisher?.direction === 1 &&
          asOther?.direction === null &&
          asLater?.direction === 1 &&
          rumorRow.direction === 1,
        "the direction is stripped for every reader but its publisher while the rumor stands, and it is public the moment the market it moved is drawn, while the row the room holds keeps it either way: the fleet is handed the captain, the good and the leg rather than the lean, and the row itself is never rewritten",
      );
      check(
        asOther?.publisherName === "Smoke aroma" &&
          asOther?.good === "Silk" &&
          asOther?.round === 5 &&
          asOther?.id === rumorRow.id,
        "and the name, the good and the leg travel to everyone, because a rumor the harbor cannot attribute is not the mechanic: the fleet is meant to know who spoke and to have to guess at why",
      );
      check(
        rumorId(speaker, 5) !== rumorId(speaker, 6) &&
          rumorId(speaker, 5) !== rumorId("captain-b", 5) &&
          rumorId(speaker, 5).includes(speaker) &&
          rumorId(speaker, 5).includes("5"),
        "one captain speaks once a leg, so a row's id is its publisher and its leg together: two rows can never be handed one id, which is what the board's one writer relies on rather than checking",
      );

      // What the lean does, which is the other half of the visibility
      // rule: the row is public but the direction is what prices a market,
      // and it prices exactly one market.
      const teaRow = rowBy({
        id: rumorId("captain-b", 5),
        publisherUserId: "captain-b",
        good: "Tea",
        direction: -1,
      });
      const atSix = rumorLean([rumorRow, teaRow], 6);
      check(
        atSix.Silk === RUMOR_SHIFT_FRACTION &&
          atSix.Tea === -RUMOR_SHIFT_FRACTION &&
          Object.keys(rumorLean([rumorRow, teaRow], 5)).length === 0 &&
          Object.keys(rumorLean([rumorRow, teaRow], 7)).length === 0,
        "a rumor is priced by the very next market and by no other: the leg it was spoken in has already been drawn and the leg after next has moved on, so one row leans one price once",
      );
      check(
        rumorLean([rumorRow, rowBy({ publisherUserId: "captain-b" })], 6)
          .Silk === RUMOR_SHIFT_FRACTION &&
          Object.keys(
            rumorLean(
              [
                rumorRow,
                rowBy({ publisherUserId: "captain-b", direction: -1 }),
              ],
              6,
            ),
          ).length === 0,
        "and two captains naming one good are summed and then held to the band the Harbormaster's own hand is capped at, so the loudest the bazaar can get is the loudest one call can get, while two rumors pulling against each other cancel rather than averaging into a move nobody called",
      );
      check(
        Object.keys(
          normalizeRumorLean(
            rumorLean([rumorRow, rowBy({ publisherUserId: "captain-b" })], 6),
          ),
        ).length === 1 &&
          normalizeRumorLean(rumorLean([rumorRow, teaRow], 6)).Silk ===
            RUMOR_SHIFT_FRACTION,
        "and a lean that has been through a save is the lean that went into it, because a good the rumors left alone has one representation rather than two",
      );

      // The two shapes a row and a lean arrive in, off a wire and off a
      // save. Both are read by something that would not look wrong if they
      // were read as they came: a screen would draw a row, and the market
      // would price a card.
      const soundRow = {
        id: "captain-a:5",
        publisherUserId: "captain-a",
        publisherName: "Smoke aroma",
        good: "Silk",
        direction: 1,
        round: 5,
      };
      check(
        normalizeBazaarRumor({ ...soundRow, direction: null })?.direction ===
          null &&
          normalizeBazaarRumor({ ...soundRow, round: 5.7 })?.round === 5 &&
          normalizeBazaarRumor(null) === null &&
          normalizeBazaarRumor([]) === null &&
          normalizeBazaarRumor("Silk") === null &&
          normalizeBazaarRumor({ ...soundRow, publisherUserId: "" }) === null &&
          normalizeBazaarRumor({ ...soundRow, good: "" }) === null &&
          normalizeBazaarRumor({ ...soundRow, round: 0 }) === null &&
          normalizeBazaarRumor({ ...soundRow, round: Number.NaN }) === null &&
          normalizeBazaarRumor({ ...soundRow, direction: 0 }) === null &&
          normalizeBazaarRumor({ ...soundRow, direction: 2 }) === null &&
          normalizeBazaarRumor({ ...soundRow, direction: "higher" }) === null,
        "a row off the wire is kept only when it names a publisher, a good and a leg and its direction is a real lean or the null a standing row carries, because a row that failed to parse is not an empty row and a row the screen draws is a row the fleet believes",
      );
      const leaned = normalizeRumorLean({
        Silk: RUMOR_SHIFT_FRACTION,
        Tea: -RUMOR_SHIFT_FRACTION,
        Hemp: 0.9,
        Spices: -5,
        Pearls: 0,
        "Porcelain Clay": Number.NaN,
        Sails: "0.1",
      });
      check(
        leaned.Silk === RUMOR_SHIFT_FRACTION &&
          leaned.Tea === -RUMOR_SHIFT_FRACTION &&
          leaned.Hemp === RUMOR_SHIFT_FRACTION &&
          leaned.Spices === -RUMOR_SHIFT_FRACTION &&
          !("Pearls" in leaned) &&
          !("Porcelain Clay" in leaned) &&
          !("Sails" in leaned) &&
          Object.keys(normalizeRumorLean(null)).length === 0 &&
          Object.keys(normalizeRumorLean([RUMOR_SHIFT_FRACTION])).length === 0,
        "and a lean off a save is held to the band the constant declares with everything that is not a finite number dropped, so a save edited to lean a good by half is read as a rumor's worth and no more, which is the defensive half of the plan's own guard on how swingy a price may become",
      );

      // The two sentences, which are the ones a captain reads and the room
      // keeps.
      check(
        rumorDirectionLine({ good: "Silk", direction: 1 }).includes("Silk") &&
          rumorDirectionLine({ good: "Silk", direction: 1 }).includes(
            String(Math.round(RUMOR_SHIFT_FRACTION * 100)),
          ) &&
          rumorDirectionLine({ good: "Silk", direction: 1 }).includes(
            "higher",
          ) &&
          rumorDirectionLine({ good: "Silk", direction: -1 }).includes(
            "lower",
          ) &&
          !rumorDirectionLine({ good: "Silk", direction: -1 }).includes(
            "higher",
          ),
        "the clause a row is drawn with reads its percent off the constant the market prices with and names the way in words, so the number a captain reads and the number the market applied are one number",
      );
      const rumorLine = voyageLogLine({
        kind: "rumor_published",
        captain: "Smoke aroma",
        good: "Silk",
      });
      check(
        rumorLine.includes("Smoke aroma") &&
          rumorLine.includes("Silk") &&
          !rumorLine.includes("higher") &&
          !rumorLine.includes("lower") &&
          !rumorLine.includes("%"),
        "the room's log carries the captain and the good and never the direction, because the log is public the instant it is written and the direction is not public until the market answers the row",
      );

      // ---- The market the lean lands on ----
      //
      // One leg drawn twice from one seed for two captains who differ in
      // one thing only: what the bazaar told them. The cards have to come
      // out identical and only the named good's price may move, which is
      // also what proves a rumor is a price rather than a second market
      // nobody else can see.
      const marketCtx = {
        seedBase: "harbor-b:captain-b",
        harborId: "harbor-b",
      };
      const marketUnder = (leans: MarketLeans) => {
        const state = voyageState({ difficulty: "fair_winds" });
        applyMarketLeans(state, leans);
        snapToCheckpoint(state, marketCtx, 6, "market", []);
        return state;
      };
      const plainMarket = marketUnder({});
      const priced = (price: number, lean: number) =>
        Math.max(1, Math.round(price * (1 + lean)));
      // The good the rumor names is read off the drawn board rather than
      // named here, for the reason the Harbormaster's own block gives: a
      // tenth of a price that is already high is a price that moves, and a
      // tenth of three Gold rounds away and would leave the comparison
      // below asserting nothing.
      const drawnRaw = plainMarket.resourceCards
        .filter((card) => !card.isProductCard)
        .flatMap((card) => card.resources)
        .map((resource) => ({
          good: resource.type,
          price: resource.price ?? 0,
        }));
      const rumored = [...new Set(drawnRaw.map((raw) => raw.good))].find(
        (good) =>
          drawnRaw
            .filter((raw) => raw.good === good)
            .every(
              (raw) =>
                priced(raw.price, RUMOR_SHIFT_FRACTION) > raw.price &&
                priced(raw.price, -RUMOR_SHIFT_FRACTION) < raw.price,
            ),
      );
      if (rumored === undefined) {
        throw new Error("This leg's board carried no good a tenth moves.");
      }
      const leanedUp = marketUnder({
        bazaarLean: { [rumored]: RUMOR_SHIFT_FRACTION },
      });
      const leanedDown = marketUnder({
        bazaarLean: { [rumored]: -RUMOR_SHIFT_FRACTION },
      });
      const sameDraw = plainMarket.resourceCards.every((card, i) => {
        const other = leanedUp.resourceCards[i];
        return (
          other !== undefined &&
          other.port === card.port &&
          other.isProductCard === card.isProductCard &&
          other.resources.length === card.resources.length &&
          card.resources.every(
            (resource, j) =>
              other.resources[j].type === resource.type &&
              other.resources[j].quantity === resource.quantity,
          )
        );
      });
      check(
        plainMarket.resourceCards.length > 1 && sameDraw,
        "the same ports, the same goods and the same counts, so a rumor moves a price and never the market: the lean is the third hand on one price rather than a board of its own",
      );
      const pricedByTheRumor = (market: GameState, direction: 1 | -1) =>
        plainMarket.resourceCards.every((card, i) => {
          const under = market.resourceCards[i];
          return card.resources.every(
            (resource, j) =>
              under.resources[j].price ===
              (resource.type === rumored
                ? priced(resource.price ?? 0, direction * RUMOR_SHIFT_FRACTION)
                : resource.price),
          );
        });
      check(
        pricedByTheRumor(leanedUp, 1) && pricedByTheRumor(leanedDown, -1),
        "and every price of the good the rumor names is a tenth up or a tenth down at every port, floored at one Gold, while every other good on every card is untouched",
      );

      // The three hands at once, which is what the single rounding in the
      // pricing rewrite is for: the harbor's appetite, the Harbormaster's
      // call and the bazaar's rumor are three accounts of one price, so
      // they are one rounding rather than three. The card this is measured
      // on is found rather than named, and it is a card where rounding the
      // hands one at a time would land somewhere else, so the check is a
      // measurement rather than a coincidence.
      const hands = { pulse: PORT_SHIFT_FRACTION, rumor: RUMOR_SHIFT_FRACTION };
      const together = (price: number, nudge: number, lean: number) =>
        Math.max(1, Math.round(price * (1 + nudge) * lean));
      const apart = (price: number, nudge: number, lean: number) =>
        Math.max(
          1,
          Math.round(Math.max(1, Math.round(price * (1 + nudge))) * lean),
        );
      const leaningCard = plainMarket.resourceCards
        .filter((card) => !card.isProductCard)
        .find((card) =>
          card.resources.some(
            (resource) =>
              resource.type === rumored &&
              together(
                resource.price ?? 0,
                hands.pulse + hands.rumor,
                1 + PORT_SHIFT_FRACTION,
              ) !==
                apart(
                  resource.price ?? 0,
                  hands.pulse + hands.rumor,
                  1 + PORT_SHIFT_FRACTION,
                ),
          ),
        );
      if (leaningCard === undefined) {
        throw new Error(
          "This leg's board carried no card where the three hands disagree about rounding.",
        );
      }
      const allThree = marketUnder({
        harborPulse: { [rumored]: hands.pulse },
        portShift: { port: leaningCard.port, direction: 1 },
        bazaarLean: { [rumored]: hands.rumor },
      });
      const pricedByAllThree = plainMarket.resourceCards.every((card, i) => {
        const under = allThree.resourceCards[i];
        const atThePort = !card.isProductCard && card.port === leaningCard.port;
        return card.resources.every((resource, j) => {
          const nudge =
            resource.type === rumored ? hands.pulse + hands.rumor : 0;
          const lean = atThePort ? 1 + PORT_SHIFT_FRACTION : 1;
          return (
            under.resources[j].price ===
            together(resource.price ?? 0, nudge, lean)
          );
        });
      });
      check(
        pricedByAllThree,
        "and the three hands are one price rather than three: a card carrying the rumored good at the port under the Harbormaster's call is priced by the rounding of the whole product, and this leg's board carries a card where rounding the hands one at a time would land elsewhere, so that is the claim and not a coincidence",
      );
    });

    // ---- The bazaar, in a real harbor ----
    //
    // Three captains at a table of their own, for the reason the two blocks
    // above give: the harbor this run shares is still standing at the end
    // of this section, and the checks after it read that one.
    //
    // Fair Winds on purpose: it never opens a tier, so a real commodity the
    // coming market does not trade is nameable on this table and the
    // refusal for it is about the route rather than about a good invented
    // for the check.
    // Short labels, because a username is capped and the suffix is six
    // characters of it.
    const bazaarSeller = await signUp("baz_s");
    const bazaarReader = await signUp("baz_r");
    const bazaarThird = await signUp("baz_t");
    run.extraAccounts.push(bazaarSeller, bazaarReader, bazaarThird);

    const bazaarRoom = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: bazaarSeller.cookie,
        body: JSON.stringify({
          name: `Smoke bazaar ${suffix}`,
          isPublic: false,
          difficulty: "fair_winds",
          mode: "ocean_gambit",
          unlock: LEDGER_PHRASE,
        }),
      },
    );
    if (bazaarRoom.status !== 200) {
      throw new Error("No harbor to spread a rumor in.");
    }
    const bazaarRoomId = bazaarRoom.body.room.id;
    const bazaarCrew = [bazaarSeller, bazaarReader, bazaarThird];
    const bazaarJoins = await Promise.all(
      bazaarCrew.slice(1).map((captain) =>
        call<{ room: { id: string } }>("/api/rooms/join", {
          method: "POST",
          cookie: captain.cookie,
          body: JSON.stringify({ code: bazaarRoom.body.room.code }),
        }),
      ),
    );
    check(
      bazaarJoins.every((join) => join.status === 200),
      "three captains can sit at a table where rumors are spread",
    );

    // Each socket's newest board, and every row that board has ever
    // carried, the second being what makes the checks below claims about
    // what a captain was told rather than about what they happened to read
    // last.
    const bazaarBoards = new Map<string, PublicRumor[]>();
    const bazaarSeen = new Map<string, Set<string>>();
    const bazaarSockets = new Map<string, Socket>();
    for (const captain of bazaarCrew) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      const seatedHere = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === bazaarRoomId,
      );
      socket.emit("room:join", { roomId: bazaarRoomId });
      await seatedHere;
      socket.on("bazaar:update", (payload: BazaarBoard) => {
        if (payload?.roomId !== bazaarRoomId) return;
        bazaarBoards.set(captain.id, payload.rumors);
        const seen = bazaarSeen.get(captain.id) ?? new Set<string>();
        for (const row of payload.rumors) seen.add(row.id);
        bazaarSeen.set(captain.id, seen);
      });
      bazaarSockets.set(captain.id, socket);
    }
    const bazaarSocketOf = (captain: Captain): Socket => {
      const found = bazaarSockets.get(captain.id);
      if (!found) throw new Error(`No socket for ${captain.username}.`);
      return found;
    };
    const bazaarBoardOf = (captain: Captain): PublicRumor[] =>
      bazaarBoards.get(captain.id) ?? [];
    const bazaarDirectionOf = (
      captain: Captain,
      rowId: string,
    ): RumorDirection | null | undefined =>
      bazaarBoardOf(captain).find((row) => row.id === rowId)?.direction;
    const bazaarSettle = () =>
      new Promise((resolve) => setTimeout(resolve, 500));
    // The emit and the wait are one call, for the reason the market above
    // gives: a refusal waited for after the fact is a refusal this run might
    // already have missed.
    const bazaarRefused = async (
      captain: Captain,
      event: string,
      frame: Record<string, unknown>,
    ): Promise<string | null> => {
      const refused = waitForEvent<{ roomId: string; error: string }>(
        bazaarSocketOf(captain),
        "bazaar:error",
        (payload) => payload?.roomId === bazaarRoomId && Boolean(payload.error),
      );
      bazaarSocketOf(captain).emit(event, { roomId: bazaarRoomId, ...frame });
      return (await refused)?.error ?? null;
    };
    const bazaarSpeaks = (
      captain: Captain,
      match: (board: PublicRumor[]) => boolean,
    ) =>
      waitForEvent<BazaarBoard>(
        bazaarSocketOf(captain),
        "bazaar:update",
        (payload) =>
          payload?.roomId === bazaarRoomId && match(payload?.rumors ?? []),
      );
    // The boards a claim reads beyond the one it watched a frame on.
    //
    // A board is delivered per socket rather than per room: the one pass
    // that writes a frame writes it on each captain's own connection, and
    // the order two of them land in is not the order the server wrote them.
    // So a claim that read a board which had not taken the frame in yet
    // would be testing the scheduler rather than the rule, and every board a
    // claim reads is waited for here, armed before the publish rather than
    // checked after it. A board already holding what the claim wants is not
    // waited on, which is what keeps a wait from outliving the frame it was
    // armed for and hanging a run that had nothing left to hear.
    const bazaarBoardsReach = (
      captains: Captain[],
      match: (board: PublicRumor[]) => boolean,
    ): Promise<unknown> =>
      Promise.all(
        captains
          .filter((captain) => !match(bazaarBoardOf(captain)))
          .map((captain) =>
            waitForEvent<BazaarBoard>(
              bazaarSocketOf(captain),
              "bazaar:update",
              (payload) =>
                payload?.roomId === bazaarRoomId &&
                match(payload?.rumors ?? []),
            ),
          ),
      );

    // The room's own seat, moved the way this suite moves any room's seat.
    // A checkpoint only ever moves forward, so the legs below are walked in
    // order rather than named at random.
    const bazaarRoomRow = async () =>
      db.room.findUnique({
        where: { id: bazaarRoomId },
        select: { currentRound: true, currentPhase: true },
      });
    const parkBazaar = async (round: number, phase: Phase) => {
      bazaarSocketOf(bazaarReader).emit("game:status", {
        roomId: bazaarRoomId,
        round,
        phase,
        phaseLabel: phaseFace(phase).label,
        gold: 0,
        reputation: 0,
        shipLevel: 0,
        gameOver: false,
      });
      let row = await bazaarRoomRow();
      for (
        let waited = 0;
        (row?.currentRound !== round || row?.currentPhase !== phase) &&
        waited < 5000;
        waited += 250
      ) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        row = await bazaarRoomRow();
      }
      return row;
    };
    const bazaarReadyAll = (round: number, phase: Phase) => {
      for (const captain of bazaarCrew) {
        bazaarSocketOf(captain).emit("phase:ready", {
          roomId: bazaarRoomId,
          round,
          phase,
        });
      }
    };
    const bazaarAdvanceTo = (from: number) =>
      waitForEvent<{
        roomId: string;
        round: number;
        phase: string;
        bazaarLean?: Record<string, number>;
      }>(
        bazaarSocketOf(bazaarThird),
        "phase:advance",
        (payload) =>
          payload?.roomId === bazaarRoomId && payload?.round === from,
        5000,
      );

    bazaarSocketOf(bazaarSeller).emit("room:start", { roomId: bazaarRoomId });
    await bazaarSettle();

    // The bazaar belongs to the Parley, and the departure puts the room at
    // its opening seat rather than at one, so this is refused out of season
    // by construction rather than by a clock the run has to wait on.
    const bazaarAtPort = await parkBazaar(2, "market");
    const bazaarOutOfSeason = await bazaarRefused(
      bazaarSeller,
      "bazaar:publish",
      { good: "Silk", direction: 1 },
    );
    check(
      bazaarAtPort?.currentPhase === "market" &&
        bazaarOutOfSeason !== null &&
        bazaarOutOfSeason.includes(phaseFace("parley").label),
      "a rumor cannot be spread outside the Parley, and the refusal names the phase that opens the bazaar, because a rumor is spoken where the whole table hears it and the market it moves is the one after it",
    );

    await parkBazaar(3, "parley");
    const bazaarNoLean = await bazaarRefused(bazaarSeller, "bazaar:publish", {
      good: "Silk",
      direction: 0,
    });
    const bazaarSilent = await bazaarRefused(bazaarSeller, "bazaar:publish", {
      good: "Silk",
    });
    check(
      bazaarNoLean !== null &&
        bazaarNoLean === bazaarSilent &&
        bazaarNoLean.includes("one way or the other"),
      "a rumor leaning neither way is refused before anything else is read, and a frame carrying no direction at all is refused in the same sentence, because a row the market would ignore is a lie about a lie",
    );

    const bazaarLockedGood = Object.keys(COMMODITIES).find(
      (good) => !bazaarGoods("fair_winds", 4).includes(good),
    );
    if (!bazaarLockedGood) {
      throw new Error(
        "This route traded every commodity, so nothing is out of season at this port.",
      );
    }
    const bazaarNotTraded = await bazaarRefused(
      bazaarSeller,
      "bazaar:publish",
      {
        good: bazaarLockedGood,
        direction: 1,
      },
    );
    check(
      bazaarNotTraded !== null && bazaarNotTraded.includes("does not trade"),
      "and a real commodity the coming market does not stock is refused rather than leaned onto nothing, because the list the server checks is the list that market draws from rather than the catalogue the game owns",
    );

    // The two rows this leg will price the next market with.
    const bazaarSilk = bazaarSpeaks(bazaarThird, (board) => board.length === 1);
    // The claim below reads the speaker's own board beside the frame it
    // watched, so that board is waited for too rather than read hopeful.
    const bazaarSilkEverywhere = bazaarBoardsReach(
      [bazaarSeller],
      (board) => board.length === 1,
    );
    bazaarSocketOf(bazaarSeller).emit("bazaar:publish", {
      roomId: bazaarRoomId,
      good: "Silk",
      direction: 1,
    });
    const bazaarAfterSilk = await bazaarSilk;
    await bazaarSilkEverywhere;
    check(
      bazaarAfterSilk?.rumors.length === 1 &&
        bazaarAfterSilk.rumors[0].round === 3 &&
        bazaarAfterSilk.rumors[0].publisherUserId === bazaarSeller.id &&
        bazaarAfterSilk.rumors[0].good === "Silk",
      "a captain who speaks puts a row on the board the whole harbor reads, and the row carries the leg it was spoken in and the name of the captain who spoke it",
    );
    check(
      bazaarAfterSilk?.rumors[0].direction === null &&
        bazaarDirectionOf(bazaarSeller, rumorId(bazaarSeller.id, 3)) === 1,
      "and the one fact the row is carrying is handed to its publisher alone: the captain who spoke reads their own lean back while the captain beside them reads the same row with the direction taken off",
    );

    const bazaarTea = bazaarSpeaks(bazaarThird, (board) => board.length === 2);
    // This claim reads three boards, and the frame it watched is only one of
    // them: the speaker's and the listener's are waited for beside it, or the
    // two lean readings it makes could be made against a board a moment
    // behind the frame that carried them.
    const bazaarTeaEverywhere = bazaarBoardsReach(
      [bazaarSeller, bazaarReader],
      (board) => board.length === 2,
    );
    bazaarSocketOf(bazaarReader).emit("bazaar:publish", {
      roomId: bazaarRoomId,
      good: "Tea",
      direction: -1,
    });
    const bazaarAfterTea = await bazaarTea;
    await bazaarTeaEverywhere;
    check(
      bazaarAfterTea?.rumors.length === 2 &&
        bazaarDirectionOf(bazaarThird, rumorId(bazaarSeller.id, 3)) === null &&
        bazaarDirectionOf(bazaarThird, rumorId(bazaarReader.id, 3)) === null &&
        bazaarDirectionOf(bazaarSeller, rumorId(bazaarSeller.id, 3)) === 1 &&
        bazaarDirectionOf(bazaarSeller, rumorId(bazaarReader.id, 3)) === null &&
        bazaarDirectionOf(bazaarReader, rumorId(bazaarSeller.id, 3)) === null &&
        bazaarDirectionOf(bazaarReader, rumorId(bazaarReader.id, 3)) === -1,
      "two captains can speak in one leg about two goods, and each of them reads their own row with its direction and the other captain's without: the third captain at the table, who holds no path at all, reads both rows and neither lean, which is what makes this a market rather than a private channel",
    );

    // A rumor is not a promise, so a captain who leaves the harbor does not
    // take their row with them. The two consent boards drop a departed
    // captain's rows; this one deliberately does not, because a row the
    // harbor heard is priced by the market it names whether or not the
    // captain who said it is still ashore.
    bazaarSocketOf(bazaarSeller).close();
    await bazaarSettle();
    check(
      bazaarBoardOf(bazaarThird).length === 2 &&
        bazaarSeen.get(bazaarThird.id)?.size === 2,
      "and a captain who leaves the table does not take their rumor with them, because a rumor is not a promise: dropping the row would reprice the good for everyone still sailing, which is a settlement applied halfway rather than a cleanup",
    );

    // A captain who comes back is handed the room's board, and the row they
    // own comes back to them with the lean still on it: the personalization
    // is a property of the payload rather than of the broadcast that
    // happened to be in flight when they left.
    const bazaarReload = await openAuthedSocket(bazaarSeller);
    run.sockets.push(bazaarReload);
    bazaarSockets.set(bazaarSeller.id, bazaarReload);
    const bazaarSnapshot = waitForEvent<BazaarBoard>(
      bazaarReload,
      "bazaar:update",
      (payload) => payload?.roomId === bazaarRoomId,
    );
    const bazaarSeatedAgain = waitForEvent<WireHistory>(
      bazaarReload,
      "chat:history",
      (payload) => payload?.roomId === bazaarRoomId,
    );
    bazaarReload.emit("room:join", { roomId: bazaarRoomId });
    const [bazaarOnJoin] = await Promise.all([
      bazaarSnapshot,
      bazaarSeatedAgain,
    ]);
    // A second wait is attached after the first board has landed, so the two
    // reads below are two frames rather than one frame seen twice.
    const bazaarAskedFor = waitForEvent<BazaarBoard>(
      bazaarReload,
      "bazaar:update",
      (payload) => payload?.roomId === bazaarRoomId,
    );
    bazaarReload.emit("bazaar:state:request", { roomId: bazaarRoomId });
    const bazaarOnAsk = await bazaarAskedFor;
    const readFrom = (board: BazaarBoard | null, rowId: string) =>
      (board?.rumors ?? []).find((row) => row.id === rowId)?.direction;
    check(
      readFrom(bazaarOnJoin, rumorId(bazaarSeller.id, 3)) === 1 &&
        readFrom(bazaarOnJoin, rumorId(bazaarReader.id, 3)) === null &&
        readFrom(bazaarOnAsk, rumorId(bazaarSeller.id, 3)) === 1 &&
        readFrom(bazaarOnAsk, rumorId(bazaarReader.id, 3)) === null,
      "a captain who comes back is handed the board twice, once as they take their seat and once when they ask for it, and both reads say the same thing: their own row comes back with the lean still on it and the row their tablemate spoke under comes back as nothing, because the personalization belongs to the payload rather than to the broadcast that happened to be in flight when they left",
    );

    const bazaarTooSoon = await bazaarRefused(bazaarSeller, "bazaar:publish", {
      good: "Hemp",
      direction: 1,
    });
    check(
      bazaarTooSoon !== null &&
        bazaarTooSoon === rumorCooldownLine(RUMOR_COOLDOWN_ROUNDS),
      "and a captain who has already spoken this leg is refused in the sentence the desk prints, counted off the rows the room already holds rather than off a counter a doctored client could simply not obey",
    );

    // The room's log, which is the other place the trade is written down.
    const bazaarLog = waitForEvent<{
      roomId: string;
      entries: VoyageLogEntry[];
    }>(
      bazaarSocketOf(bazaarThird),
      "voyage:log:history",
      (payload) => payload?.roomId === bazaarRoomId,
    );
    bazaarSocketOf(bazaarThird).emit("voyage:log:request", {
      roomId: bazaarRoomId,
    });
    const bazaarLines = ((await bazaarLog)?.entries ?? []).map(
      (entry) => entry.text,
    );
    // The line is built from the row the server itself broadcast, so the
    // check is a claim about the bazaar and the log agreeing rather than
    // about this file's copy of a sentence.
    const bazaarSilkRow = bazaarBoardOf(bazaarThird).find(
      (row) => row.id === rumorId(bazaarSeller.id, 3),
    );
    check(
      bazaarSilkRow !== undefined &&
        bazaarLines.includes(
          voyageLogLine({
            kind: "rumor_published",
            captain: bazaarSilkRow.publisherName,
            good: bazaarSilkRow.good,
          }),
        ),
      "the room's log carries the rumor as the bazaar wrote it, with the captain and the good and never the direction, because the log is public the instant it is written and the direction is not public until the market answers the row",
    );

    // ---- The leg the rumors land on ----
    //
    // The market of leg four is the one both rows were aimed at, and it is
    // opened by the advance out of Dawn, which is the step the server hangs
    // the lean on.
    await parkBazaar(4, "dawn");
    const bazaarReveal = bazaarAdvanceTo(4);
    // The reveal rides the same advance, so this is waited for as its own
    // frame rather than read after the fact: what the check below is about
    // is what the third captain was told, not what a board happened to hold
    // a moment later.
    const bazaarRevealed = waitForEvent<BazaarBoard>(
      bazaarSocketOf(bazaarThird),
      "bazaar:update",
      (payload) =>
        payload?.roomId === bazaarRoomId &&
        payload.rumors.some(
          (row) =>
            row.id === rumorId(bazaarReader.id, 3) && row.direction === -1,
        ),
    );
    bazaarReadyAll(4, "dawn");
    const bazaarAtTheMarket = await bazaarReveal;
    await bazaarRevealed;
    check(
      bazaarAtTheMarket?.bazaarLean?.Silk === RUMOR_SHIFT_FRACTION &&
        bazaarAtTheMarket?.bazaarLean?.Tea === -RUMOR_SHIFT_FRACTION &&
        Object.keys(bazaarAtTheMarket?.bazaarLean ?? {}).length === 2,
      "the leg four market is priced against both rumors, each good leaned by exactly the band the constant declares, and the frame carrying the lean carries no name with it: every captain draws the same market from that frame and none of them is told which captain leaned which way",
    );
    check(
      bazaarDirectionOf(bazaarThird, rumorId(bazaarSeller.id, 3)) === 1 &&
        bazaarDirectionOf(bazaarThird, rumorId(bazaarReader.id, 3)) === -1,
      "and the reveal lands with the market rather than after it: the third captain, who read two rows with no direction a moment ago, now reads both, which is the plan's false positive generator and the reason a direction is held back for exactly one leg",
    );

    await parkBazaar(4, "parley");
    const bazaarStillQuiet = await bazaarRefused(
      bazaarSeller,
      "bazaar:publish",
      {
        good: "Hemp",
        direction: 1,
      },
    );
    check(
      bazaarStillQuiet !== null && bazaarStillQuiet === rumorCooldownLine(2),
      "a captain who spoke in one leg is refused through the two legs after it and told how many are left, which is the wait the desk draws before the click rather than a refusal discovered after it",
    );

    const bazaarThirdSpeaks = bazaarSpeaks(bazaarThird, (board) =>
      board.some((row) => row.publisherUserId === bazaarThird.id),
    );
    bazaarSocketOf(bazaarThird).emit("bazaar:publish", {
      roomId: bazaarRoomId,
      good: "Hemp",
      direction: -1,
    });
    check(
      (await bazaarThirdSpeaks) !== null,
      "and the wait is a hush on one captain rather than over the table: a captain who has not spoken this voyage may speak while the captain beside them is still quiet",
    );

    // The window the whole feature is built on: the market after next is
    // priced by the rumor spoken in leg four and by neither of the two from
    // leg three, and the market after that is told that nobody spoke at all.
    await parkBazaar(5, "dawn");
    const bazaarLegFive = bazaarAdvanceTo(5);
    bazaarReadyAll(5, "dawn");
    const bazaarAtFive = await bazaarLegFive;
    check(
      bazaarAtFive?.bazaarLean?.Hemp === -RUMOR_SHIFT_FRACTION &&
        Object.keys(bazaarAtFive?.bazaarLean ?? {}).length === 1,
      "and the next market is priced by the rumor spoken in leg four alone: the two rows from leg three are not carried forward, which is the one leg window the feature is built on",
    );

    await parkBazaar(6, "dawn");
    const bazaarLegSix = bazaarAdvanceTo(6);
    bazaarReadyAll(6, "dawn");
    const bazaarAtSix = await bazaarLegSix;
    check(
      bazaarAtSix !== null &&
        "bazaarLean" in bazaarAtSix &&
        Object.keys(bazaarAtSix.bazaarLean ?? {}).length === 0,
      "and a market nobody spoke about is sent an empty lean rather than no lean at all, because a market that is never told last leg's rumor is over would price the same good twice",
    );

    // The house rule, over the copy this feature added: the sentences a
    // captain reads at the bazaar are the bazaar's own, and the files that
    // carry them are held whole, comments included.
    check(
      !carriesADash("src/lib/game/engine/bazaar.ts") &&
        !carriesADash("src/lib/use-bazaar-rumors.ts") &&
        !carriesADash("src/components/portmasters/game/BazaarRumors.tsx") &&
        !carriesADash("src/server/realtime/bazaar.ts"),
      "every file the bazaar's copy lives in reads free of en dashes, em dashes and doubled hyphens, which is the house rule for every string a captain reads",
    );

    // =====================================================================
    // [D6: Free Captain: Opportunist] The plan's clause for this feature,
    // and the whole of it: "Once per voyage, fulfill any one pathbound
    // order without joining that path, at a forty percent payout penalty."
    //
    // The checks are split the way the feature is. The allowance is
    // arithmetic and is read here without a server, because nothing in this
    // feature travels: the borrow is a permission the captain's own client
    // holds, the fill is the fill the manifest already ran, and the one
    // wire fact it adds is the counter the leg report files, which is read
    // where every leg report is read (see the telemetry spine above). The
    // board a captain meets is dealt through the engine's own lifecycle
    // rather than assembled by hand, the same way the pathbound board above
    // is dealt, so what is read here is the board a Free Captain really
    // meets in the Orders phase.
    // =====================================================================
    console.log("\nFree Captain: the borrow");

    // ---- the allowance ----
    // The two numbers the plan sets, and the payout they make. The penalty
    // is read off the constant rather than typed here, so F6's retune moves
    // this check with it.
    check(
      OPPORTUNIST_USES === 1 &&
        OPPORTUNIST_PENALTY === 0.4 &&
        opportunistPayout(100) === 60 &&
        opportunistPayout(100) === 100 - Math.round(100 * OPPORTUNIST_PENALTY),
      "a hundred Gold order pays sixty on the borrow, which is the plan's forty percent penalty read off the constant rather than typed into the rule",
    );
    // The property, over every face value a card can carry rather than over
    // one example: the payout never exceeds the face value, never goes
    // below zero, and never falls as the order grows. The first of those is
    // the one the smallest orders decide, because a deduction that floored
    // instead of rounding would leave a two Gold order paying two and the
    // penalty would stop being real exactly where the plan says the reach
    // has to cost something.
    check(
      Array.from({ length: 200 }, (_, i) => i + 1).every(
        (face, i, all) =>
          opportunistPayout(face) <= face &&
          opportunistPayout(face) >= 0 &&
          (i === 0 || opportunistPayout(face) >= opportunistPayout(all[i - 1])),
      ) &&
        opportunistPayout(2) === 1 &&
        opportunistPayout(1) === 1 &&
        opportunistPayout(0) === 0 &&
        opportunistPayout(-5) === 0,
      "and the payout is bounded by the face value at every size, so the penalty is charged on a one Gold errand as surely as on a hundred: the deduction is the number rounded and the smallest orders still pay it",
    );
    // One path works the borrow and no other does, and the switch is read
    // before the path rather than beside it: the reading every ability
    // reader in this tree takes, and the reason a rolled back build refuses
    // a Free Captain as flatly as it refuses everyone else.
    check(
      PATH_IDS.every(
        (id) =>
          opportunistMayBorrow(
            { path: id, opportunistBorrows: 0, mode: GAMBIT },
            "convoy",
          ) ===
          (id === OPPORTUNIST_PATH),
      ) &&
        !opportunistMayBorrow(
          { path: null, opportunistBorrows: 0, mode: GAMBIT },
          "convoy",
        ) &&
        !withEnv("NEXT_PUBLIC_PATH_ORDERS", "off", () =>
          opportunistMayBorrow(
            { path: OPPORTUNIST_PATH, opportunistBorrows: 0, mode: GAMBIT },
            "convoy",
          ),
        ) &&
        !opportunistMayBorrow(
          { path: OPPORTUNIST_PATH, opportunistBorrows: 0, mode: GAMBIT },
          null,
        ),
      "one path works the borrow and no other does, a card that is not locked to the captain is not this captain's to borrow, and the path orders switch is read first and separately: with the locks rolled back there is nothing to reach through and the ability is refused with them",
    );
    // The counter itself: a bound read off the constant, a spent allowance
    // that reads as none left, and a save carrying more spent than this
    // build allows reading as none left rather than as a debt.
    check(
      opportunistBorrowsLeft({ opportunistBorrows: 0 }) === OPPORTUNIST_USES &&
        opportunistBorrowsLeft({ opportunistBorrows: OPPORTUNIST_USES }) ===
          0 &&
        opportunistBorrowsLeft({ opportunistBorrows: OPPORTUNIST_USES + 5 }) ===
          0 &&
        opportunistBorrowsTaken({ opportunistBorrows: 2.7 }) === 2 &&
        opportunistBorrowsTaken({ opportunistBorrows: -4 }) === 0,
      "the allowance is a count rather than a flag, bounded by the constant F6 retunes, and a counter that claims more spent than this build allows reads as none left rather than as a debt handed back to the captain",
    );
    // The heal, and the old save it exists for: a voyage written before
    // this feature carries no counter at all, and the load site reads it
    // with the module's own reader, so the reading here is the reading the
    // board gets.
    check(
      normalizeOpportunistBorrows(undefined) === 0 &&
        normalizeOpportunistBorrows(Number.NaN) === 0 &&
        normalizeOpportunistBorrows("two") === 0 &&
        normalizeOpportunistBorrows(2.7) === 2 &&
        normalizeOpportunistBorrows(-1) === 0,
      "and a save written before the borrow existed reads as a captain who never borrowed anything, rather than as a counter that would turn the first spend into a NaN the record would carry",
    );
    // ---- where the counter lives ----
    // The plan's own clause: "The counter resets with the voyage, not with
    // the round, and it lives in the same place as the other once per
    // voyage limits." Both halves are observed rather than asserted: the
    // rest of the round is walked through the engine's own lap until the
    // books roll over, and the counter is still spent afterwards; then the
    // voyage is restarted and it is not.
    const borrowCarried = voyageState();
    borrowCarried.money = 400;
    borrowCarried.opportunistBorrows = 1;
    borrowCarried.phase = "resolve";
    borrowCarried.pirateAttackResolved = true;
    const borrowCtx = {
      seedBase: `smoke:borrow:${suffix}`,
      harborId: `smoke-borrow-${suffix}`,
    };
    // Bounded rather than a fixed count of presses: the phases a mode runs
    // between the settlement and the next round are the mode's own, so the
    // check walks whatever this build's lap is rather than a list of phase
    // names written here.
    for (let step = 0; step < 6 && borrowCarried.currentRound === 1; step++) {
      nextPhase(borrowCarried, borrowCtx, []);
    }
    check(
      borrowCarried.currentRound === 2 &&
        borrowCarried.opportunistBorrows === 1,
      "a round walked through the engine's own lap leaves the borrow spent, which is what makes it a voyage's allowance rather than a leg's",
    );
    restartGame(borrowCarried, [], {});
    check(
      borrowCarried.currentRound === 1 &&
        borrowCarried.opportunistBorrows === 0,
      "and setting sail again hands the allowance back with everything else the voyage holds, because the counter is part of the voyage's own state rather than of the account behind it",
    );

    // ---- the board, and the fill ----
    // The board a Free Captain meets, dealt through the engine's own
    // lifecycle: the tier's draw plus the paths' three, and every one of
    // the three is locked to a captain who holds none of those paths.
    const borrowBoard = (label: string): GameState => {
      const state = voyageState();
      snapToCheckpoint(
        state,
        { seedBase: `smoke:borrow-board:${label}`, harborId: "harbor-a" },
        1,
        "orders",
        [],
      );
      state.path = OPPORTUNIST_PATH;
      return state;
    };
    // The card's goods put in the hold, so the only thing standing between
    // the captain and the order is the lock.
    const stockFor = (
      state: GameState,
      card: GameState["customerCards"][number],
    ) => {
      for (const r of card.resources) state.inventory[r.type] = r.required ?? 0;
    };
    const lockedCardsOf = (state: GameState) =>
      state.customerCards.filter((card) => lockedBehind(state, card) !== null);

    withEnv("NEXT_PUBLIC_PATH_ORDERS", "1", () => {
      const board = borrowBoard("a");
      const lockedCards = lockedCardsOf(board);
      const openCards = board.customerCards.filter(
        (card) => lockedBehind(board, card) === null,
      );
      check(
        lockedCards.length === PATH_ORDER_SLOTS && openCards.length > 0,
        `a Free Captain's board carries the paths' three locked cards like everyone else's (${lockedCards.length} locked, ${openCards.length} open)`,
      );
      const lockedCard = lockedCards[0]!;
      check(
        !canFillOrder(board, lockedCard) &&
          canFillOrder(board, lockedCard, true) &&
          board.completedOrders.length === 0,
        "and the manifest refuses the locked card through its ordinary guard while the same card with the borrow asked for is the captain's to fill",
      );
      check(
        !canFillOrder({ ...board, inventory: {} }, lockedCard, true),
        "and the borrow is not a way around the hold: a captain carrying none of the goods is refused with the ability asked for as flatly as without it, because the order still has to be filled rather than unlocked",
      );

      // The fill itself, through the engine's own settlement, with the
      // freight read the way the settlement reads it so the check is about
      // the payout rather than about a freight figure typed here.
      const filled = borrowBoard("b");
      filled.money = 500;
      const card = lockedCardsOf(filled)[0]!;
      stockFor(filled, card);
      const freight = calcTransportCost(
        filled,
        card.totalItems,
        card.resources.some((r) => SILK_GOODS.includes(r.type)),
      );
      const paid = opportunistPayout(card.reward);
      const lines: string[] = [];
      completeOrder(filled, card.id, lines, true);
      check(
        filled.money === 500 + paid - freight &&
          filled.completedOrders.includes(card.id) &&
          filled.opportunistBorrows === 1 &&
          filled.path === OPPORTUNIST_PATH,
        "a borrowed order fills through the same settlement as any other, pays the reduced reward down to the coin, spends the allowance, and leaves the captain holding the path they already held: the order is filled without joining its own",
      );
      check(
        lines.includes(opportunistLine(card.reward, paid)) &&
          paid < card.reward,
        "and the ledger says what the card promised it would: the board's own sentence for the borrow, with both numbers, and a payout strictly below the face value, which is the reach the plan says has to cost something real",
      );

      // The second locked card, with the allowance spent: refused through
      // the same reader, and refused with the sentence every other captain
      // is refused with rather than with one written for this path.
      const spare = lockedCardsOf(filled).find((o) => o.id !== card.id)!;
      const spareLock = lockedBehind(filled, spare)!;
      stockFor(filled, spare);
      const moneyBefore = filled.money;
      const refused: string[] = [];
      completeOrder(filled, spare.id, refused, true);
      check(
        filled.money === moneyBefore &&
          !filled.completedOrders.includes(spare.id) &&
          filled.opportunistBorrows === 1 &&
          refused.includes(`❌ ${pathLockLine(spareLock)}`),
        "a second borrow in the same voyage is refused and the order stays standing, with the lock line every other captain reads rather than a sentence written for this path: one action with one counter, which is the plan's own rollback shape",
      );

      // The flag on a card that was never locked: asked for, and read as
      // nothing at all. This is the shape the board's borrow button uses
      // (it asks with the flag on every board it draws), and it is what
      // keeps an over eager caller from taxing a captain wrongly.
      const ordinary = borrowBoard("c");
      ordinary.money = 500;
      // A raw good order rather than a finished product, because a product
      // order pays VAT on top of its reward and this check is about the
      // face value coming through whole.
      const openCard = ordinary.customerCards.find(
        (card) => lockedBehind(ordinary, card) === null && !card.isProductOrder,
      );
      if (!openCard) {
        throw new Error(
          "No open raw order on the board to read the unbought case off.",
        );
      }
      stockFor(ordinary, openCard);
      const ordinaryFreight = calcTransportCost(
        ordinary,
        openCard.totalItems,
        openCard.resources.some((r) => SILK_GOODS.includes(r.type)),
      );
      const ordinaryLines: string[] = [];
      completeOrder(ordinary, openCard.id, ordinaryLines, true);
      check(
        ordinary.money === 500 + openCard.reward - ordinaryFreight &&
          ordinary.opportunistBorrows === 0 &&
          !ordinaryLines.some((line) => line.includes("Free Captain")),
        "while the same flag asked for on an order nobody locked is read as nothing at all: the card pays its full reward, the allowance is untouched and no borrow line is written, so an over eager caller cannot tax a captain for an ability their order never needed",
      );
    });

    // ---- the switch, off ----
    // The rollback the plan asks for, and it is the one switch D2 already
    // ships: with the locks off the board holds no pathbound card at all,
    // so there is nothing for the borrow to reach through and the ability
    // is refused with the cards that carry it.
    withEnv("NEXT_PUBLIC_PATH_ORDERS", "off", () => {
      const dark = borrowBoard("d");
      const darkCards = dark.customerCards.filter((card) => card.isPathOrder);
      const darkLocked = lockedCardsOf(dark);
      check(
        darkCards.length === 0 &&
          darkLocked.length === 0 &&
          !opportunistMayBorrow(dark, "convoy"),
        "with the path orders rolled back the board holds none of the paths' three even though the draw wrote them, and the borrow is refused with them: the plan's rollback is one switch, and this one is already the locks'",
      );
    });

    // The house rule, over the copy this feature added: every sentence a
    // captain reads on a borrowed card is written in the module beside the
    // arithmetic it describes, board and ledger together, so the two files
    // swept here are where the whole of it lives. The board component is
    // deliberately not swept whole, and the reason is the tree's own: it
    // reads its colors through CSS custom properties, and a doubled hyphen
    // is how that syntax is spelled (see the note on CARRIES_A_DASH above),
    // so the file cannot be held to a rule about dashes. Every borrow
    // string it draws is one of the module's own, which is what the check
    // below is standing on, and the rendered board is read in a browser
    // where the sentences land rather than here.
    check(
      !carriesADash("src/lib/game/engine/opportunist.ts") &&
        !carriesADash("src/lib/game/engine/orders.ts"),
      "every file the borrow's copy lives in reads free of en dashes, em dashes and doubled hyphens, which is the house rule for every string a captain reads",
    );

    // =====================================================================
    // [D7: the draft, and switching] The plan's clause for this feature, and
    // the whole of it: "Deal each captain three path cards face down from a
    // deck seeded so at least two Quartermaster cards are in circulation.
    // Keep one, pass two to the left, keep one of the two received, pass
    // one, discard the last. Then switching: once per voyage, at a port,
    // legs three through nine, forfeiting unfulfilled pathbound orders and
    // paying a Refit fee scaled to Renown, and the switch is published to
    // the fleet log where everyone sees it."
    //
    // The checks are split the way the feature is. The deal's arithmetic is
    // read here without a server, because the rule module holds no state and
    // nothing about a deck needs a room. The deal itself is then played on a
    // real harbor, because the privacy of a hand is the wire half of this
    // feature and no reading of a rule module can observe it: two captains
    // sit down, the voyage sets sail, and every frame both sockets receive
    // is kept. The switch is read in both halves, the engine's own guard
    // over a save and the room's publication over the wire, because the
    // plan's "everyone knows" is a claim about the fleet rather than about
    // the captain who changed their papers.
    // =====================================================================
    console.log("\nThe path draft");

    // ---- the deal's arithmetic ----
    check(
      DRAFT_DEAL === 3 &&
        DRAFT_STEP_SECONDS * DRAFT_DEAL === 45 &&
        DRAFT_QUARTERMASTER_MIN >= 2,
      "the deal is three cards a captain over three steps of fifteen seconds, which is the plan's forty five second interface read off the constants rather than typed into a rule, with the Quartermaster floor at the two the plan asks to be in circulation",
    );

    // The composition, over every table this lap can seat. Two properties
    // are read at every size: the deck is exactly three cards a captain, so
    // it is dealt out entirely, and the Quartermaster floor holds, which is
    // the plan's "always physically present" read as a guarantee rather than
    // a lean. The smallest table is the one that decides the second: a solo
    // captain's deck is three cards and two of them are the floor.
    check(
      Array.from({ length: 12 }, (_, i) => i + 1).every((captains) => {
        const counts = draftComposition(captains);
        const total = PATH_IDS.reduce((sum, id) => sum + counts[id], 0);
        return (
          total === captains * DRAFT_DEAL &&
          counts.quartermaster >= DRAFT_QUARTERMASTER_MIN &&
          PATH_IDS.every((id) => counts[id] >= 0)
        );
      }),
      "every table from one captain to twelve is dealt a deck of exactly three cards a captain with the Quartermaster floor held, so the deck is dealt out to the last card and the card the plan wants in circulation is in circulation at every size",
    );

    // The deck itself: the composition, shuffled. The shuffle is what hides
    // the order and the composition is what decides the counts, so what is
    // read here is that the two are one deck still: the same cards, in a
    // different order than they were built in.
    const composedDeck = PATH_IDS.flatMap((id) =>
      Array.from({ length: draftComposition(6)[id] }, () => id),
    );
    const dealtDeck = draftDeck(6, createRng("smoke:draft:deck"));
    check(
      dealtDeck.length === composedDeck.length &&
        [...dealtDeck].sort().join() === [...composedDeck].sort().join() &&
        dealtDeck.some((card, index) => card !== composedDeck[index]),
      "the shuffled deck is the composition to the last card and in a different order than it was built in, so the floor survives the shuffle and the deal begins from a deck nobody can read",
    );

    // The hands: the deck dealt out three at a time, in seating order.
    const composedHands = draftHands(dealtDeck, 6);
    check(
      composedHands.length === 6 &&
        composedHands.every((hand) => hand.length === DRAFT_DEAL) &&
        composedHands.flat().join() === dealtDeck.join(),
      "the deck is dealt out to the table three cards at a time in the order the seats were opened in, so what a captain holds is a slice of one deck rather than a draw of its own",
    );
    check(
      draftHands(dealtDeck, 7).flat().length === dealtDeck.length &&
        draftHands(dealtDeck, 7)[6]?.length === 0,
      "and a table with one seat too many is handed a short hand rather than a card somebody else is already holding",
    );

    // The keep and the pass. A pick names a place in a hand rather than a
    // path, because a deck with a floor can hand one captain two cards of
    // the same path and "keep the Quartermaster" would not name a card.
    const spreadHand: PathId[] = ["quartermaster", "convoy", "quartermaster"];
    const keptOne = keepFrom(spreadHand, 1);
    check(
      keptOne?.kept === "convoy" &&
        keptOne.rest.length === 2 &&
        keptOne.rest.filter((card) => card === "quartermaster").length === 2 &&
        keepFrom(spreadHand, DRAFT_DEAL) === null &&
        keepFrom(spreadHand, -1) === null &&
        keepFrom(spreadHand, 1.5) === null &&
        keepFrom(spreadHand, "1") === null,
      "a card is kept by the place it holds in a hand, so a captain dealt two Quartermasters keeps one of them and leaves the other in play, and a pick that names nothing in the hand is refused rather than rounded to somewhere",
    );
    const fourHands: PathId[][] = [
      ["convoy", "convoy", "loom"],
      ["aroma", "aroma", "quartermaster"],
      ["free_captain", "free_captain", "loom"],
      ["quartermaster", "aroma", "convoy"],
    ];
    const passedHands = passLeft(fourHands);
    check(
      passedHands.every(
        (hand, seat) =>
          hand === fourHands[(seat - 1 + fourHands.length) % fourHands.length],
      ) &&
        passedHands[0]?.join() === fourHands[fourHands.length - 1]?.join() &&
        passedHands.length === fourHands.length,
      "the two cards a captain did not keep travel to the seat on their left, which is the next seat in the order the draft was opened with and wraps at the table's end",
    );
    check(
      DRAFT_AUTO_PICK === 0 &&
        keepFrom(spreadHand, DRAFT_AUTO_PICK)?.kept === "quartermaster",
      "and the card the room lays for a captain who let the clock run out is the first card of their own hand, which is a card they were dealt rather than one the server liked",
    );

    // ---- the window, the seat and the price ----
    check(
      pathSwitchWindow(PATH_SWITCH_FROM_ROUND) &&
        pathSwitchWindow(PATH_SWITCH_TO_ROUND) &&
        pathSwitchWindow(PATH_SWITCH_FROM_ROUND + 0.9) &&
        !pathSwitchWindow(PATH_SWITCH_FROM_ROUND - 1) &&
        !pathSwitchWindow(PATH_SWITCH_TO_ROUND + 1) &&
        !pathSwitchWindow(Number.NaN) &&
        ["market", "orders", "parley"].every((seat) => pathSwitchPhase(seat)) &&
        ["harbor", "dawn", "resolve", "dusk"].every(
          (seat) => !pathSwitchPhase(seat),
        ) &&
        !pathSwitchPhase(null) &&
        !pathSwitchPhase(4),
      "new papers are read in legs three through nine and in the three seats the port is: a captain buys, commits and talks at Market, Orders and Parley, and sails, raids and settles accounts in the others",
    );
    const feeLadder = Array.from({ length: RENOWN_MAX_LEVEL }, (_, rung) =>
      pathSwitchFee(rung + 1),
    );
    const firstCapped = feeLadder.findIndex(
      (fee) => fee === PATH_SWITCH_FEE_MAX,
    );
    check(
      feeLadder[0] === PATH_SWITCH_FEE_BASE &&
        pathSwitchFee(RENOWN_MAX_LEVEL) === PATH_SWITCH_FEE_MAX &&
        firstCapped > 0 &&
        firstCapped < RENOWN_MAX_LEVEL &&
        feeLadder.every(
          (fee, rung) =>
            fee <= PATH_SWITCH_FEE_MAX &&
            (rung === 0 || fee >= feeLadder[rung - 1]),
        ),
      `the price of new papers is the plan's Refit fee scaled to Renown: the base at the first rung, ${PATH_SWITCH_FEE_PER_LEVEL} Gold more for each rung above it, and a ceiling that binds before the ladder's top rung rather than above it, so a captain really meets the bound`,
    );
    check(
      pathSwitchFee(0) === PATH_SWITCH_FEE_BASE &&
        pathSwitchFee(-3) === PATH_SWITCH_FEE_BASE &&
        pathSwitchFee(Number.NaN) === PATH_SWITCH_FEE_BASE &&
        pathSwitchFee(3.9) === pathSwitchFee(3),
      "and a save carrying a rung nobody sails on pays the base rather than less than it, because the ladder's floor is where every captain starts",
    );
    check(
      normalizePathSwitchLeg(4.7) === 4 &&
        normalizePathSwitchLeg(9) === 9 &&
        normalizePathSwitchLeg(0) === 0 &&
        normalizePathSwitchLeg(-2) === 0 &&
        normalizePathSwitchLeg(Number.NaN) === 0 &&
        normalizePathSwitchLeg("four") === 0,
      "the leg a switch is stamped with reads as the voyage's own counter, and nonsense in that field reads as a captain who has not changed their papers: the direction that keeps a corrupt save from spending the one switch a voyage allows",
    );
    check(
      pathSwitchOpenLine(PATH_SWITCH_FROM_ROUND - 1, "market") ===
        `The harbor reads new papers from round ${PATH_SWITCH_FROM_ROUND}.` &&
        pathSwitchOpenLine(PATH_SWITCH_TO_ROUND + 1, "market") ===
          `The window for new papers closed after round ${PATH_SWITCH_TO_ROUND}.` &&
        pathSwitchOpenLine(4, "dawn") ===
          "Papers are changed at the port, in Market, Orders or Parley." &&
        pathSwitchOpenLine(4, "market") === null &&
        pathSwitchOpenLine(2, "dawn") ===
          `The harbor reads new papers from round ${PATH_SWITCH_FROM_ROUND}.`,
      "the harbor's answer about when it reads new papers is one sentence per fact and the season is asked before the seat, so a switch attempted in the wrong part of a voyage is told about the voyage rather than about the phase it happened to be attempted in",
    );

    // ---- what a kept card writes into a save ----
    const kept = voyageState();
    const keptLines: string[] = [];
    check(
      kept.path === null &&
        kept.pathSwitchLeg === 0 &&
        applyDraftPath(kept, "quartermaster", keptLines) === true &&
        kept.path === "quartermaster" &&
        keptLines.length === 1 &&
        keptLines[0]!.includes(pathConfig("quartermaster")!.name) &&
        applyDraftPath(kept, "loom", keptLines) === false &&
        kept.path === "quartermaster" &&
        keptLines.length === 1,
      "the card the draft leaves a captain holding is written once and only once: a second card arriving, which a reload or a second deal would send, is a frame to drop rather than an identity to overwrite behind the fleet's back",
    );

    // ---- the switch, over a save ----
    // A board dealt through the engine's own lifecycle in a seat inside the
    // window, so the forfeiture below walks the manifest a captain really
    // meets rather than cards assembled by hand. It is read under the path
    // order switch the way every board this suite deals one is, because a
    // locked card only exists while that switch is on and a fixture that
    // forgot it would be reading a manifest with nothing in it to forfeit.
    const switched = withEnv("NEXT_PUBLIC_PATH_ORDERS", "1", () => {
      const state = voyageState({ mode: "ocean_gambit" });
      snapToCheckpoint(
        state,
        { seedBase: `smoke:d7:switch:${suffix}`, harborId: "harbor-a" },
        4,
        "orders",
        [],
      );
      state.money = 500;
      state.renownLevel = 4;
      const locked = state.customerCards
        .map((card) => ({ card, lock: pathOrderOf(card, GAMBIT) }))
        .filter(
          (row): row is { card: OrderCard; lock: PathId } => row.lock !== null,
        );
      const from = locked[0]?.lock ?? "convoy";
      const to = PATH_IDS.find((id) => id !== from)!;
      const mine = locked
        .filter((row) => row.lock === from)
        .map((row) => row.card);
      // One of the old papers' cards already filled, on the boards that
      // carry two of them: the manifest is also the leg's history, so a
      // filled order is not something a switch can take away. A board that
      // carries only one of them leaves it open instead, and the forfeiture
      // below reads its count off the ledger rather than off a card.
      const filled = mine.length > 1 ? mine.slice(0, 1) : [];
      const open = mine.filter((card) => !filled.includes(card));
      const loose = state.customerCards.filter(
        (card) => pathOrderOf(card, GAMBIT) === null,
      );
      state.path = from;
      state.pathSwitchLeg = 0;
      state.completedOrders = [
        ...state.completedOrders,
        ...filled.map((card) => card.id),
      ];
      const fee = pathSwitchFee(state.renownLevel);
      const purse = state.money;
      const lines: string[] = [];
      const applied = applyPathSwitch(state, to, lines);
      const held = (card: OrderCard) =>
        state.customerCards.some((kept) => kept.id === card.id);
      return {
        state,
        locked,
        from,
        to,
        filled,
        open,
        loose,
        fee,
        purse,
        lines,
        applied,
        held,
      };
    });
    check(
      switched.locked.length > 0,
      `a leg four board carries the paths' cards like any other (${switched.locked.length} locked), which is what the forfeiture below has to have to walk`,
    );
    check(
      switched.applied &&
        switched.state.path === switched.to &&
        switched.state.pathSwitchLeg === 4 &&
        switched.state.money === switched.purse - switched.fee &&
        switched.open.length > 0 &&
        switched.open.every((card) => !switched.held(card)) &&
        switched.filled.every((card) => switched.held(card)) &&
        switched.loose.every((card) => switched.held(card)),
      "the one switch a voyage allows charges the fee, stamps the leg it happened on and takes the unfulfilled pathbound orders of the path being set aside with it, while the orders already filled and the cards nobody locked stay on the manifest",
    );
    check(
      switched.lines.some(
        (line) =>
          line.includes(pathConfig(switched.from)!.name) &&
          line.includes(pathConfig(switched.to)!.name) &&
          line.includes(String(switched.fee)),
      ) &&
        switched.lines.filter((line) => line.startsWith("📜 Forfeited"))
          .length === 1 &&
        switched.lines.includes(
          `📜 Forfeited ${switched.open.length} unfulfilled pathbound order${switched.open.length === 1 ? "" : "s"}.`,
        ),
      "and the ledger says the whole of the price: the path set aside, the path taken up, the Gold it cost, and the orders it took with it counted once and counted right",
    );
    // The other side of the same guard, on a board whose locked cards are
    // all filled: the forfeiture a switch costs is the work a captain did
    // not do, so a manifest with none of it left has nothing to lose and
    // says so by leaving the sentence off rather than by printing a zero.
    withEnv("NEXT_PUBLIC_PATH_ORDERS", "1", () => {
      const carried = voyageState({ mode: "ocean_gambit" });
      snapToCheckpoint(
        carried,
        { seedBase: `smoke:d7:carried:${suffix}`, harborId: "harbor-a" },
        4,
        "orders",
        [],
      );
      const anyLocked = carried.customerCards.find(
        (card) => pathOrderOf(card, GAMBIT) !== null,
      );
      const abandoned =
        anyLocked === undefined
          ? null
          : (pathOrderOf(anyLocked, GAMBIT) ?? null);
      carried.path = abandoned ?? PATH_IDS[0];
      carried.money = 500;
      const marked = carried.customerCards.filter(
        (card) => pathOrderOf(card, GAMBIT) === abandoned,
      );
      carried.completedOrders = [
        ...carried.completedOrders,
        ...marked.map((card) => card.id),
      ];
      const before = carried.customerCards.length;
      const lines: string[] = [];
      const switchedHere = applyPathSwitch(
        carried,
        PATH_IDS.find((id) => id !== carried.path)!,
        lines,
      );
      check(
        abandoned !== null &&
          switchedHere &&
          carried.customerCards.length === before &&
          marked.length > 0 &&
          marked.every((card) =>
            carried.customerCards.some((kept) => kept.id === card.id),
          ) &&
          lines.every((line) => !line.startsWith("📜 Forfeited")),
        "and a manifest whose pathbound cards are all filled loses nothing to a switch and says so by leaving the forfeiture line off entirely, so the line a captain reads is the count of what they gave up rather than a sentence the ledger prints every time",
      );
    });

    // The refusals, one per fact, and each of them is the sentence the panel
    // greys a button out with and the switch itself obeys, because they are
    // one function rather than two that could drift.
    const atSea = (
      round: number,
      phase: Phase,
      path: PathId,
      money: number,
    ) => {
      const state = voyageState();
      state.currentRound = round;
      state.phase = phase;
      state.path = path;
      state.money = money;
      return state;
    };
    // Two paths, and they are read off the record rather than off the board
    // above: none of these sentences depends on what a manifest was dealt.
    const heldPath = PATH_IDS[0];
    const wantedPath = PATH_IDS[1];
    const atPort = atSea(4, "orders", heldPath, 500);
    check(
      pathSwitchBlocked(voyageState(), wantedPath) ===
        "You hold no path to set aside." &&
        pathSwitchBlocked(atPort, heldPath) === "You already hold that path." &&
        pathSwitchBlocked({ ...atPort, pathSwitchLeg: 3 }, wantedPath) ===
          "A captain changes their papers once a voyage, and yours are already changed." &&
        pathSwitchBlocked(
          atSea(PATH_SWITCH_FROM_ROUND - 1, "orders", heldPath, 500),
          wantedPath,
        ) ===
          `The harbor reads new papers from round ${PATH_SWITCH_FROM_ROUND}.` &&
        pathSwitchBlocked(
          atSea(PATH_SWITCH_TO_ROUND + 1, "orders", heldPath, 500),
          wantedPath,
        ) ===
          `The window for new papers closed after round ${PATH_SWITCH_TO_ROUND}.` &&
        pathSwitchBlocked(atSea(4, "dawn", heldPath, 500), wantedPath) ===
          "Papers are changed at the port, in Market, Orders or Parley." &&
        pathSwitchBlocked(atPort, wantedPath) === null,
      "a captain with no path to set aside, one who has already changed their papers this voyage, one outside the legs the window spans, one in a seat that is not the port, one naming the path they already hold and one at the port in season: each is refused or allowed in the words the panel prints, and only the last of them can switch",
    );
    check(
      pathSwitchBlocked(atPort, wantedPath) === null &&
        pathSwitchBlocked(
          { ...atPort, money: pathSwitchFee(atPort.renownLevel) - 1 },
          wantedPath,
        ) ===
          `❌ Need ${pathSwitchFee(atPort.renownLevel)} Gold to change your papers.`,
      "and a purse that cannot answer the price is refused last, after everything about where and when, so a captain is never told what a switch costs instead of why they cannot make one",
    );
    const refusedBoard = atSea(4, "dawn", heldPath, 500);
    const refusedLines: string[] = [];
    check(
      applyPathSwitch(refusedBoard, wantedPath, refusedLines) === false &&
        refusedBoard.path === heldPath &&
        refusedBoard.pathSwitchLeg === 0 &&
        refusedBoard.money === 500 &&
        refusedLines[0] ===
          "Papers are changed at the port, in Market, Orders or Parley.",
      "a switch attempted in a seat the port does not keep is refused with the reason written into the captain's own ledger and nothing charged: a refusal costs a captain nothing but the sentence",
    );
    check(
      pathSwitchOpenLine(4, "orders") === null &&
        pathSwitchOpenLine(4, "dawn") ===
          pathSwitchBlocked(atSea(4, "dawn", heldPath, 500), wantedPath) &&
        pathSwitchOpenLine(2, "dawn") ===
          pathSwitchBlocked(atSea(2, "dawn", heldPath, 500), wantedPath),
      "and the room asks the same function the engine does, so a switch the fleet is shown is a switch the captain's own books would accept: the season and the seat are one sentence told twice",
    );

    // The plan's rollback, and it is one switch: with the draft off nothing
    // deals a path, so the change of papers has no precondition to meet and
    // says so in its first sentence rather than in a rule written for the
    // rolled back build.
    check(
      withEnv("NEXT_PUBLIC_PATH_DRAFT", "off", () => !pathDraftOn(GAMBIT)) &&
        withEnv("NEXT_PUBLIC_PATH_DRAFT", "on", () => pathDraftOn(GAMBIT)) &&
        pathSwitchBlocked(voyageState(), "loom") ===
          "You hold no path to set aside.",
      "the draft's own switch reads off the environment and defaults to on, and the pathless captain it leaves behind is refused by the same first sentence a captain who never drew one meets, so the rolled back build needs no second rule",
    );

    // ---- the deal, played on a real harbor ----
    // Two captains, because a pass needs a seat to pass to and a hand's
    // privacy is only observable with a second set of frames to compare
    // against. Every frame both sockets receive is kept, and the deal is
    // read back against the rule module's own composition: what the room
    // deals is what this tree says a table of two is owed, to the last card.
    const draftHost = await signUp("draft_a");
    const draftMate = await signUp("draft_b");
    run.extraAccounts.push(draftHost, draftMate);
    const draftRoom = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: draftHost.cookie,
        body: JSON.stringify({
          name: `Smoke draft harbor ${suffix}`,
          isPublic: false,
          mode: "ocean_gambit",
          unlock: LEDGER_PHRASE,
        }),
      },
    );
    if (draftRoom.status !== 200) {
      throw new Error("No draft harbor to deal into, stopping here.");
    }
    const draftRoomId = draftRoom.body.room.id;
    run.lapRoomIds.push(draftRoomId);
    await call("/api/rooms/join", {
      method: "POST",
      cookie: draftMate.cookie,
      body: JSON.stringify({ code: draftRoom.body.room.code }),
    });

    const draftSeats: Array<{
      captain: Captain;
      socket: Socket;
      views: DraftView[];
      frames: Array<{ event: string; text: string }>;
      closed: number;
      switched: PathSwitched[];
      errors: string[];
    }> = [];
    for (const captain of [draftHost, draftMate]) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      const seat = {
        captain,
        socket,
        views: [] as DraftView[],
        frames: [] as Array<{ event: string; text: string }>,
        closed: 0,
        switched: [] as PathSwitched[],
        errors: [] as string[],
      };
      // Every frame this socket receives, on any event rather than on the
      // three the draft is known to use, so the privacy check at the end of
      // the deal reads the wire rather than the events the feature happens
      // to name today: a hand that left under a second event name is
      // exactly what a listener per event cannot see.
      socket.onAny((event: string, ...args: unknown[]) => {
        seat.frames.push({ event, text: JSON.stringify(args) });
      });
      socket.on("draft:update", (payload: DraftView | null) => {
        if (payload === null) seat.closed += 1;
        else if (payload?.roomId === draftRoomId) seat.views.push(payload);
      });
      socket.on("path:switched", (payload: PathSwitched) => {
        if (payload?.roomId === draftRoomId) seat.switched.push(payload);
      });
      socket.on(
        "path:error",
        (payload: { roomId?: string; error?: string }) => {
          if (
            payload?.roomId === draftRoomId &&
            typeof payload.error === "string"
          ) {
            seat.errors.push(payload.error);
          }
        },
      );
      const seated = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === draftRoomId,
      );
      socket.emit("room:join", { roomId: draftRoomId });
      await seated;
      draftSeats.push(seat);
    }
    // The two lines the settle writes, collected off the host's own socket
    // rather than waited for one at a time: a draft's log lines are one
    // fact per seat and arrive together, so a reader that waited for the
    // first and then the second would be waiting on the same frame twice.
    const takenLines: VoyageLogEntry[] = [];
    draftSeats[0]!.socket.on(
      "voyage:log",
      (payload: { entry?: VoyageLogEntry }) => {
        if (payload?.entry?.kind === "path_taken")
          takenLines.push(payload.entry);
      },
    );

    const firstBeats = draftSeats.map((seat) =>
      waitForEvent<DraftView>(
        seat.socket,
        "draft:update",
        (payload) =>
          payload?.roomId === draftRoomId && payload?.step === "first",
        15000,
      ),
    );
    draftSeats[0]!.socket.emit("room:start", { roomId: draftRoomId });
    const openingViews = await Promise.all(firstBeats);
    check(
      openingViews.every(
        (view) =>
          view !== null &&
          view.hand.length === DRAFT_DEAL &&
          view.open === 2 &&
          view.path === null &&
          view.deadline > Date.now(),
      ),
      "every captain at the table is dealt their own three cards face down, told the whole table is still to choose and given the server's clock, and nobody holds a path until the last step closes",
    );
    const openingHands = openingViews.map((view) => view!.hand);
    const openingCounts = PATH_IDS.reduce(
      (tally, id) => {
        tally[id] = openingHands.flat().filter((card) => card === id).length;
        return tally;
      },
      {} as Record<PathId, number>,
    );
    const deckOwed = draftComposition(2);
    check(
      PATH_IDS.every((id) => openingCounts[id] === deckOwed[id]) &&
        deckOwed.quartermaster >= DRAFT_QUARTERMASTER_MIN,
      `the two hands on the table are the deck this tree says a table of two is owed, to the last card (${PATH_IDS.map((id) => `${id} ${openingCounts[id]}`).join(", ")})`,
    );

    // The host keeps the card the plan's evaluation watches for and the mate
    // keeps nothing at all: their step is left to run out, which is the one
    // path through this feature that only a clock can prove.
    const pickOf = (hand: readonly PathId[]): number => {
      const quartermaster = hand.indexOf("quartermaster");
      return quartermaster >= 0 ? quartermaster : DRAFT_AUTO_PICK;
    };
    const hostFirstPick = pickOf(openingHands[0]!);
    const countDropping = waitForEvent<DraftView>(
      draftSeats[0]!.socket,
      "draft:update",
      (payload) =>
        payload?.roomId === draftRoomId &&
        payload?.step === "first" &&
        payload?.open === 1,
    );
    const hostSecond = waitForEvent<DraftView>(
      draftSeats[0]!.socket,
      "draft:update",
      (payload) =>
        payload?.roomId === draftRoomId && payload?.step === "second",
      DRAFT_STEP_SECONDS * 1000 + 10000,
    );
    const mateSecond = waitForEvent<DraftView>(
      draftSeats[1]!.socket,
      "draft:update",
      (payload) =>
        payload?.roomId === draftRoomId && payload?.step === "second",
      DRAFT_STEP_SECONDS * 1000 + 10000,
    );
    draftSeats[0]!.socket.emit("draft:keep", {
      roomId: draftRoomId,
      pick: hostFirstPick,
    });
    check(
      (await countDropping)?.open === 1,
      "a card laid down is counted for the whole table rather than held by the server, so the captains still reading know whether they are waiting on four people or on one",
    );
    const secondCard = waitForEvent<{ roomId?: string; error?: string }>(
      draftSeats[0]!.socket,
      "draft:error",
      (payload) => payload?.roomId === draftRoomId,
    );
    draftSeats[0]!.socket.emit("draft:keep", {
      roomId: draftRoomId,
      pick: hostFirstPick,
    });
    check(
      (await secondCard)?.error === "Your card is already laid down.",
      "and a captain who lays a second card down in the same step is told what happened rather than ignored, because the first answer is the one the table has been shown",
    );
    const atSecond = (await hostSecond)!;
    const mateAtSecond = (await mateSecond)!;
    check(
      atSecond !== null &&
        mateAtSecond !== null &&
        atSecond.hand.length === 2 &&
        mateAtSecond.hand.length === 2,
      "the step the mate never answered closes on the room's own clock and the two cards they were passed arrive without them having chosen anything",
    );
    // The pass, read off both frames: each captain holds the two cards the
    // other did not keep, in the order they were dealt and not kept in. The
    // order is part of the promise, because a pick is an index into this
    // array: a frame whose cards are in another order would have the client
    // choosing by one numbering and the room counting by another.
    const mateRests = openingHands[1]!.filter(
      (_, index) => index !== DRAFT_AUTO_PICK,
    );
    const hostRests = openingHands[0]!.filter(
      (_, index) => index !== hostFirstPick,
    );
    check(
      atSecond.hand.join() === mateRests.join() &&
        mateAtSecond.hand.join() === hostRests.join(),
      "and each of them holds the two cards the other captain did not keep, in the order the other was holding them: the pass travels to the left, and the cards arrive as a hand a captain can still pick out of",
    );
    check(
      draftSeats[1]!.errors.length === 0,
      "the captain who said nothing is never told they did anything wrong, and the card the room laid for them was one of their own",
    );

    // The second keep, answered by both this time, and then the last step:
    // the two cards a captain holds at the end are their own two keeps, and
    // the voyage is sailed on whichever of them they hold on to.
    const hostLast = waitForEvent<DraftView>(
      draftSeats[0]!.socket,
      "draft:update",
      (payload) => payload?.roomId === draftRoomId && payload?.step === "last",
    );
    const mateLast = waitForEvent<DraftView>(
      draftSeats[1]!.socket,
      "draft:update",
      (payload) => payload?.roomId === draftRoomId && payload?.step === "last",
    );
    const hostSettled = waitForEvent<DraftView>(
      draftSeats[0]!.socket,
      "draft:update",
      (payload) => payload?.roomId === draftRoomId && payload?.step === "done",
    );
    const mateSettled = waitForEvent<DraftView>(
      draftSeats[1]!.socket,
      "draft:update",
      (payload) => payload?.roomId === draftRoomId && payload?.step === "done",
    );
    const hostSecondPick = pickOf(atSecond.hand);
    const mateSecondPick = pickOf(mateAtSecond.hand);
    draftSeats[0]!.socket.emit("draft:keep", {
      roomId: draftRoomId,
      pick: hostSecondPick,
    });
    draftSeats[1]!.socket.emit("draft:keep", {
      roomId: draftRoomId,
      pick: mateSecondPick,
    });
    const hostAtLast = (await hostLast)!;
    const mateAtLast = (await mateLast)!;
    const hostPapers = [
      openingHands[0]![hostFirstPick]!,
      atSecond.hand[hostSecondPick]!,
    ];
    const matePapers = [
      openingHands[1]![DRAFT_AUTO_PICK]!,
      mateAtSecond.hand[mateSecondPick]!,
    ];
    check(
      hostAtLast !== null &&
        mateAtLast !== null &&
        hostAtLast.hand.join() === hostPapers.join() &&
        mateAtLast.hand.join() === matePapers.join(),
      "the last step is the two papers that captain kept, in the order they kept them, so the choice is between a card out of their own deal and a card they kept off the pass rather than between two cards somebody else chose",
    );
    // The host keeps the card on offer and the mate the other of their two,
    // which is the plan's own evaluation read as a fixture: taking the card
    // in the deck the plan watches for is a choice somebody makes rather
    // than a duty somebody gets assigned, so the two captains at this table
    // end on different papers for different reasons.
    const hostLastPick = pickOf(hostAtLast.hand);
    const mateLastPick = mateAtLast.hand.length - 1 - pickOf(mateAtLast.hand);
    draftSeats[0]!.socket.emit("draft:keep", {
      roomId: draftRoomId,
      pick: hostLastPick,
    });
    draftSeats[1]!.socket.emit("draft:keep", {
      roomId: draftRoomId,
      pick: mateLastPick,
    });
    const settledViews = [await hostSettled, await mateSettled];
    const hostPath = hostAtLast.hand[hostLastPick]!;
    const matePath = mateAtLast.hand[mateLastPick]!;
    check(
      settledViews[0]?.path === hostPath &&
        settledViews[1]?.path === matePath &&
        settledViews[0]?.open === 0 &&
        settledViews.every((view) => view?.step === "done"),
      "when the last card is laid the draft settles and every seat is told the path it sails on, which is the card that captain held on to: the whole of the result rides the settled view rather than a frame of its own",
    );
    for (
      let waited = 0;
      takenLines.length < 2 && waited < 8000;
      waited += 100
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    check(
      takenLines.length === 2 &&
        takenLines.every(
          (entry) =>
            entry.round === 1 &&
            [hostPath, matePath].some((path) =>
              entry.text.includes(pathConfig(path)!.name),
            ),
        ) &&
        takenLines.some(
          (entry) =>
            entry.text ===
            `Smoke draft_a takes up the ${pathConfig(hostPath)!.name} path.`,
        ) &&
        takenLines.some(
          (entry) =>
            entry.text ===
            `Smoke draft_b takes up the ${pathConfig(matePath)!.name} path.`,
        ),
      "and the fleet is told what each captain took in the voyage log, once a seat, at the leg the draft was dealt in and named by the captain rather than by the card",
    );

    // ---- the hand, read back off the wire ----
    // What the checks above cannot show, because every one of them reads a
    // frame that named the draft rather than what the two sockets were
    // actually sent. `hand` is a field of one wire type and one only (see
    // DraftView), so a frame that names one is either a seat's own draft
    // frame or a hand that travelled somewhere it was not addressed, and
    // the second reading is the one that matters: a hand that changes
    // inside a single beat is a card that belongs to somebody else, since a
    // beat is dealt to one seat once and no pick moves the cards until the
    // step closes. The reading is taken here, after the settle and after
    // both log lines have landed, because that is the moment the wire is
    // provably quiet: the settle sends each seat its view before it writes
    // the line for that seat, so a socket that has heard its line has heard
    // its view, and a sweep taken any earlier could miss a frame still in
    // flight and call the wire clean by arriving first.
    const strayHands = draftSeats.flatMap((seat) => {
      const beats = new Map<string, string>();
      return seat.frames.flatMap((frame) => {
        if (!frame.text.includes('"hand":')) return [];
        const [payload] = JSON.parse(frame.text) as [DraftView | null];
        if (frame.event !== "draft:update" || !payload) {
          return [`a hand rode ${frame.event} to ${seat.captain.username}`];
        }
        const key = `${payload.step}@${payload.deadline}`;
        const hand = payload.hand.join(".");
        const seen = beats.get(key);
        if (seen === undefined) {
          beats.set(key, hand);
          return [];
        }
        return seen === hand
          ? []
          : [`${seat.captain.username} was sent two hands for ${key}`];
      });
    });
    check(
      strayHands.length === 0,
      `the only frames either socket received that name a hand are the draft's own, one hand a captain a beat (${draftSeats.reduce((count, seat) => count + seat.frames.length, 0)} frames read on every event across the two sockets), so a hand is private in its whole shape: the frame goes to the captain it was dealt to and to no one else`,
    );

    // ---- the switch, published to the fleet ----
    // The captain who drew the older papers is the one who changes them, and
    // the frame that comes back is the room's answer rather than their own
    // press: the fee, the forfeiture and the stamp are theirs to apply, and
    // nothing here charges anybody.
    const switcher = draftSeats[0]!;
    const other = draftSeats[1]!;
    const otherPath = PATH_IDS.find((id) => id !== hostPath)!;
    const tooEarly = waitForEvent<{ roomId?: string; error?: string }>(
      switcher.socket,
      "path:error",
      (payload) => payload?.roomId === draftRoomId,
    );
    switcher.socket.emit("path:switch", {
      roomId: draftRoomId,
      path: otherPath,
    });
    check(
      (await tooEarly)?.error ===
        `The harbor reads new papers from round ${PATH_SWITCH_FROM_ROUND}.`,
      "a switch pressed in the leg the voyage opens on is refused by the room with the season it is waiting for, and nothing is published",
    );
    check(
      switcher.switched.length === 0 && other.switched.length === 0,
      "so the fleet has heard nothing, which is what makes the publication the price of the change rather than a line about it",
    );

    // The room's seat, moved the way this suite moves any room's seat, to a
    // leg and a seat the port keeps.
    const draftRoomRow = async () =>
      db.room.findUnique({
        where: { id: draftRoomId },
        select: { currentRound: true, currentPhase: true },
      });
    const parkDraftRoom = async (round: number, phase: Phase) => {
      switcher.socket.emit("game:status", {
        roomId: draftRoomId,
        round,
        phase,
        phaseLabel: phaseFace(phase).label,
        gold: 500,
        reputation: 12,
        shipLevel: 0,
        gameOver: false,
        renownLevel: 4,
      });
      let row = await draftRoomRow();
      for (
        let waited = 0;
        (row?.currentRound !== round || row?.currentPhase !== phase) &&
        waited < 5000;
        waited += 250
      ) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        row = await draftRoomRow();
      }
      return row;
    };
    // The first leg the window opens on, named once so that the reading of
    // the published frame below is of this same leg rather than of a number
    // written out twice.
    const switchLegRound = PATH_SWITCH_FROM_ROUND + 1;
    const atThePort = await parkDraftRoom(switchLegRound, "orders");
    check(
      atThePort?.currentRound === switchLegRound &&
        atThePort?.currentPhase === "orders",
      "and the room can be walked to a leg and a seat where the port reads new papers",
    );
    const nonsense = waitForEvent<{ roomId?: string; error?: string }>(
      switcher.socket,
      "path:error",
      (payload) => payload?.roomId === draftRoomId,
    );
    switcher.socket.emit("path:switch", {
      roomId: draftRoomId,
      path: "galleon",
    });
    check(
      (await nonsense)?.error === "No such path.",
      "a switch naming a path this build does not have is refused at the room rather than published to it, since the fleet log is a record rather than a place to try things out",
    );
    const published = waitForEvent<PathSwitched>(
      other.socket,
      "path:switched",
      (payload) =>
        payload?.roomId === draftRoomId && payload?.userId === draftHost.id,
    );
    const logged = waitForEvent<{ entry: VoyageLogEntry }>(
      other.socket,
      "voyage:log",
      (payload) => payload?.entry?.kind === "path_switched",
    );
    switcher.socket.emit("path:switch", {
      roomId: draftRoomId,
      path: otherPath,
    });
    const publishedFrame = await published;
    check(
      publishedFrame?.path === otherPath &&
        publishedFrame.name === "Smoke draft_a" &&
        switcher.switched.length === 1,
      "a switch in season is published to the whole room, the captain who made it included, and it carries the path taken up and not the one set aside, because the server has never read a save to know what that was",
    );
    check(
      (await logged)?.entry?.text ===
        `Smoke draft_a sets aside their old papers and takes up the ${pathConfig(otherPath)!.name} path.`,
      "and the fleet log keeps the line, which is the record the table reads back rather than the frame it watched",
    );
    const again = waitForEvent<{ roomId?: string; error?: string }>(
      switcher.socket,
      "path:error",
      (payload) => payload?.roomId === draftRoomId,
    );
    switcher.socket.emit("path:switch", {
      roomId: draftRoomId,
      path: matePath,
    });
    check(
      (await again)?.error ===
        "A captain changes their papers once a voyage, and yours are already changed." &&
        switcher.switched.length === 1,
      "and a second change in the same voyage is refused by the room's own book, which is the half of the once a voyage rule a server can keep",
    );
    const offSeat = await parkDraftRoom(5, "dawn");
    const notAtPort = waitForEvent<{ roomId?: string; error?: string }>(
      other.socket,
      "path:error",
      (payload) => payload?.roomId === draftRoomId,
    );
    other.socket.emit("path:switch", { roomId: draftRoomId, path: "convoy" });
    const notAtPortFrame = await notAtPort;
    check(
      offSeat?.currentPhase === "dawn" &&
        notAtPortFrame?.error ===
          "Papers are changed at the port, in Market, Orders or Parley." &&
        // The mate's own socket is carrying the host's switch, which the
        // room published to the whole fleet, so what is read here is that
        // no frame names the mate rather than that the socket is empty.
        other.switched.every((frame) => frame.userId === draftHost.id),
      "while a captain in a seat that is not the port is refused in the engine's own words, so the room and the books tell a captain the same thing",
    );
    const late = await parkDraftRoom(PATH_SWITCH_TO_ROUND + 1, "orders");
    const closed = waitForEvent<{ roomId?: string; error?: string }>(
      other.socket,
      "path:error",
      (payload) => payload?.roomId === draftRoomId,
    );
    other.socket.emit("path:switch", { roomId: draftRoomId, path: "convoy" });
    check(
      late?.currentRound === PATH_SWITCH_TO_ROUND + 1 &&
        (await closed)?.error ===
          `The window for new papers closed after round ${PATH_SWITCH_TO_ROUND}.`,
      "and past the last leg of the window the room closes it with the leg it closes after, which is the same sentence the panel would have greyed the button out with",
    );

    // ---- the wipe that takes a draft with it ----
    // The plan's own rollback note is "draft state is transient per voyage,
    // so nothing durable is at risk", and this is that sentence read as a
    // frame: a harbor wiped while its captains are still reading their cards
    // tells them there is no draft rather than leaving three cards in front
    // of a table that has already set sail again.
    const solo = await signUp("draft_s");
    run.extraAccounts.push(solo);
    const soloRoom = await call<{ room: { id: string } }>("/api/rooms", {
      method: "POST",
      cookie: solo.cookie,
      body: JSON.stringify({
        name: `Smoke draft wipe harbor ${suffix}`,
        isPublic: false,
        mode: "ocean_gambit",
        unlock: LEDGER_PHRASE,
      }),
    });
    if (soloRoom.status !== 200) {
      throw new Error("No draft harbor to wipe, stopping here.");
    }
    const soloRoomId = soloRoom.body.room.id;
    run.lapRoomIds.push(soloRoomId);
    const soloSocket = await openAuthedSocket(solo);
    run.sockets.push(soloSocket);
    let soloClosed = 0;
    soloSocket.on("draft:update", (payload: DraftView | null) => {
      if (payload === null) soloClosed += 1;
    });
    const soloSeated = waitForEvent<WireHistory>(
      soloSocket,
      "chat:history",
      (payload) => payload?.roomId === soloRoomId,
    );
    soloSocket.emit("room:join", { roomId: soloRoomId });
    await soloSeated;
    const soloDeal = waitForEvent<DraftView>(
      soloSocket,
      "draft:update",
      (payload) => payload?.roomId === soloRoomId && payload?.step === "first",
    );
    soloSocket.emit("room:start", { roomId: soloRoomId });
    const soloCards = await soloDeal;
    // What this seat has heard before the wipe, which is one null: a harbor
    // that has not dealt a card tells the captain who walks into it that
    // there is no draft, and that is the frame the client draws nothing for.
    // It is counted here rather than assumed so that the wipe below is read
    // as a frame of its own rather than as "some null or other".
    const closedAtJoin = soloClosed;
    const soloWiped = waitForEvent<{ roomId: string }>(
      soloSocket,
      "room:restarted",
      (payload) => payload?.roomId === soloRoomId,
    );
    soloSocket.emit("room:restart", { roomId: soloRoomId });
    check(
      soloCards?.hand.length === DRAFT_DEAL && soloCards.open === 1,
      "a captain sailing alone is dealt a hand like any other, and the whole table is still to choose",
    );
    const soloWipedFrame = await soloWiped;
    check(
      soloWipedFrame !== null && closedAtJoin === 1 && soloClosed === 2,
      "and a harbor wiped while that draft is being read tells the seat holding the cards, once, that there is no draft, which is the frame the client puts the table away on: the only other time that seat heard it was walking in before the voyage had dealt anything",
    );

    // ---- the record the draft leaves behind ----
    // The telemetry spine's two D7 numbers, read off the row the draft
    // room's own wipe writes rather than off the frames above: the path each
    // captain took up and the seconds that captain's interface took. A
    // record is written when a voyage closes, so the room is wiped here,
    // and that is a reading of its own: the wipe must not be able to drop
    // what the draft measured before it.
    const draftWiped = waitForEvent<{ roomId?: string }>(
      draftSeats[0]!.socket,
      "room:restarted",
      (payload) => payload?.roomId === draftRoomId,
      8000,
    );
    draftSeats[0]!.socket.emit("room:restart", { roomId: draftRoomId });
    check(
      (await draftWiped) !== null,
      "the draft's own harbor is wiped once its work is done",
    );
    const draftRecord = (await telWaitForOne(draftRoomId))?.record ?? null;
    const draftTaken = (draftRecord?.events ?? []).filter(
      (event) => event.name === "path_taken",
    );
    const draftSwitched = (draftRecord?.events ?? []).filter(
      (event) => event.name === "path_switched",
    );
    const takenBy = (actor: string) =>
      draftTaken.find((event) => event.actor === actor)?.path ?? null;
    check(
      draftRecord !== null &&
        draftRecord.outcome === "restarted" &&
        draftTaken.length === 2 &&
        draftTaken.every(
          (event) =>
            event.seconds >= 0 &&
            [hostPath, matePath].some((path) => path === event.path) &&
            [draftHost.id, draftMate.id].some((id) => id === event.actor),
        ) &&
        takenBy(draftHost.id) === hostPath &&
        takenBy(draftMate.id) === matePath,
      "the draft is measured per captain per seat: the path each of them took up, filed against the captain who kept it and not against their neighbor, and the seconds that captain's own interface took, which is the number the plan's target of forty five is read against",
    );
    check(
      draftSwitched.length === 1 &&
        draftSwitched[0]?.actor === draftHost.id &&
        draftSwitched[0]?.path === otherPath &&
        draftSwitched[0]?.leg === switchLegRound &&
        // The voyage went on to the leg the room was parked on last, so the
        // leg above is the leg the papers were changed on rather than the
        // leg the record happens to have ended on.
        draftRecord?.endedAtLeg === PATH_SWITCH_TO_ROUND + 1,
      "and the one change of papers a voyage allowed is filed beside it with the leg it happened on, so a reader can tell a table that switched from one that never did",
    );

    // The house rule, over the copy this feature added. Every sentence a
    // captain reads in this feature is written in one of these files: the
    // rule module carries the ledger's own lines, the engine carries the
    // refusals the panel prints, the room module carries the sentences a
    // refused request is answered with, the hook carries none and the two
    // components carry the faces of the beats. The two components are swept
    // whole, unlike the borrow's board, because they read no colour through
    // a CSS custom property: their classes are Tailwind's and carry no
    // doubled hyphen.
    check(
      !carriesADash("src/lib/game/draft.ts") &&
        !carriesADash("src/lib/game/engine/draft.ts") &&
        !carriesADash("src/server/realtime/draft.ts") &&
        !carriesADash("src/lib/use-path-draft.ts") &&
        !carriesADash("src/components/portmasters/game/PathDraft.tsx") &&
        !carriesADash("src/components/portmasters/game/PathPanel.tsx"),
      "every file the draft's and the switch's copy lives in reads free of en dashes, em dashes and doubled hyphens, which is the house rule for every string a captain reads",
    );

    console.log("\nSigning out");
    const out = await call<{ ok: boolean }>("/api/auth/logout", {
      method: "POST",
      cookie: run.guest.cookie,
    });
    check(out.status === 200, "sign out succeeds");
    const afterOut = await call<{ user: unknown }>("/api/auth/me", {
      cookie: run.guest.cookie,
    });
    check(
      afterOut.body?.user === null,
      "the session is gone after signing out",
    );
  } finally {
    for (const socket of run.sockets) {
      socket.removeAllListeners();
      socket.close();
    }

    const ids = [
      run.host?.id,
      run.guest?.id,
      run.third?.id,
      ...run.extraAccounts.map((c) => c.id),
    ].filter((id): id is string => Boolean(id));
    const usernames = [
      run.host?.username,
      run.guest?.username,
      run.third?.username,
      ...run.extraAccounts.map((c) => c.username),
    ].filter((name): name is string => Boolean(name));

    if (run.cleanupIsSafe) {
      try {
        // Order matters: the harbors go first so their memberships are
        // gone before the accounts those memberships point at.
        //
        // Only harbors this run created are deleted. A Quick Start can
        // legitimately seat the two test captains into a harbor that was
        // already open, and that harbor belongs to whoever opened it.
        for (const id of [
          run.roomId,
          run.quickStartRoomId,
          ...run.lapRoomIds,
        ]) {
          if (id && !preExistingRoomIds.has(id)) {
            await db.room.deleteMany({ where: { id } });
          }
        }
        if (ids.length) {
          await db.session.deleteMany({ where: { userId: { in: ids } } });
          await db.user.deleteMany({ where: { id: { in: ids } } });
        }
        // The telemetry rows and the report rows are the two things a
        // deleted harbor does not take with it, and deliberately so: both
        // models carry a bare roomId rather than a foreign key, because
        // both have to outlive the room they describe. The two deletes
        // above have just removed every harbor this run created, so the
        // rows left pointing at a harbor that no longer exists are this
        // run's, and the database is put back the way it was found.
        const roomsLeft = await db.room.findMany({ select: { id: true } });
        const orphaned = roomsLeft.length
          ? {
              where: {
                roomId: { notIn: roomsLeft.map((room) => room.id) },
              },
            }
          : undefined;
        await db.voyageTelemetry.deleteMany(orphaned);
        await db.report.deleteMany(orphaned);
      } catch (err) {
        // Reported, never swallowed: an unnoticed leftover account is
        // exactly what this block exists to prevent.
        console.error("Could not clean up the accounts this run created.", err);
        failures.push("the run's own accounts were left behind");
      }
    } else if (usernames.length) {
      console.error(
        `Left behind on the server: ${usernames.join(", ")}. ` +
          `Delete them from the database the server is using.`,
      );
    }

    await db.$disconnect();
  }

  if (failures.length) {
    console.log(`\n${failures.length} check(s) failed.\n`);
    process.exit(1);
  }
  console.log("\nAll checks passed.\n");
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("\nThe smoke test could not finish.", err);
  process.exit(1);
});
