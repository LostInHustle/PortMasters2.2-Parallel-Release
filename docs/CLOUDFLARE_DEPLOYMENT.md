# PortMasters 2.2 Parallel Release: Cloudflare Deployment

This guide is for running the game on Cloudflare Containers. Railway remains the default host and the rollback path, and nothing here changes that deployment. This guide begins at the account gate, because the image and the configuration can both be ready while the account still cannot run them.

The game is one long lived Node process: `server.ts` puts Next.js, every `/api` route and Socket.IO on one listener, and Prisma reads a local SQLite file. A request scoped Worker cannot host that process. The deployment therefore runs the process unchanged inside one Cloudflare container and puts a thin Worker in front of it.

## What runs on Cloudflare

```
Browser
  |
  v
Worker                     cloudflare/worker.ts
  |
  v
Durable Object             GameContainer, one object named portmasters
  |
  v
Container on port 8080     server.ts: Next.js, /api, Socket.IO, Prisma
  |
  v
/app/db/custom.db  <->  Litestream  <->  R2 bucket
```

**One container, and only one.** `wrangler.jsonc` sets `max_instances: 1`, and the Durable Object name is fixed so every request reaches the same object. The game keeps harbor state in process memory, writes SQLite through a single writer, and has no Redis adapter. A second container would be a second game with a second database. Everything in this guide assumes the one container rule, and the way to serve more captains later is to move the harbor state into Durable Objects first, not to raise the limit.

**The container disk is not durable.** A container starts with an empty disk. Litestream restores `/app/db/custom.db` from the R2 bucket when the file is absent, runs the game as its child, and replicates the file while the game runs. The image keeps a snapshot a day and 30 days of history, so a mistake can be restored to a point in time rather than only to the latest state. This restore is the only thing standing between a container restart and an empty game, which is why it is proved before players arrive.

**The container sleeps when the harbor is empty.** `sleepAfter` is 15 minutes. An open harbor keeps its Socket.IO connection alive, and that heartbeat is what keeps the container awake. The first request after a sleep pays the cold start: several seconds for the process plus the time to restore the database. The Worker waits up to two minutes for the port and answers `503` with `retry-after: 15` if the wait runs out.

**The schema comes from the repository, not from the database.** The image carries `prisma/migrations`, and the entrypoint runs `prisma migrate deploy` after any restore and before the game opens the database. Never run `prisma db push` against this database. Litestream keeps `_litestream_seq` and `_litestream_lock` in the same file, and `db push` would read those tables as drift.

## Before you start

- **Workers Paid.** Containers are not on the free plan, and this is the hard gate. The plan is 5 dollars per month before usage. Confirm it under Workers and Pages in the dashboard: the plan line says Workers Paid, and the Containers section is available. Without it a deploy fails or the container application cannot be created.
- **Docker with buildx, running.** Wrangler builds the container image during deploy, and it builds `linux/amd64`.
- **Node 22.** The `cf:*` scripts run Wrangler, which requires Node 22. The game itself still accepts Node 20.19.
- **An R2 bucket and an API token.** R2 has a free tier that is enough for this database. The token is created in the dashboard, not by Wrangler.
- **This repository at the release tree, with `npm ci` already run.**

The local `.env` is for local development. It contains an operator setup code and must never be uploaded, pasted into a ticket, or reused for the deployment. Start the hosted game with a new setup code. The image excludes `.env` and the local `db/` directory through `.dockerignore`; keep it that way.

## Check the image locally

Build and run the same image Wrangler will build, on a port the development server does not use:

```bash
npm run lint
npm run check:prose
npm run cf:typecheck
npm run cf:image
```

The type check is a separate TypeScript project for the Worker; it does not scan the Next.js tree. The image build runs every repository gate and the production build inside the image, so it takes a few minutes and leaves the host `.next` alone.

```bash
docker run --rm --name portmasters-cf --platform linux/amd64 \
  -p 8081:8080 \
  -e LITESTREAM_ENABLED=0 \
  -e APP_URL=http://localhost:8081 \
  portmasters-cloudflare:local
```

`LITESTREAM_ENABLED=0` is the local test switch: there is no R2 bucket to reach, so the entrypoint runs the server directly. Replication is never off in the deployed game. In a second terminal:

```bash
curl -fsS http://localhost:8081/api/health
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:8081/
curl -fsS 'http://localhost:8081/socket.io/?EIO=4&transport=polling'
```

