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
import { loadServerConfig } from "@/lib/config";
import { db } from "@/lib/db";
import {
  FLEXIBLE_BARTER_UNLOCK_LEVEL,
  MODULES,
  PORTS_TIER2,
  PRODUCTS_TIER0,
  RESOURCES_TIER0,
  STARTING_STOCK,
  guideText,
  tipsText,
  tutorialSteps,
} from "@/lib/game/constants";
import {
  allyFor,
  dealCards,
  dealRoles,
  flourishById,
  flourishDeck,
  flourishLine,
  roleCard,
  variableCount,
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
import { lapPhases } from "@/lib/game/checkpoint";
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
  type GameState,
  type OrderFill,
} from "@/lib/game/types";
import type {
  AuditReveal,
  MaroonResult,
  PortShiftNotice,
} from "@/types/realtime";
import {
  acceptBarterOffer,
  applyPortShift,
  failSeat,
  handleModuleSelect,
  maroonSeat,
  postBarterOffer,
  refundBarterOffer,
  settleBarterTrade,
  snapToCheckpoint,
} from "@/lib/game/engine";
import { BANNED_ACCOUNT_ERROR } from "@/lib/auth";
import { SOCKET_PATH } from "@/lib/realtime-endpoint";
import { readFileSync } from "node:fs";
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
 * The private information sections used to look for the one Variable's
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

  let host: Captain | null = null;
  let guest: Captain | null = null;
  let third: Captain | null = null;
  // Accounts this run creates that belong to no harbor, so there is
  // nothing to tear down for them but the accounts themselves. The
  // messages they send each other cascade away with them.
  const extraAccounts: Captain[] = [];
  let roomId: string | null = null;
  let quickStartRoomId: string | null = null;
  const sockets: Socket[] = [];

  // Every harbor that already exists before this run starts. Cleanup only
  // ever deletes a room this run created, so a Quick Start that seats the
  // test captains into somebody's real open harbor cannot take that harbor
  // down with it.
  const preExistingRoomIds = new Set(
    (await db.room.findMany({ select: { id: true } })).map((r) => r.id),
  );
  // Only armed once the first account has been proven visible to this
  // process's database connection. Until then, nothing is deleted.
  let cleanupIsSafe = false;

  try {
    console.log("Accounts");
    host = await signUp("host");

    // Safety interlock. The account was just written through the API; if
    // this connection cannot see it, the server and this script are on
    // different databases and the cleanup below would silently do
    // nothing. Stop now, before a second account and a room exist.
    const visible = await db.user.findUnique({
      where: { username: host.username },
      select: { id: true },
    });
    if (!visible || visible.id !== host.id) {
      throw new Error(
        `The server at ${BASE} is writing to a different database than this script reads.\n` +
          `This script resolves DATABASE_URL from this project's .env, so start the server the same way,\n` +
          `or export DATABASE_URL first. Nothing has been deleted.`,
      );
    }
    cleanupIsSafe = true;

    guest = await signUp("guest");
    check(Boolean(host.token), "the host receives a session token");
    check(Boolean(guest.token), "the guest receives a session token");

    console.log("\nThe signed in captain");
    const me = await call<{ user: { id: string } | null }>("/api/auth/me", {
      cookie: host.cookie,
    });
    check(me.status === 200, "GET /api/auth/me answers");
    check(
      me.body?.user?.id === host.id,
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
    extraAccounts.push(ashore, quay);
    const ashoreSocket = await openAuthedSocket(ashore);
    const quaySocket = await openAuthedSocket(quay);
    sockets.push(ashoreSocket, quaySocket);

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
        cookie: host.cookie,
        body: JSON.stringify({
          name: `Smoke harbor ${suffix}`,
          isPublic: false,
        }),
      },
    );
    check(created.status === 200, "the host can create a room");
    if (created.status !== 200) throw new Error("No room, stopping here.");
    roomId = created.body.room.id;
    const code = created.body.room.code;

    const joined = await call<{ room: { id: string } }>("/api/rooms/join", {
      method: "POST",
      cookie: guest.cookie,
      body: JSON.stringify({ code }),
    });
    check(joined.status === 200, "the guest can join with the room code");

    const detail = await call<{
      room: {
        memberCount: number;
        members: Array<{ username: string }>;
        host: { id: string };
      };
    }>(`/api/rooms/${roomId}`, { cookie: host.cookie });
    check(
      detail.body?.room?.memberCount === 2,
      "the harbor reads back two members",
    );
    check(
      detail.body?.room?.host?.id === host.id,
      "the host is recorded as the host",
    );

    console.log("\nThe realtime channel");
    const hostSocket = await openAuthedSocket(host);
    sockets.push(hostSocket);
    check(hostSocket.connected, "the host socket is connected on the app port");

    const guestSocket = await openAuthedSocket(guest);
    sockets.push(guestSocket);
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
    check(online.includes(host.username), "presence reports the host online");
    check(online.includes(guest.username), "presence reports the guest online");

    console.log("\nSeeing each other's live data");
    const hostId = host.id;
    const guestToken = guest.token;

    // Both captains take a seat in the harbor's socket channel. The
    // server only relays room traffic to sockets that have joined one.
    const joinedHost = waitForEvent(hostSocket, "room:members");
    const joinedGuest = waitForEvent(guestSocket, "room:members");
    hostSocket.emit("room:join", { roomId });
    guestSocket.emit("room:join", { roomId });
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
      phaseLabel: string;
      gold: number;
      reputation: number;
      shipLevel: number;
      renownLevel?: number;
    }>(guestSocket, "game:status", (payload) => payload?.user?.id === hostId);

    hostSocket.emit("game:status", {
      roomId,
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
    check(status?.phaseLabel === "Purchase", "the phase label travels intact");
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
    const askerId = guest.id;
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
    guestSocket.emit("player:detail:request", { roomId, targetUserId: hostId });
    await new Promise((resolve) => setTimeout(resolve, 400));
    check(
      detailQuestions.some((question) => question.requesterId === askerId),
      "a captain asking for another captain's detail is relayed to that captain, labelled with the asker",
    );
    hostSocket.emit("player:detail:response", {
      roomId,
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
      roomId,
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
    guestSocket.emit("player:detail:request", { roomId, targetUserId: hostId });
    await new Promise((resolve) => setTimeout(resolve, 400));
    guestSocket.emit("room:leave", { roomId });
    await new Promise((resolve) => setTimeout(resolve, 400));
    hostSocket.emit("player:detail:response", {
      roomId,
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
        payload?.roomId === roomId &&
        payload.members.some((member) => member.id === askerId),
    );
    guestSocket.emit("room:join", { roomId });
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
      extraHeaders: { Cookie: guest.cookie },
      reconnection: false,
    });
    sockets.push(guestReloadSocket);
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
    guestReloadSocket.emit("room:join", { roomId });
    const hydratedStatus = await hydrated;
    check(
      hydratedStatus?.gold === 777,
      "a captain who reloads is hydrated with the last known status",
    );

    console.log("\nRecovering a session after a reload");
    const active = await call<{ room: { id: string } | null }>(
      "/api/rooms/active",
      {
        cookie: guest.cookie,
      },
    );
    check(
      active.body?.room?.id === roomId,
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
    quickStartRoomId = hostMatch?.roomId ?? guestMatch?.roomId ?? null;

    const quickRoom = quickStartRoomId
      ? await db.room.findUnique({
          where: { id: quickStartRoomId },
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
    third = await signUp("third");
    const thirdJoined = await call<{ room: { id: string } }>(
      "/api/rooms/join",
      {
        method: "POST",
        cookie: third.cookie,
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
    hostSocket.emit("chat:room", { roomId, content: harborLine });
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
    hostSocket.emit("chat:dm", { recipientId: guest.id, content: dmLine });
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
    const storedForRoom = await db.message.count({ where: { roomId } });
    check(
      storedForRoom === 0,
      "nothing said in the session was written against the room",
    );
    const storedBetween = await db.message.count({
      where: {
        OR: [
          { senderId: host.id, recipientId: guest.id },
          { senderId: guest.id, recipientId: host.id },
        ],
      },
    });
    check(
      storedBetween === 0,
      "and the private thread between the two was not written either",
    );

    const reloaded = await openAuthedSocket(guest);
    sockets.push(reloaded);
    const reloadedHistory = waitForEvent<WireHistory>(
      reloaded,
      "chat:history",
      (payload) => payload?.roomId === roomId,
    );
    reloaded.emit("room:join", { roomId });
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

    const thirdSocket = await openAuthedSocket(third);
    sockets.push(thirdSocket);
    const thirdHistory = waitForEvent<WireHistory>(
      thirdSocket,
      "chat:history",
      (payload) => payload?.roomId === roomId,
    );
    thirdSocket.emit("room:join", { roomId });
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
      roomId,
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
    // Bartering phase, which is the one time that board is on screen.
    // That check is what stops a chat composer claiming to be the
    // exchange board to slip past the gate above, and it is why the claim
    // is pinned here rather than taken on faith.
    const exchangeRefusal = waitForEvent<{ error?: string }>(
      hostSocket,
      "barter:error",
      (payload) => Boolean(payload?.error),
    );
    hostSocket.emit("barter:post", {
      roomId,
      offerItem: "Hemp",
      offerAmount: 1,
      requestItem: "Gold",
      requestAmount: 1,
      flexible: false,
    });
    const refusedOutsidePhase = await exchangeRefusal;
    check(
      refusedOutsidePhase !== null,
      "an exchange offer cannot be posted outside the Bartering phase",
    );
    check(
      Boolean(refusedOutsidePhase?.error?.includes("Bartering phase")),
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
    await seedRenown(guest.id);
    await seedRenown(third!.id);
    // Both of the other two are read by name inside the event callbacks
    // below, and a callback can run at any point after the captain it
    // names was assigned, so neither is narrowed by the time one does.
    const guestId = guest.id;
    const thirdId = third!.id;

    // The chat composer's board, which is the flexible one: no phase has
    // been started, and the offer still posts, shows and closes exactly
    // as it would mid voyage.
    const boardAfterPost = waitForEvent<{ offers: WireOffer[] }>(
      hostSocket,
      "barter:update",
      (payload) => (payload?.offers ?? []).some((o) => o.fromUserId === hostId),
    );
    hostSocket.emit("barter:post", {
      roomId,
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
      roomId,
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
      roomId,
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
      roomId,
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
    guestSocket.emit("barter:state:request", { roomId });
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
    guestSocket.emit("barter:accept", { roomId, offerId: posted?.id });
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
    hostSocket.emit("barter:accept", { roomId, offerId: guestPosted?.id });
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
      roomId,
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
    guestSocket.emit("barter:accept", { roomId, offerId: thirdPosted?.id });
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
      `/api/rooms/${roomId}/leave`,
      { method: "POST", cookie: third.cookie },
    );
    check(thirdLeft.status === 200, "the third captain can leave the harbor");

    console.log("\nThe Captain's Exchange in its own phase");
    // The other surface, and the one nothing is asked of. This captain is
    // dropped back to level one first, so a working exchange cannot be
    // Renown doing the work: the same account is refused the flexible
    // offer below at exactly the level the exchange is served at.
    await db.captainLegacy.update({
      where: { userId: guest.id },
      data: { renownLevel: 1, renownXP: 0 },
    });
    // The exchange only opens while the room is actually in the
    // Bartering phase, and the checkpoint only follows a report from a
    // voyage that has set sail, so both of those have to happen before
    // the board will take one.
    hostSocket.emit("room:start", { roomId });
    await new Promise((resolve) => setTimeout(resolve, 500));
    hostSocket.emit("game:status", {
      roomId,
      round: 1,
      phase: "barter",
      phaseLabel: "Bartering",
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
      roomId,
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
      roomId,
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
      roomId,
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
      (payload) => payload?.roomId === roomId,
    );
    const clearedAtGuest = waitForEvent<{ roomId: string }>(
      guestSocket,
      "chat:cleared",
      (payload) => payload?.roomId === roomId,
    );
    hostSocket.emit("room:restart", { roomId });
    check(
      (await clearedAtHost) !== null,
      "restarting the voyage tells the room its conversation is gone",
    );
    check(
      (await clearedAtGuest) !== null,
      "and tells every captain in it the same",
    );

    const afterTheWipe = await openAuthedSocket(guest);
    sockets.push(afterTheWipe);
    const wipedHistory = waitForEvent<WireHistory>(
      afterTheWipe,
      "chat:history",
      (payload) => payload?.roomId === roomId,
    );
    afterTheWipe.emit("room:join", { roomId });
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
    if (wrongCode.captain) extraAccounts.push(wrongCode.captain);

    const made = await registerOperator("keeper", setupCode);
    check(made.status === 200, "the setup code admits an operator account");
    check(
      made.role === "admin",
      "and the account it makes is an administrator",
    );
    if (!made.captain) throw new Error("No operator account, stopping here.");
    const operator = made.captain;
    extraAccounts.push(operator);
    const operatorSocket = await openAuthedSocket(operator);
    sockets.push(operatorSocket);

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
      accountIn(roster, host.id)?.username === host.username,
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
    operatorSocket.emit("admin:ban", { userId: guest.id });
    check(
      (await toldTheBanned) !== null,
      "a banned captain's socket is told why it is being closed",
    );
    check((await bannedSocketClosed) !== null, "and is closed");
    check(
      accountIn(await afterBan, guest.id)?.bannedAt != null,
      "the roster shows the account banned",
    );
    const noLongerSignedIn = await call<{ user: unknown }>("/api/auth/me", {
      cookie: guest.cookie,
    });
    check(
      noLongerSignedIn.body?.user === null,
      "the ban took the session the account already had",
    );
    const bannedLogin = await call<{ error: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: guest.username, password }),
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
    operatorSocket.emit("admin:unban", { userId: guest.id });
    check(
      accountIn(await afterUnban, guest.id)?.bannedAt === null,
      "unbanning clears the ban",
    );
    // The signed in session has to come back too, and the smoke run needs
    // one for the sign out check at the end, so the fresh session is kept.
    const signedBackIn = await signInAgain(guest.username);
    check(signedBackIn !== null, "and the captain can sign in again");
    if (signedBackIn) {
      guest.cookie = signedBackIn.cookie;
      guest.token = signedBackIn.token;
    }

    const afterGrant = waitForEvent<WireRoster>(
      operatorSocket,
      "admin:accounts",
    );
    operatorSocket.emit("admin:grant", { userId: host.id });
    check(
      accountIn(await afterGrant, host.id)?.role === "admin",
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
    operatorSocket.emit("admin:revoke", { userId: host.id });
    check(
      accountIn(await afterRevoke, host.id)?.role === "captain",
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
    extraAccounts.push(doomed, crew);
    const doomedSocket = await openAuthedSocket(doomed);
    const crewSocket = await openAuthedSocket(crew);
    sockets.push(doomedSocket, crewSocket);

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
    extraAccounts.push(crowdA, crowdB, outcast);

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
    operatorSocket.emit("admin:bulk", { action: "unban", userIds: [host.id] });
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
    // plan's: four or five captains deal one Variable, six deal two, and
    // a larger harbor is capped rather than dealt a third.
    const rosterOf = (n: number) =>
      Array.from({ length: n }, (_, i) => `captain-${i}`);
    check(
      variableCount(3) === 0,
      "a three captain table is dealt no Variable at all",
    );
    check(
      variableCount(4) === 1 && variableCount(5) === 1,
      "four and five captains yield one",
    );
    check(variableCount(6) === 2, "six captains yield two");
    check(
      variableCount(9) === 2,
      "and a larger harbor is capped at two rather than dealt a third",
    );

    const seed = "a-seed-of-its-own";
    const drawn = dealRoles(rosterOf(6), seed);
    const variables = Object.values(drawn).filter((role) => role !== "honest");
    check(
      variables.length === 2 && variables.includes("pirate"),
      "a six captain draw holds two Variables, one of them a Pirate",
    );
    check(
      variables.filter((role) => role === "broker").length <= 1,
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
      "every Honest card carries a flourish off its own commission's deck, and no Variable card carries one",
    );

    // The Pirate pair. A seed where the second Variable came up Pirate is
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

    // The lone Pirate: the only Variable a four captain table deals, with
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
    extraAccounts.push(gambitHost, gambitSecond, gambitThird, gambitFourth);
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
      sockets.push(socket);
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
      "the harbor holds exactly one Variable at four captains",
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
    // socket at all: one Variable is no pair, and nobody at this table
    // has a partner to be told about.
    check(
      seated.every((seat) =>
        seat.frames.every((frame) => !frame.text.includes('"ally"')),
      ),
      "and no socket at a one Variable table carries an ally field",
    );

    // A reload is a captain asking for the card they already hold. The
    // row is read back rather than drawn again, which is what keeps a
    // refresh from moving every card at the table.
    const rejoining = await openAuthedSocket(gambitSecond);
    sockets.push(rejoining);
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
    extraAccounts.push(gambitFifth, gambitSixth);
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
      variableCount(pairedCrew.length) === 2,
      "which is the one table size the mode deals two Variables to",
    );

    const pairedSeats: Array<{
      captain: Captain;
      socket: Socket;
      frames: Frame[];
    }> = [];
    for (const captain of pairedCrew) {
      const socket = await openAuthedSocket(captain);
      sockets.push(socket);
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
    sockets.push(pairedReload);
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
    // from the side it can be held from. A line is prose, and it names its
    // own legs, so what can be checked is its arithmetic. A chart is data,
    // and every leg names the checkpoint it is, so what can be checked is
    // that the legs are the mode's own lap.

    // The house rule for every string a mode hands a captain, read with the
    // one rule a regex can hold this file to.
    const modeCopy = MODE_ORDER.flatMap((mode) => {
      const { badge, tagline, summary, briefing } = MODES[mode];
      return [
        badge,
        tagline,
        summary,
        ...(briefing.kind === "line"
          ? [briefing.text]
          : [
              ...briefing.legs.flatMap((leg) => [
                leg.icon,
                leg.gradient,
                leg.label,
                leg.body,
                leg.setsUp,
              ]),
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

    // Where a mode's briefing puts a thing, as the words it prints for its
    // own legs. A line is split on its own arrow; a chart is its leg order.
    // Both are the mode saying this comes before that, which is the claim
    // the checks further down hold it to.
    const briefingOrder = (mode: GameMode): string[] => {
      const { briefing } = MODES[mode];
      return briefing.kind === "line"
        ? briefing.text.split("→").map((step) => step.trim())
        : briefing.legs.map((leg) => leg.label);
    };

    // A line's own arithmetic, which is the check the old one would have
    // failed: one number per leg, running from one, with no gap, no repeat
    // and nothing left unnumbered.
    for (const mode of MODE_ORDER) {
      const { briefing } = MODES[mode];
      if (briefing.kind !== "line") continue;
      const steps = briefing.text.split("→").map((step) => step.trim());
      const counted = steps.map((_, index) => String(index + 1)).join("");
      check(
        steps.map((step) => step[0] ?? "").join("") === counted,
        `the ${MODES[mode].badge} briefing numbers every leg it lists, once each and in order`,
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
      const lap = lapPhases(mode).filter((phase) => phase !== "0");
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
      const ordersFirstOnTheLap = lap.indexOf("2") < lap.indexOf("barter");
      const words = briefingOrder(mode).join(" ");
      check(
        words.includes("Barter") &&
          words.includes("Trade Orders") &&
          ordersFirstOnTheLap ===
            words.indexOf("Trade Orders") < words.indexOf("Barter"),
        `the ${MODES[mode].badge} briefing runs its manifest and its table in the order its lap does`,
      );
    }

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
    sockets.push(lateArrival);
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
      sockets.push(socket);
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
      sockets.push(socket);
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
      sockets.push(socket);
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
      phase: "barter",
      phaseLabel: "Bartering",
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
        auditCheckpoint?.currentPhase !== "barter") &&
      waited < 5000;
      waited += 250
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      auditCheckpoint = await auditRoomRow();
    }
    check(
      auditCheckpoint?.currentRound === AUDIT_FROM_ROUND &&
        auditCheckpoint?.currentPhase === "barter",
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
      "larder",
      "inventory",
      "money",
      "score",
    ];
    check(
      auditForbidden.every((word) => !auditBody.includes(word)),
      "the reveal carries no alignment, no card, no Gold and no hold, word for word",
    );
    const auditRevealFrame = revealFrames[0]?.reveal;
    check(
      Object.keys(auditRevealFrame ?? {})
        .sort()
        .join(",") === "fulfillments,roomId,round,target" &&
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
        phase: "barter",
      });
    }
    const auditLeft = await Promise.all(auditAdvances);
    check(
      auditLeft.every(
        (frame) =>
          frame?.round === AUDIT_FROM_ROUND && frame?.phase === "barter",
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
    sockets.push(auditReloadSocket);
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
        auditReopened?.currentPhase !== "0") &&
      waited < 5000;
      waited += 250
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      auditReopened = await auditRoomRow();
    }
    check(
      auditReopened?.currentRound === 1 && auditReopened?.currentPhase === "0",
      "restarting the voyage reopens the harbor at its first checkpoint",
    );
    // The captain asking is one of the harbor's own, so the absence below
    // is the hand-out declining rather than the server refusing a stranger
    // the door: a captain who is not a member is turned away before any of
    // this and would prove nothing about the reveal.
    const auditRejoin = await openAuthedSocket(gambitFifth);
    sockets.push(auditRejoin);
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
      sockets.push(socket);
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
    const parkMaroonCheckpoint = async (
      round: number,
      phase: string,
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

    const beforeTheRung = await parkMaroonCheckpoint(8, "barter", "Bartering");
    check(
      beforeTheRung?.currentRound === 8 &&
        beforeTheRung?.currentPhase === "barter",
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

    const atTheRung = await parkMaroonCheckpoint(9, "barter", "Bartering");
    check(
      atTheRung?.currentRound === 9 && atTheRung?.currentPhase === "barter",
      "the room's checkpoint is at leg nine's Parley, which is where the vote is called from",
    );

    // The captain the harbor has already written off. The mark travels the
    // way every other fact about a seat travels, on a status, and it stays
    // in the roster: a bankrupt captain still holds a card, which is what
    // makes the arithmetic below a count of six.
    maroonSockets[5].emit("game:status", {
      roomId: maroonRoomId,
      round: 9,
      phase: "barter",
      phaseLabel: "Bartering",
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
      targetUserId: guest.id,
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
    const maroonReadyAll = (round: number, phase: string) => {
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

    const beforeTheMarket = await parkMaroonCheckpoint(
      10,
      "5",
      "Drafting Boon",
    );
    check(
      beforeTheMarket?.currentRound === 10 &&
        beforeTheMarket?.currentPhase === "5",
      "the next checkpoint the room reaches is leg ten's boon draft, which is the step that opens its market",
    );
    const marketAdvance = nextMaroonAdvance(10);
    maroonReadyAll(10, "5");
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

    const afterTheMarket = await parkMaroonCheckpoint(11, "5", "Drafting Boon");
    const clearAdvance = nextMaroonAdvance(11);
    maroonReadyAll(11, "5");
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
    sockets.push(maroonReload);
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
    const nextParley = await parkMaroonCheckpoint(11, "barter", "Bartering");
    check(
      nextParley?.currentRound === 11 && nextParley?.currentPhase === "barter",
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
    const closingLeg = await parkMaroonCheckpoint(16, "barter", "Bartering");
    check(
      closingLeg?.currentRound === 16 && closingLeg?.currentPhase === "barter",
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
        maroonReopened?.currentPhase !== "0") &&
      waited < 5000;
      waited += 250
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      maroonReopened = await maroonRoomRow();
    }
    check(
      maroonReopened?.currentRound === 1 &&
        maroonReopened?.currentPhase === "0",
      "restarting the voyage reopens the harbor at its first checkpoint",
    );
    const maroonRejoin = await openAuthedSocket(gambitFifth);
    sockets.push(maroonRejoin);
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
    extraAccounts.push(...revCrew);

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
      sockets.push(socket);
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
    sockets.push(revRejoin);
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
      sockets.push(socket);
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
    extraAccounts.push(unlHome, unlNew, unlFake);
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
      sockets.push(socket);
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
    sockets.push(unlGateSocket);
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
        telReadBack.captains[0]?.peerTradeProfit === 1234 &&
        telReadBack.events.length === 1,
      "and a record read back out of stored JSON keeps its header, its captains, the maroon and the peer ledger their lines carry, and its events",
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
    // The same two fields on their way back out of stored JSON, in the two
    // shapes a reader can meet: a line an older build wrote, which carries
    // neither, and a line whose values are not the shapes this build
    // writes. Both read as the absence rather than as a hole, which is what
    // lets a reader pass over a line without special casing it.
    const telOlderLines = normalizeRecord({
      voyageId: telVoyage,
      captains: [
        { userId: "captain-a", presentAtEnd: true },
        {
          userId: "captain-b",
          presentAtEnd: false,
          marooned: "yes",
          peerTradeProfit: Number.NaN,
        },
      ],
    });
    check(
      telOlderLines !== null &&
        telOlderLines.captains.length === 2 &&
        telOlderLines.captains[0]?.marooned === false &&
        telOlderLines.captains[0]?.peerTradeProfit === 0 &&
        telOlderLines.captains[1]?.marooned === false &&
        telOlderLines.captains[1]?.peerTradeProfit === 0,
      "and a captain line written before the voyage recorded either reads as a captain the harbor did not put ashore and who took nothing in trade, rather than as a line a reader has to guard",
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
    extraAccounts.push(telHome, telMate, telCast, telDrift, telWipe);

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
        sockets.push(socket);
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
      phase: string,
    ): Promise<void> => {
      socket.emit("game:status", {
        roomId,
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
        where: { roomId },
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
    await telStand(sailHome, sailRoomId, 1, "barter");

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
    ) =>
      socket.emit("telemetry:leg", {
        roomId: sailRoomId,
        leg,
        ordersDealt,
        ordersFilled,
        distinctGoods,
      });
    telLegReport(sailHome, 1, 3, 1, 2);
    // The same captain, the same leg, reporting again after filling another
    // order: the last report for a leg is the one kept, so this is the pair
    // of figures the record has to close with.
    telLegReport(sailHome, 1, 4, 2, 3);
    telLegReport(sailMate, 1, 2, 2, 1);
    // Two claims outside the voyage's reach, which the spine refuses rather
    // than keeping: a leg it never got to, and a leg that does not exist at
    // all. Both are filed about a captain who never filed a report of their
    // own, so a refusal is the only way either could appear.
    telLegReport(sailCast, 99, 1, 1, 1);
    telLegReport(sailCast, 0, 1, 1, 1);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // The bartering phase ends and the standing offer goes back to its
    // poster, which is the expired line.
    await telStand(sailHome, sailRoomId, 1, "worker_mgmt");
    await telStand(sailHome, sailRoomId, 2, "barter");
    // And a report filed one leg ahead of the harbor, which is the one leg
    // of slack the spine allows: a captain who has just finished counting a
    // leg is routinely ahead of a checkpoint that only moves when somebody
    // says they are standing at it. The same claim filed while the voyage
    // was still on leg one was refused, which is where the slack stops.
    telLegReport(sailMate, 3, 5, 0, 4);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // ---- the two votes, at their own rungs ----
    // Two of three carries both, and the record keeps the nominations and
    // the harbor's answer separately: the first is usage and the second is
    // the outcome.
    await telStand(sailHome, sailRoomId, 5, "barter");
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

    await telStand(sailHome, sailRoomId, 9, "barter");
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
    await telStand(driftSolo, driftRoom.roomId, 2, "barter");
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
    await telStand(wipeSolo, wipeRoom.roomId, 2, "barter");
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
      roomId,
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
    // One captain's line, with the two fields goal I2 added read as the
    // ordinary case unless a fixture says otherwise: a captain who was
    // still in the harbor when the voyage closed, who was not put ashore,
    // and who took nothing in trade.
    const dashLine = (
      userId: string,
      over: Partial<TelemetryRecord["captains"][number]> = {},
    ): TelemetryRecord["captains"][number] => ({
      userId,
      presentAtEnd: true,
      marooned: false,
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
        cookie: host.cookie,
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
        "0 of 16 gates inside their bands, 0 out of band, 10 with no source, 6 with no voyage to read.",
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

    // A single gate waiting on a voyage, over a window whose other fifteen
    // are read: the sentence has to say one gate rather than sixteen,
    // because a reader on balance duty should not have to work out which it
    // is talking about. The one waiting here is retention, since the
    // voyage in the window had nobody put ashore.
    const oneUnplayed = readLaunchVerdict(
      readDashboard({
        records: [dashRecord("dash-lone")],
        outcomes: inBandOutcomes,
        unreadable: 0,
      }),
    );
    check(
      oneUnplayed.unplayed.length === 1 &&
        oneUnplayed.gaps.some((gap) =>
          gap.includes("1 of the 16 gates has no voyage to read"),
        ),
      "and a single gate waiting on a voyage is described in the singular, since one gate and sixteen are not the same finding",
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
    // Variable into, so the last fixture is the plan's "four has to be
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
      createInitialGameState({ mode: "ocean_gambit", difficulty: "fair_winds" })
        .maxRounds === 12 &&
        createInitialGameState({ mode: "ocean_gambit", difficulty: "monsoon" })
          .maxRounds === 12 &&
        createInitialGameState({ mode: "classic", difficulty: "fair_winds" })
          .maxRounds === 8,
      "a Gambit voyage is handed twelve legs whatever tier it is charted at, while the founding voyage still sails its tier's own ladder",
    );

    // The copy a captain reads. All three of these quoted the tier before
    // this feature, which was the same number as the voyage until a mode
    // could pin one, and the loan line's round is the voyage's last leg.
    check(
      guideText("ocean_gambit", "fair_winds").includes("Travel 12 voyages") &&
        tipsText("ocean_gambit", "fair_winds").includes("Round 12") &&
        tutorialSteps("ocean_gambit", "fair_winds")[0]?.content.includes(
          "12 voyages, limited gold",
        ) &&
        guideText("classic", "fair_winds").includes("Travel 8 voyages") &&
        tipsText("classic", "fair_winds").includes("Round 8"),
      "the guide, the advice and the tutorial quote the voyage's own length, so a twelve leg table is never briefed on the eight leg voyage its tier would have run",
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
    extraAccounts.push(sizeHome, sizeMate, sizeThird, sizeFourth);
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
      await telStand(sizeRoom.crewSockets[0], sizeRoomId, leg, "barter");
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

    console.log("\nSigning out");
    const out = await call<{ ok: boolean }>("/api/auth/logout", {
      method: "POST",
      cookie: guest.cookie,
    });
    check(out.status === 200, "sign out succeeds");
    const afterOut = await call<{ user: unknown }>("/api/auth/me", {
      cookie: guest.cookie,
    });
    check(
      afterOut.body?.user === null,
      "the session is gone after signing out",
    );
  } finally {
    for (const socket of sockets) {
      socket.removeAllListeners();
      socket.close();
    }

    const ids = [
      host?.id,
      guest?.id,
      third?.id,
      ...extraAccounts.map((c) => c.id),
    ].filter((id): id is string => Boolean(id));
    const usernames = [
      host?.username,
      guest?.username,
      third?.username,
      ...extraAccounts.map((c) => c.username),
    ].filter((name): name is string => Boolean(name));

    if (cleanupIsSafe) {
      try {
        // Order matters: the harbors go first so their memberships are
        // gone before the accounts those memberships point at.
        //
        // Only harbors this run created are deleted. A Quick Start can
        // legitimately seat the two test captains into a harbor that was
        // already open, and that harbor belongs to whoever opened it.
        for (const id of [roomId, quickStartRoomId]) {
          if (id && !preExistingRoomIds.has(id)) {
            await db.room.deleteMany({ where: { id } });
          }
        }
        if (ids.length) {
          await db.session.deleteMany({ where: { userId: { in: ids } } });
          await db.user.deleteMany({ where: { id: { in: ids } } });
        }
        // The telemetry rows are the one thing a deleted harbor does not
        // take with it, and deliberately so: the model carries no foreign
        // key, because a record has to outlive the room it describes. The
        // two deletes above have just removed every harbor this run
        // created, so the rows left pointing at a harbor that no longer
        // exists are this run's, and the database is put back the way it
        // was found.
        const roomsLeft = await db.room.findMany({ select: { id: true } });
        await db.voyageTelemetry.deleteMany(
          roomsLeft.length
            ? {
                where: {
                  roomId: { notIn: roomsLeft.map((room) => room.id) },
                },
              }
            : undefined,
        );
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
