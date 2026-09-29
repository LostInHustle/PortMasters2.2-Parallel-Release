// PortMasters 2.2 Parallel Release, smoke run: The paths.

import { GARMENTS } from "@/lib/game/constants/garments";
import { COMMODITIES, ITEMS } from "@/lib/game/constants/goods";
import {
  CONVOY_CANNON_SLOTS,
  QUARTERMASTER_HOLD_GAIN,
} from "@/lib/game/constants/paths";
import { CARGO_SLOTS, FOODS } from "@/lib/game/constants/supplies";
import { RENOWN_MAX_LEVEL, RENOWN_TITLES } from "@/lib/game/legacy";
import type { PathId } from "@/lib/game/paths";
import {
  PATHS,
  PATH_IDS,
  lockingPathFor,
  normalizePath,
  pathConfig,
} from "@/lib/game/paths";
import { CARRIES_A_DASH, carriesADash, check } from "../harness";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function pathsSuite(): Promise<void> {
  // The plan's five, with the names the plan gives them, read through
  // pathConfig rather than off the record behind it, so the check
  // exercises the door every other module reads them through.
  const PLAN_PATHS: ReadonlyArray<readonly [PathId, string]> = [
    ["convoy", "Convoy"],
    ["loom", "Loom"],
    ["aroma", "Aroma"],
    ["free_captain", "Free Captain"],
    ["quartermaster", "Quartermaster"],
  ];
  check(
    PLAN_PATHS.every(([id, name]) => pathConfig(id)?.name === name),
    "the plan's five paths are all in the record and carry the plan's own names, read through the same door every other module reads them through",
  );
  check(
    PATH_IDS.join(",") === Object.keys(PATHS).join(",") &&
      PATH_IDS.every((id) => normalizePath(id) === id),
    "and the id list is the record's own keys rather than a second list written out beside it, which is what makes a sixth path one entry here and a sixth path everywhere else",
  );

  // Names and crests, the two things a locked card wears. The board D2
  // builds greys three of them at once, so two paths sharing either make
  // two cards nobody can tell apart.
  const pathNames = PATH_IDS.map((id) => PATHS[id].name);
  const pathCrests = PATH_IDS.map((id) => PATHS[id].crest);
  check(
    pathNames.every((name) => name.length > 0) &&
      new Set(pathNames).size === pathNames.length,
    "no two paths print the same name, so a locked card cannot be labelled for one path and stamped for another",
  );
  check(
    pathCrests.every((crest) => crest.length > 0) &&
      new Set(pathCrests).size === pathCrests.length,
    "and no two wear the same crest, for the same reason read from the other end: a repeated glyph makes two of the three greyed cards the same card",
  );

  // The hold, which is where a path's structural poverty or plenty lives.
  // Convoy's is the plan's own account of the path: the cannons that make
  // its contract worth buying are cargo it cannot carry, so the number is
  // the subtraction of those two constants rather than a literal typed
  // beside it, and it is read against them here so a retune of either
  // moves this check with it rather than past it.
  const pathModifiers = PATH_IDS.map((id) => PATHS[id].cargoModifier);
  check(
    PATHS.convoy.cargoModifier ===
      (CARGO_SLOTS - CONVOY_CANNON_SLOTS) / CARGO_SLOTS &&
      PATHS.convoy.cargoModifier > 0 &&
      PATHS.convoy.cargoModifier < 1,
    "the Convoy's hold is the slots its cannons occupy subtracted from the hold, written as that subtraction rather than as a number beside it, and it stays a fraction of a hold rather than a hold that owes slots back",
  );
  check(
    PATHS.quartermaster.cargoModifier === 1 + QUARTERMASTER_HOLD_GAIN &&
      Math.max(...pathModifiers) === PATHS.quartermaster.cargoModifier &&
      pathModifiers.filter((m) => m === PATHS.quartermaster.cargoModifier)
        .length === 1,
    "the Quartermaster's is the largest hold at the table and the only one at that size, because a second path carrying it would be the same seat twice",
  );
  check(
    ["loom", "aroma", "free_captain"].every(
      (id) => PATHS[id as PathId].cargoModifier === 1,
    ),
    "and every path the plan claims nothing about carries exactly one, which is a value rather than an absent field: one means the hold is the hold",
  );

  // The ceilings, read off the ladder the profile and the merits already
  // read. The plan gives one relation between the five and no numbers, so
  // what is held here is that relation against the ladder rather than the
  // numbers it currently works out to.
  const ladderRungs = RENOWN_TITLES.map((title) => title.minLevel);
  check(
    PATH_IDS.every((id) => ladderRungs.includes(PATHS[id].renownCeiling)),
    "every ceiling is a rung the Renown ladder actually has, so a path banks toward a title that exists rather than toward a level nobody can be promoted into",
  );
  check(
    PATHS.quartermaster.renownCeiling === RENOWN_MAX_LEVEL &&
      PATH_IDS.every((id) => PATHS[id].renownCeiling <= RENOWN_MAX_LEVEL),
    "the Quartermaster's is the top of the ladder and no path reads above it, derived from the ladder so a title added above the top moves it rather than stranding it",
  );
  const besideCeiling = ladderRungs[ladderRungs.length - 2];
  check(
    PLAN_PATHS.filter(([id]) => id !== "quartermaster").every(
      ([id]) => PATHS[id].renownCeiling === besideCeiling,
    ) && besideCeiling < RENOWN_MAX_LEVEL,
    "and the four beside it cap one rung beneath, which is the plan's only other word on the subject and is read off the ladder rather than written in twice",
  );

  // The goods, read against the tables they were sourced from rather than
  // against a list retyped here. A check that wrote the seven commodities
  // out again would be the second copy this module exists to avoid, and
  // it would pass on the day the catalogue grew and the record did not.
  check(
    PATHS.loom.goods.join(",") === Object.keys(GARMENTS).join(",") &&
      PATHS.aroma.goods.join(",") === Object.keys(COMMODITIES).join(",") &&
      PATHS.quartermaster.goods.join(",") === Object.keys(FOODS).join(","),
    "each order path's goods are its own table read rather than retyped, so a fourth garment or a wider commodity list reaches the record without an edit inside it",
  );

  // The pools, and with them the lock reason D2 computes rather than
  // writes onto a card. The three errand paths bring the board an order
  // of their own and the two action paths do not, which is a reading of
  // the plan rather than a gap: selling a contract and borrowing an order
  // are actions, and a board that greyed a card for them would have
  // invented an errand the design never gave them.
  const catalogue = new Set<string>([
    ...ITEMS,
    ...Object.keys(GARMENTS),
    ...Object.keys(COMMODITIES),
    ...Object.keys(FOODS),
  ]);
  check(
    ["loom", "aroma", "quartermaster"].every(
      (id) => PATHS[id as PathId].orderPool.length > 0,
    ) &&
      PATHS.convoy.orderPool.length === 0 &&
      PATHS.free_captain.orderPool.length === 0,
    "the three paths whose ability is an errand carry an order pool and the two whose ability is an action carry none, which is where D2's three greyed cards are drawn from",
  );
  check(
    PATH_IDS.every((id) =>
      PATHS[id].orderPool.every((good) => catalogue.has(good)),
    ),
    "and every good a pool names is a good the catalogue knows, so the board can never grey a card for an order nobody could fill",
  );
  const claimed = new Map<string, number>();
  for (const id of PATH_IDS) {
    for (const good of PATHS[id].orderPool) {
      claimed.set(good, (claimed.get(good) ?? 0) + 1);
    }
  }
  check(
    [...claimed.values()].every((count) => count === 1),
    "and no good is claimed by two paths at once, because lockingPathFor answers with the first pool holding it and a good in two would make that answer depend on the record's order",
  );

  // The reader, which is the whole of what D2 calls and the one place a
  // locked card's reason comes from.
  check(
    lockingPathFor("Brocade") === "loom" &&
      lockingPathFor("Silk") === "aroma" &&
      lockingPathFor("Salt Fish") === "quartermaster",
    "a good finds its locking path by being looked up in the pools rather than by a label written onto the card, so what the board greys out and what the card says cannot come apart",
  );
  check(
    lockingPathFor("") === null && lockingPathFor("sachet") === null,
    "and a value no pool holds locks nothing rather than being guessed at, since the lookup is exact: an empty string and a good's name in the wrong case both come back unowned",
  );
  check(
    [...catalogue].some((good) => lockingPathFor(good) === null),
    "and the catalogue still holds goods no path claims, which is what keeps the board's ordinary orders ordinary and the locked ones the exception D2 greys out",
  );

  // The door every other module reads a saved value through, and the
  // naming change held at the interface: the two retired words are
  // refused as path ids here rather than remembered as a convention.
  check(
    normalizePath("aroma") === "aroma" && pathConfig("aroma") === PATHS.aroma,
    "a saved value reads back as the path it names, and the record it reads back is the record itself rather than a copy that could fall out of step with it",
  );
  check(
    normalizePath("Variable") === null &&
      normalizePath("faction") === null &&
      normalizePath("") === null &&
      normalizePath(4) === null &&
      normalizePath({ path: "loom" }) === null,
    "and nothing else does: the two retired words, an empty string, a number and an object all read as no path rather than as a path nobody chose, which is the naming change held where it can be checked",
  );
  check(
    normalizePath("constructor") === null && normalizePath("toString") === null,
    "with the prototype chain refused on purpose, since these are string keys and the cheaper membership test would have answered for both of them",
  );
  check(
    pathConfig(undefined) === null && pathConfig(null) === null,
    "and a save that predates paths, or a captain who has not drawn one, reads as no path at all, which is the honest state of every captain until the draft that deals one lands",
  );

  // The module's own claim that a path is content: no environment value
  // behind it, no server module under it. Read off the file rather than
  // asserted about it, so the day a path is gated behind a switch the
  // switch has to live where the other switches do, in ./flags, and the
  // sentence in this module's header stays true.
  const pathsSource = readFileSync(
    join(import.meta.dirname, "..", "..", "..", "src/lib/game/paths.ts"),
    "utf8",
  );
  check(
    !pathsSource.includes("process.env") &&
      !pathsSource.includes("@/server") &&
      !pathsSource.includes("@/lib/db"),
    "and the record reads no environment value and reaches for no server module, so retuning a path is an edit to one file rather than a deploy",
  );

  // The copy, under the house rule. A signature line is what D2 prints on
  // a locked card, so it is a string a captain reads in the strictest
  // sense, and the two modules the sweep wrote hold the rule in their
  // comments as well as in their copy.
  check(
    PATH_IDS.every(
      (id) =>
        PATHS[id].signature.length > 0 &&
        !CARRIES_A_DASH.test(PATHS[id].signature) &&
        !CARRIES_A_DASH.test(PATHS[id].name),
    ),
    "every name and signature line a locked card would print is free of dashes, the same rule every other string a captain reads is held to",
  );
  check(
    !carriesADash("src/lib/game/paths.ts") &&
      !carriesADash("src/lib/game/gambit.ts"),
    "and the record itself, and the alignment module whose hidden card the sweep renamed, hold it in their comments as well as in their copy",
  );

  // =================================================================
  // [D2: the nine slot order board] The manifest's pathbound slots, read
  // against the plan's own clause for the feature: "Six basic orders open,
  // three pathbound orders greyed out, each stamped with the crest of the
  // path that would unlock it and labeled in plain language."
  //
  // The boards below are dealt through the real lifecycle rather than
  // assembled by hand: snapToCheckpoint runs the engine's own startOrders,
  // so what is read here is the board a captain meets in the Orders phase.
  // =================================================================
}