The first prints `{"status":"ok"}`. The second prints `200`. The third prints a Socket.IO session packet, a line beginning with `0{`, which is the handshake the realtime layer answers. Register a throwaway captain if you want the whole path, then stop the container with `docker rm -f portmasters-cf`; the `--rm` flag removes it.

`npm run cf:dev` runs the Worker itself in Wrangler's local mode. It builds a local image, exercises the Worker and the header rewrite, and creates nothing in the Cloudflare account. It needs a `.dev.vars` file with `LITESTREAM_ENABLED=0` and `APP_URL=http://localhost:8787`, because the vars in `wrangler.jsonc` deliberately fail closed. Local mode also ignores `max_instances: 1`, so it does not prove the one container rule.

Litestream itself cannot be exercised without R2. The restore proof in this guide is a paid deployment step, and it must run before any player data exists.

## Create the bucket and the token

```bash
npx wrangler login
npx wrangler whoami
npx wrangler r2 bucket create portmasters-db
```

`whoami` prints the account ID, and the bucket commands need that login. Then create the token in the dashboard, under R2, Manage R2 API Tokens:

1. Create an API token with Object Read and Write permission.
2. Restrict it to the one bucket, `portmasters-db`. Do not leave it account wide.
3. Give it a lifetime, and record the Access Key ID and the Secret Access Key when the token page shows them.

The endpoint is not on the token page; it is the account's S3 address, built from the account ID that `whoami` printed:

```
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

The Secret Access Key is shown only once. Put the key pair and the endpoint in a password manager, not in the repository, and not in `wrangler.jsonc`. The bucket must stay out of any cleanup routine and out of any lifecycle rule that deletes objects: it is the only durable copy of the database.

## The settings

Every name the deployment reads is set in exactly one place. Variables live in `wrangler.jsonc`; secrets are set with Wrangler and never written to a file.

| Setting                        | Set as        | Value                                            |
| ------------------------------ | ------------- | ------------------------------------------------ |
| `PHASE_CLOCK`                  | Wrangler var  | `0`, the documented default                      |
| `TELEMETRY_SAMPLE_RATE`        | Wrangler var  | `1`, the documented default                      |
| `LITESTREAM_ENABLED`           | Wrangler var  | `1`; `0` only for a local image test             |
| `LITESTREAM_BUCKET`            | Wrangler var  | the bucket name, `portmasters-db` in this guide  |
| `LITESTREAM_ENDPOINT`          | Wrangler var  | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`  |
| `APP_URL`                      | Wrangler var  | the public address, added after the first deploy |
| `ADMIN_SETUP_CODE`             | Worker secret | the operator setup code, a new one for this host |
| `LITESTREAM_ACCESS_KEY_ID`     | Worker secret | the R2 token's Access Key ID                     |
| `LITESTREAM_SECRET_ACCESS_KEY` | Worker secret | the R2 token's Secret Access Key                 |

Four more values are constants in `cloudflare/worker.ts` rather than settings: `NODE_ENV=production`, `PORT=8080`, `HOST=0.0.0.0` and `DATABASE_URL=file:/app/db/custom.db`. The twelve `NEXT_PUBLIC_*` switches are not Worker variables either. Next inlines them into the client bundle and the server reads them from the environment, so the Dockerfile sets all of them to `1` in both halves of the build. To ship one off, add an `image_vars` block to `wrangler.jsonc` and rebuild; the commented example in that file shows the shape.

The Worker fails closed on purpose. While replication is enabled, a missing or empty value among the four `LITESTREAM_*` settings stops the container from starting, and the Worker log names the missing setting without ever printing a value. The two empty R2 values in `wrangler.jsonc` are that gate, not a working default, so fill them before the first deploy.

Secrets are typed into `wrangler secret put` at a prompt. The value does not enter shell history and is not echoed. A running process keeps the environment it started with, so a rotated secret or changed var reaches the game only after the container restarts.

## First deploy

Fill the two R2 values in `wrangler.jsonc`:

```jsonc
"LITESTREAM_BUCKET": "portmasters-db",
"LITESTREAM_ENDPOINT": "https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
```

Then deploy:

```bash
npm run cf:deploy
```

Wrangler builds the `linux/amd64` image, uploads it, creates the Worker and provisions the container application. On a first deploy it may offer to register a `workers.dev` subdomain; accept, and copy the address it prints. Provisioning a new container application can take several minutes, and a request during that window may fail. The deploy itself does not start the container; the first request does.

Set the three secrets now that the Worker exists:

