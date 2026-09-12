"use client";

// =====================================================================
// The card in front of the operator console.
//
// Two ways in, and they are not symmetrical. Registration asks for the
// setup code from ADMIN_SETUP_CODE and creates an operator account;
// signing in is the ordinary captain sign in, followed by a check that the
// account it produced is actually an operator.
//
// Neither check is the lock. Every admin event is authorised again on the
// server, against the account row, at the moment it is asked for; this
// screen exists so that somebody who is not an operator is told so
// plainly rather than being shown a console whose every button refuses
// them.
// =====================================================================

import { useState } from "react";
import { motion } from "framer-motion";
import { api, type PublicUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Field, Notice } from "@/components/portmasters/shared";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { APP_NAME } from "@/lib/game/constants";

// The same sentence the server refuses a non operator with, so the two
// cannot describe the same refusal differently.
const NOT_AN_OPERATOR = "This account is not an administrator.";

export function AdminGate({
  onAuthed,
  notice,
  onDismissNotice,
}: {
  onAuthed: (u: PublicUser, token: string) => void;
  // Why an operator is looking at this card again rather than at the
  // console they had open: the role was taken away, usually by another
  // operator. Owned by the page, which is where the refusal was heard.
  notice?: string | null;
  onDismissNotice?: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [setupCode, setSetupCode] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const { token } = await api.login({
          username: username.trim(),
          password,
        });
        // The sign in answer carries the public captain only, so the role
        // is read separately. This is the authoritative read: /api/auth/me
        // refuses a banned account outright, which is also why an operator
        // banned from another console cannot get back in through here.
        const { user } = await api.me();
        if (!user || user.role !== "admin") throw new Error(NOT_AN_OPERATOR);
        onAuthed(user, token);
      } else {
        const { user, token } = await api.adminRegister({
          username: username.trim(),
          password,
          displayName: displayName.trim() || undefined,
          setupCode,
        });
        onAuthed(user, token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pm-canvas flex min-h-screen w-full items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="pm-glass-strong pm-crackle w-full max-w-md rounded-3xl p-7 sm:p-9"
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="pm-grad-admin relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg">
            <ShieldCheck className="h-8 w-8 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="font-display text-xl font-bold tracking-tight">
            Operator Console
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Account tools for {APP_NAME}
          </p>
        </div>

        {notice && (
          <Notice
            message={notice}
            onDismiss={onDismissNotice}
            className="mb-5"
          />
        )}

        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(v as "login" | "register");
            setError(null);
          }}
        >
          <TabsList className="mb-5 grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          <form onSubmit={submit} className="space-y-4">
            <TabsContent value="login" className="mt-0 space-y-4">
              <Field label="Captain Name">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your captain name"
                  autoFocus
                  autoComplete="username"
                  className="h-11"
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  autoComplete="current-password"
                  className="h-11"
                />
              </Field>
            </TabsContent>

            <TabsContent value="register" className="mt-0 space-y-4">
              <Field label="Setup Code" hint="from the server configuration">
                <Input
                  type="password"
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value)}
                  placeholder="setup code"
                  autoFocus
                  autoComplete="off"
                  className="h-11"
                />
              </Field>
              <Field
                label="Captain Name"
                hint="3 to 20 chars, letters, numbers, underscore"
              >
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="choose a captain name"
                  autoComplete="username"
                  className="h-11"
                />
              </Field>
              <Field label="Display Name" hint="shown in the roster">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="for example, Harbor Master"
                  maxLength={24}
                  className="h-11"
                />
              </Field>
              <Field label="Password" hint="at least 6 characters">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  autoComplete="new-password"
                  className="h-11"
                />
              </Field>
            </TabsContent>

            {error && (
              <div className="rounded-xl border border-alarm/20 bg-alarm/5 px-3.5 py-2.5 text-sm text-alarm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={
                loading ||
                !username ||
                !password ||
                (mode === "register" && !setupCode)
              }
              className="pm-grad-admin h-11 w-full rounded-xl font-semibold shadow-lg"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "login" ? (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Open the Console
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" /> Create Operator
                </>
              )}
            </Button>
          </form>
        </Tabs>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          Registration needs the setup code the server was configured with.
          Accounts created here are administrators.
        </p>
      </motion.div>
    </div>
  );
}
