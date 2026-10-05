// PortMasters 2.2 Parallel Release, smoke run: The power budget.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CARDS, cardById, offerPool } from "@/lib/game/cards";
import { charterChoices, charterPending } from "@/lib/game/charters";
import {
  MAX_HELD_CARDS,
  PAIR_APPEARANCE_FLOOR,
  PAIR_WIN_CEILING,
  PAIR_WIN_SHARE,
  parseHeldCards,
  readPairs,
  type PairRow,
} from "@/lib/game/combinations";
import {
  HELD_POWER_CAP,
  MODE_POWER_CEILING,
  type CardRecord,
} from "@/lib/game/constants/cards";
import {
  CHARTER_LEG,
  CHARTER_PATH,
  CHARTERS,
} from "@/lib/game/constants/charters";
import { CARDS_PER_OFFER, MILESTONE_BOONS } from "@/lib/game/constants/drafts";
import {
  MILESTONE_TRIGGERS,
  type MilestoneTrigger,
} from "@/lib/game/constants/milestones";
import { MAX_SHIP_LEVEL } from "@/lib/game/constants/ships";
import { heldPower, powerBudgetAllows } from "@/lib/game/held-cards";
import { milestoneChoices, milestonePending } from "@/lib/game/milestones";
import type { GameMode } from "@/lib/game/mode";
import type { GameState } from "@/lib/game/types";
import { answerCharter } from "@/lib/game/engine/charters";
import {
  answerMilestone,
  queueMilestoneMoment,
} from "@/lib/game/engine/milestones";
// The two readers this suite holds that the engine barrel deliberately
// does not carry: the yard's own fit test, which the barrel section below
// asserts stays private to the yard and its suites, and the load path's
// heal, which belongs to the session layer rather than to the engine.
import { moduleFitsHull } from "@/lib/game/engine/boons";
import { healLoadedVoyage } from "@/lib/session/heal-save";
import * as engineBarrel from "@/lib/game/engine";
import {
  cancelModuleDraft,
  finalizeModuleSwap,
  handleModuleSelect,
  moduleDraftPossible,
  moduleSwapPossible,
  snapToCheckpoint,
  startModuleDrafting,
  swapModuleChoices,
} from "@/lib/game/engine";
import {
  CARRIES_A_DASH,
  CLASSIC,
  GAMBIT,
  check,
  voyageState,
  withEnv,
} from "../harness";

/**
 * [F7: the power budget and the combination instrument] The plan's third
 * feature of the cycle, in its four halves: the cap that bounds what a
 * captain can hold (the constant and the bounds it is authored between,
 * the two pure reads off the durable set, and every gate at its live
 * site: the two moment tables, the yard roll, the two install paths and
 * the market row), the floor the install paths keep under the panels,
 * the chronicle's held set and the pair matrix reduced off it, and the
 * one home for the bound the conclusion writes.
 *
 * It sits beside the charter article and joins the group that needs no
 * harbor, for the charters' own reason: every gate is a pure function of
 * a state, and the one half that touches a database (the conclusion's
 * column) opens no table of its own. Its fixtures are real pool cards
 * read by name, so the power on them is the arithmetic the live game
 * reads rather than a number typed for the test, and every heavy hull
 * below is a hold the gates could actually have built.
 *
 * The moment and charter reads are exercised with their switches pinned
 * on, the charters' own idiom: a check that read a switch from the
 * ambient environment would report the deployment's rollback as a
 * verdict about the table it is not testing.
 *
 * The instrument half carries the plan's own health check: "its health
 * check is that it fires on a deliberately planted overpowered pair
 * during development", which is the planted pair the matrix rows below
 * are built around, in both of its flags.
 */
