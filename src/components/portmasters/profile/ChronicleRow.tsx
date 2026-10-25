"use client";

import { VoyageChronicle } from "@/types/realtime/voyage";
import { motion } from "framer-motion";
import { Anchor, ChevronDown, Crown, Skull } from "lucide-react";
import { t } from "@/lib/game/i18n";
import { difficultyConfig } from "@/lib/game/difficulty";
import { Pill } from "../shared";
import { cn, formatTime } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language-preference";
import { ChronicleDetail } from "./ChronicleDetail";

export function ChronicleRow({
  chronicle,
  index,
  expanded,
  onToggle,
}: {
  chronicle: VoyageChronicle;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { locale } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "pm-glass pm-ink-hover rounded-2xl overflow-hidden",
        expanded && "ring-1 ring-celadon/30",
      )}
    >
      {/* Clickable header */}
      <button onClick={onToggle} className="w-full p-4 text-left">
        <div className="mb-2 flex items-center gap-2">
          {/* The tier name is read from the same table the lobby picker and
              the voyage header use, so the pill always wears the name the
              captain chose the voyage by. */}
          <Pill tone="sea">
            {t(difficultyConfig(chronicle.difficulty).name)}
          </Pill>
          <Pill tone="due">
            {t("{rounds} rounds", { rounds: chronicle.rounds })}
          </Pill>
          {chronicle.crowned && (
            <Pill tone="gold">
              <Crown className="h-3 w-3" /> {t("Crowned")}
            </Pill>
          )}
          {chronicle.bankrupt && (
            <Pill tone="alarm">
              <Skull className="h-3 w-3" /> {t("Bankrupt")}
            </Pill>
          )}
          {chronicle.marooned && (
            <Pill tone="alarm">
              <Anchor className="h-3 w-3" /> {t("Put ashore")}
            </Pill>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {formatTime(chronicle.createdAt, locale)}
          </span>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.span>
        </div>
        <p className="font-display text-sm font-semibold text-profile">
          {chronicle.headline}
        </p>
        {!expanded && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {chronicle.body}
          </p>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && <ChronicleDetail chronicle={chronicle} />}
    </motion.div>
  );
}
