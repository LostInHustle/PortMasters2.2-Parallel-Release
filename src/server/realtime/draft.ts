// =====================================================================
// Realtime layer: the path draft, and the book of switches.
//
// [D7: the draft, and switching] The room's half of the plan's clause. The
// rule it deals by is pure and lives in src/lib/game/draft.ts; what is here
// is the part that cannot be pure, which is why it is here rather than
// there: a hand of cards is private information and the client cannot be
// trusted to deal it. So the deck is built and shuffled in this process,
// the pass is resolved in this process, and a captain is sent their own
// hand and nobody else's, through the same emitToUser the private channel
// uses. No frame that reaches a room carries a card nobody has played yet.
//
// The draft is the one part of this epic that is a clock rather than a
// rule, and the clock is deliberately its own. Three steps, fifteen seconds
// each, which is the plan's forty five second interface read as three
// decisions: the lap already has a clock (see armPhaseClock in
// ./checkpoint) and this one is not cast from it, because the draft is not
// a phase of the leg and a table whose phases are scaled by PHASE_CLOCK has
// not asked for its deal to be scaled with them. The plan's own sentence is
// why the number is fixed: "Forty five seconds with a good interface is the
// target." Every step closes early the moment every captain has laid a card
// down, so the forty five is a ceiling the table usually beats, and the
// auto keep (DRAFT_AUTO_PICK) is what stops one captain from holding it.
//
// Where the draft sits in the voyage is worth stating, because it is not a
// phase and no lap mentions it. It is dealt on the departure, in the same
// breath as the alignment deal, and it runs over the opening leg: Dawn is
// twenty five seconds and the deal is at most forty five, so a slow table
// is still drafting as the market opens. That is the cost of not adding a
// seventh phase to a lap the mode owns (see checkpointPhaseOrder in
// src/lib/game/mode.ts), and it buys nothing worse than a captain reading
// their first market with three cards still in front of them. The engine
// reads a path live off the save (pathCargoModifier, lockedBehind), so
// everything the path does begins the moment the save holds it.
//
// The book of switches is the module's other half. It is the room's own
// record of who has changed their papers this voyage, which is the half of
// that rule the server can enforce: the fee, the forfeiture and the once a
// voyage stamp all live in the captain's own save, but a publication that
// anyone could ask for twice is a fleet log nobody can trust, so the book
// is kept where the frames are written. It is a Map rather than a table
// for the plan's own reason: "draft state is transient per voyage, so
// nothing durable is at risk."
// =====================================================================
import { DraftStep, DraftView, PathSwitched } from "@/types/realtime/draft";
import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { DRAFT_STEP_SECONDS } from "@/lib/game/constants/paths";
import {
  DRAFT_AUTO_PICK,
  draftDeck,
  draftHands,
  keepFrom,
  passLeft,
} from "@/lib/game/draft";
import { createRng } from "@/lib/game/rng";
import { pathDraftOn } from "@/lib/game/flags";
import type { PathId } from "@/lib/game/paths";
import { emitToUser } from "./presence";
import { noteTelemetry } from "./telemetry";
import { noteVoyageLog } from "./voyage-log";

// One captain's seat in a live draft. The kept cards are the ones this
// captain has already taken from the beats that are behind them, in the
// order they took them: the first keep is the card they chose off their
// dealt three, the second is the card they chose off the two passed to
// them, and the last step chooses between those two.
interface DraftSeat {
  userId: string;
  name: string;
  kept: PathId[];
  path: PathId | null;
}

