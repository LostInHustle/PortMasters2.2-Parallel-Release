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
  X,
  type LucideIcon,
} from "lucide-react";
import { useId } from "react";
import type { MeritId } from "@/lib/game/merits";
import { ICONS } from "@/lib/game/constants/brand";
import { t } from "@/lib/game/i18n";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

/* The wash a meaning tone wears, read by name.
 *
 * Every entry is a soft wash of its own token, so the thing wearing it
 * and the words inside it are the same color in both modes and neither
 * needs a dark variant. A Pill, the two stat tiles in the captain profile
 * and the suggestion toggle all say the same kind of thing about a number
 * and have to say it in the same color, so they read this one map.
 *
 * This covers the whole meaning half of the palette, and a surface may
 * offer a subset of it. The warn tone landed for the balance dashboard's
 * state chips, which have to say that a gate is out of band without
 * calling it an error: a mode that has not shipped yet is watched rather
 * than broken, and red would be the wrong word for it. Gold is the entry
 * that made one copy worth having.
 * It is the one tone whose words do not wear the token's own text color,
 * pairing its wash with the gold ink instead, and both the gold token and
 * the gold ink token are real ones. A copy that reached for the wrong one
 * would render in a plausible color rather than a broken one, which is
 * the kind of mistake that survives a review.
 */
