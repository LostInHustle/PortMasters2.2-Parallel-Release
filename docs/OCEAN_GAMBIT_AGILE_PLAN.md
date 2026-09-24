# Ocean Gambit: an Agile delivery plan

Written against the Ocean Gambit design proposal and against the tree it would be built inside, PortMasters 2.2 Parallel Release. That tree is the experimental release before PortMasters 3, so the Ocean Gambit work lands in it as a mode rather than as a game of its own. Prepared from the core product management chair.

## How to read this

The proposal already contains a plan. It is one plan, twenty four weeks long and seven phases deep, written from the design chair. This document does not replace it. It cuts the same content into pieces small enough to finish, show, and abandon safely, which is what a team working in iterations needs and what a design proposal never contains.

Every goal below carries the same five parts:

- **Plan.** What the goal is, and why it goes here in the order rather than somewhere else.
- **Implementation.** Where it lands in the four layer architecture, and what it costs.
- **Evaluation.** The measurement that decides whether it worked, and how it gets tested before anyone argues about it.
- **Rollback.** What turns it off, what stays behind if it does, and the one data concern that matters.
- **Iteration.** What the second pass looks like once the first pass is in front of real captains.

Six standing rules apply to every goal and are not repeated in the blocks below.

1. **One epic in flight.** A slice opens when the slice under it passes its gate, not when someone has spare time.
2. **Every slice ends playable.** If a goal cannot be played at the end of the iteration, it was scoped wrong.
3. **Telemetry before features.** A goal that adds a system without adding its measurement is not done.
4. **Flags from the first commit.** Nothing reaches the live harbor until its gate passes, so every goal ships behind a switch.
5. **Definition of done.** `npm run typecheck`, `npm run lint`, `npm run build` and `npm run check:palette` clean, the smoke test passing against a throwaway database, new state round tripping through save and load, and the Ledger Integrity Pass knowing about every new persisted field.
6. **The live base game stays shippable.** A slice that would leave PortMasters 2.2 Parallel Release in a worse state than it found it does not merge, no matter how good it is.

## Five things the proposal could not see from outside the tree

The proposal is written by someone reading the design and not the repository, and it says so. Five of its recommendations land on structures that already exist and already disagree with it. They go first because everything else leans on them.

**One. The phase split already exists, and it is a different split.** The engine already cycles eight room checkpoints per round: the welcome, the boon draft, port purchase, barter, artisan management, trade orders, settlement, and the shipyard. The proposal asks for a six phase leg: Dawn, Market, Orders, Parley, Resolve, Dusk. Those are not the same shape, and the proposal admits this split is the most important mechanical decision in the document. Reconciling them is the largest structural change in the plan, it touches the one ordered list that both the ready check and the interface read, and it has to be first.

**Two. The engine is client authoritative and deterministic by composition.** Every captain seeds from values they know, which is what removes the server from the simulation. Hidden roles cannot use that seed. Alignment has to be assigned server side from a value that never reaches a client. This changes the engine contract for exactly one input, and it should be designed before a single role is written, not after.

**Three. Bankruptcy and endgame are terminal phases today.** Pillar four says there are no dead seats, ever. That is not a small wording change, it is a rules change that reaches the phase union and the conclusion handler, and it has to be reconciled with the existing Ledger Integrity Pass, which currently lets an impossible captain finish the voyage while banking nothing.

**Four. The Bourse cannot be client held.** A standing offer posted in leg two that fills in leg nine outlives the client session that posted it. The offer book is server state even though the trade it produces can still be validated by the pure engine.

**Five. The deploy path shapes every migration.** The host runs the Prisma schema push, without regenerating, in its start command against a mounted volume, so every new field ships safely as an addition and never as a rename. New environment variables go on the service, not in `railway.json`, which has nowhere to put them.

## The map

Eleven epics, in dependency order. Each one is playable at the end of it.

- **A. Proof before code.** One goal. No engineering.
- **B. The leg clock.** Four goals. The structural answer to the three clocks problem.
- **C. Survival.** Four goals. The pressure the economy has been missing.
- **D. The paths.** Seven goals. Identity, and the draft.
- **E. The Quartermaster slice.** One goal, deliberately unsplittable.
- **F. The build layer.** Seven goals. Variance with agency, and the tag system that keeps it cheap.
- **G. The market.** Four goals. Liquidity as a property of exits.
- **H. Ocean Gambit.** Nine goals. The mode, and its private information spine.
- **I. Telemetry and gates.** Five goals. The numbers that decide shipping.
- **J. Trust and polish.** Four goals. What has to be true before strangers play.
- **K. Money, later.** Three goals, none of them before the retention number exists.

Forty nine goals. The count is high on purpose. Almost every one of them is one iteration or less of work, and the ones that are not are marked.

# Epic A. Proof before code

## A1. The paper table

**Plan.** Print the path cards, the order cards, the objective deck, and the private cards. Five friends, one table, a spreadsheet for prices, three voyages, no code. This is the highest value two weeks in the plan because every question the proposal answered with judgment rather than with data gets answered properly here, for the cost of a printer.

**Implementation.** Nothing in the repository. The deliverables are a printable card set, a price sheet, and a written record of what happened. The Quartermaster problem in particular either shows up immediately at a paper table or it does not, and either answer is worth more than a month of implementation.

**Evaluation.** Three voyages completed, with one written page per voyage covering who took which path, whether anyone refused the Quartermaster seat, how long the draft took with human hands, and where the table went quiet. Silence is the measurement. If a paper table goes quiet, a digital one will go quieter.

**Rollback.** None needed. There is nothing to unwind and the cost is paper.

**Iteration.** A second paper pass only when a specific question is still open after the first, and only for that question. A paper pass that repeats the same three voyages teaches nothing new.

# Epic B. The leg clock

This epic is the answer to the clock problem, and it is the platform everything after it stands on. The three ancestors run on three different clocks, and the proposal's fix is structural: give each clock its own phase. Keep them separated and they reinforce each other. Let them bleed together and the game dies of silence.

## B1. The six phase leg, as data

**Plan.** Turn the leg into one ordered definition of six phases: Dawn, Market, Orders, Parley, Resolve, Dusk. Then reconcile it with the eight room checkpoints the engine already cycles, because those are two different shapes and only one of them can be the truth.

**Implementation.** The phase order is single sourced in `src/lib/game/checkpoint.ts` and both the ready check and the interface read it from there, so this is one file plus the checkpoint protocol rather than a scattered change. The existing barter and artisan management steps stop being checkpoints beside the others and become substeps inside Parley and Market. Personal substates and terminals do not become room checkpoints, which is the existing rule and it stays.

**Evaluation.** A full voyage runs end to end on the new order with two clients, and both clients agree on which phase the room is in at every transition. The failure this catches is the one the implementation plan warns about: a phase that does not register with the checkpoint protocol and therefore leaves the harbor waiting forever.

**Rollback.** The old order list is one value, so this reverts by reverting one file, provided no new persisted field was introduced. Keep the two lists side by side behind a flag for one iteration rather than deleting the old one on the day the new one lands.

**Iteration.** Once the leg is stable, the phase lengths become configuration rather than constants, because the balance pass in Epic I will want to move them without a code change.

## B2. Hard timers, and the server as timekeeper

**Plan.** Every phase ends on the clock whether or not everyone has acted. The server owns the transition, and it publishes it.

