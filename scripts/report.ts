/**
 * The closing ceremony every operator report shares.
 *
 * A report runs its main, names itself on the failure line if that main
 * throws, marks a failing exit code, and releases the database client on
 * the way out. Five reports had grown their own copy of those steps and
 * two of the copies had drifted from the rest (a bare error where the
 * others named their report), so the same failure read two ways
 * depending on which report met it. One home ends that.
 *
 * The launch gate report keeps its own tail: its exit code is a reading
 * rather than a ceremony (0 clear, 1 held, 2 blocked, 3 the report
 * itself failed), so it cannot share the exit code this helper sets.
 */

import { db } from "@/lib/db";

export function runReport(
  failureLine: string,
  main: () => Promise<void>,
): void {
  main()
    .catch((error) => {
      console.error(failureLine, error);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
