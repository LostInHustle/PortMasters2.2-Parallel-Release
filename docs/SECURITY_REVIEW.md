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

A second pass was taken for J2, which added the private paths the first pass
did not have: a frame carrying the host's mute list, delivered one captain at
a time, and a report row that names two captains and reaches no wire at all.
The two notes the first pass recorded rather than fixed are closed findings
now, with what closed them written where they were raised.

## Scope

Three surfaces, taken from the plan:

1. **Every site that builds a broadcast payload.** Anything a whole harbor
   receives. There are 59 `io.to(...)` and `io.emit(...)` statements across
   28 files under `src/server/realtime`, and the question asked of each is
   whether anything private can be inside the payload it sends. The two
   passes read the 50 statements across the 16 files that existed when they
   ran; four files joined the surface after them, and the extraction that
   moved the connection handlers one to a file moved statements between
   files without adding one, so the count above is the surface as it stands
   rather than the pages that were turned. The last section records what the
   repeat rule makes of both.
2. **Every site that writes to the log array.** The session conversation,
   which lives in process memory for the length of a room's life and is
   deliberately never written to the database.
3. **The save path that trusts a client.** `PUT /api/game/state` writes what
   a client sends, by design, and a save is read by the whole table at the
   end of a voyage.

Out of scope, and named so it is not mistaken for covered: the account and
session layer beyond identity binding, and transport security. The shape of
the mute was out of scope in the first pass as a note for J2 and is read in
the second, where the frame that carries it is added to the inventories
below, along with the report row beside it.

## Method

The private channel was read end to end by hand: the emitter, the wire type,
the client hook, and every caller. Identity binding was read at the socket
layer. The inventories below were taken exhaustively rather than sampled: the
broadcast payloads and the session log by reading every entry, and the save
path and the report row line by line.

Then the reading was turned into a gate, because a review that ends in a
document is a review that is true exactly once. `scripts/private-scan.ts`,
run as `npm run check:private`, holds seven rules:

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
6. The roster frame, which is the only thing in the tree that carries the
   mute list, goes out one captain at a time. A mute is the host's judgement
   of one captain, so a roster frame sent to a room is that judgement told to
   the room.
7. The draft frame, which carries a captain's hand, goes out one captain at
   a time for the sixth rule's reason. A hand dealt to a seat is that seat's
   information, and a draft view sent to a room channel lays every seat's
   cards in front of the table.

Its first run produced 25 findings, nearly all of them its own noise, and the
calibration is recorded in its header: `scripts/smoke/` was allowed as a
reader because a suite reading rows back is a test of the module rather than
a second production reader, the rules were narrowed to `src/` where they are
about what the product ships, and word matching was replaced with shape
matching after the first draft reported four clean broadcasts as leaks
because "ally" appears inside "finally". It was then proved non-vacuous: a
probe file violating all five rules was written, the scan reported 9 findings
and exited 1, and the probe was deleted in the same command.

The second pass proved the sixth rule the same way rather than inheriting the
first pass's proof: a probe file that delivered the roster frame to a room was
written, the scan named the file and the line, reported 1 finding, exited 1,
and the probe was deleted in the same command, after which the scan read the
tree clean again. The rule keys on the event name at an emit statement plus an
allow list of per-recipient emitters, rather than on the mute field riding
beside it, because the defect it guards is not a payload that mentions the
list: it is the frame losing the captain it was addressed to.

The third pass added the seventh rule when the draft landed, and proved it
the same way: a probe file that delivered a draft frame to a room was
written, the scan named the file and the line at the emit statement, reported
1 finding, exited 1, and the probe was deleted in the same command, after
which the scan read the tree clean again. The rule is deliberately the sixth
rule's shape, because the thing being sent is the same kind of thing: a
frame whose audience is its privacy. It keys on the emit statement rather
than on the event name alone so that the four allowed delivery sites (the two
named per-recipient emitters, a reply on the asking socket, and a
`to(socket.id)` send, which is the same single recipient spelled the long
way) pass on their spelling rather than on their intent.

The suite's own reading of the same boundary was proved the same way, on a
copy of the tree rather than on the tree: with the draft's view changed to
a room broadcast for one run, the sweep reported the two seats it caught
and the run exited 1, and the copy was restored from the tree and read
clean again. The sweep keeps every frame both sockets at a draft table
receive, on every event rather than on the events the feature names, and
reads each hand it finds against the beat that hand belongs to, so a hand
that changes inside a single beat is a card that reached the wrong socket.

## The inventories

### 1. Broadcast payloads

59 statements, 28 files. The two passes read the 50 statements across the 16
files that existed when they ran, and every one of those was read for what it
carries; the four files added since are named in the last section, and the
extraction that moved the connection handlers one to a file took 29
statements out of the composition root and into nine leaves, which is one
file off the surface and nine on with the total unchanged, so the count here
is the surface as it stands rather than the pages that were turned. The findings that matter are in the next section; what the inventory
establishes is the shape of the surface: the broadcasts carry room rosters,
chat lines, a voyage checkpoint, objective totals, barter and aid offers,
telemetry statuses, the audit reveal, and the end of voyage reveal. The two
that carry a secret are deliberate, and are listed under boundaries below.

