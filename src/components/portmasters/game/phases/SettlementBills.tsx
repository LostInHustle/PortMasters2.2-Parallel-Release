"use client";

import { cardName } from "@/lib/game/cards";
import {
  leavePhase,
  maintenanceDue,
  wageBill,
  wagesDue,
} from "@/lib/game/engine";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import {
  PhaseError,
  PhaseHeading,
  ReadyFooter,
  type PhasePanelProps,
} from "./PhaseShared";
import { HarborAid } from "./SettlementAid";
import { LoanBacking } from "./SettlementBacking";

// One line of a bill: a name on the left and a figure on the right, in the
// size that section prints. The settle screen had six of these written out
// by hand, three of them in the same block.
function BillRow({
  size = "text-[13px]",
  className,
  label,
  children,
}: {
  size?: string;
  className?: string;
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex justify-between py-0.5", size, className)}>
      <span>{label}</span>
      {children}
    </div>
  );
}

/**
 * The second station of the Resolve phase: what the round costs, what the
 * purse holds against it, and the fifth button. The raid is already
 * resolved by the time this draws (see PirateAttack), so this screen is
 * the bill for it.
 */
export function SettlementBills({
  game,
  ctx,
  aid,
  backing,
  me,
  phaseSync,
  members,
}: Pick<
  PhasePanelProps,
  "game" | "ctx" | "aid" | "backing" | "me" | "phaseSync" | "members"
>) {
  const myUserId = me.id;
  // The bill comes off the engine's own reader rather than off a walk this
  // screen makes alone (see wageBill). A walk kept here drifts: a sheet
  // that totals every hired hand knows nothing of the Jade Pavilion
  // pledge, which waives a sponsored artisan's first wage, so a pledged
  // captain sees one wage too many, the settle button warns of a
  // bankruptcy the run would never deliver, and the harbor aid request
  // below is seeded with a shortfall that does not exist (it gates on
  // canAfford). A walk that totalled only the founding types would bill a
  // charter's Coppersmith or Potter for less than the engine charges a
  // breath later.
  const bill = wageBill(game);
  const wages = wagesDue(game);
  const nWorkers = bill.reduce((sum, b) => sum + b.count + b.sponsored, 0);
  const sponsored = bill.reduce((sum, b) => sum + b.sponsored, 0);
  const maintCost = maintenanceDue(game);
  const totalDue = wages + maintCost;
  const canAfford = game.money >= totalDue;
  const balanceAfter = game.money - totalDue;
  const shortfall = Math.max(1, totalDue - game.money);

  // The two Settle Bills variants. Calm (canAfford) is the "pay the
  // bills" button a captain reaches for at the end of a normal round. The
  // force pay variant is the destructive call: the captain cannot cover
  // wages plus maintenance, has either no open aid request or no captain
  // willing to back them in time, and is about to go bankrupt the moment
  // they confirm. The two wear different colours so the consequence shows
  // before the label is read: the settlement fill for the calm one, and
  // the alarm red for the one that cannot be taken back and must not be
  // tapped by reflex.
  const settleLabel = canAfford
    ? `💸 Settle Bills: ${totalDue} Gold`
    : `Force Payment and Risk Bankruptcy (${game.money}/${totalDue} Gold)`;
  const settleClassName = canAfford
    ? "pm-grad-resolve h-12 px-8"
    : "bg-alarm text-background h-12 px-8 font-semibold";
  const settleIcon = canAfford ? null : <AlertTriangle className="h-4 w-4" />;

  return (
    <div className="max-w-2xl mx-auto">
      <PhaseHeading layout="text-center mb-4" tone="text-resolve" brush>
        💸 Resolve: Round Settlement
      </PhaseHeading>

      {game.pirateAttackResolved && (
        <div
          className={cn(
            "rounded-xl border p-3 my-3.5 text-center text-sm",
            game.escortHired
              ? "border-gain/20 bg-gain/[0.04]"
              : "border-black/10 dark:border-white/10 bg-background/40",
          )}
        >
          {game.escortHired
            ? "🛡️ Escort hired, you sailed through safely this round."
            : "🌊 You sailed without an escort this round."}
        </div>
      )}

      <div className="rounded-xl bg-due/[0.06] border border-due/20 p-3.5 my-3.5">
        <h3 className="font-semibold text-due mb-2">⏳ Bills Due This Round</h3>
        <BillRow
          label={
            <>
              👥 Worker Wages ({nWorkers} worker{nWorkers !== 1 ? "s" : ""})
            </>
          }
        >
          <span className="font-bold">{wages} Gold</span>
        </BillRow>
        {sponsored > 0 && (
          // Why the figure above is lower than the roster times the trades'
          // wages: the pledge the engine will spend a breath later, named
          // in the engine's own shape so the sheet and the log line that
          // replaces it tell one story.
          <div className="text-[11px] text-muted-foreground pl-2.5">
            ↳ 🪷 Jade Pavilion covers the wage for{" "}
            {bill
              .filter((b) => b.sponsored > 0)
              .map(
                (b) =>
                  `${b.sponsored} ${b.sponsored === 1 ? b.label : b.plural}`,
              )
              .join(", ")}{" "}
            this round
          </div>
        )}
        <BillRow size="text-sm" label="🔧 Ship Maintenance Fee">
          <span className="font-bold">{maintCost} Gold</span>
        </BillRow>
        {game.maintenancePenalty > 0 && (
          <div className="text-[11px] text-muted-foreground pl-2.5">
            ↳ Base {game.fixedCost}g + {cardName("overdrive_engine")} penalty{" "}
            {game.maintenancePenalty}g
          </div>
        )}
        <BillRow
          size="text-sm"
          className="border-t border-due/20 pt-1.5 mt-1.5 font-bold"
          label="💸 Total Due"
        >
          <span className="text-due">{totalDue} Gold</span>
        </BillRow>
      </div>

      <div className="rounded-xl bg-resolve/[0.03] border border-resolve/15 p-3.5 my-3.5">
        <h3 className="font-semibold mb-2">💹 Balance Summary</h3>
        <BillRow label="Current Funds">
          <span className="text-gain font-bold">{game.money} Gold</span>
        </BillRow>
        <BillRow label="After Settlement">
          <span
            className={cn(
              "font-bold",
              balanceAfter >= 0 ? "text-gain" : "text-alarm",
            )}
          >
            {balanceAfter} Gold
          </span>
        </BillRow>
        <BillRow label="Round Revenue">
          <span className="text-gain">+{game.roundRevenue} Gold</span>
        </BillRow>
      </div>

      <HarborAid
        game={game}
        aid={aid}
        myUserId={myUserId}
        shortfall={shortfall}
        canAfford={canAfford}
        alone={members.length <= 1}
      />

      <LoanBacking game={game} backing={backing} myUserId={myUserId} />

      {backing.error && (
        <PhaseError
          message={backing.error}
          onDismiss={backing.clearError}
          className="mb-3.5"
        />
      )}

      {aid.error && (
        <PhaseError
          message={aid.error}
          onDismiss={aid.clearError}
          className="mb-3.5"
        />
      )}

      <ReadyFooter
        phaseSync={phaseSync}
        members={members}
        idleLabel={
          <>
            {settleIcon}
            <span className="ml-1.5">{settleLabel}</span>
          </>
        }
        idleClassName={settleClassName}
        onConfirm={() => phaseSync.markReady((g, l) => leavePhase(g, ctx, l))}
      />
    </div>
  );
}
