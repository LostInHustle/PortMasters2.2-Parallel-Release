# PortMasters 2: Project Proposal

## Vision

Port the PortMasters 2.2 Parallel Release into the sandbox environment, conserve every piece of greatness from the original, finish the seven un built manifest systems, and dress the whole experience in a natural, modern, colourful East Asian aesthetic that breathes like morning fresh air over a maritime Silk Road harbor.

## Aesthetic Direction

The palette draws from East Asian art and the morning sea. Celadon green as the primary, the colour of the porcelain that gave the trade its name. Vermilion as the accent, the colour of the seal stamped on every manifest. Imperial gold as the warmth, the colour of the lacquer on a captain's chest. Indigo as the depth, the colour of the scholar's ink on a portolan chart. Rice paper cream as the canvas, the colour of the sail catching dawn light.

The atmosphere is morning fresh air. Soft gradients from dawn mist to open sky. Lots of breathing room. Subtle animations like dew sliding off a sail. Glassmorphic panels floating over a sea gradient canvas, evoking porcelain over water. Natural tone everywhere, with no en dashes, no em dashes, no hyphens, no double hyphens, and no unnatural AI sounding phrasing in any user facing text.

The typography keeps Geist for readability but pairs it with generous letter spacing on display headings to evoke brushwork without sacrificing legibility. Emoji continue to carry the cargo of meaning ( Hemp, Silk, Tea, the anchor, the compass) but sit inside softer, more organic containers.

## Architecture

One process, one port, one npm project. `server.ts` builds a single Node HTTP server and hands it to Next.js, which answers the page and every route under `/api`, and to the realtime layer in `src/server/realtime`, which mounts Socket.IO on `/socket.io` of that same server. The site, the API and the realtime channel therefore share one origin, and a single tunnel is enough to put the whole game online.

The realtime layer is a composition root over small modules: presence, checkpoint, barter, aid, loans, ventures, chat, conclusion, pulse, docks, surge, rival and quickstart. Between them they hold the transient room state, which is the checkpoint ready votes, the open barter offers, the aid requests, the outstanding loans, the convoy ventures, the harbor pulse tallies, the docks winners, the surge flags and the mute lists.

Durable state lives in the database instead: accounts, sessions, rooms, memberships, saved game states, loans, ventures, messages, chronicles and legacy. The two halves meet at that boundary. A module reads or writes the database through Prisma, and everything else it needs to know about the other captains arrives over a socket event.

An earlier revision of this project split the realtime layer into a second process behind a gateway, because the environment it was built in required that shape. That split is gone. It cost the in process sharing the design was built around and bought nothing, so the realtime layer is mounted on the application's own server again.

## What Is Conserved

The entire deterministic engine. The complete constants catalogue. The Prisma schema (adapted to the sandbox datasource). The API route shapes and validation. The auth flow with scrypt and session tokens. The ready check phase sync protocol. The Ledger Integrity Pass. The convoy, backing, harbor pulse, check in, legacy, and merits pure modules. The eight phase checkpoint cycle. The trust model. The first report wins arbitration. The shared helper reputation ceiling. The one venture per voyage room wide rule. The difficulty as single source of truth. The normalize on load defensive read pattern. The wholesale replace modifier flags. The `addOwnedAmount` single mutation path.

## What Is Refactored

The `realtime.ts` 3,097 line single function splits into modules: presence, checkpoint, barter, aid, loans, ventures, chat, conclusion, connection. The `PublicUser` and `CaptainStatus` types move to a shared `types/realtime.ts` with no runtime deps. The `CHECKPOINT_PHASE_ORDER` moves to a shared `game/checkpoint.ts`. The `api/route.ts` Hello World stub is deleted. The Welcome InfoCard numbers derive from `difficultyConfig` instead of hardcoding the founding trade. The Settlement Force Pay button gets a distinct destructive style. The Shipyard Back buttons call engine functions instead of mutating `g.phase` directly. The `fireWorker` uses `getHireCost`. The `merchantRatingForScore` moves to `constants.ts`. The `hireWorker` dead `names` map is deleted. The `escortHired` flag is documented as a UI signal. The `Worker.progress` field is removed. The `intelCost` becomes a derived value. The `modifierFlags` gets a `ModifierKey` union type. The `Worker.task` gets a branded `Product` type.

## What Is Built New

The seven un built manifest systems, in dependency order:

