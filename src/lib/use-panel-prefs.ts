"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Which of the room's foldable panels a captain has folded away. Purely a
// client side rendering choice, the same reasoning the colorblind toggle
// follows: read once on mount, write on fold, no server round trip and no
// new trust boundary, since this never changes what any other captain
// sees.
//
// Three keys, two levels. `left` is rail level: the captain's rail gives
// way to a stub beside the stage and the stage takes the width. `roster`
// and `chat` are widget level: on the wide layout either one folds to a
// strip of its own at the rail's outer edge and the other takes the rail,
// so a captain can keep the roster and give the chat the width; below the
// breakpoint the same key folds the panel to its head, the accordion a
// full width row has room for, and the chevron on that head is the way
// back. The right rail itself is not a fourth key: it is folded exactly
// when both of its panels are, derived at the reader rather than stored,
// so the record cannot hold a rail that is empty and yet still standing.
const PANELS_KEY = "portmasters_room_panels";

// Both helpers stay module local: the hook's returned object carries them
// structurally, and no surface outside this file names either one.
type RoomPanel = "left" | "roster" | "chat";

type PanelPrefs = Record<RoomPanel, boolean>;

// true means folded. Every panel opens expanded, which is the room a
// captain saw before this record existed.
const OPEN: PanelPrefs = { left: false, roster: false, chat: false };

const PANELS: RoomPanel[] = ["left", "roster", "chat"];

// Only the fields this record owns, and only when they are booleans: a
// stored blob that has been hand edited or written by an older build
// parses to the default for whatever it is missing rather than to an
// undefined panel.
function parsePrefs(raw: string | null): PanelPrefs {
  if (!raw) return OPEN;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return OPEN;
    const record = parsed as Record<string, unknown>;
    const out = { ...OPEN };
    for (const panel of PANELS) {
      const value = record[panel];
      if (typeof value === "boolean") out[panel] = value;
    }
    return out;
  } catch {
    return OPEN;
  }
}

export function usePanelPrefs() {
  const [collapsed, setCollapsed] = useState<PanelPrefs>(OPEN);
  // The latest committed value, held beside the state so two folds in one
  // press compose: a stub icon opens one panel and nothing else, but a
  // future caller folding two at once would otherwise have its second
  // write built from the state both calls share, dropping the first fold
  // on the next load.
  const latest = useRef<PanelPrefs>(OPEN);

  useEffect(() => {
    let stored = OPEN;
    try {
      stored = parsePrefs(localStorage.getItem(PANELS_KEY));
    } catch {
      // Private browsing or a disabled storage API: every panel stays open.
    }
    // Deferred so this is not a synchronous setState inside the effect
    // body (react-hooks/set-state-in-effect), the pattern the color
    // preference and use-realtime both follow. Committed only when
    // something is folded: the default render already matches the all
    // open case.
    if (PANELS.some((panel) => stored[panel])) {
      Promise.resolve().then(() => {
        latest.current = stored;
        setCollapsed(stored);
      });
    }
  }, []);

  const set = useCallback((panel: RoomPanel, value: boolean) => {
    const next = { ...latest.current, [panel]: value };
    latest.current = next;
    setCollapsed(next);
    try {
      localStorage.setItem(PANELS_KEY, JSON.stringify(next));
    } catch {
      // Best effort only; the in memory state above still applies for the
      // rest of this session even if persisting it fails.
    }
  }, []);

  const toggle = useCallback(
    (panel: RoomPanel) => {
      set(panel, !latest.current[panel]);
    },
    [set],
  );

  return { collapsed, set, toggle };
}
