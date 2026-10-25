"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { GameState } from "@/lib/game/types";
import type { CardRecord } from "@/lib/game/constants/cards";
import type { LedgerLine } from "@/lib/game/ledger";

// A lighter snapshot than the full GameState, just what the detail popup
// (and the bankrupt player spectator view, which reuses the same popup)
// actually shows: cargo, workers, modules, and a short tail of the ledger.
//
// The ledger travels as material rather than as sentences, so the captain
// who opens the popup reads the other captain's ledger in their own
// language. A snapshot that carried sentences would show them in the
// language the other captain happened to be holding.
export type PlayerDetailData = {
  money: number;
  score: number;
  shipLevel: number;
  round: number;
  phase: GameState["phase"];
  inventory: GameState["inventory"];
  workers: GameState["workers"];
  equippedModules: CardRecord[];
  logs: LedgerLine[];
};

// How long a peek may wait for an answer that is not coming. The answer
// is written by another captain's client, so it can be late or simply
// never sent: the target's tab can be closed after the server took the
// question (the server answers null for a captain with no socket, but a
// socket that is up and a client that never answers is a different
// thing), the question itself expires on the server's own clock, and a
// voyage that restarts takes every open question with it. The wait is
// timed for the reason the operator console's is (see use-admin.ts): a
// latch only a response can clear is a row that spins for the rest of the
// session. Five seconds clears the slowest honest answer a live client
// gives and is short enough that the row is still in front of the captain
// when it stops spinning.
const PEEK_TIMEOUT_MS = 5_000;

/**
 * One captain's peek, as a single row.
 *
 * The row holds the snapshot and the wait together, so the two cannot
 * come apart: a row is either waiting for an answer or it is holding one.
 */
type Peek = {
  detail: PlayerDetailData | null;
  loading: boolean;
};

/**
 * Fetches another captain's cargo/workers/log on demand instead of
 * broadcasting it to the whole harbor constantly. Most of a harbor never
 * opens a given player's detail popup, so this only asks (and answers)
 * when someone actually does. Handles both directions: requesting
 * someone else's detail, and answering when someone asks for "my own."
 */
export function usePlayerDetail(
  socket: Socket | null,
  roomId: string,
  myDetail?: () => PlayerDetailData,
) {
  // One row per captain being looked at, holding both things the row is
  // in: the snapshot that came back, and whether a request is still in
  // the air. They were two parallel maps kept in step by hand, and a map
  // kept in step by hand is a map that stops being in step the first time
  // one path forgets the other. A captain whose request timed out could be
  // left with a "loading" row and no snapshot, or a snapshot with the row
  // still spinning, and neither is a fact the hook should be able to hold.
  const [peeks, setPeeks] = useState<Record<string, Peek>>({});
  const myDetailRef = useRef(myDetail);

  // The one write a row gets. A patch rather than a whole row, because
  // the two events that touch a row touch different halves of it: a
  // request opens the wait and leaves any snapshot already in hand
  // alone, and an answer closes the wait and replaces the snapshot.
  const setPeek = useCallback((targetUserId: string, patch: Partial<Peek>) => {
    setPeeks((prev) => ({
      ...prev,
      [targetUserId]: {
        detail: prev[targetUserId]?.detail ?? null,
        loading: false,
        ...patch,
      },
    }));
  }, []);
  useEffect(() => {
    myDetailRef.current = myDetail;
  }, [myDetail]);

  // One timer per captain being asked about, so a second press resets the
  // wait rather than stacking a second clock on the same row.
  const peekTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const stopWaiting = useCallback((targetUserId: string) => {
    const timer = peekTimers.current.get(targetUserId);
    if (timer) clearTimeout(timer);
    peekTimers.current.delete(targetUserId);
  }, []);

  // A timer that outlives the popup has nothing to clear.
  useEffect(
    () => () => {
      for (const timer of peekTimers.current.values()) clearTimeout(timer);
      peekTimers.current.clear();
    },
    [],
  );

  // Whether this instance answers requests at all. A boolean rather than
  // the callback itself, so the effect below is not torn down and rebuilt
  // every time the snapshot function changes identity.
  const answers = myDetail !== undefined;

  useEffect(() => {
    if (!socket) return;

    // The server only relays this to the sockets it's actually about, so
    // receiving it at all means someone is asking for our own snapshot.
    const onRequest = (data: {
      roomId: string;
      targetUserId: string;
      requesterId: string;
    }) => {
      if (data.roomId !== roomId) return;
      const snapshot = myDetailRef.current;
      if (!snapshot) return;
      socket.emit("player:detail:response", {
        roomId,
        targetUserId: data.targetUserId,
        requesterId: data.requesterId,
        data: snapshot(),
      });
    };
    const onResponse = (data: {
      roomId: string;
      targetUserId: string;
      data: PlayerDetailData | null;
    }) => {
      if (data.roomId !== roomId) return;
      stopWaiting(data.targetUserId);
      setPeek(data.targetUserId, { detail: data.data, loading: false });
    };

    // Only one mounted component may answer, and this is what makes that
    // true. Every panel that shows other captains also asks for their
    // detail, and the asker's side of this hook is mounted in both the
    // harbor and the roster panel. When both of them answered, the server
    // relayed two replies for one question: the real snapshot from the
    // harbor, and the placeholder the asking only instance carries. Which
    // one the asker kept came down to listener order, so a captain could
    // open somebody's hold and be shown a hold full of zeros.
    if (!answers) {
      socket.on("player:detail:response", onResponse);
      return () => {
        socket.off("player:detail:response", onResponse);
      };
    }

    socket.on("player:detail:request", onRequest);
    socket.on("player:detail:response", onResponse);
    return () => {
      socket.off("player:detail:request", onRequest);
      socket.off("player:detail:response", onResponse);
    };
  }, [socket, roomId, answers, stopWaiting, setPeek]);

  const requestDetail = useCallback(
    (targetUserId: string) => {
      if (!socket) return;
      setPeek(targetUserId, { loading: true });
      // The give up. A target whose client never answers still needs the
      // row to stop waiting, or the eye spins for the rest of the
      // session.
      stopWaiting(targetUserId);
      peekTimers.current.set(
        targetUserId,
        setTimeout(() => {
          peekTimers.current.delete(targetUserId);
          setPeek(targetUserId, { loading: false });
        }, PEEK_TIMEOUT_MS),
      );
      socket.emit("player:detail:request", { roomId, targetUserId });
    },
    [socket, roomId, stopWaiting, setPeek],
  );

  // The two views the caller reads, split out of the one row map so the
  // shape on the other side of this hook is the one the screens already
  // know. A captain who was never asked about is absent from both, the
  // same as before, so nothing downstream has to learn a new way of
  // saying "no row here".
  const detail = useMemo(() => {
    const out: Record<string, PlayerDetailData | null> = {};
    for (const [id, peek] of Object.entries(peeks)) out[id] = peek.detail;
    return out;
  }, [peeks]);

  const loading = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const [id, peek] of Object.entries(peeks)) out[id] = peek.loading;
    return out;
  }, [peeks]);

  // Memoized so the hook's answer holds one identity until something in
  // it changes: callers keep it in dependency lists (GameRoom's
  // handleSelectPlayer above every other), and a fresh literal every
  // render rebuilt their callbacks every render.
  return useMemo(
    () => ({ detail, loading, requestDetail }),
    [detail, loading, requestDetail],
  );
}
