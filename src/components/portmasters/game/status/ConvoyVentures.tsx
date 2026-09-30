"use client";

import { useState } from "react";
import {
  CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE,
  CONVOY_VENTURE_MAX_ROUNDS_AHEAD,
  CONVOY_VENTURE_MAX_TARGET,
  CONVOY_VENTURE_MIN_ROUNDS_AHEAD,
  CONVOY_VENTURE_MIN_TARGET,
} from "@/lib/game/constants/world";
import {
  computeVentureDeadlineBounds,
  ventureAlreadySpentReason,
} from "@/lib/game/convoy";
import type { GameState } from "@/lib/game/types";
import type { ConvoyVenture } from "@/lib/use-convoy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// [MANIFEST 04: Convoy Ventures] Lives in the Dues tab, right beside
// Outstanding Loans, since both are peer to peer Gold commitments a captain
// is tracking against the rest of the harbor.
export function ConvoyVentures({
  game,
  convoy,
  myUserId,
}: {
  game: GameState;
  convoy: {
    ventures: ConvoyVenture[];
    locked: boolean;
    error: string | null;
    post: (targetGold: number, deadlineRound: number) => void;
    contribute: (ventureId: string, amount: number) => void;
  };
  myUserId: string;
}) {
  const [target, setTarget] = useState("");
  const [roundsAhead, setRoundsAhead] = useState(
    String(CONVOY_VENTURE_MIN_ROUNDS_AHEAD),
  );
  const [contributions, setContributions] = useState<Record<string, string>>(
    {},
  );

  // Both of these come from the same function the server checks the post
  // against, rather than from a second window worked out here. A captain
  // who can see the form and press Post is a captain the server has
  // already agreed has room left in the voyage, which is the only way the
  // two ends can be guaranteed to agree about it.
  const window = computeVentureDeadlineBounds(
    game.currentRound,
    game.maxRounds,
    CONVOY_VENTURE_MIN_ROUNDS_AHEAD,
    CONVOY_VENTURE_MAX_ROUNDS_AHEAD,
  );
  const tooLateToPost = window === null;
  const maxRoundsAhead = window ? window.maxRound - game.currentRound : 0;

  // The deadline field is a text input, so it can read as something that
  // is not a number the moment it is looked at. Derived once, and read by
  // the post, the preview line under the field and the test above that
  // line, so the three can never disagree about what the field holds.
  const roundsAheadCount = Math.floor(Number(roundsAhead));

  function submitPost() {
    const t = Math.floor(Number(target));
    if (!Number.isFinite(t) || !Number.isFinite(roundsAheadCount)) return;
    convoy.post(t, game.currentRound + roundsAheadCount);
    setTarget("");
    setRoundsAhead(String(CONVOY_VENTURE_MIN_ROUNDS_AHEAD));
  }

  function submitContribute(ventureId: string) {
    const raw = contributions[ventureId];
    const amount = Math.floor(Number(raw));
    if (!Number.isFinite(amount) || amount <= 0) return;
    convoy.contribute(ventureId, amount);
    setContributions((c) => ({ ...c, [ventureId]: "" }));
  }

  return (
    <div className="mt-3 border-t border-black/5 pt-2 dark:border-white/10">
      <div className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground">
        ━━ Ventures ━━
      </div>

      {convoy.error && (
        <div className="mb-1.5 rounded bg-alarm/5 px-2 py-1 text-[10px] text-alarm">
          {convoy.error}
        </div>
      )}

      {convoy.locked ? (
        <p className="mb-2 rounded bg-black/[0.03] px-2 py-1.5 text-[10px] text-muted-foreground dark:bg-white/[0.04]">
          {ventureAlreadySpentReason()}
        </p>
      ) : tooLateToPost ? (
        <p className="mb-2 rounded bg-black/[0.03] px-2 py-1.5 text-[10px] text-muted-foreground dark:bg-white/[0.04]">
          Too late in this voyage to post a new Venture: there is no round left
          that would leave time to spend the reward.
        </p>
      ) : (
        <>
          <div className="mb-2 flex items-end gap-1.5">
            <div className="flex-1">
              <label className="mb-0.5 block text-[9px] text-muted-foreground">
                Target Gold
              </label>
              <Input
                type="number"
                min={CONVOY_VENTURE_MIN_TARGET}
                max={CONVOY_VENTURE_MAX_TARGET}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={`${CONVOY_VENTURE_MIN_TARGET}+`}
                className="h-7 text-[11px]"
              />
            </div>
            <div className="flex-1">
              <label className="mb-0.5 block text-[9px] text-muted-foreground">
                Rounds to fill
              </label>
              <Input
                type="number"
                min={CONVOY_VENTURE_MIN_ROUNDS_AHEAD}
                max={maxRoundsAhead}
                value={roundsAhead}
                onChange={(e) => setRoundsAhead(e.target.value)}
                className="h-7 text-[11px]"
              />
            </div>
            <Button
              size="sm"
              className="h-7 rounded px-2 text-[10px]"
              onClick={submitPost}
            >
              Post
            </Button>
          </div>

          {Number.isFinite(roundsAheadCount) && (
            <p className="mb-2 text-[9px] text-muted-foreground">
              Fills by Round {game.currentRound + roundsAheadCount}. Miss it and
              every contributor only gets back a partial refund. This harbor
              only gets one venture per voyage, so make it count.
            </p>
          )}
        </>
      )}

      {convoy.ventures.length === 0 ? (
        <p className="py-1 text-[11px] text-muted-foreground">
          {convoy.locked
            ? "No ventures open. This voyage's one chance has already been used."
            : "No ventures open right now. Post one, or wait for another captain to."}
        </p>
      ) : (
        <div className="space-y-2">
          {convoy.ventures.map((v) => {
            const pct = Math.min(
              100,
              Math.round((v.total / v.targetGold) * 100),
            );
            const mine = v.contributions.find((c) => c.userId === myUserId);
            const myShareCap = Math.ceil(
              v.targetGold * CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE,
            );
            const myRemainingShare = myShareCap - (mine?.amount ?? 0);
            const atMyShareCap = myRemainingShare <= 0;
            return (
              <div
                key={v.id}
                className="rounded-lg border border-black/5 bg-black/[0.02] p-2 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    {v.posterId === myUserId ? "Your venture" : v.posterName}
                  </span>
                  <span className="font-semibold">
                    {v.total} / {v.targetGold}g
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-sea"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
                  <span>By Round {v.deadlineRound}</span>
                  {mine && <span>You have backed {mine.amount}g</span>}
                </div>
                {atMyShareCap ? (
                  <p className="mt-1.5 text-[9px] text-muted-foreground">
                    You have backed this as much as any single captain can. It
                    needs another captain to fund the rest.
                  </p>
                ) : (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={myRemainingShare}
                      value={contributions[v.id] ?? ""}
                      onChange={(e) =>
                        setContributions((c) => ({
                          ...c,
                          [v.id]: e.target.value,
                        }))
                      }
                      placeholder="Gold"
                      className="h-6 text-[10px]"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 shrink-0 rounded px-2 text-[10px]"
                      onClick={() => submitContribute(v.id)}
                    >
                      Back it
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
