"use client";

import { Ban, ShieldCheck } from "lucide-react";
import { OnlineDot } from "@/components/portmasters/shared";
import { t } from "@/lib/game/i18n";

// Shared by rows and cards so an account's role is drawn by one component
// in both.
export function RoleChip({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) {
    return (
      <span className="text-[11px] text-muted-foreground">{t("Captain")}</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-admin/10 px-2 py-0.5 text-[11px] font-medium text-admin">
      <ShieldCheck className="h-3 w-3" /> {t("Administrator")}
    </span>
  );
}

// A banned account never also shows as online: the ban is the fact an
// operator has to act on, and the last thing the account did is not. The two
// are one choice rather than two chips side by side.
export function StatusChip({
  isBanned,
  online,
}: {
  isBanned: boolean;
  online: boolean;
}) {
  if (isBanned) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-alarm/10 px-2 py-0.5 text-[11px] font-medium text-alarm">
        <Ban className="h-3 w-3" /> {t("Banned")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <OnlineDot online={online} size={7} />
      {online ? t("Online") : t("Away")}
    </span>
  );
}
