"use client";

/**
 * The two ledger rows the Ship and Dues tabs are built out of: a labelled
 * line with its value on the far side, and the indented line under it that
 * breaks a total down by whoever it is owed to. Both tabs draw the same
 * pair, so the pair lives here rather than as a copy in each of them.
 */
export function Row({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}

export function SubRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 pl-3 text-[10px] text-muted-foreground">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
