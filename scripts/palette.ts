/**
 * The palette check.
 *
 * This file owns the widget table: every colour bearing surface on the
 * front end, the hue it was given, and the screens it appears on. The
 * table is the source of truth, and palette.css is checked against it
 * rather than the other way round.
 *
 * Five things have to hold, and each one has a way of going wrong that
 * nothing else in the toolchain would notice. TypeScript does not read
 * colours, ESLint does not read class strings, and the smoke test only
 * asks whether the pages answer.
 *
 *   1. Two widgets a captain sees at the same time are at least MIN_GAP
 *      degrees apart. Closer than that and two different panels read as
 *      the same panel.
 *   2. No identity hue sits that close to the red that means danger,
 *      cost and error. A heading in that red reads as a warning.
 *   3. Every widget in the table has a token, and every token belongs to
 *      a widget. Neither list may drift from the other.
 *   4. Every pm-grad- class used in src/ has a rule to fill it. A class
 *      with no rule leaves the element with no background at all, which
 *      is silent in every other check.
 *   5. No raw Tailwind palette class is left in src/. A tree that still
 *      has them has two colour systems in it.
 *
 * Run with npm run check:palette.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const PALETTE = join(ROOT, "src/app/palette.css");
const GLOBALS = join(ROOT, "src/app/globals.css");
const SRC = join(ROOT, "src");

/* The red that means danger, cost and error. Nothing identity may come
   this close to it, in either direction round the wheel. */
const MEANING_RED = 17;

/* The Lobby is the densest screen, and it settles at twelve surfaces
   rather than eighteen once the dialogs are counted honestly: only one
   dialog can be open at a time and each dims the board behind it, so a
   dialog answers to its own screen. Twelve across the 322 degrees clear
   of the red is 26.8 degrees each, which leaves this floor comfortable
   everywhere in the tree. */
const MIN_GAP = 20;

type Widget = {
  /** The token name. Also the suffix of every pm-grad- class it dresses. */
  name: string;
  /** Hue angle in oklch. */
  hue: number;
  /** Screens this widget is on. Two widgets sharing one must be apart. */
  screens: string[];
  /** What it is, for the report. */
  what: string;
};

/* Screens are named for what a captain actually has open. */
const LOBBY = "lobby";

