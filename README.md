# PortMasters 2: Lords of the Silk Road (2.2 Parallel Release)

A browser based multiplayer trading game set on the maritime Silk Road.

Captains gather in a shared harbor. Once at least two of them are seated, the host sets sail, and from that moment everyone plays the same voyage together. Each round opens with a boon draft, then buying at port, then trading with the other captains, then putting artisans to work, then filling trade orders, then settling wages and pirate raids, then refitting at the shipyard. Nobody moves to the next step until every captain still sailing has readied up. Whoever ends the voyage with the highest Reputation is crowned Sea Master.

Everything runs as a single npm project on a single port.

## Quick start

You need Node.js 20.19 or newer. Nothing else, and in particular no Bun and no separate backend.

```bash
# 1. Install the dependencies and generate the database client
npm install

# 2. Create the database tables (safe to run again, it only adds what is missing)
npm run db:push

# 3. Start the whole game at http://localhost:8080
npm run dev
```

Open http://localhost:8080, register a captain, and look around.

To try the multiplayer side, open a second browser or a private window rather than a second tab. Tabs in the same browser share one cookie jar and therefore one signed in captain.

Two things surprise people at first. The port is 8080, not 3000. And there is no separate backend to start: the site, the REST API and the realtime channel are one process.

## What each command does

| Command               | What it does                                                          |
| --------------------- | --------------------------------------------------------------------- |
| `npm run dev`         | Starts the game in development mode on port 8080, with hot reload     |
| `npm run build`       | Generates the database client and produces a production build         |
| `npm start`           | Runs the production build on port 8080                                |
| `npm run typecheck`   | Checks every TypeScript file and reports type errors                  |
| `npm run lint`        | Runs ESLint across the project                                        |
| `npm run test:smoke`  | Drives a real voyage through a running server and checks it arrived   |
| `npm run db:push`     | Creates or updates the SQLite tables to match the schema              |
| `npm run db:generate` | Regenerates the database client after a schema change                 |
| `npm run db:migrate`  | Creates a versioned migration instead of pushing straight to the file |
| `npm run db:reset`    | Drops the database and rebuilds it from scratch                       |

For a production run, the order is `npm install`, `npm run db:push`, `npm run build`, then `npm start`.

The smoke test needs a server that is already running. To check a production build instead of a development one:

```bash
npm run build
npm start
# in a second terminal
npm run test:smoke
```

## The rules

### The shape of a round

Every round runs the same seven steps, and every captain in the harbor goes through them together.

| Step                | What happens                                                             |
| ------------------- | ------------------------------------------------------------------------ |
| Boon draft          | Draw from a fresh pool of boons that bend the rules for the coming round |
| Phase 1: Purchase   | Buy raw materials from the port market                                   |
| Barter              | Trade goods and Gold directly with the other captains                    |
| Artisan management  | Hire artisans and assign what each of them crafts                        |
| Phase 2: Orders     | Fill trade orders for Gold and Reputation                                |
| Phase 3: Settlement | Production lands, wages and maintenance come due, pirates may find you   |
| Phase 4: Shipyard   | Upgrade the ship, draft and rig modules                                  |

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

Each House was designed with one small passive perk: a free first artisan, an extra hold and an extra purchase card, and cheaper wages against a higher pirate risk. Those three perks are written into the engine and shown on the House picker, but they are not applied when a voyage starts yet, so a pledge currently changes who you sail as rather than what you can do.

### Winning and losing

Reputation decides the voyage. Gold buys you the means, but Reputation is the score.

A captain goes bankrupt when the bills at Settlement cannot be covered. That ends the voyage for them but not for the harbor, and the rest of the crew sails on. The final Reputation then becomes Renown XP, multiplied by the difficulty tier, which levels the account up over many voyages.

## What is in the game

**The harbor and the room.** Public and private harbors, a six character join code, a live roster, a ready check that keeps the whole crew in step, and a host who controls the difficulty and the restart.

**The market.** A per captain, per round draw of goods and prices, shaped by what the whole harbor has been buying. Goods the room leans into get dearer, goods nobody touches soften.

**Trading between captains.** Open barter offers on a shared board, direct offers aimed at one named captain, and an escrow that holds the offered goods the moment an offer is posted.

**Money between captains.** Financial aid requests, loans between captains, and a third captain who can back a loan as a safety net.

