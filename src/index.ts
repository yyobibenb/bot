import dotenv from "dotenv";

const savedDbUrl = process.env.DATABASE_URL;
const savedPgHost = process.env.PGHOST;
const savedPgPort = process.env.PGPORT;
const savedPgUser = process.env.PGUSER;
const savedPgPass = process.env.PGPASSWORD;
const savedPgDb = process.env.PGDATABASE;

dotenv.config();

if (savedDbUrl) process.env.DATABASE_URL = savedDbUrl;
if (savedPgHost) process.env.PGHOST = savedPgHost;
if (savedPgPort) process.env.PGPORT = savedPgPort;
if (savedPgUser) process.env.PGUSER = savedPgUser;
if (savedPgPass) process.env.PGPASSWORD = savedPgPass;
if (savedPgDb) process.env.PGDATABASE = savedPgDb;

import { db } from "./db/database";
import { TelegramBotService } from "./bot/telegramBot";
import { startServer, setTelegramBot } from "./server/app";

async function main() {
  console.log("🚀 Запуск Telegram Гарант-Бота...\n");

  if (db.isConfigured()) {
    console.log("📊 Инициализация базы данных...");
    await db.init();
  } else {
    console.warn("⚠️  База данных не настроена. Проверьте переменные PGHOST, PGUSER, PGPASSWORD.");
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN не установлен в .env файле");
    process.exit(1);
  }

  if (!process.env.SESSION_SECRET) {
    console.warn("⚠️  SESSION_SECRET не установлен. Используем временный ключ.");
    process.env.SESSION_SECRET = "temporary_secret_key_" + Date.now();
  }

  const bot = new TelegramBotService(process.env.TELEGRAM_BOT_TOKEN);
  bot.start();
  
  // Pass bot instance to server for notifications
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
