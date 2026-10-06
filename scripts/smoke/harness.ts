// =====================================================================
// PortMasters 2.2 Parallel Release: the harness of the smoke suite.
//
// The server under test, the accounts the run signs up, the socket it opens
// and the bookkeeping every check reports through. One suite file per article
// of the run lives beside this one and imports from it.
// =====================================================================
import { loadServerConfig } from "@/lib/config";
import type { GameMode } from "@/lib/game/mode";
import type { GameState } from "@/lib/game/types";
import { createInitialGameState } from "@/lib/game/types";
import { SOCKET_PATH } from "@/lib/realtime-endpoint";
import { UNLOCKS } from "@/lib/unlock";
import type { Captain, WireAccount, WireRoster } from "./wire";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Socket } from "socket.io-client";
import { connect } from "socket.io-client";

export const BASE =
  process.env.SMOKE_BASE_URL ?? `http://localhost:${loadServerConfig().port}`;

export const suffix = Math.random().toString(36).slice(2, 8);

export const password = "smoke-test-password";

export const failures: string[] = [];

/**
 * Whether a string carries a dash of any kind: an en dash, an em dash, or a
 * doubled hyphen. The house rule for every line a captain reads, and the
 * one rule a regex can hold this file to.
 *
 * The two dash characters are built from their code points and the doubled
 * hyphen is spelled as a quantifier, so that the check which keeps those
 * sequences out of the tree does not keep a copy of them in it. Both halves
 * are deliberate. An escape sequence would do the same job at runtime and
 * stop doing it the moment this file makes another pass through a layer
 * that resolves escapes, which is exactly how the manifest line's own check
 * came to carry the characters it was written to forbid.
 */
export const CARRIES_A_DASH = new RegExp(
  `[${String.fromCharCode(0x2013, 0x2014)}]|-{2}`,
);

/**
 * The stricter house rule for the words a mode hands a captain: no hyphen
 * of any kind, single or doubled, beside the two dash characters the rest
 * of the tree is held to.
 *
 * A second expression rather than a widening of the first, because the two
 * rules answer different questions. The tree wide rule is about typography
 * (a doubled hyphen standing in for an em dash), and it cannot be widened:
 * `--` is how a CSS custom property is read, so every `var(--w-dawn)` in
 * the tree would fail it. This one is about a mode's prose, where a hyphen
 * has no work to do.
 */
export const CARRIES_A_HYPHEN = new RegExp(
  `[-${String.fromCharCode(0x2013, 0x2014)}]|-{2}`,
);

/**
 * Every source file under a directory, for a check whose claim is about
 * the tree rather than about a file.
 *
 * Here rather than inside the check that first needed it, because a second
 * feature needed one too and a second copy of a directory walk is how two
 * scans of the same tree end up reading different files. Read only, and
 * only .ts and .tsx: the claim every caller makes is about source.
 */
export function walkSrc(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkSrc(full));
      continue;
    }
    if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * The same rule, read off a file rather than off a claim about it. Whole
 * files rather than the strings a captain reads, because the directive
 * asks the comments to hold it too, and every file named here is read by
 * whoever maintains the record next.
 *
 * The path is relative to this script's own directory rather than to the
 * working directory, so the check holds wherever the suite is run from.
 *
 * A path that names a directory is read as all of it, for the file that
 * became one: when a single file is split into a directory of modules, the
 * rule has to follow the shapes rather than the path they used to share,
 * and a check that read one of the new modules would pass while the rest
 * carried a dash.
 */
export function carriesADash(relative: string): boolean {
  const full = join(import.meta.dirname, "..", "..", relative);
  const files = statSync(full).isDirectory() ? walkSrc(full) : [full];
  return files.some((file) => CARRIES_A_DASH.test(readFileSync(file, "utf8")));
}

