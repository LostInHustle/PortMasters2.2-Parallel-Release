// PortMasters 2.2 Parallel Release, smoke run: The charters.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cardById,
  cardLead,
  cardWeight,
  carriesTag,
  shippedCards,
  validateCards,
} from "@/lib/game/cards";
import { NO_LEAN } from "@/lib/game/constants/cards";
import {
  CHARTER_LEG,
  CHARTER_MOMENT,
  CHARTER_PATH,
  CHARTERS,
  COVER_CHARTERS,
} from "@/lib/game/constants/charters";
import { PRODUCT_PRICES } from "@/lib/game/constants/goods";
import {
  charterChoices,
  charterDue,
  charterPending,
} from "@/lib/game/charters";
import { difficultyConfig } from "@/lib/game/difficulty";
import { chartersOn } from "@/lib/game/flags";
import { heldCharterCard, heldFlagsOf } from "@/lib/game/held-cards";
import { PATHS, type PathId } from "@/lib/game/paths";
import {
  MODIFIER_KEYS,
  type GameState,
  type ModifierKey,
  type OrderCard,
} from "@/lib/game/types";
import { answerCharter } from "@/lib/game/engine/charters";
import * as engineBarrel from "@/lib/game/engine";
import {
  completeOrder,
  nextPhase,
  pathOrderOf,
  snapToCheckpoint,
} from "@/lib/game/engine";
import { startMarket } from "@/lib/game/engine/market";
import {
  calcTransportCost,
  calcVAT,
  getCardFinalCost,
} from "@/lib/game/engine/pricing";
import {
  escortCost,
  pirateChance,
  resolvePirateAttack,
} from "@/lib/game/engine/pirates";
import { hireWorker, processProduction } from "@/lib/game/engine/workers";
import { readStoredRecord, TELEMETRY_EVENT_CAP } from "@/lib/game/telemetry";
import { healLoadedVoyage } from "@/lib/session/heal-save";
import {
  closeVoyageTelemetry,
  noteCharterTaken,
  noteLegAdvanced,
  noteTelemetry,
  openVoyageTelemetry,
} from "@/server/realtime/telemetry";
import { heldPathOf } from "@/server/realtime/draft";
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

/**
 * [F6: charters at leg four] The plan's second feature of the cycle: a
 * voyage offers one charter at the fourth leg, a trio of the captain's
 * two path charters and one wildcard, and the one they take carries for
 * the rest of the voyage. What is checked here is the feature end to
 * end: the vocabulary and the ten cards, the three pure reads that
 * derive the moment, the answer and its refusals, every flag the ten
 * write read at its live site, the save healed back, the take the wire
 * files once per voyage, and the barrel's one public name.
 *
 * It sits beside the milestone boons' article and joins the group that
 * needs no harbor, for the same reasons: the moment is a pure function
 * of a state, and the one half that touches the database (the
 * accumulator the leg report feeds) opens no table of its own. The
 * voyage schedule's chartered waves share the noun, which is why every
 * captain facing string here says charter in the possessive the screen
 * uses.
 */
