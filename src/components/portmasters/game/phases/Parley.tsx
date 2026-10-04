"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/quantity-input";
import { ICONS } from "@/lib/game/constants/brand";
import { leavePhase } from "@/lib/game/engine";
import {
  bazaarRumorsOn,
  escortContractsOn,
  moduleTradesOn,
} from "@/lib/game/flags";
import { cn } from "@/lib/utils";
import { Handshake } from "lucide-react";
import { Term } from "../../Term";
import { AuditVoteCard } from "../AuditPanel";
import { HarbormasterConsole, MaroonVoteCard } from "../MaroonPanel";
import { OfferCard, useOfferDraft } from "../BarterTrade";
import { EscortMarket } from "../EscortContracts";
import { ModuleMarket } from "../ModuleMarket";
import { BazaarRumors } from "../BazaarRumors";
import { OpenBoons } from "../OpenBoons";
import {
  HuePanel,
  PanelHeading,
  PanelTitle,
  PhaseError,
  ReadyFooter,
  type PhasePanelProps,
} from "./PhaseShared";

// The Parley panel: the Captain's Exchange, and with it the two votes the
// table carries and the three markets that sell on the same terms the
// exchange does. Named for the phase it is (see @/lib/game/phases), the
// same way Market.tsx and Orders.tsx are, rather than for bartering, which
// is the activity half this screen shares with a chat composer and not the
// seat the room waits on.
//
// The screen used to be one stack ten sections deep: the exchange, the
// two votes, the fleet's ledger and the three markets all open at once,
// which put the markets under the fold at a middling window and made the
// phase read as a wall. It wears two stations now, the same shape
// Market.tsx uses and for the reasons written there: the station is local
// state rather than a phase value or a saved field, so a captain who
// switches stations has told the room nothing, and the wait a ready vote
// opened does not re-split.
//
// What is traded splits; what belongs to the whole table does not. The
// Harbormaster's console, the two votes and the fleet's ledger draw under
// the strip on both stations, because a vote a captain cannot see is a
// vote they cannot cast, and because the ledger is where the table argues
// about what each seat passed on. The strip itself draws only when a
// market is switched on, so a Classic harbor opens exactly the exchange
// it always had, with no second station to visit.
type Station = "exchange" | "markets";

const STATIONS: { id: Station; label: string; icon: string }[] = [
  { id: "exchange", label: "Exchange", icon: "🤝" },
  { id: "markets", label: "Markets", icon: "🏪" },
];

