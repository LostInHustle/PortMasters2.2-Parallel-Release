"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { getSocket, getAuthToken } from "@/lib/realtime";
import type { OnlineUser, PublicUser } from "@/types/realtime";

/**
 * App wide realtime connection + presence. The socket is a singleton; this
 * hook attaches listeners for presence/auth and returns the live socket so
 * components can subscribe to room / chat / game status events.
 */
export function useRealtime(user: PublicUser | null) {
  // Lazily obtain the shared socket (singleton). Recomputed only when the
  // authenticated user changes.
  const socket = useMemo(() => (user ? getSocket() : null), [user]);
  const [connected, setConnected] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const alive = useRef(true);

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
      if (alive.current) {
        setAuthed(true);
        setAuthError(null);
      }
    };
    const onAuthFail = (data: { error: string }) => {
      if (alive.current) setAuthError(data.error);
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

  return { socket, connected, authed, onlineUsers, authError, requestPresence };
}
