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

**Implementation.** The Joint Mandate primitive already exists, so the objective deck is a content surface over an existing mechanism rather than a new system. The writing rule for the deck is the part that needs discipline: an objective each captain can satisfy alone produces no conversation and gives the traitor nothing to sabotage, so treat "could six people do this without talking" as an automatic reject. The other half of a captain knowing which game they are in is the round itself, and that now lives in the same record: `src/lib/game/mode.ts` briefs each mode on the Welcome screen, a line for Classic and a chart of the mode's own legs for Gambit, drawn by `src/components/portmasters/game/RoundFlow.tsx`, with the smoke suite holding the chart to the mode's lap and holding both briefings to the order the modes disagree about.

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

**Implementation.** The rewrite fixes four things at once. It forces participation. It makes sabotage structural rather than personal, because the Pirate attacks the shared objective rather than a human being, and nobody logs off because the fleet missed a quota while people absolutely log off because one player spent forty minutes hunting them. It scales, because breaking an objective is roughly equally hard at four, five and six, which the quota rung below makes true rather than assumed. And it produces the endgame where two Pirates who must both stay solvent suddenly compete for the same cargo once the objective is doomed.

**Evaluation.** Pirate win rate in the twenty to twenty six percent band, and separately, a check that the win condition does not swing with table size. The swing question is a query now rather than a hunch, because H4 began recording the alignment, the verdict and the size of the table each voyage was dealt to: `src/lib/game/balance.ts` groups those rows into a role by table size grid and judges each cell against the three targets, `npm run report:bands` prints it over the live chronicle, and a band nobody has played reads as unknown rather than as a rate of zero. The rung the mode ships with is the deck's own, since the targets cannot honestly be stated for the mode at all while the board is the same size at four seats as at six: `SEAT_BANDS` in `src/lib/game/objectives.ts` asks a fleet of five for a quarter again as much of every good and a fleet of six or more for half again, sized per good and rounded up, so the swing across table sizes is answered by the board rather than by the roles. The larger measurement is the one the proposal cares about most: whether anyone experiences the mode as griefing. Track it by asking, because no counter catches it.

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

**Implementation.** This goal also carries the change the proposal could not see from outside the tree: bankruptcy is currently a terminal phase, and pillar four forbids dead seats, so both bankruptcy and marooning have to become non terminal states. That reaches the phase union and the conclusion handler, and it has to be reconciled with the Ledger Integrity Pass, which currently lets an impossible captain finish the voyage while banking nothing. Half gold, the ship, the cargo and the price power are all new durable fields and all of them need normalization and an Integrity Pass entry. As built, the terminal question was answered per mode rather than globally: `bankruptcyIsFinal` on the mode record in `src/lib/game/mode.ts` is true for Classic, which keeps the ending it has always had, and false for Ocean Gambit, where the same failed settlement writes a durable mark and leaves the captain sailing to the endgame screen with it. The two thirds threshold and the half of the purse are pure arithmetic in `src/lib/game/maroon.ts` so they can be tested without a socket, the seat that fails is `src/lib/game/engine/seats.ts`, which is the one place either way of failing a voyage is applied, and the vote, the room's record of it and the Harbormaster's hand are `src/server/realtime/maroon.ts`. The hand is delivered rather than applied where it is called: the server holds the last call for the leg it was made in and hands it to the market that opens after that leg, on the same advance that carries the Harbor Pulse, so a call made in the closing leg is refused instead of leaning a market that never opens. The smoke suite holds the arithmetic, the wire and the delivery, including the one check that matters most to the pillar: the leg after a maroon waits on the captain the harbor has just voted ashore.

**Evaluation.** The proposal names the single most important number in the mode: the share of marooned players who stay connected to the end, targeted above ninety percent. That is the direct measure of pillar four and nothing else measures it. A wrongly marooned honest captain should also still be visibly helping, which is a softer check but a real one. When the mode shipped, nothing computed that figure, because it belonged to the telemetry spine in Epic I, and what shipped with the mode was the raw signal the spine would read: a marooned captain's connection lifetime, which Epic B already records. The spine has since landed in I1, and the mark the figure needed in I2: it is now one pass over a stored record's captain lines rather than a computation living anywhere, because a marooned captain was named by a carried vote and that mark rides their own line beside whether they were still standing when the voyage closed, which is presence at the close rather than the length of one connection. The softer check that follows from it is the one the record cannot settle on its own either: whether a wrongly marooned honest captain was still visibly helping is read off their play, and the record holds the abandonment and the end of the voyage but nothing about what they did with the legs between.

**Rollback.** Marooning can be disabled without touching bankruptcy, and the two should ship behind separate flags even though they share a goal, because they carry different risks. As built, both are fields on the mode record rather than lobby switches: `maroonFrom` is null for Classic, which is what makes the vote and the hand invisible and refused there, and `bankruptcyIsFinal` is the insolvency switch on its own, so a mode can keep a failed seat in the voyage without ever putting anyone ashore.

**Iteration.** The Harbormaster power set should grow slowly and carefully. One power that is always available is the design, and a second power would need to earn its place against the same measurement.

## H8. The reveal, and the replay ledger

**Plan.** At the end of leg twelve all cards flip at once, with ceremony. Thirty seconds of animation, not rushed, because the reveal is the payoff for the entire hour and the moment the story of the evening gets written. Multiple winners are fine and should be common. Then, immediately, the replay ledger: every captain's actual trades on a timeline with the traitors highlighted.

