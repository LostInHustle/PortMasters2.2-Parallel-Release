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
// Where the draft sits in the voyage is a seat of its own [W2], and it is
// stated here because the seat did not always exist. The deal still happens
// on the departure, in the same breath as the alignment deal, but the room
// now stops there: a dealing Gambit lap carries the draft's seat between
// the pier and Dawn (see checkpointPhaseOrder in src/lib/game/mode.ts), the
// server pins the room to it at departure (see ./wiring/start-voyage), and
// the round's first leg phase opens only once every seat holds a path. The
// step off the seat is this module's own announcement rather than a ready
// vote, because the departure is the settle: settleDraft tells the
// checkpoint to move the room (see announceDraftComplete in ./checkpoint),
// and every captain's client runs that step the same way it runs any
// announced one. The engine reads a path live off the save
// (pathCargoModifier, lockedBehind), so everything the path does begins
// the moment the save holds it, which is the moment the settled view is
// read.
//
// Nothing in the feature is a countdown, and nothing shows anyone a timer.
// The steps close when every seat has answered, and a captain who is still
// connected holds the table however long they take: the room waits for its
// captains, not for a clock. The one clock left is the absence watch below,
// which exists for the seat that is gone rather than slow. When a seat's
// last socket drops, the room gives it DRAFT_WATCH_MS to come back and then
// lays the first card of that captain's own hand for them (the same
// DRAFT_AUTO_PICK the old auto keep used), because a table held forever for
// a captain who is gone is a voyage that never sails.
//
// The book of switches is the module's other half. It is the room's own
// record of who has changed their papers this voyage, which is the half of
// that rule the server can enforce: the fee, the forfeiture and the once a
// voyage stamp all live in the captain's own save, but a publication that
// anyone could ask for twice is a fleet log nobody can trust, so the book
// is kept where the frames are written. It is a Map rather than a table
// for the plan's own reason: "draft state is transient per voyage, so
// nothing durable is at risk."
//
// [F6: charters at leg four] The module keeps a second book beside the
// switches: who is sailing on what. The draft's own seats carry each
// captain's path while the draft runs, but the seats are dropped the
// moment it settles, and the charter take filed at leg four needs the path
// long after that, so the settled paths move into a map of their own (see
// pathsByRoom and heldPathOf). A switch moves that map with it, and both
// endings drop it, which is the switches' own lifetime above and the same
// reason: the captain's save is the durable copy of their papers, and the
// room's copy of either fact lasts exactly one voyage.
// =====================================================================
import { DraftStep, DraftView, PathSwitched } from "@/types/realtime/draft";
import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { DRAFT_WATCH_MS } from "@/lib/game/constants/paths";
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
import { announceDraftComplete } from "./checkpoint";
import { emitToUser, userSockets } from "./presence";
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
  openedAt: number;
}

const drafts = new Map<string, Draft>();

// The absence watches, one per room at most.
//
// A watch exists for the seat that is gone, never for one that is slow:
// it is armed when a draft seat's last socket drops (and when a deal
// seats a captain who holds no socket at all), it waits DRAFT_WATCH_MS,
// and its fire lays the first card of that captain's own hand for every
// seat that is still gone. A captain who comes back inside the window
// changes nothing anybody is told: the fire simply finds their socket
// alive again and leaves their card to them, which is the same check the
// departure grace makes and for the same reason (see armDeparture in
// ./presence).
//
// The map is keyed by room rather than by seat because a step resolves
// for the whole table at once: one watch per room looking at every seat
// is one timer to reason about rather than one per captain, and the fire
// below answers "who is gone" from the presence map fresh rather than
// from whoever happened to trip the arming.
const draftWatches = new Map<string, NodeJS.Timeout>();

function disarmDraftWatch(roomId: string): void {
  const timer = draftWatches.get(roomId);
  if (timer !== undefined) {
    clearTimeout(timer);
    draftWatches.delete(roomId);
  }
}

// Whether this seat's last socket is gone. The one reading of presence
// this module makes, expressed as the whole test rather than as an access
// to the map's shape, so the day presence grows a second condition (a
// socket state stronger than "connected") this module is told about it
// by a compile error rather than by a bug.
function seatAway(userId: string): boolean {
  return (userSockets.get(userId)?.size ?? 0) === 0;
}

