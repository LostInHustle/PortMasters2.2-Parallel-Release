"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/quantity-input";
import { ICONS } from "@/lib/game/constants";
import { nextPhase } from "@/lib/game/engine";
import { cn } from "@/lib/utils";
import { Handshake } from "lucide-react";
import { Term } from "../../Term";
import { AuditVoteCard } from "../AuditPanel";
import { HarbormasterConsole, MaroonVoteCard } from "../MaroonPanel";
import { OfferCard, useOfferDraft } from "../BarterTrade";
import { PhaseError, ReadyFooter, type PhasePanelProps } from "./PhaseShared";

// The Parley panel: the Captain's Exchange, and with it the two votes the
// table carries. Named for the phase it is (see @/lib/game/phases), the
// same way Market.tsx and Orders.tsx are, rather than for bartering, which
// is the activity half this screen shares with a chat composer and not the
// seat the room waits on.
export function Parley({
  game,
  ctx,
  act,
  barter,
  audit,
  maroon,
  phaseSync,
  members,
  colorFor,
  me,
  roster,
}: Pick<
  PhasePanelProps,
  | "game"
  | "ctx"
  | "act"
  | "barter"
  | "audit"
  | "maroon"
  | "phaseSync"
  | "members"
  | "colorFor"
  | "me"
  | "roster"
>) {
  // The board's own composer. It shares useOfferDraft with the one a chat
  // opens, so both surfaces agree on what counts as postable, and it draws
  // each open offer with the same OfferCard a chat shows. Only the layout
  // around them differs, which is why this file is markup and very little
  // else.
  //
  // The draft is built as an exchange one, which is the whole difference
  // from the chat composer: nothing posted here is held to a Renown level
  // or to the flexible allowance. This is the round interface and it is
  // open to every captain from their first voyage.
  const draft = useOfferDraft(game, barter, act, false);
  const otherMembers = members.filter((m) => m.id !== me.id);

  // [H6: the Manifest Audit] The leg this screen is on ends the moment the
  // vote carries, so the captain reads the finding on the strip above and
  // this phase, which the audit just spent, closes behind it.
  //
  // It closes the way every phase closes: by marking ready. That is the
  // whole reason this belongs in the component rather than in the realtime
  // layer. A server that emptied the checkpoint's ready set on the room's
  // behalf would move the checkpoint while every client sat waiting to be
  // told to move, which is a room stuck forever; here each client runs the
  // one transition it already knows, and the room advances through the
  // protocol it was already using.
  //
  // The guards are the ones that keep a stale finding from spending a
  // later leg: the reveal carries the leg it was made in, so a captain who
  // reloads in leg seven is shown the finding without being pushed out of
  // a Parley the harbor never voted to end.
  const revealedRound = audit.reveal?.round;
  useEffect(() => {
    if (revealedRound === undefined) return;
    if (game.phase !== "parley" || game.currentRound !== revealedRound) return;
    phaseSync.markReady((g, l) => nextPhase(g, ctx, l));
  }, [revealedRound, game.phase, game.currentRound, phaseSync, ctx]);

  const selectClass =
    "h-9 rounded-md border border-input bg-transparent px-2 text-sm";

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <Handshake className="h-5 w-5 text-parley" />
        <Term term="Barter">Captain's Exchange</Term>
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Short on one good and sitting on too much of another? Post a swap for
        the rest of the harbor to see, or take someone else's. The board stays
        open for the rest of the voyage, and you can post to it from either chat
        as well as from here.
      </p>

      <div className="rounded-xl border border-parley/15 bg-parley/[0.03] p-4 mb-4">
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
            className={cn("rounded-lg", draft.canPost && "pm-grad-parley")}
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

      {/* [H7: Maroon and the Harbormaster] The console sits above the two
          votes because it belongs to one captain and it is the reason this
          screen is open for them: everything under it is the table's
          business, and this is theirs. It renders nothing at all for a
          captain the harbor has not put ashore. */}
      <HarbormasterConsole game={game} maroon={maroon} />

      <AuditVoteCard game={game} members={members} me={me} audit={audit} />

      <MaroonVoteCard
        game={game}
        members={members}
        me={me}
        maroon={maroon}
        statuses={roster?.statuses}
      />

      {barter.error && (
        <PhaseError
          message={barter.error}
          onDismiss={barter.clearError}
          className="mb-4"
        />
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
        onConfirm={() => phaseSync.markReady((g, l) => nextPhase(g, ctx, l))}
      />
    </div>
  );
}
