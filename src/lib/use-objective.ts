"use client";

// =====================================================================
// The fleet commission, client side.
//
// Three separate facts live in this hook and it is worth keeping them
// apart, because two of them are numbers and the screen shows one.
//
//   The objective is drawn locally, from the harbor id, the voyage epoch
//   and the size of the fleet the voyage was dealt to, which is the whole
//   trick: the server never has to tell anyone what the commission is,
//   because every captain can work it out from values they already hold
//   and they all get the same answer. It is null in Classic, and every
//   other part of this hook is inert there.
//
//   What this captain has handed over is their own, lives in the voyage
//   state, is persisted with it, and is what a reload or a server restart
//   reports from again.
//
//   The harbor's total arrives on the broadcast. It is the only one of the
//   three that can be stale, so nothing is ever *shown* from it alone: the
//   screen reads the higher of the total and this captain's own record, so
//   a delivery is visible the instant it happens and a stale
//   broadcast can never take one away. That one read is also what a
//   handover is capped by, which is the half a full commission turns on:
//   the goods a press would take are what the commission still has room
//   for, so a fleet that has already filled it is offered no action at all
//   and a captain pressing anyway is told nothing was taken.
//
//   The press is the one thing here that is not decided on this side. The
//   goods it would move are worked out locally, against the board this
//   screen holds, and offered to the room as the standing they would leave
//   this captain on; what comes back is what the commission accepted of it,
//   and only that much leaves the hold (see deliverToObjective). Two
//   clients that read the board before either press read the same board, so
//   the room is the only thing that can say whose press was first, and
//   asking it is what stops two simultaneous handovers being paid twice.
//
// The fleet's size comes in as an argument rather than being counted here,
// and it is the one input that can be unknown for a moment (see
// use-game-session): a voyage's seats are pinned on the room at departure,
// and until the room has answered, the board on screen is the founding one
// and the button below is shut. Shut rather than absent is the point. A
// captain who hands goods over against a board the fleet is not working
// would report a delivery against a quota nobody set, and the commission
// those goods were meant for would come up short, which is a loss the
// Pirate did not have to earn.
//
// The report is cumulative and the server merges by max, which is what
// makes all of this idempotent: reporting twice changes nothing, reporting
// late changes nothing, and a reconnect that reports everything is the
// repair path rather than a hazard.
// =====================================================================

import {
  ObjectiveProgressPayload,
  ObjectiveReportPayload,
} from "@/types/realtime/objectives";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  clampObjectiveTally,
  drawObjective,
  higherObjectiveTally,
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
import { STATUS_BROADCAST_MS } from "@/lib/session/use-status-beacon";

// How often a captain sends their report again. This is the
// heal for a server restart: the tally is transient by design, so the
// clients are the record, and one report every few seconds costs nothing
// and rebuilds the harbor's board from nothing.
const REPORT_HEARTBEAT_MS = 8000;

