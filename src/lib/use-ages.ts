"use client";

import { useMemo } from "react";
import { currentAge, nextAgeChange, type Age } from "@/lib/game/engine";

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
 *
 * `nextChange` is the instant that same Age hands over, read from the same
 * clock as the Age itself. It is fixed at mount and does not tick, which
 * is why anything showing it as a countdown must phrase itself so that a
 * slightly stale figure still reads true.
 */
export function useAges(): { age: Age; nextChange: Date } {
  // One clock read feeds both, so a render that lands exactly on a
  // boundary cannot report the outgoing Age alongside the incoming
  // boundary, or the other way round.
  const { age, nextChange } = useMemo(() => {
    const now = new Date();
    return { age: currentAge(now), nextChange: nextAgeChange(now) };
  }, []);
  return { age, nextChange };
}
