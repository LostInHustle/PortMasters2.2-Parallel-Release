# PortMasters 2.2 Parallel Release

A browser based multiplayer trading game set on the maritime Silk Road.

Captains gather in a shared harbor. When the crew is ready the host sets sail, and from that moment everyone plays the same voyage together. Each round opens with a boon draft at Dawn, then the port market, where captains buy goods and put their artisans to work, then the Parley and the Orders board, then settlement, where wages, upkeep and pirate raids come due, then refitting at the shipyard. The Parley and the Orders board swap places by voyage: Classic trades at the table before filling orders, and Ocean Gambit fills orders first. Nobody moves to the next gate until every captain still sailing has readied up. Whoever ends the voyage with the highest Reputation is crowned Sea Master.

Everything runs as a single npm project on a single port.

## Quick start

You need Node.js 20.19 or newer. Nothing else, and in particular no Bun and no separate backend.

```bash
# 1. Install the dependencies and generate the database client
npm install

# 2. Give the server its environment file
cp .env.example .env

# 3. Create the database tables (safe to run again, it only adds what is missing)
npm run db:push

# 4. Start the whole game at http://localhost:8080
npm run dev
```

Step 2 is not optional. The server refuses to start without `DATABASE_URL`, and the Prisma command in step 3 reads the same value from the same file, which is why copying the example is the shortest path to a working setup rather than a formality.

Open http://localhost:8080, register a captain, and look around.

To try the multiplayer side, open a second browser or a private window rather than a second tab. Tabs in the same browser share one cookie jar and therefore one signed in captain.

Two things surprise people at first. The port is 8080, not 3000. And there is no separate backend to start: the site, the REST API and the realtime channel are one process.

## What each command does

