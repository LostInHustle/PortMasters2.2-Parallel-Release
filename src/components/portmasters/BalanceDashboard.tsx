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
      <header className="px-4 pb-2 pt-3 sm:px-6">
        <div className="pm-glass pm-panel-bar mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            <div className="pm-seal pm-grad-admin">
              <Gauge className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-sm leading-tight font-bold tracking-tight">
                Balance Dashboard
              </h1>
              <p className="pm-truncate text-[11px] leading-tight text-muted-foreground">
                {subtitle}
              </p>
            </div>
            <a
              href="/admin"
              className="pm-tool pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
              title="The operator console"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Console</span>
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
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-3 px-4 pt-3 pb-10 sm:px-6">
        {error && <Notice message={error} onDismiss={() => setError(null)} />}

        {reading === null && !error && (
          <div className="pm-glass pm-tile flex items-center justify-center gap-2 text-xs text-muted-foreground">
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
                the evaluation asks for. */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

            {reading.panels.map((panel) => (
              <Panel key={panel.id} panel={panel} />
            ))}
          </>
        )}
      </main>
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

      <div className="grid gap-x-6 gap-y-1 px-4 py-3 text-xs sm:grid-cols-2">
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
// the number is, what it reads today and what it waits on, which is the
// whole of what can be said about a gate whose epic is unbuilt. Every part
// of it is taken from the line rather than written here, the chip included,
// which is what keeps the tile from going on saying "no source" on the day
// the Barge ships and the number starts reading inside a band.
function FrontNumber({ line }: { line: DashboardReadingLine }) {
  const chip = VERDICT[line.verdict];
  return (
    <div className="pm-glass pm-tile space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xs leading-snug font-semibold">{line.label}</h2>
        <Pill tone={chip.tone}>{chip.word}</Pill>
      </div>
      <p className="font-display text-lg leading-none font-bold tracking-tight">
        {line.value}
      </p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {line.target}. The seat&apos;s early warning, and the number this page
        is named for.
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
    <div className="pm-glass pm-tile space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xs leading-snug font-semibold">{title}</h2>
        <Pill tone={state.tone}>{state.word}</Pill>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
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
    <section className="pm-glass overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
        <h2 className="font-display text-sm font-bold tracking-tight">
          {panel.title}
        </h2>
        <Pill tone={STATE[panel.state].tone}>{STATE[panel.state].word}</Pill>
        <p className="w-full text-[11px] leading-relaxed text-muted-foreground">
          {panel.answer}
        </p>
      </div>

      <div className="pm-scroll overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] text-left dark:border-white/[0.08]">
              <Th>Reading</Th>
              <Th className="text-right">Window</Th>
              <Th>Gate</Th>
              <Th className="text-right">Verdict</Th>
            </tr>
          </thead>
          <tbody>
            {panel.readings.map((line) => (
              <tr
                key={line.label}
                className="border-b border-black/[0.04] last:border-0 dark:border-white/[0.06]"
              >
                <td className="px-4 py-2 text-xs">{line.label}</td>
                <td className="px-4 py-2 text-right text-xs tabular-nums">
                  {line.value}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {line.target}
                </td>
                <td className="px-4 py-2 text-right">
                  <Pill tone={VERDICT[line.verdict].tone}>
                    {VERDICT[line.verdict].word}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <GapList gaps={panel.gaps} />
    </section>
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
