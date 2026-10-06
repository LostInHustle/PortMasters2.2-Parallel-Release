// PortMasters 2.2 Parallel Release, smoke run: the way out.
//
// The harbor's two exits a captain can reach from a seat they cannot
// move: the Leave press, which asks before it writes a seat off once the
// voyage is under way, and the finished voyage screens, which offer a
// captain waiting on the host a way to set out for a new harbor instead.
//
// Nothing here needs a server, a captain or a harbor: both exits are
// shapes in the client source, held to their wiring rather than to a
// live room, the same way the mutes and the keys' article walks src for
// its key literals. What it holds is that the leave press routes through
// one guard before it commits the write off, that the confirm it opens
// is the room's own dialog wired back to the leave flow rather than to a
// second one, and that the two finished voyage screens take their way
// out from the room instead of drawing a press that goes nowhere.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { check } from "../harness";

export async function theWayOutSuite(): Promise<void> {
  const repoRoot = join(import.meta.dirname, "..", "..", "..");
  const sourceOf = (relative: string) =>
    readFileSync(join(repoRoot, ...relative.split("/")), "utf8");

  const gameRoom = sourceOf("src/components/portmasters/GameRoom.tsx");
  const gameModals = sourceOf("src/components/portmasters/game/GameModals.tsx");
  const phasePanel = sourceOf(
    "src/components/portmasters/game/GamePhasePanel.tsx",
  );
  const endgame = sourceOf(
    "src/components/portmasters/game/phases/Endgame.tsx",
  );
  const bankruptcy = sourceOf(
    "src/components/portmasters/game/phases/Bankruptcy.tsx",
  );

  check(
    gameRoom.includes(
      'state.game.phase !== "harbor" && !state.game.gameOver',
    ) &&
      /function requestLeave\(\)[\s\S]{0,230}setLeaveConfirmOpen\(true\)[\s\S]{0,140}void handleLeave\(\)/.test(
        gameRoom,
      ),
    "the leave press asks before it writes a seat off: mid voyage it opens the confirm, and from the harbor or after the voyage ends it goes straight through to the one leave flow",
  );

  check(
    /export function LeaveConfirmModal\(/.test(gameModals) &&
      gameRoom.includes("<LeaveConfirmModal") &&
      gameRoom.includes("onConfirm={handleLeave}"),
    "the confirm the ask draws is the room's own dialog, wired back to the leave flow rather than to a second one",
  );

  check(
    endgame.includes("Sail Again") &&
      bankruptcy.includes("Sail Again") &&
      phasePanel.includes("onLeave={onLeave}") &&
      gameRoom.includes("onLeave={requestLeave}"),
    "both finished voyage screens offer the way out to a captain waiting on the host, threaded from the room's one leave flow",
  );
}
