"use client";

import { wageBill } from "@/lib/game/engine";
import { onShortRations } from "@/lib/game/larder";
import { survivalLayerOn } from "@/lib/game/flags";
import {
  garmentsLayerOn,
  legIsCold,
  shortOfWarmth,
  warmthScore,
} from "@/lib/game/garments";
import type { GameState } from "@/lib/game/types";
import type { WorkerType } from "@/lib/game/constants/crew";
import { unlockedWorkerTypes } from "@/lib/game/pools";
import type { ConvoyVenture } from "@/lib/use-convoy";
import { VoyageTimeline } from "./VoyageTimeline";
import { GameLogPanel } from "./GameLogPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoyageHeader } from "./status/VoyageHeader";
import { StatGrid } from "./status/StatGrid";
import { ColdLegChip } from "./status/ColdLegChip";
import { CargoHold } from "./status/CargoHold";
import { ShipTab } from "./status/ShipTab";
import { DuesTab } from "./status/DuesTab";
import { ConvoyVentures } from "./status/ConvoyVentures";

// One crew type of the unlocked roster, with the hands of that type aboard
// and what they are owed at the round end. Built here, where the difficulty
// and the round are known, and handed to the Cargo tab (whose artisan rows
// count the same hands) and the Dues tab (which prices them), so neither
// tab has to work the roster out a second time and the two cannot disagree
// about who is aboard.
export type RosterEntry = WorkerType & {
  list: GameState["workers"][WorkerType["id"]];
  due: number;
};

// Every block of the rail is now its own component under ./status, and this
// file keeps the wiring: the roster, the pending totals and the three layer
// readings are resolved once here and handed to the tab that draws them, so
// nothing is computed twice and no tab reaches into the game state for a
// number this one already has.
/**
 * The captain's own rail.
 *
 * This used to be five sections stacked in a single narrow column (Captain's
 * Log, Vessel Status, Cargo Hold, Outstanding Loans, Round End Obligations)
 * with the ledger dropped underneath all of it. In a rail roughly 260px wide
 * that is unavoidably a long vertical scroll, and the ledger, which a captain
 * consults constantly, sat furthest from the eye.
 *
 * So the handful of numbers that are checked every few seconds (round, waters,
 * funds, reputation, and what is owed at round end) lead the column, and
 * everything else is a tab. The ledger becomes a peer tab rather than a
 * footnote below the fold.
 *
 * The panel is one scroll container at every window height, and the tabs are
 * laid out at their natural height inside it: scrolling the rail moves the
 * whole column, head included, and no section box ever owns a scrollbar of
 * its own (the ledger's tail box is the one deliberate exception, because a
 * log's whole job is to scroll its own newest lines into view). This took
 * three shapes to get right. The first pinned the head and let each tab
 * scroll inside its own box, which the field reported as "only the four
 * boxes scroll". The second made the panel the scroll container but kept a
 * floor under the tab box, so the one column scroll only engaged on a short
 * window and the field reported the same thing again at ordinary heights.
 * The third drops the floor and the inner scroll boxes outright: whatever
 * the window, content taller than the rail scrolls the rail, and content
 * shorter than the rail does not scroll at all.
 *
 * The due figure in the head carries the safe/short tone, because that is the
 * one number that decides whether a captain is about to go bankrupt, and it
 * should be readable without opening anything.
 */
