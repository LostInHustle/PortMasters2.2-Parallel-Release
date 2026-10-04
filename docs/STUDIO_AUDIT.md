# PortMasters 2.2 Parallel Release: Studio Audit and Long Term Improvement Plan

This document is the department audit the studio owner asked for, run the way a AAA studio would run it: each department studied on its own, findings written down with file and line evidence, every finding decomposed into small tasks, and the whole set carried as one long term plan. Nothing here was written from memory or from a summary; five read only passes walked the tree as it stands today, and each finding cites the exact place it lives.

The tree at audit time is the one carrying the uncommitted field report cycle: the yard wait fix, the fleet outcome fix, the rail scroll fix, the mend receipt, the wardrobe need guard, and the status clarity lines. Those six are the first entry below, and every finding after them is open work unless its own tasks carry a Shipped line.

Severities: **blocks comprehension** (a player cannot understand the screen or the rule without help), **correctness** (the game says or records something false), **design risk** (a numbers problem), **drift** (documentation or code that describes a state that no longer exists), **coverage gap** (a live system no suite walks), **polish** (legible but below the bar).

## What the field report cycle already closed

Recorded so the audit does not re-open them. All six are in the uncommitted change set, verified by smoke battery 1535 ok / 0 fail, the retained oracle 1420 ok / 0 fail, the mend harness 22 / 0 and the rail harness at exit 0.

1. **The yard no longer ends the phase it lives in.** `waitingRosterSet` folds personal screens through `seatOf` before the gate test (`src/server/realtime/checkpoint.ts`), and both shipyard screens draw the room's phase clock bar.
2. **The commission verdict is the fleet's, read once.** `readFleetMet` merges every honest finisher's trace before the loop (`src/server/realtime/conclusion/finishers.ts`).
3. **The left rail scrolls as one column** at every window height (`GameStatusPanel.tsx`).
4. **A mend leaves a receipt**: the leg's whole wardrobe row stays visible and disabled (`RefitBench.tsx`).
5. **Clothes are only offered to a crew the leg asks for**, with engine refusals naming the reason (`garments.ts`, `engine/workers.ts`).
6. **Worker status lines carry why and the way back** (the four engine lines and two tooltips).

## Department 1: UI/UX

**UX-1. Two countdowns share the screen during the path draft.** `PathDraft.tsx:146-148` renders its own chip through `phaseClockLabel(secondsLeft)`, and `GameControlPanel.tsx:162-166` runs the room's phase clock in the same format at the same time. The draft step runs a 15 second server clock (`constants/paths.ts:136`), the overlap with the Market is deliberate (`server/realtime/draft.ts:26-32`), and nothing on screen tells the two chips apart. Severity: blocks comprehension.
Tasks: (a) prefix the draft chip with the word "Draft"; (b) suppress the control bar's phase clock while a draft step is live so only one countdown shows; (c) give the draft chip a distinct treatment in its final three seconds.
Note: this finding is the mechanism behind the owner's report of a countdown squeezing the interface, and its full redesign is workstream W2.

**UX-2. The expired label reads as flavour, not as time up.** `src/lib/phase-clock.ts:61` returns "the tide is turning" for `secondsLeft <= 0`, and the draft chip renders it in the same chip the counts use (`PathDraft.tsx:147`), on a step that is 15 seconds long. Severity: polish.
Tasks: (a) give the draft step its own expiry wording that states the outcome; (b) keep the poetic line where it belongs, on the minute scale lap clock.

**UX-3. Parley stacks up to four conditional cards above the board.** `Parley.tsx:183-209` renders HarbormasterConsole, AuditVoteCard, MaroonVoteCard and OpenBoons above the station strip, and the phase receives barter, escort, modules, bazaar, audit, boons and maroon hooks at once (`GamePhasePanel.tsx:226-256`). Severity: blocks comprehension.
Tasks: (a) show each vote card only while its window is open or a majority is reachable; (b) move the harbor business behind the station strip or one fold; (c) count sections per phase screen and cap the stack.

**UX-4. The Dusk screen prints every module description inline, then adds an analyzer over them.** `Shipyard.tsx:80-104` renders each equipped module's full `desc` with no truncation and follows with the ModuleSynergyAnalyzer panel. Severity: polish.
Tasks: (a) collapse module rows to icon plus name with an expand, using the FoldRow pattern `Purchase.tsx:84-99` already uses; (b) move the analyzer behind the same fold as the other readings.

**UX-5. The Welcome screen opens with three competing pills.** `Welcome.tsx:219-245` renders a round runner pill, a mode badge line that also carries the tutorial pointer, and a three sentence New Player Tip above the start button, before a captain has read what pressing start will do. The five card briefing beneath is already folded (`briefingOpen=false`, `Welcome.tsx:141`), so the density is in the pills, not the page. Severity: blocks comprehension, first screen of a voyage.
Tasks: (a) cut the tip to one sentence; (b) fold the mode badge into the round pill; (c) name the path draft here as the next step, which also answers ONB-1.

