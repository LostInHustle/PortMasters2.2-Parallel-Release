// =====================================================================
// Reading a JSON body, once.
//
// Every write route in this tree opens the same way: parse the body, refuse
// a request that is not JSON at all, then validate it against the route's
// schema and refuse that too. That is a dozen lines of which one belongs to
// the route, so it lives here and each route reads as its own shape.
//
// The second refusal carries the schema's first issue where there is one,
// which is how a route states its own message: write the sentence into the
// schema rather than branching here. The optional third argument is for the
// routes that deliberately answer with one sentence whatever was wrong,
// which is right for a sign in and wrong for a harbor code.
// =====================================================================

import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { tFor } from "./game/i18n";
import { requestLocale } from "./api-auth";

type JsonBody<T> =
  { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * The body of a request, or the refusal to return in its place.
 *
 * Callers read as:
 *
 *   const body = await readJson(req, Schema);
 *   if (!body.ok) return body.response;
 *   const { code } = body.data;
 */
export async function readJson<S extends z.ZodType>(
  req: NextRequest,
  schema: S,
  message?: string,
): Promise<JsonBody<z.infer<S>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const locale = await requestLocale();
    return {
      ok: false,
      response: NextResponse.json(
        { error: tFor(locale, "Invalid JSON body") },
        { status: 400 },
      ),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // A refusal is a sentence the captain reads, in whichever of the two
    // places the route wrote it: the site's own message arrives already
    // read (the third argument below, which the caller localizes), and
    // the schema's own first issue is read here, because a rule shared
    // between routes (the captain name's, say) is one schema rather than
    // one sentence per form. An issue the pack does not carry prints as
    // itself, in either language.
    const locale = await requestLocale();
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            message ??
            tFor(locale, parsed.error.issues[0]?.message ?? "Invalid input"),
        },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
