"use client";

import { Sparkline } from "../Sparkline";
import { cn } from "@/lib/utils";

export function TrendCard({
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
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
        </div>
        {prev !== undefined && trend !== 0 && (
          <span
            className={cn(
              "text-[10px] font-semibold",
              trend > 0 ? "text-gain" : "text-alarm",
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
