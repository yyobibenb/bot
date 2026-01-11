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
      --glass-bg: rgba(255, 255, 255, 0.75);
      --glass-active: rgba(255, 255, 255, 0.95);
      --glass-card: rgba(255, 255, 255, 0.75);

      --text-primary: #0f172a;
      --text-secondary: #6b7280;

      --accent-green: #22c55e;
      --accent-green-dark: #16a34a;

      --blur: blur(22px);
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
      padding-bottom: 130px;
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
      animation: avatarPulse 3s ease-in-out infinite;
    }

    .avatar-glass:active {
      transform: scale(0.96);
    }

    @keyframes avatarPulse {
      0%, 100% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.15), 0 12px 32px rgba(0, 0, 0, 0.12); }
      50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0.25), 0 14px 36px rgba(0, 0, 0, 0.16); }
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

    /* Glass Card - Balance Centered */
    .glass-card {
      margin-top: 20px;
      padding: 28px 24px;
      background: var(--glass-card);
      backdrop-filter: var(--blur);
      -webkit-backdrop-filter: var(--blur);
      border-radius: 22px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
      animation: slideUp 0.5s ease;
      text-align: center;
    }

    .balance-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }

    .balance-amount {
      font-size: 52px;
      font-weight: 700;
      color: var(--accent-green);
      letter-spacing: -0.03em;
      line-height: 1;
    }

    .balance-currency {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
      margin-left: 8px;
    }

    /* Stats - Above Buttons */
    .stats {
      display: flex;
      gap: 12px;
      margin-top: 20px;
      margin-bottom: 12px;
    }

    .stat {
      flex: 1;
      padding: 14px 12px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.65);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
      text-align: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
    }

    /* Action Buttons */
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
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
      transform: scale(0.96);
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

    /* Bottom TabBar - Bigger! */
    .tabbar {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 32px);
      max-width: 450px;

      display: flex;
      gap: 8px;
      padding: 12px 16px;

      height: 82px;

      background: var(--glass-bg);
      backdrop-filter: var(--blur);
      -webkit-backdrop-filter: var(--blur);

      border-radius: 30px;
      box-shadow:
        0 12px 36px rgba(0, 0, 0, 0.14),
        inset 0 1px 0 rgba(255, 255, 255, 0.6);

      z-index: 1000;
      animation: slideUp 0.6s ease;
    }

    .tab {
      flex: 1;
      border: none;
      background: transparent;

      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;

      padding: 10px 14px;
      border-radius: 22px;
      color: var(--text-secondary);

      cursor: pointer;
      transition: all 0.25s ease;
    }

    .tab:active {
      transform: scale(0.96);
    }

    .tab-icon {
      width: 28px;
      height: 28px;
      transition: transform 0.25s ease;
    }

    .tab-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.2px;
    }

    .tab.active {
      background: rgba(34, 197, 94, 0.15);
      color: var(--accent-green-dark);

      box-shadow:
        0 6px 18px rgba(34, 197, 94, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.5);
    }

    .tab.active .tab-icon {
      transform: translateY(-2px);
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

  <!-- Balance Card - Centered -->
  <div class="glass-card">
    <div class="balance-label">Баланс кошелька</div>
    <div>
      <span class="balance-amount" id="balance">0.00</span>
      <span class="balance-currency">USDT</span>
    </div>
  </div>

  <!-- Stats - Above Buttons -->
  <div class="stats">
    <div class="stat">🎯 Игр: 12</div>
    <div class="stat">🏆 Побед: 5</div>
  </div>

  <!-- Action Buttons -->
  <div class="actions">
    <button class="btn secondary" onclick="handleDeposit()">
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <polyline points="19 12 12 19 5 12"/>
      </svg>
      <span>Пополнить</span>
    </button>
    <button class="btn primary" onclick="handleWithdraw()">
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="19" x2="12" y2="5"/>
        <polyline points="5 12 12 5 19 12"/>
      </svg>
      <span>Вывести</span>
    </button>
  </div>

  <!-- Bottom TabBar - BIGGER -->
  <div class="tabbar">
    <button class="tab active" onclick="handleNav(event, 'profile')">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
      <span class="tab-label">Профиль</span>
    </button>
    <button class="tab" onclick="handleNav(event, 'play')">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
        <circle cx="12" cy="14" r="4"/>
        <line x1="12" y1="6" x2="12" y2="6"/>
      </svg>
      <span class="tab-label">Играть</span>
    </button>
    <button class="tab" onclick="handleNav(event, 'invite')">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="19" y1="8" x2="19" y2="14"/>
        <line x1="22" y1="11" x2="16" y2="11"/>
      </svg>
      <span class="tab-label">Пригласить</span>
    </button>
  </div>

  <script>
    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.setBackgroundColor('#f7f9f8');
    tg.setHeaderColor('#f7f9f8');

    console.log('Telegram WebApp initialized');
    console.log('Init data:', tg.initData);
    console.log('Init data unsafe:', tg.initDataUnsafe);

    // Load user data from Telegram
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
      const user = tg.initDataUnsafe.user;

      console.log('User data:', user);

      // Set username
      const fullName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
      document.getElementById('username').textContent = fullName;
      document.getElementById('handle').textContent = '@' + (user.username || 'user' + user.id);

      // Set avatar from Telegram
      const avatar = document.getElementById('avatar');

      // Telegram WebApp API doesn't directly provide photo_url
      // We need to get it from bot or use first letter
      if (user.photo_url) {
        console.log('Photo URL:', user.photo_url);
        avatar.style.backgroundImage = \`url(\${user.photo_url})\`;
        avatar.textContent = '';
      } else {
        // Use first letter as fallback
        console.log('No photo, using first letter');
        avatar.textContent = fullName.charAt(0).toUpperCase();
      }

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
          language_code: user.language_code || '',
          is_premium: user.is_premium || false
        })
      }).then(response => response.json())
        .then(data => {
          console.log('User saved:', data);
          if (data.balance !== undefined) {
            document.getElementById('balance').textContent = data.balance.toFixed(2);
          }
        })
        .catch(err => console.error('Error saving user:', err));
    } else {
      console.warn('No user data available from Telegram');
      // Show placeholder data for testing
      document.getElementById('username').textContent = 'Test User';
      document.getElementById('handle').textContent = '@testuser';
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
      document.querySelectorAll('.tab').forEach(item => {
        item.classList.remove('active');
      });
      event.currentTarget.classList.add('active');

      if (section === 'play') {
        tg.showAlert('🎮 Игра скоро будет доступна!');
      } else if (section === 'invite') {
        const user = tg.initDataUnsafe?.user;
        if (user) {
          const botUsername = 'YOUR_BOT_USERNAME';
          const inviteUrl = \`https://t.me/\${botUsername}?start=\${user.id}\`;
          const shareText = 'Присоединяйся ко мне в Casino App!';
          tg.openTelegramLink(\`https://t.me/share/url?url=\${encodeURIComponent(inviteUrl)}&text=\${encodeURIComponent(shareText)}\`);
        }
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
    const { telegram_id, username, first_name, last_name, language_code, is_premium } = req.body;

    console.log('Received user data:', { telegram_id, username, first_name, last_name });

    res.json({
      success: true,
      balance: 0.00,
      user: {
        telegram_id,
        username,
        first_name,
        last_name,
        language_code,
        is_premium
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
