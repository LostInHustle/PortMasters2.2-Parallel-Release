// PortMasters 2.2 Parallel Release, smoke run: The pathbound order board.

import { ITEMS, PRODUCT_PRICES, RESOURCES } from "@/lib/game/constants/goods";
import { PATH_ORDER_SLOTS } from "@/lib/game/constants/paths";
import { marketCountsFor } from "@/lib/game/difficulty";
import {
  canFillOrder,
  completeOrder,
  lockedBehind,
  openOrderCount,
  pathOrderOf,
  snapToCheckpoint,
} from "@/lib/game/engine";
import { pathOrdersOn } from "@/lib/game/flags";
import type { PathId } from "@/lib/game/paths";
import {
  PATHS,
  PATH_IDS,
  lockingPathFor,
  pathConfig,
  pathLockLine,
} from "@/lib/game/paths";
import type { GameState, OrderCard } from "@/lib/game/types";
import {
  CARRIES_A_DASH,
  GAMBIT,
  check,
  switchFor,
  voyageState,
  walkSrc,
  withEnv,
} from "../harness";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function pathboundOrderBoardSuite(): Promise<void> {
  const dealOrders = (suffix: string) => {
    const state = voyageState();
    snapToCheckpoint(
      state,
      { seedBase: `smoke:path-orders:${suffix}`, harborId: "harbor-a" },
      1,
      "orders",
      [],
    );
    return state;
  };

  // The switch's own policy, read through the function every other switch
  // in this tree is read through, so one typo cannot leave the board half
  // switched.
  check(
    [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
      withEnv(
        "NEXT_PUBLIC_PATH_ORDERS",
        value,
        switchFor(GAMBIT, pathOrdersOn),
      ),
    ) &&
      ["off", "0", "OFF", " off ", "Off"].every(
        (value) =>
          !withEnv(
            "NEXT_PUBLIC_PATH_ORDERS",
            value,
            switchFor(GAMBIT, pathOrdersOn),
          ),
      ),
    "the pathbound board is on for every value except the word off and the digit zero, which is the policy every switch in this tree is read through",
  );

  withEnv("NEXT_PUBLIC_PATH_ORDERS", "1", () => {
    const board = dealOrders("a");
    const pathCards = board.customerCards.filter((o) => o.isPathOrder);
    const plainCards = board.customerCards.filter((o) => !o.isPathOrder);
    // The tier's own draw, read off the charter's schedule rather than off
    // a number typed here, so a tier that widens its board moves this check
    // with it.
    const scheduled = marketCountsFor(
      board.difficulty,
      board.currentRound,
    ).order;
    check(
      plainCards.length === scheduled &&
        pathCards.length === PATH_ORDER_SLOTS &&
        board.customerCards.length === scheduled + PATH_ORDER_SLOTS,
      `a fair winds board is the tier's own draw plus the paths' three, which is the plan's nine slot board (${plainCards.length} open, ${pathCards.length} pathbound)`,
    );

    // Every pathbound card is a one good errand whose good belongs to a
    // path and to the manifest both. The second half of that is the
    // property that keeps the Quartermaster's provisions off this board: a
    // food is pantry goods bought at RATION_PRICE a meal and never sold, so
    // a card demanding one would be a Gold press rather than a trade (see
    // the orderPool note in ./paths).
    check(
      pathCards.every(
        (o) =>
          o.resources.length === 1 &&
          lockingPathFor(o.resources[0].type) !== null &&
          (ITEMS as readonly string[]).includes(o.resources[0].type) &&
          pathOrderOf(o, GAMBIT) === lockingPathFor(o.resources[0].type),
      ),
      "each of the three demands exactly one good, a good some path's pool claims and a good the hold itself trades, so a pathbound card is an errand the manifest could really post and a captain could really fill once they hold the path",
    );
    // Which path a card waits on is computed from the good every time,
    // which is what makes the good the whole of the label.
    check(
      pathCards.every((o) => {
        const config = pathConfig(pathOrderOf(o, GAMBIT));
        return (
          config !== null &&
          config.crest.length > 0 &&
          config.name.length > 0 &&
          config.orderPool.includes(o.resources[0].type)
        );
      }),
      "and each is stamped with the crest and the name of the path whose pool owns its good, read off the record rather than written onto the card, which is the plan's own instruction for the lock reason",
    );
    // The good's kind is the card's kind, which is the claim that a
    // pathbound errand is priced by the generator every other card of that
    // good is priced by rather than at a rate of its own.
    check(
      pathCards.every((o) =>
        (RESOURCES as readonly string[]).includes(o.resources[0].type)
          ? !o.isProductOrder
          : o.isProductOrder &&
            PRODUCT_PRICES[o.resources[0].type] !== undefined,
      ),
      "and each is priced by the generator its own kind of good is priced by, raw as raw and finished as finished, so a pathbound card asks what the manifest pays for that good and never at a discount",
    );

    // The lock itself. A captain with no path is locked out of every
    // pathbound card, and every captain is pathless until D7's draft deals
    // one, so this is the state of the table this build ships: the rule
    // teaches by being true rather than by being staged.
    const marked = pathCards[0];
    const owner = marked ? pathOrderOf(marked, GAMBIT) : null;
    check(
      marked !== undefined &&
        pathCards.every(
          (o) => lockedBehind(board, o) === pathOrderOf(o, GAMBIT),
        ) &&
        lockedBehind(board, marked) !== null,
      "a captain who holds no path is locked out of all three, which is the ordinary table until the draft that deals a path lands",
    );
    check(
      owner !== null &&
        pathCards.every((o) =>
          pathOrderOf(o, GAMBIT) === owner
            ? lockedBehind({ ...board, path: owner }, o) === null
            : lockedBehind({ ...board, path: owner }, o) ===
              pathOrderOf(o, GAMBIT),
        ),
      "and holding one path opens the cards it posted while leaving the other path's cards locked, which is what makes the board a set of doors rather than one door",
    );

    // The guard, on one card and one hold: stocked for the locked card and
    // refused with the goods aboard, then the same card and the same stock
    // to the captain it waits on.
    const good = marked?.resources[0].type ?? "";
    const need = marked?.resources[0].required ?? 0;
    const seatFor = (path: PathId | null) => {
      const state = dealOrders("a");
      const card = state.customerCards.find((o) => o.id === marked?.id);
      if (!card)
        throw new Error(
          "The pathbound order checks need the same board dealt twice.",
        );
      state.path = path;
      state.inventory[good] = need;
      state.money = 100;
      return { state, card };
    };
    if (marked && owner) {
      const refused = seatFor(null);
      const refusal: string[] = [];
      completeOrder(refused.state, refused.card.id, refusal);
      check(
        canFillOrder(refused.state, refused.card) === false &&
          refused.state.money === 100 &&
          !refused.state.completedOrders.includes(refused.card.id) &&
          refusal.some((line) => line.includes(pathLockLine(owner))),
        "a locked card is refused even with the goods aboard, and the refusal is the same sentence the board prints on the card rather than a second one written for the ledger",
      );
      const opened = seatFor(owner);
      const fillable = canFillOrder(opened.state, opened.card);
      completeOrder(opened.state, opened.card.id, []);
      check(
        fillable === true &&
          opened.state.money > 100 &&
          opened.state.completedOrders.includes(opened.card.id),
        "and the same card, stocked the same way, opens for the captain holding the path it waits on, who is paid for it like any other order: the path decides who may press the card, not what the card pays",
      );
    }

    // The draw this feature never touched. An ordinary card that demands a
    // pooled good is nobody's locked card, marker and all: the lock hangs
    // on the marker rather than on the good, which is what keeps the six a
    // captain has always been dealt exactly as open as they were.
    const pooledPath = PATH_IDS.find((id) => PATHS[id].orderPool.length > 0);
    const pooledGood = pooledPath ? PATHS[pooledPath].orderPool[0] : "";
    const ordinary: OrderCard = {
      id: 999,
      demandPort: "Hangzhou Port",
      resources: [{ type: pooledGood, required: 1 }],
      reward: 40,
      totalItems: 1,
      isProductOrder: false,
    };
    check(
      pooledPath !== undefined &&
        lockingPathFor(pooledGood) === pooledPath &&
        pathOrderOf(ordinary, GAMBIT) === null &&
        lockedBehind(board, ordinary) === null &&
        lockedBehind({ ...board, path: pooledPath }, ordinary) === null,
      "and an ordinary order demanding the very same good is open to every captain, marker and all, so the lock is the marker's doing and never the good's",
    );

    // The count the leg report files, which the balance dashboard's
    // expired orders are read off: a locked card is not an order anybody
    // failed to fill, so it is not a dealt one either.
    check(
      owner !== null &&
        openOrderCount(board) === scheduled &&
        openOrderCount({ ...board, path: owner }) ===
          scheduled +
            pathCards.filter((o) => pathOrderOf(o, GAMBIT) === owner).length,
      "and the dealt count a leg report files leaves the locked cards out, counting the tier's own draw when the captain holds no path and adding back exactly the cards the path they hold posted",
    );
  });

  // The switch, at the other end: the same seed and the same round with
  // path orders off. This is the plan's rollback clause read literally
  // ("Flag off and the three pathbound slots disappear, leaving the
  // existing six"), and it is this feature's backward compatibility read at
  // the same time: the six the draw deals are the same six, card for card,
  // whether the feature is on or off, because the pathbound slots are drawn
  // from a stream of their own.
  const pathOffBoard = withEnv("NEXT_PUBLIC_PATH_ORDERS", "off", () =>
    dealOrders("a"),
  );
  const pathOnBoard = dealOrders("a");
  check(
    pathOffBoard.customerCards.length ===
      pathOnBoard.customerCards.length - PATH_ORDER_SLOTS &&
      pathOffBoard.customerCards.every((o, i) => {
        const on = pathOnBoard.customerCards[i];
        return (
          !o.isPathOrder &&
          on !== undefined &&
          o.id === on.id &&
          o.resources[0]?.type === on.resources[0]?.type &&
          o.reward === on.reward
        );
      }),
    "with the switch off the three slots are gone from the board and the orders that remain are the very same orders, card for card and reward for reward, which is what the separate draw buys",
  );
  check(
    pathOffBoard.customerCards.every(
      (o) =>
        pathOrderOf(o, GAMBIT) === null &&
        lockedBehind(pathOffBoard, o) === null,
    ) && openOrderCount(pathOffBoard) === pathOffBoard.customerCards.length,
    "and a board dealt with the switch off carries no locked card at all, which is the base game exactly",
  );
  // The same reading for a card already dealt: a marked card is a marker
  // on a card, so a build with the switch off plays it as an ordinary
  // order rather than leaving it grey forever.
  const markedCards = pathOnBoard.customerCards.filter((o) => o.isPathOrder);
  check(
    markedCards.length === PATH_ORDER_SLOTS &&
      withEnv("NEXT_PUBLIC_PATH_ORDERS", "off", () =>
        markedCards.every(
          (o) =>
            pathOrderOf(o, GAMBIT) === null &&
            lockedBehind(pathOnBoard, o) === null,
        ),
      ),
    "and a card already dealt by a build with the switch on is an ordinary order to a build with it off, so rolling the feature back mid voyage leaves nobody holding a card no one can fill",
  );

  // The plan's definition of done asks new state to round trip through a
  // save, and the marker is new state on a persisted object: the board is
  // written into the save blob, so a marked card has to come back marked
  // and be read the same way at both ends of the switch after a trip
  // through JSON as it was read before one.
  const carriedBoard = JSON.parse(JSON.stringify(pathOnBoard)) as GameState;
  check(
    withEnv("NEXT_PUBLIC_PATH_ORDERS", "1", () => {
      const carriedMarks = carriedBoard.customerCards.filter(
        (o) => o.isPathOrder,
      );
      return (
        carriedMarks.length === PATH_ORDER_SLOTS &&
        carriedMarks.every((o) => pathOrderOf(o, GAMBIT) !== null) &&
        openOrderCount(carriedBoard) ===
          carriedBoard.customerCards.length - PATH_ORDER_SLOTS
      );
    }) &&
      withEnv("NEXT_PUBLIC_PATH_ORDERS", "off", () =>
        carriedBoard.customerCards.every(
          (o) =>
            pathOrderOf(o, GAMBIT) === null &&
            lockedBehind(carriedBoard, o) === null,
        ),
      ),
    "a dealt board round trips through a save with its marks intact, and the same board carried back under the switch off is nine ordinary orders with nobody locked out of any of them",
  );

  // The label, under the house rule: the lock line is computed from the
  // record, names the path it waits on, and differs for every path, so two
  // cards on one board can never explain themselves with one sentence.
  check(
    PATH_IDS.every((id) => {
      const line = pathLockLine(id);
      return line.includes(PATHS[id].name) && !CARRIES_A_DASH.test(line);
    }) &&
      new Set(PATH_IDS.map((id) => pathLockLine(id))).size === PATH_IDS.length,
    "the lock line names the path it waits on for every path, reads free of dashes under the house rule, and is never the same sentence for two paths",
  );
  // The plan's instruction for this feature, held by a scan of the tree
  // rather than by memory: the lock reason is computed from the path config
  // rather than written into the card. The stem below is the part of the
  // sentence that is literal in the source (the rest is the path's own
  // name), and it is swept for across every source file, so finding it in
  // one file is finding the sentence in one file however a second copy of
  // it might be spelled.
  const lockStem = pathLockLine(PATH_IDS[0]).split(PATHS[PATH_IDS[0]].name)[0];
  const lockCarriers = walkSrc(
    join(import.meta.dirname, "..", "..", "..", "src"),
  ).filter((file) => readFileSync(file, "utf8").includes(lockStem));
  check(
    lockStem.length > 0 &&
      lockCarriers.length === 1 &&
      lockCarriers[0].endsWith(join("game", "paths.ts")),
    "the lock sentence a card prints appears in one file in the whole tree, the path record, so a retuned path cannot desynchronize from the words the board explains it with",
  );
}
