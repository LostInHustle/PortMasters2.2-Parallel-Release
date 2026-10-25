// =====================================================================
// PortMasters 2.2 Parallel Release: terminology glossary
// Short, plain language descriptions for anything a new captain might
// hover over and wonder about. Pulled in by the <Term> component
// (src/components/portmasters/Term.tsx) wherever that term is used as a
// label across the status panel, the phase screens, and the player
// detail popup.
//
// [The read] The entries are keyed by the English term the popover asks
// by, and the sentence a captain reads is read off the pack when the
// popover opens (glossaryText below) rather than copied out when the
// bundle loaded. A copy taken at load wears the language the process
// started in, and a captain who picked Mandarin before the first render
// would hover a term and read English. The entries whose sentences carry
// a figure hold the pack's own cell, tokens and all, and the reader
// fills them from the same constants the engine prices by, so no
// sentence is written twice.
// =====================================================================
import { cardText } from "./cards";
import type { CardRecord } from "./constants/cards";
import { BOONS, MODULES } from "./constants/drafts";
import { ESCORT_OFFER_DEATH } from "./constants/copy";
import { FLEXIBLE_BARTER_UNLOCK_LEVEL } from "./constants/goods";
import { CONVOY_RAID_COVERAGE } from "./constants/paths";
import { t, type Params } from "./i18n";

export const GLOSSARY: Record<string, string> = {
  // Raw materials
  Hemp: "A cheap raw material, bought at port. Weavers turn it into Linen Clothes, or combine it with Silk for Cotton Clothes.",
  Silk: "A pricier raw material. Goes into Cotton Clothes, Brocade, and Sachets. Most of the high value recipes need it.",
  Tea: "A raw material used only in Sachets, alongside Silk.",

  // Finished goods
  "Linen Clothes":
    "A Weaver's product: 2 Hemp in, one item out. The cheapest finished good to produce.",
  "Cotton Clothes":
    "A Weaver's product: 2 Hemp + 1 Silk in. Worth more than Linen Clothes, costs more to make.",
  Brocade:
    "A Master Weaver's product: 3 Silk in. One of the two highest value finished goods.",
  Sachet:
    "A Sachet Maker's product: 1 Silk + 2 Tea in. The most valuable finished good, and the only one that needs Tea.",

  // Workers
  Weaver:
    "Makes Linen Clothes or Cotton Clothes. Costs a wage every round, paid at Resolve, whether or not they're working.",
  "Master Weaver":
    "Makes Linen Clothes, Cotton Clothes, or Brocade. Pricier than a Weaver, and the only one who can make Brocade.",
  "Sachet Maker":
    "Makes Sachets. The most expensive artisan to hire, but Sachets pay the best.",

  // Core stats
  Freight:
    "The fee charged for delivering a trade order, based on how many items you're moving. Reduced by your ship level and certain boons or modules.",
  Maintenance:
    "A fixed per round ship maintenance fee, due at Resolve regardless of how the round went.",
  "Ship Level":
    "Raised by a Hull Upgrade at the Shipyard during Dusk. Each level opens a module slot and adds a flat discount on freight costs.",
  Wages:
    "What your hired artisans cost per round, paid at Resolve whether they produced anything or not.",
  Barter:
    "Trade directly with another captain instead of through the market, on the Captain's Exchange during the Parley or from the harbor chat once you reach Renown Level {FLEXIBLE_BARTER_UNLOCK_LEVEL}. Post what you have for what you want; the offered amount is set aside the moment you post it, and comes back to you if it's canceled, if nobody takes it, or if a flexible offer of yours is taken and this one is retired with it.",
  // The Convoy market a Gambit captain sells from at the Parley, priced by
  // the two captains rather than by the voyage's rules, and read at the raid
  // by the coverage figure (see CONVOY_RAID_COVERAGE in ./constants/paths
  // for the share the seller's guns beat off). It ends on the offer's own
  // rule rather than a second telling of it (see ESCORT_OFFER_DEATH in
  // ./constants/copy), which is the same sentence the desk that posts the
  // offer opens with.
  "Escort Market":
    "A Convoy path market at the Parley on a Gambit voyage: a Convoy captain sells one round of protection to one other captain at a price the two of them agree. The buyer pays the fee at the handshake, the seller's cannons beat off {convoyCoverPct}% of a raid in that round, and the rest comes out of the seller's own Gold. {ESCORT_OFFER_DEATH}",

  // The round's own vocabulary, for the four words a captain meets on the
  // rail before any mode's briefing has explained them. The food note on
  // the Dawn entry is worded for both modes rather than assuming the
  // larder: the rail draws these phases on every voyage, and a Classic
  // captain told about rations would be reading a rule their table does
  // not run.
  Dawn: "The round's opening phase: the boon draft deals three cards and you keep one, and it bends the rules for the round ahead. On a voyage that keeps a larder, this is also when the crew eats a ration a head.",
  Parley:
    "The round's trading floor. Captains post barter offers and take each other's here, and the table's votes (a manifest audit, a maroon) are called here too.",
  Resolve:
    "The round's reckoning. Production lands first, then pirates may strike, and then the wages, maintenance and taxes come due. The Dues tab is the list of what this phase will ask for.",
  Dusk: "The round's last phase and the shipyard's seat: upgrade the hull, or draft and rig a module.",

  // The four nouns of the rail and the provisions header, each drawn as a
  // label on the surface that keeps it: the two tabs, the larder and
  // stores figures. The Stores entry is reachable only while the split
  // hold is on, because the figure it explains is only drawn then.
  Dues: "What this captain owes at the round end: the crew's wages and the ship maintenance fee in one total, with any outstanding loans listed underneath. This tab keeps the running count.",
  Hold: "The cargo hold: the goods stowed aboard, one slot per unit of cargo, plus the crew that works them. This tab lists it all.",
  Stores:
    "The pantry half of the hold: the foods aboard, measured in slots. The Larder counts the meals inside them.",
  Larder:
    "The meals aboard for the crew, one ration a head eaten at each Dawn. Run it dry and the crew works hungry, and a long stretch without rations costs a hand.",

  // Two words the money surfaces use without explaining: the cut a broker
  // takes, and the holding state an offer or a pledge sits in.
  Commission:
    "The broker's cut on a Broker's Favor order: a share of the reward, paid when the order fills. The card prints the cut before you fill it.",
  Escrow:
    "Gold or goods held aside the moment an offer, a pledge or a barter is posted, until the deal settles. Held goods cannot be spent or traded meanwhile, and they come back whole if the deal is canceled or expires.",
};

