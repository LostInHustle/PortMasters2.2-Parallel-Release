"use client";

import { TONE_WASH } from "../shared";
import { cn } from "@/lib/utils";

/** The washes a tile's chip can wear, read by name. */
type TileTone = "sea" | "gold" | "due" | "intel" | "gain";

// The five scales the tile is drawn at, written once each so a sixth
// scale cannot arrive wearing a mix of the five. The frame, the glyph,
// the number and the caption are one set per scale, and so is the
// alignment: the captain's key figures are set to their own edge and a
// voyage's own figures are centered, because those are the two places the
// game counts them, and a scale that left the alignment out would be a
// shape every caller had to remember.
//
// The two scales that take no glyph leave the chip and the glyph slots
// empty, and the chip is not drawn without a glyph to sit in it. The one
// scale that wears its glyph beside the number rather than above it says
// so in its own row, because that is an arrangement rather than a size.
const TILE_SCALES = {
  /** The key figures of a captain's own record. */
  large: {
    frame: "pm-glass pm-ink-hover rounded-2xl p-3",
    chip: "mb-2",
    icon: "h-4 w-4",
    value: "font-display text-2xl font-bold",
    caption: "text-xs text-muted-foreground",
    align: "start",
    inline: false,
  },
  /** The figures of one voyage, in a chronicle. */
  compact: {
    frame: "rounded-xl bg-black/5 dark:bg-white/5 p-3",
    chip: "mb-1",
    icon: "h-3.5 w-3.5",
    value: "font-display text-lg font-bold",
    caption: "text-[10px] text-muted-foreground",
    align: "center",
    inline: false,
  },
  /** The figure a panel counts in: the settle and conclude screens. */
  figure: {
    frame: "rounded-lg bg-black/5 dark:bg-white/5 p-2",
    chip: "",
    icon: "",
    value: "font-display text-lg font-bold",
    caption: "text-[9px] text-muted-foreground",
    align: "center",
    inline: false,
  },
  /** A cell of the pinned rail. */
  readout: {
    frame: "rounded-lg bg-black/[0.03] px-2 py-1.5 dark:bg-white/[0.05]",
    chip: "",
    icon: "",
    value: "text-[15px] font-bold leading-tight",
    caption: "text-[9px] text-muted-foreground",
    align: "center",
    inline: false,
  },
  /**
   * A captain's own key figures, in the profile popup: the glyph beside
   * the number rather than above it, because the popup leads with the
   * numbers themselves and a chip above each of them would take the
   * height the figures are read in.
   */
  profile: {
    frame: "rounded-lg bg-black/[0.03] dark:bg-white/[0.05] py-2",
    chip: "",
    icon: "h-3.5 w-3.5",
    value: "text-sm font-semibold flex items-center justify-center gap-1",
    caption: "text-[10px] text-muted-foreground mt-0.5",
    align: "center",
    inline: true,
  },
} as const;

type IconComponent = React.ComponentType<{ className?: string }>;

/**
 * The tile's props, one shape per scale. The scales that take a glyph
 * must name one and must name the wash it wears, and the scales that
 * take none must not, so a tile that would have been drawn with an empty
 * chip in it is a compile error rather than a hole in the screen.
 */
type FigureTileProps = {
  /** The name under the figure. */
  label: React.ReactNode;
  /** The figure itself. */
  value: React.ReactNode;
  /**
   * The color the figure is printed in, on the scales that print it in
   * one. The scales that take a glyph in a chip leave the figure in the
   * frame's own ink, so they do not use it. The scale that wears its
   * glyph beside the figure does, because the glyph takes the figure's
   * color with it.
   */
  valueClassName?: string;
} & (
  | {
      size: "large" | "compact";
      /** The glyph the chip wears. */
      icon: IconComponent;
      /** The wash the chip wears. */
      tone: TileTone;
      onPress?: never;
      expanded?: never;
      title?: never;
    }
  | {
      size: "profile";
      /** The glyph that sits beside the figure. */
      icon: IconComponent;
      tone?: never;
      onPress?: never;
      expanded?: never;
      title?: never;
    }
  | {
      size?: "figure";
      icon?: never;
      tone?: never;
      onPress?: never;
      expanded?: never;
      title?: never;
    }
  | {
      size: "readout";
      icon?: never;
      tone?: never;
      /** Set when the cell opens something on a press. */
      onPress?: () => void;
      /** Whether what the cell opens is showing. */
      expanded?: boolean;
      title?: string;
    }
);

/**
 * The tile a number sits in: the chip that says what the number is about,
 * the number, and the name under it.
 *
 * The captain's key figures, a voyage's own figures, the figure a panel
 * counts in and a cell of the pinned rail are one tile at four scales.
 * They had been written out three times over, and the copies had drifted:
 * a frame radius here, a caption size there, and a chip that one of them
 * wore and the others did not. The scale is a prop and not four
 * components, because a component per scale is four chances for the
 * wash, the ink and the order to drift apart.
 *
 * The scale a caller does not name is the figure, because that is the one
 * the phase screens count in and they call the tile without naming a
 * scale. The profile's two scales are named at every call site.
 */
export function FigureTile({
  size = "figure",
  icon: Icon,
  label,
  value,
  valueClassName,
  tone,
  onPress,
  expanded,
  title,
}: FigureTileProps) {
  const scale = TILE_SCALES[size];
  const centered = scale.align === "center";
  const body = (
    <>
      {/* The chip wears the wash and the ink together, so the icon inside
          inherits the color rather than being told it. The scale that
          wears its glyph beside the figure has no chip, so it draws none
          and the glyph goes into the figure's own line. */}
      {Icon && tone && !scale.inline && (
        <div
          className={cn(
            "inline-flex rounded-lg p-1.5",
            scale.chip,
            centered && "mx-auto",
            TONE_WASH[tone],
          )}
        >
          <Icon className={scale.icon} />
        </div>
      )}
      <div className={cn(scale.value, valueClassName)}>
        {Icon && scale.inline ? <Icon className={scale.icon} /> : null}
        {value}
      </div>
      <div className={scale.caption}>{label}</div>
    </>
  );
  // The rail's own cell is the same cell in a button, because it opens
  // the sentence on a tap, and the press is the only thing that changes
  // when it is one.
  if (!onPress) {
    return (
      <div className={cn(scale.frame, centered && "text-center")}>{body}</div>
    );
  }
  return (
    <button
      type="button"
      onClick={onPress}
      aria-expanded={expanded}
      title={title}
      className={cn(scale.frame, "w-full", centered && "text-center")}
    >
      {body}
    </button>
  );
}
