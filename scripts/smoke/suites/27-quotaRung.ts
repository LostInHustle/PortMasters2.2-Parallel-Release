// PortMasters 2.2 Parallel Release, smoke run: The quota rung.

import { db } from "@/lib/db";
import type { VoyageOutcome } from "@/lib/game/balance";
import {
  WIN_RATE_TARGETS,
  bandVerdict,
  readSwings,
  readWinRates,
} from "@/lib/game/balance";
import type { GambitRole } from "@/lib/game/gambit";
import {
  OBJECTIVE_DECK,
  SEAT_BANDS,
  drawObjective,
  objectiveSeed,
  objectiveTotalItems,
  seatBand,
  widestObjectivePayout,
} from "@/lib/game/objectives";
import {
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

export async function quotaRungSuite(
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
    gambitRoomId: string;
    gambitSecond: {
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
    pairedCrew: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    }[];
    pairedRoomId: string;
  },
): Promise<void> {
  const {
    gambitFifth,
    gambitFourth,
    gambitHost,
    gambitRoomId,
    gambitSecond,
    gambitThird,
    pairedCrew,
    pairedRoomId,
  } = inputs;
  // H5's difficulty rung: the commission's quotas scale with the size of
  // the fleet the voyage was dealt to, so the sabotage window is the same
  // width at four seats as at six. The gate that rung exists for is a
  // claim about win rates, so there are two halves here and both matter:
  // the band table's own arithmetic, and the plumbing that carries a
  // pinned size from the room into the board the server clamps against.
  // The second half is the one a unit test cannot reach, which is why it
  // is checked against a harbor that really set sail.

  // ---- The bands, which need no sockets ----
  check(
    seatBand(0).factor === 1 &&
      seatBand(1).factor === 1 &&
      seatBand(4).factor === 1,
    "a founding table's commission is the deck exactly as authored",
  );
  check(
    seatBand(5).factor > 1 && seatBand(6).factor > seatBand(5).factor,
    "and every band above it asks for more than the one below",
  );
  check(
    seatBand(6).factor === seatBand(9).factor && seatBand(5).label === "5",
    "with a table larger than the top band sailing on the top band",
  );
  check(
    SEAT_BANDS.every(
      (band, index) => index === 0 || band.min > SEAT_BANDS[index - 1].min,
    ),
    "the bands are ordered, so a walk over them cannot settle on the wrong floor",
  );

  // The anchor, good for good and string for string. This is the promise
  // the rung made to every voyage that predates it: a room whose pin is
  // missing reads as the anchor, and a voyage that begins at four seats
  // or fewer draws the board the deck would have drawn with no rung at
  // all, down to the entry.
  const anchorSeats = [0, 1, 2, 3, 4];
  check(
    anchorSeats.every(
      (seats) =>
        objectiveSeed("harbor-a", 3, seats) === "harbor-a:V3:objective",
    ),
    "a founding voyage's seed is the string it always was, at every size in the band",
  );
  check(
    anchorSeats.every(
      (seats) =>
        JSON.stringify(
          drawObjective(objectiveSeed("harbor-rung", 7, seats), seats),
        ) === JSON.stringify(drawObjective(objectiveSeed("harbor-rung", 7), 0)),
    ),
    "and its board is the board the deck would have drawn unpinned",
  );
  check(
    objectiveSeed("harbor-a", 3, 5) === "harbor-a:V3:objective:S5",
    "while a wider voyage seeds from its size as well as its harbor and its epoch",
  );

  // The scaling itself, at one seed so the entry cannot move under it.
  const rungSeed = "harbor-rung:V7:objective:S6";
  const anchorAtSeed = drawObjective(rungSeed, 0);
  const wideAtSeed = drawObjective(rungSeed, 6);
  check(
    wideAtSeed.id === anchorAtSeed.id,
    "one seed draws one commission, whatever size the fleet at it is",
  );
  check(
    wideAtSeed.resources.every((row) => {
      const base = anchorAtSeed.resources.find((r) => r.type === row.type);
      // At least the band's factor and never a whole item past it: that
      // is the ceiling rule, stated without restating Math.ceil.
      return (
        base !== undefined &&
        row.required >= base.required * 1.5 &&
        row.required < base.required * 1.5 + 1
      );
    }),
    "and the rung scales every quota by the band's factor, rounding up",
  );
  check(
    wideAtSeed.resources.every(
      (row) =>
        row.price ===
        anchorAtSeed.resources.find((r) => r.type === row.type)?.price,
    ) && objectiveTotalItems(wideAtSeed) > objectiveTotalItems(anchorAtSeed),
    "for more cargo at the same price rather than the same cargo at a worse one",
  );

  // The ceiling the Ledger Integrity Pass reads is the one number in the
  // mode that a wider commission can falsify from a distance: a full six
  // seat hand over is real Gold, and a ceiling left at the founding
  // deck's own maximum would call it impossible.
  const anchorPayout = Math.max(
    ...OBJECTIVE_DECK.map((objective) =>
      objective.resources.reduce((sum, r) => sum + r.required * r.price, 0),
    ),
  );
  check(
    OBJECTIVE_DECK.every((objective) =>
      SEAT_BANDS.every(
        (band) =>
          objective.resources.reduce(
            (sum, r) => sum + Math.ceil(r.required * band.factor) * r.price,
            0,
          ) <= widestObjectivePayout(),
      ),
    ),
    "the payout ceiling covers every commission the deck can be drawn at, at every band",
  );
  check(
    widestObjectivePayout() > anchorPayout,
    "and is wider than the deck as authored, so a full table's payout cannot read as forged",
  );

  // ---- The instrument the gate is read with ----
  // Pure arithmetic over rows, exercised here because every claim the
  // epic's evaluation will make is made through it. The Classic row is
  // the one that has to fall out: no card was dealt there, and counting
  // its won flag would drag every rate toward zero.
  const voyageRows: VoyageOutcome[] = [
    { alignment: "honest", won: true, seats: 4 },
    { alignment: "honest", won: true, seats: 2 },
    { alignment: "honest", won: false, seats: 6 },
    { alignment: "pirate", won: true, seats: 6 },
    // A Classic voyage, in the table only to be left out of it again.
    { alignment: "", won: true, seats: 4 },
  ];
  const readings = readWinRates(voyageRows);
  check(
    readings.length === SEAT_BANDS.length * 3 &&
      readings[0].alignment === "honest" &&
      readings[0].band === SEAT_BANDS[0].label,
    "the reader reports every role at every table size, in the deck's band order",
  );
  check(
    readings.reduce((sum, reading) => sum + reading.played, 0) === 4,
    "counts the voyages that were dealt a card, and leaves the Classic ones out",
  );
  const honestAnchor = readings.find(
    (reading) =>
      reading.alignment === "honest" && reading.band === SEAT_BANDS[0].label,
  );
  check(
    honestAnchor?.played === 2 &&
      honestAnchor?.won === 2 &&
      honestAnchor?.rate === 1,
    "reads a band's rate off the rows in it",
  );
  const pirateSix = readings.find(
    (reading) =>
      reading.alignment === "pirate" && reading.band === seatBand(6).label,
  );
  const noVoyages = readings.find((reading) => reading.played === 0);
  check(
    pirateSix?.rate === 1 && noVoyages?.rate === null,
    "and reports a band nobody played as unknown rather than as a loss",
  );
  check(
    noVoyages !== undefined &&
      bandVerdict(noVoyages.alignment, noVoyages.rate) === "unplayed",
    "so an unplayed band is not read as a verdict either",
  );
  check(
    bandVerdict("pirate", 0.2) === "in" &&
      bandVerdict("pirate", 0.26) === "in" &&
      bandVerdict("pirate", 13 / 50) === "in",
    "a rate sitting on a role's floor or its ceiling is inside the band",
  );
  check(
    bandVerdict("pirate", 0.196) === "in" &&
      bandVerdict("pirate", 0.194) === "under" &&
      bandVerdict("pirate", 0.264) === "in" &&
      bandVerdict("pirate", 0.266) === "over",
    "and one within half a point of a boundary is read at the percent it rounds to",
  );
  check(
    bandVerdict("honest", 0.52) === "in" &&
      bandVerdict("broker", 0.45) === "in" &&
      bandVerdict("honest", 0.46) === "under",
    "each role is judged against its own target rather than a shared one",
  );
  check(
    readings.every((reading) => {
      const target = WIN_RATE_TARGETS[reading.alignment];
      return target.floor < target.ceiling;
    }) && WIN_RATE_TARGETS.honest.floor > WIN_RATE_TARGETS.pirate.ceiling,
    "every role the reader reports has a band of its own, and the fleet's worst is still the Pirate's best",
  );

  // ---- The swing reader ----
  // How far a role's rate moves across the bands it played. The command
  // line report prints it and the balance dashboard shows it, so the
  // arithmetic lives here rather than in either of them, and the two
  // cases that are not a number are told apart by the reader: a role that
  // played no band and a role that played one are different absences, and
  // a caller that could not tell them apart would print one as the other.
  const swings = readSwings(readings);
  check(
    swings.length === 3 &&
      swings.every(
        (swing, index) =>
          swing.alignment === readings[index * SEAT_BANDS.length]?.alignment,
      ),
    "the swing reader reports every role once, in the order the win rates are read in",
  );
  const swingFor = (alignment: GambitRole) =>
    swings.find((swing) => swing.alignment === alignment);
  // The Honest captain's three rows above land in two bands, two won of
  // two at the four seat table and none of one at the six, so the swing
  // is the whole distance between the two rates.
  check(
    swingFor("honest")?.bands === 2 && swingFor("honest")?.points === 100,
    "a role read across two bands swings the distance between them",
  );
  check(
    swingFor("pirate")?.bands === 1 && swingFor("pirate")?.points === null,
    "a role that played one band has no swing to read rather than a swing of nothing",
  );
  check(
    swingFor("broker")?.bands === 0 && swingFor("broker")?.points === null,
    "and a role that played none is the other absence, told apart by the band count beside it",
  );

  // ---- The pin, over the wire ----
  // Two voyages that really set sail and one that was restarted, which is
  // the whole life of the column: the six seat table from the paired
  // section pins its own size, a five seat harbor opened here pins the
  // band between the anchor and it, and the harbor from the commission
  // section was restarted before this line and holds nothing. A pin that
  // only ever landed at four would satisfy every check above this one.
  const pinned = (room: string) =>
    db.room.findUnique({
      where: { id: room },
      select: { voyageSeats: true },
    });
  // The harbor the commission section sailed from is in the lobby by now,
  // because that section restarts its voyage to prove the board clears,
  // and no start has followed. So its pin is the zero a room that never
  // pinned reads as, and a room that never pinned is a room that draws the
  // founding deck: the pure checks above are what hold that reading to the
  // board it drew before the rung existed.
  check(
    (await pinned(gambitRoomId))?.voyageSeats === 0,
    "a harbor whose voyage was restarted holds no pin until it sails again",
  );
  check(
    (await pinned(pairedRoomId))?.voyageSeats === pairedCrew.length,
    `and a voyage in flight pins the roster that set sail (${pairedCrew.length} at the paired harbor)`,
  );

  const rungRoom = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: gambitHost.cookie,
      body: JSON.stringify({
        name: `Smoke gambit rung ${suffix}`,
        isPublic: false,
        mode: "ocean_gambit",
        unlock: LEDGER_PHRASE,
      }),
    },
  );
  if (rungRoom.status !== 200) {
    throw new Error("No five captain Gambit harbor to test with.");
  }
  const rungRoomId = rungRoom.body.room.id;
  const rungCrew = [gambitSecond, gambitThird, gambitFourth, gambitFifth];
  const rungJoins = await Promise.all(
    rungCrew.map((captain) =>
      call<{ room: { id: string } }>("/api/rooms/join", {
        method: "POST",
        cookie: captain.cookie,
        body: JSON.stringify({ code: rungRoom.body.room.code }),
      }),
    ),
  );
  check(
    rungJoins.every((join) => join.status === 200),
    "five captains can be seated in a harbor for the middle band",
  );

  const rungSockets: Socket[] = [];
  for (const captain of [gambitHost, ...rungCrew]) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const takenASeat = waitForEvent<WireHistory>(
      socket,
      "chat:history",
      (payload) => payload?.roomId === rungRoomId,
    );
    socket.emit("room:join", { roomId: rungRoomId });
    await takenASeat;
    rungSockets.push(socket);
  }

  const departure = rungSockets.map((socket) =>
    waitForEvent<{ roomId: string; seats?: number }>(
      socket,
      "room:started",
      (payload) => payload?.roomId === rungRoomId,
    ),
  );
  rungSockets[0].emit("room:start", { roomId: rungRoomId });
  const departures = await Promise.all(departure);
  check(
    departures.every((frame) => frame?.seats === 5),
    "setting sail tells every captain the size the voyage was dealt to",
  );
  check(
    (await pinned(rungRoomId))?.voyageSeats === 5,
    "and the room records the same number the departure carried",
  );

  // The reload path, which is the other frame a live client draws from: a
  // captain who comes back mid voyage has no lobby to have heard the
  // departure in, so the size has to ride with the save.
  const rungReload = await call<{ seats?: number }>(
    `/api/game/state?roomId=${rungRoomId}`,
    { cookie: gambitHost.cookie },
  );
  check(
    rungReload.body?.seats === 5,
    "a captain reloading mid voyage is handed that size alongside the save",
  );

  // The board itself, drawn here the way a client draws it and clamped
  // there the way the server does. If the server were still on the
  // founding board, the second report below would come back at the
  // founding quota, or not at all for a good that board never names.
  const rungRoomRow = await db.room.findUnique({
    where: { id: rungRoomId },
    select: { voyageEpoch: true },
  });
  const rungBoard = drawObjective(
    objectiveSeed(rungRoomId, rungRoomRow?.voyageEpoch ?? 0, 5),
    5,
  );
  const rungOwed = rungBoard.resources[0];
  const rungBoardHeard = (socket: Socket) =>
    waitForEvent<{ roomId: string; total: Record<string, number> }>(
      socket,
      "objective:progress",
      (payload) => payload?.roomId === rungRoomId,
    );
  const rungHand: Record<string, number> = {};
  for (const r of rungBoard.resources) rungHand[r.type] = r.required;
  const rungFullBoard = rungBoardHeard(rungSockets[0]);
  rungSockets[1].emit("objective:report", {
    roomId: rungRoomId,
    delivered: rungHand,
  });
  const filled = await rungFullBoard;
  check(
    rungBoard.resources.every((r) => filled?.total?.[r.type] === r.required),
    `a five seat commission takes the ${objectiveTotalItems(rungBoard)} items its own quotas ask for, good for good`,
  );
  const clampedWide = rungBoardHeard(rungSockets[0]);
  rungSockets[2].emit("objective:report", {
    roomId: rungRoomId,
    delivered: { [rungOwed.type]: 999999 },
  });
  check(
    (await clampedWide)?.total?.[rungOwed.type] === rungOwed.required,
    "and a report past it is clamped at the wider quota rather than the founding one",
  );

  // The pin belongs to the voyage, so it goes when the voyage does.
  rungSockets[0].emit("room:restart", { roomId: rungRoomId });
  let unpinned = (await pinned(rungRoomId))?.voyageSeats;
  for (let waited = 0; unpinned !== 0 && waited < 5000; waited += 250) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    unpinned = (await pinned(rungRoomId))?.voyageSeats;
  }
  check(
    unpinned === 0,
    "restarting the voyage clears the pin with the voyage it belonged to",
  );
}
