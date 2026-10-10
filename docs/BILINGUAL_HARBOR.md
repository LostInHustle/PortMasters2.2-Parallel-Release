# Bilingual Harbor, the complete Chinese mapping

This is the complete pass at the Chinese. The vocabulary and the card records came first, then the interface labels, and now the whole surface: every remaining line a captain can read, swept batch by batch and gathered below. J3 asks for one thing above all: no string in only one language, held by a check rather than by review. This document is the review half, so the check has something to enforce.

Two facts shape everything below. First, the card records were built bilingual from the start (`LANGUAGES`, `SHIPPED_LANGUAGE` in `src/lib/game/constants/cards.ts`), so this is a translation pass, not a change to the record. Second, all 43 records already carry zh strings, and most of them are good. I kept 52 of the 86 card strings exactly as they stand. The other 34 are listed card by card below with a reason for each.

The Bilingual Harbor was built once before and removed at your request, and the docs pin it as not returning without a fresh call. This pass is that call, shaped as the plan's J3. When it ships I'll update `PROPOSAL.md`, `RELEASE_NOTES.md` and `SYSTEM_ANALYSIS.md` together, since all three currently say it stays dropped.

**How to read this.** Each table is a list of decisions. Quote a row and say what you want, for example "the market phase: 集市, not 开市" or "Smuggler's Hold, drop the 进价 change". Anything you leave unmentioned I'll take as it stands. The sentence tables below the labels are the bulk of the document: every remaining line a captain can read in the game, one row per string. When the last row settles, these tables and the complete file draft at the end become `src/lib/game/i18n/zh.json`.

**On voice.** I wrote to a Song era harbor register, where the classical word tends to also be the precise one: 市舶税 for the tax the 市舶司 collects, 掮客 for the broker, 工钱 for wages, 镖行 for the protection trade. Where a classical word would puzzle more than it clarifies, I stayed plain. The tree's existing Chinese mostly agrees with this; where it drifts plainer, the card tables say so one by one.

---

## The core terms

The words every screen leans on, spelled one way everywhere.

| English             | Chinese  | Notes                                                                                                               |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| Gold                | 金币     | matches all 43 shipped strings ("4 金币")                                                                           |
| Captain             | 船长     |                                                                                                                     |
| Harbor (the room)   | 港湾     | as in "gather in the harbor", 在港湾集合                                                                            |
| Port                | 港       | 泉州港, 大食港                                                                                                      |
| Host                | 港主     | the one who opens the harbor                                                                                        |
| Seat                | 席位     |                                                                                                                     |
| Renown              | 声望     | the account level that persists                                                                                     |
| Reputation          | 声誉     | the score inside one voyage; kept apart from 声望 on purpose                                                        |
| Score               | 积分     |                                                                                                                     |
| Captain's Legacy    | 船长传承 |                                                                                                                     |
| Merits              | 功勋     |                                                                                                                     |
| Sea Master          | 沧海之主 | the voyage crown                                                                                                    |
| Sea Master crowns   | 沧海之冠 |                                                                                                                     |
| Voyage              | 航程     |                                                                                                                     |
| Round               | 轮       | "本轮" already ships in 30 plus strings                                                                             |
| Leg                 | 航段     | plain 段 inside a sentence that already says 航程                                                                   |
| Trade order         | 委托     | the tree says 订单 today; see the note at the end                                                                   |
| Locked order        | 专属委托 |                                                                                                                     |
| Manifest            | 舱单     | already ships                                                                                                       |
| Path                | 商道     | the tree says 路径 today; 商道 carries the identity better and reads naturally everywhere: 沿你商道的委托, 商道精通 |
| Boon (card kind)    | 机缘     |                                                                                                                     |
| Module (card kind)  | 模块     |                                                                                                                     |
| Charter (card kind) | 特许状   | chip form 特许; already ships across the ten charter names                                                          |
| Draft (a card)      | 抽取     | the drawing verb, one word across the phase chip, the labels and the buttons                                        |
| Hold                | 货舱     | already ships                                                                                                       |
| Cargo               | 货物     |                                                                                                                     |
| Stores              | 存粮     |                                                                                                                     |
| Larder              | 粮舱     |                                                                                                                     |
| Pantry              | 伙房     |                                                                                                                     |
| Rations             | 口粮     |                                                                                                                     |
| Cargo slot          | 仓位     |                                                                                                                     |
| Freight             | 运费     | already ships                                                                                                       |
| Ship maintenance    | 维护费   | already ships                                                                                                       |
| Wages               | 工钱     | the tree says 工资 today                                                                                            |
| Severance           | 遣散费   |                                                                                                                     |
| VAT                 | 市舶税   | the tree says 增值税 today; the tree also already ships 市舶司信物                                                  |
| Income tax          | 所得税   | already ships                                                                                                       |
| Harbor dues         | 港务费   |                                                                                                                     |
| Settlement          | 结算     | already ships as the Resolve short                                                                                  |

---

## Phases

The rail's faces, from `PHASE_FACES`. Long face first, compact form second.

| English                 | Chinese (long / short) | Icon |
| ----------------------- | ---------------------- | ---- |
| In Harbor / Pier        | 在港 / 码头            | ⚓   |
| Path Draft / Paths      | 择道 / 商道            | 🃏   |
| Dawn                    | 破晓                   | 🧭   |
| Market / Buy            | 开市 / 采购            | 📦   |
| Orders                  | 委托                   | 📜   |
| Parley                  | 洽谈                   | 🤝   |
| Resolve / Settle        | 结算                   | 💸   |
| Dusk / Yard             | 暮色 / 船坞            | 🚢   |
| Drafting Module / Draft | 抽取模块 / 抽取        | 🧩   |
| Swapping Module / Swap  | 切换模块 / 切换        | ♻️   |
| Bankrupt                | 破产                   | 💥   |
| Voyage Complete / Done  | 航程圆满 / 完成        | 🏆   |

## Modes and difficulty

| English                                                                                                                                                                              | Chinese                                                                                                          | Notes                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Classic (badge)                                                                                                                                                                      | 经典                                                                                                             |                                                                                                 |
| The harbor as it has always run.                                                                                                                                                     | 港湾一如既往。                                                                                                   |                                                                                                 |
| The founding voyage. Buy the port, work the orders, trade with the table between rounds, settle, and refit.                                                                          | 最初的航程。在港口采买，交付委托，与同席船长互通有无，结算账目，再整备船只。                                     |                                                                                                 |
| Ocean Gambit (badge)                                                                                                                                                                 | 暗潮                                                                                                             | the hidden card is the tide under the surface; a coined compound like 沧海暗局 read constructed |
| Orders lock before the table opens.                                                                                                                                                  | 委托先落定，众人再开口。                                                                                         |                                                                                                 |
| Trade orders are committed before the social window opens, so a promise about what you are going to do can be broken invisibly.                                                      | 委托在众人开口之前便已落定，一句承诺能否兑现，旁人无从知晓。                                                     |                                                                                                 |
| Fair Winds                                                                                                                                                                           | 顺风                                                                                                             |                                                                                                 |
| A gentle passage for new captains.                                                                                                                                                   | 新船长的一段轻松航路。                                                                                           |                                                                                                 |
| Eight rounds on the founding trade. A short, legible voyage with room to learn the rhythm before the money runs tight.                                                               | 八轮初创贸易，用一段简短而精炼的旅程，让你在陷入贫困之前熟悉游戏节奏。                                           |                                                                                                 |
| Open Waters                                                                                                                                                                          | 开阔水域                                                                                                         |                                                                                                 |
| The full trade opens as the harbor grows busy.                                                                                                                                       | 港湾渐忙，货路全开。                                                                                             |                                                                                                 |
| Twelve rounds. The charter opens twice and the market swells from six cards to ten, with pirates that begin to bite past the midpoint.                                               | 十二轮贸易，特许开放两次，货架由六张增至十张。半程过后，海盗开始汹涌来袭。                                       |                                                                                                 |
| Monsoon Season (badge: Monsoon)                                                                                                                                                      | 季风时节 (季风)                                                                                                  |                                                                                                 |
| A long, adversarial haul for seasoned captains.                                                                                                                                      | 老船长的漫长险途。                                                                                               |                                                                                                 |
| Sixteen rounds, back loaded and unforgiving. The market swells to eleven cards, the largest imperial mandates fall late, and a corrupt broker may leak your position to the pirates. | 十六轮贸易，重负在背，毫不留情。货架扩至十一张，最重要的皇命采办压在尾声。通匪的掮客甚至可能向海盗泄露你的位置。 |                                                                                                 |

## Goods

| English        | Chinese  | Tags it carries |
| -------------- | -------- | --------------- |
| Hemp           | 麻布     | 散货, 织物      |
| Silk           | 丝绸     | 织物, 奢华      |
| Tea            | 茶叶     | 易腐            |
| Porcelain Clay | 瓷土     | 散货            |
| Copper Ore     | 铜矿石   | 散货            |
| Spices         | 香料     | 奢华, 易腐      |
| Pearls         | 珍珠     | 奢华            |
| Linen Clothes  | 麻衣     | 织物, 御寒      |
| Cotton Clothes | 布衣     | 织物, 御寒      |
| Brocade        | 绫罗绸缎 | 织物, 御寒      |
| Sachet         | 香囊     | 封验, 奢华      |
| Bronze Mirror  | 铜镜     | 奢华            |
| Celadon Ware   | 青瓷     | 奢华, 封验      |
| Foreign Balm   | 异域香膏 | 封验, 奢华      |
| Pearl String   | 珠串     | 奢华            |
| Rags           | 碎布     | 织物            |

丝绸 is silk, the edition's own word for the item, and the recipes weave it into the clothing line. Cotton Clothes weaves hemp and silk in the recipes; I kept the name faithful to the English anyway.

## Food and the larder

| English       | Chinese  | Notes                       |
| ------------- | -------- | --------------------------- |
| Grain         | 米粮     | 谷物 if you want it plainer |
| Salt Fish     | 咸鱼     |                             |
| Produce       | 时鲜     | 蔬果 as the alternate       |
| Meal          | 餐       | "three meals" reads 三餐    |
| Short rations | 减半口粮 |                             |
| To preserve   | 腌制     |                             |
| Supply Barge  | 补给驳船 |                             |
| Barge rations | 驳船口粮 |                             |
| Ration price  | 口粮单价 |                             |

## Crew

| English (singular and plural) | Chinese  | Icon |
| ----------------------------- | -------- | ---- |
| Weaver / Weavers              | 织女     | 👩‍🔧   |
| Master Weaver / Masters       | 纺织大师 | 👩‍🎨   |
| Sachet Maker / Makers         | 香囊师   | 🌸   |
| Coppersmith                   | 铜匠     | 🪞   |
| Potter                        | 陶匠     | 🫖   |
| Perfumer                      | 调香师   | 🧴   |
| Jeweler                       | 珠匠     | 📿   |

Chinese has no plural, so each pair collapses into one word and the sentences adapt. The 67 names, transliterated in the register the roster already runs in: Arabic, Persian, Indian, Chinese and European names side by side, the way a Song era port crew read.

| en     | zh     | en     | zh       | en     | zh       | en    | zh     |
| ------ | ------ | ------ | -------- | ------ | -------- | ----- | ------ |
| Ada    | 阿黛   | Adil   | 阿迪勒   | Aiko   | 爱子     | Amara | 阿玛拉 |
| Anil   | 阿尼尔 | Anouk  | 阿努克   | Arjun  | 阿琼     | Asha  | 阿莎   |
| Bram   | 布拉姆 | Cassia | 卡西娅   | Chen   | 陈       | Corin | 科林   |
| Dara   | 达拉   | Dev    | 德夫     | Dilara | 迪拉拉   | Emeka | 埃梅卡 |
| Enzo   | 恩佐   | Farah  | 法拉     | Fen    | 芬       | Gita  | 吉塔   |
| Hakon  | 哈康   | Hana   | 哈娜     | Idris  | 伊德里斯 | Imani | 伊玛尼 |
| Ines   | 伊内丝 | Isolde | 伊索尔德 | Jaya   | 贾娅     | Jonas | 乔纳斯 |
| Kavi   | 卡维   | Kiran  | 基兰     | Lena   | 莉娜     | Lian  | 莲     |
| Mabel  | 梅布尔 | Malik  | 马利克   | Maren  | 玛伦     | Mateo | 马特奥 |
| Mina   | 米娜   | Nadia  | 娜迪亚   | Nia    | 妮娅     | Noor  | 努尔   |
| Odile  | 奥迪尔 | Oren   | 奥伦     | Pia    | 皮娅     | Priya | 普里娅 |
| Rafi   | 拉菲   | Rhea   | 蕾娅     | Roshan | 罗山     | Runa  | 露娜   |
| Sana   | 萨娜   | Selma  | 塞尔玛   | Shaan  | 沙安     | Sora  | 索拉   |
| Sunil  | 苏尼尔 | Tam    | 谭       | Tara   | 塔拉     | Teo   | 特奥   |
| Thandi | 坦迪   | Tomas  | 托马斯   | Uma    | 乌玛     | Vasco | 瓦斯科 |
| Vera   | 薇拉   | Wren   | 瑞恩     | Yara   | 雅拉     | Yusuf | 优素福 |
| Zaid   | 扎伊德 | Zara   | 扎拉     | Zoya   | 卓娅     |       |        |

## Ports

泉州港、广州港、宁波港、扬州港、杭州港、福州港、高丽港、三佛齐港、大食港.

Srivijaya is 三佛齐, the Song era name (室利佛逝 is the Tang transliteration if you prefer it). Goryeo and Dashi are already the Chinese words.

## The five paths

| English       | Chinese  | The signature sentence, in Chinese                                                                   |
| ------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| Convoy        | 镖行     | 为他人护货：把一段航段的护卫按双方议定的价钱卖出，本该落在对方头上的劫掠，改由你的炮口接下。         |
| Loom          | 织造     | 在港口为他人的衣物整补翻新，比他们亲自打理更快、更省，并握有织成它们的整条工序。                     |
| Aroma         | 香市     | 放出风声，拨动某件货物在下一港的价钱。船队看得见你开了口、点的是哪件货，只有你知道自己押的是哪一边。 |
| Free Captain  | 自由船长 | 每航程一次，不入商道也能交付任意一份专属委托，报酬降低40%。                                          |
| Quartermaster | 司库     | 为船队供给：全桌最大的货舱、最高的声望上限，以及决定饥饿的船员还能吃多久的那个席位。                 |

镖行 is the old word for the protection trade, which is exactly what Convoy sells. 香市 is the historical incense market; if you would rather the rumor sense lead, 风声 is the alternate. On a card that waits on a path: 唯有镖行的船长才能交付这份专属委托。

## Houses

| English                                                                          | Chinese                                          | Notes                                                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Great House                                                                      | 世家                                             |                                                                                               |
| House Standing                                                                   | 世家口碑                                         | 世家名望 as the alternate                                                                     |
| Jade Pavilion                                                                    | 玉阁                                             | 🪷                                                                                            |
| Patience polishes the stone.                                                     | 静以待时，玉自成器。                             |                                                                                               |
| Your first artisan each voyage joins at no cost: the first wage is on the House. | 每程首位入伙的工匠不收钱，头一笔工钱由本阁代付。 |                                                                                               |
| Vermilion Gate                                                                   | 朱门                                             | 🏮                                                                                            |
| The gate is open to every cargo.                                                 | 朱门开，百货运。                                 |                                                                                               |
| One more cargo lot joins your Port Purchase board, every round.                  | 港口采购板上每轮多一件货。                       |                                                                                               |
| Golden Lotus                                                                     | 金荷                                             | 🏵️ 金莲 carries the 潘金莲 association for modern readers; 金荷 is the same flower without it |
| Fortune favors the bold wager.                                                   | 敢下注，好运自来。                               |                                                                                               |
| Wages cost 20% less, but pirate raids strike 5% more often.                      | 工钱省 20%，但海盗劫掠多出 5%。                  |                                                                                               |

## Renown, ratings, legacy

| English                              | Chinese        |
| ------------------------------------ | -------------- |
| Deckhand                             | 甲板水手       |
| Able Seaman                          | 一等水手       |
| Trade Officer                        | 通商官         |
| Harbor Captain                       | 港湾船长       |
| Fleet Commodore                      | 船队提督       |
| Silk Road Legend                     | 丝路传奇       |
| Silk Road Sovereign                  | 丝路霸主       |
| King of Silk Road                    | 丝绸之路霸主   |
| Maritime Tycoon                      | 海上贸易大亨   |
| Successful Merchant                  | 成功商人       |
| Qualified Trader                     | 合格商人       |
| Novice Merchant                      | 新手商人       |
| The merchant ledger (the rung table) | 商名录         |
| Renown Level                         | 声望等级       |
| Renown XP                            | 声望经验       |
| Voyages Completed                    | 完成航程       |
| Best Score                           | 最佳积分       |
| Consecutive solvent voyages          | 连续不破产航程 |
| Leaderboard                          | 排行榜         |
| Lobby                                | 大厅           |
| Standings                            | 排名           |

## Merits

| English                                                 | Chinese              |
| ------------------------------------------------------- | -------------------- |
| First Landfall                                          | 初登彼岸             |
| Complete your first voyage.                             | 完成你的第一次航程。 |
| Sea Master                                              | 沧海之主             |
| Get crowned Sea Master for the first time.              | 首次荣登沧海之主。   |
| Iron Hull                                               | 铁骨船               |
| Complete three voyages in a row without going bankrupt. | 连续三次航程不破产。 |
| Century Club                                            | 百程会               |
| Complete ten voyages.                                   | 完成十次航程。       |

## Tags

The twelve chips. Their one sentence meanings are glossary prose, carried in the sentence tables below.

| English    | Chinese |
| ---------- | ------- |
| Cold       | 御寒    |
| Bulk       | 散货    |
| Perishable | 易腐    |
| Preserved  | 耐储    |
| Woven      | 织物    |
| Luxury     | 奢华    |
| Armed      | 武装    |
| Crewed     | 人手    |
| Contraband | 私货    |
| Sealed     | 封验    |
| Public     | 公开    |
| Debt       | 债务    |

## Named systems

| English                                       | Chinese                | Notes                                                         |
| --------------------------------------------- | ---------------------- | ------------------------------------------------------------- |
| Broker                                        | 掮客                   | the tree says 中间人 today                                    |
| Broker's Rumor                                | 掮客传闻               | the thing you buy                                             |
| Broker's Whisper                              | 掮客低语               | flagged below, since two English names cover one system today |
| Broker's Favor                                | 掮客的人情             |                                                               |
| Honest Broker                                 | 诚信掮客               |                                                               |
| Corrupt Broker                                | 通匪掮客               | the one who leaks your position                               |
| Word on the Docks                             | 码头风闻               |                                                               |
| Tidewatch Alerts                              | 观潮预警               |                                                               |
| Ventures                                      | 合股                   |                                                               |
| Backing (a loan)                              | 作保                   |                                                               |
| Captain's Exchange                            | 船长行市               | the barter board; 船长交易所 if you want it plainer           |
| Manifest Audit                                | 舱单稽查               |                                                               |
| Maroon (the vote ashore)                      | 放逐                   |                                                               |
| Harbormaster                                  | 港务长                 |                                                               |
| Imperial Mandate                              | 皇命采办               | chip form 皇命                                                |
| The fleet's commission (the shared objective) | 公议                   | the cards are private, the 公议 is shared                     |
| Standing Order                                | 常备委托               |                                                               |
| Salvage                                       | 打捞                   |                                                               |
| Escort                                        | 护航                   | already ships                                                 |
| Pirate raid                                   | 海盗劫掠               |                                                               |
| Market, Port Purchase, Artisan Bench          | 集市, 港口采购, 匠作台 |                                                               |

## Milestone moments

| English                                                                                       | Chinese                                                    |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| A Hand Is Lost                                                                                | 痛失一臂                                                   |
| A hand is gone and nothing brings them back. Choose what the crew carries from here.          | 逝者已矣，无可挽回。接下来的路，船员带些什么，由你来定。   |
| The Route Knows You                                                                           | 商道识君                                                   |
| Your first order along your path is filled. Take something the route earned you.              | 商道上的第一份委托已经交付。取走这条航路为你赢得的东西。   |
| A Rung Crossed                                                                                | 又晋一阶                                                   |
| Your Reputation has crossed a rung of the merchant ledger. Take what a known name is worth.   | 你的声誉越过了商名录上的一阶。名号既响，取走它应得之物。   |
| Through the Cold                                                                              | 既渡寒程                                                   |
| A cold leg, and every hand came through it. Take something from the water you weathered.      | 一段寒程，全船安然渡过。从这段风浪里，取走你应得之物。     |
| The Fleet's Commission                                                                        | 船队公议                                                   |
| You answered the fleet's commission. Take something for the shared work.                      | 你为船队的公议出了力。为这桩共同的差事，取走一份报酬。     |
| Your Charter (the leg four moment)                                                            | 你的特许状                                                 |
| One charter carries your ship for the rest of the voyage. Choose the one you will sail under. | 一份特许状将陪你走完余下的航程。选择此后随你扬帆的那一份。 |

---

## The card pool

The three tables below walk all 43 records. "In the tree now" is the shipped zh, "Proposed" is the frozen target; where the two match, your existing Chinese stands. Every change is a word swap inside the vocabulary above rather than a rewrite.

### Boons (19)

| Card                   | Chinese      | In the tree now                                  | Proposed                                                    | Why                                                        |
| ---------------------- | ------------ | ------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------- |
| Weaver's Winds         | 织风         | 本轮织物类货物的运费减半。                       | as is                                                       |                                                            |
| Favorable Tides        | 顺流         | 本轮基础运费降低 4 金币。                        | as is                                                       |                                                            |
| Merchant's Charm       | 商人魅力     | 本轮港口采购降价 15%。                           | 生意经                                                      | 生意经 is the merchant's knack, said the way people say it |
| Artisan's Inspiration  | 匠人灵感     | 本轮所有工匠多产出 1 件。                        | as is                                                       |                                                            |
| Emergency Loan         | 应急借款     | 立即获得 40 金币，无需偿还。                     | as is                                                       |                                                            |
| Tax Shelter            | 避税账户     | 本轮所得税率降至 5%。                            | as is                                                       |                                                            |
| Bulk Monopoly          | 大宗垄断     | 本轮大宗货物每单位便宜 2 金币。                  | as is                                                       |                                                            |
| Master's Apprentice    | 师徒相授     | 本轮雇佣工匠费用减半。                           | 本轮雇工费用减半。                                          | shorter                                                    |
| Farsight               | 远见         | 本轮免费获得一条中间人情报。                     | 本轮免费获得一条掮客传闻。                                  | 掮客传闻 as one term                                       |
| Kiln and Forge Guild   | 窑炉行会     | 本轮第一批特许货物的订单多付 15%。               | 本轮第一批特许货物的委托多付 15%。                          | 委托                                                       |
| Frontier Tariff Relief | 边境减税     | 本轮成品增值税减半。                             | 关津减税 / 本轮成品市舶税减半。                             | 关津 is the frontier pass; 市舶税 the locked tax           |
| Exotic Treasures       | 异域奇珍     | 本轮第二批特许货物的订单多付 15%。               | 本轮第二批特许货物的委托多付 15%。                          | 委托                                                       |
| Deep Sea Escort Pact   | 远洋护航契约 | 本轮护航费用与海盗风险双双减半。                 | as is                                                       |                                                            |
| Merchants Converge     | 商贾云集     | 本轮订单板上多出一张贸易订单。                   | 本轮委托板上多出一张贸易委托。                              | 委托                                                       |
| Steady Watch           | 守望         | 本航程余下期间，船员每段航程少消耗一份口粮。     | 本航程余下期间，船员每段少耗一份口粮。                      | tightened                                                  |
| Cold Hardened          | 耐寒         | 本航程余下期间，船员所穿御寒值提高 1。           | 本航程余下期间，船员衣物的暖意多算 1 点。                   | 暖意 is the garment stat; 御寒 is the tag                  |
| Route Mastery          | 路线精通     | 本航程余下期间，沿你路径的订单报酬增加四分之一。 | 商道精通 / 本航程余下期间，沿你商道的委托，报酬多四分之一。 | 商道 and 委托                                              |
| Harbor Credit          | 港口信用     | 本航程余下期间，商品销售税降低四分之一。         | 本航程余下期间，成品销售的市舶税降低四分之一。              | 市舶税                                                     |
| Fleet Colors           | 舰队旗帜     | 本航程余下期间，海盗来袭的风险降低四分之一。     | 船队旗帜 / 海盗三思，本航程余下期间，袭击风险降低四分之一。 | 船队 everywhere else; 舰队 reads navy                      |

### Modules (14)

| Card                  | Chinese      | In the tree now                                         | Proposed                                                              | Why                                            |
| --------------------- | ------------ | ------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| Smuggler's Hold       | 走私货舱     | 采购成本降低 15%，所得税增加 20%。                      | 进价降低 15%，所得税多缴 20%。                                        | 进价                                           |
| Bulk Hauler Rigging   | 大宗货索具   | 每件货物运费减 1 金币，船只升级多花 15 金币。           | as is                                                                 |                                                |
| Artisan's Workshop    | 匠人作坊     | 工匠多产出 1 件，工资增加 20%。                         | 工匠多产出 1 件，工钱多出 20%。                                       | 工钱                                           |
| Tax Evasion Ledger    | 逃税账簿     | 所得税与增值税减半，订单完成时有 15% 概率损失 20 金币。 | 所得税与市舶税减半，每笔委托完成时有 15% 的概率被稽查，罚金 20 金币。 | 市舶税, 委托, and the audit named as the audit |
| Woven Monopoly        | 织物专卖     | 织物类货物运费为 0，织物类订单多付 20%。                | 织物垄断 / 织物类运费为 0，织物类委托多付 20%。                       | 委托; 垄断 beside 大宗垄断                     |
| Broker's Network      | 中间人网络   | 情报花费 2 金币，每次购买揭示 2 条传闻。                | 掮客人脉 / 每条情报 2 金币，一次揭示 2 条传闻。                       | 掮客; 人脉 reads warmer than 网络              |
| Salvage Crane         | 打捞吊臂     | 订单完成时有 30% 概率返还运费。                         | 委托完成时有 30% 的概率返还运费。                                     | 委托                                           |
| Overdrive Engine      | 超载引擎     | 运费减 5 金币，维护费增加 10 金币。                     | as is                                                                 |                                                |
| Maritime Bureau Token | 市舶司信物   | 特许货物的订单多付 10%。                                | 特许货物的委托多付 10%。                                              | 委托                                           |
| Kiln Cellar           | 窑窖         | 大宗货物每单位便宜 2 金币。                             | as is                                                                 |                                                |
| Ocean Interpreter     | 通译         | 情报多揭示 1 条传闻，不额外收费。                       | 掮客低语每次多揭示 1 条传闻，不另收费。                               | names the system                               |
| Foreign Quarter Pass  | 蕃坊通行证   | 奢侈品每单位便宜 3 金币。                               | 奢华货物每单位便宜 3 金币。                                           | 奢华 is the tag word                           |
| Persian Dome Compass  | 波斯穹顶罗盘 | 海盗袭击风险降低 30%。                                  | as is                                                                 |                                                |
| Fleet of Treasures    | 珍宝船队     | 奢侈品订单每单位运费便宜 3 金币。                       | 奢华货物每单位运费便宜 3 金币。                                       | 奢华                                           |

### Charters (10)

| Card                  | Chinese    | In the tree now                                | Proposed                                                           | Why                                                             |
| --------------------- | ---------- | ---------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| The Bulk Charter      | 大宗契     | 大批装运，本航程每批运费降低 1 金币。          | 大宗特许 / 大批装运，本航程每件运费降低 1 金币。                   | 特许, the charter family's word                                 |
| The Standing Manifest | 常备舱单   | 本航程每笔完成订单多付 15%。                   | 本航程每笔完成的委托多付 15%。                                     | 委托                                                            |
| The Gun Charter       | 火炮特许   | 全船武装，本航程遭遇袭击的概率降低 30%。       | as is                                                              |                                                                 |
| The Standing Escort   | 常驻护航   | 快船随行，本航程护航合同费用减半。             | 常备护航                                                           | 常备 everywhere else; 常驻 reads garrison                       |
| The Weavers' Charter  | 织工特许   | 织机不停，本航程每位织工每轮多产出 1 件货物。  | as is                                                              |                                                                 |
| The Quality Mark      | 品质印记   | 织物皆盖印记，本航程织物售价提高 10%。         | as is                                                              |                                                                 |
| The Long Ledger       | 长账簿     | 港口记账，本航程港口采购降价 10%。             | as is                                                              |                                                                 |
| The Quiet Account     | 静默账户   | 费用预先结清，本航程港口费用减半。             | 费用预先结清，本航程港务费减半。                                   | 港务费                                                          |
| The Factor            | 代理人     | 账房有人打理，本航程可借款三次，每次扣除 60%。 | 管事 / 有管事替你打理账目，本航程可借款三次，每笔附带 60% 的罚息。 | 管事 rather than 代理人; 罚息 is the right word for the penalty |
| The Letter of Marque  | 私掠许可证 | 皇家授权，本航程被劫掠的财物可追回四分之一。   | as is                                                              |                                                                 |

52 of the 86 strings stand as they are. Of the 34 that change: 25 are description edits, most a single word (委托, 商道, 掮客, 市舶税, and a few others), and nine are card names (生意经, 关津减税, 商道精通, 掮客人脉, 管事, and the four the terminology panel moved: 船队旗帜, 织物垄断, 大宗特许, 常备护航). Seven of the ten charter names stand, and twelve of the fourteen module names stand.

---

## Interface labels

Buttons, panels and field labels drawn from the component tree. These are the labels that carried a decision; the complete chrome, string by string, follows in the sentence tables below.

| English                      | Chinese            |
| ---------------------------- | ------------------ |
| Hold                         | 货舱               |
| Cargo                        | 货物               |
| Stores                       | 存粮               |
| Wardrobe                     | 衣箱               |
| Warmth                       | 暖意               |
| Frostbite                    | 冻伤               |
| Shipyard                     | 船坞               |
| Hull                         | 船体               |
| Upgrade                      | 升级               |
| Market                       | 集市               |
| Port Purchase                | 港口采购           |
| Artisan Bench                | 匠作台             |
| Standing Orders              | 常备委托           |
| Objective                    | 公议               |
| Gather in the Harbor         | 在港湾集合         |
| Draft Your Path              | 抽取你的商道       |
| Draft a Boon                 | 抽取机缘           |
| Draft and install a module   | 抽取并安装模块     |
| Buy at Port                  | 港口采购           |
| Buy a Broker's Rumor         | 购买掮客传闻       |
| Barter with Captains         | 与船长互通有无     |
| Post a barter offer          | 挂出易货报价       |
| Fill Trade Orders            | 交付贸易委托       |
| Settle your bills            | 结清账单           |
| Survive Settlement           | 挺过结算           |
| Request a loan               | 申请借款           |
| Upgrade at the Shipyard      | 前往船坞升级       |
| Skip the shipyard            | 暂不升级船只       |
| Skip buying this round       | 本轮不再采购       |
| Hire a Weaver                | 雇佣织女           |
| Put Artisans to Work         | 安排工匠上工       |
| Hold off on hiring           | 暂不雇工           |
| Last round, no new hires     | 最后一轮，不再雇工 |
| Ready up when you are done   | 收拾停当后点就绪   |
| Step 1 of 3: Keep One        | 三步之一：留一张   |
| Step 2 of 3: Keep One Of Two | 三步之二：二选一   |
| Step 3 of 3: Discard One     | 三步之三：弃一张   |
| Captain's Ledger             | 船长账簿           |
| Worker Wages                 | 工匠工钱           |
| Ship Maintenance             | 船只维护费         |
| VAT Paid                     | 市舶税             |
| Trade Revenue                | 贸易所得           |
| Voyages                      | 航程               |
| Ship Lv                      | 船只等级           |
| Password                     | 密码               |
| Display Name                 | 显示名             |
| Captain Name                 | 船长名             |
| Setup Code                   | 设置口令           |

---

## The Chinese already in the tree

What the 34 changes amount to, in one place.

| From     | To           | Why                                                                      | Where                 |
| -------- | ------------ | ------------------------------------------------------------------------ | --------------------- |
| 订单     | 委托         | 订单 reads as modern logistics; 委托 composes with 常备委托 and 专属委托 | 9 descriptions        |
| 路径     | 商道         | the identity sense the path cards need                                   | 1 card, name and desc |
| 中间人   | 掮客         | the historical word for this trade; pairs with 通匪掮客                  | 2 cards               |
| 工资     | 工钱         | ship era register                                                        | 1 description         |
| 增值税   | 市舶税       | the harbor's own trade tax, alongside 市舶司信物                         | 3 descriptions        |
| 港口费用 | 港务费       | matches 维护费, and 港务长 is now a role                                 | 1 description         |
| 奢侈品   | 奢华货物     | aligns to the tag word 奢华                                              | 2 descriptions        |
| 概率损失 | 被稽查，罚金 | the audit is a named mechanic; the desc should name it                   | 1 description         |
| 御寒值   | 暖意         | 御寒 is the tag; the garment stat is 暖意                                | 1 description         |
| 商人魅力 | 生意经       | 生意经 is the merchant's knack, said the way people say it               | 1 card, name          |
| 边境减税 | 关津减税     | 关津 is the frontier pass; 市舶税 the locked tax                         | 1 card, name          |
| 代理人   | 管事         | 管事 rather than 代理人; 罚息 is the right word for the penalty          | 1 card, name and desc |
| 舰队旗帜 | 船队旗帜     | the player fleet is 船队 everywhere else                                 | 1 card, name and desc |
| 织物专卖 | 织物垄断     | one word for monopoly, beside 大宗垄断                                   | 1 card, name and desc |
| 大宗契   | 大宗特许     | the charter family holds 特许                                            | 1 card, name and desc |
| 常驻护航 | 常备护航     | standing reads 常备 everywhere                                           | 1 card, name          |

## The whole surface, sentence by sentence

The slices above settle the vocabulary, the cards and the labels that carried a decision. These tables hold the rest: every remaining line a captain can actually read, one row per string, gathered over ten sweeps and grouped by the file it lives in, 1,816 rows in all. They are here in the same order the `sentences` group of the mapping file reads, so any row can be quoted by its key.

### The shell (13)

The edges of the game: the page title and description, the loading lines, and what the API answers when it cannot.

**`src/app/layout.tsx`** (3)

| English                                                                                                                                                                              | Chinese                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| ${APP_NAME}: a multiplayer maritime trade game on the ancient Silk Road. Captains gather in a shared harbor, sail in lockstep, and the highest Reputation wins the Sea Master crown. | {APP_NAME}：古丝绸之路上的多人海上贸易游戏。船长们聚在同一个港湾，步调一致地航行，声誉最高者赢得沧海之冠。 |
| Silk Road                                                                                                                                                                            | 丝绸之路                                                                                                   |
| trading game                                                                                                                                                                         | 贸易游戏                                                                                                   |

**`src/app/page.tsx`** (1)

| English                    | Chinese         |
| -------------------------- | --------------- |
| Reading the tide tables... | 正在读潮汐表... |

**`src/lib/api-auth.ts`** (1)

| English      | Chinese |
| ------------ | ------- |
| Unauthorized | 未授权  |

**`src/lib/api-json.ts`** (1)

| English           | Chinese           |
| ----------------- | ----------------- |
| Invalid JSON body | JSON 请求体无效。 |

**`src/lib/api.ts`** (2)

| English                                                 | Chinese                                    |
| ------------------------------------------------------- | ------------------------------------------ |
| Cannot reach the server. It may be temporarily offline. | 连不上服务器，可能只是暂时离线。           |
| Server error (${res.status}). Please try again later.   | 服务器出错了（{res.status}）。请稍后再试。 |

**`src/lib/auth.ts`** (2)

| English                                                                                     | Chinese                                                  |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| This account has been banned. Contact the harbor operator if you believe this is a mistake. | 这个账号已经被封停了。要是觉得封错了，请联系港湾操作员。 |
| That captain name is already registered                                                     | 这个船长名已经有人用了。                                 |

**`src/lib/credentials.ts`** (3)

| English                                                                | Chinese                                                  |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| ${USERNAME_MIN} to ${USERNAME_MAX} chars, letters, numbers, underscore | {USERNAME_MIN}到{USERNAME_MAX}个字符，字母、数字、下划线 |
| Username may only contain letters, numbers and underscores             | 船长名只能用字母、数字和下划线                           |
| at least ${PASSWORD_MIN} characters                                    | 至少{PASSWORD_MIN}个字符                                 |

### The guide and the glossary (86)

The reference shelf: glossary entries, price tooltips, and what the harbor says when nothing is happening.

**`server.ts`** (2)

| English                                                                                                                                                                                                                                                                                                                                                                                              | Chinese                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| \<div style="background:color-mix(in oklch, var(--w-${leg.phase}) 12%, transparent);border-radius:6px;padding:10px;border-left:3px solid var(--w-${leg.phase});color:var(--foreground)">\n \<strong>${face.icon} ${face.label}\</strong>\<br>\n \<span style="font-size:13px">${leg.body}\</span>\<br>\n \<span style="font-size:12px;color:var(--muted-foreground)">${leg.setsUp}\</span>\n \</div> | \<div style="background:color-mix(in oklch, var(--w-${leg.phase}) 12%, transparent);border-radius:6px;padding:10px;border-left:3px solid var(--w-${leg.phase});color:var(--foreground)">\n \<strong>${face.icon} ${face.label}\</strong>\<br>\n \<span style="font-size:13px">${leg.body}\</span>\<br>\n \<span style="font-size:12px;color:var(--muted-foreground)">${leg.setsUp}\</span>\n \</div> |
| \<div style="display:grid;gap:8px;margin:12px 0">\n${legs}\n\</div>\n\<p style="font-size:12px;color:var(--muted-foreground);margin:4px 0 0">${briefing.closes}\</p>                                                                                                                                                                                                                                 | \<div style="display:grid;gap:8px;margin:12px 0">\n${legs}\n\</div>\n\<p style="font-size:12px;color:var(--muted-foreground);margin:4px 0 0">${briefing.closes}\</p>                                                                                                                                                                                                                                 |

**`src/components/portmasters/GameRoom.tsx`** (1)

| English                                                                                                                                                                                                   | Chinese                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| \<li>\<strong>${entry.crest} ${entry.name}\</strong>: ${entry.signature}\<br>\<span style="font-size:12px;color:var(--muted-foreground)">${entry.facts\n .map(pathFactText)\n .join(" · ")}\</span>\</li> | \<li>\<strong>${entry.crest} ${entry.name}\</strong>: ${entry.signature}\<br>\<span style="font-size:12px;color:var(--muted-foreground)">${entry.facts\n .map(pathFactText)\n .join(" · ")}\</span>\</li> |

**`src/components/portmasters/game/PriceTooltips.tsx`** (6)

| English                                       | Chinese                  |
| --------------------------------------------- | ------------------------ |
| Base                                          | 基价                     |
| Final                                         | 最终价                   |
| ±1 Gold depending on the port                 | 随港口浮动 ±1金币        |
| Actual market cards this round can still vary | 本轮实际行情仍可能有出入 |
| per item                                      | 每件                     |
| per unit                                      | 每单位                   |

**`src/lib/game/constants/copy.ts`** (13)

| English                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Chinese                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| \<div style="background:color-mix(in oklch, var(--gain) 12%, transparent);border-radius:6px;padding:12px;border-left:3px solid var(--gain);color:var(--foreground);line-height:1.9">${briefing.text}\</div>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | \<div style="background:color-mix(in oklch, var(--gain) 12%, transparent);border-radius:6px;padding:12px;border-left:3px solid var(--gain);color:var(--foreground);line-height:1.9">${briefing.text}\</div>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| \<p>This voyage does not play like the founding one. Here is what \<strong>${play.badge}\</strong> changes about it, all of it:\</p>\n\<ul style="padding-left:18px;line-height:1.9;font-size:14px">\n${items}\n\</ul>\n\<p style="font-size:12px;color:var(--muted-foreground);margin:8px 0 0">Everything else is the voyage you would sail in Classic, so everything you learn there carries over. You can read the same list any time with F1.\</p>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | \<p>这趟航程跟最初那趟不一样。以下是 \<strong>{play.badge}\</strong> 带来的全部改动：\</p>\n\<ul style="padding-left:18px;line-height:1.9;font-size:14px">\n{items}\n\</ul>\n\<p style="font-size:12px;color:var(--muted-foreground);margin:8px 0 0">其余的跟经典航程一样，你在经典里学到的都管用。随时按 F1 重看这份清单。\</p>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| \<p>The voyage opens with a deal rather than a market. Three cards land face down in front of you, and at each beat you keep one and pass the rest on. What you hold when the deal ends is your path, and it sails with you to the end of the voyage. One change of papers is allowed: at a port, for a fee in Gold that grows with your Renown, the path chip in your rail offers the switch.\</p>\n\<p>Your path decides three things about your seat: your hold, how far your Renown can climb, and which trade orders lock to you. An order demanding a locked good can only be filled by the captain holding the path that carries it.\</p>\n\<ul style="padding-left:18px;line-height:1.7;font-size:14px">\n${rows}\n\</ul>\n\<p style="font-size:12px;color:var(--muted-foreground);margin:8px 0 0">Every card in the deal carries these numbers, so what you read here is what the table deals you.\</p>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | \<p>这趟航程以发牌开局，而不是开市。三张牌背面朝上落在你面前，一路留一张、传走其余。发牌结束时留在手上的，就是你的商道，它会陪你走到航程尽头。商道可以换一次：在港口花一笔金币，价钱随声望涨，船长栏里的商道小牌就能换。\</p>\n\<p>你的商道定下你席位的三件事：货舱多大、声望最高能爬到哪、哪些委托只认这条道。遇上要专属货物的委托，全桌只有持那条商道的船长接得下。\</p>\n\<ul style="padding-left:18px;line-height:1.7;font-size:14px">\n{rows}\n\</ul>\n\<p style="font-size:12px;color:var(--muted-foreground);margin:8px 0 0">牌桌上的每张牌都带这些数字，这里读到的就是你会拿到的。\</p>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| \<p>${APP_NAME} puts you on the ancient Silk Road: one voyage of ${rounds} rounds, limited gold, and a lot of merchants trying to outmaneuver you at every port.\</p>\n\<p>You are sailing \<strong>${play.badge}\</strong>: ${play.tagline}\</p>\n\<p>These waters are \<strong>${cfg.name}\</strong>: ${cfg.tagline}\</p>\n\<p>The rules are easy to pick up, but money is tight early on and a string of bad calls compounds quickly. This covers the things that catch new captains out most.\</p>\n\<p style="color:var(--muted-foreground);font-size:13px">Two minutes to read. Saves a lot of frustrated restarts.\</p>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | \<p>{APP_NAME} 把你带上了古丝路：{rounds}轮的航程，有限的金币，还有一群商人，个个都想在每个港口比你多走一步。\</p>\n\<p>你走的是\<strong>{play.badge}\</strong>：{play.tagline}\</p>\n\<p>这片水域是\<strong>{cfg.name}\</strong>：{cfg.tagline}\</p>\n\<p>规则好上手，只是前期手头紧，一连串坏判断很快就会滚成雪球。这里讲的是新船长最容易栽的几件事。\</p>\n\<p style="color:var(--muted-foreground);font-size:13px">两分钟读完，能省下好几次懊恼的重开。\</p>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| \<p>After ${rounds} rounds, the captain with the highest score wins the title of \<strong>Sea Master\</strong>. Score comes from trade profits and fulfilled orders.\</p>\n\<p>${play.failureRule}\</p>\n\<p>Starting gold is \<strong>${cfg.startingGold}\</strong>. That is enough to get going, but not enough to be careless with.\</p>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | \<p>{rounds}轮之后，积分最高的船长赢得\<strong>沧海之主\</strong>的头衔。积分来自贸易利润和完成的委托。\</p>\n\<p>{play.failureRule}\</p>\n\<p>初始金币是\<strong>{cfg.startingGold}\</strong>。够起步，不够大手大脚。\</p>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| \<p>A round is one lap of the voyage, and this voyage runs ${rounds} of them. Each round walks the phases below in the order your voyage puts them:\</p>\n${roundStepHtml(mode)}\n\<p style="font-size:12px;color:var(--muted-foreground);margin:4px 0 0">\<kbd style="background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px">Ctrl+N\</kbd> readies you for the next phase without clicking (the room sails on once every captain is ready), and a voyage is one whole run of these rounds rather than a round of its own.\</p>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | \<p>一轮是航程里的一圈，这趟要走{rounds}轮。每轮依次走过下面的阶段，顺序由你的航程排定：\</p>\n{roundStepHtml(mode)}\n\<p style="font-size:12px;color:var(--muted-foreground);margin:4px 0 0">\<kbd style="background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px">Ctrl+N\</kbd> 可以不点鼠标直接就绪（所有船长都就绪，港湾才继续）；航程是这些轮连起来的一整趟，不是单独的一轮。\</p>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| \<p>The port market has Hemp, Silk, and Tea at prices that shift every round. Buy here, barter with the other captains at Parley, and fill trade orders at Orders. Which of those two stops comes first is a rule of the voyage you are sailing rather than a choice you make, and your captain's rail always shows the order. That is the core loop.\</p>\n\<p>One thing worth knowing about: the \<strong>Broker\</strong>. Pay a small fee for a demand rumor and a specific trade order is \<em>guaranteed\</em> to appear when Orders opens. Useful when you have stocked a particular good and want to make sure a buyer shows up.\</p>\n\<div style="background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">\n 💡 For the first two or three voyages, stick to raw materials. You can fill an order with them the same round you buy them. No waiting and no risk.\n\</div>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | \<p>集市里有麻布、丝绸和茶叶，价格每轮都在动。在这里采购，到洽谈去换货，去委托交单。开市和委托谁先谁后，由你所走航程的规则定，没得选，船长栏里一直标着顺序。这就是核心循环。\</p>\n\<p>还有一个人要记住：\<strong>掮客\</strong>。花点小钱买一条需求传闻，委托一开，指定的那张\<em>必定\</em>出现。囤着货想保准有买家，就用这个。\</p>\n\<div style="background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">\n 💡 最初两三趟航程，先做原料。买进的当轮就能拿去交委托，不用等，也没有风险。\n\</div>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| \<p>The Parley is a short window where captains trade directly with each other instead of through the market. Post an offer, like Hemp you don't need for Silk you do, and any other captain in the harbor can take it with one click.\</p>\n\<p>Where it falls in the round is set by the voyage you are sailing rather than changing from round to round: ${MODES.classic.badge} runs it right after Market, and ${MODES.ocean_gambit.badge} runs it right after Orders, and your captain's rail always shows which. Either way, it is the easiest way to recover from a bad draw. All Tea and no Silk, with a Sachet order already on the board? Someone else in the harbor has probably drawn the opposite problem.\</p>\n\<div style="background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">\n A few ground rules: you can't offer an item for itself, both amounts have to be whole numbers of at least one, and you can never offer more than you currently have. The moment you post an offer, that amount is set aside until someone takes it or you cancel it.\n\</div>\n\<p style="font-size:13px;color:var(--muted-foreground);margin-top:8px">Nobody has to barter. If nothing on the board interests you, or nobody is offering anything, just move on to the next phase.\</p>                                                                                                                                       | \<p>洽谈只开一扇短窗，船长们绕开集市直接换货。挂一份单子，比如拿富余的麻布换你缺的丝绸，港湾里谁都能一点接下。\</p>\n\<p>洽谈落在轮里的哪一步，由你的航程定，不随轮次变：{MODES.classic.badge}排在开市之后，{MODES.ocean_gambit.badge}排在委托之后，船长栏一直标着是哪种。哪种都好，它都是纠坏手气最省事的办法。手里全是茶叶没有丝绸，委托板上却挂着一张香囊单？港湾里多半有人正好反过来。\</p>\n\<div style="background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">\n 几条规矩：不能拿一样货换它本身；两边的数量都得是整数，至少各 1；挂出的数量不能超过你手头的。挂出那一刻，这些货就寄存起来，直到有人接下或你取消。\n\</div>\n\<p style="font-size:13px;color:var(--muted-foreground);margin-top:8px">没人非得换货。板上没你想要的，或者没人挂东西，直接走下一阶段。\</p>                                                                                                                                                                                                                                                                                                                                                                            |
| \<p>Trade orders appear and you match your cargo to them. Each one shows the goods needed, the reward, and the shipping fee. Your take is whatever is left after fees and tax.\</p>\n\<p>You can fill as many orders as your cargo allows while Orders is open.\</p>\n\<div style="background:color-mix(in oklch, var(--intel) 14%, transparent);border:1px solid var(--intel);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">\n 📌 \<strong>Finished goods\</strong> (${PRODUCTS_TIER0.join(", ")}) pay two to three times more than raw materials. The catch is they need artisans, and the artisans deliver at Resolve. That is covered next.\n\</div>\n${mandates.length ?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | \<p>委托上板了，拿货去对。每条都写明要什么货、给多少报酬、收多少运费。运费和税扣完，剩下的都归你。\</p>\n\<p>委托开着的时候，货够就交，能交几条交几条。\</p>\n\<div style="background:color-mix(in oklch, var(--intel) 14%, transparent);border:1px solid var(--intel);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">\n 📌 \<strong>成品\</strong> ({PRODUCTS_TIER0.join(", ")})的报酬是原料的两三倍。可它得靠匠人，匠人要到结算才交货。下一页就讲这个。\n\</div>\n{mandates.length ?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| \<p>Artisans turn raw materials into high value finished goods and collect wages at every Resolve. That part is simple. What catches most new captains is this:\</p>\n\<div style="background:color-mix(in oklch, var(--alarm) 18%, transparent);border:1px solid var(--alarm);color:var(--foreground);border-radius:6px;padding:12px;margin:12px 0;text-align:center;font-size:14px;font-weight:bold;line-height:1.7">\n Assign a task this round.\<br>Wages come due at Resolve either way.\n\</div>\n\<p style="font-size:13px;color:var(--muted-foreground);line-height:1.6">Weavers (${wageOf("weaver")}g), Master Weavers (${wageOf("master")}g), and Sachet Makers (${wageOf("sachet_maker")}g) all charge wages \<strong>every round\</strong>, even when idle, so the bill comes round whether they worked or not. Only hire once you have enough gold to cover at least two rounds of wages alongside your other bills.\</p>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | \<p>匠人把原料做成高价成品，每个结算都领工钱。这部分很简单。让新船长栽跟头的是这一点：\</p>\n\<div style="background:color-mix(in oklch, var(--alarm) 18%, transparent);border:1px solid var(--alarm);color:var(--foreground);border-radius:6px;padding:12px;margin:12px 0;text-align:center;font-size:14px;font-weight:bold;line-height:1.7">\n 本轮派活。\<br>工钱到结算照付不误。\n\</div>\n\<p style="font-size:13px;color:var(--muted-foreground);line-height:1.6">织女（{wageOf("weaver")}g）、纺织大师（{wageOf("master")}g）、香囊师（{wageOf("sachet_maker")}g）的工钱\<strong>每轮\</strong>都付，闲着照付，干不干活账单都来。手里的金币能盖住至少两轮工钱、还顾得开别的开销，再雇人。\</p>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| : ""}\n\<div style="background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">\n 💡 ${ESCORT_SHARE_RULE} Often worth it once your funds are already thin.\n\</div>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | : ""}\n\<div style="background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">\n 💡 {ESCORT_SHARE_RULE}手头紧的时候，这笔往往划算。\n\</div>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| \<p>Once the pirates are dealt with, two bills come due:\</p>\n\<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0">\n \<div style="background:color-mix(in oklch, var(--w-ship) 14%, transparent);border-radius:6px;padding:10px;text-align:center;color:var(--foreground)">\n \<div style="font-size:22px;margin-bottom:4px">🔧\</div>\n \<strong>Ship Maintenance\</strong>\<br>\n \<span style="font-size:12px;color:var(--muted-foreground)">15 to 22 Gold each round, set by the waters you sail\</span>\n \</div>\n \<div style="background:color-mix(in oklch, var(--w-market) 14%, transparent);border-radius:6px;padding:10px;text-align:center;color:var(--foreground)">\n \<div style="font-size:22px;margin-bottom:4px">👥\</div>\n \<strong>Artisan Wages\</strong>\<br>\n \<span style="font-size:12px;color:var(--muted-foreground)">${ARTISAN_WAGE_MIN} to ${ARTISAN_WAGE_MAX} Gold per person per round\</span>\n \</div>\n\</div>\n\<p style="font-size:13px;color:var(--muted-foreground)">The \<strong>Dues\</strong> tab of your captain's rail shows exactly what is owed. Check it before spending anything.\</p>\n\<p style="font-size:13px;color:var(--muted-foreground)">Coming up short isn't the end on its own. Right there on the settlement screen, you can ask another captain in the harbor for a loan, and they can send it to you on the spot if they've got the Gold to spare. Just repay it before the voyage's last round ends, or it comes out of your funds automatically and goes straight to them.\</p> | \<p>海盗的事了结之后，还有两笔账单：\</p>\n\<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0">\n \<div style="background:color-mix(in oklch, var(--w-ship) 14%, transparent);border-radius:6px;padding:10px;text-align:center;color:var(--foreground)">\n \<div style="font-size:22px;margin-bottom:4px">🔧\</div>\n \<strong>船只维护费\</strong>\<br>\n \<span style="font-size:12px;color:var(--muted-foreground)">每轮15到22金币，由你走的水域决定\</span>\n \</div>\n \<div style="background:color-mix(in oklch, var(--w-market) 14%, transparent);border-radius:6px;padding:10px;text-align:center;color:var(--foreground)">\n \<div style="font-size:22px;margin-bottom:4px">👥\</div>\n \<strong>匠人工钱\</strong>\<br>\n \<span style="font-size:12px;color:var(--muted-foreground)">每人每轮{ARTISAN_WAGE_MIN}到{ARTISAN_WAGE_MAX}金币\</span>\n \</div>\n\</div>\n\<p style="font-size:13px;color:var(--muted-foreground)">船长栏里的\<strong>港务费\</strong>页签写着确切欠多少。花钱之前先看一眼。\</p>\n\<p style="font-size:13px;color:var(--muted-foreground)">钱不够，本身不是终点。就在结算界面上，你可以向港湾里的其他船长借一笔；对方手头宽裕，当场就能转给你。在航程最后一轮结束前还上就行，还不清，会自动从你的金币里扣出来，交到他手上。\</p> |
| \<p>Keep these points in mind as you play:\</p>\n\<ul style="padding-left:18px;line-height:2.1;font-size:14px">\n \<li>Start with raw material orders. Fast money, no complications.\</li>\n \<li>Always keep at least \<strong>30 Gold above\</strong> what Resolve will cost you.\</li>\n \<li>Hire artisans only when you can cover \<strong>two full rounds of wages\</strong>.\</li>\n \<li>Dusk ship upgrades compound quickly. Do not skip them.\</li>\n \<li>Caught short by pirates or a bad round? Ask the harbor for a loan before you assume the voyage is over.\</li>\n \<li>Every voyage's final Reputation becomes Renown on your account, forever, win or lose. Check your Captain's Legacy any time from the Lobby.\</li>\n \<li>\<kbd style="background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px">Ctrl+S\</kbd> saves your run · \<kbd style="background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px">F1\</kbd> opens the full guide.\</li>\n\</ul>\n\<div style="background:color-mix(in oklch, var(--gain) 14%, transparent);border:2px solid var(--gain);color:var(--foreground);border-radius:8px;padding:12px;text-align:center;margin-top:14px">\n \<strong style="font-size:15px">Good winds and good margins, Captain. ⚓\</strong>\n\</div>                                                                                                                                                                                | \<p>玩的时候记住这几点：\</p>\n\<ul style="padding-left:18px;line-height:2.1;font-size:14px">\n \<li>先从原料委托做起。回钱快，不复杂。\</li>\n \<li>手里的金币，始终比结算要收的\<strong>多出至少30金币\</strong>。\</li>\n \<li>盖得住\<strong>整整两轮工钱\</strong>再雇匠人。\</li>\n \<li>暮色的船只升级会滚雪球，别跳过。\</li>\n \<li>被海盗或一轮背运打个措手不及？别急着认输，先向港湾借一笔。\</li>\n \<li>不管输赢，航程结束时的声誉都会永远变成账号上的声望。在大厅随时能看你的船长传承。\</li>\n \<li>\<kbd style="background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px">Ctrl+S\</kbd> 保存进度 · \<kbd style="background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px">F1\</kbd> 打开完整指南。\</li>\n\</ul>\n\<div style="background:color-mix(in oklch, var(--gain) 14%, transparent);border:2px solid var(--gain);color:var(--foreground);border-radius:8px;padding:12px;text-align:center;margin-top:14px">\n \<strong style="font-size:15px">顺风又厚利，船长。⚓\</strong>\n\</div>                                                                                                                                                                      |

**`src/lib/game/glossary.ts`** (40)

| English                                                                                                                                                                                                                                                                                                                                                                                                                                 | Chinese                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| \<p>Before the bills below come due each round, ${raidCopy(cfg).toLowerCase()} Pirates find your ship and take every coin you're carrying.\</p>\n\<p>You get one choice before that roll happens: hire an escort for ${escortPct(cfg)} of your current Gold and sail through guaranteed safe, or set sail anyway and keep the Gold if the pirates don't show.\</p>\n${cfg.brokerCorruption ?                                            | \<p>每轮账单到期之前，{raidCopy(cfg).toLowerCase()}海盗会找上你的船，把你带的钱搜刮一空。\</p>\n\<p>掷这一下之前，你还有得选：花现有金币的 {escortPct(cfg)}雇一艘护航，保证平安过关；或者照常起航碰运气，海盗不来，那笔金币就省下。\</p>\n{cfg.brokerCorruption ? |
| The harbor's escort, hired at Resolve by any captain: guarantees safe passage from that round's pirate attack, for a fee the charter sets as a share of your Gold: ${Object.values( DIFFICULTIES, ) .map((c) =>                                                                                                                                                                                                                         | 港湾的护航，任何船长都能在结算时雇用：保你免受本轮海盗袭击，费用按章程定，取现有金币的一个比例：{Object.values( DIFFICULTIES, ) .map((c) =>                                                                                                                       |
| ) .join(", ")}. Once hired, the round's pirates are no longer a risk.                                                                                                                                                                                                                                                                                                                                                                   | ) .join(", ")}。雇下之后，本轮的海盗就不再是威胁。                                                                                                                                                                                                                |
| A Convoy path market at the Parley on a Gambit voyage: a Convoy captain sells one leg of protection to one other captain at a price the two of them agree. The buyer pays the fee at the handshake, the seller's cannons beat off ${Math.round( CONVOY_RAID_COVERAGE * 100, )}% of a raid in that leg, and the rest comes out of the seller's own Gold. ${ESCORT_OFFER_DEATH}                                                           | 暗潮航程里洽谈场上的镖行买卖：镖行船长把一段航段的护卫卖给另一位船长，价钱两人自己谈。买家在成交时付清费用，卖家的炮火挡下该航段 {Math.round( CONVOY_RAID_COVERAGE * 100, )}% 的劫掠，剩下的从卖家自己的金币里出。{ESCORT_OFFER_DEATH}                            |
| , ) .join( ", ", )}. Hire an escort beforehand to guarantee safe passage instead of risking it.                                                                                                                                                                                                                                                                                                                                         | , ) .join( ", ", )}。想稳当过关，提前雇一艘护航，不用冒这个险。                                                                                                                                                                                                   |
| A cheap raw material, bought at port. Weavers turn it into Linen Clothes, or combine it with Silk for Cotton Clothes.                                                                                                                                                                                                                                                                                                                   | 在港口就能买到的便宜原材料。织女拿它做麻衣，或配上丝绸做布衣。                                                                                                                                                                                                    |
| A pricier raw material. Goes into Cotton Clothes, Brocade, and Sachets. Most of the high value recipes need it.                                                                                                                                                                                                                                                                                                                         | 贵一档的原材料，用来做布衣、绫罗绸缎和香囊。高价值配方大多少不了它。                                                                                                                                                                                              |
| A raw material used only in Sachets, alongside Silk.                                                                                                                                                                                                                                                                                                                                                                                    | 只和丝绸搭配、专用于香囊的原材料。                                                                                                                                                                                                                                |
| A Weaver's product: 2 Hemp in, one item out. The cheapest finished good to produce.                                                                                                                                                                                                                                                                                                                                                     | 织女的成品：2麻布进，1件出。是成本最低的成品。                                                                                                                                                                                                                    |
| A Weaver's product: 2 Hemp + 1 Silk in. Worth more than Linen Clothes, costs more to make.                                                                                                                                                                                                                                                                                                                                              | 织女的成品：2麻布加1丝绸。比麻衣值钱，成本也高。                                                                                                                                                                                                                  |
| A Master Weaver's product: 3 Silk in. One of the two highest value finished goods.                                                                                                                                                                                                                                                                                                                                                      | 纺织大师的成品：3丝绸。最值钱的两种成品之一。                                                                                                                                                                                                                     |
| A Sachet Maker's product: 1 Silk + 2 Tea in. The most valuable finished good, and the only one that needs Tea.                                                                                                                                                                                                                                                                                                                          | 香囊师的成品：1丝绸加2茶叶。成品里最值钱的，也是唯一吃茶叶的。                                                                                                                                                                                                    |
| Makes Linen Clothes or Cotton Clothes. Costs a wage every round, paid at Resolve, whether or not they're working.                                                                                                                                                                                                                                                                                                                       | 做麻衣和布衣。工钱每轮照付，结算时结清，干不干活都一样。                                                                                                                                                                                                          |
| Makes Linen Clothes, Cotton Clothes, or Brocade. Pricier than a Weaver, and the only one who can make Brocade.                                                                                                                                                                                                                                                                                                                          | 做麻衣、布衣和绫罗绸缎。身价比织女高，也是唯一会做绫罗绸缎的。                                                                                                                                                                                                    |
| Makes Sachets. The most expensive artisan to hire, but Sachets pay the best.                                                                                                                                                                                                                                                                                                                                                            | 制作香囊。雇价最高的工匠，但香囊的报酬也最高。                                                                                                                                                                                                                    |
| Your score for the voyage, roughly your accumulated trading profit. Highest reputation on the voyage's final round wins.                                                                                                                                                                                                                                                                                                                | 你在本航程的积分，大致就是累积的贸易利润。最后一轮结束时声誉最高的人获胜。                                                                                                                                                                                        |
| Your standing across every harbor, kept on the account rather than in one voyage: the Reputation you bank becomes Renown XP when a voyage ends. ${RENOWN_BONUS_LINE}. The title beside your level is the ladder's own name for the rung you have reached.                                                                                                                                                                               | 你在所有港湾之间的地位，记在账号上，不随某次航程走：航程结束时，你攒下的声誉会变成声望经验。{RENOWN_BONUS_LINE}。等级旁的称号，就是这条阶梯给这一级的名字。                                                                                                       |
| Your spendable funds. Hit zero with bills still due and the voyage ends in bankruptcy.                                                                                                                                                                                                                                                                                                                                                  | 你手头可用的金币。账单还没付完就见底，航程以破产收场。                                                                                                                                                                                                            |
| A ${Math.round(VAT_RATE * 100)}% tax on the profit margin of finished good sales (selling price minus material cost minus wage). Raw material sales aren't taxed this way.                                                                                                                                                                                                                                                              | 对成品的利润（售价减材料成本再减工钱）征 {Math.round(VAT_RATE * 100)}% 的税。卖原料不在此列。                                                                                                                                                                     |
| A ${Math.round(INCOME_TAX_RATE * 100)}% tax on your net profit for the round, charged at Resolve after everything else is paid.                                                                                                                                                                                                                                                                                                         | 对本轮净利润征 {Math.round(INCOME_TAX_RATE * 100)}% 的税，在结算时、其余账付清之后收。                                                                                                                                                                            |
| The shipping fee for completing a trade order, based on how many items you're moving. Reduced by your ship level and certain boons or modules.                                                                                                                                                                                                                                                                                          | 交一条委托要付的运费，按件数算。船等级，以及某些机缘和模块，能把它压低。                                                                                                                                                                                          |
| A fixed per round upkeep fee for your ship, due at Resolve regardless of how the round went.                                                                                                                                                                                                                                                                                                                                            | 每轮固定的船只维护，不论这轮走得如何，结算时都要交。                                                                                                                                                                                                              |
| Raises your module slots and gives a flat discount on freight costs. Upgraded from the Shipyard at Dusk.                                                                                                                                                                                                                                                                                                                                | 多给一个模块仓位，运费也定额往下压。在暮色的船坞升级。                                                                                                                                                                                                            |
| What your hired artisans cost per round, paid at Resolve whether they produced anything or not.                                                                                                                                                                                                                                                                                                                                         | 雇来的工匠每轮的开销，结算时付，产出与否都得付。                                                                                                                                                                                                                  |
| A one round bonus you draft at the start of each round, at Dawn. It's picked personally, so your three choices differ from everyone else's.                                                                                                                                                                                                                                                                                             | 每轮开局、破晓时抽的机缘，只保一轮。三张牌单发给你，和别人的都不重样。                                                                                                                                                                                            |
| A permanent ship upgrade, drafted from the Shipyard once you have a free slot. Stays equipped until you swap it out.                                                                                                                                                                                                                                                                                                                    | 永久的船只升级，有空余仓位时在船坞抽取。装上就一直在，直到你把它换掉。                                                                                                                                                                                            |
| Trade directly with another captain instead of through the market, on the Captain's Exchange during the Parley or from the harbor chat once you reach Renown Level ${FLEXIBLE_BARTER_UNLOCK_LEVEL}. Post what you have for what you want; the offered amount is set aside the moment you post it, and comes back to you if it's canceled, if nobody takes it, or if a flexible offer of yours is taken and this one is retired with it. | 绕开集市，直接和另一位船长换货：洽谈时的船长行市，或声望到 {FLEXIBLE_BARTER_UNLOCK_LEVEL}级后的港湾聊天。挂出你有的、写明你想要的；挂出的那一刻数量就寄存起来，被取消、没人接，或者你的另一份灵活挂单成交、把它一并带走，都会原样回到你手上。                     |
| Pirate Attack                                                                                                                                                                                                                                                                                                                                                                                                                           | 海盗袭击                                                                                                                                                                                                                                                          |
| Financial Aid                                                                                                                                                                                                                                                                                                                                                                                                                           | 资金援助                                                                                                                                                                                                                                                          |
| A loan from another captain when you can't cover this round's wages or maintenance on your own. The lender's Gold transfers to you immediately; you owe it back before the voyage ends, or it's deducted automatically and handed to them at the voyage's final round.                                                                                                                                                                  | 自己盖不住本轮的工钱或维护费时，向另一位船长借的一笔款。对方的金币立刻到账；在航程结束前还清，还不清，最后一轮会自动从你的金币里扣下来，交到他手上。                                                                                                              |
| The round's opening phase: the boon draft deals three cards and you keep one, and it bends the rules for the round ahead. On a voyage that keeps a larder, this is also when the crew eats a ration a head.                                                                                                                                                                                                                             | 一轮的开场：发三张机缘，你留一张，接下来的规矩会偏向你一点。带粮舱的航程，也是船员每人吃一份口粮的时候。                                                                                                                                                          |
| The round's trading floor. Captains post barter offers and take each other's here, and the table's votes (a manifest audit, a maroon) are called here too.                                                                                                                                                                                                                                                                              | 一轮的交易场。船长们在这里挂单换货、彼此接手；桌上的表决（舱单稽查、放逐）也从这里发起。                                                                                                                                                                          |
| The round's reckoning. Production lands first, then pirates may strike, and then the wages, maintenance and taxes come due. The Dues tab is the list of what this phase will ask for.                                                                                                                                                                                                                                                   | 一轮的结算：先落产出，再是海盗可能来犯，然后工钱、维护费和税一起到期。港务费页签列的，就是这一步会上门的账。                                                                                                                                                      |
| The round's last phase and the shipyard's seat: upgrade the hull, or draft and rig a module.                                                                                                                                                                                                                                                                                                                                            | 一轮的最后一步，船坞的席位：升级船体，或者抽取并装上一件模块。                                                                                                                                                                                                    |
| What this captain owes at the round end: the crew's wages and the ship's upkeep in one total, with any outstanding loans listed underneath. This tab keeps the running count.                                                                                                                                                                                                                                                           | 这位船长轮末欠的账：船员工钱和船只维护合成一个总数，下面列着未还的借款。这个页签一直记着数。                                                                                                                                                                      |
| The cargo hold: the goods stowed aboard, one slot per unit of cargo, plus the crew that works them. This tab lists it all.                                                                                                                                                                                                                                                                                                              | 货舱：船上装着的货物，一件货占一个仓位，还有干活的船员。这个页签把它们都列出来。                                                                                                                                                                                  |
| The pantry half of the hold: the foods aboard, measured in slots. The Larder counts the meals inside them.                                                                                                                                                                                                                                                                                                                              | 货舱里伙房那半边：存着的食物，按仓位算。粮舱数的就是里面的餐数。                                                                                                                                                                                                  |
| The meals aboard for the crew, one ration a head eaten at each Dawn. Run it dry and the crew works hungry, and a long stretch without rations costs a hand.                                                                                                                                                                                                                                                                             | 船上给船员备的餐，每个破晓每人吃一份。吃空了，船员就饿着干活；连着太久断粮，要折损一名人手。                                                                                                                                                                      |
| The broker's cut on a Broker's Favor order: a share of the reward, paid when the order fills. The card prints the cut before you fill it.                                                                                                                                                                                                                                                                                               | 掮客在人情委托里抽的那份：报酬的一部分，委托成交时付。接单前，牌面就写明抽多少。                                                                                                                                                                                  |
| Gold or goods held aside the moment an offer, a pledge or a barter is posted, until the deal settles. Held goods cannot be spent or traded meanwhile, and they come back whole if the deal is canceled or expires.                                                                                                                                                                                                                      | 挂单、作保或换货一出手就寄存起来的金币或货，直到交易落定。寄存期间不能花用、不能转手；交易取消或过期，原样归还。                                                                                                                                                  |

**`src/lib/game/status-copy.ts`** (24)

| English                                                                                                                                                                     | Chinese                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Frozen out this leg                                                                                                                                                         | 本航段冻停                                                                                                        |
| went into the cold short of warm clothes                                                                                                                                    | 没带够保暖衣物就进了寒区                                                                                          |
| A warmer layer before a cold leg keeps every hand working                                                                                                                   | 冷航段出发前添一层保暖，人人照常开工                                                                              |
| Short Rations                                                                                                                                                               | 减半口粮                                                                                                          |
| the crew is on short rations                                                                                                                                                | 船员吃着减半口粮                                                                                                  |
| Fill the larder                                                                                                                                                             | 把粮舱补满                                                                                                        |
| Idle                                                                                                                                                                        | 待工                                                                                                              |
| no task is set for this leg                                                                                                                                                 | 本航段没有派活                                                                                                    |
| Assign a task to put them to work                                                                                                                                           | 派一件活，他们就能开工。                                                                                          |
| 🥶 ${FROZEN_CREW.state}: the crew ${FROZEN_CREW.cause}. Back next leg. ${FROZEN_CREW.remedy}.                                                                               | 🥶 {FROZEN_CREW.state}：船员{FROZEN_CREW.cause}。下个航段就回来。{FROZEN_CREW.remedy}。                           |
| ❌ The only free hands are frozen out this leg: the crew ${FROZEN_CREW.cause}, and they are back next leg. ${FROZEN_CREW.remedy}.                                           | ❌ 仅有的空闲人手本航段冻停了：船员{FROZEN_CREW.cause}，下个航段就回来。{FROZEN_CREW.remedy}。                    |
| 🥶 ${name} is frozen out this leg: the crew ${FROZEN_CREW.cause}, and the work on ${task} waits for next leg. ${FROZEN_CREW.remedy}.                                        | 🥶 {name}本航段冻停了：船员{FROZEN_CREW.cause}，{task}的活要等下一个航段。{FROZEN_CREW.remedy}。                  |
| 🥶 Frostbite: ${name} the ${label} ${FROZEN_CREW.cause}, and is out of action next leg. ${FROZEN_CREW.remedy}.                                                              | 🥶 冻伤：{name}，这位{label}{FROZEN_CREW.cause}，下个航段不能出工。{FROZEN_CREW.remedy}。                         |
| ❄️ A cold leg: warmth ${warmth} of ${COLD_LEG_WARMTH}                                                                                                                       | ❄️ 寒区航段：暖意{warmth}，需要{COLD_LEG_WARMTH}                                                                  |
| ${reading}, so the cold will take a hand. ${FROZEN_CREW.remedy}.                                                                                                            | {reading}，严寒会夺走一名人手。{FROZEN_CREW.remedy}。                                                             |
| ${reading}, and the crew is dressed for it.                                                                                                                                 | {reading}，船员的保暖够用。                                                                                       |
| legs in a row without rations costs the newest hand aboard.                                                                                                                 | 个航段连续断粮，会折损船上最新的人手。                                                                            |
| ${CREW_LOSS_AFTER_HUNGRY_LEGS} ${HUNGRY_RULE_TAIL}                                                                                                                          | ${CREW_LOSS_AFTER_HUNGRY_LEGS} ${HUNGRY_RULE_TAIL}                                                                |
| ${HUNGRY_CREW.state}: ${HUNGRY_CREW.remedy}                                                                                                                                 | {HUNGRY_CREW.state}：{HUNGRY_CREW.remedy}                                                                         |
| ${IDLE_HAND.state}${skilled ? " ⭐ Skilled" : ""}: ${IDLE_HAND.cause}, and the wage is still owed at Resolve. ${IDLE_HAND.remedy}.                                          | {IDLE_HAND.state}{skilled ? " ⭐ 熟练" : ""}：{IDLE_HAND.cause}，工钱到结算照付。{IDLE_HAND.remedy}。             |
| ⭐ Skilled: a trained hand makes 2 goods a round where an untrained one makes 1.                                                                                            | ⭐ 熟练：练过的人手每轮做2件，没练过的做1件。                                                                     |
| Going hungry: ${HUNGRY_CREW.cause}, every artisan working at a slower pace, a quarter of the hold closed, and ${hungryRule()} ${HUNGRY_CREW.remedy} at the next Market.     | 挨饿中：{HUNGRY_CREW.cause}，每位工匠干活都变慢，四分之一货舱封闭；{hungryRule()}下次开市时{HUNGRY_CREW.remedy}。 |
| The larder is empty: ${HUNGRY_CREW.cause}, so every artisan produces less, a quarter of the hold is closed, and ${hungryRule()} ${HUNGRY_CREW.remedy} before the next Dawn. | 粮舱空了：{HUNGRY_CREW.cause}，每位工匠产出更少，四分之一货舱封闭；{hungryRule()}下次破晓前{HUNGRY_CREW.remedy}。 |
| ⚠️ The crew is on short rations, so every artisan works the leg at a slower pace, and ${hungryRule()} ${HUNGRY_CREW.remedy} at the next Market.                             | ⚠️ 船员吃着减半口粮，每位工匠本航段干活更慢；{hungryRule()}下次开市时{HUNGRY_CREW.remedy}。                       |

### How to Play (58)

The walkthrough modal, page by page, and the keyboard help.

**`src/components/portmasters/HowToPlayModal.tsx`** (28)

| English                                                                                                                                                                                                                                                                                                                                                                                            | Chinese                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tip:                                                                                                                                                                                                                                                                                                                                                                                               | 提示：                                                                                                                                                                                                                 |
| Back                                                                                                                                                                                                                                                                                                                                                                                               | 返回                                                                                                                                                                                                                   |
| Close guide                                                                                                                                                                                                                                                                                                                                                                                        | 关闭指南                                                                                                                                                                                                               |
| Go to step ${i + 1}: ${s.title}                                                                                                                                                                                                                                                                                                                                                                    | 跳到第{i + 1}步：{s.title}                                                                                                                                                                                             |
| Captains gather in a shared harbor. The host picks a difficulty and sets sail. Everyone then plays the same voyage in lockstep: nobody advances a phase until every still active captain has readied up.                                                                                                                                                                                           | 船长们聚在同一个港湾。港主定下难度就启航，所有人走同一个航程、同进同退：只要还有船长在场，就得等大家都就绪，阶段才往前走。                                                                                             |
| You can start a Solo Practice Voyage alone to learn the ropes without waiting for a second captain.                                                                                                                                                                                                                                                                                                | 不等第二位船长也可以：自己开一段单人练习航程，先把门道摸熟。                                                                                                                                                           |
| Each round opens with a boon draft. Pick one of ${CARDS_PER_OFFER} boons that bend the rules for the coming round: cheaper purchases, faster production, a tax shelter, or an emergency loan of ${EMERGENCY_LOAN_GOLD} Gold.                                                                                                                                                                       | 每轮开局先抽机缘。从{CARDS_PER_OFFER}张里挑一张，这一轮的规矩就偏向你：采购更便宜、生产更快、避一笔税，或是一笔{EMERGENCY_LOAN_GOLD}金币的紧急钱庄。                                                                   |
| You can swap your boon choices once per round for ${BOON_SWAP_COST} Gold if none of the three fit your strategy.                                                                                                                                                                                                                                                                                   | 三张都不合你的打法，每轮还能花{BOON_SWAP_COST}金币把机缘换一次。                                                                                                                                                       |
| Market is the port. Buy raw materials like Hemp, Silk, and Tea from the port merchant. Prices vary per captain and per round. You can also pay ${INTEL_COST} Gold for a Broker's Rumor that guarantees a matching order appears when Orders opens.                                                                                                                                                 | 开市就在港口。向港口商人采购麻布、丝绸、茶叶这些原料。价格每位船长各不同，每轮也在变。还可以花{INTEL_COST}金币买一条掮客传闻，保证委托一开就有对得上的单子出现。                                                       |
| The harbor remembers what everyone bought. A good the room leans into gets pricier next round, while one nobody touches softens.                                                                                                                                                                                                                                                                   | 港湾记得每个人买过什么。大家都在买的货下一轮更贵，无人问津的会便宜下来。                                                                                                                                               |
| At the Parley you can trade goods and Gold directly with the other captains, whether your voyage runs it before the orders or after them. Post an offer of what you have and what you want, or accept an offer someone else posted. Offered goods are escrowed the moment you post.                                                                                                                | 在洽谈，你可以和其他船长直接换货、换金币，不论航程把洽谈排在委托前还是后。挂出你有的、写明你想要的，或者接下别人挂的。货一挂出就寄存，直到成交或取消。                                                                 |
| You can target a specific captain with a Direct Barter Offer if you want to trade with only them. The Markets station of the Parley holds the escort market, the module market and the bazaar window.                                                                                                                                                                                              | 只想和某一位船长做买卖，可以发一份定向换货给他。洽谈的集市站里，开着护航市场、模块市场和香市窗口。                                                                                                                     |
| Orders deals the trade manifest. Each entry asks for a set of goods and pays Gold and Reputation. Finished product orders pay more but require artisans to craft them first. The Emperor may also issue a Mandate, a high value order identical for every captain.                                                                                                                                 | 委托阶段发舱单。每条写明要什么货，付你金币和声誉。成品委托给得更多，先得让匠人做出来。皇帝还可能下皇命：一张高价值委托，每位船长收到的都一样。                                                                         |
| Raw material orders are the safe early play. Finished product orders are where the real Reputation lives.                                                                                                                                                                                                                                                                                          | 原料委托是前期的稳妥之选，大笔声誉都在成品委托里。                                                                                                                                                                     |
| Resolve is where the round's bills land. First, pirates may find you and take every Gold coin on hand. Hire an escort to sail safe, or risk it. Then pay wages and ship maintenance, and check the Dues tab of your captain's rail before you spend anything.                                                                                                                                      | 结算就是本轮账单到期的时候。海盗可能先找上门，把你在手的金币卷走：雇护航求平安，或者赌一把。接着是工钱和船只维护费。花钱之前，先看一眼船长栏里的港务费页签。                                                           |
| Ask the harbor for a loan before assuming the voyage is over. Any captain can lend, and a third captain can back the loan as a safety net.                                                                                                                                                                                                                                                         | 别急着断定航程结束，先向港湾借一笔。任何船长都能放款，第三位船长还能为这笔借款作保，兜一道底。                                                                                                                         |
| Dusk is the shipyard. Upgrade your ship (opens a new module slot and reduces transport costs) or draft and rig a module. Modules are permanent ship upgrades: a Smuggler's Hold, a Broker's Network, a Salvage Crane, and more.                                                                                                                                                                    | 暮色一到，船坞开门。升级船只（多开一个模块仓位，运费也更低），或者抽一个模块装上。模块是永久的船只升级：走私暗舱、掮客人脉、打捞起重机，还有更多。                                                                     |
| Do not skip the Shipyard. The transport discount from a higher ship level pays for itself within two rounds.                                                                                                                                                                                                                                                                                       | 别跳过船坞。船只等级升上去，省下的运费两轮就回本。                                                                                                                                                                     |
| Build Your Legacy                                                                                                                                                                                                                                                                                                                                                                                  | 打造你的船长传承                                                                                                                                                                                                       |
| Every voyage's final Reputation becomes Renown XP, multiplied by the difficulty tier. Renown levels grant titles, a small starting Gold bonus, and at level ${BROKERS_FAVOR_UNLOCK_LEVEL} unlock the Broker's Favor. The captain with the highest Reputation in a voyage is crowned Sea Master.                                                                                                    | 每段航程结束时的声誉都会变成声望经验，再按难度加成。声望等级给你称号和一小笔初始金币；到{BROKERS_FAVOR_UNLOCK_LEVEL}级，解锁掮客的人情。一段航程里声誉最高的船长，加冕沧海之主。                                       |
| Check in daily for a seven day cycle of Renown XP rewards. It is not a streak, so a missed day never resets your progress.                                                                                                                                                                                                                                                                         | 每天来看看，七天一轮的声望经验奖励。不用连签，漏一天也不会重置进度。                                                                                                                                                   |
| ${play.badge}: The Voyage You Are Sailing                                                                                                                                                                                                                                                                                                                                                          | {play.badge}：你正在走的航程                                                                                                                                                                                           |
| Everything else is the voyage you would sail in Classic, so the rest of this manual reads the same for both.                                                                                                                                                                                                                                                                                       | 其余部分就是经典模式里的那次航程，这本手册剩下的内容两种模式通用。                                                                                                                                                     |
| This is the voyage every other mode is measured against, and the one the rest of these pages describe.                                                                                                                                                                                                                                                                                             | 其他模式都以本航程为参照，后面几页也都在讲它。                                                                                                                                                                         |
| Hire weavers, potters, coppersmiths, and other artisans, then assign each a product to craft. Production does not happen instantly: a task assigned now delivers at this round's Resolve, after Orders has already closed.                                                                                                                                                                         | 雇下织女、陶匠、铜匠这些匠人，再给每人派一件活。产出不是立刻的：这一轮派下的活，要到结算才交货，那时委托早已截止。                                                                                                     |
| A dealing voyage opens with a card deal rather than a market. Three cards land face down, and at each beat you keep one and pass the rest on: what you hold at the end is your path for the voyage, and one change of papers is allowed: at a port, for a fee in Gold that grows with your Renown. Your path decides your hold, how far your Renown can climb, and which trade orders lock to you. | 发牌航程以发牌开局，而不是开市。三张牌背面朝上落下，一路留一张、传走其余：最后留在手上的，就是你这趟的商道。商道可以换一次：在港口花一笔金币，价钱随声望涨。商道定下你的货舱、声望能爬多高，以及哪些委托只认你这条道。 |
| Weigh the numbers under each name rather than the crest. The five paths trade different holds, Renown ceilings and locked order pools, and the one you keep sails with you to the end.                                                                                                                                                                                                             | 看名字下面的数字，而不是徽记。五条商道的货舱、声望上限和专属委托各不相同；留下哪条，它陪你走到航程尽头。                                                                                                               |
| ${((at + 1) / pages.length) * 100}%                                                                                                                                                                                                                                                                                                                                                                | {((at + 1) / pages.length) * 100}%                                                                                                                                                                                     |

**`src/components/portmasters/KeyboardShortcutHelp.tsx`** (6)

| English                                                     | Chinese                                  |
| ----------------------------------------------------------- | ---------------------------------------- |
| Keyboard Shortcuts                                          | 键盘快捷键                               |
| Shortcuts are ignored while typing in inputs or text areas. | 在输入框或文本区打字时，快捷键不起作用。 |
| Close shortcut help                                         | 关闭快捷键说明                           |
| Game Actions                                                | 游戏操作                                 |
| Navigation                                                  | 导航                                     |
| Help                                                        | 帮助                                     |

**`src/components/portmasters/Lobby.tsx`** (1)

| English     | Chinese  |
| ----------- | -------- |
| How to Play | 玩法说明 |

**`src/components/portmasters/game/GameControlPanel.tsx`** (1)

| English  | Chinese |
| -------- | ------- |
| Continue | 继续    |

**`src/components/portmasters/game/GamePhasePanel.tsx`** (1)

| English                                       | Chinese              |
| --------------------------------------------- | -------------------- |
| The Harbormaster is fetching the tide tables. | 港务长正在取潮汐表。 |

**`src/components/portmasters/game/phases/Welcome.tsx`** (21)

| English                                                                                             | Chinese                                                  |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| New Captain Tutorial                                                                                | 新船长教程                                               |
| 🔄 How a Round Runs:                                                                                | 🔄 一轮怎么走：                                          |
| 💡 New Captain Tip:                                                                                 | 💡 新船长提示：                                          |
| Keep your purse above maintenance plus all wages, and hire artisans only when you can sustain them. | 手头的金币要始终高过维护费加全部工钱；养得起，再雇匠人。 |
| Harbor Briefing                                                                                     | 港湾简报                                                 |
| 🚀 Starting Resources                                                                               | 🚀 开局资源                                              |
| ⏱️ Production Delay                                                                                 | ⏱️ 生产延迟                                              |
| 💸 Round End Costs                                                                                  | 💸 轮末开销                                              |
| 🧾 Taxes Explained                                                                                  | 🧾 税负说明                                              |
| 🏴‍☠️ Pirates & Borrowing                                                                              | 🏴‍☠️ 海盗与借款                                            |
| ${r}×${STARTING_STOCK[r]}                                                                           | {r}×{STARTING_STOCK[r]}                                  |
| Start Solo Practice Voyage                                                                          | 开始单人练习航程                                         |
| Need at least one captain in the harbor                                                             | 港湾里至少需要一位船长                                   |
| The New Captain Tutorial lists everything this mode changes.                                        | 新船长教程列出了这个模式改动的全部内容。                 |
| Starting resources, round costs, taxes and the pirate odds.                                         | 开局资源、轮末开销、税负和海盗概率。                     |
| Assign task now → item arrives at Resolve                                                           | 现在派活 → 结算时到货                                    |
| Workers don't produce instantly!                                                                    | 工匠不会立刻产出！                                       |
| 🔧 ${cfg.maintenance} Gold ship maintenance per round                                               | 🔧 每轮船只维护费{cfg.maintenance}金币                   |
| 👥 Wages settled at Resolve, not on hire                                                            | 👥 工钱在结算时付，不是在雇用时                          |
| VAT: ${Math.round(VAT_RATE * 100)}% of finished goods profit margin                                 | 市舶税：成品利润的{Math.round(VAT_RATE * 100)}%          |
| Hire an escort, or ask the harbor for a loan                                                        | 雇一艘护航，或者向港湾借一笔                             |

### Ventures and modes (33)

The venture lines and the game mode descriptions: what a harbor Venture reads like, and what each mode changes.

**`src/lib/game/convoy.ts`** (4)

| English                                                                                                                                                                     | Chinese                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| This harbor has already used its one Venture for this voyage. It opens again on a fresh voyage or a restart.                                                                | 这个港湾本航程唯一的一次合股机会，已经用掉了。等新开一次航程或重开，才会再有。                                                   |
| ⚓ A Venture filled! Every contributor is paid their share, times ${CONVOY_VENTURE_PAYOUT_MULTIPLIER}x. This harbor's one Venture chance for this voyage has now been used. | ⚓ 合股凑齐了！每位出资人都拿回自己那份，再乘 {CONVOY_VENTURE_PAYOUT_MULTIPLIER}倍。这个港湾本航程唯一的那次合股机会，到此用掉。 |
| ⚓ A Venture missed its deadline. Every contributor gets back a partial refund.                                                                                             | ⚓ 一笔合股的期限到了，没凑齐。每位出资人拿回部分退款。                                                                          |
| ⚓ A Venture was canceled: another venture in the harbor already claimed this voyage's one chance. Every contributor gets back their full stake.                            | ⚓ 一笔合股被取消：港湾里另一笔合股先占了本航程唯一的机会。每位出资人拿回全部本金。                                              |

**`src/lib/game/crew.ts`** (4)

| English                                                                                                                        | Chinese                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| ⚰️ ${gone.name} the ${label} is lost after ${CREW_LOSS_AFTER_HUNGRY_LEGS} legs on short rations, and nothing brings them back. | ⚰️ {gone.name}，这位{label}，在 {CREW_LOSS_AFTER_HUNGRY_LEGS}个航段的减半口粮之后没能撑住，再也回不来了。 |
| The ${gone.task} they were working is lost with them.                                                                          | {gone.task}的活也跟着没了。                                                                               |
| 🌊 There is no one left aboard.                                                                                                | 🌊 船上再没有别人了。                                                                                     |
| 🌊 ${left} still aboard.                                                                                                       | 🌊 船上还有{left}。                                                                                       |

**`src/lib/game/engine/convoyState.ts`** (5)

| English                                                                                                                  | Chinese                                                                           |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| ❌ Need ${amount} Gold to back that Venture, have ${state.money}                                                         | ❌ 为这笔合股作保要 {amount}金币，你手头只有 {state.money}                        |
| ⚓ Backed a Venture with ${amount} Gold                                                                                  | ⚓ 用{amount}金币给一笔合股作了保                                                 |
| ⚓ Venture filled! Your share: ${amount} Gold                                                                            | ⚓ 合股凑齐！你这份：{amount}金币                                                 |
| ⚓ Venture missed its deadline. Partial refund: ${amount} Gold                                                           | ⚓ 一笔合股的期限到了，没凑齐。部分退款：{amount}金币                             |
| ⚓ Venture canceled: another venture in the harbor already claimed this voyage's one chance. Full refund: ${amount} Gold | ⚓ 一笔合股被取消：港湾里另一笔合股先占了本航程唯一的机会。全额退款：{amount}金币 |

**`src/lib/game/mode.ts`** (20)

| English                                                                                                                                                                                                                                                                                                                              | Chinese                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🧭 Dawn: Draft a Boon → 📦 Market: Buy at Ports → 🤝 Parley: Barter → 📜 Orders: Fill Trade Orders → 💸 Resolve: Pirates, Wages & Maintenance → 🚢 Dusk: Upgrade Ship                                                                                                                                                                | 🧭 破晓：抽机缘 → 📦 开市：港口采购 → 🤝 洽谈：易货 → 📜 委托：完成委托 → 💸 结算：海盗、工钱与维护费 → 🚢 暮色：升级船只                                                                   |
| Fall short on the bills and the voyage is over for that captain: the bankruptcy screen is the last of it, and the standings are read without them.                                                                                                                                                                                   | 账单付不出来，这位船长的航程就到头了：破产画面是最后一站，排名不再把他算在内。                                                                                                              |
| Three boons are dealt to you alone each round: cheaper buying, fuller workshops, a shelter from the tax, or a loan when the purse runs thin.                                                                                                                                                                                         | 每轮只发给你一个人的三张机缘：买得更便宜、作坊出得更多、躲开一笔税，或钱袋见底时的一笔借款。                                                                                                |
| The one you take bends this round and no other, so read the rest of the round before you choose.                                                                                                                                                                                                                                     | 留下的那一张只作用本轮，所以先把本轮剩下的安排看完再选。                                                                                                                                    |
| Load the hold at the port market and set each artisan a task. Prices shift every round, every captain is quoted their own, and wages fall due working or idle.                                                                                                                                                                       | 在港口市场装满货舱，给每位匠人派一件活。价格每轮都在变，每位船长拿到的报价都不一样，工钱干不干活都照付。                                                                                    |
| What the artisans make lands at settlement, so their work answers the next manifest rather than the one you are about to fill.                                                                                                                                                                                                       | 工匠做出来的货到结算才落舱，所以他们赶的是下一张舱单，不是你手上正要交的这张。                                                                                                              |
| The manifest deals and you commit: goods for Gold and Reputation, and nothing on the sheet can be revised once the fleet starts talking.                                                                                                                                                                                             | 舱单一发，你就落定：货换金币和声誉；等船队开始议价，单子上的字一个也改不了。                                                                                                                |
| The fleet cannot see what you committed, which cuts both ways: your round stays hidden from them, and theirs from you.                                                                                                                                                                                                               | 船队看不到你交了什么，反过来也一样：你的这一轮对他们保密，他们的对你也保密。                                                                                                                |
| The Captain's Exchange opens. Post what you can spare and name your price, or take what another captain has already set on the table.                                                                                                                                                                                                | 船长行市开了。挂出你富余的东西、标上你的价，或者接下别的船长已经摆上桌的。                                                                                                                  |
| A majority of the fleet can open one captain's manifest from this table, and calling it spends the rest of the table's trading.                                                                                                                                                                                                      | 船队多数可以从这张桌上翻开一位船长的舱单；发起表决，这一场交易剩下的时间就没了。                                                                                                            |
| Pirates roll for every coin aboard. An escort buys the safe passage for a cut of what you carry, so the fee is cheapest exactly when you have the least to protect.                                                                                                                                                                  | 海盗盯上船上的每一枚钱。护航按你随身金币的比例抽成，替你买下平安通行；所以你身上金币越少，这笔钱反倒越便宜。                                                                                |
| Then the wages and the ship's maintenance come due, and what survives the bills is what you take to the yard.                                                                                                                                                                                                                        | 然后工钱和船只维护到期，扛过账单剩下多少，你就带多少去船坞。                                                                                                                                |
| Spend what survived: a level of hull carries another module slot and cuts the cost of every haul, and a drafted module is bolted on for good.                                                                                                                                                                                        | 花掉留下来的金币：船体升一级多一个模块仓位，还砍低每一趟的运费；抽到的模块装上就永久生效。                                                                                                  |
| What you spend here is what the next round's port cannot be bought with.                                                                                                                                                                                                                                                             | 在这里花掉的，下一轮开市就买不回货了。                                                                                                                                                      |
| The round closes at the yard and opens again at the ports, with whatever this one left in the hold.                                                                                                                                                                                                                                  | 一轮在船坞合上，又在港口打开，带着这一轮留在货舱里的东西。                                                                                                                                  |
| No captain leaves the table here. Fall short on the bills and the harbor marks it against you for the rest of the voyage, and you sail on with your card, your vote and your say at the table.                                                                                                                                       | 没有船长在这里离席。账单付不出，港湾会在剩下的航程里一直记着这笔账；你带着牌、票和桌上的发言权，继续往前走。                                                                                |
| The manifest closes before the table opens: Orders runs ahead of Parley, so you commit to your sheet first and nothing on it can be revised once the fleet starts talking.                                                                                                                                                           | 舱单先行，桌面后开：委托排在洽谈之前，所以你先对单子落定，船队一开口议价，单子上的内容就不能再改。                                                                                          |
| Every voyage here runs ${GAMBIT_LEGS} rounds, whatever tier you sail. That is the length the harbor's two votes are tuned to.                                                                                                                                                                                                        | 这里的航程不论难度，都走 {GAMBIT_LEGS}轮。港湾的两次表决就是照这个长度调的。                                                                                                                |
| Every captain is dealt a private card when the voyage leaves the dock, and no one else can see it: most are Honest Captains sailing the fleet's public objective, while a table of four or more hides a Pirate in the fleet and a table of six or more may hide a Broker beside them. Every card turns face up when the voyage ends. | 航程离港时，每位船长都发到一张别人看不到的私牌：多数是诚信船长，跟着船队的公开目标走；四人以上的桌上，船队里藏着一个海盗，六人以上还可能多藏一个掮客。航程结束时，所有牌都翻开。            |
| From round ${AUDIT_FROM_ROUND}, a simple majority of the fleet can open one captain's manifest at a Parley. The room is shown ${AUDIT_REVEAL_COUNT} of that captain's last ${AUDIT_WINDOW} fills, and calling the vote spends the rest of that Parley's trading.                                                                     | 从第 {AUDIT_FROM_ROUND}轮起，船队过半数可以在洽谈时翻开一位船长的舱单。港湾会看到那位船长最近 {AUDIT_WINDOW}笔交货中的 {AUDIT_REVEAL_COUNT}笔；发起这次表决，那场洽谈剩下的交易时间就没了。 |

### The engine speaks (307)

The engine's own voice: phase headers, the market and its pricing, orders, workers, boons, refits, pirates, the chronicle and the voyage log.

**`src/lib/game/audit.ts`** (4)

| English                                                           | Chinese                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------- |
| a random pair                                                     | 随机两项                                                      |
| A majority is more than half of the captains still in the voyage. | 仍在航程中的船长里，超过一半才算多数。                        |
| ${i.qty} ${i.type}                                                | {i.qty} {i.type}                                              |
| Leg ${fill.round}: ${goods} to ${fill.port}, ${fill.reward} Gold  | 第{fill.round}航段：{goods}运往{fill.port}，{fill.reward}金币 |

**`src/lib/game/constants/copy.ts`** (1)

| English | Chinese |
| ------- | ------- |
| \n      | \n      |

**`src/lib/game/draft.ts`** (1)

| English                                                        | Chinese                                                    |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| ${names.slice(0, -1).join(", ")} or ${names[names.length - 1]} | {names.slice(0, -1).join("、")}或{names[names.length - 1]} |

**`src/lib/game/engine/ages.ts`** (6)

| English                                                                                                 | Chinese                                                 |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Age of the Lender                                                                                       | 债主之年                                                |
| Backing another captain's loan pays extra Renown while this Age holds the harbor.                       | 时代执掌港湾期间，为其他船长的借款作保，多得声望。      |
| Age of the Trader                                                                                       | 商贾之年                                                |
| Every completed barter trade lands one extra Reputation on top of the goods changing hands.             | 每成交一笔易货，除货物易手，还多得1点声誉。             |
| Age of the Broker                                                                                       | 掮客之年                                                |
| The Broker's Favor commission cap is raised to 250 Gold, so a single favor can pay out more than usual. | 掮客的人情进账上限提到250金币，一次人情比平时给得更多。 |

**`src/lib/game/engine/aid.ts`** (2)

| English                                                                                                   | Chinese                                                  |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 🤝 No Reputation this time: you have already earned this voyage's full ${cap} for helping other captains. | 🤝 这次没有声誉：本航程帮其他船长的{cap}点，你已经拿满。 |
| \n📋=== Settling Outstanding Loans ===                                                                    | \n📋=== 结清未偿借款 ===                                 |

**`src/lib/game/engine/backingState.ts`** (3)

| English                                                                                                                          | Chinese                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| ❌ Need ${amount} Gold to back that loan, have ${state.money}                                                                    | ❌ 为这笔借款作保要{amount}金币，现有{state.money}                                       |
| 🛡️ Pledged ${amount} Gold to back a fellow captain's loan                                                                        | 🛡️ 质押{amount}金币，为同席船长的借款作保                                                |
| ⚖️ Age of the Lender: a pledge that comes home whole pays ${Math.round((multiplier - 1) * 100)}% more while it holds the harbor. | ⚖️ 债主之年：时代执掌港湾期间，质押完好收回，多付{Math.round((multiplier - 1) * 100)}%。 |

**`src/lib/game/engine/barge.ts`** (5)

| English                                                                                                                                | Chinese                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| ⚓ No crew aboard, so there is nothing to provision.                                                                                   | ⚓ 船上没有船员，不用备粮。                                                |
| ⛵ The barge has nothing left for you this leg.                                                                                        | ⛵ 本航段驳船没有余量给你了。                                              |
| ❌ Name how many rations to buy from the barge.                                                                                        | ❌ 请写明从驳船买多少份口粮。                                              |
| ❌ The barge charges ${price} Gold a ration, and the purse cannot cover one.                                                           | ❌ 驳船一份口粮要{price}金币，钱袋连一份也付不起。                         |
| ⛵ The barge takes ${cost} Gold for ${wanted} ${wanted === 1 ? "ration" : "rations"} of grain. ${left - wanted} left for you this leg. | ⛵ 驳船收{cost}金币，卖你{wanted}份米粮。本航段还给你剩{left - wanted}份。 |

**`src/lib/game/engine/barter.ts`** (7)

| English                                                            | Chinese                                   |
| ------------------------------------------------------------------ | ----------------------------------------- |
| ⚖️ Age of the Trader: +${gain} Reputation for the completed trade. | ⚖️ 商贾之年：这笔易货成交，声誉 +{gain}。 |
| ❌ Can't barter an item for itself                                 | ❌ 不能拿同一种货换它自己。               |
| ❌ Barter amounts must be whole numbers of at least 1              | ❌ 易货数量得是整数，至少1。              |
| swept when the voyage moved on                                     | 航段推进时清出                            |
| refused by the room                                                | 被众人拒收                                |
| returned as the voyage loaded                                      | 随航程载入退回                            |
| ⏭️ Bartering ended                                                 | ⏭️ 易货结束                               |

**`src/lib/game/engine/bazaar.ts`** (8)

| English                                                                                                                                                  | Chinese                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A rumor is priced by the port one leg after the leg it was spoken in, and this is the last leg of the voyage, so a rumor spoken here would move nothing. | 传闻要等开口后的那个航段，港口才给它定价。这是本航程最后一个航段，在这里开口，什么也拨不动。 |
| The bazaar is quiet for you to the end of this voyage. You spoke in leg ${spoke}.                                                                        | 本航程结束之前，香市都不会再听你开口。你开口是在第{spoke}航段。                              |
| The bazaar will hear you again.                                                                                                                          | 香市又会听你开口了。                                                                         |
| The bazaar is quiet for you for one more leg.                                                                                                            | 香市还要对你静一个航段。                                                                     |
| The bazaar is quiet for you for ${left} more legs.                                                                                                       | 香市还要对你静{left}个航段。                                                                 |
| The port of leg ${leg} drew ${row.good} and priced it against your rumor.                                                                                | 第{leg}航段的港口抽到了{row.good}，按你的传闻给它定了价。                                    |
| The port of leg ${leg} drew no ${row.good}, so your rumor moved no price you could buy.                                                                  | 第{leg}航段的港口没有抽到{row.good}，你的传闻没有拨动任何你能买到的价钱。                    |
| ${row.good}: every price ${percent} percent ${way} at the next port                                                                                      | {row.good}：下一港的每个价钱{way} {percent}%                                                 |

**`src/lib/game/engine/boons.ts`** (14)

| English                                                                                                                                                                               | Chinese                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 💰 Boon applied: Gained ${card.effect.flags.instant_gold} Gold!                                                                                                                       | 💰 机缘生效：获得{card.effect.flags.instant_gold}金币！                                                                                   |
| ❌ Need ${cost} Gold to upgrade the ship                                                                                                                                              | ❌ 升级船只要{cost}金币                                                                                                                   |
| +${SHIP_DISCOUNT_PER_LEVEL} Discount                                                                                                                                                  | 折扣 +{SHIP_DISCOUNT_PER_LEVEL}                                                                                                           |
| ❌ No empty slots! Must swap.                                                                                                                                                         | ❌ 没有空位了！得换掉一个。                                                                                                               |
| \n🧭=== The Navigator's Compass ===                                                                                                                                                   | \n🧭=== 航海家的罗盘 ===                                                                                                                  |
| Choose a Boon to bend the rules of the upcoming voyage...                                                                                                                             | 选一份机缘，为接下来的航程改一改规矩...                                                                                                   |
| ❌ You've already swapped your boon choices this round                                                                                                                                | ❌ 本轮你已经换过机缘了                                                                                                                   |
| ❌ Need ${BOON_SWAP_COST} Gold to swap boon choices                                                                                                                                   | ❌ 换机缘要{BOON_SWAP_COST}金币                                                                                                           |
| 🔄 Swapped Boon Choices for ${BOON_SWAP_COST} Gold                                                                                                                                    | 🔄 花{BOON_SWAP_COST}金币换了一批机缘                                                                                                     |
| ❌ You've already swapped your module choices this round                                                                                                                              | ❌ 本轮你已经换过模块了                                                                                                                   |
| ❌ Nothing to swap, draft your modules first                                                                                                                                          | ❌ 没有可换的，先抽取模块                                                                                                                 |
| ❌ The yard has nothing new to deal this hull: every module it could offer is either aboard or already on the table. Take one of these, sell one at the table, or come back next leg. | ❌ 船坞没有新货能给这艘船体了：它拿得出来的模块，要么已经在船上，要么已经摆在桌上。从这些里挑一个，或者到桌上卖掉一个，要么下个航段再来。 |
| 🔄 Swapped Module Choices for a fresh batch                                                                                                                                           | 🔄 换了一批新的模块                                                                                                                       |
| ❌ That seat is no longer on your hull, so there is nothing there to replace. Back to Draft and take the card again: the yard fits it to the hull as it stands.                       | ❌ 那个席位已经不在你的船体上，那里没有可切换的东西。回到抽取，重新拿一次牌：船坞会按船体现在的样子装上它。                               |

**`src/lib/game/engine/chronicle.ts`** (4)

| English                                | Chinese                      |
| -------------------------------------- | ---------------------------- |
| the Monsoon Season                     | 季风时节                     |
| The voyage ran ${input.rounds} rounds. | 本航程走了{input.rounds}轮。 |
| borrowed once                          | 借入过一次                   |
| ${joined}.                             | {joined}。                   |

**`src/lib/game/engine/contracts.ts`** (2)

| English                                                                     | Chinese                                                  |
| --------------------------------------------------------------------------- | -------------------------------------------------------- |
| 🛡️ Raiders meant for ${who} met your guns: your hold lost ${ate} Gold.      | 🛡️ 冲{who}去的海盗撞上了你的炮口：货舱损失{ate}金币。    |
| 🛡️ Raiders meant for ${who} met your guns and found your hold already bare. | 🛡️ 冲{who}去的海盗撞上了你的炮口，只见你的货舱早已空了。 |

**`src/lib/game/engine/draft.ts`** (7)

| English                                                                      | Chinese                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| 📜 Forfeited ${count} unfulfilled pathbound order${count === 1 ? "" : "s"}.  | 📜 作废{count}份未交付的商道委托。                     |
| The harbor reads new papers from round ${PATH_SWITCH_FROM_ROUND}.            | 港湾从第{PATH_SWITCH_FROM_ROUND}轮起才收新文书。       |
| The window for new papers closed after round ${PATH_SWITCH_TO_ROUND}.        | 第{PATH_SWITCH_TO_ROUND}轮之后，换新文书的窗口就关了。 |
| A captain changes their papers once a voyage, and yours are already changed. | 船长一程只能换一次文书，你的已经换过了。               |
| You hold no path to set aside.                                               | 你手上没有可以搁下的商道。                             |
| You already hold that path.                                                  | 你已经握着那条商道了。                                 |
| ❌ Need ${fee} Gold to change your papers.                                   | ❌ 切换文书要{fee}金币。                               |

**`src/lib/game/engine/lifecycle.ts`** (12)

| English                                                      | Chinese                                 |
| ------------------------------------------------------------ | --------------------------------------- |
| 🏛️ No profit, no income tax due                              | 🏛️ 没有盈利，不用缴所得税               |
| ⏭️ Trading skipped                                           | ⏭️ 跳过交易                             |
| \n👥=== Processing Worker Production ===                     | \n👥=== 结算工匠产出 ===                |
| \n💰=== Paying Worker Wages ===                              | \n💰=== 支付工匠工钱 ===                |
| ⏭️ Skipped Shipyard Actions                                  | ⏭️ 跳过船坞操作                         |
| 🎮 ${APP_NAME} · Game Over!                                  | 🎮 {APP_NAME} · 游戏结束！              |
| 💰 Final Funds: ${state.money} Gold                          | 💰 最终资金：{state.money}金币          |
| 🏆 Final Reputation: ${state.score}                          | 🏆 最终声誉：{state.score}              |
| 📈 Rank: ${rating}                                           | 📈 评级：{rating}                       |
| ⚓ Welcome to ${APP_NAME}!                                   | ⚓ 欢迎来到{APP_NAME}！                 |
| 🚢 Sail across ports, build your business empire!            | 🚢 扬帆走遍各个港口，开创你的商业帝国！ |
| 👥 Hire artisans to craft valuable goods for higher profits! | 👥 雇工匠，做出贵重货物，赚更高的利润！ |

**`src/lib/game/engine/market.ts`** (10)

| English                                                                                                                                                     | Chinese                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| ${m}×${a}                                                                                                                                                   | {m}×{a}                                                                               |
| 🌊 Tidewatch Alert: the harbor takes notice of a bustling crew! One more cargo lot joins the Port Purchase board, every round, for the rest of this voyage. | 🌊 观潮预警：港湾瞧见船队忙起来了！本航程余下的每一轮，港口采购板上都会多出一件货物。 |
| ❌ Insufficient funds! Need ${cost} Gold, Have ${state.money} Gold                                                                                          | ❌ 资金不足！要{cost}金币，现有{state.money}金币                                      |
| ❌ No room in the hold for that lot: it takes ${units} ${units === 1 ? "slot" : "slots"} and ${room} ${room === 1 ? "is" : "are"} free.                     | ❌ 货舱放不下这件货：它要占{units}个仓位，空着{room}个。                              |
| 🛒 Bought Product at ${card.port}, Total ${cost} Gold                                                                                                       | 🛒 在{card.port}买下成品，合计{cost}金币                                              |
| 💡 Tip: VAT applies when selling finished products                                                                                                          | 💡 提示：卖出成品要缴市舶税                                                           |
| ${ICONS[r.type]}${r.type}×${r.quantity}(${r.price} Gold/item)                                                                                               | {ICONS[r.type]}{r.type}×{r.quantity}（{r.price}金币/件）                              |
| 🛒 Bought at ${card.port}: ${txt}, Total ${cost} Gold                                                                                                       | 🛒 在{card.port}买下：{txt}，合计{cost}金币                                           |
| 💰 Current Funds: ${state.money} Gold                                                                                                                       | 💰 当前资金：{state.money}金币                                                        |
| ⏭️ Purchasing skipped                                                                                                                                       | ⏭️ 跳过采购                                                                           |

**`src/lib/game/engine/milestones.ts`** (1)

| English                                 | Chinese                               |
| --------------------------------------- | ------------------------------------- |
| \n${moment.icon}=== ${moment.title} === | \n{moment.icon}=== {moment.title} === |

**`src/lib/game/engine/modules.ts`** (2)

| English                                | Chinese                   |
| -------------------------------------- | ------------------------- |
| 🔧 ${name} is bolted to the hull.      | 🔧 {name}已铆在船体上。   |
| ❌ The yard has no ${name} to bolt on. | ❌ 船坞没有可装的{name}。 |

**`src/lib/game/engine/objectives.ts`** (4)

| English                                                                                                            | Chinese                                                                 |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| 📜 The commission is already filled, and nothing was taken.                                                        | 📜 公议已经交齐，没有取走任何东西。                                     |
| 📜 Nothing in the hold answers the commission.                                                                     | 📜 货舱里没有公议要的东西。                                             |
| ${ICONS[r.type]}${r.type}×${r.take}                                                                                | {ICONS[r.type]}{r.type}×{r.take}                                        |
| 📜 Fleet Commission: delivered ${parts.join(" + ")} for ${paid} Gold. The Emperor's commission is exempt from VAT. | 📜 船队公议：交付{parts.join("、")}，得{paid}金币。皇命采办免缴市舶税。 |

**`src/lib/game/engine/opportunist.ts`** (3)

| English                                              | Chinese                                 |
| ---------------------------------------------------- | --------------------------------------- |
| 🎭 Free Captain                                      | 🎭 自由船长                             |
| 🎭 Borrow                                            | 🎭 借用                                 |
| 🎭 Your borrow is spent, and the order stays locked. | 🎭 你的借用已经用完，这份委托仍然锁定。 |

**`src/lib/game/engine/orders.ts`** (15)

| English                                                                                                                                     | Chinese                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ❌ Inventory short! Need ${short.type}×${short.required}                                                                                    | ❌ 库存不足！要{short.type}×{short.required}                                                                |
| 🤝 Broker's Commission (${pct}%): ${commission} Gold                                                                                        | 🤝 掮客抽成（{pct}%）：{commission}金币                                                                     |
| 💰 Reward: ${reward} Gold · ⚓ Freight: ${transport} Gold = 📊 Net Profit: ${reward - transport} Gold                                       | 💰 报酬：{reward}金币 · ⚓ 运费：{transport}金币 = 📊 净利：{reward - transport}金币                        |
| 📣 Word on the Docks: you were first to complete ${WORD_ON_THE_DOCKS_THRESHOLD} trade orders this voyage! +${WORD_ON_THE_DOCKS_REWARD} Gold | 📣 码头风闻：本航程头一个交足{WORD_ON_THE_DOCKS_THRESHOLD}笔贸易委托的是你！+{WORD_ON_THE_DOCKS_REWARD}金币 |
| ❌ Broker's Favor unlocks at Renown Level ${BROKERS_FAVOR_UNLOCK_LEVEL}                                                                     | ❌ 掮客的人情要到声望等级{BROKERS_FAVOR_UNLOCK_LEVEL}才解锁                                                 |
| ❌ You've already called in a Broker's Favor this voyage                                                                                    | ❌ 本航程你已经用过一次掮客的人情                                                                           |
| ❌ The Broker can't find a buyer for ${item}                                                                                                | ❌ 掮客找不到愿意买{item}的买家                                                                             |
| ❌ You have no ${item} in the hold for the Broker to sell                                                                                   | ❌ 货舱里没有{item}可以让掮客出手                                                                           |
| ❌ Choose between 1 and ${held} ${item} for the Broker to sell                                                                              | ❌ 掮客出手的{item}，1到{held}件之间选。                                                                    |
| ${ICONS[r.type]}${r.type}×${r.required}                                                                                                     | {ICONS[r.type]}{r.type}×{r.required}                                                                        |
| 🔮 The Broker only deals during Market.                                                                                                     | 🔮 掮客只在开市时做生意。                                                                                   |
| 🔮 The Broker has no more whispers...                                                                                                       | 🔮 掮客没有更多低语了...                                                                                    |
| ❌ Need ${cost} Gold for a rumor                                                                                                            | ❌ 买一条传闻要{cost}金币                                                                                   |
| 🗣️ Broker's Whisper: 'Word from ${port}: High demand for ${item}!'                                                                          | 🗣️ 掮客低语：'{port}有消息：急需{item}！'                                                                   |
| 📜 Imperial Mandate at ${mandate.port}: ${need} for ${mandate.reward} Gold. The Emperor's commission is exempt from VAT.                    | 📜 {mandate.port}的皇命采办：要{need}，得{mandate.reward}金币。皇命采办免缴市舶税。                         |

**`src/lib/game/engine/partialSight.ts`** (2)

| English | Chinese |
| ------- | ------- |
| a few   | 少量    |
| a haul  | 大量    |

**`src/lib/game/engine/pirates.ts`** (4)

| English                                                                  | Chinese                                     |
| ------------------------------------------------------------------------ | ------------------------------------------- |
| 🏴‍☠️ Pirates raided your hold! Lost all ${lost} Gold.                      | 🏴‍☠️ 海盗劫掠了你的货舱！{lost}金币全部损失。 |
| 🌊 Clear seas. No pirates sighted this round.                            | 🌊 海面平静。本轮没有发现海盗。             |
| ❌ Too late, this round's waters are already resolved                    | ❌ 太迟了，本轮的海面已经结算               |
| 🛡️ Hired an escort for ${cost} Gold. Safe passage guaranteed this round. | 🛡️ 花{cost}金币雇了护航。本轮航路安全无虞。 |

**`src/lib/game/engine/pricing.ts`** (6)

| English                                                                                                                 | Chinese                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Active boon                                                                                                             | 生效的机缘                                                                                               |
| Minimum freight                                                                                                         | 最低运费                                                                                                 |
| Average material cost                                                                                                   | 平均原料成本                                                                                             |
| ${recipe.worker_type === "weaver" ? "Weaver" : recipe.worker_type === "master" ? "Master Weaver" : "Sachet Maker"} wage | {recipe.worker_type === "weaver" ? "织女" : recipe.worker_type === "master" ? "纺织大师" : "香囊师"}工钱 |
| ${Math.round(VAT_RATE * 100)}% VAT on the margin                                                                        | 按差价计市舶税{Math.round(VAT_RATE * 100)}%                                                              |
| Floor at 0 Gold                                                                                                         | 下限0金币                                                                                                |

**`src/lib/game/engine/refits.ts`** (14)

| English                                                                                                        | Chinese                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| ❌ Only a Loom captain buys rags off the harbor pile.                                                          | ❌ 只有织造船长才从港湾的碎布堆里买碎布。                                                    |
| ❌ The harbor has no rags left for you this leg.                                                               | ❌ 本航段港湾没有碎布留给你了。                                                              |
| ❌ ${RAG_SCRAP_VALUE} Gold buys a rag, and the purse is short.                                                 | ❌ 一块碎布要{RAG_SCRAP_VALUE}金币，钱袋不够。                                               |
| ❌ There is no room in the hold for another rag.                                                               | ❌ 货舱里放不下再多一块碎布了。                                                              |
| ${ICONS.Rags} Bought a rag off the harbor pile for ${RAG_SCRAP_VALUE} Gold. ${left - 1} left for you this leg. | {ICONS.Rags} 花{RAG_SCRAP_VALUE}金币从港湾的碎布堆买了一块碎布。本航段还给你剩{left - 1}块。 |
| ❌ Only a Loom captain knows how to work rags back into cloth.                                                 | ❌ 只有织造船长懂得把碎布重新织回布。                                                        |
| ❌ A reweave takes ${REWEAVE_RAGS} rags and the hold has fewer.                                                | ❌ 重织一次要{REWEAVE_RAGS}块碎布，货舱里不够。                                              |
| 🧵 ${REWEAVE_RAGS} rags go back on the loom and come off as one ${REWEAVE_GOOD}.                               | 🧵 {REWEAVE_RAGS}块碎布回到织机上，下来就是一件{REWEAVE_GOOD}。                              |
| ❌ That is not something the harbor can put right.                                                             | ❌ 这个港湾修不了。                                                                          |
| ❌ The harbor tailors have already worked on the crew this leg.                                                | ❌ 本航段港湾的裁缝已经给船员整补过了。                                                      |
| ❌ The crew is wearing no worn ${good} for the harbor to mend.                                                 | ❌ 船员身上没有需要港湾缝补的破旧{good}。                                                    |
| ❌ A mend costs ${MEND_GOLD_PER_POINT} Gold and the purse is short.                                            | ❌ 缝补一次要{MEND_GOLD_PER_POINT}金币，钱袋不够。                                           |
| ${ICONS.Rags} The harbor tailor takes ${MEND_GOLD_PER_POINT} Gold for ${back} point of the ${good}.            | {ICONS.Rags} 港湾的裁缝收{MEND_GOLD_PER_POINT}金币，补回{good}的{back}点。                   |
| ❌ There is no worn ${contract.good} left to work on.                                                          | ❌ 没有还需要缝补的破旧{contract.good}了。                                                   |

**`src/lib/game/engine/seats.ts`** (4)

| English                                                                                              | Chinese                                                         |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 🏴 Bankrupt: the harbor marks it against this captain's name for the rest of the voyage.             | 🏴 破产：本航程余下的时间里，港湾都会把这件事记在这位船长名下。 |
| 🏝️ The harbor has voted to maroon this captain.                                                      | 🏝️ 港湾已经投票把这位船长放逐上岸。                             |
| ⚖️ The ship and its hold are forfeit. The harbor takes ${taken} Gold and leaves ${kept} Gold aboard. | ⚖️ 船和货舱一并没收。港湾取走{taken}金币，船上留下{kept}金币。  |
| 🧭 The Harbormaster's hand: once a leg, one port's prices answer to this captain.                    | 🧭 港务长之手：每航段一次，让某个港口的价格听命于这位船长。     |

**`src/lib/game/engine/standing.ts`** (2)

| English                                                                                                                       | Chinese                                                            |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 🪧 Standing orders at the port board: bought ${bought.length} cargo ${ bought.length === 1 ? "lot" : "lots" } you had priced. | 🪧 港口采购板上的常备委托：买下了{bought.length}件你定过价的货物。 |
| 🪧 Standing orders at the trade board: filled ${filled} ${ filled === 1 ? "order" : "orders" } the hold could cover.          | 🪧 委托板上的常备委托：交付了{filled}份货舱供得上的委托。          |

**`src/lib/game/engine/workers.ts`** (21)

| English                                                                                                   | Chinese                                                                            |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| ❌ Insufficient funds to hire workers!                                                                    | ❌ 资金不足，雇不起工匠！                                                          |
| ${def?.icon ?? "🧑"} Hired ${identity.name} the ${label}! Wage: ${wage} Gold / Round (paid at round end)  | {def?.icon ?? "🧑"} 雇下了{label}{identity.name}！工钱：每轮{wage}金币（轮末支付） |
| 🪷 Jade Pavilion pledge honored: this artisan joins at no cost, so the first wage is on the House.        | 🪷 玉阁的承诺兑现：这位工匠入伙不收钱，头一笔工钱也由玉阁代付。                    |
| ❌ Insufficient funds for ${label}'s severance: ${wage} Gold                                              | ❌ 付不起{label}的遣散费：{wage}金币                                               |
| 💔 Dismissed ${worker.name} the ${label}. Severance: ${wage} Gold                                         | 💔 遣散了{label}{worker.name}。遣散费：{wage}金币                                  |
| This worker was making: ${worker.task}                                                                    | 这位工匠本来在做：{worker.task}                                                    |
| ${ICONS[m]}${m} ${have}/${a}${have \< a ? " ⚠️" : ""}                                                     | {ICONS[m]}{m} {have}/{a}{have \< a ? " ⚠️" : ""}                                   |
| ❌ Material shortage to produce ${task}! (Have: ${short})                                                 | ❌ 材料不足，做不了{task}！（现有：{short}）                                       |
| ❌ All workers are already assigned tasks!                                                                | ❌ 所有工匠都已经安排了活计！                                                      |
| ✅ Skilled ${name} finished ${amt}× ${ICONS[w.task]}${w.task}! (Bonus)                                    | ✅ 熟练的{name}完成了{amt}× {ICONS[w.task]}{w.task}！（加成）                      |
| ✅ Skilled ${name} finished ${amt}× ${ICONS[w.task]}${w.task}!                                            | ✅ 熟练的{name}完成了{amt}× {ICONS[w.task]}{w.task}！                              |
| ✅ ${name} finished ${ICONS[w.task]}${w.task}!                                                            | ✅ {name}完成了{ICONS[w.task]}{w.task}！                                           |
| ⭐ ${name} Promotion! Can now produce 2 items per round!                                                  | ⭐ {name}晋升！现在每轮可产出2件！                                                 |
| 🪷 Jade Pavilion covers the wage for ${b.sponsored} ${b.sponsored === 1 ? b.label : b.plural} this round. | 🪷 本轮{b.sponsored}名{b.sponsored === 1 ? b.label : b.plural}的工钱由玉阁代付。   |
| 💰 Paid wages for ${b.count} ${b.count === 1 ? b.label : b.plural}: ${b.due} Gold                         | 💰 支付了{b.count}名{b.count === 1 ? b.label : b.plural}的工钱：{b.due}金币        |
| ⚠️ Insufficient funds! Needed: ${total} Gold, Have: ${state.money} Gold                                   | ⚠️ 资金不足！要{total}金币，现有{state.money}金币                                  |
| 💥 Could not pay wages, the crew is left unpaid.                                                          | 💥 付不出工钱，工匠这一轮白干。                                                    |
| 💥 Reputation collapsed: a bankruptcy is recorded.                                                        | 💥 声誉崩塌：记下一次破产。                                                        |
| 💸 Paid Ship Maintenance Fee: ${cost} Gold                                                                | 💸 已付船只维护费：{cost}金币                                                      |
| ⚠️ Forced payment of ${paid} Gold (Needed ${cost} Gold)                                                   | ⚠️ 被迫支付{paid}金币（要{cost}金币）                                              |
| ⚠️ Funds depleted: the maintenance fee goes unpaid.                                                       | ⚠️ 资金耗尽：维护费交不上。                                                        |

**`src/lib/game/foods.ts`** (3)

| English                                                                                                                                                 | Chinese                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| ${FOODS[food].icon} ${meals} ${meals === 1 ? "ration" : "rations"} of ${food} turned at sea. ${Math.max(0, state.larder - spoiled)} left in the larder. | {FOODS[food].icon} {meals}份{food}在海上变质了。粮舱还剩{Math.max(0, state.larder - spoiled)}份。 |
| ❌ Not enough Produce aboard to preserve: a batch is ${PRESERVE_MEALS_IN} meals.                                                                        | ❌ 船上的时鲜不够腌制：一批要{PRESERVE_MEALS_IN}份。                                              |
| 🐟 Preserved ${taken} ${taken === 1 ? "ration" : "rations"} of Produce into ${made} of Salt Fish (${state.larder} in the larder).                       | 🐟 把{taken}份时鲜腌成了{made}份咸鱼（粮舱里有{state.larder}份）。                                |

**`src/lib/game/gambit.ts`** (10)

| English                                                                                                                         | Chinese                                                        |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Finish the voyage holding at least ${flourish.amount} Gold of your own.                                                         | 走完航程时，自己手上还留着至少{flourish.amount}金币。          |
| Finish the voyage at ${flourish.amount} Reputation or better.                                                                   | 走完航程时声誉达到{flourish.amount}或更高。                    |
| Finish the voyage still holding ${flourish.amount} ${flourish.good} of your own.                                                | 走完航程时，自己手上还留着{flourish.amount} {flourish.good}。  |
| Hand over at least ${flourish.amount} items of the commission yourself.                                                         | 公议的货，你本人至少交出{flourish.amount}件。                  |
| ${name} sails the same flag you do, and the two of you know it.                                                                 | {name}和你挂同一面旗，你们两人都清楚。                         |
| Honest Captain                                                                                                                  | 诚信船长                                                       |
| You sail the public objective with the fleet. Nothing about you is hidden.                                                      | 你和船队同走公开的目标。你的一切，都摊在明面上。               |
| Pirate                                                                                                                          | 海盗                                                           |
| You sail under a false flag. The fleet's objective has to fail, and you have to stay solvent while it does.                     | 你挂着假旗航行。船队的目标得落空，落空之前，你还得撑着不破产。 |
| You sail for yourself, and only for yourself. Profit from deals with other captains, and the fleet's success is no loss to you. | 你为自己航行，只为自己。跟其他船长交易赚钱，船队成功也不亏你。 |

**`src/lib/game/larder.ts`** (5)

| English                                                                                                                                                                       | Chinese                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| ⚠️ Short rations! ${crew} aboard and the larder is empty: the crew works this leg at ${pace}% pace, and every line still brings home at least one item. The fleet can see it. | ⚠️ 减半口粮！船上{crew}人，粮舱已空：本航段船员按{pace}%的速度干活，每人仍至少带回一件。船队看得见。 |
| 🍲 The crew eats ${need} ${need === 1 ? "ration" : "rations"}. ${state.larder} left in the larder.                                                                            | 🍲 船员吃掉{need}份口粮。粮舱还剩{state.larder}份。                                                  |
| 🧺 The larder is full.                                                                                                                                                        | 🧺 粮舱已满。                                                                                        |
| ❌ Not enough Gold to provision the crew: a leg of rations is ${cost} Gold.                                                                                                   | ❌ 金币不够给船员备粮：一个航段的口粮要{cost}金币。                                                  |
| 🧺 Provisioned ${rations} ${rations === 1 ? "ration" : "rations"} of ${food} for ${crew} aboard (${cost} Gold). ${state.larder} in the larder.                                | 🧺 给船上{crew}人备齐了口粮：{rations}份{food}，花了{cost}金币。粮舱里{state.larder}份。             |

**`src/lib/game/maroon.ts`** (2)

| English                                              | Chinese                                |
| ---------------------------------------------------- | -------------------------------------- |
| Two thirds                                           | 三分之二                               |
| ${shift.port}: every price ${percent} percent ${way} | {shift.port}：每个价钱{way} {percent}% |

**`src/lib/game/merits.ts`** (5)

| English                                                                          | Chinese                                                                |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Open Water Captain                                                               | 开阔水域船长                                                           |
| Storm Sovereign                                                                  | 风暴之主                                                               |
| Get crowned Sea Master on a ${monsoon.name} voyage.                              | 在{monsoon.name}的航程中加冕沧海之主。                                 |
| Eye of the Storm                                                                 | 风暴之眼                                                               |
| Finish a ${monsoon.name} voyage with ${EYE_OF_THE_STORM_REPUTATION}+ Reputation. | 走完一次{monsoon.name}的航程，声誉达到{EYE_OF_THE_STORM_REPUTATION}+。 |

**`src/server/realtime/admin.ts`** (15)

| English                                                                | Chinese                                      |
| ---------------------------------------------------------------------- | -------------------------------------------- |
| This harbor was closed by the harbor operator.                         | 这个港湾已被港湾操作员关闭。                 |
| This account was deleted by the harbor operator.                       | 这个账号已被港湾操作员删除。                 |
| Sign in to use the operator console.                                   | 登录后可使用操作员控制台。                   |
| No account was named.                                                  | 没有指定账号。                               |
| That account no longer exists.                                         | 那个账号已经不存在了。                       |
| You cannot ban your own account.                                       | 不能封停你自己的账号。                       |
| You cannot revoke your own administrator role.                         | 不能撤销你自己的管理员身份。                 |
| This is the only administrator left, so the role cannot be revoked.    | 这是最后一位管理员，身份不能撤销。           |
| Type ${target.username} to confirm the deletion.                       | 输入{target.username}确认删除。              |
| You cannot delete your own account.                                    | 不能删除你自己的账号。                       |
| This is the only administrator left, so the account cannot be deleted. | 这是最后一位管理员，账号不能删除。           |
| That is not an action the console can take.                            | 这不是控制台能做的操作。                     |
| Select at least one account first.                                     | 请先至少选择一个账号。                       |
| Type 1 to confirm deleting one account.                                | 输入1确认删除这一个账号。                    |
| Type ${ids.length} to confirm deleting ${ids.length} accounts.         | 输入{ids.length}确认删除{ids.length}个账号。 |

**`src/server/realtime/audit.ts`** (3)

| English                                                                              | Chinese                                                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| The harbor spent this leg's Parley on the Manifest Audit. ${reopens} again next leg. | 港湾把本航段的洽谈用在了舱单稽查上。{reopens}要等到下个航段。 |
| This voyage's audit has already carried.                                             | 本航程的稽查表决已经通过。                                    |
| Your name is already in for this leg's audit.                                        | 本航段的稽查你已经投过票了。                                  |

**`src/server/realtime/auth.ts`** (3)

| English                    | Chinese          |
| -------------------------- | ---------------- |
| Missing session            | 缺少会话         |
| Invalid or expired session | 会话无效或已过期 |
| Authenticate first         | 请先登录         |

**`src/server/realtime/barter.ts`** (8)

| English                                                                                                                            | Chinese                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| That offer is no longer available.                                                                                                 | 那份报价已经没有了。                                                     |
| You can't accept your own offer.                                                                                                   | 不能接受你自己的报价。                                                   |
| That offer is only open to a specific captain.                                                                                     | 那份报价只面向指定的某位船长。                                           |
| That captain is not here right now. Try again when they are back.                                                                  | 那位船长现在不在。等他回来再试。                                         |
| Flexible bartering unlocks at Renown Level ${FLEXIBLE_BARTER_UNLOCK_LEVEL}.                                                        | 灵活易货在声望等级{FLEXIBLE_BARTER_UNLOCK_LEVEL}解锁。                   |
| Could not check Renown just now. Try again in a moment.                                                                            | 刚才查不了声望。稍等片刻再试。                                           |
| That captain has not unlocked flexible bartering yet.                                                                              | 那位船长还没有解锁灵活易货。                                             |
| Every flexible trade this voyage allows you has already been taken. You can still use the Captain's Exchange and accept any offer. | 本航程给你的灵活交易已经全部用完。船长行市照样能用，任何报价也照样能接。 |

**`src/server/realtime/checkpoint.ts`** (2)

| English                                                                                                                                   | Chinese                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| The harbor did not hear that leg move, so the ready check is open again. Press ready when you are done here and the voyage will carry on. | 港湾没有听到航段推进，就绪确认重新打开。这里忙完就点就绪，航程会继续。 |
| The tide has run out for this leg, and the harbor moves on. Any captain who had not finished commits the phase's own defaults.            | 本航段的潮水已尽，港湾照常前行。还没收尾的船长，按本阶段的默认来。     |

**`src/server/realtime/draft.ts`** (5)

| English                                       | Chinese                |
| --------------------------------------------- | ---------------------- |
| The draft is not running.                     | 抽取没有开。           |
| You are not in this draft.                    | 你不在这次抽取中。     |
| The table has moved past that step.           | 全桌已经过了这一步。   |
| Your card is already laid down.               | 你的牌已经放下了。     |
| That is not one of the cards in front of you. | 那不是摆在你面前的牌。 |

**`src/server/realtime/inbound-limit.ts`** (1)

| English                                                             | Chinese                              |
| ------------------------------------------------------------------- | ------------------------------------ |
| Too many actions at once. Give the harbor a moment, then try again. | 操作太频繁。让港湾缓一缓，再试一次。 |

**`src/server/realtime/maroon.ts`** (8)

| English                                                                   | Chinese                                            |
| ------------------------------------------------------------------------- | -------------------------------------------------- |
| The harbor has already voted one of its own ashore this voyage.           | 本航程港湾已经投票放逐过一位自己人了。             |
| The harbor has already written that captain off.                          | 港湾已经把那位船长划掉了。                         |
| Your name is already in for this leg's maroon vote.                       | 本航段的放逐投票你已经投过了。                     |
| A call in the closing leg would lean a market this voyage never opens.    | 收尾航段里调价，拨动的会是本航程根本不会开的市场。 |
| A call leans a market up or down, and that frame named neither direction. | 调价要让市场升或降，那一帧却没说往哪边。           |
| A call has to name a port.                                                | 调价，得说清是哪个港口。                           |
| The Harbormaster's hand belongs to the captain the harbor put ashore.     | 港务长之手属于被港湾放逐上岸的那位船长。           |
| The market this call lands on has not unlocked that port.                 | 这次调价落到的市场，还没有解锁那个港口。           |

**`src/server/realtime/quickstart.ts`** (1)

| English            | Chinese      |
| ------------------ | ------------ |
| Quick Start Harbor | 快速开局港湾 |

**`src/server/realtime/wiring/aid.ts`** (9)

| English                                       | Chinese                            |
| --------------------------------------------- | ---------------------------------- |
| Invalid aid request                           | 无效的借款请求                     |
| That request is no longer open.               | 那份请求已经不再开放。             |
| You can't fund your own request.              | 不能资助你自己的请求。             |
| Invalid repayment                             | 无效的还款                         |
| That loan is no longer outstanding.           | 那笔借款已经还清了。               |
| That loan is not yours to repay.              | 那笔借款不该由你还。               |
| another captain                               | 另一位船长                         |
| You can't back a loan you're already part of. | 你不能为你已经参与其中的借款作保。 |
| That loan already has a backer.               | 那笔借款已经有人作保了。           |

**`src/server/realtime/wiring/barter.ts`** (5)

| English                                                      | Chinese                                |
| ------------------------------------------------------------ | -------------------------------------- |
| Invalid barter offer                                         | 无效的易货报价                         |
| You can't direct an offer to yourself.                       | 不能把报价指定给自己。                 |
| The Captain's Exchange is only open during the Parley phase. | 船长行市只在洽谈阶段开放。             |
| The exchange opens                                           | 船长行市重开                           |
| Every flexible trade that captain has this voyage is done.   | 那位船长本航程的灵活交易已经全部用完。 |

**`src/server/realtime/wiring/bazaar.ts`** (4)

| English                                                          | Chinese                                  |
| ---------------------------------------------------------------- | ---------------------------------------- |
| The bazaar is not running in this harbor.                        | 这个港湾没有开香市。                     |
| A rumor leans a price one way or the other, and no other way.    | 一条传闻只能把价钱往一边拨，不能往别处。 |
| A rumor is spread at the Parley, where the whole table hears it. | 传闻在洽谈时放出，全桌的人都听得见。     |
| The next port does not trade that good.                          | 下一个港口不做这种货的买卖。             |

**`src/server/realtime/wiring/consent-shared.ts`** (1)

| English                                                      | Chinese                                |
| ------------------------------------------------------------ | -------------------------------------- |
| You already have an offer standing for anyone at this table. | 你已经挂着一份面向全桌任何人的报价了。 |

**`src/server/realtime/wiring/escort-contracts.ts`** (20)

| English                                                                                  | Chinese                                    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| The escort market is not running in this harbor.                                         | 这个港湾没有开护航市场。                   |
| One leg of protection is sold in the Parley phase.                                       | 一个航段的护卫在洽谈阶段卖出。             |
| Protection is sold                                                                       | 护卫开卖                                   |
| You can't sell protection to yourself.                                                   | 不能把护卫卖给自己。                       |
| That offer is no longer on the board.                                                    | 那份报价已经不在板上了。                   |
| That contract has already been agreed.                                                   | 那份契约已经议定了。                       |
| That cover has already answered for a raid.                                              | 那份护卫已经抵过一次劫掠了。               |
| That offer has already been turned down.                                                 | 那份报价已经被拒绝了。                     |
| You are the one selling that protection.                                                 | 那份护卫是你自己在卖。                     |
| A contract is agreed in the Parley phase.                                                | 契约在洽谈阶段议定。                       |
| Contracts are agreed                                                                     | 契约议定                                   |
| You have already turned that offer down.                                                 | 你已经拒过那份报价了。                     |
| That contract is past the offer, so there is nothing to turn down.                       | 那份契约已经过了报价的阶段，没什么可拒的。 |
| That offer is open to the whole table, so there is nothing for one captain to turn down. | 那份报价面向全桌，轮不到某一位船长来拒。   |
| Only the captain who posted an offer can take it back.                                   | 只有挂出报价的船长才能收回。               |
| That offer was turned down, so there is nothing to take back.                            | 那份报价已经被拒，没什么可收回的。         |
| That contract has been agreed, so it can't be withdrawn.                                 | 那份契约已经议定，不能撤回。               |
| There is no agreed contract of yours to claim against.                                   | 你没有已议定的契约可以索赔。               |
| That contract covers another captain.                                                    | 那份契约保的是另一位船长。                 |
| That contract was for an earlier leg.                                                    | 那份契约是更早航段的。                     |

**`src/server/realtime/wiring/module-trades.ts`** (10)

| English                                                         | Chinese                          |
| --------------------------------------------------------------- | -------------------------------- |
| The module market is not running in this harbor.                | 这个港湾没有开模块市场。         |
| A listing names a module the yard can bolt on.                  | 挂牌要写明船坞能装上的模块。     |
| A module is listed in the Parley phase.                         | 模块在洽谈阶段挂牌。             |
| Modules are listed                                              | 模块挂牌                         |
| You can't sell a module to yourself.                            | 不能把模块卖给自己。             |
| You have already listed that module this leg.                   | 本航段你已经挂过那个模块了。     |
| You are the one selling that module.                            | 那个模块是你自己在卖。           |
| A module trade is agreed in the Parley phase.                   | 模块交易在洽谈阶段议定。         |
| Module trades are agreed                                        | 模块交易议定                     |
| That module has been agreed, so the listing can't be withdrawn. | 那个模块已经议定，挂牌不能撤回。 |

**`src/server/realtime/wiring/path-draft.ts`** (2)

| English                                       | Chinese                  |
| --------------------------------------------- | ------------------------ |
| The path draft is not running in this harbor. | 这个港湾没有开商道抽取。 |
| No such path.                                 | 没有这条商道。           |

**`src/server/realtime/wiring/quickstart.ts`** (2)

| English                                                 | Chinese                                    |
| ------------------------------------------------------- | ------------------------------------------ |
| Your session expired. Sign in again to use Quick Start. | 你的会话已过期。重新登录后可使用快速开局。 |
| Could not find a harbor just now. Please try again.     | 现在找不到可以进的港湾，请再试一次。       |

**`src/server/realtime/wiring/refits.ts`** (7)

| English                                               | Chinese                          |
| ----------------------------------------------------- | -------------------------------- |
| The refit bench is not running in this harbor.        | 这个港湾没有开整补台。           |
| A refit names a garment the crew can wear.            | 整补要指定一件船员穿得上的衣物。 |
| A refit is agreed at a port, in the Market phase.     | 整补在港口的开市阶段议定。       |
| You can't sell a refit to yourself.                   | 不能把整补卖给自己。             |
| You have already taken on a refit this leg.           | 本航段你已经接过一次整补了。     |
| You are the one selling that refit.                   | 那次整补是你自己在卖。           |
| That refit has been agreed, so it can't be withdrawn. | 那次整补已经议定，不能撤回。     |

**`src/server/realtime/wiring/start-voyage.ts`** (3)

| English                                              | Chinese                          |
| ---------------------------------------------------- | -------------------------------- |
| This voyage has already set sail.                    | 这次航程已经起航了。             |
| Only the host can start the voyage.                  | 只有港主可以启航。               |
| Need at least one captain in the harbor to set sail. | 港湾里至少要有一位船长才能启航。 |

**`src/server/realtime/wiring/status-heartbeat.ts`** (1)

| English                                                                                                                                                 | Chinese                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Tidewatch Alert: the harbor takes notice of a bustling crew. One more cargo lot joins every captain's Port Purchase board, for the rest of this voyage. | 观潮预警：港湾瞧见船队忙起来了。本航程余下期间，每位船长的港口采购板上都会多出一件货物。 |

**`src/server/realtime/wiring/ventures.ts`** (8)

| English                                                                                                          | Chinese                                                                            |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Invalid venture.                                                                                                 | 无效的合股。                                                                       |
| Target must be between ${CONVOY_VENTURE_MIN_TARGET} and ${CONVOY_VENTURE_MAX_TARGET} Gold.                       | 目标金额得在{CONVOY_VENTURE_MIN_TARGET}金币到{CONVOY_VENTURE_MAX_TARGET}金币之间。 |
| Too late in the voyage to post a new Venture. There's no round left that would leave time to spend the reward.   | 航程已经太晚，挂不出新的合股。剩下的轮数不够花掉那份报酬。                         |
| Invalid contribution.                                                                                            | 无效的出资。                                                                       |
| That venture is no longer open.                                                                                  | 那份合股已经不再开放。                                                             |
| That venture's deadline has already passed.                                                                      | 那份合股已经过了截止时间。                                                         |
| You've already backed this venture as much as any single captain can. It needs another captain to fund the rest. | 你对这份合股的出资已经到单人上限。余下的要等另一位船长出资。                       |
| That venture is already fully funded.                                                                            | 那份合股已经募足了。                                                               |

### The room, first sweep (299)

The room at play: the harbor frame, the market, orders, parley, escort contracts, the audit and the vote.

**`src/components/portmasters/ActionSuggester.tsx`** (1)

| English | Chinese |
| ------- | ------- |
| gold    | 金币    |

**`src/components/portmasters/AdminConsole.tsx`** (2)

| English          | Chinese         |
| ---------------- | --------------- |
| Cancel           | 取消            |
| · ${clock.label} | · {clock.label} |

**`src/components/portmasters/BalanceDashboard.tsx`** (1)

| English               | Chinese            |
| --------------------- | ------------------ |
| of ${spec.durability} | /{spec.durability} |

**`src/components/portmasters/ChatPanel.tsx`** (1)

| English | Chinese |
| ------- | ------- |
| offer   | 给出    |

**`src/components/portmasters/GameRoom.tsx`** (36)

| English                                                                                                                                 | Chinese                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Weighing anchor…                                                                                                                        | 正在起锚...                                                                   |
| Harbor                                                                                                                                  | 港湾                                                                          |
| Direct                                                                                                                                  | 私聊                                                                          |
| Open the captain panel                                                                                                                  | 打开船长面板                                                                  |
| Round ${state.game.currentRound}                                                                                                        | 第{state.game.currentRound}轮                                                 |
| Open the Harbor Roster                                                                                                                  | 打开港湾名册                                                                  |
| Open the chat                                                                                                                           | 打开聊天                                                                      |
| Strategy tips                                                                                                                           | 策略提示                                                                      |
| A voyage leaves the pier when the host sets sail, not by readying up.                                                                   | 港主起航，船才离码头；光点就绪开不了船。                                      |
| The Path Draft is left by laying your cards down. Each step turns over when every hand is in.                                           | 落牌，择道就结束。人人都出完牌，每一步才翻开。                                |
| Dawn is left by locking in a Boon. Pick one of the cards and it goes with you.                                                          | 锁定一份机缘，破晓就结束。挑一张，它跟着你上路。                              |
| This voyage is over for you, so there is no seat left to leave.                                                                         | 这趟航程对你已经结束，没有席位可退。                                          |
| Your own screen has work open on it. Finish or close it and the room moves on.                                                          | 你自己屏幕上还有活没干完。做完或关掉，港湾才能往下走。                        |
| Crowned Sea Master!                                                                                                                     | 加冕沧海之主！                                                                |
| Highest Reputation in the harbor this voyage: ${mine.reputation}.                                                                       | 本航程港湾里声誉最高：{mine.reputation}。                                     |
| 🤝 Broker's Favor unlocked!                                                                                                             | 🤝 掮客的人情已解锁！                                                         |
| Renown Level ${BROKERS_FAVOR_UNLOCK_LEVEL} reached. The Broker owes you one, starting next voyage.                                      | 声望等级到{BROKERS_FAVOR_UNLOCK_LEVEL}了。下一趟航程起，掮客欠你一份人情。    |
| Captain's Merit earned: ${merit.name}                                                                                                   | 船长功勋入手：{merit.name}                                                    |
| 📣 Word on the Docks!                                                                                                                   | 📣 码头风闻！                                                                 |
| First to complete ${WORD_ON_THE_DOCKS_THRESHOLD} trade orders this voyage. +${data.reward} Gold.                                        | 本航程头一个交足{WORD_ON_THE_DOCKS_THRESHOLD}笔贸易委托。+{data.reward}金币。 |
| Word on the Docks!                                                                                                                      | 码头风闻！                                                                    |
| You won the race to ${WORD_ON_THE_DOCKS_THRESHOLD} orders. +${data.reward} Gold.                                                        | 你抢先交足{WORD_ON_THE_DOCKS_THRESHOLD}笔委托。+{data.reward}金币。           |
| 📣 Word on the Docks                                                                                                                    | 📣 码头风闻                                                                   |
| 🌊 Tidewatch Alert                                                                                                                      | 🌊 观潮预警                                                                   |
| The harbor takes notice of a bustling crew. One more cargo lot joins the Port Purchase board, every round, for the rest of this voyage. | 船队一忙，港湾就留意到了。本航程余下每一轮，港口采购板上都多一件货。          |
| Tidewatch Alert                                                                                                                         | 观潮预警                                                                      |
| The harbor crossed ${TIDEWATCH_SURGE_THRESHOLD} combined Reputation.                                                                    | 港湾的声誉合计越过了{TIDEWATCH_SURGE_THRESHOLD}。                             |
| One extra cargo lot joins every Port Purchase board, every round.                                                                       | 每一轮，每块港口采购板上都多一件货。                                          |
| Progress saved                                                                                                                          | 进度已保存                                                                    |
| Your voyage is recorded on the server.                                                                                                  | 你的航程已经记在服务器上了。                                                  |
| Save failed                                                                                                                             | 保存失败                                                                      |
| Could not reach the Harbormaster.                                                                                                       | 联系不上港务长。                                                              |
| This seat is not left by pressing Next Phase                                                                                            | 按下一阶段，退不出这个席位                                                    |
| Room code copied                                                                                                                        | 港湾口令已复制                                                                |
| Harbor chat                                                                                                                             | 港湾聊天                                                                      |
| Direct messages                                                                                                                         | 私聊                                                                          |

**`src/components/portmasters/game/AudienceSelect.tsx`** (1)

| English                 | Chinese         |
| ----------------------- | --------------- |
| 🌊 Anyone in the harbor | 🌊 港湾里所有人 |

**`src/components/portmasters/game/AuditPanel.tsx`** (11)

| English                                                                                                                                                                                                                                                                                                                                                                                                                         | Chinese                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A majority of the captains still sailing can open one manifest. What comes back is a sample of what they filed. A carried vote ends this leg&apos;s trading, and the voyage carries on at the next leg. The count below names who is still to vote, and what the vote does when the names it needs land on one captain.                                                                                                         | 仍在航的船长过半数，就能开一份舱单。开出来的是他们申报内容的抽样。表决过了，本航段的交易就到此为止，航程接着走下一航段。下面的计数写着还有谁没投，也写着所需的名字全落到同一位船长头上时，表决会起什么作用。                                                   |
| No order fulfillments filed this voyage.                                                                                                                                                                                                                                                                                                                                                                                        | 本航程没有申报过一笔委托交付。                                                                                                                                                                                                                                 |
| Hide the audit                                                                                                                                                                                                                                                                                                                                                                                                                  | 隐藏稽查                                                                                                                                                                                                                                                       |
| Captain to audit                                                                                                                                                                                                                                                                                                                                                                                                                | 待稽查船长                                                                                                                                                                                                                                                     |
| Call the audit                                                                                                                                                                                                                                                                                                                                                                                                                  | 发起稽查                                                                                                                                                                                                                                                       |
| Open ${name}'s manifest                                                                                                                                                                                                                                                                                                                                                                                                         | 打开{name}的舱单                                                                                                                                                                                                                                               |
| A captain the harbor has written off cannot be audited.                                                                                                                                                                                                                                                                                                                                                                         | 港湾已经划掉的船长，稽查不了。                                                                                                                                                                                                                                 |
| an empty larder: this captain's crew is on short rations.                                                                                                                                                                                                                                                                                                                                                                       | 粮舱空空：这位船长的船员在吃减半口粮。                                                                                                                                                                                                                         |
| an empty larder, with no crew aboard to go hungry.                                                                                                                                                                                                                                                                                                                                                                              | 粮舱空空，船上没有船员会挨饿。                                                                                                                                                                                                                                 |
| rations aboard, eaten one a head each leg.                                                                                                                                                                                                                                                                                                                                                                                      | 船上有口粮，每航段每人吃一份。                                                                                                                                                                                                                                 |
| ${ reveal.flagged ? "The harbor's own checks could not reconcile this manifest, so its lines are withheld." : "A random sample of this captain's most recent order fulfillments, opened by a vote of the harbor. Their card, their Gold and the rest of their hold were not opened." } Opened by a majority in leg ${reveal.round}, which closed that leg's trading; the finding stays on the table for the rest of the voyage. | { reveal.flagged ? "港湾自己的核验对不上这份舱单，内容就不公开。" : "港湾投票开出的抽样，取自这位船长最近交付的委托。他的手牌、金币和货舱里其余的东西都没有打开。" }第{reveal.round}航段过半数票开启，那一段的交易就此结束；这条结论在本航程余下期间留在桌上。 |

**`src/components/portmasters/game/BarterTrade.tsx`** (13)

| English                                                                                                                    | Chinese                                                          |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| for                                                                                                                        | 换取                                                             |
| 🤝 Trade                                                                                                                   | 🤝 交易                                                          |
| 🔒 Flexible bartering                                                                                                      | 🔒 灵活易货                                                      |
| The Captain's Exchange at the Parley is open to you already.                                                               | 洽谈里的船长行市，已经对你开了。                                 |
| I'll give                                                                                                                  | 我给出                                                           |
| I want                                                                                                                     | 我想要                                                           |
| 🤝 Post Offer                                                                                                              | 🤝 挂出报价                                                      |
| Amount to offer                                                                                                            | 给出的数量                                                       |
| Item to offer                                                                                                              | 给出的货物                                                       |
| Amount to request                                                                                                          | 索要的数量                                                       |
| Item to request                                                                                                            | 索要的货物                                                       |
| Direct this offer to a specific captain                                                                                    | 把这份报价发给指定船长                                           |
| Every flexible trade this voyage allows you has been taken. You can still use the Captain's Exchange and accept any offer. | 本航程给你的灵活交易已经用光。船长行市还开着，报价你照样可以接。 |

**`src/components/portmasters/game/BazaarRumors.tsx`** (13)

| English                                                                                                                                                                  | Chinese                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Speak for                                                                                                                                                                | 为                                                                                                   |
| leaning                                                                                                                                                                  | 押                                                                                                   |
| 📈 Higher                                                                                                                                                                | 📈 看涨                                                                                              |
| 📉 Lower                                                                                                                                                                 | 📉 看跌                                                                                              |
| Spoken.                                                                                                                                                                  | 已发声。                                                                                             |
| ${SELLER_PATH.crest} ${SELLER_PATH.name} Bazaar                                                                                                                          | {SELLER_PATH.crest} {SELLER_PATH.name}香市                                                           |
| Good the rumor is about                                                                                                                                                  | 传闻说的是哪件货                                                                                     |
| No commodity on this route is traded yet, so there is nothing to say.                                                                                                    | 这条航路上还没有货物成交，没什么可说的。                                                             |
| Nobody has spoken at the bazaar yet this voyage.                                                                                                                         | 本航程还没有人在香市开口。                                                                           |
| Nobody has spoken in this leg or the one before it. The board keeps those two legs and no more. Older rows moved markets the room has already priced and traded through. | 本航段和上一段都没人开口。板上只留这两段，再早的不留。更早的行拨动过的市场，全桌早就定价、交易过了。 |
| Spoken in this leg. The next port prices this good against it, and the table reads which way you leaned the moment it does.                                              | 本航段已发声。下一港给这件货定价，就对着它来；价一落定，全桌都看得出你押的是哪一边。                 |
| Spoken in this leg. The direction belongs to the speaker until the next port prices it, so nobody at this table can tell a call from a lie yet.                          | 本航段已发声。下一港定价之前，方向只有开口的人自己知道，所以全桌此刻分不清这句是真话还是谎话。       |
| The market of this leg was priced against it, so the direction is public now.${ outcome ?                                                                                | 本航段的市场就是对着它定的价，方向如今人人都看得见。{ outcome ?                                      |

**`src/components/portmasters/game/CloseFooter.tsx`** (1)

| English | Chinese |
| ------- | ------- |
| Close   | 关闭    |

**`src/components/portmasters/game/EscortContracts.tsx`** (28)

| English                                                                                                                                                                                                                                                          | Chinese                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Escort Market                                                                                                                                                                                                                                                    | 护航市场                                                                                                                                      |
| One leg of cover for                                                                                                                                                                                                                                             | 一航段护卫，价钱                                                                                                                              |
| Offer this contract to a specific captain                                                                                                                                                                                                                        | 把这份契约发给指定船长                                                                                                                        |
| before the Parley closes.                                                                                                                                                                                                                                        | 在洽谈结束之前。                                                                                                                              |
| Nothing is on the market yet. Name a price and post the first offer, or wait and let a buyer come to you.                                                                                                                                                        | 市场上还是空的。开个价，挂上头一份报价；不想开，就等着买家上门。                                                                              |
| No protection is on offer this Parley. Only a Convoy captain at this table can sell one leg of cover, so their offer is what you are waiting for. An offer aimed at one captain waits on that captain, and an offer aimed at the table is any captain's to take. | 本次洽谈没有护卫可买。一航段护卫只有本桌的镖行船长卖得出，你要等的就是他的报价。点名给某位船长的，就等那位船长；挂给全桌的，谁先接就是谁的。  |
| ${crest} Take Cover                                                                                                                                                                                                                                              | {crest} 接下护卫                                                                                                                              |
| Turn It Down                                                                                                                                                                                                                                                     | 拒绝                                                                                                                                          |
| a captain                                                                                                                                                                                                                                                        | 某位船长                                                                                                                                      |
| Expired with the leg                                                                                                                                                                                                                                             | 随航段结束失效                                                                                                                                |
| Waiting on ${who}                                                                                                                                                                                                                                                | 等{who}                                                                                                                                       |
| Waiting on the table                                                                                                                                                                                                                                             | 等全桌                                                                                                                                        |
| Waiting on you                                                                                                                                                                                                                                                   | 等你                                                                                                                                          |
| Open to the table                                                                                                                                                                                                                                                | 面向全桌                                                                                                                                      |
| Agreed: you are covering                                                                                                                                                                                                                                         | 已同意：由你护卫                                                                                                                              |
| Agreed: you are covered                                                                                                                                                                                                                                          | 已同意：你受护卫                                                                                                                              |
| Agreed                                                                                                                                                                                                                                                           | 已同意                                                                                                                                        |
| Cover spent: your guns answered                                                                                                                                                                                                                                  | 护卫已用：你的炮口接下了劫掠                                                                                                                  |
| Cover spent                                                                                                                                                                                                                                                      | 护卫已用                                                                                                                                      |
| You turned it down                                                                                                                                                                                                                                               | 你拒绝了                                                                                                                                      |
| Turned down by ${who}                                                                                                                                                                                                                                            | 被{who}拒绝                                                                                                                                   |
| 🛡️ Your offer stands: ${one.fee} Gold for one leg of cover, open to every captain here. The first to take it gets it.                                                                                                                                            | 🛡️ 你的报价还挂着：一航段护卫，{one.fee}金币，本桌每位船长都能接。谁先接，护卫归谁。                                                          |
| 🛡️ ${standing.length} offers of yours stand this Parley, the newest at ${standing[standing.length - 1].fee} Gold. Each waits on the captain it names, or on the first captain to take an open one.                                                               | 🛡️ 本次洽谈你有{standing.length}份报价挂着，最新的一份{standing[standing.length - 1].fee}金币。点名给谁的，就等谁；挂给全桌的，谁先接算谁的。 |
| ${contract.fee} Gold                                                                                                                                                                                                                                             | {contract.fee}金币                                                                                                                            |
| You are selling one leg of cover for ${fee}                                                                                                                                                                                                                      | 你在卖一航段护卫，价钱{fee}                                                                                                                   |
| You are covering ${other} for ${fee} this leg                                                                                                                                                                                                                    | 本航段你替{other}护卫，价钱{fee}                                                                                                              |
| Your guns answered a raid meant for ${other}                                                                                                                                                                                                                     | 本该落在{other}头上的劫掠，由你的炮口接下                                                                                                     |
| ${other} turned down your offer of ${fee}                                                                                                                                                                                                                        | {other}拒绝了你{fee}的报价                                                                                                                    |

**`src/components/portmasters/game/GameControlPanel.tsx`** (21)

| English                                                | Chinese                          |
| ------------------------------------------------------ | -------------------------------- |
| Save                                                   | 保存                             |
| Restart                                                | 重开                             |
| Open the harbor guide                                  | 打开港湾指南                     |
| Save the voyage                                        | 保存航程                         |
| Restart the voyage                                     | 重开航程                         |
| Show all keyboard shortcuts                            | 显示全部快捷键                   |
| Keyboard shortcuts                                     | 快捷键                           |
| Game Over                                              | 游戏结束                         |
| Waiting for host…                                      | 等港主...                        |
| Need one captain                                       | 还差一位船长                     |
| Start Solo Practice                                    | 开始单人练习                     |
| Start the Voyage                                       | 开始航程                         |
| Drafting Paths...                                      | 正在择道...                      |
| Drafting Boon...                                       | 正在抽取机缘...                  |
| On Voyage...                                           | 航行中...                        |
| Next Phase                                             | 下一阶段                         |
| Saving…                                                | 保存中...                        |
| Saved                                                  | 已保存                           |
| Standing orders are written and on                     | 常备委托已写好并启用             |
| Write what your seat should do when the clock plays it | 写下席位在计时替你出牌时该怎么做 |
| Restart the voyage for everyone in the harbor          | 为港湾内所有人重开航程           |

**`src/components/portmasters/game/GameLogPanel.tsx`** (2)

| English                                                       | Chinese                                    |
| ------------------------------------------------------------- | ------------------------------------------ |
| 📜 Ledger                                                     | 📜 账簿                                    |
| The ledger is empty. Set sail to begin recording your voyage. | 账簿还是空的。一起航，你的航程就开始记了。 |

**`src/components/portmasters/game/GameModals.tsx`** (19)

| English                                                                                                                                                                                          | Chinese                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Every ledger update, harbor message, and direct message this session                                                                                                                             | 本次会话中的每一笔账簿更新、港湾消息和私聊                                                                                   |
| Nothing yet this voyage.                                                                                                                                                                         | 本航程还没有记下什么。                                                                                                       |
| Broker's Rumor Board                                                                                                                                                                             | 掮客传闻板                                                                                                                   |
| Spend gold to reveal what Orders will ask for!                                                                                                                                                   | 花点金币，看看委托会要什么！                                                                                                 |
| The Broker only deals during Market.                                                                                                                                                             | 掮客只在开市时做生意。                                                                                                       |
| 📜 Revealed Intel:                                                                                                                                                                               | 📜 已揭示的情报：                                                                                                            |
| ✨ No rumors revealed yet... Spend gold to listen to the Broker's whispers.                                                                                                                      | ✨ 还没揭开任何传闻... 花点金币，听听掮客低语。                                                                              |
| Restart the voyage?                                                                                                                                                                              | 重开航程？                                                                                                                   |
| Every captain currently in this harbor goes back to round one: gold, cargo, workers, and ship upgrades all reset. The harbor also reopens, so new captains can join again. This can't be undone. | 港湾里现有的船长一律回到第一轮：金币、货物、工匠和船只升级全部清零。港湾重新开放，新船长还能再进来。这一步收不回来。         |
| Restart for Everyone                                                                                                                                                                             | 为所有人重开                                                                                                                 |
| Leave the voyage?                                                                                                                                                                                | 离开航程？                                                                                                                   |
| The harbor sails on without you: your seat is written off, and the gold and cargo you were carrying go with it. You can start or join a new harbor right away. This can't be undone.             | 港湾没有你照样开航：你的席位就此除名，你身上的金币和货也一并带走。你随时可以自己开一个港湾，或加入别的港湾。这一步收不回来。 |
| Leave the Voyage                                                                                                                                                                                 | 离开航程                                                                                                                     |
| 🚢 Set Sail!                                                                                                                                                                                     | 🚢 扬帆起航！                                                                                                                |
| Skip tutorial                                                                                                                                                                                    | 跳过教程                                                                                                                     |
| Navigation Guide                                                                                                                                                                                 | 航行指南                                                                                                                     |
| ${APP_NAME} rules and shortcuts                                                                                                                                                                  | {APP_NAME} 规则与快捷键                                                                                                      |
| Trade Strategy Advice                                                                                                                                                                            | 交易策略建议                                                                                                                 |
| Close Board                                                                                                                                                                                      | 关闭面板                                                                                                                     |

**`src/components/portmasters/game/GameStatusPanel.tsx`** (3)

| English          | Chinese  |
| ---------------- | -------- |
| Dues             | 港务费   |
| Ledger           | 账簿     |
| attention needed | 需要注意 |

**`src/components/portmasters/game/HarborTopBar.tsx`** (10)

| English                                                     | Chinese                              |
| ----------------------------------------------------------- | ------------------------------------ |
| Leave                                                       | 离开                                 |
| Leave the harbor                                            | 离开港湾                             |
| Live                                                        | 已连接                               |
| Linking…                                                    | 连接中...                            |
| Colorblind safe palette on, click to use the default colors | 已开启色盲友好配色，点击恢复默认颜色 |
| Use a colorblind safe palette for goods                     | 为货物启用色盲友好配色               |
| Harbor sounds on, click to mute                             | 港湾音效已开启，点击静音             |
| Turn on harbor sounds and UI feedback                       | 开启港湾音效与界面提示音             |
| Mute harbor sounds                                          | 静音港湾音效                         |
| Turn on harbor sounds                                       | 开启港湾音效                         |

**`src/components/portmasters/game/MaroonPanel.tsx`** (16)

| English                                                                                                                                                                                                                                                                                       | Chinese                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🧭 The Harbormaster&apos;s Hand                                                                                                                                                                                                                                                               | 🧭 港务长之手                                                                                                                                                                       |
| Choose a port                                                                                                                                                                                                                                                                                 | 选一个港                                                                                                                                                                            |
| Lean prices up                                                                                                                                                                                                                                                                                | 抬高价格                                                                                                                                                                            |
| Lean prices down                                                                                                                                                                                                                                                                              | 压低价格                                                                                                                                                                            |
| A later call in this leg replaces this one.                                                                                                                                                                                                                                                   | 本航段内后一次的押注会取代这一次。                                                                                                                                                  |
| Maroon                                                                                                                                                                                                                                                                                        | 放逐                                                                                                                                                                                |
| Hide the vote                                                                                                                                                                                                                                                                                 | 隐藏表决                                                                                                                                                                            |
| Port to lean                                                                                                                                                                                                                                                                                  | 要押的港                                                                                                                                                                            |
| ${MAROON_VOTE_SHARE} of the captains still sailing, rounded up, can put one captain ashore. The vote is public. Once a vote carries it is spent for the whole voyage, a vote that falls short can be called again on a later leg, and the captain who loses it keeps their seat at the table. | 仍在航的船长里，{MAROON_VOTE_SHARE}（向上取整）赞成，就能把一位船长放逐上岸。表决是公开的。表决一过，本航程就把它用掉了；票数不够的，之后的航段还能再发起；输掉的那位照样保有席位。 |
| Captain to maroon                                                                                                                                                                                                                                                                             | 待放逐船长                                                                                                                                                                          |
| Call the vote                                                                                                                                                                                                                                                                                 | 发起表决                                                                                                                                                                            |
| Put ${name} ashore                                                                                                                                                                                                                                                                            | 把{name}放逐上岸                                                                                                                                                                    |
| ${MAROON_VOTE_SHARE} of the captains still in the voyage carry it, rounded up, and the vote is public: every name behind a target is on this board.                                                                                                                                           | 仍在航程中的船长，{MAROON_VOTE_SHARE}（向上取整）赞成即通过；表决是公开的：谁把名字给了谁，这块板上都写着。                                                                         |
| in force                                                                                                                                                                                                                                                                                      | 已生效                                                                                                                                                                              |
| Called in leg ${shift.round}. Every price at that port this leg was drawn against it.                                                                                                                                                                                                         | 第{shift.round}航段发起。本航段那个港的每个价钱，都是对着它定的。                                                                                                                   |
| Called in leg ${shift.round}. The market that opens next leg is the one that answers it, and a later call in this leg replaces it.                                                                                                                                                            | 第{shift.round}航段发起。下一航段开市，市场就是它的回音；本航段里后押的一次会取代它。                                                                                               |

**`src/components/portmasters/game/ModuleMarket.tsx`** (12)

| English                                                                                                                                                                                      | Chinese                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Every module on your hull is already on the board this leg. The market opens again next leg.                                                                                                 | 本航段你船体上的模块都已挂到板上。市场在下一航段重开。                                                                     |
| Sell                                                                                                                                                                                         | 出售                                                                                                                       |
| ${UNKNOWN_MODULE_ICON} Module Market                                                                                                                                                         | {UNKNOWN_MODULE_ICON} 模块市场                                                                                             |
| The module this listing sells                                                                                                                                                                | 这条挂单卖的模块                                                                                                           |
| Offer this module to a specific captain                                                                                                                                                      | 把这个模块发给指定船长                                                                                                     |
| Nothing on the market yet. List a module and yours is the first row. A listing comes off the board when the leg turns or the Parley closes, so a row you posted earlier may already be gone. | 市场上还是空的。挂出一个模块，你的就是第一行。航段一换或洽谈一结束，挂单就从板上撤下，所以你早先挂出的那一行可能已经没了。 |
| No modules on offer this Parley. Any captain with a module bolted on can list one, and a listing aimed at one captain waits on that captain.                                                 | 本次洽谈没有模块在售。船体上装了模块的船长都能挂出一个；指名给谁的挂单，就等谁。                                           |
| Every slot on your hull is full. Make room at the yard first.                                                                                                                                | 船体上的仓位已经满了，先去船坞腾个地方。                                                                                   |
| ${icon} Take It                                                                                                                                                                              | {icon} 接下                                                                                                                |
| ${trade.fee} Gold                                                                                                                                                                            | {trade.fee}金币                                                                                                            |
| You are selling ${name} for ${fee}                                                                                                                                                           | 你在卖{name}，价钱{fee}                                                                                                    |
| You sold ${name} to ${other} for ${fee}                                                                                                                                                      | 你把{name}卖给了{other}，价钱{fee}                                                                                         |

**`src/components/portmasters/game/ObjectivePanel.tsx`** (3)

| English                                                                                   | Chinese                                      |
| ----------------------------------------------------------------------------------------- | -------------------------------------------- |
| Fleet Commission                                                                          | 船队公议                                     |
| The commission is met, and nothing more is owed.                                          | 公议已达成，不必再交。                       |
| The Emperor pays for what you hand over, and the commission is read when the voyage ends. | 皇帝按你交上的货付钱，公议在航程结束时结算。 |

**`src/components/portmasters/game/OpenBoons.tsx`** (5)

| English                                                                                      | Chinese                                                        |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 🧭 Open Boons                                                                                | 🧭 公开机缘                                                    |
| Every compass draw is public: the three cards each captain was shown, and the one they kept. | 每次罗盘抽取都是公开的：每位船长看过哪三张牌，又留下了哪一张。 |
| a moment                                                                                     | 某个时刻                                                       |
| the dawn draw                                                                                | 破晓抽取                                                       |
| (you)                                                                                        | （你）                                                         |

**`src/components/portmasters/game/PlayerDetailModal.tsx`** (21)

| English                                               | Chinese                            |
| ----------------------------------------------------- | ---------------------------------- |
| 💥 Bankrupt, spectating                               | 💥 破产，观战中                    |
| 🏁 Voyage complete                                    | 🏁 航程圆满                        |
| Detailed voyage status                                | 航程状态详情                       |
| Asking the harbor master…                             | 正在询问港务长...                  |
| 📦 Cargo                                              | 📦 货物                            |
| Raw Materials                                         | 原材料                             |
| Finished Goods                                        | 成品                               |
| 👥 Workers                                            | 👥 工匠                            |
| No artisans hired yet.                                | 还没有雇工匠。                     |
| 🔧 Equipped Modules                                   | 🔧 已装模块                        |
| No modules installed.                                 | 还没装模块。                       |
| Recent Log                                            | 最近记录                           |
| Nothing logged yet.                                   | 还没有记录。                       |
| Captain Comparison                                    | 船长对比                           |
| vs                                                    | 对                                 |
| Ship Level                                            | 船只等级                           |
| The Ship's Books                                      | 船只账簿                           |
| Loading…                                              | 加载中...                          |
| Unavailable                                           | 不可用                             |
| Not available right now, they may have stepped away.  | 现在看不了，对方可能走开了一会儿。 |
| Cargo, artisans, equipped modules and the recent log. | 货物、工匠、已装模块和最近记录。   |

**`src/components/portmasters/game/PrivateCard.tsx`** (5)

| English         | Chinese      |
| --------------- | ------------ |
| Your card alone | 只有你可见   |
| Your own goal   | 你自己的目标 |
| Not alone       | 另有同伴     |
| How you win     | 你的取胜之道 |
| Profit so far   | 目前盈利     |

**`src/components/portmasters/game/PrivateOffer.tsx`** (2)

| English          | Chinese        |
| ---------------- | -------------- |
| Gold, offered to | 金币，交给     |
| Fee in Gold      | 以金币计的费用 |

**`src/components/portmasters/game/ReadyBar.tsx`** (2)

| English                                                                      | Chinese                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| This leg ends when the clock does, whether or not every captain has readied. | 计时一停，本航段就结束，不管是不是每位船长都点了就绪。       |
| ${m?.displayName ?? "Captain"} ${isReady ? "ready" : "still deciding"}       | {m?.displayName ?? "船长"} {isReady ? "已就绪" : "仍在考虑"} |

**`src/components/portmasters/game/RefitBench.tsx`** (24)

| English                                                                                                                                                                       | Chinese                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| You have already taken on a refit this leg, and one pair of hands works one garment. The bench opens again next leg.                                                          | 本航段你已经接过一单整补，一双手只做一件衣物。整补台在下一航段重开。                                               |
| Put right                                                                                                                                                                     | 修补                                                                                                               |
| Harbor pile                                                                                                                                                                   | 港湾布堆                                                                                                           |
| Harbor tailors                                                                                                                                                                | 港湾裁缝                                                                                                           |
| have already worked on the crew this leg. Another garment waits for tomorrow.                                                                                                 | 本航段已经替船员修补过了。另一件衣物，得等明天。                                                                   |
| The garment this refit works on                                                                                                                                               | 这份整补所修的衣物                                                                                                 |
| one point                                                                                                                                                                     | 一点                                                                                                               |
| ${MEND_POINTS} points                                                                                                                                                         | {MEND_POINTS}点                                                                                                    |
| Offer this refit to a specific captain                                                                                                                                        | 把这份整补发给指定船长                                                                                             |
| before the Market closes.                                                                                                                                                     | 在开市结束之前。                                                                                                   |
| rag left for you this leg                                                                                                                                                     | 本航段留给你的一块碎布                                                                                             |
| rags left for you this leg                                                                                                                                                    | 本航段留给你的碎布                                                                                                 |
| No rags came ashore this leg. The pile only fills after a cold one.                                                                                                           | 本航段没有碎布上岸。布堆是走过一段寒程才添的。                                                                     |
| The pile is what the fleet's scrap comes to after a cold leg, and it is drawn from the voyage's own weather. ${REWEAVE_RAGS} rags go back on the loom as one ${REWEAVE_GOOD}. | 布堆是船队走完一段寒程后攒下的碎布，取的是本航程自己的天气。{REWEAVE_RAGS}块碎布回到织机，织成一件{REWEAVE_GOOD}。 |
| have nothing to put right. Nobody in the crew is wearing anything.                                                                                                            | 没什么可修补的。船员身上一件衣物都没有。                                                                           |
| have nothing to put right. The crew's clothes are whole.                                                                                                                      | 没什么可修补的。船员身上的衣物都完好。                                                                             |
| Nothing on the bench yet. Your offer is the first.                                                                                                                            | 台上还是空的。你的报价就是头一份。                                                                                 |
| No refit work on offer this leg.                                                                                                                                              | 本航段没有在售的整补活计。                                                                                         |
| Nothing left to put right on your ${row.good}.                                                                                                                                | 你的{row.good}没什么可补的了。                                                                                     |
| ${crest} Take It                                                                                                                                                              | {crest} 接下                                                                                                       |
| ${row.fee} Gold                                                                                                                                                               | {row.fee}金币                                                                                                      |
| You are offering to put a ${row.good} right for ${fee}                                                                                                                        | 你出价修补{row.good}，价钱{fee}                                                                                    |
| You put ${who === "you" ? "your" :                                                                                                                                            | 你把{who === "you" ? "自己" :                                                                                      |
| } ${row.good} right for ${fee}                                                                                                                                                | }的{row.good}修补好了，费用{fee}                                                                                   |

**`src/components/portmasters/game/RevealPanel.tsx`** (19)

| English                                                                                                              | Chinese                                                                          |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 🃏 The Reveal                                                                                                        | 🃏 摊牌                                                                          |
| Every card in this harbor, face up                                                                                   | 港湾里每一张牌，全部亮出                                                         |
| Show them all                                                                                                        | 全部亮出                                                                         |
| Their card promised                                                                                                  | 其牌上承诺的                                                                     |
| No card                                                                                                              | 无牌                                                                             |
| This seat took a berth after the hand was drawn, so the voyage wagered nothing on them and they won nothing from it. | 这个席位是在牌发完之后才上船的，所以本航程没在他身上下过注，他也从中赢不到什么。 |
| Their own goal                                                                                                       | 他自己的目标                                                                     |
| 📜 The Replay Ledger                                                                                                 | 📜 回放账簿                                                                      |
| No leg of this commission was recorded, so there is no curve to draw.                                                | 这次公议没有留下任何航段记录，曲线也就画不出来。                                 |
| What was traded on the record                                                                                        | 账面上成交过什么                                                                 |
| No order fulfillment survived the voyage, which happens when a harbor buys and sells mostly through each other.      | 本航程一笔委托交付都没留下，港湾里若多是船长们彼此买卖，就会这样。               |
| No card dealt                                                                                                        | 没有发牌                                                                         |
| 🚫 Ledger unreadable                                                                                                 | 🚫 账簿读不出来                                                                  |
| ✅ Won the voyage                                                                                                    | ✅ 赢得了本航程                                                                  |
| ❌ Did not win                                                                                                       | ❌ 未能取胜                                                                      |
| Filled                                                                                                               | 已交足                                                                           |
| ${step.delivered} of ${step.required}                                                                                | {step.delivered} / {step.required}                                               |
| The fleet handed over what its captains reported each leg, and the Emperor read the board when the voyage ended.     | 船队每航段交出的，是船长们申报的数量；航程结束时，皇帝照着板上的数字来核。       |
| The fleet handed over nothing it reported.                                                                           | 船队申报了，交出来的却是零。                                                     |

**`src/components/portmasters/game/StandingOrdersModal.tsx`** (14)

| English                                                                                                                                                                                                                                                                                                                     | Chinese                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instructions your seat follows when the room&apos;s clock plays it while you are not standing at it.                                                                                                                                                                                                                        | 你不在席位边上时，港湾的计时替你出牌，你的席位就照着这里写的走。                                                                                                     |
| Three seats are deliberately not here. Parley is a conversation with a captain, which is not something a form can answer. The module draft is rolled fresh every round, so there is no honest way to name one ahead of it. And the Broker&apos;s Favor is a decision rather than a default, so it is left for you to spend. | 这里故意空着三件事。洽谈是你和船长的一番对话，一张表格答不了。模块抽取每轮重新掷，事前写下名字并不诚实。掮客的人情是一次决定，不是默认，留给你自己花。               |
| Kept with this voyage, and the table does not see it.                                                                                                                                                                                                                                                                       | 只随本航程保存，全桌看不到。                                                                                                                                         |
| Dearest you will pay for ${good}                                                                                                                                                                                                                                                                                            | 你为{good}肯出的最高价                                                                                                                                               |
| Follow these orders                                                                                                                                                                                                                                                                                                         | 照这些指示走                                                                                                                                                         |
| When the room's clock runs a phase out and you have not acted, your seat is played by what is written here instead of by the engine's own defaults. Turn this off and every seat goes back to being played the way it was before this panel existed. Nothing written below is lost either way.                              | 港湾的计时把阶段走完，你还没出手，你的席位就照这里写的来，不照引擎自己的默认来。关掉它，所有席位就回到这个面板出现之前的执行方式。开关怎么拨，下面写的东西都不会丢。 |
| Which boon to take when the draft is settled for you. A boon that is not on your board that round is passed over, so a name written here is never a promise the draft cannot keep.                                                                                                                                          | 抽取替你定下时取哪一份机缘。那一轮不在你板上的机缘直接跳过；写在这里的名字，绝不会是抽取兑现不了的承诺。                                                             |
| Each good you mark is bought from the purchase board whenever every good on that card is at or under the price you set, in the order the board is laid out. Anything dearer is left on the board.                                                                                                                           | 你勾中的货，只要同一张牌上的货都不高于你设的价，就按板上的顺序买进。贵过头的留在板上。                                                                               |
| The trade board, filled the way a captain would fill it: only what the hold can actually cover, in the order the orders are laid out, and left alone when the hold cannot cover it. Nothing is bought to complete an order, so one your hold cannot pay for in goods is skipped rather than chased.                         | 委托板照船长自己的做法来交付：只动货舱真拿得出的货，按委托排的先后，货舱拿不出就不碰。不会为了交一份委托去买货；货舱拿不出货来付的那一份，跳过，不去追。             |
| Fill every order the hold can cover                                                                                                                                                                                                                                                                                         | 货舱拿得出的委托，每一份都交付                                                                                                                                       |
| The shipyard's one standing choice: the next ship level, bought the moment the shipyard opens if the purse covers it. The purse and the hull's own ceiling are checked by the engine, so an order to upgrade that cannot be paid for simply does nothing.                                                                   | 船坞唯一的常备选择：升下一级船，船坞一开、钱袋够就买下。钱袋和船体自己的上限由引擎核对，付不起的升级指令就什么也不做。                                               |
| Upgrade the hull when you can afford it                                                                                                                                                                                                                                                                                     | 付得起时升级船体                                                                                                                                                     |
| First offer on the board                                                                                                                                                                                                                                                                                                    | 板上最先摆下的一份                                                                                                                                                   |
| Whatever the draft laid down first, which is what an absent captain is given today.                                                                                                                                                                                                                                         | 抽取最先摆下的那一份，今天缺位的船长拿到的就是这个。                                                                                                                 |

**`src/components/portmasters/game/VoteSeatPicker.tsx`** (2)

| English          | Chinese        |
| ---------------- | -------------- |
| Choose a captain | 选一位船长     |
| Your name is in  | 你的名字已投出 |

**`src/components/portmasters/game/VoteTallyRows.tsx`** (5)

| English                                                                                                                 | Chinese                                                                      |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| The room&apos;s count has not arrived yet. It comes with this leg&apos;s vote.                                          | 港湾的票数还没到，它随本航段的表决一起来。                                   |
| ${leader.name} needs ${ leader.short === 1 ? "1 more name" :                                                            | {leader.name}还需要{ leader.short === 1 ? "1个名字" :                        |
| } to carry it.                                                                                                          | }才能通过。                                                                  |
| Your name is not in yet. Pick a captain and press the button.                                                           | 你的名字还没投。选一位船长，按下按钮。                                       |
| Every captain still sailing has named someone, so nothing more can land this leg. A later leg can call this vote again. | 仍在航的船长都投过了，本航段不会再有票落下来。之后的航段还能再发起这次表决。 |

**`src/components/portmasters/game/VoyageLogPanel.tsx`** (5)

| English                                             | Chinese                        |
| --------------------------------------------------- | ------------------------------ |
| The voyage log                                      | 航程日志                       |
| The harbor&apos;s log                               | 港湾日志                       |
| The harbor has recorded nothing on this voyage yet. | 本航程港湾还没有记下任何东西。 |
| Sent to you alone                                   | 只发给你                       |
| Nothing has been sent to you alone on this voyage.  | 本航程还没有单独发给你的东西。 |

**`src/components/portmasters/game/status/StatGrid.tsx`** (1)

| English | Chinese |
| ------- | ------- |
| Ship    | 船只    |

### The room, second sweep (288)

The room in motion: board drafts, purchase, settlement, the shipyard, bankruptcy and the endgame screens.

**`src/components/portmasters/game/phases/Bankruptcy.tsx`** (17)

| English                                                                                              | Chinese                                                          |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Ship Fleet Bankrupt!                                                                                 | 船队破产！                                                       |
| Rounds Completed:                                                                                    | 已完成轮数：                                                     |
| Final Funds:                                                                                         | 最终资金：                                                       |
| Final Reputation:                                                                                    | 最终声誉：                                                       |
| Ship Level:                                                                                          | 船只等级：                                                       |
| Taxes Paid:                                                                                          | 已缴税款：                                                       |
| 🤝 Silent Partner                                                                                    | 🤝 幕后合伙人                                                    |
| Gold you lent before the wreck is still out there, and it lands the moment each captain repays it.   | 你翻船之前借出去的金币还在外面，哪位船长一还，它当场就到手。     |
| Send repayment to                                                                                    | 还款转给                                                         |
| myself (default)                                                                                     | 我自己（默认）                                                   |
| Spectator Mode: Live Harbor Standings                                                                | 观战模式：港湾实时排名                                           |
| Your voyage has ended, but the rest of the harbor is still sailing. Watch their progress live below. | 你的航程已经结束，港湾的其他人还在海上。在下面实时看他们的进展。 |
| 🔄 Restart Voyage                                                                                    | 🔄 重开航程                                                      |
| ⚓ Sail Again                                                                                        | ⚓ 再次启航                                                      |
| Click any captain in the Harbor Roster to peek at their cargo and workers                            | 点港湾名册里的任意船长，就能瞧一眼他们的货物和工匠。             |
| Funds depleted, unable to pay essential operational costs                                            | 资金见底，付不出必需的营运开销                                   |
| Insufficient funds to cover maintenance and wages                                                    | 资金不足，付不起维护费和工钱                                     |

**`src/components/portmasters/game/phases/BenchCycle.tsx`** (11)

| English                                | Chinese                   |
| -------------------------------------- | ------------------------- |
| ⏱️ Production Cycle: What Happens When | ⏱️ 生产周期：何时发生什么 |
| 💡 Materials consumed                  | 💡 原材料消耗             |
| now                                    | 现在                      |
| , not instantly.                       | ，并非当场。              |
| Draft a boon                           | 抽取机缘                  |
| Assign tasks, consume materials        | 安排上工，消耗原材料      |
| Barter with the harbor                 | 与港湾互通有无            |
| Goods produced, wages paid             | 产出货物，支付工钱        |
| Shipyard and modules                   | 船坞与模块                |
| 📋 Now                                 | 📋 当前                   |
| ${face.icon} ${face.label}             | {face.icon} {face.label}  |

**`src/components/portmasters/game/phases/BenchInventory.tsx`** (3)

| English              | Chinese     |
| -------------------- | ----------- |
| 📦 Current Inventory | 📦 当前库存 |
| Raw Materials:       | 原材料：    |
| Finished Goods:      | 成品：      |

**`src/components/portmasters/game/phases/BenchPayroll.tsx`** (2)

| English            | Chinese         |
| ------------------ | --------------- |
| 💸 Total Wages Due | 💸 应付工钱合计 |
| Wage Efficiency    | 工钱效率        |

**`src/components/portmasters/game/phases/BoonDraft.tsx`** (8)

| English                                          | Chinese                                    |
| ------------------------------------------------ | ------------------------------------------ |
| 🧭 Boon Locked In                                | 🧭 机缘已锁定                              |
| The voyage begins once every captain has chosen. | 每位船长都选好之后，航程就开始。           |
| ↩️ Choose a different Boon                       | ↩️ 换一个机缘                              |
| 🧭 The Navigator's Compass                       | 🧭 航海家的罗盘                            |
| Draft a Boon to synergize with your strategy     | 抽取机缘，配合你的策略                     |
| ✅ Boons Swapped This Round                      | ✅ 本轮已换过机缘                          |
| 🔄 Swap Boons (${BOON_SWAP_COST}💰, 1 use/round) | 🔄 切换机缘（{BOON_SWAP_COST}💰，每轮1次） |
| 🔒 Lock In Boon                                  | 🔒 锁定机缘                                |

**`src/components/portmasters/game/phases/CharterDraft.tsx`** (1)

| English         | Chinese  |
| --------------- | -------- |
| Sail Under This | 以此扬帆 |

**`src/components/portmasters/game/phases/Endgame.tsx`** (4)

| English                                     | Chinese             |
| ------------------------------------------- | ------------------- |
| 🎮 Game Over!                               | 🎮 游戏结束！       |
| Waiting for the host to restart the voyage… | 等待港主重开航程... |
| 💥 Bankrupt: Defaulted on a Loan            | 💥 破产：借款违约   |
| ${r.icon} ${r.label}                        | {r.icon} {r.label}  |

**`src/components/portmasters/game/phases/EndgameCrewSummary.tsx`** (7)

| English                          | Chinese                           |
| -------------------------------- | --------------------------------- |
| Crew Summary                     | 船员汇总                          |
| Total Wages Paid                 | 已付工钱合计                      |
| ⚰️ Lost over the voyage          | ⚰️ 航程中失去的人                 |
| Crew Aboard                      | 在船船员                          |
| Skilled                          | 熟练                              |
| Items Made                       | 制成件数                          |
| ${loss.name} (leg ${loss.round}) | {loss.name}（第{loss.round}航段） |

**`src/components/portmasters/game/phases/EndgameResults.tsx`** (5)

| English                                                                                   | Chinese                                                      |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 🏁 Final Standings                                                                        | 🏁 最终排名                                                  |
| ⏳ Waiting on the rest of the harbor to finish their voyage before Sea Master is crowned… | ⏳ 港湾其余船长的航程还没走完，等他们结束后才加冕沧海之主... |
| Highest Reputation in this harbor&apos;s voyage.                                          | 本港湾航程中声誉最高的人。                                   |
| 🤝 Broker&apos;s Favor Unlocked!                                                          | 🤝 掮客的人情已解锁！                                        |
| · Renown level up!                                                                        | · 声望升级！                                                 |

**`src/components/portmasters/game/phases/EndgameSummaries.tsx`** (14)

| English                                       | Chinese                        |
| --------------------------------------------- | ------------------------------ |
| Financial Summary                             | 财务汇总                       |
| Net Cash Flow                                 | 净现金流                       |
| Peer Economy                                  | 船长间往来                     |
| Helper Reputation earned                      | 助人挣下的声誉                 |
| Loan defaulted, no Renown banked this voyage. | 借款违约，本航程没有入账声望。 |
| Income                                        | 收入                           |
| No income recorded                            | 没有收入记录                   |
| Expenses                                      | 支出                           |
| No expenses recorded                          | 没有支出记录                   |
| Lending                                       | 放款                           |
| Borrowing                                     | 借款                           |
| Boon Gold                                     | 机缘金币                       |
| Purchases & Transport                         | 采购与运输                     |
| Income Tax                                    | 所得税                         |

**`src/components/portmasters/game/phases/Market.tsx`** (1)

| English    | Chinese    |
| ---------- | ---------- |
| Port Board | 港口采购板 |

**`src/components/portmasters/game/phases/MilestoneDraft.tsx`** (1)

| English        | Chinese      |
| -------------- | ------------ |
| Take This Boon | 收下这份机缘 |

**`src/components/portmasters/game/phases/ModuleDraft.tsx`** (9)

| English                                                                                                                                               | Chinese                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 🔧 Module Drafting                                                                                                                                    | 🔧 抽取模块                                                                                    |
| Choose a module to install or swap.                                                                                                                   | 选一个模块安装或切换。                                                                         |
| No module choices are on offer right now. A fresh set is rolled each round.                                                                           | 现在没有可选的模块。每轮都会重新发一批。                                                       |
| Nothing new to deal: every module the yard could offer this hull is either on this table already or aboard. Take one of these, or come back next leg. | 没有新牌可发：船坞能为这艘船开出的模块，不在桌上，就在船上。从这些里挑一个，或者下一航段再来。 |
| ⬅️ Back to Shipyard                                                                                                                                   | ⬅️ 回到船坞                                                                                    |
| ✅ Choices Swapped This Round                                                                                                                         | ✅ 本轮已换过选择                                                                              |
| 🎲 Swap Choices (1 use/round)                                                                                                                         | 🎲 切换选择（每轮1次）                                                                         |
| ✅ Install                                                                                                                                            | ✅ 安装                                                                                        |
| 🔄 Swap                                                                                                                                               | 🔄 切换                                                                                        |

**`src/components/portmasters/game/phases/ModuleSwap.tsx`** (3)

| English                     | Chinese             |
| --------------------------- | ------------------- |
| 🔄 Select Module to Replace | 🔄 选择要切换的模块 |
| 🗑️ Replace                  | 🗑️ 切换             |
| ⬅️ Back to Draft            | ⬅️ 回到抽取         |

**`src/components/portmasters/game/phases/ModuleSynergy.tsx`** (4)

| English                                                    | Chinese                            |
| ---------------------------------------------------------- | ---------------------------------- |
| Module Synergy Analysis                                    | 模块组合分析                       |
| Active Bonuses                                             | 生效加成                           |
| Module Interactions                                        | 模块联动                           |
| No special interactions detected between equipped modules. | 已装的模块之间，看不出有特别联动。 |

**`src/components/portmasters/game/phases/OrderPlanner.tsx`** (2)

| English             | Chinese          |
| ------------------- | ---------------- |
| Fulfillment Plan    | 交付计划         |
| if all ready filled | 若备齐的全部交付 |

**`src/components/portmasters/game/phases/Orders.tsx`** (3)

| English                        | Chinese                  |
| ------------------------------ | ------------------------ |
| Trade Manifest                 | 贸易舱单                 |
| (look for the 🔮 badge below). | （留意下面 🔮 的标记）。 |
| ✅ Complete Trades, Continue   | ✅ 完成贸易，继续        |

**`src/components/portmasters/game/phases/OrdersBoard.tsx`** (9)

| English                                                                                | Chinese                                                     |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 📜 Imperial Mandate                                                                    | 📜 皇命采办                                                 |
| 🤝 Broker&apos;s Favor                                                                 | 🤝 掮客的人情                                               |
| 🔮 Guaranteed                                                                          | 🔮 保底                                                     |
| Profit margin: ${margin}% of reward is net profit after transport, VAT, and commission | 利润率：报酬的{margin}%是扣掉运费、市舶税和掮客抽成后的净利 |
| · Imperial Commission                                                                  | · 皇命采办                                                  |
| · Finished Product Demand                                                              | · 求购成品                                                  |
| · Raw Material Demand                                                                  | · 求购原材料                                                |
| ✅ Completed                                                                           | ✅ 已交付                                                   |
| 🎭 Borrow this order                                                                   | 🎭 借用这份委托                                             |

**`src/components/portmasters/game/phases/OrdersFavor.tsx`** (10)

| English                                                                                                                                                | Chinese                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Broker&apos;s Favor                                                                                                                                    | 掮客的人情                                                                                       |
| (once per voyage): summon a guaranteed buyer for as much of a good as you choose from your hold. The bigger the ask, the bigger the Broker&apos;s cut. | （每程一次）：从你的货舱里挑一件货，要多少都行，替你把买主叫来。要得越多，掮客抽得越多。         |
| Call in a Favor                                                                                                                                        | 动用一次人情                                                                                     |
| 🤝 Which good needs a buyer?                                                                                                                           | 🤝 哪件货要找买主？                                                                              |
| Your hold is empty, so there is nothing for the Broker to sell right now.                                                                              | 你的货舱是空的，掮客现在没东西可出手。                                                           |
| Your hold changed while this was open, so there is nothing here for the Broker to sell now. Pick another good, or call the Favor in later this voyage. | 这块面板还开着，你的货舱却变了，掮客现在没货可出手。换一件货，或者本航程晚些时候再动用这条人情。 |
| Pick another good                                                                                                                                      | 换一件货                                                                                         |
| A bigger ask pays out more, but the Broker&apos;s cut grows with it too, so a single favor can never swing the whole voyage.                           | 要得越多进账越多，但掮客的抽成也跟着涨，所以一次人情翻不了整条航程的盘。                         |
| Call in the Favor                                                                                                                                      | 动用这条人情                                                                                     |
| How much ${favorItem} to sell                                                                                                                          | 要卖多少 {favorItem}                                                                             |

**`src/components/portmasters/game/phases/Parley.tsx`** (13)

| English                                               | Chinese                                    |
| ----------------------------------------------------- | ------------------------------------------ |
| 📋 Open Offers                                        | 📋 挂出的报价                              |
| No offers on the board yet. Be the first.             | 板上还没有报价。做第一个。                 |
| 📤 Post an Offer                                      | 📤 挂出报价                                |
| With                                                  | 给                                         |
| Harbor Business                                       | 港湾公事                                   |
| Exchange                                              | 行市                                       |
| Markets                                               | 集市                                       |
| ${label} is open.                                     | {label}已开。                              |
| The audit vote                                        | 舱单稽查投票                               |
| The maroon vote                                       | 放逐投票                                   |
| No vote is open. The fleet's picks are on the record. | 眼下没有开着的投票。船队的取舍都记在案上。 |
| No vote is open yet.                                  | 投票还没开始。                             |
| ✅ Done Bartering, Continue                           | ✅ 易货完毕，继续                          |

**`src/components/portmasters/game/phases/PathDraft.tsx`** (11)

| English                                                                                                                                                                                                                             | Chinese                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| The cards are being cut. If a hand was dealt to you, it lands here.                                                                                                                                                                 | 牌正在切。发到你手上的牌，会落在这里。                                                                                                           |
| 🃏 The Path Draft                                                                                                                                                                                                                   | 🃏 择道                                                                                                                                          |
| Three cards each, dealt face down. What you hold at the end is the path you sail this voyage, and the deal comes first because every stop after it reads your path: your hold, your Renown ceiling and the orders that lock to you. | 每人三张，扣着发。最后留在你手里的，就是你本航程走的商道；发牌排在最前，因为之后每一站都要读你的商道：你的货舱、你的声望上限，还有锁给你的委托。 |
| Your three cards. Keep one, and the other two pass to the left.                                                                                                                                                                     | 你的三张牌。留一张，另外两张传给左边。                                                                                                           |
| Keep This One                                                                                                                                                                                                                       | 留这一张                                                                                                                                         |
| Two cards arrived from your right. Keep one, and the other goes face down.                                                                                                                                                          | 右边传过来两张。留一张，另一张扣下。                                                                                                             |
| Your two papers. Keep the one you sail on, and the other goes over the side.                                                                                                                                                        | 你的两份文书。留下你要走的这一份，另一份丢下海。                                                                                                 |
| Sail As This One                                                                                                                                                                                                                    | 就走这一条                                                                                                                                       |
| The table is in. The step closes now.                                                                                                                                                                                               | 全桌都交齐了。这一步到此收尾。                                                                                                                   |
| Waiting on ${view.open} more.                                                                                                                                                                                                       | 还差{view.open}位。                                                                                                                              |
| Cards still out: ${view.open}                                                                                                                                                                                                       | 还在外头的牌：{view.open}                                                                                                                        |

**`src/components/portmasters/game/phases/PhasePanels.tsx`** (3)

| English                                      | Chinese                    |
| -------------------------------------------- | -------------------------- |
| 🗣️ Broker&apos;s Whispers active this round: | 🗣️ 本轮生效的掮客低语：    |
| Just for you                                 | 只给你看                   |
| Just for ${name ?? "a captain"}              | 只给{name ?? "某位船长"}看 |

**`src/components/portmasters/game/phases/PhaseShared.tsx`** (3)

| English                          | Chinese      |
| -------------------------------- | ------------ |
| Dismiss error                    | 关闭错误提示 |
| Waiting for the rest of the crew | 等待其余船员 |
| Not ready yet                    | 暂不就绪     |

**`src/components/portmasters/game/phases/PirateAttack.tsx`** (9)

| English                                                                                                                                                                                                                   | Chinese                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pirate Waters Ahead                                                                                                                                                                                                       | 前方海盗水域                                                                                                                                     |
| 🕵️ A corrupt broker leaked your position this round, so the odds above are already raised.                                                                                                                                | 🕵️ 本轮有通匪掮客把你的位置透了出去，上面的概率已经跟着抬高。                                                                                    |
| Risk Assessment                                                                                                                                                                                                           | 风险评估                                                                                                                                         |
| Raid Chance                                                                                                                                                                                                               | 劫掠概率                                                                                                                                         |
| Gold at Risk                                                                                                                                                                                                              | 风险金额                                                                                                                                         |
| Expected Loss                                                                                                                                                                                                             | 预期损失                                                                                                                                         |
| Before this round's bills come due, your ship has to clear open water. Pirates that find you this round meet a shield you already paid for, so there is nothing here left to buy and nothing in your hold that is theirs. | 在本轮账单到期之前，你的船得先过一段开阔水面。本轮找上你的海盗，撞上的是你早已付过钱的那面盾，所以这里没剩什么可买，海盗也拿不走你货舱里的东西。 |
| Sail On                                                                                                                                                                                                                   | 继续航行                                                                                                                                         |
| Set Sail Anyway                                                                                                                                                                                                           | 照样启航                                                                                                                                         |

**`src/components/portmasters/game/phases/Purchase.tsx`** (8)

| English                                                                                  | Chinese                                                              |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Port Merchant Exchange                                                                   | 港口商行                                                             |
| 🔮 Broker's Rumor Board                                                                  | 🔮 掮客传闻板                                                        |
| ✅ Board Done, to the Artisan Bench                                                      | ✅ 板看完了，去匠作台                                                |
| Market Readings                                                                          | 集市行情                                                             |
| Refit Bench                                                                              | 整补台                                                               |
| (a matching order is guaranteed at Orders, buy accordingly).                             | （委托阶段保证有对得上的委托，可照此采购）。                         |
| What the board is worth: usual prices, the best of the six, and how deep each good runs. | 这块板值多少：平日的价钱、六张里最划算的那张，还有每件货的货源厚薄。 |
| A Loom captain's work: a garment put right in one leg, at a fee the two of you agree.    | 织造船长的手艺：一个航段内把一件衣物整好，价钱由你们两人商定。       |

**`src/components/portmasters/game/phases/PurchaseBoard.tsx`** (5)

| English      | Chinese |
| ------------ | ------- |
| Product      | 成品    |
| Raw Material | 原材料  |
| ✅ Purchased | ✅ 已购 |
| Deal         | 划算    |
| Pricey       | 偏贵    |

**`src/components/portmasters/game/phases/PurchaseInsights.tsx`** (12)

| English                                                                                    | Chinese                                                    |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Best Deals This Round                                                                      | 本轮最划算                                                 |
| g                                                                                          | 金币                                                       |
| Intel                                                                                      | 情报                                                       |
| Harbor Pulse                                                                               | 港湾行情                                                   |
| Pricier                                                                                    | 涨价                                                       |
| Softer                                                                                     | 降价                                                       |
| Market Depth                                                                               | 货源厚薄                                                   |
| Matches a Broker's Whisper, guaranteed order at Orders                                     | 与一条掮客低语对得上，委托阶段必有对应的委托               |
| ${good} is about ${Math.round(v * 100)} percent above its usual price this round           | {good}本轮比平日价钱高出约{Math.round(v * 100)}%           |
| ${good} is about ${Math.round(Math.abs(v) * 100)} percent below its usual price this round | {good}本轮比平日价钱低了约{Math.round(Math.abs(v) * 100)}% |
| ${count} card${count === 1 ? "" : "s"} offering ${good} this round                         | 本轮有{count}张牌在出{good}                                |
| already priced into this board                                                             | 已经算进这块板里                                           |

**`src/components/portmasters/game/phases/PurchasePriceReference.tsx`** (4)

| English                                           | Chinese                                      |
| ------------------------------------------------- | -------------------------------------------- |
| ━━ MARKET PRICE REFERENCE (hover for details) ━━  | ━━ 集市价钱参考（悬停看详情） ━━             |
| Price History Heatmap                             | 历史价钱热力图                               |
| Good                                              | 货品                                         |
| R${i + 1}: ${price} Gold (range ${min} to ${max}) | 第{i + 1}轮：{price}金币（区间{min}到{max}） |

**`src/components/portmasters/game/phases/PurchaseProvisions.tsx`** (13)

| English                                                                                    | Chinese                                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Provisions                                                                                 | 口粮                                                   |
| one ration a head, eaten at each Dawn                                                      | 每人一份口粮，破晓时吃掉                               |
| No crew aboard, so there is nobody to feed. Hire artisans and the larder starts to matter. | 船上没有船员，也就没人要喂。雇了工匠，粮舱才开始要紧。 |
| The larder is full, so there is nothing more to buy here.                                  | 粮舱满了，这里没什么可再买的。                         |
| Not enough Gold for a leg of rations.                                                      | 金币不够买一个航段的口粮。                             |
| Crew                                                                                       | 船员                                                   |
| ${density}, keeps forever                                                                  | {density}，永久保存                                    |
| ${density}, keeps ${spec.keeps} legs                                                       | {density}，可放{spec.keeps}个航段                      |
| ${density}, turns at this Dusk                                                             | {density}，到本暮色就变质                              |
| The three foods the crew eats, and a batch of Produce ready to preserve.                   | 船员吃的三样口粮，另有一批时鲜可以腌制。               |
| The three foods the crew eats, and what each keeps.                                        | 船员吃的三样口粮，各能存多久。                         |
| The barge has nothing left for you this leg.                                               | 补给驳船这一航段没剩什么给你了。                       |
| The barge has nothing left for you this leg, and it is a fresh lot tomorrow.               | 补给驳船这一航段没剩什么给你了，明天会来一批新的。     |

**`src/components/portmasters/game/phases/SettlementAid.tsx`** (6)

| English                                | Chinese              |
| -------------------------------------- | -------------------- |
| Short on Gold? Ask the Harbor for Help | 金币不够？向港湾求助 |
| Request                                | 申请                 |
| Gold from another captain              | 金币，向别的船长借   |
| 🆘 Request Help                        | 🆘 求助              |
| 🆘 Captains Asking for Help            | 🆘 正在求助的船长    |
| Loan amount to request                 | 申请借款的数额       |

**`src/components/portmasters/game/phases/SettlementBacking.tsx`** (6)

| English                                                                                                                                   | Chinese                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 🛡️ Loans You Could Back                                                                                                                   | 🛡️ 你可以作保的借款                                                                                  |
| lent                                                                                                                                      | 借给                                                                                                 |
| Pledged Gold is                                                                                                                           | 作保的金币                                                                                           |
| escrowed                                                                                                                                  | 现已托管                                                                                             |
| now, only spent if the loan actually defaults, up to what you pledged. Never called on? It all comes back, plus a small Reputation bonus. | ，只有借款真的违约才会动用，最多到你作保的数目。要是一次都没动用？全数退回，还多一份小小的声誉加成。 |
| Gold to pledge backing ${l.lenderName}'s loan to ${l.borrowerName}                                                                        | 为{l.lenderName}借给{l.borrowerName}的这笔借款作保的金币数                                           |

**`src/components/portmasters/game/phases/SettlementBills.tsx`** (11)

| English                                                  | Chinese                     |
| -------------------------------------------------------- | --------------------------- |
| 💸 Resolve: Round Settlement                             | 💸 结算：本轮清账           |
| ⏳ Bills Due This Round                                  | ⏳ 本轮应付账单             |
| 💹 Balance Summary                                       | 💹 账目汇总                 |
| 🔧 Ship Maintenance Fee                                  | 🔧 船只维护费               |
| 💸 Total Due                                             | 💸 应付合计                 |
| Current Funds                                            | 当前资金                    |
| After Settlement                                         | 结算之后                    |
| Round Revenue                                            | 本轮进账                    |
| 🛡️ Escort hired, you sailed through safely this round.   | 🛡️ 雇了护航，本轮平安驶过。 |
| 🌊 You sailed without an escort this round.              | 🌊 本轮没有雇护航就出海了。 |
| ${b.sponsored} ${b.sponsored === 1 ? b.label : b.plural} | {b.sponsored} {b.label}     |

**`src/components/portmasters/game/phases/Shipyard.tsx`** (8)

| English                                             | Chinese                              |
| --------------------------------------------------- | ------------------------------------ |
| 🚢 Shipyard & Module Rigging                        | 🚢 船坞与模块装配                    |
| No modules installed. Upgrade ship to unlock slots! | 还没装模块。升级船只就能解锁模块位！ |
| ⏭️ Continue Voyage                                  | ⏭️ 继续航程                          |
| Modules Aboard                                      | 船上模块                             |
| ⏳ Waiting for the rest of the crew…                | ⏳ 等待其余船员...                   |
| ↩️ Not ready yet                                    | ↩️ 暂不就绪                          |
| 🔄 Draft & Swap Module (Slots Full)                 | 🔄 抽取并切换模块（模块位已满）      |
| 🔧 Draft & Install Module                           | 🔧 抽取并安装模块                    |

**`src/components/portmasters/game/phases/WardrobePanel.tsx`** (9)

| English                                                                                                                                                           | Chinese                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 🧥 Wardrobe                                                                                                                                                       | 🧥 衣箱                                                                                            |
| The sea is mild this leg and asks for no warmth. The clothes wait in the hold for a cold leg, because a garment wears from the day it goes on.                    | 这一航段海上温和，用不着御寒。衣物留在货舱里等寒程，因为衣裳从穿上的那天起就开始磨损。             |
| No crew aboard, so there is nobody to wear them. Hire artisans and the cold starts to matter.                                                                     | 船上没有船员，也就没人穿。雇了工匠，寒冷才开始要紧。                                               |
| The hold carries no clothes. Linen Clothes, Cotton Clothes and Brocade are made right here at the bench, and the ones the crew wears are the ones it cannot sell. | 货舱里没有衣物。麻衣、布衣和绫罗绸缎就在这里的匠作台上做出来，船员穿戴的那些，就是卖不出去的那些。 |
| This leg                                                                                                                                                          | 本航段                                                                                             |
| a garment worn stays on until it wears out                                                                                                                        | 衣物上了身，就得一直穿到磨坏                                                                       |
| ❄️ Cold                                                                                                                                                           | ❄️ 寒冷                                                                                            |
| ⚠️ The crew is short of warm clothes. The cold takes the newest hand, who is out of action for the next leg.                                                      | ⚠️ 船员御寒衣物不够。寒冷会冻倒最新来的那个伙计，下一航段上不了工。                                |
| The crew is dressed for the cold this leg. The rest stay in the hold until a leg asks for more.                                                                   | 这一航段船员穿够了御寒衣物。其余的留在货舱，等哪一航段要得更多再拿出来。                           |

**`src/components/portmasters/game/phases/WorkerList.tsx`** (2)

| English                  | Chinese           |
| ------------------------ | ----------------- |
| 👥 Worker Status & Tasks | 👥 工匠状态与任务 |
| ${ICONS[m]}${m}×${a}     | {ICONS[m]}{m}×{a} |

**`src/components/portmasters/game/phases/WorkerMgmt.tsx`** (5)

| English                      | Chinese           |
| ---------------------------- | ----------------- |
| 👥 Artisan Bench             | 👥 匠作台         |
| 🔨 Hire Workers              | 🔨 雇佣工匠       |
| ${a} ${m}                    | {a} {m}           |
| ${t}(${mats})                | {t}（{mats}）     |
| ✅ Complete Market, Continue | ✅ 集市结束，继续 |

**`src/components/portmasters/game/status/CargoHold.tsx`** (9)

| English                                                                                                                                         | Chinese                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Hold Value                                                                                                                                      | 货舱价值                                                                                                        |
| ━━ Raw Materials ━━                                                                                                                             | ━━ 原材料 ━━                                                                                                    |
| ━━ Finished Goods ━━                                                                                                                            | ━━ 成品 ━━                                                                                                      |
| Nothing in the hold yet.                                                                                                                        | 货舱里还什么都没有。                                                                                            |
| ━━ Artisans ━━                                                                                                                                  | ━━ 工匠 ━━                                                                                                      |
| Cargo Composition                                                                                                                               | 货物构成                                                                                                        |
| Raw Materials: ${rawCount} (${rawPct}%)                                                                                                         | 原材料：{rawCount}（{rawPct}%）                                                                                 |
| Finished Goods: ${productCount} (${productPct}%)                                                                                                | 成品：{productCount}（{productPct}%）                                                                           |
| ${skilled} of ${count} trained: each produces 2 per round, working at ${Math.round(SHORT_RATIONS_YIELD * 100)}% pace while the crew goes hungry | {count}人中有{skilled}人熟练：每人每轮产出2件，船员挨饿时干活的速度只有{Math.round(SHORT_RATIONS_YIELD * 100)}% |

**`src/components/portmasters/game/status/ConvoyVentures.tsx`** (12)

| English                                                                                                                                  | Chinese                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ━━ Ventures ━━                                                                                                                           | ━━ 合股 ━━                                                                     |
| Too late in this voyage to post a new Venture: there is no round left that would leave time to spend the reward.                         | 本航程已太晚，发不了新的合股：剩下的轮数，不够把回报花出去。                   |
| Target Gold                                                                                                                              | 目标金额                                                                       |
| Rounds to fill                                                                                                                           | 凑满轮数                                                                       |
| Post                                                                                                                                     | 发布                                                                           |
| Miss the deadline and every contributor only gets back a partial refund. This harbor only gets one venture per voyage, so make it count. | 过了期限，每位出资人只能拿回一部分退款。每座港湾每程只有一次合股，想清楚再用。 |
| You have backed this as much as any single captain can. It needs another captain to fund the rest.                                       | 你已按单人上限跟投了这一笔。剩下的要另一位船长来凑。                           |
| Back it                                                                                                                                  | 跟投                                                                           |
| ${CONVOY_VENTURE_MIN_TARGET}+                                                                                                            | {CONVOY_VENTURE_MIN_TARGET}+                                                   |
| No ventures open. This voyage's one chance has already been used.                                                                        | 眼下没有在筹的合股。本航程唯一的一次机会已经用掉。                             |
| No ventures open right now. Post one, or wait for another captain to.                                                                    | 眼下没有在筹的合股。你可以发一个，或者等别的船长发。                           |
| Your venture                                                                                                                             | 你的合股                                                                       |

**`src/components/portmasters/game/status/DuesTab.tsx`** (10)

| English                                        | Chinese                           |
| ---------------------------------------------- | --------------------------------- |
| 🔧 Maintenance                                 | 🔧 维护费                         |
| ✅ Funds sufficient for round end              | ✅ 资金够撑到本轮结束             |
| 🚨 Risk: Funds may fall short at round end!    | 🚨 风险：本轮结束时资金可能不够！ |
| Nothing is owed until the voyage is under way. | 航程开始之前，什么都不欠。        |
| ━━ Outstanding Loans ━━                        | ━━ 未清的借款 ━━                  |
| You owe                                        | 你欠                              |
| Repay                                          | 还款                              |
| Owed by                                        | 欠你的                            |
| ↳ ${r.list.length}× ${r.label}                 | ↳ {r.list.length}× {r.label}      |
| ${r.due} Gold                                  | {r.due}金币                       |

**`src/components/portmasters/game/status/PathChip.tsx`** (5)

| English                                                                                | Chinese                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Your papers                                                                            | 你的文书                                                                 |
| Your path is ${card.name}. Change your papers.                                         | 你的商道是{card.name}。切换你的文书。                                    |
| No path yet. The deal is open: keep one of the cards dealt to you.                     | 还没有商道。牌局开着：从发给你的牌里留一张。                             |
| No path yet. A path is dealt when the voyage sails.                                    | 还没有商道。航程出海时会发商道。                                         |
| No path yet. The deal ran before you came aboard, so you sail this voyage without one. | 还没有商道。发牌在你上船之前就结束了，所以本航程你就这样出海，没有商道。 |

**`src/components/portmasters/game/status/ShipTab.tsx`** (5)

| English                                                                 | Chinese                                    |
| ----------------------------------------------------------------------- | ------------------------------------------ |
| Class                                                                   | 船只等级                                   |
| No modules installed. Upgrade the ship in the Shipyard to unlock slots. | 还没装模块。到船坞升级船只就能解锁模块位。 |
| Modules                                                                 | 模块                                       |
| module slot                                                             | 个模块位                                   |
| module slots                                                            | 个模块位                                   |

**`src/components/portmasters/game/status/StatGrid.tsx`** (5)

| English   | Chinese  |
| --------- | -------- |
| Funds     | 资金     |
| Due       | 应付     |
| ${money}  | {money}  |
| ${score}  | {score}  |
| ${larder} | {larder} |

### The lobby and the profile (232)

The lobby, the roster, the profile, the settings and the chat.

**`src/components/portmasters/ActionSuggester.tsx`** (19)

| English                                                                                                                                                                                                | Chinese                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Suggest                                                                                                                                                                                                | 建议                                                                                                                                           |
| Got it                                                                                                                                                                                                 | 知道了                                                                                                                                         |
| Show the recommended action for this phase                                                                                                                                                             | 看看本阶段推荐怎么做                                                                                                                           |
| Show action suggestion                                                                                                                                                                                 | 查看行动建议                                                                                                                                   |
| Close suggestion                                                                                                                                                                                       | 关闭建议                                                                                                                                       |
| Consider ${first.name}                                                                                                                                                                                 | 可考虑{first.name}                                                                                                                             |
| 👩‍🔧                                                                                                                                                                                                     | 👩‍🔧                                                                                                                                             |
| Only one round remains. Hiring now wastes Gold on wages with no production return. Focus on filling orders with what you already have.                                                                 | 只剩最后一轮。这会儿雇工，工钱照付，产出却回不了本。手上的货，先拿去交付委托吧。                                                               |
| Assign task: ${product}                                                                                                                                                                                | 安排上工：{product}                                                                                                                            |
| Your ${type} is idle and you have the materials to make ${product}. Assign the task now so production lands at this round's Resolve. Materials: ${Object.entries( recipe.materials, ) .map(([m, q]) => | 你的{type}闲着，原材料也够，能做{product}。现在就安排上工，本轮结算时产出就到手。原材料：{Object.entries( recipe.materials, ) .map(([m, q]) => |
| Buy materials for ${product}                                                                                                                                                                           | 为{product}采购原材料                                                                                                                          |
| Your ${type} is idle but you lack materials for ${product}. You need: ${Object.entries( recipe.materials, ) .map(([m, q]) =>                                                                           | 你的{type}闲着，做{product}的原材料却不够。还缺：{Object.entries( recipe.materials, ) .map(([m, q]) =>                                         |
| ) .join(", ")}. Buy these next round.                                                                                                                                                                  | ) .join(", ")}。下一轮再买这些。                                                                                                               |
| Your hold carries no goods to trade this Parley. Post a Gold offer for the good you still need, or ready up so the fleet can move on.                                                                  | 这轮洽谈，你货舱里没有能出手的货。可以为你还缺的货挂一份金币报价，或者直接点就绪，让船队接着走。                                               |
| You are holding ${count} ${top}. Post what your voyage can spare and name the good you are still short of, then ready up once the table is done with you.                                              | 你手上有{count}件{top}。这程能匀出多少就挂多少，写明你还缺哪件货，等桌上的人跟你谈完，再点就绪。                                               |
| Almost ready for order #${close.id}                                                                                                                                                                    | 委托#{close.id}就快备齐了                                                                                                                      |
| You are only missing ${missing?.type} (have ${game.inventory[missing?.type ?? ""] \|\| 0}, need ${missing?.required}). Try bartering for it, or wait to buy it next round.                             | 你只缺{missing?.type}（现有{game.inventory[missing?.type ?? ""] \|\| 0}，需要{missing?.required}）。可以和船长易货，或者等下一轮再买。         |
| Upgrade to Ship Level 1                                                                                                                                                                                | 升级船只到1级                                                                                                                                  |
| Ship upgrade costs ${cost} Gold but you only have ${game.money}. Save the Gold for the Resolve bills and continue the voyage.                                                                          | 船只升级要{cost}金币，你手上只有{game.money}。金币留着结算付账，航程先接着走。                                                                 |

**`src/components/portmasters/AdminConsole.tsx`** (2)

| English  | Chinese  |
| -------- | -------- |
| Sign out | 退出登录 |
| Online   | 在线     |

**`src/components/portmasters/AgeBanner.tsx`** (9)

| English                                                                                                                                                                                                                                                                                                                                      | Chinese                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The harbor leans this way for a fortnight                                                                                                                                                                                                                                                                                                    | 这半个月，港湾都偏向这边。                                                                                                                                                                                 |
| Every captain in every harbor shares the same Age at the same moment. The rotation cycles through the Lender, the Trader, and the Broker every two weeks, then repeats. An Age only shifts the weight of one already legal action, never the rules, which keeps a voyage that began under one Age from unbalancing when the next takes over. | 每个港湾、每位船长，同一时刻，同一个时代。时代每两周换一轮：放贷人、商人、掮客，换完从头再来。时代只调一调某个本就允许的动作的分量，规则一个字不改；一段时代里开的航程，不会因为下一段时代接手就失了平衡。 |
| ${age.name}. ${age.description}                                                                                                                                                                                                                                                                                                              | {age.name}。{age.description}                                                                                                                                                                              |
| Current age: ${age.name}. Click for details.                                                                                                                                                                                                                                                                                                 | 当前时代：{age.name}。点击查看详情。                                                                                                                                                                       |
| Close age details                                                                                                                                                                                                                                                                                                                            | 关闭时代详情                                                                                                                                                                                               |
| handing over now                                                                                                                                                                                                                                                                                                                             | 正在交接                                                                                                                                                                                                   |
| under an hour remaining                                                                                                                                                                                                                                                                                                                      | 还剩不到一小时                                                                                                                                                                                             |
| ${hours} ${hours === 1 ? "hour" : "hours"} remaining                                                                                                                                                                                                                                                                                         | 还剩{hours}小时                                                                                                                                                                                            |
| ${Math.round(ms / 86_400_000)} days remaining                                                                                                                                                                                                                                                                                                | 还剩{Math.round(ms / 86_400_000)}天                                                                                                                                                                        |

**`src/components/portmasters/AuthScreen.tsx`** (6)

| English                                                                                                 | Chinese                                                            |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Maritime trade on the ancient Silk Road                                                                 | 古丝路上，海上通商                                                 |
| Open this page in another browser to register a second captain and see them appear online in real time. | 在另一个浏览器里打开这一页，再注册一位船长，就能实时看到对方上线。 |
| shown to other sailors                                                                                  | 其他船员可见                                                       |
| for example, Captain Mei                                                                                | 例如：梅船长                                                       |
| Set Sail                                                                                                | 起航                                                               |
| Hoist the Colors                                                                                        | 扬旗                                                               |

**`src/components/portmasters/CaptainLegacyCard.tsx`** (4)

| English                    | Chinese             |
| -------------------------- | ------------------- |
| Not yet earned             | 尚未获得            |
| Best Rep.                  | 最佳声誉            |
| Head to head with          | 与                  |
| 🤝 Broker's Favor unlocked | 🤝 掮客的人情已解锁 |

**`src/components/portmasters/CaptainProfileModal.tsx`** (4)

| English       | Chinese  |
| ------------- | -------- |
| Close profile | 关闭资料 |
| Statistics    | 统计     |
| Chronicles    | 航程实录 |
| Rivals        | 对手     |

**`src/components/portmasters/CredentialCard.tsx`** (5)

| English               | Chinese      |
| --------------------- | ------------ |
| Sign In               | 登录         |
| Register              | 注册         |
| your captain name     | 你的船长名   |
| choose a captain name | 取一个船长名 |
| Something went wrong  | 出了点问题   |

**`src/components/portmasters/DifficultyAdvisor.tsx`** (7)

| English                                                                                                                                | Chinese                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| x                                                                                                                                      | x                                                                                |
| Dismiss advice                                                                                                                         | 忽略建议                                                                         |
| ${rounds.slice(0, -1).join(", ")}, and ${rounds[rounds.length - 1]}                                                                    | {rounds.slice(0, -1).join("、")}和{rounds[rounds.length - 1]}                    |
| Monsoon Season is very tough for a new captain. Consider Open Waters or Fair Winds until you reach Renown Level ${OPEN_WATERS_RENOWN}. | 季风时节，新船长很难熬。声望等级到{OPEN_WATERS_RENOWN}之前，先跑开阔水域或顺风。 |
| Open Waters introduces mandates and charter goods. Try a few Fair Winds voyages first to learn the core loop.                          | 开阔水域才有皇命采办和特许货物。先跑几程顺风，把基本玩法摸熟。                   |
| Heads up                                                                                                                               | 注意                                                                             |
| Consider ${advice.recommended.replace(/_/g, " ")}                                                                                      | 可考虑{advice.recommended.replace(/_/g, " ")}                                    |

**`src/components/portmasters/FleetTicker.tsx`** (3)

| English                            | Chinese      |
| ---------------------------------- | ------------ |
| Put ashore by a vote of the harbor | 港湾投票放逐 |
| You                                | 你           |
| loading…                           | 加载中...    |

**`src/components/portmasters/HouseLeaderboard.tsx`** (5)

| English                     | Chinese                      |
| --------------------------- | ---------------------------- |
| Across all pledged captains | 已加入世家的船长，全部计入。 |
| Yours                       | 你的                         |
| Total Crowns                | 沧海之冠总数                 |
| Total Voyages               | 航程总数                     |
| Top Score                   | 最高积分                     |

**`src/components/portmasters/LeaderboardModal.tsx`** (6)

| English                                  | Chinese                |
| ---------------------------------------- | ---------------------- |
| Top captains across all voyages          | 所有航程中的顶尖船长   |
| No captains have completed a voyage yet. | 还没有船长完成过航程。 |
| Set sail to be the first on the board.   | 起航，做榜上的第一个。 |
| Close leaderboard                        | 关闭排行榜             |
| Crowns                                   | 沧海之冠               |
| Best Rep                                 | 最佳声誉               |

**`src/components/portmasters/Lobby.tsx`** (59)

| English                                                                                                                                                                                                            | Chinese                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Harbor Leaderboard                                                                                                                                                                                                 | 港湾排行榜                                                                                                                               |
| Houses                                                                                                                                                                                                             | 世家                                                                                                                                     |
| Check In                                                                                                                                                                                                           | 签到                                                                                                                                     |
| Your Renown                                                                                                                                                                                                        | 你的声望                                                                                                                                 |
| Quick Start                                                                                                                                                                                                        | 快速开局                                                                                                                                 |
| Match instantly with the next captain who hits Quick Start.                                                                                                                                                        | 下一位点快速开局的船长，立刻和你配对。                                                                                                   |
| Waiting                                                                                                                                                                                                            | 等待中                                                                                                                                   |
| Open Harbors                                                                                                                                                                                                       | 开放港湾                                                                                                                                 |
| Chart a new harbor                                                                                                                                                                                                 | 开一个新港湾                                                                                                                             |
| Every harbor the fleet has open right now.                                                                                                                                                                         | 船队此刻开放的所有港湾。                                                                                                                 |
| Guide                                                                                                                                                                                                              | 指南                                                                                                                                     |
| Join by code                                                                                                                                                                                                       | 用港湾口令加入                                                                                                                           |
| Join                                                                                                                                                                                                               | 加入                                                                                                                                     |
| Name a room, pick its waters, and open it to the fleet.                                                                                                                                                            | 给港湾起个名字，选好水域，向船队开放。                                                                                                   |
| Room name                                                                                                                                                                                                          | 港湾名                                                                                                                                   |
| Create                                                                                                                                                                                                             | 创建                                                                                                                                     |
| Unlock phrase                                                                                                                                                                                                      | 解锁暗语                                                                                                                                 |
| A captain&apos;s tenth completed voyage hands them this phrase, and the guide keeps a copy for whoever goes looking. Anyone who has it can open the table, and every seat at that table sails the voyage it opens. | 船长完成第十次航程，就能拿到这句暗语；指南也为上门来查的人留了一份。暗语在手，谁都能开这张桌子；坐上桌的每个席位，都驶进它开的那次航程。 |
| Voyage Chronicles                                                                                                                                                                                                  | 航程实录                                                                                                                                 |
| Great Houses                                                                                                                                                                                                       | 世家                                                                                                                                     |
| Open harbor leaderboard                                                                                                                                                                                            | 打开港湾排行榜                                                                                                                           |
| Settings                                                                                                                                                                                                           | 设置                                                                                                                                     |
| Open settings                                                                                                                                                                                                      | 打开设置                                                                                                                                 |
| Daily Check In                                                                                                                                                                                                     | 每日签到                                                                                                                                 |
| View captain profile                                                                                                                                                                                               | 查看船长资料                                                                                                                             |
| Captains                                                                                                                                                                                                           | 船长                                                                                                                                     |
| Sailing                                                                                                                                                                                                            | 航行中                                                                                                                                   |
| Captain Legacy                                                                                                                                                                                                     | 船长传承                                                                                                                                 |
| View captain legacy                                                                                                                                                                                                | 查看船长传承                                                                                                                             |
| Dismiss                                                                                                                                                                                                            | 关闭                                                                                                                                     |
| Refresh harbors                                                                                                                                                                                                    | 刷新港湾                                                                                                                                 |
| Refresh the harbor list                                                                                                                                                                                            | 刷新港湾列表                                                                                                                             |
| e.g. Silk Run · Voyage 1                                                                                                                                                                                           | 例如：丝路行程 · 航程 1                                                                                                                  |
| The phrase the harbor asks for                                                                                                                                                                                     | 港湾索要的那句暗语                                                                                                                       |
| Waters                                                                                                                                                                                                             | 水域                                                                                                                                     |
| Renown level up! A bigger start of voyage Gold bonus awaits.                                                                                                                                                       | 声望升级！下回开航，金币奖励更丰厚。                                                                                                     |
| Fair winds. Come back tomorrow for the next reward.                                                                                                                                                                | 顺风。明天再来领取下一份奖励。                                                                                                           |
| Already checked in today                                                                                                                                                                                           | 今天已经签到过了                                                                                                                         |
| Come back tomorrow for the next reward.                                                                                                                                                                            | 明天再来领取下一份奖励。                                                                                                                 |
| Check in failed                                                                                                                                                                                                    | 签到失败                                                                                                                                 |
| Could not reach the Harbormaster. Try again.                                                                                                                                                                       | 联系不上港务长，再试一次。                                                                                                               |
| Quick Start failed                                                                                                                                                                                                 | 快速开局失败                                                                                                                             |
| Still connecting to the harbor. Try again in a moment.                                                                                                                                                             | 还在连接港湾。请稍后再试。                                                                                                               |
| Looking for a harbor                                                                                                                                                                                               | 正在寻找港湾                                                                                                                             |
| Pairing you with the next captain who asks.                                                                                                                                                                        | 正在把你和下一位点快速开局的船长配到一起。                                                                                               |
| Quick Start timed out. Please try again.                                                                                                                                                                           | 快速开局超时了，再试一次。                                                                                                               |
| Quick Start matched a harbor, but it could not be reached.                                                                                                                                                         | 快速开局配到了港湾，却连不上。                                                                                                           |
| Quick Start is unavailable right now.                                                                                                                                                                              | 快速开局暂时用不了。                                                                                                                     |
| Failed to create room                                                                                                                                                                                              | 创建港湾失败                                                                                                                             |
| Room codes are 6 characters.                                                                                                                                                                                       | 港湾口令是6个字符。                                                                                                                      |
| Failed to join room                                                                                                                                                                                                | 加入港湾失败                                                                                                                             |
| Failed to enter room                                                                                                                                                                                               | 进入港湾失败                                                                                                                             |
| Could not load chronicles                                                                                                                                                                                          | 航程实录加载不了                                                                                                                         |
| Could not load House standings                                                                                                                                                                                     | 世家排名加载不了                                                                                                                         |
| Pledged to ${house?.name ?? "House"}                                                                                                                                                                               | 已加入{house?.name ?? "世家"}                                                                                                            |
| Your House perk applies on your next fresh voyage.                                                                                                                                                                 | 你的世家优待，从下个全新航程开始生效。                                                                                                   |
| Pledge failed                                                                                                                                                                                                      | 加入世家失败                                                                                                                             |
| Try again in a moment.                                                                                                                                                                                             | 请稍后再试。                                                                                                                             |
| Connecting                                                                                                                                                                                                         | 连接中                                                                                                                                   |

**`src/components/portmasters/MembersPanel.tsx`** (3)

| English                                              | Chinese                          |
| ---------------------------------------------------- | -------------------------------- |
| No captains in this harbor yet.                      | 这个港湾里还没有船长。           |
| You have already reported this captain this voyage.  | 本次航程你已经举报过这位船长。   |
| Report filed. It goes on the record for this voyage. | 举报已提交，会记进本航程的记录。 |

**`src/components/portmasters/NotificationToast.tsx`** (1)

| English              | Chinese  |
| -------------------- | -------- |
| Dismiss notification | 关闭通知 |

**`src/components/portmasters/PanelHeader.tsx`** (1)

| English                                                 | Chinese                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| ${collapsed ? "Expand" : "Collapse"} the ${title} panel | {collapsed ? "展开" : "收起"}{title}面板 |

**`src/components/portmasters/SettingsModal.tsx`** (18)

| English                                                              | Chinese                                           |
| -------------------------------------------------------------------- | ------------------------------------------------- |
| Volume                                                               | 音量                                              |
| Close settings                                                       | 关闭设置                                          |
| Sound                                                                | 声音                                              |
| Harbor sounds                                                        | 港湾音效                                          |
| Ambient harbor bed and UI feedback tones                             | 港湾环境音与界面提示音                            |
| Theme                                                                | 主题                                              |
| Light                                                                | 浅色                                              |
| Dark                                                                 | 深色                                              |
| Auto                                                                 | 自动                                              |
| Visual                                                               | 显示                                              |
| Colorblind safe palette                                              | 色盲友好配色                                      |
| Use Okabe Ito anchored colors for all goods                          | 所有货物都使用 Okabe Ito 配色                     |
| Notifications                                                        | 通知                                              |
| Messages from the other captains in the harbor                       | 港湾里其他船长发来的消息                          |
| The race to ${WORD_ON_THE_DOCKS_THRESHOLD} completed orders          | 抢先交满{WORD_ON_THE_DOCKS_THRESHOLD}笔委托的竞赛 |
| Tidewatch Surge                                                      | 观潮涌动                                          |
| The harbor crossing ${TIDEWATCH_SURGE_THRESHOLD} combined Reputation | 港湾声誉合计突破{TIDEWATCH_SURGE_THRESHOLD}       |
| Shortcuts                                                            | 快捷键                                            |

**`src/components/portmasters/chat/Composer.tsx`** (6)

| English                                                          | Chinese                                                  |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| The host has muted you in room chat for the rest of this voyage. | 本航程余下的时间，港主已经把你禁言，港湾聊天里说不了话。 |
| Offer a trade                                                    | 发起交易                                                 |
| Dismiss trade error                                              | 关闭交易错误                                             |
| Search messages                                                  | 搜索消息                                                 |
| Message the harbor…                                              | 给港湾发消息...                                          |
| Message the lobby…                                               | 给大厅发消息...                                          |

**`src/components/portmasters/chat/DmTab.tsx`** (3)

| English                                                                            | Chinese                                            |
| ---------------------------------------------------------------------------------- | -------------------------------------------------- |
| Switch                                                                             | 切换                                               |
| Pick a captain to message privately                                                | 选一位船长，私下发消息                             |
| No other captains available right now. They will appear here once they are online. | 眼下没有别的船长可选。等他们上线，就会出现在这里。 |

**`src/components/portmasters/game/EscortContracts.tsx`** (1)

| English | Chinese |
| ------- | ------- |
| you     | 你      |

**`src/components/portmasters/game/MaroonPanel.tsx`** (1)

| English    | Chinese |
| ---------- | ------- |
| Put ashore | 被放逐  |

**`src/components/portmasters/game/phases/PhasePanels.tsx`** (1)

| English | Chinese |
| ------- | ------- |
| muted   | 已禁言  |

**`src/components/portmasters/lobby/HarborBoard.tsx`** (7)

| English                                                                                                                        | Chinese                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Scanning the horizon                                                                                                           | 正在眺望海面                                                                   |
| No harbors open yet                                                                                                            | 还没有港湾开放                                                                 |
| Hit Quick Start above to be paired with the next captain looking, or switch to Chart a new harbor and open a room of your own. | 点上面的快速开局，和下一位找港湾的船长配对；或者切到开一个新港湾，自己开一间。 |
| Private                                                                                                                        | 私密                                                                           |
| ⛵ Sailing                                                                                                                     | ⛵ 航行中                                                                      |
| This voyage has already set sail                                                                                               | 本航程已经起航                                                                 |
| Locked                                                                                                                         | 锁定                                                                           |

**`src/components/portmasters/lobby/HarborRail.tsx`** (6)

| English                                                             | Chinese                                  |
| ------------------------------------------------------------------- | ---------------------------------------- |
| Pick a captain from the list above to start a private conversation. | 从上面的名单里选一位船长，就能私下交谈。 |
| Captains Online                                                     | 在线船长                                 |
| No other captains online yet.                                       | 还没有其他船长在线。                     |
| Connecting to the harbor…                                           | 正在连接港湾...                          |
| In a harbor                                                         | 在港湾                                   |
| In the lobby                                                        | 在大厅                                   |

**`src/components/portmasters/lobby/LobbyDialogs.tsx`** (13)

| English                                                                                                                                   | Chinese                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Captain&apos;s Legacy                                                                                                                     | 船长传承                                                                         |
| Renown carries across every voyage this account ever sails, in any harbor.                                                                | 这个账号驶过的每一次航程，不管在哪个港湾，声望都攒在一起。                       |
| Claim a Renown reward each day. The 7 day cycle picks up where you left off, even after a missed day, and restarts once Day 7 is claimed. | 每天能领一份声望奖励。七天一轮，漏了一天也接着上次往下走，领过第七天就从头再来。 |
| The Harbormaster&apos;s ledger of your finished voyages, newest first.                                                                    | 港务长替你记着跑完的航程，最新的排最前。                                         |
| Loading chronicles…                                                                                                                       | 正在加载航程实录...                                                              |
| No chronicles yet. Finish a voyage and your headline will be inscribed here.                                                              | 还没有航程实录。完成一次航程，你的标题就会刻在这里。                             |
| Pledge to one House. Its perk applies on your next fresh voyage. Switch any time between voyages.                                         | 加入一个世家。优待从你下个全新航程开始生效；两个航程之间，随时能换。             |
| Loading standings…                                                                                                                        | 正在加载排名...                                                                  |
| Pledged                                                                                                                                   | 已加入                                                                           |
| ✓ XP                                                                                                                                      | ✓ 经验                                                                           |
| Claiming…                                                                                                                                 | 领取中...                                                                        |
| Checked in today · back tomorrow                                                                                                          | 今日已签到 · 明天再来                                                            |
| Pledge                                                                                                                                    | 加入                                                                             |

**`src/components/portmasters/lobby/VoyageCards.tsx`** (4)

| English              | Chinese      |
| -------------------- | ------------ |
| Experimental         | 试验中       |
| 🔒 Sealed            | 🔒 封锁      |
| Still being built.   | 仍在建造中。 |
| Opens with a phrase. | 凭暗语开启。 |

**`src/components/portmasters/profile/ChronicleDetail.tsx`** (5)

| English         | Chinese  |
| --------------- | -------- |
| Merchant Rating | 商人评级 |
| Peak Rep        | 最高声誉 |
| Final Rep       | 最终声誉 |
| Final Gold      | 最终金币 |
| Best Trade      | 最佳交易 |

**`src/components/portmasters/profile/ChronicleLoans.tsx`** (2)

| English     | Chinese |
| ----------- | ------- |
| loans given | 笔借出  |
| loans taken | 笔借入  |

**`src/components/portmasters/profile/ChronicleRow.tsx`** (1)

| English | Chinese |
| ------- | ------- |
| Crowned | 加冕    |

**`src/components/portmasters/profile/ChroniclesTab.tsx`** (1)

| English                                                                             | Chinese                                                      |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| No chronicles saved yet. Opt in to save a chronicle at the end of your next voyage. | 还没有保存的航程实录。下个航程跑到头，选保存，就能留下一份。 |

**`src/components/portmasters/profile/DifficultyBreakdown.tsx`** (1)

| English       | Chinese |
| ------------- | ------- |
| By Difficulty | 按难度  |

**`src/components/portmasters/profile/MeritsShowcase.tsx`** (1)

| English                                              | Chinese                            |
| ---------------------------------------------------- | ---------------------------------- |
| No merits earned yet. Complete voyages to earn them. | 还没有拿到功勋。跑完航程就能挣到。 |

**`src/components/portmasters/profile/RenownProgression.tsx`** (1)

| English            | Chinese  |
| ------------------ | -------- |
| Renown Progression | 声望进度 |

**`src/components/portmasters/profile/RivalRow.tsx`** (1)

| English | Chinese |
| ------- | ------- |
| Leading | 领先    |

**`src/components/portmasters/profile/RivalsTab.tsx`** (1)

| English                                                                       | Chinese                                                  |
| ----------------------------------------------------------------------------- | -------------------------------------------------------- |
| No rivals yet. Sail in the same harbor as another captain to build a rivalry. | 还没有对手。和另一位船长在同一个港湾航行，就会结成对手。 |

**`src/components/portmasters/profile/StandingStats.tsx`** (4)

| English                                | Chinese                |
| -------------------------------------- | ---------------------- |
| Solvent Streak                         | 连续不破产             |
| Crown Rate                             | 加冕率                 |
| Consecutive voyages without bankruptcy | 连续不破产的航程次数   |
| Share of voyages won as Sea Master     | 荣登沧海之主的航程占比 |

**`src/components/portmasters/profile/StatsTab.tsx`** (1)

| English                                               | Chinese                              |
| ----------------------------------------------------- | ------------------------------------ |
| No voyage records yet. Set sail to begin your legacy. | 还没有航程记录。起航，开始你的传承。 |

**`src/components/portmasters/profile/VoyageTrends.tsx`** (4)

| English              | Chinese      |
| -------------------- | ------------ |
| Recent Voyage Trends | 近期航程走势 |
| Final Reputation     | 最终声誉     |
| Peak Reputation      | 最高声誉     |
| Largest Trade        | 最大单笔交易 |

**`src/components/portmasters/roster/PeekButton.tsx`** (6)

| English                             | Chinese                        |
| ----------------------------------- | ------------------------------ |
| partial sight                       | 局部视野                       |
| Hold is empty.                      | 货舱是空的。                   |
| Peek at ${targetName}'s cargo       | 查看{targetName}的货物         |
| Partial sight peek at ${targetName} | 局部视野查看{targetName}       |
| Asking the harbor…                  | 正在询问港湾...                |
| No snapshot yet. Tap the eye again. | 还没有快照。再点一下那只眼睛。 |

**`src/components/portmasters/roster/RosterHeader.tsx`** (1)

| English       | Chinese  |
| ------------- | -------- |
| Harbor Roster | 港湾名册 |

**`src/components/portmasters/roster/RosterRow.tsx`** (5)

| English                                    | Chinese                      |
| ------------------------------------------ | ---------------------------- |
| Ashore                                     | 已上岸                       |
| Report ${member.displayName}               | 举报{member.displayName}     |
| Unmute this captain                        | 解除这位船长的禁言           |
| Mute this captain                          | 禁言这位船长                 |
| You have reported this captain this voyage | 本次航程你已经举报过这位船长 |

**`src/server/realtime/wiring/chat.ts`** (3)

| English                                                | Chinese                    |
| ------------------------------------------------------ | -------------------------- |
| Only the host can mute a captain.                      | 只有港主可以禁言船长。     |
| You can't report yourself.                             | 你不能举报自己。           |
| That report could not be filed. Try again in a moment. | 举报没能提交。请稍后再试。 |

### Auth, saves and the odds and ends (69)

Sign in, saves, rooms, victory and the small print the app answers with.

**`src/app/api/auth/login/route.ts`** (3)

| English                                                                                       | Chinese                                                    |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Invalid input                                                                                 | 输入不对                                                   |
| No account found with that captain name. Please check the spelling or register a new account. | 没有查到用这个船长名的账号。核对一下拼写，或者注册新账号。 |
| The password you entered is incorrect.                                                        | 密码不对。                                                 |

**`src/app/api/game/state/route.ts`** (1)

| English                                 | Chinese                    |
| --------------------------------------- | -------------------------- |
| That voyage save is too large to store. | 本航程的存档太大，存不下。 |

**`src/app/api/legacy/[userId]/route.ts`** (1)

| English           | Chinese    |
| ----------------- | ---------- |
| Captain not found | 查无此船长 |

**`src/app/api/rooms/[id]/join/route.ts`** (1)

| English        | Chinese    |
| -------------- | ---------- |
| Room not found | 查无此港湾 |

**`src/app/api/rooms/join/route.ts`** (2)

| English                             | Chinese                |
| ----------------------------------- | ---------------------- |
| A 6 character room code is required | 港湾口令得是6个字符    |
| No room exists with that code       | 这个口令对不上任何港湾 |

**`src/app/api/rooms/route.ts`** (3)

| English                                                                          | Chinese                                                |
| -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| That phrase opens a different voyage than the one asked for.                     | 这句暗语开的航程，不是你要开的那次航程。               |
| That phrase does not open this voyage. Check the words and try again.            | 这句暗语开不了本航程。核对一下字句，再试一次。         |
| This voyage is sealed. It opens with a phrase, and the harbor was not given one. | 本航程是封着的，要用暗语才开得起来，可开辟时没填暗语。 |

**`src/components/portmasters/ChatPanel.tsx`** (7)

| English                                                   | Chinese                                    |
| --------------------------------------------------------- | ------------------------------------------ |
| Search messages…                                          | 搜索消息...                                |
| Close search                                              | 关闭搜索                                   |
| You're muted                                              | 你被禁言了                                 |
| The host has muted you in room chat this voyage.          | 本航程中，港主在港湾聊天里把你禁言了。     |
| Nothing on the harbor square yet. Say hello to the fleet. | 港湾广场上还什么都没有。跟船队打个招呼吧。 |
| No messages yet. Break the ice with your fellow captains. | 还没有消息。先跟同席船长们搭一句话吧。     |
| No messages yet between you two.                          | 你们俩还没有消息。                         |

**`src/components/portmasters/Sparkline.tsx`** (1)

| English | Chinese |
| ------- | ------- |
| N/A     | 暂无    |

**`src/lib/game/constants/drafts.ts`** (1)

| English                                                            | Chinese                                       |
| ------------------------------------------------------------------ | --------------------------------------------- |
| Gain ${EMERGENCY_LOAN_GOLD} Gold immediately. No strings attached. | 立即获得{EMERGENCY_LOAN_GOLD}金币，无需偿还。 |

**`src/lib/game/difficulty.ts`** (2)

| English                    | Chinese                |
| -------------------------- | ---------------------- |
| ${pcts[0]}%                | {pcts[0]}%             |
| ${pcts[0]}% to ${pcts[1]}% | {pcts[0]}%至{pcts[1]}% |

**`src/lib/game/objectives.ts`** (12)

| English                                                                        | Chinese                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------ |
| The Cordage Warrant                                                            | 绳索采办                                         |
| The yards need rope. Hemp by the bale, and linen to back it.                   | 船坞要用绳索。麻布要成包的，还要麻布做衬。       |
| The Silk and Tea Levy                                                          | 丝茶之征                                         |
| Two holds of the old trade, silk from the north and tea from the south.        | 老买卖的两舱货，北边的丝绸，南边的茶叶。         |
| The Cloth Quota                                                                | 布匹定额                                         |
| The garrison is being re-kitted, and the weaving houses cannot do it alone.    | 守军要换装，织造人家顾不过来。                   |
| The Sachet Tithe                                                               | 香囊之贡                                         |
| Sachets for the court, tea for the road, and hemp to wrap the lot.             | 朝廷的香囊，路上的茶叶，还有裹这批货的麻布。     |
| The Brocade Command                                                            | 绫罗绸缎之令                                     |
| Brocade for the reception, and the raw stuff to keep the looms turning.        | 待客的绫罗绸缎，还有让织机转不停的原材料。       |
| The Full Manifest                                                              | 满载舱单                                         |
| Nothing finished, nothing fancy. The founding three, and a great deal of them. | 不要成品，不要稀罕货。就是最初那三样，而且要多。 |

**`src/lib/game/phases.ts`** (1)

| English | Chinese |
| ------- | ------- |
| Settle  | 结算    |

**`src/lib/game/victory.ts`** (4)

| English                                                                                                                                                                                     | Chinese                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| You win if the fleet fills its commission and your own goal above is met with it.                                                                                                           | 船队凑齐公议，你上方那条个人目标也跟着完成，这局就归你。                                                                             |
| You win if the fleet fills its commission.                                                                                                                                                  | 船队凑齐公议，这局就归你。                                                                                                           |
| You win if you take at least ${BROKER_PAYOUT_TARGET} Gold from other captains in trade. The commission is their business rather than yours, so a voyage they finish well is no loss to you. | 只要在交易里从别的船长手上赚到至少{BROKER_PAYOUT_TARGET}金币，这局就归你。公议是他们的事，不是你的。他们航程走得再漂亮，你也不吃亏。 |
| You win if the fleet falls short of its commission, and you still end the voyage solvent and rated at least a Qualified Trader.                                                             | 船队没凑齐公议，你到航程结束还没破产，评级至少是合格商人，这局就归你。                                                               |

**`src/lib/game/voyage-log.ts`** (10)

| English                                                                                | Chinese                                                                   |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| The voyage leaves the dock.                                                            | 航程驶离码头。                                                            |
| The harbor audits ${facts.target}.                                                     | 港湾稽查{facts.target}。                                                  |
| The harbor maroons ${facts.target}.                                                    | 港湾放逐{facts.target}。                                                  |
| ${facts.captain} leaves the harbor.                                                    | {facts.captain}离开港湾。                                                 |
| ${facts.captain} offers one leg of protection for ${facts.fee} Gold.                   | {facts.captain}挂出一段护卫，要价{facts.fee}金币。                        |
| ${facts.taker} buys a leg of protection from ${facts.captain} for ${facts.fee} Gold.   | {facts.taker}以{facts.fee}金币买下{facts.captain}的一段护卫。             |
| Raiders bound for ${facts.taker} met ${facts.captain}'s guns.                          | 冲着{facts.taker}去的海盗，撞上了{facts.captain}的炮口。                  |
| ${facts.captain} offers to put a ${facts.good} right for ${facts.fee} Gold.            | {facts.captain}开价{facts.fee}金币，接下一单{facts.good}的整补。          |
| ${facts.taker} pays ${facts.captain} ${facts.fee} Gold to put the ${facts.good} right. | {facts.taker}付给{facts.captain}{facts.fee}金币，把{facts.good}整补妥当。 |
| ${facts.captain} publishes a rumor about ${facts.good} at the bazaar.                  | {facts.captain}在香市放出{facts.good}的传闻。                             |

**`src/lib/phase-clock.ts`** (1)

| English             | Chinese    |
| ------------------- | ---------- |
| the tide is turning | 潮水转向了 |

**`src/lib/rooms.ts`** (1)

| English                                                            | Chinese                              |
| ------------------------------------------------------------------ | ------------------------------------ |
| This voyage has already set sail. Ask the host to open a new room. | 本航程已经起航。请港主另开一个港湾。 |

**`src/lib/unlock.ts`** (4)

| English                                                                                                                                                                  | Chinese                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| The Second Ledger                                                                                                                                                        | 第二本账簿                                                                                                    |
| the second ledger                                                                                                                                                        | 第二本账簿                                                                                                    |
| One harbor is sealed as well as hard. It opens with a phrase, and the phrase is the second ledger, entered when the room is charted.                                     | 有一座港湾，路难走，门也锁着。开它得用一句暗语，暗语就是第二本账簿，开辟港湾时填上。                          |
| The harbor keeps one door shut, and ${UNLOCK_EARNED_AT} completed voyages is what opens it: the phrase is ${unlock.phrase}, and the guide has the line for whoever asks. | 港湾留着一扇门不开，完成{UNLOCK_EARNED_AT}次航程才打得开：暗语是{unlock.phrase}，谁问起，指南里就写着这一句。 |

**`src/lib/use-admin.ts`** (4)

| English                                                                                                       | Chinese                                                            |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| One action ${why}, so nothing here can vouch for whether it landed. The register has been read again.         | 有一项操作{why}，到底落没落下，这里作不了证。名册已重新读过。      |
| ${count} actions ${why}, so nothing here can vouch for whether they landed. The register has been read again. | 有{count}项操作{why}，到底落没落下，这里作不了证。名册已重新读过。 |
| went unanswered by the server                                                                                 | 没等到服务器回话                                                   |
| was cut off by a dropped connection                                                                           | 因掉线中断                                                         |

**`src/lib/use-harbor-boards.ts`** (6)

| English                                                                                                    | Chinese                                                                      |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| ⚓ Venture filled!                                                                                         | ⚓ 合股达成！                                                                |
| Your share: +${mine.amount} Gold.                                                                          | 你这份：+{mine.amount}金币。                                                 |
| ⚓ Venture missed its deadline                                                                             | ⚓ 合股已逾期                                                                |
| Partial refund: +${mine.amount} Gold.                                                                      | 部分退款：+{mine.amount}金币。                                               |
| ⚓ Venture canceled                                                                                        | ⚓ 合股已取消                                                                |
| Another venture in the harbor already claimed this voyage's one chance. Full refund: +${mine.amount} Gold. | 港湾里另一笔合股抢先占了本航程唯一的一次机会。全额退款：+{mine.amount}金币。 |

**`src/lib/voteTally.ts`** (4)

| English                                                                       | Chinese                                                    |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}               | {names.slice(0, -1).join(", ")}和{names[names.length - 1]} |
| ${count} names                                                                | {count}个名字                                              |
| ${count} captains                                                             | {count}位船长                                              |
| ${named} of ${roster} captains ${named === 1 ? "has" : "have"} named someone. | {roster}位船长里，已有{named}位指认了他人。                |

### The finishing sweep (431)

The finishing pass: the operator console and the balance dashboard, the gates instrument, and every line the earlier sweeps missed.

**`src/app/admin/balance/page.tsx`** (1)

| English                | Chinese             |
| ---------------------- | ------------------- |
| Reading the balance... | 正在读取平衡数据... |

**`src/app/admin/page.tsx`** (2)

| English                             | Chinese              |
| ----------------------------------- | -------------------- |
| Reading the register...             | 正在读取名册...      |
| Signed out of the operator console. | 已退出操作员控制台。 |

**`src/app/api/admin/register/route.ts`** (2)

| English                         | Chinese            |
| ------------------------------- | ------------------ |
| Enter the setup code            | 请输入设置口令     |
| That setup code is not correct. | 这个设置口令不对。 |

**`src/components/portmasters/ActionSuggester.tsx`** (10)

| English                                                                                                                                                                                                                                                              | Chinese                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| You have no artisans yet. ${cardText(apprentice).name} cuts hiring costs by ${Math.round(hireDiscount * 100)}% this round, letting you get a Weaver for ${weaverThen} Gold instead of ${weaverNow}. Good for establishing production early.                          | 你还没有工匠。{cardText(apprentice).name}本轮把雇工费用降低{Math.round(hireDiscount * 100)}%：织女只要{weaverThen}金币，原本要{weaverNow}金币。适合早点把生产立起来。       |
| The best deal costs ${finalCost} Gold but you only have ${game.money}. Save your Gold for the Resolve bills. You can still barter for goods you need.                                                                                                                | 最划算的一单要{finalCost}金币，而你只有{game.money}。把金币留给结算的账单吧，缺的货还能靠易货换。                                                                           |
| A Weaver costs ${weaverWage} Gold per round and can make Linen Clothes from Hemp. You have ${game.money} Gold, enough for ${Math.floor(game.money / weaverWage)} rounds of wages. Production runs the same round you assign it, so hire now to get goods by Resolve. | 一名织女每轮要{weaverWage}金币，能把麻布织成麻衣。你有{game.money}金币，够付{Math.floor(game.money / weaverWage)}轮工钱。指派当轮就开工，现在雇，结算时就有货。             |
| This order pays ${bestOrder.reward} Gold with an estimated net profit of ${bestProfit} Gold after transport and taxes. It is the most profitable order you can complete right now.                                                                                   | 这份委托报酬{bestOrder.reward}金币，扣掉运费和税后估计净赚{bestProfit}金币。这是你现在能完成的最赚的一单。                                                                  |
| You owe about ${totalDue} Gold in wages and maintenance but only have ${game.money} Gold. Ask the harbor for a loan before settling, or you will go bankrupt.                                                                                                        | 工钱和维护费大约欠{totalDue}金币，而你只有{game.money}金币。结算前先向港湾借一笔，不然就要破产了。                                                                          |
| You have ${game.money} Gold, enough to cover the estimated ${totalDue} Gold in wages and maintenance. Settle your bills and move on to Dusk.                                                                                                                         | 你有{game.money}金币，够付大约{totalDue}金币的工钱和维护费。结清账单，进入暮色。                                                                                            |
| Upgrading costs ${cost} Gold and gives +1 module slot and +${SHIP_DISCOUNT_PER_LEVEL} Gold transport discount. With ${roundsLeft} rounds left, the transport savings alone will pay for the upgrade.                                                                 | 升级要{cost}金币，换来 +1个模块仓位和 +{SHIP_DISCOUNT_PER_LEVEL}金币运费折扣。还剩{roundsLeft}轮，单是省下的运费就够回本。                                                  |
| You have ${game.equippedModules.length} of ${game.shipLevel} module slots filled. An empty slot is wasted potential. Draft a module now to gain a permanent bonus.                                                                                                   | 你的{game.shipLevel}个模块仓位装了{game.equippedModules.length}个。空着的仓位就是白扔的潜力。现在就去抽一个模块，换一份永久加成。                                           |
| You have ${game.money} Gold. Spending ${intelCost} Gold on a rumor guarantees a matching order in Orders, then buying the ${bestGoodName} at ${bestCard.resources[0]?.price} Gold per unit sets up a profitable trade.                                               | 你手上有{game.money}金币。花{intelCost}金币买一条掮客传闻，委托阶段就保有一条对得上的委托；再按每件{bestCard.resources[0]?.price}金币买进{bestGoodName}，一笔好买卖就成了。 |
| Best deal this round: ${bestGoodName} at ${bestCard.resources[0]?.price} Gold per unit from ${bestCard.port}. This is ${Math.round(bestScore * 100)}% of the typical price range, making it a good value.                                                            | 本轮最划算：来自{bestCard.port}的{bestGoodName}，每件{bestCard.resources[0]?.price}金币，约为常见价位的{Math.round(bestScore * 100)}%，值得入手。                           |

**`src/components/portmasters/AdminConsole.tsx`** (46)

| English                                                                                                                                                                                                                                    | Chinese                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Operator Console                                                                                                                                                                                                                           | 操作员控制台                                                                                                                                   |
| {accounts.length} accounts, {onlineCount} online, for {APP_NAME}                                                                                                                                                                           | {accounts.length}个账户，{onlineCount}人在线，{APP_NAME}。                                                                                     |
| The balance dashboard                                                                                                                                                                                                                      | 平衡总览                                                                                                                                       |
| Refresh the roster                                                                                                                                                                                                                         | 刷新名册                                                                                                                                       |
| Search name or handle                                                                                                                                                                                                                      | 搜索姓名或用户名                                                                                                                               |
| Search accounts                                                                                                                                                                                                                            | 搜索账户                                                                                                                                       |
| Clear the search                                                                                                                                                                                                                           | 清除搜索                                                                                                                                       |
| Filter the register                                                                                                                                                                                                                        | 筛选名册                                                                                                                                       |
| All                                                                                                                                                                                                                                        | 全部                                                                                                                                           |
| Admins                                                                                                                                                                                                                                     | 管理员                                                                                                                                         |
| Banned                                                                                                                                                                                                                                     | 已封停                                                                                                                                         |
| {selected.length} {selected.length === 1 ? "account" : "accounts"} selected                                                                                                                                                                | 已选{selected.length}个账户                                                                                                                    |
| Ban                                                                                                                                                                                                                                        | 封停                                                                                                                                           |
| Unban                                                                                                                                                                                                                                      | 解封                                                                                                                                           |
| Grant admin                                                                                                                                                                                                                                | 授予管理员                                                                                                                                     |
| Delete                                                                                                                                                                                                                                     | 删除                                                                                                                                           |
| Revoke admin                                                                                                                                                                                                                               | 撤销管理员                                                                                                                                     |
| Clear                                                                                                                                                                                                                                      | 清除                                                                                                                                           |
| Select every account shown                                                                                                                                                                                                                 | 选中当前显示的全部账户                                                                                                                         |
| Status                                                                                                                                                                                                                                     | 状态                                                                                                                                           |
| Harbors                                                                                                                                                                                                                                    | 港湾                                                                                                                                           |
| Seats                                                                                                                                                                                                                                      | 席位                                                                                                                                           |
| Actions                                                                                                                                                                                                                                    | 操作                                                                                                                                           |
| Administrator                                                                                                                                                                                                                              | 管理员                                                                                                                                         |
| Away                                                                                                                                                                                                                                       | 离开                                                                                                                                           |
| Not available on your own account                                                                                                                                                                                                          | 自己的账户不可用                                                                                                                               |
| Unban the account first                                                                                                                                                                                                                    | 先解封该账户                                                                                                                                   |
| Banning ends every session the account holds and clears its seats on the spot. Deleting removes the account and every harbor it hosts, and cannot be undone.                                                                               | 封停会当场结束该账户的所有会话，席位一并清空。删除则连账户带它主持的每一个港湾一起移走，撤不回来。                                             |
| Delete {purgeTarget?.displayName}?                                                                                                                                                                                                         | 删除{purgeTarget?.displayName}？                                                                                                               |
| The account is removed, along with every harbor it hosts, every seat it holds, and every voyage, chronicle and merit it has earned. Any captain sitting in one of those harbors is sent back to the Lobby. This cannot be undone.          | 账户就此移走，连同它主持的每一个港湾、占着的每一个席位，以及一路赢下的航程、实录与功勋。还坐在这些港湾里的船长，全部送回大厅。撤不回来。       |
| Type {purgeTarget?.username} to confirm                                                                                                                                                                                                    | 输入{purgeTarget?.username}确认                                                                                                                |
| Delete Account                                                                                                                                                                                                                             | 删除账户                                                                                                                                       |
| Every account ticked is removed, along with every harbor it hosts, every seat it holds, and every voyage, chronicle and merit it has earned. Any captain sitting in one of those harbors is sent back to the Lobby. This cannot be undone. | 勾中的账户一并移走，连同它主持的每一个港湾、占着的每一个席位，以及一路赢下的航程、实录与功勋。还坐在这些港湾里的船长，全部送回大厅。撤不回来。 |
| Delete Accounts                                                                                                                                                                                                                            | 删除账户                                                                                                                                       |
| {verb} {report.applied} {plural(report.applied)}.                                                                                                                                                                                          | {verb} {report.applied}个账户。                                                                                                                |
| {verb} {report.applied} of {report.requested} accounts.                                                                                                                                                                                    | {verb} {report.applied}/{report.requested}个账户。                                                                                             |
| Unbanned                                                                                                                                                                                                                                   | 已解封                                                                                                                                         |
| Granted administrator to                                                                                                                                                                                                                   | 已授予管理员                                                                                                                                   |
| Deleted                                                                                                                                                                                                                                    | 已删除                                                                                                                                         |
| Select {account.displayName}                                                                                                                                                                                                               | 选择{account.displayName}                                                                                                                      |
| Unknown                                                                                                                                                                                                                                    | 未知                                                                                                                                           |
| Refresh                                                                                                                                                                                                                                    | 刷新                                                                                                                                           |
| Delete {bulkCount} {bulkCount === 1 ? "account" : "accounts"}?                                                                                                                                                                             | 删除{bulkCount}个账户？                                                                                                                        |
| Type {bulkCount} to confirm                                                                                                                                                                                                                | 输入{bulkCount}确认                                                                                                                            |
| There are no accounts to show.                                                                                                                                                                                                             | 暂无账户可显示。                                                                                                                               |
| No accounts match this view.                                                                                                                                                                                                               | 当前视图下没有匹配的账户。                                                                                                                     |

**`src/components/portmasters/AdminGate.tsx`** (8)

| English                                                                                                     | Chinese                                                      |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| from the server configuration                                                                               | 来自服务器配置                                               |
| setup code                                                                                                  | 设置口令                                                     |
| shown in the roster                                                                                         | 会显示在名册里                                               |
| for example, Harbor Master                                                                                  | 例如：港务长                                                 |
| Account tools for {APP_NAME}                                                                                | {APP_NAME}的账户工具                                         |
| Open the Console                                                                                            | 进入控制台                                                   |
| Create Operator                                                                                             | 创建操作员                                                   |
| Registration needs the setup code the server was configured with. Accounts created here are administrators. | 注册要填服务器配置里的设置口令。在这里开的账户，都是管理员。 |

**`src/components/portmasters/BalanceDashboard.tsx`** (33)

| English                                                                                               | Chinese                                                              |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Balance Dashboard                                                                                     | 平衡总览                                                             |
| The operator console                                                                                  | 操作员控制台                                                         |
| Console                                                                                               | 控制台                                                               |
| Read the window again                                                                                 | 重新读取窗口                                                         |
| The reading could not be loaded.                                                                      | 读数加载失败。                                                       |
| The window could not be read.                                                                         | 窗口读取失败。                                                       |
| Reading the window...                                                                                 | 正在读取窗口...                                                      |
| in gate                                                                                               | 在区间                                                               |
| under                                                                                                 | 偏低                                                                 |
| over                                                                                                  | 偏高                                                                 |
| unplayed                                                                                              | 未开局                                                               |
| no source                                                                                             | 无来源                                                               |
| no gate                                                                                               | 无门槛                                                               |
| inside the gates                                                                                      | 全部在区间                                                           |
| out of gate                                                                                           | 出界                                                                 |
| no reading yet                                                                                        | 暂无读数                                                             |
| clear to ship                                                                                         | 可放行                                                               |
| held                                                                                                  | 暂缓                                                                 |
| no verdict yet                                                                                        | 尚无判定                                                             |
| Reading                                                                                               | 读数                                                                 |
| Window                                                                                                | 窗口                                                                 |
| Gate                                                                                                  | 门槛                                                                 |
| Verdict                                                                                               | 判定                                                                 |
| No Ocean Gambit voyage in the window yet: the panels below are the gates, and what each one waits on. | 窗口里还没有暗潮航程：下面的面板列出各道门槛，以及每道门槛在等什么。 |
| {window.voyages} {window.voyages === 1 ? "voyage" : "voyages"}, {window.captains} captains.           | {window.voyages}次航程，{window.captains}位船长。                    |
| Nothing in this window was recorded: the sampler was off.                                             | 这个窗口什么都没记到：采样器当时没开。                               |
| {window.truncated} hit the event cap.                                                                 | {window.truncated}项触及事件上限。                                   |
| {window.unreadable} could not be read.                                                                | {window.unreadable}项读不出来。                                      |
| {sharePercent(without, voyages)} of {voyages} {voyages === 1 ? "lobby" : "lobbies"}                   | 占{voyages}个大厅的{sharePercent(without, voyages)}                  |
| {roleCard(role).title} {sharePercent(cover, takes)} of {takes}                                        | {roleCard(role).title}：{sharePercent(cover, takes)}，共{takes}次    |
| {ratePercent(cell.rate)} of {cell.played}                                                             | {ratePercent(cell.rate)}，共{cell.played}程                          |
| {sharePercent(stayed, marooned.length)} of {marooned.length}                                          | {sharePercent(stayed, marooned.length)}，共{marooned.length}人       |
| {sharePercent(bankrupt, outcomes.length)} of {outcomes.length}                                        | {sharePercent(bankrupt, outcomes.length)}，共{outcomes.length}人     |

**`src/components/portmasters/CaptainLegacyCard.tsx`** (5)

| English                                                                                                                                                                                   | Chinese                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 🔒 Broker's Favor unlocks at Renown ${BROKERS_FAVOR_UNLOCK_LEVEL}, ${renownTitleForLevel(BROKERS_FAVOR_UNLOCK_LEVEL)} (${favorLevelsToGo} level${favorLevelsToGo === 1 ? "" : "s"} to go) | 🔒 掮客的人情在声望{BROKERS_FAVOR_UNLOCK_LEVEL}解锁，即{renownTitleForLevel(BROKERS_FAVOR_UNLOCK_LEVEL)}（还差{favorLevelsToGo}级） |
| ${legacy.renownXP} XP earned in total                                                                                                                                                     | 累计获得{legacy.renownXP}点声望经验                                                                                                 |
| ${xpIntoLevel} / ${xpForNextLevel} XP to Renown ${level + 1}                                                                                                                              | {xpIntoLevel} / {xpForNextLevel}点声望经验，升往声望{level + 1}                                                                     |
| ${stats.crowns} Sea Master crown${stats.crowns === 1 ? "" : "s"} · best Reputation ${stats.bestScore}                                                                                     | {stats.crowns}顶沧海之冠 · 最佳声誉{stats.bestScore}                                                                                |
| Head to head with ${rival.displayName}: ${rival.myWins} wins, ${rival.theirWins} losses, ${rival.ties} ties                                                                               | 与{rival.displayName}的交手：{rival.myWins}胜、{rival.theirWins}负、{rival.ties}平                                                  |

**`src/components/portmasters/DifficultyAdvisor.tsx`** (3)

| English                                                                                                                                                                                                                 | Chinese                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Your Renown and voyage count suggest you are ready for ${openWaters.name}. ${roundsFor("open_waters")} rounds, ${openWaters.renownXpMultiplier}x Renown, and Imperial Mandates on rounds ${mandatesFor("open_waters")}. | 你的声望和航程数说明你可以试试{openWaters.name}了。{roundsFor("open_waters")}轮，{openWaters.renownXpMultiplier}倍声望，第{mandatesFor("open_waters")}轮起有皇命。 |
| ${fairWinds.name} is the right starting point. ${roundsFor("fair_winds")} rounds, gentle pirate odds, and no mandates. Learn the loop before taking on heavier waters.                                                  | {fairWinds.name}是最合适的起点。{roundsFor("fair_winds")}轮，海盗概率温和，也没有皇命。先把循环摸熟，再去挑更重的水域。                                            |
| ${monsoon.name} has a ${pirateOddsLabel(monsoon)} pirate raid chance. Make sure you can survive a bankruptcy before risking it.                                                                                         | {monsoon.name}的劫掠概率是{pirateOddsLabel(monsoon)}。冒这个险之前，先确保自己扛得住一次破产。                                                                     |

**`src/components/portmasters/GameRoom.tsx`** (2)

| English                                                                                           | Chinese                                                                  |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ${data.winnerName} was first to complete ${WORD_ON_THE_DOCKS_THRESHOLD} trade orders this voyage. | {data.winnerName}在本航程率先完成了{WORD_ON_THE_DOCKS_THRESHOLD}笔委托。 |
| ${data.winnerName} was first to ${WORD_ON_THE_DOCKS_THRESHOLD} orders.                            | {data.winnerName}率先做满{WORD_ON_THE_DOCKS_THRESHOLD}笔委托。           |

**`src/components/portmasters/HowToPlayModal.tsx`** (1)

| English                                                                                   | Chinese                                          |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Hire artisans only when you can sustain at least two rounds of wages. ${play.failureRule} | 至少付得起两轮工钱，才雇工匠。{play.failureRule} |

**`src/components/portmasters/Lobby.tsx`** (1)

| English                                            | Chinese                                      |
| -------------------------------------------------- | -------------------------------------------- |
| Day ${res.day} claimed: +${res.xpGained} Renown XP | 第{res.day}天已领取：+{res.xpGained}声望经验 |

**`src/components/portmasters/SettingsModal.tsx`** (1)

| English                                                     | Chinese                              |
| ----------------------------------------------------------- | ------------------------------------ |
| Press ? or F2 in a game room to see all keyboard shortcuts. | 在港湾里按 ? 或 F2，查看全部快捷键。 |

**`src/components/portmasters/chat/MessageList.tsx`** (1)

| English                                        | Chinese                         |
| ---------------------------------------------- | ------------------------------- |
| No messages match &ldquo;{searchQuery}&rdquo;. | 没有消息与“{searchQuery}”匹配。 |

**`src/components/portmasters/game/AuditPanel.tsx`** (2)

| English                                                                                                                                                                                                                                                                                                                                                                 | Chinese                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ${nameCount(needed)} on one captain opens that captain's manifest to the whole harbor and closes this leg's trading.                                                                                                                                                                                                                                                    | 一位船长身上凑够{nameCount(needed)}个名字，就能把那位船长的舱单向全港湾公开，并结束本航段的交易。                                                                                                                                                                              |
| This vote opens at leg ${opensAt}, and this is leg ${game.currentRound}. A simple majority of the captains still sailing then opens one captain's manifest: ${AUDIT_REVEAL_WORDS} of their most recent order fulfillments, and nothing else. A carried vote ends that leg's trading, the voyage carries on at the next leg, and the harbor opens one manifest a voyage. | 这次稽查从第{opensAt}航段起开放，现在是第{game.currentRound}航段。还在航程里的船长，简单多数联署，就能公开一位船长的舱单：只公开他最近{AUDIT_REVEAL_WORDS}项委托交付记录，别的都不公开。联署通过的稽查会结束那一航段的交易，航程照常进入下一航段；每航程，港湾只公开一份舱单。 |

**`src/components/portmasters/game/BarterTrade.tsx`** (2)

| English                                                                                                        | Chinese                                                    |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Others can still take ${draft.offersLeft} more offer${draft.offersLeft === 1 ? "" : "s"} from you this voyage. | 本航程别人还能从你这里接下{draft.offersLeft}份报价。       |
| Unlocks at Renown Level ${FLEXIBLE_BARTER_UNLOCK_LEVEL}, ${toGo} level${toGo === 1 ? "" : "s"} to go.          | 声望等级{FLEXIBLE_BARTER_UNLOCK_LEVEL}解锁，还差{toGo}级。 |

**`src/components/portmasters/game/BazaarRumors.tsx`** (3)

| English                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Chinese                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| spoken in leg ${row.round} · priced at leg ${landsOn}                                                                                                                                                                                                                                                                                                                                                                                                           | 第{row.round}航段开的口 · 第{landsOn}航段生效                                                                                                                                                                                                                                                                        |
| Speaking at the bazaar belongs to the {SELLER_PATH.name} path, and you do not hold it this voyage. Whoever holds it is named in the voyage log, and the board below names them the moment they speak.                                                                                                                                                                                                                                                           | 在香市开口，是{SELLER_PATH.name}之道的事，你本航程不持此道。持有它的人会写进航程日志；只要一开口，下面那块板子就写出名字。                                                                                                                                                                                           |
| Once every ${RUMOR_COOLDOWN_ROUNDS} legs, each ${SELLER_PATH.name} captain may spread a word about one commodity, here at the Parley. The next port prices that good against it, by up to ${Math.round(RUMOR_SHIFT_FRACTION * 100)} percent, which is the same hand the Harbormaster leans a port with. The whole harbor is told who spoke and which good they named, and only the speaker knows which way they leaned until the port they named has priced it. | 每{RUMOR_COOLDOWN_ROUNDS}个航段一次，每位{SELLER_PATH.name}船长可以在洽谈时放出一件货的风声。下一港为那件货定价时会带上这个方向，最高{Math.round(RUMOR_SHIFT_FRACTION * 100)}%，与港务长压港用的是同一只手。谁开的口、点的是哪件货，全港湾都会知道；只有开口的人自己知道押的是哪一边，直到他点名的那个港口为此定价。 |

**`src/components/portmasters/game/EscortContracts.tsx`** (10)

| English                                                                                                                                                                                                                                                                                                                                                                                                                     | Chinese                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ Your cover was spent this leg: ${spent.sellerName}'s guns answered the raid and your Gold stayed where it was.                                                                                                                                                                                                                                                                                                           | ✅ 本航段你的护卫派上了用场：{spent.sellerName}的炮口挡下了劫掠，你的金币分文未动。                                                                                                                                                                                     |
| ✅ You are covered this leg by ${covered.sellerName} for ${covered.fee} Gold, paid at the handshake. A raid on your hold meets their cannons, and what their guns do not beat off comes out of their Gold.                                                                                                                                                                                                                  | ✅ 本航段{covered.sellerName}为你护卫，费用{covered.fee}金币，握手成交时付清。货舱若遇劫掠，由他们的炮口迎击，炮口挡不下的部分从他们的金币里出。                                                                                                                        |
| ${contract.sellerName} is covering ${who} for ${fee} this leg                                                                                                                                                                                                                                                                                                                                                               | {contract.sellerName}本航段以{fee}金币护卫{who}                                                                                                                                                                                                                         |
| ${contract.sellerName}'s guns answered a raid meant for ${who}                                                                                                                                                                                                                                                                                                                                                              | {contract.sellerName}的炮口替{who}挡下了一场劫掠                                                                                                                                                                                                                        |
| You turned down ${contract.sellerName}'s offer of ${fee}                                                                                                                                                                                                                                                                                                                                                                    | 你回绝了{contract.sellerName}的{fee}金币报价                                                                                                                                                                                                                            |
| 🛡️ You are covering ${carrying.buyerName ?? "a captain"} this leg for ${carrying.fee} Gold, already paid to you. Your Gold answers the raid their hold does not.                                                                                                                                                                                                                                                            | 🛡️ 本航段你替{carrying.buyerName ?? "一位船长"}护卫，{carrying.fee}金币已先行付到你手上。轮到海盗找上门，应答的是这笔金币，不是他们的货舱。                                                                                                                             |
| 🛡️ Your offer stands: ${one.fee} Gold for one leg of cover for ${one.buyerName ?? "a captain"}. It waits on them.                                                                                                                                                                                                                                                                                                           | 🛡️ 你的报价还挂着：{one.fee}金币，为{one.buyerName ?? "某位船长"}护一航段。就等他点头。                                                                                                                                                                                 |
| 🚫 ${refused.buyerName ?? "A captain"} turned down your offer of ${refused.fee} Gold. Nothing is owed either way, and the row stays until the leg turns.                                                                                                                                                                                                                                                                    | 🚫 {refused.buyerName ?? "有一位船长"}回绝了你{refused.fee}金币的报价。两不相欠，这一行会留到本航段结束。                                                                                                                                                               |
| One leg of protection, sold by a Convoy captain at a price the two of them agree. The buyer pays the fee at the handshake, and it is the seller's cannons that answer the raid: ${beatenOff} of it is beaten off, and the remaining ${eaten} is deducted from the seller's Gold. The cover lasts the leg it was sold for and no other, and a raid that never comes costs the seller nothing. ${ESCORT_OFFER_DEATH}          | 一段护卫，由镖行船长出售，价钱两人自己谈。买家在握手时付清费用；海盗来时，应答的是卖家的炮火：挡下{beatenOff}，余下的{eaten}从卖家的金币里扣。护卫只管它卖出的那个航段，多一段都不管；海盗没来，卖家分文不损。{ESCORT_OFFER_DEATH}                                      |
| You are the seller here, so the price is yours to name: the buyer pays it at the handshake, and your own Gold answers whatever your guns do not beat off, which is ${eaten} of a raid, down to the bottom of your hold. ${consentFeeRule()} An open offer is any captain's to take, while a named one waits on the captain you named, and one open offer plus one per captain named is the most this market holds from you. | 在这里你是卖家，价钱由你开：买家在握手时付清；你的炮火没挡下的部分由你的金币顶上，也就是一次劫掠里的{eaten}，一直扣到货舱见底。{consentFeeRule()}公开报价人人可接，点名报价只等你点的那位船长；一份公开报价，加上每位被点名船长各一份，就是这个市场替你挂着的最多数量。 |

**`src/components/portmasters/game/GameControlPanel.tsx`** (1)

| English                                                                      | Chinese                                                               |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| ⏳ ${readyLine(readyCount, requiredCount)} The phase turns when the rest do. | ⏳ {readyLine(readyCount, requiredCount)}其余人就绪后，阶段自会翻页。 |

**`src/components/portmasters/game/MaroonPanel.tsx`** (5)

| English                                                                                                                                                                                                                                                                                                                                                                                                 | Chinese                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ${nameCount(needed)} on one captain puts that captain ashore and spends the vote for the voyage.                                                                                                                                                                                                                                                                                                        | 一位船长身上凑够{nameCount(needed)}个名字，就能把那位船长放逐上岸，并用掉本航程的这一次投票。                                                                                                                                                                                      |
| This vote opens at leg ${rung}, and this is leg ${game.currentRound}. ${MAROON_VOTE_SHARE} of the captains still sailing, rounded up, then put one captain ashore: the ship and its hold go to the harbor, half their Gold stays aboard, and the Harbormaster's hand is theirs for the rest of the voyage. One vote can carry a voyage, and a vote that falls short can be called again on a later leg. | 这次投票从第{rung}航段起开放，现在是第{game.currentRound}航段。还在航程里的船长，凑够{MAROON_VOTE_SHARE}（向上取整）联署，就能把一位船长放逐上岸：船和船上的货舱归港湾，一半的金币留在船上，港务长之权归联署的一方，直到航程结束。一票能左右整程；票数不够，之后的航段还能再发起。 |
| Voted ashore by ${MAROON_VOTE_SHARE.toLowerCase()} of the harbor. The ship and everything on it went to the harbor, half their Gold stayed aboard, and the Harbormaster's hand is theirs for the rest of the voyage.                                                                                                                                                                                    | 被港湾{MAROON_VOTE_SHARE.toLowerCase()}的票数放逐上岸。船和船上的一切归了港湾，一半的金币留在船上，港务长之权归联署的一方，直到航程结束。                                                                                                                                          |
| The harbor has already named {maroon.carried.name} this voyage. The vote is spent: nothing more is asked of this table until a new voyage.                                                                                                                                                                                                                                                              | 本航程港湾已经把{maroon.carried.name}放逐了。这次投票已经用掉：新航程开始之前，不会再向这张牌桌要什么。                                                                                                                                                                            |
| The harbor put you ashore and left you its own lever: once a leg, name a port and lean every price at it by ${Math.round(PORT_SHIFT_FRACTION * 100)} percent, up or down. The call is public, and the market that opens next leg is the one that answers it.                                                                                                                                            | 港湾把你放上了岸，也留给你一根自己的杠杆：每航段一次，点名一个港口，把这个港的价格整体抬高或压低{Math.round(PORT_SHIFT_FRACTION * 100)}%。这次出手是公开的，下一航段开市的市场，就是回应它的那一个。                                                                               |

**`src/components/portmasters/game/ModuleMarket.tsx`** (2)

| English                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Chinese                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Taking it would put your hull at ${powerAfterTaking(game, card)} power, and a hull carries at most ${HELD_POWER_CAP}.                                                                                                                                                                                                                                                                                                                                      | 收下它会让船体达到{powerAfterTaking(game, card)}点力量，而船体最多承载{HELD_POWER_CAP}点。                                                                                                                                                                                         |
| A module bolted to a hull, sold at a price the two of you agree. It comes off the seller's hull and onto the buyer's the moment the two of you shake hands, so the buyer needs an open slot, and a hull's ladder tops out at ${MAX_SHIP_LEVEL} slots at ship level ${MAX_SHIP_LEVEL}. The fee is paid when you shake hands. One listing per module a leg, one open offer per captain you name, and an offer nobody takes before the Parley closes is gone. | 装在船体上的模块，价钱两人自己谈。一握手，它就从卖家的船体转到买家手上，所以买家得留一个空位；而船体的阶梯到顶，就是船只等级{MAX_SHIP_LEVEL}的{MAX_SHIP_LEVEL}个仓位。费用在握手时付清。每航段每件模块挂一次，每位被你点名的船长各接一份点名报价，洽谈关门前没人接的报价就此作废。 |

**`src/components/portmasters/game/ObjectivePanel.tsx`** (1)

| English                                                   | Chinese                                        |
| --------------------------------------------------------- | ---------------------------------------------- |
| ${progress.delivered} of ${progress.required} handed over | 已交{progress.delivered} / {progress.required} |

**`src/components/portmasters/game/PrivateCard.tsx`** (1)

| English                                                                                                                        | Chinese                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| {peerTradeProfit} of {BROKER_PAYOUT_TARGET} Gold. Only trades with other captains count, and only the coin that moved in them. | 已达{peerTradeProfit}/{BROKER_PAYOUT_TARGET}金币。只计入与其他船长的交易，而且只算其中真正易手的金币。 |

**`src/components/portmasters/game/RefitBench.tsx`** (1)

| English                                                                                                                                                                                                                                                                                                                                                                                                       | Chinese                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clothes lose a point of wear every leg and two on a cold one. A ${SELLER_PATH.name} captain can put ${REFIT_POINTS} points back in a single leg for whatever fee the two of you agree, and anyone can take ${TAILOR_WORK} from the harbor tailors for ${MEND_GOLD_PER_POINT} Gold. One open offer per captain you name, one refit taken on a leg, and an offer nobody takes before the Market closes is gone. | 衣物每个航段掉一点耐久，冷天掉两点。{SELLER_PATH.name}船长可以在一个航段里补回{REFIT_POINTS}点，价钱两人自己谈；任何人都可以找港湾的裁缝做{TAILOR_WORK}，每点{MEND_GOLD_PER_POINT}金币。每位被你点名的船长各接一份点名报价，一个航段只能整补一次；开市关门前没人接的报价就此作废。 |

**`src/components/portmasters/game/RevealPanel.tsx`** (2)

| English                                       | Chinese                                     |
| --------------------------------------------- | ------------------------------------------- |
| ${total - visible} still to turn over         | 还有{total - visible}张没翻开               |
| ${captain.peerTradeProfit} Gold in peer trade | 船长间贸易进账{captain.peerTradeProfit}金币 |

**`src/components/portmasters/game/VoteTallyRows.tsx`** (6)

| English                                                                                                                                     | Chinese                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| No name is in yet. ${nameCount(census.needed)} on one captain ${census.needed === 1 ? "carries" : "carry"} it.                              | 还没有人署名：要一位船长身上凑够{nameCount(census.needed)}个名字才能通过。                   |
| ${leader.name} needs ${leader.short === 1 ? "1 more name" : \`${leader.short} more names\`} to carry it.                                    | {leader.name}还差{leader.short}个署名才能通过。                                              |
| Your name is in for ${captainName(members, myVote)}. Nothing else is asked of you this leg.                                                 | 你已把你的名字署给了{captainName(members, myVote)}。本航段不再要求你做什么。                 |
| {leader.name} has every name the vote needs.                                                                                                | {leader.name}已经凑齐了票上要的所有署名。                                                    |
| has ${nameCount(row.voters.length)}, from ${nameList(row.voters)}.                                                                          | 已有{nameCount(row.voters.length)}，来自{nameList(row.voters)}。                             |
| ${captainCount(waiting.length)} ${waiting.length === 1 ? "has" : "have"} not named anyone: ${nameList(waiting)}. ${nextStep(census.needed)} | {captainCount(waiting.length)}还没有指认他人：{nameList(waiting)}。{nextStep(census.needed)} |

**`src/components/portmasters/game/VoyageLogPanel.tsx`** (1)

| English                                                                                                                                                     | Chinese                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| ${entries.length} ${entries.length === 1 ? "line" : "lines"} in the harbor, ${privateLog.length} ${privateLog.length === 1 ? "line" : "lines"} to you alone | 港湾{entries.length}条，只发给你{privateLog.length}条 |

**`src/components/portmasters/game/phases/BenchCycle.tsx`** (1)

| English                                                                                                                                  | Chinese                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 💡 Materials consumed \<strong>now\</strong>. Finished goods and wage deductions happen at \<strong>{duePhase}\</strong>, not instantly. | 💡 原料\<strong>现在\</strong>就消耗。成品产出和工钱扣除发生在\<strong>{duePhase}\</strong>，不是立刻。 |

**`src/components/portmasters/game/phases/BenchPayroll.tsx`** (1)

| English                                    | Chinese                     |
| ------------------------------------------ | --------------------------- |
| 💰 Pending Payroll: Deducted at {duePhase} | 💰 待付工钱：{duePhase}扣除 |

**`src/components/portmasters/game/phases/EndgameResults.tsx`** (2)

| English                                                                                                                                    | Chinese                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Renown Level {BROKERS_FAVOR_UNLOCK_LEVEL} reached. Starting next voyage, call one in from the Trade Manifest to summon a guaranteed buyer. | 声望等级{BROKERS_FAVOR_UNLOCK_LEVEL}达成。从下趟航程起，可以在贸易舱单上动用一次人情，召来一位必定接手的买家。 |
| +${mine.xpGained} Renown XP this voyage${mine.leveledUp ? " · Renown level up!" : ""}                                                      | 本航程 +{mine.xpGained}声望经验{mine.leveledUp ? " · 声望升级！" : ""}                                         |

**`src/components/portmasters/game/phases/EndgameSummaries.tsx`** (2)

| English                                                                       | Chinese                               |
| ----------------------------------------------------------------------------- | ------------------------------------- |
| ${outstandingLent} loan${outstandingLent === 1 ? "" : "s"} still out          | 还有{outstandingLent}笔借款未收回     |
| ${outstandingBorrowed} loan${outstandingBorrowed === 1 ? "" : "s"} still owed | 还有{outstandingBorrowed}笔借款未还清 |

**`src/components/portmasters/game/phases/ModuleSwap.tsx`** (1)

| English                                                                                                                          | Chinese                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Replacing it would put your hull at ${powerAfterTaking(game, newMod, card)} power, and a hull carries at most ${HELD_POWER_CAP}. | 换上去会让船体达到{powerAfterTaking(game, newMod, card)}点力量，而船体最多承载{HELD_POWER_CAP}。 |

**`src/components/portmasters/game/phases/ModuleSynergy.tsx`** (6)

| English                                                                                                                                                                                       | Chinese                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Double Tax Strategy: ${cardName("smugglers_hold")} reduces purchase costs and ${cardName("tax_evasion")} halves both VAT and income tax. A powerful financial combo.                          | 双税战术：{cardName("smugglers_hold")}压低进价，{cardName("tax_evasion")}把市舶税和所得税一起减半。一套强力的财务组合。                  |
| Production Engine: ${cardName("artisans_workshop")} boosts worker output and ${cardName("salvage_crane")} refunds the freight on some orders. More goods, more Gold back.                     | 生产引擎：{cardName("artisans_workshop")}提升工匠产出，{cardName("salvage_crane")}退还部分委托的运费。货更多，金币回得更多。             |
| Intel Network: ${cardName("brokers_network")} discounts every whisper, and ${cardName("ocean_relay")} adds one more at no cost. Maximum market intelligence.                                  | 情报网：{cardName("brokers_network")}让每条掮客低语都打折，{cardName("ocean_relay")}再免费加一条。市场情报拉满。                         |
| Penalty Stack: ${cardName("overdrive_engine")} adds maintenance and ${cardName("bulk_hauler")} raises upgrade cost. Consider swapping one if funds are tight.                                 | 负担叠加：{cardName("overdrive_engine")}增加维护费，{cardName("bulk_hauler")}抬高升级成本。手头紧就考虑换掉一个。                        |
| Charter Combo: ${cardName("kiln_cellar")} discounts every bulk good, and ${cardName("bureau_token")} pays more on orders for the charter's own goods. Buy cheap, sell high.                   | 特许组合：{cardName("kiln_cellar")}让所有散货都降价，{cardName("bureau_token")}为特许自家货物的委托多付钱。低价买进，高价卖出。          |
| Exotic Trade: ${cardName("foreign_quarter_pass")} discounts every luxury good, and ${cardName("fleet_of_treasures")} takes Gold off freight on the same trade. Tier 2 goods at tier 0 prices. | 异域贸易：{cardName("foreign_quarter_pass")}让所有奢华货物都降价，{cardName("fleet_of_treasures")}在这类买卖上再削运费。二级货，零级价。 |

**`src/components/portmasters/game/phases/OrdersBoard.tsx`** (1)

| English                                                 | Chinese                                           |
| ------------------------------------------------------- | ------------------------------------------------- |
| 🧾 Est. VAT: ${totalVat} Gold (per unit shown on hover) | 🧾 预估市舶税：{totalVat}金币（单件明细悬停可见） |

**`src/components/portmasters/game/phases/OrdersFavor.tsx`** (4)

| English                                                                                                                                                                                                                                                                  | Chinese                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🔒 Broker's Favor unlocks at Renown Level ${BROKERS_FAVOR_UNLOCK_LEVEL}: call one in once per voyage to summon a guaranteed buyer for a good already in your hold. You are Renown Level ${game.renownLevel} now, ${BROKERS_FAVOR_UNLOCK_LEVEL - game.renownLevel} to go. | 🔒 掮客的人情在声望等级{BROKERS_FAVOR_UNLOCK_LEVEL}解锁：每程可唤一次，为货舱里已有的一件货，招来一位必定接手的买家。你现在的声望等级是{game.renownLevel}，还差{BROKERS_FAVOR_UNLOCK_LEVEL - game.renownLevel}级。 |
| No ${favorItem} left in your hold                                                                                                                                                                                                                                        | 货舱里没有{favorItem}了                                                                                                                                                                                            |
| How much ${favorItem} should the Broker sell?                                                                                                                                                                                                                            | 要让掮客卖出多少{favorItem}？                                                                                                                                                                                      |
| of ${favorHeld} in your hold                                                                                                                                                                                                                                             | ，货舱里共有{favorHeld}                                                                                                                                                                                            |

**`src/components/portmasters/game/phases/PathDraft.tsx`** (1)

| English                       | Chinese                 |
| ----------------------------- | ----------------------- |
| Your card is down. ${caption} | 你的牌已扣下。{caption} |

**`src/components/portmasters/game/phases/PirateAttack.tsx`** (3)

| English                                                                                                                                                                                                                      | Chinese                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before this round's bills come due, your ship has to clear open water. There is a ${raidPct}% chance pirates find you and take every coin in your hold. Hire an escort to sail through safely, or risk it and save the Gold. | 本轮账单到期之前，你的船得先闯过一片开阔水域。海盗有{raidPct}%的概率找上你，把你舱里的每一枚金币都拿走。雇一艘护航安然驶过，要么就冒这个险，把金币省下。 |
| 🛡️ {cover.sellerName} sold you this leg's cover. Their cannons beat off {Math.round(escortCoverage() * 100)}% of a boarding party, and their own hold answers for the rest.                                                  | 🛡️ {cover.sellerName}把本航段的护卫卖给了你。他们的炮口能挡下登船队{Math.round(escortCoverage() * 100)}%的攻势，挡不下的部分由他们自己的货舱担着。       |
| Escort costs ${escortFee} Gold but expected loss is ${Math.round(expectedLoss)} Gold. Hiring the escort saves Gold on average.                                                                                               | 雇护航要{escortFee}金币，预期损失却有{Math.round(expectedLoss)}金币。平均算下来，雇护航反而更省。                                                        |

**`src/components/portmasters/game/phases/PurchaseProvisions.tsx`** (3)

| English                                                                                           | Chinese                                                                          |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| An unnamed trader on the quay: ${bargePrice} Gold a ration against the port's ${RATION_PRICE}.    | 码头上的无名商贩：一份口粮{bargePrice}金币，港口的价是{RATION_PRICE}。           |
| a leg of rations costs ${legCost} Gold                                                            | 一航段的口粮要{legCost}金币                                                      |
| 🐟 Preserve ${batches * PRESERVE_MEALS_IN} Produce into ${batches * PRESERVE_MEALS_OUT} Salt Fish | 🐟 把{batches * PRESERVE_MEALS_IN}份时鲜腌成{batches * PRESERVE_MEALS_OUT}份咸鱼 |

**`src/components/portmasters/game/phases/SettlementAid.tsx`** (3)

| English                                                                                                                 | Chinese                                                                          |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Unpaid loans settle automatically at the end of Round ${maxRounds}, and the Gold goes to the lender.                    | 未还清的借款会在第{maxRounds}轮结束时自动结清，金币归债主。                      |
| A loan transfers instantly if someone helps. Repay it any time before the voyage ends. {loanSettleLine(game.maxRounds)} | 一有人出手，借款立刻到账。航程结束前随时可以还。{loanSettleLine(game.maxRounds)} |
| 🆘 Waiting for a captain to lend you ${myRequest.amount} Gold…                                                          | 🆘 等待船长借给你{myRequest.amount}金币...                                       |

**`src/components/portmasters/game/phases/Shipyard.tsx`** (3)

| English                                                                                                                      | Chinese                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Every module the yard could deal would pass this hull's ${HELD_POWER_CAP} power. Selling one at the Parley table makes room. | 船坞能给到的模块，每一件都超过这条船体{HELD_POWER_CAP}点的承载上限。到洽谈桌卖掉一件，就腾出了位置。 |
| 🚢 Ship Level: ${game.shipLevel} \| ⚓ Discount: ${game.shipLevel * SHIP_DISCOUNT_PER_LEVEL} Gold                            | 🚢 船只等级：{game.shipLevel}｜⚓ 折扣：{game.shipLevel * SHIP_DISCOUNT_PER_LEVEL}金币               |
| ⚓ Upgrade Ship (Lvl ${game.shipLevel + 1}), Cost ${upgCost} Gold \| +1 Slot, +${SHIP_DISCOUNT_PER_LEVEL} Discount           | ⚓ 升级船只（{game.shipLevel + 1}级），花费{upgCost}金币｜+1仓位，+{SHIP_DISCOUNT_PER_LEVEL}折扣     |

**`src/components/portmasters/game/phases/WardrobePanel.tsx`** (2)

| English                                                                                                                                                                  | Chinese                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 🧥 Wear ${good} (${game.inventory[good]} in the hold, ${GARMENTS[good].warmth} warmth)                                                                                   | 🧥 穿上{good}（货舱有{game.inventory[good]}，暖意{GARMENTS[good].warmth}）                                |
| A garment the sea has worn out becomes rags and is scrapped for ${RAG_SCRAP_VALUE} Gold. Frostbite costs the newest hand one leg of work rather than their place aboard. | 衣物被海磨破就成了碎布，拆掉换回{RAG_SCRAP_VALUE}金币。冻伤只让新来的水手歇一个航段的工，不会让他离开船。 |

**`src/components/portmasters/game/phases/Welcome.tsx`** (2)

| English                                                                      | Chinese                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------ |
| ${raidPct}% chance of losing all Gold on hand                                | 有{raidPct}%的概率丢掉手头所有的金币             |
| ⏳ Waiting for the host to start the voyage… (${harborIds.length} in harbor) | ⏳ 等待港主启航...（港湾里{harborIds.length}人） |

**`src/components/portmasters/game/phases/WorkerMgmt.tsx`** (1)

| English                                                             | Chinese                                      |
| ------------------------------------------------------------------- | -------------------------------------------- |
| 💰 Current Funds: {game.money} Gold \| 📦 See Inventory on the left | 💰 现有资金：{game.money}金币｜📦 存货见左侧 |

**`src/components/portmasters/game/status/ConvoyVentures.tsx`** (1)

| English                            | Chinese                   |
| ---------------------------------- | ------------------------- |
| You have backed {mine.amount} Gold | 你已跟投{mine.amount}金币 |

**`src/components/portmasters/game/status/PathChip.tsx`** (1)

| English                                                                                                                                                                                                                                  | Chinese                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Once a voyage, at a port in legs ${PATH_SWITCH_FROM_ROUND} through ${PATH_SWITCH_TO_ROUND}, for ${fee} Gold at your Renown. Unfulfilled pathbound orders are forfeited, and the whole fleet sees the change written into the voyage log. | 每程一次，可在第{PATH_SWITCH_FROM_ROUND}至{PATH_SWITCH_TO_ROUND}航段的港口改走商道，费用{fee}金币，按你的声望计算。未交付的商道委托一并作废，全船队都会在航程日志里看到你改道。 |

**`src/components/portmasters/lobby/HarborBoard.tsx`** (1)

| English                           | Chinese                       |
| --------------------------------- | ----------------------------- |
| Hosted by {room.host.displayName} | 由{room.host.displayName}主持 |

**`src/components/portmasters/lobby/LobbyDialogs.tsx`** (1)

| English                                                                                                                                     | Chinese                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| {RENOWN_BONUS_LINE}. It grows from the Reputation you bank across the voyage, so it only ever goes up, even for a captain whose books fail. | {RENOWN_BONUS_LINE}。它来自你在航程中存下的声誉，只会往上走，就算船长的账目崩了也一样。 |

**`src/components/portmasters/profile/MeritsShowcase.tsx`** (1)

| English                         | Chinese                     |
| ------------------------------- | --------------------------- |
| Merits ({meritIds.length} of 9) | 功勋（{meritIds.length}/9） |

**`src/components/portmasters/profile/VoyageTrends.tsx`** (1)

| English                                                                                        | Chinese                                     |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------- |
| {chronicles.length} recent voyage {chronicles.length === 1 ? "" : "s"} shown, oldest to newest | 显示最近{chronicles.length}次航程，由旧到新 |

**`src/components/portmasters/roster/PeekButton.tsx`** (1)

| English                                                                                                   | Chinese                                                                  |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Bands are read from {targetName}'s live snapshot. The Harbormaster only shares what your standing allows. | 各档数据读自{targetName}的实时快照。港务长只分享你的身份允许看到的部分。 |

**`src/lib/game/constants/copy.ts`** (37)

| English                                                                                                                                                                                                                                                                                       | Chinese                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| That offer belongs to an earlier leg.                                                                                                                                                                                                                                                         | 这个报价属于更早的航段。                                                                                                                                                                    |
| That offer has already gone.                                                                                                                                                                                                                                                                  | 这个报价已经没了。                                                                                                                                                                          |
| That offer was addressed to another captain.                                                                                                                                                                                                                                                  | 这个报价是写给另一位船长的。                                                                                                                                                                |
| That captain has already taken on a refit this leg.                                                                                                                                                                                                                                           | 那位船长本航段已经整补过了。                                                                                                                                                                |
| You are already covered for this leg.                                                                                                                                                                                                                                                         | 本航段你已经有护卫了。                                                                                                                                                                      |
| Not a member of that room                                                                                                                                                                                                                                                                     | 不是这个港湾的成员                                                                                                                                                                          |
| Pick two different items to barter.                                                                                                                                                                                                                                                           | 易货得选两样不同的物品。                                                                                                                                                                    |
| Each Renown level grants a small Gold bonus at the start of your next fresh voyage                                                                                                                                                                                                            | 每级声望都会在你下一次全新航程开局时，送上一小笔金币奖励                                                                                                                                    |
| That captain is not in this harbor.                                                                                                                                                                                                                                                           | 那位船长不在这个港湾。                                                                                                                                                                      |
| A fee is a whole number of Gold, at least ${CONSENT_FEE_MIN} and at most ${CONSENT_FEE_MAX}.                                                                                                                                                                                                  | 费用是整数金币，至少{CONSENT_FEE_MIN}，至多{CONSENT_FEE_MAX}。                                                                                                                              |
| A fee is paid at the handshake and you hold ${hold} Gold: this offer costs ${fee}.                                                                                                                                                                                                            | 费用在握手成交时付清，你手上有{hold}金币：这份报价要{fee}。                                                                                                                                 |
| An offer nobody takes before the Parley closes is gone.                                                                                                                                                                                                                                       | 洽谈关闭前无人接下的报价就作废了。                                                                                                                                                          |
| The escort costs a share of whatever you're carrying that round, so it's cheapest exactly when you have the least to protect.                                                                                                                                                                 | 护航费从你那一轮带的货里抽成，所以手头越没什么可护，它就越便宜。                                                                                                                            |
| The harbor is no longer counting your seat.                                                                                                                                                                                                                                                   | 港湾不再把你这个席位算进去了。                                                                                                                                                              |
| That captain is not one the harbor is still counting.                                                                                                                                                                                                                                         | 港湾已经不算那位船长了。                                                                                                                                                                    |
| This account is not an administrator.                                                                                                                                                                                                                                                         | 这个账户不是管理员。                                                                                                                                                                        |
| This account is no longer an administrator.                                                                                                                                                                                                                                                   | 这个账户已不再是管理员。                                                                                                                                                                    |
| There is a ${pct(first)} chance, rising to ${pct(second)} past the midpoint.                                                                                                                                                                                                                  | 有{pct(first)}的概率，过了中点升到{pct(second)}。                                                                                                                                           |
| 🏪 Market: Buying                                                                                                                                                                                                                                                                             | 🏪 开市：采购                                                                                                                                                                               |
| 🤝 Parley: Bartering                                                                                                                                                                                                                                                                          | 🤝 洽谈：易货                                                                                                                                                                               |
| 📜 On round${mandates.length === 1 ? "" : "s"} ${mandates.join(", ")} the Emperor commissions a \<strong>mandate\</strong>: one large order at a fixed reward, and the only order exempt from VAT. It often asks for more than a single hold carries, so plan to barter or borrow to fill it. | 📜 在第{mandates.join("、")}轮，皇帝会颁下一道\<strong>皇命\</strong>：一笔大额委托，报酬固定，而且是唯一免市舶税的委托。它要的货常常一个货舱装不下，所以提前打算好，靠易货或借货把它填满。 |
| In these waters a broker can be corrupt. The rumor you buy is still true and still arrives, always, but a corrupt one also leaks your position to the pirates. The log says so plainly when it happens, and the odds you see already include it.                                              | 在这片水域，掮客可能是通匪的。你买来的传闻依旧属实，也一定会送到；但通匪的掮客还会把你的位置泄露给海盗。事发时日志会直说，你看到的概率已经把这一层算进去了。                                |
| Save game state                                                                                                                                                                                                                                                                               | 保存游戏进度                                                                                                                                                                                |
| Next phase or continue                                                                                                                                                                                                                                                                        | 下一阶段或继续                                                                                                                                                                              |
| Open the full navigation guide                                                                                                                                                                                                                                                                | 打开完整导航指南                                                                                                                                                                            |
| Open this shortcut help                                                                                                                                                                                                                                                                       | 打开快捷键帮助                                                                                                                                                                              |
| Close this shortcut help                                                                                                                                                                                                                                                                      | 关闭快捷键帮助                                                                                                                                                                              |
| 🃏 The Path Draft: keep one card                                                                                                                                                                                                                                                              | 🃏 择道：留下一张                                                                                                                                                                           |
| ⚓ Welcome aboard                                                                                                                                                                                                                                                                             | ⚓ 欢迎登船                                                                                                                                                                                 |
| 🏆 What you're playing for                                                                                                                                                                                                                                                                    | 🏆 你在玩什么                                                                                                                                                                               |
| 🔄 How a round runs                                                                                                                                                                                                                                                                           | 🔄 一轮如何展开                                                                                                                                                                             |
| 📋 Orders: Filling trade orders                                                                                                                                                                                                                                                               | 📋 委托：交付贸易委托                                                                                                                                                                       |
| ⚠️ The artisan trap                                                                                                                                                                                                                                                                           | ⚠️ 工匠陷阱                                                                                                                                                                                 |
| 🏴‍☠️ Pirates at Resolve                                                                                                                                                                                                                                                                         | 🏴‍☠️ 结算时的海盗                                                                                                                                                                             |
| Resolve: Settlement                                                                                                                                                                                                                                                                           | 结算：清账                                                                                                                                                                                  |
| 🚢 You are ready                                                                                                                                                                                                                                                                              | 🚢 可以出发了                                                                                                                                                                               |
| • ${w?.label ?? id} (${w?.wage ?? 0} Gold/Round): Makes ${makes}                                                                                                                                                                                                                              | • {w?.label ?? id}（每轮{w?.wage ?? 0}金币）：产出{makes}                                                                                                                                   |

**`src/lib/game/constants/tags.ts`** (9)

| English                                                                                                                                                                             | Chinese                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| The goods that answer a cold leg, and the cards that speak of one: read against the wardrobe's own table, which is where a garment's warmth already lives.                          | 应付寒冷航段的货物，以及说到寒冷的卡牌：对照衣箱自己的那张表来读，每件衣服的暖意本来就写在那里。   |
| It loses its worth as it sits, a food turning in the hold or a good worth less than it was. A keeping is the clock this is read against, and the pantry is where the keepings live. | 放着不动就掉价：食物在舱里变质，货物不如从前值钱。它对着算的时钟是保鲜期，各种保鲜期都记在伙房里。 |
| It is kept: salted, dried, or otherwise made to outlast the voyage it was bought for.                                                                                               | 耐储：腌过、晒过，或者用别的办法，让它熬过当初买它要走的航程。                                     |
| Thread and the cloth made from it, the raw fibres included, because a fibre is cloth that has not been spun yet.                                                                    | 线和用线织成的布，生纤维也算在内，因为纤维是还没纺成布的布。                                       |
| The expensive end of the catalogue, where a slot carries far more Gold than the slot beside it.                                                                                     | 货目里贵的那一头：同样一格里装的金币，比旁边的格子多得多。                                         |
| Guns, the ships that carry them, and the contracts that hire them: anything bought to meet a raid.                                                                                  | 枪炮、载炮的船，以及雇佣它们的契约：一切为迎击劫掠而买的东西。                                     |
| Cargo that arrives accounted for: bonded, inspected, or closed against the air.                                                                                                     | 到岸就有账可查的货：保税、受检，或者密封不与空气相通。                                             |
| Trade done in the open and on the record, and the name it earns a captain.                                                                                                          | 摆在明面上、记在册子上的买卖，以及它给船长挣来的名声。                                             |
| An obligation carried rather than paid: a loan, a due, or a claim on Gold that has not been earned yet.                                                                             | 背着还没还清的义务：一笔借款、一笔欠款，或者一份对还没到手的金币的索取。                           |

**`src/lib/game/constants/tips.ts`** (3)

| English                                            | Chinese                                         |
| -------------------------------------------------- | ----------------------------------------------- |
| ⚓ Avoiding Bankruptcy Strategies:                 | ⚓ 避免破产的策略：                             |
| ⚓ Staying Afloat in ${play.badge}:                | ⚓ 在{play.badge}里稳住船身：                   |
| \n🛟 If the Bills Beat You:\n${play.failureRule}\n | \n🛟 账单要是先压垮了你：\n{play.failureRule}\n |

**`src/lib/game/dashboard.ts`** (73)

| English                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Chinese                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Barge revenue share of all food spending                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 驳船收入在全部食物开支中的占比                                                                                                                                                                                                                                                                                                                                                                                                                             |
| no leg report from a provisions harbor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 没有来自补给港的航段报告                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| no food bought in the window                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 窗口内没有购买食物                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| {ratePercent(barge / food)} of {food} Gold over {voyages} {voyages === 1 ? "voyage" : "voyages"}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | {ratePercent(barge / food)}：{food}金币开支，覆盖{voyages}次航程                                                                                                                                                                                                                                                                                                                                                                                           |
| no threshold in the plan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 计划未设门槛                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Lobbies that sailed without the Barge                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 未开驳船就起航的大厅                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Quartermaster fill                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 司库满员率                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Path pick rate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 商道选取率                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Free Captain pick rate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 自由船长选取率                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| The Quartermaster seat                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 司库席位                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Is the Quartermaster seat healthy?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 司库席位健康吗？                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| No reading yet: the seat's three readings are counts over an event the record carries and this page does not reduce. The Barge's own two numbers are read below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 暂无读数：这个席位的三项读数，数的是记录里已经带着的一个事件，本页还没有汇总它。驳船自己的两个数字在下面读。                                                                                                                                                                                                                                                                                                                                               |
| Three of the seat's readings are counts over an event the record already carries: the path each captain sailed is filed once per captain when the draft settles, with the seconds the table took to choose, and both the pick rate and the Quartermaster's share of the fleet are counted from it. The page does not reduce that event yet, so the three read as not measurable rather than as zeroes: a rate nobody computed is not a zero, and this is a reading to write rather than a source that is missing.                                                                                                                                                                                                                           | 司库席位的三项读数，数的是一个记录里本来就带的事件：抽取落定时，每位船长走的商道按人登记一次，连同牌桌挑牌花掉的秒数；商道选取率和司库在全船队中的占比，都从这个事件里数出来。本页还没有汇总它，所以这三项读作测不出来，而不是零：没人算过的比率不是零；这是还等着写的读数，不是缺了来源。                                                                                                                                                                 |
| The Barge's two numbers are read from the leg reports: each captain files the voyage's running food spending and Barge spending with the leg, and the page takes the report at their greatest leg rather than adding the legs up, because the figures are the voyage's totals and counting them per leg would count every purchase once per leg it survived. A voyage whose captains filed no such pair was not playing the provisions layer, and it is left out of the sample rather than counted as a lobby that avoided the vendor.                                                                                                                                                                                                      | 驳船的两个数字从航段报告里读：每位船长随航段登记本航程累计的食物开支与驳船开支。本页取各人最大航段的那份报告，不把各段相加：这些数字是整程的合计，按航段加起来，会把每笔购买在它活过的每个航段里重数一遍。没登记这对数字的航程，是没开给养层，直接从样本里去掉，不算躲开商贩的大厅。                                                                                                                                                                       |
| The top card's share of winning builds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 头名卡牌在获胜卡组中的占比                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| no card above 35%                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 没有卡牌超过35%                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| The top card pairing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 出现最多的卡牌组合                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| no pair above 62% over 40 appearances                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 出场超过40次的组合都没有超过62%                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Charter split deviation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 特许分化偏差                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| no charter taken in the window                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 窗口内没人选过特许                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| {splitTakes} {splitTakes === 1 ? "take" : "takes"}, none past the {CARD_CONVERSION_FLOOR} a path is read over                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | {splitTakes}次选取，都没到判定一条商道所需的{CARD_CONVERSION_FLOOR}次                                                                                                                                                                                                                                                                                                                                                                                      |
| {PATHS[widest.path].name}, {widest.points} points off even over {widest.takes} takes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | {PATHS[widest.path].name}，取了{widest.takes}次也偏出{widest.points}点                                                                                                                                                                                                                                                                                                                                                                                     |
| no deviation above 20%                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 偏差没有超过20%                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Distinct goods traded                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 交易过的不同货物数                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Bourse fills                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 交易所成交量                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Cover charter take rate, by alignment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 护卫特许选取率，按阵营                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Distinct goods a hold closes a leg carrying, median                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 收段时货舱携带的不同货物数，中位数                                                                                                                                                                                                                                                                                                                                                                                                                         |
| no leg report in the window                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 窗口内没有航段报告                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| {medianGoods} over {legReports.length} captain legs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | {medianGoods}，覆盖{legReports.length}个船长航段                                                                                                                                                                                                                                                                                                                                                                                                           |
| no gate yet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 还没有门槛                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Captain legs closing on one good or none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 只带一种货或空舱收段的船长航段                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Offer units posted, filled, expired                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 报价份数：挂出的、成交的、过期的                                                                                                                                                                                                                                                                                                                                                                                                                           |
| The staples                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 常备货                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Is anything becoming a staple?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 有货物正在变成常备货吗？                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| No gate yet: the card gates are Epic F's and the goods and Bourse gates are Epic G's, so four slots stand, and the charter gate has no path past its floor yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 还没有门槛：卡牌门槛归史诗 F，货物和交易所门槛归史诗 G，所以这四个位置先空着；特许门槛也还没有一条商道越过它的下限。                                                                                                                                                                                                                                                                                                                                       |
| The card gates are Epic F's and the goods and Bourse gates are Epic G's, so the four gates above are slots until those epics ship.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 卡牌门槛属于史诗 F，货物和交易所门槛属于史诗 G；那些史诗上线之前，上面四道门槛都是空位。                                                                                                                                                                                                                                                                                                                                                                   |
| The record keeps the count of goods a leg dealt and a hold closed with, never their names, so the share of goods traded the plan asks for has no source until an event carries the identity rather than the count.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 记录只留下一个航段经手、收段时的货物件数，从不记它们的名字；计划要的货物交易占比没处可读，除非哪天有事件带上身份，而不只是计数。                                                                                                                                                                                                                                                                                                                           |
| The two charter rows are the window's own takes, filed once per captain per voyage when the moment is answered at leg four. The split is read inside each path, because the plan's question is which of a path's two charters captains reach for, and a path is only judged once it holds the floor the card reader reads its own card statistics over; the value names the widest judged path, so the deviation it prints and the verdict over it are about the same path. The cover row is the plan's watch rather than a gate: a charter that only traitors take has stopped being cover, so the row reads how often the salvage charters were taken by each alignment, and it is left unjudged because the plan set no threshold on it. | 两行特许数据都是本窗口自己的选取，在第四航段回答的那一刻，按人、按航程各登记一次。分化在每条商道内部读，因为计划要问的是：一条商道上的两种特许，船长们会伸手去拿哪一种。一条商道要取够卡牌读数所依据的下限，才谈得上判定；显示的值取已判定商道中最宽的那条，所以印出的偏差和它上面的判定说的是同一条商道。护卫一行是计划的观察项，不是门槛：只有叛徒才拿的特许，已经不再是护卫，所以这一行数的是各阵营取打捞特许的频率。计划没有为它设阈值，也就不作判定。 |
| {roleCard(cell.alignment).title}, {cell.band} seats                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | {roleCard(cell.alignment).title}，{cell.band}席                                                                                                                                                                                                                                                                                                                                                                                                            |
| no voyage played                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 没有跑过的航程                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Swing across played bands, {roleCard(swing.alignment).title}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 已跑分段之间的波动，{roleCard(swing.alignment).title}                                                                                                                                                                                                                                                                                                                                                                                                      |
| no band played                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 没有跑过的分段                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| one played band at most                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 最多只有一个跑过的分段                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| The variance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 波动                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Is the variance too swingy?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 波动是不是太烈了？                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| No voyage in the window has a gate to read yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 窗口内的航程都还没有可读的门槛。                                                                                                                                                                                                                                                                                                                                                                                                                           |
| The swing has no threshold in the plan: its gate is that a rate does not move as the table grows, so the points beside each role are what moving would look like rather than a band to fail.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 计划没有为波动设阈值：它的门槛是比率不随牌桌人数增长而移动。每个角色旁边的点数，写的是移动起来会是什么样子，不是一条会不及格的区间。                                                                                                                                                                                                                                                                                                                       |
| Session length is measured from the moment the harbor was charted to the moment the voyage closed, which is the plan's lobby to reveal, and only over voyages that concluded at five seats: a wiped or emptied voyage stopped early and its clock is not a session.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 一局时长从开港那一刻量到收官那一刻，也就是计划说的从大厅到揭晓，而且只算五席收官的航程：清空或散场的航程提前停了，它那段时钟不算一局。                                                                                                                                                                                                                                                                                                                     |
| The lobby fill time has no threshold in the plan and is not one of the sixteen gates: it is read to decide whether six seats are worth supporting at all. When a session runs long the plan shortens the voyage before it shortens the phases, because the phases are where the conversation lives, and the knob for that is the mode's own voyageLegs (twelve for Ocean Gambit, the tier's ladder for Classic) rather than a round count written beside this row.                                                                                                                                                                                                                                                                          | 大厅凑人时间在计划里没有阈值，也不属于十六道门槛：读它是为了决定六席到底值不值得支持。一局拖长了，计划先缩短航程，再缩短阶段，因为阶段才是交谈所在的地方；那个旋钮是模式自己的 voyageLegs（暗潮十二段，经典为该档位的阶梯），不是写在这一行旁边的轮数。                                                                                                                                                                                                    |
| Median hold utilization                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 货舱利用率中位数                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| no leg report from a split hold                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 没有来自分舱的航段报告                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| {ratePercent(centre)}, median of {fills.length}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | {ratePercent(centre)}，{fills.length}次记录的中位数                                                                                                                                                                                                                                                                                                                                                                                                        |
| Marooned captains still standing at the close                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 收官时仍站着的被放逐船长                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| no maroon in the window                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 窗口内没有放逐                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Captains bankrupt at the reveal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 揭晓时破产的船长                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| no chronicle row in the window                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 窗口内没有实录条目                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Parley participation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 洽谈参与度                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| The floor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 下限                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| No voyage in the window has a gate to read yet: utilization needs a leg report from a harbor playing the split hold, and participation needs a talk line that names the phase.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 窗口内的航程都还没有可读的门槛：利用率要有开了分舱的港湾交出的航段报告，参与度要有一条写明阶段的谈话记录。                                                                                                                                                                                                                                                                                                                                                 |
| Hold utilization is read off the leg reports, and only off those whose voyage was playing the split hold: a leg filed by a harbor with the split switched off carries no slots and is not in the sample. Its denominator is the ship's two capacities at their full size, because the quarter a hungry crew costs the cargo is not something the report carries, so a captain on short rations reads against the hold they would have had.                                                                                                                                                                                                                                                                                                  | 货舱利用率从航段报告里读，而且只读开了分舱的航程：分舱关着的港湾登记的航段不带仓位，不进样本。分母取船只两项容量拉满时的规模，因为饥饿船员吃掉的那一舱报告里没有，所以吃减半口粮的船长，是拿他本应有的货舱来对照。                                                                                                                                                                                                                                         |
| Parley participation cannot be read off the record's talk line either, because that line carries the leg and not the phase, and talk is open through every phase of a leg: the record cannot separate Parley from the rest of the round.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 洽谈参与度也没法从记录的谈话行里读，因为那一行带的是航段，不是阶段；一个航段里每个阶段都能说话，记录分不出洽谈和这一轮里其余的时间。                                                                                                                                                                                                                                                                                                                       |
| Retention is read over the voyages that closed with somebody standing, at the resolution the record has, which is presence at the close rather than the length of one connection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 留存只在收官时还站着人的航程上读，精度取记录能达到的程度：看的是收官时在不在场，不是某一条连接撑了多久。                                                                                                                                                                                                                                                                                                                                                   |
| Session length at five captains, charted to reveal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 五人对局的时长，从开港到揭晓                                                                                                                                                                                                                                                                                                                                                                                                                               |
| no concluded voyage at five                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 没有五席收官的航程                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| {whole} min, median of {minutes.length}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | {whole}分钟，{minutes.length}次记录的中位数                                                                                                                                                                                                                                                                                                                                                                                                                |
| Lobby fill time by table size, charted to set sail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 按牌桌人数的大厅凑人时间，从开港到起航                                                                                                                                                                                                                                                                                                                                                                                                                     |
| no voyage in the window                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 窗口内没有航程                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| {band.label} seats none in the window                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | {band.label}席：窗口内没有                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| {band.label} seats {Math.round(band.centre)} min of {band.count}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | {band.label}席：{Math.round(band.centre)}分钟，{band.count}次                                                                                                                                                                                                                                                                                                                                                                                              |
| Voyages that stopped before the reveal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 在揭晓前停下的航程                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Every gate this window can read sits inside it, {readable.length} of {gated.length}.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 窗口里可读的每一道门槛都在区间内，{readable.length}/{gated.length}。                                                                                                                                                                                                                                                                                                                                                                                       |
| {sharePercent(thinLegs, legReports.length)} over {legReports.length} captain legs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | {sharePercent(thinLegs, legReports.length)}，覆盖{legReports.length}个船长航段                                                                                                                                                                                                                                                                                                                                                                             |
| ${stopped.length} of ${records.length}, stopping at leg ${Math.round(centre)} on the median                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | {stopped.length}/{records.length}，按中位数停在第{Math.round(centre)}航段                                                                                                                                                                                                                                                                                                                                                                                  |

**`src/lib/game/engine/aid.ts`** (2)

| English                                                                            | Chinese                                                              |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| ❌ Need ${debt.amount} Gold to repay ${debt.counterpartyName}, have ${state.money} | ❌ 还{debt.counterpartyName}{debt.amount}金币，手上只有{state.money} |
| 🤝 Your bequest was paid out to ${redirectedToName}                                | 🤝 你留下的遗赠已付给{redirectedToName}                              |

**`src/lib/game/engine/backingState.ts`** (2)

| English                                                                                                             | Chinese                                                                               |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 🛡️ Your backing fully covered a captain's shortfall: all ${calledAmount} Gold pledged was spent helping the lender. | 🛡️ 你的作保全额补上了一位船长的缺口：质押的{calledAmount}金币全部花在了替债主兜底上。 |
| 🛡️ ${backerName} covered ${amount} Gold of ${borrowerName}'s shortfall as a backer.                                 | 🛡️ {backerName}作保，替{borrowerName}补上了缺口里的{amount}金币。                     |

**`src/lib/game/engine/bazaar.ts`** (1)

| English                                                                                             | Chinese                                                                                  |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| ${rumorCooldownLine(left)} You spoke in leg ${spoke}, so the bazaar hears you again at leg ${next}. | {rumorCooldownLine(left)}你是在第{spoke}航段开的口，所以香市要到第{next}航段才重新听你。 |

**`src/lib/game/engine/boons.ts`** (2)

| English                                                                                                      | Chinese                                                                                 |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 🧭 Boon Locked In: ${cardLead(card.id)}                                                                      | 🧭 机缘已锁定：{cardLead(card.id)}                                                      |
| ❌ ${cardName(card.id)} would put your hull at ${total} power, and a hull carries at most ${HELD_POWER_CAP}. | ❌ {cardName(card.id)}会让你的船体达到{total}点力量，而船体最多承载{HELD_POWER_CAP}点。 |

**`src/lib/game/engine/charters.ts`** (1)

| English                                                   | Chinese                                             |
| --------------------------------------------------------- | --------------------------------------------------- |
| ${CHARTER_MOMENT.icon} Your charter: ${cardLead(card.id)} | {CHARTER_MOMENT.icon} 你的特许：{cardLead(card.id)} |

**`src/lib/game/engine/chronicle.ts`** (13)

| English                                                                                                       | Chinese                                                                           |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| ${input.displayName} took the crown sailing ${waters} and came home with ${input.finalReputation} Reputation. | {input.displayName}在{waters}中夺下王冠，带着{input.finalReputation}点声誉归来。  |
| ${input.displayName} was put ashore by a vote of the harbor and sailed ${waters} without a ship.              | 港湾投票把{input.displayName}放逐上岸，此后无船在身，依然在{waters}中走完了航程。 |
| ${input.displayName} sailed ${waters}, went bankrupt, and finished the voyage.                                | {input.displayName}在{waters}中跑了一程，中途破产，仍走完了航程。                 |
| ${input.displayName} sailed ${waters} and came home with ${input.finalReputation} Reputation.                 | {input.displayName}在{waters}中跑了一程，带着{input.finalReputation}点声誉归来。  |
| Peak Reputation hit ${input.peakReputation}.                                                                  | 巅峰声誉达到{input.peakReputation}。                                              |
| The largest single trade paid ${input.largestTrade} Gold.                                                     | 最大的一笔单次交易进账{input.largestTrade}金币。                                  |
| ${input.displayName} lent once                                                                                | {input.displayName}借出过一次                                                     |
| ${input.displayName} lent ${input.lendCount} times                                                            | {input.displayName}借出过{input.lendCount}次                                      |
| borrowed ${input.borrowCount} times                                                                           | 借入过{input.borrowCount}次                                                       |
| The crown went home with ${input.displayName}.                                                                | 王冠跟着{input.displayName}回了家。                                               |
| The harbor voted to put ${input.displayName} ashore, and the voyage went on without a ship under them.        | 港湾投票把{input.displayName}放逐上岸，此后的航程，他们身下再没有船。             |
| The voyage ended in bankruptcy before ${input.displayName} could finish.                                      | 航程没等{input.displayName}走完，就先破产收场了。                                 |
| The harbor closed the books at ${input.merchantRating}.                                                       | 港湾合上账本时，商人评级停在{input.merchantRating}。                              |

**`src/lib/game/engine/draft.ts`** (2)

| English                                                                                                                      | Chinese                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 🧭 You set aside the ${pathConfig(from)!.name} path and took up the ${pathConfig(to)!.name}. The harbor charges ${fee} Gold. | 🧭 你放下{pathConfig(from)!.name}之道，改走{pathConfig(to)!.name}。港湾收取{fee}金币。 |
| Papers are changed at the port, in ${pathSwitchPortsList()}.                                                                 | 换文书要回港办理，在{pathSwitchPortsList()}。                                          |

**`src/lib/game/engine/lifecycle.ts`** (5)

| English                                                             | Chinese                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| \n📊=== Round ${state.currentRound} Settlement ===                  | \n📊=== 第{state.currentRound}轮 · 结算 ===             |
| 🔧 Maintenance: ${state.maintenanceCosts} Gold                      | 🔧 维护费：{state.maintenanceCosts}金币                 |
| \n🔧=== Round ${state.currentRound} · Resolve: Ship Maintenance === | \n🔧=== 第{state.currentRound}轮 · 结算：船只维护 ===   |
| \n🚢=== Round ${state.currentRound} · Dusk: Shipyard & Modules ===  | \n🚢=== 第{state.currentRound}轮 · 暮色：船坞与模块 === |
| 🧾 Total Taxes Paid: ${state.vatPaid + state.incomeTaxPaid} Gold    | 🧾 税费总计：{state.vatPaid + state.incomeTaxPaid}金币  |

**`src/lib/game/engine/market.ts`** (2)

| English                                                                       | Chinese                                                          |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| ${cardLead("farsight")}: 'Word from ${port}: High demand for ${item}!' (free) | {cardLead("farsight")}：『{port}的消息：{item}正抢手！』（免费） |
| \n⚓=== Round ${state.currentRound} · Market: Port Purchase ===               | \n⚓=== 第{state.currentRound}轮 · 开市：港口采购 ===            |

**`src/lib/game/engine/modules.ts`** (2)

| English                                                                                | Chinese                                                                       |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 🔧 ${name} leaves your hull for ${trade.buyerName ?? "a captain"}.                     | 🔧 {name}从你的船体上卸下，转给了{trade.buyerName ?? "一位船长"}。            |
| 🤝 Module trade: ${trade.buyerName ?? "A captain"} paid ${trade.fee} Gold for ${name}. | 🤝 模块交易：{trade.buyerName ?? "有一位船长"}花{trade.fee}金币买下了{name}。 |

**`src/lib/game/engine/orders.ts`** (6)

| English                                                                                                                                                  | Chinese                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| ${cardLead("fleet_of_treasures")}: ${luxuryItems * 3}g off freight                                                                                       | {cardLead("fleet_of_treasures")}：运费减{luxuryItems * 3}金币                                                     |
| 🚨 AUDIT! ${cardLead("tax_evasion")} triggered. Lost 20 Gold!                                                                                            | 🚨 稽查！{cardLead("tax_evasion")}触发。损失20金币！                                                              |
| 📊 Completed ${state.orderCount} transactions                                                                                                            | 📊 已完成{state.orderCount}笔交易                                                                                 |
| 🤝 Broker's Favor called in: a buyer at ${order.demandPort} now wants ${txt}. The bigger the ask, the bigger the Broker's cut.                           | 🤝 掮客的人情已兑现：{order.demandPort}的一位买家现在要{txt}。要得越多，掮客的抽成越大。                          |
| 🕵️ That broker was corrupt. The word is good, but your position leaked: raid risk is up ${Math.round(cfg.brokerCorruptionRisk * 100)} points this round. | 🕵️ 那个掮客通匪。消息是真的，但你的位置泄露了：本轮的劫掠风险上升{Math.round(cfg.brokerCorruptionRisk * 100)}点。 |
| \n🤝=== Round ${state.currentRound} · Orders: Trade Transaction ===                                                                                      | \n🤝=== 第{state.currentRound}轮 · 委托：贸易交易 ===                                                             |

**`src/lib/game/engine/pirates.ts`** (2)

| English                                                                                                                                        | Chinese                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 🛡️ Pirates closed on your hold and met ${cover.sellerName}'s guns. All ${raidGold} Gold saved, and the boarding party is theirs to answer for. | 🛡️ 海盗逼近货舱，撞上了{cover.sellerName}的炮口。{raidGold}金币分文未失，登船队由他们自己去应付。 |
| 🛡️ Pirates boarded and found the hold already bare. ${cover.sellerName}'s escort turned them away for nothing.                                 | 🛡️ 海盗登船，发现货舱早已空空。{cover.sellerName}的护卫挡回了他们，却什么也没护着。               |

**`src/lib/game/engine/pricing.ts`** (4)

| English                                                                             | Chinese                                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Ship Level ${state.shipLevel} discount                                              | 船只等级{state.shipLevel}的折扣                                                 |
| ${boonNameForModifierKey("hemp_price_reduction")} (down ${hempReduction}g per unit) | {boonNameForModifierKey("hemp_price_reduction")}（每单位降{hempReduction}金币） |
| ${cardName("kiln_cellar")} module (down ${KILN_CELLAR_PER_UNIT}g per unit)          | {cardName("kiln_cellar")}模块（每单位降{KILN_CELLAR_PER_UNIT}金币）             |
| ${cardName("smugglers_hold")} module (down 15%)                                     | {cardName("smugglers_hold")}模块（降价15%）                                     |

**`src/lib/game/engine/standing.ts`** (1)

| English                                                                            | Chinese                                              |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 🪧 Standing orders at the shipyard: upgraded the hull to level ${state.shipLevel}. | 🪧 船坞的常备委托：把船体升到了{state.shipLevel}级。 |

**`src/lib/game/garments.ts`** (13)

| English                                                                                                                                 | Chinese                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| ❌ That is not something the crew can wear.                                                                                             | ❌ 这不是船员能穿在身上的东西。                                                                                  |
| ❌ There is nobody aboard to wear it.                                                                                                   | ❌ 船上没有人能穿它。                                                                                            |
| ❌ The crew can wear no more than they already have on.                                                                                 | ❌ 船员身上能穿的，就这些了。                                                                                    |
| ❌ No ${good} in the hold to wear.                                                                                                      | ❌ 货舱里没有{good}可穿。                                                                                        |
| ❌ The crew already meets this cold leg. Clothes put on for nothing still wear, so the rest stay in the hold until a leg asks for them. | ❌ 船员们已经扛得住这个寒冷航段了。白穿上的衣服照样会磨损，剩下的留在货舱里，等哪个航段真要了再拿出来。          |
| ❌ The sea is mild this leg and asks for no warmth. Clothes put on now would wear from today, so the hold keeps them for a cold leg.    | ❌ 本航段海上温和，用不上暖意。现在穿上就要从今天开始磨损，所以货舱把它们留给寒冷航段。                          |
| 🧥 The crew puts on the ${good}. Warmth ${spec.warmth} while it lasts.                                                                  | 🧥 船员穿上了{good}。暖意{spec.warmth}，穿多久算多久。                                                           |
| 🧵 The ${good} comes back to ${after} of ${spec.durability}, worth ${warmthText(garmentWarmth({ good, durability: after }))} of warmth. | 🧵 {good}的耐久回到{after}/{spec.durability}，折合{warmthText(garmentWarmth({ good, durability: after }))}暖意。 |
| \n🧥=== Round ${state.currentRound} · The Cold and the Cloth ===                                                                        | \n🧥=== 第{state.currentRound}轮 · 严寒与衣着 ===                                                                |
| ❄️ A cold leg, and the crew's ${warmthText(score)} of warmth falls short of the ${COLD_LEG_WARMTH} it asks.                             | ❄️ 寒冷航段，船员的{warmthText(score)}暖意不够它要的{COLD_LEG_WARMTH}。                                          |
| 🌊 The ${garment.good} wears through to rags and is scrapped for ${RAG_SCRAP_VALUE} Gold.                                               | 🌊 {garment.good}磨成了碎布，拆掉换回{RAG_SCRAP_VALUE}金币。                                                     |
| 🧵 Worn clothes lose ${step} point of wear to the sea.                                                                                  | 🧵 海风从穿着的衣服上耗去{step}点耐久。                                                                          |
| 🥶 There is nobody aboard to take the cold.                                                                                             | 🥶 船上没有人能承受这份严寒。                                                                                    |

**`src/lib/game/gates.ts`** (26)

| English                                                                                                                                                                                                                                                                                              | Chinese                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| {gates.length - notInBand.length} of {gates.length} gates inside {gates.length - notInBand.length === 1 ? "its band" : "their bands"}                                                                                                                                                                | {gates.length - notInBand.length}/{gates.length}道门槛在区间内                                                                                                 |
| {failing.length} out of band                                                                                                                                                                                                                                                                         | {failing.length}项出界                                                                                                                                         |
| {unmeasured.length} with no source                                                                                                                                                                                                                                                                   | {unmeasured.length}项无来源                                                                                                                                    |
| {unplayed.length} with no voyage to read                                                                                                                                                                                                                                                             | {unplayed.length}项无航程可读                                                                                                                                  |
| {ungated.length} answering a reading with no threshold                                                                                                                                                                                                                                               | {ungated.length}项对应的读数没有阈值                                                                                                                           |
| the run stands at {voyages} of {LAUNCH_MINIMUM_VOYAGES} recorded voyages                                                                                                                                                                                                                             | 目前有{voyages}/{LAUNCH_MINIMUM_VOYAGES}程已记录航程                                                                                                           |
| The run stands at {voyages} of {LAUNCH_MINIMUM_VOYAGES} recorded voyages, and a gate read over fewer than {LAUNCH_MINIMUM_VOYAGES} is a reading rather than evidence.                                                                                                                                | 目前只有{voyages}/{LAUNCH_MINIMUM_VOYAGES}程已记录航程，低于{LAUNCH_MINIMUM_VOYAGES}程读出的门槛只是读数，还不算证据。                                         |
| the window was recorded at a sample rate of {samplePercent}%, so it is a sample of the run rather than the run                                                                                                                                                                                       | 窗口按{samplePercent}%的采样率记录，读到的是样本，不是全量                                                                                                     |
| The window was recorded at a sample rate of {samplePercent}%, so these are readings of a sample of the run rather than of the run.                                                                                                                                                                   | 这个窗口按{samplePercent}%的采样率记录，所以这些读数来自样本，不是全量。                                                                                       |
| {unmeasured.length} of the {gates.length} gates {unmeasured.length === 1 ? "has" : "have"} no source yet                                                                                                                                                                                             | {gates.length}道门槛中有{unmeasured.length}道还没有来源                                                                                                        |
| {unmeasured.length} of the {gates.length} gates {unmeasured.length === 1 ? "has" : "have"} no source: {names(unmeasured)}. {unmeasured.length === 1 ? "It waits" : "They wait"} on the systems that would produce them, and the plan does not ship a mode on the gates that happen to be measurable. | {gates.length}道门槛中有{unmeasured.length}道还没有来源：{names(unmeasured)}。它们要等能产出数据的系统上线；计划不会靠碰巧可测量的那几道门槛来给一个模式放行。 |
| {unplayed.length} of the {gates.length} gates {unplayed.length === 1 ? "has" : "have"} no voyage to read                                                                                                                                                                                             | {gates.length}道门槛中有{unplayed.length}道没有航程可读                                                                                                        |
| {unplayed.length} of the {gates.length} gates {unplayed.length === 1 ? "has" : "have"} no voyage to read: {names(unplayed)}.                                                                                                                                                                         | {gates.length}道门槛中有{unplayed.length}道没有航程可读：{names(unplayed)}。                                                                                   |
| the window holds {unreadable} {unreadable === 1 ? "record" : "records"} that could not be read                                                                                                                                                                                                       | 窗口里有{unreadable}条记录读不出来                                                                                                                             |
| The window holds {unreadable} {unreadable === 1 ? "record" : "records"} that could not be read, so it is that much smaller than the run it was taken from.                                                                                                                                           | 窗口里有{unreadable}条记录读不出来，比它抽自的那批数据就小了这么多。                                                                                           |
| the window holds {truncated} {truncated === 1 ? "record" : "records"} that hit the event cap                                                                                                                                                                                                         | 窗口里有{truncated}条记录触及事件上限                                                                                                                          |
| The window holds {truncated} {truncated === 1 ? "record" : "records"} that hit the event cap, so some of what happened in those voyages was never kept and the gates read over them are floors rather than readings.                                                                                 | 窗口里有{truncated}条记录触及事件上限，这些航程里发生的事，有一部分没能留下；靠它们读出的门槛只是下限，不算读数。                                              |
| {ungated.length} of the {gates.length} gates answer a reading the plan set no threshold on                                                                                                                                                                                                           | {gates.length}道门槛中有{ungated.length}道对应的读数计划没有设阈值                                                                                             |
| {ungated.length} of the {gates.length} gates answer readings the plan set no threshold on: {names(ungated)}. That is a contradiction in the page rather than a reading, and it is named here rather than passed over.                                                                                | {gates.length}道门槛中有{ungated.length}道对应的读数计划没有设阈值：{names(ungated)}。这是页面自身的矛盾，不是读数；就在这里点出来，不放过去。                 |
| {failing.length} {failing.length === 1 ? "gate sits" : "gates sit"} outside {failing.length === 1 ? "its" : "their"} band: {lines(failing)}.                                                                                                                                                         | {failing.length}道门槛在区间之外：{lines(failing)}。                                                                                                           |
| Clear to ship: all {total} gates sit inside their bands over {voyages} recorded voyages.                                                                                                                                                                                                             | 可放行：全部{total}道门槛都在各自区间内，覆盖{voyages}程已记录航程。                                                                                           |
| Held by {failing.length} of {total} gates: {lines(failing)}.                                                                                                                                                                                                                                         | 暂缓：{total}道门槛中有{failing.length}道未过：{lines(failing)}。                                                                                              |
| {head} {untradeable.line.label} is the plan's own priority and cannot be traded against the others.                                                                                                                                                                                                  | {head} {untradeable.line.label}是计划自己的优先级，不能拿去和其余门槛做交换。                                                                                  |
| No verdict yet: the reading leaves gates to read.                                                                                                                                                                                                                                                    | 尚无判定：这次读数还有门槛可读。                                                                                                                               |
| No verdict yet: {first.short}.                                                                                                                                                                                                                                                                       | 尚无判定：{first.short}。                                                                                                                                      |
| {gate.line.label}, {gate.line.value} against {gate.line.target}                                                                                                                                                                                                                                      | {gate.line.label}：{gate.line.value}，对照{gate.line.target}                                                                                                   |

**`src/lib/game/merits.ts`** (2)

| English                                                     | Chinese                                     |
| ----------------------------------------------------------- | ------------------------------------------- |
| Reach Renown Level ${topTitle.minLevel}.                    | 达到声望等级{topTitle.minLevel}。           |
| Finish an ${openWaters.name} voyage without going bankrupt. | 完成一程{openWaters.name}航程，且没有破产。 |

**`src/lib/game/tags.ts`** (1)

| English                                                                                                                                                 | Chinese                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| "${kept.id}" is preserved and keeps ${keptLegs} legs while "${turning.id}" is perishable and keeps ${turningLegs}, so the tag and the keeping disagree. | “{kept.id}”是耐储货，能存{keptLegs}个航段；而“{turning.id}”是易腐货，只存{turningLegs}个，标签和保鲜期对不上。 |

**`src/lib/game/voyage-log.ts`** (7)

| English                                                                                             | Chinese                                                                                 |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| The harbor weighs anchor for the ${phaseFace(facts.phase).label}.                                   | 港湾起锚，进入{phaseFace(facts.phase).label}。                                          |
| ${facts.captain}'s offer of ${facts.offerAmount} ${facts.offerItem} lapses with the leg.            | 本航段一结束，{facts.captain}挂出的{facts.offerAmount}份{facts.offerItem}报价就作废了。 |
| The tide runs out on the ${phaseFace(facts.phase).label}.                                           | 潮水在{phaseFace(facts.phase).label}退去。                                              |
| ${facts.captain} takes up the ${pathConfig(facts.path)!.name} path.                                 | {facts.captain}走上了{pathConfig(facts.path)!.name}之道。                               |
| ${facts.captain} sets aside their old papers and takes up the ${pathConfig(facts.path)!.name} path. | {facts.captain}收起旧文书，改走{pathConfig(facts.path)!.name}之道。                     |
| ${facts.captain} offers ${cardName(facts.module)} for ${facts.fee} Gold.                            | {facts.captain}挂出{cardName(facts.module)}，要价{facts.fee}金币。                      |
| ${facts.taker} buys ${cardName(facts.module)} from ${facts.captain} for ${facts.fee} Gold.          | {facts.taker}以{facts.fee}金币从{facts.captain}手上买下{cardName(facts.module)}。       |

**`src/lib/use-phase-sync.ts`** (1)

| English                                                                                  | Chinese                                         |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------- |
| ${readyCount} of ${requiredCount} captains ${readyCount === 1 ? "has" : "have"} readied. | {requiredCount}位船长里已有{readyCount}位就绪。 |

**`src/server/realtime/admin.ts`** (5)

| English                                       | Chinese                             |
| --------------------------------------------- | ----------------------------------- |
| {account} is already banned.                  | {account}已经封停了。               |
| {account} is not banned.                      | {account}没有封停。                 |
| {account} is already an administrator.        | {account}已经是管理员。             |
| {account} is banned. Unban the account first. | {account}已经封停了。先解封该账户。 |
| {account} is not an administrator.            | {account}不是管理员。               |

**`src/server/realtime/audit.ts`** (1)

| English                                   | Chinese                            |
| ----------------------------------------- | ---------------------------------- |
| The audit opens from leg ${gate.opensAt}. | 稽查从第{gate.opensAt}航段起开放。 |

**`src/server/realtime/conclusion/finishers.ts`** (2)

| English                                                                                                             | Chinese                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| ${f.user.displayName} reached Renown Level ${rows.outcome.newLevel}: ${renownTitleForLevel(rows.outcome.newLevel)}! | {f.user.displayName}达到了声望等级{rows.outcome.newLevel}：{renownTitleForLevel(rows.outcome.newLevel)}！ |
| ${f.user.displayName} earned the Captain's Merit: ${merit.name}!                                                    | {f.user.displayName}赢得了船长功勋：{merit.name}！                                                        |

**`src/server/realtime/maroon.ts`** (2)

| English                                                              | Chinese                                            |
| -------------------------------------------------------------------- | -------------------------------------------------- |
| The maroon vote opens from leg ${facts.maroonFrom}.                  | 放逐投票从第{facts.maroonFrom}航段起开放。         |
| The Harbormaster's hand is not dealt before leg ${facts.maroonFrom}. | 第{facts.maroonFrom}航段之前，港务长之权还不发放。 |

**`src/server/realtime/presence.ts`** (1)

| English                           | Chinese                     |
| --------------------------------- | --------------------------- |
| ${displayName}'s voyage has ended | {displayName}的航程已经结束 |

**`src/server/realtime/wiring/consent-shared.ts`** (1)

| English                                              | Chinese                             |
| ---------------------------------------------------- | ----------------------------------- |
| You already have an offer standing for ${buyerName}. | 你已经为{buyerName}挂着一份报价了。 |

**`src/server/realtime/wiring/disconnect.ts`** (1)

| English                               | Chinese                    |
| ------------------------------------- | -------------------------- |
| ${s.user.displayName} has gone ashore | {s.user.displayName}上岸了 |

**`src/server/realtime/wiring/docks.ts`** (1)

| English                                                                                                                                                                      | Chinese                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Word on the Docks: ${s.user.displayName} was first to complete ${WORD_ON_THE_DOCKS_THRESHOLD} trade orders this voyage, and pockets ${WORD_ON_THE_DOCKS_REWARD} Gold for it. | 码头风闻：{s.user.displayName}在本航程率先完成了{WORD_ON_THE_DOCKS_THRESHOLD}笔委托，把这{WORD_ON_THE_DOCKS_REWARD}金币装进了口袋。 |

**`src/server/realtime/wiring/room-join.ts`** (2)

| English                                         | Chinese                                |
| ----------------------------------------------- | -------------------------------------- |
| ${s.user.displayName} set sail for another port | {s.user.displayName}起航去了另一个港口 |
| ${s.user.displayName} entered the harbor        | {s.user.displayName}进了港湾           |

**`src/server/realtime/wiring/ventures.ts`** (2)

| English                                                                               | Chinese                                                               |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Deadline must be between round ${minRound} and round ${maxRound}.                     | 截止轮次得在第{minRound}轮到第{maxRound}轮之间。                      |
| ${input.displayName} sailed ${waters} and ran out of Gold before the voyage was done. | {input.displayName}在{waters}中跑了一程，中途金币耗尽，没能走完航程。 |

## The mapping file, complete

One JSON file at `src/lib/game/i18n/zh.json`. The tables above carry the reasoning; the block below is the artifact itself, every term one per line, English beside Chinese. It now closes with the `sentences` group: all 1,816 lines from the sentence tables, keyed by sweep and number, in the same order those tables read. It is kept in step with the tables at every revision, and when you approve the last row it lifts into the repo as the file.

```json
{
  "$meta": {
    "game": "PortMasters 2.2 Parallel Release",
    "feature": "Bilingual Harbor",
    "source": "en",
    "target": "zh",
    "version": 2,
    "notes": "Braced tokens like {n} stand for runtime values. A phase without a short entry uses its label. Crew plurals (Weavers, Masters) collapse into the single Chinese form. The sentences group adds every remaining captain facing line, keyed by sweep and number in the same order the sentence tables read. Tokens there take their final names from source when the file lifts into the repo."
  },

  "terms": {
    "term.gold": { "en": "Gold", "zh": "金币" },
    "term.captain": { "en": "Captain", "zh": "船长" },
    "term.harbor": { "en": "Harbor (the room)", "zh": "港湾" },
    "term.port": { "en": "Port", "zh": "港" },
    "term.host": { "en": "Host", "zh": "港主" },
    "term.seat": { "en": "Seat", "zh": "席位" },
    "term.renown": { "en": "Renown", "zh": "声望" },
    "term.reputation": { "en": "Reputation", "zh": "声誉" },
    "term.score": { "en": "Score", "zh": "积分" },
    "term.legacy": { "en": "Captain's Legacy", "zh": "船长传承" },
    "term.merits": { "en": "Merits", "zh": "功勋" },
    "term.sea_master": { "en": "Sea Master", "zh": "沧海之主" },
    "term.sea_master_crowns": { "en": "Sea Master crowns", "zh": "沧海之冠" },
    "term.voyage": { "en": "Voyage", "zh": "航程" },
    "term.round": { "en": "Round", "zh": "轮" },
    "term.leg": { "en": "Leg", "zh": "航段" },
    "term.order": { "en": "Trade order", "zh": "委托" },
    "term.locked_order": { "en": "Locked order", "zh": "专属委托" },
    "term.manifest": { "en": "Manifest", "zh": "舱单" },
    "term.path": { "en": "Path", "zh": "商道" },
    "term.boon": { "en": "Boon (card kind)", "zh": "机缘" },
    "term.module": { "en": "Module (card kind)", "zh": "模块" },
    "term.charter": { "en": "Charter (card kind)", "zh": "特许状" },
    "term.draft": { "en": "To draft (a card)", "zh": "抽取" },
    "term.hold": { "en": "Hold", "zh": "货舱" },
    "term.cargo": { "en": "Cargo", "zh": "货物" },
    "term.stores": { "en": "Stores", "zh": "存粮" },
    "term.larder": { "en": "Larder", "zh": "粮舱" },
    "term.pantry": { "en": "Pantry", "zh": "伙房" },
    "term.rations": { "en": "Rations", "zh": "口粮" },
    "term.slot": { "en": "Cargo slot", "zh": "仓位" },
    "term.freight": { "en": "Freight", "zh": "运费" },
    "term.maintenance": { "en": "Ship maintenance", "zh": "维护费" },
    "term.wages": { "en": "Wages", "zh": "工钱" },
    "term.severance": { "en": "Severance", "zh": "遣散费" },
    "term.vat": { "en": "VAT", "zh": "市舶税" },
    "term.income_tax": { "en": "Income tax", "zh": "所得税" },
    "term.dues": { "en": "Harbor dues", "zh": "港务费" },
    "term.settlement": { "en": "Settlement", "zh": "结算" }
  },

  "phases": {
    "phase.harbor.label": { "en": "In Harbor", "zh": "在港" },
    "phase.harbor.short": { "en": "Pier", "zh": "码头" },
    "phase.path_draft.label": { "en": "Path Draft", "zh": "择道" },
    "phase.path_draft.short": { "en": "Paths", "zh": "商道" },
    "phase.dawn.label": { "en": "Dawn", "zh": "破晓" },
    "phase.market.label": { "en": "Market", "zh": "开市" },
    "phase.market.short": { "en": "Buy", "zh": "采购" },
    "phase.orders.label": { "en": "Orders", "zh": "委托" },
    "phase.parley.label": { "en": "Parley", "zh": "洽谈" },
    "phase.resolve.label": { "en": "Resolve", "zh": "结算" },
    "phase.dusk.label": { "en": "Dusk", "zh": "暮色" },
    "phase.dusk.short": { "en": "Yard", "zh": "船坞" },
    "phase.module_draft.label": { "en": "Drafting Module", "zh": "抽取模块" },
    "phase.module_draft.short": { "en": "Draft", "zh": "抽取" },
    "phase.module_swap.label": { "en": "Swapping Module", "zh": "切换模块" },
    "phase.module_swap.short": { "en": "Swap", "zh": "切换" },
    "phase.bankruptcy.label": { "en": "Bankrupt", "zh": "破产" },
    "phase.endgame.label": { "en": "Voyage Complete", "zh": "航程圆满" },
    "phase.endgame.short": { "en": "Done", "zh": "完成" }
  },

  "modes": {
    "mode.classic.name": { "en": "Classic", "zh": "经典" },
    "mode.classic.tagline": {
      "en": "The harbor as it has always run.",
      "zh": "港湾一如既往。"
    },
    "mode.classic.summary": {
      "en": "The founding voyage. Buy the port, work the orders, trade with the table between rounds, settle, and refit.",
      "zh": "最初的航程。在港口采买，交付委托，与同席船长互通有无，结算账目，再整备船只。"
    },
    "mode.ocean_gambit.name": { "en": "Ocean Gambit", "zh": "暗潮" },
    "mode.ocean_gambit.badge": { "en": "Gambit", "zh": "暗潮" },
    "mode.ocean_gambit.tagline": {
      "en": "Orders lock before the table opens.",
      "zh": "委托先落定，众人再开口。"
    },
    "mode.ocean_gambit.summary": {
      "en": "Trade orders are committed before the social window opens, so a promise about what you are going to do can be broken invisibly.",
      "zh": "委托在众人开口之前便已落定，一句承诺能否兑现，旁人无从知晓。"
    }
  },

  "difficulty": {
    "difficulty.fair_winds.name": { "en": "Fair Winds", "zh": "顺风" },
    "difficulty.fair_winds.tagline": {
      "en": "A gentle passage for new captains.",
      "zh": "新船长的一段轻松航路。"
    },
    "difficulty.fair_winds.summary": {
      "en": "Eight rounds on the founding trade. A short, legible voyage with room to learn the rhythm before the money runs tight.",
      "zh": "八轮初创贸易，用一段简短而精炼的旅程，让你在陷入贫困之前熟悉游戏节奏。"
    },
    "difficulty.open_waters.name": { "en": "Open Waters", "zh": "开阔水域" },
    "difficulty.open_waters.tagline": {
      "en": "The full trade opens as the harbor grows busy.",
      "zh": "港湾渐忙，货路全开。"
    },
    "difficulty.open_waters.summary": {
      "en": "Twelve rounds. The charter opens twice and the market swells from six cards to ten, with pirates that begin to bite past the midpoint.",
      "zh": "十二轮贸易，特许开放两次，货架由六张增至十张。半程过后，海盗开始汹涌来袭。"
    },
    "difficulty.monsoon.name": { "en": "Monsoon Season", "zh": "季风时节" },
    "difficulty.monsoon.badge": { "en": "Monsoon", "zh": "季风" },
    "difficulty.monsoon.tagline": {
      "en": "A long, adversarial haul for seasoned captains.",
      "zh": "老船长的漫长险途。"
    },
    "difficulty.monsoon.summary": {
      "en": "Sixteen rounds, back loaded and unforgiving. The market swells to eleven cards, the largest imperial mandates fall late, and a corrupt broker may leak your position to the pirates.",
      "zh": "十六轮贸易，重负在背，毫不留情。货架扩至十一张，最重要的皇命采办压在尾声。通匪的掮客甚至可能向海盗泄露你的位置。"
    }
  },

  "goods": {
    "good.hemp": { "en": "Hemp", "zh": "麻布" },
    "good.silk": { "en": "Silk", "zh": "丝绸" },
    "good.tea": { "en": "Tea", "zh": "茶叶" },
    "good.porcelain_clay": { "en": "Porcelain Clay", "zh": "瓷土" },
    "good.copper_ore": { "en": "Copper Ore", "zh": "铜矿石" },
    "good.spices": { "en": "Spices", "zh": "香料" },
    "good.pearls": { "en": "Pearls", "zh": "珍珠" },
    "good.linen_clothes": { "en": "Linen Clothes", "zh": "麻衣" },
    "good.cotton_clothes": { "en": "Cotton Clothes", "zh": "布衣" },
    "good.brocade": { "en": "Brocade", "zh": "绫罗绸缎" },
    "good.sachet": { "en": "Sachet", "zh": "香囊" },
    "good.bronze_mirror": { "en": "Bronze Mirror", "zh": "铜镜" },
    "good.celadon_ware": { "en": "Celadon Ware", "zh": "青瓷" },
    "good.foreign_balm": { "en": "Foreign Balm", "zh": "异域香膏" },
    "good.pearl_string": { "en": "Pearl String", "zh": "珠串" },
    "good.rags": { "en": "Rags", "zh": "碎布" }
  },

  "food": {
    "food.grain": { "en": "Grain", "zh": "米粮" },
    "food.salt_fish": { "en": "Salt Fish", "zh": "咸鱼" },
    "food.produce": { "en": "Produce", "zh": "时鲜" },
    "food.meal": { "en": "Meal", "zh": "餐" },
    "food.short_rations": { "en": "Short rations", "zh": "减半口粮" },
    "food.preserve": { "en": "To preserve", "zh": "腌制" },
    "food.barge": { "en": "Supply Barge", "zh": "补给驳船" },
    "food.barge_rations": { "en": "Barge rations", "zh": "驳船口粮" },
    "food.ration_price": { "en": "Ration price", "zh": "口粮单价" }
  },

  "crew": {
    "crew.role.weaver": { "en": "Weaver", "zh": "织女" },
    "crew.role.master": { "en": "Master Weaver", "zh": "纺织大师" },
    "crew.role.sachet_maker": { "en": "Sachet Maker", "zh": "香囊师" },
    "crew.role.coppersmith": { "en": "Coppersmith", "zh": "铜匠" },
    "crew.role.potter": { "en": "Potter", "zh": "陶匠" },
    "crew.role.perfumer": { "en": "Perfumer", "zh": "调香师" },
    "crew.role.jeweler": { "en": "Jeweler", "zh": "珠匠" },
    "crew.name.ada": { "en": "Ada", "zh": "阿黛" },
    "crew.name.adil": { "en": "Adil", "zh": "阿迪勒" },
    "crew.name.aiko": { "en": "Aiko", "zh": "爱子" },
    "crew.name.amara": { "en": "Amara", "zh": "阿玛拉" },
    "crew.name.anil": { "en": "Anil", "zh": "阿尼尔" },
    "crew.name.anouk": { "en": "Anouk", "zh": "阿努克" },
    "crew.name.arjun": { "en": "Arjun", "zh": "阿琼" },
    "crew.name.asha": { "en": "Asha", "zh": "阿莎" },
    "crew.name.bram": { "en": "Bram", "zh": "布拉姆" },
    "crew.name.cassia": { "en": "Cassia", "zh": "卡西娅" },
    "crew.name.chen": { "en": "Chen", "zh": "陈" },
    "crew.name.corin": { "en": "Corin", "zh": "科林" },
    "crew.name.dara": { "en": "Dara", "zh": "达拉" },
    "crew.name.dev": { "en": "Dev", "zh": "德夫" },
    "crew.name.dilara": { "en": "Dilara", "zh": "迪拉拉" },
    "crew.name.emeka": { "en": "Emeka", "zh": "埃梅卡" },
    "crew.name.enzo": { "en": "Enzo", "zh": "恩佐" },
    "crew.name.farah": { "en": "Farah", "zh": "法拉" },
    "crew.name.fen": { "en": "Fen", "zh": "芬" },
    "crew.name.gita": { "en": "Gita", "zh": "吉塔" },
    "crew.name.hakon": { "en": "Hakon", "zh": "哈康" },
    "crew.name.hana": { "en": "Hana", "zh": "哈娜" },
    "crew.name.idris": { "en": "Idris", "zh": "伊德里斯" },
    "crew.name.imani": { "en": "Imani", "zh": "伊玛尼" },
    "crew.name.ines": { "en": "Ines", "zh": "伊内丝" },
    "crew.name.isolde": { "en": "Isolde", "zh": "伊索尔德" },
    "crew.name.jaya": { "en": "Jaya", "zh": "贾娅" },
    "crew.name.jonas": { "en": "Jonas", "zh": "乔纳斯" },
    "crew.name.kavi": { "en": "Kavi", "zh": "卡维" },
    "crew.name.kiran": { "en": "Kiran", "zh": "基兰" },
    "crew.name.lena": { "en": "Lena", "zh": "莉娜" },
    "crew.name.lian": { "en": "Lian", "zh": "莲" },
    "crew.name.mabel": { "en": "Mabel", "zh": "梅布尔" },
    "crew.name.malik": { "en": "Malik", "zh": "马利克" },
    "crew.name.maren": { "en": "Maren", "zh": "玛伦" },
    "crew.name.mateo": { "en": "Mateo", "zh": "马特奥" },
    "crew.name.mina": { "en": "Mina", "zh": "米娜" },
    "crew.name.nadia": { "en": "Nadia", "zh": "娜迪亚" },
    "crew.name.nia": { "en": "Nia", "zh": "妮娅" },
    "crew.name.noor": { "en": "Noor", "zh": "努尔" },
    "crew.name.odile": { "en": "Odile", "zh": "奥迪尔" },
    "crew.name.oren": { "en": "Oren", "zh": "奥伦" },
    "crew.name.pia": { "en": "Pia", "zh": "皮娅" },
    "crew.name.priya": { "en": "Priya", "zh": "普里娅" },
    "crew.name.rafi": { "en": "Rafi", "zh": "拉菲" },
    "crew.name.rhea": { "en": "Rhea", "zh": "蕾娅" },
    "crew.name.roshan": { "en": "Roshan", "zh": "罗山" },
    "crew.name.runa": { "en": "Runa", "zh": "露娜" },
    "crew.name.sana": { "en": "Sana", "zh": "萨娜" },
    "crew.name.selma": { "en": "Selma", "zh": "塞尔玛" },
    "crew.name.shaan": { "en": "Shaan", "zh": "沙安" },
    "crew.name.sora": { "en": "Sora", "zh": "索拉" },
    "crew.name.sunil": { "en": "Sunil", "zh": "苏尼尔" },
    "crew.name.tam": { "en": "Tam", "zh": "谭" },
    "crew.name.tara": { "en": "Tara", "zh": "塔拉" },
    "crew.name.teo": { "en": "Teo", "zh": "特奥" },
    "crew.name.thandi": { "en": "Thandi", "zh": "坦迪" },
    "crew.name.tomas": { "en": "Tomas", "zh": "托马斯" },
    "crew.name.uma": { "en": "Uma", "zh": "乌玛" },
    "crew.name.vasco": { "en": "Vasco", "zh": "瓦斯科" },
    "crew.name.vera": { "en": "Vera", "zh": "薇拉" },
    "crew.name.wren": { "en": "Wren", "zh": "瑞恩" },
    "crew.name.yara": { "en": "Yara", "zh": "雅拉" },
    "crew.name.yusuf": { "en": "Yusuf", "zh": "优素福" },
    "crew.name.zaid": { "en": "Zaid", "zh": "扎伊德" },
    "crew.name.zara": { "en": "Zara", "zh": "扎拉" },
    "crew.name.zoya": { "en": "Zoya", "zh": "卓娅" }
  },

  "ports": {
    "port.quanzhou": { "en": "Quanzhou Port", "zh": "泉州港" },
    "port.guangzhou": { "en": "Guangzhou Port", "zh": "广州港" },
    "port.ningbo": { "en": "Ningbo Port", "zh": "宁波港" },
    "port.yangzhou": { "en": "Yangzhou Port", "zh": "扬州港" },
    "port.hangzhou": { "en": "Hangzhou Port", "zh": "杭州港" },
    "port.fuzhou": { "en": "Fuzhou Port", "zh": "福州港" },
    "port.goryeo": { "en": "Goryeo Port", "zh": "高丽港" },
    "port.srivijaya": { "en": "Srivijaya Port", "zh": "三佛齐港" },
    "port.dashi": { "en": "Dashi Port", "zh": "大食港" }
  },

  "paths": {
    "path.convoy.name": { "en": "Convoy", "zh": "镖行" },
    "path.convoy.signature": {
      "en": "Protect another captain's haul: sell one leg of protection for a price you both agree, and a raid that would have hit them meets your cannons instead.",
      "zh": "为他人护货：把一段航段的护卫按双方议定的价钱卖出，本该落在对方头上的劫掠，改由你的炮口接下。"
    },
    "path.loom.name": { "en": "Loom", "zh": "织造" },
    "path.loom.signature": {
      "en": "Refit another captain's garments at port, faster and cheaper than they could manage alone, and hold the crafting chain that makes them.",
      "zh": "在港口为他人的衣物整补翻新，比他们亲自打理更快、更省，并握有织成它们的整条工序。"
    },
    "path.aroma.name": { "en": "Aroma", "zh": "香市" },
    "path.aroma.signature": {
      "en": "Publish a rumor that shifts the next port's price band for one commodity; the fleet sees that you spoke and which good you named, and only you know which way you are leaning.",
      "zh": "放出风声，拨动某件货物在下一港的价钱。船队看得见你开了口、点的是哪件货，只有你知道自己押的是哪一边。"
    },
    "path.free_captain.name": { "en": "Free Captain", "zh": "自由船长" },
    "path.free_captain.signature": {
      "en": "Fill any one locked order without joining its path, once a voyage, at forty percent off the payout.",
      "zh": "每航程一次，不入商道也能交付任意一份专属委托，报酬降低40%。"
    },
    "path.quartermaster.name": { "en": "Quartermaster", "zh": "司库" },
    "path.quartermaster.signature": {
      "en": "Supply the fleet: the largest hold at the table, the highest Renown ceiling, and the seat that decides how long a hungry crew eats.",
      "zh": "为船队供给：全桌最大的货舱、最高的声望上限，以及决定饥饿的船员还能吃多久的那个席位。"
    },
    "path.lock_line": {
      "en": "Only a captain who holds the {path} may fill this order.",
      "zh": "唯有{path}的船长才能交付这份专属委托。"
    },
    "path.fact.hold": { "en": "Hold {n}%", "zh": "货舱 {n}%" },
    "path.fact.renown": { "en": "Renown to {title}", "zh": "声望至{title}" },
    "path.fact.orders": { "en": "{n} locked orders", "zh": "{n} 份专属委托" }
  },

  "houses": {
    "house.term": { "en": "Great House", "zh": "世家" },
    "house.standing": { "en": "House Standing", "zh": "世家口碑" },
    "house.jade_pavilion.name": { "en": "Jade Pavilion", "zh": "玉阁" },
    "house.jade_pavilion.motto": {
      "en": "Patience polishes the stone.",
      "zh": "静以待时，玉自成器。"
    },
    "house.jade_pavilion.perk": {
      "en": "Your first artisan each voyage joins at no cost: the first wage is on the House.",
      "zh": "每程首位入伙的工匠不收钱，头一笔工钱由本阁代付。"
    },
    "house.vermilion_gate.name": { "en": "Vermilion Gate", "zh": "朱门" },
    "house.vermilion_gate.motto": {
      "en": "The gate is open to every cargo.",
      "zh": "朱门开，百货运。"
    },
    "house.vermilion_gate.perk": {
      "en": "One more cargo lot joins your Port Purchase board, every round.",
      "zh": "港口采购板上每轮多一件货。"
    },
    "house.golden_lotus.name": { "en": "Golden Lotus", "zh": "金荷" },
    "house.golden_lotus.motto": {
      "en": "Fortune favors the bold wager.",
      "zh": "敢下注，好运自来。"
    },
    "house.golden_lotus.perk": {
      "en": "Wages cost 20% less, but pirate raids strike 5% more often.",
      "zh": "工钱省 20%，但海盗劫掠多出 5%。"
    }
  },

  "renown": {
    "title.deckhand": { "en": "Deckhand", "zh": "甲板水手" },
    "title.able_seaman": { "en": "Able Seaman", "zh": "一等水手" },
    "title.trade_officer": { "en": "Trade Officer", "zh": "通商官" },
    "title.harbor_captain": { "en": "Harbor Captain", "zh": "港湾船长" },
    "title.fleet_commodore": { "en": "Fleet Commodore", "zh": "船队提督" },
    "title.silk_road_legend": { "en": "Silk Road Legend", "zh": "丝路传奇" },
    "title.silk_road_sovereign": {
      "en": "Silk Road Sovereign",
      "zh": "丝路霸主"
    },
    "rating.king_of_silk_road": {
      "en": "King of Silk Road",
      "zh": "丝绸之路霸主"
    },
    "rating.maritime_tycoon": { "en": "Maritime Tycoon", "zh": "海上贸易大亨" },
    "rating.successful_merchant": {
      "en": "Successful Merchant",
      "zh": "成功商人"
    },
    "rating.qualified_trader": { "en": "Qualified Trader", "zh": "合格商人" },
    "rating.novice_merchant": { "en": "Novice Merchant", "zh": "新手商人" },
    "legacy.merchant_ledger": { "en": "The merchant ledger", "zh": "商名录" },
    "legacy.renown_level": { "en": "Renown Level", "zh": "声望等级" },
    "legacy.renown_xp": { "en": "Renown XP", "zh": "声望经验" },
    "legacy.voyages_completed": { "en": "Voyages Completed", "zh": "完成航程" },
    "legacy.best_score": { "en": "Best Score", "zh": "最佳积分" },
    "legacy.solvent_streak": {
      "en": "Consecutive solvent voyages",
      "zh": "连续不破产航程"
    }
  },

  "merits": {
    "merit.first_voyage.name": { "en": "First Landfall", "zh": "初登彼岸" },
    "merit.first_voyage.desc": {
      "en": "Complete your first voyage.",
      "zh": "完成你的第一次航程。"
    },
    "merit.first_crown.name": { "en": "Sea Master", "zh": "沧海之主" },
    "merit.first_crown.desc": {
      "en": "Get crowned Sea Master for the first time.",
      "zh": "首次荣登沧海之主。"
    },
    "merit.iron_hull.name": { "en": "Iron Hull", "zh": "铁骨船" },
    "merit.iron_hull.desc": {
      "en": "Complete three voyages in a row without going bankrupt.",
      "zh": "连续三次航程不破产。"
    },
    "merit.century_club.name": { "en": "Century Club", "zh": "百程会" },
    "merit.century_club.desc": {
      "en": "Complete ten voyages.",
      "zh": "完成十次航程。"
    }
  },

  "tags": {
    "tag.cold": { "en": "Cold", "zh": "御寒" },
    "tag.bulk": { "en": "Bulk", "zh": "散货" },
    "tag.perishable": { "en": "Perishable", "zh": "易腐" },
    "tag.preserved": { "en": "Preserved", "zh": "耐储" },
    "tag.woven": { "en": "Woven", "zh": "织物" },
    "tag.luxury": { "en": "Luxury", "zh": "奢华" },
    "tag.armed": { "en": "Armed", "zh": "武装" },
    "tag.crewed": { "en": "Crewed", "zh": "人手" },
    "tag.contraband": { "en": "Contraband", "zh": "私货" },
    "tag.sealed": { "en": "Sealed", "zh": "封验" },
    "tag.public": { "en": "Public", "zh": "公开" },
    "tag.debt": { "en": "Debt", "zh": "债务" }
  },

  "systems": {
    "system.broker": { "en": "Broker", "zh": "掮客" },
    "system.brokers_rumor": { "en": "Broker's Rumor", "zh": "掮客传闻" },
    "system.brokers_whisper": { "en": "Broker's Whisper", "zh": "掮客低语" },
    "system.brokers_favor": { "en": "Broker's Favor", "zh": "掮客的人情" },
    "system.honest_broker": { "en": "Honest Broker", "zh": "诚信掮客" },
    "system.corrupt_broker": { "en": "Corrupt Broker", "zh": "通匪掮客" },
    "system.word_on_the_docks": { "en": "Word on the Docks", "zh": "码头风闻" },
    "system.tidewatch": { "en": "Tidewatch Alerts", "zh": "观潮预警" },
    "system.ventures": { "en": "Ventures", "zh": "合股" },
    "system.backing": { "en": "Backing (a loan)", "zh": "作保" },
    "system.exchange": { "en": "Captain's Exchange", "zh": "船长行市" },
    "system.audit": { "en": "Manifest Audit", "zh": "舱单稽查" },
    "system.maroon": { "en": "Maroon (the vote ashore)", "zh": "放逐" },
    "system.harbormaster": { "en": "Harbormaster", "zh": "港务长" },
    "system.mandate": { "en": "Imperial Mandate", "zh": "皇命采办" },
    "system.commission": {
      "en": "The fleet's commission (the shared objective)",
      "zh": "公议"
    },
    "system.standing_order": { "en": "Standing Order", "zh": "常备委托" },
    "system.salvage": { "en": "Salvage", "zh": "打捞" },
    "system.escort": { "en": "Escort", "zh": "护航" },
    "system.raid": { "en": "Pirate raid", "zh": "海盗劫掠" }
  },

  "moments": {
    "moment.crew_loss.title": { "en": "A Hand Is Lost", "zh": "痛失一臂" },
    "moment.crew_loss.line": {
      "en": "A hand is gone and nothing brings them back. Choose what the crew carries from here.",
      "zh": "逝者已矣，无可挽回。接下来的路，船员带些什么，由你来定。"
    },
    "moment.pathbound_order.title": {
      "en": "The Route Knows You",
      "zh": "商道识君"
    },
    "moment.pathbound_order.line": {
      "en": "Your first order along your path is filled. Take something the route earned you.",
      "zh": "商道上的第一份委托已经交付。取走这条航路为你赢得的东西。"
    },
    "moment.renown_rung.title": { "en": "A Rung Crossed", "zh": "又晋一阶" },
    "moment.renown_rung.line": {
      "en": "Your Reputation has crossed a rung of the merchant ledger. Take what a known name is worth.",
      "zh": "你的声誉越过了商名录上的一阶。名号既响，取走它应得之物。"
    },
    "moment.cold_leg.title": { "en": "Through the Cold", "zh": "既渡寒程" },
    "moment.cold_leg.line": {
      "en": "A cold leg, and every hand came through it. Take something from the water you weathered.",
      "zh": "一段寒程，全船安然渡过。从这段风浪里，取走你应得之物。"
    },
    "moment.mandate.title": {
      "en": "The Fleet's Commission",
      "zh": "船队公议"
    },
    "moment.mandate.line": {
      "en": "You answered the fleet's commission. Take something for the shared work.",
      "zh": "你为船队的公议出了力。为这桩共同的差事，取走一份报酬。"
    },
    "moment.charter.title": { "en": "Your Charter", "zh": "你的特许状" },
    "moment.charter.line": {
      "en": "One charter carries your ship for the rest of the voyage. Choose the one you will sail under.",
      "zh": "一份特许状将陪你走完余下的航程。选择此后随你扬帆的那一份。"
    }
  },

  "cards": {
    "card.silk_wind.name": { "en": "Weaver's Winds", "zh": "织风" },
    "card.silk_wind.desc": {
      "en": "Freight on woven goods is halved this round.",
      "zh": "本轮织物类货物的运费减半。"
    },
    "card.favorable_tides.name": { "en": "Favorable Tides", "zh": "顺风顺水" },
    "card.favorable_tides.desc": {
      "en": "Base freight is 4 Gold cheaper this round.",
      "zh": "本轮基础运费降低4金币。"
    },
    "card.merchant_charm.name": { "en": "Merchant's Charm", "zh": "生意经" },
    "card.merchant_charm.desc": {
      "en": "Port purchases cost 15% less this round.",
      "zh": "本轮港口采购降价 15%。"
    },
    "card.artisan_inspiration.name": {
      "en": "Artisan's Inspiration",
      "zh": "匠人灵感"
    },
    "card.artisan_inspiration.desc": {
      "en": "Every worker produces 1 extra item this round.",
      "zh": "本轮所有工匠多产出1件。"
    },
    "card.emergency_loan.name": { "en": "Emergency Loan", "zh": "紧急钱庄" },
    "card.emergency_loan.desc": {
      "en": "Gain {n} Gold immediately. No strings attached.",
      "zh": "立即获得{n}金币，无需偿还。"
    },
    "card.tax_shelter.name": { "en": "Tax Shelter", "zh": "免税令" },
    "card.tax_shelter.desc": {
      "en": "Income tax is 5% this round.",
      "zh": "本轮所得税率降至 5%。"
    },
    "card.hemp_monopoly.name": { "en": "Bulk Monopoly", "zh": "大宗垄断" },
    "card.hemp_monopoly.desc": {
      "en": "Bulk goods cost 2 Gold less per unit this round.",
      "zh": "本轮散货每单位便宜2金币。"
    },
    "card.master_apprentice.name": {
      "en": "Master's Apprentice",
      "zh": "学徒传承"
    },
    "card.master_apprentice.desc": {
      "en": "Hiring costs half this round.",
      "zh": "本轮雇工费用减半。"
    },
    "card.farsight.name": { "en": "Farsight", "zh": "远见" },
    "card.farsight.desc": {
      "en": "One Broker's rumor is free this round.",
      "zh": "本轮免费获得一条掮客传闻。"
    },
    "card.kiln_and_forge_guild.name": {
      "en": "Kiln and Forge Guild",
      "zh": "窑炉行会"
    },
    "card.kiln_and_forge_guild.desc": {
      "en": "Orders for the first charter's goods pay 15% more this round.",
      "zh": "本轮第一批特许货物的委托多付 15%。"
    },
    "card.frontier_tariff_relief.name": {
      "en": "Frontier Tariff Relief",
      "zh": "关津减税"
    },
    "card.frontier_tariff_relief.desc": {
      "en": "VAT on finished goods is halved this round.",
      "zh": "本轮成品市舶税减半。"
    },
    "card.exotic_treasures.name": {
      "en": "Exotic Treasures",
      "zh": "异域奇珍"
    },
    "card.exotic_treasures.desc": {
      "en": "Orders for the second charter's goods pay 15% more this round.",
      "zh": "本轮第二批特许货物的委托多付 15%。"
    },
    "card.deep_sea_escort_pact.name": {
      "en": "Deep Sea Escort Pact",
      "zh": "远洋护航契约"
    },
    "card.deep_sea_escort_pact.desc": {
      "en": "Escort costs and pirate risk are both halved this round.",
      "zh": "本轮护航费用与海盗风险双双减半。"
    },
    "card.merchants_converge.name": {
      "en": "Merchants Converge",
      "zh": "商贾云集"
    },
    "card.merchants_converge.desc": {
      "en": "One extra trade order appears on this round's board.",
      "zh": "本轮委托板上多出一张贸易委托。"
    },
    "card.steady_watch.name": { "en": "Steady Watch", "zh": "守望" },
    "card.steady_watch.desc": {
      "en": "The crew eats one fewer than their number each leg, for the voyage.",
      "zh": "本航程余下期间，船员每段少耗一份口粮。"
    },
    "card.cold_hardened.name": { "en": "Cold Hardened", "zh": "耐寒" },
    "card.cold_hardened.desc": {
      "en": "The warmth the crew wears counts one higher, for the voyage.",
      "zh": "本航程余下期间，船员衣物的暖意多算 1 点。"
    },
    "card.route_mastery.name": { "en": "Route Mastery", "zh": "商道精通" },
    "card.route_mastery.desc": {
      "en": "Orders that follow your path pay a quarter more, for the voyage.",
      "zh": "本航程余下期间，沿你商道的委托，报酬多四分之一。"
    },
    "card.harbor_credit.name": { "en": "Harbor Credit", "zh": "港口信用" },
    "card.harbor_credit.desc": {
      "en": "Product sales dues are a quarter lower, for the voyage.",
      "zh": "本航程余下期间，成品销售的市舶税降低四分之一。"
    },
    "card.fleet_colors.name": { "en": "Fleet Colors", "zh": "船队旗帜" },
    "card.fleet_colors.desc": {
      "en": "Raiders think twice: pirate risk is a quarter lower, for the voyage.",
      "zh": "海盗三思，本航程余下期间，袭击风险降低四分之一。"
    },
    "card.smugglers_hold.name": { "en": "Smuggler's Hold", "zh": "走私暗舱" },
    "card.smugglers_hold.desc": {
      "en": "Purchases cost 15% less. Income tax is 20% higher.",
      "zh": "进价降低 15%，所得税多缴 20%。"
    },
    "card.bulk_hauler.name": {
      "en": "Bulk Hauler Rigging",
      "zh": "散货索具"
    },
    "card.bulk_hauler.desc": {
      "en": "Freight is 1 Gold less per item. Ship upgrades cost 15 Gold more.",
      "zh": "每件货物运费减1金币，船只升级多花15金币。"
    },
    "card.artisans_workshop.name": {
      "en": "Artisan's Workshop",
      "zh": "工匠工坊"
    },
    "card.artisans_workshop.desc": {
      "en": "Workers produce 1 extra item. Wages are 20% higher.",
      "zh": "工匠多产出1件，工钱多出20%。"
    },
    "card.tax_evasion.name": { "en": "Tax Evasion Ledger", "zh": "避税账本" },
    "card.tax_evasion.desc": {
      "en": "Income tax and VAT are halved. A completed order has a 15% chance of a 20 Gold audit.",
      "zh": "所得税与市舶税减半，每笔委托完成时有15%的概率被稽查，罚金20金币。"
    },
    "card.silk_monopoly.name": { "en": "Woven Monopoly", "zh": "织物垄断" },
    "card.silk_monopoly.desc": {
      "en": "Woven freight is free. Woven orders pay 20% more.",
      "zh": "织物类运费为 0，织物类委托多付 20%。"
    },
    "card.brokers_network.name": { "en": "Broker's Network", "zh": "掮客人脉" },
    "card.brokers_network.desc": {
      "en": "Intel costs 2 Gold and reveals 2 rumors.",
      "zh": "每条情报 2 金币，一次揭示 2 条传闻。"
    },
    "card.salvage_crane.name": { "en": "Salvage Crane", "zh": "打捞起重机" },
    "card.salvage_crane.desc": {
      "en": "A completed order has a 30% chance to refund its freight.",
      "zh": "委托完成时有30%的概率退还运费。"
    },
    "card.overdrive_engine.name": {
      "en": "Overdrive Engine",
      "zh": "超载引擎"
    },
    "card.overdrive_engine.desc": {
      "en": "Freight is 5 Gold less. Maintenance costs 10 Gold more.",
      "zh": "运费降低5金币。维护费增加10金币。"
    },
    "card.bureau_token.name": {
      "en": "Maritime Bureau Token",
      "zh": "市舶司信物"
    },
    "card.bureau_token.desc": {
      "en": "Charter goods pay 10% more on orders.",
      "zh": "特许货物的委托多付 10%。"
    },
    "card.kiln_cellar.name": { "en": "Kiln Cellar", "zh": "窑窖" },
    "card.kiln_cellar.desc": {
      "en": "Bulk goods cost 2 Gold less per unit.",
      "zh": "散货每单位便宜2金币。"
    },
    "card.ocean_relay.name": { "en": "Ocean Interpreter", "zh": "通译" },
    "card.ocean_relay.desc": {
      "en": "Broker's Whisper reveals 1 extra rumor at no extra cost.",
      "zh": "掮客低语每次多揭示 1 条传闻，不另收费。"
    },
    "card.foreign_quarter_pass.name": {
      "en": "Foreign Quarter Pass",
      "zh": "蕃坊通行证"
    },
    "card.foreign_quarter_pass.desc": {
      "en": "Luxury goods cost 3 Gold less per unit.",
      "zh": "奢华货物每单位便宜3金币。"
    },
    "card.persian_dome_compass.name": {
      "en": "Persian Dome Compass",
      "zh": "波斯穹顶罗盘"
    },
    "card.persian_dome_compass.desc": {
      "en": "Pirate raids are 30% less likely.",
      "zh": "海盗袭击风险降低 30%。"
    },
    "card.fleet_of_treasures.name": {
      "en": "Fleet of Treasures",
      "zh": "珍宝船队"
    },
    "card.fleet_of_treasures.desc": {
      "en": "Freight on luxury orders is 3 Gold less per unit.",
      "zh": "奢华货物每单位运费便宜3金币。"
    },
    "card.bulk_charter.name": { "en": "The Bulk Charter", "zh": "大宗特许" },
    "card.bulk_charter.desc": {
      "en": "Freight is 1 Gold cheaper per lot for the rest of the voyage.",
      "zh": "大批装运，本航程每件运费降低1金币。"
    },
    "card.standing_manifest.name": {
      "en": "The Standing Manifest",
      "zh": "常备舱单"
    },
    "card.standing_manifest.desc": {
      "en": "Completed orders pay 15% more, for the rest of the voyage.",
      "zh": "本航程每笔完成的委托多付 15%。"
    },
    "card.gun_charter.name": { "en": "The Gun Charter", "zh": "火炮特许" },
    "card.gun_charter.desc": {
      "en": "You sail armed. Raids against you are 30% less likely, for the rest of the voyage.",
      "zh": "全船武装，本航程遭遇袭击的概率降低 30%。"
    },
    "card.standing_escort.name": {
      "en": "The Standing Escort",
      "zh": "常备护航"
    },
    "card.standing_escort.desc": {
      "en": "A cutter keeps station. Escort contracts cost half, for the rest of the voyage.",
      "zh": "快船随行，本航程护航合同费用减半。"
    },
    "card.weavers_charter.name": {
      "en": "The Weavers' Charter",
      "zh": "织工特许"
    },
    "card.weavers_charter.desc": {
      "en": "The looms never stop. Each weaver produces 1 extra item every round, for the rest of the voyage.",
      "zh": "织机不停，本航程每位织女每轮多产出1件货物。"
    },
    "card.quality_mark.name": { "en": "The Quality Mark", "zh": "品质印记" },
    "card.quality_mark.desc": {
      "en": "Your cloth carries the mark. Woven goods sell for 10% more, for the rest of the voyage.",
      "zh": "织物皆盖印记，本航程织物售价提高 10%。"
    },
    "card.long_ledger.name": { "en": "The Long Ledger", "zh": "长账簿" },
    "card.long_ledger.desc": {
      "en": "The harbors keep your account. Port purchases cost 10% less, for the rest of the voyage.",
      "zh": "港口记账，本航程港口采购降价 10%。"
    },
    "card.quiet_account.name": { "en": "The Quiet Account", "zh": "静默账户" },
    "card.quiet_account.desc": {
      "en": "Settled in advance: harbor dues are halved, for the rest of the voyage.",
      "zh": "费用预先结清，本航程港务费减半。"
    },
    "card.the_factor.name": { "en": "The Factor", "zh": "管事" },
    "card.the_factor.desc": {
      "en": "A factor keeps your books. Borrowing is open three times a voyage, and each borrow carries a 60% penalty.",
      "zh": "有管事替你打理账目，本航程可借款三次，每笔附带60%的罚息。"
    },
    "card.letter_of_marque.name": {
      "en": "The Letter of Marque",
      "zh": "私掠许可证"
    },
    "card.letter_of_marque.desc": {
      "en": "A royal warrant. You recover a quarter of anything raiders take from you, for the rest of the voyage.",
      "zh": "皇家授权，本航程被劫掠的财物可追回四分之一。"
    }
  },

  "ui": {
    "ui.hold": { "en": "Hold", "zh": "货舱" },
    "ui.cargo": { "en": "Cargo", "zh": "货物" },
    "ui.stores": { "en": "Stores", "zh": "存粮" },
    "ui.wardrobe": { "en": "Wardrobe", "zh": "衣箱" },
    "ui.warmth": { "en": "Warmth", "zh": "暖意" },
    "ui.frostbite": { "en": "Frostbite", "zh": "冻伤" },
    "ui.shipyard": { "en": "Shipyard", "zh": "船坞" },
    "ui.hull": { "en": "Hull", "zh": "船体" },
    "ui.upgrade": { "en": "Upgrade", "zh": "升级" },
    "ui.market": { "en": "Market", "zh": "集市" },
    "ui.port_purchase": { "en": "Port Purchase", "zh": "港口采购" },
    "ui.artisan_bench": { "en": "Artisan Bench", "zh": "匠作台" },
    "ui.standing_orders": { "en": "Standing Orders", "zh": "常备委托" },
    "ui.objective": { "en": "Objective", "zh": "公议" },
    "ui.leaderboard": { "en": "Leaderboard", "zh": "排行榜" },
    "ui.lobby": { "en": "Lobby", "zh": "大厅" },
    "ui.standings": { "en": "Standings", "zh": "排名" },
    "ui.cta.gather": { "en": "Gather in the Harbor", "zh": "在港湾集合" },
    "ui.cta.draft_path": { "en": "Draft Your Path", "zh": "抽取你的商道" },
    "ui.cta.draft_boon": { "en": "Draft a Boon", "zh": "抽取机缘" },
    "ui.cta.draft_module": {
      "en": "Draft and install a module",
      "zh": "抽取并安装模块"
    },
    "ui.cta.buy_at_port": { "en": "Buy at Port", "zh": "港口采购" },
    "ui.cta.buy_rumor": { "en": "Buy a Broker's Rumor", "zh": "购买掮客传闻" },
    "ui.cta.barter": { "en": "Barter with Captains", "zh": "与船长互通有无" },
    "ui.cta.post_barter": { "en": "Post a barter offer", "zh": "挂出易货报价" },
    "ui.cta.fill_orders": { "en": "Fill Trade Orders", "zh": "交付贸易委托" },
    "ui.cta.settle_bills": { "en": "Settle your bills", "zh": "结清账单" },
    "ui.cta.survive_settlement": {
      "en": "Survive Settlement",
      "zh": "挺过结算"
    },
    "ui.cta.request_loan": { "en": "Request a loan", "zh": "申请借款" },
    "ui.cta.upgrade_shipyard": {
      "en": "Upgrade at the Shipyard",
      "zh": "前往船坞升级"
    },
    "ui.cta.skip_shipyard": { "en": "Skip the shipyard", "zh": "暂不升级船只" },
    "ui.cta.skip_buying": {
      "en": "Skip buying this round",
      "zh": "本轮不再采购"
    },
    "ui.cta.hire": { "en": "Hire a Weaver", "zh": "雇佣织女" },
    "ui.cta.put_artisans": {
      "en": "Put Artisans to Work",
      "zh": "安排工匠上工"
    },
    "ui.cta.hold_off_hiring": { "en": "Hold off on hiring", "zh": "暂不雇工" },
    "ui.cta.last_round_no_hires": {
      "en": "Last round, no new hires",
      "zh": "最后一轮，不再雇工"
    },
    "ui.cta.ready_up": {
      "en": "Ready up when you are done",
      "zh": "收拾停当后点就绪"
    },
    "ui.draft.step1": {
      "en": "Step 1 of 3: Keep One",
      "zh": "三步之一：留一张"
    },
    "ui.draft.step2": {
      "en": "Step 2 of 3: Keep One Of Two",
      "zh": "三步之二：二选一"
    },
    "ui.draft.step3": {
      "en": "Step 3 of 3: Discard One",
      "zh": "三步之三：弃一张"
    },
    "ui.ledger.captains": { "en": "Captain's Ledger", "zh": "船长账簿" },
    "ui.stat.worker_wages": { "en": "Worker Wages", "zh": "工匠工钱" },
    "ui.stat.ship_maintenance": {
      "en": "Ship Maintenance",
      "zh": "船只维护费"
    },
    "ui.stat.vat_paid": { "en": "VAT Paid", "zh": "市舶税" },
    "ui.stat.trade_revenue": { "en": "Trade Revenue", "zh": "贸易所得" },
    "ui.stat.voyages": { "en": "Voyages", "zh": "航程" },
    "ui.stat.ship_lv": { "en": "Ship Lv", "zh": "船只等级" },
    "ui.field.password": { "en": "Password", "zh": "密码" },
    "ui.field.display_name": { "en": "Display Name", "zh": "显示名" },
    "ui.field.captain_name": { "en": "Captain Name", "zh": "船长名" },
    "ui.field.setup_code": { "en": "Setup Code", "zh": "设置口令" }
  },

  "sentences": {
    "shell.001": {
      "en": "${APP_NAME}: a multiplayer maritime trade game on the ancient Silk Road. Captains gather in a shared harbor, sail in lockstep, and the highest Reputation wins the Sea Master crown.",
      "zh": "{APP_NAME}：古丝绸之路上的多人海上贸易游戏。船长们聚在同一个港湾，步调一致地航行，声誉最高者赢得沧海之冠。"
    },
    "shell.002": { "en": "Silk Road", "zh": "丝绸之路" },
    "shell.003": { "en": "trading game", "zh": "贸易游戏" },
    "shell.004": {
      "en": "Reading the tide tables...",
      "zh": "正在读潮汐表..."
    },
    "shell.005": { "en": "Unauthorized", "zh": "未授权" },
    "shell.006": { "en": "Invalid JSON body", "zh": "JSON 请求体无效。" },
    "shell.007": {
      "en": "Cannot reach the server. It may be temporarily offline.",
      "zh": "连不上服务器，可能只是暂时离线。"
    },
    "shell.008": {
      "en": "Server error (${res.status}). Please try again later.",
      "zh": "服务器出错了（{res.status}）。请稍后再试。"
    },
    "shell.009": {
      "en": "This account has been banned. Contact the harbor operator if you believe this is a mistake.",
      "zh": "这个账号已经被封停了。要是觉得封错了，请联系港湾操作员。"
    },
    "shell.010": {
      "en": "That captain name is already registered",
      "zh": "这个船长名已经有人用了。"
    },
    "shell.011": {
      "en": "${USERNAME_MIN} to ${USERNAME_MAX} chars, letters, numbers, underscore",
      "zh": "{USERNAME_MIN}到{USERNAME_MAX}个字符，字母、数字、下划线"
    },
    "shell.012": {
      "en": "Username may only contain letters, numbers and underscores",
      "zh": "船长名只能用字母、数字和下划线"
    },
    "shell.013": {
      "en": "at least ${PASSWORD_MIN} characters",
      "zh": "至少{PASSWORD_MIN}个字符"
    },
    "guides.001": {
      "en": "<div style=\"background:color-mix(in oklch, var(--w-${leg.phase}) 12%, transparent);border-radius:6px;padding:10px;border-left:3px solid var(--w-${leg.phase});color:var(--foreground)\">\\n    <strong>${face.icon} ${face.label}</strong><br>\\n    <span style=\"font-size:13px\">${leg.body}</span><br>\\n    <span style=\"font-size:12px;color:var(--muted-foreground)\">${leg.setsUp}</span>\\n  </div>",
      "zh": "<div style=\"background:color-mix(in oklch, var(--w-${leg.phase}) 12%, transparent);border-radius:6px;padding:10px;border-left:3px solid var(--w-${leg.phase});color:var(--foreground)\">\\n    <strong>${face.icon} ${face.label}</strong><br>\\n    <span style=\"font-size:13px\">${leg.body}</span><br>\\n    <span style=\"font-size:12px;color:var(--muted-foreground)\">${leg.setsUp}</span>\\n  </div>"
    },
    "guides.002": {
      "en": "<div style=\"display:grid;gap:8px;margin:12px 0\">\\n${legs}\\n</div>\\n<p style=\"font-size:12px;color:var(--muted-foreground);margin:4px 0 0\">${briefing.closes}</p>",
      "zh": "<div style=\"display:grid;gap:8px;margin:12px 0\">\\n${legs}\\n</div>\\n<p style=\"font-size:12px;color:var(--muted-foreground);margin:4px 0 0\">${briefing.closes}</p>"
    },
    "guides.003": {
      "en": "<li><strong>${entry.crest} ${entry.name}</strong>: ${entry.signature}<br><span style=\"font-size:12px;color:var(--muted-foreground)\">${entry.facts\\n          .map(pathFactText)\\n          .join(\" · \")}</span></li>",
      "zh": "<li><strong>${entry.crest} ${entry.name}</strong>: ${entry.signature}<br><span style=\"font-size:12px;color:var(--muted-foreground)\">${entry.facts\\n          .map(pathFactText)\\n          .join(\" · \")}</span></li>"
    },
    "guides.004": { "en": "Base", "zh": "基价" },
    "guides.005": { "en": "Final", "zh": "最终价" },
    "guides.006": {
      "en": "±1 Gold depending on the port",
      "zh": "随港口浮动 ±1金币"
    },
    "guides.007": {
      "en": "Actual market cards this round can still vary",
      "zh": "本轮实际行情仍可能有出入"
    },
    "guides.008": { "en": "per item", "zh": "每件" },
    "guides.009": { "en": "per unit", "zh": "每单位" },
    "guides.010": {
      "en": "<div style=\"background:color-mix(in oklch, var(--gain) 12%, transparent);border-radius:6px;padding:12px;border-left:3px solid var(--gain);color:var(--foreground);line-height:1.9\">${briefing.text}</div>",
      "zh": "<div style=\"background:color-mix(in oklch, var(--gain) 12%, transparent);border-radius:6px;padding:12px;border-left:3px solid var(--gain);color:var(--foreground);line-height:1.9\">${briefing.text}</div>"
    },
    "guides.011": {
      "en": "<p>This voyage does not play like the founding one. Here is what <strong>${play.badge}</strong> changes about it, all of it:</p>\\n<ul style=\"padding-left:18px;line-height:1.9;font-size:14px\">\\n${items}\\n</ul>\\n<p style=\"font-size:12px;color:var(--muted-foreground);margin:8px 0 0\">Everything else is the voyage you would sail in Classic, so everything you learn there carries over. You can read the same list any time with F1.</p>",
      "zh": "<p>这趟航程跟最初那趟不一样。以下是 <strong>{play.badge}</strong> 带来的全部改动：</p>\\n<ul style=\"padding-left:18px;line-height:1.9;font-size:14px\">\\n{items}\\n</ul>\\n<p style=\"font-size:12px;color:var(--muted-foreground);margin:8px 0 0\">其余的跟经典航程一样，你在经典里学到的都管用。随时按 F1 重看这份清单。</p>"
    },
    "guides.012": {
      "en": "<p>The voyage opens with a deal rather than a market. Three cards land face down in front of you, and at each beat you keep one and pass the rest on. What you hold when the deal ends is your path, and it sails with you to the end of the voyage. One change of papers is allowed: at a port, for a fee in Gold that grows with your Renown, the path chip in your rail offers the switch.</p>\\n<p>Your path decides three things about your seat: your hold, how far your Renown can climb, and which trade orders lock to you. An order demanding a locked good can only be filled by the captain holding the path that carries it.</p>\\n<ul style=\"padding-left:18px;line-height:1.7;font-size:14px\">\\n${rows}\\n</ul>\\n<p style=\"font-size:12px;color:var(--muted-foreground);margin:8px 0 0\">Every card in the deal carries these numbers, so what you read here is what the table deals you.</p>",
      "zh": "<p>这趟航程以发牌开局，而不是开市。三张牌背面朝上落在你面前，一路留一张、传走其余。发牌结束时留在手上的，就是你的商道，它会陪你走到航程尽头。商道可以换一次：在港口花一笔金币，价钱随声望涨，船长栏里的商道小牌就能换。</p>\\n<p>你的商道定下你席位的三件事：货舱多大、声望最高能爬到哪、哪些委托只认这条道。遇上要专属货物的委托，全桌只有持那条商道的船长接得下。</p>\\n<ul style=\"padding-left:18px;line-height:1.7;font-size:14px\">\\n{rows}\\n</ul>\\n<p style=\"font-size:12px;color:var(--muted-foreground);margin:8px 0 0\">牌桌上的每张牌都带这些数字，这里读到的就是你会拿到的。</p>"
    },
    "guides.013": {
      "en": "<p>${APP_NAME} puts you on the ancient Silk Road: one voyage of ${rounds} rounds, limited gold, and a lot of merchants trying to outmaneuver you at every port.</p>\\n<p>You are sailing <strong>${play.badge}</strong>: ${play.tagline}</p>\\n<p>These waters are <strong>${cfg.name}</strong>: ${cfg.tagline}</p>\\n<p>The rules are easy to pick up, but money is tight early on and a string of bad calls compounds quickly. This covers the things that catch new captains out most.</p>\\n<p style=\"color:var(--muted-foreground);font-size:13px\">Two minutes to read. Saves a lot of frustrated restarts.</p>",
      "zh": "<p>{APP_NAME} 把你带上了古丝路：{rounds}轮的航程，有限的金币，还有一群商人，个个都想在每个港口比你多走一步。</p>\\n<p>你走的是<strong>{play.badge}</strong>：{play.tagline}</p>\\n<p>这片水域是<strong>{cfg.name}</strong>：{cfg.tagline}</p>\\n<p>规则好上手，只是前期手头紧，一连串坏判断很快就会滚成雪球。这里讲的是新船长最容易栽的几件事。</p>\\n<p style=\"color:var(--muted-foreground);font-size:13px\">两分钟读完，能省下好几次懊恼的重开。</p>"
    },
    "guides.014": {
      "en": "<p>After ${rounds} rounds, the captain with the highest score wins the title of <strong>Sea Master</strong>. Score comes from trade profits and fulfilled orders.</p>\\n<p>${play.failureRule}</p>\\n<p>Starting gold is <strong>${cfg.startingGold}</strong>. That is enough to get going, but not enough to be careless with.</p>",
      "zh": "<p>{rounds}轮之后，积分最高的船长赢得<strong>沧海之主</strong>的头衔。积分来自贸易利润和完成的委托。</p>\\n<p>{play.failureRule}</p>\\n<p>初始金币是<strong>{cfg.startingGold}</strong>。够起步，不够大手大脚。</p>"
    },
    "guides.015": {
      "en": "<p>A round is one lap of the voyage, and this voyage runs ${rounds} of them. Each round walks the phases below in the order your voyage puts them:</p>\\n${roundStepHtml(mode)}\\n<p style=\"font-size:12px;color:var(--muted-foreground);margin:4px 0 0\"><kbd style=\"background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px\">Ctrl+N</kbd> readies you for the next phase without clicking (the room sails on once every captain is ready), and a voyage is one whole run of these rounds rather than a round of its own.</p>",
      "zh": "<p>一轮是航程里的一圈，这趟要走{rounds}轮。每轮依次走过下面的阶段，顺序由你的航程排定：</p>\\n{roundStepHtml(mode)}\\n<p style=\"font-size:12px;color:var(--muted-foreground);margin:4px 0 0\"><kbd style=\"background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px\">Ctrl+N</kbd> 可以不点鼠标直接就绪（所有船长都就绪，港湾才继续）；航程是这些轮连起来的一整趟，不是单独的一轮。</p>"
    },
    "guides.016": {
      "en": "<p>The port market has Hemp, Silk, and Tea at prices that shift every round. Buy here, barter with the other captains at Parley, and fill trade orders at Orders. Which of those two stops comes first is a rule of the voyage you are sailing rather than a choice you make, and your captain's rail always shows the order. That is the core loop.</p>\\n<p>One thing worth knowing about: the <strong>Broker</strong>. Pay a small fee for a demand rumor and a specific trade order is <em>guaranteed</em> to appear when Orders opens. Useful when you have stocked a particular good and want to make sure a buyer shows up.</p>\\n<div style=\"background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5\">\\n  💡 For the first two or three voyages, stick to raw materials. You can fill an order with them the same round you buy them. No waiting and no risk.\\n</div>",
      "zh": "<p>集市里有麻布、丝绸和茶叶，价格每轮都在动。在这里采购，到洽谈去换货，去委托交单。开市和委托谁先谁后，由你所走航程的规则定，没得选，船长栏里一直标着顺序。这就是核心循环。</p>\\n<p>还有一个人要记住：<strong>掮客</strong>。花点小钱买一条需求传闻，委托一开，指定的那张<em>必定</em>出现。囤着货想保准有买家，就用这个。</p>\\n<div style=\"background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5\">\\n  💡 最初两三趟航程，先做原料。买进的当轮就能拿去交委托，不用等，也没有风险。\\n</div>"
    },
    "guides.017": {
      "en": "<p>The Parley is a short window where captains trade directly with each other instead of through the market. Post an offer, like Hemp you don't need for Silk you do, and any other captain in the harbor can take it with one click.</p>\\n<p>Where it falls in the round is set by the voyage you are sailing rather than changing from round to round: ${MODES.classic.badge} runs it right after Market, and ${MODES.ocean_gambit.badge} runs it right after Orders, and your captain's rail always shows which. Either way, it is the easiest way to recover from a bad draw. All Tea and no Silk, with a Sachet order already on the board? Someone else in the harbor has probably drawn the opposite problem.</p>\\n<div style=\"background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5\">\\n  A few ground rules: you can't offer an item for itself, both amounts have to be whole numbers of at least one, and you can never offer more than you currently have. The moment you post an offer, that amount is set aside until someone takes it or you cancel it.\\n</div>\\n<p style=\"font-size:13px;color:var(--muted-foreground);margin-top:8px\">Nobody has to barter. If nothing on the board interests you, or nobody is offering anything, just move on to the next phase.</p>",
      "zh": "<p>洽谈只开一扇短窗，船长们绕开集市直接换货。挂一份单子，比如拿富余的麻布换你缺的丝绸，港湾里谁都能一点接下。</p>\\n<p>洽谈落在轮里的哪一步，由你的航程定，不随轮次变：{MODES.classic.badge}排在开市之后，{MODES.ocean_gambit.badge}排在委托之后，船长栏一直标着是哪种。哪种都好，它都是纠坏手气最省事的办法。手里全是茶叶没有丝绸，委托板上却挂着一张香囊单？港湾里多半有人正好反过来。</p>\\n<div style=\"background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5\">\\n  几条规矩：不能拿一样货换它本身；两边的数量都得是整数，至少各 1；挂出的数量不能超过你手头的。挂出那一刻，这些货就寄存起来，直到有人接下或你取消。\\n</div>\\n<p style=\"font-size:13px;color:var(--muted-foreground);margin-top:8px\">没人非得换货。板上没你想要的，或者没人挂东西，直接走下一阶段。</p>"
    },
    "guides.018": {
      "en": "<p>Trade orders appear and you match your cargo to them. Each one shows the goods needed, the reward, and the shipping fee. Your take is whatever is left after fees and tax.</p>\\n<p>You can fill as many orders as your cargo allows while Orders is open.</p>\\n<div style=\"background:color-mix(in oklch, var(--intel) 14%, transparent);border:1px solid var(--intel);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5\">\\n  📌 <strong>Finished goods</strong> (${PRODUCTS_TIER0.join(\", \")}) pay two to three times more than raw materials. The catch is they need artisans, and the artisans deliver at Resolve. That is covered next.\\n</div>\\n${mandates.length ?",
      "zh": "<p>委托上板了，拿货去对。每条都写明要什么货、给多少报酬、收多少运费。运费和税扣完，剩下的都归你。</p>\\n<p>委托开着的时候，货够就交，能交几条交几条。</p>\\n<div style=\"background:color-mix(in oklch, var(--intel) 14%, transparent);border:1px solid var(--intel);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5\">\\n  📌 <strong>成品</strong> ({PRODUCTS_TIER0.join(\", \")})的报酬是原料的两三倍。可它得靠匠人，匠人要到结算才交货。下一页就讲这个。\\n</div>\\n{mandates.length ?"
    },
    "guides.019": {
      "en": "<p>Artisans turn raw materials into high value finished goods and collect wages at every Resolve. That part is simple. What catches most new captains is this:</p>\\n<div style=\"background:color-mix(in oklch, var(--alarm) 18%, transparent);border:1px solid var(--alarm);color:var(--foreground);border-radius:6px;padding:12px;margin:12px 0;text-align:center;font-size:14px;font-weight:bold;line-height:1.7\">\\n  Assign a task this round.<br>Wages come due at Resolve either way.\\n</div>\\n<p style=\"font-size:13px;color:var(--muted-foreground);line-height:1.6\">Weavers (${wageOf(\"weaver\")}g), Master Weavers (${wageOf(\"master\")}g), and Sachet Makers (${wageOf(\"sachet_maker\")}g) all charge wages <strong>every round</strong>, even when idle, so the bill comes round whether they worked or not. Only hire once you have enough gold to cover at least two rounds of wages alongside your other bills.</p>",
      "zh": "<p>匠人把原料做成高价成品，每个结算都领工钱。这部分很简单。让新船长栽跟头的是这一点：</p>\\n<div style=\"background:color-mix(in oklch, var(--alarm) 18%, transparent);border:1px solid var(--alarm);color:var(--foreground);border-radius:6px;padding:12px;margin:12px 0;text-align:center;font-size:14px;font-weight:bold;line-height:1.7\">\\n  本轮派活。<br>工钱到结算照付不误。\\n</div>\\n<p style=\"font-size:13px;color:var(--muted-foreground);line-height:1.6\">织女（{wageOf(\"weaver\")}g）、纺织大师（{wageOf(\"master\")}g）、香囊师（{wageOf(\"sachet_maker\")}g）的工钱<strong>每轮</strong>都付，闲着照付，干不干活账单都来。手里的金币能盖住至少两轮工钱、还顾得开别的开销，再雇人。</p>"
    },
    "guides.020": {
      "en": ": \"\"}\\n<div style=\"background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5\">\\n  💡 ${ESCORT_SHARE_RULE} Often worth it once your funds are already thin.\\n</div>",
      "zh": ": \"\"}\\n<div style=\"background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5\">\\n  💡 {ESCORT_SHARE_RULE}手头紧的时候，这笔往往划算。\\n</div>"
    },
    "guides.021": {
      "en": "<p>Once the pirates are dealt with, two bills come due:</p>\\n<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0\">\\n  <div style=\"background:color-mix(in oklch, var(--w-ship) 14%, transparent);border-radius:6px;padding:10px;text-align:center;color:var(--foreground)\">\\n    <div style=\"font-size:22px;margin-bottom:4px\">🔧</div>\\n    <strong>Ship Maintenance</strong><br>\\n    <span style=\"font-size:12px;color:var(--muted-foreground)\">15 to 22 Gold each round, set by the waters you sail</span>\\n  </div>\\n  <div style=\"background:color-mix(in oklch, var(--w-market) 14%, transparent);border-radius:6px;padding:10px;text-align:center;color:var(--foreground)\">\\n    <div style=\"font-size:22px;margin-bottom:4px\">👥</div>\\n    <strong>Artisan Wages</strong><br>\\n    <span style=\"font-size:12px;color:var(--muted-foreground)\">${ARTISAN_WAGE_MIN} to ${ARTISAN_WAGE_MAX} Gold per person per round</span>\\n  </div>\\n</div>\\n<p style=\"font-size:13px;color:var(--muted-foreground)\">The <strong>Dues</strong> tab of your captain's rail shows exactly what is owed. Check it before spending anything.</p>\\n<p style=\"font-size:13px;color:var(--muted-foreground)\">Coming up short isn't the end on its own. Right there on the settlement screen, you can ask another captain in the harbor for a loan, and they can send it to you on the spot if they've got the Gold to spare. Just repay it before the voyage's last round ends, or it comes out of your funds automatically and goes straight to them.</p>",
      "zh": "<p>海盗的事了结之后，还有两笔账单：</p>\\n<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0\">\\n  <div style=\"background:color-mix(in oklch, var(--w-ship) 14%, transparent);border-radius:6px;padding:10px;text-align:center;color:var(--foreground)\">\\n    <div style=\"font-size:22px;margin-bottom:4px\">🔧</div>\\n    <strong>船只维护费</strong><br>\\n    <span style=\"font-size:12px;color:var(--muted-foreground)\">每轮15到22金币，由你走的水域决定</span>\\n  </div>\\n  <div style=\"background:color-mix(in oklch, var(--w-market) 14%, transparent);border-radius:6px;padding:10px;text-align:center;color:var(--foreground)\">\\n    <div style=\"font-size:22px;margin-bottom:4px\">👥</div>\\n    <strong>匠人工钱</strong><br>\\n    <span style=\"font-size:12px;color:var(--muted-foreground)\">每人每轮{ARTISAN_WAGE_MIN}到{ARTISAN_WAGE_MAX}金币</span>\\n  </div>\\n</div>\\n<p style=\"font-size:13px;color:var(--muted-foreground)\">船长栏里的<strong>港务费</strong>页签写着确切欠多少。花钱之前先看一眼。</p>\\n<p style=\"font-size:13px;color:var(--muted-foreground)\">钱不够，本身不是终点。就在结算界面上，你可以向港湾里的其他船长借一笔；对方手头宽裕，当场就能转给你。在航程最后一轮结束前还上就行，还不清，会自动从你的金币里扣出来，交到他手上。</p>"
    },
    "guides.022": {
      "en": "<p>Keep these points in mind as you play:</p>\\n<ul style=\"padding-left:18px;line-height:2.1;font-size:14px\">\\n  <li>Start with raw material orders. Fast money, no complications.</li>\\n  <li>Always keep at least <strong>30 Gold above</strong> what Resolve will cost you.</li>\\n  <li>Hire artisans only when you can cover <strong>two full rounds of wages</strong>.</li>\\n  <li>Dusk ship upgrades compound quickly. Do not skip them.</li>\\n  <li>Caught short by pirates or a bad round? Ask the harbor for a loan before you assume the voyage is over.</li>\\n  <li>Every voyage's final Reputation becomes Renown on your account, forever, win or lose. Check your Captain's Legacy any time from the Lobby.</li>\\n  <li><kbd style=\"background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px\">Ctrl+S</kbd> saves your run  ·  <kbd style=\"background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px\">F1</kbd> opens the full guide.</li>\\n</ul>\\n<div style=\"background:color-mix(in oklch, var(--gain) 14%, transparent);border:2px solid var(--gain);color:var(--foreground);border-radius:8px;padding:12px;text-align:center;margin-top:14px\">\\n  <strong style=\"font-size:15px\">Good winds and good margins, Captain. ⚓</strong>\\n</div>",
      "zh": "<p>玩的时候记住这几点：</p>\\n<ul style=\"padding-left:18px;line-height:2.1;font-size:14px\">\\n  <li>先从原料委托做起。回钱快，不复杂。</li>\\n  <li>手里的金币，始终比结算要收的<strong>多出至少30金币</strong>。</li>\\n  <li>盖得住<strong>整整两轮工钱</strong>再雇匠人。</li>\\n  <li>暮色的船只升级会滚雪球，别跳过。</li>\\n  <li>被海盗或一轮背运打个措手不及？别急着认输，先向港湾借一笔。</li>\\n  <li>不管输赢，航程结束时的声誉都会永远变成账号上的声望。在大厅随时能看你的船长传承。</li>\\n  <li><kbd style=\"background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px\">Ctrl+S</kbd> 保存进度  ·  <kbd style=\"background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px\">F1</kbd> 打开完整指南。</li>\\n</ul>\\n<div style=\"background:color-mix(in oklch, var(--gain) 14%, transparent);border:2px solid var(--gain);color:var(--foreground);border-radius:8px;padding:12px;text-align:center;margin-top:14px\">\\n  <strong style=\"font-size:15px\">顺风又厚利，船长。⚓</strong>\\n</div>"
    },
    "guides.023": {
      "en": "<p>Before the bills below come due each round, ${raidCopy(cfg).toLowerCase()} Pirates find your ship and take every coin you're carrying.</p>\\n<p>You get one choice before that roll happens: hire an escort for ${escortPct(cfg)} of your current Gold and sail through guaranteed safe, or set sail anyway and keep the Gold if the pirates don't show.</p>\\n${cfg.brokerCorruption ?",
      "zh": "<p>每轮账单到期之前，{raidCopy(cfg).toLowerCase()}海盗会找上你的船，把你带的钱搜刮一空。</p>\\n<p>掷这一下之前，你还有得选：花现有金币的 {escortPct(cfg)}雇一艘护航，保证平安过关；或者照常起航碰运气，海盗不来，那笔金币就省下。</p>\\n{cfg.brokerCorruption ?"
    },
    "guides.024": {
      "en": "The harbor's escort, hired at Resolve by any captain: guarantees safe passage from that round's pirate attack, for a fee the charter sets as a share of your Gold: ${Object.values( DIFFICULTIES, ) .map((c) =>",
      "zh": "港湾的护航，任何船长都能在结算时雇用：保你免受本轮海盗袭击，费用按章程定，取现有金币的一个比例：{Object.values( DIFFICULTIES, ) .map((c) =>"
    },
    "guides.025": {
      "en": ") .join(\", \")}. Once hired, the round's pirates are no longer a risk.",
      "zh": ") .join(\", \")}。雇下之后，本轮的海盗就不再是威胁。"
    },
    "guides.026": {
      "en": "A Convoy path market at the Parley on a Gambit voyage: a Convoy captain sells one leg of protection to one other captain at a price the two of them agree. The buyer pays the fee at the handshake, the seller's cannons beat off ${Math.round( CONVOY_RAID_COVERAGE * 100, )}% of a raid in that leg, and the rest comes out of the seller's own Gold. ${ESCORT_OFFER_DEATH}",
      "zh": "暗潮航程里洽谈场上的镖行买卖：镖行船长把一段航段的护卫卖给另一位船长，价钱两人自己谈。买家在成交时付清费用，卖家的炮火挡下该航段 {Math.round( CONVOY_RAID_COVERAGE * 100, )}% 的劫掠，剩下的从卖家自己的金币里出。{ESCORT_OFFER_DEATH}"
    },
    "guides.027": {
      "en": ", ) .join( \", \", )}. Hire an escort beforehand to guarantee safe passage instead of risking it.",
      "zh": ", ) .join( \", \", )}。想稳当过关，提前雇一艘护航，不用冒这个险。"
    },
    "guides.028": {
      "en": "A cheap raw material, bought at port. Weavers turn it into Linen Clothes, or combine it with Silk for Cotton Clothes.",
      "zh": "在港口就能买到的便宜原材料。织女拿它做麻衣，或配上丝绸做布衣。"
    },
    "guides.029": {
      "en": "A pricier raw material. Goes into Cotton Clothes, Brocade, and Sachets. Most of the high value recipes need it.",
      "zh": "贵一档的原材料，用来做布衣、绫罗绸缎和香囊。高价值配方大多少不了它。"
    },
    "guides.030": {
      "en": "A raw material used only in Sachets, alongside Silk.",
      "zh": "只和丝绸搭配、专用于香囊的原材料。"
    },
    "guides.031": {
      "en": "A Weaver's product: 2 Hemp in, one item out. The cheapest finished good to produce.",
      "zh": "织女的成品：2麻布进，1件出。是成本最低的成品。"
    },
    "guides.032": {
      "en": "A Weaver's product: 2 Hemp + 1 Silk in. Worth more than Linen Clothes, costs more to make.",
      "zh": "织女的成品：2麻布加1丝绸。比麻衣值钱，成本也高。"
    },
    "guides.033": {
      "en": "A Master Weaver's product: 3 Silk in. One of the two highest value finished goods.",
      "zh": "纺织大师的成品：3丝绸。最值钱的两种成品之一。"
    },
    "guides.034": {
      "en": "A Sachet Maker's product: 1 Silk + 2 Tea in. The most valuable finished good, and the only one that needs Tea.",
      "zh": "香囊师的成品：1丝绸加2茶叶。成品里最值钱的，也是唯一吃茶叶的。"
    },
    "guides.035": {
      "en": "Makes Linen Clothes or Cotton Clothes. Costs a wage every round, paid at Resolve, whether or not they're working.",
      "zh": "做麻衣和布衣。工钱每轮照付，结算时结清，干不干活都一样。"
    },
    "guides.036": {
      "en": "Makes Linen Clothes, Cotton Clothes, or Brocade. Pricier than a Weaver, and the only one who can make Brocade.",
      "zh": "做麻衣、布衣和绫罗绸缎。身价比织女高，也是唯一会做绫罗绸缎的。"
    },
    "guides.037": {
      "en": "Makes Sachets. The most expensive artisan to hire, but Sachets pay the best.",
      "zh": "制作香囊。雇价最高的工匠，但香囊的报酬也最高。"
    },
    "guides.038": {
      "en": "Your score for the voyage, roughly your accumulated trading profit. Highest reputation on the voyage's final round wins.",
      "zh": "你在本航程的积分，大致就是累积的贸易利润。最后一轮结束时声誉最高的人获胜。"
    },
    "guides.039": {
      "en": "Your standing across every harbor, kept on the account rather than in one voyage: the Reputation you bank becomes Renown XP when a voyage ends. ${RENOWN_BONUS_LINE}. The title beside your level is the ladder's own name for the rung you have reached.",
      "zh": "你在所有港湾之间的地位，记在账号上，不随某次航程走：航程结束时，你攒下的声誉会变成声望经验。{RENOWN_BONUS_LINE}。等级旁的称号，就是这条阶梯给这一级的名字。"
    },
    "guides.040": {
      "en": "Your spendable funds. Hit zero with bills still due and the voyage ends in bankruptcy.",
      "zh": "你手头可用的金币。账单还没付完就见底，航程以破产收场。"
    },
    "guides.041": {
      "en": "A ${Math.round(VAT_RATE * 100)}% tax on the profit margin of finished good sales (selling price minus material cost minus wage). Raw material sales aren't taxed this way.",
      "zh": "对成品的利润（售价减材料成本再减工钱）征 {Math.round(VAT_RATE * 100)}% 的税。卖原料不在此列。"
    },
    "guides.042": {
      "en": "A ${Math.round(INCOME_TAX_RATE * 100)}% tax on your net profit for the round, charged at Resolve after everything else is paid.",
      "zh": "对本轮净利润征 {Math.round(INCOME_TAX_RATE * 100)}% 的税，在结算时、其余账付清之后收。"
    },
    "guides.043": {
      "en": "The shipping fee for completing a trade order, based on how many items you're moving. Reduced by your ship level and certain boons or modules.",
      "zh": "交一条委托要付的运费，按件数算。船等级，以及某些机缘和模块，能把它压低。"
    },
    "guides.044": {
      "en": "A fixed per round upkeep fee for your ship, due at Resolve regardless of how the round went.",
      "zh": "每轮固定的船只维护，不论这轮走得如何，结算时都要交。"
    },
    "guides.045": {
      "en": "Raises your module slots and gives a flat discount on freight costs. Upgraded from the Shipyard at Dusk.",
      "zh": "多给一个模块仓位，运费也定额往下压。在暮色的船坞升级。"
    },
    "guides.046": {
      "en": "What your hired artisans cost per round, paid at Resolve whether they produced anything or not.",
      "zh": "雇来的工匠每轮的开销，结算时付，产出与否都得付。"
    },
    "guides.047": {
      "en": "A one round bonus you draft at the start of each round, at Dawn. It's picked personally, so your three choices differ from everyone else's.",
      "zh": "每轮开局、破晓时抽的机缘，只保一轮。三张牌单发给你，和别人的都不重样。"
    },
    "guides.048": {
      "en": "A permanent ship upgrade, drafted from the Shipyard once you have a free slot. Stays equipped until you swap it out.",
      "zh": "永久的船只升级，有空余仓位时在船坞抽取。装上就一直在，直到你把它换掉。"
    },
    "guides.049": {
      "en": "Trade directly with another captain instead of through the market, on the Captain's Exchange during the Parley or from the harbor chat once you reach Renown Level ${FLEXIBLE_BARTER_UNLOCK_LEVEL}. Post what you have for what you want; the offered amount is set aside the moment you post it, and comes back to you if it's canceled, if nobody takes it, or if a flexible offer of yours is taken and this one is retired with it.",
      "zh": "绕开集市，直接和另一位船长换货：洽谈时的船长行市，或声望到 {FLEXIBLE_BARTER_UNLOCK_LEVEL}级后的港湾聊天。挂出你有的、写明你想要的；挂出的那一刻数量就寄存起来，被取消、没人接，或者你的另一份灵活挂单成交、把它一并带走，都会原样回到你手上。"
    },
    "guides.050": { "en": "Pirate Attack", "zh": "海盗袭击" },
    "guides.051": { "en": "Financial Aid", "zh": "资金援助" },
    "guides.052": {
      "en": "A loan from another captain when you can't cover this round's wages or maintenance on your own. The lender's Gold transfers to you immediately; you owe it back before the voyage ends, or it's deducted automatically and handed to them at the voyage's final round.",
      "zh": "自己盖不住本轮的工钱或维护费时，向另一位船长借的一笔款。对方的金币立刻到账；在航程结束前还清，还不清，最后一轮会自动从你的金币里扣下来，交到他手上。"
    },
    "guides.053": {
      "en": "The round's opening phase: the boon draft deals three cards and you keep one, and it bends the rules for the round ahead. On a voyage that keeps a larder, this is also when the crew eats a ration a head.",
      "zh": "一轮的开场：发三张机缘，你留一张，接下来的规矩会偏向你一点。带粮舱的航程，也是船员每人吃一份口粮的时候。"
    },
    "guides.054": {
      "en": "The round's trading floor. Captains post barter offers and take each other's here, and the table's votes (a manifest audit, a maroon) are called here too.",
      "zh": "一轮的交易场。船长们在这里挂单换货、彼此接手；桌上的表决（舱单稽查、放逐）也从这里发起。"
    },
    "guides.055": {
      "en": "The round's reckoning. Production lands first, then pirates may strike, and then the wages, maintenance and taxes come due. The Dues tab is the list of what this phase will ask for.",
      "zh": "一轮的结算：先落产出，再是海盗可能来犯，然后工钱、维护费和税一起到期。港务费页签列的，就是这一步会上门的账。"
    },
    "guides.056": {
      "en": "The round's last phase and the shipyard's seat: upgrade the hull, or draft and rig a module.",
      "zh": "一轮的最后一步，船坞的席位：升级船体，或者抽取并装上一件模块。"
    },
    "guides.057": {
      "en": "What this captain owes at the round end: the crew's wages and the ship's upkeep in one total, with any outstanding loans listed underneath. This tab keeps the running count.",
      "zh": "这位船长轮末欠的账：船员工钱和船只维护合成一个总数，下面列着未还的借款。这个页签一直记着数。"
    },
    "guides.058": {
      "en": "The cargo hold: the goods stowed aboard, one slot per unit of cargo, plus the crew that works them. This tab lists it all.",
      "zh": "货舱：船上装着的货物，一件货占一个仓位，还有干活的船员。这个页签把它们都列出来。"
    },
    "guides.059": {
      "en": "The pantry half of the hold: the foods aboard, measured in slots. The Larder counts the meals inside them.",
      "zh": "货舱里伙房那半边：存着的食物，按仓位算。粮舱数的就是里面的餐数。"
    },
    "guides.060": {
      "en": "The meals aboard for the crew, one ration a head eaten at each Dawn. Run it dry and the crew works hungry, and a long stretch without rations costs a hand.",
      "zh": "船上给船员备的餐，每个破晓每人吃一份。吃空了，船员就饿着干活；连着太久断粮，要折损一名人手。"
    },
    "guides.061": {
      "en": "The broker's cut on a Broker's Favor order: a share of the reward, paid when the order fills. The card prints the cut before you fill it.",
      "zh": "掮客在人情委托里抽的那份：报酬的一部分，委托成交时付。接单前，牌面就写明抽多少。"
    },
    "guides.062": {
      "en": "Gold or goods held aside the moment an offer, a pledge or a barter is posted, until the deal settles. Held goods cannot be spent or traded meanwhile, and they come back whole if the deal is canceled or expires.",
      "zh": "挂单、作保或换货一出手就寄存起来的金币或货，直到交易落定。寄存期间不能花用、不能转手；交易取消或过期，原样归还。"
    },
    "guides.063": { "en": "Frozen out this leg", "zh": "本航段冻停" },
    "guides.064": {
      "en": "went into the cold short of warm clothes",
      "zh": "没带够保暖衣物就进了寒区"
    },
    "guides.065": {
      "en": "A warmer layer before a cold leg keeps every hand working",
      "zh": "冷航段出发前添一层保暖，人人照常开工"
    },
    "guides.066": { "en": "Short Rations", "zh": "减半口粮" },
    "guides.067": {
      "en": "the crew is on short rations",
      "zh": "船员吃着减半口粮"
    },
    "guides.068": { "en": "Fill the larder", "zh": "把粮舱补满" },
    "guides.069": { "en": "Idle", "zh": "待工" },
    "guides.070": {
      "en": "no task is set for this leg",
      "zh": "本航段没有派活"
    },
    "guides.071": {
      "en": "Assign a task to put them to work",
      "zh": "派一件活，他们就能开工。"
    },
    "guides.072": {
      "en": "🥶 ${FROZEN_CREW.state}: the crew ${FROZEN_CREW.cause}. Back next leg. ${FROZEN_CREW.remedy}.",
      "zh": "🥶 {FROZEN_CREW.state}：船员{FROZEN_CREW.cause}。下个航段就回来。{FROZEN_CREW.remedy}。"
    },
    "guides.073": {
      "en": "❌ The only free hands are frozen out this leg: the crew ${FROZEN_CREW.cause}, and they are back next leg. ${FROZEN_CREW.remedy}.",
      "zh": "❌ 仅有的空闲人手本航段冻停了：船员{FROZEN_CREW.cause}，下个航段就回来。{FROZEN_CREW.remedy}。"
    },
    "guides.074": {
      "en": "🥶 ${name} is frozen out this leg: the crew ${FROZEN_CREW.cause}, and the work on ${task} waits for next leg. ${FROZEN_CREW.remedy}.",
      "zh": "🥶 {name}本航段冻停了：船员{FROZEN_CREW.cause}，{task}的活要等下一个航段。{FROZEN_CREW.remedy}。"
    },
    "guides.075": {
      "en": "🥶 Frostbite: ${name} the ${label} ${FROZEN_CREW.cause}, and is out of action next leg. ${FROZEN_CREW.remedy}.",
      "zh": "🥶 冻伤：{name}，这位{label}{FROZEN_CREW.cause}，下个航段不能出工。{FROZEN_CREW.remedy}。"
    },
    "guides.076": {
      "en": "❄️ A cold leg: warmth ${warmth} of ${COLD_LEG_WARMTH}",
      "zh": "❄️ 寒区航段：暖意{warmth}，需要{COLD_LEG_WARMTH}"
    },
    "guides.077": {
      "en": "${reading}, so the cold will take a hand. ${FROZEN_CREW.remedy}.",
      "zh": "{reading}，严寒会夺走一名人手。{FROZEN_CREW.remedy}。"
    },
    "guides.078": {
      "en": "${reading}, and the crew is dressed for it.",
      "zh": "{reading}，船员的保暖够用。"
    },
    "guides.079": {
      "en": "legs in a row without rations costs the newest hand aboard.",
      "zh": "个航段连续断粮，会折损船上最新的人手。"
    },
    "guides.080": {
      "en": "${CREW_LOSS_AFTER_HUNGRY_LEGS} ${HUNGRY_RULE_TAIL}",
      "zh": "${CREW_LOSS_AFTER_HUNGRY_LEGS} ${HUNGRY_RULE_TAIL}"
    },
    "guides.081": {
      "en": "${HUNGRY_CREW.state}: ${HUNGRY_CREW.remedy}",
      "zh": "{HUNGRY_CREW.state}：{HUNGRY_CREW.remedy}"
    },
    "guides.082": {
      "en": "${IDLE_HAND.state}${skilled ? \" ⭐ Skilled\" : \"\"}: ${IDLE_HAND.cause}, and the wage is still owed at Resolve. ${IDLE_HAND.remedy}.",
      "zh": "{IDLE_HAND.state}{skilled ? \" ⭐ 熟练\" : \"\"}：{IDLE_HAND.cause}，工钱到结算照付。{IDLE_HAND.remedy}。"
    },
    "guides.083": {
      "en": "⭐ Skilled: a trained hand makes 2 goods a round where an untrained one makes 1.",
      "zh": "⭐ 熟练：练过的人手每轮做2件，没练过的做1件。"
    },
    "guides.084": {
      "en": "Going hungry: ${HUNGRY_CREW.cause}, every artisan working at a slower pace, a quarter of the hold closed, and ${hungryRule()} ${HUNGRY_CREW.remedy} at the next Market.",
      "zh": "挨饿中：{HUNGRY_CREW.cause}，每位工匠干活都变慢，四分之一货舱封闭；{hungryRule()}下次开市时{HUNGRY_CREW.remedy}。"
    },
    "guides.085": {
      "en": "The larder is empty: ${HUNGRY_CREW.cause}, so every artisan produces less, a quarter of the hold is closed, and ${hungryRule()} ${HUNGRY_CREW.remedy} before the next Dawn.",
      "zh": "粮舱空了：{HUNGRY_CREW.cause}，每位工匠产出更少，四分之一货舱封闭；{hungryRule()}下次破晓前{HUNGRY_CREW.remedy}。"
    },
    "guides.086": {
      "en": "⚠️ The crew is on short rations, so every artisan works the leg at a slower pace, and ${hungryRule()} ${HUNGRY_CREW.remedy} at the next Market.",
      "zh": "⚠️ 船员吃着减半口粮，每位工匠本航段干活更慢；{hungryRule()}下次开市时{HUNGRY_CREW.remedy}。"
    },
    "manual.001": { "en": "Tip:", "zh": "提示：" },
    "manual.002": { "en": "Back", "zh": "返回" },
    "manual.003": { "en": "Close guide", "zh": "关闭指南" },
    "manual.004": {
      "en": "Go to step ${i + 1}: ${s.title}",
      "zh": "跳到第{i + 1}步：{s.title}"
    },
    "manual.005": {
      "en": "Captains gather in a shared harbor. The host picks a difficulty and sets sail. Everyone then plays the same voyage in lockstep: nobody advances a phase until every still active captain has readied up.",
      "zh": "船长们聚在同一个港湾。港主定下难度就启航，所有人走同一个航程、同进同退：只要还有船长在场，就得等大家都就绪，阶段才往前走。"
    },
    "manual.006": {
      "en": "You can start a Solo Practice Voyage alone to learn the ropes without waiting for a second captain.",
      "zh": "不等第二位船长也可以：自己开一段单人练习航程，先把门道摸熟。"
    },
    "manual.007": {
      "en": "Each round opens with a boon draft. Pick one of ${CARDS_PER_OFFER} boons that bend the rules for the coming round: cheaper purchases, faster production, a tax shelter, or an emergency loan of ${EMERGENCY_LOAN_GOLD} Gold.",
      "zh": "每轮开局先抽机缘。从{CARDS_PER_OFFER}张里挑一张，这一轮的规矩就偏向你：采购更便宜、生产更快、避一笔税，或是一笔{EMERGENCY_LOAN_GOLD}金币的紧急钱庄。"
    },
    "manual.008": {
      "en": "You can swap your boon choices once per round for ${BOON_SWAP_COST} Gold if none of the three fit your strategy.",
      "zh": "三张都不合你的打法，每轮还能花{BOON_SWAP_COST}金币把机缘换一次。"
    },
    "manual.009": {
      "en": "Market is the port. Buy raw materials like Hemp, Silk, and Tea from the port merchant. Prices vary per captain and per round. You can also pay ${INTEL_COST} Gold for a Broker's Rumor that guarantees a matching order appears when Orders opens.",
      "zh": "开市就在港口。向港口商人采购麻布、丝绸、茶叶这些原料。价格每位船长各不同，每轮也在变。还可以花{INTEL_COST}金币买一条掮客传闻，保证委托一开就有对得上的单子出现。"
    },
    "manual.010": {
      "en": "The harbor remembers what everyone bought. A good the room leans into gets pricier next round, while one nobody touches softens.",
      "zh": "港湾记得每个人买过什么。大家都在买的货下一轮更贵，无人问津的会便宜下来。"
    },
    "manual.011": {
      "en": "At the Parley you can trade goods and Gold directly with the other captains, whether your voyage runs it before the orders or after them. Post an offer of what you have and what you want, or accept an offer someone else posted. Offered goods are escrowed the moment you post.",
      "zh": "在洽谈，你可以和其他船长直接换货、换金币，不论航程把洽谈排在委托前还是后。挂出你有的、写明你想要的，或者接下别人挂的。货一挂出就寄存，直到成交或取消。"
    },
    "manual.012": {
      "en": "You can target a specific captain with a Direct Barter Offer if you want to trade with only them. The Markets station of the Parley holds the escort market, the module market and the bazaar window.",
      "zh": "只想和某一位船长做买卖，可以发一份定向换货给他。洽谈的集市站里，开着护航市场、模块市场和香市窗口。"
    },
    "manual.013": {
      "en": "Orders deals the trade manifest. Each entry asks for a set of goods and pays Gold and Reputation. Finished product orders pay more but require artisans to craft them first. The Emperor may also issue a Mandate, a high value order identical for every captain.",
      "zh": "委托阶段发舱单。每条写明要什么货，付你金币和声誉。成品委托给得更多，先得让匠人做出来。皇帝还可能下皇命：一张高价值委托，每位船长收到的都一样。"
    },
    "manual.014": {
      "en": "Raw material orders are the safe early play. Finished product orders are where the real Reputation lives.",
      "zh": "原料委托是前期的稳妥之选，大笔声誉都在成品委托里。"
    },
    "manual.015": {
      "en": "Resolve is where the round's bills land. First, pirates may find you and take every Gold coin on hand. Hire an escort to sail safe, or risk it. Then pay wages and ship maintenance, and check the Dues tab of your captain's rail before you spend anything.",
      "zh": "结算就是本轮账单到期的时候。海盗可能先找上门，把你在手的金币卷走：雇护航求平安，或者赌一把。接着是工钱和船只维护费。花钱之前，先看一眼船长栏里的港务费页签。"
    },
    "manual.016": {
      "en": "Ask the harbor for a loan before assuming the voyage is over. Any captain can lend, and a third captain can back the loan as a safety net.",
      "zh": "别急着断定航程结束，先向港湾借一笔。任何船长都能放款，第三位船长还能为这笔借款作保，兜一道底。"
    },
    "manual.017": {
      "en": "Dusk is the shipyard. Upgrade your ship (opens a new module slot and reduces transport costs) or draft and rig a module. Modules are permanent ship upgrades: a Smuggler's Hold, a Broker's Network, a Salvage Crane, and more.",
      "zh": "暮色一到，船坞开门。升级船只（多开一个模块仓位，运费也更低），或者抽一个模块装上。模块是永久的船只升级：走私暗舱、掮客人脉、打捞起重机，还有更多。"
    },
    "manual.018": {
      "en": "Do not skip the Shipyard. The transport discount from a higher ship level pays for itself within two rounds.",
      "zh": "别跳过船坞。船只等级升上去，省下的运费两轮就回本。"
    },
    "manual.019": { "en": "Build Your Legacy", "zh": "打造你的船长传承" },
    "manual.020": {
      "en": "Every voyage's final Reputation becomes Renown XP, multiplied by the difficulty tier. Renown levels grant titles, a small starting Gold bonus, and at level ${BROKERS_FAVOR_UNLOCK_LEVEL} unlock the Broker's Favor. The captain with the highest Reputation in a voyage is crowned Sea Master.",
      "zh": "每段航程结束时的声誉都会变成声望经验，再按难度加成。声望等级给你称号和一小笔初始金币；到{BROKERS_FAVOR_UNLOCK_LEVEL}级，解锁掮客的人情。一段航程里声誉最高的船长，加冕沧海之主。"
    },
    "manual.021": {
      "en": "Check in daily for a seven day cycle of Renown XP rewards. It is not a streak, so a missed day never resets your progress.",
      "zh": "每天来看看，七天一轮的声望经验奖励。不用连签，漏一天也不会重置进度。"
    },
    "manual.022": {
      "en": "${play.badge}: The Voyage You Are Sailing",
      "zh": "{play.badge}：你正在走的航程"
    },
    "manual.023": {
      "en": "Everything else is the voyage you would sail in Classic, so the rest of this manual reads the same for both.",
      "zh": "其余部分就是经典模式里的那次航程，这本手册剩下的内容两种模式通用。"
    },
    "manual.024": {
      "en": "This is the voyage every other mode is measured against, and the one the rest of these pages describe.",
      "zh": "其他模式都以本航程为参照，后面几页也都在讲它。"
    },
    "manual.025": {
      "en": "Hire weavers, potters, coppersmiths, and other artisans, then assign each a product to craft. Production does not happen instantly: a task assigned now delivers at this round's Resolve, after Orders has already closed.",
      "zh": "雇下织女、陶匠、铜匠这些匠人，再给每人派一件活。产出不是立刻的：这一轮派下的活，要到结算才交货，那时委托早已截止。"
    },
    "manual.026": {
      "en": "A dealing voyage opens with a card deal rather than a market. Three cards land face down, and at each beat you keep one and pass the rest on: what you hold at the end is your path for the voyage, and one change of papers is allowed: at a port, for a fee in Gold that grows with your Renown. Your path decides your hold, how far your Renown can climb, and which trade orders lock to you.",
      "zh": "发牌航程以发牌开局，而不是开市。三张牌背面朝上落下，一路留一张、传走其余：最后留在手上的，就是你这趟的商道。商道可以换一次：在港口花一笔金币，价钱随声望涨。商道定下你的货舱、声望能爬多高，以及哪些委托只认你这条道。"
    },
    "manual.027": {
      "en": "Weigh the numbers under each name rather than the crest. The five paths trade different holds, Renown ceilings and locked order pools, and the one you keep sails with you to the end.",
      "zh": "看名字下面的数字，而不是徽记。五条商道的货舱、声望上限和专属委托各不相同；留下哪条，它陪你走到航程尽头。"
    },
    "manual.028": {
      "en": "${((at + 1) / pages.length) * 100}%",
      "zh": "{((at + 1) / pages.length) * 100}%"
    },
    "manual.029": { "en": "Keyboard Shortcuts", "zh": "键盘快捷键" },
    "manual.030": {
      "en": "Shortcuts are ignored while typing in inputs or text areas.",
      "zh": "在输入框或文本区打字时，快捷键不起作用。"
    },
    "manual.031": { "en": "Close shortcut help", "zh": "关闭快捷键说明" },
    "manual.032": { "en": "Game Actions", "zh": "游戏操作" },
    "manual.033": { "en": "Navigation", "zh": "导航" },
    "manual.034": { "en": "Help", "zh": "帮助" },
    "manual.035": { "en": "How to Play", "zh": "玩法说明" },
    "manual.036": { "en": "Continue", "zh": "继续" },
    "manual.037": {
      "en": "The Harbormaster is fetching the tide tables.",
      "zh": "港务长正在取潮汐表。"
    },
    "manual.038": { "en": "New Captain Tutorial", "zh": "新船长教程" },
    "manual.039": { "en": "🔄 How a Round Runs:", "zh": "🔄 一轮怎么走：" },
    "manual.040": { "en": "💡 New Captain Tip:", "zh": "💡 新船长提示：" },
    "manual.041": {
      "en": "Keep your purse above maintenance plus all wages, and hire artisans only when you can sustain them.",
      "zh": "手头的金币要始终高过维护费加全部工钱；养得起，再雇匠人。"
    },
    "manual.042": { "en": "Harbor Briefing", "zh": "港湾简报" },
    "manual.043": { "en": "🚀 Starting Resources", "zh": "🚀 开局资源" },
    "manual.044": { "en": "⏱️ Production Delay", "zh": "⏱️ 生产延迟" },
    "manual.045": { "en": "💸 Round End Costs", "zh": "💸 轮末开销" },
    "manual.046": { "en": "🧾 Taxes Explained", "zh": "🧾 税负说明" },
    "manual.047": { "en": "🏴‍☠️ Pirates & Borrowing", "zh": "🏴‍☠️ 海盗与借款" },
    "manual.048": {
      "en": "${r}×${STARTING_STOCK[r]}",
      "zh": "{r}×{STARTING_STOCK[r]}"
    },
    "manual.049": {
      "en": "Start Solo Practice Voyage",
      "zh": "开始单人练习航程"
    },
    "manual.050": {
      "en": "Need at least one captain in the harbor",
      "zh": "港湾里至少需要一位船长"
    },
    "manual.051": {
      "en": "The New Captain Tutorial lists everything this mode changes.",
      "zh": "新船长教程列出了这个模式改动的全部内容。"
    },
    "manual.052": {
      "en": "Starting resources, round costs, taxes and the pirate odds.",
      "zh": "开局资源、轮末开销、税负和海盗概率。"
    },
    "manual.053": {
      "en": "Assign task now → item arrives at Resolve",
      "zh": "现在派活 → 结算时到货"
    },
    "manual.054": {
      "en": "Workers don't produce instantly!",
      "zh": "工匠不会立刻产出！"
    },
    "manual.055": {
      "en": "🔧 ${cfg.maintenance} Gold ship maintenance per round",
      "zh": "🔧 每轮船只维护费{cfg.maintenance}金币"
    },
    "manual.056": {
      "en": "👥 Wages settled at Resolve, not on hire",
      "zh": "👥 工钱在结算时付，不是在雇用时"
    },
    "manual.057": {
      "en": "VAT: ${Math.round(VAT_RATE * 100)}% of finished goods profit margin",
      "zh": "市舶税：成品利润的{Math.round(VAT_RATE * 100)}%"
    },
    "manual.058": {
      "en": "Hire an escort, or ask the harbor for a loan",
      "zh": "雇一艘护航，或者向港湾借一笔"
    },
    "descriptions.001": {
      "en": "This harbor has already used its one Venture for this voyage. It opens again on a fresh voyage or a restart.",
      "zh": "这个港湾本航程唯一的一次合股机会，已经用掉了。等新开一次航程或重开，才会再有。"
    },
    "descriptions.002": {
      "en": "⚓ A Venture filled! Every contributor is paid their share, times ${CONVOY_VENTURE_PAYOUT_MULTIPLIER}x. This harbor's one Venture chance for this voyage has now been used.",
      "zh": "⚓ 合股凑齐了！每位出资人都拿回自己那份，再乘 {CONVOY_VENTURE_PAYOUT_MULTIPLIER}倍。这个港湾本航程唯一的那次合股机会，到此用掉。"
    },
    "descriptions.003": {
      "en": "⚓ A Venture missed its deadline. Every contributor gets back a partial refund.",
      "zh": "⚓ 一笔合股的期限到了，没凑齐。每位出资人拿回部分退款。"
    },
    "descriptions.004": {
      "en": "⚓ A Venture was canceled: another venture in the harbor already claimed this voyage's one chance. Every contributor gets back their full stake.",
      "zh": "⚓ 一笔合股被取消：港湾里另一笔合股先占了本航程唯一的机会。每位出资人拿回全部本金。"
    },
    "descriptions.005": {
      "en": "⚰️ ${gone.name} the ${label} is lost after ${CREW_LOSS_AFTER_HUNGRY_LEGS} legs on short rations, and nothing brings them back.",
      "zh": "⚰️ {gone.name}，这位{label}，在 {CREW_LOSS_AFTER_HUNGRY_LEGS}个航段的减半口粮之后没能撑住，再也回不来了。"
    },
    "descriptions.006": {
      "en": "The ${gone.task} they were working is lost with them.",
      "zh": "{gone.task}的活也跟着没了。"
    },
    "descriptions.007": {
      "en": "🌊 There is no one left aboard.",
      "zh": "🌊 船上再没有别人了。"
    },
    "descriptions.008": {
      "en": "🌊 ${left} still aboard.",
      "zh": "🌊 船上还有{left}。"
    },
    "descriptions.009": {
      "en": "❌ Need ${amount} Gold to back that Venture, have ${state.money}",
      "zh": "❌ 为这笔合股作保要 {amount}金币，你手头只有 {state.money}"
    },
    "descriptions.010": {
      "en": "⚓ Backed a Venture with ${amount} Gold",
      "zh": "⚓ 用{amount}金币给一笔合股作了保"
    },
    "descriptions.011": {
      "en": "⚓ Venture filled! Your share: ${amount} Gold",
      "zh": "⚓ 合股凑齐！你这份：{amount}金币"
    },
    "descriptions.012": {
      "en": "⚓ Venture missed its deadline. Partial refund: ${amount} Gold",
      "zh": "⚓ 一笔合股的期限到了，没凑齐。部分退款：{amount}金币"
    },
    "descriptions.013": {
      "en": "⚓ Venture canceled: another venture in the harbor already claimed this voyage's one chance. Full refund: ${amount} Gold",
      "zh": "⚓ 一笔合股被取消：港湾里另一笔合股先占了本航程唯一的机会。全额退款：{amount}金币"
    },
    "descriptions.014": {
      "en": "🧭 Dawn: Draft a Boon → 📦 Market: Buy at Ports → 🤝 Parley: Barter → 📜 Orders: Fill Trade Orders → 💸 Resolve: Pirates, Wages & Maintenance → 🚢 Dusk: Upgrade Ship",
      "zh": "🧭 破晓：抽机缘 → 📦 开市：港口采购 → 🤝 洽谈：易货 → 📜 委托：完成委托 → 💸 结算：海盗、工钱与维护费 → 🚢 暮色：升级船只"
    },
    "descriptions.015": {
      "en": "Fall short on the bills and the voyage is over for that captain: the bankruptcy screen is the last of it, and the standings are read without them.",
      "zh": "账单付不出来，这位船长的航程就到头了：破产画面是最后一站，排名不再把他算在内。"
    },
    "descriptions.016": {
      "en": "Three boons are dealt to you alone each round: cheaper buying, fuller workshops, a shelter from the tax, or a loan when the purse runs thin.",
      "zh": "每轮只发给你一个人的三张机缘：买得更便宜、作坊出得更多、躲开一笔税，或钱袋见底时的一笔借款。"
    },
    "descriptions.017": {
      "en": "The one you take bends this round and no other, so read the rest of the round before you choose.",
      "zh": "留下的那一张只作用本轮，所以先把本轮剩下的安排看完再选。"
    },
    "descriptions.018": {
      "en": "Load the hold at the port market and set each artisan a task. Prices shift every round, every captain is quoted their own, and wages fall due working or idle.",
      "zh": "在港口市场装满货舱，给每位匠人派一件活。价格每轮都在变，每位船长拿到的报价都不一样，工钱干不干活都照付。"
    },
    "descriptions.019": {
      "en": "What the artisans make lands at settlement, so their work answers the next manifest rather than the one you are about to fill.",
      "zh": "工匠做出来的货到结算才落舱，所以他们赶的是下一张舱单，不是你手上正要交的这张。"
    },
    "descriptions.020": {
      "en": "The manifest deals and you commit: goods for Gold and Reputation, and nothing on the sheet can be revised once the fleet starts talking.",
      "zh": "舱单一发，你就落定：货换金币和声誉；等船队开始议价，单子上的字一个也改不了。"
    },
    "descriptions.021": {
      "en": "The fleet cannot see what you committed, which cuts both ways: your round stays hidden from them, and theirs from you.",
      "zh": "船队看不到你交了什么，反过来也一样：你的这一轮对他们保密，他们的对你也保密。"
    },
    "descriptions.022": {
      "en": "The Captain's Exchange opens. Post what you can spare and name your price, or take what another captain has already set on the table.",
      "zh": "船长行市开了。挂出你富余的东西、标上你的价，或者接下别的船长已经摆上桌的。"
    },
    "descriptions.023": {
      "en": "A majority of the fleet can open one captain's manifest from this table, and calling it spends the rest of the table's trading.",
      "zh": "船队多数可以从这张桌上翻开一位船长的舱单；发起表决，这一场交易剩下的时间就没了。"
    },
    "descriptions.024": {
      "en": "Pirates roll for every coin aboard. An escort buys the safe passage for a cut of what you carry, so the fee is cheapest exactly when you have the least to protect.",
      "zh": "海盗盯上船上的每一枚钱。护航按你随身金币的比例抽成，替你买下平安通行；所以你身上金币越少，这笔钱反倒越便宜。"
    },
    "descriptions.025": {
      "en": "Then the wages and the ship's maintenance come due, and what survives the bills is what you take to the yard.",
      "zh": "然后工钱和船只维护到期，扛过账单剩下多少，你就带多少去船坞。"
    },
    "descriptions.026": {
      "en": "Spend what survived: a level of hull carries another module slot and cuts the cost of every haul, and a drafted module is bolted on for good.",
      "zh": "花掉留下来的金币：船体升一级多一个模块仓位，还砍低每一趟的运费；抽到的模块装上就永久生效。"
    },
    "descriptions.027": {
      "en": "What you spend here is what the next round's port cannot be bought with.",
      "zh": "在这里花掉的，下一轮开市就买不回货了。"
    },
    "descriptions.028": {
      "en": "The round closes at the yard and opens again at the ports, with whatever this one left in the hold.",
      "zh": "一轮在船坞合上，又在港口打开，带着这一轮留在货舱里的东西。"
    },
    "descriptions.029": {
      "en": "No captain leaves the table here. Fall short on the bills and the harbor marks it against you for the rest of the voyage, and you sail on with your card, your vote and your say at the table.",
      "zh": "没有船长在这里离席。账单付不出，港湾会在剩下的航程里一直记着这笔账；你带着牌、票和桌上的发言权，继续往前走。"
    },
    "descriptions.030": {
      "en": "The manifest closes before the table opens: Orders runs ahead of Parley, so you commit to your sheet first and nothing on it can be revised once the fleet starts talking.",
      "zh": "舱单先行，桌面后开：委托排在洽谈之前，所以你先对单子落定，船队一开口议价，单子上的内容就不能再改。"
    },
    "descriptions.031": {
      "en": "Every voyage here runs ${GAMBIT_LEGS} rounds, whatever tier you sail. That is the length the harbor's two votes are tuned to.",
      "zh": "这里的航程不论难度，都走 {GAMBIT_LEGS}轮。港湾的两次表决就是照这个长度调的。"
    },
    "descriptions.032": {
      "en": "Every captain is dealt a private card when the voyage leaves the dock, and no one else can see it: most are Honest Captains sailing the fleet's public objective, while a table of four or more hides a Pirate in the fleet and a table of six or more may hide a Broker beside them. Every card turns face up when the voyage ends.",
      "zh": "航程离港时，每位船长都发到一张别人看不到的私牌：多数是诚信船长，跟着船队的公开目标走；四人以上的桌上，船队里藏着一个海盗，六人以上还可能多藏一个掮客。航程结束时，所有牌都翻开。"
    },
    "descriptions.033": {
      "en": "From round ${AUDIT_FROM_ROUND}, a simple majority of the fleet can open one captain's manifest at a Parley. The room is shown ${AUDIT_REVEAL_COUNT} of that captain's last ${AUDIT_WINDOW} fills, and calling the vote spends the rest of that Parley's trading.",
      "zh": "从第 {AUDIT_FROM_ROUND}轮起，船队过半数可以在洽谈时翻开一位船长的舱单。港湾会看到那位船长最近 {AUDIT_WINDOW}笔交货中的 {AUDIT_REVEAL_COUNT}笔；发起这次表决，那场洽谈剩下的交易时间就没了。"
    },
    "engine.001": { "en": "a random pair", "zh": "随机两项" },
    "engine.002": {
      "en": "A majority is more than half of the captains still in the voyage.",
      "zh": "仍在航程中的船长里，超过一半才算多数。"
    },
    "engine.003": { "en": "${i.qty} ${i.type}", "zh": "{i.qty} {i.type}" },
    "engine.004": {
      "en": "Leg ${fill.round}: ${goods} to ${fill.port}, ${fill.reward} Gold",
      "zh": "第{fill.round}航段：{goods}运往{fill.port}，{fill.reward}金币"
    },
    "engine.005": { "en": "\\n", "zh": "\\n" },
    "engine.006": {
      "en": "${names.slice(0, -1).join(\", \")} or ${names[names.length - 1]}",
      "zh": "{names.slice(0, -1).join(\"、\")}或{names[names.length - 1]}"
    },
    "engine.007": { "en": "Age of the Lender", "zh": "债主之年" },
    "engine.008": {
      "en": "Backing another captain's loan pays extra Renown while this Age holds the harbor.",
      "zh": "时代执掌港湾期间，为其他船长的借款作保，多得声望。"
    },
    "engine.009": { "en": "Age of the Trader", "zh": "商贾之年" },
    "engine.010": {
      "en": "Every completed barter trade lands one extra Reputation on top of the goods changing hands.",
      "zh": "每成交一笔易货，除货物易手，还多得1点声誉。"
    },
    "engine.011": { "en": "Age of the Broker", "zh": "掮客之年" },
    "engine.012": {
      "en": "The Broker's Favor commission cap is raised to 250 Gold, so a single favor can pay out more than usual.",
      "zh": "掮客的人情进账上限提到250金币，一次人情比平时给得更多。"
    },
    "engine.013": {
      "en": "🤝 No Reputation this time: you have already earned this voyage's full ${cap} for helping other captains.",
      "zh": "🤝 这次没有声誉：本航程帮其他船长的{cap}点，你已经拿满。"
    },
    "engine.014": {
      "en": "\\n📋=== Settling Outstanding Loans ===",
      "zh": "\\n📋=== 结清未偿借款 ==="
    },
    "engine.015": {
      "en": "❌ Need ${amount} Gold to back that loan, have ${state.money}",
      "zh": "❌ 为这笔借款作保要{amount}金币，现有{state.money}"
    },
    "engine.016": {
      "en": "🛡️ Pledged ${amount} Gold to back a fellow captain's loan",
      "zh": "🛡️ 质押{amount}金币，为同席船长的借款作保"
    },
    "engine.017": {
      "en": "⚖️ Age of the Lender: a pledge that comes home whole pays ${Math.round((multiplier - 1) * 100)}% more while it holds the harbor.",
      "zh": "⚖️ 债主之年：时代执掌港湾期间，质押完好收回，多付{Math.round((multiplier - 1) * 100)}%。"
    },
    "engine.018": {
      "en": "⚓ No crew aboard, so there is nothing to provision.",
      "zh": "⚓ 船上没有船员，不用备粮。"
    },
    "engine.019": {
      "en": "⛵ The barge has nothing left for you this leg.",
      "zh": "⛵ 本航段驳船没有余量给你了。"
    },
    "engine.020": {
      "en": "❌ Name how many rations to buy from the barge.",
      "zh": "❌ 请写明从驳船买多少份口粮。"
    },
    "engine.021": {
      "en": "❌ The barge charges ${price} Gold a ration, and the purse cannot cover one.",
      "zh": "❌ 驳船一份口粮要{price}金币，钱袋连一份也付不起。"
    },
    "engine.022": {
      "en": "⛵ The barge takes ${cost} Gold for ${wanted} ${wanted === 1 ? \"ration\" : \"rations\"} of grain. ${left - wanted} left for you this leg.",
      "zh": "⛵ 驳船收{cost}金币，卖你{wanted}份米粮。本航段还给你剩{left - wanted}份。"
    },
    "engine.023": {
      "en": "⚖️ Age of the Trader: +${gain} Reputation for the completed trade.",
      "zh": "⚖️ 商贾之年：这笔易货成交，声誉 +{gain}。"
    },
    "engine.024": {
      "en": "❌ Can't barter an item for itself",
      "zh": "❌ 不能拿同一种货换它自己。"
    },
    "engine.025": {
      "en": "❌ Barter amounts must be whole numbers of at least 1",
      "zh": "❌ 易货数量得是整数，至少1。"
    },
    "engine.026": {
      "en": "swept when the voyage moved on",
      "zh": "航段推进时清出"
    },
    "engine.027": { "en": "refused by the room", "zh": "被众人拒收" },
    "engine.028": {
      "en": "returned as the voyage loaded",
      "zh": "随航程载入退回"
    },
    "engine.029": { "en": "⏭️ Bartering ended", "zh": "⏭️ 易货结束" },
    "engine.030": {
      "en": "A rumor is priced by the port one leg after the leg it was spoken in, and this is the last leg of the voyage, so a rumor spoken here would move nothing.",
      "zh": "传闻要等开口后的那个航段，港口才给它定价。这是本航程最后一个航段，在这里开口，什么也拨不动。"
    },
    "engine.031": {
      "en": "The bazaar is quiet for you to the end of this voyage. You spoke in leg ${spoke}.",
      "zh": "本航程结束之前，香市都不会再听你开口。你开口是在第{spoke}航段。"
    },
    "engine.032": {
      "en": "The bazaar will hear you again.",
      "zh": "香市又会听你开口了。"
    },
    "engine.033": {
      "en": "The bazaar is quiet for you for one more leg.",
      "zh": "香市还要对你静一个航段。"
    },
    "engine.034": {
      "en": "The bazaar is quiet for you for ${left} more legs.",
      "zh": "香市还要对你静{left}个航段。"
    },
    "engine.035": {
      "en": "The port of leg ${leg} drew ${row.good} and priced it against your rumor.",
      "zh": "第{leg}航段的港口抽到了{row.good}，按你的传闻给它定了价。"
    },
    "engine.036": {
      "en": "The port of leg ${leg} drew no ${row.good}, so your rumor moved no price you could buy.",
      "zh": "第{leg}航段的港口没有抽到{row.good}，你的传闻没有拨动任何你能买到的价钱。"
    },
    "engine.037": {
      "en": "${row.good}: every price ${percent} percent ${way} at the next port",
      "zh": "{row.good}：下一港的每个价钱{way} {percent}%"
    },
    "engine.038": {
      "en": "💰 Boon applied: Gained ${card.effect.flags.instant_gold} Gold!",
      "zh": "💰 机缘生效：获得{card.effect.flags.instant_gold}金币！"
    },
    "engine.039": {
      "en": "❌ Need ${cost} Gold to upgrade the ship",
      "zh": "❌ 升级船只要{cost}金币"
    },
    "engine.040": {
      "en": "+${SHIP_DISCOUNT_PER_LEVEL} Discount",
      "zh": "折扣 +{SHIP_DISCOUNT_PER_LEVEL}"
    },
    "engine.041": {
      "en": "❌ No empty slots! Must swap.",
      "zh": "❌ 没有空位了！得换掉一个。"
    },
    "engine.042": {
      "en": "\\n🧭=== The Navigator's Compass ===",
      "zh": "\\n🧭=== 航海家的罗盘 ==="
    },
    "engine.043": {
      "en": "Choose a Boon to bend the rules of the upcoming voyage...",
      "zh": "选一份机缘，为接下来的航程改一改规矩..."
    },
    "engine.044": {
      "en": "❌ You've already swapped your boon choices this round",
      "zh": "❌ 本轮你已经换过机缘了"
    },
    "engine.045": {
      "en": "❌ Need ${BOON_SWAP_COST} Gold to swap boon choices",
      "zh": "❌ 换机缘要{BOON_SWAP_COST}金币"
    },
    "engine.046": {
      "en": "🔄 Swapped Boon Choices for ${BOON_SWAP_COST} Gold",
      "zh": "🔄 花{BOON_SWAP_COST}金币换了一批机缘"
    },
    "engine.047": {
      "en": "❌ You've already swapped your module choices this round",
      "zh": "❌ 本轮你已经换过模块了"
    },
    "engine.048": {
      "en": "❌ Nothing to swap, draft your modules first",
      "zh": "❌ 没有可换的，先抽取模块"
    },
    "engine.049": {
      "en": "❌ The yard has nothing new to deal this hull: every module it could offer is either aboard or already on the table. Take one of these, sell one at the table, or come back next leg.",
      "zh": "❌ 船坞没有新货能给这艘船体了：它拿得出来的模块，要么已经在船上，要么已经摆在桌上。从这些里挑一个，或者到桌上卖掉一个，要么下个航段再来。"
    },
    "engine.050": {
      "en": "🔄 Swapped Module Choices for a fresh batch",
      "zh": "🔄 换了一批新的模块"
    },
    "engine.051": {
      "en": "❌ That seat is no longer on your hull, so there is nothing there to replace. Back to Draft and take the card again: the yard fits it to the hull as it stands.",
      "zh": "❌ 那个席位已经不在你的船体上，那里没有可切换的东西。回到抽取，重新拿一次牌：船坞会按船体现在的样子装上它。"
    },
    "engine.052": { "en": "the Monsoon Season", "zh": "季风时节" },
    "engine.053": {
      "en": "The voyage ran ${input.rounds} rounds.",
      "zh": "本航程走了{input.rounds}轮。"
    },
    "engine.054": { "en": "borrowed once", "zh": "借入过一次" },
    "engine.055": { "en": "${joined}.", "zh": "{joined}。" },
    "engine.056": {
      "en": "🛡️ Raiders meant for ${who} met your guns: your hold lost ${ate} Gold.",
      "zh": "🛡️ 冲{who}去的海盗撞上了你的炮口：货舱损失{ate}金币。"
    },
    "engine.057": {
      "en": "🛡️ Raiders meant for ${who} met your guns and found your hold already bare.",
      "zh": "🛡️ 冲{who}去的海盗撞上了你的炮口，只见你的货舱早已空了。"
    },
    "engine.058": {
      "en": "📜 Forfeited ${count} unfulfilled pathbound order${count === 1 ? \"\" : \"s\"}.",
      "zh": "📜 作废{count}份未交付的商道委托。"
    },
    "engine.059": {
      "en": "The harbor reads new papers from round ${PATH_SWITCH_FROM_ROUND}.",
      "zh": "港湾从第{PATH_SWITCH_FROM_ROUND}轮起才收新文书。"
    },
    "engine.060": {
      "en": "The window for new papers closed after round ${PATH_SWITCH_TO_ROUND}.",
      "zh": "第{PATH_SWITCH_TO_ROUND}轮之后，换新文书的窗口就关了。"
    },
    "engine.061": {
      "en": "A captain changes their papers once a voyage, and yours are already changed.",
      "zh": "船长一程只能换一次文书，你的已经换过了。"
    },
    "engine.062": {
      "en": "You hold no path to set aside.",
      "zh": "你手上没有可以搁下的商道。"
    },
    "engine.063": {
      "en": "You already hold that path.",
      "zh": "你已经握着那条商道了。"
    },
    "engine.064": {
      "en": "❌ Need ${fee} Gold to change your papers.",
      "zh": "❌ 切换文书要{fee}金币。"
    },
    "engine.065": {
      "en": "🏛️ No profit, no income tax due",
      "zh": "🏛️ 没有盈利，不用缴所得税"
    },
    "engine.066": { "en": "⏭️ Trading skipped", "zh": "⏭️ 跳过交易" },
    "engine.067": {
      "en": "\\n👥=== Processing Worker Production ===",
      "zh": "\\n👥=== 结算工匠产出 ==="
    },
    "engine.068": {
      "en": "\\n💰=== Paying Worker Wages ===",
      "zh": "\\n💰=== 支付工匠工钱 ==="
    },
    "engine.069": {
      "en": "⏭️ Skipped Shipyard Actions",
      "zh": "⏭️ 跳过船坞操作"
    },
    "engine.070": {
      "en": "🎮 ${APP_NAME} · Game Over!",
      "zh": "🎮 {APP_NAME} · 游戏结束！"
    },
    "engine.071": {
      "en": "💰 Final Funds: ${state.money} Gold",
      "zh": "💰 最终资金：{state.money}金币"
    },
    "engine.072": {
      "en": "🏆 Final Reputation: ${state.score}",
      "zh": "🏆 最终声誉：{state.score}"
    },
    "engine.073": { "en": "📈 Rank: ${rating}", "zh": "📈 评级：{rating}" },
    "engine.074": {
      "en": "⚓ Welcome to ${APP_NAME}!",
      "zh": "⚓ 欢迎来到{APP_NAME}！"
    },
    "engine.075": {
      "en": "🚢 Sail across ports, build your business empire!",
      "zh": "🚢 扬帆走遍各个港口，开创你的商业帝国！"
    },
    "engine.076": {
      "en": "👥 Hire artisans to craft valuable goods for higher profits!",
      "zh": "👥 雇工匠，做出贵重货物，赚更高的利润！"
    },
    "engine.077": { "en": "${m}×${a}", "zh": "{m}×{a}" },
    "engine.078": {
      "en": "🌊 Tidewatch Alert: the harbor takes notice of a bustling crew! One more cargo lot joins the Port Purchase board, every round, for the rest of this voyage.",
      "zh": "🌊 观潮预警：港湾瞧见船队忙起来了！本航程余下的每一轮，港口采购板上都会多出一件货物。"
    },
    "engine.079": {
      "en": "❌ Insufficient funds! Need ${cost} Gold, Have ${state.money} Gold",
      "zh": "❌ 资金不足！要{cost}金币，现有{state.money}金币"
    },
    "engine.080": {
      "en": "❌ No room in the hold for that lot: it takes ${units} ${units === 1 ? \"slot\" : \"slots\"} and ${room} ${room === 1 ? \"is\" : \"are\"} free.",
      "zh": "❌ 货舱放不下这件货：它要占{units}个仓位，空着{room}个。"
    },
    "engine.081": {
      "en": "🛒 Bought Product at ${card.port}, Total ${cost} Gold",
      "zh": "🛒 在{card.port}买下成品，合计{cost}金币"
    },
    "engine.082": {
      "en": "💡 Tip: VAT applies when selling finished products",
      "zh": "💡 提示：卖出成品要缴市舶税"
    },
    "engine.083": {
      "en": "${ICONS[r.type]}${r.type}×${r.quantity}(${r.price} Gold/item)",
      "zh": "{ICONS[r.type]}{r.type}×{r.quantity}（{r.price}金币/件）"
    },
    "engine.084": {
      "en": "🛒 Bought at ${card.port}: ${txt}, Total ${cost} Gold",
      "zh": "🛒 在{card.port}买下：{txt}，合计{cost}金币"
    },
    "engine.085": {
      "en": "💰 Current Funds: ${state.money} Gold",
      "zh": "💰 当前资金：{state.money}金币"
    },
    "engine.086": { "en": "⏭️ Purchasing skipped", "zh": "⏭️ 跳过采购" },
    "engine.087": {
      "en": "\\n${moment.icon}=== ${moment.title} ===",
      "zh": "\\n{moment.icon}=== {moment.title} ==="
    },
    "engine.088": {
      "en": "🔧 ${name} is bolted to the hull.",
      "zh": "🔧 {name}已铆在船体上。"
    },
    "engine.089": {
      "en": "❌ The yard has no ${name} to bolt on.",
      "zh": "❌ 船坞没有可装的{name}。"
    },
    "engine.090": {
      "en": "📜 The commission is already filled, and nothing was taken.",
      "zh": "📜 公议已经交齐，没有取走任何东西。"
    },
    "engine.091": {
      "en": "📜 Nothing in the hold answers the commission.",
      "zh": "📜 货舱里没有公议要的东西。"
    },
    "engine.092": {
      "en": "${ICONS[r.type]}${r.type}×${r.take}",
      "zh": "{ICONS[r.type]}{r.type}×{r.take}"
    },
    "engine.093": {
      "en": "📜 Fleet Commission: delivered ${parts.join(\" + \")} for ${paid} Gold. The Emperor's commission is exempt from VAT.",
      "zh": "📜 船队公议：交付{parts.join(\"、\")}，得{paid}金币。皇命采办免缴市舶税。"
    },
    "engine.094": { "en": "🎭 Free Captain", "zh": "🎭 自由船长" },
    "engine.095": { "en": "🎭 Borrow", "zh": "🎭 借用" },
    "engine.096": {
      "en": "🎭 Your borrow is spent, and the order stays locked.",
      "zh": "🎭 你的借用已经用完，这份委托仍然锁定。"
    },
    "engine.097": {
      "en": "❌ Inventory short! Need ${short.type}×${short.required}",
      "zh": "❌ 库存不足！要{short.type}×{short.required}"
    },
    "engine.098": {
      "en": "🤝 Broker's Commission (${pct}%): ${commission} Gold",
      "zh": "🤝 掮客抽成（{pct}%）：{commission}金币"
    },
    "engine.099": {
      "en": "💰 Reward: ${reward} Gold · ⚓ Freight: ${transport} Gold = 📊 Net Profit: ${reward - transport} Gold",
      "zh": "💰 报酬：{reward}金币 · ⚓ 运费：{transport}金币 = 📊 净利：{reward - transport}金币"
    },
    "engine.100": {
      "en": "📣 Word on the Docks: you were first to complete ${WORD_ON_THE_DOCKS_THRESHOLD} trade orders this voyage! +${WORD_ON_THE_DOCKS_REWARD} Gold",
      "zh": "📣 码头风闻：本航程头一个交足{WORD_ON_THE_DOCKS_THRESHOLD}笔贸易委托的是你！+{WORD_ON_THE_DOCKS_REWARD}金币"
    },
    "engine.101": {
      "en": "❌ Broker's Favor unlocks at Renown Level ${BROKERS_FAVOR_UNLOCK_LEVEL}",
      "zh": "❌ 掮客的人情要到声望等级{BROKERS_FAVOR_UNLOCK_LEVEL}才解锁"
    },
    "engine.102": {
      "en": "❌ You've already called in a Broker's Favor this voyage",
      "zh": "❌ 本航程你已经用过一次掮客的人情"
    },
    "engine.103": {
      "en": "❌ The Broker can't find a buyer for ${item}",
      "zh": "❌ 掮客找不到愿意买{item}的买家"
    },
    "engine.104": {
      "en": "❌ You have no ${item} in the hold for the Broker to sell",
      "zh": "❌ 货舱里没有{item}可以让掮客出手"
    },
    "engine.105": {
      "en": "❌ Choose between 1 and ${held} ${item} for the Broker to sell",
      "zh": "❌ 掮客出手的{item}，1到{held}件之间选。"
    },
    "engine.106": {
      "en": "${ICONS[r.type]}${r.type}×${r.required}",
      "zh": "{ICONS[r.type]}{r.type}×{r.required}"
    },
    "engine.107": {
      "en": "🔮 The Broker only deals during Market.",
      "zh": "🔮 掮客只在开市时做生意。"
    },
    "engine.108": {
      "en": "🔮 The Broker has no more whispers...",
      "zh": "🔮 掮客没有更多低语了..."
    },
    "engine.109": {
      "en": "❌ Need ${cost} Gold for a rumor",
      "zh": "❌ 买一条传闻要{cost}金币"
    },
    "engine.110": {
      "en": "🗣️ Broker's Whisper: 'Word from ${port}: High demand for ${item}!'",
      "zh": "🗣️ 掮客低语：'{port}有消息：急需{item}！'"
    },
    "engine.111": {
      "en": "📜 Imperial Mandate at ${mandate.port}: ${need} for ${mandate.reward} Gold. The Emperor's commission is exempt from VAT.",
      "zh": "📜 {mandate.port}的皇命采办：要{need}，得{mandate.reward}金币。皇命采办免缴市舶税。"
    },
    "engine.112": { "en": "a few", "zh": "少量" },
    "engine.113": { "en": "a haul", "zh": "大量" },
    "engine.114": {
      "en": "🏴‍☠️ Pirates raided your hold! Lost all ${lost} Gold.",
      "zh": "🏴‍☠️ 海盗劫掠了你的货舱！{lost}金币全部损失。"
    },
    "engine.115": {
      "en": "🌊 Clear seas. No pirates sighted this round.",
      "zh": "🌊 海面平静。本轮没有发现海盗。"
    },
    "engine.116": {
      "en": "❌ Too late, this round's waters are already resolved",
      "zh": "❌ 太迟了，本轮的海面已经结算"
    },
    "engine.117": {
      "en": "🛡️ Hired an escort for ${cost} Gold. Safe passage guaranteed this round.",
      "zh": "🛡️ 花{cost}金币雇了护航。本轮航路安全无虞。"
    },
    "engine.118": { "en": "Active boon", "zh": "生效的机缘" },
    "engine.119": { "en": "Minimum freight", "zh": "最低运费" },
    "engine.120": { "en": "Average material cost", "zh": "平均原料成本" },
    "engine.121": {
      "en": "${recipe.worker_type === \"weaver\" ? \"Weaver\" : recipe.worker_type === \"master\" ? \"Master Weaver\" : \"Sachet Maker\"} wage",
      "zh": "{recipe.worker_type === \"weaver\" ? \"织女\" : recipe.worker_type === \"master\" ? \"纺织大师\" : \"香囊师\"}工钱"
    },
    "engine.122": {
      "en": "${Math.round(VAT_RATE * 100)}% VAT on the margin",
      "zh": "按差价计市舶税{Math.round(VAT_RATE * 100)}%"
    },
    "engine.123": { "en": "Floor at 0 Gold", "zh": "下限0金币" },
    "engine.124": {
      "en": "❌ Only a Loom captain buys rags off the harbor pile.",
      "zh": "❌ 只有织造船长才从港湾的碎布堆里买碎布。"
    },
    "engine.125": {
      "en": "❌ The harbor has no rags left for you this leg.",
      "zh": "❌ 本航段港湾没有碎布留给你了。"
    },
    "engine.126": {
      "en": "❌ ${RAG_SCRAP_VALUE} Gold buys a rag, and the purse is short.",
      "zh": "❌ 一块碎布要{RAG_SCRAP_VALUE}金币，钱袋不够。"
    },
    "engine.127": {
      "en": "❌ There is no room in the hold for another rag.",
      "zh": "❌ 货舱里放不下再多一块碎布了。"
    },
    "engine.128": {
      "en": "${ICONS.Rags} Bought a rag off the harbor pile for ${RAG_SCRAP_VALUE} Gold. ${left - 1} left for you this leg.",
      "zh": "{ICONS.Rags} 花{RAG_SCRAP_VALUE}金币从港湾的碎布堆买了一块碎布。本航段还给你剩{left - 1}块。"
    },
    "engine.129": {
      "en": "❌ Only a Loom captain knows how to work rags back into cloth.",
      "zh": "❌ 只有织造船长懂得把碎布重新织回布。"
    },
    "engine.130": {
      "en": "❌ A reweave takes ${REWEAVE_RAGS} rags and the hold has fewer.",
      "zh": "❌ 重织一次要{REWEAVE_RAGS}块碎布，货舱里不够。"
    },
    "engine.131": {
      "en": "🧵 ${REWEAVE_RAGS} rags go back on the loom and come off as one ${REWEAVE_GOOD}.",
      "zh": "🧵 {REWEAVE_RAGS}块碎布回到织机上，下来就是一件{REWEAVE_GOOD}。"
    },
    "engine.132": {
      "en": "❌ That is not something the harbor can put right.",
      "zh": "❌ 这个港湾修不了。"
    },
    "engine.133": {
      "en": "❌ The harbor tailors have already worked on the crew this leg.",
      "zh": "❌ 本航段港湾的裁缝已经给船员整补过了。"
    },
    "engine.134": {
      "en": "❌ The crew is wearing no worn ${good} for the harbor to mend.",
      "zh": "❌ 船员身上没有需要港湾缝补的破旧{good}。"
    },
    "engine.135": {
      "en": "❌ A mend costs ${MEND_GOLD_PER_POINT} Gold and the purse is short.",
      "zh": "❌ 缝补一次要{MEND_GOLD_PER_POINT}金币，钱袋不够。"
    },
    "engine.136": {
      "en": "${ICONS.Rags} The harbor tailor takes ${MEND_GOLD_PER_POINT} Gold for ${back} point of the ${good}.",
      "zh": "{ICONS.Rags} 港湾的裁缝收{MEND_GOLD_PER_POINT}金币，补回{good}的{back}点。"
    },
    "engine.137": {
      "en": "❌ There is no worn ${contract.good} left to work on.",
      "zh": "❌ 没有还需要缝补的破旧{contract.good}了。"
    },
    "engine.138": {
      "en": "🏴 Bankrupt: the harbor marks it against this captain's name for the rest of the voyage.",
      "zh": "🏴 破产：本航程余下的时间里，港湾都会把这件事记在这位船长名下。"
    },
    "engine.139": {
      "en": "🏝️ The harbor has voted to maroon this captain.",
      "zh": "🏝️ 港湾已经投票把这位船长放逐上岸。"
    },
    "engine.140": {
      "en": "⚖️ The ship and its hold are forfeit. The harbor takes ${taken} Gold and leaves ${kept} Gold aboard.",
      "zh": "⚖️ 船和货舱一并没收。港湾取走{taken}金币，船上留下{kept}金币。"
    },
    "engine.141": {
      "en": "🧭 The Harbormaster's hand: once a leg, one port's prices answer to this captain.",
      "zh": "🧭 港务长之手：每航段一次，让某个港口的价格听命于这位船长。"
    },
    "engine.142": {
      "en": "🪧 Standing orders at the port board: bought ${bought.length} cargo ${ bought.length === 1 ? \"lot\" : \"lots\" } you had priced.",
      "zh": "🪧 港口采购板上的常备委托：买下了{bought.length}件你定过价的货物。"
    },
    "engine.143": {
      "en": "🪧 Standing orders at the trade board: filled ${filled} ${ filled === 1 ? \"order\" : \"orders\" } the hold could cover.",
      "zh": "🪧 委托板上的常备委托：交付了{filled}份货舱供得上的委托。"
    },
    "engine.144": {
      "en": "❌ Insufficient funds to hire workers!",
      "zh": "❌ 资金不足，雇不起工匠！"
    },
    "engine.145": {
      "en": "${def?.icon ?? \"🧑\"} Hired ${identity.name} the ${label}! Wage: ${wage} Gold / Round (paid at round end)",
      "zh": "{def?.icon ?? \"🧑\"} 雇下了{label}{identity.name}！工钱：每轮{wage}金币（轮末支付）"
    },
    "engine.146": {
      "en": "🪷 Jade Pavilion pledge honored: this artisan joins at no cost, so the first wage is on the House.",
      "zh": "🪷 玉阁的承诺兑现：这位工匠入伙不收钱，头一笔工钱也由玉阁代付。"
    },
    "engine.147": {
      "en": "❌ Insufficient funds for ${label}'s severance: ${wage} Gold",
      "zh": "❌ 付不起{label}的遣散费：{wage}金币"
    },
    "engine.148": {
      "en": "💔 Dismissed ${worker.name} the ${label}. Severance: ${wage} Gold",
      "zh": "💔 遣散了{label}{worker.name}。遣散费：{wage}金币"
    },
    "engine.149": {
      "en": "This worker was making: ${worker.task}",
      "zh": "这位工匠本来在做：{worker.task}"
    },
    "engine.150": {
      "en": "${ICONS[m]}${m} ${have}/${a}${have < a ? \" ⚠️\" : \"\"}",
      "zh": "{ICONS[m]}{m} {have}/{a}{have < a ? \" ⚠️\" : \"\"}"
    },
    "engine.151": {
      "en": "❌ Material shortage to produce ${task}! (Have: ${short})",
      "zh": "❌ 材料不足，做不了{task}！（现有：{short}）"
    },
    "engine.152": {
      "en": "❌ All workers are already assigned tasks!",
      "zh": "❌ 所有工匠都已经安排了活计！"
    },
    "engine.153": {
      "en": "✅ Skilled ${name} finished ${amt}× ${ICONS[w.task]}${w.task}! (Bonus)",
      "zh": "✅ 熟练的{name}完成了{amt}× {ICONS[w.task]}{w.task}！（加成）"
    },
    "engine.154": {
      "en": "✅ Skilled ${name} finished ${amt}× ${ICONS[w.task]}${w.task}!",
      "zh": "✅ 熟练的{name}完成了{amt}× {ICONS[w.task]}{w.task}！"
    },
    "engine.155": {
      "en": "✅ ${name} finished ${ICONS[w.task]}${w.task}!",
      "zh": "✅ {name}完成了{ICONS[w.task]}{w.task}！"
    },
    "engine.156": {
      "en": "⭐ ${name} Promotion! Can now produce 2 items per round!",
      "zh": "⭐ {name}晋升！现在每轮可产出2件！"
    },
    "engine.157": {
      "en": "🪷 Jade Pavilion covers the wage for ${b.sponsored} ${b.sponsored === 1 ? b.label : b.plural} this round.",
      "zh": "🪷 本轮{b.sponsored}名{b.sponsored === 1 ? b.label : b.plural}的工钱由玉阁代付。"
    },
    "engine.158": {
      "en": "💰 Paid wages for ${b.count} ${b.count === 1 ? b.label : b.plural}: ${b.due} Gold",
      "zh": "💰 支付了{b.count}名{b.count === 1 ? b.label : b.plural}的工钱：{b.due}金币"
    },
    "engine.159": {
      "en": "⚠️ Insufficient funds! Needed: ${total} Gold, Have: ${state.money} Gold",
      "zh": "⚠️ 资金不足！要{total}金币，现有{state.money}金币"
    },
    "engine.160": {
      "en": "💥 Could not pay wages, the crew is left unpaid.",
      "zh": "💥 付不出工钱，工匠这一轮白干。"
    },
    "engine.161": {
      "en": "💥 Reputation collapsed: a bankruptcy is recorded.",
      "zh": "💥 声誉崩塌：记下一次破产。"
    },
    "engine.162": {
      "en": "💸 Paid Ship Maintenance Fee: ${cost} Gold",
      "zh": "💸 已付船只维护费：{cost}金币"
    },
    "engine.163": {
      "en": "⚠️ Forced payment of ${paid} Gold (Needed ${cost} Gold)",
      "zh": "⚠️ 被迫支付{paid}金币（要{cost}金币）"
    },
    "engine.164": {
      "en": "⚠️ Funds depleted: the maintenance fee goes unpaid.",
      "zh": "⚠️ 资金耗尽：维护费交不上。"
    },
    "engine.165": {
      "en": "${FOODS[food].icon} ${meals} ${meals === 1 ? \"ration\" : \"rations\"} of ${food} turned at sea. ${Math.max(0, state.larder - spoiled)} left in the larder.",
      "zh": "{FOODS[food].icon} {meals}份{food}在海上变质了。粮舱还剩{Math.max(0, state.larder - spoiled)}份。"
    },
    "engine.166": {
      "en": "❌ Not enough Produce aboard to preserve: a batch is ${PRESERVE_MEALS_IN} meals.",
      "zh": "❌ 船上的时鲜不够腌制：一批要{PRESERVE_MEALS_IN}份。"
    },
    "engine.167": {
      "en": "🐟 Preserved ${taken} ${taken === 1 ? \"ration\" : \"rations\"} of Produce into ${made} of Salt Fish (${state.larder} in the larder).",
      "zh": "🐟 把{taken}份时鲜腌成了{made}份咸鱼（粮舱里有{state.larder}份）。"
    },
    "engine.168": {
      "en": "Finish the voyage holding at least ${flourish.amount} Gold of your own.",
      "zh": "走完航程时，自己手上还留着至少{flourish.amount}金币。"
    },
    "engine.169": {
      "en": "Finish the voyage at ${flourish.amount} Reputation or better.",
      "zh": "走完航程时声誉达到{flourish.amount}或更高。"
    },
    "engine.170": {
      "en": "Finish the voyage still holding ${flourish.amount} ${flourish.good} of your own.",
      "zh": "走完航程时，自己手上还留着{flourish.amount} {flourish.good}。"
    },
    "engine.171": {
      "en": "Hand over at least ${flourish.amount} items of the commission yourself.",
      "zh": "公议的货，你本人至少交出{flourish.amount}件。"
    },
    "engine.172": {
      "en": "${name} sails the same flag you do, and the two of you know it.",
      "zh": "{name}和你挂同一面旗，你们两人都清楚。"
    },
    "engine.173": { "en": "Honest Captain", "zh": "诚信船长" },
    "engine.174": {
      "en": "You sail the public objective with the fleet. Nothing about you is hidden.",
      "zh": "你和船队同走公开的目标。你的一切，都摊在明面上。"
    },
    "engine.175": { "en": "Pirate", "zh": "海盗" },
    "engine.176": {
      "en": "You sail under a false flag. The fleet's objective has to fail, and you have to stay solvent while it does.",
      "zh": "你挂着假旗航行。船队的目标得落空，落空之前，你还得撑着不破产。"
    },
    "engine.177": {
      "en": "You sail for yourself, and only for yourself. Profit from deals with other captains, and the fleet's success is no loss to you.",
      "zh": "你为自己航行，只为自己。跟其他船长交易赚钱，船队成功也不亏你。"
    },
    "engine.178": {
      "en": "⚠️ Short rations! ${crew} aboard and the larder is empty: the crew works this leg at ${pace}% pace, and every line still brings home at least one item. The fleet can see it.",
      "zh": "⚠️ 减半口粮！船上{crew}人，粮舱已空：本航段船员按{pace}%的速度干活，每人仍至少带回一件。船队看得见。"
    },
    "engine.179": {
      "en": "🍲 The crew eats ${need} ${need === 1 ? \"ration\" : \"rations\"}. ${state.larder} left in the larder.",
      "zh": "🍲 船员吃掉{need}份口粮。粮舱还剩{state.larder}份。"
    },
    "engine.180": { "en": "🧺 The larder is full.", "zh": "🧺 粮舱已满。" },
    "engine.181": {
      "en": "❌ Not enough Gold to provision the crew: a leg of rations is ${cost} Gold.",
      "zh": "❌ 金币不够给船员备粮：一个航段的口粮要{cost}金币。"
    },
    "engine.182": {
      "en": "🧺 Provisioned ${rations} ${rations === 1 ? \"ration\" : \"rations\"} of ${food} for ${crew} aboard (${cost} Gold). ${state.larder} in the larder.",
      "zh": "🧺 给船上{crew}人备齐了口粮：{rations}份{food}，花了{cost}金币。粮舱里{state.larder}份。"
    },
    "engine.183": { "en": "Two thirds", "zh": "三分之二" },
    "engine.184": {
      "en": "${shift.port}: every price ${percent} percent ${way}",
      "zh": "{shift.port}：每个价钱{way} {percent}%"
    },
    "engine.185": { "en": "Open Water Captain", "zh": "开阔水域船长" },
    "engine.186": { "en": "Storm Sovereign", "zh": "风暴之主" },
    "engine.187": {
      "en": "Get crowned Sea Master on a ${monsoon.name} voyage.",
      "zh": "在{monsoon.name}的航程中加冕沧海之主。"
    },
    "engine.188": { "en": "Eye of the Storm", "zh": "风暴之眼" },
    "engine.189": {
      "en": "Finish a ${monsoon.name} voyage with ${EYE_OF_THE_STORM_REPUTATION}+ Reputation.",
      "zh": "走完一次{monsoon.name}的航程，声誉达到{EYE_OF_THE_STORM_REPUTATION}+。"
    },
    "engine.190": {
      "en": "This harbor was closed by the harbor operator.",
      "zh": "这个港湾已被港湾操作员关闭。"
    },
    "engine.191": {
      "en": "This account was deleted by the harbor operator.",
      "zh": "这个账号已被港湾操作员删除。"
    },
    "engine.192": {
      "en": "Sign in to use the operator console.",
      "zh": "登录后可使用操作员控制台。"
    },
    "engine.193": { "en": "No account was named.", "zh": "没有指定账号。" },
    "engine.194": {
      "en": "That account no longer exists.",
      "zh": "那个账号已经不存在了。"
    },
    "engine.195": {
      "en": "You cannot ban your own account.",
      "zh": "不能封停你自己的账号。"
    },
    "engine.196": {
      "en": "You cannot revoke your own administrator role.",
      "zh": "不能撤销你自己的管理员身份。"
    },
    "engine.197": {
      "en": "This is the only administrator left, so the role cannot be revoked.",
      "zh": "这是最后一位管理员，身份不能撤销。"
    },
    "engine.198": {
      "en": "Type ${target.username} to confirm the deletion.",
      "zh": "输入{target.username}确认删除。"
    },
    "engine.199": {
      "en": "You cannot delete your own account.",
      "zh": "不能删除你自己的账号。"
    },
    "engine.200": {
      "en": "This is the only administrator left, so the account cannot be deleted.",
      "zh": "这是最后一位管理员，账号不能删除。"
    },
    "engine.201": {
      "en": "That is not an action the console can take.",
      "zh": "这不是控制台能做的操作。"
    },
    "engine.202": {
      "en": "Select at least one account first.",
      "zh": "请先至少选择一个账号。"
    },
    "engine.203": {
      "en": "Type 1 to confirm deleting one account.",
      "zh": "输入1确认删除这一个账号。"
    },
    "engine.204": {
      "en": "Type ${ids.length} to confirm deleting ${ids.length} accounts.",
      "zh": "输入{ids.length}确认删除{ids.length}个账号。"
    },
    "engine.205": {
      "en": "The harbor spent this leg's Parley on the Manifest Audit. ${reopens} again next leg.",
      "zh": "港湾把本航段的洽谈用在了舱单稽查上。{reopens}要等到下个航段。"
    },
    "engine.206": {
      "en": "This voyage's audit has already carried.",
      "zh": "本航程的稽查表决已经通过。"
    },
    "engine.207": {
      "en": "Your name is already in for this leg's audit.",
      "zh": "本航段的稽查你已经投过票了。"
    },
    "engine.208": { "en": "Missing session", "zh": "缺少会话" },
    "engine.209": {
      "en": "Invalid or expired session",
      "zh": "会话无效或已过期"
    },
    "engine.210": { "en": "Authenticate first", "zh": "请先登录" },
    "engine.211": {
      "en": "That offer is no longer available.",
      "zh": "那份报价已经没有了。"
    },
    "engine.212": {
      "en": "You can't accept your own offer.",
      "zh": "不能接受你自己的报价。"
    },
    "engine.213": {
      "en": "That offer is only open to a specific captain.",
      "zh": "那份报价只面向指定的某位船长。"
    },
    "engine.214": {
      "en": "That captain is not here right now. Try again when they are back.",
      "zh": "那位船长现在不在。等他回来再试。"
    },
    "engine.215": {
      "en": "Flexible bartering unlocks at Renown Level ${FLEXIBLE_BARTER_UNLOCK_LEVEL}.",
      "zh": "灵活易货在声望等级{FLEXIBLE_BARTER_UNLOCK_LEVEL}解锁。"
    },
    "engine.216": {
      "en": "Could not check Renown just now. Try again in a moment.",
      "zh": "刚才查不了声望。稍等片刻再试。"
    },
    "engine.217": {
      "en": "That captain has not unlocked flexible bartering yet.",
      "zh": "那位船长还没有解锁灵活易货。"
    },
    "engine.218": {
      "en": "Every flexible trade this voyage allows you has already been taken. You can still use the Captain's Exchange and accept any offer.",
      "zh": "本航程给你的灵活交易已经全部用完。船长行市照样能用，任何报价也照样能接。"
    },
    "engine.219": {
      "en": "The harbor did not hear that leg move, so the ready check is open again. Press ready when you are done here and the voyage will carry on.",
      "zh": "港湾没有听到航段推进，就绪确认重新打开。这里忙完就点就绪，航程会继续。"
    },
    "engine.220": {
      "en": "The tide has run out for this leg, and the harbor moves on. Any captain who had not finished commits the phase's own defaults.",
      "zh": "本航段的潮水已尽，港湾照常前行。还没收尾的船长，按本阶段的默认来。"
    },
    "engine.221": { "en": "The draft is not running.", "zh": "抽取没有开。" },
    "engine.222": {
      "en": "You are not in this draft.",
      "zh": "你不在这次抽取中。"
    },
    "engine.223": {
      "en": "The table has moved past that step.",
      "zh": "全桌已经过了这一步。"
    },
    "engine.224": {
      "en": "Your card is already laid down.",
      "zh": "你的牌已经放下了。"
    },
    "engine.225": {
      "en": "That is not one of the cards in front of you.",
      "zh": "那不是摆在你面前的牌。"
    },
    "engine.226": {
      "en": "Too many actions at once. Give the harbor a moment, then try again.",
      "zh": "操作太频繁。让港湾缓一缓，再试一次。"
    },
    "engine.227": {
      "en": "The harbor has already voted one of its own ashore this voyage.",
      "zh": "本航程港湾已经投票放逐过一位自己人了。"
    },
    "engine.228": {
      "en": "The harbor has already written that captain off.",
      "zh": "港湾已经把那位船长划掉了。"
    },
    "engine.229": {
      "en": "Your name is already in for this leg's maroon vote.",
      "zh": "本航段的放逐投票你已经投过了。"
    },
    "engine.230": {
      "en": "A call in the closing leg would lean a market this voyage never opens.",
      "zh": "收尾航段里调价，拨动的会是本航程根本不会开的市场。"
    },
    "engine.231": {
      "en": "A call leans a market up or down, and that frame named neither direction.",
      "zh": "调价要让市场升或降，那一帧却没说往哪边。"
    },
    "engine.232": {
      "en": "A call has to name a port.",
      "zh": "调价，得说清是哪个港口。"
    },
    "engine.233": {
      "en": "The Harbormaster's hand belongs to the captain the harbor put ashore.",
      "zh": "港务长之手属于被港湾放逐上岸的那位船长。"
    },
    "engine.234": {
      "en": "The market this call lands on has not unlocked that port.",
      "zh": "这次调价落到的市场，还没有解锁那个港口。"
    },
    "engine.235": { "en": "Quick Start Harbor", "zh": "快速开局港湾" },
    "engine.236": { "en": "Invalid aid request", "zh": "无效的借款请求" },
    "engine.237": {
      "en": "That request is no longer open.",
      "zh": "那份请求已经不再开放。"
    },
    "engine.238": {
      "en": "You can't fund your own request.",
      "zh": "不能资助你自己的请求。"
    },
    "engine.239": { "en": "Invalid repayment", "zh": "无效的还款" },
    "engine.240": {
      "en": "That loan is no longer outstanding.",
      "zh": "那笔借款已经还清了。"
    },
    "engine.241": {
      "en": "That loan is not yours to repay.",
      "zh": "那笔借款不该由你还。"
    },
    "engine.242": { "en": "another captain", "zh": "另一位船长" },
    "engine.243": {
      "en": "You can't back a loan you're already part of.",
      "zh": "你不能为你已经参与其中的借款作保。"
    },
    "engine.244": {
      "en": "That loan already has a backer.",
      "zh": "那笔借款已经有人作保了。"
    },
    "engine.245": { "en": "Invalid barter offer", "zh": "无效的易货报价" },
    "engine.246": {
      "en": "You can't direct an offer to yourself.",
      "zh": "不能把报价指定给自己。"
    },
    "engine.247": {
      "en": "The Captain's Exchange is only open during the Parley phase.",
      "zh": "船长行市只在洽谈阶段开放。"
    },
    "engine.248": { "en": "The exchange opens", "zh": "船长行市重开" },
    "engine.249": {
      "en": "Every flexible trade that captain has this voyage is done.",
      "zh": "那位船长本航程的灵活交易已经全部用完。"
    },
    "engine.250": {
      "en": "The bazaar is not running in this harbor.",
      "zh": "这个港湾没有开香市。"
    },
    "engine.251": {
      "en": "A rumor leans a price one way or the other, and no other way.",
      "zh": "一条传闻只能把价钱往一边拨，不能往别处。"
    },
    "engine.252": {
      "en": "A rumor is spread at the Parley, where the whole table hears it.",
      "zh": "传闻在洽谈时放出，全桌的人都听得见。"
    },
    "engine.253": {
      "en": "The next port does not trade that good.",
      "zh": "下一个港口不做这种货的买卖。"
    },
    "engine.254": {
      "en": "You already have an offer standing for anyone at this table.",
      "zh": "你已经挂着一份面向全桌任何人的报价了。"
    },
    "engine.255": {
      "en": "The escort market is not running in this harbor.",
      "zh": "这个港湾没有开护航市场。"
    },
    "engine.256": {
      "en": "One leg of protection is sold in the Parley phase.",
      "zh": "一个航段的护卫在洽谈阶段卖出。"
    },
    "engine.257": { "en": "Protection is sold", "zh": "护卫开卖" },
    "engine.258": {
      "en": "You can't sell protection to yourself.",
      "zh": "不能把护卫卖给自己。"
    },
    "engine.259": {
      "en": "That offer is no longer on the board.",
      "zh": "那份报价已经不在板上了。"
    },
    "engine.260": {
      "en": "That contract has already been agreed.",
      "zh": "那份契约已经议定了。"
    },
    "engine.261": {
      "en": "That cover has already answered for a raid.",
      "zh": "那份护卫已经抵过一次劫掠了。"
    },
    "engine.262": {
      "en": "That offer has already been turned down.",
      "zh": "那份报价已经被拒绝了。"
    },
    "engine.263": {
      "en": "You are the one selling that protection.",
      "zh": "那份护卫是你自己在卖。"
    },
    "engine.264": {
      "en": "A contract is agreed in the Parley phase.",
      "zh": "契约在洽谈阶段议定。"
    },
    "engine.265": { "en": "Contracts are agreed", "zh": "契约议定" },
    "engine.266": {
      "en": "You have already turned that offer down.",
      "zh": "你已经拒过那份报价了。"
    },
    "engine.267": {
      "en": "That contract is past the offer, so there is nothing to turn down.",
      "zh": "那份契约已经过了报价的阶段，没什么可拒的。"
    },
    "engine.268": {
      "en": "That offer is open to the whole table, so there is nothing for one captain to turn down.",
      "zh": "那份报价面向全桌，轮不到某一位船长来拒。"
    },
    "engine.269": {
      "en": "Only the captain who posted an offer can take it back.",
      "zh": "只有挂出报价的船长才能收回。"
    },
    "engine.270": {
      "en": "That offer was turned down, so there is nothing to take back.",
      "zh": "那份报价已经被拒，没什么可收回的。"
    },
    "engine.271": {
      "en": "That contract has been agreed, so it can't be withdrawn.",
      "zh": "那份契约已经议定，不能撤回。"
    },
    "engine.272": {
      "en": "There is no agreed contract of yours to claim against.",
      "zh": "你没有已议定的契约可以索赔。"
    },
    "engine.273": {
      "en": "That contract covers another captain.",
      "zh": "那份契约保的是另一位船长。"
    },
    "engine.274": {
      "en": "That contract was for an earlier leg.",
      "zh": "那份契约是更早航段的。"
    },
    "engine.275": {
      "en": "The module market is not running in this harbor.",
      "zh": "这个港湾没有开模块市场。"
    },
    "engine.276": {
      "en": "A listing names a module the yard can bolt on.",
      "zh": "挂牌要写明船坞能装上的模块。"
    },
    "engine.277": {
      "en": "A module is listed in the Parley phase.",
      "zh": "模块在洽谈阶段挂牌。"
    },
    "engine.278": { "en": "Modules are listed", "zh": "模块挂牌" },
    "engine.279": {
      "en": "You can't sell a module to yourself.",
      "zh": "不能把模块卖给自己。"
    },
    "engine.280": {
      "en": "You have already listed that module this leg.",
      "zh": "本航段你已经挂过那个模块了。"
    },
    "engine.281": {
      "en": "You are the one selling that module.",
      "zh": "那个模块是你自己在卖。"
    },
    "engine.282": {
      "en": "A module trade is agreed in the Parley phase.",
      "zh": "模块交易在洽谈阶段议定。"
    },
    "engine.283": { "en": "Module trades are agreed", "zh": "模块交易议定" },
    "engine.284": {
      "en": "That module has been agreed, so the listing can't be withdrawn.",
      "zh": "那个模块已经议定，挂牌不能撤回。"
    },
    "engine.285": {
      "en": "The path draft is not running in this harbor.",
      "zh": "这个港湾没有开商道抽取。"
    },
    "engine.286": { "en": "No such path.", "zh": "没有这条商道。" },
    "engine.287": {
      "en": "Your session expired. Sign in again to use Quick Start.",
      "zh": "你的会话已过期。重新登录后可使用快速开局。"
    },
    "engine.288": {
      "en": "Could not find a harbor just now. Please try again.",
      "zh": "现在找不到可以进的港湾，请再试一次。"
    },
    "engine.289": {
      "en": "The refit bench is not running in this harbor.",
      "zh": "这个港湾没有开整补台。"
    },
    "engine.290": {
      "en": "A refit names a garment the crew can wear.",
      "zh": "整补要指定一件船员穿得上的衣物。"
    },
    "engine.291": {
      "en": "A refit is agreed at a port, in the Market phase.",
      "zh": "整补在港口的开市阶段议定。"
    },
    "engine.292": {
      "en": "You can't sell a refit to yourself.",
      "zh": "不能把整补卖给自己。"
    },
    "engine.293": {
      "en": "You have already taken on a refit this leg.",
      "zh": "本航段你已经接过一次整补了。"
    },
    "engine.294": {
      "en": "You are the one selling that refit.",
      "zh": "那次整补是你自己在卖。"
    },
    "engine.295": {
      "en": "That refit has been agreed, so it can't be withdrawn.",
      "zh": "那次整补已经议定，不能撤回。"
    },
    "engine.296": {
      "en": "This voyage has already set sail.",
      "zh": "这次航程已经起航了。"
    },
    "engine.297": {
      "en": "Only the host can start the voyage.",
      "zh": "只有港主可以启航。"
    },
    "engine.298": {
      "en": "Need at least one captain in the harbor to set sail.",
      "zh": "港湾里至少要有一位船长才能启航。"
    },
    "engine.299": {
      "en": "Tidewatch Alert: the harbor takes notice of a bustling crew. One more cargo lot joins every captain's Port Purchase board, for the rest of this voyage.",
      "zh": "观潮预警：港湾瞧见船队忙起来了。本航程余下期间，每位船长的港口采购板上都会多出一件货物。"
    },
    "engine.300": { "en": "Invalid venture.", "zh": "无效的合股。" },
    "engine.301": {
      "en": "Target must be between ${CONVOY_VENTURE_MIN_TARGET} and ${CONVOY_VENTURE_MAX_TARGET} Gold.",
      "zh": "目标金额得在{CONVOY_VENTURE_MIN_TARGET}金币到{CONVOY_VENTURE_MAX_TARGET}金币之间。"
    },
    "engine.302": {
      "en": "Too late in the voyage to post a new Venture. There's no round left that would leave time to spend the reward.",
      "zh": "航程已经太晚，挂不出新的合股。剩下的轮数不够花掉那份报酬。"
    },
    "engine.303": { "en": "Invalid contribution.", "zh": "无效的出资。" },
    "engine.304": {
      "en": "That venture is no longer open.",
      "zh": "那份合股已经不再开放。"
    },
    "engine.305": {
      "en": "That venture's deadline has already passed.",
      "zh": "那份合股已经过了截止时间。"
    },
    "engine.306": {
      "en": "You've already backed this venture as much as any single captain can. It needs another captain to fund the rest.",
      "zh": "你对这份合股的出资已经到单人上限。余下的要等另一位船长出资。"
    },
    "engine.307": {
      "en": "That venture is already fully funded.",
      "zh": "那份合股已经募足了。"
    },
    "room-a.001": { "en": "gold", "zh": "金币" },
    "room-a.002": { "en": "Cancel", "zh": "取消" },
    "room-a.003": { "en": "· ${clock.label}", "zh": "· {clock.label}" },
    "room-a.004": {
      "en": "of ${spec.durability}",
      "zh": "/{spec.durability}"
    },
    "room-a.005": { "en": "offer", "zh": "给出" },
    "room-a.006": { "en": "Weighing anchor…", "zh": "正在起锚..." },
    "room-a.007": { "en": "Harbor", "zh": "港湾" },
    "room-a.008": { "en": "Direct", "zh": "私聊" },
    "room-a.009": { "en": "Open the captain panel", "zh": "打开船长面板" },
    "room-a.010": {
      "en": "Round ${state.game.currentRound}",
      "zh": "第{state.game.currentRound}轮"
    },
    "room-a.011": { "en": "Open the Harbor Roster", "zh": "打开港湾名册" },
    "room-a.012": { "en": "Open the chat", "zh": "打开聊天" },
    "room-a.013": { "en": "Strategy tips", "zh": "策略提示" },
    "room-a.014": {
      "en": "A voyage leaves the pier when the host sets sail, not by readying up.",
      "zh": "港主起航，船才离码头；光点就绪开不了船。"
    },
    "room-a.015": {
      "en": "The Path Draft is left by laying your cards down. Each step turns over when every hand is in.",
      "zh": "落牌，择道就结束。人人都出完牌，每一步才翻开。"
    },
    "room-a.016": {
      "en": "Dawn is left by locking in a Boon. Pick one of the cards and it goes with you.",
      "zh": "锁定一份机缘，破晓就结束。挑一张，它跟着你上路。"
    },
    "room-a.017": {
      "en": "This voyage is over for you, so there is no seat left to leave.",
      "zh": "这趟航程对你已经结束，没有席位可退。"
    },
    "room-a.018": {
      "en": "Your own screen has work open on it. Finish or close it and the room moves on.",
      "zh": "你自己屏幕上还有活没干完。做完或关掉，港湾才能往下走。"
    },
    "room-a.019": { "en": "Crowned Sea Master!", "zh": "加冕沧海之主！" },
    "room-a.020": {
      "en": "Highest Reputation in the harbor this voyage: ${mine.reputation}.",
      "zh": "本航程港湾里声誉最高：{mine.reputation}。"
    },
    "room-a.021": {
      "en": "🤝 Broker's Favor unlocked!",
      "zh": "🤝 掮客的人情已解锁！"
    },
    "room-a.022": {
      "en": "Renown Level ${BROKERS_FAVOR_UNLOCK_LEVEL} reached. The Broker owes you one, starting next voyage.",
      "zh": "声望等级到{BROKERS_FAVOR_UNLOCK_LEVEL}了。下一趟航程起，掮客欠你一份人情。"
    },
    "room-a.023": {
      "en": "Captain's Merit earned: ${merit.name}",
      "zh": "船长功勋入手：{merit.name}"
    },
    "room-a.024": { "en": "📣 Word on the Docks!", "zh": "📣 码头风闻！" },
    "room-a.025": {
      "en": "First to complete ${WORD_ON_THE_DOCKS_THRESHOLD} trade orders this voyage. +${data.reward} Gold.",
      "zh": "本航程头一个交足{WORD_ON_THE_DOCKS_THRESHOLD}笔贸易委托。+{data.reward}金币。"
    },
    "room-a.026": { "en": "Word on the Docks!", "zh": "码头风闻！" },
    "room-a.027": {
      "en": "You won the race to ${WORD_ON_THE_DOCKS_THRESHOLD} orders. +${data.reward} Gold.",
      "zh": "你抢先交足{WORD_ON_THE_DOCKS_THRESHOLD}笔委托。+{data.reward}金币。"
    },
    "room-a.028": { "en": "📣 Word on the Docks", "zh": "📣 码头风闻" },
    "room-a.029": { "en": "🌊 Tidewatch Alert", "zh": "🌊 观潮预警" },
    "room-a.030": {
      "en": "The harbor takes notice of a bustling crew. One more cargo lot joins the Port Purchase board, every round, for the rest of this voyage.",
      "zh": "船队一忙，港湾就留意到了。本航程余下每一轮，港口采购板上都多一件货。"
    },
    "room-a.031": { "en": "Tidewatch Alert", "zh": "观潮预警" },
    "room-a.032": {
      "en": "The harbor crossed ${TIDEWATCH_SURGE_THRESHOLD} combined Reputation.",
      "zh": "港湾的声誉合计越过了{TIDEWATCH_SURGE_THRESHOLD}。"
    },
    "room-a.033": {
      "en": "One extra cargo lot joins every Port Purchase board, every round.",
      "zh": "每一轮，每块港口采购板上都多一件货。"
    },
    "room-a.034": { "en": "Progress saved", "zh": "进度已保存" },
    "room-a.035": {
      "en": "Your voyage is recorded on the server.",
      "zh": "你的航程已经记在服务器上了。"
    },
    "room-a.036": { "en": "Save failed", "zh": "保存失败" },
    "room-a.037": {
      "en": "Could not reach the Harbormaster.",
      "zh": "联系不上港务长。"
    },
    "room-a.038": {
      "en": "This seat is not left by pressing Next Phase",
      "zh": "按下一阶段，退不出这个席位"
    },
    "room-a.039": { "en": "Room code copied", "zh": "港湾口令已复制" },
    "room-a.040": { "en": "Harbor chat", "zh": "港湾聊天" },
    "room-a.041": { "en": "Direct messages", "zh": "私聊" },
    "room-a.042": { "en": "🌊 Anyone in the harbor", "zh": "🌊 港湾里所有人" },
    "room-a.043": {
      "en": "A majority of the captains still sailing can open one manifest. What comes back is a sample of what they filed. A carried vote ends this leg&apos;s trading, and the voyage carries on at the next leg. The count below names who is still to vote, and what the vote does when the names it needs land on one captain.",
      "zh": "仍在航的船长过半数，就能开一份舱单。开出来的是他们申报内容的抽样。表决过了，本航段的交易就到此为止，航程接着走下一航段。下面的计数写着还有谁没投，也写着所需的名字全落到同一位船长头上时，表决会起什么作用。"
    },
    "room-a.044": {
      "en": "No order fulfillments filed this voyage.",
      "zh": "本航程没有申报过一笔委托交付。"
    },
    "room-a.045": { "en": "Hide the audit", "zh": "隐藏稽查" },
    "room-a.046": { "en": "Captain to audit", "zh": "待稽查船长" },
    "room-a.047": { "en": "Call the audit", "zh": "发起稽查" },
    "room-a.048": { "en": "Open ${name}'s manifest", "zh": "打开{name}的舱单" },
    "room-a.049": {
      "en": "A captain the harbor has written off cannot be audited.",
      "zh": "港湾已经划掉的船长，稽查不了。"
    },
    "room-a.050": {
      "en": "an empty larder: this captain's crew is on short rations.",
      "zh": "粮舱空空：这位船长的船员在吃减半口粮。"
    },
    "room-a.051": {
      "en": "an empty larder, with no crew aboard to go hungry.",
      "zh": "粮舱空空，船上没有船员会挨饿。"
    },
    "room-a.052": {
      "en": "rations aboard, eaten one a head each leg.",
      "zh": "船上有口粮，每航段每人吃一份。"
    },
    "room-a.053": {
      "en": "${ reveal.flagged ? \"The harbor's own checks could not reconcile this manifest, so its lines are withheld.\" : \"A random sample of this captain's most recent order fulfillments, opened by a vote of the harbor. Their card, their Gold and the rest of their hold were not opened.\" } Opened by a majority in leg ${reveal.round}, which closed that leg's trading; the finding stays on the table for the rest of the voyage.",
      "zh": "{ reveal.flagged ? \"港湾自己的核验对不上这份舱单，内容就不公开。\" : \"港湾投票开出的抽样，取自这位船长最近交付的委托。他的手牌、金币和货舱里其余的东西都没有打开。\" }第{reveal.round}航段过半数票开启，那一段的交易就此结束；这条结论在本航程余下期间留在桌上。"
    },
    "room-a.054": { "en": "for", "zh": "换取" },
    "room-a.055": { "en": "🤝 Trade", "zh": "🤝 交易" },
    "room-a.056": { "en": "🔒 Flexible bartering", "zh": "🔒 灵活易货" },
    "room-a.057": {
      "en": "The Captain's Exchange at the Parley is open to you already.",
      "zh": "洽谈里的船长行市，已经对你开了。"
    },
    "room-a.058": { "en": "I'll give", "zh": "我给出" },
    "room-a.059": { "en": "I want", "zh": "我想要" },
    "room-a.060": { "en": "🤝 Post Offer", "zh": "🤝 挂出报价" },
    "room-a.061": { "en": "Amount to offer", "zh": "给出的数量" },
    "room-a.062": { "en": "Item to offer", "zh": "给出的货物" },
    "room-a.063": { "en": "Amount to request", "zh": "索要的数量" },
    "room-a.064": { "en": "Item to request", "zh": "索要的货物" },
    "room-a.065": {
      "en": "Direct this offer to a specific captain",
      "zh": "把这份报价发给指定船长"
    },
    "room-a.066": {
      "en": "Every flexible trade this voyage allows you has been taken. You can still use the Captain's Exchange and accept any offer.",
      "zh": "本航程给你的灵活交易已经用光。船长行市还开着，报价你照样可以接。"
    },
    "room-a.067": { "en": "Speak for", "zh": "为" },
    "room-a.068": { "en": "leaning", "zh": "押" },
    "room-a.069": { "en": "📈 Higher", "zh": "📈 看涨" },
    "room-a.070": { "en": "📉 Lower", "zh": "📉 看跌" },
    "room-a.071": { "en": "Spoken.", "zh": "已发声。" },
    "room-a.072": {
      "en": "${SELLER_PATH.crest} ${SELLER_PATH.name} Bazaar",
      "zh": "{SELLER_PATH.crest} {SELLER_PATH.name}香市"
    },
    "room-a.073": { "en": "Good the rumor is about", "zh": "传闻说的是哪件货" },
    "room-a.074": {
      "en": "No commodity on this route is traded yet, so there is nothing to say.",
      "zh": "这条航路上还没有货物成交，没什么可说的。"
    },
    "room-a.075": {
      "en": "Nobody has spoken at the bazaar yet this voyage.",
      "zh": "本航程还没有人在香市开口。"
    },
    "room-a.076": {
      "en": "Nobody has spoken in this leg or the one before it. The board keeps those two legs and no more. Older rows moved markets the room has already priced and traded through.",
      "zh": "本航段和上一段都没人开口。板上只留这两段，再早的不留。更早的行拨动过的市场，全桌早就定价、交易过了。"
    },
    "room-a.077": {
      "en": "Spoken in this leg. The next port prices this good against it, and the table reads which way you leaned the moment it does.",
      "zh": "本航段已发声。下一港给这件货定价，就对着它来；价一落定，全桌都看得出你押的是哪一边。"
    },
    "room-a.078": {
      "en": "Spoken in this leg. The direction belongs to the speaker until the next port prices it, so nobody at this table can tell a call from a lie yet.",
      "zh": "本航段已发声。下一港定价之前，方向只有开口的人自己知道，所以全桌此刻分不清这句是真话还是谎话。"
    },
    "room-a.079": {
      "en": "The market of this leg was priced against it, so the direction is public now.${ outcome ?",
      "zh": "本航段的市场就是对着它定的价，方向如今人人都看得见。{ outcome ?"
    },
    "room-a.080": { "en": "Close", "zh": "关闭" },
    "room-a.081": { "en": "Escort Market", "zh": "护航市场" },
    "room-a.082": { "en": "One leg of cover for", "zh": "一航段护卫，价钱" },
    "room-a.083": {
      "en": "Offer this contract to a specific captain",
      "zh": "把这份契约发给指定船长"
    },
    "room-a.084": {
      "en": "before the Parley closes.",
      "zh": "在洽谈结束之前。"
    },
    "room-a.085": {
      "en": "Nothing is on the market yet. Name a price and post the first offer, or wait and let a buyer come to you.",
      "zh": "市场上还是空的。开个价，挂上头一份报价；不想开，就等着买家上门。"
    },
    "room-a.086": {
      "en": "No protection is on offer this Parley. Only a Convoy captain at this table can sell one leg of cover, so their offer is what you are waiting for. An offer aimed at one captain waits on that captain, and an offer aimed at the table is any captain's to take.",
      "zh": "本次洽谈没有护卫可买。一航段护卫只有本桌的镖行船长卖得出，你要等的就是他的报价。点名给某位船长的，就等那位船长；挂给全桌的，谁先接就是谁的。"
    },
    "room-a.087": { "en": "${crest} Take Cover", "zh": "{crest} 接下护卫" },
    "room-a.088": { "en": "Turn It Down", "zh": "拒绝" },
    "room-a.089": { "en": "a captain", "zh": "某位船长" },
    "room-a.090": { "en": "Expired with the leg", "zh": "随航段结束失效" },
    "room-a.091": { "en": "Waiting on ${who}", "zh": "等{who}" },
    "room-a.092": { "en": "Waiting on the table", "zh": "等全桌" },
    "room-a.093": { "en": "Waiting on you", "zh": "等你" },
    "room-a.094": { "en": "Open to the table", "zh": "面向全桌" },
    "room-a.095": {
      "en": "Agreed: you are covering",
      "zh": "已同意：由你护卫"
    },
    "room-a.096": { "en": "Agreed: you are covered", "zh": "已同意：你受护卫" },
    "room-a.097": { "en": "Agreed", "zh": "已同意" },
    "room-a.098": {
      "en": "Cover spent: your guns answered",
      "zh": "护卫已用：你的炮口接下了劫掠"
    },
    "room-a.099": { "en": "Cover spent", "zh": "护卫已用" },
    "room-a.100": { "en": "You turned it down", "zh": "你拒绝了" },
    "room-a.101": { "en": "Turned down by ${who}", "zh": "被{who}拒绝" },
    "room-a.102": {
      "en": "🛡️ Your offer stands: ${one.fee} Gold for one leg of cover, open to every captain here. The first to take it gets it.",
      "zh": "🛡️ 你的报价还挂着：一航段护卫，{one.fee}金币，本桌每位船长都能接。谁先接，护卫归谁。"
    },
    "room-a.103": {
      "en": "🛡️ ${standing.length} offers of yours stand this Parley, the newest at ${standing[standing.length - 1].fee} Gold. Each waits on the captain it names, or on the first captain to take an open one.",
      "zh": "🛡️ 本次洽谈你有{standing.length}份报价挂着，最新的一份{standing[standing.length - 1].fee}金币。点名给谁的，就等谁；挂给全桌的，谁先接算谁的。"
    },
    "room-a.104": { "en": "${contract.fee} Gold", "zh": "{contract.fee}金币" },
    "room-a.105": {
      "en": "You are selling one leg of cover for ${fee}",
      "zh": "你在卖一航段护卫，价钱{fee}"
    },
    "room-a.106": {
      "en": "You are covering ${other} for ${fee} this leg",
      "zh": "本航段你替{other}护卫，价钱{fee}"
    },
    "room-a.107": {
      "en": "Your guns answered a raid meant for ${other}",
      "zh": "本该落在{other}头上的劫掠，由你的炮口接下"
    },
    "room-a.108": {
      "en": "${other} turned down your offer of ${fee}",
      "zh": "{other}拒绝了你{fee}的报价"
    },
    "room-a.109": { "en": "Save", "zh": "保存" },
    "room-a.110": { "en": "Restart", "zh": "重开" },
    "room-a.111": { "en": "Open the harbor guide", "zh": "打开港湾指南" },
    "room-a.112": { "en": "Save the voyage", "zh": "保存航程" },
    "room-a.113": { "en": "Restart the voyage", "zh": "重开航程" },
    "room-a.114": {
      "en": "Show all keyboard shortcuts",
      "zh": "显示全部快捷键"
    },
    "room-a.115": { "en": "Keyboard shortcuts", "zh": "快捷键" },
    "room-a.116": { "en": "Game Over", "zh": "游戏结束" },
    "room-a.117": { "en": "Waiting for host…", "zh": "等港主..." },
    "room-a.118": { "en": "Need one captain", "zh": "还差一位船长" },
    "room-a.119": { "en": "Start Solo Practice", "zh": "开始单人练习" },
    "room-a.120": { "en": "Start the Voyage", "zh": "开始航程" },
    "room-a.121": { "en": "Drafting Paths...", "zh": "正在择道..." },
    "room-a.122": { "en": "Drafting Boon...", "zh": "正在抽取机缘..." },
    "room-a.123": { "en": "On Voyage...", "zh": "航行中..." },
    "room-a.124": { "en": "Next Phase", "zh": "下一阶段" },
    "room-a.125": { "en": "Saving…", "zh": "保存中..." },
    "room-a.126": { "en": "Saved", "zh": "已保存" },
    "room-a.127": {
      "en": "Standing orders are written and on",
      "zh": "常备委托已写好并启用"
    },
    "room-a.128": {
      "en": "Write what your seat should do when the clock plays it",
      "zh": "写下席位在计时替你出牌时该怎么做"
    },
    "room-a.129": {
      "en": "Restart the voyage for everyone in the harbor",
      "zh": "为港湾内所有人重开航程"
    },
    "room-a.130": { "en": "📜 Ledger", "zh": "📜 账簿" },
    "room-a.131": {
      "en": "The ledger is empty. Set sail to begin recording your voyage.",
      "zh": "账簿还是空的。一起航，你的航程就开始记了。"
    },
    "room-a.132": {
      "en": "Every ledger update, harbor message, and direct message this session",
      "zh": "本次会话中的每一笔账簿更新、港湾消息和私聊"
    },
    "room-a.133": {
      "en": "Nothing yet this voyage.",
      "zh": "本航程还没有记下什么。"
    },
    "room-a.134": { "en": "Broker's Rumor Board", "zh": "掮客传闻板" },
    "room-a.135": {
      "en": "Spend gold to reveal what Orders will ask for!",
      "zh": "花点金币，看看委托会要什么！"
    },
    "room-a.136": {
      "en": "The Broker only deals during Market.",
      "zh": "掮客只在开市时做生意。"
    },
    "room-a.137": { "en": "📜 Revealed Intel:", "zh": "📜 已揭示的情报：" },
    "room-a.138": {
      "en": "✨ No rumors revealed yet... Spend gold to listen to the Broker's whispers.",
      "zh": "✨ 还没揭开任何传闻... 花点金币，听听掮客低语。"
    },
    "room-a.139": { "en": "Restart the voyage?", "zh": "重开航程？" },
    "room-a.140": {
      "en": "Every captain currently in this harbor goes back to round one: gold, cargo, workers, and ship upgrades all reset. The harbor also reopens, so new captains can join again. This can't be undone.",
      "zh": "港湾里现有的船长一律回到第一轮：金币、货物、工匠和船只升级全部清零。港湾重新开放，新船长还能再进来。这一步收不回来。"
    },
    "room-a.141": { "en": "Restart for Everyone", "zh": "为所有人重开" },
    "room-a.142": { "en": "Leave the voyage?", "zh": "离开航程？" },
    "room-a.143": {
      "en": "The harbor sails on without you: your seat is written off, and the gold and cargo you were carrying go with it. You can start or join a new harbor right away. This can't be undone.",
      "zh": "港湾没有你照样开航：你的席位就此除名，你身上的金币和货也一并带走。你随时可以自己开一个港湾，或加入别的港湾。这一步收不回来。"
    },
    "room-a.144": { "en": "Leave the Voyage", "zh": "离开航程" },
    "room-a.145": { "en": "🚢 Set Sail!", "zh": "🚢 扬帆起航！" },
    "room-a.146": { "en": "Skip tutorial", "zh": "跳过教程" },
    "room-a.147": { "en": "Navigation Guide", "zh": "航行指南" },
    "room-a.148": {
      "en": "${APP_NAME} rules and shortcuts",
      "zh": "{APP_NAME} 规则与快捷键"
    },
    "room-a.149": { "en": "Trade Strategy Advice", "zh": "交易策略建议" },
    "room-a.150": { "en": "Close Board", "zh": "关闭面板" },
    "room-a.151": { "en": "Dues", "zh": "港务费" },
    "room-a.152": { "en": "Ledger", "zh": "账簿" },
    "room-a.153": { "en": "attention needed", "zh": "需要注意" },
    "room-a.154": { "en": "Leave", "zh": "离开" },
    "room-a.155": { "en": "Leave the harbor", "zh": "离开港湾" },
    "room-a.156": { "en": "Live", "zh": "已连接" },
    "room-a.157": { "en": "Linking…", "zh": "连接中..." },
    "room-a.158": {
      "en": "Colorblind safe palette on, click to use the default colors",
      "zh": "已开启色盲友好配色，点击恢复默认颜色"
    },
    "room-a.159": {
      "en": "Use a colorblind safe palette for goods",
      "zh": "为货物启用色盲友好配色"
    },
    "room-a.160": {
      "en": "Harbor sounds on, click to mute",
      "zh": "港湾音效已开启，点击静音"
    },
    "room-a.161": {
      "en": "Turn on harbor sounds and UI feedback",
      "zh": "开启港湾音效与界面提示音"
    },
    "room-a.162": { "en": "Mute harbor sounds", "zh": "静音港湾音效" },
    "room-a.163": { "en": "Turn on harbor sounds", "zh": "开启港湾音效" },
    "room-a.164": {
      "en": "🧭 The Harbormaster&apos;s Hand",
      "zh": "🧭 港务长之手"
    },
    "room-a.165": { "en": "Choose a port", "zh": "选一个港" },
    "room-a.166": { "en": "Lean prices up", "zh": "抬高价格" },
    "room-a.167": { "en": "Lean prices down", "zh": "压低价格" },
    "room-a.168": {
      "en": "A later call in this leg replaces this one.",
      "zh": "本航段内后一次的押注会取代这一次。"
    },
    "room-a.169": { "en": "Maroon", "zh": "放逐" },
    "room-a.170": { "en": "Hide the vote", "zh": "隐藏表决" },
    "room-a.171": { "en": "Port to lean", "zh": "要押的港" },
    "room-a.172": {
      "en": "${MAROON_VOTE_SHARE} of the captains still sailing, rounded up, can put one captain ashore. The vote is public. Once a vote carries it is spent for the whole voyage, a vote that falls short can be called again on a later leg, and the captain who loses it keeps their seat at the table.",
      "zh": "仍在航的船长里，{MAROON_VOTE_SHARE}（向上取整）赞成，就能把一位船长放逐上岸。表决是公开的。表决一过，本航程就把它用掉了；票数不够的，之后的航段还能再发起；输掉的那位照样保有席位。"
    },
    "room-a.173": { "en": "Captain to maroon", "zh": "待放逐船长" },
    "room-a.174": { "en": "Call the vote", "zh": "发起表决" },
    "room-a.175": { "en": "Put ${name} ashore", "zh": "把{name}放逐上岸" },
    "room-a.176": {
      "en": "${MAROON_VOTE_SHARE} of the captains still in the voyage carry it, rounded up, and the vote is public: every name behind a target is on this board.",
      "zh": "仍在航程中的船长，{MAROON_VOTE_SHARE}（向上取整）赞成即通过；表决是公开的：谁把名字给了谁，这块板上都写着。"
    },
    "room-a.177": { "en": "in force", "zh": "已生效" },
    "room-a.178": {
      "en": "Called in leg ${shift.round}. Every price at that port this leg was drawn against it.",
      "zh": "第{shift.round}航段发起。本航段那个港的每个价钱，都是对着它定的。"
    },
    "room-a.179": {
      "en": "Called in leg ${shift.round}. The market that opens next leg is the one that answers it, and a later call in this leg replaces it.",
      "zh": "第{shift.round}航段发起。下一航段开市，市场就是它的回音；本航段里后押的一次会取代它。"
    },
    "room-a.180": {
      "en": "Every module on your hull is already on the board this leg. The market opens again next leg.",
      "zh": "本航段你船体上的模块都已挂到板上。市场在下一航段重开。"
    },
    "room-a.181": { "en": "Sell", "zh": "出售" },
    "room-a.182": {
      "en": "${UNKNOWN_MODULE_ICON} Module Market",
      "zh": "{UNKNOWN_MODULE_ICON} 模块市场"
    },
    "room-a.183": {
      "en": "The module this listing sells",
      "zh": "这条挂单卖的模块"
    },
    "room-a.184": {
      "en": "Offer this module to a specific captain",
      "zh": "把这个模块发给指定船长"
    },
    "room-a.185": {
      "en": "Nothing on the market yet. List a module and yours is the first row. A listing comes off the board when the leg turns or the Parley closes, so a row you posted earlier may already be gone.",
      "zh": "市场上还是空的。挂出一个模块，你的就是第一行。航段一换或洽谈一结束，挂单就从板上撤下，所以你早先挂出的那一行可能已经没了。"
    },
    "room-a.186": {
      "en": "No modules on offer this Parley. Any captain with a module bolted on can list one, and a listing aimed at one captain waits on that captain.",
      "zh": "本次洽谈没有模块在售。船体上装了模块的船长都能挂出一个；指名给谁的挂单，就等谁。"
    },
    "room-a.187": {
      "en": "Every slot on your hull is full. Make room at the yard first.",
      "zh": "船体上的仓位已经满了，先去船坞腾个地方。"
    },
    "room-a.188": { "en": "${icon} Take It", "zh": "{icon} 接下" },
    "room-a.189": { "en": "${trade.fee} Gold", "zh": "{trade.fee}金币" },
    "room-a.190": {
      "en": "You are selling ${name} for ${fee}",
      "zh": "你在卖{name}，价钱{fee}"
    },
    "room-a.191": {
      "en": "You sold ${name} to ${other} for ${fee}",
      "zh": "你把{name}卖给了{other}，价钱{fee}"
    },
    "room-a.192": { "en": "Fleet Commission", "zh": "船队公议" },
    "room-a.193": {
      "en": "The commission is met, and nothing more is owed.",
      "zh": "公议已达成，不必再交。"
    },
    "room-a.194": {
      "en": "The Emperor pays for what you hand over, and the commission is read when the voyage ends.",
      "zh": "皇帝按你交上的货付钱，公议在航程结束时结算。"
    },
    "room-a.195": { "en": "🧭 Open Boons", "zh": "🧭 公开机缘" },
    "room-a.196": {
      "en": "Every compass draw is public: the three cards each captain was shown, and the one they kept.",
      "zh": "每次罗盘抽取都是公开的：每位船长看过哪三张牌，又留下了哪一张。"
    },
    "room-a.197": { "en": "a moment", "zh": "某个时刻" },
    "room-a.198": { "en": "the dawn draw", "zh": "破晓抽取" },
    "room-a.199": { "en": "(you)", "zh": "（你）" },
    "room-a.200": { "en": "💥 Bankrupt, spectating", "zh": "💥 破产，观战中" },
    "room-a.201": { "en": "🏁 Voyage complete", "zh": "🏁 航程圆满" },
    "room-a.202": { "en": "Detailed voyage status", "zh": "航程状态详情" },
    "room-a.203": {
      "en": "Asking the harbor master…",
      "zh": "正在询问港务长..."
    },
    "room-a.204": { "en": "📦 Cargo", "zh": "📦 货物" },
    "room-a.205": { "en": "Raw Materials", "zh": "原材料" },
    "room-a.206": { "en": "Finished Goods", "zh": "成品" },
    "room-a.207": { "en": "👥 Workers", "zh": "👥 工匠" },
    "room-a.208": { "en": "No artisans hired yet.", "zh": "还没有雇工匠。" },
    "room-a.209": { "en": "🔧 Equipped Modules", "zh": "🔧 已装模块" },
    "room-a.210": { "en": "No modules installed.", "zh": "还没装模块。" },
    "room-a.211": { "en": "Recent Log", "zh": "最近记录" },
    "room-a.212": { "en": "Nothing logged yet.", "zh": "还没有记录。" },
    "room-a.213": { "en": "Captain Comparison", "zh": "船长对比" },
    "room-a.214": { "en": "vs", "zh": "对" },
    "room-a.215": { "en": "Ship Level", "zh": "船只等级" },
    "room-a.216": { "en": "The Ship's Books", "zh": "船只账簿" },
    "room-a.217": { "en": "Loading…", "zh": "加载中..." },
    "room-a.218": { "en": "Unavailable", "zh": "不可用" },
    "room-a.219": {
      "en": "Not available right now, they may have stepped away.",
      "zh": "现在看不了，对方可能走开了一会儿。"
    },
    "room-a.220": {
      "en": "Cargo, artisans, equipped modules and the recent log.",
      "zh": "货物、工匠、已装模块和最近记录。"
    },
    "room-a.221": { "en": "Your card alone", "zh": "只有你可见" },
    "room-a.222": { "en": "Your own goal", "zh": "你自己的目标" },
    "room-a.223": { "en": "Not alone", "zh": "另有同伴" },
    "room-a.224": { "en": "How you win", "zh": "你的取胜之道" },
    "room-a.225": { "en": "Profit so far", "zh": "目前盈利" },
    "room-a.226": { "en": "Gold, offered to", "zh": "金币，交给" },
    "room-a.227": { "en": "Fee in Gold", "zh": "以金币计的费用" },
    "room-a.228": {
      "en": "This leg ends when the clock does, whether or not every captain has readied.",
      "zh": "计时一停，本航段就结束，不管是不是每位船长都点了就绪。"
    },
    "room-a.229": {
      "en": "${m?.displayName ?? \"Captain\"} ${isReady ? \"ready\" : \"still deciding\"}",
      "zh": "{m?.displayName ?? \"船长\"} {isReady ? \"已就绪\" : \"仍在考虑\"}"
    },
    "room-a.230": {
      "en": "You have already taken on a refit this leg, and one pair of hands works one garment. The bench opens again next leg.",
      "zh": "本航段你已经接过一单整补，一双手只做一件衣物。整补台在下一航段重开。"
    },
    "room-a.231": { "en": "Put right", "zh": "修补" },
    "room-a.232": { "en": "Harbor pile", "zh": "港湾布堆" },
    "room-a.233": { "en": "Harbor tailors", "zh": "港湾裁缝" },
    "room-a.234": {
      "en": "have already worked on the crew this leg. Another garment waits for tomorrow.",
      "zh": "本航段已经替船员修补过了。另一件衣物，得等明天。"
    },
    "room-a.235": {
      "en": "The garment this refit works on",
      "zh": "这份整补所修的衣物"
    },
    "room-a.236": { "en": "one point", "zh": "一点" },
    "room-a.237": { "en": "${MEND_POINTS} points", "zh": "{MEND_POINTS}点" },
    "room-a.238": {
      "en": "Offer this refit to a specific captain",
      "zh": "把这份整补发给指定船长"
    },
    "room-a.239": {
      "en": "before the Market closes.",
      "zh": "在开市结束之前。"
    },
    "room-a.240": {
      "en": "rag left for you this leg",
      "zh": "本航段留给你的一块碎布"
    },
    "room-a.241": {
      "en": "rags left for you this leg",
      "zh": "本航段留给你的碎布"
    },
    "room-a.242": {
      "en": "No rags came ashore this leg. The pile only fills after a cold one.",
      "zh": "本航段没有碎布上岸。布堆是走过一段寒程才添的。"
    },
    "room-a.243": {
      "en": "The pile is what the fleet's scrap comes to after a cold leg, and it is drawn from the voyage's own weather. ${REWEAVE_RAGS} rags go back on the loom as one ${REWEAVE_GOOD}.",
      "zh": "布堆是船队走完一段寒程后攒下的碎布，取的是本航程自己的天气。{REWEAVE_RAGS}块碎布回到织机，织成一件{REWEAVE_GOOD}。"
    },
    "room-a.244": {
      "en": "have nothing to put right. Nobody in the crew is wearing anything.",
      "zh": "没什么可修补的。船员身上一件衣物都没有。"
    },
    "room-a.245": {
      "en": "have nothing to put right. The crew's clothes are whole.",
      "zh": "没什么可修补的。船员身上的衣物都完好。"
    },
    "room-a.246": {
      "en": "Nothing on the bench yet. Your offer is the first.",
      "zh": "台上还是空的。你的报价就是头一份。"
    },
    "room-a.247": {
      "en": "No refit work on offer this leg.",
      "zh": "本航段没有在售的整补活计。"
    },
    "room-a.248": {
      "en": "Nothing left to put right on your ${row.good}.",
      "zh": "你的{row.good}没什么可补的了。"
    },
    "room-a.249": { "en": "${crest} Take It", "zh": "{crest} 接下" },
    "room-a.250": { "en": "${row.fee} Gold", "zh": "{row.fee}金币" },
    "room-a.251": {
      "en": "You are offering to put a ${row.good} right for ${fee}",
      "zh": "你出价修补{row.good}，价钱{fee}"
    },
    "room-a.252": {
      "en": "You put ${who === \"you\" ? \"your\" :",
      "zh": "你把{who === \"you\" ? \"自己\" :"
    },
    "room-a.253": {
      "en": "} ${row.good} right for ${fee}",
      "zh": "}的{row.good}修补好了，费用{fee}"
    },
    "room-a.254": { "en": "🃏 The Reveal", "zh": "🃏 摊牌" },
    "room-a.255": {
      "en": "Every card in this harbor, face up",
      "zh": "港湾里每一张牌，全部亮出"
    },
    "room-a.256": { "en": "Show them all", "zh": "全部亮出" },
    "room-a.257": { "en": "Their card promised", "zh": "其牌上承诺的" },
    "room-a.258": { "en": "No card", "zh": "无牌" },
    "room-a.259": {
      "en": "This seat took a berth after the hand was drawn, so the voyage wagered nothing on them and they won nothing from it.",
      "zh": "这个席位是在牌发完之后才上船的，所以本航程没在他身上下过注，他也从中赢不到什么。"
    },
    "room-a.260": { "en": "Their own goal", "zh": "他自己的目标" },
    "room-a.261": { "en": "📜 The Replay Ledger", "zh": "📜 回放账簿" },
    "room-a.262": {
      "en": "No leg of this commission was recorded, so there is no curve to draw.",
      "zh": "这次公议没有留下任何航段记录，曲线也就画不出来。"
    },
    "room-a.263": {
      "en": "What was traded on the record",
      "zh": "账面上成交过什么"
    },
    "room-a.264": {
      "en": "No order fulfillment survived the voyage, which happens when a harbor buys and sells mostly through each other.",
      "zh": "本航程一笔委托交付都没留下，港湾里若多是船长们彼此买卖，就会这样。"
    },
    "room-a.265": { "en": "No card dealt", "zh": "没有发牌" },
    "room-a.266": { "en": "🚫 Ledger unreadable", "zh": "🚫 账簿读不出来" },
    "room-a.267": { "en": "✅ Won the voyage", "zh": "✅ 赢得了本航程" },
    "room-a.268": { "en": "❌ Did not win", "zh": "❌ 未能取胜" },
    "room-a.269": { "en": "Filled", "zh": "已交足" },
    "room-a.270": {
      "en": "${step.delivered} of ${step.required}",
      "zh": "{step.delivered} / {step.required}"
    },
    "room-a.271": {
      "en": "The fleet handed over what its captains reported each leg, and the Emperor read the board when the voyage ended.",
      "zh": "船队每航段交出的，是船长们申报的数量；航程结束时，皇帝照着板上的数字来核。"
    },
    "room-a.272": {
      "en": "The fleet handed over nothing it reported.",
      "zh": "船队申报了，交出来的却是零。"
    },
    "room-a.273": {
      "en": "Instructions your seat follows when the room&apos;s clock plays it while you are not standing at it.",
      "zh": "你不在席位边上时，港湾的计时替你出牌，你的席位就照着这里写的走。"
    },
    "room-a.274": {
      "en": "Three seats are deliberately not here. Parley is a conversation with a captain, which is not something a form can answer. The module draft is rolled fresh every round, so there is no honest way to name one ahead of it. And the Broker&apos;s Favor is a decision rather than a default, so it is left for you to spend.",
      "zh": "这里故意空着三件事。洽谈是你和船长的一番对话，一张表格答不了。模块抽取每轮重新掷，事前写下名字并不诚实。掮客的人情是一次决定，不是默认，留给你自己花。"
    },
    "room-a.275": {
      "en": "Kept with this voyage, and the table does not see it.",
      "zh": "只随本航程保存，全桌看不到。"
    },
    "room-a.276": {
      "en": "Dearest you will pay for ${good}",
      "zh": "你为{good}肯出的最高价"
    },
    "room-a.277": { "en": "Follow these orders", "zh": "照这些指示走" },
    "room-a.278": {
      "en": "When the room's clock runs a phase out and you have not acted, your seat is played by what is written here instead of by the engine's own defaults. Turn this off and every seat goes back to being played the way it was before this panel existed. Nothing written below is lost either way.",
      "zh": "港湾的计时把阶段走完，你还没出手，你的席位就照这里写的来，不照引擎自己的默认来。关掉它，所有席位就回到这个面板出现之前的执行方式。开关怎么拨，下面写的东西都不会丢。"
    },
    "room-a.279": {
      "en": "Which boon to take when the draft is settled for you. A boon that is not on your board that round is passed over, so a name written here is never a promise the draft cannot keep.",
      "zh": "抽取替你定下时取哪一份机缘。那一轮不在你板上的机缘直接跳过；写在这里的名字，绝不会是抽取兑现不了的承诺。"
    },
    "room-a.280": {
      "en": "Each good you mark is bought from the purchase board whenever every good on that card is at or under the price you set, in the order the board is laid out. Anything dearer is left on the board.",
      "zh": "你勾中的货，只要同一张牌上的货都不高于你设的价，就按板上的顺序买进。贵过头的留在板上。"
    },
    "room-a.281": {
      "en": "The trade board, filled the way a captain would fill it: only what the hold can actually cover, in the order the orders are laid out, and left alone when the hold cannot cover it. Nothing is bought to complete an order, so one your hold cannot pay for in goods is skipped rather than chased.",
      "zh": "委托板照船长自己的做法来交付：只动货舱真拿得出的货，按委托排的先后，货舱拿不出就不碰。不会为了交一份委托去买货；货舱拿不出货来付的那一份，跳过，不去追。"
    },
    "room-a.282": {
      "en": "Fill every order the hold can cover",
      "zh": "货舱拿得出的委托，每一份都交付"
    },
    "room-a.283": {
      "en": "The shipyard's one standing choice: the next ship level, bought the moment the shipyard opens if the purse covers it. The purse and the hull's own ceiling are checked by the engine, so an order to upgrade that cannot be paid for simply does nothing.",
      "zh": "船坞唯一的常备选择：升下一级船，船坞一开、钱袋够就买下。钱袋和船体自己的上限由引擎核对，付不起的升级指令就什么也不做。"
    },
    "room-a.284": {
      "en": "Upgrade the hull when you can afford it",
      "zh": "付得起时升级船体"
    },
    "room-a.285": {
      "en": "First offer on the board",
      "zh": "板上最先摆下的一份"
    },
    "room-a.286": {
      "en": "Whatever the draft laid down first, which is what an absent captain is given today.",
      "zh": "抽取最先摆下的那一份，今天缺位的船长拿到的就是这个。"
    },
    "room-a.287": { "en": "Choose a captain", "zh": "选一位船长" },
    "room-a.288": { "en": "Your name is in", "zh": "你的名字已投出" },
    "room-a.289": {
      "en": "The room&apos;s count has not arrived yet. It comes with this leg&apos;s vote.",
      "zh": "港湾的票数还没到，它随本航段的表决一起来。"
    },
    "room-a.290": {
      "en": "${leader.name} needs ${ leader.short === 1 ? \"1 more name\" :",
      "zh": "{leader.name}还需要{ leader.short === 1 ? \"1个名字\" :"
    },
    "room-a.291": { "en": "} to carry it.", "zh": "}才能通过。" },
    "room-a.292": {
      "en": "Your name is not in yet. Pick a captain and press the button.",
      "zh": "你的名字还没投。选一位船长，按下按钮。"
    },
    "room-a.293": {
      "en": "Every captain still sailing has named someone, so nothing more can land this leg. A later leg can call this vote again.",
      "zh": "仍在航的船长都投过了，本航段不会再有票落下来。之后的航段还能再发起这次表决。"
    },
    "room-a.294": { "en": "The voyage log", "zh": "航程日志" },
    "room-a.295": { "en": "The harbor&apos;s log", "zh": "港湾日志" },
    "room-a.296": {
      "en": "The harbor has recorded nothing on this voyage yet.",
      "zh": "本航程港湾还没有记下任何东西。"
    },
    "room-a.297": { "en": "Sent to you alone", "zh": "只发给你" },
    "room-a.298": {
      "en": "Nothing has been sent to you alone on this voyage.",
      "zh": "本航程还没有单独发给你的东西。"
    },
    "room-a.299": { "en": "Ship", "zh": "船只" },
    "room-b.001": { "en": "Ship Fleet Bankrupt!", "zh": "船队破产！" },
    "room-b.002": { "en": "Rounds Completed:", "zh": "已完成轮数：" },
    "room-b.003": { "en": "Final Funds:", "zh": "最终资金：" },
    "room-b.004": { "en": "Final Reputation:", "zh": "最终声誉：" },
    "room-b.005": { "en": "Ship Level:", "zh": "船只等级：" },
    "room-b.006": { "en": "Taxes Paid:", "zh": "已缴税款：" },
    "room-b.007": { "en": "🤝 Silent Partner", "zh": "🤝 幕后合伙人" },
    "room-b.008": {
      "en": "Gold you lent before the wreck is still out there, and it lands the moment each captain repays it.",
      "zh": "你翻船之前借出去的金币还在外面，哪位船长一还，它当场就到手。"
    },
    "room-b.009": { "en": "Send repayment to", "zh": "还款转给" },
    "room-b.010": { "en": "myself (default)", "zh": "我自己（默认）" },
    "room-b.011": {
      "en": "Spectator Mode: Live Harbor Standings",
      "zh": "观战模式：港湾实时排名"
    },
    "room-b.012": {
      "en": "Your voyage has ended, but the rest of the harbor is still sailing. Watch their progress live below.",
      "zh": "你的航程已经结束，港湾的其他人还在海上。在下面实时看他们的进展。"
    },
    "room-b.013": { "en": "🔄 Restart Voyage", "zh": "🔄 重开航程" },
    "room-b.014": { "en": "⚓ Sail Again", "zh": "⚓ 再次启航" },
    "room-b.015": {
      "en": "Click any captain in the Harbor Roster to peek at their cargo and workers",
      "zh": "点港湾名册里的任意船长，就能瞧一眼他们的货物和工匠。"
    },
    "room-b.016": {
      "en": "Funds depleted, unable to pay essential operational costs",
      "zh": "资金见底，付不出必需的营运开销"
    },
    "room-b.017": {
      "en": "Insufficient funds to cover maintenance and wages",
      "zh": "资金不足，付不起维护费和工钱"
    },
    "room-b.018": {
      "en": "⏱️ Production Cycle: What Happens When",
      "zh": "⏱️ 生产周期：何时发生什么"
    },
    "room-b.019": { "en": "💡 Materials consumed", "zh": "💡 原材料消耗" },
    "room-b.020": { "en": "now", "zh": "现在" },
    "room-b.021": { "en": ", not instantly.", "zh": "，并非当场。" },
    "room-b.022": { "en": "Draft a boon", "zh": "抽取机缘" },
    "room-b.023": {
      "en": "Assign tasks, consume materials",
      "zh": "安排上工，消耗原材料"
    },
    "room-b.024": { "en": "Barter with the harbor", "zh": "与港湾互通有无" },
    "room-b.025": {
      "en": "Goods produced, wages paid",
      "zh": "产出货物，支付工钱"
    },
    "room-b.026": { "en": "Shipyard and modules", "zh": "船坞与模块" },
    "room-b.027": { "en": "📋 Now", "zh": "📋 当前" },
    "room-b.028": {
      "en": "${face.icon} ${face.label}",
      "zh": "{face.icon} {face.label}"
    },
    "room-b.029": { "en": "📦 Current Inventory", "zh": "📦 当前库存" },
    "room-b.030": { "en": "Raw Materials:", "zh": "原材料：" },
    "room-b.031": { "en": "Finished Goods:", "zh": "成品：" },
    "room-b.032": { "en": "💸 Total Wages Due", "zh": "💸 应付工钱合计" },
    "room-b.033": { "en": "Wage Efficiency", "zh": "工钱效率" },
    "room-b.034": { "en": "🧭 Boon Locked In", "zh": "🧭 机缘已锁定" },
    "room-b.035": {
      "en": "The voyage begins once every captain has chosen.",
      "zh": "每位船长都选好之后，航程就开始。"
    },
    "room-b.036": { "en": "↩️ Choose a different Boon", "zh": "↩️ 换一个机缘" },
    "room-b.037": {
      "en": "🧭 The Navigator's Compass",
      "zh": "🧭 航海家的罗盘"
    },
    "room-b.038": {
      "en": "Draft a Boon to synergize with your strategy",
      "zh": "抽取机缘，配合你的策略"
    },
    "room-b.039": {
      "en": "✅ Boons Swapped This Round",
      "zh": "✅ 本轮已换过机缘"
    },
    "room-b.040": {
      "en": "🔄 Swap Boons (${BOON_SWAP_COST}💰, 1 use/round)",
      "zh": "🔄 切换机缘（{BOON_SWAP_COST}💰，每轮1次）"
    },
    "room-b.041": { "en": "🔒 Lock In Boon", "zh": "🔒 锁定机缘" },
    "room-b.042": { "en": "Sail Under This", "zh": "以此扬帆" },
    "room-b.043": { "en": "🎮 Game Over!", "zh": "🎮 游戏结束！" },
    "room-b.044": {
      "en": "Waiting for the host to restart the voyage…",
      "zh": "等待港主重开航程..."
    },
    "room-b.045": {
      "en": "💥 Bankrupt: Defaulted on a Loan",
      "zh": "💥 破产：借款违约"
    },
    "room-b.046": { "en": "${r.icon} ${r.label}", "zh": "{r.icon} {r.label}" },
    "room-b.047": { "en": "Crew Summary", "zh": "船员汇总" },
    "room-b.048": { "en": "Total Wages Paid", "zh": "已付工钱合计" },
    "room-b.049": {
      "en": "⚰️ Lost over the voyage",
      "zh": "⚰️ 航程中失去的人"
    },
    "room-b.050": { "en": "Crew Aboard", "zh": "在船船员" },
    "room-b.051": { "en": "Skilled", "zh": "熟练" },
    "room-b.052": { "en": "Items Made", "zh": "制成件数" },
    "room-b.053": {
      "en": "${loss.name} (leg ${loss.round})",
      "zh": "{loss.name}（第{loss.round}航段）"
    },
    "room-b.054": { "en": "🏁 Final Standings", "zh": "🏁 最终排名" },
    "room-b.055": {
      "en": "⏳ Waiting on the rest of the harbor to finish their voyage before Sea Master is crowned…",
      "zh": "⏳ 港湾其余船长的航程还没走完，等他们结束后才加冕沧海之主..."
    },
    "room-b.056": {
      "en": "Highest Reputation in this harbor&apos;s voyage.",
      "zh": "本港湾航程中声誉最高的人。"
    },
    "room-b.057": {
      "en": "🤝 Broker&apos;s Favor Unlocked!",
      "zh": "🤝 掮客的人情已解锁！"
    },
    "room-b.058": { "en": "· Renown level up!", "zh": "· 声望升级！" },
    "room-b.059": { "en": "Financial Summary", "zh": "财务汇总" },
    "room-b.060": { "en": "Net Cash Flow", "zh": "净现金流" },
    "room-b.061": { "en": "Peer Economy", "zh": "船长间往来" },
    "room-b.062": { "en": "Helper Reputation earned", "zh": "助人挣下的声誉" },
    "room-b.063": {
      "en": "Loan defaulted, no Renown banked this voyage.",
      "zh": "借款违约，本航程没有入账声望。"
    },
    "room-b.064": { "en": "Income", "zh": "收入" },
    "room-b.065": { "en": "No income recorded", "zh": "没有收入记录" },
    "room-b.066": { "en": "Expenses", "zh": "支出" },
    "room-b.067": { "en": "No expenses recorded", "zh": "没有支出记录" },
    "room-b.068": { "en": "Lending", "zh": "放款" },
    "room-b.069": { "en": "Borrowing", "zh": "借款" },
    "room-b.070": { "en": "Boon Gold", "zh": "机缘金币" },
    "room-b.071": { "en": "Purchases & Transport", "zh": "采购与运输" },
    "room-b.072": { "en": "Income Tax", "zh": "所得税" },
    "room-b.073": { "en": "Port Board", "zh": "港口采购板" },
    "room-b.074": { "en": "Take This Boon", "zh": "收下这份机缘" },
    "room-b.075": { "en": "🔧 Module Drafting", "zh": "🔧 抽取模块" },
    "room-b.076": {
      "en": "Choose a module to install or swap.",
      "zh": "选一个模块安装或切换。"
    },
    "room-b.077": {
      "en": "No module choices are on offer right now. A fresh set is rolled each round.",
      "zh": "现在没有可选的模块。每轮都会重新发一批。"
    },
    "room-b.078": {
      "en": "Nothing new to deal: every module the yard could offer this hull is either on this table already or aboard. Take one of these, or come back next leg.",
      "zh": "没有新牌可发：船坞能为这艘船开出的模块，不在桌上，就在船上。从这些里挑一个，或者下一航段再来。"
    },
    "room-b.079": { "en": "⬅️ Back to Shipyard", "zh": "⬅️ 回到船坞" },
    "room-b.080": {
      "en": "✅ Choices Swapped This Round",
      "zh": "✅ 本轮已换过选择"
    },
    "room-b.081": {
      "en": "🎲 Swap Choices (1 use/round)",
      "zh": "🎲 切换选择（每轮1次）"
    },
    "room-b.082": { "en": "✅ Install", "zh": "✅ 安装" },
    "room-b.083": { "en": "🔄 Swap", "zh": "🔄 切换" },
    "room-b.084": {
      "en": "🔄 Select Module to Replace",
      "zh": "🔄 选择要切换的模块"
    },
    "room-b.085": { "en": "🗑️ Replace", "zh": "🗑️ 切换" },
    "room-b.086": { "en": "⬅️ Back to Draft", "zh": "⬅️ 回到抽取" },
    "room-b.087": { "en": "Module Synergy Analysis", "zh": "模块组合分析" },
    "room-b.088": { "en": "Active Bonuses", "zh": "生效加成" },
    "room-b.089": { "en": "Module Interactions", "zh": "模块联动" },
    "room-b.090": {
      "en": "No special interactions detected between equipped modules.",
      "zh": "已装的模块之间，看不出有特别联动。"
    },
    "room-b.091": { "en": "Fulfillment Plan", "zh": "交付计划" },
    "room-b.092": { "en": "if all ready filled", "zh": "若备齐的全部交付" },
    "room-b.093": { "en": "Trade Manifest", "zh": "贸易舱单" },
    "room-b.094": {
      "en": "(look for the 🔮 badge below).",
      "zh": "（留意下面 🔮 的标记）。"
    },
    "room-b.095": {
      "en": "✅ Complete Trades, Continue",
      "zh": "✅ 完成贸易，继续"
    },
    "room-b.096": { "en": "📜 Imperial Mandate", "zh": "📜 皇命采办" },
    "room-b.097": { "en": "🤝 Broker&apos;s Favor", "zh": "🤝 掮客的人情" },
    "room-b.098": { "en": "🔮 Guaranteed", "zh": "🔮 保底" },
    "room-b.099": {
      "en": "Profit margin: ${margin}% of reward is net profit after transport, VAT, and commission",
      "zh": "利润率：报酬的{margin}%是扣掉运费、市舶税和掮客抽成后的净利"
    },
    "room-b.100": { "en": "· Imperial Commission", "zh": "· 皇命采办" },
    "room-b.101": { "en": "· Finished Product Demand", "zh": "· 求购成品" },
    "room-b.102": { "en": "· Raw Material Demand", "zh": "· 求购原材料" },
    "room-b.103": { "en": "✅ Completed", "zh": "✅ 已交付" },
    "room-b.104": { "en": "🎭 Borrow this order", "zh": "🎭 借用这份委托" },
    "room-b.105": { "en": "Broker&apos;s Favor", "zh": "掮客的人情" },
    "room-b.106": {
      "en": "(once per voyage): summon a guaranteed buyer for as much of a good as you choose from your hold. The bigger the ask, the bigger the Broker&apos;s cut.",
      "zh": "（每程一次）：从你的货舱里挑一件货，要多少都行，替你把买主叫来。要得越多，掮客抽得越多。"
    },
    "room-b.107": { "en": "Call in a Favor", "zh": "动用一次人情" },
    "room-b.108": {
      "en": "🤝 Which good needs a buyer?",
      "zh": "🤝 哪件货要找买主？"
    },
    "room-b.109": {
      "en": "Your hold is empty, so there is nothing for the Broker to sell right now.",
      "zh": "你的货舱是空的，掮客现在没东西可出手。"
    },
    "room-b.110": {
      "en": "Your hold changed while this was open, so there is nothing here for the Broker to sell now. Pick another good, or call the Favor in later this voyage.",
      "zh": "这块面板还开着，你的货舱却变了，掮客现在没货可出手。换一件货，或者本航程晚些时候再动用这条人情。"
    },
    "room-b.111": { "en": "Pick another good", "zh": "换一件货" },
    "room-b.112": {
      "en": "A bigger ask pays out more, but the Broker&apos;s cut grows with it too, so a single favor can never swing the whole voyage.",
      "zh": "要得越多进账越多，但掮客的抽成也跟着涨，所以一次人情翻不了整条航程的盘。"
    },
    "room-b.113": { "en": "Call in the Favor", "zh": "动用这条人情" },
    "room-b.114": {
      "en": "How much ${favorItem} to sell",
      "zh": "要卖多少 {favorItem}"
    },
    "room-b.115": { "en": "📋 Open Offers", "zh": "📋 挂出的报价" },
    "room-b.116": {
      "en": "No offers on the board yet. Be the first.",
      "zh": "板上还没有报价。做第一个。"
    },
    "room-b.117": { "en": "📤 Post an Offer", "zh": "📤 挂出报价" },
    "room-b.118": { "en": "With", "zh": "给" },
    "room-b.119": { "en": "Harbor Business", "zh": "港湾公事" },
    "room-b.120": { "en": "Exchange", "zh": "行市" },
    "room-b.121": { "en": "Markets", "zh": "集市" },
    "room-b.122": { "en": "${label} is open.", "zh": "{label}已开。" },
    "room-b.123": { "en": "The audit vote", "zh": "舱单稽查投票" },
    "room-b.124": { "en": "The maroon vote", "zh": "放逐投票" },
    "room-b.125": {
      "en": "No vote is open. The fleet's picks are on the record.",
      "zh": "眼下没有开着的投票。船队的取舍都记在案上。"
    },
    "room-b.126": { "en": "No vote is open yet.", "zh": "投票还没开始。" },
    "room-b.127": {
      "en": "✅ Done Bartering, Continue",
      "zh": "✅ 易货完毕，继续"
    },
    "room-b.128": {
      "en": "The cards are being cut. If a hand was dealt to you, it lands here.",
      "zh": "牌正在切。发到你手上的牌，会落在这里。"
    },
    "room-b.129": { "en": "🃏 The Path Draft", "zh": "🃏 择道" },
    "room-b.130": {
      "en": "Three cards each, dealt face down. What you hold at the end is the path you sail this voyage, and the deal comes first because every stop after it reads your path: your hold, your Renown ceiling and the orders that lock to you.",
      "zh": "每人三张，扣着发。最后留在你手里的，就是你本航程走的商道；发牌排在最前，因为之后每一站都要读你的商道：你的货舱、你的声望上限，还有锁给你的委托。"
    },
    "room-b.131": {
      "en": "Your three cards. Keep one, and the other two pass to the left.",
      "zh": "你的三张牌。留一张，另外两张传给左边。"
    },
    "room-b.132": { "en": "Keep This One", "zh": "留这一张" },
    "room-b.133": {
      "en": "Two cards arrived from your right. Keep one, and the other goes face down.",
      "zh": "右边传过来两张。留一张，另一张扣下。"
    },
    "room-b.134": {
      "en": "Your two papers. Keep the one you sail on, and the other goes over the side.",
      "zh": "你的两份文书。留下你要走的这一份，另一份丢下海。"
    },
    "room-b.135": { "en": "Sail As This One", "zh": "就走这一条" },
    "room-b.136": {
      "en": "The table is in. The step closes now.",
      "zh": "全桌都交齐了。这一步到此收尾。"
    },
    "room-b.137": {
      "en": "Waiting on ${view.open} more.",
      "zh": "还差{view.open}位。"
    },
    "room-b.138": {
      "en": "Cards still out: ${view.open}",
      "zh": "还在外头的牌：{view.open}"
    },
    "room-b.139": {
      "en": "🗣️ Broker&apos;s Whispers active this round:",
      "zh": "🗣️ 本轮生效的掮客低语："
    },
    "room-b.140": { "en": "Just for you", "zh": "只给你看" },
    "room-b.141": {
      "en": "Just for ${name ?? \"a captain\"}",
      "zh": "只给{name ?? \"某位船长\"}看"
    },
    "room-b.142": { "en": "Dismiss error", "zh": "关闭错误提示" },
    "room-b.143": {
      "en": "Waiting for the rest of the crew",
      "zh": "等待其余船员"
    },
    "room-b.144": { "en": "Not ready yet", "zh": "暂不就绪" },
    "room-b.145": { "en": "Pirate Waters Ahead", "zh": "前方海盗水域" },
    "room-b.146": {
      "en": "🕵️ A corrupt broker leaked your position this round, so the odds above are already raised.",
      "zh": "🕵️ 本轮有通匪掮客把你的位置透了出去，上面的概率已经跟着抬高。"
    },
    "room-b.147": { "en": "Risk Assessment", "zh": "风险评估" },
    "room-b.148": { "en": "Raid Chance", "zh": "劫掠概率" },
    "room-b.149": { "en": "Gold at Risk", "zh": "风险金额" },
    "room-b.150": { "en": "Expected Loss", "zh": "预期损失" },
    "room-b.151": {
      "en": "Before this round's bills come due, your ship has to clear open water. Pirates that find you this round meet a shield you already paid for, so there is nothing here left to buy and nothing in your hold that is theirs.",
      "zh": "在本轮账单到期之前，你的船得先过一段开阔水面。本轮找上你的海盗，撞上的是你早已付过钱的那面盾，所以这里没剩什么可买，海盗也拿不走你货舱里的东西。"
    },
    "room-b.152": { "en": "Sail On", "zh": "继续航行" },
    "room-b.153": { "en": "Set Sail Anyway", "zh": "照样启航" },
    "room-b.154": { "en": "Port Merchant Exchange", "zh": "港口商行" },
    "room-b.155": { "en": "🔮 Broker's Rumor Board", "zh": "🔮 掮客传闻板" },
    "room-b.156": {
      "en": "✅ Board Done, to the Artisan Bench",
      "zh": "✅ 板看完了，去匠作台"
    },
    "room-b.157": { "en": "Market Readings", "zh": "集市行情" },
    "room-b.158": { "en": "Refit Bench", "zh": "整补台" },
    "room-b.159": {
      "en": "(a matching order is guaranteed at Orders, buy accordingly).",
      "zh": "（委托阶段保证有对得上的委托，可照此采购）。"
    },
    "room-b.160": {
      "en": "What the board is worth: usual prices, the best of the six, and how deep each good runs.",
      "zh": "这块板值多少：平日的价钱、六张里最划算的那张，还有每件货的货源厚薄。"
    },
    "room-b.161": {
      "en": "A Loom captain's work: a garment put right in one leg, at a fee the two of you agree.",
      "zh": "织造船长的手艺：一个航段内把一件衣物整好，价钱由你们两人商定。"
    },
    "room-b.162": { "en": "Product", "zh": "成品" },
    "room-b.163": { "en": "Raw Material", "zh": "原材料" },
    "room-b.164": { "en": "✅ Purchased", "zh": "✅ 已购" },
    "room-b.165": { "en": "Deal", "zh": "划算" },
    "room-b.166": { "en": "Pricey", "zh": "偏贵" },
    "room-b.167": { "en": "Best Deals This Round", "zh": "本轮最划算" },
    "room-b.168": { "en": "g", "zh": "金币" },
    "room-b.169": { "en": "Intel", "zh": "情报" },
    "room-b.170": { "en": "Harbor Pulse", "zh": "港湾行情" },
    "room-b.171": { "en": "Pricier", "zh": "涨价" },
    "room-b.172": { "en": "Softer", "zh": "降价" },
    "room-b.173": { "en": "Market Depth", "zh": "货源厚薄" },
    "room-b.174": {
      "en": "Matches a Broker's Whisper, guaranteed order at Orders",
      "zh": "与一条掮客低语对得上，委托阶段必有对应的委托"
    },
    "room-b.175": {
      "en": "${good} is about ${Math.round(v * 100)} percent above its usual price this round",
      "zh": "{good}本轮比平日价钱高出约{Math.round(v * 100)}%"
    },
    "room-b.176": {
      "en": "${good} is about ${Math.round(Math.abs(v) * 100)} percent below its usual price this round",
      "zh": "{good}本轮比平日价钱低了约{Math.round(Math.abs(v) * 100)}%"
    },
    "room-b.177": {
      "en": "${count} card${count === 1 ? \"\" : \"s\"} offering ${good} this round",
      "zh": "本轮有{count}张牌在出{good}"
    },
    "room-b.178": {
      "en": "already priced into this board",
      "zh": "已经算进这块板里"
    },
    "room-b.179": {
      "en": "━━ MARKET PRICE REFERENCE (hover for details) ━━",
      "zh": "━━ 集市价钱参考（悬停看详情） ━━"
    },
    "room-b.180": { "en": "Price History Heatmap", "zh": "历史价钱热力图" },
    "room-b.181": { "en": "Good", "zh": "货品" },
    "room-b.182": {
      "en": "R${i + 1}: ${price} Gold (range ${min} to ${max})",
      "zh": "第{i + 1}轮：{price}金币（区间{min}到{max}）"
    },
    "room-b.183": { "en": "Provisions", "zh": "口粮" },
    "room-b.184": {
      "en": "one ration a head, eaten at each Dawn",
      "zh": "每人一份口粮，破晓时吃掉"
    },
    "room-b.185": {
      "en": "No crew aboard, so there is nobody to feed. Hire artisans and the larder starts to matter.",
      "zh": "船上没有船员，也就没人要喂。雇了工匠，粮舱才开始要紧。"
    },
    "room-b.186": {
      "en": "The larder is full, so there is nothing more to buy here.",
      "zh": "粮舱满了，这里没什么可再买的。"
    },
    "room-b.187": {
      "en": "Not enough Gold for a leg of rations.",
      "zh": "金币不够买一个航段的口粮。"
    },
    "room-b.188": { "en": "Crew", "zh": "船员" },
    "room-b.189": {
      "en": "${density}, keeps forever",
      "zh": "{density}，永久保存"
    },
    "room-b.190": {
      "en": "${density}, keeps ${spec.keeps} legs",
      "zh": "{density}，可放{spec.keeps}个航段"
    },
    "room-b.191": {
      "en": "${density}, turns at this Dusk",
      "zh": "{density}，到本暮色就变质"
    },
    "room-b.192": {
      "en": "The three foods the crew eats, and a batch of Produce ready to preserve.",
      "zh": "船员吃的三样口粮，另有一批时鲜可以腌制。"
    },
    "room-b.193": {
      "en": "The three foods the crew eats, and what each keeps.",
      "zh": "船员吃的三样口粮，各能存多久。"
    },
    "room-b.194": {
      "en": "The barge has nothing left for you this leg.",
      "zh": "补给驳船这一航段没剩什么给你了。"
    },
    "room-b.195": {
      "en": "The barge has nothing left for you this leg, and it is a fresh lot tomorrow.",
      "zh": "补给驳船这一航段没剩什么给你了，明天会来一批新的。"
    },
    "room-b.196": {
      "en": "Short on Gold? Ask the Harbor for Help",
      "zh": "金币不够？向港湾求助"
    },
    "room-b.197": { "en": "Request", "zh": "申请" },
    "room-b.198": {
      "en": "Gold from another captain",
      "zh": "金币，向别的船长借"
    },
    "room-b.199": { "en": "🆘 Request Help", "zh": "🆘 求助" },
    "room-b.200": {
      "en": "🆘 Captains Asking for Help",
      "zh": "🆘 正在求助的船长"
    },
    "room-b.201": { "en": "Loan amount to request", "zh": "申请借款的数额" },
    "room-b.202": {
      "en": "🛡️ Loans You Could Back",
      "zh": "🛡️ 你可以作保的借款"
    },
    "room-b.203": { "en": "lent", "zh": "借给" },
    "room-b.204": { "en": "Pledged Gold is", "zh": "作保的金币" },
    "room-b.205": { "en": "escrowed", "zh": "现已托管" },
    "room-b.206": {
      "en": "now, only spent if the loan actually defaults, up to what you pledged. Never called on? It all comes back, plus a small Reputation bonus.",
      "zh": "，只有借款真的违约才会动用，最多到你作保的数目。要是一次都没动用？全数退回，还多一份小小的声誉加成。"
    },
    "room-b.207": {
      "en": "Gold to pledge backing ${l.lenderName}'s loan to ${l.borrowerName}",
      "zh": "为{l.lenderName}借给{l.borrowerName}的这笔借款作保的金币数"
    },
    "room-b.208": {
      "en": "💸 Resolve: Round Settlement",
      "zh": "💸 结算：本轮清账"
    },
    "room-b.209": { "en": "⏳ Bills Due This Round", "zh": "⏳ 本轮应付账单" },
    "room-b.210": { "en": "💹 Balance Summary", "zh": "💹 账目汇总" },
    "room-b.211": { "en": "🔧 Ship Maintenance Fee", "zh": "🔧 船只维护费" },
    "room-b.212": { "en": "💸 Total Due", "zh": "💸 应付合计" },
    "room-b.213": { "en": "Current Funds", "zh": "当前资金" },
    "room-b.214": { "en": "After Settlement", "zh": "结算之后" },
    "room-b.215": { "en": "Round Revenue", "zh": "本轮进账" },
    "room-b.216": {
      "en": "🛡️ Escort hired, you sailed through safely this round.",
      "zh": "🛡️ 雇了护航，本轮平安驶过。"
    },
    "room-b.217": {
      "en": "🌊 You sailed without an escort this round.",
      "zh": "🌊 本轮没有雇护航就出海了。"
    },
    "room-b.218": {
      "en": "${b.sponsored} ${b.sponsored === 1 ? b.label : b.plural}",
      "zh": "{b.sponsored} {b.label}"
    },
    "room-b.219": {
      "en": "🚢 Shipyard & Module Rigging",
      "zh": "🚢 船坞与模块装配"
    },
    "room-b.220": {
      "en": "No modules installed. Upgrade ship to unlock slots!",
      "zh": "还没装模块。升级船只就能解锁模块位！"
    },
    "room-b.221": { "en": "⏭️ Continue Voyage", "zh": "⏭️ 继续航程" },
    "room-b.222": { "en": "Modules Aboard", "zh": "船上模块" },
    "room-b.223": {
      "en": "⏳ Waiting for the rest of the crew…",
      "zh": "⏳ 等待其余船员..."
    },
    "room-b.224": { "en": "↩️ Not ready yet", "zh": "↩️ 暂不就绪" },
    "room-b.225": {
      "en": "🔄 Draft & Swap Module (Slots Full)",
      "zh": "🔄 抽取并切换模块（模块位已满）"
    },
    "room-b.226": {
      "en": "🔧 Draft & Install Module",
      "zh": "🔧 抽取并安装模块"
    },
    "room-b.227": { "en": "🧥 Wardrobe", "zh": "🧥 衣箱" },
    "room-b.228": {
      "en": "The sea is mild this leg and asks for no warmth. The clothes wait in the hold for a cold leg, because a garment wears from the day it goes on.",
      "zh": "这一航段海上温和，用不着御寒。衣物留在货舱里等寒程，因为衣裳从穿上的那天起就开始磨损。"
    },
    "room-b.229": {
      "en": "No crew aboard, so there is nobody to wear them. Hire artisans and the cold starts to matter.",
      "zh": "船上没有船员，也就没人穿。雇了工匠，寒冷才开始要紧。"
    },
    "room-b.230": {
      "en": "The hold carries no clothes. Linen Clothes, Cotton Clothes and Brocade are made right here at the bench, and the ones the crew wears are the ones it cannot sell.",
      "zh": "货舱里没有衣物。麻衣、布衣和绫罗绸缎就在这里的匠作台上做出来，船员穿戴的那些，就是卖不出去的那些。"
    },
    "room-b.231": { "en": "This leg", "zh": "本航段" },
    "room-b.232": {
      "en": "a garment worn stays on until it wears out",
      "zh": "衣物上了身，就得一直穿到磨坏"
    },
    "room-b.233": { "en": "❄️ Cold", "zh": "❄️ 寒冷" },
    "room-b.234": {
      "en": "⚠️ The crew is short of warm clothes. The cold takes the newest hand, who is out of action for the next leg.",
      "zh": "⚠️ 船员御寒衣物不够。寒冷会冻倒最新来的那个伙计，下一航段上不了工。"
    },
    "room-b.235": {
      "en": "The crew is dressed for the cold this leg. The rest stay in the hold until a leg asks for more.",
      "zh": "这一航段船员穿够了御寒衣物。其余的留在货舱，等哪一航段要得更多再拿出来。"
    },
    "room-b.236": {
      "en": "👥 Worker Status & Tasks",
      "zh": "👥 工匠状态与任务"
    },
    "room-b.237": { "en": "${ICONS[m]}${m}×${a}", "zh": "{ICONS[m]}{m}×{a}" },
    "room-b.238": { "en": "👥 Artisan Bench", "zh": "👥 匠作台" },
    "room-b.239": { "en": "🔨 Hire Workers", "zh": "🔨 雇佣工匠" },
    "room-b.240": { "en": "${a} ${m}", "zh": "{a} {m}" },
    "room-b.241": { "en": "${t}(${mats})", "zh": "{t}（{mats}）" },
    "room-b.242": {
      "en": "✅ Complete Market, Continue",
      "zh": "✅ 集市结束，继续"
    },
    "room-b.243": { "en": "Hold Value", "zh": "货舱价值" },
    "room-b.244": { "en": "━━ Raw Materials ━━", "zh": "━━ 原材料 ━━" },
    "room-b.245": { "en": "━━ Finished Goods ━━", "zh": "━━ 成品 ━━" },
    "room-b.246": {
      "en": "Nothing in the hold yet.",
      "zh": "货舱里还什么都没有。"
    },
    "room-b.247": { "en": "━━ Artisans ━━", "zh": "━━ 工匠 ━━" },
    "room-b.248": { "en": "Cargo Composition", "zh": "货物构成" },
    "room-b.249": {
      "en": "Raw Materials: ${rawCount} (${rawPct}%)",
      "zh": "原材料：{rawCount}（{rawPct}%）"
    },
    "room-b.250": {
      "en": "Finished Goods: ${productCount} (${productPct}%)",
      "zh": "成品：{productCount}（{productPct}%）"
    },
    "room-b.251": {
      "en": "${skilled} of ${count} trained: each produces 2 per round, working at ${Math.round(SHORT_RATIONS_YIELD * 100)}% pace while the crew goes hungry",
      "zh": "{count}人中有{skilled}人熟练：每人每轮产出2件，船员挨饿时干活的速度只有{Math.round(SHORT_RATIONS_YIELD * 100)}%"
    },
    "room-b.252": { "en": "━━ Ventures ━━", "zh": "━━ 合股 ━━" },
    "room-b.253": {
      "en": "Too late in this voyage to post a new Venture: there is no round left that would leave time to spend the reward.",
      "zh": "本航程已太晚，发不了新的合股：剩下的轮数，不够把回报花出去。"
    },
    "room-b.254": { "en": "Target Gold", "zh": "目标金额" },
    "room-b.255": { "en": "Rounds to fill", "zh": "凑满轮数" },
    "room-b.256": { "en": "Post", "zh": "发布" },
    "room-b.257": {
      "en": "Miss the deadline and every contributor only gets back a partial refund. This harbor only gets one venture per voyage, so make it count.",
      "zh": "过了期限，每位出资人只能拿回一部分退款。每座港湾每程只有一次合股，想清楚再用。"
    },
    "room-b.258": {
      "en": "You have backed this as much as any single captain can. It needs another captain to fund the rest.",
      "zh": "你已按单人上限跟投了这一笔。剩下的要另一位船长来凑。"
    },
    "room-b.259": { "en": "Back it", "zh": "跟投" },
    "room-b.260": {
      "en": "${CONVOY_VENTURE_MIN_TARGET}+",
      "zh": "{CONVOY_VENTURE_MIN_TARGET}+"
    },
    "room-b.261": {
      "en": "No ventures open. This voyage's one chance has already been used.",
      "zh": "眼下没有在筹的合股。本航程唯一的一次机会已经用掉。"
    },
    "room-b.262": {
      "en": "No ventures open right now. Post one, or wait for another captain to.",
      "zh": "眼下没有在筹的合股。你可以发一个，或者等别的船长发。"
    },
    "room-b.263": { "en": "Your venture", "zh": "你的合股" },
    "room-b.264": { "en": "🔧 Maintenance", "zh": "🔧 维护费" },
    "room-b.265": {
      "en": "✅ Funds sufficient for round end",
      "zh": "✅ 资金够撑到本轮结束"
    },
    "room-b.266": {
      "en": "🚨 Risk: Funds may fall short at round end!",
      "zh": "🚨 风险：本轮结束时资金可能不够！"
    },
    "room-b.267": {
      "en": "Nothing is owed until the voyage is under way.",
      "zh": "航程开始之前，什么都不欠。"
    },
    "room-b.268": { "en": "━━ Outstanding Loans ━━", "zh": "━━ 未清的借款 ━━" },
    "room-b.269": { "en": "You owe", "zh": "你欠" },
    "room-b.270": { "en": "Repay", "zh": "还款" },
    "room-b.271": { "en": "Owed by", "zh": "欠你的" },
    "room-b.272": {
      "en": "↳ ${r.list.length}× ${r.label}",
      "zh": "↳ {r.list.length}× {r.label}"
    },
    "room-b.273": { "en": "${r.due} Gold", "zh": "{r.due}金币" },
    "room-b.274": { "en": "Your papers", "zh": "你的文书" },
    "room-b.275": {
      "en": "Your path is ${card.name}. Change your papers.",
      "zh": "你的商道是{card.name}。切换你的文书。"
    },
    "room-b.276": {
      "en": "No path yet. The deal is open: keep one of the cards dealt to you.",
      "zh": "还没有商道。牌局开着：从发给你的牌里留一张。"
    },
    "room-b.277": {
      "en": "No path yet. A path is dealt when the voyage sails.",
      "zh": "还没有商道。航程出海时会发商道。"
    },
    "room-b.278": {
      "en": "No path yet. The deal ran before you came aboard, so you sail this voyage without one.",
      "zh": "还没有商道。发牌在你上船之前就结束了，所以本航程你就这样出海，没有商道。"
    },
    "room-b.279": { "en": "Class", "zh": "船只等级" },
    "room-b.280": {
      "en": "No modules installed. Upgrade the ship in the Shipyard to unlock slots.",
      "zh": "还没装模块。到船坞升级船只就能解锁模块位。"
    },
    "room-b.281": { "en": "Modules", "zh": "模块" },
    "room-b.282": { "en": "module slot", "zh": "个模块位" },
    "room-b.283": { "en": "module slots", "zh": "个模块位" },
    "room-b.284": { "en": "Funds", "zh": "资金" },
    "room-b.285": { "en": "Due", "zh": "应付" },
    "room-b.286": { "en": "${money}", "zh": "{money}" },
    "room-b.287": { "en": "${score}", "zh": "{score}" },
    "room-b.288": { "en": "${larder}", "zh": "{larder}" },
    "lobby.001": { "en": "Suggest", "zh": "建议" },
    "lobby.002": { "en": "Got it", "zh": "知道了" },
    "lobby.003": {
      "en": "Show the recommended action for this phase",
      "zh": "看看本阶段推荐怎么做"
    },
    "lobby.004": { "en": "Show action suggestion", "zh": "查看行动建议" },
    "lobby.005": { "en": "Close suggestion", "zh": "关闭建议" },
    "lobby.006": { "en": "Consider ${first.name}", "zh": "可考虑{first.name}" },
    "lobby.007": { "en": "👩‍🔧", "zh": "👩‍🔧" },
    "lobby.008": {
      "en": "Only one round remains. Hiring now wastes Gold on wages with no production return. Focus on filling orders with what you already have.",
      "zh": "只剩最后一轮。这会儿雇工，工钱照付，产出却回不了本。手上的货，先拿去交付委托吧。"
    },
    "lobby.009": {
      "en": "Assign task: ${product}",
      "zh": "安排上工：{product}"
    },
    "lobby.010": {
      "en": "Your ${type} is idle and you have the materials to make ${product}. Assign the task now so production lands at this round's Resolve. Materials: ${Object.entries( recipe.materials, ) .map(([m, q]) =>",
      "zh": "你的{type}闲着，原材料也够，能做{product}。现在就安排上工，本轮结算时产出就到手。原材料：{Object.entries( recipe.materials, ) .map(([m, q]) =>"
    },
    "lobby.011": {
      "en": "Buy materials for ${product}",
      "zh": "为{product}采购原材料"
    },
    "lobby.012": {
      "en": "Your ${type} is idle but you lack materials for ${product}. You need: ${Object.entries( recipe.materials, ) .map(([m, q]) =>",
      "zh": "你的{type}闲着，做{product}的原材料却不够。还缺：{Object.entries( recipe.materials, ) .map(([m, q]) =>"
    },
    "lobby.013": {
      "en": ") .join(\", \")}. Buy these next round.",
      "zh": ") .join(\", \")}。下一轮再买这些。"
    },
    "lobby.014": {
      "en": "Your hold carries no goods to trade this Parley. Post a Gold offer for the good you still need, or ready up so the fleet can move on.",
      "zh": "这轮洽谈，你货舱里没有能出手的货。可以为你还缺的货挂一份金币报价，或者直接点就绪，让船队接着走。"
    },
    "lobby.015": {
      "en": "You are holding ${count} ${top}. Post what your voyage can spare and name the good you are still short of, then ready up once the table is done with you.",
      "zh": "你手上有{count}件{top}。这程能匀出多少就挂多少，写明你还缺哪件货，等桌上的人跟你谈完，再点就绪。"
    },
    "lobby.016": {
      "en": "Almost ready for order #${close.id}",
      "zh": "委托#{close.id}就快备齐了"
    },
    "lobby.017": {
      "en": "You are only missing ${missing?.type} (have ${game.inventory[missing?.type ?? \"\"] || 0}, need ${missing?.required}). Try bartering for it, or wait to buy it next round.",
      "zh": "你只缺{missing?.type}（现有{game.inventory[missing?.type ?? \"\"] || 0}，需要{missing?.required}）。可以和船长易货，或者等下一轮再买。"
    },
    "lobby.018": { "en": "Upgrade to Ship Level 1", "zh": "升级船只到1级" },
    "lobby.019": {
      "en": "Ship upgrade costs ${cost} Gold but you only have ${game.money}. Save the Gold for the Resolve bills and continue the voyage.",
      "zh": "船只升级要{cost}金币，你手上只有{game.money}。金币留着结算付账，航程先接着走。"
    },
    "lobby.020": { "en": "Sign out", "zh": "退出登录" },
    "lobby.021": { "en": "Online", "zh": "在线" },
    "lobby.022": {
      "en": "The harbor leans this way for a fortnight",
      "zh": "这半个月，港湾都偏向这边。"
    },
    "lobby.023": {
      "en": "Every captain in every harbor shares the same Age at the same moment. The rotation cycles through the Lender, the Trader, and the Broker every two weeks, then repeats. An Age only shifts the weight of one already legal action, never the rules, which keeps a voyage that began under one Age from unbalancing when the next takes over.",
      "zh": "每个港湾、每位船长，同一时刻，同一个时代。时代每两周换一轮：放贷人、商人、掮客，换完从头再来。时代只调一调某个本就允许的动作的分量，规则一个字不改；一段时代里开的航程，不会因为下一段时代接手就失了平衡。"
    },
    "lobby.024": {
      "en": "${age.name}. ${age.description}",
      "zh": "{age.name}。{age.description}"
    },
    "lobby.025": {
      "en": "Current age: ${age.name}. Click for details.",
      "zh": "当前时代：{age.name}。点击查看详情。"
    },
    "lobby.026": { "en": "Close age details", "zh": "关闭时代详情" },
    "lobby.027": { "en": "handing over now", "zh": "正在交接" },
    "lobby.028": { "en": "under an hour remaining", "zh": "还剩不到一小时" },
    "lobby.029": {
      "en": "${hours} ${hours === 1 ? \"hour\" : \"hours\"} remaining",
      "zh": "还剩{hours}小时"
    },
    "lobby.030": {
      "en": "${Math.round(ms / 86_400_000)} days remaining",
      "zh": "还剩{Math.round(ms / 86_400_000)}天"
    },
    "lobby.031": {
      "en": "Maritime trade on the ancient Silk Road",
      "zh": "古丝路上，海上通商"
    },
    "lobby.032": {
      "en": "Open this page in another browser to register a second captain and see them appear online in real time.",
      "zh": "在另一个浏览器里打开这一页，再注册一位船长，就能实时看到对方上线。"
    },
    "lobby.033": { "en": "shown to other sailors", "zh": "其他船员可见" },
    "lobby.034": { "en": "for example, Captain Mei", "zh": "例如：梅船长" },
    "lobby.035": { "en": "Set Sail", "zh": "起航" },
    "lobby.036": { "en": "Hoist the Colors", "zh": "扬旗" },
    "lobby.037": { "en": "Not yet earned", "zh": "尚未获得" },
    "lobby.038": { "en": "Best Rep.", "zh": "最佳声誉" },
    "lobby.039": { "en": "Head to head with", "zh": "与" },
    "lobby.040": {
      "en": "🤝 Broker's Favor unlocked",
      "zh": "🤝 掮客的人情已解锁"
    },
    "lobby.041": { "en": "Close profile", "zh": "关闭资料" },
    "lobby.042": { "en": "Statistics", "zh": "统计" },
    "lobby.043": { "en": "Chronicles", "zh": "航程实录" },
    "lobby.044": { "en": "Rivals", "zh": "对手" },
    "lobby.045": { "en": "Sign In", "zh": "登录" },
    "lobby.046": { "en": "Register", "zh": "注册" },
    "lobby.047": { "en": "your captain name", "zh": "你的船长名" },
    "lobby.048": { "en": "choose a captain name", "zh": "取一个船长名" },
    "lobby.049": { "en": "Something went wrong", "zh": "出了点问题" },
    "lobby.050": { "en": "x", "zh": "x" },
    "lobby.051": { "en": "Dismiss advice", "zh": "忽略建议" },
    "lobby.052": {
      "en": "${rounds.slice(0, -1).join(\", \")}, and ${rounds[rounds.length - 1]}",
      "zh": "{rounds.slice(0, -1).join(\"、\")}和{rounds[rounds.length - 1]}"
    },
    "lobby.053": {
      "en": "Monsoon Season is very tough for a new captain. Consider Open Waters or Fair Winds until you reach Renown Level ${OPEN_WATERS_RENOWN}.",
      "zh": "季风时节，新船长很难熬。声望等级到{OPEN_WATERS_RENOWN}之前，先跑开阔水域或顺风。"
    },
    "lobby.054": {
      "en": "Open Waters introduces mandates and charter goods. Try a few Fair Winds voyages first to learn the core loop.",
      "zh": "开阔水域才有皇命采办和特许货物。先跑几程顺风，把基本玩法摸熟。"
    },
    "lobby.055": { "en": "Heads up", "zh": "注意" },
    "lobby.056": {
      "en": "Consider ${advice.recommended.replace(/_/g, \" \")}",
      "zh": "可考虑{advice.recommended.replace(/_/g, \" \")}"
    },
    "lobby.057": {
      "en": "Put ashore by a vote of the harbor",
      "zh": "港湾投票放逐"
    },
    "lobby.058": { "en": "You", "zh": "你" },
    "lobby.059": { "en": "loading…", "zh": "加载中..." },
    "lobby.060": {
      "en": "Across all pledged captains",
      "zh": "已加入世家的船长，全部计入。"
    },
    "lobby.061": { "en": "Yours", "zh": "你的" },
    "lobby.062": { "en": "Total Crowns", "zh": "沧海之冠总数" },
    "lobby.063": { "en": "Total Voyages", "zh": "航程总数" },
    "lobby.064": { "en": "Top Score", "zh": "最高积分" },
    "lobby.065": {
      "en": "Top captains across all voyages",
      "zh": "所有航程中的顶尖船长"
    },
    "lobby.066": {
      "en": "No captains have completed a voyage yet.",
      "zh": "还没有船长完成过航程。"
    },
    "lobby.067": {
      "en": "Set sail to be the first on the board.",
      "zh": "起航，做榜上的第一个。"
    },
    "lobby.068": { "en": "Close leaderboard", "zh": "关闭排行榜" },
    "lobby.069": { "en": "Crowns", "zh": "沧海之冠" },
    "lobby.070": { "en": "Best Rep", "zh": "最佳声誉" },
    "lobby.071": { "en": "Harbor Leaderboard", "zh": "港湾排行榜" },
    "lobby.072": { "en": "Houses", "zh": "世家" },
    "lobby.073": { "en": "Check In", "zh": "签到" },
    "lobby.074": { "en": "Your Renown", "zh": "你的声望" },
    "lobby.075": { "en": "Quick Start", "zh": "快速开局" },
    "lobby.076": {
      "en": "Match instantly with the next captain who hits Quick Start.",
      "zh": "下一位点快速开局的船长，立刻和你配对。"
    },
    "lobby.077": { "en": "Waiting", "zh": "等待中" },
    "lobby.078": { "en": "Open Harbors", "zh": "开放港湾" },
    "lobby.079": { "en": "Chart a new harbor", "zh": "开一个新港湾" },
    "lobby.080": {
      "en": "Every harbor the fleet has open right now.",
      "zh": "船队此刻开放的所有港湾。"
    },
    "lobby.081": { "en": "Guide", "zh": "指南" },
    "lobby.082": { "en": "Join by code", "zh": "用港湾口令加入" },
    "lobby.083": { "en": "Join", "zh": "加入" },
    "lobby.084": {
      "en": "Name a room, pick its waters, and open it to the fleet.",
      "zh": "给港湾起个名字，选好水域，向船队开放。"
    },
    "lobby.085": { "en": "Room name", "zh": "港湾名" },
    "lobby.086": { "en": "Create", "zh": "创建" },
    "lobby.087": { "en": "Unlock phrase", "zh": "解锁暗语" },
    "lobby.088": {
      "en": "A captain&apos;s tenth completed voyage hands them this phrase, and the guide keeps a copy for whoever goes looking. Anyone who has it can open the table, and every seat at that table sails the voyage it opens.",
      "zh": "船长完成第十次航程，就能拿到这句暗语；指南也为上门来查的人留了一份。暗语在手，谁都能开这张桌子；坐上桌的每个席位，都驶进它开的那次航程。"
    },
    "lobby.089": { "en": "Voyage Chronicles", "zh": "航程实录" },
    "lobby.090": { "en": "Great Houses", "zh": "世家" },
    "lobby.091": { "en": "Open harbor leaderboard", "zh": "打开港湾排行榜" },
    "lobby.092": { "en": "Settings", "zh": "设置" },
    "lobby.093": { "en": "Open settings", "zh": "打开设置" },
    "lobby.094": { "en": "Daily Check In", "zh": "每日签到" },
    "lobby.095": { "en": "View captain profile", "zh": "查看船长资料" },
    "lobby.096": { "en": "Captains", "zh": "船长" },
    "lobby.097": { "en": "Sailing", "zh": "航行中" },
    "lobby.098": { "en": "Captain Legacy", "zh": "船长传承" },
    "lobby.099": { "en": "View captain legacy", "zh": "查看船长传承" },
    "lobby.100": { "en": "Dismiss", "zh": "关闭" },
    "lobby.101": { "en": "Refresh harbors", "zh": "刷新港湾" },
    "lobby.102": { "en": "Refresh the harbor list", "zh": "刷新港湾列表" },
    "lobby.103": {
      "en": "e.g. Silk Run · Voyage 1",
      "zh": "例如：丝路行程 · 航程 1"
    },
    "lobby.104": {
      "en": "The phrase the harbor asks for",
      "zh": "港湾索要的那句暗语"
    },
    "lobby.105": { "en": "Waters", "zh": "水域" },
    "lobby.106": {
      "en": "Renown level up! A bigger start of voyage Gold bonus awaits.",
      "zh": "声望升级！下回开航，金币奖励更丰厚。"
    },
    "lobby.107": {
      "en": "Fair winds. Come back tomorrow for the next reward.",
      "zh": "顺风。明天再来领取下一份奖励。"
    },
    "lobby.108": { "en": "Already checked in today", "zh": "今天已经签到过了" },
    "lobby.109": {
      "en": "Come back tomorrow for the next reward.",
      "zh": "明天再来领取下一份奖励。"
    },
    "lobby.110": { "en": "Check in failed", "zh": "签到失败" },
    "lobby.111": {
      "en": "Could not reach the Harbormaster. Try again.",
      "zh": "联系不上港务长，再试一次。"
    },
    "lobby.112": { "en": "Quick Start failed", "zh": "快速开局失败" },
    "lobby.113": {
      "en": "Still connecting to the harbor. Try again in a moment.",
      "zh": "还在连接港湾。请稍后再试。"
    },
    "lobby.114": { "en": "Looking for a harbor", "zh": "正在寻找港湾" },
    "lobby.115": {
      "en": "Pairing you with the next captain who asks.",
      "zh": "正在把你和下一位点快速开局的船长配到一起。"
    },
    "lobby.116": {
      "en": "Quick Start timed out. Please try again.",
      "zh": "快速开局超时了，再试一次。"
    },
    "lobby.117": {
      "en": "Quick Start matched a harbor, but it could not be reached.",
      "zh": "快速开局配到了港湾，却连不上。"
    },
    "lobby.118": {
      "en": "Quick Start is unavailable right now.",
      "zh": "快速开局暂时用不了。"
    },
    "lobby.119": { "en": "Failed to create room", "zh": "创建港湾失败" },
    "lobby.120": {
      "en": "Room codes are 6 characters.",
      "zh": "港湾口令是6个字符。"
    },
    "lobby.121": { "en": "Failed to join room", "zh": "加入港湾失败" },
    "lobby.122": { "en": "Failed to enter room", "zh": "进入港湾失败" },
    "lobby.123": {
      "en": "Could not load chronicles",
      "zh": "航程实录加载不了"
    },
    "lobby.124": {
      "en": "Could not load House standings",
      "zh": "世家排名加载不了"
    },
    "lobby.125": {
      "en": "Pledged to ${house?.name ?? \"House\"}",
      "zh": "已加入{house?.name ?? \"世家\"}"
    },
    "lobby.126": {
      "en": "Your House perk applies on your next fresh voyage.",
      "zh": "你的世家优待，从下个全新航程开始生效。"
    },
    "lobby.127": { "en": "Pledge failed", "zh": "加入世家失败" },
    "lobby.128": { "en": "Try again in a moment.", "zh": "请稍后再试。" },
    "lobby.129": { "en": "Connecting", "zh": "连接中" },
    "lobby.130": {
      "en": "No captains in this harbor yet.",
      "zh": "这个港湾里还没有船长。"
    },
    "lobby.131": {
      "en": "You have already reported this captain this voyage.",
      "zh": "本次航程你已经举报过这位船长。"
    },
    "lobby.132": {
      "en": "Report filed. It goes on the record for this voyage.",
      "zh": "举报已提交，会记进本航程的记录。"
    },
    "lobby.133": { "en": "Dismiss notification", "zh": "关闭通知" },
    "lobby.134": {
      "en": "${collapsed ? \"Expand\" : \"Collapse\"} the ${title} panel",
      "zh": "{collapsed ? \"展开\" : \"收起\"}{title}面板"
    },
    "lobby.135": { "en": "Volume", "zh": "音量" },
    "lobby.136": { "en": "Close settings", "zh": "关闭设置" },
    "lobby.137": { "en": "Sound", "zh": "声音" },
    "lobby.138": { "en": "Harbor sounds", "zh": "港湾音效" },
    "lobby.139": {
      "en": "Ambient harbor bed and UI feedback tones",
      "zh": "港湾环境音与界面提示音"
    },
    "lobby.140": { "en": "Theme", "zh": "主题" },
    "lobby.141": { "en": "Light", "zh": "浅色" },
    "lobby.142": { "en": "Dark", "zh": "深色" },
    "lobby.143": { "en": "Auto", "zh": "自动" },
    "lobby.144": { "en": "Visual", "zh": "显示" },
    "lobby.145": { "en": "Colorblind safe palette", "zh": "色盲友好配色" },
    "lobby.146": {
      "en": "Use Okabe Ito anchored colors for all goods",
      "zh": "所有货物都使用 Okabe Ito 配色"
    },
    "lobby.147": { "en": "Notifications", "zh": "通知" },
    "lobby.148": {
      "en": "Messages from the other captains in the harbor",
      "zh": "港湾里其他船长发来的消息"
    },
    "lobby.149": {
      "en": "The race to ${WORD_ON_THE_DOCKS_THRESHOLD} completed orders",
      "zh": "抢先交满{WORD_ON_THE_DOCKS_THRESHOLD}笔委托的竞赛"
    },
    "lobby.150": { "en": "Tidewatch Surge", "zh": "观潮涌动" },
    "lobby.151": {
      "en": "The harbor crossing ${TIDEWATCH_SURGE_THRESHOLD} combined Reputation",
      "zh": "港湾声誉合计突破{TIDEWATCH_SURGE_THRESHOLD}"
    },
    "lobby.152": { "en": "Shortcuts", "zh": "快捷键" },
    "lobby.153": {
      "en": "The host has muted you in room chat for the rest of this voyage.",
      "zh": "本航程余下的时间，港主已经把你禁言，港湾聊天里说不了话。"
    },
    "lobby.154": { "en": "Offer a trade", "zh": "发起交易" },
    "lobby.155": { "en": "Dismiss trade error", "zh": "关闭交易错误" },
    "lobby.156": { "en": "Search messages", "zh": "搜索消息" },
    "lobby.157": { "en": "Message the harbor…", "zh": "给港湾发消息..." },
    "lobby.158": { "en": "Message the lobby…", "zh": "给大厅发消息..." },
    "lobby.159": { "en": "Switch", "zh": "切换" },
    "lobby.160": {
      "en": "Pick a captain to message privately",
      "zh": "选一位船长，私下发消息"
    },
    "lobby.161": {
      "en": "No other captains available right now. They will appear here once they are online.",
      "zh": "眼下没有别的船长可选。等他们上线，就会出现在这里。"
    },
    "lobby.162": { "en": "you", "zh": "你" },
    "lobby.163": { "en": "Put ashore", "zh": "被放逐" },
    "lobby.164": { "en": "muted", "zh": "已禁言" },
    "lobby.165": { "en": "Scanning the horizon", "zh": "正在眺望海面" },
    "lobby.166": { "en": "No harbors open yet", "zh": "还没有港湾开放" },
    "lobby.167": {
      "en": "Hit Quick Start above to be paired with the next captain looking, or switch to Chart a new harbor and open a room of your own.",
      "zh": "点上面的快速开局，和下一位找港湾的船长配对；或者切到开一个新港湾，自己开一间。"
    },
    "lobby.168": { "en": "Private", "zh": "私密" },
    "lobby.169": { "en": "⛵ Sailing", "zh": "⛵ 航行中" },
    "lobby.170": {
      "en": "This voyage has already set sail",
      "zh": "本航程已经起航"
    },
    "lobby.171": { "en": "Locked", "zh": "锁定" },
    "lobby.172": {
      "en": "Pick a captain from the list above to start a private conversation.",
      "zh": "从上面的名单里选一位船长，就能私下交谈。"
    },
    "lobby.173": { "en": "Captains Online", "zh": "在线船长" },
    "lobby.174": {
      "en": "No other captains online yet.",
      "zh": "还没有其他船长在线。"
    },
    "lobby.175": { "en": "Connecting to the harbor…", "zh": "正在连接港湾..." },
    "lobby.176": { "en": "In a harbor", "zh": "在港湾" },
    "lobby.177": { "en": "In the lobby", "zh": "在大厅" },
    "lobby.178": { "en": "Captain&apos;s Legacy", "zh": "船长传承" },
    "lobby.179": {
      "en": "Renown carries across every voyage this account ever sails, in any harbor.",
      "zh": "这个账号驶过的每一次航程，不管在哪个港湾，声望都攒在一起。"
    },
    "lobby.180": {
      "en": "Claim a Renown reward each day. The 7 day cycle picks up where you left off, even after a missed day, and restarts once Day 7 is claimed.",
      "zh": "每天能领一份声望奖励。七天一轮，漏了一天也接着上次往下走，领过第七天就从头再来。"
    },
    "lobby.181": {
      "en": "The Harbormaster&apos;s ledger of your finished voyages, newest first.",
      "zh": "港务长替你记着跑完的航程，最新的排最前。"
    },
    "lobby.182": { "en": "Loading chronicles…", "zh": "正在加载航程实录..." },
    "lobby.183": {
      "en": "No chronicles yet. Finish a voyage and your headline will be inscribed here.",
      "zh": "还没有航程实录。完成一次航程，你的标题就会刻在这里。"
    },
    "lobby.184": {
      "en": "Pledge to one House. Its perk applies on your next fresh voyage. Switch any time between voyages.",
      "zh": "加入一个世家。优待从你下个全新航程开始生效；两个航程之间，随时能换。"
    },
    "lobby.185": { "en": "Loading standings…", "zh": "正在加载排名..." },
    "lobby.186": { "en": "Pledged", "zh": "已加入" },
    "lobby.187": { "en": "✓ XP", "zh": "✓ 经验" },
    "lobby.188": { "en": "Claiming…", "zh": "领取中..." },
    "lobby.189": {
      "en": "Checked in today · back tomorrow",
      "zh": "今日已签到 · 明天再来"
    },
    "lobby.190": { "en": "Pledge", "zh": "加入" },
    "lobby.191": { "en": "Experimental", "zh": "试验中" },
    "lobby.192": { "en": "🔒 Sealed", "zh": "🔒 封锁" },
    "lobby.193": { "en": "Still being built.", "zh": "仍在建造中。" },
    "lobby.194": { "en": "Opens with a phrase.", "zh": "凭暗语开启。" },
    "lobby.195": { "en": "Merchant Rating", "zh": "商人评级" },
    "lobby.196": { "en": "Peak Rep", "zh": "最高声誉" },
    "lobby.197": { "en": "Final Rep", "zh": "最终声誉" },
    "lobby.198": { "en": "Final Gold", "zh": "最终金币" },
    "lobby.199": { "en": "Best Trade", "zh": "最佳交易" },
    "lobby.200": { "en": "loans given", "zh": "笔借出" },
    "lobby.201": { "en": "loans taken", "zh": "笔借入" },
    "lobby.202": { "en": "Crowned", "zh": "加冕" },
    "lobby.203": {
      "en": "No chronicles saved yet. Opt in to save a chronicle at the end of your next voyage.",
      "zh": "还没有保存的航程实录。下个航程跑到头，选保存，就能留下一份。"
    },
    "lobby.204": { "en": "By Difficulty", "zh": "按难度" },
    "lobby.205": {
      "en": "No merits earned yet. Complete voyages to earn them.",
      "zh": "还没有拿到功勋。跑完航程就能挣到。"
    },
    "lobby.206": { "en": "Renown Progression", "zh": "声望进度" },
    "lobby.207": { "en": "Leading", "zh": "领先" },
    "lobby.208": {
      "en": "No rivals yet. Sail in the same harbor as another captain to build a rivalry.",
      "zh": "还没有对手。和另一位船长在同一个港湾航行，就会结成对手。"
    },
    "lobby.209": { "en": "Solvent Streak", "zh": "连续不破产" },
    "lobby.210": { "en": "Crown Rate", "zh": "加冕率" },
    "lobby.211": {
      "en": "Consecutive voyages without bankruptcy",
      "zh": "连续不破产的航程次数"
    },
    "lobby.212": {
      "en": "Share of voyages won as Sea Master",
      "zh": "荣登沧海之主的航程占比"
    },
    "lobby.213": {
      "en": "No voyage records yet. Set sail to begin your legacy.",
      "zh": "还没有航程记录。起航，开始你的传承。"
    },
    "lobby.214": { "en": "Recent Voyage Trends", "zh": "近期航程走势" },
    "lobby.215": { "en": "Final Reputation", "zh": "最终声誉" },
    "lobby.216": { "en": "Peak Reputation", "zh": "最高声誉" },
    "lobby.217": { "en": "Largest Trade", "zh": "最大单笔交易" },
    "lobby.218": { "en": "partial sight", "zh": "局部视野" },
    "lobby.219": { "en": "Hold is empty.", "zh": "货舱是空的。" },
    "lobby.220": {
      "en": "Peek at ${targetName}'s cargo",
      "zh": "查看{targetName}的货物"
    },
    "lobby.221": {
      "en": "Partial sight peek at ${targetName}",
      "zh": "局部视野查看{targetName}"
    },
    "lobby.222": { "en": "Asking the harbor…", "zh": "正在询问港湾..." },
    "lobby.223": {
      "en": "No snapshot yet. Tap the eye again.",
      "zh": "还没有快照。再点一下那只眼睛。"
    },
    "lobby.224": { "en": "Harbor Roster", "zh": "港湾名册" },
    "lobby.225": { "en": "Ashore", "zh": "已上岸" },
    "lobby.226": {
      "en": "Report ${member.displayName}",
      "zh": "举报{member.displayName}"
    },
    "lobby.227": { "en": "Unmute this captain", "zh": "解除这位船长的禁言" },
    "lobby.228": { "en": "Mute this captain", "zh": "禁言这位船长" },
    "lobby.229": {
      "en": "You have reported this captain this voyage",
      "zh": "本次航程你已经举报过这位船长"
    },
    "lobby.230": {
      "en": "Only the host can mute a captain.",
      "zh": "只有港主可以禁言船长。"
    },
    "lobby.231": {
      "en": "You can't report yourself.",
      "zh": "你不能举报自己。"
    },
    "lobby.232": {
      "en": "That report could not be filed. Try again in a moment.",
      "zh": "举报没能提交。请稍后再试。"
    },
    "misc.001": { "en": "Invalid input", "zh": "输入不对" },
    "misc.002": {
      "en": "No account found with that captain name. Please check the spelling or register a new account.",
      "zh": "没有查到用这个船长名的账号。核对一下拼写，或者注册新账号。"
    },
    "misc.003": {
      "en": "The password you entered is incorrect.",
      "zh": "密码不对。"
    },
    "misc.004": {
      "en": "That voyage save is too large to store.",
      "zh": "本航程的存档太大，存不下。"
    },
    "misc.005": { "en": "Captain not found", "zh": "查无此船长" },
    "misc.006": { "en": "Room not found", "zh": "查无此港湾" },
    "misc.007": {
      "en": "A 6 character room code is required",
      "zh": "港湾口令得是6个字符"
    },
    "misc.008": {
      "en": "No room exists with that code",
      "zh": "这个口令对不上任何港湾"
    },
    "misc.009": {
      "en": "That phrase opens a different voyage than the one asked for.",
      "zh": "这句暗语开的航程，不是你要开的那次航程。"
    },
    "misc.010": {
      "en": "That phrase does not open this voyage. Check the words and try again.",
      "zh": "这句暗语开不了本航程。核对一下字句，再试一次。"
    },
    "misc.011": {
      "en": "This voyage is sealed. It opens with a phrase, and the harbor was not given one.",
      "zh": "本航程是封着的，要用暗语才开得起来，可开辟时没填暗语。"
    },
    "misc.012": { "en": "Search messages…", "zh": "搜索消息..." },
    "misc.013": { "en": "Close search", "zh": "关闭搜索" },
    "misc.014": { "en": "You're muted", "zh": "你被禁言了" },
    "misc.015": {
      "en": "The host has muted you in room chat this voyage.",
      "zh": "本航程中，港主在港湾聊天里把你禁言了。"
    },
    "misc.016": {
      "en": "Nothing on the harbor square yet. Say hello to the fleet.",
      "zh": "港湾广场上还什么都没有。跟船队打个招呼吧。"
    },
    "misc.017": {
      "en": "No messages yet. Break the ice with your fellow captains.",
      "zh": "还没有消息。先跟同席船长们搭一句话吧。"
    },
    "misc.018": {
      "en": "No messages yet between you two.",
      "zh": "你们俩还没有消息。"
    },
    "misc.019": { "en": "N/A", "zh": "暂无" },
    "misc.020": {
      "en": "Gain ${EMERGENCY_LOAN_GOLD} Gold immediately. No strings attached.",
      "zh": "立即获得{EMERGENCY_LOAN_GOLD}金币，无需偿还。"
    },
    "misc.021": { "en": "${pcts[0]}%", "zh": "{pcts[0]}%" },
    "misc.022": {
      "en": "${pcts[0]}% to ${pcts[1]}%",
      "zh": "{pcts[0]}%至{pcts[1]}%"
    },
    "misc.023": { "en": "The Cordage Warrant", "zh": "绳索采办" },
    "misc.024": {
      "en": "The yards need rope. Hemp by the bale, and linen to back it.",
      "zh": "船坞要用绳索。麻布要成包的，还要麻布做衬。"
    },
    "misc.025": { "en": "The Silk and Tea Levy", "zh": "丝茶之征" },
    "misc.026": {
      "en": "Two holds of the old trade, silk from the north and tea from the south.",
      "zh": "老买卖的两舱货，北边的丝绸，南边的茶叶。"
    },
    "misc.027": { "en": "The Cloth Quota", "zh": "布匹定额" },
    "misc.028": {
      "en": "The garrison is being re-kitted, and the weaving houses cannot do it alone.",
      "zh": "守军要换装，织造人家顾不过来。"
    },
    "misc.029": { "en": "The Sachet Tithe", "zh": "香囊之贡" },
    "misc.030": {
      "en": "Sachets for the court, tea for the road, and hemp to wrap the lot.",
      "zh": "朝廷的香囊，路上的茶叶，还有裹这批货的麻布。"
    },
    "misc.031": { "en": "The Brocade Command", "zh": "绫罗绸缎之令" },
    "misc.032": {
      "en": "Brocade for the reception, and the raw stuff to keep the looms turning.",
      "zh": "待客的绫罗绸缎，还有让织机转不停的原材料。"
    },
    "misc.033": { "en": "The Full Manifest", "zh": "满载舱单" },
    "misc.034": {
      "en": "Nothing finished, nothing fancy. The founding three, and a great deal of them.",
      "zh": "不要成品，不要稀罕货。就是最初那三样，而且要多。"
    },
    "misc.035": { "en": "Settle", "zh": "结算" },
    "misc.036": {
      "en": "You win if the fleet fills its commission and your own goal above is met with it.",
      "zh": "船队凑齐公议，你上方那条个人目标也跟着完成，这局就归你。"
    },
    "misc.037": {
      "en": "You win if the fleet fills its commission.",
      "zh": "船队凑齐公议，这局就归你。"
    },
    "misc.038": {
      "en": "You win if you take at least ${BROKER_PAYOUT_TARGET} Gold from other captains in trade. The commission is their business rather than yours, so a voyage they finish well is no loss to you.",
      "zh": "只要在交易里从别的船长手上赚到至少{BROKER_PAYOUT_TARGET}金币，这局就归你。公议是他们的事，不是你的。他们航程走得再漂亮，你也不吃亏。"
    },
    "misc.039": {
      "en": "You win if the fleet falls short of its commission, and you still end the voyage solvent and rated at least a Qualified Trader.",
      "zh": "船队没凑齐公议，你到航程结束还没破产，评级至少是合格商人，这局就归你。"
    },
    "misc.040": { "en": "The voyage leaves the dock.", "zh": "航程驶离码头。" },
    "misc.041": {
      "en": "The harbor audits ${facts.target}.",
      "zh": "港湾稽查{facts.target}。"
    },
    "misc.042": {
      "en": "The harbor maroons ${facts.target}.",
      "zh": "港湾放逐{facts.target}。"
    },
    "misc.043": {
      "en": "${facts.captain} leaves the harbor.",
      "zh": "{facts.captain}离开港湾。"
    },
    "misc.044": {
      "en": "${facts.captain} offers one leg of protection for ${facts.fee} Gold.",
      "zh": "{facts.captain}挂出一段护卫，要价{facts.fee}金币。"
    },
    "misc.045": {
      "en": "${facts.taker} buys a leg of protection from ${facts.captain} for ${facts.fee} Gold.",
      "zh": "{facts.taker}以{facts.fee}金币买下{facts.captain}的一段护卫。"
    },
    "misc.046": {
      "en": "Raiders bound for ${facts.taker} met ${facts.captain}'s guns.",
      "zh": "冲着{facts.taker}去的海盗，撞上了{facts.captain}的炮口。"
    },
    "misc.047": {
      "en": "${facts.captain} offers to put a ${facts.good} right for ${facts.fee} Gold.",
      "zh": "{facts.captain}开价{facts.fee}金币，接下一单{facts.good}的整补。"
    },
    "misc.048": {
      "en": "${facts.taker} pays ${facts.captain} ${facts.fee} Gold to put the ${facts.good} right.",
      "zh": "{facts.taker}付给{facts.captain}{facts.fee}金币，把{facts.good}整补妥当。"
    },
    "misc.049": {
      "en": "${facts.captain} publishes a rumor about ${facts.good} at the bazaar.",
      "zh": "{facts.captain}在香市放出{facts.good}的传闻。"
    },
    "misc.050": { "en": "the tide is turning", "zh": "潮水转向了" },
    "misc.051": {
      "en": "This voyage has already set sail. Ask the host to open a new room.",
      "zh": "本航程已经起航。请港主另开一个港湾。"
    },
    "misc.052": { "en": "The Second Ledger", "zh": "第二本账簿" },
    "misc.053": { "en": "the second ledger", "zh": "第二本账簿" },
    "misc.054": {
      "en": "One harbor is sealed as well as hard. It opens with a phrase, and the phrase is the second ledger, entered when the room is charted.",
      "zh": "有一座港湾，路难走，门也锁着。开它得用一句暗语，暗语就是第二本账簿，开辟港湾时填上。"
    },
    "misc.055": {
      "en": "The harbor keeps one door shut, and ${UNLOCK_EARNED_AT} completed voyages is what opens it: the phrase is ${unlock.phrase}, and the guide has the line for whoever asks.",
      "zh": "港湾留着一扇门不开，完成{UNLOCK_EARNED_AT}次航程才打得开：暗语是{unlock.phrase}，谁问起，指南里就写着这一句。"
    },
    "misc.056": {
      "en": "One action ${why}, so nothing here can vouch for whether it landed. The register has been read again.",
      "zh": "有一项操作{why}，到底落没落下，这里作不了证。名册已重新读过。"
    },
    "misc.057": {
      "en": "${count} actions ${why}, so nothing here can vouch for whether they landed. The register has been read again.",
      "zh": "有{count}项操作{why}，到底落没落下，这里作不了证。名册已重新读过。"
    },
    "misc.058": {
      "en": "went unanswered by the server",
      "zh": "没等到服务器回话"
    },
    "misc.059": {
      "en": "was cut off by a dropped connection",
      "zh": "因掉线中断"
    },
    "misc.060": { "en": "⚓ Venture filled!", "zh": "⚓ 合股达成！" },
    "misc.061": {
      "en": "Your share: +${mine.amount} Gold.",
      "zh": "你这份：+{mine.amount}金币。"
    },
    "misc.062": {
      "en": "⚓ Venture missed its deadline",
      "zh": "⚓ 合股已逾期"
    },
    "misc.063": {
      "en": "Partial refund: +${mine.amount} Gold.",
      "zh": "部分退款：+{mine.amount}金币。"
    },
    "misc.064": { "en": "⚓ Venture canceled", "zh": "⚓ 合股已取消" },
    "misc.065": {
      "en": "Another venture in the harbor already claimed this voyage's one chance. Full refund: +${mine.amount} Gold.",
      "zh": "港湾里另一笔合股抢先占了本航程唯一的一次机会。全额退款：+{mine.amount}金币。"
    },
    "misc.066": {
      "en": "${names.slice(0, -1).join(\", \")} and ${names[names.length - 1]}",
      "zh": "{names.slice(0, -1).join(\", \")}和{names[names.length - 1]}"
    },
    "misc.067": { "en": "${count} names", "zh": "{count}个名字" },
    "misc.068": { "en": "${count} captains", "zh": "{count}位船长" },
    "misc.069": {
      "en": "${named} of ${roster} captains ${named === 1 ? \"has\" : \"have\"} named someone.",
      "zh": "{roster}位船长里，已有{named}位指认了他人。"
    },
    "residual.001": {
      "en": "Reading the balance...",
      "zh": "正在读取平衡数据..."
    },
    "residual.002": {
      "en": "Reading the register...",
      "zh": "正在读取名册..."
    },
    "residual.003": {
      "en": "Signed out of the operator console.",
      "zh": "已退出操作员控制台。"
    },
    "residual.004": { "en": "Enter the setup code", "zh": "请输入设置口令" },
    "residual.005": {
      "en": "That setup code is not correct.",
      "zh": "这个设置口令不对。"
    },
    "residual.006": {
      "en": "You have no artisans yet. ${cardText(apprentice).name} cuts hiring costs by ${Math.round(hireDiscount * 100)}% this round, letting you get a Weaver for ${weaverThen} Gold instead of ${weaverNow}. Good for establishing production early.",
      "zh": "你还没有工匠。{cardText(apprentice).name}本轮把雇工费用降低{Math.round(hireDiscount * 100)}%：织女只要{weaverThen}金币，原本要{weaverNow}金币。适合早点把生产立起来。"
    },
    "residual.007": {
      "en": "The best deal costs ${finalCost} Gold but you only have ${game.money}. Save your Gold for the Resolve bills. You can still barter for goods you need.",
      "zh": "最划算的一单要{finalCost}金币，而你只有{game.money}。把金币留给结算的账单吧，缺的货还能靠易货换。"
    },
    "residual.008": {
      "en": "A Weaver costs ${weaverWage} Gold per round and can make Linen Clothes from Hemp. You have ${game.money} Gold, enough for ${Math.floor(game.money / weaverWage)} rounds of wages. Production runs the same round you assign it, so hire now to get goods by Resolve.",
      "zh": "一名织女每轮要{weaverWage}金币，能把麻布织成麻衣。你有{game.money}金币，够付{Math.floor(game.money / weaverWage)}轮工钱。指派当轮就开工，现在雇，结算时就有货。"
    },
    "residual.009": {
      "en": "This order pays ${bestOrder.reward} Gold with an estimated net profit of ${bestProfit} Gold after transport and taxes. It is the most profitable order you can complete right now.",
      "zh": "这份委托报酬{bestOrder.reward}金币，扣掉运费和税后估计净赚{bestProfit}金币。这是你现在能完成的最赚的一单。"
    },
    "residual.010": {
      "en": "You owe about ${totalDue} Gold in wages and maintenance but only have ${game.money} Gold. Ask the harbor for a loan before settling, or you will go bankrupt.",
      "zh": "工钱和维护费大约欠{totalDue}金币，而你只有{game.money}金币。结算前先向港湾借一笔，不然就要破产了。"
    },
    "residual.011": {
      "en": "You have ${game.money} Gold, enough to cover the estimated ${totalDue} Gold in wages and maintenance. Settle your bills and move on to Dusk.",
      "zh": "你有{game.money}金币，够付大约{totalDue}金币的工钱和维护费。结清账单，进入暮色。"
    },
    "residual.012": {
      "en": "Upgrading costs ${cost} Gold and gives +1 module slot and +${SHIP_DISCOUNT_PER_LEVEL} Gold transport discount. With ${roundsLeft} rounds left, the transport savings alone will pay for the upgrade.",
      "zh": "升级要{cost}金币，换来 +1个模块仓位和 +{SHIP_DISCOUNT_PER_LEVEL}金币运费折扣。还剩{roundsLeft}轮，单是省下的运费就够回本。"
    },
    "residual.013": {
      "en": "You have ${game.equippedModules.length} of ${game.shipLevel} module slots filled. An empty slot is wasted potential. Draft a module now to gain a permanent bonus.",
      "zh": "你的{game.shipLevel}个模块仓位装了{game.equippedModules.length}个。空着的仓位就是白扔的潜力。现在就去抽一个模块，换一份永久加成。"
    },
    "residual.014": {
      "en": "You have ${game.money} Gold. Spending ${intelCost} Gold on a rumor guarantees a matching order in Orders, then buying the ${bestGoodName} at ${bestCard.resources[0]?.price} Gold per unit sets up a profitable trade.",
      "zh": "你手上有{game.money}金币。花{intelCost}金币买一条掮客传闻，委托阶段就保有一条对得上的委托；再按每件{bestCard.resources[0]?.price}金币买进{bestGoodName}，一笔好买卖就成了。"
    },
    "residual.015": {
      "en": "Best deal this round: ${bestGoodName} at ${bestCard.resources[0]?.price} Gold per unit from ${bestCard.port}. This is ${Math.round(bestScore * 100)}% of the typical price range, making it a good value.",
      "zh": "本轮最划算：来自{bestCard.port}的{bestGoodName}，每件{bestCard.resources[0]?.price}金币，约为常见价位的{Math.round(bestScore * 100)}%，值得入手。"
    },
    "residual.016": { "en": "Operator Console", "zh": "操作员控制台" },
    "residual.017": {
      "en": "{accounts.length} accounts, {onlineCount} online, for {APP_NAME}",
      "zh": "{accounts.length}个账户，{onlineCount}人在线，{APP_NAME}。"
    },
    "residual.018": { "en": "The balance dashboard", "zh": "平衡总览" },
    "residual.019": { "en": "Refresh the roster", "zh": "刷新名册" },
    "residual.020": { "en": "Search name or handle", "zh": "搜索姓名或用户名" },
    "residual.021": { "en": "Search accounts", "zh": "搜索账户" },
    "residual.022": { "en": "Clear the search", "zh": "清除搜索" },
    "residual.023": { "en": "Filter the register", "zh": "筛选名册" },
    "residual.024": { "en": "All", "zh": "全部" },
    "residual.025": { "en": "Admins", "zh": "管理员" },
    "residual.026": { "en": "Banned", "zh": "已封停" },
    "residual.027": {
      "en": "{selected.length} {selected.length === 1 ? \"account\" : \"accounts\"} selected",
      "zh": "已选{selected.length}个账户"
    },
    "residual.028": { "en": "Ban", "zh": "封停" },
    "residual.029": { "en": "Unban", "zh": "解封" },
    "residual.030": { "en": "Grant admin", "zh": "授予管理员" },
    "residual.031": { "en": "Delete", "zh": "删除" },
    "residual.032": { "en": "Revoke admin", "zh": "撤销管理员" },
    "residual.033": { "en": "Clear", "zh": "清除" },
    "residual.034": {
      "en": "Select every account shown",
      "zh": "选中当前显示的全部账户"
    },
    "residual.035": { "en": "Status", "zh": "状态" },
    "residual.036": { "en": "Harbors", "zh": "港湾" },
    "residual.037": { "en": "Seats", "zh": "席位" },
    "residual.038": { "en": "Actions", "zh": "操作" },
    "residual.039": { "en": "Administrator", "zh": "管理员" },
    "residual.040": { "en": "Away", "zh": "离开" },
    "residual.041": {
      "en": "Not available on your own account",
      "zh": "自己的账户不可用"
    },
    "residual.042": { "en": "Unban the account first", "zh": "先解封该账户" },
    "residual.043": {
      "en": "Banning ends every session the account holds and clears its seats on the spot. Deleting removes the account and every harbor it hosts, and cannot be undone.",
      "zh": "封停会当场结束该账户的所有会话，席位一并清空。删除则连账户带它主持的每一个港湾一起移走，撤不回来。"
    },
    "residual.044": {
      "en": "Delete {purgeTarget?.displayName}?",
      "zh": "删除{purgeTarget?.displayName}？"
    },
    "residual.045": {
      "en": "The account is removed, along with every harbor it hosts, every seat it holds, and every voyage, chronicle and merit it has earned. Any captain sitting in one of those harbors is sent back to the Lobby. This cannot be undone.",
      "zh": "账户就此移走，连同它主持的每一个港湾、占着的每一个席位，以及一路赢下的航程、实录与功勋。还坐在这些港湾里的船长，全部送回大厅。撤不回来。"
    },
    "residual.046": {
      "en": "Type {purgeTarget?.username} to confirm",
      "zh": "输入{purgeTarget?.username}确认"
    },
    "residual.047": { "en": "Delete Account", "zh": "删除账户" },
    "residual.048": {
      "en": "Every account ticked is removed, along with every harbor it hosts, every seat it holds, and every voyage, chronicle and merit it has earned. Any captain sitting in one of those harbors is sent back to the Lobby. This cannot be undone.",
      "zh": "勾中的账户一并移走，连同它主持的每一个港湾、占着的每一个席位，以及一路赢下的航程、实录与功勋。还坐在这些港湾里的船长，全部送回大厅。撤不回来。"
    },
    "residual.049": { "en": "Delete Accounts", "zh": "删除账户" },
    "residual.050": {
      "en": "{verb} {report.applied} {plural(report.applied)}.",
      "zh": "{verb} {report.applied}个账户。"
    },
    "residual.051": {
      "en": "{verb} {report.applied} of {report.requested} accounts.",
      "zh": "{verb} {report.applied}/{report.requested}个账户。"
    },
    "residual.052": { "en": "Unbanned", "zh": "已解封" },
    "residual.053": { "en": "Granted administrator to", "zh": "已授予管理员" },
    "residual.054": { "en": "Deleted", "zh": "已删除" },
    "residual.055": {
      "en": "Select {account.displayName}",
      "zh": "选择{account.displayName}"
    },
    "residual.056": { "en": "Unknown", "zh": "未知" },
    "residual.057": { "en": "Refresh", "zh": "刷新" },
    "residual.058": {
      "en": "Delete {bulkCount} {bulkCount === 1 ? \"account\" : \"accounts\"}?",
      "zh": "删除{bulkCount}个账户？"
    },
    "residual.059": {
      "en": "Type {bulkCount} to confirm",
      "zh": "输入{bulkCount}确认"
    },
    "residual.060": {
      "en": "There are no accounts to show.",
      "zh": "暂无账户可显示。"
    },
    "residual.061": {
      "en": "No accounts match this view.",
      "zh": "当前视图下没有匹配的账户。"
    },
    "residual.062": {
      "en": "from the server configuration",
      "zh": "来自服务器配置"
    },
    "residual.063": { "en": "setup code", "zh": "设置口令" },
    "residual.064": { "en": "shown in the roster", "zh": "会显示在名册里" },
    "residual.065": {
      "en": "for example, Harbor Master",
      "zh": "例如：港务长"
    },
    "residual.066": {
      "en": "Account tools for {APP_NAME}",
      "zh": "{APP_NAME}的账户工具"
    },
    "residual.067": { "en": "Open the Console", "zh": "进入控制台" },
    "residual.068": { "en": "Create Operator", "zh": "创建操作员" },
    "residual.069": {
      "en": "Registration needs the setup code the server was configured with. Accounts created here are administrators.",
      "zh": "注册要填服务器配置里的设置口令。在这里开的账户，都是管理员。"
    },
    "residual.070": { "en": "Balance Dashboard", "zh": "平衡总览" },
    "residual.071": { "en": "The operator console", "zh": "操作员控制台" },
    "residual.072": { "en": "Console", "zh": "控制台" },
    "residual.073": { "en": "Read the window again", "zh": "重新读取窗口" },
    "residual.074": {
      "en": "The reading could not be loaded.",
      "zh": "读数加载失败。"
    },
    "residual.075": {
      "en": "The window could not be read.",
      "zh": "窗口读取失败。"
    },
    "residual.076": { "en": "Reading the window...", "zh": "正在读取窗口..." },
    "residual.077": { "en": "in gate", "zh": "在区间" },
    "residual.078": { "en": "under", "zh": "偏低" },
    "residual.079": { "en": "over", "zh": "偏高" },
    "residual.080": { "en": "unplayed", "zh": "未开局" },
    "residual.081": { "en": "no source", "zh": "无来源" },
    "residual.082": { "en": "no gate", "zh": "无门槛" },
    "residual.083": { "en": "inside the gates", "zh": "全部在区间" },
    "residual.084": { "en": "out of gate", "zh": "出界" },
    "residual.085": { "en": "no reading yet", "zh": "暂无读数" },
    "residual.086": { "en": "clear to ship", "zh": "可放行" },
    "residual.087": { "en": "held", "zh": "暂缓" },
    "residual.088": { "en": "no verdict yet", "zh": "尚无判定" },
    "residual.089": { "en": "Reading", "zh": "读数" },
    "residual.090": { "en": "Window", "zh": "窗口" },
    "residual.091": { "en": "Gate", "zh": "门槛" },
    "residual.092": { "en": "Verdict", "zh": "判定" },
    "residual.093": {
      "en": "No Ocean Gambit voyage in the window yet: the panels below are the gates, and what each one waits on.",
      "zh": "窗口里还没有暗潮航程：下面的面板列出各道门槛，以及每道门槛在等什么。"
    },
    "residual.094": {
      "en": "{window.voyages} {window.voyages === 1 ? \"voyage\" : \"voyages\"}, {window.captains} captains.",
      "zh": "{window.voyages}次航程，{window.captains}位船长。"
    },
    "residual.095": {
      "en": "Nothing in this window was recorded: the sampler was off.",
      "zh": "这个窗口什么都没记到：采样器当时没开。"
    },
    "residual.096": {
      "en": "{window.truncated} hit the event cap.",
      "zh": "{window.truncated}项触及事件上限。"
    },
    "residual.097": {
      "en": "{window.unreadable} could not be read.",
      "zh": "{window.unreadable}项读不出来。"
    },
    "residual.098": {
      "en": "{sharePercent(without, voyages)} of {voyages} {voyages === 1 ? \"lobby\" : \"lobbies\"}",
      "zh": "占{voyages}个大厅的{sharePercent(without, voyages)}"
    },
    "residual.099": {
      "en": "{roleCard(role).title} {sharePercent(cover, takes)} of {takes}",
      "zh": "{roleCard(role).title}：{sharePercent(cover, takes)}，共{takes}次"
    },
    "residual.100": {
      "en": "{ratePercent(cell.rate)} of {cell.played}",
      "zh": "{ratePercent(cell.rate)}，共{cell.played}程"
    },
    "residual.101": {
      "en": "{sharePercent(stayed, marooned.length)} of {marooned.length}",
      "zh": "{sharePercent(stayed, marooned.length)}，共{marooned.length}人"
    },
    "residual.102": {
      "en": "{sharePercent(bankrupt, outcomes.length)} of {outcomes.length}",
      "zh": "{sharePercent(bankrupt, outcomes.length)}，共{outcomes.length}人"
    },
    "residual.103": {
      "en": "🔒 Broker's Favor unlocks at Renown ${BROKERS_FAVOR_UNLOCK_LEVEL}, ${renownTitleForLevel(BROKERS_FAVOR_UNLOCK_LEVEL)} (${favorLevelsToGo} level${favorLevelsToGo === 1 ? \"\" : \"s\"} to go)",
      "zh": "🔒 掮客的人情在声望{BROKERS_FAVOR_UNLOCK_LEVEL}解锁，即{renownTitleForLevel(BROKERS_FAVOR_UNLOCK_LEVEL)}（还差{favorLevelsToGo}级）"
    },
    "residual.104": {
      "en": "${legacy.renownXP} XP earned in total",
      "zh": "累计获得{legacy.renownXP}点声望经验"
    },
    "residual.105": {
      "en": "${xpIntoLevel} / ${xpForNextLevel} XP to Renown ${level + 1}",
      "zh": "{xpIntoLevel} / {xpForNextLevel}点声望经验，升往声望{level + 1}"
    },
    "residual.106": {
      "en": "${stats.crowns} Sea Master crown${stats.crowns === 1 ? \"\" : \"s\"} · best Reputation ${stats.bestScore}",
      "zh": "{stats.crowns}顶沧海之冠 · 最佳声誉{stats.bestScore}"
    },
    "residual.107": {
      "en": "Head to head with ${rival.displayName}: ${rival.myWins} wins, ${rival.theirWins} losses, ${rival.ties} ties",
      "zh": "与{rival.displayName}的交手：{rival.myWins}胜、{rival.theirWins}负、{rival.ties}平"
    },
    "residual.108": {
      "en": "Your Renown and voyage count suggest you are ready for ${openWaters.name}. ${roundsFor(\"open_waters\")} rounds, ${openWaters.renownXpMultiplier}x Renown, and Imperial Mandates on rounds ${mandatesFor(\"open_waters\")}.",
      "zh": "你的声望和航程数说明你可以试试{openWaters.name}了。{roundsFor(\"open_waters\")}轮，{openWaters.renownXpMultiplier}倍声望，第{mandatesFor(\"open_waters\")}轮起有皇命。"
    },
    "residual.109": {
      "en": "${fairWinds.name} is the right starting point. ${roundsFor(\"fair_winds\")} rounds, gentle pirate odds, and no mandates. Learn the loop before taking on heavier waters.",
      "zh": "{fairWinds.name}是最合适的起点。{roundsFor(\"fair_winds\")}轮，海盗概率温和，也没有皇命。先把循环摸熟，再去挑更重的水域。"
    },
    "residual.110": {
      "en": "${monsoon.name} has a ${pirateOddsLabel(monsoon)} pirate raid chance. Make sure you can survive a bankruptcy before risking it.",
      "zh": "{monsoon.name}的劫掠概率是{pirateOddsLabel(monsoon)}。冒这个险之前，先确保自己扛得住一次破产。"
    },
    "residual.111": {
      "en": "${data.winnerName} was first to complete ${WORD_ON_THE_DOCKS_THRESHOLD} trade orders this voyage.",
      "zh": "{data.winnerName}在本航程率先完成了{WORD_ON_THE_DOCKS_THRESHOLD}笔委托。"
    },
    "residual.112": {
      "en": "${data.winnerName} was first to ${WORD_ON_THE_DOCKS_THRESHOLD} orders.",
      "zh": "{data.winnerName}率先做满{WORD_ON_THE_DOCKS_THRESHOLD}笔委托。"
    },
    "residual.113": {
      "en": "Hire artisans only when you can sustain at least two rounds of wages. ${play.failureRule}",
      "zh": "至少付得起两轮工钱，才雇工匠。{play.failureRule}"
    },
    "residual.114": {
      "en": "Day ${res.day} claimed: +${res.xpGained} Renown XP",
      "zh": "第{res.day}天已领取：+{res.xpGained}声望经验"
    },
    "residual.115": {
      "en": "Press ? or F2 in a game room to see all keyboard shortcuts.",
      "zh": "在港湾里按 ? 或 F2，查看全部快捷键。"
    },
    "residual.116": {
      "en": "No messages match &ldquo;{searchQuery}&rdquo;.",
      "zh": "没有消息与“{searchQuery}”匹配。"
    },
    "residual.117": {
      "en": "${nameCount(needed)} on one captain opens that captain's manifest to the whole harbor and closes this leg's trading.",
      "zh": "一位船长身上凑够{nameCount(needed)}个名字，就能把那位船长的舱单向全港湾公开，并结束本航段的交易。"
    },
    "residual.118": {
      "en": "This vote opens at leg ${opensAt}, and this is leg ${game.currentRound}. A simple majority of the captains still sailing then opens one captain's manifest: ${AUDIT_REVEAL_WORDS} of their most recent order fulfillments, and nothing else. A carried vote ends that leg's trading, the voyage carries on at the next leg, and the harbor opens one manifest a voyage.",
      "zh": "这次稽查从第{opensAt}航段起开放，现在是第{game.currentRound}航段。还在航程里的船长，简单多数联署，就能公开一位船长的舱单：只公开他最近{AUDIT_REVEAL_WORDS}项委托交付记录，别的都不公开。联署通过的稽查会结束那一航段的交易，航程照常进入下一航段；每航程，港湾只公开一份舱单。"
    },
    "residual.119": {
      "en": "Others can still take ${draft.offersLeft} more offer${draft.offersLeft === 1 ? \"\" : \"s\"} from you this voyage.",
      "zh": "本航程别人还能从你这里接下{draft.offersLeft}份报价。"
    },
    "residual.120": {
      "en": "Unlocks at Renown Level ${FLEXIBLE_BARTER_UNLOCK_LEVEL}, ${toGo} level${toGo === 1 ? \"\" : \"s\"} to go.",
      "zh": "声望等级{FLEXIBLE_BARTER_UNLOCK_LEVEL}解锁，还差{toGo}级。"
    },
    "residual.121": {
      "en": "spoken in leg ${row.round} · priced at leg ${landsOn}",
      "zh": "第{row.round}航段开的口 · 第{landsOn}航段生效"
    },
    "residual.122": {
      "en": "Speaking at the bazaar belongs to the {SELLER_PATH.name} path, and you do not hold it this voyage. Whoever holds it is named in the voyage log, and the board below names them the moment they speak.",
      "zh": "在香市开口，是{SELLER_PATH.name}之道的事，你本航程不持此道。持有它的人会写进航程日志；只要一开口，下面那块板子就写出名字。"
    },
    "residual.123": {
      "en": "Once every ${RUMOR_COOLDOWN_ROUNDS} legs, each ${SELLER_PATH.name} captain may spread a word about one commodity, here at the Parley. The next port prices that good against it, by up to ${Math.round(RUMOR_SHIFT_FRACTION * 100)} percent, which is the same hand the Harbormaster leans a port with. The whole harbor is told who spoke and which good they named, and only the speaker knows which way they leaned until the port they named has priced it.",
      "zh": "每{RUMOR_COOLDOWN_ROUNDS}个航段一次，每位{SELLER_PATH.name}船长可以在洽谈时放出一件货的风声。下一港为那件货定价时会带上这个方向，最高{Math.round(RUMOR_SHIFT_FRACTION * 100)}%，与港务长压港用的是同一只手。谁开的口、点的是哪件货，全港湾都会知道；只有开口的人自己知道押的是哪一边，直到他点名的那个港口为此定价。"
    },
    "residual.124": {
      "en": "✅ Your cover was spent this leg: ${spent.sellerName}'s guns answered the raid and your Gold stayed where it was.",
      "zh": "✅ 本航段你的护卫派上了用场：{spent.sellerName}的炮口挡下了劫掠，你的金币分文未动。"
    },
    "residual.125": {
      "en": "✅ You are covered this leg by ${covered.sellerName} for ${covered.fee} Gold, paid at the handshake. A raid on your hold meets their cannons, and what their guns do not beat off comes out of their Gold.",
      "zh": "✅ 本航段{covered.sellerName}为你护卫，费用{covered.fee}金币，握手成交时付清。货舱若遇劫掠，由他们的炮口迎击，炮口挡不下的部分从他们的金币里出。"
    },
    "residual.126": {
      "en": "${contract.sellerName} is covering ${who} for ${fee} this leg",
      "zh": "{contract.sellerName}本航段以{fee}金币护卫{who}"
    },
    "residual.127": {
      "en": "${contract.sellerName}'s guns answered a raid meant for ${who}",
      "zh": "{contract.sellerName}的炮口替{who}挡下了一场劫掠"
    },
    "residual.128": {
      "en": "You turned down ${contract.sellerName}'s offer of ${fee}",
      "zh": "你回绝了{contract.sellerName}的{fee}金币报价"
    },
    "residual.129": {
      "en": "🛡️ You are covering ${carrying.buyerName ?? \"a captain\"} this leg for ${carrying.fee} Gold, already paid to you. Your Gold answers the raid their hold does not.",
      "zh": "🛡️ 本航段你替{carrying.buyerName ?? \"一位船长\"}护卫，{carrying.fee}金币已先行付到你手上。轮到海盗找上门，应答的是这笔金币，不是他们的货舱。"
    },
    "residual.130": {
      "en": "🛡️ Your offer stands: ${one.fee} Gold for one leg of cover for ${one.buyerName ?? \"a captain\"}. It waits on them.",
      "zh": "🛡️ 你的报价还挂着：{one.fee}金币，为{one.buyerName ?? \"某位船长\"}护一航段。就等他点头。"
    },
    "residual.131": {
      "en": "🚫 ${refused.buyerName ?? \"A captain\"} turned down your offer of ${refused.fee} Gold. Nothing is owed either way, and the row stays until the leg turns.",
      "zh": "🚫 {refused.buyerName ?? \"有一位船长\"}回绝了你{refused.fee}金币的报价。两不相欠，这一行会留到本航段结束。"
    },
    "residual.132": {
      "en": "One leg of protection, sold by a Convoy captain at a price the two of them agree. The buyer pays the fee at the handshake, and it is the seller's cannons that answer the raid: ${beatenOff} of it is beaten off, and the remaining ${eaten} is deducted from the seller's Gold. The cover lasts the leg it was sold for and no other, and a raid that never comes costs the seller nothing. ${ESCORT_OFFER_DEATH}",
      "zh": "一段护卫，由镖行船长出售，价钱两人自己谈。买家在握手时付清费用；海盗来时，应答的是卖家的炮火：挡下{beatenOff}，余下的{eaten}从卖家的金币里扣。护卫只管它卖出的那个航段，多一段都不管；海盗没来，卖家分文不损。{ESCORT_OFFER_DEATH}"
    },
    "residual.133": {
      "en": "You are the seller here, so the price is yours to name: the buyer pays it at the handshake, and your own Gold answers whatever your guns do not beat off, which is ${eaten} of a raid, down to the bottom of your hold. ${consentFeeRule()} An open offer is any captain's to take, while a named one waits on the captain you named, and one open offer plus one per captain named is the most this market holds from you.",
      "zh": "在这里你是卖家，价钱由你开：买家在握手时付清；你的炮火没挡下的部分由你的金币顶上，也就是一次劫掠里的{eaten}，一直扣到货舱见底。{consentFeeRule()}公开报价人人可接，点名报价只等你点的那位船长；一份公开报价，加上每位被点名船长各一份，就是这个市场替你挂着的最多数量。"
    },
    "residual.134": {
      "en": "⏳ ${readyLine(readyCount, requiredCount)} The phase turns when the rest do.",
      "zh": "⏳ {readyLine(readyCount, requiredCount)}其余人就绪后，阶段自会翻页。"
    },
    "residual.135": {
      "en": "${nameCount(needed)} on one captain puts that captain ashore and spends the vote for the voyage.",
      "zh": "一位船长身上凑够{nameCount(needed)}个名字，就能把那位船长放逐上岸，并用掉本航程的这一次投票。"
    },
    "residual.136": {
      "en": "This vote opens at leg ${rung}, and this is leg ${game.currentRound}. ${MAROON_VOTE_SHARE} of the captains still sailing, rounded up, then put one captain ashore: the ship and its hold go to the harbor, half their Gold stays aboard, and the Harbormaster's hand is theirs for the rest of the voyage. One vote can carry a voyage, and a vote that falls short can be called again on a later leg.",
      "zh": "这次投票从第{rung}航段起开放，现在是第{game.currentRound}航段。还在航程里的船长，凑够{MAROON_VOTE_SHARE}（向上取整）联署，就能把一位船长放逐上岸：船和船上的货舱归港湾，一半的金币留在船上，港务长之权归联署的一方，直到航程结束。一票能左右整程；票数不够，之后的航段还能再发起。"
    },
    "residual.137": {
      "en": "Voted ashore by ${MAROON_VOTE_SHARE.toLowerCase()} of the harbor. The ship and everything on it went to the harbor, half their Gold stayed aboard, and the Harbormaster's hand is theirs for the rest of the voyage.",
      "zh": "被港湾{MAROON_VOTE_SHARE.toLowerCase()}的票数放逐上岸。船和船上的一切归了港湾，一半的金币留在船上，港务长之权归联署的一方，直到航程结束。"
    },
    "residual.138": {
      "en": "The harbor has already named {maroon.carried.name} this voyage. The vote is spent: nothing more is asked of this table until a new voyage.",
      "zh": "本航程港湾已经把{maroon.carried.name}放逐了。这次投票已经用掉：新航程开始之前，不会再向这张牌桌要什么。"
    },
    "residual.139": {
      "en": "The harbor put you ashore and left you its own lever: once a leg, name a port and lean every price at it by ${Math.round(PORT_SHIFT_FRACTION * 100)} percent, up or down. The call is public, and the market that opens next leg is the one that answers it.",
      "zh": "港湾把你放上了岸，也留给你一根自己的杠杆：每航段一次，点名一个港口，把这个港的价格整体抬高或压低{Math.round(PORT_SHIFT_FRACTION * 100)}%。这次出手是公开的，下一航段开市的市场，就是回应它的那一个。"
    },
    "residual.140": {
      "en": "Taking it would put your hull at ${powerAfterTaking(game, card)} power, and a hull carries at most ${HELD_POWER_CAP}.",
      "zh": "收下它会让船体达到{powerAfterTaking(game, card)}点力量，而船体最多承载{HELD_POWER_CAP}点。"
    },
    "residual.141": {
      "en": "A module bolted to a hull, sold at a price the two of you agree. It comes off the seller's hull and onto the buyer's the moment the two of you shake hands, so the buyer needs an open slot, and a hull's ladder tops out at ${MAX_SHIP_LEVEL} slots at ship level ${MAX_SHIP_LEVEL}. The fee is paid when you shake hands. One listing per module a leg, one open offer per captain you name, and an offer nobody takes before the Parley closes is gone.",
      "zh": "装在船体上的模块，价钱两人自己谈。一握手，它就从卖家的船体转到买家手上，所以买家得留一个空位；而船体的阶梯到顶，就是船只等级{MAX_SHIP_LEVEL}的{MAX_SHIP_LEVEL}个仓位。费用在握手时付清。每航段每件模块挂一次，每位被你点名的船长各接一份点名报价，洽谈关门前没人接的报价就此作废。"
    },
    "residual.142": {
      "en": "${progress.delivered} of ${progress.required} handed over",
      "zh": "已交{progress.delivered} / {progress.required}"
    },
    "residual.143": {
      "en": "{peerTradeProfit} of {BROKER_PAYOUT_TARGET} Gold. Only trades with other captains count, and only the coin that moved in them.",
      "zh": "已达{peerTradeProfit}/{BROKER_PAYOUT_TARGET}金币。只计入与其他船长的交易，而且只算其中真正易手的金币。"
    },
    "residual.144": {
      "en": "Clothes lose a point of wear every leg and two on a cold one. A ${SELLER_PATH.name} captain can put ${REFIT_POINTS} points back in a single leg for whatever fee the two of you agree, and anyone can take ${TAILOR_WORK} from the harbor tailors for ${MEND_GOLD_PER_POINT} Gold. One open offer per captain you name, one refit taken on a leg, and an offer nobody takes before the Market closes is gone.",
      "zh": "衣物每个航段掉一点耐久，冷天掉两点。{SELLER_PATH.name}船长可以在一个航段里补回{REFIT_POINTS}点，价钱两人自己谈；任何人都可以找港湾的裁缝做{TAILOR_WORK}，每点{MEND_GOLD_PER_POINT}金币。每位被你点名的船长各接一份点名报价，一个航段只能整补一次；开市关门前没人接的报价就此作废。"
    },
    "residual.145": {
      "en": "${total - visible} still to turn over",
      "zh": "还有{total - visible}张没翻开"
    },
    "residual.146": {
      "en": "${captain.peerTradeProfit} Gold in peer trade",
      "zh": "船长间贸易进账{captain.peerTradeProfit}金币"
    },
    "residual.147": {
      "en": "No name is in yet. ${nameCount(census.needed)} on one captain ${census.needed === 1 ? \"carries\" : \"carry\"} it.",
      "zh": "还没有人署名：要一位船长身上凑够{nameCount(census.needed)}个名字才能通过。"
    },
    "residual.148": {
      "en": "${leader.name} needs ${leader.short === 1 ? \"1 more name\" : `${leader.short} more names`} to carry it.",
      "zh": "{leader.name}还差{leader.short}个署名才能通过。"
    },
    "residual.149": {
      "en": "Your name is in for ${captainName(members, myVote)}. Nothing else is asked of you this leg.",
      "zh": "你已把你的名字署给了{captainName(members, myVote)}。本航段不再要求你做什么。"
    },
    "residual.150": {
      "en": "{leader.name} has every name the vote needs.",
      "zh": "{leader.name}已经凑齐了票上要的所有署名。"
    },
    "residual.151": {
      "en": "has ${nameCount(row.voters.length)}, from ${nameList(row.voters)}.",
      "zh": "已有{nameCount(row.voters.length)}，来自{nameList(row.voters)}。"
    },
    "residual.152": {
      "en": "${captainCount(waiting.length)} ${waiting.length === 1 ? \"has\" : \"have\"} not named anyone: ${nameList(waiting)}. ${nextStep(census.needed)}",
      "zh": "{captainCount(waiting.length)}还没有指认他人：{nameList(waiting)}。{nextStep(census.needed)}"
    },
    "residual.153": {
      "en": "${entries.length} ${entries.length === 1 ? \"line\" : \"lines\"} in the harbor, ${privateLog.length} ${privateLog.length === 1 ? \"line\" : \"lines\"} to you alone",
      "zh": "港湾{entries.length}条，只发给你{privateLog.length}条"
    },
    "residual.154": {
      "en": "💡 Materials consumed <strong>now</strong>. Finished goods and wage deductions happen at <strong>{duePhase}</strong>, not instantly.",
      "zh": "💡 原料<strong>现在</strong>就消耗。成品产出和工钱扣除发生在<strong>{duePhase}</strong>，不是立刻。"
    },
    "residual.155": {
      "en": "💰 Pending Payroll: Deducted at {duePhase}",
      "zh": "💰 待付工钱：{duePhase}扣除"
    },
    "residual.156": {
      "en": "Renown Level {BROKERS_FAVOR_UNLOCK_LEVEL} reached. Starting next voyage, call one in from the Trade Manifest to summon a guaranteed buyer.",
      "zh": "声望等级{BROKERS_FAVOR_UNLOCK_LEVEL}达成。从下趟航程起，可以在贸易舱单上动用一次人情，召来一位必定接手的买家。"
    },
    "residual.157": {
      "en": "+${mine.xpGained} Renown XP this voyage${mine.leveledUp ? \" · Renown level up!\" : \"\"}",
      "zh": "本航程 +{mine.xpGained}声望经验{mine.leveledUp ? \" · 声望升级！\" : \"\"}"
    },
    "residual.158": {
      "en": "${outstandingLent} loan${outstandingLent === 1 ? \"\" : \"s\"} still out",
      "zh": "还有{outstandingLent}笔借款未收回"
    },
    "residual.159": {
      "en": "${outstandingBorrowed} loan${outstandingBorrowed === 1 ? \"\" : \"s\"} still owed",
      "zh": "还有{outstandingBorrowed}笔借款未还清"
    },
    "residual.160": {
      "en": "Replacing it would put your hull at ${powerAfterTaking(game, newMod, card)} power, and a hull carries at most ${HELD_POWER_CAP}.",
      "zh": "换上去会让船体达到{powerAfterTaking(game, newMod, card)}点力量，而船体最多承载{HELD_POWER_CAP}。"
    },
    "residual.161": {
      "en": "Double Tax Strategy: ${cardName(\"smugglers_hold\")} reduces purchase costs and ${cardName(\"tax_evasion\")} halves both VAT and income tax. A powerful financial combo.",
      "zh": "双税战术：{cardName(\"smugglers_hold\")}压低进价，{cardName(\"tax_evasion\")}把市舶税和所得税一起减半。一套强力的财务组合。"
    },
    "residual.162": {
      "en": "Production Engine: ${cardName(\"artisans_workshop\")} boosts worker output and ${cardName(\"salvage_crane\")} refunds the freight on some orders. More goods, more Gold back.",
      "zh": "生产引擎：{cardName(\"artisans_workshop\")}提升工匠产出，{cardName(\"salvage_crane\")}退还部分委托的运费。货更多，金币回得更多。"
    },
    "residual.163": {
      "en": "Intel Network: ${cardName(\"brokers_network\")} discounts every whisper, and ${cardName(\"ocean_relay\")} adds one more at no cost. Maximum market intelligence.",
      "zh": "情报网：{cardName(\"brokers_network\")}让每条掮客低语都打折，{cardName(\"ocean_relay\")}再免费加一条。市场情报拉满。"
    },
    "residual.164": {
      "en": "Penalty Stack: ${cardName(\"overdrive_engine\")} adds maintenance and ${cardName(\"bulk_hauler\")} raises upgrade cost. Consider swapping one if funds are tight.",
      "zh": "负担叠加：{cardName(\"overdrive_engine\")}增加维护费，{cardName(\"bulk_hauler\")}抬高升级成本。手头紧就考虑换掉一个。"
    },
    "residual.165": {
      "en": "Charter Combo: ${cardName(\"kiln_cellar\")} discounts every bulk good, and ${cardName(\"bureau_token\")} pays more on orders for the charter's own goods. Buy cheap, sell high.",
      "zh": "特许组合：{cardName(\"kiln_cellar\")}让所有散货都降价，{cardName(\"bureau_token\")}为特许自家货物的委托多付钱。低价买进，高价卖出。"
    },
    "residual.166": {
      "en": "Exotic Trade: ${cardName(\"foreign_quarter_pass\")} discounts every luxury good, and ${cardName(\"fleet_of_treasures\")} takes Gold off freight on the same trade. Tier 2 goods at tier 0 prices.",
      "zh": "异域贸易：{cardName(\"foreign_quarter_pass\")}让所有奢华货物都降价，{cardName(\"fleet_of_treasures\")}在这类买卖上再削运费。二级货，零级价。"
    },
    "residual.167": {
      "en": "🧾 Est. VAT: ${totalVat} Gold (per unit shown on hover)",
      "zh": "🧾 预估市舶税：{totalVat}金币（单件明细悬停可见）"
    },
    "residual.168": {
      "en": "🔒 Broker's Favor unlocks at Renown Level ${BROKERS_FAVOR_UNLOCK_LEVEL}: call one in once per voyage to summon a guaranteed buyer for a good already in your hold. You are Renown Level ${game.renownLevel} now, ${BROKERS_FAVOR_UNLOCK_LEVEL - game.renownLevel} to go.",
      "zh": "🔒 掮客的人情在声望等级{BROKERS_FAVOR_UNLOCK_LEVEL}解锁：每程可唤一次，为货舱里已有的一件货，招来一位必定接手的买家。你现在的声望等级是{game.renownLevel}，还差{BROKERS_FAVOR_UNLOCK_LEVEL - game.renownLevel}级。"
    },
    "residual.169": {
      "en": "No ${favorItem} left in your hold",
      "zh": "货舱里没有{favorItem}了"
    },
    "residual.170": {
      "en": "How much ${favorItem} should the Broker sell?",
      "zh": "要让掮客卖出多少{favorItem}？"
    },
    "residual.171": {
      "en": "of ${favorHeld} in your hold",
      "zh": "，货舱里共有{favorHeld}"
    },
    "residual.172": {
      "en": "Your card is down. ${caption}",
      "zh": "你的牌已扣下。{caption}"
    },
    "residual.173": {
      "en": "Before this round's bills come due, your ship has to clear open water. There is a ${raidPct}% chance pirates find you and take every coin in your hold. Hire an escort to sail through safely, or risk it and save the Gold.",
      "zh": "本轮账单到期之前，你的船得先闯过一片开阔水域。海盗有{raidPct}%的概率找上你，把你舱里的每一枚金币都拿走。雇一艘护航安然驶过，要么就冒这个险，把金币省下。"
    },
    "residual.174": {
      "en": "🛡️ {cover.sellerName} sold you this leg's cover. Their cannons beat off {Math.round(escortCoverage() * 100)}% of a boarding party, and their own hold answers for the rest.",
      "zh": "🛡️ {cover.sellerName}把本航段的护卫卖给了你。他们的炮口能挡下登船队{Math.round(escortCoverage() * 100)}%的攻势，挡不下的部分由他们自己的货舱担着。"
    },
    "residual.175": {
      "en": "Escort costs ${escortFee} Gold but expected loss is ${Math.round(expectedLoss)} Gold. Hiring the escort saves Gold on average.",
      "zh": "雇护航要{escortFee}金币，预期损失却有{Math.round(expectedLoss)}金币。平均算下来，雇护航反而更省。"
    },
    "residual.176": {
      "en": "An unnamed trader on the quay: ${bargePrice} Gold a ration against the port's ${RATION_PRICE}.",
      "zh": "码头上的无名商贩：一份口粮{bargePrice}金币，港口的价是{RATION_PRICE}。"
    },
    "residual.177": {
      "en": "a leg of rations costs ${legCost} Gold",
      "zh": "一航段的口粮要{legCost}金币"
    },
    "residual.178": {
      "en": "🐟 Preserve ${batches * PRESERVE_MEALS_IN} Produce into ${batches * PRESERVE_MEALS_OUT} Salt Fish",
      "zh": "🐟 把{batches * PRESERVE_MEALS_IN}份时鲜腌成{batches * PRESERVE_MEALS_OUT}份咸鱼"
    },
    "residual.179": {
      "en": "Unpaid loans settle automatically at the end of Round ${maxRounds}, and the Gold goes to the lender.",
      "zh": "未还清的借款会在第{maxRounds}轮结束时自动结清，金币归债主。"
    },
    "residual.180": {
      "en": "A loan transfers instantly if someone helps. Repay it any time before the voyage ends. {loanSettleLine(game.maxRounds)}",
      "zh": "一有人出手，借款立刻到账。航程结束前随时可以还。{loanSettleLine(game.maxRounds)}"
    },
    "residual.181": {
      "en": "🆘 Waiting for a captain to lend you ${myRequest.amount} Gold…",
      "zh": "🆘 等待船长借给你{myRequest.amount}金币..."
    },
    "residual.182": {
      "en": "Every module the yard could deal would pass this hull's ${HELD_POWER_CAP} power. Selling one at the Parley table makes room.",
      "zh": "船坞能给到的模块，每一件都超过这条船体{HELD_POWER_CAP}点的承载上限。到洽谈桌卖掉一件，就腾出了位置。"
    },
    "residual.183": {
      "en": "🚢 Ship Level: ${game.shipLevel} | ⚓ Discount: ${game.shipLevel * SHIP_DISCOUNT_PER_LEVEL} Gold",
      "zh": "🚢 船只等级：{game.shipLevel}｜⚓ 折扣：{game.shipLevel * SHIP_DISCOUNT_PER_LEVEL}金币"
    },
    "residual.184": {
      "en": "⚓ Upgrade Ship (Lvl ${game.shipLevel + 1}), Cost ${upgCost} Gold | +1 Slot, +${SHIP_DISCOUNT_PER_LEVEL} Discount",
      "zh": "⚓ 升级船只（{game.shipLevel + 1}级），花费{upgCost}金币｜+1仓位，+{SHIP_DISCOUNT_PER_LEVEL}折扣"
    },
    "residual.185": {
      "en": "🧥 Wear ${good} (${game.inventory[good]} in the hold, ${GARMENTS[good].warmth} warmth)",
      "zh": "🧥 穿上{good}（货舱有{game.inventory[good]}，暖意{GARMENTS[good].warmth}）"
    },
    "residual.186": {
      "en": "A garment the sea has worn out becomes rags and is scrapped for ${RAG_SCRAP_VALUE} Gold. Frostbite costs the newest hand one leg of work rather than their place aboard.",
      "zh": "衣物被海磨破就成了碎布，拆掉换回{RAG_SCRAP_VALUE}金币。冻伤只让新来的水手歇一个航段的工，不会让他离开船。"
    },
    "residual.187": {
      "en": "${raidPct}% chance of losing all Gold on hand",
      "zh": "有{raidPct}%的概率丢掉手头所有的金币"
    },
    "residual.188": {
      "en": "⏳ Waiting for the host to start the voyage… (${harborIds.length} in harbor)",
      "zh": "⏳ 等待港主启航...（港湾里{harborIds.length}人）"
    },
    "residual.189": {
      "en": "💰 Current Funds: {game.money} Gold | 📦 See Inventory on the left",
      "zh": "💰 现有资金：{game.money}金币｜📦 存货见左侧"
    },
    "residual.190": {
      "en": "You have backed {mine.amount} Gold",
      "zh": "你已跟投{mine.amount}金币"
    },
    "residual.191": {
      "en": "Once a voyage, at a port in legs ${PATH_SWITCH_FROM_ROUND} through ${PATH_SWITCH_TO_ROUND}, for ${fee} Gold at your Renown. Unfulfilled pathbound orders are forfeited, and the whole fleet sees the change written into the voyage log.",
      "zh": "每程一次，可在第{PATH_SWITCH_FROM_ROUND}至{PATH_SWITCH_TO_ROUND}航段的港口改走商道，费用{fee}金币，按你的声望计算。未交付的商道委托一并作废，全船队都会在航程日志里看到你改道。"
    },
    "residual.192": {
      "en": "Hosted by {room.host.displayName}",
      "zh": "由{room.host.displayName}主持"
    },
    "residual.193": {
      "en": "{RENOWN_BONUS_LINE}. It grows from the Reputation you bank across the voyage, so it only ever goes up, even for a captain whose books fail.",
      "zh": "{RENOWN_BONUS_LINE}。它来自你在航程中存下的声誉，只会往上走，就算船长的账目崩了也一样。"
    },
    "residual.194": {
      "en": "Merits ({meritIds.length} of 9)",
      "zh": "功勋（{meritIds.length}/9）"
    },
    "residual.195": {
      "en": "{chronicles.length} recent voyage {chronicles.length === 1 ? \"\" : \"s\"} shown, oldest to newest",
      "zh": "显示最近{chronicles.length}次航程，由旧到新"
    },
    "residual.196": {
      "en": "Bands are read from {targetName}'s live snapshot. The Harbormaster only shares what your standing allows.",
      "zh": "各档数据读自{targetName}的实时快照。港务长只分享你的身份允许看到的部分。"
    },
    "residual.197": {
      "en": "That offer belongs to an earlier leg.",
      "zh": "这个报价属于更早的航段。"
    },
    "residual.198": {
      "en": "That offer has already gone.",
      "zh": "这个报价已经没了。"
    },
    "residual.199": {
      "en": "That offer was addressed to another captain.",
      "zh": "这个报价是写给另一位船长的。"
    },
    "residual.200": {
      "en": "That captain has already taken on a refit this leg.",
      "zh": "那位船长本航段已经整补过了。"
    },
    "residual.201": {
      "en": "You are already covered for this leg.",
      "zh": "本航段你已经有护卫了。"
    },
    "residual.202": {
      "en": "Not a member of that room",
      "zh": "不是这个港湾的成员"
    },
    "residual.203": {
      "en": "Pick two different items to barter.",
      "zh": "易货得选两样不同的物品。"
    },
    "residual.204": {
      "en": "Each Renown level grants a small Gold bonus at the start of your next fresh voyage",
      "zh": "每级声望都会在你下一次全新航程开局时，送上一小笔金币奖励"
    },
    "residual.205": {
      "en": "That captain is not in this harbor.",
      "zh": "那位船长不在这个港湾。"
    },
    "residual.206": {
      "en": "A fee is a whole number of Gold, at least ${CONSENT_FEE_MIN} and at most ${CONSENT_FEE_MAX}.",
      "zh": "费用是整数金币，至少{CONSENT_FEE_MIN}，至多{CONSENT_FEE_MAX}。"
    },
    "residual.207": {
      "en": "A fee is paid at the handshake and you hold ${hold} Gold: this offer costs ${fee}.",
      "zh": "费用在握手成交时付清，你手上有{hold}金币：这份报价要{fee}。"
    },
    "residual.208": {
      "en": "An offer nobody takes before the Parley closes is gone.",
      "zh": "洽谈关闭前无人接下的报价就作废了。"
    },
    "residual.209": {
      "en": "The escort costs a share of whatever you're carrying that round, so it's cheapest exactly when you have the least to protect.",
      "zh": "护航费从你那一轮带的货里抽成，所以手头越没什么可护，它就越便宜。"
    },
    "residual.210": {
      "en": "The harbor is no longer counting your seat.",
      "zh": "港湾不再把你这个席位算进去了。"
    },
    "residual.211": {
      "en": "That captain is not one the harbor is still counting.",
      "zh": "港湾已经不算那位船长了。"
    },
    "residual.212": {
      "en": "This account is not an administrator.",
      "zh": "这个账户不是管理员。"
    },
    "residual.213": {
      "en": "This account is no longer an administrator.",
      "zh": "这个账户已不再是管理员。"
    },
    "residual.214": {
      "en": "There is a ${pct(first)} chance, rising to ${pct(second)} past the midpoint.",
      "zh": "有{pct(first)}的概率，过了中点升到{pct(second)}。"
    },
    "residual.215": { "en": "🏪 Market: Buying", "zh": "🏪 开市：采购" },
    "residual.216": { "en": "🤝 Parley: Bartering", "zh": "🤝 洽谈：易货" },
    "residual.217": {
      "en": "📜 On round${mandates.length === 1 ? \"\" : \"s\"} ${mandates.join(\", \")} the Emperor commissions a <strong>mandate</strong>: one large order at a fixed reward, and the only order exempt from VAT. It often asks for more than a single hold carries, so plan to barter or borrow to fill it.",
      "zh": "📜 在第{mandates.join(\"、\")}轮，皇帝会颁下一道<strong>皇命</strong>：一笔大额委托，报酬固定，而且是唯一免市舶税的委托。它要的货常常一个货舱装不下，所以提前打算好，靠易货或借货把它填满。"
    },
    "residual.218": {
      "en": "In these waters a broker can be corrupt. The rumor you buy is still true and still arrives, always, but a corrupt one also leaks your position to the pirates. The log says so plainly when it happens, and the odds you see already include it.",
      "zh": "在这片水域，掮客可能是通匪的。你买来的传闻依旧属实，也一定会送到；但通匪的掮客还会把你的位置泄露给海盗。事发时日志会直说，你看到的概率已经把这一层算进去了。"
    },
    "residual.219": { "en": "Save game state", "zh": "保存游戏进度" },
    "residual.220": { "en": "Next phase or continue", "zh": "下一阶段或继续" },
    "residual.221": {
      "en": "Open the full navigation guide",
      "zh": "打开完整导航指南"
    },
    "residual.222": {
      "en": "Open this shortcut help",
      "zh": "打开快捷键帮助"
    },
    "residual.223": {
      "en": "Close this shortcut help",
      "zh": "关闭快捷键帮助"
    },
    "residual.224": {
      "en": "🃏 The Path Draft: keep one card",
      "zh": "🃏 择道：留下一张"
    },
    "residual.225": { "en": "⚓ Welcome aboard", "zh": "⚓ 欢迎登船" },
    "residual.226": {
      "en": "🏆 What you're playing for",
      "zh": "🏆 你在玩什么"
    },
    "residual.227": { "en": "🔄 How a round runs", "zh": "🔄 一轮如何展开" },
    "residual.228": {
      "en": "📋 Orders: Filling trade orders",
      "zh": "📋 委托：交付贸易委托"
    },
    "residual.229": { "en": "⚠️ The artisan trap", "zh": "⚠️ 工匠陷阱" },
    "residual.230": { "en": "🏴‍☠️ Pirates at Resolve", "zh": "🏴‍☠️ 结算时的海盗" },
    "residual.231": { "en": "Resolve: Settlement", "zh": "结算：清账" },
    "residual.232": { "en": "🚢 You are ready", "zh": "🚢 可以出发了" },
    "residual.233": {
      "en": "• ${w?.label ?? id} (${w?.wage ?? 0} Gold/Round): Makes ${makes}",
      "zh": "• {w?.label ?? id}（每轮{w?.wage ?? 0}金币）：产出{makes}"
    },
    "residual.234": {
      "en": "The goods that answer a cold leg, and the cards that speak of one: read against the wardrobe's own table, which is where a garment's warmth already lives.",
      "zh": "应付寒冷航段的货物，以及说到寒冷的卡牌：对照衣箱自己的那张表来读，每件衣服的暖意本来就写在那里。"
    },
    "residual.235": {
      "en": "It loses its worth as it sits, a food turning in the hold or a good worth less than it was. A keeping is the clock this is read against, and the pantry is where the keepings live.",
      "zh": "放着不动就掉价：食物在舱里变质，货物不如从前值钱。它对着算的时钟是保鲜期，各种保鲜期都记在伙房里。"
    },
    "residual.236": {
      "en": "It is kept: salted, dried, or otherwise made to outlast the voyage it was bought for.",
      "zh": "耐储：腌过、晒过，或者用别的办法，让它熬过当初买它要走的航程。"
    },
    "residual.237": {
      "en": "Thread and the cloth made from it, the raw fibres included, because a fibre is cloth that has not been spun yet.",
      "zh": "线和用线织成的布，生纤维也算在内，因为纤维是还没纺成布的布。"
    },
    "residual.238": {
      "en": "The expensive end of the catalogue, where a slot carries far more Gold than the slot beside it.",
      "zh": "货目里贵的那一头：同样一格里装的金币，比旁边的格子多得多。"
    },
    "residual.239": {
      "en": "Guns, the ships that carry them, and the contracts that hire them: anything bought to meet a raid.",
      "zh": "枪炮、载炮的船，以及雇佣它们的契约：一切为迎击劫掠而买的东西。"
    },
    "residual.240": {
      "en": "Cargo that arrives accounted for: bonded, inspected, or closed against the air.",
      "zh": "到岸就有账可查的货：保税、受检，或者密封不与空气相通。"
    },
    "residual.241": {
      "en": "Trade done in the open and on the record, and the name it earns a captain.",
      "zh": "摆在明面上、记在册子上的买卖，以及它给船长挣来的名声。"
    },
    "residual.242": {
      "en": "An obligation carried rather than paid: a loan, a due, or a claim on Gold that has not been earned yet.",
      "zh": "背着还没还清的义务：一笔借款、一笔欠款，或者一份对还没到手的金币的索取。"
    },
    "residual.243": {
      "en": "⚓ Avoiding Bankruptcy Strategies:",
      "zh": "⚓ 避免破产的策略："
    },
    "residual.244": {
      "en": "⚓ Staying Afloat in ${play.badge}:",
      "zh": "⚓ 在{play.badge}里稳住船身："
    },
    "residual.245": {
      "en": "\\n🛟 If the Bills Beat You:\\n${play.failureRule}\\n",
      "zh": "\\n🛟 账单要是先压垮了你：\\n{play.failureRule}\\n"
    },
    "residual.246": {
      "en": "Barge revenue share of all food spending",
      "zh": "驳船收入在全部食物开支中的占比"
    },
    "residual.247": {
      "en": "no leg report from a provisions harbor",
      "zh": "没有来自补给港的航段报告"
    },
    "residual.248": {
      "en": "no food bought in the window",
      "zh": "窗口内没有购买食物"
    },
    "residual.249": {
      "en": "{ratePercent(barge / food)} of {food} Gold over {voyages} {voyages === 1 ? \"voyage\" : \"voyages\"}",
      "zh": "{ratePercent(barge / food)}：{food}金币开支，覆盖{voyages}次航程"
    },
    "residual.250": { "en": "no threshold in the plan", "zh": "计划未设门槛" },
    "residual.251": {
      "en": "Lobbies that sailed without the Barge",
      "zh": "未开驳船就起航的大厅"
    },
    "residual.252": { "en": "Quartermaster fill", "zh": "司库满员率" },
    "residual.253": { "en": "Path pick rate", "zh": "商道选取率" },
    "residual.254": { "en": "Free Captain pick rate", "zh": "自由船长选取率" },
    "residual.255": { "en": "The Quartermaster seat", "zh": "司库席位" },
    "residual.256": {
      "en": "Is the Quartermaster seat healthy?",
      "zh": "司库席位健康吗？"
    },
    "residual.257": {
      "en": "No reading yet: the seat's three readings are counts over an event the record carries and this page does not reduce. The Barge's own two numbers are read below.",
      "zh": "暂无读数：这个席位的三项读数，数的是记录里已经带着的一个事件，本页还没有汇总它。驳船自己的两个数字在下面读。"
    },
    "residual.258": {
      "en": "Three of the seat's readings are counts over an event the record already carries: the path each captain sailed is filed once per captain when the draft settles, with the seconds the table took to choose, and both the pick rate and the Quartermaster's share of the fleet are counted from it. The page does not reduce that event yet, so the three read as not measurable rather than as zeroes: a rate nobody computed is not a zero, and this is a reading to write rather than a source that is missing.",
      "zh": "司库席位的三项读数，数的是一个记录里本来就带的事件：抽取落定时，每位船长走的商道按人登记一次，连同牌桌挑牌花掉的秒数；商道选取率和司库在全船队中的占比，都从这个事件里数出来。本页还没有汇总它，所以这三项读作测不出来，而不是零：没人算过的比率不是零；这是还等着写的读数，不是缺了来源。"
    },
    "residual.259": {
      "en": "The Barge's two numbers are read from the leg reports: each captain files the voyage's running food spending and Barge spending with the leg, and the page takes the report at their greatest leg rather than adding the legs up, because the figures are the voyage's totals and counting them per leg would count every purchase once per leg it survived. A voyage whose captains filed no such pair was not playing the provisions layer, and it is left out of the sample rather than counted as a lobby that avoided the vendor.",
      "zh": "驳船的两个数字从航段报告里读：每位船长随航段登记本航程累计的食物开支与驳船开支。本页取各人最大航段的那份报告，不把各段相加：这些数字是整程的合计，按航段加起来，会把每笔购买在它活过的每个航段里重数一遍。没登记这对数字的航程，是没开给养层，直接从样本里去掉，不算躲开商贩的大厅。"
    },
    "residual.260": {
      "en": "The top card's share of winning builds",
      "zh": "头名卡牌在获胜卡组中的占比"
    },
    "residual.261": { "en": "no card above 35%", "zh": "没有卡牌超过35%" },
    "residual.262": {
      "en": "The top card pairing",
      "zh": "出现最多的卡牌组合"
    },
    "residual.263": {
      "en": "no pair above 62% over 40 appearances",
      "zh": "出场超过40次的组合都没有超过62%"
    },
    "residual.264": { "en": "Charter split deviation", "zh": "特许分化偏差" },
    "residual.265": {
      "en": "no charter taken in the window",
      "zh": "窗口内没人选过特许"
    },
    "residual.266": {
      "en": "{splitTakes} {splitTakes === 1 ? \"take\" : \"takes\"}, none past the {CARD_CONVERSION_FLOOR} a path is read over",
      "zh": "{splitTakes}次选取，都没到判定一条商道所需的{CARD_CONVERSION_FLOOR}次"
    },
    "residual.267": {
      "en": "{PATHS[widest.path].name}, {widest.points} points off even over {widest.takes} takes",
      "zh": "{PATHS[widest.path].name}，取了{widest.takes}次也偏出{widest.points}点"
    },
    "residual.268": { "en": "no deviation above 20%", "zh": "偏差没有超过20%" },
    "residual.269": {
      "en": "Distinct goods traded",
      "zh": "交易过的不同货物数"
    },
    "residual.270": { "en": "Bourse fills", "zh": "交易所成交量" },
    "residual.271": {
      "en": "Cover charter take rate, by alignment",
      "zh": "护卫特许选取率，按阵营"
    },
    "residual.272": {
      "en": "Distinct goods a hold closes a leg carrying, median",
      "zh": "收段时货舱携带的不同货物数，中位数"
    },
    "residual.273": {
      "en": "no leg report in the window",
      "zh": "窗口内没有航段报告"
    },
    "residual.274": {
      "en": "{medianGoods} over {legReports.length} captain legs",
      "zh": "{medianGoods}，覆盖{legReports.length}个船长航段"
    },
    "residual.275": { "en": "no gate yet", "zh": "还没有门槛" },
    "residual.276": {
      "en": "Captain legs closing on one good or none",
      "zh": "只带一种货或空舱收段的船长航段"
    },
    "residual.277": {
      "en": "Offer units posted, filled, expired",
      "zh": "报价份数：挂出的、成交的、过期的"
    },
    "residual.278": { "en": "The staples", "zh": "常备货" },
    "residual.279": {
      "en": "Is anything becoming a staple?",
      "zh": "有货物正在变成常备货吗？"
    },
    "residual.280": {
      "en": "No gate yet: the card gates are Epic F's and the goods and Bourse gates are Epic G's, so four slots stand, and the charter gate has no path past its floor yet.",
      "zh": "还没有门槛：卡牌门槛归史诗 F，货物和交易所门槛归史诗 G，所以这四个位置先空着；特许门槛也还没有一条商道越过它的下限。"
    },
    "residual.281": {
      "en": "The card gates are Epic F's and the goods and Bourse gates are Epic G's, so the four gates above are slots until those epics ship.",
      "zh": "卡牌门槛属于史诗 F，货物和交易所门槛属于史诗 G；那些史诗上线之前，上面四道门槛都是空位。"
    },
    "residual.282": {
      "en": "The record keeps the count of goods a leg dealt and a hold closed with, never their names, so the share of goods traded the plan asks for has no source until an event carries the identity rather than the count.",
      "zh": "记录只留下一个航段经手、收段时的货物件数，从不记它们的名字；计划要的货物交易占比没处可读，除非哪天有事件带上身份，而不只是计数。"
    },
    "residual.283": {
      "en": "The two charter rows are the window's own takes, filed once per captain per voyage when the moment is answered at leg four. The split is read inside each path, because the plan's question is which of a path's two charters captains reach for, and a path is only judged once it holds the floor the card reader reads its own card statistics over; the value names the widest judged path, so the deviation it prints and the verdict over it are about the same path. The cover row is the plan's watch rather than a gate: a charter that only traitors take has stopped being cover, so the row reads how often the salvage charters were taken by each alignment, and it is left unjudged because the plan set no threshold on it.",
      "zh": "两行特许数据都是本窗口自己的选取，在第四航段回答的那一刻，按人、按航程各登记一次。分化在每条商道内部读，因为计划要问的是：一条商道上的两种特许，船长们会伸手去拿哪一种。一条商道要取够卡牌读数所依据的下限，才谈得上判定；显示的值取已判定商道中最宽的那条，所以印出的偏差和它上面的判定说的是同一条商道。护卫一行是计划的观察项，不是门槛：只有叛徒才拿的特许，已经不再是护卫，所以这一行数的是各阵营取打捞特许的频率。计划没有为它设阈值，也就不作判定。"
    },
    "residual.284": {
      "en": "{roleCard(cell.alignment).title}, {cell.band} seats",
      "zh": "{roleCard(cell.alignment).title}，{cell.band}席"
    },
    "residual.285": { "en": "no voyage played", "zh": "没有跑过的航程" },
    "residual.286": {
      "en": "Swing across played bands, {roleCard(swing.alignment).title}",
      "zh": "已跑分段之间的波动，{roleCard(swing.alignment).title}"
    },
    "residual.287": { "en": "no band played", "zh": "没有跑过的分段" },
    "residual.288": {
      "en": "one played band at most",
      "zh": "最多只有一个跑过的分段"
    },
    "residual.289": { "en": "The variance", "zh": "波动" },
    "residual.290": {
      "en": "Is the variance too swingy?",
      "zh": "波动是不是太烈了？"
    },
    "residual.291": {
      "en": "No voyage in the window has a gate to read yet.",
      "zh": "窗口内的航程都还没有可读的门槛。"
    },
    "residual.292": {
      "en": "The swing has no threshold in the plan: its gate is that a rate does not move as the table grows, so the points beside each role are what moving would look like rather than a band to fail.",
      "zh": "计划没有为波动设阈值：它的门槛是比率不随牌桌人数增长而移动。每个角色旁边的点数，写的是移动起来会是什么样子，不是一条会不及格的区间。"
    },
    "residual.293": {
      "en": "Session length is measured from the moment the harbor was charted to the moment the voyage closed, which is the plan's lobby to reveal, and only over voyages that concluded at five seats: a wiped or emptied voyage stopped early and its clock is not a session.",
      "zh": "一局时长从开港那一刻量到收官那一刻，也就是计划说的从大厅到揭晓，而且只算五席收官的航程：清空或散场的航程提前停了，它那段时钟不算一局。"
    },
    "residual.294": {
      "en": "The lobby fill time has no threshold in the plan and is not one of the sixteen gates: it is read to decide whether six seats are worth supporting at all. When a session runs long the plan shortens the voyage before it shortens the phases, because the phases are where the conversation lives, and the knob for that is the mode's own voyageLegs (twelve for Ocean Gambit, the tier's ladder for Classic) rather than a round count written beside this row.",
      "zh": "大厅凑人时间在计划里没有阈值，也不属于十六道门槛：读它是为了决定六席到底值不值得支持。一局拖长了，计划先缩短航程，再缩短阶段，因为阶段才是交谈所在的地方；那个旋钮是模式自己的 voyageLegs（暗潮十二段，经典为该档位的阶梯），不是写在这一行旁边的轮数。"
    },
    "residual.295": {
      "en": "Median hold utilization",
      "zh": "货舱利用率中位数"
    },
    "residual.296": {
      "en": "no leg report from a split hold",
      "zh": "没有来自分舱的航段报告"
    },
    "residual.297": {
      "en": "{ratePercent(centre)}, median of {fills.length}",
      "zh": "{ratePercent(centre)}，{fills.length}次记录的中位数"
    },
    "residual.298": {
      "en": "Marooned captains still standing at the close",
      "zh": "收官时仍站着的被放逐船长"
    },
    "residual.299": { "en": "no maroon in the window", "zh": "窗口内没有放逐" },
    "residual.300": {
      "en": "Captains bankrupt at the reveal",
      "zh": "揭晓时破产的船长"
    },
    "residual.301": {
      "en": "no chronicle row in the window",
      "zh": "窗口内没有实录条目"
    },
    "residual.302": { "en": "Parley participation", "zh": "洽谈参与度" },
    "residual.303": { "en": "The floor", "zh": "下限" },
    "residual.304": {
      "en": "No voyage in the window has a gate to read yet: utilization needs a leg report from a harbor playing the split hold, and participation needs a talk line that names the phase.",
      "zh": "窗口内的航程都还没有可读的门槛：利用率要有开了分舱的港湾交出的航段报告，参与度要有一条写明阶段的谈话记录。"
    },
    "residual.305": {
      "en": "Hold utilization is read off the leg reports, and only off those whose voyage was playing the split hold: a leg filed by a harbor with the split switched off carries no slots and is not in the sample. Its denominator is the ship's two capacities at their full size, because the quarter a hungry crew costs the cargo is not something the report carries, so a captain on short rations reads against the hold they would have had.",
      "zh": "货舱利用率从航段报告里读，而且只读开了分舱的航程：分舱关着的港湾登记的航段不带仓位，不进样本。分母取船只两项容量拉满时的规模，因为饥饿船员吃掉的那一舱报告里没有，所以吃减半口粮的船长，是拿他本应有的货舱来对照。"
    },
    "residual.306": {
      "en": "Parley participation cannot be read off the record's talk line either, because that line carries the leg and not the phase, and talk is open through every phase of a leg: the record cannot separate Parley from the rest of the round.",
      "zh": "洽谈参与度也没法从记录的谈话行里读，因为那一行带的是航段，不是阶段；一个航段里每个阶段都能说话，记录分不出洽谈和这一轮里其余的时间。"
    },
    "residual.307": {
      "en": "Retention is read over the voyages that closed with somebody standing, at the resolution the record has, which is presence at the close rather than the length of one connection.",
      "zh": "留存只在收官时还站着人的航程上读，精度取记录能达到的程度：看的是收官时在不在场，不是某一条连接撑了多久。"
    },
    "residual.308": {
      "en": "Session length at five captains, charted to reveal",
      "zh": "五人对局的时长，从开港到揭晓"
    },
    "residual.309": {
      "en": "no concluded voyage at five",
      "zh": "没有五席收官的航程"
    },
    "residual.310": {
      "en": "{whole} min, median of {minutes.length}",
      "zh": "{whole}分钟，{minutes.length}次记录的中位数"
    },
    "residual.311": {
      "en": "Lobby fill time by table size, charted to set sail",
      "zh": "按牌桌人数的大厅凑人时间，从开港到起航"
    },
    "residual.312": { "en": "no voyage in the window", "zh": "窗口内没有航程" },
    "residual.313": {
      "en": "{band.label} seats none in the window",
      "zh": "{band.label}席：窗口内没有"
    },
    "residual.314": {
      "en": "{band.label} seats {Math.round(band.centre)} min of {band.count}",
      "zh": "{band.label}席：{Math.round(band.centre)}分钟，{band.count}次"
    },
    "residual.315": {
      "en": "Voyages that stopped before the reveal",
      "zh": "在揭晓前停下的航程"
    },
    "residual.316": {
      "en": "Every gate this window can read sits inside it, {readable.length} of {gated.length}.",
      "zh": "窗口里可读的每一道门槛都在区间内，{readable.length}/{gated.length}。"
    },
    "residual.317": {
      "en": "{sharePercent(thinLegs, legReports.length)} over {legReports.length} captain legs",
      "zh": "{sharePercent(thinLegs, legReports.length)}，覆盖{legReports.length}个船长航段"
    },
    "residual.318": {
      "en": "${stopped.length} of ${records.length}, stopping at leg ${Math.round(centre)} on the median",
      "zh": "{stopped.length}/{records.length}，按中位数停在第{Math.round(centre)}航段"
    },
    "residual.319": {
      "en": "❌ Need ${debt.amount} Gold to repay ${debt.counterpartyName}, have ${state.money}",
      "zh": "❌ 还{debt.counterpartyName}{debt.amount}金币，手上只有{state.money}"
    },
    "residual.320": {
      "en": "🤝 Your bequest was paid out to ${redirectedToName}",
      "zh": "🤝 你留下的遗赠已付给{redirectedToName}"
    },
    "residual.321": {
      "en": "🛡️ Your backing fully covered a captain's shortfall: all ${calledAmount} Gold pledged was spent helping the lender.",
      "zh": "🛡️ 你的作保全额补上了一位船长的缺口：质押的{calledAmount}金币全部花在了替债主兜底上。"
    },
    "residual.322": {
      "en": "🛡️ ${backerName} covered ${amount} Gold of ${borrowerName}'s shortfall as a backer.",
      "zh": "🛡️ {backerName}作保，替{borrowerName}补上了缺口里的{amount}金币。"
    },
    "residual.323": {
      "en": "${rumorCooldownLine(left)} You spoke in leg ${spoke}, so the bazaar hears you again at leg ${next}.",
      "zh": "{rumorCooldownLine(left)}你是在第{spoke}航段开的口，所以香市要到第{next}航段才重新听你。"
    },
    "residual.324": {
      "en": "🧭 Boon Locked In: ${cardLead(card.id)}",
      "zh": "🧭 机缘已锁定：{cardLead(card.id)}"
    },
    "residual.325": {
      "en": "❌ ${cardName(card.id)} would put your hull at ${total} power, and a hull carries at most ${HELD_POWER_CAP}.",
      "zh": "❌ {cardName(card.id)}会让你的船体达到{total}点力量，而船体最多承载{HELD_POWER_CAP}点。"
    },
    "residual.326": {
      "en": "${CHARTER_MOMENT.icon} Your charter: ${cardLead(card.id)}",
      "zh": "{CHARTER_MOMENT.icon} 你的特许：{cardLead(card.id)}"
    },
    "residual.327": {
      "en": "${input.displayName} took the crown sailing ${waters} and came home with ${input.finalReputation} Reputation.",
      "zh": "{input.displayName}在{waters}中夺下王冠，带着{input.finalReputation}点声誉归来。"
    },
    "residual.328": {
      "en": "${input.displayName} was put ashore by a vote of the harbor and sailed ${waters} without a ship.",
      "zh": "港湾投票把{input.displayName}放逐上岸，此后无船在身，依然在{waters}中走完了航程。"
    },
    "residual.329": {
      "en": "${input.displayName} sailed ${waters}, went bankrupt, and finished the voyage.",
      "zh": "{input.displayName}在{waters}中跑了一程，中途破产，仍走完了航程。"
    },
    "residual.330": {
      "en": "${input.displayName} sailed ${waters} and came home with ${input.finalReputation} Reputation.",
      "zh": "{input.displayName}在{waters}中跑了一程，带着{input.finalReputation}点声誉归来。"
    },
    "residual.331": {
      "en": "Peak Reputation hit ${input.peakReputation}.",
      "zh": "巅峰声誉达到{input.peakReputation}。"
    },
    "residual.332": {
      "en": "The largest single trade paid ${input.largestTrade} Gold.",
      "zh": "最大的一笔单次交易进账{input.largestTrade}金币。"
    },
    "residual.333": {
      "en": "${input.displayName} lent once",
      "zh": "{input.displayName}借出过一次"
    },
    "residual.334": {
      "en": "${input.displayName} lent ${input.lendCount} times",
      "zh": "{input.displayName}借出过{input.lendCount}次"
    },
    "residual.335": {
      "en": "borrowed ${input.borrowCount} times",
      "zh": "借入过{input.borrowCount}次"
    },
    "residual.336": {
      "en": "The crown went home with ${input.displayName}.",
      "zh": "王冠跟着{input.displayName}回了家。"
    },
    "residual.337": {
      "en": "The harbor voted to put ${input.displayName} ashore, and the voyage went on without a ship under them.",
      "zh": "港湾投票把{input.displayName}放逐上岸，此后的航程，他们身下再没有船。"
    },
    "residual.338": {
      "en": "The voyage ended in bankruptcy before ${input.displayName} could finish.",
      "zh": "航程没等{input.displayName}走完，就先破产收场了。"
    },
    "residual.339": {
      "en": "The harbor closed the books at ${input.merchantRating}.",
      "zh": "港湾合上账本时，商人评级停在{input.merchantRating}。"
    },
    "residual.340": {
      "en": "🧭 You set aside the ${pathConfig(from)!.name} path and took up the ${pathConfig(to)!.name}. The harbor charges ${fee} Gold.",
      "zh": "🧭 你放下{pathConfig(from)!.name}之道，改走{pathConfig(to)!.name}。港湾收取{fee}金币。"
    },
    "residual.341": {
      "en": "Papers are changed at the port, in ${pathSwitchPortsList()}.",
      "zh": "换文书要回港办理，在{pathSwitchPortsList()}。"
    },
    "residual.342": {
      "en": "\\n📊=== Round ${state.currentRound} Settlement ===",
      "zh": "\\n📊=== 第{state.currentRound}轮 · 结算 ==="
    },
    "residual.343": {
      "en": "🔧 Maintenance: ${state.maintenanceCosts} Gold",
      "zh": "🔧 维护费：{state.maintenanceCosts}金币"
    },
    "residual.344": {
      "en": "\\n🔧=== Round ${state.currentRound} · Resolve: Ship Maintenance ===",
      "zh": "\\n🔧=== 第{state.currentRound}轮 · 结算：船只维护 ==="
    },
    "residual.345": {
      "en": "\\n🚢=== Round ${state.currentRound} · Dusk: Shipyard & Modules ===",
      "zh": "\\n🚢=== 第{state.currentRound}轮 · 暮色：船坞与模块 ==="
    },
    "residual.346": {
      "en": "🧾 Total Taxes Paid: ${state.vatPaid + state.incomeTaxPaid} Gold",
      "zh": "🧾 税费总计：{state.vatPaid + state.incomeTaxPaid}金币"
    },
    "residual.347": {
      "en": "${cardLead(\"farsight\")}: 'Word from ${port}: High demand for ${item}!' (free)",
      "zh": "{cardLead(\"farsight\")}：『{port}的消息：{item}正抢手！』（免费）"
    },
    "residual.348": {
      "en": "\\n⚓=== Round ${state.currentRound} · Market: Port Purchase ===",
      "zh": "\\n⚓=== 第{state.currentRound}轮 · 开市：港口采购 ==="
    },
    "residual.349": {
      "en": "🔧 ${name} leaves your hull for ${trade.buyerName ?? \"a captain\"}.",
      "zh": "🔧 {name}从你的船体上卸下，转给了{trade.buyerName ?? \"一位船长\"}。"
    },
    "residual.350": {
      "en": "🤝 Module trade: ${trade.buyerName ?? \"A captain\"} paid ${trade.fee} Gold for ${name}.",
      "zh": "🤝 模块交易：{trade.buyerName ?? \"有一位船长\"}花{trade.fee}金币买下了{name}。"
    },
    "residual.351": {
      "en": "${cardLead(\"fleet_of_treasures\")}: ${luxuryItems * 3}g off freight",
      "zh": "{cardLead(\"fleet_of_treasures\")}：运费减{luxuryItems * 3}金币"
    },
    "residual.352": {
      "en": "🚨 AUDIT! ${cardLead(\"tax_evasion\")} triggered. Lost 20 Gold!",
      "zh": "🚨 稽查！{cardLead(\"tax_evasion\")}触发。损失20金币！"
    },
    "residual.353": {
      "en": "📊 Completed ${state.orderCount} transactions",
      "zh": "📊 已完成{state.orderCount}笔交易"
    },
    "residual.354": {
      "en": "🤝 Broker's Favor called in: a buyer at ${order.demandPort} now wants ${txt}. The bigger the ask, the bigger the Broker's cut.",
      "zh": "🤝 掮客的人情已兑现：{order.demandPort}的一位买家现在要{txt}。要得越多，掮客的抽成越大。"
    },
    "residual.355": {
      "en": "🕵️ That broker was corrupt. The word is good, but your position leaked: raid risk is up ${Math.round(cfg.brokerCorruptionRisk * 100)} points this round.",
      "zh": "🕵️ 那个掮客通匪。消息是真的，但你的位置泄露了：本轮的劫掠风险上升{Math.round(cfg.brokerCorruptionRisk * 100)}点。"
    },
    "residual.356": {
      "en": "\\n🤝=== Round ${state.currentRound} · Orders: Trade Transaction ===",
      "zh": "\\n🤝=== 第{state.currentRound}轮 · 委托：贸易交易 ==="
    },
    "residual.357": {
      "en": "🛡️ Pirates closed on your hold and met ${cover.sellerName}'s guns. All ${raidGold} Gold saved, and the boarding party is theirs to answer for.",
      "zh": "🛡️ 海盗逼近货舱，撞上了{cover.sellerName}的炮口。{raidGold}金币分文未失，登船队由他们自己去应付。"
    },
    "residual.358": {
      "en": "🛡️ Pirates boarded and found the hold already bare. ${cover.sellerName}'s escort turned them away for nothing.",
      "zh": "🛡️ 海盗登船，发现货舱早已空空。{cover.sellerName}的护卫挡回了他们，却什么也没护着。"
    },
    "residual.359": {
      "en": "Ship Level ${state.shipLevel} discount",
      "zh": "船只等级{state.shipLevel}的折扣"
    },
    "residual.360": {
      "en": "${boonNameForModifierKey(\"hemp_price_reduction\")} (down ${hempReduction}g per unit)",
      "zh": "{boonNameForModifierKey(\"hemp_price_reduction\")}（每单位降{hempReduction}金币）"
    },
    "residual.361": {
      "en": "${cardName(\"kiln_cellar\")} module (down ${KILN_CELLAR_PER_UNIT}g per unit)",
      "zh": "{cardName(\"kiln_cellar\")}模块（每单位降{KILN_CELLAR_PER_UNIT}金币）"
    },
    "residual.362": {
      "en": "${cardName(\"smugglers_hold\")} module (down 15%)",
      "zh": "{cardName(\"smugglers_hold\")}模块（降价15%）"
    },
    "residual.363": {
      "en": "🪧 Standing orders at the shipyard: upgraded the hull to level ${state.shipLevel}.",
      "zh": "🪧 船坞的常备委托：把船体升到了{state.shipLevel}级。"
    },
    "residual.364": {
      "en": "❌ That is not something the crew can wear.",
      "zh": "❌ 这不是船员能穿在身上的东西。"
    },
    "residual.365": {
      "en": "❌ There is nobody aboard to wear it.",
      "zh": "❌ 船上没有人能穿它。"
    },
    "residual.366": {
      "en": "❌ The crew can wear no more than they already have on.",
      "zh": "❌ 船员身上能穿的，就这些了。"
    },
    "residual.367": {
      "en": "❌ No ${good} in the hold to wear.",
      "zh": "❌ 货舱里没有{good}可穿。"
    },
    "residual.368": {
      "en": "❌ The crew already meets this cold leg. Clothes put on for nothing still wear, so the rest stay in the hold until a leg asks for them.",
      "zh": "❌ 船员们已经扛得住这个寒冷航段了。白穿上的衣服照样会磨损，剩下的留在货舱里，等哪个航段真要了再拿出来。"
    },
    "residual.369": {
      "en": "❌ The sea is mild this leg and asks for no warmth. Clothes put on now would wear from today, so the hold keeps them for a cold leg.",
      "zh": "❌ 本航段海上温和，用不上暖意。现在穿上就要从今天开始磨损，所以货舱把它们留给寒冷航段。"
    },
    "residual.370": {
      "en": "🧥 The crew puts on the ${good}. Warmth ${spec.warmth} while it lasts.",
      "zh": "🧥 船员穿上了{good}。暖意{spec.warmth}，穿多久算多久。"
    },
    "residual.371": {
      "en": "🧵 The ${good} comes back to ${after} of ${spec.durability}, worth ${warmthText(garmentWarmth({ good, durability: after }))} of warmth.",
      "zh": "🧵 {good}的耐久回到{after}/{spec.durability}，折合{warmthText(garmentWarmth({ good, durability: after }))}暖意。"
    },
    "residual.372": {
      "en": "\\n🧥=== Round ${state.currentRound} · The Cold and the Cloth ===",
      "zh": "\\n🧥=== 第{state.currentRound}轮 · 严寒与衣着 ==="
    },
    "residual.373": {
      "en": "❄️ A cold leg, and the crew's ${warmthText(score)} of warmth falls short of the ${COLD_LEG_WARMTH} it asks.",
      "zh": "❄️ 寒冷航段，船员的{warmthText(score)}暖意不够它要的{COLD_LEG_WARMTH}。"
    },
    "residual.374": {
      "en": "🌊 The ${garment.good} wears through to rags and is scrapped for ${RAG_SCRAP_VALUE} Gold.",
      "zh": "🌊 {garment.good}磨成了碎布，拆掉换回{RAG_SCRAP_VALUE}金币。"
    },
    "residual.375": {
      "en": "🧵 Worn clothes lose ${step} point of wear to the sea.",
      "zh": "🧵 海风从穿着的衣服上耗去{step}点耐久。"
    },
    "residual.376": {
      "en": "🥶 There is nobody aboard to take the cold.",
      "zh": "🥶 船上没有人能承受这份严寒。"
    },
    "residual.377": {
      "en": "{gates.length - notInBand.length} of {gates.length} gates inside {gates.length - notInBand.length === 1 ? \"its band\" : \"their bands\"}",
      "zh": "{gates.length - notInBand.length}/{gates.length}道门槛在区间内"
    },
    "residual.378": {
      "en": "{failing.length} out of band",
      "zh": "{failing.length}项出界"
    },
    "residual.379": {
      "en": "{unmeasured.length} with no source",
      "zh": "{unmeasured.length}项无来源"
    },
    "residual.380": {
      "en": "{unplayed.length} with no voyage to read",
      "zh": "{unplayed.length}项无航程可读"
    },
    "residual.381": {
      "en": "{ungated.length} answering a reading with no threshold",
      "zh": "{ungated.length}项对应的读数没有阈值"
    },
    "residual.382": {
      "en": "the run stands at {voyages} of {LAUNCH_MINIMUM_VOYAGES} recorded voyages",
      "zh": "目前有{voyages}/{LAUNCH_MINIMUM_VOYAGES}程已记录航程"
    },
    "residual.383": {
      "en": "The run stands at {voyages} of {LAUNCH_MINIMUM_VOYAGES} recorded voyages, and a gate read over fewer than {LAUNCH_MINIMUM_VOYAGES} is a reading rather than evidence.",
      "zh": "目前只有{voyages}/{LAUNCH_MINIMUM_VOYAGES}程已记录航程，低于{LAUNCH_MINIMUM_VOYAGES}程读出的门槛只是读数，还不算证据。"
    },
    "residual.384": {
      "en": "the window was recorded at a sample rate of {samplePercent}%, so it is a sample of the run rather than the run",
      "zh": "窗口按{samplePercent}%的采样率记录，读到的是样本，不是全量"
    },
    "residual.385": {
      "en": "The window was recorded at a sample rate of {samplePercent}%, so these are readings of a sample of the run rather than of the run.",
      "zh": "这个窗口按{samplePercent}%的采样率记录，所以这些读数来自样本，不是全量。"
    },
    "residual.386": {
      "en": "{unmeasured.length} of the {gates.length} gates {unmeasured.length === 1 ? \"has\" : \"have\"} no source yet",
      "zh": "{gates.length}道门槛中有{unmeasured.length}道还没有来源"
    },
    "residual.387": {
      "en": "{unmeasured.length} of the {gates.length} gates {unmeasured.length === 1 ? \"has\" : \"have\"} no source: {names(unmeasured)}. {unmeasured.length === 1 ? \"It waits\" : \"They wait\"} on the systems that would produce them, and the plan does not ship a mode on the gates that happen to be measurable.",
      "zh": "{gates.length}道门槛中有{unmeasured.length}道还没有来源：{names(unmeasured)}。它们要等能产出数据的系统上线；计划不会靠碰巧可测量的那几道门槛来给一个模式放行。"
    },
    "residual.388": {
      "en": "{unplayed.length} of the {gates.length} gates {unplayed.length === 1 ? \"has\" : \"have\"} no voyage to read",
      "zh": "{gates.length}道门槛中有{unplayed.length}道没有航程可读"
    },
    "residual.389": {
      "en": "{unplayed.length} of the {gates.length} gates {unplayed.length === 1 ? \"has\" : \"have\"} no voyage to read: {names(unplayed)}.",
      "zh": "{gates.length}道门槛中有{unplayed.length}道没有航程可读：{names(unplayed)}。"
    },
    "residual.390": {
      "en": "the window holds {unreadable} {unreadable === 1 ? \"record\" : \"records\"} that could not be read",
      "zh": "窗口里有{unreadable}条记录读不出来"
    },
    "residual.391": {
      "en": "The window holds {unreadable} {unreadable === 1 ? \"record\" : \"records\"} that could not be read, so it is that much smaller than the run it was taken from.",
      "zh": "窗口里有{unreadable}条记录读不出来，比它抽自的那批数据就小了这么多。"
    },
    "residual.392": {
      "en": "the window holds {truncated} {truncated === 1 ? \"record\" : \"records\"} that hit the event cap",
      "zh": "窗口里有{truncated}条记录触及事件上限"
    },
    "residual.393": {
      "en": "The window holds {truncated} {truncated === 1 ? \"record\" : \"records\"} that hit the event cap, so some of what happened in those voyages was never kept and the gates read over them are floors rather than readings.",
      "zh": "窗口里有{truncated}条记录触及事件上限，这些航程里发生的事，有一部分没能留下；靠它们读出的门槛只是下限，不算读数。"
    },
    "residual.394": {
      "en": "{ungated.length} of the {gates.length} gates answer a reading the plan set no threshold on",
      "zh": "{gates.length}道门槛中有{ungated.length}道对应的读数计划没有设阈值"
    },
    "residual.395": {
      "en": "{ungated.length} of the {gates.length} gates answer readings the plan set no threshold on: {names(ungated)}. That is a contradiction in the page rather than a reading, and it is named here rather than passed over.",
      "zh": "{gates.length}道门槛中有{ungated.length}道对应的读数计划没有设阈值：{names(ungated)}。这是页面自身的矛盾，不是读数；就在这里点出来，不放过去。"
    },
    "residual.396": {
      "en": "{failing.length} {failing.length === 1 ? \"gate sits\" : \"gates sit\"} outside {failing.length === 1 ? \"its\" : \"their\"} band: {lines(failing)}.",
      "zh": "{failing.length}道门槛在区间之外：{lines(failing)}。"
    },
    "residual.397": {
      "en": "Clear to ship: all {total} gates sit inside their bands over {voyages} recorded voyages.",
      "zh": "可放行：全部{total}道门槛都在各自区间内，覆盖{voyages}程已记录航程。"
    },
    "residual.398": {
      "en": "Held by {failing.length} of {total} gates: {lines(failing)}.",
      "zh": "暂缓：{total}道门槛中有{failing.length}道未过：{lines(failing)}。"
    },
    "residual.399": {
      "en": "{head} {untradeable.line.label} is the plan's own priority and cannot be traded against the others.",
      "zh": "{head} {untradeable.line.label}是计划自己的优先级，不能拿去和其余门槛做交换。"
    },
    "residual.400": {
      "en": "No verdict yet: the reading leaves gates to read.",
      "zh": "尚无判定：这次读数还有门槛可读。"
    },
    "residual.401": {
      "en": "No verdict yet: {first.short}.",
      "zh": "尚无判定：{first.short}。"
    },
    "residual.402": {
      "en": "{gate.line.label}, {gate.line.value} against {gate.line.target}",
      "zh": "{gate.line.label}：{gate.line.value}，对照{gate.line.target}"
    },
    "residual.403": {
      "en": "Reach Renown Level ${topTitle.minLevel}.",
      "zh": "达到声望等级{topTitle.minLevel}。"
    },
    "residual.404": {
      "en": "Finish an ${openWaters.name} voyage without going bankrupt.",
      "zh": "完成一程{openWaters.name}航程，且没有破产。"
    },
    "residual.405": {
      "en": "\"${kept.id}\" is preserved and keeps ${keptLegs} legs while \"${turning.id}\" is perishable and keeps ${turningLegs}, so the tag and the keeping disagree.",
      "zh": "“{kept.id}”是耐储货，能存{keptLegs}个航段；而“{turning.id}”是易腐货，只存{turningLegs}个，标签和保鲜期对不上。"
    },
    "residual.406": {
      "en": "The harbor weighs anchor for the ${phaseFace(facts.phase).label}.",
      "zh": "港湾起锚，进入{phaseFace(facts.phase).label}。"
    },
    "residual.407": {
      "en": "${facts.captain}'s offer of ${facts.offerAmount} ${facts.offerItem} lapses with the leg.",
      "zh": "本航段一结束，{facts.captain}挂出的{facts.offerAmount}份{facts.offerItem}报价就作废了。"
    },
    "residual.408": {
      "en": "The tide runs out on the ${phaseFace(facts.phase).label}.",
      "zh": "潮水在{phaseFace(facts.phase).label}退去。"
    },
    "residual.409": {
      "en": "${facts.captain} takes up the ${pathConfig(facts.path)!.name} path.",
      "zh": "{facts.captain}走上了{pathConfig(facts.path)!.name}之道。"
    },
    "residual.410": {
      "en": "${facts.captain} sets aside their old papers and takes up the ${pathConfig(facts.path)!.name} path.",
      "zh": "{facts.captain}收起旧文书，改走{pathConfig(facts.path)!.name}之道。"
    },
    "residual.411": {
      "en": "${facts.captain} offers ${cardName(facts.module)} for ${facts.fee} Gold.",
      "zh": "{facts.captain}挂出{cardName(facts.module)}，要价{facts.fee}金币。"
    },
    "residual.412": {
      "en": "${facts.taker} buys ${cardName(facts.module)} from ${facts.captain} for ${facts.fee} Gold.",
      "zh": "{facts.taker}以{facts.fee}金币从{facts.captain}手上买下{cardName(facts.module)}。"
    },
    "residual.413": {
      "en": "${readyCount} of ${requiredCount} captains ${readyCount === 1 ? \"has\" : \"have\"} readied.",
      "zh": "{requiredCount}位船长里已有{readyCount}位就绪。"
    },
    "residual.414": {
      "en": "{account} is already banned.",
      "zh": "{account}已经封停了。"
    },
    "residual.415": {
      "en": "{account} is not banned.",
      "zh": "{account}没有封停。"
    },
    "residual.416": {
      "en": "{account} is already an administrator.",
      "zh": "{account}已经是管理员。"
    },
    "residual.417": {
      "en": "{account} is banned. Unban the account first.",
      "zh": "{account}已经封停了。先解封该账户。"
    },
    "residual.418": {
      "en": "{account} is not an administrator.",
      "zh": "{account}不是管理员。"
    },
    "residual.419": {
      "en": "The audit opens from leg ${gate.opensAt}.",
      "zh": "稽查从第{gate.opensAt}航段起开放。"
    },
    "residual.420": {
      "en": "${f.user.displayName} reached Renown Level ${rows.outcome.newLevel}: ${renownTitleForLevel(rows.outcome.newLevel)}!",
      "zh": "{f.user.displayName}达到了声望等级{rows.outcome.newLevel}：{renownTitleForLevel(rows.outcome.newLevel)}！"
    },
    "residual.421": {
      "en": "${f.user.displayName} earned the Captain's Merit: ${merit.name}!",
      "zh": "{f.user.displayName}赢得了船长功勋：{merit.name}！"
    },
    "residual.422": {
      "en": "The maroon vote opens from leg ${facts.maroonFrom}.",
      "zh": "放逐投票从第{facts.maroonFrom}航段起开放。"
    },
    "residual.423": {
      "en": "The Harbormaster's hand is not dealt before leg ${facts.maroonFrom}.",
      "zh": "第{facts.maroonFrom}航段之前，港务长之权还不发放。"
    },
    "residual.424": {
      "en": "${displayName}'s voyage has ended",
      "zh": "{displayName}的航程已经结束"
    },
    "residual.425": {
      "en": "You already have an offer standing for ${buyerName}.",
      "zh": "你已经为{buyerName}挂着一份报价了。"
    },
    "residual.426": {
      "en": "${s.user.displayName} has gone ashore",
      "zh": "{s.user.displayName}上岸了"
    },
    "residual.427": {
      "en": "Word on the Docks: ${s.user.displayName} was first to complete ${WORD_ON_THE_DOCKS_THRESHOLD} trade orders this voyage, and pockets ${WORD_ON_THE_DOCKS_REWARD} Gold for it.",
      "zh": "码头风闻：{s.user.displayName}在本航程率先完成了{WORD_ON_THE_DOCKS_THRESHOLD}笔委托，把这{WORD_ON_THE_DOCKS_REWARD}金币装进了口袋。"
    },
    "residual.428": {
      "en": "${s.user.displayName} set sail for another port",
      "zh": "{s.user.displayName}起航去了另一个港口"
    },
    "residual.429": {
      "en": "${s.user.displayName} entered the harbor",
      "zh": "{s.user.displayName}进了港湾"
    },
    "residual.430": {
      "en": "Deadline must be between round ${minRound} and round ${maxRound}.",
      "zh": "截止轮次得在第{minRound}轮到第{maxRound}轮之间。"
    },
    "residual.431": {
      "en": "${input.displayName} sailed ${waters} and ran out of Gold before the voyage was done.",
      "zh": "{input.displayName}在{waters}中跑了一程，中途金币耗尽，没能走完航程。"
    }
  }
}
```

The card records keep their inline strings, exactly as the plan describes, and a small check holds every card's zh equal to this file and every entry to having both languages. That is J3's eval gate made mechanical.

## What I'd like your eye on

The rest of the tables can stand or fall row by row. What follows is the standing agenda, kept current as each panel lands. The sole reference throughout is the v1.4.0 Mandarin edition.

**This round.** A second terminology panel went over the pool: twenty units, five specialist lenses per unit, one moderator per unit, every proposal sent to a three-vote referendum (171 votes across 57 proposals), one chief editor, 292 agents in all. It moved 44 values into the mapping and held one family back for a single ruling from you. No lock lifted; where the locks disagree with the edition, the disagreement is registered below.

**The register ruling is the decision that unblocks the most.** Four anchors were challenged, each carried unanimously on the edition's evidence, and none was applied, because they all come down to one question: how much ship era flavor the harbor keeps against the edition's plainer words.

1. **Trade order: 委托 or 订单.** The mapping holds 委托; the challenge carried it to 订单, the word the edition uses (zh.js:178, 422) and the word the tree ships today. Riding on the ruling: the Orders phase chip, the locked order term (专属委托 would follow to 专属订单), both Ocean Gambit texts, the founding voyage summary, the deliver button (the panel carried 交付贸易订单 two of three, the recorded dissent preferring 完成贸易订单), and about fifty sentence leaves that still read 委托. Whichever way you rule, one mechanical sweep finishes the family.
2. **The tax: 市舶税 or 增值税.** The mapping holds 市舶税, the 市舶司 duty; the challenge carried it to 增值税, the edition's word (zh.js:125, 235, 344) and the tree's. Riding: the paid-tax stat and nine sentence leaves.
3. **Wages: 工钱 or 工资.** The mapping holds 工钱; the challenge carried it to 工资, the edition's word throughout (zh.js:120, 204, 587-589). Riding: the worker wages stat, the Jade Pavilion perk (carried unanimously), the Golden Lotus perk (carried two of three, one voter amending to 工资降低20%，但海盗劫掠多出5%), and about thirty-five sentence leaves.
4. **The broker: 掮客 or 牙行.** The mapping holds 掮客; the challenge carried it to 牙行, the edition's word (zh.js:133, 215-217, 506-511), including the very card name the edition ships, 牙行网络. Riding: the network card's name and the two descs, which the panel rewrote in the edition's own 密语 phrasing (密语花费2金币，每次购买揭示2条。), and about forty-five sentence leaves.

镖行, the Convoy word, keeps its place beside these four, unchallenged by either panel.

**What the round applied.** Nothing below needs a ruling; it is the record.

- **Modules**: 模组 becomes 模块 everywhere: the phase chip reads 抽取模块, the swap chip 切换模块, the swap short label 切换, and the buttons follow. The slot word itself is still an open question, below.
- **Draft**: unified at 抽取 on every surface (抽取你的商道, 抽取并安装模块).
- **Market**: 采购 in the phase chip, 港口采购 on the button, 本轮不再采购 on the skip action. The skip vote carried two of three, one voter preferring 跳过本轮采购; the edition has no such button, only a notification (zh.js:244), so the picked wording stands with the dissent on the record.
- **Goods**: Hemp reads 麻布, Silk 丝绸 (the edition's own item word, zh.js:13), Linen Clothes 麻衣, Cotton Clothes 布衣.
- **Crew**: the weaver reads 织女 (the edition's roster word, zh.js:35-39, 405, 662) and the hire button follows (雇佣织女); the master reads 纺织大师; the sachet maker reads 香囊师.
- **Ratings**: 丝绸之路霸主, 海上贸易大亨, 成功商人.
- **Card names, nine**: 避税账本, 免税令, 顺风顺水, 紧急钱庄, 学徒传承, 走私暗舱, 工匠工坊, 打捞起重机, 散货索具.
- **The bulk web**: 大宗 becomes 散货 wherever the tag renders (the goods table, the hauler's name 散货索具, the two card descs that price it). The Bulk Charter keeps 大宗特许; the two names no panel has voted (大宗垄断 and the weaver's 织工特许) keep theirs too, with 散货垄断 and the weaver name following the roster word as the flagged alternatives. If you want one word across the family, the names are the piece left to move.
- **The overdrive desc**: the proposal was rejected three to nothing, but all three dissents converged on the edition's own sentence (zh.js:144-145, whose numbers match the card exactly), so the amendment carried: 运费降低5金币。维护费增加10金币。
- **Small strings**: 口粮单价 for the ration price, 荣登 for the first crown, a semicolon to a full stop in the Aroma signature, 报酬 in the mandate line, 每航程 and 40% in the free captain's signature, tightened percentages in the salvage, factor and weaver descs, and a stray space removed from the hull line's durability readout.

**Still standing from the first panel**, re-registered with this round's notes:

1. **Produce reads 时鲜, not 蔬果** (one voice of four). Every sentence that uses it sits in the preserve chain, where 时鲜腌成咸鱼 reads clean and 蔬果腌成咸鱼 does not. The second panel reopened the word, split three ways, and did not overturn the pick; the edition's nearest line is its market prose (zh.js:640), so the word stays on the agenda.
2. **The Aroma signature prices with 价钱, not 价带** (two of five). 价带 was a one-off coinage; every other rumor string prices with 价钱. Unchanged this round.
3. **The Golden Lotus motto becomes 敢下注，好运自来。** (two of five, on a three-way split). The 3+4 rhythm answers 朱门开，百货运。 The register is flagged: the edition's tips and tutorial stay plain and concrete (zh.js:614-695), so the motto's bold voice exceeds the house register. Your call.
4. **Stores reads 存粮, not 库存** (two of five), the term and the label moving together. The edition writes 库存 (zh.js:173, 390), and the two Inventory lines keep 库存 either way; reverting both keys is one edit.
5. **The Bulk Charter reads 大宗特许, not 大宗契** (two of four, the tie broken). Now folded into the bulk web note above.

**Alignment questions still open:**

1. **The module slot reads two ways**: 模块位 in the empty-hull lines, the swap button, and the slot labels (2202, 2207, 2302, 2304, 2305 and their JSON twins) against 模块仓位 everywhere else; the edition says 槽位 (zh.js:220, 224, 301, 456-460, 558). Say which of the three the family should hold.
2. **席位 pulls double duty**: the hull line (884) uses 席位 for a module's place aboard while term.seat holds 席位 as its own term. Say if one should move.
3. **The sealed family reads two ways**: the badge is 封锁 (2636) while the tag is 封验 (261). Say if they should read as one.
4. **货架 stands in for the market** in the two long difficulty blurbs (97, 100). Say if the market wants one of the pool's own words.
5. **Broker's Rumor and Broker's Whisper** read as one system under two names today (270, 271). The panel's edition-verbatim texts phrase the purchase as 密语 (密语花费2金币，每次购买揭示2条。); the edition collapses both names into 密语 (zh.js:215-217, 367, 506-511). If the register ruling moves the family to 牙行, the pair would read 牙行传闻 for the thing you buy and 牙行密语 for the system.

**Registered against the locked leaves.** Your rulings stand; noted so nothing surprises later.

- **机缘 vs 福缘**: the edition's boon mechanic reads 福缘 (zh.js:156-159, 361-362); you ruled 差别不大，可以不改 on 2026-10-09, so term.boon stays 机缘, and this is a registration, not a proposal.
- **The locked difficulty texts count rounds in 八轮** where the edition counts 航程 (zh.js:537), and their harbor lines write 港湾 where the edition writes 港口 throughout (zh.js:242, 640); the mapping's own unit and the landmark table already hold 航程 and 港口.
- **The locked difficulty texts price with 掮客** where the edition's broker is 牙行 (zh.js:133, 215-217); if the term moves, the locks will disagree with the term leaf until they lift.
- **good.brocade keeps 绫罗绸缎**, which is the edition's own word for the brocade item (zh.js:17). No clash; registered for completeness.

**Carried from the earlier list, still true:**

- **商道** for a captain's path (the tree says 路径), **暗潮** for the Gambit (coined alternatives read constructed), **金荷** for Golden Lotus (avoiding the 潘金莲 shadow): all unchallenged by both panels.
- **One name, two uses: 香市.** The Aroma path and the bazaar share the name by design; the path's alternate was 风声. Say if you want them split.
- **Four rows left the pool.** They translated dashboard comments, not strings: nobody sailed at six and three of its neighbors. Comments do not reach a captain, so they are gone rather than kept idle.
- **Grammar English spends, Chinese does not.** Plural ternaries collapse into one Chinese form, and where the engine joins lists with ", " or " and ", the Chinese needs its own joiner (、 and 与): a wiring change, not a table change.
- **New console vocabulary.** The operator console settles as 操作员控制台, with 名册 for the roster, 封停 and 解封 for suspend and lift, 平衡总览 for the balance dashboard, and 门槛, 区间, 读数, 判定, 放行 and 暂缓 for the gates instrument's talk.
- **What deliberately has no Chinese.** 452 swept strings were judged no translate on the way in: code tokens, socket event names, developer diagnostics, and the card validator's messages, none of which a captain ever sees.
- **Spacing.** The mapping's card values take the tight hand ({cost}金币, 2麻布, {rounds}轮), matching the edition; the card records already in the tree keep their spaced money (4 金币) until the wiring, and the tutorial pages keep theirs until the lift.
- **Crew names.** All 67 transliterated above. Say if any should switch to Chinese names instead.
- **At lift, the tree takes eighteen card names** in one pass: the five the pool already moves (生意经, 关津减税, 商道精通, 掮客人脉, 管事), the first panel's four (船队旗帜, 织物垄断, 大宗特许, 常备护航), and this round's nine above, with 掮客人脉 reading 牙行网络 if the broker ruling carries. The wiring itself (the whole sentence surface, the joiners, the spacing realignment) is the remaining lift work.