**Implementation.** The proposal is explicit that the post game is not an epilogue but a feature, and that it deserves real engineering time. Most of what the ledger needs already exists, because the engine's log array has been recording the whole voyage in order. What this goal adds is the presentation and the alignment overlay, which must come from the server after the voyage ends rather than being derived on the client, because the client never had it. As built, the ledger does not read the log array, and the reason is durability: the log lives in one client's session and is never sent anywhere, so a server that built the ledger out of it would be replaying a chapter it never had. It is reconstructed at the conclusion instead, out of the three records a finished voyage does leave behind. The fleet's curve is `fleetTrace` in `src/lib/game/objectives.ts`, which merges one number seen by several captains into the number the fleet actually moved by (the highest report per good, leg by leg), so a captain who never reported a leg cannot drag the curve back and a captain who inflated one cannot lift it. The delivered figures are the captain's own `objectiveDelivered` read back through the ending, which is what the verdict was already decided from, so the card and the ledger cannot disagree about the same voyage. The trade lines are the `orderFills` a client still held when the voyage ended, the same five item window the Manifest Audit reads, which makes a trade the harbor was shown mid voyage and the same trade on the ledger one sentence rather than two. The frame is built once in `src/server/realtime/conclusion.ts`, out of the verdicts that conclusion has already decided rather than a second reading of them, and sent to the room after the standings rather than with them, because a captain is owed the result first and the story second. It is kept in `src/server/realtime/reveal.ts` for the captain who reloads onto a finished table, who is handed the whole hand again on joining, and cleared on restart in both the map and the client, so a new voyage cannot inherit the last table's cards. The ceremony carries one deliberate divergence from the plan: the cards turn one at a time on a beat rather than all at once, because a table reading five cards in one frame reads none of them, and the plan's thirty seconds of animation is that beat, with a control that ends it early for a table that would rather read the ledger. A forged finish is printed as a card whose books could not be read, and its claimed contribution and claimed trade profit are withheld from the frame rather than shown and doubted, since there is nobody left in the voyage to check them. The presentation is `src/components/portmasters/game/RevealPanel.tsx`, mounted by the endgame screen, drawing each card's promise through the same two functions the private card used all voyage. The smoke suite holds the wire and the rule: five captains (one honest with a flourish, one pirate, one broker, one who took a berth after the hand was drawn, and one whose books were forged), the frame every seat at the table receives, the order the standings put the cards in, the marooned seat that is recorded ashore and still absent from the ledger, the curve the fleet actually moved by, and the reload that is handed the same hand again. That fixture also caught a defect that predates this goal: `maybeConcludeVoyage` checked whether a voyage had already been concluded at its door, then read the roster across an await, so two finish reports landing in the same tick both passed the check and concluded one voyage twice, which wrote two chronicles, banked a second crown's worth of Renown, recorded every rival row twice and sent the whole room two copies of every frame the conclusion ends with. The claim is now taken again immediately before it is made, with nothing yielding in between, so the captain who loses the race reads the set and leaves.

**Evaluation.** Whether the table shouts. The measurable proxy is second session rate on the same evening, which the proposal calls the best single proxy for whether the game is actually fun. A reveal that produces thirty seconds of silence is a failed feature, and there is no counter that catches that either.

**Rollback.** The reveal is the last thing in the voyage, so it can be simplified to a plain summary without affecting anything upstream.

**Iteration.** A post game screen that celebrates good play by everyone, including the traitors, because framing the reveal as a shared story rather than a verdict does far more work than it looks like it should.

## H9. The unlock code

**Plan.** A code the host enters, which unlocks the table. Never per account, because if one player has it and another does not, the first question at every table becomes an administrative check, and you have taxed the social experience to protect a feature that costs nothing to give away.

**Implementation.** Seed it in the world rather than only on a forum: a line that appears in a voyage log after ten completed voyages, a string on a page of the manual, a phrase a port merchant says once. Discovery should feel earned by playing and then spread by word of mouth, which is the distribution that costs nothing and converts best. As built, two of the three seeds landed and the third had nowhere to land: there is no prose rumor surface for a port merchant to speak from, and inventing one to carry a single sentence would have been a second feature wearing the first one's coat, so the merchant's line is recorded here as not built rather than quietly dropped. The other two are real. The voyage log is the chronicle line, handed to a captain on the voyage that takes them to ten and never again, and the manual is two pages: the last step of the How to Play guide, which is the manual a captain can actually open, and the README's own Sealed voyages section. The phrase is deliberately public in both, and that is the design rather than a leak, because a secret shared by a table is a rumor and a secret held by the server is an administrative check at the top of every evening. Because it is public, both sides read one table, `src/lib/unlock.ts`, written in the shape `mode.ts` and `difficulty.ts` already use, and the file header carries the reasoning so the next engineer does not move it behind the server for safety it would not buy. The phrase itself is never on the wire: a room card names the door it opened, by label, and only the labels travel. A room property was the only honest shape for it. `sealed` sits on the mode record, true for Ocean Gambit and false for Classic, so the lobby, the create form and the guide read one flag rather than each deciding for themselves whether a voyage is locked, and the room remembers which door it opened in a column that stores the id and never the words. The gate is at the one place a room is born, the create route, and it refuses three different things in three different sentences: a phrase that opens a different voyage than the one asked for, a sealed voyage chartered without a phrase, and a phrase that does not open the sealed voyage asked for. Those are kept apart because a host holding a valid phrase who typed it wrong is owed different advice from one who never had it, and a host holding a phrase for the other voyage must not be quietly seated on the wrong lap. A phrase is normalized before it is compared, so a paste with capitals, a trailing full stop or stray spaces still opens the door, and the raw text is never written down. The line fires from the count the conclusion loop has just written rather than the row it read, so it lands on the captain whose tenth voyage it was, and it is withheld by name from a forged finish, because a forger's count does not move and a captain already sitting at ten would otherwise be handed the harbor's line on every fake they sailed. The threshold is its own constant, `UNLOCK_EARNED_AT` in the unlock table, which currently coincides with the century club's ten and is deliberately not the same number: a merit is something the harbor congratulates and a door is something the harbor opens, and a future where one moves without the other should cost one edit rather than one surprise. The name is worth a note, since the palette already owns `charter` as a colour meaning Chart a new harbor, which is why the feature took the name unlock instead of the obvious one. The smoke suite holds the table, the wire and the door: every record in the table round trips through its own normalizer and no label, phrase or manual line carries a dash, the sealed modes and the table cannot drift apart in either direction, the line is null at nine, present at ten and null at eleven and carries both the count it was granted at and the phrase itself, three captains sail the fixture with one left a voyage short and one forged while sitting at the threshold, the three refusals are each checked for their own sentence, a messy paste opens the door for a captain with a single voyage to their name, because the phrase is a phrase and not an achievement, and a restart leaves the room still sealed and still Ocean Gambit.

