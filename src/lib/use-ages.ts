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
 * The Age is computed once per mount, from a single clock read (see the
 * memo below), and does not tick: a tab left open across the fortnight
 * boundary keeps the Age it mounted with until the next navigation. That
 * is plenty for a two week cycle, and it means every captain sharing a
 * moment reads the same Age off the same shared clock.
 */
export function useAges(): { age: Age } {
  const age = useMemo(() => currentAge(new Date()), []);
  return { age };
}
