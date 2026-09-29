"use client";

import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { ItemIcon } from "../../shared";

// The wrapper that carries an artisan type's own hue to everything nested
// inside it (see the .pm-artisan-* rules in globals.css). Composed from the
// worker id rather than mapped here, so adding an artisan means adding one
// hue in the stylesheet and nothing at all in this file.
//
// It sits in the shared file because the bench and the worker list it draws
// are separate modules now and both wear it.
export function artisanTint(id: string) {
  return `pm-artisan pm-artisan-${id}`;
}

/**
 * The title a phase screen leads with, at the size and weight every one of
 * them sets it: the glyph and the name, a line of margin under it, and the
 * phase's own colour. The margin and the colour are the two things a screen
 * legitimately decides for itself, so they are props.
 *
 * The brush face is optional because two screens (the artisan bench and the
 * boon draft) have never worn it, and a title that quietly grew one would
 * be a visual change dressed as a cleanup.
 */
export function PhaseHeading({
  children,
  layout = "mb-4",
  tone,
  brush = false,
}: {
  children: React.ReactNode;
  layout?: string;
  tone?: string;
  brush?: boolean;
}) {
  return (
    <div
      className={cn(
        "text-2xl font-bold",
        layout,
        brush && "font-display",
        tone,
        brush && "pm-brush",
      )}
    >
      {children}
    </div>
  );
}

/**
 * The heading of a panel that owns a board: the small title row the port
 * board, the trade manifest and the captain's exchange all open with. The
 * margin is the caller's, because the three sit under different things.
 */
export function PanelTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn("text-lg font-semibold flex items-center gap-2", className)}
    >
      {children}
    </h2>
  );
}

/**
 * The heading of a box inside a screen: the centred line the artisan bench
 * opens its four boxes with. The hue is the caller's, because the payroll
 * box keeps the colour that means a cost while the other three wear the
 * screen's own.
 */
export function PanelHeading({
  tone,
  className,
  children,
}: {
  tone?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className={cn("text-center font-semibold mb-2", tone, className)}>
      {children}
    </h3>
  );
}

// One wash per hue, read by name. Every tinted panel on these screens wears
// the same border and background at the same strength, and the only thing
// that ever differed between them was the hue: the market's, the advisor's,
// the larder's, the wardrobe's. Module Synergy is the single exception, at
// half the background, and it is recorded here rather than left inline.
const HUE_TONES = {
  market: "border-market/15 bg-market/[0.03]",
  ship: "border-ship/15 bg-ship/[0.03]",
  parley: "border-parley/15 bg-parley/[0.03]",
  advisor: "border-advisor/15 bg-advisor/[0.03]",
  pulse: "border-pulse/15 bg-pulse/[0.03]",
  depth: "border-depth/15 bg-depth/[0.03]",
  larder: "border-larder/15 bg-larder/[0.03]",
  planner: "border-planner/15 bg-planner/[0.03]",
  wardrobe: "border-wardrobe/15 bg-wardrobe/[0.03]",
  modules: "border-modules/15 bg-modules/[0.02]",
} as const;

/**
 * The tinted panel a screen puts one reading of the board in: a rounded
 * card, a faint border and fill in the hue of whatever is speaking, and the
 * box model the caller asks for. The padding is a prop because the four
 * port board panels and the wardrobe do not pick the same one, and
 * normalising them would be a layout change.
 */
export function HuePanel({
  tone,
  className = "px-3.5 py-2.5 mb-3.5",
  children,
}: {
  tone: keyof typeof HUE_TONES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border", HUE_TONES[tone], className)}>
      {children}
    </div>
  );
}

/**
 * The small label a hue panel leads with: the glyph and the name in the
 * panel's own hue, with an optional plain sentence trailing it. Four of
 * them had been written out with the same five classes and a different
 * colour word each.
 */
