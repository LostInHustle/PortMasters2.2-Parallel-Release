"use client";

import { Button } from "@/components/ui/button";
import { difficultyConfig } from "@/lib/game/difficulty";
import { ESCORT_SHARE_RULE } from "@/lib/game/constants/copy";
import {
  escortCost,
  escortCoverage,
  escortCoverOf,
  hireEscort,
  pirateChance,
  resolvePirateAttack,
} from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, ShieldCheck, Skull } from "lucide-react";
import { PhaseHeading, StatTile, SummaryHeading } from "./PhaseShared";

/**
 * The first station of the Resolve phase: the raid the leg ends on. The
 * captain either buys the harbor's escort or sails into it, and the screen
 * shows what each would cost against what a raid would take.
 *
 * Both figures come straight from the engine, off the same two functions
 * the charge itself goes through (see hireEscort and resolvePirateAttack),
 * so the risk and the price quoted here are the ones on offer rather than
 * a hand rebuilt copy that can leave a discount out.
 */
export function PirateAttack({
  game,
  act,
}: {
  game: GameState;
  act: (fn: (g: GameState, logs: string[]) => void) => void;
}) {
  const escortFee = escortCost(game);
  const raidPct = Math.round(pirateChance(game) * 100);
  // Read only to explain the note below. The leak is already inside the
  // figure above, so this tells the captain why the odds look as high as
  // they do rather than showing a second, separate number.
  const leak = game.brokerTippedPirates
    ? difficultyConfig(game.difficulty).brokerCorruptionRisk
    : 0;
  // [D3: Convoy: the Escort Contract] Whose guns are standing over this
  // leg, if anybody's. Read through the engine's own function rather than
  // off the field, so a build with the market off reads as uncovered here
  // exactly as it does at the raid roll.
  const cover = escortCoverOf(game);
  return (
    <div className="max-w-xl mx-auto text-center py-4">
      <div className="text-5xl mb-2">🏴‍☠️</div>
      <PhaseHeading layout="mb-1" tone="text-resolve" brush>
        Pirate Waters Ahead
      </PhaseHeading>
      <div className="mb-5 space-y-2">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {cover
            ? "Before this round's bills come due, your ship has to clear open water. Pirates that find you this round meet a shield you already paid for, so there is nothing here left to buy and nothing in your hold that is theirs."
            : `Before this round's bills come due, your ship has to clear open water. There is a ${raidPct}% chance pirates find you and take every coin in your hold. Hire an escort to sail through safely, or risk it and save the Gold.`}
        </p>
        {cover && (
          <p className="text-sm text-parley">
            🛡️ {cover.sellerName} sold you this leg's cover. Their cannons beat
            off {Math.round(escortCoverage() * 100)}% of a boarding party, and
            their own hold answers for the rest.
          </p>
        )}
        {/* The leak note explains the odds printed under it, so it belongs
            with them: under a contract there are no odds on this screen to
            explain, and the leak is cleared at the next Dawn's draft. */}
        {leak > 0 && !cover && (
          <p className="text-sm text-warn">
            🕵️ A corrupt broker leaked your position this round, so the odds
            above are already raised.
          </p>
        )}
      </div>

      {/* The risk this screen is about, and it draws nothing under a
          contract: three numbers that describe what a raid would cost the
          captain, at a moment when a raid costs them nothing, would only be
          three true figures about a decision that is no longer theirs to
          make. The cover line above is what replaces them. */}
      {!cover && (
        <div className="max-w-md mx-auto mb-4 rounded-xl border border-border/40 bg-background/40 p-3.5">
          <SummaryHeading size="text-[10px]" tone="text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-warn" />
            Risk Assessment
          </SummaryHeading>
          <div className="grid grid-cols-3 gap-2">
            {/* Raid probability */}
            <StatTile
              value={`${raidPct}%`}
              valueClassName={cn(
                "tabular-nums",
                raidPct >= 30
                  ? "text-alarm"
                  : raidPct >= 20
                    ? "text-warn"
                    : "text-gain",
              )}
              label="Raid Chance"
            />
            {/* Gold at risk */}
            <StatTile
              value={game.money}
              valueClassName="tabular-nums text-alarm"
              label="Gold at Risk"
            />
            {/* Expected loss */}
            <StatTile
              value={Math.round((game.money * raidPct) / 100)}
              valueClassName="tabular-nums text-warn"
              label="Expected Loss"
            />
          </div>
          {/* Recommendation */}
          {(() => {
            const expectedLoss = (game.money * raidPct) / 100;
            const recommend = escortFee < expectedLoss && game.money > 0;
            if (!recommend) return null;
            return (
              <div className="mt-2 rounded-lg bg-gain/5 px-2.5 py-1.5 text-[10px] text-gain">
                Escort costs {escortFee} Gold but expected loss is{" "}
                {Math.round(expectedLoss)} Gold. Hiring the escort saves Gold on
                average.
              </div>
            );
          })()}
        </div>
      )}

      {/* The two choices a captain has on this screen, and the reason the
          first one draws nothing under a contract. Hiring the harbor escort
          resolves the raid outright (see hireEscort), which would spend Gold
          on a guarantee the captain is already holding and leave the
          contract's seller never called on at all: the buyer pays twice and
          the seller owes nothing. So a covered captain is offered the one
          action that still means something, which is sailing on into the
          raid the contract was bought for. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
        {!cover && (
          <Button
            size="lg"
            className="pm-grad-resolve rounded-xl h-14"
            onClick={() => act((g, l) => hireEscort(g, l))}
          >
            <ShieldCheck className="h-5 w-5 mr-2" /> Hire Escort ({escortFee}{" "}
            Gold)
          </Button>
        )}
        <Button
          size="lg"
          variant={cover ? "default" : "secondary"}
          className={cn("rounded-xl h-14", cover && "pm-grad-resolve")}
          onClick={() => act((g, l) => resolvePirateAttack(g, l))}
        >
          <Skull className="h-5 w-5 mr-2" />{" "}
          {cover ? "Sail On" : "Set Sail Anyway"}
        </Button>
      </div>
      {/* The share the escort takes, in the guide's own words: one home
          for the sentence (see ESCORT_SHARE_RULE in
          @/lib/game/constants/copy), so a rewording lands on both pages. */}
      {!cover && (
        <p className="text-[11px] text-muted-foreground mt-3">
          {ESCORT_SHARE_RULE}
        </p>
      )}
    </div>
  );
}
