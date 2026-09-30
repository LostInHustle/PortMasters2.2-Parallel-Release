"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/quantity-input";
import { PRODUCTS, RESOURCES } from "@/lib/game/constants/goods";
import { BROKERS_FAVOR_UNLOCK_LEVEL } from "@/lib/game/constants/world";
import { callBrokersFavor } from "@/lib/game/engine";
import { useLiveAmount } from "@/lib/use-live-amount";
import { ItemIcon } from "../../shared";
import { type PhasePanelProps } from "./PhaseShared";

/**
 * The Broker's Favor, drawn above the manifest: the offer while it is
 * unspent, the picker, the ask, and the call itself. It owns the draft
 * (which good, how much) because nothing outside this widget reads any of
 * it, and it draws nothing at all once the voyage's one favor is spent.
 */
export function BrokerFavor({
  game,
  act,
}: Pick<PhasePanelProps, "game" | "act">) {
  const [favorOpen, setFavorOpen] = useState(false);
  const [favorItem, setFavorItem] = useState<string | null>(null);
  const favorUnlocked = game.renownLevel >= BROKERS_FAVOR_UNLOCK_LEVEL;
  const sellableGoods = [...RESOURCES, ...PRODUCTS].filter(
    (it) => (game.inventory[it] || 0) > 0,
  );
  const favorHeld = favorItem ? game.inventory[favorItem] || 0 : 0;
  // The ask follows the live hold rather than a figure captured when the good
  // was picked, and both directions matter. A trade can land while this panel
  // is open and either half of one moves goods: posting an offer escrows the
  // offered side out of the hold at once, and an accepted trade takes the
  // requested side out and puts the offered side in. So the hold can shrink
  // under a figure the captain can no longer deliver, or grow past one they
  // picked when it was all they had, and the second case is the one a captain
  // actually wants back: goods arriving should widen what the Broker can sell.
  // The clamp is what keeps the ask inside the hold, which is the range
  // callBrokersFavor insists on. See useLiveAmount for why the panel settles
  // that rather than leaving the engine to refuse it.
  const {
    value: favorAsk,
    commit: commitFavorAsk,
    reset: resetFavorAsk,
  } = useLiveAmount(favorHeld, true);
  const closeFavor = () => {
    setFavorOpen(false);
    setFavorItem(null);
  };
  return (
    <>
      {!favorUnlocked && (
        <div className="rounded-lg border border-dashed border-favor/25 bg-favor/[0.04] px-3.5 py-2.5 mb-3.5 text-xs text-muted-foreground">
          🔒 <strong className="text-foreground">Broker&apos;s Favor</strong>{" "}
          unlocks at Renown Level {BROKERS_FAVOR_UNLOCK_LEVEL}: call one in once
          per voyage to summon a guaranteed buyer for a good already in your
          hold. You are Renown Level {game.renownLevel} now,{" "}
          {BROKERS_FAVOR_UNLOCK_LEVEL - game.renownLevel} to go.
        </div>
      )}
      {favorUnlocked && !game.brokersFavorUsed && (
        <div className="rounded-lg border border-favor/30 bg-favor/[0.07] px-3.5 py-2.5 mb-3.5 text-xs">
          {!favorOpen ? (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span>
                <strong>🤝 Broker&apos;s Favor</strong> (once per voyage):
                summon a guaranteed buyer for as much of a good as you choose
                from your hold. The bigger the ask, the bigger the Broker&apos;s
                cut.
              </span>
              <Button
                size="sm"
                className="pm-grad-orders font-semibold rounded-lg shrink-0"
                onClick={() => setFavorOpen(true)}
              >
                Call in a Favor
              </Button>
            </div>
          ) : !favorItem ? (
            <div className="space-y-2">
              <div className="font-semibold">🤝 Which good needs a buyer?</div>
              {sellableGoods.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {sellableGoods.map((it) => (
                    <Button
                      key={it}
                      size="sm"
                      variant="secondary"
                      className="rounded-lg"
                      onClick={() => {
                        setFavorItem(it);
                        resetFavorAsk();
                      }}
                    >
                      <ItemIcon item={it} className="h-3.5 w-3.5" /> {it} (
                      {game.inventory[it]})
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground">
                  Your hold is empty, so there is nothing for the Broker to sell
                  right now.
                </div>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="rounded-lg"
                onClick={closeFavor}
              >
                Cancel
              </Button>
            </div>
          ) : favorHeld <= 0 ? (
            // The good left the hold while this panel was open. Sending the
            // captain back to the picker is the honest answer here: the
            // alternative is a quantity field with no valid number left in it
            // and a button that can only refuse.
            <div className="space-y-2">
              <div className="font-semibold">
                <ItemIcon item={favorItem} className="h-4 w-4" /> No {favorItem}{" "}
                left in your hold
              </div>
              <p className="text-muted-foreground">
                Your hold changed while this was open, so there is nothing here
                for the Broker to sell now. Pick another good, or call the Favor
                in later this voyage.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-lg"
                  onClick={() => setFavorItem(null)}
                >
                  Pick another good
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-lg"
                  onClick={closeFavor}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="font-semibold">
                <ItemIcon item={favorItem} className="h-4 w-4" /> How much{" "}
                {favorItem} should the Broker sell?
              </div>
              <div className="flex items-center gap-2">
                <QuantityInput
                  value={favorAsk}
                  onCommit={commitFavorAsk}
                  min={1}
                  max={favorHeld}
                  aria-label={`How much ${favorItem} to sell`}
                  className="w-20 h-9"
                />
                <span className="text-muted-foreground">
                  of {favorHeld} in your hold
                </span>
              </div>
              <p className="text-muted-foreground">
                A bigger ask pays out more, but the Broker&apos;s cut grows with
                it too, so a single favor can never swing the whole voyage.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="pm-grad-orders font-semibold rounded-lg"
                  onClick={() => {
                    act((g, l) => callBrokersFavor(g, favorItem, favorAsk, l));
                    closeFavor();
                  }}
                >
                  Call in the Favor
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-lg"
                  onClick={() => setFavorItem(null)}
                >
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
