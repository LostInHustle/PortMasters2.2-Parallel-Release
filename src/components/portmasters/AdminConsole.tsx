"use client";

// =====================================================================
// The operator console: every account in the harbor, and the five things
// an operator can do to one, or to any number of them at once.
//
// The roster is whatever the server last sent. Nothing here is applied
// optimistically: an action is a request, and the answer to a successful
// one is the whole roster as it stands afterwards, so the table can never
// show a change the database did not make. A refusal leaves the table as
// it was and prints the reason above it.
//
// Ticking rows turns the register into a selection, and a selection takes
// four of the five actions a single row takes: ban, unban, grant the
// administrator role, and delete. Revoking is the one left out, because
// taking the console away from several operators at once is how a fleet
// ends up with nobody at the wheel, and it is the one action here whose
// undo is a second promotion.
//
// Every button on this screen is a convenience over a check the server
// makes again anyway, which is why the guards the console draws are only
// the obvious ones: an operator cannot point an action at their own
// account, and each deletion confirmation has to have been typed into
// before it will fire, by name for one account and by count for several.
//
// A selection is allowed to hold accounts an action does not apply to,
// because the register is a list of what exists rather than a list of what
// would work. Those accounts are skipped one by one and the reasons are
// printed, so an operator who ticks twelve and sees eleven changes knows
// which account was left and why.
// =====================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { PublicUser } from "@/lib/api";
import type {
  AdminAccount,
  AdminBulkAction,
  AdminBulkReport,
} from "@/types/realtime";
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
  X,
} from "lucide-react";
import { APP_NAME } from "@/lib/game/constants";

// The tick box, native rather than rebuilt, tinted with the same token the
// administrator pill beside it wears. There is no Checkbox component in
// this tree and one control does not earn one: the browser's own box is
// the thing an operator's hand already knows, and accent-color is the one
// part of it that needs saying.
const CHECKBOX =
  "h-4 w-4 cursor-pointer accent-admin disabled:cursor-not-allowed disabled:opacity-40";

