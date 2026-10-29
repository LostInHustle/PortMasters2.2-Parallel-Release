// The known keys a boon can write into GameState.modifierFlags.
//
// Exported as a runtime array so the content check can verify exactly one
// card writes each, and ModifierKey is derived from it. The list lives in
// ./constants rather than ../types because the card pool reads it at
// runtime while types.ts imports ../standing, and keeping it in types.ts
// closed a cycle (types -> standing -> cards -> types).
//
// Keys from "steady_rations" on belong to held cards (milestone boons and
// charters) and are disjoint from round card keys.
export const MODIFIER_KEYS = [
  "transport_flat_discount",
  "transport_silk_discount",
  "purchase_discount",
  "worker_bonus_production",
  "instant_gold",
  "income_tax_override",
  "hemp_price_reduction",
  "hire_discount",
  "free_intel",
  "charter_order_bonus",
  "vat_discount",
  "extra_order",
  "escort_discount",
  "pirate_risk_discount",
  "exotic_order_bonus",
  "steady_rations",
  "cold_hardened",
  "route_mastery",
  "harbor_credit",
  "fleet_color",
  "transport_per_lot_discount",
  "manifest_order_bonus",
  "guns_risk_discount",
  "standing_escort_discount",
  "loom_extra_produce",
  "loom_sale_bonus",
  "voyage_purchase_discount",
  "voyage_dues_discount",
  "factor_borrows",
  "factor_penalty",
  "marque_salvage",
] as const;

export type ModifierKey = (typeof MODIFIER_KEYS)[number];
