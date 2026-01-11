import TelegramBot from "node-telegram-bot-api";

const WELCOME_MESSAGE = `
👋 Привет! Добро пожаловать!

Нажмите кнопку ниже, чтобы открыть приложение:
`;

export class TelegramBotService {
  private bot: TelegramBot;

  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: true });
    this.setupHandlers();
  }

  private setupHandlers() {
    this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
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

  private async handleMessage(msg: TelegramBot.Message) {
    const text = msg.text;
    const chatId = msg.chat.id;

    if (!text) return;
    if (text.startsWith("/")) return;

    if (text === "🚀 Открыть Mini App") {
      return this.handleStart(msg);
    }
  }

  start() {
    console.log("✅ Telegram бот запущен");
  }

  async sendMessage(chatId: number, text: string, options?: any) {
    return this.bot.sendMessage(chatId, text, options);
  }
}