**UX-6. Explanations that live only in hover.** The hungry crew marker (`FleetTicker.tsx:84-91`), the Short Rations pill (`RosterRow.tsx:180-188`) and every held card (`status/HeldBoons.tsx:26-33`) carry their why and their remedy only in a `title` attribute, invisible on touch. Severity: polish, and a notifications rule violation.
Tasks: (a) promote the Short Rations remedy to visible text; (b) give held chips a tap target with the effect text; (c) make the ticker marker readable without hover.

**UX-7. Dead states on the bench row.** `WorkerList.tsx:84-85` renders "Idle" or "Idle Skilled" with no cause and no definition of the star, while the same state is fully explained in `ActionSuggester.tsx:333-344` and the star is defined only in `CargoHold.tsx:224-231`. Severity: polish.
Tasks: (a) add the missing cause line for idle; (b) put the star's meaning in a visible legend on the staff surface.

**UX-8. The Market port station is the most stacked screen in the mode.** `Purchase.tsx:88-112` composes about ten sub-sections in one column scroll: heading, IntelBanner, the six card board, Provisions with its stat row, three food rows, the preserve, Supply Barge and notes, RefitBench with five blocks, and the folded Market Readings row, while the room mounts about eleven more widgets around it (`GameRoom.tsx:947-1285`). Measured on rendered text with collapsed content excluded. Severity: blocks comprehension.
Tasks: (a) give RefitBench and the barge their own station stop or one fold; (b) fold Provisions' stat row into its header; (c) set and check a sub-section cap per phase screen.

**UX-9. PlayerDetailModal is the densest single panel.** `GameModals.tsx:567-848` carries eight sub-blocks in one surface. Severity: polish.
Tasks: (a) fold the reference half behind the standings; (b) keep the standing figures visible without a tap.

**UX-10. StandingOrdersModal carries the highest prose volume of any panel**, roughly 2,300 to 2,600 visible characters, because every row and section repeats the same hint shape (`StandingOrdersModal.tsx:325-413`; OrderRow at 59-93, Section at 96-118). It is a modal, so the cost is paid only when opened. Severity: polish.
Tasks: (a) write the hint once per section instead of per row; (b) keep a per row line only where that row's order differs.

**UX-11. The most repeated decision in the game has no standing explanation.** `PurchaseBoard.tsx:101-105` and 117-121 render the deal marker as the bare words "Deal" or "Pricey" with the range only in a hover title, render the harbor pulse as "12%" with its meaning only in a hover title, and gate a disabled Buy with no adjacent reason. The tree already holds the pattern for fixing this (`RefitBench.tsx:122-127`, `BazaarRumors.tsx:97-104`, `EscortContracts.tsx:83-89`). Severity: blocks comprehension.
Tasks: (a) promote the deal range to visible text under the price; (b) add a why line to the disabled Buy; (c) reuse the existing PanelNote atom rather than new prose.

**UX-12. There is no shared inline-hint convention.** The `hint` prop pair exists only inside StandingOrdersModal; elsewhere FoldRow opts into `gist=`, PhaseShared uses `note=`, and IntelBanner and PanelNote each carry their own shape. Severity: polish, and the root cause behind the inconsistency of UX-6 and UX-11.
Tasks: (a) pick one atom for an inline why line; (b) migrate the panels that hand-write prose onto it, as part of W4.

## Department 2: Gameplay systems and bugs

The advance and outcome machinery was re-walked end to end first, and it comes back consistent: ready votes, the clock fire, forceAdvance, the deadline autoCommit, reload catch-up and reconnect each re-check the one folded roster (`src/server/realtime/checkpoint.ts:187-201`), and every verdict reads the one merged trace computed once (`src/server/realtime/conclusion/finishers.ts:684-725`). The six closed fixes check out against each other. The findings below are the new ones.

**BUG-1. A save with a legacy phase token can wedge a captain and the room.** `healLoadedVoyage` (`src/lib/session/heal-save.ts:76-121`) heals every slice of a loaded voyage except the phase. `normalizePhase` exists for exactly this case and promises "a captain whose save says 3 is placed in Resolve" (`src/lib/game/phases.ts:258-278`), but nothing calls it on load. The engine then switches on the raw token (`src/lib/game/engine/lifecycle.ts:304-336`, whose `default: return;` skips the settlement work at `:355`), and the ready wire refuses the vote on the normalized mismatch (`src/server/realtime/wiring/phase-ready.ts:32`), so the captain cannot advance and the room waits on a seat that can never move. Confirmed first-hand at audit time. Severity: correctness.
Tasks: (a) assign `game.phase = normalizePhase(game.phase)` in `healLoadedVoyage` beside the `saveMode` read; (b) decide the stored `module_draft`/`module_swap` case, folding to the inside phase when the server's draft map no longer holds the hand; (c) fold `nextPhase`'s switch through `normalizePhase` as defense in depth, since `src/lib/game/checkpoint.ts:93` already folds and the engine does not; (d) smoke cases loading saves written with "3", "barter" and "worker_mgmt".
Shipped (W1): (a) and (c) as drafted. (b) decided the other way: the faces pass through the heal untouched, because a personal screen is the room's to fold and a load that moved a captain off a live yard screen would fight the checkpoint that put them there. (d) as suite 55, which loads all three tokens and asserts the advance moves a legacy token as the phase it means.

