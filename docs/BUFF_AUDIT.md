# PortMasters 2.2 Parallel Release: Buff Audit

Every boon, every ship module, every House perk, every Age, every difficulty modifier, every Renown rule and every social economy effect was traced from where it is declared to where it is read. This document records what was found.

## What happened to these findings

Every defect below has since been repaired. The audit is kept in the tense it was written in, because a record of what was found is worth more than a list quietly edited after the fact, so this section is the one place that says what became of each.

| Finding                                                      | Outcome                                                                                                                                                               |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The two charter boons are the same boon                      | Split. Kiln and Forge Guild reads a tier 1 gate and Exotic Treasures reads a tier 2 gate, so each pays on the goods it names.                                         |
| Silk Winds and Silk Road Monopoly miss two Silk goods        | Closed at the root. The list is gone with the card record: both cards read the `woven` tag, which takes Foreign Balm and Pearl String through the goods' own recipes. |
| Settlement shows a pirate risk higher than the one rolled    | The panel calls the same chance function and the same modifiers the roll applies.                                                                                     |
| Settlement shows an escort price higher than the one charged | The panel calls the accessor `hireEscort` charges through.                                                                                                            |
| Harbor Pulse is calibrated to three goods                    | The baseline is one over the number of goods actually in the tally.                                                                                                   |
| The Phase 1 price reference misses two module discounts      | The reference applies the same module discounts the counter applies.                                                                                                  |
| A load timeout and a load error both drop the Renown bonus   | A failed load leaves the captain's Renown level where it was.                                                                                                         |
| Six numbers the interface states that the game does not      | All six corrected.                                                                                                                                                    |
| Three things that are written and read by nothing            | The House perks and the Age effects are wired in and live. The Harbor activity feed was removed rather than wired, button and panel and palette rung together.        |
| The pledge that strands                                      | The conclusion sweep treats a bankrupt borrower as absent, so their loan is swept and the pledge riding on it resolves.                                               |
| Dead payload and a dead computation                          | The three unread standings fields, the crown total that was summed and never sent, and the unused ship count are gone.                                                |
| Two comments naming different boards for one surge           | Both name the Purchase board now, which is where the surge is added.                                                                                                  |

One entry in the last section is deliberately left as it was found. `CaptainMerit.earnedAt` is still stored and still never printed, and it stays: a timestamp on an achievement is a record of when it was earned rather than a field pretending to be one. The Harbor activity feed was the other one, and it is gone: the shelf button, its always empty panel and the hue that dressed them were removed on 2026-10-04 rather than left standing over an endpoint that was never built.

## How the audit was run

The game declares its buffs in one place and applies them in another. A boon is a row in `src/lib/game/constants/drafts.ts` with a `modifiers` object. A module is a row in the same module with a `penalty` or a named flag. A House perk is one of four booleans in `src/lib/game/engine/houses.ts`. An Age is a number in `src/lib/game/engine/ages.ts`.

For each one the audit did three things:

1. Found every site that grants the buff, and confirmed a captain can actually reach it.
2. Found every site that reads it, and confirmed the read is wired to the effect the description promises.
3. Compared the promise to the result. A buff whose text says one thing and whose code does another is a bug even when it technically runs.

The known failure mode in this codebase is the third kind and the second kind both: an effect that is declared, is visible to the player, and is read by no part of the voyage. Two of those were already found and are documented in `docs/RELEASE_NOTES.md`. This audit was looking for the rest.

The audit was performed by reading the code. Nothing here was confirmed by playing a live voyage.

## What was covered

| Family               | Count                | Where it lives                      |
| -------------------- | -------------------- | ----------------------------------- |
| Boons                | 14, over three tiers | `src/lib/game/constants/drafts.ts`  |
| Ship modules         | 14, over three tiers | `src/lib/game/constants/drafts.ts`  |
| Modifier keys        | 15                   | `src/lib/game/types.ts`             |
| House perks          | 4 fields, 3 Houses   | `src/lib/game/engine/houses.ts`     |
| Ages                 | 3                    | `src/lib/game/engine/ages.ts`       |
| Difficulty modifiers | 3 tiers              | `src/lib/game/difficulty.ts`        |
| Captain's Merits     | 9                    | `src/lib/game/merits.ts`            |
| Renown titles        | 7                    | `src/lib/game/legacy.ts`            |
| Social economy       | 6 systems            | `src/lib/game/engine/` and realtime |
| Harbor systems       | Harbor Pulse and two | `src/lib/game/harborPulse.ts`       |

