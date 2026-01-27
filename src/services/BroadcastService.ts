import TelegramBot from "node-telegram-bot-api";
import { BroadcastModel } from "../models/Broadcast";
import { UserModel } from "../models/User";
import pool from "../database/pool";

export class BroadcastService {
  private bot: TelegramBot;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  /**
   * Отправить рассылку всем пользователям
   */
  async sendBroadcastToUsers(broadcastId: number): Promise<{
    success: boolean;
    sent: number;
    failed: number;
    errors: string[];
  }> {
    const broadcast = await BroadcastModel.getById(broadcastId);

    if (!broadcast) {
      throw new Error("Broadcast not found");
    }

    if (broadcast.status !== "sending") {
      throw new Error("Broadcast is not in sending status");
    }

    // Получаем всех получателей, которым еще не отправлено
    const recipientsResult = await pool.query(
      `SELECT br.id, br.user_id, u.telegram_id, u.first_name
       FROM broadcast_recipients br
       JOIN users u ON br.user_id = u.id
       WHERE br.broadcast_id = $1 AND br.is_sent = false AND u.is_blocked = false
       LIMIT 100`,
      [broadcastId]
    );

    const recipients = recipientsResult.rows;
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      try {
        // Подготавливаем сообщение
        const messageOptions: any = {
          parse_mode: "Markdown",
        };

        // Если есть медиа, отправляем с медиа
        if (broadcast.media_url && broadcast.media_type) {
          if (broadcast.media_type === "photo") {
            await this.bot.sendPhoto(
              recipient.telegram_id,
              broadcast.media_url,
              {
                caption: broadcast.message_text,
                parse_mode: "Markdown",
              }
            );
          } else if (broadcast.media_type === "video") {
            await this.bot.sendVideo(
              recipient.telegram_id,
              broadcast.media_url,
              {
                caption: broadcast.message_text,
                parse_mode: "Markdown",
              }
            );
          } else {
            // Для других типов медиа просто отправляем текст
            await this.bot.sendMessage(
              recipient.telegram_id,
              broadcast.message_text,
              messageOptions
            );
          }
        } else {
          // Отправляем только текст
          await this.bot.sendMessage(
            recipient.telegram_id,
            broadcast.message_text,
            messageOptions
          );
        }

        // Отмечаем как отправленное
        await BroadcastModel.markAsSent(broadcastId, recipient.user_id);
        sent++;

        // Задержка между отправками (anti-flood)
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error: any) {
        failed++;
        errors.push(
          `User ${recipient.telegram_id} (${recipient.first_name}): ${error.message}`
        );

        // Если пользователь заблокировал бота, отмечаем его как заблокированного
        if (
          error.message.includes("bot was blocked") ||
          error.message.includes("user is deactivated")
        ) {
          await UserModel.updateUser(recipient.user_id, { is_blocked: true });
        }

        // Все равно отмечаем как "отправленное" чтобы не пытаться снова
        await BroadcastModel.markAsSent(broadcastId, recipient.user_id);
      }
    }

    // Если все отправлено, завершаем рассылку
    const remainingResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM broadcast_recipients
       WHERE broadcast_id = $1 AND is_sent = false`,
      [broadcastId]
    );

    if (parseInt(remainingResult.rows[0].count) === 0) {
      await BroadcastModel.completeBroadcast(broadcastId);
    }

    return {
      success: true,
      sent,
      failed,
      errors: errors.slice(0, 10), // Возвращаем только первые 10 ошибок
    };
  }

  /**
   * Запустить рассылку в фоновом режиме
   */
  async startBroadcast(broadcastId: number): Promise<void> {
    // Отправляем первую партию
    await this.sendBroadcastToUsers(broadcastId);

    // Продолжаем отправку пока есть неотправленные
    const checkAndSend = async () => {
      const broadcast = await BroadcastModel.getById(broadcastId);

      if (!broadcast || broadcast.status === "completed") {
        return;
      }

      const remainingResult = await pool.query(
        `SELECT COUNT(*) as count
         FROM broadcast_recipients
         WHERE broadcast_id = $1 AND is_sent = false`,
        [broadcastId]
      );

      if (parseInt(remainingResult.rows[0].count) > 0) {
        await this.sendBroadcastToUsers(broadcastId);
        // Запускаем следующую партию через 5 секунд
        setTimeout(checkAndSend, 5000);
      }
    };

    // Запускаем следующую партию через 5 секунд
    setTimeout(checkAndSend, 5000);
  }
}
