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
// which is right for a sign in and wrong for a room code.
// =====================================================================

import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";

export type JsonBody<T> =
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
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      ),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: message ?? parsed.error.issues[0]?.message ?? "Invalid input",
        },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
