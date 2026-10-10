// PortMasters 2.2 Parallel Release, smoke run: Bartering from anywhere.

import { db } from "@/lib/db";
import { FLEXIBLE_BARTER_UNLOCK_LEVEL } from "@/lib/game/constants/goods";
import { phaseFace } from "@/lib/game/phases";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  // ========== What a refusal has to give back ==========
  // Posting escrows on the spot: the poster's own client takes the offered
  // goods out of its hold the moment the press lands, before the frame is
  // even sent (see the engine's postBarterOffer, and why the escrow works
  // that way). So a refusal has to be able to say which post it refused,
  // or a press made as the leg turns destroys the goods outright: out of
  // the hold, never on the board, gone for the voyage. This is that
  // frame, and the echo is the whole reason it carries anything.
  const refusedPostEcho = waitForEvent<{
    error?: string;
    offerItem?: string;
    offerAmount?: number;
    requestItem?: string;
    requestAmount?: number;
    flexible?: boolean;
  }>(guestSocket, "barter:error", (payload) => Boolean(payload?.error));
  guestSocket.emit("barter:post", {
    roomId: roomId,
    offerItem: "Hemp",
    offerAmount: 2,
    requestItem: "Gold",
    requestAmount: 3,
    flexible: false,
  });
  const refusedPost = await refusedPostEcho;
  check(
    refusedPost !== null,
    "an exchange offer made outside the Parley is refused, as above",
  );
  check(
    refusedPost?.offerItem === "Hemp" &&
      refusedPost?.offerAmount === 2 &&
      refusedPost?.requestItem === "Gold" &&
      refusedPost?.requestAmount === 3 &&
      refusedPost?.flexible === false,
    "and the refusal names the offer it refused, field for field, so the client knows which escrow to hand back",
  );

  // The client's own half of that trade, read off the files rather than
  // driven because the escrow lives in a React hook and this suite has no
  // browser to press it in. Two claims, one per side: the hook writes a
  // post down as it goes out and hands the named one back when it is
  // refused, and the boards hook is what actually returns the goods,
  // through the same refund a sweep takes.
  const repoRoot = join(import.meta.dirname, "..", "..", "..");
  const barterHook = readFileSync(
    join(repoRoot, "src", "lib", "use-barter.ts"),
    "utf8",
  );
  const boardsHook = readFileSync(
    join(repoRoot, "src", "lib", "use-harbor-boards.ts"),
    "utf8",
  );
  check(
    barterHook.includes("takeRefusedPost(pendingPostsRef.current, data)") &&
      barterHook.includes("onPostRefusedRef.current(refused)") &&
      boardsHook.includes(
        'refundBarterOffer(g, post.offerItem, post.offerAmount, l, "refusal")',
      ),
    "a refused post's own escrow goes back to the hold, so a press the room turned away returns the goods it escrowed",
  );
  // The other half of that return, and the one a refusal can lose on its
  // own: a refund that lands while this captain's voyage is still loading
  // would be applied to a save the real one then replaces, which destroys
  // the goods exactly as quietly as a refusal with no refund at all. So the
  // refusal goes through the same held queue the board's own drop does, and
  // the queue replays in arrival order, which is what keeps two answers to
  // one captain in the order the room sent them.
  check(
    boardsHook.includes("heldReceipts.current.push(apply)") &&
      boardsHook.split("heldReceipts.current.push(").length - 1 === 2 &&
      boardsHook.includes("for (const apply of waiting) apply(g, l)") &&
      !boardsHook.includes("pendingRefunds"),
    "a refusal that lands before the voyage does waits in the same queue as every other receipt, and the queue replays them in arrival order rather than discarding them with the placeholder",
  );
  // The withdrawal's half of the same escrow rule, and the second bug this
  // article holds down: a buyer's accept can already be on the wire when
  // the poster presses Cancel, and the room may have sold the offer by
  // then. A refund taken at the moment of the press would pay the poster
  // twice for one offer, once in goods and once in the price, so there is
  // exactly one place a refund can come from and it is the board dropping
  // the offer (the same rule a swept offer follows, and the one the
  // fulfilled frame settles first so it never fires).
  const refundSites = barterHook.split("onRefundRef.current(").length - 1;
  check(
    refundSites === 1 && barterHook.includes('socket.emit("barter:cancel"'),
    "a withdrawal asks the room and refunds nothing itself, so the sale that won the race and the refund can never both pay",
  );

  // ========== The harbor's other peer board: one loan ==========
  // Gold between two captains is the second thing the room routes between
  // players, and it settles by the same shape as the goods above: the room
  // holds the record and each side applies what the room says. What is
  // checked is the repayment's two answers, because a repayment used to be
  // applied to the borrower's own book on the spot and sent on their own
  // word: a loan the room had already closed took the Gold locally, paid
  // the lender nothing, and left the press unanswered, with nothing on
  // either screen to say which had happened.
  const loanAsked = waitForEvent<{
    requests: { id: string; fromUserId: string; amount: number }[];
  }>(hostSocket, "aid:update", (payload) =>
    (payload?.requests ?? []).some((r) => r.fromUserId === guestId),
  );
  guestSocket.emit("aid:post", { roomId: roomId, amount: 5 });
  const loanRequest = (await loanAsked)?.requests.find(
    (r) => r.fromUserId === guestId,
  );
  check(
    Boolean(loanRequest),
    "a captain short of Gold can ask the harbor for a loan",
  );

  const grantedToBorrower = waitForEvent<{
    requestId?: string;
    amount?: number;
    helperId?: string;
  }>(
    guestSocket,
    "aid:granted",
    (payload) => payload?.requestId === loanRequest?.id,
  );
  const grantedToHelper = waitForEvent<{
    requestId?: string;
    amount?: number;
  }>(
    hostSocket,
    "aid:granted",
    (payload) => payload?.requestId === loanRequest?.id,
  );
  hostSocket.emit("aid:help", { roomId: roomId, requestId: loanRequest?.id });
  const loan = await grantedToBorrower;
  check(
    loan?.amount === 5 && loan?.helperId === hostId,
    "and another captain can cover it, with the borrower told the amount and the lender",
  );
  check(
    (await grantedToHelper) !== null,
    "and the lender is told the same loan rather than one of their own making",
  );

  // The repayment itself. The borrower asks and the room answers: the
  // receipt is what lets their client move the debt and the Gold, and it
  // is the frame the old shape of this press never had, which is why a
  // closed loan used to cost a captain their Gold in silence.
  const receiptForPayer = waitForEvent<{ debtId?: string }>(
    guestSocket,
    "aid:repay:ok",
    (payload) => payload?.debtId === loanRequest?.id,
  );
  const repaidToLender = waitForEvent<{
    debtId?: string;
    amount?: number;
    fromUserId?: string;
  }>(
    hostSocket,
    "aid:repaid",
    (payload) => payload?.debtId === loanRequest?.id,
  );
  guestSocket.emit("aid:repay", {
    roomId: roomId,
    amount: 5,
    debtId: loanRequest?.id,
  });
  check(
    (await receiptForPayer) !== null,
    "a repayment is answered with a receipt naming the debt the room closed, so the payer can apply it on the room's word rather than their own",
  );
  check(
    (await repaidToLender)?.amount === 5,
    "and the lender is paid the amount the loan was for",
  );

  // The same press again, against a loan the room no longer holds. This is
  // the audit's own second file: the loan can be gone (a voyage that
  // ended, a seat that was written off) while the borrower's own book
  // still lists the debt, and the press has to be refused rather than
  // answered with silence.
  const refusedRepay = waitForEvent<{
    debtId?: string;
    reason?: string;
  }>(guestSocket, "aid:repay:fail", (payload) => Boolean(payload?.reason));
  guestSocket.emit("aid:repay", {
    roomId: roomId,
    amount: 5,
    debtId: loanRequest?.id,
  });
  const staleRepay = await refusedRepay;
  check(
    staleRepay !== null && staleRepay.debtId === undefined,
    "a repayment of a loan the room no longer holds is refused rather than left unanswered, and the refusal carries no debt id because the client holds one refusal at a time rather than a row per debt",
  );
  check(
    Boolean(staleRepay?.reason?.includes("no longer outstanding")),
    "and the refusal says what the book holds instead",
  );

  // The client's own half of that pair, read off the files for the reason
  // the escrow needles above are: the press is a React callback. The press
  // asks and applies nothing, the receipt is what runs the engine, and the
  // engine function is not reachable from the press at all, which is the
  // whole fix: a debt the room has closed cannot be debited twice or
  // debited for nothing.
  const aidHook = readFileSync(
    join(repoRoot, "src", "lib", "use-aid.ts"),
    "utf8",
  );
  const gameRoom = readFileSync(
    join(repoRoot, "src", "components", "portmasters", "GameRoom.tsx"),
    "utf8",
  );
  check(
    gameRoom.includes("aid.repay(debt.amount, debtId)") &&
      !gameRoom.includes("repayLoan") &&
      boardsHook.includes("repayLoan(g, settled.debtId, l)") &&
      aidHook.includes('socket.on("aid:repay:ok"'),
    "a repayment moves the debt on the receipt the room sends back and nowhere else, so the Gold follows a loan the room is actually holding",
  );
  // The wire carries the debt and the amount and nothing else. The room
  // holds the loan, so it already knows who lent it, and a lender id sent
  // from the client would only be a second copy of that fact to disagree
  // with the book the press is judged against.
  check(
    aidHook.includes('socket.emit("aid:repay", { roomId, amount, debtId })') &&
      !aidHook.includes("lenderId") &&
      !gameRoom.includes("debt.counterpartyId, debt.amount"),
    "a repayment names the debt alone, so no client supplied lender can disagree with the loan the room is actually holding",
  );

  // ========== Dismissing a refusal ==========
  // A refusal is a sentence about one press. Every press on these hooks
  // clears the last one before it goes out, so a captain is never left
  // reading about a situation that has moved on, and the convoy board hands
  // its refusal back for dismissal where it is read.
  const convoyHook = readFileSync(
    join(repoRoot, "src", "lib", "use-convoy.ts"),
    "utf8",
  );
  const backingHook = readFileSync(
    join(repoRoot, "src", "lib", "use-backing.ts"),
    "utf8",
  );
  const escortHook = readFileSync(
    join(repoRoot, "src", "lib", "use-escort-contracts.ts"),
    "utf8",
  );
  check(
    aidHook.split("setError(null);").length - 1 === 4 &&
      barterHook.split("setError(null);").length - 1 === 3 &&
      convoyHook.split("setError(null);").length - 1 === 2 &&
      backingHook.split("setError(null);").length - 1 === 2 &&
      escortHook.includes("clearError();") &&
      convoyHook.includes("clearError: () => setError(null),"),
    "every press on the board hooks clears the previous refusal before it goes out, and the convoy board can be cleared by the screen that read it",
  );

  return { guestId };
}
