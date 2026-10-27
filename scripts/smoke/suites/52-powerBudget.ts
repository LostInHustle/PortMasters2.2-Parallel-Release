// PortMasters 2.2 Parallel Release, smoke run: The power budget.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CARDS, cardById, cardRunsInMode, offerPool } from "@/lib/game/cards";
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
  CHARTER_ROUND,
  CHARTER_PATH,
  CHARTERS,
} from "@/lib/game/constants/charters";
import {
  CARDS_PER_OFFER,
  MILESTONE_BOONS,
  MODULES_TIER0,
} from "@/lib/game/constants/drafts";
import {
  MILESTONE_TRIGGERS,
  type MilestoneTrigger,
} from "@/lib/game/constants/milestones";
import { MAX_SHIP_LEVEL } from "@/lib/game/constants/ships";
import { difficultyConfig } from "@/lib/game/difficulty";
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
  snapToCheckpoint,
  startModuleDrafting,
  swapModuleChoices,
} from "@/lib/game/engine";
import {
  CARRIES_A_DASH,
  check,
  CLASSIC,
  GAMBIT,
  ledgerSentences,
  voyageState,
  withEnv,
} from "../harness";
import type { LedgerLine } from "@/lib/game/ledger";

/**
 * The power budget and the combination instrument, in four halves: the
 * cap that bounds what a captain can hold (the constant and the bounds it
 * is authored between, the two pure reads off the durable set, and every
 * gate at its live site: the two moment tables, the yard roll, the two
 * install paths and the market row), the floor the install paths keep
 * under the panels, the chronicle's held set and the pair matrix reduced
 * off it, and the one home for the bound the conclusion writes.
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
 * The instrument half carries its own health check: "its health check is
 * that it fires on a deliberately planted overpowered pair during
 * development", which is the planted pair the matrix rows below are built
 * around, in both of its flags.
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

  const deferLogs: LedgerLine[] = [];
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
  const stormLogs: LedgerLine[] = [];
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
  const recordLogs: LedgerLine[] = [];
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
    state.currentRound = CHARTER_ROUND;
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
    state.currentRound = CHARTER_ROUND;
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
  shut.currentRound = CHARTER_ROUND;
  const shutLogs: LedgerLine[] = [];
  check(
    charterChoices(shut).length === 0 &&
      !chartersOn(() => charterPending(shut)) &&
      !chartersOn(() => answerCharter(shut, ownIds[0], shutLogs)) &&
      shut.charter === null,
    "a hull too heavy for every charter reads an empty table, the moment is left off the screen rather than drawn with no exit, and an answer naming a card the filtered trio no longer deals is refused rather than trusted",
  );

  const taking = lightCharter(3);
  const takeLogs: LedgerLine[] = [];
  const takeOffered = charterChoices(taking)[0]?.id ?? "";
  check(
    chartersOn(() => answerCharter(taking, takeOffered, takeLogs)) &&
      taking.charter === takeOffered,
    "and on a hull that fits, the answer still stores the id it was offered, which is the write the whole moment exists for",
  );

  // ========== E. The yard ==========

  const freshHull = voyageState();
  freshHull.shipLevel = 1;
  startModuleDrafting(freshHull);
  check(
    freshHull.phase === "module_draft" &&
      (freshHull._draftChoices ?? []).length === CARDS_PER_OFFER,
    "the draft opens and deals three cards on a hull with its first slot, before the captain has changed anything: the yard asks for a hull to rig, not for a batch that already fits",
  );

  // A hull past the cap whose every module is out of reach. Three bolted
  // modules weigh twelve, five held boons thirteen and the factor five, so
  // the hull stands at thirty against a cap of twenty six. The heaviest
  // module aboard is five power, so even a two power card swapped over it
  // lands at twenty seven. Every card in the pool therefore answers false
  // to the fit test, which is exactly the batch the old roll filtered away
  // before the captain could see it.
  const overCapHull = () => {
    const state = voyageState();
    state.shipLevel = 3;
    state.equippedModules.push(
      cardOf("tax_evasion"),
      cardOf("silk_monopoly"),
      cardOf("brokers_network"),
    );
    state.heldBoons.push(
      "cold_hardened",
      "route_mastery",
      "steady_watch",
      "harbor_credit",
      "fleet_colors",
    );
    state.charter = "the_factor";
    return state;
  };
  const unfiltered = overCapHull();
  startModuleDrafting(unfiltered);
  const unfilteredPicks = unfiltered._draftChoices ?? [];
  check(
    heldPower(unfiltered) === 30 &&
      heldPower(unfiltered) > HELD_POWER_CAP &&
      unfiltered.phase === "module_draft" &&
      unfilteredPicks.length === CARDS_PER_OFFER &&
      new Set(unfilteredPicks.map((card) => card.id)).size ===
        CARDS_PER_OFFER &&
      unfilteredPicks.every((card) => !moduleFitsHull(unfiltered, card)),
    "the deal is not filtered by fit: a hull at thirty power, where no module can arrive by install or by the heaviest swap, is still dealt three distinct cards, and the captain can change the hull before any of them is judged",
  );

  // The open slotted hull at twenty four, which the routing checks below
  // read: two bolted modules leave the third slot open, and the ten power of
  // boons and the four power charter leave exactly the two power cards able
  // to fill it on top.
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

  const overPick = openAt24();
  overPick._draftChoices = [cardOf("overdrive_engine")];
  const overLogs: LedgerLine[] = [];
  handleModuleSelect(overPick, 0, overLogs);
  check(
    overPick._newModule?.id === "overdrive_engine" &&
      overPick.phase === "module_swap" &&
      overPick.equippedModules.length === 2 &&
      (overPick._draftChoices ?? []).some(
        (card) => card.id === "overdrive_engine",
      ) &&
      !ledgerSentences(overLogs).some((line) =>
        line.includes("would put your hull at"),
      ),
    "a three power module the open slot refuses at twenty four is not turned away: the pick parks it for the swap screen, where a five power module can make room, the hull keeps its two modules, and the table keeps the card until a slot is confirmed",
  );

  // The floor under the routing: a full hull whose heaviest module still
  // cannot make room for a five power card. The refusal prints the best
  // case total, after that replacement, rather than the open slot's total.
  const heavyYard = voyageState();
  heavyYard.shipLevel = 3;
  heavyYard.equippedModules.push(
    cardOf("brokers_network"),
    cardOf("overdrive_engine"),
    cardOf("artisans_workshop"),
  );
  heavyYard.heldBoons.push(
    "cold_hardened",
    "route_mastery",
    "steady_watch",
    "harbor_credit",
    "fleet_colors",
  );
  heavyYard.charter = "the_factor";
  heavyYard._draftChoices = [cardOf("tax_evasion")];
  const heavyLogs: LedgerLine[] = [];
  const heavyPhase = heavyYard.phase;
  handleModuleSelect(heavyYard, 0, heavyLogs);
  check(
    heldPower(heavyYard) === HELD_POWER_CAP &&
      !moduleFitsHull(heavyYard, cardOf("tax_evasion")) &&
      ledgerSentences(heavyLogs).some((line) =>
        line.includes("would put your hull at 28 power"),
      ) &&
      ledgerSentences(heavyLogs).some((line) =>
        line.includes(`a hull carries at most ${HELD_POWER_CAP}`),
      ) &&
      heavyYard.equippedModules.length === 3 &&
      (heavyYard._draftChoices ?? []).map((card) => card.id).join("|") ===
        "tax_evasion" &&
      heavyYard.phase === heavyPhase,
    "and a card the hull cannot take by either path is still refused with the best case number: a full hull at the cap whose heaviest module is three power reads twenty eight for a five power card, the hull keeps its three modules, the table keeps the card, and the phase stays where it stands so another seat can be taken",
  );

  const boundaryPick = openAt24();
  boundaryPick._draftChoices = [cardOf("brokers_network")];
  const boundaryLogs: LedgerLine[] = [];
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
  const swapLogs: LedgerLine[] = [];
  finalizeModuleSwap(settling, 0, swapLogs);
  const refusedSlot = ledgerSentences(swapLogs).some((line) =>
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
  // round batch change. The old press drew fresh cards and then filled the
  // remaining seats from the table being replaced, so one press could keep
  // two of the same three faces. It also asked whether three fitting cards
  // existed before the button could be pressed. What the checks below hold
  // is the repair: one press replaces every face with a card that was not
  // on the table, and the button is offered whenever the round's use is
  // unspent.
  const trioOf = (state: GameState): string[] =>
    (state._draftChoices ?? []).map((card) => card.id);

  // The content invariant a strict change rests on: a full hull, the table it
  // is replacing and a whole new batch are three sets of three, so the
  // starter pool has to hold all nine before the yard can promise that every
  // face changes without dealing a card the hull already carries.
  const starterFloor = MAX_SHIP_LEVEL + 2 * CARDS_PER_OFFER;
  const starterCount = (mode: GameMode): number =>
    MODULES_TIER0.filter((card) => cardRunsInMode(card, mode)).length;
  check(
    starterCount(CLASSIC) >= starterFloor &&
      starterCount(GAMBIT) >= starterFloor,
    "the starter module pool leaves room for the worst case a batch change meets: a full hull, the table it is changing and a whole fresh batch are three cards each, and both modes carry at least that many starter modules, so a capped hull can always replace every face without dealing a module it already has",
  );

  // The pool itself is a per captain view of the immutable catalog, not a
  // set of module instances the harbor hands out: one captain installing a
  // card changes only that captain's hull, and the card remains on offer to
  // every other captain. The check above the draw is the one a shared pool
  // would fail, since it would lose the installed id from the second pool.
  const installingCaptain = voyageState();
  installingCaptain.shipLevel = 3;
  const watchingCaptain = voyageState();
  watchingCaptain.shipLevel = 3;
  const watchingPoolBefore = offerPool("module", watchingCaptain).map(
    ([card]) => card.id,
  );
  installingCaptain._draftChoices = [cardOf("overdrive_engine")];
  handleModuleSelect(installingCaptain, 0, []);
  const watchingPoolAfter = offerPool("module", watchingCaptain).map(
    ([card]) => card.id,
  );
  check(
    installingCaptain.equippedModules.some(
      (card) => card.id === "overdrive_engine",
    ) &&
      watchingCaptain.equippedModules.length === 0 &&
      watchingCaptain._draftChoices === undefined &&
      watchingPoolBefore.join("|") === watchingPoolAfter.join("|") &&
      watchingPoolAfter.includes("overdrive_engine"),
    "the module pool is each captain's own view of one immutable catalog rather than a shared deck: a card one captain installs stays on offer to the next captain, whose hull and table are untouched, so no captain's acquisition can leave another captain short of a module or a batch",
  );

  // The floor above, held at every schedule a voyage can run: both modes,
  // every difficulty, every round from the opening to the last. A hull at
  // the ladder's top and a table of three leave at least three cards outside
  // both on each of them, and every press turns all three faces. The table
  // is seeded from the pool rather than drawn, so the state is the worst
  // case the yard can meet rather than a lucky roll.
  const schedules = ["fair_winds", "open_waters", "monsoon"] as const;
  const sweepFailures: string[] = [];
  let sweepTrials = 0;
  for (const mode of [CLASSIC, GAMBIT]) {
    for (const schedule of schedules) {
      const lastRound = difficultyConfig(schedule).rounds;
      for (let round = 1; round <= lastRound; round++) {
        const yard = voyageState({ mode, difficulty: schedule });
        yard.currentRound = round;
        yard.shipLevel = MAX_SHIP_LEVEL;
        const pool = offerPool("module", yard).map(([card]) => card.id);
        const hull = pool.slice(0, MAX_SHIP_LEVEL);
        const table = pool.slice(
          MAX_SHIP_LEVEL,
          MAX_SHIP_LEVEL + CARDS_PER_OFFER,
        );
        if (hull.length < MAX_SHIP_LEVEL || table.length < CARDS_PER_OFFER) {
          sweepFailures.push(
            `${mode}/${schedule}/R${round}: a pool of ${pool.length}`,
          );
          continue;
        }
        yard.equippedModules = hull.map((id) => cardOf(id));
        yard._draftChoices = table.map((id) => cardOf(id));
        const sweepLogs: LedgerLine[] = [];
        swapModuleChoices(yard, sweepLogs);
        sweepTrials += 1;
        const dealt = trioOf(yard);
        if (!yard.moduleSwapUsed) {
          sweepFailures.push(`${mode}/${schedule}/R${round}: refused`);
          continue;
        }
        if (
          dealt.length !== CARDS_PER_OFFER ||
          new Set(dealt).size !== CARDS_PER_OFFER ||
          dealt.some((id) => hull.includes(id) || table.includes(id))
        ) {
          sweepFailures.push(`${mode}/${schedule}/R${round}: a short batch`);
        } else if (
          !ledgerSentences(sweepLogs).some((line) =>
            line.includes("fresh deal"),
          )
        ) {
          sweepFailures.push(`${mode}/${schedule}/R${round}: no fresh deal`);
        }
      }
    }
  }
  if (sweepFailures.length > 0)
    console.log(`    [batch sweep] ${sweepFailures.slice(0, 3).join("; ")}`);
  const sweepExpected =
    schedules.reduce(
      (sum, schedule) => sum + difficultyConfig(schedule).rounds,
      0,
    ) * 2;
  check(
    sweepFailures.length === 0 && sweepTrials === sweepExpected,
    "a hull at the ladder's top changes its whole batch at every schedule the harbor runs: on both modes, all three difficulties and every round from the opening to the last, a full hull and a three card table leave at least three modules outside both, so the yard always deals three distinct cards that are neither aboard nor on the table and never refuses a whole batch",
  );

  // A hull with room to spare at an Ocean Gambit table: eleven modules are
  // live in this mode and this hull carries none, so the round shows three
  // and the press has eight it has not shown to draw from.
  const freshYard = voyageState();
  freshYard.shipLevel = 3;
  startModuleDrafting(freshYard);
  const freshBefore = trioOf(freshYard);
  const freshLogs: LedgerLine[] = [];
  swapModuleChoices(freshYard, freshLogs);
  const freshAfter = trioOf(freshYard);
  check(
    freshBefore.length === 3 &&
      freshYard.moduleSwapUsed &&
      freshAfter.length === 3 &&
      new Set(freshAfter).size === 3 &&
      freshAfter.every((id) => !freshBefore.includes(id)) &&
      freshYard.equippedModules.every(
        (card) => !freshAfter.includes(card.id),
      ) &&
      ledgerSentences(freshLogs).some((line) => line.includes("fresh deal")),
    "a press on a hull with room around it deals a genuinely new trio: three distinct cards, none of them a face the round already showed, none aboard, and the once a round use is what the press spends",
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

  // [field report: the batch that would not change] The promise the named
  // checks above pin, held over two hundred hulls a hand would not think to
  // build: both modes, every level, hulls carrying nothing and hulls
  // carrying most of the pool. Every pool here is larger than the table, so
  // every press has three cards outside it to deal and must succeed; the
  // checks hold each success to three distinct faces, none of them still on
  // the table and none of them aboard, and hold the opening table to the same
  // hull rule. The hulls and levels come from a local LCG seeded here rather
  // than from Math.random, so the run is the same run every time the battery
  // reads it, while the press's own draw stays the live draw the game runs.
  let fuzzSeed = 0x2f6e2b1;
  const fuzzNext = (): number => {
    fuzzSeed = (fuzzSeed * 1103515245 + 12345) & 0x7fffffff;
    return fuzzSeed / 0x7fffffff;
  };
  const fuzzFailures: string[] = [];
  let fuzzSuccesses = 0;
  for (let trial = 0; trial < 200; trial++) {
    const randomHull = voyageState({
      mode: trial % 2 === 0 ? GAMBIT : CLASSIC,
    });
    const level = 1 + Math.floor(fuzzNext() * MAX_SHIP_LEVEL);
    randomHull.shipLevel = level;
    const hullPool = offerPool("module", randomHull).map(([card]) => card.id);
    const order = [...hullPool].sort(() => fuzzNext() - 0.5);
    for (const id of order.slice(0, Math.min(level, order.length))) {
      randomHull.equippedModules.push(cardOf(id));
    }
    startModuleDrafting(randomHull);
    const replaced = trioOf(randomHull);
    const fuzzLogs: LedgerLine[] = [];
    swapModuleChoices(randomHull, fuzzLogs);
    const dealt = trioOf(randomHull);
    if (!randomHull.moduleSwapUsed) {
      fuzzFailures.push(`trial ${trial}: a pool with cards outside it refused`);
      continue;
    }
    fuzzSuccesses += 1;
    if (
      replaced.some((id) =>
        randomHull.equippedModules.some((card) => card.id === id),
      )
    )
      fuzzFailures.push(
        `trial ${trial}: the opening table offered a module aboard`,
      );
    if (dealt.length !== CARDS_PER_OFFER)
      fuzzFailures.push(`trial ${trial}: a batch of ${dealt.length}`);
    if (new Set(dealt).size !== dealt.length)
      fuzzFailures.push(`trial ${trial}: one seat dealt twice`);
    if (dealt.some((id) => replaced.includes(id)))
      fuzzFailures.push(`trial ${trial}: a face the table already showed`);
    if (
      dealt.some((id) =>
        randomHull.equippedModules.some((card) => card.id === id),
      )
    )
      fuzzFailures.push(`trial ${trial}: a module already aboard`);
    if (!ledgerSentences(fuzzLogs).some((line) => line.includes("fresh deal")))
      fuzzFailures.push(`trial ${trial}: a press that did not name its batch`);
  }
  if (fuzzFailures.length > 0)
    console.log(`    [swap fuzz] ${fuzzFailures.slice(0, 3).join("; ")}`);
  check(
    fuzzSuccesses === 200 && fuzzFailures.length === 0,
    "and the same promise holds over two hundred random hulls: the opening table never shows a module already aboard, every press deals a whole batch of three distinct cards, none of them a face the table already showed or a module already aboard, and the log names the fresh deal; no hull in either mode ever meets a disabled or recycling batch",
  );

  // The press on a hull standing exactly at the cap, which is the hull every
  // one of these gates was built for: three modules aboard and three on the
  // table leave five of Ocean Gambit's eleven outside both, so the press
  // deals three cards that are new to the table and new to the hull.
  const cappedSwap = swapState();
  startModuleDrafting(cappedSwap);
  const cappedBefore = trioOf(cappedSwap);
  const cappedLogs: LedgerLine[] = [];
  swapModuleChoices(cappedSwap, cappedLogs);
  const cappedAfter = trioOf(cappedSwap);
  check(
    heldPower(cappedSwap) === HELD_POWER_CAP &&
      cappedBefore.length === CARDS_PER_OFFER &&
      cappedAfter.length === CARDS_PER_OFFER &&
      new Set(cappedAfter).size === CARDS_PER_OFFER &&
      cappedAfter.every((id) => !cappedBefore.includes(id)) &&
      cappedAfter.every(
        (id) => !cappedSwap.equippedModules.some((card) => card.id === id),
      ) &&
      cappedSwap.moduleSwapUsed &&
      ledgerSentences(cappedLogs).some((line) => line.includes("fresh deal")),
    "a hull standing exactly at the cap still changes all three faces: the press deals three cards that are neither on the table nor aboard the hull, so every seat is new and the round's use is spent",
  );

  // The tightest pool a batch change can meet: a Classic hull carrying three
  // modules with the other six split between the table and the fresh batch.
  // The pool is nine because a full hull, a table and a whole new batch have
  // to fit at once. The press deals the three cards that are neither aboard
  // nor on the table, so every face changes and none is a module the hull
  // already carries.
  const classicHeld = ["smugglers_hold", "bulk_hauler", "artisans_workshop"];
  const classicTable = ["brokers_network", "salvage_crane", "overdrive_engine"];
  const cappedClassic = voyageState({ mode: CLASSIC });
  cappedClassic.shipLevel = 3;
  cappedClassic.equippedModules.push(...classicHeld.map((id) => cardOf(id)));
  cappedClassic._draftChoices = classicTable.map((id) => cardOf(id));
  startModuleDrafting(cappedClassic);
  const classicExpected = offerPool("module", cappedClassic)
    .map(([card]) => card.id)
    .filter((id) => !classicHeld.includes(id) && !classicTable.includes(id))
    .sort();
  const cappedClassicBefore = trioOf(cappedClassic);
  const cappedClassicLogs: LedgerLine[] = [];
  swapModuleChoices(cappedClassic, cappedClassicLogs);
  const cappedClassicAfter = trioOf(cappedClassic);
  check(
    cappedClassicBefore.join("|") === classicTable.join("|") &&
      classicExpected.length === CARDS_PER_OFFER &&
      cappedClassic.moduleSwapUsed &&
      cappedClassicAfter.length === CARDS_PER_OFFER &&
      new Set(cappedClassicAfter).size === CARDS_PER_OFFER &&
      [...cappedClassicAfter].sort().join("|") === classicExpected.join("|") &&
      cappedClassicAfter.every((id) => !classicHeld.includes(id)) &&
      ledgerSentences(cappedClassicLogs).some((line) =>
        line.includes("fresh deal"),
      ) &&
      !ledgerSentences(cappedClassicLogs).some((line) =>
        line.includes("Re-dealt"),
      ),
    "the tightest pool a batch change can meet still turns every face: a Classic hull with three modules aboard and three on the table deals the last three cards the mode carries, none of them aboard, so the change never recycles a face and never falls back to a module the hull already has",
  );

  // The same press on the hull past the cap: the unfiltered deal put three
  // cards on the table that this hull cannot take, and the press still
  // changes all three faces, because changing the batch is not a fit
  // question. The selection that follows is where the attempt is refused.
  const overCapSwap = overCapHull();
  startModuleDrafting(overCapSwap);
  const overCapBefore = trioOf(overCapSwap);
  const overCapLogs: LedgerLine[] = [];
  swapModuleChoices(overCapSwap, overCapLogs);
  const overCapAfter = trioOf(overCapSwap);
  check(
    heldPower(overCapSwap) === 30 &&
      overCapSwap.moduleSwapUsed &&
      overCapAfter.length === CARDS_PER_OFFER &&
      new Set(overCapAfter).size === CARDS_PER_OFFER &&
      overCapAfter.every((id) => !overCapBefore.includes(id)) &&
      overCapAfter.every(
        (id) => !overCapSwap.equippedModules.some((card) => card.id === id),
      ) &&
      ledgerSentences(overCapLogs).some((line) => line.includes("fresh deal")),
    "a hull past the cap changes its whole batch too: the press turns over all three faces on a hull no module can reach, because changing the table was never the fit question; the selection that follows is where the yard refuses",
  );

  // The refusal's guard: a table holding every module the yard has leaves
  // nothing outside the table or the hull, and the press must say so rather
  // than deal a short batch. The use stays unspent and the table stays put.
  const wholeTable = voyageState();
  wholeTable.shipLevel = 3;
  const wholePool = offerPool("module", wholeTable).map(([card]) => card);
  wholeTable._draftChoices = wholePool;
  const wholeBefore = trioOf(wholeTable);
  const wholeLogs: LedgerLine[] = [];
  swapModuleChoices(wholeTable, wholeLogs);
  check(
    wholeBefore.length === wholePool.length &&
      trioOf(wholeTable).join("|") === wholeBefore.join("|") &&
      !wholeTable.moduleSwapUsed &&
      ledgerSentences(wholeLogs).some(
        (line) =>
          line ===
          "❌ The yard cannot deal a whole new batch: fewer than three modules are outside this batch and your hull. Take one of these or come back next round.",
      ) &&
      !CARRIES_A_DASH.test(ledgerSentences(wholeLogs).join(" ")),
    "a table holding every module the yard could deal is refused in words without spending the round's use: fewer than three cards are outside the batch, so the table is left exactly as it was, the press names why, and every line it wrote is free of dashes",
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
  const tickLogs: LedgerLine[] = [];
  swapModuleChoices(twicePressed, tickLogs);
  const afterFirstPress = trioOf(twicePressed);
  swapModuleChoices(twicePressed, tickLogs);
  check(
    tickBefore.length === CARDS_PER_OFFER &&
      afterFirstPress.length === CARDS_PER_OFFER &&
      afterFirstPress.every((id) => !tickBefore.includes(id)) &&
      trioOf(twicePressed).join("|") === afterFirstPress.join("|") &&
      twicePressed.moduleSwapUsed &&
      ledgerSentences(tickLogs).filter(
        (line) =>
          line === "❌ You've already changed your module batch this round",
      ).length === 1,
    "two presses of the swap in one tick are one swap and one refusal: the round's use is what the second press meets, so the batch the first press dealt is the batch the screen keeps rather than a third draw from the seats that are left",
  );

  // The two ways a press can arrive with nothing to swap, read for the
  // order of the two guards as well as for the words: a captain with the
  // use already spent is told that, a captain with no table is told to
  // draft first, and neither press spends the round's one swap.
  const noTable = voyageState();
  const noTablePhase = noTable.phase;
  const noTableLogs: LedgerLine[] = [];
  swapModuleChoices(noTable, noTableLogs);
  const spentFirst = voyageState();
  spentFirst.moduleSwapUsed = true;
  const spentLogs: LedgerLine[] = [];
  swapModuleChoices(spentFirst, spentLogs);
  check(
    ledgerSentences(noTableLogs).some(
      (line) => line === "❌ Nothing to change, draft your modules first",
    ) &&
      !noTable.moduleSwapUsed &&
      (noTable._draftChoices?.length ?? 0) === 0 &&
      noTable.phase === noTablePhase &&
      ledgerSentences(spentLogs).some(
        (line) =>
          line === "❌ You've already changed your module batch this round",
      ) &&
      !ledgerSentences(spentLogs).some((line) =>
        line.includes("Nothing to change"),
      ),
    "a press on a table the yard has not dealt is refused for the table and a press on a spent round is refused for the use, in those two sentences rather than one: the use is read before the table, so a captain who has already swapped is never told to draft modules for a screen that is standing right there",
  );

  // The reload, which is the one rollback a captain causes without the
  // server: the whole save goes up as it stands, transients and all (see
  // use-auto-save), and the load path opens the harbor's seat over it (see
  // snapToCheckpoint and enterPhase). Both halves of the round's yard
  // ride the save, so the reload is a screen that looks again rather
  // than a round that rolls again.
  const reloaded = voyageState();
  reloaded.shipLevel = 3;
  startModuleDrafting(reloaded);
  const reloadBefore = trioOf(reloaded);
  const reloadLogs: LedgerLine[] = [];
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
    "a reload mid dusk cannot re deal the batch the harbor has seen: the save carries the round's table and the use that moved it, the load path opens the seat over that save rather than rolling, and the draft the reloaded captain walks back into holds the swapped batch card for card with the round's one use still spent",
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
  const reloadHealedLogs: LedgerLine[] = [];
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
  const soldLogs: LedgerLine[] = [];
  finalizeModuleSwap(soldAway, carriedBefore - 1, soldLogs);
  check(
    ledgerSentences(soldLogs).some(
      (line) =>
        line ===
        "❌ That seat is no longer on your hull, so there is nothing there to replace. Back to Draft and take the card again: the yard fits it to the hull as it stands.",
    ) &&
      soldAway.equippedModules.length === carriedBefore - 1 &&
      soldAway._newModule?.id === "tax_evasion" &&
      soldAway.phase === "module_swap" &&
      ledgerSentences(soldLogs).every((line) => !line.includes("Swapped")),
    "and a press naming a seat the hull gave up is refused in words rather than swapping under the wrong module: the hull is left as the trade left it, the pick stays parked so Back to Draft still shows it, the screen stays where it is, and nothing is written as a swap the captain did not make",
  );

  // The duplicate doors, which the draw now closes. A table saved by a build
  // that could deal an equipped module is still refused when a card is
  // taken, and a parked pick from such a table is refused when a seat is
  // pressed. Neither path may add a second copy.
  const duplicatePick = voyageState();
  duplicatePick.shipLevel = 3;
  duplicatePick.equippedModules.push(
    cardOf("brokers_network"),
    cardOf("smugglers_hold"),
    cardOf("bulk_hauler"),
  );
  duplicatePick._draftChoices = [cardOf("brokers_network")];
  const duplicatePickPhase = duplicatePick.phase;
  const duplicatePickLogs: LedgerLine[] = [];
  handleModuleSelect(duplicatePick, 0, duplicatePickLogs);
  check(
    duplicatePick.equippedModules.filter(
      (card) => card.id === "brokers_network",
    ).length === 1 &&
      duplicatePick.equippedModules.length === 3 &&
      duplicatePick.phase === duplicatePickPhase &&
      (duplicatePick._draftChoices ?? []).map((card) => card.id).join("|") ===
        "brokers_network" &&
      duplicatePick._newModule === undefined &&
      ledgerSentences(duplicatePickLogs).some((sentence) =>
        sentence.includes("already bolted to your hull"),
      ) &&
      !ledgerSentences(duplicatePickLogs).some(
        (sentence) =>
          sentence.includes("Swapped") || sentence.includes("Installed"),
      ),
    "a table card the hull already carries is refused before the fit test: the hull keeps one copy, the table keeps the card, the phase stays where it was, and the ledger says why rather than installing a second module or parking it for a swap",
  );

  const duplicateSwap = voyageState();
  duplicateSwap.shipLevel = 3;
  duplicateSwap.equippedModules.push(
    cardOf("brokers_network"),
    cardOf("smugglers_hold"),
  );
  duplicateSwap._draftChoices = [cardOf("brokers_network")];
  duplicateSwap._newModule = cardOf("brokers_network");
  duplicateSwap.phase = "module_swap";
  const duplicateSwapLogs: LedgerLine[] = [];
  finalizeModuleSwap(duplicateSwap, 1, duplicateSwapLogs);
  check(
    duplicateSwap.equippedModules.length === 2 &&
      duplicateSwap.equippedModules.filter(
        (card) => card.id === "brokers_network",
      ).length === 1 &&
      duplicateSwap._newModule?.id === "brokers_network" &&
      duplicateSwap.phase === "module_swap" &&
      ledgerSentences(duplicateSwapLogs).some((sentence) =>
        sentence.includes("already bolted to your hull"),
      ) &&
      !ledgerSentences(duplicateSwapLogs).some((sentence) =>
        sentence.includes("Swapped"),
      ),
    "and a parked pick the hull already carries is refused before the seat is read: the hull is left as it stood, the pick stays parked for Back to Draft, and no swap is written for a second copy the yard will not fit",
  );

  // A save written before the rule can carry the same module twice on the
  // hull and again on the table. The load path drops the repeats, the table
  // entry the hull now holds, and the parked pick that belonged to it, so the
  // screen a captain reloads into cannot offer a module already aboard.
  const staleSave = voyageState();
  staleSave.shipLevel = 3;
  staleSave.equippedModules.push(
    cardOf("bulk_hauler"),
    cardOf("bulk_hauler"),
    cardOf("brokers_network"),
  );
  staleSave._draftChoices = [
    cardOf("brokers_network"),
    cardOf("salvage_crane"),
    cardOf("salvage_crane"),
  ];
  staleSave._newModule = cardOf("brokers_network");
  const healedHull = JSON.parse(JSON.stringify(staleSave)) as GameState;
  healLoadedVoyage(healedHull, { legacyRenownLevel: null });
  check(
    healedHull.equippedModules.length === 2 &&
      new Set(healedHull.equippedModules.map((card) => card.id)).size === 2 &&
      healedHull.shipUpgradePenalty === 15 &&
      (healedHull._draftChoices ?? []).map((card) => card.id).join("|") ===
        "salvage_crane" &&
      healedHull._newModule === undefined,
    "a save carrying a repeated module heals to one copy per card: the hull's extra entry and its surcharge are dropped, the table loses the card the hull now holds and the repeat beside it, and the parked pick that named the duplicate is cleared, so a reload cannot put the same module in front of a captain twice",
  );

  // The other overfull hull: four distinct modules aboard, which the Parley
  // trade could once produce when two accepts raced the slot check. The load
  // holds the hull to the ladder's top, keeps the first three in the saved
  // order and reconciles the surcharges from them, so the yard is not left
  // with only two cards outside a full hull and its table. The press below
  // is the proof: the tightest Classic pool still deals a whole batch.
  const overfullSave = voyageState({ mode: CLASSIC });
  overfullSave.shipLevel = MAX_SHIP_LEVEL;
  overfullSave.equippedModules = [
    "overdrive_engine",
    "bulk_hauler",
    "smugglers_hold",
    "brokers_network",
  ].map((id) => cardOf(id));
  const clampedHull = JSON.parse(JSON.stringify(overfullSave)) as GameState;
  healLoadedVoyage(clampedHull, { legacyRenownLevel: null });
  startModuleDrafting(clampedHull);
  const clampedBefore = trioOf(clampedHull);
  const clampedLogs: LedgerLine[] = [];
  swapModuleChoices(clampedHull, clampedLogs);
  const clampedAfter = trioOf(clampedHull);
  check(
    clampedHull.equippedModules.length === MAX_SHIP_LEVEL &&
      clampedHull.equippedModules.map((card) => card.id).join("|") ===
        "overdrive_engine|bulk_hauler|smugglers_hold" &&
      clampedHull.maintenancePenalty === 10 &&
      clampedHull.shipUpgradePenalty === 15 &&
      clampedHull.moduleSwapUsed &&
      clampedBefore.length === CARDS_PER_OFFER &&
      clampedAfter.length === CARDS_PER_OFFER &&
      new Set(clampedAfter).size === CARDS_PER_OFFER &&
      clampedAfter.every((id) => !clampedBefore.includes(id)) &&
      clampedAfter.every(
        (id) => !clampedHull.equippedModules.some((card) => card.id === id),
      ) &&
      ledgerSentences(clampedLogs).some((line) => line.includes("fresh deal")),
    "a save carrying more distinct modules than the hull has slots heals to the ladder's top and the yard can still change a whole batch: the first three in the saved order stay, both surcharges are read back from them, the table is dealt fresh, and every face the press turns is neither aboard nor on the old table, so damage that once left only two cards outside the hull can no longer strand a captain without a batch",
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
  const talliedLogs: LedgerLine[] = [];
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
    "the agreed trade's settle never reads the budget: the buyer's guard lives on the buyer's panel and the settle stays unconditional, which is the module trade invariant the cap was deliberately not allowed to reach",
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
    "Taking it would put your hull at {newPower} power, and a hull carries at most {HELD_POWER_CAP}.";
  // The sentence travels through the reader, so the binding is asserted
  // beside it: the two values the words are handed are the reader and the
  // constant, which is the claim this check was written for.
  const marketBinding =
    "{ newPower: powerAfterTaking(game, card), HELD_POWER_CAP }";
  const swapSentence = "carries at most {HELD_POWER_CAP}";
  check(
    panels.every((text) => text.includes("HELD_POWER_CAP")) &&
      panels[2].includes(marketSentence) &&
      panels[2].includes(marketBinding) &&
      panels[1].includes(swapSentence) &&
      panels[0].includes("const canDraft = game.shipLevel > 0") &&
      !panels[0].includes("moduleDraftPossible(game)") &&
      !CARRIES_A_DASH.test(marketSentence) &&
      !CARRIES_A_DASH.test(swapSentence),
    "every surface that gates a click names the constant rather than its number: the market row and the swap rows each read the one home, and the Shipyard's door opens for any hull with a slot while leaving the fit to the draft screen, where a captain can change the hull before the yard judges it",
  );

  // The draft's batch button is the surface that gates the batch change: it
  // is enabled for any round whose use is unspent, and it makes no fit
  // judgment before the press. Every card is offered as a choice, and the
  // empty table says plainly that a fresh set is rolled each round rather
  // than telling the captain which cards fit.
  const draftPanel = flat(
    sourceOf("src/components/portmasters/game/phases/ModuleDraft.tsx"),
  );
  const emptyTableSentence =
    "No module choices are on offer right now. A fresh set is rolled each round.";
  check(
    draftPanel.includes("const canSwap = !game.moduleSwapUsed;") &&
      draftPanel.includes("swapModuleChoices(g, l)") &&
      draftPanel.includes('actionLabel={t("Choose")}') &&
      draftPanel.includes("disabled={!canSwap}") &&
      draftPanel.includes(emptyTableSentence) &&
      !draftPanel.includes("moduleSwapPossible") &&
      !draftPanel.includes("moduleDraftPossible") &&
      !draftPanel.includes("moduleFitsHull") &&
      !draftPanel.includes("HELD_POWER_CAP") &&
      !draftPanel.includes("powerBudgetAllows") &&
      !draftPanel.includes("moduleSlotsOpen") &&
      !draftPanel.includes('t("Swap")') &&
      !draftPanel.includes('t("Install")') &&
      !draftPanel.includes("Selling one at the Parley table makes room.") &&
      !CARRIES_A_DASH.test(emptyTableSentence),
    "the batch button is enabled for any round whose use is unspent and makes no fit judgment before the press: every card is offered as a choice, the empty table says a fresh set is rolled each round, and the removed fit predicates and Install or Swap labels are gone from the panel",
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
    "the design's own health check: a deliberately planted overpowered pair, ten wins in fifty past the ceiling, fires both flags, and neither flag is possible without the appearances the floor asks for",
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
    "the ceiling is read the way the design's sentence reads: a pair that has not stayed under sixty two percent has missed the target and is flagged at the line itself, and a pair a hair under it is silence",
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

  // The barrel is how the screens reach the yard. The batch rewrite removed
  // both door predicates rather than keeping a second way to ask, and the
  // private machinery the press now runs on stays private.
  check(
    !("moduleDraftPossible" in engineBarrel) &&
      !("moduleSwapPossible" in engineBarrel) &&
      !("rollModuleChoices" in engineBarrel) &&
      !("drawModuleBatch" in engineBarrel) &&
      !("swapCandidates" in engineBarrel) &&
      !("rerollModuleChoices" in engineBarrel) &&
      !("arrangeModuleSeats" in engineBarrel) &&
      !("moduleFitsHull" in engineBarrel) &&
      !("moduleInstallsDirectly" in engineBarrel) &&
      !("moduleSwapsIn" in engineBarrel) &&
      !("heaviestEquipped" in engineBarrel) &&
      !("powerRefusal" in engineBarrel),
    "the barrel carries neither of the removed door predicates and none of the yard's private machinery: the batch draw, the roll, the hull test and its two arms, the heaviest slot and the refusal sentence all stay in the yard's module, so a caller meets the cap through the press the panel makes",
  );

  // The rewrite's home: one batch draw serves both the opening roll and the
  // press, and the helpers the old two stage reroll needed are gone rather
  // than left unreferenced. The draw filters the table and the hull in one
  // pool and has no fallback that would fill a seat from the equipped set. A
  // fresh deal also clears any pick parked on the table it replaces, so a
  // stale choice cannot survive the press.
  const boonsSource = sourceOf("src/lib/game/engine/boons.ts");
  check(
    boonsSource.includes("function drawModuleBatch(") &&
      boonsSource.includes("drawModuleBatch(state, new Set())") &&
      boonsSource.includes("drawModuleBatch(state, table)") &&
      boonsSource.includes(
        "new Set(state._draftChoices.map((card) => card.id))",
      ) &&
      boonsSource.includes(
        "!excluded.has(card.id) && !equipped.has(card.id)",
      ) &&
      !boonsSource.includes("CARDS_PER_OFFER - picks.length") &&
      boonsSource.includes("function alreadyAboard(") &&
      boonsSource.includes("function duplicateRefusal(") &&
      !boonsSource.includes("function swapCandidates(") &&
      !boonsSource.includes("function arrangeModuleSeats(") &&
      !boonsSource.includes("function rerollModuleChoices(") &&
      !boonsSource.includes("function moduleDraftPossible(") &&
      !boonsSource.includes("function moduleSwapPossible(") &&
      !boonsSource.includes("Re-dealt the same module batch") &&
      boonsSource.includes("state._newModule = undefined;"),
    "the yard's module keeps one batch draw and none of the helpers the rewrite removed: the draw filters the table and the hull in one pass, has no fallback that fills a seat from the equipped set, and both doors refuse a duplicate the draw could no longer deal, so every face changes without a module the hull already carries",
  );
}
