// Realtime layer: the path draft and the harbor's per-voyage path books.
//
// Cards are private, so the deck is built, shuffled and dealt in this
// process. A captain receives only their own hand, and no frame carries a
// card nobody has played. The draft is a seat of its own before Dawn: the
// departure deals and pins the harbor there, and the settle is this
// module's own announcement rather than a ready vote. There is no timer on
// the draft; steps close when every seat answers. DRAFT_WATCH_MS exists
// only for a seat whose last socket dropped, and its fire lays that
// captain's first card so a vanished captain cannot hold the table forever.
//
// Two books outlive the draft seats: switch allowances (the server's half
// of once per voyage) and settled paths (needed by the round four charter
// take). Both last one voyage and are dropped at either ending.
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
import { DEFAULT_LOCALE, tFor, type Locale } from "@/lib/game/i18n";
import type { PathId } from "@/lib/game/paths";
import { roomChannel } from "./channel";
import { announceDraftComplete, disarmTimer } from "./checkpoint";
import { emitToUser, userSockets } from "./presence";
import { noteTelemetry } from "./telemetry";
import { noteVoyageLog } from "./voyage-log";

// The one refusal sentence for a pick that names no card in hand; the guard
// answers it from two checks and the captain sees whichever fired first.
const PICK_OFF_BOARD = "That is not one of the cards in front of you.";

// One captain's seat in a live draft. kept holds the cards taken from steps
// already behind them, in order; path is set at settlement.
interface DraftSeat {
  userId: string;
  name: string;
  kept: PathId[];
  path: PathId | null;
}

// A harbor's draft. hands and picks are indexed by seat and always match
// seats.length; a step resolves by walking that index. openedAt is the deal
// time, since draft duration is measured to completion, not per card.
interface Draft {
  roomId: string;
  seats: DraftSeat[];
  // Roster order, and the order the pass follows: the next seat left,
  // wrapping, so every captain agrees which way cards travelled.
  hands: PathId[][];
  picks: (number | null)[];
  step: Exclude<DraftStep, "done">;
  openedAt: number;
}

const drafts = new Map<string, Draft>();

// Absence watches, at most one per harbor. Armed when a draft seat's last
// socket drops (or a deal seats a captain with no socket), it waits
// DRAFT_WATCH_MS and then lays the first card of that captain's hand for
// every seat still gone. A captain who reconnects inside the window changes
// nothing because the fire rechecks presence. One watch per harbor because a
// step resolves for the whole table at once.
const draftWatches = new Map<string, NodeJS.Timeout>();

function disarmDraftWatch(roomId: string): void {
  disarmTimer(draftWatches, roomId);
}

// Whether a seat has no live socket. Kept as a single test so a future
// presence rule is a compile error here, not a silent bug.
function seatAway(userId: string): boolean {
  return (userSockets.get(userId)?.size ?? 0) === 0;
}

// Arms the absence watch unless one is running or no seat with a card in
// front of it is away. Called at the deal, on a last socket drop, and when a
// step turns over (its new cards may already face absent seats).
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

// Every still-absent seat has its first card laid. Lays through
// takeDraftPick, the same door a captain's press uses, so closing a step,
// turning it over and settling follow the normal path. The loop re-reads
// state after each card because one fire can carry a table through all three
// steps; its bound is one card per seat per step, written explicitly so a
// rule change stops the fire instead of spinning it.
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
      // This seat has no socket, so no refusal has a reader; the default
      // locale stands in.
      DEFAULT_LOCALE,
    );
    if (!drafts.has(roomId)) return;
  }
  // Should not happen with three one-card steps; if it does, give the
  // remaining absent seats another window rather than dropping them.
  armDraftWatch(io, roomId);
}

// A draft seat's last socket dropped. Most disconnects have nothing to do
// with a draft, so a captain not in one, already answered, or in a settled
// draft arms nothing. The watch rechecks presence, so reconnecting inside
// the window needs no cancellation.
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

// The harbor's book of switch allowances: who has switched this voyage.
// Only the allowance is kept; the path rides the caller's frame and log
// line. Dropped with the voyage. The durable half of once per voyage is the
// stamp in the captain's save.
const switchesByRoom = new Map<string, Set<string>>();

