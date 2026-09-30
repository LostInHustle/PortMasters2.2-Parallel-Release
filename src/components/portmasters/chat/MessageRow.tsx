"use client";

import { motion } from "framer-motion";
import type { ChatMessage } from "@/lib/api";
import { Avatar } from "../shared";
import { cn, formatTime } from "@/lib/utils";

/**
 * One line of the conversation: who said it, the bubble itself, and when it
 * landed. A line this captain wrote is mirrored to the right and wears the
 * celadon pm-grad-chat, while everyone else gets the soft black tint, which
 * is the whole of what says which side of the conversation a line came from.
 */
export function MessageRow({
  message,
  myUserId,
}: {
  message: ChatMessage;
  myUserId: string;
}) {
  const mine = message.mine ?? message.sender.id === myUserId;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn("flex gap-2", mine ? "flex-row-reverse" : "flex-row")}
    >
      <Avatar
        hue={message.sender.avatarHue}
        name={message.sender.displayName}
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
            {message.sender.displayName}
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
          {message.content}
        </div>
        <span className="text-[9px] text-muted-foreground mt-0.5 px-1">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </motion.div>
  );
}
