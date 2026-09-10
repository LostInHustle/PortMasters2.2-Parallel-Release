"use client";

import {
  Anchor,
  Crown,
  Trophy,
  Gem,
  Shield,
  Medal,
  Waves,
  CloudLightning,
  Eye,
  type LucideIcon,
} from "lucide-react";
import type { MeritId } from "@/lib/game/merits";
import { ICONS } from "@/lib/game/constants";
import { cn } from "@/lib/utils";

export function Avatar({
  hue,
  name,
  size = 36,
  sm,
  className,
  ring,
}: {
  hue: number;
  name: string;
  /** Diameter in pixels on the narrowest screens. */
  size?: number;
  /**
   * Diameter in pixels from the small breakpoint upward. Omit it and the
   * avatar keeps one size everywhere, which is what most call sites want.
   *
   * The size is applied through custom properties rather than inline
   * width and height, because it has to change at a viewport breakpoint
   * and an inline style cannot hold a media query. See the .pm-avatar
   * rules in globals.css.
   */
  sm?: number;
  className?: string;
  ring?: boolean;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const c1 = `oklch(0.68 0.14 ${hue}deg)`;
  const c2 = `oklch(0.78 0.13 ${(hue + 40) % 360}deg)`;
  return (
    <div
      className={cn(
        "pm-avatar inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none",
        sm !== undefined && "pm-avatar-growth",
        ring && "ring-2 ring-white/70 dark:ring-white/15",
        className,
      )}
      style={
        {
          "--pm-avatar-size": `${size}px`,
          ...(sm !== undefined ? { "--pm-avatar-size-sm": `${sm}px` } : {}),
          backgroundImage: `linear-gradient(135deg, ${c1}, ${c2})`,
          boxShadow: `0 4px 12px -4px ${c1}`,
        } as React.CSSProperties
      }
      aria-hidden
    >
      {initial}
    </div>
  );
}

export function OnlineDot({
  online,
  size = 10,
  className,
}: {
  online: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full",
        online ? "bg-emerald-400" : "bg-zinc-400/60",
        className,
      )}
      style={{
        width: size,
        height: size,
        boxShadow: online ? "0 0 8px 1px oklch(0.75 0.18 150 / 0.7)" : "none",
      }}
      aria-hidden
    />
  );
}

export function Pill({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "gold" | "sea" | "jade" | "rose" | "amber" | "indigo";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "bg-black/5 dark:bg-white/10 text-foreground/70",
    gold: "bg-amber-400/15 text-amber-700 dark:text-amber-300",
    sea: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    jade: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    rose: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    amber: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    indigo: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const MERIT_ICONS: Record<MeritId, LucideIcon> = {
  first_voyage: Anchor,
  first_crown: Crown,
  king_of_silk_road: Trophy,
  renown_legend: Gem,
  iron_hull: Shield,
  century_club: Medal,
  open_water_captain: Waves,
  storm_sovereign: CloudLightning,
  eye_of_the_storm: Eye,
};

export function MeritIcon({
  id,
  className,
}: {
  id: MeritId;
  className?: string;
}) {
  const Icon = MERIT_ICONS[id];
  return <Icon className={className} aria-hidden />;
}

export function ItemIcon({
  item,
  className,
}: {
  item: string;
  className?: string;
}) {
  return (
    <span className={className} aria-hidden>
      {ICONS[item] ?? ""}
    </span>
  );
}
