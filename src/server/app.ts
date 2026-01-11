import express from "express";
import { TelegramBotService } from "../bot/telegramBot";
import { UserModel } from "../models/User";
import { BalanceModel } from "../models/Balance";
import { GameModel } from "../models/Game";
import { DiceGameService } from "../services/DiceGameService";
import { OtherGamesService } from "../services/OtherGamesService";

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
      background: linear-gradient(160deg, #f0fdf4, #e0f2fe);
      min-height: 100vh;
      color: var(--text-primary);
      padding: 24px;
      padding-bottom: 130px;
      overflow-x: hidden;
      position: relative;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Gradient Blobs for Depth */
    .blob {
      position: fixed;
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
      animation: float 6s ease-in-out infinite;
    }

    .blob-1 {
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(34, 197, 94, 0.25), transparent 70%);
      top: -100px;
      left: -80px;
      filter: blur(70px);
    }

    .blob-2 {
      width: 250px;
      height: 250px;
      background: radial-gradient(circle, rgba(56, 189, 248, 0.2), transparent 70%);
      bottom: -80px;
      right: -60px;
      filter: blur(60px);
      animation-delay: -2s;
    }

    .blob-3 {
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(34, 197, 94, 0.15), transparent 70%);
      top: 40%;
      right: -50px;
      filter: blur(50px);
      animation-delay: -4s;
    }

    @keyframes float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(20px, -20px) scale(1.05); }
    }

    /* Content wrapper with higher z-index */
    .content {
      position: relative;
      z-index: 1;
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

      height: 70px;

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
      width: 48px;
      height: 48px;
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

    /* Screen navigation */
    .screen {
      display: none;
      animation: fadeIn 0.3s ease;
    }

    .screen.active {
      display: block;
    }

    /* Game buttons */
    .game-btn {
      padding: 14px 12px;
      background: rgba(255, 255, 255, 0.9);
      border: 2px solid transparent;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      color: var(--text-primary);
    }

    .game-btn:hover {
      background: var(--accent-green);
      color: white;
      border-color: var(--accent-green-dark);
    }

    .game-btn.selected {
      background: var(--accent-green);
      color: white;
      border-color: var(--accent-green-dark);
      transform: scale(1.05);
    }

    .game-btn small {
      display: block;
      font-size: 11px;
      opacity: 0.8;
      margin-top: 2px;
    }

    /* Dice animation */
    @keyframes spin {
      0% { transform: rotate(0deg) scale(1); }
      50% { transform: rotate(180deg) scale(1.2); }
      100% { transform: rotate(360deg) scale(1); }
    }

    .spinning {
      animation: spin 0.5s ease-in-out 3;
    }
  </style>
</head>
<body>
  <!-- Gradient Blobs -->
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>

  <!-- Content Wrapper -->
  <div class="content">
  <!-- Profile Section -->
  <div id="profile-screen" class="screen active">
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
  </div>

  <!-- Games Screen -->
  <div id="games-screen" class="screen">
    <h2 style="text-align: center; margin-bottom: 20px; font-size: 24px; font-weight: 700;">🎰 Выберите игру</h2>

    <div class="glass-card" style="cursor: pointer; margin-bottom: 12px;" onclick="openDiceGame()">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 48px;">🎲</div>
        <div style="flex: 1;">
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">Кубик</div>
          <div style="font-size: 14px; color: var(--text-secondary);">8 режимов • до 5.52x</div>
        </div>
      </div>
    </div>

    <div class="glass-card" style="opacity: 0.6; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 48px;">🎳</div>
        <div style="flex: 1;">
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">Боулинг</div>
          <div style="font-size: 14px; color: var(--text-secondary);">Скоро...</div>
        </div>
      </div>
    </div>

    <div class="glass-card" style="opacity: 0.6; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 48px;">⚽</div>
        <div style="flex: 1;">
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">Футбол</div>
          <div style="font-size: 14px; color: var(--text-secondary);">Скоро...</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Dice Game Screen -->
  <div id="dice-game-screen" class="screen">
    <button onclick="backToGames()" style="background: none; border: none; font-size: 24px; margin-bottom: 16px; cursor: pointer;">← Назад</button>

    <h2 style="text-align: center; margin-bottom: 20px; font-size: 24px; font-weight: 700;">🎲 Кубик</h2>

    <div class="glass-card" style="text-align: center;">
      <div style="font-size: 80px; margin: 20px 0;" id="dice-display">🎲</div>
      <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px;">Выберите режим игры</div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
        <button class="game-btn" onclick="selectMode('higher')">Больше 3<br><small>1.84x</small></button>
        <button class="game-btn" onclick="selectMode('lower')">Меньше 4<br><small>1.84x</small></button>
        <button class="game-btn" onclick="selectMode('even')">Четное<br><small>1.84x</small></button>
        <button class="game-btn" onclick="selectMode('odd')">Нечетное<br><small>1.84x</small></button>
        <button class="game-btn" onclick="selectMode('exact')">Грань<br><small>5.52x</small></button>
        <button class="game-btn" onclick="selectMode('duel')">Дуэль<br><small>1.84x</small></button>
      </div>

      <div style="margin: 20px 0;">
        <label style="display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px;">Ставка (USDT)</label>
        <input type="number" id="bet-input" value="1.00" min="0.1" step="0.1" style="width: 100%; padding: 12px; border-radius: 12px; border: 2px solid var(--accent-green); font-size: 16px; text-align: center;">
      </div>

      <button class="btn primary" style="width: 100%;" onclick="playDice()" id="play-btn">Бросить кубик 🎲</button>

      <div id="result-display" style="margin-top: 16px; font-size: 18px; font-weight: 600;"></div>
    </div>
  </div>

  <!-- Invite Screen -->
  <div id="invite-screen" class="screen">
    <h2 style="text-align: center; margin-bottom: 20px; font-size: 24px; font-weight: 700;">👥 Пригласить друзей</h2>
    <div class="glass-card">
      <p style="text-align: center; margin-bottom: 16px;">Приглашайте друзей и получайте 5% от их депозитов!</p>
      <button class="btn primary" style="width: 100%;" onclick="shareInvite()">Поделиться ссылкой</button>
    </div>
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
        <rect x="3" y="3" width="18" height="18" rx="2.5" ry="2.5"/>
        <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
        <circle cx="16" cy="8" r="1.5" fill="currentColor"/>
        <circle cx="8" cy="16" r="1.5" fill="currentColor"/>
        <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
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
  </div> <!-- End Content Wrapper -->

  <script>
    const tg = window.Telegram.WebApp;

    console.log('=== Telegram WebApp Debug START ===');
    console.log('1. WebApp доступен?', typeof window.Telegram !== 'undefined');
    console.log('2. tg.isVersionAtLeast:', tg.isVersionAtLeast ? tg.isVersionAtLeast('6.0') : 'N/A');
    console.log('3. Platform:', tg.platform);
    console.log('4. Version:', tg.version);
    console.log('5. initData length:', tg.initData ? tg.initData.length : 0);
    console.log('6. initData (raw):', tg.initData);
    console.log('7. initDataUnsafe (parsed):', JSON.stringify(tg.initDataUnsafe, null, 2));

    // Ready and expand
    tg.ready();
    tg.expand();
    tg.setBackgroundColor('#e8f7f9');
    tg.setHeaderColor('#e8f7f9');

    // Function to load user data
    function loadUserData() {
      console.log('=== Попытка загрузки данных пользователя ===');

      // Check if user data exists
      if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        const user = tg.initDataUnsafe.user;

        console.log('✅ ДАННЫЕ НАЙДЕНЫ!');
        console.log('User ID:', user.id);
        console.log('First name:', user.first_name);
        console.log('Last name:', user.last_name);
        console.log('Username:', user.username);
        console.log('Language:', user.language_code);
        console.log('Photo URL:', user.photo_url);

        // Set username
        const fullName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
        document.getElementById('username').textContent = fullName;
        document.getElementById('handle').textContent = '@' + (user.username || 'user' + user.id);

        // Set avatar from Telegram
        const avatar = document.getElementById('avatar');

        // Use first letter as avatar
        console.log('Устанавливаю аватар с первой буквой:', fullName.charAt(0));
        avatar.textContent = fullName.charAt(0).toUpperCase();

        // Try to get photo from bot API (need to implement)
        // For now, just use first letter

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
            console.log('✅ User saved to backend:', data);
            if (data.success && data.user) {
              currentUser = data.user;
              console.log('✅ Current user set:', currentUser);
            }
            if (data.balance !== undefined) {
              document.getElementById('balance').textContent = data.balance.toFixed(2);
            }
          })
          .catch(err => console.error('❌ Error saving user:', err));
      } else {
        console.error('❌ ДАННЫЕ НЕ НАЙДЕНЫ!');
        console.log('initData пустой?', !tg.initData || tg.initData.length === 0);
        console.log('initDataUnsafe пустой?', !tg.initDataUnsafe || Object.keys(tg.initDataUnsafe).length === 0);
        console.log('Что в initDataUnsafe:', tg.initDataUnsafe);

        console.log('📌 ВОЗМОЖНЫЕ ПРИЧИНЫ:');
        console.log('1. Mini App не открыт через Telegram бота');
        console.log('2. WEB_APP_URL не настроен в BotFather (/newapp или /myapps)');
        console.log('3. URL должен быть HTTPS (не HTTP)');
        console.log('4. Домен должен быть подтверждён в BotFather');

        // Show placeholder data for testing
        document.getElementById('username').textContent = 'Test User';
        document.getElementById('handle').textContent = '@testuser';
      }
    }

    // Load user data immediately
    loadUserData();

    // Also try again after 200ms
    setTimeout(() => {
      console.log('=== Повторная попытка через 200ms ===');
      console.log('initDataUnsafe:', tg.initDataUnsafe);
      if (tg.initDataUnsafe && tg.initDataUnsafe.user && document.getElementById('username').textContent === 'Test User') {
        loadUserData();
      }
    }, 200);

    function handleDeposit() {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
      tg.showAlert('💰 Функция пополнения скоро будет доступна!');
    }

    function handleWithdraw() {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
      tg.showAlert('💸 Функция вывода скоро будет доступна!');
    }

    // Global state
    let currentUser = null;
    let selectedGameMode = null;

    function handleNav(event, section) {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

      // Update active state on tabs
      document.querySelectorAll('.tab').forEach(item => {
        item.classList.remove('active');
      });
      event.currentTarget.classList.add('active');

      // Show appropriate screen
      document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
      });

      if (section === 'play') {
        document.getElementById('games-screen').classList.add('active');
      } else if (section === 'invite') {
        document.getElementById('invite-screen').classList.add('active');
      } else if (section === 'profile') {
        document.getElementById('profile-screen').classList.add('active');
      }
    }

    function openDiceGame() {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('dice-game-screen').classList.add('active');
    }

    function backToGames() {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('games-screen').classList.add('active');
    }

    function selectMode(mode) {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      selectedGameMode = mode;

      // Update button states
      document.querySelectorAll('.game-btn').forEach(btn => {
        btn.classList.remove('selected');
      });
      event.target.classList.add('selected');
    }

    async function playDice() {
      if (!currentUser) {
        tg.showAlert('Пожалуйста, подождите, загружаем данные...');
        return;
      }

      if (!selectedGameMode) {
        tg.showAlert('Выберите режим игры!');
        return;
      }

      const betAmount = parseFloat(document.getElementById('bet-input').value);
      if (betAmount <= 0) {
        tg.showAlert('Введите корректную ставку!');
        return;
      }

      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('heavy');

      const playBtn = document.getElementById('play-btn');
      const diceDisplay = document.getElementById('dice-display');
      const resultDisplay = document.getElementById('result-display');

      // Disable button
      playBtn.disabled = true;
      playBtn.textContent = 'Бросаем...';
      resultDisplay.textContent = '';

      // Animate dice
      diceDisplay.classList.add('spinning');

      try {
        // Determine API endpoint based on mode
        let endpoint = '';
        let body = {
          user_id: currentUser.id,
          bet_amount: betAmount
        };

        if (selectedGameMode === 'higher' || selectedGameMode === 'lower') {
          endpoint = '/api/games/dice/higher-lower';
          body.choice = selectedGameMode;
        } else if (selectedGameMode === 'even' || selectedGameMode === 'odd') {
          endpoint = '/api/games/dice/even-odd';
          body.choice = selectedGameMode;
        } else if (selectedGameMode === 'duel') {
          endpoint = '/api/games/dice/duel';
        } else if (selectedGameMode === 'exact') {
          const number = prompt('Введите число от 1 до 6:');
          if (!number || number < 1 || number > 6) {
            throw new Error('Неверное число!');
          }
          endpoint = '/api/games/dice/exact-number';
          body.choice = parseInt(number);
        }

        // Call API
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = await response.json();

        // Wait for animation
        setTimeout(() => {
          diceDisplay.classList.remove('spinning');

          if (data.success) {
            // Show result
            const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
            diceDisplay.textContent = diceEmojis[data.result - 1] || '🎲';

            if (data.isWin) {
              resultDisplay.style.color = 'var(--accent-green)';
              resultDisplay.textContent = \`🎉 Выигрыш: \${data.winAmount.toFixed(2)} USDT! (x\${data.multiplier})\`;
              if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            } else {
              resultDisplay.style.color = '#ef4444';
              resultDisplay.textContent = \`❌ Проигрыш. Результат: \${data.result}\`;
              if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
            }

            // Update balance
            document.getElementById('balance').textContent = data.newBalance.toFixed(2);
          } else {
            throw new Error(data.error || 'Ошибка игры');
          }

          playBtn.disabled = false;
          playBtn.textContent = 'Бросить кубик 🎲';
        }, 1500);

      } catch (error) {
        diceDisplay.classList.remove('spinning');
        tg.showAlert('Ошибка: ' + error.message);
        playBtn.disabled = false;
        playBtn.textContent = 'Бросить кубик 🎲';
      }
    }

    function shareInvite() {
      const user = tg.initDataUnsafe?.user;
      if (user) {
        const botUsername = 'YOUR_BOT_USERNAME'; // Replace with actual bot username
        const inviteUrl = \`https://t.me/\${botUsername}?start=ref\${user.id}\`;
        const shareText = '🎰 Присоединяйся ко мне в Casino Bot! Играй и зарабатывай!';
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
    const { telegram_id, username, first_name, last_name, language_code, is_premium } = req.body;

    console.log('Received user data:', { telegram_id, username, first_name, last_name });

    // Создаем или обновляем пользователя
    const user = await UserModel.createOrUpdate({
      telegram_id,
      username,
      first_name,
      last_name,
      language_code,
      is_premium
    });

    // Создаем баланс, если его нет
    let balance = await BalanceModel.getByUserId(user.id);
    if (!balance) {
      balance = await BalanceModel.createForUser(user.id);
    }

    res.json({
      success: true,
      balance: parseFloat(balance.balance.toString()),
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        language_code: user.language_code,
        is_premium: user.is_premium
      }
    });
  } catch (error) {
    console.error("Error saving user:", error);
    res.status(500).json({ success: false, error: "Failed to save user" });
  }
});

// API для получения списка игр
app.get("/api/games", async (req, res) => {
  try {
    const games = await GameModel.getAllGames();
    res.json({ success: true, games });
  } catch (error) {
    console.error("Error fetching games:", error);
    res.status(500).json({ success: false, error: "Failed to fetch games" });
  }
});

// API для получения режимов игры
app.get("/api/games/:gameId/modes", async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const modes = await GameModel.getGameModes(gameId);
    res.json({ success: true, modes });
  } catch (error) {
    console.error("Error fetching game modes:", error);
    res.status(500).json({ success: false, error: "Failed to fetch game modes" });
  }
});

// API для игры в кубик - Больше/Меньше
app.post("/api/games/dice/higher-lower", async (req, res) => {
  try {
    const { user_id, bet_amount, choice } = req.body;

    if (!user_id || !bet_amount || !choice) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    if (choice !== "higher" && choice !== "lower") {
      return res.status(400).json({ success: false, error: "Invalid choice" });
    }

    const result = await DiceGameService.playHigherLower(user_id, bet_amount, choice);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// API для игры в кубик - Четное/Нечетное
app.post("/api/games/dice/even-odd", async (req, res) => {
  try {
    const { user_id, bet_amount, choice } = req.body;

    if (!user_id || !bet_amount || !choice) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    if (choice !== "even" && choice !== "odd") {
      return res.status(400).json({ success: false, error: "Invalid choice" });
    }

    const result = await DiceGameService.playEvenOdd(user_id, bet_amount, choice);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// API для игры в кубик - Грань (точное число)
app.post("/api/games/dice/exact-number", async (req, res) => {
  try {
    const { user_id, bet_amount, choice } = req.body;

    if (!user_id || !bet_amount || choice === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await DiceGameService.playExactNumber(user_id, bet_amount, parseInt(choice));
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// API для игры в кубик - Сектор
app.post("/api/games/dice/sector", async (req, res) => {
  try {
    const { user_id, bet_amount, sector } = req.body;

    if (!user_id || !bet_amount || !sector) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const sectorNum = parseInt(sector);
    if (sectorNum !== 1 && sectorNum !== 2 && sectorNum !== 3) {
      return res.status(400).json({ success: false, error: "Invalid sector. Must be 1, 2, or 3" });
    }

    const result = await DiceGameService.playSector(user_id, bet_amount, sectorNum as 1 | 2 | 3);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// API для игры в кубик - Дуэль
app.post("/api/games/dice/duel", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;

    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await DiceGameService.playDuel(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// API для игры в кубик - 2X2
app.post("/api/games/dice/double", async (req, res) => {
  try {
    const { user_id, bet_amount, choice } = req.body;

    if (!user_id || !bet_amount || !choice) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await DiceGameService.playDouble(user_id, bet_amount, choice);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// API для игры в кубик - 3X3
app.post("/api/games/dice/triple", async (req, res) => {
  try {
    const { user_id, bet_amount, choice } = req.body;

    if (!user_id || !bet_amount || !choice) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await DiceGameService.playTriple(user_id, bet_amount, choice);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// API для игры в кубик - Подряд (3 числа)
app.post("/api/games/dice/sequence", async (req, res) => {
  try {
    const { user_id, bet_amount, choices } = req.body;

    if (!user_id || !bet_amount || !choices || choices.length !== 3) {
      return res.status(400).json({ success: false, error: "Missing required fields or invalid choices" });
    }

    const result = await DiceGameService.playSequence(user_id, bet_amount, choices);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing dice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// API для получения истории игр пользователя
app.get("/api/user/:userId/history", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const history = await GameModel.getUserGameHistory(userId);
    res.json({ success: true, history });
  } catch (error) {
    console.error("Error fetching game history:", error);
    res.status(500).json({ success: false, error: "Failed to fetch game history" });
  }
});

// API для получения баланса пользователя
app.get("/api/user/:userId/balance", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const balance = await BalanceModel.getByUserId(userId);

    if (!balance) {
      return res.status(404).json({ success: false, error: "Balance not found" });
    }

    res.json({
      success: true,
      balance: parseFloat(balance.balance.toString()),
      total_deposited: parseFloat(balance.total_deposited.toString()),
      total_withdrawn: parseFloat(balance.total_withdrawn.toString())
    });
  } catch (error) {
    console.error("Error fetching balance:", error);
    res.status(500).json({ success: false, error: "Failed to fetch balance" });
  }
});

// ========== БОУЛИНГ API ==========

app.post("/api/games/bowling/strike", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playBowlingStrike(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing bowling:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/bowling/duel", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playBowlingDuel(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing bowling:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// ========== ФУТБОЛ API ==========

app.post("/api/games/football/goal", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playFootballGoal(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing football:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/football/miss", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playFootballMiss(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing football:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/football/duel", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playFootballDuel(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing football:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// ========== БАСКЕТБОЛ API ==========

app.post("/api/games/basketball/goal", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playBasketballGoal(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing basketball:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/basketball/miss", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playBasketballMiss(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing basketball:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

// ========== ДАРТС API ==========

app.post("/api/games/darts/red", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playDartsRed(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing darts:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/darts/white", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playDartsWhite(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing darts:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/darts/center", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playDartsCenter(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing darts:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
  }
});

app.post("/api/games/darts/miss", async (req, res) => {
  try {
    const { user_id, bet_amount } = req.body;
    if (!user_id || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await OtherGamesService.playDartsMiss(user_id, bet_amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error playing darts:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play game" });
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
