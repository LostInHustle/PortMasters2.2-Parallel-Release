// =====================================================================
// PortMasters 2.2 Parallel Release: game modes
//
// One data record defines every mode, the same shape ./difficulty.ts uses
// for tiers, and for the same reason: a mode is a ROOM property, so the
// host picks it once and every captain in the harbor resolves the same
// record. Read MODES[normalizeMode(x)] and nothing else.
//
// The reason modes exist as a separate axis from difficulty is that the
// two answer different questions. Difficulty says how hard the voyage is:
// how long, how wide the market, how likely a raid. Mode says which game
// you are playing: which phases the room synchronizes on, and in what
// order. Classic is the voyage PortMasters 2 has always run and its order
// is byte for byte what the shared checkpoint module used to hold inline.
// Adding a mode at all is what lets a second one exist beside it without
// touching the first, which is the whole point of this file.
//
// Nothing here reads a clock, a database, or a socket. It is a data record
// plus a defensive normalize, so both the interface and the realtime layer
// can import it without either one owning it.
// =====================================================================

export type GameMode = "classic" | "ocean_gambit";

export const DEFAULT_MODE: GameMode = "classic";

interface ModeConfig {
  // Display metadata. The voyage card reads icon, badge, tagline and
  // summary, and the room card reads icon and badge. There is deliberately
  // no long display name: badge is what the interface has room to show, and
  // the surfaces that show it agree because they read it from here.
  badge: string;
  icon: string;
  tagline: string;
  summary: string;

  // How this mode's round is described to a captain on the Welcome screen,
  // in the captain's terms rather than the engine's.
  //
  // It lives here rather than in the screen because it is a statement about
  // the lap, and the lap is in this record. The two are written together so
  // that a mode whose order changes is a mode whose description is being
  // looked at, and a Gambit harbor can never brief its crew on Classic's
  // order, which is what a hardcoded blurb does the moment a second mode
  // exists.
  //
  // It is prose rather than a join over checkpointPhaseOrder on purpose:
  // the lap is eight checkpoints and this is four numbered legs, because
  // the welcome and the boon draft are not legs to a player, and barter is
  // grouped with the leg it sits beside. Deriving the sentence from the
  // array would change the shipped mode's own briefing to say more than it
  // means to.
  lapBlurb: string;

  // Flags a mode that is still being built. The interface says so plainly
  // wherever a captain could choose it, because a player who walks into an
  // unfinished mode without being told has been misled rather than tested.
  experimental: boolean;

  // The synchronized lap of one round, in order, for this mode. Only these
  // phases are gated behind the room wide ready check; personal substates
  // like module drafting and terminal ones like bankruptcy are never
  // checkpoints. See ./checkpoint.ts, which is the only consumer.
  //
  // A rank computed from one mode's order is meaningless in another, since
  // the rank is the index times the lap length. Everyone in a room shares a
  // mode, so this is safe by construction, and checkpointRank takes the mode
  // as an argument rather than reading a global so that it stays true when a
  // future screen compares two voyages side by side.
  checkpointPhaseOrder: readonly string[];
}

export const MODES: Record<GameMode, ModeConfig> = {
  classic: {
    badge: "Classic",
    icon: "⚓",
    tagline: "The harbor as it has always run.",
    summary:
      "The founding voyage. Buy the port, work the orders, trade with the table between rounds, settle, and refit.",
    experimental: false,
    // Byte for byte what the Welcome screen printed before modes existed,
    // and the reason it moved rather than being rewritten: the shipped mode
    // briefs its crew in the words it always has.
    lapBlurb:
      "1️⃣ Buy at Ports (+ 🤝 Barter) → 2️⃣ Fill Trade Orders → 3️⃣ Pirates, Wages & Maintenance → 4️⃣ Upgrade Ship",
    // Unchanged from the single hardcoded order the shared checkpoint
    // module carried before modes existed. Port market, then the cross
    // captain trade board, then artisan assignment, then the trade
    // manifest. Classic sorts the goods before it sorts the conversation.
    checkpointPhaseOrder: [
      "0",
      "5",
      "1",
      "barter",
      "worker_mgmt",
      "2",
      "3",
      "4",
    ],
  },
  ocean_gambit: {
    badge: "Gambit",
    // A compass rather than a wave. Open Waters in ./difficulty.ts already
    // carries the wave, and the two controls sit one above the other on the
    // create form, so a Gambit card and an Open Waters stop were showing the
    // same icon inches apart.
    icon: "🧭",
    // No "Experimental" prefix on the tagline: the card carries that as a
    // pill, and one card saying it twice is the drift this record exists to
    // prevent.
    tagline: "Orders lock before the table opens.",
    // Written to roughly the length of the Classic summary, because the two
    // are read side by side on the voyage cards and a grid row stretches both
    // cells to the taller of the two. The longer this runs, the more blank
    // space the shipped mode is handed underneath its own text.
    summary:
      "Trade orders are committed before the social window opens, so a promise about what you are going to do can be broken invisibly.",
    experimental: true,
    // The one visible difference from the Classic blurb is the move the
    // whole mode is built on: barter comes after the orders instead of
    // beside the market, so it is its own leg in the list rather than a
    // parenthetical on the first one.
    lapBlurb:
      "1️⃣ Buy at Ports → 2️⃣ Fill Trade Orders → 🤝 Barter → 3️⃣ Pirates, Wages & Maintenance → 4️⃣ Upgrade Ship",
    // The one structural change this mode makes on day one, and it is the
    // center of the whole design argument: the trade manifest moves ahead of
    // the cross captain trade board. Ordering and committing happen
    // simultaneously and hidden, and only then does the room talk. Reverse
    // those two and a captain can simply wait, watch what everyone else
    // bought, and trade against known information, which is what makes the
    // classic order a market game rather than a table game. Every phase
    // below is visited exactly once per round, so the lap still closes.
    //
    // The full six phase leg from the design proposal, Dawn, Market, Orders,
    // Parley, Resolve, Dusk, needs three phases that do not exist yet:
    // Dawn for the survival ticks, and Resolve and Dusk for settlement and
    // the log readout. They arrive with the survival layer, and they land
    // in this array when they do.
    checkpointPhaseOrder: [
      "0",
      "5",
      "1",
      "2",
      "barter",
      "worker_mgmt",
      "3",
      "4",
    ],
  },
};

// Ordered for the lobby switch: the shipped mode first, the experimental one
// second, so the safe choice is the one a captain sees first.
export const MODE_ORDER: readonly GameMode[] = ["classic", "ocean_gambit"];

// Any unknown value, meaning a stale save, a room created before modes
// existed, or a malformed request, falls back to the founding mode rather
// than throwing. Same defensive shape normalizeDifficulty uses.
export function normalizeMode(value: unknown): GameMode {
  return value === "classic" || value === "ocean_gambit" ? value : DEFAULT_MODE;
}

export function modeConfig(value: unknown): ModeConfig {
  return MODES[normalizeMode(value)];
}
