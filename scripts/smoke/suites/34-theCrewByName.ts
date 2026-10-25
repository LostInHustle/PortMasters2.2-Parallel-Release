// PortMasters 2.2 Parallel Release, smoke run: The crew, by name.
//
// Two rounds hungry in a row cost the newest hand aboard, by name and for
// good.
//
// The lines this article writes for a captain are handed back to the run
// rather than read here, because the house rule covers the whole set and
// the Larder before it writes into the same one.
import {
  CREW_LOSS_AFTER_HUNGRY_ROUNDS,
  CREW_NAMES,
} from "@/lib/game/constants/crew";
import {
  crewLossRuleOn,
  healCrewIdentity,
  normalizeCrewLost,
  normalizeHungryRounds,
  settleHunger,
} from "@/lib/game/crew";
import { hireWorker, startBoonDrafting } from "@/lib/game/engine";
import { survivalLayerOn } from "@/lib/game/flags";
import { feedCrew, onShortRations, provisionFood } from "@/lib/game/larder";
import type { Worker } from "@/lib/game/types";
import { flatWorkerRoster } from "@/lib/game/types";
import type { LedgerLine } from "@/lib/game/ledger";
import {
  call,
  carriesADash,
  check,
  GAMBIT,
  ledgerSentences,
  openAuthedSocket,
  signUp,
  suffix,
  switchFor,
  voyageState,
  waitForEvent,
  withEnv,
} from "../harness";
import type { WireHistory } from "../wire";
import type { SmokeRun } from "../run";

