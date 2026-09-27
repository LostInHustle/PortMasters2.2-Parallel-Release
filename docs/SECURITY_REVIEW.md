# The Private Information Security Review

[J1: the private information review] Ocean Gambit is the first mode in this
tree whose rules depend on things a captain is not allowed to know: an
alignment, a personal goal, an ally, a win verdict. Everything else the game
hides is hidden by being local, and this is hidden by being deliberate, so
the paths that carry those facts are worth reading on purpose rather than
trusting to have come out right.

This is that reading. It covers the three surfaces the plan names, it records
what it found and what it fixed, and it names the boundaries that were
accepted on purpose. Two gates came out of it, and the last section says when
the whole review repeats.

## Scope

Three surfaces, taken from the plan:

1. **Every site that builds a broadcast payload.** Anything a whole harbor
   receives. There are 50 `io.to(...)` and `io.emit(...)` statements across
   16 files under `src/server/realtime`, and the question asked of each is
   whether anything private can be inside the payload it sends.
2. **Every site that writes to the log array.** The session conversation,
   which lives in process memory for the length of a room's life and is
   deliberately never written to the database.
3. **The save path that trusts a client.** `PUT /api/game/state` writes what
   a client sends, by design, and a save is read by the whole table at the
   end of a voyage.

Out of scope, and named so it is not mistaken for covered: the account and
session layer beyond identity binding, transport security, and the shape of
the mute, which belongs to J2 and is recorded as a forward note below.

## Method

The private channel was read end to end by hand: the emitter, the wire type,
the client hook, and every caller. Identity binding was read at the socket
layer. The two mechanical inventories above were taken exhaustively rather
than sampled, and the client trusting endpoints were read line by line.

Then the reading was turned into a gate, because a review that ends in a
document is a review that is true exactly once. `scripts/private-scan.ts`,
run as `npm run check:private`, holds five rules:

1. One delivery path for a private entry. The event is handled in the
   emitter, the wire type, the client's one hook, and the suite that sweeps
   it. A fifth file is a second path nobody reviewed.
2. One reader of the alignment table. Only the module that deals the cards
   may read the rows back.
3. The win verdict is a property in three places: the balance reader, the
   operator window and the wire type.
4. No broadcast payload statement names a secret.
5. The tutorial's one `dangerouslySetInnerHTML` site, which renders authored
   copy with constants in it and nothing else.

Its first run produced 25 findings, nearly all of them its own noise, and the
calibration is recorded in its header: `scripts/smoke.ts` was allowed as a
reader because a suite reading rows back is a test of the module rather than
a second production reader, the rules were narrowed to `src/` where they are
about what the product ships, and word matching was replaced with shape
matching after the first draft reported four clean broadcasts as leaks
because "ally" appears inside "finally". It was then proved non-vacuous: a
probe file violating all five rules was written, the scan reported 9 findings
and exited 1, and the probe was deleted in the same command.

## The three inventories

### 1. Broadcast payloads

50 statements, 16 files. Every one was read for what it carries. The
findings that matter are in the next section; what the inventory establishes
is the shape of the surface: the broadcasts carry room rosters, chat lines, a
voyage checkpoint, objective totals, barter and aid offers, telemetry
statuses, the audit reveal, and the end of voyage reveal. The two that carry
a secret are deliberate, and are listed under boundaries below.

### 2. The session log array

`src/server/realtime/chat.ts` holds two arrays: `roomChatLog` (line 53) and
`roomDirectLog` (line 57). Both are written through one function,
`appendBounded` (line 88), reached by `recordHarborMessage` (line 103) and
`recordDirectMessage` (line 110), and both are bounded at 200 lines
(`SESSION_LOG_LIMIT`, line 49). Reads are asymmetric on purpose: `harborLog`
(line 117) hands back the room's own conversation, while `directLogFor`
(line 125) filters on read to the lines the reader sent or received. The
filter is the design rather than the storage, which is what keeps one
captain's private thread from reaching another when a room is hydrated after
a reload. Both arrays are dropped when the room is restarted or torn down
(`clearSessionChat`, line 134).

Nothing here needed a fix. It is recorded because it is the one place in the
product where private conversation is stored at all, and the next slice that
adds a line to it should know which array it is writing into.

### 3. The save path

`src/app/api/game/state/route.ts`. The `PUT` requires a session (line 109), a
membership row (line 118), and then writes what it was handed. The Ledger
Integrity Pass reads four numbers out of the blob (line 145) and marks the
row rather than rejecting it, which is deliberate: a captain must never lose
a voyage to a false positive, and an implausible save is a mark the features
that read standings can decline to trust.

