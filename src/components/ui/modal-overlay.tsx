"use client";

import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

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
 * Every call site mounts this behind state that starts false, so it only ever
 * renders in the browser. The guard below covers the server pass, where
 * `document` does not exist yet.
 */
export function ModalOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  // Escape closes, the key every Radix dialog under ui/dialog already
  // answers, so the habit a captain learned there holds in the game's own
  // sheets too. A press a nested dialog has already handled is left alone,
  // which keeps one Escape from closing a Radix dialog and the sheet under
  // it together.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
