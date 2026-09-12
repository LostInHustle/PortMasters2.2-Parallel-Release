# PortMasters 2.2 Parallel Release: System Analysis

## Origin and Lineage

PortMasters 2.2 Parallel Release is a browser based multiplayer trading game set on the ancient maritime Silk Road. The original prototype was a single player HTML build titled PortMasters: Lords of the Silk Road. The Parallel Release is the third branch, written by Joe Zhou and Aaron Zhu as a Next.js 16 application that takes the single player game online. One process serves the site, the API, and the realtime Socket.IO layer on a single port.

The verbatim economy (Hemp, Silk, Tea, the founding ports, the all or nothing pirate raid, the 20 percent escort rate) is preserved from the original single player build. The Parallel Release layers on top of it a deterministic multiplayer engine, a persistent Captain's Legacy, a social economy of barter and loans, and a three tier difficulty framework.

The 2.2 build branches from [PortMasters 2 Parallel Release](https://github.com/LostInHustle/PortMasters2-Parallel-Release), the earlier multiplayer build, which is where the deterministic engine, the ready check, the three difficulty tiers, the social economy and the Ledger Integrity Pass were designed. Everything that build shipped is still here, working the same way. `docs/RELEASE_NOTES.md` sets the two side by side and walks through the six systems 2.2 adds.

## The Game Loop

Every captain in a harbor plays the same voyage in lockstep. Nobody advances a phase until every still active captain has readied up. A round runs through seven steps:

1. Boon draft. Draw from a fresh pool of boons that bend the rules for the coming round.
2. Phase 1 Purchase. Buy raw materials from the port market.
3. Barter. Trade goods and Gold directly with the other captains.
4. Artisan management. Hire artisans and assign what each of them crafts.
5. Phase 2 Orders. Fill trade orders for Gold and Reputation.
6. Phase 3 Settlement. Production lands, wages and maintenance come due, pirates may find you.
7. Phase 4 Shipyard. Upgrade the ship, draft and rig modules.

The phase union encodes every checkpoint the room synchronizes on:

```typescript
type Phase =
  | 0 // welcome, in harbor
  | 1 // port purchase
  | 2 // trade orders
  | 3 // maintenance and settlement
  | 4 // shipyard
  | 5 // boon drafting
  | "barter" // captain to captain trade
  | "worker_mgmt" // artisan management
  | "module_draft" // personal sub state
  | "module_swap" // personal sub state
  | "bankruptcy" // terminal
  | "endgame"; // terminal
```

The room checkpoint cycles through eight phases per round: 0, 5, 1, barter, worker_mgmt, 2, 3, 4. The personal sub states and terminals never become room checkpoints.

## The Deterministic Engine

The engine is client authoritative and deterministic by composition. Every captain seeds their own random stream from `roomId:userId` plus `voyageEpoch` plus `currentRound`, so two captains in the same room see identical markets and orders without the server computing anything. The server only owns the ready check voting, the host only transitions, and the genuinely shared harbor state.

What is seeded: the Phase 1 market card draw, the Phase 1 intel rumor pool, the Phase 2 trade order draw. What is not seeded: Salvage Crane refunds, Tax Evasion audits, the pirate raid roll itself, Broker's Favor order generation, Farsight free rumor selection, Boon drafting, Module drafting, the corrupt broker leak roll. This split is intentional. The deterministic stream fixes the shared economy so two captains see the same market. The personal stream keeps each captain's luck private so a lucky Salvage Crane refund on one client never desyncs another.

The engine surface is roughly 2,663 lines across 13 files in `engine/` plus 1,500 lines of supporting pure logic. Every function is either pure or takes `GameState` as the first argument and mutates it in place. There are no class instances, no singletons, no hidden state. The only side channel is the `logs: string[]` array every mutating function takes as its last argument.

## The Realtime Layer

The server is a single `attachRealtime` function with nine conceptual sections: presence, checkpoint, barter, aid, loans, ventures, chat, conclusion, connection. It runs in one process alongside Next.js and attaches Socket.IO to the same HTTP server.

The trust model is deliberate. Anything inside one voyage is undefended. A captain can inflate their own Gold and mostly ruins their own afternoon. Anything that escapes into the permanent account record is server defended via the Ledger Integrity Pass. Real money math is pulled out of socket closures into pure modules (`convoy.ts`, `backing.ts`, `harborPulse.ts`) so it can be unit tested.

The ready check protocol is the spine of the multiplayer lockstep. Every captain in the active roster must signal ready before the room advances. The active roster is every durable member minus anyone whose last reported phase is bankruptcy or endgame. This is what lets a room keep advancing once a captain goes bankrupt.

## The Persistence Layer

SQLite via Prisma. The schema covers accounts, sessions, rooms, membership, per player game state, chat (room wide and one to one messages), captain legacy, captain merits, convoy ventures, and loans.

The Ledger Integrity Pass guards the one save endpoint that trusts a client completely. It compares the incoming save against a last known good, flags anything past a theoretical maximum ceiling, and never rejects mid voyage. A captain mid game must never lose it to a mistaken guard. The consequence lands at voyage end. An impossible flagged captain still finishes the voyage and appears in the standings, but banks no Renown XP, no Merits, and no Sea Master crown.

## The Cross Voyage Progression

Every voyage's final Reputation becomes Renown XP multiplied by the difficulty tier. The triangular XP curve means level 2 needs 100, level 3 needs 300, level 4 needs 600, and so on. Seven titles track the climb from Deckhand to Silk Road Sovereign. Renown Level 5 unlocks Broker's Favor. Each level above 1 grants 3 extra starting Gold next voyage, capped at 60.

Nine Captain's Merits mark permanent achievements. Three are difficulty scoped. A seven day check in cycle rewards Renown XP without ever resetting on a missed day.

## The Social Economy

Cross player bartering with Direct Barter Offers. Financial Aid loans. Backing where a third captain co signs an outstanding loan. Convoy Ventures where the harbor pools Gold toward a shared target. Bequest Routing where a bankrupt captain redirects outstanding loans to a still active captain. Harbor Watch where the host mutes one captain's room chat.

## The Harbor Manifest

Eighteen designed harbor systems covering market rhythm, peer economy, identity and long game, trust and safety, accessibility, and reading the room.

Six of the seven systems that were still on the roadmap have shipped:

1. **Partial Sight.** A trusted partner sees a banded range read of another captain's cargo during active play. Pure client side rounding, so it adds no new trust boundary.
2. **Trading Houses.** A second identity to argue about, separate from the Renown grind. Pledge to one of three Houses, and a harbor wide standings board ranks them on crowns, voyages and best Reputation. Each House grants one small passive perk from the start of every fresh voyage: a free first artisan, one more cargo lot on the purchase board, or cheaper wages against a higher raid chance.
3. **Ages of the Ledger.** The three peer economy tools take turns in the spotlight. The two week rotation, the banner that announces it, and all three effects are live: a backing pledge pays extra Renown, a completed barter trade lands one extra Reputation, and the Broker's Favor payout cap is raised.
4. **Captain's Rival.** The friend you keep sailing against gets a scoreboard of their own.
5. **Voyage Chronicle.** A voyage becomes a short story a captain can read again later.
6. **Quick Start Match.** A solo captain gets dropped into an open harbor instead of having to go find one.

The seventh, **House Rally**, did not ship. It would have given a harbor where a majority of captains share a pledge a flavor banner and a bonus House Standing at voyage end. It is the one system left on the roadmap.

The **Bilingual Harbor** was built in full and then removed at the owner's request. It does not come back without a fresh owner decision.

## Why It Is State of the Art Already but Kind of Outdated

The engineering and platform are state of the art. Modern stack, deterministic multiplayer, persistent progression, social economy, ledger integrity, designed harbor systems.

The gameplay content is the deliberately preserved verbatim Easy tier of an older single player game. The two richer difficulties reproduce the Standard and Hard essence through the new platform's own levers rather than porting the original's content library. Difficulty balance is still untuned. One of the eighteen designed harbor systems, House Rally, has not been built, and one smaller piece is visible without being live: the Harbor activity feed, which would read from an endpoint that does not exist yet.

## Architectural Strengths to Conserve

The deterministic engine composition. The pure real money math modules. The ready check phase sync protocol. The Ledger Integrity Pass trust model. The shared helper reputation ceiling. The one venture per voyage room wide rule. The first report wins arbitration pattern. The difficulty as single source of truth threaded through every selector. The eight phase checkpoint cycle. The `_` prefixed transient signal convention for engine to React to socket relay. The normalize on load defensive read pattern. The wholesale replace modifier flags design. The `addOwnedAmount` single mutation path. The harbor pulse lean not shove formula.

## Defect Report and What Happened to It

Earlier in the project a review produced a list of defects and refactoring targets. Almost all of them have since been closed. They are recorded here with their outcome, because a defect list that only ever grows is not a working document.

**Closed.**

The `nextPhase` barter branch used to pass an empty refunds array, so a captain who advanced from the control bar instead of the Bartering panel abandoned every offer they had posted along with its escrow. The refund list is now a parameter, and the control bar forwards the same live list the panel does.

The realtime layer was one 3,097 line function. It is now a composition root over small modules: presence, checkpoint, barter, aid, loans, ventures, chat, conclusion, pulse, docks, surge, rival and quickstart.

`PublicUser` and `CaptainStatus` were duplicated between the client and the server, and so was `CHECKPOINT_PHASE_ORDER`. Both now have one home, in `src/types/realtime.ts` and `src/lib/game/checkpoint.ts`.

`intelCost` was mutable state mirroring a module flag. It is derived from the equipped modules.

`fireWorker` read the raw `WAGES` table and so ignored both wage surcharges. It now reads `getHireCost`, the same accessor the hire and payroll paths use.

`merchantRatingForScore` moved to `constants.ts`. `Worker.task` is a branded `Product` type instead of a bare string. The always zero `Worker.progress` field is gone. The dead `names` map in `hireWorker` is gone. `modifierFlags` is a `Partial<Record<ModifierKey, number>>` with the legal keys pinned in one place. The `api/route.ts` Hello World stub is deleted. The Welcome screen's numbers derive from the room's difficulty instead of hardcoding the founding trade. The Settlement Force Pay button has its own destructive styling. The Shipyard back buttons call engine functions instead of writing `g.phase` directly.

`escortHired` looked like a write only flag. It is read, by the Settlement screen, which is what it is for: it is a signal from the engine to the interface. That is now stated where the field is declared.

`docs/BUFF_AUDIT.md` produced a second pass over every declared effect, and all of its findings are closed. The two charter boons read one tier agnostic gate between them, and each reads its own tier now. The Silk goods list omitted the two goods whose recipe uses Silk at the same ratio as one it already included. The Settlement panel rebuilt the pirate roll and the escort quote by hand, which drifted from the functions that roll and charge; it calls those functions now. Harbor Pulse divided by a fixed three goods while the harbor trades up to seven, and now divides by the goods actually in the tally. The Purchase reference price skipped two module discounts the counter applies. A failed save load reset the Renown level to 1, and now leaves the captain where they were. Six numbers the interface stated that the game did not are corrected. The three House perks and the three Age effects were written and read by nothing; they are wired in now rather than deleted, because the design was sound and only the connection was missing.

A pledge was stranded when its borrower went bankrupt. The conclusion sweep skipped any loan whose borrower still had a live socket, on the reasoning that a connected borrower might be about to report. A bankrupt captain keeps their socket open to watch the standings, so their loan was never swept and never repaid, and the escrow behind the pledge riding on it was dropped at the next boot. The sweep treats a bankrupt borrower as absent now.

`partialSight.ts` carried a comment asserting a Backing trust gate at Renown level 5 that no code anywhere enforced. The comment states plainly that no such gate has ever existed, and what the module actually reads, which is a captain's Renown and nothing else.

**Kept, deliberately.**

`engine.ts` re exports flat, so any module can import any other. That was weighed and kept. The engine is one small, self contained, pure subsystem, and a deep import graph across it would buy separation that nothing currently needs.

`restartGame` replaces state with `Object.assign(state, fresh)` rather than swapping the object. The reference has to stay stable, and `createInitialGameState` explicitly initializes the transient fields to `undefined` so nothing leaks across a restart. A captain who changes House between voyages cannot keep the old House's perks by accident.

`completeOrder` is still about 130 lines. It is long, but it is a single rule with a single outcome, and splitting it would spread one decision across several functions without making any of them clearer.
