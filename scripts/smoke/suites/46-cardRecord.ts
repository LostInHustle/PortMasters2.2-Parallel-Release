// PortMasters 2.2 Parallel Release, smoke run: the card record.
//
// [F2] The plan's sentence for this goal is one record shape under every
// card, and then the single field that gives the base mode a tighter pool
// and Ocean Gambit a wilder one. What is checked here is the shape half
// first: the plan's ten fields on every record, both language strings
// carried and actually written, and the three readers a card is named
// through. Then the field itself, which is the half with teeth: both
// weightings authored on every card, the ceiling each mode runs, and the
// pool a real captain is drafted from in each mode, because a mode weight
// that nothing reads would pass a check about the records and change
// nothing about the game.
//
// Then the parts the record made possible and the parts it has to keep:
// the five condition arms asked one at a time with the numbers the authored
// cards carry, the lean that weights without filtering, a draw that reads
// the weights rather than the list, the two drafts walked through the
// engine, the tally that measures the offer against the pick, the report
// that reads it, and the save that heals it back.
//
// Last, the validator. Every clause the card check gates the build on is
// watched firing against a subject built by hand carrying the one thing
// wrong that clause is about, because a detector nobody has watched fire is
// a detector nobody has tested.
//
// Nothing here needs a server, a captain or a harbor: the pool is static
// data and its readers are pure functions of a state, so this article runs
// after the run has put its captains away, beside the tag walk's for the
// same reason.

import {
  cardByFlag,
  cardById,
  cardLead,
  cardName,
  cardText,
  cardWeight,
  cardsOfKind,
  cargoCarriesTag,
  carriesTag,
  CARD_CONVERSION_FLOOR,
  CARDS,
  conditionWeight,
  drawOffer,
  goodsCarryingTag,
  holdOfTag,
  normalizeCardTally,
  noteCardOffer,
  noteCardPick,
  offerPool,
  pathLean,
  readCardConversion,
  shippedCards,
  validateCards,
  type CardSubject,
  type CardTally,
} from "@/lib/game/cards";
import {
  BOON_TRIGGERS,
  CARD_KINDS,
  CARD_TRIGGER,
  LANGUAGES,
  MODE_POWER_CEILING,
  SHIPPED_LANGUAGE,
  type CardCondition,
  type CardRecord,
  type CardTrigger,
} from "@/lib/game/constants/cards";
import { CHARTERS } from "@/lib/game/constants/charters";
import { BOONS, CARDS_PER_OFFER, MODULES } from "@/lib/game/constants/drafts";
import type { TagList } from "@/lib/game/constants/tags";
import {
  handleModuleSelect,
  startBoonDrafting,
  startModuleDrafting,
} from "@/lib/game/engine";
// The pick itself is the one step the engine keeps off its public surface:
// the spine calls it through this module and nothing outside ./engine does,
// which is what stops a panel from advancing a voyage by naming a step. An
// article whose subject is the record the draft deals reaches the draft's
// own module rather than the barrel, the same way the spine does.
import { selectBoon } from "@/lib/game/engine/boons";
import { hireWorker } from "@/lib/game/engine/workers";
import type { GameMode } from "@/lib/game/mode";
import { PATH_IDS } from "@/lib/game/paths";
import { healLoadedVoyage } from "@/lib/session/heal-save";
import {
  CARRIES_A_DASH,
  carriesADash,
  check,
  CLASSIC,
  voyageState,
} from "../harness";

// The pool holds no card without a name, so a missing one here is a broken
// suite rather than a failed check: throwing is the honest answer, because
// every check below would otherwise read a card that is not there and pass
// or fail for the wrong reason.
function cardOrThrow(id: string): CardRecord {
  const found = cardById(id);
  if (!found) throw new Error(`the pool has no card ${id}`);
  return found;
}

const CJK = /\p{Script=Han}/u;

