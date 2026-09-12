"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { getSocket, getAuthToken } from "@/lib/realtime";
import type { OnlineUser, PublicUser } from "@/types/realtime";

/**
 * App wide realtime connection + presence. The socket is a singleton; this
 * hook attaches listeners for presence/auth and returns the live socket so
 * components can subscribe to room / chat / game status events.
 *
 * `onSessionLost` is called with the reason when the server refuses this
 * connection's credentials. That happens when a session runs out with the
 * tab still open, and when an operator bans or deletes the account. The
 * caller owns the response, because it is the caller that knows how to
 * take the session down and where the reason belongs on screen.
 *
 * The callback is held in a ref so a caller passing an inline arrow does
 * not make the effect below tear its listeners down and put them back on
 * every render.
 */
export function useRealtime(
  user: PublicUser | null,
  onSessionLost?: (message: string) => void,
) {
  // Lazily obtain the shared socket (singleton). Recomputed only when the
  // authenticated user changes.
  const socket = useMemo(() => (user ? getSocket() : null), [user]);
  const [connected, setConnected] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const alive = useRef(true);
  const sessionLost = useRef(onSessionLost);

  useEffect(() => {
    sessionLost.current = onSessionLost;
  }, [onSessionLost]);

  useEffect(() => {
    if (!socket) {
      // Defer resets so we don't call setState synchronously inside the effect.
      Promise.resolve().then(() => {
        if (alive.current) {
          setConnected(false);
          setAuthed(false);
        }
      });
      return;
    }
    alive.current = true;

    const onConnect = () => {
      setConnected(true);
      // Present the token explicitly on every (re)connect. The server also
      // authenticates from the session cookie on the handshake, so on the
      // same origin either path would do; sending the token as well means
      // the connection still works if the cookie is ever scoped away. The
      // server treats a null token as "fall back to the cookie".
      socket.emit("auth", { token: getAuthToken() ?? undefined });
    };
    const onDisconnect = () => {
      setConnected(false);
      setAuthed(false);
    };
    const onAuthOk = () => {
      if (alive.current) setAuthed(true);
    };
    const onAuthFail = (data: { error: string }) => {
      // This connection is not an authenticated captain and will not
      // become one: the answer was no, so the session behind it is over.
      // Recording the message here and leaving the rest of the interface
      // standing is what this hook used to do, and it left a captain
      // sitting in a harbor that had already written them off.
      if (alive.current) sessionLost.current?.(data.error);
    };
    const onPresence = (data: { users: OnlineUser[] }) => {
      if (alive.current) setOnlineUsers(data.users ?? []);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("auth:ok", onAuthOk);
    socket.on("auth:fail", onAuthFail);
    socket.on("presence:update", onPresence);

    // If already connected, sync the connected flag (deferred to avoid a
    // synchronous setState inside the effect body) and re trigger auth.
    if (socket.connected) {
      Promise.resolve().then(() => {
        if (alive.current) setConnected(true);
      });
      socket.emit("auth", { token: getAuthToken() ?? undefined });
    }

    return () => {
      alive.current = false;
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("auth:ok", onAuthOk);
      socket.off("auth:fail", onAuthFail);
      socket.off("presence:update", onPresence);
    };
  }, [socket]);

  const requestPresence = useCallback(() => {
    getSocket().emit("presence:request");
  }, []);

  return { socket, connected, authed, onlineUsers, requestPresence };
}
