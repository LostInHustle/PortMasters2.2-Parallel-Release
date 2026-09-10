"use client";

import { AnimatePresence, motion } from "framer-motion";
import { NotificationToast } from "./NotificationToast";
import type { NotificationItem } from "@/lib/use-notifications";

/**
 * The single floating bubble for whichever notification just arrived.
 * Fixed at bottom left, the mirror corner of the existing bankruptcy
 * and endgame help button (bottom right, see GameRoom.tsx), so this
 * never sits over the center game board the way the old stacked sonner
 * toasts did. A new push replaces this outright; nothing is lost since
 * it's also in the notification button's full history.
 */
export function NotificationCenter({
  current,
  dismiss,
}: {
  current: NotificationItem | null;
  dismiss: () => void;
}) {
  return (
    <div className="pm-z-notification fixed bottom-5 left-5 w-[min(360px,calc(100vw-2.5rem))]">
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
