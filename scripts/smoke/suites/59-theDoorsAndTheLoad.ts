// PortMasters 2.2 Parallel Release, smoke run: The doors and the load.

import {
  applyModuleTradeSide,
  getOwnedAmount,
  hireWorker,
  payMaintenance,
  type ModuleTrade,
} from "@/lib/game/engine";
import { cardById } from "@/lib/game/cards";
import { normalizeLarderLots } from "@/lib/game/foods";
import { feedCrew } from "@/lib/game/larder";
import { tickGarments } from "@/lib/game/garments";
import { difficultyConfig } from "@/lib/game/difficulty";
import {
  MAX_SHIP_LEVEL,
  SHIP_UPGRADE_LADDER,
} from "@/lib/game/constants/ships";
import { healLoadedVoyage } from "@/lib/session/heal-save";
import type { GameState } from "@/lib/game/types";
import { check, voyageState, withEnv } from "../harness";

/**
 * The bug cycle's engine reconciliations, held in one article because
 * they are one shape read at five places: a rule the engine already
 * states somewhere was restated, by hand, where it was needed, and the
 * two copies drifted.
 *
 * The hull taught the lesson first. A module joining a hull ran two
 * incremental lines buried in equipModule while leaving ran an exported
 * function, and the moment a module gained a third door (the Parley
 * trade's buyer side) the arrival lines were the ones it missed, so a
 * traded surcharge module was never charged and its first unwind
 * subtracted a penalty that was never added, which read as a negative
 * bill that paid the captain every Resolve. The fix is one install
 * function every door calls, plus a load that reconciles the two
 * surcharge fields to the hull they are a function of, which heals both
 * directions of the mismatch a shipped build wrote.
 *
 * The rest are the same disease at smaller scale: the load's bare
 * coalesces that never looked at the elements inside a collection (the
 * hull's card records, the whisper board's entries), the ship's own
 * ledger (a NaN fee, a level past the top of its ladder, a fixed cost
 * the tier owns), the pantry's reader asking its table with the in
 * operator, the purse's reader missing the fallback its sibling had, and
 * two log lines quoting a constant or a unit rather than the effect the
 * engine actually applied. Each check below pins the repaired reading
 * and, where the old behavior was a lie a captain could read, pins its
 * absence too.
 *
 * The states are built by hand in the manner of the articles beside
 * this one: no dealer writes a poisoned save for you, and the arithmetic
 * under check is the arithmetic the engine's own doors run on.
 */
