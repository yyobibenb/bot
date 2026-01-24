-- Миграция: Добавление режима "Дуэль" для баскетбола
-- Дата: 2026-01-24

-- Добавляем режим дуэли для баскетбола (game_id = 4)
INSERT INTO game_modes (game_id, name, multiplier, description)
VALUES (4, 'Дуэль', 1.84, 'Дуэль с другим игроком')
ON CONFLICT DO NOTHING;

-- Проверка
SELECT * FROM game_modes WHERE game_id = 4 ORDER BY id;
