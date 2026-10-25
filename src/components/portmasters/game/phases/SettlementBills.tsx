"use client";

import { cardName } from "@/lib/game/cards";
import {
  leavePhase,
  maintenanceDue,
  wageBill,
  wagesDue,
} from "@/lib/game/engine";
import { listJoiner, t } from "@/lib/game/i18n";
import { crewSize } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { PhaseHeading, ReadyFooter, type PhasePanelProps } from "./PhaseShared";
import { Notice } from "../../shared";
import { HarborAid } from "./SettlementAid";
import { LoanBacking } from "./SettlementBacking";
import { LedgerRow } from "../status/Rows";

// One line of a bill: a name on the left and a figure on the right, in the
// size that section prints. The settle screen had six of these written out
// by hand, three of them in the same block, and they are the ledger line
// the Ship and Dues tabs draw (see LedgerRow), so the bill borrows it
// rather than keeping a second one of its own.
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
    <LedgerRow size={size} className={className} label={label}>
      {children}
    </LedgerRow>
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
  const nWorkers = crewSize(game);
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
  // they confirm. The two wear different colors so the consequence shows
  // before the label is read: the settlement fill for the calm one, and
  // the alarm red for the one that cannot be taken back and must not be
  // tapped by reflex.
  const settleLabel = canAfford
    ? t("💸 Settle Bills: {totalDue} Gold", { totalDue })
    : t("Force Payment and Risk Bankruptcy ({money}/{totalDue} Gold)", {
        money: game.money,
        totalDue,
      });
  const settleClassName = canAfford
    ? "pm-grad-resolve h-12 px-8"
    : "bg-alarm text-background h-12 px-8 font-semibold";
  const settleIcon = canAfford ? null : <AlertTriangle className="h-4 w-4" />;

  return (
    <div className="max-w-2xl mx-auto">
      <PhaseHeading layout="text-center mb-4" tone="text-resolve" brush>
        {t("💸 Resolve: Round Settlement")}
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
            ? t("🛡️ Escort hired, you sailed through safely this round.")
            : t("🌊 You sailed without an escort this round.")}
        </div>
      )}

      <div className="rounded-xl bg-due/[0.06] border border-due/20 p-3.5 my-3.5">
        <h3 className="font-semibold text-due mb-2">
          {t("⏳ Bills Due This Round")}
        </h3>
        <BillRow
          label={t("👥 Artisan Wages ({count} artisan{pluralS})", {
            count: nWorkers,
            pluralS: nWorkers !== 1 ? "s" : "",
          })}
        >
          <span className="font-bold">
            {t("{contract.fee} Gold", { "contract.fee": wages })}
          </span>
        </BillRow>
        {sponsored > 0 && (
          // Why the figure above is lower than the roster times the trades'
          // wages: the pledge the engine will spend a breath later, named
          // in the engine's own shape so the sheet and the log line that
          // replaces it tell one story. The frame reads through the pack as
          // one sentence, with the sponsored hands handed in as the joined
          // list its {items} token names.
          <div className="text-[11px] text-muted-foreground pl-2.5">
            {t("↳ 🪷 Jade Pavilion covers the wage for {items} this round", {
              items: bill
                .filter((b) => b.sponsored > 0)
                .map((b) =>
                  t("{b.sponsored} {bLabel}", {
                    "b.sponsored": b.sponsored,
                    bLabel: t(b.sponsored === 1 ? b.label : b.plural),
                  }),
                )
                .join(listJoiner()),
            })}
          </div>
        )}
        <BillRow size="text-sm" label={t("🔧 Ship Maintenance Fee")}>
          <span className="font-bold">
            {t("{contract.fee} Gold", { "contract.fee": maintCost })}
          </span>
        </BillRow>
        {(game.modifierFlags.voyage_dues_discount ?? 0) > 0 && (
          <div className="text-[11px] text-muted-foreground pl-2.5">
            {t(
              "↳ {card} halves the Dues this round: wages and maintenance both",
              {
                card: cardName("quiet_account"),
              },
            )}
          </div>
        )}
        {game.maintenancePenalty > 0 && (
          <div className="text-[11px] text-muted-foreground pl-2.5">
            {t("↳ Base {base} Gold + {card} penalty {penalty} Gold", {
              base: game.fixedCost,
              card: cardName("overdrive_engine"),
              penalty: game.maintenancePenalty,
            })}
          </div>
        )}
        <BillRow
          size="text-sm"
          className="border-t border-due/20 pt-1.5 mt-1.5 font-bold"
          label={t("💸 Total Due")}
        >
          <span className="text-due">
            {t("{contract.fee} Gold", { "contract.fee": totalDue })}
          </span>
        </BillRow>
      </div>

      <div className="rounded-xl bg-resolve/[0.03] border border-resolve/15 p-3.5 my-3.5">
        <h3 className="font-semibold mb-2">{t("💹 Balance Summary")}</h3>
        <BillRow label={t("Current Gold")}>
          <span className="text-gain font-bold">
            {t("{contract.fee} Gold", { "contract.fee": game.money })}
          </span>
        </BillRow>
        <BillRow label={t("After Settlement")}>
          <span
            className={cn(
              "font-bold",
              balanceAfter >= 0 ? "text-gain" : "text-alarm",
            )}
          >
            {t("{contract.fee} Gold", { "contract.fee": balanceAfter })}
          </span>
        </BillRow>
        <BillRow label={t("Round Revenue")}>
          <span className="text-gain">
            {t("+{amount} Gold", { amount: game.roundRevenue })}
          </span>
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
        <Notice
          message={backing.error}
          onDismiss={backing.clearError}
          className="mb-3.5"
          size="sm"
        />
      )}

      {aid.error && (
        <Notice
          message={aid.error}
          onDismiss={aid.clearError}
          className="mb-3.5"
          size="sm"
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
