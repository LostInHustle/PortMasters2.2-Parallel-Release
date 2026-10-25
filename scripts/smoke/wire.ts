// =====================================================================
// PortMasters 2.2 Parallel Release: the wire shapes of the smoke suite.
//
// What the server answers with, as this suite reads it, and the three
// shared pieces the suites read it through.
// =====================================================================
import {
  LEDGER_PHRASE,
  call,
  openAuthedSocket,
  signUp,
  suffix,
  waitForEvent,
} from "./harness";
import type { SmokeRun } from "./run";
import type { Socket } from "socket.io-client";

// The member a test drives: the account it signs up, and the session the
// server hands back for it. Every suite that takes a captain takes one of
// these, and a suite that used to write the four fields out again was
// carrying a second copy of the shape the harness already mints.
export type Captain = {
  id: string;
  token: string;
  cookie: string;
  username: string;
};

// Just enough of each wire payload to make a claim about it. A message is
// named only by the fields the checks read, so an assertion here cannot
// quietly depend on something the server never promised.
export type WireMessage = {
  id: string;
  content: string;
  createdAt: string;
  mine?: boolean;
  sender: { id: string };
  recipient?: { id: string };
};

// What a joiner is handed on `chat:history`: the harbor's conversation and
// only those private threads this captain is part of.
export type WireHistory = {
  roomId: string;
  harbor: WireMessage[];
  direct: WireMessage[];
};