// How a finished bulk action reads. The verb is the console's own word for
// the action, which is the word on the button that was pressed, so the
// sentence that comes back describes what the operator just did.
const BULK_VERB: Record<AdminBulkAction, string> = {
  ban: "Banned",
  unban: "Unbanned",
  grant: "Granted administrator to",
  purge: "Deleted",
};

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
  const { accounts, error, pending, refresh, act, bulk, dismissError } =
    useAdmin(
      socket,
      authed,
      () => onLeave("This account is no longer an administrator."),
      announceBulk,
    );
  // The account the deletion dialog is about, and what the operator has
  // typed into it so far.
  const [purgeTarget, setPurgeTarget] = useState<AdminAccount | null>(null);
  const [confirmText, setConfirmText] = useState("");
  // The ticked accounts, held by id: that is what the server acts on, and
  // it is what survives a roster arriving in a different order.
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  // The selection the bulk deletion dialog was opened over, kept as its own
  // copy so the dialog can still say how many accounts it is about while
  // the register underneath it moves.
  const [bulkTargets, setBulkTargets] = useState<string[]>([]);
  const [bulkConfirm, setBulkConfirm] = useState("");
  const headerBox = useRef<HTMLInputElement>(null);

  // A tick outlives the row it was made on, because an account can be
  // deleted by another operator, or by this one, while it is still ticked.
  // The register is the list of what exists, so the selection is read
  // through it rather than kept in step with it: an id the register no
  // longer holds is not part of the selection, and a roster arriving has
  // nothing to reconcile and nothing to run.
  const selected = useMemo(
    () =>
      accounts === null
        ? []
        : accounts.filter((a) => ticked.has(a.id)).map((a) => a.id),
    [accounts, ticked],
  );

  const total = accounts?.length ?? 0;
  const allSelected = total > 0 && selected.length === total;
  const busy = pending.length > 0;
  const onlineCount = accounts?.filter((a) => a.online).length ?? 0;

  // The header box answers for the whole register, so it shows a dash
  // rather than a tick while only some of it is chosen. The dash is a DOM
  // property with no attribute, which is why it cannot be a prop.
  useEffect(() => {
    if (headerBox.current) {
      headerBox.current.indeterminate = selected.length > 0 && !allSelected;
    }
  }, [selected, allSelected]);

  const toggleOne = (id: string) => {
    setTicked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (accounts === null) return;
    setTicked(allSelected ? new Set() : new Set(accounts.map((a) => a.id)));
  };

  const closePurge = () => {
    setPurgeTarget(null);
    setConfirmText("");
  };

  const closeBulkPurge = () => {
    setBulkTargets([]);
    setBulkConfirm("");
  };

  const openBulkPurge = () => {
    setBulkConfirm("");
    setBulkTargets(selected);
  };

  // The dialog is open exactly while there is a selection copy to act on,
  // which is what makes an empty copy and a closed dialog the same state
  // rather than two that have to be kept in step.
  const bulkCount = bulkTargets.length;

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

        {selected.length > 0 && (
          <div className="pm-glass pm-panel-bar flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium">
              {selected.length} {selected.length === 1 ? "account" : "accounts"}{" "}
              selected
            </span>
            {/* The selection survives the action, so the same set of
                accounts can be banned, corrected and banned again without
                being ticked twice. Whatever the action could not do is
                reported, and whatever it did is already in the table. */}
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <ConsoleButton
                icon={<Ban className="h-3.5 w-3.5" />}
                label="Ban"
                showLabel
                disabled={busy}
                onClick={() => bulk("ban", selected)}
              />
              <ConsoleButton
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                label="Unban"
                showLabel
                disabled={busy}
                onClick={() => bulk("unban", selected)}
              />
              <ConsoleButton
                icon={<ShieldCheck className="h-3.5 w-3.5" />}
                label="Grant admin"
                showLabel
                disabled={busy}
                onClick={() => bulk("grant", selected)}
              />
              <ConsoleButton
                icon={<Trash2 className="h-3.5 w-3.5" />}
                label="Delete"
                tone="danger"
                showLabel
                disabled={busy}
                onClick={openBulkPurge}
              />
              <ConsoleButton
                icon={<X className="h-3.5 w-3.5" />}
                label="Clear"
                showLabel
                onClick={() => setTicked(new Set())}
              />
            </div>
          </div>
        )}

        <div className="pm-glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left dark:border-white/[0.08]">
                  <th className="w-10 py-2.5 pl-4 pr-2">
                    <input
                      ref={headerBox}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={total === 0}
                      aria-label="Select every account"
                      title="Select every account"
                      className={CHECKBOX}
                    />
                  </th>
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
                      colSpan={8}
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
                      colSpan={8}
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
                    busy={pending.includes(a.id)}
                    selected={ticked.has(a.id)}
                    onToggle={() => toggleOne(a.id)}
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
          cannot be undone. Tick accounts to act on several at once.
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

      <Dialog
        open={bulkCount > 0}
        onOpenChange={(open) => {
          if (!open) closeBulkPurge();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-alarm/5">
                <Trash2 className="h-4 w-4 text-alarm" />
              </span>
              Delete {bulkCount} {bulkCount === 1 ? "account" : "accounts"}?
            </DialogTitle>
            <DialogDescription>
              Every account ticked is removed, along with every harbor it hosts,
              every seat it holds, and every voyage, chronicle and merit it has
              earned. Any captain sitting in one of those harbors is sent back
              to the Lobby. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-1.5">
            {/* A name per account would be a paragraph to retype, so the
                confirmation for a selection is the count. It is a number
                the operator can only produce by looking at what they
                ticked, and the server holds the two against each other. */}
            <Label className="text-sm font-medium">
              Type {bulkCount} to confirm
            </Label>
            <Input
              value={bulkConfirm}
              onChange={(e) => setBulkConfirm(e.target.value)}
              placeholder={String(bulkCount)}
              inputMode="numeric"
              autoComplete="off"
              className="h-11 font-mono"
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={closeBulkPurge}>
              Cancel
            </Button>
            <Button
              className="bg-alarm text-background"
              disabled={bulkConfirm.trim() !== String(bulkCount)}
              onClick={() => {
                bulk("purge", bulkTargets, Number(bulkConfirm));
                closeBulkPurge();
              }}
            >
              Delete Accounts
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// What an operator is told once a bulk action is over. Every account in the
// selection is answered separately, so a selection wider than what the
// action applies to is normal rather than a failure, and the sentence says
// how far it got: a clean run is one line, a partial one counts itself and
// lists what was left behind and why. That list is the whole reason the
// report exists, so it is shown at length rather than summarised.
function announceBulk(report: AdminBulkReport): void {
  const verb = BULK_VERB[report.action];
  const line =
    report.skipped.length === 0
      ? `${verb} ${report.applied} ${plural(report.applied)}.`
      : `${verb} ${report.applied} of ${report.requested} accounts.`;
  if (report.skipped.length === 0) {
    toast.success(line);
    return;
  }
  toast.warning(line, {
    description: report.skipped.join(" "),
    // Long enough to read a list of refusals, since that list is the only
    // place a skipped account is ever explained.
    duration: 10000,
  });
}

function plural(count: number): string {
  return count === 1 ? "account" : "accounts";
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
  selected,
  onToggle,
  onAct,
  onPurge,
}: {
  account: AdminAccount;
  isSelf: boolean;
  busy: boolean;
  selected: boolean;
  onToggle: () => void;
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
      <td className="w-10 py-2.5 pl-4 pr-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${account.displayName}`}
          title={`Select ${account.displayName}`}
          className={CHECKBOX}
        />
      </td>
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
                <ConsoleButton
                  icon={<RotateCcw className="h-3.5 w-3.5" />}
                  label="Unban"
                  onClick={() => onAct("unban", account.id)}
                />
              ) : (
                <ConsoleButton
                  icon={<Ban className="h-3.5 w-3.5" />}
                  label="Ban"
                  disabled={isSelf}
                  title={selfTitle}
                  onClick={() => onAct("ban", account.id)}
                />
              )}
              {isAdmin ? (
                <ConsoleButton
                  icon={<ShieldOff className="h-3.5 w-3.5" />}
                  label="Revoke admin"
                  disabled={isSelf}
                  title={selfTitle}
                  onClick={() => onAct("revoke", account.id)}
                />
              ) : (
                <ConsoleButton
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  label="Grant admin"
                  // A banned account cannot open the console, so the role
                  // would be a promise the console cannot keep.
                  disabled={isBanned}
                  title={isBanned ? "Unban the account first" : undefined}
                  onClick={() => onAct("grant", account.id)}
                />
              )}
              <ConsoleButton
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

// The console's one button shape, on a row and in the selection bar: the
// height and corners of every other control in the app, an icon, and a word
// that appears with it. A row has five of these side by side and the word is
// what makes them a crowd, so a row keeps the word for the wide screens.
function ConsoleButton({
  icon,
  label,
  onClick,
  disabled,
  title,
  tone,
  showLabel,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  tone?: "danger";
  showLabel?: boolean;
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
      <span className={showLabel ? undefined : "hidden xl:inline"}>
        {label}
      </span>
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
