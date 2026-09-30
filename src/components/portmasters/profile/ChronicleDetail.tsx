"use client";

import { VoyageChronicle } from "@/types/realtime/voyage";
import { motion } from "framer-motion";
import { Coins, Star, TrendingUp, Trophy } from "lucide-react";
import { ChronicleStat } from "./ChronicleStat";
import { ChronicleLoans } from "./ChronicleLoans";

export function ChronicleDetail({ chronicle }: { chronicle: VoyageChronicle }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="border-t border-border/30"
    >
      <div className="p-4 space-y-4">
        {/* Full body text */}
        <p className="text-sm text-foreground leading-relaxed">
          {chronicle.body}
        </p>

        {/* Visual stats grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ChronicleStat
            icon={Trophy}
            label="Peak Rep"
            value={chronicle.peakReputation}
            tone="due"
          />
          <ChronicleStat
            icon={TrendingUp}
            label="Final Rep"
            value={chronicle.finalReputation}
            tone="sea"
          />
          <ChronicleStat
            icon={Coins}
            label="Final Gold"
            value={chronicle.finalGold}
            tone="gain"
          />
          <ChronicleStat
            icon={Star}
            label="Best Trade"
            value={chronicle.largestTrade}
            tone="gold"
          />
        </div>

        <ChronicleLoans
          lendCount={chronicle.lendCount}
          borrowCount={chronicle.borrowCount}
        />

        {/* Merchant rating */}
        <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Merchant Rating
          </div>
          <div className="mt-0.5 text-sm font-semibold">
            {chronicle.merchantRating}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
