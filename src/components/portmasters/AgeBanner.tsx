"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, TrendingUp, Handshake, Coins } from "lucide-react";
import { useAges } from "@/lib/use-ages";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { Age, AgeId } from "@/lib/game/engine";
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
  gradient: string;
  icon: typeof TrendingUp;
};

const AGE_VISUALS: Record<AgeId, AgeVisual> = {
  lender: {
    gradient: "pm-grad-jade",
    icon: Handshake,
  },
  trader: {
    gradient: "pm-grad-gold",
    icon: TrendingUp,
  },
  broker: {
    gradient: "pm-grad-violet",
    icon: Coins,
  },
};

// How long the Age still holds, in the plainest words that stay true.
//
// The figure is read once when the banner mounts and does not tick, which
// is the same trade the Ages hook already makes for a fortnight long
// cycle. The phrasing below is chosen so a stale figure still reads
// honestly: below two days it shows exact hours, and above that the days
// are rounded, so the coarseness never shows at the scale anyone reads it.
function remainingLabel(until: Date): string {
  const ms = until.getTime() - Date.now();
  if (ms <= 0) return "handing over now";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "under an hour remaining";
  if (hours < 48) return `${hours} ${hours === 1 ? "hour" : "hours"} remaining`;
  // Two days or more, so the plural is the only form this can take.
  return `${Math.round(ms / 86_400_000)} days remaining`;
}

export function AgeBanner({
  variant = "pill",
  className,
}: {
  variant?: "pill" | "full";
  className?: string;
}) {
  const { age, nextChange } = useAges();
  const [expanded, setExpanded] = useState(false);
  const visual = AGE_VISUALS[age.id];
  const Icon = visual.icon;

  if (variant === "full") {
    return (
      <div className={cn("pm-glass pm-crackle rounded-2xl p-4", className)}>
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white",
              visual.gradient,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold pm-text-sea">
                {age.name}
              </h3>
              <span className="text-[10px] text-muted-foreground">
                {remainingLabel(nextChange)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {age.description}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className={cn(
          "pm-pressable inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white",
          visual.gradient,
          className,
        )}
        title={`${age.name}. ${age.description}`}
        aria-label={`Current age: ${age.name}. Click for details.`}
      >
        <Sparkles className="h-3 w-3" />
        <span className="hidden sm:inline">{age.name}</span>
        <span className="sm:hidden">
          {age.id.charAt(0).toUpperCase() + age.id.slice(1)}
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
    <ModalOverlay onClose={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="pm-glass-strong pm-crackle relative z-10 w-full max-w-md overflow-hidden rounded-3xl p-6"
      >
        <div className="pm-seigaiha absolute inset-0 opacity-20 pointer-events-none" />
        <div className="relative">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl text-white",
                  visual.gradient,
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold pm-text-sea">
                  {age.name}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  The harbor leans this way for a fortnight
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="pm-pressable rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close age details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {age.description}
          </p>
          <div className="mt-4 rounded-xl bg-black/5 p-3 dark:bg-white/5">
            <p className="text-xs text-muted-foreground">
              Every captain in every harbor shares the same Age at the same
              moment. The rotation cycles through the Lender, the Trader, and
              the Broker every two weeks, then repeats. An Age only shifts the
              weight of one already legal action, never the rules, which keeps a
              voyage that began under one Age from unbalancing when the next
              takes over.
            </p>
          </div>
        </div>
      </motion.div>
    </ModalOverlay>
  );
}
