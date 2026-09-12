"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { ChatMessage, PublicUser } from "@/lib/api";
import type { Socket } from "socket.io-client";
import { Avatar } from "./shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SendHorizontal, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * A self contained chat surface. Two modes: room, messages broadcast to a
 * room channel (socket `chat:room`); dm, 1 to 1 messages with another user
 * (socket `chat:dm`).
 *
 * The socket is passed in (shared singleton). Initial history is fetched
 * via REST; live messages arrive over the socket. Mine uses the celadon
 * pm-grad-chat, others get a soft black tint so the conversation reads
 * as two sides of a brush without leaning on the rose tint the old build
 * used for the same distinction.
 */
export function ChatPanel({
  socket,
  me,
  mode,
  roomId,
  other,
  initialMessages,
  className,
  disabled,
}: {
  socket: Socket | null;
  me: PublicUser;
  mode: "room" | "dm";
  roomId?: string;
  other?: PublicUser;
  initialMessages?: ChatMessage[];
  className?: string;
  // [MANIFEST 14: Harbor Watch] Set only for the room mode instance, only
  // while the host has muted this captain. A muted captain keeps reading
  // room chat live same as anyone; they just can't post to it until the
  // voyage ends, which is enforced again server side regardless of this
  // prop, so a stale client can never actually post past the block.
  disabled?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages ?? [],
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter messages when searching. Case insensitive match on content or
  // sender name. When search is open but the query is empty, all messages
  // show (so the captain can scroll the full history in the search view).
  const filteredMessages = searchQuery.trim()
    ? messages.filter(
        (m) =>
          m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.sender.displayName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      )
    : messages;

  // Seed with initial messages if they change (e.g. switching DM target, or
  // the parent's history fetch resolving after this already mounted). Done as
  // a render time adjustment rather than in an effect: React throws away the
  // in progress render and immediately re renders with the new state, instead
  // of committing one pass and then cascading a second one, which is what an
  // effect calling setState synchronously does (react-hooks/set-state-in-effect).
  // The trigger is the same pair the old effect's dependency list used, the
  // conversation identity and the incoming history, so seeding is unchanged.
  const seedKey = `${mode}:${roomId ?? ""}:${other?.id ?? ""}`;
  const [seed, setSeed] = useState<{
    key: string;
    source: ChatMessage[] | undefined;
  }>({ key: seedKey, source: initialMessages });
  if (seed.key !== seedKey || seed.source !== initialMessages) {
    setSeed({ key: seedKey, source: initialMessages });
    setMessages(initialMessages ?? []);
  }

  // Live socket listeners.
  useEffect(() => {
    if (!socket) return;
    // Dedupe against the list itself rather than a separate ref of seen ids.
    // Returning `prev` untouched for a message already present means React
    // bails out on the identical reference, so a duplicate costs no re render,
    // and there is no parallel bookkeeping to keep in sync when the seeded
    // history changes underneath it.
    const onRoom = (data: { roomId: string; message: ChatMessage }) => {
      if (mode !== "room" || data.roomId !== roomId) return;
      setMessages((prev) =>
        prev.some((m) => m.id === data.message.id)
          ? prev
          : [
              ...prev,
              { ...data.message, mine: data.message.sender.id === me.id },
            ],
      );
    };
    const onDm = (message: ChatMessage) => {
      if (mode !== "dm") return;
      const involvesMe =
        message.sender.id === me.id || message.recipient?.id === me.id;
      if (!involvesMe) return;
      // Only show if this DM is between me and `other`.
      const otherId = other?.id;
      const peerId =
        message.sender.id === me.id ? message.recipient?.id : message.sender.id;
      if (otherId && peerId !== otherId) return;
      setMessages((prev) =>
        prev.some((m) => m.id === message.id)
          ? prev
          : [...prev, { ...message, mine: message.sender.id === me.id }],
      );
    };
    // [MANIFEST 14: Harbor Watch] Defensive: the disabled prop (driven by
    // GameRoom.tsx's own room:members tracking) already hides the input
    // the moment a mute takes effect, so this should be unreachable in
    // ordinary use. It only ever fires for a stale client, a tab whose
    // React state has not caught up to a mute that just landed, which is
    // exactly the moment a silent server side drop would otherwise look
    // like a message that vanished for no reason.
    const onMuted = (data: { roomId: string }) => {
      if (mode !== "room" || data.roomId !== roomId) return;
      toast.error("You're muted", {
        description: "The host has muted you in room chat this voyage.",
      });
    };
    socket.on("chat:room", onRoom);
    socket.on("chat:dm", onDm);
    socket.on("chat:muted", onMuted);
    return () => {
      socket.off("chat:room", onRoom);
      socket.off("chat:dm", onDm);
      socket.off("chat:muted", onMuted);
    };
  }, [socket, mode, roomId, other?.id, me.id]);

  // Auto scroll to bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    try {
      if (mode === "room" && roomId) {
        // Optimistic echo handled by server broadcast to room (including self).
        socket?.emit("chat:room", { roomId, content });
      } else if (mode === "dm" && other) {
        socket?.emit("chat:dm", { recipientId: other.id, content });
      }
    } finally {
      setSending(false);
    }
  }

  const emptyText =
    mode === "room"
      ? "No messages yet. Break the ice with your fellow captains."
      : "No messages yet between you two.";

  return (
    <div className={cn("flex h-full flex-col min-h-0", className)}>
      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-1.5 border-b border-black/5 px-2.5 py-2 dark:border-white/10">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages…"
            className="h-7 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
            autoFocus
          />
          {searchQuery && (
            <span className="text-[10px] text-muted-foreground">
              {filteredMessages.length} found
            </span>
          )}
          <button
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
            className="pm-pressable rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Close search"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}
      <div
        ref={scrollRef}
        className="pm-scroll flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center px-6">
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              {emptyText}
            </p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center px-6">
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              No messages match &ldquo;{searchQuery}&rdquo;.
            </p>
          </div>
        ) : (
          filteredMessages.map((m) => {
            const mine = m.mine ?? m.sender.id === me.id;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  "flex gap-2",
                  mine ? "flex-row-reverse" : "flex-row",
                )}
              >
                <Avatar
                  hue={m.sender.avatarHue}
                  name={m.sender.displayName}
                  size={26}
                />
                <div
                  className={cn(
                    "flex flex-col max-w-[78%]",
                    mine ? "items-end" : "items-start",
                  )}
                >
                  {!mine && (
                    <span className="text-[10px] text-muted-foreground mb-0.5 px-1">
                      {m.sender.displayName}
                    </span>
                  )}
                  <div
                    className={cn(
                      "px-3 py-1.5 rounded-2xl text-[13px] leading-snug break-words",
                      mine
                        ? "pm-grad-chat rounded-br-md"
                        : "bg-black/5 dark:bg-white/10 rounded-bl-md",
                    )}
                  >
                    {m.content}
                  </div>
                  <span className="text-[9px] text-muted-foreground/70 mt-0.5 px-1">
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
      {disabled ? (
        <div className="p-2.5 border-t border-black/5 dark:border-white/10 text-center text-xs text-muted-foreground">
          The host has muted you in room chat for the rest of this voyage.
        </div>
      ) : (
        <div className="p-2.5 border-t border-black/5 dark:border-white/10 flex items-center gap-2">
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className={cn(
              "pm-pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              searchOpen
                ? "bg-celadon/20 text-celadon"
                : "bg-black/5 text-muted-foreground dark:bg-white/10",
            )}
            title="Search messages"
            aria-label="Search messages"
          >
            <Search className="h-4 w-4" />
          </button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              mode === "room"
                ? "Message the harbor…"
                : `Message ${other?.displayName ?? ""}…`
            }
            className="h-9 rounded-full bg-black/5 dark:bg-white/10 border-0 text-sm"
            maxLength={1000}
          />
          <Button
            size="icon"
            onClick={send}
            disabled={!input.trim() || sending}
            className="h-9 w-9 rounded-full pm-grad-chat shrink-0"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