**Evaluation.** Track code entry rate and the number of tables it unlocks, but the real measure is whether anyone ever says where they heard it, because that is the word of mouth working. The second number is still a query rather than a count, and now that the spine in I1 has landed it is worth saying why the spine does not count it either: a room records the door it was opened through, by id, so the tables a phrase opened are a query over rooms rather than something the mode would have to start reporting, and the spine records voyages, so it sees the tables a phrase opened and never the hosts it turned away. The entry rate is not recoverable from what is written down, and should not be guessed at: it counts the refusals as well as the successes, and a refusal is answered at the create route and forgotten before any voyage exists, so that number needs an event of its own rather than a near enough reading of the successes.

**Rollback.** One host setting. Reverts completely. As built, that is two edits rather than one. `sealed` goes false on the Ocean Gambit record, and the pill, the phrase field, the guide's appendix and the gate at the create route all disappear together, because all four were reading that one flag rather than deciding for themselves. The room column can then be left in place, since nothing reads it once no mode is sealed and a room chartered while the feature was live still sails, or dropped with the table itself.

**Iteration.** More than one code, with each unlocking a variant rather than a different mode, so the secret keeps paying off without splitting the player base.

# Epic I. Telemetry and gates

The proposal says retrofitting telemetry is how projects end up guessing, and that every number in its balance section is a launch gate rather than a nice target. That makes this epic a deliverable with its own goals rather than a chore attached to others.

## I1. The telemetry spine

**Plan.** Instrument from the first playable build of Epic C, not from Epic I, which means the spine is written before the first system it measures. Everything is a typed event with a version, a voyage identifier, and a leg number.

**Implementation.** Seven families from the proposal: the loop, covering time to first trade, trades per leg and orders that expired unfulfilled; the paths, covering pick rate, switch rate and the leg it happens on, signature use, and Opportunist use; the build layer, covering offer to pick conversion, per card rates with appearance counts, per pair rates with appearance counts, charter split, module trade volume, and the correlation between a captain's first boon and their final placing; the market, covering offers posted, filled and expired, median hold utilization, Chandler share, distinct goods traded and Bale usage; the survival layer, covering Short Rations legs, crew losses, frostbite, and Barge revenue as a share of all food spending; the social layer, covering messages per captain per leg, Audit and Maroon usage and accuracy, and the share of marooned players who stay to the end; and the business, covering lobby fill time by table size, abandon rate by leg, day one and day seven return, and second session rate on the evening.

As built, the spine is two modules and a table. `src/lib/game/telemetry.ts` is the pure half: the version, the event vocabulary as a typed payload map, the family table, the voyage id, the record's own shape, and the normalizer that reads a stored blob back into a record or refuses it. `src/server/realtime/telemetry.ts` is the half that touches the world: it decides whether a voyage is recorded at all, holds one voyage's events in memory while the voyage runs, and writes the record once, when the voyage stops. Eleven event names ship, across four of the seven families above, and every one of them is stamped with the version, the voyage id and the leg it happened on. The leg is the accumulator's rather than the caller's, because a socket handler fires whenever it fires, and an event that placed itself on a leg the harbor had not reached would be a measurement of nothing.

Which of the seven are instrumented is the honest half of this fold, and which are not has a reason that sits upstream of the spine. The loop family is the leg report: one line per captain per leg, carrying what that captain dealt, filled and traded in distinct goods, kept as a claim about a screen rather than as a fact about the harbor, because the client is the one counting. The market family is three lines, an offer posted, an offer filled and an offer expired, each carrying the goods and the Gold behind it, so the board's talk and the board's trades are two readings of one thing and posted equals filled plus expired. The social family is six: one line per message, an ask and a carry for each of the harbor's two votes so usage and outcome stay separate numbers, and one for a captain giving up a seat. The business family has no event of its own and does not need one, because two of its four numbers are already in the record's header: lobby fill time by table size is the distance from the moment the harbor was charted to the moment the voyage started, grouped by the seats the voyage pinned, and the abandon rate by leg is the leg a voyage stopped on, which the outcome and the leg it ended at carry between them, while the day one return, the day seven return and the second session rate are joins over stored records, since a captain line names the user and the record names the moment it closed. The build family waits on Epic F, the paths family on Epic D and the survival family on Epic C, so those measure nothing yet for the same reason they play nothing yet. Three measurements inside the families that are instrumented also have no source, and each is named rather than approximated: median hold utilization waits on the split hold in C4, the Chandler share and Bale usage wait on Epic E, and Audit and Maroon accuracy cannot be read off the record at all, because accuracy is whether the captain the harbor voted on was actually guilty, and that verdict stays on the captain's own Chronicle row rather than entering a measurement. One number the mode's own evaluation names first does reduce, and it is worth saying how, since the plan calls it the direct measure of pillar four: a marooned captain was named by a carried vote, and a captain line says whether that captain was still standing when the voyage closed, so the share of marooned players who stayed to the end is one pass over one record's captain lines, at the resolution the record has, which is presence at the close rather than the length of one connection. That read was a join out of the events until I2 put the maroon on the line itself, and I2's own fold has the landed shape.

