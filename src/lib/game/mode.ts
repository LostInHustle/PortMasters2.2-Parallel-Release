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
// you are playing: which phases the room synchronizes on, in what order,
// and what happens to a seat that fails. Classic is the voyage PortMasters
// 2 Parallel Release has always run: the same ports, the same table, the
// same manifest, with the goods sorted before the conversation. Both modes
// walk the same six phases now (see ./phases.ts), and the order below is
// where the two of them part company.
// Adding a mode at all is what lets a second one exist beside it without
// touching the first, which is the whole point of this file.
//
// Nothing here reads a clock, a database, or a socket. It is a data record
// plus a defensive normalize, so both the interface and the realtime layer
// can import it without either one owning it. The two modules it now reads
// numbers from are pure in the same way: ./audit owns the rung its vote
// opens at, and ./maroon owns the width of the Harbormaster's hand.
//
// A mode carries its captain's words beside its rules, and both came back
// to this record for the same reason. The briefing on the Welcome screen,
// the rule for a failed seat, and the list of ways the mode plays
// differently from the founding voyage all sit here, and every surface
// that teaches a mode (the lobby's manual, the in room tutorial and the
// guide) reads them out of here rather than wording its own. That is what
// keeps three teachers from teaching three modes, which is not a
// hypothetical: the tutorial spent a release telling a Gambit captain that
// bankruptcy ends the voyage, because its copy of the rule was written
// out by hand while this record said the opposite.
// =====================================================================

import { difficultyConfig } from "./difficulty";
import { AUDIT_FROM_ROUND, AUDIT_REVEAL_COUNT, AUDIT_WINDOW } from "./audit";
import { PORT_SHIFT_PERCENT, MAROON_VOTE_SHARE } from "./maroon";
import type { LegPhase, Phase } from "./types";

export type GameMode = "classic" | "ocean_gambit";

export const DEFAULT_MODE: GameMode = "classic";
// One leg of a round, as a captain reads it before the voyage begins.
//
// A leg names the checkpoint it is, and that is what ties the chart to
// the lap rather than to a second list of the same legs: the smoke suite
// reads this field to prove the legs cover the mode's own phases once
// each and in the order the engine walks them, so a mode that moves a
// phase and forgets its chart fails the suite rather than briefing its
// crew wrongly.
//
// The leg's name, glyph and colour are not written here. They are the
// phase's own face (see ./phases.ts), so the chart and the voyage rail
// cannot call one phase two things, and a leg renamed once is renamed
// everywhere. What is written here is what only this mode can say about
// the leg: what happens in it, and what it decides for the legs after it.
export interface RoundLeg {
  phase: LegPhase;
  // What happens at this leg, and what it decides for the legs after it.
  // Two lines rather than one because the second is the reason a mode
  // briefs in a chart at all: a leg a captain cannot read forward is a
  // leg they cannot plan around.
  body: string;
  setsUp: string;
}

