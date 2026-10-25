"use client";

import { Button } from "@/components/ui/button";
import { RECIPES } from "@/lib/game/constants/goods";
import {
  getHireCost,
  hireWorker,
  leavePhase,
  unlockedWorkerRoster,
  wagesDue,
} from "@/lib/game/engine";
import { t } from "@/lib/game/i18n";
import { phaseFace } from "@/lib/game/phases";
import { unlockedProducts } from "@/lib/game/pools";
import { crewSize } from "@/lib/game/types";
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
  // is also what keeps the Master's inherited weaver goods correct. The
  // hands and the wage due come off the engine's shared join (see
  // unlockedWorkerRoster), so the wage this bench bills and the wage the
  // status rail warns of are one reading; the pledge story lives there.
  const openProducts = unlockedProducts(game.difficulty, game.currentRound);
  const roster = unlockedWorkerRoster(game).map((r) => ({
    ...r,
    cost: getHireCost(game, r.id),
    // Every product has a recipe, which is what makes it a product,
    // so this lookup is read straight. The other six reads of RECIPES
    // in this project do the same.
    tasks: openProducts.filter((p) => {
      const owner = RECIPES[p].worker_type;
      return owner === r.id || (r.id === "master" && owner === "weaver");
    }),
  }));
  const totalWages = wagesDue(game);
  const nW = crewSize(game);
  // The phase the wage bill lands in, named through its face rather than
  // typed into the sentence below, so the note and the tile above it cannot
  // come apart. Read through the pack here, at the composer, because both
  // benches below print this one value inside sentences of their own.
  const duePhase = t(phaseFace("resolve").label);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-2xl font-bold text-center mb-1">
        {t("👥 Artisan Bench")}
      </div>
      <p className="text-center text-sm text-muted-foreground mb-4">
        {t(
          "💰 Current Gold: {game.money} Gold | 📦 See Inventory on the left",
          { "game.money": game.money },
        )}
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
        <PanelHeading>{t("🔨 Hire Artisans")}</PanelHeading>
        <div className="text-xs space-y-1 mb-3">
          {roster.map((r) => (
            <div key={r.id} className={artisanTint(r.id)}>
              <strong className="pm-artisan-ink">
                {r.icon} <Term term={r.label}>{t(r.label)}</Term>
              </strong>
              {t(": ")}
              {r.tasks
                .map((task) => {
                  const mats = Object.entries(RECIPES[task].materials)
                    .map(([m, a]) => t("{a} {m}", { a, m: t(m) }))
                    .join("+");
                  return t("{t}({mats})", { t: t(task), mats });
                })
                .join(t(" or "))}
              {t(", ")}
              <span className="text-due">
                {t("{cost} Gold/round", { cost: r.cost })}
              </span>
            </div>
          ))}
        </div>
        {/* Each hire button wears its own craft's hue: a three color
            cycle puts the same saturated green on the first, fourth and
            seventh artisan, so a row of seven reads as one repeating
            stripe and the color tells you nothing about which artisan
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
              {t("{icon} Hire {label} ({cost}💰/round)", {
                icon: r.icon,
                label: t(r.label),
                cost: r.cost,
              })}
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
        idleLabel={t("✅ Complete Market, Continue")}
        onConfirm={() => phaseSync.markReady((g, l) => leavePhase(g, ctx, l))}
      />
    </div>
  );
}
