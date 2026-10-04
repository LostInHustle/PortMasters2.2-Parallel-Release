"use client";

import { RECIPES } from "@/lib/game/constants/goods";
import type { Worker } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
import { PanelHeading, artisanTint } from "./PhaseShared";

/**
 * The wage bill the bench has run up: one line per artisan type owed money,
 * the total, and what the crew turned out against it.
 *
 * Payroll is money leaving the purse, so this box keeps the colour that
 * means a cost rather than wearing the Worker Management colour the rest
 * of the screen wears.
 */
export function BenchPayroll({
  rows,
  totalWages,
  duePhase,
}: {
  rows: {
    id: string;
    icon: string;
    label: string;
    cost: number;
    due: number;
    list: Worker[];
  }[];
  /** The figure the block above prints as the total, passed in rather than
      summed again here: the two used to be two accumulators over the same
      rows, and the panel printed both. */
  totalWages: number;
  /** The phase the note, the heading and the tile above name, through the
      face rather than typed, so they cannot come apart. */
  duePhase: string;
}) {
  return (
    <div className="rounded-xl bg-due/[0.06] border border-due/20 p-3.5 mb-4">
      <PanelHeading tone="text-due">
        💰 Pending Payroll: Deducted at {duePhase}
      </PanelHeading>
      <div className="text-xs space-y-0.5">
        {rows
          .filter((r) => r.due > 0)
          .map((r) => (
            <div
              key={r.id}
              className={cn(artisanTint(r.id), "flex justify-between")}
            >
              <span>
                {r.icon}{" "}
                <span className="pm-artisan-ink font-medium">
                  {r.list.length}× {r.label}
                </span>{" "}
                @ {r.cost}g
              </span>
              <b>{r.due} Gold</b>
            </div>
          ))}
        <div className="flex justify-between border-t border-due/20 pt-1 mt-1 font-bold">
          <span>💸 Total Wages Due</span>
          <span className="text-alarm">{totalWages} Gold</span>
        </div>
      </div>
      {/* Wage Efficiency Indicator */}
      {(() => {
        // What the artisans actually turned out, weighed against the
        // payroll figure already totalled for the block above. A
        // second accumulator used to sit in this loop summing r.due
        // into its own totalWagesPaid, skipping empty worker types on
        // the way: an empty type's due is zero, so it was rebuilding
        // the same number under a different name, and the panel then
        // printed both, in the denominator and in the caption beside
        // it.
        let totalProducedValue = 0;
        for (const r of rows) {
          for (const w of r.list) {
            // The recipe is asked for rather than trusted: task is a
            // RECIPES key for every hand the engine assigns, and a
            // damaged save is the one carrier a task naming no recipe
            // arrives on, which used to index the table and throw out
            // of this panel (or, for a prototype key, print NaN into a
            // caption beside real numbers).
            const recipe = w.task ? RECIPES[w.task] : undefined;
            if (recipe && w.producedCount > 0) {
              totalProducedValue += recipe.value * w.producedCount;
            }
          }
        }
        if (totalProducedValue === 0) return null;
        const efficiency =
          totalWages > 0
            ? Math.round((totalProducedValue / totalWages) * 10) / 10
            : 0;
        return (
          <div className="mt-2 border-t border-due/15 pt-2 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-sea" />
              Wage Efficiency
            </span>
            <span
              className={cn(
                "font-bold tabular-nums",
                efficiency >= 3
                  ? "text-gain"
                  : efficiency >= 1.5
                    ? "text-warn"
                    : "text-alarm",
              )}
            >
              {efficiency}x return
              <span className="font-normal text-muted-foreground ml-1">
                ({totalProducedValue}g value / {totalWages}g wages)
              </span>
            </span>
          </div>
        );
      })()}
    </div>
  );
}
