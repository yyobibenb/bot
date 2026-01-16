# 🔄 Как данные передаются в приложение

## Полный Flow передачи данных

### 1️⃣ Пользователь запускает бота

```
Пользователь → /start → Telegram Bot
```

### 2️⃣ Бот обрабатывает команду (src/bot/telegramBot.ts)

```typescript
// Строка 48-56
private async handleStart(msg: TelegramBot.Message, referralCode?: string) {
  const telegramId = msg.from?.id;  // Например: 123456789

  // Получаем фото профиля
  const photos = await this.bot.getUserProfilePhotos(telegramId);
  const photoUrl = "https://api.telegram.org/file/bot.../photo.jpg";

  // Создаем/обновляем пользователя в БД
  const user = await UserModel.create({...});
}
```

### 3️⃣ Бот формирует URL с параметрами (строка 135-142)

```typescript
// Строка 34-46
private buildWebAppUrlWithParams(user: any, photoUrl: string | null): string {
  const baseUrl = this.getWebAppUrl();  // Из .env: WEB_APP_URL
  const params = new URLSearchParams();

  params.append('user_id', user.telegram_id.toString());     // '123456789'
  params.append('first_name', user.first_name || '');        // 'John'
  if (user.last_name) params.append('last_name', user.last_name);  // 'Doe'
  if (user.username) params.append('username', user.username);      // 'johndoe'
  if (photoUrl) params.append('photo_url', photoUrl);               // 'https://...'
  if (user.is_premium) params.append('is_premium', 'true');

  return `${baseUrl}?${params.toString()}`;
}
```

**Результат:**
```
https://your-app.com?user_id=123456789&first_name=John&last_name=Doe&username=johndoe&photo_url=https%3A%2F%2Fapi.telegram.org%2Ffile%2Fbot...&is_premium=true
```

### 4️⃣ Бот отправляет кнопку с этим URL (строка 144-152)

```typescript
await this.bot.sendMessage(chatId, WELCOME_MESSAGE, {
  reply_markup: {
    keyboard: [
      [{
        text: "🚀 Открыть Mini App",
        web_app: { url: webAppUrlWithParams }  // ← URL с параметрами
      }]
    ]
  }
});
```

### 5️⃣ Пользователь нажимает кнопку

```
Пользователь нажимает "🚀 Открыть Mini App"
      ↓
Telegram открывает WebView с URL
      ↓
Загружается public/index.html
      ↓
Выполняется public/app.js
```

### 6️⃣ Фронтенд парсит URL параметры (public/app.js строка 19-30)

```javascript
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    user_id: params.get('user_id'),        // '123456789'
    first_name: params.get('first_name'),  // 'John'
    last_name: params.get('last_name'),    // 'Doe'
    username: params.get('username'),      // 'johndoe'
    photo_url: params.get('photo_url'),    // 'https://...'
    is_premium: params.get('is_premium') === 'true'  // true
  };
}
```

**Консоль покажет:**
```javascript
🔍 URL параметры: {
  user_id: "123456789",
  first_name: "John",
  last_name: "Doe",
  username: "johndoe",
  photo_url: "https://api.telegram.org/file/bot.../photo.jpg",
  is_premium: true
}
```

### 7️⃣ Создается объект пользователя (строка 40-50)

```javascript
if (urlParams.user_id) {
  tgUser = {
    id: parseInt(urlParams.user_id),  // 123456789
    first_name: urlParams.first_name,  // 'John'
    last_name: urlParams.last_name,    // 'Doe'
    username: urlParams.username,      // 'johndoe'
    photo_url: urlParams.photo_url,    // 'https://...'
    is_premium: urlParams.is_premium   // true
  };
  window.userDataFromUrl = tgUser;
  console.log('✅ Данные пользователя из URL параметров:', tgUser);
}
```

### 8️⃣ Загружаем пользователя из БД (строка 62-86)

```javascript
// Запрос к API
const response = await fetch(`/api/user/telegram/${tgUser.id}`);
//                               ↑ GET /api/user/telegram/123456789

if (response.ok) {
  const data = await response.json();
  window.currentUser = data.user;  // Данные из БД

  console.log('💾 Пользователь из БД:', window.currentUser);
  // {
  //   id: 1,                    ← user_id в БД
  //   telegram_id: 123456789,  ← Telegram ID
  //   first_name: "John",
  //   last_name: "Doe",
  //   username: "johndoe",
  //   photo_url: "https://...",
  //   is_premium: true,
  //   created_at: "2024-01-01T00:00:00.000Z"
  // }

  console.log('💰 Баланс:', data.balance);
  // 0.00
}
```

### 9️⃣ Обновляем UI (строка 72-86)

```javascript
// Имя
document.getElementById('username').textContent = fullName;
// → "John Doe"

// Username
document.getElementById('handle').textContent = '@johndoe';

// Баланс
document.getElementById('balance').textContent = (data.balance || 0).toFixed(2);
// → "0.00"

// Аватар
const photoUrl = tgUser.photo_url || window.currentUser.photo_url;
console.log('📷 Аватар URL:', photoUrl);
// → "https://api.telegram.org/file/bot.../photo.jpg"

if (photoUrl) {
  avatar.innerHTML = `<img src="${photoUrl}" ...>`;
} else {
  avatar.textContent = 'J';  // Первая буква имени
}
```

