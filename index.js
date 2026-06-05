import { Client, EmbedBuilder, GatewayIntentBits } from "discord.js";
import schedule from "node-schedule";
import { config } from "dotenv";
import { HttpsProxyAgent } from "https-proxy-agent";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import { MongoClient } from "mongodb";

config();

// ─────────────────────────────────────────────
//  Proxy (REST + WebSocket) — как раньше
// ─────────────────────────────────────────────
const proxyUrl = process.env.DISCORD_PROXY_URL;
let wsProxyAgent = null;

if (proxyUrl) {
  console.log("[BOT] Using Discord proxy:", proxyUrl);
  const restProxy = new ProxyAgent(proxyUrl);
  setGlobalDispatcher(restProxy);
  wsProxyAgent = new HttpsProxyAgent(proxyUrl);
}

// ─────────────────────────────────────────────
//  MongoDB — общая БД с сайтом rns-site
//  Сайт пишет в коллекцию clan_ad_posts (см. backend ClanAdPost),
//  бот читает одобренные посты и публикует их по расписанию.
// ─────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "";
const MONGO_DB = process.env.MONGO_DB || "ticketBotDB";
const AD_COLLECTION = "clan_ad_posts";

let mongoClient = null;
let adCollection = null;

async function initMongo() {
  if (!MONGO_URI) {
    console.warn("[BOT] MONGO_URI не задан — динамические посты кланов отключены");
    return;
  }
  try {
    mongoClient = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await mongoClient.connect();
    adCollection = mongoClient.db(MONGO_DB).collection(AD_COLLECTION);
    console.log(`[BOT] MongoDB подключена (db=${MONGO_DB}, collection=${AD_COLLECTION})`);
  } catch (e) {
    console.error("[BOT] Ошибка подключения к MongoDB:", e.message);
    mongoClient = null;
    adCollection = null;
  }
}

// ─────────────────────────────────────────────
//  Канонический JSON -> payload для channel.send()
//  (зеркало backend/src/services/discordAdPayload.js → buildDiscordPayload)
// ─────────────────────────────────────────────
const BUTTONS_PER_ROW = 5;

function buildDiscordPayload(canonical) {
  if (!canonical || typeof canonical !== "object") return null;
  const msg = {};

  if (canonical.content) msg.content = canonical.content;
  if (canonical.imageUrl) msg.files = [canonical.imageUrl];

  if (Array.isArray(canonical.embeds) && canonical.embeds.length) {
    msg.embeds = canonical.embeds.map((e) => {
      const out = {};
      if (e.title) out.title = e.title;
      if (e.description) out.description = e.description;
      if (e.url) out.url = e.url;
      if (typeof e.color === "number") out.color = e.color;
      if (e.timestamp) out.timestamp = e.timestamp;
      if (e.author) {
        out.author = { name: e.author.name };
        if (e.author.url) out.author.url = e.author.url;
        if (e.author.iconUrl) out.author.icon_url = e.author.iconUrl;
      }
      if (e.thumbnailUrl) out.thumbnail = { url: e.thumbnailUrl };
      if (e.imageUrl) out.image = { url: e.imageUrl };
      if (e.footer) {
        out.footer = { text: e.footer.text };
        if (e.footer.iconUrl) out.footer.icon_url = e.footer.iconUrl;
      }
      if (Array.isArray(e.fields) && e.fields.length) {
        out.fields = e.fields.map((f) => ({
          name: f.name,
          value: f.value,
          inline: !!f.inline,
        }));
      }
      return out;
    });
  }

  if (Array.isArray(canonical.buttons) && canonical.buttons.length) {
    const rows = [];
    for (let i = 0; i < canonical.buttons.length; i += BUTTONS_PER_ROW) {
      const chunk = canonical.buttons.slice(i, i + BUTTONS_PER_ROW);
      rows.push({
        type: 1,
        components: chunk.map((b) => ({ type: 2, style: 5, label: b.label, url: b.url })),
      });
    }
    msg.components = rows;
  }

  if (!msg.content && !msg.embeds && !msg.components && !msg.files) return null;
  return msg;
}

