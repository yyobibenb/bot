import express from "express";
import { TelegramBotService } from "../bot/telegramBot";
import { UserModel } from "../models/User";
import { BalanceModel } from "../models/Balance";
import { TransactionModel } from "../models/Transaction";
import { AdminModel } from "../models/Admin";
import { GameModel } from "../models/Game";
import { DiceGameService } from "../services/DiceGameService";
import { OtherGamesService } from "../services/OtherGamesService";
import cryptoService from "../services/CryptoService";
import cryptoBotService from "../services/CryptoBotService";
import { DuelService } from "../services/DuelService";

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
  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;">
  <title>Casino App</title>
  <script>
    // Проверка что JavaScript вообще работает ДО загрузки Telegram SDK
    document.write('<div style="position:fixed;top:50px;left:0;right:0;text-align:center;background:green;color:white;padding:10px;z-index:100000;">✅ JS ТОЧНО РАБОТАЕТ! Загрузка SDK...</div>');
  </script>
  <script src="https://telegram.org/js/telegram-web-app.js" async></script>
  <style>
    :root {
      /* Luxury Casino Glass */
      --glass-bg: rgba(255, 255, 255, 0.55);
      --glass-card: rgba(255, 255, 255, 0.55);
      --glass-border: rgba(255, 255, 255, 0.35);

      /* Dark Casino Colors */
      --bg-dark: #071C15;
      --bg-dark-end: #0E3A2B;

      /* Text Colors (light for dark bg) */
      --text-primary: #F5F9F7;
      --text-secondary: #9CA3AF;
      --text-muted: #6B7280;

      /* Emerald Green */
      --emerald: #18E29A;
      --emerald-dark: #0FD88A;
      --emerald-darker: #0B3B2E;

      /* Gold Accents (for wins & VIP) */
      --gold: #F5C76A;
      --gold-dark: #FFD36A;

      /* Effects */
      --blur: blur(18px);
      --radius-card: 22px;
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
      background: linear-gradient(160deg, var(--bg-dark), var(--bg-dark-end));
      min-height: 100vh;
      color: var(--text-primary);
      padding: 24px;
      padding-bottom: 130px;
      overflow-x: hidden;
      position: relative;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Dark Emerald Blobs for Depth */
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
      background: radial-gradient(circle, rgba(24, 226, 154, 0.15), transparent 70%);
      top: -100px;
      left: -80px;
      filter: blur(70px);
    }

    .blob-2 {
      width: 250px;
      height: 250px;
      background: radial-gradient(circle, rgba(15, 216, 138, 0.12), transparent 70%);
      bottom: -80px;
      right: -60px;
      filter: blur(60px);
      animation-delay: -2s;
    }

    .blob-3 {
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(245, 199, 106, 0.08), transparent 70%);
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
      background: linear-gradient(135deg, var(--emerald), var(--emerald-dark));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      font-weight: 600;
      color: white;
      box-shadow:
        0 0 0 4px var(--glass-border),
        0 0 20px rgba(24, 226, 154, 0.4),
        0 12px 32px rgba(0, 0, 0, 0.5);
      background-size: cover;
      background-position: center;
      transition: transform 0.3s ease;
      animation: avatarPulse 3s ease-in-out infinite;
    }

    .avatar-glass:active {
      transform: scale(0.96);
    }

    @keyframes avatarPulse {
      0%, 100% {
        box-shadow: 0 0 0 4px var(--glass-border), 0 0 20px rgba(24, 226, 154, 0.4), 0 12px 32px rgba(0, 0, 0, 0.5);
      }
      50% {
        box-shadow: 0 0 0 6px var(--glass-border), 0 0 30px rgba(24, 226, 154, 0.6), 0 14px 36px rgba(0, 0, 0, 0.6);
      }
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

    /* Glass Card - Luxury Balance */
    .glass-card {
      margin-top: 20px;
      padding: 32px 24px;
      background: var(--glass-card);
      backdrop-filter: var(--blur);
      -webkit-backdrop-filter: var(--blur);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-card);
      box-shadow:
        0 10px 40px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
      animation: slideUp 0.5s ease;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .glass-card::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 20%;
      right: 20%;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--gold), transparent);
      opacity: 0.6;
    }

    .balance-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 14px;
    }

    .balance-amount {
      font-size: 56px;
      font-weight: 700;
      color: var(--emerald);
      letter-spacing: -0.03em;
      line-height: 1;
      text-shadow: 0 0 30px rgba(24, 226, 154, 0.5);
    }

    .balance-currency {
      font-size: 18px;
      font-weight: 500;
      color: var(--text-secondary);
      margin-left: 8px;
      vertical-align: middle;
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
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      text-align: center;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    }

    .stat:last-child {
      background: rgba(245, 199, 106, 0.08);
      border-color: rgba(245, 199, 106, 0.2);
      color: var(--gold-dark);
    }

    /* Action Buttons - VIP Style */
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }

    .btn {
      flex: 1;
      padding: 18px;
      border-radius: 18px;
      font-size: 15px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn:active {
      transform: scale(0.96);
    }

    /* Вывести - King Button */
    .btn.primary {
      background: linear-gradient(135deg, #1AFFA3, var(--emerald-dark));
      color: white;
      box-shadow: 0 10px 30px rgba(15, 216, 138, 0.45);
      position: relative;
      overflow: hidden;
    }

    .btn.primary::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(8px);
      opacity: 0;
      transition: opacity 0.2s;
    }

    .btn.primary:active::before {
      opacity: 1;
    }

    /* Пополнить - Glass Button */
    .btn.secondary {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: var(--text-primary);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .btn.secondary .btn-icon {
      color: var(--emerald);
    }

    .btn-icon {
      width: 20px;
      height: 20px;
    }

    /* Bottom TabBar - Luxury Glass */
    .tabbar {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 32px);
      max-width: 450px;

      display: flex;
      gap: 8px;
      padding: 10px 12px;

      height: 64px;

      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: var(--blur);
      -webkit-backdrop-filter: var(--blur);
      border: 1px solid rgba(255, 255, 255, 0.15);

      border-radius: 30px;
      box-shadow:
        0 12px 40px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);

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
      gap: 2px;

      padding: 6px 10px;
      border-radius: 22px;
      color: var(--text-muted);

      cursor: pointer;
      transition: all 0.25s ease;
    }

    .tab:active {
      transform: scale(0.96);
    }

    .tab-icon {
      width: 56px;
      height: 56px;
      transition: transform 0.25s ease;
      filter: grayscale(0.3);
    }

    .tab-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .tab.active {
      background: rgba(24, 226, 154, 0.12);
      color: var(--emerald);

      box-shadow:
        0 0 20px rgba(24, 226, 154, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    .tab.active .tab-icon {
      transform: translateY(-2px);
      filter: grayscale(0);
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
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      color: var(--text-primary);
    }

    .game-btn:hover {
      background: linear-gradient(135deg, var(--emerald), var(--emerald-dark));
      color: white;
      border-color: var(--emerald);
      box-shadow: 0 8px 20px rgba(24, 226, 154, 0.3);
    }

    .game-btn.selected {
      background: linear-gradient(135deg, var(--emerald), var(--emerald-dark));
      color: white;
      border-color: var(--emerald);
      box-shadow: 0 8px 20px rgba(24, 226, 154, 0.4);
      transform: scale(1.03);
    }

    .game-btn small {
      display: block;
      font-size: 11px;
      opacity: 0.9;
      margin-top: 2px;
      color: var(--gold);
      font-weight: 700;
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
  <!-- Debug Status Indicator -->
  <div id="debug-status" style="position: fixed; top: 0; left: 0; right: 0; background: rgba(255,0,0,0.9); color: #ffffff; padding: 10px; font-family: monospace; font-size: 14px; z-index: 99999; text-align: center; cursor: pointer; font-weight: bold;" onclick="this.style.display='none';">
    🚨 ВЕРСИЯ 7bb43a1 - ОЖИДАНИЕ JS...
  </div>

  <!-- LOG PANEL - Показываем все логи на экране -->
  <div id="log-panel" style="position: fixed; bottom: 0; left: 0; right: 0; max-height: 40vh; background: rgba(0,0,0,0.95); color: #00ff00; padding: 10px; font-family: monospace; font-size: 11px; z-index: 99998; overflow-y: auto; border-top: 2px solid #00ff00;">
    <div style="text-align: center; margin-bottom: 5px; color: #ffff00; font-weight: bold;">📋 ЛОГИ ЗАГРУЗКИ (нажми чтобы скрыть)</div>
    <div id="log-content" style="white-space: pre-wrap; word-break: break-all;"></div>
  </div>

  <!-- КРИТИЧЕСКИ ВАЖНЫЙ INLINE СКРИПТ - ВЫПОЛНЯЕТСЯ ПЕРВЫМ -->
  <script>
    // Функция для добавления логов в панель
    window.addLog = function(message, type) {
      var logContent = document.getElementById('log-content');
      if (!logContent) return;

      var timestamp = new Date().toLocaleTimeString('ru-RU', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
      var color = '#00ff00'; // green
      var icon = '📝';

      if (type === 'error') {
        color = '#ff0000';
        icon = '❌';
      } else if (type === 'warning') {
        color = '#ffaa00';
        icon = '⚠️';
      } else if (type === 'success') {
        color = '#00ff00';
        icon = '✅';
      } else if (type === 'info') {
        color = '#00aaff';
        icon = '🔍';
      }

      var logLine = document.createElement('div');
      logLine.style.color = color;
      logLine.style.marginBottom = '2px';
      logLine.textContent = timestamp + ' ' + icon + ' ' + message;
      logContent.appendChild(logLine);

      // Автоскролл вниз
      var logPanel = document.getElementById('log-panel');
      if (logPanel) logPanel.scrollTop = logPanel.scrollHeight;

      // Дублируем в консоль
      console.log(message);
    };

    // Клик по панели для скрытия
    document.getElementById('log-panel').onclick = function() {
      this.style.display = 'none';
    };

    // Отлавливаем ВСЕ ошибки JavaScript
    window.onerror = function(msg, url, line, col, error) {
      addLog('JS ERROR: ' + msg + ' (строка ' + line + ')', 'error');
      var d = document.getElementById('debug-status');
      if (d) {
        d.textContent = '❌ JS ERROR: ' + msg + ' (строка ' + line + ')';
        d.style.background = 'rgba(139,0,0,0.9)';
        d.style.color = '#ff0000';
      }
      return false;
    };

    (function() {
      try {
        addLog('INLINE JS РАБОТАЕТ!', 'success');
        var d = document.getElementById('debug-status');
        if (d) {
          d.textContent = '✅ INLINE JS РАБОТАЕТ!';
          d.style.background = 'rgba(0,139,0,0.9)';
        }
        var u = document.getElementById('username');
        if (u) {
          u.textContent = '✅ Inline скрипт выполнился';
          addLog('Username элемент найден и обновлен', 'success');
        }
      } catch(e) {
        addLog('ERROR in inline script: ' + e.message, 'error');
        var d = document.getElementById('debug-status');
        if (d) {
          d.textContent = '❌ ERROR: ' + e.message;
          d.style.background = 'rgba(139,0,0,0.9)';
        }
      }
    })();
  </script>

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

    <div class="glass-card" style="cursor: pointer; margin-bottom: 12px;" onclick="openBowlingGame()">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 48px;">🎳</div>
        <div style="flex: 1;">
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">Боулинг</div>
          <div style="font-size: 14px; color: var(--text-secondary);">2 режима • до 1.84x</div>
        </div>
      </div>
    </div>

    <div class="glass-card" style="cursor: pointer; margin-bottom: 12px;" onclick="openFootballGame()">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 48px;">⚽</div>
        <div style="flex: 1;">
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">Футбол</div>
          <div style="font-size: 14px; color: var(--text-secondary);">3 режима • до 1.84x</div>
        </div>
      </div>
    </div>

    <div class="glass-card" style="cursor: pointer; margin-bottom: 12px;" onclick="openBasketballGame()">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 48px;">🏀</div>
        <div style="flex: 1;">
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">Баскетбол</div>
          <div style="font-size: 14px; color: var(--text-secondary);">2 режима • до 1.84x</div>
        </div>
      </div>
    </div>

    <div class="glass-card" style="cursor: pointer; margin-bottom: 12px;" onclick="openDartsGame()">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 48px;">🎯</div>
        <div style="flex: 1;">
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">Дартс</div>
          <div style="font-size: 14px; color: var(--text-secondary);">4 режима • до 3.68x</div>
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

  <!-- Bowling Game Screen -->
  <div id="bowling-game-screen" class="screen">
    <button onclick="backToGames()" style="background: none; border: none; font-size: 24px; margin-bottom: 16px; cursor: pointer;">← Назад</button>

    <h2 style="text-align: center; margin-bottom: 20px; font-size: 24px; font-weight: 700;">🎳 Боулинг</h2>

    <div class="glass-card" style="text-align: center;">
      <div style="font-size: 80px; margin: 20px 0;" id="bowling-display">🎳</div>
      <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px;">Выберите режим игры</div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
        <button class="game-btn" onclick="selectBowlingMode('strike')">Страйк<br><small>1.84x</small></button>
        <button class="game-btn" onclick="selectBowlingMode('duel')">Дуэль<br><small>1.84x</small></button>
      </div>

      <div style="margin: 20px 0;">
        <label style="display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px;">Ставка (USDT)</label>
        <input type="number" id="bowling-bet-input" value="1.00" min="0.1" step="0.1" style="width: 100%; padding: 12px; border-radius: 12px; border: 2px solid var(--accent-green); font-size: 16px; text-align: center;">
      </div>

      <button class="btn primary" style="width: 100%;" onclick="playBowling()" id="bowling-play-btn">Играть 🎳</button>

      <div id="bowling-result-display" style="margin-top: 16px; font-size: 18px; font-weight: 600;"></div>
    </div>
  </div>

  <!-- Football Game Screen -->
  <div id="football-game-screen" class="screen">
    <button onclick="backToGames()" style="background: none; border: none; font-size: 24px; margin-bottom: 16px; cursor: pointer;">← Назад</button>

    <h2 style="text-align: center; margin-bottom: 20px; font-size: 24px; font-weight: 700;">⚽ Футбол</h2>

    <div class="glass-card" style="text-align: center;">
      <div style="font-size: 80px; margin: 20px 0;" id="football-display">⚽</div>
      <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px;">Выберите режим игры</div>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px;">
        <button class="game-btn" onclick="selectFootballMode('goal')">Гол<br><small>1.33x</small></button>
        <button class="game-btn" onclick="selectFootballMode('miss')">Мимо<br><small>1.84x</small></button>
        <button class="game-btn" onclick="selectFootballMode('duel')">Дуэль<br><small>1.84x</small></button>
      </div>

      <div style="margin: 20px 0;">
        <label style="display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px;">Ставка (USDT)</label>
        <input type="number" id="football-bet-input" value="1.00" min="0.1" step="0.1" style="width: 100%; padding: 12px; border-radius: 12px; border: 2px solid var(--accent-green); font-size: 16px; text-align: center;">
      </div>

      <button class="btn primary" style="width: 100%;" onclick="playFootball()" id="football-play-btn">Играть ⚽</button>

      <div id="football-result-display" style="margin-top: 16px; font-size: 18px; font-weight: 600;"></div>
    </div>
  </div>

  <!-- Basketball Game Screen -->
  <div id="basketball-game-screen" class="screen">
    <button onclick="backToGames()" style="background: none; border: none; font-size: 24px; margin-bottom: 16px; cursor: pointer;">← Назад</button>

    <h2 style="text-align: center; margin-bottom: 20px; font-size: 24px; font-weight: 700;">🏀 Баскетбол</h2>

    <div class="glass-card" style="text-align: center;">
      <div style="font-size: 80px; margin: 20px 0;" id="basketball-display">🏀</div>
      <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px;">Выберите режим игры</div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
        <button class="game-btn" onclick="selectBasketballMode('goal')">Попал<br><small>1.84x</small></button>
        <button class="game-btn" onclick="selectBasketballMode('miss')">Мимо<br><small>1.33x</small></button>
      </div>

      <div style="margin: 20px 0;">
        <label style="display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px;">Ставка (USDT)</label>
        <input type="number" id="basketball-bet-input" value="1.00" min="0.1" step="0.1" style="width: 100%; padding: 12px; border-radius: 12px; border: 2px solid var(--accent-green); font-size: 16px; text-align: center;">
      </div>

      <button class="btn primary" style="width: 100%;" onclick="playBasketball()" id="basketball-play-btn">Играть 🏀</button>

      <div id="basketball-result-display" style="margin-top: 16px; font-size: 18px; font-weight: 600;"></div>
    </div>
  </div>

  <!-- Darts Game Screen -->
  <div id="darts-game-screen" class="screen">
    <button onclick="backToGames()" style="background: none; border: none; font-size: 24px; margin-bottom: 16px; cursor: pointer;">← Назад</button>

    <h2 style="text-align: center; margin-bottom: 20px; font-size: 24px; font-weight: 700;">🎯 Дартс</h2>

    <div class="glass-card" style="text-align: center;">
      <div style="font-size: 80px; margin: 20px 0;" id="darts-display">🎯</div>
      <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px;">Выберите режим игры</div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
        <button class="game-btn" onclick="selectDartsMode('red')">Красное<br><small>3.68x</small></button>
        <button class="game-btn" onclick="selectDartsMode('white')">Белое<br><small>3.68x</small></button>
        <button class="game-btn" onclick="selectDartsMode('center')">Центр<br><small>3.68x</small></button>
        <button class="game-btn" onclick="selectDartsMode('miss')">Мимо<br><small>3.68x</small></button>
      </div>

      <div style="margin: 20px 0;">
        <label style="display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px;">Ставка (USDT)</label>
        <input type="number" id="darts-bet-input" value="1.00" min="0.1" step="0.1" style="width: 100%; padding: 12px; border-radius: 12px; border: 2px solid var(--accent-green); font-size: 16px; text-align: center;">
      </div>

      <button class="btn primary" style="width: 100%;" onclick="playDarts()" id="darts-play-btn">Играть 🎯</button>

      <div id="darts-result-display" style="margin-top: 16px; font-size: 18px; font-weight: 600;"></div>
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

  <!-- Admin Screen -->
  <div id="admin-screen" class="screen">
    <button onclick="backToProfile()" style="background: none; border: none; font-size: 24px; margin-bottom: 16px; cursor: pointer;">← Назад</button>

    <h2 style="text-align: center; margin-bottom: 20px; font-size: 24px; font-weight: 700;">👑 Админ-панель</h2>

    <div class="glass-card" style="margin-bottom: 16px;">
      <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">📊 Статистика</h3>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: var(--text-secondary);">Всего пользователей:</span>
        <span id="admin-total-users" style="font-weight: 600;">-</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--text-secondary);">С депозитами:</span>
        <span id="admin-users-deposits" style="font-weight: 600;">-</span>
      </div>
    </div>

    <div class="glass-card">
      <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">💸 Заявки на вывод</h3>
      <div id="admin-withdrawals-list" style="max-height: 400px; overflow-y: auto;">
        <p style="text-align: center; color: var(--text-secondary);">Загрузка...</p>
      </div>
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
    // САМЫЙ ПЕРВЫЙ код - проверяем что ОСНОВНОЙ СКРИПТ выполняется
    try {
      document.getElementById('debug-status').textContent = '✅ ОСНОВНОЙ СКРИПТ НАЧАЛСЯ!';
      document.getElementById('debug-status').style.background = 'rgba(0,0,139,0.9)';
      document.getElementById('username').textContent = '✅ Основной скрипт начался';
    } catch(e) {
      alert('ERROR at start of main script: ' + e.message);
    }

    // Функция для обновления статуса отладки
    window.updateDebugStatus = function(message, isError = false) {
      const debugEl = document.getElementById('debug-status');
      if (debugEl) {
        debugEl.textContent = message;
        debugEl.style.color = isError ? '#ff0000' : '#00ff00';
        debugEl.style.background = isError ? 'rgba(139,0,0,0.9)' : 'rgba(0,0,0,0.9)';
      }
      console.log(message);
    }

    // Глобальный async блок
    (async function() {
      try {
        updateDebugStatus('🔄 [1/10] Скрипт начал загружаться...');

        // Показываем что скрипт начал загружаться
        const usernameElStart = document.getElementById('username');
        console.log('🔍 username элемент найден?', !!usernameElStart, usernameElStart);
        if (usernameElStart) {
          usernameElStart.textContent = '🔄 Скрипт загружается...';
          console.log('✅ username текст установлен:', usernameElStart.textContent);
        } else {
          console.error('❌ username элемент НЕ НАЙДЕН!');
        }

        console.log('=== SCRIPT START ===');
        updateDebugStatus('🔄 [2/10] Проверка Telegram SDK...');

        // Ждем загрузки Telegram SDK (максимум 5 секунд)
        let attempts = 0;
        const maxAttempts = 50; // 50 * 100ms = 5 секунд

        while (typeof window.Telegram === 'undefined' && attempts < maxAttempts) {
          updateDebugStatus('🔄 [2/10] Ожидание SDK... (' + attempts + '/' + maxAttempts + ')');
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        // Проверяем доступность Telegram WebApp
        if (typeof window.Telegram === 'undefined') {
          updateDebugStatus('❌ ERROR: Telegram SDK не загрузился!', true);
          console.error('❌ window.Telegram не найден!');
          document.getElementById('username').textContent = '❌ Telegram SDK не загружен';
          throw new Error('Telegram SDK not loaded after 5 seconds');
        }

        const tg = window.Telegram.WebApp;
      // Сохраняем tg глобально для функций обработчиков
      window.tg = tg;
      addLog('✅ window.tg установлен', 'success');
      updateDebugStatus('✅ [3/10] Telegram SDK загружен');
      console.log('✅ Telegram SDK загружен');
      document.getElementById('username').textContent = '🔄 SDK загружен...';

      updateDebugStatus('🔄 [4/10] Инициализация Telegram...');
      addLog('=== Telegram WebApp Debug START ===', 'info');
      addLog('Platform: ' + window.tg.platform, 'info');
      addLog('Version: ' + window.tg.version, 'info');
      addLog('initData length: ' + (window.tg.initData ? window.tg.initData.length : 0), 'info');

      console.log('1. WebApp доступен?', typeof window.Telegram !== 'undefined');
      console.log('2. window.tg.isVersionAtLeast:', window.tg.isVersionAtLeast ? window.tg.isVersionAtLeast('6.0') : 'N/A');
      console.log('3. Platform:', window.tg.platform);
      console.log('4. Version:', window.tg.version);
      console.log('5. initData length:', window.tg.initData ? window.tg.initData.length : 0);
      console.log('6. initData (raw):', window.tg.initData);
      console.log('7. initDataUnsafe (parsed):', JSON.stringify(window.tg.initDataUnsafe, null, 2));

      // КРИТИЧЕСКАЯ ПРОВЕРКА ДАННЫХ
      addLog('🔍 КРИТИЧЕСКАЯ ПРОВЕРКА ДАННЫХ:', 'info');
      addLog('URL: ' + window.location.href, 'info');
      addLog('Как открыт: ' + (window.tg.platform || 'unknown'), 'info');
      addLog('initData пустой? ' + (!window.tg.initData || window.tg.initData.length === 0), 'info');
      addLog('initDataUnsafe существует? ' + !!window.tg.initDataUnsafe, 'info');
      addLog('initDataUnsafe.user существует? ' + !!(window.tg.initDataUnsafe && window.tg.initDataUnsafe.user), 'info');

      console.log('  - URL:', window.location.href);
      console.log('  - Как открыт:', window.tg.platform || 'unknown');
      console.log('  - initData пустой?', !window.tg.initData || window.tg.initData.length === 0);
      console.log('  - initDataUnsafe существует?', !!window.tg.initDataUnsafe);
      console.log('  - initDataUnsafe.user существует?', !!(window.tg.initDataUnsafe && window.tg.initDataUnsafe.user));

      if (!window.tg.initData || window.tg.initData.length === 0) {
        addLog('⚠️ ВНИМАНИЕ: initData пустой!', 'warning');
        addLog('Миниапп открыт НЕ через Telegram бота!', 'warning');
        addLog('Причина 1: Открыто через браузер', 'warning');
        addLog('Причина 2: WEB_APP_URL не настроен', 'warning');
        addLog('Причина 3: Используется HTTP вместо HTTPS', 'warning');
        console.log('⚠️ ВНИМАНИЕ: initData пустой - миниапп открыт НЕ через Telegram бота!');
        console.log('📌 Возможные причины:');
        console.log('   1. Открыто напрямую через браузер (а не через кнопку в Telegram боте)');
        console.log('   2. WEB_APP_URL не настроен правильно в BotFather');
        console.log('   3. Используется HTTP вместо HTTPS');
        updateDebugStatus('⚠️ Открыто не через бота! initData пустой', true);
      }

      if (window.tg.initDataUnsafe && window.tg.initDataUnsafe.user) {
        addLog('✅ User ID: ' + window.tg.initDataUnsafe.user.id, 'success');
        addLog('✅ User Name: ' + window.tg.initDataUnsafe.user.first_name, 'success');
        addLog('✅ Username: ' + (window.tg.initDataUnsafe.user.username || 'нет'), 'success');
        console.log('  ✅ User ID:', window.tg.initDataUnsafe.user.id);
        console.log('  ✅ User Name:', window.tg.initDataUnsafe.user.first_name);
        updateDebugStatus('✅ Данные от Telegram ЕСТЬ! User: ' + window.tg.initDataUnsafe.user.first_name);
      } else {
        addLog('❌ ДАННЫЕ ОТ TELEGRAM ОТСУТСТВУЮТ!', 'error');
        addLog('❌ initDataUnsafe: ' + JSON.stringify(window.tg.initDataUnsafe), 'error');
        console.log('  ❌ ДАННЫЕ ОТ TELEGRAM ОТСУТСТВУЮТ!');
        console.log('  ❌ window.tg.initDataUnsafe:', window.tg.initDataUnsafe);
        console.log('  ❌ Полная структура:', JSON.stringify(window.tg.initDataUnsafe));
        updateDebugStatus('❌ ДАННЫЕ ОТ TELEGRAM ОТСУТСТВУЮТ!', true);
      }

      // Ready and expand
      updateDebugStatus('🔄 [5/10] Вызов window.tg.ready()...');
      window.tg.ready();
      window.tg.expand();
      window.tg.setBackgroundColor('#071C15');
      window.tg.setHeaderColor('#071C15');

      updateDebugStatus('✅ [6/10] Telegram готов');
      document.getElementById('username').textContent = '🔄 Telegram готов...';

    // Global state - делаем доступными для обработчиков
    window.currentUser = null;
    window.selectedGameMode = null;
    window.isLoadingUser = true;

    // Функция для блокировки/разблокировки кнопок
    window.setButtonsDisabled = function(disabled) {
      const buttons = document.querySelectorAll('.btn');
      console.log('🔧 setButtonsDisabled(' + disabled + ') - найдено кнопок: ' + buttons.length);
      buttons.forEach((btn, index) => {
        if (disabled) {
          btn.classList.add('disabled');
          btn.style.opacity = '0.5';
          btn.style.pointerEvents = 'none';
          console.log('  ❌ Кнопка #' + index + ' заблокирована');
        } else {
          btn.classList.remove('disabled');
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
          console.log('  ✅ Кнопка #' + index + ' разблокирована');
        }
      });
    }

    // Function to load user data
    async function loadUserData() {
      const usernameEl = document.getElementById('username');

      updateDebugStatus('🔄 [7/10] Загрузка данных пользователя...');
      addLog('=== Загрузка данных пользователя ===', 'info');
      console.log('=== Попытка загрузки данных пользователя ===');
      console.log('Шаг 1: Начало функции loadUserData');
      if (usernameEl) usernameEl.textContent = '🔄 Загрузка данных...';

      window.isLoadingUser = true;
      setButtonsDisabled(true);
      addLog('Кнопки заблокированы (window.isLoadingUser = true)', 'info');
      console.log('Шаг 2: Кнопки заблокированы');

      try {
        updateDebugStatus('🔄 [8/10] Проверка initDataUnsafe...');
        console.log('Шаг 3: Проверка window.tg.initDataUnsafe...');
        console.log('window.tg.initDataUnsafe существует?', !!window.tg.initDataUnsafe);
        console.log('window.tg.initDataUnsafe.user существует?', !!(window.tg.initDataUnsafe && window.tg.initDataUnsafe.user));

        // Check if user data exists
        if (window.tg.initDataUnsafe && window.tg.initDataUnsafe.user) {
          const tgUser = window.tg.initDataUnsafe.user;

          console.log('✅ ДАННЫЕ ИЗ TELEGRAM НАЙДЕНЫ!');
          console.log('User ID:', tgUser.id);
          console.log('First name:', tgUser.first_name);
          console.log('Last name:', tgUser.last_name);
          console.log('Username:', tgUser.username);
          console.log('Language:', tgUser.language_code);

          const fullName = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');
          console.log('Шаг 4: Полное имя:', fullName);

          const avatar = document.getElementById('avatar');
          const usernameEl = document.getElementById('username');
          const handleEl = document.getElementById('handle');
          const balanceEl = document.getElementById('balance');

          console.log('Шаг 5: Проверка DOM элементов...');
          console.log('avatar найден?', !!avatar);
          console.log('usernameEl найден?', !!usernameEl);
          console.log('handleEl найден?', !!handleEl);
          console.log('balanceEl найден?', !!balanceEl);

          // Проверяем что элементы существуют
          if (!avatar || !usernameEl || !handleEl || !balanceEl) {
            console.error('❌ Не найдены элементы DOM!');
            console.error('Отсутствуют:', {
              avatar: !avatar,
              username: !usernameEl,
              handle: !handleEl,
              balance: !balanceEl
            });
            window.isLoadingUser = false;
            setButtonsDisabled(false);
            return;
          }

          console.log('Шаг 6: Все DOM элементы найдены, начинаем загрузку из API...');

        // Сначала пытаемся загрузить пользователя из базы (с повторными попытками)
        let retries = 3;
        let success = false;

        while (retries > 0 && !success) {
          try {
            const attemptNum = 4 - retries;
            console.log('🔍 Загружаю данные из базы... (попытка ' + attemptNum + '/3)');
            console.log('📡 Отправляю запрос: GET /api/user/telegram/' + tgUser.id);

            const response = await fetch('/api/user/telegram/' + tgUser.id);
            console.log('📨 Ответ получен. Статус: ' + response.status);

            if (response.ok) {
              // Пользователь найден в базе
              console.log('Шаг 7: Парсинг JSON ответа...');
              const data = await response.json();
              console.log('✅ Пользователь загружен из базы:', data);

              window.currentUser = data.user;
              console.log('Шаг 8: window.currentUser установлен:', window.currentUser);

              // Обновляем UI
              console.log('Шаг 9: Обновление UI элементов...');
              usernameEl.textContent = fullName;
              handleEl.textContent = '@' + (window.currentUser.username || 'user' + window.currentUser.telegram_id);
              console.log('✅ Имя и username обновлены');

              // Устанавливаем аватар из базы (если есть)
              if (window.currentUser.photo_url) {
                console.log('✅ Устанавливаю аватар из базы:', window.currentUser.photo_url);
                avatar.innerHTML = '<img src="' + window.currentUser.photo_url + '" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">';
              } else {
                console.log('📝 Аватар не найден, использую первую букву');
                avatar.textContent = fullName.charAt(0).toUpperCase();
              }

              if (data.balance !== undefined) {
                balanceEl.textContent = data.balance.toFixed(2);
                console.log(\`✅ Баланс обновлен: \${data.balance}\`);
              }

              success = true;
              updateDebugStatus('✅ [9/10] Данные загружены из базы!');
              addLog('✅ Пользователь загружен из базы', 'success');
              addLog('Username: ' + fullName, 'success');
              addLog('Balance: ' + (data.balance ? data.balance.toFixed(2) : '0.00'), 'success');
              console.log('✅ Загрузка данных успешно завершена!');
            } else if (response.status === 404) {
              // Пользователь не найден, создаем нового
              console.log('⚠️ Пользователь не найден в базе (404), создаю нового...');
              console.log('📡 Отправляю запрос: POST /api/user');

              const createResponse = await fetch('/api/user', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  telegram_id: tgUser.id,
                  username: tgUser.username || '',
                  first_name: tgUser.first_name,
                  last_name: tgUser.last_name || '',
                  language_code: tgUser.language_code || '',
                  photo_url: null, // Фото будет получено ботом при /start
                  is_premium: tgUser.is_premium || false
                })
              });

              console.log(\`📨 Ответ на создание. Статус: \${createResponse.status}\`);
              const createData = await createResponse.json();
              console.log('✅ Пользователь создан:', createData);

              if (createData.success && createData.user) {
                window.currentUser = createData.user;
                console.log('Шаг 8: window.currentUser установлен (новый):', window.currentUser);

                usernameEl.textContent = fullName;
                handleEl.textContent = '@' + (window.currentUser.username || 'user' + window.currentUser.telegram_id);
                avatar.textContent = fullName.charAt(0).toUpperCase();

                if (createData.balance !== undefined) {
                  balanceEl.textContent = createData.balance.toFixed(2);
                  console.log(\`✅ Баланс установлен: \${createData.balance}\`);
                }

                success = true;
                console.log('✅ Создание пользователя успешно завершено!');
              } else {
                console.error('❌ Ошибка: createData.success =', createData.success);
              }
            } else {
              throw new Error(\`HTTP \${response.status}\`);
            }
          } catch (error) {
            console.error(\`❌ Ошибка загрузки (попытка \${4 - retries}/3):\`, error);
            console.error('Детали ошибки:', error.message, error.stack);
            retries--;
            if (retries > 0) {
              console.log(\`⏳ Ожидаю 2 секунды перед повторной попыткой...\`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        if (!success) {
          console.error('❌ Не удалось загрузить данные после 3 попыток');
          // Показываем хотя бы базовые данные
          usernameEl.textContent = fullName;
          handleEl.textContent = '@' + (tgUser.username || 'user' + tgUser.id);
          avatar.textContent = fullName.charAt(0).toUpperCase();
          balanceEl.textContent = '0.00';
        }

          // Проверяем является ли пользователь админом
          if (window.currentUser && window.currentUser.id) {
            fetch(\`/api/admin/check?user_id=\${window.currentUser.id}\`)
              .then(res => res.json())
              .then(adminData => {
                if (adminData.success && adminData.isAdmin) {
                  console.log('✅ Пользователь - админ!', adminData.permissions);
                  window.currentUser.isAdmin = true;
                  window.currentUser.adminPermissions = adminData.permissions;

                  // Показываем кнопку админки в профиле
                  const actionsDiv = document.querySelector('.actions');
                  if (actionsDiv && !document.getElementById('admin-btn')) {
                    const adminBtn = document.createElement('button');
                    adminBtn.id = 'admin-btn';
                    adminBtn.className = 'btn secondary';
                    adminBtn.style.marginTop = '12px';
                    adminBtn.onclick = () => showAdminPanel();
                    adminBtn.innerHTML = \`
                      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                      </svg>
                      <span>Админка</span>
                    \`;
                    actionsDiv.parentNode.insertBefore(adminBtn, actionsDiv.nextSibling);
                  }
                }
              })
              .catch(err => console.error('Ошибка проверки админа:', err));
          }
        } else {
          addLog('❌ ДАННЫЕ НЕ НАЙДЕНЫ!', 'error');
          addLog('initData пустой? ' + (!window.tg.initData || window.tg.initData.length === 0), 'error');
          addLog('initDataUnsafe пустой? ' + (!window.tg.initDataUnsafe || Object.keys(window.tg.initDataUnsafe).length === 0), 'error');
          addLog('initDataUnsafe: ' + JSON.stringify(window.tg.initDataUnsafe), 'error');
          addLog('📌 ВОЗМОЖНЫЕ ПРИЧИНЫ:', 'warning');
          addLog('1. Mini App не открыт через Telegram бота', 'warning');
          addLog('2. WEB_APP_URL не настроен в BotFather', 'warning');
          addLog('3. URL должен быть HTTPS (не HTTP)', 'warning');
          addLog('4. Домен не подтверждён в BotFather', 'warning');

          console.error('❌ ДАННЫЕ НЕ НАЙДЕНЫ!');
          console.log('initData пустой?', !window.tg.initData || window.tg.initData.length === 0);
          console.log('initDataUnsafe пустой?', !window.tg.initDataUnsafe || Object.keys(window.tg.initDataUnsafe).length === 0);
          console.log('Что в initDataUnsafe:', window.tg.initDataUnsafe);

          console.log('📌 ВОЗМОЖНЫЕ ПРИЧИНЫ:');
          console.log('1. Mini App не открыт через Telegram бота');
          console.log('2. WEB_APP_URL не настроен в BotFather (/newapp или /myapps)');
          console.log('3. URL должен быть HTTPS (не HTTP)');
          console.log('4. Домен должен быть подтверждён в BotFather');

          // Show error in UI
          const usernameElTemp = document.getElementById('username');
          const handleElTemp = document.getElementById('handle');
          if (usernameElTemp) usernameElTemp.textContent = '❌ Нет данных от Telegram';
          if (handleElTemp) handleElTemp.textContent = 'Откройте через бота!';

          // Show alert
          if (window.tg.showAlert) {
            window.tg.showAlert('❌ Ошибка: Mini App должен быть открыт через Telegram бота. Нажмите /start в боте.');
          }
        }
      } catch (err) {
        console.error('❌ Критическая ошибка в loadUserData:', err);
        const usernameElErr = document.getElementById('username');
        if (usernameElErr) usernameElErr.textContent = '❌ Критическая ошибка!';

        // Show alert
        if (window.tg.showAlert) {
          window.tg.showAlert('❌ Критическая ошибка: ' + (err.message || err));
        }
      } finally {
        // Разблокируем кнопки после завершения загрузки
        addLog('🎯 FINALLY: Завершение загрузки', 'info');
        console.log('🎯 FINALLY БЛОК ВЫПОЛНЯЕТСЯ!');
        console.log('  window.isLoadingUser перед:', window.isLoadingUser);
        window.isLoadingUser = false;
        console.log('  window.isLoadingUser после:', window.isLoadingUser);
        addLog('Устанавливаю window.isLoadingUser = false', 'info');
        console.log('  Вызываю setButtonsDisabled(false)...');
        setButtonsDisabled(false);
        addLog('✅ Кнопки разблокированы!', 'success');
        console.log('✅ Загрузка завершена, кнопки разблокированы');
      }
    }

    // Load user data immediately
    console.log('🚀 Вызываю loadUserData()...');
    const usernameElBeforeLoad = document.getElementById('username');
    console.log('🔍 username элемент перед loadUserData:', !!usernameElBeforeLoad);
    if (usernameElBeforeLoad) {
      usernameElBeforeLoad.textContent = '🚀 Запускаю загрузку...';
      console.log('✅ Установлен текст:', usernameElBeforeLoad.textContent);
    }
    loadUserData().then(() => {
      updateDebugStatus('✅ [10/10] Готово! Нажми для скрытия', false);
      // Скрываем индикатор через 3 секунды
      setTimeout(() => {
        const debugEl = document.getElementById('debug-status');
        if (debugEl) debugEl.style.display = 'none';
      }, 3000);
    }).catch(err => {
      updateDebugStatus('❌ ERROR: ' + err.message, true);
    });

    // Делаем функции доступными глобально для onclick
    window.handleDeposit = async function handleDeposit() {
      addLog('🔘 Нажата кнопка Пополнить', 'info');
      if (!window.tg) {
        addLog('❌ tg не определен!', 'error');
        alert('Ошибка: Telegram WebApp не загружен');
        return;
      }
      const tg = window.tg;
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('medium');

      if (window.isLoadingUser || !window.currentUser) {
        window.tg.showAlert('Подождите, загружаем данные...');
        return;
      }

      const amount = prompt('Введите сумму пополнения (USDT):\n\nМинимум: 10 USDT');

      if (!amount) return;

      const depositAmount = parseFloat(amount);

      if (isNaN(depositAmount) || depositAmount < 10) {
        window.tg.showAlert('Некорректная сумма. Минимум: 10 USDT');
        return;
      }

      try {
        // Создаем инвойс через CryptoBot API
        const response = await fetch('/api/crypto/create-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: window.currentUser.id,
            amount: depositAmount
          })
        });

        const data = await response.json();

        if (data.success && data.invoice_url) {
          window.tg.openLink(data.invoice_url);
          window.tg.showAlert('Счет создан! Оплатите в открывшемся окне CryptoBot.');
        } else {
          window.tg.showAlert('❌ Ошибка: ' + (data.error || 'Не удалось создать счет'));
        }
      } catch (error) {
        window.tg.showAlert('❌ Ошибка при создании счета');
      }
    };

    window.handleWithdraw = async function handleWithdraw() {
      addLog('🔘 Нажата кнопка Вывести', 'info');
      if (!window.tg) {
        addLog('❌ tg не определен!', 'error');
        alert('Ошибка: Telegram WebApp не загружен');
        return;
      }
      const tg = window.tg;
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('medium');

      if (window.isLoadingUser || !window.currentUser) {
        window.tg.showAlert('Подождите, загружаем данные...');
        return;
      }

      const balance = parseFloat(document.getElementById('balance').textContent || '0');

      if (balance < 10) {
        window.tg.showAlert('Недостаточно средств для вывода. Минимум: 10 USDT');
        return;
      }

      const amount = prompt('Введите сумму вывода (USDT):\\n\\nДоступно: ' + balance + ' USDT\\nМинимум: 10 USDT');

      if (!amount) return;

      const withdrawAmount = parseFloat(amount);

      if (isNaN(withdrawAmount) || withdrawAmount < 10) {
        window.tg.showAlert('Некорректная сумма. Минимум: 10 USDT');
        return;
      }

      if (withdrawAmount > balance) {
        window.tg.showAlert('Недостаточно средств. Доступно: ' + balance + ' USDT');
        return;
      }

      try {
        // Отправляем запрос на вывод
        const response = await fetch('/api/withdraw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: window.currentUser.id,
            telegram_id: window.currentUser.telegram_id,
            amount: withdrawAmount
          })
        });

        const data = await response.json();

        if (data.success) {
          // Обновляем баланс
          document.getElementById('balance').textContent = data.newBalance.toFixed(2);
          window.tg.showAlert('✅ Заявка на вывод создана!\\n\\nСумма: ' + withdrawAmount + ' USDT\\n\\nСредства будут отправлены через @send в течение 1-24 часов.');
        } else {
          window.tg.showAlert('❌ Ошибка: ' + (data.error || 'Не удалось создать заявку'));
        }
      } catch (error) {
        window.tg.showAlert('❌ Ошибка при создании заявки на вывод');
      }
    };

    window.handleNav = function(event, section) {
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('light');

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

    window.openDiceGame = function() {
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('medium');
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('dice-game-screen').classList.add('active');
    }

    window.backToGames = function() {
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('light');
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('games-screen').classList.add('active');
    }

    window.selectMode = function(mode) {
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('light');
      window.selectedGameMode = mode;

      // Update button states
      document.querySelectorAll('.game-btn').forEach(btn => {
        btn.classList.remove('selected');
      });
      event.target.classList.add('selected');
    }

    async function playDice() {
      if (!window.currentUser) {
        window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
        return;
      }

      if (!window.selectedGameMode) {
        window.tg.showAlert('Выберите режим игры!');
        return;
      }

      const betAmount = parseFloat(document.getElementById('bet-input').value);
      if (betAmount <= 0) {
        window.tg.showAlert('Введите корректную ставку!');
        return;
      }

      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('heavy');

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
          user_id: window.currentUser.id,
          bet_amount: betAmount
        };

        if (window.selectedGameMode === 'higher' || window.selectedGameMode === 'lower') {
          endpoint = '/api/games/dice/higher-lower';
          body.choice = window.selectedGameMode;
        } else if (window.selectedGameMode === 'even' || window.selectedGameMode === 'odd') {
          endpoint = '/api/games/dice/even-odd';
          body.choice = window.selectedGameMode;
        } else if (window.selectedGameMode === 'duel') {
          endpoint = '/api/games/dice/duel';
        } else if (window.selectedGameMode === 'exact') {
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
              if (window.tg.HapticFeedback) window.tg.HapticFeedback.notificationOccurred('success');
            } else {
              resultDisplay.style.color = '#ef4444';
              resultDisplay.textContent = \`❌ Проигрыш. Результат: \${data.result}\`;
              if (window.tg.HapticFeedback) window.tg.HapticFeedback.notificationOccurred('error');
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
        window.tg.showAlert('Ошибка: ' + error.message);
        playBtn.disabled = false;
        playBtn.textContent = 'Бросить кубик 🎲';
      }
    }

    // === BOWLING GAME ===
    let selectedBowlingMode = null;

    window.openBowlingGame = function() {
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('medium');
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('bowling-game-screen').classList.add('active');
    }

    window.selectBowlingMode = function(mode) {
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('light');
      selectedBowlingMode = mode;
      document.querySelectorAll('#bowling-game-screen .game-btn').forEach(btn => btn.classList.remove('selected'));
      event.target.classList.add('selected');
    }

    async function playBowling() {
      if (!window.currentUser) {
        window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
        return;
      }
      if (!selectedBowlingMode) {
        window.tg.showAlert('Выберите режим игры!');
        return;
      }

      const betAmount = parseFloat(document.getElementById('bowling-bet-input').value);
      if (betAmount <= 0) {
        window.tg.showAlert('Введите корректную ставку!');
        return;
      }

      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('heavy');

      const playBtn = document.getElementById('bowling-play-btn');
      const display = document.getElementById('bowling-display');
      const resultDisplay = document.getElementById('bowling-result-display');

      playBtn.disabled = true;
      playBtn.textContent = 'Играем...';
      resultDisplay.textContent = '';

      try {
        const endpoint = selectedBowlingMode === 'strike' ? '/api/games/bowling/strike' : '/api/games/bowling/duel';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: window.currentUser.id, bet_amount: betAmount })
        });

        const data = await response.json();

        if (data.success && data.isWin) {
          resultDisplay.innerHTML = \`<span style="color: var(--accent-green);">🎉 Выигрыш: +\${data.winAmount} USDT</span>\`;
          if (window.tg.HapticFeedback) window.tg.HapticFeedback.notificationOccurred('success');
        } else {
          resultDisplay.innerHTML = \`<span style="color: #ef4444;">❌ Проигрыш: -\${betAmount} USDT</span>\`;
          if (window.tg.HapticFeedback) window.tg.HapticFeedback.notificationOccurred('error');
        }

        document.getElementById('balance').textContent = data.newBalance.toFixed(2);
        playBtn.disabled = false;
        playBtn.textContent = 'Играть 🎳';
      } catch (error) {
        window.tg.showAlert('Ошибка: ' + error.message);
        playBtn.disabled = false;
        playBtn.textContent = 'Играть 🎳';
      }
    }

    // === FOOTBALL GAME ===
    let selectedFootballMode = null;

    window.openFootballGame = function() {
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('medium');
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('football-game-screen').classList.add('active');
    }

    window.selectFootballMode = function(mode) {
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('light');
      selectedFootballMode = mode;
      document.querySelectorAll('#football-game-screen .game-btn').forEach(btn => btn.classList.remove('selected'));
      event.target.classList.add('selected');
    }

    async function playFootball() {
      if (!window.currentUser) {
        window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
        return;
      }
      if (!selectedFootballMode) {
        window.tg.showAlert('Выберите режим игры!');
        return;
      }

      const betAmount = parseFloat(document.getElementById('football-bet-input').value);
      if (betAmount <= 0) {
        window.tg.showAlert('Введите корректную ставку!');
        return;
      }

      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('heavy');

      const playBtn = document.getElementById('football-play-btn');
      const display = document.getElementById('football-display');
      const resultDisplay = document.getElementById('football-result-display');

      playBtn.disabled = true;
      playBtn.textContent = 'Играем...';
      resultDisplay.textContent = '';

      try {
        let endpoint = '';
        if (selectedFootballMode === 'goal') endpoint = '/api/games/football/goal';
        else if (selectedFootballMode === 'miss') endpoint = '/api/games/football/miss';
        else endpoint = '/api/games/football/duel';

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: window.currentUser.id, bet_amount: betAmount })
        });

        const data = await response.json();

        if (data.success && data.isWin) {
          resultDisplay.innerHTML = \`<span style="color: var(--accent-green);">🎉 Выигрыш: +\${data.winAmount} USDT</span>\`;
          if (window.tg.HapticFeedback) window.tg.HapticFeedback.notificationOccurred('success');
        } else {
          resultDisplay.innerHTML = \`<span style="color: #ef4444;">❌ Проигрыш: -\${betAmount} USDT</span>\`;
          if (window.tg.HapticFeedback) window.tg.HapticFeedback.notificationOccurred('error');
        }

        document.getElementById('balance').textContent = data.newBalance.toFixed(2);
        playBtn.disabled = false;
        playBtn.textContent = 'Играть ⚽';
      } catch (error) {
        window.tg.showAlert('Ошибка: ' + error.message);
        playBtn.disabled = false;
        playBtn.textContent = 'Играть ⚽';
      }
    }

    // === BASKETBALL GAME ===
    let selectedBasketballMode = null;

    window.openBasketballGame = function() {
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('medium');
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('basketball-game-screen').classList.add('active');
    }

    window.selectBasketballMode = function(mode) {
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('light');
      selectedBasketballMode = mode;
      document.querySelectorAll('#basketball-game-screen .game-btn').forEach(btn => btn.classList.remove('selected'));
      event.target.classList.add('selected');
    }

    async function playBasketball() {
      if (!window.currentUser) {
        window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
        return;
      }
      if (!selectedBasketballMode) {
        window.tg.showAlert('Выберите режим игры!');
        return;
      }

      const betAmount = parseFloat(document.getElementById('basketball-bet-input').value);
      if (betAmount <= 0) {
        window.tg.showAlert('Введите корректную ставку!');
        return;
      }

      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('heavy');

      const playBtn = document.getElementById('basketball-play-btn');
      const display = document.getElementById('basketball-display');
      const resultDisplay = document.getElementById('basketball-result-display');

      playBtn.disabled = true;
      playBtn.textContent = 'Играем...';
      resultDisplay.textContent = '';

      try {
        const endpoint = selectedBasketballMode === 'goal' ? '/api/games/basketball/goal' : '/api/games/basketball/miss';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: window.currentUser.id, bet_amount: betAmount })
        });

        const data = await response.json();

        if (data.success && data.isWin) {
          resultDisplay.innerHTML = \`<span style="color: var(--accent-green);">🎉 Выигрыш: +\${data.winAmount} USDT</span>\`;
          if (window.tg.HapticFeedback) window.tg.HapticFeedback.notificationOccurred('success');
        } else {
          resultDisplay.innerHTML = \`<span style="color: #ef4444;">❌ Проигрыш: -\${betAmount} USDT</span>\`;
          if (window.tg.HapticFeedback) window.tg.HapticFeedback.notificationOccurred('error');
        }

        document.getElementById('balance').textContent = data.newBalance.toFixed(2);
        playBtn.disabled = false;
        playBtn.textContent = 'Играть 🏀';
      } catch (error) {
        window.tg.showAlert('Ошибка: ' + error.message);
        playBtn.disabled = false;
        playBtn.textContent = 'Играть 🏀';
      }
    }

    // === DARTS GAME ===
    let selectedDartsMode = null;

    window.openDartsGame = function() {
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('medium');
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('darts-game-screen').classList.add('active');
    }

    window.selectDartsMode = function(mode) {
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('light');
      selectedDartsMode = mode;
      document.querySelectorAll('#darts-game-screen .game-btn').forEach(btn => btn.classList.remove('selected'));
      event.target.classList.add('selected');
    }

    async function playDarts() {
      if (!window.currentUser) {
        window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
        return;
      }
      if (!selectedDartsMode) {
        window.tg.showAlert('Выберите режим игры!');
        return;
      }

      const betAmount = parseFloat(document.getElementById('darts-bet-input').value);
      if (betAmount <= 0) {
        window.tg.showAlert('Введите корректную ставку!');
        return;
      }

      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('heavy');

      const playBtn = document.getElementById('darts-play-btn');
      const display = document.getElementById('darts-display');
      const resultDisplay = document.getElementById('darts-result-display');

      playBtn.disabled = true;
      playBtn.textContent = 'Играем...';
      resultDisplay.textContent = '';

      try {
        let endpoint = '';
        if (selectedDartsMode === 'red') endpoint = '/api/games/darts/red';
        else if (selectedDartsMode === 'white') endpoint = '/api/games/darts/white';
        else if (selectedDartsMode === 'center') endpoint = '/api/games/darts/center';
        else endpoint = '/api/games/darts/miss';

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: window.currentUser.id, bet_amount: betAmount })
        });

        const data = await response.json();

        if (data.success && data.isWin) {
          resultDisplay.innerHTML = \`<span style="color: var(--accent-green);">🎉 Выигрыш: +\${data.winAmount} USDT</span>\`;
          if (window.tg.HapticFeedback) window.tg.HapticFeedback.notificationOccurred('success');
        } else {
          resultDisplay.innerHTML = \`<span style="color: #ef4444;">❌ Проигрыш: -\${betAmount} USDT</span>\`;
          if (window.tg.HapticFeedback) window.tg.HapticFeedback.notificationOccurred('error');
        }

        document.getElementById('balance').textContent = data.newBalance.toFixed(2);
        playBtn.disabled = false;
        playBtn.textContent = 'Играть 🎯';
      } catch (error) {
        window.tg.showAlert('Ошибка: ' + error.message);
        playBtn.disabled = false;
        playBtn.textContent = 'Играть 🎯';
      }
    }

    window.shareInvite = function() {
      const user = window.tg.initDataUnsafe?.user;
      if (user) {
        const botUsername = 'YOUR_BOT_USERNAME'; // Replace with actual bot username
        const inviteUrl = \`https://t.me/\${botUsername}?start=ref\${user.id}\`;
        const shareText = '🎰 Присоединяйся ко мне в Casino Bot! Играй и зарабатывай!';
        window.tg.openTelegramLink(\`https://t.me/share/url?url=\${encodeURIComponent(inviteUrl)}&text=\${encodeURIComponent(shareText)}\`);
      }
    }

    // === ADMIN PANEL FUNCTIONS ===

    window.showAdminPanel = function() {
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('medium');

      if (!window.currentUser || !window.currentUser.isAdmin) {
        window.tg.showAlert('Доступ запрещен');
        return;
      }

      // Скрываем все экраны
      document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
      });

      // Показываем экран админки
      document.getElementById('admin-screen').classList.add('active');

      // Загружаем данные
      loadAdminData();
    }

    window.backToProfile = function() {
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('light');

      document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
      });
      document.getElementById('profile-screen').classList.add('active');
    }

    async function loadAdminData() {
      if (!window.currentUser || !window.currentUser.isAdmin) return;

      try {
        // Загружаем статистику
        const statsResponse = await fetch(\`/api/admin/stats?admin_id=\${window.currentUser.id}\`);
        const statsData = await statsResponse.json();

        if (statsData.success) {
          document.getElementById('admin-total-users').textContent = statsData.stats.totalUsers;
          document.getElementById('admin-users-deposits').textContent = statsData.stats.usersWithDeposits;
        }

        // Загружаем заявки на вывод
        const withdrawalsResponse = await fetch(\`/api/admin/pending-withdrawals?admin_id=\${window.currentUser.id}\`);
        const withdrawalsData = await withdrawalsResponse.json();

        if (withdrawalsData.success) {
          const withdrawals = withdrawalsData.withdrawals;
          const listDiv = document.getElementById('admin-withdrawals-list');

          if (withdrawals.length === 0) {
            listDiv.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Нет заявок на вывод</p>';
          } else {
            listDiv.innerHTML = withdrawals.map(w => \`
              <div style="border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding: 12px 0; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <div>
                    <div style="font-weight: 600;">\${w.first_name || 'User'} \${w.username ? '@' + w.username : ''}</div>
                    <div style="font-size: 13px; color: var(--text-secondary);">ID: \${w.user_id} | Telegram ID: \${w.telegram_id || 'N/A'}</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 18px; font-weight: 700; color: var(--accent-green);">\${w.amount} USDT</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">\${new Date(w.created_at).toLocaleString('ru-RU')}</div>
                  </div>
                </div>
                <button class="btn primary" style="width: 100%; padding: 8px;" onclick="completeWithdrawal(\${w.id}, \${w.user_id})">
                  ✅ Отправил через CryptoBot
                </button>
              </div>
            \`).join('');
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки данных админки:', error);
        window.tg.showAlert('Ошибка загрузки данных');
      }
    }

    async function completeWithdrawal(withdrawalId, userId) {
      if (window.tg.HapticFeedback) window.tg.HapticFeedback.impactOccurred('medium');

      if (!window.currentUser || !window.currentUser.isAdmin) {
        window.tg.showAlert('Доступ запрещен');
        return;
      }

      const confirmed = confirm('Вы уже отправили средства через CryptoBot?');
      if (!confirmed) return;

      try {
        const response = await fetch(\`/api/admin/withdrawals/\${withdrawalId}/complete\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_id: window.currentUser.id })
        });

        const data = await response.json();

        if (data.success) {
          window.tg.showAlert('✅ Вывод отмечен как выполненный!');
          // Перезагружаем список
          loadAdminData();
        } else {
          window.tg.showAlert('❌ Ошибка: ' + (data.error || 'Не удалось обработать'));
        }
      } catch (error) {
        window.tg.showAlert('❌ Ошибка при обработке');
      }
    }

      // Глобальный catch для всего скрипта
      } catch (globalError) {
        updateDebugStatus('❌ КРИТИЧЕСКАЯ ОШИБКА: ' + globalError.message, true);
        console.error('❌ Глобальная ошибка:', globalError);
        const usernameEl = document.getElementById('username');
        if (usernameEl) {
          usernameEl.textContent = '❌ Ошибка загрузки';
        }
      }
    })(); // Закрываем async function
  </script>
</body>
</html>
  `);
});

// API для сохранения данных пользователя
app.post("/api/user", async (req, res) => {
  try {
    const { telegram_id, username, first_name, last_name, language_code, photo_url, is_premium } = req.body;

    console.log('Received user data:', { telegram_id, username, first_name, last_name, photo_url });

    // Создаем или обновляем пользователя
    const user = await UserModel.createOrUpdate({
      telegram_id,
      username,
      first_name,
      last_name,
      language_code,
      photo_url,
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
        photo_url: user.photo_url,
        is_premium: user.is_premium
      }
    });
  } catch (error) {
    console.error("Error saving user:", error);
    res.status(500).json({ success: false, error: "Failed to save user" });
  }
});

// API для получения пользователя по telegram_id
app.get("/api/user/telegram/:telegram_id", async (req, res) => {
  try {
    const telegram_id = parseInt(req.params.telegram_id);
    const user = await UserModel.findByTelegramId(telegram_id);

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const balance = await BalanceModel.getByUserId(user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        language_code: user.language_code,
        photo_url: user.photo_url,
        is_premium: user.is_premium
      },
      balance: balance ? parseFloat(balance.balance.toString()) : 0
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, error: "Failed to fetch user" });
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

// ============================================
// WITHDRAWAL API (via @send bot)
// ============================================

app.post("/api/withdraw", async (req, res) => {
  try {
    const { user_id, telegram_id, amount } = req.body;

    if (!user_id || !telegram_id || !amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const withdrawAmount = parseFloat(amount);

    if (isNaN(withdrawAmount) || withdrawAmount < 10) {
      return res.status(400).json({ success: false, error: "Минимальная сумма вывода: 10 USDT" });
    }

    // Проверяем баланс
    const balance = await BalanceModel.getBalance(user_id);
    if (!balance || balance.balance < withdrawAmount) {
      return res.status(400).json({ success: false, error: "Недостаточно средств" });
    }

    // Получаем пользователя
    const user = await UserModel.getUserById(user_id);
    if (!user) {
      return res.status(400).json({ success: false, error: "Пользователь не найден" });
    }

    // Создаем транзакцию
    await TransactionModel.createTransaction(
      user_id,
      "withdrawal",
      withdrawAmount,
      "pending"
    );

    // Вычитаем с баланса
    await BalanceModel.subtractBalance(user_id, withdrawAmount);

    // Получаем новый баланс
    const newBalance = await BalanceModel.getBalance(user_id);

    // Отправляем уведомление админу
    if (telegramBot) {
      const adminId = 5855297931;
      try {
        await telegramBot.sendMessage(
          adminId,
          `🔔 **Новая заявка на вывод**\n\nПользователь: ${user.first_name} (ID: ${telegram_id})\nСумма: ${withdrawAmount} USDT\n\n💸 Используйте @send для отправки средств пользователю по ID: \`${telegram_id}\``,
          { parse_mode: "Markdown" }
        );
      } catch (err) {
        console.error("Не удалось отправить уведомление админу:", err);
      }
    }

    res.json({
      success: true,
      newBalance: newBalance?.balance || 0,
      message: "Заявка на вывод создана"
    });
  } catch (error: any) {
    console.error("Error processing withdrawal:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to process withdrawal" });
  }
});

// ============================================
// CRYPTOBOT API ENDPOINTS
// ============================================

// Создать инвойс для пополнения (CryptoBot)
app.post("/api/crypto/create-invoice", async (req, res) => {
  try {
    const { user_id, amount } = req.body;
    if (!user_id || !amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await cryptoBotService.createInvoice(user_id, amount);
    res.json(result);
  } catch (error: any) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create invoice" });
  }
});

// Вебхук для получения уведомлений от CryptoBot
app.post("/api/crypto/webhook", async (req, res) => {
  try {
    const invoiceData = req.body;
    console.log("CryptoBot webhook received:", invoiceData);

    const result = await cryptoBotService.processPayment(invoiceData);

    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: "Payment processing failed" });
    }
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// OLD CRYPTO API ENDPOINTS (TronWeb - deprecated)
// ============================================

// Получить адрес для пополнения
app.post("/api/crypto/deposit-address", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, error: "Missing user_id" });
    }
    const address = await cryptoService.getDepositAddress(user_id);
    res.json({ success: true, address });
  } catch (error: any) {
    console.error("Error getting deposit address:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get deposit address" });
  }
});

// Проверить депозит
app.post("/api/crypto/check-deposit", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, error: "Missing user_id" });
    }
    const result = await cryptoService.checkDeposit(user_id);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error checking deposit:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to check deposit" });
  }
});

// Обработать депозит (зачислить на баланс)
app.post("/api/crypto/process-deposit", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, error: "Missing user_id" });
    }
    const result = await cryptoService.processDeposit(user_id);
    res.json(result);
  } catch (error: any) {
    console.error("Error processing deposit:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to process deposit" });
  }
});

