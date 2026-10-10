/**
 * The module trade report.
 *
 * [F3: modules in the shipyard ladder, and trading them between captains]
 * The plan's second evaluation, read as a table: "Track which modules are
 * equipped against which are traded away, since a module that is always
 * equipped is a tax rather than a choice." The comparison is produced by
 * the game layer's own reader (see readModuleTraffic in
 * src/lib/game/engine/modules), which both ends of the wire share; what is
 * here is the only part that needs a database.
 *
 * Both halves are read off the voyage saves themselves, so nothing had to
 * be added to a save for this report to exist: what a save carries is its
 * hull, which every voyage has always written, and what it sold is the per
 * module ledger the seller's own settle writes (see applyModuleTradeSide).
 * The ledger is read back the way the save heals it, so a save carrying
 * rubbish counts as a save that sold nothing rather than stopping the
 * report: a database holds saves written by every build that ever ran
 * against it.
 *
 * Run with npm run report:modules, against whichever database DATABASE_URL
 * names at the time. It only reads.
 */

import {
  normalizeModulesTraded,
  shippedModuleTraffic,
  type ModuleTrafficSave,
} from "@/lib/game/engine";
import { parseJsonObject } from "@/lib/game/json";
import { db } from "@/lib/db";
import { runReport } from "./report";

// One voyage's contribution, read back the way the save heals it. A row
// whose blob will not parse, or that carries neither a hull nor a ledger,
// contributes an empty save rather than stopping the report.
function trafficOf(data: string): ModuleTrafficSave {
  const parsed = parseJsonObject(data);
  const stored = parsed?.equippedModules;
  const equipped = Array.isArray(stored)
    ? stored
        .map((card) =>
          card !== null && typeof card === "object"
            ? (card as { id?: unknown }).id
            : null,
        )
        .filter((id): id is string => typeof id === "string")
    : [];
  // The ledger goes through the module's own heal, the reader the save
  // itself heals through, held apart for exactly this caller: the
  // counters the state heal also floors are not read here, and a save's
  // own hull is read as written.
  return { equipped, traded: normalizeModulesTraded(parsed?.modulesTraded) };
}

async function main(): Promise<void> {
  const saves = await db.gameState.findMany({ select: { data: true } });
  const rows = shippedModuleTraffic(saves.map((row) => trafficOf(row.data)));

  const nameWidth = Math.max(6, ...rows.map((row) => row.name.length));
  const line = (name: string, equipped: string, traded: string) =>
    `${name.padEnd(nameWidth)}  ${equipped.padStart(9)}  ${traded.padStart(7)}`;
  console.log(line("module", "equipped", "traded"));
  console.log(line("-".repeat(nameWidth), "-".repeat(9), "-".repeat(7)));
  for (const row of rows) {
    console.log(line(row.name, String(row.equipped), String(row.traded)));
  }
  const equipped = rows.reduce((sum, row) => sum + row.equipped, 0);
  const traded = rows.reduce((sum, row) => sum + row.traded, 0);
  console.log(line("all modules", String(equipped), String(traded)));
  console.log(
    `\n${saves.length} voyage save(s) read. A module equipped often and traded never is a tax rather than a choice.`,
  );
}

runReport("The module trade report could not be read.", main);
