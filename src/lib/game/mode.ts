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
  // Display metadata. The lobby switch reads icon and badge, the tagline
  // sits under it, and the experimental warning reads summary. There is
  // deliberately no long display name: badge is what the interface has
  // room to show, and the two surfaces that show it agree because they
  // read it from here.
  badge: string;
  icon: string;
  tagline: string;
  summary: string;

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
    icon: "🌊",
    tagline: "Experimental. Orders lock before the table opens.",
    summary:
      "The experimental voyage, built to grow a survival layer and a table that does not trust itself. Trade orders are committed before the social window opens, so a promise about what you are going to do is a promise that can be broken invisibly.",
    experimental: true,
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