export async function chartersSuite(): Promise<void> {
  // A captain standing at the charter's leg. The path is dealt by the
  // draft in a real room; here it is seated directly, because the path's
  // own deal has its own article and this one is about what a path does
  // when the offer reads it.
  const pathlessAt = (round: number) => {
    const state = voyageState();
    state.currentRound = round;
    return state;
  };
  const pathAt = (path: PathId, round: number) => {
    const state = pathlessAt(round);
    state.path = path;
    return state;
  };
  const loomAt = (round: number) => pathAt("loom", round);

  // The eight a Loom captain's wildcard is drawn from, read off the
  // pairing map rather than typed here, so a sixth path tomorrow moves
  // this list with the map instead of leaving a stale copy behind.
  const otherEight = (path: PathId) =>
    CHARTERS.filter((card) => CHARTER_PATH[card.id] !== path).map(
      (card) => card.id,
    );

  // ========== A. The vocabulary ==========

  check(
    CHARTER_LEG === 4 && CHARTERS.length === 10,
    "the moment lands on the fourth leg of the twelve and the pool holds the plan's ten, counted off the catalogue rather than typed here",
  );

  check(
    CHARTER_MOMENT.icon.length > 0 &&
      CHARTER_MOMENT.title.length > 0 &&
      CHARTER_MOMENT.line.length > 0,
    "and the moment carries the glyph and the two lines the overlay prints, the same three fields a milestone moment carries because the same overlay prints both",
  );

  // The pairing, held against the pump: every charter is paired, every
  // path is paired exactly twice, and the map names no path the game does
  // not have. A charter the map forgets is a card no trio can ever offer,
  // which is the failure the two per path count exists to make loud.
  const pathIds = Object.keys(PATHS) as PathId[];
  check(
    pathIds.length > 0 &&
      CHARTERS.every((card) => pathIds.includes(CHARTER_PATH[card.id])) &&
      pathIds.every(
        (path) =>
          CHARTERS.filter((card) => CHARTER_PATH[card.id] === path).length ===
          2,
      ),
    "every charter is paired to a real path and every path is paired exactly twice, so no path's moment offers a hole and no card sits in the pool unofferable",
  );

  check(
    COVER_CHARTERS.length > 0 &&
      COVER_CHARTERS.includes("letter_of_marque") &&
      COVER_CHARTERS.every((id) =>
        CHARTERS.some((card) => card.id === id && card.kind === "charter"),
      ),
    "the cover row's list names the salvage writer and only ids the pool still ships as charters, because the row counts takes and a retired id would read as cover nobody could ever deal",
  );

  // The switch's own policy, read through the function every switch in
  // this tree is read through: on unless the operator says otherwise,
  // and answered inside one mode and no other.
  check(
    [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
      withEnv("NEXT_PUBLIC_CHARTERS", value, switchFor(GAMBIT, chartersOn)),
    ) &&
      ["off", "0", "OFF", " off ", "Off"].every(
        (value) =>
          !withEnv(
            "NEXT_PUBLIC_CHARTERS",
            value,
            switchFor(GAMBIT, chartersOn),
          ),
      ),
    "the charters are on for every value except the word off and the digit zero, which is the policy every switch in this tree is read through",
  );

  check(
    withEnv(
      "NEXT_PUBLIC_CHARTERS",
      "1",
      () =>
        chartersOn(GAMBIT) &&
        !chartersOn(CLASSIC) &&
        !chartersOn("some_future_mode"),
    ),
    "and the twelfth switch is a gambit system like its eleven siblings: a rollback turned all the way on still leaves the founding mode without a single charter",
  );

  check(
    !CARRIES_A_DASH.test(CHARTER_MOMENT.title) &&
      !CARRIES_A_DASH.test(CHARTER_MOMENT.line) &&
      CHARTERS.every((card) =>
        Object.values(card.strings).every(
          (strings) =>
            !CARRIES_A_DASH.test(strings.name) &&
            !CARRIES_A_DASH.test(strings.desc),
        ),
      ),
    "every captain facing string a charter prints is dash free in both languages, by the house rule the card pool already answers to",
  );

  check(
    [
      "src/lib/game/charters.ts",
      "src/lib/game/constants/charters.ts",
      "src/lib/game/engine/charters.ts",
      "src/components/portmasters/game/phases/CharterDraft.tsx",
    ].every((relative) => !carriesADash(relative)),
    "and the four files the feature is written in hold the rule too, comments included, because the directive is about the record the next maintainer reads and not only about the strings a captain meets",
  );

  // ========== B. The ten cards ==========

  // The flags each card writes, read off the design rather than off the
  // cards, so a retuned effect fails here rather than agreeing with
  // itself. The Factor is the one that writes two keys: the count of
  // borrows the voyage opens and the penalty each one carries.
  const expectedFlags: Record<string, Record<string, number>> = {
    bulk_charter: { transport_per_lot_discount: 1 },
    standing_manifest: { manifest_order_bonus: 0.15 },
    gun_charter: { guns_risk_discount: 0.3 },
    standing_escort: { standing_escort_discount: 0.5 },
    weavers_charter: { loom_extra_produce: 1 },
    quality_mark: { loom_sale_bonus: 0.1 },
    long_ledger: { voyage_purchase_discount: 0.1 },
    quiet_account: { voyage_dues_discount: 0.5 },
    the_factor: { factor_borrows: 3, factor_penalty: 0.6 },
    letter_of_marque: { marque_salvage: 0.25 },
  };

  check(
    Object.keys(expectedFlags).length === CHARTERS.length &&
      CHARTERS.every((card) => {
        const expected = expectedFlags[card.id];
        if (expected === undefined) return false;
        const effect = card.effect;
        return (
          card.kind === "charter" &&
          card.trigger === "charter_draft" &&
          card.pathWeight === NO_LEAN &&
          card.condition.kind === "always" &&
          card.condition.weight === 1 &&
          effect.kind === "flags" &&
          Object.keys(effect.flags).length === Object.keys(expected).length &&
          Object.entries(expected).every(
            ([key, value]) => effect.flags[key as ModifierKey] === value,
          )
        );
      }),
    "each charter writes exactly the keys its design names and no lean of its own, because the trio is composed by the reader rather than by the weighted draw and a weight written beside the pair would be the same fact in a second place",
  );

  check(
    [
      "transport_per_lot_discount",
      "manifest_order_bonus",
      "guns_risk_discount",
      "standing_escort_discount",
      "loom_extra_produce",
      "loom_sale_bonus",
      "voyage_purchase_discount",
      "voyage_dues_discount",
      "factor_borrows",
      "factor_penalty",
      "marque_salvage",
    ].every((key) => (MODIFIER_KEYS as readonly string[]).includes(key)),
    "and the eleven keys the ten write are members of the closed flag vocabulary, so the effect a charter leaves on the voyage is a key the save, the healer and every reader already know",
  );

  check(
    CHARTERS.every(
      (card) =>
        cardWeight(card, voyageState({ mode: CLASSIC })) === 0 &&
        cardWeight(card, voyageState()) > 0,
    ),
    "every charter weighs in for the experimental mode and nothing at all in the founding one, which is the pool's own reader holding the mode clause rather than a list of ids kept here",
  );

  check(
    CHARTERS.every((card) => cardById(card.id) === card) &&
      CHARTERS.every((card) => shippedCards().cards.includes(card)) &&
      new Set(CHARTERS.map((card) => card.id)).size === CHARTERS.length,
    "the ten join the shipped record by the same objects rather than by copies, so a retuned charter is the card a held id resolves to and a dealt trio holds, and no id is carried twice",
  );

  check(
    validateCards(shippedCards()).length === 0,
    "and the pool's own validator passes over the shipped record with the ten in it, which is where the one owner per key clause and the two per path clause are answered",
  );

  check(
    CHARTERS.every((card) =>
      Object.values(card.strings).every(
        (strings) => strings.name.length > 0 && strings.desc.length > 0,
      ),
    ) &&
      new Set(CHARTERS.map((card) => card.strings.en.name)).size ===
        CHARTERS.length,
    "every charter is written in both languages with a name and a description, and the ten English names are ten distinct names rather than one word dealt ten times",
  );

  check(
    heldCharterCard({ charter: "weavers_charter" })?.id === "weavers_charter" &&
      heldCharterCard({ charter: "old_relic" }) === null &&
      heldCharterCard({ charter: null }) === null,
    "the held charter resolves through the pool rather than a copy, so a retuned card is the card the captain holds on the next read, and an id the pool no longer answers draws nothing rather than a placeholder",
  );

  // ========== C. The pure reads ==========

  // The moment reads off the voyage alone: the fourth leg reached with
  // no answer given, whether or not the deal handed the captain a path.
  // The path gates the offer rather than the question, which is the
  // split charterChoices and charterPending make below.
  check(
    !charterDue(pathAt("loom", 3)) &&
      charterDue(pathAt("loom", 4)) &&
      charterDue(pathAt("loom", 12)) &&
      charterDue(pathlessAt(4)) &&
      !charterDue(
        Object.assign(pathAt("loom", 6), {
          charter: "weavers_charter",
        }),
      ),
    "the moment is due at the fourth leg and past it rather than only at it, a pathless captain's question still reads due because the offer is what their path gates, and an answered voyage is a finished question rather than one asked again",
  );

  // The trio, for every path at once: the pair first, in the catalogue's
  // own order, then one wildcard from the other eight and never a second
  // of the captain's own. Derived rather than stored, and seeded rather
  // than rolled: the same read deals the same three.
  check(
    (Object.keys(PATHS) as PathId[]).every((path) => {
      const trio = charterChoices(pathAt(path, 5)).map((card) => card.id);
      const own = CHARTERS.filter((card) => CHARTER_PATH[card.id] === path).map(
        (card) => card.id,
      );
      return (
        trio.length === 3 &&
        trio.slice(0, 2).join() === own.join() &&
        otherEight(path).includes(trio[2]) &&
        !own.includes(trio[2])
      );
    }),
    "every path's table is the path's two charters in the catalogue's own order and one wildcard from the other eight, so the trio's first two slots are the map's answer rather than a shuffle",
  );

  const loomTrio = charterChoices(loomAt(4)).map((card) => card.id);
  const loomAgain = charterChoices(loomAt(4)).map((card) => card.id);
  const loomLater = charterChoices(loomAt(9)).map((card) => card.id);
  check(
    loomTrio.length === 3 &&
      loomTrio[0] === "weavers_charter" &&
      loomTrio[1] === "quality_mark" &&
      loomTrio.join() === loomAgain.join() &&
      loomTrio.join() === loomLater.join(),
    "and the seed leaves the round out: the same captain is dealt the same three on a re read and again at a later leg, so a room advance, a checkpoint or a reload cannot reshuffle the cards under their eyes",
  );

  check(
    charterChoices(voyageState()).length === 0,
    "a captain holding no path has an empty table rather than a smaller one, because a charter forks a path and a captain without one has nothing to fork",
  );

  withEnv("NEXT_PUBLIC_CHARTERS", "1", () => {
    check(
      !charterPending(pathlessAt(4)) &&
        !charterPending(loomAt(3)) &&
        charterPending(loomAt(4)) &&
        !charterPending(
          Object.assign(loomAt(6), { charter: "weavers_charter" }),
        ),
      "the moment is drawn only when the switch is on, the leg is reached, a path is held and no answer stands, which is the whole of what a screen has to ask before it draws the overlay",
    );
    withEnv("NEXT_PUBLIC_CHARTERS", "0", () => {
      check(
        !charterPending(loomAt(4)) && charterDue(loomAt(4)),
        "and with the switch off a due moment is not drawn while the question itself still reads due, which is the split the rollback rests on: the reading is about the voyage and only the pending read is about the deployment",
      );
    });
    const classicLoom = pathAt("loom", 4);
    classicLoom.mode = CLASSIC;
    check(
      !charterPending(classicLoom) && charterChoices(classicLoom).length === 3,
      "the founding mode's captain, who can never be offered one, would still be dealt the full three by the same reader, and the pending read is what keeps the moment off their screen",
    );
  });

  // The wildcard is drawn flat, which is what lets the dashboard's cover
  // row read the pool rather than read who happened to be dealt what. A
  // leaning draw would still deal every card eventually; it would not
  // deal them in the bands a flat one answers for, and those are what
  // this holds.
  {
    const counts = new Map<string, number>();
    for (let epoch = 1; epoch <= 400; epoch++) {
      const state = loomAt(4);
      state.voyageEpoch = epoch;
      const wild = charterChoices(state)[2]?.id ?? "";
      counts.set(wild, (counts.get(wild) ?? 0) + 1);
    }
    const others = otherEight("loom");
    check(
      counts.size === others.length &&
        others.every((id) => {
          const drawn = counts.get(id) ?? 0;
          return drawn >= 20 && drawn <= 90;
        }),
      "and over four hundred voyages every one of the other eight is drawn, in bands only a flat draw answers for, so the third slot leans toward no card and the cover row's denominator stays the pool rather than a luckier pair of cards",
    );
  }

  // ========== D. The writes ==========

  withEnv("NEXT_PUBLIC_CHARTERS", "1", () => {
    const answering = loomAt(4);
    answering.modifierFlags = { vat_discount: 0.5 };
    const logs: string[] = [];
    const trio = charterChoices(answering);
    const took = answerCharter(answering, trio[0].id, logs);
    check(
      took &&
        trio[0].id === "weavers_charter" &&
        answering.charter === "weavers_charter" &&
        answering.modifierFlags.loom_extra_produce === 1 &&
        answering.modifierFlags.vat_discount === 0.5 &&
        trio.every((card) => answering.cardTally[card.id]?.offered === 1) &&
        trio.every(
          (card) =>
            answering.cardTally[card.id]?.picked ===
            (card.id === "weavers_charter" ? 1 : 0),
        ) &&
        logs.some(
          (line) =>
            line.includes(CHARTER_MOMENT.icon) &&
            line.includes(cardLead("weavers_charter")),
        ) &&
        !charterPending(answering),
      "answering takes the card the moment dealt: the id is stored, the flag folds in beneath whatever the voyage already carried, the three offers and the one pick are counted off the same table the guard validated, and the ledger line speaks in the moment's own glyph",
    );
    check(
      !answerCharter(answering, "weavers_charter", logs) &&
        answering.charter === "weavers_charter",
      "and a second answer meets a question already answered, so the idempotence falls out of the pending guard rather than being written beside it",
    );

    const refusing = loomAt(4);
    const refuseLogs: string[] = [];
    const refusedWrong = answerCharter(refusing, "gun_charter", refuseLogs);
    const quiet =
      refusing.charter === null && Object.keys(refusing.cardTally).length === 0;
    check(
      !refusedWrong &&
        quiet &&
        !answerCharter(voyageState(), "weavers_charter", []) &&
        answerCharter(refusing, charterChoices(refusing)[0].id, refuseLogs) &&
        !answerCharter(refusing, "gun_charter", refuseLogs),
      "a press is validated against the same derived table the screen drew, so a stale click on a card this moment does not deal is refused with the trio left standing, and an answer with no moment waiting is refused as well",
    );

    const together = loomAt(4);
    together.heldBoons = ["steady_watch"];
    answerCharter(together, "weavers_charter", []);
    check(
      together.modifierFlags.steady_rations === 1 &&
        together.modifierFlags.loom_extra_produce === 1,
      "a held boon beside the charter reaches the books through one spread, so the voyage's two long lived effects are read from one set rather than racing for it",
    );
  });

  // The rollback, read the way its own sentence reads: with the switch
  // off the moment is not shown, and a charter already held keeps its
  // flags for the voyage. The second half is why this check drives a
  // rollover rather than only a read: the held merge is deliberately not
  // gated, and the round's own flags are what the rollover replaces.
  withEnv("NEXT_PUBLIC_CHARTERS", "0", () => {
    const rolling = loomAt(4);
    rolling.charter = "weavers_charter";
    rolling.money = 5000;
    rolling.phase = "resolve";
    rolling.pirateAttackResolved = true;
    rolling.modifierFlags = { loom_extra_produce: 1, vat_discount: 0.5 };
    const rollLogs: string[] = [];
    const ctx = {
      seedBase: `smoke:charters:${suffix}`,
      harborId: "harbor-a",
    };
    for (let press = 0; press < 6 && rolling.currentRound === 4; press++) {
      nextPhase(rolling, ctx, rollLogs);
    }
    check(
      rolling.currentRound === 5 &&
        rolling.modifierFlags.loom_extra_produce === 1 &&
        rolling.modifierFlags.vat_discount === undefined &&
        rolling.charter === "weavers_charter" &&
        heldFlagsOf({ heldBoons: [], charter: "weavers_charter" })
          .loom_extra_produce === 1,
      "a round's rollover rebuilds the flag set from the held cards, so the charter's key rides through every reset while the round's own vat discount comes and goes above it, and the merge reads the same with the switch off because it answers about a card already taken rather than about the offer",
    );
  });

  // ========== E. The eleven read sites ==========

  // The Factor's two keys (the borrow count and its penalty) are already
  // read at their three live sites by the borrow article's own checks, so
  // they are counted in the map above rather than driven again here:
  // eleven keys from ten cards, and the one key this suite does not
  // drive is the one another suite drives three ways.

  {
    const laden = voyageState();
    laden.modifierFlags = { transport_per_lot_discount: 1 };
    const plainHeavy = calcTransportCost(voyageState(), 10);
    const charteredHeavy = calcTransportCost(laden, 10);
    const plainLight = calcTransportCost(voyageState(), 5);
    const charteredLight = calcTransportCost(laden, 5);
    check(
      plainHeavy > 0 &&
        charteredHeavy === Math.max(0, plainHeavy - 10) &&
        charteredLight === Math.max(0, plainLight - 5) &&
        charteredHeavy < plainHeavy,
      "The Bulk Charter is read in the freight arithmetic: a Gold off per lot, after the round's own discounts and before the modules, floored at zero so a charter that empties a light run's freight is doing what its text says",
    );
  }

  // One order board dealt from one seed per round, so the runs of a
  // check stand on identical cards and the only difference between two
  // of them is the flag under test. The scan is for a fillable card of
  // the shape the check needs, because which order a board deals is the
  // board's business rather than something a check may assume.
  const boardAt = (round: number) => {
    const state = voyageState();
    snapToCheckpoint(
      state,
      { seedBase: `smoke:charters:${suffix}`, harborId: "harbor-a" },
      round,
      "orders",
      [],
    );
    return state;
  };
  const fillable = (order: OrderCard, board: GameState) =>
    !order.isProductOrder &&
    !order.isBrokerFavor &&
    order.reward > 0 &&
    pathOrderOf(order, board.mode) === null;
  const findOrder = (
    chooser: (order: OrderCard, board: GameState) => boolean,
  ) => {
    for (let round = 1; round <= 12; round++) {
      const board = boardAt(round);
      const order = board.customerCards.find(
        (card) => fillable(card, board) && chooser(card, board),
      );
      if (order !== undefined) return { round, order };
    }
    return null;
  };
  const deltaOf = (
    round: number,
    order: OrderCard,
    flags: Partial<Record<ModifierKey, number>>,
  ) => {
    const state = boardAt(round);
    state.modifierFlags = { ...state.modifierFlags, ...flags };
    for (const r of order.resources) {
      state.inventory[r.type] =
        (state.inventory[r.type] ?? 0) + (r.required ?? 0);
    }
    state.money = 1000;
    const before = state.money;
    completeOrder(state, order.id, []);
    return state.money - before;
  };

  {
    const found = findOrder((order) =>
      order.resources.every((r) => !carriesTag("good", r.type, "woven")),
    );
    if (found !== null) {
      const plain = deltaOf(found.round, found.order, {});
      const manif = deltaOf(found.round, found.order, {
        manifest_order_bonus: 0.15,
      });
      check(
        plain > 0 &&
          manif - plain === Math.floor(found.order.reward * 0.15) &&
          manif - plain > 0,
        "The Standing Manifest is read at the order's payout: fifteen percent of the face reward more, on every completed order for the rest of the voyage, taken as the same addition the cards above it take rather than as a multiplication that would lose a coin to floating point",
      );
    } else {
      check(false, "the board deals a plain order to fill");
    }
  }

  {
    const found = findOrder((order) =>
      order.resources.some((r) => carriesTag("good", r.type, "woven")),
    );
    if (found !== null) {
      const plain = deltaOf(found.round, found.order, {});
      const marked = deltaOf(found.round, found.order, {
        loom_sale_bonus: 0.1,
      });
      check(
        plain > 0 &&
          marked - plain === Math.floor(found.order.reward * 0.1) &&
          marked - plain > 0,
        "The Quality Mark is read at the woven sale: a tenth of the reward more on the orders that carry cloth, and the cloth it reads is the same woven tag the Woven Monopoly reads, so the mark and the monopoly cannot come to disagree about what counts as woven",
      );
    } else {
      check(false, "the board deals a woven order to fill");
    }
  }

  {
    const calm = voyageState();
    calm.currentRound = 6;
    const armed = voyageState();
    armed.currentRound = 6;
    armed.modifierFlags = { guns_risk_discount: 0.3 };
    check(
      pirateChance(calm) > 0 &&
        Math.abs(pirateChance(armed) - pirateChance(calm) * 0.7) < 1e-9,
      "The Gun Charter is read at the raiders' table: the risk thirty percent lower for the voyage, taken as the same multiplication Fleet Colors takes and landing right after it, ahead of the compass's flat thirty",
    );
  }

  {
    const rate = difficultyConfig(voyageState().difficulty).escortCostRate;
    const plainEscort = voyageState();
    plainEscort.money = 1000;
    const escorted = voyageState();
    escorted.money = 1000;
    escorted.modifierFlags = { standing_escort_discount: 0.5 };
    const both = voyageState();
    both.money = 1000;
    both.modifierFlags = {
      escort_discount: 0.5,
      standing_escort_discount: 0.5,
    };
    check(
      escortCost(plainEscort) === Math.floor(1000 * rate) &&
        escortCost(escorted) === Math.floor(1000 * rate * 0.5) &&
        escortCost(both) === Math.floor(1000 * rate * 0.25) &&
        escortCost(escorted) < escortCost(plainEscort),
      "The Standing Escort is read where the fee is charged: the hire costs half, taken as the same multiplication the Escort Pact takes and landing after it, so a captain holding both pays the product of the two",
    );
  }

  {
    const wovenGood = Object.keys(PRODUCT_PRICES).find((good) =>
      carriesTag("good", good, "woven"),
    );
    const plainGood = Object.keys(PRODUCT_PRICES).find(
      (good) => good !== wovenGood,
    );
    if (wovenGood !== undefined && plainGood !== undefined) {
      const bench = (charter: boolean) => {
        const state = voyageState();
        state.money = 1000;
        state.larder = 10;
        hireWorker(state, "weaver", []);
        hireWorker(state, "coppersmith", []);
        state.workers.weaver[0].task = wovenGood;
        state.workers.coppersmith[0].task = plainGood;
        if (charter) state.modifierFlags = { loom_extra_produce: 1 };
        processProduction(state, []);
        return state;
      };
      const plainBench = bench(false);
      const charteredBench = bench(true);
      check(
        plainBench.inventory[wovenGood] === 1 &&
          charteredBench.inventory[wovenGood] === 2 &&
          plainBench.inventory[plainGood] === 1 &&
          charteredBench.inventory[plainGood] === 1,
        "The Weavers' Charter is read once at the loom: each weaving hand makes one more item and the smith's output is untouched, because the card's sentence says each weaver and the gate reads the trade's own id rather than its label",
      );
    } else {
      check(
        false,
        "the recipe table carries a woven product and a plain one to weave",
      );
    }
  }

  {
    const product = Object.keys(PRODUCT_PRICES)[1];
    const plainVat = calcVAT(voyageState(), product, 500);
    const quiet = voyageState();
    quiet.modifierFlags = { voyage_dues_discount: 0.5 };
    check(
      plainVat > 0 &&
        calcVAT(quiet, product, 500) === Math.floor(plainVat * 0.5),
      "The Quiet Account is read in the dues arithmetic: the harbor dues halved, taken as the same multiplication Harbor Credit takes and landing after it rather than beside it",
    );
  }

  {
    const market = voyageState();
    startMarket(
      market,
      { seedBase: `smoke:charters:${suffix}`, harborId: "harbor-a" },
      [],
    );
    const priced = market.resourceCards.find((card) => card.totalCost > 0);
    if (priced !== undefined) {
      const ledger = voyageState();
      ledger.modifierFlags = { voyage_purchase_discount: 0.1 };
      const plainCost = getCardFinalCost(voyageState(), priced);
      const ledgerCost = getCardFinalCost(ledger, priced);
      check(
        plainCost === priced.totalCost &&
          ledgerCost === Math.floor(plainCost * 0.9) &&
          ledgerCost < plainCost,
        "The Long Ledger is read at the port purchase's own arithmetic: a tenth off the card, taken as the same multiplication the round's own discount takes and landing right after it, and the preview the captain hovers reads the same rule through the one price there is rather than a second opinion of one",
      );
    } else {
      check(false, "the market deals a card with a price to read");
    }
  }

  {
    // The one random in the tree this feature reads: the raid roll. The
    // stub is the roll's own floor (zero is below every chance the mode
    // can deal), restored in the finally so no check after this one runs
    // against a coin that always lands the same way.
    const realRandom = Math.random;
    Math.random = () => 0;
    try {
      const raided = voyageState();
      raided.currentRound = 6;
      raided.money = 400;
      raided.modifierFlags = { marque_salvage: 0.25 };
      const raidLogs: string[] = [];
      resolvePirateAttack(raided, raidLogs);
      const bare = voyageState();
      bare.currentRound = 6;
      bare.money = 400;
      const bareLogs: string[] = [];
      resolvePirateAttack(bare, bareLogs);
      const empty = voyageState();
      empty.currentRound = 6;
      empty.money = 0;
      empty.modifierFlags = { marque_salvage: 0.25 };
      const emptyLogs: string[] = [];
      resolvePirateAttack(empty, emptyLogs);
      check(
        raided.money === 100 &&
          raidLogs.some((line) => line.includes("recovered 100")) &&
          bare.money === 0 &&
          empty.money === 0 &&
          !emptyLogs.some((line) => line.includes("recovered")),
        "The Letter of Marque is read at the one site a raid takes gold: a quarter of the raid comes back and the ledger line says how much, a bare hold loses everything, and a hold with nothing in it salvages nothing rather than putting a recovery line over a zero",
      );
    } finally {
      Math.random = realRandom;
    }
  }

  // ========== F. The save ==========

  const kept = voyageState();
  kept.charter = "weavers_charter";
  const retired = voyageState();
  retired.charter = "old_relic";
  const stranger = voyageState();
  stranger.charter = 42 as unknown as string;
  const legacy = voyageState();
  legacy.charter = undefined as unknown as string;
  for (const state of [kept, retired, stranger, legacy]) {
    healLoadedVoyage(state, { legacyRenownLevel: null });
  }
  check(
    kept.charter === "weavers_charter" &&
      retired.charter === null &&
      stranger.charter === null &&
      legacy.charter === null,
    "the load path heals the field through the pool's own reader: a charter this build still ships stays, and a retired id, a write that is not a card and a save from before the field existed all read as a voyage that has not answered yet, which is the plan's rollback clause read word for word",
  );

  // ========== G. The take on the wire ==========

  // The socket handler reaches its captain through a listener map this
  // suite cannot see, so the accumulator is driven here the way the
  // handler drives it, against the real database, and everything it
  // writes is deleted again.
  const roomPrefix = `smoke51-${suffix}-`;
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
    noteLegAdvanced(roomA, 4);
    noteCharterTaken(roomA, "u-a", "weavers_charter", "loom", "honest");
    noteCharterTaken(roomA, "u-a", "gun_charter", "convoy", "pirate");
    await closeVoyageTelemetry(roomA, "concluded", []);
    const rowsA = await db.voyageTelemetry.findMany({
      where: { roomId: roomA },
    });
    const storedA =
      rowsA.length === 1 ? readStoredRecord(rowsA[0].record) : null;
    const takesA =
      storedA?.events.filter((event) => event.name === "charter_taken") ?? [];
    const fieldsA = takesA[0]?.name === "charter_taken" ? takesA[0] : null;
    const captainA = storedA?.captains.find((line) => line.userId === "u-a");
    check(
      takesA.length === 1 &&
        fieldsA !== null &&
        fieldsA.leg === 4 &&
        fieldsA.charter === "weavers_charter" &&
        fieldsA.path === "loom" &&
        fieldsA.role === "honest" &&
        captainA !== undefined,
      "a captain's take is written once per voyage whatever the client repeats: the first claim stands rather than the last, the leg is the accumulator's rather than a number the claim chose, and the path and the alignment are the fields the caller attached rather than anything the wire said",
    );

    const roomB = `${roomPrefix}b`;
    openVoyageTelemetry(roomFacts(roomB), []);
    noteCharterTaken(roomB, "u-b", "gun_charter", "convoy", "pirate");
    noteCharterTaken(
      roomB,
      "u-c",
      "letter_of_marque",
      "free_captain",
      "broker",
    );
    await closeVoyageTelemetry(roomB, "concluded", []);
    const rowsB = await db.voyageTelemetry.findMany({
      where: { roomId: roomB },
    });
    const storedB =
      rowsB.length === 1 ? readStoredRecord(rowsB[0].record) : null;
    const takesB =
      storedB?.events.filter((event) => event.name === "charter_taken") ?? [];
    const firstB = takesB[0]?.name === "charter_taken" ? takesB[0] : null;
    const secondB = takesB[1]?.name === "charter_taken" ? takesB[1] : null;
    check(
      takesB.length === 2 &&
        firstB?.actor === "u-b" &&
        firstB.charter === "gun_charter" &&
        secondB?.actor === "u-c" &&
        secondB.charter === "letter_of_marque",
      "and the once per voyage rule is per captain rather than per table: two captains take two lines, in the order the takes arrived, so one captain's silence cannot swallow another's charter",
    );

    const roomC = `${roomPrefix}c`;
    noteCharterTaken(roomC, "u-d", "weavers_charter", "loom", "honest");
    const rowsC = await db.voyageTelemetry.count({
      where: { roomId: roomC },
    });
    check(
      rowsC === 0,
      "a take noted against a room the accumulator never opened is dropped by the writer rather than opening a record for it, so a stray claim cannot mint a voyage in the operator's table",
    );

    const roomD = `${roomPrefix}d`;
    openVoyageTelemetry(roomFacts(roomD), []);
    for (let i = 0; i < TELEMETRY_EVENT_CAP; i++) {
      noteTelemetry(roomD, "message_sent", { actor: "u-e" });
    }
    noteCharterTaken(roomD, "u-e", "weavers_charter", "loom", "honest");
    await closeVoyageTelemetry(roomD, "concluded", []);
    const rowsD = await db.voyageTelemetry.findMany({
      where: { roomId: roomD },
    });
    const storedD =
      rowsD.length === 1 ? readStoredRecord(rowsD[0].record) : null;
    check(
      storedD !== null &&
        storedD.truncated &&
        storedD.events.length === TELEMETRY_EVENT_CAP &&
        storedD.events.every((event) => event.name !== "charter_taken"),
      "a voyage whose events have filled to the cap drops the take rather than stretching the record, so a full ledger stops at its cap instead of growing one line past it",
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
    wiring.includes('card?.kind === "charter"') &&
      wiring.includes("path === null") &&
      wiring.includes("role === undefined") &&
      wiring.includes("heldPathOf(roomId") &&
      wiring.includes("noteCharterTaken(roomId") &&
      hook.includes("chartersOn(game.mode)") &&
      hook.includes("game.charter ?? undefined"),
    "the two ends of the wire the take sits between: the client claims the charter only while the switch is on, and the server vouches it through the pool before attributing the path off the room's own book and the alignment off the table, dropping a take it cannot place on either rather than filling in a guess",
  );

  check(
    heldPathOf("smoke51-never-drafted", "u-a") === null,
    "and the book the server attributes paths from answers null for a room it has never seen, which is the one reader of that book and the shape every unattributable take takes on its way to the drop",
  );

  // ========== H. The barrel ==========

  check(
    "answerCharter" in engineBarrel &&
      !("charterChoices" in engineBarrel) &&
      !("charterDue" in engineBarrel) &&
      !("charterPending" in engineBarrel) &&
      !("heldFlagsOf" in engineBarrel),
    "only the answer crosses the engine's barrel: the reads stay in the vocabulary's own module where the overlay and the server both find them, and the merge stays with the held cards, so a caller meets the question through the module that asks it",
  );
}