**Implementation.** The clock cannot live in the engine, because the engine must stay pure and a clock read is a hidden input. So the realtime layer holds the timer and publishes a phase transition, and the engine receives the phase identity and the remaining budget as plain inputs. That preserves the replay property while letting the server be the authority on time. The `_` prefixed transient signal convention is where the countdown rides.

**Evaluation.** A captain who closes their laptop mid leg does not stall the room, and the phase advances on schedule with that captain auto committing. Measure the number of legs that ran to the full timer with nobody idle, because that number should be low and a high one means the phase is too short.

**Rollback.** Timers revert to manual advance by reverting one flag. Nothing durable changes, so there is no data concern at all.

**Iteration.** Per phase overrides, because the social phase and the economic phase will want different pressures and one global number will not serve both.

## B3. Standing orders

**Plan.** A small persistent instruction set each captain configures once, evaluated when a phase closes for a captain who has not acted. The proposal is blunt about this being the feature that makes six players tolerable rather than a nicety, and it is right.

**Implementation.** A new record on the captain, small, normalized on load through the existing defensive helpers, and added to the Ledger Integrity Pass. The evaluation itself is a pure engine function taking the state and the standing orders and returning the committed action, which keeps the determinism property intact and makes it testable with a throwaway script and no server.

**Evaluation.** A deliberately slow player does not change the room's completion time. Measure auto commitment rate per phase, and treat a very high rate in Market as a signal that the phase is too short rather than that players are lazy.

**Rollback.** Standing orders are advisory input, so turning them off restores manual behavior with no migration. Keep the stored set when the feature is off, because deleting it would punish players for a temporary rollback.

**Iteration.** Templates by path, so a Quartermaster gets a sensible default set rather than an empty form.

## B4. The log surfaces, public and private

**Plan.** Promoted from an implementation detail to a product surface. Dusk gives the room a public log and each captain a private log, and the private one is the delivery channel for every hidden thing in Epic H.

**Implementation.** The split already exists in the engine, whose only side channel is the log array every mutating function takes last. What this goal adds is the transport rule: a private entry is emitted to its owner's sockets and to nobody else, using the canonical per user emit helper in the presence module rather than a hand written loop. Every mutating function that writes a private entry gets a tagged test, because this is the contract Epic H depends on.

**Evaluation.** A two client test asserts that no private entry appears in the other client's transcript. This becomes a standing regression test and it never gets retired.

**Rollback.** Nothing is observable to turn off. A private entry that is misrouted is a severity one defect rather than a rollback case.

**Iteration.** The private log becomes the natural home for the reveal material in H9, so the shape settled here should leave room for a replay view later.

# Epic C. Survival

The gate for this entire epic is one question, and the proposal is right to make it the gate: is the base trading game more fun with survival than without it. If not, stop and fix that, because every later system stands on this one.

## C1. The Larder and Short Rations

**Plan.** Each captain's crew eats one ration per crew member per leg. The Larder is a plain number and it is always on screen. At zero the captain enters Short Rations: cargo capacity down a quarter, crafting slowed, and the state publicly visible to the whole fleet.

**Implementation.** New captain state fields, normalize helpers, and Integrity Pass entries. The public visibility rides the existing status broadcast, which already carries a room scoped snapshot, so no new channel is needed. The capacity change flows through the single capacity read rather than being applied in several places.

**Evaluation.** The number that matters is how often Short Rations happens at all, and then whether it produces conversation rather than shame. Watch message volume in the leg after a captain visibly enters Short Rations. A visible shortage that produces no messages means the market is not working, not that the players are quiet.

**Rollback.** The whole layer sits behind a flag. With the flag off, the captain eats nothing and capacity is unchanged, so the base game is exactly as it was.

**Iteration.** Telegraphing, so a captain can see the shortage coming two legs out rather than discovering it at Dawn.

## C2. Crew loss by name

**Plan.** Two consecutive legs on Short Rations costs a crew member, permanently, by name, and it never reverses inside a voyage. The permanence is the point. This is the emotional core of the survival edition and it should be protected in every balance pass.

**Implementation.** The crew becomes a roster of named members rather than a count, because a name going off a roster says something no number can say. That shape has to be decided now rather than later, because the boon system in F4 triggers on this event and the reveal in H9 shows it.

**Evaluation.** Crew loss is self limiting by construction, since losing a crew member reduces both consumption and working capacity, so the check is that it stays self limiting. Track losses per captain per voyage and watch for any captain reaching a spiral. The proposal puts the bankruptcy rate target under twelve percent and expects the threat of crew loss to touch around twenty percent of captains.

**Rollback.** Roster shape stays, the loss rule goes behind a flag. Removing the rule without removing the roster is the safe direction, because the roster is the durable part.

**Iteration.** Names should come from a pool that reads as people rather than identifiers, and the pool is worth a content pass of its own once the mechanic is proven.

## C3. Garments: warmth, frostbite, and durability as a multiplier

**Plan.** One data model for three jobs. Legs carry a weather tag. Warmth score is the sum across worn garments of warmth rating times durability fraction. Failing the check causes Frostbite: one crew member out of action next leg and double decay. The player never manages a durability bar, because a bar is a chore and a multiplier is a decision.

**Implementation.** Warmth ratings of one, two and three for hemp, cloth and fine silks, durability maxima of six, eight and ten, decay of one per leg, two on cold legs, two on a frostbite leg. At zero a garment becomes Rags: warmth zero, scrap value four gold, purchasable only by the Loom path. Spoilage and decay both tick inside settlement, so both must be part of the deterministic resolve step and neither may read a clock.

**Evaluation.** The delicious decision is whether to wear your profit, so measure it directly: what share of fine silks are worn rather than sold in the early legs. If nobody ever wears value, the tradeoff is not live. Frostbite count per voyage should be low but never zero.

**Rollback.** Garments are additive state. Flag off and the weather check is skipped while the items remain ordinary goods.

**Iteration.** The run of Rags is a permanent, renewing, fleet wide demand curve for the Loom path, so the second pass is about making that curve visible to both sides rather than changing the numbers.

## C4. Three foods, spoilage, and the split hold

**Plan.** Grain keeps indefinitely but is least efficient per slot, salt fish keeps six legs, produce spoils in two. Preserve converts three produce into two salt fish at a port, Quartermaster only. Cargo and Stores become separate capacities, so survival supplies can never crowd out trading capacity.

**Implementation.** The three way tradeoff is the Quartermaster's whole puzzle and it lives entirely in the item table plus the spoilage tick. The split hold changes the capacity model that the market and the board both read, so it lands before the goods expansion in G3 rather than after, or the expansion gets written against the wrong capacity model.

**Evaluation.** Watch the mix of foods actually carried. If one food dominates completely, the tradeoff is not real. Also watch whether anyone gets frozen out of the market because they are full of rations, which is the specific failure the split hold exists to prevent and should therefore never occur.

**Rollback.** The split is the riskier half, so it ships separately from the foods behind its own flag. Reverting to a single hold leaves both capacities summing to the old number.

**Iteration.** Seasonal variation in what spoils, once the base tradeoff is proven, because a fixed spoilage rate is a rule and a varying one is a reason.

# Epic D. The paths

The proposal's sharpest observation about the paths is that four of them currently share one verb, which is buy. Nobody forms an identity around an inventory category. They form it around the thing only they can do to other people. So each path in this epic is rebuilt around one verb and one ability that acts on another captain.

## D1. The path configuration module, and the naming change

