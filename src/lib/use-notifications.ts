"use client";

import { useCallback, useRef, useState } from "react";

export type NotificationItem = {
  id: string;
  icon: string;
  title: string;
  lines: string[];
  at: number;
  onActivate?: () => void;
  category?: "room" | "docks" | "tidewatch" | "default";
};

const HISTORY_LIMIT = 50;
const BUBBLE_DURATION_MS = 8000;

// localStorage keys for per category suppression. When "false", push
// calls for that category are silently dropped (the item still lands in
// the history list, just no bubble and no unread increment).
const PREF_KEYS: Record<string, string> = {
  room: "portmasters_notif_room_events",
  docks: "portmasters_notif_docks",
  tidewatch: "portmasters_notif_tidewatch",
};

function isCategoryEnabled(category?: string): boolean {
  if (!category || category === "default") return true;
  const key = PREF_KEYS[category];
  if (!key) return true;
  try {
    return localStorage.getItem(key) !== "false";
  } catch {
    return true;
  }
}

/**
 * Replaces sonner for the room's ambient event notifications (ledger
 * digests, harbor chat, direct messages): only ever one bubble visible at
 * a time, a new push replaces whatever's currently showing instead of
 * stacking, and nothing is actually lost since every push also lands in
 * `items`, the full history a notification button can expand to show.
 * Quick direct feedback toasts (save confirmation, copy code, errors)
 * stay on sonner; this hook is only for the kind of event someone could
 * otherwise miss entirely.
 *
 * The `category` field on a push lets the notification center check the
 * captain's per category preference in localStorage. A captain who
 * turned off "Word on the Docks" in Settings will still see the event
 * in the history list, but no bubble appears and no unread badge
 * increments.
 */
export function useNotificationCenter() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [current, setCurrent] = useState<NotificationItem | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissCurrent = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setCurrent(null);
  }, []);

  const push = useCallback((item: Omit<NotificationItem, "id" | "at">) => {
    const full: NotificationItem = {
      ...item,
      id: `${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
    };
    // Always record in history, even if the category is suppressed.
    setItems((prev) => [full, ...prev].slice(0, HISTORY_LIMIT));

    // Check the per category preference before showing the bubble.
    if (!isCategoryEnabled(full.category)) return;

    setUnreadCount((n) => n + 1);
    setCurrent(full);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(
      () => setCurrent(null),
      BUBBLE_DURATION_MS,
    );
  }, []);

  const markAllRead = useCallback(() => setUnreadCount(0), []);

  return { items, current, unreadCount, push, dismissCurrent, markAllRead };
}
