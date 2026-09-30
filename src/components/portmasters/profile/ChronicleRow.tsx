"use client";

import { VoyageChronicle } from "@/types/realtime/voyage";
import { motion } from "framer-motion";
import { Anchor, ChevronDown, Crown, Skull } from "lucide-react";
import { Pill } from "../shared";
import { cn, formatTime } from "@/lib/utils";
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
          <Pill tone="sea">{chronicle.difficulty.replace(/_/g, " ")}</Pill>
          <Pill tone="due">{chronicle.rounds} rounds</Pill>
          {chronicle.crowned && (
            <Pill tone="gold">
              <Crown className="h-3 w-3" /> Crowned
            </Pill>
          )}
          {chronicle.bankrupt && (
            <Pill tone="alarm">
              <Skull className="h-3 w-3" /> Bankrupt
            </Pill>
          )}
          {chronicle.marooned && (
            <Pill tone="alarm">
              <Anchor className="h-3 w-3" /> Put ashore
            </Pill>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {formatTime(chronicle.createdAt)}
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