export async function theDoorsAndTheLoadSuite(): Promise<void> {
  const logs: string[] = [];

  const overdrive = cardById("overdrive_engine");
  const hauler = cardById("bulk_hauler");
  check(
    overdrive !== null && hauler !== null,
    "the pool still answers for the two modules whose surcharge every check below is about, so a failure past this line is the accounting rather than a missing card",
  );
  if (overdrive === null || hauler === null) return;

  // One trade row, in whatever shape a check needs it, the same helper
  // the module trade's own article keeps for the same reason.
  const row = (
    over: Partial<Omit<ModuleTrade, "phase">> = {},
  ): ModuleTrade => ({
    id: "m1",
    sellerUserId: "seller",
    sellerName: "Smoke Seller",
    buyerUserId: null,
    buyerName: null,
    fee: 30,
    round: 3,
    phase: "parley",
    status: "offered",
    module: "bulk_hauler",
    ...over,
  });
  const hullState = (over: Partial<GameState> = {}): GameState => ({
    ...voyageState({ voyageEpoch: 7 }),
    money: 500,
    shipLevel: 3,
    ...over,
  });

  // ---- A. The third door charges what the unwind expects ----
  withEnv("NEXT_PUBLIC_MODULE_TRADES", "1", () => {
    const bought = hullState({ currentRound: 3 });
    const buyLogs: string[] = [];
    check(
      applyModuleTradeSide(
        bought,
        row({
          status: "agreed",
          module: "overdrive_engine",
          buyerUserId: "buyer",
          buyerName: "Smoke Buyer",
          fee: 40,
        }),
        "buyer",
        buyLogs,
      ) === true &&
        bought.equippedModules.length === 1 &&
        bought.maintenancePenalty === 10 &&
        bought.cardTally.overdrive_engine?.picked === 1 &&
        bought.money === 460 &&
        buyLogs.some((line) => line.includes("is bolted to the hull")),
      "a module bought at the Parley lands with the accounting every other landing site charges: the overdrive's surcharge rides the hull and the pick is written to the tally, where the buyer branch used to push the card bare, which left the surcharge uncharged and the tally missing the one module this captain actually took",
    );

    const soldLogs: string[] = [];
    check(
      applyModuleTradeSide(
        bought,
        row({
          id: "m2",
          status: "agreed",
          module: "overdrive_engine",
          sellerUserId: "buyer",
          buyerUserId: "other",
          buyerName: "Other",
          fee: 40,
        }),
        "buyer",
        soldLogs,
      ) === true &&
        bought.equippedModules.length === 0 &&
        bought.maintenancePenalty === 0 &&
        bought.money === 500,
      "and the unwind that follows it subtracts exactly what the bolt charged: the module leaves and the surcharge leaves with it, all the way back to zero rather than to a debt the hull never owed",
    );

    const beforeBill = bought.money;
    const billLogs: string[] = [];
    const paid = payMaintenance(bought, billLogs);
    check(
      paid === true &&
        bought.money ===
          beforeBill - (bought.fixedCost + bought.maintenancePenalty) &&
        bought.money < beforeBill,
      "so the maintenance line after the sale is a bill rather than a payout: the hull that, through the uncharged bolt and its unwind, used to carry a minus ten surcharge and pay its captain Gold every Resolve now pays the tier fee and not one Gold more",
    );
  });

  // ---- B. The load reconciles what the doors wrote ----
  const damaged = voyageState({ voyageEpoch: 7 });
  damaged.currentRound = 3;
  damaged.fixedCost = Number.NaN;
  damaged.maintenancePenalty = -10;
  damaged.shipUpgradePenalty = 5;
  damaged.shipLevel = 7;
  damaged.shipUpgradeCost = [15, Number.NaN, 40];
  damaged.equippedModules = [overdrive, hauler];
  healLoadedVoyage(damaged, { legacyRenownLevel: null });
  check(
    damaged.maintenancePenalty === 10 &&
      damaged.shipUpgradePenalty === 15 &&
      damaged.shipUpgradeCost.length === SHIP_UPGRADE_LADDER.length &&
      damaged.shipUpgradeCost.every(
        (fee, i) => fee === SHIP_UPGRADE_LADDER[i],
      ) &&
      damaged.shipLevel === MAX_SHIP_LEVEL &&
      damaged.fixedCost === difficultyConfig(damaged.difficulty).maintenance,
    "a save the doors left disagreed with its own hull heals at the load to the bill the hull actually owes: the purse of a captain who bought a surcharge module that was never charged reads the surcharge back, the minus ten the old unwind wrote reads as nothing rather than as a negative fee, a fee that is not a number falls back to the canonical ladder, a level past the top clamps to the last rung of it, and the fixed cost falls back to the tier's own maintenance, so no door's arithmetic can reach a damaged save's purse again",
  );

  // ---- C. The hull and the whispers heal through their pools ----
  // The two collections whose heal was a bare coalesce: the hull's whole
  // card records, of which a pre card record save carries the old module
  // shape (no strings table at all), and the whisper board's entries, of
  // which a damaged blob can carry anything.
  const recut = voyageState({ voyageEpoch: 7 });
  (recut as unknown as { equippedModules: unknown[] }).equippedModules = [
    { id: "overdrive_engine", name: "Overdrive Engine", icon: "⚙️" },
    { id: "overdrive_engine" },
    { id: "module_that_never_shipped" },
    null,
  ];
  (recut as unknown as { revealedIntel: unknown[] }).revealedIntel = [
    { item: "Brocade", port: "Yun" },
    null,
    { item: "Brocade" },
    "a whisper with no shape",
  ];
  healLoadedVoyage(recut, { legacyRenownLevel: null });
  check(
    recut.equippedModules.length === 2 &&
      recut.equippedModules.every((mod) => mod === overdrive) &&
      recut.equippedModules[0]?.strings.en.name === "Overdrive Engine" &&
      recut.maintenancePenalty === 20 &&
      recut.revealedIntel.length === 1 &&
      recut.revealedIntel[0]?.port === "Yun",
    "the hull heals through the same pool every reader resolves a held card through: both copies of the old shape land as this build's own record, so the yard's cardText reads a strings table that exists and the two copies still count their surcharge twice, an id the pool cannot answer for and a null are dropped rather than drawn, and the whisper board keeps only entries carrying the item and port its readers index",
  );

  // ---- D. The pantry's reader asks for its own keys ----
  const lots = normalizeLarderLots(
    [
      { food: "toString", meals: 5, boughtRound: 1 },
      { food: "constructor", meals: 5, boughtRound: 1 },
      { food: "Grain", meals: 4, boughtRound: 1 },
    ],
    0,
  );
  check(
    lots.length === 1 && lots[0]?.food === "Grain" && lots[0]?.meals === 4,
    "the pantry's reader admits only the foods its own table holds: the in operator it used to ask with answered true for every member of Object.prototype, so a doctored lot of toString survived the heal and walked an undefined mealsPerSlot into NaN and out through the provisioning arithmetic into the captain's purse",
  );

  // ---- E. The purse's reader floors like its sibling ----
  const purse = voyageState({ voyageEpoch: 7 });
  (purse as unknown as { money: unknown }).money = null;
  check(
    Number.isFinite(getOwnedAmount(purse, "Gold")) &&
      getOwnedAmount(purse, "Gold") === 0,
    "an unreadable purse reads as empty rather than as NaN: the Gold branch was the one without the fallback its inventory sibling always had, so a save carrying a null purse made a trade settle its fee at zero while the seller was still credited the agreed price, and the difference was minted",
  );

  // ---- F. The meal line says what the floor does ----
  withEnv("NEXT_PUBLIC_SURVIVAL", "1", () => {
    const hungry = voyageState({ voyageEpoch: 7 });
    hungry.currentRound = 3;
    hungry.larderFedRound = 2;
    hungry.larder = 0;
    hungry.larderLots = [];
    hireWorker(hungry, "weaver", logs);
    const mealLogs: string[] = [];
    const fed = feedCrew(hungry, mealLogs);
    check(
      fed === true &&
        mealLogs.some((line) =>
          line.includes("every line still brings home at least one item"),
        ) &&
        !mealLogs.some((line) => line.includes("pace, and the fleet")),
      "the short rations line tells the captain what the engine actually does: the yield halves a line and lifts any line under one item back to one, so the sentence claims both halves of that rule rather than the constant alone, which promised a flat percentage the floor never fully took",
    );
  });

  // ---- G. The wear line names the unit the engine took ----
  withEnv("NEXT_PUBLIC_GARMENTS", "1", () => {
    const clothed = voyageState({ voyageEpoch: 7 });
    clothed.currentRound = 3;
    clothed.garmentsTickRound = 2;
    clothed.garments = [{ good: "Brocade", durability: 10 }];
    const wearLogs: string[] = [];
    tickGarments(clothed, wearLogs);
    check(
      wearLogs.some((line) => line.includes("point of wear to the sea")) &&
        !wearLogs.some((line) => line.includes("of their warmth")),
      "the wear line names the unit the engine took: durability points rather than warmth, which is the garment's rating scaled by the fraction of itself that is left, so the sentence and the numbers the wardrobe prints can be reconciled by the captain reading both",
    );
  });
}
