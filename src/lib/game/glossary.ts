// =====================================================================
// PortMasters 2.2 Parallel Release: terminology glossary
// Short, plain language descriptions for anything a new captain might
// hover over and wonder about. Pulled in by the <Term> component
// (src/components/portmasters/Term.tsx) wherever that term is used as a
// label across the status panel, the phase screens, and the player
// detail popup.
// =====================================================================
import { BOONS, FLEXIBLE_BARTER_UNLOCK_LEVEL, MODULES } from "./constants";
import { DIFFICULTIES, pirateOddsLabel } from "./difficulty";
import { INCOME_TAX_RATE, VAT_RATE } from "./engine";

// The escort fee is a charter dial, 10% on Fair Winds and steeper on the
// two that follow, so the one figure this entry used to quote for all
// three charters was wrong on two of them. Built from the config instead,
// the same way the boon and module entries at the bottom of this file are,
// which is the only version of it that cannot go stale.
const ESCORT_ENTRY = `Guarantees safe passage from that round's pirate attack, for a fee the charter sets as a share of your Gold: ${Object.values(
  DIFFICULTIES,
)
  .map((c) => `${Math.round(c.escortCostRate * 100)}% on ${c.name}`)
  .join(", ")}. Once hired, the round's pirates are no longer a risk.`;

// The pirate odds are a charter dial as well, and the two tiers that raise
// theirs at the midpoint raise it to a different figure, so the one sentence
// that used to carry all three was three chances to go stale at once. Built
// from the same table the escort entry above reads.
const PIRATE_ENTRY = `A roll at Phase 3, before wages and maintenance come due, that can take every Gold coin you're carrying. The charter sets the odds: ${Object.values(
  DIFFICULTIES,
)
  .map((c) =>
    c.pirateChance.length === 1
      ? `${pirateOddsLabel(c)} on ${c.name}`
      : `${pirateOddsLabel(c)} past the midpoint on ${c.name}`,
  )
  .join(
    ", ",
  )}. Hire an escort beforehand to guarantee safe passage instead of risking it.`;

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
    "Makes Linen Clothes or Cotton Clothes. Costs a wage every round, paid at Phase 3, whether or not they're working.",
  "Master Weaver":
    "Makes Linen Clothes, Cotton Clothes, or Brocade. Pricier than a Weaver, and the only one who can make Brocade.",
  "Sachet Maker":
    "Makes Sachets. The most expensive artisan to hire, but Sachets pay the best.",

  // Core stats
  Reputation:
    "Your score for the voyage, roughly your accumulated trading profit. Highest reputation on the voyage's final round wins.",
  Gold: "Your spendable funds. Hit zero with bills still due and the voyage ends in bankruptcy.",
  VAT: `A ${Math.round(VAT_RATE * 100)}% tax on the profit margin of finished good sales (selling price minus material cost minus wage). Raw material sales aren't taxed this way.`,
  "Income Tax": `A ${Math.round(INCOME_TAX_RATE * 100)}% tax on your net profit for the round, charged at Phase 3 settlement after everything else is paid.`,
  Freight:
    "The shipping fee for completing a trade order, based on how many items you're moving. Reduced by your ship level and certain boons or modules.",
  Maintenance:
    "A fixed per round upkeep fee for your ship, due at Phase 3 regardless of how the round went.",
  "Ship Level":
    "Raises your module slots and gives a flat discount on freight costs. Upgraded from the Shipyard in Phase 4.",
  Wages:
    "What your hired artisans cost per round, paid at Phase 3 whether they produced anything or not.",
  Boon: "A one round bonus you draft at the start of each voyage. It's picked personally, so your three choices differ from everyone else's.",
  Module:
    "A permanent ship upgrade, drafted from the Shipyard once you have a free slot. Stays equipped until you swap it out.",
  Barter: `Trade directly with another captain instead of through the market, on the Captain's Exchange during the Bartering phase or from the harbor chat once you reach Renown Level ${FLEXIBLE_BARTER_UNLOCK_LEVEL}. Post what you have for what you want; the offered amount is set aside the moment you post it, and comes back to you if it's canceled, if nobody takes it, or if a flexible offer of yours is taken and this one is retired with it.`,
  "Pirate Attack": PIRATE_ENTRY,
  Escort: ESCORT_ENTRY,
  "Financial Aid":
    "A loan from another captain when you can't cover this round's wages or maintenance on your own. The lender's Gold transfers to you immediately; you owe it back before the voyage ends, or it's deducted automatically and handed to them at the voyage's final round.",
  Debt: "Gold you owe another captain after taking a loan. Repay it any time before the voyage ends. If you still can't cover it by the final round, the amount still owed comes straight out of your funds and you're marked bankrupt when the voyage finishes.",
};

for (const b of BOONS) GLOSSARY[b.name] = b.desc;
for (const m of MODULES) GLOSSARY[m.name] = m.desc;