// Arms the room's absence watch, unless one is already running or the
// room has nothing left to wait on. Called from the three moments a seat
// can be gone with its card still in front of it: the deal (a captain who
// lost their connection before the host set sail), a last socket dropping
// (the ordinary case, see noteDraftAway), and a step turning over (the
// new step's cards are in front of seats that were already gone when it
// dealt, and the fire that turned it over has nothing left to lay).
function armDraftWatch(io: Server, roomId: string): void {
  if (draftWatches.has(roomId)) return;
  const draft = drafts.get(roomId);
  if (!draft) return;
  if (
    !draft.seats.some(
      (seat, index) => draft.picks[index] === null && seatAway(seat.userId),
    )
  )
    return;
  const timer = setTimeout(() => fireDraftWatch(io, roomId), DRAFT_WATCH_MS);
  // Like the checkpoint's clock and the departure grace, this must never
  // be the reason a process stays up.
  timer.unref();
  draftWatches.set(roomId, timer);
}

// The watch's fire: every seat that is still gone has its first card laid.
//
// "First" is the card the seat was dealt rather than a card of the
// server's choosing (see DRAFT_AUTO_PICK), and the laying runs through
// takeDraftPick, which is the same door a captain's own press comes
// through: a laid card closes the step when it is the last one out, turns
// the step over, and settles the draft when the turn was the last, so the
// fire has no rules of its own to keep in step with the pick's. The loop
// re-reads the step after every card because one fire can carry a table
// through all three steps when everyone but a present handful is gone,
// and it stops when there is no seat left to lay for. The bound is the
// whole draft's worth of cards: three steps of one card a seat, which no
// fire can exceed by construction, and the loop is written to the bound
// anyway so a rule that ever breaks that construction stops the fire
// rather than spinning it.
function fireDraftWatch(io: Server, roomId: string): void {
  draftWatches.delete(roomId);
  const draft = drafts.get(roomId);
  if (!draft) return;
  for (let lays = draft.seats.length * 3; lays > 0; lays -= 1) {
    const seat = draft.seats.findIndex(
      (held, index) => draft.picks[index] === null && seatAway(held.userId),
    );
    if (seat < 0) return;
    takeDraftPick(
      io,
      roomId,
      draft.seats[seat].userId,
      DRAFT_AUTO_PICK,
      draft.step,
    );
    if (!drafts.has(roomId)) return;
  }
  // Unreachable while a draft is three steps of one card a seat, and the
  // re-arm is here for the day that stops being true: a seat still gone
  // with its card still in front of it gets another window rather than
  // being dropped.
  armDraftWatch(io, roomId);
}

/**
 * A draft seat's last socket has dropped: the room gives it a window to
 * come back, and the absence watch is that window.
 *
 * Called by the disconnect frame for every room-departing captain, which
 * is why the test is written the way it is: most disconnects have nothing
 * to do with a draft, so the seat is looked up first and a captain who is
 * not in one (or has already laid their card for this step, or whose
 * draft has settled) arms nothing. The watch is fresh-sighted about
 * presence rather than trusting this call, so a reconnect inside the
 * window needs no cancellation frame of its own: the fire simply finds
 * the socket alive and leaves the seat alone.
 */
export function noteDraftAway(
  io: Server,
  roomId: string,
  userId: string,
): void {
  const draft = drafts.get(roomId);
  if (!draft) return;
  const seat = draft.seats.findIndex((held) => held.userId === userId);
  if (seat < 0 || draft.picks[seat] !== null) return;
  armDraftWatch(io, roomId);
}

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

// [F6: charters at leg four] The room's book of paths: who is sailing on
// what this voyage.
//
// The draft's seats hold the same fact while the draft runs, and this
// book is where it lives after the seats go: settleDraft deletes them the
// moment every seat holds a path, and the charter take filed at leg four
// is attributed long after that. The book is written at the settle, moved
// by a switch, and dropped by both endings, which is the switches' own
// lifetime above. A late arrival is not in it and reads null, which the
// take's reader treats as an unattributable take rather than a guess: the
// deal skipped them (see dealPaths), so a path for them would be a path
// the table never dealt.
const pathsByRoom = new Map<string, Map<string, PathId>>();

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
 *
 * It answers whether a draft stands on the room when it returns, because
 * the caller pins the room to the draft's seat before dealing: the seat is
 * left by the settle and by nothing else, so a departure whose deal
 * declined to seat anybody would be a table standing forever at a seat
 * with no cards on it. The answer never changes for the ordinary deal; it
 * is the empty one, and the double start, that the caller reads it for
 * (see the guard in ./wiring/start-voyage).
 */
