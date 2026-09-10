"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Crown, Star, Ship, Loader2, X } from "lucide-react";
import { api } from "@/lib/api";
import type { LeaderboardEntry } from "@/types/realtime";
import { Avatar, Pill } from "./shared";
import { cn } from "@/lib/utils";

type SortKey =
  "renownXP" | "seaMasterCrowns" | "bestScore" | "voyagesCompleted";

const SORT_OPTIONS: { key: SortKey; label: string; icon: typeof Trophy }[] = [
  { key: "renownXP", label: "Renown", icon: Star },
  { key: "seaMasterCrowns", label: "Crowns", icon: Crown },
  { key: "bestScore", label: "Best Rep", icon: Trophy },
  { key: "voyagesCompleted", label: "Voyages", icon: Ship },
];

export function LeaderboardModal({
  open,
  onOpenChange,
  myUserId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  myUserId: string;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("renownXP");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { leaderboard } = await api.getLeaderboard();
        if (cancelled) return;
        setEntries(leaderboard);
      } catch {
        // best effort
      }
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const sorted = [...entries].sort((a, b) => {
    const diff = (b[sortKey] as number) - (a[sortKey] as number);
    if (diff !== 0) return diff;
    return b.renownXP - a.renownXP;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="pm-glass-strong pm-crackle relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl"
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-border/40 p-5">
          <div className="pm-seigaiha absolute inset-0 opacity-20 pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="pm-grad-gold flex h-10 w-10 items-center justify-center rounded-xl text-amber-950">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold pm-text-gold">
                  Harbor Leaderboard
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Top captains across all voyages
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="pm-pressable rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close leaderboard"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Sort selector */}
        <div className="flex gap-1 border-b border-border/30 p-3">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortKey(opt.key)}
              className={cn(
                "pm-pressable flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-colors",
                sortKey === opt.key
                  ? "pm-grad-gold text-amber-950"
                  : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5",
              )}
            >
              <opt.icon className="h-3 w-3" />
              {opt.label}
            </button>
          ))}
        </div>

        {/* Entries */}
        <div className="flex-1 min-h-0 overflow-y-auto pm-scroll p-3">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">
                No captains have completed a voyage yet.
                <br />
                Set sail to be the first on the board.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {sorted.slice(0, 50).map((entry, i) => {
                const isMe = entry.userId === myUserId;
                return (
                  <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2",
                      isMe
                        ? "bg-teal-500/[0.08] ring-1 ring-teal-500/20"
                        : i < 3
                          ? "bg-amber-500/[0.04]"
                          : "hover:bg-black/5 dark:hover:bg-white/5",
                    )}
                  >
                    {/* Rank */}
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        i === 0
                          ? "pm-grad-gold text-amber-950"
                          : i === 1
                            ? "bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200"
                            : i === 2
                              ? "bg-orange-400/80 text-orange-950"
                              : "bg-black/8 text-muted-foreground dark:bg-white/10",
                      )}
                    >
                      {i + 1}
                    </span>
                    {/* Avatar and name */}
                    <Avatar
                      hue={entry.avatarHue}
                      name={entry.displayName}
                      size={32}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="pm-truncate text-sm font-medium">
                          {entry.displayName}
                        </span>
                        {isMe && (
                          <Pill tone="sea" className="shrink-0">
                            you
                          </Pill>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Renown {entry.renownLevel}
                        {entry.houseId && (
                          <span className="ml-1.5">
                            {entry.houseId === "jade_pavilion"
                              ? "🪷"
                              : entry.houseId === "vermilion_gate"
                                ? "🏮"
                                : "🏵️"}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Sort metric value */}
                    <div className="shrink-0 text-right">
                      <div className="font-display text-sm font-bold tabular-nums pm-text-sea">
                        {sortKey === "renownXP" && `${entry.renownXP} XP`}
                        {sortKey === "seaMasterCrowns" &&
                          `${entry.seaMasterCrowns}`}
                        {sortKey === "bestScore" && `${entry.bestScore}`}
                        {sortKey === "voyagesCompleted" &&
                          `${entry.voyagesCompleted}`}
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        {sortKey === "renownXP" && "Renown XP"}
                        {sortKey === "seaMasterCrowns" && "Crowns"}
                        {sortKey === "bestScore" && "Best Rep"}
                        {sortKey === "voyagesCompleted" && "Voyages"}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