**Plan.** One config record per path carrying crest, signature ability, goods, order pool, cargo modifier and Renown ceiling. Then the vocabulary change: faction becomes path everywhere, and Variable stops being a faction name, because it is the name of a mode and giving players a word for the thing they are hiding hands them a handle.

**Implementation.** The same single source of truth pattern the difficulty ladder already uses, so adding or retuning a path is one entry with no other server code to touch. The naming change is a content and interface sweep, and it is worth doing in one pass with a search that catches every surface including the glossary, because a half renamed vocabulary is worse than either name.

**Evaluation.** A throwaway script adds a sixth path in the config and confirms that no other module needed editing. That is the test of whether it is genuinely one source of truth, and it takes ten minutes.

**Rollback.** Purely additive plus a text sweep, so the revert is the text sweep. Keep the old strings in the localization file for one iteration so nothing is lost if the rename is reversed.

**Iteration.** Expose the config to the balance dashboard so tuning a cargo modifier is a data change rather than a deploy.

## D2. The nine slot order board, with the locked cards in the open

**Plan.** Six basic orders open, three pathbound orders greyed out, each stamped with the crest of the path that would unlock it and labeled in plain language. The proposal keeps this from the original design and calls it good, and it is right, because players learn the game by looking at what they cannot have yet.

**Implementation.** The board is already a known surface in the trade orders phase, so this is an extension of an existing view rather than a new one. The lock reason is computed from the path config rather than written into the card, so a retuned path cannot desynchronize from its own labels.

**Evaluation.** The measure is whether locked cards are looked at. Track open rate on locked entries against open rate on open entries, and if it is near zero the board is not teaching anything and the presentation is wrong rather than the content.

**Rollback.** Flag off and the three pathbound slots disappear, leaving the existing six.

**Iteration.** A hover state that answers "what would I have to do," which is the second half of the teaching job.

## D3. Convoy: the Escort Contract

**Plan.** Sell one leg of protection to another captain at a price you both agree. If they would take a raid, you absorb it and your cannons decide how much you actually eat. If nothing happens, you keep the fee. This is an insurance market run by a player, and both sides are guessing about the same hazard table every leg.

**Implementation.** A contract object that the published resolution order respects: contracts pay first, then escorts absorb raids. Everything offered in Parley is binding once both parties accept, so the engine enforces the contract and betrayal has to live in the gaps between contracts rather than in simple nonpayment. Cannons occupy cargo slots, which is where the structural poverty of the path comes from and where the cargo modifier belongs.

**Evaluation.** Contracts sold per leg per Convoy captain, and the ratio of fees collected to losses absorbed. A Convoy captain who sells no contracts is simply losing, and that is by design, so the number to watch is whether the path is playable at the bottom of that range or only at the top.

**Rollback.** Contracts are transient room state rather than durable, so this rolls back cleanly. Do not persist them.

**Iteration.** A visible history of paid out claims, because an insurer with a record is a different social object from an insurer without one.

## D4. Loom: the Refit

**Plan.** Restore another captain's garment durability at a port, faster and cheaper than they could manage alone. You also hold the crafting chain and the exclusive right to buy Rags at scrap and reweave them.

**Implementation.** Refit touches another captain's state, which is the first cross captain mutation in the engine, so it needs a clear rule about who authorizes it. The answer is a mutual acceptance, the same shape the escort contract uses, so the two features share one consent primitive rather than growing two.

**Evaluation.** The tension is that customers only feel their need on cold legs, so the measure is income variance by leg type. A Loom captain should be the poorest at the table on warm legs and among the richest on cold ones. If income is flat, the weather system is not reaching the path.

**Rollback.** Mutual acceptance already exists for contracts, so rollback is removing the Refit action and leaving the consent primitive in place for later use.

**Iteration.** Forecasting as a skill, which means giving the Loom path a better weather read than the table has. That is a power increase, so it waits until the pick rate gate says the path is underplayed.

## D5. Aroma: the Bazaar Rumor

**Plan.** Once every three legs, publish a rumor that shifts the next port's price band for one commodity. The fleet sees that you published and which commodity you named. Only you know whether you are long or short.

**Implementation.** The proposal calls this the best idea in the base game and the argument holds: it is a deception primitive an ordinary honest player can use, it teaches every player that public information can be weaponized, and it means a suspicious price movement is never automatic evidence of a traitor. That last property is a false positive generator for the hidden role mode, which is worth more than any dedicated traitor ability. So this ships in the base mode, not only in Ocean Gambit, and that is a deliberate call rather than an oversight.

**Evaluation.** The measure is false positives. During Gambit playtests, count how often a price move is cited as evidence against a captain and confirm that honest rumors account for a real share of those moments. If every price move is treated as a confession, the rumor is not loud enough in the interface.

**Rollback.** Rumor publication is one action on a cooldown, so it reverts by disabling the action. The band shift itself is a settlement step, so make sure it is skipped cleanly rather than left half applied.

**Iteration.** Broader commodity coverage and shorter cooldown once the base rate is understood, adjusted against the Launched guard on how swingy prices may become.

## D6. Free Captain: Opportunist

**Plan.** Once per voyage, fulfill any one pathbound order without joining that path, at a forty percent payout penalty. The locked card is tantalizing, it is reachable, and the reach costs something real. The proposal calls this the honest version of what the paywall was reaching for, and the reason it works is that the cost is zero dollars.

**Implementation.** The order board already knows which orders are locked and why, so the unlock path is a permission check with a once per voyage counter. The counter resets with the voyage, not with the round, and it lives in the same place as the other once per voyage limits so a reader can find them together.

**Evaluation.** Usage rate, and then the harder question: how often it is used on the order that would have been the best fit for an actual path. Also track the path pick rate against the fifteen to twenty two percent band, because the proposal makes that a hard requirement of the hidden role mode rather than a balance nicety.

**Rollback.** One action with one counter. Reverts completely and leaves nothing durable behind.

**Iteration.** The Factor charter in F6 turns this into three uses at a sixty percent penalty, so the counter should be a configurable number from the start rather than a literal one.

## D7. The draft, and switching

**Plan.** Deal each captain three path cards face down from a deck seeded so at least two Quartermaster cards are in circulation. Keep one, pass two to the left, keep one of the two received, pass one, discard the last. Then switching: once per voyage, at a port, legs three through nine, forfeiting unfulfilled pathbound orders and paying a Refit fee scaled to Renown, and the switch is published to the fleet log where everyone sees it.

**Implementation.** The pass direction and the deck seeding are server side, because a hand of cards is private information and the client cannot be trusted to deal it. Forty five seconds with a good interface is the target, so the interface is not an afterthought on this one. Switching needs the fee, the forfeiture, the timing window and the publication, and the publication is the real design: the price of changing your identity is that everyone knows.

**Evaluation.** The draft is working when the Quartermaster card is always physically present and taking it is a choice somebody makes rather than a duty somebody gets assigned. Measure the time to complete the draft, the share of drafts where a Quartermaster is taken, and path pick rate spread against the twelve to twenty eight percent band.

**Rollback.** Draft state is transient per voyage, so nothing durable is at risk. Keeping the previous assignment method behind the same flag gives a clean revert.

**Iteration.** Tune the deck composition separately from the pass rules, because those are two different knobs and the proposal's balance targets will move the first one repeatedly.

# Epic E. The Quartermaster slice

## E1. Seat power, seeded deck, and the Supply Barge