// The harbor's book of settled paths, kept after draft seats are deleted
// because the round four charter take still needs them. Written at the settle,
// moved by a switch, dropped at either ending. A late arrival reads null,
// which the take treats as unattributable rather than guessing.
const pathsByRoom = new Map<string, Map<string, PathId>>();

// Deals paths when a voyage sets sail, against the departure roster and
// nothing else: membership can change mid voyage, a deck cannot. A late
// joiner sails pathless. Idempotent, so a double start cannot deal a second
// hand. The deck is one draw from a seed that is discarded; a client that
// knew the seed could read the hands. Returns whether a draft stands,
// because the caller pins the harbor to the draft seat and a deal that
// seated nobody would strand the table there.
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
  // Seated in roster order. A member the user table cannot name is left
  // out; a placeholder seat would receive cards the table never hears from.
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
  // Re-read with nothing awaited since the first check. The names lookup
  // awaits, so two departures can race here; the loser's deck is discarded
  // and the draft already known to the settle and the watch stands.
  if (drafts.has(roomId)) return true;
  drafts.set(roomId, draft);
  // A roster member whose tab closed before departure holds no socket, so
  // no disconnect will arm the watch for them.
  armDraftWatch(io, roomId);
  sendDraftViews(io, draft);
  return true;
}

