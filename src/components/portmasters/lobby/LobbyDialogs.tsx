"use client";

// =====================================================================
// The harbor screen's four dialogs, in one place.
//
// Each of these used to sit inline in the middle of Lobby's return, which
// is where they read worst: a dialog is a small self contained screen with
// a title, a body and one thing it can do, and next to fifteen hundred
// lines of board and rail it was hard to see where one ended and the next
// began. Gathered here they are four named units that take what they draw
// and hand back what they were asked to do, and the lobby's return is the
// screen rather than the screen plus four overlays.
//
// None of them owns state. Every one of them is opened, filled and closed
// by the lobby, which is the only thing that knows where the data came
// from, so a dialog here is a pure function of its props.
// =====================================================================

import { VoyageChronicle } from "@/types/realtime/voyage";
import { HouseStanding } from "@/types/realtime/standings";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BookOpen, Gift, Landmark, Loader2, Star } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Pill } from "@/components/portmasters/shared";
import { CaptainLegacyCard } from "@/components/portmasters/CaptainLegacyCard";
import { HouseLeaderboard } from "@/components/portmasters/HouseLeaderboard";
import {
  HOUSE_CREST,
  HOUSE_FALLBACK,
} from "@/components/portmasters/house-colours";
import type { CaptainLegacySummary, HouseId } from "@/lib/game/legacy";
import type { CheckInStatus } from "@/lib/game/checkin";
import { HOUSES, type House } from "@/lib/game/engine";

// Renown, and what it does on the next fresh voyage. The paragraph under
// the card is the rule as a captain needs it, and it names no number of
// rounds on purpose. It used to: the round it printed was Fair Winds'
// eight, and the lobby is where a captain reads it before choosing a
// voyage, so the number was wrong for Open Waters' twelve, wrong for
// Monsoon's sixteen, and wrong for every Gambit table, which pins twelve
// on every tier. The rule it was decorating needs no number to be true,
// and "ends in bankruptcy" was Classic's ending rather than the game's: a
// captain whose books fail in Gambit sails on, and still banks what they
// earned.
export function LegacyDialog({
  open,
  onOpenChange,
  legacy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  legacy: CaptainLegacySummary;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Star className="h-5 w-5 text-legacy" />
            Captain&apos;s Legacy
          </DialogTitle>
          <DialogDescription>
            Renown carries across every voyage this account ever sails, in any
            harbor.
          </DialogDescription>
        </DialogHeader>
        <CaptainLegacyCard legacy={legacy} className="p-5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Every Renown level grants a small Gold bonus at the start of your next
          fresh voyage. It grows from the Reputation you bank across the voyage,
          so it only ever goes up, even for a captain whose books fail.
        </p>
      </DialogContent>
    </Dialog>
  );
}