**Convoy ventures.** A captain posts a target and a deadline; the harbor contributes toward it; everyone who took part is paid out when it lands.

**Artisans.** Weavers, potters, coppersmiths and more, each assigned to craft a product. Production takes a round to arrive, and an unpaid artisan strikes.

**Trade orders and mandates.** Raw material orders for steady money, finished product orders for real Reputation, and an Emperor's Mandate that every captain in the harbor is chasing at once.

**Pirates and escorts.** The settlement step can cost you every coin on hand. An escort costs a share of the cargo but sails you safely past.

**The shipyard.** Ship levels that open module slots and cut transport costs, plus modules such as the Smuggler's Hold, the Broker's Network and the Salvage Crane.

**The long game.** Captain's Legacy and Renown levels with titles, nine Captain's Merits, a daily check in on a seven day cycle that never punishes a missed day, voyage chronicles written in prose at the end of a run, head to head rivalries, and a harbor wide leaderboard.

**Live harbor life.** Presence, room chat, direct messages, a fleet ticker, tidewatch surge alerts, and Word on the Docks.

**A guide while you play.** The How to Play screen walks through all nine steps of a voyage, and glossary terms throughout the interface can be hovered for a plain explanation.

Solo practice is built in as well. A captain can set sail alone, which is the easiest way to learn a tier before playing it against other people.

**Quick Start.** A captain who just wants to play, without rounding up a room code, presses one button and is seated in the first open public harbor with a free seat. If there is none, the game opens a fresh one and makes them the host.

**Seeing the captains you sail with.** A captain at Renown level 5 or above sees the detail of any captain at level 3 or above: what is in their hold and roughly how much Gold they carry. Below either level, only the headline numbers show. Holds are shown as a band rather than an exact count, so a partner can tell a few from a haul without reading your ledger.

## The 2.2 build and the one before it

This is PortMasters 2.2 Parallel Release, a build of its own rather than a patched copy of the one before it. That earlier build is [PortMasters 2 Parallel Release](https://github.com/LostInHustle/PortMasters2-Parallel-Release), which is where the multiplayer game as it exists today was designed. If you have sailed that one, nothing you learned there is wrong here.

Every system of the earlier build is still here and still working the same way, and six more are built on top of it.

|                        | PortMasters 2 | PortMasters 2.2 |
| ---------------------- | ------------- | --------------- |
| Harbor systems shipped | 10 of 18      | 16 of 18        |
| Realtime layer         | one long file | 17 modules      |
| Interface components   | 29            | 41              |
| Database models        | 10            | 12              |
| The port it answers on | 2232          | 8080            |

The interface and the realtime layer were both rebuilt around the new systems, and the process now reads its configuration once at boot and tells you what it did not like rather than starting anyway.

[The release notes](docs/RELEASE_NOTES.md) walk through each of the six new systems, what came across unchanged, what was repaired, and the few things that are designed and visible but not yet switched on.

## Configuration

The server reads three environment variables. All of them have working defaults, so a fresh checkout runs without any setup at all.

| Variable       | Default                | What it does                                                                                             |
| -------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | `file:../db/custom.db` | The SQLite file holding every account, harbor and voyage. The path is relative to `prisma/schema.prisma` |
| `PORT`         | `8080`                 | The port the whole game answers on                                                                       |
| `HOST`         | `0.0.0.0`              | The address to bind. Use `127.0.0.1` to keep the game on this machine only                               |

Copy `.env.example` to `.env` if you want to change any of them. An environment variable that is already set always wins over the file, which is the order a hosting platform expects.

The port is validated at boot. If `PORT` is not a whole number between 1 and 65535, the server stops and tells you which variable it did not like, rather than starting and behaving strangely. A missing `DATABASE_URL` stops the server in the same way.

## Reaching the game from another device

The game binds to `0.0.0.0` by default, so another device on the same network can reach it at `http://<your machine name>:8080`. Because the site, the API and the realtime channel all share that one port, a single tunnel is enough to put the whole game online:

```bash
ngrok http 8080
```

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

**The realtime channel will not connect behind a proxy.** The client asks for `/socket.io` on the same origin it was served from. A reverse proxy in front of the app has to allow WebSocket upgrades on that path, not just plain HTTP.

## Requirements

Node.js 20.19 or newer. The project is an npm project throughout. Its manifest and its lockfile are the only dependency files, and every script is a plain npm script.
