"use client";

// =====================================================================
// /admin/balance: the balance dashboard.
//
// Its own route under
// /admin rather than a tab on the console, because it belongs to a
// different job: the console is about accounts, and this is about whether
// the mode itself is healthy. Somebody on balance duty opens this page,
// reads it, and leaves, and nothing they do here can touch a voyage that
// is under way, because the page only ever reads.
//
// The account is checked once on arrival and the dashboard is only shown
// to an operator, but as on the console that check is convenience rather
// than the lock: the reading is authorised again on the server, against
// the account row, at the moment it is asked for.
//
// Unlike the console there is no sign out here, and no socket. The page
// holds no session of its own: the Console link leads back to /admin,
// which is where an operator's session is opened and ended, and the
// reading itself travels over REST on the cookie the browser already
// holds.
// =====================================================================

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { t } from "@/lib/game/i18n";
import { useLanguage } from "@/lib/use-language-preference";
import { AdminGate } from "@/components/portmasters/AdminGate";
import { BalanceDashboard } from "@/components/portmasters/BalanceDashboard";
import { PageSplash } from "@/components/ui/page-splash";

type Status = "loading" | "gate" | "dashboard";

export default function AdminBalancePage() {
  // This route renders outside the harbor harbor, so it subscribes to the
  // captain's language at its own root: a flip redraws the splash and the
  // dashboard under it rather than waiting for the next route change.
  useLanguage();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let canceled = false;
    api
      .me()
      .then((res) => {
        if (canceled) return;
        // A signed in captain who is not an operator gets the gate card,
        // which is where they find that out: signing in there goes through
        // the same role check the console uses.
        setStatus(res.user && res.user.role === "admin" ? "dashboard" : "gate");
      })
      .catch(() => {
        if (!canceled) setStatus("gate");
      });
    return () => {
      canceled = true;
    };
  }, []);

  if (status === "loading") {
    return <PageSplash line={t("Reading the balance...")} />;
  }

  if (status === "dashboard") return <BalanceDashboard />;

  return <AdminGate onAuthed={() => setStatus("dashboard")} />;
}