export function Parley({
  game,
  ctx,
  act,
  barter,
  escort,
  modules,
  bazaar,
  audit,
  boons,
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
  | "escort"
  | "modules"
  | "bazaar"
  | "audit"
  | "boons"
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
  const [station, setStation] = useState<Station>("exchange");

  // Whether this harbor has a market to trade with. The strip draws only
  // when it has, so a Classic harbor (where all three markets draw
  // nothing at all) opens on the exchange with no second station to
  // visit.
  const marketsOn =
    escortContractsOn(game.mode) ||
    moduleTradesOn(game.mode) ||
    bazaarRumorsOn(game.mode);

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
    phaseSync.markReady((g, l) => leavePhase(g, ctx, l));
  }, [revealedRound, game.phase, game.currentRound, phaseSync, ctx]);

  return (
    <div className="max-w-3xl mx-auto">
      <PanelTitle className="mb-3">
        <Handshake className="h-5 w-5 text-parley" />
        <Term term="Barter">Captain's Exchange</Term>
      </PanelTitle>

      {/* The station strip, the same shape and the same reasons as the
          one Market.tsx wears: the strip locks while the ready vote is
          in flight, because at that point the harbor is being told this
          captain is done. */}
      {marketsOn && (
        <div className="mb-3.5 flex items-center gap-1.5">
          {STATIONS.map((s, i) => {
            const here = s.id === station;
            return (
              <button
                key={s.id}
                type="button"
                disabled={phaseSync.waiting}
                onClick={() => setStation(s.id)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60",
                  here
                    ? "border-parley/40 bg-parley/[0.12] text-parley"
                    : "border-transparent bg-muted/30 text-muted-foreground hover:text-foreground",
                )}
              >
                {s.icon} {i + 1} · {s.label}
              </button>
            );
          })}
        </div>
      )}

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

      {/* [F5: public offers] The fleet's ledger, under the two votes and
          above the two stations: everything above it is a captain's
          business made public (a vote, a finding), and this is the other
          half of that sentence, the picks each seat made in the open. It
          is the plan's evaluation surface, where the table argues about
          what a captain passed on, so it sits where the argument happens
          rather than where the picks were made. It draws nothing at all
          until a first pick lands, and nothing ever in a Classic harbor. */}
      <OpenBoons
        game={game}
        me={me}
        members={members}
        entries={boons.entries}
        className="mb-4"
      />

      {station === "exchange" ? (
        <>
          {/* The board the exchange is about stands above the form that
              posts to it: a captain reads what the harbor is selling
              before writing what they would give for it. The offers used
              to sit under the form, which at a middling window put the
              market itself under the fold. */}
          <HuePanel tone="ship" className="p-4 mb-4">
            <PanelHeading className="mb-3 text-sm">📋 Open Offers</PanelHeading>
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
          </HuePanel>

          <HuePanel tone="parley" className="p-4 mb-4">
            <PanelHeading className="mb-3 text-sm">
              📤 Post an Offer
            </PanelHeading>
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
              <span className="text-muted-foreground">I'll give</span>
              <QuantityInput
                value={draft.offerAmount}
                onCommit={draft.setOfferAmount}
                min={1}
                aria-label="Amount to offer"
                className="w-16 h-9"
              />
              <Select
                value={draft.offerItem}
                onChange={(e) => draft.setOfferItem(e.target.value)}
                aria-label="Item to offer"
              >
                {draft.items.map((it) => (
                  <option key={it} value={it}>
                    {ICONS[it]} {it}
                  </option>
                ))}
              </Select>
              <span className="text-muted-foreground">for</span>
              <QuantityInput
                value={draft.requestAmount}
                onCommit={draft.setRequestAmount}
                min={1}
                aria-label="Amount to request"
                className="w-16 h-9"
              />
              <Select
                value={draft.requestItem}
                onChange={(e) => draft.setRequestItem(e.target.value)}
                aria-label="Item to request"
              >
                {draft.items.map((it) => (
                  <option key={it} value={it}>
                    {ICONS[it]} {it}
                  </option>
                ))}
              </Select>
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
              <Select
                value={draft.targetUserId}
                onChange={(e) => draft.setChosenTargetId(e.target.value)}
                aria-label="Direct this offer to a specific captain"
              >
                <option value="">🌊 Anyone in the harbor</option>
                {otherMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    🔒 {m.displayName} only
                  </option>
                ))}
              </Select>
            </div>
            {draft.targetUserId && (
              <p className="text-center text-[11px] text-muted-foreground mt-1.5">
                Only{" "}
                {
                  otherMembers.find((m) => m.id === draft.targetUserId)
                    ?.displayName
                }{" "}
                will see this offer. A safeguard so nobody else can take it
                first.
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
          </HuePanel>

          {barter.error && (
            <PhaseError
              message={barter.error}
              onDismiss={barter.clearError}
              className="mb-4"
            />
          )}
        </>
      ) : (
        <>
          {/* [D3: Convoy: the Escort Contract] The protection market, the
              other thing sold at this table, on the same terms the
              exchange sells on: a price agreed in the open, and one leg
              of it. It draws nothing at all in a build with the switch
              off. */}
          <EscortMarket game={game} escort={escort} me={me} members={members} />

          {/* [F3: modules in the shipyard ladder, and trading them between
              captains] The module market, on the same terms as the two
              above it, a price agreed in the open, for a card rather
              than a leg of cover. It draws nothing at all in a build
              with the switch off. */}
          <ModuleMarket
            game={game}
            modules={modules}
            me={me}
            members={members}
          />

          {/* [D5: Aroma: the Bazaar Rumor] The desk, the third of the
              port's trades. It draws nothing at all in a build with the
              switch off, and a captain who holds no path of their own
              still reads the board below the desk. */}
          <BazaarRumors game={game} bazaar={bazaar} me={me} />
        </>
      )}

      <ReadyFooter
        phaseSync={phaseSync}
        members={members}
        idleLabel="✅ Done Bartering, Continue"
        onConfirm={() => phaseSync.markReady((g, l) => leavePhase(g, ctx, l))}
      />
    </div>
  );
}
