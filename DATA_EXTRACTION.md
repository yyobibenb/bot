# 🔍 Откуда берутся данные и как попадают в URL

## 📥 ШАГ 1: Telegram отправляет данные боту

Когда пользователь нажимает `/start`, Telegram отправляет объект `Message`:

```json
{
  "message_id": 123,
  "from": {
    "id": 123456789,              ← Telegram ID пользователя
    "first_name": "John",         ← Имя
    "last_name": "Doe",           ← Фамилия
    "username": "johndoe",        ← Username
    "is_premium": true            ← Премиум статус
  },
  "chat": { ... },
  "text": "/start"
}
```

## 🤖 ШАГ 2: Бот БЕРЕТ данные из msg.from

**Файл:** `src/bot/telegramBot.ts`
**Строка 50:** `const telegramId = msg.from?.id;`

```typescript
private async handleStart(msg: TelegramBot.Message, referralCode?: string) {
  const telegramId = msg.from?.id;  // ← 123456789 (берем ID)

  // Загружаем фото профиля через Bot API
  const photos = await this.bot.getUserProfilePhotos(telegramId);
  // photoUrl = "https://api.telegram.org/file/bot.../photo.jpg"
}
```

## 📦 ШАГ 3: Бот передает данные в функцию buildWebAppUrlWithParams

**Строки 147-153:**

```typescript
const webAppUrlWithParams = this.buildWebAppUrlWithParams({
  telegram_id: telegramId,                    // ← берем из msg.from.id (123456789)
  first_name: msg.from?.first_name,           // ← берем из msg.from.first_name ("John")
  last_name: msg.from?.last_name,             // ← берем из msg.from.last_name ("Doe")
  username: msg.from?.username,               // ← берем из msg.from.username ("johndoe")
  is_premium: (msg.from as any)?.is_premium,  // ← берем из msg.from.is_premium (true)
}, photoUrl);  // ← фото загружено через getUserProfilePhotos()
```

**❗ ВСЕ ДАННЫЕ БЕРУТСЯ НАПРЯМУЮ ИЗ `msg.from`**

## 🔗 ШАГ 4: Функция buildWebAppUrlWithParams ЗАКИДЫВАЕТ в URL

**Строки 34-57:**

```typescript
private buildWebAppUrlWithParams(user: any, photoUrl: string | null): string {
  const baseUrl = this.getWebAppUrl();  // "https://your-app.com"
  const params = new URLSearchParams();

  console.log('📋 Формирую URL с данными пользователя:');
  console.log('  - telegram_id:', user.telegram_id);      // 123456789
  console.log('  - first_name:', user.first_name);        // "John"
  console.log('  - last_name:', user.last_name);          // "Doe"
  console.log('  - username:', user.username);            // "johndoe"
  console.log('  - is_premium:', user.is_premium);        // true
  console.log('  - photo_url:', photoUrl);                // "https://..."

  // ЗАКИДЫВАЕМ в URL параметры:
  params.append('user_id', user.telegram_id.toString());  // ← user_id=123456789
  params.append('first_name', user.first_name || '');     // ← first_name=John
  if (user.last_name) params.append('last_name', user.last_name);    // ← last_name=Doe
  if (user.username) params.append('username', user.username);       // ← username=johndoe
  if (photoUrl) params.append('photo_url', photoUrl);                // ← photo_url=https://...
  if (user.is_premium) params.append('is_premium', 'true');          // ← is_premium=true

  const finalUrl = `${baseUrl}?${params.toString()}`;
  console.log('✅ Сформирован URL:', finalUrl);

  return finalUrl;
  // Результат: "https://your-app.com?user_id=123456789&first_name=John&last_name=Doe&username=johndoe&photo_url=https%3A%2F%2F...&is_premium=true"
}
```

## 📤 ШАГ 5: URL отправляется в кнопку

**Строки 154-162:**

```typescript
await this.bot.sendMessage(chatId, WELCOME_MESSAGE, {
  reply_markup: {
    keyboard: [
      [{
        text: "🚀 Открыть Mini App",
        web_app: {
          url: webAppUrlWithParams  // ← URL с параметрами
          // "https://your-app.com?user_id=123456789&first_name=John&..."
        }
      }]
    ]
  }
});
```

## 🌐 ШАГ 6: Пользователь нажимает кнопку → Telegram открывает WebView

Telegram открывает встроенный браузер и загружает:
```
https://your-app.com?user_id=123456789&first_name=John&last_name=Doe&username=johndoe&photo_url=https%3A%2F%2Fapi.telegram.org%2Ffile%2Fbot...&is_premium=true
```

## 📲 ШАГ 7: Фронтенд ЧИТАЕТ параметры из URL

