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
import { ICONS } from "../constants/brand";
import { WORKER_TYPES, workerType, type WorkerTypeId } from "../constants/crew";
import { RECIPES } from "../constants/goods";
import { onShortRations, shortRationsYield } from "../larder";
import { newCrewIdentity } from "../crew";
import { isFrostbitten } from "../garments";
import {
  frozenAssignRefusal,
  frozenWorkLog,
  hungryProductionNote,
} from "../status-copy";
import type { GameState } from "../types";
import { hasModule } from "./core";
import { getHireCost } from "./pricing";

export function hireWorker(state: GameState, type: string, logs: string[]) {
  const wage = getHireCost(state, type);
  const def = workerType(type);
  const label = def?.label ?? type;
  // Jade Pavilion's pledge covers the first artisan to come aboard, once a
  // voyage. What an artisan costs to take on is the wage for the round it
  // joins: there is no separate joining fee (see getHireCost), so the
  // pledge waives exactly that one payment and the artisan is paid as
  // normal from the round after. The affordability check below is against
  // the same number, so a captain with an empty purse can still take the
  // free hire that their House promised them.
  const pledged = state.housePerks.jadeFreeHireAvailable;
  if (!pledged && state.money < wage) {
    logs.push("❌ Insufficient funds to hire workers!");
    return;
  }
  const list = state.workers[type as WorkerTypeId];
  // The pledge is only spent once the artisan is actually on the roster, so
  // a hire that bails out above leaves it intact for the next attempt.
  if (!list) return;
  // The log line takes its label from WORKER_TYPES through `def?.label`,
  // and a new worker carries no progress field (see Worker in types.ts):
  // progress was always 0, so the roster tracks produced counts alone.
  //
  // [C2: crew loss by name] Who the new hand is, drawn here rather than
  // inside their object literal, because the draw reads the roster and the
  // voyage's losses. Read after every guard above, so a hire that bails
  // out over an empty purse never spends a name, and the log line
  // introduces the person rather than the trade: the bench's rows carry
  // names now, and a captain meeting an artisan here and a row there
  // should meet the same one.
  const identity = newCrewIdentity(state);
  list.push({
    task: null,
    producedCount: 0,
    isSkilled: false,
    name: identity.name,
    seq: identity.seq,
    // Present only on the pledge hire, so a saved voyage carries the flag
    // on the one artisan it means rather than as an explicit false on every
    // worker. An absent flag and a false one read identically.
    freeFirstWage: pledged || undefined,
  });
  logs.push(
    `${def?.icon ?? "🧑"} Hired ${identity.name} the ${label}! Wage: ${wage} Gold / Round (paid at round end)`,
  );
  if (pledged) {
    state.housePerks.jadeFreeHireAvailable = false;
    logs.push(
      "🪷 Jade Pavilion pledge honored: this artisan joins at no cost, so the first wage is on the House.",
    );
  }
}

export function fireWorker(
  state: GameState,
  type: string,
  idx: number,
  logs: string[],
) {
  const list = state.workers[type as WorkerTypeId];
  if (!list) return;
  // Severance reads the same getHireCost(state, type) the hire and
  // payroll paths use, so a boon or module that shifts the wage shifts
  // the severance in lockstep.
  const wage = getHireCost(state, type);
  const label = workerType(type)?.label ?? type;
  if (idx < 0 || idx >= list.length) return;
  if (state.money < wage) {
    logs.push(`❌ Insufficient funds for ${label}'s severance: ${wage} Gold`);
    return;
  }
  state.money -= wage;
  const worker = list.splice(idx, 1)[0];
  // [C2: crew loss by name] The line says who left. It used to say the
  // trade alone ("Dismissed a Weaver"), which was all the roster ever
  // carried; the bench's rows show a name now, and a dismissal that named
  // only the craft would leave a captain matching people to the bill.
  logs.push(
    `💔 Dismissed ${worker.name} the ${label}. Severance: ${wage} Gold`,
  );
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
  // [C3: garments and the cold] Whether any hand was passed over for the
  // cold, kept so the refusal below can say what happened instead of
  // reporting a full bench over hands that are standing idle because they
  // froze.
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
  logs.push(
    frozen
      ? frozenAssignRefusal()
      : "❌ All workers are already assigned tasks!",
  );
}