**Plan.** The proposal says the fix has three parts and that any one alone fails. That makes this one goal rather than three, and the reason belongs on the ticket so nobody splits it in a planning meeting. The three parts are: make the seat powerful, guarantee the card is on offer, and build the ugly fallback.

**Implementation.** The seat becomes the largest hold, the highest Renown ceiling, and the most socially loaded button in the design, presented in the interface and in the card art as power rather than chores, because every naming and art decision is a recruitment decision. The deck seeding is the draft work in D7. The Supply Barge is an anonymous vendor at every port selling rations at one hundred eighty percent of market, never more than eight per leg, and it is deterministic from port and leg so it can live in the pure engine with no new state.

**Evaluation.** The headline number is the share of lobbies that sail without the Barge, with a target above seventy percent, and the second number is Barge revenue as a share of all food spending. Those two move in opposite directions and watching them together is the whole measurement. The proposal is explicit that if the Barge share climbs you add power to the path and never a rule.

**Rollback.** The Barge is the fail safe for a lobby with no Quartermaster, so it cannot be removed while the mode is on. Reverting this goal means reverting the mode.

**Iteration.** The Barge exists so a table gets fleeced once and fights over the card next time, so the second pass is making that first experience loud rather than gentle.

# Epic F. The build layer

The proposal's engineering insight for this epic is that you must not author combinations, because hand writing every interaction grows as the square of the card count and every later card reopens the whole matrix. Tag everything, and let effects reference tags rather than items. Everything here follows from that.

## F1. The tag vocabulary, and the two tag rule

**Plan.** A closed list in one config module: cold, bulk, perishable, preserved, woven, luxury, armed, crewed, contraband, sealed, public, debt. Every good, module, boon and charter carries a small set of tags. No effect ever names an item key.

**Implementation.** The list is closed and adding a tag is a deliberate act, because every tag doubles the space balance has to cover. The two tag maximum is enforced by validation at load time rather than by review, because a rule that depends on people remembering it is not a rule.

**Evaluation.** The measure of success is that no card in the pool references an item key directly. Scan for it in the content validator rather than in a review, and fail the build.

**Rollback.** The vocabulary is inert until cards reference it, so it ships ahead of the cards with no risk.

**Iteration.** The interesting combinations are the unplanned ones, so the second pass uses the combination instrument in F7 to find which tags are actually pairing rather than which were designed to.

## F2. The card record, and the mode weighting field

**Plan.** One record shape for boons, modules and charters alike: identifier, kind, power, tags, path weight, trigger, condition, effect, mode list, and both language strings. Then the single field that gives the base mode a tighter pool and Ocean Gambit a wilder one.

**Implementation.** Path weighting is what makes an offer feel like it belongs to you without locking you out of the rest of the pool, so the three presented cards are drawn from a weighted pool rather than a filtered one. The mode list is one field and it is the cleanest available answer to the variance problem, because the base competitive mode should run lower ceilings, since there your good luck is somebody else's bad evening, while Ocean Gambit can run the wild pool, because the headline objective is shared.

**Evaluation.** Offer to pick conversion per card, with the appearance count beside it, because a card with a high win rate over nine appearances is noise and a card with a high win rate over four hundred is a problem.

**Rollback.** The pool is data, so the rollback is content rather than code. Keep both mode weightings authored from the start so switching between them is a config change.

**Iteration.** Ship the pool deliberately small at launch and widen in waves. A tight pool that is fully understood beats a wide pool that is half tested, and the tag system makes later waves cheap.

## F3. Modules in the shipyard ladder, and trading them between captains

**Plan.** Permanent, slotted into the hull, limited by ship level: three slots at level three, four at four, five at five. The shipyard ladder already exists in the tree, so this goal adds the payload rather than the ladder, which is why it is cheap.

**Implementation.** Modules are the chassis channel. The property that matters most is that modules can be traded between captains, which gives the build layer its own liquidity and gives Parley a whole class of deal that is not about commodities, with no reference price on either side. Trading a slotted module needs a rule about what happens if it is traded while equipped, and the answer should be an automatic unequip rather than a block.

**Evaluation.** Module trade volume between captains is the number, because a module that never moves is a stat rather than a decision. Also track which modules are equipped against which are traded away, since a module that is always equipped is a tax rather than a choice.

**Rollback.** Modules are durable, so the rollback concern is data: keep the table and disable equipping, rather than dropping the table and losing equipped modules.

**Iteration.** Modules that only become interesting in combination are the goal, so the second pass writes modules against tags rather than against specific situations.

## F4. Boons, their triggers, and the crew loss trigger

**Plan.** Drafted at milestone moments rather than on a timer. Permanent, not tradeable, no slot limit, individually rare, four to seven per captain per voyage. Triggers are the first pathbound order, crossing a Renown threshold, surviving a cold leg with zero frostbite, contributing to a Joint Mandate, and losing a crew member.

**Implementation.** The crew loss trigger is the one that matters most, because a captain who has just taken a permanent and irreversible loss is the one most likely to disengage from the evening entirely. Handing them a real choice at exactly that moment is the cheapest engagement save in the design, and it manufactures the comeback stories people retell. Because it fires off an event in C2, C2 should land before this.

**Evaluation.** Track how many captains who lose a crew member stay to the end, and compare that against the same figure for captains who do not. The proposal puts marooned players who stay above ninety percent and treats that as the direct measure of pillar four, and this is the same measurement applied one step earlier.

**Rollback.** Boons are additive and rare, so a content revert is clean. Any boon that grants a durable effect has to be unwound through the same normalization path the rest of the state uses.

**Iteration.** The pool should stay small at launch, and the first widening should target the paths with the lowest pick rate, because a thin path is thin partly because its offers are boring.

## F5. Public offers

**Plan.** Every offer is public. The whole fleet sees the three cards you were shown and the one you kept.

**Implementation.** This is a presentation and broadcast change more than a rules change, but it is load bearing for three separate reasons and it should be stated as such on the ticket. It ends the luck argument permanently because the table saw your menu. It teaches the entire pool by watching, which is worth more than any tutorial. And in Ocean Gambit it is evidence, because a captain who passes on a boon that would obviously advance the shared objective has told the table something without speaking.

**Evaluation.** Whether the table references each other's picks out loud. Track mentions in Parley of a specific card someone passed on. If nobody ever brings it up, the information is being broadcast and not being read, and that is an interface problem.

**Rollback.** This is the one build layer feature that must not be quietly disabled, because the hidden role mode's evidence surface depends on it. If it is turned off, the mode's mode flag goes off with it.

**Iteration.** A short history of passed cards per captain, because a single pass is a detail and a pattern of passes is a read.

## F6. Charters at leg four

**Plan.** One per voyage, chosen at leg four from three offered. A charter forks a path into a sub build, and the proposal calls it the largest decision after the draft itself, because it is where "I am playing Loom" becomes "I am playing the Rag Trade."

**Implementation.** Ten at launch, two per path, shipped as a deliberately small set. The Letter of Marque is the interesting design case, because it is the natural cover charter for a Pirate and it must be genuinely good for honest captains, or taking it becomes an accusation in itself. That is a content quality bar rather than a mechanism, so it needs to be written down and defended in review.

**Evaluation.** The charter split within a path, with an even split being fifty each and a gate above twenty percent deviation. Also watch whether the cover charters are taken at the same rate by honest players as by traitors, because a charter that only traitors take has stopped being cover.

