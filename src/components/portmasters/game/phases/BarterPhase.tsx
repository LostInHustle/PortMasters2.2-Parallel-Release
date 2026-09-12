"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/quantity-input";
import { BARTER_ITEMS, ICONS } from "@/lib/game/constants";
import {
  completeBarterPhase,
  getOwnedAmount,
  postBarterOffer,
  refundBarterOffer,
} from "@/lib/game/engine";
import { cn } from "@/lib/utils";
import { itemColorResolver } from "@/lib/use-color-preference";
import { Handshake, X } from "lucide-react";
import type { BarterOffer } from "@/lib/use-barter";
import { Term } from "../../Term";
import { ItemIcon } from "../../shared";
import { ReadyFooter, type PhasePanelProps } from "./PhaseShared";

export function BarterPhase({
  game,
  act,
  barter,
  phaseSync,
  members,
  colorFor,
  me,
}: Pick<
  PhasePanelProps,
  "game" | "act" | "barter" | "phaseSync" | "members" | "colorFor" | "me"
>) {
  // myUserId is derived from the authenticated captain (PhasePanelProps.me)
  // rather than threaded as its own prop, so the dispatcher only has to
  // forward the shared props shape.
  const myUserId = me.id;
  const resolveColor = itemColorResolver(colorFor);
  const items = BARTER_ITEMS as readonly string[];
  const [offerItem, setOfferItem] = useState<string>("Hemp");
  const [offerAmount, setOfferAmount] = useState(1);
  const [requestItem, setRequestItem] = useState<string>("Gold");
  const [requestAmount, setRequestAmount] = useState(1);
  // "" means an ordinary open offer, anyone in the harbor can see and
  // accept it. Any other value is another captain's user id: a direct
  // offer, visible only to the two of us, a safeguard against a third
  // captain accepting a trade someone else already agreed to first.
  const [targetUserId, setTargetUserId] = useState("");

  const owned = getOwnedAmount(game, offerItem);
  const sameItem = offerItem === requestItem;
  const validAmounts =
    Number.isInteger(offerAmount) &&
    offerAmount >= 1 &&
    Number.isInteger(requestAmount) &&
    requestAmount >= 1;
  const canPost = !sameItem && validAmounts && offerAmount <= owned;
  const otherMembers = members.filter((m) => m.id !== myUserId);

  function submitOffer() {
    if (!canPost) return;
    act((g, l) => {
      postBarterOffer(g, offerItem, offerAmount, requestItem, requestAmount, l);
    });
    barter.post(
      offerItem,
      offerAmount,
      requestItem,
      requestAmount,
      targetUserId || undefined,
    );
    setOfferAmount(1);
    setRequestAmount(1);
    setTargetUserId("");
  }

  function cancelOffer(o: BarterOffer) {
    act((g, l) => {
      refundBarterOffer(g, o.offerItem, o.offerAmount, l);
    });
    barter.cancel(o.id);
  }

  const selectClass =
    "h-9 rounded-md border border-input bg-transparent px-2 text-sm";

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <Handshake className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <Term term="Barter">Captain's Exchange</Term>
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Short on one good and sitting on too much of another? Post a swap for
        the rest of the harbor to see, or take someone else's.
      </p>

      <div className="rounded-xl border border-teal-500/15 bg-teal-500/[0.03] p-4 mb-4">
        <h3 className="text-center font-semibold mb-3 text-sm">
          📤 Post an Offer
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">I'll give</span>
          <QuantityInput
            value={offerAmount}
            onCommit={setOfferAmount}
            min={1}
            aria-label="Amount to offer"
            className="w-16 h-9"
          />
          <select
            value={offerItem}
            onChange={(e) => setOfferItem(e.target.value)}
            className={selectClass}
          >
            {items.map((it) => (
              <option key={it} value={it}>
                {ICONS[it]} {it}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">for</span>
          <QuantityInput
            value={requestAmount}
            onCommit={setRequestAmount}
            min={1}
            aria-label="Amount to request"
            className="w-16 h-9"
          />
          <select
            value={requestItem}
            onChange={(e) => setRequestItem(e.target.value)}
            className={selectClass}
          >
            {items.map((it) => (
              <option key={it} value={it}>
                {ICONS[it]} {it}
              </option>
            ))}
          </select>
          <Button
            className={cn("rounded-lg", canPost && "pm-grad-jade text-white")}
            variant={canPost ? "default" : "secondary"}
            disabled={!canPost}
            onClick={submitOffer}
          >
            🤝 Post Offer
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm mt-2">
          <span className="text-muted-foreground">With</span>
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className={selectClass}
            aria-label="Direct this offer to a specific captain"
          >
            <option value="">🌊 Anyone in the harbor</option>
            {otherMembers.map((m) => (
              <option key={m.id} value={m.id}>
                🔒 {m.displayName} only
              </option>
            ))}
          </select>
        </div>
        {targetUserId && (
          <p className="text-center text-[11px] text-muted-foreground mt-1.5">
            Only {otherMembers.find((m) => m.id === targetUserId)?.displayName}{" "}
            will see this offer. A safeguard so nobody else can take it first.
          </p>
        )}
        {sameItem && (
          <p className="text-center text-[11px] text-rose-600 dark:text-rose-400 mt-2">
            Pick two different items to barter.
          </p>
        )}
        {!sameItem && offerAmount > owned && (
          <p className="text-center text-[11px] text-rose-600 dark:text-rose-400 mt-2">
            You only have {owned} {offerItem}.
          </p>
        )}
      </div>

      {barter.error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 px-3.5 py-2 mb-4 text-xs text-rose-600 dark:text-rose-300 flex items-center justify-between">
          <span>⚠️ {barter.error}</span>
          <button onClick={barter.clearError} aria-label="Dismiss error">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-background/50 p-4 mb-4">
        <h3 className="text-center font-semibold mb-3 text-sm">
          📋 Open Offers
        </h3>
        {barter.offers.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">
            No offers on the board yet. Be the first.
          </p>
        ) : (
          <div className="space-y-1.5">
            {barter.offers.map((o) => {
              const mine = o.fromUserId === myUserId;
              const canAfford =
                getOwnedAmount(game, o.requestItem) >= o.requestAmount;
              const isDirect = Boolean(o.targetUserId);
              return (
                <div
                  key={o.id}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2 text-xs border gap-2",
                    mine
                      ? "bg-amber-500/[0.06] border-amber-500/20"
                      : isDirect
                        ? "bg-teal-500/[0.06] border-teal-500/25"
                        : "bg-background/60 border-black/5 dark:border-white/10",
                  )}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium">
                      {mine ? "You" : o.fromName}
                    </span>
                    <span className="text-muted-foreground">offer</span>
                    <span style={{ color: resolveColor(o.offerItem) }}>
                      <ItemIcon item={o.offerItem} className="h-3.5 w-3.5" />{" "}
                      {o.offerAmount} {o.offerItem}
                    </span>
                    <span className="text-muted-foreground">for</span>
                    <span style={{ color: resolveColor(o.requestItem) }}>
                      <ItemIcon item={o.requestItem} className="h-3.5 w-3.5" />{" "}
                      {o.requestAmount} {o.requestItem}
                    </span>
                    {isDirect && (
                      <span className="rounded-full bg-teal-500/15 px-1.5 py-0.5 text-[9px] font-medium text-teal-700 dark:text-teal-300">
                        🔒 {mine ? `Just for ${o.targetName}` : "Just for you"}
                      </span>
                    )}
                  </div>
                  {mine ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2.5 text-[10px] rounded shrink-0"
                      onClick={() => cancelOffer(o)}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className={cn(
                        "h-7 px-2.5 text-[10px] rounded shrink-0",
                        canAfford && "pm-grad-primary text-white",
                      )}
                      variant={canAfford ? "default" : "secondary"}
                      disabled={!canAfford}
                      onClick={() => barter.accept(o.id)}
                    >
                      🤝 Trade
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ReadyFooter
        phaseSync={phaseSync}
        members={members}
        idleLabel="✅ Done Bartering, Continue"
        onConfirm={() =>
          phaseSync.markReady((g, l) =>
            completeBarterPhase(g, barter.takeMyOpenRefunds(), l),
          )
        }
      />
    </div>
  );
}
