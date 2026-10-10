// PortMasters 2.2 Parallel Release, smoke run: Free Captain: the borrow.

import { cargoCarriesTag } from "@/lib/game/cards";
import {
  OPPORTUNIST_PENALTY,
  OPPORTUNIST_USES,
  PATH_ORDER_SLOTS,
} from "@/lib/game/constants/paths";
import {
  OPPORTUNIST_PATH,
  calcTransportCost,
  canFillOrder,
  completeOrder,
  lockedBehind,
  nextPhase,
  normalizeOpportunistBorrows,
  opportunistAllowance,
  opportunistBorrowsLeft,
  opportunistBorrowsTaken,
  opportunistIsBorrower,
  opportunistLine,
  opportunistMayBorrow,
  opportunistPayout,
  opportunistUsesLine,
  restartGame,
  snapToCheckpoint,
} from "@/lib/game/engine";
import { PATH_IDS, pathLockLine } from "@/lib/game/paths";
import type { GameState } from "@/lib/game/types";
import {
  GAMBIT,
  carriesADash,
  check,
  suffix,
  voyageState,
  withEnv,
} from "../harness";

export async function freeCaptainTheBorrowSuite(): Promise<void> {
  // =====================================================================
  // [D6: Free Captain: Opportunist] The plan's clause for this feature,
  // and the whole of it: "Once per voyage, fulfill any one pathbound
  // order without joining that path, at a forty percent payout penalty."
  //
  // The checks are split the way the feature is. The allowance is
  // arithmetic and is read here without a server, because nothing in this
  // feature travels: the borrow is a permission the captain's own client
  // holds, the fill is the fill the manifest already ran, and the one
  // wire fact it adds is the counter the leg report files, which is read
  // where every leg report is read (see the telemetry spine). The board
  // a captain meets is dealt through the engine's own lifecycle rather
  // than assembled by hand, the same way the pathbound board is dealt,
  // so what is read here is the board a Free Captain really meets in
  // the Orders phase.
  // =====================================================================
  // ---- the allowance ----
  // The two numbers the plan sets, and the payout they make. The penalty
  // is read off the constant rather than typed here, and the empty flag
  // set is the captain before any charter: [F6] retunes the pair through
  // the Factor, and the retune is read in its own checks below rather
  // than folded into this one, so the base reading stays the base one.
  check(
    OPPORTUNIST_USES === 1 &&
      OPPORTUNIST_PENALTY === 0.4 &&
      opportunistPayout({ modifierFlags: {} }, 100) === 60 &&
      opportunistPayout({ modifierFlags: {} }, 100) ===
        100 - Math.round(100 * OPPORTUNIST_PENALTY),
    "a hundred Gold order pays sixty on the borrow, which is the plan's forty percent penalty read off the constant rather than typed into the rule",
  );
  // The property, over every face value a card can carry rather than over
  // one example: the payout never exceeds the face value, never goes
  // below zero, and never falls as the order grows. The first of those is
  // the one the smallest orders decide, because a deduction that floored
  // instead of rounding would leave a two Gold order paying two and the
  // penalty would stop being real exactly where the plan says the reach
  // has to cost something.
  const bareBorrow = { modifierFlags: {} };
  check(
    Array.from({ length: 200 }, (_, i) => i + 1).every(
      (face, i, all) =>
        opportunistPayout(bareBorrow, face) <= face &&
        opportunistPayout(bareBorrow, face) >= 0 &&
        (i === 0 ||
          opportunistPayout(bareBorrow, face) >=
            opportunistPayout(bareBorrow, all[i - 1])),
    ) &&
      opportunistPayout(bareBorrow, 2) === 1 &&
      opportunistPayout(bareBorrow, 1) === 1 &&
      opportunistPayout(bareBorrow, 0) === 0 &&
      opportunistPayout(bareBorrow, -5) === 0,
    "and the payout is bounded by the face value at every size, so the penalty is charged on a one Gold errand as surely as on a hundred: the deduction is the number rounded and the smallest orders still pay it",
  );
  // One path works the borrow and no other does, and the switch is read
  // before the path rather than beside it: the reading every ability
  // reader in this tree takes, and the reason a rolled back build refuses
  // a Free Captain as flatly as it refuses everyone else.
  check(
    PATH_IDS.every(
      (id) =>
        opportunistMayBorrow(
          { path: id, opportunistBorrows: 0, mode: GAMBIT, modifierFlags: {} },
          "convoy",
        ) ===
        (id === OPPORTUNIST_PATH),
    ) &&
      !opportunistMayBorrow(
        { path: null, opportunistBorrows: 0, mode: GAMBIT, modifierFlags: {} },
        "convoy",
      ) &&
      !withEnv("NEXT_PUBLIC_PATH_ORDERS", "off", () =>
        opportunistMayBorrow(
          {
            path: OPPORTUNIST_PATH,
            opportunistBorrows: 0,
            mode: GAMBIT,
            modifierFlags: {},
          },
          "convoy",
        ),
      ) &&
      !opportunistMayBorrow(
        {
          path: OPPORTUNIST_PATH,
          opportunistBorrows: 0,
          mode: GAMBIT,
          modifierFlags: {},
        },
        null,
      ),
    "with no charter in hand one path works the borrow and no other does, a card that is not locked to the captain is not this captain's to borrow, and the path orders switch is read first and separately: with the locks rolled back there is nothing to reach through and the ability is refused with them",
  );
  // The counter itself: a bound read off the constant, a spent allowance
  // that reads as none left, and a save carrying more spent than this
  // build allows reading as none left rather than as a debt.
  check(
    opportunistBorrowsLeft({ opportunistBorrows: 0, modifierFlags: {} }) ===
      OPPORTUNIST_USES &&
      opportunistBorrowsLeft({
        opportunistBorrows: OPPORTUNIST_USES,
        modifierFlags: {},
      }) === 0 &&
      opportunistBorrowsLeft({
        opportunistBorrows: OPPORTUNIST_USES + 5,
        modifierFlags: {},
      }) === 0 &&
      opportunistBorrowsTaken({ opportunistBorrows: 2.7 }) === 2 &&
      opportunistBorrowsTaken({ opportunistBorrows: -4 }) === 0,
    "the allowance is a count rather than a flag, bounded by the constant F6 retunes, and a counter that claims more spent than this build allows reads as none left rather than as a debt handed back to the captain",
  );
  // ---- the Factor, and the borrow's second door ----
  // [F6: charters at leg four] The charter whose text sells the borrow
  // itself to whoever holds it: three open doors where the path has one,
  // sixty percent where the path pays forty, and a holder who never held
  // the path. The numbers read here are the card's own shipped pair, the
  // same reading the first check takes of the base two, and every reader
  // is asked with them in place so the text and the arithmetic are one
  // reading rather than two.
  const factor = { modifierFlags: { factor_borrows: 3, factor_penalty: 0.6 } };
  check(
    opportunistAllowance({ modifierFlags: {} }) === OPPORTUNIST_USES &&
      opportunistAllowance(factor) === 3 &&
      opportunistBorrowsLeft({ ...factor, opportunistBorrows: 2 }) === 1 &&
      opportunistUsesLine({ ...factor, opportunistBorrows: 0 }).endsWith(
        "3 of 3.",
      ),
    "the charter's holder counts from three where the path counts from one, a spent counter comes off the charter's three the same way it comes off the base one, and the card's own sentence prints the retuned total, so the number a captain reads before the press is the number the guard spends against",
  );
  check(
    opportunistPayout(factor, 100) === 40 &&
      opportunistPayout(factor, 2) === 1 &&
      opportunistPayout(factor, 1) === 0 &&
      opportunistPayout({ modifierFlags: { factor_penalty: 0 } }, 100) === 60,
    "the heavier rate lands where the base one does, on the face value with the deduction rounded: a hundred pays forty, a two Gold errand still pays a coin, the smallest errand pays nothing at all, and a flag carrying no rate falls back to the constant rather than waiving the penalty",
  );
  check(
    opportunistIsBorrower({ path: OPPORTUNIST_PATH, modifierFlags: {} }) &&
      !opportunistIsBorrower({ path: "quartermaster", modifierFlags: {} }) &&
      opportunistIsBorrower({
        path: "quartermaster",
        modifierFlags: { factor_borrows: 3 },
      }) &&
      opportunistMayBorrow(
        {
          path: "quartermaster",
          opportunistBorrows: 0,
          mode: GAMBIT,
          modifierFlags: { factor_borrows: 3 },
        },
        "convoy",
      ) &&
      !opportunistMayBorrow(
        {
          path: "quartermaster",
          opportunistBorrows: 0,
          mode: GAMBIT,
          modifierFlags: {},
        },
        "convoy",
      ) &&
      !opportunistMayBorrow(
        {
          path: "quartermaster",
          opportunistBorrows: 3,
          mode: GAMBIT,
          modifierFlags: { factor_borrows: 3 },
        },
        "convoy",
      ),
    "the Factor opens the borrow to a captain holding no path of the borrow's own, refuses the same captain with no charter in hand, and bounds the charter's holder by the charter's own three: a card the four other paths could draw as their wildcard and gain nothing from would be a trap inside a trio, so the door the text sells is the door the guard opens",
  );
  // The heal, and the old save it exists for: a voyage written before
  // this feature carries no counter at all, and the load site reads it
  // with the module's own reader, so the reading here is the reading the
  // board gets.
  check(
    normalizeOpportunistBorrows(undefined) === 0 &&
      normalizeOpportunistBorrows(Number.NaN) === 0 &&
      normalizeOpportunistBorrows("two") === 0 &&
      normalizeOpportunistBorrows(2.7) === 2 &&
      normalizeOpportunistBorrows(-1) === 0,
    "and a save written before the borrow existed reads as a captain who never borrowed anything, rather than as a counter that would turn the first spend into a NaN the record would carry",
  );
  // ---- where the counter lives ----
  // The plan's own clause: "The counter resets with the voyage, not with
  // the round, and it lives in the same place as the other once per
  // voyage limits." Both halves are observed rather than asserted: the
  // rest of the round is walked through the engine's own lap until the
  // books roll over, and the counter is still spent afterwards; then the
  // voyage is restarted and it is not.
  const borrowCarried = voyageState();
  borrowCarried.money = 400;
  borrowCarried.opportunistBorrows = 1;
  borrowCarried.phase = "resolve";
  borrowCarried.pirateAttackResolved = true;
  const borrowCtx = {
    seedBase: `smoke:borrow:${suffix}`,
    harborId: `smoke-borrow-${suffix}`,
  };
  // Bounded rather than a fixed count of presses: the phases a mode runs
  // between the settlement and the next round are the mode's own, so the
  // check walks whatever this build's lap is rather than a list of phase
  // names written here.
  for (let step = 0; step < 6 && borrowCarried.currentRound === 1; step++) {
    nextPhase(borrowCarried, borrowCtx, []);
  }
  check(
    borrowCarried.currentRound === 2 && borrowCarried.opportunistBorrows === 1,
    "a round walked through the engine's own lap leaves the borrow spent, which is what makes it a voyage's allowance rather than a leg's",
  );
  restartGame(borrowCarried, [], {});
  check(
    borrowCarried.currentRound === 1 && borrowCarried.opportunistBorrows === 0,
    "and setting sail again hands the allowance back with everything else the voyage holds, because the counter is part of the voyage's own state rather than of the account behind it",
  );

  // ---- the board, and the fill ----
  // The board a Free Captain meets, dealt through the engine's own
  // lifecycle: the tier's draw plus the paths' three, and every one of
  // the three is locked to a captain who holds none of those paths.
  const borrowBoard = (label: string): GameState => {
    const state = voyageState();
    snapToCheckpoint(
      state,
      { seedBase: `smoke:borrow-board:${label}`, harborId: "harbor-a" },
      1,
      "orders",
      [],
    );
    state.path = OPPORTUNIST_PATH;
    return state;
  };
  // The card's goods put in the hold, so the only thing standing between
  // the captain and the order is the lock.
  const stockFor = (
    state: GameState,
    card: GameState["customerCards"][number],
  ) => {
    for (const r of card.resources) state.inventory[r.type] = r.required ?? 0;
  };
  const lockedCardsOf = (state: GameState) =>
    state.customerCards.filter((card) => lockedBehind(state, card) !== null);

  withEnv("NEXT_PUBLIC_PATH_ORDERS", "1", () => {
    const board = borrowBoard("a");
    const lockedCards = lockedCardsOf(board);
    const openCards = board.customerCards.filter(
      (card) => lockedBehind(board, card) === null,
    );
    check(
      lockedCards.length === PATH_ORDER_SLOTS && openCards.length > 0,
      `a Free Captain's board carries the paths' three locked cards like everyone else's (${lockedCards.length} locked, ${openCards.length} open)`,
    );
    const lockedCard = lockedCards[0]!;
    check(
      !canFillOrder(board, lockedCard) &&
        canFillOrder(board, lockedCard, true) &&
        board.completedOrders.length === 0,
      "and the manifest refuses the locked card through its ordinary guard while the same card with the borrow asked for is the captain's to fill",
    );
    check(
      !canFillOrder({ ...board, inventory: {} }, lockedCard, true),
      "and the borrow is not a way around the hold: a captain carrying none of the goods is refused with the ability asked for as flatly as without it, because the order still has to be filled rather than unlocked",
    );

    // The fill itself, through the engine's own settlement, with the
    // freight read the way the settlement reads it so the check is about
    // the payout rather than about a freight figure typed here.
    const filled = borrowBoard("b");
    filled.money = 500;
    const card = lockedCardsOf(filled)[0]!;
    stockFor(filled, card);
    const freight = calcTransportCost(
      filled,
      card.totalItems,
      cargoCarriesTag(card.resources, "woven"),
    );
    const paid = opportunistPayout(filled, card.reward);
    const lines: string[] = [];
    completeOrder(filled, card.id, lines, true);
    check(
      filled.money === 500 + paid - freight &&
        filled.completedOrders.includes(card.id) &&
        filled.opportunistBorrows === 1 &&
        filled.path === OPPORTUNIST_PATH,
      "a borrowed order fills through the same settlement as any other, pays the reduced reward down to the coin, spends the allowance, and leaves the captain holding the path they already held: the order is filled without joining its own",
    );
    check(
      lines.includes(opportunistLine(filled, card.reward, paid)) &&
        paid < card.reward,
      "and the ledger says what the card promised it would: the board's own sentence for the borrow, with both numbers, and a payout strictly below the face value, which is the reach the plan says has to cost something real",
    );

    // The second locked card, with the allowance spent: refused through
    // the same reader, and refused with the sentence every other captain
    // is refused with rather than with one written for this path.
    const spare = lockedCardsOf(filled).find((o) => o.id !== card.id)!;
    const spareLock = lockedBehind(filled, spare)!;
    stockFor(filled, spare);
    const moneyBefore = filled.money;
    const refused: string[] = [];
    completeOrder(filled, spare.id, refused, true);
    check(
      filled.money === moneyBefore &&
        !filled.completedOrders.includes(spare.id) &&
        filled.opportunistBorrows === 1 &&
        refused.includes(`❌ ${pathLockLine(spareLock)}`),
      "a second borrow in the same voyage is refused and the order stays standing, with the lock line every other captain reads rather than a sentence written for this path: one action with one counter, which is the plan's own rollback shape",
    );

    // The flag on a card that was never locked: asked for, and read as
    // nothing at all. This is the shape the board's borrow button uses
    // (it asks with the flag on every board it draws), and it is what
    // keeps an over eager caller from taxing a captain wrongly.
    const ordinary = borrowBoard("c");
    ordinary.money = 500;
    // A raw good order rather than a finished product, because a product
    // order pays VAT on top of its reward and this check is about the
    // face value coming through whole.
    const openCard = ordinary.customerCards.find(
      (card) => lockedBehind(ordinary, card) === null && !card.isProductOrder,
    );
    if (!openCard) {
      throw new Error(
        "No open raw order on the board to read the unbought case off.",
      );
    }
    stockFor(ordinary, openCard);
    const ordinaryFreight = calcTransportCost(
      ordinary,
      openCard.totalItems,
      cargoCarriesTag(openCard.resources, "woven"),
    );
    const ordinaryLines: string[] = [];
    completeOrder(ordinary, openCard.id, ordinaryLines, true);
    check(
      ordinary.money === 500 + openCard.reward - ordinaryFreight &&
        ordinary.opportunistBorrows === 0 &&
        !ordinaryLines.some((line) => line.includes("Free Captain")),
      "while the same flag asked for on an order nobody locked is read as nothing at all: the card pays its full reward, the allowance is untouched and no borrow line is written, so an over eager caller cannot tax a captain for an ability their order never needed",
    );
  });

  // ---- the switch, off ----
  // The rollback the plan asks for, and it is the one switch D2 already
  // ships: with the locks off the board holds no pathbound card at all,
  // so there is nothing for the borrow to reach through and the ability
  // is refused with the cards that carry it.
  withEnv("NEXT_PUBLIC_PATH_ORDERS", "off", () => {
    const dark = borrowBoard("d");
    const darkCards = dark.customerCards.filter((card) => card.isPathOrder);
    const darkLocked = lockedCardsOf(dark);
    check(
      darkCards.length === 0 &&
        darkLocked.length === 0 &&
        !opportunistMayBorrow(dark, "convoy"),
      "with the path orders rolled back the board holds none of the paths' three even though the draw wrote them, and the borrow is refused with them: the plan's rollback is one switch, and this one is already the locks'",
    );
  });

  // The house rule, over the copy this feature added: every sentence a
  // captain reads on a borrowed card is written in the module beside the
  // arithmetic it describes, board and ledger together, so the two files
  // swept here are where the whole of it lives. The board component is
  // deliberately not swept whole, and the reason is the tree's own: it
  // reads its colors through CSS custom properties, and a doubled hyphen
  // is how that syntax is spelled (see the note on CARRIES_A_DASH above),
  // so the file cannot be held to a rule about dashes. Every borrow
  // string it draws is one of the module's own, which is what the check
  // below is standing on, and the rendered board is read in a browser
  // where the sentences land rather than here.
  check(
    !carriesADash("src/lib/game/engine/opportunist.ts") &&
      !carriesADash("src/lib/game/engine/orders.ts"),
    "every file the borrow's copy lives in reads free of en dashes, em dashes and doubled hyphens, which is the house rule for every string a captain reads",
  );
}
