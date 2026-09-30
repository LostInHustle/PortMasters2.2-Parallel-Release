"use client";

// =====================================================================
// The figures the lobby's masthead reads off: one cell of the gauge row,
// and the hairline the row divides itself with.
//
// The row is three cells side by side, so the cell's shape lives here
// rather than three times over in the markup: one icon at one size, one
// quiet label, one tabular figure. A call site picks the icon and its
// colour and nothing else. It is the figure half of the argument
// ./CardHead makes for the headings above them.
// =====================================================================

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// One cell of the masthead's gauge row. Three of these sit side by side under
// a hairline, so the shape lives here rather than three times over in the
// markup: one icon at one size, one quiet label, one tabular figure. A call
// site picks the icon and its colour and nothing else.
export function Gauge({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon className={cn("h-3.5 w-3.5", tone)} />
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <b className="text-[11px] tabular-nums">{value}</b>
    </span>
  );
}

// The hairline the gauge row divides itself with.
export function GaugeRule() {
  return <span className="h-4 w-px shrink-0 bg-black/10 dark:bg-white/15" />;
}
