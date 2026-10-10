"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, PublicUser } from "@/lib/api";
import type { Socket } from "socket.io-client";
import { Search, X } from "lucide-react";
import type { GameState } from "@/lib/game/types";
import type { BarterOffer } from "@/lib/use-barter";
import { toast } from "sonner";
import { MUTED_NOTICE } from "@/lib/game/constants/copy";
import type { Barter } from "./game/phases/PhaseShared";
import { MessageList, type StreamItem } from "./chat/MessageList";
import { Composer } from "./chat/Composer";

// What a chat needs to be able to trade, handed over as one object so a
// surface with no voyage behind it simply passes nothing and gets none of
// it. That is how the Lobby stays exactly as it was: it renders this
// component with no trade, so no offer card, no composer and no handshake
// button exist in its tree at all.
export type ChatTrade = {
  barter: Barter;
  game: GameState;
  act: (fn: (g: GameState, logs: string[]) => void) => void;
  members: PublicUser[];
  colorFor?: (item: string) => string | undefined;
  // Set on a private thread: the captain this conversation is with, who the
  // composer addresses its offers to. The caller leaves it off when that
  // captain is not in the room, since a board offer naming an outsider is
  // one the server would refuse.
  defaultTarget?: PublicUser;
};

// The surface below is the conversation's state and its two ends: the
// search bar it opens over the top, the list under ./chat that draws the
// stream, and the composer that writes the next line. The panel itself
// holds the socket, the requests it listens for and the history it seeds
// from, and hands each of the two ends only what it draws.
/**
 * A self contained chat surface. Three modes: room, messages broadcast to a
 * room channel (socket `chat:room`); lobby, messages broadcast to the harbor
 * square every captain in the lobby is standing in (socket `chat:lobby`); dm,
 * 1 to 1 messages with another user (socket `chat:dm`).
 *
 * The socket is passed in (shared singleton). The seed history comes from
 * the parent: the Lobby fetches it over REST, a session hands over what the
 * server hydrated on join, because a session conversation is never written
 * down and so has nowhere to be fetched from later. The two public channels
 * split the same way on the server, where a room's chat dies with the voyage
 * and the square's is written down. Live messages arrive over the socket.
 * Mine uses the celadon pm-grad-chat, others get a soft black tint so the
 * conversation reads as two sides of a brush.
 *
 * Given a `trade`, the panel also carries the shared offer board: open
 * offers that belong to this conversation appear in the stream where they
 * were posted and the handshake button composes a new one. Without it the
 * panel is a plain chat.
 */
