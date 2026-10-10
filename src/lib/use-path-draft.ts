"use client";

// =====================================================================
// The path draft, and switching, client side.
//
// [D7: the draft, and switching] The room's two path frames, as one captain
// meets them, and the difference between them is the feature rather than
// the plumbing.
//
// The draft is private in its whole shape: the server deals the deck and
// this captain is sent their own hand and nobody else's (see the note on
// DraftView in @/types/realtime). So the view is held here rather than in a
// room wide state, and nothing about it is derived from anything else on
// the screen.
//
// The switch is the opposite and that is its price: "the price of changing
// your identity is that everyone knows." This hook listens for the whole
// room's frame and acts on the one that names this captain, which is what
// makes the room's answer the authority on a change to the captain's own
// books: a switch the server refused is a switch that cost nobody anything,
// because the fee is only paid when the frame comes back (see
// applyPathSwitch).
//
// Neither frame is trusted as it arrives. The view is read field by field
// through readDraftView below, and the switched frame's path is read
// through normalizePath, which is the same reader every other untrusted
// path in this build goes through.
// =====================================================================

import {
  DRAFT_STEPS,
  type DraftStep,
  type DraftView,
} from "@/types/realtime/draft";
import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { applyDraftPath, applyPathSwitch } from "@/lib/game/engine";
import { normalizePath, type PathId } from "@/lib/game/paths";
import type { GameState } from "@/lib/game/types";
import { refusedForRoom } from "@/lib/refusals";

// The events this feature speaks on, named in one place for the reason the
// bazaar's and the two consent boards' own channels are.
const CHANNEL = {
  update: "draft:update",
  error: "draft:error",
  stateRequest: "draft:state:request",
  keep: "draft:keep",
  switched: "path:switched",
  switchRequest: "path:switch",
  switchError: "path:error",
} as const;

// One draft view off the wire, or null where the frame is not one.
//
// This is the strictest reader in the tree and the reason is the hand: a
// card is kept by its index, so a frame carrying anything that is not a
// card would leave this captain choosing by one numbering and the server
// counting by another, and the card they thought they kept would not be the
// card they sail on. A frame with a card this build does not have is
// therefore dropped whole rather than repaired by dropping the one card,
// which is the safe direction: nothing is drawn, and the state request that
// follows a reconnect asks again.
//
// The rest of the fields are read for the same reason every wire reader in
// this build reads rather than asserts: the step is one of four, the open
// count is a finite number, the reader's own answer is a boolean, and the
// path is a path this build has or nothing.
function readDraftView(data: unknown, roomId: string): DraftView | null {
  if (!data || typeof data !== "object") return null;
  const frame = data as Record<string, unknown>;
  if (frame.roomId !== roomId) return null;
  if (
    typeof frame.step !== "string" ||
    !(DRAFT_STEPS as readonly string[]).includes(frame.step)
  ) {
    return null;
  }
  if (
    typeof frame.open !== "number" ||
    !Number.isFinite(frame.open) ||
    frame.open < 0
  ) {
    return null;
  }
  if (typeof frame.picked !== "boolean") return null;
  if (!Array.isArray(frame.hand) || frame.hand.length === 0) return null;
  const hand: PathId[] = [];
  for (const card of frame.hand) {
    const path = normalizePath(card);
    if (path === null) return null;
    hand.push(path);
  }
  const path = frame.path === null ? null : normalizePath(frame.path);
  if (frame.path !== null && path === null) return null;
  return {
    roomId,
    // Cast from the string the list was just asked about, the way
    // normalizeVoyageLogEntry casts the kind it checked the same way.
    step: frame.step as DraftStep,
    hand,
    open: Math.floor(frame.open),
    picked: frame.picked,
    path,
  };
}

/**
 * The draft this captain is standing in, and the one switch a voyage allows
 * them.
 *
 * The apply functions are the caller's, the same shape useMaroon takes: a
 * frame about this captain's own papers is a write to this captain's own
 * save and nothing else in the room may make it, so the hook reads the wire
 * and hands the write out rather than holding a copy of the books.
 */