**BUG-2. Two flag-healing contracts let damaged values reach rule gates.** `src/lib/session/heal-save.ts:241-251` heals one group with `?? false` while `:262-263` coerces another with `=== true`, and the strict comment at `:258-261` covers only bankrupt and marooned. `PUT /api/game/state` stores the client blob without shape validation, so a damaged non-boolean among `moduleSwapUsed`, `boonSwapUsed`, `pirateAttackResolved`, `escortHired`, `brokerTippedPirates` or `defaultedDebt` survives to the gates. Severity: correctness.
Tasks: (a) one strict boolean reader for every persisted flag; (b) or state in the comment why the two groups must differ.
Shipped (W1) as (b), with the boundary drawn by what the value is read as rather than by which slice wrote it: `defaultedDebt` is a verdict, not a gate (the endgame reads it first when the closing rank is dealt, `engine/lifecycle.ts:235`), so it moved into the strict group beside bankrupt and marooned, and the six gates keep their coalescing contract with the reason written above them in `heal-save.ts`. Suite 56 asserts both directions, so a change that made the two contracts one fails whichever way it is made.

**BUG-3. Filled-order settlement trusts two unchecked fields.** `src/lib/game/engine/orders.ts:221` computes `state.inventory[r.type] -= r.required!` where `required` is declared optional (`src/lib/game/types.ts:53`), so a missing value writes NaN into the hold; `:243-249` dereferences `order.resources[0].type` and throws on an empty array. The blob reaches the engine parsed but unvalidated (`src/lib/session/use-voyage-load.ts:212`). Severity: robustness.
Tasks: (a) default `required` at read or make it required on the filled shape; (b) guard the `resources[0]` reads; (c) add an orders step to `healSaveCollections`.
Shipped (W1): (a) as `?? 0` at the deduction, which is the contract the shortfall reader above it already kept (`ResourceRef.required` is optional in the type, so the two readers agree). (b) the taxed line is read once and only taxed when it exists and sells something. (c) not taken, on purpose: a drawn board is a record, so the heal leaves the card and the readers guard it. Suite 57 settles both shapes and reads the hold and the ledger back as numbers.

**BUG-4. The departure grace timer can hold the process open on shutdown.** `src/server/realtime/presence.ts:320-330` arms a bare `setTimeout`, neither unref'd nor cleared by `closeRealtime` (`src/server/realtime/index.ts:355-369`), unlike the unref'd timers at `checkpoint.ts:450` and `:684`, so a SIGTERM inside the grace window waits out the full `DEPARTURE_GRACE_MS`. Severity: robustness.
Tasks: (a) unref the timer; (b) clear `departureTimers` in the shutdown path.
Shipped (W1) as drafted, with (b) named `clearDepartureTimers` and called beside the socket teardown, so the shutdown comment's old promise that the engine releases its timers is now true for the presence timers it was silently excluding.

**BUG-5. The peek modal reports a cold-taken hand as working or idle.** `GameModals.tsx:773-775` renders "Working: X" or "Idle" without reading `isFrostbitten`, though the wire field is present and the bench row already tells the truth (`WorkerList.tsx:81`). Severity: correctness.
Tasks: (a) read `isFrostbitten` in the modal; (b) reuse the bench row's sentence rather than new prose.
Shipped (W1) with both halves as one exported `workerStatusLine` in `WorkerList.tsx`: the bench row and the peek modal now call the same function, so the two sentences cannot drift apart again.

**BUG-6. The refit bench claims clothes are whole when the crew wears nothing.** `RefitBench.tsx:243-246` prints "have nothing to put right. The crew's clothes are whole." whenever `mendable` is empty, including the bare-wardrobe case (`:108-111`). Severity: correctness.
Tasks: (a) split the two cases; (b) say "no clothes worn to mend" for a bare wardrobe.
Shipped (W1) as (a): the bare-wardrobe branch now reads "Nobody in the crew is wearing anything."

**BUG-7. The lobby manual teaches a strike the engine does not implement.** `HowToPlayModal.tsx:98` says "A worker who goes unpaid strikes and sinks your voyage", while the engine records that wording was removed because in the mode that keeps the seat sailing "the crew is left unpaid and the voyage is not over at all" (`engine/workers.ts:333-338`). A new player is taught a false rule on the way in. Severity: correctness, onboarding.
Tasks: (a) replace with the engine's own consequence; (b) read it from copy rather than retyping.
Shipped (W1): (a) as the engine's own consequence (unpaid wages take a bankruptcy, final in Classic, a mark in Ocean Gambit). (b) deferred: the modal's step table already authors its own tips, so the sentence was corrected in place and the read-from-copy sweep rides W5 with the manual's other lines.

**BUG-8. The path chip tells a late arrival to wait for a deal that has passed.** `status/PathChip.tsx:83` renders "No path yet. A path is dealt when the voyage sails." while a captain who joined mid voyage is deliberately dealt nothing (`server/realtime/draft.ts:136-137`) and the chip's own doc comment admits the case (`:36-38`). Severity: correctness.
Tasks: (a) branch the empty state on whether the deal has passed; (b) offer the switch as the way back where it is still open.
Shipped (W1): (a) as three states (deal open, deal yet to come, deal passed before arrival), with a new `inDeal` prop fed by `draft.view !== null`. (b) refused by the engine itself: `pathSwitchBlocked` answers a captain holding no path with "You hold no path to set aside" (`draft.ts`), so there is no switch to offer a late arrival and the chip promises none.

