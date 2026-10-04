"use client";

// =====================================================================
// [I1: the telemetry spine] The leg report, client side.
//
// Three of the plan's numbers exist nowhere but a captain's own screen:
// how many orders a leg dealt them, how many of those they filled, and
// how varied the hold they closed it with was. The server cannot count
// any of the three and must not try, so this hook reads them off the
// voyage state and files them as a claim against the leg they belong to.
//
// What is deliberately absent from a base game report is a hold
// utilization figure. The plan asks for one, and this tree's hold has no
// size: an order board of three is three of nothing, and a percentage
// invented for it would be a number no rule moves. It waited on the split
// hold in C4, which landed the size, and the slots below are what it
// reads now. The variety the hold carried stays, because it is the number
// the dashboard's staple question actually reads.
//
// [C4: three foods, spoilage and the split hold] The last four figures
// come off the same state and ride in the same report: the slots the ship
// is carrying something in, and the meals of each food in the larder.
// Each is sent only when the switch that gives it meaning is on, so a
// voyage played without the split hold or without the survival layer
// files a report with those fields absent rather than with zeroes, and a
// reader counting food knows whether it is looking at a survival leg. The
// slots figure is the ceiling of what is in use rather than a fraction,
// which is the reading the provisions panel prints: a slot with anything
// in it is a slot in use, and the record and the screen should not be two
// roundings of one hold.
//
// The report is a claim and is treated as one. Nothing in the game reads
// it, the server bounds its leg against the voyage before keeping it, and
// the last report for a leg is the one kept rather than the first, so a
// captain who keeps trading after their first count is not recorded as
// having stopped.
//
// One report is one debounced effect. A hold changes good by good and an
// order board empties one order at a time, so the effect fires on the
// figures rather than on the click, and the server's own replace rule
// makes the several frames one leg can produce a single line in the
// record.
// =====================================================================

import { LegReport } from "@/types/realtime/objectives";
import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import type { GameState } from "@/lib/game/types";
import { mealsOf } from "@/lib/game/foods";
import { crewLossRuleOn } from "@/lib/game/crew";
import { garmentsLayerOn, legIsCold } from "@/lib/game/garments";
import { holdCapacityOn, usedHoldSlots } from "@/lib/game/hold";
import {
  chartersOn,
  escortContractsOn,
  moduleTradesOn,
  pathOrdersOn,
  survivalLayerOn,
} from "@/lib/game/flags";
import {
  bargeOn,
  openOrderCount,
  opportunistBorrowsTaken,
  refitsOn,
} from "@/lib/game/engine";

// The same cadence the captain's own status rides on (see
// use-game-session.ts): enough to feel immediate, sparse enough that a
// captain filling four orders in a row files one report rather than four.
const REPORT_DEBOUNCE_MS = 120;

/**
 * Reports what this captain's leg dealt, filled and closed carrying.
 *
 * Inert before the voyage starts and after it ends: leg 0 is the lobby,
 * and there is nothing to count in a harbor that is not sailing.
 */
