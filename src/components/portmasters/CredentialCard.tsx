"use client";

// =====================================================================
// One card, two doors.
//
// The harbor asks every captain for a name and a password, and the
// operator console asks for the same two plus the setup code. The two
// screens dress differently (a different logo, a different gradient, a
// different sentence underneath) but the form itself is one form: two
// tabs, a field per tab, the same disabled rule, the same error box, the
// same submit trip. This file is that form, written once, and the two
// screens above it are configurations of it.
//
// What stays out here: the trip itself. The card never learns which
// endpoint it is talking to, because the harbor signs in through
// api.login and the console signs in through api.login and then checks
// the role. That check is a fact about the console rather than about the
// form, so it rides in on the submit the call site hands over.
//
// The fields are declared rather than drawn, one list per tab, which is
// what lets the two doors differ in the middle of the form (the console
// asks for the setup code first, the harbor asks for a display name
// between the name and the password) without either of them owning a
// copy of the layout.
// =====================================================================

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CredentialField, Notice } from "@/components/portmasters/shared";
import { Loader2 } from "lucide-react";
import { PASSWORD_HINT, USERNAME_HINT } from "@/lib/credentials";
import type { PublicUser } from "@/lib/api";

export type CredentialMode = "login" | "register";

/**
 * One input of the form. Everything the underlying CredentialField takes
 * except its value and its change handler, which the card owns because
 * it is the card that submits them.
 *
 * `optional` is read by the submit button and by nothing else: a field
 * with no answer yet still opens the door. The display name is the only
 * one across both doors, and it is optional because the server defaults
 * a missing one to the captain name.
 */
export interface CredentialFieldSpec {
  key: string;
  label: string;
  hint?: string;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  autoFocus?: boolean;
  optional?: boolean;
}

/**
 * The two fields every door asks for on its sign in tab: the captain name
 * and the password, in that order. Both doors ask for exactly these two
 * and neither asks for a third, so the pair is written once rather than
 * twice above this file.
 */
export const SIGN_IN_FIELDS: CredentialFieldSpec[] = [
  {
    key: "username",
    label: "Captain Name",
    placeholder: "your captain name",
    autoFocus: true,
    autoComplete: "username",
  },
  {
    key: "password",
    label: "Password",
    type: "password",
    placeholder: "password",
    autoComplete: "current-password",
  },
];

/**
 * The same two on the register tab, where a name is being chosen rather
 * than remembered. The keys are the sign in ones on purpose: a captain
 * who typed their name and then switched tabs finds it still typed, and
 * the rule beside each field is read off lib/credentials rather than
 * spelled out again, so the sentence and the server's own check are one
 * statement.
 *
 * autoFocus is left off the name: a door that opens its register tab on
 * some other field (the console opens on the setup code) would otherwise
 * put two autofocusing inputs in one form.
 */
export const CHOSEN_NAME: CredentialFieldSpec = {
  key: "username",
  label: "Captain Name",
  hint: USERNAME_HINT,
  placeholder: "choose a captain name",
  autoComplete: "username",
};

export const CHOSEN_PASSWORD: CredentialFieldSpec = {
  key: "password",
  label: "Password",
  hint: PASSWORD_HINT,
  type: "password",
  placeholder: "password",
  autoComplete: "new-password",
};

export interface CredentialCardProps {
  /** The fields of each tab, in the order that tab draws them. */
  fields: { login: CredentialFieldSpec[]; register: CredentialFieldSpec[] };
  /** The block above the form: the door's own logo and name. */
  header: ReactNode;
  /**
   * The harbor the card floats over. The captain's door draws lanterns
   * and mist behind it; the console's door draws nothing, which is why
   * this is a slot rather than a boolean.
   */
  backdrop?: ReactNode;
  /** Why the captain is back at this card rather than where they were. */
  notice?: string | null;
  onDismissNotice?: () => void;
  /** The tab's own trip to the server, answering with the captain it made. */
  submit: (
    mode: CredentialMode,
    values: Record<string, string>,
  ) => Promise<{ user: PublicUser; token: string }>;
  onAuthed: (user: PublicUser, token: string) => void;
  /** The two submit labels and the icon each carries, one pair a tab. */
  labels: { login: string; register: string };
  icons: { login: ReactNode; register: ReactNode };
  /**
   * The gradient the submit button wears and the color of its glow. The
   * button's size, corners and weight are the card's own, so the two
   * doors can be told apart by their color and by nothing else.
   */
  accent: string;
  /** The sentence under the form, which is the door's own too. */
  footer: ReactNode;
}

export function CredentialCard({
  fields,
  header,
  backdrop,
  notice,
  onDismissNotice,
  submit,
  onAuthed,
  labels,
  icons,
  accent,
  footer,
}: CredentialCardProps) {
  const [mode, setMode] = useState<CredentialMode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One answer per field across both tabs, so switching tabs neither
  // loses what was typed nor carries it into a field it does not belong
  // to: the keys are shared where the doors ask for the same thing, and
  // that sharing is the point (a captain name typed on the wrong tab is
  // still their captain name).
  const [values, setValues] = useState<Record<string, string>>(() => {
    const start: Record<string, string> = {};
    for (const spec of [...fields.login, ...fields.register])
      start[spec.key] = "";
    return start;
  });

  const tab = mode;
  const ready = fields[tab].every((spec) => spec.optional || values[spec.key]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user, token } = await submit(mode, values);
      onAuthed(user, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`pm-canvas relative flex min-h-screen w-full items-center justify-center p-4${
        backdrop ? " overflow-hidden" : ""
      }`}
    >
      {backdrop}

      <div className="relative w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="pm-glass-strong pm-crackle w-full rounded-3xl p-7 sm:p-9"
        >
          {header}

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
              setMode(v as CredentialMode);
              setError(null);
            }}
          >
            <TabsList className="mb-5 grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <form onSubmit={send} className="space-y-4">
              {(["login", "register"] as const).map((side) => (
                <TabsContent key={side} value={side} className="mt-0 space-y-4">
                  {fields[side].map((spec) => (
                    <CredentialField
                      key={spec.key}
                      label={spec.label}
                      hint={spec.hint}
                      type={spec.type}
                      placeholder={spec.placeholder}
                      autoComplete={spec.autoComplete}
                      maxLength={spec.maxLength}
                      autoFocus={spec.autoFocus}
                      value={values[spec.key]}
                      onChange={(e) =>
                        setValues((current) => ({
                          ...current,
                          [spec.key]: e.target.value,
                        }))
                      }
                    />
                  ))}
                </TabsContent>
              ))}

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
                disabled={loading || !ready}
                className={`${accent} h-11 w-full rounded-xl font-semibold shadow-lg`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "login" ? (
                  <>
                    {icons.login} {labels.login}
                  </>
                ) : (
                  <>
                    {icons.register} {labels.register}
                  </>
                )}
              </Button>
            </form>
          </Tabs>

          {footer}
        </motion.div>
      </div>
    </div>
  );
}
