import express from "express";
import { TelegramBotService } from "../bot/telegramBot";

const app = express();

let telegramBot: TelegramBotService | null = null;

export function setTelegramBot(bot: TelegramBotService) {
  telegramBot = bot;
  console.log("✅ Telegram бот интегрирован с сервером");
}

let keepAliveInterval: NodeJS.Timeout | null = null;

function startKeepAlive(port: number) {
  const PING_INTERVAL = 4 * 60 * 1000;
  const url = process.env.PING_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

  console.log(`🔄 Keep-alive запущен, пинг каждые 4 минуты: ${url}/health`);

  keepAliveInterval = setInterval(async () => {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        console.log(`✅ Keep-alive ping успешен: ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.log(`⚠️ Keep-alive ping ошибка: ${error}`);
    }
  }, PING_INTERVAL);
}

app.use(express.json());
app.use(express.static("public"));

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Мини Приложение</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      padding: 20px;
    }

    .container {
      max-width: 400px;
      width: 100%;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
    }

    .header h1 {
      font-size: 32px;
      margin-bottom: 10px;
      font-weight: 700;
    }

    .header p {
      font-size: 16px;
      opacity: 0.9;
    }

    .buttons {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .btn {
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 16px;
      padding: 20px;
      color: white;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .btn:active {
      transform: scale(0.95);
      background: rgba(255, 255, 255, 0.25);
    }

    .btn-icon {
      font-size: 28px;
    }

    .user-info {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 30px;
      text-align: center;
    }

    .user-name {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .user-id {
      font-size: 14px;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎮 Mini App</h1>
      <p>Добро пожаловать!</p>
    </div>

    <div class="user-info" id="user-info">
      <div class="user-name" id="user-name">Загрузка...</div>
      <div class="user-id" id="user-id"></div>
    </div>

    <div class="buttons">
      <button class="btn" onclick="handleProfile()">
        <span class="btn-icon">👤</span>
        <span>Профиль</span>
      </button>

      <button class="btn" onclick="handlePlay()">
        <span class="btn-icon">🎮</span>
        <span>Играть</span>
      </button>

      <button class="btn" onclick="handleInvite()">
        <span class="btn-icon">🤝</span>
        <span>Пригласить</span>
      </button>
    </div>
  </div>

  <script>
    const tg = window.Telegram.WebApp;
    tg.expand();

    // Показываем информацию о пользователе
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
      const user = tg.initDataUnsafe.user;
      document.getElementById('user-name').textContent = user.first_name + (user.last_name ? ' ' + user.last_name : '');
      document.getElementById('user-id').textContent = '@' + (user.username || 'user' + user.id);
    }

    function handleProfile() {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
      tg.showAlert('Открывается профиль...');
    }

    function handlePlay() {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
      tg.showAlert('Запускается игра...');
    }

    function handleInvite() {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
      const user = tg.initDataUnsafe.user;
      const botUsername = 'YOUR_BOT_USERNAME'; // Замени на username бота
      const inviteUrl = \`https://t.me/\${botUsername}?start=\${user.id}\`;
      const shareUrl = \`https://t.me/share/url?url=\${encodeURIComponent(inviteUrl)}&text=\${encodeURIComponent('Присоединяйся ко мне!')}\`;
      tg.openTelegramLink(shareUrl);
    }
  </script>
</body>
</html>
  `);
});

export function startServer(port: number) {
  app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Сервер запущен на порту ${port}`);
    startKeepAlive(port);
  });
}

const PORT = 5000;
if (require.main === module) {
  startServer(PORT);
}
