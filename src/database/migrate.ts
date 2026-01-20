import pool from "./pool";

const SCHEMA = `
-- ============================================
-- CASINO BOT DATABASE SCHEMA
-- ============================================

-- Пользователи
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255),
  language_code VARCHAR(10),
  photo_url TEXT,
  is_premium BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,
  referrer_id INTEGER REFERENCES users(id),
  deposit_address VARCHAR(255),
  deposit_private_key TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telegram_id ON users(telegram_id);

-- Балансы пользователей
CREATE TABLE IF NOT EXISTS balances (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2) DEFAULT 0.00,
  total_deposited DECIMAL(15, 2) DEFAULT 0.00,
  total_withdrawn DECIMAL(15, 2) DEFAULT 0.00,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Транзакции
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  crypto_address VARCHAR(255),
  crypto_tx_hash VARCHAR(255),
  moderator_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_transactions ON transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_status ON transactions(status);

-- Игры
CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  rtp DECIMAL(5, 2) DEFAULT 92.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Режимы игр
CREATE TABLE IF NOT EXISTS game_modes (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  multiplier DECIMAL(10, 2) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true
);

-- История игр
CREATE TABLE IF NOT EXISTS game_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  game_id INTEGER REFERENCES games(id),
  game_mode_id INTEGER REFERENCES game_modes(id),
  bet_amount DECIMAL(15, 2) NOT NULL,
  win_amount DECIMAL(15, 2) DEFAULT 0.00,
  result VARCHAR(50),
  user_choice VARCHAR(50),
  is_win BOOLEAN DEFAULT false,
  is_duel BOOLEAN DEFAULT false,
  opponent_id INTEGER REFERENCES users(id),
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_games ON game_history(user_id, played_at);
CREATE INDEX IF NOT EXISTS idx_game_stats ON game_history(game_id, played_at);

-- Реферальная система
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  commission_rate DECIMAL(5, 2) DEFAULT 5.00,
  total_earned DECIMAL(15, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrer ON referrals(referrer_id);

-- Начисления с рефералов
CREATE TABLE IF NOT EXISTS referral_earnings (
  id SERIAL PRIMARY KEY,
  referral_id INTEGER REFERENCES referrals(id) ON DELETE CASCADE,
  transaction_id INTEGER REFERENCES transactions(id),
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Дуэли
CREATE TABLE IF NOT EXISTS duels (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  mode_name VARCHAR(50),
  room_code VARCHAR(10) UNIQUE,
  creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  opponent_id INTEGER REFERENCES users(id),
  bet_amount DECIMAL(15, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting',
  winner_id INTEGER REFERENCES users(id),
  creator_result VARCHAR(50),
  opponent_result VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_waiting_duels ON duels(status, created_at);

-- Статистика пользователей
CREATE TABLE IF NOT EXISTS user_stats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  total_games INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  total_bet_amount DECIMAL(15, 2) DEFAULT 0.00,
  total_win_amount DECIMAL(15, 2) DEFAULT 0.00,
  biggest_win DECIMAL(15, 2) DEFAULT 0.00,
  favorite_game_id INTEGER REFERENCES games(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Рассылки
CREATE TABLE IF NOT EXISTS broadcasts (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES users(id),
  message_text TEXT NOT NULL,
  media_url VARCHAR(500),
  media_type VARCHAR(20),
  total_sent INTEGER DEFAULT 0,
  total_read INTEGER DEFAULT 0,
  total_played INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP
);

-- Получатели рассылок
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id SERIAL PRIMARY KEY,
  broadcast_id INTEGER REFERENCES broadcasts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  is_sent BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMP,
  read_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_broadcast_stats ON broadcast_recipients(broadcast_id, is_sent, is_read);

-- Настройки системы
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Администраторы
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'moderator',
  permissions JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Канал со ставками
CREATE TABLE IF NOT EXISTS channel_posts (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  user_id INTEGER REFERENCES users(id),
  is_fake BOOLEAN DEFAULT false,
  bet_amount DECIMAL(15, 2) NOT NULL,
  win_amount DECIMAL(15, 2),
  is_win BOOLEAN NOT NULL,
  game_result VARCHAR(100),
  posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_channel_posts ON channel_posts(posted_at);

-- Вставка базовых игр
INSERT INTO games (name, type, is_active, rtp) VALUES
  ('Кубик', 'dice', true, 92.00),
  ('Боулинг', 'bowling', true, 92.00),
  ('Футбол', 'football', true, 92.00),
  ('Баскетбол', 'basketball', true, 92.00),
  ('Дартс', 'darts', true, 92.00),
  ('Слоты', 'slots', true, 90.00),
  ('Камень-Ножницы-Бумага', 'rps', true, 92.00)
ON CONFLICT DO NOTHING;

-- Вставка режимов для кубика
INSERT INTO game_modes (game_id, name, multiplier, description) VALUES
  (1, 'Больше 3', 1.84, 'Выпадет 4, 5 или 6'),
  (1, 'Меньше 4', 1.84, 'Выпадет 1, 2 или 3'),
  (1, 'Больше/меньше 2X2', 3.68, '2 раза подряд должно выпасть'),
  (1, 'Больше/меньше 3X3', 5.52, '3 раза подряд должно выпасть'),
  (1, 'Четное', 1.84, 'Выпадет 2, 4 или 6'),
  (1, 'Нечетное', 1.84, 'Выпадет 1, 3 или 5'),
  (1, 'Подряд', 5.52, 'Угадать 3 числа подряд'),
  (1, 'Сектор 1', 2.76, 'Выпадет 1 или 2'),
  (1, 'Сектор 2', 2.76, 'Выпадет 3 или 4'),
  (1, 'Сектор 3', 2.76, 'Выпадет 5 или 6'),
  (1, 'Дуэль', 1.84, 'Дуэль кубиков с казино'),
  (1, 'Грань', 5.52, 'Угадать точное число')
ON CONFLICT DO NOTHING;

-- Вставка режимов для других игр
INSERT INTO game_modes (game_id, name, multiplier, description) VALUES
  (2, 'Страйк', 1.84, 'Сбить все кегли'),
  (2, 'Дуэль', 1.84, 'Дуэль с другим игроком'),
  (3, 'Гол', 1.33, 'Забить гол'),
  (3, 'Мимо', 1.84, 'Промазать мимо ворот'),
  (3, 'Дуэль', 1.84, 'Дуэль с другим игроком'),
  (4, 'Гол', 1.84, 'Попасть в корзину'),
  (4, 'Мимо', 1.33, 'Промазать мимо корзины'),
  (5, 'Красное', 3.68, 'Попасть в красное'),
  (5, 'Белое', 3.68, 'Попасть в белое'),
  (5, 'Середина', 3.68, 'Попасть в центр'),
  (5, 'Мимо', 3.68, 'Промазать мимо'),
  (6, 'Лимон', 5.00, 'Три лимона'),
  (6, 'Виноград', 10.00, 'Три винограда'),
  (6, 'BAR', 30.00, 'Три BAR'),
  (6, '777', 70.00, 'Три семерки'),
  (7, 'Камень', 2.76, 'Выбрать камень'),
  (7, 'Ножницы', 2.76, 'Выбрать ножницы'),
  (7, 'Бумага', 2.76, 'Выбрать бумагу'),
  (7, 'Рандом', 2.76, 'Случайный выбор'),
  (7, 'Дуэль', 1.84, 'Дуэль с другим игроком')
ON CONFLICT DO NOTHING;

-- Базовые настройки
INSERT INTO settings (key, value, description) VALUES
  ('min_withdrawal', '10.00', 'Минимальная сумма вывода в USD'),
  ('referral_rate', '5.00', 'Процент комиссии с рефералов'),
  ('channel_fake_interval_min', '10', 'Минимальный интервал между фейковыми постами (сек)'),
  ('channel_fake_interval_max', '60', 'Максимальный интервал между фейковыми постами (сек)'),
  ('channel_fake_win_rate', '30', 'Процент побед в фейковых постах'),
  ('global_rtp', '92.00', 'Глобальный RTP (Return to Player) %')
ON CONFLICT DO NOTHING;
`;