export async function cardRecordSuite(): Promise<void> {
  // ---- The shape ----
  // The plan's ten fields, written here as the schedule lists them rather
  // than read back off the interface the check is about, so a field that
  // moved out of the record is a failed check and not a green one.
  const PLAN_FIELDS = [
    "id",
    "kind",
    "power",
    "tags",
    "pathWeight",
    "trigger",
    "condition",
    "effect",
    "modes",
    "strings",
  ];
  check(
    PLAN_FIELDS.every((field) =>
      CARDS.every(
        (card) =>
          (card as unknown as Record<string, unknown>)[field] !== undefined,
      ),
    ) && CARDS.every((card) => card.icon.trim().length > 0),
    "every card carries the plan's ten fields, plus the glyph the record added as its eleventh: the icon is language neutral, so it sits beside the two strings rather than inside either, and a card without one is a card a draft cannot draw",
  );
  check(
    CARDS.length === BOONS.length + MODULES.length + CHARTERS.length &&
      CARDS.length === 43 &&
      new Set(CARDS.map((card) => card.id)).size === CARDS.length,
    "the registry is the three catalogues stacked and nothing else, forty three records with forty three identifiers, so a card cannot be drafted without being in the walk. Two cards sharing an id would be a rename nobody could detect, since the id is what every save, standing order and wire frame stores",
  );
  check(
    CARDS.every(
      (card) =>
        CARD_KINDS.includes(card.kind) &&
        (card.kind === "boon"
          ? BOON_TRIGGERS.includes(card.trigger)
          : card.trigger === CARD_TRIGGER[card.kind]),
    ) &&
      cardsOfKind("boon").length === BOONS.length &&
      cardsOfKind("module").length === MODULES.length &&
      cardsOfKind("charter").length === CHARTERS.length,
    "each card's kind is one of the plan's three and each card arrives at the draft its kind promises, read through the one map rather than off a field repeated per record, so a boon offered at the shipyard is a failed build rather than a card nobody can explain. A boon is the one kind whose arrival is a set rather than a point: the round draft or one of the five moments, read off the same table the moments are armed from, which is what lets a moment card ride the pool the round draft deals from without answering to a draft it never arrives at. The charter count reads off the catalogue F6 filled rather than off a number typed here, which is the shape and the reader the pool was built to take",
  );
  check(
    CARDS.every((card) =>
      LANGUAGES.every((language) => {
        const text = card.strings[language];
        return (
          !!text && text.name.trim().length > 0 && text.desc.trim().length > 0
        );
      }),
    ) &&
      SHIPPED_LANGUAGE === "en" &&
      cardText(cardOrThrow("silk_wind")).name === "Weaver's Winds",
    "both strings are carried on every card and neither is empty, which is J3's evaluation read forward: the pool had to carry both from the beginning for the translation pass to be a pass rather than a rebuild, and the shipped language is named once so the day a captain picks one it is one value and not a second copy of the pool",
  );
  check(
    CARDS.every((card) => {
      const en = card.strings.en;
      const zh = card.strings.zh;
      return (
        en.name !== zh.name &&
        en.desc !== zh.desc &&
        CJK.test(zh.name) &&
        CJK.test(zh.desc)
      );
    }),
    "and the second language is a translation rather than a copy: every card names itself differently in the two, and both Chinese strings carry Chinese characters, which is the cheapest honest test that the field was written by somebody writing the words rather than filled by a script duplicating the English",
  );
  check(
    cardById("no_such_card") === null &&
      cardName("no_such_card") === "no_such_card" &&
      cardLead("no_such_card") === "no_such_card" &&
      CARDS.every(
        (card) => cardLead(card.id) === `${card.icon} ${card.strings.en.name}`,
      ),
    "the door answers null for an id the pool does not hold, and both ledger readers fall back to the id itself rather than to an empty line or a crash: a line naming a card this build does not know is better than a line naming nothing, which is why the two readers answer rather than throw",
  );
  check(
    cardByFlag("transport_silk_discount")?.id === "silk_wind" &&
      cardByFlag("hemp_price_reduction")?.id === "hemp_monopoly" &&
      cardByFlag("no_card_writes_this") === null,
    "the flag reader finds the card that writes a modifier key, which is how the pricing breakdowns name the source of an adjustment now that the flags live on the record: a module carries no flags at all, so the reader walks past every hull card without a special case for them",
  );

  // ---- The mode field ----
  check(
    CARDS.every(
      (card) =>
        typeof card.modes.classic === "number" &&
        typeof card.modes.ocean_gambit === "number",
    ),
    "both mode weightings are authored on every card, which is the plan's own rollback: keeping both from the start is what makes switching a mode between the tight pool and the wild one a config change rather than a content pass, and a card that carried only its own mode would leave the other mode's reading to accident",
  );
  const MODES = Object.keys(MODE_POWER_CEILING) as GameMode[];
  check(
    CARDS.every((card) => Number.isInteger(card.power) && card.power >= 1) &&
      CARDS.every((card) =>
        MODES.every(
          (mode) =>
            card.modes[mode] === 0 || card.power <= MODE_POWER_CEILING[mode],
        ),
      ),
    "no mode runs a card above its own ceiling, read over both modes for every record: a card above the ceiling has to carry a zero there, and that pair is what makes the ceiling a ceiling rather than a comment somebody wrote beside the power number",
  );
  const classicRuns = CARDS.filter((card) => card.modes.classic > 0);
  const gambitRuns = CARDS.filter((card) => card.modes.ocean_gambit > 0);
  const aboveClassic = CARDS.filter(
    (card) => card.power > MODE_POWER_CEILING.classic,
  );
  check(
    gambitRuns.length === CARDS.length &&
      classicRuns.length === CARDS.length - aboveClassic.length &&
      aboveClassic.every(
        (card) => card.modes.classic === 0 && card.modes.ocean_gambit > 0,
      ),
    "the base mode runs a strictly smaller pool than Ocean Gambit and the difference is exactly the cards above the base mode's ceiling, which is the plan's sentence about the variance problem read as a fact about the records: the base competitive mode runs the lower ceiling because there a captain's good luck is somebody else's bad evening, while Ocean Gambit runs the wild pool because its headline objective is shared",
  );
  check(
    MODE_POWER_CEILING.ocean_gambit > MODE_POWER_CEILING.classic &&
      classicRuns.some((card) => card.power === MODE_POWER_CEILING.classic) &&
      gambitRuns.some((card) => card.power === MODE_POWER_CEILING.ocean_gambit),
    "and both ceilings are reached by content rather than holding headroom nobody spends: the widest card each mode runs sits exactly at that mode's number, so the ceiling is the figure the next card has to argue with instead of a limit that happens to be loose",
  );

  const idsOf = (pool: Array<[CardRecord, number]>): string[] =>
    pool.map(([card]) => card.id);
  // Two states that differ in one field. Both are on the same difficult
  // water at a round where every wave has opened, so the only thing between
  // the two pools below is the mode.
  const wide = voyageState({ difficulty: "open_waters" });
  wide.currentRound = 99;
  const narrow = voyageState({ mode: CLASSIC, difficulty: "open_waters" });
  narrow.currentRound = 99;
  const gambitBoons = idsOf(offerPool("boon", wide));
  const gambitModules = idsOf(offerPool("module", wide));
  const classicBoons = idsOf(offerPool("boon", narrow));
  const classicModules = idsOf(offerPool("module", narrow));
  // Above Classic's ceiling now sit the drafted ladders' own tall cards
  // and F6's ten charters. A charter is withheld from the base mode
  // wholesale and arrives through its own moment rather than through
  // either drafted pool, so the read below holds the two ladders' own
  // withheld cards against the pools and names the charters' separate
  // route beside them.
  const WITHHELD = aboveClassic
    .filter((card) => card.kind !== "charter")
    .map((card) => card.id);
  const withheldCharters = aboveClassic.filter(
    (card) => card.kind === "charter",
  );
  check(
    WITHHELD.length === 3 &&
      WITHHELD.every(
        (id) => gambitBoons.includes(id) || gambitModules.includes(id),
      ) &&
      WITHHELD.every(
        (id) => !classicBoons.includes(id) && !classicModules.includes(id),
      ) &&
      gambitBoons.length + gambitModules.length ===
        classicBoons.length + classicModules.length + WITHHELD.length &&
      withheldCharters.length === CHARTERS.length &&
      withheldCharters.every((card) => card.modes.classic === 0),
    "three drafted cards are withheld from the base mode and they are exactly the ones above its ceiling, watched at the pool a captain is drafted from rather than in the arithmetic alone: each is offered in Ocean Gambit and absent from the base mode on the same state, so the field is read by the draw instead of merely stored beside it. The ten charters sit above the same ceiling wholesale, every one of them zeroed out of the base mode, because a charter is offered at its own moment rather than dealt by either drafted pool",
  );
  const early = voyageState({ difficulty: "open_waters" });
  const earlyBoons = idsOf(offerPool("boon", early));
  const earlyModules = idsOf(offerPool("module", early));
  check(
    earlyBoons.length > 0 &&
      earlyModules.length > 0 &&
      earlyBoons.length < gambitBoons.length &&
      earlyModules.length < gambitModules.length &&
      earlyBoons.every((id) => gambitBoons.includes(id)) &&
      earlyModules.every((id) => gambitModules.includes(id)),
    "and the round's tier still gates the pool through this new path: a captain on the first leg is offered fewer cards than a voyage with every wave open, and every one of them is inside the wider pool, which is the regression this reader had to keep when it replaced the old table of weights",
  );
  check(
    [
      ...offerPool("boon", wide),
      ...offerPool("module", wide),
      ...offerPool("boon", narrow),
      ...offerPool("module", narrow),
    ].every(([, weight]) => weight > 0),
    "and every weight the pool hands back is positive, which is the half of the zero that matters: a card this mode does not run, or this captain has no use for, is filtered out here rather than drawn with a zero chance, so nothing downstream has to reason about a card that can never come up",
  );

  // ---- The condition arms ----
  const condition = (id: string): CardCondition => cardOrThrow(id).condition;
  const flat = voyageState();
  check(
    conditionWeight(condition("silk_monopoly"), flat) === 1 &&
      conditionWeight(condition("favorable_tides"), flat) === 1.5,
    "the first arm answers with its own weight whatever the captain holds, which is the arm a card takes when it wants no say in who it is offered to",
  );
  const poor = voyageState();
  poor.money = 10;
  const exactly = voyageState();
  exactly.money = 30;
  check(
    conditionWeight(condition("emergency_loan"), poor) === 4.0 &&
      conditionWeight(condition("emergency_loan"), exactly) === 0.2,
    "the purse arm answers with the heavier weight while the captain is below the amount and the lighter one from the amount upward: a captain holding exactly thirty is not below thirty, so the boundary belongs to the other side, which is the reading a card that helps a captain who is short has to get right",
  );
  const over = voyageState();
  over.money = 41;
  const at = voyageState();
  at.money = 40;
  check(
    conditionWeight(condition("merchant_charm"), over) === 2.0 &&
      conditionWeight(condition("merchant_charm"), at) === 0.5 &&
      conditionWeight(condition("deep_sea_escort_pact"), poor) === 3.2,
    "and the other side of the same comparison is strictly above rather than at or above, so the two purse arms meet at the boundary without both answering for it. The pact leans the other way, which is worth reading beside them: it is offered hardest to a captain who cannot afford an escort, so the card does the work its own text describes rather than rewarding the captain who least needs it",
  );
  const oneBulk = voyageState();
  oneBulk.inventory = { "Copper Ore": 1 };
  const twoBulk = voyageState();
  twoBulk.inventory = { "Copper Ore": 1, "Porcelain Clay": 1 };
  const oneKindTwice = voyageState();
  oneKindTwice.inventory = { "Copper Ore": 2 };
  check(
    conditionWeight(condition("kiln_and_forge_guild"), oneBulk) === 1.0 &&
      conditionWeight(condition("kiln_and_forge_guild"), twoBulk) === 2.8 &&
      conditionWeight(condition("kiln_and_forge_guild"), oneKindTwice) ===
        2.8 &&
      holdOfTag(voyageState(), "bulk") === 8,
    "the hold arm counts units of the goods carrying its tag rather than kinds of them, so two units of one ore passes the same clause one unit of each passes, and the count is read off the vocabulary rather than off a list kept for this card. The last figure is the starting hold itself: the eight hemp a voyage leaves the pier with are bulk, so a fresh captain already sits inside the guild's clause, and the card's question is about the trade they are in rather than about a shopping trip",
  );
  const crewed = voyageState();
  hireWorker(crewed, "weaver", []);
  check(
    crewed.workers.weaver.length === 1 &&
      conditionWeight(condition("hemp_monopoly"), flat) === 1.0 &&
      conditionWeight(condition("hemp_monopoly"), crewed) === 2.0 &&
      conditionWeight(condition("artisan_inspiration"), flat) === 0.0 &&
      conditionWeight(condition("artisan_inspiration"), crewed) === 3.0,
    "the roster arm reads the crew a captain has aboard: the bulk monopoly is offered twice as hard to a captain with a weaver and simply offered without one, while the inspiration boon is offered not at all, which is the one zero the shape allows. A card about weaving is nothing to a captain with no weavers, and that is a fact about what they hold rather than about who they are",
  );
  check(
    !offerPool("boon", flat).some(
      ([card]) => card.id === "artisan_inspiration",
    ) &&
      offerPool("boon", crewed).some(
        ([card]) => card.id === "artisan_inspiration",
      ),
    "and that zero is read by the pool rather than left to the draw: the inspiration boon is absent from the table a crewless captain is dealt and present for the captain who hired the weaver, both off the same reader",
  );
  check(
    conditionWeight(
      { kind: "crew_role", roles: ["astrologer"], weight: 5, otherwise: 1 },
      crewed,
    ) === 1,
    "while a role the roster cannot hold answers the false arm rather than crashing or answering for a crew nobody could have: the role arrives from a card's record, so a typo or a retired trade is a card that is offered plainly rather than a round that ends on a missing key",
  );

  // ---- The lean and the weight ----
  check(
    pathLean(cardOrThrow("silk_wind"), "loom") === 2 &&
      pathLean(cardOrThrow("silk_wind"), "convoy") === 1 &&
      pathLean(cardOrThrow("silk_wind"), null) === 1,
    "the lean reads its own weight toward the path it leans to, one toward a path it does not lean to, and one for a captain who has taken no path at all: a lean is a weight and never a lockout, which is why the winds keep their full place in the pool for a convoy captain",
  );
  const leanless = CARDS.filter(
    (card) => Object.keys(card.pathWeight).length === 0,
  );
  check(
    leanless.length > 0 &&
      leanless.every((card) =>
        PATH_IDS.every((path) => pathLean(card, path) === 1),
      ),
    "and a card that leans nowhere is written as silence rather than as a map of ones, read back through the same reader as one for every path, so the two ways of saying the same thing cannot drift",
  );
  const pathless = voyageState();
  const loomCaptain = voyageState();
  loomCaptain.path = "loom";
  const convoyCaptain = voyageState();
  convoyCaptain.path = "convoy";
  check(
    idsOf(offerPool("boon", loomCaptain)).join(",") ===
      idsOf(offerPool("boon", pathless)).join(",") &&
      idsOf(offerPool("boon", convoyCaptain)).join(",") ===
        idsOf(offerPool("boon", pathless)).join(",") &&
      cardWeight(cardOrThrow("silk_wind"), loomCaptain) >
        cardWeight(cardOrThrow("silk_wind"), convoyCaptain),
    "the lean weights and never filters, which is the plan's own sentence about the field: the same cards are on offer to a loom captain, a convoy captain and a captain with no path at all, and what the path moves is the chance of seeing each of them rather than the list. The ids come back in ladder order because the pool is built off the ladders rather than off the weights",
  );
  const rich = voyageState();
  rich.money = 100;
  rich.path = "aroma";
  check(
    cardText(cardOrThrow("merchant_charm")).name === "Merchant's Charm" &&
      cardOrThrow("merchant_charm").modes.ocean_gambit === 1 &&
      cardWeight(cardOrThrow("merchant_charm"), rich) === 1 * 2.0 * 1.5 &&
      cardWeight(cardOrThrow("merchant_charm"), { ...rich, money: 10 }) ===
        1 * 0.5 * 1.5 &&
      cardWeight(cardOrThrow("deep_sea_escort_pact"), wide) === 1 * 1.8 * 1 &&
      cardWeight(cardOrThrow("deep_sea_escort_pact"), narrow) === 0,
    "the weight is the product of the three fields and nothing else: the mode's weight, the condition's answer and the path's lean, each read off the record rather than off a table here. The last line is the field doing its whole job, since a gambit only card weighs nothing at all in the base mode and the pool drops it before any draw sees it",
  );

  // ---- The draw ----
  const three: Array<[CardRecord, number]> = [
    [cardOrThrow("silk_wind"), 1],
    [cardOrThrow("favorable_tides"), 1],
    [cardOrThrow("tax_shelter"), 1],
  ];
  const all = drawOffer(three, 3, () => 0);
  check(
    all.length === 3 &&
      new Set(all.map((card) => card.id)).size === 3 &&
      all.map((card) => card.id).join(",") ===
        "silk_wind,favorable_tides,tax_shelter",
    "a draw of three off a pool of three comes back as three different cards, without replacement: once a card is drawn it leaves the pool, which is what makes the three presented cards three cards. A roll of zero lands on the first card in the pool and the draw walks on from there",
  );
  const light: Array<[CardRecord, number]> = [
    [cardOrThrow("silk_wind"), 1],
    [cardOrThrow("favorable_tides"), 1],
  ];
  const heavy: Array<[CardRecord, number]> = [
    [cardOrThrow("silk_wind"), 1],
    [cardOrThrow("favorable_tides"), 3],
  ];
  check(
    drawOffer(light, 1, () => 0.5)[0].id === "silk_wind" &&
      drawOffer(heavy, 1, () => 0.5)[0].id === "favorable_tides",
    "and the same roll lands on different cards in two pools that differ only in one weight, which is what makes the draw weighted rather than uniform: raising a card's weight moves the middle of the range onto it, and the random source is passed in rather than assumed so a check can hold the roll still while it watches that happen",
  );
  check(
    drawOffer([], 3, () => 0.5).length === 0 &&
      drawOffer(light, 5, () => 0.5).length === 2,
    "asking a pool for more cards than it holds answers with everything it has rather than looping or crashing, and an empty pool is a draw of nothing: both are ordinary states near the end of a voyage, when most of what a captain could be offered is already bolted to the hull",
  );

  // ---- The two drafts, through the engine ----
  const voyage = voyageState();
  startBoonDrafting(voyage, []);
  check(
    voyage.boonChoices.length === CARDS_PER_OFFER &&
      new Set(voyage.boonChoices.map((card) => card.id)).size ===
        CARDS_PER_OFFER &&
      voyage.boonChoices.every((card) =>
        offerPool("boon", voyage).some(([pooled]) => pooled.id === card.id),
      ),
    "the boon draft deals three different cards and every one of them is off the pool this captain's own state answers for: the engine no longer holds a single card's id at the draft, so a card added to the content arrives with its own offer behaviour rather than with an edit to the draft",
  );
  check(
    voyage.boonChoices.every(
      (card) => voyage.cardTally[card.id]?.offered === 1,
    ),
    "and every card on the table is counted as offered at the moment it is put in front of the captain rather than when it is chosen, because the plan's measure is the pair and the denominator of that pair is the offer",
  );
  const refused = voyageState();
  startBoonDrafting(refused, []);
  const standing = refused.boonChoices.map((card) => card.id).join(",");
  check(
    selectBoon(refused, "silk_monopoly", []) === false &&
      selectBoon(refused, "no_such_card", []) === false &&
      refused.boonChoices.map((card) => card.id).join(",") === standing &&
      (refused.cardTally.silk_monopoly?.picked ?? 0) === 0,
    "a module id handed to the boon draft is refused rather than applied, and so is an id no card holds: the table is left standing and nothing is counted as picked, which is the answer its caller needs, since the draft is left by choosing a boon and a call that matched nothing must not move the voyage on",
  );
  const first = refused.boonChoices[0];
  const firstFlags = first.effect.kind === "flags" ? first.effect.flags : null;
  check(
    selectBoon(refused, first.id, []) === true &&
      refused.boonChoices.length === 0 &&
      refused.cardTally[first.id]?.picked === 1 &&
      firstFlags !== null &&
      JSON.stringify(refused.modifierFlags) === JSON.stringify(firstFlags),
    "a real boon takes: the flags the record carries land on the round in one write, the table clears, and the card's pick is counted, so the tally holds one offer and one pick for a card that was dealt and taken. The comparison is content rather than object identity because the write folds any held flags in beneath the card's own, and this captain holds nothing yet",
  );
  const loaned = voyageState();
  const purse = loaned.money;
  selectBoon(loaned, "emergency_loan", []);
  check(
    loaned.money === purse + 40 &&
      loaned.modifierFlags.instant_gold === 40 &&
      cardOrThrow("emergency_loan").effect.kind === "flags",
    "and the one boon that pays on the spot pays what its record says, once, at the moment it is applied: the flag it leaves behind is what the endgame summary prints, so the gold and the line about the gold come from the same authored number",
  );
  const yard = voyageState();
  startModuleDrafting(yard);
  check(
    yard.phase === "module_draft" &&
      (yard._draftChoices?.length ?? 0) === CARDS_PER_OFFER &&
      new Set(yard._draftChoices?.map((card) => card.id)).size ===
        CARDS_PER_OFFER &&
      (yard._draftChoices ?? []).every(
        (card) =>
          card.kind === "module" &&
          offerPool("module", yard).some(([pooled]) => pooled.id === card.id),
      ),
    "the shipyard deals three different modules off the same weighted reader, so the two drafts share one draw and one tally rather than each keeping its own",
  );
  const parked = yard._draftChoices?.[0];
  const drafted = yard.phase === "module_draft";
  handleModuleSelect(yard, 0, []);
  check(
    parked !== undefined &&
      drafted &&
      yard.shipLevel === 0 &&
      yard.phase === "module_swap" &&
      yard._newModule?.id === parked.id &&
      (yard._draftChoices ?? []).length === CARDS_PER_OFFER,
    "a module picked with no slot open is parked rather than installed: the leg moves to the swap, the choice waits in its own field, and the table still holds all three, so backing out with a look at the draft still shows every original option",
  );
  const hull = voyageState();
  hull.shipLevel = 1;
  startModuleDrafting(hull);
  const chosen = hull._draftChoices?.[0];
  const offeredBefore = chosen ? hull.cardTally[chosen.id]?.offered : undefined;
  handleModuleSelect(hull, 0, []);
  check(
    chosen !== undefined &&
      hull.phase === "dusk" &&
      hull.equippedModules.some((card) => card.id === chosen.id) &&
      (hull.cardTally[chosen.id]?.picked ?? 0) === 1 &&
      offeredBefore === 1 &&
      (hull._draftChoices ?? []).every((card) => card.id !== chosen.id),
    "while a module picked with a slot open installs, moves the leg on, drops out of the table since the pick is final, and is counted as taken where the card actually lands: a module parked for a swap can still be backed out of, and only a card that joined the hull is a card that was taken",
  );

  // ---- The tally and the report ----
  check(
    Object.keys(normalizeCardTally(undefined)).length === 0 &&
      Object.keys(normalizeCardTally(null)).length === 0 &&
      Object.keys(normalizeCardTally("nonsense")).length === 0 &&
      Object.keys(normalizeCardTally({})).length === 0,
    "a save that carries no tally reads as an empty one, whichever of the four ways it carries nothing: the field is read back out as a measurement, so all four arms are checked rather than trusted",
  );
  const salvaged = normalizeCardTally({
    silk_wind: { offered: 10, picked: 4 },
    silk_monopoly: { offered: 3, picked: 9 },
    retired_card: { offered: 5, picked: 1 },
    favorable_tides: { offered: -2, picked: 1.5 },
    tax_shelter: { offered: "3", picked: 1 },
    merchants_converge: { offered: 0, picked: 0 },
  });
  check(
    Object.keys(salvaged).join(",") === "silk_wind,silk_monopoly" &&
      salvaged.silk_wind.offered === 10 &&
      salvaged.silk_monopoly.picked === 3,
    "a count is a whole number of at least zero, a card this build does not know is dropped rather than carried, and a pick count above the offer count is trimmed to it: a card cannot be taken more often than it was put on the table, and a row of zeroes is the absence of a reading rather than a reading of zero",
  );
  const tally: CardTally = {};
  noteCardOffer(tally, cardOrThrow("silk_wind"));
  noteCardOffer(tally, cardOrThrow("silk_wind"));
  noteCardPick(tally, cardOrThrow("silk_wind"));
  check(
    Object.keys(tally).length === 1 &&
      tally.silk_wind.offered === 2 &&
      tally.silk_wind.picked === 1,
    "the two writes share one entry, so the shape of a tally entry has one home rather than one per site that counts something, and the pair a card carries is always an offer count and a pick count of the same card",
  );
  check(
    CARD_CONVERSION_FLOOR === 40,
    "the floor a rate is read from is forty appearances, which is the plan's own two numbers read together and F7's combination floor as well, so the two instruments agree about what counts as evidence",
  );
  const measured = readCardConversion({
    silk_wind: { offered: 39, picked: 39 },
    favorable_tides: { offered: 40, picked: 10 },
    tax_shelter: { offered: 100, picked: 5 },
  });
  check(
    measured.length === 3 &&
      measured[0].id === "favorable_tides" &&
      measured[0].rate === 0.25 &&
      measured[0].name === "Favorable Tides" &&
      measured[0].kind === "boon" &&
      measured[1].id === "tax_shelter" &&
      measured[1].rate === 0.05 &&
      measured[2].id === "silk_wind" &&
      measured[2].rate === null,
    "one appearance below the floor is not a rate at all, even at a hundred percent, which is the plan's own warning about a high rate over nine appearances. The measurable cards come first and are ordered by rate, so the card worth looking at is the first row, and the row carries the card's name and kind rather than leaving a reader to look them up",
  );
  check(
    readCardConversion({
      silk_wind: { offered: 5, picked: 2 },
      favorable_tides: { offered: 9, picked: 1 },
    })[0].id === "favorable_tides" &&
      readCardConversion({
        silk_wind: { offered: 5, picked: 2 },
      }).every((reading) => reading.rate === null) &&
      readCardConversion({}).length === 0,
    "with the unmeasurable ordered by appearances, since the card seen most often is the next one to become measurable, and an empty tally reading as no rows at all rather than as a crash or a row of zeroes",
  );
  const saved = voyageState();
  saved.cardTally = {
    silk_wind: { offered: 5, picked: 2 },
    retired_card: { offered: 2, picked: 1 },
  };
  healLoadedVoyage(saved, { legacyRenownLevel: null });
  check(
    saved.cardTally.silk_wind?.offered === 5 &&
      saved.cardTally.silk_wind?.picked === 2 &&
      !("retired_card" in saved.cardTally),
    "a save that comes back off the server carrying a card this build does not know heals to the cards it does, through the same load pass every other saved field goes through: the tally is a measurement, so a stale id would print as a nameless row in the report rather than as a card nobody can explain",
  );

  // ---- The tag reads, in production ----
  check(
    carriesTag("good", "Hemp", "bulk") &&
      carriesTag("good", "Silk", "woven") &&
      !carriesTag("good", "Silk", "bulk") &&
      !carriesTag("food", "Grain", "bulk") &&
      !carriesTag("good", "no_such_good", "bulk"),
    "the tag read answers true for a good carrying the tag, false for the same good under a tag it does not carry, false for a food key read as a good, and false rather than throwing for an id no catalogue holds, which is F1's null read as the false it means",
  );
  const hold = voyageState();
  hold.inventory = { Hemp: 4, "Copper Ore": 3, Tea: 9 };
  check(
    holdOfTag(hold, "bulk") === 7 &&
      holdOfTag(hold, "perishable") === 9 &&
      holdOfTag(hold, "luxury") === 0 &&
      goodsCarryingTag("bulk").length === 3 &&
      goodsCarryingTag("bulk").includes("Copper Ore"),
    "the hold sums the goods the vocabulary points at rather than a list kept beside it: hemp and ore are bulk and tea is not, the tea is perishable on its own, and no good in that hold is luxury, so one reader answers all three questions the cards ask",
  );
  check(
    cargoCarriesTag([{ type: "Hemp" }], "bulk") &&
      cargoCarriesTag([{ type: "Hemp" }], "woven") &&
      !cargoCarriesTag([{ type: "Hemp" }], "luxury") &&
      !cargoCarriesTag([], "bulk"),
    "and an order's own manifest is read through the same vocabulary, which is what lets a card pay on the freight a captain actually signed for: an empty manifest carries nothing, for the reason an empty hold holds nothing",
  );

  // ---- The validator ----
  const shipped = shippedCards();
  check(
    validateCards(shipped).length === 0,
    "the pool the tree ships passes every clause, which is the run the build itself gates on, so a card that breaks one of the rules below is a failed build rather than a card somebody notices in a draft",
  );
  const broken = (patch: Partial<CardRecord>): CardSubject => ({
    ...shipped,
    cards: shipped.cards.map((card, at) =>
      at === 0 ? { ...card, ...patch } : card,
    ),
  });
  const brokenModule = (patch: Partial<CardRecord>): CardSubject => ({
    ...shipped,
    cards: shipped.cards.map((card) =>
      card.id === "silk_monopoly" ? { ...card, ...patch } : card,
    ),
  });
  // A subject with the key ledger switched off, for the fixtures whose
  // clause is about the record's own shape: a card broken below stops
  // counting as its flag's writer, and the ledger's finding about the key
  // it leaves unwritten is asked of its own fixtures further down rather
  // than riding along with every other clause's answer.
  const withoutLedger = (subject: CardSubject): CardSubject => ({
    ...subject,
    modifierKeys: undefined,
  });
  // A clause is asked for its finding and for nothing else, since a rule
  // that fired alongside three others could be firing for the wrong reason.
  const sole = (subject: CardSubject): string | null => {
    const found = validateCards(subject);
    return found.length === 1 ? found[0] : null;
  };
  check(
    sole({
      ...shipped,
      cards: shipped.cards.map((card, at) =>
        at === 1 ? { ...card, id: shipped.cards[0].id } : card,
      ),
    })?.includes("two cards share this id") === true,
    "two records sharing an identifier are caught, which is the one failure the pool cannot heal from: every save, standing order and wire frame stores the id, so a second card answering to it would silently take the first card's picks",
  );
  check(
    sole(broken({ id: "" }))?.includes("no identifier") === true,
    "a card with no identifier at all is caught too, because an id is what the ledger line and the tally row are keyed by",
  );
  check(
    sole(broken({ trigger: "shipyard_draft" as CardTrigger }))?.includes(
      "arrives at",
    ) === true,
    "a card whose trigger disagrees with its kind is caught, since the trigger is read off the map rather than off the record and a card that said otherwise would be a card offered at a draft that never deals it",
  );
  check(
    (() => {
      const notAKind = validateCards(
        withoutLedger(broken({ kind: "relic" as CardRecord["kind"] })),
      );
      return (
        notAKind.length === 2 &&
        notAKind.some((finding) =>
          finding.includes("is not a kind a card can have"),
        ) &&
        notAKind.some((finding) => finding.includes("arrives at"))
      );
    })(),
    "and a kind outside the plan's three is caught twice over, once for the kind itself and once for the trigger that follows from it: a kind nothing can offer is a card the pool would carry forever without ever dealing it, and a record whose kind and trigger disagree is a record the validator refuses to read either half of on trust",
  );
  check(
    sole(broken({ tags: [] as unknown as TagList }))?.includes(
      "carries no tag",
    ) === true,
    "an entry carrying no tags is caught, which is the clause that holds content the compiler did not check: the type cannot express an empty set, so a card read out of a file, or a record cast past the type, is how one arrives bare",
  );
  check(
    sole(
      broken({ tags: ["woven", "luxury", "cold"] as unknown as TagList }),
    )?.includes("carries 3 tags") === true,
    "a third tag on a card is caught, which is F1's ceiling asked of the pool the same way it is asked of every catalogue: every tag a card carries doubles the space a balance pass has to cover",
  );
  check(
    sole(broken({ tags: ["woven", "woven"] as unknown as TagList }))?.includes(
      "carries a tag twice",
    ) === true,
    "a tag written down twice is caught rather than counted once, because a ceiling of two that a three entry set could pass is not a ceiling",
  );
  check(
    sole(broken({ tags: ["silk"] as unknown as TagList }))?.includes(
      "is not one of the twelve tags",
    ) === true,
    "and a tag outside the closed twelve is caught on the card itself, which is the reading F1's walk takes of every catalogue entry applied to a card shaped subject: a tag no effect will ever look up is a typo whether the pool it sits in is a catalogue or a deck",
  );
  check(
    sole(broken({ power: 0 }))?.includes("at least one") === true &&
      sole(broken({ power: 2.5 }))?.includes("at least one") === true,
    "power has to be a whole number of at least one, since it is spent as a budget against a ceiling and a fraction or a zero is a card whose cost nobody can add up",
  );
  check(
    sole(broken({ modes: { classic: 0, ocean_gambit: 0 } }))?.includes(
      "no mode offers it",
    ) === true,
    "a card no mode runs is caught, which is the clause that keeps the mode list honest: a card with a zero in both halves is a record the pool can never draw, and it would sit in the tree looking like content",
  );
  check(
    sole(broken({ power: 4 }))?.includes("above classic's ceiling") === true,
    "a card above a mode's ceiling that still carries a weight there is caught, and that pair is what makes the ceiling a ceiling rather than a comment: a card above it has to be zeroed out of that mode rather than merely unlikely in it",
  );
  check(
    sole(
      broken({ pathWeight: { galleon: 2 } as CardRecord["pathWeight"] }),
    )?.includes("is not a path") === true,
    "a lean toward something that is not a path is caught, because a lean nobody can read is a weight that quietly never applies",
  );
  check(
    sole(broken({ pathWeight: { loom: 0 } }))?.includes(
      "a lean is never a lockout",
    ) === true,
    "and a lean of zero is caught rather than treated as a filter, which is the plan's own sentence about this field: the draw is weighted so that a captain is never locked out of the rest of the pool, and a zero here would be exactly that lockout wearing a weight",
  );
  check(
    sole(
      broken({
        condition: {
          kind: "crew_role",
          roles: ["astrologer"],
          weight: 1,
          otherwise: 1,
        },
      }),
    )?.includes("asks for a crew role the roster cannot hold") === true,
    "a condition asking for a trade the roster cannot hold is caught, because the engine would answer it false for every captain alive and the card would be offered to nobody: the reader is defensive, so this is a content failure rather than a crash, and a content failure has to be caught here instead",
  );
  check(
    sole(withoutLedger(broken({ effect: { kind: "hull" } })))?.includes(
      "a boon writes the round's flags",
    ) === true,
    "a boon whose effect is not the flags is caught, since the draft applies a boon by writing what its record carries and a boon carrying a hull would be a card that changes nothing at all",
  );
  check(
    sole(
      withoutLedger(broken({ effect: { kind: "flags", flags: {} } })),
    )?.includes("writes no flag") === true,
    "and a boon that writes no flags is caught even when its shape is right: an empty flag set is a card a captain can pick, and pay for, and receive nothing from",
  );
  check(
    sole({
      ...shipped,
      cards: shipped.cards.map((card) =>
        card.id === "merchant_charm"
          ? {
              ...card,
              effect: {
                kind: "flags",
                flags: {
                  purchase_discount: 0.15,
                  transport_silk_discount: 0.5,
                },
              },
            }
          : card,
      ),
    })?.includes(
      "writes transport_silk_discount, which silk_wind already writes",
    ) === true,
    "and a key two cards write is caught and names both, because the ledger reads a modifier's source by finding the card that writes its key and that reader takes the first match: two writers would make the source a function of table order, and the day they disagreed the breakdown would quietly print the wrong card's name",
  );
  check(
    sole({
      ...shipped,
      cards: shipped.cards.filter((card) => card.id !== "silk_wind"),
    })?.includes("no card writes transport_silk_discount") === true,
    "while a key no card writes is caught in the other direction, because every key the vocabulary names has a read site in the engine: a renamed key on one side of that pair is a read site waiting on a flag that never arrives, and this clause is what fails the build the day the two sides part",
  );
  // ---- F6's pairing clause ----
  // The clause reads the charter id to path map rather than the records,
  // so its fixtures patch the map and the findings are read in pairs:
  // what the map itself got wrong, then the count that same mistake
  // leaves a path with. The pairing is the clause's shape rather than
  // two clauses, because a map edited wrongly is never wrong about one
  // thing.
  const pairing = (charterPaths: Record<string, string>): string[] =>
    validateCards({ ...shipped, charterPaths });
  const orphaned = pairing({
    ...(shipped.charterPaths ?? {}),
    ghost_charter: "loom",
  });
  check(
    orphaned.length === 2 &&
      orphaned[0].includes("no card carries this id") &&
      orphaned[1].includes("carries 3 charters"),
    "an entry pairing a charter the pool does not have is caught, and the path it was filed under is caught carrying one too many: an orphan entry is never a mistake about one thing, since the count it inflates is the same edit read again",
  );
  const unpaired = { ...(shipped.charterPaths ?? {}) };
  delete unpaired.bulk_charter;
  const missing = pairing(unpaired);
  check(
    missing.length === 2 &&
      missing[0].includes("a charter with no path") &&
      missing[1].includes("carries 1 charters"),
    "a charter the map forgets is caught in the other direction, and its path is caught short by the same edit: a charter no trio can pair is a card in the pool that no captain can ever be offered, which is the failure the two per path count exists to make loud",
  );
  const misrouted = pairing({
    ...(shipped.charterPaths ?? {}),
    bulk_charter: "galleon",
  });
  check(
    misrouted.length === 2 &&
      misrouted[0].includes("which is not a path") &&
      misrouted[1].includes("carries 1 charters"),
    "and a charter filed under something that is not a path is caught, its old path caught short with it: the map is what the trio's first two slots read, so a path name the game does not have is a slot that silently deals nothing",
  );
  check(
    sole(
      brokenModule({ effect: { kind: "flags", flags: { instant_gold: 1 } } }),
    )?.includes("a module works by being installed") === true,
    "a module whose effect is not the hull is caught in the other direction: a hull card's mechanism is its identifier, and a module carrying flags would be a card the engine never reads the flags of",
  );
  check(
    sole(
      broken({
        strings: {
          en: cardOrThrow("silk_wind").strings.en,
          zh: undefined,
        } as unknown as CardRecord["strings"],
      }),
    )?.includes("carries no zh string") === true,
    "a card missing a language is caught, which is J3 read forward as a gate rather than as a hope: the pool has to carry both strings from the beginning, so a card that arrives with one fails the build rather than the translation pass",
  );
  check(
    sole(
      broken({
        strings: {
          en: { name: "Weaver's Winds", desc: " " },
          zh: cardOrThrow("silk_wind").strings.zh,
        },
      }),
    )?.includes("the en string is empty") === true,
    "as is a card whose string is there but blank, since a name of spaces is a card a captain cannot read and a check looking only for a missing key would pass it",
  );
  check(
    sole(
      broken({
        strings: {
          en: { name: "Silk Wind", desc: "Woven goods cost less this round." },
          zh: cardOrThrow("silk_wind").strings.zh,
        },
      }),
    )?.includes("the en text names Silk") === true,
    "and a card whose text names a good is caught, which is the scan the plan puts in F1's evaluation and F2 carries into the build: the copy a captain reads is held to the same rule the effect is, because a card that names Silk while its tag says woven teaches the wrong lesson twice",
  );
  check(
    validateCards(
      broken({
        strings: {
          en: {
            name: "Artisan's Workshop",
            desc: "Workers produce 1 extra item each round.",
          },
          zh: cardOrThrow("silk_wind").strings.zh,
        },
      }),
    ).length === 0,
    "while the same scan reads a name rather than a word: the artisan's workshop says that its workers produce, and Produce is a food, so the scan is case sensitive on purpose. A scan that could not tell those apart would fail the build over a verb",
  );

  // ---- The house rule ----
  check(
    [
      "src/lib/game/constants/cards.ts",
      "src/lib/game/cards.ts",
      "src/lib/game/constants/charters.ts",
      "src/lib/game/constants/drafts.ts",
      "src/lib/game/engine/boons.ts",
      "src/lib/game/engine/pricing.ts",
      "src/lib/game/engine/orders.ts",
      "src/lib/game/glossary.ts",
      "src/lib/game/standing.ts",
      "src/lib/game/pools.ts",
      "scripts/cards.ts",
      "scripts/cardConversion.ts",
    ].every((file) => !carriesADash(file)),
    "and every file this feature lands in is free of em dashes, en dashes and doubled hyphens, in its comments as well as in the words a captain reads",
  );
  check(
    CARDS.every((card) =>
      LANGUAGES.every((language) => {
        const text = card.strings[language];
        return (
          !CARRIES_A_DASH.test(text.name) && !CARRIES_A_DASH.test(text.desc)
        );
      }),
    ),
    "which the card text itself keeps, read straight off the records in both languages: every string on the face is a captain's words, so the house rule is held there by the same expression the source files are held by, and a dash the validator never looks for is a dash that ships",
  );
}