export function useLegReport(
  socket: Socket | null,
  roomId: string | null,
  game: GameState,
): void {
  const leg = game.currentRound;
  // The orders this leg dealt, which is the board standing in front of
  // the captain during the trade phase, and the ones they filled, which
  // the engine resets at the top of every round and appends to on every
  // settlement. Dealt minus filled is the plan's expired count, worked
  // out by whoever reads the record rather than stored a second time.
  //
  // [D2] Dealt means the orders this captain could act on, so a card locked
  // behind a path they do not hold is not one of them: the count comes from
  // openOrderCount, where the lock rule lives, rather than from the length of
  // the board, because a locked card is not an order anybody expired and
  // counting it would read three of them against every captain's leg.
  const ordersDealt = openOrderCount(game);
  const ordersFilled = game.completedOrders.length;
  // The goods the hold closes the leg carrying: a hold full of one thing
  // is the staple the plan's gate watches for, and no key of an empty
  // hold counts.
  let distinctGoods = 0;
  for (const count of Object.values(game.inventory)) {
    if (count > 0) distinctGoods++;
  }
  // [C4] The hold and the pantry, read through the two switches rather
  // than beside them: an undefined here is a field the record will not
  // carry, which is the honest shape for a leg that was never playing the
  // rule (see the LegReport type).
  const holdSlots = holdCapacityOn(game.mode)
    ? Math.ceil(usedHoldSlots(game))
    : undefined;
  const grainMeals = survivalLayerOn(game.mode)
    ? mealsOf(game, "Grain")
    : undefined;
  const saltFishMeals = survivalLayerOn(game.mode)
    ? mealsOf(game, "Salt Fish")
    : undefined;
  const produceMeals = survivalLayerOn(game.mode)
    ? mealsOf(game, "Produce")
    : undefined;
  // [D3: Convoy: the Escort Contract] The market's three, read off the
  // captain's own tally and sent only when the switch that gives them
  // meaning is on. They are this captain's own record of what they sold,
  // which is the seller's side the plan asks about: a buyer's leg carries no
  // contract figures, because the market being measured is the seller's.
  const escortSold = escortContractsOn(game.mode) ? game.escortSold : undefined;
  const escortFeesEarned = escortContractsOn(game.mode)
    ? game.escortFeesEarned
    : undefined;
  const escortAbsorbed = escortContractsOn(game.mode)
    ? game.escortAbsorbed
    : undefined;
  // [D4: Loom: the Refit] The bench's three, read off the same tally the
  // panel prints and sent only when the switch that gives them meaning is
  // on. The seller's side, for the escort's reason: the plan asks what the
  // market sold, and the customer is on the other side of that number.
  //
  // The weather is the odd one out and is deliberately not read through the
  // bench's switch. A Loom is poor in fair weather and busy in cold, which is
  // a claim about a run of legs rather than about one of them, so a reader
  // needs the weather of every leg the voyage sailed including the ones the
  // bench sat out. It is read through the wardrobe layer instead, which is
  // where that rule lives (see legIsCold), so a build with no coats reports
  // no weather rather than reporting every leg fair.
  const refitsSold = refitsOn(game.mode) ? game.refitsSold : undefined;
  const refitFeesEarned = refitsOn(game.mode)
    ? game.refitFeesEarned
    : undefined;
  const ragsRewoven = refitsOn(game.mode) ? game.ragsRewoven : undefined;
  const coldLeg = garmentsLayerOn(game.mode) ? legIsCold(game) : undefined;
  // [F3: modules in the shipyard ladder, and trading them between captains]
  // The market's two, read off the tally the seller's own settle writes and
  // sent only when the switch that gives them meaning is on. The seller's
  // side, for the two markets' reason: the plan asks about trade volume
  // between captains, and the buyer is on the other side of both numbers.
  const modulesSold = moduleTradesOn(game.mode) ? game.modulesSold : undefined;
  const moduleFeesEarned = moduleTradesOn(game.mode)
    ? game.moduleFeesEarned
    : undefined;
  // [D6: Free Captain: Opportunist] The borrow counter, the last of the
  // ability figures and the only one that counts the voyage rather than the
  // leg: the plan's evaluation is a usage rate, which is a share of voyages,
  // so what a reader wants is how many borrows the allowance has spent.
  // It rides the path orders switch, which is the ability's own rollback
  // rather than a switch of its own: with no locked card on the board there
  // is nothing to borrow, so a build without locks reports nothing rather
  // than a zero it could never have moved. A voyage that never borrowed
  // reports its zero, because zero is a reading of the allowance.
  const opportunistBorrows = pathOrdersOn(game.mode)
    ? opportunistBorrowsTaken(game)
    : undefined;
  // [E1: the Supply Barge] The voyage's two food counters, read off the
  // captain's own save and sent only when the switch that gives them
  // meaning is on, which is the same switch the vendor stands on: a leg
  // sailed with no provisions layer has no food spending for a share to be
  // taken of. Both are the voyage's totals rather than the leg's, which is
  // the plan's own reading ("Barge revenue as a share of all food
  // spending") and the reason a reader takes the last report a captain
  // filed rather than adding the legs up.
  //
  // The vendor's port and its lot are deliberately not sent. They are
  // drawn from the voyage's own numbers on every client (see
  // bargePortAtLeg), so the server could only ever be told what it could
  // already work out, and a field that exists to say it again is a field
  // that can disagree.
  const foodSpend = bargeOn(game.mode) ? game.foodSpend : undefined;
  const bargeSpend = bargeOn(game.mode) ? game.bargeSpend : undefined;
  // [F4: boons at milestone moments] The voyage's crew losses so far, read
  // off the maroon mark's own list and sent only when the switch that gives
  // them meaning is on: a leg sailed without the loss rule has no losses to
  // report. It is the voyage's running total rather than the leg's, on E1's
  // rule above and for the same reason, and the plan's evaluation is why:
  // retention is compared across a voyage, so a reader takes the last report
  // each captain filed rather than adding the legs up. A voyage that lost
  // nobody reports its zero, because zero is a reading of the rule.
  const crewLosses = crewLossRuleOn(game.mode)
    ? game.crewLost.length
    : undefined;
  // [F6: charters at leg four] The voyage's one charter, sent on every leg
  // once it has been answered and only when the switch that gives the
  // moment meaning is on: a leg sailed without the moment has no charter
  // to name. It rides every leg rather than the leg it was taken on
  // because this report is also the reconnect frame, and the server writes
  // the take once per voyage whatever is sent (see noteCharterTaken): the
  // client's only job is to keep saying what it holds until the voyage
  // ends. Null reads as an absence rather than as an empty claim, which is
  // the same shape the whole report takes for a question not asked yet.
  const charter = chartersOn(game.mode)
    ? (game.charter ?? undefined)
    : undefined;

  // The figures are the dependency list, which is the point: the effect
  // fires when a count moves, not when the captain clicks.
  useEffect(() => {
    if (!socket || !roomId || leg < 1) return;
    const timer = setTimeout(() => {
      const payload: LegReport = {
        roomId,
        leg,
        ordersDealt,
        ordersFilled,
        distinctGoods,
        holdSlots,
        grainMeals,
        saltFishMeals,
        produceMeals,
        escortSold,
        escortFeesEarned,
        escortAbsorbed,
        refitsSold,
        refitFeesEarned,
        ragsRewoven,
        coldLeg,
        modulesSold,
        moduleFeesEarned,
        opportunistBorrows,
        foodSpend,
        bargeSpend,
        crewLosses,
        charter,
      };
      socket.emit("telemetry:leg", payload);
    }, REPORT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    socket,
    roomId,
    leg,
    ordersDealt,
    ordersFilled,
    distinctGoods,
    holdSlots,
    grainMeals,
    saltFishMeals,
    produceMeals,
    escortSold,
    escortFeesEarned,
    escortAbsorbed,
    refitsSold,
    refitFeesEarned,
    ragsRewoven,
    coldLeg,
    modulesSold,
    moduleFeesEarned,
    opportunistBorrows,
    foodSpend,
    bargeSpend,
    crewLosses,
    charter,
  ]);
}
