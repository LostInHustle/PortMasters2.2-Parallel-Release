"use client";

import { AdminAccount } from "@/types/realtime/admin";
import { t } from "@/lib/game/i18n";
import { Avatar } from "@/components/portmasters/shared";
import { AccountActions, type AccountActionFn } from "./AdminControls";
import { RoleChip, StatusChip } from "./AdminChips";

// Native checkbox tinted with the admin token. The browser's own control is
// what an operator's hand already knows, and accent-color is the one part
// that needs saying.
export const CHECKBOX =
  "h-4 w-4 cursor-pointer accent-admin disabled:cursor-not-allowed disabled:opacity-40";

// The seven facts a table row and a card both receive.
type AccountRowProps = {
  account: AdminAccount;
  isSelf: boolean;
  busy: boolean;
  selected: boolean;
  onToggle: () => void;
  onAct: AccountActionFn;
  onPurge: () => void;
};

// Name with the administrator mark, then handle and join date. The date
// qualifies a name rather than earning a column of its own.
function AccountIdentity({ account }: { account: AdminAccount }) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium">{account.displayName}</span>
        {account.role === "admin" && <RoleChip isAdmin />}
      </div>
      {/* Wrapped rather than truncated so the cell's floor is its longest
          word, not the whole handle and date on one unbroken line. */}
      <div className="break-words text-[11px] text-muted-foreground">
        {account.username} · {formatJoined(account.createdAt)}
      </div>
    </div>
  );
}

// One account as a row of the table.
export function RosterRow({
  account,
  isSelf,
  busy,
  selected,
  onToggle,
  onAct,
  onPurge,
}: AccountRowProps) {
  const isBanned = account.bannedAt !== null;
  return (
    <tr className="border-b border-black/[0.04] transition-colors last:border-0 hover:bg-black/[0.02] dark:border-white/[0.06] dark:hover:bg-white/[0.03]">
      <td className="w-px py-2.5 pl-4 pr-3">
        <SelectBox account={account} selected={selected} onToggle={onToggle} />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar
            hue={account.avatarHue}
            name={account.displayName}
            size={28}
            sm={32}
          />
          <AccountIdentity account={account} />
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-2.5">
        <StatusChip isBanned={isBanned} online={account.online} />
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
        {account.roomsHosted}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
        {account.seatsHeld}
      </td>
      <td className="py-2.5 pl-4 pr-3">
        <div className="flex items-center justify-end gap-1">
          <AccountActions
            account={account}
            isSelf={isSelf}
            busy={busy}
            onAct={onAct}
            onPurge={onPurge}
          />
        </div>
      </td>
    </tr>
  );
}

// The same account as a card, for every width the table cannot be drawn at.
// The actions are why the card exists: it has room to say what each button
// does, where a narrow table would leave bare icons. Everything hangs off the
// identity's column so the eye reads down a single line.
export function AccountCard({
  account,
  isSelf,
  busy,
  selected,
  onToggle,
  onAct,
  onPurge,
}: AccountRowProps) {
  const isBanned = account.bannedAt !== null;
  return (
    <li className="border-b border-black/[0.04] px-4 py-3 last:border-0 dark:border-white/[0.06]">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <SelectBox
            account={account}
            selected={selected}
            onToggle={onToggle}
          />
        </div>
        <Avatar
          hue={account.avatarHue}
          name={account.displayName}
          size={28}
          sm={32}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium">
              {account.displayName}
            </span>
            <RoleChip isAdmin={account.role === "admin"} />
            <StatusChip isBanned={isBanned} online={account.online} />
          </div>
          <p className="mt-0.5 break-words text-[11px] text-muted-foreground">
            {account.username} · {formatJoined(account.createdAt)}
          </p>

          {/* The counts an operator reads, then the actions at the far end
              of the same line. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {account.roomsHosted}{" "}
              {t(account.roomsHosted === 1 ? "Harbor" : "Harbors")} ·{" "}
              {account.seatsHeld}{" "}
              {t(account.seatsHeld === 1 ? "Seat" : "Seats")}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <AccountActions
                account={account}
                isSelf={isSelf}
                busy={busy}
                onAct={onAct}
                onPurge={onPurge}
              />
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

// The tick box both presentations carry, so a screen reader reads the same
// label in the row and the card.
function SelectBox({
  account,
  selected,
  onToggle,
}: {
  account: AdminAccount;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <input
      type="checkbox"
      checked={selected}
      onChange={onToggle}
      aria-label={t("Select {account.displayName}", {
        "account.displayName": account.displayName,
      })}
      title={t("Select {account.displayName}", {
        "account.displayName": account.displayName,
      })}
      className={CHECKBOX}
    />
  );
}

// Join date in the browser's own locale, with no time attached: the question
// is how long someone has been around, not the exact moment.
function formatJoined(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return t("Unknown");
  return at.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