**Rollback.** A charter is a modifier set on the captain for the voyage, so it reverts with the pool.

**Iteration.** The second wave should add charters that interact with tags rather than with named situations, for the same reason the boons do.

## F7. The power budget, and the combination instrument

**Plan.** Every card carries a power budget and a captain's total is capped. Combinations may exceed the sum of their parts, which is the entire point, but the floor stays controlled. Then the empirical half, because with forty boons, twenty modules and ten charters the pair matrix is far past what anyone can hand test.

**Implementation.** Instrument win rate by combination, automatically flag any pair appearing in more than a threshold share of wins, and run a nightly simulation. The proposal's rule is to find broken pairs empirically and never by reasoning, and the balance target is that any two card combination stays under sixty two percent win rate once it has at least forty recorded appearances.

**Evaluation.** The instrument is the evaluation. Its health check is that it fires on a deliberately planted overpowered pair during development, because a detector that has never fired is a detector nobody has tested.

**Rollback.** The budget cap is a validation constant, so raising it is the rollback and it needs no migration.

**Iteration.** A simulation harness that plays both sides without humans, so the nightly run does not need a lobby.

# Epic G. The market

The proposal's argument here is the one worth keeping on the wall: variety and liquidity pull in opposite directions, and you cannot fix a stalling market by adding more things to trade. Liquidity is a property of exits, not of inventory. Every good must have at least three exits, and that rule is enforced by the build rather than by discipline.

## G1. The Bourse

**Plan.** A standing offer board at every port. Post "buying six salt fish at nine gold" and it fills automatically whenever any captain accepts, this leg or in leg nine. The proposal calls it the single largest fix on the list, and the reasoning is that in a game whose trade window is one hundred and ten seconds, the requirement to find somebody who wants your thing at the same moment you want to sell it was doing enormous invisible damage.

**Implementation.** This one cannot be client held, because an offer posted in leg two must still be honorable in leg nine when the poster may have closed the tab. So the offer book is server state, and the trade it produces is still validated by the pure engine through the existing save path. That makes this goal the first place in the plan where the server holds game state rather than merely relaying it, and it deserves a written note about what else may move into that category later.

**Evaluation.** The share of offers that fill before expiry, with a target above sixty percent, and that is the most direct measure of liquidity the project will have. Also track the time to first trade per captain, because the first offer posted is the hardest one.

**Rollback.** The offer book is durable, so the rollback is to stop accepting new offers while still honoring and expiring the outstanding ones. Never drop the table while offers are live.

**Iteration.** Partial fills and negotiated counter offers, once the base fill rate is known, because a board that only fills in whole is a board that turns down good trades.

## G2. The two safety valves: the Chandler and Bales

**Plan.** The Chandler buys any good at forty percent of base at every port. Never a good deal, always an exit, and every price therefore gains a hard floor underneath it, which stops the collapse spiral before it starts. Bales compress five units of one raw material into three slots and trade as a single object, which pushes structurally toward specialization rather than treating fragmentation as a symptom.

**Implementation.** Both are pure functions of the item table, so both live in the engine and neither needs new state. The Bale needs a decision about whether a Bale can be split again, and the answer should be yes at a port at no cost, because a compression the player cannot undo is a trap rather than a choice.

**Evaluation.** Chandler sales as a share of all sales is the dead inventory gauge, and a high number means goods are being dumped rather than traded. Bale usage is the specialization measure, and the proposal's target is that more than sixty percent of distinct goods get traded in a given voyage, because goods that never move are inventory rather than content.

**Rollback.** Both are pure functions with no durable footprint, so both revert cleanly.

**Iteration.** The Chandler rate is a tuning knob and it should be a config value from day one, because it sets the floor under the entire economy.

## G3. The goods expansion along axes

**Plan.** From fifteen goods to roughly thirty two, fourteen raw and eighteen finished, added along four axes: density, perishability, tier, and tags. Not a flat list.

**Implementation.** One data model doing three jobs, because the tag vocabulary the goods need is the same one the cards need: the goods expansion and the build layer have to be built together or the project ends up with two vocabularies. The exits field on every good is part of the record from the first entry, even before the validator in G4 exists.

**Evaluation.** Every new good must move. Track distinct goods traded per voyage and treat any good that never moves across a large sample as a content defect rather than a balance problem.

**Rollback.** The expansion is content, so the rollback is a smaller pool. The risk is not the rollback, it is that the pool is too wide to read, which G4 addresses.

**Iteration.** Add along the axes where the existing pool is thin, and let the tags tell you where that is rather than intuition.

## G4. The exits validator, and the board readability pass

**Plan.** Two halves of one goal. The exits field is not decoration: a good with fewer than three exits is a content defect and the build fails on it, which enforces the liquidity requirement automatically and forever without anyone having to remember it during a content pass. Then the interface half, because thirty two goods across six captains inside a seventy five second phase is a genuine information design problem and the proposal names it as the place where this design is most likely to fail.

**Implementation.** The validator is the cheapest high value rule in the whole document, so it goes in early rather than with the content it polices. The readability work is a real budget line: filtering, sorting on exits, and a "what can I do with this" affordance on every stack in the hold.

**Evaluation.** Usability failures inside a timed phase read to players as the game cheating, which is far worse than a balance miss, so this needs a measured check rather than an opinion. Track phase overruns in Market where the captain had goods they never acted on, and run a timed reading test with a new player before calling it done.

**Rollback.** The validator can be downgraded from an error to a warning without touching the content, which is the right first response if it starts blocking work.

**Iteration.** The affordance should learn from usage, showing the exits that this captain has actually used before, because a list of three exits that includes two impossible ones is noise.

# Epic H. Ocean Gambit

This is the epic where the plan can lose the project, and the loss would be permanent, because one leaked alignment field makes the mode worthless overnight and the exploit spreads faster than a fix. Everything in this epic is therefore ordered so that the private information spine lands first and is tested to death before a single role exists.

## H1. The private information spine

**Plan.** Alignment is assigned server side from a value that never reaches any client, delivered only through the private log channel, and included in no broadcast payload under any circumstance. This goal has no gameplay in it. It is the foundation under every other goal in this epic and it ships alone so that it can be reviewed alone.

**Implementation.** This is the one place the engine contract changes. The engine is currently deterministic by composition, seeded from values the client knows, which is what lets the server stay out of the simulation. Hidden roles cannot use that seed. So the alignment seed is generated on the server, held only there, and its output is written into the private payload for exactly one captain. Every wire shape lives in `src/types/realtime.ts`, and there is exactly one shape that can carry an alignment.

**Evaluation.** An adversarial test suite, not a happy path test: two authenticated clients, a full voyage, and an assertion that neither client's received frames contain any field naming the other's alignment. Then a manual review of every broadcast site in the realtime layer. Then a red team pass whose only job is to get an alignment out of a client.

**Rollback.** Not rollbackable and not meant to be. A failure here is a severity one defect, and the correct response is to turn the mode off rather than to patch quickly.

**Iteration.** Once the spine is proven, the same pattern becomes the home for every future secret, so it should be written as a general mechanism rather than as a role specific special case.

## H2. The mode frame: the host toggle and the objective deck

**Plan.** A toggle the host sets, visible to everyone before the draft, because players must always know which game they are playing. One public objective drawn before the voyage and shown to everyone, which mechanically is the existing Joint Mandate system wearing a new hat.

