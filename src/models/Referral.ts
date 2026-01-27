import pool from "../database/pool";

export interface Referral {
  id: number;
  referrer_id: number;
  referred_id: number;
  commission_rate: number;
  total_earned: number;
  created_at: Date;
}

export interface ReferralStats {
  total_referrals: number;
  total_earned: number;
  referrals: Array<{
    user_id: number;
    username: string;
    first_name: string;
    total_deposited: number;
    created_at: Date;
  }>;
}

export class ReferralModel {
  static async create(
    referrerId: number,
    referredId: number,
    commissionRate: number = 5.0
  ): Promise<Referral> {
    const result = await pool.query(
      `INSERT INTO referrals (referrer_id, referred_id, commission_rate)
       VALUES ($1, $2, $3)
       ON CONFLICT (referred_id) DO NOTHING
       RETURNING *`,
      [referrerId, referredId, commissionRate]
    );
    return result.rows[0];
  }

  static async getReferralStats(referrerId: number): Promise<ReferralStats> {
    const result = await pool.query(
      `SELECT
         r.id,
         r.total_earned,
         u.id as user_id,
         u.username,
         u.first_name,
         b.total_deposited,
         r.created_at
       FROM referrals r
       JOIN users u ON r.referred_id = u.id
       LEFT JOIN balances b ON u.id = b.user_id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC`,
      [referrerId]
    );

    const totalEarned = await pool.query(
      "SELECT COALESCE(SUM(total_earned), 0) as total FROM referrals WHERE referrer_id = $1",
      [referrerId]
    );

    return {
      total_referrals: result.rows.length,
      total_earned: parseFloat(totalEarned.rows[0].total),
      referrals: result.rows.map((row) => ({
        user_id: row.user_id,
        username: row.username,
        first_name: row.first_name,
        total_deposited: parseFloat(row.total_deposited || 0),
        created_at: row.created_at,
      })),
    };
  }

  static async addEarning(
    referredId: number,
    transactionId: number,
    amount: number
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Найти реферальную связь
      const referral = await client.query(
        "SELECT id, referrer_id, commission_rate FROM referrals WHERE referred_id = $1",
        [referredId]
      );

      if (referral.rows.length === 0) {
        await client.query("ROLLBACK");
        return;
      }

      const { id: referralId, commission_rate } = referral.rows[0];
      const earnedAmount = (amount * commission_rate) / 100;

      // Добавить запись о заработке
      await client.query(
        "INSERT INTO referral_earnings (referral_id, transaction_id, amount) VALUES ($1, $2, $3)",
        [referralId, transactionId, earnedAmount]
      );

      // Обновить общий заработок
      await client.query(
        "UPDATE referrals SET total_earned = total_earned + $1 WHERE id = $2",
        [earnedAmount, referralId]
      );

      // Начислить на баланс реферера
      const referrerId = referral.rows[0].referrer_id;
      await client.query(
        "UPDATE balances SET balance = balance + $1 WHERE user_id = $2",
        [earnedAmount, referrerId]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
