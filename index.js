import { Client, GatewayIntentBits } from "discord.js";
import schedule from "node-schedule";
import { config } from "dotenv";
config();

async function sendMessage(content) {
  const client = new Client({
    intents: [
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once("ready", async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const channel = await client.channels.fetch(process.env.CHANNEL_ID);
    if (channel) {
      await channel.send(content);
    } else {
      console.error("Канал не найден.");
    }

    client.destroy();
  });

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
https://discord.gg/ndm4fPFTpB
https://cdn.discordapp.com/attachments/765988405791555635/1264939650561081464/0423d4beee19884c.png?ex=66af845a&is=66ae32da&hm=194e223294473a128cbb4fc13d1d1219a69ecec69f189d57fc91780afba62e34&`;

const message2 = `Стоп
**Игровое сообщество 5.45 проводит набор кандидатов на вступление.**

Наше сообщество создано для комфортной и веселой игры. У нас нет токсичного общения, только позитивный вайб.

— Проводятся мероприятия по разнообразию игры в SQUAD;
— Активные участники клана имеют возможность получить клановую VIP;
— Помимо SQUAD сможете найти себе напарников и в другие игры;
— Участвуем в CW и разных ивентах.

**Мы готовы принять вас, если:**

—  Ваш возраст равен или более 18 лет (возможны исключения);
—  Вам нравится играть в команде, получать новый опыт, проводить работу над ошибками в своих играх;
—  Вы воспринимаете адекватную критику в свою сторону;
—  Адекватность и отзывчивость - это про вас.

Основной "прайм тайм" клана в будние дни с 19:00 до 24:00 по МСК. 

**Если вы заинтересованы, рады будем ответить на ваши вопросы**

https://discord.gg/Q4Rsa8zKQ3
https://cdn.discordapp.com/attachments/1135615323563905086/1269716491801202729/IMG_8181.PNG?ex=66b11321&is=66afc1a1&hm=2fb3eb01a913114b9143e35703aeb99d5c4af7379bd51a69b78bdcd456c154aa&`;

// Schedule the first message at 10:00 AM
schedule.scheduleJob("0 10 * * *", () => {
  sendMessage(message1);
});

// Schedule the second message at 5:00 PM
schedule.scheduleJob("0 17 * * *", () => {
  sendMessage(message2);
});
