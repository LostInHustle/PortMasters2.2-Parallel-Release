// PortMasters 2.2 Parallel Release, smoke run: Bartering from anywhere.

import { db } from "@/lib/db";
import { FLEXIBLE_BARTER_UNLOCK_LEVEL } from "@/lib/game/constants/goods";
import { phaseFace } from "@/lib/game/phases";
import { call, check, waitForEvent } from "../harness";
import type { WireOffer } from "../wire";
import type { Socket } from "socket.io-client";

export async function barteringFromAnywhereSuite(inputs: {
  guest: {
    id: string;
    token: string;
    cookie: string;
    username: string;
  };
  guestSocket: Socket;
  hostId: string;
  hostSocket: Socket;
  roomId: string;
  third: {
    id: string;
    token: string;
    cookie: string;
    username: string;
  };
  thirdSocket: Socket;
}): Promise<{ guestId: string }> {
  const { guest, guestSocket, hostId, hostSocket, roomId, third, thirdSocket } =
    inputs;
  // Flexible bartering is the chat surface, and the only one of the two
  // that is earned. Every captain this run made is brand new, so the
  // gate is checked first, while they still hold no Renown at all.
  const gateRefusal = waitForEvent<{ error?: string }>(
    hostSocket,
    "barter:error",
    (payload) => Boolean(payload?.error),
  );
  hostSocket.emit("barter:post", {
    roomId: roomId,
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
    roomId: roomId,
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
    roomId: roomId,
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
      (payload?.offers ?? []).filter((o) => o.fromUserId === hostId).length ===
      2,
  );
  hostSocket.emit("barter:post", {
    roomId: roomId,
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
  check(Boolean(second), "a captain can advertise two flexible offers at once");

  // One from each of the other two as well, so the trade below has two
  // bystanders to leave standing and a second captain to take it.
  const guestUp = waitForEvent<{ offers: WireOffer[] }>(
    guestSocket,
    "barter:update",
    (payload) => (payload?.offers ?? []).some((o) => o.fromUserId === guestId),
  );
  guestSocket.emit("barter:post", {
    roomId: roomId,
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
    (payload) => (payload?.offers ?? []).some((o) => o.fromUserId === thirdId),
  );
  thirdSocket.emit("barter:post", {
    roomId: roomId,
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
  guestSocket.emit("barter:state:request", { roomId: roomId });
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
    roomId: roomId,
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
    roomId: roomId,
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
    roomId: roomId,
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
    roomId: roomId,
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
  const thirdLeft = await call<{ ok: boolean }>(`/api/rooms/${roomId}/leave`, {
    method: "POST",
    cookie: third.cookie,
  });
  check(thirdLeft.status === 200, "the third captain can leave the harbor");

  return { guestId };
}
