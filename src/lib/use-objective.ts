"use client";

// =====================================================================
// The fleet commission, client side.
//
// Three separate facts live in this hook and it is worth keeping them
// apart, because two of them are numbers and the screen shows one.
//
//   The objective is drawn locally, from the harbor id and the voyage
//   epoch, which is the whole trick: the server never has to tell anyone
//   what the commission is, because every captain can work it out from
//   values they already hold and they all get the same answer. It is null
//   in Classic, and every other part of this hook is inert there.
//
//   What this captain has handed over is their own, lives in the voyage
//   state, is persisted with it, and is what a reload or a server restart
//   re-reports from.
//
//   The harbor's total arrives on the broadcast. It is the only one of the
//   three that can be stale, so nothing is ever *shown* from it alone: the
//   screen reads the higher of the total and this captain's own record, so
//   a delivery is visible the instant it happens and an in-flight
//   broadcast can never take one away.
//
// The report is cumulative and the server merges by max, which is what
// makes all of this idempotent: reporting twice changes nothing, reporting
// late changes nothing, and a reconnect that re-reports everything is the
// repair path rather than a hazard.
// =====================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  clampObjectiveTally,
  drawObjective,
  objectiveProgress,
  objectiveSeed,
  objectiveTaking,
  type Objective,
  type ObjectiveProgress,
} from "@/lib/game/objectives";
import {
  deliverToObjective,
  OBJECTIVE_DELIVERY_PHASE,
} from "@/lib/game/engine";
import { normalizeMode } from "@/lib/game/mode";
import type { GameContext, GameState } from "@/lib/game/types";
import type {
  ObjectiveProgress as ObjectiveProgressPayload,
  ObjectiveReport as ObjectiveReportPayload,
} from "@/types/realtime";

// The same cadence the captain's own status rides on (see
// use-game-session.ts): enough to feel immediate, sparse enough that a
// captain emptying a hold of six goods sends one report rather than six.
const REPORT_DEBOUNCE_MS = 120;

// How often a captain re-reports what they have handed over. This is the
// heal for a server restart: the tally is transient by design, so the
// clients are the record, and one report every few seconds costs nothing
// and rebuilds the harbor's board from nothing.
const REPORT_HEARTBEAT_MS = 8000;

// The higher of two tallies, good by good. A max rather than a sum because
// the broadcast total already contains this captain's own report: adding
// them would double count the moment a client heard itself.
function higherOf(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const merged: Record<string, number> = { ...a };
  for (const [good, count] of Object.entries(b)) {
    merged[good] = Math.max(merged[good] ?? 0, count);
  }
  return merged;
}

export function useObjective(
  socket: Socket | null,
  roomId: string | null,
  game: GameState,
  ctx: GameContext,
  act: (fn: (g: GameState, logs: string[]) => void) => void,
): {
  objective: Objective | null;
  progress: ObjectiveProgress | null;
  deliverable: number;
  deliver: () => void;
} {
  const mode = normalizeMode(game.mode);
  const objective = useMemo(
    () =>
      mode === "ocean_gambit"
        ? drawObjective(objectiveSeed(ctx.harborId, game.voyageEpoch))
        : null,
    [mode, ctx.harborId, game.voyageEpoch],
  );

  // Stamped with its room, exactly as the private log is, so a captain who
  // sails straight from one harbor into another is never shown the
  // previous harbor's board.
  const [held, setHeld] = useState<{
    roomId: string;
    total: Record<string, number>;
  } | null>(null);
  const total = held?.roomId === roomId ? held.total : {};

  useEffect(() => {
    if (!socket || !roomId || !objective) return;

    const onProgress = (data: ObjectiveProgressPayload) => {
      if (data?.roomId !== roomId) return;
      setHeld({ roomId, total: clampObjectiveTally(objective, data.total) });
    };
    const onRestarted = (data: { roomId?: string }) => {
      if (data?.roomId !== roomId) return;
      setHeld(null);
    };

    socket.on("objective:progress", onProgress);
    socket.on("room:restarted", onRestarted);
    return () => {
      socket.off("objective:progress", onProgress);
      socket.off("room:restarted", onRestarted);
    };
  }, [socket, roomId, objective]);

  // This captain's own contribution, as the report carries it. Held in a
  // ref as well because both things that report it outlive the render they
  // were installed on, and a heartbeat that read a value captured when it
  // started would go on reporting the hold as it stood minutes ago.
  const delivered = game.objectiveDelivered;
  const deliveredRef = useRef(delivered);
  useEffect(() => {
    deliveredRef.current = delivered;
  }, [delivered]);

  const report = useCallback(() => {
    if (!socket || !roomId || !objective) return;
    const payload: ObjectiveReportPayload = {
      roomId,
      delivered: deliveredRef.current,
    };
    socket.emit("objective:report", payload);
  }, [socket, roomId, objective]);

  // Every change to the hold's contribution goes out, debounced, so a
  // delivery and the goods it took travel in one frame.
  const contribution = JSON.stringify(delivered);
  useEffect(() => {
    if (!socket || !roomId || !objective) return;
    const timer = setTimeout(report, REPORT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [socket, roomId, objective, contribution, report]);

  // The heal. Also re reports on a new connection, which is the same
  // repair for a socket that dropped rather than a server that restarted.
  useEffect(() => {
    if (!socket || !roomId || !objective) return;
    const beat = setInterval(report, REPORT_HEARTBEAT_MS);
    socket.on("connect", report);
    return () => {
      clearInterval(beat);
      socket.off("connect", report);
    };
  }, [socket, roomId, objective, report]);

  // The trace the evaluation reads, written once per round rather than on
  // every move: what matters months later is how close the fleet stood in
  // each leg, so the last value a round reached is the value worth keeping.
  const totalJson = JSON.stringify(total);
  useEffect(() => {
    if (!objective || Object.keys(total).length === 0) return;
    const snapshot = JSON.parse(totalJson) as Record<string, number>;
    act((g) => {
      const last = g.objectiveTrace[g.objectiveTrace.length - 1];
      if (last?.round === g.currentRound) {
        last.at = Date.now();
        last.delivered = snapshot;
        return;
      }
      g.objectiveTrace.push({
        round: g.currentRound,
        at: Date.now(),
        delivered: snapshot,
      });
    });
  }, [objective, totalJson, act]);

  // What the screen shows, and what the button would move right now.
  const progress = objective
    ? objectiveProgress(objective, higherOf(total, delivered))
    : null;
  const deliverable =
    objective && game.phase === OBJECTIVE_DELIVERY_PHASE
      ? objectiveTaking(objective, game.inventory, delivered).reduce(
          (sum, row) => sum + row.take,
          0,
        )
      : 0;

  const deliver = useCallback(() => {
    if (!objective) return;
    act((g, logs) => deliverToObjective(g, objective, logs));
  }, [act, objective]);

  return { objective, progress, deliverable, deliver };
}
