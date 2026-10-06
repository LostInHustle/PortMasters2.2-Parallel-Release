"use client";

// =====================================================================
// The balance dashboard: one page that answers whether the mode is
// healthy.
//
// [I3: the dashboard, and the front page number] The plan asks for a page
// somebody on balance duty can read in under a minute, and names the three
// questions it has to answer: is the Quartermaster seat healthy, is
// anything becoming a staple, and is the variance too swingy. The
// arithmetic is not here. src/lib/game/dashboard.ts reduces the window
// into a reading, the route behind /api/admin/balance fetches the window,
// and this file prints what it was handed without deciding anything of its
// own. That is what keeps the page and the command line report from ever
// disagreeing about a number: both ask the same reader, and neither
// re-derives what the reader already said.
//
// The front page is the strip at the top: the plan's front page number,
// the Barge revenue share, and then the three questions, each with the
// state it is in and the one line it can answer with. The panels below are
// the same three questions in detail plus the floor, and every row on them
// carries the gate it is judged against and the verdict, so a reader never
// has to hold a target in their head to know whether a number is good.
//
// [I4: the launch gates, and the three hundred voyage run] Above that strip
// sits the ship decision: the sixteen launch gates reduced by
// src/lib/game/gates.ts into one of three states, with the reasons behind
// it. The verdict is computed here rather than fetched, from the reading
// this page already holds, so the strip costs no second query and cannot
// be reading a different window than the panels below it.
//
// Read only, over REST, once on arrival and whenever Refresh is pressed.
// Nothing on this page subscribes to anything, so leaving it open cannot
// matter to a voyage that is under way.
// =====================================================================

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  DashboardPanel,
  DashboardReading,
  DashboardReadingLine,
  DashboardWindow,
  QuestionState,
  ReadingVerdict,
} from "@/lib/game/dashboard";
import {
  readLaunchVerdict,
  type LaunchState,
  type LaunchVerdict,
} from "@/lib/game/gates";
import { Notice, Pill, Th } from "@/components/portmasters/shared";
import { Gauge, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

// The three tones these chips draw from, by name. A reading's verdict is
// decided in one place (the arithmetic module), so all this file chooses is
// which of the meaning tones says it: an out of band gate is warn rather
// than alarm on purpose, because the mode has not shipped yet and a number
// outside its band is being watched rather than having broken. The three
// verdicts that are not judgements (no source, no gate, unplayed) take the
// quiet default, since none of them is a finding.
type ChipTone = "gain" | "warn" | "default";

const VERDICT: Record<ReadingVerdict, { tone: ChipTone; word: string }> = {
  in: { tone: "gain", word: "in gate" },
  under: { tone: "warn", word: "under" },
  over: { tone: "warn", word: "over" },
  unplayed: { tone: "default", word: "unplayed" },
  unmeasured: { tone: "default", word: "no source" },
  ungated: { tone: "default", word: "no gate" },
};

const STATE: Record<QuestionState, { tone: ChipTone; word: string }> = {
  clear: { tone: "gain", word: "inside the gates" },
  watch: { tone: "warn", word: "out of gate" },
  "no reading": { tone: "default", word: "no reading yet" },
};

// The ship decision's three states, in the same tones the readings under
// them use, so a held gate and the strip that says the mode is held are
// not two colours about one fact. Held is warn rather than alarm for the
// reason the out of band chips are: a mode that has not shipped is being
// watched, not broken.
const LAUNCH: Record<LaunchState, { tone: ChipTone; word: string }> = {
  clear: { tone: "gain", word: "clear to ship" },
  held: { tone: "warn", word: "held" },
  unjudged: { tone: "default", word: "no verdict yet" },
};

export function BalanceDashboard() {
  const [reading, setReading] = useState<DashboardReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The read runs in an effect and Refresh asks for another run, so the
  // counter is what a press moves: one place reads the window, and neither
  // the arrival nor the press owns a second copy of the fetch. `pending` is
  // what the button's own icon spins on, and it is the only state the press
  // sets, because the reading and the error are the effect's to write.
  const [nonce, setNonce] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const read = async () => {
      try {
        const answer = await api.adminBalance();
        if (cancelled) return;
        setReading(answer.reading);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "The reading could not be loaded.",
        );
      }
      setPending(false);
    };
    void read();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const subtitle =
    reading !== null
      ? windowLine(reading.window)
      : error !== null
        ? "The window could not be read."
        : "Reading the window...";

  return (
    <div className="pm-canvas min-h-screen">
      {/* The column, and the number every width decision below reads. The
          gutters live here rather than on the children, so the container
          measures the width the panels actually have, and a breakpoint
          read off the window instead would change the page's shape while
          the column it draws in stayed put.

          There is no cap. This page is a stack of panels, and a panel is a
          table with room to breathe: a window wider than the widest table
          wants is width the tables themselves can use. The layout steps
          below are read off this container, so the page takes a new shape
          when the panels have the room rather than when the window crosses
          a number, and the gutters grow with the window in one fluid step
          so the page keeps its margins without spending a fixed number of
          pixels on them. */}
      <div className="@container w-full px-[clamp(0.75rem,2.5vw,3rem)]">
        <header className="pb-2 pt-3">
          <div className="pm-glass pm-panel-bar">
            <div className="flex items-center gap-3">
              <div className="pm-seal pm-grad-admin">
                <Gauge className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-sm leading-tight font-bold tracking-tight">
                  Balance Dashboard
                </h1>
                <p className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">
                  {subtitle}
                </p>
              </div>
              <a
                href="/admin"
                className="pm-tool pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
                title="The operator console"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="hidden @md:inline">Console</span>
              </a>
              <button
                onClick={() => {
                  setPending(true);
                  setNonce((current) => current + 1);
                }}
                className="pm-tool pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
                title="Read the window again"
                aria-label="Read the window again"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span className="hidden @md:inline">Refresh</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex flex-col gap-3 pt-3 pb-10">
          {error && <Notice message={error} onDismiss={() => setError(null)} />}

          {reading === null && !error && (
            <div className="pm-glass flex items-center justify-center gap-2 rounded-2xl py-12 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading the window...
            </div>
          )}

          {reading && (
            <>
              {/* The ship decision first, because it is the question the run
                is for, then the front page below it. */}
              <LaunchStrip verdict={readLaunchVerdict(reading)} />

              {/* The front page: the plan's number first, then the three
                questions. A tile carries the state and the one sentence the
                panel below can say today, so the strip alone is the minute
                the evaluation asks for.
                Four across only where each tile clears its own name: four
                tiles need four times the ~17rem a tile reads at plus the
                gaps between them, which is 72rem of container, and below
                that the grid falls to two and then one. The steps read the
                column like every other width on this page, so the count
                changes when the tiles run out of room and not before. */}
              <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @6xl:grid-cols-4">
                <FrontNumber line={reading.frontPage} />
                {reading.panels
                  .filter((panel) => panel.question !== null)
                  .map((panel) => (
                    <FrontTile
                      key={panel.id}
                      title={panel.question ?? panel.title}
                      state={STATE[panel.state]}
                      answer={panel.answer}
                    />
                  ))}
              </div>

              {/* The panels, in as many columns as the column can carry.
                A panel is a card around a four column table, and that table
                needs about 46rem of panel before it would rather be the
                stacked rows a narrow panel falls back to, so two panels
                need 93rem of container and three need 140. A wall display
                lays the whole dashboard out in three columns; a laptop
                reads them one at a time at full width, which is how they
                were designed to be read. */}
              <div className="grid grid-cols-1 gap-3 @min-[93rem]:grid-cols-2 @min-[140rem]:grid-cols-3">
                {reading.panels.map((panel) => (
                  <Panel key={panel.id} panel={panel} />
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// The ship decision, over the sixteen gates the panels below carry. It is
// one strip rather than a panel because the answer is a sentence: the
// state, the run against the plan's floor, the gates by where they stand,
// and then every reason the verdict is not clear.
//
// Every word of it is the verdict's own. The chip, the answer, the tally
// and the gaps are all written by src/lib/game/gates.ts, which is what
// keeps this strip and the command line report that prints the same
// verdict from ever counting a gate two ways: neither surface adds up a
// number here, they both print what the reader said.
function LaunchStrip({ verdict }: { verdict: LaunchVerdict }) {
  const chip = LAUNCH[verdict.state];
  return (
    <section className="pm-glass overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
        <h2 className="font-display text-sm font-bold tracking-tight">
          Launch gates
        </h2>
        <Pill tone={chip.tone}>{chip.word}</Pill>
        <p className="w-full text-[11px] leading-relaxed text-muted-foreground">
          {verdict.answer}
        </p>
      </div>

      <div className="grid gap-x-6 gap-y-1 px-4 py-3 text-xs @xl:grid-cols-2">
        <p className="text-muted-foreground">
          Run{" "}
          <span className="tabular-nums text-foreground">
            {verdict.voyages} of {verdict.required}
          </span>{" "}
          recorded voyages
        </p>
        <p className="text-muted-foreground">{verdict.tally}</p>
      </div>

      <GapList gaps={verdict.gaps} />
    </section>
  );
}

/**
 * What a reading is waiting on, under the reading itself: the dashboard's
 * own sentences, handed to it by the server that measured them. Drawn
 * here rather than twice below, because the launch strip and every panel
 * say the same thing in the same voice and a second copy would be a
 * second voice the day one of them changed.
 *
 * Nothing to say and it draws nothing, which is the reading's own
 * statement rather than this list's: a reading with no gaps is one that
 * has everything it needs.
 */
function GapList({ gaps }: { gaps: string[] }) {
  if (gaps.length === 0) return null;
  return (
    <ul className="space-y-1.5 border-t border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
      {gaps.map((gap) => (
        <li
          key={gap}
          className="text-[11px] leading-relaxed text-muted-foreground"
        >
          {gap}
        </li>
      ))}
    </ul>
  );
}

// The plan's front page number, in the plan's own slot: the tile says what
// the number is, what it reads today and what it is judged against. Every
// part of it is taken from the line rather than written here, the chip
// included, which is what let the tile start reading a real share the day
// the Barge shipped without a line of this file changing, and what keeps it
// honest now that the number is reduced out of the leg reports: the plan
// sets no band on the share of food spending, so the chip reads measured
// rather than good or bad, and a window with no report in it still reads as
// nothing to read rather than as a zero.
//
// Only a judged reading gets the display size. A verdict that is not a
// judgement has no number to show, only a sentence about what is missing,
// and a sentence at display size is the page shouting an absence: those
// read at body size, in the quieter ink the rest of the page's prose uses.
// The size itself grows with the window rather than sitting at one value,
// because this is the one number the page is opened to find and a wall
// display has the room to say so.
function FrontNumber({ line }: { line: DashboardReadingLine }) {
  const chip = VERDICT[line.verdict];
  const judged =
    line.verdict === "in" ||
    line.verdict === "under" ||
    line.verdict === "over";
  return (
    <div className="pm-glass pm-tile flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xs leading-snug font-semibold">{line.label}</h2>
        {/* The chip keeps its width and the label wraps around it: a chip
            squeezed by a long question would rather break its own word. */}
        <Pill tone={chip.tone} className="shrink-0">
          {chip.word}
        </Pill>
      </div>
      {judged ? (
        <p className="font-display text-[clamp(1.25rem,1vw,1.75rem)] leading-none font-bold tracking-tight">
          {line.value}
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {line.value}
        </p>
      )}
      {/* The target rests on the tile's floor rather than under the value,
          so four tiles of different heights still put the one line every
          reader compares on one line. */}
      <p className="mt-auto text-[11px] leading-relaxed text-muted-foreground">
        {line.target}
      </p>
    </div>
  );
}

// One of the three questions, answered at a glance. The chip is the state
// and the sentence is the answer, which is what the plan asks the front
// page to do: read the top of this page and know where the mode stands
// without scrolling.
function FrontTile({
  title,
  state,
  answer,
}: {
  title: string;
  state: { tone: ChipTone; word: string };
  answer: string;
}) {
  return (
    <div className="pm-glass pm-tile flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xs leading-snug font-semibold">{title}</h2>
        <Pill tone={state.tone} className="shrink-0">
          {state.word}
        </Pill>
      </div>
      <p className="mt-auto text-[11px] leading-relaxed text-muted-foreground">
        {answer}
      </p>
    </div>
  );
}

// One panel: the question, its readings with the gate each is judged
// against, and what the panel cannot read. The answer line is repeated from
// the front page on purpose, because the strip is what a reader takes in
// first and the panel is where they check it, and a panel that opened
// without a verdict would be a table.
function Panel({ panel }: { panel: DashboardPanel }) {
  return (
    <section className="@container pm-glass overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
        <h2 className="font-display text-sm font-bold tracking-tight">
          {panel.title}
        </h2>
        <Pill tone={STATE[panel.state].tone}>{STATE[panel.state].word}</Pill>
        <p className="w-full text-[11px] leading-relaxed text-muted-foreground">
          {panel.answer}
        </p>
      </div>

      {/* A reading is four facts: what was measured, what it read, the gate
          it is judged against, and the verdict. A table carries all four in
          a line where the panel is wide enough for one, and a row per
          reading carries the same four stacked where it is not. The
          threshold is the panel's own width rather than the page's,
          because the panel is its own container: a panel narrower than
          46rem would rather stack than squeeze four columns, whatever the
          window around it is doing. The stacked form is not a smaller
          table: it keeps every fact, and it is what spares a reader on a
          phone the drag of 308 pixels sideways to find out whether a
          number passed. */}
      <div className="hidden @min-[46rem]:block pm-scroll overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {/* The four columns hold their proportions from panel to panel.
                Left to itself a table sizes its columns from whatever it
                happens to be carrying, and these panels carry different
                things: measured across them, the Gate column came out 291
                pixels wide on one panel and 135 on the next, and the
                Reading column starved to 237 on the panel with the longest
                Window lists while its neighbour ran 295, wrapping labels
                that fit on two lines next door onto four. The label is the
                one thing a reader scans first, so it gets a floor rather
                than whatever is left over.
                The shares are proportions of the panel's own width rather
                than fixed sizes: the same four numbers read at 736 pixels
                and at 1368, which is what keeps the columns in the same
                visual order at every width the panel is ever drawn at. A
                reading only has to hold four facts, and the shares are
                what its longest strings need to say them: Reading 32%,
                Window 28%, Gate 28%, Verdict 12%. */}
            <tr className="border-b border-black/[0.06] text-left dark:border-white/[0.08]">
              <Th className="w-[32%]">Reading</Th>
              <Th className="w-[28%] text-right">Window</Th>
              <Th className="w-[28%]">Gate</Th>
              <Th className="w-[12%] whitespace-nowrap text-right">Verdict</Th>
            </tr>
          </thead>
          <tbody>
            {panel.readings.map((line) => (
              <tr
                key={line.label}
                className="border-b border-black/[0.04] transition-colors last:border-0 hover:bg-black/[0.02] dark:border-white/[0.06] dark:hover:bg-white/[0.03]"
              >
                <td className="px-4 py-2.5 text-xs">{line.label}</td>
                <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                  {line.value}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {line.target}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <VerdictWord verdict={line.verdict} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* A reading as a row, in the shape every other row in this app
          wears: what the row is about on the first line with its status at
          the end of it, and the figures underneath.
          The first line is the whole width of the card on purpose. An
          earlier version laid the label out beside the value and the
          verdict, and on a phone that left the longest label on the page
          121 pixels to say "Distinct goods a hold closes a leg carrying,
          median" in: three lines, and the one reading whose name most
          needs reading was the one that was hardest to read. Given its own
          line it says the same words in two. */}
      <ul className="@min-[46rem]:hidden">
        {panel.readings.map((line) => (
          <li
            key={line.label}
            className="border-b border-black/[0.04] px-4 py-2.5 last:border-0 dark:border-white/[0.06]"
          >
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <p className="min-w-0 flex-1 text-xs">{line.label}</p>
              <VerdictWord verdict={line.verdict} />
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              <span className="tabular-nums text-foreground">{line.value}</span>{" "}
              · {line.target}
            </p>
          </li>
        ))}
      </ul>

      <GapList gaps={panel.gaps} />
    </section>
  );
}

// A verdict at row scale: a dot and the word, no chip. Forty chips down
// four tables turn the verdict column into a stripe of coloured lozenges,
// and a stripe is not a column anyone scans; the dot keeps the colour and
// lets the word sit on the row's own baseline. The full pill is kept for
// the three places a verdict is a headline rather than a detail: the
// launch strip, a panel's header and a front tile. The word and its tone
// still come from one map, so the dot, the word and the panel's chip can
// never come to different conclusions about the same reading.
function VerdictWord({ verdict }: { verdict: ReadingVerdict }) {
  const { tone, word } = VERDICT[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium ${
        tone === "gain"
          ? "text-gain"
          : tone === "warn"
            ? "text-warn"
            : "text-muted-foreground"
      }`}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
      />
      {word}
    </span>
  );
}

// The window in one line, under the title: how many voyages the page is
// reading, and anything about the window a reader has to know before
// trusting it. A sample rate below one and records that could not be read
// are qualifications rather than footnotes, so they sit in the header
// rather than in a gap at the bottom of a panel.
function windowLine(window: DashboardWindow): string {
  if (window.voyages === 0) {
    return "No Ocean Gambit voyage in the window yet: the panels below are the gates, and what each one waits on.";
  }
  const parts = [
    `${window.voyages} ${window.voyages === 1 ? "voyage" : "voyages"}, ${window.captains} captains.`,
  ];
  if (window.sampleRate < 1) {
    parts.push(
      window.sampleRate > 0
        ? `Recorded at a sample rate of ${Math.round(window.sampleRate * 100)}%.`
        : "Nothing in this window was recorded: the sampler was off.",
    );
  }
  if (window.truncated > 0) {
    parts.push(`${window.truncated} hit the event cap.`);
  }
  if (window.unreadable > 0) {
    parts.push(`${window.unreadable} could not be read.`);
  }
  return parts.join(" ");
}
