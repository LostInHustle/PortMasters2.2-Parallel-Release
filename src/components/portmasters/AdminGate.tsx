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
//
// The form itself is CredentialCard's, shared with the captain's door.
// What is this screen's own is the setup code (a field the harbor never
// asks for), the role check behind the sign in tab, and the console's
// colors.
// =====================================================================

import { api, type PublicUser } from "@/lib/api";
import { ShieldCheck, KeyRound } from "lucide-react";
import { APP_NAME } from "@/lib/game/constants";
import { DISPLAY_NAME_MAX } from "@/lib/credentials";
import {
  CHOSEN_NAME,
  CHOSEN_PASSWORD,
  CredentialCard,
  SIGN_IN_FIELDS,
  type CredentialFieldSpec,
} from "@/components/portmasters/CredentialCard";

// The same sentence the server refuses a non operator with, so the two
// cannot describe the same refusal differently.
const NOT_AN_OPERATOR = "This account is not an administrator.";

// The register tab: the setup code the server was configured with, then
// the captain's own two fields with the roster's display name between
// them. The code comes first because it is the one field this door has
// that the harbor's does not, and a form that opened on the field both
// doors share would be a form that looks like the other one.
const REGISTER_FIELDS: CredentialFieldSpec[] = [
  {
    key: "setupCode",
    label: "Setup Code",
    hint: "from the server configuration",
    type: "password",
    placeholder: "setup code",
    autoFocus: true,
    autoComplete: "off",
  },
  CHOSEN_NAME,
  {
    key: "displayName",
    label: "Display Name",
    hint: "shown in the roster",
    placeholder: "for example, Harbor Master",
    maxLength: DISPLAY_NAME_MAX,
    optional: true,
  },
  CHOSEN_PASSWORD,
];

/** The console's own crest, above the form. */
function ConsoleHeader() {
  return (
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
  );
}

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
  return (
    <CredentialCard
      fields={{ login: SIGN_IN_FIELDS, register: REGISTER_FIELDS }}
      header={<ConsoleHeader />}
      notice={notice}
      onDismissNotice={onDismissNotice}
      onAuthed={onAuthed}
      submit={async (mode, values) => {
        if (mode === "register") {
          return api.adminRegister({
            username: values.username.trim(),
            password: values.password,
            displayName: values.displayName.trim() || undefined,
            setupCode: values.setupCode,
          });
        }
        const { token } = await api.login({
          username: values.username.trim(),
          password: values.password,
        });
        // The sign in answer carries the public captain only, so the role
        // is read separately. This is the authoritative read: /api/auth/me
        // refuses a banned account outright, which is also why an operator
        // banned from another console cannot get back in through here.
        const { user } = await api.me();
        if (!user || user.role !== "admin") throw new Error(NOT_AN_OPERATOR);
        return { user, token };
      }}
      labels={{ login: "Open the Console", register: "Create Operator" }}
      icons={{
        login: <ShieldCheck className="mr-2 h-4 w-4" />,
        register: <KeyRound className="mr-2 h-4 w-4" />,
      }}
      accent="pm-grad-admin"
      footer={
        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          Registration needs the setup code the server was configured with.
          Accounts created here are administrators.
        </p>
      }
    />
  );
}
