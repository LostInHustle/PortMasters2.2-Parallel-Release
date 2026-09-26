# PortMasters 2.2 Parallel Release: System Analysis

## Origin and Lineage

PortMasters 2.2 Parallel Release is a browser based multiplayer trading game set on the ancient maritime Silk Road. The original prototype was a single player HTML build titled PortMasters: Lords of the Silk Road. The Parallel Release is the third branch, written by Joe Zhou and Aaron Zhu as a Next.js 16 application that takes the single player game online. One process serves the site, the API, and the realtime Socket.IO layer on a single port.

The verbatim economy (Hemp, Silk, Tea, the founding ports, the all or nothing pirate raid, the 10 percent escort fee) is preserved from the original single player build. The Parallel Release layers on top of it a deterministic multiplayer engine, a persistent Captain's Legacy, a social economy of barter and loans, and a three tier difficulty framework.

The 2.2 build branches from [PortMasters 2 Parallel Release](https://github.com/LostInHustle/PortMasters2-Parallel-Release), the earlier multiplayer build, which is where the deterministic engine, the ready check, the three difficulty tiers, the social economy and the Ledger Integrity Pass were designed. Everything that build shipped is still here, working the same way. `docs/RELEASE_NOTES.md` sets the two side by side and walks through the six systems 2.2 adds.

## The Game Loop

Every captain in a harbor plays the same voyage in lockstep. Nobody advances a phase until every still active captain has readied up. A round runs through seven steps:

1. Boon draft. Draw from a fresh pool of boons that bend the rules for the coming round.
2. Phase 1 Purchase. Buy raw materials from the port market.
3. Barter. Trade goods and Gold directly with the other captains on the Captain's Exchange, which is open to every captain at any Renown level.
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

The room checkpoint cycles through eight phases per round, and which eight in which order is the room's mode (`src/lib/game/mode.ts`, the one place a lap is written down). Classic runs 0, 5, 1, barter, worker_mgmt, 2, 3, 4, which is the order the engine hardcoded before modes existed. Ocean Gambit runs the same eight with the trade manifest moved ahead of the cross captain trade board: 0, 5, 1, 2, barter, worker_mgmt, 3, 4. Both laps visit each phase exactly once, so a round still closes the same way in either. The personal sub states and terminals never become room checkpoints.

One thing Ocean Gambit draws is not per captain at all. The voyage's public objective comes from a harbor wide seed, `${harborId}:V${voyageEpoch}:objective`, the same shape the market and the order board use, and it is the harbor rather than the captain that is in it. Every captain computes the commission locally from values they already hold and they all reach the same answer, which is why the server never has to tell anyone what it is, and why the epoch is enough to reroll it when the host restarts the voyage.

One rule cuts across that order. A completed barter trade can land during any phase, because an offer surfaces in the harbor chat as well as in the exchange and a captain can take it from either. Every phase reads a captain's hold and Gold as they are rather than as they were when the phase opened, so a trade that lands partway through a phase changes what is affordable before the phase ends, and no phase holds a cached copy of those numbers to go stale.

Ocean Gambit carries two things Classic does not. Every captain is dealt a hidden alignment at departure, and it is the only secret in the game that never reaches a client it does not belong to. And the whole fleet is set one public commission for the voyage, drawn before it starts and shown to everyone: handing goods to it pays the Emperor's price into Gold, and any captain can hand over as much of it as their hold allows, so the board moves as the fleet moves. No win condition reads the commission yet, and the alignment has no use to spend itself on, which is the next piece of the mode to build. The public and private channels are described with the realtime layer below.

## The Deterministic Engine

The engine is client authoritative and deterministic by composition. Every captain seeds their own random stream from `roomId:userId` plus `voyageEpoch` plus `currentRound`, so two captains in the same room see identical markets and orders without the server computing anything. The server only owns the ready check voting, the host only transitions, and the genuinely shared harbor state.

What is seeded: the Phase 1 market card draw, the Phase 1 intel rumor pool, the Phase 2 trade order draw. What is not seeded: Salvage Crane refunds, Tax Evasion audits, the pirate raid roll itself, Broker's Favor order generation, Farsight free rumor selection, Boon drafting, Module drafting, the corrupt broker leak roll. This split is intentional. The deterministic stream fixes the shared economy so two captains see the same market. The personal stream keeps each captain's luck private so a lucky Salvage Crane refund on one client never desyncs another.

The engine surface is roughly 3,289 lines across 18 files in `engine/`, plus 3,361 lines across 15 files beside it carrying the shared constants, the types and the pure helpers the modules read from. Every function is either pure or takes `GameState` as the first argument and mutates it in place. There are no class instances, no singletons, no hidden state. The only side channel is the `logs: string[]` array every mutating function takes as its last argument.

## The Realtime Layer

The server is `attachRealtime`, a composition root over twenty modules, one concern to a file: presence, checkpoint, barter, aid, loans, ventures, chat, conclusion, pulse, objective, docks, surge, rival, quickstart, status, admin, auth and gambit, plus the shared types and the module that wires the rest together. It runs in one process alongside Next.js and attaches Socket.IO to the same HTTP server.

The trust model is deliberate. Anything inside one voyage is undefended. A captain can inflate their own Gold and mostly ruins their own afternoon. Anything that escapes into the permanent account record is server defended via the Ledger Integrity Pass. Real money math is pulled out of socket closures into pure modules (`convoy.ts`, `backing.ts`, `harborPulse.ts`) so it can be unit tested.

The private channel is the third case, and the opposite of the first: anything a captain is hiding from the table is defended by the server, all the way out to the wire, because hidden state is the only thing at this table worth attacking. A hidden alignment cannot come from the engine seed, because that seed is computed from values every client already knows, so the seed is minted by the server at departure, used once, and dropped, and what survives is the row it produced. A reload replays that row rather than drawing a new hand, and a restart deletes it, because a new voyage draws a new one. Delivery goes through `emitPrivate` in the presence module, which hands an entry to the sockets of the one captain it belongs to and to nobody else, and it is the only path by which an alignment reaches a wire: the alignment table is read nowhere else, and no broadcast site reads it at all. There is exactly one wire shape that can carry an alignment, `PrivateEntry`, and nothing hidden travels by any other route.

That last claim is asserted rather than assumed. The smoke test keeps every frame every socket in a Gambit harbor receives and reads them back afterwards, so a role that reached the wrong captain would be caught rather than assumed absent, and it also checks that the hidden captain's own socket carried the word, so a card that never arrived at all cannot pass the sweep by being absent.

The commission tally in `objective.ts` is the mirror image of that channel, and the contrast is the reason both exist. The objective is public by design, so its total goes to the whole room and a captain who joins late is handed it straight away. It gets the two defences a shared number needs rather than the one a secret needs: every report is a cumulative total merged by maximum rather than summed, so it cannot be counted twice however often it is sent, and what reaches the room is clamped to what the deck actually asks for, so a doctored report cannot inflate anybody else's screen. The tally lives in memory, following the Harbor Pulse pattern, and it is the one thing a client is trusted to rebuild: each captain holds their own contribution in their voyage state and re-reports it on a heartbeat, so a server restart costs a few seconds rather than the board. The restart path clears it by hand, because a report of zero cannot clear a maximum merged tally.

The ready check protocol is the spine of the multiplayer lockstep. Every captain in the active roster must signal ready before the room advances. The active roster is every durable member minus anyone whose last reported phase is bankruptcy or endgame. This is what lets a room keep advancing once a captain goes bankrupt.

## The Persistence Layer

SQLite via Prisma. The schema covers accounts, sessions, rooms, membership, per player game state, chat (room wide and one to one messages), captain legacy, captain merits, voyage chronicles, captain rivalries, convoy ventures, loans, and the voyage alignments a Gambit harbor was dealt. The last of those is the only table nothing in the interface reads in either direction. A row exists to be replayed to the one captain it names, and it is written by the server at departure rather than drawn from the engine seed, because a seed the client can compute is a secret the client already has.

A participant's contribution to the fleet commission needs no table of its own. What that captain has handed over, and the per round trace of where the harbor's total stood while they watched it, ride inside the existing per voyage game state blob beside the price history. What a finished voyage leaves behind is its Chronicle row, which now carries the mode, the objective the harbor was working on, whether the last board its captain saw had met it, and the trace itself. Those trace timestamps are the point: the mode's evaluation is about how much the fleet talked while the objective was close to met, and no round boundary is recorded anywhere else, so without them the conversations could not be attributed to the legs they happened in. A Chronicle row is per captain and carries what that one client last saw, so a later analysis takes the room's maximum rather than trusting any single row.

The Ledger Integrity Pass guards the one save endpoint that trusts a client completely. It judges an incoming save against an absolute ceiling keyed to how far the room's own voyage has actually got, derived from the live game data rather than written down, and it never rejects mid voyage. A captain mid game must never lose it to a mistaken guard. The consequence lands at voyage end. An impossible flagged captain still finishes the voyage and appears in the standings, but banks no Renown XP, no Merits, and no Sea Master crown.

## The Cross Voyage Progression

Every voyage's final Reputation becomes Renown XP multiplied by the difficulty tier. The triangular XP curve means level 2 needs 100, level 3 needs 300, level 4 needs 600, and so on. Seven titles track the climb from Deckhand to Silk Road Sovereign. Renown Level 5 unlocks Broker's Favor. Each level above 1 grants 3 extra starting Gold next voyage, capped at 60.

Nine Captain's Merits mark permanent achievements. Three are difficulty scoped. A seven day check in cycle rewards Renown XP without ever resetting on a missed day.

## The Social Economy

Cross player bartering with Direct Barter Offers, on two surfaces over one board. The Captain's Exchange is open to every captain at any Renown level and nothing on it is rationed. Flexible bartering, reached from the harbor chat, is gated on Renown at both ends rather than one: a captain at level 10 or above may post and accept, with an allowance of one completed trade a voyage and a second from level 15. The allowance is spent by the trade and never by the offer, so a captain may advertise the same intent in several places at once and take whichever answer arrives first, and a completed flexible trade retires every other flexible offer its own poster still had standing. Accepting is never rationed on either surface, so a captain whose own offers have all been taken can still take anyone else's. Financial Aid loans. Backing where a third captain co signs an outstanding loan. Convoy Ventures where the harbor pools Gold toward a shared target. Bequest Routing where a bankrupt captain redirects outstanding loans to a still active captain. Harbor Watch where the host mutes one captain's room chat.

## The Harbor Manifest

Eighteen designed harbor systems covering market rhythm, peer economy, identity and long game, trust and safety, accessibility, and reading the room.

Six of the seven systems that were still on the roadmap have shipped:

1. **Partial Sight.** A trusted partner sees a banded range read of another captain's cargo during active play. Pure client side rounding, so it adds no new trust boundary.
2. **Great Houses.** A second identity to argue about, separate from the Renown grind. Pledge to one of three Houses, and a harbor wide standings board ranks them on crowns, voyages and best Reputation. Each House grants one small passive perk from the start of every fresh voyage: a free first artisan, one more cargo lot on the purchase board, or cheaper wages against a higher raid chance.
3. **Ages of the Ledger.** The three peer economy tools take turns in the spotlight. The two week rotation, the banner that announces it, and all three effects are live: a backing pledge pays extra Renown, a completed barter trade lands one extra Reputation, and the Broker's Favor payout cap is raised.
4. **Captain's Rival.** The friend you keep sailing against gets a scoreboard of their own.
5. **Voyage Chronicle.** A voyage becomes a short story a captain can read again later.
6. **Quick Start Match.** A solo captain gets dropped into an open harbor instead of having to go find one.

The seventh, **House Rally**, did not ship. It would have given a harbor where a majority of captains share a pledge a flavor banner and a bonus House Standing at voyage end. It is the one system left on the roadmap.

The **Bilingual Harbor** was built in full and then removed at the owner's request. It does not come back without a fresh owner decision.

## Deployment

The repository carries one host configuration file, `railway.json`, rather than a written guide. It builds the service, starts it, names the healthcheck, and requires a volume at `/app/db`, so a deploy that has nowhere to keep its database fails loudly at startup instead of coming up empty. `requiredMountPath` is what turns a forgotten volume into a failed deploy rather than a silent loss of every account.

The hosted service deliberately runs the development server rather than a production build. `next build` wants more memory than the smaller plans provide, and a build killed halfway is a deploy that never lands, so the file trades first load speed for a deploy that finishes. `README.md` covers the two things the file cannot express on its own: the volume itself, which the platform creates rather than the file, and the build variable that keeps the development dependencies in the image.

## Why It Is State of the Art Already but Kind of Outdated

The engineering and platform are state of the art. Modern stack, deterministic multiplayer, persistent progression, social economy, ledger integrity, designed harbor systems.

The gameplay content is the deliberately preserved verbatim Easy tier of an older single player game. The two richer difficulties reproduce the Standard and Hard essence through the new platform's own levers rather than porting the original's content library. Difficulty balance is still untuned. One of the eighteen designed harbor systems, House Rally, has not been built, and one smaller piece is visible without being live: the Harbor activity feed, which would read from an endpoint that does not exist yet.

## Architectural Strengths to Conserve

The deterministic engine composition. The pure real money math modules. The ready check phase sync protocol. The Ledger Integrity Pass trust model. The shared helper reputation ceiling. The one venture per voyage room wide rule. The first report wins arbitration pattern. The difficulty as single source of truth threaded through every selector. The eight phase checkpoint cycle. The live reading of hold and purse in every phase, so a mid phase barter changes what a shelf costs before the phase ends. The `_` prefixed transient signal convention for engine to React to socket relay. The normalize on load defensive read pattern. The wholesale replace modifier flags design. The `addOwnedAmount` single mutation path. The harbor pulse lean not shove formula.

## Defect Report and What Happened to It

Earlier in the project a review produced a list of defects and refactoring targets. Almost all of them have since been closed. They are recorded here with their outcome, because a defect list that only ever grows is not a working document.

**Closed.**

The `nextPhase` barter branch used to pass an empty refunds array, so a captain who advanced from the control bar instead of the Bartering panel abandoned every offer they had posted along with its escrow. The refund list is now a parameter, and the control bar forwards the same live list the panel does.

The realtime layer was one 3,097 line function. It is now a composition root over small modules: presence, checkpoint, barter, aid, loans, ventures, chat, conclusion, pulse, docks, surge, rival, quickstart, status, admin, auth and gambit, with the shared types and the composition root itself alongside them.

`PublicUser` and `CaptainStatus` were duplicated between the client and the server, and so was `CHECKPOINT_PHASE_ORDER`. Both now have one home, in `src/types/realtime.ts` and `src/lib/game/checkpoint.ts`.

`intelCost` was mutable state mirroring a module flag. It is derived from the equipped modules.

`fireWorker` read the raw `WAGES` table and so ignored both wage surcharges. It now reads `getHireCost`, the same accessor the hire and payroll paths use. Two display sites in the artisan panel had the same habit, quoting the undiscounted list price on the Dismiss button and on the hire roster while the engine charged the discounted wage. Both read the computed wage from the roster now, so the figure a captain budgets against is the figure settlement charges.

`merchantRatingForScore` moved to `constants.ts`. `Worker.task` is a branded `Product` type instead of a bare string. The always zero `Worker.progress` field is gone. The dead `names` map in `hireWorker` is gone. `modifierFlags` is a `Partial<Record<ModifierKey, number>>` with the legal keys pinned in one place. The `api/route.ts` Hello World stub is deleted. The Welcome screen's numbers derive from the room's difficulty instead of hardcoding the founding trade. The Settlement Force Pay button has its own destructive styling. The Shipyard back buttons call engine functions instead of writing `g.phase` directly.

`escortHired` looked like a write only flag. It is read, by the Settlement screen, which is what it is for: it is a signal from the engine to the interface. That is now stated where the field is declared.

`docs/BUFF_AUDIT.md` produced a second pass over every declared effect, and all of its findings are closed. The two charter boons read one tier agnostic gate between them, and each reads its own tier now. The Silk goods list omitted the two goods whose recipe uses Silk at the same ratio as one it already included. The Settlement panel rebuilt the pirate roll and the escort quote by hand, which drifted from the functions that roll and charge; it calls those functions now. Harbor Pulse divided by a fixed three goods while the harbor trades up to seven, and now divides by the goods actually in the tally. The Purchase reference price skipped two module discounts the counter applies. A failed save load reset the Renown level to 1, and now leaves the captain where they were. Six numbers the interface stated that the game did not are corrected. The three House perks and the three Age effects were written and read by nothing; they are wired in now rather than deleted, because the design was sound and only the connection was missing.

A pledge was stranded when its borrower went bankrupt. The conclusion sweep skipped any loan whose borrower still had a live socket, on the reasoning that a connected borrower might be about to report. A bankrupt captain keeps their socket open to watch the standings, so their loan was never swept and never repaid, and the escrow behind the pledge riding on it was dropped at the next boot. The sweep treats a bankrupt borrower as absent now.

`partialSight.ts` carried a comment asserting a Backing trust gate at Renown level 5 that no code anywhere enforced. The comment states plainly that no such gate has ever existed, and what the module actually reads, which is a captain's Renown and nothing else.

**Kept, deliberately.**

`engine.ts` re exports flat, so any module can import any other. That was weighed and kept. The engine is one small, self contained, pure subsystem, and a deep import graph across it would buy separation that nothing currently needs.

`restartGame` replaces state with `Object.assign(state, fresh)` rather than swapping the object. The reference has to stay stable, and `createInitialGameState` explicitly initializes the transient fields to `undefined` so nothing leaks across a restart. A captain who changes House between voyages cannot keep the old House's perks by accident.

`completeOrder` is still about 130 lines. It is long, but it is a single rule with a single outcome, and splitting it would spread one decision across several functions without making any of them clearer.
