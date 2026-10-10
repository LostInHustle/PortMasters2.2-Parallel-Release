"use client";

import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// What counts as reachable by Tab inside a dialog. Disabled controls are
// out because they cannot take focus, and the -1 tabindex is out because
// it is exactly how the wrapper itself opts out after it takes focus once.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The overlay every dialog in the game sits in: a dimmed, blurred backdrop
 * that closes the dialog when it is clicked or when Escape is pressed,
 * wrapped around a centred column that holds the panel.
 *
 * It renders into `document.body` rather than in place, and that is the whole
 * point of it. A `fixed` element is positioned against the nearest ancestor
 * that establishes a containing block, and an ancestor carrying a `transform`,
 * a `filter` or a `clip-path` is one of the things that does. The controls in
 * this game carry two of those at various moments: a pressable button lifts
 * and scales on hover, which is a `transform`, and the same rule brightens it,
 * which is a `filter`. A dialog opened from inside one of them would centre
 * on that button rather than on the viewport, and the part of it taller
 * than the button would run off the top of the screen where nothing could
 * reach it. Portalling to the body lifts a dialog out of that ancestry
 * entirely, so its centring holds wherever it is opened from, and deleting
 * the portal would bring the whole fault back, because the reasons above
 * are still true.
 *
 * The wrapper is the dialog: it carries the role, the label a screen
 * reader announces on open, and the three behaviours that make the modal
 * claim true rather than decorative. Focus moves in when the dialog opens
 * and back to whatever held it when the dialog closes, so a captain who
 * opened the settings with the keyboard is returned to the settings
 * button rather than to the top of the page. Tab cycles within the dialog
 * instead of walking out into the room behind it, because a dimmed
 * backdrop is a promise that the page behind will not be reached, and a
 * promise focus does not keep is a lie told to the readers who need the
 * promise most. Escape closes, as before.
 *
 * The label is required: a dialog with no name is announced as "dialog",
 * which tells the person who just opened it nothing about where they are.
 *
 * Every call site mounts this behind state that starts false, so it only ever
 * renders in the browser. The guard below covers the server pass, where
 * `document` does not exist yet.
 */
export function ModalOverlay({
  label,
  onClose,
  children,
}: {
  /** The dialog's name, announced when it opens. Match the heading it draws. */
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus in on open, out on close. The element that held focus at mount
  // is captured first, because by cleanup time it may no longer be
  // focused, and the captain's place is where they pressed rather than
  // wherever the dialog itself last put the caret. An element that has
  // left the document by then, a button on a screen the dialog closed
  // past, fails focus silently, which is the right amount of fuss for a
  // restore that has nothing to restore to.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      previous?.focus();
    };
  }, []);

  // Escape closes, the key every Radix dialog under ui/dialog already
  // answers, so the habit a captain learned there holds in the game's own
  // sheets too. A press a nested dialog has already handled is left alone,
  // which keeps one Escape from closing a Radix dialog and the sheet under
  // it together, and the same rule guards the Tab trap below: a nested
  // focus scope that has claimed a Tab keeps it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root || !root.contains(document.activeElement)) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.getClientRects().length > 0);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {children}
    </div>,
    document.body,
  );
}

// The rise and settle every dialog in the game wears. Written once because
// six dialogs wear it: the two behind the card below, and the four column
// dialogs the sheet serves.
const CARD_MOTION = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
  transition: { duration: 0.25, ease: "easeOut" },
} as const;

/**
 * The panel a dialog's content sits on: the card that rises and settles as
 * the dialog opens, wearing the game's glass treatment with the seigaiha
 * wash behind whatever is inside it.
 *
 * It lives beside the overlay because the two are one idea in two pieces,
 * and it lives here rather than in either of the dialogs that use it (the
 * age's detail and the shortcut list) because those two are the same panel
 * with different content inside. A look two screens share is a look that
 * drifts the first time one of them is retouched, so the classes below are
 * written once: change them here and both dialogs move together.
 *
 * The heading is the caller's, because that is the one thing the callers do
 * not agree about.
 */
export function ModalCard({ children }: { children: ReactNode }) {
  return (
    <motion.div
      {...CARD_MOTION}
      className="pm-glass-strong pm-crackle relative z-10 w-full max-w-md overflow-hidden rounded-3xl p-6"
    >
      <div className="pm-seigaiha absolute inset-0 opacity-20 pointer-events-none" />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

/**
 * The column a dialog with regions sits on: the same glass, the same rise
 * and the same rounded frame as the card, laid out as a vertical stack
 * whose header and body the caller hands in as children.
 *
 * The guide, the settings, the captain's profile and the leaderboard are
 * the four dialogs this serves. They agree on everything but the two
 * numbers this takes: how wide the panel may be and how tall. The motion
 * props and the glass classes live here, so a caller cannot drift from
 * the shape the four share. The card above keeps its own shape because
 * its content is one centred column and the four are scrolled regions
 * under fixed headers; the paper here is one width, one height and the
 * stack.
 */
export function ModalSheet({
  maxW = "max-w-md",
  maxH = "max-h-[90vh]",
  children,
}: {
  maxW?: string;
  maxH?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      {...CARD_MOTION}
      className={cn(
        "pm-glass-strong pm-crackle relative z-10 flex w-full flex-col overflow-hidden rounded-3xl",
        maxH,
        maxW,
      )}
    >
      {children}
    </motion.div>
  );
}

/**
 * The button that closes a dialog: the same circle, the same hover, the same
 * icon, and nothing chosen by the caller but the two words a screen reader
 * reads out.
 *
 * The five dialogs that draw a close button agree on every part of it down
 * to the icon's size, and the label is the only piece any of them picks for
 * itself. Five copies of a look is how a look drifts, and the drift is
 * invisible until two dialogs are open side by side, so the look lives here
 * and each caller passes only the label.
 */
export function ModalClose({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pm-pressable rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
      aria-label={label}
    >
      <X className="h-5 w-5" />
    </button>
  );
}
