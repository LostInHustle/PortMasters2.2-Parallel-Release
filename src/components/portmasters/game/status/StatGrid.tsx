"use client";

import { useState } from "react";
import { t } from "@/lib/game/i18n";
import { hungryMarkerLabel, hungryTooltip } from "@/lib/game/status-copy";
import { FigureTile } from "../../profile/FigureTile";

/**
 * The four headline numbers of the pinned rail: Gold, reputation, and then
 * whatever the voyage is charging the captain at this moment, which is what
 * round end will take while a voyage is under way and the ship's class
 * before it starts. A Larder cell joins them while the provisions layer is
 * running. The rail reads these every few seconds and they never scroll, so
 * they are drawn as one grid whose width follows whether that fourth cell
 * exists.
 *
 * The cells sit two to a row rather than four, because the rail is a rail:
 * four across the width that leaves the stage the harbor it needs gives each
 * cell about fifty pixels, and the longest label in the set ("Reputation")
 * is wider than that on its own, so every cell would break its own word in
 * half. Two rows of two cost the pinned block one row of height and read as
 * a proper readout rather than as four abbreviations.
 *
 * The cells are the one tile at its rail scale, wash, figure and caption
 * included, because the rail used to keep its own copy of that shape and
 * the larder's cell was a second copy of the copy.
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
  // The hungry cell's sentence opens on a tap,
  // which is the rail's one reveal idiom (the held cards under this grid
  // open the same way), so the why and the way back reach a touch screen
  // rather than living in a hover title.
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5">
        <FigureTile
          size="readout"
          label={t("Gold")}
          value={t("{money}", { money })}
          valueClassName="text-gold-ink"
        />
        <FigureTile
          size="readout"
          label={t("Reputation")}
          value={t("{score}", { score })}
          valueClassName="text-favor"
        />
        {showObligations ? (
          <FigureTile
            size="readout"
            label={t("Due")}
            value={`${pendTotal}`}
            valueClassName={safe ? "text-foreground" : "text-alarm"}
          />
        ) : (
          <FigureTile
            size="readout"
            label={t("Ship")}
            value={t("Lv {n}", { n: shipLevel })}
            valueClassName="text-sea"
          />
        )}
        {/* Drawn only when the layer
            is running, so a voyage with the switch off shows the same
            three columns at the same width it always had rather than a
            fourth cell reporting a number no rule moves. The cell swaps its label to the state's own words
            and opens the full sentence on a tap: color alone is a
            readout only a captain who already knows the rule can read,
            and a hover never shows on a touch screen. */}
        {larderOn &&
          (shortRations ? (
            <FigureTile
              size="readout"
              label={hungryMarkerLabel()}
              value={larder}
              valueClassName="text-alarm"
              onPress={() => setOpen((was) => !was)}
              expanded={open}
              title={hungryTooltip()}
            />
          ) : (
            <FigureTile
              size="readout"
              label={t("Larder")}
              value={t("{larder}", { larder })}
              valueClassName="text-larder"
            />
          ))}
      </div>
      {larderOn && shortRations && open && (
        <p className="mt-1 px-0.5 text-[10px] leading-snug text-muted-foreground">
          {hungryTooltip()}
        </p>
      )}
    </div>
  );
}