The roster frame is the one entry the second pass changed, and it changed by
losing a recipient rather than a field: the count above is the count after
the change, because the frame is the same frame sent to one captain at a
time through `emitToUser` instead of to the room. The mute list it carries is
read by each captain as what they may see, which for most of a harbor is
nothing at all.

[B2] added two fields to a payload that already existed rather than a payload
of its own: `phase:ready_update` now also carries the moment the room's seat
runs out and how long that seat was given, which is what every captain's
countdown is drawn from. Both are public to the table by design, since the
clock is on all of their screens at once and a deadline the room shares is
not a secret, and neither is derived from anything hidden: the deadline is
the server's own arithmetic over a length that is a constant in the tree.
The four clauses below were applied to it, and the one of them it touches is
the broadcast payload clause, which it satisfies by adding fields to a
statement already in this inventory rather than a statement of its own. The
single new broadcast statement is the harbor's own line explaining a move the
room did not vote for (`src/server/realtime/checkpoint.ts:319`), which
carries a sentence and a room id and nothing about any captain. No new path
trusts a client either: the departure a captain who had not acted takes is
computed by the same client authoritative engine the boundaries below
already accept.

### 2. The session log array

`src/server/realtime/chat.ts` holds two arrays: `roomChatLog` (line 77) and
`roomDirectLog` (line 81). Both are written through one function,
`appendBounded` (line 112), reached by `recordHarborMessage` (line 127) and
`recordDirectMessage` (line 134), and both are bounded at 200 lines
(`SESSION_LOG_LIMIT`, line 73). Reads are asymmetric on purpose: `harborLog`
(line 141) hands back the room's own conversation, while `directLogFor`
(line 149) filters on read to the lines the reader sent or received. The
filter is the design rather than the storage, which is what keeps one
captain's private thread from reaching another when a room is hydrated after
a reload. Both arrays are dropped when the room is restarted or torn down
(`clearSessionChat`, line 158). The lines here moved down by twenty when the
mute book's own unique violation reader joined this module; the readers and
the arrays are the same ones the pass read.

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

### 4. The report table

`Report` (`prisma/schema.prisma:457`) is the one record the second pass
added. Four columns and a moment: a harbor, a voyage, a reporter and a
target, with a unique constraint over the four, so one report per pair per
voyage is the table's own rule rather than a check standing in front of it.
The harbor and the two captains are bare strings with no relations, which is
the telemetry row's shape and holds for the same reason: the row is a record
about an account rather than a part of it, so nothing cascades, and the
operator's purge deletes the rows that name an account by hand, on the
reporting side and the reported side alike.

Nothing on the wire carries a report. The captain it names is not told, the
harbor is not told, and the only frame it produces is the acknowledgement to
the captain who filed it. With the mute, the second pass added no new private
channel at all; it added a record the game keeps and a frame that lost an
audience, which is why the review repeats over them rather than the suite
growing a sweep for them.

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
pair down (`rememberDetailRequest`, `src/server/realtime/presence.ts:93`).
The response is relayed only if a question is waiting for that exact pair,
and only if the asker is still standing in the room the question was about
(`src/server/realtime/wiring/player-detail.ts:85`). The room and the requester on the
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

### F3, Low, fixed: there were no rate limits anywhere in `src`

Every entry point was capped in size and typed, and chat was capped at 1000
characters on all three paths (`CHAT_MESSAGE_MAX`,
`src/lib/realtime-endpoint.ts:22`), but nothing counted requests, so a captain
with a script could emit status frames or detail questions as fast as the
socket accepted them. The first pass recorded this rather than fixing it
because no slice of the plan owned it and a limit invented then would have
been a number with no reading behind it. The same slice that shaped the mute
has that reading, so it is fixed here.

As fixed, `src/server/realtime/inbound-limit.ts` puts every incoming frame on
a token bucket per socket, installed in front of every handler
(`src/server/realtime/index.ts:264`): thirty frames in hand
(`inbound-limit.ts:53`) and ten a second earned back, both read off the client
this tree ships rather than picked. An idle captain in a voyage sends two
heartbeats per eight seconds, a captain trading sends two to nine frames a
second in clusters of up to three inside a hundred and twenty milliseconds, a
client mounting a room sends about nine frames in a hundred and fifty, and the
tightest legitimate loop the suite runs sends twelve frames a hundred
milliseconds apart. Thirty clears the largest burst with the mount storm and a
margin on top of it; ten a second sits at the highest sustained rate the app
itself produces, which is where a script emitting hundreds a second is held to
after its first thirty frames. A frame over budget is dropped rather than
queued, the captain is told once per socket through the channel refusals
already use rather than once per refused frame, which is what stops the limit
amplifying the flood it is limiting, and one line in the process log per
socket is the whole trace. Nothing is recorded as telemetry: a record is of a
voyage, and a client sending too much is not something a voyage did.

