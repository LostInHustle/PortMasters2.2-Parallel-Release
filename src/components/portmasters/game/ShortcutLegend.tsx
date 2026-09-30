"use client";

// =====================================================================
// The row of keyboard hints that sits under the room's controls.
//
// The four keys this screen answers to, and the button that opens the
// whole list rather than just these four. The caps share one class string
// through Key, button included, because the button is a cap that happens
// to be clickable and the two were written out at five call sites before
// this.
// =====================================================================

import type { ReactNode } from "react";

// The cap: the size, the corner and the wash, in one place for the four
// keys and for the button at the end of the row.
const CAP = "rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5";

/** One key cap. */
function Key({ children }: { children: ReactNode }) {
  return <kbd className={CAP}>{children}</kbd>;
}

/**
 * The row of hints, which wraps rather than overflowing: these five chips
 * and their labels are wider than a phone, and a centred row with no wrap
 * spills off both edges at once, which both hides the first hint and gives
 * the whole page a sideways scrollbar.
 *
 * Drawn only where there is a keyboard to press. Below the width the room
 * splits into its three columns a captain is holding a phone, where four
 * key caps are two lines of chrome between them and the board they came to
 * read, and where none of the four keys exists. The list they open goes
 * with them, and that is the same sentence: it is a list of keys, and a
 * phone has none of them. The Guide button on the bar above stays at every
 * width, so a captain on a phone still has the harbor's own manual.
 */
export function ShortcutLegend({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="hidden lg:flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
      <Key>Ctrl+S</Key> Save
      <Key>Ctrl+N</Key> Next Phase
      <Key>Ctrl+R</Key> Restart
      <Key>F1</Key> Guide
      <button
        onClick={onOpen}
        className={`pm-pressable ${CAP} hover:bg-black/10 dark:hover:bg-white/20`}
        title="Show all keyboard shortcuts"
      >
        ?
      </button>{" "}
      Shortcuts
    </div>
  );
}
