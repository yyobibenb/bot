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
      background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 30%, #dcfce7 100%);
      min-height: 100vh;
      color: #1a1a1a;
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
      border: 4px solid #22c55e;
      background: linear-gradient(135deg, #22c55e, #10b981);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      box-shadow: 0 10px 40px rgba(34, 197, 94, 0.3);
      animation: glow 3s ease-in-out infinite;
      background-size: cover;
      background-position: center;
      color: white;
    }

    @keyframes glow {
      0%, 100% { box-shadow: 0 10px 40px rgba(34, 197, 94, 0.3); }
      50% { box-shadow: 0 15px 50px rgba(34, 197, 94, 0.5); }
    }

    .username {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 5px;
      background: linear-gradient(135deg, #1a1a1a, #22c55e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .user-handle {
      font-size: 14px;
      color: #6b7280;
    }

    /* Balance Card */
    .balance-card {
      background: white;
      border-radius: 30px;
      border: 2px solid #22c55e;
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 20px 60px rgba(34, 197, 94, 0.15);
      animation: slideUp 0.6s ease;
    }

    .balance-label {
      font-size: 13px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }

    .balance-amount {
      font-size: 48px;
      font-weight: 800;
      color: #22c55e;
      margin-bottom: 5px;
      text-shadow: 0 0 30px rgba(34, 197, 94, 0.3);
    }

    .balance-currency {
      font-size: 20px;
      color: #1a1a1a;
      margin-left: 8px;
    }

    .wallet-address {
      background: #f0fdf4;
      border-radius: 15px;
      padding: 12px;
      margin-top: 15px;
      font-family: 'Monaco', monospace;
      font-size: 11px;
      color: #22c55e;
      word-break: break-all;
      border: 1px solid #22c55e;
    }

    /* Action Buttons */
    .action-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 30px;
    }

    .action-btn {
      background: white;
      border: 2px solid #22c55e;
      border-radius: 20px;
      padding: 20px;
      color: #22c55e;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 10px 30px rgba(34, 197, 94, 0.1);
    }

    .action-btn:active {
      transform: scale(0.95);
      background: #f0fdf4;
    }

    .action-btn.primary {
      background: linear-gradient(135deg, #22c55e, #10b981);
      border: none;
      color: white;
      box-shadow: 0 10px 30px rgba(34, 197, 94, 0.4);
    }

    .action-btn.primary:active {
      background: linear-gradient(135deg, #10b981, #059669);
    }

    .action-icon {
      width: 32px;
      height: 32px;
    }

    /* Bottom Navigation - Oval */
    .bottom-nav {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 40px);
      max-width: 420px;
      background: white;
      border: 2px solid #22c55e;
      border-radius: 50px;
      padding: 12px 20px;
      display: flex;
      justify-content: space-around;
      align-items: center;
      box-shadow: 0 20px 60px rgba(34, 197, 94, 0.2);
      z-index: 1000;
      animation: slideUp 0.8s ease;
    }

    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 12px 20px;
      border-radius: 25px;
      cursor: pointer;
      transition: all 0.3s;
      color: #6b7280;
      flex: 1;
    }

    .nav-item.active {
      background: linear-gradient(135deg, #22c55e, #10b981);
      color: white;
      box-shadow: 0 5px 20px rgba(34, 197, 94, 0.4);
    }

    .nav-item:active {
      transform: scale(0.9);
    }

    .nav-icon {
      width: 28px;
      height: 28px;
    }

    .nav-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
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
      <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14m-7-7l7 7 7-7"/>
      </svg>
      <span>Пополнить</span>
    </button>
    <button class="action-btn primary" onclick="handleWithdraw()">
      <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 19V5m-7 7l7-7 7 7"/>
      </svg>
      <span>Вывести</span>
    </button>
  </div>

  <!-- Bottom Navigation -->
  <div class="bottom-nav">
    <div class="nav-item active" onclick="handleNav('profile')">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
      <div class="nav-label">Профиль</div>
    </div>
    <div class="nav-item" onclick="handleNav('play')">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
        <polyline points="17 2 12 7 7 2"/>
      </svg>
      <div class="nav-label">Играть</div>
    </div>
    <div class="nav-item" onclick="handleNav('invite')">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      <div class="nav-label">Пригласить</div>
    </div>
  </div>

  <script>
    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.setBackgroundColor('#ffffff');
    tg.setHeaderColor('#ffffff');

    // Load user data from Telegram
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
      const user = tg.initDataUnsafe.user;

      // Set username
      const fullName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
      document.getElementById('username').textContent = fullName;
      document.getElementById('handle').textContent = '@' + (user.username || 'user' + user.id);

      // Set avatar from Telegram profile photo
      const avatar = document.getElementById('avatar');

      // Try to get profile photo from Telegram
      if (user.photo_url) {
        avatar.style.backgroundImage = \`url(\${user.photo_url})\`;
        avatar.textContent = '';
      } else {
        // Use first letter of name
        avatar.textContent = fullName.charAt(0).toUpperCase();
      }

      // Generate wallet address based on user ID
      const mockAddress = 'TFnxsXeap4K9MzpQUecxCqumYJJyHR3rzq';
      document.getElementById('wallet-address').textContent = mockAddress;

      // Save user data to backend
      fetch('/api/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegram_id: user.id,
          username: user.username || '',
          first_name: user.first_name,
          last_name: user.last_name || '',
          photo_url: user.photo_url || ''
        })
      }).then(response => response.json())
        .then(data => {
          if (data.balance !== undefined) {
            document.getElementById('balance').textContent = data.balance.toFixed(2);
          }
        })
        .catch(err => console.error('Error saving user:', err));
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

      if (section === 'play') {
        tg.showAlert('🎮 Игра скоро будет доступна!');
      } else if (section === 'invite') {
        const user = tg.initDataUnsafe.user;
        const botUsername = 'YOUR_BOT_USERNAME';
        const inviteUrl = \`https://t.me/\${botUsername}?start=\${user.id}\`;
        const shareText = 'Присоединяйся ко мне в Casino App!';
        tg.openTelegramLink(\`https://t.me/share/url?url=\${encodeURIComponent(inviteUrl)}&text=\${encodeURIComponent(shareText)}\`);
      }
    }
  </script>
</body>
</html>
  `);
});

// API для сохранения данных пользователя
app.post("/api/user", async (req, res) => {
  try {
    const { telegram_id, username, first_name, last_name, photo_url } = req.body;

    // Здесь будет сохранение в БД
    // Пока возвращаем mock данные
    res.json({
      success: true,
      balance: 0.00,
      user: {
        telegram_id,
        username,
        first_name,
        last_name,
        photo_url
      }
    });
  } catch (error) {
    console.error("Error saving user:", error);
    res.status(500).json({ success: false, error: "Failed to save user" });
  }
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
