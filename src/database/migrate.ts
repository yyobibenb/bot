import fs from "fs";
import path from "path";
import pool from "./pool";

export async function runMigrations() {
  try {
    console.log("🔄 Запуск миграций базы данных...");

    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf-8");

    await pool.query(schema);

    console.log("✅ Миграции выполнены успешно");
  } catch (error) {
    console.error("❌ Ошибка при выполнении миграций:", error);
    throw error;
  }
}
