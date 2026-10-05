"use client";

/**
 * The heading every block on the captain's profile wears: the trends, the
 * difficulty rows, the renown ladder and the merits all open the same way,
 * and the four panels had written the same h3 out four times. Four copies
 * of a heading is four places a retouch can miss one, which is the defect
 * the modal shells above this were consolidated for; the words inside stay
 * the caller's.
 */
export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}
