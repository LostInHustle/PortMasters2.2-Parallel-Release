// =====================================================================
// The operator console: the admin frames, over ../admin's own rules.
// =====================================================================

import type { Server, Socket } from "socket.io";

import {
  banAccount,
  bulkAct,
  grantAdmin,
  listAccounts,
  purgeAccount,
  requireAdmin,
  revokeAdmin,
  unbanAccount,
  type AdminActor,
  type AdminPayload,
  type AdminResult,
  type BulkPayload,
} from "../admin";
import { type DepartureCleanup } from "../presence";

export function wireOperator(
  io: Server,
  socket: Socket,
  departureCleanup: DepartureCleanup,
): void {
  // The console runs on the socket for the reason admin.ts sets out at
  // its top: a route handler gets a different copy of this module, so a
  // ban written from a route would flag the row in the database and
  // leave the captain's live connection exactly as it was. Every handler
  // below asks requireAdmin first, which reads the acting account's role
  // out of the database again, and every one answers with the roster as
  // it stands after the change, so a console never has to guess what its
  // own click did.
  socket.on("admin:list", async () => {
    if (!(await requireAdmin(socket))) return;
    socket.emit("admin:accounts", await listAccounts());
  });

  // The five that change something share a shape: ask, act, answer with
  // the roster, or answer with the reason it was refused. Only the two
  // that cannot be undone need to know who is asking.
  const adminAction = (
    event: string,
    run: (actor: AdminActor, payload: AdminPayload) => Promise<AdminResult>,
  ) =>
    socket.on(event, async (payload: AdminPayload | undefined) => {
      const actor = await requireAdmin(socket);
      if (!actor) return;
      const result = await run(actor, payload ?? {});
      if (!result.ok) {
        socket.emit("admin:error", { error: result.error });
        return;
      }
      socket.emit("admin:accounts", await listAccounts());
    });

  adminAction("admin:ban", (actor, payload) =>
    banAccount(io, departureCleanup, actor, payload),
  );
  adminAction("admin:unban", (_actor, payload) => unbanAccount(payload));
  adminAction("admin:grant", (_actor, payload) => grantAdmin(payload));
  adminAction("admin:revoke", (actor, payload) =>
    revokeAdmin(io, actor, payload),
  );
  adminAction("admin:purge", (actor, payload) =>
    purgeAccount(io, departureCleanup, actor, payload),
  );

  // The same five, aimed at a selection. This one does not go through
  // adminAction, because a selection can succeed for some accounts and
  // be refused for others, so the console is owed both answers: the
  // roster as it stands afterwards, and a line for each account that was
  // left alone. A request that changed nothing is an ordinary refusal
  // and takes the ordinary route.
  socket.on("admin:bulk", async (payload: BulkPayload | undefined) => {
    const actor = await requireAdmin(socket);
    if (!actor) return;
    const outcome = await bulkAct(io, departureCleanup, actor, payload ?? {});
    if (!outcome.ok) {
      socket.emit("admin:error", { error: outcome.error });
      return;
    }
    socket.emit("admin:accounts", await listAccounts());
    socket.emit("admin:bulk-result", { report: outcome.report });
  });
}
