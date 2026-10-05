// PortMasters 2.2 Parallel Release, smoke run: Maroon, and the Harbormaster's hand.

import {
  MaroonResult,
  MaroonTally,
  PortShiftNotice,
} from "@/types/realtime/maroon";
import type { PublicUser } from "@/lib/api";
import { db } from "@/lib/db";
import { MODULES } from "@/lib/game/constants/drafts";
import { PORTS_TIER2 } from "@/lib/game/constants/world";
import {
  applyPortShift,
  failSeat,
  handleModuleSelect,
  maroonSeat,
  snapToCheckpoint,
} from "@/lib/game/engine";
import type { PortShift } from "@/lib/game/maroon";
import {
  MAROON_SHARE,
  PORT_SHIFT_FRACTION,
  maroonCarried,
  maroonKeptGold,
  maroonNamesNeeded,
  normalizePortShift,
  portShiftLine,
  portShiftMultiplier,
} from "@/lib/game/maroon";
import { modeConfig } from "@/lib/game/mode";
import { unlockedPorts } from "@/lib/game/pools";
import type { GameState, Phase } from "@/lib/game/types";
import { createInitialGameState } from "@/lib/game/types";
import { leaderShortfall, tallyRows } from "@/lib/voteTally";
import {
  CARRIES_A_DASH,
  LEDGER_PHRASE,
  call,
  check,
  openAuthedSocket,
  suffix,
  waitForEvent,
} from "../harness";
import type { WireHistory } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function maroonAndTheHarbormasterSuite(
  run: SmokeRun,
  inputs: {
    gambitFifth: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    gambitFourth: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    gambitHost: { id: string; token: string; cookie: string; username: string };
    gambitSecond: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    gambitSixth: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    gambitThird: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    guest: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
  },
): Promise<{ maroonRoomId: string; maroonTargetId: string }> {
  const {
    gambitFifth,
    gambitFourth,
    gambitHost,
    gambitSecond,
    gambitSixth,
    gambitThird,
    guest,
  } = inputs;
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

  // The count a card prints, held against the comparison that carries the
  // vote rather than against a second statement of the same rule, which is
  // the pair that has to stay one rule: a card that told the table three
  // names of six were enough would have the room believing a vote had
  // carried when it had not, and the two were written in different files.
  const neededCarries = (roster: number) => {
    const needed = maroonNamesNeeded(roster);
    return (
      maroonCarried(
        nominations(Array.from({ length: needed }, () => "a")),
        roster,
      ) === "a" &&
      (needed === 0 ||
        maroonCarried(
          nominations(Array.from({ length: needed - 1 }, () => "a")),
          roster,
        ) === null)
    );
  };
  check(
    Array.from({ length: 12 }, (_, i) => i + 1).every(neededCarries) &&
      maroonNamesNeeded(0) === 0,
    "the count a card prints is the count the vote carries on: at every roster from one to twelve, one name fewer carries nothing and the count carries",
  );
  check(
    maroonNamesNeeded(3) === 2 &&
      maroonNamesNeeded(5) === 4 &&
      maroonNamesNeeded(6) === 4,
    "which is two thirds read as whole names, rounded up so half a captain is never asked to raise a hand: two of three, four of five and four of six",
  );

  // The shortfall line the shared count draws, read at this vote's own
  // threshold rather than at the audit's: the two cards render one line
  // against two different counts of names (see leaderShortfall in
  // @/lib/voteTally), and a line quoting the majority here would tell the
  // table three names were enough for a vote that needs four.
  const shortfallSeat: PublicUser[] = [
    {
      id: "captain-a",
      username: "captain-a",
      displayName: "AaronZ",
      avatarHue: 10,
    },
  ];
  const shortfallRows = (names: number) =>
    tallyRows(
      Object.fromEntries(
        Array.from({ length: names }, (_, i) => [`voter-${i}`, "captain-a"]),
      ),
      shortfallSeat,
    );
  const threeIn = leaderShortfall(shortfallRows(3), maroonNamesNeeded(6));
  const fourIn = leaderShortfall(shortfallRows(4), maroonNamesNeeded(6));
  check(
    maroonNamesNeeded(6) === 4 &&
      threeIn?.name === "AaronZ" &&
      threeIn?.short === 1 &&
      fourIn?.short === 0,
    "the shared count draws this vote's shortfall at its own threshold: three names of the six seats in leaves AaronZ one name short of the four that carry, and the fourth name closes the line",
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
    normalizePortShift({ port: "Quanzhou Port", direction: -1 })?.direction ===
      -1 &&
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
    gambitFailureLogs.filter((line) => line.includes("Bankrupt")).length === 1,
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
    pricedByTheLean(leanedUpMarket, 1) && pricedByTheLean(leanedDownMarket, -1),
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

  // The tally is read for its whole frame rather than for the map alone:
  // the roster the vote is divided by, the count that carries it and the
  // captains still to name someone ride with the names, which is what a
  // card needs to say how far along the vote is without working out a
  // threshold of its own (see MaroonTally).
  const maroonTallies: Array<{
    round: number;
    votes: Record<string, string>;
    roster: number;
    needed: number;
    awaiting: string[];
  }> = [];
  const maroonResults: MaroonResult[] = [];
  const maroonCalls: PortShiftNotice[] = [];
  // Every refusal any of these captains is handed, in one list: a refusal
  // goes to the captain whose press it was and to nobody else, so this is
  // the room's whole record of them and the checks below read its length.
  const maroonRefusals: string[] = [];
  // The lever's own refusals, kept with the socket each one came back on
  // rather than as one list: which surface a refusal reaches is the
  // property the checks below read, and a single list would lose it.
  const maroonShiftRefusals: Array<{ socket: number; error: string }> = [];
  const maroonReadyStates: Array<{
    round: number;
    phase: string;
    requiredUserIds: string[];
  }> = [];
  maroonSockets.forEach((socket, index) => {
    socket.on("maroon:tally", (payload: MaroonTally) => {
      maroonTallies.push({
        round: payload?.round ?? 0,
        votes: payload?.votes ?? {},
        roster: payload?.roster ?? 0,
        needed: payload?.needed ?? 0,
        awaiting: payload?.awaiting ?? [],
      });
    });
    socket.on("maroon:error", (payload: { error?: string }) => {
      if (typeof payload?.error === "string")
        maroonRefusals.push(payload.error);
    });
    socket.on("maroon:shift:error", (payload: { error?: string }) => {
      if (typeof payload?.error === "string")
        maroonShiftRefusals.push({ socket: index, error: payload.error });
    });
    socket.on("maroon:result", (payload: MaroonResult) =>
      maroonResults.push(payload),
    );
    socket.on("maroon:shift", (payload: PortShiftNotice) =>
      maroonCalls.push(payload),
    );
    socket.on(
      "phase:ready_update",
      (payload: { round: number; phase: string; requiredUserIds: string[] }) =>
        maroonReadyStates.push(payload),
    );
  });
  const maroonSettle = () => new Promise((resolve) => setTimeout(resolve, 400));

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
  check(
    maroonRefusals.length === 1 &&
      !CARRIES_A_DASH.test(maroonRefusals[0] ?? ""),
    "and the captain who called it too early is told the leg the vote opens from rather than being met with silence",
  );

  // The lever answers in the same shape, and this is the leg its own rung
  // refusal is read on: the hand is not dealt before the vote that deals
  // it, and a captain pressing it anyway is told which leg it comes from.
  // The port named below is a real one, so the sentence that comes back is
  // the leg's rather than the port's.
  maroonSockets[4].emit("maroon:shift", {
    roomId: maroonRoomId,
    round: 8,
    port: "Quanzhou Port",
    direction: 1,
  });
  await maroonSettle();
  check(
    maroonShiftRefusals.length === 1 &&
      maroonShiftRefusals[0].socket === 4 &&
      maroonShiftRefusals[0].error ===
        `The Harbormaster's hand is not dealt before leg ${modeConfig("ocean_gambit").maroonFrom}.` &&
      !CARRIES_A_DASH.test(maroonShiftRefusals[0].error),
    "and a call before the hand is dealt is answered on the socket that sent it with the leg it opens from, in the same plain sentence the vote's own refusal is",
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
  const refusalsAtTheTable = maroonRefusals.length;

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
  check(
    maroonRefusals.length === refusalsAtTheTable + 1,
    "and the captain who sent it is answered with a sentence rather than left reading a count that never moved",
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
  check(
    maroonRefusals.length === refusalsAtTheTable + 2,
    "which is also refused in the open: a press the room cannot see land is a press the captain is told about",
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
  // The count the card reads, on the frame: six captains the vote is
  // divided by, four names to carry it, and the five who have not named
  // anyone yet. The written off captain is one of the five on purpose:
  // their mark keeps them off the list a vote may be aimed at, and they
  // are still a captain this count is divided by until they stop sailing.
  const firstMaroonTally = maroonTallies[0];
  const firstAwaiting = firstMaroonTally?.awaiting ?? [];
  check(
    firstMaroonTally?.roster === maroonSockets.length &&
      firstMaroonTally?.needed === maroonNamesNeeded(maroonSockets.length) &&
      firstMaroonTally?.needed === 4 &&
      firstAwaiting.length === maroonSockets.length - 1 &&
      !firstAwaiting.includes(gambitSecond.id) &&
      firstAwaiting.includes(maroonMarkedId),
    "and the count travels with the names: six still sailing, four names to carry, and the five captains the room is still waiting on",
  );

  // A captain names one captain a leg here too, and the refusal is the
  // same shape as the audit's: the second press, whether it repeats the
  // first name or asks for another, is refused at the door so the count
  // the table is reading cannot move under it.
  maroonSockets[1].emit("maroon:vote", {
    roomId: maroonRoomId,
    round: 9,
    targetUserId: maroonTargetId,
  });
  maroonSockets[1].emit("maroon:vote", {
    roomId: maroonRoomId,
    round: 9,
    targetUserId: gambitHost.id,
  });
  await maroonSettle();
  check(
    maroonRefusals.length === refusalsAtTheTable + 4 &&
      maroonRefusals.slice(-2).every((line) => !CARRIES_A_DASH.test(line)),
    "a captain votes once: a second press, for the same name or for another, is refused with a sentence a captain can read",
  );
  check(
    maroonTallies.length === maroonSockets.length &&
      maroonTallies.every(
        (tally) =>
          Object.keys(tally.votes).length === 1 &&
          tally.votes[gambitSecond.id] === maroonTargetId,
      ),
    "and the count does not move: the book still holds the one name the table was shown, whatever the refused presses asked for",
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
  check(
    maroonRefusals.length === refusalsAtTheTable + 5 &&
      !CARRIES_A_DASH.test(maroonRefusals[maroonRefusals.length - 1] ?? ""),
    "and the captain who called it again is told the harbor has already voted one of its own ashore rather than watching a vote that can no longer carry",
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
  check(
    maroonShiftRefusals.length === 2 &&
      maroonShiftRefusals[1].socket === 0 &&
      maroonShiftRefusals[1].error ===
        "The Harbormaster's hand belongs to the captain the harbor put ashore." &&
      !CARRIES_A_DASH.test(maroonShiftRefusals[1].error),
    "and the captain who has no hand is told whose it is, on their own socket and nowhere else, rather than left with a press that did nothing",
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
  // The shape the frame is in is the last way a call can be wrong, and it
  // is the one the wiring used to drop on the floor before this cycle: a
  // port that is not a port is a refused call like the rest now rather
  // than a press that vanished between the two layers.
  maroonSockets[4].emit("maroon:shift", {
    roomId: maroonRoomId,
    round: 9,
    port: 17,
    direction: 1,
  });
  await maroonSettle();
  check(
    maroonCalls.length === 0,
    "and the captain who was marooned may lean a port by a tenth up or down and nothing else: not zero, not a port the charter has not opened, and not a port that does not exist",
  );
  const handRefusals = maroonShiftRefusals.slice(2);
  check(
    maroonShiftRefusals.length === 6 &&
      handRefusals.length === 4 &&
      handRefusals.every(
        (row) => row.socket === 4 && !CARRIES_A_DASH.test(row.error),
      ) &&
      handRefusals.filter(
        (row) =>
          row.error ===
          "A call leans a market up or down, and that frame named neither direction.",
      ).length === 1 &&
      handRefusals.filter(
        (row) =>
          row.error ===
          "The market this call lands on has not unlocked that port.",
      ).length === 2 &&
      handRefusals.filter((row) => row.error === "A call has to name a port.")
        .length === 1,
    "and all four are answered on the socket that sent them, each in a plain sentence of its own: a direction that leans neither way, the two ports the coming market cannot trade, and the frame that named no port at all",
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
      (payload) => payload?.roomId === maroonRoomId && payload?.round === from,
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
  check(
    maroonShiftRefusals.length === 7 &&
      maroonShiftRefusals[6].socket === 4 &&
      maroonShiftRefusals[6].error ===
        "A call in the closing leg would lean a market this voyage never opens." &&
      !CARRIES_A_DASH.test(maroonShiftRefusals[6].error),
    "and the captain still holding the hand is told exactly that, on their own socket, rather than watching a lever that has gone quiet",
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

  // [bug audit] The reopened voyage is the one the walk below sails, and it
  // is the walk that puts the two halves of the count together. The first
  // is the stale ballot: a nomination the book still holds from a captain
  // the room has stopped counting must not be counted under the roster
  // that shrank, or the room puts a captain ashore on a name nobody is
  // behind. The second is the count itself: the roster behind it, the
  // threshold it carries at and the captains it is waiting on all have to
  // come out of the room the vote is actually being held in.
  //
  // Six captains, as the voyage before it: the first votes and then stops
  // being counted, and the four of the five left carry it. Without the
  // prune the stale name would be the fourth in the book and the vote
  // would carry one captain early, which is the check below that reads the
  // count after the third.
  const maroonVoyageTwo = maroonSockets.map((socket) =>
    waitForEvent<{ roomId: string }>(
      socket,
      "room:started",
      (payload) => payload?.roomId === maroonRoomId,
    ),
  );
  maroonSockets[0].emit("room:start", { roomId: maroonRoomId });
  await Promise.all(maroonVoyageTwo);
  const secondRung = await parkMaroonCheckpoint(9, "parley", "Parley");
  check(
    secondRung?.currentRound === 9 && secondRung?.currentPhase === "parley",
    "and a fresh voyage can be walked back to the rung the vote is called from, with its own vote still to call",
  );

  // The count before anyone has voted, which is the one count no broadcast
  // carries: a leg's book is built by the captains in it, so the empty one
  // is never sent, and a card that opens first has to ask (see
  // maroon:state:request in src/server/realtime/wiring/maroon.ts). The
  // answer is the tally frame itself, so the numbers a card reads before
  // the first vote are the numbers it reads after it.
  const askedTally = waitForEvent<MaroonTally>(
    maroonSockets[0],
    "maroon:tally",
    (payload) => payload?.roomId === maroonRoomId,
  );
  maroonSockets[0].emit("maroon:state:request", {
    roomId: maroonRoomId,
    round: 9,
  });
  const maroonBoard = await askedTally;
  check(
    maroonBoard?.round === 9 &&
      Object.keys(maroonBoard?.votes ?? {}).length === 0 &&
      maroonBoard?.roster === maroonSockets.length &&
      maroonBoard?.needed === 4 &&
      maroonBoard?.awaiting.length === maroonSockets.length,
    "a card that has just opened reads the count before anyone has voted: six still sailing, four names to carry it, and the whole harbor still to name someone",
  );

  const resultsBase = maroonResults.length;
  const talliesBase = maroonTallies.length;

  // The written off captain votes first. They may: the mark keeps them off
  // the list a vote can be aimed at, and they are a captain this count is
  // divided by for as long as they are still sailing.
  maroonSockets[5].emit("maroon:vote", {
    roomId: maroonRoomId,
    round: 9,
    targetUserId: maroonTargetId,
  });
  await maroonSettle();
  check(
    maroonTallies.length === talliesBase + maroonSockets.length &&
      maroonTallies[talliesBase]?.votes[gambitSixth.id] === maroonTargetId &&
      maroonTallies[talliesBase]?.roster === maroonSockets.length &&
      maroonTallies[talliesBase]?.awaiting.length === maroonSockets.length - 1,
    "the first ballot of the new voyage is the written off captain's, and the count takes it: six still sailing, five still to name someone",
  );

  // Then they stop sailing, which the room reads off the phase the status
  // carries rather than off the mark. Nothing about the ballot they cast
  // changes yet: the book is re-read when the next nomination lands, which
  // is the same moment the audit's book is.
  maroonSockets[5].emit("game:status", {
    roomId: maroonRoomId,
    round: 9,
    phase: "bankruptcy",
    phaseLabel: "Bankrupt",
    gold: 0,
    reputation: 0,
    shipLevel: 0,
    gameOver: false,
    renownLevel: 3,
  });
  await maroonSettle();
  maroonSockets[1].emit("maroon:vote", {
    roomId: maroonRoomId,
    round: 9,
    targetUserId: maroonTargetId,
  });
  await maroonSettle();
  const prunedMaroon = maroonTallies[maroonTallies.length - 1];
  check(
    maroonTallies.length === talliesBase + maroonSockets.length * 2 &&
      Object.keys(prunedMaroon?.votes ?? {}).length === 1 &&
      !(gambitSixth.id in (prunedMaroon?.votes ?? {})) &&
      prunedMaroon?.votes[gambitSecond.id] === maroonTargetId,
    "a ballot from a captain the room has stopped counting leaves the book when the next one lands, so the count holds one name and not two",
  );
  const prunedAwaiting = prunedMaroon?.awaiting ?? [];
  check(
    prunedMaroon?.roster === maroonSockets.length - 1 &&
      prunedMaroon?.needed === 4 &&
      prunedAwaiting.length === maroonSockets.length - 2 &&
      !prunedAwaiting.includes(gambitSixth.id) &&
      [gambitHost.id, gambitThird.id, gambitFourth.id, maroonTargetId].every(
        (id) => prunedAwaiting.includes(id),
      ),
    "and the count behind the book is the five still sailing rather than the six on the seat list: four names still to carry it, and the four captains the room is waiting on",
  );

  // The door reads the marks through the one predicate the maroon list on a
  // card is drawn with, and the phase counts there as well as the flags
  // (see writtenOff in @/lib/seatMarks). The captain above is the case that
  // tells the two readings apart: their bankruptcy is the phase alone, a
  // status from a client older than the flags, and they are refused as a
  // name for what they are rather than for the roster arithmetic that also
  // excludes them.
  const refusalsBeforeTheMark = maroonRefusals.length;
  const talliesBeforeTheMark = maroonTallies.length;
  maroonSockets[4].emit("maroon:vote", {
    roomId: maroonRoomId,
    round: 9,
    targetUserId: gambitSixth.id,
  });
  await maroonSettle();
  check(
    maroonRefusals.length === refusalsBeforeTheMark + 1 &&
      maroonRefusals[maroonRefusals.length - 1] ===
        "The harbor has already written that captain off." &&
      maroonTallies.length === talliesBeforeTheMark,
    "a seat that stopped sailing is refused as a name off the mark it wears rather than off the roster that also excludes it, so the sentence a captain reads names what the captain is",
  );

  // Three of the five left is not two thirds of five, and that is the
  // whole reason the prune is here: with the stale name still counted this
  // would be the fourth name in the book and the vote would carry, one
  // captain early, on a captain who stopped sailing.
  maroonSockets[2].emit("maroon:vote", {
    roomId: maroonRoomId,
    round: 9,
    targetUserId: maroonTargetId,
  });
  await maroonSettle();
  maroonSockets[3].emit("maroon:vote", {
    roomId: maroonRoomId,
    round: 9,
    targetUserId: maroonTargetId,
  });
  await maroonSettle();
  check(
    maroonResults.length === resultsBase &&
      Object.keys(maroonTallies[maroonTallies.length - 1]?.votes ?? {})
        .length === 3,
    "three of the five still sailing does not carry, so the name the book dropped is the name that would have carried it",
  );

  maroonSockets[4].emit("maroon:vote", {
    roomId: maroonRoomId,
    round: 9,
    targetUserId: maroonTargetId,
  });
  await maroonSettle();
  check(
    maroonResults.length === resultsBase + maroonSockets.length &&
      maroonResults[maroonResults.length - 1]?.target.userId ===
        maroonTargetId &&
      Object.keys(maroonTallies[maroonTallies.length - 1]?.votes ?? {})
        .length === 4,
    "and the fourth is two thirds of the five the vote is counted over, so the harbor carries it without the captain who left the voyage",
  );

  // The answer a state request gets after the vote has carried, which is
  // the one frame a card opened late ever reads: the nominations die with
  // the vote that carried, so without the carried record this answer
  // would read exactly like a fresh leg, an empty book with a full
  // waiting list, and the card would offer a press the harbor has already
  // spent (see carried in @/types/realtime/maroon).
  const carriedAnswer = waitForEvent<MaroonTally>(
    maroonSockets[0],
    "maroon:tally",
    (payload) => payload?.roomId === maroonRoomId && payload?.round === 9,
  );
  maroonSockets[0].emit("maroon:state:request", {
    roomId: maroonRoomId,
    round: 9,
  });
  const afterTheCarry = await carriedAnswer;
  check(
    afterTheCarry !== null &&
      Object.keys(afterTheCarry.votes).length === 0 &&
      afterTheCarry.carried?.userId === maroonTargetId &&
      afterTheCarry.carried?.name === "Smoke gamb_e",
    "a card that asks for the count after the voyage's vote has carried is told what the voyage already did: the book is empty and the carried record names the captain the harbor put ashore, by id and by the name the table knows them by, rather than reading like a fresh leg",
  );

  return { maroonRoomId, maroonTargetId };
}