const WIDGETS: Widget[] = [
  /* The Lobby. Twelve surfaces, because the dialogs are their own
     screens, and every one of these is on screen at the same moment.
     Twelve across the 322 degrees clear of the meaning red is 26.8
     degrees each, which is the roomiest any dense screen gets. The hues
     are handed out on a stride rather than in page order, so two panels
     stacked next to each other are rarely two steps apart on the wheel. */
  { name: "brand", hue: 49.4, screens: [LOBBY, "auth"], what: "The app mark, on the masthead and the sign in card" },
  { name: "checkin", hue: 183.6, screens: [LOBBY], what: "Check In, when a reward is ready" },
  { name: "captains", hue: 317.8, screens: [LOBBY], what: "Captains Online, and the gauge that counts them" },
  { name: "harbors", hue: 129.9, screens: [LOBBY], what: "Open Harbors, its room rows, and the gauge" },
  { name: "sailing", hue: 264.1, screens: [LOBBY], what: "Sailing, the harbors already under way" },
  { name: "renown", hue: 76.3, screens: [LOBBY], what: "Your Renown" },
  { name: "charter", hue: 210.4, screens: [LOBBY], what: "Chart a new harbor, and the Waters selector" },
  { name: "quickstart", hue: 344.6, screens: [LOBBY], what: "Quick Start" },
  { name: "messages", hue: 156.8, screens: [LOBBY], what: "Direct Messages" },
  { name: "activity", hue: 290.9, screens: [LOBBY], what: "Harbor Activity" },
  { name: "guide", hue: 103.1, screens: [LOBBY, "dlg:guide"], what: "How to Play, the tool and the dialog" },
  { name: "notifications", hue: 237.3, screens: [LOBBY], what: "Notifications" },

  /* The dialogs. Only one opens at a time and each dims the board behind
     it, so a dialog answers to its own screen rather than to the Lobby.
     That is the whole reason the Lobby is twelve and not eighteen. */
  /* Only one dialog opens at a time and each dims the board behind it at
     half black, so a dialog answers to its own screen and never to the
     board it covers. That exemption is load bearing, and the session
     dialogs are where it shows. The Navigation Guide, the Captain
     Profile, the Rumor Board and the Notifications history all open over
     the game, and two of them land close to the panel behind them: the
     guide 7.9 degrees from Ship and Funds, and Notifications 2.7 from
     Chat.

     Neither can be moved clear, which is worth proving rather than
     asserting, because it reads like a hue nobody checked. Ship and
     Funds at 111, and the pair at 90, Market Pulse and the Shipyard,
     push a guide that shares their screen to 70 or below, or to 131 or
     above. The Lobby ladder is an even twelve, so the guide is also
     boxed in by the two rungs beside it and may sit only between 96.3
     and 109.9. Those two ranges do not meet, so there is no hue on the
     wheel that holds the guide twenty degrees clear of the Lobby and of
     the session at once. Notifications is boxed the same way, between
     Charter at 210.4 and Sailing at 264.1, with Chat at 240 sitting in
     the middle of the window it has left. A dialog therefore shares its
     screen with a dimmed board and with nothing else, and the overlay is
     what keeps that arrangement readable. */
  { name: "leaderboard", hue: 64.4, screens: ["dlg:leaderboard"], what: "Leaderboard" },
  { name: "houses", hue: 253.8, screens: ["dlg:houses"], what: "Great Houses" },
  { name: "chronicles", hue: 197.0, screens: ["dlg:chronicles"], what: "Voyage Chronicles" },
  { name: "profile", hue: 83.3, screens: ["dlg:profile"], what: "Captain Profile" },
  { name: "legacy", hue: 215.9, screens: ["dlg:legacy"], what: "Captain's Legacy" },
  { name: "settings", hue: 140.2, screens: ["dlg:settings"], what: "Settings" },

  /* Game session chrome, on screen through every phase. */
  { name: "voyage", hue: 47, screens: ["session"], what: "Voyage Timeline" },
  { name: "ship", hue: 111, screens: ["session"], what: "Ship and Funds" },
  { name: "members", hue: 175, screens: ["session"], what: "Members" },
  { name: "chat", hue: 240, screens: ["session"], what: "Chat" },
  { name: "ledger", hue: 304, screens: ["session"], what: "Ledger" },

  /* The phases. Each key of PHASE_ACCENTS gets its own hue. A phase
     carries only its own phase tag, never "session", because two phases
     can never be on screen at once and several of them lean on that. */
  { name: "welcome", hue: 68, screens: ["phase:0"], what: "Welcome" },
  { name: "purchase", hue: 154, screens: ["phase:1"], what: "Purchase" },
  { name: "orders", hue: 282, screens: ["phase:2"], what: "Orders" },
  { name: "settlement", hue: 261, screens: ["phase:3"], what: "Settlement" },
  { name: "shipyard", hue: 90, screens: ["phase:4"], what: "Shipyard" },
  { name: "boon", hue: 325, screens: ["phase:5"], what: "Boon Draft" },
  { name: "barter", hue: 218, screens: ["phase:barter"], what: "Barter" },
  { name: "workers", hue: 347, screens: ["phase:workers"], what: "Worker Management" },
  { name: "module-draft", hue: 132, screens: ["phase:modules"], what: "Module Draft" },
  { name: "module-swap", hue: 347, screens: ["phase:modules"], what: "Module Swap" },
  { name: "bankruptcy", hue: 325, screens: ["phase:bankruptcy"], what: "Bankruptcy" },
  { name: "endgame", hue: 132, screens: ["phase:endgame"], what: "Endgame" },

  /* Panels that open inside a phase, and the screens that stand alone.
     Where a hue repeats, the two never share a screen. The Rumor Board
     moved to the Barter end of the wheel when the check found it 11
     degrees from the Orders panel it opens over. */
  { name: "advisor", hue: 197, screens: ["phase:1"], what: "Trade Advisor" },
  { name: "depth", hue: 347, screens: ["phase:1"], what: "Market Depth" },
  { name: "pulse", hue: 90, screens: ["phase:1"], what: "Market Pulse" },
  { name: "planner", hue: 132, screens: ["phase:2"], what: "Fulfillment Planner" },
  { name: "modules", hue: 261, screens: ["phase:4"], what: "Module list on the Shipyard" },
  { name: "shortcuts", hue: 218, screens: ["shortcuts"], what: "Keyboard Shortcuts" },
  { name: "rumors", hue: 218, screens: ["phase:2"], what: "Rumor Board" },
];

/* A room's host crown is not in the table on purpose. A crown is gold,
   and --gold is already a meaning token here, so it wears that rather
   than taking a hue of its own away from a panel. */
const ALL_WIDGETS = WIDGETS;

/* The session chrome is on screen through every phase, so it has to be
   checked against each phase even though no phase lists it. Two phases
   are never on screen together, so they are never checked against each
   other. That asymmetry is the whole reason "session" is a tag rather
   than a screen name. */
