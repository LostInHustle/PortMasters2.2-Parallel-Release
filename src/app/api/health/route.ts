// GET /api/health: the readiness probe the hosting platform asks for
// before it promotes a deploy, and the one it repeats afterwards.
//
// It answers from the process and touches nothing else, which is the
// point of it. The probe decides whether the container is serving, so a
// database that is briefly unreachable must not fail it: a restart cannot
// fix a database, and taking the container down would turn a slow query
// into an outage. Nothing here is cached or prerendered either, so the
// answer always describes the process that is running right now rather
// than one that answered at build time.
//
// Kept out of the game's own routes on purpose. Every real route reads
// the database, signs a captain in or both, and a probe wants none of
// that.
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok" });
}