A voyage has three endings and all three leave a record, because the plan's broken voyage is a real case rather than an error path. It concludes, the host wipes it, or the harbor empties out from under it, and the outcome field is the record's own word for which happened. Two of those three paths were found by reading the wiring rather than by a compiler, and both would have lost a measurement silently. The ordinary way out of a voyage is the Leave button, which gives up the seat over REST before it says so on the socket, so by the time the grace timer's reap went looking for the seat there was nothing left to reap and the abandonment was never counted. And a harbor whose last captain left had no writer at all, because the only emptied record lived on the reap path that never runs once the REST route has already taken the seat. Both are closed: the socket's leave handler notes the departure itself, and the teardown that follows the last seat writes the emptied record. Each of the socket side notes is guarded rather than trusting its caller. A leg report is bounded to one leg of slack, because a captain who has just finished counting a leg is routinely one ahead of the harbor's checkpoint, which moves when a captain reports standing at it, and the fastest captain at the table got there first. It replaces rather than appends, so a client that re-reports a leg closes it with the later figures and one captain keeps one line per leg however often the network speaks. A captain is one abandonment no matter how many ways the seat goes away, and only a captain the voyage has already counted can abandon it at all, which is what stops a spectator who wandered into the room's channel from being written down as a captain who walked out. The event cap is four thousand, and a voyage that reaches it is marked truncated rather than dropped.

The sample rate is configuration from the first day, which is what the rollback below asks for and the reason it is not bolted on. `TELEMETRY_SAMPLE_RATE` is a fraction of one, one records every voyage and zero records none, it is read once at boot and validated beside every other variable, and the draw is per voyage rather than per event and deterministic off the voyage's own identity under a name of its own, so it can never share a stream with the market or the commission, and a voyage that was recorded is recorded for its whole life. The one gap the spine has is the one an in-memory accumulator always has, and it is named rather than hidden: nothing is written until the voyage stops, because a write per leg would put the database on the socket path, so a process that dies mid voyage takes that voyage's record with it, and the three endings above are the ones a process that stays up can see. The record outliving its room is the other half of the same concern: the table carries a bare indexed room id and no relation to the room, so a room deleted out from under a voyage still has its measurement, an operator purge is the one thing that clears a hosted harbor's rows by hand, and the smoke suite clears the rows whose room no longer exists. Nothing was added to a save anywhere in this goal. The record is written once, at the close, and no game rule reads a field of it, so the Ledger Integrity Pass has nothing new to learn and no voyage behaves differently for being measured.

The smoke suite holds the vocabulary, the normalizer, the wire and all three endings, and it drives them rather than describing them. Five captains open three harbors and end them three different ways: one concludes with three captains aboard and the whole event set behind it, one is emptied by a solo captain giving up their only seat, and one is wiped by a solo host. The concluded fixture is a real voyage walked to its ninth leg, with a trade taken and a second offer left standing until it expires, two messages, two audit votes and two maroon votes, a departure through the same route the Leave button uses, and three leg reports from two captains. What is asserted is the stored row rather than the accumulator: the columns a record can be queried by say the same thing as the blob inside them, the voyage is named by the voyage it belongs to and carries the mode and the seats it was dealt, the market's three lines add up to the units their posters escrowed, the harbor's talk is counted once per message from the captain who sent it, each vote keeps its nominations and its carries as separate numbers against the right captain, every event sits on a leg the voyage reached or is a leg report, which is the only name allowed one leg of slack, and the captain who walked out is the one line marked as gone at the end. The emptied and the wiped fixtures then check the other two outcomes for exactly what the plan asks of a broken voyage, which is an explanation of where it stopped.

**Evaluation.** The spine is done when a full voyage produces a complete record with no gaps, and when a deliberately broken voyage, meaning one that abandons mid leg, produces a record that explains where it stopped. As built, both are checked rather than asserted, which is the shape every evaluation in this document took once it landed. A voyage driven from leg one to leg nine, with a trade taken, an offer left standing until it expired, talk, two votes, a departure and three leg reports, leaves a record whose lines are each accounted for and whose only absences are the ones the rules explain. A solo harbor abandoned at leg two leaves a record that says the harbor emptied, that it emptied at leg two, that one captain was dealt and that nobody was standing in it when it closed, which is a deliberately broken voyage answering where it stopped. The one number this spine still cannot answer is the unlock phrase's entry rate, and it is not recoverable from what is written down, which is the note H9 carries: it counts the refusals as well as the successes, and a refusal is answered at the create route and forgotten before any voyage exists, so it needs an event of its own rather than a reading of the voyages that followed.

**Rollback.** Telemetry is always on and additive. The rollback concern is volume, so sample rates belong in configuration from the first day rather than being bolted on.

**Iteration.** Sampling by table size, because the six player case is the expensive one and the four player case is the common one.

## I2. The two measurements most likely to be skipped

**Plan.** Peer trade profit and maroon retention are both named in the proposal as things that must be tracked from the start or cannot be reconstructed later, and both are easy to defer because neither shows up in the first playable build. This goal exists so that deferring them has to be a decision rather than an oversight.

**Implementation.** Peer trade profit accumulates from leg one of every voyage because the Broker's win condition reads it. Maroon retention cannot be measured until Epic H is playable, but the connection lifetime it needs is available from Epic B, so the raw signal starts there.

As built, both fields are on the record's captain lines, and both are written by the half of the spine that touches the world rather than derived afterwards by a reader. The maroon is set at the same call that records the carried vote, beside the note that writes the `maroon_carried` event, which is what makes it the server's own fact rather than a reading of its own events. It is also the one note in the accumulator that writes no event, and therefore the one that does not go through the event cap: a truncated record still says who was put ashore, because the cap bounds how much happened rather than how the voyage stood when it ended. The peer ledger is read once, at the conclusion, out of the room's saves, through the same reader the Broker's verdict uses (`readPeerTradeProfit` in `src/lib/game/victory.ts`), which is what keeps the number printed on a captain's line and the number the rule decided on from becoming two readings of one save.

The read that supplies the ledger is one query over the room's saves, taken at the moment the voyage ends, because that is the one moment they still exist as a set: a harbor that empties takes its saves with it when the room row goes. It replaces two reads that used to come after it, the per finisher lookup the chronicle's extras came from and the second query for the rows the integrity pass had marked, so the conclusion now opens the room's saves once and hands that one parse to three readers, which are the record's lines, the ledger integrity verdict and the chronicle. Fewer reads than before, and one view of the voyage rather than three. The two endings that are not a conclusion hand the spine no ledger, for a reason of their own rather than a shared one: a harbor that empties has no saves left to read, and a wipe closes its record at a moment when nothing is reading anything. Their lines carry the zero an unreadable save gives, which is the same reading a save that could not be parsed gets, so the field is never null and never guessed at.

