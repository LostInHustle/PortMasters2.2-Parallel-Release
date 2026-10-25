"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type NotificationItem = {
  id: string;
  icon: string;
  title: string;
  lines: string[];
  at: number;
  onActivate?: () => void;
  category?: "room" | "docks" | "tidewatch" | "default";
  /**
   * Whether the captain has seen this one.
   *
   * The unread count is read off this rather than counted on the side, so
   * the badge and the list cannot disagree: a notification the history has
   * dropped leaves the count with it, and the act that opens the history is
   * the act that clears the count.
   */
  read: boolean;
};

const HISTORY_LIMIT = 50;
const BUBBLE_DURATION_MS = 8000;

// The categories a captain can mute. Every one of them has a switch on
// the Settings screen.
export type NotifCategory = "room" | "docks" | "tidewatch";

// localStorage keys for per category suppression. When "false", push
// calls for that category are silently dropped (the item still lands in
// the history list, just no bubble and no unread increment).
const PREF_KEYS: Record<NotifCategory, string> = {
  room: "portmasters_notif_room_events",
  docks: "portmasters_notif_docks",
  tidewatch: "portmasters_notif_tidewatch",
};

// The read and the write, both here, so that the screen holding the
// switches and the code deciding whether to show a bubble are looking at
// the same key. Settings kept its own copy of these three names, which is
// the kind of duplication that fails silently in one direction only: the
// screen would go on saving a preference under a key nothing reads, and
// the switch would move while the bubbles kept coming.
//
// Both answer true when storage is unreachable, since a captain who has
// blocked storage has not muted anything.
export function notifCategoryPref(category: NotifCategory): boolean {
  try {
    return localStorage.getItem(PREF_KEYS[category]) !== "false";
  } catch {
    return true;
  }
}

export function setNotifCategoryPref(
  category: NotifCategory,
  on: boolean,
): void {
  try {
    localStorage.setItem(PREF_KEYS[category], String(on));
  } catch {
    // private browsing
  }
}

function isCategoryEnabled(category?: NotificationItem["category"]): boolean {
  if (!category || category === "default") return true;
  return notifCategoryPref(category);
}

/**
 * Replaces sonner for the harbor's ambient event notifications (ledger
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
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The bubble's own timer is cleared when the center goes away, so a
  // captain who leaves the harbor while a bubble is up does not leave a
  // timer behind to write to a tree that is no longer there.
  useEffect(
    () => () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    },
    [],
  );

  const dismissCurrent = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setCurrent(null);
  }, []);

  const push = useCallback(
    (item: Omit<NotificationItem, "id" | "at" | "read">) => {
      // The per category preference is read before the item is made, so
      // the item carries the answer: a notification in a muted category
      // never reached the captain as a bubble, so there is nothing unseen
      // about it and it lands in the history already read.
      const shown = isCategoryEnabled(item.category);
      const full: NotificationItem = {
        ...item,
        id: `${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        at: Date.now(),
        read: !shown,
      };
      // Always record in history, even if the category is suppressed.
      setItems((prev) => [full, ...prev].slice(0, HISTORY_LIMIT));

      if (!shown) return;

      setCurrent(full);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(
        () => setCurrent(null),
        BUBBLE_DURATION_MS,
      );
    },
    [],
  );

  const markAllRead = useCallback(() => {
    setItems((prev) =>
      prev.every((item) => item.read)
        ? prev
        : prev.map((item) => (item.read ? item : { ...item, read: true })),
    );
  }, []);

  // The count, read off the list rather than kept beside it. The two were
  // separate answers to one question, and they disagreed: a notification
  // in a muted category landed in the history without ever reaching the
  // count, and the count outlived the history it was counting.
  const unreadCount = useMemo(
    () => items.reduce((n, item) => (item.read ? n : n + 1), 0),
    [items],
  );

  // The answer, held to one identity until something inside it changes.
  // Consumers keep it in dependency lists, and an object rebuilt every
  // render re-ran their effects every render.
  return useMemo(
    () => ({ items, current, unreadCount, push, dismissCurrent, markAllRead }),
    [items, current, unreadCount, push, dismissCurrent, markAllRead],
  );
}
