# Настройка вебхука CryptoBot

## URL вебхука
```
https://bot-rl59.onrender.com/api/crypto/webhook
```

## Способы установки вебхука

### Способ 1: Через curl команду (самый быстрый)

Выполните эту команду в терминале, заменив `YOUR_API_KEY` на ваш API ключ из CryptoBot:

```bash
curl -X POST https://pay.crypt.bot/api/setWebhookUrl \
  -H "Crypto-Pay-API-Token: YOUR_API_KEY" \
  -H "Content-Type: "application/json" \
  -d '{"url": "https://bot-rl59.onrender.com/api/crypto/webhook"}'
```

### Способ 2: Через API endpoint (для админов)

Отправьте POST запрос на:
```
POST https://bot-rl59.onrender.com/api/crypto/set-webhook
```

Body:
```json
{
  "user_id": YOUR_ADMIN_USER_ID,
  "webhook_url": "https://bot-rl59.onrender.com/api/crypto/webhook"
}
```

### Способ 3: Через код (автоматически при запуске)

Добавьте в `src/bot/bot.ts` или в startup скрипт:

```typescript
import cryptoBotService from './services/CryptoBotService';

// При старте бота
const webhookUrl = `${process.env.BASE_URL}/api/crypto/webhook`;
await cryptoBotService.setWebhook(webhookUrl);
console.log('✅ CryptoBot вебхук установлен');
```

## Проверка вебхука

После установки вебхука создайте тестовый инвойс и оплатите его. В логах сервера должно появиться:
```
CryptoBot webhook received: { ... }
✅ Пополнение обработано: User 123, Amount 10 USDT
```

## Удаление вебхука

### Через curl:
```bash
curl -X POST https://pay.crypt.bot/api/deleteWebhook \
  -H "Crypto-Pay-API-Token: YOUR_API_KEY"
```

### Через API:
```
POST https://bot-rl59.onrender.com/api/crypto/delete-webhook
```

Body:
```json
{
  "user_id": YOUR_ADMIN_USER_ID
}
```

## Переменные окружения

Убедитесь, что в `.env` файле установлены:
```env
CRYPTOBOT_API_KEY=ваш_ключ_от_cryptobot
BASE_URL=https://bot-rl59.onrender.com
```

## Получение API ключа CryptoBot

1. Откройте @CryptoBot в Telegram
2. Перейдите в раздел "Crypto Pay"
3. Создайте новое приложение
4. Скопируйте API Token
5. Добавьте его в `.env` файл

## Что делает вебхук?

Когда пользователь оплачивает инвойс, CryptoBot отправляет уведомление на ваш вебхук. Обработчик:
1. Получает данные об оплате
2. Проверяет статус (должен быть "paid")
3. Зачисляет средства на баланс пользователя
4. Создаёт транзакцию в базе данных
5. Отправляет подтверждение CryptoBot

Файл обработчика: `src/server/app.ts:812`
