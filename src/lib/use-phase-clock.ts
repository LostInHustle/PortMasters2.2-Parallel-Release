"use client";

// =====================================================================
// The harbor's clock, ticking where it is drawn.
//
// The clock belongs to the
// server: it arms a deadline when the harbor's checkpoint moves and
// announces the advance when that deadline passes, whether or not every
// captain has readied, so a table where somebody has walked away still
// turns. What is here is the reading of that deadline and the ticker that
// keeps it moving. The arithmetic itself is in @/lib/phase-clock, which
// reads the published numbers and nothing else.
//
// The ticker lives here rather than in the harbor's own hook, and that is
// the whole point of the file. The reading is state, because a number
// cannot change on a screen that has not been drawn, and that state used
// to sit in the hook every screen of the harbor shares: the harbor
// redrew itself once a second to move one countdown, so every board
// beneath it redrew with it, a hundred times a minute, for the length of
// a voyage. Here the ticker belongs to the panel that draws the clock, so
// the second that passes costs that panel a redraw and nothing else.
// =====================================================================

import { useEffect, useMemo, useState } from "react";
import {
  phaseClockLabelFor,
  secondsRemaining,
  type PhaseClock,
  type PhaseDeadline,
} from "./phase-clock";
import { useLanguage } from "./use-language-preference";

/**
 * The harbor's clock, as the panel that draws it reads it.
 *
 * The deadline arrives as one object with the moment this client saw it
 * (see PhaseDeadline in @/lib/phase-clock), and the countdown is composed
 * from those numbers here, in the language the captain is holding. A null
 * deadline means no clock is running: the pier, a harbor that has not set
 * sail and a server with the clock switched off are all the same answer,
 * and a panel that draws nothing says so by being handed nothing.
 */
export function usePhaseClock(
  deadline: PhaseDeadline | null,
): PhaseClock | null {
  const { locale } = useLanguage();

  // The reading the ticker last took, or null while no tick has landed.
  //
  // The ticker runs only while a clock is running, which is what keeps a
  // captain sitting in a harbor with no deadline from waking up once a
  // second for nothing.
  const [tickedAt, setTickedAt] = useState<number | null>(null);

  const endsAt = deadline?.endsAt ?? null;
  const total = deadline?.total ?? null;
  const observedAt = deadline?.observedAt ?? null;

  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setTickedAt(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  // The reading the countdown is composed against: the later of the last
  // tick and the moment this client saw the deadline.
  //
  // The later of the two, because they answer two different questions. The
  // tick is a heartbeat that moves while a clock runs, and the observation
  // is the moment a deadline arrived. A deadline that lands between two
  // ticks is measured against the moment it landed, so the first frame
  // after a seat begins is drawn against the moment that seat's deadline
  // arrived rather than against the reading the last tick happened to
  // leave behind. Once the ticker has moved past the observation, the tick
  // is the fresher of the two and the countdown follows it.
  //
  // The later of the two rather than the tick alone, because a clock that
  // was not running has no ticks: a harbor sitting in a phase with no
  // deadline leaves the reading where the last clock left it, and a
  // deadline arriving after that gap would be measured against a reading
  // minutes old and would show a countdown longer than the seat was given.
  const now = Math.max(observedAt ?? 0, tickedAt ?? 0);

  const secondsLeft = secondsRemaining(endsAt, now);
  return useMemo(
    () =>
      secondsLeft === null
        ? null
        : {
            secondsLeft,
            label: phaseClockLabelFor(locale, secondsLeft),
            // How long the seat was given, which is what a progress bar
            // needs and a countdown does not. Null when the server did not
            // publish one, which a screen reads as "no bar to draw" rather
            // than as a full or an empty one.
            total,
          },
    [secondsLeft, total, locale],
  );
}