export async function dealPaths(
  io: Server,
  roomId: string,
  roster: readonly string[],
  mode: unknown,
): Promise<boolean> {
  if (!pathDraftOn(mode)) return false;
  if (drafts.has(roomId)) return true;
  if (roster.length === 0) return false;

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
  if (seated.length === 0) return false;

  const deck = draftDeck(seated.length, createRng(randomUUID()));
  const draft: Draft = {
    roomId,
    seats: seated.map((seat) => ({ ...seat, kept: [], path: null })),
    hands: draftHands(deck, seated.length),
    picks: seated.map(() => null),
    step: "first",
    openedAt: Date.now(),
  };
  drafts.set(roomId, draft);
  // A departure seats the roster as it stands, and a member whose tab
  // closed moments before the host set sail is in that roster while
  // holding no socket, so the deal can hand cards to a seat that is
  // already away. The arm is the same one a live disconnect trips, asked
  // here because no socket is left to trip it (see armDraftWatch).
  armDraftWatch(io, roomId);
  sendDraftViews(io, draft);
  return true;
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
  if (draft) {
    const seat = draft.seats.findIndex((held) => held.userId === userId);
    if (seat >= 0) return draftView(draft, seat);
  }
  // [bug cycle: a seat the settle left behind] The draft is gone, and the
  // book is the only copy of what this captain took. The settled view is
  // emitted to sockets and the draft is deleted in the same breath, so a
  // captain whose socket was dark from the last pick through the settle
  // was sent the result into nothing and every later request answered
  // null: their save never learned the path the fleet was told, while the
  // room's own book and the charter take went on attributing one. The
  // book still holds it (settleDraft writes it before the seats go), so
  // the reader answers from there: a settled view whose hand is the one
  // card the seat took. The client applies the path and draws nothing,
  // which is the whole of what a settled view is for (see PathDraft),
  // and the engine's own guard refuses a save that already holds a path
  // (see applyDraftPath), so a captain who heard the frame live reads a
  // repeat as a frame to drop rather than an identity to overwrite. A
  // late arrival and a wiped voyage are not in the book and still read
  // null, which is what those two screens draw.
  const held = heldPathOf(roomId, userId);
  if (!held) return null;
  return {
    roomId,
    step: "done",
    hand: [held],
    open: 0,
    picked: true,
    path: held,
  };
}

/**
 * One captain's card, laid down: the pick their step has been waiting for.
 *
 * Null means the pick was taken. A sentence means it was refused, and the
 * sentences are the four ways a pick can be wrong: no draft to pick in, no
 * seat in this draft, a step the table has already left, or a card that is
 * not in front of them. A second pick from the same captain is refused as
 * well, because a step is answered once and the first answer is the one the
 * table has been shown.
 *
 * The pick is an index rather than a path for the reason keepFrom gives:
 * a deck with a floor can hand one captain two cards of the same path, so
 * "keep the Quartermaster" does not name a card. And an index is only a
 * card against one hand, which is why the answer names the step it was read
 * off rather than letting the room assume: the hands change when a step
 * turns over, and an answer that crossed a turnover would otherwise be
 * counted against cards this captain was never shown and settle them on a
 * paper they never chose. The client stamps every press with the step it
 * was answering (see keep in @/lib/use-path-draft), and the room's own
 * absence watch lays through this same door naming the step it is laying
 * for (see fireDraftWatch), so there is no pick anywhere without its step.
 */
