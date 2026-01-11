import { Pool } from "pg";

// Поддержка DATABASE_URL (Render, Heroku) и отдельных переменных
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  : {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "casino_bot",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

export async function initDatabase() {
  try {
    const client = await pool.connect();
    console.log("✅ Подключение к базе данных установлено");
    client.release();
  } catch (error) {
    console.error("❌ Ошибка подключения к базе данных:", error);
    throw error;
  }
}

export default pool;
