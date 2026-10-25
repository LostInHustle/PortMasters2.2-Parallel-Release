"use client";

import { RivalEntry } from "@/types/realtime/standings";
import { VoyageChronicle } from "@/types/realtime/voyage";
import { useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Anchor,
  Ship,
  TrendingUp,
  BookOpen,
  Loader2,
  Star,
} from "lucide-react";
import { api, type PublicUser } from "@/lib/api";
import { HOUSES } from "@/lib/game/engine";
import { t } from "@/lib/game/i18n";
import type { CaptainLegacySummary } from "@/lib/game/legacy";
import { Avatar, Pill } from "./shared";
import { HOUSE_TINT, HOUSE_TINT_FALLBACK } from "./house-colors";
import { renownTitleForLevel } from "@/lib/game/legacy";
import {
  ModalOverlay,
  ModalSheet,
  ModalClose,
} from "@/components/ui/modal-overlay";
import { cn } from "@/lib/utils";
import { StatsTab } from "./profile/StatsTab";
import { ChroniclesTab } from "./profile/ChroniclesTab";
import { RivalsTab } from "./profile/RivalsTab";

type ProfileData = {
  legacy: CaptainLegacySummary | null;
  chronicles: VoyageChronicle[];
  rivals: RivalEntry[];
};

export function CaptainProfileModal({
  open,
  onOpenChange,
  me,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  me: PublicUser;
}) {
  const [data, setData] = useState<ProfileData>({
    legacy: null,
    chronicles: [],
    rivals: [],
  });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"stats" | "chronicles" | "rivals">("stats");

  useEffect(() => {
    if (!open) return;
    let canceled = false;
    const load = async () => {
      const [legacyRes, chronRes, rivalRes] = await Promise.all([
        api.getLegacy().catch(() => ({ legacy: null, checkIn: null })),
        api.listChronicles().catch(() => ({ chronicles: [] })),
        api.listRivals().catch(() => ({ rivals: [] })),
      ]);
      if (canceled) return;
      setData({
        legacy: legacyRes.legacy,
        chronicles: chronRes.chronicles ?? [],
        rivals: rivalRes.rivals ?? [],
      });
      setLoading(false);
    };
    void load();
    return () => {
      canceled = true;
    };
  }, [open]);

  const stats = useMemo(() => {
    const l = data.legacy;
    if (!l) return null;
    const totalVoyages = l.voyagesCompleted;
    const crownRate = totalVoyages > 0 ? l.seaMasterCrowns / totalVoyages : 0;
    const solventStreak = l.consecutiveSolventVoyages;
    return { totalVoyages, crownRate, solventStreak };
  }, [data.legacy]);

  return (
    <AnimatePresence>
      {open && (
        <ModalOverlay
          label={t("{name}'s profile", { name: me.displayName })}
          onClose={() => onOpenChange(false)}
        >
          <ModalSheet maxW="max-w-3xl">
            {/* Header with avatar and title */}
            <div className="relative shrink-0 overflow-hidden border-b border-border/40 p-4 sm:p-6">
              <div className="pm-seigaiha absolute inset-0 opacity-30 pointer-events-none" />
              <div className="relative flex items-start gap-3 sm:gap-4">
                <Avatar
                  hue={me.avatarHue}
                  name={me.displayName}
                  size={48}
                  sm={64}
                  ring
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-profile pm-truncate">
                    {me.displayName}
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground pm-truncate">
                    @{me.username}
                  </p>
                  {data.legacy && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <Pill tone="gold">
                        <Star className="h-3 w-3" /> {t("Renown")}{" "}
                        {data.legacy.renownLevel}
                      </Pill>
                      <Pill tone="sea">
                        {t(renownTitleForLevel(data.legacy.renownLevel))}
                      </Pill>
                      {data.legacy.houseId && (
                        <Pill
                          tone="none"
                          className={
                            HOUSE_TINT[data.legacy.houseId] ??
                            HOUSE_TINT_FALLBACK
                          }
                        >
                          <Anchor className="h-3 w-3" />{" "}
                          {t(
                            HOUSES.find((h) => h.id === data.legacy?.houseId)
                              ?.name ?? "House",
                          )}
                        </Pill>
                      )}
                    </div>
                  )}
                </div>
                {/* The one rule the caller adds: a heading of any length
                    beside it must not squeeze the circle. */}
                <ModalClose
                  label={t("Close profile")}
                  onClick={() => onOpenChange(false)}
                  className="shrink-0"
                />
              </div>
            </div>

            {/* Tab selector. The three names are read here rather than in
                the list, and the entry parameter is renamed because the
                reader's own name is t. */}
            <div className="flex shrink-0 border-b border-border/40 px-4 sm:px-6">
              {[
                {
                  id: "stats" as const,
                  label: t("Statistics"),
                  icon: TrendingUp,
                },
                {
                  id: "chronicles" as const,
                  label: t("Chronicles"),
                  icon: BookOpen,
                },
                { id: "rivals" as const, label: t("Rivals"), icon: Ship },
              ].map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setTab(entry.id)}
                  className={cn(
                    "relative px-4 py-3 text-sm font-medium transition-colors",
                    tab === entry.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <entry.icon className="mr-1.5 inline h-4 w-4" />
                  {entry.label}
                  {tab === entry.id && (
                    <motion.div
                      layoutId="profileTab"
                      className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-celadon to-jade"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            {/* A plain scroll container, not the Radix ScrollArea, and
                for a real reason. Radix sizes its viewport at height 100%,
                and a percentage against a parent whose height comes from
                flex-1 (rather than from a height class) resolves back to
                auto. The viewport then grows to fit the content, the modal
                clips it, and nothing on the panel can be scrolled to on a
                phone. Every other scroll region in this project is a plain
                div for the same reason. */}
            <div className="pm-scroll flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
              {loading ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : tab === "stats" ? (
                <StatsTab
                  legacy={data.legacy}
                  stats={stats}
                  chronicles={data.chronicles}
                />
              ) : tab === "chronicles" ? (
                <ChroniclesTab chronicles={data.chronicles} />
              ) : (
                <RivalsTab rivals={data.rivals} />
              )}
            </div>
          </ModalSheet>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
