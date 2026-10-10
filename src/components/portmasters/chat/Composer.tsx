"use client";

import { useState } from "react";
import type { PublicUser } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CHAT_MESSAGE_MAX } from "@/lib/realtime-endpoint";
import { MUTED_NOTICE } from "@/lib/game/constants/copy";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SendHorizontal, Search, Handshake, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TradeComposer } from "../game/BarterTrade";
import type { ChatTrade } from "../ChatPanel";

// The handshake button and the composer it opens. Mounted only where there
// is a shared board to post to, which is what keeps the draft's state out
// of a conversation that could never use it.
function TradeButton({
  trade,
  me,
  fixedTarget,
}: {
  trade: ChatTrade;
  me: PublicUser;
  fixedTarget?: PublicUser;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="pm-pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5 text-muted-foreground dark:bg-white/10"
          title="Offer a trade"
          aria-label="Offer a trade"
        >
          <Handshake className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <TradeComposer
          game={trade.game}
          act={trade.act}
          barter={trade.barter}
          me={me}
          members={trade.members}
          fixedTarget={fixedTarget}
          onPosted={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * The strip along the bottom of the panel: the handshake button wherever
 * there is a board to post to, the search toggle, the message field and the
 * send button. A captain the host has muted gets the notice instead of the
 * field, and keeps the handshake button, because trading is not talking.
 *
 * The field is held by the caller and handed down as a value, so the words
 * survive whatever this strip does and the panel that owns the send and the
 * clearing of it is the only thing that writes them.
 */
export function Composer({
  mode,
  me,
  trade,
  tradeTarget,
  otherName,
  disabled,
  searchOpen,
  onToggleSearch,
  input,
  onInputChange,
  onSend,
}: {
  mode: "room" | "dm" | "lobby";
  me: PublicUser;
  trade?: ChatTrade;
  tradeTarget?: PublicUser;
  otherName?: string;
  disabled?: boolean;
  searchOpen: boolean;
  onToggleSearch: () => void;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
}) {
  // The trade board's own refusal, drawn on the strip the press was made
  // from: the handshake button and the composer it opens both live here, so
  // a post the room turns away is read where the captain pressed rather
  // than in a panel they may never open. The sentence is the frame's own,
  // carried through the hook and never rebuilt, and the dismissal is the
  // hook's own clearError.
  //
  // One name for the message field, worn twice: as the placeholder and as
  // the name a screen reader reads it by. A placeholder is not an
  // accessible name, and a field whose only description is placeholder
  // text is announced as an empty box. The dm's name names the captain
  // once there is one, and falls back to a plain noun before that rather
  // than leaving the slot blank.
  const fieldName = {
    room: "Message the harbor",
    lobby: "Message the lobby",
    dm: `Message ${otherName ?? "this captain"}`,
  }[mode];
  return (
    <div className="border-t border-black/5 dark:border-white/10">
      {trade?.barter.error && (
        <div className="flex items-center justify-between gap-2 border-b border-alarm/25 bg-alarm/5 px-2.5 py-1.5 text-xs text-alarm">
          <span>⚠️ {trade.barter.error}</span>
          <button
            type="button"
            onClick={trade.barter.clearError}
            aria-label="Dismiss trade error"
            className="pm-pressable shrink-0 rounded-full p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="p-2.5 flex items-center justify-center gap-2">
        {disabled ? (
          <p className="text-center text-xs text-muted-foreground">
            {MUTED_NOTICE}
          </p>
        ) : (
          <>
            <button
              onClick={onToggleSearch}
              className={cn(
                "pm-pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                searchOpen
                  ? "bg-celadon/5 text-celadon"
                  : "bg-black/5 text-muted-foreground dark:bg-white/10",
              )}
              title="Search messages"
              aria-label="Search messages"
            >
              <Search className="h-4 w-4" />
            </button>
            <Input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder={`${fieldName}…`}
              aria-label={fieldName}
              className="h-9 rounded-full bg-black/5 dark:bg-white/10 border-0 text-sm"
              maxLength={CHAT_MESSAGE_MAX}
            />
            <Button
              size="icon"
              onClick={onSend}
              disabled={!input.trim()}
              aria-label="Send message"
              className="h-9 w-9 rounded-full pm-grad-chat shrink-0"
            >
              <SendHorizontal className="h-4 w-4" />
            </Button>
          </>
        )}
        {/* Trading is not talking, so a mute does not take the board away. */}
        {trade && (
          <TradeButton trade={trade} me={me} fixedTarget={tradeTarget} />
        )}
      </div>
    </div>
  );
}