export function GameStatusPanel({
  game,
  logs,
  onRepayLoan,
  convoy,
  myUserId,
  colorFor,
}: {
  game: GameState;
  logs: string[];
  onRepayLoan?: (debtId: string) => void;
  convoy?: {
    ventures: ConvoyVenture[];
    locked: boolean;
    error: string | null;
    post: (targetGold: number, deadlineRound: number) => void;
    contribute: (ventureId: string, amount: number) => void;
  };
  myUserId?: string;
  colorFor?: (item: string) => string | undefined;
}) {
  const showObligations = ![0, 5, "endgame", "bankruptcy"].includes(game.phase);
  // [C1: the Larder and Short Rations] Read once for the two decisions
  // below, since it is the same answer to both: whether the layer is
  // running decides whether the stat exists at all, and if it is running,
  // whether the crew is short decides what colour the number wears.
  const larderOn = survivalLayerOn(game.mode);
  const shortRations = larderOn && onShortRations(game);
  // [C3: garments and the cold] The weather and the wardrobe, read once
  // each for the chip below. The layer decides whether there is a chip at
  // all, the tag decides whether this leg is one worth saying anything
  // about, and the score is the same sum the settlement tick freezes
  // against, so the warning printed here and the check that bites the crew
  // cannot read differently.
  const garmentsOn = garmentsLayerOn(game.mode);
  const coldLeg = garmentsOn && legIsCold(game);
  const warmth = warmthScore(game);
  const shortWarmth = shortOfWarmth(game);

  // Summed across the whole unlocked roster, not the three founding types,
  // and priced off the engine's own bill (see wageBill) rather than a hand
  // count multiplied here: the multiplication this replaces billed a Jade
  // Pavilion captain one wage too many, which inflated the obligations
  // figure this rail exists to show and could paint a solvent captain's
  // rail in the alarm tone. A type outside the engine's roster is one
  // payWages does not charge either, so a missing row reads as no wages
  // due rather than as a second opinion about the same absence.
  const payroll = new Map(wageBill(game).map((b) => [b.id, b]));
  const roster = unlockedWorkerTypes(game.difficulty, game.currentRound).map(
    (w) => {
      const list = game.workers[w.id] ?? [];
      return { ...w, list, due: payroll.get(w.id)?.due ?? 0 };
    },
  );
  const pendWages = roster.reduce((sum, r) => sum + r.due, 0);
  const pendMaint = game.fixedCost + game.maintenancePenalty;
  const pendTotal = pendWages + pendMaint;
  const safe = game.money >= pendTotal;
  const nW = roster.reduce((sum, r) => sum + r.list.length, 0);
  const duesAlert = (showObligations && !safe) || game.debts.length > 0;

  return (
    <div className="pm-scroll flex h-full min-h-0 flex-col overflow-y-auto">
      {/* The head leads the column rather than pinning above it: the whole
          rail scrolls as one, so these numbers travel with their tabs and a
          scrolled rail never hides half a board behind a frozen head. */}
      <div className="shrink-0">
        <VoyageHeader
          currentRound={game.currentRound}
          maxRounds={game.maxRounds}
          difficulty={game.difficulty}
        />
        <StatGrid
          money={game.money}
          score={game.score}
          showObligations={showObligations}
          shipLevel={game.shipLevel}
          pendTotal={pendTotal}
          safe={safe}
          larderOn={larderOn}
          larder={game.larder}
          shortRations={shortRations}
        />
        {coldLeg && <ColdLegChip warmth={warmth} shortWarmth={shortWarmth} />}
        <VoyageTimeline phase={game.phase} mode={game.mode} className="mt-2" />
      </div>

      <Tabs defaultValue="hold" className="mt-2.5 flex flex-col gap-2">
        <TabsList className="grid w-full shrink-0 grid-cols-4">
          <TabsTrigger value="hold" className="text-[11px]">
            Hold
          </TabsTrigger>
          <TabsTrigger value="ship" className="text-[11px]">
            Ship
          </TabsTrigger>
          <TabsTrigger value="dues" className="text-[11px]">
            Dues
            {duesAlert && (
              <span
                className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-alarm"
                aria-label="attention needed"
              />
            )}
          </TabsTrigger>
          <TabsTrigger value="log" className="text-[11px]">
            Ledger
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hold">
          <CargoHold
            game={game}
            roster={roster}
            workerCount={nW}
            colorFor={colorFor}
          />
        </TabsContent>

        <TabsContent value="ship">
          <ShipTab shipLevel={game.shipLevel} modules={game.equippedModules} />
        </TabsContent>

        <TabsContent value="dues">
          <DuesTab
            showObligations={showObligations}
            workerCount={nW}
            pendWages={pendWages}
            pendMaint={pendMaint}
            pendTotal={pendTotal}
            safe={safe}
            roster={roster}
            debts={game.debts}
            loansGiven={game.loansGiven}
            money={game.money}
            maxRounds={game.maxRounds}
            onRepayLoan={onRepayLoan}
          />

          {convoy && myUserId && (
            <ConvoyVentures game={game} convoy={convoy} myUserId={myUserId} />
          )}
        </TabsContent>

        <TabsContent value="log">
          <GameLogPanel logs={logs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
