# PortMasters 2.2 Parallel Release: System Analysis

This is a design reference for maintainers. It describes the systems, the rules that hold them together, and the source files that own each rule. Where this document and the code disagree, the code is right.

## Origin and Lineage

PortMasters 2.2 Parallel Release is a browser based multiplayer trading game set on the ancient maritime Silk Road. It descends from a single player prototype titled PortMasters: Lords of the Silk Road and from PortMasters 2 Parallel Release, the multiplayer build written by Joe Zhou and Aaron Zhu. The 2.2 build branches from that multiplayer build rather than patching it.

Classic is the founding voyage, preserved as it shipped. Ocean Gambit is where the systems added in 2.2 live. The two modes share the same six phase lap, the same goods and ports, and the same account progression; they differ in phase order, in what a failed seat costs, in the private information the table carries, and in how long a voyage runs.

One Node process serves the Next.js site, the REST API, and Socket.IO on one port. SQLite through Prisma holds accounts, harbors, saves, and finished voyage records.

## The Game Loop

Every captain in a harbor plays the same voyage in lockstep. The harbor waits at the pier until the host starts the voyage. A round is one lap, and a lap walks six phases. A mode decides the order.

Classic runs Dawn, Market, Parley, Orders, Resolve, Dusk. Ocean Gambit opens with a path draft at the pier, then runs Dawn, Market, Orders, Parley, Resolve, Dusk. The difference that matters is the position of Orders: Classic sorts the conversation before the manifest, while Gambit closes the manifest before the table opens.

The six phases a round walks are:

1. Dawn. Each captain draws three boons and keeps one. A boon bends the coming round and only that round.
2. Market. The port purchase board opens, then the artisan bench. Buying stock and assigning craft happen under one harbor wait.
3. Orders. The trade board deals and the captain fills orders for Gold and Reputation. A pathbound order is locked to the path that carries its goods.
4. Parley. The Captain's Exchange opens for direct trades. In Ocean Gambit the Manifest Audit and the maroon vote also happen here.
5. Resolve. Production lands, the pirate raid is rolled, then wages and maintenance come due.
6. Dusk. The shipyard opens for a hull upgrade, a module draft, or a module swap.

The phase union in `src/lib/game/phases.ts` also carries the pier, the path draft, two personal shipyard states, bankruptcy, and endgame. The six phases a round walks, the pier, and the path draft are the harbor's synchronized seats. The personal shipyard states and the terminals are not. `module_draft` and `module_swap` are personal states inside Dusk, and the harbor never waits on them. Bankruptcy is terminal in Classic and a mark the captain sails on with in Ocean Gambit. Endgame is terminal in both.

A captain's hold and purse are read live in every phase. A barter that settles halfway through Market changes what the captain can afford before Market closes, and no phase keeps a cached copy of those numbers.

The phase order is written once on the mode record as `checkpointPhaseOrder` in `src/lib/game/mode.ts`. The ready check and the interface read that record rather than keeping their own lists. A saved voyage or a `Room` row from an older vocabulary is mapped through `LEGACY_PHASES` by `normalizePhase` on load, so a voyage in flight when a release lands can still be placed.

## The Voyage's Length

`voyageRoundsFor(mode, difficulty)` returns the length a voyage will run. Classic follows the difficulty ladder: Fair Winds is 8 rounds, Open Waters 12, and Monsoon 16. Ocean Gambit pins 12 rounds on every tier. The pin is `voyageRounds` on the mode record, and Classic leaves it null so it keeps following the ladder.

The engine fixes the length at departure into `GameState.maxRounds`, and its endgame check reads that number. A voyage already under way keeps its number in the save if a deploy changes the ladder. Server surfaces that call `voyageRoundsFor` read the current mode and tier, so a mid voyage config change can be seen by the server while the save keeps its original length.

## The Deterministic Engine

The engine runs on each captain's client. The server does not simulate the phases. It owns the harbor clock, the ready check, the votes, the private deals, the shared boards, and the save records. The engine is deterministic by composition: the same inputs produce the same voyage, and a reload reads the state that was written rather than replaying a random stream.

Randomness comes from `createRng` in `src/lib/game/rng.ts`, a mulberry32 generator seeded by a string. The seed for a captain's own draws starts with `roomId:userId`, set in `src/lib/use-game-session.ts`. Market, intel, and order draws append the voyage epoch and the current round, for example `${seedBase}:V${voyageEpoch}:R${currentRound}:market`. The order board uses `:orders`, the pathbound slots use `:pathorders`, and the intel pool uses `:intel`.

The consequence is important. Two captains in the same harbor do not see the same market or the same order board. Each captain's board is their own draw, reproducible when that same captain reloads. The shared facts are the public commission, the audit sample, and the voyage's role deal, and those are seeded or stored separately.

Seeded facts that every captain must agree on are derived from public values. The public commission uses `${harborId}:V${voyageEpoch}:objective`, with a seat suffix above the anchor band. The Manifest Audit uses `${harborId}:V${voyageEpoch}:audit:R${round}:${targetUserId}`. A reload of either derives the same answer.

Some deals cannot be derived from values the client already knows. The Ocean Gambit role card and the path draft hand are dealt by the server from a one time seed, then the seed is dropped. The resulting rows and hands are stored, and a reload reads those stored results. This is deliberate: a hidden alignment or a private hand that a client could compute would not be hidden.

### Deliberate Non Seeded Randomness

The following rolls use `Math.random` rather than the seeded stream. The list is complete for game rules in `src`.