export function takeDraftPick(
  io: Server,
  roomId: string,
  userId: string,
  pick: unknown,
  step: unknown,
): string | null {
  const draft = drafts.get(roomId);
  if (!draft) return "The draft is not running.";
  const seat = draft.seats.findIndex((held) => held.userId === userId);
  if (seat < 0) return "You are not in this draft.";
  if (step !== draft.step) {
    return "The table has moved past that step.";
  }
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
  // A step closes when the last captain has answered, and that is the only
  // thing that closes one: there is no clock to stand down. A watch armed
  // for a gone seat is left to fire against the step it was armed for if
  // the step is somehow answered before it does, which is harmless on
  // purpose: the fire looks the seats up fresh and lays nothing for a
  // table with no card left in front of anybody (see fireDraftWatch).
  if (draft.picks.every((held) => held !== null)) {
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
  // The new step's cards are in front of every seat, and a seat that was
  // already gone when the step turned over never dropped a socket inside
  // it, so nothing would otherwise arm its watch: the deal below is why
  // the arm is asked here as well. A table that is entirely present arms
  // nothing, which is the ordinary case and the whole of why this line
  // costs the room no timer at all.
  armDraftWatch(io, draft.roomId);
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
  // [F6: charters at leg four] The settled paths move into the room's own
  // book as they are written onto the seats, because this is the last
  // moment the seats holding them exist (see pathsByRoom). The book is
  // opened before the walk and stored after it, so a seat with nothing to
  // settle simply contributes no entry.
  const paths = pathsByRoom.get(draft.roomId) ?? new Map<string, PathId>();
  for (let seat = 0; seat < draft.seats.length; seat += 1) {
    const held = draft.seats[seat];
    const path = finals[seat] ?? held.kept[0];
    if (!path) continue;
    held.path = path;
    paths.set(held.userId, path);
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
  pathsByRoom.set(draft.roomId, paths);
  disarmDraftWatch(draft.roomId);
  drafts.delete(draft.roomId);
  // [W2: the path draft] And with every seat settled, the room is told to
  // leave the seat. The announcement comes after the settled views and the
  // two records above rather than before them, because it is the frame
  // that lets every client run its departure, and a client that ran the
  // departure before reading its own settled view would step off the seat
  // holding no path. Socket order carries that promise on one connection,
  // and the announcement is awaited by nothing: it lives in the checkpoint
  // module because the moving of a room is that module's business (see
  // announceDraftComplete).
  void announceDraftComplete(io, draft.roomId);
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
  // [F6: charters at leg four] The paths book moves with the switch, so a
  // charter take read later in the voyage attributes the papers the
  // captain is sailing on as they stand then rather than as they were
  // dealt. It is written here rather than beside the frame below because
  // the book is the room's record of the change and the frame, the log
  // line and the measurement are publications of it.
  const paths = pathsByRoom.get(roomId) ?? new Map<string, PathId>();
  paths.set(row.userId, row.path);
  pathsByRoom.set(roomId, paths);

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

/**
 * [F6: charters at leg four] The path one captain is sailing under, as
 * the room's own book has it.
 *
 * The one reader of the paths book above, and it exists because the
 * charter take filed at leg four has to attribute a path the draft's own
 * seats no longer hold (see settleDraft). Null is three answers that are
 * one answer to its caller: no book is open for this room (a voyage
 * before its departure and after either ending), the captain is not in it
 * (a late arrival the deal skipped), or the seat settled holding nothing.
 * All three are takes the caller cannot attribute, and it drops them
 * rather than filling in a path, because a guessed field on an operator
 * measurement is worse than a missing one.
 */
export function heldPathOf(roomId: string, userId: string): PathId | null {
  return pathsByRoom.get(roomId)?.get(userId) ?? null;
}

// One captain's view of the draft they are standing in.
function draftView(draft: Draft, seat: number): DraftView {
  return {
    roomId: draft.roomId,
    step: draft.seats[seat].path !== null ? "done" : draft.step,
    hand: draft.hands[seat] ?? [],
    // The count is of the captains who still have a card in front of them,
    // which includes the reader: a captain who has answered sees the table
    // as one smaller, which is the same thing everyone else sees.
    open: draft.picks.filter((held) => held === null).length,
    // Whether this seat's own card is down, which the count above cannot
    // say and the reader's screen needs: a captain whose tab went dark
    // mid step comes back to a hand the room has already laid a card from
    // (see fireDraftWatch), and a screen that does not know that offers
    // the cards again and answers a press with "Your card is already laid
    // down." The field is the reader's own pick and never a card, so it
    // tells the table nothing its count does not already.
    picked: draft.picks[seat] !== null,
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
    disarmDraftWatch(roomId);
    drafts.delete(roomId);
    for (const seat of draft.seats) {
      emitToUser(io, seat.userId, "draft:update", null);
    }
  }
  switchesByRoom.delete(roomId);
  // [F6: charters at leg four] The paths book goes with the switches, on
  // the same reading and for the same reason: both are the room's copies
  // of papers the captain's own save still holds.
  pathsByRoom.delete(roomId);
}

// The same clear for a room that is being torn down, where there is nobody
// left in the channel to tell.
export function clearPathVoyageSilent(roomId: string): void {
  const draft = drafts.get(roomId);
  if (draft) disarmDraftWatch(roomId);
  drafts.delete(roomId);
  switchesByRoom.delete(roomId);
  pathsByRoom.delete(roomId);
}
