"use client";

import { Button } from "@/components/ui/button";
import { RECIPES } from "@/lib/game/constants/goods";
import {
  getHireCost,
  hireWorker,
  leavePhase,
  payrollIndex,
} from "@/lib/game/engine";
import { phaseFace } from "@/lib/game/phases";
import { unlockedProducts, unlockedWorkerTypes } from "@/lib/game/pools";
import { cn } from "@/lib/utils";
import { Term } from "../../Term";
import {
  HuePanel,
  PanelHeading,
  ReadyFooter,
  artisanTint,
  type PhasePanelProps,
} from "./PhaseShared";
import { BenchCycle } from "./BenchCycle";
import { BenchInventory } from "./BenchInventory";
import { Wardrobe } from "./WardrobePanel";
import { BenchPayroll } from "./BenchPayroll";
import { WorkerStatus } from "./WorkerList";

// The artisan bench: the second station of the Market phase, where a
// captain hires, dismisses and sets tasks (see phases/Market.tsx for why the
// two stations are one phase and why the ready vote lives here rather than
// on the port board). Titled for the station rather than for the work, so
// the strip above it and the panel below it call this place the same thing.
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
  // Driven by the roster rather than three hardcoded artisans, so the
  // Coppersmith and Potter a charter brings are hirable, payable, and
  // assignable the moment they unlock, with no further edits here. Each
  // type's craftable goods are derived from the recipes that name it, which
  // is also what keeps the Master's inherited weaver goods correct.
  const openProducts = unlockedProducts(game.difficulty, game.currentRound);
  const payroll = payrollIndex(game);
  const roster = unlockedWorkerTypes(game.difficulty, game.currentRound).map(
    (w) => {
      const list = game.workers[w.id] ?? [];
      const cost = getHireCost(game, w.id);
      return {
        ...w,
        list,
        cost,
        // The wage this type's hands are due, from the engine's own bill
        // (see payrollIndex) rather than from a hand count multiplied
        // here. A Jade Pavilion pledge waives a sponsored hand's first
        // wage, and the multiplication this replaces counted that hand
        // anyway: the payroll block below billed one wage too many and
        // the efficiency ratio under it was divided by the inflated
        // number. A type outside the engine's roster is one payWages does
        // not charge either, which is why a missing row reads as no wages
        // due rather than as a second opinion about the same absence.
        due: payroll.get(w.id)?.due ?? 0,
        // Every product has a recipe, which is what makes it a product,
        // so this lookup is read straight. The other six reads of RECIPES
        // in this project do the same.
        tasks: openProducts.filter((p) => {
          const owner = RECIPES[p].worker_type;
          return owner === w.id || (w.id === "master" && owner === "weaver");
        }),
      };
    },
  );
  const totalWages = roster.reduce((sum, r) => sum + r.due, 0);
  const nW = roster.reduce((sum, r) => sum + r.list.length, 0);
  // The phase the wage bill lands in, named through its face rather than
  // typed into the sentence below, so the note and the tile above it cannot
  // come apart.
  const duePhase = phaseFace("resolve").label;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-2xl font-bold text-center mb-1">
        👥 Artisan Bench
      </div>
      <p className="text-center text-sm text-muted-foreground mb-4">
        💰 Current Funds: {game.money} Gold | 📦 See Inventory on the left
      </p>

      <BenchCycle game={game} duePhase={duePhase} />

      <BenchInventory game={game} products={openProducts} colorFor={colorFor} />

      <Wardrobe game={game} act={act} colorFor={colorFor} />

      {nW > 0 && (
        <BenchPayroll
          rows={roster}
          totalWages={totalWages}
          duePhase={duePhase}
        />
      )}

      <HuePanel tone="market" className="p-4 mb-4">
        <PanelHeading>🔨 Hire Workers</PanelHeading>
        <div className="text-xs space-y-1 mb-3">
          {roster.map((r) => (
            <div key={r.id} className={artisanTint(r.id)}>
              <strong className="pm-artisan-ink">
                {r.icon} <Term term={r.label}>{r.label}</Term>
              </strong>
              :{" "}
              {r.tasks
                .map((t) => {
                  const mats = Object.entries(RECIPES[t].materials)
                    .map(([m, a]) => `${a} ${m}`)
                    .join("+");
                  return `${t}(${mats})`;
                })
                .join(" or ")}
              , <span className="text-due">{r.cost} Gold/round</span>
            </div>
          ))}
        </div>
        {/* Each hire button wears its own craft's hue: a three colour
            cycle puts the same saturated green on the first, fourth and
            seventh artisan, so a row of seven reads as one repeating
            stripe and the colour tells you nothing about which artisan
            you are about to hire. */}
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
      </HuePanel>

      {nW > 0 ? (
        <WorkerStatus rows={roster} round={game.currentRound} act={act} />
      ) : null}

      <ReadyFooter
        phaseSync={phaseSync}
        members={members}
        idleLabel="✅ Complete Market, Continue"
        onConfirm={() => phaseSync.markReady((g, l) => leavePhase(g, ctx, l))}
      />
    </div>
  );
}
