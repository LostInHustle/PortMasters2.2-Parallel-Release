// PortMasters 2.2 Parallel Release, smoke run: The private information spine.

import { db } from "@/lib/db";
import {
  allyFor,
  dealCards,
  dealRoles,
  flourishById,
  flourishDeck,
  flourishLine,
  hiddenCardCount,
} from "@/lib/game/gambit";
import {
  OBJECTIVE_DECK,
  drawObjective,
  objectiveSeed,
} from "@/lib/game/objectives";
import {
  HIDDEN_FIELD_SHAPES,
  LEDGER_PHRASE,
  call,
  check,
  leakedHiddenFields,
  openAuthedSocket,
  signUp,
  suffix,
  waitForEvent,
} from "../harness";
import type { Captain, WireDelivery, WireHistory } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function privateInformationSpineSuite(run: SmokeRun): Promise<{
  classicRoomId: string;
  gambitFifth: { id: string; token: string; cookie: string; username: string };
  gambitFourth: { id: string; token: string; cookie: string; username: string };
  gambitHost: { id: string; token: string; cookie: string; username: string };
  gambitRoomId: string;
  gambitSecond: { id: string; token: string; cookie: string; username: string };
  gambitSixth: { id: string; token: string; cookie: string; username: string };
  gambitThird: { id: string; token: string; cookie: string; username: string };
  pairedCrew: {
    id: string;
    token: string;
    cookie: string;
    username: string;
  }[];
  pairedRoomId: string;
  seated: {
    captain: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    socket: Socket;
    frames: { event: string; text: string }[];
  }[];
  secret: string;
}> {
  // Ocean Gambit's foundation, and the one part of this tree that has to
  // be tested adversarially rather than happily: a card that reaches the
  // wrong captain makes the mode worthless, and it does so silently, so
  // "the right captain got a card" proves nothing on its own. Every
  // frame every socket in the harbor receives is kept below and read
  // back afterwards, which is the only way a leak would be seen at all.

  // The counting rule first, which needs no sockets. The sizes are the
  // plan's: four or five captains deal one hidden card, six deal two, and
  // a larger harbor is capped rather than dealt a third.
  const rosterOf = (n: number) =>
    Array.from({ length: n }, (_, i) => `captain-${i}`);
  check(
    hiddenCardCount(3) === 0,
    "a three captain table is dealt no hidden card at all",
  );
  check(
    hiddenCardCount(4) === 1 && hiddenCardCount(5) === 1,
    "four and five captains yield one",
  );
  check(hiddenCardCount(6) === 2, "six captains yield two");
  check(
    hiddenCardCount(9) === 2,
    "and a larger harbor is capped at two rather than dealt a third",
  );

  const seed = "a-seed-of-its-own";
  const drawn = dealRoles(rosterOf(6), seed);
  const hiddenCards = Object.values(drawn).filter((r) => r !== "honest");
  check(
    hiddenCards.length === 2 && hiddenCards.includes("pirate"),
    "a six captain draw holds two hidden cards, one of them a Pirate",
  );
  check(
    hiddenCards.filter((role) => role === "broker").length <= 1,
    "and never two Brokers, since a Broker sails alone",
  );
  check(
    JSON.stringify(dealRoles(rosterOf(6), seed)) === JSON.stringify(drawn),
    "the same seed deals the same hand twice",
  );
  check(
    JSON.stringify(dealRoles(rosterOf(6).reverse(), seed)) ===
      JSON.stringify(drawn),
    "and deals it whatever order the roster arrives in",
  );

  // The hand a captain actually holds adds the personal goal an Honest
  // card carries, and the rule for it is an authoring rule before it is
  // a draw: a flourish belongs to its own commission, so it has to be
  // about the goods that commission asks for rather than about anything
  // the deck felt like naming.
  for (const objective of OBJECTIVE_DECK) {
    const deck = flourishDeck(objective.id);
    check(deck.length >= 2, `the ${objective.name} has flourishes of its own`);
    check(
      deck.every(
        (flourish) =>
          flourish.kind !== "stock" ||
          objective.resources.some((r) => r.type === flourish.good),
      ),
      "and every stock a flourish asks a captain to keep is one the commission names",
    );
    // The sentence and the number are written from one record, so this
    // holds by construction. It is asserted anyway, because a flourish
    // that prints one number and is measured on another is the kind of
    // defect a captain reads off the card and the code never sees.
    check(
      deck.every((flourish) =>
        flourishLine(flourish).includes(String(flourish.amount)),
      ),
      "and the sentence a flourish prints carries its own number",
    );
  }
  const flourishIds = OBJECTIVE_DECK.flatMap((objective) =>
    flourishDeck(objective.id).map((flourish) => flourish.id),
  );
  check(
    new Set(flourishIds).size === flourishIds.length,
    "every flourish in the deck is its own id",
  );
  check(
    flourishIds.every((id) => flourishById(id)?.id === id),
    "and every one of them reads back out of the deck by id",
  );

  const fullHand = dealCards(rosterOf(6), seed, "hemp_cordage");
  check(
    JSON.stringify(dealCards(rosterOf(6), seed, "hemp_cordage")) ===
      JSON.stringify(fullHand),
    "the same seed deals the same hand twice",
  );
  check(
    JSON.stringify(dealCards(rosterOf(6).reverse(), seed, "hemp_cordage")) ===
      JSON.stringify(fullHand),
    "and deals it whatever order the roster arrives in",
  );
  check(
    Object.entries(fullHand).every(
      ([userId, card]) => card.role === drawn[userId],
    ),
    "and dealing the hand moves no role a seed already dealt",
  );
  const cordageDeck = flourishDeck("hemp_cordage");
  check(
    Object.values(fullHand).every((card) =>
      card.role === "honest"
        ? cordageDeck.some((flourish) => flourish.id === card.flourishId)
        : card.flourishId === null,
    ),
    "every Honest card carries a flourish off its own commission's deck, and no hidden card carries one",
  );

  // The Pirate pair. A seed where the second hidden card came up Pirate is
  // looked for rather than assumed, because at six captains that seat is
  // a coin toss between the two roles and a test that waits on a coin is
  // a test that fails once in a while.
  let pairSeed = "";
  for (let i = 0; i < 500 && pairSeed === ""; i++) {
    const candidate = dealCards(rosterOf(6), `pair-${i}`, "hemp_cordage");
    if (
      Object.values(candidate).filter((card) => card.role === "pirate")
        .length === 2
    ) {
      pairSeed = `pair-${i}`;
    }
  }
  const paired = dealCards(rosterOf(6), pairSeed, "hemp_cordage");
  const pairIds = Object.keys(paired).filter(
    (id) => paired[id].role === "pirate",
  );
  check(
    pairIds.length === 2 &&
      allyFor(paired, pairIds[0]) === pairIds[1] &&
      allyFor(paired, pairIds[1]) === pairIds[0],
    "each of two Pirates names the other, and neither names a third",
  );
  check(
    Object.keys(paired)
      .filter((id) => paired[id].role === "honest")
      .every((id) => allyFor(paired, id) === null),
    "and an Honest captain at that table is told about nobody",
  );

  // The lone Pirate: the only hidden card a four captain table deals, with
  // no second seat for it to know.
  const lone = dealCards(rosterOf(4), seed, "hemp_cordage");
  const loneId = Object.keys(lone).find((id) => lone[id].role === "pirate");
  check(
    loneId !== undefined && allyFor(lone, loneId) === null,
    "a Pirate with no second Pirate at the table is told about nobody",
  );

  // And the Broker, which sails alone by design whether or not the table
  // dealt a Pirate beside it.
  let brokerSeed = "";
  for (let i = 0; i < 500 && brokerSeed === ""; i++) {
    const candidate = dealRoles(rosterOf(6), `broker-${i}`);
    if (Object.values(candidate).includes("broker")) {
      brokerSeed = `broker-${i}`;
    }
  }
  const brokerTable = dealCards(rosterOf(6), brokerSeed, "hemp_cordage");
  check(
    Object.keys(brokerTable).every((id) => allyFor(brokerTable, id) === null),
    "a table holding a Broker tells nobody about a partner, the Broker least of all",
  );

  const gambitHost = await signUp("gamb_a");
  const gambitSecond = await signUp("gamb_b");
  const gambitThird = await signUp("gamb_c");
  const gambitFourth = await signUp("gamb_d");
  run.extraAccounts.push(gambitHost, gambitSecond, gambitThird, gambitFourth);
  const gambitCrew = [gambitHost, gambitSecond, gambitThird, gambitFourth];

  const gambitRoom = await call<{
    room: { id: string; code: string; mode?: string };
  }>("/api/rooms", {
    method: "POST",
    cookie: gambitHost.cookie,
    body: JSON.stringify({
      name: `Smoke gambit harbor ${suffix}`,
      isPublic: false,
      mode: "ocean_gambit",
      // [H9: the unlock code] The phrase, on every sealed harbor this
      // file charters. It reads it out of the table for the reason
      // LEDGER_PHRASE gives, and the H9 section at the end of the suite
      // is where the gate over it is proved.
      unlock: LEDGER_PHRASE,
    }),
  });
  if (gambitRoom.status !== 200) {
    throw new Error("No Gambit harbor to test with, stopping here.");
  }
  const gambitRoomId = gambitRoom.body.room.id;
  check(
    gambitRoom.body.room.mode === "ocean_gambit",
    "a harbor can be opened on the Ocean Gambit lap",
  );

  const gambitSeats = await Promise.all(
    gambitCrew.slice(1).map((captain) =>
      call<{ room: { id: string } }>("/api/rooms/join", {
        method: "POST",
        cookie: captain.cookie,
        body: JSON.stringify({ code: gambitRoom.body.room.code }),
      }),
    ),
  );
  check(
    gambitSeats.every((seat) => seat.status === 200),
    "and the other three captains join it",
  );

  // Four sockets, each with a recorder attached before it takes its
  // seat, so the frames under test include everything the harbor said
  // rather than only the card that was expected.
  type Frame = { event: string; text: string };
  const seated: Array<{
    captain: Captain;
    socket: Socket;
    frames: Frame[];
  }> = [];
  for (const captain of gambitCrew) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const frames: Frame[] = [];
    socket.onAny((event: string, ...args: unknown[]) => {
      frames.push({ event, text: JSON.stringify(args) });
    });
    const takenASeat = waitForEvent<WireHistory>(
      socket,
      "chat:history",
      (payload) => payload?.roomId === gambitRoomId,
    );
    socket.emit("room:join", { roomId: gambitRoomId });
    const seat = await takenASeat;
    check(
      seat !== null,
      `${captain.username} takes a seat in the Gambit harbor`,
    );
    seated.push({ captain, socket, frames });
  }

  const dealtCards = seated.map((seat) =>
    waitForEvent<WireDelivery>(
      seat.socket,
      "private:entry",
      (payload) => payload?.roomId === gambitRoomId,
    ),
  );
  seated[0].socket.emit("room:start", { roomId: gambitRoomId });
  const cards = await Promise.all(dealtCards);
  check(
    cards.every((card) => card !== null),
    "every captain at the table is dealt a card when the voyage sets sail",
  );

  const dealtRows = await db.voyageRole.findMany({
    where: { roomId: gambitRoomId },
    select: { userId: true, role: true },
  });
  const roleOf = (userId: string) =>
    dealtRows.find((row) => row.userId === userId)?.role;
  check(
    dealtRows.length === gambitCrew.length,
    "and one row per captain is written and no more",
  );
  const hidden = dealtRows.filter((row) => row.role !== "honest");
  check(
    hidden.length === 1,
    "the harbor holds exactly one hidden card at four captains",
  );
  for (const [index, seat] of seated.entries()) {
    const card = cards[index];
    check(
      card?.entry?.kind === "card",
      `${seat.captain.username} is handed a card rather than a bare line`,
    );
    check(
      card?.entry?.role === roleOf(seat.captain.id),
      "and it is the card this table dealt them, read back from the row",
    );
  }

  // Each shape the sweep reads for is matched against the frame it is
  // looking for before any of it is pointed at a harbor. Without this
  // the sweep could be narrowed to nothing by a later edit and go on
  // passing every run, which is the failure mode a leak check has.
  for (const shape of HIDDEN_FIELD_SHAPES) {
    check(
      shape.pattern.test(shape.sample),
      `the sweep matches ${shape.label} when a frame carries one, so it can fail`,
    );
  }

  // Let the departure's broadcasts land before the frames are read
  // back, since the leak this is looking for would ride one of them.
  await new Promise((resolve) => setTimeout(resolve, 600));
  const secret = hidden[0]?.role ?? "pirate";
  const leaks: string[] = [];
  for (const seat of seated) {
    for (const leak of leakedHiddenFields(seat.frames)) {
      leaks.push(`${seat.captain.username} on ${leak}`);
    }
  }
  check(
    leaks.length === 0,
    "no broadcast in the harbor carries a role, a flourish, an ally or an alignment word, on any socket",
  );
  // The sweep above only means something if the shapes it looks for
  // were really on the wire. Every captain at this table is dealt their
  // own role field, so every socket holds one frame carrying one, and
  // the sweep had something to find on all four.
  for (const seat of seated) {
    const ownCard = seat.frames.find(
      (frame) => frame.event === "private:entry",
    );
    const role = roleOf(seat.captain.id);
    check(
      ownCard !== undefined &&
        new RegExp(`"role"\\s*:\\s*"${role}"`).test(ownCard.text),
      `${seat.captain.username}'s own card is the frame carrying their ${role} role, so the sweep had something to find`,
    );
  }
  check(
    seated.every(
      (seat) =>
        seat.frames.filter((frame) => frame.event === "private:entry")
          .length === 1,
    ),
    "and every socket received exactly one private entry, its own",
  );

  // The card carries two optional fields now, so the same question is
  // asked of them. The first is the personal goal every Honest captain
  // was dealt, which has to come off the deck authored for this
  // harbor's own commission rather than off any deck at all.
  const tableObjective = drawObjective(objectiveSeed(gambitRoomId, 0));
  const tableDeck = flourishDeck(tableObjective.id);
  for (const [index, seat] of seated.entries()) {
    const entry = cards[index]?.entry;
    const honest = roleOf(seat.captain.id) === "honest";
    check(
      honest === Boolean(entry?.flourish),
      `${seat.captain.username} is dealt a flourish exactly when their card is Honest`,
    );
    if (honest) {
      check(
        tableDeck.some((flourish) => flourish.id === entry?.flourish),
        "and it is one of the flourishes authored for this commission",
      );
    }
  }
  // The second is the ally, which at four captains must appear on no
  // socket at all: one hidden card is no pair, and nobody at this table
  // has a partner to be told about.
  check(
    seated.every((seat) =>
      seat.frames.every((frame) => !frame.text.includes('"ally"')),
    ),
    "and no socket at a one hidden card table carries an ally field",
  );

  // A reload is a captain asking for the card they already hold. The
  // row is read back rather than drawn again, which is what keeps a
  // refresh from moving every card at the table.
  const rejoining = await openAuthedSocket(gambitSecond);
  run.sockets.push(rejoining);
  const replayed = waitForEvent<WireDelivery>(
    rejoining,
    "private:entry",
    (payload) => payload?.roomId === gambitRoomId,
  );
  rejoining.emit("room:join", { roomId: gambitRoomId });
  const replayedCard = await replayed;
  check(
    replayedCard?.entry?.role === roleOf(gambitSecond.id),
    "a captain who reloads is handed the card they were already holding",
  );
  check(
    (await db.voyageRole.count({ where: { roomId: gambitRoomId } })) ===
      gambitCrew.length,
    "and nothing was dealt a second time",
  );

  seated[0].socket.emit("room:restart", { roomId: gambitRoomId });
  await new Promise((resolve) => setTimeout(resolve, 600));
  check(
    (await db.voyageRole.count({ where: { roomId: gambitRoomId } })) === 0,
    "restarting the voyage clears the hand it dealt",
  );
  const redealt = waitForEvent<WireDelivery>(
    seated[1].socket,
    "private:entry",
    (payload) => payload?.roomId === gambitRoomId,
  );
  seated[0].socket.emit("room:start", { roomId: gambitRoomId });
  check((await redealt) !== null, "and setting sail again deals a new one");

  // The Pirate pair, on the wire, at the one table size that deals two.
  // The hand is written by hand rather than drawn, for two reasons: at
  // six captains the second seat is a coin toss between the two roles
  // and a test that waits on a coin is a test that fails once in a
  // while, and a table that already holds rows is the path a reload
  // walks, so authoring the hand puts the idempotent half of the deal
  // under the same assertions as the draw.
  const gambitFifth = await signUp("gamb_e");
  const gambitSixth = await signUp("gamb_f");
  run.extraAccounts.push(gambitFifth, gambitSixth);
  const pairedCrew = [...gambitCrew, gambitFifth, gambitSixth];

  const pairedRoom = await call<{
    room: { id: string; code: string; mode?: string };
  }>("/api/rooms", {
    method: "POST",
    cookie: gambitHost.cookie,
    body: JSON.stringify({
      name: `Smoke gambit pair ${suffix}`,
      isPublic: false,
      mode: "ocean_gambit",
      unlock: LEDGER_PHRASE,
    }),
  });
  if (pairedRoom.status !== 200) {
    throw new Error("No six captain Gambit harbor to test with.");
  }
  const pairedRoomId = pairedRoom.body.room.id;
  const pairedJoins = await Promise.all(
    pairedCrew.slice(1).map((captain) =>
      call<{ room: { id: string } }>("/api/rooms/join", {
        method: "POST",
        cookie: captain.cookie,
        body: JSON.stringify({ code: pairedRoom.body.room.code }),
      }),
    ),
  );
  check(
    pairedJoins.every((joined) => joined.status === 200),
    "six captains can sit at one Gambit table",
  );
  check(
    hiddenCardCount(pairedCrew.length) === 2,
    "which is the one table size the mode deals two hidden cards to",
  );

  const pairedSeats: Array<{
    captain: Captain;
    socket: Socket;
    frames: Frame[];
  }> = [];
  for (const captain of pairedCrew) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const frames: Frame[] = [];
    socket.onAny((event: string, ...args: unknown[]) => {
      frames.push({ event, text: JSON.stringify(args) });
    });
    const takenASeat = waitForEvent<WireHistory>(
      socket,
      "chat:history",
      (payload) => payload?.roomId === pairedRoomId,
    );
    socket.emit("room:join", { roomId: pairedRoomId });
    await takenASeat;
    pairedSeats.push({ captain, socket, frames });
  }

  // The authored hand: two Pirates, three Honest cards, and one Honest
  // card holding a flourish id that no deck can print. Two of the
  // flourishes are real, so the card can be checked against the deck
  // this harbor drew for itself; the third is the defensive read, which
  // has to drop an unprintable id rather than send a goal with no
  // sentence under it.
  const pairedObjective = drawObjective(objectiveSeed(pairedRoomId, 0));
  const pairedDeck = flourishDeck(pairedObjective.id);
  await db.voyageRole.createMany({
    data: [
      { roomId: pairedRoomId, userId: gambitHost.id, role: "pirate" },
      { roomId: pairedRoomId, userId: gambitSecond.id, role: "pirate" },
      {
        roomId: pairedRoomId,
        userId: gambitThird.id,
        role: "honest",
        flourish: pairedDeck[0].id,
      },
      {
        roomId: pairedRoomId,
        userId: gambitFourth.id,
        role: "honest",
        flourish: pairedDeck[1].id,
      },
      {
        roomId: pairedRoomId,
        userId: gambitFifth.id,
        role: "honest",
        flourish: "a-flourish-no-deck-can-print",
      },
      { roomId: pairedRoomId, userId: gambitSixth.id, role: "honest" },
    ],
  });

  const pairedCards = pairedSeats.map((seat) =>
    waitForEvent<WireDelivery>(
      seat.socket,
      "private:entry",
      (payload) => payload?.roomId === pairedRoomId,
    ),
  );
  pairedSeats[0].socket.emit("room:start", { roomId: pairedRoomId });
  const pairedHand = await Promise.all(pairedCards);
  check(
    pairedHand.every((card) => card !== null),
    "a hand already written down is the hand a table is dealt",
  );
  const pairedCardFor = new Map(
    pairedSeats.map((seat, index) => [seat.captain.id, pairedHand[index]]),
  );

  const firstAlly = pairedCardFor.get(gambitHost.id)?.entry?.ally;
  const secondAlly = pairedCardFor.get(gambitSecond.id)?.entry?.ally;
  check(
    firstAlly?.userId === gambitSecond.id && firstAlly?.name === "Smoke gamb_b",
    "the first Pirate is handed the second by name and id",
  );
  check(
    secondAlly?.userId === gambitHost.id && secondAlly?.name === "Smoke gamb_a",
    "and the second is handed the first",
  );
  check(
    pairedCardFor.get(gambitThird.id)?.entry?.flourish === pairedDeck[0].id &&
      pairedCardFor.get(gambitFourth.id)?.entry?.flourish === pairedDeck[1].id,
    "an Honest captain is handed the flourish their own row holds",
  );
  check(
    pairedCardFor.get(gambitFifth.id)?.entry?.flourish === undefined,
    "a flourish id no deck can print is dropped rather than sent",
  );
  check(
    pairedCardFor.get(gambitSixth.id)?.entry?.flourish === undefined &&
      pairedCardFor.get(gambitSixth.id)?.entry?.ally === undefined,
    "and a card dealt neither carries neither",
  );

  // The sweep, on the table that has a secret worth leaking and a
  // partner worth telling. Two frames may carry the ally and both must
  // be the entry frames of the two captains it names, which is why the
  // count below reads every frame including the cards; nothing else on
  // any of the six sockets may carry any hidden field at all, which is
  // what the sweep under it reads for.
  await new Promise((resolve) => setTimeout(resolve, 600));
  const allyFrames: { captain: string; event: string }[] = [];
  const pairLeaks: string[] = [];
  for (const seat of pairedSeats) {
    for (const frame of seat.frames) {
      if (!frame.text.includes('"ally"')) continue;
      allyFrames.push({
        captain: seat.captain.username,
        event: frame.event,
      });
    }
    for (const leak of leakedHiddenFields(seat.frames)) {
      pairLeaks.push(`${seat.captain.username} on ${leak}`);
    }
  }
  check(
    allyFrames.length === 2 &&
      allyFrames.every((frame) => frame.event === "private:entry") &&
      new Set(allyFrames.map((frame) => frame.captain)).size === 2,
    "the ally field reaches two entry frames on two sockets and no other frame on any of them",
  );
  check(
    pairLeaks.length === 0,
    "and no broadcast at the paired table carries a role, a flourish, an ally or an alignment word either",
  );

  // The row is the record, so the flourish has to survive the write.
  const pairedRows = await db.voyageRole.findMany({
    where: { roomId: pairedRoomId },
    select: { userId: true, role: true, flourish: true },
  });
  check(
    pairedRows.length === pairedCrew.length &&
      pairedRows.find((row) => row.userId === gambitThird.id)?.flourish ===
        pairedDeck[0].id,
    "and every flourish is written down beside the role that drew it",
  );

  // A reload of a Pirate, which is the one path that has to work the
  // pairing out again rather than read it off the row it is sending.
  const pairedReload = await openAuthedSocket(gambitSecond);
  run.sockets.push(pairedReload);
  const pairedReplayed = waitForEvent<WireDelivery>(
    pairedReload,
    "private:entry",
    (payload) => payload?.roomId === pairedRoomId,
  );
  pairedReload.emit("room:join", { roomId: pairedRoomId });
  const replayedCard2 = await pairedReplayed;
  check(
    replayedCard2?.entry?.ally?.userId === gambitHost.id,
    "and a Pirate who reloads is handed their ally again",
  );

  // The other half of the guard: a harbor on the founding lap deals
  // nothing at all, so a Classic voyage is untouched by any of this.
  const classicRoom = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: gambitHost.cookie,
      body: JSON.stringify({
        name: `Smoke classic harbor ${suffix}`,
        isPublic: false,
      }),
    },
  );
  if (classicRoom.status !== 200) {
    throw new Error("No Classic harbor to test with, stopping here.");
  }
  const classicRoomId = classicRoom.body.room.id;
  await Promise.all(
    gambitCrew.slice(1).map((captain) =>
      call<{ room: { id: string } }>("/api/rooms/join", {
        method: "POST",
        cookie: captain.cookie,
        body: JSON.stringify({ code: classicRoom.body.room.code }),
      }),
    ),
  );
  const classicFrames: string[] = [];
  for (const seat of seated) {
    const takenASeat = waitForEvent<WireHistory>(
      seat.socket,
      "chat:history",
      (payload) => payload?.roomId === classicRoomId,
    );
    seat.socket.onAny((event: string, ...args: unknown[]) => {
      classicFrames.push(
        `${seat.captain.username}:${event}:${JSON.stringify(args)}`,
      );
    });
    seat.socket.emit("room:join", { roomId: classicRoomId });
    await takenASeat;
  }
  seated[0].socket.emit("room:start", { roomId: classicRoomId });
  await new Promise((resolve) => setTimeout(resolve, 600));
  check(
    !classicFrames.some((frame) => frame.includes("private:entry")),
    "a Classic harbor sends no private entry to anyone",
  );
  check(
    (await db.voyageRole.count({ where: { roomId: classicRoomId } })) === 0,
    "and writes no alignment at all",
  );

  return {
    classicRoomId,
    gambitFifth,
    gambitFourth,
    gambitHost,
    gambitRoomId,
    gambitSecond,
    gambitSixth,
    gambitThird,
    pairedCrew,
    pairedRoomId,
    seated,
    secret,
  };
}
