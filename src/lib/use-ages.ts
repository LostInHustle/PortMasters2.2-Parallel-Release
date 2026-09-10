"use client";

import { useMemo } from "react";
import { currentAge, type Age } from "@/lib/game/engine";

/**
 * The Three Ages: a fortnight long rotation that leans the harbor one way
 * or another without retuning any of the permanent balance. Every captain
 * in every harbor shares the same Age at the same moment, so this is pure
 * client side computation off the shared clock. No fetch, no realtime
 * subscription, no state: the same Age for the lifetime of a render.
 *
 * The Age is recomputed on every render, but since `currentAge` is a pure
 * function of `Date.now()` and a render takes milliseconds, the value is
 * stable across a session unless a captain keeps a tab open across the
 * fortnight boundary. The Lobby's Age chip reads this hook on mount and
 * again on any navigation, which is plenty for a two week cycle.
 */
export function useAges(): { age: Age } {
  const age = useMemo(() => currentAge(), []);
  return { age };
}
