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
  PRODUCTS_TIER0,
  RESOURCES_TIER0,
  STARTING_STOCK,
} from "@/lib/game/constants";
import { dealRoles, variableCount } from "@/lib/game/gambit";
import {
  OBJECTIVE_DECK,
  drawObjective,
  objectiveSeed,
  objectiveTotalItems,
} from "@/lib/game/objectives";
import { BANNED_ACCOUNT_ERROR } from "@/lib/auth";
import { SOCKET_PATH } from "@/lib/realtime-endpoint";
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
// field in the protocol that can name an alignment.
type WireDelivery = {
  roomId: string;
  entry: { kind: string; text: string; role?: string };
};

const failures: string[] = [];

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

    // Let the departure's broadcasts land before the frames are read
    // back, since the leak this is looking for would ride one of them.
    await new Promise((resolve) => setTimeout(resolve, 600));
    const secret = hidden[0]?.role ?? "pirate";
    const leaks: string[] = [];
    for (const seat of seated) {
      for (const frame of seat.frames) {
        if (!frame.text.includes(secret)) continue;
        // The only frame allowed to name it is the hidden captain's own
        // card. Everything else, on any socket, is the defect this
        // section exists to catch.
        const own =
          frame.event === "private:entry" &&
          seat.captain.id === hidden[0]?.userId;
        if (!own) {
          leaks.push(`${seat.captain.username} on ${frame.event}`);
        }
      }
    }
    check(
      leaks.length === 0,
      `no other captain's frames name the ${secret} anywhere in them`,
    );
    // The sweep above only means something if the word it looks for was
    // really on the wire, and on exactly one socket. Without this, a card
    // that never arrived at all would pass it as clean.
    check(
      seated.some(
        (seat) =>
          seat.captain.id === hidden[0]?.userId &&
          seat.frames.some((frame) => frame.text.includes(secret)),
      ),
      `and the ${secret}'s own socket does carry it, so the sweep had something to find`,
    );
    check(
      seated.every(
        (seat) =>
          seat.frames.filter((frame) => frame.event === "private:entry")
            .length === 1,
      ),
      "and every socket received exactly one private entry, its own",
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

    // Only a captain's newest socket may report a status, so each one is
    // sent from the socket the server considers current: the reloaded
    // socket for the second captain and the late arrival for the third,
    // not the seats they took first.
    const finishers = [
      { socket: seated[0].socket, captain: gambitHost },
      { socket: rejoining, captain: gambitSecond },
      { socket: lateArrival, captain: gambitThird },
      { socket: seated[3].socket, captain: gambitFourth },
    ];
    for (const finisher of finishers) {
      finisher.socket.emit("game:status", {
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
    await new Promise((resolve) => setTimeout(resolve, 1800));

    const chronicles = await db.voyageChronicle.findMany({
      where: { roomId: gambitRoomId },
      select: {
        userId: true,
        mode: true,
        objectiveId: true,
        objectiveMet: true,
        objectiveTrace: true,
      },
    });
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
