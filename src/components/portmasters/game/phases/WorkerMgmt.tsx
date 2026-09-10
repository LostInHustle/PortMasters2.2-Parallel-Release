"use client";

import { Button } from "@/components/ui/button";
import { ICONS, RECIPES, WAGES } from "@/lib/game/constants";
import {
  assignTask,
  fireWorker,
  getHireCost,
  hireWorker,
  startPhase2,
} from "@/lib/game/engine";
import {
  unlockedProducts,
  unlockedResources,
  unlockedWorkerTypes,
} from "@/lib/game/pools";
import type { GameState, Worker } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { itemColorResolver } from "@/lib/use-color-preference";
import { Term } from "../../Term";
import { ItemIcon } from "../../shared";
import { ReadyFooter, type PhasePanelProps } from "./PhaseShared";
import { TrendingUp } from "lucide-react";

// The wrapper that carries an artisan type's own hue to everything nested
// inside it (see the .pm-artisan-* rules in globals.css). Composed from the
// worker id rather than mapped here, so adding an artisan means adding one
// hue in the stylesheet and nothing at all in this file.
function artisanTint(id: string) {
  return `pm-artisan pm-artisan-${id}`;
}

function WorkerList({
  type,
  icon,
  list,
  name,
  tasks,
  act,
}: {
  type: string;
  icon: string;
  list: Worker[];
  name: string;
  tasks: string[];
  act: (fn: (g: GameState, logs: string[]) => void) => void;
}) {
  if (!list.length) return null;
  return (
    <div
      className={cn(
        artisanTint(type),
        "pm-artisan-wash pm-artisan-edge my-2.5 rounded-lg border-l-[3px] px-3 py-2.5",
      )}
    >
      <div className="pm-artisan-ink text-xs font-semibold">
        {icon} {name}s: {list.length}
      </div>
      {list.map((w, i) => (
        <div
          key={i}
          className="flex items-center justify-between bg-background/70 rounded-md px-3 py-1.5 my-1 text-xs border border-black/5 dark:border-white/10"
        >
          <span>
            {name} {i + 1}:{" "}
            {w.task
              ? `Working on: ${w.task}${w.isSkilled ? " (Skilled)" : ""}`
              : `Idle${w.isSkilled ? " ⭐ Skilled" : ""}`}
          </span>
          {!w.task && (
            // Quiet until you reach for it, but still edged so it reads as a
            // button. Every artisan row used to end in a solid red block,
            // which made dismissal the loudest thing on a screen that is
            // otherwise about hiring and assigning.
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] rounded border border-rose-500/25 bg-rose-500/5 text-rose-600/90 hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-600 dark:text-rose-400/90 dark:hover:text-rose-300"
              onClick={() => act((g, l) => fireWorker(g, type, i, l))}
            >
              Dismiss ({WAGES[type]}💰)
            </Button>
          )}
        </div>
      ))}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {tasks.map((t) => {
          const recipe = RECIPES[t];
          const mats = Object.entries(recipe.materials)
            .map(([m, a]) => `${ICONS[m]}${m}×${a}`)
            .join("+");
          return (
            <Button
              key={t}
              size="sm"
              variant="secondary"
              className="pm-artisan-chip h-7 px-2.5 text-[10px] rounded border"
              onClick={() => act((g, l) => assignTask(g, type, t, l))}
            >
              Make {t} (Need {mats})
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function WorkerMgmt({
  game,
  ctx,
  act,
  phaseSync,
  members,
  colorFor,
}: Pick<
  PhasePanelProps,
  "game" | "ctx" | "act" | "phaseSync" | "members" | "colorFor"
>) {
  const resolveColor = itemColorResolver(colorFor);
  // Driven by the roster rather than three hardcoded artisans, so the
  // Coppersmith and Potter a charter brings are hirable, payable, and
  // assignable the moment they unlock, with no further edits here. Each
  // type's craftable goods are derived from the recipes that name it, which
  // is also what keeps the Master's inherited weaver goods correct.
  const openProducts = unlockedProducts(game.difficulty, game.currentRound);
  const roster = unlockedWorkerTypes(game.difficulty, game.currentRound).map(
    (w) => {
      const list = game.workers[w.id] ?? [];
      const cost = getHireCost(game, w.id);
      return {
        ...w,
        list,
        cost,
        due: list.length * cost,
        tasks: openProducts.filter((p) => {
          const owner = RECIPES[p]?.worker_type;
          return owner === w.id || (w.id === "master" && owner === "weaver");
        }),
      };
    },
  );
  const totalWages = roster.reduce((sum, r) => sum + r.due, 0);
  const nW = roster.reduce((sum, r) => sum + r.list.length, 0);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-2xl font-bold text-center mb-1">
        👥 Artisan Management
      </div>
      <p className="text-center text-sm text-muted-foreground mb-4">
        💰 Current Funds: {game.money} Gold | 📦 See Inventory on the left
      </p>

      <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 p-3.5 mb-4 text-xs">
        <strong>⏱️ Production Cycle: What Happens When</strong>
        <div className="grid grid-cols-4 gap-1.5 mt-2 text-center">
          <div className="pm-grad-jade text-white rounded-md py-1.5">
            <div>📋 Now</div>
            <div className="text-[9px] opacity-90">
              Assign task
              <br />
              consume materials
            </div>
          </div>
          <div className="pm-grad-primary text-white rounded-md py-1.5">
            <div>🤝 Phase 2</div>
            <div className="text-[9px] opacity-90">Trade orders</div>
          </div>
          <div className="pm-grad-amber text-white rounded-md py-1.5">
            <div>✅ Phase 3</div>
            <div className="text-[9px] opacity-90">
              Items produced
              <br />+ wages paid
            </div>
          </div>
          <div className="bg-fuchsia-600 text-white rounded-md py-1.5">
            <div>🚢 Phase 4</div>
            <div className="text-[9px] opacity-90">Shipyard</div>
          </div>
        </div>
        <div className="mt-2 text-emerald-700 dark:text-emerald-300">
          💡 Materials consumed <strong>now</strong>. Finished goods and wage
          deductions happen at <strong>Phase 3</strong>, not instantly.
        </div>
      </div>

      <div className="rounded-xl border border-teal-500/15 bg-teal-500/[0.03] p-4 mb-4">
        <h3 className="text-center font-semibold mb-2">📦 Current Inventory</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong className="text-xs text-teal-700 dark:text-teal-300">
              Raw Materials:
            </strong>
            {unlockedResources(game.difficulty, game.currentRound).map((r) => (
              <div key={r} className="flex items-center text-[11px] py-0.5">
                <ItemIcon item={r} className="mr-1.5 h-3.5 w-3.5" />
                <span className="flex-1" style={{ color: resolveColor(r) }}>
                  {r}
                </span>
                <b style={{ color: resolveColor(r) }}>
                  {game.inventory[r] || 0}
                </b>
              </div>
            ))}
          </div>
          <div>
            <strong className="text-xs text-teal-700 dark:text-teal-300">
              Finished Goods:
            </strong>
            {openProducts.map((r) => (
              <div key={r} className="flex items-center text-[11px] py-0.5">
                <ItemIcon item={r} className="mr-1.5 h-3.5 w-3.5" />
                <span className="flex-1" style={{ color: resolveColor(r) }}>
                  {r}
                </span>
                <b style={{ color: resolveColor(r) }}>
                  {game.inventory[r] || 0}
                </b>
              </div>
            ))}
          </div>
        </div>
      </div>

      {nW > 0 && (
        <div className="rounded-xl bg-orange-500/[0.06] border border-orange-500/20 p-3.5 mb-4">
          <h3 className="text-center font-semibold mb-2 text-orange-700 dark:text-orange-300">
            💰 Pending Payroll: Deducted at Phase 3
          </h3>
          <div className="text-xs space-y-0.5">
            {roster
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
            <div className="flex justify-between border-t border-orange-500/20 pt-1 mt-1 font-bold">
              <span>💸 Total Wages Due</span>
              <span className="text-rose-600 dark:text-rose-400">
                {totalWages} Gold
              </span>
            </div>
          </div>
          {/* Wage Efficiency Indicator */}
          {(() => {
            let totalProducedValue = 0;
            let totalWagesPaid = 0;
            for (const r of roster) {
              if (r.list.length === 0) continue;
              for (const w of r.list) {
                const produced = w.producedCount ?? 0;
                if (produced > 0 && w.task) {
                  const recipe = RECIPES[w.task];
                  if (recipe) {
                    totalProducedValue += recipe.value * produced;
                  }
                }
              }
              totalWagesPaid += r.due;
            }
            if (totalProducedValue === 0) return null;
            const efficiency =
              totalWagesPaid > 0
                ? Math.round((totalProducedValue / totalWagesPaid) * 10) / 10
                : 0;
            return (
              <div className="mt-2 border-t border-orange-500/15 pt-2 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-teal-500" />
                  Wage Efficiency
                </span>
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    efficiency >= 3
                      ? "text-emerald-600 dark:text-emerald-400"
                      : efficiency >= 1.5
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-rose-600 dark:text-rose-400",
                  )}
                >
                  {efficiency}x return
                  <span className="font-normal text-muted-foreground ml-1">
                    ({totalProducedValue}g value / {totalWagesPaid}g wages)
                  </span>
                </span>
              </div>
            );
          })()}
        </div>
      )}

      <div className="rounded-xl bg-amber-500/[0.05] border border-teal-500/15 p-4 mb-4">
        <h3 className="text-center font-semibold mb-2">🔨 Hire Workers</h3>
        <div className="text-xs space-y-1 mb-3">
          {roster.map((r) => (
            <div key={r.id} className={artisanTint(r.id)}>
              <strong className="pm-artisan-ink">
                {r.icon} <Term term={r.label}>{r.label}</Term>
              </strong>
              :{" "}
              {r.tasks
                .map((t) => {
                  const mats = Object.entries(RECIPES[t]?.materials ?? {})
                    .map(([m, a]) => `${a} ${m}`)
                    .join("+");
                  return `${t}(${mats})`;
                })
                .join(" or ")}
              ,{" "}
              <span className="text-orange-600 dark:text-orange-400">
                {WAGES[r.id]} Gold/round
              </span>
            </div>
          ))}
        </div>
        {/* Each hire button wears its own craft's hue. The old three-colour
            cycle put the same saturated green on the first, fourth and
            seventh artisan, so a row of seven read as one repeating stripe
            and the colour told you nothing about which artisan you were
            about to hire. */}
        <div className="flex flex-wrap justify-center gap-2">
          {roster.map((r) => (
            <Button
              key={r.id}
              size="sm"
              variant="secondary"
              className={cn(
                artisanTint(r.id),
                "pm-artisan-chip rounded-lg border font-medium",
              )}
              onClick={() => act((g, l) => hireWorker(g, r.id, l))}
            >
              {r.icon} Hire {r.label} ({r.cost}💰/round)
            </Button>
          ))}
        </div>
      </div>

      {nW > 0 ? (
        <div className="rounded-xl border border-teal-500/15 bg-teal-500/[0.03] p-4 mb-4">
          <h3 className="text-center font-semibold mb-2">
            👥 Worker Status & Tasks
          </h3>
          {roster.map((r) => (
            <WorkerList
              key={r.id}
              type={r.id}
              icon={r.icon}
              list={r.list}
              name={r.label}
              tasks={r.tasks}
              act={act}
            />
          ))}
        </div>
      ) : null}

      <ReadyFooter
        phaseSync={phaseSync}
        members={members}
        idleLabel="✅ Complete Management, Set Sail"
        onConfirm={() => phaseSync.markReady((g, l) => startPhase2(g, ctx, l))}
      />
    </div>
  );
}
