"use client";

import { VoyageResult, VoyageReveal } from "@/types/realtime/voyage";
import { RivalEntry } from "@/types/realtime/standings";
import { useEffect, useMemo, useState } from "react";
import { Trophy, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { endgameRatingFor } from "@/lib/game/engine";
import { t } from "@/lib/game/i18n";
import type { CaptainLegacySummary } from "@/lib/game/legacy";
import { PhaseHeading, type PhasePanelProps } from "./PhaseShared";
import { FinancialSummary, PeerEconomySummary } from "./EndgameSummaries";
import { CrewSummary } from "./EndgameCrewSummary";
import { EndgameResults } from "./EndgameResults";

// The head to head line the Legacy card draws when both captains are in
// the harbor. The account has one rivalry list (see /api/rivals), so this
// picks out the partners who sailed this voyage rather than asking for a
// named one. A rivalry with someone who is elsewhere is real, but it says
// nothing about the voyage just finished, so it stays off the card.
function useRivalHere(
  myUserId: string,
  voyageResult: VoyageResult | null | undefined,
): RivalEntry | null {
  const [rivals, setRivals] = useState<RivalEntry[]>([]);

  // The other captains in this voyage, as a set, so the match below is one
  // lookup per rival rather than one scan per rival.
  const partnerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of voyageResult?.standings ?? [])
      if (s.userId !== myUserId) ids.add(s.userId);
    return ids;
  }, [voyageResult, myUserId]);

  useEffect(() => {
    // Nothing to look up until the standings land, so the request waits
    // for them rather than firing an unanswerable one on first paint.
    if (partnerIds.size === 0) return;
    let canceled = false;
    api
      .listRivals()
      .then((res) => {
        if (!canceled) setRivals(res.rivals ?? []);
      })
      // A failed read just leaves the line off the card. This is a record
      // of the voyage just sailed, and a rivalry line is a nice extra on
      // it, never something worth showing an error state over.
      .catch(() => {});
    return () => {
      canceled = true;
    };
  }, [partnerIds]);

  // The list arrives newest meeting first, so a captain who has sailed
  // against two of the same partners gets the one they met most recently.
  return rivals.find((r) => partnerIds.has(r.partner.id)) ?? null;
}

type EndgameProps = Pick<PhasePanelProps, "game" | "me" | "room"> & {
  // The dispatcher in GamePhasePanel only spreads PhasePanelProps in, so
  // these four are wired by the parent (GameRoom) when it renders the
  // Endgame phase: voyageResult is the harbor wide standings payload the
  // server emits on voyage:complete, reveal is the harbor's cards turned
  // face up on voyage:reveal, myLegacy is the captain's post voyage
  // CaptainLegacySummary, and onRestart is the host's "restart voyage"
  // handler. onLeave is the harbor's leave flow, offered to a captain who
  // would rather set out for a new harbor than wait on the host. All five
  // are optional so the Endgame panel still renders a sane waiting state
  // when the parent hasn't wired them through yet.
  voyageResult?: VoyageResult | null;
  reveal?: VoyageReveal | null;
  myLegacy?: CaptainLegacySummary | null;
  onRestart?: () => void;
  onLeave?: () => void;
};

export function Endgame({
  game,
  me,
  room,
  voyageResult,
  reveal,
  myLegacy,
  onRestart,
  onLeave,
}: EndgameProps) {
  const myUserId = me.id;
  const isHost = me.id === room.hostId;
  // The same rank the Captain's Ledger's Voyage Ended line prints, from the
  // one lookup the two surfaces share (see endgameRatingFor).
  const rating = endgameRatingFor(game.score, game.defaultedDebt);
  const mine = voyageResult?.standings.find((s) => s.userId === myUserId);
  const rival = useRivalHere(myUserId, voyageResult);
  return (
    <div className="max-w-md mx-auto text-center py-4">
      <PhaseHeading layout="mb-4" tone="text-endgame" brush>
        {t("⚓ Voyage Ended!")}
      </PhaseHeading>
      <div className="text-xl font-bold text-favor my-3 flex items-center justify-center gap-2">
        <Trophy className="h-5 w-5" />
        {t("Final Reputation:")} {game.score}
      </div>
      <div className="text-lg text-gold-ink my-2 flex items-center justify-center gap-2">
        <Coins className="h-5 w-5" />
        {t("Final Gold:")}{" "}
        {t("{contract.fee} Gold", { "contract.fee": game.money })}
      </div>
      <div className="text-lg text-gold-ink my-4">
        {/* The rank is a captain facing label off the shared lookup, so it
            is read here, at the one place this screen prints it. */}
        {t("📈 Merchant Rank: ")}
        {t(rating)}
      </div>

      {/* Financial Summary */}
      <FinancialSummary game={game} />

      {/* Peer Economy Summary */}
      <PeerEconomySummary game={game} />

      {/* Crew Management Summary */}
      <CrewSummary game={game} />

      <EndgameResults
        voyageResult={voyageResult}
        reveal={reveal}
        myLegacy={myLegacy}
        myUserId={myUserId}
        mine={mine}
        rival={rival}
      />

      {isHost ? (
        <div className="flex flex-col items-center gap-2.5">
          <Button
            className="pm-grad-endgame rounded-xl px-8"
            onClick={onRestart}
            disabled={!onRestart}
          >
            {t("🔄 Restart Voyage")}
          </Button>
          {onLeave && (
            <Button
              variant="secondary"
              className="rounded-xl px-8"
              onClick={onLeave}
            >
              {t("⚓ Sail Again")}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2.5">
          <p className="text-sm text-muted-foreground">
            {t("Waiting for the host to restart the voyage…")}
          </p>
          {onLeave && (
            <Button
              variant="secondary"
              className="rounded-xl px-8"
              onClick={onLeave}
            >
              {t("⚓ Sail Again")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
