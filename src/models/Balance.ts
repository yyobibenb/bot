import pool from "../database/pool";

export interface Balance {
  id: number;
  user_id: number;
  balance: number;
  total_deposited: number;
  total_withdrawn: number;
  updated_at: Date;
}

export class BalanceModel {
  static async getByUserId(userId: number): Promise<Balance | null> {
    const result = await pool.query(
      "SELECT * FROM balances WHERE user_id = $1",
      [userId]
    );
    return result.rows[0] || null;
  }

  static async createForUser(userId: number): Promise<Balance> {
    const result = await pool.query(
      `INSERT INTO balances (user_id, balance, total_deposited, total_withdrawn)
       VALUES ($1, 0.00, 0.00, 0.00)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING *`,
      [userId]
    );
    return result.rows[0] || (await this.getByUserId(userId))!;
  }

  static async updateBalance(
    userId: number,
    amount: number,
    isDeposit: boolean = false,
    isWithdrawal: boolean = false
  ): Promise<Balance> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let query = "UPDATE balances SET balance = balance + $1";
      const params: any[] = [amount, userId];

      if (isDeposit) {
        query += ", total_deposited = total_deposited + $3";
        params.push(amount);
      } else if (isWithdrawal) {
        query += ", total_withdrawn = total_withdrawn + $3";
        params.push(Math.abs(amount));
      }

      query += ", updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 RETURNING *";

      const result = await client.query(query, params);

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async hasEnoughBalance(
    userId: number,
    amount: number
  ): Promise<boolean> {
    const balance = await this.getByUserId(userId);
    return balance ? balance.balance >= amount : false;
  }
}
