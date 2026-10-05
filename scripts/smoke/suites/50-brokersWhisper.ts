// PortMasters 2.2 Parallel Release, smoke run: The Broker's Whisper.

import {
  getIntelCost,
  purchaseIntel,
  snapToCheckpoint,
} from "@/lib/game/engine";
import { cardById } from "@/lib/game/cards";
import { check, voyageState } from "../harness";

// The rumor's promise, held end to end. The boards below are dealt through
// the real lifecycle rather than written out by hand: snapToCheckpoint runs
// the engine's own startMarket and startOrders, and the rumor is bought
// between them the way a captain buys it, on the Market screen and before
// the board is dealt.
export async function brokersWhisperSuite(): Promise<void> {
  const whisperState = (suffix: string) => {
    const state = voyageState();
    const ctx = { seedBase: `smoke:whisper:${suffix}`, harborId: "harbor-a" };
    snapToCheckpoint(state, ctx, 1, "market", []);
    return { state, ctx };
  };

  const early = whisperState("early");
  const moneyBefore = early.state.money;
  const buyLogs: string[] = [];
  purchaseIntel(early.state, buyLogs);
  const rumors = early.state.revealedIntel.map((i) => ({ ...i }));
  check(
    rumors.length > 0 &&
      early.state.money < moneyBefore &&
      buyLogs.some((line) => line.includes("Broker's Whisper")),
    `a rumor bought on the Market screen is billed and revealed (${rumors.length} rumor${rumors.length === 1 ? "" : "s"} for ${moneyBefore - early.state.money} Gold)`,
  );
  snapToCheckpoint(early.state, early.ctx, 1, "orders", []);
  check(
    rumors.every((i) =>
      early.state.customerCards.some(
        (c) =>
          c.demandPort === i.port && c.resources.some((r) => r.type === i.item),
      ),
    ),
    "every whisper a captain paid for is dealt as an order at the harbour it named for the good it named, so the Broker's word is always good about both halves of what it sold",
  );

  const afterBoard = whisperState("late");
  snapToCheckpoint(afterBoard.state, afterBoard.ctx, 1, "orders", []);
  const afterMoney = afterBoard.state.money;
  const afterIntel = afterBoard.state.revealedIntel.length;
  const afterLogs: string[] = [];
  purchaseIntel(afterBoard.state, afterLogs);
  check(
    afterBoard.state.money === afterMoney &&
      afterBoard.state.revealedIntel.length === afterIntel &&
      afterLogs.some((line) => line.includes("only deals during Market")),
    "a press that arrives after the board is dealt is refused rather than billed, because an order it promised could never appear once the board is down",
  );

  // ---- The network's own fee ----
  // The bug cycle's own shape: the fee was billed once per paid reveal,
  // while the button that led to the press displayed one price and the
  // guard above it checked that same one. A hull carrying the Brokers'
  // Network therefore paid double what its own button named, and a purse
  // holding more than one fee but less than two passed the guard and
  // ended below zero. Read through the module's own promise: one price,
  // two whispers.
  const cardOf = (id: string) => {
    const card = cardById(id);
    if (card === null) {
      throw new Error(
        `the pool no longer ships ${id}, and a fixture here reads it by name`,
      );
    }
    return card;
  };
  const networked = whisperState("network");
  networked.state.equippedModules.push(cardOf("brokers_network"));
  // The two whispers have to have somewhere to come from. The seeded
  // pool usually holds five; this tops it up in the rare seed that dealt
  // fewer so the check measures the fee rather than the harbor's stock.
  for (const tag of ["Wood", "Metal"]) {
    if (networked.state.marketDemandTags.length >= 2) break;
    if (!networked.state.marketDemandTags.includes(tag)) {
      networked.state.marketDemandTags.push(tag);
    }
  }
  const networkFee = getIntelCost(networked.state);
  const networkBefore = networked.state.money;
  const revealsBefore = networked.state.revealedIntel.length;
  purchaseIntel(networked.state, []);
  const gained = networked.state.revealedIntel.length - revealsBefore;
  check(
    networkFee === 2 &&
      networkBefore - networked.state.money === networkFee &&
      gained === 2,
    `the network's purchase bills the one fee its button names and brings back its two whispers (${gained} for ${networkBefore - networked.state.money} Gold)`,
  );

  const nearEmpty = whisperState("near-empty");
  nearEmpty.state.equippedModules.push(cardOf("brokers_network"));
  nearEmpty.state.money = getIntelCost(nearEmpty.state) + 1;
  purchaseIntel(nearEmpty.state, []);
  check(
    nearEmpty.state.money === 1,
    "and a purse holding one fee plus a coin still stands at a coin afterwards, where the per reveal billing left the press with less than nothing",
  );
}