Its own limits, written down because a limit that reads as stronger than it is
is worse than none. It bounds how fast a socket may talk and says nothing
about what it says, so it is not a filter and does not stand in for one. It is
per socket rather than per account, so a captain who opens a second tab buys a
second budget. And it sits above every cadence the shipped client produces,
which is deliberate rather than a gap: a person playing the game cannot reach
it, and the thing it exists to bound is the scripted client. The suite checks
the shape rather than the number, and it reads it over a live socket: two
hundred frames from one socket are answered thirty times, the captain behind
them is told once, the next captain's twelve frames are answered twelve times,
and the flooded socket is answered again once the budget refills.

### F4, Low, fixed: the mute was visible to the room

`mutedUserIds` rode `room:members` as a room wide broadcast, so every captain
in the harbor could see who had been muted, including the muted captain. The
first pass recorded it as a design a later slice should decide on purpose
rather than as a leak, since nothing secret was revealed about anyone, and J2
is the slice that shaped the mute.

As fixed, the frame is delivered one captain at a time through `emitToUser`
(`src/server/realtime/chat.ts:220`), and the field means what that recipient
may see rather than what the harbor decided: the host is handed the list they
set, a silenced captain is handed their own row of it, and a captain who is
neither is handed nothing. No client shape changed, because both existing
readers already read the list that way, and the scan's sixth rule is what
keeps a later slice from turning the frame back into a broadcast.

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
membership row before the seat is claimed
(`src/server/realtime/wiring/room-join.ts:67`). No handler in the
realtime layer reads a captain's identity out of the frame it was sent,
which is what makes "the sender is who they say they are" true by
construction rather than by review.

## The severity one bar

The plan's evaluation for this review is that no alignment field can reach
the wrong client, at severity one. The verdict is that none does, and that
none did before the fixes either: the alignment table has three production
readers, all inside `src/server/realtime/gambit.ts` (lines 154, 213, 289),
and the only wire field that can carry an alignment is `role`, inside a
`PrivateEntry` that `emitPrivate` addresses to one captain's own sockets
(`src/server/realtime/presence.ts:63`). The set stayed three when the
charters landed at leg four: the take reads the table through the same
module's own accessor, where the voyage's end was already the first caller
(`cardsInRoom`, called from `src/server/realtime/conclusion/voyage.ts:327`
and, for the take, `src/server/realtime/wiring/leg-report.ts:130`), which
is a second caller rather than a fourth reader.

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

**The sixth rule reads an event name.** It matches `"room:members"` at an emit
statement and allows an explicit list of per-recipient emitters, so an event
name reached through a variable holding it passes, and so would a roster frame
sent through some other addressed emitter nobody has written yet. It guards
the regression it was written for rather than proving no second path exists,
which is the same gap rule 4 has and is written down for the same reason.

**The budget bounds rate, not content.** Ten well formed frames a second are
allowed through, and every one of them is still read by the same handler and
the same sanitizer as before. It is not a filter, and it says nothing about a
captain who stays under it.

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

It has been repeated once. J2 added a persisted record about two captains and
changed the audience of a payload that had been arriving at the wrong one, so
it triggered on two of the four clauses at once. The second pass is recorded
on this page rather than in a document of its own, because a second reading of
the same surfaces is a second pass over the same page: the scope, the
inventories, the findings and the limits above now carry both.

**The surface has grown since the second pass, and the trigger is met again.**
The passes read 50 broadcast statements across 16 files. There are now 59
across 20: the four files added since are `bazaar.ts`, `consent.ts`,
`draft.ts` and `voyage-log.ts`, and the files that were already there carry
five more statements between them than they did. That is the fourth clause
read as a count, so this is written down as an owed repeat rather than
settled here, and it is left visible on purpose: the numbers in the scope and
the inventory above are the surface as it stands, and the reading behind them
is the one the second pass took.

**The surface then moved without growing.** The extraction that split the
connection handlers one to a file changed where the statements live and
nothing else about them: the composition root held 29 of the 59 and now holds
none, those 29 sit one to a file across nine leaves under
`src/server/realtime/wiring`, and the total is 59 before and after. No frame
was added, no recipient changed, no payload gained a field, and no path that
trusts a client appeared, so the private channel clause and the persisted
secret clause are untouched and the broadcast payload clause is untouched in
substance: a statement does not become a new payload by moving to another
file. What it does change is the count that clause is read against, and that
count is already recorded above as an owed repeat. The repeat stays owed, it
is now owed over 28 files rather than 20, and no reading has been taken over
the newer ones, which is stated here rather than implied by the numbers.

What holds the newer paths in the meantime is `npm run check:private`, whose
fourth rule reads the text of every broadcast payload statement for a secret
written into it, which is the part of this reading a command can keep. What
that rule cannot do is the part this review exists for: it reads the words of
an emit rather than its meaning, so it catches a payload that says role or
flourish or ally or alignment and passes one that smuggles the same value
under a name nobody taught it.
