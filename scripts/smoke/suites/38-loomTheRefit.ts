// PortMasters 2.2 Parallel Release, smoke run: Loom: the refit.

import { RefitBoard } from "@/types/realtime/boards";
import { db } from "@/lib/db";
import {
  MEND_GOLD_PER_POINT,
  RAGS_AT_PORT_COLD,
  RAG_SCRAP_VALUE,
  REFIT_POINTS,
  REWEAVE_GOOD,
  REWEAVE_RAGS,
} from "@/lib/game/constants/garments";
import { RAGS, RECIPES } from "@/lib/game/constants/goods";
import { CONSENT_FEE_MAX, CONSENT_FEE_MIN } from "@/lib/game/constants/paths";
import type { RefitContract } from "@/lib/game/engine";
import {
  REFIT_SELLER_PATH,
  applyRefitSide,
  buyRag,
  canSellRefit,
  expireConsent,
  mendGarment,
  normalizeRefitState,
  ragsAtPort,
  ragsLeftAtPort,
  refitRoomFor,
  refitSellerBusy,
  refitsOn,
  reweaveRags,
} from "@/lib/game/engine";
import { garmentSpec, legIsCold } from "@/lib/game/garments";
import { cargoCapacity, cargoRoom } from "@/lib/game/larder";
import { PATH_IDS } from "@/lib/game/paths";
import { phaseFace } from "@/lib/game/phases";
import type { GameState, Phase } from "@/lib/game/types";
import type { VoyageLogEntry } from "@/lib/game/voyage-log";
import { voyageLogLine } from "@/lib/game/voyage-log";
import {
  GAMBIT,
  LEDGER_PHRASE,
  call,
  carriesADash,
  check,
  openAuthedSocket,
  signUp,
  suffix,
  switchFor,
  voyageState,
  waitForEvent,
  withEnv,
} from "../harness";
import type { Captain, WireHistory } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function loomTheRefitSuite(
  run: SmokeRun,
  inputs: {
    host: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
  },
): Promise<void> {
  const { host } = inputs;

  // ---- The bench, on a captain's own machine ----
  //
  // The wardrobe is switched on for the whole block, because the bench
  // stands on it (see refitsOn), and the bench's own switch is switched on
  // for everything but the checks that are about that switch. A run that
  // left either one at whatever the environment happened to say would make
  // the checks below pass for the wrong reason.
  withEnv("NEXT_PUBLIC_GARMENTS", "1", () => {
    check(
      [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
        withEnv("NEXT_PUBLIC_REFITS", value, switchFor(GAMBIT, refitsOn)),
      ) &&
        ["off", "0", "OFF", " off ", "Off"].every(
          (value) =>
            !withEnv("NEXT_PUBLIC_REFITS", value, switchFor(GAMBIT, refitsOn)),
        ),
      "the Loom's bench is on for every value of its own switch except the word off and the digit zero, which is the policy every switch in this tree is read through",
    );
    check(
      !withEnv("NEXT_PUBLIC_GARMENTS", "off", () =>
        withEnv("NEXT_PUBLIC_REFITS", "1", switchFor(GAMBIT, refitsOn)),
      ),
      "and it stands on the wardrobe rather than beside it: a table with no clothes layer has nothing to put right, so the bench's own switch cannot open it alone",
    );

    // One voyage, in whatever shape a check below needs it, and one helper
    // that keeps the lines a refusal writes. Every function on this bench
    // answers yes or no and says why, so the checks below hold the sentence
    // as well as the answer: a captain who presses a button is owed one.
    const benchState = (over: Partial<GameState> = {}): GameState => ({
      ...voyageState({ voyageEpoch: 7 }),
      path: REFIT_SELLER_PATH,
      money: 500,
      ...over,
    });
    const attempt = (
      trade: (logs: string[]) => boolean,
    ): { ok: boolean; said: string } => {
      const logs: string[] = [];
      const ok = trade(logs);
      return { ok, said: logs[logs.length - 1] ?? "" };
    };

    withEnv("NEXT_PUBLIC_REFITS", "1", () => {
      check(
        PATH_IDS.every(
          (id) =>
            canSellRefit({ path: id, mode: GAMBIT }) ===
            (id === REFIT_SELLER_PATH),
        ) && !canSellRefit({ path: null, mode: GAMBIT }),
        "one path works the bench and no other does, so the question a captain asks before offering is answered by the path record rather than by a name written into a screen",
      );

      // The two legs this block needs, found by asking the sea rather than
      // by naming rounds that happen to be cold. The weather is drawn from
      // the voyage's own numbers (see legIsCold), so a block that listed its
      // legs would be holding its own copy of the draw and would go on
      // passing after the draw moved.
      const legAt = (round: number): GameState =>
        benchState({ currentRound: round });
      const rounds = Array.from({ length: 60 }, (_, index) => index + 1);
      const coldRound = rounds.find((round) => legIsCold(legAt(round)));
      const warmRound = rounds.find((round) => !legIsCold(legAt(round)));
      if (coldRound === undefined || warmRound === undefined) {
        // A precondition rather than a claim: a sixty leg window of one
        // fixed draw that came back all one kind would make every check
        // below a statement about a weather system this voyage does not
        // have, and the checks are about the pile rather than the sea.
        throw new Error("This voyage's weather carried no leg of one kind.");
      }
      const coldLeg = legAt(coldRound);
      const warmLeg = legAt(warmRound);
      const pile = ragsAtPort(coldLeg);
      check(
        pile >= 1 &&
          pile <= RAGS_AT_PORT_COLD &&
          ragsLeftAtPort(coldLeg) === pile &&
          ragsAtPort(warmLeg) === 0 &&
          ragsLeftAtPort(warmLeg) === 0,
        "the harbor's pile fills on a cold leg, inside the bound the constants carry, and there is no pile at all after a fair one, which is the plan's tension written as a number: a Loom is poor in fair weather and busy in cold",
      );
      check(
        ragsAtPort(legAt(coldRound)) === pile &&
          ragsAtPort(benchState({ currentRound: coldRound, path: null })) ===
            pile,
        "and the pile is drawn from the voyage's own numbers rather than from the captain reading it, so two Loom captains at one table each take their own share of the same pile, and a reload answers the way it answered before",
      );
      check(
        ragsLeftAtPort({
          ...coldLeg,
          ragsRound: coldRound,
          ragsTaken: pile,
        }) === 0 &&
          ragsLeftAtPort({
            ...coldLeg,
            ragsRound: coldRound - 1,
            ragsTaken: pile + 4,
          }) === pile &&
          ragsLeftAtPort({
            ...coldLeg,
            ragsRound: coldRound,
            ragsTaken: pile + 4,
          }) === 0,
        "the share counts down as it is taken and floors at nothing, and a count stamped with an earlier leg is not subtracted from this one's, which is what lets a save written mid leg be read at the next Dawn without a heal",
      );

      const noPath = attempt((logs) =>
        buyRag(benchState({ currentRound: coldRound, path: null }), logs),
      );
      check(
        noPath.ok === false && noPath.said.includes("Only a Loom captain"),
        "only a Loom captain buys rags off the harbor pile, and the refusal is a sentence rather than a silent false, because the exclusivity the plan asks for is this line rather than a greyed out button",
      );
      const spent = benchState({
        currentRound: coldRound,
        ragsRound: coldRound,
        ragsTaken: pile,
      });
      const spentTry = attempt((logs) => buyRag(spent, logs));
      check(
        spentTry.ok === false &&
          spentTry.said.includes("no rags left") &&
          spent.money === 500 &&
          (spent.inventory[RAGS] ?? 0) === 0,
        "and a captain whose share of the pile is spent is refused with the Gold still in the purse and the rag still on the quay",
      );
      const shortPurse = benchState({
        currentRound: coldRound,
        money: RAG_SCRAP_VALUE - 1,
      });
      const shortTry = attempt((logs) => buyRag(shortPurse, logs));
      check(
        shortTry.ok === false &&
          shortTry.said.includes(String(RAG_SCRAP_VALUE)) &&
          shortPurse.money === RAG_SCRAP_VALUE - 1,
        "and a purse that cannot cover the scrap is refused with the price named in the sentence, rather than being drained into a negative hold",
      );
      // The hold's own room, which is two switches of its own rather than
      // this bench's (see holdCapacityOn). Named here so the check cannot
      // pass on a build whose hold is unbounded.
      withEnv("NEXT_PUBLIC_SURVIVAL", "1", () =>
        withEnv("NEXT_PUBLIC_SPLIT_HOLD", "1", () => {
          const fullHold = benchState({ currentRound: coldRound });
          fullHold.inventory = { Hemp: cargoCapacity(fullHold) };
          const fullTry = attempt((logs) => buyRag(fullHold, logs));
          check(
            cargoRoom(fullHold) === 0 &&
              fullTry.ok === false &&
              fullTry.said.includes("no room") &&
              (fullHold.inventory[RAGS] ?? 0) === 0,
            "and a hold with no room left is refused in words, because a rag takes a slot in exactly the way a bolt of silk does: the bench reads the one capacity reader rather than working the room out for itself",
          );
        }),
      );
      const loom = benchState({ currentRound: coldRound });
      const bought = attempt((logs) => buyRag(loom, logs));
      check(
        bought.ok &&
          loom.money === 500 - RAG_SCRAP_VALUE &&
          loom.inventory[RAGS] === 1 &&
          loom.ragsBought === 1 &&
          loom.ragsTaken === 1 &&
          loom.ragsRound === coldRound &&
          bought.said.includes(`${pile - 1} left`),
        "the purchase takes the scrap out of the purse, puts one rag in the hold and stamps the leg it was taken in, and the line it writes is the count the captain has left rather than the count the harbor started with",
      );
      const drained = benchState({ currentRound: coldRound });
      drained.inventory = {};
      let taken = 0;
      while (buyRag(drained, [])) taken += 1;
      check(
        taken === pile &&
          ragsLeftAtPort(drained) === 0 &&
          (drained.inventory[RAGS] ?? 0) === pile &&
          drained.money === 500 - pile * RAG_SCRAP_VALUE,
        "and one captain can take the whole share and not a rag more, one at a time, which is the count the plan bounds the reweave with: three rags at the quay is one coat and a spare rather than an industry",
      );

      const tooFew = benchState({
        currentRound: coldRound,
        inventory: { [RAGS]: REWEAVE_RAGS - 1 },
      });
      const fewTry = attempt((logs) => reweaveRags(tooFew, logs));
      check(
        fewTry.ok === false &&
          fewTry.said.includes(String(REWEAVE_RAGS)) &&
          (tooFew.inventory[REWEAVE_GOOD] ?? 0) === 0,
        "a reweave takes the two rags the constants name and is refused when the hold has fewer, with the count in the sentence rather than the hold quietly losing what it had",
      );
      const strangerWeave = benchState({
        path: null,
        inventory: { [RAGS]: REWEAVE_RAGS },
      });
      const strangerWove = attempt((logs) => reweaveRags(strangerWeave, logs));
      check(
        strangerWove.ok === false &&
          strangerWove.said.includes("Only a Loom captain") &&
          (strangerWeave.inventory[RAGS] ?? 0) === REWEAVE_RAGS,
        "and nobody but the path that holds the chain works rags back into cloth, which is what makes the pile worth buying in the first place",
      );
      const weaver = benchState({
        currentRound: coldRound,
        inventory: { [RAGS]: REWEAVE_RAGS },
      });
      const wove = attempt((logs) => reweaveRags(weaver, logs));
      check(
        wove.ok &&
          (weaver.inventory[RAGS] ?? 0) === 0 &&
          (weaver.inventory[REWEAVE_GOOD] ?? 0) === 1 &&
          weaver.ragsRewoven === 1 &&
          wove.said.includes(REWEAVE_GOOD),
        "a reweave spends the rags and returns one coat, which is the weaver's recipe read from the other end: what the path is paid for is the shortcut rather than a cheaper garment",
      );
      // The tie the constants state and this check holds: the chain the
      // Loom holds is the recipe's own, minus the worker and the hemp, so a
      // recipe retuned to three materials fails here rather than quietly
      // moving the price of the chain with it.
      const recipeMaterials = Object.values(
        RECIPES[REWEAVE_GOOD].materials,
      ).reduce((total, count) => total + count, 0);
      check(
        REWEAVE_RAGS === recipeMaterials,
        "and the rags it takes are the materials the recipe it replaces takes, which is the one place the two numbers are held together",
      );

      // The port mend: what every captain can do alone, and the price a
      // refit is measured against.
      const worn = garmentSpec(REWEAVE_GOOD);
      if (!worn) {
        throw new Error("The catalogue carries no garment to mend.");
      }
      const wearing = (durability: number, money = 500): GameState =>
        benchState({
          currentRound: coldRound,
          money,
          garments: [{ good: REWEAVE_GOOD, durability }],
        });
      const notAGood = attempt((logs) =>
        mendGarment(benchState({ currentRound: coldRound }), "Sails", logs),
      );
      check(
        notAGood.ok === false &&
          notAGood.said.includes("not something the harbor can put right"),
        "the harbor tailors refuse a good that is not a garment before they read anything else, because what they are asked to put right comes from the wardrobe table rather than from the request",
      );
      const nothingWorn = attempt((logs) =>
        mendGarment(
          benchState({ currentRound: coldRound }),
          REWEAVE_GOOD,
          logs,
        ),
      );
      check(
        nothingWorn.ok === false && nothingWorn.said.includes("no worn"),
        "and a crew wearing none of that good has nothing for the tailors to work on, so the button is refused where it is charged rather than only where it is drawn",
      );
      const mender = wearing(worn.durability - 2, MEND_GOLD_PER_POINT);
      const mended = attempt((logs) => mendGarment(mender, REWEAVE_GOOD, logs));
      check(
        mended.ok &&
          mender.garments[0]?.durability === worn.durability - 1 &&
          mender.money === 0 &&
          mender.mendsMade === 1 &&
          mender.mendRound === coldRound &&
          mended.said.includes(String(MEND_GOLD_PER_POINT)),
        "the harbor tailors put one point back for the five Gold the constants carry and stamp the leg they worked in rather than clearing a flag, which is what lets a save written mid leg be read at the next Dawn without a heal",
      );
      const twice = attempt((logs) => mendGarment(mender, REWEAVE_GOOD, logs));
      check(
        twice.ok === false && twice.said.includes("already worked"),
        "and a second mend in the same leg is refused rather than sold, so the once a leg rule belongs to the engine and not to the panel that draws the button",
      );
      const whole = wearing(worn.durability);
      const wholeTry = attempt((logs) =>
        mendGarment(whole, REWEAVE_GOOD, logs),
      );
      check(
        wholeTry.ok === false &&
          wholeTry.said.includes("no worn") &&
          whole.money === 500 &&
          whole.garments[0]?.durability === worn.durability,
        "and a mend on a garment already whole is refused rather than sold, because the tailors are paid for the work that happened and there was none to do",
      );
      const thinPurse = wearing(worn.durability - 2, MEND_GOLD_PER_POINT - 1);
      const thinTry = attempt((logs) =>
        mendGarment(thinPurse, REWEAVE_GOOD, logs),
      );
      check(
        thinTry.ok === false &&
          thinTry.said.includes("purse is short") &&
          thinPurse.garments[0]?.durability === worn.durability - 2,
        "and a purse that cannot cover the mend is refused with the garment left exactly as it was, so nothing is ever half paid for",
      );

      check(
        refitRoomFor(wearing(worn.durability - 1), REWEAVE_GOOD) === 1 &&
          refitRoomFor(wearing(1), REWEAVE_GOOD) === REFIT_POINTS &&
          refitRoomFor(
            wearing(worn.durability - (REFIT_POINTS + 1)),
            REWEAVE_GOOD,
          ) === REFIT_POINTS &&
          refitRoomFor(wearing(worn.durability), REWEAVE_GOOD) === 0 &&
          refitRoomFor(benchState(), REWEAVE_GOOD) === 0 &&
          refitRoomFor(benchState(), "Sails") === 0,
        "a refit is worth the three points the constants carry, cut down to whatever the garment's own maximum leaves room for: a coat that has lost one point is a one point refit, and a coat already whole is not a refit at all",
      );

      // One refit, in whatever shape a check below needs it. The phase is
      // the one field no check here varies: every row on this bench was
      // posted at the Market, which is where the board is drawn.
      const refitOn = (
        over: Partial<Omit<RefitContract, "phase">>,
      ): RefitContract => ({
        id: "r1",
        sellerUserId: "loom",
        sellerName: "Smoke Loom",
        buyerUserId: "customer",
        buyerName: "Smoke Customer",
        fee: 30,
        round: 3,
        phase: "market",
        status: "offered",
        good: REWEAVE_GOOD,
        ...over,
      });
      check(
        refitSellerBusy([refitOn({ status: "agreed" })], "loom", 3) &&
          !refitSellerBusy([refitOn({})], "loom", 3) &&
          !refitSellerBusy([refitOn({ status: "agreed" })], "loom", 4) &&
          !refitSellerBusy([refitOn({ status: "agreed" })], "customer", 3),
        "the bench bounds the seller rather than the customer: a refit that was actually taken makes the Loom busy for that leg, an offer nobody took does not, the next leg frees the hands again, and the customer who bought the work is not the party this market runs out of hands",
      );
      check(
        expireConsent([refitOn({})], { phase: "orders", round: 3 }).length ===
          0 &&
          expireConsent([refitOn({})], { phase: "market", round: 3 }).length ===
            1 &&
          expireConsent([refitOn({ status: "agreed" })], {
            phase: "orders",
            round: 3,
          }).length === 1 &&
          expireConsent([refitOn({ status: "agreed" })], {
            phase: "market",
            round: 4,
          }).length === 0,
        "an offer nobody took dies with the Market it was posted in, while a refit the two captains agreed survives the rest of the leg and dies with it, which is the same expiry the escort contract lives under because it is the same primitive",
      );

      // What a refit does to two purses, which is the whole of the trade.
      const agreedRefit = refitOn({ id: "r2", status: "agreed" });
      const seller = benchState({ currentRound: 3 });
      const customer = benchState({
        currentRound: 3,
        garments: [{ good: REWEAVE_GOOD, durability: 2 }],
      });
      const sellerLogs: string[] = [];
      const customerLogs: string[] = [];
      check(
        applyRefitSide(seller, agreedRefit, "loom", sellerLogs) &&
          applyRefitSide(customer, agreedRefit, "customer", customerLogs) &&
          seller.money === 530 &&
          customer.money === 470 &&
          customer.garments[0]?.durability === 2 + REFIT_POINTS &&
          seller.refitsSold === 1 &&
          seller.refitFeesEarned === 30 &&
          customer.refitsBought === 1 &&
          customer.refitFeesPaid === 30,
        "one function settles both sides of a refit: the customer pays the fee the two of them agreed and their own garment takes the points back on their own machine, the seller is paid it, and neither captain's state is ever written by the other's machine",
      );
      check(
        !applyRefitSide(customer, agreedRefit, "customer", []) &&
          !applyRefitSide(seller, agreedRefit, "loom", []) &&
          customer.money === 470 &&
          seller.money === 530,
        "and applying the same side twice moves nothing the second time, because the ledger is what keeps a reload between the agreement and the broadcast that carries it from charging the same fee twice",
      );
      const bystander = benchState({ currentRound: 3 });
      check(
        !applyRefitSide(bystander, agreedRefit, "other", []) &&
          bystander.money === 500 &&
          bystander.refitsSold === 0,
        "and a captain who is neither side of the agreement is not moved by it, which is the whole of what the two names on the row are for",
      );
      const broke = benchState({
        currentRound: 3,
        money: 5,
        garments: [{ good: REWEAVE_GOOD, durability: 2 }],
      });
      const brokeLogs: string[] = [];
      check(
        applyRefitSide(broke, agreedRefit, "customer", brokeLogs) &&
          broke.money === 0 &&
          broke.refitFeesPaid === 5 &&
          broke.garments[0]?.durability === 2 + REFIT_POINTS &&
          brokeLogs.some((line) => line.includes("paid 5 Gold")),
        "a purse that moved between the accept and the settlement pays what it has rather than a negative hold, and the work still happens, because the price was agreed in the open and the purse is the customer's own business",
      );
      const bare = benchState({ currentRound: 3 });
      const bareLogs: string[] = [];
      check(
        applyRefitSide(bare, agreedRefit, "customer", bareLogs) &&
          bareLogs.some((line) => line.includes("no worn")),
        "and a customer whose wardrobe lost the garment between the accept and the settlement reads a sentence saying so, which is the line for a state that moved underneath an agreement rather than for an ordinary leg",
      );
      const dark = benchState({ currentRound: 3 });
      check(
        !withEnv("NEXT_PUBLIC_REFITS", "off", () =>
          applyRefitSide(dark, agreedRefit, "customer", []),
        ) && dark.money === 500,
        "and an agreement settled with the bench switched off moves nobody, which is the plan's rollback read at the one place a refit would have changed a state",
      );

      // The load site, where every field this build added is healed.
      const ancient = voyageState();
      const stripped = ancient as unknown as Record<string, unknown>;
      for (const field of [
        "refitsSold",
        "refitsBought",
        "refitFeesEarned",
        "refitFeesPaid",
        "mendsMade",
        "mendRound",
        "ragsBought",
        "ragsRewoven",
        "ragsTaken",
        "ragsRound",
      ]) {
        stripped[field] = undefined;
      }
      normalizeRefitState(ancient);
      check(
        ancient.refitsSold === 0 &&
          ancient.refitFeesPaid === 0 &&
          ancient.mendsMade === 0 &&
          ancient.ragsRewoven === 0 &&
          ancient.mendRound === 0 &&
          ancient.ragsRound === 0,
        "a save written before this feature reads as a captain who has never mended anything, bought a rag or sold a refit, and both stamps heal to a leg no voyage has rather than to one that reads as already spent",
      );
      const wounded = voyageState();
      wounded.refitsSold = -3;
      wounded.refitFeesEarned = Number.NaN;
      wounded.mendsMade = 2.7;
      wounded.ragsBought = Number.POSITIVE_INFINITY;
      wounded.ragsTaken = -1;
      wounded.mendRound = 2.7;
      wounded.ragsRound = -4;
      normalizeRefitState(wounded);
      const carried = JSON.parse(JSON.stringify(wounded)) as GameState;
      check(
        wounded.refitsSold === 0 &&
          wounded.refitFeesEarned === 0 &&
          wounded.mendsMade === 2 &&
          wounded.ragsBought === 0 &&
          wounded.ragsTaken === 0 &&
          wounded.mendRound === 2 &&
          wounded.ragsRound === 0 &&
          carried.mendsMade === 2 &&
          carried.mendRound === 2,
        "and a save carrying the fields in shapes the engine would not survive is healed to the same reading, floored to whole counts with anything that is not a number read as none, and it round trips through a save with the same meaning on the far side",
      );
    });

    // The bench from the other side of its own switch. The plan's rollback
    // is to remove the Refit action and leave the consent primitive in
    // place for later use, so every reader this feature added answers
    // nothing at all rather than half of it answering. Which leg this state
    // stands in does not matter: the pile is not drawn at all with the
    // bench switched off.
    const offLeg = benchState();
    check(
      !withEnv("NEXT_PUBLIC_REFITS", "off", () =>
        canSellRefit({ path: REFIT_SELLER_PATH, mode: GAMBIT }),
      ) &&
        withEnv("NEXT_PUBLIC_REFITS", "off", () =>
          refitRoomFor(offLeg, REWEAVE_GOOD),
        ) === 0 &&
        withEnv("NEXT_PUBLIC_REFITS", "off", () => ragsAtPort(offLeg)) === 0 &&
        withEnv("NEXT_PUBLIC_REFITS", "off", () => ragsLeftAtPort(offLeg)) ===
          0 &&
        !withEnv("NEXT_PUBLIC_REFITS", "off", () => buyRag(offLeg, [])) &&
        !withEnv("NEXT_PUBLIC_REFITS", "off", () => reweaveRags(offLeg, [])) &&
        !withEnv("NEXT_PUBLIC_REFITS", "off", () =>
          mendGarment(offLeg, REWEAVE_GOOD, []),
        ) &&
        offLeg.money === 500 &&
        (offLeg.inventory[RAGS] ?? 0) === 0,
      "with the bench switched off every reader this feature added answers nothing at all, which is what makes the rollback a bench that is gone rather than one that is half running",
    );
  });

  // ---- The bench, in a real harbor ----
  //
  // Three captains at a table of their own, for the reason the market above
  // gave: the harbor this run shares is still standing at the end of this
  // section, and the checks after it read that one.
  const loomSeller = await signUp("loom_s");
  const loomBuyer = await signUp("loom_b");
  const loomForeigner = await signUp("loom_f");
  run.extraAccounts.push(loomSeller, loomBuyer, loomForeigner);

  const loomRoom = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: loomSeller.cookie,
      body: JSON.stringify({
        name: `Smoke loom ${suffix}`,
        isPublic: false,
        mode: "ocean_gambit",
        unlock: LEDGER_PHRASE,
      }),
    },
  );
  if (loomRoom.status !== 200) {
    throw new Error("No harbor to put a garment right in.");
  }
  const loomRoomId = loomRoom.body.room.id;
  const loomCrew = [loomSeller, loomBuyer, loomForeigner];
  const loomJoins = await Promise.all(
    loomCrew.slice(1).map((captain) =>
      call<{ room: { id: string } }>("/api/rooms/join", {
        method: "POST",
        cookie: captain.cookie,
        body: JSON.stringify({ code: loomRoom.body.room.code }),
      }),
    ),
  );
  check(
    loomJoins.every((join) => join.status === 200),
    "three captains can sit at a table where garments are put right",
  );

  // Each socket's newest bench, and every row that bench has ever carried.
  // The second is what makes the privacy check below a claim about what a
  // captain was told rather than about what they happened to read last.
  const loomBoards = new Map<string, RefitContract[]>();
  const loomSeen = new Map<string, Set<string>>();
  const loomSockets = new Map<string, Socket>();
  for (const captain of loomCrew) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const seatedHere = waitForEvent<WireHistory>(
      socket,
      "chat:history",
      (payload) => payload?.roomId === loomRoomId,
    );
    socket.emit("room:join", { roomId: loomRoomId });
    await seatedHere;
    socket.on("refit:update", (payload: RefitBoard) => {
      if (payload?.roomId !== loomRoomId) return;
      loomBoards.set(captain.id, payload.refits);
      const seen = loomSeen.get(captain.id) ?? new Set<string>();
      for (const refit of payload.refits) seen.add(refit.id);
      loomSeen.set(captain.id, seen);
    });
    loomSockets.set(captain.id, socket);
  }
  const loomSocketOf = (captain: Captain): Socket => {
    const found = loomSockets.get(captain.id);
    if (!found) throw new Error(`No socket for ${captain.username}.`);
    return found;
  };
  const loomBoardOf = (captain: Captain): RefitContract[] =>
    loomBoards.get(captain.id) ?? [];
  const loomSettle = () => new Promise((resolve) => setTimeout(resolve, 500));
  // The emit and the wait are one call, for the reason the market above
  // gives: a refusal waited for after the fact is a refusal this run might
  // already have missed.
  const loomRefused = async (
    captain: Captain,
    event: string,
    frame: Record<string, unknown>,
  ): Promise<string | null> => {
    const refused = waitForEvent<{ roomId: string; error: string }>(
      loomSocketOf(captain),
      "refit:error",
      (payload) => payload?.roomId === loomRoomId && Boolean(payload.error),
    );
    loomSocketOf(captain).emit(event, { roomId: loomRoomId, ...frame });
    return (await refused)?.error ?? null;
  };
  const loomSettles = (
    captain: Captain,
    match: (board: RefitContract[]) => boolean,
  ) =>
    waitForEvent<RefitBoard>(
      loomSocketOf(captain),
      "refit:update",
      (payload) =>
        payload?.roomId === loomRoomId && match(payload?.refits ?? []),
    );

  loomSocketOf(loomSeller).emit("room:start", { roomId: loomRoomId });
  await loomSettle();

  // The bench belongs to the Market, and the departure puts the room at its
  // opening seat rather than at one, so this is posted out of season by
  // construction rather than by a clock the run has to wait on.
  const loomOffSeason = await loomRefused(loomSeller, "refit:post", {
    fee: 20,
    good: REWEAVE_GOOD,
  });
  check(
    loomOffSeason !== null && loomOffSeason.includes(phaseFace("market").label),
    "a refit cannot be offered outside the Market, and the refusal names the phase that opens the bench, because a refit is offered at a port rather than at sea",
  );

  // The room's seat, moved the way this suite moves any room's seat.
  const loomSeat = (captain: Captain, round: number, phase: Phase) =>
    loomSocketOf(captain).emit("game:status", {
      roomId: loomRoomId,
      round,
      phase,
      phaseLabel: phaseFace(phase).label,
      gold: 0,
      reputation: 0,
      shipLevel: 0,
      gameOver: false,
    });
  loomSeat(loomSeller, 1, "market");
  await loomSettle();

  const loomBadFee = await loomRefused(loomSeller, "refit:post", {
    fee: CONSENT_FEE_MAX + 1,
    good: REWEAVE_GOOD,
  });
  check(
    loomBadFee !== null &&
      loomBadFee.includes(String(CONSENT_FEE_MIN)) &&
      loomBadFee.includes(String(CONSENT_FEE_MAX)),
    "a fee outside the bounds is refused by the server rather than clamped, and the refusal states both ends of the range it will take, because the form and the socket go through one reader",
  );

  const notAGarment = await loomRefused(loomSeller, "refit:post", {
    fee: 20,
    good: "Sails",
  });
  check(
    notAGarment !== null && notAGarment.includes("garment the crew can wear"),
    "and a refit naming a good nobody can wear is refused at the door, because a row no customer could take would sit on the bench for a whole leg",
  );

  const loomSelfSell = await loomRefused(loomSeller, "refit:post", {
    fee: 20,
    good: REWEAVE_GOOD,
    targetUserId: loomSeller.id,
  });
  check(
    loomSelfSell !== null,
    "and a captain cannot sell a refit to themselves",
  );

  // A real account standing somewhere else. The membership check is per
  // harbor, which is the only thing that makes aiming an offer at a captain
  // a check at all.
  if (!host) {
    throw new Error("No captain in another harbor to aim an offer at.");
  }
  const loomStrangerTarget = await loomRefused(loomSeller, "refit:post", {
    fee: 20,
    good: REWEAVE_GOOD,
    targetUserId: host.id,
  });
  check(
    loomStrangerTarget !== null,
    "and an offer cannot be addressed at a captain who is not in this harbor, whoever they are in another one",
  );

  const loomOpenPosted = loomSettles(loomForeigner, (board) =>
    board.some(
      (row) => row.sellerUserId === loomSeller.id && row.status === "offered",
    ),
  );
  loomSocketOf(loomSeller).emit("refit:post", {
    roomId: loomRoomId,
    fee: 21.7,
    good: REWEAVE_GOOD,
  });
  const loomOpenRow = ((await loomOpenPosted)?.refits ?? []).find(
    (row) => row.sellerUserId === loomSeller.id && row.status === "offered",
  );
  check(
    loomOpenRow !== undefined &&
      loomOpenRow.fee === 21 &&
      loomOpenRow.good === REWEAVE_GOOD &&
      loomOpenRow.buyerUserId === null &&
      loomOpenRow.phase === "market" &&
      loomOpenRow.round === 1,
    "an open offer lands on the whole table's bench at the fee the form meant, floored to whole Gold, naming the garment, addressed to nobody and stamped with the leg and the phase it was posted in",
  );
  check(
    loomOpenRow !== undefined && loomBoardOf(loomForeigner).length === 1,
    "and it is the only row the third captain is handed, because an offer to the room is the one every captain may take",
  );

  const loomDoubled = await loomRefused(loomSeller, "refit:post", {
    fee: 21,
    good: REWEAVE_GOOD,
  });
  check(
    loomDoubled !== null,
    "a second offer of the same shape from the same seller is refused, so one client cannot paper the bench",
  );

  const loomDirectPosted = loomSettles(loomBuyer, (board) =>
    board.some(
      (row) => row.buyerUserId === loomBuyer.id && row.status === "offered",
    ),
  );
  loomSocketOf(loomSeller).emit("refit:post", {
    roomId: loomRoomId,
    fee: 30,
    good: REWEAVE_GOOD,
    targetUserId: loomBuyer.id,
  });
  const loomDirectRow = ((await loomDirectPosted)?.refits ?? []).find(
    (row) => row.buyerUserId === loomBuyer.id && row.status === "offered",
  );
  check(
    loomDirectRow !== undefined && loomDirectRow.fee === 30,
    "a direct offer lands for the captain it names, at the price that was asked",
  );
  await loomSettle();
  check(
    loomDirectRow !== undefined &&
      loomSeen.get(loomBuyer.id)?.has(loomDirectRow.id) === true &&
      loomSeen.get(loomForeigner.id)?.has(loomDirectRow.id) === false,
    "and no bench the third captain was ever handed carried it, which is the privacy a targeted trade is worth",
  );

  // Asked at a quiet moment, so the next bench this captain is handed is
  // the answer to the question rather than a broadcast that overtook it.
  const askedForBench = waitForEvent<RefitBoard>(
    loomSocketOf(loomForeigner),
    "refit:update",
    (payload) => payload?.roomId === loomRoomId,
  );
  loomSocketOf(loomForeigner).emit("refit:state:request", {
    roomId: loomRoomId,
  });
  const answeredBench = (await askedForBench)?.refits ?? [];
  check(
    loomOpenRow !== undefined &&
      answeredBench.length === 1 &&
      answeredBench[0]?.id === loomOpenRow.id,
    "a captain who asks for the bench is handed the same bench the room broadcast, personalised by the same rules, so the row addressed to somebody else is absent from the answer as well",
  );

  const loomTakenByThird = await loomRefused(loomForeigner, "refit:accept", {
    contractId: loomDirectRow?.id ?? "",
  });
  check(
    loomTakenByThird !== null &&
      loomTakenByThird.includes("addressed to another"),
    "an offer addressed to one captain cannot be taken by another, even though the bench never showed it to them",
  );
  const loomSoldBySeller = await loomRefused(loomSeller, "refit:accept", {
    contractId: loomOpenRow?.id ?? "",
  });
  check(
    loomSoldBySeller !== null,
    "and the captain selling the work is not the captain who takes it",
  );

  const loomAgreedBoard = loomSettles(loomSeller, (board) =>
    board.some(
      (row) => row.id === loomDirectRow?.id && row.status === "agreed",
    ),
  );
  loomSocketOf(loomBuyer).emit("refit:accept", {
    roomId: loomRoomId,
    contractId: loomDirectRow?.id ?? "",
  });
  const loomAgreedRow = ((await loomAgreedBoard)?.refits ?? []).find(
    (row) => row.id === loomDirectRow?.id,
  );
  // The name the row wears is the one the account is registered under, read
  // from the row the server itself read it from rather than typed here, so
  // the check cannot pass on a name this file made up.
  const loomAccount = await db.user.findUnique({
    where: { id: loomBuyer.id },
    select: { displayName: true },
  });
  check(
    loomAgreedRow?.status === "agreed" &&
      loomAgreedRow.buyerUserId === loomBuyer.id &&
      loomAgreedRow.buyerName === loomAccount?.displayName,
    "a captain takes the work by taking the offer, and the row that was an ask is now an agreement with their own name written on it",
  );

  const handsFull = await loomRefused(loomBuyer, "refit:accept", {
    contractId: loomOpenRow?.id ?? "",
  });
  check(
    handsFull !== null && handsFull.includes("already taken on a refit"),
    "and a Loom captain whose hands are full is refused a second customer, because one pair of hands works one garment and a leg is how long they have",
  );

  const loomWithdrawRefused = await loomRefused(loomSeller, "refit:cancel", {
    contractId: loomDirectRow?.id ?? "",
  });
  check(
    loomWithdrawRefused !== null,
    "an agreement the two captains made cannot be withdrawn by the seller, so the one captain who regrets a price is left with the gap rather than with a button",
  );

  const loomCancelledBoard = loomSettles(loomForeigner, (board) =>
    board.every((row) => row.id !== loomOpenRow?.id),
  );
  loomSocketOf(loomSeller).emit("refit:cancel", {
    roomId: loomRoomId,
    contractId: loomOpenRow?.id ?? "",
  });
  check(
    (await loomCancelledBoard) !== null,
    "while an offer nobody has taken is the seller's own to take back",
  );

  // A captain who is not the seller of a row has no button for it, and the
  // silence is the answer rather than an error: reading a row that is
  // somebody else's is not a mistake anybody has made.
  const silentForeign = waitForEvent<{ roomId: string; error: string }>(
    loomSocketOf(loomForeigner),
    "refit:error",
    (payload) => Boolean(payload?.error),
    900,
  );
  loomSocketOf(loomForeigner).emit("refit:cancel", {
    roomId: loomRoomId,
    contractId: loomDirectRow?.id ?? "",
  });
  check(
    (await silentForeign) === null,
    "and a captain who is not the seller of a row cannot take it back, which the server answers with silence rather than with an error",
  );

  // The room's log, which is the other place the trade is written down.
  const loomLog = waitForEvent<{
    roomId: string;
    entries: VoyageLogEntry[];
  }>(
    loomSocketOf(loomForeigner),
    "voyage:log:history",
    (payload) => payload?.roomId === loomRoomId,
  );
  loomSocketOf(loomForeigner).emit("voyage:log:request", {
    roomId: loomRoomId,
  });
  const loomLines = ((await loomLog)?.entries ?? []).map((entry) => entry.text);
  // The two lines are built from the rows the server itself broadcast, so
  // the check is a claim about the bench and the log agreeing rather than
  // about this file's copy of a sentence.
  const loomPostedLine = voyageLogLine({
    kind: "refit_posted",
    captain: loomOpenRow?.sellerName ?? "",
    good: loomOpenRow?.good ?? "",
    fee: loomOpenRow?.fee ?? 0,
  });
  const loomAgreedLine = voyageLogLine({
    kind: "refit_agreed",
    captain: loomAgreedRow?.sellerName ?? "",
    taker: loomAgreedRow?.buyerName ?? "",
    good: loomAgreedRow?.good ?? "",
    fee: loomAgreedRow?.fee ?? 0,
  });
  check(
    loomOpenRow !== undefined &&
      loomAgreedRow !== undefined &&
      loomLines.includes(loomPostedLine) &&
      loomLines.includes(loomAgreedLine),
    "the room's log carries the trade as the bench wrote it, the offer and the agreement, with the price and the garment on both lines and the taker named on the second",
  );

  // The leg moves on. Everything on the bench was sold for the leg that
  // just ended, so the sweep is what takes the whole of it away.
  loomSeat(loomSeller, 2, "market");
  await loomSettle();
  check(
    loomBoardOf(loomSeller).length === 0 &&
      loomBoardOf(loomBuyer).length === 0 &&
      loomBoardOf(loomForeigner).length === 0,
    "the leg a refit was sold for is the leg it lives, and the move to the next one takes the whole bench off every captain's screen",
  );

  const loomReopenedBench = loomSettles(loomForeigner, (board) =>
    board.some(
      (row) => row.sellerUserId === loomSeller.id && row.status === "offered",
    ),
  );
  loomSocketOf(loomSeller).emit("refit:post", {
    roomId: loomRoomId,
    fee: 12,
    good: REWEAVE_GOOD,
  });
  const loomReopenedRow = ((await loomReopenedBench)?.refits ?? []).find(
    (row) => row.sellerUserId === loomSeller.id,
  );
  check(
    loomReopenedRow?.round === 2 && loomReopenedRow?.fee === 12,
    "and the bench opens again on the new leg, which is what makes the one refit a leg a bound the voyage reads a leg at a time rather than a ceiling on the trade",
  );

  // The house rule, over the copy this feature added: the sentences a
  // captain reads at the bench are the bench's own, and the files that
  // carry them are held whole, comments included.
  check(
    !carriesADash("src/lib/game/engine/refits.ts") &&
      !carriesADash("src/lib/game/engine/consent.ts") &&
      !carriesADash("src/lib/use-refit-contracts.ts") &&
      !carriesADash("src/lib/use-consent-board.ts") &&
      !carriesADash("src/components/portmasters/game/RefitBench.tsx") &&
      !carriesADash("src/server/realtime/refits.ts") &&
      !carriesADash("src/server/realtime/consent.ts"),
    "every file the refit's copy lives in reads free of en dashes, em dashes and doubled hyphens, which is the house rule for every string a captain reads",
  );

  // =====================================================================
}
