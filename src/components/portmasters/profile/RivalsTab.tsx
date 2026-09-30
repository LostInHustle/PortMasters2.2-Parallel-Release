"use client";

import { RivalEntry } from "@/types/realtime/standings";
import { Ship } from "lucide-react";
import { RivalRow } from "./RivalRow";

export function RivalsTab({ rivals }: { rivals: RivalEntry[] }) {
  if (rivals.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Ship className="mx-auto mb-3 h-10 w-10 opacity-30" />
        No rivals yet. Sail in the same harbor as another captain to build a
        rivalry.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rivals.map((r, i) => (
        <RivalRow key={r.partner.id} rival={r} index={i} />
      ))}
    </div>
  );
}
