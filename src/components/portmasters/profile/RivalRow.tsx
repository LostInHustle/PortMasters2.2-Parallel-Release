"use client";

import { RivalEntry } from "@/types/realtime/standings";
import { motion } from "framer-motion";
import { Avatar, Pill } from "../shared";

export function RivalRow({
  rival,
  index,
}: {
  rival: RivalEntry;
  index: number;
}) {
  // The route already projects every line so that "wins" is the
  // viewer's and "losses" is the partner's, whichever side of the
  // original record the viewer sat on. meetings is the row count,
  // so wins + losses + ties equals it and the bar below always
  // fills exactly to the end.
  const myWins = rival.wins;
  const theirWins = rival.losses;
  const ties = rival.ties;
  const total = rival.meetings;
  const myRate = total > 0 ? Math.round((myWins / total) * 100) : 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="pm-glass pm-ink-hover rounded-2xl p-4"
    >
      <div className="flex items-center gap-3">
        <Avatar
          hue={rival.partner.avatarHue}
          name={rival.partner.displayName}
          size={40}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium pm-truncate">
            {rival.partner.displayName}
          </div>
          <div className="text-xs text-muted-foreground">
            {total} {total === 1 ? "meeting" : "meetings"}
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold text-profile">{myWins}</span>
            <span className="text-muted-foreground">vs</span>
            <span className="font-bold text-alarm">{theirWins}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {ties} ties {myRate > 50 && <Pill tone="gain">Leading</Pill>}
          </div>
        </div>
      </div>
      {total > 0 && (
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="bg-celadon"
            style={{ width: `${(myWins / total) * 100}%` }}
          />
          <div
            className="bg-muted-foreground/30"
            style={{ width: `${(ties / total) * 100}%` }}
          />
          <div
            className="bg-alarm"
            style={{ width: `${(theirWins / total) * 100}%` }}
          />
        </div>
      )}
    </motion.div>
  );
}
