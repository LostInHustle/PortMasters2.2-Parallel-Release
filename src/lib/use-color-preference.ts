"use client";

import { useCallback, useEffect, useState } from "react";
import { COLORS, COLORS_COLORBLIND_SAFE } from "@/lib/game/constants";

// Colorblind safe palette: purely a client side rendering choice, the same
// reasoning the tutorial seen flag in GameRoom.tsx already follows: read
// once on mount, write on toggle, no server round trip and no new trust
// boundary, since this never changes what any other captain sees.
const COLORBLIND_SAFE_KEY = "portmasters_colorblind_safe";

// Every panel that colours a good's name takes `colorFor` as an optional
// prop, so a caller that has not wired the preference through still renders
// correctly. Each one used to inline the same fallback expression, which put
// six copies of "the default palette is COLORS" across the components and
// made each of them import COLORS purely for that. This keeps the default in
// one place, next to the palettes it chooses between.
export function itemColorResolver(
  colorFor?: (item: string) => string | undefined,
): (item: string) => string | undefined {
  return colorFor ?? ((item: string) => COLORS[item]);
}

export function useColorPreference() {
  const [colorblindSafe, setColorblindSafeState] = useState(false);

  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem(COLORBLIND_SAFE_KEY) === "1";
    } catch {
      // Private browsing or a disabled storage API: default stays off.
    }
    // Deferred so this isn't a synchronous setState call inside the effect
    // body (react-hooks/set-state-in-effect); the identical pattern is in
    // src/lib/use-realtime.ts.
    if (stored) Promise.resolve().then(() => setColorblindSafeState(true));
  }, []);

  const setColorblindSafe = useCallback((value: boolean) => {
    setColorblindSafeState(value);
    try {
      localStorage.setItem(COLORBLIND_SAFE_KEY, value ? "1" : "0");
    } catch {
      // Best effort only; the in memory state above still applies for the
      // rest of this session even if persisting it fails.
    }
  }, []);

  const colorFor = useCallback(
    (item: string): string | undefined =>
      (colorblindSafe ? COLORS_COLORBLIND_SAFE : COLORS)[item],
    [colorblindSafe],
  );

  return { colorblindSafe, setColorblindSafe, colorFor };
}