// A room's draft, while it is being dealt.
//
// `hands` and `picks` are indexed by seat and always the same length as
// `seats`, which is the invariant the whole module leans on: a hand
// belongs to a seat, a pick belongs to the same seat, and a step is
// resolved by walking that one index. `openedAt` is when the deck was
// dealt rather than when a step began, because the plan's reading is the
// time to complete the draft and not the time to answer one card.
interface Draft {
  roomId: string;
  seats: DraftSeat[];
  // The seating order is the room's own roster order, which is also the
  // order the pass follows: left is the next seat in it, wrapping at the
  // end, so every captain at the table agrees about which way the cards
  // travelled without being told.
  hands: PathId[][];
  picks: (number | null)[];
  step: Exclude<DraftStep, "done">;
  deadline: number;
  openedAt: number;
  timer: NodeJS.Timeout | null;
}

const drafts = new Map<string, Draft>();

// The room's book of switches: who has changed their papers this voyage.
//
// What is kept is the allowance and not the change, which is the whole of
// what the one reader of it asks (see recordPathSwitch): the path a switch
// took up rides the frame and the log line the caller validated, so a book
// that held the path as well would be a second copy of a fact nothing
// reads back. A set of ids is also the honest shape of the lifetime, which
// is this process and this voyage: the book is dropped when the voyage is
// (see clearPathVoyage), while the stamp the same switch writes lives on
// in the captain's own save after a restart. Those are the two halves of
// "once per voyage", and each half is written down where it is kept: this
// book here and its one reader below, the save's in applyPathSwitch
// across the wire.
const switchesByRoom = new Map<string, Set<string>>();

function clearDraftTimer(draft: Draft): void {
  if (draft.timer !== null) {
    clearTimeout(draft.timer);
    draft.timer = null;
  }
}

// The step's clock, armed once per step, and unref'd for the reason the
// checkpoint's is: a deadline must never be the reason a process stays up.
//
// The timer is armed for the deadline the draft is currently publishing and
// the fire below checks it against the same number, which is what lets a
// fire tell a live clock from one that a pick already answered.
function armDraftClock(io: Server, draft: Draft): void {
  clearDraftTimer(draft);
  const armedFor = draft.deadline;
  const timer = setTimeout(
    () => fireDraftClock(io, draft.roomId, armedFor),
    Math.max(0, armedFor - Date.now()),
  );
  timer.unref();
  draft.timer = timer;
}

// The clock's fire: this step ran out with cards still in front of somebody.
//
// The captain who let it run out keeps the first card of their own hand
// (see DRAFT_AUTO_PICK), which is a card they were dealt rather than one
// the server liked, and then the step closes the ordinary way. A fire for a
// deadline the draft has already moved past is dropped, so a timer that
// outlived its step cannot resolve the step that replaced it.
function fireDraftClock(io: Server, roomId: string, armedFor: number): void {
  const draft = drafts.get(roomId);
  if (!draft || draft.deadline !== armedFor) return;
  clearDraftTimer(draft);
  for (let seat = 0; seat < draft.seats.length; seat += 1) {
    if (draft.picks[seat] === null) draft.picks[seat] = DRAFT_AUTO_PICK;
  }
  advanceDraft(io, draft);
}

/**
 * The deal, on the moment a voyage sets sail.
 *
 * Dealt against the roster the departure pinned and nothing else, for the
 * reason the fleet's own size is pinned there (see voyageSeats in the
 * caller): membership can change mid voyage and a deck cannot be re dealt
 * around it. A captain who joins a voyage already under way is therefore
 * not in this draft and sails pathless, which is the same reading the
 * harbor gives every pathbound card to a captain holding no path, and the
 * same one the alignment deal takes about a late arrival.
 *
 * Idempotent, like the alignment deal and for the same reason: a double
 * start must not deal a table a second hand it has already read. The whole
 * deal is one draw off a seed minted here and dropped, because the deck's
 * order is the private half of this feature and a seed a client could know
 * is a hand a client could read.
 *
 * A build with the switch off deals nothing at all, which leaves every
 * captain pathless and every pathbound card locked, exactly the voyage
 * this tree sailed before the feature existed.
 */
