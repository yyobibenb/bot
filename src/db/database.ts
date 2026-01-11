import pkg from "pg";
const { Pool } = pkg;

export interface User {
  telegram_id: string;
  username: string;
  wallet_address: string;
  encrypted_private_key: string;
  encrypted_seed_phrase: string;
  pin_hash: string;
  created_at: Date;
  average_rating: number;
  ratings_count: number;
  is_admin: boolean;
  is_arbitrator: boolean;
  frozen_amount: number;
  is_blocked: boolean;
  blocked_at: Date | null;
  blocked_seed_phrase: string | null;
}

export interface DealRating {
  id: number;
  deal_id: string;
  reviewer_telegram_id: string;
  reviewee_telegram_id: string;
  score: number;
  comment: string | null;
  created_at: Date;
}

export interface Deal {
  id: string;
  seller_telegram_id: string | null;
  seller_username: string | null;
  buyer_telegram_id: string | null;
  buyer_username: string | null;
  amount: number;
  description: string;
  status: "created" | "awaiting_payment" | "payment_confirmed" | "buyer_confirmed" | "completed" | "cancelled" | "in_arbitration" | "arbitration_resolved";
  deal_wallet_address: string;
  encrypted_deal_private_key: string;
  encrypted_deal_seed: string;
  created_at: Date;
  completed_at: Date | null;
  creator_role: "seller" | "buyer";
  payment_notified: boolean;
  buyer_confirmed_payment: boolean;
  arbitration_id: number | null;
}

export interface Arbitration {
  id: number;
  deal_id: string;
  requested_by: string;
  request_message: string;
  status: "pending" | "assigned" | "resolved" | "cancelled";
  assigned_to: string | null;
  assigned_at: Date | null;
  resolution: "seller" | "buyer" | "split" | null;
  resolution_notes: string | null;
  resolved_at: Date | null;
  created_at: Date;
}

export interface P2POrder {
  id: string;
  creator_telegram_id: string;
  creator_username: string;
  order_type: "buy" | "sell";
  crypto_amount: number;
  fiat_amount: number;
  rate: number;
  min_amount: number;
  max_amount: number;
  payment_details: string;
  status: "active" | "paused" | "completed" | "cancelled";
  created_at: Date;
  updated_at: Date;
}

export interface P2PDeal {
  id: string;
  order_id: string;
  seller_telegram_id: string;
  seller_username: string;
  buyer_telegram_id: string;
  buyer_username: string;
  crypto_amount: number;
  fiat_amount: number;
  rate: number;
  payment_details: string;
  deal_wallet_address: string;
  encrypted_deal_private_key: string;
  encrypted_deal_seed: string;
  status: "created" | "crypto_deposited" | "fiat_sent" | "fiat_confirmed" | "completed" | "cancelled" | "disputed";
  crypto_tx_hash: string | null;
  payment_proof_image: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export interface P2PMessage {
  id: number;
  deal_id: string;
  sender_telegram_id: string;
  sender_username: string;
  message: string;
  created_at: Date;
}

export interface P2PArbitration {
  id: number;
  deal_id: string;
  requested_by: string;
  request_message: string;
  status: "pending" | "assigned" | "resolved" | "cancelled";
  assigned_to: string | null;
  assigned_at: Date | null;
  resolution: "seller" | "buyer" | "split" | null;
  resolution_notes: string | null;
  resolved_at: Date | null;
  created_at: Date;
}

export class Database {
  private pool: any = null;

  private getPool() {
    if (!this.pool) {
      const connectionString = process.env.DATABASE_URL;
      // Use PGHOST vars if available (Replit secrets), even if DATABASE_URL exists but points to localhost
      if (process.env.PGHOST && !process.env.PGHOST.includes('localhost')) {
        this.pool = new Pool({
          host: process.env.PGHOST,
          port: parseInt(process.env.PGPORT || '5432'),
          user: process.env.PGUSER || 'postgres',
          password: process.env.PGPASSWORD || 'postgres',
          database: process.env.PGDATABASE || 'postgres',
          ssl: { rejectUnauthorized: false }
        });
      } else if (connectionString && !connectionString.includes('localhost')) {
        this.pool = new Pool({
          connectionString,
          ssl: { rejectUnauthorized: false }
        });
      } else {
        this.pool = new Pool({
          host: process.env.PGHOST || 'localhost',
          port: parseInt(process.env.PGPORT || '5432'),
          user: process.env.PGUSER || 'postgres',
          password: process.env.PGPASSWORD || 'postgres',
          database: process.env.PGDATABASE || 'postgres',
        });
      }
    }
    return this.pool;
  }

  isConfigured(): boolean {
    const pgHost = process.env.PGHOST;
    const dbUrl = process.env.DATABASE_URL;
    return !!((pgHost && !pgHost.includes('localhost')) || (dbUrl && !dbUrl.includes('localhost')));
  }