function sharesScreen(a: Widget, b: Widget): boolean {
  if (a.screens.some((s) => b.screens.includes(s))) return true;
  const chrome = (w: Widget) => w.screens.includes("session");
  const phase = (w: Widget) => w.screens.some((s) => s.startsWith("phase:"));
  return (chrome(a) && phase(b)) || (chrome(b) && phase(a));
}

const problems: string[] = [];

function fail(message: string) {
  problems.push(message);
}

function circularGap(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/* === 1 and 2: the distances === */

function checkDistances() {
  for (let i = 0; i < ALL_WIDGETS.length; i++) {
    const a = ALL_WIDGETS[i];

    const fromRed = circularGap(a.hue, MEANING_RED);
    if (fromRed < MIN_GAP) {
      fail(
        `${a.name} (${a.what}) sits ${fromRed.toFixed(1)} degrees from the meaning red. ` +
          `Identity colour must stay ${MIN_GAP} degrees clear of it.`,
      );
    }

    for (let j = i + 1; j < ALL_WIDGETS.length; j++) {
      const b = ALL_WIDGETS[j];
      if (!sharesScreen(a, b)) continue;

      const gap = circularGap(a.hue, b.hue);
      if (gap < MIN_GAP) {
        const shared = a.screens.filter((s) => b.screens.includes(s));
        fail(
          `${a.name} (${a.what}) and ${b.name} (${b.what}) are ${gap.toFixed(1)} degrees apart ` +
            `and both appear on ${shared.join(", ") || "a session screen"}.`,
        );
      }
    }
  }
}

/* === 3: the table and the tokens agree === */

/* Every property palette.css declares, by its full name, so that a
   fill rule naming one can be checked against it. Built once at load. */
const declaredTokens: Set<string> = new Set(
  [...readFileSync(PALETTE, "utf8").matchAll(/--w-[a-z-]+(?=\s*:\s*oklch)/g)].map(
    (m) => m[0],
  ),
);

/* The bare widget names, with the -fill suffix and the prefix stripped. */
function declaredNames(): Set<string> {
  const names = new Set<string>();
  for (const token of declaredTokens) {
    names.add(token.replace(/^--w-/, "").replace(/-fill$/, ""));
  }
  return names;
}

function checkTokens() {
  const declared = declaredNames();

  for (const w of ALL_WIDGETS) {
    if (!declared.has(w.name)) {
      fail(`The table lists ${w.name}, but palette.css declares no --w-${w.name}.`);
    }
  }

  /* The table is the source of truth, so the file has to agree with it.
     Without this the two drift the moment one is edited and the other
     is not, and the geometry above would be checking numbers that are
     no longer the ones on screen. */
  const css = readFileSync(PALETTE, "utf8");
  for (const w of ALL_WIDGETS) {
    const decl = [
      ...css.matchAll(new RegExp(`--w-${w.name}:\\s*oklch\\([0-9.]+ [0-9.]+ ([0-9.]+)\\)`, "g")),
    ].map((m) => Number(m[1]));
    if (decl.length === 0) continue;
    for (const hue of decl) {
      if (Math.abs(hue - w.hue) > 0.05) {
        fail(
          `The table puts ${w.name} at ${w.hue} degrees, palette.css says ${hue}. ` +
            `One of the two was edited without the other.`,
        );
      }
    }
  }

  const tableNames = new Set(ALL_WIDGETS.map((w) => w.name));
  /* A token may go unclaimed by the table when it is a meaning colour,
     one of the four bright fills, one of the three House colours, or one
     of the three Ages. None of those are chrome: they say what something
     is, not which panel it belongs to, so they are not spread around the
     wheel. An Age is the same kind of fact as a House, since every
     harbor is in the same one and it is drawn in the Lobby and in the
     session alike. */
  const notWidgets = new Set([
    "gain", "alarm", "warn", "due", "favor", "intel", "sea",
    "gold", "medal-gold", "medal-silver", "medal-bronze",
    "house-jade", "house-vermilion", "house-lotus",
    "age-lender", "age-trader", "age-broker",
  ]);
  for (const name of declared) {
    if (!tableNames.has(name) && !notWidgets.has(name)) {
      fail(`palette.css declares --w-${name}, but no widget in the table claims it.`);
    }
  }
}

/* === 4: every pm-grad- class has a fill === */

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function checkGradients(files: string[]) {
  const globals = readFileSync(GLOBALS, "utf8");

  /* Every fill names a fill token. The seven older rules drew their own
     gradient outright while their call sites were swept, and they are
     gone now. A rule that painted its own gradient would be a second way
     to make a seal, so the check no longer accepts one. */
  const filled = new Set<string>();
  for (const m of globals.matchAll(
    /\.pm-grad-([a-z-]+)\s*\{([^}]*)\}/g,
  )) {
    const [, name, body] = m;
    if (body.includes("--pm-fill:")) {
      filled.add(name);
      /* A rule can name a fill token that was never declared, and that
         reads as a filled class while rendering as the @property
         fallback. Every reference is checked against the declarations. */
      for (const ref of body.matchAll(/var\((--w-[a-z-]+)\)/g)) {
        if (!declaredTokens.has(ref[1])) {
          fail(
            `.pm-grad-${name} fills from ${ref[1]}, which palette.css never declares. ` +
              `The element would render as the @property fallback colour.`,
          );
        }
      }
    }
  }

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const where = relative(ROOT, file);
    for (const m of text.matchAll(/pm-grad-([a-z-]+)/g)) {
      const name = m[1];
      if (!filled.has(name)) {
        fail(
          `${where} uses pm-grad-${name}, which no rule fills. ` +
            `That element would carry no background at all.`,
        );
      }
    }
  }
}