export async function dealPaths(
  io: Server,
  roomId: string,
  roster: readonly string[],
  mode: unknown,
): Promise<void> {
  if (!pathDraftOn(mode)) return;
  if (drafts.has(roomId)) return;
  if (roster.length === 0) return;

  const rows = await db.user.findMany({
    where: { id: { in: [...roster] } },
    select: { id: true, displayName: true },
  });
  const names = new Map(rows.map((user) => [user.id, user.displayName]));
  // Seated in the roster's own order, with a member the user table cannot
  // name left out rather than seated under a placeholder: the seating order
  // is what the pass follows, and a seat nobody can be named at is a seat
  // the table would hand cards to and never hear from.
  const seated: { userId: string; name: string }[] = [];
  for (const userId of roster) {
    const name = names.get(userId);
    if (name) seated.push({ userId, name });
  }
  if (seated.length === 0) return;

  const deck = draftDeck(seated.length, createRng(randomUUID()));
  const now = Date.now();
  const draft: Draft = {
    roomId,
    seats: seated.map((seat) => ({ ...seat, kept: [], path: null })),
    hands: draftHands(deck, seated.length),
    picks: seated.map(() => null),
    step: "first",
    deadline: now + DRAFT_STEP_SECONDS * 1000,
    openedAt: now,
    timer: null,
  };
  drafts.set(roomId, draft);
  armDraftClock(io, draft);
  sendDraftViews(io, draft);
}

/**
 * The draft as one captain should see it, or null where there is none for
 * them.
 *
 * Null is three answers that are one answer on the wire: no draft is
 * running, this captain is not in the draft that is, or the draft is
 * over. The client draws nothing for all three, which is what a frame of
 * null means (see the draft:update listener), so the request that answers
 * with this never has to explain which of them it was.
 */
export function draftViewFor(roomId: string, userId: string): DraftView | null {
  const draft = drafts.get(roomId);
  if (!draft) return null;
  const seat = draft.seats.findIndex((held) => held.userId === userId);
  if (seat < 0) return null;
  return draftView(draft, seat);
}

/**
 * One captain's card, laid down: the pick their step has been waiting for.
 *
 * Null means the pick was taken. A sentence means it was refused, and the
 * sentences are the three ways a pick can be wrong: no draft to pick in,
 * no seat in this draft, or a card that is not in front of them. A second
 * pick from the same captain is refused as well, because a step is answered
 * once and the first answer is the one the table has been shown.
 *
 * The pick is an index rather than a path for the reason keepFrom gives:
 * a deck with a floor can hand one captain two cards of the same path, so
 * "keep the Quartermaster" does not name a card.
 */
export function takeDraftPick(
  io: Server,
  roomId: string,
  userId: string,
  pick: unknown,
): string | null {
  const draft = drafts.get(roomId);
  if (!draft) return "The draft is not running.";
  const seat = draft.seats.findIndex((held) => held.userId === userId);
  if (seat < 0) return "You are not in this draft.";
  if (draft.picks[seat] !== null) {
    return "Your card is already laid down.";
  }
  // The type guard is the caller's rather than keepFrom's, and it is what
  // lets the index be stored as the number it was checked to be; keepFrom
  // repeats the check so the rule itself stays total for any caller.
  if (typeof pick !== "number" || !Number.isInteger(pick)) {
    return "That is not one of the cards in front of you.";
  }
  if (keepFrom(draft.hands[seat], pick) === null) {
    return "That is not one of the cards in front of you.";
  }
  draft.picks[seat] = pick;
  // A step closes when the last captain has answered, and the clock stops
  // being the thing the table is waiting on: the timer goes rather than
  // being left to fire against a step that is already resolved.
  if (draft.picks.every((held) => held !== null)) {
    clearDraftTimer(draft);
    advanceDraft(io, draft);
    return null;
  }
  // Somebody is still reading their cards, so the table is told how many,
  // which is the whole of what the wait is made of. It is a count and
  // never a card, so it is the one thing about a live step that can go to
  // every captain in it.
  sendDraftViews(io, draft);
  return null;
}