export function processProduction(state: GameState, logs: string[]) {
  const bonus = state.modifierFlags.worker_bonus_production || 0;
  // [F6: charters at leg four] The Weavers' Charter, read once here for the
  // reason the boon above is: one fact about the captain, not one per
  // artisan. It is a fact about weaving hands alone, which is what its text
  // names, so the map below carries which trades weave and only those take
  // the extra item.
  const weavingCharter = state.modifierFlags.loom_extra_produce || 0;
  // Every artisan type, whether or not this tier has unlocked it: a captain
  // can only ever have hired an unlocked one, and an empty list costs nothing.
  // The singular label, not a plural with its trailing s trimmed off.
  // WORKER_TYPES already carries both forms, and the trim only read
  // correctly by accident: it happens to work on all seven plural spellings
  // today, and would have produced "Master" from a plural like "Master
  // Artisans" without anyone noticing until it reached a log line.
  const allLists = WORKER_TYPES.map((w) => ({
    list: state.workers[w.id] ?? [],
    name: w.label,
    // [F6: charters at leg four] A Master Weaver is a weaver, and the
    // charter's sentence says each weaver, so both weaving trades take
    // the charter's item while the smiths and the makers do not. Read off
    // the type's own id rather than its label, because the label is the
    // string the ledger prints and a copy change must not move a rule.
    weaves: w.id === "weaver" || w.id === "master",
  }));
  // [C1: the Larder and Short Rations] Read once, outside both loops,
  // because it is one fact about the captain rather than one per artisan:
  // the ship either went hungry this leg or it did not. The line below is
  // said once for the same reason, so the smaller numbers that follow it
  // have an explanation above them instead of a note on every row, and it
  // names the stake as well as the state so the empty larder's price is
  // read before it is paid. [W3: the status convention] The sentence is
  // composed in ../status-copy, where the hunger family's three clauses
  // are authored once and its way back is held to every surface.
  const short = onShortRations(state);
  if (short) logs.push(hungryProductionNote());
  for (const { list, name, weaves } of allLists) {
    for (const w of list) {
      // [C3: garments and the cold] The bench will not hand work to a hand
      // out of action, but a save is not the bench and can carry a task
      // beside a frostbite mark. The rule is that a hand out of action does
      // not work, so the task is left standing rather than dropped: its
      // materials were spent when it was assigned, and it produces the leg
      // after this one.
      if (isFrostbitten(w, state.currentRound)) {
        if (w.task) logs.push(frozenWorkLog(w.name, w.task));
        continue;
      }
      if (w.task) {
        let base = w.isSkilled ? 2 : 1;
        let amt = base + bonus;
        if (hasModule(state, "artisans_workshop")) amt += 1;
        // [F6: charters at leg four] The charter's item lands before the
        // ration reduction, like every addition above it: the extra work
        // is done on the round it is done, and a hungry leg then shrinks
        // the whole of it rather than a part.
        if (weaves && weavingCharter) amt += weavingCharter;
        if (short) amt = shortRationsYield(amt);
        state.inventory[w.task] = (state.inventory[w.task] || 0) + amt;
        w.producedCount = (w.producedCount || 0) + amt;
        // The tail used to read "(Boon Bonus)", which was already loose
        // (the workshop module is not a boon) and became a plain
        // misattribution the afternoon a charter could raise this number:
        // three sources can now land on one line, so the line names what
        // they have in common rather than one of the three.
        if (amt > base)
          logs.push(
            `✅ Skilled ${name} finished ${amt}× ${ICONS[w.task]}${w.task}! (Bonus)`,
          );
        // Reads its own amount rather than the 2 this branch used to spell
        // out. That was true for as long as a skilled artisan's output could
        // only be 2 or more, and the short rations reduction above is what
        // ended that: a hungry crew's skilled hand makes 1, and a line
        // promising 2 over a hold that gained 1 is the ledger lying about
        // work the captain can count.
        else if (w.isSkilled)
          logs.push(
            `✅ Skilled ${name} finished ${amt}× ${ICONS[w.task]}${w.task}!`,
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

/**
 * The wage bill a payroll run is about to charge, read without charging
 * it.
 *
 * payWages is that run; this is the same arithmetic standing still, and
 * the two are one reader for a reason. Four surfaces used to walk the
 * roster themselves, and none of them knew about the Jade Pavilion
 * pledge: a sponsored hand's first wage is waived, so every surface that
 * counted hands and multiplied by the trade's wage overbilled a pledged
 * captain by exactly one wage. The button on the settle screen warned of
 * a bankruptcy the run would never deliver, the harbor aid request was
 * seeded with a shortfall that did not exist (it gates on affordability),
 * and the rail and the advice line quoted the same figure one wage high.
 * The pledge is read here and spent in payWages, which is the half of
 * this pair that is allowed to write: a reader that cleared the flag
 * would spend the waiver on whichever screen happened to render first.
 */
type WageBillRow = {
  id: WorkerTypeId;
  // Hands whose wage is due, and hands the Pavilion covers. The two
  // together are the roster the row's label counts.
  count: number;
  sponsored: number;
  label: string;
  plural: string;
  due: number;
};

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
      due: count * getHireCost(state, w.id),
    };
  });
}

/**
 * The bill keyed by worker type, for the two screens that join it against
 * the unlocked roster rather than printing it straight (the status rail
 * and Worker Management). The key is the engine's own id, which is also
 * what WORKER_TYPES and the roster share, so a missing row reads as a
 * type the roster does not know rather than a type with an unpaid wage.
 */
export function payrollIndex(state: GameState): Map<WorkerTypeId, WageBillRow> {
  return new Map(wageBill(state).map((b) => [b.id, b]));
}

/**
 * The Gold a payroll run is about to charge: the rows above, added up.
 * payWages reads this beside its own copy of the bill, and the three
 * screens that warn a captain before the charge lands (the settle sheet,
 * the status rail's obligations figure and the advisor's settlement
 * advice) read the same total, so what is billed and what is warned of
 * are one walk of one roster.
 *
 * It has to be read BEFORE payWages clears any Jade Pavilion waiver: the
 * flag promises to cover exactly one wage and is spent in that clearing
 * pass, so the same roster read after the pass bills nothing.
 */
export function wagesDue(state: GameState): number {
  return wageBill(state).reduce((sum, b) => sum + b.due, 0);
}

export function payWages(
  state: GameState,
  logs: string[],
): true | "bankruptcy" {
  // The bill comes off the shared reader above, so the figure charged
  // here and the figure every screen quotes are one reading of one
  // roster rather than five. A type whose only artisan is sponsored owes
  // nothing but is kept, because it still has a pledge to report below.
  const bills = wageBill(state).filter((b) => b.count > 0 || b.sponsored > 0);
  // The total is read here, beside the bill and before the pass below,
  // for the same reason the bill is: wagesDue reads this roster again, and
  // once the pass below has spent the waivers a sponsored hand's first
  // wage reads as owed again.
  const total = wagesDue(state);
  // This is also where a Jade Pavilion pledge is spent. The waiver is
  // cleared before any early return below, because it covers exactly one
  // payroll run whether or not a bill follows from it: leaving it set
  // would quietly excuse that artisan every round for the rest of the
  // voyage instead of only the round they joined. The bill and its
  // total above were read before this line, which is what lets one pass
  // both print the pledge and charge the wage it replaced.
  for (const w of WORKER_TYPES) {
    for (const worker of state.workers[w.id] ?? []) {
      if (!worker.freeFirstWage) continue;
      worker.freeFirstWage = false;
    }
  }
  for (const b of bills) {
    if (b.sponsored > 0)
      logs.push(
        `🪷 Jade Pavilion covers the wage for ${b.sponsored} ${b.sponsored === 1 ? b.label : b.plural} this round.`,
      );
  }
  if (total === 0) return true;
  if (state.money >= total) {
    state.money -= total;
    state.workerWages += total;
    // The wage bill is its own expense line and is not part of the round's
    // goods bucket. It used to be added to roundCosts as well, which put the
    // same Gold into the settlement's Total Cost twice: once through that
    // field and once through the workerWages term the ledger sums beside it.
    // The voyage ledger never carried wages at all, and the endgame summary
    // lists them as their own row, so the round bucket was the one place
    // that disagreed with the other two.
    for (const b of bills) {
      if (b.due > 0)
        logs.push(
          `💰 Paid wages for ${b.count} ${b.count === 1 ? b.label : b.plural}: ${b.due} Gold`,
        );
    }
    return true;
  }
  logs.push(
    `⚠️ Insufficient funds! Needed: ${total} Gold, Have: ${state.money} Gold`,
  );
  // Both lines stopped short of promising what happens next. They used to
  // say the workers struck and the voyage was over, which was true for as
  // long as insolvency ended a voyage; in the mode that keeps the seat
  // sailing, the crew is left unpaid and the voyage is not over at all.
  // What the failure costs is decided in ./seats, which is the one place
  // that knows which mode this is.
  logs.push("💥 Could not pay wages, the crew is left unpaid.");
  logs.push("💥 Reputation collapsed: a bankruptcy is recorded.");
  return "bankruptcy";
}

/**
 * The maintenance fee a round is about to charge: the flat fee every
 * voyage carries plus whatever an installed module has added to it (the
 * overdrive engine's surcharge, reconciled against the hull on load by
 * ./boons). payMaintenance below charges exactly this, and the three
 * screens that quote the bill before it lands (the settle sheet, the
 * status rail's obligations figure and the advisor's settlement advice)
 * read their maintenance line from here.
 */
export function maintenanceDue(state: GameState): number {
  return state.fixedCost + state.maintenancePenalty;
}

export function payMaintenance(
  state: GameState,
  logs: string[],
): true | "bankruptcy" {
  const cost = maintenanceDue(state);
  // Maintenance is its own expense line on both payment paths below, and the
  // same double count the wage note above describes applied to it: the fee
  // was added to roundCosts and totalCosts as well, while the settlement
  // adds maintenanceCosts to Total Cost itself and the endgame summary
  // prints it as a row beside the purchases row.
  if (state.money >= cost) {
    state.money -= cost;
    state.maintenanceCosts += cost;
    logs.push(`💸 Paid Ship Maintenance Fee: ${cost} Gold`);
    return true;
  }
  if (state.money > 0) {
    const paid = state.money;
    state.money = 0;
    state.maintenanceCosts += paid;
    logs.push(`⚠️ Forced payment of ${paid} Gold (Needed ${cost} Gold)`);
    // See the note on the wage failure above: this line used to end the
    // voyage in words, which is only half of what it now means.
    logs.push("⚠️ Funds depleted: the maintenance fee goes unpaid.");
    return "bankruptcy";
  }
  return "bankruptcy";
}
