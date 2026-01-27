#!/usr/bin/env node

/**
 * Конвертер TGS → Lottie JSON
 *
 * Использование:
 * node scripts/convert-tgs.js input.tgs output.json
 *
 * TGS это просто gzip сжатый JSON
 */

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
  console.error('❌ Использование: node convert-tgs.js input.tgs output.json');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`❌ Файл не найден: ${inputFile}`);
  process.exit(1);
}

console.log(`📦 Конвертация: ${inputFile} → ${outputFile}`);

try {
  // Читаем TGS файл
  const tgsData = fs.readFileSync(inputFile);

  // Разжимаем GZIP
  const jsonData = zlib.gunzipSync(tgsData);

  // Парсим JSON для валидации
  const lottieData = JSON.parse(jsonData.toString('utf8'));

  // Создаем директорию если нужно
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Сохраняем красиво отформатированный JSON
  fs.writeFileSync(outputFile, JSON.stringify(lottieData, null, 2));

  console.log(`✅ Готово! Файл сохранен: ${outputFile}`);
  console.log(`📊 Размер: ${(jsonData.length / 1024).toFixed(2)} KB`);
  console.log(`🎬 Кадров: ${lottieData.op || 'unknown'}`);
  console.log(`📐 Размер: ${lottieData.w}x${lottieData.h}`);

} catch (error) {
  console.error('❌ Ошибка конвертации:', error.message);
  process.exit(1);
}
