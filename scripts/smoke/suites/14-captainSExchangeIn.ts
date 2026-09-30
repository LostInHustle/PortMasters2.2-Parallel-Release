// PortMasters 2.2 Parallel Release, smoke run: The Captain's Exchange in its own phase.

import { RoomMembersPayload } from "@/types/realtime/moderation";
import { db } from "@/lib/db";
import { FLEXIBLE_BARTER_UNLOCK_LEVEL } from "@/lib/game/constants/goods";
import { check, waitForEvent } from "../harness";
import type { WireOffer } from "../wire";
import type { Socket } from "socket.io-client";

export async function captainSExchangeInSuite(inputs: {
  guest: {
    id: string;
    token: string;
    cookie: string;
    username: string;
  };
  guestId: string;
  guestSocket: Socket;
  hostSocket: Socket;
  roomId: string;
}): Promise<void> {
  const { guest, guestId, guestSocket, hostSocket, roomId } = inputs;
  // The other surface, and the one nothing is asked of. This captain is
  // dropped back to level one first, so a working exchange cannot be
  // Renown doing the work: the same account is refused the flexible
  // offer below at exactly the level the exchange is served at.
  await db.captainLegacy.update({
    where: { userId: guest.id },
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
    roomId: roomId,
    targetUserId: guest.id,
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
  hostSocket.emit("room:start", { roomId: roomId });
  check(
    (await liftedAtDeparture) !== null,
    "and the voyage lifts it, because a mute is a judgement about a table rather than about a captain",
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  hostSocket.emit("game:status", {
    roomId: roomId,
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
    (payload) => (payload?.offers ?? []).some((o) => o.fromUserId === guestId),
  );
  guestSocket.emit("barter:post", {
    roomId: roomId,
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
    roomId: roomId,
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
    roomId: roomId,
    offerId: exchangePosted?.id,
  });
  check(
    (await exchangeTaken) !== null,
    "and any captain can take one off it, at any Renown level",
  );
}