/**
 * A component's source with its comments taken out, for a check about what
 * a screen prints rather than about what its file says.
 *
 * The two are different on purpose in this tree: a comment here quotes the
 * sentence it replaced, because that is what makes a repair readable a year
 * later, so a check that read the raw file would fail on the note that
 * explains the fix. Only the shapes this tree actually writes are stripped,
 * which makes this the codebase's own convention rather than a parser: a
 * JSX comment, a block comment, and a line whose first characters are two
 * slashes. A URL inside a string survives all three, since none of them
 * matches a line that begins with anything else.
 */
export function withoutComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

/**
 * Runs a read with one environment switch set, and always puts the switch
 * back the way it found it, including when the read throws: a leaked value
 * would make every check after this one read a build the operator did not
 * ask for.
 *
 * One helper rather than one per feature, because the survival layer is
 * two switches over one family (the Larder in C1, crew loss in C2) and a
 * second copy of this try/finally is how one of them ends up restoring the
 * wrong value. The variable name is passed in rather than closed over for
 * the same reason: the check that reads a switch has to name the one it is
 * actually testing.
 */
// The two harbors a switch is read in, named once each.
//
// Every switch this release added is Gambit's, so the feature blocks below
// read them in Gambit: a check that held a switch on in the shipped mode
// would be checking that a Classic table received a system the mode does
// not have, which is the bug the mode boundary exists to prevent rather
// than the behaviour any of them are about. CLASSIC is read by the one
// block that holds the boundary itself, at the end of the family.
export const GAMBIT: GameMode = "ocean_gambit";

export const CLASSIC: GameMode = "classic";

// One switch, read in one mode, as a thunk withEnv can hand an environment
// value to. The mode is bound here rather than written at each of the forty
// odd call sites below, which is the same reason the switch itself takes it
// as an argument: one place to get the reading right.
export function switchFor(
  mode: GameMode,
  read: (mode: unknown) => boolean,
): () => boolean {
  return () => read(mode);
}

// A voyage of the mode the switches below belong to, which is the fixture
// every one of them is read against.
//
// It is a helper rather than a `mode` argument written out at each of the
// seventy odd call sites for the reason the switch's own reading is: one
// place to get it right. The failure it prevents is specific and it is the
// one this boundary makes possible, which is a check that reads a Classic
// state while claiming to read a switch. Every one of the nine layers is
// off in the founding mode whatever the environment says, so a fixture
// built without a mode measures the boundary and reports it as the rule
// under test: the layer would look switched off when it was merely outside
// its mode, and the check would pass for a reason that has nothing to do
// with what it says.
//
// An explicit `mode` in the init still wins, because the spread puts it
// last, which is what lets the couple of checks that compare the two modes
// build both of them through this one helper.
export function voyageState(
  init: Parameters<typeof createInitialGameState>[0] = {},
): GameState {
  return createInitialGameState({ mode: GAMBIT, ...init });
}

export function withEnv<T>(
  name: string,
  value: string | undefined,
  read: () => T,
): T {
  const was = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return read();
  } finally {
    if (was === undefined) delete process.env[name];
    else process.env[name] = was;
  }
}

// [H9: the unlock code] The phrase every sealed harbor in this file is
// opened with, read out of the table rather than typed here. A suite that
// spelled the words itself would be testing its own copy of them rather
// than the one a host types, and would go on passing after the table had
// moved to something else.
export const LEDGER_PHRASE = UNLOCKS.second_ledger.phrase;

// The manual the repo ships, read from this file's own directory rather
// than from the working directory, so the checks that hold the manual to
// the table pass wherever this suite is run from.
export const MANUAL = readFileSync(
  join(import.meta.dirname, "..", "..", "README.md"),
  "utf8",
);

export function check(condition: boolean, description: string): void {
  if (condition) {
    console.log(`  ok    ${description}`);
    return;
  }
  console.log(`  FAIL  ${description}`);
  failures.push(description);
}

