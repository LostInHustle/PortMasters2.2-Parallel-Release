// PortMasters 2.2 Parallel Release, smoke run: Seeing each other's live data.

import { check, waitForEvent } from "../harness";
import type { WireMessage } from "../wire";
import type { Socket } from "socket.io-client";

export async function seeingEachOtherSSuite(inputs: {
  ashoreSocket: Socket;
  guest: {
    id: string;
    token: string;
    cookie: string;
    username: string;
  };
  guestSocket: Socket;
  host: {
    id: string;
    token: string;
    cookie: string;
    username: string;
  };
  hostSocket: Socket;
  quaySocket: Socket;
  roomId: string;
}): Promise<{ guestToken: string; hostId: string }> {
  const {
    ashoreSocket,
    guest,
    guestSocket,
    host,
    hostSocket,
    quaySocket,
    roomId,
  } = inputs;
  const hostId = host.id;
  const guestToken = guest.token;

  // Both captains take a seat in the harbor's socket channel. The
  // server only relays room traffic to sockets that have joined one.
  const joinedHost = waitForEvent(hostSocket, "room:members");
  const joinedGuest = waitForEvent(guestSocket, "room:members");
  hostSocket.emit("room:join", { roomId: roomId });
  guestSocket.emit("room:join", { roomId: roomId });
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
    roomId: roomId,
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
  check(status?.user?.id === hostId, "the status is labelled with its captain");
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

  return { guestToken, hostId };
}