- **Boon draft offers.** `drawOffer` in `src/lib/game/cards.ts` defaults to `Math.random`, and `draftBoons` in `src/lib/game/engine/boons.ts` takes the default. The offer is written to `state.boonChoices` before the pick, so a reload reads the same three cards.
- **Module draft offers and batch changes.** `rollModuleChoices` and `swapModuleChoices` also take the default. The offer is stored in `state._draftChoices` before the pick, and the pick or batch change is what changes the save. No other captain is dealt the same hand.
- **Farsight's free whisper.** `revealRumor` in `src/lib/game/engine/market.ts` picks a demand tag and an open port with `Math.random`. The result is written to `state.revealedIntel`, which only that captain can see, not a change to a shared market.
- **A Broker's Whisper guaranteed order.** After the seeded board is drawn, `startOrders` in `src/lib/game/engine/orders.ts` overwrites slots with orders built from the captain's own `revealedIntel`, using `localRng = Math.random`. It touches only that captain's board and does not advance or rewind the seeded stream.
- **The Broker's Favor order.** `callBrokersFavor` generates one extra standard order for goods the captain already holds, using `localRng = Math.random`. It appends to that captain's board, once per voyage.
- **The Salvage Crane refund.** During order fill, the module refunds freight cost on a 0.3 roll. It changes the captain's own purse and ledger.
- **The Tax Evasion audit.** During order fill, the module charges a 20 Gold fine on a 0.15 roll. It changes the captain's own purse and ledger.
- **The corrupt broker leak.** On a Monsoon table, a Broker's Whisper can also raise that captain's pirate risk once for the round, using `brokerCorruptionChance`. The leak is announced in the captain's log and affects only that captain's raid roll.
- **The pirate raid.** `resolvePirateAttack` in `src/lib/game/engine/pirates.ts` rolls `Math.random() < pirateChance(state)`. The result is latched by `pirateAttackResolved`, written into the captain's state, and reported, so nothing recomputes it later.

Two `Math.random` reads mint identifiers rather than game outcomes: the row id in `src/server/realtime/ids.ts` and a notification id in `src/lib/use-notifications.ts`. They touch no rule.

These exceptions are safe because none of them is a shared fact. Each is a private roll during one captain's action, and its outcome is written into that captain's state or intel before the next reader sees it. No second client computes the same roll, and a reload reads the written result. The server's integrity check judges whether a save is plausible, not whether it can reproduce a die. Shared facts that several clients must agree on use the seeded or server minted paths above.

The engine itself is a set of pure functions or functions that take `GameState` first and mutate it in place. There are no classes, singletons, or hidden stores. Game outcomes land in `GameState`; the engine's outward channel for narrative is the `logs: LedgerLine[]` array. A ledger line holds the fact and its values rather than a finished sentence, so the sentence is built in the reader's language at render time. `src/lib/game/ledger.ts` owns that shape.

## The Realtime Layer

`server.ts` creates one HTTP server. Next.js, the REST routes, and Socket.IO share it. Socket.IO keeps the library default path `/socket.io`, so it cannot shadow an application route. Cross origin access is closed because every browser reaches the socket on the app's own origin. The ping timeout is 60 seconds and the interval is 25 seconds, which keeps a tab that was away for a minute from being dropped mid voyage.

`attachRealtime` in `src/server/realtime/index.ts` is the composition root. The event leaves live under `src/server/realtime/wiring/`, one concern to a file. The shared leaves under that directory are `consent-shared.ts`, for the buyer read and offer refusal the priced markets share; `fail.ts`, for the refusal sentences the markets share; and `vote.ts`, for the two frames a harbor vote answers on.

The ready check is the spine. Every captain in the active roster must signal ready before the harbor advances, unless the phase clock ends the seat first. The active roster is every durable member except a captain whose last reported phase is bankruptcy or endgame. That rule lets a Classic harbor keep moving after a captain goes bankrupt. It also keeps a Gambit captain who is bankrupt, and a captain who was marooned, in the count, because neither has left the voyage.

A captain standing in `module_draft` or `module_swap` is folded into Dusk by `seatOf`. A personal screen is never gated by the ready check, but the captain is still placed at the seat the harbor is waiting on. The waiting roster is built from the active roster and that fold.

When the harbor advances, the server emits the advance and clients report the seat they landed on. The first report further along moves the checkpoint. `ADVANCE_REPORT_GRACE_MS` is 12 seconds, longer than the client heartbeat, so a lost tab cannot hold the harbor forever. A report that lands in time never sees the recovery path.

Per harbor state lives in memory: the checkpoint, phase timers, audit and maroon votes, reveals, contract and refit boards, the barter board, the path draft, and the telemetry accumulator. A restart clears them. Durable voyage records are written through Prisma.

## The Phase Clock

A phase budget is authored on `PHASE_FACES.seconds` in `src/lib/game/phases.ts`. Dawn is 25 seconds, Market 180, Orders 120, Parley 180, Resolve 90, and Dusk 60. The pier, the path draft, the personal shipyard states, and the terminals have no clock.

The mode decides whether a clock exists. Classic's `phaseClock` is false regardless of the environment. Ocean Gambit's is true, but the clock still needs `PHASE_CLOCK` to be above zero. The environment value is a scale from 0 to 10, read once at boot in `src/lib/config.ts`. Zero or `off` disables the clock entirely, so every phase waits for the ready set. A positive scale multiplies every authored budget. The implementation floors the result at one second, so a small scale cannot round a phase away.

When a timer expires, the server emits the same advance a unanimous ready set would emit. The client cannot tell which path ended the seat. The expiry records `round_timed_out` in telemetry, which is the measurement used to judge whether a phase is too short. `phaseEndsAt` and `phaseSeconds` are published to clients while the phase runs; neither is stored, so changing the clock needs no migration.

The path draft has no clock. A seat whose last socket drops is handled by a server watch in `src/server/realtime/draft.ts`. After `DRAFT_WATCH_MS` (15 seconds), the watch lays that captain's first card so a vanished captain cannot hold the table forever.