export function useObjective(
  socket: Socket | null,
  roomId: string | null,
  game: GameState,
  ctx: GameContext,
  act: (fn: (g: GameState, logs: string[]) => void) => void,
  // The size the voyage was dealt to, or null while the room has not said.
  // Both the draw and the delivery button are gated on it, and both read it
  // from here rather than from the roster, which drifts.
  seats: number | null,
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
        ? drawObjective(
            objectiveSeed(ctx.harborId, game.voyageEpoch, seats ?? 0),
            seats ?? 0,
          )
        : null,
    [mode, ctx.harborId, game.voyageEpoch, seats],
  );

  // Stamped with its room, exactly as the private log is, so a captain who
  // sails straight from one harbor into another is never shown the
  // previous harbor's board.
  const [held, setHeld] = useState<{
    roomId: string;
    total: Record<string, number>;
  } | null>(null);
  const total = held?.roomId === roomId ? held.total : {};

  // This captain's own contribution, as the report carries it. Held in a
  // ref as well because both things that report it outlive the render they
  // were installed on, and a heartbeat that read a value captured when it
  // started would go on reporting the hold as it stood minutes ago.
  const delivered = game.objectiveDelivered;
  const deliveredRef = useRef(delivered);
  useEffect(() => {
    deliveredRef.current = delivered;
  }, [delivered]);

  // The commission as this screen knows it: the room's board and this
  // captain's own record merged good by good into the higher, which is one
  // read rather than three. The bar, the count on the button and the goods
  // the press itself would take are all measured against it, so the
  // promise the button makes and the payment behind it cannot drift apart,
  // and a press is judged against the fullest reading of the commission
  // this screen holds rather than against one captain's share of it.
  const taken = higherObjectiveTally(total, delivered);

  // The same read kept for the answer to a press, which arrives a frame or
  // two after the render the press was made in: what a press proposes is
  // read at the press, and what a refusal is told about the commission is
  // read when the room answers. A ref for the reason the hold above is one,
  // and written above the listener below rather than after it, so the
  // listener answers with the board as it stands when the answer lands.
  const takenRef = useRef(taken);
  useEffect(() => {
    takenRef.current = taken;
  }, [taken]);

  // The round this captain pressed Deliver in and has not been answered
  // about. A number rather than a boolean, the way the audit's own press
  // is: the round turning clears it, so a press whose answer never came
  // cannot wedge the button past the round it belongs to.
  const [pressed, setPressed] = useState<number | null>(null);

  useEffect(() => {
    if (!socket || !roomId || !objective) return;

    const onProgress = (data: ObjectiveProgressPayload) => {
      if (data?.roomId !== roomId) return;
      setHeld({ roomId, total: clampObjectiveTally(objective, data.total) });
    };
    // The answer to this captain's own press, and it is the only frame that
    // moves goods: what the room accepted is what leaves the hold, and a
    // grant that accepted nothing is the refusal rather than a different
    // frame (see the engine's own sentence for a take of nothing).
    const onGranted = (data: {
      roomId?: string;
      granted?: Record<string, number>;
    }) => {
      if (data?.roomId !== roomId) return;
      setPressed(null);
      if (!data.granted) return;
      act((g, logs) =>
        deliverToObjective(g, objective, logs, takenRef.current, data.granted),
      );
    };
    const onRestarted = (data: { roomId?: string }) => {
      if (data?.roomId !== roomId) return;
      setHeld(null);
      setPressed(null);
    };

    socket.on("objective:progress", onProgress);
    socket.on("objective:granted", onGranted);
    socket.on("room:restarted", onRestarted);
    return () => {
      socket.off("objective:progress", onProgress);
      socket.off("objective:granted", onGranted);
      socket.off("room:restarted", onRestarted);
    };
  }, [socket, roomId, objective, act]);

  const report = useCallback(() => {
    if (!socket || !roomId || !objective) return;
    const payload: ObjectiveReportPayload = {
      roomId,
      delivered: deliveredRef.current,
    };
    socket.emit("objective:report", payload);
  }, [socket, roomId, objective]);

  // Every change to the hold's contribution goes out, debounced on the
  // cadence every live channel rides on (see STATUS_BROADCAST_MS in
  // @/lib/session/use-status-beacon), so a delivery and the goods it took
  // travel in one frame and a captain emptying a hold of six goods sends
  // one report rather than six.
  const contribution = JSON.stringify(delivered);
  useEffect(() => {
    if (!socket || !roomId || !objective) return;
    const timer = setTimeout(report, STATUS_BROADCAST_MS);
    return () => clearTimeout(timer);
  }, [socket, roomId, objective, contribution, report]);

  // The heal. Also reports again on a new connection, which is the same
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

  // A press this screen is waiting on an answer to. It is one term in two
  // places, because the two things it shuts are the same thing said twice:
  // the count on the button, and the press the button would make.
  const inFlight = pressed === game.currentRound;

  // What the screen shows, and what the button would move right now. The
  // button needs the fleet's size as much as it needs the phase: with the
  // size unknown the board on screen is the founding one, and handing goods
  // over against it would spend them on a quota the fleet is not working.
  // A press in flight reads as nothing deliverable, the rule the audit's
  // button is shut by: the room is deciding what that press takes, and the
  // count behind a second press would come off a board the first one is
  // about to move.
  const progress = objective ? objectiveProgress(objective, taken) : null;
  const deliverable =
    objective &&
    !inFlight &&
    game.phase === OBJECTIVE_DELIVERY_PHASE &&
    seats !== null
      ? objectiveTaking(objective, game.inventory, taken).reduce(
          (sum, row) => sum + row.take,
          0,
        )
      : 0;

  // The press. It asks the room before the goods move: what is offered is
  // the standing this press would leave this captain on, good by good,
  // which is the number a report carries because it is the same number. The
  // take itself is the goods that standing is short of, read against the
  // board this screen holds, and the room holds it to what the commission
  // has actually left. With no socket there is no room to ask, so this
  // captain's own reading of the board is the whole of what there is to
  // judge by, which is what the press was before there was a room to ask.
  const deliver = useCallback(() => {
    if (!objective || inFlight) return;
    if (!socket || !roomId) {
      act((g, logs) => deliverToObjective(g, objective, logs, taken));
      return;
    }
    setPressed(game.currentRound);
    const proposed: Record<string, number> = {};
    for (const row of objectiveTaking(objective, game.inventory, taken)) {
      proposed[row.type] = (game.objectiveDelivered[row.type] ?? 0) + row.take;
    }
    socket.emit("objective:handover", { roomId, delivered: proposed });
  }, [
    act,
    game.currentRound,
    game.inventory,
    game.objectiveDelivered,
    inFlight,
    objective,
    roomId,
    socket,
    taken,
  ]);

  return { objective, progress, deliverable, deliver };
}
