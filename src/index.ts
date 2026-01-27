import dotenv from "dotenv";
dotenv.config();

import { TelegramBotService } from "./bot/telegramBot";
import { startServer, setTelegramBot } from "./server/app";
import { initDatabase } from "./database/pool";
import { runMigrations } from "./database/migrate";
import { ChannelPostService } from "./services/ChannelPostService";

async function main() {
  console.log("🚀 Запуск Casino Bot...\n");

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN не установлен");
    process.exit(1);
  }

  // Инициализация базы данных
  await initDatabase();
  await runMigrations();

  const bot = new TelegramBotService(process.env.TELEGRAM_BOT_TOKEN);
  bot.start();

  setTelegramBot(bot);

  // Запускаем сервис канала со ставками
  if (process.env.CHANNEL_ID) {
    const TelegramBotConstructor = (await import("node-telegram-bot-api")).default;
    const botInstance = new TelegramBotConstructor(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
    const channelService = new ChannelPostService(botInstance, process.env.CHANNEL_ID);
    await channelService.startFakePostScheduler();
    console.log("📢 Канал со ставками запущен");
  } else {
    console.log("⚠️  CHANNEL_ID не установлен, канал со ставками отключен");
  }

  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  startServer(port);

  console.log("\n✅ Все сервисы запущены!");
  console.log("📱 Telegram бот готов к работе");
  console.log(`🌐 Mini App доступен на http://localhost:${port}`);
  console.log(`🎰 Casino Bot v1.0`);
}

main().catch((error) => {
  console.error("❌ Критическая ошибка:", error);
  process.exit(1);
});
