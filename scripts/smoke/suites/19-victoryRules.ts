// PortMasters 2.2 Parallel Release, smoke run: The victory rules.

import {
  acceptBarterOffer,
  postBarterOffer,
  refundBarterOffer,
  settleBarterTrade,
} from "@/lib/game/engine";
import type { Flourish, GambitRole } from "@/lib/game/gambit";
import { checkSave, snapshotFromSave } from "@/lib/game/integrity";
import { drawObjective, objectiveTotalItems } from "@/lib/game/objectives";
import { createInitialGameState } from "@/lib/game/types";
import type { CaptainEnding } from "@/lib/game/victory";
import {
  BROKER_PAYOUT_TARGET,
  PIRATE_STANDING_FLOOR,
  evaluateVictory,
  flourishMet,
  readEnding,
  victoryLine,
} from "@/lib/game/victory";
import { check } from "../harness";

export async function victoryRulesSuite(): Promise<void> {
  // H4. What a card is worth at the end of a voyage, which is arithmetic
  // over numbers other code produced, so all of it is settled here rather
  // than over a socket: the same reason the deck and the draw above are
  // checked without a connection between them. Where those numbers come
  // from is the other half, and the concluded voyage in the section below
  // is where that half is read back off the rows it left behind.

  // ---- The peer ledger ----
  // The one number a Broker is measured on. A trade has two sides and each
  // side runs on its own captain's client, so the property that matters is
  // that the two sides read the same trade: whatever one counts as profit,
  // the other counts as loss, and nothing else in the game moves either.
  const seller = createInitialGameState();
  const buyer = createInitialGameState();
  const tradeLogs: string[] = [];
  // A purse deep enough to pay with, set rather than earned: this block is
  // about what settles, not about how a captain afforded it. The seller's
  // side needs no such help, because the stock a voyage opens with is the
  // Hemp it escrows below.
  buyer.money = 500;
  const offerPosted = postBarterOffer(
    seller,
    "Hemp",
    4,
    "Gold",
    250,
    tradeLogs,
  );
  const taken = acceptBarterOffer(buyer, "Gold", 250, "Hemp", 4, tradeLogs);
  settleBarterTrade(seller, "Gold", 250, "Hemp", 4, tradeLogs);
  check(
    offerPosted && taken,
    "a trade of four Hemp for 250 Gold posts and is taken",
  );
  check(
    buyer.peerTradeProfit === -250,
    "and the captain who paid the Gold counts the whole payment against their profit",
  );
  check(
    seller.peerTradeProfit === 250,
    "while the one who took it counts that same trade as profit",
  );
  check(
    seller.peerTradeProfit + buyer.peerTradeProfit === 0,
    "so the two sides of one settled trade always sum to nothing at all",
  );

  // Escrow is not a trade. An offer that is withdrawn, or swept off the
  // board when the voyage moves on, moved goods and moved no coin, and a
  // ledger that counted it would pay a captain for changing their mind.
  const withdrawn = createInitialGameState();
  const refundLogs: string[] = [];
  postBarterOffer(withdrawn, "Hemp", 2, "Gold", 90, refundLogs);
  refundBarterOffer(withdrawn, "Hemp", 2, refundLogs);
  check(
    withdrawn.peerTradeProfit === 0,
    "and an offer that is withdrawn counts for nothing at all",
  );

  // The other half of the role's distinction: a trade that moved no coin
  // is a trade the card is not measured on, however much cargo changed
  // hands.
  const swapper = createInitialGameState();
  const swapped = createInitialGameState();
  const swapLogs: string[] = [];
  postBarterOffer(swapper, "Hemp", 3, "Silk", 2, swapLogs);
  acceptBarterOffer(swapped, "Silk", 2, "Hemp", 3, swapLogs);
  settleBarterTrade(swapper, "Silk", 2, "Hemp", 3, swapLogs);
  check(
    swapper.peerTradeProfit === 0 && swapped.peerTradeProfit === 0,
    "and goods traded for goods move the ledger on neither side",
  );

  // ---- The three cards ----
  // Every branch of every role, walked on an ending built for it. A
  // commission of this block's own is drawn rather than named, so the
  // delivery goal below is measured against whatever the deck deals. It is
  // deliberately not the harbor's, which is drawn further down.
  const victoryCommission = drawObjective("a-victory-commission");
  const endingOf = (over: Partial<CaptainEnding> = {}): CaptainEnding => ({
    ...readEnding(null, { gold: 0, reputation: 0, bankrupt: false }),
    ...over,
  });
  const judge = (
    role: GambitRole,
    met: boolean,
    ending: Partial<CaptainEnding>,
    flourish: Flourish | null = null,
  ) =>
    evaluateVictory({
      role,
      objective: victoryCommission,
      objectiveMet: met,
      flourish,
      ending: endingOf(ending),
    });

  check(
    judge("honest", true, {}),
    "an Honest captain wins a voyage whose commission the fleet met",
  );
  check(
    !judge("honest", false, {}),
    "and wins nothing when the fleet fell short of it",
  );

  // The four shapes a personal goal comes in, each one a line of
  // arithmetic against the ending, and each one checked at its boundary
  // rather than in the middle: a goal is met at the amount and unmet a
  // single unit below it.
  const purseGoal = {
    id: "smoke_purse",
    kind: "purse" as const,
    amount: 350,
  };
  const repGoal = {
    id: "smoke_rep",
    kind: "reputation" as const,
    amount: 120,
  };
  const stockGoal = {
    id: "smoke_stock",
    kind: "stock" as const,
    good: "Hemp",
    amount: 4,
  };
  check(
    judge("honest", true, { gold: 350 }, purseGoal) &&
      !judge("honest", true, { gold: 349 }, purseGoal),
    "a purse goal counts the Gold a captain ends the voyage holding",
  );
  check(
    judge("honest", true, { reputation: 120 }, repGoal) &&
      !judge("honest", true, { reputation: 119 }, repGoal),
    "a standing goal counts their rating",
  );
  check(
    judge("honest", true, { held: { Hemp: 4 } }, stockGoal) &&
      !judge("honest", true, { held: { Hemp: 3 } }, stockGoal),
    "and a hold goal counts what is still in the hold after the commission has been paid",
  );

  // The delivery goal is the one that is clamped, and the clamp is the
  // property worth checking: a captain can only hand over what the
  // commission still owed, so a save claiming more than that is claiming a
  // delivery the voyage could not have recorded.
  const fullDelivery: Record<string, number> = {};
  for (const owedGood of victoryCommission.resources) {
    fullDelivery[owedGood.type] = owedGood.required;
  }
  const wholeCommission = objectiveTotalItems(victoryCommission);
  check(
    flourishMet(
      {
        id: "smoke_delivery",
        kind: "delivery",
        amount: wholeCommission,
      },
      endingOf({ delivered: fullDelivery }),
      victoryCommission,
    ),
    `handing over the whole commission meets a goal as wide as the commission (${wholeCommission} items)`,
  );
  const overclaimed = { ...fullDelivery };
  overclaimed[victoryCommission.resources[0].type] += 100;
  check(
    !flourishMet(
      {
        id: "smoke_delivery",
        kind: "delivery",
        amount: wholeCommission + 1,
      },
      endingOf({ delivered: overclaimed }),
      victoryCommission,
    ),
    "and a save claiming a hundred items past the commission counts none of the excess",
  );

  // The Broker, which is the one card that does not care what the fleet
  // did. Both directions of that are checked together, because the design
  // claim is precisely that the commission is neither required nor a bar.
  check(
    judge("broker", false, { peerTradeProfit: BROKER_PAYOUT_TARGET }),
    "a Broker reaches the target and wins on a voyage the fleet fell short of",
  );
  check(
    judge("broker", true, { peerTradeProfit: BROKER_PAYOUT_TARGET + 1 }),
    "and wins a voyage the fleet completed too, which is the seat being greedy rather than hostile",
  );
  check(
    !judge("broker", true, { peerTradeProfit: BROKER_PAYOUT_TARGET - 1 }),
    "while one Gold short of the target is one Gold short of winning",
  );

  // The Pirate, which is the one card that needs the fleet to fail and
  // still has to be denied to a captain who spent the voyage hiding. The
  // three ways to be denied are checked one at a time.
  check(
    judge("pirate", false, { reputation: PIRATE_STANDING_FLOOR }),
    "a Pirate wins a voyage that fell short, from the floor and no lower",
  );
  check(
    !judge("pirate", true, { reputation: PIRATE_STANDING_FLOOR }),
    "and wins nothing on a voyage the fleet completed",
  );
  check(
    !judge("pirate", false, {
      reputation: PIRATE_STANDING_FLOOR,
      bankrupt: true,
    }),
    "nor one they ended bankrupt, however far short the fleet fell",
  );
  check(
    !judge("pirate", false, { reputation: PIRATE_STANDING_FLOOR - 1 }),
    "nor one they spent below the floor of standing the card demands",
  );

  check(
    victoryLine("broker", null).includes(String(BROKER_PAYOUT_TARGET)),
    "and the target printed on a Broker's card is read from the same knob the rule is",
  );

  // ---- Reading an ending ----
  // The rules are only as sound as the numbers they are handed, and those
  // arrive out of a save blob a client wrote. Every field is treated as
  // untrusted, the same discipline the Ledger Integrity Pass reads money
  // and score with.
  const reported = { gold: 40, reputation: 30, bankrupt: false };
  const unwritten = readEnding(null, reported);
  check(
    unwritten.held.Hemp === 0 &&
      unwritten.delivered.Hemp === 0 &&
      unwritten.peerTradeProfit === 0,
    "a blob with no hold, no deliveries and no ledger reads as a captain who kept none rather than as a broken one",
  );
  const written = readEnding(
    {
      inventory: { Hemp: 3 },
      objectiveDelivered: { Hemp: 6 },
      peerTradeProfit: 450,
    },
    reported,
  );
  check(
    written.held.Hemp === 3 &&
      written.delivered.Hemp === 6 &&
      written.peerTradeProfit === 450,
    "and a blob that carries them reads back as it was written",
  );
  check(
    readEnding({ peerTradeProfit: "2200" }, reported).peerTradeProfit === 0,
    "a ledger that is not a number is passed over rather than repaired",
  );
  check(
    readEnding({ gold: 999999, peerTradeProfit: 10 }, reported).gold ===
      reported.gold,
    "and no save can talk over the finish report the row is built from",
  );

  // ---- The pass that guards them ----
  // The Broker is the one role that wins alone, so a doctored save is the
  // cheapest win in the mode and the guard has to know the field.
  check(
    snapshotFromSave({ peerTradeProfit: 2200 })?.peerTradeProfit === 2200,
    "the Ledger Integrity Pass reads the peer ledger out of a save",
  );
  check(
    checkSave({ peerTradeProfit: 1e12 }, 3).severity === "impossible",
    "and a ledger no harbor could have produced is impossible",
  );
  check(
    checkSave({ peerTradeProfit: -500 }, 3).severity === "ok",
    "while a captain who spent more on trade than they took in is no forger",
  );
}
