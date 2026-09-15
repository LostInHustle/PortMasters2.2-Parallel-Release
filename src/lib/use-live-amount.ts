"use client";

import { useCallback, useState } from "react";

// A number the captain can take over, which until then follows a figure the
// game keeps moving.
//
// Every phase of a round can have its panel open when a barter lands, and a
// completed trade moves Gold as readily as goods. That makes any figure a
// panel works out once and then keeps a liability rather than a convenience:
// it goes on offering a number the captain can no longer deliver, or hides
// one they have since become able to. Both directions have to be settled
// here rather than left to the engine, because the engine does refuse an ask
// that is out of range or unaffordable, and it is right to. The captain would
// simply be reading a correct refusal to a question the panel got wrong, with
// nothing on screen to explain why.
//
// null is the sentinel and it means untouched, which is not the same as zero.
// Until the captain names a figure the value mirrors the live one. After that
// the figure is theirs and a later move in the live figure does not overwrite
// it. With clamp set, their figure is additionally held down to whatever the
// live figure currently allows, which keeps a field honest when a hold or a
// purse shrinks without taking the choice away: if the live figure grows
// again, their own number is still there underneath.
//
// Having one home for this is the point of it. The rule is subtle enough that
// two panels had already grown their own copy of it, each with the same long
// explanation beside a near identical expression, and a third would have
// followed. Anything in a phase that reads a resource live and lets a captain
// name an amount belongs here rather than hand rolled again.
export function useLiveAmount(live: number, clamp = false) {
  const [draft, setDraft] = useState<number | null>(null);
  const value = draft === null ? live : clamp ? Math.min(draft, live) : draft;
  const commit = useCallback((next: number) => setDraft(next), []);
  const reset = useCallback(() => setDraft(null), []);
  return { value, commit, reset };
}
