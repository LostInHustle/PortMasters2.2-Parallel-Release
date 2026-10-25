"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { PublicUser } from "@/lib/api";
import { ICONS } from "@/lib/game/constants/brand";
import {
  RUMOR_COOLDOWN_ROUNDS,
  RUMOR_SHIFT_PERCENT,
} from "@/lib/game/constants/paths";
import {
  BAZAAR_SELLER_PATH,
  bazaarGoods,
  canPublishRumor,
  rumorCanLand,
  rumorClosingLine,
  rumorCooldownLeft,
  rumorDirectionLine,
  rumorNextRound,
  type PublicRumor,
  type RumorDirection,
} from "@/lib/game/engine";
import {
  rumorLandedLine,
  rumorLandsOn,
  rumorWaitLine,
} from "@/lib/game/engine/bazaar";
import { bazaarRumorsOn } from "@/lib/game/flags";
import { t } from "@/lib/game/i18n";
import { pathConfig } from "@/lib/game/paths";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { RefusalLine } from "../shared";
import { MarketBlock, MarketEmpty, MarketPanel } from "./OfferBoard";
import { PathDeskRow, type Bazaar } from "./phases/PhaseShared";

// Resolved once at module load. The assertion is the type checker's proof
// through a lookup by value.
const SELLER_PATH = pathConfig(BAZAAR_SELLER_PATH);

/**
 * The bazaar desk, drawn at Parley below the protection market. The intro
 * states what a rumor does, that the fleet sees who spoke and which good,
 * and that only the speaker knows the direction until the port prices it.
 *
 * Each reader is told what they can do here: the seller whether they may
 * speak now and, if not, why and which round the wait ends on; everyone else
 * that the seat is not theirs and what the board is for. A silent panel
 * reads as a broken button.
 *
 * Every action is one socket frame. The desk mirrors the server's checks
 * (cooldown, offered goods, path, closing round) so a refusal is visible
 * before the click, but the server's check is what publishes.
 */
