import { GameModel } from "../models/Game";
import { BalanceModel } from "../models/Balance";
import { UserModel } from "../models/User";
import pool from "../database/pool";

export interface DiceGameResult {
  success: boolean;
  result: number; // 1-6
  isWin: boolean;
  winAmount: number;
  newBalance: number;
  multiplier: number;
  winType?: string;
}

export class DiceGameService {
  // Симуляция броска кубика с умным контролем результата для казино
  static async rollDice(desiredOutcome?: 'win' | 'loss', choice?: any, mode?: string): Promise<number> {
    // Проверяем настройки форсирования из админки
    const settings = await pool.query(
      "SELECT value FROM settings WHERE key = 'force_results_enabled'"
    );
    const forceEnabled = settings.rows[0]?.value === '1';

    if (forceEnabled) {
      // Проверяем процент форсированных проигрышей
      const lossRateQuery = await pool.query(
        "SELECT value FROM settings WHERE key = 'force_loss_rate'"
      );
      const lossRate = parseInt(lossRateQuery.rows[0]?.value || '0');

      // Проверяем включено ли форсирование для кубика
      const gamesQuery = await pool.query(
        "SELECT value FROM settings WHERE key = 'force_games'"
      );
      const games = JSON.parse(gamesQuery.rows[0]?.value || '{}');

      if (games.dice && Math.random() * 100 < lossRate) {
        // ФОРСИРУЕМ ПРОИГРЫШ - возвращаем результат который гарантированно проиграет
        console.log(`🎲 ФОРСИРОВАНИЕ АКТИВНО! Процент проигрышей: ${lossRate}%`);

        // В зависимости от режима игры, выбираем проигрышный результат
        if (mode === 'higher') {
          return Math.floor(Math.random() * 3) + 1; // 1, 2 или 3 (проигрыш для "больше 3")
        } else if (mode === 'lower') {
          return Math.floor(Math.random() * 2) + 4; // 4 или 5 (проигрыш для "меньше 4")
        } else if (choice && typeof choice === 'number') {
          // Для точного числа - вернуть любое кроме выбранного
          const losing = choice === 1 ? 6 : choice - 1;
          return losing;
        }

        // Дефолтный проигрыш
        return Math.random() < 0.5 ? 1 : 2;
      }
    }

    // Обычный случайный бросок
    return Math.floor(Math.random() * 6) + 1;
  }

  // Больше/Меньше (1.84x)
  static async playHigherLower(
    userId: number,
    betAmount: number,
    choice: "higher" | "lower"
  ): Promise<DiceGameResult> {
    const game = await GameModel.getGameById(1); // Кубик
    if (!game) throw new Error("Game not found");

    const gameMode = choice === "higher"
      ? await GameModel.getGameModeById(1) // Больше 3
      : await GameModel.getGameModeById(2); // Меньше 4

    if (!gameMode) throw new Error("Game mode not found");

    const result = await this.rollDice('loss', choice, choice); // Умный бросок с контролем
    const isWin = choice === "higher" ? result > 3 : result < 4;
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;
    const winType = isWin ? `🎲 ${result} - ${choice === "higher" ? "Больше 3" : "Меньше 4"}` : "";

    return this.processGame(userId, game.id, gameMode.id, betAmount, winAmount, result.toString(), choice, isWin, multiplier, winType);
  }

  // Четное/Нечетное (1.84x)
  static async playEvenOdd(
    userId: number,
    betAmount: number,
    choice: "even" | "odd"
  ): Promise<DiceGameResult> {
    const game = await GameModel.getGameById(1);
    if (!game) throw new Error("Game not found");

    const gameMode = choice === "even"
      ? await GameModel.getGameModeById(5) // Четное
      : await GameModel.getGameModeById(6); // Нечетное

    if (!gameMode) throw new Error("Game mode not found");

    const result = await this.rollDice();
    const isWin = choice === "even" ? result % 2 === 0 : result % 2 !== 0;
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;
    const winType = isWin ? `🎲 ${result} - ${choice === "even" ? "Четное" : "Нечетное"}` : "";

    return this.processGame(userId, game.id, gameMode.id, betAmount, winAmount, result.toString(), choice, isWin, multiplier, winType);
  }

