// =====================================================================
// Artisans: hiring, dismissal, task assignment, production, and the two
// round end bills (wages, then ship maintenance) that can bankrupt a
// captain who overextended their crew.
//
// The roster is driven off WORKER_TYPES rather than a hardcoded branch per
// artisan, so a charter that opens a new artisan type is hirable, payable
// and assignable without touching this file.
//
// Wages price through getHireCost in ./pricing, which is the single source
// of truth for what an artisan actually costs per round. fireWorker's
// severance reads the same function, so hiring, payroll, and severance all
// agree on a single number even when the Artisan's Workshop module or the
// Master's Apprentice boon is shifting the wage around. The earlier split,
// where severance read the raw WAGES table and so ignored both surcharges
// and discounts, was a balance inconsistency that this refactor closes.
// =====================================================================
import {
  ICONS,
  RECIPES,
  WORKER_TYPES,
  workerType,
  type WorkerTypeId,
} from "../constants";
import type { GameState } from "../types";
import { hasModule } from "./core";
import { getHireCost } from "./pricing";

export function hireWorker(state: GameState, type: string, logs: string[]) {
  const wage = getHireCost(state, type);
  if (state.money < wage) {
    logs.push("❌ Insufficient funds to hire workers!");
    return;
  }
  const list = state.workers[type as WorkerTypeId];
  if (!list) return;
  const def = workerType(type);
  // [REFACTOR] Removed the dead `names` map that used to live here: every
  // branch already fell through to `def?.label` for the log line, and the
  // map only ever held the same three labels WORKER_TYPES already carries.
  // `progress: 0` is also gone from the new worker, since Worker.progress
  // was always 0 and unused (see types.ts).
  list.push({ task: null, producedCount: 0, isSkilled: false });
  logs.push(
    `${def?.icon ?? "🧑"} Hired a ${def?.label ?? type}! Wage: ${wage} Gold / Round (paid at round end)`,
  );
}

export function fireWorker(
  state: GameState,
  type: string,
  idx: number,
  logs: string[],
) {
  const list = state.workers[type as WorkerTypeId];
  if (!list) return;
  // [REFACTOR] Was `WAGES[type]`. Severance now reads the same
  // getHireCost(state, type) the hire and payroll paths use, so a boon or
  // module that shifts the wage also shifts the severance in lockstep,
  // closing the old inconsistency where severance ignored both surcharges
  // and discounts.
  const wage = getHireCost(state, type);
  const label = workerType(type)?.label ?? type;
  if (idx < 0 || idx >= list.length) return;
  if (state.money < wage) {
    logs.push(`❌ Insufficient funds for ${label}'s severance: ${wage} Gold`);
    return;
  }
  state.money -= wage;
  const worker = list.splice(idx, 1)[0];
  logs.push(`💔 Dismissed a ${label}. Severance: ${wage} Gold`);
  if (worker.task) logs.push(`  This worker was making: ${worker.task}`);
}

export function assignTask(
  state: GameState,
  type: string,
  task: string,
  logs: string[],
) {
  const list = state.workers[type as WorkerTypeId];
  if (!list) return;
  const recipe = RECIPES[task];
  for (const worker of list) {
    if (worker.task === null) {
      let can = true;
      for (const [m, a] of Object.entries(recipe.materials))
        if ((state.inventory[m] || 0) < a) {
          can = false;
          break;
        }
      if (!can) {
        // Names every material the recipe needs against what's actually on
        // hand, flagging the short ones, instead of just naming the good
        // that failed to start. The check right above already knows exactly
        // which material and by how much; throwing that away here left the
        // player to go compare the recipe against their inventory by hand.
        const short = Object.entries(recipe.materials)
          .map(([m, a]) => {
            const have = state.inventory[m] || 0;
            return `${ICONS[m]}${m} ${have}/${a}${have < a ? " ⚠️" : ""}`;
          })
          .join(" + ");
        logs.push(`❌ Material shortage to produce ${task}! (Have: ${short})`);
        return;
      }
      for (const [m, a] of Object.entries(recipe.materials))
        state.inventory[m] -= a;
      worker.task = task;
      const matTxt = Object.entries(recipe.materials)
        .map(([m, a]) => `${ICONS[m]}${m}×${a}`)
        .join(" + ");
      logs.push(`📋 Assigned: Produce ${ICONS[task]}${task} (Req: ${matTxt})`);
      return;
    }
  }
  logs.push("❌ All workers are already assigned tasks!");
}

