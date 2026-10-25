"use client";

import { motion } from "framer-motion";
import type { ChatMessage, PublicUser } from "@/lib/api";
import type { BarterOffer } from "@/lib/use-barter";
import { formatTime } from "@/lib/utils";
import { t } from "@/lib/game/i18n";
import { useLanguage } from "@/lib/use-language-preference";
import { OfferCard } from "../game/BarterTrade";
import type { ChatTrade } from "../ChatPanel";
import { MessageRow } from "./MessageRow";

// A message and an offer share one timeline, so both are carried in one
// item shape. The timestamps are ISO 8601 in the same format, which is what
// lets the list below position them by a plain string comparison.
export type StreamItem =
  | { kind: "message"; at: string; message: ChatMessage }
  | { kind: "offer"; at: string; offer: BarterOffer };

/**
 * The conversation: the scrolling box a captain reads, with the search
 * result, the empty state and the whole timeline drawn inside it. The
 * scroll box itself lives here so the ref that keeps it pinned to the
 * bottom belongs to the element it scrolls, and the caller keeps only the
 * effect that drives it.
 */
export function MessageList({
  scrollRef,
  hasContent,
  stream,
  trade,
  me,
  searchQuery,
  emptyText,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  hasContent: boolean;
  stream: StreamItem[];
  trade?: ChatTrade;
  me: PublicUser;
  searchQuery: string;
  emptyText: string;
}) {
  const { locale } = useLanguage();
  // One notice, two reasons to draw it: an empty channel and a search that
  // matched nothing are the same empty box with a different sentence in
  // it, so the sentence is chosen here and the box is drawn once below.
  //
  // The query inside the search notice is a captain's own typing, and the
  // notice is text, so the browser escapes it on the way to the screen: it
  // lands there exactly as it was typed, in either language.
  const notice = !hasContent ? (
    emptyText
  ) : stream.length === 0 ? (
    <span>{t("No messages match “{searchQuery}”.", { searchQuery })}</span>
  ) : null;

  return (
    <div
      ref={scrollRef}
      className="pm-scroll flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5"
    >
      {notice !== null ? (
        <div className="h-full flex items-center justify-center text-center px-6">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {notice}
          </p>
        </div>
      ) : (
        stream.map((item) => {
          if (item.kind === "offer") {
            const { offer } = item;
            // Drawn as a card of its own rather than as a bubble. An offer
            // is board state passing through the conversation, not
            // something a captain said, and it reads better as a thing
            // that can be taken than as a remark that can be replied to.
            // The card already names who posted it and what they want, so
            // there is nothing here to caption it with.
            return (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col items-stretch"
              >
                {trade && (
                  <OfferCard
                    offer={offer}
                    me={me}
                    game={trade.game}
                    barter={trade.barter}
                    colorFor={trade.colorFor}
                    className="rounded-2xl"
                  />
                )}
                <span className="text-[9px] text-muted-foreground mt-0.5 px-1">
                  {formatTime(offer.createdAt, locale)}
                </span>
              </motion.div>
            );
          }
          return (
            <MessageRow
              key={item.message.id}
              message={item.message}
              myUserId={me.id}
            />
          );
        })
      )}
    </div>
  );
}