  // Грань - угадать точное число (5.52x)
  static async playExactNumber(
    userId: number,
    betAmount: number,
    choice: number
  ): Promise<DiceGameResult> {
    if (choice < 1 || choice > 6) {
      throw new Error("Invalid choice. Must be between 1 and 6");
    }

    const game = await GameModel.getGameById(1);
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(12); // Грань
    if (!gameMode) throw new Error("Game mode not found");

    const result = await this.rollDice();
    const isWin = result === choice;
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;
    const winType = isWin ? `🎲 ${result} - Угадал грань!` : "";

    return this.processGame(userId, game.id, gameMode.id, betAmount, winAmount, result.toString(), choice.toString(), isWin, multiplier, winType);
  }

  // Сектор (2.76x)
  static async playSector(
    userId: number,
    betAmount: number,
    sector: 1 | 2 | 3
  ): Promise<DiceGameResult> {
    const game = await GameModel.getGameById(1);
    if (!game) throw new Error("Game not found");

    // Сектор 1 (id 8), Сектор 2 (id 9), Сектор 3 (id 10)
    const gameModeId = 7 + sector;
    const gameMode = await GameModel.getGameModeById(gameModeId);
    if (!gameMode) throw new Error("Game mode not found");

    const result = await this.rollDice();
    let isWin = false;

    if (sector === 1) isWin = result === 1 || result === 2;
    else if (sector === 2) isWin = result === 3 || result === 4;
    else if (sector === 3) isWin = result === 5 || result === 6;

    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;
    const winType = isWin ? `🎲 ${result} - Сектор ${sector}` : "";

    return this.processGame(userId, game.id, gameMode.id, betAmount, winAmount, result.toString(), `sector_${sector}`, isWin, multiplier, winType);
  }

  // Дуэль с казино (1.84x)
  static async playDuel(
    userId: number,
    betAmount: number
  ): Promise<DiceGameResult> {
    const game = await GameModel.getGameById(1);
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(11); // Дуэль
    if (!gameMode) throw new Error("Game mode not found");

    const userRoll = await this.rollDice();
    const casinoRoll = await this.rollDice();
    const isWin = userRoll > casinoRoll;
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;
    const winType = isWin ? `🎲 Дуэль: ${userRoll} vs ${casinoRoll}` : "";

    return this.processGame(
      userId,
      game.id,
      gameMode.id,
      betAmount,
      winAmount,
      `${userRoll} vs ${casinoRoll}`,
      `user_${userRoll}`,
      isWin,
      multiplier,
      winType
    );
  }

  // Больше/меньше 2X2 (3.68x) - нужно 2 раза подряд
  static async playDouble(
    userId: number,
    betAmount: number,
    choice: "higher" | "lower"
  ): Promise<{ rolls: number[]; result: DiceGameResult }> {
    const game = await GameModel.getGameById(1);
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(3); // Больше/меньше 2X2
    if (!gameMode) throw new Error("Game mode not found");

    const roll1 = await this.rollDice();
    const roll2 = await this.rollDice();

    let isWin = false;
    if (choice === "higher") {
      isWin = roll1 > 3 && roll2 > 3;
    } else {
      isWin = roll1 < 4 && roll2 < 4;
    }

    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;
    const winType = isWin ? `🎲 Двойная ${choice === "higher" ? "больше 3" : "меньше 4"}: ${roll1}, ${roll2}` : "";

    const result = await this.processGame(
      userId,
      game.id,
      gameMode.id,
      betAmount,
      winAmount,
      `${roll1}, ${roll2}`,
      `${choice}_2x`,
      isWin,
      multiplier,
      winType
    );

    return { rolls: [roll1, roll2], result };
  }

