import dotenv from "dotenv";
dotenv.config();

import { TelegramBotService } from "./bot/telegramBot";
import { startServer, setTelegramBot } from "./server/app";

async function main() {
  console.log("🚀 Запуск Mini App Бота...\n");

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN не установлен");
    process.exit(1);
  }

  const bot = new TelegramBotService(process.env.TELEGRAM_BOT_TOKEN);
  bot.start();

  setTelegramBot(bot);

  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  startServer(port);

  console.log("\n✅ Все сервисы запущены!");
  console.log("📱 Telegram бот готов к работе");
  console.log(`🌐 Mini App доступен на http://localhost:${port}`);
}

main().catch((error) => {
  console.error("❌ Критическая ошибка:", error);
  process.exit(1);
});