export async function call<T>(
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Promise<{ status: number; body: T }> {
  const { cookie, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(rest.headers ?? {}),
    },
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

function cookieFrom(res: Response): string {
  const raw = res.headers.getSetCookie?.() ?? [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

/**
 * Registers a captain and keeps the token and cookie the app hands back.
 *
 * The label has a short leash: a username is capped at 20 characters and
 * this builds `smoke_<label>_<6 random>`, so a label longer than seven
 * characters is refused by the server rather than by anything here.
 */
export async function signUp(label: string): Promise<Captain> {
  const username = `smoke_${label}_${suffix}`;
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      displayName: `Smoke ${label}`,
    }),
  });
  const text = await res.text();
  if (res.status !== 200) {
    throw new Error(`Could not register ${username}: ${res.status} ${text}`);
  }
  const body = JSON.parse(text) as { user: { id: string }; token: string };
  return {
    id: body.user.id,
    token: body.token,
    cookie: cookieFrom(res),
    username,
  };
}

/**
 * Asks the realtime layer for a Quick Start seat and resolves with the
 * harbor it hands back, or null if no answer arrives.
 *
 * The emit is the actual queue request. A REST call cannot make it,
 * because the queue lives in the realtime layer's memory and a route
 * handler runs in a different bundle with its own empty copy of it.
 */
export function requestQuickMatch(
  socket: Socket,
  difficulty: string,
): Promise<{ roomId: string } | null> {
  return new Promise((resolve) => {
    const onMatched = (data: { roomId: string }) => {
      clearTimeout(timer);
      socket.off("quickstart:matched", onMatched);
      socket.off("quickstart:error", onError);
      resolve(data);
    };
    const onError = () => {
      clearTimeout(timer);
      socket.off("quickstart:matched", onMatched);
      socket.off("quickstart:error", onError);
      resolve(null);
    };
    const timer = setTimeout(() => {
      socket.off("quickstart:matched", onMatched);
      socket.off("quickstart:error", onError);
      resolve(null);
    }, 12000);
    socket.on("quickstart:matched", onMatched);
    socket.on("quickstart:error", onError);
    socket.emit("quickstart:join", { difficulty });
  });
}

/**
 * Waits for one socket event, optionally only accepting payloads a
 * predicate agrees with, and resolves null if nothing arrives in time.
 */
export function waitForEvent<T>(
  socket: Socket,
  event: string,
  match?: (payload: T) => boolean,
  timeoutMs = 8000,
): Promise<T | null> {
  return new Promise((resolve) => {
    const onEvent = (payload: T) => {
      if (match && !match(payload)) return;
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      resolve(null);
    }, timeoutMs);
    socket.on(event, onEvent);
  });
}

/** Opens a socket, authenticates it, and resolves once the server says yes. */
export function openAuthedSocket(captain: Captain): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(BASE, {
      path: SOCKET_PATH,
      transports: ["websocket"],
      extraHeaders: { Cookie: captain.cookie },
      reconnection: false,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`Socket for ${captain.username} never authenticated.`));
    }, 10000);

    socket.on("connect", () => socket.emit("auth", { token: captain.token }));
    socket.on("auth:ok", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on("auth:fail", (payload: { error?: string }) => {
      clearTimeout(timer);
      socket.close();
      reject(new Error(`Socket auth refused: ${payload?.error ?? "unknown"}`));
    });
    socket.on("connect_error", (err: Error) => {
      clearTimeout(timer);
      socket.close();
      reject(err);
    });
  });
}

/**
 * [J1: the private information review] The shapes a hidden field takes on
 * the wire, and the sweep that reads for them.
 *
 * The private information sections used to look for the one hidden card's
 * role word. They now look for every shape a secret can be carried in:
 * an alignment, a personal goal, and a Pirate's ally, on every socket in
 * the harbor, with a card the only frame allowed to carry one.
 *
 * Fields rather than bare words, and each one matched with the value it
 * would have to hold. The mode's public copy names its own roles, and an
 * account row carries a role of "captain" or "admin", so a sweep that
 * searched for the word would report a guide and a roster as leaks and
 * would have to be narrowed until it stopped meaning anything. What a
 * leak actually looks like is a field: "role" with one of the three
 * alignments in it, a "flourish" id, or an "ally" object.
 *
 * The last shape is the alignment as a value under any name at all,
 * because the three above it are only as good as the field names this
 * tree happens to use. A payload that smuggled "pirate" under a key
 * called anything else would pass all three, and the word itself is
 * something no broadcast in these harbors has any reason to carry.
 *
 * Every shape carries a sample frame it must match, checked once before
 * any of it is pointed at a harbor, because a pattern that matches
 * nothing is a gate that cannot fail.
 */
