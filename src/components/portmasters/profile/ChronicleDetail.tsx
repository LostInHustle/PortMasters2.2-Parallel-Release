"use client";

import { VoyageChronicle } from "@/types/realtime/voyage";
import { motion } from "framer-motion";
import { Coins, Star, TrendingUp, Trophy } from "lucide-react";
import { t } from "@/lib/game/i18n";
import { merchantRatingLabel } from "@/lib/game/constants/reputation";
import { FigureTile } from "./FigureTile";
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

        {/* Visual stats grid. The labels are read here, at the composer,
            because the tile prints whatever label it is handed. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <FigureTile
            icon={Trophy}
            label={t("Peak Rep")}
            value={chronicle.peakReputation}
            tone="due"
            size="compact"
          />
          <FigureTile
            icon={TrendingUp}
            label={t("Final Rep")}
            value={chronicle.finalReputation}
            tone="sea"
            size="compact"
          />
          <FigureTile
            icon={Coins}
            label={t("Final Gold")}
            value={chronicle.finalGold}
            tone="gain"
            size="compact"
          />
          <FigureTile
            icon={Star}
            label={t("Best Trade")}
            value={chronicle.largestTrade}
            tone="gold"
            size="compact"
          />
        </div>

        <ChronicleLoans
          lendCount={chronicle.lendCount}
          borrowCount={chronicle.borrowCount}
        />

        {/* Merchant rating. The column holds the bare English label, the
            one every row written so far carries, so it is read into the
            captain's language here rather than printed as it is stored. */}
        <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {t("Merchant Rating")}
          </div>
          <div className="mt-0.5 text-sm font-semibold">
            {merchantRatingLabel(chronicle.merchantRating)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