**Файл:** `public/app.js`
**Строки 20-30:**

```javascript
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    user_id: params.get('user_id'),        // ← "123456789"
    first_name: params.get('first_name'),  // ← "John"
    last_name: params.get('last_name'),    // ← "Doe"
    username: params.get('username'),      // ← "johndoe"
    photo_url: params.get('photo_url'),    // ← "https://..."
    is_premium: params.get('is_premium') === 'true'  // ← true
  };
}
```

**Строки 34-50:**

```javascript
window.loadUserData = async function() {
  const urlParams = getUrlParams();
  console.log('🔍 URL параметры:', urlParams);

  if (urlParams.user_id) {
    tgUser = {
      id: parseInt(urlParams.user_id),    // ← 123456789
      first_name: urlParams.first_name,   // ← "John"
      last_name: urlParams.last_name,     // ← "Doe"
      username: urlParams.username,       // ← "johndoe"
      photo_url: urlParams.photo_url,     // ← "https://..."
      is_premium: urlParams.is_premium    // ← true
    };
    window.userDataFromUrl = tgUser;
    console.log('✅ Данные пользователя из URL параметров:', tgUser);
  }
}
```

## 🎨 ШАГ 8: UI обновляется

**Строки 72-84:**

```javascript
// Обновляем имя
document.getElementById('username').textContent = fullName;  // "John Doe"

// Обновляем username
document.getElementById('handle').textContent = '@johndoe';

// Обновляем аватар
const photoUrl = tgUser.photo_url || window.currentUser.photo_url;
if (photoUrl) {
  avatar.innerHTML = `<img src="${photoUrl}" ...>`;
}
```

---

## 🔄 ПОЛНАЯ СХЕМА ПОТОКА ДАННЫХ

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Telegram отправляет Message объект в бот                 │
│    msg.from = { id: 123456789, first_name: "John", ... }   │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Бот БЕРЕТ данные из msg.from                             │
│    telegramId = msg.from?.id                                │
│    first_name = msg.from?.first_name                        │
│    photoUrl = getUserProfilePhotos(telegramId)              │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Бот передает в buildWebAppUrlWithParams()                │
│    {                                                         │
│      telegram_id: telegramId,                               │
│      first_name: msg.from?.first_name,                      │
│      ...                                                     │
│    }                                                         │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. buildWebAppUrlWithParams ЗАКИДЫВАЕТ в URL                │
│    params.append('user_id', telegram_id)                    │
│    params.append('first_name', first_name)                  │
│    Результат: "https://app.com?user_id=123&first_name=John"│
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. URL отправляется в кнопку                                │
│    web_app: { url: "https://app.com?user_id=123&..." }     │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Пользователь нажимает → Telegram открывает URL           │
│    Браузер загружает: https://app.com?user_id=123&...      │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Фронтенд ЧИТАЕТ URL параметры                            │
│    new URLSearchParams(window.location.search)              │
│    user_id = params.get('user_id')                          │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. UI обновляется                                            │
│    document.getElementById('username').textContent = name   │
│    avatar.innerHTML = `<img src="${photo_url}">`            │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ ИТОГО - ЧТО БЕРЕТСЯ И ОТКУДА

| Что | Откуда берется | Куда закидывается |
|-----|---------------|-------------------|
| **user_id** | `msg.from.id` | `?user_id=123456789` |
| **first_name** | `msg.from.first_name` | `&first_name=John` |
| **last_name** | `msg.from.last_name` | `&last_name=Doe` |
| **username** | `msg.from.username` | `&username=johndoe` |
| **is_premium** | `msg.from.is_premium` | `&is_premium=true` |
| **photo_url** | `getUserProfilePhotos(id)` | `&photo_url=https://...` |

---

## 🐛 КАК ПРОВЕРИТЬ ЧТО ВСЕ РАБОТАЕТ

### На сервере бота (после перезапуска):

```
📋 Формирую URL с данными пользователя:
  - telegram_id: 123456789
  - first_name: John
  - last_name: Doe
  - username: johndoe
  - is_premium: true
  - photo_url: https://api.telegram.org/file/bot.../photo.jpg
✅ Сформирован URL: https://your-app.com?user_id=123456789&first_name=John&...
```

### В консоли браузера (F12):

```
🔍 URL параметры: {user_id: "123456789", first_name: "John", ...}
✅ Данные пользователя из URL параметров: {id: 123456789, first_name: "John", ...}
💾 Пользователь из БД: {id: 1, telegram_id: 123456789, ...}
📷 Аватар URL: https://api.telegram.org/file/bot.../photo.jpg
✅ Пользователь загружен и отображен в UI
```

### Команда в консоли браузера:

```javascript
checkMyStatus()
```

Покажет все данные! 🎯
