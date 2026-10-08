"use client";

// =====================================================================
// The audience picker every offer form in the harbor shares: the whole
// harbor, or one named captain.
//
// Three surfaces draw this row: PrivateOffer, for the escort market and
// the refit bench, and the two barter forms, on the board and on a chat.
// The option list is written here so the named option cannot come to mean
// two things on two boards: a captain named on one form is named the same
// way on every other.
// =====================================================================

import type { PublicUser } from "@/lib/api";
import { Select } from "@/components/ui/select";

export function AudienceSelect({
  value,
  onChange,
  others,
  label,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  /** The captains who could be named, which is the table but the seller. */
  others: PublicUser[];
  /** What the picker is choosing, read out for a screen reader. */
  label: string;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={className}
    >
      <option value="">🌊 Anyone in the harbor</option>
      {others.map((m) => (
        <option key={m.id} value={m.id}>
          🔒 {m.displayName} only
        </option>
      ))}
    </Select>
  );
}
