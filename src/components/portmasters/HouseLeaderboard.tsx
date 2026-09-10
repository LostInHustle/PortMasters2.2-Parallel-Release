"use client";

import { motion } from "framer-motion";
import { Crown, Ship, Star, TrendingUp } from "lucide-react";
import type { HouseStanding } from "@/types/realtime";
import { cn } from "@/lib/utils";

/**
 * Great Houses Leaderboard. A richer view of the harbor wide house
 * standings, showing each house's rank, total crowns, voyages, and best
 * score, with visual progress bars for comparison.
 *
 * The house with the most crowns leads. Ties are broken by total
 * voyages, then by best score.
 */

const HOUSE_GRADIENTS: Record<string, string> = {
  jade_pavilion: "pm-grad-jade",
  vermilion_gate: "pm-grad-vermilion",
  golden_lotus: "pm-grad-gold",
};

const HOUSE_BARS: Record<string, string> = {
  jade_pavilion: "from-emerald-400 to-teal-500",
  vermilion_gate: "from-rose-400 to-red-500",
  golden_lotus: "from-amber-400 to-yellow-500",
};

export function HouseLeaderboard({
  standings,
  myHouseId,
}: {
  standings: HouseStanding[];
  myHouseId?: string | null;
}) {
  // Sort: most crowns, then most voyages, then best score
  const ranked = [...standings].sort((a, b) => {
    if (b.crowns !== a.crowns) return b.crowns - a.crowns;
    if (b.voyages !== a.voyages) return b.voyages - a.voyages;
    return b.bestScore - a.bestScore;
  });

  const maxCrowns = Math.max(1, ...ranked.map((s) => s.crowns));
  const maxVoyages = Math.max(1, ...ranked.map((s) => s.voyages));
  const maxBest = Math.max(1, ...ranked.map((s) => s.bestScore));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-muted-foreground">
          Harbor Leaderboard
        </h3>
        <span className="text-[10px] text-muted-foreground">
          Across all pledged captains
        </span>
      </div>

      {/* Podium for top 3 */}
      {ranked.length >= 3 && (
        <div className="flex items-end justify-center gap-2 pb-2">
          {/* 2nd place */}
          <PodiumCard
            standing={ranked[1]}
            rank={2}
            myHouseId={myHouseId}
            height="h-20"
          />
          {/* 1st place */}
          <PodiumCard
            standing={ranked[0]}
            rank={1}
            myHouseId={myHouseId}
            height="h-24"
          />
          {/* 3rd place */}
          <PodiumCard
            standing={ranked[2]}
            rank={3}
            myHouseId={myHouseId}
            height="h-16"
          />
        </div>
      )}

      {/* Detailed standings bars */}
      <div className="space-y-2">
        {ranked.map((s, i) => {
          const isMine = s.houseId === myHouseId;
          const gradient = HOUSE_GRADIENTS[s.houseId] ?? "pm-grad-primary";
          const barGradient = HOUSE_BARS[s.houseId] ?? "from-celadon to-jade";
          return (
            <motion.div
              key={s.houseId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "rounded-xl border p-3",
                isMine
                  ? "border-amber-500/40 bg-amber-500/[0.05]"
                  : "border-black/8 dark:border-white/8 bg-background/30",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    i === 0
                      ? "pm-grad-gold text-amber-950"
                      : i === 1
                        ? "bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200"
                        : i === 2
                          ? "bg-orange-400/80 text-orange-950"
                          : "bg-black/10 text-muted-foreground dark:bg-white/10",
                  )}
                >
                  {i + 1}
                </span>
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white",
                    gradient,
                  )}
                >
                  <span className="text-base">{s.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold font-display">
                      {s.name}
                    </span>
                    {isMine && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
                        Yours
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Crown className="h-2.5 w-2.5" /> {s.crowns}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Ship className="h-2.5 w-2.5" /> {s.voyages}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Star className="h-2.5 w-2.5" /> {s.bestScore}
                    </span>
                  </div>
                </div>
              </div>
              {/* Crown progress bar */}
              <div className="mt-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-black/8 dark:bg-white/8">
                  <motion.div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r",
                      barGradient,
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${(s.crowns / maxCrowns) * 100}%` }}
                    transition={{
                      duration: 0.6,
                      delay: i * 0.05,
                      ease: "easeOut",
                    }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Summary stats */}
      {ranked.length > 0 && (
        <div className="grid grid-cols-3 gap-2 border-t border-border/30 pt-3">
          <SummaryStat
            label="Total Crowns"
            value={ranked.reduce((sum, s) => sum + s.crowns, 0)}
            icon={Crown}
          />
          <SummaryStat
            label="Total Voyages"
            value={ranked.reduce((sum, s) => sum + s.voyages, 0)}
            icon={Ship}
          />
          <SummaryStat
            label="Top Score"
            value={Math.max(...ranked.map((s) => s.bestScore))}
            icon={TrendingUp}
          />
        </div>
      )}
    </div>
  );
}

function PodiumCard({
  standing,
  rank,
  myHouseId,
  height,
}: {
  standing: HouseStanding;
  rank: number;
  myHouseId?: string | null;
  height: string;
}) {
  const isMine = standing.houseId === myHouseId;
  const gradient = HOUSE_GRADIENTS[standing.houseId] ?? "pm-grad-primary";
  const rankColors: Record<number, string> = {
    1: "from-amber-300 to-yellow-500",
    2: "from-zinc-300 to-zinc-400",
    3: "from-orange-300 to-orange-500",
  };
  return (
    <div className="flex w-1/4 flex-col items-center">
      <div
        className={cn(
          "mb-1 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md",
          "bg-gradient-to-br",
          rankColors[rank],
        )}
      >
        <span className="text-sm font-bold">{rank}</span>
      </div>
      <div
        className={cn(
          "flex w-full flex-col items-center justify-end rounded-t-lg p-2 text-center",
          height,
          gradient,
          isMine && "ring-2 ring-amber-400/50",
        )}
      >
        <span className="text-lg">{standing.icon}</span>
        <span className="mt-0.5 text-[9px] font-bold leading-tight text-white">
          {standing.name}
        </span>
        <span className="text-[8px] text-white/80">
          {standing.crowns} crowns
        </span>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg bg-black/5 p-2 text-center dark:bg-white/5">
      <Icon className="mx-auto mb-0.5 h-3 w-3 text-muted-foreground" />
      <div className="font-display text-base font-bold pm-text-sea">
        {value}
      </div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}
