"use client";

// =====================================================================
// /admin: the operator console.
//
// A second route rather than a panel inside the game, because it belongs
// to a different job. Somebody running the harbor opens this page, does
// what they came to do, and leaves; they are not playing a voyage at the
// time, and nothing here touches one.
//
// The account is checked once on arrival and the console is only shown to
// an administrator, but that check is convenience, not the lock: every
// action the console can take is authorised again on the server, against
// the account row, at the moment it is asked for.
// =====================================================================

import { useEffect, useState } from "react";
import { api, type PublicUser } from "@/lib/api";
import { disconnectSocket, setAuthToken } from "@/lib/realtime";
import { AdminGate } from "@/components/portmasters/AdminGate";
import { AdminConsole } from "@/components/portmasters/AdminConsole";

type Status = "loading" | "gate" | "console";

export default function AdminPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<PublicUser | null>(null);
  // Why the gate is showing rather than the console, when there is a
  // reason worth giving: a demotion, or a session the server refused.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((res) => {
        if (cancelled) return;
        // An account that is signed in but is not an operator gets the
        // card, and the card is where it finds that out: signing in there
        // goes through the same role check.
        if (res.user && res.user.role === "admin") {
          // The cookie is httpOnly, so the token the socket needs comes
          // from this same response.
          if (res.token) setAuthToken(res.token);
          setMe(res.user);
          setStatus("console");
        } else {
          setStatus("gate");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("gate");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Leaving the console and losing it share this teardown, and they differ
  // in exactly one thing, as they do in the game: whether the session is
  // ended on the server first. The socket is closed and the account is
  // forgotten either way, so nothing is left holding a credential the
  // server has stopped honouring.
  const leave = (message: string | null) => {
    disconnectSocket();
    setAuthToken(null);
    setMe(null);
    setNotice(message);
    setStatus("gate");
  };

  // The cookie this session lives in is httpOnly, so the browser would
  // happily sign the next reload straight back in if signing out only
  // cleared what this tab remembers. The call is what ends it, and it is
  // best effort for the same reason the game's own sign out treats it that
  // way: the local teardown has to happen whether or not the request lands.
  const handleSignOut = async () => {
    try {
      await api.logout();
    } catch {
      // best effort
    }
    leave("Signed out of the operator console.");
  };

  // Nothing to end here. The session either ran out or was ended already,
  // and an operator who has been demoted is still a signed in captain.
  const handleConsoleLost = (message: string) => leave(message);

  if (status === "loading") {
    return (
      <main className="pm-canvas flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground font-display text-lg">
          Reading the register...
        </p>
      </main>
    );
  }

  if (status === "console" && me) {
    return (
      <AdminConsole
        me={me}
        onSignOut={handleSignOut}
        onLeave={handleConsoleLost}
      />
    );
  }

  return (
    <AdminGate
      onAuthed={(user, token) => {
        setAuthToken(token);
        setMe(user);
        setNotice(null);
        setStatus("console");
      }}
      notice={notice}
      onDismissNotice={() => setNotice(null)}
    />
  );
}
