"use client";

import { Button } from "@/components/ui/button";
import { ICONS } from "@/lib/game/constants/brand";
import { RECIPES } from "@/lib/game/constants/goods";
import { assignTask, fireWorker } from "@/lib/game/engine";
import { isFrostbitten } from "@/lib/game/garments";
import type { GameState, Worker } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import {
  HuePanel,
  PanelHeading,
  artisanTint,
  type PhasePanelProps,
} from "./PhaseShared";

/**
 * One artisan type aboard: the wash in its craft's hue, its people, and the
 * goods this bench can set them to. Rows carry the person's name and what
 * they are doing; the buttons under them are the tasks they could be doing.
 */
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

/**
 * The crew as the bench reads it: every artisan type aboard, in its own
 * wash, with the tasks this bench can set it to. Drawn only when there is
 * somebody to draw.
 */
export function WorkerStatus({
  rows,
  round,
  act,
}: {
  rows: {
    id: string;
    icon: string;
    label: string;
    list: Worker[];
    tasks: string[];
    cost: number;
  }[];
  round: number;
  act: PhasePanelProps["act"];
}) {
  return (
    <HuePanel tone="market" className="p-4 mb-4">
      <PanelHeading>👥 Worker Status & Tasks</PanelHeading>
      {rows.map((r) => (
        <WorkerList
          key={r.id}
          type={r.id}
          icon={r.icon}
          list={r.list}
          name={r.label}
          tasks={r.tasks}
          cost={r.cost}
          round={round}
          act={act}
        />
      ))}
    </HuePanel>
  );
}
