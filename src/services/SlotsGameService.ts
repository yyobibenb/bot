import { BalanceModel } from "../models/Balance";
import { GameModel } from "../models/Game";
import pool from "../database/pool";

interface SlotResult {
  success: boolean;
  win: boolean;
  result: string[];
  betAmount: number;
  winAmount: number;
  newBalance: number;
  winType?: string;
  multiplier?: number;
}

export class SlotsGameService {
  private static readonly SYMBOLS = ["🍋", "🍇", "BAR", "7️⃣"];
  private static readonly MULTIPLIERS = {
    "🍋": 5,
    "🍇": 10,
    "BAR": 30,
    "7️⃣": 70,
  };

  // RTP-based probabilities для каждого символа
  // Лимон - 5x - высокая вероятность
  // Виноград - 10x - средняя вероятность
  // BAR - 30x - низкая вероятность
  // 777 - 70x - очень низкая вероятность
  private static readonly PROBABILITIES = {
    "🍋": 0.25,      // 25% шанс выпадения лимона
    "🍇": 0.15,      // 15% шанс выпадения винограда
    "BAR": 0.08,     // 8% шанс выпадения BAR
    "7️⃣": 0.03,      // 3% шанс выпадения 777
  };

  // RTP настройка (92%)
  private static readonly TARGET_RTP = 0.92;

  /**
   * Генерирует случайный символ на основе вероятностей
   */
  private static generateSymbol(): string {
    const rand = Math.random();
    let cumulative = 0;

    for (const [symbol, probability] of Object.entries(this.PROBABILITIES)) {
      cumulative += probability;
      if (rand < cumulative) {
        return symbol;
      }
    }

    // Fallback - случайный символ (остальная вероятность)
    const symbols = Object.keys(this.PROBABILITIES);
    return symbols[Math.floor(Math.random() * symbols.length)];
  }

  /**
   * Генерирует результат спина с учетом RTP
   */
  private static async generateResult(): Promise<string[]> {
    const settings = await pool.query(
      "SELECT value FROM settings WHERE key = 'global_rtp'"
    );
    const rtp = settings.rows[0]?.value ? parseFloat(settings.rows[0].value) : this.TARGET_RTP;

    // Генерируем 3 символа
    const result = [
      this.generateSymbol(),
      this.generateSymbol(),
      this.generateSymbol(),
    ];

    // Проверяем, является ли результат выигрышным
    const isWin = result[0] === result[1] && result[1] === result[2];

    // RTP adjustment: иногда принудительно создаем выигрыш
    const rtpCheck = Math.random();
    if (!isWin && rtpCheck < (rtp - 0.80)) {
      // Принудительно создаем выигрыш с низким мультипликатором
      const winSymbol = Math.random() < 0.7 ? "🍋" : "🍇";
      return [winSymbol, winSymbol, winSymbol];
    }

    // RTP adjustment: иногда принудительно убираем выигрыш
    if (isWin && rtpCheck > rtp) {
      // Портим один символ
      result[2] = this.generateSymbol();
      // Убедимся что не совпадает
      while (result[2] === result[0]) {
        result[2] = this.generateSymbol();
      }
    }

    return result;
  }

  /**
   * Проверяет, является ли результат выигрышным и возвращает множитель
   */
  private static checkWin(result: string[], selectedType?: string): { win: boolean; multiplier: number; winType: string } {
    // Если выбран конкретный тип, проверяем только его
    if (selectedType) {
      if (result[0] === selectedType && result[1] === selectedType && result[2] === selectedType) {
        const multiplier = this.MULTIPLIERS[selectedType as keyof typeof this.MULTIPLIERS] || 0;
        let winType = "";

        switch (selectedType) {
          case "🍋":
            winType = "Лимоны";
            break;
          case "🍇":
            winType = "Виноград";
            break;
          case "BAR":
            winType = "BAR";
            break;
          case "7️⃣":
            winType = "777";
            break;
        }

        return { win: true, multiplier, winType };
      }
      return { win: false, multiplier: 0, winType: "" };
    }

    // Старая логика - любые 3 одинаковых символа
    if (result[0] === result[1] && result[1] === result[2]) {
      const symbol = result[0];
      const multiplier = this.MULTIPLIERS[symbol as keyof typeof this.MULTIPLIERS] || 0;
      let winType = "";

      switch (symbol) {
        case "🍋":
          winType = "Лимоны";
          break;
        case "🍇":
          winType = "Виноград";
          break;
        case "BAR":
          winType = "BAR";
          break;
        case "7️⃣":
          winType = "777";
          break;
      }

      return { win: true, multiplier, winType };
    }

    return { win: false, multiplier: 0, winType: "" };
  }

  /**
   * Играть в слоты
   */
  static async playSlots(userId: number, betAmount: number, selectedType?: string): Promise<SlotResult> {
    if (betAmount <= 0) {
      throw new Error("Ставка должна быть больше 0");
    }

    // Проверяем баланс
    const balance = await BalanceModel.getBalance(userId);
    if (!balance || balance.balance < betAmount) {
      throw new Error("Недостаточно средств");
    }

    // Генерируем результат
    const result = await this.generateResult();
    const winCheck = this.checkWin(result, selectedType);

    let winAmount = 0;
    if (winCheck.win) {
      winAmount = betAmount * winCheck.multiplier;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Вычитаем ставку
      await client.query(
        "UPDATE balances SET balance = balance - $1 WHERE user_id = $2",
        [betAmount, userId]
      );

      // Если выигрыш, добавляем выигрыш
      if (winCheck.win) {
        await client.query(
          "UPDATE balances SET balance = balance + $1 WHERE user_id = $2",
          [winAmount, userId]
        );
      }

      // Получаем ID игры "Слоты"
      const gameResult = await client.query(
        "SELECT id FROM games WHERE type = 'slots' LIMIT 1"
      );
      const gameId = gameResult.rows[0]?.id;

      // Записываем в историю игр
      if (gameId) {
        await client.query(
          `INSERT INTO game_history (user_id, game_id, bet_amount, win_amount, result, is_win)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, gameId, betAmount, winAmount, result.join(" "), winCheck.win]
        );

        // Обновляем статистику пользователя
        await client.query(
          `INSERT INTO user_stats (user_id, total_games, total_wins, total_losses, total_bet_amount, total_win_amount, biggest_win, favorite_game_id)
           VALUES ($1, 1, $2, $3, $4, $5, $5, $6)
           ON CONFLICT (user_id)
           DO UPDATE SET
             total_games = user_stats.total_games + 1,
             total_wins = user_stats.total_wins + $2,
             total_losses = user_stats.total_losses + $3,
             total_bet_amount = user_stats.total_bet_amount + $4,
             total_win_amount = user_stats.total_win_amount + $5,
             biggest_win = GREATEST(user_stats.biggest_win, $5)`,
          [userId, winCheck.win ? 1 : 0, winCheck.win ? 0 : 1, betAmount, winAmount, gameId]
        );
      }

      await client.query("COMMIT");

      // Получаем новый баланс
      const newBalanceResult = await client.query(
        "SELECT balance FROM balances WHERE user_id = $1",
        [userId]
      );
      const newBalance = parseFloat(newBalanceResult.rows[0].balance);

      return {
        success: true,
        win: winCheck.win,
        result,
        betAmount,
        winAmount,
        newBalance,
        winType: winCheck.winType,
        multiplier: winCheck.multiplier,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
