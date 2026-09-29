"use client";

import { Button } from "@/components/ui/button";
import { lapPhases } from "@/lib/game/checkpoint";
import {
  COLD_LEG_WARMTH,
  GARMENTS,
  ICONS,
  RAG_SCRAP_VALUE,
  RECIPES,
} from "@/lib/game/constants";
import {
  assignTask,
  fireWorker,
  getHireCost,
  hireWorker,
  nextPhase,
} from "@/lib/game/engine";
import {
  garmentWarmth,
  garmentsLayerOn,
  isFrostbitten,
  legIsCold,
  shortOfWarmth,
  warmthScore,
  warmthText,
  wearGarment,
} from "@/lib/game/garments";
import { crewSize } from "@/lib/game/larder";
import { isLegPhase, phaseFace } from "@/lib/game/phases";
import {
  unlockedProducts,
  unlockedResources,
  unlockedWorkerTypes,
} from "@/lib/game/pools";
import type { GameState, LegPhase, Worker } from "@/lib/game/types";
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

// What the round does with what this bench sets going, in the words this
// panel uses for it. One note per phase of the leg rather than one per tile,
// because the strip below draws whichever phases this voyage still has in
// front of it and both modes dock here: written for the four it used to
// draw, the strip would have had nothing to say about the fifth, and a
// missing note is a tile a captain has to guess at.
//
// These are not the phase's face. A face says what a phase is called; this
// says what the phase does to a hold, and it belongs to the bench that
// promised the work rather than to the phase.
const CYCLE_NOTE: Record<LegPhase, string> = {
  dawn: "Draft a boon",
  market: "Assign tasks, consume materials",
  orders: "Trade orders",
  parley: "Barter with the harbor",
  resolve: "Goods produced, wages paid",
  dusk: "Shipyard and modules",
};

