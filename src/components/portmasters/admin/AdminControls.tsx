"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { AdminAccount } from "@/types/realtime/admin";
import { t } from "@/lib/game/i18n";

// The actions an operator can take on one account, named once so every row
// callback shares one type.
export type AccountActionFn = (
  action: "ban" | "unban" | "grant" | "revoke",
  userId: string,
) => void;

// The three per-account actions, in one place so a row and a card offer the
// same three in the same order with the same guards. Skipped entirely while
// an action on this account is in flight, because a second press would be a
// second request.
export function AccountActions({
  account,
  isSelf,
  busy,
  onAct,
  onPurge,
}: {
  account: AdminAccount;
  isSelf: boolean;
  busy: boolean;
  onAct: AccountActionFn;
  onPurge: () => void;
}) {
  const isAdmin = account.role === "admin";
  const isBanned = account.bannedAt !== null;
  // Banning, demoting or deleting your own account would lock you out of the
  // console. The server refuses all three as well.
  const selfTitle = isSelf ? t("Not available on your own account") : undefined;

  if (busy) {
    return (
      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
    );
  }
  return (
    <>
      {isBanned ? (
        <RowButton
          label={t("Unban")}
          onClick={() => onAct("unban", account.id)}
        />
      ) : (
        <RowButton
          label={t("Ban")}
          disabled={isSelf}
          title={selfTitle}
          onClick={() => onAct("ban", account.id)}
        />
      )}
      {isAdmin ? (
        <RowButton
          label={t("Revoke admin")}
          disabled={isSelf}
          title={selfTitle}
          onClick={() => onAct("revoke", account.id)}
        />
      ) : (
        <RowButton
          label={t("Grant admin")}
          // A banned account cannot open the console, so the role would be a
          // promise the console cannot keep.
          disabled={isBanned}
          title={isBanned ? t("Unban the account first") : undefined}
          onClick={() => onAct("grant", account.id)}
        />
      )}
      <RowButton
        label={t("Delete")}
        tone="danger"
        disabled={isSelf}
        title={selfTitle}
        onClick={onPurge}
      />
    </>
  );
}

// One account's action drawn as a quiet word: a row carries three of these,
// and chips there would be a wall of boxes. The selection bar keeps the chip
// treatment (ConsoleButton).
//
// The span around the label is required: the width probe counts the words
// drawn per row by reading button spans, and a bare text child would read as
// a button with no word on it.
function RowButton({
  label,
  onClick,
  disabled,
  title,
  tone,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  tone?: "danger";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-label={label}
      className={`pm-tool pm-pressable ${
        tone === "danger"
          ? "text-alarm hover:bg-alarm/10"
          : "text-muted-foreground hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/10"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <span>{label}</span>
    </button>
  );
}

// The chip-style console button, kept for the selection bar and empty states,
// where a few buttons stand together for a moment and want to be found. The
// register's rows use RowButton instead, and the word is never conditional.
export function ConsoleButton({
  icon,
  label,
  onClick,
  disabled,
  title,
  tone,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  tone?: "danger";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-label={label}
      className={`pm-tool pm-pressable bg-black/[0.05] dark:bg-white/10 ${
        tone === "danger" ? "text-alarm" : "text-foreground"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
