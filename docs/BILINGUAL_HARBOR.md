# Bilingual Harbor

PortMasters 2.2 Parallel Release prints in English and Mandarin Chinese. Every captain facing line is paired English to Mandarin. This document states the policy, the keying scheme, the fallback rules and the canonical glossary. It does not reproduce the pack. The pack is the source of truth for translated text.

## Where the pack lives

| Path                                                      | What it is                                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/lib/game/i18n/zh.json`                               | The language pack. Every translated leaf lives here.                                |
| `src/lib/game/i18n/index.ts`                              | The readers: `t`, `tFor`, `tId`, `tIdFor` and `listJoiner`.                         |
| `src/lib/use-language-preference.tsx`                     | The captain's pick, its storage and the provider that redraws the screen.           |
| `src/lib/game/ledger.ts`                                  | The ledger record. Lines are stored as facts and values, not as finished sentences. |
| `scripts/smoke/suites/67-theBilingualHarbor.ts`           | Holds the pack to its contract and walks every call site.                           |
| `scripts/smoke/suites/68-theLedgerReadsInYourLanguage.ts` | Holds the ledger and its reading surfaces to building the sentence at the read.     |

Do not copy the pack into documentation. A table of every string is a second copy that drifts. Link to the file instead.

## Keying scheme

The pack is one JSON object with metadata and nineteen groups:

`terms`, `phases`, `modes`, `difficulty`, `goods`, `food`, `crew`, `ports`, `paths`, `houses`, `renown`, `merits`, `tags`, `systems`, `moments`, `cards`, `ui`, `sentences`, `fragments`.

Each leaf is one pair:

```json
{ "en": "Harbor", "zh": "港湾" }
```

- The everyday reader is keyed by the English source text. A call site writes `t("Harbor")`, and the reader looks up that exact English string. The English literal stays in the source, where the smoke suite can see it.
- Cards are read by id rather than by text: `card.<id>.name` and `card.<id>.desc`, through `tId` or `tIdFor`. A card's words travel with the card.
- Sentence rows use a sweep and number id, such as `shell.001`, `room-a.115` or `lobby.233`. The id organizes the pack and gives the check a stable name. Runtime still reaches the row by its English text.
- Fragments are short words and phrases joined into a sentence by a call site. They are keyed by English like any other leaf.
- The flat text map keeps the earlier leaf when one English string is carried twice. Reads by id are how two surfaces share one word and still differ: the Market phase chip reads 开市, while the market tab reads 集市 through `ui.market`. A duplicate without an id read is reachable only through the earlier leaf.

## Runtime and fallback

The supported locales are `en` and `zh`. The default is `en`.

| Reader                       | Use                                                       |
| ---------------------------- | --------------------------------------------------------- |
| `t(en, params)`              | The current process language, for the screen being drawn. |
| `tFor(locale, en, params)`   | A named language, for a server frame sent to one captain. |
| `tId(id, params)`            | A leaf by id, in the current process language.            |
| `tIdFor(locale, id, params)` | A leaf by id, in a named language.                        |
| `listJoiner(locale)`         | `、` for Mandarin, `, ` for English.                      |

Missing entries fail open:

- An English string with no leaf prints the English itself, in either language.
- An id with no leaf prints the id.
- A token the call did not fill stays on the page as written, braces included. A visible brace is a wiring gap that can be fixed; a silently deleted one is a sentence that reads almost right.

Completeness belongs to the check, not the runtime. Suite 67 walks every `t()`, `tFor()` and `tId()` literal in the source and refuses a literal with no leaf. It also refuses a row that has lost a language, a token that is malformed, a Mandarin leaf that invents a token the English does not carry, and any dash the copy rules forbid.

### Tokens

Tokens are written in braces and interpolated from the call's parameters:

```
{count} coins
{count}金币
```

- A token name is a plain identifier or a dotted identifier. It has no spaces and no nesting.
- Both languages carry the same token names for the values. The words between them may differ freely.
- Mandarin may drop a token the English carries. Mandarin may never invent one.
- English plural helpers such as `{pluralS}` and plural ternaries collapse into one Chinese form. Chinese has no plural.
- Lists join with `、` in Mandarin and `, ` in English. The separator is a language fact; the call site supplies the items.

### The captain's pick

The pick is stored in `localStorage` under `portmasters_language` and mirrored to the `pm_locale` cookie. The server reads the cookie at the socket handshake, because it composes some captain facing lines and has no other way to know which language the captain reads. The document's `lang` attribute follows the pick on the next render and on a fresh load.

The pick applies at once. A captain who changes language sees the game change under them rather than at the next voyage. The ledger is built at the read for the same reason: a stored sentence would freeze the language it was written in.

## Voice and register

The Mandarin edition of the game is the baseline. Its word wins wherever a Song era harbor register would puzzle more than it clarifies. Prefer the concrete trade word to a literary flourish, and prefer the word a captain would actually say.

These written exceptions are deliberate and should not be normalized away:

| English      | Mandarin | Why                                                                                                |
| ------------ | -------- | -------------------------------------------------------------------------------------------------- |
| Broker       | 掮客     | A living trade word. The edition's institutional word is 牙行, which does not fit the person slot. |
| Wages        | 工钱     | The word a captain says. The edition uses 工资 across the payroll family.                          |
| Convoy       | 镖行     | The old word for the protection trade, which is what the path sells.                               |
| Boon         | 机缘     | The established term in this interface. The edition's mechanic word is 福缘.                       |
| Golden Lotus | 金荷     | The same flower as 金莲 without the 潘金莲 association for modern readers.                         |
| Ocean Gambit | 暗潮     | A coined compound such as 沧海暗局 reads constructed.                                              |

Other rules:

- Address the captain as 你. Do not use 您.
- Keep the English's direct, dry tone. Do not add formality, jokes or explanation that the English does not carry.
- Do not invent a new classical compound when the edition already has a plain word.
- Keep the established product names: PortMasters, Sea Master, Captain's Legacy, the House names and the path names.
- The 67 crew names are transliterated in the pack in the register the roster already uses: Arabic, Persian, Indian, Chinese and European names side by side. Do not duplicate the list here.

## Capitalization and punctuation

- The English `en` string is the casing authority. Short labels and buttons are mostly title case; full sentences and tooltips are sentence case. A translation pass does not recase the English.
- Chinese has no capitalization. Do not simulate title case with Latin capitals.
- Proper nouns keep their established forms. A name that stays in Latin keeps its source casing.
- Mandarin prose uses full width punctuation: `，` `。` `：` `；` `！` `？` and full width parentheses.
- Mandarin writes the ellipsis as three ASCII dots, `...`. English leaves keep the form already in the source, which is usually a single ellipsis character and sometimes three dots. A translation pass does not change either.
- Code, HTML, CSS values, tokens and command text stay ASCII and are not translated.
- Card values use the tight form: `{cost}金币`, `2麻布`, `{rounds}轮`. Other prose keeps the spacing already in the leaf. Do not change the spacing of numbers and units in a wording pass.
- Do not use em dashes, en dashes, doubled hyphens or a hyphen standing in for punctuation between words in captain facing copy. A single hyphen inside a compound word is allowed. `npm run check:prose` enforces the rule in Markdown, MDX and text files, the environment template and the bilingual language pack. The smoke suite checks captain facing copy.

## Core terminology

These are the words every screen leans on. Spell each one the same way everywhere.

| English              | Chinese    | Note                                                         |
| -------------------- | ---------- | ------------------------------------------------------------ |
| Gold                 | 金币       |                                                              |
| Captain              | 船长       |                                                              |
| Harbor               | 港湾       |                                                              |
| Port                 | 港         | As a suffix, as in 泉州港 and 大食港.                        |
| Host                 | 港主       | The captain who opens the harbor.                            |
| Seat                 | 席位       |                                                              |
| Renown               | 声望       | The account level that persists across voyages.              |
| Reputation           | 声誉       | The score inside one voyage. Kept apart from 声望.           |
| Captain's Legacy     | 船长传承   |                                                              |
| Merits               | 功勋       |                                                              |
| Sea Master           | 沧海之主   | The voyage crown.                                            |
| Sea Master crowns    | 沧海之冠   |                                                              |
| Voyage               | 航程       | The whole run.                                               |
| Round                | 轮         | One lap of a voyage, from the first phase to the last.       |
| Trade order          | 订单       |                                                              |
| Locked order         | 专属订单   |                                                              |
| Manifest             | 舱单       |                                                              |
| Path                 | 商道       | The captain's identity. The older word 路径 is retired.      |
| Boon                 | 机缘       | The card kind.                                               |
| Module               | 模块       | The card kind.                                               |
| Module batch         | 模块批次   | The three cards on the draft table.                          |
| Charter              | 特许状     | Chip form 特许.                                              |
| Draft                | 抽取       | The drawing verb across phase chips, labels and buttons.     |
| Hold                 | 货舱       |                                                              |
| Cargo                | 货物       |                                                              |
| Stores               | 存粮       |                                                              |
| Larder               | 粮舱       |                                                              |
| Pantry               | 伙房       |                                                              |
| Rations              | 口粮       |                                                              |
| Cargo slot           | 仓位       |                                                              |
| Freight              | 运费       |                                                              |
| Hull                 | 船体       | The ship itself, as distinct from its level.                 |
| Ship level           | 船只等级   | The upgrade rung that sets slots and freight discount.       |
| Ship maintenance fee | 船只维护费 | Short form 维护费 where the sentence already names the ship. |
| Wages                | 工钱       |                                                              |
| Severance            | 遣散费     |                                                              |
| VAT                  | 增值税     |                                                              |
| Income tax           | 所得税     |                                                              |
| Harbor dues          | 港务费     |                                                              |
| Settlement           | 结算       |                                                              |

## Phases and modes

The phase rail uses a long face and a short face. A phase with no short entry uses its label.

| English                 | Chinese         |
| ----------------------- | --------------- |
| In Harbor / Pier        | 在港 / 码头     |
| Path Draft / Paths      | 择道 / 商道     |
| Dawn                    | 破晓            |
| Market / Buy            | 开市 / 采购     |
| Orders                  | 订单            |
| Parley                  | 洽谈            |
| Resolve / Settle        | 结算            |
| Dusk / Yard             | 暮色 / 船坞     |
| Drafting Module / Draft | 抽取模块 / 抽取 |
| Swapping Module / Swap  | 切换模块 / 切换 |
| Bankrupt                | 破产            |
| Voyage Ended            | 航程结束        |

| Mode or tier   | Chinese  |
| -------------- | -------- |
| Classic        | 经典     |
| Ocean Gambit   | 暗潮     |
| Fair Winds     | 顺风     |
| Open Waters    | 开阔水域 |
| Monsoon Season | 季风时节 |

## Goods and food

| English        | Chinese  | English        | Chinese  |
| -------------- | -------- | -------------- | -------- |
| Hemp           | 麻布     | Silk           | 丝绸     |
| Tea            | 茶叶     | Porcelain Clay | 瓷土     |
| Copper Ore     | 铜矿石   | Spices         | 香料     |
| Pearls         | 珍珠     | Linen Clothes  | 麻衣     |
| Cotton Clothes | 布衣     | Brocade        | 绫罗绸缎 |
| Sachet         | 香囊     | Bronze Mirror  | 铜镜     |
| Celadon Ware   | 青瓷     | Foreign Balm   | 异域香膏 |
| Pearl String   | 珠串     | Rags           | 碎布     |
| Grain          | 米粮     | Salt Fish      | 咸鱼     |
| Produce        | 时鲜     | Meal           | 餐       |
| Short rations  | 减半口粮 | To preserve    | 腌制     |
| Supply Barge   | 补给驳船 | Barge rations  | 驳船口粮 |

## Crew

| English               | Chinese | English                 | Chinese  |
| --------------------- | ------- | ----------------------- | -------- |
| Weaver / Weavers      | 织女    | Master Weaver / Masters | 纺织大师 |
| Sachet Maker / Makers | 香囊师  | Coppersmith             | 铜匠     |
| Potter                | 陶匠    | Perfumer                | 调香师   |
| Jeweler               | 珠匠    |                         |          |

Chinese has no plural, so each pair collapses into one word and the sentence adapts.

## Ports and paths

The nine ports: Quanzhou Port 泉州港, Guangzhou Port 广州港, Ningbo Port 宁波港, Yangzhou Port 扬州港, Hangzhou Port 杭州港, Fuzhou Port 福州港, Goryeo Port 高丽港, Srivijaya Port 三佛齐港 and Dashi Port 大食港. Srivijaya is 三佛齐, the Song era name; 室利佛逝 is the Tang transliteration.

| Path          | Chinese  | What it does                                                             |
| ------------- | -------- | ------------------------------------------------------------------------ |
| Convoy        | 镖行     | Sells one round of protection to another captain.                        |
| Loom          | 织造     | Refits another captain's garments at port.                               |
| Aroma         | 风声     | Publishes a rumor that moves the next port's price for one good.         |
| Free Captain  | 自由船长 | Fills one locked order a voyage at forty percent off the payout.         |
| Quartermaster | 司库     | Supplies the fleet with the largest hold and the highest Renown ceiling. |

## Houses

| English                          | Chinese              |
| -------------------------------- | -------------------- |
| Great House                      | 世家                 |
| House Standing                   | 世家口碑             |
| Jade Pavilion                    | 玉阁                 |
| Patience polishes the stone.     | 静以待时，玉自成器。 |
| Vermilion Gate                   | 朱门                 |
| The gate is open to every cargo. | 朱门开，百货运。     |
| Golden Lotus                     | 金荷                 |
| Fortune favors the bold wager.   | 敢下注，好运自来。   |

## Named systems and interface terms

| English          | Chinese    | English            | Chinese  |
| ---------------- | ---------- | ------------------ | -------- |
| Broker           | 掮客       | Broker's Whisper   | 掮客密语 |
| Broker's Favor   | 掮客的人情 | Honest Broker      | 诚信掮客 |
| Corrupt Broker   | 通匪掮客   | Word on the Docks  | 码头风闻 |
| Tidewatch Alerts | 观潮预警   | Ventures           | 合股     |
| Backing (a loan) | 作保       | Captain's Exchange | 船长行市 |
| Manifest Audit   | 舱单稽查   | Maroon             | 放逐     |
| Harbormaster     | 港务长     | Imperial Mandate   | 皇命采办 |
| Fleet Commission | 船队公议   | Standing Order     | 常备订单 |
| Salvage          | 打捞       | Escort             | 护航     |
| Pirate raid      | 海盗劫掠   | Market             | 集市     |
| Port Purchase    | 港口采购   | Artisan Bench      | 工匠台   |
| Warmth           | 暖意       | Frostbite          | 冻伤     |
| Wardrobe         | 衣箱       | Shipyard           | 船坞     |
| Hull             | 船体       | Upgrade            | 升级     |

## Renown, ratings and the long game

| English             | Chinese  | English             | Chinese  | English           | Chinese      |
| ------------------- | -------- | ------------------- | -------- | ----------------- | ------------ |
| Deckhand            | 甲板水手 | Able Seaman         | 一等水手 | Trade Officer     | 通商官       |
| Harbor Captain      | 港湾船长 | Fleet Commodore     | 船队提督 | Silk Road Legend  | 丝路传奇     |
| Silk Road Sovereign | 丝路霸主 | King of Silk Road   | 丝路之王 | Maritime Tycoon   | 海上贸易大亨 |
| Successful Merchant | 成功商人 | Qualified Trader    | 合格商人 | Novice Merchant   | 新手商人     |
| Renown Level        | 声望等级 | Renown XP           | 声望经验 | Voyages Completed | 完成航程     |
| Best Reputation     | 最佳声誉 | The merchant ledger | 商名录   | Leaderboard       | 排行榜       |
| Lobby               | 大厅     | Standings           | 排名     |                   |              |

The six base merits named in the interface: First Landfall 初登彼岸, Sea Master 沧海之主, King of Silk Road 丝路之王, Silk Road Sovereign 丝路霸主, Iron Hull 铁船体, Century Club 百程会. The three difficulty scoped merits are Open Water Captain 开阔水域船长, Storm Sovereign 风暴之主, and Eye of the Storm 风暴之眼. The five milestone moments deal boons rather than grant merits: A Hand Is Lost 痛失一臂, The Route Knows You 商道识君, A Rung Crossed 又晋一阶, Through the Cold 既渡寒程, and The Fleet's Commission 船队公议. The charter card is Your Charter 你的特许状.

## Tags

| English   | Chinese | English | Chinese | English    | Chinese |
| --------- | ------- | ------- | ------- | ---------- | ------- |
| Cold      | 御寒    | Bulk    | 散货    | Perishable | 易腐    |
| Preserved | 耐储    | Woven   | 织物    | Luxury     | 奢华    |
| Armed     | 武装    | Crewed  | 人手    | Contraband | 私货    |
| Sealed    | 封验    | Public  | 公开    | Debt       | 债务    |

## Card names

| English               | Chinese      | English                | Chinese      | English             | Chinese  |
| --------------------- | ------------ | ---------------------- | ------------ | ------------------- | -------- |
| Weaver's Winds        | 织风         | Favorable Tides        | 顺风顺水     | Merchant's Charm    | 商贾魅力 |
| Artisan's Inspiration | 工匠灵感     | Emergency Loan         | 紧急钱庄     | Tax Shelter         | 免税令   |
| Bulk Monopoly         | 大宗垄断     | Master's Apprentice    | 学徒传承     | Farsight            | 远见     |
| Kiln and Forge Guild  | 窑炉行会     | Frontier Tariff Relief | 关津减税     | Exotic Treasures    | 异域奇珍 |
| Deep Sea Escort Pact  | 远洋护航契约 | Merchants Converge     | 商贾云集     | Steady Watch        | 守望     |
| Cold Hardened         | 耐寒         | Route Mastery          | 商道精通     | Harbor Credit       | 港湾信用 |
| Fleet Colors          | 船队旗帜     | Smuggler's Hold        | 走私暗舱     | Bulk Hauler Rigging | 散货索具 |
| Artisan's Workshop    | 工匠工坊     | Tax Evasion Ledger     | 避税账本     | Woven Monopoly      | 织物垄断 |
| Broker's Network      | 掮客人脉     | Salvage Crane          | 打捞起重机   | Overdrive Engine    | 超载引擎 |
| Maritime Bureau Token | 市舶司信物   | Kiln Cellar            | 窑窖         | Ocean Interpreter   | 通译     |
| Foreign Quarter Pass  | 蕃坊通行证   | Persian Dome Compass   | 波斯穹顶罗盘 | Fleet of Treasures  | 珍宝船队 |
| The Bulk Charter      | 大宗特许     | The Standing Manifest  | 常备舱单     | The Gun Charter     | 火炮特许 |
| The Standing Escort   | 常备护航     | The Weavers' Charter   | 织女特许     | The Quality Mark    | 品质印记 |
| The Long Ledger       | 长账簿       | The Quiet Account      | 静默账户     | The Factor          | 管事     |
| The Letter of Marque  | 私掠许可证   |                        |              |                     |          |

## Changing the pack

1. Change the English source first. The English literal is the key, so changing it without adding the matching leaf leaves the old translation unreachable.
2. Add or update the leaf with the same `en` value and the reviewed `zh` value. Keep the group and the key in their existing order.
3. Preserve every token. Mandarin may drop a token, but it may not invent one.
4. Run `npm run build` and `npm run test:smoke`. The build typechecks the Cloudflare Worker and runs the tag, card, status, dead surface, prose, palette and private checks. The smoke suite runs the bilingual contract, the ledger reading and the rest of the battery.
5. Do not run a leaf through machine translation and add it without review. A leaf that reads correctly in isolation can break a sentence whose subject or classifier lives in another leaf.
6. Do not add a third language by editing JSON alone. `LOCALES` in `src/lib/game/i18n/index.ts` is the list the picker offers, the reader accepts and the checks walk. A new language needs that list, the pack and the picker copy together.

The ledger is not a normal string table. A ledger line stores the fact and its values, and the sentence is built at the read in the language the reader holds. A good's name, a path's name and a card's name travel with the sentence rather than being frozen into it. Suite 68 holds that rule at the ledger and at the three surfaces that read it.
