"use client";

import { Button } from "@/components/ui/button";
import {
  FOODS,
  FOODS_DRAW_ORDER,
  LARDER_MAX,
  PRESERVE_MEALS_IN,
  PRESERVE_MEALS_OUT,
  RATION_PRICE,
  type FoodId,
} from "@/lib/game/constants/supplies";
import { crewSize, onShortRations, provisionFood } from "@/lib/game/larder";
import {
  foodRoomMeals,
  mealsOf,
  pantryLines,
  preserveFood,
} from "@/lib/game/foods";
import {
  cargoSlots,
  holdCapacityOn,
  storesSlots,
  usedCargoSlots,
  usedStoreSlots,
} from "@/lib/game/hold";
import { survivalLayerOn } from "@/lib/game/flags";
import { Utensils } from "lucide-react";
import {
  HuePanel,
  PanelLabel,
  PanelNote,
  PanelStat,
  type PhasePanelProps,
} from "./PhaseShared";

/**
 * What a food's row says about time and space: how densely it packs a slot
 * and how long what is aboard lasts.
 *
 * The keeping half is read from the lot rather than from the food, because
 * two captains holding the same meals of the same salt fish can be a leg
 * apart on when it turns and only their own lots know which. A food that
 * is not aboard has no age to report, so its row answers with what the
 * food keeps rather than with what this pantry holds, which is the number
 * a captain weighing the three against each other wants anyway.
 */
function keeping(food: FoodId, meals: number, legsLeft: number | null): string {
  const spec = FOODS[food];
  const density = `${spec.mealsPerSlot} ${spec.mealsPerSlot === 1 ? "meal" : "meals"} a slot`;
  if (spec.keeps === null) return `${density}, keeps forever`;
  if (meals <= 0) return `${density}, keeps ${spec.keeps} legs`;
  if (legsLeft === null) return density;
  if (legsLeft <= 0) return `${density}, turns at this Dusk`;
  return `${density}, turns after ${legsLeft} ${legsLeft === 1 ? "leg" : "legs"}`;
}

/**
 * Provisions. The Larder, the three foods, and the rations that fill it.
 *
 * The crew is the artisan roster, and this is where it eats. The panel sits
 * on the market board rather than in a corner of its own because a ration
 * is bought like anything else here, and it sits above the cards rather
 * than under them so the cost of feeding the crew is read before the purse
 * goes into goods: a captain who fills the hold and only then finds they
 * cannot feed the people who will work it was ordered into that mistake by
 * the screen rather than by a decision they made.
 *
 * It buys in legs, and a leg is the whole unit: the same one the crew eats
 * one of at each Dawn, and the same one this phase is. Asking for a leg the
 * stores have no room for or the purse cannot cover buys as much of it as
 * it can rather than refusing outright (see provisionFood), so the buttons
 * below describe what is about to happen instead of gating on it. The one
 * case that is refused is a purchase that would come to nothing, and that
 * is written on the button rather than left as a click with no answer.
 *
 * [C4: three foods, spoilage and the split hold] One row per food, and the
 * row is the whole decision the sea added: a meal costs the same whichever
 * food it is (see FOODS in ./constants), so what a captain is choosing
 * between is space and time, and the row prints both. The keeping figure
 * on a row that is aboard is read from the oldest lot of that food rather
 * than from a constant, because that is what the pantry will actually do
 * at the next Dusk. Preserving sits under the rows rather than beside them
 * because it is the one move that spends food to buy time, and it is
 * offered only when there is a whole batch of produce to spend.
 *
 * The hold's two halves are printed only when the split is on (see
 * holdCapacityOn), because they are the split: with it off there is one
 * unbounded pool for goods and the Larder's own meal ceiling for food, and
 * the header line reads exactly as it read before this feature, which is
 * the shape every part of the survival layer keeps when its switch is off.
 *
 * Runs only when the layer is on. With the switch off the panel is not
 * drawn at all, the larder is not read and no button is offered, which is
 * the base game.
 */
