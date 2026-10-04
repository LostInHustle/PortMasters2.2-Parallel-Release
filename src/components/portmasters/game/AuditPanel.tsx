"use client";

// The Manifest Audit's two surfaces, in one file because they are the two
// halves of one interaction and they share the vocabulary between them:
// the card below is where a harbor decides to look, and the strip is what
// it found.
//
// The card lives inside the Parley phase, because that is the only place
// the vote can be called: the audit's price is the rest of that leg's
// trading, so the button that spends it belongs on the board it spends.
// The strip is full width under the commission, because the finding is
// the whole harbor's and outlives the leg it was made in.
//
// It wears `intel`, which is a meaning colour rather than a panel's own
// hue (see scripts/palette.ts). That is deliberate and it is the same
// choice the commission made with gold: a surface that reports what
// somebody knows is not chrome, and giving it a widget hue would put a
// thirteenth colour on a wheel that already has twelve.

import { AuditReveal } from "@/types/realtime/audit";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { PublicUser } from "@/lib/api";
import { fulfillmentLine } from "@/lib/game/audit";
import { auditOpensAt } from "@/lib/game/mode";
import type { GameState } from "@/lib/game/types";
import type { useAudit } from "@/lib/use-audit";
import { cn } from "@/lib/utils";
import { tallyRows } from "@/lib/voteTally";
import { VoteTallyRows } from "@/components/portmasters/game/VoteTallyRows";
import { VoteCardShell } from "./VoteCardShell";
import { Utensils } from "lucide-react";

type Audit = ReturnType<typeof useAudit>;

/**
 * The two questions the Parley board asks about this vote, answered once
 * beside the vote itself so the card and the Harbor Business fold that
 * holds it cannot disagree about when the harbor is voting (W4, UX-3 in
 * docs/STUDIO_AUDIT.md; see Parley.tsx).
 */
export function auditVoteOpen(game: GameState, audit: Audit): boolean {
  const opensAt = auditOpensAt(game.mode);
  return (
    opensAt !== null && audit.reveal === null && game.currentRound >= opensAt
  );
}

export function auditCardShown(game: GameState, audit: Audit): boolean {
  const opensAt = auditOpensAt(game.mode);
  if (opensAt === null || game.phase !== "parley") return false;
  // (a) of UX-3: the open window, or a window this voyage can still
  // reach. A spent audit is neither, and it leaves the board because the
  // reveal strip carries the finding from there.
  return (
    auditVoteOpen(game, audit) ||
    (audit.reveal === null && opensAt <= game.maxRounds)
  );
}

export function AuditVoteCard({
  game,
  members,
  me,
  audit,
}: {
  game: GameState;
  members: PublicUser[];
  me: PublicUser;
  audit: Audit;
}) {
  const [target, setTarget] = useState("");

  // The visibility rule is the reader's ((a) of UX-3 in
  // docs/STUDIO_AUDIT.md): the open window, or a window still ahead this
  // voyage. The rung is read off the mode's own record rather than
  // compared against a constant, so this panel and the server's vote ask
  // one question: a mode whose rung is null has no manifest to open, and
  // that is what draws nothing here (see auditOpensAt in @/lib/game/mode).
  // The body still explains the vote before the rung, because a mode
  // whose headline mechanic nobody has heard of is a mechanic nobody
  // uses, and inside the Harbor Business fold that explanation costs the
  // board nothing (see Parley.tsx).
  const opensAt = auditOpensAt(game.mode);
  if (opensAt === null) return null;
  if (!auditCardShown(game, audit)) return null;
  const open = auditVoteOpen(game, audit);
  const rows = tallyRows(audit.votes, members);
  const nameOf = (id: string) =>
    members.find((m) => m.id === id)?.displayName ?? "a captain";

  return (
    <VoteCardShell tone="intel" icon="🔎" title="Manifest Audit">
      {open ? (
        <>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            A majority of the captains still sailing can open one manifest. What
            comes back is a sample of what they filed, and the harbor trades no
            more this leg.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="Captain to audit"
            >
              <option value="">Choose a captain</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === me.id ? `${m.displayName} (you)` : m.displayName}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              disabled={!target || !audit.canVote}
              onClick={() => audit.vote(target)}
            >
              Call the audit
            </Button>
          </div>
          {audit.myVote && (
            <p className="text-[11px] text-muted-foreground mt-2">
              You named {nameOf(audit.myVote)}. Waiting on the rest of the
              harbor.
            </p>
          )}
          <VoteTallyRows rows={rows} />
          <p className="text-[10px] text-muted-foreground/80 mt-2">
            A majority is more than half of the captains still in the voyage.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {`From leg ${opensAt}, a simple majority of the harbor may open one captain's manifest: a random pair of their most recent order fulfillments, and nothing else. Calling it spends the rest of that leg's Parley.`}
        </p>
      )}
    </VoteCardShell>
  );
}

