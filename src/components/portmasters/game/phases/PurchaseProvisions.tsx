"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CREW_LOSS_AFTER_HUNGRY_LEGS } from "@/lib/game/constants/crew";
import {
  FOODS,
  FOODS_DRAW_ORDER,
  LARDER_MAX,
  PRESERVE_MEALS_IN,
  PRESERVE_MEALS_OUT,
  RATION_PRICE,
  type FoodId,
} from "@/lib/game/constants/supplies";
import {
  cargoCapacity,
  crewSize,
  onShortRations,
  provisionFood,
} from "@/lib/game/larder";
import {
  foodRoomMeals,
  mealsOf,
  pantryLines,
  preserveFood,
} from "@/lib/game/foods";
import {
  holdCapacityOn,
  storesSlots,
  usedCargoSlots,
  usedStoreSlots,
} from "@/lib/game/hold";
import { survivalLayerOn } from "@/lib/game/flags";
import {
  bargeLeftAtPort,
  bargePortAtLeg,
  bargeRationPrice,
  buyFromBarge,
} from "@/lib/game/engine";
import { Utensils } from "lucide-react";
import { FoldRow } from "../FoldRow";
import {
  HuePanel,
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
 * [E1: the Supply Barge] One row at the foot of the panel is not a port
 * counter at all: the anonymous vendor the plan builds as the fallback for
 * a table that never took the Quartermaster. It is drawn here rather than
 * on a board of its own because it is the same decision one rung worse,
 * and a captain should meet it while looking at the prices it is worse
 * than. Everything on the row is read from the voyage's own numbers and
 * from the constants, and what a press would buy is held to the same three
 * ceilings the sale applies, so the row describes what is about to happen
 * exactly as the food rows above it do.
 *
 * Runs only when the layer is on. With the switch off the panel is not
 * drawn at all, the larder is not read and no button is offered, which is
 * the base game.
 */
export function Provisions({
  game,
  act,
}: Pick<PhasePanelProps, "game" | "act">) {
  const [bargeFoldOpen, setBargeFoldOpen] = useState(false);
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
  // [E1: the Supply Barge] The fallback, read the way the rows above are:
  // the port and the lot come off the voyage's own numbers, the price off
  // the constants, and what a press would actually buy is held to the same
  // three ceilings the sale applies, so the cost on the button is the cost
  // the captain is charged.
  const bargePort = bargePortAtLeg(game);
  const bargePrice = bargeRationPrice();
  const bargeLeft = bargeLeftAtPort(game);
  // A ration is a meal of grain and a slot of grain is a meal (see FOODS in
  // ./constants), so the stores' room in meals is the room in rations and
  // there is no second conversion to get wrong here.
  const bargeRoom = Math.max(0, foodRoomMeals(game, "Grain"));
  const bargePurse = bargePrice > 0 ? Math.floor(game.money / bargePrice) : 0;
  const bargeOpen = crew > 0 && bargeLeft > 0;
  const bargeOne = bargeOpen
    ? Math.min(1, bargeLeft, bargeRoom, bargePurse)
    : 0;
  const bargeLot = bargeOpen ? Math.min(bargeLeft, bargeRoom, bargePurse) : 0;

  return (
    <HuePanel tone="larder">
      {/* The stats live on the header row (W4): the label, the one line
          that says what the panel is, and the five figures a captain
          checks before buying were two stacked rows that said one thing,
          and the panel that leads with its numbers is the shape every
          other desk on this screen already wears. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-larder">
          <Utensils className="h-3.5 w-3.5" />
          Provisions
          <span className="font-normal text-muted-foreground ml-1">
            one ration a head, eaten at each Dawn
          </span>
        </span>
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
                  {/*
                    The engine's own capacity reader rather than the raw
                    slot count: the market's purchase gate reads
                    cargoCapacity, which folds in the path's cargo
                    modifier and the hungry crew's quarter (see
                    cargoRoom in @/lib/game/larder), and the tile used
                    to print the unmodified number, so a Convoy captain
                    was told 30 while the market refused at 24.
                  */}
                  / {cargoCapacity(game)}
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
          produces less, and {CREW_LOSS_AFTER_HUNGRY_LEGS} legs in a row without
          rations costs the newest hand aboard. Fill it before the next Dawn.
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

      {/* [E1: the Supply Barge] The fallback, and it is drawn last on this
          panel because that is what it is: the row a captain reads after
          the three foods above have turned out not to be enough. Nothing
          here is decided on the screen. The port and the lot are drawn from
          the voyage's own numbers, the price comes off the constants
          through the module that sells, and what each button would buy is
          the same three ceilings the sale applies, so a press cannot cost
          more than the label said.

          The one thing it does say out loud is the premium. The plan's
          own iteration clause is that the Barge exists so a table gets
          fleeced once and fights over the card next time, and a captain
          who cannot see the price they are paying cannot be fleeced by
          it: the row names what a ration costs against what the port
          above charges for one. */}
      {bargePort !== null && (
        <FoldRow
          tone="larder"
          icon="⛵"
          title="Supply Barge"
          gist={
            bargeLeft < 1
              ? "The barge has nothing left for you this leg."
              : `An unnamed trader on the quay: ${bargePrice} Gold a ration against the port's ${RATION_PRICE}.`
          }
          open={bargeFoldOpen}
          onToggle={() => setBargeFoldOpen((v) => !v)}
          className="mt-2"
        >
          <div className="rounded-lg border border-larder/15 bg-background/40 p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[11px]">
                <span className="mr-1">⛵</span>
                <span className="font-medium">Supply Barge</span>
                <span className="text-muted-foreground"> at {bargePort}</span>
              </span>
              <Button
                size="sm"
                className="h-7 rounded-lg px-2.5 text-[11px]"
                variant={bargeOne > 0 ? "default" : "secondary"}
                disabled={bargeOne <= 0}
                onClick={() => act((g, l) => buyFromBarge(g, 1, l))}
              >
                🌾 Buy {bargeOne > 0 ? `1 Ration (${bargePrice}💰)` : "Rations"}
              </Button>
              <Button
                size="sm"
                className="h-7 rounded-lg px-2.5 text-[11px]"
                variant={bargeLot > 1 ? "default" : "secondary"}
                disabled={bargeLot <= 1}
                onClick={() => act((g, l) => buyFromBarge(g, bargeLeft, l))}
              >
                Take the Lot
                {bargeLot > 1
                  ? ` (${bargeLot}, ${bargeLot * bargePrice}💰)`
                  : ""}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {bargeLeft < 1
                ? "The barge has nothing left for you this leg, and it is a fresh lot tomorrow."
                : `${bargeLeft} ${bargeLeft === 1 ? "ration is" : "rations are"} left for you this leg.`}
            </p>
          </div>
        </FoldRow>
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