export function BazaarRumors({
  game,
  bazaar,
  me,
}: {
  game: GameState;
  bazaar: Bazaar;
  me: PublicUser;
}) {
  // Hooks stay above the switch, so their order never depends on the mode.
  const [good, setGood] = useState("");
  const [direction, setDirection] = useState<RumorDirection>(1);

  if (!bazaarRumorsOn(game.mode)) return null;

  // The round this rumor would be priced by. Goods and every line below use
  // the same reader, so the desk cannot hold two readings of one round.
  const landsOn = rumorLandsOn({ round: game.currentRound });
  // The goods the next market trades, one round ahead; the server checks
  // publishes against this same list.
  const goods = bazaarGoods(game.difficulty, landsOn);
  // A stale selection falls back to the first good, so the select never
  // offers a choice the button would be refused for.
  const chosen = goods.includes(good) ? good : (goods[0] ?? "");
  const mine = canPublishRumor(game);
  const cooldown = rumorCooldownLeft(bazaar.rumors, me.id, game.currentRound);
  // The round this captain can speak again, read off the rows the server
  // counts the refusal from. A count says how long, not when.
  const nextRound = rumorNextRound(bazaar.rumors, me.id);
  // The round a publish now would end the hush on, using the row this click
  // would write, so the form's promise and the receipt agree.
  const quietUntil = rumorNextRound(
    [...bazaar.rumors, { publisherUserId: me.id, round: game.currentRound }],
    me.id,
  );
  // The final round, where a rumor would move nothing. Voyage length is
  // pinned on state rather than recomputed, as every reader of it does.
  const closesHere = !rumorCanLand(game.currentRound, game.maxRounds);
  const canSpeak = mine && !closesHere && cooldown < 1 && goods.length > 0;
  // The harbor's board is the receipt: a publish is answered by a
  // broadcast, not an acknowledgment, so this screen keeps no second copy.
  const myRow = bazaar.rumors.find(
    (row) => row.publisherUserId === me.id && row.round === game.currentRound,
  );
  const myLean = myRow?.direction ?? null;
  // The one sentence that knows the wait length and whether the voyage
  // reaches the round it ends on.
  const closedOn =
    cooldown >= 1
      ? rumorWaitLine(bazaar.rumors, me.id, game.currentRound, game.maxRounds)
      : "";
  // Resolved once for the heading, the intro, and the refusal sentence.
  const sellerName = t(SELLER_PATH.name);

  return (
    <MarketPanel
      title={t("{SELLER_PATH.crest} {SELLER_PATH.name} Bazaar", {
        "SELLER_PATH.crest": SELLER_PATH.crest,
        "SELLER_PATH.name": sellerName,
      })}
      intro={t(
        "Once every {RUMOR_COOLDOWN_ROUNDS} rounds, each {SELLER_PATH.name} captain may spread a word about one commodity, here at the Parley. The next port prices that good against it, by up to {rumorPct} percent, which is the same hand the Harbormaster leans a port with. The whole harbor is told who spoke and which good they named, and only the speaker knows which way they leaned until the port they named has priced it.",
        {
          RUMOR_COOLDOWN_ROUNDS,
          "SELLER_PATH.name": sellerName,
          rumorPct: RUMOR_SHIFT_PERCENT,
        },
      )}
    >
      <MarketBlock>
        {mine ? (
          <>
            {canSpeak ? (
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                <span className="text-muted-foreground">{t("Speak for")}</span>
                <Select
                  value={chosen}
                  onChange={(e) => setGood(e.target.value)}
                  aria-label={t("Good the rumor is about")}
                >
                  {goods.map((g) => (
                    <option key={g} value={g}>
                      {ICONS[g]} {t(g)}
                    </option>
                  ))}
                </Select>
                <span className="text-muted-foreground">{t("leaning")}</span>
                {/* Both directions are buttons, not a toggle, so a first
                    time reader sees that price can move either way. */}
                <Button
                  size="sm"
                  className={cn(
                    "h-9 rounded-lg",
                    direction === 1 && "pm-grad-parley",
                  )}
                  variant={direction === 1 ? "default" : "secondary"}
                  onClick={() => setDirection(1)}
                >
                  {t("📈 Higher")}
                </Button>
                <Button
                  size="sm"
                  className={cn(
                    "h-9 rounded-lg",
                    direction === -1 && "pm-grad-parley",
                  )}
                  variant={direction === -1 ? "default" : "secondary"}
                  onClick={() => setDirection(-1)}
                >
                  {t("📉 Lower")}
                </Button>
                <Button
                  className="rounded-lg pm-grad-parley"
                  onClick={() => bazaar.publish(chosen, direction)}
                >
                  {SELLER_PATH.crest} {t("Publish")}
                </Button>
              </div>
            ) : myLean !== null && myRow ? (
              // The row on the harbor's board is the receipt.
              <p className="text-center text-xs leading-relaxed">
                <span className="font-semibold text-due">{t("Spoken.")}</span>{" "}
                {t(
                  "Your rumor is on the board and the harbor has your name and {good}. Only you know which way it leans: {direction}. The table reads it the moment the port of round {landsOn} prices it. The bazaar is quiet for you until round {nextRound}.",
                  {
                    good: t(myRow.good),
                    direction: rumorDirectionLine({
                      good: myRow.good,
                      direction: myLean,
                    }),
                    landsOn: rumorLandsOn(myRow),
                    nextRound,
                  },
                )}
              </p>
            ) : (
              // Refusal reasons in the order they apply: closing round,
              // empty route, then cooldown.
              <p className="text-center text-[11px] text-muted-foreground">
                {closesHere
                  ? rumorClosingLine()
                  : goods.length === 0
                    ? t(
                        "No commodity on this route is traded yet, so there is nothing to say.",
                      )
                    : closedOn}
              </p>
            )}
            {canSpeak && (
              // Both rounds this click is about, read once so the promise
              // and the receipt agree.
              <p className="text-center text-[11px] text-muted-foreground mt-1.5">
                {t(
                  "The port of round {landsOn} prices it. Speaking now quiets the bazaar for you until round {quietUntil}.",
                  { landsOn, quietUntil },
                )}
              </p>
            )}
          </>
        ) : (
          // The non-speaker is told what they can read rather than left
          // with a missing form. The cadence stays in the intro.
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            {t(
              "Speaking at the bazaar belongs to the {SELLER_PATH.name} path, and you do not hold it this voyage. Whoever holds it is named in the voyage log, and the board below names them the moment they speak.",
              { "SELLER_PATH.name": sellerName },
            )}
          </p>
        )}
      </MarketBlock>

      <RefusalLine
        className="text-center mb-2"
        error={bazaar.error}
        onDismiss={bazaar.clearError}
      />

      <RumorList rumors={bazaar.rumors} me={me} game={game} />
    </MarketPanel>
  );
}