**Duplication and dead logic across the layers.** Seven findings, every one verified in source. Most are small, safe refactors with named tests, and they ride W6.

**DUP-1. The round-stamp heal rule exists in four copies.** `garments.ts:552`, `foods.ts:411`, `crew.ts:345` and `larder.ts:357` each export a normalizer with the identical two-line body (`typeof raw !== "number" || !Number.isFinite(raw)` then floor and clamp), so the rule for a persisted leg stamp can drift in four places.
Tasks: (a) one shared `normalizeRoundStamp` beside the other shared readers; (b) re-point the four call sites; (c) a smoke case that a fraction floors in all four.

**DUP-2. The maroon and audit verdicts run near-identical tally walks.** `maroon.ts:87` and `audit.ts:211` share the counts loop and the `roster <= 0` guard, and differ only in the floor, two thirds for the maroon against a strict majority for the audit (a five seat harbor asks four votes for one and three for the other), a difference kept in step by hand.
Tasks: (a) one tally helper taking the threshold as an argument, and the roster filter as a second one if the sweep lead below holds; (b) a smoke case pinning both floors at rosters three through seven.

**DUP-3. `refits.ts:439`'s private `legStamp` is body-identical to `normalizeOpportunistBorrows`** (`engine/opportunist.ts:284`): same guard, same clamp, the same rounding rule with two homes.
Tasks: (a) export one reader and import it in refits.ts; (b) or name the duplication in the doc.

**DUP-4. The wire shape of a user has three implementation sites.** A module-private `publicUser` at `server/realtime/auth.ts:28` duplicates the exported one at `src/lib/db.ts:54`, and the same four-field pick is inlined again at `server/realtime/wiring/chat.ts:145-148`.
Tasks: (a) delete the realtime copy and import the db reader; (b) call it from the chat message shapes.

**DUP-5. A dead null-coalesce survives a guard.** `engine/market.ts:440`: inside the `leans.portShift !== undefined` guard, `leans.portShift ?? null` can never fire, and the comment above says null must pass through unchanged.
Task: (a) pass `leans.portShift` directly.

**DUP-6. A refactor note sits above code it does not describe.** `engine/boons.ts:138-146` copies a `[REFACTOR]` comment about brokers_network's removed intelCost writes into `equipModule`'s swap branch, while the path it describes lives in `unequipModuleAccounting`.
Task: (a) keep the single copy where the write was removed.

**DUP-7. The charter and milestone overlays are one component written twice.** `phases/CharterDraft.tsx:43-82` and `phases/MilestoneDraft.tsx:37-77` carry the same body whole: the same overlay classes, heading block, `DraftGrid`, and per-card `DraftCard` markup with identical dress, differing only in the pending guard, the moment source, the choices reader, the action label and the answer call, while both mount side by side (`GamePhasePanel.tsx:100`, `:108`).
Tasks: (a) one parameterized overlay taking the five differences as props; (b) both call sites mount it, with each moment's own three cards covered by the draft walk when W2 builds the harness.

Clean, verified: no export under `src/lib/game` or `src/server/realtime` has zero callers (828 symbols; the 39 reached only from scripts are the retained smoke oracles), and the chat handler's `recipient!` asserts are unreachable-null by the cascade at `prisma/schema.prisma:249`, so they are not filed.

Sweep leads, held but not filed, because none of them has been walked far enough to cite as a finding: the maroon and audit tallies differ in roster filtering as well as floor (`MaroonPanel.tsx:79` drops written-off seats through `seatMarks` while `AuditPanel.tsx` counts the full roster), which is either deliberate for the write-off's own audience or a second argument for DUP-2's helper; the shadcn colour tokens at the top of `src/app/globals.css` may carry names no class reads; and the plan-quotation comment class (`use-leg-report.ts:4-17`, `BalanceDashboard.tsx:7-19`, `game/PathDraft.tsx:46-54`) narrates the plan rather than the invariant, though the bracket tags are house style, so the convention has to be decided before any of it is rewritten.

## Department 3: Economy and balancing

The department's live instruments are `scripts/bands.ts`, `gates.ts`, `cardConversion.ts`, `milestoneBoons.ts`, `moduleTrades.ts`, `pairs.ts`, `tags.ts` plus the readers in `src/lib/game/balance.ts` and `dashboard.ts` (the front page number is served by the admin balance route). There is no `scripts/balance*.ts` or `report*.ts` by those names. Every finding below cites the constants it was derived from.

**ECO-1. The escort fee sits below the raid chance on every tier, so escorting every round is positive expected value.** `escortCostRate` 0.1 against `pirateChance` 0.2 (`difficulty.ts:117` vs `:116`), 0.12 against 0.22 to 0.30 (`:140` vs `:139`), 0.15 against 0.28 to 0.38 (`:163` vs `:162`); the cost is `floor(money * rate)` (`pirates.ts:91-102`), a raid takes every coin (`copy.ts:322`), and `tips.ts:66-69` still sells skipping the escort as a fair bet for a poor captain. Severity: design risk.
Tasks: (a) count escorts bought and raids hit per round on the leg report; (b) lift `escortCostRate` above the tier top chance, or let a raid take a share of the hold rather than every coin; (c) rewrite the tip.

