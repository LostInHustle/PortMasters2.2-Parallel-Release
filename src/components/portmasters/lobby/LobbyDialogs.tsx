"use client";

// The lobby's four dialogs. Each is presentational; the lobby owns their state.

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
import {
  BookOpen,
  Gift,
  Landmark,
  Loader2,
  Star,
  type LucideIcon,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Pill } from "@/components/portmasters/shared";
import { RENOWN_BONUS_LINE } from "@/lib/game/constants/copy";
import { t } from "@/lib/game/i18n";
import { useLanguage } from "@/lib/use-language-preference";
import { CaptainLegacyCard } from "@/components/portmasters/CaptainLegacyCard";
import { HouseLeaderboard } from "@/components/portmasters/HouseLeaderboard";
import {
  HOUSE_CREST,
  HOUSE_FALLBACK,
} from "@/components/portmasters/house-colors";
import type { CaptainLegacySummary, HouseId } from "@/lib/game/legacy";
import type { CheckInStatus } from "@/lib/game/checkin";
import { HOUSES, type House } from "@/lib/game/engine";

function DialogHeading({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  description: string;
}) {
  return (
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2 font-display">
        <Icon className={cn("h-5 w-5", tone)} />
        {t(title)}
      </DialogTitle>
      <DialogDescription>{t(description)}</DialogDescription>
    </DialogHeader>
  );
}

// Renown, and what it does on the next fresh voyage. The paragraph under
// the card is the rule as a captain needs it, and it names no number of
// rounds on purpose: the lobby is where a captain reads it before choosing
// a voyage, and a number written in would be wrong for every table but one
// (Open Waters' twelve and Monsoon's sixteen, and every Gambit table, which
// pins twelve on every tier). The rule needs no number to be true, and it
// does not say "ends in bankruptcy", which is Classic's ending rather than
// the game's: a captain whose books fail in Gambit sails on, and still
// banks what they earned.
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
        <DialogHeading
          icon={Star}
          tone="text-legacy"
          title="Captain's Legacy"
          description="Renown carries across every voyage this account ever sails, in any harbor."
        />
        <CaptainLegacyCard legacy={legacy} className="p-5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t(
            "{RENOWN_BONUS_LINE}. It grows from the Reputation you bank across the voyage, so it only ever goes up, even for a captain whose books fail.",
            { RENOWN_BONUS_LINE: t(RENOWN_BONUS_LINE) },
          )}
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
        <DialogHeading
          icon={Gift}
          tone="text-checkin"
          title="Daily Check In"
          description="Claim a Renown reward each day. The 7 day cycle picks up where you left off, even after a missed day, and restarts once Day 7 is claimed."
        />
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
                  {t("Day {day}", { day })}
                </div>
                <div className="text-sm font-bold leading-tight">+{xp}</div>
                <div className="text-[9px] text-muted-foreground">
                  {claimed ? t("✓ XP") : t("XP")}
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
            ? t("Claiming…")
            : checkIn.canClaimToday
              ? t("Claim Day {day}: +{xp} Renown XP", {
                  day: checkIn.currentDay,
                  xp: checkIn.rewards[checkIn.currentDay - 1],
                })
              : t("Checked in today · back tomorrow")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// The harbormaster's ledger of finished voyages, newest first, with
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
  const { locale } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeading
          icon={BookOpen}
          tone="text-chronicles"
          title="Voyage Chronicles"
          description="The Harbormaster's ledger of your finished voyages, newest first."
        />
        <ScrollArea className="pm-scroll-capped max-h-[60vh] pr-2">
          {loading ? (
            <div className="py-8 flex items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />{" "}
              {t("Loading chronicles…")}
            </div>
          ) : chronicles.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t(
                "No chronicles yet. Finish a voyage and your headline will be inscribed here.",
              )}
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
                      {formatDate(c.createdAt, locale)}
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
        <DialogHeading
          icon={Landmark}
          tone="text-houses"
          title="Great Houses"
          description="Pledge to one House. Its perk applies on your next fresh voyage. Switch any time between voyages."
        />
        <div className="space-y-2">
          {loading ? (
            <div className="py-8 flex items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />{" "}
              {t("Loading standings…")}
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
                        {t(house.name)}
                      </span>
                      {isMine && (
                        <Pill tone="none" className="bg-houses/5 text-houses">
                          {t("Pledged")}
                        </Pill>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                      {t(house.perk)}
                    </p>
                    {standing && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-1">
                        <span>👑 {standing.crowns}</span>
                        <span>·</span>
                        <span>⛵ {standing.voyages}</span>
                        <span>·</span>
                        <span>★ {standing.bestReputation}</span>
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
                      t("Pledged")
                    ) : (
                      t("Pledge")
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
