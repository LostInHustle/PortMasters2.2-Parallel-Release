"use client";

import { VoyageChronicle } from "@/types/realtime/voyage";
import { Coins, Star, TrendingUp, Trophy } from "lucide-react";
import { TrendCard } from "./TrendCard";

export function VoyageTrends({
  chronicles,
}: {
  chronicles: VoyageChronicle[];
}) {
  return (
    <div>
      <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Recent Voyage Trends
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TrendCard
          label="Final Reputation"
          data={chronicles.map((c) => c.finalReputation).reverse()}
          icon={Trophy}
          gradient="bg-profile/5"
          textTone="text-profile"
        />
        <TrendCard
          label="Final Gold"
          data={chronicles.map((c) => c.finalGold).reverse()}
          icon={Coins}
          gradient="bg-gold/5"
          textTone="text-gold-ink"
        />
        <TrendCard
          label="Peak Reputation"
          data={chronicles.map((c) => c.peakReputation).reverse()}
          icon={TrendingUp}
          gradient="bg-sea/5"
          textTone="text-sea"
        />
        <TrendCard
          label="Largest Trade"
          data={chronicles.map((c) => c.largestTrade).reverse()}
          icon={Star}
          gradient="bg-gain/5"
          textTone="text-gain"
        />
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        {chronicles.length} recent voyage
        {chronicles.length === 1 ? "" : "s"} shown, oldest to newest
      </p>
    </div>
  );
}