// Создать заявку на вывод
app.post("/api/crypto/withdraw", async (req, res) => {
  try {
    const { user_id, address, amount } = req.body;
    if (!user_id || !address || !amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await cryptoService.withdrawUSDT(user_id, address, parseFloat(amount));
    res.json(result);
  } catch (error: any) {
    console.error("Error creating withdrawal:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create withdrawal" });
  }
});

// ============================================
// ADMIN API ENDPOINTS
// ============================================

// Проверить является ли пользователь админом
app.get("/api/admin/check", async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ success: false, error: "Missing user_id" });
    }

    const isAdmin = await AdminModel.isAdmin(parseInt(user_id as string));
    const admin = await AdminModel.getAdminByUserId(parseInt(user_id as string));

    res.json({
      success: true,
      isAdmin,
      permissions: admin?.permissions || null
    });
  } catch (error: any) {
    console.error("Error checking admin:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить список ожидающих выводов (для админов)
app.get("/api/admin/pending-withdrawals", async (req, res) => {
  try {
    const { admin_id } = req.query;

    if (!admin_id) {
      return res.status(400).json({ success: false, error: "Missing admin_id" });
    }

    // Проверяем права админа
    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id as string), "manage_withdrawals");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Получаем pending withdrawals из базы
    const result = await TransactionModel.getPendingWithdrawals();

    res.json({ success: true, withdrawals: result });
  } catch (error: any) {
    console.error("Error getting pending withdrawals:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get withdrawals" });
  }
});