// One step into the next: the picks are resolved into keeps, the cards the
// table did not keep travel the way the plan's sentence says, and the
// whole table is told where the draft now stands.
//
// The three steps are the rule's own arithmetic and each one is a line:
// the first keep passes the two it left behind to the seat on the left,
// the second keep discards the one it left behind, and the last choose
// settles the path (see the header of src/lib/game/draft.ts for what the
// passing rule means and why the captain chooses which of their two
// papers to sail on).
function advanceDraft(io: Server, draft: Draft): void {
  const rests: PathId[][] = [];
  const finals: (PathId | undefined)[] = [];
  for (let seat = 0; seat < draft.seats.length; seat += 1) {
    const chosen = keepFrom(
      draft.hands[seat],
      draft.picks[seat] ?? DRAFT_AUTO_PICK,
    );
    // A hand is never empty and a pick is refused unless it names a card
    // in one, so this cannot answer null. The guard is here rather than an
    // assertion because the alternative to carrying on is a crash on the
    // departure of a voyage: the seat keeps whatever it already kept, and
    // the settle below skips a seat with nothing at all.
    if (!chosen) {
      rests.push([]);
      finals.push(draft.seats[seat].kept[0]);
      continue;
    }
    if (draft.step === "last") {
      finals.push(chosen.kept);
    } else {
      draft.seats[seat].kept.push(chosen.kept);
    }
    rests.push(chosen.rest);
  }

  if (draft.step === "last") {
    settleDraft(io, draft, finals);
    return;
  }

  draft.step = draft.step === "first" ? "second" : "last";
  draft.hands =
    draft.step === "second"
      ? passLeft(rests)
      : // The last step is the two cards this captain kept, in the order
        // they kept them, so the choose is between their own two papers
        // and nothing anybody else did can change either of them.
        draft.seats.map((seat) => [...seat.kept]);
  draft.picks = draft.seats.map(() => null);
  draft.deadline = Date.now() + DRAFT_STEP_SECONDS * 1000;
  armDraftClock(io, draft);
  sendDraftViews(io, draft);
}

// The draft's end: every seat holds a path, the fleet is told what each of
// them took, and the room's draft state goes.
//
// The publication is two facts rather than one, and the pair is the plan's
// ask read twice. The log line is the record the fleet reads back at Dusk
// ("a visible history" is the shape every market in this epic takes), and
// the frame is the same news as it happens. Both carry the captain's name
// and the path and nothing else, because a path is what the whole table
// can see of it: the cards that led there are gone the moment they are
// played, and nothing here could tell anyone what they were.
//
// The save is the last thing written and this module does not write it.
// What a captain sails on is applied by their own client when it reads the
// settled view (see applyDraftPath), which is the line every
// client-authoritative fact in this build draws, and the reason the draft
// can end on a server that has never read a save.
function settleDraft(
  io: Server,
  draft: Draft,
  finals: readonly (PathId | undefined)[],
): void {
  const seconds = Math.max(0, Math.round((Date.now() - draft.openedAt) / 1000));
  for (let seat = 0; seat < draft.seats.length; seat += 1) {
    const held = draft.seats[seat];
    const path = finals[seat] ?? held.kept[0];
    if (!path) continue;
    held.path = path;
    emitToUser(io, held.userId, "draft:update", draftView(draft, seat));
    noteVoyageLog(io, draft.roomId, {
      kind: "path_taken",
      captain: held.name,
      path,
    });
    // [I1: the telemetry spine] The draft's own reading, filed per captain
    // because a captain is what every other event in this record is filed
    // against. The seconds are the table's rather than this captain's, and
    // are the same number on every seat of one draft: the plan's reading
    // is the time the interface took, and a reader takes any one of them
    // rather than adding them up.
    noteTelemetry(draft.roomId, "path_taken", {
      actor: held.userId,
      path,
      seconds,
    });
  }
  clearDraftTimer(draft);
  drafts.delete(draft.roomId);
}

