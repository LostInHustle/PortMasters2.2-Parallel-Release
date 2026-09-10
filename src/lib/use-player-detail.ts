"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { GameState } from "@/lib/game/types";
import type { Module } from "@/lib/game/constants";

// A lighter snapshot than the full GameState, just what the detail popup
// (and the bankrupt player spectator view, which reuses the same popup)
// actually shows: cargo, workers, modules, and a short tail of the ledger.
export type PlayerDetailData = {
  money: number;
  score: number;
  shipLevel: number;
  round: number;
  phase: GameState["phase"];
  gameOver: boolean;
  inventory: GameState["inventory"];
  workers: GameState["workers"];
  equippedModules: Module[];
  logs: string[];
};

/**
 * Fetches another captain's cargo/workers/log on demand instead of
 * broadcasting it to the whole room constantly. Most of a room never
 * opens a given player's detail popup, so this only asks (and answers)
 * when someone actually does. Handles both directions: requesting
 * someone else's detail, and answering when someone asks for "my own."
 */
export function usePlayerDetail(
  socket: Socket | null,
  roomId: string,
  myDetail?: () => PlayerDetailData,
) {
  const [detail, setDetail] = useState<Record<string, PlayerDetailData | null>>(
    {},
  );
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const myDetailRef = useRef(myDetail);
  useEffect(() => {
    myDetailRef.current = myDetail;
  }, [myDetail]);

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
      setDetail((prev) => ({ ...prev, [data.targetUserId]: data.data }));
      setLoading((prev) => ({ ...prev, [data.targetUserId]: false }));
    };

    // Only one mounted component may answer, and this is what makes that
    // true. Every panel that shows other captains also asks for their
    // detail, and the asker's side of this hook is mounted in both the
    // room and the roster panel. When both of them answered, the server
    // relayed two replies for one question: the real snapshot from the
    // room, and the placeholder the asking only instance carries. Which
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
  }, [socket, roomId, answers]);

  const requestDetail = useCallback(
    (targetUserId: string) => {
      if (!socket) return;
      setLoading((prev) => ({ ...prev, [targetUserId]: true }));
      socket.emit("player:detail:request", { roomId, targetUserId });
    },
    [socket, roomId],
  );

  return { detail, loading, requestDetail };
}
