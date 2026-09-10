"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Anchor,
  Trophy,
  Crown,
  Gem,
  Ship,
  Waves,
  TrendingUp,
  BookOpen,
  X,
  Loader2,
  Star,
  Coins,
  ChevronDown,
  Handshake,
  Skull,
} from "lucide-react";
import { api, type PublicUser } from "@/lib/api";
import type { CaptainLegacySummary } from "@/lib/game/legacy";
import type { VoyageChronicle, RivalEntry } from "@/types/realtime";
import { Avatar, Pill, MeritIcon } from "./shared";
import { Sparkline } from "./Sparkline";
import { meritById } from "@/lib/game/merits";
import { RENOWN_TITLES, renownTitleForLevel } from "@/lib/game/legacy";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { cn, formatTime } from "@/lib/utils";

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
    let cancelled = false;
    const load = async () => {
      const [legacyRes, chronRes, rivalRes] = await Promise.all([
        api.getLegacy().catch(() => ({ legacy: null, checkIn: null })),
        api.listChronicles().catch(() => ({ chronicles: [] })),
        api.listRivals().catch(() => ({ rivals: [] })),
      ]);
      if (cancelled) return;
      setData({
        legacy: legacyRes.legacy,
        chronicles: chronRes.chronicles ?? [],
        rivals: rivalRes.rivals ?? [],
      });
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const stats = useMemo(() => {
    const l = data.legacy;
    if (!l) return null;
    const totalVoyages = l.voyagesCompleted;
    const crownRate = totalVoyages > 0 ? l.seaMasterCrowns / totalVoyages : 0;
    const avgRep = totalVoyages > 0 ? Math.round(l.bestScore / 1) : 0;
    const solventStreak = l.consecutiveSolventVoyages;
    return { totalVoyages, crownRate, avgRep, solventStreak };
  }, [data.legacy]);

  if (!open) return null;

  return (
    <ModalOverlay onClose={() => onOpenChange(false)}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="pm-glass-strong pm-crackle relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl"
      >
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
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight pm-text-sea pm-truncate">
                {me.displayName}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground pm-truncate">
                @{me.username}
              </p>
              {data.legacy && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <Pill tone="gold">
                    <Star className="h-3 w-3" /> Renown{" "}
                    {data.legacy.renownLevel}
                  </Pill>
                  <Pill tone="sea">
                    {renownTitleForLevel(data.legacy.renownLevel)}
                  </Pill>
                  {data.legacy.houseId && (
                    <Pill tone="indigo">
                      <Anchor className="h-3 w-3" />{" "}
                      {data.legacy.houseId.replace(/_/g, " ")}
                    </Pill>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="pm-pressable shrink-0 rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close profile"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex shrink-0 border-b border-border/40 px-4 sm:px-6">
          {[
            { id: "stats" as const, label: "Statistics", icon: TrendingUp },
            { id: "chronicles" as const, label: "Chronicles", icon: BookOpen },
            { id: "rivals" as const, label: "Rivals", icon: Ship },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative px-4 py-3 text-sm font-medium transition-colors",
                tab === t.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="mr-1.5 inline h-4 w-4" />
              {t.label}
              {tab === t.id && (
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
      </motion.div>
    </ModalOverlay>
  );
}

function StatsTab({
  legacy,
  stats,
  chronicles,
}: {
  legacy: CaptainLegacySummary | null;
  stats: {
    totalVoyages: number;
    crownRate: number;
    avgRep: number;
    solventStreak: number;
  } | null;
  chronicles: VoyageChronicle[];
}) {
  if (!legacy || !stats) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No voyage records yet. Set sail to begin your legacy.
      </div>
    );
  }
  const merits = legacy.meritIds ?? [];
  const tiers = [
    { id: "fair_winds", name: "Fair Winds", icon: "🌤️" },
    { id: "open_waters", name: "Open Waters", icon: "🌊" },
    { id: "monsoon", name: "Monsoon", icon: "⛈️" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Key stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={Anchor}
          label="Voyages"
          value={stats.totalVoyages}
          tone="sea"
        />
        <StatTile
          icon={Crown}
          label="Sea Master"
          value={legacy.seaMasterCrowns}
          tone="gold"
        />
        <StatTile
          icon={Trophy}
          label="Best Rep"
          value={legacy.bestScore}
          tone="amber"
        />
        <StatTile
          icon={Gem}
          label="Renown XP"
          value={legacy.renownXP}
          tone="indigo"
        />
      </div>

      {/* Solvent streak and crown rate */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="pm-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Waves className="h-4 w-4" /> Solvent Streak
          </div>
          <div className="mt-1 font-display text-3xl font-bold pm-text-sea">
            {stats.solventStreak}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Consecutive voyages without bankruptcy
          </p>
        </div>
        <div className="pm-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Crown className="h-4 w-4" /> Crown Rate
          </div>
          <div className="mt-1 font-display text-3xl font-bold pm-text-gold">
            {Math.round(stats.crownRate * 100)}%
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Share of voyages won as Sea Master
          </p>
        </div>
      </div>

      {/* Per difficulty breakdown */}
      <div>
        <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          By Difficulty
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {tiers.map((t) => {
            const s = (
              legacy.statsByDifficulty as
                | Record<
                    string,
                    { crowns: number; bestScore: number } | undefined
                  >
                | undefined
            )?.[t.id];
            return (
              <div key={t.id} className="pm-glass pm-ink-hover rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xl">{t.icon}</span>
                  <span className="text-sm font-medium">{t.name}</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Crowns</span>
                    <span className="font-semibold">{s?.crowns ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Best Rep</span>
                    <span className="font-semibold">{s?.bestScore ?? 0}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Merits showcase */}
      <div>
        <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Merits ({merits.length} of 9)
        </h3>
        <div className="flex flex-wrap gap-3">
          {merits.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No merits earned yet. Complete voyages to earn them.
            </p>
          )}
          {merits.map((id) => {
            const merit = meritById(id);
            if (!merit) return null;
            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <div className="pm-glass pm-ink-hover flex w-32 flex-col items-center gap-1.5 rounded-2xl p-3 text-center">
                    <div className="pm-grad-gold flex h-10 w-10 items-center justify-center rounded-full text-white">
                      <MeritIcon id={merit.id} className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-medium leading-tight">
                      {merit.name}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold">{merit.name}</p>
                  <p className="text-xs text-muted-foreground">{merit.desc}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Recent Voyage Trends - sparklines from chronicle data */}
      {chronicles.length > 0 && (
        <div>
          <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent Voyage Trends
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TrendCard
              label="Final Reputation"
              data={chronicles.map((c) => c.finalReputation).reverse()}
              icon={Trophy}
              gradient="pm-grad-primary"
              textTone="text-teal-600 dark:text-teal-300"
            />
            <TrendCard
              label="Final Gold"
              data={chronicles.map((c) => c.finalGold).reverse()}
              icon={Coins}
              gradient="pm-grad-gold"
              textTone="text-amber-600 dark:text-amber-300"
            />
            <TrendCard
              label="Peak Reputation"
              data={chronicles.map((c) => c.peakReputation).reverse()}
              icon={TrendingUp}
              gradient="pm-grad-jade"
              textTone="text-emerald-600 dark:text-emerald-300"
            />
            <TrendCard
              label="Largest Trade"
              data={chronicles.map((c) => c.largestTrade).reverse()}
              icon={Star}
              gradient="pm-grad-amber"
              textTone="text-orange-600 dark:text-orange-300"
            />
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            {chronicles.length} recent voyage
            {chronicles.length === 1 ? "" : "s"} shown, oldest to newest
          </p>
        </div>
      )}

      {/* Renown progression */}
      <div>
        <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Renown Progression
        </h3>
        <div className="pm-glass rounded-2xl p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {renownTitleForLevel(legacy.renownLevel)}
            </span>
            <span className="text-muted-foreground">
              Level {legacy.renownLevel}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-celadon to-jade transition-all duration-500"
              style={{
                width: `${Math.min(100, (legacy.renownLevel / 21) * 100)}%`,
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {RENOWN_TITLES.map((title) => (
              <div
                key={title.minLevel}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] font-medium",
                  legacy.renownLevel >= title.minLevel
                    ? "pm-grad-gold text-amber-950"
                    : "bg-black/5 text-muted-foreground dark:bg-white/10",
                )}
              >
                {title.title}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChroniclesTab({ chronicles }: { chronicles: VoyageChronicle[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (chronicles.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-30" />
        No chronicles saved yet. Opt in to save a chronicle at the end of your
        next voyage.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {chronicles.map((c, i) => {
        const isExpanded = expandedId === c.id;
        return (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "pm-glass pm-ink-hover rounded-2xl overflow-hidden",
              isExpanded && "ring-1 ring-celadon/30",
            )}
          >
            {/* Clickable header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : c.id)}
              className="w-full p-4 text-left"
            >
              <div className="mb-2 flex items-center gap-2">
                <Pill tone="sea">{c.difficulty.replace(/_/g, " ")}</Pill>
                <Pill tone="amber">{c.rounds} rounds</Pill>
                {c.crowned && (
                  <Pill tone="gold">
                    <Crown className="h-3 w-3" /> Crowned
                  </Pill>
                )}
                {c.bankrupt && (
                  <Pill tone="rose">
                    <Skull className="h-3 w-3" /> Bankrupt
                  </Pill>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatTime(c.createdAt)}
                </span>
                <motion.span
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </motion.span>
              </div>
              <p className="font-display text-sm font-semibold pm-text-sea">
                {c.headline}
              </p>
              {!isExpanded && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {c.body}
                </p>
              )}
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="border-t border-border/30"
              >
                <div className="p-4 space-y-4">
                  {/* Full body text */}
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {c.body}
                  </p>

                  {/* Visual stats grid */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <ChronicleStat
                      icon={Trophy}
                      label="Peak Rep"
                      value={c.peakReputation}
                      tone="amber"
                    />
                    <ChronicleStat
                      icon={TrendingUp}
                      label="Final Rep"
                      value={c.finalReputation}
                      tone="sea"
                    />
                    <ChronicleStat
                      icon={Coins}
                      label="Final Gold"
                      value={c.finalGold}
                      tone="jade"
                    />
                    <ChronicleStat
                      icon={Star}
                      label="Best Trade"
                      value={c.largestTrade}
                      tone="gold"
                    />
                  </div>

                  {/* Barter and loan stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/15 p-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Handshake className="h-3.5 w-3.5" /> Lending
                      </div>
                      <div className="mt-1 text-sm">
                        <span className="font-bold text-indigo-600 dark:text-indigo-300">
                          {c.lendCount}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          loans given
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Coins className="h-3.5 w-3.5" /> Borrowing
                      </div>
                      <div className="mt-1 text-sm">
                        <span className="font-bold text-amber-600 dark:text-amber-300">
                          {c.borrowCount}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          loans taken
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Merchant rating */}
                  <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Merchant Rating
                    </div>
                    <div className="mt-0.5 text-sm font-semibold">
                      {c.merchantRating}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function ChronicleStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "sea" | "gold" | "amber" | "jade";
}) {
  const tones: Record<string, string> = {
    sea: "pm-grad-primary",
    gold: "pm-grad-gold",
    amber: "pm-grad-amber",
    jade: "pm-grad-jade",
  };
  const textTones: Record<string, string> = {
    sea: "text-teal-600 dark:text-teal-300",
    gold: "text-amber-600 dark:text-amber-300",
    amber: "text-orange-600 dark:text-orange-300",
    jade: "text-emerald-600 dark:text-emerald-300",
  };
  return (
    <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3 text-center">
      <div
        className={cn("mx-auto mb-1 inline-flex rounded-lg p-1.5", tones[tone])}
      >
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <div className={cn("font-display text-lg font-bold", textTones[tone])}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function RivalsTab({ rivals }: { rivals: RivalEntry[] }) {
  if (rivals.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Ship className="mx-auto mb-3 h-10 w-10 opacity-30" />
        No rivals yet. Sail in the same harbor as another captain to build a
        rivalry.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rivals.map((r, i) => {
        // The route already projects every line so that "wins" is the
        // viewer's and "losses" is the partner's, whichever side of the
        // original record the viewer sat on. meetings is the row count,
        // so wins + losses + ties equals it and the bar below always
        // fills exactly to the end.
        const myWins = r.wins;
        const theirWins = r.losses;
        const ties = r.ties;
        const total = r.meetings;
        const myRate = total > 0 ? Math.round((myWins / total) * 100) : 0;
        return (
          <motion.div
            key={r.partner.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="pm-glass pm-ink-hover rounded-2xl p-4"
          >
            <div className="flex items-center gap-3">
              <Avatar
                hue={r.partner.avatarHue}
                name={r.partner.displayName}
                size={40}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium pm-truncate">
                  {r.partner.displayName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {total} {total === 1 ? "meeting" : "meetings"}
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold pm-text-sea">{myWins}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-bold text-rose-500">{theirWins}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {ties} ties {myRate > 50 && <Pill tone="jade">Leading</Pill>}
                </div>
              </div>
            </div>
            {total > 0 && (
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="bg-celadon"
                  style={{ width: `${(myWins / total) * 100}%` }}
                />
                <div
                  className="bg-muted-foreground/30"
                  style={{ width: `${(ties / total) * 100}%` }}
                />
                <div
                  className="bg-rose-400"
                  style={{ width: `${(theirWins / total) * 100}%` }}
                />
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "sea" | "gold" | "amber" | "indigo";
}) {
  const tones: Record<string, string> = {
    sea: "pm-grad-primary",
    gold: "pm-grad-gold",
    amber: "pm-grad-amber",
    indigo: "pm-grad-indigo",
  };
  const textTones: Record<string, string> = {
    sea: "text-celadon",
    gold: "text-amber-600 dark:text-amber-300",
    amber: "text-orange-600 dark:text-orange-300",
    indigo: "text-indigo-600 dark:text-indigo-300",
  };
  return (
    <div className="pm-glass pm-ink-hover rounded-2xl p-3">
      <div className={cn("mb-2 inline-flex rounded-lg p-1.5", tones[tone])}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className={cn("font-display text-2xl font-bold", textTones[tone])}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function TrendCard({
  label,
  data,
  icon: Icon,
  gradient,
  textTone,
}: {
  label: string;
  data: number[];
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  textTone: string;
}) {
  const latest = data.length > 0 ? data[data.length - 1] : 0;
  const prev = data.length > 1 ? data[data.length - 2] : undefined;
  const trend = prev !== undefined ? latest - prev : 0;
  return (
    <div className="pm-glass pm-ink-hover rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("inline-flex rounded-lg p-1.5", gradient)}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
        </div>
        {prev !== undefined && trend !== 0 && (
          <span
            className={cn(
              "text-[10px] font-semibold",
              trend > 0 ? "text-emerald-500" : "text-rose-500",
            )}
          >
            {trend > 0 ? "▲" : "▼"} {Math.abs(trend)}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className={cn("font-display text-2xl font-bold", textTone)}>
          {latest}
        </div>
        {data.length > 1 && (
          <Sparkline
            data={data}
            width={80}
            height={28}
            strokeClassName="stroke-current"
            fillClassName="fill-current"
            className={cn("opacity-60", textTone)}
            showArea
            strokeWidth={1.5}
          />
        )}
      </div>
    </div>
  );
}
