import pool from "../database/pool";
import { BalanceModel } from "../models/Balance";

interface Duel {
  id: number;
  game_id: number;
  mode_name: string;
  room_code: string;
  creator_id: number;
  opponent_id: number | null;
  bet_amount: number;
  status: "waiting" | "in_progress" | "completed" | "cancelled";
  winner_id: number | null;
  creator_result: string | null;
  opponent_result: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export class DuelService {
  // Генерация уникального кода комнаты
  private static generateRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без I, O, 0, 1
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Создать комнату для дуэли
  static async createDuelRoom(
    creator_id: number,
    game_name: string,
    mode_name: string,
    bet_amount: number
  ): Promise<{ success: boolean; room_code?: string; error?: string; duel_id?: number }> {
    try {
      // Проверяем баланс
      const balance = await BalanceModel.getBalance(creator_id);
      if (!balance || balance.balance < bet_amount) {
        return { success: false, error: "Недостаточно средств" };
      }

      // Получаем game_id
      const gameResult = await pool.query("SELECT id FROM games WHERE name = $1", [game_name]);
      if (gameResult.rows.length === 0) {
        return { success: false, error: "Игра не найдена" };
      }
      const game_id = gameResult.rows[0].id;

      // Генерируем уникальный код комнаты
      let room_code = "";
      let attempts = 0;
      while (attempts < 10) {
        room_code = this.generateRoomCode();
        const existing = await pool.query("SELECT id FROM duels WHERE room_code = $1", [room_code]);
        if (existing.rows.length === 0) break;
        attempts++;
      }

      if (attempts >= 10) {
        return { success: false, error: "Не удалось создать комнату" };
      }

      // Списываем средства
      await BalanceModel.subtractBalance(creator_id, bet_amount);

      // Создаем дуэль
      const result = await pool.query(
        `INSERT INTO duels (game_id, mode_name, room_code, creator_id, bet_amount, status)
         VALUES ($1, $2, $3, $4, $5, 'waiting') RETURNING id`,
        [game_id, mode_name, room_code, creator_id, bet_amount]
      );

      return {
        success: true,
        room_code,
        duel_id: result.rows[0].id,
      };
    } catch (error: any) {
      console.error("Error creating duel room:", error);
      return { success: false, error: error.message };
    }
  }

  // Присоединиться к комнате
  static async joinDuelRoom(
    opponent_id: number,
    room_code: string
  ): Promise<{ success: boolean; duel?: Duel; error?: string }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Находим комнату
      const duelResult = await client.query(
        "SELECT * FROM duels WHERE room_code = $1 AND status = 'waiting' FOR UPDATE",
        [room_code.toUpperCase()]
      );

      if (duelResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return { success: false, error: "Комната не найдена или уже занята" };
      }

      const duel = duelResult.rows[0];

      // Проверяем что это не создатель
      if (duel.creator_id === opponent_id) {
        await client.query("ROLLBACK");
        return { success: false, error: "Вы не можете присоединиться к своей комнате" };
      }

      // Проверяем баланс
      const balance = await BalanceModel.getBalance(opponent_id);
      if (!balance || balance.balance < duel.bet_amount) {
        await client.query("ROLLBACK");
        return { success: false, error: "Недостаточно средств" };
      }

      // Списываем средства
      await BalanceModel.subtractBalance(opponent_id, duel.bet_amount);

      // Обновляем дуэль
      const updated = await client.query(
        `UPDATE duels SET opponent_id = $1, status = 'in_progress' WHERE id = $2 RETURNING *`,
        [opponent_id, duel.id]
      );

      await client.query("COMMIT");

      return { success: true, duel: updated.rows[0] };
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Error joining duel room:", error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  // Получить информацию о дуэли
  static async getDuel(duel_id: number): Promise<Duel | null> {
    try {
      const result = await pool.query("SELECT * FROM duels WHERE id = $1", [duel_id]);
      return result.rows[0] || null;
    } catch (error: any) {
      console.error("Error getting duel:", error);
      return null;
    }
  }

  // Получить дуэль по комнате
  static async getDuelByRoomCode(room_code: string): Promise<Duel | null> {
    try {
      const result = await pool.query("SELECT * FROM duels WHERE room_code = $1", [
        room_code.toUpperCase(),
      ]);
      return result.rows[0] || null;
    } catch (error: any) {
      console.error("Error getting duel by room code:", error);
      return null;
    }
  }

  // Сыграть в дуэли (для создателя или оппонента)
  static async playDuel(
    user_id: number,
    duel_id: number,
    result: any
  ): Promise<{ success: boolean; winner?: string; error?: string }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const duelResult = await client.query(
        "SELECT * FROM duels WHERE id = $1 FOR UPDATE",
        [duel_id]
      );

      if (duelResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return { success: false, error: "Дуэль не найдена" };
      }

      const duel = duelResult.rows[0];

      if (duel.status !== "in_progress") {
        await client.query("ROLLBACK");
        return { success: false, error: "Дуэль не активна" };
      }

      const isCreator = duel.creator_id === user_id;
      const isOpponent = duel.opponent_id === user_id;

      if (!isCreator && !isOpponent) {
        await client.query("ROLLBACK");
        return { success: false, error: "Вы не участвуете в этой дуэли" };
      }

      // Сохраняем результат
      const resultStr = JSON.stringify(result);
      if (isCreator) {
        if (duel.creator_result) {
          await client.query("ROLLBACK");
          return { success: false, error: "Вы уже сыграли" };
        }
        await client.query("UPDATE duels SET creator_result = $1 WHERE id = $2", [
          resultStr,
          duel_id,
        ]);
      } else {
        if (duel.opponent_result) {
          await client.query("ROLLBACK");
          return { success: false, error: "Вы уже сыграли" };
        }
        await client.query("UPDATE duels SET opponent_result = $1 WHERE id = $2", [
          resultStr,
          duel_id,
        ]);
      }

      // Обновляем дуэль
      const updatedDuel = await client.query("SELECT * FROM duels WHERE id = $1", [duel_id]);
      const updated = updatedDuel.rows[0];

      // Если оба сыграли - определяем победителя
      if (updated.creator_result && updated.opponent_result) {
        const creatorRes = JSON.parse(updated.creator_result);
        const opponentRes = JSON.parse(updated.opponent_result);

        let winner_id = null;
        const prize = updated.bet_amount * 2 * 0.95; // 5% комиссия

        // Логика определения победителя зависит от игры
        if (creatorRes.value > opponentRes.value) {
          winner_id = updated.creator_id;
        } else if (opponentRes.value > creatorRes.value) {
          winner_id = updated.opponent_id;
        } else {
          // Ничья - возвращаем ставки
          await BalanceModel.addBalance(updated.creator_id, updated.bet_amount);
          await BalanceModel.addBalance(updated.opponent_id, updated.bet_amount);
        }

        // Начисляем приз победителю
        if (winner_id) {
          await BalanceModel.addBalance(winner_id, prize);
        }

        // Завершаем дуэль
        await client.query(
          "UPDATE duels SET status = 'completed', winner_id = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2",
          [winner_id, duel_id]
        );

        await client.query("COMMIT");

        return {
          success: true,
          winner: winner_id === updated.creator_id ? "creator" : winner_id === updated.opponent_id ? "opponent" : "draw",
        };
      }

      await client.query("COMMIT");
      return { success: true };
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Error playing duel:", error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  // Отменить дуэль (если никто не присоединился)
  static async cancelDuel(creator_id: number, duel_id: number): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const duelResult = await client.query(
        "SELECT * FROM duels WHERE id = $1 FOR UPDATE",
        [duel_id]
      );

      if (duelResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return { success: false, error: "Дуэль не найдена" };
      }

      const duel = duelResult.rows[0];

      if (duel.creator_id !== creator_id) {
        await client.query("ROLLBACK");
        return { success: false, error: "Вы не создатель этой дуэли" };
      }

      if (duel.status !== "waiting") {
        await client.query("ROLLBACK");
        return { success: false, error: "Дуэль уже началась или завершена" };
      }

      // Возвращаем средства
      await BalanceModel.addBalance(creator_id, duel.bet_amount);

      // Отменяем дуэль
      await client.query("UPDATE duels SET status = 'cancelled' WHERE id = $1", [duel_id]);

      await client.query("COMMIT");
      return { success: true };
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Error cancelling duel:", error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  // Получить активные дуэли пользователя
  static async getUserDuels(user_id: number): Promise<Duel[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM duels
         WHERE (creator_id = $1 OR opponent_id = $1)
         AND status IN ('waiting', 'in_progress')
         ORDER BY created_at DESC`,
        [user_id]
      );
      return result.rows;
    } catch (error: any) {
      console.error("Error getting user duels:", error);
      return [];
    }
  }
}