// How a mode describes its round to a captain on the Welcome screen.
//
// Which shape a mode briefs in is a property of the mode rather than a
// decision the screen makes, and the union is what keeps a mode from
// carrying two descriptions of one lap. Classic prints the line it has
// printed since before modes existed. Gambit's round is a chart, because
// the whole argument of that mode is an order: the manifest closes
// before the table opens, and a chart is the shape that shows an order
// as an order. A sentence leaves a captain to reconstruct the shape from
// the words, and it has no room for the two legs a line folds away or
// for what each leg decides for the legs after it.
type ModeBriefing =
  | { kind: "line"; text: string }
  | { kind: "flow"; legs: readonly RoundLeg[]; closes: string };

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
  // in the captain's terms rather than the engine's. See ModeBriefing for
  // why the shape differs between modes.
  //
  // It lives here rather than in the screen because it is a statement about
  // the lap, and the lap is in this record. The two are written together so
  // that a mode whose order changes is a mode whose description is being
  // looked at, and a Gambit harbor can never brief its crew on Classic's
  // order, which is what a hardcoded description does the moment a second
  // mode exists.
  //
  // Neither shape is a fold over checkpointPhaseOrder, on purpose, and for
  // two reasons. The lap opens at the pier, which is a lobby rather than a
  // step anybody takes, so a fold would hand the captain a leg they never
  // play. And the shipped mode's line speaks of four moves where the leg
  // has six phases, because a captain reads a round as the handful of
  // decisions they make rather than as the room's gates: the two are not
  // the same list and were never meant to be. The chart is held to the lap
  // from the other side instead: every leg names the phase it is, and the
  // suite proves the legs cover the mode's own leg phases once each, in
  // the order the engine walks them.
  //
  // How many legs there are is written inside the briefing and nowhere
  // beside it, which is a rule rather than a habit. The Welcome pill used
  // to print a count of its own above the line, and it read "4 Phases per
  // Voyage" over a mode record that lists five, so the headline and the
  // description it introduced disagreed on the same row of the same
  // screen. A count that has to be kept in step with a list is a second
  // copy of that list, and the copy nobody rewrites is the one that rots.
  briefing: ModeBriefing;

  // What a failed seat costs, in the words a captain reads, printed by
  // every surface that says what a voyage is played for: the tutorial's
  // second page, the guide's rules, and the lobby's manual.
  //
  // It sits on the record for the reason the briefing does, and this one
  // has a body: the tutorial told a Gambit captain "do not go bankrupt,
  // there is no coming back from it" while bankruptcyIsFinal below said
  // false, so the page a new captain learns the rules from contradicted
  // the mode they had chosen. A sentence about a mode's rules is a second
  // copy of those rules, and the copy nobody rechecks is the one that
  // rots. Read against bankruptcyIsFinal and maroonFrom, which are the
  // rule this sentence describes.
  failureRule: string;

  // The ways this mode plays differently from the founding voyage, in the
  // captain's words, and empty for the founding voyage itself.
  //
  // Empty rather than absent for Classic, and empty is the honest answer:
  // Classic is what the others differ from, so its list of differences
  // from itself is not a list. Every surface that explains a mode reads
  // this one array, which is what makes a second mode a matter of writing
  // it here rather than of finding every screen that described the first.
  differences: readonly string[];

  // Flags a mode that is still being built. The interface says so plainly
  // wherever a captain could choose it, because a player who walks into an
  // unfinished mode without being told has been misled rather than tested.
  experimental: boolean;

  // Flags a mode a host cannot simply pick: the harbor takes a phrase, and
  // the phrase is the one the room remembers (see src/lib/unlock.ts, which
  // holds the table of them and is the only thing that decides which one
  // opens which mode).
  //
  // Deliberately a second flag rather than folded into the one above. The
  // two say different things and either can be true without the other: a
  // sealed mode can be finished, and this is the one that is, while an
  // unfinished mode can be open to anyone. The interface reads this field
  // to draw the seal on the card and to ask for the phrase, and it reads
  // the unlock table only for what to call the door.
  sealed: boolean;

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
  //
  // [B1: the six phase leg, as data] Both laps are now the same six phases
  // in the mode's own order, opening at the pier, and the difference between
  // the two modes is exactly where Orders sits relative to Parley. That is
  // the design's one structural claim about Classic and Gambit: the shipped
  // mode sorts the goods before it sorts the conversation, and the
  // experimental one closes the manifest before the table opens.
  //
  // The type is Phase rather than string, which is what makes a lap entry a
  // phase the engine actually has: a mode that mistypes its order fails the
  // build rather than leading its crew to a checkpoint no panel answers.
  checkpointPhaseOrder: readonly Phase[];

  // Whether a seat that fails the voyage is finished with it.
  //
  // Classic is the voyage PortMasters 2 Parallel Release has always run,
  // and in it a captain who cannot pay the harbor is done: the Bankruptcy
  // screen is where their voyage ends and the standings are read without
  // them. Ocean Gambit is built on the opposite pillar, that there are no
  // dead seats, so a captain who runs out of Gold keeps their seat, their
  // vote and their lap, and is marked bankrupt for the record and the
  // verdict rather than removed from the table.
  //
  // This lives on the mode rather than in the engine as a global because the
  // two are different games and the shipped one is entitled to the rules it
  // shipped with: a captain who sails Classic tomorrow must find the voyage
  // they know. The engine reads it at the one place a seat fails (see
  // finishSettlement in ./engine/lifecycle), and nothing else needs to know.
  bankruptcyIsFinal: boolean;

  // The first leg the harbor may vote a captain ashore, or null where the
  // harbor never may.
  //
  // Deliberately a second field rather than folded into the one above, and
  // the plan says why: the two carry different risks. A mode can keep a
  // failed seat sailing without ever handing the table a weapon, and turning
  // marooning off must not quietly turn bankruptcy back into a death
  // sentence. The rung itself is here rather than in ./maroon.ts for the
  // reason the lap is here: it is one of this mode's own rules, and the
  // client that offers the vote and the server that counts it read this one
  // record, so neither of them can move it.
  maroonFrom: number | null;

  // The first leg the harbor may open a captain's manifest, or null where
  // it never may.
  //
  // [H6: the manifest audit] The rung the audit opens on, held here for the
  // reason the maroon's rung is held here and not in ./engine/audit: it is
  // one of this mode's own rules, and the panel that offers the vote and
  // the tally that counts it read this one record, so neither can move it
  // without the other. Null on the shipped mode, which is the whole of the
  // gate: a Classic voyage is not a voyage where a captain's sheet is ever
  // opened to the room, and a rung of null says so in the same breath as
  // the field that would carry it.
  //
  // The plan's rollback note for this slice is "so the mode should go off
  // with it", which is why this is a rung rather than a switch: the audit
  // and the mode are one decision, and a second lever that could disagree
  // with the first is a lever nobody would remember to pull.
  auditFrom: number | null;

  // Whether this mode carries the systems this release added.
  //
  // The one boundary every system built after the frozen release stands
  // behind. Classic is PortMasters 2 Parallel Release as it shipped, kept
  // exactly as it was, and the proof of that is a rule rather than a
  // promise: a captain who sails Classic tomorrow is sailing the release
  // they know, so nothing this branch added may reach them. Every switch in
  // ./flags reads this field before it reads its own environment value, and
  // the systems that have no switch read it directly.
  //
  // Deliberately a second field rather than experimental above, and the two
  // are not the same question. That one is a label on the lobby card, and
  // it would be answered differently the day this mode stops being
  // described as experimental; this one is the boundary itself, and it does
  // not move when the label does. A mode promoted out of experimental
  // status that quietly deleted its own systems would be the exact drift
  // this record exists to prevent.
  //
  // It reads as one flag over nine systems rather than nine gates over
  // nine, and that is the shape the requirement asked for: the systems are
  // one decision about where the branch's work lives, so they share one
  // answer, and the operator's per system environment switches sit inside
  // this gate rather than beside it.
  gambitSystems: boolean;

  // Whether this mode's seats run on a clock.
  //
  // [B2: the leg clock] The countdown that closes a seat when the table
  // stops answering. Classic is off, and stays off whatever the process
  // environment says: the shipped mode has never hurried a captain, and a
  // stale PHASE_CLOCK in a deployment's environment is not a reason to
  // start. That is also why this is a field rather than a reading of the
  // scale: the scale says how fast the clock runs, this says whether the
  // mode has one, and the second question is not the operator's to answer
  // for the shipped mode.
  phaseClock: boolean;

  // Whether this mode's captains keep a standing order for a seat.
  //
  // [B3: the standing order] A captain writes down what they want done at
  // the next leg and reads it back once the seat opens. Off on Classic:
  // the shipped voyage decides each seat when the seat arrives, and there
  // has never been a page in it that answers a seat in advance.
  standingOrders: boolean;

  // How many legs a voyage of this mode runs, or null where the tier's own
  // ladder decides the length.
  //
  // [I5: session length, and table size] A pinned length is the mode's
  // answer to a question the tier cannot answer: how much room the
  // deduction has to develop. The plan's words are that eight is too short
  // for it and sixteen is too long to hold the tension, so Gambit runs
  // twelve legs on every tier while the tier keeps every other dial it
  // owns. The length is pinned rather than capped, and the difference
  // matters: a cap would leave a Fair Winds voyage at its own eight and
  // never reach the rung below, while twelve is long enough that the
  // maroon (leg nine) and the audit (leg five) are reachable on every
  // voyage the mode can be sailed on, which is what makes their numbers
  // comparable across tiers at all.
  //
  // The mode's length and the tier's are therefore two readings of one
  // fact, and voyageRoundsFor below is the only place they are reconciled:
  // every consumer takes a voyage's length from there rather than from the
  // tier, so the lap a captain sails, the chronicle row that records it and
  // the integrity ceiling that judges its save cannot disagree about how
  // long the voyage was.
  //
  // One window is worth naming rather than hiding. A voyage already under
  // way when this field changes plays the legs its own save pinned in
  // GameState.maxRounds, while the server side readers that recompute from
  // this record read the new number until that voyage ends. That window is
  // one voyage wide and closes itself, which is why the length is
  // configuration here rather than a column on the room: a column would
  // have to be written at departure, delivered to every client and cleared
  // on restart to buy what the save already carries.
  voyageLegs: number | null;
}