export type WireOffer = {
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
export type WireAccount = {
  id: string;
  username: string;
  role: string;
  bannedAt: string | null;
};

// The roster a console is handed, on admin:accounts.
export type WireRoster = { accounts: WireAccount[] };

// What a bulk action reports back on admin:bulk-result: how many accounts
// the request named, how many of them changed, and the reason for each one
// that did not.
export type WireBulkReport = {
  action: string;
  requested: number;
  applied: number;
  skipped: string[];
};

// One entry off the private channel, and the harbor it belongs to. role is
// present only when the entry is a dealt card, which is the one wire
// field in the protocol that can name an alignment. The other two fields
// are the ones a dealt card may also carry: the personal goal an Honest
// captain was dealt, and the one other Pirate a pair of them is told
// about. Both are absent on every entry that has nothing to say, which is
// why they are optional here rather than nullable.
export type WireDelivery = {
  roomId: string;
  entry: {
    kind: string;
    text: string;
    role?: string;
    flourish?: string;
    ally?: { userId: string; name: string };
  };
};

// One captain's card, face up, as
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

export type WireReveal = {
  roomId: string;
  objective: { id: string; name: string };
  fleetTrace: { round: number; delivered: Record<string, number> }[];
  captains: WireRevealed[];
};

// =====================================================================
// The shared pieces of a run.
//
// A beat's wait, and the market harbor the consent markets open between
// them. Both were written out again in every suite that needed them, and
// a copy of a timer is a place for a duration to drift.
// =====================================================================

/**
 * A beat's wait: the pause a suite takes after it has asked a harbor to
 * do something and before it reads the answer.
 *
 * One implementation for every suite that waits, rather than one per
 * suite, because the waits are not the same length and a copy of the
 * helper per suite is where that length goes to be edited. The length is
 * an argument rather than a second helper, so a suite that waits longer
 * than the others says so at the call site instead of carrying a second
 * copy of the same four words.
 */
export function settle(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A market harbor: the three captains at a table of their own, the sockets
 * they read their own board on, and the record of every row each of those
 * boards has carried.
 *
 * The four consent markets (the escort contract, the refit bench, the
 * bazaar rumor and the module trade) all sit at a table shaped like this
 * one, and the shape was written out four times. It is here so that the
 * four agree on what a market harbor is: the same three members, the same
 * room, the same way of sitting down, and the same record of what each
 * captain was told.
 */
type MarketHarbor = {
  // The room the server made, as the create call answered it.
  room: { id: string; code: string };
  // The harbor's id, which every frame and every emit below carries.
  roomId: string;
  // The three captains, in the order the suite named them.
  crew: Captain[];
  // One socket per captain, opened and seated in the harbor.
  sockets: Map<string, Socket>;
  // The socket a captain reads their own board on.
  socketOf: (captain: Captain) => Socket;
  // What the two join calls answered, so the suite can say whether the
  // table filled up.
  joins: { status: number }[];
  // Every row each captain's board has ever carried. This is the second
  // of the two things a privacy check needs: what a captain was told,
  // rather than what they happened to read last.
  seen: Map<string, Set<string>>;
};

/**
 * Adds the rows a board has just carried to that captain's record.
 *
 * The record is per captain rather than per board, because a board is
 * delivered per socket: one pass writes a frame on each captain's own
 * connection, so the rows two of them have seen are not the rows the
 * other happened to read last.
 */
export function rememberRows(
  seen: Map<string, Set<string>>,
  captainId: string,
  rowIds: readonly string[],
): void {
  const rows = seen.get(captainId) ?? new Set<string>();
  for (const id of rowIds) rows.add(id);
  seen.set(captainId, rows);
}

/**
 * Opens a market harbor and seats the three captains at it.
 *
 * The four consent markets differ in what they sell, in what their board
 * frame is called and in what the harbor is called, so those are the
 * arguments. Everything else is the shape: three accounts, a room opened
 * in the Gambit mode behind the phrase every sealed harbor is opened
 * with, the other two joined by its code, and a socket each, opened and
 * seated in the order the seats were taken.
 *
 * The seating order matters, so it is kept. Each captain's socket is
 * opened, seated and only then handed to the caller to listen with,
 * because a frame the server pushes as a captain sits would otherwise
 * arrive at a socket nobody was listening on yet. The caller subscribes
 * per captain rather than per room for the same reason: the four markets
 * watch different frames.
 *
 * The room's id and the record of the rows each board has carried are
 * handed to that listener as arguments rather than left for the caller to
 * read back, because the listener runs before the harbor is returned.
 */
export async function openMarketHarbor(
  run: SmokeRun,
  options: {
    // The three account labels, in the order the suite names them.
    labels: readonly [string, string, string];
    // The stem of the harbor's name, which is what a captain reads in the
    // list of open harbors.
    harbor: string;
    // The tier the table is charted at, for the suite that needs one.
    difficulty?: string;
    // What to say when the harbor does not open.
    openFailure: string;
  },
  onSeated: (
    captain: Captain,
    socket: Socket,
    roomId: string,
    seen: Map<string, Set<string>>,
  ) => void,
): Promise<MarketHarbor> {
  const [first, second, third] = options.labels;
  const host = await signUp(first);
  const guest = await signUp(second);
  const foreigner = await signUp(third);
  run.extraAccounts.push(host, guest, foreigner);

  const opened = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: host.cookie,
      body: JSON.stringify({
        name: `Smoke ${options.harbor} ${suffix}`,
        isPublic: false,
        ...(options.difficulty ? { difficulty: options.difficulty } : {}),
        mode: "ocean_gambit",
        unlock: LEDGER_PHRASE,
      }),
    },
  );
  if (opened.status !== 200) {
    throw new Error(options.openFailure);
  }
  const roomId = opened.body.room.id;
  const crew = [host, guest, foreigner];
  const joins = await Promise.all(
    crew.slice(1).map((captain) =>
      call<{ room: { id: string } }>("/api/rooms/join", {
        method: "POST",
        cookie: captain.cookie,
        body: JSON.stringify({ code: opened.body.room.code }),
      }),
    ),
  );

  const sockets = new Map<string, Socket>();
  const seen = new Map<string, Set<string>>();
  for (const captain of crew) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const seatedHere = waitForEvent<WireHistory>(
      socket,
      "chat:history",
      (payload) => payload?.roomId === roomId,
    );
    socket.emit("room:join", { roomId });
    await seatedHere;
    onSeated(captain, socket, roomId, seen);
    sockets.set(captain.id, socket);
  }

  return {
    room: opened.body.room,
    roomId,
    crew,
    sockets,
    socketOf: (captain: Captain): Socket => {
      const found = sockets.get(captain.id);
      if (!found) throw new Error(`No socket for ${captain.username}.`);
      return found;
    },
    joins,
    seen,
  };
}
