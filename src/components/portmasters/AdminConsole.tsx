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
// which is the whole reason for the split. A table is the right shape
// for a register this dense and a card is the right shape for a hand,
// and a table dragged sideways to reach its own row buttons hides the
// name of the account being acted on, so the screen keeps both shapes
// rather than picking one and dragging it everywhere.
//
// Three things shape the screen as it stands now.
//
// Nothing on the page carries a width of its own. The column runs the
// full width of the window with gutters that grow with it, and every
// column in the table is sized by what it holds: the tick box and the row
// actions hug their content, the name takes whatever is left over, and
// the counts sit against the right edge of theirs. A wall display spends
// its width on the register rather than on its margins, a laptop gets the
// same table at the same proportions, and a phone gets the cards.
//
// At lg and up the page is a fixed shell rather than a document: the
// header, the tools and the register's frame all stand still and only the
// register scrolls inside its frame, so an operator a thousand rows deep
// can still see the title, the search and the way out. The shell is the
// harbor's own shape (see GameRoom). Below lg nothing is pinned and the
// document scrolls, which is what a hand expects, and the unpinned card
// list is drawn there anyway.
//
// And a register is something an operator looks things up in, so it takes
// a search box and four counted filters: all, online, admins and bans.
// Both are views over the roster this screen already holds, decided on
// the client, and the search is deferred so a keystroke never waits on
// nine hundred rows. The selection follows the same rule: the header box
// ticks what the filters leave visible, while the actions answer for
// everything ticked anywhere in the register.
// =====================================================================

import { AdminAccount } from "@/types/realtime/admin";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { PublicUser } from "@/lib/api";
import { NO_LONGER_AN_ADMINISTRATOR } from "@/lib/game/constants/copy";
import { t } from "@/lib/game/i18n";
import { useRealtime } from "@/lib/use-realtime";
import { READING_THE_REGISTER, useAdmin } from "@/lib/use-admin";
import { Notice, Th } from "@/components/portmasters/shared";
import { AccountCard, CHECKBOX, RosterRow } from "./admin/AdminRow";
import { ConsoleButton } from "./admin/AdminControls";
import { announceBulk, plural } from "./admin/AdminBulkNotice";
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
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { APP_NAME } from "@/lib/game/constants/brand";

// The width at which the register has harbor to be a table, and the reason
// it is 52rem rather than a round number out of the scale: the table below
// is sized by its own content, and against this roster its floor, the
// narrowest it can get before a cell's text starts to break, measures 817
// pixels with the cells' padding counted. The glass frame adds its two
// pixels of border, so a container needs 819 to draw the table without a
// drag, and 52rem is 832. The number is a measurement rather than a taste:
// the six column table this screen first drew measured 881 and set the
// threshold at 56rem, and the loudest part of it was the row actions, five
// chip buttons with icons and words that alone held the widest column on
// the register. Drawing those actions as quiet words took the floor down
// to 817 and the threshold down with it, which is what let the table into
// widths the chips never fit. The width probe measures it again at every
// pass: it draws the table at each size and reads the drag to the last
// column, which must be zero. Below the threshold the register is a card
// per account, which is the right shape for the widths the table cannot
// take.
//
// The variant is spelled out at both call sites rather than held in a
// constant, because Tailwind reads class names as text and a name assembled
// from a variable is a name it never emits. The two are exact complements
// (the table asks for the width, the cards ask for everything under it) so
// an edit to one is an edit to the other: the table wrapper is
// `hidden @min-[52rem]:flex` and the card list is `@min-[52rem]:hidden`.

// The register's header cells, held to the top of the frame that scrolls
// under them. A transparent header cell would let the rows show through it
// as they pass beneath, so the cells wear the glass shell's own fill, read
// from --pm-glass-fill, which .pm-glass publishes for each theme (see
// globals.css). The dark value rides along with the property, so a theme
// switch moves the shell and its head together.
const STICKY =
  "sticky top-0 z-10 border-b border-black/[0.06] bg-(--pm-glass-fill) dark:border-white/[0.08]";

// The register's four views and what each one keeps. The counts beside the
// words on the chips are read from the same roster, so an operator can see
// the account they are looking for exists before they look.
type RegisterFilter = "all" | "online" | "admins" | "banned";

const FILTER_ORDER: RegisterFilter[] = ["all", "online", "admins", "banned"];

const FILTERS: Record<
  RegisterFilter,
  { label: string; keeps: (a: AdminAccount) => boolean }
