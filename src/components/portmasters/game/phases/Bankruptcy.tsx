"use client";

import { motion } from "framer-motion";
import { Eye, Trophy, Coins, Anchor } from "lucide-react";
import type { PhasePanelProps } from "./PhaseShared";
import { Avatar, Pill } from "../../shared";
import { cn } from "@/lib/utils";

/**
 * [MANIFEST 07: Bequest Routing] Extends the already shipped Silent
 * Partner panel below: at the moment bankruptcy is reached, a captain
 * with open loans still owed to them can designate one still active
 * captain in the room to receive future repayments instead of an inert
 * number nobody can spend.
 *
 * [Spectator Mode Enhancement] A bankrupt captain can watch the rest of
 * the harbor finish the voyage. The live standings board shows every
 * still active captain's current phase, Gold, and Reputation, updating
 * in real time as they play.
 */
export function Bankruptcy({
  game,
  members,
  backing,
  me,
  room,
  roster,
}: Pick<
  PhasePanelProps,
  "game" | "members" | "backing" | "me" | "room" | "roster"
>) {
  const myUserId = me.id;
  const statuses = roster?.statuses ?? {};
  const activeCaptains = members
    .filter((m) => m.id !== myUserId)
    .map((m) => ({
      member: m,
      status: statuses[m.id],
    }))
    .filter(
      (s) =>
        s.status &&
        s.status.phase !== "bankruptcy" &&
        s.status.phase !== "endgame",
    )
    .sort((a, b) => (b.status?.reputation ?? 0) - (a.status?.reputation ?? 0));

  return (
    <div className="mx-auto max-w-2xl py-4 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mb-2 text-7xl"
      >
        💥
      </motion.div>
      <div className="font-display pm-brush mb-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
        Ship Fleet Bankrupt!
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {game.money <= 0
          ? "Funds depleted, unable to pay essential operational costs"
          : "Insufficient funds to cover maintenance and wages"}
      </p>

      {/* Final stats */}
      <div className="mx-auto my-4 grid max-w-sm grid-cols-2 gap-2 text-left text-sm">
        <div className="text-muted-foreground">Rounds Completed:</div>
        <div>
          <b>
            {game.currentRound - 1}/{game.maxRounds}
          </b>
        </div>
        <div className="text-muted-foreground">Final Funds:</div>
        <div>
          <b>{game.money} Gold</b>
        </div>
        <div className="text-muted-foreground">Final Reputation:</div>
        <div>
          <b>{game.score}</b>
        </div>
        <div className="text-muted-foreground">Ship Level:</div>
        <div>
          <b>{game.shipLevel}</b>
        </div>
        <div className="text-muted-foreground">Taxes Paid:</div>
        <div>
          <b>{game.vatPaid + game.incomeTaxPaid} Gold</b>
        </div>
      </div>

      {/* Bequest Routing: Silent Partner */}
      {game.loansGiven.length > 0 && (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3 text-left">
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground/90">
            🤝 Silent Partner
          </div>
          <p className="mb-2.5 text-xs text-muted-foreground">
            Gold you lent before the wreck is still out there, and it lands the
            moment each captain repays it.
          </p>
          <div className="space-y-2">
            {game.loansGiven.map((l) => {
              const live = backing?.loans.find((o) => o.debtId === l.id);
              const candidates = (members ?? []).filter(
                (m) => m.id !== l.counterpartyId && m.id !== myUserId,
              );
              return (
                <div key={l.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Owed by{" "}
                      <b className="text-foreground/90">{l.counterpartyName}</b>
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {l.amount}g
                    </span>
                  </div>
                  {backing && candidates.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>Send repayment to</span>
                      <select
                        value={live?.redirectToUserId ?? ""}
                        onChange={(e) => backing.redirect(l.id, e.target.value)}
                        className="rounded-md border border-black/10 bg-background/60 px-1.5 py-0.5 text-[11px] dark:border-white/15"
                      >
                        <option value="">myself (default)</option>
                        {candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Spectator Mode: Live Standings */}
      {activeCaptains.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 rounded-xl border border-teal-500/20 bg-teal-500/[0.04] px-4 py-3 text-left"
        >
          <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground/90">
            <Eye className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            Spectator Mode: Live Harbor Standings
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Your voyage has ended, but the rest of the harbor is still sailing.
            Watch their progress live below.
          </p>
          <div className="space-y-1.5">
            {activeCaptains.map(({ member, status }, idx) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-lg bg-background/40 px-3 py-2"
              >
                <span className="text-xs font-bold text-muted-foreground w-4">
                  {idx + 1}
                </span>
                <Avatar
                  hue={member.avatarHue}
                  name={member.displayName}
                  size={28}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {member.displayName}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    R{status?.round ?? "?"} · {status?.phaseLabel ?? "Sailing"}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Pill tone="amber" className="font-mono">
                    <Coins className="h-3 w-3" />
                    {status?.gold ?? 0}
                  </Pill>
                  <Pill tone="sea" className="font-mono">
                    <Trophy className="h-3 w-3" />
                    {status?.reputation ?? 0}
                  </Pill>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {activeCaptains.length === 0 && (
        <div className="mt-4 rounded-xl border border-teal-500/15 bg-teal-500/[0.04] px-4 py-3 text-sm text-muted-foreground">
          Your voyage has ended, and the rest of the harbor has finished too.
          Wait for the host to restart the voyage.
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Anchor className="h-3 w-3" />
        Click any captain in the Harbor Roster to peek at their cargo and
        workers
      </div>
    </div>
  );
}
