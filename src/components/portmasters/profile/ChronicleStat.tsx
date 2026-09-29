"use client";

import { TONE_WASH } from "../shared";
import { cn } from "@/lib/utils";

export function ChronicleStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "sea" | "gold" | "due" | "gain";
}) {
  /* The chip wears the wash and the ink together, so the icon inside
     inherits the colour rather than being told it. */
  return (
    <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3 text-center">
      <div
        className={cn(
          "mx-auto mb-1 inline-flex rounded-lg p-1.5",
          TONE_WASH[tone],
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="font-display text-lg font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
