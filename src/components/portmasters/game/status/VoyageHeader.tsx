"use client";

import { difficultyConfig, type Difficulty } from "@/lib/game/difficulty";

/**
 * The top line of the pinned rail: how far into the voyage the captain is,
 * as a number and as a ring that fills as the rounds are sailed, and which
 * tier this harbor is being run at. Both are read at a glance and neither
 * moves, so the pair sits together above the stat grid.
 */
export function VoyageHeader({
  currentRound,
  maxRounds,
  difficulty,
}: {
  currentRound: number;
  maxRounds: number;
  difficulty: Difficulty;
}) {
  const cfg = difficultyConfig(difficulty);
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {/* Voyage progress ring */}
        {(() => {
          const progress = Math.min(1, currentRound / maxRounds);
          const radius = 8;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference * (1 - progress);
          return (
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              className="shrink-0"
            >
              <circle
                cx="10"
                cy="10"
                r={radius}
                fill="none"
                className="stroke-black/10 dark:stroke-white/10"
                strokeWidth="2"
              />
              <circle
                cx="10"
                cy="10"
                r={radius}
                fill="none"
                className="stroke-celadon"
                strokeWidth="2"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 10 10)"
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
          );
        })()}
        Voyage{" "}
        <b className="text-foreground">
          {currentRound}/{maxRounds}
        </b>
      </span>
      <span className="pm-truncate text-foreground" title={cfg.name}>
        {cfg.icon} {cfg.name}
      </span>
    </div>
  );
}