The retention figure is then a pass over one record rather than a join across two, because the mark is on the line rather than in the events: of the lines that read marooned, the share whose own presence at the close also reads true. That is the resolution the record actually has, and it is why the connection lifetime the implementation note above planned to start from is not what landed. Presence at the close answers the plan's question directly, which is whether a marooned captain stayed, and a connection lifetime would have answered a nearby question at the cost of an event per session. The mark is deliberately the server's rather than a client's claim, so a captain whose own client reports a maroon the harbor never called is written down as an ordinary line, which is the same claim the conclusion already refuses for the standings and the reveal ledger.

Nothing was added to a save and nothing was added to the schema. The peer ledger was already a save field the Broker's verdict read from H4, and both new fields live inside the record's JSON rather than in columns, so the deploy path's push has nothing new to bring and no stored record is rewritten. A line written before this slice reads as a captain the harbor did not put ashore and who took nothing in trade, which is the same absence an unreadable save gives, and that is the no backfill rule the evaluation asks for: defaults at read time rather than a migration over rows that are already written.

The smoke suite holds both fields at the two ends they can be read from. The pure half checks the ledger reader's own rules, a number including a negative one, since a captain can come out of a voyage having paid out more than they took, and anything else reading as the absence rather than as a ledger of zero, and it checks a line written before either field existed coming back as the defaults rather than as a line a reader has to guard. The wire half reads the stored rows. The voyage that concluded has exactly one line marked marooned, and that captain is both the one the harbor voted ashore and the one who then gave up their seat, which is what shows the two fields as separate facts on one line. The harbor its host wiped still carries the captain it put ashore, which is the ending a mark derived from the events would have lost, since a wipe closes a record with no conclusion behind it. The reveal harbor's Broker line carries exactly the ledger their verdict was decided on, while a captain whose save held no ledger and a seat with no save at all both read zero. And the emptied and the wiped records carry both fields as readings rather than as holes.

**Evaluation.** Both fields appear in the very first voyage record that contains their prerequisite feature, with no backfill and no nulls. As built, both are checked rather than asserted, which is the shape every evaluation in this document took once it landed. Peer trade profit rides the line of the first concluded voyage whose captains handed their own saves in, at the number the verdict under it was decided on, which is the target the Broker's rule turns on rather than a number the measurement picked. Maroon retention is on the line of the first record that contains a carried maroon, and it is read there in both directions in one run: the concluded voyage's marooned captain is gone at the end, and the wiped voyage's marooned captain is still standing, which is the retention figure and its opposite read off one field. Neither field is ever null, because a captain it was not read for carries the zero an unreadable save gives and a record written before the slice reads as that same zero rather than as a missing field. The one thing the slice does not do is the iteration below, which stays where it is: the ledger is a per voyage number on a captain's line rather than an entry per trade, because nothing in the balance pass has yet asked which trades were the profitable ones.

**Rollback.** Neither can be rolled back meaningfully, which is the reason they get their own goal.

**Iteration.** Move peer trade profit from a per voyage accumulator to a per trade ledger entry if the balance pass needs to see which trades were the profitable ones.

## I3. The dashboard, and the front page number

**Plan.** One page that answers whether the mode is healthy, with the Barge revenue share on the front page, because the proposal identifies it as the early warning for the Quartermaster seat going wrong and the correct response is to add power to the path and never to add a rule.

**Implementation.** The dashboard reads the spine rather than the database directly, so it stays cheap and it cannot slow a live voyage.

As built, the reading is one pure module, one route and one page. `src/lib/game/dashboard.ts` is the arithmetic: rows in, a reading out, and it is pure for the same reason `./balance.ts` is, so the whole page can be exercised without a server. `src/app/api/admin/balance/route.ts` is the only thing that touches the database, and what it opens is the spine rather than the game: one query over the mode's own records, newest first, capped at three hundred, and one query over the chronicle rows for exactly those voyages. That second query is what the window means. A voyage's measurement and its chronicle row are read together or not at all, so every number on the page is over one window rather than each being read over whichever rows a query happened to reach, and the window travels to the page as its own header: the voyages, the captains in them, the lowest sample rate any of them ran under, and how many hit the event cap or could not be read. `src/components/portmasters/BalanceDashboard.tsx` prints what it was handed and decides nothing of its own, which is the property that keeps it from becoming a second opinion: there is one implementation of each number in the tree, and the page is downstream of it.

The front page is the strip at the top of the page, and it is the plan's front page number first. The Barge share is not a tile built for the occasion: it is a reading in the seat panel's table, and the same object is the front page, handed to both places by the reader, so the page cannot show two versions of the number it is named for without the module saying so. Beside it are the three questions the evaluation asks, each with the state it is in today and the one sentence the panel below can answer with, which is the minute the evaluation is asking for: a reader takes in the strip and knows where the mode stands without scrolling.

Below the strip are the four panels, in the plan's order: the seat, the staples, the variance, and the floor, which is the gates that are none of the three questions rather than a fourth. Every reading on them carries the gate it is judged against, so a reader never has to hold a target in their head to know whether a number is good, and every gate goal I4 names appears on one of them: the three seat gates and the Barge, the five card, charter and goods gates, the three win rate bands against their own targets, session length at the five captain tune target, retention, bankruptcy, hold utilization and Parley participation.

What the page cannot read, it says it cannot read, and it says what it is waiting on. That is the shape the seat and staples panels take, since the seat is Epic C's, the paths are D's, the Barge is E's, the cards and the charter are F's and the market is G's: a gate with no source is a reading whose value is "not measurable" and whose target names the epic it waits on, never a zero, because a dashboard that prints 0.0% for something nobody measured is the instrument the plan warns about. Two of the sixteen gates have a source the record cannot reach yet rather than an epic that is unbuilt, and both are named in their panel's gaps: hold utilization needs a capacity to divide by and the split hold is C4's, and Parley participation needs talk sorted by phase while the record's talk line carries the leg, which is every phase of it.

