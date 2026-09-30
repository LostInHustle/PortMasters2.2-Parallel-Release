"use client";

import {
  RENOWN_MAX_LEVEL,
  RENOWN_TITLES,
  renownTitleForLevel,
} from "@/lib/game/legacy";
import { cn } from "@/lib/utils";

export function RenownProgression({ renownLevel }: { renownLevel: number }) {
  return (
    <div>
      <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Renown Progression
      </h3>
      <div className="pm-glass rounded-2xl p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {renownTitleForLevel(renownLevel)}
          </span>
          <span className="text-muted-foreground">Level {renownLevel}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-celadon to-jade transition-all duration-500"
            style={{
              width: `${Math.min(100, (renownLevel / RENOWN_MAX_LEVEL) * 100)}%`,
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {RENOWN_TITLES.map((title) => (
            <div
              key={title.minLevel}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-medium",
                renownLevel >= title.minLevel
                  ? "pm-grad-medal-gold"
                  : "bg-black/5 text-muted-foreground dark:bg-white/10",
              )}
            >
              {title.title}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