// ─────────────────────────────────────────────
//  Текущий час по Москве (0..23)
// ─────────────────────────────────────────────
function moscowHour() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  let h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  if (h === 24) h = 0;
  return h;
}

// ─────────────────────────────────────────────
//  Логин одним клиентом, выполнить fn(client, channel), отключиться
// ─────────────────────────────────────────────
function withClient(fn) {
  return new Promise((resolve) => {
    const client = new Client({
      intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
      ...(wsProxyAgent ? { ws: { agent: wsProxyAgent } } : {}),
    });

    client.once("ready", async () => {
      try {
        console.log(`Logged in as ${client.user.tag}!`);
        const channel = await client.channels.fetch(process.env.CHANNEL_ID);
        if (!channel) {
          console.error("Канал не найден.");
        } else {
          await fn(client, channel);
        }
      } catch (e) {
        console.error("[SEND] Ошибка:", e);
      } finally {
        client.destroy();
        resolve();
      }
    });

    client.on("error", (err) => console.error("[CLIENT ERROR]", err));
    client.on("shardError", (err) => console.error("[SHARD ERROR]", err));
    client.login(process.env.DISCORD_TOKEN);
  });
}

// Отправить одно (legacy) сообщение
async function sendMessage(payload) {
  await withClient(async (client, channel) => {
    const resolved = typeof payload === "function" ? payload() : payload;
    await channel.send(resolved);
  });
}

// ─────────────────────────────────────────────
//  Динамические посты кланов: публикуем все одобренные на текущий час
// ─────────────────────────────────────────────
async function sendDuePosts() {
  if (!adCollection) return;
  const hour = moscowHour();

  let docs = [];
  try {
    docs = await adCollection
      .find({
        enabled: true,
        status: "approved",
        scheduleHour: hour,
        livePayload: { $ne: null },
      })
      .toArray();
  } catch (e) {
    console.error("[BOT] Ошибка чтения постов из Mongo:", e.message);
    return;
  }

  if (!docs.length) {
    console.log(`[BOT] ${String(hour).padStart(2, "0")}:00 — постов кланов нет`);
    return;
  }

  console.log(`[BOT] ${String(hour).padStart(2, "0")}:00 — публикуем ${docs.length} пост(ов)`);

  await withClient(async (client, channel) => {
    for (const doc of docs) {
      const payload = buildDiscordPayload(doc.livePayload);
      if (!payload) {
        console.warn(`[BOT] Пост [${doc.clanTag}] пустой — пропуск`);
        continue;
      }
      try {
        await channel.send(payload);
        await adCollection.updateOne(
          { _id: doc._id },
          { $set: { lastPostedAt: new Date() } },
        );
        console.log(`[BOT] Опубликован пост клана [${doc.clanTag}]`);
      } catch (e) {
        console.error(`[BOT] Ошибка публикации [${doc.clanTag}]:`, e.message);
      }
    }
  });
}

// ═════════════════════════════════════════════
//  LEGACY: статические посты (можно отключить LEGACY_POSTS=false)
// ═════════════════════════════════════════════
const LEGACY_POSTS = process.env.LEGACY_POSTS !== "false";

const message1 = `**[UDT](https://discord.gg/SmNbEh5k7H)**— клан по Squad для игроков, которые ценят результат и понимают ценность командной игры.

**Для нас важно:**
> Личный скилл: стрельба, позиционка, понимание механик и умение принимать решения.
> Но по-настоящему побеждает тот, кто умеет применять свои навыки в составе слаженной команды.

Мы играем сквадами, тренируемся, разбираем бои и помогаем друг другу расти.
В UDT учат не только командному взаимодействию, но и индивидуальной игре — от базовых ошибок до продвинутых решений в бою.

- Без пафоса и токсичности.
- Адекватность, дисциплина и желание развиваться — основа клана.
- Если ты хочешь играть умно, стабильно и на победу — UDT ждёт тебя.

**Требования для вступления:**
> Часы в игре: не принципиальны — важнее понимание игры и базовых механик.
> Желание развиваться в соревновательном направлении.
> Адекватность и коммуникабельность.
> Возраст 18+ (возможны исключения — не бойся подавать заявку, если ты моложе).`;

