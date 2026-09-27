"use client";

// =====================================================================
// [I1: the telemetry spine] The leg report, client side.
//
// Three of the plan's numbers exist nowhere but a captain's own screen:
// how many orders a leg dealt them, how many of those they filled, and
// how varied the hold they closed it with was. The server cannot count
// any of the three and must not try, so this hook reads them off the
// voyage state and files them as a claim against the leg they belong to.
//
// What is deliberately not here is a hold utilization figure. The plan
// asks for one, and this tree's hold has no size: an order board of three
// is three of nothing, and a percentage invented for it would be a number
// no rule moves. It waits for the split hold in C4, which is where a hold
// gets a denominator. What ships instead is the variety the hold carried,
// which is the number the dashboard's staple question actually reads.
//
// The report is a claim and is treated as one. Nothing in the game reads
// it, the server bounds its leg against the voyage before keeping it, and
// the last report for a leg is the one kept rather than the first, so a
// captain who keeps trading after their first count is not recorded as
// having stopped.
//
// One report is one debounced effect. A hold changes good by good and an
// order board empties one order at a time, so the effect fires on the
// figures rather than on the click, and the server's own replace rule
// makes the several frames one leg can produce a single line in the
// record.
// =====================================================================

import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import type { GameState } from "@/lib/game/types";
import type { LegReport } from "@/types/realtime";

// The same cadence the captain's own status rides on (see
// use-game-session.ts): enough to feel immediate, sparse enough that a
// captain filling four orders in a row files one report rather than four.
const REPORT_DEBOUNCE_MS = 120;

/**
 * Reports what this captain's leg dealt, filled and closed carrying.
 *
 * Inert before the voyage starts and after it ends: leg 0 is the lobby,
 * and there is nothing to count in a harbor that is not sailing.
 */
export function useLegReport(
  socket: Socket | null,
  roomId: string | null,
  game: GameState,
): void {
  const leg = game.currentRound;
  // The orders this leg dealt, which is the board standing in front of
  // the captain during the trade phase, and the ones they filled, which
  // the engine resets at the top of every round and appends to on every
  // settlement. Dealt minus filled is the plan's expired count, worked
  // out by whoever reads the record rather than stored a second time.
  const ordersDealt = game.customerCards.length;
  const ordersFilled = game.completedOrders.length;
  // The goods the hold closes the leg carrying: a hold full of one thing
  // is the staple the plan's gate watches for, and no key of an empty
  // hold counts.
  let distinctGoods = 0;
  for (const count of Object.values(game.inventory)) {
    if (count > 0) distinctGoods++;
  }

  // The four figures are the dependency list, which is the point: the
  // effect fires when a count moves, not when the captain clicks.
  useEffect(() => {
    if (!socket || !roomId || leg < 1) return;
    const timer = setTimeout(() => {
      const payload: LegReport = {
        roomId,
        leg,
        ordersDealt,
        ordersFilled,
        distinctGoods,
      };
      socket.emit("telemetry:leg", payload);
    }, REPORT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [socket, roomId, leg, ordersDealt, ordersFilled, distinctGoods]);
}
