"use client";

// =====================================================================
// The operator console: every account in the harbor, and the five things
// an operator can do to one.
//
// The roster is whatever the server last sent. Nothing here is applied
// optimistically: an action is a request, and the answer to a successful
// one is the whole roster as it stands afterwards, so the table can never
// show a change the database did not make. A refusal leaves the table as
// it was and prints the reason above it.
//
// Every button on this screen is a convenience over a check the server
// makes again anyway, which is why the guards the console draws are only
// the obvious ones: an operator cannot point an action at their own
// account, and the deletion confirmation has to have the captain name
// typed into it before it will fire.
// =====================================================================

import { useState } from "react";
import type { PublicUser } from "@/lib/api";
import type { AdminAccount } from "@/types/realtime";
import { useRealtime } from "@/lib/use-realtime";
import { useAdmin } from "@/lib/use-admin";
import { Avatar, Notice, OnlineDot } from "@/components/portmasters/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Ban,
  Loader2,
  LogOut,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { APP_NAME } from "@/lib/game/constants";

export function AdminConsole({
  me,
  onSignOut,
  onLeave,
}: {
  me: PublicUser;
  // The operator pressing Sign out. Separate from onLeave because this one
  // ends the session as well as the screen: the page talks to the server
  // before it clears anything, so a sign out is a real sign out.
  onSignOut: () => void;
  // Out of the console with a reason and no session to end: the role was
  // taken away, or the server has already refused this connection. The page
  // owns the card that comes next, so it owns the telling.
  onLeave: (notice: string) => void;
}) {
  const { socket, authed } = useRealtime(me, onLeave);
  const { accounts, error, pending, refresh, act, dismissError } = useAdmin(
    socket,
    authed,
    () => onLeave("This account is no longer an administrator."),
  );
  // The account the deletion dialog is about, and what the operator has
  // typed into it so far.
  const [purgeTarget, setPurgeTarget] = useState<AdminAccount | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const closePurge = () => {
    setPurgeTarget(null);
    setConfirmText("");
  };

  const onlineCount = accounts?.filter((a) => a.online).length ?? 0;

  return (
    <div className="pm-canvas min-h-screen">
      <header className="px-4 pb-2 pt-3 sm:px-6">
        <div className="pm-glass pm-panel-bar mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            <div className="pm-seal pm-grad-admin">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-sm font-bold leading-tight tracking-tight">
                Operator Console
              </h1>
              <p className="pm-truncate text-[11px] leading-tight text-muted-foreground">
                {accounts === null
                  ? "Reading the register..."
                  : `${accounts.length} accounts, ${onlineCount} online, for ${APP_NAME}`}
              </p>
            </div>
            <button
              onClick={refresh}
              className="pm-tool pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
              title="Refresh the roster"
              aria-label="Refresh the roster"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={onSignOut}
              className="pm-tool pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-3 px-4 pb-10 pt-3 sm:px-6">
        {error && <Notice message={error} onDismiss={dismissError} />}

        <div className="pm-glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left dark:border-white/[0.08]">
                  <Th>Captain</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Harbors</Th>
                  <Th className="text-right">Seats</Th>
                  <Th>Joined</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {accounts === null && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-xs text-muted-foreground"
                    >
                      <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                      Reading the register...
                    </td>
                  </tr>
                )}
                {accounts?.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-xs text-muted-foreground"
                    >
                      There are no accounts to show.
                    </td>
                  </tr>
                )}
                {accounts?.map((a) => (
                  <RosterRow
                    key={a.id}
                    account={a}
                    isSelf={a.id === me.id}
                    busy={pending === a.id}
                    onAct={act}
                    onPurge={() => {
                      setConfirmText("");
                      setPurgeTarget(a);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          Banning ends every session the account holds and clears its seats on
          the spot. Deleting removes the account and every harbor it hosts, and
          cannot be undone.
        </p>
      </main>

      <Dialog
        open={purgeTarget !== null}
        onOpenChange={(open) => {
          if (!open) closePurge();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {/* The destructive accent, for the same reason the restart
                  dialog wears it: this is the one action here that takes
                  rather than gives. */}
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-alarm/5">
                <Trash2 className="h-4 w-4 text-alarm" />
              </span>
              Delete {purgeTarget?.displayName}?
            </DialogTitle>
            <DialogDescription>
              The account is removed, along with every harbor it hosts, every
              seat it holds, and every voyage, chronicle and merit it has
              earned. Any captain sitting in one of those harbors is sent back
              to the Lobby. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-1.5">
            <Label className="text-sm font-medium">
              Type {purgeTarget?.username} to confirm
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={purgeTarget?.username ?? ""}
              autoComplete="off"
              className="h-11 font-mono"
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={closePurge}>
              Cancel
            </Button>
            <Button
              className="bg-alarm text-background"
              disabled={!purgeTarget || confirmText !== purgeTarget.username}
              onClick={() => {
                if (!purgeTarget) return;
                act("purge", purgeTarget.id, confirmText);
                closePurge();
              }}
            >
              Delete Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function RosterRow({
  account,
  isSelf,
  busy,
  onAct,
  onPurge,
}: {
  account: AdminAccount;
  isSelf: boolean;
  busy: boolean;
  onAct: (action: "ban" | "unban" | "grant" | "revoke", userId: string) => void;
  onPurge: () => void;
}) {
  const isAdmin = account.role === "admin";
  const isBanned = account.bannedAt !== null;
  // Banning, demoting and deleting your own account would be a way to lock
  // yourself out of the console with one click, and none of them is ever
  // what was meant. The server refuses all three as well.
  const selfTitle = isSelf ? "Not available on your own account" : undefined;

  return (
    <tr className="border-b border-black/[0.04] last:border-0 dark:border-white/[0.06]">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar
            hue={account.avatarHue}
            name={account.displayName}
            size={28}
          />
          <div className="min-w-0">
            <div className="truncate font-medium">{account.displayName}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {account.username}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5">
        {isAdmin ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-admin/10 px-2 py-0.5 text-[11px] font-medium text-admin">
            <ShieldCheck className="h-3 w-3" /> Administrator
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Captain</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        {isBanned ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-alarm/10 px-2 py-0.5 text-[11px] font-medium text-alarm">
            <Ban className="h-3 w-3" /> Banned
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <OnlineDot online={account.online} size={7} />
            {account.online ? "Online" : "Away"}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {account.roomsHosted}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {account.seatsHeld}
      </td>
      <td className="px-4 py-2.5 text-[11px] text-muted-foreground">
        {formatJoined(account.createdAt)}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <>
              {isBanned ? (
                <RowButton
                  icon={<RotateCcw className="h-3.5 w-3.5" />}
                  label="Unban"
                  onClick={() => onAct("unban", account.id)}
                />
              ) : (
                <RowButton
                  icon={<Ban className="h-3.5 w-3.5" />}
                  label="Ban"
                  disabled={isSelf}
                  title={selfTitle}
                  onClick={() => onAct("ban", account.id)}
                />
              )}
              {isAdmin ? (
                <RowButton
                  icon={<ShieldOff className="h-3.5 w-3.5" />}
                  label="Revoke admin"
                  disabled={isSelf}
                  title={selfTitle}
                  onClick={() => onAct("revoke", account.id)}
                />
              ) : (
                <RowButton
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  label="Grant admin"
                  // A banned account cannot open the console, so the role
                  // would be a promise the console cannot keep.
                  disabled={isBanned}
                  title={isBanned ? "Unban the account first" : undefined}
                  onClick={() => onAct("grant", account.id)}
                />
              )}
              <RowButton
                icon={<Trash2 className="h-3.5 w-3.5" />}
                label="Delete"
                tone="danger"
                disabled={isSelf}
                title={selfTitle}
                onClick={onPurge}
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function RowButton({
  icon,
  label,
  onClick,
  disabled,
  title,
  tone,
}: {
  icon: React.ReactNode;
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
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

// The day an account was made, in the browser's own locale and with no
// time attached: an operator is asking how long someone has been around,
// not to the second when.
function formatJoined(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "Unknown";
  return at.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
