/**
 * The closed test guard.
 *
 * [J1: the private information review] The review's other half is the
 * closed test: thirty players, none of them the people who built the
 * mode, on a database that has never held a real account. The plan's
 * discipline is that it runs on a separate database from anything with
 * real accounts, and the only part of that a script can check is the
 * name. So this checks the name, out loud, before anybody is invited.
 *
 * One rule. The database this process resolves has to be a local file
 * whose name begins with closed-test. Everything else is refused: the
 * project's own databases, a Postgres URL, and a local file with any
 * other name. The refusal prints the file's own name and nothing else of
 * any URL, ever, because a connection string can carry a password inside
 * it and this script's output is meant to be pasted into a session log.
 *
 * What it does not do, and why, because a gate that reads as stronger
 * than it is is worse than none:
 *
 *   It does not contact a running server. It cannot, usefully: the one
 *   route a script can call without credentials is /api/health, which
 *   answers { status: "ok" } and touches nothing else by design, so it
 *   has no way to say which database the server answering for it is
 *   writing to. Asking would be theatre. The real proof that a server
 *   and the script driving it share one database happens at run time,
 *   and it already exists: the smoke suite refuses to clean up after
 *   itself until it has read back, through its own connection, the
 *   first account the server just wrote (scripts/smoke.ts, the safety
 *   interlock). That is the check to point at while the closed test is
 *   actually being driven.
 *
 *   It does not stop anyone from inviting players. Nothing can. What it
 *   does is put the name of the database on the screen beside a count of
 *   what is already in it, so the invitations go out from somebody who
 *   just read both.
 *
 * It reads and it counts. It writes no row and creates no table, and
 * that posture is the same at both exits, pass or refuse.
 *
 * Run with npm run check:closed-test.
 */

import { basename } from "node:path";
import "@/server/env";
import { loadServerConfig } from "@/lib/config";
import { db } from "@/lib/db";

// The prefix the discipline asks for. A name rather than a directory: a
// closed test database that lives beside the project's own file and one
// that lives in /tmp are both fine, and what makes either safe is that
// its name says what it is for.
const REQUIRED_PREFIX = "closed-test";

function refuse(lines: string[]): never {
  console.log("The closed test is refused.\n");
  for (const line of lines) console.log(`  ${line}`);
  console.log(
    "\nNothing was started, nothing was read, and nothing was written.",
  );
  process.exit(1);
}

async function main(): Promise<void> {
  let databaseUrl: string;
  try {
    databaseUrl = loadServerConfig().databaseUrl;
  } catch (error) {
    refuse([
      "The server configuration is not usable, so there is no database to check.",
      String(error instanceof Error ? error.message : error),
    ]);
  }

  if (!databaseUrl.startsWith("file:")) {
    refuse([
      "This guard reads a local file database and the one this process resolves is not a local file.",
      "The closed test runs on a SQLite file, because a file's name is the whole of what a guard can check.",
    ]);
  }

  // The path a file URL carries, with any query or fragment dropped
  // first: SQLite URLs may end in ?connection_limit=1 or ?mode=ro, and
  // neither is part of the name. Only the basename is ever printed.
  const filePath = databaseUrl
    .slice("file:".length)
    .split("?")[0]
    .split("#")[0];
  const name = basename(filePath) || "(no name)";
  if (!name.toLowerCase().startsWith(REQUIRED_PREFIX)) {
    refuse([
      `This process resolves a database named ${name}, and a closed test needs one named ${REQUIRED_PREFIX} something.`,
      'The name is the check because it is the only readable part of "a separate database from anything with real accounts".',
      "Refusing is the point: a closed test pointed at the wrong file would invite thirty strangers into a database",
      "that holds real accounts, which is the one outcome the discipline exists to prevent.",
    ]);
  }

  console.log(
    `The closed test may run. This process resolves ${name}, a local file carrying the name the discipline asks for.\n`,
  );

  // Read through the same connection everything else in the tree uses,
  // so the counts are of the file a server started the same way would
  // write to rather than of a second reading of the same name.
  //
  // The one table is asked for first, because the first run of a closed
  // test is a database that has never had the schema pushed to it, and
  // that ordinary state deserves a sentence rather than the error banner
  // a count would raise. sqlite_master answers on any SQLite file,
  // including one the connection has just brought into being.
  try {
    const present = await db.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'User'`;
    if (present.length === 0) {
      console.log(
        "This file holds no schema yet, so there is nothing in it to count. Step 1 below is the fix, and an empty",
      );
      console.log("file is what a closed test is supposed to start from.");
    } else {
      const [captains, harbors, chronicles, records] = await Promise.all([
        db.user.count(),
        db.room.count(),
        db.voyageChronicle.count(),
        db.voyageTelemetry.count(),
      ]);
      console.log("What is already in it:");
      console.log(`  captains        ${captains}`);
      console.log(`  harbors         ${harbors}`);
      console.log(`  chronicles      ${chronicles}`);
      console.log(`  voyage records  ${records}`);
      if (captains > 0) {
        console.log(
          "\nIt already holds accounts. If those are an earlier closed test's, this run is a continuation of it; if they",
        );
        console.log(
          "are not, stop and find out whose they are before anyone is invited.",
        );
      }
    }
  } catch {
    console.log(
      "The file could not be read through this process's connection. Either it is not a SQLite database at all or",
    );
    console.log(
      "something else is holding it; this guard will not guess which, and it has not written anything.",
    );
  }

  console.log(
    "\nNothing here merges into another database, and nothing here contacts a server. The run time proof that a server",
  );
  console.log(
    "and the script driving it share this file is the smoke suite's safety interlock (scripts/smoke.ts): it refuses",
  );
  console.log(
    "to clean up until it has read back, through its own connection, the account the server just wrote. Point the",
  );
  console.log("first minutes of the closed test at that.\n");
  console.log("How the closed test runs:");
  console.log(
    "  1. Push the schema into this file, resolving the same DATABASE_URL this process just resolved: npm run db:push",
  );
  console.log(
    "  2. Start the server the same way, so it resolves the same file. This guard cannot check that for you.",
  );
  console.log(
    "  3. Prove the wiring before anyone arrives: npm run test:smoke against that server.",
  );
  console.log(
    "  4. Invite the thirty, seat them in harbors, and sail. The mode needs no new instrument for it: the operator",
  );
  console.log(
    "     window and the voyage records read a closed test the way they read any voyage.",
  );
  console.log(
    "  5. When the test ends, discard this file. No row from it is copied anywhere, and it is never merged.",
  );
  console.log(
    "\nThis guard is step zero of the closed test. The rule it enforces, and the reason the name is the rule, are",
  );
  console.log(
    "written down in docs/SECURITY_REVIEW.md beside the rest of the review's findings.",
  );
}

main().catch((err: unknown) => {
  console.error("The closed test guard could not be read.", err);
  process.exitCode = 1;
});