## Defects

### The two charter boons are the same boon

`kiln_and_forge_guild` says Celadon Ware and Bronze Mirror orders pay 15 percent more. `exotic_treasures` says Foreign Balm and Pearl String orders pay 15 percent more. Those are the tier 1 finished goods and the tier 2 finished goods, so the two boons are meant to be opposites.

Both are gated on the same test at `src/lib/game/engine/orders.ts:82`, `hasCharterGood`, which calls the helper at `src/lib/game/pools.ts`:

```typescript
export function isCharterGood(item: string): boolean {
  return (
    (RESOURCES_TIER1 as readonly string[]).includes(item) ||
    (PRODUCTS_TIER1 as readonly string[]).includes(item) ||
    (RESOURCES_TIER2 as readonly string[]).includes(item) ||
    (PRODUCTS_TIER2 as readonly string[]).includes(item)
  );
}
```

The helper answers "is this a charter good of any tier". It cannot tell tier 1 from tier 2, so both boons fire on both tiers. A captain holding Kiln and Forge Guild gets a bonus on Pearl String orders, which the boon never mentions, and the reverse is true of Exotic Treasures. Since `applyBoon` replaces `modifierFlags` wholesale, a captain can only ever hold one of them, and which one they hold makes no difference to the payout.

The fix is to split the helper in two, one for each tier, and gate each boon on its own.

The Maritime Bureau Token module uses the same gate, and there it is correct: the module promises a bonus on charter goods without naming a tier, which is exactly what the helper answers.

### Silk Winds and Silk Road Monopoly miss two Silk goods

`src/lib/game/engine/orders.ts:66`:

```typescript
const hasSilk = order.resources.some((r) =>
  ["Silk", "Brocade", "Sachet", "Cotton Clothes"].includes(r.type),
);
```

The Silk Winds boon and the Silk Road Monopoly module both read this. The list omits Foreign Balm and Pearl String.

Both of those are made with Silk. `RECIPES` at `src/lib/game/constants/goods.ts:104` gives Foreign Balm as `{Spices: 2, Silk: 1}` and Pearl String as `{Pearls: 2, Silk: 1}`. Both carry Silk at the same one to one ratio as Cotton Clothes at `{Hemp: 2, Silk: 1}`, which the list does include. So the list covers a good at a given Silk ratio and misses two others at the identical ratio.

The two boons do nothing for the two most valuable goods in the game.

### Settlement shows a pirate risk higher than the one that is rolled

`src/components/portmasters/game/phases/PirateAttack.tsx:38` computes the displayed risk as `Math.round(pirateChance(game) * 100)`, straight off the engine's reader.

It used to compute the figure by hand, from the base chance and the leak:

```typescript
const raidPct = Math.round(
  Math.min(
    1,
    pirateChanceFor(game.difficulty, game.currentRound, game.maxRounds) + leak,
  ) * 100,
);
```

under a comment reading that this is "so what the captain reads is the real chance". It was not: the actual roll applied three further modifiers after the base chance, `brokerCorruptionRisk`, `pirate_risk_discount`, and the Persian Dome Compass module at a factor of 0.7. A captain who took the Deep Sea Escort Pact boon, which promises that "pirate risk [is] halved this round", was shown the undiscounted chance, and the escort was priced and recommended off that same wrong figure.

The panel and the roll read one function now: `pirateChance` at `src/lib/game/engine/pirates.ts:48` folds the tier, the leak, both reductions and the Compass, so what a captain reads is the number the roll uses.

### Settlement shows an escort price higher than the one charged

`src/components/portmasters/game/phases/PirateAttack.tsx:37` reads the quote off the engine:

```typescript
const escortFee = escortCost(game);
```

