"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One header for the three panels that fold: the captain's rail, the
 * harbor roster and the chat. They answer one question between them,
 * what is this panel and is it open, so the anatomy is shared here: an
 * icon, an uppercase name, an optional note about the panel's own state,
 * and the chevron that folds it.
 *
 * `collapsed` is the panel's own state rather than this header's, because
 * the fold lives in one record (see usePanelPrefs) that two surfaces
 * read: this chevron and the rail stub a rail level fold leaves behind.
 * `meta` is that record's mirror image, a reading about the panel (the
 * roster's headcount) rather than a control, which is why it sits with
 * the name and the chevron sits after it.
 *
 * `railLevel` marks the folds that only exist on the wide layout: a rail
 * collapses to a stub beside the stage, and below the breakpoint there is
 * no stub to come back from, so the chevron is not drawn there.
 */
export function PanelHeader({
  icon,
  title,
  meta,
  collapsed = false,
  onToggle,
  railLevel = false,
  className,
}: {
  icon: ReactNode;
  title: string;
  meta?: ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
  railLevel?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {icon}
      <h3 className="text-[11px] font-semibold uppercase tracking-wider">
        {title}
      </h3>
      {meta && <span className="ml-auto flex items-center">{meta}</span>}
      {onToggle && (
        <button
          type="button"
          className={cn(
            "rounded-lg p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10",
            !meta && "ml-auto",
            railLevel && "hidden lg:inline-flex",
          )}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} the ${title} panel`}
          onClick={onToggle}
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              collapsed && "-rotate-90",
            )}
          />
        </button>
      )}
    </div>
  );
}