  async init() {
    const client = await this.getPool().connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          telegram_id VARCHAR(255) PRIMARY KEY,
          username VARCHAR(255) NOT NULL,
          wallet_address VARCHAR(255) NOT NULL,
          encrypted_private_key TEXT NOT NULL,
          encrypted_seed_phrase TEXT NOT NULL,
          pin_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS deals (
          id VARCHAR(255) PRIMARY KEY,
          seller_telegram_id VARCHAR(255),
          seller_username VARCHAR(255),
          buyer_telegram_id VARCHAR(255),
          buyer_username VARCHAR(255),
          amount DECIMAL(20, 6) NOT NULL,
          description TEXT NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'created',
          deal_wallet_address VARCHAR(255) NOT NULL,
          encrypted_deal_private_key TEXT NOT NULL,
          encrypted_deal_seed TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          creator_role VARCHAR(20) DEFAULT 'seller',
          FOREIGN KEY (seller_telegram_id) REFERENCES users(telegram_id),
          FOREIGN KEY (buyer_telegram_id) REFERENCES users(telegram_id)
        );
      `);
      
      await client.query(`
        ALTER TABLE deals ADD COLUMN IF NOT EXISTS seller_username VARCHAR(255);
        ALTER TABLE deals ADD COLUMN IF NOT EXISTS buyer_username VARCHAR(255);
        ALTER TABLE deals ADD COLUMN IF NOT EXISTS creator_role VARCHAR(20) DEFAULT 'seller';
        ALTER TABLE deals ADD COLUMN IF NOT EXISTS payment_notified BOOLEAN DEFAULT FALSE;
        ALTER TABLE deals ADD COLUMN IF NOT EXISTS buyer_confirmed_payment BOOLEAN DEFAULT FALSE;
      `);
      
      // Add rating fields to users table
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS ratings_count INT DEFAULT 0;
      `);
      
      // Create deal_ratings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS deal_ratings (
          id SERIAL PRIMARY KEY,
          deal_id VARCHAR(255) NOT NULL REFERENCES deals(id),
          reviewer_telegram_id VARCHAR(255) NOT NULL REFERENCES users(telegram_id),
          reviewee_telegram_id VARCHAR(255) NOT NULL REFERENCES users(telegram_id),
          score INT NOT NULL CHECK (score >= 1 AND score <= 5),
          comment TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(deal_id, reviewer_telegram_id)
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_deals_seller ON deals(seller_telegram_id);
        CREATE INDEX IF NOT EXISTS idx_deals_buyer ON deals(buyer_telegram_id);
        CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
        CREATE INDEX IF NOT EXISTS idx_ratings_reviewee ON deal_ratings(reviewee_telegram_id);
      `);
      
      // Add admin and arbitrator fields to users
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_arbitrator BOOLEAN DEFAULT FALSE;
      `);
      
      // Add arbitration_id to deals
      await client.query(`
        ALTER TABLE deals ADD COLUMN IF NOT EXISTS arbitration_id INT;
      `);
      