const message2 = `**[GRAVE] – Gloriam Reddimus Antiquis Virtutibus Eterno «Мы вечно возвращаем древним добродетелям их славу»**

Наш клан основан ветеранами SQUAD, цель которых передавать имеющийся опыт новичкам и не только. Сообщество GRAVE регулярно участвует в ивентах различной сложности: битвы серверов, CW, OCBT.
Мы приветствуем игроков всех возрастов начиная с 18 лет.
Дорожная карта клана состоит в достижении баланса комфортной игры на паблике и отработки тактических маневров для ивентов.

**Успешное рассмотрение вашей заявки на вступление зависит от исполнения следующих пунктов:**

—  Ваш возраст равен 18 или более лет (возможны исключения);
—  Вы любите командую игру. Количество часов 300+
—  Трезво оцениваете свои действия и воспринимаете критику;
—  Готовы развиваться и совершенствовать свои навыки.

Активные игроки нашего сообщества поощряются выдачей бесплатного VIP статуса на серверах РНС.

**Основной 'прайм тайм' клана с 19:00 до 24:00 по МСК.**

https://discord.gg/ApmVQBbYKA
https://cdn.discordapp.com/attachments/1298365415801749536/1317827985214148658/image.png?ex=67601a73&is=675ec8f3&hm=9ed2b08cf95bf494c48b07d016dae2c684db81f9891189f0f9d423499fbc0d2c&`;

const message3 = `**📌 『MD』** - это проявление уважения к командной работе, активное участие в различных турнирах и мероприятиях. В рамках данного подхода осуществляется коллективный анализ допущенных ошибок, что способствует созданию условий для профессионального роста каждого участника и позволяет каждому участнику найти свое место в команде.

**📝Требования к кандидатам:**

> 💡Возраст: от 18 лет( допускаются исключения).
> •Устойчивость к стрессу и умение сохранять спокойствие в сложных ситуациях.
> ⏳Игровой стаж: от 200 часов в игре ( допускаются исключения).
> •Знание основ и принципов игры Squad.
> •Наличие микрофона для обеспечения эффективного командного взаимодействия.

**📝Взамен предлагаем:**

> •Предоставление статуса VIP для игроков с высокой активностью;
> •Обеспечение уникального игрового опыта;
> •Предоставление широкого спектра игровых направлений.
> •Участие в турнирах и иных мероприятиях.

https://discord.gg/morskiedyavolymd`;

const message4 = {
  embeds: [
    new EmbedBuilder()
      .setColor(16711680)
      .setDescription(
        `### *IMPERA Corp — играет чтобы побеждать.*

**IMPERA ищет тех, кто понимает разницу между "просто поиграть" и "сыграть хорошо".**

*1. Проигрыши разбираем.
2. Ошибки называем вслух.
3. Обид не держим, держим планку.
4. Злимся — и идём дальше.*

*Нам **не всё равно** на поражения. Это чувствуется — **в разборе раунда**, или **в голосовом чате** после проигрыша.
Мы **стремимся побеждать**, **участвуем в турнирах**, и требуем от себя и друг друга **реальной отдачи** на поле боя.*

**Тренируемся на личном сервере** — и не просто тренируемся, а **разбираем ошибки** и **растём дальше**.

За пределами матча у нас **живые люди**. **Бункер**, **Gartic**, **Jackbox**, **личные встречи**, и своя **атмосфера** которую сложно описать но легко почувствовать.

Возраст **18+** с возможными исключениями, **микрофон**, **адекватность** — **это минимум**.
**Желание расти** и быть **частью команды** — **это главное**.

**Прайм-тайм: 19:00 – 00:00 МСК.**`,
      )
      .setThumbnail(
        "https://cdn.discordapp.com/banners/1309968102397710437/a_645f81666f890a5ccbd65eb857bb8e61.gif?size=1024&animated=true",
      )
      .setFooter({
        text: "Активным — VIP статус на серверах РНС.\nИграем на серверах РНС (No. 2).",
      }),
  ],

  components: [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 5,
          label: "Вступить в IMPERA",
          url: "https://discord.gg/ys5cPmW7hy",
        },
      ],
    },
  ],
};

