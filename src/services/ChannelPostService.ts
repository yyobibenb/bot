import TelegramBot from "node-telegram-bot-api";
import pool from "../database/pool";

interface GameResult {
  userId: number;
  username: string;
  firstName: string;
  gameName: string;
  betAmount: number;
  winAmount: number;
  isWin: boolean;
  emoji: string;
}

export class ChannelPostService {
  private bot: TelegramBot | null = null;
  private channelId: string | null = null;
  private fakePostInterval: NodeJS.Timeout | null = null;

  constructor(bot: TelegramBot, channelId?: string) {
    this.bot = bot;
    this.channelId = channelId || process.env.CHANNEL_ID || null;
  }

  /**
   * Запустить автоматическую публикацию фейковых результатов
   */
  async startFakePostScheduler() {
    if (!this.channelId || !this.bot) {
      console.log("⚠️  Канал не настроен, фейковые посты отключены");
      return;
    }

    // Получаем настройки из базы
    const settings = await pool.query(
      `SELECT key, value FROM settings
       WHERE key IN ('channel_fake_interval_min', 'channel_fake_interval_max', 'channel_fake_win_rate')`
    );

    const config = {
      minInterval: 10,
      maxInterval: 60,
      winRate: 30,
    };

    settings.rows.forEach((row) => {
      switch (row.key) {
        case "channel_fake_interval_min":
          config.minInterval = parseInt(row.value);
          break;
        case "channel_fake_interval_max":
          config.maxInterval = parseInt(row.value);
          break;
        case "channel_fake_win_rate":
          config.winRate = parseInt(row.value);
          break;
      }
    });

    const scheduleNext = () => {
      const delay = (config.minInterval + Math.random() * (config.maxInterval - config.minInterval)) * 1000;
      this.fakePostInterval = setTimeout(async () => {
        await this.postFakeResult(config.winRate);
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    console.log(`✅ Фейковые посты запущены (интервал: ${config.minInterval}-${config.maxInterval}с, win rate: ${config.winRate}%)`);
  }

  /**
   * Остановить автоматическую публикацию
   */
  stopFakePostScheduler() {
    if (this.fakePostInterval) {
      clearTimeout(this.fakePostInterval);
      this.fakePostInterval = null;
      console.log("⏹️  Фейковые посты остановлены");
    }
  }

  /**
   * Опубликовать реальный результат игры
   */
  async postGameResult(result: GameResult) {
    if (!this.channelId || !this.bot) {
      return;
    }

    try {
      const username = result.username ? `@${result.username}` : result.firstName;
      const emoji = result.isWin ? "🎉" : "😔";
      const resultText = result.isWin ? "ВЫИГРЫШ" : "ПРОИГРЫШ";
      const profit = result.isWin ? `+${result.winAmount.toFixed(2)}` : `-${result.betAmount.toFixed(2)}`;

      const message = `${emoji} ${resultText}

${result.emoji} ${result.gameName}
👤 ${username}
💰 Ставка: ${result.betAmount.toFixed(2)} USDT
${result.isWin ? `💵 Выигрыш: ${result.winAmount.toFixed(2)} USDT` : ""}
📊 Профит: ${profit} USDT`;

      await this.bot.sendMessage(this.channelId, message);

      // Сохраняем в базу
      const gameResult = await pool.query(
        "SELECT id FROM games WHERE name = $1 LIMIT 1",
        [result.gameName]
      );
      const gameId = gameResult.rows[0]?.id;

      if (gameId) {
        await pool.query(
          `INSERT INTO channel_posts (game_id, user_id, is_fake, bet_amount, win_amount, is_win, game_result)
           VALUES ($1, $2, false, $3, $4, $5, $6)`,
          [gameId, result.userId, result.betAmount, result.winAmount, result.isWin, resultText]
        );
      }
    } catch (error) {
      console.error("Ошибка при публикации результата в канал:", error);
    }
  }

  /**
   * Опубликовать фейковый результат
   */
  private async postFakeResult(winRatePercent: number) {
    if (!this.channelId || !this.bot) {
      return;
    }

    try {
      // Случайная игра
      const gamesResult = await pool.query("SELECT id, name, type FROM games WHERE is_active = true");
      const games = gamesResult.rows;

      if (games.length === 0) return;

      const game = games[Math.floor(Math.random() * games.length)];

      // Определяем выигрыш или проигрыш
      const isWin = Math.random() * 100 < winRatePercent;

      // Случайная ставка
      const betAmount = [5, 10, 20, 50, 100, 200, 500][Math.floor(Math.random() * 7)];

      // Случайный мультипликатор (если выигрыш)
      const multipliers = [1.33, 1.84, 2.76, 3.68, 5.00, 5.52];
      const multiplier = multipliers[Math.floor(Math.random() * multipliers.length)];
      const winAmount = isWin ? betAmount * multiplier : 0;

      // Фейковое имя пользователя
      const fakeNames = ["Александр", "Дмитрий", "Иван", "Михаил", "Андрей", "Сергей", "Алексей", "Владимир", "Максим", "Артём"];
      const fakeName = fakeNames[Math.floor(Math.random() * fakeNames.length)];

      // Эмодзи для игр
      const gameEmojis: { [key: string]: string } = {
        dice: "🎲",
        bowling: "🎳",
        football: "⚽",
        basketball: "🏀",
        darts: "🎯",
        slots: "🎰",
        rps: "🪨",
      };

      const emoji = isWin ? "🎉" : "😔";
      const resultText = isWin ? "ВЫИГРЫШ" : "ПРОИГРЫШ";
      const profit = isWin ? `+${winAmount.toFixed(2)}` : `-${betAmount.toFixed(2)}`;

      const message = `${emoji} ${resultText}

${gameEmojis[game.type] || "🎮"} ${game.name}
👤 ${fakeName}
💰 Ставка: ${betAmount.toFixed(2)} USDT
${isWin ? `💵 Выигрыш: ${winAmount.toFixed(2)} USDT` : ""}
📊 Профит: ${profit} USDT`;

      await this.bot.sendMessage(this.channelId, message);

      // Сохраняем в базу
      await pool.query(
        `INSERT INTO channel_posts (game_id, user_id, is_fake, bet_amount, win_amount, is_win, game_result)
         VALUES ($1, NULL, true, $2, $3, $4, $5)`,
        [game.id, betAmount, winAmount, isWin, resultText]
      );
    } catch (error) {
      console.error("Ошибка при публикации фейкового результата:", error);
    }
  }

  /**
   * Создать хук для автоматической публикации результатов
   */
  static createGameResultHook(channelService: ChannelPostService, gameName: string, gameEmoji: string) {
    return async (userId: number, betAmount: number, winAmount: number, isWin: boolean) => {
      try {
        const userResult = await pool.query(
          "SELECT username, first_name FROM users WHERE id = $1",
          [userId]
        );

        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          await channelService.postGameResult({
            userId,
            username: user.username,
            firstName: user.first_name,
            gameName,
            betAmount,
            winAmount,
            isWin,
            emoji: gameEmoji,
          });
        }
      } catch (error) {
        console.error("Ошибка в хуке публикации результата:", error);
      }
    };
  }
}