      // Create arbitrations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS arbitrations (
          id SERIAL PRIMARY KEY,
          deal_id VARCHAR(255) NOT NULL REFERENCES deals(id),
          requested_by VARCHAR(255) NOT NULL REFERENCES users(telegram_id),
          request_message TEXT NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          assigned_to VARCHAR(255) REFERENCES users(telegram_id),
          assigned_at TIMESTAMP,
          resolution VARCHAR(20),
          resolution_notes TEXT,
          resolved_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_arbitrations_status ON arbitrations(status);
        CREATE INDEX IF NOT EXISTS idx_arbitrations_assigned ON arbitrations(assigned_to);
        CREATE INDEX IF NOT EXISTS idx_arbitrations_deal ON arbitrations(deal_id);
      `);
      
      // Set initial admin (telegram_id: 5855297931)
      await client.query(`
        UPDATE users SET is_admin = TRUE, is_arbitrator = TRUE 
        WHERE telegram_id = '5855297931';
      `);
      
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_details TEXT DEFAULT NULL;
      `);
      
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS frozen_amount DECIMAL(20, 6) DEFAULT 0;
      `);
      
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_seed_phrase TEXT;
      `);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS p2p_orders (
          id VARCHAR(255) PRIMARY KEY,
          creator_telegram_id VARCHAR(255) NOT NULL REFERENCES users(telegram_id),
          creator_username VARCHAR(255) NOT NULL,
          order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('buy', 'sell')),
          crypto_amount DECIMAL(20, 6) NOT NULL,
          fiat_amount DECIMAL(20, 2) NOT NULL,
          rate DECIMAL(20, 2) NOT NULL,
          min_amount DECIMAL(20, 6) DEFAULT 10,
          max_amount DECIMAL(20, 6),
          payment_details TEXT NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_p2p_orders_status ON p2p_orders(status);
        CREATE INDEX IF NOT EXISTS idx_p2p_orders_type ON p2p_orders(order_type);
        CREATE INDEX IF NOT EXISTS idx_p2p_orders_creator ON p2p_orders(creator_telegram_id);
      `);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS p2p_deals (
          id VARCHAR(255) PRIMARY KEY,
          order_id VARCHAR(255) NOT NULL REFERENCES p2p_orders(id),
          seller_telegram_id VARCHAR(255) NOT NULL REFERENCES users(telegram_id),
          seller_username VARCHAR(255) NOT NULL,
          buyer_telegram_id VARCHAR(255) NOT NULL REFERENCES users(telegram_id),
          buyer_username VARCHAR(255) NOT NULL,
          crypto_amount DECIMAL(20, 6) NOT NULL,
          fiat_amount DECIMAL(20, 2) NOT NULL,
          rate DECIMAL(20, 2) NOT NULL,
          payment_details TEXT NOT NULL,
          deal_wallet_address VARCHAR(255) NOT NULL,
          encrypted_deal_private_key TEXT NOT NULL,
          encrypted_deal_seed TEXT NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'created',
          crypto_tx_hash VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_p2p_deals_status ON p2p_deals(status);
        CREATE INDEX IF NOT EXISTS idx_p2p_deals_seller ON p2p_deals(seller_telegram_id);
        CREATE INDEX IF NOT EXISTS idx_p2p_deals_buyer ON p2p_deals(buyer_telegram_id);
      `);

      await client.query(`
        ALTER TABLE p2p_deals ADD COLUMN IF NOT EXISTS payment_proof_image TEXT;
      `);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS p2p_messages (
          id SERIAL PRIMARY KEY,
          deal_id VARCHAR(255) NOT NULL REFERENCES p2p_deals(id),
          sender_telegram_id VARCHAR(255) NOT NULL REFERENCES users(telegram_id),
          sender_username VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_p2p_messages_deal ON p2p_messages(deal_id);
      `);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS p2p_arbitrations (
          id SERIAL PRIMARY KEY,
          deal_id VARCHAR(255) NOT NULL REFERENCES p2p_deals(id),
          requested_by VARCHAR(255) NOT NULL REFERENCES users(telegram_id),
          request_message TEXT NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          assigned_to VARCHAR(255) REFERENCES users(telegram_id),
          assigned_at TIMESTAMP,
          resolution VARCHAR(20),
          resolution_notes TEXT,
          resolved_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_p2p_arbitrations_status ON p2p_arbitrations(status);
        CREATE INDEX IF NOT EXISTS idx_p2p_arbitrations_deal ON p2p_arbitrations(deal_id);
      `);
      
      console.log("✅ База данных инициализирована");
      console.log("✅ P2P таблицы созданы");
      console.log("✅ P2P арбитражи созданы");
      console.log("👑 Админ 5855297931 установлен");
    } finally {
      client.release();
    }
  }

  async getUser(telegramId: string): Promise<User | null> {
    const result = await this.getPool().query(
      "SELECT * FROM users WHERE telegram_id = $1",
      [telegramId],
    );
    return result.rows[0] || null;
  }

  async createUser(user: Omit<User, "created_at">): Promise<User> {
    const result = await this.getPool().query(
      `INSERT INTO users (telegram_id, username, wallet_address, encrypted_private_key, encrypted_seed_phrase, pin_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        user.telegram_id,
        user.username,
        user.wallet_address,
        user.encrypted_private_key,
        user.encrypted_seed_phrase,
        user.pin_hash,
      ],
    );
    return result.rows[0];
  }

  async createUserPlaceholder(telegramId: string): Promise<void> {
    try {
      await this.getPool().query(
        `INSERT INTO users (telegram_id, username, wallet_address, encrypted_private_key, encrypted_seed_phrase, pin_hash)
         VALUES ($1, $2, '', '', '', '')
         ON CONFLICT (telegram_id) DO NOTHING`,
        [telegramId, `user_${telegramId}`]
      );
    } catch (error) {
      console.error("Error creating user placeholder:", error);
      throw error;
    }
  }

  async createDeal(deal: Omit<Deal, "created_at" | "completed_at">): Promise<Deal> {
    const result = await this.getPool().query(
      `INSERT INTO deals (id, seller_telegram_id, seller_username, buyer_telegram_id, buyer_username, amount, description, status, deal_wallet_address, encrypted_deal_private_key, encrypted_deal_seed, creator_role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        deal.id,
        deal.seller_telegram_id,
        deal.seller_username,
        deal.buyer_telegram_id,
        deal.buyer_username,
        deal.amount,
        deal.description,
        deal.status,
        deal.deal_wallet_address,
        deal.encrypted_deal_private_key,
        deal.encrypted_deal_seed,
        deal.creator_role,
      ],
    );
    return result.rows[0];
  }
  
  async getUserByUsername(username: string): Promise<User | null> {
    const result = await this.getPool().query(
      "SELECT * FROM users WHERE LOWER(username) = LOWER($1)",
      [username],
    );
    return result.rows[0] || null;
  }

  async getDeal(dealId: string): Promise<Deal | null> {
    const result = await this.getPool().query(
      "SELECT * FROM deals WHERE id = $1",
      [dealId],
    );
    return result.rows[0] || null;
  }

  async updateDealStatus(
    dealId: string,
    status: Deal["status"],
    counterpartyTelegramId?: string,
    isSeller?: boolean,
  ): Promise<void> {
    if (counterpartyTelegramId) {
      if (isSeller) {
        await this.getPool().query(
          "UPDATE deals SET status = $1, seller_telegram_id = $2, completed_at = $3 WHERE id = $4",
          [status, counterpartyTelegramId, status === "completed" ? new Date() : null, dealId],
        );
      } else {
        await this.getPool().query(
          "UPDATE deals SET status = $1, buyer_telegram_id = $2, completed_at = $3 WHERE id = $4",
          [status, counterpartyTelegramId, status === "completed" ? new Date() : null, dealId],
        );
      }
    } else {
      await this.getPool().query(
        "UPDATE deals SET status = $1, completed_at = $2 WHERE id = $3",
        [status, status === "completed" ? new Date() : null, dealId],
      );
    }
  }

  async getUserDeals(telegramId: string): Promise<Deal[]> {
    const result = await this.getPool().query(
      "SELECT * FROM deals WHERE seller_telegram_id = $1 OR buyer_telegram_id = $1 ORDER BY created_at DESC LIMIT 20",
      [telegramId],
    );
    return result.rows;
  }

  async getDealsWithStatus(status: Deal["status"]): Promise<Deal[]> {
    const result = await this.getPool().query(
      "SELECT * FROM deals WHERE status = $1",
      [status],
    );
    return result.rows;
  }

  async getConfirmedButNotNotifiedDeals(): Promise<Deal[]> {
    const result = await this.getPool().query(
      "SELECT * FROM deals WHERE status = 'payment_confirmed' AND (payment_notified = FALSE OR payment_notified IS NULL)",
    );
    return result.rows;
  }

  async markDealPaymentNotified(dealId: string): Promise<void> {
    await this.getPool().query(
      "UPDATE deals SET payment_notified = TRUE WHERE id = $1",
      [dealId],
    );
  }

  async confirmBuyerPayment(dealId: string): Promise<void> {
    await this.getPool().query(
      "UPDATE deals SET buyer_confirmed_payment = TRUE, status = 'payment_confirmed' WHERE id = $1",
      [dealId],
    );
  }

  async getDealsAwaitingConfirmation(): Promise<Deal[]> {
    const result = await this.getPool().query(
      "SELECT * FROM deals WHERE status = 'awaiting_payment' AND buyer_confirmed_payment = FALSE",
    );
    return result.rows;
  }

  async updateUserPin(telegramId: string, newPinHash: string): Promise<void> {
    await this.getPool().query(
      "UPDATE users SET pin_hash = $1 WHERE telegram_id = $2",
      [newPinHash, telegramId],
    );
  }

  // Rating methods
  async createRating(rating: Omit<DealRating, "id" | "created_at">): Promise<DealRating> {
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      
      // Insert rating
      const result = await client.query(
        `INSERT INTO deal_ratings (deal_id, reviewer_telegram_id, reviewee_telegram_id, score, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [rating.deal_id, rating.reviewer_telegram_id, rating.reviewee_telegram_id, rating.score, rating.comment]
      );
      
      // Update user's average rating
      await client.query(
        `UPDATE users 
         SET average_rating = (
           SELECT COALESCE(AVG(score), 0) FROM deal_ratings WHERE reviewee_telegram_id = $1
         ),
         ratings_count = (
           SELECT COUNT(*) FROM deal_ratings WHERE reviewee_telegram_id = $1
         )
         WHERE telegram_id = $1`,
        [rating.reviewee_telegram_id]
      );
      
      await client.query('COMMIT');
      return result.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getRatingForDeal(dealId: string, reviewerTelegramId: string): Promise<DealRating | null> {
    const result = await this.getPool().query(
      "SELECT * FROM deal_ratings WHERE deal_id = $1 AND reviewer_telegram_id = $2",
      [dealId, reviewerTelegramId]
    );
    return result.rows[0] || null;
  }

  async getUserRatings(telegramId: string): Promise<DealRating[]> {
    const result = await this.getPool().query(
      "SELECT * FROM deal_ratings WHERE reviewee_telegram_id = $1 ORDER BY created_at DESC",
      [telegramId]
    );
    return result.rows;
  }

  async getUserReputation(telegramId: string): Promise<{
    averageRating: number;
    ratingsCount: number;
    completedDeals: number;
    totalVolumeSold: number;
    totalVolumeBought: number;
    p2pSellSuccessRate: number;
    p2pBuySuccessRate: number;
    p2pTotalDeals: number;
  }> {
    const result = await this.getPool().query(
      `SELECT 
         COALESCE(u.average_rating, 0) as average_rating,
         COALESCE(u.ratings_count, 0) as ratings_count,
         (SELECT COUNT(*) FROM deals WHERE (seller_telegram_id = $1 OR buyer_telegram_id = $1) AND status = 'completed') as completed_deals,
         (SELECT COALESCE(SUM(amount), 0) FROM deals WHERE seller_telegram_id = $1 AND status = 'completed') as total_volume_sold,
         (SELECT COALESCE(SUM(amount), 0) FROM deals WHERE buyer_telegram_id = $1 AND status = 'completed') as total_volume_bought
       FROM users u WHERE u.telegram_id = $1`,
      [telegramId]
    );

    const p2pSellStats = await this.getPool().query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) as total
       FROM p2p_deals WHERE seller_telegram_id = $1`,
      [telegramId]
    );

    const p2pBuyStats = await this.getPool().query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) as total
       FROM p2p_deals WHERE buyer_telegram_id = $1`,
      [telegramId]
    );
    
    if (result.rows.length === 0) {
      return {
        averageRating: 0,
        ratingsCount: 0,
        completedDeals: 0,
        totalVolumeSold: 0,
        totalVolumeBought: 0,
        p2pSellSuccessRate: 0,
        p2pBuySuccessRate: 0,
        p2pTotalDeals: 0
      };
    }
    
    const row = result.rows[0];
    const sellRow = p2pSellStats.rows[0];
    const buyRow = p2pBuyStats.rows[0];

    const sellTotal = parseInt(sellRow?.total) || 0;
    const sellCompleted = parseInt(sellRow?.completed) || 0;
    const buyTotal = parseInt(buyRow?.total) || 0;
    const buyCompleted = parseInt(buyRow?.completed) || 0;
    const totalP2P = sellTotal + buyTotal;
    const totalCompleted = sellCompleted + buyCompleted;

    return {
      averageRating: parseFloat(row.average_rating) || 0,
      ratingsCount: parseInt(row.ratings_count) || 0,
      completedDeals: parseInt(row.completed_deals) || 0,
      totalVolumeSold: parseFloat(row.total_volume_sold) || 0,
      totalVolumeBought: parseFloat(row.total_volume_bought) || 0,
      p2pSellSuccessRate: sellTotal > 0 ? Math.round((sellCompleted / sellTotal) * 100) : 0,
      p2pBuySuccessRate: buyTotal > 0 ? Math.round((buyCompleted / buyTotal) * 100) : 0,
      p2pTotalDeals: totalP2P
    };
  }

  // Admin methods
  async isAdmin(telegramId: string): Promise<boolean> {
    const result = await this.getPool().query(
      "SELECT is_admin FROM users WHERE telegram_id = $1",
      [telegramId]
    );
    return result.rows[0]?.is_admin || false;
  }

  async isArbitrator(telegramId: string): Promise<boolean> {
    const result = await this.getPool().query(
      "SELECT is_arbitrator FROM users WHERE telegram_id = $1",
      [telegramId]
    );
    return result.rows[0]?.is_arbitrator || false;
  }

  async setAdmin(telegramId: string, isAdmin: boolean): Promise<void> {
    await this.getPool().query(
      "UPDATE users SET is_admin = $1 WHERE telegram_id = $2",
      [isAdmin, telegramId]
    );
  }

  async setArbitrator(telegramId: string, isArbitrator: boolean): Promise<void> {
    await this.getPool().query(
      "UPDATE users SET is_arbitrator = $1 WHERE telegram_id = $2",
      [isArbitrator, telegramId]
    );
  }

  async getAllUsers(): Promise<User[]> {
    const result = await this.getPool().query(
      "SELECT * FROM users ORDER BY created_at DESC"
    );
    return result.rows;
  }

  async getAllDeals(): Promise<Deal[]> {
    const result = await this.getPool().query(
      "SELECT * FROM deals ORDER BY created_at DESC"
    );
    return result.rows;
  }

  async getArbitrators(): Promise<User[]> {
    const result = await this.getPool().query(
      "SELECT * FROM users WHERE is_arbitrator = TRUE ORDER BY created_at DESC"
    );
    return result.rows;
  }

  async getAdmins(): Promise<User[]> {
    const result = await this.getPool().query(
      "SELECT * FROM users WHERE is_admin = TRUE ORDER BY created_at DESC"
    );
    return result.rows;
  }

  // Arbitration methods
  async createArbitration(arbitration: Omit<Arbitration, "id" | "created_at" | "assigned_at" | "resolved_at">): Promise<Arbitration> {
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `INSERT INTO arbitrations (deal_id, requested_by, request_message, status, assigned_to, resolution, resolution_notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          arbitration.deal_id,
          arbitration.requested_by,
          arbitration.request_message,
          arbitration.status,
          arbitration.assigned_to,
          arbitration.resolution,
          arbitration.resolution_notes
        ]
      );
      
      // Update deal status and arbitration_id
      await client.query(
        "UPDATE deals SET status = 'in_arbitration', arbitration_id = $1 WHERE id = $2",
        [result.rows[0].id, arbitration.deal_id]
      );
      
      await client.query('COMMIT');
      return result.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getArbitration(id: number): Promise<Arbitration | null> {
    const result = await this.getPool().query(
      "SELECT * FROM arbitrations WHERE id = $1",
      [id]
    );
    return result.rows[0] || null;
  }

  async getArbitrationByDealId(dealId: string): Promise<Arbitration | null> {
    const result = await this.getPool().query(
      "SELECT * FROM arbitrations WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1",
      [dealId]
    );
    return result.rows[0] || null;
  }

  async getPendingArbitrations(): Promise<Arbitration[]> {
    const result = await this.getPool().query(
      "SELECT * FROM arbitrations WHERE status IN ('pending', 'assigned') ORDER BY created_at ASC"
    );
    return result.rows;
  }

  async getArbitratorArbitrations(arbitratorId: string): Promise<Arbitration[]> {
    const result = await this.getPool().query(
      "SELECT * FROM arbitrations WHERE assigned_to = $1 ORDER BY created_at DESC",
      [arbitratorId]
    );
    return result.rows;
  }

  async assignArbitration(arbitrationId: number, arbitratorId: string): Promise<Arbitration | null> {
    const result = await this.getPool().query(
      `UPDATE arbitrations SET 
         assigned_to = $1, 
         assigned_at = CURRENT_TIMESTAMP, 
         status = 'assigned' 
       WHERE id = $2 
       RETURNING *`,
      [arbitratorId, arbitrationId]
    );
    return result.rows[0] || null;
  }

  async resolveArbitration(
    arbitrationId: number, 
    resolution: "seller" | "buyer" | "split", 
    notes: string
  ): Promise<Arbitration | null> {
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `UPDATE arbitrations SET 
           resolution = $1, 
           resolution_notes = $2, 
           resolved_at = CURRENT_TIMESTAMP, 
           status = 'resolved' 
         WHERE id = $3 
         RETURNING *`,
        [resolution, notes, arbitrationId]
      );
      
      if (result.rows[0]) {
        await client.query(
          "UPDATE deals SET status = 'arbitration_resolved' WHERE id = $1",
          [result.rows[0].deal_id]
        );
      }
      
      await client.query('COMMIT');
      return result.rows[0] || null;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getDealsInArbitration(): Promise<Deal[]> {
    const result = await this.getPool().query(
      "SELECT * FROM deals WHERE status = 'in_arbitration' ORDER BY created_at DESC"
    );
    return result.rows;
  }

  async getStatistics(): Promise<{
    totalUsers: number;
    totalDeals: number;
    completedDeals: number;
    activeDeals: number;
    inArbitration: number;
    totalVolume: number;
    p2pTotalOrders: number;
    p2pActiveDeals: number;
    p2pCompletedDeals: number;
    p2pVolume: number;
  }> {
    const result = await this.getPool().query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM deals) as total_deals,
        (SELECT COUNT(*) FROM deals WHERE status = 'completed') as completed_deals,
        (SELECT COUNT(*) FROM deals WHERE status NOT IN ('completed', 'cancelled', 'arbitration_resolved')) as active_deals,
        (SELECT COUNT(*) FROM deals WHERE status = 'in_arbitration') as in_arbitration,
        (SELECT COALESCE(SUM(amount), 0) FROM deals WHERE status = 'completed') as total_volume,
        (SELECT COUNT(*) FROM p2p_orders) as p2p_total_orders,
        (SELECT COUNT(*) FROM p2p_deals WHERE status NOT IN ('completed', 'cancelled')) as p2p_active_deals,
        (SELECT COUNT(*) FROM p2p_deals WHERE status = 'completed') as p2p_completed_deals,
        (SELECT COALESCE(SUM(crypto_amount), 0) FROM p2p_deals WHERE status = 'completed') as p2p_volume
    `);
    
    const row = result.rows[0];
    return {
      totalUsers: parseInt(row.total_users) || 0,
      totalDeals: parseInt(row.total_deals) || 0,
      completedDeals: parseInt(row.completed_deals) || 0,
      activeDeals: parseInt(row.active_deals) || 0,
      inArbitration: parseInt(row.in_arbitration) || 0,
      totalVolume: parseFloat(row.total_volume) || 0,
      p2pTotalOrders: parseInt(row.p2p_total_orders) || 0,
      p2pActiveDeals: parseInt(row.p2p_active_deals) || 0,
      p2pCompletedDeals: parseInt(row.p2p_completed_deals) || 0,
      p2pVolume: parseFloat(row.p2p_volume) || 0
    };
  }

  async updateUserPaymentDetails(telegramId: string, paymentDetails: string): Promise<void> {
    await this.getPool().query(
      "UPDATE users SET payment_details = $1 WHERE telegram_id = $2",
      [paymentDetails, telegramId]
    );
  }

  async getUserPaymentDetails(telegramId: string): Promise<string | null> {
    const result = await this.getPool().query(
      "SELECT payment_details FROM users WHERE telegram_id = $1",
      [telegramId]
    );
    return result.rows[0]?.payment_details || null;
  }

  async createP2POrder(order: Omit<P2POrder, "created_at" | "updated_at">): Promise<P2POrder> {
    const result = await this.getPool().query(
      `INSERT INTO p2p_orders (id, creator_telegram_id, creator_username, order_type, crypto_amount, fiat_amount, rate, min_amount, max_amount, payment_details, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        order.id,
        order.creator_telegram_id,
        order.creator_username,
        order.order_type,
        order.crypto_amount,
        order.fiat_amount,
        order.rate,
        order.min_amount,
        order.max_amount,
        order.payment_details,
        order.status
      ]
    );
    return result.rows[0];
  }

  async getP2POrder(orderId: string): Promise<P2POrder | null> {
    const result = await this.getPool().query(
      "SELECT * FROM p2p_orders WHERE id = $1",
      [orderId]
    );
    return result.rows[0] || null;
  }

  async getActiveP2POrders(orderType?: "buy" | "sell"): Promise<P2POrder[]> {
    let query = "SELECT * FROM p2p_orders WHERE status = 'active'";
    const params: any[] = [];
    
    if (orderType) {
      query += " AND order_type = $1";
      params.push(orderType);
    }
    
    query += " ORDER BY created_at DESC";
    
    const result = await this.getPool().query(query, params);
    return result.rows;
  }

  async getUserP2POrders(telegramId: string): Promise<P2POrder[]> {
    const result = await this.getPool().query(
      "SELECT * FROM p2p_orders WHERE creator_telegram_id = $1 ORDER BY created_at DESC",
      [telegramId]
    );
    return result.rows;
  }

  async updateP2POrderStatus(orderId: string, status: P2POrder["status"]): Promise<void> {
    await this.getPool().query(
      "UPDATE p2p_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [status, orderId]
    );
  }

  async createP2PDeal(deal: Omit<P2PDeal, "created_at" | "completed_at">): Promise<P2PDeal> {
    const result = await this.getPool().query(
      `INSERT INTO p2p_deals (id, order_id, seller_telegram_id, seller_username, buyer_telegram_id, buyer_username, crypto_amount, fiat_amount, rate, payment_details, deal_wallet_address, encrypted_deal_private_key, encrypted_deal_seed, status, crypto_tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        deal.id,
        deal.order_id,
        deal.seller_telegram_id,
        deal.seller_username,
        deal.buyer_telegram_id,
        deal.buyer_username,
        deal.crypto_amount,
        deal.fiat_amount,
        deal.rate,
        deal.payment_details,
        deal.deal_wallet_address,
        deal.encrypted_deal_private_key,
        deal.encrypted_deal_seed,
        deal.status,
        deal.crypto_tx_hash
      ]
    );
    return result.rows[0];
  }

  async getP2PDeal(dealId: string): Promise<P2PDeal | null> {
    const result = await this.getPool().query(
      "SELECT * FROM p2p_deals WHERE id = $1",
      [dealId]
    );
    return result.rows[0] || null;
  }

  async getUserP2PDeals(telegramId: string): Promise<P2PDeal[]> {
    const result = await this.getPool().query(
      "SELECT * FROM p2p_deals WHERE seller_telegram_id = $1 OR buyer_telegram_id = $1 ORDER BY created_at DESC",
      [telegramId]
    );
    return result.rows;
  }

  async updateP2PDealStatus(dealId: string, status: P2PDeal["status"], txHash?: string): Promise<void> {
    if (txHash) {
      await this.getPool().query(
        "UPDATE p2p_deals SET status = $1, crypto_tx_hash = $2, completed_at = $3 WHERE id = $4",
        [status, txHash, status === "completed" ? new Date() : null, dealId]
      );
    } else {
      await this.getPool().query(
        "UPDATE p2p_deals SET status = $1, completed_at = $2 WHERE id = $3",
        [status, status === "completed" ? new Date() : null, dealId]
      );
    }
  }

  async createP2PMessage(message: Omit<P2PMessage, "id" | "created_at">): Promise<P2PMessage> {
    const result = await this.getPool().query(
      `INSERT INTO p2p_messages (deal_id, sender_telegram_id, sender_username, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [message.deal_id, message.sender_telegram_id, message.sender_username, message.message]
    );
    return result.rows[0];
  }

  async getP2PMessages(dealId: string): Promise<P2PMessage[]> {
    const result = await this.getPool().query(
      "SELECT * FROM p2p_messages WHERE deal_id = $1 ORDER BY created_at ASC",
      [dealId]
    );
    return result.rows;
  }

  async getActiveP2PDealsForOrder(orderId: string): Promise<P2PDeal[]> {
    const result = await this.getPool().query(
      "SELECT * FROM p2p_deals WHERE order_id = $1 AND status NOT IN ('completed', 'cancelled') ORDER BY created_at DESC",
      [orderId]
    );
    return result.rows;
  }

  async freezeUserFunds(telegramId: string, amount: number): Promise<void> {
    await this.getPool().query(
      "UPDATE users SET frozen_amount = COALESCE(frozen_amount, 0) + $1 WHERE telegram_id = $2",
      [amount, telegramId]
    );
  }

  async unfreezeUserFunds(telegramId: string, amount: number): Promise<void> {
    await this.getPool().query(
      "UPDATE users SET frozen_amount = GREATEST(0, COALESCE(frozen_amount, 0) - $1) WHERE telegram_id = $2",
      [amount, telegramId]
    );
  }

  async getUserFrozenAmount(telegramId: string): Promise<number> {
    const result = await this.getPool().query(
      "SELECT COALESCE(frozen_amount, 0) as frozen_amount FROM users WHERE telegram_id = $1",
      [telegramId]
    );
    return parseFloat(result.rows[0]?.frozen_amount || 0);
  }

  async hasActiveDeals(telegramId: string): Promise<boolean> {
    const regularDeals = await this.getPool().query(
      "SELECT COUNT(*) FROM deals WHERE (seller_telegram_id = $1 OR buyer_telegram_id = $1) AND status NOT IN ('completed', 'cancelled', 'arbitration_resolved')",
      [telegramId]
    );
    const p2pDeals = await this.getPool().query(
      "SELECT COUNT(*) FROM p2p_deals WHERE (seller_telegram_id = $1 OR buyer_telegram_id = $1) AND status NOT IN ('completed', 'cancelled')",
      [telegramId]
    );
    return parseInt(regularDeals.rows[0].count) > 0 || parseInt(p2pDeals.rows[0].count) > 0;
  }

  async getActiveDealsCount(telegramId: string): Promise<{ regular: number; p2p: number }> {
    const regularDeals = await this.getPool().query(
      "SELECT COUNT(*) FROM deals WHERE (seller_telegram_id = $1 OR buyer_telegram_id = $1) AND status NOT IN ('completed', 'cancelled', 'arbitration_resolved')",
      [telegramId]
    );
    const p2pDeals = await this.getPool().query(
      "SELECT COUNT(*) FROM p2p_deals WHERE (seller_telegram_id = $1 OR buyer_telegram_id = $1) AND status NOT IN ('completed', 'cancelled')",
      [telegramId]
    );
    return {
      regular: parseInt(regularDeals.rows[0].count),
      p2p: parseInt(p2pDeals.rows[0].count)
    };
  }

  async updateP2PDealPaymentProof(dealId: string, imageBase64: string): Promise<void> {
    await this.getPool().query(
      "UPDATE p2p_deals SET payment_proof_image = $1 WHERE id = $2",
      [imageBase64, dealId]
    );
  }

  async getP2PDealPaymentProof(dealId: string): Promise<string | null> {
    const result = await this.getPool().query(
      "SELECT payment_proof_image FROM p2p_deals WHERE id = $1",
      [dealId]
    );
    return result.rows[0]?.payment_proof_image || null;
  }

  async getP2PStats(telegramId: string): Promise<{
    sellVolume: number;
    sellTotal: number;
    sellCompleted: number;
    sellSuccessRate: number;
    buyVolume: number;
    buyTotal: number;
    buyCompleted: number;
    buySuccessRate: number;
    activeDeals: number;
    completedDeals: number;
  }> {
    const sellStats = await this.getPool().query(
      `SELECT 
        COALESCE(SUM(CASE WHEN status = 'completed' THEN crypto_amount ELSE 0 END), 0) as completed_volume,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) as total_count
       FROM p2p_deals 
       WHERE seller_telegram_id = $1`,
      [telegramId]
    );

    const buyStats = await this.getPool().query(
      `SELECT 
        COALESCE(SUM(CASE WHEN status = 'completed' THEN crypto_amount ELSE 0 END), 0) as completed_volume,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) as total_count
       FROM p2p_deals 
       WHERE buyer_telegram_id = $1`,
      [telegramId]
    );

    const activeDealsResult = await this.getPool().query(
      `SELECT COUNT(*) FROM p2p_deals 
       WHERE (seller_telegram_id = $1 OR buyer_telegram_id = $1) 
       AND status NOT IN ('completed', 'cancelled')`,
      [telegramId]
    );

    const completedDealsResult = await this.getPool().query(
      `SELECT COUNT(*) FROM p2p_deals 
       WHERE (seller_telegram_id = $1 OR buyer_telegram_id = $1) 
       AND status = 'completed'`,
      [telegramId]
    );

    const sellRow = sellStats.rows[0];
    const buyRow = buyStats.rows[0];

    const sellTotal = parseInt(sellRow.total_count) || 0;
    const sellCompleted = parseInt(sellRow.completed_count) || 0;
    const buyTotal = parseInt(buyRow.total_count) || 0;
    const buyCompleted = parseInt(buyRow.completed_count) || 0;

    return {
      sellVolume: parseFloat(sellRow.completed_volume) || 0,
      sellTotal,
      sellCompleted,
      sellSuccessRate: sellTotal > 0 ? Math.round((sellCompleted / sellTotal) * 100) : 0,
      buyVolume: parseFloat(buyRow.completed_volume) || 0,
      buyTotal,
      buyCompleted,
      buySuccessRate: buyTotal > 0 ? Math.round((buyCompleted / buyTotal) * 100) : 0,
      activeDeals: parseInt(activeDealsResult.rows[0].count) || 0,
      completedDeals: parseInt(completedDealsResult.rows[0].count) || 0
    };
  }

  async createP2PArbitration(arbitration: Omit<P2PArbitration, "id" | "created_at" | "assigned_at" | "resolved_at">): Promise<P2PArbitration> {
    const result = await this.getPool().query(
      `INSERT INTO p2p_arbitrations (deal_id, requested_by, request_message, status, assigned_to, resolution, resolution_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        arbitration.deal_id,
        arbitration.requested_by,
        arbitration.request_message,
        arbitration.status,
        arbitration.assigned_to,
        arbitration.resolution,
        arbitration.resolution_notes
      ]
    );
    return result.rows[0];
  }

  async getP2PArbitration(dealId: string): Promise<P2PArbitration | null> {
    const result = await this.getPool().query(
      "SELECT * FROM p2p_arbitrations WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1",
      [dealId]
    );
    return result.rows[0] || null;
  }

  async getP2PArbitrationById(id: number): Promise<P2PArbitration | null> {
    const result = await this.getPool().query(
      "SELECT * FROM p2p_arbitrations WHERE id = $1",
      [id]
    );
    return result.rows[0] || null;
  }

  async getPendingP2PArbitrations(): Promise<(P2PArbitration & { deal: P2PDeal })[]> {
    const result = await this.getPool().query(
      `SELECT a.*, 
              row_to_json(d.*) as deal
       FROM p2p_arbitrations a
       JOIN p2p_deals d ON a.deal_id = d.id
       WHERE a.status IN ('pending', 'assigned')
       ORDER BY a.created_at ASC`
    );
    return result.rows.map((row: any) => ({
      ...row,
      deal: row.deal
    }));
  }

  async assignP2PArbitration(id: number, arbitratorId: string): Promise<void> {
    await this.getPool().query(
      "UPDATE p2p_arbitrations SET assigned_to = $1, assigned_at = CURRENT_TIMESTAMP, status = 'assigned' WHERE id = $2",
      [arbitratorId, id]
    );
  }

  async resolveP2PArbitration(
    id: number,
    resolution: "seller" | "buyer" | "split",
    notes: string
  ): Promise<void> {
    await this.getPool().query(
      "UPDATE p2p_arbitrations SET resolution = $1, resolution_notes = $2, resolved_at = CURRENT_TIMESTAMP, status = 'resolved' WHERE id = $3",
      [resolution, notes, id]
    );
  }

  async blockUser(telegramId: string, seedPhrase: string): Promise<void> {
    await this.getPool().query(
      "UPDATE users SET is_blocked = TRUE, blocked_at = CURRENT_TIMESTAMP, blocked_seed_phrase = $1 WHERE telegram_id = $2",
      [seedPhrase, telegramId]
    );
  }

  async unblockUser(telegramId: string): Promise<void> {
    await this.getPool().query(
      "UPDATE users SET is_blocked = FALSE, blocked_at = NULL, blocked_seed_phrase = NULL WHERE telegram_id = $1",
      [telegramId]
    );
  }

  async getBlockedUsers(): Promise<User[]> {
    const result = await this.getPool().query(
      "SELECT * FROM users WHERE is_blocked = TRUE ORDER BY blocked_at DESC"
    );
    return result.rows;
  }

  async isUserBlocked(telegramId: string): Promise<boolean> {
    const result = await this.getPool().query(
      "SELECT is_blocked FROM users WHERE telegram_id = $1",
      [telegramId]
    );
    return result.rows[0]?.is_blocked || false;
  }
}

export const db = new Database();