export function PanelLabel({
  tone,
  children,
  note,
}: {
  tone: string;
  children: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-[10px] font-semibold tracking-wide",
        tone,
        "mb-1.5",
      )}
    >
      {children}
      {note && (
        <span className="font-normal text-muted-foreground ml-1">{note}</span>
      )}
    </div>
  );
}

/**
 * The heading of a summary block: a glyph and a name in the block's own hue.
 * The three Endgame blocks had been written out with the same five classes
 * and a different colour word each, and the risk box on the settle screen
 * with the same five at a size smaller.
 */
export function SummaryHeading({
  size = "text-xs",
  tone,
  children,
}: {
  size?: string;
  tone?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(size, "font-semibold mb-2 flex items-center gap-1.5", tone)}
    >
      {children}
    </div>
  );
}

/**
 * A line under a panel: the larder is full, the hold carries no clothes, a
 * hand is out of action. One size and one indent, in either the quiet grey
 * or the alarm red, because a panel with two of these reads as a stack of
 * them.
 */
export function PanelNote({
  tone = "muted",
  className = "mt-1.5 text-[10px]",
  children,
}: {
  tone?: "muted" | "alarm";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        className,
        tone === "alarm" ? "text-alarm" : "text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}

/**
 * One figure in a row of them: the quiet name, the bold reading, and
 * whatever follows it (a ceiling, a figure it is asked to reach). The
 * larder, the two halves of the hold and the crew are six of these.
 */
export function PanelStat({
  label,
  value,
  valueClassName,
  suffix,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  valueClassName?: string;
  suffix?: React.ReactNode;
}) {
  return (
    <span className="text-[11px]">
      <span className="text-muted-foreground">{label} </span>
      <span className={cn("font-bold", valueClassName)}>{value}</span>
      {suffix}
    </span>
  );
}

/**
 * The total a panel closes on: a rule across the top, a quiet name on the
 * left and the figure on the right. The hue of the rule is the panel's, the
 * same way its opening label is.
 */
export function PanelTotal({
  tone,
  label,
  children,
}: {
  tone: string;
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-2 pt-2 border-t",
        tone,
        "flex items-center justify-between text-[11px]",
      )}
    >
      {label}
      {children}
    </div>
  );
}

/**
 * A figure and its name, in the tile the settle and conclude screens count
 * in: the risk of a raid, and the crew that came home. Six of them across
 * the two screens, all but the number and its colour the same.
 */
export function StatTile({
  value,
  valueClassName,
  label,
}: {
  value: React.ReactNode;
  valueClassName?: string;
  label: React.ReactNode;
}) {
  return (
    <div className="text-center rounded-lg bg-black/5 dark:bg-white/5 p-2">
      <div className={cn("font-display text-lg font-bold", valueClassName)}>
        {value}
      </div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}

// The broker's whispers wear the trade manifest's hue and the port board's,
// read by name. It is the same banner either way and the sentence that
// trails it is the only thing that differs, which is the one part each
// screen passes.
const INTEL_BANNER_TONES: Record<"warn" | "intel", string> = {
  warn: "border-warn/25 bg-warn/[0.06]",
  intel: "border-intel/25 bg-intel/[0.06]",
};

/**
 * The broker's whispers, as a banner: which goods a rival has already been
 * told will sell, on the two screens that can act on it. The board states
 * the promise in its own words and the manifest points at the badge below,
 * so the reading is passed and the banner is not.
 */
export function IntelBanner({
  game,
  tone,
  note,
}: {
  game: GameState;
  tone: "warn" | "intel";
  note: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border",
        INTEL_BANNER_TONES[tone],
        "px-3.5 py-2.5 mb-3.5 text-xs",
      )}
    >
      <strong>🗣️ Broker&apos;s Whispers active this round:</strong>{" "}
      {game.revealedIntel.map((i, idx) => (
        <span key={idx}>
          {idx > 0 && ", "}
          <ItemIcon item={i.item} className="h-3.5 w-3.5" /> {i.item} ({i.port})
        </span>
      ))}
      <span className="text-muted-foreground"> {note}</span>
    </div>
  );
}