It used to compute it by hand as `Math.floor(game.money * escortRateFor(game.difficulty))`, while the charge applied `escort_discount` before taking money. The same boon that halves the escort cost was halved in the charge and not in the quote, so the panel quoted double what the button took.

The quote and the charge are one function now: `escortCost` at `src/lib/game/engine/pirates.ts:91` applies the Escort Pact and the Standing Escort before returning, and the button takes exactly what the panel shows.

### Harbor Pulse is calibrated to three goods and the harbor trades more

`src/lib/game/harborPulse.ts:32` fixes the baseline:

```typescript
const baseline = 1 / 3; // Hemp, Silk, Tea: an even split of the harbor's buying
```

The comment names the three founding goods, which is what the harbor traded before the difficulty tiers opened the charters. The tally it is compared against is `Object.keys(tally)`, which grows to seven goods once both charters are open.

The lean is the gap between a good's share of harbor buying and the baseline, so with seven goods in the tally an untouched good sits at about a seventh against a baseline of a third. Every good the harbor ignores takes a markdown far larger than the formula intends, and it grows as more goods enter the pool. The correct baseline is one over the number of goods actually in the tally.

### The Phase 1 price reference misses two module discounts

The tooltip on each shelf row, at `src/components/portmasters/game/phases/PurchasePriceReference.tsx:42`, calls `explainExpectedPrice`. It used to apply `purchase_discount`, `hemp_price_reduction` and `smugglers_hold` but not the Kiln Cellar or the Foreign Quarter Pass, both of which `getCardFinalCost` does apply at the counter, so a captain holding either module was quoted high on that panel and charged low at the till. The error was in the captain's favor, but the reference number the panel exists to provide was wrong.

The reader applies both module lines now (`explainExpectedPrice`, `src/lib/game/engine/pricing.ts:519`, the Kiln Cellar at `:565` and the Foreign Quarter Pass at `:575`), so the quote and the counter agree.

### A load timeout and a load error both drop the Renown bonus

The two fallback loads, for a saved voyage that cannot be fetched, are the two call sites of `applyUnreachableLoad` in `src/lib/session/use-voyage-load.ts` (`:145` and `:158`). Both used to reset the Renown level to 1. The starting Gold bonus is `cfg.startingGold + startingGoldBonus`, so a captain at Renown level 21 fell from 160 Gold to 100, and the Broker's Favor unlock relocked for the rest of that voyage.

A network timeout should not demote a captain, and it no longer does: both paths read the level remembered across loads (`env.renownRef.current`), so a failed fetch leaves the captain exactly where they were.

### Six numbers the interface states that the game does not

These are display errors rather than rule errors. The rules are right and the text beside them is not.

| Where                                          | What it says                                                             | What is true                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| `Purchase.tsx` panel title                     | "Next Round Forecast"                                                    | It showed the pulse already applied to this board |
| `AgeBanner.tsx` full variant                   | "~2 weeks remaining"                                                     | A fixed string, in a branch nothing renders       |
| `Welcome.tsx:170`                              | Understates the stake                                                    | The tier's real numbers                           |
| `constants/copy.ts:175` tutorial               | "Starting gold is **100**"                                               | Monsoon starts at 90                              |
| `DifficultyAdvisor.tsx:48`                     | "three difficulty scoped Merits await"                                   | Only two require Monsoon                          |
| `partialSight.ts:12` and `docs/PROPOSAL.md:43` | Partial Sight uses "the same trust threshold as Backing", Renown level 5 | No such gate exists anywhere                      |

The tutorial line hardcodes 100 in a sentence that templates every other number from the difficulty config.

Two entries above have since been corrected. The Purchase panel now reads Harbor Pulse and says the lean is already priced into the board, which is what the pulse genuinely is: the server computes it as the room advances into Phase 1, and startPhase1 hands it straight to genResourceCard, so it describes the prices on the shelf rather than predicting the next round. The Age banner now reads its boundary off the Age's own clock through nextAgeChange, so it counts down instead of claiming a fortnight forever. That branch has no call site at present, so the correction is there for whoever renders it next.

### Three things that are written and read by nothing