const message5 = `***Искал опытный коллектив, где ценится командная игра и развитие?***
***[OCO] Отряд Специальных Операций ведет набор бойцов***

**Мы предлагаем:**
> **<a:PepeShirtGachi:1206609463684112475>  Опытный инструкторский состав для новеньких в игре**
> **<:emoji_185:1222840863294492713>  Сплоченный коллектив для тех, кто искал командную игру**
> **<a:emoji_38:1113584256749412404>  Регулярные тренировки для желающих развиваться**
> **<:V88_apexm_pepegun:965119984902762536>  Еженедельные скримы для тех, кто компот**
> **<:emoji_52:1113586275346305064>  Участие в турнирах и других соревновательных событиях для самых амбициозных**

**Внутри клана мы:**
> **🎮Играем во множество других игр помимо Squad**
> **🎬Смотрим фильмы**
> **🏆Проводим конкурсы с вкусными призовыми**

**Требования к кандидату:**
> **👶 18+ (есть исключения, решение принимается старшим составом)**
> **🤬 Адекватное поведение**
> **😴 Регулярная активность в прайм-тайм (18:00-00:00 по МСК)**
> **🤓 Знание базовых принципов игры в Squad**

https://discord.gg/oco-team`;

const message6 = `Приветствую, мы **Team North**

За годы компета, из небольшого коллектива мы стали сплоченной командой, где опыт ветеранов и рвение молодых стали ключом к победе. Наш путь начался с участия в [ISST](https://play.toornament.com/en_US/tournaments/1780292832328425472/matches/) в 2018 году, с тех пор состав команды полностью менялся, и не раз, но наши стремления оставались прежними. Через победы и неудачи, поколение за поколением, мы не переставали быть сообществом людей, которые любят соревнования.

Наш девиз: **«Билет в компет»**. Мы принимаем игроков любого уровня, воспитывая таланты со всего мира, главное, чтоб они умели говорить по-русски и соблюдали наш устав.

Мы ценим тех, кто стремится к командной игре, учится на ошибках и адаптируется несмотря на трудности.

**Твой билет в компет -** https://discord.gg/teamnorth | https://teamnorth.ru/`;

const message7 = `# Ищешь новые вызовы и возможности для саморазвития?
# Хочешь стать частью команды, где каждый день приносит новые приключения?
## [Тогда **PMC LEGION GROUP** — это именно то, что тебе нужно\!](https://discord.gg/GArkfrSqcp)

> * \`[XX Legion Group Joint Battalion] [20LGJB]\`
> Один из батальонов в **PMC LEGION GROUP**, **состоящий из 4-х рот**.
> Наша единица известна своим профессионализмом, силой и способностью справляться с самыми сложными задачами.
> Вместе мы обеспечиваем безопасность и защиту наших клиентов по всему миру.

[**Хочешь стать элитным бойцом и принимать участие в операциях специального назначения?**](https://discord.gg/GArkfrSqcp)
> * \`[XI Special Operations Company] [11SOC]\` — **ждем тебя здесь**.
> У нас ты получишь обучение по самым передовым тактикам и технологиям, чтобы стать непревзойденным воином на поле боя.

[**Может быть тебя привлекает сила и мощь техники?**](https://discord.gg/GArkfrSqcp)
> * \`[IX Heavy Combined Arms Company] [9HCAC]\` — **твой выбор**.
> У нас ты сможешь управлять танками, боевыми машинами пехоты и другими мощными средствами вооружения словно бог-войны.
> Ты станешь непоколебимым столпом на поле боя.

[**Любишь боевую пехоту?**](https://discord.gg/GArkfrSqcp)
> * \`[VI Armored Infantry Company] [6AIC]\` — **идеальное место для тебя**.
> Мы специализируемся на операциях совместно с бронетехникой, обеспечивая максимальную мобильность и огневую мощь наших отрядов.

[**А может быть ты мечтаешь о полетах на вертолетах и операциях в тылу противника?**](https://discord.gg/GArkfrSqcp)
> * \`[IV Joint Airborne Company] [4JAC]\` — **твой путь**.
> Мы готовы отправить тебя в самые опасные и сложные места, где ты сможешь проявить свою храбрость и профессионализм.`;