> = {
  all: { label: "All", keeps: () => true },
  online: { label: "Online", keeps: (a) => a.online },
  admins: { label: "Admins", keeps: (a) => a.role === "admin" },
  banned: { label: "Banned", keeps: (a) => a.bannedAt !== null },
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
      () => onLeave(t(NO_LONGER_AN_ADMINISTRATOR)),
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
  // The register's findability tools: a text query and a status filter.
  // Both are views over the roster this screen already holds, so neither
  // asks the server for anything.
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RegisterFilter>("all");
  // The register is drawn twice and runs to hundreds of rows, so the query
  // is deferred: the input answers the keystroke immediately while the
  // rows catch up on React's own schedule.
  const deferredQuery = useDeferredValue(query);

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

  const busy = pending.length > 0;
  const onlineCount = accounts?.filter((a) => a.online).length ?? 0;

  // The register as the search leaves it, then as the filter leaves it.
  // The chip counts are read off the searched set rather than the raw
  // roster, so a count tells an operator how many of that kind their
  // search can see.
  const trimmed = deferredQuery.trim().toLowerCase();
  const matching = useMemo(
    () =>
      accounts === null
        ? []
        : trimmed === ""
          ? accounts
          : accounts.filter(
              (a) =>
                a.displayName.toLowerCase().includes(trimmed) ||
                a.username.toLowerCase().includes(trimmed),
            ),
    [accounts, trimmed],
  );
  const counts: Record<RegisterFilter, number> = {
    all: matching.length,
    online: matching.filter((a) => a.online).length,
    admins: matching.filter((a) => a.role === "admin").length,
    banned: matching.filter((a) => a.bannedAt !== null).length,
  };
  const visible = matching.filter(FILTERS[filter].keeps);

  // The header box answers for what the filters leave visible, because
  // that is what a press on it acts on. The selection itself is read
  // through the whole register, so a ticked account the view has hidden
  // is still selected and still acted on: the selection bar counts it and
  // Clear clears it.
  const visibleSelected = visible.filter((a) => ticked.has(a.id)).length;
  const allVisibleSelected =
    visible.length > 0 && visibleSelected === visible.length;

  // The dash is a DOM property with no attribute, which is why it cannot
  // be a prop.
  useEffect(() => {
    if (headerBox.current) {
      headerBox.current.indeterminate =
        visibleSelected > 0 && !allVisibleSelected;
    }
  }, [visibleSelected, allVisibleSelected]);

  const toggleOne = (id: string) => {
    setTicked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  // The header box, over whatever is visible: ticking selects the rows an
  // operator can see, and unticking releases them, without touching a
  // tick that a filter is hiding.
  const toggleAll = () => {
    if (visible.length === 0) return;
    setTicked((current) => {
      const next = new Set(current);
      for (const account of visible) {
        if (allVisibleSelected) next.delete(account.id);
        else next.add(account.id);
      }
      return next;
    });
  };

  // Out of whatever view the register is in and back to the whole roster.
  const clearView = () => {
    setQuery("");
    setFilter("all");
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

  // The seven facts a row and a card both read off one account, written once
  // so the two registers cannot come to describe the same account differently.
  const accountRowProps = (a: AdminAccount) => ({
    isSelf: a.id === me.id,
    busy: pending.includes(a.id),
    selected: ticked.has(a.id),
    onToggle: () => toggleOne(a.id),
    onAct: act,
    onPurge: () => {
      setConfirmText("");
      setPurgeTarget(a);
    },
  });

  return (
    <div className="pm-canvas flex min-h-screen w-full flex-col lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden">
      {/* The column, and the thing every width decision below reads. It
          carries the gutters rather than the two children doing it
          separately, so the container's own width is the width the roster
          actually has, and the bar above the register is measured against
          the same number the register is.

          There is no cap, because a register is a list an operator scans
          and a window wider than the list wants is width the rows
          themselves can use. The gutters grow with the window in one
          fluid step instead, so the page keeps its margins without ever
          spending a fixed number of pixels on them.

          At lg the column also takes the page's height, which is what
          turns the register's frame into the one thing that scrolls (see
          GameRoom for the same shell). Below lg everything stacks and the
          document scrolls. */}
      <div className="@container flex w-full flex-col px-[clamp(0.75rem,2.5vw,3rem)] lg:min-h-0 lg:flex-1">
        <header className="shrink-0 pb-2 pt-3">
          <div className="pm-glass pm-panel-bar">
            <div className="flex items-center gap-3">
              <div className="pm-seal pm-grad-admin">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-sm font-bold leading-tight tracking-tight">
                  {t("Operator Console")}
                </h1>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  {accounts === null
                    ? t(READING_THE_REGISTER)
                    : t(
                        "{accounts.length} accounts, {onlineCount} online, for {APP_NAME}",
                        {
                          "accounts.length": accounts.length,
                          onlineCount,
                          APP_NAME,
                        },
                      )}
                </p>
              </div>
              {/* The console's one neighbor: the balance dashboard reads
                the two measurement tables rather than the account rows, so
                it is a page of its own. It lives one level down from here
                and this is the way in. */}
              <a
                href="/admin/balance"
                className="pm-tool pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
                title={t("The balance dashboard")}
              >
                <Gauge className="h-3.5 w-3.5" />
                <span className="hidden @md:inline">{t("Balance")}</span>
              </a>
              <button
                onClick={refresh}
                className="pm-tool pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
                title={t("Refresh the roster")}
                aria-label={t("Refresh the roster")}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden @md:inline">{t("Refresh")}</span>
              </button>
              <button
                onClick={onSignOut}
                className="pm-tool pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
                title={t("Sign out")}
                aria-label={t("Sign out")}
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex flex-col gap-3 pb-10 lg:min-h-0 lg:flex-1 lg:pb-3">
          {error && <Notice message={error} onDismiss={dismissError} />}

          {/* The findability tools, at the top of the register's own
              column. The search is a plain substring over the two names an
              operator would know an account by; the four chips are the
              states worth looking for, each carrying its count so the
              shelf is visible before the search is. The ends of the row
              are pulled apart rather than packed together, so on a wide
              column the search sits over the names it filters and the
              chips sit over the counts they count. */}
          {accounts !== null && accounts.length > 0 && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
              {/* The search runs the width of a row on a phone and grows
                  with the window to a point, the way every other control
                  here is sized: past about a hand's reach, a wider input
                  is a longer line to scan, not a better one. */}
              <div className="relative w-full min-w-0 @md:max-w-[clamp(16rem,36vw,26rem)]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setQuery("");
                  }}
                  placeholder={t("Search name or handle")}
                  aria-label={t("Search accounts")}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-10 rounded-xl border-black/10 bg-black/[0.04] pl-9 pr-8 text-xs dark:border-white/10 dark:bg-white/[0.06]"
                />
                {query !== "" && (
                  <button
                    onClick={() => setQuery("")}
                    aria-label={t("Clear the search")}
                    title={t("Clear the search")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div
                role="group"
                aria-label={t("Filter the register")}
                className="flex flex-wrap items-center gap-1.5"
              >
                {FILTER_ORDER.map((key) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    aria-pressed={filter === key}
                    className={`pm-tool pm-pressable ${
                      filter === key
                        ? "bg-foreground text-background"
                        : "bg-black/[0.05] text-muted-foreground hover:text-foreground dark:bg-white/10"
                    }`}
                  >
                    {t(FILTERS[key].label)}
                    <span className="tabular-nums opacity-70">
                      {counts[key]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* The selection, directly over the register it acts on rather
              than over the tools that look things up in it: a ticked set
              is a decision about rows, so it belongs at the rows' own
              edge. It wears a quiet wash rather than glass, because it is
              a state of the register below it and not a third panel. The
              buttons keep their chips: four actions for a moment's work
              should be found at a glance, which is the one place on this
              screen a chip still earns its color. */}
          {selected.length > 0 && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-black/[0.06] bg-black/[0.03] px-2 py-1.5 dark:border-white/[0.08] dark:bg-white/[0.05]">
              <span className="px-1 text-xs font-medium">
                {t("{selected.length} {accountWord} selected", {
                  "selected.length": selected.length,
                  accountWord: plural(selected.length),
                })}
              </span>
              {/* The selection survives the action, so the same set of
                accounts can be banned, corrected and banned again without
                being ticked twice. Whatever the action could not do is
                reported, and whatever it did is already in the table. */}
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <ConsoleButton
                  icon={<Ban className="h-3.5 w-3.5" />}
                  label={t("Ban")}
                  disabled={busy}
                  onClick={() => bulk("ban", selected)}
                />
                <ConsoleButton
                  icon={<RotateCcw className="h-3.5 w-3.5" />}
                  label={t("Unban")}
                  disabled={busy}
                  onClick={() => bulk("unban", selected)}
                />
                <ConsoleButton
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  label={t("Grant admin")}
                  disabled={busy}
                  onClick={() => bulk("grant", selected)}
                />
                <ConsoleButton
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  label={t("Delete")}
                  tone="danger"
                  disabled={busy}
                  onClick={openBulkPurge}
                />
                <ConsoleButton
                  icon={<X className="h-3.5 w-3.5" />}
                  label={t("Clear")}
                  onClick={() => setTicked(new Set())}
                />
              </div>
            </div>
          )}

          <div className="pm-glass flex flex-col overflow-hidden rounded-2xl lg:min-h-0 lg:flex-1">
            {accounts === null ? (
              <div className="flex flex-1 items-center justify-center px-4 py-12 text-center">
                <p className="text-xs text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                  {t(READING_THE_REGISTER)}
                </p>
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-4 py-12 text-center">
                <p className="text-xs text-muted-foreground">
                  {t("There are no accounts to show.")}
                </p>
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                <p className="text-xs text-muted-foreground">
                  {t("No accounts match this view.")}
                </p>
                <button
                  onClick={clearView}
                  className="pm-tool pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>{t("Clear search and filters")}</span>
                </button>
              </div>
            ) : (
              <>
                {/* The register as a table, where the column has room for
                  one. The table carries no minimum width of its own: it is
                  only drawn where it fits, which is what the width above
                  decides, so a floor here would be a second copy of that
                  decision waiting to disagree with it.

                  The frame around it is the one thing that scrolls at lg,
                  and the header cells ride its top so a column is never
                  read from memory. The overflow is on this inner frame
                  rather than the shell because a sticky cell binds to the
                  nearest scrollport, and a cell bound to the shell would
                  sit still while the rows slid out from under it. */}
                <div className="hidden flex-col @min-[52rem]:flex lg:min-h-0 lg:flex-1">
                  <div className="pm-scroll overflow-x-auto lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        {/* Every column but the name hugs what it holds.
                            The tick box, the status, the two counts and
                            the actions each get a preferred width of a
                            single pixel, which the browser reads as "no
                            more than my content needs", and the name
                            column takes everything that is left. That is
                            what keeps the register in step with its own
                            container: the wider the column gets, the more
                            of it lands on the names, and no cell anywhere
                            carries a width a designer guessed. */}
                        <tr className="text-left">
                          <th className={`w-px py-2.5 pl-4 pr-3 ${STICKY}`}>
                            <input
                              ref={headerBox}
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={toggleAll}
                              disabled={visible.length === 0}
                              aria-label={t("Select every account shown")}
                              title={t("Select every account shown")}
                              className={CHECKBOX}
                            />
                          </th>
                          <Th className={STICKY}>{t("Captain")}</Th>
                          <Th className={`${STICKY} w-px whitespace-nowrap`}>
                            {t("Status")}
                          </Th>
                          <Th className={`${STICKY} w-px text-right`}>
                            {t("Harbors")}
                          </Th>
                          <Th className={`${STICKY} w-px text-right`}>
                            {t("Seats")}
                          </Th>
                          <Th className={`${STICKY} w-px text-right`}>
                            {t("Actions")}
                          </Th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((a) => (
                          <RosterRow
                            key={a.id}
                            account={a}
                            {...accountRowProps(a)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* The same register as a card per account, everywhere the
                  table has no room. The two are drawn from the register
                  rather than from each other, and the pieces they share
                  are shared: an account's role, its status and its four
                  actions are one component each, so the two layouts cannot
                  drift in how they draw one. */}
                <ul className="pm-scroll @min-[52rem]:hidden lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                  {visible.map((a) => (
                    <AccountCard
                      key={a.id}
                      account={a}
                      {...accountRowProps(a)}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>

          <p className="shrink-0 px-1 text-[11px] leading-relaxed text-muted-foreground">
            {t(
              "Banning ends every session the account holds and clears its seats on the spot. Deleting removes the account and every harbor it hosts, and cannot be undone.",
            )}
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
              {t("Delete {purgeTarget}?", {
                purgeTarget: purgeTarget?.displayName ?? "",
              })}
            </DialogTitle>
            <DialogDescription>
              {t(
                "The account is removed, along with every harbor it hosts, every seat it holds, and every voyage, chronicle and merit it has earned. Any captain sitting in one of those harbors is sent back to the Lobby. This cannot be undone.",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-1.5">
            <Label htmlFor="purge-confirm" className="text-sm font-medium">
              {t("Type {purgeTargetHandle} to confirm", {
                purgeTargetHandle: purgeTarget?.username ?? "",
              })}
            </Label>
            <Input
              id="purge-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={purgeTarget?.username ?? ""}
              autoComplete="off"
              className="h-11 font-mono"
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={closePurge}>
              {t("Cancel")}
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
              {t("Delete Account")}
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
              {t("Delete {bulkCount} {accountWord}?", {
                bulkCount,
                accountWord: plural(bulkCount),
              })}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Every account ticked is removed, along with every harbor it hosts, every seat it holds, and every voyage, chronicle and merit it has earned. Any captain sitting in one of those harbors is sent back to the Lobby. This cannot be undone.",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-1.5">
            {/* A name per account would be a paragraph to retype, so the
                confirmation for a selection is the count. It is a number
                the operator can only produce by looking at what they
                ticked, and the server holds the two against each other. */}
            <Label htmlFor="bulk-purge-confirm" className="text-sm font-medium">
              {t("Type {bulkCount} to confirm", { bulkCount })}
            </Label>
            <Input
              id="bulk-purge-confirm"
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
              {t("Cancel")}
            </Button>
            <Button
              className="bg-alarm text-background"
              disabled={bulkConfirm.trim() !== String(bulkCount)}
              onClick={() => {
                bulk("purge", bulkTargets, Number(bulkConfirm));
                closeBulkPurge();
              }}
            >
              {t("Delete Accounts")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