**Implementation.** The Joint Mandate primitive already exists, so the objective deck is a content surface over an existing mechanism rather than a new system. The writing rule for the deck is the part that needs discipline: an objective each captain can satisfy alone produces no conversation and gives the traitor nothing to sabotage, so treat "could six people do this without talking" as an automatic reject.

**Evaluation.** Objectives are working when the fleet has to look at each other's inventories and negotiate. Measure message volume in the legs where the objective is close to met against the baseline, and retire any objective that does not move it.

**Rollback.** The toggle is a lobby setting, so it reverts to the ordinary room. With the toggle off the objective deck is simply unused.

**Iteration.** Objectives at several difficulty rungs, because the proposal's balance pass will want to tune pirate win rate partly through objective difficulty rather than through the pirate.

## H3. Private cards, and the role counts

**Plan.** Each captain draws one private card, visible only to them. Most are Honest: the public objective plus a personal flourish. A minority are Variable. Counts by table size: four or five captains yields one Variable, six yields two. At six, if both are Pirates they know each other, and a Broker always sails alone.

**Implementation.** The asymmetry is deliberate and it should be preserved rather than smoothed: Pirates get the comfort and the coordination problems of a team, and the Broker gets the loneliest seat at the table. Every card goes out through the private channel only, which is the spine from H1. The flourish is drawn to match the objective's shape, so the two are authored together rather than independently.

**Evaluation.** Honest side win rate in the fifty two to fifty eight percent band, because deduction should slightly favor the majority. If it is outside that band, the fix is the flourish pool rather than the roles.

**Rollback.** All of this is per voyage state. Reverting means turning the mode toggle off.

**Iteration.** More flourish shapes, because the flourish is what makes an Honest card feel personal rather than like a participation certificate.

## H4. The Broker, and peer trade profit

**Plan.** The Broker wins by realizing a target payout, roughly two thousand two hundred gold, in profit earned specifically from trades with other captains and never from port sales. The critical property is that the Broker can win at the same time as the honest fleet. The Broker is greedy, not hostile, and if everyone succeeds together the Broker is delighted.

**Implementation.** The proposal is blunt that this distinction has to be tracked from leg one and must be instrumented early rather than reconstructed later, so `peer_trade_profit` is a durable captain field, normalized on load, and registered with the Ledger Integrity Pass on the day it is introduced. Every captain to captain trade already flows through a known settlement path, which is where the accumulation belongs.

**Evaluation.** Broker win rate in the thirty five to forty five percent band, and higher is fine because the Broker can win alongside the fleet. The design measurement is ambiguity: count how often a suspicious trader is correctly read as a Broker rather than as a Pirate, because that ambiguity is the product.

**Rollback.** Peer trade profit is a new persisted field, so the rollback is to stop evaluating it while leaving it accumulating. Never drop the column while voyages are live.

**Iteration.** The payout target is the tuning knob for the whole role, so it should be a config value and it should move before anything else does.

## H5. The Pirate, rewritten

**Plan.** The Pirate wins when the public objective fails and they personally end the voyage solvent and above a Renown floor. Solvency is a victory condition, so the Pirate cannot hide and destroy: they must run a functioning trading operation while sabotaging, which puts them in the market, in Parley, making deals, and exposed. A traitor who must participate is a traitor who can be caught, which is the only kind worth playing against.

**Implementation.** The rewrite fixes four things at once. It forces participation. It makes sabotage structural rather than personal, because the Pirate attacks the shared objective rather than a human being, and nobody logs off because the fleet missed a quota while people absolutely log off because one player spent forty minutes hunting them. It scales, because breaking an objective is roughly equally hard at four, five and six. And it produces the endgame where two Pirates who must both stay solvent suddenly compete for the same cargo once the objective is doomed.

**Evaluation.** Pirate win rate in the twenty to twenty six percent band, and separately, a check that the win condition does not swing with table size. The larger measurement is the one the proposal cares about most: whether anyone experiences the mode as griefing. Track it by asking, because no counter catches it.

**Rollback.** Alignment evaluation is one function, so the rollback is the mode toggle.

**Iteration.** Misdirection tools rather than hostile buttons, because the best traitor abilities are ordinary actions used dishonestly, and ordinary actions leave the same trace whether or not the person was lying.

## H6. The Manifest Audit

**Plan.** From leg five, once per voyage, a simple majority may vote during Parley to audit one captain. The audit reveals two of that captain's last five order fulfillments, chosen at random, plus their current Larder. It never reveals the card, the gold, or the full hold.

**Implementation.** Probabilistic evidence, not certainty, and it is deliberately the Werewolf seer without the seer's game ending power: two random fulfillments out of five means an innocent can look terrible by chance and a guilty captain can come up clean, which keeps the table arguing about interpretation rather than accepting a verdict. It also costs something real, because running it consumes the Parley phase for that leg, so the fleet pays a full leg of commerce for a partial answer. The phase skip has to be registered with the checkpoint protocol or the room waits forever.

**Evaluation.** Audit usage and audit accuracy tracked together, and the balance is wrong if accuracy is very high, because an audit that usually finds the traitor is a verdict rather than a signal. The proposal's balance targets put the honest side win rate slightly above even, and the audit is one of the two knobs that moves it.

**Rollback.** One vote and one reveal, both transient. Reverting is clean, but reverting removes the honest fleet's only evidence tool, so the mode should go off with it.

**Iteration.** The number of revealed fulfillments is the tuning knob, and it should be a config value because two out of five and three out of five are entirely different games.

## H7. Maroon, the Harbormaster, and bankruptcy without elimination

**Plan.** From leg nine, a two thirds majority may maroon one captain. A marooned captain is not eliminated: they lose ship and cargo, keep half their gold, and each remaining leg may shift one port's price band by ten percent in either direction, publicly. The proposal says it would defend this hardest in a design review, because it is the one mechanic that decides whether people play a second session the same night.

**Implementation.** This goal also carries the change the proposal could not see from outside the tree: bankruptcy is currently a terminal phase, and pillar four forbids dead seats, so both bankruptcy and marooning have to become non terminal states. That reaches the phase union and the conclusion handler, and it has to be reconciled with the Ledger Integrity Pass, which currently lets an impossible captain finish the voyage while banking nothing. Half gold, the ship, the cargo and the price power are all new durable fields and all of them need normalization and an Integrity Pass entry.

**Evaluation.** The proposal names the single most important number in the mode: the share of marooned players who stay connected to the end, targeted above ninety percent. That is the direct measure of pillar four and nothing else measures it. A wrongly marooned honest captain should also still be visibly helping, which is a softer check but a real one.

**Rollback.** Marooning can be disabled without touching bankruptcy, and the two should ship behind separate flags even though they share a goal, because they carry different risks.

**Iteration.** The Harbormaster power set should grow slowly and carefully. One power that is always available is the design, and a second power would need to earn its place against the same measurement.

## H8. The reveal, and the replay ledger

**Plan.** At the end of leg twelve all cards flip at once, with ceremony. Thirty seconds of animation, not rushed, because the reveal is the payoff for the entire hour and the moment the story of the evening gets written. Multiple winners are fine and should be common. Then, immediately, the replay ledger: every captain's actual trades on a timeline with the traitors highlighted.

**Implementation.** The proposal is explicit that the post game is not an epilogue but a feature, and that it deserves real engineering time. Most of what the ledger needs already exists, because the engine's log array has been recording the whole voyage in order. What this goal adds is the presentation and the alignment overlay, which must come from the server after the voyage ends rather than being derived on the client, because the client never had it.

