// PortMasters 2.2 Parallel Release, smoke run: Acting on a selection.

import { db } from "@/lib/db";
import { accountIn, call, check, signUp, waitForEvent } from "../harness";
import type { WireBulkReport, WireRoster } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function actingOnASelectionSuite(
  run: SmokeRun,
  inputs: {
    host: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    operator: { id: string; token: string; cookie: string; username: string };
    operatorSocket: Socket;
  },
): Promise<void> {
  const { host, operator, operatorSocket } = inputs;
  const crowdA = await signUp("crowd_a");
  const crowdB = await signUp("crowd_b");
  const outcast = await signUp("outcast");
  run.extraAccounts.push(crowdA, crowdB, outcast);

  // One account is put out of standing on its own first, so that the
  // selection below has a refusal to report and not only successes.
  const bannedOutcast = waitForEvent<WireRoster>(
    operatorSocket,
    "admin:accounts",
  );
  operatorSocket.emit("admin:ban", { userId: outcast.id });
  check(
    accountIn(await bannedOutcast, outcast.id)?.bannedAt != null,
    "one account is banned on its own, to be skipped in the batch",
  );

  const bulkBan = waitForEvent<{ report: WireBulkReport }>(
    operatorSocket,
    "admin:bulk-result",
  );
  const rosterAfterBulkBan = waitForEvent<WireRoster>(
    operatorSocket,
    "admin:accounts",
  );
  operatorSocket.emit("admin:bulk", {
    action: "ban",
    userIds: [crowdA.id, crowdB.id, outcast.id, operator.id],
  });
  const banReport = (await bulkBan)?.report;
  check(
    banReport?.applied === 2,
    "a selection of four bans the two captains it can",
  );
  check(
    banReport?.requested === 4 && banReport?.skipped.length === 2,
    "and reports the whole request, with the two accounts it could not change",
  );
  check(
    (banReport?.skipped ?? []).some((reason) =>
      reason.includes("already banned"),
    ),
    "including the one that was already banned",
  );
  check(
    (banReport?.skipped ?? []).some((reason) =>
      reason.includes("your own account"),
    ),
    "and the operator's own account, which no selection may take",
  );
  const bannedInBulk = await rosterAfterBulkBan;
  check(
    accountIn(bannedInBulk, crowdA.id)?.bannedAt != null &&
      accountIn(bannedInBulk, crowdB.id)?.bannedAt != null,
    "the roster comes back with both of them banned",
  );
  // The bulk path runs the same single account function the row buttons
  // run, so the parts of a ban that are not the flag have to be there
  // too: the sessions are meant to be gone with it.
  const crowdASession = await call<{ user: unknown }>("/api/auth/me", {
    cookie: crowdA.cookie,
  });
  check(
    crowdASession.body?.user === null,
    "the ban took their sessions with it, exactly as a single ban does",
  );

  const refusedEmpty = waitForEvent<{ error: string }>(
    operatorSocket,
    "admin:error",
  );
  const rosterForNothing = waitForEvent<WireRoster>(
    operatorSocket,
    "admin:accounts",
    undefined,
    1200,
  );
  operatorSocket.emit("admin:bulk", { action: "ban", userIds: [] });
  check(
    (await refusedEmpty) !== null,
    "a selection with nothing in it is refused",
  );
  check(
    (await rosterForNothing) === null,
    "and there is no change for a roster to describe",
  );

  const refusedNothing = waitForEvent<{ error: string }>(
    operatorSocket,
    "admin:error",
  );
  const rosterForNoChange = waitForEvent<WireRoster>(
    operatorSocket,
    "admin:accounts",
    undefined,
    1200,
  );
  operatorSocket.emit("admin:bulk", {
    action: "unban",
    userIds: [host.id],
  });
  const noChange = await refusedNothing;
  check(
    noChange !== null,
    "an action that would change none of the accounts it named is refused rather than reported as done",
  );
  check(
    noChange?.error.includes("not banned") === true,
    "carrying the reason the single account path would have given",
  );
  check(
    (await rosterForNoChange) === null,
    "and no roster is sent, because none of it moved",
  );

  const bulkUnban = waitForEvent<{ report: WireBulkReport }>(
    operatorSocket,
    "admin:bulk-result",
  );
  const rosterAfterBulkUnban = waitForEvent<WireRoster>(
    operatorSocket,
    "admin:accounts",
  );
  operatorSocket.emit("admin:bulk", {
    action: "unban",
    userIds: [crowdA.id, crowdB.id],
  });
  const unbanReport = (await bulkUnban)?.report;
  check(
    unbanReport?.applied === 2 && unbanReport?.skipped.length === 0,
    "a selection every account applies to reports a clean run",
  );
  check(
    accountIn(await rosterAfterBulkUnban, crowdA.id)?.bannedAt === null,
    "and the roster shows them in good standing",
  );

  const bulkGrant = waitForEvent<{ report: WireBulkReport }>(
    operatorSocket,
    "admin:bulk-result",
  );
  const rosterAfterBulkGrant = waitForEvent<WireRoster>(
    operatorSocket,
    "admin:accounts",
  );
  operatorSocket.emit("admin:bulk", {
    action: "grant",
    userIds: [crowdA.id, crowdB.id],
  });
  check(
    (await bulkGrant)?.report.applied === 2,
    "a selection can be handed the administrator role together",
  );
  const promotedInBulk = await rosterAfterBulkGrant;
  check(
    accountIn(promotedInBulk, crowdA.id)?.role === "admin" &&
      accountIn(promotedInBulk, crowdB.id)?.role === "admin",
    "and both of them wear it in the roster",
  );

  const refusedBatchCount = waitForEvent<{ error: string }>(
    operatorSocket,
    "admin:error",
  );
  operatorSocket.emit("admin:bulk", {
    action: "purge",
    userIds: [crowdA.id],
    confirmCount: 2,
  });
  check(
    (await refusedBatchCount) !== null,
    "a deletion whose typed count does not match the selection is refused",
  );
  check(
    (await db.user.findUnique({
      where: { id: crowdA.id },
      select: { id: true },
    })) !== null,
    "and the account it named is still there",
  );

  // The operator is deliberately inside the selection. A typed count of
  // three has to delete the two accounts and leave the third, which is
  // the one thing a selection must never be able to do.
  const bulkPurge = waitForEvent<{ report: WireBulkReport }>(
    operatorSocket,
    "admin:bulk-result",
  );
  const rosterAfterBulkPurge = waitForEvent<WireRoster>(
    operatorSocket,
    "admin:accounts",
  );
  operatorSocket.emit("admin:bulk", {
    action: "purge",
    userIds: [crowdA.id, crowdB.id, operator.id],
    confirmCount: 3,
  });
  const purgeReport = (await bulkPurge)?.report;
  check(
    purgeReport?.applied === 2,
    "a typed count of three deletes the two accounts and stops there",
  );
  check(
    (purgeReport?.skipped ?? []).some((reason) =>
      reason.includes("your own account"),
    ),
    "because a selection still cannot delete the operator's own account",
  );
  const afterBatch = await rosterAfterBulkPurge;
  check(
    accountIn(afterBatch, crowdA.id) === undefined &&
      accountIn(afterBatch, crowdB.id) === undefined,
    "both accounts are gone from the roster",
  );
  check(
    (await db.user.findUnique({
      where: { id: operator.id },
      select: { id: true },
    })) !== null,
    "and the operator is still holding the console",
  );
}
