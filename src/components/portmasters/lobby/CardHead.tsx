"use client";

// =====================================================================
// A card's head: one icon, one title, and whatever controls belong to
// that card on the right. The icon takes its colour from the call site,
// because colour is how a card says which part of the harbor it is.
//
// It exists so every heading in the lobby is written once: a heading grown
// by hand nudges to fit its own card and drifts out of line the moment the
// text beside it changes length, and a heading written once cannot drift
// away from itself. The figures that sit under those headings are the same
// argument, and live in ./HarborGauge.
//
// No second line of explanation sits under the title, and no prop sits
// here unread for one: no card wants a subtitle, so there is none.
// =====================================================================

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// A card's head: one icon, one title, and whatever controls belong to that
// card on the right. The icon takes its colour from the call site, because
// colour is how a card says which part of the harbor it is.
//
// No second line of explanation sits under the title, and no prop sits
// here unread for one: no card wants a subtitle, so there is none.
export function CardHead({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className={cn("h-4 w-4 shrink-0", tone)} />
        <h2 className="pm-truncate font-display text-sm font-semibold leading-tight">
          {title}
        </h2>
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-1.5">{children}</div>
      )}
    </div>
  );
}
