// PortMasters 2.2 Parallel Release, smoke run: The Broker's Whisper.

import { purchaseIntel, snapToCheckpoint } from "@/lib/game/engine";
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
}
