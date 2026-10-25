// Artisan hiring, dismissal, assignments, production and the two round end
// bills. Roster behaviour is driven by WORKER_TYPES, and every wage path uses
// getHireCost so hire, payroll and severance agree.
import { ICONS } from "../constants/brand";
import { WORKER_TYPES, workerType, type WorkerTypeId } from "../constants/crew";
import { RECIPES } from "../constants/goods";
import { onShortRations, shortRationsYield } from "../larder";
import { newCrewIdentity } from "../crew";
import { isFrostbitten } from "../garments";
import { unlockedWorkerTypes } from "../pools";
import {
  frozenAssignRefusalLine,
  frozenWorkLogLine,
  hungryProductionNoteLine,
} from "../status-copy";
import type { GameState } from "../types";
import { joined, line, type LedgerLine } from "@/lib/game/ledger";
import { t } from "@/lib/game/i18n";
import { hasModule } from "./core";
import { discountedDue, getHireCost } from "./pricing";

export function hireWorker(state: GameState, type: string, logs: LedgerLine[]) {
  const wage = getHireCost(state, type);
  const def = workerType(type);
  const label = def?.label ?? type;
  // The Jade Pavilion pledge waives the first wage only, so there is no
  // separate joining fee. The affordability check uses that same zero,
  // allowing a free hire.
  const pledged = state.housePerks.jadeFreeHireAvailable;
  if (!pledged && state.money < wage) {
    logs.push(line("❌ Not enough Gold to hire artisans!"));
    return;
  }
  const list = state.workers[type as WorkerTypeId];
  if (!list) return;
  // Read after the guards so a failed hire does not consume a crew name.
  const identity = newCrewIdentity(state);
  // The pledge is spent only once the artisan is on the roster, so a failed
  // hire leaves it intact.
  list.push({
    task: null,
    producedCount: 0,
    isSkilled: false,
    name: identity.name,
    seq: identity.seq,
    // Absent means false; only a pledge hire carries the flag.
    freeFirstWage: pledged || undefined,
  });
  logs.push(
    line(
      "{workerIcon} Hired {identity.name} the {label}! Wage: {wage} Gold / Round (paid at round end)",
      {
        workerIcon: def?.icon ?? "🧑",
        "identity.name": identity.name,
        label: line(label),
        wage,
      },
    ),
  );
  if (pledged) {
    state.housePerks.jadeFreeHireAvailable = false;
    logs.push(
      line(
        "🪷 Jade Pavilion pledge honored: this artisan joins at no cost, so the first wage is on the House.",
      ),
    );
  }
}

export function fireWorker(
  state: GameState,
  type: string,
  idx: number,
  logs: LedgerLine[],
) {
  const list = state.workers[type as WorkerTypeId];
  if (!list) return;
  // Severance uses the same wage reader as hire and payroll.
  const wage = getHireCost(state, type);
  const label = workerType(type)?.label ?? type;
  if (idx < 0 || idx >= list.length) return;
  if (state.money < wage) {
    logs.push(
      line("❌ Not enough Gold for {label}'s severance: {wage}", {
        label: line(label),
        wage,
      }),
    );
    return;
  }
  state.money -= wage;
  const worker = list.splice(idx, 1)[0];
  logs.push(
    line("💔 Dismissed {worker.name} the {label}. Severance: {wage} Gold", {
      "worker.name": worker.name,
      label: line(label),
      wage,
    }),
  );
  if (worker.task)
    logs.push(
      line(
        "This artisan was making: {worker.task}",
        { "worker.task": line(worker.task) },
        "  ",
      ),
    );
}

export function assignTask(
  state: GameState,
  type: string,
  task: string,
  logs: LedgerLine[],
) {
  const list = state.workers[type as WorkerTypeId];
  if (!list) return;
  const recipe = RECIPES[task];
  // Track this so a refusal can distinguish a frozen hand from a full bench.
  let frozen = false;
  for (const worker of list) {
    if (isFrostbitten(worker, state.currentRound)) {
      frozen = true;
      continue;
    }
    if (worker.task === null) {
      let can = true;
      for (const [m, a] of Object.entries(recipe.materials))
        if ((state.inventory[m] || 0) < a) {
          can = false;
          break;
        }
      if (!can) {
        // List every material and mark the short ones, rather than naming only the
        // first missing good.
        const short = Object.entries(recipe.materials)
          .map(([m, a]) => {
            const have = state.inventory[m] || 0;
            return t("{moduleIcon}{m} {have}/{a}{shortMark}", {
              moduleIcon: ICONS[m],
              m: t(m),
              have,
              a,
              shortMark: have < a ? " ⚠️" : "",
            });
          })
          .join(" + ");
        logs.push(
          line("❌ Material shortage to produce {task}! (Have: {short})", {
            task: line(task),
            short,
          }),
        );
        return;
      }
      // Materials are spent when the task is assigned, not when it produces.
      for (const [m, a] of Object.entries(recipe.materials))
        state.inventory[m] -= a;
      worker.task = task;
      const matTxt = joined(
        Object.entries(recipe.materials).map(([m, a]) =>
          line("{icon}{m}×{amount}", {
            icon: ICONS[m],
            m: line(m),
            amount: a,
          }),
        ),
        () => " + ",
      );
      logs.push(
        line("📋 Assigned: Produce {icon}{task} (Req: {materials})", {
          icon: ICONS[task],
          task: line(task),
          materials: matTxt,
        }),
      );
      return;
    }
  }
  logs.push(
    frozen
      ? frozenAssignRefusalLine()
      : line("❌ All artisans are already assigned tasks!"),
  );
}

