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

const message1 = `Сообщество **SKAT** готово рассмотреть кандидатов для совместных игр в Squad.

[x][Активным членам сообщества предоставляем **VIP** пропуска на **РНС** сервера]
[x][Проводим клановые тренировки]

**[Мы ждëм вас, если вы]:**
Хотите научиться играть, или уже умеете играть, но нет постоянной команды;
Хотите улучшить тактические и механические навыки игры в Squad;
Хотите участвовать в турнирах и ивентах;

**[Требования к вступающим]:**
Возраст от 16 и старше;
Адекватность [Самое важное!];
Участие в развитии клана [опционально];

**[Онлайн без обязательств]:**
Прайм-тайм с 18:00 до 22:00 по МСК;

**[Также активно играем в различные проекты]**
https://discord.com/invite/VTcT8xwpGR
https://cdn.discordapp.com/attachments/765988405791555635/1264939650561081464/0423d4beee19884c.png?ex=66af845a&is=66ae32da&hm=194e223294473a128cbb4fc13d1d1219a69ecec69f189d57fc91780afba62e34&`;

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

schedule.scheduleJob("0 17 * * *", () => {
  sendMessage(message2);
});

schedule.scheduleJob("0 13 * * *", () => {
  sendMessage(message4);
});