export async function theCrewByNameSuite(run: SmokeRun): Promise<LedgerLine[]> {
  // The lines this family writes, held for the run rather than read here.
  const survivalLines: LedgerLine[] = [];
  // ========== The crew, by name ==========
  // Two rounds hungry in a row cost the newest hand aboard, by name and for
  // good. Three things are checked here, and they
  // are worth naming before the first assertion.
  //
  // The run is counted rather than reconstructed, so it is checked the way
  // it is advanced: one call a round, with the reset read on both sides of
  // it. The round the crew eats in between is the one that matters, because
  // a run that counted hungry rounds ever rather than in a row would pass
  // every other check down here and still take a hand from a captain who
  // provisioned through the shortage.
  //
  // The victim is a rule rather than a roll, and the rule is the newest
  // aboard, so the check reads the two names apart rather than the count
  // down: a roster of two that loses a member says nothing about which
  // hand went.
  //
  // The tick is checked through the engine's own Dawn rather than beside
  // it, for the reason the Larder's reduction is checked through the lap.
  // startBoonDrafting is the one function every round opens through, and a
  // price that only landed when settleHunger was called directly is
  // exactly the defect a check that called it directly would miss. The
  // second call in the same round is in there because that is the shape of
  // the defect it prevents: a round opens through more than one path.
  //
  // And a save written before any of this existed is read back, because
  // every voyage in flight the day this ships is one of those. The roster
  // has to heal to named hands rather than to blanks, and the two new
  // fields have to heal to the state of a captain who never went hungry.
  check(
    [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
      withEnv(
        "NEXT_PUBLIC_CREW_LOSS",
        value,
        switchFor(GAMBIT, crewLossRuleOn),
      ),
    ) &&
      ["off", "0", "OFF", " off ", "Off"].every(
        (value) =>
          !withEnv(
            "NEXT_PUBLIC_CREW_LOSS",
            value,
            switchFor(GAMBIT, crewLossRuleOn),
          ),
      ),
    "the crew loss rule is on for every value except the word off and the digit zero, read through the same policy the provisions layer is read through rather than through a second copy of it",
  );

  withEnv("NEXT_PUBLIC_SURVIVAL", "1", () =>
    withEnv("NEXT_PUBLIC_CREW_LOSS", "1", () => {
      // The pool the names come out of, checked before the rule that
      // spends it: a duplicate or a two word name in here is damage no
      // rule below could produce, and every roster of every voyage would
      // inherit it.
      check(
        CREW_NAMES.length > 0 &&
          CREW_NAMES.every((name) => /^[A-Za-z]+$/.test(name)) &&
          new Set(CREW_NAMES).size === CREW_NAMES.length,
        "every name the crew is drawn from is one word of letters and no name appears twice, so a hand can be named in a line the table reads and the pool itself cannot hand two hands one name",
      );

      // The run, the hand, and the ledger. The round is set rather than
      // inherited, so the round on the record is a number this check chose
      // and a record that wrote the wrong one cannot pass.
      const hungry = voyageState();
      hungry.money = 1000;
      hungry.currentRound = 7;
      hireWorker(hungry, "weaver", survivalLines);
      hireWorker(hungry, "weaver", survivalLines);
      const longestAboard = hungry.workers.weaver[0].name;
      const newestAboard = hungry.workers.weaver[1].name;
      hungry.larder = 0;
      const lossLines: LedgerLine[] = [];
      settleHunger(hungry, lossLines);
      const oneRoundIn =
        hungry.hungryRounds === 1 && hungry.crewLost.length === 0;
      settleHunger(hungry, lossLines);
      survivalLines.push(...lossLines);
      check(
        oneRoundIn &&
          hungry.hungryRounds === 0 &&
          hungry.crewLost.length === 1 &&
          hungry.crewLost[0].name === newestAboard &&
          hungry.crewLost[0].round === 7 &&
          hungry.workers.weaver.length === 1 &&
          hungry.workers.weaver[0].name === longestAboard &&
          ledgerSentences(lossLines).some((line) =>
            line.includes(newestAboard),
          ) &&
          ledgerSentences(lossLines).some((line) =>
            line.includes(`${CREW_LOSS_AFTER_HUNGRY_ROUNDS} rounds`),
          ),
        "the second round hungry in a row takes the newest hand aboard by name, writes the round it happened on beside them, resets the run and says so, while the artisan who was already at the bench keeps it",
      );

      // A name once spent is not handed out again while the voyage
      // remembers it, the lost as much as the living, and the hand who
      // replaces them is the newest aboard for the next loss.
      hireWorker(hungry, "weaver", survivalLines);
      const aboard = flatWorkerRoster(hungry).map((worker) => worker.name);
      const remembered = hungry.crewLost.map((loss) => loss.name);
      const replacement =
        hungry.workers.weaver[hungry.workers.weaver.length - 1];
      check(
        aboard.length === 2 &&
          aboard.every((name) => CREW_NAMES.includes(name)) &&
          new Set([...aboard, ...remembered]).size ===
            aboard.length + remembered.length &&
          replacement.seq > hungry.workers.weaver[0].seq,
        "a name this voyage has already spent is not handed to the next hire, and the hand who joins is the newest aboard, so the one lost over the side is not quietly replaced by a stranger wearing their name",
      );

      // A fed round resets the run rather than pausing it.
      const fed = voyageState();
      fed.money = 1000;
      hireWorker(fed, "weaver", survivalLines);
      fed.larder = 0;
      settleHunger(fed, []);
      fed.larder = 4;
      settleHunger(fed, []);
      const afterMeal = fed.hungryRounds === 0;
      fed.larder = 0;
      settleHunger(fed, []);
      check(
        afterMeal &&
          fed.hungryRounds === 1 &&
          fed.crewLost.length === 0 &&
          fed.workers.weaver.length === 1,
        "a round the crew eats resets the run, so hunger that a purchase breaks and then lets return counts again from the first bad round rather than taking a hand for a shortage the captain already provisioned through",
      );

      // The price is settled at the one moment the round's meal is, through
      // the function every round opens through.
      const dawn = voyageState();
      dawn.money = 1000;
      hireWorker(dawn, "weaver", survivalLines);
      dawn.larder = 0;
      startBoonDrafting(dawn, []);
      startBoonDrafting(dawn, []);
      const onceARound = dawn.hungryRounds === 1 && dawn.crewLost.length === 0;
      dawn.currentRound += 1;
      startBoonDrafting(dawn, []);
      check(
        onceARound &&
          dawn.hungryRounds === 0 &&
          dawn.crewLost.length === 1 &&
          dawn.workers.weaver.length === 0,
        "the run advances at the one moment a round's meal is settled, so a Dawn a client reaches twice charges one round of hunger once and the next round is the one that takes the hand",
      );

      // A save written before the crew had names. Every member is written
      // the way the build before this one wrote them: no identity at all.
      const legacy = voyageState();
      legacy.money = 1000;
      hireWorker(legacy, "weaver", []);
      hireWorker(legacy, "potter", []);
      for (const worker of flatWorkerRoster(legacy)) {
        delete (worker as Partial<Worker>).name;
        delete (worker as Partial<Worker>).seq;
      }
      legacy.hungryRounds = Number.NaN;
      healCrewIdentity(legacy);
      const healed = flatWorkerRoster(legacy);
      check(
        healed.length === 2 &&
          healed.every(
            (worker) =>
              CREW_NAMES.includes(worker.name) &&
              Number.isInteger(worker.seq) &&
              worker.seq >= 1,
          ) &&
          new Set(healed.map((worker) => worker.name)).size === 2 &&
          new Set(healed.map((worker) => worker.seq)).size === 2 &&
          legacy.hungryRounds === 0 &&
          legacy.crewLost.length === 0,
        "a save written before the crew had names heals to a roster of people rather than of blanks, each with a name from the pool and a number of their own, and a run it cannot read heals to nobody hungry yet",
      );

      // Two hands claiming one name, which the draw exists to prevent and
      // a hand written save can still produce.
      const twins = voyageState();
      twins.money = 1000;
      hireWorker(twins, "weaver", survivalLines);
      hireWorker(twins, "weaver", survivalLines);
      const claimant = twins.workers.weaver[0].name;
      twins.workers.weaver[1].name = claimant;
      healCrewIdentity(twins);
      check(
        twins.workers.weaver[0].name === claimant &&
          twins.workers.weaver[1].name !== claimant &&
          CREW_NAMES.includes(twins.workers.weaver[1].name) &&
          twins.workers.weaver[0].seq !== twins.workers.weaver[1].seq,
        "a stored name is kept rather than redrawn, and two hands claiming one name resolve to one claimant and one fresh draw, since a roster of two people called Ada is exactly what the draw is for",
      );

      check(
        normalizeHungryRounds(undefined) === 0 &&
          normalizeHungryRounds(Number.NaN) === 0 &&
          normalizeHungryRounds(-3) === 0 &&
          normalizeHungryRounds(2.9) === 2 &&
          normalizeCrewLost(undefined).length === 0 &&
          normalizeCrewLost("Runa").length === 0 &&
          normalizeCrewLost([{ name: "Runa", round: 4.8 }, null, 7, {}])
            .length === 1 &&
          normalizeCrewLost([{ name: "Runa", round: 4.8 }])[0].round === 4,
        "a run or a record of losses this build cannot read heals to none rather than to an invented hand, while a loss that does name one survives the read with the round it was taken on",
      );

      // The same two rounds with the rule switched off, read inside the
      // layer that is on. Read anywhere else this check would pass for the
      // wrong reason: with the provisions off there is no shortage to lose
      // anyone to, and the check would be measuring that instead.
      check(
        withEnv("NEXT_PUBLIC_CREW_LOSS", "off", () => {
          const spared = voyageState();
          spared.money = 1000;
          hireWorker(spared, "weaver", []);
          spared.larder = 0;
          const sparedLines: LedgerLine[] = [];
          settleHunger(spared, sparedLines);
          settleHunger(spared, sparedLines);
          return (
            !crewLossRuleOn(GAMBIT) &&
            spared.hungryRounds === 0 &&
            spared.crewLost.length === 0 &&
            spared.workers.weaver.length === 1 &&
            spared.workers.weaver[0].name.length > 0 &&
            sparedLines.length === 0
          );
        }),
        "with the loss rule switched off hunger never takes a hand: the run stays at zero, the record stays empty and no line is spoken, while the roster keeps the names it already carries, so the rule can be rolled back without erasing anyone",
      );

      // And the layer governs it from above, which is why the two switches
      // are separate readings rather than one.
      check(
        withEnv("NEXT_PUBLIC_SURVIVAL", "off", () => {
          const unfed = voyageState();
          unfed.money = 1000;
          hireWorker(unfed, "weaver", []);
          unfed.larder = 0;
          settleHunger(unfed, []);
          settleHunger(unfed, []);
          return (
            crewLossRuleOn(GAMBIT) &&
            unfed.hungryRounds === 0 &&
            unfed.crewLost.length === 0 &&
            unfed.workers.weaver.length === 1
          );
        }),
        "and with the provisions switched off a captain loses nobody whatever the loss rule says, because a shortage the layer is not counting is not a shortage a hand can be taken for",
      );
    }),
  );

  // The two files this feature owns, read as files rather than asserted
  // about, so the rule covers their comments as well as the lines they
  // write. It is the same reading the standing order record and the
  // voyage log are held to, and it is the one check down here that no
  // runtime case can make.
  check(
    !carriesADash("src/lib/game/crew.ts") &&
      !carriesADash("src/lib/use-game-session.ts") &&
      !carriesADash("src/components/portmasters/game/phases/WorkerMgmt.tsx") &&
      !carriesADash("src/components/portmasters/game/phases/Endgame.tsx"),
    "and the module the rule lives in, the hook that heals a voyage on load and the two panels a captain reads the crew on hold the house rule in their comments as well as in their code",
  );

  // The other side of the switch, read on its own so the check above can
  // stay about the rules rather than about the flag.
  check(
    withEnv("NEXT_PUBLIC_SURVIVAL", "off", () => {
      const dark = voyageState();
      dark.money = 100;
      hireWorker(dark, "weaver", []);
      dark.larder = 0;
      const darkLines: LedgerLine[] = [];
      feedCrew(dark, darkLines);
      const boughtNothing = provisionFood(dark, "Grain", 3, darkLines) === 0;
      return (
        !survivalLayerOn(GAMBIT) &&
        !onShortRations(dark) &&
        dark.larder === 0 &&
        dark.larderFedRound === 0 &&
        dark.money === 100 &&
        boughtNothing &&
        darkLines.length === 0
      );
    }),
    "with the switch off nothing is eaten, nothing is bought, no round is stamped and no shortage is claimed, so the base game is exactly as it was",
  );

  // The fleet sees a hungry crew. The state has to be publicly visible,
  // and its visibility rides the status broadcast the harbor already
  // carries, so what is
  // checked here is the frame every captain is already listening to
  // rather than a channel built for this. A fed crew reports no mark at
  // all, which is the allow list read run the other way: only an
  // explicit true is a hungry crew, so a client that never had a larder
  // reads as fed rather than as unknown.
  const larderHome = await signUp("lard_h");
  run.extraAccounts.push(larderHome);
  const larderRoom = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: larderHome.cookie,
      body: JSON.stringify({
        name: `Smoke larder ${suffix}`,
        isPublic: false,
      }),
    },
  );
  if (larderRoom.status !== 200) {
    throw new Error("No harbor to report a hungry crew in.");
  }
  const larderRoomId = larderRoom.body.room.id;
  const larderSocket = await openAuthedSocket(larderHome);
  run.sockets.push(larderSocket);
  const larderSeated = waitForEvent<WireHistory>(
    larderSocket,
    "chat:history",
    (payload) => payload?.roomId === larderRoomId,
  );
  larderSocket.emit("room:join", { roomId: larderRoomId });
  await larderSeated;

  const larderFrames: Array<{ shortRations?: boolean }> = [];
  larderSocket.on(
    "game:status",
    (payload: { user?: { id?: string }; shortRations?: boolean }) => {
      if (payload?.user?.id !== larderHome.id) return;
      larderFrames.push(payload);
    },
  );
  const reportLarder = (shortRations: boolean) => {
    larderSocket.emit("game:status", {
      roomId: larderRoomId,
      round: 1,
      phase: "market",
      phaseLabel: "Market",
      gold: 100,
      reputation: 0,
      shipLevel: 0,
      gameOver: false,
      shortRations,
    });
  };
  reportLarder(true);
  await new Promise((resolve) => setTimeout(resolve, 400));
  reportLarder(false);
  await new Promise((resolve) => setTimeout(resolve, 400));
  check(
    larderFrames.length === 2 &&
      larderFrames[0].shortRations === true &&
      larderFrames[1].shortRations === undefined,
    "a hungry crew reaches the fleet on the status frame every captain already listens to, and a fed one reports no mark at all",
  );

  return survivalLines;
}