export function usePathDraft(
  socket: Socket | null,
  roomId: string | null,
  myUserId: string,
  act: (fn: (g: GameState, logs: string[]) => void) => void,
) {
  const [view, setView] = useState<DraftView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !roomId) return;

    const onView = (data: unknown): void => {
      // A null is the close signal, and it is one frame for two endings:
      // the draft settled, or the voyage it belonged to was wiped (see
      // DraftView). Either way there is nothing to draw.
      if (data === null) {
        setView(null);
        return;
      }
      const next = readDraftView(data, roomId);
      if (!next) return;
      setView(next);
      // The settled view is the whole of the result, so the path this
      // captain sails on is applied off it rather than off the pick that
      // led there: the server's settled hand is what the fleet was told,
      // and a client that applied its own pick could disagree with it. The
      // engine refuses a save that already holds a path, which is what
      // makes a repeated view a frame to drop rather than an identity to
      // overwrite (see applyDraftPath), and what carries a captain who
      // reloaded between the last pick and the settle.
      if (next.step === "done" && next.path !== null) {
        const path = next.path;
        act((g, l) => applyDraftPath(g, path, l));
      }
    };
    const onDraftError = (data: { roomId?: string; error?: string }) => {
      const err = refusedForRoom(data, roomId);
      if (err === null) return;
      setError(err);
    };
    // The room's one publication, read for the one name that is this
    // captain's. The path is read through normalizePath rather than asserted
    // because it came off the wire, and a frame that is not a path is a
    // frame to drop: the engine would refuse it anyway, but a refusal writes
    // a line into this captain's ledger and a broken frame has nothing to
    // say.
    const onSwitched = (data: unknown): void => {
      if (!data || typeof data !== "object") return;
      const frame = data as Record<string, unknown>;
      if (frame.roomId !== roomId) return;
      if (frame.userId !== myUserId) return;
      const path = normalizePath(frame.path);
      if (path === null) return;
      act((g, l) => applyPathSwitch(g, path, l));
    };
    const onSwitchError = (data: { roomId?: string; error?: string }) => {
      const err = refusedForRoom(data, roomId);
      if (err === null) return;
      setError(err);
    };
    // The hand lives in the server's process and nowhere else, so a socket
    // that drops mid draft and comes back has to ask again: the reconnect is
    // a new connection that was never sent a view, and a captain left
    // holding a stale hand would be reading cards the table has already
    // passed. The room held the seat for them while they were gone (see
    // noteDraftAway on the server), so the view that comes back is the
    // step the table is actually standing at.
    const request = (): void => {
      socket.emit(CHANNEL.stateRequest, { roomId });
    };

    socket.on(CHANNEL.update, onView);
    socket.on(CHANNEL.error, onDraftError);
    socket.on(CHANNEL.switched, onSwitched);
    socket.on(CHANNEL.switchError, onSwitchError);
    socket.on("connect", request);
    request();

    return () => {
      socket.off(CHANNEL.update, onView);
      socket.off(CHANNEL.error, onDraftError);
      socket.off(CHANNEL.switched, onSwitched);
      socket.off(CHANNEL.switchError, onSwitchError);
      socket.off("connect", request);
    };
  }, [socket, roomId, myUserId, act]);

  // A card laid down. The index is into the hand the server dealt this
  // captain, which is the hand the view above is holding, and the server
  // refuses anything that is not in it.
  //
  // The press carries the step the hand was read off beside the index,
  // because the index alone means nothing without it: the hands change
  // when a step turns over, and a press that crossed a close would be
  // read against cards this captain never saw (see takeDraftPick on the
  // server, which refuses the stale answer rather than guessing). The
  // view is where the step comes from, the same frame the cards came
  // from, so a press is stamped with exactly what the captain was
  // looking at; a press with no view to stamp is a press with no cards
  // in front of it and is dropped here rather than sent to be refused.
  const keep = useCallback(
    (pick: number) => {
      const answering = view?.roomId === roomId ? view : null;
      if (!socket || !roomId || !answering || answering.step === "done") {
        return;
      }
      setError(null);
      socket.emit(CHANNEL.keep, {
        roomId,
        pick,
        step: answering.step,
      });
    },
    [socket, roomId, view],
  );

  // The press. It carries the path this captain means to sail on and asks
  // the room to publish it; nothing is charged here, and the fee, the
  // forfeiture and the stamp are applied when the room's frame comes back
  // (see onSwitched above). The panel draws the same guard before the press
  // (see pathSwitchBlocked), so a refusal at this end is the fleet being out
  // of step rather than a captain being surprised.
  const switchPath = useCallback(
    (path: PathId) => {
      if (!socket || !roomId) return;
      setError(null);
      socket.emit(CHANNEL.switchRequest, { roomId, path });
    },
    [socket, roomId],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    view: view?.roomId === roomId ? view : null,
    error,
    clearError,
    keep,
    switchPath,
  };
}
