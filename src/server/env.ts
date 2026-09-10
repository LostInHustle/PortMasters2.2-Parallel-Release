// =====================================================================
// PortMasters 2.2 Parallel Release: environment file loader.
//
// This module exists purely for its side effect, and it must be the very
// first import in server.ts. ES modules evaluate in import order, so
// putting it first guarantees DATABASE_URL is in process.env before
// src/lib/db.ts is reached and Prisma builds its connection string.
//
// It deliberately does not validate. Validation lives in
// src/lib/config.ts and is called from main(), so that a bad value
// produces the readable message rather than a stack trace from module
// loading, which is what happens when a module throws during import.
//
// The path is resolved from this file rather than from the working
// directory, so the server behaves the same whether it was started from
// the project root or from anywhere else. A missing .env is a legitimate
// setup, since a deployment that injects real environment variables has
// none, and an already set variable always wins over the file.
// =====================================================================
import { fileURLToPath } from "node:url";

const envPath = process.env.ENV_FILE
  ? process.env.ENV_FILE
  : fileURLToPath(new URL("../../.env", import.meta.url));

try {
  process.loadEnvFile(envPath);
} catch {
  // No .env on disk. Real environment variables, if any, are already set.
}
