"use client";

import type { ReadyState } from "@/lib/use-phase-sync";
import type { PublicUser } from "@/lib/api";
import { Avatar } from "../shared";
import { cn } from "@/lib/utils";
import { Check, Hourglass } from "lucide-react";

export function ReadyBar({
  ready,
  members,
  className,
}: {
  ready: ReadyState | null;
  members: PublicUser[];
  className?: string;
}) {
  if (!ready || ready.requiredUserIds.length === 0) return null;
  const byId = new Map(members.map((m) => [m.id, m]));
  const readySet = new Set(ready.readyUserIds);

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
                    ? "bg-emerald-500 text-white"
                    : "bg-amber-400 text-amber-950",
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
