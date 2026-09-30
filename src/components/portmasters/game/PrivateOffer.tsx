"use client";

// =====================================================================
// The private offer both selling boards post with: a fee, and who it is
// for.
//
// The escort market and the refit bench sell different things under the
// same terms. Both name a price in Gold, both let the seller open the
// offer to the whole harbor or shut it to one captain, both draw the same
// row doing it, and both explain the shut offer with the same sentence.
// That sentence is the one that matters: a captain who names somebody has
// to be told that the naming is what makes it private, and told it the
// same way on both boards, because it is the same mechanic.
//
// So the row is here, and the two boards keep what is theirs: what is
// being sold, the picker that chooses it, the button that posts it, the
// price they start at, and the sentence that says when an untaken offer
// dies. The last of those is a prop rather than a copy because the two
// windows really are different (a Parley, a Market) and the sentence
// around it is the same.
//
// The named offer note is drawn here too. It cannot live at the call
// sites, because it has to be told what was named and that is this
// component's own state to read.
// =====================================================================

import type { ReactNode } from "react";
import type { PublicUser } from "@/lib/api";
import { QuantityInput } from "@/components/ui/quantity-input";
import { Select } from "@/components/ui/select";
import { CONSENT_FEE_MAX, CONSENT_FEE_MIN } from "@/lib/game/constants/paths";

export function PrivateOffer({
  lead,
  fee,
  onFee,
  targetId,
  onTarget,
  others,
  audienceLabel,
  deadline,
  action,
}: {
  /** What sits before the price: a word, or the board's own picker. */
  lead: ReactNode;
  fee: number;
  onFee: (fee: number) => void;
  targetId: string;
  onTarget: (id: string) => void;
  /** The captains who could be named, which is the table but the seller. */
  others: PublicUser[];
  /** What the audience picker is choosing, read out for a screen reader. */
  audienceLabel: string;
  /** When an offer nobody took is gone, as the rest of a sentence. */
  deadline: string;
  /** The board's own button, which posts at the price and audience above. */
  action: ReactNode;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        {lead}
        <QuantityInput
          value={fee}
          onCommit={onFee}
          min={CONSENT_FEE_MIN}
          max={CONSENT_FEE_MAX}
          aria-label="Fee in Gold"
          className="w-20 h-9"
        />
        <span className="text-muted-foreground">Gold, offered to</span>
        <Select
          value={targetId}
          onChange={(e) => onTarget(e.target.value)}
          aria-label={audienceLabel}
        >
          <option value="">🌊 Anyone in the harbor</option>
          {others.map((m) => (
            <option key={m.id} value={m.id}>
              🔒 {m.displayName} only
            </option>
          ))}
        </Select>
        {action}
      </div>
      {targetId && (
        <p className="text-center text-[11px] text-muted-foreground mt-1.5">
          Only {others.find((m) => m.id === targetId)?.displayName} will see
          this offer, so nobody else can take it first. It still has to be taken{" "}
          {deadline}
        </p>
      )}
    </>
  );
}
