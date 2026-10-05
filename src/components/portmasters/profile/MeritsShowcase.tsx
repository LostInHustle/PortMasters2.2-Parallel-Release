"use client";

import { MeritIcon } from "../shared";
import { meritById } from "@/lib/game/merits";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SectionHeading } from "./SectionHeading";

export function MeritsShowcase({ meritIds }: { meritIds: string[] }) {
  return (
    <div>
      <SectionHeading>Merits ({meritIds.length} of 9)</SectionHeading>
      <div className="flex flex-wrap gap-3">
        {meritIds.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No merits earned yet. Complete voyages to earn them.
          </p>
        )}
        {meritIds.map((id) => {
          const merit = meritById(id);
          if (!merit) return null;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <div className="pm-glass pm-ink-hover flex w-32 flex-col items-center gap-1.5 rounded-2xl p-3 text-center">
                  <div className="pm-grad-profile flex h-10 w-10 items-center justify-center rounded-full">
                    <MeritIcon id={merit.id} className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-medium leading-tight">
                    {merit.name}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold">{merit.name}</p>
                <p className="text-xs text-muted-foreground">{merit.desc}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
