"use client";

// =====================================================================
// [B3: standing orders] The form a captain writes once.
//
// The record it edits and the evaluation that reads it are both engine
// side (src/lib/game/standing.ts and src/lib/game/engine/standing.ts),
// so this file holds no rule of its own: every control here sets one
// field of the record, and the record is committed through the caller's
// own act() the moment it changes, which is what keeps the screen and
// the voyage from ever disagreeing. There is no Save button for the
// reason there is nothing to save: what the captain sees is already what
// the engine will read.
//
// Two consequences of that are worth naming, because both are visible.
// A change lands on a voyage that is already sailing, so a captain can
// write an order in the Market and watch it work in the same phase. And
// an unsaved edit cannot exist, so closing the dialog is not a decision.
// =====================================================================

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollText } from "lucide-react";
import { ICONS } from "@/lib/game/constants/brand";
import { cardText } from "@/lib/game/cards";
import { basePriceRange } from "@/lib/game/engine";
import {
  unlockedBoons,
  unlockedProducts,
  unlockedResources,
} from "@/lib/game/pools";
import { standingBoon, type StandingOrders } from "@/lib/game/standing";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";

/**
 * What the books list as the dearest this good ever runs at, which is
 * what a captain who has not thought about a price yet is offered rather
 * than an empty box. It is the catalogue's own ceiling and not the
 * board's: the board changes every round, and a number that moved under
 * a captain while they were not looking would be a worse default than a
 * number they can see the source of.
 */
function bookCeiling(good: string): number {
  const range = basePriceRange(good);
  return range ? range[1] : 0;
}

/**
 * One switch and its name, with a hint only where the row's own order
 * says something its section's hint does not. The section owns the
 * explanation, so a row prints a hint only when it differs from the
 * section's own sentence, and the panel stays light.
 */
function OrderRow({
  title,
  hint,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border border-black/10 bg-background/40 p-2.5 dark:border-white/10",
        disabled && "opacity-60",
      )}
    >
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium">{title}</p>
        {hint && (
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        aria-label={title}
        onCheckedChange={onChange}
      />
    </div>
  );
}

/** One section of the form: what it is, what it does, and its controls. */
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-standing">
          {title}
        </h3>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {hint}
        </p>
      </div>
      {children}
    </section>
  );
}

/** One boon a captain may name, drawn beside the board's own first offer. */
function BoonOption({
  icon,
  name,
  desc,
  active,
  disabled,
  onClick,
}: {
  icon: string;
  name: string;
  desc: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-start gap-2 rounded-lg border p-2 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed",
        active
          ? "border-standing/50 bg-standing/[0.07]"
          : "border-black/10 bg-background/40 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]",
        disabled && "opacity-60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[13px]",
          active ? "pm-grad-standing" : "bg-black/5 dark:bg-white/10",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-[12px] font-medium",
            active && "text-standing",
          )}
        >
          {name}
        </span>
        <span className="mt-0.5 block text-[10.5px] leading-snug text-muted-foreground">
          {desc}
        </span>
      </span>
    </button>
  );
}

/**
 * One good, whether the captain buys it, and the dearest they will pay.
 *
 * The price is held as text while it is being typed and handed to the
 * record on every keystroke that is a number, so a captain can clear the
 * box and retype it without the record ever holding a value the box is
 * not showing. Leaving the box drops the text and the record answers
 * again, which is what puts the floor and the rounding back on screen.
 */
function BuyRow({
  good,
  ceiling,
  disabled,
  onToggle,
  onCeiling,
}: {
  good: string;
  ceiling: number | null;
  disabled?: boolean;
  onToggle: () => void;
  onCeiling: (next: number) => void;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const on = ceiling !== null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-black/10 bg-background/40 px-2 py-1.5 dark:border-white/10",
        on && "border-standing/40 bg-standing/[0.05]",
        disabled && "opacity-60",
      )}
    >
      <button
        type="button"
        aria-pressed={on}
        disabled={disabled}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-2 rounded text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed"
      >
        <span
          aria-hidden
          className={cn(
            "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border text-[10px] leading-none",
            on
              ? "border-standing/50 bg-standing/15 text-standing"
              : "border-black/15 text-transparent dark:border-white/15",
          )}
        >
          ✓
        </span>
        <span className="truncate text-[12.5px]">
          {ICONS[good]} {good}
        </span>
      </button>
      {on && (
        <>
          <Input
            inputMode="numeric"
            aria-label={`Dearest you will pay for ${good}`}
            disabled={disabled}
            value={typed ?? String(ceiling)}
            onChange={(e) => {
              setTyped(e.target.value);
              const next = Number(e.target.value);
              if (e.target.value.trim() && Number.isFinite(next) && next >= 0) {
                onCeiling(Math.floor(next));
              }
            }}
            onBlur={() => setTyped(null)}
            className="h-7 w-16 px-1.5 text-right text-[12px]"
          />
          <span className="text-[10px] text-muted-foreground">gold</span>
        </>
      )}
    </div>
  );
}

