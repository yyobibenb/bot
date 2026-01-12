import TelegramBot from "node-telegram-bot-api";
import { UserModel } from "../models/User";
import { BalanceModel } from "../models/Balance";

const WELCOME_MESSAGE = `
👋 Привет! Добро пожаловать в Casino Bot!

🎰 Играй в игры и зарабатывай!
💰 Пополнение и вывод прямо в приложении

Нажмите кнопку ниже, чтобы открыть Mini App:
`;

export class TelegramBotService {
  private bot: TelegramBot;

  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: true });
    this.setupHandlers();
  }

  private setupHandlers() {
    this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
    this.bot.onText(/\/balance/, (msg) => this.handleBalance(msg));
    this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));
  }

  private getWebAppUrl(): string {
    return process.env.WEB_APP_URL || "https://your-app-url.com";
  }

  private async handleStart(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;
    const webAppUrl = this.getWebAppUrl();

    if (!telegramId) {
      await this.bot.sendMessage(chatId, "❌ Ошибка: не удалось определить пользователя");
      return;
    }

    try {
      // Получаем фото профиля пользователя
      let photoUrl = null;
      try {
        const photos = await this.bot.getUserProfilePhotos(telegramId, { limit: 1 });
        if (photos.total_count > 0 && photos.photos[0] && photos.photos[0][0]) {
          const fileId = photos.photos[0][0].file_id;
          const file = await this.bot.getFile(fileId);
          photoUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        }
      } catch (err) {
        console.log("Не удалось получить фото профиля:", err);
      }

      // Создаем или обновляем пользователя
      let user = await UserModel.findByTelegramId(telegramId);

      if (!user) {
        user = await UserModel.create({
          telegram_id: telegramId,
          first_name: msg.from?.first_name || "User",
          username: msg.from?.username,
          last_name: msg.from?.last_name,
          language_code: msg.from?.language_code,
          photo_url: photoUrl,
          is_premium: (msg.from as any)?.is_premium || false,
        });

        // Создаем баланс
        await BalanceModel.createForUser(user.id);
        console.log(`✅ Новый пользователь создан: ${telegramId} (${user.first_name})`);
      } else {
        // Обновляем данные пользователя
        await UserModel.updateUser(user.id, {
          first_name: msg.from?.first_name || user.first_name,
          username: msg.from?.username,
          last_name: msg.from?.last_name,
          photo_url: photoUrl || user.photo_url,
          is_premium: (msg.from as any)?.is_premium || false,
        });
      }

      await this.bot.sendMessage(chatId, WELCOME_MESSAGE, {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "🚀 Открыть Mini App", web_app: { url: webAppUrl } }]
          ],
          resize_keyboard: true,
        },
      });
    } catch (error: any) {
      console.error("Error handling start:", error);
      await this.bot.sendMessage(chatId, WELCOME_MESSAGE, {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "🚀 Открыть Mini App", web_app: { url: webAppUrl } }]
          ],
          resize_keyboard: true,
        },
      });
    }
  }

  private async handleBalance(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      await this.bot.sendMessage(chatId, "❌ Ошибка: не удалось определить пользователя");
      return;
    }

    try {
      const user = await UserModel.findByTelegramId(telegramId);

      if (!user) {
        await this.bot.sendMessage(chatId, "❌ Пользователь не найден. Используйте /start");
        return;
      }

      const balance = await BalanceModel.getBalance(user.id);

      if (!balance) {
        await this.bot.sendMessage(chatId, "❌ Баланс не найден");
        return;
      }

      const message = `
💰 **Ваш баланс**

Текущий баланс: **${balance.balance.toFixed(2)} USDT**
Всего пополнено: ${balance.total_deposited.toFixed(2)} USDT
Всего выведено: ${balance.total_withdrawn.toFixed(2)} USDT

💸 Пополнение и вывод доступны в Mini App
      `;

      await this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error: any) {
      console.error("Error handling balance:", error);
      await this.bot.sendMessage(chatId, "❌ Ошибка при получении баланса");
    }
  }

  private async handleHelp(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;

    const helpMessage = `
🎰 **Casino Bot - Помощь**

**Доступные команды:**

/start - Открыть Mini App
/balance - Проверить баланс
/help - Показать эту справку

**Игры:**
🎲 Кубик - 8 режимов игры
🎳 Боулинг - Страйк и Дуэль
⚽ Футбол - Гол, Мимо, Дуэль
🏀 Баскетбол - Попадание и Промах
🎯 Дартс - Красное, Белое, Центр, Мимо

**💰 Пополнение и вывод:**
Все операции доступны в Mini App!
- Автоматическое пополнение USDT
- Быстрый вывод (от 10 USDT)
- История транзакций

**Поддержка:** @your_support
    `;

    await this.bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
  }

  start() {
    console.log("✅ Telegram бот запущен");
  }

  async sendMessage(chatId: number, text: string, options?: any) {
    return this.bot.sendMessage(chatId, text, options);
  }
}
