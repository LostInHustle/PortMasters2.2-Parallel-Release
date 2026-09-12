# PortMasters 2.2 Parallel Release

This is the release note for the 2.2 build. It answers one question: the game already exists in an earlier build, so what is different now?

The short answer is that PortMasters 2.2 Parallel Release is a build of its own rather than a patched copy of the one before it. Every rule, every price and every system that build established is still here, working the same way, and six whole systems are built on top of them. The interface, the realtime layer and the way the process starts up were rebuilt around that.

## The build before this one

The earlier build is [PortMasters 2 Parallel Release](https://github.com/LostInHustle/PortMasters2-Parallel-Release), written by Joe Zhou and Aaron Zhu. That is where the multiplayer game as it exists today was designed. The deterministic engine, the ready check, the three difficulty tiers, the social economy and the Ledger Integrity Pass all come from there.

The 2.2 build branches from it rather than patching it. Every game system that build shipped is still in this one. Only two files were dropped along the way. One is the single file realtime layer, which was split into modules. The other is a Hello World stub on `/api` that answered nothing and that nothing called.

## At a glance

|                                 | The earlier build      | PortMasters 2.2 Parallel Release |
| ------------------------------- | ---------------------- | -------------------------------- |
| Harbor Manifest systems shipped | 10 of 18               | 16 of 18                         |
| Realtime layer                  | one file, 3,097 lines  | 17 modules, 3,605 lines          |
| Engine modules                  | 12, across 2,493 lines | 17, across 3,235 lines           |
| API routes                      | 16, plus a stub        | 22                               |
| Interface components            | 29                     | 41                               |
| Database models                 | 10                     | 12                               |
| The port the game answers on    | 2232                   | 8080                             |
| The bind address                | not configurable       | `HOST`, defaulting to `0.0.0.0`  |

## The six systems 2.2 adds

Each of these is a numbered entry in the Harbor Manifest, the design document that listed eighteen systems and shipped ten of them. These are six of the seven that were still on that list when 2.2 started.

### Partial Sight (Manifest 06)

Renown buys a clearer view of the captains you sail with. A captain at Renown level 5 or above, which the game calls a Trade Officer, sees the detail of any captain at level 3 or above: what is in their hold and roughly how much Gold they carry. Below either threshold, the viewer sees only the headline numbers, the level and the title.

The hold is shown as a band rather than a count, so a partner can tell a few from a haul without reading your ledger. The bands are none, a few up to three, some up to eight, plenty up to fifteen, and a haul beyond that. This adds no new trust boundary. The numbers were already being sent to every client in the harbor, and the banding happens on the client that is looking.

### Great Houses (Manifest 08)

A captain may pledge to one House. The pledge is account level, so it carries across every voyage, and it can be changed at any time between voyages. The three Houses map onto the three corners of the voyage loop.

| House          | Motto                            | What it stands for         |
| -------------- | -------------------------------- | -------------------------- |
| Jade Pavilion  | Patience polishes the stone.     | The artisan economy        |
| Vermilion Gate | The gate is open to every cargo. | The market and cargo trade |
| Golden Lotus   | Fortune favours the bold wager.  | The wager economy          |

A pledge is a second identity alongside Renown, and it is deliberately kept separate from it. Renown measures how long you have sailed. A House says what kind of captain you are while you do it. Every pledge also feeds a harbor wide House standing, so the three Houses compete on total crowns, voyages and best Reputation rather than on any one captain's numbers.

Each House carries one small passive perk, applied at the start of every fresh voyage and never partway through one. Jade Pavilion's first artisan joins at no cost, with the first wage on the House. Vermilion Gate adds one more cargo lot to the Port Purchase board, every round. Golden Lotus pays 20 percent less in wages against a raid chance 5 percent higher. None of the three touches a number that compounds, which is what keeps a pledge a flavour rather than a power pick. A captain can change House between voyages, and the new perk takes effect on the next start.

### Ages of the Ledger (Manifest 10)

The three peer economy tools take turns in the spotlight. Each Age holds for two weeks, then the next takes over, and after the third the cycle starts again.

| Age               | What it is designed to reward                              |
| ----------------- | ---------------------------------------------------------- |
| Age of the Lender | Backing another captain's loan pays 50 percent more Renown |
| Age of the Trader | Every completed barter trade lands one extra Reputation    |
| Age of the Broker | The Broker's Favor commission cap rises to 250 Gold        |

Every captain in every harbor is under the same Age at the same moment, so an Age changes what the harbor rewards, never who is in it. The cycle is anchored on the Unix epoch rather than on any server's clock, which means two captains in different time zones work out the same Age from the same timestamp.

The rotation is live, the banner that announces it is live, and each of the three rewards is applied where it lands. A backing pledge pays its extra Renown when the pledge resolves. A completed barter trade lands its extra Reputation on both captains, so it is the trade that earns it rather than whichever captain happened to post the offer. The Broker's Favor commission cap is read from the Age in force, so every quote and the payout itself move together. Each effect stays deliberately small, a lean rather than a dial, so an Age cannot unbalance a voyage that began under a different one.

### Captain's Rival (Manifest 11)

The captain you keep sailing against gets a scoreboard of their own. Every time two captains finish a voyage in the same harbor, the meeting is recorded with its outcome, and the pair accumulates wins, losses and ties across every voyage they have sailed together.

The pair is identified by a key built from the two account ids in sorted order, so a meeting recorded as Lin against Wei is the same record as Wei against Lin. One record serves both captains and neither needs a second copy. The head to head line sits on the Legacy card and appears only when both captains are in the same room, so it reads as a rivalry rather than as a statistic.

### Voyage Chronicle (Manifest 12)

A finished voyage already showed a hard ledger of rounds, peak Reputation, final Gold and taxes. The Chronicle is the prose layer on top of it: a one sentence headline and a body of three to five sentences, written at the moment the voyage concludes and stored so a captain can read it again later.

The headline names the captain and the waters they actually sailed, and leads with the crown if they took it or with the loss if they went bankrupt. The body carries the rounds, the peak Reputation, the largest single trade, how much lending and borrowing happened, and the closing line. It is a pure function of the numbers, so the same voyage always produces the same prose, and it never dresses an outcome up. A bankrupt voyage gets a Chronicle too, one that says so plainly.

### Quick Start Match (Manifest 17)

A captain who just wants to play, without rounding up a room code or waiting for a friend, presses Quick Start. The queue seats them in the first open public harbor with a free seat, or opens a fresh one and makes them the host. The tier they picked in the Lobby before pressing the button is the tier a fresh harbor opens at.

Two captains pressing the button in the same tick used to be seated in two different harbors, because both looked for an open room before either had created one. Matches are chained now, so the second waits for the first to finish, and the room the first captain opened exists by the time the second one looks for it. A harbor whose remaining members have all closed their tabs is skipped as well, since it is not open, it has simply not been cleaned up yet.

## A rebuilt interface

The most visible change is how the game looks and how much of it explains itself while you play.

The palette is drawn from East Asian art and the morning sea. Celadon green as the primary, the colour of the porcelain that gave the trade its name. Vermilion as the accent, the colour of the seal stamped on every manifest. Imperial gold for warmth, indigo for depth, and rice paper cream as the canvas. Panels are glass floating over a sea gradient, and the textures behind them are seigaiha waves and crackle glaze. Display headings are set in Noto Serif SC, which carries a little brushwork without costing legibility.

Eleven screens and panels are new.

|                    | What it does                                                               |
| ------------------ | -------------------------------------------------------------------------- |
| How to Play        | A nine step walk through a voyage, readable from the Lobby before you sail |
| Settings           | Sound, colour preference and the rest of the per captain options           |
| Keyboard shortcuts | The full key map on one screen                                             |
| Captain profile    | Another captain's public record, opened from the roster                    |
| Difficulty advisor | Suggests a tier based on how much time a captain has                       |
| Action suggester   | Names the next worthwhile move instead of leaving a new captain staring    |
| Voyage timeline    | Where the voyage has been and where it is going                            |
| House leaderboard  | The three Houses ranked by crowns, voyages and best Reputation             |
| Leaderboard        | Captains ranked across the whole game                                      |
| Sparkline          | A small trend line, used wherever a number moves over time                 |
| The Age banner     | Which Age holds the harbor, and what it is rewarding right now             |

Sound is new as well. The tones are synthesized at runtime through the Web Audio API rather than loaded from files, so there is nothing to download and no asset to lose. A wooden clapper marks a confirmation, a soft bell marks an arrival and a low drum marks a warning, over a quiet ambient bed that only plays while the page is visible. The toggle and the volume both persist on the device.

## A rebuilt realtime layer

The realtime layer was one 3,097 line function. It is now seventeen small modules under `src/server/realtime`, each owning one concern: presence, the checkpoint protocol, barter, aid, loans, ventures, chat, conclusion, pulse, docks, surge, rival, quickstart, status, auth, types and the composition root that wires them together.

Two shapes moved somewhere both halves can reach. `PublicUser` and `CaptainStatus` now live in `src/types/realtime.ts` with no runtime dependencies, so the client and the server are described by one definition rather than two that drift apart. `CHECKPOINT_PHASE_ORDER` moved to `src/lib/game/checkpoint.ts`, so the ready check and the interface read the same list from the same place.

The reason to care is not tidiness. Code buried inside a socket closure can only be reached by starting a server and driving it over a socket. Code in a module can be imported and checked on its own, which is something the rules engine has always been able to do and the realtime layer could not.

## Configuration and boot

The previous build read `PORT` where it happened to be needed and otherwise assumed a working environment. 2.2 reads the environment once, at boot, and validates it.

| Variable       | Default                | What it does                                                |
| -------------- | ---------------------- | ----------------------------------------------------------- |
| `DATABASE_URL` | `file:../db/custom.db` | The SQLite file holding every account, harbor and voyage    |
| `PORT`         | `8080`                 | The port the whole game answers on                          |
| `HOST`         | `0.0.0.0`              | The bind address, so another device on the network can play |

A port that is not a whole number between 1 and 65535, a missing database URL or a database URL that names neither SQLite nor Postgres stops the server with a message naming the variable it did not like. Every problem is reported at once rather than one restart per mistake. Binding `0.0.0.0` by default is what lets a phone on the same wifi open the game, and what lets one tunnel put the whole thing online.

Shutdown changed too. On `SIGINT` or `SIGTERM` the process stops accepting connections, drops the live sockets, closes the HTTP listener and disconnects the database, in that order, so work in flight is allowed to finish rather than being cut off. A second interrupt cannot start a second teardown while the first is still running.

## What came across unchanged

Everything the game already did. The verbatim economy from the original single player build: Hemp, Silk and Tea, the founding ports, the all or nothing pirate raid and the escort rate. The three difficulty tiers, Fair Winds, Open Waters and Monsoon Season, with their charters, pirate odds and Renown multipliers. The seven step round and the ready check that keeps every captain in step. The social economy: the barter board, direct offers, financial aid, backing, bequest routing, convoy ventures and Harbor Watch. Harbor Pulse, Word on the Docks and Tidewatch Alerts. The Ledger Integrity Pass. Captain's Legacy, Renown and its seven titles, the nine Captain's Merits and the seven day check in. The colourblind safe palette, the fleet ticker, presence, room chat and direct messages.

Nothing in that list was retuned to make room for the new systems. That is the point of the six additions: they lean on actions that were already legal rather than changing what is legal.

## Repairs alongside the new systems

Several things that were wrong or fragile are fixed.

**Open barter offers are refunded however the phase ends.** A captain who leaves the Bartering phase through the control bar used to walk away from their own posted offers, and the Gold held behind them went with it, because that path never told the engine what was still open. Both ways out of the phase now hand the engine the same list of live offers, so the refund lands whether a captain presses Done Bartering in the panel or moves the round along from the bar.

**The rumor price is worked out instead of remembered.** The price of a rumor was stored on the voyage and rewritten whenever the Broker's Network module was equipped or removed. It is a small sum that is right either way, but two places holding one number is a place for them to disagree, so the price is computed from the module now and the stored value is gone.

**The market remembers what things cost.** Each round records the average price paid for every good, and the Purchase phase draws that as a small trend line beside the shelf. A captain can now see whether Silk has been climbing all voyage before deciding whether to buy, which is the kind of read the market was always supposed to reward.

**A module draft can be abandoned.** A captain partway through choosing a shipyard module can back out and return to the picker rather than being held to the first pick they touched.

**A stranded pledge is swept.** A pledge rides on a loan: one captain backs another's borrowing, and the backer is paid when the borrower repays. A borrower who goes bankrupt keeps their socket open to watch the standings, and the voyage end sweep read that open socket as a captain who might still be about to pay. Bankruptcy is final, so the loan was never swept, the pledge riding on it never resolved, and the backer's escrowed Gold sat out the voyage. The sweep treats a bankrupt borrower as absent now, which is what they are.

**A pass over every buff, so the promise and the payout agree.** `docs/BUFF_AUDIT.md` traces every boon, every ship module, every House perk, every Age, every difficulty modifier, every Merit and every Renown rule from where it is declared to where it is read, and compares each promise to the result. The repairs it produced are all in. The two charter boons no longer share one gate, so each covers its own tier. The Silk goods list covers both goods made with Silk. The Settlement panel builds its pirate risk and its escort quote from the same functions that roll and charge them. Harbor Pulse is calibrated to the number of goods the harbor actually trades. The Purchase reference price applies the same module discounts as the counter. A failed save load no longer costs a captain their Renown level. The few numbers the interface stated that the game did not are corrected.

A worker field that was written to zero and read by nothing was removed at the same time. It changed no behaviour, and the point of removing it is that the next person reading the worker code will not spend an afternoon working out what it was for.

## What is still to come

Two of the eighteen Manifest systems are not in the game.

**House Rally** (Manifest 09) was designed and not built. It would have given a harbor where most of the captains share a pledge a flavour banner and a bonus House standing at voyage end. It is the last system on the roadmap.

**Bilingual Harbor** (Manifest 15) was built in full and then removed at the owner's request. It does not come back without a fresh owner decision.

One smaller item is written and visible without yet doing anything, and this document would rather name it than let a table imply otherwise.

The Harbor activity feed opens onto a panel that says there has been no recent activity, and it will keep saying that until the endpoint it would read from exists. It is a small piece of work rather than a rewrite, and it is not broken: it is simply not switched on. The three House perks and the three Age effects used to sit on this list beside it. Both are wired in now, so they have left it.

## Where the two repositories differ outside the game

The game is a strict superset. The tooling around it is not, and it is worth knowing which repository carries what.

The previous build carries a deep test suite: eleven `tsx` suites over the pure rules, the harbor systems, convoy and backing math, plus a Playwright layer with five browser scenarios, and it ships a deployment guide for Railway. 2.2 carries one smoke test that runs two captains through registration, a shared harbor, live presence, a status broadcast, a reload and a Quick Start pairing against a server that is already up, and it carries no host configuration.

2.2 is also on Prisma 6 rather than Prisma 7, which is why the connection string lives in `prisma/schema.prisma` here and the client needs no driver adapter, and why there is no `prisma/migrations` history in this repository. `db:push` is the way the tables get created.
