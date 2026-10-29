// =====================================================================
// PortMasters 2.2 Parallel Release: Cloudflare entry point.
//
// The game is one long lived Node process: server.ts puts Next.js, every
// /api route and Socket.IO on one HTTP listener, and Prisma reads a local
// SQLite file. A request scoped Worker has no long lived listener, no
// local filesystem and no shared memory between requests, so the process
// runs in a Cloudflare Container instead.
//
// This module is the thin edge in front of it. One Worker forwards to one
// Durable Object, the object owns the one container, and the container
// runs server.ts unchanged. There is deliberately no routing, no caching
// and no game logic here.
// =====================================================================

import { Container } from "@cloudflare/containers";

// Every request must reach the same object, because the object owns the
// only container. The name is fixed rather than derived from the caller.
const INSTANCE_NAME = "portmasters";

// The four R2 settings Litestream cannot work without. Checked together so
// a half configured deployment stops with a readable message instead of a
// container that replicates nowhere.
const LITESTREAM_SETTINGS = [
  "LITESTREAM_BUCKET",
  "LITESTREAM_ENDPOINT",
  "LITESTREAM_ACCESS_KEY_ID",
  "LITESTREAM_SECRET_ACCESS_KEY",
] as const;

type LitestreamSetting = (typeof LITESTREAM_SETTINGS)[number];
type ContainerContext = ConstructorParameters<typeof Container<Env>>[0];

// Declared by hand because the Worker is small. Secrets are optional here
// until `wrangler secret put` has run, and the vars carry the defaults the
// entry point and the application already document.
interface Env {
  GAME: DurableObjectNamespace<GameContainer>;
  ADMIN_SETUP_CODE?: string;
  APP_URL?: string;
  LITESTREAM_ACCESS_KEY_ID?: string;
  LITESTREAM_BUCKET?: string;
  LITESTREAM_ENABLED?: string;
  LITESTREAM_ENDPOINT?: string;
  LITESTREAM_SECRET_ACCESS_KEY?: string;
  PHASE_CLOCK?: string;
  TELEMETRY_SAMPLE_RATE?: string;
}

/** The value when it carries something besides whitespace, original form. */
function present(value: string | undefined): string | undefined {
  return value && value.trim() ? value : undefined;
}

function litestreamSetting(env: Env, name: LitestreamSetting): string {
  const value = present(env[name]);
  if (!value) {
    // Name only. A secret value never reaches a log or an error message.
    throw new Error(`${name} is not set`);
  }
  return value;
}

export class GameContainer extends Container<Env> {
  defaultPort = 8080;

  // A harbor with nobody in it costs nothing while it sleeps, and a
  // Socket.IO heartbeat keeps an active one awake. The first request after
  // sleep pays the start and any Litestream restore.
  sleepAfter = "15m";

  // Litestream reaches R2 over the public internet.
  enableInternet = true;

  // The package fetches `http://${pingEndpoint}` on the container port, so
  // the first segment is a placeholder hostname and the rest is the path
  // that has to answer before the harbor counts as ready. The health route
  // reads the process and nothing else, which is what makes it safe to
  // poll this way.
  pingEndpoint = "container/api/health";

  constructor(ctx: ContainerContext, env: Env) {
    super(ctx, env);

    // A running process keeps the environment it started with, so a
    // rotated secret reaches the game only after the container restarts.
    const litestreamEnabled = present(env.LITESTREAM_ENABLED) !== "0";
    const vars: Record<string, string> = {
      NODE_ENV: "production",
      PORT: "8080",
      HOST: "0.0.0.0",
      DATABASE_URL: "file:/app/db/custom.db",
      PHASE_CLOCK: present(env.PHASE_CLOCK) ?? "0",
      TELEMETRY_SAMPLE_RATE: present(env.TELEMETRY_SAMPLE_RATE) ?? "1",
      LITESTREAM_ENABLED: litestreamEnabled ? "1" : "0",
    };

    const appUrl = present(env.APP_URL);
    if (appUrl) {
      vars.APP_URL = appUrl;
    }

    // Absence is a supported state: operator registration refuses every
    // attempt without it, which is the door's existing behavior.
    const adminCode = present(env.ADMIN_SETUP_CODE);
    if (adminCode) {
      vars.ADMIN_SETUP_CODE = adminCode;
    }

    // Fail closed. The two empty R2 vars in wrangler.jsonc must not start a
    // container that believes it is replicating.
    if (litestreamEnabled) {
      for (const name of LITESTREAM_SETTINGS) {
        vars[name] = litestreamSetting(env, name);
      }
    }

    this.envVars = vars;
  }

  /**
   * Wait for the game only when it is not already answering.
   *
   * The package's own fetch starts the container when it is stopped, but
   * it allows twenty seconds for the port, which is tight for a cold
   * container that has to restore a database and apply a migration. This
   * waits first with a longer budget and answers a fixed 503 on failure.
   * A healthy harbor skips the readiness ping entirely.
   */
  async fetch(request: Request): Promise<Response> {
    const { status } = await this.getState();
    if (status !== "healthy") {
      try {
        await this.startAndWaitForPorts({
          cancellationOptions: {
            instanceGetTimeoutMS: 60_000,
            portReadyTimeoutMS: 120_000,
            abort: request.signal,
          },
        });
      } catch {
        return new Response("The harbor is starting up. Try again shortly.", {
          status: 503,
          headers: { "retry-after": "15" },
        });
      }
    }
    return super.fetch(request);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers = new Headers(request.headers);

    // The application reads the first x-forwarded-for hop as the caller's
    // address (lib/auth-limit.ts) and the first x-forwarded-proto hop to
    // decide whether the session cookie is Secure (lib/api-auth.ts). This
    // Worker is the only proxy on the Cloudflare path, so it owns both.
    // A client supplied address is removed rather than trusted, which
    // keeps one captain from choosing another captain's rate limit bucket.
    const clientAddress = present(headers.get("cf-connecting-ip") ?? undefined);
    if (clientAddress) {
      headers.set("x-forwarded-for", clientAddress);
    } else {
      headers.delete("x-forwarded-for");
    }
    headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

    // Rebuilt with the edge's headers and the original method, body and
    // upgrade headers, so Socket.IO reaches the container as a WebSocket.
    const forwarded = new Request(request, { headers });

    try {
      return await env.GAME.getByName(INSTANCE_NAME).fetch(forwarded);
    } catch (error) {
      // A configuration error is reported in the Worker log by name only,
      // and the browser gets a fixed sentence rather than a stack trace.
      console.error("The game container did not accept the request.", error);
      return new Response("The harbor is not available right now.", {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
  },
} satisfies ExportedHandler<Env>;