## Standing Orders

Standing orders let a captain write down what they want done at seats they cannot attend. The record lives on the voyage state and has five fields: `enabled`, a chosen `boon`, a list of `buy` ceilings by good, `fill` of `"none"` or `"all"`, and `shipyard` of `"continue"` or `"upgrade"`. `MAX_STANDING_BUYS` is the length of `MARKET_GOODS`; a captain writes at most one ceiling per market good.

The governing rule is that an order can do nothing a captain could not do by hand. It chooses among the actions the seat already offers, and the seat's own guards decide whether the action is allowed. A purse that cannot afford a card and a hold that cannot cover an order refuse the order exactly as they refuse a click.

`autoCommit` in `src/lib/game/engine/lifecycle.ts` runs when the harbor advances without a captain's input. It first cancels a parked module draft or swap so the captain is back in Dusk. It applies standing orders only if the mode allows them and the captain's own `enabled` switch is on. In Dawn it takes the written boon if that boon is actually among the offers, otherwise the first offer. In Market it buys only cards where every resource line settles at or below the written ceiling. In Orders it fills every order the hold can cover, which skips pathbound orders the captain does not hold. In Dusk it upgrades the hull when the purse allows. Parley and Resolve are not automated: Parley's work is an offer board, and Resolve offers no choice.

The mode gate is checked before the captain switch. A save that carries standing orders into a mode without them is left untouched rather than half applied. `src/lib/game/standing.ts` owns the record and the normalizer; `src/lib/game/engine/standing.ts` owns the work.

## The Persistence Layer

The database is SQLite through Prisma. The schema in `prisma/schema.prisma` covers accounts, sessions, harbors, membership, per captain game state, private role cards, captain legacy, merits, convoy ventures, messages, loans, voyage chronicles, rivalries, voyage telemetry, and reports.

A `Room` row holds what a harbor is: its code, host, mode, difficulty, current round and phase, voyage epoch, voyage seats, whether it has started, and which unlock phrase opened it. `voyageSeats` is pinned at departure and cleared on restart. It is the fleet size the public commission was sized for, not the current roster. `unlock` stores the id of the door a harbor was opened through, never the phrase itself.

`GameState.data` is the captain's voyage save as JSON. It carries `maxRounds`, the engine state, the inventory, the ledger, the standing orders, the audit fill window, and the other fields the engine reads. The save endpoint caps a body at 64 KB (`SAVE_BODY_MAX` in `src/app/api/game/state/route.ts`).

`VoyageRole` is one row per captain in an Ocean Gambit voyage: the alignment and, for most of the table, the personal flourish. The table is written by the server at departure and read back only by the server. No page and no report opens it.

`VoyageChronicle` is the durable record of a finished voyage for one captain. It holds the mode, the objective, whether that captain's last board met it, the per round trace, the alignment, whether the card won, and the closing numbers. It is read by the captain's Legacy card and by the operator reports.

`VoyageTelemetry` is one row per recorded voyage. It is written once when the voyage stops and carries the header fields a query needs plus the record as JSON. Its `roomId` is a bare indexed column with no relation to `Room`, so the record outlives a harbor that is deleted after its last captain leaves.

The other durable tables carry account level progression: `CaptainLegacy` for Renown, House, check in state, and saved settings; `CaptainMerit` for permanent achievements; `CaptainRival` for a pair's head to head record; `ConvoyVenture` for a harbor's shared venture. `Session`, `Message`, `Loan`, and `Report` cover the rest of the account and social surface.

The Ledger Integrity Pass is the trust boundary for saves. `checkSave` in `src/lib/game/integrity.ts` judges an incoming save against a plausible ceiling derived from how far the harbor has actually sailed. It never rejects a save mid voyage. At the finish, a save marked `impossible` still appears in the standings, but it banks no Renown, no Merits, and no Sea Master crown. A `suspect` save is logged and does not disqualify on its own.

## Telemetry and Operator Measurement

Telemetry is a measurement, not a rule. Events are accumulated in memory during a voyage and written as one `VoyageTelemetry` row when the voyage stops. `TELEMETRY_SAMPLE_RATE` decides the share of voyages recorded, and the sample is per voyage rather than per event. `TELEMETRY_VERSION` is 1 and `TELEMETRY_EVENT_CAP` is 4000. The record carries its version and sample rate so a reader can tell what it is looking at.

`src/server/telemetry-window.ts` reads the operator window. It opens Ocean Gambit records newest first, capped at `LAUNCH_MINIMUM_VOYAGES` (300), and reads the matching Chronicle rows for exactly those voyages. Every number on the operator page is over that one window rather than over whichever rows a query happened to reach.

`src/lib/game/dashboard.ts` turns the window into readings and `src/lib/game/gates.ts` turns those readings into a launch verdict. The verdict has three states: `clear`, `held`, and `unjudged`. `clear` requires every gate in `LAUNCH_GATE_IDS` to be in band over at least 300 recorded voyages, at full sample, with nothing unread or truncated. When gates conflict, `LAUNCH_PRIORITY` names the one that decides, currently `free_captain_pick_rate`. A gate with no source prints as not measurable rather than as zero, and a rate over an empty band prints as unplayed.

The balance report groups finished voyages by role and table size and compares each cell against the mode's target. `npm run report:bands` prints it over the live Chronicle. `npm run report:gates` prints the gate table and exits with the verdict. The balance dashboard reads the same pure readers as the command line reports, so the page and the reports cannot disagree.

## The Private Information Review

