// PortMasters 2.2 Parallel Release, smoke run: The milestone boons.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BOONS,
  CARDS_PER_OFFER,
  MILESTONE_BOONS,
} from "@/lib/game/constants/drafts";
import {
  MILESTONE_MOMENTS,
  MILESTONE_TRIGGERS,
  normalizeMilestoneTrigger,
  type MilestoneTrigger,
} from "@/lib/game/constants/milestones";
import { MERCHANT_RATINGS } from "@/lib/game/constants/reputation";
import {
  cardById,
  cardLead,
  cardText,
  cardWeight,
  shippedCards,
  validateCards,
} from "@/lib/game/cards";
import {
  heldBoonCards,
  heldFlagsOf,
  normalizeHeldBoons,
} from "@/lib/game/held-cards";
import {
  milestoneChoices,
  milestoneDue,
  milestonePending,
  normalizeMilestoneOffers,
  normalizeMilestonesAnswered,
  rungsOf,
} from "@/lib/game/milestones";
import {
  answerMilestone,
  noteSettlementMilestones,
  queueMilestoneMoment,
} from "@/lib/game/engine/milestones";
import * as engineBarrel from "@/lib/game/engine";
import {
  completeOrder,
  deliverToObjective,
  nextPhase,
  pathOrderOf,
  snapToCheckpoint,
  startBoonDrafting,
} from "@/lib/game/engine";
import { selectBoon } from "@/lib/game/engine/boons";
import { calcVAT, explainVAT } from "@/lib/game/engine/pricing";
import { pirateChance } from "@/lib/game/engine/pirates";
import { hireWorker } from "@/lib/game/engine/workers";
import { COLD_LEG_WARMTH } from "@/lib/game/constants/garments";
import { legIsCold, shortOfWarmth, warmthScore } from "@/lib/game/garments";
import { feedCrew } from "@/lib/game/larder";
import { milestoneBoonsOn } from "@/lib/game/flags";
import { OBJECTIVE_DECK } from "@/lib/game/objectives";
import type { PathId } from "@/lib/game/paths";
import {
  MODIFIER_KEYS,
  type GameState,
  type ModifierKey,
  type OrderCard,
  type Phase,
} from "@/lib/game/types";
import { healLoadedVoyage } from "@/lib/session/heal-save";
import { PRODUCT_PRICES } from "@/lib/game/constants/goods";
import { readStoredRecord, TELEMETRY_EVENT_CAP } from "@/lib/game/telemetry";
import {
  closeVoyageTelemetry,
  noteLegReport,
  noteTelemetry,
  openVoyageTelemetry,
} from "@/server/realtime/telemetry";
import { db } from "@/lib/db";
import {
  CARRIES_A_DASH,
  CLASSIC,
  GAMBIT,
  carriesADash,
  check,
  suffix,
  switchFor,
  voyageState,
  withEnv,
} from "../harness";

