"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, type PublicUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Field, Notice } from "@/components/portmasters/shared";
import { Loader2, Anchor, Ship, Waves } from "lucide-react";
import { APP_NAME } from "@/lib/game/constants";

export function AuthScreen({
  onAuthed,
  notice,
  onDismissNotice,
}: {
  onAuthed: (u: PublicUser, token: string) => void;
  // Why this captain is looking at the sign in screen rather than at the
  // harbor they were in a moment ago: a session that ran out, a ban, or an
  // account an operator deleted. Owned by the page, which is where the
  // realtime layer's refusal was heard.
  notice?: string | null;
  onDismissNotice?: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user, token } =
        mode === "login"
          ? await api.login({ username: username.trim(), password })
          : await api.register({
              username: username.trim(),
              password,
              displayName: displayName.trim() || undefined,
            });
      onAuthed(user, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pm-canvas relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4">
      <motion.div
        className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, oklch(0.72 0.10 165 / 0.45), transparent 70%)",
        }}
        animate={{ y: [0, 18, 0], x: [0, 10, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, oklch(0.80 0.13 85 / 0.40), transparent 70%)",
        }}
        animate={{ y: [0, -20, 0], x: [0, -12, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Floating paper lanterns drifting across the harbor at dawn */}
      <div
        className="pm-lantern h-3 w-3"
        style={{
          top: "18%",
          left: "12%",
          background:
            "radial-gradient(circle, oklch(0.82 0.14 60 / 0.7), oklch(0.72 0.16 40 / 0.3))",
          animationDelay: "0s",
        }}
      />
      <div
        className="pm-lantern h-2 w-2"
        style={{
          top: "30%",
          left: "78%",
          background:
            "radial-gradient(circle, oklch(0.75 0.12 165 / 0.6), oklch(0.65 0.14 180 / 0.2))",
          animationDelay: "3s",
          animationDuration: "16s",
        }}
      />
      <div
        className="pm-lantern h-2.5 w-2.5"
        style={{
          top: "62%",
          left: "22%",
          background:
            "radial-gradient(circle, oklch(0.80 0.13 85 / 0.55), oklch(0.70 0.15 65 / 0.2))",
          animationDelay: "6s",
          animationDuration: "18s",
        }}
      />
      <div
        className="pm-lantern h-1.5 w-1.5"
        style={{
          top: "72%",
          left: "68%",
          background:
            "radial-gradient(circle, oklch(0.78 0.13 350 / 0.5), oklch(0.68 0.15 330 / 0.2))",
          animationDelay: "9s",
          animationDuration: "20s",
        }}
      />
      {/* Morning mist drifting across the lower harbor */}
      <div className="pm-mist pointer-events-none absolute inset-x-0 bottom-0 h-32" />

      <div className="relative w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="pm-glass-strong pm-crackle rounded-3xl p-7 sm:p-9"
        >
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="pm-grad-brand absolute inset-0 rounded-2xl opacity-60 blur-md" />
              <div className="pm-grad-brand relative flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg">
                <Anchor className="h-8 w-8 text-white" strokeWidth={2.2} />
              </div>
            </div>
            <h1 className="font-display text-xl font-bold tracking-tight">
              <span className="text-brand">{APP_NAME}</span>
            </h1>
            {/* A tagline, not a second title. This line used to carry the
                game's old subtitle, which left the screen showing two
                different names for one game. */}
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Waves className="h-3.5 w-3.5" /> Maritime trade on the ancient
              Silk Road
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
                <Field
                  label="Captain Name"
                  hint="3 to 20 chars, letters, numbers, underscore"
                >
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="choose a captain name"
                    autoFocus
                    autoComplete="username"
                    className="h-11"
                  />
                </Field>
                <Field label="Display Name" hint="shown to other sailors">
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="for example, Captain Mei"
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

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-xl border border-alarm/20 bg-alarm/5 px-3.5 py-2.5 text-sm text-alarm"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                disabled={loading || !username || !password}
                className="pm-grad-brand h-11 w-full rounded-xl font-semibold shadow-lg shadow-brand/20"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "login" ? (
                  <>
                    <Ship className="mr-2 h-4 w-4" /> Set Sail
                  </>
                ) : (
                  <>
                    <Anchor className="mr-2 h-4 w-4" /> Hoist the Colours
                  </>
                )}
              </Button>
            </form>
          </Tabs>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
            Open this page in another browser to register a second captain and
            see them appear online in real time.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