// Shared by production and the roster tooltip. The Weavers' Charter applies
// only to weaving trades.
export function workerBaseYield(
  state: GameState,
  skilled: boolean,
  weaves = false,
): number {
  let amt = skilled ? 2 : 1;
  amt += state.modifierFlags.worker_bonus_production || 0;
  if (hasModule(state, "artisans_workshop")) amt += 1;
  if (weaves) amt += state.modifierFlags.loom_extra_produce || 0;
  return amt;
}

export function processProduction(state: GameState, logs: LedgerLine[]) {
  // Visit every type, even locked ones; an empty list costs nothing. The charter
  // boosts only the two weaving trades, keyed by id rather than label so copy
  // changes cannot move the rule.
  const allLists = WORKER_TYPES.map((w) => ({
    list: state.workers[w.id] ?? [],
    name: w.label,
    weaves: w.id === "weaver" || w.id === "master",
  }));
  // One fact for the whole crew. Print the note once so later rows have
  // context.
  const short = onShortRations(state);
  if (short) logs.push(hungryProductionNoteLine());
  for (const { list, name, weaves } of allLists) {
    for (const w of list) {
      // A saved task can sit beside frostbite. Leave the task standing; its
      // materials were already spent, so it produces next round.
      if (isFrostbitten(w, state.currentRound)) {
        if (w.task) logs.push(frozenWorkLogLine(w.name, w.task));
        continue;
      }
      if (w.task) {
        const base = w.isSkilled ? 2 : 1;
        // Additions apply before the ration reduction, so hunger shrinks the whole
        // output.
        let amt = workerBaseYield(state, w.isSkilled, weaves);
        if (short) amt = shortRationsYield(amt);
        state.inventory[w.task] = (state.inventory[w.task] || 0) + amt;
        w.producedCount = (w.producedCount || 0) + amt;
        // Several sources can raise output, so the line says "Bonus" rather than
        // naming one.
        if (amt > base)
          logs.push(
            line(
              "✅ Skilled {name} finished {amt}× {taskIcon}{w.task}! (Bonus)",
              {
                name: line(name),
                amt,
                taskIcon: ICONS[w.task],
                "w.task": line(w.task),
              },
            ),
          );
        // Read amt, not the base 2: short rations can reduce a skilled hand to 1.
        else if (w.isSkilled)
          logs.push(
            line("✅ Skilled {name} finished {amt}× {taskIcon}{w.task}!", {
              name: line(name),
              amt,
              taskIcon: ICONS[w.task],
              "w.task": line(w.task),
            }),
          );
        else
          logs.push(
            line("✅ {name} finished {taskIcon}{w.task}!", {
              name: line(name),
              taskIcon: ICONS[w.task],
              "w.task": line(w.task),
            }),
          );
        if (w.producedCount >= 2 && !w.isSkilled) {
          // Two produced items promote an unskilled hand; check after this round's
          // output is added.
          w.isSkilled = true;
          logs.push(
            line("⭐ {name} Promotion! Can now produce 2 items per round!", {
              name: line(name),
            }),
          );
        }
        w.task = null;
      }
    }
  }
}

type WageBillRow = {
  id: WorkerTypeId;
  count: number;
  sponsored: number;
  label: string;
  plural: string;
  due: number;
};

// The bill a payroll run is about to charge, without charging it. This is
// the shared read for every warning surface, including the Jade Pavilion
// waiver. Only payWages may spend the waiver.
//
// count excludes sponsored hands; sponsored is reported separately.
export function wageBill(state: GameState): WageBillRow[] {
  return WORKER_TYPES.map((w) => {
    const roster = state.workers[w.id] ?? [];
    let sponsored = 0;
    for (const worker of roster) {
      if (worker.freeFirstWage) sponsored++;
    }
    const count = roster.length - sponsored;
    return {
      id: w.id,
      count,
      sponsored,
      label: w.label,
      plural: w.plural,
      due: discountedDue(state, count * getHireCost(state, w.id)),
    };
  });
}

