"use client";

import { COLD_LEG_WARMTH } from "@/lib/game/constants/garments";
import { warmthText } from "@/lib/game/garments";
import { cn } from "@/lib/utils";

/* [C3: garments and the cold] The weather is readable from here in
   every phase, which is the whole point of it: a captain decides
   what to wear at the bench before the leg resolves, and the tag
   is worth nothing if it only surfaces in the settlement that has
   already happened. It is drawn on a cold leg alone, because a
   mild one asks nothing of anybody, and it wears the meaning
   colours rather than a hue of its own: the sea while the crew is
   dressed for the weather, the alarm red the moment the clothes
   on their backs are not enough. The Wardrobe panel on the bench
   prints the same sum from the same function. */
export function ColdLegChip({
  warmth,
  shortWarmth,
}: {
  warmth: number;
  shortWarmth: boolean;
}) {
  return (
    <div
      className={cn(
        "mt-2 rounded-md py-1 text-center text-[10px]",
        shortWarmth ? "bg-alarm/5 text-alarm" : "bg-sea/5 text-sea",
      )}
    >
      {shortWarmth
        ? `❄️ A cold leg: warmth ${warmthText(warmth)} of ${COLD_LEG_WARMTH}, so the cold will take a hand.`
        : `❄️ A cold leg: warmth ${warmthText(warmth)} of ${COLD_LEG_WARMTH}, and the crew is dressed for it.`}
    </div>
  );
}
