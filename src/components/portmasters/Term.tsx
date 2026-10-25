"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { glossaryText } from "@/lib/game/glossary";

export function Term({
  children,
  term,
  content,
  focusable = true,
}: {
  children: React.ReactNode;
  term?: string;
  content?: React.ReactNode;
  /** Whether the trigger gets its own tab stop. False inside another button. */
  focusable?: boolean;
}) {
  // The key stays English; glossaryText resolves it in the active locale.
  const body =
    content ??
    (term ? glossaryText(term) : undefined) ??
    (typeof children === "string" ? glossaryText(children) : undefined);
  if (!body) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={focusable ? 0 : undefined}
          className="underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 cursor-help"
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{body}</TooltipContent>
    </Tooltip>
  );
}