```bash
npx wrangler secret put ADMIN_SETUP_CODE
npx wrangler secret put LITESTREAM_ACCESS_KEY_ID
npx wrangler secret put LITESTREAM_SECRET_ACCESS_KEY
```

Use a new setup code for this host. Do not reuse the value from the local `.env`.

Add the public address to the same `vars` block:

```jsonc
"APP_URL": "https://portmasters2-2-parallel-release.<SUBDOMAIN>.workers.dev"
```

and deploy again. APP_URL is what link previews and metadata use, so it should be in place before the first visit rather than corrected later. The container has not started yet, so the first start reads this value and the three secrets together.

### Deploying from Git

Workers Builds is Cloudflare's Git integration. It installs the dependencies and then runs the commands under Settings, Build. Leave the build command empty (or set it to `true`) and set the deploy command to `npx wrangler deploy`; the Dockerfile is the build, and `wrangler deploy` runs it, including `npm run build` inside the image. Do not put `npm run build` or `prisma db push` in the build step. Workers Builds has no database and none of the Worker's variables or secrets, so `db push` reports `Environment variable not found: DATABASE_URL`, and the container applies the schema with migrations at start.

If the deploy step reports `The Docker CLI is needed to build the configured image before deploying but could not be launched`, that build environment cannot build the image. Run `npm run cf:deploy` from a machine with Docker instead; that is the path this guide verifies, and it can publish the first container image. A Workers Builds deploy with `--containers-rollout=none` updates Worker code without touching the container, which is only useful once an image already exists.

## The first visit checks

Wait for the container application to finish provisioning, then check each of these once:

1. `curl -fsS https://<address>/api/health` prints `{"status":"ok"}`. The route reads the process and touches no database, which is why the Worker uses it as the readiness check.
2. Open the address in a browser. The landing page loads, and no chunk request fails; this host serves a production build.
3. Register a captain and sign in. With developer tools open, the session cookie carries `Secure`, because the Worker forwards the request scheme as `https`.
4. Open a harbor in one browser, join it from a private window with a second captain, and ready up in both. Both see the same harbor and the same phase.
5. Play one action that saves, reload the page, and confirm the action is still there.
6. Open the bucket in the R2 dashboard. Objects appear under the `portmasters/custom.db` prefix within about a second of the first write.
7. Read the container logs for the first boot: Litestream starts replication with nothing to restore, the baseline migration applies, and the server starts. `npx wrangler tail` streams the Worker's own log, which reports a container configuration error; the container's output is in the dashboard.

If sign in fails, check the log for a missing setting first. If everything loads except the realtime layer, check that the browser reaches `/socket.io` through the same hostname; the Worker forwards the upgrade unchanged.

## Prove a restore before players arrive

A deployment is only as good as its restore. Prove it while the harbor is still empty, by making the container sleep sooner than 15 minutes:

1. In `cloudflare/worker.ts`, change `sleepAfter = "15m"` to `sleepAfter = "1m"`.
2. Run `npm run cf:deploy`. The rollout replaces the container, so this also exercises a fresh start.
3. Register or sign in, play one saved action, then close every tab and leave the address alone for at least two minutes.
4. Confirm the instance stopped. `npx wrangler containers list` prints the application ID, `npx wrangler containers instances <ID>` lists its instances, and the dashboard shows the same state.
5. Request the site again. The new container starts with an empty disk, restores from R2 before the migration runs, and serves the game.
6. Sign in. The account and the saved action must both still exist. The logs show the restore before the server starts.
7. Change `sleepAfter` back to `"15m"` and deploy again.

Every deploy starts a container with an empty disk, so a rollout is already a restore exercise, but this test isolates it. If the account is missing, stop here and read the recovery section; do not invite players.

## Custom domain

Add a route to `wrangler.jsonc` and point APP_URL at the same name:

```jsonc
"routes": [{ "pattern": "game.example.com", "custom_domain": true }],
"vars": {
  "APP_URL": "https://game.example.com"
}
```

The zone must be in the same Cloudflare account; Wrangler creates the DNS record for a custom domain route. Deploy, then check that sign in, Socket.IO and the health route all work on the new name.

Once the custom domain works, set `"workers_dev": false` and deploy. That leaves one canonical address, which matters because APP_URL, the session cookie and the R2 restore are all one game: two hostnames are two origins for the browser, and a link preview built for the wrong one is easy to miss.

## Rollback, restore and recovery

### Roll back a deploy

```bash
npx wrangler deployments list
npx wrangler rollback
```