// Отметить вывод как выполненный (админ уже отправил через @send)
app.post("/api/admin/withdrawals/:id/complete", async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_id } = req.body;

    if (!admin_id) {
      return res.status(400).json({ success: false, error: "Missing admin_id" });
    }

    // Проверяем права админа
    const hasPermission = await AdminModel.hasPermission(admin_id, "manage_withdrawals");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Получаем транзакцию
    const transaction = await TransactionModel.getTransactionById(parseInt(id));

    if (!transaction || transaction.type !== "withdrawal") {
      return res.status(404).json({ success: false, error: "Transaction not found" });
    }

    if (transaction.status !== "pending") {
      return res.status(400).json({ success: false, error: "Transaction already processed" });
    }

    // Обновляем статус на completed
    await TransactionModel.updateTransactionStatus(
      parseInt(id),
      "completed",
      null,
      admin_id
    );

    // Уведомляем пользователя
    if (telegramBot) {
      const user = await UserModel.getUserById(transaction.user_id);
      if (user) {
        try {
          await telegramBot.sendMessage(
            user.telegram_id,
            `✅ **Вывод выполнен!**\n\nСумма: ${transaction.amount} USDT\n\nСредства отправлены на ваш Telegram ID через @send бота.`,
            { parse_mode: "Markdown" }
          );
        } catch (err) {
          console.error("Не удалось отправить уведомление пользователю:", err);
        }
      }
    }

    res.json({ success: true, message: "Withdrawal marked as completed" });
  } catch (error: any) {
    console.error("Error completing withdrawal:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to complete withdrawal" });
  }
});