export const TONE_WASH: Record<string, string> = {
  gold: "bg-gold/5 text-gold-ink",
  sea: "bg-sea/5 text-sea",
  gain: "bg-gain/5 text-gain",
  warn: "bg-warn/5 text-warn",
  alarm: "bg-alarm/5 text-alarm",
  due: "bg-due/5 text-due",
  favor: "bg-favor/5 text-favor",
  intel: "bg-intel/5 text-intel",
};

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
   * a status takes its color through className instead, so that a
   * Widget color is never put on a status and a meaning is never put
   * on a panel heading.
   */
  tone?:
    | "default"
    | "none"
    | "gold"
    | "sea"
    | "gain"
    | "warn"
    | "alarm"
    | "due"
    | "favor"
    | "intel";
  className?: string;
}) {
  /* Every one of these is a soft wash of its own token, so a Pill and
     the number inside it are the same color in both modes and neither
     needs a dark variant. */
  const tones: Record<string, string> = {
    default: "bg-black/5 dark:bg-white/10 text-foreground",
    /* A Pill that names a thing rather than a status brings its own
       color through className. Leaving the tone map out entirely is
       what keeps the two from fighting over background-color, which
       would otherwise be settled by Tailwind's own rule order rather
       than by anything visible in the markup. */
    none: "",
    ...TONE_WASH,
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

/**
 * The three podium medals, by a 1 based rank. The harbor leaderboard and
 * the Great Houses standings both draw them, and between the two they had
 * been written three ways: twice as a nested ternary over a zero based
 * index and once as a map. A rank past the podium gets no entry here, and
 * each list answers that with its own neutral chip rather than sharing one
 * fallback, because the two chips are drawn at different sizes.
 */
export const RANK_MEDALS: Record<number, string> = {
  1: "pm-grad-medal-gold",
  2: "pm-grad-medal-silver",
  3: "pm-grad-medal-bronze",
};

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

// The two tiers this label is printed at. The small one is a real tier and
// not a copy that drifted: a panel's own subhead reads a size under the
// panel's label, and a hand copy of that shape is a copy that can drift
// out of the shape it was made from.
//
// The space a label leaves under itself is the caller's and not the tier's:
// the same label heads a panel, a section of the status rail and a line on
// a header row, and each of those sits at its own depth.
const PANEL_LABEL_SIZES = {
  md: "text-[10px] font-semibold tracking-wide",
  sm: "text-[9px] font-semibold tracking-wide",
} as const;

/**
 * The small label a hue panel leads with: the glyph and the name in the
 * panel's own hue, with an optional plain sentence trailing it.
 *
 * The status rail's own section heads are this label as well, which is why
 * it lives here beside the rest of the shared kit rather than in the phase
 * panels: two folders read it and neither of them owns it.
 *
 * The element is a prop because one of these labels is a heading, the
 * vote card's own (see VoteCardShell), and a heading that quietly stops
 * being one is a heading a screen reader stops announcing.
 */
export function PanelLabel({
  tone,
  children,
  note,
  size = "md",
  className,
  as: Tag = "div",
}: {
  tone: string;
  children: React.ReactNode;
  note?: React.ReactNode;
  /** The tier the label is printed at. */
  size?: keyof typeof PANEL_LABEL_SIZES;
  className?: string;
  /** The element the label is drawn as. */
  as?: "div" | "h4" | "span";
}) {
  return (
    <Tag
      className={cn(
        "flex items-center gap-1.5",
        PANEL_LABEL_SIZES[size],
        tone,
        className,
      )}
    >
      {children}
      {note && (
        <span className="font-normal text-muted-foreground ml-1">{note}</span>
      )}
    </Tag>
  );
}

/**
 * The header cell of the two operator tables. Both are read by the same
 * person in the same sitting, so both draw their headings the same way:
 * small, uppercase, and quiet enough that the numbers under them are what
 * the eye lands on. A caller passes whatever alignment its own column
 * wants; nothing else differs between them.
 */
export function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

/**
 * A labeled form row: the label, an optional hint on the far side of it,
 * and the control underneath. It backs the field below it rather than being
 * spread across the tree, so the two cards that take a captain name and a
 * password ask for them the same way without either of them reaching past
 * the shaped field to the row it is built out of.
 */
function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {hint && (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * A Field wrapping the input both credential cards draw the same way: one
 * height, and then whatever the caller's own placeholder, type and
 * autocomplete are. Six of these sit across the two cards, which is what
 * this exists to stop them drifting apart one attribute at a time.
 *
 * The label and the input are tied together here rather than left as two
 * neighbors: without the pair of them naming the same id, clicking the
 * word "Password" lands on nothing and a screen reader announces the
 * field as an unnamed edit box. The id comes from useId, so two cards
 * stacked on one screen cannot mint the same one, and a caller that
 * passes its own id keeps it.
 */
export function CredentialField({
  label,
  hint,
  id,
  ...input
}: {
  label: string;
  hint?: string;
} & React.ComponentProps<typeof Input>) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <Field label={label} hint={hint} htmlFor={fieldId}>
      <Input id={fieldId} className="h-11" {...input} />
    </Field>
  );
}

// The two tiers the notice is printed at. The small one is a real tier and
// not a copy that drifted: a panel that reports a refused action prints it
// inside the panel, where the figure it refused is the loud part of the
// screen and the sentence beside it is not. The two carry their own shape
// rather than one shape at two sizes, because a notice that sits beside a
// press and a notice that stands on its own are not the same box.
const NOTICE_TIERS = {
  md: {
    frame: "rounded-xl border-alarm/20 py-2.5 text-sm",
    layout: "items-start gap-2.5",
    // The message stands on its own, so it is a paragraph and it takes the
    // space the press leaves it.
    body: "p",
    bodyClass: "flex-1 leading-relaxed",
    glyph: "",
    dismiss:
      "-mr-1 -mt-0.5 shrink-0 rounded-full p-1 transition-colors hover:bg-alarm/10",
  },
  sm: {
    frame: "rounded-lg border-alarm/25 py-2 text-xs",
    layout: "items-center justify-between",
    // Here the message sits beside the press, so it is a span and it wears
    // the warning glyph that says the panel is refusing something.
    body: "span",
    bodyClass: "",
    glyph: "⚠️ ",
    dismiss: "",
  },
} as const;

/**
 * The banner a screen shows when it has something to explain about the
 * session rather than about what was just typed: a ban, a deletion, a
 * demotion, a refusal. Alarmed rather than neutral because that is what it
 * always is, and dismissible when the screen has somewhere to put it away.
 *
 * No outer spacing of its own: the call site knows what it is sitting in,
 * so it passes whatever margin its own layout wants.
 */
export function Notice({
  message,
  onDismiss,
  className,
  size = "md",
}: {
  message: string;
  onDismiss?: () => void;
  className?: string;
  /** The tier the notice is printed at. */
  size?: keyof typeof NOTICE_TIERS;
}) {
  const tier = NOTICE_TIERS[size];
  const Body = tier.body;
  return (
    <div
      className={cn(
        "flex border bg-alarm/5 px-3.5 text-alarm",
        tier.frame,
        tier.layout,
        className,
      )}
    >
      <Body className={tier.bodyClass || undefined}>
        {tier.glyph}
        {message}
      </Body>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={tier.dismiss || undefined}
          title={size === "sm" ? undefined : t("Dismiss")}
          aria-label={size === "sm" ? t("Dismiss error") : t("Dismiss")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Where a refusal lands: the server's own sentence and a Dismiss press,
 * one block for every desk a refusal can arrive at, the four markets and
 * both votes, so it reads the same wherever it lands.
 *
 * The alignment and the margin are the call site's, because each desk
 * sits the line at its own spot in its layout; what is shared is the
 * sentence, the press and the tone rather than the harbor around them.
 */
export function RefusalLine({
  error,
  onDismiss,
  className,
}: {
  error: string | null | undefined;
  onDismiss: () => void;
  className: string;
}) {
  if (!error) return null;
  return (
    <p className={cn("text-[11px] text-alarm", className)}>
      {error}{" "}
      <button type="button" onClick={onDismiss} className="underline">
        {t("Dismiss")}
      </button>
    </p>
  );
}
