"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * A lightweight SVG sparkline chart. Renders a polyline from an array
 * of numbers, scaling to fit the given width and height. No external
 * charting library, no canvas, no layout cost beyond one SVG element.
 *
 * The sparkline shows the shape of the data: trends, spikes, dips. It
 * does not show axis labels, grid lines or markers, since the point is a
 * glance read, not a precise measurement.
 *
 * Two screens draw one of these. The Purchase phase market price reference
 * shows each good's price trend across rounds, and the Captain Profile
 * dashboard shows reputation and gold flow across a voyage's rounds.
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
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  strokeClassName?: string;
  fillClassName?: string;
  showArea?: boolean;
  strokeWidth?: number;
}) {
  const { points, areaPath } = useMemo(() => {
    if (data.length === 0) {
      return { points: "", areaPath: "" };
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

    return { points: pointsStr, areaPath: areaPathStr };
  }, [data, width, height, showArea, strokeWidth]);

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "inline-flex items-center text-[9px] text-muted-foreground",
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
        className={className}
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
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {showArea && areaPath && (
        <path d={areaPath} className={fillClassName} stroke="none" />
      )}
      <polyline
        points={points}
        fill="none"
        className={strokeClassName}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
