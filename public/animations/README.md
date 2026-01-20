# 🎬 Lottie Animations для игр

Эта папка содержит анимации для игр, конвертированные из TGS стикеров Telegram.

## 📥 Как добавить анимации:

### Вариант 1: Скачать TGS из Telegram и конвертировать

**Шаг 1: Скачайте TGS стикеры**

Источники TGS стикеров:
- 🎲 **Dice (Кубик)**: https://chpic.su/en/emojis/DiceCubeEmoji/
- 🎳 **Bowling**: поищите в @Stickers или на https://tlgrm.eu/stickers
- ⚽ **Football**: поищите в @Stickers
- 🏀 **Basketball**: поищите в @Stickers
- 🎯 **Darts**: поищите в @Stickers

Альтернативный способ:
1. Откройте Telegram Desktop
2. Найдите стикер с нужной анимацией
3. ПКМ → "Save As" → сохраните как .tgs файл

**Шаг 2: Конвертируйте TGS в JSON**

```bash
# Из корневой папки проекта
cd /home/user/bot

# Конвертация dice
node scripts/convert-tgs.js dice.tgs public/animations/dice.json

# Конвертация остальных
node scripts/convert-tgs.js bowling.tgs public/animations/bowling.json
node scripts/convert-tgs.js football.tgs public/animations/football.json
node scripts/convert-tgs.js basketball.tgs public/animations/basketball.json
node scripts/convert-tgs.js darts.tgs public/animations/darts.json
```

### Вариант 2: Скачать готовые Lottie JSON

Можно использовать готовые анимации с LottieFiles:

```bash
cd public/animations

# Dice
wget -O dice.json "https://lottie.host/embed/dice-animation.json"

# Bowling
wget -O bowling.json "https://lottie.host/embed/bowling-animation.json"

# Football
wget -O football.json "https://lottie.host/embed/football-animation.json"

# Basketball
wget -O basketball.json "https://lottie.host/embed/basketball-animation.json"

# Darts
wget -O darts.json "https://lottie.host/embed/darts-animation.json"
```

Или скачайте с сайта:
- https://lottiefiles.com/search?q=dice
- https://lottiefiles.com/search?q=bowling
- https://lottiefiles.com/search?q=football
- https://lottiefiles.com/search?q=basketball
- https://lottiefiles.com/search?q=darts

## ✅ Проверка

После добавления файлов убедитесь что:
```bash
ls -la public/animations/
# Должно быть:
# dice.json
# bowling.json
# football.json
# basketball.json
# darts.json
```

## 🎨 Настройка

Пути к анимациям настроены в `public/app.js`:
```javascript
const lottieAnimations = {
  dice: '/animations/dice.json',
  bowling: '/animations/bowling.json',
  football: '/animations/football.json',
  basketball: '/animations/basketball.json',
  darts: '/animations/darts.json'
};
```

## 📦 Fallback

Если файл анимации не найден, будет показан эмодзи:
- 🎲 для dice
- 🎳 для bowling
- ⚽ для football
- 🏀 для basketball
- 🎯 для darts
