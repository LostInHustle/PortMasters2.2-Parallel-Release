"use client";

import { useEffect, useRef } from "react";

/**
 * A ref that always holds the latest value a render produced.
 *
 * A listener installed once on a socket reads the value as it stands when
 * the frame arrives, rather than the value captured when the listener was
 * installed. Every hook that needed this had grown its own ref and effect
 * pair; one hook keeps the window and the update order the same for all of
 * them.
 *
 * The write happens in an effect, so a listener that fires between render
 * and commit still sees the previous value. That is the window every copy
 * had, and replacing them does not widen it.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