// The fills for the two entries whose pack cell carries a token rather
// than a written figure. Each reads the module's own constants at the
// moment the popover opens: the barter unlock off ./constants/goods and
// the offer's own closing rule. An entry not listed here is a plain
// sentence and goes straight to t().
const FIGURED_ENTRIES: Record<string, () => Params> = {
  Barter: () => ({ FLEXIBLE_BARTER_UNLOCK_LEVEL }),
  "Escort Market": () => ({
    convoyCoverPct: Math.round(CONVOY_RAID_COVERAGE * 100),
    ESCORT_OFFER_DEATH: t(ESCORT_OFFER_DEATH),
  }),
};

// The two card
// entries a captain can hover, read off the records rather than off
// copies kept in the map above, so a card renamed or retuned moves its
// glossary entry with it. The description comes off cardText, which is
// the one place a card's shipped language is chosen, and it is read when
// the popover opens rather than when this module loads, for the reason
// the header gives. The key is the card's English name, and the card also
// answers to the name it wears in the other language, because the screens
// that hover a card hand over the name cardText answers with (see the
// Shipyard's rig list and ModuleSwap).
const CARDS = new Map<string, CardRecord>(
  [...BOONS, ...MODULES].flatMap((card): [string, CardRecord][] => [
    [cardText(card, "en").name, card],
    [cardText(card, "zh").name, card],
  ]),
);

/**
 * The sentence a glossary term stands for, in the language the process
 * is printing, or undefined for a term the glossary does not know.
 *
 * The one read Term and the price hovers share. The key is the English
 * term, and a card also answers by the name it wears in the language on
 * screen. An unknown term answering undefined is the signal the popover
 * draws no tooltip at all rather than an empty one.
 */
export function glossaryText(term: string): string | undefined {
  const card = CARDS.get(term);
  if (card !== undefined) return cardText(card).desc;
  const entry: string | undefined = GLOSSARY[term];
  if (entry === undefined) return undefined;
  const fills: (() => Params) | undefined = FIGURED_ENTRIES[term];
  return fills === undefined ? t(entry) : t(entry, fills());
}