| Command                     | What it does                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run dev`               | Starts the game in development mode on port 8080, with hot reload                                   |
| `npm run build`             | Generates the database client, runs the tag, card and status checks, then produces a build          |
| `npm start`                 | Runs the production build on port 8080                                                              |
| `npm run typecheck`         | Checks every TypeScript file and reports type errors                                                |
| `npm run lint`              | Runs ESLint across the project                                                                      |
| `npm run test:smoke`        | Drives a real voyage through a running server and checks it arrived                                 |
| `npm run check:palette`     | Checks the widget hues, their distance from the danger red, and that no raw colour class slipped in |
| `npm run check:private`     | Scans the tree for a second path to any secret the game hides, and fails on the first one           |
| `npm run check:tags`        | Checks the tag vocabulary, the two tag rule, and every entry that carries a word                    |
| `npm run check:cards`       | Checks the card record, the mode pools, and that no card names a good in its text                   |
| `npm run check:closed-test` | Refuses to bless a closed test unless the database it resolves is a local closed-test file          |
| `npm run report:bands`      | Prints every Ocean Gambit win rate band against its target, per role and per table size             |
| `npm run report:gates`      | Prints the plan's sixteen launch gates over the last three hundred voyages, with the ship decision  |
| `npm run report:cards`      | Prints each card's offer to pick conversion with the appearance count beside it                     |
| `npm run db:push`           | Creates or updates the SQLite tables to match the schema                                            |
| `npm run db:generate`       | Regenerates the database client after a schema change                                               |
| `npm run db:migrate`        | Creates a versioned migration instead of pushing straight to the file                               |
| `npm run db:reset`          | Drops the database and rebuilds it from scratch                                                     |

For a production run, the order is `npm install`, `npm run db:push`, `npm run build`, then `npm start`.

The smoke test needs a server that is already running. To check a production build instead of a development one:

```bash
npm run build
npm start
# in a second terminal
npm run test:smoke
```

Point it elsewhere with `SMOKE_BASE_URL`, which is how it checks a server that is not sitting on 8080.

The telemetry checks inside it read the records a voyage leaves behind, so a server under test has to be recording them. That is the default, and a server started with `TELEMETRY_SAMPLE_RATE=0` is refused with a sentence saying so rather than passing green over a database nothing was written to.

## The rules

### The shape of a round

Every round walks the same six gates, opening at the harbor, and every captain in the harbor goes through them together. The one thing the voyage you sail changes is where the Parley sits against the Orders board: Classic trades at the table before the manifest is filled, Ocean Gambit fills the manifest first, and the rail across the top of the board always shows the order.

| Gate    | What happens                                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Dawn    | Draw from a fresh pool of boons that bend the rules for the coming round                                                       |
| Market  | Buy raw materials from the port market, and hire artisans and set what each of them crafts                                     |
| Parley  | Trade goods and Gold with the other captains on the Captain's Exchange, which is open to every captain from their first voyage |
| Orders  | Fill trade orders for Gold and Reputation                                                                                      |
| Resolve | Production lands, pirates may find you, then wages and maintenance come due                                                    |
| Dusk    | Upgrade the ship, draft and rig modules                                                                                        |

### Difficulty tiers

The host picks a tier when creating the harbor. It sets how long the voyage runs, how much of the content opens up, and how hard the sea pushes back.

| Tier           | Rounds | Starting Gold | Maintenance | The feel of it                                 |
| -------------- | ------ | ------------- | ----------- | ---------------------------------------------- |
| Fair Winds     | 8      | 100           | 15          | A gentle passage for new captains              |
| Open Waters    | 12     | 100           | 18          | The full trade opens as the harbor grows busy  |
| Monsoon Season | 16     | 90            | 22          | A long, adversarial haul for seasoned captains |

Fair Winds is calibrated to play exactly like the game did before difficulty tiers existed, so it is the right place to learn.

### Great Houses

A captain may pledge to one House. The pledge is account level, so it carries across every voyage, and it can be changed between them.

| House          | Motto                            | What it stands for         |
| -------------- | -------------------------------- | -------------------------- |
| Jade Pavilion  | Patience polishes the stone.     | The artisan economy        |
| Vermilion Gate | The gate is open to every cargo. | The market and cargo trade |
| Golden Lotus   | Fortune favours the bold wager.  | The wager economy          |

A pledge is a second identity alongside Renown. Renown measures how long you have sailed; a House says what kind of captain you are while you do it. Every pledge also feeds a harbor wide House standing, so the three Houses compete on crowns, voyages and best Reputation, and the standings board in the lobby ranks them.

Each House carries one small passive perk, applied when a fresh voyage starts and never partway through one. Jade Pavilion's first artisan joins at no cost. Vermilion Gate adds one more cargo lot to the Port Purchase board every round. Golden Lotus pays a fifth less in wages against a raid chance five percent higher. None of the three touches a number that compounds, which is what keeps a pledge a flavour rather than a power pick, and a captain can change House between voyages.

### Bartering between captains

Captains trade goods and Gold directly, on two surfaces that share one board. An offer can be open to the whole harbor or aimed at one named captain, and it is real room state rather than a message, so the goods behind it are escrowed the moment it is posted and come back to the poster if it is withdrawn or swept.

The Captain's Exchange is the first surface, and it stands open for the whole Bartering phase of every round, to every captain aboard, from their first voyage. The harbor chat carries the second one, which is where flexible bartering lives, and that is the surface that is earned rather than given.

Flexible bartering opens at Renown level 10. Both captains have to be at that level, because a trade is only ever as good as what the other side can put up, and the allowance is one completed trade a voyage. At level 15 it becomes two. Posting is free and unlimited while any of the allowance is left, so a captain can advertise the same intent on the shared board and in a private thread at once and take whichever answer arrives first. Only a completed trade spends anything.

Accepting is never rationed, on either surface. A captain can take as many offers from other captains as they like, no matter how much of their own flexible allowance has gone, and no matter which surface the offer came from.

A completed flexible trade retires every other flexible offer its own poster still had standing, on the shared board and in every private thread, because those share the one allowance and the rest could only ever be accepted into a refusal. The captain who took it keeps every offer of their own, and so does everyone else in the harbor, because none of those is rationed. Nobody loses anything to that: an offer that leaves the board hands its escrow back the same way a withdrawn one does. The board is also swept at each phase boundary, so an offer that nobody took during its stretch of the round returns its goods rather than waiting for a later one.

Because a trade can land at any point in a round, and every phase reads the hold and the purse as they are rather than as they were when the phase opened, a shelf that was out of reach a moment ago can be affordable before the phase ends. Nothing has to be restarted for that to take effect.

### Winning and losing

Reputation decides the voyage. Gold buys you the means, but Reputation is the score.

A captain goes bankrupt when the round's bills cannot be covered. On a Classic voyage that ends the voyage for them while the rest of the harbor sails on; on an Ocean Gambit voyage no seat ever leaves the table, so the harbor marks it against the captain and they sail on with their card, their vote and their say. The final Reputation then becomes Renown XP, multiplied by the difficulty tier, which levels the account up over many voyages.

### Sealed voyages

One voyage on the create form is sealed. Ocean Gambit, where the trade orders are committed before the social window opens, is not offered to a host who walks up to it cold: the harbor asks for a phrase before it will open that table, and a host who does not have it can still charter anything else.

The phrase is seeded in the world rather than printed on the form, and there are three places it turns up. A captain's tenth completed voyage writes it into the chronicle of that voyage, which the game hands them directly. The How to Play guide keeps a copy on its last page for whoever goes looking. And this page keeps one too, because a captain who was told about the door by a friend has to be able to find the key:

    the second ledger

It is a room setting rather than an account one, and that is the design rather than a shortcut. Whoever has the phrase can open the table for everybody who sits down at it, the harbor remembers which door it was opened through and says so on the room card, and nothing is spent or rationed by using it. A phrase that opened one harbor opens the next one too.

## What is in the game

**The harbor and the room.** Public and private harbors, a six character join code, a live roster, a ready check that keeps the whole crew in step, and a host who controls the difficulty and the restart.

**The market.** A per captain, per round draw of goods and prices, shaped by what the whole harbor has been buying. Goods the room leans into get dearer, goods nobody touches soften.

**Trading between captains.** Open barter offers on a shared board, direct offers aimed at one named captain, and an escrow that holds the offered goods the moment an offer is posted. The Captain's Exchange is open to every captain at any Renown level, and the flexible surface in the harbor chat opens at level 10 and widens at level 15. The terms are under Bartering between captains above.

**Money between captains.** Financial aid requests, loans between captains, and a third captain who can back a loan as a safety net.

**Convoy ventures.** A captain posts a target and a deadline; the harbor contributes toward it; everyone who took part is paid out when it lands.

**Artisans.** Weavers, potters, coppersmiths and more, each assigned to craft a product that lands at Resolve. Wages come due every round whether they worked or not, and a crew that goes unpaid takes a bankruptcy.

**Trade orders and mandates.** Raw material orders for steady money, finished product orders for real Reputation, and an Emperor's Mandate that every captain in the harbor is chasing at once.

**Pirates and escorts.** The settlement step can cost you every coin on hand. An escort is hired for a cut of your current Gold and guarantees safe passage.

**The shipyard.** Ship levels that open module slots and cut transport costs, plus modules such as the Smuggler's Hold, the Broker's Network and the Salvage Crane.

**The long game.** Captain's Legacy and Renown levels with titles, nine Captain's Merits, a daily check in on a seven day cycle that never punishes a missed day, voyage chronicles written in prose at the end of a run, head to head rivalries, and a harbor wide leaderboard.

**Live harbor life.** Presence, room chat, direct messages, a fleet ticker, tidewatch surge alerts, and Word on the Docks.

**A guide while you play.** The How to Play screen walks a new captain through the whole voyage, and glossary terms throughout the interface can be hovered for a plain explanation.

Solo practice is built in as well. A captain can set sail alone, which is the easiest way to learn a tier before playing it against other people.

**Quick Start.** A captain who just wants to play, without rounding up a room code, presses one button and is seated in the first open public harbor with a free seat. If there is none, the game opens a fresh one and makes them the host.

**Seeing the captains you sail with.** A captain at Renown level 5 or above sees the detail of any captain at level 3 or above: what is in their hold and roughly how much Gold they carry. Below either level, only the headline numbers show. Holds are shown as a band rather than an exact count, so a partner can tell a few from a haul without reading your ledger.

**Standing orders.** A captain who has to step away can write down what their seat should do when a phase's clock runs out without them: which boon to take at the draft, the most they will pay for each good on the market board, whether to fill the trade board's orders their hold already covers, and whether to buy the next hull at the shipyard. The set is kept with the voyage and the table does not see it, and every seat an order plays signs the ledger once, so a captain who comes back can read what happened while they were gone. The switch turns the whole thing off without erasing a word of it, and a voyage whose captain never opens the form sails exactly the way it did before the form existed.

**The voyage log.** Dusk shows a captain what happened while they were not looking, in two columns. The left one is the harbor's own log, written by the server and read by everyone in the room: the voyage leaving the dock, each seat the harbor weighs anchor for, offers posted, filled and lapsed, seats the tide ran out on, and captains who left the harbor. The right one is what was addressed to this captain alone, which is where the dealt alignment card arrives and where anything else the table is hiding will land. The log is kept for as long as the voyage is, so a captain who reloads mid voyage can be handed the legs they missed, and it is bounded, so a twelve leg voyage never grows a screen without a ceiling.

## The 2.2 build and the one before it

This is PortMasters 2.2 Parallel Release, a build of its own rather than a patched copy of the one before it. That earlier build is [PortMasters 2 Parallel Release](https://github.com/LostInHustle/PortMasters2-Parallel-Release), which is where the multiplayer game as it exists today was designed. If you have sailed that one, nothing you learned there is wrong here.

Every system of the earlier build is still here and still working the same way, and six more are built on top of it. The release notes open with the side by side table of the two builds, from the shipped harbor systems to the measured module counts, and state the rule those counts are re-measured under whenever a pass adds or removes a file.

The interface and the realtime layer were both rebuilt around the new systems, and the process now reads its configuration once at boot and tells you what it did not like rather than starting anyway.

[The release notes](docs/RELEASE_NOTES.md) walk through each of the six new systems, what came across unchanged, what was repaired, and the few things that are designed and visible but not yet switched on.

## Configuration

The server reads six environment variables. Five of them configure the process at boot, and the sixth gates the operator account.

| Variable                | Value in `.env.example` | What it does                                                                                               |
| ----------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | `file:../db/custom.db`  | The SQLite file holding every account, harbor and voyage. The path is relative to `prisma/schema.prisma`   |
| `PORT`                  | `8080`                  | The port the whole game answers on                                                                         |
| `HOST`                  | `0.0.0.0`               | The address to bind. Use `127.0.0.1` to keep the game on this machine only                                 |
| `ADMIN_SETUP_CODE`      | a placeholder           | The one code that admits an operator account through `/admin`. Empty refuses every attempt                 |
| `TELEMETRY_SAMPLE_RATE` | `1`                     | The share of voyages recorded for balance analysis, as a fraction of one. `1` is every voyage, `0` is none |
| `PHASE_CLOCK`           | `0`                     | A multiplier on the length of every phase of a round, from `0` to `10`. `0`, or `off`, turns the clock off |

`DATABASE_URL` has no fallback and the server will not start without it, so copy `.env.example` to `.env` before the first run. The operator code fails closed, so an installation that never sets a real one has no way in at all, which is the safe direction for that particular door.

`TELEMETRY_SAMPLE_RATE` is the one setting a live game reads without any captain noticing. A voyage that ends leaves one row describing what happened in it, which is where any later reading of the numbers is taken from, and this is the share of voyages that leave one. It is a fraction of one, so `0.25` records a quarter of them, and the decision is drawn once per voyage and held for its whole life rather than made per event, so a recorded voyage is recorded from its first leg to its last. Leave it unset and every voyage is recorded, which is the default because a game this size has no volume problem yet. Nothing in a voyage waits on that write, and no rule of the game reads a record back, so turning it down or off changes what the harbor remembers and never how it plays.

`PHASE_CLOCK` is the one setting that changes how a table feels rather than what it remembers. A phase of a round is a stretch of real time, and each one has a length the game was designed with: a boon draft is twenty five seconds, the market and the parley are three minutes each, orders are two, resolve is ninety seconds and dusk is a minute. This multiplies all six at once, so `2` gives every harbor twice the time in every phase and `0.5` gives it half, and the lengths themselves stay where they belong, which is on the phase's own record in the code. `0`, or the word `off`, is the clock switched off: no phase ends on its own, and every phase ends only when every captain has readied, which is how the game played before the clock existed. Nothing durable is written differently either way, because a deadline is published to the table as it runs and never stored, so this can be changed and changed back without a migration. Leave it unset for `0`, which is the clock off: a seat that ends because a timer says so is a pressure rather than a convenience, so it is asked for rather than assumed, and it is asked for on the mode that wants it, which is Ocean Gambit. The founding mode keeps no clock at all whatever this is set to.

An environment variable that is already set always wins over the file, which is the order a hosting platform expects. Point `ENV_FILE` at a different file to read from that one instead, which is how two servers run side by side from a single checkout without editing anything back and forth.

Twelve further variables are documented in `.env.example` under their own heading, and none of them is a setting of the server the way the six above are. Each is the rollback for one system of Ocean Gambit, the experimental voyage this branch is building toward, and each is read as two questions in a fixed order: whether the room is a Gambit room, and then what the file says. The mode is asked first, so a switch can only ever take a system away from the mode it belongs to and never hand it to Classic, which is the shipped release kept exactly as it was. That boundary is also why they are not in the table above: they are not knobs on the game, they are the way one mode of it is taken apart, and a Classic harbor plays the game this branch forked from whatever any of them says.

`next.config.ts` reads two more, and only while the development server is running, because they decide which hostnames may load development resources: the compiled chunks under `/_next`, the hot reload channel, and the internal endpoints. Next.js allows `localhost` on its own. `ALLOWED_DEV_ORIGINS` adds any other hostname as a comma separated list, and `RAILWAY_PUBLIC_DOMAIN` is read as well, which the host injects with the hostname the running service answers on. A production build reads neither.

The port is validated at boot. If `PORT` is not a whole number between 1 and 65535, the server stops and tells you which variable it did not like, rather than starting and behaving strangely. A missing `DATABASE_URL` stops the server in the same way.

## Reaching the game from another device

The game binds to `0.0.0.0` by default, so another device on the same network can reach it at `http://<your machine name>:8080`. Because the site, the API and the realtime channel all share that one port, a single tunnel is enough to put the whole game online:

