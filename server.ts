// =====================================================================
// PortMasters 2.2 Parallel Release: application entry point.
//
// One process, one port, one server. This file builds a single Node HTTP
// server and hands it to two things:
//
//   Next.js, which serves the page and every route under /api, and
//   the realtime layer in src/server/realtime, which mounts Socket.IO
//   on /socket.io of the very same server.
//
// Because both live on one listener, the browser fetches the site, calls
// the API and opens its socket on the same origin. There is no gateway
// in front, no second port to forward, and nothing to keep in step. The
// realtime layer rewrites the server's request listener when it attaches,
// forwarding anything that is not /socket.io straight back to Next.
//
// Run it with `npm run dev` while working, or `npm run build` followed by
// `npm run start` for the production build.
//
// Two things are imported late, on purpose. The environment is validated
// before the database client is built, so a bad value stops the server
// with a readable message instead of an error thrown from module loading.
// The realtime layer, and the database handle it pulls in with it, are
// therefore loaded inside main() rather than at the top of the file.
// =====================================================================

// Must stay first: puts .env into process.env before anything reads it.
import "@/server/env";

import { createServer } from "node:http";
import next from "next";
import { loadServerConfig } from "@/lib/config";
import type { attachRealtime, closeRealtime } from "@/server/realtime";

type Realtime = ReturnType<typeof attachRealtime>;

async function main(): Promise<void> {
  // Throws with every unusable variable listed at once.
  const { host, port, isProduction } = loadServerConfig();

  const [{ db }, realtime] = await Promise.all([
    import("@/lib/db"),
    import("@/server/realtime"),
  ]);
  const attach: typeof attachRealtime = realtime.attachRealtime;
  const close: typeof closeRealtime = realtime.closeRealtime;

  const app = next({ dev: !isProduction, hostname: host, port });
  await app.prepare();

  const handleRequest = app.getRequestHandler();
  const httpServer = createServer((req, res) => handleRequest(req, res));

  // In development Next serves its hot reload channel over a WebSocket on
  // this same server, and a custom server has to wire that up by hand.
  // Registered before the realtime layer so it sees each upgrade first;
  // Socket.IO only takes the ones addressed to /socket.io and leaves the
  // rest alone.
  if (!isProduction) {
    const handleUpgrade = app.getUpgradeHandler();
    httpServer.on("upgrade", async (req, socket, head) => {
      try {
        await handleUpgrade(req, socket, head);
      } catch (err) {
        socket.destroy();
        console.error(`[server] could not handle upgrade for ${req.url}`, err);
      }
    });
  }

  // Attaches Socket.IO. Must happen before listen: the Socket.IO server
  // initializes itself on the server's "listening" event, and a listener
  // registered after the server is already up never fires.
  const io = attach(httpServer);

  await new Promise<void>((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      httpServer.removeListener("listening", onListening);
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use. Stop whatever is holding it, ` +
              `or start this one on a different port with PORT=<number> npm run dev.`,
          ),
        );
        return;
      }
      reject(err);
    };
    const onListening = () => {
      httpServer.removeListener("error", onError);
      resolve();
    };
    httpServer.once("error", onError);
    httpServer.once("listening", onListening);
    httpServer.listen(port, host);
  });

  const shown = host === "0.0.0.0" ? "localhost" : host;
  console.log("");
  console.log("  PortMasters 2.2 Parallel Release");
  console.log(`  Site, API and realtime all on http://${shown}:${port}`);
  console.log(`  Mode: ${isProduction ? "production" : "development"}`);
  console.log("");

  installShutdownHandlers({
    httpServer,
    io,
    close,
    disconnectDb: () => db.$disconnect(),
  });
}

/**
 * Closes everything in the order that lets in flight work finish.
 *
 * New connections stop first, then live sockets are dropped, then the
 * Next.js build server and the database are released. The listeners are
 * removed before the exit so a second Ctrl+C cannot start a second
 * teardown while the first is still running.
 */
function installShutdownHandlers(deps: {
  httpServer: ReturnType<typeof createServer>;
  io: Realtime;
  close: typeof closeRealtime;
  disconnectDb: () => Promise<void>;
}): void {
  const { httpServer, io, close, disconnectDb } = deps;
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
    console.log(`\n[server] ${signal} received, shutting down.`);

    try {
      // Drops every live socket and closes the HTTP listener.
      await close(io);
    } catch (err) {
      console.error("[server] realtime layer did not close cleanly", err);
    }
    if (httpServer.listening) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    try {
      await disconnectDb();
    } catch (err) {
      console.error("[server] database did not disconnect cleanly", err);
    }
    console.log("[server] stopped.");
    process.exit(0);
  };

  const onSigint = () => void shutdown("SIGINT");
  const onSigterm = () => void shutdown("SIGTERM");

  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n[server] could not start.\n${message}\n`);
  process.exit(1);
});