export function AuditRevealStrip({ reveal }: { reveal: AuditReveal | null }) {
  // Held by the reveal it applies to rather than as a flag, so a dismissed
  // finding cannot silence the next voyage's.
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (!reveal) return null;
  const key = `${reveal.round}:${reveal.target.userId}`;
  if (dismissed === key) return null;

  return (
    <div className="rounded-2xl px-3 py-2 border border-intel/40 bg-intel/[0.06] ring-1 ring-intel/20">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm leading-none" aria-hidden>
          🔎
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-intel">
          Manifest Audit · Leg {reveal.round}
        </span>
        <span className="font-display text-sm font-semibold">
          {reveal.target.name}&apos;s manifest
        </span>
        <button
          type="button"
          className="ml-auto text-muted-foreground hover:text-foreground"
          onClick={() => setDismissed(key)}
          aria-label="Hide the audit"
        >
          ✕
        </button>
      </div>

      {/* A flagged reveal prints no lines at all, because there are none to
          print: the server withholds a marked manifest rather than handing
          the table evidence it has already judged unsound (see AuditReveal
          .flagged). The flag is then the strip's whole finding, and it is
          read off the reveal rather than counted from an empty list so it
          cannot be confused with a captain who filed nothing. */}
      {reveal.flagged ? null : reveal.fulfillments.length === 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          No order fulfillments filed this voyage.
        </p>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {reveal.fulfillments.map((fill) => (
            <span
              key={`${fill.round}:${fill.port}:${fill.items
                .map((i) => i.type)
                .join("+")}`}
              className="text-[11px] font-medium rounded-lg px-1.5 py-0.5 border border-intel/25 tabular-nums"
            >
              {fulfillmentLine(fill)}
            </span>
          ))}
        </div>
      )}

      {/* [C1: the Larder and Short Rations] The second half of the plan's
          audit clause: the sample of fulfillments, plus the captain's
          current Larder. Drawn only when the layer reports one, so a
          voyage with the provisions switch off shows the reveal this strip
          has always shown rather than a number nothing moves. The red is
          the meaning red rather than the strip's own hue, because an empty
          larder is the finding the room is looking for and it should be
          readable before the count is. */}
      {reveal.larder !== undefined && (
        <div className="mt-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
              reveal.shortRations
                ? "border-alarm/30 bg-alarm/5 text-alarm"
                : "border-intel/25 text-foreground",
            )}
          >
            <Utensils className="h-3 w-3" />
            Larder {reveal.larder}
          </span>
          <span className="ml-1.5 text-[10px] text-muted-foreground/80">
            {reveal.shortRations
              ? "an empty larder: this captain's crew is on short rations."
              : reveal.larder === 0
                ? "an empty larder, with no crew aboard to go hungry."
                : "rations aboard, eaten one a head each leg."}
          </span>
        </div>
      )}

      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/80">
        {reveal.flagged
          ? "The harbor's own checks could not reconcile this manifest, so its lines are withheld."
          : "A random sample of this captain's most recent order fulfillments, opened by a vote of the harbor. Their card, their Gold and the rest of their hold were not opened."}
      </p>
    </div>
  );
}