```bash
ngrok http 8080
```

## Putting the game online on Railway

`railway.json` in the project root is the whole host configuration. Point Railway at this repository and it builds and runs from that file, with nothing to set in the dashboard beyond the two steps below.

### Why it runs the development server

`next build` wants more memory to finish than the plan provides, and a build that gets killed halfway is a deploy that never lands, so the file skips the build step entirely. `buildCommand` installs the dependencies including the development ones and generates the database client, and `startCommand` brings the schema up to date and runs `server.ts` with `NODE_ENV=development`.

The trade is real and worth making with your eyes open. The development server compiles each route the first time somebody asks for it, so the first visit to a screen is slow, and the browser downloads a development bundle rather than a built one. In exchange the deploy is one that fits in the memory the plan gives you.

### Two things the file cannot do for you

Both are dashboard clicks, and the first one is not optional.

**Add a volume mounted at `/app/db`.** A container's filesystem is thrown away on every deploy and every restart, so without a volume the database goes with it, and every account goes with the database. The mount path is not arbitrary: `DATABASE_URL` resolves to `db/custom.db` in the project root and `/app` is the project root inside the container. `requiredMountPath` in `railway.json` makes the deploy refuse to start when the volume is missing, so a forgotten volume is a failed deploy rather than a silent loss of every captain. Mount the volume somewhere else and set `DATABASE_URL` yourself to match.