The private channel is reviewed in `docs/SECURITY_REVIEW.md`. The review covers every site that builds a broadcast payload, every site that writes to the session log, and the save path that trusts a client. Its findings and the boundaries it accepted on purpose are recorded there rather than repeated here.

The durable rules that came out of it are:

- A hidden alignment reaches a wire through exactly one shape, `PrivateEntry`. `emitPrivate` in `src/server/realtime/presence.ts` delivers an entry to the sockets of the one captain it belongs to.
- Alignments live in `VoyageRole`, not in the save, and no broadcast site reads that table. The voyage reveal is the one frame that carries the whole hand, and it is emitted only after the voyage has concluded.
- The Manifest Audit's manifest line is an allow list: port, goods, Gold, and the round number. It never carries alignment, hold, Gold on hand, or a card. `normalizeOrderFills` bounds the line in length, kinds, and quantities.
- The audited captain's Larder is shown only when the provisions layer is on, and never for a save marked impossible.
- The player detail relay is bound to the exact pair that asked and answered, so a captain cannot push a snapshot at an arbitrary account.
- A save body is capped at 64 KB.

`npm run check:private` runs `scripts/private-scan.ts`, which holds eight rules against a second path to hidden information. `npm run check:closed-test` runs the closed test guard, which refuses anything but a local SQLite file whose name begins with `closed-test`. `npm run check:dead` runs `scripts/dead.ts`, which asks whether anything outside a module reads its exports and whether anything under `src/` is a file nothing imports. `npm run check:prose` runs `scripts/prose.ts`, which holds Markdown and text files to the same dash rule the captain facing copy follows.

## The Paths

A path is a captain's specialization in Ocean Gambit. It is chosen in the path draft, and it decides three things: the size of the hold, the highest Renown the captain can bank, and which trade orders lock to them. A captain who joins after the draft may sail pathless and takes the base hold.

The five paths live in `src/lib/game/paths.ts`. `PathId` is derived from the record keys, `PATH_IDS` is the ordered list, and `pathConfig` is the only door to a record. `normalizePath` uses `Object.hasOwn` and returns null for anything unknown.

- **Convoy.** Sells escort contracts. Cannons take cargo slots, so this is the smallest hold. It brings no board orders.
- **Loom.** Runs the refit bench. Its goods and locked orders are the garment chain.
- **Aroma.** Publishes bazaar rumors. Its goods and locked orders are the commodity pool.
- **Quartermaster.** The largest hold, at `1 + QUARTERMASTER_HOLD_GAIN`, and the only path with the highest Renown ceiling. Its pool is pantry goods, which are not sold back to a port, so it brings no board orders.
- **Free Captain.** Holds no goods of its own and brings no board orders. It can borrow one locked order from another path.

A path can be switched once per voyage. The window is rounds 3 through 9, and the switch can happen at Market, Orders, or Parley. The fee is `PATH_SWITCH_FEE_BASE` plus `PATH_SWITCH_FEE_PER_LEVEL` for each Renown level above the first, capped at `PATH_SWITCH_FEE_MAX`: 30 plus 8 per level, capped at 150. The server enforces the once per voyage half through its own book; the fee and the window live in the captain's save.

The pathbound order board is the path's visible trade. `PATH_ORDER_SLOTS` is 3. The slots are appended to `state.customerCards` after the tier's scheduled board, and they are drawn from their own stream with the `:pathorders` suffix, so adding them does not change the scheduled draw. Each card names a good whose `orderPool` belongs to a path, and the first resource decides the lock. Only the holder of that path can fill it. `pathLockLine` is the shared refusal sentence, and `lockedBehind` is the lock rule.

The scheduled board is tier sized. `marketCountsFor` returns the purchase and order counts from `orderCardsBase` plus the tier's content extras, and the pathbound slots are added on top.

A Free Captain can fill one locked order from another path, once per voyage, at a payout penalty. `OPPORTUNIST_PENALTY` is 0.4, so a 25 Gold order pays 15. The payout is the face value minus the rounded penalty, floored at zero. The Factor charter is the second door: it grants three borrows at a 60 percent penalty and lets any path holder borrow, not only a Free Captain. `opportunistPayout` is the single reader for both.

## The Escort Contract

The escort contract is sold by a Convoy captain and bought by any captain. It covers one round. The seller posts an offer on the Parley board, the buyer accepts, and the fee settles at the agreement. `ESCORT_SELLER_PATH` is `convoy`, and `canSellEscort` checks the mode switch before the path.

The fee is a whole number from 1 to 1000 (`CONSENT_FEE_MIN` and `CONSENT_FEE_MAX`), read through `consentFeeFor`. An open offer lives in the phase it was posted in. An agreed contract lives for the round it was accepted in. A seller may have one open offer and one named offer per other captain. A declined row stays visible only to the two captains it names, and the buyer's reported raid Gold is visible only to the seller.

The cover is applied in Resolve after the raid roll and before Gold moves. A covered raid saves all of the buyer's Gold and raises a claim. The seller's client then applies the claim and loses the raid's Gold minus the covered share. `CONVOY_RAID_COVERAGE` is 0.4, and `escortEats` leaves the remainder on the seller. The client that was raided does not write the seller's state; it leaves `pendingEscortClaim` for the React layer to relay, and the seller's own client applies its side. Both sides are idempotent through the consent ledger.

The escort board is server state in `src/server/realtime/contracts.ts`. The engine reading lives in `src/lib/game/engine/contracts.ts`, and the shared agreement mechanics live in `src/lib/game/engine/consent.ts`, which the refit bench also uses.

## The Refit Bench

The refit bench is the Loom's trade. A Loom captain offers to put another captain's garment right, the customer accepts, and the customer's own client applies the change. `REFIT_SELLER_PATH` is `loom`, and `refitsOn` requires both `NEXT_PUBLIC_REFITS` and the garments layer.

