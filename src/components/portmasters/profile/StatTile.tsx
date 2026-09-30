"use client";

import { TONE_WASH } from "../shared";
import { cn } from "@/lib/utils";

export function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "sea" | "gold" | "due" | "intel";
}) {
  return (
    <div className="pm-glass pm-ink-hover rounded-2xl p-3">
      <div className={cn("mb-2 inline-flex rounded-lg p-1.5", TONE_WASH[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
