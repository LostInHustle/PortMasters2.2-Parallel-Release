import { AdminBulkAction, AdminBulkReport } from "@/types/realtime/admin";
import { t } from "@/lib/game/i18n";
import { toast } from "sonner";

// The console's own word for a finished bulk action, matching the button
// that was pressed.
const BULK_VERB: Record<AdminBulkAction, string> = {
  ban: "Banned",
  unban: "Unbanned",
  grant: "Granted administrator to",
  purge: "Deleted",
};

// Reports a finished bulk action. Every account in the selection is answered
// separately, so a selection wider than the action applies to is normal
// rather than a failure: a clean run is one line, and a partial one counts
// itself and lists the accounts left behind and why.
export function announceBulk(report: AdminBulkReport): void {
  // Read at call time so the verb and sentence follow the current locale.
  const verb = t(BULK_VERB[report.action]);
  const line =
    report.skipped.length === 0
      ? t("{verb} {report.applied} {accountWord}.", {
          verb,
          "report.applied": report.applied,
          accountWord: plural(report.applied),
        })
      : t("{verb} {report.applied} of {report.requested} accounts.", {
          verb,
          "report.applied": report.applied,
          "report.requested": report.requested,
        });
  if (report.skipped.length === 0) {
    toast.success(line);
    return;
  }
  toast.warning(line, {
    description: report.skipped.join(" "),
    // Long enough to read the list of refusals, which is the only place a
    // skipped account is explained.
    duration: 10000,
  });
}

// The word for an account count, shared with the deletion dialogs.
export function plural(count: number): string {
  return count === 1 ? "account" : "accounts";
}
