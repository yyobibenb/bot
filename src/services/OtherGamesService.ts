import { GameModel } from "../models/Game";
import { BalanceModel } from "../models/Balance";
import pool from "../database/pool";

export interface GameResult {
  success: boolean;
  result: number | string;
  isWin: boolean;
  winAmount: number;
  newBalance: number;
  multiplier: number;
  details?: any;
}

export class OtherGamesService {
  // БОУЛИНГ 🎳
  // Telegram dice emoji для боулинга возвращает 1-6 (количество сбитых кеглей)

  static rollBowling(): number {
    return Math.floor(Math.random() * 6) + 1;
  }

  // Страйк (1.84x) - сбить все 6 кеглей
  static async playBowlingStrike(
    userId: number,
    betAmount: number
  ): Promise<GameResult> {
    const game = await GameModel.getGameById(2); // Боулинг
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(13); // Страйк (mode id 13)
    if (!gameMode) throw new Error("Game mode not found");

    const result = this.rollBowling();
    const isWin = result === 6; // Strike = все 6 кеглей
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;

    return this.processGame(
      userId,
      game.id,
      gameMode.id,
      betAmount,
      winAmount,
      result.toString(),
      "strike",
      isWin,
      multiplier,
      { pins: result }
    );
  }

  // Дуэль боулинга (1.84x)
  static async playBowlingDuel(
    userId: number,
    betAmount: number
  ): Promise<GameResult> {
    const game = await GameModel.getGameById(2);
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(14); // Дуэль
    if (!gameMode) throw new Error("Game mode not found");

    const userRoll = this.rollBowling();
    const casinoRoll = this.rollBowling();
    const isWin = userRoll > casinoRoll;
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;

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
      { userPins: userRoll, casinoPins: casinoRoll }
    );
  }

  // ФУТБОЛ ⚽
  // Telegram dice emoji для футбола: 1-5
  // 1,2 = мимо, 3 = попал в штангу, 4,5 = гол

  static rollFootball(): number {
    return Math.floor(Math.random() * 5) + 1;
  }

  // Гол (1.33x) - результат 4 или 5
  static async playFootballGoal(
    userId: number,
    betAmount: number
  ): Promise<GameResult> {
    const game = await GameModel.getGameById(3); // Футбол
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(15); // Гол
    if (!gameMode) throw new Error("Game mode not found");

    const result = this.rollFootball();
    const isWin = result >= 4; // 4 или 5 = гол
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;

    return this.processGame(
      userId,
      game.id,
      gameMode.id,
      betAmount,
      winAmount,
      result.toString(),
      "goal",
      isWin,
      multiplier,
      { score: result >= 4 ? "⚽ ГОЛ!" : result === 3 ? "🥅 Штанга" : "❌ Мимо" }
    );
  }

  // Мимо (1.84x) - результат 1 или 2
  static async playFootballMiss(
    userId: number,
    betAmount: number
  ): Promise<GameResult> {
    const game = await GameModel.getGameById(3);
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(16); // Мимо
    if (!gameMode) throw new Error("Game mode not found");

    const result = this.rollFootball();
    const isWin = result <= 2; // 1 или 2 = мимо
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;

    return this.processGame(
      userId,
      game.id,
      gameMode.id,
      betAmount,
      winAmount,
      result.toString(),
      "miss",
      isWin,
      multiplier,
      { score: result >= 4 ? "⚽ ГОЛ!" : result === 3 ? "🥅 Штанга" : "❌ Мимо" }
    );
  }

  // Дуэль футбола (1.84x)
  static async playFootballDuel(
    userId: number,
    betAmount: number
  ): Promise<GameResult> {
    const game = await GameModel.getGameById(3);
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(17); // Дуэль
    if (!gameMode) throw new Error("Game mode not found");

    const userKick = this.rollFootball();
    const casinoKick = this.rollFootball();
    const isWin = userKick > casinoKick;
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;

    return this.processGame(
      userId,
      game.id,
      gameMode.id,
      betAmount,
      winAmount,
      `${userKick} vs ${casinoKick}`,
      `user_${userKick}`,
      isWin,
      multiplier,
      { userKick, casinoKick }
    );
  }

  // БАСКЕТБОЛ 🏀
  // Telegram dice emoji для баскетбола: 1-5
  // 1,2,3 = мимо, 4,5 = попал

  static rollBasketball(): number {
    return Math.floor(Math.random() * 5) + 1;
  }

  // Гол/Попадание (1.84x) - результат 4 или 5
  static async playBasketballGoal(
    userId: number,
    betAmount: number
  ): Promise<GameResult> {
    const game = await GameModel.getGameById(4); // Баскетбол
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(18); // Гол
    if (!gameMode) throw new Error("Game mode not found");

    const result = this.rollBasketball();
    const isWin = result >= 4; // 4 или 5 = попал
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;

    return this.processGame(
      userId,
      game.id,
      gameMode.id,
      betAmount,
      winAmount,
      result.toString(),
      "goal",
      isWin,
      multiplier,
      { score: result >= 4 ? "🏀 Попал!" : "❌ Промах" }
    );
  }

  // Мимо/Промах (1.33x) - результат 1, 2 или 3
  static async playBasketballMiss(
    userId: number,
    betAmount: number
  ): Promise<GameResult> {
    const game = await GameModel.getGameById(4);
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(19); // Мимо
    if (!gameMode) throw new Error("Game mode not found");

    const result = this.rollBasketball();
    const isWin = result <= 3; // 1, 2 или 3 = промах
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;

    return this.processGame(
      userId,
      game.id,
      gameMode.id,
      betAmount,
      winAmount,
      result.toString(),
      "miss",
      isWin,
      multiplier,
      { score: result >= 4 ? "🏀 Попал!" : "❌ Промах" }
    );
  }

  // ДАРТС 🎯
  // Telegram dice emoji для дартса: 1-6
  // 1 = мимо, 2-5 = белое, 6 = центр/красное

  static rollDarts(): number {
    return Math.floor(Math.random() * 6) + 1;
  }

  // Красное/Центр (3.68x) - результат 6
  static async playDartsRed(
    userId: number,
    betAmount: number
  ): Promise<GameResult> {
    const game = await GameModel.getGameById(5); // Дартс
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(20); // Красное
    if (!gameMode) throw new Error("Game mode not found");

    const result = this.rollDarts();
    const isWin = result === 6;
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;

    return this.processGame(
      userId,
      game.id,
      gameMode.id,
      betAmount,
      winAmount,
      result.toString(),
      "red",
      isWin,
      multiplier,
      { zone: result === 6 ? "🎯 Центр!" : result === 1 ? "❌ Мимо" : "⚪ Белое" }
    );
  }

  // Белое (3.68x) - результат 2-5
  static async playDartsWhite(
    userId: number,
    betAmount: number
  ): Promise<GameResult> {
    const game = await GameModel.getGameById(5);
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(21); // Белое
    if (!gameMode) throw new Error("Game mode not found");

    const result = this.rollDarts();
    const isWin = result >= 2 && result <= 5;
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;

    return this.processGame(
      userId,
      game.id,
      gameMode.id,
      betAmount,
      winAmount,
      result.toString(),
      "white",
      isWin,
      multiplier,
      { zone: result === 6 ? "🎯 Центр!" : result === 1 ? "❌ Мимо" : "⚪ Белое" }
    );
  }

  // Середина (3.68x) - альтернативное название для центра
  static async playDartsCenter(
    userId: number,
    betAmount: number
  ): Promise<GameResult> {
    const game = await GameModel.getGameById(5);
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(22); // Середина
    if (!gameMode) throw new Error("Game mode not found");

    const result = this.rollDarts();
    const isWin = result === 6;
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;

    return this.processGame(
      userId,
      game.id,
      gameMode.id,
      betAmount,
      winAmount,
      result.toString(),
      "center",
      isWin,
      multiplier,
      { zone: result === 6 ? "🎯 Центр!" : result === 1 ? "❌ Мимо" : "⚪ Белое" }
    );
  }

  // Мимо (3.68x) - результат 1
  static async playDartsMiss(
    userId: number,
    betAmount: number
  ): Promise<GameResult> {
    const game = await GameModel.getGameById(5);
    if (!game) throw new Error("Game not found");

    const gameMode = await GameModel.getGameModeById(23); // Мимо
    if (!gameMode) throw new Error("Game mode not found");

    const result = this.rollDarts();
    const isWin = result === 1;
    const multiplier = gameMode.multiplier;
    const winAmount = isWin ? betAmount * multiplier : 0;

    return this.processGame(
      userId,
      game.id,
      gameMode.id,
      betAmount,
      winAmount,
      result.toString(),
      "miss",
      isWin,
      multiplier,
      { zone: result === 6 ? "🎯 Центр!" : result === 1 ? "❌ Мимо" : "⚪ Белое" }
    );
  }

  // Общая обработка результата игры
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
    details?: any
  ): Promise<GameResult> {
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

      // Начисляем выигрыш
      if (isWin && winAmount > 0) {
        await client.query(
          "UPDATE balances SET balance = balance + $1 WHERE user_id = $2",
          [winAmount, userId]
        );
      }

      // Записываем историю
      await client.query(
        `INSERT INTO game_history
         (user_id, game_id, game_mode_id, bet_amount, win_amount, result, user_choice, is_win)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, gameId, gameModeId, betAmount, winAmount, result, userChoice, isWin]
      );

      // Обновляем статистику
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

      const newBalance = await BalanceModel.getByUserId(userId);

      return {
        success: true,
        result: parseInt(result.split(" ")[0]) || result,
        isWin,
        winAmount,
        newBalance: newBalance ? parseFloat(newBalance.balance.toString()) : 0,
        multiplier,
        details
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