**Evaluation.** Whether the table shouts. The measurable proxy is second session rate on the same evening, which the proposal calls the best single proxy for whether the game is actually fun. A reveal that produces thirty seconds of silence is a failed feature, and there is no counter that catches that either.

**Rollback.** The reveal is the last thing in the voyage, so it can be simplified to a plain summary without affecting anything upstream.

**Iteration.** A post game screen that celebrates good play by everyone, including the traitors, because framing the reveal as a shared story rather than a verdict does far more work than it looks like it should.

## H9. The unlock code

**Plan.** A code the host enters, which unlocks the table. Never per account, because if one player has it and another does not, the first question at every table becomes an administrative check, and you have taxed the social experience to protect a feature that costs nothing to give away.

**Implementation.** Seed it in the world rather than only on a forum: a line that appears in a voyage log after ten completed voyages, a string on a page of the manual, a phrase a port merchant says once. Discovery should feel earned by playing and then spread by word of mouth, which is the distribution that costs nothing and converts best.

**Evaluation.** Track code entry rate and the number of tables it unlocks, but the real measure is whether anyone ever says where they heard it, because that is the word of mouth working.

**Rollback.** One host setting. Reverts completely.

**Iteration.** More than one code, with each unlocking a variant rather than a different mode, so the secret keeps paying off without splitting the player base.

# Epic I. Telemetry and gates

The proposal says retrofitting telemetry is how projects end up guessing, and that every number in its balance section is a launch gate rather than a nice target. That makes this epic a deliverable with its own goals rather than a chore attached to others.

## I1. The telemetry spine

**Plan.** Instrument from the first playable build of Epic C, not from Epic I, which means the spine is written before the first system it measures. Everything is a typed event with a version, a voyage identifier, and a leg number.

**Implementation.** Seven families from the proposal: the loop, covering time to first trade, trades per leg and orders that expired unfulfilled; the paths, covering pick rate, switch rate and the leg it happens on, signature use, and Opportunist use; the build layer, covering offer to pick conversion, per card rates with appearance counts, per pair rates with appearance counts, charter split, module trade volume, and the correlation between a captain's first boon and their final placing; the market, covering offers posted, filled and expired, median hold utilization, Chandler share, distinct goods traded and Bale usage; the survival layer, covering Short Rations legs, crew losses, frostbite, and Barge revenue as a share of all food spending; the social layer, covering messages per captain per leg, Audit and Maroon usage and accuracy, and the share of marooned players who stay to the end; and the business, covering lobby fill time by table size, abandon rate by leg, day one and day seven return, and second session rate on the evening.

**Evaluation.** The spine is done when a full voyage produces a complete record with no gaps, and when a deliberately broken voyage, meaning one that abandons mid leg, produces a record that explains where it stopped.

**Rollback.** Telemetry is always on and additive. The rollback concern is volume, so sample rates belong in configuration from the first day rather than being bolted on.

**Iteration.** Sampling by table size, because the six player case is the expensive one and the four player case is the common one.

## I2. The two measurements most likely to be skipped

**Plan.** Peer trade profit and maroon retention are both named in the proposal as things that must be tracked from the start or cannot be reconstructed later, and both are easy to defer because neither shows up in the first playable build. This goal exists so that deferring them has to be a decision rather than an oversight.

**Implementation.** Peer trade profit accumulates from leg one of every voyage because the Broker's win condition reads it. Maroon retention cannot be measured until Epic H is playable, but the connection lifetime it needs is available from Epic B, so the raw signal starts there.

**Evaluation.** Both fields appear in the very first voyage record that contains their prerequisite feature, with no backfill and no nulls.

**Rollback.** Neither can be rolled back meaningfully, which is the reason they get their own goal.

**Iteration.** Move peer trade profit from a per voyage accumulator to a per trade ledger entry if the balance pass needs to see which trades were the profitable ones.

## I3. The dashboard, and the front page number

**Plan.** One page that answers whether the mode is healthy, with the Barge revenue share on the front page, because the proposal identifies it as the early warning for the Quartermaster seat going wrong and the correct response is to add power to the path and never to add a rule.

**Implementation.** The dashboard reads the spine rather than the database directly, so it stays cheap and it cannot slow a live voyage.

**Evaluation.** Whoever is on balance duty should be able to answer three questions in under a minute: is the Quartermaster seat healthy, is anything becoming a staple, and is the variance too swingy. If the page cannot answer those, it is a data dump rather than a dashboard.

**Rollback.** Read only and off the critical path.

**Iteration.** Alerts rather than charts for the three gates most likely to break, because nobody watches a dashboard during a busy week.

## I4. The launch gates, and the three hundred voyage run

**Plan.** Every number in the proposal's balance section is a gate rather than a target: the mode does not ship until the number is in band across at least three hundred recorded voyages. This goal is the run itself, plus the process for deciding what to change when a number is out of band.

**Implementation.** The gates are path pick rate between twelve and twenty eight percent, Quartermaster fill above seventy percent, Free Captain pick rate between fifteen and twenty two percent, honest side win rate between fifty two and fifty eight, Pirate win rate between twenty and twenty six, Broker win rate between thirty five and forty five, no single card in more than thirty five percent of winning builds, no two card pairing above sixty two percent over forty appearances, charter split above twenty percent deviation, Bourse fills above sixty percent, median hold utilization between fifty five and eighty percent, distinct goods traded above sixty percent, bankruptcy under twelve percent, marooned players staying above ninety percent, Parley participation above sixty six percent, and session length between sixty two and seventy four minutes at five captains.

**Evaluation.** The tie break rule when two gates conflict is worth writing down before the run starts, because during the run there will be pressure to trade one against another. The Free Captain pick rate wins, because the proposal makes it a hard requirement of the hidden role mode rather than a balance nicety.

**Rollback.** If a gate cannot be met after the run, the mode does not ship. That is the rollback, and it should be stated as a real outcome rather than a threat.

**Iteration.** Re run after every change that moves a system rather than a number, because a pool expansion invalidates the previous run.

## I5. Session length, and table size

**Plan.** Six captains is the ceiling and five is the tune target, and four has to be genuinely good rather than a degraded mode. If the session runs long, shorten the voyage before shortening the phases, because the phases are where the conversation lives.

**Implementation.** The voyage length ladder already exists in the difficulty configuration and the proposal recommends keeping it for the base game while restricting Ocean Gambit to twelve legs, because eight is too short for deduction to develop and sixteen is too long to hold the tension. That makes the mode's length a config restriction rather than a new system.

**Evaluation.** Session length between sixty two and seventy four minutes at five captains from lobby to reveal, and a separate check that four captains is fun rather than merely functional. Lobby fill time by table size tells you whether six is worth supporting at all.

**Rollback.** Length is configuration, so it reverts.

**Iteration.** A four captain tuning pass after the five captain gates pass, not before, because tuning both at once produces numbers that describe neither.

# Epic J. Trust and polish

## J1. The private information security review, and the closed test

**Plan.** The proposal asks for a dedicated security review of the private information paths before the mode meets the public, in the same spirit as the hardening pass the current tree already went through, and it pairs that with a thirty player closed test. Both are the same goal because both are about who sees what before strangers arrive.

