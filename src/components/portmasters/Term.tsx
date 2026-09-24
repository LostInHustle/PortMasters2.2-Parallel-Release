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
}: {
  children: React.ReactNode;
  term?: string;
  content?: React.ReactNode;
}) {
  const body =
    content ??
    (term ? GLOSSARY[term] : undefined) ??
    (typeof children === "string" ? GLOSSARY[children] : undefined);
  if (!body) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 cursor-help">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{body}</TooltipContent>
    </Tooltip>
  );
}