**The House perks.** `applyHousePerkAtStart` at `src/lib/game/engine/houses.ts:88` sets four fields on `state.housePerks`. It has no call site. `housePerks` has no reader. `state.houseId` is never set during play. The Lobby's House picker and `docs/RELEASE_NOTES.md` both already say the perks are not applied, so the code matches the documentation. The standings board beside it is live and reads real aggregates.

**The Age effects.** The `modifier` field on each Age has no reader outside `ages.ts`. The banner announces the Age and the effect it is meant to have, in the present tense, and no part of the voyage acts on it. Again, the release notes already say so.

**The Harbor activity feed.** It opened onto a panel that reported no recent activity, and it would have kept reporting that until the endpoint it would read from was built. The endpoint was never built. On 2026-10-04 the feed was removed outright, the shelf button, the panel and the hue that dressed them, so the harbor shelf now carries only controls that answer when pressed.

None of the three stands as it was found: the first two are wired in and live, and the third is gone.

### The pledge that strands

This one is a chain rather than a single line, and it is the only finding in this audit that costs a captain something.

For a pledge to be stranded, one captain backs a second captain's loan, and then the borrower goes bankrupt. The chain runs:

1. `src/lib/game/engine/lifecycle.ts:111` sets `state.gameOver = true` when the Settlement bills cannot be covered.
2. `src/components/portmasters/game/GameControlPanel.tsx:51` disables Next Phase when `game.gameOver`, so a bankrupt captain cannot advance a phase again.
3. The pledge is settled by the borrower's own client reporting a repayment. A captain who can no longer advance a phase never sends that report.
4. The conclusion sweep at `src/server/realtime/conclusion/voyage.ts:387` deliberately skips any loan whose borrower still has a live socket and is not bankrupt:

   ```typescript
   const stillPresent =
     !bankrupt.has(loan.borrowerId) &&
     (userSockets.get(loan.borrowerId)?.size ?? 0) > 0;
   if (stillPresent) continue;
   ```

   The intent is unchanged: a connected borrower is one whose report may simply not have arrived yet, and sweeping that loan would race their genuine settlement.

A bankrupt captain stays connected: the Bankruptcy screen is a spectator view of a harbor they are still in. The sweep therefore used to read them as a captain who was about to report, and their loan was never swept while it was also never repaid. The backer's escrowed Gold sat out the rest of the voyage, neither refunded nor called on, and on the next server start `clearLoans` dropped the loan from memory without settling it, so the backer lost the escrow and never received the Reputation that a pledge with nothing called on it would have granted.

The repair is the one this finding proposed, read off the concluding roster rather than off `gameOver`: the sweep now builds the set of bankrupt captains from the finished roster and treats them as absent, so a captain who cannot advance a phase is never mistaken for one about to report.

This finding was reasoned from the code path rather than reproduced in a live voyage.

### Dead payload and a dead computation

None of these changed what a captain could do, and all of them are cleared now except the one deliberate keep.

The standings rows built by `standingRow` in `src/server/realtime/conclusion/finishers.ts` used to carry `gold`, `renownLevel` and `renownTitle` as well, and nothing read any of the three: the Endgame panel draws final funds from the captain's own game state and the level and title from the legacy record it fetches alongside the payload. The three fields are gone, and the comment above the builder records the reasoning. `totalCrowns` at `src/app/api/leaderboard/route.ts` used to be summed from `parseStatsByDifficulty` and then left out of the entry, so the route paid for a parse whose result nothing ever sent; it is gone too, recorded in the comment above the entries. The conclusion sweep's dead `totalShips` variable is cleared. `CaptainMerit.earnedAt` is the one that stays: stored and never shown, kept on purpose as audit data (see the note above).

`src/lib/game/engine/partialSight.ts` used to assert a Backing trust gate at Renown level 5 that did not exist in the code, and `docs/PROPOSAL.md` repeated it. Both now describe the two real thresholds instead: the viewer at Renown Level 5, and the captain being looked at at Level 3.

`src/lib/game/integrity.ts:49` attributes the surge sizing to the order board while `src/lib/game/engine/market.ts:381` adds it to the purchase board. One of the two comments is wrong.

