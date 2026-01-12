import TelegramBot from "node-telegram-bot-api";
import { UserModel } from "../models/User";
import { BalanceModel } from "../models/Balance";

const WELCOME_MESSAGE = `
👋 Привет! Добро пожаловать в Casino Bot!

🎰 Доступные команды:
/deposit - Пополнить баланс через @send
/withdraw - Вывести средства
/balance - Проверить баланс
/help - Помощь

Нажмите кнопку ниже, чтобы открыть приложение:
`;

export class TelegramBotService {
  private bot: TelegramBot;
  private withdrawStates: Map<number, { step: string; amount?: number }> = new Map();

  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: true });
    this.setupHandlers();
  }

  private setupHandlers() {
    this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
    this.bot.onText(/\/deposit/, (msg) => this.handleDeposit(msg));
    this.bot.onText(/\/withdraw/, (msg) => this.handleWithdraw(msg));
    this.bot.onText(/\/balance/, (msg) => this.handleBalance(msg));
    this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));
    this.bot.on("message", (msg) => this.handleMessage(msg));
  }

  private getWebAppUrl(): string {
    return process.env.WEB_APP_URL || "https://your-app-url.com";
  }

  private async handleStart(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const webAppUrl = this.getWebAppUrl();

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

  private async handleDeposit(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!telegramId) {
      await this.bot.sendMessage(chatId, "❌ Ошибка: не удалось определить пользователя");
      return;
    }

    try {
      // Получаем пользователя
      let user = await UserModel.findByTelegramId(telegramId);

      if (!user) {
        // Создаем пользователя если не существует
        user = await UserModel.create({
          telegram_id: telegramId,
          first_name: msg.from?.first_name || "User",
          username: msg.from?.username,
          last_name: msg.from?.last_name,
          language_code: msg.from?.language_code,
          is_premium: (msg.from as any)?.is_premium || false,
        });

        // Создаем баланс
        await BalanceModel.createForUser(user.id);
      }

      const message = `
💰 **Пополнение баланса**

Для пополнения используйте криптобот @send:

📝 **Инструкция:**
1. Откройте бот @send в Telegram
2. Выберите "Отправить"
3. Выберите USDT
4. Введите ID получателя: \`${telegramId}\`
5. Укажите сумму
6. Подтвердите транзакцию

⚠️ **Важно:**
- Минимальная сумма: 10 USDT
- Средства зачислятся автоматически
- ID получателя: \`${telegramId}\`

После отправки средства поступят на ваш баланс автоматически.

Проверить баланс: /balance
      `;

      await this.bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "💸 Открыть @send", url: "https://t.me/send" }
          ]]
        }
      });
    } catch (error: any) {
      console.error("Error handling deposit:", error);
      await this.bot.sendMessage(chatId, "❌ Ошибка при обработке запроса");
    }
  }

  private async handleWithdraw(msg: TelegramBot.Message) {
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

      if (!balance || balance.balance < 10) {
        await this.bot.sendMessage(
          chatId,
          `❌ Недостаточно средств для вывода.\n\nВаш баланс: ${balance?.balance || 0} USDT\nМинимум для вывода: 10 USDT`
        );
        return;
      }

      // Устанавливаем состояние для интерактивного диалога
      this.withdrawStates.set(chatId, { step: "amount" });

      await this.bot.sendMessage(
        chatId,
        `💸 **Вывод средств**\n\nВаш баланс: ${balance.balance} USDT\nМинимум для вывода: 10 USDT\n\nВведите сумму вывода (в USDT):`,
        { parse_mode: "Markdown" }
      );
    } catch (error: any) {
      console.error("Error handling withdraw:", error);
      await this.bot.sendMessage(chatId, "❌ Ошибка при обработке запроса");
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

📊 **Действия:**
/deposit - Пополнить баланс
/withdraw - Вывести средства
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

/start - Главное меню
/deposit - Пополнить баланс через @send
/withdraw - Вывести средства (мин. 10 USDT)
/balance - Проверить баланс
/help - Показать эту справку

**Игры:**
🎲 Кубик - 8 режимов игры
🎳 Боулинг - Страйк и Дуэль
⚽ Футбол - Гол, Мимо, Дуэль
🏀 Баскетбол - Попадание и Промах
🎯 Дартс - Красное, Белое, Центр, Мимо

**Пополнение:**
1. Используйте /deposit для инструкции
2. Откройте @send бота в Telegram
3. Отправьте USDT на ваш ID
4. Средства зачислятся автоматически

**Вывод:**
1. Используйте /withdraw
2. Минимальная сумма: 10 USDT
3. Средства отправятся через @send (1-24 часа)

**Поддержка:** @your_support
    `;

    await this.bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
  }

  private async handleMessage(msg: TelegramBot.Message) {
    const text = msg.text;
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    if (!text) return;
    if (text.startsWith("/")) return;

    // Проверяем состояние вывода средств
    const withdrawState = this.withdrawStates.get(chatId);

    if (withdrawState) {
      await this.handleWithdrawFlow(msg, withdrawState);
      return;
    }

    if (text === "🚀 Открыть Mini App") {
      return this.handleStart(msg);
    }
  }

  private async handleWithdrawFlow(
    msg: TelegramBot.Message,
    state: { step: string; amount?: number }
  ) {
    const chatId = msg.chat.id;
    const text = msg.text;
    const telegramId = msg.from?.id;

    if (!text || !telegramId) return;

    try {
      if (state.step === "amount") {
        // Обработка ввода суммы
        const amount = parseFloat(text);

        if (isNaN(amount) || amount < 10) {
          await this.bot.sendMessage(
            chatId,
            "❌ Некорректная сумма. Минимум для вывода: 10 USDT\n\nВведите сумму вывода:"
          );
          return;
        }

        // Проверяем достаточность баланса
        const user = await UserModel.findByTelegramId(telegramId);
        if (!user) {
          this.withdrawStates.delete(chatId);
          await this.bot.sendMessage(chatId, "❌ Пользователь не найден");
          return;
        }

        const balance = await BalanceModel.getBalance(user.id);
        if (!balance || balance.balance < amount) {
          this.withdrawStates.delete(chatId);
          await this.bot.sendMessage(
            chatId,
            `❌ Недостаточно средств.\n\nВаш баланс: ${balance?.balance || 0} USDT\nЗапрошенная сумма: ${amount} USDT`
          );
          return;
        }

        // Создаем заявку на вывод (через @send бота)
        // Сразу вычитаем с баланса
        await BalanceModel.subtractBalance(user.id, amount);

        this.withdrawStates.delete(chatId);

        await this.bot.sendMessage(
          chatId,
          `✅ **Заявка на вывод создана!**\n\nСумма: ${amount} USDT\nID получателя: \`${telegramId}\`\n\n⏳ Ваша заявка отправлена на обработку.\nСредства будут отправлены через @send бота в течение 1-24 часов.\n\nВы получите уведомление после обработки.`,
          { parse_mode: "Markdown" }
        );

        // Уведомляем админа (ID 5855297931)
        const adminId = 5855297931;
        try {
          await this.bot.sendMessage(
            adminId,
            `🔔 **Новая заявка на вывод**\n\nПользователь: ${user.first_name} (ID: ${telegramId})\nСумма: ${amount} USDT\n\n💸 Используйте @send для отправки средств пользователю по ID: \`${telegramId}\``,
            { parse_mode: "Markdown" }
          );
        } catch (err) {
          console.error("Не удалось отправить уведомление админу:", err);
        }
      }
    } catch (error: any) {
      console.error("Error in withdraw flow:", error);
      this.withdrawStates.delete(chatId);
      await this.bot.sendMessage(chatId, "❌ Произошла ошибка. Попробуйте снова: /withdraw");
    }
  }

  start() {
    console.log("✅ Telegram бот запущен");
  }

  async sendMessage(chatId: number, text: string, options?: any) {
    return this.bot.sendMessage(chatId, text, options);
  }
}