A refit restores up to `REFIT_POINTS` (3) durability to one garment. The seller is bounded to one refit per round, and the customer can have one garment worked per round. The fee runs through the same consent primitive and the same 1 to 1000 Gold bounds as an escort. The harbor's own mend is the baseline: `MEND_POINTS` is 1 point for `MEND_GOLD_PER_POINT` (5 Gold).

A cold round also opens the harbor's rag pile. `ragsAtPort` draws one to `RAGS_AT_PORT_COLD` (3) rags from the voyage's own numbers, so every Loom reads the same pile without a server message. Each Loom takes only their own share. A rag costs `RAG_SCRAP_VALUE` (4 Gold), and `REWEAVE_RAGS` (2) rags reweave into one `REWEAVE_GOOD` (`Linen Clothes`).

## The Bazaar Rumor

The bazaar is the Aroma path's ability. `BAZAAR_SELLER_PATH` is `aroma`. A rumor names one commodity whose price will lean at the next port. The fleet sees who spoke and which good was named. The direction stays with the publisher until the market it moves has been drawn, so a price move is not automatic evidence of who leaned it.

A rumor is priced by the market one round after it was spoken, so a rumor in the closing round is refused. A captain can speak once every `RUMOR_COOLDOWN_ROUNDS` (3) rounds. The shift is `RUMOR_SHIFT_FRACTION` (0.1), up or down. The goods a rumor can name are the unlocked commodities for the round that will price it, read through `bazaarGoods`, and the server checks the wire against that same list.

The rumor board is server state in `src/server/realtime/bazaar.ts`. The public row type, `PublicRumor`, carries a null direction until the market is drawn. The engine reading lives in `src/lib/game/engine/bazaar.ts`.

## The Free Captain's Borrow

The Free Captain can fill any one order that is locked behind another path, once per voyage, without joining that path. `OPPORTUNIST_USES` is 1 and `OPPORTUNIST_PENALTY` is 0.4. The payout is the face value minus the rounded penalty, with a floor at zero, so a 25 Gold order pays 15.

The Factor charter opens a second door. It grants three borrows at a 60 percent penalty and lets any path holder use the borrow, not only a Free Captain. `opportunistIsBorrower`, `opportunistAllowance`, and `opportunistPayout` read the path and the charter flags, so the card text, the board, and the fill all quote one rule.

The borrow is spent when the order is filled, not when the board is opened. `canFillOrder` takes a `borrow` flag, which defaults to false, so no policy surface can spend the ability without the captain choosing it.

## The Path Draft

The path draft is the first seat of an Ocean Gambit voyage. The server deals three cards to each captain, and the hands are private. The deck is built from `draftComposition`: equal weights for the five paths, with a floor of `DRAFT_QUARTERMASTER_MIN` (2) Quartermaster cards. The deck has three cards per seated captain, so it is dealt out entirely.

The draft runs in three steps. Each captain keeps one card from their hand and passes the rest to the seat on their left. The second hand is two cards; the last step chooses the final path between the two cards the captain kept. A pick is an index, because a floor can deal duplicate paths. No card a captain does not hold is ever sent: the server sends each captain their own view, and the table sees only a count of who has chosen.

There is no clock. A step closes when every seat has picked. A seat whose last socket dropped is rescued by the absence watch after `DRAFT_WATCH_MS` (15 seconds), which lays that captain's first card. A captain who joins after the deal sails pathless. The settled path is published as a name and a path id, never with the cards behind the choice.

The server mints a one time seed for the shuffle and drops it, because a client that knew the seed could read the other hands. Only the settled paths and the switch book outlive the draft, and both are cleared when the voyage ends.

## The Supply Barge

The Supply Barge is an anonymous vendor that stands at one port each round and sells Grain at a premium. It exists on the provisions layer, so `bargeOn` reads `survivalLayerOn` and has no switch of its own. It is the fallback for a table with no Quartermaster.

The port is drawn from the harbor's unlocked ports for the current round, using a seed built from the voyage epoch, mode, difficulty, and round, so every client reads the same quay without a server message. The ration price is `RATION_PRICE` times `BARGE_PRICE_MULTIPLIER` (1.8), rounded up. The lot is one to `BARGE_RATIONS_PER_ROUND` (8) rations for each captain, drawn from the port and the round. What a captain takes is their own record in `bargeRound` and `bargeTaken`, reset when the round turns. The barge never becomes a shared shelf.

## The Social Economy

The Captain's Exchange is the standing trade board. It is open to every captain from their first voyage, and nothing on it is rationed. An offer escrows the offered goods or Gold at the moment it is posted, so the same stock cannot be promised twice. The board is server state and outlives a phase, which is why a trade can settle in any phase. Both sides apply their own movement, and `peerTradeProfit` counts the settled trade for the Broker's card.

Flexible bartering is the extra surface in the harbor chat. It unlocks at Renown level 10 (`FLEXIBLE_BARTER_UNLOCK_LEVEL`), and both the poster and the accepter must be at that level. One of a captain's flexible offers may be taken per voyage, and at level 15 (`FLEXIBLE_BARTER_SECOND_ATTEMPT_LEVEL`) two may be taken. Accepting is never rationed. A completed flexible trade retires every other flexible offer its own poster still has standing. The rule lives in `src/lib/game/engine/barterAccess.ts`.

Loans are direct aid between captains. A borrower asks, a lender grants, and the debt is recorded. An unpaid loan is deducted automatically when the voyage ends. A third captain can back an outstanding loan, escrowing Gold against the borrower's shortfall; if the loan is repaid in full, the pledge returns and the backer earns Reputation. A bankrupt borrower can route an outstanding loan to a still active captain. Lending and backing share one per voyage Reputation ceiling, so neither path can be used to farm past the other.