// Получить статистику (для админов)
app.get("/api/admin/stats", async (req, res) => {
  try {
    const { admin_id } = req.query;

    if (!admin_id) {
      return res.status(400).json({ success: false, error: "Missing admin_id" });
    }

    // Проверяем права админа
    const hasPermission = await AdminModel.hasPermission(parseInt(admin_id as string), "view_stats");
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const totalUsers = await UserModel.getTotalUsers();
    const usersWithDeposits = await UserModel.getUsersWithDeposits();

    res.json({
      success: true,
      stats: {
        totalUsers,
        usersWithDeposits
      }
    });
  } catch (error: any) {
    console.error("Error getting stats:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DUEL API ENDPOINTS
// ============================================

// Создать комнату для дуэли
app.post("/api/duels/create", async (req, res) => {
  try {
    const { user_id, game_name, mode_name, bet_amount } = req.body;

    if (!user_id || !game_name || !mode_name || !bet_amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await DuelService.createDuelRoom(user_id, game_name, mode_name, parseFloat(bet_amount));

    // Отправляем уведомление создателю
    if (result.success && telegramBot && result.room_code) {
      const user = await UserModel.getUserById(user_id);
      if (user) {
        await telegramBot.sendMessage(
          user.telegram_id,
          `✅ Комната создана!\n\n🎮 Игра: ${game_name}\n🎯 Режим: ${mode_name}\n💰 Ставка: ${bet_amount} USDT\n\n🔑 Код комнаты: \`${result.room_code}\`\n\nОтправьте этот код оппоненту или ждите присоединения.`,
          { parse_mode: "Markdown" }
        );
      }
    }

    res.json(result);
  } catch (error: any) {
    console.error("Error creating duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create duel" });
  }
});

// Присоединиться к комнате
app.post("/api/duels/join", async (req, res) => {
  try {
    const { user_id, room_code } = req.body;

    if (!user_id || !room_code) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const result = await DuelService.joinDuelRoom(user_id, room_code);

    // Отправляем уведомления обоим игрокам
    if (result.success && result.duel && telegramBot) {
      const creator = await UserModel.getUserById(result.duel.creator_id);
      const opponent = await UserModel.getUserById(user_id);

      if (creator) {
        await telegramBot.sendMessage(
          creator.telegram_id,
          `🎮 Противник присоединился!\n\n👤 Игрок: ${opponent?.first_name || "Игрок"}\n💰 Ставка: ${result.duel.bet_amount} USDT\n\n🎯 Сделайте свой ход в Mini App!`
        );
      }

      if (opponent) {
        await telegramBot.sendMessage(
          opponent.telegram_id,
          `✅ Вы присоединились к дуэли!\n\n🎮 Игра: ${result.duel.mode_name}\n💰 Ставка: ${result.duel.bet_amount} USDT\n👤 Противник: ${creator?.first_name || "Игрок"}\n\n🎯 Сделайте свой ход в Mini App!`
        );
      }
    }

    res.json(result);
  } catch (error: any) {
    console.error("Error joining duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to join duel" });
  }
});

// Получить информацию о дуэли
app.get("/api/duels/:duel_id", async (req, res) => {
  try {
    const { duel_id } = req.params;
    const duel = await DuelService.getDuel(parseInt(duel_id));

    if (!duel) {
      return res.status(404).json({ success: false, error: "Duel not found" });
    }

    res.json({ success: true, duel });
  } catch (error: any) {
    console.error("Error getting duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get duel" });
  }
});

// Получить дуэль по коду комнаты
app.get("/api/duels/room/:room_code", async (req, res) => {
  try {
    const { room_code } = req.params;
    const duel = await DuelService.getDuelByRoomCode(room_code);

    if (!duel) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }

    res.json({ success: true, duel });
  } catch (error: any) {
    console.error("Error getting duel by room code:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get duel" });
  }
});

