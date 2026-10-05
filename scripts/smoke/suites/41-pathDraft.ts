// PortMasters 2.2 Parallel Release, smoke run: The path draft.

import { DraftView, PathSwitched } from "@/types/realtime/draft";
import { db } from "@/lib/db";
import {
  DRAFT_DEAL,
  DRAFT_QUARTERMASTER_MIN,
  DRAFT_WATCH_MS,
  PATH_SWITCH_FEE_BASE,
  PATH_SWITCH_FEE_MAX,
  PATH_SWITCH_FEE_PER_LEVEL,
  PATH_SWITCH_FROM_ROUND,
  PATH_SWITCH_TO_ROUND,
} from "@/lib/game/constants/paths";
import {
  DRAFT_AUTO_PICK,
  draftComposition,
  draftDeck,
  draftHands,
  keepFrom,
  normalizePathSwitchLeg,
  passLeft,
  pathSwitchFee,
  pathSwitchPhase,
  pathSwitchWindow,
} from "@/lib/game/draft";
import {
  applyDraftPath,
  applyPathSwitch,
  pathOrderOf,
  pathSwitchBlocked,
  pathSwitchOpenLine,
  snapToCheckpoint,
} from "@/lib/game/engine";
import { pathDraftOn } from "@/lib/game/flags";
import { RENOWN_MAX_LEVEL } from "@/lib/game/legacy";
import type { PathId } from "@/lib/game/paths";
import { PATH_IDS, pathConfig } from "@/lib/game/paths";
import { phaseFace } from "@/lib/game/phases";
import { createRng } from "@/lib/game/rng";
import type { TelemetryRecord } from "@/lib/game/telemetry";
import type { OrderCard, Phase } from "@/lib/game/types";
import type { VoyageLogEntry } from "@/lib/game/voyage-log";
import {
  GAMBIT,
  LEDGER_PHRASE,
  call,
  carriesADash,
  check,
  openAuthedSocket,
  signUp,
  suffix,
  voyageState,
  waitForEvent,
  withEnv,
} from "../harness";
import type { Captain, WireHistory } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function pathDraftSuite(
  run: SmokeRun,
  inputs: {
    telWaitForOne: (roomId: string) => Promise<{
      row: {
        voyageEpoch: number;
        sampleRate: number;
        outcome: string;
        leg: number;
        record: string;
      };
      record: TelemetryRecord | null;
    }>;
  },
): Promise<void> {
  const { telWaitForOne } = inputs;

  // ---- the deal's arithmetic ----
  check(
    DRAFT_DEAL === 3 &&
      DRAFT_WATCH_MS === 15_000 &&
      DRAFT_QUARTERMASTER_MIN >= 2,
    "the deal is three cards a captain over three steps that close when every hand is in, and the only clock the feature owns is the fifteen second absence window a seat that went dark is given, which nobody is ever shown, with the Quartermaster floor at the two the plan asks to be in circulation",
  );

  // The composition, over every table this lap can seat. Two properties
  // are read at every size: the deck is exactly three cards a captain, so
  // it is dealt out entirely, and the Quartermaster floor holds, which is
  // the plan's "always physically present" read as a guarantee rather than
  // a lean. The smallest table is the one that decides the second: a solo
  // captain's deck is three cards and two of them are the floor.
  check(
    Array.from({ length: 12 }, (_, i) => i + 1).every((captains) => {
      const counts = draftComposition(captains);
      const total = PATH_IDS.reduce((sum, id) => sum + counts[id], 0);
      return (
        total === captains * DRAFT_DEAL &&
        counts.quartermaster >= DRAFT_QUARTERMASTER_MIN &&
        PATH_IDS.every((id) => counts[id] >= 0)
      );
    }),
    "every table from one captain to twelve is dealt a deck of exactly three cards a captain with the Quartermaster floor held, so the deck is dealt out to the last card and the card the plan wants in circulation is in circulation at every size",
  );

  // The deck itself: the composition, shuffled. The shuffle is what hides
  // the order and the composition is what decides the counts, so what is
  // read here is that the two are one deck still: the same cards, in a
  // different order than they were built in.
  const composedDeck = PATH_IDS.flatMap((id) =>
    Array.from({ length: draftComposition(6)[id] }, () => id),
  );
  const dealtDeck = draftDeck(6, createRng("smoke:draft:deck"));
  check(
    dealtDeck.length === composedDeck.length &&
      [...dealtDeck].sort().join() === [...composedDeck].sort().join() &&
      dealtDeck.some((card, index) => card !== composedDeck[index]),
    "the shuffled deck is the composition to the last card and in a different order than it was built in, so the floor survives the shuffle and the deal begins from a deck nobody can read",
  );

  // The hands: the deck dealt out three at a time, in seating order.
  const composedHands = draftHands(dealtDeck, 6);
  check(
    composedHands.length === 6 &&
      composedHands.every((hand) => hand.length === DRAFT_DEAL) &&
      composedHands.flat().join() === dealtDeck.join(),
    "the deck is dealt out to the table three cards at a time in the order the seats were opened in, so what a captain holds is a slice of one deck rather than a draw of its own",
  );
  check(
    draftHands(dealtDeck, 7).flat().length === dealtDeck.length &&
      draftHands(dealtDeck, 7)[6]?.length === 0,
    "and a table with one seat too many is handed a short hand rather than a card somebody else is already holding",
  );

  // The keep and the pass. A pick names a place in a hand rather than a
  // path, because a deck with a floor can hand one captain two cards of
  // the same path and "keep the Quartermaster" would not name a card.
  const spreadHand: PathId[] = ["quartermaster", "convoy", "quartermaster"];
  const keptOne = keepFrom(spreadHand, 1);
  check(
    keptOne?.kept === "convoy" &&
      keptOne.rest.length === 2 &&
      keptOne.rest.filter((card) => card === "quartermaster").length === 2 &&
      keepFrom(spreadHand, DRAFT_DEAL) === null &&
      keepFrom(spreadHand, -1) === null &&
      keepFrom(spreadHand, 1.5) === null &&
      keepFrom(spreadHand, "1") === null,
    "a card is kept by the place it holds in a hand, so a captain dealt two Quartermasters keeps one of them and leaves the other in play, and a pick that names nothing in the hand is refused rather than rounded to somewhere",
  );
  const fourHands: PathId[][] = [
    ["convoy", "convoy", "loom"],
    ["aroma", "aroma", "quartermaster"],
    ["free_captain", "free_captain", "loom"],
    ["quartermaster", "aroma", "convoy"],
  ];
  const passedHands = passLeft(fourHands);
  check(
    passedHands.every(
      (hand, seat) =>
        hand === fourHands[(seat - 1 + fourHands.length) % fourHands.length],
    ) &&
      passedHands[0]?.join() === fourHands[fourHands.length - 1]?.join() &&
      passedHands.length === fourHands.length,
    "the two cards a captain did not keep travel to the seat on their left, which is the next seat in the order the draft was opened with and wraps at the table's end",
  );
  check(
    DRAFT_AUTO_PICK === 0 &&
      keepFrom(spreadHand, DRAFT_AUTO_PICK)?.kept === "quartermaster",
    "and the card the room lays for a captain who let the clock run out is the first card of their own hand, which is a card they were dealt rather than one the server liked",
  );

  // ---- the window, the seat and the price ----
  check(
    pathSwitchWindow(PATH_SWITCH_FROM_ROUND) &&
      pathSwitchWindow(PATH_SWITCH_TO_ROUND) &&
      pathSwitchWindow(PATH_SWITCH_FROM_ROUND + 0.9) &&
      !pathSwitchWindow(PATH_SWITCH_FROM_ROUND - 1) &&
      !pathSwitchWindow(PATH_SWITCH_TO_ROUND + 1) &&
      !pathSwitchWindow(Number.NaN) &&
      ["market", "orders", "parley"].every((seat) => pathSwitchPhase(seat)) &&
      ["harbor", "dawn", "resolve", "dusk"].every(
        (seat) => !pathSwitchPhase(seat),
      ) &&
      !pathSwitchPhase(null) &&
      !pathSwitchPhase(4),
    "new papers are read in legs three through nine and in the three seats the port is: a captain buys, commits and talks at Market, Orders and Parley, and sails, raids and settles accounts in the others",
  );
  const feeLadder = Array.from({ length: RENOWN_MAX_LEVEL }, (_, rung) =>
    pathSwitchFee(rung + 1),
  );
  const firstCapped = feeLadder.findIndex((fee) => fee === PATH_SWITCH_FEE_MAX);
  check(
    feeLadder[0] === PATH_SWITCH_FEE_BASE &&
      pathSwitchFee(RENOWN_MAX_LEVEL) === PATH_SWITCH_FEE_MAX &&
      firstCapped > 0 &&
      firstCapped < RENOWN_MAX_LEVEL &&
      feeLadder.every(
        (fee, rung) =>
          fee <= PATH_SWITCH_FEE_MAX &&
          (rung === 0 || fee >= feeLadder[rung - 1]),
      ),
    `the price of new papers is the plan's Refit fee scaled to Renown: the base at the first rung, ${PATH_SWITCH_FEE_PER_LEVEL} Gold more for each rung above it, and a ceiling that binds before the ladder's top rung rather than above it, so a captain really meets the bound`,
  );
  check(
    pathSwitchFee(0) === PATH_SWITCH_FEE_BASE &&
      pathSwitchFee(-3) === PATH_SWITCH_FEE_BASE &&
      pathSwitchFee(Number.NaN) === PATH_SWITCH_FEE_BASE &&
      pathSwitchFee(3.9) === pathSwitchFee(3),
    "and a save carrying a rung nobody sails on pays the base rather than less than it, because the ladder's floor is where every captain starts",
  );
  check(
    normalizePathSwitchLeg(4.7) === 4 &&
      normalizePathSwitchLeg(9) === 9 &&
      normalizePathSwitchLeg(0) === 0 &&
      normalizePathSwitchLeg(-2) === 0 &&
      normalizePathSwitchLeg(Number.NaN) === 0 &&
      normalizePathSwitchLeg("four") === 0,
    "the leg a switch is stamped with reads as the voyage's own counter, and nonsense in that field reads as a captain who has not changed their papers: the direction that keeps a corrupt save from spending the one switch a voyage allows",
  );
  check(
    pathSwitchOpenLine(PATH_SWITCH_FROM_ROUND - 1, "market") ===
      `The harbor reads new papers from round ${PATH_SWITCH_FROM_ROUND}.` &&
      pathSwitchOpenLine(PATH_SWITCH_TO_ROUND + 1, "market") ===
        `The window for new papers closed after round ${PATH_SWITCH_TO_ROUND}.` &&
      pathSwitchOpenLine(4, "dawn") ===
        "Papers are changed at the port, in Market, Orders or Parley." &&
      pathSwitchOpenLine(4, "market") === null &&
      pathSwitchOpenLine(2, "dawn") ===
        `The harbor reads new papers from round ${PATH_SWITCH_FROM_ROUND}.`,
    "the harbor's answer about when it reads new papers is one sentence per fact and the season is asked before the seat, so a switch attempted in the wrong part of a voyage is told about the voyage rather than about the phase it happened to be attempted in",
  );

  // ---- what a kept card writes into a save ----
  const kept = voyageState();
  const keptLines: string[] = [];
  check(
    kept.path === null &&
      kept.pathSwitchLeg === 0 &&
      applyDraftPath(kept, "quartermaster", keptLines) === true &&
      kept.path === "quartermaster" &&
      keptLines.length === 1 &&
      keptLines[0]!.includes(pathConfig("quartermaster")!.name) &&
      applyDraftPath(kept, "loom", keptLines) === false &&
      kept.path === "quartermaster" &&
      keptLines.length === 1,
    "the card the draft leaves a captain holding is written once and only once: a second card arriving, which a reload or a second deal would send, is a frame to drop rather than an identity to overwrite behind the fleet's back",
  );

  // ---- the switch, over a save ----
  // A board dealt through the engine's own lifecycle in a seat inside the
  // window, so the forfeiture below walks the manifest a captain really
  // meets rather than cards assembled by hand. It is read under the path
  // order switch the way every board this suite deals one is, because a
  // locked card only exists while that switch is on and a fixture that
  // forgot it would be reading a manifest with nothing in it to forfeit.
  const switched = withEnv("NEXT_PUBLIC_PATH_ORDERS", "1", () => {
    const state = voyageState({ mode: "ocean_gambit" });
    snapToCheckpoint(
      state,
      { seedBase: `smoke:d7:switch:${suffix}`, harborId: "harbor-a" },
      4,
      "orders",
      [],
    );
    state.money = 500;
    state.renownLevel = 4;
    const locked = state.customerCards
      .map((card) => ({ card, lock: pathOrderOf(card, GAMBIT) }))
      .filter(
        (row): row is { card: OrderCard; lock: PathId } => row.lock !== null,
      );
    const from = locked[0]?.lock ?? "convoy";
    const to = PATH_IDS.find((id) => id !== from)!;
    const mine = locked
      .filter((row) => row.lock === from)
      .map((row) => row.card);
    // One of the old papers' cards already filled, on the boards that
    // carry two of them: the manifest is also the leg's history, so a
    // filled order is not something a switch can take away. A board that
    // carries only one of them leaves it open instead, and the forfeiture
    // below reads its count off the ledger rather than off a card.
    const filled = mine.length > 1 ? mine.slice(0, 1) : [];
    const open = mine.filter((card) => !filled.includes(card));
    const loose = state.customerCards.filter(
      (card) => pathOrderOf(card, GAMBIT) === null,
    );
    state.path = from;
    state.pathSwitchLeg = 0;
    state.completedOrders = [
      ...state.completedOrders,
      ...filled.map((card) => card.id),
    ];
    const fee = pathSwitchFee(state.renownLevel);
    const purse = state.money;
    const lines: string[] = [];
    const applied = applyPathSwitch(state, to, lines);
    const held = (card: OrderCard) =>
      state.customerCards.some((kept) => kept.id === card.id);
    return {
      state,
      locked,
      from,
      to,
      filled,
      open,
      loose,
      fee,
      purse,
      lines,
      applied,
      held,
    };
  });
  check(
    switched.locked.length > 0,
    `a leg four board carries the paths' cards like any other (${switched.locked.length} locked), which is what the forfeiture below has to have to walk`,
  );
  check(
    switched.applied &&
      switched.state.path === switched.to &&
      switched.state.pathSwitchLeg === 4 &&
      switched.state.money === switched.purse - switched.fee &&
      switched.open.length > 0 &&
      switched.open.every((card) => !switched.held(card)) &&
      switched.filled.every((card) => switched.held(card)) &&
      switched.loose.every((card) => switched.held(card)),
    "the one switch a voyage allows charges the fee, stamps the leg it happened on and takes the unfulfilled pathbound orders of the path being set aside with it, while the orders already filled and the cards nobody locked stay on the manifest",
  );
  check(
    switched.lines.some(
      (line) =>
        line.includes(pathConfig(switched.from)!.name) &&
        line.includes(pathConfig(switched.to)!.name) &&
        line.includes(String(switched.fee)),
    ) &&
      switched.lines.filter((line) => line.startsWith("📜 Forfeited"))
        .length === 1 &&
      switched.lines.includes(
        `📜 Forfeited ${switched.open.length} unfulfilled pathbound order${switched.open.length === 1 ? "" : "s"}.`,
      ),
    "and the ledger says the whole of the price: the path set aside, the path taken up, the Gold it cost, and the orders it took with it counted once and counted right",
  );
  // The other side of the same guard, on a board whose locked cards are
  // all filled: the forfeiture a switch costs is the work a captain did
  // not do, so a manifest with none of it left has nothing to lose and
  // says so by leaving the sentence off rather than by printing a zero.
  withEnv("NEXT_PUBLIC_PATH_ORDERS", "1", () => {
    const carried = voyageState({ mode: "ocean_gambit" });
    snapToCheckpoint(
      carried,
      { seedBase: `smoke:d7:carried:${suffix}`, harborId: "harbor-a" },
      4,
      "orders",
      [],
    );
    const anyLocked = carried.customerCards.find(
      (card) => pathOrderOf(card, GAMBIT) !== null,
    );
    const abandoned =
      anyLocked === undefined ? null : (pathOrderOf(anyLocked, GAMBIT) ?? null);
    carried.path = abandoned ?? PATH_IDS[0];
    carried.money = 500;
    const marked = carried.customerCards.filter(
      (card) => pathOrderOf(card, GAMBIT) === abandoned,
    );
    carried.completedOrders = [
      ...carried.completedOrders,
      ...marked.map((card) => card.id),
    ];
    const before = carried.customerCards.length;
    const lines: string[] = [];
    const switchedHere = applyPathSwitch(
      carried,
      PATH_IDS.find((id) => id !== carried.path)!,
      lines,
    );
    check(
      abandoned !== null &&
        switchedHere &&
        carried.customerCards.length === before &&
        marked.length > 0 &&
        marked.every((card) =>
          carried.customerCards.some((kept) => kept.id === card.id),
        ) &&
        lines.every((line) => !line.startsWith("📜 Forfeited")),
      "and a manifest whose pathbound cards are all filled loses nothing to a switch and says so by leaving the forfeiture line off entirely, so the line a captain reads is the count of what they gave up rather than a sentence the ledger prints every time",
    );
  });

  // The refusals, one per fact, and each of them is the sentence the panel
  // greys a button out with and the switch itself obeys, because they are
  // one function rather than two that could drift.
  const atSea = (round: number, phase: Phase, path: PathId, money: number) => {
    const state = voyageState();
    state.currentRound = round;
    state.phase = phase;
    state.path = path;
    state.money = money;
    return state;
  };
  // Two paths, and they are read off the record rather than off the board
  // above: none of these sentences depends on what a manifest was dealt.
  const heldPath = PATH_IDS[0];
  const wantedPath = PATH_IDS[1];
  const atPort = atSea(4, "orders", heldPath, 500);
  check(
    pathSwitchBlocked(voyageState(), wantedPath) ===
      "You hold no path to set aside." &&
      pathSwitchBlocked(atPort, heldPath) === "You already hold that path." &&
      pathSwitchBlocked({ ...atPort, pathSwitchLeg: 3 }, wantedPath) ===
        "A captain changes their papers once a voyage, and yours are already changed." &&
      pathSwitchBlocked(
        atSea(PATH_SWITCH_FROM_ROUND - 1, "orders", heldPath, 500),
        wantedPath,
      ) ===
        `The harbor reads new papers from round ${PATH_SWITCH_FROM_ROUND}.` &&
      pathSwitchBlocked(
        atSea(PATH_SWITCH_TO_ROUND + 1, "orders", heldPath, 500),
        wantedPath,
      ) ===
        `The window for new papers closed after round ${PATH_SWITCH_TO_ROUND}.` &&
      pathSwitchBlocked(atSea(4, "dawn", heldPath, 500), wantedPath) ===
        "Papers are changed at the port, in Market, Orders or Parley." &&
      pathSwitchBlocked(atPort, wantedPath) === null,
    "a captain with no path to set aside, one who has already changed their papers this voyage, one outside the legs the window spans, one in a seat that is not the port, one naming the path they already hold and one at the port in season: each is refused or allowed in the words the panel prints, and only the last of them can switch",
  );
  check(
    pathSwitchBlocked(atPort, wantedPath) === null &&
      pathSwitchBlocked(
        { ...atPort, money: pathSwitchFee(atPort.renownLevel) - 1 },
        wantedPath,
      ) ===
        `❌ Need ${pathSwitchFee(atPort.renownLevel)} Gold to change your papers.`,
    "and a purse that cannot answer the price is refused last, after everything about where and when, so a captain is never told what a switch costs instead of why they cannot make one",
  );
  const refusedBoard = atSea(4, "dawn", heldPath, 500);
  const refusedLines: string[] = [];
  check(
    applyPathSwitch(refusedBoard, wantedPath, refusedLines) === false &&
      refusedBoard.path === heldPath &&
      refusedBoard.pathSwitchLeg === 0 &&
      refusedBoard.money === 500 &&
      refusedLines[0] ===
        "Papers are changed at the port, in Market, Orders or Parley.",
    "a switch attempted in a seat the port does not keep is refused with the reason written into the captain's own ledger and nothing charged: a refusal costs a captain nothing but the sentence",
  );
  check(
    pathSwitchOpenLine(4, "orders") === null &&
      pathSwitchOpenLine(4, "dawn") ===
        pathSwitchBlocked(atSea(4, "dawn", heldPath, 500), wantedPath) &&
      pathSwitchOpenLine(2, "dawn") ===
        pathSwitchBlocked(atSea(2, "dawn", heldPath, 500), wantedPath),
    "and the room asks the same function the engine does, so a switch the fleet is shown is a switch the captain's own books would accept: the season and the seat are one sentence told twice",
  );

  // The plan's rollback, and it is one switch: with the draft off nothing
  // deals a path, so the change of papers has no precondition to meet and
  // says so in its first sentence rather than in a rule written for the
  // rolled back build.
  check(
    withEnv("NEXT_PUBLIC_PATH_DRAFT", "off", () => !pathDraftOn(GAMBIT)) &&
      withEnv("NEXT_PUBLIC_PATH_DRAFT", "on", () => pathDraftOn(GAMBIT)) &&
      pathSwitchBlocked(voyageState(), "loom") ===
        "You hold no path to set aside.",
    "the draft's own switch reads off the environment and defaults to on, and the pathless captain it leaves behind is refused by the same first sentence a captain who never drew one meets, so the rolled back build needs no second rule",
  );

  // ---- the deal, played on a real harbor ----
  // Two captains, because a pass needs a seat to pass to and a hand's
  // privacy is only observable with a second set of frames to compare
  // against. Every frame both sockets receive is kept, and the deal is
  // read back against the rule module's own composition: what the room
  // deals is what this tree says a table of two is owed, to the last card.
  const draftHost = await signUp("draft_a");
  const draftMate = await signUp("draft_b");
  run.extraAccounts.push(draftHost, draftMate);
  const draftRoom = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: draftHost.cookie,
      body: JSON.stringify({
        name: `Smoke draft harbor ${suffix}`,
        isPublic: false,
        mode: "ocean_gambit",
        unlock: LEDGER_PHRASE,
      }),
    },
  );
  if (draftRoom.status !== 200) {
    throw new Error("No draft harbor to deal into, stopping here.");
  }
  const draftRoomId = draftRoom.body.room.id;
  run.lapRoomIds.push(draftRoomId);
  await call("/api/rooms/join", {
    method: "POST",
    cookie: draftMate.cookie,
    body: JSON.stringify({ code: draftRoom.body.room.code }),
  });

  type DraftSeat = {
    captain: Captain;
    socket: Socket;
    views: DraftView[];
    frames: Array<{ event: string; text: string }>;
    closed: number;
    switched: PathSwitched[];
    errors: string[];
  };
  // One seat's ears, attached as a function because the mate's seat is
  // filled twice in this block: the socket that goes dark and the fresh one
  // that re seats the same captain must both record into the same seat, or
  // the privacy sweep at the end would read half a wire.
  const recordSeat = (seat: DraftSeat, socket: Socket): void => {
    // Every frame this socket receives, on any event rather than on the
    // three the draft is known to use, so the privacy check at the end of
    // the deal reads the wire rather than the events the feature happens
    // to name today: a hand that left under a second event name is
    // exactly what a listener per event cannot see.
    socket.onAny((event: string, ...args: unknown[]) => {
      seat.frames.push({ event, text: JSON.stringify(args) });
    });
    socket.on("draft:update", (payload: DraftView | null) => {
      if (payload === null) seat.closed += 1;
      else if (payload?.roomId === draftRoomId) seat.views.push(payload);
    });
    socket.on("path:switched", (payload: PathSwitched) => {
      if (payload?.roomId === draftRoomId) seat.switched.push(payload);
    });
    socket.on("path:error", (payload: { roomId?: string; error?: string }) => {
      if (
        payload?.roomId === draftRoomId &&
        typeof payload.error === "string"
      ) {
        seat.errors.push(payload.error);
      }
    });
  };
  const draftSeats: DraftSeat[] = [];
  for (const captain of [draftHost, draftMate]) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const seat: DraftSeat = {
      captain,
      socket,
      views: [],
      frames: [],
      closed: 0,
      switched: [],
      errors: [],
    };
    recordSeat(seat, socket);
    const seated = waitForEvent<WireHistory>(
      socket,
      "chat:history",
      (payload) => payload?.roomId === draftRoomId,
    );
    socket.emit("room:join", { roomId: draftRoomId });
    await seated;
    draftSeats.push(seat);
  }
  // The two lines the settle writes, collected off the host's own socket
  // rather than waited for one at a time: a draft's log lines are one
  // fact per seat and arrive together, so a reader that waited for the
  // first and then the second would be waiting on the same frame twice.
  const takenLines: VoyageLogEntry[] = [];
  draftSeats[0]!.socket.on(
    "voyage:log",
    (payload: { entry?: VoyageLogEntry }) => {
      if (payload?.entry?.kind === "path_taken") takenLines.push(payload.entry);
    },
  );

  const firstBeats = draftSeats.map((seat) =>
    waitForEvent<DraftView>(
      seat.socket,
      "draft:update",
      (payload) => payload?.roomId === draftRoomId && payload?.step === "first",
      15000,
    ),
  );
  draftSeats[0]!.socket.emit("room:start", { roomId: draftRoomId });
  const openingViews = await Promise.all(firstBeats);
  check(
    openingViews.every(
      (view) =>
        view !== null &&
        view.hand.length === DRAFT_DEAL &&
        view.open === 2 &&
        view.path === null,
    ),
    "every captain at the table is dealt their own three cards face down and told the whole table is still to choose, and nobody holds a path until the last step closes",
  );
  const openingHands = openingViews.map((view) => view!.hand);
  const openingCounts = PATH_IDS.reduce(
    (tally, id) => {
      tally[id] = openingHands.flat().filter((card) => card === id).length;
      return tally;
    },
    {} as Record<PathId, number>,
  );
  const deckOwed = draftComposition(2);
  check(
    PATH_IDS.every((id) => openingCounts[id] === deckOwed[id]) &&
      deckOwed.quartermaster >= DRAFT_QUARTERMASTER_MIN,
    `the two hands on the table are the deck this tree says a table of two is owed, to the last card (${PATH_IDS.map((id) => `${id} ${openingCounts[id]}`).join(", ")})`,
  );

  // The host keeps the card the plan's evaluation watches for and the
  // mate's seat goes dark: absence rather than silence is what arms the
  // room's one timer, because a captain who is present and thinking holds
  // the table however long they take (see the header of
  // src/server/realtime/draft.ts). The socket going is the beat the old
  // interface proved with a countdown.
  const pickOf = (hand: readonly PathId[]): number => {
    const quartermaster = hand.indexOf("quartermaster");
    return quartermaster >= 0 ? quartermaster : DRAFT_AUTO_PICK;
  };
  const hostFirstPick = pickOf(openingHands[0]!);
  // The step a pick was read off rides the answer, and the room holds
  // that at the door: an index is only a card against one hand, so an
  // answer stamped with a step the table is not standing in is refused
  // rather than read against the cards in front of it. The beat is the
  // one the article's own settle checks turn on, because the hands
  // change at every turn over and a misread index would settle a captain
  // on a paper they never chose. This probe lays nothing, which the keep
  // below proves by being accepted: the host's own first card goes down
  // a line later and the table counts it.
  const staleReading = waitForEvent<{ roomId?: string; error?: string }>(
    draftSeats[0]!.socket,
    "draft:error",
    (payload) => payload?.roomId === draftRoomId,
  );
  draftSeats[0]!.socket.emit("draft:keep", {
    roomId: draftRoomId,
    pick: hostFirstPick,
    step: "last",
  });
  check(
    (await staleReading)?.error === "The table has moved past that step.",
    "an answer stamped with a step the table has left is refused for the step it names rather than read against the hand in front of it, so a pick that crossed a step's close can never settle a captain on a card they never chose",
  );
  const countDropping = waitForEvent<DraftView>(
    draftSeats[0]!.socket,
    "draft:update",
    (payload) =>
      payload?.roomId === draftRoomId &&
      payload?.step === "first" &&
      payload?.open === 1,
  );
  const hostSecond = waitForEvent<DraftView>(
    draftSeats[0]!.socket,
    "draft:update",
    (payload) => payload?.roomId === draftRoomId && payload?.step === "second",
    DRAFT_WATCH_MS + 10000,
  );
  draftSeats[0]!.socket.emit("draft:keep", {
    roomId: draftRoomId,
    pick: hostFirstPick,
    step: openingViews[0]!.step,
  });
  check(
    (await countDropping)?.open === 1,
    "a card laid down is counted for the whole table rather than held by the server, so the captains still reading know whether they are waiting on four people or on one",
  );
  const secondCard = waitForEvent<{ roomId?: string; error?: string }>(
    draftSeats[0]!.socket,
    "draft:error",
    (payload) => payload?.roomId === draftRoomId,
  );
  draftSeats[0]!.socket.emit("draft:keep", {
    roomId: draftRoomId,
    pick: hostFirstPick,
    step: openingViews[0]!.step,
  });
  check(
    (await secondCard)?.error === "Your card is already laid down.",
    "and a captain who lays a second card down in the same step is told what happened rather than ignored, because the first answer is the one the table has been shown",
  );
  // The mate's tab closes. The room gives a gone seat DRAFT_WATCH_MS to
  // come back and then lays the first card of that captain's own hand,
  // which is what closes the step. The beat is timed from the socket going
  // rather than from a constant, so the check below reads the window the
  // room actually waited rather than the window it was supposed to.
  const awayAt = Date.now();
  draftSeats[1]!.socket.close();
  const atSecond = (await hostSecond)!;
  check(
    atSecond !== null &&
      atSecond.hand.length === 2 &&
      Date.now() - awayAt >= DRAFT_WATCH_MS - 2000,
    "a step a gone seat never answered stays open through the room's whole absence window and then closes on that window alone, so what turns a step over is the table answering rather than any clock face, and the two cards the gone seat was passed travel without them having chosen anything",
  );
  // And the same captain answering a step the table has left, which is the
  // other direction from the probe above: a delayed duplicate of their own
  // first keep, arriving after the turnover. The index would be read
  // against the second step's hand if the stamp were trusted, so the room
  // owes the refusal, and what proves the refusal cost the seat nothing is
  // the seat still being open for that captain's real answer below.
  const pastStep = waitForEvent<{ roomId?: string; error?: string }>(
    draftSeats[0]!.socket,
    "draft:error",
    (payload) => payload?.roomId === draftRoomId,
  );
  draftSeats[0]!.socket.emit("draft:keep", {
    roomId: draftRoomId,
    pick: hostFirstPick,
    step: openingViews[0]!.step,
  });
  check(
    (await pastStep)?.error === "The table has moved past that step.",
    "a keep stamped with the step the table has left is refused for the step it names rather than read against the hand it would find now, so a duplicate of an earlier answer can never settle a captain on the cards of a later step",
  );
  const laidNothing = waitForEvent<DraftView>(
    draftSeats[0]!.socket,
    "draft:update",
    (payload) => payload?.roomId === draftRoomId && payload?.step === "second",
  );
  draftSeats[0]!.socket.emit("draft:state:request", { roomId: draftRoomId });
  const openNow = await laidNothing;
  check(
    openNow !== null && openNow.picked === false && openNow.hand.length === 2,
    "and the refused answer left nothing down: the seat reads back open in the step the table is standing in, which is what lets that captain's own answer for the step be the one the table counts",
  );
  // The mate walks back in, inside the thirty second departure grace the
  // room keeps for a returning seat (see scheduleDeparture): a fresh socket
  // for the same captain, whose join is answered with the step the room is
  // standing in rather than the one the seat left.
  const mateBack = await openAuthedSocket(draftMate);
  run.sockets.push(mateBack);
  draftSeats[1]!.socket = mateBack;
  recordSeat(draftSeats[1]!, mateBack);
  const mateSecond = waitForEvent<DraftView>(
    mateBack,
    "draft:update",
    (payload) => payload?.roomId === draftRoomId && payload?.step === "second",
  );
  const mateSeated = waitForEvent<WireHistory>(
    mateBack,
    "chat:history",
    (payload) => payload?.roomId === draftRoomId,
  );
  mateBack.emit("room:join", { roomId: draftRoomId });
  await mateSeated;
  const mateAtSecond = (await mateSecond)!;
  check(
    mateAtSecond !== null && mateAtSecond.hand.length === 2,
    "and the seat that walks back in is handed the step the room is in rather than the beat it left, so what a returning captain is shown is the cards that are actually on the table",
  );
  // The pass, read off both frames: each captain holds the two cards the
  // other did not keep, in the order they were dealt and not kept in. The
  // order is part of the promise, because a pick is an index into this
  // array: a frame whose cards are in another order would have the client
  // choosing by one numbering and the room counting by another.
  const mateRests = openingHands[1]!.filter(
    (_, index) => index !== DRAFT_AUTO_PICK,
  );
  const hostRests = openingHands[0]!.filter(
    (_, index) => index !== hostFirstPick,
  );
  check(
    atSecond.hand.join() === mateRests.join() &&
      mateAtSecond.hand.join() === hostRests.join(),
    "and each of them holds the two cards the other captain did not keep, in the order the other was holding them: the pass travels to the left, and the cards arrive as a hand a captain can still pick out of",
  );
  check(
    draftSeats[1]!.errors.length === 0,
    "the captain whose seat went dark is never told they did anything wrong, and the card the room laid for them was one of their own",
  );

  // The second keep and then the last, and the two answers a captain
  // sends into them are not the same kind of answer. The host is present
  // and answers both in person. The mate's seat went dark inside the
  // first step, so the room's absence watch has already laid that seat's
  // second card by the time the seat walks back in (the fire carries a
  // whole step over, and the check beside the close above is the one
  // that watched it happen). The mate's own second keep therefore lands
  // on a card that is already down or on a step the table has left,
  // depending on how the two keeps race, and is refused either way; what
  // the article reads is that the refusal costs the seat nothing, because
  // the mate's last keep is their real answer, the settle takes it, and
  // the path that captain sails on is the paper they chose. The keeps
  // below each name the step they were read off, which is what makes
  // that the whole of the story rather than a race. Because the second
  // keep is refused, the second paper the room records for that seat is
  // the one the watch laid, and the expectation below reads the room's
  // record rather than the refused attempt: reading the attempt there
  // passed only on the deals where the attempt and the auto pick landed
  // on the same index, which the dealt odds put at about thirteen runs
  // in fifteen.
  const hostLast = waitForEvent<DraftView>(
    draftSeats[0]!.socket,
    "draft:update",
    (payload) => payload?.roomId === draftRoomId && payload?.step === "last",
  );
  const mateLast = waitForEvent<DraftView>(
    draftSeats[1]!.socket,
    "draft:update",
    (payload) => payload?.roomId === draftRoomId && payload?.step === "last",
  );
  const hostSettled = waitForEvent<DraftView>(
    draftSeats[0]!.socket,
    "draft:update",
    (payload) => payload?.roomId === draftRoomId && payload?.step === "done",
  );
  const mateSettled = waitForEvent<DraftView>(
    draftSeats[1]!.socket,
    "draft:update",
    (payload) => payload?.roomId === draftRoomId && payload?.step === "done",
  );
  const hostSecondPick = pickOf(atSecond.hand);
  const mateSecondPick = pickOf(mateAtSecond.hand);
  draftSeats[0]!.socket.emit("draft:keep", {
    roomId: draftRoomId,
    pick: hostSecondPick,
    step: atSecond.step,
  });
  draftSeats[1]!.socket.emit("draft:keep", {
    roomId: draftRoomId,
    pick: mateSecondPick,
    step: mateAtSecond.step,
  });
  const hostAtLast = (await hostLast)!;
  const mateAtLast = (await mateLast)!;
  const hostPapers = [
    openingHands[0]![hostFirstPick]!,
    atSecond.hand[hostSecondPick]!,
  ];
  const matePapers = [
    openingHands[1]![DRAFT_AUTO_PICK]!,
    mateAtSecond.hand[DRAFT_AUTO_PICK]!,
  ];
  check(
    hostAtLast !== null &&
      mateAtLast !== null &&
      hostAtLast.hand.join() === hostPapers.join() &&
      mateAtLast.hand.join() === matePapers.join(),
    "the last step is the two papers that captain kept, in the order they kept them, so the choice is between a card out of their own deal and a card they kept off the pass rather than between two cards somebody else chose",
  );
  // The host keeps the card on offer and the mate the other of their two,
  // which is the plan's own evaluation read as a fixture: taking the card
  // in the deck the plan watches for is a choice somebody makes rather
  // than a duty somebody gets assigned, so the two captains at this table
  // end on different papers for different reasons.
  const hostLastPick = pickOf(hostAtLast.hand);
  const mateLastPick = mateAtLast.hand.length - 1 - pickOf(mateAtLast.hand);
  draftSeats[0]!.socket.emit("draft:keep", {
    roomId: draftRoomId,
    pick: hostLastPick,
    step: hostAtLast.step,
  });
  draftSeats[1]!.socket.emit("draft:keep", {
    roomId: draftRoomId,
    pick: mateLastPick,
    step: mateAtLast.step,
  });
  const settledViews = [await hostSettled, await mateSettled];
  const hostPath = hostAtLast.hand[hostLastPick]!;
  const matePath = mateAtLast.hand[mateLastPick]!;
  check(
    settledViews[0]?.path === hostPath &&
      settledViews[1]?.path === matePath &&
      settledViews[0]?.open === 0 &&
      settledViews.every((view) => view?.step === "done"),
    "when the last card is laid the draft settles and every seat is told the path it sails on, which is the card that captain held on to: the whole of the result rides the settled view rather than a frame of its own",
  );
  for (let waited = 0; takenLines.length < 2 && waited < 8000; waited += 100) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  check(
    takenLines.length === 2 &&
      takenLines.every(
        (entry) =>
          entry.round === 1 &&
          [hostPath, matePath].some((path) =>
            entry.text.includes(pathConfig(path)!.name),
          ),
      ) &&
      takenLines.some(
        (entry) =>
          entry.text ===
          `Smoke draft_a takes up the ${pathConfig(hostPath)!.name} path.`,
      ) &&
      takenLines.some(
        (entry) =>
          entry.text ===
          `Smoke draft_b takes up the ${pathConfig(matePath)!.name} path.`,
      ),
    "and the fleet is told what each captain took in the voyage log, once a seat, at the leg the draft was dealt in and named by the captain rather than by the card",
  );

  // ---- the hand, read back off the wire ----
  // What the checks above cannot show, because every one of them reads a
  // frame that named the draft rather than what the two sockets were
  // actually sent. `hand` is a field of one wire type and one only (see
  // DraftView), so a frame that names one is either a seat's own draft
  // frame or a hand that travelled somewhere it was not addressed, and
  // the second reading is the one that matters: a hand that changes
  // inside a single beat is a card that belongs to somebody else, since a
  // beat is dealt to one seat once and no pick moves the cards until the
  // step closes. The reading is taken here, after the settle and after
  // both log lines have landed, because that is the moment the wire is
  // provably quiet: the settle sends each seat its view before it writes
  // the line for that seat, so a socket that has heard its line has heard
  // its view, and a sweep taken any earlier could miss a frame still in
  // flight and call the wire clean by arriving first.
  const strayHands = draftSeats.flatMap((seat) => {
    const beats = new Map<string, string>();
    return seat.frames.flatMap((frame) => {
      if (!frame.text.includes('"hand":')) return [];
      const [payload] = JSON.parse(frame.text) as [DraftView | null];
      if (frame.event !== "draft:update" || !payload) {
        return [`a hand rode ${frame.event} to ${seat.captain.username}`];
      }
      // A beat is named by its step, which the wire carries and a clock
      // used to shadow: the deadline that stood here went with the
      // countdown, and a step is still dealt to one seat once with no
      // pick moving its cards until the next one.
      const key = payload.step;
      const hand = payload.hand.join(".");
      const seen = beats.get(key);
      if (seen === undefined) {
        beats.set(key, hand);
        return [];
      }
      return seen === hand
        ? []
        : [`${seat.captain.username} was sent two hands for ${key}`];
    });
  });
  check(
    strayHands.length === 0,
    `the only frames either socket received that name a hand are the draft's own, one hand a captain a beat (${draftSeats.reduce((count, seat) => count + seat.frames.length, 0)} frames read on every event across the two sockets), so a hand is private in its whole shape: the frame goes to the captain it was dealt to and to no one else`,
  );

  // ---- the seat the settle could not reach ----
  // The bug cycle's own shape, fixed in the reader: the settled view is
  // emitted to sockets and the draft is deleted in the same breath, so a
  // captain whose socket was dark from the last pick through the settle
  // was sent the result into nothing and every later request answered
  // null, leaving their save pathless while the fleet's log and the
  // room's book went on naming their path. The book the settle wrote
  // still holds it, and the join below is the request a reload sends
  // (see draftViewFor). The socket is kept off the seats above on
  // purpose: it hears the result frame rather than a beat, and the sweep
  // over there judges the deal's beats.
  const walkedBack = await openAuthedSocket(draftMate);
  run.sockets.push(walkedBack);
  const repaired = waitForEvent<DraftView>(
    walkedBack,
    "draft:update",
    (payload) => payload?.roomId === draftRoomId && payload?.step === "done",
  );
  const walkedSeated = waitForEvent<WireHistory>(
    walkedBack,
    "chat:history",
    (payload) => payload?.roomId === draftRoomId,
  );
  walkedBack.emit("room:join", { roomId: draftRoomId });
  await walkedSeated;
  const repairedView = await repaired;
  check(
    repairedView !== null &&
      repairedView.path === matePath &&
      repairedView.hand.join() === matePath &&
      repairedView.open === 0,
    "a captain whose socket was dark through the settle is handed the result when they walk back into the harbor: the path the fleet was told rides the same settled view a live seat heard, so the deal cannot be lost to a tab that was closed while the last card was laid",
  );
  // The other end of the same race, both ways. A captain's last press can
  // be in flight while the settle runs, and the request a reloading tab
  // sends can arrive after it: the press is answered with the sentence for
  // a draft that is not running rather than read against a book that has
  // already been written, and the request is answered from that book with
  // the view the seat was sent, the same answer every time it is asked.
  // The fleet's own count is read before either question, because a
  // re-settle would show up as a second pair of log lines before it showed
  // up anywhere else.
  const linesHeard = takenLines.length;
  const settledKeep = waitForEvent<{ roomId?: string; error?: string }>(
    walkedBack,
    "draft:error",
    (payload) => payload?.roomId === draftRoomId,
  );
  walkedBack.emit("draft:keep", {
    roomId: draftRoomId,
    pick: mateLastPick,
    step: "last",
  });
  check(
    (await settledKeep)?.error === "The draft is not running.",
    "a keep that crossed the settle is refused for the draft that is not running rather than read against the step it stamped, so a last press in flight can neither settle a captain twice nor write a line the fleet has already been told",
  );
  const readSettled = async (): Promise<DraftView | null> => {
    const answered = waitForEvent<DraftView>(
      walkedBack,
      "draft:update",
      (payload) => payload?.roomId === draftRoomId && payload?.step === "done",
    );
    walkedBack.emit("draft:state:request", { roomId: draftRoomId });
    return answered;
  };
  const askedAgain = await readSettled();
  const askedTwice = await readSettled();
  check(
    askedAgain !== null &&
      askedTwice !== null &&
      askedAgain.step === "done" &&
      askedAgain.path === matePath &&
      askedAgain.hand.join() === matePath &&
      askedAgain.open === 0 &&
      askedAgain.picked === true &&
      askedTwice.step === askedAgain.step &&
      askedTwice.path === askedAgain.path &&
      askedTwice.hand.join() === askedAgain.hand.join() &&
      askedTwice.open === askedAgain.open &&
      askedTwice.picked === askedAgain.picked,
    "and the done frame is idempotent: the settled view is the same answer on every read, the seat speaks as one whose card is already down rather than one holding an open hand, and a tab that reloads after the settle reads its own result as many times as it likes",
  );
  check(
    takenLines.length === linesHeard,
    "with the fleet's log exactly as long as it was before either question, so the result is read back rather than dealt again",
  );

  // ---- the switch, published to the fleet ----
  // The captain who drew the older papers is the one who changes them, and
  // the frame that comes back is the room's answer rather than their own
  // press: the fee, the forfeiture and the stamp are theirs to apply, and
  // nothing here charges anybody.
  const switcher = draftSeats[0]!;
  const other = draftSeats[1]!;
  const otherPath = PATH_IDS.find((id) => id !== hostPath)!;
  const tooEarly = waitForEvent<{ roomId?: string; error?: string }>(
    switcher.socket,
    "path:error",
    (payload) => payload?.roomId === draftRoomId,
  );
  switcher.socket.emit("path:switch", {
    roomId: draftRoomId,
    path: otherPath,
  });
  check(
    (await tooEarly)?.error ===
      `The harbor reads new papers from round ${PATH_SWITCH_FROM_ROUND}.`,
    "a switch pressed in the leg the voyage opens on is refused by the room with the season it is waiting for, and nothing is published",
  );
  check(
    switcher.switched.length === 0 && other.switched.length === 0,
    "so the fleet has heard nothing, which is what makes the publication the price of the change rather than a line about it",
  );

  // The room's seat, moved the way this suite moves any room's seat, to a
  // leg and a seat the port keeps.
  const draftRoomRow = async () =>
    db.room.findUnique({
      where: { id: draftRoomId },
      select: { currentRound: true, currentPhase: true },
    });
  const parkDraftRoom = async (round: number, phase: Phase) => {
    switcher.socket.emit("game:status", {
      roomId: draftRoomId,
      round,
      phase,
      phaseLabel: phaseFace(phase).label,
      gold: 500,
      reputation: 12,
      shipLevel: 0,
      gameOver: false,
      renownLevel: 4,
    });
    let row = await draftRoomRow();
    for (
      let waited = 0;
      (row?.currentRound !== round || row?.currentPhase !== phase) &&
      waited < 5000;
      waited += 250
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      row = await draftRoomRow();
    }
    return row;
  };
  // The first leg the window opens on, named once so that the reading of
  // the published frame below is of this same leg rather than of a number
  // written out twice.
  const switchLegRound = PATH_SWITCH_FROM_ROUND + 1;
  const atThePort = await parkDraftRoom(switchLegRound, "orders");
  check(
    atThePort?.currentRound === switchLegRound &&
      atThePort?.currentPhase === "orders",
    "and the room can be walked to a leg and a seat where the port reads new papers",
  );
  const nonsense = waitForEvent<{ roomId?: string; error?: string }>(
    switcher.socket,
    "path:error",
    (payload) => payload?.roomId === draftRoomId,
  );
  switcher.socket.emit("path:switch", {
    roomId: draftRoomId,
    path: "galleon",
  });
  check(
    (await nonsense)?.error === "No such path.",
    "a switch naming a path this build does not have is refused at the room rather than published to it, since the fleet log is a record rather than a place to try things out",
  );
  const published = waitForEvent<PathSwitched>(
    other.socket,
    "path:switched",
    (payload) =>
      payload?.roomId === draftRoomId && payload?.userId === draftHost.id,
  );
  const logged = waitForEvent<{ entry: VoyageLogEntry }>(
    other.socket,
    "voyage:log",
    (payload) => payload?.entry?.kind === "path_switched",
  );
  switcher.socket.emit("path:switch", {
    roomId: draftRoomId,
    path: otherPath,
  });
  const publishedFrame = await published;
  check(
    publishedFrame?.path === otherPath &&
      publishedFrame.name === "Smoke draft_a" &&
      switcher.switched.length === 1,
    "a switch in season is published to the whole room, the captain who made it included, and it carries the path taken up and not the one set aside, because the server has never read a save to know what that was",
  );
  check(
    (await logged)?.entry?.text ===
      `Smoke draft_a sets aside their old papers and takes up the ${pathConfig(otherPath)!.name} path.`,
    "and the fleet log keeps the line, which is the record the table reads back rather than the frame it watched",
  );
  const again = waitForEvent<{ roomId?: string; error?: string }>(
    switcher.socket,
    "path:error",
    (payload) => payload?.roomId === draftRoomId,
  );
  switcher.socket.emit("path:switch", {
    roomId: draftRoomId,
    path: matePath,
  });
  check(
    (await again)?.error ===
      "A captain changes their papers once a voyage, and yours are already changed." &&
      switcher.switched.length === 1,
    "and a second change in the same voyage is refused by the room's own book, which is the half of the once a voyage rule a server can keep",
  );
  const offSeat = await parkDraftRoom(5, "dawn");
  const notAtPort = waitForEvent<{ roomId?: string; error?: string }>(
    other.socket,
    "path:error",
    (payload) => payload?.roomId === draftRoomId,
  );
  other.socket.emit("path:switch", { roomId: draftRoomId, path: "convoy" });
  const notAtPortFrame = await notAtPort;
  check(
    offSeat?.currentPhase === "dawn" &&
      notAtPortFrame?.error ===
        "Papers are changed at the port, in Market, Orders or Parley." &&
      // The mate's own socket is carrying the host's switch, which the
      // room published to the whole fleet, so what is read here is that
      // no frame names the mate rather than that the socket is empty.
      other.switched.every((frame) => frame.userId === draftHost.id),
    "while a captain in a seat that is not the port is refused in the engine's own words, so the room and the books tell a captain the same thing",
  );
  const late = await parkDraftRoom(PATH_SWITCH_TO_ROUND + 1, "orders");
  const closed = waitForEvent<{ roomId?: string; error?: string }>(
    other.socket,
    "path:error",
    (payload) => payload?.roomId === draftRoomId,
  );
  other.socket.emit("path:switch", { roomId: draftRoomId, path: "convoy" });
  check(
    late?.currentRound === PATH_SWITCH_TO_ROUND + 1 &&
      (await closed)?.error ===
        `The window for new papers closed after round ${PATH_SWITCH_TO_ROUND}.`,
    "and past the last leg of the window the room closes it with the leg it closes after, which is the same sentence the panel would have greyed the button out with",
  );

  // ---- one departure for one press, however it arrives ----
  // The departure handler's claim is taken before its first await, and
  // this is that sentence read off the wire: two room:start frames in one
  // tick must move the harbor exactly as one did. Before the claim moved,
  // both frames passed a map checked after the reads (the room read, the
  // roster read), both ran the whole departure, and both dealt the table,
  // which is the shape the field report's crash wore: one voyage
  // announced twice and two alignment deals colliding on the table's own
  // key. A double tap, a retried frame and a second tab all arrive as
  // these two frames, so the room below is the regression that keeps the
  // claim where it is.
  const racer = await signUp("race");
  run.extraAccounts.push(racer);
  const raceRoom = await call<{ room: { id: string } }>("/api/rooms", {
    method: "POST",
    cookie: racer.cookie,
    body: JSON.stringify({
      name: `Smoke draft race harbor ${suffix}`,
      isPublic: false,
      mode: "ocean_gambit",
      unlock: LEDGER_PHRASE,
    }),
  });
  if (raceRoom.status !== 200) {
    throw new Error("No race harbor to start, stopping here.");
  }
  const raceRoomId = raceRoom.body.room.id;
  run.lapRoomIds.push(raceRoomId);
  const raceSocket = await openAuthedSocket(racer);
  run.sockets.push(raceSocket);
  let raceStarts = 0;
  let raceErrors = 0;
  let raceClosed = 0;
  const raceViews: DraftView[] = [];
  raceSocket.on("room:started", (payload: { roomId?: string }) => {
    if (payload?.roomId === raceRoomId) raceStarts += 1;
  });
  raceSocket.on("room:error", () => {
    raceErrors += 1;
  });
  raceSocket.on("draft:update", (payload: DraftView | null) => {
    // The null frame carries no room, so it is counted as itself: it is
    // the sentence a harbor tells a captain with no draft in front of
    // them, on the way in and again the moment a wipe takes one away.
    if (payload === null) {
      raceClosed += 1;
      return;
    }
    if (payload.roomId === raceRoomId) raceViews.push(payload);
  });
  const raceSeated = waitForEvent<WireHistory>(
    raceSocket,
    "chat:history",
    (payload) => payload?.roomId === raceRoomId,
  );
  raceSocket.emit("room:join", { roomId: raceRoomId });
  await raceSeated;
  const raceDeal = waitForEvent<DraftView>(
    raceSocket,
    "draft:update",
    (payload) => payload?.roomId === raceRoomId && payload?.step === "first",
  );
  raceSocket.emit("room:start", { roomId: raceRoomId });
  raceSocket.emit("room:start", { roomId: raceRoomId });
  const raceCards = await raceDeal;
  const raceClosedAtDeal = raceClosed;
  // Long enough for a second departure to have announced itself and sent
  // a second hand if the claim had missed it: a departure's whole body
  // runs in well under this once its reads are warm.
  await new Promise((resolve) => setTimeout(resolve, 600));
  check(
    raceCards?.hand.length === DRAFT_DEAL &&
      raceStarts === 1 &&
      raceErrors === 0 &&
      raceViews.filter((view) => view.step === "first" && view.picked === false)
        .length === 1,
    "a departure pressed twice in one tick is one departure: the harbor announces one start, the second press is answered by the claim rather than by a refusal, and the table is dealt one hand rather than two",
  );
  const refusedAgain = waitForEvent<{ roomId?: string; error?: string }>(
    raceSocket,
    "room:error",
    (payload) => payload?.roomId === raceRoomId,
  );
  raceSocket.emit("room:start", { roomId: raceRoomId });
  check(
    (await refusedAgain)?.error === "This voyage has already set sail.",
    "while an honest second press after the departure is still refused with the room's own sentence, which is the refusal the claim is not allowed to swallow",
  );
  // The room the doubled press sailed goes home cleanly: the draft that
  // did stand ends with its voyage rather than outliving it, told away
  // with the same null frame the solo wipe above is read against.
  const raceWiped = waitForEvent<{ roomId?: string }>(
    raceSocket,
    "room:restarted",
    (payload) => payload?.roomId === raceRoomId,
  );
  raceSocket.emit("room:restart", { roomId: raceRoomId });
  check(
    (await raceWiped) !== null && raceClosed === raceClosedAtDeal + 1,
    "and the harbor sailed by the doubled press wipes clean, the one draft it dealt told away with the wipe's own null frame, so the one voyage it ran is one its host can end",
  );

  // ---- the wipe that takes a draft with it ----
  // The plan's own rollback note is "draft state is transient per voyage,
  // so nothing durable is at risk", and this is that sentence read as a
  // frame: a harbor wiped while its captains are still reading their cards
  // tells them there is no draft rather than leaving three cards in front
  // of a table that has already set sail again.
  const solo = await signUp("draft_s");
  run.extraAccounts.push(solo);
  const soloRoom = await call<{ room: { id: string } }>("/api/rooms", {
    method: "POST",
    cookie: solo.cookie,
    body: JSON.stringify({
      name: `Smoke draft wipe harbor ${suffix}`,
      isPublic: false,
      mode: "ocean_gambit",
      unlock: LEDGER_PHRASE,
    }),
  });
  if (soloRoom.status !== 200) {
    throw new Error("No draft harbor to wipe, stopping here.");
  }
  const soloRoomId = soloRoom.body.room.id;
  run.lapRoomIds.push(soloRoomId);
  const soloSocket = await openAuthedSocket(solo);
  run.sockets.push(soloSocket);
  let soloClosed = 0;
  soloSocket.on("draft:update", (payload: DraftView | null) => {
    if (payload === null) soloClosed += 1;
  });
  const soloSeated = waitForEvent<WireHistory>(
    soloSocket,
    "chat:history",
    (payload) => payload?.roomId === soloRoomId,
  );
  soloSocket.emit("room:join", { roomId: soloRoomId });
  await soloSeated;
  const soloDeal = waitForEvent<DraftView>(
    soloSocket,
    "draft:update",
    (payload) => payload?.roomId === soloRoomId && payload?.step === "first",
  );
  soloSocket.emit("room:start", { roomId: soloRoomId });
  const soloCards = await soloDeal;
  // What this seat has heard before the wipe, which is one null: a harbor
  // that has not dealt a card tells the captain who walks into it that
  // there is no draft, and that is the frame the client draws nothing for.
  // It is counted here rather than assumed so that the wipe below is read
  // as a frame of its own rather than as "some null or other".
  const closedAtJoin = soloClosed;
  const soloWiped = waitForEvent<{ roomId: string }>(
    soloSocket,
    "room:restarted",
    (payload) => payload?.roomId === soloRoomId,
  );
  soloSocket.emit("room:restart", { roomId: soloRoomId });
  check(
    soloCards?.hand.length === DRAFT_DEAL && soloCards.open === 1,
    "a captain sailing alone is dealt a hand like any other, and the whole table is still to choose",
  );
  const soloWipedFrame = await soloWiped;
  check(
    soloWipedFrame !== null && closedAtJoin === 1 && soloClosed === 2,
    "and a harbor wiped while that draft is being read tells the seat holding the cards, once, that there is no draft, which is the frame the client puts the table away on: the only other time that seat heard it was walking in before the voyage had dealt anything",
  );

  // ---- the record the draft leaves behind ----
  // The telemetry spine's two D7 numbers, read off the row the draft
  // room's own wipe writes rather than off the frames above: the path each
  // captain took up and the seconds that captain's interface took. A
  // record is written when a voyage closes, so the room is wiped here,
  // and that is a reading of its own: the wipe must not be able to drop
  // what the draft measured before it.
  const draftWiped = waitForEvent<{ roomId?: string }>(
    draftSeats[0]!.socket,
    "room:restarted",
    (payload) => payload?.roomId === draftRoomId,
    8000,
  );
  draftSeats[0]!.socket.emit("room:restart", { roomId: draftRoomId });
  check(
    (await draftWiped) !== null,
    "the draft's own harbor is wiped once its work is done",
  );
  const draftRecord = (await telWaitForOne(draftRoomId))?.record ?? null;
  const draftTaken = (draftRecord?.events ?? []).filter(
    (event) => event.name === "path_taken",
  );
  const draftSwitched = (draftRecord?.events ?? []).filter(
    (event) => event.name === "path_switched",
  );
  const takenBy = (actor: string) =>
    draftTaken.find((event) => event.actor === actor)?.path ?? null;
  check(
    draftRecord !== null &&
      draftRecord.outcome === "restarted" &&
      draftTaken.length === 2 &&
      draftTaken.every(
        (event) =>
          event.seconds >= 0 &&
          [hostPath, matePath].some((path) => path === event.path) &&
          [draftHost.id, draftMate.id].some((id) => id === event.actor),
      ) &&
      takenBy(draftHost.id) === hostPath &&
      takenBy(draftMate.id) === matePath,
    "the draft is measured per captain per seat: the path each of them took up, filed against the captain who kept it and not against their neighbor, and the seconds that captain's own interface took, which is the number the plan's target of forty five is read against",
  );
  check(
    draftSwitched.length === 1 &&
      draftSwitched[0]?.actor === draftHost.id &&
      draftSwitched[0]?.path === otherPath &&
      draftSwitched[0]?.leg === switchLegRound &&
      // The voyage went on to the leg the room was parked on last, so the
      // leg above is the leg the papers were changed on rather than the
      // leg the record happens to have ended on.
      draftRecord?.endedAtLeg === PATH_SWITCH_TO_ROUND + 1,
    "and the one change of papers a voyage allowed is filed beside it with the leg it happened on, so a reader can tell a table that switched from one that never did",
  );

  // The house rule, over the copy this feature added. Every sentence a
  // captain reads in this feature is written in one of these files: the
  // rule module carries the ledger's own lines, the engine carries the
  // refusals the panel prints, the room module carries the sentences a
  // refused request is answered with, the hook carries none and the two
  // components carry the faces of the beats. The two components are swept
  // whole, unlike the borrow's board, because they read no colour through
  // a CSS custom property: their classes are Tailwind's and carry no
  // doubled hyphen.
  check(
    !carriesADash("src/lib/game/draft.ts") &&
      !carriesADash("src/lib/game/engine/draft.ts") &&
      !carriesADash("src/server/realtime/draft.ts") &&
      !carriesADash("src/lib/use-path-draft.ts") &&
      !carriesADash("src/components/portmasters/game/phases/PathDraft.tsx") &&
      !carriesADash("src/components/portmasters/game/status/PathChip.tsx"),
    "every file the draft's and the switch's copy lives in reads free of en dashes, em dashes and doubled hyphens, which is the house rule for every string a captain reads",
  );
}