A convoy venture pools the harbor's Gold toward a target by a deadline. Only one venture can fill in a voyage. Contributors are paid a proportional share at the venture's multiplier. A venture that misses its deadline returns a partial refund, and a venture canceled because another filled first returns the full contribution. Harbor Watch lets the host mute one captain from harbor chat for the rest of the voyage.

## What Persists Between Voyages

The Reputation a voyage ends with becomes Renown XP, multiplied by the difficulty tier's `renownXpMultiplier`; a forged finish banks none. The curve is triangular: level 2 needs 100 XP, level 3 needs 300, level 4 needs 600, and so on. Seven titles track the climb from Deckhand to Silk Road Sovereign. Renown level 5 unlocks the Broker's Favor, and each level above 1 grants 3 extra starting Gold on the next voyage, capped at 60.

Nine Captain's Merits mark permanent achievements, three of them scoped to a difficulty. A seven day check in cycle grants Renown XP. It is position based rather than a streak: a missed day does not reset progress, the UTC date key enforces one claim per day, and the cycle wraps after day seven.

A captain may pledge to one of three Great Houses. The pledge is account level, survives every voyage, and may be changed between voyages. Each House grants one small perk at the start of a fresh voyage: Jade Pavilion's first artisan is free, Vermilion Gate adds one cargo lot to the Port Purchase board each round, and Golden Lotus cuts wages by 20 percent while raising the pirate chance by 5 percent. The perk is applied when the voyage starts and never partway through one.

The three Ages of the Ledger rotate every 14 days, anchored on the Unix epoch. Every harbor shares the same Age at the same moment. The Age of the Lender pays 50 percent more Renown on a backing pledge that returns whole, the Age of the Trader adds one Reputation to every completed barter trade, and the Age of the Broker raises the Broker's Favor payout cap to 250 Gold.

A rivalry is recorded when two captains finish the same voyage. The pair is stored by account id in sorted order, so both captains read one record. The Legacy card shows meetings, wins, losses, and ties. The Voyage Chronicle is a short prose record written when a voyage concludes. It names the captain, the waters, the largest trade, the lending and borrowing, and the closing line. It is a pure function of the voyage's numbers, and a bankrupt voyage gets a Chronicle that says so.

## The Harbor Manifest

The Harbor Manifest is the design list of eighteen systems. The tree implements all of it except House Rally, which has no table, route, or switch here. Seven systems arrived with 2.2: Partial Sight, Great Houses, Ages of the Ledger, Captain's Rival, Voyage Chronicle, Quick Start Match, and Bilingual Harbor. Houses, Ages, Rival, and Chronicle are described above under what persists.

Partial Sight lets a captain at Renown level 5 or above see the detail of a captain at level 3 or above. The hold is shown as a band rather than a count: none, a few up to three, some up to eight, plenty up to fifteen, and a haul beyond that. The banding happens on the client that is looking, so it adds no new trust boundary. The rule lives in `src/lib/game/engine/partialSight.ts`.

Quick Start seats a solo captain in the first public harbor with a free seat, or opens a fresh public harbor and makes them the host. The queue is in process and the ceiling is four members (`QUICK_START_MAX_MEMBERS`). Matches are chained, so two captains pressing at once are not sent to two different harbors.

The Bilingual Harbor carries English and Mandarin for the captain facing interface. The locale is stored in the `pm_locale` cookie and sent to the socket. A ledger line holds the fact and its values rather than a finished sentence, so the sentence is built at the read in the reader's language. `src/lib/game/i18n/index.ts` owns the pack and the `t`/`tFor` readers.

## Ocean Gambit Private Systems

Ocean Gambit adds hidden roles, a public commission, two harbor votes, and a reveal. The mode is selected once per harbor and is a property of the harbor, not of an account.

### The Private Card

Every captain is dealt a private card at departure. The roles are `honest`, `pirate`, and `broker`. A table of four or five hides one card; a table of six or more hides two. The first hidden seat is always a Pirate. The second may be a Pirate or a Broker, and two Brokers are never dealt. Every other captain is Honest.

An Honest captain also receives a personal flourish drawn to match the public commission. A Pirate or Broker receives no flourish. At a table with two Pirates, each is told the other's name and id, never a role, so the pair can coordinate without learning more than the design gives them. A captain who joins after departure is dealt an Honest card with no flourish and can still win on the commission alone.

The deal is minted by the server in `src/server/realtime/gambit.ts` from a one time seed. Only the resulting `VoyageRole` rows survive, and a reload reads them. The engine vocabulary and the draw live in `src/lib/game/gambit.ts`; `normalizeRole` falls back to Honest for an unreadable value, because guessing the other way would hand a captain a secret the table never drew.

### The Public Commission

The fleet is set one public commission before the voyage starts. It is drawn from `OBJECTIVE_DECK` by the seed `${harborId}:V${voyageEpoch}:objective`. Every entry asks for at least two goods and at least `STARTING_STOCK` (16) items, so no single hold can satisfy it and the fleet has to trade or buy over more than one round. The commission pays the Emperor's price per item, above the going rate.

The quota scales with the fleet. `SEAT_BANDS` multiplies every count by 1 at four or fewer captains, 1.25 at five, and 1.5 at six or more. A seat suffix is added to the seed only above the anchor band, so a table of four or fewer draws exactly the board the founding deck would have drawn. The entry does not change with the band; only the amounts do.

The harbor pins the fleet size in `Room.voyageSeats` at departure. The server deals and clamps against that pinned count, not against the current roster, so a captain who leaves does not shrink the commission. A report of delivered goods is a cumulative total merged by maximum, never summed, and it is clamped to the amount the commission still owes. The tally is in memory and each captain's own state carries their contribution, so a server restart costs a few seconds of reports rather than the board.

