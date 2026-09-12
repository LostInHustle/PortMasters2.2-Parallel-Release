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
        online ? "bg-gain" : "bg-muted-foreground/40",
        className,
      )}
      style={{
        width: size,
        height: size,
        boxShadow: online ? "0 0 8px 1px var(--gain)" : "none",
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
  /**
   * A meaning, not a panel. A Pill says something about a number or a
   * status, so it draws from the meaning half of the palette and reads
   * the same wherever it appears. A Pill that names a thing rather than
   * a status takes its colour through className instead, so that a
   * Widget colour is never put on a status and a meaning is never put
   * on a panel heading.
   */
  tone?:
    | "default"
    | "none"
    | "gold"
    | "sea"
    | "gain"
    | "alarm"
    | "due"
    | "favor"
    | "intel";
  className?: string;
}) {
  /* Every one of these is a soft wash of its own token, so a Pill and
     the number inside it are the same colour in both modes and neither
     needs a dark variant. */
  const tones: Record<string, string> = {
    default: "bg-black/5 dark:bg-white/10 text-foreground",
    /* A Pill that names a thing rather than a status brings its own
       colour through className. Leaving the tone map out entirely is
       what keeps the two from fighting over background-color, which
       would otherwise be settled by Tailwind's own rule order rather
       than by anything visible in the markup. */
    none: "",
    gold: "bg-gold/5 text-gold-ink",
    sea: "bg-sea/5 text-sea",
    gain: "bg-gain/5 text-gain",
    alarm: "bg-alarm/5 text-alarm",
    due: "bg-due/5 text-due",
    favor: "bg-favor/5 text-favor",
    intel: "bg-intel/5 text-intel",
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
