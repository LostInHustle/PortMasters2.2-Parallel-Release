"use client";

import { bandFor } from "@/lib/game/engine";
import type { PlayerDetailData } from "@/lib/use-player-detail";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Eye, Loader2 } from "lucide-react";
import { IconButton } from "./IconButton";

// The Partial Sight peek button and its popover. Renders the eye icon as
// the trigger, then a small grid of banded cargo counts inside the
// popover. The popover is read only: clicking the row itself still opens
// the full PlayerDetailModal in GameRoom.
export function PeekButton({
  targetName,
  onPeek,
  loading,
  snapshot,
}: {
  targetName: string;
  onPeek: () => void;
  loading: boolean;
  snapshot: PlayerDetailData | null;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton
          label={`Peek at ${targetName}'s cargo`}
          title={`Partial sight peek at ${targetName}`}
          onClick={(e) => {
            e.stopPropagation();
            onPeek();
          }}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </IconButton>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 text-xs"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-members" />
          <span className="font-semibold">{targetName}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            partial sight
          </span>
        </div>
        {!snapshot ? (
          <p className="text-muted-foreground py-2 text-center">
            {loading
              ? "Asking the harbor…"
              : "No snapshot yet. Tap the eye again."}
          </p>
        ) : (
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gold</span>
              <b className="capitalize">{bandFor(snapshot.money)}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reputation</span>
              <b className="capitalize">{bandFor(snapshot.score)}</b>
            </div>
            <div className="mt-1 border-t border-black/5 dark:border-white/10 pt-1">
              {Object.entries(snapshot.inventory)
                .filter(([, n]) => n > 0)
                .slice(0, 6)
                .map(([item, n]) => (
                  <div key={item} className="flex justify-between">
                    <span className="text-muted-foreground truncate">
                      {item}
                    </span>
                    <b className="capitalize">{bandFor(n)}</b>
                  </div>
                ))}
              {Object.values(snapshot.inventory).every((n) => n === 0) && (
                <p className="text-muted-foreground italic">Hold is empty.</p>
              )}
            </div>
          </div>
        )}
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Bands are read from {targetName}'s live snapshot. The harbor master
          only shares what your standing allows.
        </p>
      </PopoverContent>
    </Popover>
  );
}