// The draft as one captain sees it, or null when no draft is running, they
// are not in it, or it is over. The client draws nothing for all three.
export function draftViewFor(roomId: string, userId: string): DraftView | null {
  const draft = drafts.get(roomId);
  if (draft) {
    const seat = draft.seats.findIndex((held) => held.userId === userId);
    if (seat >= 0) return draftView(draft, seat);
  }
  // The draft is gone; the paths book is the only copy of what this captain
  // took. A captain whose socket was dark through the settle never received
  // the settled view, so answer with one built from the book. The client
  // applies the path and drops a repeat; the engine refuses a save that
  // already holds one.
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

// One card laid. Returns null on success, a sentence on refusal: no draft,
// no seat, a stale step, a card not in hand, or a second pick. The pick is
// an index because two cards can name the same path, and the step is checked
// because hands change on turnover; an answer from before a turnover must
// not settle a card the captain never saw. Refusals use the caller's locale.
export function takeDraftPick(
  io: Server,
  roomId: string,
  userId: string,
  pick: unknown,
  step: unknown,
  locale: Locale,
): string | null {
  const draft = drafts.get(roomId);
  if (!draft) return tFor(locale, "The draft is not running.");
  const seat = draft.seats.findIndex((held) => held.userId === userId);
  if (seat < 0) return tFor(locale, "You are not in this draft.");
  if (step !== draft.step) {
    return tFor(locale, "The table has moved past that step.");
  }
  if (draft.picks[seat] !== null) {
    return tFor(locale, "Your card is already laid down.");
  }
  // Checked here so the index can be stored as a number; keepFrom repeats
  // the check so the rule stays total.
  if (typeof pick !== "number" || !Number.isInteger(pick)) {
    return tFor(locale, PICK_OFF_BOARD);
  }
  if (keepFrom(draft.hands[seat], pick) === null) {
    return tFor(locale, PICK_OFF_BOARD);
  }
  draft.picks[seat] = pick;
  // A step closes when the last pick lands; there is no clock. A watch armed
  // before this is harmless: it rechecks seats and lays nothing.
  if (draft.picks.every((held) => held !== null)) {
    advanceDraft(io, draft);
    return null;
  }
  // Tell the table how many captains are still choosing. Only a count, never
  // a card.
  sendDraftViews(io, draft);
  return null;
}

// Resolves one step into the next: picks become keeps, unkept cards pass
// left or are discarded per step, and every client receives the new view.
// The last step settles the path.
function advanceDraft(io: Server, draft: Draft): void {
  const rests: PathId[][] = [];
  const finals: (PathId | undefined)[] = [];
  for (let seat = 0; seat < draft.seats.length; seat += 1) {
    const chosen = keepFrom(
      draft.hands[seat],
      draft.picks[seat] ?? DRAFT_AUTO_PICK,
    );
    // A hand is never empty and picks are validated, so this is unreachable
    // in practice; keep the seat's existing path rather than crash a voyage.
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
      : // Last step: choose between the two cards this captain kept.
        draft.seats.map((seat) => [...seat.kept]);
  draft.picks = draft.seats.map(() => null);
  // The new step's cards are in front of every seat, and a seat that was
  // The new step may already face absent seats, so ask for the watch again.
  // A fully present table arms nothing.
  armDraftWatch(io, draft.roomId);
  sendDraftViews(io, draft);
}

// Ends the draft: every seat with a path is stored, the fleet is told, and
// the draft state is dropped. The log line and the frame carry only the
// captain's name and path; the cards behind the choice are never published.
// The save is applied later by each client from the settled view, so the
// server never writes a save.
function settleDraft(
  io: Server,
  draft: Draft,
  finals: readonly (PathId | undefined)[],
): void {
  const seconds = Math.max(0, Math.round((Date.now() - draft.openedAt) / 1000));
  // The seats holding paths are about to disappear; capture them in the
  // harbor's book first. A seat with no path contributes nothing.
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
    // Filed per captain; seconds is the table's draft duration, the same on
    // every seat, so a reader takes one rather than summing.
    noteTelemetry(draft.roomId, "path_taken", {
      actor: held.userId,
      path,
      seconds,
    });
  }
  pathsByRoom.set(draft.roomId, paths);
  disarmDraftWatch(draft.roomId);
  drafts.delete(draft.roomId);
  // Announce after the settled views: the announcement triggers departures,
  // and a client that left before reading its settled view would step off
  // with no path. Not awaited; moving a harbor is the checkpoint's business.
  void announceDraftComplete(io, draft.roomId);
}

// Records a change of papers and publishes it. False when this captain
// already switched this voyage; the caller turns that into a refusal. The
// server enforces only the once-per-voyage half; the fee, forfeiture and
// window live in the captain's save. Frame, log line and measurement are
// written together from the validated row.
export function recordPathSwitch(
  io: Server,
  roomId: string,
  row: { userId: string; name: string; path: PathId },
): boolean {
  const book = switchesByRoom.get(roomId) ?? new Set<string>();
  if (book.has(row.userId)) return false;
  book.add(row.userId);
  switchesByRoom.set(roomId, book);
  // The paths book follows the switch so a later charter take attributes the
  // papers being sailed now rather than the ones dealt.
  const paths = pathsByRoom.get(roomId) ?? new Map<string, PathId>();
  paths.set(row.userId, row.path);
  pathsByRoom.set(roomId, paths);

  const published: PathSwitched = {
    roomId,
    userId: row.userId,
    name: row.name,
    path: row.path,
  };
  io.to(roomChannel(roomId)).emit("path:switched", published);
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

// The path this captain is sailing under, from the harbor's book. Null means
// no book, no entry (a late arrival), or nothing settled; callers drop an
// unattributable take rather than guessing.
export function heldPathOf(roomId: string, userId: string): PathId | null {
  return pathsByRoom.get(roomId)?.get(userId) ?? null;
}

// One captain's view of the draft they are standing in.
function draftView(draft: Draft, seat: number): DraftView {
  return {
    roomId: draft.roomId,
    step: draft.seats[seat].path !== null ? "done" : draft.step,
    hand: draft.hands[seat] ?? [],
    // Counts captains with a card still in front of them, including the
    // reader.
    open: draft.picks.filter((held) => held === null).length,
    // The reader's own pick, so a captain whose card was auto-laid while
    // away is not offered the cards again.
    picked: draft.picks[seat] !== null,
    path: draft.seats[seat].path,
  };
}

// Sends each seat its own hand, iterating seats rather than presence, so
// spectators and late joiners receive nothing.
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

// Drops everything this module holds for a voyage. Live draft seats get a
// null view as the close signal; a settled draft already sent its paths and
// a wiped one sends nothing.
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
  // The paths book goes with the switches; both are harbor copies.
  pathsByRoom.delete(roomId);
}

// The same clear for a harbor that is being torn down, where there is nobody
// left in the channel to tell.
export function clearPathVoyageSilent(roomId: string): void {
  const draft = drafts.get(roomId);
  if (draft) disarmDraftWatch(roomId);
  drafts.delete(roomId);
  switchesByRoom.delete(roomId);
  pathsByRoom.delete(roomId);
}
