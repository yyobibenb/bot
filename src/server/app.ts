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
  <title>Casino App</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a1f1a 0%, #1a3a2e 50%, #0f2922 100%);
      min-height: 100vh;
      color: white;
      padding: 20px;
      padding-bottom: 120px;
      overflow-x: hidden;
    }

    /* Profile Section */
    .profile-section {
      text-align: center;
      margin-bottom: 30px;
      animation: fadeIn 0.5s ease;
    }

    .avatar-container {
      position: relative;
      width: 120px;
      height: 120px;
      margin: 0 auto 20px;
    }

    .avatar {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      border: 4px solid rgba(34, 197, 94, 0.5);
      background: linear-gradient(135deg, #22c55e, #10b981);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      box-shadow: 0 20px 60px rgba(34, 197, 94, 0.4);
      animation: glow 3s ease-in-out infinite;
    }

    @keyframes glow {
      0%, 100% { box-shadow: 0 20px 60px rgba(34, 197, 94, 0.4); }
      50% { box-shadow: 0 20px 80px rgba(34, 197, 94, 0.7); }
    }

    .username {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 5px;
      background: linear-gradient(135deg, #ffffff, #22c55e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .user-handle {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.6);
    }

    /* Balance Card */
    .balance-card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(20px);
      border-radius: 30px;
      border: 1px solid rgba(34, 197, 94, 0.2);
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.6s ease;
    }

    .balance-label {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }

    .balance-amount {
      font-size: 48px;
      font-weight: 800;
      color: #22c55e;
      margin-bottom: 5px;
      text-shadow: 0 0 30px rgba(34, 197, 94, 0.5);
    }

    .balance-currency {
      font-size: 20px;
      color: rgba(255, 255, 255, 0.8);
      margin-left: 8px;
    }

    .wallet-address {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 15px;
      padding: 12px;
      margin-top: 15px;
      font-family: 'Monaco', monospace;
      font-size: 11px;
      color: #22c55e;
      word-break: break-all;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    /* Action Buttons */
    .action-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 30px;
    }

    .action-btn {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 20px;
      padding: 16px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .action-btn:active {
      transform: scale(0.95);
      background: rgba(34, 197, 94, 0.2);
      border-color: #22c55e;
    }

    .action-btn.primary {
      background: linear-gradient(135deg, #22c55e, #10b981);
      border: none;
      box-shadow: 0 10px 30px rgba(34, 197, 94, 0.4);
    }

    .action-btn.primary:active {
      background: linear-gradient(135deg, #10b981, #059669);
    }

    /* Bottom Navigation - Oval */
    .bottom-nav {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 40px);
      max-width: 420px;
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(30px) saturate(180%);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 50px;
      padding: 12px 20px;
      display: flex;
      justify-content: space-around;
      align-items: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 100px rgba(34, 197, 94, 0.2);
      z-index: 1000;
      animation: slideUp 0.8s ease;
    }

    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.3s;
      color: rgba(255, 255, 255, 0.6);
    }

    .nav-item.active {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
      box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
    }

    .nav-item:active {
      transform: scale(0.9);
    }

    .nav-icon {
      font-size: 24px;
    }

    .nav-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Star Rating */
    .rating {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 30px;
      padding: 20px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 25px;
      border: 1px solid rgba(34, 197, 94, 0.2);
    }

    .star {
      font-size: 32px;
      filter: grayscale(1) brightness(0.5);
      transition: all 0.3s;
    }

    .star.active {
      filter: grayscale(0) brightness(1);
      animation: starGlow 0.5s ease;
    }

    @keyframes starGlow {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.2); }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Glassmorphism effect */
    .glass {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
    }
  </style>
</head>
<body>
  <!-- Profile Section -->
  <div class="profile-section">
    <div class="avatar-container">
      <div class="avatar" id="avatar">👤</div>
    </div>
    <div class="username" id="username">Loading...</div>
    <div class="user-handle" id="handle">@username</div>
  </div>

  <!-- Balance Card -->
  <div class="balance-card">
    <div class="balance-label">БАЛАНС КОШЕЛЬКА</div>
    <div>
      <span class="balance-amount" id="balance">0.00</span>
      <span class="balance-currency">USDT</span>
    </div>
    <div class="wallet-address" id="wallet-address">Loading wallet...</div>
  </div>

  <!-- Action Buttons -->
  <div class="action-buttons">
    <button class="action-btn" onclick="handleDeposit()">
      <span>⬇️</span>
      <span>Пополнить</span>
    </button>
    <button class="action-btn primary" onclick="handleWithdraw()">
      <span>⬆️</span>
      <span>Вывести</span>
    </button>
  </div>

  <!-- Rating Stars -->
  <div class="rating">
    <span class="star active">⭐</span>
    <span class="star active">⭐</span>
    <span class="star active">⭐</span>
    <span class="star">⭐</span>
    <span class="star">⭐</span>
  </div>

  <!-- Bottom Navigation -->
  <div class="bottom-nav">
    <div class="nav-item active" onclick="handleNav('profile')">
      <div class="nav-icon">👤</div>
      <div class="nav-label">Профиль</div>
    </div>
    <div class="nav-item" onclick="handleNav('play')">
      <div class="nav-icon">🎮</div>
      <div class="nav-label">Играть</div>
    </div>
    <div class="nav-item" onclick="handleNav('invite')">
      <div class="nav-icon">🤝</div>
      <div class="nav-label">Пригласить</div>
    </div>
  </div>

  <script>
    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.setBackgroundColor('#0a1f1a');
    tg.setHeaderColor('#0a1f1a');

    // Load user data
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
      const user = tg.initDataUnsafe.user;

      // Set username
      const fullName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
      document.getElementById('username').textContent = fullName;
      document.getElementById('handle').textContent = '@' + (user.username || 'user' + user.id);

      // Set avatar (first letter or photo)
      const avatar = document.getElementById('avatar');
      if (user.photo_url) {
        avatar.style.backgroundImage = \`url(\${user.photo_url})\`;
        avatar.style.backgroundSize = 'cover';
        avatar.textContent = '';
      } else {
        avatar.textContent = fullName.charAt(0).toUpperCase();
      }

      // Generate mock wallet address
      const mockAddress = 'T' + user.id.toString().padStart(33, '0');
      document.getElementById('wallet-address').textContent = mockAddress;

      // Random balance for demo
      const randomBalance = (Math.random() * 1000).toFixed(2);
      document.getElementById('balance').textContent = randomBalance;
    }

    function handleDeposit() {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
      tg.showAlert('💰 Функция пополнения скоро будет доступна!');
    }

    function handleWithdraw() {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
      tg.showAlert('💸 Функция вывода скоро будет доступна!');
    }

    function handleNav(section) {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

      // Update active state
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
      });
      event.currentTarget.classList.add('active');

      tg.showAlert('Открывается: ' + section.toUpperCase());
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
