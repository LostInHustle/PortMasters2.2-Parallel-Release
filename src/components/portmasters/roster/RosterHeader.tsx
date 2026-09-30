"use client";

import { Ship } from "lucide-react";
import { Pill } from "../shared";

/**
 * The roster panel's heading: what the panel is, and how many captains are
 * in the harbor. The count is stated here, in one place, so the pill and
 * the list under it can never disagree about the size of the room.
 */
export function RosterHeader({ memberCount }: { memberCount: number }) {
  return (
    <div className="px-4 py-3 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Ship className="h-4 w-4 text-members" /> Harbor Roster
      </h3>
      <Pill tone="sea">
        {memberCount} captain{memberCount !== 1 ? "s" : ""}
      </Pill>
    </div>
  );
}
