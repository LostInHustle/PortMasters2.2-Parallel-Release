// PortMasters 2.2 Parallel Release, smoke run: The escort contract.

import { EscortBoard } from "@/types/realtime/boards";
import { db } from "@/lib/db";
import {
  CONSENT_FEE_MAX,
  CONSENT_FEE_MIN,
  CONVOY_RAID_COVERAGE,
} from "@/lib/game/constants/paths";
import type { EscortContract } from "@/lib/game/engine";
import {
  ESCORT_SELLER_PATH,
  agreeConsent,
  applyEscortSide,
  canSellEscort,
  consentFeeFor,
  consentOfferStanding,
  consentPartyBusy,
  coverFromBoard,
  escortCoverOf,
  escortCoverage,
  expireConsent,
  normalizeConsentLedger,
  normalizeEscortState,
  resetConsentLedger,
  resetEscortLeg,
  resolvePirateAttack,
  visibleContracts,
} from "@/lib/game/engine";
import { escortContractsOn } from "@/lib/game/flags";
import { PATH_IDS } from "@/lib/game/paths";
import { phaseFace } from "@/lib/game/phases";
import type {
  EscortClaim,
  EscortCover,
  GameState,
  Phase,
} from "@/lib/game/types";
import {
  GAMBIT,
  LEDGER_PHRASE,
  call,
  carriesADash,
  check,
  openAuthedSocket,
  signUp,
  suffix,
  switchFor,
  voyageState,
  waitForEvent,
  withEnv,
} from "../harness";
import type { Captain, WireHistory } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function escortContractSuite(
  run: SmokeRun,
  inputs: {
    host: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
  },
): Promise<void> {
  const { host } = inputs;

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
      coverFromBoard([contractOn({ status: "claimed" })], "buyer", 3) !== null,
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
      expireConsent([claimedRow], { phase: "orders", round: 3 }).length === 1 &&
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
      sweptBoard.find((c) => c.id === "direct")?.buyerName === "Smoke Buyer" &&
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
      bare.money === 0 && bare.escortAbsorbed === 0 && bare.escortClaims === 1,
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
  if (!host) {
    throw new Error("No captain in another harbor to aim an offer at.");
  }
  const strangerTarget = await refusedFrom(escortSeller, "contract:post", {
    fee: 50,
    targetUserId: host.id,
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
      !carriesADash("src/components/portmasters/game/phases/Settlement.tsx") &&
      !carriesADash("src/server/realtime/contracts.ts") &&
      !carriesADash("src/lib/game/convoy.ts"),
    "every file the escort contract's copy lives in reads free of en dashes, em dashes and doubled hyphens, which is the house rule for every string a captain reads",
  );
}
