-- Скрипт для добавления админа
-- Замените USER_ID на реальный ID пользователя из таблицы users

-- 1. Сначала найдите ваш user_id:
-- SELECT id, telegram_id, first_name FROM users WHERE telegram_id = 'ВАШ_TELEGRAM_ID';

-- 2. Затем добавьте админа (замените 1 на ваш user_id):
INSERT INTO admins (user_id, permissions)
VALUES (1, '{"all": true}')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Проверьте что админ добавлен:
SELECT a.id, a.user_id, u.telegram_id, u.first_name, a.permissions
FROM admins a
JOIN users u ON a.user_id = u.id;

-- Примеры использования:
-- Добавить админа с telegram_id = 123456789:
-- INSERT INTO admins (user_id, permissions)
-- SELECT id, '{"all": true}'::jsonb
-- FROM users
-- WHERE telegram_id = 123456789;
