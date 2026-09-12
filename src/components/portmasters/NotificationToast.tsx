"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The body for every popup notification (ledger digests, harbor chat,
 * direct messages). Built as plain stacked lines rather than a single
 * joined string, since a toast's default CSS collapses literal newlines
 * down to spaces, which is what made earlier multi line digests read as
 * one squished run on sentence.
 *
 * The close button is always present and separate from the click to
 * activate area: activating (jumping to the chat tab a message came
 * from, say) and simply dismissing are two different things a captain
 * might want, and a notification with nothing to activate still needs a
 * way to be closed before its own timer runs out.
 *
 * Wears the heavier `pm-glass-strong` so it stays readable over the
 * center game board, with a celadon border that ties it to the morning
 * sea palette.
 */
export function NotificationToast({
  icon,
  title,
  lines,
  onActivate,
  toastId,
  dismiss,
}: {
  icon: string;
  title: string;
  lines: string[];
  onActivate?: () => void;
  toastId: string | number;
  dismiss: (id: string | number) => void;
}) {
  const clickable = Boolean(onActivate);
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={
        clickable
          ? () => {
              onActivate!();
              dismiss(toastId);
            }
          : undefined
      }
      className={cn(
        "relative w-full text-left pm-glass-strong rounded-xl px-4 py-3 pr-8 shadow-xl border border-notifications/25",
        clickable &&
          "cursor-pointer hover:border-notifications/50 transition-colors",
      )}
    >
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={(e) => {
          e.stopPropagation();
          dismiss(toastId);
        }}
        className="absolute top-2.5 right-2.5 rounded-md p-0.5 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="text-sm font-semibold mb-1 flex items-center gap-1.5">
        <span className="text-base">{icon}</span> {title}
      </div>
      <div className="space-y-0.5">
        {lines.map((line, i) => (
          <div
            key={i}
            className="text-[13px] text-foreground leading-snug break-words"
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
