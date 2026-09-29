"use client";

import { cn } from "@/lib/utils";

/**
 * The four headline numbers of the pinned rail: funds, reputation, and then
 * whatever the voyage is charging the captain at this moment, which is what
 * round end will take while a voyage is under way and the ship's class
 * before it starts. A Larder cell joins them while the provisions layer is
 * running. The rail reads these every few seconds and they never scroll, so
 * they are drawn as one grid whose width follows whether that fourth cell
 * exists.
 */
export function StatGrid({
  money,
  score,
  showObligations,
  shipLevel,
  pendTotal,
  safe,
  larderOn,
  larder,
  shortRations,
}: {
  money: number;
  score: number;
  showObligations: boolean;
  shipLevel: number;
  pendTotal: number;
  safe: boolean;
  larderOn: boolean;
  larder: number;
  shortRations: boolean;
}) {
  return (
    <div
      className={cn("grid gap-1.5", larderOn ? "grid-cols-4" : "grid-cols-3")}
    >
      <Stat label="Funds" value={`${money}`} className="text-gold-ink" />
      <Stat label="Reputation" value={`${score}`} className="text-favor" />
      {showObligations ? (
        <Stat
          label="Due"
          value={`${pendTotal}`}
          className={cn(safe ? "text-foreground" : "text-alarm")}
        />
      ) : (
        <Stat label="Ship" value={`Lv ${shipLevel}`} className="text-sea" />
      )}
      {/* [C1: the Larder and Short Rations] Drawn only when the layer
          is running, so a voyage with the switch off shows the same
          three columns at the same width it always had rather than a
          fourth cell reporting a number no rule moves. The colour is
          the whole readout: the Larder's own hue while there is food
          aboard, the meaning red the moment the crew is going without,
          which is the hunger the captain is meant to notice from here
          rather than only from a log line they may have scrolled past. */}
      {larderOn && (
        <Stat
          label="Larder"
          value={`${larder}`}
          className={cn(shortRations ? "text-alarm" : "text-larder")}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg bg-black/[0.03] px-2 py-1.5 text-center dark:bg-white/[0.05]">
      <div className={cn("text-[15px] font-bold leading-tight", className)}>
        {value}
      </div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}