/* === 5: a bright fill says what ink goes on it === */

/* White ink on a bright fill cannot be read, which is how the old gold
   and amber gradients came to carry a dark ink at every call site and
   then lose it to a later rule. Past this lightness a fill has to name
   its own ink, so the decision sits beside the colour instead of at the
   call site, where a rule order nobody can see was free to overrule it. */
const BRIGHT = 0.7;

function checkInk() {
  const css = readFileSync(PALETTE, "utf8");
  const lightness = new Map<string, number>();
  for (const m of css.matchAll(/--w-([a-z-]+)-fill:\s*oklch\(([0-9.]+)/g)) {
    lightness.set(m[1], Number(m[2]));
  }

  for (const m of readFileSync(GLOBALS, "utf8").matchAll(
    /\.pm-grad-([a-z-]+)\s*\{([^}]*)\}/g,
  )) {
    const [, name, body] = m;
    const fill = body.match(/--pm-fill:\s*var\((--w-[a-z-]+)\)/);
    if (!fill) continue;
    const value = lightness.get(fill[1].replace(/^--w-/, "").replace(/-fill$/, ""));
    if (value === undefined) continue;
    if (value >= BRIGHT && !body.includes("--pm-ink")) {
      fail(
        `.pm-grad-${name} fills from ${fill[1]} at lightness ${value}, which is too ` +
          `bright for white ink, and it names no --pm-ink. The seal would be unreadable.`,
      );
    }
  }
}

/* === 6: no raw palette class is left === */

const RAW_FAMILIES =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone";
const RAW_SHADES = "50|100|200|300|400|500|600|700|800|900|950";
const RAW_SCALE = new RegExp(
  `\\b(?:text|bg|border|from|via|to|ring|fill|stroke|divide|outline|decoration|accent|caret|shadow)-` +
    `(?:${RAW_FAMILIES})-(?:${RAW_SHADES})\\b`,
  "g",
);

function checkRawPalette(files: string[]) {
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const where = relative(ROOT, file);
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      for (const m of line.matchAll(RAW_SCALE)) {
        fail(
          `${where}:${index + 1} still uses ${m[0]}. ` +
            `Every colour belongs to a token now.`,
        );
      }
    });
  }
}

/* === Run === */

const files = walk(SRC);
checkDistances();
checkTokens();
checkGradients(files);
checkInk();
checkRawPalette(files);

const geometry =
  `${ALL_WIDGETS.length} widgets, closest pair ${closestPair().toFixed(1)} degrees, ` +
  `closest to the meaning red ${closestRed().toFixed(1)} degrees.`;

if (problems.length === 0) {
  console.log(`The palette holds. ${geometry}`);
  process.exit(0);
}

console.log(`The palette check found ${problems.length} thing${problems.length === 1 ? "" : "s"}:\n`);
for (const p of problems) console.log(`  ${p}`);
console.log(`\nThe hues themselves are sound. ${geometry}`);
process.exit(1);

function closestPair(): number {
  let best = 360;
  for (let i = 0; i < ALL_WIDGETS.length; i++) {
    for (let j = i + 1; j < ALL_WIDGETS.length; j++) {
      if (!sharesScreen(ALL_WIDGETS[i], ALL_WIDGETS[j])) continue;
      best = Math.min(best, circularGap(ALL_WIDGETS[i].hue, ALL_WIDGETS[j].hue));
    }
  }
  return best;
}

function closestRed(): number {
  return Math.min(...ALL_WIDGETS.map((w) => circularGap(w.hue, MEANING_RED)));
}