The readings the spine can already answer are read, and they are read at the resolution the record has. The variance panel is the one that works today: the nine win rate cells under the deck's own name for the card, read by the same reader the command line report uses, so a cell cannot be in band on the page and out of band in the report. The swing across the played bands is read there too, and so are session length, which is the median over the voyages that concluded at five seats because the clock is charted to closed and only a conclusion has an end to measure to, and where the voyages that stopped before the reveal stopped. The floor panel reads retention off I2's mark on the captain lines, over the voyages that closed with somebody standing, and bankruptcy off the chronicle rows, since a bankruptcy is written on a captain's own row at the conclusion rather than carried in the record. The swings, the early endings and the staples panel's counts for goods and the board read as measured but not judged, which is a verdict of its own on the page: the plan sets no threshold on them, and a dashboard that invented one would be reporting a failure the plan never asked for.

The rate is printed by the reader that produces it. `ratePercent` lives in `./balance.ts` beside `readWinRates` rather than in either of the two places that show a rate, because the command line report and the page print the same cells: a rate reading 54.3% on one and 54.2% on the other would be two readings of one number rather than a rounding question, and the two formats around it are theirs to choose.

No captain's name is in any of it. The reading is about the mode rather than about who sailed it, so the window says how many captains its voyages carried and never which: the panels and the wire behind them carry counts and rates, and the smoke suite asserts the absence rather than trusting it.

**Evaluation.** Whoever is on balance duty should be able to answer three questions in under a minute: is the Quartermaster seat healthy, is anything becoming a staple, and is the variance too swingy. If the page cannot answer those, it is a data dump rather than a dashboard. As built, the page answers the three questions in the strip at the top rather than in a table a reader has to interpret: each of the three carries a state and one sentence, and the seat's sentence names the epics its gates wait on, which is the honest answer while those epics are unbuilt rather than a blank a reader has to go and look up. The floor panel is not offered as a fourth question and does not read as one. The page avoids being a data dump in the one place it could have become one, which is the gates with no source: each names the epic it waits on, and beside the gates it cannot read the staples panel shows the nearest readings the window does hold, labelled for what they are rather than dressed as the gates above them. The smoke suite holds the shape rather than describing it, checking that every gate goal I4 names appears on a panel, that the front page number is the same object as the seat panel's own reading, that one band under its target moves the variance panel to watching and names the band, that a window with no voyage in it reads as no reading rather than as clear, and that the serialized reading names no captain.

**Rollback.** Read only and off the critical path. As built, that is structural rather than promised: the reduction module takes rows and returns a reading, opens no socket and reads no clock, so the page cannot write and cannot contend with a voyage that is under way, and the window is fetched once on arrival and once per Refresh rather than streamed. The route and the page can be removed without touching the spine or the game.

**Iteration.** Alerts rather than charts for the three gates most likely to break, because nobody watches a dashboard during a busy week.

## I4. The launch gates, and the three hundred voyage run

**Plan.** Every number in the proposal's balance section is a gate rather than a target: the mode does not ship until the number is in band across at least three hundred recorded voyages. This goal is the run itself, plus the process for deciding what to change when a number is out of band.

**Implementation.** The gates are path pick rate between twelve and twenty eight percent, Quartermaster fill above seventy percent, Free Captain pick rate between fifteen and twenty two percent, honest side win rate between fifty two and fifty eight, Pirate win rate between twenty and twenty six, Broker win rate between thirty five and forty five, no single card in more than thirty five percent of winning builds, no two card pairing above sixty two percent over forty appearances, charter split above twenty percent deviation, Bourse fills above sixty percent, median hold utilization between fifty five and eighty percent, distinct goods traded above sixty percent, bankruptcy under twelve percent, marooned players staying above ninety percent, Parley participation above sixty six percent, and session length between sixty two and seventy four minutes at five captains.

As built, the gates stopped being a checklist in a document and became handles the code holds. `src/lib/game/dashboard.ts` names the plan's sixteen in the plan's order, and every reading on the page carries the id of the gate it answers, so a gate is something a reader can count rather than a label somebody has to match by eye: a gate the page loses is an id that stopped appearing, and a gate renamed in one place fails the build rather than quietly leaving the ship decision short by one. A role's win rate is one gate read at three table sizes, so the three cells of a role carry that role's id and are read together rather than counted as three gates.

`src/lib/game/gates.ts` is the decision, and it is a reduction over a reading rather than a second reading of the window: it takes what the dashboard returned, opens no database and reads no clock, so the page, the command line and any later surface ask one implementation and cannot disagree about whether the mode passed. It answers with three states rather than two, because "we cannot say yet" is not the same finding as "something is out of band": clear, held, and unjudged. Clear costs the whole of what the plan asks for, which is all sixteen gates inside their bands over at least three hundred recorded voyages, at a sample rate of one and with nothing unread or truncated, and every way of falling short is its own sentence in the gaps rather than a count, because a gate with no source, a gate no voyage has exercised, a run a hundred voyages short and a window recorded at half rate each ask for different work. A gate the page does not carry at all is built as an unmeasured gate rather than skipped, so the decision is taken over all sixteen or withheld. The answer and the gap list are read off one ordered list of reasons, so the first thing an operator reads is the first thing they would work on and the two can never name different reasons.

The window moved into `src/server/telemetry-window.ts`, where the route and the report read one window rather than two copies of one query, and its size is taken from the launch floor (`LAUNCH_MINIMUM_VOYAGES`) rather than written twice, so a window too small to clear is impossible to configure by accident. `scripts/gates.ts`, run as `npm run report:gates`, prints the sixteen gates against that window, one row each with the reading that decided the gate and the verdict word, and the ship decision under them. Its exit code is the verdict rather than an accident, so the command can stand in a release gate: zero clear, one held, two no verdict yet, three the report could not be read. The plan's tie break is printed on every run rather than only when it is needed, because a rule that first appears in the report of the run that broke is a rule discovered at the worst possible moment.

