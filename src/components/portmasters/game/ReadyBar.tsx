"use client";

import type { ReadyState } from "@/lib/use-phase-sync";
import type { PhaseClock } from "@/lib/phase-clock";
import type { PublicUser } from "@/lib/api";
import { Avatar } from "../shared";
import { cn } from "@/lib/utils";
import { Check, Clock, Hourglass } from "lucide-react";

/* Seconds at which the countdown stops reading as information and starts
   reading as a warning. It is a colour choice rather than a rule: the room
   moves when the server says it does, whatever this is drawn as. */
const URGENT_SECONDS = 10;

export function ReadyBar({
  ready,
  members,
  clock,
  className,
}: {
  ready: ReadyState | null;
  members: PublicUser[];
  /**
   * [B2: hard timers, the server as timekeeper] The room's clock, when one is
   * running. Optional because a caller that has no clock to hand in (the
   * pier, a server with the clock switched off, a screen that drew this
   * before the deadline arrived) should be able to say so by saying nothing
   * rather than by passing a made up one.
   */
  clock?: PhaseClock | null;
  className?: string;
}) {
  if (!ready || ready.requiredUserIds.length === 0) return null;
  const byId = new Map(members.map((m) => [m.id, m]));
  const readySet = new Set(ready.readyUserIds);
  const secondsLeft = clock?.secondsLeft;
  const urgent = secondsLeft !== undefined && secondsLeft <= URGENT_SECONDS;
  // How much of the leg is left, as a whole percent, for the bar beside the
  // countdown. It shrinks rather than fills, which is the one reading that
  // says "this phase is ending" at a glance. Clamped rather than trusted: the
  // share comes off two published numbers, and a server that somehow
  // published a deadline beyond its own budget would otherwise draw a bar
  // wider than its track.
  const remainingShare =
    clock?.total && secondsLeft !== undefined && clock.total > 0
      ? Math.min(100, Math.max(0, (secondsLeft / clock.total) * 100))
      : null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-2",
        className,
      )}
    >
      <span className="text-[11px] font-semibold text-muted-foreground">
        {ready.readyUserIds.length}/{ready.requiredUserIds.length} ready
      </span>
      {clock ? (
        <span
          className={cn(
            "flex items-center gap-1.5 text-[11px] font-semibold tabular-nums",
            urgent ? "text-warn" : "text-muted-foreground",
          )}
          title="This leg ends when the clock does, whether or not every captain has readied."
        >
          <Clock className="h-3 w-3" />
          {clock.label}
          {remainingShare === null ? null : (
            <span className="h-1 w-14 overflow-hidden rounded-full bg-muted">
              <span
                className={cn(
                  "block h-full rounded-full",
                  urgent ? "bg-warn" : "bg-gain",
                )}
                style={{ width: `${remainingShare}%` }}
              />
            </span>
          )}
        </span>
      ) : null}
      <div className="flex items-center gap-1.5">
        {ready.requiredUserIds.map((id) => {
          const m = byId.get(id);
          const isReady = readySet.has(id);
          return (
            <div
              key={id}
              className="relative"
              title={`${m?.displayName ?? "Captain"} ${isReady ? "ready" : "still deciding"}`}
            >
              <Avatar
                hue={m?.avatarHue ?? 0}
                name={m?.displayName ?? "?"}
                size={24}
              />
              <span
                className={cn(
                  "absolute -bottom-1 -right-1 rounded-full p-[3px] ring-2 ring-background",
                  isReady
                    ? "bg-gain text-background"
                    : "bg-warn text-background",
                )}
              >
                {isReady ? (
                  <Check className="h-2 w-2" />
                ) : (
                  <Hourglass className="h-2 w-2" />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