export async function milestoneBoonsSuite(): Promise<void> {
  // A voyage that has lost a hand, which is the one moment every block
  // below can arm without a second system standing behind it.
  const fallen = () => {
    const state = voyageState();
    state.crewLost = [{ name: "Old Salt", round: 1 }];
    return state;
  };

  // A cold leg and a mild one, found by asking the weather rule rather
  // than written down as numbers that were cold once. 4242 is the epoch
  // the launch gates' own weather checks sail under, so the two suites
  // read the same calendar.
  const calendar = voyageState();
  calendar.voyageEpoch = 4242;
  const findRound = (cold: boolean) => {
    for (let round = 1; round <= 60; round++) {
      calendar.currentRound = round;
      if (legIsCold(calendar) === cold) return round;
    }
    return -1;
  };
  const coldRound = findRound(true);
  const mildRound = findRound(false);

  // A cold leg that has just been settled: the round stamped by the tick
  // and nothing else written yet, which is exactly the evidence the cold
  // moment's arm reads.
  const coldAt = (round: number) => {
    const state = voyageState();
    state.voyageEpoch = 4242;
    state.currentRound = round;
    state.garmentsTickRound = round;
    return state;
  };

  // One order board dealt from one seed and one round, so every run below
  // stands on identical cards and the only difference between two runs is
  // the one thing a check is about. The round is a parameter because
  // which round deals the shape a check needs is the board's business
  // rather than something a check may assume: the round one board misses
  // a pathbound order about one deal in eight, so a scan that wants one
  // walks the twelve rather than betting on the first.
  const dealBoard = (round: number) => {
    const state = voyageState();
    snapToCheckpoint(
      state,
      { seedBase: `smoke:milestones:${suffix}`, harborId: "harbor-a" },
      round,
      "orders",
      [],
    );
    return state;
  };
  const stockHold = (state: GameState, order: OrderCard) => {
    for (const r of order.resources) {
      state.inventory[r.type] =
        (state.inventory[r.type] ?? 0) + (r.required ?? 0);
    }
  };

  // ========== A. The vocabulary ==========

  check(
    MILESTONE_TRIGGERS.join() ===
      "crew_loss,pathbound_order,renown_rung,cold_leg,mandate",
    "the five triggers are the plan's five in the plan's order, so the vocabulary can be held against the plan text line by line",
  );

  check(
    MILESTONE_TRIGGERS.every(
      (trigger) =>
        normalizeMilestoneTrigger(trigger) === trigger &&
        MILESTONE_MOMENTS[trigger].icon.length > 0 &&
        MILESTONE_MOMENTS[trigger].title.length > 0 &&
        MILESTONE_MOMENTS[trigger].line.length > 0,
    ) &&
      normalizeMilestoneTrigger("losing_a_hand") === null &&
      normalizeMilestoneTrigger(7) === null &&
      MILESTONE_BOONS.length === MILESTONE_TRIGGERS.length &&
      MILESTONE_BOONS.every(
        (card) =>
          card.trigger !== "boon_draft" &&
          normalizeMilestoneTrigger(card.trigger) !== null,
      ) &&
      MILESTONE_TRIGGERS.every((trigger) =>
        MILESTONE_BOONS.some((card) => card.trigger === trigger),
      ),
    "every trigger round trips through its normalizer and every trigger is the trigger of exactly one moment card, so the vocabulary the save carries and the family the pool deals are the same five",
  );

  // The switch's own policy, read through the function every switch in
  // this tree is read through: on unless the operator says otherwise,
  // and answered inside one mode and no other.
  check(
    [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
      withEnv(
        "NEXT_PUBLIC_MILESTONE_BOONS",
        value,
        switchFor(GAMBIT, milestoneBoonsOn),
      ),
    ) &&
      ["off", "0", "OFF", " off ", "Off"].every(
        (value) =>
          !withEnv(
            "NEXT_PUBLIC_MILESTONE_BOONS",
            value,
            switchFor(GAMBIT, milestoneBoonsOn),
          ),
      ),
    "the milestone boons are on for every value except the word off and the digit zero, which is the policy every switch in this tree is read through",
  );

  check(
    withEnv(
      "NEXT_PUBLIC_MILESTONE_BOONS",
      "1",
      () =>
        milestoneBoonsOn(GAMBIT) &&
        !milestoneBoonsOn(CLASSIC) &&
        !milestoneBoonsOn("some_future_mode"),
    ),
    "and the eleventh switch is a gambit system like its ten siblings: a rollback turned all the way on still leaves the founding mode without a single moment",
  );

  check(
    MILESTONE_TRIGGERS.every(
      (trigger) =>
        !CARRIES_A_DASH.test(MILESTONE_MOMENTS[trigger].title) &&
        !CARRIES_A_DASH.test(MILESTONE_MOMENTS[trigger].line),
    ) &&
      MILESTONE_BOONS.every((card) =>
        Object.values(card.strings).every(
          (strings) =>
            !CARRIES_A_DASH.test(strings.name) &&
            !CARRIES_A_DASH.test(strings.desc),
        ),
      ),
    "every captain facing string a moment prints is dash free in both languages, by the house rule the card pool already answers to",
  );

  check(
    [
      "src/lib/game/milestones.ts",
      "src/lib/game/constants/milestones.ts",
      "src/lib/game/engine/milestones.ts",
      "src/components/portmasters/game/phases/MilestoneDraft.tsx",
      "src/components/portmasters/game/status/HeldBoons.tsx",
      "src/components/portmasters/game/phases/MomentOverlay.tsx",
    ].every((relative) => !carriesADash(relative)),
    "and the six files the feature is written in hold the rule too, comments included, because the directive is about the record the next maintainer reads and not only about the strings a captain meets",
  );

  // ========== B. The five cards ==========

  // The flag each card writes, and the value, read off the design rather
  // than off the card, so a retuned effect fails here rather than
  // agreeing with itself.
  const expectedFlags: Record<string, [string, number]> = {
    steady_watch: ["steady_rations", 1],
    cold_hardened: ["cold_hardened", 1],
    route_mastery: ["route_mastery", 0.25],
    harbor_credit: ["harbor_credit", 0.25],
    fleet_colors: ["fleet_color", 0.25],
  };

  check(
    MILESTONE_BOONS.every((card) => {
      const expected = expectedFlags[card.id];
      if (expected === undefined) return false;
      const [key, value] = expected;
      return (
        card.kind === "boon" &&
        card.trigger !== "boon_draft" &&
        card.effect.kind === "flags" &&
        Object.keys(card.effect.flags).length === 1 &&
        card.effect.flags[key as ModifierKey] === value
      );
    }),
    "each moment card writes exactly one flag and the flag is the one its boon is named for: rations saved, warmth hardened, a quarter on the path's orders, a quarter off the dues, and a quarter off the raiders' odds",
  );

  check(
    [
      "steady_rations",
      "cold_hardened",
      "route_mastery",
      "harbor_credit",
      "fleet_color",
    ].every((key) => (MODIFIER_KEYS as readonly string[]).includes(key)),
    "and the five keys the cards write are five members of the closed flag vocabulary, so the effect a moment leaves on the voyage is a key the save, the healer and every reader already know",
  );

  check(
    MILESTONE_BOONS.every((card) => cardById(card.id) === card) &&
      MILESTONE_BOONS.every((card) => BOONS.includes(card)) &&
      new Set(MILESTONE_BOONS.map((card) => card.id)).size ===
        MILESTONE_BOONS.length,
    "the five join the round boon pool by the same records rather than by copies, so a retuned moment card is the card the round draft would deal and the card a held list resolves to, and no id is carried twice",
  );

  check(
    validateCards(shippedCards()).length === 0,
    "and the pool's own validator passes over the shipped record with the five in it, which is where the one owner per key clause and every other shape rule over the cards is answered",
  );

  check(
    MILESTONE_BOONS.every(
      (card) =>
        cardWeight(card, voyageState()) > 0 &&
        cardWeight(card, voyageState({ mode: CLASSIC })) > 0,
    ),
    "every moment card weighs in for both modes, because the five are content the pool carries for every voyage rather than a system only the experimental mode runs",
  );

  check(
    MILESTONE_BOONS.every((card) =>
      Object.values(card.strings).every(
        (strings) => strings.name.length > 0 && strings.desc.length > 0,
      ),
    ) &&
      new Set(MILESTONE_BOONS.map((card) => card.strings.en.name)).size ===
        MILESTONE_BOONS.length,
    "every moment card is written in both languages with a name and a description, and the five English names are five distinct names rather than one word dealt five times",
  );

  check(
    heldBoonCards({ heldBoons: ["steady_watch", "cold_hardened"] })
      .map((card) => card.id)
      .join() === "steady_watch,cold_hardened" &&
      heldBoonCards({ heldBoons: ["not_a_card"] }).length === 0 &&
      heldFlagsOf({
        heldBoons: ["steady_watch", "cold_hardened"],
        charter: null,
      }).steady_rations === 1 &&
      heldFlagsOf({
        heldBoons: ["steady_watch", "cold_hardened"],
        charter: null,
      }).cold_hardened === 1 &&
      Object.keys(heldFlagsOf({ heldBoons: [], charter: null })).length === 0,
    "the held list resolves through the pool in the order the cards were taken and merges its flags into one set, and an id the pool no longer knows draws nothing rather than a placeholder",
  );

  // ========== C. The pure reads ==========

  const topRung = MERCHANT_RATINGS[0].minScore;
  check(
    rungsOf(0) === 0 &&
      rungsOf(49) === 0 &&
      rungsOf(50) === 1 &&
      rungsOf(99) === 1 &&
      rungsOf(100) === 2 &&
      rungsOf(topRung - 1) === 3 &&
      rungsOf(topRung) ===
        MERCHANT_RATINGS.filter((rating) => rating.minScore > 0).length,
    "the rungs a score has crossed are read off the printed merchant ladder, its own floor entry excluded, because a threshold of zero is the catch all rung rather than a rung anybody crosses",
  );

  check(
    !milestoneDue(voyageState(), "crew_loss") &&
      milestoneDue(fallen(), "crew_loss") &&
      !milestoneDue(
        Object.assign(fallen(), { milestonesAnswered: { crew_loss: 1 } }),
        "crew_loss",
      ) &&
      milestoneDue(
        Object.assign(voyageState(), {
          crewLost: [
            { name: "Old Salt", round: 1 },
            { name: "Cabin Hand", round: 3 },
          ],
          milestonesAnswered: { crew_loss: 1 },
        }),
        "crew_loss",
      ),
    "the lost hand's moment is a count rather than a latch: one loss is a moment, the same loss answered is not a second one, and a second hand gone is",
  );

  check(
    milestoneDue(voyageState(), "pathbound_order") &&
      milestoneDue(voyageState(), "mandate") &&
      !milestoneDue(
        Object.assign(voyageState(), {
          milestonesAnswered: { pathbound_order: 1 },
        }),
        "pathbound_order",
      ) &&
      !milestoneDue(
        Object.assign(voyageState(), { milestonesAnswered: { mandate: 1 } }),
        "mandate",
      ),
    "the pathbound order and the commission are latches: the site only asks when its event happens, and the mark then holds the answer for the voyage",
  );

  check(
    milestoneDue(Object.assign(voyageState(), { score: 60 }), "renown_rung") &&
      !milestoneDue(
        Object.assign(voyageState(), {
          score: 60,
          milestonesAnswered: { renown_rung: 1 },
        }),
        "renown_rung",
      ) &&
      milestoneDue(
        Object.assign(voyageState(), {
          score: 130,
          milestonesAnswered: { renown_rung: 1 },
        }),
        "renown_rung",
      ) &&
      !milestoneDue(
        Object.assign(voyageState(), {
          score: 130,
          milestonesAnswered: { renown_rung: 2 },
        }),
        "renown_rung",
      ) &&
      !milestoneDue(voyageState(), "renown_rung"),
    "a crossed rung is a moment and the mark counts the rungs already answered, so the same rung is answered once and the next crossing is a new moment",
  );

  withEnv("NEXT_PUBLIC_GARMENTS", "1", () => {
    const ticked = coldAt(coldRound);
    const unTicked = coldAt(coldRound);
    unTicked.garmentsTickRound = 0;
    const answered = coldAt(coldRound);
    answered.milestonesAnswered.cold_leg = coldRound;
    const bitten = coldAt(coldRound);
    bitten.money = 1000;
    hireWorker(bitten, "weaver", []);
    bitten.workers.weaver[0].frostbittenRound = coldRound + 1;
    const mild = coldAt(mildRound);
    check(
      coldRound > 0 &&
        mildRound > 0 &&
        milestoneDue(ticked, "cold_leg") &&
        !milestoneDue(unTicked, "cold_leg") &&
        !milestoneDue(answered, "cold_leg") &&
        !milestoneDue(bitten, "cold_leg") &&
        !milestoneDue(mild, "cold_leg"),
      "a cold leg survived with zero frostbite is a moment, and every other way to read the same facts is not: no settlement tick, a hand already bitten by that leg, the same leg answered, and a mild one that was never cold at all",
    );
  });

  const fallenHand = fallen();
  fallenHand.voyageEpoch = 777;
  const hand = milestoneChoices(fallenHand, "crew_loss").map((card) => card.id);
  const again = milestoneChoices(fallenHand, "crew_loss").map(
    (card) => card.id,
  );
  check(
    hand.length === CARDS_PER_OFFER &&
      hand[0] === "steady_watch" &&
      hand.every((id) => MILESTONE_BOONS.some((card) => card.id === id)) &&
      hand.join() === again.join(),
    "a moment's table is the anchor card its own trigger is named for first and two more drawn off the family pool, and the seed leaves the round out, so a room advance, a checkpoint or a reload deals the same three cards",
  );

  const holding = fallen();
  holding.voyageEpoch = 777;
  holding.heldBoons = ["steady_watch"];
  const afterPick = milestoneChoices(holding, "crew_loss").map(
    (card) => card.id,
  );
  check(
    afterPick.length === CARDS_PER_OFFER && !afterPick.includes("steady_watch"),
    "a card already taken from a moment is out of the pool for every moment after it, so no two moments can deal one captain the same boon twice",
  );

  const spent = fallen();
  spent.voyageEpoch = 777;
  spent.heldBoons = MILESTONE_BOONS.map((card) => card.id);
  const classicFallen = voyageState({ mode: CLASSIC });
  classicFallen.crewLost = [{ name: "Old Salt", round: 1 }];
  check(
    milestoneChoices(spent, "crew_loss").length === 0 &&
      milestoneChoices(classicFallen, "crew_loss").length === CARDS_PER_OFFER,
    "and a family whose every card is held deals nothing rather than a short table, while the founding mode's captain, who can never be offered one, would still be dealt the full three by the same reader",
  );

  withEnv("NEXT_PUBLIC_MILESTONE_BOONS", "1", () => {
    const idle = voyageState();
    const waiting = fallen();
    waiting.milestoneOffers = ["crew_loss"];
    const drained = fallen();
    drained.heldBoons = MILESTONE_BOONS.map((card) => card.id);
    drained.milestoneOffers = ["crew_loss"];
    check(
      !milestonePending(idle) &&
        milestonePending(waiting) &&
        !milestonePending(drained),
      "a moment is drawn only when the queue holds one and its table still has a card on it, so a queue whose pool ran dry behind another moment is left inert rather than drawn as a screen with no exit",
    );
    withEnv("NEXT_PUBLIC_MILESTONE_BOONS", "0", () => {
      check(
        !milestonePending(waiting),
        "and with the switch off a moment already queued is simply not drawn, which is the plan's rollback: the data stays and the moment does not arrive",
      );
    });
  });

  const roundBoon = BOONS.find((card) => card.trigger === "boon_draft");
  check(
    roundBoon !== undefined &&
      normalizeHeldBoons([
        "steady_watch",
        "steady_watch",
        "not_a_card",
        roundBoon.id,
        "route_mastery",
      ]).join() === "steady_watch,route_mastery" &&
      normalizeHeldBoons("junk").length === 0 &&
      normalizeMilestoneOffers(["mandate", "nope", "mandate", 7]).join() ===
        "mandate",
    "a save's held list keeps only ids the pool still answers as moment boons, dropping the unknown, the repeated and the round draft's own (whose flag is meant to last a round rather than the voyage), and a save's queue keeps only real triggers read once each",
  );

  const marks = normalizeMilestonesAnswered({
    crew_loss: 2,
    cold_leg: 0,
    renown_rung: -1,
    mandate: 1.5,
    rogue: 3,
    pathbound_order: 1,
  });
  check(
    marks.crew_loss === 2 &&
      marks.pathbound_order === 1 &&
      marks.cold_leg === undefined &&
      marks.renown_rung === undefined &&
      !("mandate" in marks) &&
      !("rogue" in marks) &&
      Object.keys(normalizeMilestonesAnswered(null)).length === 0,
    "and a save's marks keep only whole numbers of at least one in units the vocabulary knows, so a zero, a negative, a fraction and a stranger all read as absent rather than as a mark",
  );

  // ========== D. The writes ==========

  const switchedOff = fallen();
  const offLogs: string[] = [];
  withEnv("NEXT_PUBLIC_MILESTONE_BOONS", "0", () => {
    queueMilestoneMoment(switchedOff, offLogs, "crew_loss");
  });
  const foundingFallen = voyageState({ mode: CLASSIC });
  foundingFallen.crewLost = [{ name: "Old Salt", round: 1 }];
  const foundingLogs: string[] = [];
  queueMilestoneMoment(foundingFallen, foundingLogs, "crew_loss");
  check(
    switchedOff.milestoneOffers.length === 0 &&
      Object.keys(switchedOff.cardTally).length === 0 &&
      offLogs.length === 0 &&
      foundingFallen.milestoneOffers.length === 0 &&
      foundingLogs.length === 0,
    "with the switch off a due moment is refused before anything is counted or written, and the founding mode's captain is refused the same way with the switch on, because nothing on the arming path outruns the switch",
  );

  withEnv("NEXT_PUBLIC_MILESTONE_BOONS", "1", () => {
    const armed = fallen();
    const logs: string[] = [];
    queueMilestoneMoment(armed, logs, "crew_loss");
    const dealt = milestoneChoices(armed, "crew_loss").map((card) => card.id);
    check(
      armed.milestoneOffers.join() === "crew_loss" &&
        logs.some((line) => line.includes(MILESTONE_MOMENTS.crew_loss.title)) &&
        logs.some((line) => line.includes(MILESTONE_MOMENTS.crew_loss.line)) &&
        dealt.length === CARDS_PER_OFFER &&
        dealt.every(
          (id) =>
            armed.cardTally[id]?.offered === 1 &&
            armed.cardTally[id]?.picked === 0,
        ),
      "arming a moment queues it, writes the two ledger lines the captain meets and counts the three cards as offered before any screen sees them, because a re render must not count one deal as two",
    );
    queueMilestoneMoment(armed, logs, "crew_loss");
    check(
      armed.milestoneOffers.length === 1 &&
        logs.filter((line) => line.includes(MILESTONE_MOMENTS.crew_loss.title))
          .length === 1 &&
        dealt.every((id) => armed.cardTally[id]?.offered === 1),
      "and the guard keeps a moment already waiting from being armed a second time, which is what makes every re entered sweep idempotent",
    );

    const drained = fallen();
    const drainedLogs: string[] = [];
    drained.heldBoons = MILESTONE_BOONS.map((card) => card.id);
    queueMilestoneMoment(drained, drainedLogs, "crew_loss");
    check(
      drained.milestoneOffers.length === 0 &&
        drained.milestonesAnswered.crew_loss === 1 &&
        drainedLogs.length === 0 &&
        Object.keys(drained.cardTally).length === 0 &&
        !milestonePending(drained),
      "a moment whose table has run dry is spent rather than queued: the mark moves so it cannot re fire at every settlement for the rest of the voyage, nothing is drawn and nothing is logged",
    );
  });

  withEnv("NEXT_PUBLIC_MILESTONE_BOONS", "1", () => {
    const answering = fallen();
    const logs: string[] = [];
    queueMilestoneMoment(answering, logs, "crew_loss");
    const card = milestoneChoices(answering, "crew_loss")[0];
    const took = answerMilestone(answering, card.id, logs);
    check(
      took &&
        card.id === "steady_watch" &&
        answering.heldBoons.join() === "steady_watch" &&
        answering.milestoneOffers.length === 0 &&
        answering.modifierFlags.steady_rations === 1 &&
        answering.cardTally[card.id]?.picked === 1 &&
        answering.milestonesAnswered.crew_loss === 1 &&
        logs.some((line) => line.includes(cardLead(card.id))) &&
        !milestonePending(answering),
      "answering takes exactly the card the screen drew: the anchor card is dealt first and a press on it holds it, folds its flag into the round's flags, counts the pick, moves the mark and drops the moment off the queue",
    );

    const refusing = fallen();
    const refuseLogs: string[] = [];
    queueMilestoneMoment(refusing, refuseLogs, "crew_loss");
    const refusedWrong = answerMilestone(refusing, "cold_hardened", refuseLogs);
    const quiet =
      refusing.milestoneOffers.length === 1 &&
      refusing.heldBoons.length === 0 &&
      Object.keys(refusing.modifierFlags).length === 0;
    check(
      !refusedWrong &&
        quiet &&
        !answerMilestone(voyageState(), "steady_watch", []) &&
        answerMilestone(
          refusing,
          milestoneChoices(refusing, "crew_loss")[0].id,
          refuseLogs,
        ) &&
        !answerMilestone(refusing, "cold_hardened", refuseLogs),
      "a press is validated against the same derived table the screen drew, so a stale click on a card this moment does not deal is refused with the moment left standing, and an answer with no moment waiting is refused as well",
    );
  });

  withEnv("NEXT_PUBLIC_MILESTONE_BOONS", "1", () => {
    const dawn = fallen();
    const dawnLogs: string[] = [];
    startBoonDrafting(dawn, dawnLogs);
    const armed = dawn.milestoneOffers.join() === "crew_loss";
    startBoonDrafting(dawn, dawnLogs);
    check(
      armed &&
        dawn.milestoneOffers.length === 1 &&
        dawnLogs.filter((line) =>
          line.includes(MILESTONE_MOMENTS.crew_loss.title),
        ).length === 1 &&
        milestoneChoices(dawn, "crew_loss").every(
          (card) => dawn.cardTally[card.id]?.offered === 1,
        ),
      "the dawn sweep arms the lost hand's moment from inside the boon draft's opener, and the catch up entry that runs the same dawn again deals nothing twice",
    );
  });

  withEnv("NEXT_PUBLIC_MILESTONE_BOONS", "1", () => {
    withEnv("NEXT_PUBLIC_GARMENTS", "1", () => {
      const settled = coldAt(coldRound);
      settled.score = 60;
      const settleLogs: string[] = [];
      noteSettlementMilestones(settled, settleLogs);
      const ordered = settled.milestoneOffers.join() === "cold_leg,renown_rung";
      // The two tables can overlap on a card (a moment deals from the
      // family, not from a private shelf), so the count that proves the
      // second entry is quiet is the whole tally held still rather than any
      // one card's number.
      const talliedOnce = JSON.stringify(settled.cardTally);
      noteSettlementMilestones(settled, settleLogs);
      check(
        ordered &&
          settled.milestoneOffers.length === 2 &&
          settleLogs.filter((line) =>
            line.includes(MILESTONE_MOMENTS.cold_leg.title),
          ).length === 1 &&
          settleLogs.filter((line) =>
            line.includes(MILESTONE_MOMENTS.renown_rung.title),
          ).length === 1 &&
          JSON.stringify(settled.cardTally) === talliedOnce &&
          Object.keys(settled.cardTally).length > 0,
        "the settled books deal the cold leg first, because its evidence is the freshest thing in the ledger, and the crossed rung second, and a second entry into the same settlement leaves both alone",
      );
    });
  });

  withEnv("NEXT_PUBLIC_PATH_ORDERS", "1", () => {
    withEnv("NEXT_PUBLIC_MILESTONE_BOONS", "1", () => {
      const findPathbound = () => {
        for (let round = 1; round <= 12; round++) {
          const board = dealBoard(round);
          const order = board.customerCards.find(
            (card) =>
              pathOrderOf(card, board.mode) !== null &&
              !card.isProductOrder &&
              !card.isBrokerFavor,
          );
          if (order !== undefined) return { board, order };
        }
        return null;
      };
      const found = findPathbound();
      if (found !== null) {
        const board = found.board;
        const pathCard = found.order;
        board.path = pathOrderOf(pathCard, board.mode);
        stockHold(board, pathCard);
        board.money = 1000;
        const boardLogs: string[] = [];
        completeOrder(board, pathCard.id, boardLogs);
        check(
          board.milestoneOffers.join() === "pathbound_order" &&
            boardLogs.some((line) =>
              line.includes(MILESTONE_MOMENTS.pathbound_order.title),
            ) &&
            boardLogs.some((line) =>
              line.includes(MILESTONE_MOMENTS.pathbound_order.line),
            ),
          "the first order filled along the captain's own path arms its moment at the fill itself, after the ledger has already said what the order paid",
        );
      } else {
        check(false, "the board deals a pathbound order to fill");
      }
    });
  });

  withEnv("NEXT_PUBLIC_MILESTONE_BOONS", "1", () => {
    const delivering = voyageState();
    delivering.phase = "orders";
    const objective = OBJECTIVE_DECK[0];
    const first = objective.resources[0];
    delivering.inventory[first.type] =
      (delivering.inventory[first.type] ?? 0) + first.required;
    const deliveryLogs: string[] = [];
    deliverToObjective(delivering, objective, deliveryLogs);
    const ledgerFirst =
      deliveryLogs.findIndex((line) => line.includes("Fleet Commission")) <
      deliveryLogs.findIndex((line) =>
        line.includes(MILESTONE_MOMENTS.mandate.title),
      );
    answerMilestone(
      delivering,
      milestoneChoices(delivering, "mandate")[0].id,
      deliveryLogs,
    );
    const second = objective.resources[1];
    delivering.inventory[second.type] =
      (delivering.inventory[second.type] ?? 0) + second.required;
    deliverToObjective(delivering, objective, deliveryLogs);
    check(
      delivering.milestonesAnswered.mandate === 1 &&
        delivering.heldBoons.length === 1 &&
        delivering.milestoneOffers.length === 0 &&
        ledgerFirst &&
        deliveryLogs.filter((line) =>
          line.includes(MILESTONE_MOMENTS.mandate.title),
        ).length === 1,
      "the first delivery to the fleet's commission arms its moment after the commission's own ledger line, and every delivery after the answered first one is quiet",
    );
  });

  withEnv("NEXT_PUBLIC_MILESTONE_BOONS", "1", () => {
    const rolling = voyageState();
    rolling.money = 5000;
    rolling.currentRound = 4;
    rolling.phase = "resolve";
    rolling.pirateAttackResolved = true;
    rolling.heldBoons = ["steady_watch"];
    rolling.modifierFlags = { steady_rations: 1, vat_discount: 0.5 };
    const rollLogs: string[] = [];
    const ctx = {
      seedBase: `smoke:milestones:${suffix}`,
      harborId: "harbor-a",
    };
    for (let press = 0; press < 6 && rolling.currentRound === 4; press++) {
      nextPhase(rolling, ctx, rollLogs);
    }
    const landedOn = rolling.phase as Phase;
    check(
      rolling.currentRound === 5 &&
        rolling.modifierFlags.steady_rations === 1 &&
        rolling.modifierFlags.vat_discount === undefined &&
        rolling.heldBoons.join() === "steady_watch" &&
        landedOn === "dawn",
      "a round's rollover rebuilds the flag set from the held boons, so a held moment boon rides through every reset while the round draft's own flags come and go above it",
    );
  });

  // ========== E. The five read sites ==========

  withEnv("NEXT_PUBLIC_SURVIVAL", "1", () => {
    const makeCrew = (heads: number, larder: number, rations?: number) => {
      const state = voyageState();
      state.money = 1000;
      for (let head = 0; head < heads; head++) hireWorker(state, "weaver", []);
      state.currentRound = 3;
      state.larder = larder;
      if (rations !== undefined) state.modifierFlags.steady_rations = rations;
      return state;
    };
    const plain = makeCrew(3, 5);
    const plainLogs: string[] = [];
    const fedPlain = feedCrew(plain, plainLogs);
    const saved = makeCrew(3, 5, 1);
    const savedLogs: string[] = [];
    const fedSaved = feedCrew(saved, savedLogs);
    const floored = makeCrew(1, 2, 5);
    const floorLogs: string[] = [];
    const fedFloor = feedCrew(floored, floorLogs);
    check(
      fedPlain &&
        fedSaved &&
        fedFloor &&
        plain.larder === 2 &&
        saved.larder === 3 &&
        floored.larder === 1 &&
        plainLogs.some((line) => line.includes("eats 3 rations")) &&
        savedLogs.some((line) => line.includes("eats 2 rations")) &&
        floorLogs.some((line) => line.includes("eats 1 ration")),
      "Steady Watch is read at the pantry: three hands cost three rations with nothing held and two with the boon, the saving floors at one so a lone hand still eats rather than starving on a boon, and the ledger line says what was saved",
    );
  });

  withEnv("NEXT_PUBLIC_GARMENTS", "1", () => {
    const bare = coldAt(coldRound);
    const once = coldAt(coldRound);
    once.modifierFlags.cold_hardened = 1;
    const twice = coldAt(coldRound);
    twice.modifierFlags.cold_hardened = 2;
    check(
      warmthScore(bare) === 0 &&
        warmthScore(twice) === 2 &&
        shortOfWarmth(bare) &&
        shortOfWarmth(once) &&
        !shortOfWarmth(twice) &&
        COLD_LEG_WARMTH === 2,
      "Cold Hardened is read where the cold is judged: the score the crew freezes against counts it as warmth beside the garments, and the leg still bites through one of it and not through two because the leg asks for the two the constant states",
    );
  });

  withEnv("NEXT_PUBLIC_PATH_ORDERS", "1", () => {
    // Both shapes on one board, found by walking the twelve rather than
    // betting the whole check on the round one deal, and every run below
    // dealing that same round so the runs still stand on identical cards.
    const findPair = () => {
      for (let round = 1; round <= 12; round++) {
        const control = dealBoard(round);
        const pathCard = control.customerCards.find(
          (order) =>
            pathOrderOf(order, control.mode) !== null &&
            !order.isProductOrder &&
            !order.isBrokerFavor,
        );
        const plainCard = control.customerCards.find(
          (order) =>
            pathOrderOf(order, control.mode) === null &&
            !order.isProductOrder &&
            !order.isBrokerFavor &&
            order.reward > 0,
        );
        if (pathCard !== undefined && plainCard !== undefined) {
          return { round, control, pathCard, plainCard };
        }
      }
      return null;
    };
    const found = findPair();
    if (found !== null) {
      const { round, control, pathCard, plainCard } = found;
      const chosenPath = pathOrderOf(pathCard, control.mode);
      const run = (card: OrderCard, flag: boolean, path: PathId | null) => {
        const state = dealBoard(round);
        state.path = path;
        if (flag) state.modifierFlags.route_mastery = 0.25;
        stockHold(state, card);
        state.money = 1000;
        const before = state.money;
        completeOrder(state, card.id, []);
        return state.money - before;
      };
      const plainDelta = run(pathCard, false, chosenPath);
      const masteredDelta = run(pathCard, true, chosenPath);
      const pathlessDelta = run(plainCard, true, null);
      const plainFlaggedDelta = run(plainCard, true, chosenPath);
      check(
        masteredDelta - plainDelta === Math.floor(pathCard.reward * 0.25) &&
          masteredDelta - plainDelta > 0 &&
          pathlessDelta === plainFlaggedDelta,
        "Route Mastery is read at the order's payout: a quarter of the face reward more on the orders that follow the captain's own path, and nothing at all on an order that belongs to no path, whether the captain sails one or none",
      );
    } else {
      check(false, "the board deals a pathbound order and a plain one to fill");
    }
  });

  const product = Object.keys(PRODUCT_PRICES)[1];
  const vatPlain = calcVAT(voyageState(), product, 500);
  const credited = voyageState();
  credited.modifierFlags.harbor_credit = 0.25;
  const vatCredit = calcVAT(credited, product, 500);
  const breakdown = explainVAT(credited, product, 500);
  const creditCard = cardById("harbor_credit");
  const creditStep = breakdown.steps.find(
    (step) =>
      creditCard !== null && step.label.includes(cardText(creditCard).name),
  );
  check(
    vatPlain > 0 &&
      vatCredit === Math.floor(vatPlain * 0.75) &&
      breakdown.final === vatCredit &&
      creditStep !== undefined &&
      creditStep.delta === vatCredit - vatPlain,
    "Harbor Credit is read in the dues arithmetic and again in the tooltip that mirrors it: the tax a quarter lower, named on its own step of the breakdown, and the printed total is the charged one to the coin",
  );

  const calmSea = voyageState();
  calmSea.currentRound = 6;
  const flyingColors = voyageState();
  flyingColors.currentRound = 6;
  flyingColors.modifierFlags.fleet_color = 0.25;
  const baseChance = pirateChance(calmSea);
  check(
    baseChance > 0 &&
      Math.abs(pirateChance(flyingColors) - baseChance * 0.75) < 1e-9,
    "Fleet Colors is read at the raiders' table: the risk a quarter lower for the voyage, taken as the same multiplication the round's own discount takes and landing right after it, ahead of the compass's flat thirty",
  );

  const drafting = voyageState();
  drafting.heldBoons = ["steady_watch"];
  const draftLogs: string[] = [];
  startBoonDrafting(drafting, draftLogs);
  const pick = drafting.boonChoices[0];
  selectBoon(drafting, pick.id, draftLogs);
  check(
    drafting.modifierFlags.steady_rations === 1 &&
      pick.effect.kind === "flags" &&
      Object.entries(pick.effect.flags).every(
        ([key, value]) => drafting.modifierFlags[key as ModifierKey] === value,
      ),
    "a round boon answered beside a held one lands both flag sets in the same set, so the round's effect and the voyage's own are read from one place rather than racing for it",
  );

  // ========== F. The save ==========

  const saved = voyageState();
  saved.heldBoons = [
    "steady_watch",
    "steady_watch",
    "not_a_card",
    roundBoon?.id ?? "missing",
    "route_mastery",
  ];
  saved.milestoneOffers = [
    "mandate",
    "nope",
    "mandate",
  ] as unknown as MilestoneTrigger[];
  saved.milestonesAnswered = {
    crew_loss: 2,
    cold_leg: 0,
    renown_rung: 1.5,
    mandate: 1,
  };
  healLoadedVoyage(saved, { legacyRenownLevel: null });
  check(
    saved.heldBoons.join() === "steady_watch,route_mastery" &&
      saved.milestoneOffers.join() === "mandate" &&
      saved.milestonesAnswered.crew_loss === 2 &&
      saved.milestonesAnswered.mandate === 1 &&
      saved.milestonesAnswered.cold_leg === undefined &&
      saved.milestonesAnswered.renown_rung === undefined,
    "the load path heals all three fields through the same readers the rest of the save uses: the unknown, the repeated and the round draft's own leave the held list, the queue reads once per trigger, and the marks keep only the answers that mean something",
  );

  const legacy = voyageState();
  legacy.heldBoons = undefined as unknown as string[];
  legacy.milestoneOffers = undefined as unknown as MilestoneTrigger[];
  legacy.milestonesAnswered = undefined as unknown as Partial<
    Record<MilestoneTrigger, number>
  >;
  healLoadedVoyage(legacy, { legacyRenownLevel: null });
  check(
    legacy.heldBoons.length === 0 &&
      legacy.milestoneOffers.length === 0 &&
      Object.keys(legacy.milestonesAnswered).length === 0,
    "and a save written before the moments existed loads as a voyage that has met none of them rather than as one carrying a hole",
  );

  // ========== G. The leg report's losses ==========

  // The wire itself cannot be driven from in process (the socket handler
  // reaches its captain through a listener map this suite cannot see), so
  // the accumulator is driven here the way the handler drives it, against
  // the real database, and everything it writes is deleted again.
  const roomPrefix = `smoke48-${suffix}-`;
  const roomFacts = (id: string) => {
    const sample = voyageState();
    return {
      id,
      mode: sample.mode,
      difficulty: sample.difficulty,
      voyageEpoch: 7,
      createdAt: new Date(),
    };
  };
  try {
    const roomA = `${roomPrefix}a`;
    openVoyageTelemetry(roomFacts(roomA), []);
    noteLegReport(roomA, "u-a", 1, {
      ordersDealt: 3,
      ordersFilled: 2,
      distinctGoods: 2,
      crewLosses: 2,
    });
    await closeVoyageTelemetry(roomA, "concluded", []);
    const rowsA = await db.voyageTelemetry.findMany({
      where: { roomId: roomA },
    });
    const storedA =
      rowsA.length === 1 ? readStoredRecord(rowsA[0].record) : null;
    const reportA = storedA?.events.find(
      (event) => event.name === "leg_report",
    );
    const lossesA = reportA?.name === "leg_report" ? reportA.crewLosses : null;
    const captainA = storedA?.captains.find((line) => line.userId === "u-a");
    check(
      storedA !== null && lossesA === 2 && captainA?.crewLost === true,
      "a leg that lost two hands carries the count on its own wire line and marks the captain who suffered it, so a reader can count the losses and the captains they belonged to out of the same record",
    );

    const roomB = `${roomPrefix}b`;
    openVoyageTelemetry(roomFacts(roomB), []);
    noteLegReport(roomB, "u-b", 1, {
      ordersDealt: 1,
      ordersFilled: 1,
      distinctGoods: 1,
      crewLosses: 0,
    });
    await closeVoyageTelemetry(roomB, "concluded", []);
    const rowsB = await db.voyageTelemetry.findMany({
      where: { roomId: roomB },
    });
    const storedB =
      rowsB.length === 1 ? readStoredRecord(rowsB[0].record) : null;
    const reportB = storedB?.events.find(
      (event) => event.name === "leg_report",
    );
    const lossesB = reportB?.name === "leg_report" ? reportB.crewLosses : null;
    const captainB = storedB?.captains.find((line) => line.userId === "u-b");
    check(
      lossesB === 0 && captainB?.crewLost === false,
      "a leg that reports zero losses keeps the honest zero on the wire and leaves the captain unmarked, because the mark is for a captain the voyage actually saw lose a hand rather than for one who sent the field",
    );

    const roomC = `${roomPrefix}c`;
    openVoyageTelemetry(roomFacts(roomC), []);
    noteLegReport(roomC, "u-c", 1, {
      ordersDealt: 1,
      ordersFilled: 1,
      distinctGoods: 1,
    });
    await closeVoyageTelemetry(roomC, "concluded", []);
    const rowsC = await db.voyageTelemetry.findMany({
      where: { roomId: roomC },
    });
    const storedC =
      rowsC.length === 1 ? readStoredRecord(rowsC[0].record) : null;
    const reportC = storedC?.events.find(
      (event) => event.name === "leg_report",
    );
    const wroteKey =
      reportC !== undefined &&
      Object.prototype.hasOwnProperty.call(reportC, "crewLosses");
    const captainC = storedC?.captains.find((line) => line.userId === "u-c");
    check(
      !wroteKey && captainC?.crewLost === false,
      "a voyage whose crew loss rule was off sends no field at all rather than a zero, so an absent reading stays absent through the record the way the hold's own figures do",
    );

    const roomD = `${roomPrefix}d`;
    openVoyageTelemetry(roomFacts(roomD), []);
    for (let i = 0; i < TELEMETRY_EVENT_CAP; i++) {
      noteTelemetry(roomD, "message_sent", { actor: "u-d" });
    }
    noteLegReport(roomD, "u-d", 1, {
      ordersDealt: 1,
      ordersFilled: 1,
      distinctGoods: 1,
      crewLosses: 1,
    });
    await closeVoyageTelemetry(roomD, "concluded", []);
    const rowsD = await db.voyageTelemetry.findMany({
      where: { roomId: roomD },
    });
    const storedD =
      rowsD.length === 1 ? readStoredRecord(rowsD[0].record) : null;
    const captainD = storedD?.captains.find((line) => line.userId === "u-d");
    check(
      storedD !== null &&
        storedD.truncated &&
        storedD.events.length === TELEMETRY_EVENT_CAP &&
        storedD.events.every((event) => event.name !== "leg_report") &&
        captainD?.crewLost === true,
      "a voyage whose events have filled to the cap drops the leg's own line and keeps the captain's loss mark, so the one captain a full record would otherwise have forgotten is still named on it",
    );
  } finally {
    await db.voyageTelemetry.deleteMany({
      where: { roomId: { startsWith: roomPrefix } },
    });
  }
  const leftovers = await db.voyageTelemetry.count({
    where: { roomId: { startsWith: roomPrefix } },
  });
  check(
    leftovers === 0,
    "and the synthetic rooms this suite sailed are deleted rather than left in the operator's table, with the count read back rather than assumed",
  );

  const repoRoot = join(import.meta.dirname, "..", "..", "..");
  const wiring = readFileSync(
    join(repoRoot, "src", "server", "realtime", "wiring", "leg-report.ts"),
    "utf8",
  );
  const hook = readFileSync(
    join(repoRoot, "src", "lib", "use-leg-report.ts"),
    "utf8",
  );
  check(
    wiring.includes("crewLosses: optional(payload?.crewLosses)") &&
      hook.includes("crewLosses") &&
      hook.includes("crewLossRuleOn"),
    "the two ends of the wire the accumulator sits between both name the losses in their own source, held here rather than by a fake because the socket seam between them is module private and a fake would prove nothing about it",
  );

  // ========== H. The barrel ==========

  check(
    "answerMilestone" in engineBarrel &&
      !("queueMilestoneMoment" in engineBarrel) &&
      !("noteSettlementMilestones" in engineBarrel) &&
      !("milestoneChoices" in engineBarrel) &&
      !("heldFlagsOf" in engineBarrel),
    "only the answer crosses the engine's barrel: the arming walks stay inside the engine so no screen can arm a moment of its own, and the pure readers stay in the vocabulary's own module where the record and the screens both find them",
  );
}
