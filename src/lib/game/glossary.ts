// =====================================================================
// PortMasters 2.2 Parallel Release: terminology glossary
// Short, plain language descriptions for anything a new captain might
// hover over and wonder about. Pulled in by the <Term> component
// (src/components/portmasters/Term.tsx) wherever that term is used as a
// label across the status panel, the phase screens, and the player
// detail popup.
// =====================================================================
import { BOONS, MODULES } from "./constants";

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
    "Your score for the voyage, roughly your accumulated trading profit. Highest reputation after round 8 wins.",
  Gold: "Your spendable funds. Hit zero with bills still due and the voyage ends in bankruptcy.",
  VAT: "A 5% tax on the profit margin of finished good sales (selling price minus material cost minus wage). Raw material sales aren't taxed this way.",
  "Income Tax":
    "A 10% tax on your net profit for the round, charged at Phase 3 settlement after everything else is paid.",
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
  Barter:
    "A short window right after buying where captains trade directly with each other instead of through the market. Post what you have for what you want; the offered amount is set aside the moment you post it, and comes back to you if it's canceled or nobody takes it.",
  "Pirate Attack":
    "A 20% chance, rolled at Phase 3 before wages and maintenance come due, of losing every Gold coin you're carrying. Hire an escort beforehand to guarantee safe passage instead of risking it.",
  Escort:
    "Guarantees safe passage from that round's pirate attack, for a cost of 10% of your current Gold. Once hired, the round's pirates are no longer a risk.",
  "Financial Aid":
    "A loan from another captain when you can't cover this round's wages or maintenance on your own. The lender's Gold transfers to you immediately; you owe it back before the voyage ends, or it's deducted automatically and handed to them at Round 8.",
  Debt: "Gold you owe another captain after taking a loan. Repay it any time before Round 8 ends. If you still can't cover it by then, the amount still owed comes straight out of your funds and you're marked bankrupt when the voyage finishes.",
};

for (const b of BOONS) GLOSSARY[b.name] = b.desc;
for (const m of MODULES) GLOSSARY[m.name] = m.desc;