// Gambit's own two rungs, named once each.
//
// Both are read twice inside the mode below: as the field that decides the
// rule, and inside the sentence that tells a captain about it. A number
// written out in two places is a number that drifts apart from itself,
// which is the same reason voyageRoundsFor exists rather than a tier read
// at one call site and a mode read at the next. The rungs themselves are
// explained where the rules that use them live, and these two names carry
// no rule of their own.
const GAMBIT_LEGS = 12;
const GAMBIT_MAROON_FROM = 9;

export const MODES: Record<GameMode, ModeConfig> = {
  classic: {
    badge: "Classic",
    icon: "⚓",
    tagline: "The harbor as it has always run.",
    summary:
      "The founding voyage. Buy the port, work the orders, trade with the table between rounds, settle, and refit.",
    experimental: false,
    // The founding voyage is the one a captain who has heard nothing at
    // all can still sail: it never takes a phrase, which is what keeps the
    // harbor open to a first visitor.
    sealed: false,
    // The rules this mode shipped with, held where every other rule of the
    // mode is held. A Classic voyage ends in bankruptcy exactly as it always
    // has, and the harbor has never voted anyone ashore.
    bankruptcyIsFinal: true,
    maroonFrom: null,
    // The shipped mode opens no manifest and keeps no standing order and
    // runs on no clock. Three nulls and one false, and each of them is the
    // rule rather than a value waiting to be filled in: this is the voyage
    // as it shipped, and the systems that are not in it are not in it.
    auditFrom: null,
    // Every system this release added is Gambit's, and this is the field
    // that says so. Read ./flags for what stands behind it.
    gambitSystems: false,
    phaseClock: false,
    standingOrders: false,
    // The founding voyage keeps the tier's ladder, because the ladder is
    // what it has always run on: Fair Winds is eight rounds, Open Waters
    // twelve, Monsoon sixteen, and a captain who sails Classic tomorrow
    // must find the voyage they know. Null rather than a copy of the
    // tier's number, because a copy is the value that stops following.
    voyageLegs: null,
    // A line, and the one the Welcome screen has always printed, and the
    // reason it moved rather than being rewritten: the shipped mode briefs
    // its crew in one sentence. Which shape a mode briefs in is a property
    // of the mode, not of the screen that renders it.
    //
    // [B1: the six phase leg, as data] What the sentence says did have to
    // change, because B1 retired the numerals it was built on: a captain on
    // the rail now reads Dawn, Market, Parley, Orders, Resolve and Dusk, and
    // a briefing that still counted to four would be briefing a second
    // vocabulary. It walks this mode's own lap, in this mode's own order,
    // and it is written out here rather than built from the faces because
    // ./phases.ts reads ./types.ts, which reads this file back.
    briefing: {
      kind: "line",
      text: "🧭 Dawn: Draft a Boon → 📦 Market: Buy at Ports → 🤝 Parley: Barter → 📜 Orders: Fill Trade Orders → 💸 Resolve: Pirates, Wages & Maintenance → 🚢 Dusk: Upgrade Ship",
    },
    // The founding voyage's rule for a failed seat, which is the one it has
    // always run and the one its captains expect to find here: the
    // bankruptcy screen is where that captain's voyage ends.
    failureRule:
      "Fall short on the bills and the voyage is over for that captain: the bankruptcy screen is the last of it, and the standings are read without them.",
    // Empty, because this is the voyage the others differ from. See the
    // field's own comment.
    differences: [],
    // Port market, then the cross captain trade board, then the trade
    // manifest. Classic sorts the goods before it sorts the conversation,
    // and that order is the difference a Classic captain would notice if
    // it moved: the manifest is filled after the table has been read.
    //
    // The artisan bench lives inside Market rather than beside it (see
    // ../game/phases.ts), so the round from the harbour's side is six
    // gates where it used to be eight. A Classic captain's own round is
    // the one they know: buy, trade at the table, set the crew, fill the
    // manifest.
    checkpointPhaseOrder: [
      "harbor",
      "dawn",
      "market",
      "parley",
      "orders",
      "resolve",
      "dusk",
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
    // [H9: the unlock code] Sealed, so a host cannot charter this harbor
    // without the phrase, and the phrase is a room setting rather than an
    // account one: whoever heard it can open the table for everybody
    // sitting at it. The gate itself lives in the create route, because
    // the mode is fixed at creation exactly as the tier is.
    sealed: true,
    // [H7: Maroon and the Harbormaster] The two rules this slice adds, and
    // the reason they are two: a failed seat keeps sailing, and from the
    // ninth leg the harbor may vote one captain ashore. Nine rather than
    // five, where the audit opens, because marooning costs a captain their
    // ship and the mode wants a voyage long enough that the harbor has
    // something to read before it acts: on the founding tier's eight legs
    // the rung is never reached, which is deliberate rather than an
    // oversight, since a maroon needs remaining legs to mean anything.
    bankruptcyIsFinal: false,
    maroonFrom: GAMBIT_MAROON_FROM,
    // [H6] The audit opens at the same leg on every tier, and the rung is
    // the constant the mode's own sentence above reads, so the card that
    // tells a captain when their sheet can be opened and the rule that
    // opens it are one number.
    auditFrom: AUDIT_FROM_ROUND,
    // The systems of this release live here. Read ./flags for the nine
    // switches that sit inside this gate.
    gambitSystems: true,
    // [B2] The clock the mode is built around, and the one the shipped
    // default leaves off (see DEFAULT_PHASE_CLOCK_SCALE in ../config): a
    // Gambit table that wants the pressure turns it on, and a Classic
    // table that somehow had it turned on still does not get one.
    phaseClock: true,
    // [B3] One standing order per captain, read back at the seat they
    // wrote it for.
    standingOrders: true,
    // [I5: session length, and table size] Twelve legs, on every tier. The
    // number the mode is tuned to, and the reason the rung above sits at
    // nine: the mode wants a voyage long enough that the harbor has
    // something to read before it acts, and eight leaves the rung
    // unreachable while sixteen holds the tension past its welcome.
    voyageLegs: GAMBIT_LEGS,
    // The round as a chart, which is the shape this mode's argument asks
    // for. It is read on the same screen and at the same moment in the
    // voyage as Classic's line, so the legs both modes run are worded the
    // same way here as there, and the legs this mode changes are the ones
    // whose words differ. A captain who sails one mode and then the other
    // is handed the mode's difference and nothing else.
    //
    // Two rows read differently from Classic's line, and both are the
    // mode's argument rather than decoration. The exchange is a leg of both
    // modes, so its row names the captains on the other side of the
    // trade, because they are who this mode moved the leg to reach. And
    // the orders wear the verb the mode is built on rather than the one
    // Classic uses (see the tagline above): the manifest is filled and
    // closed before the room starts talking, so nothing in it can be
    // revised once it does.
    //
    // The chart buys two things the line cannot carry. Every leg gets the
    // line the mode actually turns on, what it decides for the legs after
    // it, and the round closes with the run back to the top rather than
    // stopping at the last leg. That second line is why this mode briefs in
    // a chart at all. An order is the mode's whole design, and a chart is
    // the shape that shows an order as an order, where a sentence leaves a
    // captain to reconstruct the shape from the words.
    briefing: {
      kind: "flow",
      legs: [
        {
          phase: "dawn",
          body: "Three boons are dealt to you alone each round: cheaper buying, fuller workshops, a shelter from the tax, or a loan when the purse runs thin.",
          setsUp:
            "The one you take bends this round and no other, so read the rest of the round before you choose.",
        },
        {
          phase: "market",
          body: "Load the hold at the port market and set each artisan a task. Prices shift every round, every captain is quoted their own, and wages fall due working or idle.",
          setsUp:
            "What the artisans make lands at settlement, so their work answers the next manifest rather than the one you are about to fill.",
        },
        {
          phase: "orders",
          body: "The manifest deals and you commit: goods for Gold and Reputation, and nothing on the sheet can be revised once the fleet starts talking.",
          setsUp:
            "The fleet cannot see what you committed, which cuts both ways: your round stays hidden from them, and theirs from you.",
        },
        {
          phase: "parley",
          body: "The Captain's Exchange opens. Post what you can spare and name your price, or take what another captain has already set on the table.",
          setsUp:
            "A majority of the fleet can open one captain's manifest from this table, and calling it spends the rest of the table's trading.",
        },
        {
          phase: "resolve",
          body: "Pirates roll for every coin aboard. An escort buys the safe passage for a cut of what you carry, so the fee is cheapest exactly when you have the least to protect.",
          setsUp:
            "Then the wages and the ship's maintenance come due, and what survives the bills is what you take to the yard.",
        },
        {
          phase: "dusk",
          body: "Spend what survived: a level of hull carries another module slot and cuts the cost of every haul, and a drafted module is bolted on for good.",
          setsUp:
            "What you spend here is what the next round's port cannot be bought with.",
        },
      ],
      closes:
        "The round closes at the yard and opens again at the ports, with whatever this one left in the hold.",
    },
    // The mode's own words for the rules above, and the length it pins.
    // They are read on three surfaces and written on one, which is the
    // whole reason the fields above exist: a captain who opens the lobby's
    // manual, the in room tutorial and the guide is reading the same
    // sentences in all three, and a rule that moves moves them together.
    // Every figure inside them is quoted rather than retyped, for the same
    // reason: the maroon's share is read off the constant the vote itself
    // carries (see MAROON_VOTE_SHARE), lowered because the clause carries
    // it mid sentence.
    //
    // Every sentence here is written for a captain rather than for the
    // engine, so a round is a round here and not a leg. The engine's own
    // fields count rounds (GameState.currentRound and maxRounds), and
    // the guide defines the word the same way; the leg register that
    // some of the newer systems write in is recorded where it ships (see
    // the leg reports in ./telemetry and the voyage log). The two words
    // name one thing: a voyage is the whole run, and it is measured in
    // rounds. The tutorial used to call each lap a voyage, which is what
    // left a captain who read the guide and then looked at the rail
    // believing they were on the eighth of eight voyages.
    failureRule:
      "No captain leaves the table here. Fall short on the bills and the harbor marks it against you for the rest of the voyage, and you sail on with your card, your vote and your say at the table.",
    differences: [
      "The manifest closes before the table opens: Orders runs ahead of Parley, so you commit to your sheet first and nothing on it can be revised once the fleet starts talking.",
      `Every voyage here runs ${GAMBIT_LEGS} rounds, whatever tier you sail. That is the length the harbor's two votes are tuned to.`,
      "Every captain is dealt a private card when the voyage leaves the dock, and no one else can see it: most are Honest Captains sailing the fleet's public objective, while a table of four or more hides a Pirate in the fleet and a table of six or more may hide a Broker beside them. Every card turns face up when the voyage ends.",
      `From round ${AUDIT_FROM_ROUND}, a simple majority of the fleet can open one captain's manifest at a Parley. The room is shown ${AUDIT_REVEAL_COUNT} of that captain's last ${AUDIT_WINDOW} fills, and calling the vote spends the rest of that Parley's trading.`,
      `From round ${GAMBIT_MAROON_FROM}, ${MAROON_VOTE_SHARE.toLowerCase()} of the captains still sailing can vote one captain ashore, once a voyage. The ship and its hold go to the harbor, half that captain's Gold stays aboard, and they take up the Harbormaster's hand: once a round, they name a port and lean every price there ${PORT_SHIFT_PERCENT} percent either way.`,
    ],
    // The one structural change this mode makes on day one, and it is the
    // center of the whole design argument: the trade manifest moves ahead of
    // the cross captain trade board. Ordering and committing happen
    // simultaneously and hidden, and only then does the room talk. Reverse
    // those two and a captain can simply wait, watch what everyone else
    // bought, and trade against known information, which is what makes the
    // classic order a market game rather than a table game. Every phase
    // below is visited exactly once per round, so the lap still closes.
    //
    // [B1: the six phase leg, as data] This is the array the leg was
    // reconciled into, and the mode's whole difference is now visible in it:
    // orders before parley, where Classic reads parley before orders. The
    // six names are the design's, and the artisan bench, which used to be a
    // checkpoint of its own after the table, is the second half of Market.
    //
    // [W2: the path draft] And the seat this mode opens its rounds at: the
    // hands are dealt as the voyage leaves the dock, so the first thing a
    // round asks this table is which cards each captain keeps, and Dawn
    // opens behind it. It is written here rather than folded in by a lap
    // reader because it is one of this mode's own rules, like the orders
    // order above it; the reader that honors the draft's own switch folds
    // the seat back out of the lap when the switch is off (see lapOrder in
    // ./checkpoint.ts), so the rolled back build walks the same seven
    // entries it always did and opens at Dawn.
    checkpointPhaseOrder: [
      "harbor",
      "path_draft",
      "dawn",
      "market",
      "orders",
      "parley",
      "resolve",
      "dusk",
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

/**
 * Whether a mode carries the systems this release added.
 *
 * The one predicate the boundaries outside ./flags read. The nine operator
 * switches ask this question through ./flags, which folds it into each
 * switch so a caller asks one thing rather than two; the systems that have
 * no switch of their own (the audit's rung, the standing order, the leg
 * clock and the fleet's log) ask it here, and they ask it rather than
 * testing the field so that the question has one spelling.
 *
 * Takes an unknown for the reason normalizeMode does: a stale save, a room
 * row written before the field existed and a malformed request all land on
 * the founding mode, which is the mode that carries none of it.
 */
export function gambitSystemsOn(value: unknown): boolean {
  return modeConfig(value).gambitSystems;
}

/**
 * The first leg a mode's harbor may open a manifest, or null where it never
 * may. Same shape as maroonFrom and read the same way by the panels that
 * offer the vote.
 */
export function auditOpensAt(value: unknown): number | null {
  return modeConfig(value).auditFrom;
}

/**
 * How many legs a voyage runs: the mode's own length where it has one, and
 * the tier's ladder where it does not.
 *
 * The one place the two records are reconciled, and the reason every
 * consumer of a voyage's length calls this rather than reading either
 * record directly. A voyage's length is a number three different things
 * have to agree on: the lap the captain sails (GameState.maxRounds, pinned
 * at departure by createInitialGameState), the row the conclusion writes
 * for them, and the ceiling the integrity pass judges their save against.
 * Reading the tier in one place and the mode in another is exactly how
 * those three drift, so none of them reads a record: they read this.
 *
 * Both arguments are unknown on purpose, in the shape normalizeMode and
 * normalizeDifficulty already take: a stale save, a room row written
 * before modes existed and a malformed request all land on the founding
 * mode and the entry tier rather than throwing.
 */
export function voyageRoundsFor(mode: unknown, difficulty: unknown): number {
  return modeConfig(mode).voyageLegs ?? difficultyConfig(difficulty).rounds;
}
