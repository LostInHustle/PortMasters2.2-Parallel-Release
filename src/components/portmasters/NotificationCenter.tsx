"use client";

import { AnimatePresence, motion } from "framer-motion";
import { NotificationToast } from "./NotificationToast";
import type { NotificationItem } from "@/lib/use-notifications";

/**
 * The single floating bubble for whichever notification just arrived.
 * A new push replaces this outright; nothing is lost since it's also
 * in the notification button's full history.
 *
 * Below the wide layout it is fixed at bottom left, the mirror corner
 * of the bankruptcy and endgame help button (bottom right, see
 * GameRoom.tsx), so it never sits over the center game board: below the
 * breakpoint there is no rail to cover, only the one scroll.
 *
 * At lg it stops being fixed and anchors to the stage column instead
 * (the relative wrapper around the scroller in GameRoom.tsx). Bottom
 * left is the captain's rail there, and a bubble pinned over a rail
 * covers the readings and the fold stubs a captain is still using, so
 * the bubble moves onto the board's own top corner, where it can only
 * cover the board, and only while it is up.
 */
export function NotificationCenter({
  current,
  dismiss,
}: {
  current: NotificationItem | null;
  dismiss: () => void;
}) {
  return (
    <div className="pm-z-notification fixed bottom-5 left-5 w-[min(360px,calc(100vw-2.5rem))] lg:absolute lg:bottom-auto lg:left-auto lg:right-3 lg:top-3 lg:w-[min(340px,calc(100%-1.5rem))]">
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <NotificationToast
              icon={current.icon}
              title={current.title}
              lines={current.lines}
              onActivate={current.onActivate}
              toastId={current.id}
              dismiss={dismiss}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
