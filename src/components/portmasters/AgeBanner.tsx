"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Sparkles, TrendingUp, Handshake, Coins } from "lucide-react";
import {
  ModalCard,
  ModalClose,
  ModalOverlay,
} from "@/components/ui/modal-overlay";
import { currentAge, type Age, type AgeId } from "@/lib/game/engine";
import { t } from "@/lib/game/i18n";
import { cn } from "@/lib/utils";

/**
 * The Ages of the Ledger banner. Surfaces the current Age so captains
 * know which peer economy bonus is active across the whole harbor.
 *
 * Three Ages rotate every two weeks: the Lender (extra Renown for
 * backing), the Trader (extra Reputation per barter), the Broker
 * (raised Broker's Favor cap). Every captain in every harbor shares the
 * same Age at the same moment.
 *
 * Renders as a compact pill that expands into a full explanation on
 * click. The pill uses a distinct gradient per Age so the active bonus
 * is readable at a glance.
 */
type AgeVisual = {
  /** The filled form, for the pill and the seal. */
  gradient: string;
  /** The same color as text, for the headings in the banner and dialog. */
  ink: string;
  icon: typeof TrendingUp;
};

const AGE_VISUALS: Record<AgeId, AgeVisual> = {
  lender: {
    gradient: "pm-grad-age-lender",
    ink: "text-age-lender",
    icon: Handshake,
  },
  trader: {
    gradient: "pm-grad-age-trader",
    ink: "text-age-trader",
    icon: TrendingUp,
  },
  broker: {
    gradient: "pm-grad-age-broker",
    ink: "text-age-broker",
    icon: Coins,
  },
};

export function AgeBanner({ className }: { className?: string }) {
  // The Age is computed once per mount from a single clock read, and does not
  // tick: a tab left open across the fortnight boundary keeps the Age it
  // mounted with until the next navigation. That is plenty for a two week
  // cycle, and it means every captain sharing a moment reads the same Age off
  // the same shared clock.
  const age = useMemo(() => currentAge(new Date()), []);
  const [expanded, setExpanded] = useState(false);
  const visual = AGE_VISUALS[age.id];

  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className={cn(
          "pm-pressable inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
          visual.gradient,
          className,
        )}
        title={t("{age.name}. {age.description}", {
          "age.name": t(age.name),
          "age.description": t(age.description),
        })}
        aria-label={t("Current age: {age.name}. Click for details.", {
          "age.name": t(age.name),
        })}
      >
        <Sparkles className="h-3 w-3" />
        <span className="hidden sm:inline">{t(age.name)}</span>
        {/* Below sm there is no room for the full Age name, so the pill
            prints the age's own short word, read through the pack like
            the long form beside it. */}
        <span className="sm:hidden">
          {t(age.id.charAt(0).toUpperCase() + age.id.slice(1))}
        </span>
      </button>
      <AnimatePresence>
        {expanded && (
          <AgeDetailDialog
            age={age}
            visual={visual}
            onClose={() => setExpanded(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function AgeDetailDialog({
  age,
  visual,
  onClose,
}: {
  age: Age;
  visual: AgeVisual;
  onClose: () => void;
}) {
  const Icon = visual.icon;
  return (
    <ModalOverlay
      label={t("Age details: {name}", { name: t(age.name) })}
      onClose={onClose}
    >
      <ModalCard>
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl",
                visual.gradient,
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h2 className={cn("font-display text-lg font-bold", visual.ink)}>
                {t(age.name)}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {t("The harbor leans this way for a fortnight")}
              </p>
            </div>
          </div>
          <ModalClose label={t("Close age details")} onClick={onClose} />
        </div>
        <p className="text-sm leading-relaxed text-foreground">
          {t(age.description)}
        </p>
        <div className="mt-4 rounded-xl bg-black/5 p-3 dark:bg-white/5">
          <p className="text-xs text-muted-foreground">
            {t(
              "Every captain in every harbor shares the same Age at the same moment. The rotation cycles through the Lender, the Trader, and the Broker every two weeks, then repeats. An Age only shifts the weight of one already legal action, never the rules, which keeps a voyage that began under one Age from unbalancing when the next takes over.",
            )}
          </p>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
