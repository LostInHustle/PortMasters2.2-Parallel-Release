# PortMasters 2.2 Parallel Release: Development Guide

This file began as the step by step build plan for the project, and that plan has been carried out. Rather than leave a completed checklist behind, it is kept as the guide to changing the code now that it exists: where each kind of change belongs, and which rules are load bearing enough that breaking them will cost you a voyage rather than a build.

## How the code is layered

Four layers, and a change should belong to exactly one of them.

| Layer            | Lives in                                                 | May depend on                                      |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------- |
| Rules engine     | `src/lib/game`                                           | Nothing. No React, no Prisma, no sockets           |
| Shared contracts | `src/types`, `src/lib/game/checkpoint.ts`                | Nothing at runtime. Types and constants only       |
| Server           | `src/server`, `src/app/api`, `server.ts`                 | The engine, the shared contracts, Prisma           |
| Interface        | `src/components`, `src/lib/use-*.ts`, `src/app/page.tsx` | The engine, the shared contracts, the REST helpers |

The engine is deliberately the bottom layer. Everything above it may call it; it may call nothing. That is what keeps a voyage reproducible: the same seed and the same inputs produce the same result on every machine, with no database and no server in the picture.

## Adding a game system

1. **Decide what is durable and what is transient.** If the state must survive a restart, it belongs in a table. If it only matters while the harbor is open, it belongs in the realtime layer's memory.
2. **Write the rules as pure functions** in `src/lib/game` or `src/lib/game/engine`. Take plain data in, return plain data out. No clock reads, no randomness except through the seeded generator.
3. **Add the table** to `prisma/schema.prisma` if you needed one, then run `npm run db:push`.
4. **Expose it.** A REST route under `src/app/api` for anything a page loads or saves. A socket event in `src/server/realtime` for anything that must reach the other captains immediately.
5. **Share the wire shape.** Put it in `src/types/realtime.ts` so the client and the server are described by one definition rather than two that drift.
6. **Write the hook** in `src/lib` and then the interface on top of it.

## Rules that must not be broken

**The engine stays pure.** No `Date.now()`, no `Math.random()`, no `fetch`, no database handle anywhere under `src/lib/game`. Randomness goes through the seeded generator so a voyage replays identically.

**The phase order is single sourced.** `CHECKPOINT_PHASE_ORDER` in `src/lib/game/checkpoint.ts` is the one definition of the synchronized order, and both the ready check and the interface read it from there. A second copy will drift.

**Every read of saved state is defensive.** A game state is JSON that a previous version of the game wrote. Read fields through the normalize helpers so a voyage saved before a field existed costs a captain that field, not the whole voyage.

**The ready check gates the room, not the captain.** Nobody advances a phase until every captain still active has readied. Any new phase has to register with the checkpoint protocol or the harbor will wait forever.

**The Ledger Integrity Pass runs on load.** It is what makes a hand edited save visible instead of silently rewarded. A new persisted field that the pass does not know about should be added to it rather than skipped.

**One venture per voyage per room.** The convoy rule is room wide on purpose, and the check belongs on the server so two captains cannot both claim the same voyage.

## Changing the interface

The visual language lives in `src/app/globals.css`, in the `pm-` utility classes and the `@theme inline` block. Colours, gradients, glass panels, textures and truncation are all defined there once. A component that reaches past those for a raw hex value or a hand measured pixel size is how the palette drifts.

Two habits worth keeping:

**Give text room to be long.** A captain's display name, a room name and a chronicle line are all user supplied and can be any length. Wrap them in `pm-truncate` where the container is fixed, and give flex children `min-w-0` so they are allowed to shrink rather than pushing the layout wide.

**Keep decoration below content.** A background texture is an absolutely positioned layer, so it needs the content beside it marked `relative` to stack above, and it needs `pointer-events-none` so it does not swallow clicks meant for the buttons underneath.

## Verifying a change

```bash
npm run typecheck   # every type error, including the ones a build would skip
npm run lint
npm run build       # type errors fail the build on purpose
npm run dev         # then, in a second terminal:
npm run test:smoke
```

The smoke test drives a real voyage through a running server: two captains register, one opens a harbor, the other joins it, both open a socket and authenticate, and the presence channel is checked. It cleans up the accounts it creates. If it is pointed at a different database than the server it is testing, it stops and says so rather than pretending the cleanup worked.

## Deploying

`railway.json` is the host configuration, and it is the only place a deploy setting belongs. A change to how the service builds, starts or is probed goes in that file rather than in a dashboard somebody has to remember to click.

Four things about it are load bearing, and each one is easy to undo by accident.

**The host runs the development server.** `next build` wants more memory than the smaller plans provide, so the file starts `server.ts` with `NODE_ENV=development` instead. Anything that only works in a production build will not be exercised by a deploy, and first visits are slow because routes compile on demand. Both are accepted costs rather than oversights.

**The database lives on a mounted volume at `/app/db`.** The container filesystem is discarded between deploys, so `DATABASE_URL` resolves to that mount. `requiredMountPath` in the file makes the deploy refuse to start without it, which is what turns a forgotten volume into a failed deploy instead of a silent loss of every account.

**Schema changes ship with the code.** The start command runs `prisma db push --skip-generate` before it starts the process, which is deliberate: a volume is attached when the container starts, not when it builds, so a step running before the deploy would have nowhere to write. A migration added to the repository will not be applied by this path.

**The healthcheck stays dependency free.** `/api/health` answers from the process and touches nothing else, so a database that is briefly busy cannot fail the probe and turn a slow query into a restart loop. Anything added to that route should keep it that way.

One more, for a new hostname: the development server serves its compiled chunks, its hot reload channel and its internal endpoints only to hostnames it recognises, and it recognises `localhost` on its own. A custom domain goes in `ALLOWED_DEV_ORIGINS`. `railway.json` cannot declare it, because the file has no variables section, so that one is set on the service itself, as is `RAILPACK_PRUNE_DEPS=false`, which keeps the development dependencies in the image.

## Testing more than the smoke test covers

The smoke test proves the wiring. It does not prove the rules, and the rules are where a subtle mistake is most expensive, because a broken voyage is only discovered eight rounds in.

For engine changes, the fastest honest check is a throwaway script that runs the pure functions directly, run with `npx tsx` from the project root. It needs no server and no database, because the engine takes plain data. Anything under `scripts` is picked up by the type checker, so a scratch script that stops compiling will tell you so.
