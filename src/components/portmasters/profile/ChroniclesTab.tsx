"use client";

import { VoyageChronicle } from "@/types/realtime/voyage";
import { useState } from "react";
import { BookOpen } from "lucide-react";
import { ChronicleRow } from "./ChronicleRow";

export function ChroniclesTab({
  chronicles,
}: {
  chronicles: VoyageChronicle[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (chronicles.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-30" />
        No chronicles saved yet. Opt in to save a chronicle at the end of your
        next voyage.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {chronicles.map((c, i) => {
        const isExpanded = expandedId === c.id;
        return (
          <ChronicleRow
            key={c.id}
            chronicle={c}
            index={i}
            expanded={isExpanded}
            onToggle={() => setExpandedId(isExpanded ? null : c.id)}
          />
        );
      })}
    </div>
  );
}
