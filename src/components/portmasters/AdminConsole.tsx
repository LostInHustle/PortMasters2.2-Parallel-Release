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
//
// The register is drawn twice, from one set of rows: a table where the
// column is wide enough for one, and a card per account where it is not.
// The width that decides is the column's own rather than the window's,
// which is the whole reason for the split. The eight column table this
// screen used to draw needed 1034 pixels while the column it stood in was
// capped at 976, so at every desktop size the operator had to drag the
// roster sixty pixels sideways to reach the buttons, and on a phone the
// drag was 485 pixels: an operator acting on an account could not see the
// name of the account they were acting on. A table is the right shape for
// a register this dense, and a card is the right shape for a hand, so the
// screen keeps both rather than picking one and dragging it everywhere.
// =====================================================================

import {
  AdminAccount,
  AdminBulkAction,
  AdminBulkReport,
} from "@/types/realtime/admin";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { PublicUser } from "@/lib/api";
import { useRealtime } from "@/lib/use-realtime";
import { useAdmin } from "@/lib/use-admin";
import { Avatar, Notice, OnlineDot, Th } from "@/components/portmasters/shared";
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
  Gauge,
  Loader2,
  LogOut,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Trash2,
  X,
} from "lucide-react";
import { APP_NAME } from "@/lib/game/constants/brand";

// The tick box, native rather than rebuilt, tinted with the same token the
// administrator pill beside it wears. There is no Checkbox component in
// this tree and one control does not earn one: the browser's own box is
// the thing an operator's hand already knows, and accent-color is the one
// part of it that needs saying.
const CHECKBOX =
  "h-4 w-4 cursor-pointer accent-admin disabled:cursor-not-allowed disabled:opacity-40";

