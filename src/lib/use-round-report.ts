"use client";

// =====================================================================
// The round report, client side.
//
// Three of the numbers this report files exist nowhere but a captain's
// own screen: how many orders a round dealt them, how many of those they
// filled, and how varied the hold they closed it with was. The server
// cannot count any of the three and must not try, so this hook reads them
// off the voyage state and files them as a claim against the round they
// belong to.
//
// What is deliberately absent from a base game report is a hold
// utilization figure. This tree's hold has no size: an order board of
// three is three of nothing, and a percentage invented for it would be a
// number no rule moves. The split hold landed the size, and the slots
// below are what it reads now. The variety the hold carried stays,
// because it is the number the dashboard's staple question actually
// reads.
//
// The last four figures come off the same state and ride in the same
// report: the slots the ship is carrying something in, and the meals of
// each food in the larder. Each is sent only when the switch that gives
// it meaning is on, so a voyage played without the split hold or without
// the survival layer files a report with those fields absent rather than
// with zeroes, and a reader counting food knows whether it is looking at
// a survival round. The slots figure is the ceiling of what is in use
// rather than a fraction, which is the reading the provisions panel
// prints: a slot with anything in it is a slot in use, and the record and
// the screen should not be two roundings of one hold.
//
// The report is a claim and is treated as one. Nothing in the game reads
// it, the server bounds its round against the voyage before keeping it, and
// the last report for a round is the one kept rather than the first, so a
// captain who keeps trading after their first count is not recorded as
// having stopped.
//
// One report is one debounced effect. A hold changes good by good and an
// order board empties one order at a time, so the effect fires on the
// figures rather than on the click, and the server's own replace rule
// makes the several frames one round can produce a single line in the
// record.
// =====================================================================

import { RoundReport } from "@/types/realtime/objectives";
import { STATUS_BROADCAST_MS } from "@/lib/session/use-status-beacon";
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

/**
 * Reports what this captain's round dealt, filled and closed carrying.
 *
 * Inert before the voyage starts and after it ends: round 0 is the lobby,
 * and there is nothing to count in a harbor that is not sailing.
 */
