// PortMasters 2.2 Parallel Release, smoke run: The voyage log.

import { openingPhase } from "@/lib/game/checkpoint";
import { LEG_PHASE_ORDER, phaseFace } from "@/lib/game/phases";
import type {
  VoyageLogEntry,
  VoyageLogFacts,
  VoyageLogKind,
} from "@/lib/game/voyage-log";
import {
  VOYAGE_LOG_CAP,
  VOYAGE_LOG_KINDS,
  appendVoyageLog,
  normalizeVoyageLog,
  normalizeVoyageLogEntry,
  voyageLogEntry,
  voyageLogLine,
} from "@/lib/game/voyage-log";
import {
  LEDGER_PHRASE,
  call,
  carriesADash,
  check,
  leakedHiddenFields,
  openAuthedSocket,
  signUp,
  suffix,
  waitForEvent,
  walkSrc,
  withoutComments,
} from "../harness";
import type { Captain, WireDelivery, WireHistory, WireOffer } from "../wire";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function voyageLogSuite(run: SmokeRun): Promise<void> {
  // Every kind, and the sentence a captain reads for it. The table is
  // typed by the union, so a tenth kind is a compile error here as well
  // as in the line writer, and the checks below walk the vocabulary
  // rather than a list written out a second time.
  const logFacts: Record<VoyageLogKind, VoyageLogFacts> = {
    voyage_started: { kind: "voyage_started" },
    leg_advanced: { kind: "leg_advanced", phase: "parley" },
    offer_posted: {
      kind: "offer_posted",
      captain: "Smoke logger1",
      offerItem: "Hemp",
      offerAmount: 3,
      requestItem: "Silk",
      requestAmount: 2,
    },
    offer_filled: {
      kind: "offer_filled",
      captain: "Smoke logger1",
      taker: "Smoke logger2",
      offerItem: "Hemp",
      offerAmount: 3,
      requestItem: "Silk",
      requestAmount: 2,
    },
    offer_expired: {
      kind: "offer_expired",
      captain: "Smoke logger1",
      offerItem: "Hemp",
      offerAmount: 3,
    },
    leg_timed_out: { kind: "leg_timed_out", phase: "market" },
    audit_carried: { kind: "audit_carried", target: "Smoke logger2" },
    maroon_carried: { kind: "maroon_carried", target: "Smoke logger2" },
    captain_left: { kind: "captain_left", captain: "Smoke logger1" },
    contract_posted: {
      kind: "contract_posted",
      captain: "Smoke logger1",
      fee: 12,
    },
    contract_agreed: {
      kind: "contract_agreed",
      captain: "Smoke logger1",
      taker: "Smoke logger2",
      fee: 12,
    },
    contract_claimed: {
      kind: "contract_claimed",
      captain: "Smoke logger1",
      taker: "Smoke logger2",
    },
    refit_posted: {
      kind: "refit_posted",
      captain: "Smoke logger1",
      good: "Linen Clothes",
      fee: 12,
    },
    refit_agreed: {
      kind: "refit_agreed",
      captain: "Smoke logger1",
      taker: "Smoke logger2",
      good: "Linen Clothes",
      fee: 12,
    },
    // [F3: modules in the shipyard ladder, and trading them between
    // captains] The market's pair, and the rows carry the module as its
    // card id rather than its name: the writer resolves it through the
    // pool, which is what the lines below are here to hold.
    module_posted: {
      kind: "module_posted",
      captain: "Smoke logger1",
      module: "bulk_hauler",
      fee: 12,
    },
    module_sold: {
      kind: "module_sold",
      captain: "Smoke logger1",
      taker: "Smoke logger2",
      module: "bulk_hauler",
      fee: 12,
    },
    // [D5: Aroma: the Bazaar Rumor] The one fact this table carries that
    // is deliberately incomplete, and the line below says the same: the
    // captain and the good, with no direction, because the log is public
    // the moment it is written and the direction is not public yet.
    rumor_published: {
      kind: "rumor_published",
      captain: "Smoke logger1",
      good: "Silk",
    },
    // [D7: the draft, and switching] The identity pair, and the switch is
    // the line the plan asks for by name: "the switch is published to the
    // fleet log where everyone sees it." Both carry the path taken up and
    // never the path left, for the reason the writer's own note gives.
    path_taken: {
      kind: "path_taken",
      captain: "Smoke logger1",
      path: "loom",
    },
    path_switched: {
      kind: "path_switched",
      captain: "Smoke logger1",
      path: "quartermaster",
    },
  };
  const logLines: Record<VoyageLogKind, string> = {
    voyage_started: "The voyage leaves the dock.",
    leg_advanced: "The harbor weighs anchor for the Parley.",
    offer_posted: "Smoke logger1 posts 3 Hemp for 2 Silk.",
    offer_filled:
      "Smoke logger2 fills Smoke logger1's offer of 3 Hemp for 2 Silk.",
    offer_expired: "Smoke logger1's offer of 3 Hemp lapses with the leg.",
    leg_timed_out: "The tide runs out on the Market.",
    audit_carried: "The harbor audits Smoke logger2.",
    maroon_carried: "The harbor maroons Smoke logger2.",
    captain_left: "Smoke logger1 leaves the harbor.",
    contract_posted: "Smoke logger1 offers one leg of protection for 12 Gold.",
    contract_agreed:
      "Smoke logger2 buys a leg of protection from Smoke logger1 for 12 Gold.",
    contract_claimed:
      "Raiders bound for Smoke logger2 met Smoke logger1's guns.",
    refit_posted:
      "Smoke logger1 offers to put a Linen Clothes right for 12 Gold.",
    refit_agreed:
      "Smoke logger2 pays Smoke logger1 12 Gold to put the Linen Clothes right.",
    module_posted: "Smoke logger1 offers Bulk Hauler Rigging for 12 Gold.",
    module_sold:
      "Smoke logger2 buys Bulk Hauler Rigging from Smoke logger1 for 12 Gold.",
    rumor_published:
      "Smoke logger1 publishes a rumor about Silk at the bazaar.",
    path_taken: "Smoke logger1 takes up the Loom path.",
    path_switched:
      "Smoke logger1 sets aside their old papers and takes up the Quartermaster path.",
  };
  for (const kind of VOYAGE_LOG_KINDS) {
    check(
      voyageLogLine(logFacts[kind]) === logLines[kind],
      `the ${kind} line reads the way a captain reads it, and reads it the same way wherever the log is drawn`,
    );
  }
  check(
    new Set(VOYAGE_LOG_KINDS.map((kind) => logLines[kind])).size ===
      VOYAGE_LOG_KINDS.length,
    "and no two kinds share a sentence, so a line a captain reads names the thing that happened",
  );
  check(
    LEG_PHASE_ORDER.every((phase) =>
      voyageLogLine({ kind: "leg_advanced", phase }).includes(
        phaseFace(phase).label,
      ),
    ),
    "the anchor line names each phase off the phase's own face rather than off a second list of names kept in the log",
  );

  // The round belongs to the log's own stamp rather than to the caller,
  // which is what lets a screen group a voyage by leg without working
  // out which leg a line fell in.
  const stamped = voyageLogEntry(3, logFacts.captain_left);
  check(
    stamped.round === 3 &&
      stamped.kind === "captain_left" &&
      stamped.text === logLines.captain_left,
    "a line carries the leg it happened on, the kind of thing it was and the sentence, and nothing else",
  );

  // The cap, which both sides of the wire share. The oldest line is the
  // one that goes: a bound on a live surface keeps the end a captain
  // reads.
  const logFlooded = Array.from({ length: VOYAGE_LOG_CAP + 10 }, (_, index) =>
    voyageLogEntry(index, logFacts.voyage_started),
  ).reduce<VoyageLogEntry[]>((kept, entry) => appendVoyageLog(kept, entry), []);
  check(
    logFlooded.length === VOYAGE_LOG_CAP &&
      logFlooded[0].round === 10 &&
      logFlooded[logFlooded.length - 1].round === VOYAGE_LOG_CAP + 9,
    `a voyage keeps the last ${VOYAGE_LOG_CAP} lines and drops the oldest, so a long voyage costs a surface a bounded amount`,
  );

  // The door every line off the wire comes through.
  check(
    normalizeVoyageLogEntry(stamped)?.kind === "captain_left" &&
      normalizeVoyageLogEntry(stamped)?.round === 3,
    "a line that is a line is read back as it was written, leg and all",
  );
  const notLines: unknown[] = [
    null,
    "The voyage leaves the dock.",
    {},
    { round: 1, kind: "captain_left" },
    { round: 1, kind: "captain_left", text: "" },
    { round: -1, kind: "captain_left", text: "Ari leaves the harbor." },
    { round: 1, kind: "mutiny", text: "Ari leaves the harbor." },
    { round: 1, kind: "captain_left", text: 7 },
  ];
  check(
    notLines.every((value) => normalizeVoyageLogEntry(value) === null),
    "and anything that is not a line is dropped rather than drawn, so a malformed frame cannot put a blank row in the middle of a voyage",
  );
  check(
    normalizeVoyageLog([stamped, null, { round: 1 }, stamped]).length === 2 &&
      normalizeVoyageLog("not a log").length === 0 &&
      normalizeVoyageLog(
        Array.from({ length: VOYAGE_LOG_CAP + 5 }, () => stamped),
      ).length === VOYAGE_LOG_CAP,
    "a whole log heals the same way and is capped the same way, and a log that is not a list is an empty log rather than a crash",
  );

  // Every kind has a writer. A vocabulary entry nothing produces is a
  // line the suite would hold to its sentence while no captain could ever
  // read it, and the scan is what makes adding a kind a two part change
  // rather than a one part one.
  //
  // Walked rather than listed, and by the same walker every other scan of
  // this tree uses: the layer keeps its frames in the modules under
  // ./wiring now, and a flat listing here would read the composition root
  // alone and report a vocabulary entry as unwritten that three leaves
  // write between them.
  const realtimeDir = join(
    import.meta.dirname,
    "..",
    "..",
    "..",
    "src",
    "server",
    "realtime",
  );
  const realtimeSource = walkSrc(realtimeDir)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  check(
    VOYAGE_LOG_KINDS.every((kind) =>
      realtimeSource.includes(`kind: "${kind}"`),
    ),
    "every kind the log can hold has a writer in the realtime layer, so no line of its vocabulary is one no captain can read",
  );

  // The copy rule, read off the files rather than off a claim about them.
  check(
    !carriesADash("src/lib/game/voyage-log.ts") &&
      !carriesADash("src/lib/use-voyage-log.ts") &&
      !carriesADash("src/server/realtime/voyage-log.ts") &&
      !carriesADash("src/components/portmasters/game/VoyageLogPanel.tsx"),
    "and none of the words a captain reads in either log, nor the comments that explain them, carries an en dash, an em dash or a doubled hyphen",
  );

  // And the two counts over the columns, which read as bare figures for as
  // long as a captain had to work out what they counted. Each is headed by
  // the noun it counts and worded for its number, so a voyage with one line
  // to read says so rather than leaving the reader to name the figure.
  // Read with its whitespace flattened, the way the market desks are read:
  // the check is about the words a captain reads rather than about where a
  // formatter broke the line.
  const panelCode = withoutComments(
    readFileSync(
      join(
        import.meta.dirname,
        "..",
        "..",
        "..",
        "src",
        "components",
        "portmasters",
        "game",
        "VoyageLogPanel.tsx",
      ),
      "utf8",
    ),
  ).replace(/\s+/g, " ");
  check(
    panelCode.includes('entries.length === 1 ? "line" : "lines"') &&
      panelCode.includes('privateLog.length === 1 ? "line" : "lines"') &&
      panelCode.includes("in the harbor") &&
      panelCode.includes("to you alone"),
    "both counts over the two columns are headed by the noun they count and worded for their number, so the harbor's log and the private one each read as lines rather than as two figures the captain has to label for themselves",
  );

  // ---- The two logs, in a real harbor ----
  // One Ocean Gambit harbor with two captains in it, because the pair
  // under test needs the private channel to carry something: a card is
  // dealt in this mode and nowhere else, and both captains hold one.
  const logHost = await signUp("logger1");
  const logMate = await signUp("logger2");
  run.extraAccounts.push(logHost, logMate);
  const logRoom = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: logHost.cookie,
      body: JSON.stringify({
        name: `Smoke voyage log ${suffix}`,
        isPublic: false,
        mode: "ocean_gambit",
        unlock: LEDGER_PHRASE,
      }),
    },
  );
  if (logRoom.status !== 200) {
    throw new Error("No harbor to keep a voyage log in, stopping here.");
  }
  const logRoomId = logRoom.body.room.id;
  const logMateJoined = await call<{ room: { id: string } }>(
    "/api/rooms/join",
    {
      method: "POST",
      cookie: logMate.cookie,
      body: JSON.stringify({ code: logRoom.body.room.code }),
    },
  );
  check(
    logMateJoined.status === 200,
    "two captains take a seat in a harbor that keeps a log",
  );

  type LogFrame = { event: string; text: string };
  const logSeats: Array<{
    captain: Captain;
    socket: Socket;
    frames: LogFrame[];
  }> = [];
  for (const captain of [logHost, logMate]) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const frames: LogFrame[] = [];
    socket.onAny((event: string, ...args: unknown[]) => {
      frames.push({ event, text: JSON.stringify(args) });
    });
    const takenASeat = waitForEvent<WireHistory>(
      socket,
      "chat:history",
      (payload) => payload?.roomId === logRoomId,
    );
    socket.emit("room:join", { roomId: logRoomId });
    const seat = await takenASeat;
    check(seat !== null, `${captain.username} takes their seat`);
    logSeats.push({ captain, socket, frames });
  }
  const logHostSeat = logSeats[0];
  const logMateSeat = logSeats[1];

  // The lines a socket was sent, read off the frames it kept. Only the
  // room's log, since the private channel's frames are the other half of
  // this pair and the point of the checks below is to keep the two apart.
  const logEntriesOn = (frames: readonly LogFrame[]) =>
    frames
      .filter((frame) => frame.event === "voyage:log")
      .map(
        (frame) =>
          (
            JSON.parse(frame.text) as [
              { roomId: string; entry: VoyageLogEntry },
            ]
          )[0]?.entry,
      )
      .filter((entry): entry is VoyageLogEntry => Boolean(entry));
  const logTextOn = (frames: readonly LogFrame[]) =>
    logEntriesOn(frames).map((entry) => entry.text);

  const logCardFrames = logSeats.map((seat) =>
    waitForEvent<WireDelivery>(
      seat.socket,
      "private:entry",
      (payload) => payload?.roomId === logRoomId,
    ),
  );
  logHostSeat.socket.emit("room:start", { roomId: logRoomId });
  const logCards = await Promise.all(logCardFrames);
  check(
    logCards.every((card) => card?.entry?.kind === "card"),
    "and the voyage sets sail, dealing each of them a card the other captain cannot read",
  );
  await new Promise((resolve) => setTimeout(resolve, 300));

  check(
    logTextOn(logHostSeat.frames).includes(logLines.voyage_started) &&
      logTextOn(logMateSeat.frames).includes(logLines.voyage_started),
    "the room's log opens with the voyage and reaches every socket in the harbor, not only the host's",
  );
  // The seat a voyage opens in is entered by the host's start rather than
  // by a ready vote, and it is anchored all the same. A log whose first
  // anchor line belonged to the second seat would read as a leg nobody
  // played, and the opening seat of a Gambit voyage is not the pier: the
  // phase the mode opens at is where the crew actually stands.
  const logOpened = logEntriesOn(logHostSeat.frames);
  const openingSeat = openingPhase("ocean_gambit");
  check(
    logOpened[0]?.kind === "voyage_started" &&
      logOpened[0]?.round === 1 &&
      logOpened[1]?.kind === "leg_advanced" &&
      logOpened[1]?.round === 1 &&
      logOpened[1]?.text ===
        voyageLogLine({ kind: "leg_advanced", phase: openingSeat }),
    "and the seat the voyage opens in is anchored like every other, so the log's spine has no gap where its first leg should be",
  );

  // A leg moves, and the log's own stamp moves with it. The status
  // report is the real one a client sends, and it is what moves a room's
  // checkpoint; the two reports below take the room from the leg it
  // opened on to the Parley of the next one.
  // The two anchor lines the reports below write. Named once each, and
  // read again at the end of the section where the voyage is checked for
  // order, so the section holds one copy of each sentence it expects.
  const dawnAnchorLine = "The harbor weighs anchor for the Dawn.";
  const parleyAnchorLine = "The harbor weighs anchor for the Parley.";
  const anchored = waitForEvent<{ entry: VoyageLogEntry }>(
    logMateSeat.socket,
    "voyage:log",
    (payload) => payload?.entry?.text.includes("Dawn"),
  );
  logHostSeat.socket.emit("game:status", {
    roomId: logRoomId,
    round: 2,
    phase: "dawn",
  });
  const anchorFrame = await anchored;
  check(
    anchorFrame?.entry?.round === 2 &&
      anchorFrame.entry.text === dawnAnchorLine,
    "a leg that moves writes the anchor line for the seat being entered, stamped with the leg it is entering rather than the one it left",
  );

  const atParley = waitForEvent<{ entry: VoyageLogEntry }>(
    logMateSeat.socket,
    "voyage:log",
    (payload) => payload?.entry?.text.includes("Parley"),
  );
  logHostSeat.socket.emit("game:status", {
    roomId: logRoomId,
    round: 2,
    phase: "parley",
  });
  const parleyFrame = await atParley;
  check(
    parleyFrame?.entry?.round === 2 &&
      parleyFrame.entry.text === parleyAnchorLine,
    "and a phase that moves inside one leg keeps that leg's number, so a captain reading back sees the leg as one stretch rather than six",
  );

  // The offer board, which is the one surface whose whole life is worth
  // a line: posted, filled, and lapsed.
  const postedLine = waitForEvent<{ entry: VoyageLogEntry }>(
    logMateSeat.socket,
    "voyage:log",
    (payload) => payload?.entry?.kind === "offer_posted",
  );
  logHostSeat.socket.emit("barter:post", {
    roomId: logRoomId,
    offerItem: "Hemp",
    offerAmount: 3,
    requestItem: "Silk",
    requestAmount: 2,
  });
  const postedLog = await postedLine;
  check(
    postedLog?.entry?.text === "Smoke logger1 posts 3 Hemp for 2 Silk." &&
      postedLog.entry.round === 2,
    "an offer on the board writes the whole trade into the room's log, naming the captain who posted it",
  );

  // The settlement, taken by the second captain through the accept the
  // client's own board sends. The board is live server state rather than
  // a row, so the offer's id is read off the board itself: the host asks
  // for its own state and reads the answer, which is the same copy the
  // accepting client reads its id off. Asking rather than reading the
  // frames the room was already sent, because the line above and the
  // board update that follows it are two frames and the log's own is the
  // first of them, so the board is not on the socket yet when the line
  // arrives.
  const logBoardAfterPost = waitForEvent<{
    roomId: string;
    offers?: WireOffer[];
  }>(
    logHostSeat.socket,
    "barter:update",
    (payload) => payload?.roomId === logRoomId,
  );
  logHostSeat.socket.emit("barter:state:request", { roomId: logRoomId });
  const postedOffer = (await logBoardAfterPost)?.offers?.find(
    (offer) => offer.fromUserId === logHost.id,
  );
  check(
    postedOffer !== undefined,
    "the offer is standing on the room's board, so the settlement below has something to settle",
  );
  const filledLine = waitForEvent<{ entry: VoyageLogEntry }>(
    logHostSeat.socket,
    "voyage:log",
    (payload) => payload?.entry?.kind === "offer_filled",
  );
  logMateSeat.socket.emit("barter:accept", {
    roomId: logRoomId,
    offerId: postedOffer?.id,
  });
  const logFilled = await filledLine;
  check(
    logFilled?.entry?.text ===
      "Smoke logger2 fills Smoke logger1's offer of 3 Hemp for 2 Silk.",
    "and the captain who takes it writes the settlement into the log, naming both ends of the trade",
  );

  // The lapsed line, which is the board's other ending: an offer still
  // standing when the room leaves the Parley goes back to its poster.
  // The two lines this offer produces are named once each and read in
  // both places they are needed: here, and in the readback at the end of
  // the section, where the same voyage is checked for order.
  const secondPostLine = "Smoke logger1 posts 1 Silk for 4 Hemp.";
  const secondLapseLine =
    "Smoke logger1's offer of 1 Silk lapses with the leg.";
  const secondPosted = waitForEvent<{ entry: VoyageLogEntry }>(
    logHostSeat.socket,
    "voyage:log",
    (payload) => payload?.entry?.kind === "offer_posted",
  );
  logHostSeat.socket.emit("barter:post", {
    roomId: logRoomId,
    offerItem: "Silk",
    offerAmount: 1,
    requestItem: "Hemp",
    requestAmount: 4,
  });
  check(
    (await secondPosted)?.entry?.text === secondPostLine,
    "a second offer goes up while the room is still at the exchange",
  );
  const lapsedLine = waitForEvent<{ entry: VoyageLogEntry }>(
    logHostSeat.socket,
    "voyage:log",
    (payload) => payload?.entry?.kind === "offer_expired",
  );
  logHostSeat.socket.emit("game:status", {
    roomId: logRoomId,
    round: 2,
    phase: "resolve",
  });
  const lapsed = await lapsedLine;
  check(
    lapsed?.entry?.text === secondLapseLine,
    "and leaving the phase an offer stands in writes the line that says it lapsed, one entry per offer rather than one for the sweep",
  );

  // The departure, through the pair of calls the Leave button makes: the
  // seat is given up over REST and the socket follows it out.
  const leftLine = waitForEvent<{ entry: VoyageLogEntry }>(
    logHostSeat.socket,
    "voyage:log",
    (payload) => payload?.entry?.kind === "captain_left",
  );
  const gaveUpSeat = await call<{ ok: boolean }>(
    `/api/rooms/${logRoomId}/leave`,
    { method: "POST", cookie: logMate.cookie },
  );
  check(gaveUpSeat.status === 200, "a captain can give up their seat");
  logMateSeat.socket.emit("room:leave", { roomId: logRoomId });
  const left = await leftLine;
  const leavesTheHarbor = "Smoke logger2 leaves the harbor.";
  check(
    left?.entry?.text === leavesTheHarbor,
    "a seat that leaves the voyage writes one line into the room's log, and the log's own guard is what keeps the reap from writing a second",
  );
  check(
    logTextOn(logHostSeat.frames).filter((text) =>
      text.includes("leaves the harbor"),
    ).length === 1,
    "and that line stands alone rather than beside a copy of itself",
  );

  // The history the Dusk screen asks for, answered to the socket that
  // asked rather than to the room.
  const history = waitForEvent<{
    roomId: string;
    round: number;
    entries: VoyageLogEntry[];
  }>(
    logHostSeat.socket,
    "voyage:log:history",
    (payload) => payload?.roomId === logRoomId,
  );
  logHostSeat.socket.emit("voyage:log:request", { roomId: logRoomId });
  const historyFrame = await history;
  const readBack = historyFrame?.entries ?? [];
  const textBack = readBack.map((entry) => entry.text);
  // The voyage this section sailed, in the order it happened. Read as a
  // run of positions rather than as a membership list, so the check says
  // what its name says: a captain who asks for the log is handed the
  // voyage, not a bag of lines. A line the clock added on its own (a
  // phase that ran out while the room stood in it) is allowed to sit
  // between two of these without failing the run, which is why the
  // comparison is strictly increasing positions rather than equality
  // with the whole list.
  const orderedLines = [
    logLines.voyage_started,
    dawnAnchorLine,
    parleyAnchorLine,
    logLines.offer_posted,
    logLines.offer_filled,
    secondPostLine,
    secondLapseLine,
    leavesTheHarbor,
  ];
  const logOrder = orderedLines.map((line) => textBack.indexOf(line));
  check(
    historyFrame?.round === 2 &&
      logOrder.every(
        (at, index) => at >= 0 && (index === 0 || at > logOrder[index - 1]),
      ),
    "the log is handed back whole to the captain who asks for it, holding the voyage's own lines in the order they were written",
  );
  check(
    readBack.length === logEntriesOn(logHostSeat.frames).length &&
      readBack.every(
        (entry, index) =>
          entry.kind === logEntriesOn(logHostSeat.frames)[index]?.kind,
      ),
    "and it is the same log the room was reading as it happened, line for line, rather than a second copy assembled when it was asked for",
  );
  check(
    readBack.every(
      (entry) =>
        typeof entry.round === "number" &&
        typeof entry.kind === "string" &&
        typeof entry.text === "string" &&
        Object.keys(entry).length === 3,
    ) && readBack.length > 0,
    "and every line in it is a leg, a kind and a sentence, with no fourth field for anything hidden to travel in",
  );

  // The plan's own evaluation, read against this surface: the private
  // channel's material reaches the captain it was dealt to and appears
  // in no line the room can read.
  const cardTexts = logSeats
    .map((seat) => {
      const cardFrame = seat.frames.find(
        (frame) => frame.event === "private:entry",
      );
      if (!cardFrame) return null;
      return (
        JSON.parse(cardFrame.text) as [
          { entry?: { role?: string; text?: string } },
        ]
      )[0]?.entry;
    })
    .filter((entry): entry is { role?: string; text?: string } =>
      Boolean(entry?.text),
    );
  check(
    cardTexts.length === 2,
    "each captain holds a card of their own on the private channel, so the sweep below has something it could find",
  );
  check(
    logSeats.every((seat) => {
      const cardFrame = seat.frames.find(
        (frame) => frame.event === "private:entry",
      );
      return cardFrame !== undefined && /"role"\s*:\s*"/.test(cardFrame.text);
    }),
    "and each of those cards is a frame carrying a role, which is a shape no log line may carry",
  );
  const publicLeaks = logSeats.flatMap((seat) =>
    leakedHiddenFields(
      seat.frames.filter((frame) => frame.event === "voyage:log"),
    ).map((leak) => `${seat.captain.username} on ${leak}`),
  );
  check(
    publicLeaks.length === 0,
    "no line in the room's log carries a role, a flourish, an ally or an alignment word, on any socket in the harbor",
  );
  check(
    logSeats.every((seat) =>
      logTextOn(seat.frames).every((text) =>
        cardTexts.every((card) => !text.includes(card.text ?? "")),
      ),
    ),
    "and no private entry appears in the other captain's transcript, which is the plan's own evaluation for this slice",
  );

  // A restarted voyage is a new voyage, so the log goes with it and the
  // room is told. The request afterwards is answered with nothing rather
  // than with the voyage that just ended.
  const restarted = waitForEvent<{ roomId: string }>(
    logHostSeat.socket,
    "room:restarted",
    (payload) => payload?.roomId === logRoomId,
  );
  logHostSeat.socket.emit("room:restart", { roomId: logRoomId });
  check(
    (await restarted) !== null,
    "the host can wipe the voyage and sail again",
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  // A short wait rather than the usual one: nothing is expected here, so
  // this check costs the suite the length of its own timeout.
  const afterRestart = waitForEvent<{
    roomId: string;
    entries: VoyageLogEntry[];
  }>(
    logHostSeat.socket,
    "voyage:log:history",
    (payload) => payload?.roomId === logRoomId,
    1200,
  );
  logHostSeat.socket.emit("voyage:log:request", { roomId: logRoomId });
  check(
    (await afterRestart) === null,
    "and a restarted voyage has no log to hand back, because the log belonged to the voyage that was wiped",
  );
}
