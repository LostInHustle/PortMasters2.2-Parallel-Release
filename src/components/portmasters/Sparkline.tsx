"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * A lightweight SVG sparkline chart. Renders a polyline from an array
 * of numbers, scaling to fit the given width and height. No external
 * charting library, no canvas, no layout cost beyond one SVG element.
 *
 * The sparkline shows the shape of the data: trends, spikes, dips. It
 * does not show axis labels or grid lines, since the point is a glance
 * read, not a precise measurement. An optional threshold line marks a
 * baseline so a captain can see at a glance whether the current value
 * is above or below average.
 *
 * Used by:
 * - The Purchase phase market price reference, showing each good's
 *   price trend across rounds.
 * - The Captain Profile dashboard, showing reputation and gold flow
 *   across a voyage's rounds.
 */

export function Sparkline({
  data,
  width = 60,
  height = 20,
  className,
  strokeClassName = "stroke-celadon",
  fillClassName = "fill-celadon/10",
  showArea = true,
  strokeWidth = 1.5,
  showDots = false,
  baseline,
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  strokeClassName?: string;
  fillClassName?: string;
  showArea?: boolean;
  strokeWidth?: number;
  showDots?: boolean;
  baseline?: number;
}) {
  const { points, areaPath, baselineY } = useMemo(() => {
    if (data.length === 0) {
      return { points: "", areaPath: "", baselineY: 0 };
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pad = strokeWidth;
    const usableH = height - pad * 2;
    const usableW = width - pad * 2;

    const stepX = data.length > 1 ? usableW / (data.length - 1) : 0;

    const coords = data.map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + usableH - ((v - min) / range) * usableH;
      return [x, y] as const;
    });

    const pointsStr = coords
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
    const areaPathStr = showArea
      ? `M ${pad},${height - pad} L ${coords
          .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
          .join(
            " L ",
          )} L ${(pad + (data.length - 1) * stepX).toFixed(1)},${height - pad} Z`
      : "";

    const bY =
      baseline !== undefined
        ? pad + usableH - ((baseline - min) / range) * usableH
        : 0;

    return { points: pointsStr, areaPath: areaPathStr, baselineY: bY };
  }, [data, width, height, showArea, strokeWidth, baseline]);

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "inline-flex items-center text-[9px] text-muted-foreground/40",
          className,
        )}
        style={{ width, height }}
      >
        N/A
      </div>
    );
  }

  if (data.length === 1) {
    return (
      <svg
        className={cn(className)}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <circle
          cx={width / 2}
          cy={height / 2}
          r={strokeWidth + 0.5}
          className={strokeClassName}
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg
      className={cn(className)}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {showArea && areaPath && (
        <path d={areaPath} className={fillClassName} stroke="none" />
      )}
      {baseline !== undefined && baselineY > 0 && baselineY < height && (
        <line
          x1={0}
          x2={width}
          y1={baselineY}
          y2={baselineY}
          className="stroke-muted-foreground/30"
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
      )}
      <polyline
        points={points}
        fill="none"
        className={strokeClassName}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {showDots &&
        data.map((_, i) => {
          const min = Math.min(...data);
          const max = Math.max(...data);
          const range = max - min || 1;
          const pad = strokeWidth;
          const usableH = height - pad * 2;
          const usableW = width - pad * 2;
          const stepX = data.length > 1 ? usableW / (data.length - 1) : 0;
          const x = pad + i * stepX;
          const y = pad + usableH - ((data[i] - min) / range) * usableH;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={strokeWidth + 0.5}
              className={strokeClassName}
              fill="currentColor"
            />
          );
        })}
    </svg>
  );
}
