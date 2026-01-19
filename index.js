import { Client, GatewayIntentBits } from "discord.js";
import schedule from "node-schedule";
import { config } from "dotenv";
import { HttpsProxyAgent } from "https-proxy-agent";
import { ProxyAgent, setGlobalDispatcher } from "undici";

config();

const proxyUrl = process.env.DISCORD_PROXY_URL;
let wsProxyAgent = null;

if (proxyUrl) {
  console.log("[BOT] Using Discord proxy:", proxyUrl);

  const restProxy = new ProxyAgent(proxyUrl);
  setGlobalDispatcher(restProxy);

  wsProxyAgent = new HttpsProxyAgent(proxyUrl);
}

async function sendMessage(content) {
  const client = new Client({
    intents: [
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    ...(wsProxyAgent ? { ws: { agent: wsProxyAgent } } : {}),
  });

  client.once("ready", async () => {
    try {
      console.log(`Logged in as ${client.user.tag}!`);

      const channel = await client.channels.fetch(process.env.CHANNEL_ID);
      if (!channel) {
        console.error("Канал не найден.");
        return;
      }

      await channel.send(content);
    } catch (e) {
      console.error("[SEND] Ошибка отправки:", e);
    } finally {
      client.destroy();
    }
  });

  client.on("error", (err) => console.error("[CLIENT ERROR]", err));
  client.on("shardError", (err) => console.error("[SHARD ERROR]", err));

  await client.login(process.env.DISCORD_TOKEN);
}

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

const message3 = `**Ахтунг! Клан KRIEG проводит набор новых кандидатов.**
  Мы - команда опытных игроков. В нашем клане приветствуются как знатоки сквада, так и новые игроки.
  
 **От нас:**
- Совместная игра. Основное время 18-22 МСК
- Обучение новых игроков
- Приятная атмосфера 
- Клановый VIP для активных игроков

 **От вас же мы ждем:**
- Хорошее настроение
- Адекватность и желание развиваться вместе с кланом
- Возраст 16+ (Опционально) 

**Если после прочтения у вас появилось желание присоединиться к нам - добро пожаловать!**
https://discord.gg/WPbaUj5ncp
https://cdn.discordapp.com/attachments/1224234669034442775/1274384096784810075/00000.png?ex=66c20e2d&is=66c0bcad&hm=2a9389869cb32e165212ab056b121c97b7586e4d564b8911b0fe3bf4af4d48ab&`;

const message4 = `'IMPERA Corp.' – это клан, который не только ориентирован на веселую и фановую игру вместе, но и стремится к серьёзным соревнованиям (Турниры, Клановые войны, Межсерверные баталии, Ивенты).

Основной состав нашего клана – опытные игроки 18+ готовые делиться своим опытом с игроками любого уровня.

Главное для нас - стремление к совершенствованию, к победе и формированию вокруг себя сплочённого и приятного коллектива.
  
 **Ожидаем от вас:**
- Активного участия в жизни клана
- Желания развиваться и перенимать опыт старших товарищей
- Возраст 18+ (возможны исключения)
- Адекватное общение

 **Взамен предлагаем:**
- VIP статус для активных игроков
- Незабываемый игровой опыт
- Разнообразие в выборе направлений

**Основной 'прайм тайм' клана с 19:00 до 23:00 по МСК.**
https://discord.gg/HHNC8DWaaW
`;

schedule.scheduleJob("0 21 * * *", () => {
  sendMessage(message1);
});

schedule.scheduleJob("0 17 * * *", () => {
  sendMessage(message2);
});

schedule.scheduleJob("0 13 * * *", () => {
  sendMessage(message4);
});
