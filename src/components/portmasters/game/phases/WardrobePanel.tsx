"use client";

import { Button } from "@/components/ui/button";
import {
  COLD_LEG_WARMTH,
  GARMENTS,
  RAG_SCRAP_VALUE,
} from "@/lib/game/constants/garments";
import {
  garmentWarmth,
  garmentsLayerOn,
  legIsCold,
  shortOfWarmth,
  warmthScore,
  warmthText,
  wearGarment,
} from "@/lib/game/garments";
import { crewSize } from "@/lib/game/larder";
import { itemColorResolver } from "@/lib/use-color-preference";
import { ItemIcon } from "../../shared";
import {
  HuePanel,
  PanelLabel,
  PanelNote,
  PanelStat,
  type PhasePanelProps,
} from "./PhaseShared";

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
export function Wardrobe({
  game,
  act,
  colorFor,
}: Pick<PhasePanelProps, "game" | "act" | "colorFor">) {
  if (!garmentsLayerOn(game.mode)) return null;
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
    <HuePanel tone="wardrobe" className="px-3.5 py-2.5 mb-4">
      <PanelLabel
        tone="text-wardrobe"
        note="a garment worn stays on until it wears out"
      >
        🧥 Wardrobe
      </PanelLabel>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <PanelStat
          label="This leg"
          value={cold ? "❄️ Cold" : "mild"}
          valueClassName={cold ? "text-sea" : "text-muted-foreground"}
        />
        <PanelStat
          label="Warmth"
          value={warmthText(score)}
          valueClassName={short ? "text-alarm" : "text-wardrobe"}
          suffix={
            cold && (
              <span className="text-muted-foreground">
                {" "}
                / {COLD_LEG_WARMTH} asked
              </span>
            )
          }
        />
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
        <PanelNote tone={short ? "alarm" : "muted"}>
          {short
            ? "⚠️ The crew is short of warm clothes. The cold takes the newest hand, who is out of action for the next leg."
            : "The crew is dressed for the cold this leg. The rest stay in the hold until a leg asks for more."}
        </PanelNote>
      )}
      {/* The wear buttons stand only where the leg is asking for warmth.
          Everywhere else the hold keeps the clothes, and the notes below
          say why: a garment worn is one way and wears from the day it goes
          on, so a coat put on for a mild leg is its whole life spent on a
          leg that asked for nothing. The rule itself lives in wearGarment,
          which turns the same two presses away with the same reasons. */}
      {short && crew > 0 && carried.length > 0 && (
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
      {!cold && crew > 0 && carried.length > 0 && (
        <PanelNote>
          The sea is mild this leg and asks for no warmth. The clothes wait in
          the hold for a cold leg, because a garment wears from the day it goes
          on.
        </PanelNote>
      )}
      {crew === 0 && (
        <PanelNote>
          No crew aboard, so there is nobody to wear them. Hire artisans and the
          cold starts to matter.
        </PanelNote>
      )}
      {crew > 0 && carried.length === 0 && (
        <PanelNote>
          The hold carries no clothes. Linen Clothes, Cotton Clothes and Brocade
          are made right here at the bench, and the ones the crew wears are the
          ones it cannot sell.
        </PanelNote>
      )}
      {crew > 0 && (
        <PanelNote>
          A garment the sea has worn out becomes rags and is scrapped for{" "}
          {RAG_SCRAP_VALUE} Gold. Frostbite costs the newest hand one leg of
          work rather than their place aboard.
        </PanelNote>
      )}
    </HuePanel>
  );
}