// The width at which the register has room to be a table, and the reason it
// is 60rem rather than a round number out of the scale: the eight column
// table came to 1034 pixels, folding the Joined column into the identity
// cell takes 75 of them back and leaves 958, and the table must fit the
// container with the container's own padding already taken out. 60rem is
// 960, the first size that clears it. Below it the register is a card per
// account.
//
// The variant is spelled out at both call sites rather than held in a
// constant, because Tailwind reads class names as text and a name assembled
// from a variable is a name it never emits. The two are exact complements
// (the table asks for the width, the cards ask for everything under it) so
// an edit to one is an edit to the other: the table wrapper is
// `hidden @min-[60rem]:block` and the card list is `@min-[60rem]:hidden`.

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
      {/* The column, and the thing every width decision below reads. It
          carries the cap and the padding rather than the two children
          doing it separately, so the container's own width is the width
          the roster actually has, and the bar above the register is
          measured against the same number the register is.

          The cap is a table's rather than a page's, which is the one place
          this screen and the balance dashboard differ: what is read here is
          a register of eight columns, and what is read there is prose. At
          the page cap the identity column had 167 pixels for a line that
          needs about 170, so every row with a long handle wrapped its date
          onto a second line and the register came out ragged. The column
          that fits a table is the width of a table. */}
      <div className="@container mx-auto max-w-6xl px-4 sm:px-6">
        <header className="pb-2 pt-3">
          <div className="pm-glass pm-panel-bar">
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
              {/* The console's one neighbour: the balance dashboard reads
                the two measurement tables rather than the account rows, so
                it is a page of its own. It lives one level down from here
                and this is the way in. */}
              <a
                href="/admin/balance"
                className="pm-tool pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
                title="The balance dashboard"
              >
                <Gauge className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Balance</span>
              </a>
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

        <main className="space-y-3 pb-10 pt-3">
          {error && <Notice message={error} onDismiss={dismissError} />}

          {selected.length > 0 && (
            <div className="pm-glass pm-panel-bar flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium">
                {selected.length}{" "}
                {selected.length === 1 ? "account" : "accounts"} selected
              </span>
              {/* The selection survives the action, so the same set of
                accounts can be banned, corrected and banned again without
                being ticked twice. Whatever the action could not do is
                reported, and whatever it did is already in the table. */}
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <ConsoleButton
                  icon={<Ban className="h-3.5 w-3.5" />}
                  label="Ban"
                  disabled={busy}
                  onClick={() => bulk("ban", selected)}
                />
                <ConsoleButton
                  icon={<RotateCcw className="h-3.5 w-3.5" />}
                  label="Unban"
                  disabled={busy}
                  onClick={() => bulk("unban", selected)}
                />
                <ConsoleButton
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  label="Grant admin"
                  disabled={busy}
                  onClick={() => bulk("grant", selected)}
                />
                <ConsoleButton
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  label="Delete"
                  tone="danger"
                  disabled={busy}
                  onClick={openBulkPurge}
                />
                <ConsoleButton
                  icon={<X className="h-3.5 w-3.5" />}
                  label="Clear"
                  onClick={() => setTicked(new Set())}
                />
              </div>
            </div>
          )}

          <div className="pm-glass overflow-hidden rounded-2xl">
            {accounts === null ? (
              <p className="px-4 py-10 text-center text-xs text-muted-foreground">
                <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                Reading the register...
              </p>
            ) : accounts.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-muted-foreground">
                There are no accounts to show.
              </p>
            ) : (
              <>
                {/* The register as a table, where the column has room for
                  one. The table carries no minimum width of its own any
                  more: it is only drawn where it fits, which is what the
                  width above decides, so a floor here would be a second
                  copy of that decision waiting to disagree with it. */}
                <div className="hidden @min-[60rem]:block overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
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
                        <Th className="text-right">Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((a) => (
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

                {/* The same register as a card per account, everywhere the
                  table has no room. The two are drawn from the register
                  rather than from each other, and the pieces they share
                  are shared: an account's role, its status and its four
                  actions are one component each, so a card and a row can
                  never come to describe the same account differently. */}
                <ul className="@min-[60rem]:hidden">
                  {accounts.map((a) => (
                    <AccountCard
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
                </ul>
              </>
            )}
          </div>

          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
            Banning ends every session the account holds and clears its seats on
            the spot. Deleting removes the account and every harbor it hosts,
            and cannot be undone. Tick accounts to act on several at once.
          </p>
        </main>
      </div>

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

// The four actions an operator can take on one account. Named here rather
// than at each row, so the callback the page hands down is typed once and a
// fifth action would be a fifth name in one place.
type AccountActionFn = (
  action: "ban" | "unban" | "grant" | "revoke",
  userId: string,
) => void;

// What a table row and a card are both given. They are the same seven
// facts, which is what lets the two be drawn from one register without
// either of them deciding anything the other does not.
type AccountRowProps = {
  account: AdminAccount;
  isSelf: boolean;
  busy: boolean;
  selected: boolean;
  onToggle: () => void;
  onAct: AccountActionFn;
  onPurge: () => void;
};

// What one account is, as three pieces both presentations draw. They are
// separate components rather than markup written twice because a table row
// and a card that each decided for themselves how an administrator is
// labelled would be two answers to one question, and the day the answers
// differed the register would say two things about one account.
function RoleChip({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) {
    return <span className="text-[11px] text-muted-foreground">Captain</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-admin/10 px-2 py-0.5 text-[11px] font-medium text-admin">
      <ShieldCheck className="h-3 w-3" /> Administrator
    </span>
  );
}

// A banned account is never also shown as online: the ban is the fact an
// operator has to act on, and the last thing an account did before it is
// not. That is why these are one choice rather than two chips side by side.
function StatusChip({
  isBanned,
  online,
}: {
  isBanned: boolean;
  online: boolean;
}) {
  if (isBanned) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-alarm/10 px-2 py-0.5 text-[11px] font-medium text-alarm">
        <Ban className="h-3 w-3" /> Banned
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <OnlineDot online={online} size={7} />
      {online ? "Online" : "Away"}
    </span>
  );
}

// The four things an operator can do to one account, in the one place they
// are decided, so a row and a card offer the same four in the same order
// with the same guards. Skipped entirely while an action on this account is
// in flight, because a second press during one is a second request.
function AccountActions({
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
  // Banning, demoting and deleting your own account would be a way to lock
  // yourself out of the console with one click, and none of them is ever
  // what was meant. The server refuses all three as well.
  const selfTitle = isSelf ? "Not available on your own account" : undefined;

  if (busy) {
    return (
      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
    );
  }
  return (
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
          // A banned account cannot open the console, so the role would be
          // a promise the console cannot keep.
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
  );
}

// One account's identity, as the two lines both presentations lead with:
// the name, and under it the handle with the day the account was made. The
// joined date is here rather than in a column of its own because it is not
// a fact an operator scans down the register for; it is a qualification on
// a name, and it costs the table 75 pixels it did not have.
function AccountIdentity({ account }: { account: AdminAccount }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium">{account.displayName}</div>
      {/* Wrapped rather than truncated, and that is a width decision as
          much as a typographic one. A cell of nowrap text has a minimum
          width of the whole string, so a handle and a date held on one
          unbroken line set the floor for the entire table and were what
          pushed it past the column it stands in. Left free to wrap, the
          floor is the longest word in it and the table gives the cell
          whatever room is left over. */}
      <div className="break-words text-[11px] text-muted-foreground">
        {account.username} · {formatJoined(account.createdAt)}
      </div>
    </div>
  );
}

// One account as a row of the table.
function RosterRow({
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
    <tr className="border-b border-black/[0.04] last:border-0 dark:border-white/[0.06]">
      <td className="w-10 py-2.5 pl-4 pr-2">
        <SelectBox account={account} selected={selected} onToggle={onToggle} />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar
            hue={account.avatarHue}
            name={account.displayName}
            size={28}
          />
          <AccountIdentity account={account} />
        </div>
      </td>
      <td className="px-4 py-2.5">
        <RoleChip isAdmin={account.role === "admin"} />
      </td>
      <td className="px-4 py-2.5">
        <StatusChip isBanned={isBanned} online={account.online} />
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {account.roomsHosted}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {account.seatsHeld}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
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
//
// The actions are the reason the card exists. A table row put five of them
// in a column 267 pixels wide and had none of the words fit until the
// window reached 1280, which is a width the column itself never changed at,
// so on a phone an operator pressed one of five bare icons and found out
// afterwards which one it was. A card has the width to say what its buttons
// do, and says it at every size the card is drawn at.
function AccountCard({
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
    <li className="border-b border-black/[0.04] px-3 py-3 last:border-0 dark:border-white/[0.06]">
      <div className="flex items-start gap-2.5">
        <div className="pt-0.5">
          <SelectBox
            account={account}
            selected={selected}
            onToggle={onToggle}
          />
        </div>
        <Avatar hue={account.avatarHue} name={account.displayName} size={28} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium">
              {account.displayName}
            </span>
            <RoleChip isAdmin={account.role === "admin"} />
            <StatusChip isBanned={isBanned} online={account.online} />
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {account.username} · {formatJoined(account.createdAt)}
          </p>
        </div>
      </div>

      {/* The two counts, then the actions at the far end of the same line.
          The indent puts the facts under the avatar rather than under the
          tick box, which is the line the eye is already on; it is dropped
          once the card is too narrow to spend 64 pixels on an alignment. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 @sm:pl-16">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {account.roomsHosted}{" "}
          {account.roomsHosted === 1 ? "harbor" : "harbors"} ·{" "}
          {account.seatsHeld} {account.seatsHeld === 1 ? "seat" : "seats"}
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
    </li>
  );
}

// The tick box, which both presentations carry: the row's first cell and the
// card's first control. One component so the label a screen reader reads is
// the same sentence in both.
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
      aria-label={`Select ${account.displayName}`}
      title={`Select ${account.displayName}`}
      className={CHECKBOX}
    />
  );
}

// The console's one button shape, on a row and in the selection bar: the
// height and corners of every other control in the app, an icon, and the
// word that says what the button does.
//
// The word used to be conditional. A row holds five of these and five words
// is a crowd, so the words were kept for wide screens and the condition was
// a viewport breakpoint at 1280. The column a row is drawn in is capped at
// 1024 whatever the window does, so the breakpoint was reading the wrong
// number: on a 1024 desktop the five buttons were bare icons with room to
// spare, and past 1280 the words arrived and pushed the table 60 pixels
// wider than the column it stands in. The word is not conditional any more.
// The table is only drawn where a worded row fits, and the card only where
// a worded row wraps comfortably, so every button on this screen says what
// it does.
function ConsoleButton({
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
      <span>{label}</span>
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