`deployments list` prints the recent versions with their IDs. `rollback` with no argument returns to the previous version after asking; pass a version ID to choose an older one. A rollback reverts the Worker and the container image and does not change R2. It is not a database rollback: do not roll back across a destructive schema change without a restored copy, because the older image expects the older schema.

A deploy or a rollback restarts the single container. Active sockets drop and the in memory harbor state is lost, so schedule both between voyages. R2 protects the database, not a voyage in progress.

### Restore a copy for inspection

Install Litestream 0.5.17 on the workstation, for example with `brew install litestream`, so it matches the binary in the image. Export the five values the config needs. Type the two secrets at a prompt rather than into a command line:

```bash
export DATABASE_PATH=/app/db/custom.db
export LITESTREAM_BUCKET=portmasters-db
export LITESTREAM_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
read -rs LITESTREAM_ACCESS_KEY_ID; export LITESTREAM_ACCESS_KEY_ID
read -rs LITESTREAM_SECRET_ACCESS_KEY; export LITESTREAM_SECRET_ACCESS_KEY
```

The two `read` commands wait silently for a value and a newline. Paste each secret, press return, and it stays out of the shell history.

Restore to a copy:

```bash
litestream restore -config cloudflare/litestream.yml -o /tmp/custom.db /app/db/custom.db
sqlite3 /tmp/custom.db 'select count(*) from "User";'
```

The positional path must equal the config's `path` after expansion, which is why `DATABASE_PATH` is exported even though the copy goes to `/tmp`. Restoring reads the replica and is safe while the game runs, but let the container sleep first when you want a copy that is not moving. Never start a second writer against the same prefix: two processes appending to one replica corrupt it.

### Point in time recovery

Choose a timestamp in UTC, restore that moment, check it, and republish it under a new prefix:

```bash
litestream restore -config cloudflare/litestream.yml \
  -integrity-check quick \
  -timestamp '2026-10-25T12:00:00Z' \
  -o /tmp/custom.db /app/db/custom.db
sqlite3 /tmp/custom.db 'select count(*) from "User";'
```

Confirm the copy holds what you expect, then write a recovery config in `/tmp` that reads the copy and writes a new prefix:

```yaml
dbs:
  - path: /tmp/custom.db
    replica:
      type: s3
      bucket: portmasters-db
      path: portmasters/recovered-2026-10-26/custom.db
      endpoint: ${LITESTREAM_ENDPOINT}
      region: auto
      access-key-id: ${LITESTREAM_ACCESS_KEY_ID}
      secret-access-key: ${LITESTREAM_SECRET_ACCESS_KEY}
snapshot:
  interval: 24h
  retention: 720h
```

```bash
litestream replicate -config /tmp/litestream-recovery.yml -once -force-snapshot
```

Change `path` in `cloudflare/litestream.yml` to the recovered prefix and deploy. The container restores from it on every cold start. Keep the old prefix until the recovered game has been checked with real players, and only then remove it. Do not copy the recovered file over the live prefix: that overwrites the only copy while it is still the source of truth.

### Rotate a secret

```bash
npx wrangler secret put LITESTREAM_SECRET_ACCESS_KEY
```

then restart the container so the process reads the new environment: run `npm run cf:deploy`, or let it sleep and take the next request. For the R2 credentials, create the second token before revoking the first, set both secrets, restart, confirm objects still appear in the bucket, and then revoke the old token. That order keeps replication running throughout.

## Schema changes

Every schema change needs a schema edit and a new migration. Railway still applies the schema with `prisma db push` on start; the Cloudflare container applies migrations, so a field added without a migration will exist on Railway and be missing on Cloudflare.

Generate the next migration from the schema rather than resetting the local database, which was created by `db push` and has no migration history:

```bash
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "file:/tmp/portmasters-shadow.db" \
  --script \
  --output /tmp/next-migration.sql

mkdir -p prisma/migrations/20261027093000_add_example
mv /tmp/next-migration.sql prisma/migrations/20261027093000_add_example/migration.sql
```

Name the folder with the UTC time and a short name, the way the baseline is named. Check that the migrations build the current schema before deploying:

```bash
DATABASE_URL="file:/tmp/portmasters-migrate-check.db" npx prisma migrate deploy --schema prisma/schema.prisma
npx prisma migrate diff \
  --from-url "file:/tmp/portmasters-migrate-check.db" \
  --to-schema-datamodel prisma/schema.prisma
```

