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
  photo_url VARCHAR(500),
  is_premium BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,
  referrer_id INTEGER REFERENCES users(id),
  deposit_address VARCHAR(255),
  deposit_private_key VARCHAR(255),
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

-- Транзакции (пополнения и выводы)
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'deposit', 'withdrawal'
  amount DECIMAL(15, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
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
  type VARCHAR(50) NOT NULL, -- 'dice', 'bowling', 'football', 'basketball', 'darts', 'slots', 'rps'
  is_active BOOLEAN DEFAULT true,
  rtp DECIMAL(5, 2) DEFAULT 92.00, -- Return to Player %
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Режимы игр (например, для кубика: больше/меньше, четное/нечетное и т.д.)
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
  result VARCHAR(50), -- результат игры (например, "6", "goal", "strike" и т.д.)
  user_choice VARCHAR(50), -- выбор пользователя
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
  commission_rate DECIMAL(5, 2) DEFAULT 5.00, -- процент от депозита
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
  creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  opponent_id INTEGER REFERENCES users(id),
  bet_amount DECIMAL(15, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'active', 'completed', 'cancelled'
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
  media_type VARCHAR(20), -- 'photo', 'video', null
  total_sent INTEGER DEFAULT 0,
  total_read INTEGER DEFAULT 0,
  total_played INTEGER DEFAULT 0, -- сколько сыграло после рассылки
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'sending', 'completed'
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
  role VARCHAR(50) DEFAULT 'moderator', -- 'admin', 'moderator'
  permissions JSONB, -- права доступа
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Канал со ставками (фейковые и реальные)
CREATE TABLE IF NOT EXISTS channel_posts (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  user_id INTEGER REFERENCES users(id), -- null если фейковый
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
  (3, 'Не попал', 3.68, 'Результат 3 - штанга'),
  (3, 'Попал', 1.84, 'Результат 5 - точное попадание'),
  (3, 'Дуэль', 1.84, 'Дуэль с другим игроком'),
  (4, 'Гол', 1.84, 'Попасть в корзину'),
  (4, 'Мимо', 1.33, 'Промазать мимо корзины'),
  (4, 'Не попал', 3.68, 'Результат 3 - не попал в кольцо'),
  (4, 'Попал', 1.84, 'Результат 5 - точное попадание'),
  (4, 'Дуэль', 1.84, 'Дуэль с другим игроком'),
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