The page carries the same verdict in a strip above the front page, computed from the reading it already fetched rather than fetched again, so the launch state costs no second query and cannot be read over a different window than the panels under it. The strip is the state, the run against the floor, the gates by where they stand, and every reason the verdict is not clear, and every word of it is written by the decision module rather than counted on the page, which is what keeps the strip and the report from ever counting a gate two ways.

What the goal does not produce is the run itself. Three hundred recorded voyages are played by the operator rather than played by the tree, so the slice ships the instrument and the honest reading until then, which is unjudged: the report's window line and the page's strip both say what the run stands at, in the same words from the same module. The run is the operational half of this goal and it is played against the instrument that prints its verdict, not against a memory of what the numbers were last time.

**Evaluation.** The tie break rule when two gates conflict is worth writing down before the run starts, because during the run there will be pressure to trade one against another. The Free Captain pick rate wins, because the proposal makes it a hard requirement of the hidden role mode rather than a balance nicety. As built, that rule is a constant the module holds rather than a sentence only this document carries, and it is applied in the one state it has something to resolve: when the priority gate is the one out of band, the held verdict names it as the gate that cannot be traded against the others, and when any other gate is the one that failed the verdict says nothing about the priority. The smoke suite holds the verdict in both directions: a full run with every gate in band clears, one voyage short of three hundred does not, a window recorded at half rate or holding a record that hit the event cap or would not read withholds the decision, a gate out of band holds the mode, and a gate the page stopped carrying withholds it rather than being skipped out of it. It holds the instrument too, checking that the sixteen gates are read in the plan's order, that every one of them is carried by a row on the page, that the tally keeps its zeroes so a quiet line and a good line cannot read the same, and that the verdict over the run's own window withholds the decision and names no captain.

**Rollback.** If a gate cannot be met after the run, the mode does not ship. That is the rollback, and it should be stated as a real outcome rather than a threat. As built, the rollback is the verdict's own word rather than a judgement call: held is a state the surfaces print and an exit code the report returns, so a mode that has not passed says so wherever it is looked at. All of it is off the critical path and removable, since the window is one server module, the decision is one pure module, the report is one script and the strip can be deleted from the page without touching the spine, the route or the game.

**Iteration.** Re run after every change that moves a system rather than a number, because a pool expansion invalidates the previous run.

## I5. Session length, and table size

**Plan.** Six captains is the ceiling and five is the tune target, and four has to be genuinely good rather than a degraded mode. If the session runs long, shorten the voyage before shortening the phases, because the phases are where the conversation lives.

**Implementation.** The voyage length ladder already exists in the difficulty configuration and the proposal recommends keeping it for the base game while restricting Ocean Gambit to twelve legs, because eight is too short for deduction to develop and sixteen is too long to hold the tension. That makes the mode's length a config restriction rather than a new system.

As built, the restriction is one field and one selector rather than a system. `voyageLegs` sits on the mode record in `src/lib/game/mode.ts`: twelve for Ocean Gambit, and null for Classic, which is not a copy of its tier's number but the absence of a pin, so the founding voyage keeps following the ladder rather than following a value that stopped moving when the tier did. `voyageRoundsFor(mode, difficulty)` is the single reconciliation point, handing back the mode's own number where it has one and the tier's rounds where it does not, and the tier is read for a length in exactly one place in the tree, which is that function: every reader that used to ask the difficulty configuration for a voyage length now asks this, so a balance pass on the ladder cannot leave one surface quoting a twelve leg voyage and another quoting the tier's ladder.

The length is pinned at departure into `GameState.maxRounds`, which is the field the rest of the tree already read: the lap's end, the maroon rung's reachability, the chronicle row's rounds column, the helper reputation cap, and the ceiling a finisher's save is judged against. Pinning it there rather than recomputing it per reader is what keeps one voyage from being two lengths at once, and it also states the deploy window honestly: a voyage already in flight plays the legs its own save pinned, while a server that has just been redeployed computes the new number for anything starting after it, and the mismatch is named in the field's own comment rather than hidden.

Three surfaces needed the mode added rather than only the selector. The lobby's difficulty options and the difficulty advisor are both read while the host is choosing a tier, so they take the mode and quote the voyage the harbor would actually sail; the advisor's mandate list is filtered to the same number, because a mandate scheduled past the last leg is a promise the voyage cannot keep. The guide, the advice panel and the tutorial quote a length to a captain as well, so they read the selector too, and the founding mode's copy is byte for byte what it was because the selector returns the tier's own ladder for it.

At the close, the integrity ceiling reads the voyage's own length rather than the tier's, which is the one place the pin could have turned into a false accusation: an honest captain who sailed a twelve leg Gambit voyage and reported the figures they earned would have been judged against the eight round ceiling their tier would have run, so a correct voyage would have produced a forgery verdict. The parameter is named for what it allows (`roundsAllowed`) rather than for what has elapsed, because a live save is filed against the room's own round and a finished one against the whole voyage, and both are upper bounds on the same thing.

The page gained the plan's other session number: lobby fill time, read one table size band at a time in the variance panel, off the clock the record already carried, which is charted to set sail. It is a comparison between bands rather than a threshold, so it reads as measured and unjudged, and the panel's gap list carries the plan's tuning rule with the knob that implements it, which is the mode's own `voyageLegs`: when a session runs long, the voyage shortens before the phases do.

**Evaluation.** Session length between sixty two and seventy four minutes at five captains from lobby to reveal, and a separate check that four captains is fun rather than merely functional. Lobby fill time by table size tells you whether six is worth supporting at all.