`src/lib/game/objectives.ts` owns the deck, the bands, the seed, the clamp, and the trace. `src/server/realtime/objective.ts` owns the harbor tally.

### The Manifest Audit

From round 5 (`AUDIT_FROM_ROUND`), once per voyage, a simple majority of the active roster may open one captain's manifest during Parley. `AUDIT_VOTE_RULE` states the count: a majority is more than half of the captains still in the voyage. The vote spends the rest of that Parley's trading, which is the cost of the evidence.

The harbor sees a sample of two fills from the audited captain's last five (`AUDIT_REVEAL_COUNT` and `AUDIT_WINDOW`). The sample is drawn from the seed `${harborId}:V${voyageEpoch}:audit:R${round}:${targetUserId}`, so it is reproducible from voyage values rather than a fresh draw. The randomness is the design: an innocent captain can look bad and a guilty captain can look clean, so the table argues about evidence rather than accepting a verdict.

The manifest line is an allow list. It carries the port, the goods in the fill, the Gold paid, and the round number. It never carries alignment, hold, Gold on hand, or a card. When the provisions layer is on, the reveal also shows the audited captain's Larder and whether the crew is on short rations. A save marked `impossible` yields no lines and no Larder, only the flag.

The vote and the reveal live in `src/server/realtime/audit.ts`; the sample and the voting arithmetic live in `src/lib/game/audit.ts`. The reveal is kept for a joiner and cleared on restart, because the reveal itself is the once per voyage flag.

### Maroon and the Harbormaster's Hand

From round 9, once per voyage, two thirds of the captains still sailing (`MAROON_VOTE_SHARE`) may vote one captain ashore. The count is inclusive: `maroonNamesNeeded` is the smallest whole number at or above two thirds of the roster. Two thirds of a table of three is two votes, not unanimity. The vote is counted against the same active roster the audit uses, so a captain outside the harbor's arithmetic cannot move it.

A marooned captain is not removed from the table. The harbor takes the ship, everything bolted to it, and everything in its hold. The captain keeps half their Gold (`MAROON_SHARE` is 0.5), their crew, their card, their vote, and their seat. They take up the Harbormaster's hand.

Once per round, the Harbormaster names one port the charter has opened and leans every raw goods price there by 10 percent up or down (`PORT_SHIFT_FRACTION` is 0.1). The shift is delivered on the advance that opens the next market and expires with it. A call made in the closing round is refused, because it would lean a market that never opens. A client stamps the shift onto its own state and prices through `portShiftMultiplier`, so the leaned market is one more hand on the same price rather than a second pricing path. Product cards are priced from their recipe and are not leaned.

The vote and the shift live in `src/server/realtime/maroon.ts`; the arithmetic and the shift shape live in `src/lib/game/maroon.ts`.

### Victory and the Reveal

A card decides what winning means for its holder. An Honest card wins when the fleet's commission is met and the personal flourish, if one was dealt, is met with it. A Broker card wins when `peerTradeProfit` reaches `BROKER_PAYOUT_TARGET` (2200), regardless of the commission. A Pirate card wins when the commission fails, the Pirate is not bankrupt, and Reputation is at least `PIRATE_STANDING_FLOOR` (50).

`evaluateVictory` in `src/lib/game/victory.ts` is the rule. The ending numbers come from the finish report and the captain's save. `readEnding` treats the save as untrusted and normalizes the hold and delivery tallies, while the reported Gold, Reputation, and bankrupt flag win where the two overlap.

The Sea Master crown is separate from the card verdict. It goes to the highest Reputation among captains who reached endgame, are not bankrupt, and were not disqualified by the integrity pass. A captain can win their card without taking the crown, and can take the crown without winning their card.

Verdicts stay private while there is a round left to sail. They are written to the captain's Chronicle row and withheld from every wire. The reveal is emitted after the conclusion, once every result is decided. It carries the whole hand, the verdicts, and the fleet trace. It is kept in memory for a captain who reloads onto the finished table and cleared when the voyage restarts. Classic deals no cards and receives no reveal.

### The Sealed Harbor

Ocean Gambit is a sealed mode. The mode record sets `sealed: true`, and the create route refuses to charter the harbor without the unlock phrase. The phrase is `the second ledger`, stored in `UNLOCKS` in `src/lib/unlock.ts` with the mode it opens. The normalization lowercases the input and collapses punctuation and whitespace, so capitals, a trailing full stop, and stray spaces still open the door.

The phrase is a harbor setting, not an account permission. One captain can open the table for everyone seated at it. The harbor records the id of the door it was opened through in `unlock`, never the words. The tenth completed voyage (`UNLOCK_EARNED_AT` is 10) writes the phrase into that voyage's Chronicle, and the How to Play guide and `README.md` also print it. A phrase that opened one harbor opens the next one too.

## The Harbor's Width

The harbor is an app shell on a wide window. It takes the window's height and does not grow past it. The left rail, the stage, and the right rail each scroll inside themselves, and the control row stays pinned under the stage.

The two side rails are `clamp(232px,19vw,292px)`. The stage is capped at 1760 pixels. The stage is a CSS container: the scroller carries `@container` and the boards inside use container variants, so a board asks the width it is actually drawn in rather than the width of the window.

The board ladders are one column, two at `@2xl` (672 pixels), and three at `@5xl` (1024 pixels) for the purchase and order boards. The boon and module drafts go from one column to three at `@2xl`, because a draft is a comparison and three choices cut to a third of a narrow stage compare worse than three read in sequence.

