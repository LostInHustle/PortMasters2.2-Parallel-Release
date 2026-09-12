"use client";

// =====================================================================
// The trade surface that both a chat and the Bartering phase board use.
//
// There are two places a captain can compose a swap now: the Bartering
// phase panel, and the composer on either chat. The rules for what makes
// an offer legal cannot be allowed to differ between them, so they live
// once, in useOfferDraft, and each surface only supplies the markup
// around them.
//
// OfferCard is the same idea for reading an open offer. The board draws
// it as a row of the board, a chat draws it as a bubble in the
// conversation; the goods, the direct offer badge, and the accept or
// withdraw action are identical between the two and are written once.
//
// Both of these act on the shared board through useBarter, which is the
// only client side copy of what is still open. Nothing here decides when
// escrow comes back: withdrawing reports it to the hook, which is also
// what reports an offer the server swept, so there is exactly one route
// by which goods return to a hold.
// =====================================================================
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/quantity-input";
import { BARTER_ITEMS, ICONS } from "@/lib/game/constants";
import { getOwnedAmount, postBarterOffer } from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";
import type { PublicUser } from "@/lib/api";
import { itemColorResolver } from "@/lib/use-color-preference";
import type { BarterOffer } from "@/lib/use-barter";
import { cn } from "@/lib/utils";
import { ItemIcon } from "../shared";
import type { Barter } from "./phases/PhaseShared";

type Act = (fn: (g: GameState, logs: string[]) => void) => void;

// Shared by both composers, so the two cannot drift into disagreeing
// about what counts as postable. The amounts are held as plain numbers
// rather than as strings: QuantityInput commits a number, and the
// engine's own validation is expressed in numbers too.
export function useOfferDraft(
  game: GameState,
  barter: Barter,
  act: Act,
  fixedTargetId?: string,
) {
  const [offerItem, setOfferItem] = useState<string>("Hemp");
  const [offerAmount, setOfferAmount] = useState(1);
  const [requestItem, setRequestItem] = useState<string>("Gold");
  const [requestAmount, setRequestAmount] = useState(1);
  const [chosenTargetId, setChosenTargetId] = useState("");

  const owned = getOwnedAmount(game, offerItem);
  const sameItem = offerItem === requestItem;
  const validAmounts =
    Number.isInteger(offerAmount) &&
    offerAmount >= 1 &&
    Number.isInteger(requestAmount) &&
    requestAmount >= 1;
  const canPost = !sameItem && validAmounts && offerAmount <= owned;
  // A composer sitting inside a private thread is already addressed to the
  // captain in it, so there is nothing for that one to choose.
  const targetUserId = fixedTargetId ?? chosenTargetId;

  // Returns whether it actually posted, so a caller that wants to close
  // something on success can tell the two apart.
  function submit(): boolean {
    if (!canPost) return false;
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
    setChosenTargetId("");
    return true;
  }

  return {
    items: BARTER_ITEMS as readonly string[],
    offerItem,
    setOfferItem,
    offerAmount,
    setOfferAmount,
    requestItem,
    setRequestItem,
    requestAmount,
    setRequestAmount,
    targetUserId,
    setChosenTargetId,
    owned,
    sameItem,
    canPost,
    submit,
  };
}

export type OfferDraft = ReturnType<typeof useOfferDraft>;

// One open offer, as the Bartering board lists it and as a chat shows it.
// The caller supplies only the container, so the board keeps the compact
// row it has always drawn while a chat can wrap the same content in a
// bubble.
export function OfferCard({
  offer,
  me,
  game,
  barter,
  colorFor,
  className,
}: {
  offer: BarterOffer;
  me: PublicUser;
  game: GameState;
  barter: Barter;
  colorFor?: (item: string) => string | undefined;
  className?: string;
}) {
  const resolveColor = itemColorResolver(colorFor);
  const mine = offer.fromUserId === me.id;
  const canAfford =
    getOwnedAmount(game, offer.requestItem) >= offer.requestAmount;
  const isDirect = Boolean(offer.targetUserId);

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md px-3 py-2 text-xs border gap-2",
        mine
          ? "bg-due/[0.06] border-due/20"
          : isDirect
            ? "bg-sea/[0.06] border-sea/25"
            : "bg-background/60 border-black/5 dark:border-white/10",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-medium">{mine ? "You" : offer.fromName}</span>
        <span className="text-muted-foreground">offer</span>
        <span style={{ color: resolveColor(offer.offerItem) }}>
          <ItemIcon item={offer.offerItem} className="h-3.5 w-3.5" />{" "}
          {offer.offerAmount} {offer.offerItem}
        </span>
        <span className="text-muted-foreground">for</span>
        <span style={{ color: resolveColor(offer.requestItem) }}>
          <ItemIcon item={offer.requestItem} className="h-3.5 w-3.5" />{" "}
          {offer.requestAmount} {offer.requestItem}
        </span>
        {isDirect && (
          <span className="rounded-full bg-sea/5 px-1.5 py-0.5 text-[9px] font-medium text-sea">
            🔒 {mine ? `Just for ${offer.targetName}` : "Just for you"}
          </span>
        )}
      </div>
      {mine ? (
        <Button
          size="sm"
          variant="destructive"
          className="h-7 px-2.5 text-[10px] rounded shrink-0"
          onClick={() => barter.cancel(offer)}
        >
          Cancel
        </Button>
      ) : (
        <Button
          size="sm"
          className={cn(
            "h-7 px-2.5 text-[10px] rounded shrink-0",
            canAfford && "pm-grad-barter",
          )}
          variant={canAfford ? "default" : "secondary"}
          disabled={!canAfford}
          onClick={() => barter.accept(offer.id)}
        >
          🤝 Trade
        </Button>
      )}
    </div>
  );
}