**ECO-2. Raw orders lose money on most goods.** Flat `required * 5` plus `randInt(10,25)` (`market.ts:108`, `:112`) against bands up to `[16,24]` (`goods.ts:203-217`) and freight at `totalItems * 2` with a floor of 5 (`pricing.ts:81`, `:85`): a 3 unit raw order over Tea, Clay, Copper, Spices or Pearls loses 7 to 11 Gold per unit before freight, and only Hemp reliably pays. Severity: design risk.
Tasks: (a) price raw orders off the good's own band, or restrict the raw pool to Hemp, Silk and Tea; (b) count fills by order kind.

**ECO-3. Feeding is not a budget line.** Rations cost 2 Gold a hand a leg (`supplies.ts:22`) while hunger halves artisan output (`larder.ts:117-119`), cuts the hold to seventy five percent (`supplies.ts:143`), and takes a hand after two legs (`crew.ts:108`) whose replacement costs 8 to 24 (`crew.ts:24-76`), roughly 15 to 20 times the price of avoidance, so no solvent captain ever has a reason to run short. Severity: design risk, to be re-tuned only after the survival readings exist (ECO-12).
Tasks: (a) count hungry legs, meals bought and hands lost per captain; (b) then decide whether the ration price scales with tier or crew.

**ECO-4. Warmth is ship-wide and shrinks with durability, so one garment stops working one leg after it is bought.** `warmthOf` = `warmth * left / durability` (`garments.ts:164-167`) against `COLD_LEG_WARMTH` 2 (`garments.ts:27`): a fresh Cotton Clothes gives 2.0, gives 1.75 after a leg, and the whole crew is cold on the next cold leg; crew size never enters the check, a mend costs 5 Gold a point once a leg (`garments.ts:84`), and Linen at warmth 1 can never satisfy the check alone. Severity: design risk.
Tasks: (a) decide per-ship or per-hand warmth and write the decision at `garments.ts:27`; (b) measure the mend-every-leg equilibrium against the wage bill; (c) instrument frostbite legs and garment spend.

**ECO-5. Boon power does not track boon value.** Steady Watch (power 2) is worth at most 24 Gold over a 12 leg voyage while Fleet Colors (power 2) is worth roughly 20 to 30 Gold per leg on a hull carrying 300, and Cold Hardened (power 3) is worth one garment (`drafts.ts:386-500`; reads at `larder.ts:177`, `pirates.ts:74-75`). Severity: design risk.
Tasks: (a) price each held flag in Gold over a 12 leg voyage; (b) repower the five cards against that price, or treat power as a mode weight only; (c) add gold won with each held card to the pairs reader.

**ECO-6. Charter power is flat where value is not.** All nine charters cost power 4 and The Factor costs 5, while their flags differ by an order of magnitude in Gold: Standing Manifest pays 15 percent on every order (`orders.ts:353-359`) where Bulk Charter saves 1 Gold a lot (`pricing.ts:99-104`), and the wildcard draw is even weighted (`charters.ts:97-110`). Severity: design risk.
Tasks: (a) measure gold earned after leg four by charter; (b) repower or reweight once measured.

**ECO-7. The VAT stack and the freight formula each exist twice, once to charge and once to explain.** `calcVAT` (`pricing.ts:194-232`) against `explainVAT` (`:236-306`), with the tax-evasion halving at `:227` and `:297`; `calcTransportCost` (`:76`) against `explainTransportCost` (`:115`), a mirror the code itself admits at `:111-114`. Severity: inconsistency.
Tasks: (a) reduce the stack once into ordered steps and have the explainer render those steps; (b) assert in smoke that the two agree on three states.

**ECO-8. The copy constants hardcode engine numbers and one is already wrong.** `copy.ts:239` states wages as 8 to 20 Gold per person per voyage, contradicting `payWages` per round (`workers.ts:273-328`), missing the 24 Gold jeweler (`crew.ts:72-76`), and contradicting the same file's own "every round" 23 lines earlier (`copy.ts:216`); the intel rumor at `copy.ts:305` says 5 Gold where `getIntelCost` is 2 with a network (`pricing.ts:619-620`). Severity: correctness in copy.
Tasks: (a) read all of these off `WAGES`, `PRODUCT_PRICES`, `getIntelCost` and the tax rates; (b) fix the per voyage wording.

**ECO-9. A finished good carries two prices and the bench prints the smaller.** `RECIPES.value` (Linen Clothes 15, Sachet 80, Pearl String 105, `goods.ts:154-185`) against `PRODUCT_PRICES` ([30,42], [95,120], [125,160], `:221-230`); orders pay the second and the bench screen prints the first (`BenchPayroll.tsx:80`). Severity: inconsistency.
Tasks: (a) derive the printed value from the band midpoint; (b) or rename the field so the two cannot be read as one price.

**ECO-10. The ship upgrade ladder lives away from the other two ship numbers.** `[15, 25, 40]` on created state (`types.ts:1068`) while `MAX_SHIP_LEVEL` and `SHIP_DISCOUNT_PER_LEVEL` live in `constants/ships.ts:4`, `:9`. Severity: inconsistency.
Tasks: (a) move the ladder beside them.