  // Больше/меньше 3X3 (5.52x) - нужно 3 раза подряд
  static async playTriple(
    userId: number,
    betAmount: number,
    choice: "higher" | "lower"
  ): Promise<{ rolls: number[]; result: DiceGameResult }> {
    const game = await GameModel.getGameById(1);
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(4); // Больше/меньше 3X3
    if (!gameMode) throw new Error("Game mode not found");

    const roll1 = await this.rollDice();
    const roll2 = await this.rollDice();
    const roll3 = await this.rollDice();

    let isWin = false;
    if (choice === "higher") {
      isWin = roll1 > 3 && roll2 > 3 && roll3 > 3;
    } else {
      isWin = roll1 < 4 && roll2 < 4 && roll3 < 4;
    }

    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;
    const winType = isWin ? `🎲 Тройная ${choice === "higher" ? "больше 3" : "меньше 4"}: ${roll1}, ${roll2}, ${roll3}` : "";

    const result = await this.processGame(
      userId,
      game.id,
      gameMode.id,
      betAmount,
      winAmount,
      `${roll1}, ${roll2}, ${roll3}`,
      `${choice}_3x`,
      isWin,
      multiplier,
      winType
    );

    return { rolls: [roll1, roll2, roll3], result };
  }

  // Подряд - угадать 3 числа подряд (5.52x)
  static async playSequence(
    userId: number,
    betAmount: number,
    choices: [number, number, number]
  ): Promise<{ rolls: number[]; result: DiceGameResult }> {
    if (choices.some(c => c < 1 || c > 6)) {
      throw new Error("Invalid choices. Must be between 1 and 6");
    }

    const game = await GameModel.getGameById(1);
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(7); // Подряд
    if (!gameMode) throw new Error("Game mode not found");

    const roll1 = await this.rollDice();
    const roll2 = await this.rollDice();
    const roll3 = await this.rollDice();

    const isWin = roll1 === choices[0] && roll2 === choices[1] && roll3 === choices[2];
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;
    const winType = isWin ? `🎲 Угадал последовательность: ${roll1}, ${roll2}, ${roll3}!` : "";

    const result = await this.processGame(
      userId,
      game.id,
      gameMode.id,
      betAmount,
      winAmount,
      `${roll1}, ${roll2}, ${roll3}`,
      choices.join(", "),
      isWin,
      multiplier,
      winType
    );

    return { rolls: [roll1, roll2, roll3], result };
  }

  // Обработка результата игры и обновление баланса
  private static async processGame(
    userId: number,
    gameId: number,
    gameModeId: number,
    betAmount: number,
    winAmount: number,
    result: string,
    userChoice: string,
    isWin: boolean,
    multiplier: number,
    winType?: string
  ): Promise<DiceGameResult> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Проверяем баланс
      const balance = await BalanceModel.getByUserId(userId);
      if (!balance || balance.balance < betAmount) {
        throw new Error("Insufficient balance");
      }

      // Списываем ставку
      await client.query(
        "UPDATE balances SET balance = balance - $1 WHERE user_id = $2",
        [betAmount, userId]
      );

      // Начисляем выигрыш, если есть
      if (isWin && winAmount > 0) {
        await client.query(
          "UPDATE balances SET balance = balance + $1 WHERE user_id = $2",
          [winAmount, userId]
        );
      }

      // Записываем историю игры
      await client.query(
        `INSERT INTO game_history
         (user_id, game_id, game_mode_id, bet_amount, win_amount, result, user_choice, is_win)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, gameId, gameModeId, betAmount, winAmount, result, userChoice, isWin]
      );

      // Обновляем статистику пользователя
      await client.query(
        `INSERT INTO user_stats (user_id, total_games, total_wins, total_losses, total_bet_amount, total_win_amount, biggest_win, favorite_game_id)
         VALUES ($1, 1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id)
         DO UPDATE SET
           total_games = user_stats.total_games + 1,
           total_wins = user_stats.total_wins + $2,
           total_losses = user_stats.total_losses + $3,
           total_bet_amount = user_stats.total_bet_amount + $4,
           total_win_amount = user_stats.total_win_amount + $5,
           biggest_win = GREATEST(user_stats.biggest_win, $6),
           updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          isWin ? 1 : 0,
          isWin ? 0 : 1,
          betAmount,
          winAmount,
          isWin ? winAmount : 0,
          gameId
        ]
      );

      await client.query("COMMIT");

      // Получаем новый баланс
      const newBalance = await BalanceModel.getByUserId(userId);

      return {
        success: true,
        result: parseInt(result.split(",")[0]) || parseInt(result),
        isWin,
        winAmount,
        newBalance: newBalance ? parseFloat(newBalance.balance.toString()) : 0,
        multiplier,
        winType
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
