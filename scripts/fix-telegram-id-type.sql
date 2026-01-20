-- Миграция для изменения типа telegram_id на BIGINT
-- Это нужно на случай если БД была создана со старой схемой

-- Проверяем и изменяем тип telegram_id в users на BIGINT
DO $$
BEGIN
  -- Пытаемся изменить тип, если он не BIGINT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'telegram_id' 
    AND data_type != 'bigint'
  ) THEN
    EXECUTE 'ALTER TABLE users ALTER COLUMN telegram_id TYPE BIGINT';
    RAISE NOTICE 'Тип telegram_id изменен на BIGINT';
  ELSE
    RAISE NOTICE 'Тип telegram_id уже BIGINT';
  END IF;
END $$;