export function StandingOrdersModal({
  open,
  onOpenChange,
  game,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  game: GameState;
  onChange: (next: StandingOrders) => void;
}) {
  const orders = game.standingOrders;
  const boons = unlockedBoons(game.difficulty, game.currentRound);
  // What the written name resolves to, which is what the engine will act
  // on rather than what the record literally holds. A name the tree no
  // longer ships resolves to nothing, and the panel says so by lighting
  // the board's first offer: the screen and the seat agree that an
  // unresolvable name is not an instruction, instead of the screen showing
  // an empty form over a record that still contains something.
  const written = standingBoon(orders);
  const raw = unlockedResources(game.difficulty, game.currentRound);
  const finished = unlockedProducts(game.difficulty, game.currentRound);
  const off = !orders.enabled;

  const set = (patch: Partial<StandingOrders>) =>
    onChange({ ...orders, ...patch });

  function toggleGood(good: string) {
    if (orders.buy.some((b) => b.good === good)) {
      set({ buy: orders.buy.filter((b) => b.good !== good) });
    } else {
      set({ buy: [...orders.buy, { good, maxPrice: bookCeiling(good) }] });
    }
  }

  function setCeiling(good: string, maxPrice: number) {
    set({
      buy: orders.buy.map((b) => (b.good === good ? { ...b, maxPrice } : b)),
    });
  }

  const goodRow = (good: string) => (
    <BuyRow
      key={good}
      good={good}
      disabled={off}
      ceiling={orders.buy.find((b) => b.good === good)?.maxPrice ?? null}
      onToggle={() => toggleGood(good)}
      onCeiling={(next) => setCeiling(good, next)}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              aria-hidden
              className="pm-grad-standing flex h-7 w-7 items-center justify-center rounded-lg"
            >
              <ScrollText className="h-4 w-4 text-white" />
            </span>
            Standing orders
          </DialogTitle>
          <DialogDescription className="sr-only">
            Instructions your seat follows when the room&apos;s clock plays it
            while you are not standing at it.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-4 overflow-y-auto pm-scroll pr-1">
          <OrderRow
            title="Follow these orders"
            hint="When the room's clock runs a phase out and you have not acted, your seat is played by what is written here instead of by the engine's own defaults. Turn this off and every seat goes back to being played the way it was before this panel existed. Nothing written below is lost either way."
            checked={orders.enabled}
            onChange={(next) => set({ enabled: next })}
          />

          <Section
            title="Dawn"
            hint="Which boon to take when the draft is settled for you. A boon that is not on your board that round is passed over, so a name written here is never a promise the draft cannot keep."
          >
            <div className="grid gap-1.5 sm:grid-cols-2">
              <BoonOption
                icon="1️⃣"
                name="First offer on the board"
                desc="Whatever the draft laid down first, which is what an absent captain is given today."
                active={written === null}
                disabled={off}
                onClick={() => set({ boon: null })}
              />
              {boons.map((card) => {
                // [F2: the card record, and the mode weighting field] The
                // three strings come off the record through cardText, so the
                // row this panel draws and the card the draft deals are one
                // card described once.
                const text = cardText(card);
                return (
                  <BoonOption
                    key={card.id}
                    icon={card.icon}
                    name={text.name}
                    desc={text.desc}
                    active={written?.id === card.id}
                    disabled={off}
                    onClick={() => set({ boon: card.id })}
                  />
                );
              })}
            </div>
          </Section>

          <Section
            title="Market"
            hint="Each good you mark is bought from the purchase board whenever every good on that card is at or under the price you set, in the order the board is laid out. Anything dearer is left on the board."
          >
            <div className="space-y-1.5">
              {raw.map(goodRow)}
              {finished.map(goodRow)}
            </div>
          </Section>

          <Section
            title="Orders"
            hint="The trade board, filled the way a captain would fill it: only what the hold can actually cover, in the order the orders are laid out, and left alone when the hold cannot cover it. Nothing is bought to complete an order, so one your hold cannot pay for in goods is skipped rather than chased."
          >
            <OrderRow
              title="Fill every order the hold can cover"
              checked={orders.fill === "all"}
              disabled={off}
              onChange={(next) => set({ fill: next ? "all" : "none" })}
            />
          </Section>

          <Section
            title="Dusk"
            hint="The shipyard's one standing choice: the next ship level, bought the moment the shipyard opens if the purse covers it. The purse and the hull's own ceiling are checked by the engine, so an order to upgrade that cannot be paid for simply does nothing."
          >
            <OrderRow
              title="Upgrade the hull when you can afford it"
              checked={orders.shipyard === "upgrade"}
              disabled={off}
              onChange={(next) =>
                set({ shipyard: next ? "upgrade" : "continue" })
              }
            />
          </Section>

          <p className="text-[11px] leading-snug text-muted-foreground">
            Three seats are deliberately not here. Parley is a conversation with
            a captain, which is not something a form can answer. The module
            draft is rolled fresh every round, so there is no honest way to name
            one ahead of it. And the Broker&apos;s Favor is a decision rather
            than a default, so it is left for you to spend.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">
            Kept with this voyage, and the table does not see it.
          </span>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
