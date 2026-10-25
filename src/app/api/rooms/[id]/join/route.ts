// POST /api/rooms/[id]/join: join a harbor by id
//
// The answer is the shared one (see joinHarborResponse in @/lib/api-rooms),
// so the by id route and the by code route cannot disagree about who may
// come aboard. What this route owns is the naming: an id off the params,
// and the sentence an id that names no harbor is refused with.
import { NextRequest } from "next/server";
import { HARBOR_NOT_FOUND } from "@/lib/api";
import {
  getCurrentUser,
  requestLocale,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { joinHarborResponse } from "@/lib/api-rooms";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;
  // The refusals below are sentences the joining captain reads, so the
  // language is read once, here.
  const locale = await requestLocale();

  return joinHarborResponse({ id }, user.id, locale, HARBOR_NOT_FOUND);
}