export function Provisions({
  game,
  act,
}: Pick<PhasePanelProps, "game" | "act">) {
  if (!survivalLayerOn(game.mode)) return null;
  const crew = crewSize(game);
  const legCost = crew * RATION_PRICE;
  const short = onShortRations(game);
  const capacity = holdCapacityOn(game.mode);
  // What a press of each button would actually buy, held to the same two
  // ceilings provisionFood applies, so the cost printed on the button is
  // the cost the captain is charged.
  const affordable = legCost > 0 ? Math.floor(game.money / legCost) : 0;
  const legsFor = (food: FoodId) =>
    crew > 0 ? Math.floor(foodRoomMeals(game, food) / crew) : 0;
  const aboard = new Map(pantryLines(game).map((line) => [line.food, line]));
  const anyRoom = FOODS_DRAW_ORDER.some((food) => legsFor(food) > 0);
  const batches = Math.floor(mealsOf(game, "Produce") / PRESERVE_MEALS_IN);

  return (
    <HuePanel tone="larder">
      <PanelLabel
        tone="text-larder"
        note="one ration a head, eaten at each Dawn"
      >
        <Utensils className="h-3.5 w-3.5" />
        Provisions
      </PanelLabel>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <PanelStat
          label="Larder"
          value={game.larder}
          valueClassName={short ? "text-alarm" : "text-larder"}
          suffix={
            !capacity && (
              <span className="text-muted-foreground"> / {LARDER_MAX}</span>
            )
          }
        />
        {capacity && (
          <>
            {/* A slot with anything in it is a slot in use, which is why the
                stores round up and the cargo, counted one unit a slot, does
                not have to (see ./hold). */}
            <PanelStat
              label="Stores"
              value={Math.ceil(usedStoreSlots(game))}
              suffix={
                <span className="text-muted-foreground">
                  {" "}
                  / {storesSlots()}
                </span>
              }
            />
            <PanelStat
              label="Cargo"
              value={usedCargoSlots(game)}
              valueClassName={short ? "text-alarm" : undefined}
              suffix={
                <span className="text-muted-foreground">
                  {" "}
                  / {cargoSlots(short)}
                </span>
              }
            />
          </>
        )}
        <PanelStat label="Crew" value={crew} />
        {crew > 0 && (
          <span className="text-[11px] text-muted-foreground">
            a leg of rations costs{" "}
            <span className="font-bold text-foreground">{legCost}</span> Gold
          </span>
        )}
      </div>
      {short && (
        <PanelNote tone="alarm">
          ⚠️ The larder is empty and the crew is working hungry: every artisan
          produces less until this is filled.
        </PanelNote>
      )}
      <div className="mt-2 space-y-1">
        {FOODS_DRAW_ORDER.map((food) => {
          const line = aboard.get(food);
          const room = legsFor(food);
          const fillLegs = Math.min(room, affordable);
          const oneLeg = Math.min(1, room, affordable);
          return (
            <div
              key={food}
              className="flex flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span className="w-32 text-[11px]">
                <span className="mr-1">{FOODS[food].icon}</span>
                <span className="font-medium">{food}</span>
                <span className="text-muted-foreground">
                  {" "}
                  {line?.meals ?? 0}
                </span>
              </span>
              <span className="w-56 text-[10px] text-muted-foreground">
                {keeping(food, line?.meals ?? 0, line?.legsLeft ?? null)}
              </span>
              {/* The buttons wear the theme's own primary rather than the
                  market fill the card buttons below wear. A fill is a widget
                  claiming a rung, and this panel already has one of its own:
                  painting its controls in the phase's green would say the
                  Larder is part of the market board rather than the fourth
                  panel on it. */}
              <Button
                size="sm"
                className="h-7 rounded-lg px-2.5 text-[11px]"
                variant={oneLeg > 0 ? "default" : "secondary"}
                disabled={oneLeg <= 0}
                onClick={() => act((g, l) => provisionFood(g, food, 1, l))}
              >
                {FOODS[food].icon} Buy{" "}
                {oneLeg > 0 ? `1 Leg (${legCost}💰)` : "Rations"}
              </Button>
              <Button
                size="sm"
                className="h-7 rounded-lg px-2.5 text-[11px]"
                variant={fillLegs > 1 ? "default" : "secondary"}
                disabled={fillLegs <= 1}
                onClick={() =>
                  act((g, l) => provisionFood(g, food, fillLegs, l))
                }
              >
                Fill
                {fillLegs > 1
                  ? ` (${fillLegs} Legs, ${fillLegs * legCost}💰)`
                  : ""}
              </Button>
            </div>
          );
        })}
      </div>
      {batches > 0 && (
        <div className="mt-2">
          <Button
            size="sm"
            className="h-7 rounded-lg px-2.5 text-[11px]"
            variant="secondary"
            onClick={() => act((g, l) => preserveFood(g, l))}
          >
            🐟 Preserve {batches * PRESERVE_MEALS_IN} Produce into{" "}
            {batches * PRESERVE_MEALS_OUT} Salt Fish
          </Button>
        </div>
      )}
      {crew === 0 && (
        <PanelNote>
          No crew aboard, so there is nobody to feed. Hire artisans and the
          larder starts to matter.
        </PanelNote>
      )}
      {crew > 0 && !anyRoom && (
        <PanelNote>
          The larder is full, so there is nothing more to buy here.
        </PanelNote>
      )}
      {crew > 0 && anyRoom && affordable === 0 && (
        <PanelNote tone="alarm">
          Not enough Gold for a leg of rations.
        </PanelNote>
      )}
    </HuePanel>
  );
}