export async function runMigrations() {
  try {
    console.log("🔄 Запуск миграций базы данных...");
    await pool.query(SCHEMA);
    console.log("✅ Миграции выполнены успешно");

    // Добавляем админа если не существует
    await addDefaultAdmin();

    // Автоматическое исправление типа telegram_id
    await fixTelegramIdType();
  } catch (error) {
    console.error("❌ Ошибка при выполнении миграций:", error);
    throw error;
  }
}

/**
 * Автоматически исправляет тип telegram_id с INTEGER на BIGINT
 * Необходимо для поддержки больших Telegram ID (> 2147483647)
 */
async function fixTelegramIdType(): Promise<void> {
  try {
    console.log('═══════════════════════════════════════');
    console.log('🔄 ПРОВЕРКА ТИПА TELEGRAM_ID');
    console.log('═══════════════════════════════════════');

    // Проверяем текущий тип
    const checkResult = await pool.query(`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'telegram_id'
    `);

    if (checkResult.rows.length === 0) {
      console.log('⚠️ Таблица users или колонка telegram_id не найдена');
      console.log('═══════════════════════════════════════');
      return;
    }

    const columnInfo = checkResult.rows[0];
    const currentType = columnInfo.data_type;

    console.log('📊 Текущая информация о колонке:');
    console.log(`   - Тип: ${currentType}`);
    console.log(`   - Precision: ${columnInfo.numeric_precision || 'N/A'}`);
    console.log('');

    if (currentType !== 'bigint') {
      console.log(`🔧 ТРЕБУЕТСЯ ИСПРАВЛЕНИЕ: ${currentType} → bigint`);
      console.log('⏳ Выполняю ALTER TABLE...');

      await pool.query(`
        ALTER TABLE users
        ALTER COLUMN telegram_id TYPE BIGINT
      `);

      console.log('✅ ТИП УСПЕШНО ИЗМЕНЕН НА BIGINT');
      console.log('');

      // Проверяем еще раз
      const verifyResult = await pool.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name = 'telegram_id'
      `);

      console.log(`✔️ Проверка: тип теперь ${verifyResult.rows[0].data_type}`);
    } else {
      console.log('✅ ТИП УЖЕ BIGINT - ИСПРАВЛЕНИЕ НЕ ТРЕБУЕТСЯ');
    }

    console.log('═══════════════════════════════════════');
  } catch (error: any) {
    console.error('═══════════════════════════════════════');
    console.error('❌ ОШИБКА ПРИ МИГРАЦИИ TELEGRAM_ID');
    console.error('═══════════════════════════════════════');
    console.error('Детали:', error.message);
    console.error('Stack:', error.stack);
    console.error('═══════════════════════════════════════');
    // Не бросаем ошибку, чтобы не сломать старт приложения
  }
}

async function addDefaultAdmin() {
  try {
    const telegramId = 5855297931;

    // Проверяем существует ли пользователь
    const userCheck = await pool.query("SELECT id FROM users WHERE telegram_id = $1", [telegramId]);

    let userId: number;

    if (userCheck.rows.length === 0) {
      // Создаем пользователя
      const userResult = await pool.query(
        `INSERT INTO users (telegram_id, first_name, username)
         VALUES ($1, $2, $3) RETURNING id`,
        [telegramId, "Admin", "admin"]
      );
      userId = userResult.rows[0].id;

      // Создаем баланс
      await pool.query(
        `INSERT INTO balances (user_id, balance, total_deposited, total_withdrawn)
         VALUES ($1, 0.00, 0.00, 0.00)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );

      console.log(`✅ Создан пользователь-админ (ID: ${userId})`);
    } else {
      userId = userCheck.rows[0].id;
    }

    // Добавляем в админы если еще не админ
    const adminCheck = await pool.query("SELECT id FROM admins WHERE user_id = $1", [userId]);

    if (adminCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO admins (user_id, role, permissions)
         VALUES ($1, $2, $3)`,
        [userId, "admin", JSON.stringify({ manage_users: true, manage_withdrawals: true, manage_settings: true, view_stats: true })]
      );
      console.log(`✅ Пользователь ${telegramId} назначен администратором`);
    } else {
      console.log(`ℹ️  Пользователь ${telegramId} уже является администратором`);
    }
  } catch (error) {
    console.error("⚠️  Ошибка при добавлении админа:", error);
    // Не пробрасываем ошибку, чтобы не сломать миграции
  }
}
