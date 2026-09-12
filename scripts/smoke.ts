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

/** Registers a captain and keeps the token and cookie the app hands back. */
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
    // The board is not limited to the Bartering phase any more, so neither
    // is this: no phase is started, and the offer still posts, shows and
    // closes exactly as it would mid voyage.
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
    });
    const postedBoard = await boardAfterPost;
    const posted = postedBoard?.offers.find((o) => o.fromUserId === hostId);
    check(Boolean(posted), "an offer posts with no phase asked for");
    check(
      typeof posted?.createdAt === "string" && posted.createdAt.length > 0,
      "it carries the moment it was posted, so a chat can place it",
    );

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
    const offerLeftBoard = waitForEvent<{ offers: WireOffer[] }>(
      guestSocket,
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
    check(
      (await offerLeftBoard) !== null,
      "the settled offer leaves the board",
    );

    // A trade the poster can never be told about is refused rather than
    // completed, because their side of it releases escrow when it sees the
    // offer go and would hand the goods back as well as to the taker.
    const thirdBoard = waitForEvent<{ offers: WireOffer[] }>(
      thirdSocket,
      "barter:update",
      (payload) =>
        (payload?.offers ?? []).some((o) => o.fromUserId === third!.id),
    );
    thirdSocket.emit("barter:post", {
      roomId,
      offerItem: "Hemp",
      offerAmount: 1,
      requestItem: "Gold",
      requestAmount: 1,
    });
    const strandedBoard = await thirdBoard;
    const stranded = strandedBoard?.offers.find(
      (o) => o.fromUserId === third!.id,
    );
    check(Boolean(stranded), "a third captain can post an offer of their own");

    thirdSocket.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const refused = waitForEvent<{ offerId?: string; reason?: string }>(
      guestSocket,
      "barter:accept:fail",
      (payload) => payload?.offerId === stranded?.id,
    );
    guestSocket.emit("barter:accept", { roomId, offerId: stranded?.id });
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