// The seven day cycle, drawn as the week it is. A claimed day keeps its
// place in the row rather than disappearing, because the row is the cycle
// and a captain reading it is asking where in the week they stand.
export function CheckInDialog({
  open,
  onOpenChange,
  checkIn,
  claiming,
  onClaim,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkIn: CheckInStatus;
  claiming: boolean;
  onClaim: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Gift className="h-5 w-5 text-checkin" />
            Daily Check In
          </DialogTitle>
          <DialogDescription>
            Claim a Renown reward each day. The 7 day cycle picks up where you
            left off, even after a missed day, and restarts once Day 7 is
            claimed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {checkIn.rewards.map((xp, i) => {
            const day = i + 1;
            const claimed = day <= checkIn.claimedThisCycle;
            const isCurrent = day === checkIn.currentDay;
            return (
              <div
                key={day}
                className={cn(
                  "rounded-lg border px-1 py-2 text-center",
                  claimed
                    ? "border-gain/40 bg-gain/[0.07] opacity-70"
                    : isCurrent
                      ? "border-checkin/50 bg-checkin/[0.09]"
                      : "border-black/10 dark:border-white/10 bg-background/40",
                )}
              >
                <div className="text-[10px] text-muted-foreground">
                  Day {day}
                </div>
                <div className="text-sm font-bold leading-tight">+{xp}</div>
                <div className="text-[9px] text-muted-foreground">
                  {claimed ? "✓ XP" : "XP"}
                </div>
              </div>
            );
          })}
        </div>
        <Button
          className="pm-grad-checkin font-semibold rounded-lg w-full"
          disabled={!checkIn.canClaimToday || claiming}
          onClick={onClaim}
        >
          {claiming
            ? "Claiming…"
            : checkIn.canClaimToday
              ? `Claim Day ${checkIn.currentDay}: +${checkIn.rewards[checkIn.currentDay - 1]} Renown XP`
              : "Checked in today · back tomorrow"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// The harbour master's ledger of finished voyages, newest first, with
// headline, body, and creation date.
export function ChronicleDialog({
  open,
  onOpenChange,
  loading,
  chronicles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  chronicles: VoyageChronicle[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <BookOpen className="h-5 w-5 text-chronicles" />
            Voyage Chronicles
          </DialogTitle>
          <DialogDescription>
            The harbour master&apos;s ledger of your finished voyages, newest
            first.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="pm-scroll-capped max-h-[60vh] pr-2">
          {loading ? (
            <div className="py-8 flex items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading
              chronicles…
            </div>
          ) : chronicles.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No chronicles yet. Finish a voyage and your headline will be
              inscribed here.
            </p>
          ) : (
            <ol className="space-y-3">
              {chronicles.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-black/10 dark:border-white/10 bg-background/40 p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold font-display">
                      {c.headline}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDate(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                    {c.body}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Great Houses: pledge or switch, with the harbor's standings under the
// list so a captain choosing a House can see how each is faring. The
// definitions come from the engine, the standings from the standings
// route, and the pledge is the lobby's to make.
export function HousesDialog({
  open,
  onOpenChange,
  loading,
  standings,
  myHouseId,
  pledgingHouse,
  onPledge,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  standings: HouseStanding[];
  myHouseId: HouseId | null;
  pledgingHouse: HouseId | null;
  onPledge: (houseId: HouseId) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto pm-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Landmark className="h-5 w-5 text-houses" />
            Great Houses
          </DialogTitle>
          <DialogDescription>
            Pledge to one House. Its perk applies on your next fresh voyage.
            Switch any time between voyages.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {loading ? (
            <div className="py-8 flex items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading
              standings…
            </div>
          ) : (
            HOUSES.map((house: House) => {
              const standing = standings.find((s) => s.houseId === house.id);
              const isMine = myHouseId === house.id;
              return (
                <div
                  key={house.id}
                  className={cn(
                    "rounded-xl border p-3 flex items-start gap-3",
                    isMine
                      ? "border-houses/50 bg-houses/[0.07]"
                      : "border-black/10 dark:border-white/10 bg-background/40",
                  )}
                >
                  <div
                    className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 text-lg",
                      HOUSE_CREST[house.id] ?? HOUSE_FALLBACK,
                    )}
                  >
                    <span aria-hidden>{house.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold font-display">
                        {house.name}
                      </span>
                      {isMine && (
                        <Pill tone="none" className="bg-houses/5 text-houses">
                          Pledged
                        </Pill>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                      {house.perk}
                    </p>
                    {standing && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-1">
                        <span>👑 {standing.crowns}</span>
                        <span>·</span>
                        <span>⛵ {standing.voyages}</span>
                        <span>·</span>
                        <span>★ {standing.bestScore}</span>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={isMine || pledgingHouse !== null}
                    onClick={() => onPledge(house.id)}
                    className="rounded-lg pm-grad-houses font-semibold shrink-0"
                  >
                    {pledgingHouse === house.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isMine ? (
                      "Pledged"
                    ) : (
                      "Pledge"
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* Harbor wide leaderboard */}
        {!loading && standings.length > 0 && (
          <div className="mt-4 border-t border-border/30 pt-4">
            <HouseLeaderboard standings={standings} myHouseId={myHouseId} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
