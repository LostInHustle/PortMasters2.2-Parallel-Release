// PortMasters 2.2 Parallel Release, smoke run: the module trade.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ModuleTradeBoard } from "@/types/realtime/boards";
import { db } from "@/lib/db";
import { cardById, cardName, cardsOfKind } from "@/lib/game/cards";
import { CONSENT_FEE_MAX, CONSENT_FEE_MIN } from "@/lib/game/constants/paths";
import {
  applyModuleTradeSide,
  canPayFee,
  canSellModule,
  expireConsent,
  isModuleId,
  moduleListedThisLeg,
  moduleSlotsOpen,
  normalizeModulesTraded,
  normalizeModuleTradeState,
  readModuleTraffic,
  shippedModuleTraffic,
  type ModuleTrade,
} from "@/lib/game/engine";
import { moduleTradesOn } from "@/lib/game/flags";
import { phaseFace } from "@/lib/game/phases";
import type { GameState, Phase } from "@/lib/game/types";
import type { VoyageLogEntry } from "@/lib/game/voyage-log";
import { voyageLogLine } from "@/lib/game/voyage-log";
import {
  CLASSIC,
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
  withoutComments,
} from "../harness";
import type { Captain, WireHistory } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function moduleTradesSuite(
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

  // ---- The market, on a captain's own machine ----
  //
  // The market's own switch is switched on for everything but the checks
  // that are about that switch. A run that left it at whatever the
  // environment happened to say would make the checks below pass for the
  // wrong reason.
  withEnv("NEXT_PUBLIC_MODULE_TRADES", "1", () => {
    check(
      [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
        withEnv(
          "NEXT_PUBLIC_MODULE_TRADES",
          value,
          switchFor(GAMBIT, moduleTradesOn),
        ),
      ) &&
        ["off", "0", "OFF", " off ", "Off"].every(
          (value) =>
            !withEnv(
              "NEXT_PUBLIC_MODULE_TRADES",
              value,
              switchFor(GAMBIT, moduleTradesOn),
            ),
        ),
      "the module market is on for every value of its own switch except the word off and the digit zero, which is the policy every switch in this tree is read through",
    );
    check(
      !withEnv(
        "NEXT_PUBLIC_MODULE_TRADES",
        "1",
        switchFor(CLASSIC, moduleTradesOn),
      ),
      "and the mode governs it directly rather than through a layer: a Classic table has no module market whatever the file says, which is the boundary every system this branch added is read behind",
    );

    // One hull, in whatever shape a check below needs it, and the three
    // modules the checks are about. The cards come out of the pool rather
    // than being typed as records here, so a module retuned tomorrow is
    // read by these checks as it is shipped.
    const hauler = cardById("bulk_hauler");
    const overdrive = cardById("overdrive_engine");
    const smuggler = cardById("smugglers_hold");
    if (!hauler || !overdrive || !smuggler) {
      throw new Error("The pool lost a module these checks are about.");
    }
    const hullState = (over: Partial<GameState> = {}): GameState => ({
      ...voyageState({ voyageEpoch: 7 }),
      money: 500,
      shipLevel: 3,
      ...over,
    });

    check(
      !canSellModule(hullState()) &&
        canSellModule(hullState({ equippedModules: [hauler] })) &&
        canSellModule(hullState({ path: null, equippedModules: [hauler] })) &&
        !withEnv("NEXT_PUBLIC_MODULE_TRADES", "off", () =>
          canSellModule(hullState({ equippedModules: [hauler] })),
        ),
      "any captain with a module bolted on may list it, whatever path they hold, and a captain with an empty hull has nothing to sell: a module is a thing rather than an ability, which is this kind's departure from the two markets before it",
    );

    check(
      cardsOfKind("module").every((card) => isModuleId(card.id)) &&
        cardsOfKind("boon").every((card) => !isModuleId(card.id)) &&
        cardsOfKind("charter").every((card) => !isModuleId(card.id)) &&
        !isModuleId("Sails") &&
        !isModuleId("") &&
        !isModuleId(null) &&
        !isModuleId(42) &&
        !isModuleId({ id: "bulk_hauler" }),
      "the pool's own reader answers a module id and nothing else: every shipped module passes, every boon and charter fails, and a good, an empty string, a number, a null and a lookalike object all fail, which is the one thing about a listing the server can check without reading anybody's save",
    );

    // One row, in whatever shape a check below needs it. The phase is the
    // one field no check here varies: every row this market holds was
    // posted at the Parley, which is where the board is drawn.
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

    check(
      moduleListedThisLeg([row()], "seller", "bulk_hauler", 3) &&
        moduleListedThisLeg(
          [
            row({
              status: "agreed",
              buyerUserId: "buyer",
              buyerName: "Smoke Buyer",
            }),
          ],
          "seller",
          "bulk_hauler",
          3,
        ) &&
        !moduleListedThisLeg([row()], "seller", "bulk_hauler", 4) &&
        !moduleListedThisLeg([row()], "seller", "smugglers_hold", 3) &&
        !moduleListedThisLeg([row()], "other", "bulk_hauler", 3),
      "one module is one listing a leg: a row takes the module out of the market whether it is still an offer or already an agreement, the next leg opens it again, and neither a different module nor a different seller is caught by it",
    );

    check(
      expireConsent([row()], { phase: "resolve", round: 3 }).length === 0 &&
        expireConsent([row()], { phase: "parley", round: 3 }).length === 1 &&
        expireConsent([row({ status: "agreed" })], {
          phase: "resolve",
          round: 3,
        }).length === 1 &&
        expireConsent([row({ status: "agreed" })], {
          phase: "parley",
          round: 4,
        }).length === 0,
      "an offer nobody took dies with the Parley it was posted in, while a trade the two captains agreed survives the rest of the leg and dies with it, which is the same expiry the two markets before it live under because it is the same primitive",
    );

    check(
      moduleSlotsOpen(hullState()) === 3 &&
        moduleSlotsOpen(hullState({ equippedModules: [hauler, overdrive] })) ===
          1 &&
        moduleSlotsOpen(
          hullState({ equippedModules: [hauler, overdrive, smuggler] }),
        ) === 0 &&
        moduleSlotsOpen(
          hullState({
            equippedModules: [hauler, overdrive, smuggler, hauler],
          }),
        ) === 0,
      "a hull's open slots are its level less what is bolted on, floored at nothing: a hull one module over its slots, which is the corner a purchase settles into when two machines cannot see each other's hulls, reads full rather than negative wherever a screen asks",
    );

    // What a trade does to two states, which is the whole of it.
    const agreed = row({
      id: "m2",
      status: "agreed",
      buyerUserId: "buyer",
      buyerName: "Smoke Buyer",
      fee: 40,
    });
    const sellerState = hullState({
      currentRound: 3,
      equippedModules: [hauler, overdrive],
      shipUpgradePenalty: 15,
      maintenancePenalty: 10,
    });
    const sellerLogs: string[] = [];
    check(
      applyModuleTradeSide(sellerState, agreed, "seller", sellerLogs) &&
        sellerState.equippedModules.length === 1 &&
        sellerState.equippedModules[0]?.id === "overdrive_engine" &&
        sellerState.shipUpgradePenalty === 0 &&
        sellerState.maintenancePenalty === 10 &&
        sellerState.money === 540 &&
        sellerState.modulesSold === 1 &&
        sellerState.moduleFeesEarned === 40 &&
        sellerState.modulesTraded.bulk_hauler === 1 &&
        sellerLogs.some((line) => line.includes("leaves your hull")),
      "the seller's side is the plan's automatic unequip: the module comes off the hull by itself, the accounting it carried is unwound with it, so the hauler's upgrade surcharge goes while the overdrive's own penalty stays, the agreed fee lands in the purse, and the ledger writes down that this module moved",
    );

    const ghosted = hullState({
      currentRound: 3,
      equippedModules: [overdrive],
    });
    const ghostLogs: string[] = [];
    check(
      applyModuleTradeSide(ghosted, agreed, "seller", ghostLogs) &&
        ghosted.equippedModules.length === 1 &&
        ghosted.money === 540 &&
        ghosted.modulesSold === 1 &&
        !ghostLogs.some((line) => line.includes("leaves your hull")),
      "and a seller whose hull no longer carries the module settles as an empty hand: the fee still moves because the agreement was made in the open, and no module is conjured off a hull that never had it",
    );

    const buyerState = hullState({
      currentRound: 3,
      equippedModules: [smuggler],
    });
    const buyerLogs: string[] = [];
    check(
      applyModuleTradeSide(buyerState, agreed, "buyer", buyerLogs) &&
        buyerState.equippedModules.length === 2 &&
        buyerState.equippedModules[1]?.id === "bulk_hauler" &&
        buyerState.money === 460 &&
        buyerState.modulesBought === 1 &&
        buyerState.moduleFeesPaid === 40 &&
        buyerLogs.some((line) => line.includes("paid 40 Gold")) &&
        buyerLogs.some((line) => line.includes("bolted to the hull")),
      "the buyer's side pays the price the two captains agreed and bolts the module onto the hull, and the only machine the module ever lands on is the buyer's own",
    );

    const fullHull = hullState({
      currentRound: 3,
      equippedModules: [hauler, overdrive, smuggler],
    });
    check(
      applyModuleTradeSide(
        fullHull,
        row({
          id: "m3",
          status: "agreed",
          buyerUserId: "buyer",
          buyerName: "Smoke Buyer",
          module: "artisans_workshop",
          fee: 12,
        }),
        "buyer",
        [],
      ) &&
        fullHull.equippedModules.length === 4 &&
        moduleSlotsOpen(fullHull) === 0 &&
        fullHull.money === 488,
      "a purchase settling onto a hull with every slot full bolts the module on anyway rather than losing it: the two machines cannot see each other's hulls, an agreed trade always completes, and every slot reader floors, so the overfilled hull reads full at the yard until its captain swaps",
    );

    const broke = hullState({ currentRound: 3, money: 5 });
    const brokeLogs: string[] = [];
    check(
      applyModuleTradeSide(broke, agreed, "buyer", brokeLogs) &&
        broke.money === 0 &&
        broke.moduleFeesPaid === 5 &&
        broke.equippedModules.some((card) => card.id === "bulk_hauler") &&
        brokeLogs.some((line) => line.includes("paid 5 Gold")),
      "a purse that moved between the accept and the settlement pays what it holds rather than a negative hold, and the module still lands, because the price was agreed in the open and the purse is the buyer's own business",
    );

    // The guard the desks ask before that click, and the minting it stands
    // in front of (G1). The settle above is deliberately asymmetric, the
    // boundary the escort's own settle shares and pins (suite 37), so this
    // pair reads the same agreed trade at two purses: one that covers the
    // fee, where the payment and the credit are one number, and one that
    // cannot, where the seller's machine credits the agreed price while the
    // buyer's wallet moves what it held. The second half is what a desk
    // without the guard let an honest buyer reach.
    const coveredPurse = hullState({ currentRound: 3, money: 100 });
    const coveredLogs: string[] = [];
    check(
      canPayFee(coveredPurse, agreed.fee) &&
        applyModuleTradeSide(coveredPurse, agreed, "buyer", coveredLogs) &&
        coveredPurse.moduleFeesPaid === agreed.fee &&
        coveredPurse.money === 100 - agreed.fee &&
        coveredLogs.some((line) => line.includes(`paid ${agreed.fee} Gold`)),
      "a buyer whose purse covers the fee pays it whole, so the payment the buyer's side moves and the price the seller's side credits are one number on both machines",
    );

    const shortPurse = hullState({ currentRound: 3, money: 5 });
    const shortPurseLogs: string[] = [];
    const shortBook = hullState({
      currentRound: 3,
      equippedModules: [hauler],
    });
    const shortBookLogs: string[] = [];
    check(
      !canPayFee(shortPurse, agreed.fee) &&
        applyModuleTradeSide(shortPurse, agreed, "buyer", shortPurseLogs) &&
        applyModuleTradeSide(shortBook, agreed, "seller", shortBookLogs) &&
        shortPurse.moduleFeesPaid === 5 &&
        shortPurse.money === 0 &&
        shortBook.moduleFeesEarned === agreed.fee &&
        shortBook.money === 500 + agreed.fee,
      "and a purse that cannot cover the fee is the hole the guard closes: the buyer pays the 5 Gold they hold while the seller's own machine credits the agreed price in full, which mints the difference, so the two desks read canPayFee before the click and an honest buyer never reaches the branch",
    );

    const unknown = hullState({ currentRound: 3 });
    const unknownLogs: string[] = [];
    check(
      applyModuleTradeSide(
        unknown,
        row({
          id: "m4",
          status: "agreed",
          buyerUserId: "buyer",
          buyerName: "Smoke Buyer",
          module: "ghost_module",
        }),
        "buyer",
        unknownLogs,
      ) &&
        unknown.equippedModules.length === 0 &&
        unknown.money === 470 &&
        unknownLogs.some((line) => line.includes("The yard has no")),
      "and a row naming a module this build's pool has never heard of costs the captain their fee and a sentence rather than a crash or a nameless card on the hull, which is the branch for a save that moved between two builds rather than for an ordinary leg",
    );

    const again = hullState({ currentRound: 3, equippedModules: [hauler] });
    const onceLogs: string[] = [];
    check(
      applyModuleTradeSide(again, agreed, "seller", onceLogs) &&
        !applyModuleTradeSide(again, agreed, "seller", onceLogs) &&
        again.money === 540 &&
        again.modulesSold === 1 &&
        again.settledMovements.includes("m2:fee"),
      "applying the same side twice moves nothing the second time, because the ledger is what keeps a reload between the agreement and the broadcast that carries it from paying the same fee twice",
    );

    const bystander = hullState({ currentRound: 3 });
    check(
      !applyModuleTradeSide(bystander, agreed, "other", []) &&
        bystander.money === 500 &&
        bystander.modulesBought === 0 &&
        bystander.equippedModules.length === 0,
      "and a captain who is neither side of the agreement is not moved by it, which is the whole of what the two names on the row are for",
    );

    const offered = hullState({ currentRound: 3, equippedModules: [hauler] });
    check(
      !applyModuleTradeSide(offered, row(), "seller", []) &&
        offered.money === 500 &&
        offered.equippedModules.length === 1,
      "and an offer settles nothing: only a row past the offer stage moves a purse or a hull, so a listing stays a listing until somebody takes it",
    );

    const secondBuy = hullState({ currentRound: 3 });
    check(
      applyModuleTradeSide(secondBuy, agreed, "buyer", []) &&
        applyModuleTradeSide(
          secondBuy,
          row({
            id: "m5",
            status: "agreed",
            buyerUserId: "buyer",
            buyerName: "Smoke Buyer",
            module: "smugglers_hold",
            fee: 10,
          }),
          "buyer",
          [],
        ) &&
        secondBuy.modulesBought === 2 &&
        secondBuy.equippedModules.length === 2 &&
        secondBuy.money === 450,
      "and a buyer may take as many as their hull holds: unlike the two markets before it, this kind bounds neither side, because a shelf takes what it holds and one purchase does not block the next",
    );

    // The load site, where every field this build added is healed.
    const ancient = voyageState();
    const stripped = ancient as unknown as Record<string, unknown>;
    for (const field of [
      "modulesSold",
      "modulesBought",
      "moduleFeesEarned",
      "moduleFeesPaid",
      "modulesTraded",
    ]) {
      stripped[field] = undefined;
    }
    normalizeModuleTradeState(ancient);
    check(
      ancient.modulesSold === 0 &&
        ancient.modulesBought === 0 &&
        ancient.moduleFeesEarned === 0 &&
        ancient.moduleFeesPaid === 0 &&
        Object.keys(ancient.modulesTraded).length === 0,
      "a save written before this feature reads as a captain who has never moved a module, count and ledger alike",
    );
    const wounded = voyageState();
    wounded.modulesSold = -3;
    wounded.moduleFeesEarned = Number.NaN;
    wounded.modulesBought = 2.7;
    wounded.moduleFeesPaid = Number.POSITIVE_INFINITY;
    wounded.modulesTraded = {
      bulk_hauler: 3.9,
      smugglers_hold: -1,
      ghost_module: Number.NaN,
      bogus: "2",
    } as unknown as GameState["modulesTraded"];
    normalizeModuleTradeState(wounded);
    const carried = JSON.parse(JSON.stringify(wounded)) as GameState;
    check(
      wounded.modulesSold === 0 &&
        wounded.moduleFeesEarned === 0 &&
        wounded.modulesBought === 2 &&
        wounded.moduleFeesPaid === 0 &&
        wounded.modulesTraded.bulk_hauler === 3 &&
        wounded.modulesTraded.smugglers_hold === undefined &&
        wounded.modulesTraded.ghost_module === undefined &&
        wounded.modulesTraded.bogus === undefined &&
        carried.modulesTraded.bulk_hauler === 3,
      "and a save carrying the fields in shapes the engine would not survive is healed to the same reading, counts floored and the ledger read entry by entry with anything that is not a countable number dropped rather than kept as a zero, and it round trips through a save with the same meaning on the far side",
    );
    check(
      Object.keys(normalizeModulesTraded(null)).length === 0 &&
        Object.keys(normalizeModulesTraded([1, 2])).length === 0 &&
        Object.keys(normalizeModulesTraded("bulk_hauler")).length === 0 &&
        normalizeModulesTraded({
          bulk_hauler: 2.9,
          smugglers_hold: 0,
          artisans_workshop: Number.NaN,
        }).bulk_hauler === 2 &&
        normalizeModulesTraded({ smugglers_hold: 0 }).smugglers_hold ===
          undefined &&
        normalizeModulesTraded({ artisans_workshop: Number.NaN })
          .artisans_workshop === undefined,
      "the ledger's own reader answers an empty ledger for every shape that is not a record, floors what it can count and drops what it cannot, so the report and the save heal through one reader rather than two that could disagree",
    );

    // The plan's second reading, over saves built by hand.
    const traffic = readModuleTraffic({
      modules: [
        { id: "bulk_hauler", name: "Bulk Hauler Rigging" },
        { id: "smugglers_hold", name: "Smuggler's Hold" },
      ],
      saves: [
        {
          equipped: ["bulk_hauler", "smugglers_hold"],
          traded: { smugglers_hold: 2 },
        },
        {
          equipped: ["bulk_hauler"],
          traded: { bulk_hauler: 1, smugglers_hold: 1 },
        },
      ],
    });
    check(
      traffic[0]?.equipped === 2 &&
        traffic[0]?.traded === 1 &&
        traffic[1]?.equipped === 1 &&
        traffic[1]?.traded === 3,
      "the plan's second reading pairs the two columns off the saves themselves: what is equipped is the hull each save carries and what was traded away is its ledger, summed across the voyages the report was pointed at",
    );
    const shippedRows = shippedModuleTraffic([
      { equipped: ["bulk_hauler"], traded: { bulk_hauler: 2 } },
    ]);
    const haulerRow = shippedRows.find((r) => r.id === "bulk_hauler");
    check(
      shippedRows.length === cardsOfKind("module").length &&
        haulerRow?.name === cardName("bulk_hauler") &&
        haulerRow?.equipped === 1 &&
        haulerRow?.traded === 2 &&
        shippedRows
          .filter((r) => r.id !== "bulk_hauler")
          .every((r) => r.equipped === 0 && r.traded === 0),
      "the report reads the pool this build shipped rather than a list typed beside it, so a module added tomorrow appears in the table the moment it exists, and a module nobody equipped and nobody traded keeps a row of two zeroes rather than dropping out of the reading",
    );

    const offHull = hullState({ equippedModules: [hauler] });
    check(
      !withEnv("NEXT_PUBLIC_MODULE_TRADES", "off", () =>
        canSellModule(offHull),
      ) &&
        !withEnv("NEXT_PUBLIC_MODULE_TRADES", "off", () =>
          applyModuleTradeSide(offHull, agreed, "seller", []),
        ) &&
        offHull.money === 500 &&
        offHull.equippedModules.length === 1,
      "with the market switched off the two readers that ask the switch answer nothing at all, so the rollback is a market that is gone rather than one that is half running; the heal and the report readers are deliberately not among them, because the fields every save now carries exist whether or not a rule reads them",
    );
  });

  // ---- The market, in a real harbor ----
  //
  // Three captains at a table of their own, for the reason the two markets
  // above gave: the harbor this run shares is still standing at the end of
  // this section, and the checks after it read that one.
  const modSeller = await signUp("mod_s");
  const modBuyer = await signUp("mod_b");
  const modForeigner = await signUp("mod_f");
  run.extraAccounts.push(modSeller, modBuyer, modForeigner);

  const modRoom = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: modSeller.cookie,
      body: JSON.stringify({
        name: `Smoke modules ${suffix}`,
        isPublic: false,
        mode: "ocean_gambit",
        unlock: LEDGER_PHRASE,
      }),
    },
  );
  if (modRoom.status !== 200) {
    throw new Error("No harbor to trade a module in.");
  }
  const modRoomId = modRoom.body.room.id;
  const modCrew = [modSeller, modBuyer, modForeigner];
  const modJoins = await Promise.all(
    modCrew.slice(1).map((captain) =>
      call<{ room: { id: string } }>("/api/rooms/join", {
        method: "POST",
        cookie: captain.cookie,
        body: JSON.stringify({ code: modRoom.body.room.code }),
      }),
    ),
  );
  check(
    modJoins.every((join) => join.status === 200),
    "three captains can sit at a table where modules change hands",
  );

  // Each socket's newest board, and every row that board has ever carried.
  // The second is what makes the privacy check below a claim about what a
  // captain was told rather than about what they happened to read last.
  const modBoards = new Map<string, ModuleTrade[]>();
  const modSeen = new Map<string, Set<string>>();
  const modSockets = new Map<string, Socket>();
  for (const captain of modCrew) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const seatedHere = waitForEvent<WireHistory>(
      socket,
      "chat:history",
      (payload) => payload?.roomId === modRoomId,
    );
    socket.emit("room:join", { roomId: modRoomId });
    await seatedHere;
    socket.on("module:update", (payload: ModuleTradeBoard) => {
      if (payload?.roomId !== modRoomId) return;
      modBoards.set(captain.id, payload.moduleTrades);
      const seen = modSeen.get(captain.id) ?? new Set<string>();
      for (const trade of payload.moduleTrades) seen.add(trade.id);
      modSeen.set(captain.id, seen);
    });
    modSockets.set(captain.id, socket);
  }
  const modSocketOf = (captain: Captain): Socket => {
    const found = modSockets.get(captain.id);
    if (!found) throw new Error(`No socket for ${captain.username}.`);
    return found;
  };
  const modBoardOf = (captain: Captain): ModuleTrade[] =>
    modBoards.get(captain.id) ?? [];
  const modSettle = () => new Promise((resolve) => setTimeout(resolve, 500));
  // The emit and the wait are one call, for the reason the two markets
  // above give: a refusal waited for after the fact is a refusal this run
  // might already have missed.
  const modRefused = async (
    captain: Captain,
    event: string,
    frame: Record<string, unknown>,
  ): Promise<string | null> => {
    const refused = waitForEvent<{ roomId: string; error: string }>(
      modSocketOf(captain),
      "module:error",
      (payload) => payload?.roomId === modRoomId && Boolean(payload.error),
    );
    modSocketOf(captain).emit(event, { roomId: modRoomId, ...frame });
    return (await refused)?.error ?? null;
  };
  const modSettles = (
    captain: Captain,
    match: (board: ModuleTrade[]) => boolean,
  ) =>
    waitForEvent<ModuleTradeBoard>(
      modSocketOf(captain),
      "module:update",
      (payload) =>
        payload?.roomId === modRoomId && match(payload?.moduleTrades ?? []),
    );

  modSocketOf(modSeller).emit("room:start", { roomId: modRoomId });
  await modSettle();

  // The market belongs to the Parley, and the departure puts the room at
  // its opening seat rather than at one, so this is posted out of season by
  // construction rather than by a clock the run has to wait on.
  const modOffSeason = await modRefused(modSeller, "module:post", {
    fee: 20,
    module: "bulk_hauler",
  });
  check(
    modOffSeason !== null && modOffSeason.includes(phaseFace("parley").label),
    "a module cannot be listed outside the Parley, and the refusal names the phase that opens the market, because a module changes hands at the table rather than mid leg",
  );

  // The room's seat, moved the way this suite moves any room's seat.
  const modSeat = (captain: Captain, round: number, phase: Phase) =>
    modSocketOf(captain).emit("game:status", {
      roomId: modRoomId,
      round,
      phase,
      phaseLabel: phaseFace(phase).label,
      gold: 0,
      reputation: 0,
      shipLevel: 0,
      gameOver: false,
    });
  modSeat(modSeller, 1, "parley");
  await modSettle();

  const modBadFee = await modRefused(modSeller, "module:post", {
    fee: CONSENT_FEE_MAX + 1,
    module: "bulk_hauler",
  });
  check(
    modBadFee !== null &&
      modBadFee.includes(String(CONSENT_FEE_MIN)) &&
      modBadFee.includes(String(CONSENT_FEE_MAX)),
    "a fee outside the bounds is refused by the server rather than clamped, and the refusal states both ends of the range it will take, because the form and the socket go through one reader",
  );

  const boonId = cardsOfKind("boon")[0]?.id ?? "boon";
  const modNotAModule = await modRefused(modSeller, "module:post", {
    fee: 20,
    module: boonId,
  });
  check(
    modNotAModule !== null &&
      modNotAModule.includes("module the yard can bolt on"),
    "and a listing naming a card nobody can bolt on is refused at the door, because a row no buyer could take would sit on the board for a whole leg",
  );

  const modSelfSell = await modRefused(modSeller, "module:post", {
    fee: 20,
    module: "bulk_hauler",
    targetUserId: modSeller.id,
  });
  check(
    modSelfSell !== null,
    "and a captain cannot sell a module to themselves",
  );

  // A real account standing somewhere else. The membership check is per
  // harbor, which is the only thing that makes aiming an offer at a captain
  // a check at all.
  if (!host) {
    throw new Error("No captain in another harbor to aim an offer at.");
  }
  const modStrangerTarget = await modRefused(modSeller, "module:post", {
    fee: 20,
    module: "bulk_hauler",
    targetUserId: host.id,
  });
  check(
    modStrangerTarget !== null,
    "and an offer cannot be addressed at a captain who is not in this harbor, whoever they are in another one",
  );

  const modOpenPosted = modSettles(modForeigner, (board) =>
    board.some(
      (t) => t.sellerUserId === modSeller.id && t.status === "offered",
    ),
  );
  modSocketOf(modSeller).emit("module:post", {
    roomId: modRoomId,
    fee: 21.7,
    module: "bulk_hauler",
  });
  const modOpenRow = ((await modOpenPosted)?.moduleTrades ?? []).find(
    (t) => t.sellerUserId === modSeller.id && t.status === "offered",
  );
  check(
    modOpenRow !== undefined &&
      modOpenRow.fee === 21 &&
      modOpenRow.module === "bulk_hauler" &&
      modOpenRow.buyerUserId === null &&
      modOpenRow.phase === "parley" &&
      modOpenRow.round === 1,
    "an open listing lands on the whole table's board at the fee the form meant, floored to whole Gold, naming the module, addressed to nobody and stamped with the leg and the phase it was posted in",
  );
  check(
    modOpenRow !== undefined && modBoardOf(modForeigner).length === 1,
    "and it is the only row the third captain is handed, because a listing to the room is the one every captain may take",
  );

  const modRelisted = await modRefused(modSeller, "module:post", {
    fee: 25,
    module: "bulk_hauler",
  });
  check(
    modRelisted !== null && modRelisted.includes("already listed that module"),
    "the same module cannot be listed twice in one leg, whatever price the second row names, because one module is one thing and a second row could not be honoured",
  );

  const modDoubleOpen = await modRefused(modSeller, "module:post", {
    fee: 25,
    module: "smugglers_hold",
  });
  check(
    modDoubleOpen !== null &&
      modDoubleOpen.includes("already have an offer standing"),
    "and a second open offer from the same seller is refused by the primitive's own bound, which is the rule that keeps one client from papering the board",
  );

  const modDirectPosted = modSettles(modBuyer, (board) =>
    board.some((t) => t.buyerUserId === modBuyer.id && t.status === "offered"),
  );
  modSocketOf(modSeller).emit("module:post", {
    roomId: modRoomId,
    fee: 30,
    module: "smugglers_hold",
    targetUserId: modBuyer.id,
  });
  const modDirectRow = ((await modDirectPosted)?.moduleTrades ?? []).find(
    (t) => t.buyerUserId === modBuyer.id && t.status === "offered",
  );
  check(
    modDirectRow !== undefined && modDirectRow.fee === 30,
    "a direct offer lands for the captain it names, at the price that was asked",
  );
  await modSettle();
  check(
    modDirectRow !== undefined &&
      modSeen.get(modBuyer.id)?.has(modDirectRow.id) === true &&
      modSeen.get(modForeigner.id)?.has(modDirectRow.id) === false,
    "and no board the third captain was ever handed carried it, which is the privacy a targeted trade is worth",
  );

  // Asked at a quiet moment, so the next board this captain is handed is
  // the answer to the question rather than a broadcast that overtook it.
  const modAskedForBoard = waitForEvent<ModuleTradeBoard>(
    modSocketOf(modForeigner),
    "module:update",
    (payload) => payload?.roomId === modRoomId,
  );
  modSocketOf(modForeigner).emit("module:state:request", {
    roomId: modRoomId,
  });
  const modAnsweredBoard = (await modAskedForBoard)?.moduleTrades ?? [];
  check(
    modOpenRow !== undefined &&
      modAnsweredBoard.length === 1 &&
      modAnsweredBoard[0]?.id === modOpenRow.id,
    "a captain who asks for the board is handed the same board the room broadcast, personalised by the same rules, so the row addressed to somebody else is absent from the answer as well",
  );

  const modTakenByThird = await modRefused(modForeigner, "module:accept", {
    tradeId: modDirectRow?.id ?? "",
  });
  check(
    modTakenByThird !== null &&
      modTakenByThird.includes("addressed to another"),
    "an offer addressed to one captain cannot be taken by another, even though the board never showed it to them",
  );
  const modSoldBySeller = await modRefused(modSeller, "module:accept", {
    tradeId: modOpenRow?.id ?? "",
  });
  check(
    modSoldBySeller !== null && modSoldBySeller.includes("the one selling"),
    "and the captain selling the module is not the captain who takes it",
  );

  const modAgreedBoard = modSettles(modSeller, (board) =>
    board.some((t) => t.id === modDirectRow?.id && t.status === "agreed"),
  );
  modSocketOf(modBuyer).emit("module:accept", {
    roomId: modRoomId,
    tradeId: modDirectRow?.id ?? "",
  });
  const modAgreedRow = ((await modAgreedBoard)?.moduleTrades ?? []).find(
    (t) => t.id === modDirectRow?.id,
  );
  // The name the row wears is the one the account is registered under, read
  // from the row the server itself read it from rather than typed here, so
  // the check cannot pass on a name this file made up.
  const modAccount = await db.user.findUnique({
    where: { id: modBuyer.id },
    select: { displayName: true },
  });
  check(
    modAgreedRow?.status === "agreed" &&
      modAgreedRow.buyerUserId === modBuyer.id &&
      modAgreedRow.buyerName === modAccount?.displayName,
    "a captain takes a listing by taking the offer, and the row that was an ask is now an agreement with their own name written on it",
  );

  const modWithdrawRefused = await modRefused(modSeller, "module:cancel", {
    tradeId: modDirectRow?.id ?? "",
  });
  check(
    modWithdrawRefused !== null &&
      modWithdrawRefused.includes("can't be withdrawn"),
    "an agreement the two captains made cannot be withdrawn by the seller, and the refusal says so rather than dropping the press",
  );

  const modCancelledBoard = modSettles(modForeigner, (board) =>
    board.every((t) => t.id !== modOpenRow?.id),
  );
  modSocketOf(modSeller).emit("module:cancel", {
    roomId: modRoomId,
    tradeId: modOpenRow?.id ?? "",
  });
  check(
    (await modCancelledBoard) !== null,
    "while an offer nobody has taken is the seller's own to take back",
  );

  const modGoneAccept = await modRefused(modForeigner, "module:accept", {
    tradeId: modOpenRow?.id ?? "",
  });
  check(
    modGoneAccept !== null && modGoneAccept.includes("already gone"),
    "and an offer that is off the board cannot be taken from a stale screen, which the server answers with the sentence rather than with a resurrection",
  );

  // The field report's own case, on the row shape it met: a listing posted
  // to the whole table, taken by a captain the table offered it to. The
  // third module this captain has not listed this leg, so the kind's own
  // bound is what says the row below is a fresh listing rather than a
  // second one.
  const modOpenTakePosted = modSettles(modBuyer, (board) =>
    board.some(
      (t) =>
        t.sellerUserId === modSeller.id &&
        t.module === "overdrive_engine" &&
        t.status === "offered",
    ),
  );
  modSocketOf(modSeller).emit("module:post", {
    roomId: modRoomId,
    fee: 33,
    module: "overdrive_engine",
  });
  const modOpenTakeRow = ((await modOpenTakePosted)?.moduleTrades ?? []).find(
    (t) => t.sellerUserId === modSeller.id && t.module === "overdrive_engine",
  );
  check(
    modOpenTakeRow?.status === "offered" &&
      modOpenTakeRow.buyerUserId === null &&
      modOpenTakeRow.round === 1,
    "a listing posted to the whole table is a fresh row on it, addressed to nobody, after the first open row was withdrawn",
  );
  const modOpenTaken = modSettles(modSeller, (board) =>
    board.some((t) => t.id === modOpenTakeRow?.id && t.status === "agreed"),
  );
  modSocketOf(modForeigner).emit("module:accept", {
    roomId: modRoomId,
    tradeId: modOpenTakeRow?.id ?? "",
  });
  const modOpenTakenRow = ((await modOpenTaken)?.moduleTrades ?? []).find(
    (t) => t.id === modOpenTakeRow?.id,
  );
  check(
    modOpenTakenRow?.status === "agreed" &&
      modOpenTakenRow.buyerUserId === modForeigner.id,
    "and any captain the table offered it to can take it: the open row settles with the taker's own id written on it, which is the press the field report could not find",
  );

  // The duplicate press, which is the other half of a single settlement:
  // the row is already agreed, so the second accept is refused by the
  // same guard a cancelled row meets, and the agreement on the board is
  // the one the first press made rather than a second one over it.
  const modOpenSecondPress = await modRefused(modForeigner, "module:accept", {
    tradeId: modOpenTakeRow?.id ?? "",
  });
  check(
    modOpenSecondPress !== null &&
      modOpenSecondPress.includes("already gone") &&
      modBoardOf(modSeller).filter(
        (t) => t.id === modOpenTakeRow?.id && t.status === "agreed",
      ).length === 1,
    "and a second press of the same Take settles nothing: the server refuses it with the sentence it refuses every gone row with, and the board still carries one agreement rather than a second over the first",
  );

  // A captain who is not the seller of a row has no button for it, and the
  // silence is the answer rather than an error: reading a row that is
  // somebody else's is not a mistake anybody has made.
  const modSilentForeign = waitForEvent<{ roomId: string; error: string }>(
    modSocketOf(modForeigner),
    "module:error",
    (payload) => Boolean(payload?.error),
    900,
  );
  modSocketOf(modForeigner).emit("module:cancel", {
    roomId: modRoomId,
    tradeId: modDirectRow?.id ?? "",
  });
  check(
    (await modSilentForeign) === null,
    "and a captain who is not the seller of a row cannot take it back, which the server answers with silence rather than with an error",
  );

  // The room's log, which is the other place the trade is written down.
  const modLog = waitForEvent<{
    roomId: string;
    entries: VoyageLogEntry[];
  }>(
    modSocketOf(modForeigner),
    "voyage:log:history",
    (payload) => payload?.roomId === modRoomId,
  );
  modSocketOf(modForeigner).emit("voyage:log:request", {
    roomId: modRoomId,
  });
  const modLines = ((await modLog)?.entries ?? []).map((entry) => entry.text);
  // The two lines are built from the rows the server itself broadcast, so
  // the check is a claim about the board and the log agreeing rather than
  // about this file's copy of a sentence.
  const modPostedLine = voyageLogLine({
    kind: "module_posted",
    captain: modOpenRow?.sellerName ?? "",
    module: modOpenRow?.module ?? "",
    fee: modOpenRow?.fee ?? 0,
  });
  const modSoldLine = voyageLogLine({
    kind: "module_sold",
    captain: modAgreedRow?.sellerName ?? "",
    taker: modAgreedRow?.buyerName ?? "",
    module: modAgreedRow?.module ?? "",
    fee: modAgreedRow?.fee ?? 0,
  });
  // The open row's own sale, which is the line the duplicate press above
  // would have doubled if the second accept had settled anything: one
  // line for one agreement is what a single settlement looks like on the
  // surface the whole room reads.
  const modSoldOpenLine = voyageLogLine({
    kind: "module_sold",
    captain: modOpenTakenRow?.sellerName ?? "",
    taker: modOpenTakenRow?.buyerName ?? "",
    module: modOpenTakenRow?.module ?? "",
    fee: modOpenTakenRow?.fee ?? 0,
  });
  check(
    modOpenRow !== undefined &&
      modAgreedRow !== undefined &&
      modLines.includes(modPostedLine) &&
      modLines.includes(modSoldLine) &&
      modLines.filter((line) => line === modSoldOpenLine).length === 1,
    "the room's log carries the trade as the board wrote it, the listing and the sale, with the price and the module on both lines and the taker named on the second, and the sale the third captain took stands on exactly one line rather than two",
  );

  // The leg moves on. Everything on the board was sold for the leg that
  // just ended, so the sweep is what takes the whole of it away.
  modSeat(modSeller, 2, "parley");
  await modSettle();
  check(
    modBoardOf(modSeller).length === 0 &&
      modBoardOf(modBuyer).length === 0 &&
      modBoardOf(modForeigner).length === 0,
    "the leg a trade was made for is the leg it lives, and the move to the next one takes the whole board off every captain's screen",
  );

  const modReopened = modSettles(modForeigner, (board) =>
    board.some(
      (t) => t.sellerUserId === modSeller.id && t.status === "offered",
    ),
  );
  modSocketOf(modSeller).emit("module:post", {
    roomId: modRoomId,
    fee: 12,
    module: "bulk_hauler",
  });
  const modReopenedRow = ((await modReopened)?.moduleTrades ?? []).find(
    (t) => t.sellerUserId === modSeller.id,
  );
  check(
    modReopenedRow?.round === 2 && modReopenedRow?.fee === 12,
    "and the same module can be listed again on the new leg, which is what makes the one listing a leg a bound the voyage reads a leg at a time rather than a ceiling on the trade",
  );

  // The listing that was still standing when its leg moved, which is the
  // expiry the reporter's recipient meets with a screen they left open:
  // the sweep took the row off every board, and the accept is refused
  // rather than resurrecting an offer the voyage has already left behind.
  modSeat(modSeller, 3, "parley");
  await modSettle();
  const modExpiredRefused = await modRefused(modForeigner, "module:accept", {
    tradeId: modReopenedRow?.id ?? "",
  });
  check(
    modReopenedRow?.status === "offered" &&
      modExpiredRefused !== null &&
      modExpiredRefused.includes("already gone") &&
      modBoardOf(modForeigner).length === 0 &&
      modBoardOf(modSeller).length === 0,
    "an offer that expires with the leg it was posted for cannot be taken afterwards: the row that was still a live listing when the seat moved is off every board, and the accept from a stale screen is answered with the sentence rather than with a settlement",
  );

  // The named offer's own bound, read in a live harbor rather than on a
  // row this file built: the primitive keeps one open offer per seller per
  // buyer, so a second listing aimed at the same captain meets the sentence
  // that names them. The modules are two this seller has not listed this
  // leg, so the kind's own lock is not what the second post meets.
  const modNamedPosted = modSettles(modBuyer, (board) =>
    board.some(
      (t) => t.sellerUserId === modSeller.id && t.status === "offered",
    ),
  );
  modSocketOf(modSeller).emit("module:post", {
    roomId: modRoomId,
    fee: 18,
    module: "bulk_hauler",
    targetUserId: modBuyer.id,
  });
  const modNamedRow = ((await modNamedPosted)?.moduleTrades ?? []).find(
    (t) => t.sellerUserId === modSeller.id && t.status === "offered",
  );
  const modNamedAccount = await db.user.findUnique({
    where: { id: modBuyer.id },
    select: { displayName: true },
  });
  const modNamedSecond = await modRefused(modSeller, "module:post", {
    fee: 19,
    module: "smugglers_hold",
    targetUserId: modBuyer.id,
  });
  check(
    modNamedRow?.buyerUserId === modBuyer.id &&
      modNamedRow?.buyerName === modNamedAccount?.displayName &&
      modNamedSecond !== null &&
      modNamedSecond.includes("already have an offer standing") &&
      modNamedSecond.includes(modNamedAccount?.displayName ?? "no captain"),
    "a listing aimed at a named captain is the only open offer that seller may have standing with them: a second listing addressed to the same captain is refused with the sentence that names them, which is the primitive's own bound met in the harbor rather than on a row built by hand",
  );

  // The third transition the room's own expiry reads: the close of the
  // phase a listing was posted in. The sweep runs on the seat move, so a
  // listing still standing when the Parley ends is off every board at
  // Resolve, and the accept a captain left open is answered rather than
  // settled. The refusal is the gone sentence rather than the phase one,
  // and that is the order the handler asks its guards in: the sweep runs
  // ahead of the phase check, so a row the closing phase took no longer
  // exists to be refused for its phase.
  modSeat(modSeller, 3, "resolve");
  await modSettle();
  const modPhaseRefused = await modRefused(modBuyer, "module:accept", {
    tradeId: modNamedRow?.id ?? "",
  });
  check(
    modNamedRow?.status === "offered" &&
      modPhaseRefused !== null &&
      modPhaseRefused.includes("already gone") &&
      modBoardOf(modSeller).length === 0 &&
      modBoardOf(modBuyer).length === 0 &&
      modBoardOf(modForeigner).length === 0,
    "an offer dies with the phase it was posted in as well as with the leg: the seat moving to Resolve takes the standing listing off every board, and the accept from a screen that was left open is answered with the sentence rather than with a settlement",
  );

  // The row shape itself, with its comments taken out, because these two
  // checks are about what a captain can press rather than about what the
  // files say. The field report's first half was a board that drew no
  // buttons at all, and the shape of that defect is written down here so
  // a later pass cannot put it back: the controls hang on whether the row
  // is still an offer, and the chip hangs on whether it was aimed.
  const deskSource = (relative: string) =>
    withoutComments(
      readFileSync(
        join(import.meta.dirname, "..", "..", "..", relative),
        "utf8",
      ),
    );
  const rowSource = deskSource(
    "src/components/portmasters/game/OfferBoard.tsx",
  );
  // The desks are read with their whitespace flattened, so the check is
  // about the reading a desk hands the row rather than about where a
  // formatter broke the line, and the escort's own reading is a named
  // local rather than an inline expression for its own reasons.
  const flatDesk = (relative: string) =>
    deskSource(relative).replace(/\s+/g, " ");
  const desks = [
    flatDesk("src/components/portmasters/game/ModuleMarket.tsx"),
    flatDesk("src/components/portmasters/game/EscortContracts.tsx"),
    flatDesk("src/components/portmasters/game/RefitBench.tsx"),
  ];
  check(
    rowSource.includes("standing &&") &&
      rowSource.includes("chip &&") &&
      desks.every(
        (text) =>
          text.includes("standing={") && text.includes('status === "offered"'),
      ),
    "the offer row draws its buttons from whether the row is still an offer rather than from whether it was aimed at one captain, and the three desks that sell between captains hand it that reading off the row's own status: the aim draws the chip and the standing draws the press, which is the distinction the field report met as an open listing with no Take for the table and no Cancel for the seller",
  );

  // The buyer's purse, which is the one condition the settle deliberately
  // does not ask and the desks therefore have to (G1). The rule is stated
  // once, in the engine's core beside the purse reader it folds, and each
  // desk's blocked chain reads it rather than writing the comparison a
  // second time on the screen, so the three desks that price their own
  // deal cannot drift apart from each other or from the two numbers the
  // check above the live block holds.
  const engineSource = flatDesk("src/lib/game/engine/core.ts");
  check(
    desks[0].includes("canPayFee(game, trade.fee)") &&
      desks[2].includes("canPayFee(game, row.fee)") &&
      desks[1].includes("canPayFee(game, contract.fee)") &&
      engineSource.includes('return getOwnedAmount(state, "Gold") >= fee;'),
    "the desks that price their own deal read the buyer's purse before the click, through one engine predicate rather than a comparison written on each screen, which is the guard that keeps an honest buyer out of a settle whose seller is credited the agreed price",
  );

  // The house rule, over the copy this feature added: the sentences a
  // captain reads at the market are the market's own, and the files that
  // carry them are held whole, comments included.
  check(
    !carriesADash("src/lib/game/engine/modules.ts") &&
      !carriesADash("src/lib/game/engine/consent.ts") &&
      !carriesADash("src/lib/use-module-trades.ts") &&
      !carriesADash("src/lib/use-consent-board.ts") &&
      !carriesADash("src/components/portmasters/game/ModuleMarket.tsx") &&
      !carriesADash("src/server/realtime/module-trades.ts") &&
      !carriesADash("src/server/realtime/wiring/module-trades.ts"),
    "every file the module market's copy lives in reads free of en dashes, em dashes and doubled hyphens, which is the house rule for every string a captain reads",
  );

  // =====================================================================
}
