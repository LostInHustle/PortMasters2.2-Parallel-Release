"use client";

import { type PhasePanelProps } from "./PhaseShared";
import { PirateAttack } from "./PirateAttack";
import { SettlementBills } from "./SettlementBills";

export function Settlement({
  game,
  ctx,
  act,
  aid,
  backing,
  me,
  phaseSync,
  members,
}: Pick<
  PhasePanelProps,
  "game" | "ctx" | "act" | "aid" | "backing" | "me" | "phaseSync" | "members"
>) {
  if (!game.pirateAttackResolved) return <PirateAttack game={game} act={act} />;
  return (
    <SettlementBills
      game={game}
      ctx={ctx}
      aid={aid}
      backing={backing}
      me={me}
      phaseSync={phaseSync}
      members={members}
    />
  );
}