const message8 = {
  embeds: [
    new EmbedBuilder()
      .setTitle(
        "ION Corporation приглашает новых игроков в организованный клан по Squad.",
      )
      .setDescription(
        "### 🤝 Что у нас есть?\n" +
          "⚡️ регулярные совместные игры\n" +
          "⚡️ тренировки и отработка командных действий\n" +
          "⚡️ дружный и спокойный коллектив\n" +
          "⚡️ помощь новичкам и развитие игроков\n" +
          "⚡️ турнирное участие\n" +
          "⚡️ VIP - статус на серверах для активных участников",
      )
      .setColor(15857400)
      .setThumbnail(
        "https://i.postimg.cc/prjp0vFG/file-00000000385c72468418cfbf7c739a98.png",
      ),

    new EmbedBuilder()
      .setDescription(
        "### 🎯 Кого мы ищем:\n" +
          "⚡️ игроков, которые хотят играть в команде\n" +
          "⚡️ людей с микрофоном 🎤\n" +
          "⚡️ адекватных и спокойных участников\n" +
          "⚡️ тех, кто умеет слушать и общаться\n\n" +
          "**🚀 Набор ограничен! Если ты хочешь стать частью команды — не откладывай вступление.**",
      )
      .setColor(1127135),
  ],

  components: [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 5,
          label: "Discord сервер",
          url: "https://discord.gg/ioncorporation",
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────
//  Запуск
// ─────────────────────────────────────────────
await initMongo();

if (LEGACY_POSTS) {
  schedule.scheduleJob({ rule: "0 12 * * *", tz: "Europe/Moscow" }, () => sendMessage(message1));
  schedule.scheduleJob({ rule: "0 19 * * *", tz: "Europe/Moscow" }, () => sendMessage(message3));
  schedule.scheduleJob({ rule: "0 17 * * *", tz: "Europe/Moscow" }, () => sendMessage(message2));
  schedule.scheduleJob({ rule: "0 13 * * *", tz: "Europe/Moscow" }, () => sendMessage(message4));
  schedule.scheduleJob({ rule: "0 1 * * *", tz: "Europe/Moscow" }, () => sendMessage(message5));
  schedule.scheduleJob({ rule: "0 18 * * *", tz: "Europe/Moscow" }, () => sendMessage(message6));
  schedule.scheduleJob({ rule: "0 20 * * *", tz: "Europe/Moscow" }, () => sendMessage(message7));
  schedule.scheduleJob({ rule: "0 16 * * *", tz: "Europe/Moscow" }, () => sendMessage(message8));
  console.log("[BOT] Legacy-расписание включено.");
} else {
  console.log("[BOT] Legacy-расписание отключено (LEGACY_POSTS=false).");
}

// Динамические посты кланов — каждый час в :00 по МСК
schedule.scheduleJob({ rule: "0 * * * *", tz: "Europe/Moscow" }, () => sendDuePosts());

console.log("[BOT] Scheduled jobs set up.");

// Корректное закрытие Mongo
async function shutdown() {
  try { if (mongoClient) await mongoClient.close(); } catch {}
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