Three properties hold around it. The verdict is judged against the room's own
`currentRound` rather than anything in the payload, which is the one number a
client cannot forge (line 139). The response shape is identical whether or
not the save tripped the guard, so a tampering client learns nothing about
whether it was caught (line 180). And the alignment table is not in a save at
all: alignments live in `VoyageRole` rows the server writes, which is why a
doctored save cannot invent one.

## Findings

### F1, Medium, fixed: the detail popup trusted its clients

`player:detail:response` relayed whatever the sending socket said. Any
authenticated captain could emit one frame naming any `targetUserId` and any
`requesterId` and any room, and the server would push the payload to the
named account, anywhere in the tree, with a snapshot of the sender's
choosing in it. Nothing private leaked the other way, but a captain could be
handed a forged hold under another captain's name, which is the kind of
defect that makes the popup worse than not existing.

Fixed by holding the question. `player:detail:request` now verifies that the
target is a member of the asker's own room before forwarding, and writes the
pair down (`rememberDetailRequest`, `src/server/realtime/presence.ts:92`).
The response is relayed only if a question is waiting for that exact pair,
and only if the asker is still standing in the room the question was about
(`src/server/realtime/index.ts:1787`). The room and the requester on the
relayed frame are the ones the server wrote down, never the ones the
answering client sent. Holds expire after 30 seconds and are dropped with the
room on a restart or a teardown. Three branches of it are now exercised by
the smoke suite: the question and answer, a second answer to a consumed
question, and an answer to a captain who has left the harbor.

### F2a, Low, fixed: a manifest line was bounded in shape but not in size

`normalizeOrderFills` (`src/lib/game/audit.ts:161`) dropped entries that
could not be a fulfillment, but placed no bound on a port name, a good name,
the number of goods in a line, or a count. Since a fill is printed to the
whole table in an audit reveal and in the ledger at the end of a voyage, a
doctored save could put a paragraph of its choosing, or ten thousand items
in one line, in front of six captains at the moment they were watching.

Fixed with three bounds read off the game rather than picked: 32 characters
of text (the longest port name is fourteen), four kinds of good (the widest
order asks for three), and 999 units (the widest line asks for four). A line
over any of them is dropped rather than trimmed, because a half printed fill
reads as a smaller trade than it was. Both sides of each bound are checked in
the suite: what a real voyage produces survives, and what only a doctored
save could is dropped.

### F2b, Low to Medium, fixed: a save had no size limit

Any member of a room could write a save of any size, and the harbor pays for
it: the conclusion parses every blob at the table and the Manifest Audit
samples one, on the code path that has to finish before a voyage can end.

Fixed with a 64 KB cap (`SAVE_BODY_MAX`, same route, line 106), chosen from
measurement rather than taste: five real saves on a live database run 1.5 KB
to 3.5 KB, so the cap is around twenty times the largest real one and leaves
room for a long voyage, a big hold and a full ledger. An oversized save is
refused with a 413 before the write, so the good save already on the row
stays exactly as it was, which the suite checks.

### F3, Low, forward note: there are no rate limits anywhere in `src`

Every entry point is capped in size and typed, and chat is capped at 1000
characters on all three paths (`CHAT_MESSAGE_MAX`,
`src/lib/realtime-endpoint.ts:22`), but nothing counts requests. A captain
with a script can emit status frames or detail questions as fast as the
socket accepts them. This is recorded rather than fixed because no slice of
the plan owns it and a limit invented here would be a number with no reading
behind it; the natural owner is the same slice that takes the mute's shape.

### F4, Low, forward note for J2: the mute is visible to the room

`mutedUserIds` rides `room:members` (`src/server/realtime/chat.ts:152`), so
every captain in the harbor can see who has been muted, including the muted
captain. It is not a private information defect (nothing secret is revealed
about anyone) but it is the kind of design a later slice should decide on
purpose, and J2 is where the mute is shaped.

## Boundaries accepted on purpose

These are not defects and were not fixed. Each has a reason, and the reason
is what a later reviewer should test rather than the fix.

**The engine is client authoritative.** A captain's own voyage is theirs to
compute, and the server does not re simulate it. The consequence is that a
modified client can play a voyage it could not have played, and the answer in
this tree is not prevention but consequence: the integrity pass marks the
row, the voyage conclusion reads the mark, and features that later read
standings can decline to trust it.

**The `game:status` allow list.** The heartbeat accepts a named set of
fields, so a client cannot write arbitrary JSON into a broadcast. The list is
the boundary: everything else a client sends on that event is dropped.