**ECO-11. No instrument reads gold per leg per path.** The only per role reading is win rate by alignment (`balance.ts:48-54`), and the dashboard marks Quartermaster fill, path pick rate and Free Captain pick rate unmeasured (`dashboard.ts:403`, `:413`, `:420`). Severity: instrument gap.
Tasks: (a) carry per leg income, spend and order counts by kind in the leg report; (b) add `readPathEconomy` to balance.ts and a `report:paths` script beside the bands reader.

**ECO-12. The survival layer has no reading at all.** No hungry legs, frostbite legs or meals bought anywhere beyond log lines; `crewLost` is a flag only (`scripts/milestoneBoons.ts:45-54`) and `foodSpend` exists only for the Barge share (`dashboard.ts:279-314`). Severity: instrument gap.
Tasks: (a) add mealsBought, hungryLegs and frostbiteLegs to the captain line; (b) print hunger share beside the Barge share in the staples panel.

**ECO-13. Garment cost recovery is unmeasured.** Mends, reweaves and rag buys are log lines only; no spend counter exists on the state or the wire. Severity: instrument gap.
Tasks: (a) tally garment spend (buy, mend, reweave) and frostbite legs per captain; (b) print cost per cold leg avoided in the milestone report.

**Balance watch list** (re-measure after W2 through W5 land, because onboarding and the clothing surfaces move all five): the escort take rate against 0.1 and 0.2; hungry legs and meals bought against `RATION_PRICE` 2; the raw versus product fill mix against the flat 5 Gold per unit; frostbite legs and garment spend against warmth 2 and cold chance 0.3; the Barge share of food spending (the ungated front page number) and Quartermaster fill.

## Department 4: Onboarding (new player first)

The acceptance criterion for this department is the owner's own: both contributors, the owner and their friend, fully understand a first voyage without feeling overwhelmed. The findings below are the obstacles found on the actual first-run path.

**ONB-1. The path draft, the first and most consequential Gambit choice, is explained nowhere.** The tutorial holds ten steps (`constants/copy.ts:164-246`) and the manual nine (`HowToPlayModal.tsx:67-135`); neither has a path page, and `differenceSteps` (`copy.ts:206`) names only four differences between the modes. The draft card shows crest, name and one flavour sentence (`PathDraft.tsx:199-209`) while its real numbers (cargo modifier, Renown ceiling, order pool at `paths.ts:183-250`) are never shown. Severity: blocks comprehension.
Tasks: (a) one path page in both surfaces, read from `PATHS` so it cannot drift; (b) print cargo, Renown ceiling and goods pool on each draft card; (c) add the "why now" line the panel already reserves a row for (`PathDraft.tsx:135-140`).

**ONB-2. The first-run surfaces contradict the engine in two places.** The manual teaches a strike that does not exist (BUG-7) and the path chip misdirects late arrivals (BUG-8); the Welcome screen never names what comes next (UX-5). Severity: blocks comprehension.
Tasks ride with those findings; the onboarding rebuild (W5) owns the acceptance check.

## Department 5: Notifications

The rule this department is judged against: every status a player can see says why it happened and what to provide (food, clothing, another necessity), visibly, on the surface where the state shows. The four fixed engine lines are the pattern to generalize.

**NOT-1. The frozen hand's bench row omits the remedy the engine lines carry.** `WorkerList.tsx:82` reads "Frozen out this leg: the crew went into the cold short of warm clothes. Back next leg." while the engine lines end "A warmer layer before a cold leg keeps every hand working" (`engine/workers.ts:174`, `garments.ts:489`). Severity: blocks comprehension.
Tasks: (a) append the remedy clause; (b) source the sentence from one place so the two cannot drift.

**NOT-2. The hunger sentence is written out twice and will drift.** `RosterRow.tsx:182` and `FleetTicker.tsx:87` both spell the full sentence with the `CREW_LOSS_AFTER_HUNGRY_LEGS` interpolation; a third rendering (`StatGrid.tsx:63-69`) carries the state in colour alone with no words. Severity: polish.
Tasks: (a) lift to one constant; (b) give the StatGrid chip its words.

**NOT-3. Why and remedy live only in hover on the rail.** See UX-6: the rail is the surface a captain reads every leg, and a hover title is invisible on touch.

**NOT-4. Idle and Skilled state nothing on the bench.** See UX-7.

**NOT-5. The notification system itself has zero suite coverage.** `src/lib/use-notifications.ts`, `NotificationCenter.tsx` and `NotificationToast.tsx` are live; no suite or the oracle mentions notifications. Severity: coverage gap.
Tasks: (a) one suite driving the ambient event that raises a notification and asserting the center's row plus the dedupe rule; (b) cover the toast suppression below the breakpoint if it is a stated rule.

**NOT-6. Status vocabulary has no convention.** The pattern exists on the engine side only; the component side re-authors sentences per surface, and NOT-1 and NOT-2 are the instances. Severity: coverage gap (the rule, not a string).
Tasks: (a) define the shape (state, cause, remedy, one source) in one place; (b) migrate bench, roster, ticker and peek surfaces to it; (c) add a read-only check script that asserts every status constant carries all three clauses, following the check:tags pattern.

