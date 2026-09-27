// =====================================================================
// PortMasters 2.2 Parallel Release: server configuration contract.
//
// Everything the process reads from the environment passes through here
// once, at boot, and comes out typed or not at all. A typo in a port, a
// missing database URL or a stray character in DATABASE_URL stops the
// server with a sentence naming the offending variable, instead of
// surfacing later as a connection that silently goes nowhere.
//
// Server only. The browser bundle never imports this file.
// =====================================================================
import { z } from "zod";

// The port the whole application answers on: the site, the REST API and
// the realtime channel together. 8080 is the documented default.
const DEFAULT_PORT = 8080;

// The default bind address. 0.0.0.0 accepts connections from other
// machines on the network, which is what a tunnel or a second device on
// the same wifi needs. Set HOST=127.0.0.1 to keep it on this machine.
const DEFAULT_HOST = "0.0.0.0";

// The share of voyages the telemetry spine records, as a fraction of one.
// The plan asks for sampling to be configuration from the first day
// rather than bolted on later, on the grounds that volume is the only
// thing about telemetry that ever needs turning down. 1 records every
// voyage, which is the default because a table this small has no volume
// problem yet, and 0 records none, which is the switch for a machine that
// is expected to be under load.
const DEFAULT_TELEMETRY_SAMPLE_RATE = 1;

const ServerConfigSchema = z.object({
  nodeEnv: z.enum(["development", "production", "test"]),
  isProduction: z.boolean(),
  port: z
    .number({ error: "PORT must be a whole number between 1 and 65535." })
    .int("PORT must be a whole number between 1 and 65535.")
    .min(1, "PORT must be a whole number between 1 and 65535.")
    .max(65535, "PORT must be a whole number between 1 and 65535."),
  host: z.string().min(1, "HOST must not be empty."),
  telemetrySampleRate: z
    .number({
      error:
        "TELEMETRY_SAMPLE_RATE must be a number between 0 and 1: the share of voyages recorded.",
    })
    .min(
      0,
      "TELEMETRY_SAMPLE_RATE must be a number between 0 and 1: the share of voyages recorded.",
    )
    .max(
      1,
      "TELEMETRY_SAMPLE_RATE must be a number between 0 and 1: the share of voyages recorded.",
    ),
  databaseUrl: z
    .string()
    .min(1, "DATABASE_URL must be set.")
    // The empty case is already reported above. Short circuiting here keeps
    // a blank value from producing two complaints about the same line.
    .refine(
      (value) =>
        value === "" ||
        value.startsWith("file:") ||
        value.startsWith("postgres"),
      "DATABASE_URL must start with file: for SQLite, or name a Postgres database.",
    ),
});

type ServerConfig = z.infer<typeof ServerConfigSchema>;

/**
 * Reads and validates the process environment.
 *
 * Throws with every problem listed at once, so a misconfigured machine
 * is fixed in one pass rather than one restart per mistake.
 */
export function loadServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const rawNodeEnv = env.NODE_ENV ?? "development";
  const nodeEnv =
    rawNodeEnv === "production" || rawNodeEnv === "test"
      ? rawNodeEnv
      : "development";

  // PORT may arrive as a string from the environment. An empty string is
  // treated as "not set" so a blank line in a config file cannot turn
  // into NaN. Numbers are rejected rather than coerced, so "80a80" fails
  // loudly instead of quietly becoming 80.
  const rawPort = env.PORT?.trim();
  let port: number = DEFAULT_PORT;
  if (rawPort) {
    port = Number(rawPort);
  }

  // Read the same way PORT is: an empty value means the default rather
  // than zero, and a value that is not a number fails the schema below
  // instead of quietly becoming NaN.
  const rawSampleRate = env.TELEMETRY_SAMPLE_RATE?.trim();
  let telemetrySampleRate: number = DEFAULT_TELEMETRY_SAMPLE_RATE;
  if (rawSampleRate) {
    telemetrySampleRate = Number(rawSampleRate);
  }

  const candidate = {
    nodeEnv,
    isProduction: nodeEnv === "production",
    port,
    host: env.HOST?.trim() || DEFAULT_HOST,
    telemetrySampleRate,
    databaseUrl: env.DATABASE_URL?.trim() || "",
  };

  const parsed = ServerConfigSchema.safeParse(candidate);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (issue) => `  ${issue.path.join(".") || "config"}: ${issue.message}`,
    );
    throw new Error(
      `The server configuration is not usable:\n${lines.join("\n")}\n` +
        `\nCheck the .env file in the project root, then start the server again.`,
    );
  }

  return parsed.data;
}