Both of these have since been cleared, along with the dead payload and the dead computation above. The three standings fields nothing read are gone, so is the unused `totalShips`, and `totalCrowns` is no longer parsed in the leaderboard route. The Partial Sight comment now says it reads a captain's Renown and nothing else, and `docs/PROPOSAL.md` no longer repeats the claim. The integrity comment now says the surge adds to the Purchase board and never widens the order board, which is what `market.ts` does.

## What was verified working

The audit found more working than broken, and it is worth naming the working parts so the list above reads as the exception it is.

**All 15 modifier keys are written and read.** Every key in the `ModifierKey` union at `src/lib/game/types.ts:87` has a grant site and a read site. None is orphaned.

**All 14 modules are read.** Every module id in the three tiers resolves to an effect somewhere in the engine.

**Both module penalty fields are charged and displayed through matching paths.** The penalty a module imposes is read from the same accessor in both places, so they cannot drift.

**The hire discount flows through `getHireCost` at all six call sites.** Hiring, firing, payroll and the three interface reads all agree, because they all call the one accessor. This is the pattern the boons in the defect list should follow.

**The transport cost and its explanation agree.** `calcTransportCost` and `explainTransportCost` clamp in a different order, which looks like a discrepancy. Working the algebra shows the inner clamp is dominated by the outer one for every ship level, so the two produce the same number. No defect.

**The card price and its explanation cannot drift.** `getCardFinalCost` delegates to `explainCardPrice`, so there is one pricing path rather than two.

**The difficulty config is fully consumed.** All four fields flagged as possible orphans during the audit, `purchaseCardsBase`, `tierUnlock`, `renownXpMultiplier` and `mandates`, are read through accessors in `difficulty.ts` that have external callers.

**Broker's Favor's gate is enforced in the engine and shown in the interface.** The level 5 requirement is checked where the favor is granted and stated where it is offered.

**The pirate and escort math is correct where it is applied.** `resolvePirateAttack` reads all three of its modifiers and `hireEscort` reads its discount. The defect above is that the Settlement panel does not call these same functions to build its display, not that the functions are wrong.

**The social economy applies what it promises.** Convoy ventures pay out on landing. Backing escrows and refunds. Bequest Routing is reachable, because a bankrupt captain can hold outstanding loans given. The shared helper reputation ceiling is genuinely one field with one cap function serving both lending and backing. Partial Sight's level gate and banding helper both exist and are called with real levels.

**Merits are pure achievements by design.** The nine merits are evaluated against the voyage record at conclusion and grant standing rather than modifiers. That is the intended shape, not an unread flag.

**Both deliberate exclusions are deliberate.** `artisan_inspiration` returns a weight of zero on an empty roster, which is how the draft avoids offering a boon that cannot fire. The `rollModuleChoices` fallback pool is unreachable because tier 0 offers eight modules against a maximum of three slots. Both are correct.

**The Room member candidate filter for Bequest Routing is correct.** It excludes the borrower and the bankrupt captain, which is exactly the set that cannot receive the routing.

**The Age memoization and the Tidewatch surge flag are deliberate.** `useAges` is memoized empty on purpose and its comment says so, since a two week cycle does not need a live tick. `tidewatchSurge` is never reset to false on purpose, so a surge lasts the voyage. Neither is a defect.

## How the defects group

Five of the findings share one root cause. The charter boons, the Silk goods list, the two Settlement displays and the Phase 1 price reference are all cases where the same concept is computed twice, once on the path that charges the captain and once on the path that describes the charge to them, and the two copies disagree.

The codebase already knows how to avoid this. `getCardFinalCost` delegates to `explainCardPrice`. `getHireCost` is the single accessor for every wage path. The transport pair was built as a mirror and stays in step. The boons that read `modifierFlags` directly in `orders.ts` and the Settlement panel that rebuilds the pirate roll by hand are the two places that stepped outside that pattern.

A captain reading this audit can fix the display defects by routing each one through the function that already computes the real number. The charter boons need a genuine rule change, since the gate itself is wrong rather than a copy of it.