**Set `RAILPACK_PRUNE_DEPS` to `false` as a service variable.** The builder strips development dependencies out of the image by default, and a development server needs them: the TypeScript compiler, Tailwind and the `tsx` that starts the process all live in that half of the manifest. `railway.json` has no way to declare a variable, so this one has to be set on the service itself. The symptom of skipping it is a deploy whose build succeeds and whose start command cannot find `tsx`.

### What the file already handles

`PORT` is injected by Railway and read by the server, and `HOST` defaults to `0.0.0.0`, which is what a container needs. Railway injects `RAILWAY_PUBLIC_DOMAIN` with the hostname the service answers on, and `next.config.ts` reads it so the browser is allowed to load the development resources, which it otherwise would not be. `DATABASE_URL` falls back to the documented default when the service does not set one. `ADMIN_SETUP_CODE` is yours to set if you want an operator account.

The healthcheck is `/api/health`. It answers from the process and reads nothing else, so a database that is briefly busy does not fail the probe and turn a slow query into a restart loop. Railway waits for a 200 on it before it promotes a deploy.

### One date to know

Railway is retiring config as code. `railway.json` keeps working until December 1, 2026, after which the same settings move to the dashboard or to the newer infrastructure as code format. The file is not wrong, it is expiring.

## How the project is put together