/**
 * The board, newest first, limited to two rounds. The client keeps every row
 * because the cooldown is measured off them; the window is only display.
 *
 * The empty claim reads the whole list, not the window: "nobody has spoken
 * this voyage" must stay false after a rumor ages out of view.
 */
function RumorList({
  rumors,
  me,
  game,
}: {
  rumors: PublicRumor[];
  me: PublicUser;
  game: GameState;
}) {
  const shown = rumors.filter((r) => r.round >= game.currentRound - 1);
  if (shown.length === 0) {
    return (
      <MarketEmpty>
        {rumors.length === 0
          ? t("Nobody has spoken at the bazaar yet this voyage.")
          : t(
              "Nobody has spoken in this round or the one before it. The board keeps those two rounds and no more. Older rows moved markets the harbor has already priced and traded through.",
            )}
      </MarketEmpty>
    );
  }
  // Newest first; within a round, the harbor's arrival order reversed is
  // exactly the intended order.
  const ordered = [...shown].reverse();
  return (
    <div className="space-y-1.5">
      {ordered.map((row) => (
        <RumorRow key={row.id} row={row} me={me} game={game} />
      ))}
    </div>
  );
}

/**
 * One row, read by whether the market answered it and by whose it is. The
 * direction clause comes from the engine, so the number read and the
 * number applied are one. Unanswered rows omit it on purpose and say why;
 * the absence is the mechanic.
 */
function RumorRow({
  row,
  me,
  game,
}: {
  row: PublicRumor;
  me: PublicUser;
  game: GameState;
}) {
  const mine = row.publisherUserId === me.id;
  const standing = row.round >= game.currentRound;
  // Only answered rows carry a direction.
  const direction = row.direction;
  // One reader for the round, so the chip and footnote name the same round.
  const landsOn = rumorLandsOn(row);
  // The port's answer, readable only on the round it priced the row and only
  // from this captain's own market; null before the market is drawn.
  const outcome =
    mine && !standing ? rumorLandedLine(row, game.resourceCards) : null;
  return (
    <PathDeskRow mine={mine} stack>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm leading-none" aria-hidden>
          {SELLER_PATH.crest}
        </span>
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            standing ? "text-parley" : "text-muted-foreground",
          )}
        >
          {standing
            ? t("Bazaar · waiting")
            : `Bazaar · ${t(
                "spoken in round {row.round} · priced at round {landsOn}",
                {
                  "row.round": row.round,
                  landsOn,
                },
              )}`}
        </span>
        <span className="font-display text-sm font-semibold">
          {mine ? t("You") : row.publisherName}
        </span>
        {direction !== null && (
          <span className="text-[11px] font-medium rounded-lg px-1.5 py-0.5 border border-parley/25 tabular-nums">
            {rumorDirectionLine({ good: row.good, direction })}
          </span>
        )}
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/80">
        {standing
          ? mine
            ? t(
                "Spoken in this round. The next port prices this good against it, and the table reads which way you leaned the moment it does.",
              )
            : t(
                "Spoken in this round. The direction belongs to the speaker until the next port prices it, so nobody at this table can tell a call from a lie yet.",
              )
          : `${t("The market of this round was priced against it, so the direction is public now.")}${
              outcome ? ` ${outcome}` : ""
            }`}
      </p>
    </PathDeskRow>
  );
}
