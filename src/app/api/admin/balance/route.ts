// GET /api/admin/balance: the balance dashboard's reading.
//
// The first read the operator surface has on REST, and it is read only in
// the strongest sense: it opens two tables that hold finished voyage
// facts, reduces them, and writes nothing. Nothing here reads a harbor, a
// seat, a save or a socket, so the page it feeds cannot slow a voyage down,
// which is the design's rollback for the balance dashboard as a property
// of the code rather than a promise in a document. The window itself lives
// in src/server/telemetry-window.ts, which the launch gate report reads as
// well, so the page and the report answer for one set of voyages.
//
// The gate is the account row, checked here at the moment the reading is
// asked for, the same way every socket admin action checks it: the page's
// own check is a convenience that keeps a captain from being shown a
// dashboard, and this is the lock.
import { NextResponse } from "next/server";
import {
  getCurrentUser,
  requestLocale,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { tFor } from "@/lib/game/i18n";
import { NOT_AN_ADMINISTRATOR } from "@/lib/game/constants/copy";
import { readDashboard } from "@/lib/game/dashboard";
import { readOperatorWindow } from "@/server/telemetry-window";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return unauthorizedResponse();
  // The same sentence the realtime layer refuses a captain with, read from
  // the shared constant rather than typed again, so the two surfaces cannot
  // describe one refusal two ways.
  if (me.role !== "admin") {
    const locale = await requestLocale();
    return NextResponse.json(
      { error: tFor(locale, NOT_AN_ADMINISTRATOR) },
      { status: 403 },
    );
  }

  const input = await readOperatorWindow();
  // The reading composes in the reader's own language: this route serves a
  // captain's browser, so it hands readDashboard the request's locale rather
  // than letting the process reader answer in English (the CLI report and
  // the smoke suites call it without one and keep the process reader).
  const locale = await requestLocale();
  return NextResponse.json({ reading: readDashboard(input, locale) });
}
