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
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', system-ui, sans-serif;
      background: #F7F9F8;
      background-image:
        radial-gradient(circle at 0% 0%, rgba(34, 197, 94, 0.08) 0%, transparent 50%),
        radial-gradient(circle at 100% 100%, rgba(34, 197, 94, 0.08) 0%, transparent 50%);
      min-height: 100vh;
      color: #0F172A;
      padding: 20px;
      padding-bottom: 120px;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Profile Section */
    .profile-section {
      text-align: center;
      margin-bottom: 24px;
      animation: fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .avatar-container {
      position: relative;
      width: 100px;
      height: 100px;
      margin: 0 auto 16px;
    }

    .avatar {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: linear-gradient(135deg, #22c55e, #10b981);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);
      background-size: cover;
      background-position: center;
      color: white;
      animation: avatarPulse 3s ease-in-out infinite;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .avatar:active {
      transform: scale(0.97);
    }

    @keyframes avatarPulse {
      0%, 100% { box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2); }
      50% { box-shadow: 0 6px 16px rgba(34, 197, 94, 0.35); }
    }

    .username {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 4px;
      color: #0F172A;
      letter-spacing: -0.02em;
    }

    .user-handle {
      font-size: 14px;
      font-weight: 400;
      color: #6B7280;
    }

    /* Balance Card - Apple Style */
    .balance-card {
      background: white;
      border-radius: 24px;
      padding: 28px 24px;
      margin-bottom: 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
      position: relative;
      overflow: hidden;
      animation: slideUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .balance-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, #22c55e, #10b981);
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
    }

    .balance-card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 80px;
      background: linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 100%);
      pointer-events: none;
    }

    .balance-label {
      font-size: 11px;
      font-weight: 600;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      margin-bottom: 8px;
    }

    .balance-amount {
      font-size: 44px;
      font-weight: 700;
      color: #22c55e;
      letter-spacing: -0.03em;
      line-height: 1;
    }

    .balance-currency {
      font-size: 18px;
      font-weight: 600;
      color: #0F172A;
      margin-left: 6px;
    }

    .wallet-address {
      background: #F7F9F8;
      border-radius: 12px;
      padding: 10px 12px;
      margin-top: 14px;
      font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
      font-size: 10px;
      font-weight: 500;
      color: #22c55e;
      word-break: break-all;
      letter-spacing: -0.02em;
    }

    /* Action Buttons - Apple Hierarchy */
    .action-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 24px;
    }

    .action-btn {
      background: white;
      border: none;
      border-radius: 16px;
      padding: 20px 16px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    /* Secondary button - white with green text */
    .action-btn.secondary {
      color: #22c55e;
    }

    .action-btn.secondary::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 100%;
      background: linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.3) 100%);
      pointer-events: none;
    }

    /* Primary button - green gradient */
    .action-btn.primary {
      background: linear-gradient(135deg, #22c55e, #10b981);
      color: white;
      box-shadow: 0 6px 16px rgba(34, 197, 94, 0.25);
    }

    .action-btn.primary::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 50%;
      background: linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%);
      pointer-events: none;
    }

    .action-btn:active {
      transform: scale(0.97);
    }

    .action-icon {
      width: 26px;
      height: 26px;
    }

    /* Bottom Navigation - Liquid Glass */
    .bottom-nav {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 40px);
      max-width: 420px;
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border-radius: 28px;
      padding: 8px;
      display: flex;
      justify-content: space-around;
      align-items: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.05);
      z-index: 1000;
      animation: slideUp 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 10px 18px;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      color: #6B7280;
      flex: 1;
    }

    .nav-item.active {
      background: linear-gradient(135deg, #22c55e, #10b981);
      color: white;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
    }

    .nav-item:active {
      transform: scale(0.95);
    }

    .nav-icon {
      width: 24px;
      height: 24px;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .nav-item.active .nav-icon {
      transform: translateY(-1px);
    }

    .nav-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.3px;
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
    <div class="avatar-container">
      <div class="avatar" id="avatar">👤</div>
    </div>
    <div class="username" id="username">Loading...</div>
    <div class="user-handle" id="handle">@username</div>
  </div>

  <!-- Balance Card -->
  <div class="balance-card">
    <div class="balance-label">Баланс кошелька</div>
    <div>
      <span class="balance-amount" id="balance">0.00</span>
      <span class="balance-currency">USDT</span>
    </div>
    <div class="wallet-address" id="wallet-address">Loading wallet...</div>
  </div>

  <!-- Action Buttons -->
  <div class="action-buttons">
    <button class="action-btn secondary" onclick="handleDeposit()">
      <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <polyline points="19 12 12 19 5 12"/>
      </svg>
      <span>Пополнить</span>
    </button>
    <button class="action-btn primary" onclick="handleWithdraw()">
      <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="19" x2="12" y2="5"/>
        <polyline points="5 12 12 5 19 12"/>
      </svg>
      <span>Вывести</span>
    </button>
  </div>

  <!-- Bottom Navigation -->
  <div class="bottom-nav">
    <div class="nav-item active" onclick="handleNav('profile')">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
      <div class="nav-label">Профиль</div>
    </div>
    <div class="nav-item" onclick="handleNav('play')">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
        <polyline points="17 2 12 7 7 2"/>
      </svg>
      <div class="nav-label">Играть</div>
    </div>
    <div class="nav-item" onclick="handleNav('invite')">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
    tg.setBackgroundColor('#F7F9F8');
    tg.setHeaderColor('#F7F9F8');

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

    function handleNav(section) {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

      // Update active state with smooth transition
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
