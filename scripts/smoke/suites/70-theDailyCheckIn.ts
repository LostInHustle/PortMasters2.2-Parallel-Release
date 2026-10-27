// PortMasters 2.2 Parallel Release, smoke run: The Daily Check In.
//
// The one reward a captain can claim without a harbor: a position on a
// seven day cycle, advanced once per UTC day and paid in Renown XP. The
// route is the only door to it, so this article walks that door rather
// than the pure functions underneath: a stranger is refused, the first
// claim lands and writes the CaptainLegacy row the boards read, and a
// second claim on the same date returns the current state without
// paying twice. The expected day and reward are read from the same
// checkin module the route uses, so a retuned reward table does not
// turn this article into a second copy of it.
//
// It signs up one captain of its own, because a check in is account
// level and writing one onto a shared article's captain would leak
// between articles. No harbor is opened.

import { db } from "@/lib/db";
import { applyCheckIn, utcDayKey } from "@/lib/game/checkin";
import { call, check, signUp } from "../harness";
import type { SmokeRun } from "../run";

type CheckInBody = {
  claimed: boolean;
  day?: number;
  xpGained?: number;
  leveledUp?: boolean;
  legacy?: { renownXP: number; renownLevel: number };
  checkIn: {
    currentDay: number;
    claimedThisCycle: number;
    canClaimToday: boolean;
    lastCheckInDate: string | null;
  };
};

export async function theDailyCheckInSuite(run: SmokeRun): Promise<void> {
  const captain = await signUp("checkin");
  run.extraAccounts.push(captain);

  const today = utcDayKey();
  const firstExpected = applyCheckIn(
    { checkInCount: 0, lastCheckInDate: null },
    today,
  );
  if (!firstExpected) throw new Error("a fresh check in cannot be a no-op");

  const stranger = await call<{ error?: string }>("/api/check-in", {
    method: "POST",
  });
  check(
    stranger.status === 401,
    "the check in route refuses a stranger, because the reward is paid to an account rather than to whoever asks",
  );

  const first = await call<CheckInBody>("/api/check-in", {
    method: "POST",
    cookie: captain.cookie,
  });
  check(
    first.status === 200 &&
      first.body.claimed &&
      first.body.day === firstExpected.day &&
      first.body.xpGained === firstExpected.xp &&
      first.body.legacy?.renownXP === firstExpected.xp &&
      first.body.checkIn.canClaimToday === false &&
      first.body.checkIn.currentDay === firstExpected.day + 1,
    "a captain's first claim lands on the day the cycle put them, pays the reward that day states, and reports the next day as the one to come rather than the one just taken",
  );

  const row = await db.captainLegacy.findUnique({
    where: { userId: captain.id },
  });
  check(
    row !== null &&
      row.renownXP === firstExpected.xp &&
      row.checkInCount === firstExpected.next.checkInCount &&
      row.lastCheckInDate === today,
    "the claim writes the account's own legacy row with the reward, the cycle position and the UTC date, so the lobby widget and the boards read one persisted answer rather than a screen's memory",
  );

  const second = await call<CheckInBody>("/api/check-in", {
    method: "POST",
    cookie: captain.cookie,
  });
  const rowAfter = await db.captainLegacy.findUnique({
    where: { userId: captain.id },
  });
  check(
    second.status === 200 &&
      second.body.claimed === false &&
      second.body.legacy?.renownXP === firstExpected.xp &&
      rowAfter?.renownXP === firstExpected.xp &&
      second.body.checkIn.canClaimToday === false &&
      second.body.checkIn.claimedThisCycle === firstExpected.next.checkInCount,
    "a second claim on the same UTC date is answered with the current state and pays nothing, so the one claim per day rule is enforced by the row rather than by the button",
  );
}
