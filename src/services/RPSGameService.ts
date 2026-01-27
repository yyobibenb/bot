import { BalanceModel } from "../models/Balance";
import { GameModel } from "../models/Game";
import pool from "../database/pool";

type RPSChoice = "rock" | "paper" | "scissors" | "random";

interface RPSResult {
  success: boolean;
  win: boolean;
  draw: boolean;
  userChoice: string;
  botChoice: string;
  betAmount: number;
  winAmount: number;
  newBalance: number;
  result: string;
  winType?: string;
  multiplier?: number;
}

export class RPSGameService {
  private static readonly CHOICES = ["rock", "paper", "scissors"];
  private static readonly CHOICE_EMOJIS = {
    rock: "🪨",
    paper: "📄",
    scissors: "✂️",
  };
  private static readonly MULTIPLIER = 2.76;
  private static readonly RTP = 0.92;

  /**
   * Определяет победителя
   */
  private static determineWinner(userChoice: string, botChoice: string): "win" | "lose" | "draw" {
    if (userChoice === botChoice) return "draw";

    if (
      (userChoice === "rock" && botChoice === "scissors") ||
      (userChoice === "scissors" && botChoice === "paper") ||
      (userChoice === "paper" && botChoice === "rock")
    ) {
      return "win";
    }

    return "lose";
  }

  /**
   * Генерирует выбор бота с учетом RTP
   */
  private static async generateBotChoice(userChoice: string): Promise<string> {
    const settings = await pool.query(
      "SELECT value FROM settings WHERE key = 'global_rtp'"
    );
    const rtp = settings.rows[0]?.value ? parseFloat(settings.rows[0].value) : this.RTP;

    // RTP проверка: иногда даем игроку выиграть
    const rtpCheck = Math.random();

    if (rtpCheck < (rtp - 0.60)) {
      // Бот проигрывает
      switch (userChoice) {
        case "rock":
          return "scissors";
        case "paper":
          return "rock";
        case "scissors":
          return "paper";
        default:
          return this.CHOICES[Math.floor(Math.random() * this.CHOICES.length)];
      }
    } else if (rtpCheck > rtp) {
      // Бот выигрывает
      switch (userChoice) {
        case "rock":
          return "paper";
        case "paper":
          return "scissors";
        case "scissors":
          return "rock";
        default:
          return this.CHOICES[Math.floor(Math.random() * this.CHOICES.length)];
      }
    } else {
      // Случайный выбор (может быть ничья)
      return this.CHOICES[Math.floor(Math.random() * this.CHOICES.length)];
    }
  }

  /**
   * Играть в камень-ножницы-бумагу
   */
  static async playRPS(
    userId: number,
    betAmount: number,
    choice: RPSChoice
  ): Promise<RPSResult> {
    if (betAmount <= 0) {
      throw new Error("Ставка должна быть больше 0");
    }

    // Проверяем баланс
    const balance = await BalanceModel.getBalance(userId);
    if (!balance || balance.balance < betAmount) {
      throw new Error("Недостаточно средств");
    }

    // Обрабатываем случайный выбор
    let userChoice = choice;
    if (choice === "random") {
      userChoice = this.CHOICES[Math.floor(Math.random() * this.CHOICES.length)] as RPSChoice;
    }

    // Генерируем выбор бота
    const botChoice = await this.generateBotChoice(userChoice);

    // Определяем результат
    const result = this.determineWinner(userChoice, botChoice);

    let winAmount = 0;
    const isDraw = result === "draw";
    const isWin = result === "win";

    if (isWin) {
      winAmount = betAmount * this.MULTIPLIER;
    } else if (isDraw) {
      winAmount = betAmount; // Возврат ставки
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Вычитаем ставку
      await client.query(
        "UPDATE balances SET balance = balance - $1 WHERE user_id = $2",
        [betAmount, userId]
      );

      // Если выигрыш или ничья, добавляем выигрыш
      if (isWin || isDraw) {
        await client.query(
          "UPDATE balances SET balance = balance + $1 WHERE user_id = $2",
          [winAmount, userId]
        );
      }

      // Получаем ID игры "Камень-Ножницы-Бумага"
      const gameResult = await client.query(
        "SELECT id FROM games WHERE type = 'rps' LIMIT 1"
      );
      const gameId = gameResult.rows[0]?.id;

      // Записываем в историю игр
      if (gameId) {
        const gameResultStr = isDraw ? "Ничья" : isWin ? "Победа" : "Поражение";
        await client.query(
          `INSERT INTO game_history (user_id, game_id, bet_amount, win_amount, result, user_choice, is_win)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            userId,
            gameId,
            betAmount,
            winAmount,
            `${this.CHOICE_EMOJIS[userChoice as keyof typeof this.CHOICE_EMOJIS]} vs ${this.CHOICE_EMOJIS[botChoice as keyof typeof this.CHOICE_EMOJIS]} - ${gameResultStr}`,
            `${userChoice}:${botChoice}`,
            isWin,
          ]
        );

        // Обновляем статистику пользователя
        await client.query(
          `INSERT INTO user_stats (user_id, total_games, total_wins, total_losses, total_bet_amount, total_win_amount, biggest_win, favorite_game_id)
           VALUES ($1, 1, $2, $3, $4, $5, $5, $6)
           ON CONFLICT (user_id)
           DO UPDATE SET
             total_games = user_stats.total_games + 1,
             total_wins = user_stats.total_wins + $2,
             total_losses = user_stats.total_losses + $3,
             total_bet_amount = user_stats.total_bet_amount + $4,
             total_win_amount = user_stats.total_win_amount + $5,
             biggest_win = GREATEST(user_stats.biggest_win, $5)`,
          [userId, isWin ? 1 : 0, isWin || isDraw ? 0 : 1, betAmount, winAmount, gameId]
        );
      }

      await client.query("COMMIT");

      // Получаем новый баланс
      const newBalanceResult = await client.query(
        "SELECT balance FROM balances WHERE user_id = $1",
        [userId]
      );
      const newBalance = parseFloat(newBalanceResult.rows[0].balance);

      // Генерируем winType
      let winType = "";
      if (isWin) {
        winType = `🪨 ${userChoice === "rock" ? "Камень" : userChoice === "paper" ? "Бумага" : "Ножницы"} победил!`;
      } else if (isDraw) {
        winType = "🤝 Ничья - ставка возвращена";
      }

      return {
        success: true,
        win: isWin,
        draw: isDraw,
        userChoice: `${this.CHOICE_EMOJIS[userChoice as keyof typeof this.CHOICE_EMOJIS]} ${userChoice}`,
        botChoice: `${this.CHOICE_EMOJIS[botChoice as keyof typeof this.CHOICE_EMOJIS]} ${botChoice}`,
        betAmount,
        winAmount,
        newBalance,
        result: isDraw ? "draw" : isWin ? "win" : "lose",
        winType,
        multiplier: this.MULTIPLIER
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
