# Исправление ошибки "value is out of range for type integer"

## Проблема
Ошибка возникает когда Telegram ID слишком большой для типа INTEGER в PostgreSQL.

## Решение

### Вариант 1: Через psql (если есть прямой доступ к БД)

```bash
psql $DATABASE_URL -f scripts/fix-telegram-id-type.sql
```

### Вариант 2: Через Render Dashboard

1. Зайдите в Render Dashboard
2. Откройте ваш PostgreSQL сервис
3. Нажмите "Shell"
4. Выполните:

```sql
-- Проверить текущий тип
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'telegram_id';

-- Если тип не bigint, изменить
ALTER TABLE users ALTER COLUMN telegram_id TYPE BIGINT;
```

### Вариант 3: Пересоздать БД (если данных мало)

```bash
# Удалить все таблицы
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Создать заново со схемой (уже с BIGINT)
psql $DATABASE_URL -f src/database/schema.sql
```

## Проверка

После применения проверьте:

```sql
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'telegram_id';
```

Должно быть: `telegram_id | bigint`