export function processProduction(state: GameState, logs: string[]) {
  const bonus = state.modifierFlags.worker_bonus_production || 0;
  // Every artisan type, whether or not this tier has unlocked it: a captain
  // can only ever have hired an unlocked one, and an empty list costs nothing.
  const allLists = WORKER_TYPES.map((w) => ({
    list: state.workers[w.id] ?? [],
    name: w.plural.replace(/s$/, ""),
  }));
  for (const { list, name } of allLists) {
    for (const w of list) {
      if (w.task) {
        let base = w.isSkilled ? 2 : 1;
        let amt = base + bonus;
        if (hasModule(state, "artisans_workshop")) amt += 1;
        state.inventory[w.task] = (state.inventory[w.task] || 0) + amt;
        w.producedCount = (w.producedCount || 0) + amt;
        if (amt > base)
          logs.push(
            `✅ Skilled ${name} finished ${amt}× ${ICONS[w.task]}${w.task}! (Boon Bonus)`,
          );
        else if (w.isSkilled)
          logs.push(
            `✅ Skilled ${name} finished 2× ${ICONS[w.task]}${w.task}!`,
          );
        else logs.push(`✅ ${name} finished ${ICONS[w.task]}${w.task}!`);
        if (w.producedCount >= 2 && !w.isSkilled) {
          w.isSkilled = true;
          logs.push(`⭐ ${name} Promotion! Can now produce 2 items per round!`);
        }
        w.task = null;
      }
    }
  }
}

export function payWages(
  state: GameState,
  logs: string[],
): true | "bankruptcy" {
  // One pass over the roster rather than a hardcoded line per artisan type, so
  // a charter that brings new artisans is paid for without touching this.
  const bills = WORKER_TYPES.map((w) => {
    const count = (state.workers[w.id] ?? []).length;
    return { count, plural: w.plural, due: count * getHireCost(state, w.id) };
  }).filter((b) => b.due > 0);
  const total = bills.reduce((sum, b) => sum + b.due, 0);
  if (total === 0) return true;
  if (state.money >= total) {
    state.money -= total;
    state.workerWages += total;
    state.roundCosts += total;
    for (const b of bills) {
      logs.push(`💰 Paid wages for ${b.count} ${b.plural}: ${b.due} Gold`);
    }
    return true;
  }
  logs.push(
    `⚠️ Insufficient funds! Needed: ${total} Gold, Have: ${state.money} Gold`,
  );
  logs.push("💥 Could not pay wages, workers strike...");
  logs.push("💥 Reputation collapsed, forced bankruptcy!");
  return "bankruptcy";
}

export function payMaintenance(
  state: GameState,
  logs: string[],
): true | "bankruptcy" {
  const cost = state.fixedCost + state.maintenancePenalty;
  if (state.money >= cost) {
    state.money -= cost;
    state.maintenanceCosts += cost;
    state.roundCosts += cost;
    state.totalCosts += cost;
    logs.push(`💸 Paid Ship Maintenance Fee: ${cost} Gold`);
    return true;
  }
  if (state.money > 0) {
    const paid = state.money;
    state.money = 0;
    state.maintenanceCosts += paid;
    state.roundCosts += paid;
    state.totalCosts += paid;
    logs.push(`⚠️ Forced payment of ${paid} Gold (Needed ${cost} Gold)`);
    logs.push("⚠️ Funds depleted! Cannot continue sailing...");
    return "bankruptcy";
  }
  return "bankruptcy";
}
