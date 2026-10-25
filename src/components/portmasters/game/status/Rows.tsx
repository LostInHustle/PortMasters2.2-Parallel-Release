"use client";

import { cn } from "@/lib/utils";

/**
 * The ledger line the Ship tab, the Dues tab and the settle screen are
 * built out of: a name on the left and a figure on the right.
 *
 * One implementation for the three, because they are one shape at three
 * sizes, and a copy in each is a copy that can drift: a line that grows
 * a margin in one place and not in the next reads as two different rows
 * to a captain checking a total.
 */
export function LedgerRow({
  label,
  children,
  size = "text-[12px]",
  className,
  labelClassName,
  valueClassName,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  /** The size the line is printed at. */
  size?: string;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("flex justify-between py-0.5", size, className)}>
      <span className={labelClassName}>{label}</span>
      <span className={valueClassName}>{children}</span>
    </div>
  );
}

/**
 * The two ledger rows the Ship and Dues tabs are built out of: a labeled
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
    <LedgerRow
      label={label}
      className="items-center"
      labelClassName="text-muted-foreground"
      valueClassName="text-foreground"
    >
      {children}
    </LedgerRow>
  );
}

export function SubRow({ label, value }: { label: string; value: string }) {
  return (
    <LedgerRow
      label={label}
      size="text-[10px]"
      className="pl-3 text-muted-foreground"
    >
      {value}
    </LedgerRow>
  );
}
