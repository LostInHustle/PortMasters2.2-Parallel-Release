import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// The border and wash a captain's own line wears, shared by the roster
// rail and the fleet ticker so the two rows that say "this is you" say
// it the same way.
export function memberRowClass(isMe: boolean): string {
  return isMe
    ? "border-members/30 bg-members/[0.06]"
    : "border-black/5 dark:border-white/10 bg-background/40";
}

// A short clock reading for a timestamp, in the reader's own locale. The
// one place the interface turns a Date into a time of day, so every
// screen shows the same style.
// The Intl tag behind each language the tree prints. Kept as plain
// strings rather than imported from ./game/i18n so this file stays a
// leaf: every screen and every shadcn primitive imports cn from here, and
// none of them should pull the language pack in for that.
function intlLocale(locale?: "en" | "zh"): string | undefined {
  if (locale === "zh") return "zh-CN";
  if (locale === "en") return "en-US";
  // A caller that named no language keeps the reader's own locale, which
  // is the reading this pair had before the pick was handed in.
  return undefined;
}

// A clock time, in the language the screen is printing. A Chinese screen
// reading 12:57 PM because the operating system is American is the same
// mismatch the pack fixes for words, so the caller's pick decides the
// format rather than the machine's.
export function formatTime(d: Date | string, locale?: "en" | "zh"): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// The calendar day a timestamp falls on, in the same language format.
// Sits beside formatTime above so the two date formats a captain ever
// sees come from one file.
export function formatDate(d: Date | string, locale?: "en" | "zh"): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(intlLocale(locale));
}
