-- Миграция: Добавление режимов "Не попал" и "Попал" для футбола и баскетбола
-- Дата: 2026-01-24

-- Добавляем режимы для футбола (game_id = 3)
INSERT INTO game_modes (game_id, name, multiplier, description)
VALUES
  (3, 'Не попал', 3.68, 'Результат 3 - штанга'),
  (3, 'Попал', 1.84, 'Результат 5 - точное попадание')
ON CONFLICT DO NOTHING;

-- Добавляем режимы для баскетбола (game_id = 4)
INSERT INTO game_modes (game_id, name, multiplier, description)
VALUES
  (4, 'Не попал', 3.68, 'Результат 3 - не попал в кольцо'),
  (4, 'Попал', 1.84, 'Результат 5 - точное попадание')
ON CONFLICT DO NOTHING;

-- Проверка для футбола
SELECT * FROM game_modes WHERE game_id = 3 ORDER BY id;

-- Проверка для баскетбола
SELECT * FROM game_modes WHERE game_id = 4 ORDER BY id;
