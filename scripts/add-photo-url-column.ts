import pool from "../src/database/pool";

/**
 * Миграция для добавления колонки photo_url в таблицу users
 */
async function addPhotoUrlColumn() {
  try {
    console.log("🔄 Добавление колонки photo_url...");

    // Проверяем существует ли колонка
    const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'photo_url';
    `;

    const result = await pool.query(checkQuery);

    if (result.rows.length > 0) {
      console.log("ℹ️  Колонка photo_url уже существует");
      return;
    }

    // Добавляем колонку
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN photo_url VARCHAR(500);
    `);

    console.log("✅ Колонка photo_url успешно добавлена");

  } catch (error) {
    console.error("❌ Ошибка при добавлении колонки photo_url:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Запуск миграции
addPhotoUrlColumn()
  .then(() => {
    console.log("✅ Миграция завершена успешно");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Миграция не выполнена:", error);
    process.exit(1);
  });
