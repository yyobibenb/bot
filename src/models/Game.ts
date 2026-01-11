import pool from "../database/pool";

export interface Game {
  id: number;
  name: string;
  type: string;
  is_active: boolean;
  rtp: number;
  created_at: Date;
}

export interface GameMode {
  id: number;
  game_id: number;
  name: string;
  multiplier: number;
  description?: string;
  is_active: boolean;
}

export interface GameHistory {
  id: number;
  user_id: number;
  game_id: number;
  game_mode_id: number;
  bet_amount: number;
  win_amount: number;
  result: string;
  user_choice: string;
  is_win: boolean;
  is_duel: boolean;
  opponent_id?: number;
  played_at: Date;
}

export interface CreateGameHistoryData {
  user_id: number;
  game_id: number;
  game_mode_id: number;
  bet_amount: number;
  win_amount: number;
  result: string;
  user_choice: string;
  is_win: boolean;
  is_duel?: boolean;
  opponent_id?: number;
}

export class GameModel {
  static async getAllGames(): Promise<Game[]> {
    const result = await pool.query(
      "SELECT * FROM games WHERE is_active = true ORDER BY id"
    );
    return result.rows;
  }

  static async getGameById(id: number): Promise<Game | null> {
    const result = await pool.query("SELECT * FROM games WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  static async getGameModes(gameId: number): Promise<GameMode[]> {
    const result = await pool.query(
      "SELECT * FROM game_modes WHERE game_id = $1 AND is_active = true ORDER BY id",
      [gameId]
    );
    return result.rows;
  }

  static async getGameModeById(id: number): Promise<GameMode | null> {
    const result = await pool.query("SELECT * FROM game_modes WHERE id = $1", [
      id,
    ]);
    return result.rows[0] || null;
  }

  static async createGameHistory(
    data: CreateGameHistoryData
  ): Promise<GameHistory> {
    const result = await pool.query(
      `INSERT INTO game_history
       (user_id, game_id, game_mode_id, bet_amount, win_amount, result, user_choice, is_win, is_duel, opponent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.user_id,
        data.game_id,
        data.game_mode_id,
        data.bet_amount,
        data.win_amount,
        data.result,
        data.user_choice,
        data.is_win,
        data.is_duel || false,
        data.opponent_id || null,
      ]
    );
    return result.rows[0];
  }

  static async getUserGameHistory(
    userId: number,
    limit: number = 50
  ): Promise<GameHistory[]> {
    const result = await pool.query(
      `SELECT gh.*, g.name as game_name, gm.name as mode_name
       FROM game_history gh
       JOIN games g ON gh.game_id = g.id
       JOIN game_modes gm ON gh.game_mode_id = gm.id
       WHERE gh.user_id = $1
       ORDER BY gh.played_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  static async getGameStats(
    gameId: number,
    period: "day" | "month" = "month"
  ): Promise<{ total_games: number; total_wins: number; total_losses: number }> {
    const interval = period === "day" ? "1 day" : "1 month";
    const result = await pool.query(
      `SELECT
         COUNT(*) as total_games,
         SUM(CASE WHEN is_win THEN 1 ELSE 0 END) as total_wins,
         SUM(CASE WHEN NOT is_win THEN 1 ELSE 0 END) as total_losses
       FROM game_history
       WHERE game_id = $1
       AND played_at >= NOW() - INTERVAL '${interval}'`,
      [gameId]
    );
    return result.rows[0];
  }

  static async updateRTP(gameId: number, rtp: number): Promise<void> {
    await pool.query("UPDATE games SET rtp = $1 WHERE id = $2", [rtp, gameId]);
  }
}
