"use client";

import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/quantity-input";
import { ICONS } from "@/lib/game/constants";
import { completeBarterPhase } from "@/lib/game/engine";
import { cn } from "@/lib/utils";
import { Handshake, X } from "lucide-react";
import { Term } from "../../Term";
import { OfferCard, useOfferDraft } from "../BarterTrade";
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
  // The board's own composer. It shares useOfferDraft with the one a chat
  // opens, so both surfaces agree on what counts as postable, and it draws
  // each open offer with the same OfferCard a chat shows. Only the layout
  // around them differs, which is why this file is markup and very little
  // else.
  const draft = useOfferDraft(game, barter, act);
  const otherMembers = members.filter((m) => m.id !== me.id);

  const selectClass =
    "h-9 rounded-md border border-input bg-transparent px-2 text-sm";

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <Handshake className="h-5 w-5 text-barter" />
        <Term term="Barter">Captain's Exchange</Term>
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Short on one good and sitting on too much of another? Post a swap for
        the rest of the harbor to see, or take someone else's. The board stays
        open for the rest of the voyage, and you can post to it from either chat
        as well as from here.
      </p>

      <div className="rounded-xl border border-barter/15 bg-barter/[0.03] p-4 mb-4">
        <h3 className="text-center font-semibold mb-3 text-sm">
          📤 Post an Offer
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">I'll give</span>
          <QuantityInput
            value={draft.offerAmount}
            onCommit={draft.setOfferAmount}
            min={1}
            aria-label="Amount to offer"
            className="w-16 h-9"
          />
          <select
            value={draft.offerItem}
            onChange={(e) => draft.setOfferItem(e.target.value)}
            className={selectClass}
            aria-label="Item to offer"
          >
            {draft.items.map((it) => (
              <option key={it} value={it}>
                {ICONS[it]} {it}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">for</span>
          <QuantityInput
            value={draft.requestAmount}
            onCommit={draft.setRequestAmount}
            min={1}
            aria-label="Amount to request"
            className="w-16 h-9"
          />
          <select
            value={draft.requestItem}
            onChange={(e) => draft.setRequestItem(e.target.value)}
            className={selectClass}
            aria-label="Item to request"
          >
            {draft.items.map((it) => (
              <option key={it} value={it}>
                {ICONS[it]} {it}
              </option>
            ))}
          </select>
          <Button
            className={cn("rounded-lg", draft.canPost && "pm-grad-barter")}
            variant={draft.canPost ? "default" : "secondary"}
            disabled={!draft.canPost}
            onClick={() => draft.submit()}
          >
            🤝 Post Offer
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm mt-2">
          <span className="text-muted-foreground">With</span>
          <select
            value={draft.targetUserId}
            onChange={(e) => draft.setChosenTargetId(e.target.value)}
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
        {draft.targetUserId && (
          <p className="text-center text-[11px] text-muted-foreground mt-1.5">
            Only{" "}
            {otherMembers.find((m) => m.id === draft.targetUserId)?.displayName}{" "}
            will see this offer. A safeguard so nobody else can take it first.
          </p>
        )}
        {draft.sameItem && (
          <p className="text-center text-[11px] text-alarm mt-2">
            Pick two different items to barter.
          </p>
        )}
        {!draft.sameItem && draft.offerAmount > draft.owned && (
          <p className="text-center text-[11px] text-alarm mt-2">
            You only have {draft.owned} {draft.offerItem}.
          </p>
        )}
      </div>

      {barter.error && (
        <div className="rounded-lg bg-alarm/5 border border-alarm/25 px-3.5 py-2 mb-4 text-xs text-alarm flex items-center justify-between">
          <span>⚠️ {barter.error}</span>
          <button onClick={barter.clearError} aria-label="Dismiss error">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-ship/15 bg-ship/[0.03] p-4 mb-4">
        <h3 className="text-center font-semibold mb-3 text-sm">
          📋 Open Offers
        </h3>
        {barter.offers.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">
            No offers on the board yet. Be the first.
          </p>
        ) : (
          <div className="space-y-1.5">
            {barter.offers.map((o) => (
              <OfferCard
                key={o.id}
                offer={o}
                me={me}
                game={game}
                barter={barter}
                colorFor={colorFor}
              />
            ))}
          </div>
        )}
      </div>

      <ReadyFooter
        phaseSync={phaseSync}
        members={members}
        idleLabel="✅ Done Bartering, Continue"
        onConfirm={() =>
          phaseSync.markReady((g, l) => completeBarterPhase(g, l))
        }
      />
    </div>
  );
}