## Department 6: Repository hygiene, dependencies and coverage

Clean, verified, one line each: every dependency has a live usage site (23 dependencies, 11 devDependencies); every script under scripts/ is referenced by package.json, imported, or standalone on purpose (the oracle); no unreachable component, lib or server file; no orphan asset; no TODO, FIXME or HACK marker anywhere; no empty file or directory; the smoke index registers and calls all 57 suites.

**HYG-1. The release notes' at-a-glance table is a snapshot with an unstated rule.** `docs/RELEASE_NOTES.md:18-21` states realtime 59 modules / 10,901 lines, engine 29 / 7,469 and 146 interface components. The counting rule is recovered exactly: the numbers are a snapshot of commit `d0a552a`, with engine counted as `*.ts` under the engine directory, components as `*.tsx` under `src/components` (the house-colours file excluded), and realtime as `*.ts` under the realtime directory with the conclusion subdirectory left out. Today the tree reads engine 31 / 8,256, realtime 63 / 12,600, components 150. Severity: drift.
Tasks: (a) recount and rewrite the three cells; (b) state the counting rule in one line under the table; (c) re-verify the two cells that are still accurate (API routes 26, database models 15) in the same pass.

**HYG-2. The README restates the same table, staler and contradicting it.** `README.md:190-191` reads "57 modules" and "79 components". Severity: drift.
Tasks: (a) replace both cells with the release-notes numbers; (b) keep one canonical table and make the README link to it.

**HYG-3. Three citations in the buff audit point at files that no longer exist.** `docs/BUFF_AUDIT.md:98`, `:115` cite Settlement.tsx and `:137` cites Purchase.tsx; the panels split into SettlementBills/Aid/Backing and PurchaseBoard/Provisions/Insights. Severity: drift.
Tasks: (a) re-anchor each citation to the file that now holds the quoted line; (b) confirm the three findings it cites are still live before re-anchoring.

**HYG-4. Two documents state pre-split realtime counts in the present tense.** `docs/SECURITY_REVIEW.md:477` and `docs/SYSTEM_ANALYSIS.md:153` describe the realtime tree before the newer wiring leaves; the directory holds 63 files. Severity: drift.
Tasks: (a) mark the readings as of their commit; (b) add the current count beside them or re-run the scans.

**HYG-5. Three departments have no direct suite coverage.** Notifications: none (see NOT-5). Great Houses, the Age rotation and the leaderboard: none, though `engine/houses.ts`, `ages.ts`, the standings and leaderboard routes and their panels are live. Worker hiring, wages and maintenance: only incidental checks inside other suites, never a walk of hire, assign, fire and the wage lines. Severity: coverage gap.
Tasks: (a) one suite for the pledge and its House perk on a fresh voyage; (b) one for the epoch-anchored Age read at a fixed timestamp; (c) one for the standings rows; (d) a suite that hires, assigns and fires a hand by name and asserts the wage and maintenance lines; (e) a short-ration leg asserting the hunger penalty end to end.

**HYG-6. The lobby file carries the tree's densest cluster of history-narrating comments.** `Lobby.tsx:562`, `:591`, `:694`, `:796`, `:862`, `:940` explain what the layout "used to be" without stating the present invariant (eleven such comments in one file; the next densest files mostly do name their invariant). Severity: polish.
Tasks: (a) rewrite the pure history ones as the rule they guard; (b) leave the ones that state a live invariant, such as `engine.ts:522` and `use-phase-sync.ts:304`.

**HYG-7. A load-bearing doc comment describes a caller set that no longer exists.** `src/lib/game/phases.ts:282-286` calls `phaseFace` "the one caller that reads a value off the wire" while it has fifteen call sites, including the server's clock (`src/server/realtime/checkpoint.ts:640`) and the voyage log. Severity: drift.
Task: (a) rewrite the comment to the total-lookup contract it actually keeps.

**HYG-8. A comment describes an exit animation the file does not have.** `src/components/portmasters/profile/StatsTab.tsx:26-30` says "The test sits inside the AnimatePresence rather than above it, so the panel is still in the tree for the frame its exit animation runs", but the file contains no `AnimatePresence` and no `exit` prop anywhere, so the next reader chases a pattern that is not there. The same comment is true where it is written (`DifficultyAdvisor.tsx:152-155`, `HowToPlayModal.tsx:190-193`), which is how the false copy survived. Severity: drift.
Task: (a) delete the comment where the pattern is absent, or apply the pattern where it was meant; the two true copies stay.

**HYG-9. A source comment names who asked instead of why the code is there.** `game/phases/BoonDraft.tsx:30-33` opens "This is the screen the user specifically called out for a visible ready indicator", narrating the report rather than the rule, while the rule it guards (a locked picker swaps to the shared ready readout) is in the rest of the same sentence. Severity: polish.
Task: (a) keep the design reason, drop the attribution.

## The long term improvement plan

Seven workstreams, each a sequence of cycles under the standing rules (dash-free copy, uncommitted work reported per cycle, the copy battery and retained oracle green before a cycle closes, the two sweep scripts clean, /tmp left to the retained set). Every task above carries an ID; the workstreams consume them.