function WorkerList({
  type,
  icon,
  list,
  name,
  tasks,
  cost,
  round,
  act,
}: {
  type: string;
  icon: string;
  list: Worker[];
  name: string;
  tasks: string[];
  /** The wage Resolve charges for this artisan, discounts already applied.
      Passed in rather than looked up here, because the display used to read
      the raw WAGES table while fireWorker charged getHireCost. */
  cost: number;
  /** [C3: garments and the cold] The leg in progress, read here so the row
      can say which hand the cold has taken. Passed in rather than pulled off
      a state this component does not hold, the same as cost above. */
  round: number;
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
          {/* The row leads with the person rather than with their trade.
              It used to read "Weaver 3:", which is a count wearing a
              name's clothes: the heading above already says the trade,
              and the number said nothing a captain could hold on to.
              C2's whole point is that a name going off this list says
              something a number cannot, which it can only do if the name
              was on it.

              [C3: garments and the cold] A hand the cold has taken says so
              where their work would have been, because that is the one
              thing that changed about them: they are still aboard, still
              eating and still on the payroll. */}
          <span>
            {w.name}:{" "}
            {isFrostbitten(w, round)
              ? "🥶 Out of action this leg"
              : w.task
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
              className="h-6 px-2 text-[10px] rounded border border-alarm/25 bg-alarm/5 text-alarm hover:border-alarm/40 hover:bg-alarm/5 hover:text-alarm"
              onClick={() => act((g, l) => fireWorker(g, type, i, l))}
            >
              Dismiss ({cost}💰)
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

// The Wardrobe. The clothes the crew wears into the cold.
//
// [C3: garments and the cold] It sits on the artisan bench rather than on
// the port board, and the reason is the inventory block above it: this is
// the one screen where a captain sees the crew and the hold together, and
// the goods this panel draws from are the finished goods that block already
// lists. Nothing here is bought or sold, which is the other half of the
// reason it is not a market board panel: a garment reaches the wardrobe by
// being made at this bench, and the plan's own sentence about the Loom path
// is that there is no other way to get one.
//
// The panel is the whole of the durability mechanic a captain reads, and it
// is deliberately not a bar. What it prints is the multiplier the plan asks
// for: what each worn garment is worth today and what the crew's total comes
// to against what this leg asks. The decision is the button, and the line
// under the heading says what pressing it commits to, because a garment that
// goes on stays on until the sea has had it.
//
// Runs only when the layer is on. With the switch off the panel is not
// drawn, the wardrobe is not read and no button is offered, which is the
// base game.
function Wardrobe({
  game,
  act,
  colorFor,
}: Pick<PhasePanelProps, "game" | "act" | "colorFor">) {
  if (!garmentsLayerOn()) return null;
  const resolveColor = itemColorResolver(colorFor);
  const crew = crewSize(game);
  const worn = game.garments ?? [];
  const score = warmthScore(game);
  const cold = legIsCold(game);
  const short = shortOfWarmth(game);
  // The grades the hold actually carries, in the catalogue's own order, so
  // the button a captain reaches for is where it was last leg rather than
  // wherever the hold happens to have put it.
  const carried = Object.keys(GARMENTS).filter(
    (good) => (game.inventory[good] || 0) > 0,
  );

  return (
    <div className="rounded-xl border border-wardrobe/15 bg-wardrobe/[0.03] px-3.5 py-2.5 mb-4">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-wardrobe mb-1.5">
        🧥 Wardrobe
        <span className="font-normal text-muted-foreground ml-1">
          a garment worn stays on until it wears out
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="text-[11px]">
          <span className="text-muted-foreground">This leg </span>
          <span
            className={cn(
              "font-bold",
              cold ? "text-sea" : "text-muted-foreground",
            )}
          >
            {cold ? "❄️ Cold" : "mild"}
          </span>
        </span>
        <span className="text-[11px]">
          <span className="text-muted-foreground">Warmth </span>
          <span
            className={cn("font-bold", short ? "text-alarm" : "text-wardrobe")}
          >
            {warmthText(score)}
          </span>
          {cold && (
            <span className="text-muted-foreground">
              {" "}
              / {COLD_LEG_WARMTH} asked
            </span>
          )}
        </span>
        {/* Each worn garment's own number, which is the multiplier itself:
            a fresh Brocade is three, and a Brocade three cold legs old is
            less. Nothing here is a durability meter. */}
        {worn.map((garment, i) => (
          <span
            key={`${garment.good}-${i}`}
            className="flex items-center gap-1 text-[11px]"
          >
            <ItemIcon item={garment.good} className="h-3.5 w-3.5" />
            <span style={{ color: resolveColor(garment.good) }}>
              {garment.good}
            </span>
            <b className="text-wardrobe">
              {warmthText(garmentWarmth(garment))}
            </b>
          </span>
        ))}
      </div>
      {cold && crew > 0 && (
        <div
          className={cn(
            "mt-1.5 text-[10px]",
            short ? "text-alarm" : "text-muted-foreground",
          )}
        >
          {short
            ? "⚠️ The crew is short of warm clothes. The cold takes the newest hand, who is out of action for the next leg."
            : "The crew is dressed for the cold this leg."}
        </div>
      )}
      {crew > 0 && carried.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {/* The panel's own hue rather than the bench's, on the same
              reasoning the Provisions panel's buttons carry at the port:
              painting these in the artisan chip colour would say a garment
              is part of the trade it came from. */}
          {carried.map((good) => (
            <Button
              key={good}
              size="sm"
              className="rounded-lg"
              onClick={() => act((g, l) => wearGarment(g, good, l))}
            >
              🧥 Wear {good} ({game.inventory[good]} in the hold,{" "}
              {GARMENTS[good].warmth} warmth)
            </Button>
          ))}
        </div>
      )}
      {crew === 0 && (
        <div className="mt-1.5 text-[10px] text-muted-foreground">
          No crew aboard, so there is nobody to wear them. Hire artisans and the
          cold starts to matter.
        </div>
      )}
      {crew > 0 && carried.length === 0 && (
        <div className="mt-1.5 text-[10px] text-muted-foreground">
          The hold carries no clothes. Linen Clothes, Cotton Clothes and Brocade
          are made right here at the bench, and the ones the crew wears are the
          ones it cannot sell.
        </div>
      )}
      {crew > 0 && (
        <div className="mt-1.5 text-[10px] text-muted-foreground">
          A garment the sea has worn out becomes rags and is scrapped for{" "}
          {RAG_SCRAP_VALUE} Gold. Frostbite costs the newest hand one leg of
          work rather than their place aboard.
        </div>
      )}
    </div>
  );
}

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
  // The rest of this voyage's round, from this phase to the one that closes
  // it, off the room's own lap (see src/lib/game/checkpoint.ts and
  // src/lib/game/mode.ts). The two modes run Market, Orders and Parley in
  // different orders, so a strip written out here would walk one mode
  // through the other mode's round.
  const lap = lapPhases(game.mode).filter(isLegPhase);
  const seat = lap.indexOf("market");
  const cycle = seat === -1 ? lap : lap.slice(seat);
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

      <div className="rounded-xl bg-market/[0.06] border border-market/20 p-3.5 mb-4 text-xs">
        <strong>⏱️ Production Cycle: What Happens When</strong>
        {/* One tile per phase the round still has in front of it, each
            wearing the colour of the phase it names, so the strip is a map
            of this voyage's round rather than four unrelated swatches. It
            used to be four tiles numbered one to four, which was the old
            numbered vocabulary, in one mode's order, on a strip both modes
            dock at. */}
        <div className="flex gap-1.5 mt-2 text-center">
          {cycle.map((p, i) => {
            const face = phaseFace(p);
            return (
              <div
                key={p}
                className={cn(
                  "flex-1 rounded-md py-1.5",
                  face.gradient,
                  i === 0 && "ring-1 ring-foreground/25",
                )}
              >
                <div>{i === 0 ? "📋 Now" : `${face.icon} ${face.label}`}</div>
                <div className="text-[9px] opacity-90">{CYCLE_NOTE[p]}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-gain">
          💡 Materials consumed <strong>now</strong>. Finished goods and wage
          deductions happen at <strong>{duePhase}</strong>, not instantly.
        </div>
      </div>

      <div className="rounded-xl border border-ship/15 bg-ship/[0.03] p-4 mb-4">
        <h3 className="text-center font-semibold mb-2">📦 Current Inventory</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong className="text-xs text-ship">Raw Materials:</strong>
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
            <strong className="text-xs text-ship">Finished Goods:</strong>
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

      <Wardrobe game={game} act={act} colorFor={colorFor} />

      {/* Payroll is money leaving the purse, so this box keeps the colour
          that means a cost rather than wearing the Worker Management
          colour the rest of the screen wears. */}
      {nW > 0 && (
        <div className="rounded-xl bg-due/[0.06] border border-due/20 p-3.5 mb-4">
          <h3 className="text-center font-semibold mb-2 text-due">
            💰 Pending Payroll: Deducted at {duePhase}
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
            for (const r of roster) {
              for (const w of r.list) {
                if (w.producedCount > 0 && w.task) {
                  totalProducedValue += RECIPES[w.task].value * w.producedCount;
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
      )}

      <div className="rounded-xl border border-market/15 bg-market/[0.03] p-4 mb-4">
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
        {/* Each hire button wears its own craft's hue. The old three colour
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
        <div className="rounded-xl border border-market/15 bg-market/[0.03] p-4 mb-4">
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
              cost={r.cost}
              round={game.currentRound}
              act={act}
            />
          ))}
        </div>
      ) : null}

      <ReadyFooter
        phaseSync={phaseSync}
        members={members}
        idleLabel="✅ Complete Market, Continue"
        onConfirm={() => phaseSync.markReady((g, l) => nextPhase(g, ctx, l))}
      />
    </div>
  );
}
