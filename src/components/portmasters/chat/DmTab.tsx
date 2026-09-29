"use client";

// =====================================================================
// The Direct tab of the room's chat panel: one captain, or the list to
// pick one from.
//
// It is here rather than inside ChatPanel because it is a switch around
// the panel rather than a mode of it: with a captain picked it hands the
// conversation to ChatPanel and puts a header naming that captain above
// it, and with nobody picked it draws the roster there is to choose from.
// Both halves are addressed to one captain's own screen, so nothing here
// ever reaches the room channel.
// =====================================================================

import type { Socket } from "socket.io-client";
import type { ChatMessage, PublicUser } from "@/lib/api";
import { Avatar } from "../shared";
import { Button } from "@/components/ui/button";
import { ChatPanel, type ChatTrade } from "../ChatPanel";
import { MessageCircle } from "lucide-react";

export function DmTab({
  socket,
  me,
  target,
  history,
  trade,
  candidates,
  onPick,
  onClear,
}: {
  socket: Socket | null;
  me: PublicUser;
  target: PublicUser | null;
  history: ChatMessage[];
  trade?: ChatTrade;
  candidates: Array<PublicUser & { roomId?: string | null }>;
  onPick: (u: PublicUser) => void;
  onClear: () => void;
}) {
  // Deduplicate candidates by id, exclude self.
  const seen = new Map<string, PublicUser & { roomId?: string | null }>();
  for (const c of candidates)
    if (c.id !== me.id && !seen.has(c.id)) seen.set(c.id, c);
  const list = Array.from(seen.values());

  if (target) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-3 py-2 border-b border-black/5 dark:border-white/10 flex items-center gap-2">
          <Avatar hue={target.avatarHue} name={target.displayName} size={24} />
          <span className="text-xs font-medium truncate">
            {target.displayName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 px-2 text-[11px]"
            onClick={onClear}
          >
            Switch
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          <ChatPanel
            socket={socket}
            me={me}
            mode="dm"
            other={target}
            initialMessages={history}
            trade={trade}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-black/5 dark:border-white/10 text-[11px] text-muted-foreground">
        Pick a captain to message privately
      </div>
      <div className="pm-scroll flex-1 min-h-0 overflow-y-auto">
        <div className="p-2 space-y-1">
          {list.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6 px-4">
              No other captains available right now. They will appear here once
              they are online.
            </p>
          ) : (
            list.map((u) => (
              <button
                key={u.id}
                onClick={() => onPick(u)}
                className="pm-pressable w-full flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-black/5 dark:hover:bg-white/5"
              >
                <Avatar hue={u.avatarHue} name={u.displayName} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {u.displayName}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    @{u.username}
                  </div>
                </div>
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
