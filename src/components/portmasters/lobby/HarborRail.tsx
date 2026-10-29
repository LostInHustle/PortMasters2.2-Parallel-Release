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
// The two panels share the height of the harbor board on a wide screen.
// On smaller screens they follow the board in the document flow.
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
import { t } from "@/lib/game/i18n";
import { cn } from "@/lib/utils";
import { CardHead } from "./CardHead";
import styles from "./Lobby.module.css";

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
  // The roster and chat scroll within their own aligned panels.
  return (
    <aside className={cn("flex min-w-0 flex-col gap-4", styles.rail)}>
      <div className={cn("pm-glass pm-panel flex flex-col", styles.roster)}>
        <CardHead
          icon={Users}
          tone="text-captains"
          title={t("Captains Online")}
        >
          <Pill tone="gain">
            <OnlineDot online size={8} /> {totalOnline}
          </Pill>
        </CardHead>
        {/* The plain scroller rather than ScrollArea, capped rather than
            stretched. A viewport sized in percentages inside a flex
            parent resolves back to auto and stops scrolling, so a list
            that has to fill its parent uses this div, the same one the
            captain profile and the crew ledger use. */}
        <div className="pm-scroll min-h-0 flex-1 overflow-y-auto">
          {onlineUsers.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {connected
                ? t("No other captains online yet.")
                : t("Connecting to the harbor…")}
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
                            {t("(you)")}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {u.roomId ? t("In a harbor") : t("In the lobby")}
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

      {/* Chat fills the remaining column height while its messages scroll. */}
      <div className={cn("pm-glass pm-panel-flush flex flex-col", styles.chat)}>
        <Tabs
          value={chatTab}
          onValueChange={(v) => onChatTabChange(v as "lobby" | "dm")}
          className="flex h-full min-h-0 flex-col"
        >
          <div className="flex min-h-5 shrink-0 items-center gap-2.5 px-5 pt-5">
            <MessageCircle className="h-4 w-4 shrink-0 text-messages" />
            <span className="pm-truncate min-w-0 flex-1 text-sm font-medium">
              {chatTab === "lobby"
                ? t("Harbor chat")
                : dmTarget
                  ? `${t("Direct")} · ${dmTarget.displayName}`
                  : t("Direct messages")}
            </span>
          </div>
          <TabsList className="mx-5 mt-3 grid h-10 w-auto shrink-0 grid-cols-2">
            <TabsTrigger value="lobby">
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> {t("Harbor")}
            </TabsTrigger>
            <TabsTrigger value="dm">
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> {t("Direct")}
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                  {t("Loading…")}
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
                  {t(
                    "Pick a captain from the list above to start a private conversation.",
                  )}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </aside>
  );
}
