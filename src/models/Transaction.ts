import pool from "../database/pool";

export interface Transaction {
  id: number;
  user_id: number;
  type: "deposit" | "withdrawal";
  amount: number;
  status: "pending" | "approved" | "rejected" | "completed";
  crypto_address?: string;
  crypto_tx_hash?: string;
  moderator_id?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTransactionData {
  user_id: number;
  type: "deposit" | "withdrawal";
  amount: number;
  crypto_address?: string;
}

export class TransactionModel {
  static async create(data: CreateTransactionData): Promise<Transaction> {
    const result = await pool.query(
      `INSERT INTO transactions (user_id, type, amount, status, crypto_address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.user_id, data.type, data.amount, "pending", data.crypto_address || null]
    );
    return result.rows[0];
  }

  static async findById(id: number): Promise<Transaction | null> {
    const result = await pool.query(
      "SELECT * FROM transactions WHERE id = $1",
      [id]
    );
    return result.rows[0] || null;
  }

  static async getPendingWithdrawals(): Promise<Transaction[]> {
    const result = await pool.query(
      `SELECT t.*, u.first_name, u.username
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       WHERE t.type = 'withdrawal' AND t.status = 'pending' AND t.amount >= 10
       ORDER BY t.created_at ASC`
    );
    return result.rows;
  }

  static async updateStatus(
    id: number,
    status: Transaction["status"],
    moderatorId?: number
  ): Promise<Transaction> {
    const result = await pool.query(
      `UPDATE transactions
       SET status = $1, moderator_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, moderatorId || null, id]
    );
    return result.rows[0];
  }

  static async getUserTransactions(
    userId: number,
    limit: number = 50
  ): Promise<Transaction[]> {
    const result = await pool.query(
      `SELECT * FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  static async getTotalByType(
    type: "deposit" | "withdrawal",
    period: "day" | "month" = "month"
  ): Promise<number> {
    const interval = period === "day" ? "1 day" : "1 month";
    const result = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE type = $1 AND status = 'completed'
       AND created_at >= NOW() - INTERVAL '${interval}'`,
      [type]
    );
    return parseFloat(result.rows[0].total);
  }

  // Aliases for CryptoService
  static async createTransaction(
    userId: number,
    type: "deposit" | "withdrawal",
    amount: number,
    status: Transaction["status"] = "pending",
    cryptoAddress?: string
  ): Promise<Transaction> {
    const result = await pool.query(
      `INSERT INTO transactions (user_id, type, amount, status, crypto_address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, type, amount, status, cryptoAddress || null]
    );
    return result.rows[0];
  }

  static async getTransactionById(id: number): Promise<Transaction | null> {
    return this.findById(id);
  }

  static async updateTransactionStatus(
    id: number,
    status: Transaction["status"],
    txHash?: string,
    moderatorId?: number
  ): Promise<Transaction> {
    const result = await pool.query(
      `UPDATE transactions
       SET status = $1, crypto_tx_hash = $2, moderator_id = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, txHash || null, moderatorId || null, id]
    );
    return result.rows[0];
  }
}
