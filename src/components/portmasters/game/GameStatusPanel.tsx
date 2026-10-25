"use client";

import {
  maintenanceDue,
  unlockedWorkerRoster,
  wagesDue,
} from "@/lib/game/engine";
import { onShortRations } from "@/lib/game/larder";
import { survivalLayerOn } from "@/lib/game/flags";
import {
  garmentsLayerOn,
  legIsCold,
  shortOfWarmth,
  warmthScore,
} from "@/lib/game/garments";
import { t } from "@/lib/game/i18n";
import { crewSize, type GameState } from "@/lib/game/types";
import type { WorkerType } from "@/lib/game/constants/crew";
import { useConvoy } from "@/lib/use-convoy";
import { VoyageTimeline } from "./VoyageTimeline";
import type { LedgerLine } from "@/lib/game/ledger";
import { GameLogPanel } from "./GameLogPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoyageHeader } from "./status/VoyageHeader";
import { StatGrid } from "./status/StatGrid";
import { ColdRoundChip } from "./status/ColdRoundChip";
import { CargoHold } from "./status/CargoHold";
import { ShipTab } from "./status/ShipTab";
import { DuesTab } from "./status/DuesTab";
import { ConvoyVentures } from "./status/ConvoyVentures";
import { Term } from "../Term";

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
 * The handful of numbers that are checked every few seconds (round, waters,
 * Gold, reputation, and what is owed at round end) lead the column, and
 * everything else is a tab, so the ledger is a peer tab rather than a
 * footnote below the fold. Five sections stacked in one narrow column
 * (Captain's Log, Vessel Status, Cargo Hold, Outstanding Loans, Dues) would be an unavoidably long vertical scroll in a rail
 * roughly 260px wide, and the ledger, which a captain consults constantly,
 * would sit furthest from the eye.
 *
 * The panel is one scroll container at every window height, and the tabs are
 * laid out at their natural height inside it: scrolling the rail moves the
 * whole column, head included, and no section box ever owns a scrollbar of
 * its own (the ledger's tail box is the one deliberate exception, because a
 * log's whole job is to scroll its own newest lines into view). Whatever
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
  logs: LedgerLine[];
  onRepayLoan?: (debtId: string) => void;
  // The hook's own return rather than a shape written out again here, so a
  // field the hook gains reaches the panel below with it.
  convoy?: ReturnType<typeof useConvoy>;
  myUserId?: string;
  colorFor?: (item: string) => string | undefined;
}) {
  const showObligations = !["harbor", "dawn", "endgame", "bankruptcy"].includes(
    game.phase,
  );
  // Read once for the two decisions
  // below, since it is the same answer to both: whether the layer is
  // running decides whether the stat exists at all, and if it is running,
  // whether the crew is short decides what color the number wears.
  const larderOn = survivalLayerOn(game.mode);
  const shortRations = larderOn && onShortRations(game);
  // The weather and the wardrobe, read once
  // each for the chip below. The layer decides whether there is a chip at
  // all, the tag decides whether this round is one worth saying anything
  // about, and the score is the same sum the settlement tick freezes
  // against, so the warning printed here and the check that bites the crew
  // cannot read differently.
  const garmentsOn = garmentsLayerOn(game.mode);
  const coldRound = garmentsOn && legIsCold(game);
  const warmth = warmthScore(game);
  const shortWarmth = shortOfWarmth(game);

  // The whole unlocked roster, not the three founding types, each type
  // with its hands and the wage it is due: the join lives in the engine
  // now (see unlockedWorkerRoster), so this rail and Artisan Management
  // cannot come to disagree about who owes what.
  //
  // The two figures below are not summed from that roster. The wage is
  // the engine's own reading of the bill it is about to charge, and the
  // hands are the whole crew rather than the visible part of it, so the
  // rail and the settle sheet quote one number each rather than two
  // walks of the same list that can only agree by accident.
  const roster = unlockedWorkerRoster(game);
  const pendWages = wagesDue(game);
  const pendMaint = maintenanceDue(game);
  const pendTotal = pendWages + pendMaint;
  const safe = game.money >= pendTotal;
  const nW = crewSize(game);
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
        {coldRound && (
          <ColdRoundChip warmth={warmth} shortWarmth={shortWarmth} />
        )}
        <VoyageTimeline phase={game.phase} mode={game.mode} className="mt-2" />
      </div>

      <Tabs defaultValue="hold" className="mt-2.5 flex flex-col gap-2">
        <TabsList className="grid w-full shrink-0 grid-cols-4">
          <TabsTrigger value="hold" className="text-[11px]">
            <Term term="Hold" focusable={false}>
              {t("Hold")}
            </Term>
          </TabsTrigger>
          <TabsTrigger value="ship" className="text-[11px]">
            {t("Ship")}
          </TabsTrigger>
          <TabsTrigger value="dues" className="text-[11px]">
            <Term term="Dues" focusable={false}>
              {t("Dues")}
            </Term>
            {duesAlert && (
              <span
                className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-alarm"
                aria-label={t("attention needed")}
              />
            )}
          </TabsTrigger>
          <TabsTrigger value="log" className="text-[11px]">
            {t("Ledger")}
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
            atHarbor={game.phase === "harbor"}
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