**W1. Correctness first (BUG-1 through BUG-8).** One cycle, because these are root-caused fixes with named tests. Order: BUG-1 and its sibling guard, then BUG-3, BUG-2, BUG-4, then the four copy-truth fixes (BUG-5 through BUG-8). Acceptance: new smoke suites for the legacy-phase load, the flag heal contract and the orders settlement; battery and oracle green; the phase-key contract tripwire (`scripts/smoke.ts:4563-4686`) untouched. This workstream also closes the loop on the owner's "no known issues remain" bar for discovered bugs.
Shipped 2026-10-04, uncommitted like every cycle: the eight fixes above across 12 source files, three new suites (55 The Legacy Phase That Moves, 56 The Marks and the Gates, 57 The Order That Settles) registering 26 new checks, battery 1561 ok / 0 fail, the retained oracle 1420 ok / 0 fail, typecheck and lint at exit 0, the dash scan clean on every touched file, and the phase-key contract tripwire untouched.

**W2. The Path Draft as a dedicated phase (UX-1, UX-2, ONB-1b, ONB-1c).** The owner's finding is structural: the draft currently rides as a strip over the Market with a 15 second server step, and two countdowns share the screen. The redesign: the draft becomes its own gated phase before the first Market, with one clock, the explainer row, and each card's numbers shown (cargo, Renown ceiling, goods pool). The step budget is re-decided with the explainer in place rather than inherited from the strip. Acceptance: a first-run captain answers the draft with no prior knowledge, the draft harness walks both seats, the advance machinery still folds (`checkpoint.ts:198` is the load-bearing line).

**W3. Notifications (NOT-1 through NOT-6, UX-6, UX-7).** One convention, defined once: every status constant carries state, cause and remedy from one source; every surface renders it visibly. Acceptance: the new check script passes, the notification suite exists (NOT-5), the bench, roster, ticker, peek and StatGrid surfaces all render the same sentences, and the frozen and hunger families are the reference implementations.

**W4. Gambit information architecture (UX-3 through UX-5, UX-8 through UX-12).** The measured stack ranking is the work order: the Market station first (about ten sub-sections, UX-8), then Parley's stack (UX-3), then PlayerDetailModal (UX-9), StandingOrdersModal prose (UX-10), the Dusk module descriptions (UX-4), the Welcome pills (UX-5), and the hint atom (UX-12) as the shared tool the others reuse. Targets: a sub-section cap per phase screen, one hint shape, buy decisions explained without hover (UX-11). Acceptance: the panels-check and stage-probe harnesses green at the ladder sizes, no screen above the cap, the dash-free scan clean.

**W5. Onboarding, new player first (ONB-1, ONB-2, riding on W2 through W4).** The rebuild treats the first voyage as the tutorial: the Welcome screen names the next step, the tutorial and manual gain the path page, the explainers added by W2 through W4 carry the mechanics in place rather than in a tour. Acceptance, the owner's own criterion: both contributors complete a first Gambit voyage and can explain the path draft, the market, hunger and cold without help, and the smoke suites for onboarding walk the same surfaces a new player touches.

**W6. Coverage and hygiene (HYG-1 through HYG-9, NOT-5, DUP-1 through DUP-7).** The three uncovered departments get their suites, the seven dedup findings collapse to one shared normalizer, one tally helper taking the floor as an argument, one `publicUser`, one round-stamp reader, one home for the refactor note, one parameterized deal overlay and the two comment corrections, the four documents get reconciled (the recovered counting rule lands under the release-notes table and in the README), the dead citations are re-anchored, the lobby comments state their invariants, and the stale `phaseFace` comment is rewritten. Acceptance: the new suites green in the battery, the sweeps clean, the release-notes table reproducible by its stated rule.

**W7. Economy and balancing (ECO-1 through ECO-13).** Sequenced as instruments, then reconciliation, then tuning, because every re-tune is only judgeable against readings that do not exist yet. First cycle: ECO-11 through ECO-13 (the leg report fields, `readPathEconomy`, the survival and garment counters). Second: ECO-7 through ECO-10 (the charge and explain reductions, the copy numbers read from their sources, the band-derived bench value, the ship ladder into constants), each asserted in smoke. Third: ECO-1 through ECO-6 as individual tuning decisions made against the new readings, one change per cycle, each re-measuring the watch list; the onboarding workstream moves the same numbers, so the watch list is read again after W5.

**Regression watch.** Three mechanisms are load-bearing and split across files, so a redesign that touches them breaks something before anything visible does. One, the phase-key contract: any lap or token rename must land in `LEGACY_PHASES` (`src/lib/game/phases.ts:248`) and in the load heal in the same change, with `scripts/smoke.ts:4563-4686` as the tripwire. Two, the advance race: the folded roster (`checkpoint.ts:198`), the catch-up and stale guard (`src/lib/use-phase-sync.ts:241-253`, `:326`, `:345-370`) and autoCommit are one mechanism in three files; W2 is the redesign that will test it hardest. Three, the verdict: `readFleetMet` is computed once (`finishers.ts:725`) and feeds the victory evaluation and both reveal rows, while the reveal panel already derives display progress a second way (`RevealPanel.tsx:259`); any endgame work must not add a third computation.
