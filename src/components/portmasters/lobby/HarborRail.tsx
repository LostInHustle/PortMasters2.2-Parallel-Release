"use client";

// =====================================================================
// The lobby's rail: who is about, and the conversation with whoever the
// captain picked from that list.
//
// Two panels, not one that swaps between them. Merging the pair gave the
// conversation the whole rail, which took the roster away whenever a
// thread was open, and it left a captain arriving at the lobby looking at
// a list of names with nothing under it and no way to tell a chat was
// there at all. The chat keeps a panel of its own, where it can be read
// before anyone has been picked.
//
// Below the lg breakpoint this rail leads and the harbor board follows
// it, the way the game room's chat column leads. Stacked last, the
// conversation sat under the whole board, and its depth grew with every
// harbor the fleet had open, so it read as absent rather than as simply
// further down. The board is one short scroll away instead, and a captain
// scrolling a room list is reading anyway. Above the breakpoint nothing
// moves.
//
// It reads the roster and the thread and decides nothing of its own:
// every piece of state it draws is the lobby's, handed in as props.
// =====================================================================

import type { Socket } from "socket.io-client";
import { Loader2, MessageCircle, Star, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, OnlineDot, Pill } from "@/components/portmasters/shared";
import { ChatPanel } from "@/components/portmasters/ChatPanel";
import type { ChatMessage, PublicUser } from "@/lib/api";
import type { OnlineUser } from "@/types/realtime/presence";
import { renownProgress, type CaptainLegacySummary } from "@/lib/game/legacy";
import { cn } from "@/lib/utils";
import { CardHead } from "./CardHead";

export function HarborRail({
  totalOnline,
  connected,
  onlineUsers,
  me,
  otherLegacies,
  openDm,
  chatTab,
  onChatTabChange,
  dmTarget,
  dmLoading,
  socket,
  lobbyHistory,
  dmHistory,
}: {
  totalOnline: number;
  connected: boolean;
  onlineUsers: OnlineUser[];
  me: PublicUser;
  otherLegacies: Record<string, CaptainLegacySummary>;
  openDm: (user: PublicUser) => void;
  chatTab: "lobby" | "dm";
  onChatTabChange: (next: "lobby" | "dm") => void;
  dmTarget: PublicUser | null;
  dmLoading: boolean;
  socket: Socket | null;
  lobbyHistory: ChatMessage[];
  dmHistory: ChatMessage[];
}) {
  // On a wide window the rail holds still while the harbor board beside it
  // scrolls, the same shape the game room's rail has: who is about and the
  // conversation with them are things a captain glances at rather than
  // reads top to bottom, and having them travel up the screen every time
  // the board moved made glancing back at them a scroll of its own.
  // self-start is what lets the rail stick at all, because a grid item
  // stretched to the height of its row has nothing to stick within. On a
  // window too short for both panels it scrolls inside its own cap rather
  // than pushing the board off the screen.
  //
  // The offset is the lobby's masthead rather than the game room's topbar:
  // this screen keeps its header stuck to the top of a page that scrolls,
  // so the rail has to start below it or it parks underneath the tabs.
  return (
    <aside className="-order-1 space-y-3 lg:order-2 lg:sticky lg:top-40 lg:max-h-[calc(100dvh-11rem)] lg:self-start lg:overflow-y-auto pm-scroll lg:pr-1">
      <div className="pm-glass pm-panel">
        <CardHead icon={Users} tone="text-captains" title="Captains Online">
          <Pill tone="gain">
            <OnlineDot online size={8} /> {totalOnline}
          </Pill>
        </CardHead>
        {/* The plain scroller rather than ScrollArea, capped rather than
            stretched. A viewport sized in percentages inside a flex
            parent resolves back to auto and stops scrolling, so a list
            that has to fill its parent uses this div, the same one the
            captain profile and the crew ledger use. */}
        <div className="pm-scroll max-h-56 overflow-y-auto pr-2">
          {onlineUsers.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {connected
                ? "No other captains online yet."
                : "Connecting to the harbor…"}
            </p>
          ) : (
            <div className="space-y-1">
              {onlineUsers.map((u) => {
                const isMe = u.id === me.id;
                const otherLegacy = otherLegacies[u.id];
                return (
                  <button
                    key={u.id}
                    onClick={() => !isMe && openDm(u)}
                    disabled={isMe}
                    className={cn(
                      "pm-row w-full text-left",
                      isMe ? "cursor-default opacity-60" : "cursor-pointer",
                    )}
                  >
                    <div className="relative">
                      <Avatar
                        hue={u.avatarHue}
                        name={u.displayName}
                        size={30}
                      />
                      <OnlineDot
                        online
                        size={8}
                        className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {u.displayName}{" "}
                        {isMe && (
                          <span className="text-[10px] text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {u.roomId ? "In a harbor" : "In the lobby"}
                      </div>
                    </div>
                    {otherLegacy && (
                      <Pill tone="gold" className="shrink-0">
                        <Star className="h-3 w-3" />{" "}
                        {renownProgress(otherLegacy.renownXP).level}
                      </Pill>
                    )}
                    {!isMe && (
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* The chat draws its own header and its own scroller, so it takes
          the panel's corners without its padding. Two parts, the same
          two the voyage's chat carries: the harbor square, which is
          where a captain speaks to everybody standing in the lobby,
          and the private threads, which is where picking a name above
          lands. */}
      <div className="pm-glass pm-panel-flush flex h-[22.5rem] flex-col">
        <Tabs
          value={chatTab}
          onValueChange={(v) => onChatTabChange(v as "lobby" | "dm")}
          className="flex h-full flex-col"
        >
          <div className="flex items-center gap-2 px-4 pt-3">
            <MessageCircle className="h-4 w-4 shrink-0 text-messages" />
            <span className="pm-truncate min-w-0 flex-1 text-sm font-medium">
              {chatTab === "lobby"
                ? "Harbor chat"
                : dmTarget
                  ? `Direct · ${dmTarget.displayName}`
                  : "Direct messages"}
            </span>
          </div>
          <TabsList className="mx-4 mt-2 grid grid-cols-2">
            <TabsTrigger value="lobby">
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Harbor
            </TabsTrigger>
            <TabsTrigger value="dm">
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Direct
            </TabsTrigger>
          </TabsList>
          {/* Both channels stay mounted, so the square keeps filling in
              while the captain is reading a private thread and is still
              there on the way back. Unmounted, it would reseed from the
              backlog this screen loaded once, which is a fetch old by
              then and knows nothing of what arrived live. */}
          <TabsContent
            value="lobby"
            forceMount
            className="mt-0 flex-1 min-h-0 data-[state=inactive]:hidden"
          >
            <ChatPanel
              socket={socket}
              me={me}
              mode="lobby"
              initialMessages={lobbyHistory}
            />
          </TabsContent>
          <TabsContent
            value="dm"
            forceMount
            className="mt-0 flex-1 min-h-0 data-[state=inactive]:hidden"
          >
            {dmTarget ? (
              dmLoading ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : (
                <ChatPanel
                  socket={socket}
                  me={me}
                  mode="dm"
                  other={dmTarget}
                  initialMessages={dmHistory}
                />
              )
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Pick a captain from the list above to start a private
                  conversation.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </aside>
  );
}