One process. One port. One npm project.

`server.ts` builds a single Node HTTP server and hands it to two things. Next.js answers the page and every route under `/api`. The realtime layer in `src/server/realtime` mounts Socket.IO on `/socket.io` of that very same server.

Because both live on one listener, the browser fetches the site, calls the API and opens its socket on one origin. There is no gateway in front, no second port to forward, and no proxy configuration to keep in step. The realtime layer rewrites the server's request listener when it attaches and forwards anything that is not `/socket.io` straight back to Next.js.

The shared HTTP surface is deliberately narrow. Cross origin socket access is switched off, because every browser loads the client from this same origin and nothing else needs a grant.

### Where things live

| Path                         | What is in it                                                               |
| ---------------------------- | --------------------------------------------------------------------------- |
| `server.ts`                  | The process entry point: Next.js and Socket.IO on one server                |
| `src/app`                    | The page and every REST route under `/api`                                  |
| `src/components/portmasters` | The game interface: the lobby, the room, every phase screen and every modal |
| `src/lib/game`               | The rules engine. Pure functions with no React, no database and no sockets  |
| `src/lib/game/engine`        | The per system rules, from market and orders to houses and the ages         |
| `src/lib`                    | The client hooks, the REST helpers and the session and realtime plumbing    |
| `src/server`                 | The realtime layer and the environment bootstrap                            |
| `prisma`                     | The database schema                                                         |
| `scripts`                    | The end to end smoke test                                                   |
| `docs`                       | The release notes for 2.2 plus the design notes and the analysis            |
| `next.config.ts`             | The Next.js settings, including which hosts may load development resources  |
| `railway.json`               | The host configuration: build, start, healthcheck and the volume guard      |