// Сыграть в дуэли
app.post("/api/duels/:duel_id/play", async (req, res) => {
  try {
    const { duel_id } = req.params;
    const { user_id, result } = req.body;

    if (!user_id || !result) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const playResult = await DuelService.playDuel(user_id, parseInt(duel_id), result);

    // Если дуэль завершена, отправляем уведомления
    if (playResult.success && playResult.winner && telegramBot) {
      const duel = await DuelService.getDuel(parseInt(duel_id));
      if (duel) {
        const creator = await UserModel.getUserById(duel.creator_id);
        const opponent = await UserModel.getUserById(duel.opponent_id!);
        const prize = duel.bet_amount * 2 * 0.95;

        if (playResult.winner === "draw") {
          // Ничья
          if (creator) {
            await telegramBot.sendMessage(
              creator.telegram_id,
              `🤝 Дуэль завершена!\n\n🎯 Результат: Ничья\n💰 Возврат: ${duel.bet_amount} USDT`
            );
          }
          if (opponent) {
            await telegramBot.sendMessage(
              opponent.telegram_id,
              `🤝 Дуэль завершена!\n\n🎯 Результат: Ничья\n💰 Возврат: ${duel.bet_amount} USDT`
            );
          }
        } else {
          const isCreatorWinner = playResult.winner === "creator";
          const winner = isCreatorWinner ? creator : opponent;
          const loser = isCreatorWinner ? opponent : creator;

          if (winner) {
            await telegramBot.sendMessage(
              winner.telegram_id,
              `🎉 Победа в дуэли!\n\n💰 Выигрыш: +${prize.toFixed(2)} USDT\n🎯 Комиссия: 5%`
            );
          }
          if (loser) {
            await telegramBot.sendMessage(
              loser.telegram_id,
              `😔 Поражение в дуэли\n\n💸 Проигрыш: -${duel.bet_amount} USDT\n\nПопробуйте еще раз!`
            );
          }
        }
      }
    }

    res.json(playResult);
  } catch (error: any) {
    console.error("Error playing duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to play duel" });
  }
});

// Отменить дуэль
app.post("/api/duels/:duel_id/cancel", async (req, res) => {
  try {
    const { duel_id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, error: "Missing user_id" });
    }

    const result = await DuelService.cancelDuel(user_id, parseInt(duel_id));
    res.json(result);
  } catch (error: any) {
    console.error("Error cancelling duel:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to cancel duel" });
  }
});

// Получить активные дуэли пользователя
app.get("/api/duels/user/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const duels = await DuelService.getUserDuels(parseInt(user_id));
    res.json({ success: true, duels });
  } catch (error: any) {
    console.error("Error getting user duels:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get user duels" });
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
