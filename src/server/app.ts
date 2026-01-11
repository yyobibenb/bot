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
    :root {
      --glass-bg: rgba(255, 255, 255, 0.65);
      --glass-active: rgba(255, 255, 255, 0.95);
      --glass-card: rgba(255, 255, 255, 0.75);

      --text-primary: #0f172a;
      --text-secondary: #6b7280;

      --accent-green: #22c55e;
      --accent-green-dark: #16a34a;

      --blur: blur(20px);
      --radius-full: 999px;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif;
      background: #f7f9f8;
      min-height: 100vh;
      color: var(--text-primary);
      padding: 24px;
      padding-bottom: 100px;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Profile Section */
    .profile-section {
      text-align: center;
      margin-bottom: 24px;
      animation: fadeIn 0.5s ease;
    }

    .avatar-glass {
      width: 96px;
      height: 96px;
      margin: 20px auto 16px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-green), var(--accent-green-dark));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      font-weight: 600;
      color: white;
      box-shadow:
        0 0 0 6px rgba(34, 197, 94, 0.15),
        0 12px 32px rgba(0, 0, 0, 0.12);
      background-size: cover;
      background-position: center;
      transition: transform 0.3s ease;
    }

    .avatar-glass:active {
      transform: scale(0.97);
    }

    .username {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--text-primary);
      letter-spacing: -0.02em;
    }

    .user-handle {
      font-size: 14px;
      font-weight: 400;
      color: var(--text-secondary);
    }

    /* Glass Card - No borders! */
    .glass-card {
      margin-top: 20px;
      padding: 24px 20px;
      background: var(--glass-card);
      backdrop-filter: var(--blur);
      -webkit-backdrop-filter: var(--blur);
      border-radius: 22px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
      animation: slideUp 0.5s ease;
    }

    .balance-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    .balance-amount {
      font-size: 44px;
      font-weight: 700;
      color: var(--accent-green);
      letter-spacing: -0.03em;
      line-height: 1;
    }

    .balance-currency {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin-left: 6px;
    }

    .wallet-address {
      background: rgba(247, 249, 248, 0.8);
      border-radius: 12px;
      padding: 10px 12px;
      margin-top: 14px;
      font-family: 'SF Mono', 'Monaco', monospace;
      font-size: 10px;
      font-weight: 500;
      color: var(--accent-green);
      word-break: break-all;
    }

    /* Action Buttons - No borders! */
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
    }

    .btn {
      flex: 1;
      padding: 16px;
      border-radius: 18px;
      font-size: 15px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .btn:active {
      transform: scale(0.97);
    }

    .btn.primary {
      background: linear-gradient(135deg, var(--accent-green), var(--accent-green-dark));
      color: white;
      box-shadow: 0 6px 18px rgba(34, 197, 94, 0.25);
    }

    .btn.secondary {
      background: white;
      color: var(--accent-green);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
    }

    .btn-icon {
      width: 20px;
      height: 20px;
    }

    /* Bottom TabBar - Telegram Style Segmented Control */
    .tabbar-glass {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);

      display: flex;
      gap: 6px;
      padding: 6px;

      background: var(--glass-bg);
      backdrop-filter: var(--blur);
      -webkit-backdrop-filter: var(--blur);

      border-radius: var(--radius-full);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);

      z-index: 1000;
      animation: slideUp 0.6s ease;
    }

    .tab-item {
      padding: 10px 20px;
      border: none;
      background: transparent;

      border-radius: var(--radius-full);
      font-size: 15px;
      font-weight: 500;

      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.25s ease;

      white-space: nowrap;
    }

    .tab-item.active {
      background: var(--glass-active);
      color: var(--text-primary);

      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.6),
        0 4px 12px rgba(0, 0, 0, 0.08);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <!-- Profile Section -->
  <div class="profile-section">
    <div class="avatar-glass" id="avatar">👤</div>
    <div class="username" id="username">Loading...</div>
    <div class="user-handle" id="handle">@username</div>
  </div>

  <!-- Balance Card -->
  <div class="glass-card">
    <div class="balance-label">Баланс кошелька</div>
    <div>
      <span class="balance-amount" id="balance">0.00</span>
      <span class="balance-currency">USDT</span>
    </div>
    <div class="wallet-address" id="wallet-address">Loading wallet...</div>
  </div>

  <!-- Action Buttons -->
  <div class="actions">
    <button class="btn secondary" onclick="handleDeposit()">
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <polyline points="19 12 12 19 5 12"/>
      </svg>
      <span>Пополнить</span>
    </button>
    <button class="btn primary" onclick="handleWithdraw()">
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="19" x2="12" y2="5"/>
        <polyline points="5 12 12 5 19 12"/>
      </svg>
      <span>Вывести</span>
    </button>
  </div>

  <!-- Bottom TabBar - Telegram Segmented Style -->
  <div class="tabbar-glass">
    <button class="tab-item active" onclick="handleNav(event, 'profile')">
      Профиль
    </button>
    <button class="tab-item" onclick="handleNav(event, 'play')">
      Играть
    </button>
    <button class="tab-item" onclick="handleNav(event, 'invite')">
      Пригласить
    </button>
  </div>

  <script>
    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.setBackgroundColor('#f7f9f8');
    tg.setHeaderColor('#f7f9f8');

    // Load user data from Telegram
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
      const user = tg.initDataUnsafe.user;

      // Set username
      const fullName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
      document.getElementById('username').textContent = fullName;
      document.getElementById('handle').textContent = '@' + (user.username || 'user' + user.id);

      // Set avatar from Telegram profile photo
      const avatar = document.getElementById('avatar');

      if (user.photo_url) {
        avatar.style.backgroundImage = \`url(\${user.photo_url})\`;
        avatar.textContent = '';
      } else {
        avatar.textContent = fullName.charAt(0).toUpperCase();
      }

      // Generate wallet address
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

    function handleNav(event, section) {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

      // Update active state
      document.querySelectorAll('.tab-item').forEach(item => {
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
