"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GLOSSARY } from "@/lib/game/glossary";

export function Term({
  children,
  term,
  content,
  focusable = true,
}: {
  children: React.ReactNode;
  term?: string;
  content?: React.ReactNode;
  /**
   * Whether the trigger takes a tab stop of its own. True wherever the
   * term is a label standing on its own, which is the tap half of
   * reachability: the span was hover only, so a keyboard could never
   * reach a definition and a touch screen could not either, since a tap
   * focuses a span only when the span can be focused. Radix opens the
   * tooltip on focus the same way it opens on hover, so the tab key and
   * the finger both work with no state of our own. It stays a span
   * rather than a button because it does nothing when pressed: the whole
   * of its job is to be described.
   *
   * False inside a control that is itself a button (the rail's leg rows
   * and the status panel's tabs): interactive content nested in a button
   * is invalid, and there the row's own press is the answer to a tap
   * anyway. The definition those two carry is still the same tooltip; it
   * just does not add a stop inside a control that already has one.
   */
  focusable?: boolean;
}) {
  const body =
    content ??
    (term ? GLOSSARY[term] : undefined) ??
    (typeof children === "string" ? GLOSSARY[children] : undefined);
  if (!body) return <>{children}</>;

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