The rails fold. A folded captain's rail leaves a 52 pixel stub holding the way back and the round. A folded roster or chat widget leaves a 48 pixel strip at the rail's outer edge, with the sibling taking the rest of the rail. When both right rail widgets are folded, the rail itself folds to a 52 pixel two icon stub whose icons reopen the panels. The rail column keeps its clamp through a single fold, so the stage's width does not move. A fold below the split has no strip to hold, so it folds to the panel's own head through the chevron all three panels share.

The right rail's roster and chat split their height two to three. The roster stands on `clamp(240px,40dvh,400px)` and the chat on `clamp(300px,50dvh,520px)`, with the wide layout using viewport height floors under the same ratio. The split is a ratio rather than a pair of flat sizes, so the two panels stay balanced at every height.

The fold record is three booleans in local storage under `portmasters_room_panels`: `left`, `roster`, and `chat`. The file is `src/lib/use-panel-prefs.ts`. It is read once on mount and written once per press. The right rail is not a fourth key; it is derived as folded exactly when both of its panels are. The grid transitions between its templates over 200 milliseconds with `motion-reduce:transition-none`, so the operating system's reduced motion setting is respected.

The keyboard legend lives with the control row, not inside the stage, and is drawn only at or above the width where the harbor splits into columns. The layout holds itself to no sideways scroll at the widths it covers.

## The Operator Screens' Width

The console at `/admin` and the balance dashboard at `/admin/balance` use the window's full width behind one gutter, `px-[clamp(0.75rem,2.5vw,3rem)]`. Each screen's content column is an `@container`, and there is no width cap. Every pixel past the gutter belongs to the register.

The register is a table when its own column has room and a card per account when it does not. The threshold is `@min-[52rem]`, read off the column rather than the window. The table's floor is 817 pixels for its content, the frame adds two pixels of border, and 52rem is 832 pixels, so the threshold clears the floor with room to spare. The table and card presentations are exact complements, and both carry every fact the other does. The threshold is written at both call sites because Tailwind reads class names as text; an assembled name would never be emitted.

The register's search uses `useDeferredValue`, so a keystroke paints before the rows catch up. The four counted filters, All, Online, Admins, and Banned, count the set the search matched rather than the whole roster, so a chip never promises a count its press cannot keep. Selection follows the view: the header checkbox acts on exactly the accounts shown, stands indeterminate on a partial tick, and a tick survives a filter change so an operator can act on a set gathered across views.

At `lg` and above the console is an app shell one window tall, the register frame is its only scroller, and the header cells are sticky. Below `lg`, the document scrolls. The row actions are words rather than conditional icons, and their labels do not disappear at a window breakpoint.

The balance page's subtitle stands up to two lines instead of truncating. Its largest numbers sit one type step above their pills, and the pills are held `shrink-0` so a long reading cannot squeeze them. The verdict cell holds its pill on one line.

The four reading tables share column tracks so the panels lay out identically. Reading, Gate, and Verdict take fixed shares, and Window is the column that gives, because its values are lists of readings by table size. The fixed shares keep the same Gate column from wrapping on one panel and sitting on one line on the next. Both operator screens are container queries and neither scrolls sideways.

## The Shared Surfaces

A look written more than once is a look that drifts. The shared components under `src/components/` are:

- `ModalClose`, beside the modal overlay, for the close button on the dialogs. Each caller passes a label and nothing else.
- `PanelHeader`, for the captain's rail, the roster, and the chat. The icon, the uppercase title, and the fold chevron are one head, which also puts the fold in the same place on all three.
- `PathDeskRow` and `JustForChip`, for the escort, refit, bazaar, and barter desks. The row carries its three tones, including the tint for an offer aimed at one captain, and the chip reads the name off the offer rather than off the reader.
- `VoteCardShell`, for the heading and section rhythm the audit and maroon votes share while their bodies stay separate, because the difference between the mechanics is the point.
- `Select`, for dropdowns. A board that needs a different height asks for it in `className` rather than writing a second dropdown.

Three repeats are deliberate. The quiet button tint stays at the call site because the stylesheet's wash class carries no color and tint is the caller's. The two vote card bodies stay separate for the reason above. The inline panel closes differ in padding, weight, and margin, which is the whole of what a shared component would have to be told.

## Deployment

The repository carries one host configuration, `railway.json`. The build installs development dependencies and runs `prisma generate`. The start command sets `NODE_ENV=development`, defaults `DATABASE_URL` to `file:../db/custom.db`, runs `prisma db push --skip-generate`, and starts `tsx server.ts`. The health check is `/api/health`, the service requires a volume at `/app/db`, and it runs one replica.

The hosted service runs the development server rather than a production build because `next build` needs more memory than the smaller plans provide. A build killed halfway is a deploy that never lands. The volume is what keeps the SQLite file across deploys; without it, every account and voyage is lost on restart. The single replica matters because the harbor state and socket layer are in process.

## Architectural Strengths to Conserve

- The client authoritative deterministic engine, with seeded shared facts and server minted private deals.
- The pure money modules and the single mutation path `addOwnedAmount`, so a balance change cannot take a second route through the code.
- The ready check and the active roster rule, which keep a harbor moving without waiting on captains who have left.
- The Ledger Integrity Pass, which judges a save against the voyage's own length and disqualifies only at the finish.
- The phase data record: one face, one budget, and one lap per mode, so a phase cannot be named twice.
- The normalize on load pattern for old saves, old phases, and untrusted wire values.
- Wholesale replacement of `modifierFlags` each round, so a boon cannot leak into the next round.
- The `_` prefixed transient fields that carry engine to React to socket signals without becoming durable state.
- Live reads of hold and Gold in every phase, so a trade changes what a phase can afford before the phase ends.
- The single harbor channel and the private emit path, which keep a hidden card off every broadcast.