export const HIDDEN_FIELD_SHAPES = [
  {
    label: "a role field",
    pattern: /"role"\s*:\s*"(honest|pirate|broker)"/,
    sample: '{"role":"pirate"}',
  },
  {
    label: "a flourish field",
    pattern: /"flourish"\s*:\s*"/,
    sample: '{"flourish":"keep-the-cordage-dry"}',
  },
  {
    label: "an ally field",
    pattern: /"ally"\s*:\s*\{/,
    sample: '{"ally":{"userId":"one","name":"Two"}}',
  },
  {
    label: "an alignment under another name",
    pattern: /"(honest|pirate|broker)"/,
    sample: '{"mystery":"broker"}',
  },
];

/**
 * The hidden fields one socket's frames carry outside a card. A card is
 * the one frame allowed to hold any of them, and the checks that read a
 * dealt card back against the row it came from are what prove the values
 * in it belong to the captain holding it. Everything else on the wire is
 * a broadcast, and a broadcast carrying one of these is the defect the
 * private information sections exist to catch.
 */
export function leakedHiddenFields(
  frames: readonly { event: string; text: string }[],
): string[] {
  const found: string[] = [];
  for (const frame of frames) {
    if (frame.event === "private:entry") continue;
    for (const shape of HIDDEN_FIELD_SHAPES) {
      if (shape.pattern.test(frame.text)) {
        found.push(`${frame.event} carries ${shape.label}`);
      }
    }
  }
  return found;
}

/**
 * Registers an operator through /api/admin/register. Separate from signUp
 * because this route takes the setup code and is the only way an account
 * with the administrator role comes into being.
 *
 * A refused setup code is an answer rather than an error here, since that
 * is one of the things the caller is checking for. Any other answer is
 * neither: it means the request itself was wrong, so it throws with the
 * server's own words rather than being reported as a refused code.
 */
export async function registerOperator(
  label: string,
  setupCode: string,
): Promise<{
  status: number;
  error: string | null;
  role: string | null;
  captain: Captain | null;
}> {
  const username = `smoke_${label}_${suffix}`;
  const res = await fetch(`${BASE}/api/admin/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      displayName: `Smoke ${label}`,
      setupCode,
    }),
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as { error?: string }) : {};
  if (res.status === 403) {
    return {
      status: res.status,
      error: body.error ?? null,
      role: null,
      captain: null,
    };
  }
  if (res.status !== 200) {
    throw new Error(
      `The operator route answered ${res.status}: ${body.error ?? text}`,
    );
  }
  const made = JSON.parse(text) as {
    user: { id: string; role: string };
    token: string;
  };
  return {
    status: res.status,
    error: null,
    role: made.user.role,
    captain: {
      id: made.user.id,
      token: made.token,
      cookie: cookieFrom(res),
      username,
    },
  };
}

/** Signs an existing account in and hands back the session it made. */
export async function signInAgain(
  username: string,
): Promise<{ cookie: string; token: string } | null> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (res.status !== 200) return null;
  const body = JSON.parse(await res.text()) as { token: string };
  return { cookie: cookieFrom(res), token: body.token };
}

/** One row out of a roster, or undefined when the account is not on it. */
export function accountIn(
  roster: WireRoster | null,
  userId: string,
): WireAccount | undefined {
  return roster?.accounts.find((a) => a.id === userId);
}
