"use client";

import { Button } from "@/components/ui/button";
import { ICONS } from "@/lib/game/constants/brand";
import { RECIPES } from "@/lib/game/constants/goods";
import { assignTask, fireWorker } from "@/lib/game/engine";
import { isFrostbitten } from "@/lib/game/garments";
import { t } from "@/lib/game/i18n";
import {
  SKILLED_LEGEND,
  frozenBenchLine,
  idleBenchLine,
} from "@/lib/game/status-copy";
import type { LedgerAct } from "@/lib/game/ledger";
import type { Worker } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import {
  HuePanel,
  PanelHeading,
  artisanTint,
  type PhasePanelProps,
} from "./PhaseShared";

/**
 * The line one hand's row carries: what they are doing, or why they are
 * not doing it. Exported because the peek modal draws the same roster, and
 * a hand seen from either surface should read the same reason and the same
 * promise: the cold holds a hand for the round, not the voyage.
 *
 * The two troubled lines are composed in
 * @/lib/game/status-copy rather than here, where the frozen family's
 * remedy and the idle family's wage note are authored once for every
 * surface that carries them. This row is the surface that had lost the
 * frozen remedy its engine lines kept, which is the drift the convention
 * exists to stop.
 */
export function workerStatusLine(w: Worker, round: number): string {
  if (isFrostbitten(w, round)) return frozenBenchLine();
  return w.task
    ? w.isSkilled
      ? t("Working on: {task} (Skilled)", { task: t(w.task) })
      : t("Working on: {task}", { task: t(w.task) })
    : idleBenchLine(w.isSkilled);
}

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
      Passed in rather than looked up here, so the number displayed and the
      one fireWorker charges cannot come from different tables. */
  cost: number;
  /** The round in progress, read here so the row
      can say which hand the cold has taken. Passed in rather than pulled off
      a state this component does not hold, the same as cost above. */
  round: number;
  act: LedgerAct;
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
        {icon}{" "}
        {t("{name}{pluralS}: {count}", {
          name: t(name),
          pluralS: list.length === 1 ? "" : "s",
          count: list.length,
        })}
      </div>
      {list.map((w, i) => (
        <div
          // The hand's own name, which is what tells one hand from another
          // and what the row prints. A hand leaves the list when it is
          // dismissed and another takes its place, so a row keyed by its
          // place would be a different hand every time the list changed.
          key={w.name}
          className="flex items-center justify-between bg-background/70 rounded-md px-3 py-1.5 my-1 text-xs border border-black/5 dark:border-white/10"
        >
          {/* The row leads with the person rather than with their trade:
              the heading above already says the trade, and a bare count is
              a number said in a name's place. A name going off this list
              says something a number cannot, which it can only do if the
              name was on it.

              A hand the cold has taken says so
              where their work would have been, because that is the one
              thing that changed about them: they are still aboard, still
              eating and still on the payroll. The sentence carries the
              why and the way back as well as the state, because a row
              that only said "out of action" left the captain with no way
              to know it was the wardrobe that owed them a coat rather
              than the sea owing them a funeral. The sentence is composed in the status module,
              so this row and the voyage log give one account of the
              cold rather than two that can drift. */}
          <span>
            {w.name}
            {t(": ")}
            {workerStatusLine(w, round)}
          </span>
          {!w.task && (
            // Quiet until you reach for it, but still edged so it reads as a
            // button: a solid red block would make dismissal the loudest
            // thing on a screen that is otherwise about hiring and assigning.
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] rounded border border-alarm/25 bg-alarm/5 text-alarm hover:border-alarm/40 hover:bg-alarm/5 hover:text-alarm"
              onClick={() => act((g, l) => fireWorker(g, type, i, l))}
            >
              {t("Dismiss")}
              {t(" ({cost}💰)", { cost })}
            </Button>
          )}
        </div>
      ))}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {tasks.map((task) => {
          const recipe = RECIPES[task];
          const mats = Object.entries(recipe.materials)
            .map(([m, a]) =>
              t("{moduleIcon}{m}×{a}", { moduleIcon: ICONS[m], m: t(m), a }),
            )
            .join("+");
          return (
            <Button
              key={task}
              size="sm"
              variant="secondary"
              className="pm-artisan-chip h-7 px-2.5 text-[10px] rounded border"
              onClick={() => act((g, l) => assignTask(g, type, task, l))}
            >
              {t("Make {task} (Need {mats})", { task: t(task), mats })}
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
      <PanelHeading>{t("👥 Artisan Status & Tasks")}</PanelHeading>
      {/* The star the idle rows carry is
          explained once above them rather than in each row, and only
          while a star is on the board: the legend is a definition of a
          mark, so it belongs beside the marks rather than on every
          screen a captain opens before meeting one. */}
      {rows.some((r) => r.list.some((w) => w.isSkilled)) && (
        <p className="mb-1 px-1 text-[11px] text-muted-foreground">
          {t(SKILLED_LEGEND)}
        </p>
      )}
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
