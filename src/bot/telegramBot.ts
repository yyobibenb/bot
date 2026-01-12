import TelegramBot from "node-telegram-bot-api";
import { UserModel } from "../models/User";
import { BalanceModel } from "../models/Balance";
import cryptoService from "../services/CryptoService";

const WELCOME_MESSAGE = `
👋 Привет! Добро пожаловать в Casino Bot!

🎰 Доступные команды:
/deposit - Пополнить баланс USDT
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

      // Получаем адрес для пополнения
      const depositAddress = await cryptoService.getDepositAddress(user.id);

      const message = `
💰 **Пополнение баланса**

Отправьте USDT (TRC20) на этот адрес:

\`${depositAddress}\`

📝 **Инструкция:**
1. Откройте ваш крипто-кошелек
2. Выберите USDT в сети TRC20
3. Отправьте любую сумму на адрес выше
4. Средства поступят автоматически в течение 5-10 минут

⚠️ **Важно:**
- Отправляйте только USDT TRC20
- Минимальная сумма: 10 USDT
- Не отправляйте другие токены на этот адрес

Проверить баланс: /balance
      `;

      await this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error: any) {
      console.error("Error handling deposit:", error);
      await this.bot.sendMessage(chatId, "❌ Ошибка при получении адреса для пополнения");
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
/deposit - Пополнить баланс USDT TRC20
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
1. Используйте /deposit для получения адреса
2. Отправьте USDT TRC20 на адрес
3. Средства зачислятся автоматически

**Вывод:**
1. Используйте /withdraw
2. Минимальная сумма: 10 USDT
3. Выводы от $10 проходят модерацию (1-24 часа)

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

        // Переходим к вводу адреса
        this.withdrawStates.set(chatId, { step: "address", amount });

        await this.bot.sendMessage(
          chatId,
          `✅ Сумма: ${amount} USDT\n\nТеперь введите ваш USDT TRC20 адрес для вывода:\n\n⚠️ Убедитесь, что адрес правильный! Отправка на неверный адрес приведет к потере средств.`
        );
      } else if (state.step === "address") {
        // Обработка ввода адреса
        const address = text.trim();

        if (!address.startsWith("T") || address.length !== 34) {
          await this.bot.sendMessage(
            chatId,
            "❌ Некорректный USDT TRC20 адрес.\n\nАдрес должен начинаться с 'T' и содержать 34 символа.\n\nВведите адрес заново:"
          );
          return;
        }

        const amount = state.amount!;

        // Получаем пользователя
        const user = await UserModel.findByTelegramId(telegramId);
        if (!user) {
          this.withdrawStates.delete(chatId);
          await this.bot.sendMessage(chatId, "❌ Пользователь не найден");
          return;
        }

        // Создаем заявку на вывод
        const result = await cryptoService.withdrawUSDT(user.id, address, amount);

        this.withdrawStates.delete(chatId);

        if (result.success) {
          if (result.txid) {
            await this.bot.sendMessage(
              chatId,
              `✅ **Вывод выполнен успешно!**\n\nСумма: ${amount} USDT\nАдрес: \`${address}\`\nТранзакция: \`${result.txid}\`\n\nСредства поступят в течение 5-10 минут.`,
              { parse_mode: "Markdown" }
            );
          } else {
            await this.bot.sendMessage(
              chatId,
              `✅ **Заявка на вывод создана!**\n\nСумма: ${amount} USDT\nАдрес: \`${address}\`\n\n⏳ Ваша заявка отправлена на модерацию.\nВывод будет обработан в течение 1-24 часов.\n\nВы получите уведомление после обработки.`,
              { parse_mode: "Markdown" }
            );
          }
        } else {
          await this.bot.sendMessage(
            chatId,
            `❌ Ошибка при создании заявки на вывод:\n\n${result.error || "Неизвестная ошибка"}`
          );
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