**Implementation.** The review's scope is every site that builds a broadcast payload, every site that writes to the log array, and the save path that trusts a client. The closed test runs on a separate database from anything with real accounts, which is the same discipline the smoke test already follows, because it refuses to run when it is pointed at a different database than the server it tests.

**Evaluation.** The review produces findings with severity, and the severity one bar is that no alignment field can reach the wrong client. The closed test produces the first real telemetry from players who are not the authors, which is also the first honest read on the usability risk in G4.

**Rollback.** Not applicable. The review is a gate rather than a feature.

**Iteration.** Repeat the review whenever a new private channel or a new persisted secret is added, and write that rule into the implementation guide so nobody has to remember it.

## J2. Mute and report

**Plan.** Parley is designed to make people talk, and a mode that makes people talk more will make some people talk worse. The text sanitizer and the rate limits carry over from the hardened tree. What does not exist yet is a mute and a report, and those are required before the mode meets strangers rather than friends.

**Implementation.** Both are small and both belong in the existing moderation surface rather than in a new one. A mute has to be per captain and per voyage, and it must not reveal that the muted captain has been muted to anyone else, because in a deduction game a visible mute is information.

**Evaluation.** Report volume, mute volume, and whether a muted captain still can complete their objectives, because a mute that breaks a game is worse than the thing it prevents.

**Rollback.** Both are additive and both revert cleanly.

**Iteration.** A review queue, once there is any volume to review.

## J3. The bilingual content pass

**Plan.** The whole card pool in two languages, and the proposal warns that five order pools plus two decks is several hundred strings multiplied by two, which is the most commonly underestimated line in the plan. It also asks who writes the second language, and says to decide now.

**Implementation.** The card record in F2 carries both strings from the beginning, so this goal is a translation pass rather than a structural change, and the decision about who writes it should be made before the pool is authored rather than after.

**Evaluation.** No string exists in only one language in the shipped pool, enforced by the content validator rather than by review. If the owner writes both languages personally, the proposal says to budget four weeks here rather than two.

**Rollback.** Content, so a partial revert is a smaller pool.

**Iteration.** Translation quality review by a native speaker on the highest traffic strings first, which are the phase names and the objective deck rather than the rare cards.

## J4. The review and the polish wave

**Plan.** A deliberate polish iteration that is not attached to any feature, because the proposal's own risk register names the board becoming unreadable as the most likely failure and usability work does not fit inside a feature ticket.

**Implementation.** Scope is set from the closed test's telemetry rather than from a list, which is the only way to spend this time well.

**Evaluation.** The readability checks from G4 re run against a new player, plus the phase overrun count in Market and Orders.

**Rollback.** Interface only, so reverts are local.

**Iteration.** One polish wave per shipped wave of content, not one at the end.

# Epic K. Money, later

## K1. The decision record

**Plan.** Charge nothing for version one and ship it that way, then revisit money after fifty recorded voyages. The proposal frames this as the decision that unblocks the conversation with the friend who proposed the unlock store, and it is right that the argument should be reframed from a values question into a sequencing question.

**Implementation.** Nothing to build. The deliverable is the decision written down with its trigger, so it cannot be quietly reopened during a slow month.

**Evaluation.** The fifty voyage count, from the telemetry spine in I1.

**Rollback.** Not applicable.

**Iteration.** Revisit at the trigger with real retention numbers rather than with opinions.

## K2. Host unlock

**Plan.** If something is sold, it is sold so that one purchase covers the whole table. The proposal's reasoning is that party games converged on this model because it converts better than per seat pricing, since the buyer is purchasing an evening with friends rather than a card, it creates evangelists rather than gatekeepers, and it keeps every table's rules identical.

**Implementation.** A host owned entitlement that applies to the room rather than to accounts. That shape also happens to be the same shape as the mode toggle in H2, so it should reuse that setting surface rather than growing a second one.

**Evaluation.** Conversion against the per seat alternative is untestable without shipping both, so the honest evaluation is the table equality check: no table should ever be able to tell that one player paid and another did not.

**Rollback.** An entitlement is durable, so the rollback has to grant rather than revoke, which means the safe direction is to over grant while a problem is investigated.

**Iteration.** Whatever the store becomes, it must never sell a card, an order, or a path. The acceptable shape, if paid cards are ever revisited, is that every card is reachable free by play and money only buys cosmetic variants of cards the player already owns.

## K3. Cosmetics and the seasonal log

**Plan.** Hull paint, sail sigils, port banners, captain portraits, log stationery, and a named ship on the leaderboard. Zero competitive effect, and in a game where six people stare at each other's fleets for an hour, cosmetics have unusually high visibility and therefore unusually good conversion. Priced between two and ten dollars.

**Implementation.** Cosmetics attach to the ship and to the log, both of which already exist as surfaces. The seasonal log is a reward track earned by play and purchasable to accelerate, and it never contains a card, an order, or a path, because the moment it does, the table's possibility spaces diverge again.

**Evaluation.** Share of players with at least one cosmetic equipped, and the share of tables where every captain has one, because the second number is the one that measures social visibility rather than individual purchase.

**Rollback.** Cosmetics are durable and additive, so reverting means disabling new purchases rather than removing what people own.

**Iteration.** Cosmetic waves tied to content waves, so the art pipeline and the content pipeline stay in step.

# What I would cut if the schedule slips

Stated in advance, because this list is much easier to write now than in the week it is needed.

**Cut first: the second language.** It is the most expensive line per unit of fun, and it can be added after the mode is proven without touching a single rule.

**Cut second: the goods expansion.** Thirty two goods is a want and fifteen is a working number. The exits validator and the Chandler matter far more than the count, and both survive the cut.

**Cut third: the Bourse.** This one hurts, because the proposal calls it the largest single fix, but a working trade window with a bad liquidity problem is still a playable game, and an unfinished offer book is not.

**Do not cut: the Supply Barge, the private information spine, the no elimination rule, or the telemetry spine.** Each of the four is load bearing for a property the mode cannot recover if it ships without it. A mode that ships without the Barge is a mode whose Quartermaster seat collapses. A mode that ships without the spine is a mode that gets ruined in a week. A mode that ships with elimination breaks pillar four. A mode that ships without telemetry cannot be tuned and will be guessed at instead.

**Never cut: honesty about the gates.** If a number is out of band after the run, the answer is that the mode does not ship yet, and that answer has to be available.

# The three things this plan needs from the owner

**One. The scope decision on money.** Free for version one, revisited after fifty recorded voyages. It unblocks the conversation with the friend whose proposal it is, and it moves that conversation from values to sequencing.

**Two. The second language.** Who writes it, decided now rather than at the translation pass, because it changes the size of Epic J and the shape of every card record.

**Three. The tie break rule for conflicting gates.** The Free Captain pick rate wins, because the proposal makes it a hard requirement of the hidden role mode rather than a balance nicety, and a rule agreed now is a rule that will actually be used later.

# Closing

The proposal's own summary of its argument is the best summary of this plan's ordering, so it belongs here. Everywhere the design used a rule to make something happen, the proposal replaced it with a reason. The mandatory Quartermaster became an attractive seat plus an ugly alternative. The trapped Quartermaster became a state they can fix. The Pirate who must destroy became a Pirate who must participate. The card behind a paywall became a card behind a decision.

That translation is also what makes the plan work as a backlog. A rule is one big piece of work that either exists or does not. A reason is a system that can be built in pieces, each one playable, each one measurable, and each one safe to abandon. The forty nine goals above are that translation taken one level down, from design intent into shippable increments.
