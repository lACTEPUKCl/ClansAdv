import { Client, GatewayIntentBits } from "discord.js";
import schedule from "node-schedule";
import { config } from "dotenv";
config();

async function sendMessage() {
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
      await channel.send(`Сообщество **SKAT** готово рассмотреть кандидатов для совместных игр в Squad.

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
https://cdn.discordapp.com/attachments/765988405791555635/1264939650561081464/0423d4beee19884c.png?ex=66af845a&is=66ae32da&hm=194e223294473a128cbb4fc13d1d1219a69ecec69f189d57fc91780afba62e34&`);
    } else {
      console.error("Канал не найден.");
    }

    client.destroy();
  });

  await client.login(process.env.DISCORD_TOKEN);
}
sendMessage();
schedule.scheduleJob("0 10 * * *", () => {
  sendMessage();
});
