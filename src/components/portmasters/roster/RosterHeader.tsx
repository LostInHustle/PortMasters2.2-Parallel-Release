"use client";

import { Ship } from "lucide-react";
import { Pill } from "../shared";
import { PanelHeader } from "../PanelHeader";

/**
 * The roster panel's heading: what the panel is, and how many captains are
 * in the harbor. The count is stated here, in one place, so the pill and
 * the list under it can never disagree about the size of the room.
 *
 * The head itself is the shared PanelHeader, which the captain's rail and
 * the chat wear too: the three panels a captain folds are folded the same
 * way, in the same place, with the same mark. `collapsed` and `onToggle`
 * travel straight through, because the fold is owned by the room rather
 * than by this file (see usePanelPrefs in GameRoom): folding the roster
 * hands its height to the chat below it.
 */
export function RosterHeader({
  memberCount,
  collapsed,
  onToggle,
}: {
  memberCount: number;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="px-4 py-3 border-b border-black/5 dark:border-white/10">
      <PanelHeader
        icon={<Ship className="h-3.5 w-3.5 text-members" />}
        title="Harbor Roster"
        meta={
          <Pill tone="sea">
            {memberCount} captain{memberCount !== 1 ? "s" : ""}
          </Pill>
        }
        collapsed={collapsed}
        onToggle={onToggle}
      />
    </div>
  );
}
