import pool from "../database/pool";

export interface User {
  id: number;
  telegram_id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  language_code?: string;
  is_premium: boolean;
  is_blocked: boolean;
  referrer_id?: number;
  created_at: Date;
  last_activity: Date;
}

export interface CreateUserData {
  telegram_id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  language_code?: string;
  is_premium?: boolean;
  referrer_id?: number;
}

export class UserModel {
  static async findByTelegramId(telegramId: number): Promise<User | null> {
    const result = await pool.query(
      "SELECT * FROM users WHERE telegram_id = $1",
      [telegramId]
    );
    return result.rows[0] || null;
  }

  static async findById(id: number): Promise<User | null> {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  static async create(data: CreateUserData): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (telegram_id, username, first_name, last_name, language_code, is_premium, referrer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.telegram_id,
        data.username || null,
        data.first_name,
        data.last_name || null,
        data.language_code || null,
        data.is_premium || false,
        data.referrer_id || null,
      ]
    );
    return result.rows[0];
  }

  static async createOrUpdate(data: CreateUserData): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (telegram_id, username, first_name, last_name, language_code, is_premium, referrer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (telegram_id)
       DO UPDATE SET
         username = EXCLUDED.username,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         language_code = EXCLUDED.language_code,
         is_premium = EXCLUDED.is_premium,
         last_activity = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        data.telegram_id,
        data.username || null,
        data.first_name,
        data.last_name || null,
        data.language_code || null,
        data.is_premium || false,
        data.referrer_id || null,
      ]
    );
    return result.rows[0];
  }

  static async updateLastActivity(userId: number): Promise<void> {
    await pool.query(
      "UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1",
      [userId]
    );
  }

  static async blockUser(userId: number): Promise<void> {
    await pool.query("UPDATE users SET is_blocked = true WHERE id = $1", [
      userId,
    ]);
  }

  static async unblockUser(userId: number): Promise<void> {
    await pool.query("UPDATE users SET is_blocked = false WHERE id = $1", [
      userId,
    ]);
  }

  static async getTotalUsers(): Promise<number> {
    const result = await pool.query("SELECT COUNT(*) as count FROM users");
    return parseInt(result.rows[0].count);
  }

  static async getUsersWithDeposits(): Promise<number> {
    const result = await pool.query(
      "SELECT COUNT(DISTINCT user_id) as count FROM transactions WHERE type = 'deposit' AND status = 'completed'"
    );
    return parseInt(result.rows[0].count);
  }
}
