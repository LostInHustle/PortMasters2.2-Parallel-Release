"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A numeric field that can actually be typed into.
 *
 * Every quantity field in the game used to parse and clamp on each keystroke:
 *
 *   onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
 *
 * which produces three separate defects from one line. Deleting the last
 * character yields "", `parseInt("")` is NaN, and `NaN || 1` restores 1 before
 * the replacement can be typed, so "delete the 1 and type 4" is impossible.
 * Where a ceiling was also applied, typing a digit above the amount held was
 * truncated immediately, putting any larger multi digit target out of reach.
 * Together those left select all and overwrite as the only workable gesture.
 *
 * So this holds a raw string draft while focused, permitting the empty field
 * and any intermediate value, and only parses, floors and clamps on commit
 * (blur, or Enter). Callers still receive a valid number and never see the
 * draft. Submission paths validate independently anyway (callBrokersFavor
 * rejects an out of range ask), so committing late is safe rather than the
 * only guard.
 *
 * type="text" with inputMode="numeric" rather than type="number": it keeps the
 * value fully under our control, avoids the browser spinner reintroducing its
 * own coercion, and still raises the numeric keypad on touch devices, which is
 * what the tablet reports needed.
 *
 * The previous value and the editing flag are stored as state (not refs) so
 * the draft can be adjusted during render via the React documented pattern
 * for "reset state when a prop changes" (see
 * https://react.dev/learn/you-might-not-need-an-effect#resetting all state when a prop changes).
 * That keeps the field from yanking itself out from under someone mid edit
 * without either a setState in effect (cascading renders) or a ref read in
 * render (forbidden by the react-hooks/refs rule).
 */
export function QuantityInput({
  value,
  onCommit,
  min = 1,
  max,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  onCommit: (next: number) => void;
  min?: number;
  max?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const [draft, setDraft] = useState(() => String(value));
  const [editing, setEditing] = useState(false);
  const [prevValue, setPrevValue] = useState(value);

  // Track external changes (a different item selected, a hold that shrank)
  // but never yank the field out from under someone mid edit. Done during
  // render rather than in an effect so React can flush the adjustment
  // synchronously rather than scheduling a second render pass for it.
  if (prevValue !== value) {
    setPrevValue(value);
    if (!editing) setDraft(String(value));
  }

  function commit(raw: string) {
    setEditing(false);
    const parsed = Number.parseInt(raw, 10);
    let next = Number.isFinite(parsed) ? parsed : value;
    if (next < min) next = min;
    if (max !== undefined && next > max) next = max;
    setDraft(String(next));
    if (next !== value) onCommit(next);
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={ariaLabel}
      value={draft}
      onFocus={() => {
        setEditing(true);
      }}
      onChange={(e) => {
        setEditing(true);
        // Digits only, but the empty string is explicitly allowed so the
        // field can be cleared and retyped.
        setDraft(e.target.value.replace(/[^0-9]/g, ""));
      }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit((e.target as HTMLInputElement).value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn(className)}
    />
  );
}