// Keyed by the engine's worker id for joins against WORKER_TYPES.
function payrollIndex(state: GameState): Map<WorkerTypeId, WageBillRow> {
  return new Map(wageBill(state).map((b) => [b.id, b]));
}

// The unlocked roster joined with the engine's bill. Screens must not
// multiply hand counts themselves, or they will bill a sponsored hand.
export function unlockedWorkerRoster(state: GameState) {
  const payroll = payrollIndex(state);
  return unlockedWorkerTypes(state.difficulty, state.currentRound).map((w) => {
    const row = payroll.get(w.id);
    return {
      ...w,
      list: state.workers[w.id] ?? [],
      count: row?.count ?? 0,
      sponsored: row?.sponsored ?? 0,
      due: row?.due ?? 0,
    };
  });
}

// Read before payWages clears waivers, or a sponsored hand's wage reappears
// in the same roster.
export function wagesDue(state: GameState): number {
  return wageBill(state).reduce((sum, b) => sum + b.due, 0);
}

// Wages are their own settlement line and are not part of roundCosts, or
// Total Cost would count them twice. A failure's consequences are decided in
// ./seats, which knows the mode.
export function payWages(
  state: GameState,
  logs: LedgerLine[],
): true | "bankruptcy" {
  // Keep rows that are due or sponsored so the pledge can still be reported.
  const bills = wageBill(state).filter((b) => b.count > 0 || b.sponsored > 0);
  // Read before the waiver pass, using the same shared bill as the screens.
  const total = wagesDue(state);
  // Spend every waiver before any early return. The pledge covers one payroll
  // run whether or not a bill results.
  for (const w of WORKER_TYPES) {
    for (const worker of state.workers[w.id] ?? []) {
      if (!worker.freeFirstWage) continue;
      worker.freeFirstWage = false;
    }
  }
  for (const b of bills) {
    const bLabel = b.sponsored === 1 ? t(b.label) : b.plural;
    if (b.sponsored > 0)
      logs.push(
        line(
          "🪷 Jade Pavilion covers the wage for {b.sponsored} {bLabel} this round.",
          {
            "b.sponsored": b.sponsored,
            bLabel,
          },
        ),
      );
  }
  if (total === 0) return true;
  if (state.money >= total) {
    state.money -= total;
    state.workerWages += total;
    // The voyage tally is written here because endRound clears workerWages.
    state.wagesPaid += total;
    for (const b of bills) {
      const bLabel = b.count === 1 ? t(b.label) : b.plural;
      if (b.due > 0)
        logs.push(
          line("💰 Paid wages for {b.count} {bLabel}: {b.due} Gold", {
            "b.count": b.count,
            bLabel,
            "b.due": b.due,
          }),
        );
    }
    return true;
  }
  logs.push(
    line("⚠️ Not enough Gold! Needed: {total}, Have: {state.money}", {
      total,
      "state.money": state.money,
    }),
  );
  logs.push(line("💥 Could not pay wages, the crew is left unpaid."));
  logs.push(line("💥 Reputation collapsed: a bankruptcy is recorded."));
  return "bankruptcy";
}

// Flat fee plus module surcharges, from the same reader every warning
// surface uses.
export function maintenanceDue(state: GameState): number {
  return discountedDue(state, state.fixedCost + state.maintenancePenalty);
}

// Maintenance is its own settlement line, not part of roundCosts, for the
// same double count reason as wages.
export function payMaintenance(
  state: GameState,
  logs: LedgerLine[],
): true | "bankruptcy" {
  const cost = maintenanceDue(state);
  if (state.money >= cost) {
    state.money -= cost;
    state.maintenanceCosts += cost;
    state.maintenancePaid += cost;
    logs.push(line("💸 Paid Ship Maintenance Fee: {cost} Gold", { cost }));
    return true;
  }
  if (state.money > 0) {
    // A forced partial payment still counts toward the round and voyage totals.
    const paid = state.money;
    state.money = 0;
    state.maintenanceCosts += paid;
    // Voyage tally, for the same reason as wages.
    state.maintenancePaid += paid;
    logs.push(
      line("⚠️ Forced payment of {paid} Gold (Needed {cost} Gold)", {
        paid,
        cost,
      }),
    );
    logs.push(line("⚠️ Gold depleted: the maintenance fee goes unpaid."));
    return "bankruptcy";
  }
  return "bankruptcy";
}