1. **Voyage Chronicle** (Manifest 12). A voyage becomes a short story a captain can read again later, not just a score. An opt in short recap at voyage conclusion (peak Reputation, largest trade, lend and borrow counts), viewable from the Lobby. Pure text template function fed by fields already computed at voyage conclusion. Needs a new `VoyageChronicle` table and a Lobby viewer.

2. **Quick Start Match** (Manifest 17). A solo captain gets dropped into an open harbor instead of having to go find one. An opt in queue button in the Lobby matches solo captains with an existing open public room or opens a fresh one. Needs a queue structure in the realtime server and a Lobby button.

3. **Captain's Rival** (Manifest 11). The friend you keep sailing against gets a scoreboard of their own. A per pair counter of how many times two specific captains finished a voyage in the same room and who out scored whom. A head to head line on the Captain's Legacy card, shown only when both are in the same room. Needs a `CaptainRival` table keyed on the sorted pair of user ids.

4. **Partial Sight** (Manifest 06). A trusted partner sees a blur, not a wall and not a full ledger. A trusted partner (same trust threshold as Backing) gets a banded range read of another captain's cargo during active play. Pure client side rounding. No new server trust boundary. Needs a trust threshold constant and a banding helper.

5. **Trading Houses** (Manifest 08). A second identity to argue about, separate from the Renown grind. Pledge to one of three houses, each with one small passive perk (free first artisan, extra cargo capacity, more pirate risk for cheaper wages) plus a separate House Standing counter. Needs a `houseId` field on `CaptainLegacy`, a `HouseStanding` aggregate, and a balance pass.

6. **House Rally** (Manifest 09). A room where friends share a pledge notices it. A majority same house room triggers a flavor banner and a bonus House Standing at voyage end. Needs a voyage end check on the room's house distribution.

7. **Ages of the Ledger** (Manifest 10). The three peer economy tools take turns in the spotlight. A rotating multi week emphasis: Age of the Lender (extra Renown for backing), Age of the Trader (sweeter barter), Age of the Broker (cheaper Broker's Favor). A plain interval check inside the realtime server's long lived process. No new scheduler needed.

The Bilingual Harbor (Manifest 15) stays dropped. It was built in full and then removed at the owner's request. It does not come back without a fresh owner decision.

**Status in the 2.2 build.** Six of the seven are in the game. Voyage Chronicle, Captain's Rival, Partial Sight and Quick Start Match shipped in full. Trading Houses and Ages of the Ledger shipped as identity, standings and display, with the per House perks and the per Age effects written into the engine but not yet read at voyage start, so neither currently changes what a captain can do. House Rally did not ship and is the one system still on the roadmap. The Bilingual Harbor stayed dropped.

## Database and boot behaviour

The Prisma schema drops the custom `output = "../generated/prisma"` path and the `@prisma/adapter-better-sqlite3` driver adapter, and uses the default `@prisma/client` from `node_modules`. The datasource is `url = env("DATABASE_URL")`, which the checked in `.env` points at `db/custom.db` in the project root.

`reconcileMembershipAfterBoot` arms a departure for every existing `RoomMember` on every process boot. A captain who does not reconnect within the grace period leaves, and a room whose last member departs is removed along with its per room state. This is the intended behaviour: it is what stops the lobby filling up with rooms nobody is sitting in. It does mean that starting the server clears out abandoned harbors, which is worth knowing before restarting with a room left open.

`hydrateLoans` and `reconcileMembershipAfterBoot` are both fire and forget. They log clearly when they fail rather than taking the server down with them.

## Success Criteria

The application loads at the sandbox preview URL. A captain can register, log in, create a room, and (in a second browser) join it. The host can start the voyage. Both captains play through a full round in lockstep. The ready check protocol advances the room. The deterministic engine produces identical markets for both captains. The barter board, the aid system, the backing system, and the convoy ventures all work end to end. The voyage concludes with Renown XP, Merits, and a Sea Master crown. The Captain's Legacy card persists across voyages. The daily check in works. The Ledger Integrity Pass flags a forged save. The aesthetic reads as natural, modern, colourful, and East Asian. No en dashes, em dashes, hyphens, or double hyphens appear in any user facing text. The seven new manifest systems are all reachable from the UI.

**Outcome in the 2.2 build.** Six of the seven are reachable from the interface. House Rally did not ship. The per House perks and the per Age effects are visible in the interface without being applied to play, which `docs/RELEASE_NOTES.md` names plainly.
