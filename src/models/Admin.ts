import pool from "../database/pool";

export interface Admin {
  id: number;
  user_id: number;
  role: string;
  permissions: {
    manage_users: boolean;
    manage_withdrawals: boolean;
    manage_settings: boolean;
    view_stats: boolean;
  };
  created_at: Date;
}

export class AdminModel {
  static async isAdmin(userId: number): Promise<boolean> {
    const result = await pool.query(
      "SELECT id FROM admins WHERE user_id = $1",
      [userId]
    );
    return result.rows.length > 0;
  }

  static async getAdminByUserId(userId: number): Promise<Admin | null> {
    const result = await pool.query(
      "SELECT * FROM admins WHERE user_id = $1",
      [userId]
    );
    return result.rows[0] || null;
  }

  static async hasPermission(
    userId: number,
    permission: string
  ): Promise<boolean> {
    const admin = await this.getAdminByUserId(userId);
    if (!admin) return false;

    const permissions = admin.permissions as any;
    return permissions[permission] === true;
  }
}
