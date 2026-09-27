"use client";

import { createPortal } from "react-dom";
import type { ReactNode } from "react";

/**
 * The overlay every dialog in the game sits in: a dimmed, blurred backdrop
 * that closes the dialog when it is clicked, wrapped around a centred column
 * that holds the panel.
 *
 * It renders into `document.body` rather than in place, and that is the whole
 * point of it. A `fixed` element is positioned against the nearest ancestor
 * that establishes a containing block, and an ancestor carrying a `transform`,
 * a `filter` or a `clip-path` is one of the things that does. The controls in
 * this game carry two of those at various moments: a pressable button lifts
 * and scales on hover, which is a `transform`, and the same rule brightens it,
 * which is a `filter`. Opening a dialog from inside one of them used to centre
 * it on that button rather than on the viewport, and the part of it taller
 * than the button ran off the top of the screen where nothing could reach it.
 * Portalling to the body lifts a dialog out of that ancestry
 * entirely, so its centring holds wherever it is opened from. Deleting the
 * portal on the grounds that the old reason has gone would bring the whole
 * fault back, because the reasons above are still true.
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