// The compact form used from a chat. It holds its own draft, so it is
// mounted only where there is a board to post to, which is also what
// keeps a Lobby conversation entirely free of trade controls.
export function TradeComposer({
  game,
  act,
  barter,
  me,
  members,
  fixedTarget,
  onPosted,
}: {
  game: GameState;
  act: Act;
  barter: Barter;
  me: PublicUser;
  members: PublicUser[];
  fixedTarget?: PublicUser;
  onPosted?: () => void;
}) {
  const draft = useOfferDraft(game, barter, act, fixedTarget?.id);
  const selectClass =
    "h-8 rounded-md border border-input bg-transparent px-1.5 text-xs";

  return (
    <div className="w-80 space-y-2 p-3">
      <div className="flex items-center gap-1.5 text-xs">
        <span className="w-12 shrink-0 text-muted-foreground">I'll give</span>
        <QuantityInput
          value={draft.offerAmount}
          onCommit={draft.setOfferAmount}
          min={1}
          aria-label="Amount to offer"
          className="h-8 w-14"
        />
        <select
          value={draft.offerItem}
          onChange={(e) => draft.setOfferItem(e.target.value)}
          className={cn(selectClass, "flex-1")}
          aria-label="Item to offer"
        >
          {draft.items.map((it) => (
            <option key={it} value={it}>
              {ICONS[it]} {it}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="w-12 shrink-0 text-muted-foreground">I want</span>
        <QuantityInput
          value={draft.requestAmount}
          onCommit={draft.setRequestAmount}
          min={1}
          aria-label="Amount to request"
          className="h-8 w-14"
        />
        <select
          value={draft.requestItem}
          onChange={(e) => draft.setRequestItem(e.target.value)}
          className={cn(selectClass, "flex-1")}
          aria-label="Item to request"
        >
          {draft.items.map((it) => (
            <option key={it} value={it}>
              {ICONS[it]} {it}
            </option>
          ))}
        </select>
      </div>
      {fixedTarget ? (
        <p className="text-[11px] text-muted-foreground">
          Offered to {fixedTarget.displayName} alone.
        </p>
      ) : (
        <select
          value={draft.targetUserId}
          onChange={(e) => draft.setChosenTargetId(e.target.value)}
          className={cn(selectClass, "w-full")}
          aria-label="Direct this offer to a specific captain"
        >
          <option value="">🌊 Anyone in the harbor</option>
          {members
            .filter((m) => m.id !== me.id)
            .map((m) => (
              <option key={m.id} value={m.id}>
                🔒 {m.displayName} only
              </option>
            ))}
        </select>
      )}
      {draft.sameItem && (
        <p className="text-[11px] text-alarm">
          Pick two different items to barter.
        </p>
      )}
      {!draft.sameItem && draft.offerAmount > draft.owned && (
        <p className="text-[11px] text-alarm">
          You only have {draft.owned} {draft.offerItem}.
        </p>
      )}
      <Button
        className={cn(
          "h-8 w-full rounded-lg text-xs",
          draft.canPost && "pm-grad-barter",
        )}
        variant={draft.canPost ? "default" : "secondary"}
        disabled={!draft.canPost}
        onClick={() => {
          if (draft.submit()) onPosted?.();
        }}
      >
        🤝 Post Offer
      </Button>
    </div>
  );
}
