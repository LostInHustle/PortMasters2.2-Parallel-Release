// POST /api/rooms/join: join a harbor by its 6 character code
//
// The answer is the shared one (see joinHarborResponse in @/lib/api-rooms),
// so the by code route and the by id route cannot disagree about who may
// come aboard. What this route owns is the naming: a code off the body,
// and the sentence a code that names no harbor is refused with.
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getCurrentUser,
  requestLocale,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { joinHarborResponse } from "@/lib/api-rooms";
import { tFor } from "@/lib/game/i18n";
import { readJson } from "@/lib/api-json";

const Schema = z.object({ code: z.string().length(6) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  // Both refusals below are sentences the joining captain reads, so the
  // language is read once, here.
  const locale = await requestLocale();

  const body = await readJson(
    req,
    Schema,
    tFor(locale, "A 6 character harbor code is required"),
  );
  if (!body.ok) return body.response;
  const code = body.data.code.toUpperCase();

  return joinHarborResponse(
    { code },
    user.id,
    locale,
    "No harbor exists with that code",
  );
}