The second command must report no difference. Then update the local development database as usual with `npm run db:push`, commit the migration with the schema change, and deploy. On a restored database the baseline is already recorded and only the new migration runs; on a fresh bucket the whole history runs in order.

Never run `prisma db push` against the deployed database. If one was run by mistake, restore a copy instead of trying to repair the file.

## Cost and limits

- Workers Paid is required, 5 dollars per month before usage.
- The basic instance is a quarter vCPU, 1 GiB of memory and 4 GB of disk. At the current published rates, a container that stays awake at full CPU costs about 19.44 dollars per month, about 24.44 dollars with the plan. CPU is billed only while active, and the idle sleep lowers the bill.
- Included each month: 25 GiB hours of memory, 375 vCPU minutes of CPU and 200 GB hours of disk.
- R2 storage for this database is tiny. Litestream uploads on each sync while the harbor is busy, so a heavily played month can pass the free write allowance; at current rates that is a few dollars. Container egress is billed separately from R2 storage.
- A cold start is several seconds plus the restore, and the first request after a sleep waits for it. Active harbors stay awake.
- Idle sleep lowers the bill, but an open game tab holds a WebSocket, and the container proxy counts that connection as activity while it stays open.
- The container disk is ephemeral, and R2 is the only durable copy. It is also a single point of failure: a deleted bucket, a revoked token or a deleted prefix has no fallback. Scope the token to the bucket, keep it out of cleanup rules, and take an occasional restored copy to storage outside R2.
- SQLite has one writer, so this design caps scale in exchange for staying simple.
- Images are limited to 50 GB per account, and each image must fit the instance disk. The image carries development dependencies on purpose, because `tsx`, the Prisma CLI and the Next.js production server run from the source tree. If it grows past the disk, prune what is not needed at runtime in a follow up.

## Troubleshooting

**The first request answers 503 with "The harbor is starting up."** Expected during provisioning and after a sleep. Wait 15 seconds and retry. If it keeps answering after about two minutes, read the container logs: the usual causes are a missing setting, which the log names, and a restore that cannot reach R2.

**The Worker answers 500 with "The harbor is not available right now."** A container configuration error. `npx wrangler tail` shows the Worker's message, which names the missing setting and never prints a value. Fix `wrangler.jsonc` or the secret and deploy again.

**The log says `entrypoint: LITESTREAM_BUCKET is missing`, or names another setting.** The container started without one of the four Litestream values. Set the secret or var and restart the container. An empty string counts as missing, on purpose.

**Link previews point at localhost.** APP_URL is unset or malformed. It must be an absolute address with `http` or `https`; the application refuses to start with anything else.

**Every captain shares one rate limit bucket.** The client address is not reaching the application. The Worker sets `x-forwarded-for` from `cf-connecting-ip`; if another proxy sits in front, it must not strip the header.

**Sign in does not keep the session over HTTPS.** The cookie is `Secure` only when the application sees `x-forwarded-proto: https`, which the Worker sets from the request scheme. A proxy that terminates TLS and forwards plain HTTP must set that header before the Worker.

**The site loads but the game looks empty.** The restore found nothing at the configured prefix. Check the bucket and the `path` in `cloudflare/litestream.yml`, and the restore line in the logs. A mistyped endpoint or a token scoped to another bucket shows as an R2 access error.

**The image build fails on the wrong platform.** Wrangler and `npm run cf:image` both build `linux/amd64`. On a machine of another architecture this needs buildx, which Docker Desktop includes.

**`wrangler deploy` reports that the plan does not include Containers.** Workers Paid is the gate.

**Socket.IO drops while a tab is open.** Check the container logs for a crash and the instance list for restarts. A deploy does this on purpose, and so does the 15 minute idle sleep once the last heartbeat stops.

**A migration fails at start.** The container keeps failing to boot, so requests answer 503. Read the container log for the failing statement, fix it in a new migration, and deploy. The database before the failure is still in R2; restore it if the half applied change matters.

**A Workers Builds build fails with `Environment variable not found: DATABASE_URL`.** The build command is running `prisma db push`, which needs a database, and Workers Builds has neither a database nor the Worker's variables. Leave the build command empty (or set it to `true`) and keep the deploy command at `npx wrangler deploy`. The Dockerfile builds the application and the container applies the schema with migrations at start.

**A Workers Builds deploy fails with `The Docker CLI is needed to build the configured image`.** The build environment cannot build the container image. Deploy with `npm run cf:deploy` from a machine with Docker; the Git integration can update Worker code only with `--containers-rollout=none`, which does not publish an image.