export async function powerBudgetSuite(): Promise<void> {
  const gambitOn = <T>(read: () => T): T =>
    withEnv("NEXT_PUBLIC_MILESTONE_BOONS", "1", read);
  const chartersOn = <T>(read: () => T): T =>
    withEnv("NEXT_PUBLIC_CHARTERS", "1", read);

  // A pool card by its shipped id, so a fixture names what a captain
  // would read rather than a number this file made up.
  const cardOf = (id: string): CardRecord => {
    const card = cardById(id);
    if (card === null) {
      throw new Error(
        `the pool no longer ships ${id}, and a fixture here reads it by name`,
      );
    }
    return card;
  };

  // ========== A. The constant and the bounds it is authored between ==========

  check(
    HELD_POWER_CAP === 26,
    "the cap ships at the number every gate and both panels speak in, so a change to it is a deliberate edit here and a rollback is that edit back",
  );

  // The ceiling gates the pool as it admits a card; the cap bounds the
  // durable set a voyage has handed one captain. The two ladders below
  // are what places 26 between them, computed rather than remembered:
  // the heaviest five moment and three module hold each mode's pool can
  // field, with Ocean Gambit's stack counting the charter too.
  const poolPowers = (kind: string, mode: GameMode) =>
    CARDS.filter((card) => card.kind === kind && card.modes[mode] > 0)
      .map((card) => card.power)
      .sort((one, other) => other - one);
  const topSum = (powers: number[], count: number) =>
    powers.slice(0, count).reduce((sum, power) => sum + power, 0);
  const classicLadder =
    topSum(poolPowers("boon", CLASSIC), MILESTONE_TRIGGERS.length) +
    topSum(poolPowers("module", CLASSIC), MAX_SHIP_LEVEL);
  const gambitStack =
    topSum(poolPowers("boon", GAMBIT), MILESTONE_TRIGGERS.length) +
    topSum(poolPowers("module", GAMBIT), MAX_SHIP_LEVEL) +
    topSum(poolPowers("charter", GAMBIT), 1);

  check(
    HELD_POWER_CAP > classicLadder && HELD_POWER_CAP < gambitStack,
    "the cap sits above the classic ladder and below the gambit stack, both computed off the pools: the founding mode's heaviest five moment and three module hold stays under it and Ocean Gambit's heaviest stack of boons, modules and charter goes over it, so the only lines the cap ever draws are the greediest gambit ones",
  );

  check(
    CARDS.every(
      (card) =>
        card.modes.classic === 0 || card.power <= MODE_POWER_CEILING.classic,
    ) &&
      CARDS.every(
        (card) =>
          card.modes.ocean_gambit === 0 ||
          card.power <= MODE_POWER_CEILING.ocean_gambit,
      ),
    "and the premise under that sum is the pool validator's own line: no card inside Classic's pool sits above Classic's ceiling, which is why the classic ladder is the low one",
  );

  check(
    MILESTONE_TRIGGERS.every(
      (trigger) =>
        MILESTONE_BOONS.filter((card) => card.trigger === trigger).length === 1,
    ),
    "every moment anchors exactly one boon of its own, which is the premise both the anchored first draw and the fixtures below stand on",
  );

  // ========== B. The arithmetic off the durable set ==========

  check(
    heldPower(voyageState()) === 0 &&
      heldPower({
        heldBoons: [
          "cold_hardened",
          "steady_watch",
          "steady_watch",
          "ghost_card",
          "silk_wind",
        ],
        equippedModules: [cardOf("brokers_network"), cardOf("salvage_crane")],
        charter: "bulk_charter",
      }) ===
        3 + 2 + 2 + 2 + 4,
    "held power is one sum over the durable set: the boons deduped and pool resolved (a repeat is one held card, a retired id is no card, and a round draft id is not durable at all), the modules by their own records, and the charter last, which is the same reading the save's heal takes of all three",
  );

  // A hull at exactly twenty five, one point under the line, so the two
  // boundary arms are one card apart.
  const justUnder = () => {
    const state = voyageState();
    state.shipLevel = 3;
    state.equippedModules.push(cardOf("tax_evasion"), cardOf("silk_monopoly"));
    state.heldBoons.push(
      "cold_hardened",
      "route_mastery",
      "steady_watch",
      "fleet_colors",
    );
    state.charter = "the_factor";
    return state;
  };
  const under = justUnder();
  check(
    heldPower(under) === 25 &&
      powerBudgetAllows(under, cardOf("farsight")) &&
      !powerBudgetAllows(under, cardOf("favorable_tides")),
    "the bound is read inclusively: at twenty five a one power card lands on exactly the cap and is allowed, and a two power card would pass it and is not, which is the off by one every gate below leans on",
  );

  check(
    powerBudgetAllows(
      under,
      cardOf("farsight"),
      cardOf("deep_sea_escort_pact"),
    ) &&
      powerBudgetAllows(
        under,
        cardOf("deep_sea_escort_pact"),
        cardOf("deep_sea_escort_pact"),
      ),
    "and the swap arm frees the displaced card's power first, which is the difference between the two arms: the same hull that refuses a four power card as an addition takes it in exchange for the one it displaces",
  );

  // ========== C. The moment table ==========

  // A hull at twenty four, full slotted, whose moment family it has not
  // answered straddles the line: its three power anchor is refused and
  // the two power cards fit. The held boons are the two heaviest of the
  // five, so the family's leftover pool is exactly the anchor (harbor
  // credit, unheld) plus the two light cards, and every reading below is
  // arithmetic rather than a draw's luck.
  const hullAt24 = () => {
    const state = voyageState();
    state.shipLevel = 3;
    state.equippedModules.push(
      cardOf("tax_evasion"),
      cardOf("silk_monopoly"),
      cardOf("overdrive_engine"),
    );
    state.heldBoons.push("cold_hardened", "route_mastery");
    state.charter = "the_factor";
    return state;
  };

  const mid = hullAt24();
  const midUnfiltered = milestoneChoices(mid, "renown_rung", {
    ignoreBudget: true,
  });
  const midFiltered = milestoneChoices(mid, "renown_rung");

  check(
    heldPower(mid) === 24 &&
      midUnfiltered.length === 3 &&
      midUnfiltered[0].id === "harbor_credit" &&
      midFiltered.length < midUnfiltered.length &&
      !midFiltered.some((card) => card.id === "harbor_credit") &&
      midFiltered.every((card) => card.power === 2),
    "the renown rung's anchored card is harbor credit, three power, and at twenty four it is refused while the rest of the drawn table keeps its two power cards: the filtered trio is the drawn trio with the heavy cards gone, anchored card included",
  );

  check(
    midFiltered.every((card) => powerBudgetAllows(mid, card)) &&
      midFiltered.every((card) => midUnfiltered.includes(card)),
    "every card the filtered table deals fits the hull, and every one of them is a card of the unfiltered table: the filter takes cards away and never adds or swaps, which is what keeps a click already made valid while power moves",
  );

  const fresh = voyageState();
  const freshFiltered = milestoneChoices(fresh, "pathbound_order");
  const freshUnfiltered = milestoneChoices(fresh, "pathbound_order", {
    ignoreBudget: true,
  });
  const blind = voyageState();
  blind.currentRound = 9;
  check(
    freshFiltered.map((card) => card.id).join("|") ===
      freshUnfiltered.map((card) => card.id).join("|") &&
      milestoneChoices(blind, "pathbound_order")
        .map((card) => card.id)
        .join("|") === freshFiltered.map((card) => card.id).join("|"),
    "on a light hull the budget is invisible: the table is exactly the unfiltered one, and the same seed still leaves the round out, so a checkpoint or a reload between the offer and the answer cannot reshuffle the hand under a captain's eyes",
  );

  // A hull at exactly the cap whose moment family is not dry: the one
  // shape that tells the two empty tables apart. Its held boons leave
  // the family exactly two cards, both too heavy, so the empty and the
  // nonempty readings are both settled by the arithmetic rather than by
  // a draw.
  const cappedBoons = () => {
    const state = voyageState();
    state.shipLevel = 3;
    state.equippedModules.push(
      cardOf("tax_evasion"),
      cardOf("silk_monopoly"),
      cardOf("overdrive_engine"),
    );
    state.heldBoons.push("cold_hardened", "route_mastery", "steady_watch");
    state.charter = "the_factor";
    return state;
  };
  const latch: MilestoneTrigger = "pathbound_order";
  const capped = cappedBoons();
  check(
    heldPower(capped) === HELD_POWER_CAP &&
      milestoneChoices(capped, latch).length === 0 &&
      milestoneChoices(capped, latch, { ignoreBudget: true }).length > 0,
    "a hull at the cap has an empty table and a pool that is not dry, which is the state the two empties are told apart by: the budget read is silent while the budget aside read still finds cards",
  );

  const deferLogs: string[] = [];
  gambitOn(() => queueMilestoneMoment(capped, deferLogs, latch));
  check(
    capped.milestoneOffers.length === 0 &&
      capped.milestonesAnswered[latch] === undefined &&
      Object.keys(capped.cardTally).length === 0,
    "arming the moment on that hull defers it: nothing is queued, the mark does not move, and no offer is counted, so a moment the cap only meant to postpone is not eaten by the sweep that met it",
  );

  const revived = cappedBoons();
  gambitOn(() => queueMilestoneMoment(revived, deferLogs, latch));
  revived.equippedModules.pop();
  gambitOn(() => queueMilestoneMoment(revived, deferLogs, latch));
  check(
    revived.milestoneOffers.includes(latch) &&
      gambitOn(() => milestonePending(revived)),
    "and the deferral is free to leave: the same sweep run again on the same hull after one module is sold back arms the moment, because the deferral re-reads the budget at every settlement rather than spending the moment once",
  );

  // The queued moment through a storm: armed light, a settled sale lands
  // heavy on the hull (the buyer's own guard ran at the render, the
  // settle lands when it lands), and the same moment is inert while the
  // hull is too heavy and back the moment weight leaves, with its mark
  // never moved.
  const storm = voyageState();
  const stormLogs: string[] = [];
  gambitOn(() => queueMilestoneMoment(storm, stormLogs, latch));
  const armed = storm.milestoneOffers.includes(latch);
  const landed = cappedBoons();
  storm.equippedModules = landed.equippedModules;
  storm.heldBoons = landed.heldBoons;
  storm.charter = landed.charter;
  storm.shipLevel = 3;
  const inertWhileHeavy = !gambitOn(() => milestonePending(storm));
  const staleRefused = !answerMilestone(storm, "fleet_colors", stormLogs);
  storm.equippedModules.pop();
  check(
    armed &&
      inertWhileHeavy &&
      staleRefused &&
      storm.milestonesAnswered[latch] === undefined &&
      gambitOn(() => milestonePending(storm)) &&
      storm.milestoneOffers.includes(latch),
    "a moment already on the queue rides the storm: armed on a light hull, left inert and unanswerable while a settled trade has the hull too heavy, and pending again once one module leaves, with the mark never moved and the stale click refused rather than trusted",
  );

  // The record reads the filtered table, because it is written off the
  // same derived choices the screen drew. This hull is the mid one above
  // with a rung behind it, so the record and the unfiltered reading
  // differ by the anchor the budget took away.
  const record = hullAt24();
  record.score = 1_000_000;
  const recordLogs: string[] = [];
  gambitOn(() => queueMilestoneMoment(record, recordLogs, "renown_rung"));
  const recordTrio = milestoneChoices(record, "renown_rung");
  const recordUnfiltered = milestoneChoices(record, "renown_rung", {
    ignoreBudget: true,
  });
  const recordTaken = recordTrio[0]?.id ?? "";
  const recordAnswered = gambitOn(() =>
    answerMilestone(record, recordTaken, recordLogs),
  );
  check(
    recordAnswered &&
      recordTrio.length === 2 &&
      recordUnfiltered.length === 3 &&
      record.boonRecord !== null &&
      record.boonRecord.shown.join("|") ===
        recordTrio.map((card) => card.id).join("|") &&
      record.boonRecord.kept === recordTaken &&
      record.boonRecord.moment === "renown_rung" &&
      record.milestonesAnswered.renown_rung === 1,
    "the moment's own record is written from the filtered table: the fleet's ledger shows the two cards the captain was actually dealt rather than the three the unfiltered draw found, which is the same reading every other writer of that record takes because it is the same derived call",
  );

  // ========== D. The charter table ==========

  // A path the factor is not paired to, so the epoch hunt below can watch
  // the wildcard draw land on it.
  const loomPath = Object.values(CHARTER_PATH).find(
    (path) => CHARTER_PATH["the_factor"] !== path,
  );
  if (loomPath === undefined) {
    check(
      false,
      "the charter pairing map names paths, which is the premise every fixture below stands on",
    );
    return;
  }
  const ownIds = CHARTERS.filter(
    (card) => CHARTER_PATH[card.id] === loomPath,
  ).map((card) => card.id);
  const lightCharter = (epoch: number) => {
    const state = voyageState();
    state.voyageEpoch = epoch;
    state.path = loomPath;
    state.currentRound = CHARTER_LEG;
    return state;
  };
  const light = lightCharter(0);
  const lightTrio = charterChoices(light);
  check(
    lightTrio.length === 3 &&
      lightTrio[0].id === ownIds[0] &&
      lightTrio[1].id === ownIds[1] &&
      !ownIds.includes(lightTrio[2]?.id ?? "") &&
      lightTrio.every((card) => powerBudgetAllows(light, card)),
    "on a light hull the charter trio is the pair then the wildcard, all of it fitting: the budget is invisible here, so this is the unfiltered reading the heavy hull below is held against",
  );

  // The epoch whose wildcard drew the factor, found rather than assumed:
  // the hunt is over the seed, which is the only thing that moves the
  // wildcard, and the suite fails loudly if no seed deals it.
  let factorEpoch: number | null = null;
  for (let epoch = 0; epoch < 500 && factorEpoch === null; epoch++) {
    if (charterChoices(lightCharter(epoch))[2]?.id === "the_factor") {
      factorEpoch = epoch;
    }
  }
  check(
    factorEpoch !== null,
    "an epoch whose wildcard is the factor exists inside the search, so the wildcard drop below stands on the pool's own draw rather than on a hand arranged trio",
  );

  // A hull at twenty two, one four power charter short of the cap: the
  // pair lands exactly on it and the five power wildcard goes over, so
  // the wildcard's drop is arithmetic rather than a draw's luck.
  const heavyCharterHull = () => {
    const state = voyageState();
    state.shipLevel = 3;
    state.equippedModules.push(
      cardOf("tax_evasion"),
      cardOf("silk_monopoly"),
      cardOf("overdrive_engine"),
    );
    state.heldBoons.push("cold_hardened", "route_mastery", "harbor_credit");
    return state;
  };
  const heavyCharter = (epoch: number) => {
    const state = heavyCharterHull();
    state.voyageEpoch = epoch;
    state.path = loomPath;
    state.currentRound = CHARTER_LEG;
    return state;
  };
  const heavy = heavyCharter(factorEpoch ?? 0);
  const heavyChoices = charterChoices(heavy);
  const heavyLight = lightCharter(factorEpoch ?? 0);
  check(
    heavyChoices.length === 2 &&
      heavyChoices.map((card) => card.id).join("|") === ownIds.join("|") &&
      charterChoices(heavyLight)[2]?.id === "the_factor" &&
      chartersOn(() => charterPending(heavy)),
    "at twenty two the five power wildcard is refused and the pair stays: the drawn wildcard keeps its identity and drops whole, the two four power charters land on the cap exactly and are allowed, and the moment still shows because its table still holds cards",
  );

  // A hull at twenty four that holds no charter yet, which is the state
  // the moment has to read as shut: every charter in the pool clears
  // four power, and four is past what this hull can take.
  const shut = voyageState();
  shut.shipLevel = 3;
  shut.equippedModules.push(
    cardOf("tax_evasion"),
    cardOf("silk_monopoly"),
    cardOf("overdrive_engine"),
  );
  shut.heldBoons.push(
    "cold_hardened",
    "route_mastery",
    "harbor_credit",
    "steady_watch",
  );
  shut.path = loomPath;
  shut.currentRound = CHARTER_LEG;
  const shutLogs: string[] = [];
  check(
    charterChoices(shut).length === 0 &&
      !chartersOn(() => charterPending(shut)) &&
      !chartersOn(() => answerCharter(shut, ownIds[0], shutLogs)) &&
      shut.charter === null,
    "a hull too heavy for every charter reads an empty table, the moment is left off the screen rather than drawn with no exit, and an answer naming a card the filtered trio no longer deals is refused rather than trusted",
  );

  const taking = lightCharter(3);
  const takeLogs: string[] = [];
  const takeOffered = charterChoices(taking)[0]?.id ?? "";
  check(
    chartersOn(() => answerCharter(taking, takeOffered, takeLogs)) &&
      taking.charter === takeOffered,
    "and on a hull that fits, the answer still stores the id it was offered, which is the write the whole moment exists for",
  );

  // ========== E. The yard ==========

  check(
    moduleDraftPossible(voyageState()),
    "a fresh hull's yard always has something to deal, which is the screen this gate must never shut on a captain who has taken nothing",
  );

  // A hull at the cap with a free slot: every module the pool holds
  // weighs two or more, so nothing fits on top. The two bolted modules
  // and the four heaviest boons take ten and eleven, and the factor
  // takes the rest.
  const cappedYard = () => {
    const state = voyageState();
    state.shipLevel = 3;
    state.equippedModules.push(cardOf("tax_evasion"), cardOf("silk_monopoly"));
    state.heldBoons.push(
      "cold_hardened",
      "route_mastery",
      "steady_watch",
      "harbor_credit",
    );
    state.charter = "the_factor";
    return state;
  };
  const shutYard = cappedYard();
  const shutDealable = moduleDraftPossible(shutYard);
  startModuleDrafting(shutYard);
  check(
    heldPower(shutYard) === HELD_POWER_CAP &&
      !shutDealable &&
      shutYard._draftChoices?.length === 0,
    "a hull at the cap with room for one more module reads shut: the Draft button's own question answers no, and the draft the button no longer opens would have dealt nothing anyway",
  );

  // The open slotted hull at twenty four, which is the shape the roll's
  // filter is read on: two bolted modules leave the third slot open, and
  // the ten power of boons and the four power charter leave exactly the
  // two power cards able to fill it.
  const openAt24 = () => {
    const state = voyageState();
    state.shipLevel = 3;
    state.equippedModules.push(cardOf("tax_evasion"), cardOf("silk_monopoly"));
    state.heldBoons.push(
      "cold_hardened",
      "route_mastery",
      "steady_watch",
      "fleet_colors",
    );
    state.charter = "bulk_charter";
    return state;
  };
  const midYard = openAt24();
  startModuleDrafting(midYard);
  const midPicks = midYard._draftChoices ?? [];
  const poolHeavier = CARDS.some(
    (card) =>
      card.kind === "module" && card.modes.ocean_gambit > 0 && card.power >= 3,
  );
  check(
    midPicks.length > 0 &&
      midPicks.every((card) => card.power <= 2) &&
      poolHeavier,
    "the yard roll deals only what the hull can take: at twenty four every three power module is filtered out before the draw while the pool demonstrably holds some, so every seat the draft deals is a card that can actually be bolted on, including the one the boundary check below installs",
  );

  const refusalLogs: string[] = [];
  const overPick = openAt24();
  const phaseBefore = overPick.phase;
  overPick._draftChoices = [cardOf("overdrive_engine")];
  handleModuleSelect(overPick, 0, refusalLogs);
  check(
    refusalLogs.some((line) =>
      line.includes("would put your hull at 27 power"),
    ) &&
      refusalLogs.some((line) =>
        line.includes(`a hull carries at most ${HELD_POWER_CAP}`),
      ) &&
      overPick.equippedModules.length === 2 &&
      overPick.phase === phaseBefore,
    "the install path is the floor under the roll's screen: a draft holding a three power module at twenty four is refused with the number a captain can check, the hull keeps its two modules, and the phase is left where it stands so another seat can be taken",
  );

  const boundaryPick = openAt24();
  boundaryPick._draftChoices = [cardOf("brokers_network")];
  const boundaryLogs: string[] = [];
  handleModuleSelect(boundaryPick, 0, boundaryLogs);
  check(
    boundaryPick.equippedModules.length === 3 &&
      boundaryPick.phase === "dusk" &&
      heldPower(boundaryPick) === HELD_POWER_CAP &&
      boundaryPick._draftChoices?.length === 0,
    "and the boundary installs end to end: a two power module on that hull lands at exactly the cap, the phase moves on, the pick leaves the pool, and the arithmetic the panels print is the arithmetic the engine took",
  );

  // A full hull at the cap: the light module on the first slot frees
  // two and the heavy one on the second frees five, so one five power
  // swap is refused and the other lands exactly on the cap.
  const swapState = () => {
    const state = voyageState();
    state.shipLevel = 3;
    state.equippedModules.push(
      cardOf("brokers_network"),
      cardOf("silk_monopoly"),
      cardOf("overdrive_engine"),
    );
    state.heldBoons.push(
      "cold_hardened",
      "route_mastery",
      "steady_watch",
      "harbor_credit",
    );
    state.charter = "the_factor";
    return state;
  };
  const settling = swapState();
  settling._newModule = cardOf("tax_evasion");
  const swapLogs: string[] = [];
  finalizeModuleSwap(settling, 0, swapLogs);
  const refusedSlot = swapLogs.some((line) =>
    line.includes("would put your hull at 29 power"),
  );
  finalizeModuleSwap(settling, 1, swapLogs);
  check(
    heldPower(swapState()) === HELD_POWER_CAP &&
      refusedSlot &&
      settling.equippedModules[1].id === "tax_evasion" &&
      settling._newModule === undefined &&
      settling.phase === "dusk",
    "the swap runs its arithmetic per slot: the same five power module is refused over the light slot that frees two power and taken over the heavy one that frees five, which is the displaced arm read at the seat the captain actually chose",
  );

  // [field report: the batch that would not change] The draft's once a
  // round swap, which is the second half of the field report against this
  // market. The reroll used to be the round's own draw run a second time
  // over the same candidates, and the candidates are the fitting pool
  // less what the hull already carries, so a full hull at a table whose
  // pool it has already seen in full had exactly one outcome left and the
  // swap re served the batch it was pressed to replace: the screen said a
  // fresh batch was coming and the same three cards stayed on it. What
  // the checks below hold is the shape of the repair: a swap draws
  // what the round has not shown, a swap that cannot fill three seats
  // from the unseen cards tops up from the table it replaces rather than
  // dealing an empty seat, and a yard with nothing left to deal refuses
  // in words with the round's one use unspent.
  const trioOf = (state: GameState): string[] =>
    (state._draftChoices ?? []).map((card) => card.id);
  const sortedTrio = (state: GameState): string =>
    [...trioOf(state)].sort().join("|");

  // A hull with room to spare at an Ocean Gambit table: eight modules are
  // live in this mode and this hull carries none, so the round showed
  // three of them and the swap has five it has never seen to draw from.
  const freshYard = voyageState();
  freshYard.shipLevel = 3;
  startModuleDrafting(freshYard);
  const freshBefore = trioOf(freshYard);
  // What a read of the question is allowed to touch, held as one string
  // so the check below is about the state rather than about one field of
  // it: the tally the roll writes, the table the round holds, and the use
  // the press spends.
  const swapRead = () =>
    JSON.stringify({
      tally: freshYard.cardTally,
      trio: trioOf(freshYard),
      used: freshYard.moduleSwapUsed,
    });
  const beforeRead = swapRead();
  const freshPossible = moduleSwapPossible(freshYard);
  check(
    freshPossible && swapRead() === beforeRead,
    "the swap's own question, which the button reads before the press, is a read: a hull with room around it answers yes and asking it writes no tally, no table and no use, which is the shape every door predicate in this yard keeps (see moduleDraftPossible)",
  );
  const freshLogs: string[] = [];
  swapModuleChoices(freshYard, freshLogs);
  const freshAfter = trioOf(freshYard);
  check(
    freshBefore.length === 3 &&
      freshYard.moduleSwapUsed &&
      freshAfter.length === 3 &&
      freshAfter.every((id) => !freshBefore.includes(id)) &&
      freshAfter.every((id) =>
        freshYard.equippedModules.every((card) => card.id !== id),
      ) &&
      freshLogs.some((line) => line.includes("fresh batch")),
    "and a swap on that hull deals a genuinely new trio: three cards the round has not shown, every seat of them a card this hull does not already carry, and the once a round use is what the press spends",
  );

  // The round's table is fixed once rolled, which the swap does not
  // change: backing out to the yard and drawing again reshow the batch
  // the swap dealt, card for card, because the only reroll the round has
  // is the one it just spent.
  cancelModuleDraft(freshYard);
  const backedOut = trioOf(freshYard);
  startModuleDrafting(freshYard);
  check(
    freshYard.phase === "module_draft" &&
      backedOut.join("|") === freshAfter.join("|") &&
      trioOf(freshYard).join("|") === freshAfter.join("|"),
    "and a captain who swaps, backs out to the yard and draws again is shown the batch the swap dealt in the order it dealt it rather than a third serving: the round's table is rolled once and the swap is the only way it moves",
  );

  // A hull carrying three of Ocean Gambit's eight: the round showed the
  // three it was dealt, five were candidates and the hull carries three
  // of them, so exactly two cards in the whole pool have never been on
  // this screen. Two seats fill from those and the third is topped up
  // from the table being replaced, because a swap that dealt two cards
  // is a broken screen rather than a tighter draft.
  const toppedUp = voyageState();
  toppedUp.shipLevel = 3;
  toppedUp.equippedModules.push(
    cardOf("smugglers_hold"),
    cardOf("bulk_hauler"),
    cardOf("artisans_workshop"),
  );
  startModuleDrafting(toppedUp);
  const toppedBefore = trioOf(toppedUp);
  const toppedLogs: string[] = [];
  swapModuleChoices(toppedUp, toppedLogs);
  const toppedAfter = trioOf(toppedUp);
  const repeats = toppedAfter.filter((id) => toppedBefore.includes(id));
  check(
    toppedBefore.length === 3 &&
      toppedUp.moduleSwapUsed &&
      sortedTrio(toppedUp) !== [...toppedBefore].sort().join("|") &&
      toppedAfter.length === 3 &&
      repeats.length === 1 &&
      toppedAfter.every(
        (id) =>
          cardById(id)?.kind === "module" &&
          toppedUp.equippedModules.every((card) => card.id !== id),
      ) &&
      toppedLogs.some((line) => line.includes("fresh batch")),
    "a swap on a hull that has seen most of the pool tops up rather than dealing short: two seats come from the cards this hull has never been shown and one from the batch being replaced, so even the swap that cannot fill three seats from the unseen cards hands back a different batch of three real modules",
  );

  // The same press at the two rungs of the ladder a hull can still have
  // room on: the level one hull carries nothing and the level two hull
  // carries one five power module beside its open slot. Both read the
  // open slot arm of the fit test, and both are hulls whose every unseen
  // card fits, so the checks are about the batch rather than about the
  // cap.
  const ladderHull = (level: number, ids: string[]) => {
    const state = voyageState();
    state.shipLevel = level;
    state.equippedModules.push(...ids.map((id) => cardOf(id)));
    return state;
  };
  const openSlotSwaps = [ladderHull(1, []), ladderHull(2, ["tax_evasion"])].map(
    (hull) => {
      startModuleDrafting(hull);
      const before = trioOf(hull);
      const logs: string[] = [];
      swapModuleChoices(hull, logs);
      return { hull, before, after: trioOf(hull), logs };
    },
  );
  check(
    openSlotSwaps.every(
      ({ hull, before, after, logs }) =>
        before.length === CARDS_PER_OFFER &&
        after.length === CARDS_PER_OFFER &&
        sortedTrio(hull) !== [...before].sort().join("|") &&
        after.every((id) => !before.includes(id)) &&
        after.every(
          (id) =>
            hull.equippedModules.every((card) => card.id !== id) &&
            moduleFitsHull(hull, cardOf(id)),
        ) &&
        logs.some((line) => line.includes("fresh batch")),
    ),
    "a swap on a hull with an open slot deals a genuinely new batch of three whatever rung it stands on: the level one hull and the level two hull each draw seats the round never showed, none of them a card the hull already carries, and every one a card the fit test would let that hull bolt on",
  );

  // The press on a hull standing exactly at the cap, which is the hull
  // every one of these gates was built for: five of the mode's eight
  // modules are still unseen and the hull carries three, so two seats
  // come from the unseen cards and the third is a top up from the table
  // being replaced. Every seat still passes the fit test, because the
  // swap arm of it weighs the card over the heaviest module the hull
  // could give up, which is the most room this hull can make.
  const cappedSwap = swapState();
  startModuleDrafting(cappedSwap);
  const cappedBefore = trioOf(cappedSwap);
  const cappedLogs: string[] = [];
  swapModuleChoices(cappedSwap, cappedLogs);
  const cappedAfter = trioOf(cappedSwap);
  check(
    heldPower(cappedSwap) === HELD_POWER_CAP &&
      cappedBefore.length === CARDS_PER_OFFER &&
      cappedAfter.length === CARDS_PER_OFFER &&
      cappedAfter.filter((id) => cappedBefore.includes(id)).length === 1 &&
      cappedAfter.every(
        (id) =>
          cappedSwap.equippedModules.every((card) => card.id !== id) &&
          moduleFitsHull(cappedSwap, cardOf(id)),
      ) &&
      cappedSwap.moduleSwapUsed,
    "a hull standing exactly at the cap still swaps to a whole batch, and every seat of it is a card that hull can actually take: the seats are read through the same fit test the roll screens with, so a card the cap would refuse is never dealt, and the batch is one seat from the table being replaced rather than the same three cards again",
  );

  // The corner the top up behind the fresh draw cannot reach. A Parley
  // trade lands a module on this hull between the roll and the press
  // (see applyModuleTradeSide), and three of them empty the table onto
  // it: what is left unseen is the two cards the round never showed and
  // there is nothing else to top up from, so before the last resort the
  // press dealt a two seat batch into a screen that promises a swap.
  const tradedOut = voyageState();
  tradedOut.shipLevel = 3;
  tradedOut.equippedModules.push(
    cardOf("smugglers_hold"),
    cardOf("bulk_hauler"),
    cardOf("artisans_workshop"),
  );
  startModuleDrafting(tradedOut);
  const tradedBefore = trioOf(tradedOut);
  for (const id of tradedBefore) tradedOut.equippedModules.push(cardOf(id));
  const tradedLogs: string[] = [];
  swapModuleChoices(tradedOut, tradedLogs);
  const tradedAfter = trioOf(tradedOut);
  check(
    tradedBefore.length === CARDS_PER_OFFER &&
      tradedOut.equippedModules.length === 6 &&
      tradedOut.moduleSwapUsed &&
      tradedAfter.length === CARDS_PER_OFFER &&
      sortedTrio(tradedOut) !== [...tradedBefore].sort().join("|") &&
      tradedAfter.every((id) => moduleFitsHull(tradedOut, cardOf(id))) &&
      tradedLogs.some((line) => line.includes("fresh batch")),
    "a table the round's own trades have emptied onto the hull still deals a whole batch: the three landed cards leave just the two modules this round never showed, and the swap falls back to the fitting pool the round's own roll reads when the unseen cards run out rather than dealing two seats and calling it a swap",
  );

  // The last resort reads the pool by id, so the duplicate a hull may
  // legitimately carry (the fallback pool above deals one whenever the
  // unseen cards run short, see rollModuleChoices) fills one seat rather
  // than two. This hull carries two copies of one module and three trades
  // land the whole table on it, which leaves two unseen cards and nothing
  // to top up from: the fallback pool deals the third seat, and the check
  // is that the seat it fills is one card, with every seat of the batch
  // distinct and fit for this hull.
  const twinSwap = voyageState();
  twinSwap.shipLevel = 3;
  twinSwap.equippedModules.push(
    cardOf("brokers_network"),
    cardOf("salvage_crane"),
    cardOf("overdrive_engine"),
    cardOf("brokers_network"),
  );
  startModuleDrafting(twinSwap);
  const twinBefore = trioOf(twinSwap);
  for (const id of twinBefore) twinSwap.equippedModules.push(cardOf(id));
  const twinSwapLogs: string[] = [];
  swapModuleChoices(twinSwap, twinSwapLogs);
  const twinAfter = trioOf(twinSwap);
  check(
    twinAfter.length === CARDS_PER_OFFER &&
      new Set(twinAfter).size === CARDS_PER_OFFER &&
      twinAfter.every((id) => moduleFitsHull(twinSwap, cardOf(id))) &&
      twinSwap.equippedModules.filter((card) => card.id === "brokers_network")
        .length === 2 &&
      twinSwap.equippedModules.length === 7 &&
      twinSwap.moduleSwapUsed,
    "a hull carrying the same module twice never draws it twice in one batch: the pools a swap reads hold cards rather than copies, so one id fills at most one seat, every seat of the batch is distinct and fit for this hull, and the swap leaves both copies bolted where they were",
  );

  // A Classic hull carrying three of the six modules that mode runs:
  // the round's table is the whole of what is left, so every module the
  // yard could deal this hull is on the screen already. The press is
  // refused in words and the round keeps its use, because a swap that
  // handed back the same three cards is not a swap the yard performed.
  const classicHeld = ["smugglers_hold", "bulk_hauler", "artisans_workshop"];
  const collapsed = voyageState({ mode: CLASSIC });
  collapsed.shipLevel = 3;
  collapsed.equippedModules.push(...classicHeld.map((id) => cardOf(id)));
  startModuleDrafting(collapsed);
  const collapsedLeftover = offerPool("module", collapsed)
    .map(([card]) => card.id)
    .filter((id) => !classicHeld.includes(id))
    .sort()
    .join("|");
  const collapsedBefore = sortedTrio(collapsed);
  const collapsedPossible = moduleSwapPossible(collapsed);
  const collapsedLogs: string[] = [];
  swapModuleChoices(collapsed, collapsedLogs);
  check(
    collapsedBefore === collapsedLeftover &&
      !collapsedPossible &&
      !collapsed.moduleSwapUsed &&
      sortedTrio(collapsed) === collapsedBefore &&
      collapsedLogs.some((line) => line.includes("nothing new")),
    "the reported collapse reads as a refusal rather than as a repeat: a Classic hull the round has shown every module it could be dealt draws a disabled swap and a press that is answered in words, the table stays where it was, and the once a round use is still the captain's to spend on a leg where the yard has something to deal",
  );

  // The three refusals as the captain reads them, held here rather than
  // as fragments: a press that changes nothing has to say why, and the
  // sentence is the whole of what the captain gets back for it. The
  // collapse above is the third one, read off its own press.
  check(
    collapsedLogs.some(
      (line) =>
        line ===
        "❌ The yard has nothing new to deal this hull: every module it could offer is either aboard or already on the table. Take one of these, sell one at the table, or come back next leg.",
    ) && !CARRIES_A_DASH.test(collapsedLogs.join(" ")),
    "the refusal a dry pool writes names the three ways forward in one sentence, and every line the press wrote is free of dashes like the rest of the game's copy",
  );

  // The press the field report's own screen makes twice: two dispatches in
  // one tick, which is what a double click is and what the reducer applies
  // one after the other against the state the first press left (see the
  // APPLY half of src/lib/session/reducer.ts). The round has one swap, and
  // what the second press must not do is deal a second batch out of the
  // seats the first one left.
  const twicePressed = voyageState();
  twicePressed.shipLevel = 3;
  startModuleDrafting(twicePressed);
  const tickBefore = trioOf(twicePressed);
  const tickLogs: string[] = [];
  swapModuleChoices(twicePressed, tickLogs);
  const afterFirstPress = trioOf(twicePressed);
  swapModuleChoices(twicePressed, tickLogs);
  check(
    tickBefore.length === CARDS_PER_OFFER &&
      afterFirstPress.length === CARDS_PER_OFFER &&
      afterFirstPress.every((id) => !tickBefore.includes(id)) &&
      trioOf(twicePressed).join("|") === afterFirstPress.join("|") &&
      twicePressed.moduleSwapUsed &&
      tickLogs.filter(
        (line) =>
          line === "❌ You've already swapped your module choices this round",
      ).length === 1,
    "two presses of the swap in one tick are one swap and one refusal: the round's use is what the second press meets, so the batch the first press dealt is the batch the screen keeps rather than a third draw from the seats that are left",
  );

  // The two ways a press can arrive with nothing to swap, read for the
  // order of the two guards as well as for the words: a captain with the
  // use already spent is told that, a captain with no table is told to
  // draft first, and neither press spends the round's one swap.
  const noTable = voyageState();
  const noTablePhase = noTable.phase;
  const noTableLogs: string[] = [];
  swapModuleChoices(noTable, noTableLogs);
  const spentFirst = voyageState();
  spentFirst.moduleSwapUsed = true;
  const spentLogs: string[] = [];
  swapModuleChoices(spentFirst, spentLogs);
  check(
    noTableLogs.some(
      (line) => line === "❌ Nothing to swap, draft your modules first",
    ) &&
      !noTable.moduleSwapUsed &&
      (noTable._draftChoices?.length ?? 0) === 0 &&
      noTable.phase === noTablePhase &&
      spentLogs.some(
        (line) =>
          line === "❌ You've already swapped your module choices this round",
      ) &&
      !spentLogs.some((line) => line.includes("Nothing to swap")),
    "a press on a table the yard has not dealt is refused for the table and a press on a spent round is refused for the use, in those two sentences rather than one: the use is read before the table, so a captain who has already swapped is never told to draft modules for a screen that is standing right there",
  );

  // The reload, which is the one rollback a captain causes without the
  // server: the whole save goes up as it stands, transients and all (see
  // use-auto-save), and the load path opens the room's seat over it (see
  // snapToCheckpoint and enterPhase). Both halves of the round's yard
  // ride the save, so the reload is a screen that looks again rather
  // than a round that rolls again.
  const reloaded = voyageState();
  reloaded.shipLevel = 3;
  startModuleDrafting(reloaded);
  const reloadBefore = trioOf(reloaded);
  const reloadLogs: string[] = [];
  swapModuleChoices(reloaded, reloadLogs);
  const reloadSwapped = trioOf(reloaded);
  const reloadCtx = { seedBase: "smoke:f7:reload", harborId: "harbor-f7" };
  snapToCheckpoint(reloaded, reloadCtx, reloaded.currentRound, "dusk", []);
  const afterReload = trioOf(reloaded);
  startModuleDrafting(reloaded);
  check(
    reloadBefore.length === CARDS_PER_OFFER &&
      reloadSwapped.length === CARDS_PER_OFFER &&
      reloadSwapped.every((id) => !reloadBefore.includes(id)) &&
      afterReload.join("|") === reloadSwapped.join("|") &&
      reloaded.phase === "module_draft" &&
      trioOf(reloaded).join("|") === reloadSwapped.join("|") &&
      reloaded.moduleSwapUsed,
    "a reload mid dusk cannot re deal the batch the room has seen: the save carries the round's table and the use that moved it, the load path opens the seat over that save rather than rolling, and the draft the reloaded captain walks back into holds the swapped batch card for card with the round's one use still spent",
  );

  // The same reload read the way a browser reads it rather than through
  // the seat move above: the save the client writes goes up as JSON (see
  // use-auto-save), and the load path parses it and heals it before any
  // screen reads it (see healLoadedVoyage). The round's table and the use
  // are transients the heal deliberately does not roll, so a captain
  // reloading into the yard meets the batch the swap dealt, card for card
  // and in the order it was dealt, with the round's one use still spent.
  const reloadHealed = voyageState();
  reloadHealed.shipLevel = 3;
  startModuleDrafting(reloadHealed);
  const reloadHealedLogs: string[] = [];
  swapModuleChoices(reloadHealed, reloadHealedLogs);
  const healedTrio = trioOf(reloadHealed);
  const loadedBack = JSON.parse(JSON.stringify(reloadHealed)) as GameState;
  healLoadedVoyage(loadedBack, { legacyRenownLevel: null });
  check(
    healedTrio.length === CARDS_PER_OFFER &&
      loadedBack.moduleSwapUsed &&
      JSON.stringify(trioOf(loadedBack)) === JSON.stringify(healedTrio) &&
      (loadedBack._draftChoices ?? []).every(
        (card) => cardById(card.id)?.kind === "module",
      ),
    "a reload through the path a browser takes keeps the swapped batch card for card: the save is JSON, the load path parses and heals it, the round's table and its one use survive the heal untouched, and every seat of it still resolves through the pool this build shipped",
  );

  // The hull that moves under the picker. A Parley module trade settles on
  // this captain's own machine when the agreement arrives, which can be
  // after the yard has opened, and the seller's side takes a module off
  // the hull without asking the screen (see applyModuleTradeSide). The row
  // a captain then presses names a seat the hull no longer carries.
  const soldAway = swapState();
  soldAway._newModule = cardOf("tax_evasion");
  soldAway.phase = "module_swap";
  const carriedBefore = soldAway.equippedModules.length;
  soldAway.equippedModules = soldAway.equippedModules.filter(
    (card) => card.id !== "silk_monopoly",
  );
  const soldLogs: string[] = [];
  finalizeModuleSwap(soldAway, carriedBefore - 1, soldLogs);
  check(
    soldLogs.some(
      (line) =>
        line ===
        "❌ That seat is no longer on your hull, so there is nothing there to replace. Back to Draft and take the card again: the yard fits it to the hull as it stands.",
    ) &&
      soldAway.equippedModules.length === carriedBefore - 1 &&
      soldAway._newModule?.id === "tax_evasion" &&
      soldAway.phase === "module_swap" &&
      soldLogs.every((line) => !line.includes("Swapped")),
    "and a press naming a seat the hull gave up is refused in words rather than swapping under the wrong module: the hull is left as the trade left it, the pick stays parked so Back to Draft still shows it, the screen stays where it is, and nothing is written as a swap the captain did not make",
  );

  // A hull carrying two of the same module, which the fallback pool above
  // deals whenever the unseen cards run short (see rollModuleChoices), so
  // the picker's rows are drawn one per seat and the press names the seat
  // rather than the card. The engine is the floor under that reading.
  const twins = voyageState();
  twins.shipLevel = 3;
  twins.equippedModules.push(
    cardOf("brokers_network"),
    cardOf("brokers_network"),
    cardOf("smugglers_hold"),
  );
  twins._newModule = cardOf("silk_monopoly");
  twins.phase = "module_swap";
  const twinLogs: string[] = [];
  finalizeModuleSwap(twins, 1, twinLogs);
  check(
    twins.equippedModules.filter((card) => card.id === "brokers_network")
      .length === 1 &&
      twins.equippedModules[0]?.id === "brokers_network" &&
      twins.equippedModules[1]?.id === "silk_monopoly" &&
      twins.equippedModules[2]?.id === "smugglers_hold" &&
      twins._newModule === undefined &&
      twinLogs.some((line) => line.includes("Swapped")),
    "and a hull carrying two of the same module swaps by seat rather than by card: the press names the second seat, one copy of the light module leaves, the card it was drafted for lands in that seat, and the copy on the seat beside it is untouched, which is the positional promise the picker's rows are keyed on",
  );

  // The tally a swap writes, which is the record the card conversion
  // report reads a voyage back through (see noteCardOffer in
  // @/lib/game/cards and scripts/cardConversion.ts): one offer is noted
  // per seat the batch deals and nothing else is, so a batch of three is
  // three counters a reader can hold against the table the captain saw.
  const tallySum = (tally: GameState["cardTally"]): number =>
    Object.values(tally).reduce((sum, entry) => sum + entry.offered, 0);
  const tallied = voyageState();
  tallied.shipLevel = 3;
  startModuleDrafting(tallied);
  const tallyBefore = JSON.parse(
    JSON.stringify(tallied.cardTally),
  ) as GameState["cardTally"];
  const talliedLogs: string[] = [];
  swapModuleChoices(tallied, talliedLogs);
  const talliedTrio = trioOf(tallied);
  const seatOffers = (id: string): number =>
    (tallied.cardTally[id]?.offered ?? 0) - (tallyBefore[id]?.offered ?? 0);
  check(
    talliedTrio.length === CARDS_PER_OFFER &&
      tallySum(tallied.cardTally) - tallySum(tallyBefore) === CARDS_PER_OFFER &&
      talliedTrio.every((id) => seatOffers(id) === 1),
    "a swap writes exactly three offers into the round's tally, one per seat the batch deals: the three fresh seats are each noted once, nothing else is noted at all, and the record a later reading is turned over starts at the table the captain actually saw",
  );

  // ========== F. The one home, and the settle the gates sit beside ==========

  const repoRoot = join(import.meta.dirname, "..", "..", "..");
  const sourceOf = (relative: string) =>
    readFileSync(join(repoRoot, ...relative.split("/")), "utf8");

  const finishers = sourceOf("src/server/realtime/conclusion/finishers.ts");
  check(
    finishers.includes("MAX_HELD_CARDS") &&
      finishers.includes(`from "@/lib/game/combinations"`) &&
      !finishers.includes("const MAX_HELD_CARDS"),
    "the bound on the held set has one home, the instrument's own module: the conclusion imports it rather than keeping a second 32 beside the column it writes",
  );

  check(
    /heldCards\s+String\s+@default\(""\)/.test(
      sourceOf("prisma/schema.prisma"),
    ),
    "the chronicle carries the held set as its own column, JSON text for the trace's own reason: read by the report and never by a query",
  );

  check(
    sourceOf("scripts/private-scan.ts").includes(
      `"src/lib/game/combinations.ts"`,
    ) &&
      existsSync(join(repoRoot, "scripts", "pairs.ts")) &&
      sourceOf("package.json").includes(`"report:pairs"`),
    "the instrument is registered where the win verdict's fourth reader belongs, and the reading has a script and a name: the private scan keeps its list current and the operator's nightly run is one command",
  );

  const settleFiles = [
    sourceOf("src/lib/game/engine/modules.ts"),
    sourceOf("src/server/realtime/wiring/module-trades.ts"),
  ];
  check(
    settleFiles.every(
      (text) =>
        !text.includes("HELD_POWER_CAP") && !text.includes("powerBudgetAllows"),
    ),
    "the agreed trade's settle never reads the budget: the buyer's guard lives on the buyer's panel and the settle stays unconditional, which is the F3 invariant the cap was deliberately not allowed to reach",
  );

  // The sources are read with their whitespace flattened, so a sentence
  // a formatter wrapped across two lines is still one sentence here, and
  // the two sentences below are held as the captain reads them rather
  // than as the JSX happens to break them.
  const flat = (text: string) => text.replace(/\s+/g, " ");
  const panels = [
    sourceOf("src/components/portmasters/game/phases/Shipyard.tsx"),
    sourceOf("src/components/portmasters/game/phases/ModuleSwap.tsx"),
    sourceOf("src/components/portmasters/game/ModuleMarket.tsx"),
  ].map(flat);
  const marketSentence =
    "Taking it would put your hull at ${powerAfterTaking(game, card)} power, and a hull carries at most ${HELD_POWER_CAP}.";
  const swapSentence = "carries at most {HELD_POWER_CAP}";
  check(
    panels.every((text) => text.includes("HELD_POWER_CAP")) &&
      panels[2].includes(marketSentence) &&
      panels[1].includes(swapSentence) &&
      panels[0].includes("Selling one at the Parley table makes room.") &&
      !CARRIES_A_DASH.test(marketSentence) &&
      !CARRIES_A_DASH.test(swapSentence),
    "every surface that gates a click names the constant rather than its number: the market row, the swap rows and the Shipyard's empty draft each read the one home, and the sentences a captain meets are free of dashes",
  );

  // The draft's swap button is the fourth surface that gates a click, and
  // the sentence under its disabled state is the one a captain reads when
  // the yard has nothing new to deal (see moduleSwapPossible).
  const draftPanel = flat(
    sourceOf("src/components/portmasters/game/phases/ModuleDraft.tsx"),
  );
  const emptySwapSentence =
    "Nothing new to deal: every module the yard could offer this hull is either on this table already or aboard. Take one of these, or come back next leg.";
  check(
    draftPanel.includes("moduleSwapPossible(game)") &&
      draftPanel.includes("swapModuleChoices(g, l)") &&
      draftPanel.includes(emptySwapSentence) &&
      !CARRIES_A_DASH.test(emptySwapSentence),
    "and the swap button reads the swap's own question before its press, with the disabled state explained in words rather than left silent, which is the same two part shape the Shipyard's Draft button has carried since the cap shipped",
  );

  // ========== G. The instrument ==========

  check(
    parseHeldCards(
      JSON.stringify(["alpha", "alpha", "", "beta", 7, null]),
    ).join("|") === "alpha|beta" &&
      parseHeldCards("not json").length === 0 &&
      parseHeldCards('{"a":1}').length === 0 &&
      parseHeldCards(undefined).length === 0 &&
      parseHeldCards("").length === 0,
    "the held set reads back defensively: repeats, empty strings and non strings drop, anything that is not an array of ids reads as empty the way an unreadable save does, and the empty column is a reading rather than a crash",
  );

  const flood = Array.from(
    { length: MAX_HELD_CARDS + 8 },
    (_, index) => `filler_${index}`,
  );
  const combinationsSource = sourceOf("src/lib/game/combinations.ts");
  check(
    parseHeldCards(JSON.stringify(flood)).length === MAX_HELD_CARDS &&
      !combinationsSource.includes("new Date") &&
      !combinationsSource.includes("db."),
    "the list is bounded by the same constant the writer bounds it with, because a row can also be written by hand, and the reduction reads no clock and no database, which is what lets this suite hold its arithmetic without one",
  );

  // The matrix's population, planted and named: eleven real cards, a
  // deliberately overpowered pair, a perfect pair under the floor, a
  // pair on the ceiling's line, one just under it, one loud by share
  // alone, and a win reservoir.
  const [
    pairA,
    pairB,
    pairC,
    pairD,
    pairE,
    pairF,
    pairG,
    pairH,
    pairI,
    pairJ,
    pairK,
  ] = CARDS.slice(0, 11).map((card) => card.id);
  const rows: { ids: string[]; won: boolean }[] = [];
  const addRows = (a: string, b: string, total: number, wins: number) => {
    for (let i = 0; i < total; i++) {
      rows.push({ ids: [a, b], won: i < wins });
    }
  };
  addRows(pairA, pairB, 50, 45);
  addRows(pairA, pairC, 30, 30);
  addRows(pairD, pairE, 50, 31);
  addRows(pairF, pairG, 50, 30);
  addRows(pairH, pairI, 100, 50);
  addRows(pairJ, pairK, 200, 60);
  const matrix = readPairs(rows);
  const pairOf = (one: string, other: string): PairRow | undefined =>
    matrix.pairs.find(
      (row) =>
        (row.a === one && row.b === other) ||
        (row.a === other && row.b === one),
    );

  const planted = pairOf(pairA, pairB);
  check(
    planted !== undefined &&
      planted.appearances === 50 &&
      planted.wins === 45 &&
      planted.rate !== null &&
      planted.rate >= PAIR_WIN_CEILING &&
      planted.share > PAIR_WIN_SHARE &&
      planted.flags.includes("win_rate") &&
      planted.flags.includes("share_of_wins"),
    "the plan's own health check: a deliberately planted overpowered pair, ten wins in fifty past the ceiling, fires both flags, and neither flag is possible without the appearances the floor asks for",
  );

  const atLine = pairOf(pairD, pairE);
  const underLine = pairOf(pairF, pairG);
  check(
    atLine !== undefined &&
      atLine.appearances === 50 &&
      atLine.rate === 0.62 &&
      atLine.flags.includes("win_rate") &&
      atLine.share <= PAIR_WIN_SHARE &&
      underLine !== undefined &&
      underLine.rate !== null &&
      underLine.rate < PAIR_WIN_CEILING &&
      underLine.flags.length === 0,
    "the ceiling is read the way the plan's sentence reads: a pair that has not stayed under sixty two percent has missed the target and is flagged at the line itself, and a pair a hair under it is silence",
  );

  const shareOnly = pairOf(pairH, pairI);
  const perfectUnder = pairOf(pairA, pairC);
  check(
    shareOnly !== undefined &&
      shareOnly.rate !== null &&
      shareOnly.rate < PAIR_WIN_CEILING &&
      shareOnly.share > PAIR_WIN_SHARE &&
      shareOnly.flags.length === 1 &&
      shareOnly.flags[0] === "share_of_wins" &&
      perfectUnder !== undefined &&
      perfectUnder.appearances < PAIR_APPEARANCE_FLOOR &&
      perfectUnder.rate === null &&
      perfectUnder.flags.length === 0,
    "the two flags are independent and both ride the same floor: a pair can be loud for its share of wins while its rate is ordinary, and a pair that won every one of thirty appearances is silence, because the count is what decides whether a rate means anything",
  );

  check(
    matrix.voyages === rows.length &&
      matrix.wins === 246 &&
      matrix.flagged.length === 4 &&
      matrix.pairs[0] === planted &&
      matrix.pairs[matrix.pairs.length - 1] === perfectUnder,
    "the reading's own totals: every row carried cards so every row votes, the wins are the share's denominator, the order puts the four loud pairs first and the unmeasurable one last, and the count of loud pairs is the four planted",
  );

  const ghosts = readPairs([
    { ids: [pairA, pairB, "ghost_one"], won: true },
    { ids: ["ghost_one", "ghost_two"], won: true },
    { ids: [pairA, "ghost_one"], won: true },
  ]);
  check(
    ghosts.voyages === 2 &&
      ghosts.wins === 2 &&
      ghosts.pairs.length === 1 &&
      ghosts.pairs[0].appearances === 1,
    "a retired id is not a card: it drops out of a row the way the save's own heal drops it, a row holding only retired ids counts as carrying nothing rather than diluting every share, and the pairs it could not form are not spoken for",
  );

  const doubled = readPairs([{ ids: [pairA, pairA, pairB], won: true }]);
  check(
    doubled.pairs.length === 1 &&
      doubled.pairs[0].a !== doubled.pairs[0].b &&
      doubled.pairs[0].appearances === 1,
    "a pair is a set of two cards: a doubled id is one card in it, two copies of one module are one card in it, and no row ever pairs a card with itself",
  );

  const lossless = readPairs([{ ids: [pairA, pairB], won: false }]);
  check(
    lossless.wins === 0 &&
      lossless.pairs[0].share === 0 &&
      Number.isFinite(lossless.pairs[0].share) &&
      readPairs([]).pairs.length === 0,
    "a season with no wins reads a share of zero rather than a division by nothing, and an empty table is an empty reading rather than a broken one, because the operator's first nightly run has no rows to stand on",
  );

  // ========== H. The barrel ==========

  check(
    "moduleDraftPossible" in engineBarrel &&
      "moduleSwapPossible" in engineBarrel &&
      !("rollModuleChoices" in engineBarrel) &&
      !("swapCandidates" in engineBarrel) &&
      !("rerollModuleChoices" in engineBarrel) &&
      !("moduleFitsHull" in engineBarrel) &&
      !("heaviestEquipped" in engineBarrel) &&
      !("powerRefusal" in engineBarrel),
    "only the two door questions cross the engine's barrel, the draft's and the swap's: the roll, the swap's own draw and its two candidate halves, the hull test, the heaviest slot and the refusal sentence stay in the yard's module, so a caller meets the cap the way the panel does",
  );
}
