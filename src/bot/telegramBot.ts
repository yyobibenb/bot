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
    this.bot.onText(/\/start (.+)/, (msg, match) => this.handleStart(msg, match?.[1]));
    this.bot.onText(/\/balance/, (msg) => this.handleBalance(msg));
    this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));
    this.bot.onText(/\/ref/, (msg) => this.handleReferral(msg));
    this.bot.onText(/\/debug/, (msg) => this.handleDebug(msg));
  }

  private getWebAppUrl(): string {
    const url = process.env.WEB_APP_URL || "https://your-app-url.com";

    if (!url || url === 'https://your-app-url.com') {
      console.error('⚠️ WEB_APP_URL не установлен в .env файле!');
    }

    return url;
  }

  private async handleStart(msg: TelegramBot.Message, referralCode?: string) {
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
      let isNewUser = false;

      if (!user) {
        isNewUser = true;

        // Обрабатываем реферальный код
        let referrerId = null;
        if (referralCode) {
          try {
            const referrerTelegramId = parseInt(referralCode);
            const referrer = await UserModel.findByTelegramId(referrerTelegramId);
            if (referrer && referrer.telegram_id !== telegramId) {
              referrerId = referrer.id;
              console.log(`📎 Пользователь ${telegramId} приглашен рефералом ${referrerTelegramId}`);
            }
          } catch (err) {
            console.log("Неверный реферальный код:", referralCode);
          }
        }

        user = await UserModel.create({
          telegram_id: telegramId,
          first_name: msg.from?.first_name || "User",
          username: msg.from?.username,
          last_name: msg.from?.last_name,
          language_code: msg.from?.language_code,
          photo_url: photoUrl,
          is_premium: (msg.from as any)?.is_premium || false,
          referrer_id: referrerId,
        });

        // Создаем баланс
        await BalanceModel.createForUser(user.id);

        // Создаем реферальную связь
        if (referrerId) {
          const { ReferralModel } = await import("../models/Referral");
          await ReferralModel.create(referrerId, user.id);

          // Уведомляем реферера
          const referrer = await UserModel.getUserById(referrerId);
          if (referrer) {
            await this.bot.sendMessage(
              referrer.telegram_id,
              `🎉 У вас новый реферал!\n\n👤 ${user.first_name}\n💰 Вы будете получать 5% от его депозитов!`
            );
          }
        }

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

      // Отправляем кнопку с Mini App
      // ВАЖНО: Telegram НЕ передаёт URL параметры через web_app кнопки!
      // Данные пользователя получаются через Telegram.WebApp.initDataUnsafe на фронтенде
      await this.bot.sendMessage(chatId, WELCOME_MESSAGE, {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "🚀 Открыть Mini App", web_app: { url: webAppUrl } }]
          ],
          resize_keyboard: true,
        },
      });

      console.log(`✅ Mini App отправлен пользователю ${telegramId}`);
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
/ref - Партнерская программа
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

  private async handleReferral(msg: TelegramBot.Message) {
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

      const { ReferralModel } = await import("../models/Referral");
      const stats = await ReferralModel.getReferralStats(user.id);

      const botUsername = (await this.bot.getMe()).username;
      const referralLink = `https://t.me/${botUsername}?start=${telegramId}`;

      const message = `
👥 **Партнерская программа**

🔗 **Ваша реферальная ссылка:**
\`${referralLink}\`

📊 **Статистика:**
Рефералов: ${stats.total_referrals}
Заработано: ${stats.total_earned.toFixed(2)} USDT

💰 **Условия:**
• 5% от каждого депозита реферала
• Моментальное зачисление на баланс
• Неограниченное количество рефералов

${stats.referrals.length > 0 ? `\n👥 **Ваши рефералы:**\n${stats.referrals.slice(0, 5).map(ref =>
  `• ${ref.first_name} - ${ref.total_deposited.toFixed(2)} USDT`
).join('\n')}` : ''}

Поделитесь ссылкой с друзьями и зарабатывайте! 🚀
      `;

      await this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error: any) {
      console.error("Error handling referral:", error);
      await this.bot.sendMessage(chatId, "❌ Ошибка при получении реферальной информации");
    }
  }

  private async handleDebug(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    const webAppUrl = this.getWebAppUrl();

    const message = `
🔍 **Проверка настроек**

**WEB_APP_URL:**
\`${webAppUrl}\`

**Твой Telegram ID:**
\`${telegramId}\`

**Проверка:**
${webAppUrl === 'https://your-app-url.com' ? '❌ WEB_APP_URL НЕ УСТАНОВЛЕН!' : '✅ WEB_APP_URL установлен'}

${webAppUrl.includes('bot-rl59.onrender.com') ? '✅ Правильный домен' : '⚠️ Проверь домен'}

**💡 Важно:**
• Telegram НЕ передаёт URL параметры через web_app кнопки
• Данные получаются через Telegram.WebApp.initDataUnsafe
• Никакие параметры в URL добавлять не нужно
    `;

    await this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  }

  start() {
    console.log("✅ Telegram бот запущен");
  }

  getBot() {
    return this.bot;
  }

  async sendMessage(chatId: number, text: string, options?: any) {
    return this.bot.sendMessage(chatId, text, options);
  }
}