As built, the first half of that is a gate the tree already had, read off the record's own clock from charted to reveal, and the fill time beside it is the second number the same records answer. The four captain check is a fixture rather than a gate, because fun is not a number the tree can read: what the smoke suite holds is the part that can be read, which is that a four seat harbor is a real Gambit table rather than a degraded one. Four is the smallest table the mode deals a Variable into, so one captain is hiding something and the deduction has somewhere to go, and the voyage it sails is the full twelve legs rather than a shortened one, ending at the reveal with a chronicle row that names the twelve legs and the four seats together so a later reader can group the band.

The smoke suite holds the length in one place: the selector over every tier of both modes, the fallback for a mode or a tier nobody recognises, the state a captain is handed at departure on both modes, the copy a captain reads in the guide, the advice and the tutorial, and a four captain harbor sailed to its end over the wire, whose record carries the four seats and the twelfth leg, and whose chronicle rows carry twelve rounds and four seats. The page's fill row is held against built windows: a band holding two voyages reads the median of their two clocks, a band whose only record never set sail says it saw none rather than reading as a zero, an empty window says so rather than printing three bands of nothing, and the row never moves the panel's state, because a comparison between bands is not one of the sixteen gates.

**Rollback.** Length is configuration, so it reverts.

As built, reverting is one field: clearing `voyageLegs` on the mode returns every reader to the tier's ladder, because the selector reads the absence as the founding behaviour rather than as a length of zero. The page's fill row is additive and deletes without touching the spine, the route or the game.

**Iteration.** A four captain tuning pass after the five captain gates pass, not before, because tuning both at once produces numbers that describe neither.

As built, two things are recorded rather than done, and both are outside this goal. The guide's third step still draws the founding mode's four phases by hand, so a mode with a different lap is briefed on the founding order rather than on its own chart; the count and the length in that copy do follow the voyage, and rendering the lap from the mode's briefing record is the change that would close the rest of it, which is a rendering rather than a length. The four captain tuning pass is still waiting on the five captain gates, which is the plan's own ordering rather than an omission, and the fill time it would be read against is on the page from today.

# Epic J. Trust and polish

## J1. The private information security review, and the closed test

**Plan.** The proposal asks for a dedicated security review of the private information paths before the mode meets the public, in the same spirit as the hardening pass the current tree already went through, and it pairs that with a thirty player closed test. Both are the same goal because both are about who sees what before strangers arrive.

**Implementation.** The review's scope is every site that builds a broadcast payload, every site that writes to the log array, and the save path that trusts a client. The closed test runs on a separate database from anything with real accounts, which is the same discipline the smoke test already follows, because it refuses to run when it is pointed at a different database than the server it tests.

As built, the review is a document and two gates rather than a checklist. `docs/SECURITY_REVIEW.md` holds the scope, the three inventories with the lines they were read at, the findings, and the boundaries accepted on purpose. `scripts/private-scan.ts`, run as `npm run check:private`, holds five rules that fail on a second path to anything the mode hides, so the review does not become true exactly once. `scripts/closed-test.ts`, run as `npm run check:closed-test`, is step zero of the closed test: it refuses to bless anything but a local SQLite file whose name begins with `closed-test`, prints that name beside the counts of what is already inside, writes no row and creates no table, and never prints any part of the database URL, because a connection string can carry a password and the guard's output is meant to be pasted into a session log.

Three findings came out of the reading, all fixed. A `player:detail:response` relayed whatever its sender said, so any authenticated captain could push a forged snapshot at any account in the tree under any name; the server now writes the question down when it is asked and relays an answer only for the exact pair it recorded, with the room and the asker taken from its own record rather than from the frame. A manifest line was bounded in shape but not in size, so a doctored save could put a paragraph of its choosing in front of six captains at the moment they were watching; a fill is now bounded in text, in kinds of good and in count, with every bound read off the game rather than picked. And a save had no size limit at all on a path the harbor pays for at the end of a voyage; 64 KB is now the ceiling, chosen from measurement, since five real saves run 1.5 KB to 3.5 KB.

The suite grew around it: the two private information sweeps now read every frame at their two tables for every shape a secret takes on the wire, including an alignment word under a name nobody declared, the three branches of the detail hold are driven over a live socket, and both new bounds are checked from both sides.

**Evaluation.** The review produces findings with severity, and the severity one bar is that no alignment field can reach the wrong client. The closed test produces the first real telemetry from players who are not the authors, which is also the first honest read on the usability risk in G4.

As built, the severity one bar holds, and it held before the fixes as well: the alignment table has three production readers, every one of them inside the module that deals the cards, and the only wire field that can carry an alignment is the role on a private entry, which is addressed to one captain's own sockets. That verdict is mechanical rather than remembered, because the sweeps check their own patterns against labelled frames before they are pointed at a harbor, so a rule narrowed to nothing cannot pass by finding nothing, and one of the two tables they read is a six captain harbor with two Pirates and an ally in it.

**Rollback.** Not applicable. The review is a gate rather than a feature.

As built, reverting the discipline is deleting two scripts and their two lines in package.json, because neither gate is wired into the build and both are exit codes. The three fixes revert independently: the detail hold is one map and three call sites, the fill bounds are one constant block in the audit module, and the save cap is one comparison in the save route.

**Iteration.** Repeat the review whenever a new private channel or a new persisted secret is added, and write that rule into the implementation guide so nobody has to remember it.

As built, the rule is written down in the two places it would be looked for: the closing section of `docs/SECURITY_REVIEW.md`, and the rules that must not be broken in `docs/IMPLEMENTATION_PLAN.md`, where the trigger is spelled out as a new private channel, a new persisted secret, a new broadcast payload, or a new path that trusts a client. The review's own limits are written down beside it, because a gate that reads as stronger than it is is worse than none: the scan reads text rather than meaning, the sweeps only read the harbors the suite sails, and the closed test guard checks the database's name rather than the fact of its separation. Two notes are recorded rather than fixed. Nothing in the tree counts requests, so a scripted client can emit frames as fast as its socket takes them, and the mute's list is visible to the room that mutes; both belong to J2, which is where the mute is shaped and where a rate limit would have a reading to be set from.

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