**Two room wide carriers of a secret, both deliberate.**
`voyage:reveal` (`src/server/realtime/reveal.ts:40`) publishes every card at
the end of a voyage, because that is what the end of a voyage is for, and
`audit:reveal` (`src/server/realtime/audit.ts:217`) publishes two sampled
manifest lines during one, because the audit's whole value is that the table
sees them. Both are the mode's design rather than leaks of it, and both are
reachable only at their own moment.

**The win verdict and the alignment are on their own rows.** The chronicle
row carries both (`prisma/schema.prisma:327`), and the wire type does not:
the route that hands a captain their chronicles selects named fields, omits
both, and filters on the reader (`src/app/api/chronicle/route.ts:29, 54`).
That is the same allow list discipline the payloads follow, one layer down.

**The operator window is admin gated.** The one console that can read across
accounts refuses every action from a captain whose account row is not an
administrator, and the check is server side (`src/server/realtime/admin.ts:111`).

**Identity is bound on the socket, never read from a payload.** `auth`
resolves the account through `getUserFromToken` (`src/server/realtime/auth.ts:75`)
and writes the id onto the socket state (line 102). `room:join` verifies a
membership row before the seat is claimed (line 427). No handler in the
realtime layer reads a captain's identity out of the frame it was sent,
which is what makes "the sender is who they say they are" true by
construction rather than by review.

## The severity one bar

The plan's evaluation for this review is that no alignment field can reach
the wrong client, at severity one. The verdict is that none does, and that
none did before the fixes either: the alignment table has three production
readers, all inside `src/server/realtime/gambit.ts` (lines 154, 213, 270),
and the only wire field that can carry an alignment is `role`, inside a
`PrivateEntry` that `emitPrivate` addresses to one captain's own sockets
(`src/server/realtime/presence.ts:62`).

That verdict is now mechanical rather than remembered. Two sweeps in the
smoke suite read every frame every socket receives at two Gambit tables,
including a six captain table with two Pirates and an ally, and fail on any
frame but a dealt card that carries a role field, a flourish field, an ally
field, or an alignment word under any name. The sweeps are also required to
match the shapes they look for before they are pointed at a harbor, so a
pattern narrowed to nothing cannot pass by finding nothing.

## The closed test

The review's other half is a closed test: thirty players, none of them the
people who built the mode, on a database that has never held a real account.
The discipline is the smoke suite's, one size larger: the database is a
separate one, and the name says so.

`scripts/closed-test.ts`, run as `npm run check:closed-test`, is step zero of
that test. It refuses to bless anything but a local SQLite file whose name
begins with `closed-test`, it prints the name and the counts of what is
already inside, and it never prints any part of the database URL, because a
connection string can carry a password inside it and the guard's output is
meant to be pasted into a session log. It reads and counts, and it writes no
row and creates no table.

It deliberately does not contact a running server. The one route a script can
call without credentials answers from the process and touches nothing else,
by design, so it cannot say which database the server answering for it is
writing to; asking would be theatre. The run time proof that a server and the
script driving it share one database is the smoke suite's safety interlock:
the first account is created through the API, and the run stops before a
second one exists unless that account can be read back through the driver's
own connection.

When the test ends, the database is discarded. No row from it is copied
anywhere and it is never merged into anything holding real accounts. What
reads it needs no new instrument: the operator window and the voyage records
read a closed test the way they read any voyage.

## What the gates cannot catch

A gate that reads as stronger than it is is worse than none, so:

**The scan reads text, not meaning.** It cannot follow a value through a
variable, so a payload assembled in a helper and emitted later reads as clean
unless the emit statement itself names the secret. Rule 4 gathers an emit
statement up to eight lines, and a secret smuggled under a name the rule does
not know about passes it. That gap is covered on the wire rather than in the
text, by the sweeps above and by the adversarial sections of the suite.

**The sweeps only read the harbors the suite sails.** They cover two Gambit
tables and the windows in which those tables are watched. A third mode with
its own private channel would need its own table.

**The closed test guard checks a name.** It is the readable part of "a
separate database from anything with real accounts" and not the whole of it.
A database that is separate but misnamed is refused, and a database that is
wrongly named but separate is accepted; the interlock is what covers the
fact of separation at run time.

## When this review repeats

The rule, written here so nobody has to remember it: **a new private channel,
a new persisted secret, a new broadcast payload, or a new path that trusts a
client repeats this review before it repeats the closed test.** The same
sentence is in `docs/IMPLEMENTATION_PLAN.md` under the rules that must not be
broken, and `npm run check:private` is the part of it a command can hold.