export function useRoundReport(
  socket: Socket | null,
  roomId: string | null,
  game: GameState,
): void {
  const round = game.currentRound;
  // The orders this round dealt, which is the board standing in front of
  // the captain during the trade phase, and the ones they filled, which
  // the engine resets at the top of every round and appends to on every
  // settlement. Dealt minus filled is the expired count, worked
  // out by whoever reads the record rather than stored a second time.
  //
  // Dealt means the orders this captain could act on, so a card locked
  // behind a path they do not hold is not one of them: the count comes from
  // openOrderCount, where the lock rule lives, rather than from the length of
  // the board, because a locked card is not an order anybody expired and
  // counting it would read three of them against every captain's round.
  const ordersDealt = openOrderCount(game);
  const ordersFilled = game.completedOrders.length;
  // The goods the hold closes the round carrying: a hold full of one thing
  // is the staple the variety gate watches for, and no key of an empty
  // hold counts.
  let distinctGoods = 0;
  for (const count of Object.values(game.inventory)) {
    if (count > 0) distinctGoods++;
  }
  // The hold and the pantry, read through the two switches rather
  // than beside them: an undefined here is a field the record will not
  // carry, which is the honest shape for a round that was never playing the
  // rule (see the RoundReport type).
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
  // The market's three, read off the captain's own tally and sent only
  // when the switch that gives them meaning is on. They are this
  // captain's own record of what they sold, which is the seller's side the
  // report asks about: a buyer's round carries no contract figures, because
  // the market being measured is the seller's.
  const escortSold = escortContractsOn(game.mode) ? game.escortSold : undefined;
  const escortFeesEarned = escortContractsOn(game.mode)
    ? game.escortFeesEarned
    : undefined;
  const escortAbsorbed = escortContractsOn(game.mode)
    ? game.escortAbsorbed
    : undefined;
  // The bench's three, read off the same tally the panel prints and sent
  // only when the switch that gives them meaning is on. The seller's side,
  // for the escort's reason: the report asks what the market sold, and the
  // customer is on the other side of that number.
  //
  // The weather is the odd one out and is deliberately not read through the
  // bench's switch. A Loom is poor in fair weather and busy in cold, which is
  // a claim about a run of rounds rather than about one of them, so a reader
  // needs the weather of every round the voyage sailed including the ones the
  // bench sat out. It is read through the wardrobe layer instead, which is
  // where that rule lives (see legIsCold), so a build with no coats reports
  // no weather rather than reporting every round fair.
  const refitsSold = refitsOn(game.mode) ? game.refitsSold : undefined;
  const refitFeesEarned = refitsOn(game.mode)
    ? game.refitFeesEarned
    : undefined;
  const ragsRewoven = refitsOn(game.mode) ? game.ragsRewoven : undefined;
  const coldRound = garmentsLayerOn(game.mode) ? legIsCold(game) : undefined;
  // The shipyard module market's two, read off the tally the seller's own
  // settle writes and sent only when the switch that gives them meaning
  // is on. The seller's side, for the two markets' reason: the report asks
  // about trade volume between captains, and the buyer is on the other
  // side of both numbers.
  const modulesSold = moduleTradesOn(game.mode) ? game.modulesSold : undefined;
  const moduleFeesEarned = moduleTradesOn(game.mode)
    ? game.moduleFeesEarned
    : undefined;
  // The borrow counter, the last of the ability figures and the only one
  // that counts the voyage rather than the round: the evaluation is a usage
  // rate, which is a share of voyages, so what a reader wants is how many
  // borrows the allowance has spent. It rides the path orders switch,
  // which is the ability's own rollback rather than a switch of its own:
  // with no locked card on the board there is nothing to borrow, so a
  // build without locks reports nothing rather than a zero it could never
  // have moved. A voyage that never borrowed reports its zero, because
  // zero is a reading of the allowance.
  const opportunistBorrows = pathOrdersOn(game.mode)
    ? opportunistBorrowsTaken(game)
    : undefined;
  // The voyage's two food counters, read off the captain's own save and
  // sent only when the switch that gives them meaning is on, which is the
  // same switch the vendor stands on: a round sailed with no provisions
  // layer has no food spending for a share to be taken of. Both are the
  // voyage's totals rather than the round's, which is the reading the figure
  // asks for ("Barge revenue as a share of all food spending") and the
  // reason a reader takes the last report a captain filed rather than
  // adding the rounds up.
  //
  // The vendor's port and its lot are deliberately not sent. They are
  // drawn from the voyage's own numbers on every client (see
  // bargePortAtRound), so the server could only ever be told what it could
  // already work out, and a field that exists to say it again is a field
  // that can disagree.
  const foodSpend = bargeOn(game.mode) ? game.foodSpend : undefined;
  const bargeSpend = bargeOn(game.mode) ? game.bargeSpend : undefined;
  // The voyage's crew losses so far, read off the maroon mark's own list
  // and sent only when the switch that gives them meaning is on: a round
  // sailed without the loss rule has no losses to report. It is the
  // voyage's running total rather than the round's, on the rule above and
  // for the same reason, and the evaluation is why: retention is compared
  // across a voyage, so a reader takes the last report each captain filed
  // rather than adding the rounds up. A voyage that lost nobody reports its
  // zero, because zero is a reading of the rule.
  const crewLosses = crewLossRuleOn(game.mode)
    ? game.crewLost.length
    : undefined;
  // The voyage's one charter, sent on every round once it has been answered
  // and only when the switch that gives the moment meaning is on: a round
  // sailed without the moment has no charter to name. It rides every round
  // rather than the round it was taken on because this report is also the
  // reconnect frame, and the server writes the take once per voyage
  // whatever is sent (see noteCharterTaken): the client's only job is to
  // keep saying what it holds until the voyage ends. Null reads as an
  // absence rather than as an empty claim, which is the same shape the
  // whole report takes for a question not asked yet.
  const charter = chartersOn(game.mode)
    ? (game.charter ?? undefined)
    : undefined;

  // The figures are the dependency list, which is the point: the effect
  // fires when a count moves, not when the captain clicks.
  useEffect(() => {
    if (!socket || !roomId || round < 1) return;
    const timer = setTimeout(() => {
      const payload: RoundReport = {
        roomId,
        round,
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
        coldRound,
        modulesSold,
        moduleFeesEarned,
        opportunistBorrows,
        foodSpend,
        bargeSpend,
        crewLosses,
        charter,
      };
      socket.emit("telemetry:round", payload);
      // The debounce is the cadence every live channel rides on (see
      // STATUS_BROADCAST_MS in @/lib/session/use-status-beacon): enough to
      // feel immediate, sparse enough that a captain filling four orders in
      // a row files one report rather than four.
    }, STATUS_BROADCAST_MS);
    return () => clearTimeout(timer);
  }, [
    socket,
    roomId,
    round,
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
    coldRound,
    modulesSold,
    moduleFeesEarned,
    opportunistBorrows,
    foodSpend,
    bargeSpend,
    crewLosses,
    charter,
  ]);
}