export function ChatPanel({
  socket,
  me,
  mode,
  roomId,
  other,
  initialMessages,
  trade,
  disabled,
}: {
  socket: Socket | null;
  me: PublicUser;
  mode: "room" | "dm" | "lobby";
  roomId?: string;
  other?: PublicUser;
  initialMessages?: ChatMessage[];
  trade?: ChatTrade;
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter messages when searching. Case insensitive match on content or
  // sender name. When search is open but the query is empty, all messages
  // show (so the captain can scroll the full history in the search view).
  const searching = searchQuery.trim().length > 0;
  const filteredMessages = searching
    ? messages.filter(
        (m) =>
          m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.sender.displayName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      )
    : messages;

  // Which open offers belong to the conversation being read. The board a
  // socket receives is already scoped to what that captain may see, so the
  // harbor thread shows it whole, while a private thread shows the offers
  // aimed at either captain in it: theirs to me and mine to them. Reading
  // only the second direction left an offer the other captain had addressed
  // to me out of our own thread, and it could only be taken from the harbor
  // board, which is the one place a direct offer exists to avoid. A search
  // hides them: it looks through what was said, and an offer is taken or
  // left on the board.
  const offers: BarterOffer[] =
    trade && !searching
      ? mode === "dm"
        ? trade.barter.offers.filter(
            (o) => o.targetUserId === other?.id || o.targetUserId === me.id,
          )
        : trade.barter.offers
      : [];
  const offerCount = offers.length;

  // Messages and offers share one timeline. Both timestamps are ISO 8601 in
  // the same format, so they are positioned by a plain string comparison
  // with no parsing and no locale to disagree about.
  const stream: StreamItem[] = [
    ...filteredMessages.map((m): StreamItem => ({
      kind: "message",
      at: m.createdAt,
      message: m,
    })),
    ...offers.map((o): StreamItem => ({
      kind: "offer",
      at: o.createdAt,
      offer: o,
    })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  // An offer is reason enough to drop the welcome text: the conversation
  // has something in it, just not a message this captain posted.
  const hasContent = messages.length > 0 || offerCount > 0;

  // Seed with initial messages if they change (e.g. switching DM target, or
  // the parent's history fetch resolving after this already mounted). Done as
  // a render time adjustment rather than in an effect: React throws away the
  // render in progress, then immediately renders again with the new state, instead
  // of committing one pass and then cascading a second one, which is what an
  // effect calling setState synchronously does (react-hooks/set-state-in-effect).
  // The trigger is the conversation identity and the incoming history: a
  // change to either reseeds the stream.
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
    // bails out on the identical reference, so a duplicate costs no extra render,
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
    // The harbor square. It is public and addressed to nobody, so there is
    // no membership to test and no peer to match against: every one of
    // these belongs to this panel, and the only question is whether it is
    // already on screen.
    const onLobby = (data: { message: ChatMessage }) => {
      if (mode !== "lobby") return;
      setMessages((prev) =>
        prev.some((m) => m.id === data.message.id)
          ? prev
          : [
              ...prev,
              { ...data.message, mine: data.message.sender.id === me.id },
            ],
      );
    };
    // A room whose conversation the host has just wiped. The messages on
    // screen belong to the voyage that was just thrown away, so they go with
    // it. Offers are board state and are untouched by a restart, so they are
    // left to the barter board's own update.
    const onCleared = (data: { roomId: string }) => {
      if (data.roomId !== roomId) return;
      setMessages([]);
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
        description: MUTED_NOTICE,
      });
    };
    socket.on("chat:room", onRoom);
    socket.on("chat:lobby", onLobby);
    socket.on("chat:dm", onDm);
    socket.on("chat:cleared", onCleared);
    socket.on("chat:muted", onMuted);
    return () => {
      socket.off("chat:room", onRoom);
      socket.off("chat:lobby", onLobby);
      socket.off("chat:dm", onDm);
      socket.off("chat:cleared", onCleared);
      socket.off("chat:muted", onMuted);
    };
  }, [socket, mode, roomId, other?.id, me.id]);

  // Auto scroll to bottom on new messages and on a change in how many
  // offers the board holds. The count is tracked rather than the array so
  // that this only runs when the stream actually grew: depending on the
  // board's own identity would scroll again on every broadcast and yank a
  // captain back down while they were reading further up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, offerCount]);

  // Deliberately not async and deliberately stateless. An emit returns as
  // soon as the socket has taken the frame, so any "sending" flag raised
  // around one is cleared again before the next paint and the spinner it
  // drove could never be seen. Clearing the composer is the whole of the
  // feedback, which is what a chat line has always done here.
  function send() {
    const content = input.trim();
    if (!content) return;
    setInput("");
    if (mode === "room" && roomId) {
      // Optimistic echo handled by server broadcast to room (including self).
      socket?.emit("chat:room", { roomId, content });
    } else if (mode === "lobby") {
      // The same echo, from the square rather than from a room.
      socket?.emit("chat:lobby", { content });
    } else if (mode === "dm" && other) {
      socket?.emit("chat:dm", { recipientId: other.id, content });
    }
  }

  const emptyText = {
    lobby: "Nothing on the harbor square yet. Say hello to the fleet.",
    room: "No messages yet. Break the ice with your fellow captains.",
    dm: "No messages yet between you two.",
  }[mode];

  // A private thread trades with the captain it is with, so the composer
  // has no target to pick.
  const tradeTarget = mode === "dm" ? trade?.defaultTarget : undefined;

  return (
    <div className="flex h-full flex-col min-h-0">
      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-1.5 border-b border-black/5 px-2.5 py-2 dark:border-white/10">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages…"
            className="h-7 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
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
      <MessageList
        scrollRef={scrollRef}
        hasContent={hasContent}
        stream={stream}
        trade={trade}
        me={me}
        searchQuery={searchQuery}
        emptyText={emptyText}
      />
      <Composer
        mode={mode}
        me={me}
        trade={trade}
        tradeTarget={tradeTarget}
        otherName={other?.displayName}
        disabled={disabled}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((v) => !v)}
        input={input}
        onInputChange={setInput}
        onSend={send}
      />
    </div>
  );
}
