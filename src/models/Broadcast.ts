import pool from "../database/pool";

export interface Broadcast {
  id: number;
  admin_id: number;
  message_text: string;
  media_url: string | null;
  media_type: string | null;
  total_sent: number;
  total_read: number;
  total_played: number;
  status: string;
  created_at: Date;
  sent_at: Date | null;
}

export interface BroadcastRecipient {
  id: number;
  broadcast_id: number;
  user_id: number;
  is_sent: boolean;
  is_read: boolean;
  sent_at: Date | null;
  read_at: Date | null;
}

export class BroadcastModel {
  /**
   * Создать новую рассылку
   */
  static async create(
    adminId: number,
    messageText: string,
    mediaUrl?: string,
    mediaType?: string
  ): Promise<Broadcast> {
    const result = await pool.query(
      `INSERT INTO broadcasts (admin_id, message_text, media_url, media_type, status)
       VALUES ($1, $2, $3, $4, 'draft')
       RETURNING *`,
      [adminId, messageText, mediaUrl || null, mediaType || null]
    );
    return result.rows[0];
  }

  /**
   * Получить рассылку по ID
   */
  static async getById(broadcastId: number): Promise<Broadcast | null> {
    const result = await pool.query(
      "SELECT * FROM broadcasts WHERE id = $1",
      [broadcastId]
    );
    return result.rows[0] || null;
  }

  /**
   * Получить все рассылки (с пагинацией)
   */
  static async getAll(limit: number = 50, offset: number = 0): Promise<Broadcast[]> {
    const result = await pool.query(
      `SELECT * FROM broadcasts
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  /**
   * Отправить рассылку всем пользователям
   */
  static async sendBroadcast(broadcastId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Получаем всех активных пользователей
      const usersResult = await client.query(
        "SELECT id FROM users WHERE is_blocked = false"
      );

      // Создаем записи для получателей
      for (const user of usersResult.rows) {
        await client.query(
          `INSERT INTO broadcast_recipients (broadcast_id, user_id, is_sent, is_read)
           VALUES ($1, $2, false, false)`,
          [broadcastId, user.id]
        );
      }

      // Обновляем статус рассылки
      await client.query(
        `UPDATE broadcasts
         SET status = 'sending', sent_at = NOW()
         WHERE id = $1`,
        [broadcastId]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Отметить сообщение как отправленное пользователю
   */
  static async markAsSent(broadcastId: number, userId: number): Promise<void> {
    await pool.query(
      `UPDATE broadcast_recipients
       SET is_sent = true, sent_at = NOW()
       WHERE broadcast_id = $1 AND user_id = $2`,
      [broadcastId, userId]
    );

    // Обновляем счетчик отправленных
    await pool.query(
      `UPDATE broadcasts
       SET total_sent = (
         SELECT COUNT(*) FROM broadcast_recipients
         WHERE broadcast_id = $1 AND is_sent = true
       )
       WHERE id = $1`,
      [broadcastId]
    );
  }

  /**
   * Отметить сообщение как прочитанное
   */
  static async markAsRead(broadcastId: number, userId: number): Promise<void> {
    await pool.query(
      `UPDATE broadcast_recipients
       SET is_read = true, read_at = NOW()
       WHERE broadcast_id = $1 AND user_id = $2`,
      [broadcastId, userId]
    );

    // Обновляем счетчик прочитанных
    await pool.query(
      `UPDATE broadcasts
       SET total_read = (
         SELECT COUNT(*) FROM broadcast_recipients
         WHERE broadcast_id = $1 AND is_read = true
       )
       WHERE id = $1`,
      [broadcastId]
    );
  }

  /**
   * Отметить что пользователь сыграл после рассылки
   */
  static async markAsPlayed(broadcastId: number, userId: number): Promise<void> {
    // Проверяем, был ли пользователь получателем этой рассылки
    const recipientResult = await pool.query(
      `SELECT id FROM broadcast_recipients
       WHERE broadcast_id = $1 AND user_id = $2 AND is_read = true`,
      [broadcastId, userId]
    );

    if (recipientResult.rows.length > 0) {
      // Обновляем счетчик сыгравших
      await pool.query(
        `UPDATE broadcasts
         SET total_played = total_played + 1
         WHERE id = $1`,
        [broadcastId]
      );
    }
  }

  /**
   * Завершить рассылку
   */
  static async completeBroadcast(broadcastId: number): Promise<void> {
    await pool.query(
      `UPDATE broadcasts
       SET status = 'completed'
       WHERE id = $1`,
      [broadcastId]
    );
  }

  /**
   * Получить статистику рассылки
   */
  static async getStats(broadcastId: number): Promise<{
    total_recipients: number;
    total_sent: number;
    total_read: number;
    total_played: number;
    read_rate: number;
    play_rate: number;
  }> {
    const result = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM broadcast_recipients WHERE broadcast_id = $1) as total_recipients,
        b.total_sent,
        b.total_read,
        b.total_played
       FROM broadcasts b
       WHERE b.id = $1`,
      [broadcastId]
    );

    const row = result.rows[0];

    const totalRecipients = parseInt(row.total_recipients) || 0;
    const totalSent = parseInt(row.total_sent) || 0;
    const totalRead = parseInt(row.total_read) || 0;
    const totalPlayed = parseInt(row.total_played) || 0;

    return {
      total_recipients: totalRecipients,
      total_sent: totalSent,
      total_read: totalRead,
      total_played: totalPlayed,
      read_rate: totalSent > 0 ? (totalRead / totalSent) * 100 : 0,
      play_rate: totalRead > 0 ? (totalPlayed / totalRead) * 100 : 0,
    };
  }
}