### The rules engine is separate on purpose

Everything under `src/lib/game` is plain functions over plain data. That is what makes a voyage reproducible: given the same seed and the same inputs, the engine produces the same result on every machine. It is also why the engine can be reasoned about, and tested, without starting a server or a database.

The database holds the durable things: accounts, sessions, harbors, memberships, saved game states, loans, ventures, messages, chronicles and legacy. The transient things, such as the ready check, open barter offers, aid requests and convoy tallies, live in the realtime layer's memory for as long as the process is up.

### One behaviour worth knowing

On boot, the realtime layer reconciles room membership. A seat belongs to a live connection, so every captain who is not currently connected is scheduled to leave, and the room is left holding only the people actually there. That keeps a harbor from waiting forever on somebody whose tab closed weeks ago.

The room itself survives the restart, along with the voyage saved inside it. Starting the server drops the seats that went cold and keeps the harbor, so a room you made is still listed the next time you launch the game. One consequence is worth knowing: a harbor whose entire crew has gone home can be walked into and taken over by whoever finds it, because there is no voyage in progress to interrupt. That is what stops a kept room from turning into one nobody can ever open again.

## Troubleshooting

**The page will not load and the terminal says the port is in use.** Something else already holds 8080. Stop that, or start this on another port with `PORT=8090 npm run dev` and open that port instead.

**Every request fails with a database error.** The tables have not been created yet. Run `npm run db:push`.

**The server stops at boot and names a variable.** That is the configuration check doing its job. The message lists every problem it found, so you can fix them all in one pass. Compare your `.env` against `.env.example`.

**Changes to a component do not appear.** Hot reload covers everything under `src`, which is the whole application. It does not cover `server.ts` itself, because changing that file changes the process rather than the page. Stop the server and start it again after editing it.

**The page loads but pieces of it are missing, and the browser console mentions a blocked cross origin request.** The development server serves its compiled chunks, its hot reload channel and its internal endpoints only to hostnames it recognises, and it recognises `localhost` and `127.0.0.1` on its own. Any other hostname, such as a custom domain pointed at a hosted deployment, belongs in `ALLOWED_DEV_ORIGINS`. A Railway service reads its own hostname without being told.

**The realtime channel will not connect behind a proxy.** The client asks for `/socket.io` on the same origin it was served from. A reverse proxy in front of the app has to allow WebSocket upgrades on that path, not just plain HTTP.

## Requirements

Node.js 20.19 or newer. The project is an npm project throughout. Its manifest and its lockfile are the only dependency files, and every script is a plain npm script.