### 🔟 Проверяем админские права (строка 647-675)

```javascript
async function checkAdminPermission() {
  console.log('🔐 Проверка админских прав для user_id:', window.currentUser.id);
  // → 🔐 Проверка админских прав для user_id: 1

  const response = await fetch(`/api/admin/check?user_id=${window.currentUser.id}`);
  //                               ↑ GET /api/admin/check?user_id=1

  const data = await response.json();
  console.log('🔐 Результат проверки админа:', data);
  // → {success: true, isAdmin: false, permissions: null}

  if (data.isAdmin) {
    window.isAdmin = true;
    document.getElementById('admin-tab').style.display = 'flex';
    console.log('✅ Админская кнопка показана');
  } else {
    console.log('❌ Пользователь не является админом');
  }
}
```

---

## 📊 Диаграмма потока данных

```
┌─────────────┐
│ Пользователь│
│  в Telegram │
└──────┬──────┘
       │ /start
       ↓
┌─────────────────────────────────────────┐
│         Telegram Bot                    │
│  (src/bot/telegramBot.ts)              │
├─────────────────────────────────────────┤
│ 1. Получает Telegram ID пользователя   │
│ 2. Загружает фото через Bot API        │
│ 3. Создает/обновляет в БД               │
│ 4. Формирует URL с параметрами:        │
│    ?user_id=123&first_name=John&...    │
│ 5. Отправляет кнопку с этим URL        │
└──────┬──────────────────────────────────┘
       │ Нажатие на кнопку
       ↓
┌─────────────────────────────────────────┐
│         Telegram WebView                │
│  (открывается внутри Telegram)          │
├─────────────────────────────────────────┤
│ Загружается: https://your-app.com      │
│              ?user_id=123&...          │
└──────┬──────────────────────────────────┘
       │ Загрузка
       ↓
┌─────────────────────────────────────────┐
│      Frontend (public/app.js)          │
├─────────────────────────────────────────┤
│ 1. Парсит URL параметры                │
│    getUrlParams()                       │
│ 2. Создает объект tgUser               │
│ 3. Запрашивает данные из БД:           │
│    GET /api/user/telegram/123          │
│ 4. Сохраняет в window.currentUser      │
│ 5. Обновляет UI (имя, баланс, аватар)  │
│ 6. Проверяет админские права:          │
│    GET /api/admin/check?user_id=1      │
└─────────────────────────────────────────┘
```

---

## 🔍 Что хранится где

### В URL параметрах (временно):
- `user_id` - Telegram ID (123456789)
- `first_name` - Имя
- `last_name` - Фамилия
- `username` - Username
- `photo_url` - Ссылка на аватар
- `is_premium` - Премиум статус

### В window.userDataFromUrl (JavaScript):
```javascript
{
  id: 123456789,        // Telegram ID
  first_name: "John",
  last_name: "Doe",
  username: "johndoe",
  photo_url: "https://...",
  is_premium: true
}
```

### В window.currentUser (из БД):
```javascript
{
  id: 1,                // ID в базе данных ⚠️
  telegram_id: 123456789,  // Telegram ID
  first_name: "John",
  last_name: "Doe",
  username: "johndoe",
  photo_url: "https://...",
  is_premium: true,
  is_blocked: false,
  created_at: "2024-01-01T00:00:00.000Z",
  last_activity: "2024-01-01T00:00:00.000Z"
}
```

⚠️ **ВАЖНО:**
- `window.currentUser.id` = ID в базе данных (1, 2, 3...)
- `window.currentUser.telegram_id` = ID в Telegram (123456789)

---

## 🎯 Проверка что данные передались

### В консоли браузера должны быть строки:

```
🚀 App.js загружается...
✅ Telegram WebApp ready
✅ Инициализация приложения
✅ Telegram SDK загружен
🔍 URL параметры: {user_id: "123456789", first_name: "John", ...}
✅ Данные пользователя из URL параметров: {id: 123456789, ...}
💾 Пользователь из БД: {id: 1, telegram_id: 123456789, ...}
💰 Баланс: 0
📷 Аватар URL: https://api.telegram.org/file/bot.../photo.jpg
✅ Пользователь загружен и отображен в UI
✅ Приложение готово
🔐 Проверка админских прав для user_id: 1
🔐 Результат проверки админа: {success: true, isAdmin: false, ...}
❌ Пользователь не является админом
✅ App.js загружен полностью
```

### Если что-то не так:

**Нет URL параметров:**
```
🔍 URL параметры: {user_id: null, first_name: null, ...}
❌ Нет данных пользователя
```
→ Проблема: переменная `WEB_APP_URL` не настроена в `.env`

**Аватар не загружается:**
```
📷 Аватар URL: null
```
→ У пользователя нет фото в Telegram или фото не загрузилось при `/start`

**Админка не показывается:**
```
❌ Пользователь не является админом
```
→ Нужно добавить пользователя в таблицу `admins`

---

## 🛠️ Команда для проверки

В консоли браузера (F12):
```javascript
checkMyStatus()
```

Покажет все данные и где проблема! 🎯