/**
 * One captain's change of papers, recorded in the room's book and published
 * to the fleet.
 *
 * Answers false when the book already holds a switch for this captain, and
 * the caller turns that into the refusal the fleet would otherwise be lied
 * to about: the plan's clause is "once per voyage", and this is the half of
 * that sentence the server can keep. The other half is the captain's own
 * save (see applyPathSwitch in @/lib/game/engine/draft), which is where the
 * fee is paid, the orders are forfeited and the window is judged, because
 * the purse and the manifest are the captain's own and this server has
 * never read either.
 *
 * The three publications are one act and happen together: the frame the
 * room watches, the log line the fleet reads back, and the measurement.
 * All three are written from the row the caller validated, so a switch
 * cannot be measured without being announced or announced without being
 * recorded.
 */
export function recordPathSwitch(
  io: Server,
  roomId: string,
  row: { userId: string; name: string; path: PathId },
): boolean {
  const book = switchesByRoom.get(roomId) ?? new Set<string>();
  if (book.has(row.userId)) return false;
  book.add(row.userId);
  switchesByRoom.set(roomId, book);

  const published: PathSwitched = {
    roomId,
    userId: row.userId,
    name: row.name,
    path: row.path,
  };
  io.to(`room:${roomId}`).emit("path:switched", published);
  noteVoyageLog(io, roomId, {
    kind: "path_switched",
    captain: row.name,
    path: row.path,
  });
  noteTelemetry(roomId, "path_switched", {
    actor: row.userId,
    path: row.path,
  });
  return true;
}

// One captain's view of the draft they are standing in.
function draftView(draft: Draft, seat: number): DraftView {
  return {
    roomId: draft.roomId,
    step: draft.seats[seat].path !== null ? "done" : draft.step,
    deadline: draft.deadline,
    hand: draft.hands[seat] ?? [],
    // The count is of the captains who still have a card in front of them,
    // which includes the reader: a captain who has answered sees the table
    // as one smaller, which is the same thing everyone else sees.
    open: draft.picks.filter((held) => held === null).length,
    path: draft.seats[seat].path,
  };
}

// Every seat's own hand, to that seat's own sockets. The loop is over the
// draft's seats rather than over the presence map, because a draft reaches
// the captains it was dealt to and no one else: a spectator in the room and
// a captain who joined after the deal are both sent nothing, which is the
// privacy rule stated as an iteration rather than as a filter applied after
// the fact.
function sendDraftViews(io: Server, draft: Draft): void {
  for (let seat = 0; seat < draft.seats.length; seat += 1) {
    emitToUser(
      io,
      draft.seats[seat].userId,
      "draft:update",
      draftView(draft, seat),
    );
  }
}

/**
 * Everything this module holds for a voyage goes, and the seats that were
 * standing in the draft are told so.
 *
 * A null view is the close signal, and it is one frame rather than two
 * (see DraftView on the wire): a draft that is over by settlement sends the
 * settled view and a draft that is over by a wipe sends nothing at all, and
 * the client reads the first as a path and the second as a draft to put
 * away. Reached by the two endings a voyage has: the host wiping it, which
 * makes it a new voyage with no paths dealt and no switch spent, and the
 * conclusion, where the harbor goes back to the pier.
 */
export function clearPathVoyage(io: Server, roomId: string): void {
  const draft = drafts.get(roomId);
  if (draft) {
    clearDraftTimer(draft);
    drafts.delete(roomId);
    for (const seat of draft.seats) {
      emitToUser(io, seat.userId, "draft:update", null);
    }
  }
  switchesByRoom.delete(roomId);
}

// The same clear for a room that is being torn down, where there is nobody
// left in the channel to tell.
export function clearPathVoyageSilent(roomId: string): void {
  const draft = drafts.get(roomId);
  if (draft) clearDraftTimer(draft);
  drafts.delete(roomId);
  switchesByRoom.delete(roomId);
}
