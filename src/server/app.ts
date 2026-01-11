import express from "express";
import { userService } from "../services/userService";
import { dealService } from "../services/dealService";
import { p2pService } from "../services/p2pService";
import { QRHelper } from "../utils/qr";
import { CryptoHelper } from "../utils/crypto";
import { db } from "../db/database";
import { TelegramBotService } from "../bot/telegramBot";
import { tronHelper } from "../utils/tron";

async function getWalletBalance(address: string): Promise<number> {
  try {
    return await tronHelper.getUSDTBalance(address);
  } catch (error) {
    console.error("Error getting wallet balance:", error);
    return 0;
  }
}

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

function verifyTelegramAuth(initData: string): { valid: boolean; telegramId?: string; error?: string } {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    return { valid: false, error: "Bot token not configured" };
  }

  if (!CryptoHelper.verifyTelegramWebAppData(initData, botToken)) {
    return { valid: false, error: "Invalid Telegram data" };
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const userJson = urlParams.get('user');
    if (!userJson) {
      return { valid: false, error: "User data not found" };
    }

    const user = JSON.parse(userJson);
    return { valid: true, telegramId: user.id.toString() };
  } catch (error) {
    return { valid: false, error: "Failed to parse user data" };
  }
}

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Гарант Бот</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <!-- System fonts: SF Pro for iOS native feel -->
  <style>
    :root {
      --primary: #00D26A;
      --primary-glow: rgba(0, 210, 106, 0.2);
      --bg-gradient: linear-gradient(145deg, #f8fcf9 0%, #ffffff 100%);
      --glass: rgba(255, 255, 255, 0.7);
      --glass-border: rgba(0, 210, 106, 0.1);
      --success: #00D26A;
      --danger: #FF4757;
      --text-primary: #1d1d1f;
      --text-secondary: #86868b;
      --text-muted: #a1a1a6;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; touch-action: manipulation; }
    
    html, body {
      height: 100%;
      touch-action: manipulation;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif;
      font-weight: 400;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      background: var(--bg-gradient);
      background-attachment: fixed;
      color: var(--text-primary);
      min-height: 100vh;
    }

    h1, h2, h3, h4, h5, h6 {
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    button {
      font-family: inherit;
      font-weight: 500;
    }

    code, .mono {
      font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 500;
    }
    
    .app {
      padding-bottom: 100px;
      -webkit-user-select: none;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      overflow-x: hidden;
    }

    body::before {
      content: '';
      position: fixed;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 30% 20%, rgba(0, 210, 106, 0.08) 0%, transparent 50%),
                  radial-gradient(circle at 70% 80%, rgba(0, 210, 106, 0.05) 0%, transparent 50%);
      opacity: 0.6;
      pointer-events: none;
      z-index: 0;
    }
    
    .container {
      max-width: 100%;
      padding: 20px;
      padding-bottom: 120px;
      position: relative;
      z-index: 1;
    }
    
    .glass-card {
      background: var(--glass);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 20px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.04);
    }

    .glass-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 100%;
      background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 100%);
      pointer-events: none;
    }

    .glass-card-light {
      background: rgba(255, 255, 255, 0.4);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 210, 106, 0.05);
      border-radius: 16px;
      padding: 16px;
    }
    
    .header {
      text-align: center;
      padding: 20px 0 30px;
      color: var(--text-primary);
    }
    
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
      color: var(--text-primary);
      letter-spacing: -0.03em;
    }
    
    .header p {
      font-size: 16px;
      color: var(--text-secondary);
      font-weight: 400;
    }

    .main-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .grid-card {
      background: var(--glass);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.02);
    }

    .grid-card:active {
      transform: scale(0.96);
      background: rgba(0, 210, 106, 0.05);
      border-color: rgba(0, 210, 106, 0.2);
    }

    .grid-card-icon {
      width: 56px;
      height: 56px;
      background: #f2f2f7;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      transition: all 0.3s;
    }

    .grid-card:active .grid-card-icon {
      background: var(--primary);
      color: white;
    }

    .grid-card-text {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .balance-card {
      background: var(--glass);
      text-align: center;
      padding: 32px 24px;
      position: relative;
      box-shadow: 0 10px 40px -10px rgba(0, 210, 106, 0.1);
    }
    
    .balance-label {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 12px;
      font-weight: 500;
      letter-spacing: 0.5px;
    }
    
    .balance-amount {
      font-family: -apple-system, system-ui, sans-serif;
      font-size: 48px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1;
      letter-spacing: -0.04em;
    }
    
    .balance-currency {
      font-size: 20px;
      color: var(--text-secondary);
      margin-left: 4px;
      font-weight: 600;
    }
    
    .address-box {
      background: #f2f2f7;
      border: 1px solid rgba(0, 0, 0, 0.03);
      border-radius: 14px;
      padding: 14px;
      margin-top: 20px;
      font-family: ui-monospace, 'SF Mono', monospace;
      font-size: 12px;
      color: var(--text-primary);
      word-break: break-all;
    }
    
    .section-title {
      color: var(--text-primary);
      font-size: 20px;
      font-weight: 700;
      margin: 28px 0 16px;
      padding-left: 4px;
      letter-spacing: -0.02em;
    }
    
    .deal-card {
      background: var(--glass);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 4px 20px 0 rgba(0, 0, 0, 0.03);
    }
    
    .deal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .deal-amount {
      font-family: -apple-system, system-ui, sans-serif;
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
    }
    
    .deal-status {
      padding: 6px 14px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .status-created { 
      background: #e5e5ea; 
      color: #3a3a3c;
    }
    .status-awaiting { 
      background: #fff9e6; 
      color: #997300;
    }
    .status-confirmed { 
      background: #e8f9f0; 
      color: var(--success);
    }
    .status-completed { 
      background: #e8f9f0; 
      color: var(--success);
    }
    .status-arbitration {
      background: #fff2e6;
      color: #ff9500;
    }
    .status-cancelled { 
      background: #ffebeb; 
      color: var(--danger);
    }
    
    .deal-desc {
      color: var(--text-secondary);
      font-size: 15px;
      margin-bottom: 18px;
      line-height: 1.4;
    }
    
    .deal-btn {
      width: 100%;
      padding: 16px;
      border: none;
      border-radius: 14px;
      background: var(--primary);
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .deal-btn:active {
      transform: scale(0.97);
      opacity: 0.9;
    }
    
    .bottom-nav {
      position: fixed;
      bottom: 24px;
      left: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 24px;
      padding: 8px;
      display: flex;
      gap: 8px;
      z-index: 1000;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
    }
    
    .nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 12px 8px;
      border-radius: 18px;
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }
    
    .nav-item.active {
      background: #f2f2f7;
      color: var(--primary);
    }
    
    .nav-icon svg {
      width: 24px;
      height: 24px;
      stroke: currentColor;
      stroke-width: 2;
      fill: none;
    }
    
    .panel-icon {
      width: 48px;
      height: 48px;
      background: #f2f2f7;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .panel-icon svg {
      width: 24px;
      height: 24px;
      stroke: var(--primary);
      stroke-width: 2;
      fill: none;
    }
    
    .security-icon {
      width: 44px;
      height: 44px;
      background: #f2f2f7;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .security-icon svg {
      width: 24px;
      height: 24px;
      stroke: var(--primary);
      stroke-width: 2;
      fill: none;
    }

    .security-icon.warning svg {
      stroke: #FF6B6B;
    }
    
    .screen { display: none; }
    .screen.active { display: block; }
    
    .pin-container {
      min-height: 85vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 40px 20px;
    }

    .pin-lock-icon {
      width: 80px;
      height: 80px;
      background: #f2f2f7;
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      margin-bottom: 24px;
    }
    
    .pin-title {
      font-size: 26px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 8px;
      text-align: center;
    }
    
    .pin-subtitle {
      font-size: 15px;
      color: var(--text-secondary);
      margin-bottom: 36px;
      text-align: center;
    }
    
    .pin-dots {
      display: flex;
      gap: 20px;
      margin-bottom: 44px;
    }
    
    .pin-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #e5e5ea;
      border: none;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .pin-dot.filled {
      background: var(--primary);
      box-shadow: 0 0 10px var(--primary-glow);
      transform: scale(1.15);
    }
    
    .pin-dot.error {
      background: var(--danger);
      animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      15%, 45%, 75% { transform: translateX(-5px); }
      30%, 60%, 90% { transform: translateX(5px); }
    }
    
    .pin-dot.success {
      background: var(--success);
    }
    
    .pin-keypad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      max-width: 280px;
    }
    
    .pin-key {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.05);
      background: #f2f2f7;
      font-family: -apple-system, system-ui, sans-serif;
      font-size: 28px;
      font-weight: 300;
      color: var(--text-primary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      transition: all 0.2s;
    }
    
    .pin-key:active {
      transform: scale(0.9);
      background: #e5e5ea;
    }
    
    .pin-key.empty { 
      visibility: hidden; 
    }
    
    .pin-key.delete { 
      font-size: 22px;
      color: var(--text-secondary);
      border: none;
      background: transparent;
    }

    .pin-key.cancel {
      font-size: 16px;
      color: var(--text-secondary);
      border: none;
      background: transparent;
    }
  </style>
</head>
<body>
  <div class="app">
    <div id="pin-screen" class="screen active">
      <div class="pin-container">
        <div class="pin-lock-icon">🔒</div>
        <div class="pin-title">Введите PIN</div>
        <div class="pin-subtitle">Используйте ваш секретный код</div>
        <div class="pin-dots">
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
        </div>
        <div class="pin-keypad">
          <button class="pin-key" onclick="handlePin('1')">1</button>
          <button class="pin-key" onclick="handlePin('2')">2</button>
          <button class="pin-key" onclick="handlePin('3')">3</button>
          <button class="pin-key" onclick="handlePin('4')">4</button>
          <button class="pin-key" onclick="handlePin('5')">5</button>
          <button class="pin-key" onclick="handlePin('6')">6</button>
          <button class="pin-key" onclick="handlePin('7')">7</button>
          <button class="pin-key" onclick="handlePin('8')">8</button>
          <button class="pin-key" onclick="handlePin('9')">9</button>
          <button class="pin-key cancel" onclick="window.close()">Отмена</button>
          <button class="pin-key" onclick="handlePin('0')">0</button>
          <button class="pin-key delete" onclick="handlePin('backspace')">⌫</button>
        </div>
      </div>
    </div>

    <div id="main-screen" class="screen">
      <div class="container">
        <div class="header">
          <h1>P2P Гарант</h1>
          <p>Безопасные USDT сделки</p>
        </div>
        
        <div class="glass-card balance-card">
          <div class="balance-label">ДОСТУПНЫЙ БАЛАНС</div>
          <div class="balance-amount"><span id="user-balance">0.00</span><span class="balance-currency">USDT</span></div>
          <div class="address-box" id="wallet-address">Загрузка адреса...</div>
        </div>

        <div class="main-grid">
          <div class="grid-card" onclick="showScreen('deal-create')">
            <div class="grid-card-icon">🤝</div>
            <div class="grid-card-text">Новая сделка</div>
          </div>
          <div class="grid-card" onclick="showScreen('my-deals')">
            <div class="grid-card-icon">📋</div>
            <div class="grid-card-text">Мои сделки</div>
          </div>
          <div class="grid-card" onclick="showScreen('wallet')">
            <div class="grid-card-icon">💰</div>
            <div class="grid-card-text">Кошелек</div>
          </div>
          <div class="grid-card" onclick="showScreen('profile')">
            <div class="grid-card-icon">👤</div>
            <div class="grid-card-text">Профиль</div>
          </div>
        </div>

        <div class="section-title">Активные сделки</div>
        <div id="active-deals-container">
          <!-- Deals loaded dynamically -->
        </div>
      </div>
    </div>

    <!-- Bottom Nav - White glass style -->
    <nav class="bottom-nav">
      <button class="nav-item active" onclick="showScreen('main')">
        <div class="nav-icon">
          <svg viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
        </div>
        <span>Главная</span>
      </button>
      <button class="nav-item" onclick="showScreen('wallet')">
        <div class="nav-icon">
          <svg viewBox="0 0 24 24"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
        </div>
        <span>Кошелек</span>
      </button>
      <button class="nav-item" onclick="showScreen('deal-create')">
        <div class="nav-icon">
          <svg viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
        </div>
        <span>Сделка</span>
      </button>
      <button class="nav-item" onclick="showScreen('profile')">
        <div class="nav-icon">
          <svg viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        </div>
        <span>Профиль</span>
      </button>
    </nav>
  </div>

  <script>
    const tg = window.Telegram.WebApp;
    tg.expand();
    
    // Apple-style feedback
    if (tg.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }

    let pin = '';
    const correctPin = '1234'; // Mock PIN

    function handlePin(value) {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      
      const dots = document.querySelectorAll('.pin-dot');
      
      if (value === 'backspace') {
        if (pin.length > 0) {
          pin = pin.slice(0, -1);
          dots[pin.length].classList.remove('filled');
        }
        return;
      }

      if (pin.length < 4) {
        pin += value;
        dots[pin.length - 1].classList.add('filled');
        
        if (pin.length === 4) {
          setTimeout(() => {
            if (pin === correctPin) {
              dots.forEach(d => d.classList.add('success'));
              setTimeout(() => showScreen('main'), 300);
            } else {
              dots.forEach(d => d.classList.add('error'));
              if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
              setTimeout(() => {
                pin = '';
                dots.forEach(d => {
                  d.classList.remove('filled', 'error');
                });
              }, 600);
            }
          }, 200);
        }
      }
    }

    function showScreen(screenId) {
      if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const target = document.getElementById(screenId + '-screen');
      if (target) target.classList.add('active');
      
      // Update nav active state
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(screenId)) {
          item.classList.add('active');
        }
      });
    }

    // Initialize with mock data
    document.getElementById('wallet-address').innerText = 'TWS7...x8Y2';
    document.getElementById('user-balance').innerText = '1,250.00';
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
