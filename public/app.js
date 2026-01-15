// Telegram WebApp initialization
console.log('🚀 App.js загружается...');

// Wait for Telegram WebApp to be ready
if (window.Telegram && window.Telegram.WebApp) {
  window.tg = window.Telegram.WebApp;
  window.tg.ready();
  window.tg.expand();
  console.log('✅ Telegram WebApp ready');
} else {
  console.error('❌ Telegram WebApp not found');
}

// Global state
window.currentUser = null;
window.isLoadingUser = false;
window.selectedGameMode = null;

// Logging function
window.addLog = function(message, type) {
  const logContent = document.getElementById('log-content');
  if (!logContent) return;

  const timestamp = new Date().toLocaleTimeString('ru-RU', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });

  let color = '#00ff00'; // green
  let icon = '✅';

  if (type === 'error') {
    color = '#ff0000';
    icon = '❌';
  } else if (type === 'warning') {
    color = '#ffaa00';
    icon = '⚠️';
  } else if (type === 'info') {
    color = '#00aaff';
    icon = 'ℹ️';
  } else if (type === 'success') {
    color = '#00ff00';
    icon = '✅';
  }

  const logLine = document.createElement('div');
  logLine.style.color = color;
  logLine.textContent = `${timestamp} ${icon} ${message}`;
  logContent.appendChild(logLine);

  const logPanel = document.getElementById('log-panel');
  if (logPanel) logPanel.scrollTop = logPanel.scrollHeight;

  console.log(message);
};

// Click log panel to hide
document.getElementById('log-panel').onclick = function() {
  this.style.display = 'none';
};

// Global error handler
window.onerror = function(msg, url, line, col, error) {
  window.addLog('JS ERROR: ' + msg + ' (строка ' + line + ')', 'error');
  const d = document.getElementById('debug-status');
  if (d) {
    d.textContent = '❌ JS ERROR: ' + msg + ' (строка ' + line + ')';
    d.style.background = 'rgba(139,0,0,0.9)';
    d.style.color = '#ff0000';
  }
  return false;
};

// Update debug status
window.updateDebugStatus = function(message, isError = false) {
  const debugEl = document.getElementById('debug-status');
  if (debugEl) {
    debugEl.textContent = message;
    debugEl.style.color = isError ? '#ff0000' : '#00ff00';
    debugEl.style.background = isError ? 'rgba(139,0,0,0.9)' : 'rgba(0,0,0,0.9)';
  }
  console.log(message);
};

// Load user data from API
window.loadUserData = async function() {
  if (!window.tg || !window.tg.initDataUnsafe || !window.tg.initDataUnsafe.user) {
    window.addLog('❌ Нет данных Telegram', 'error');
    return;
  }

  const tgUser = window.tg.initDataUnsafe.user;
  const fullName = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');

  try {
    // Try to load user from database
    const response = await fetch(`/api/user/telegram/${tgUser.id}`);

    if (response.ok) {
      const data = await response.json();
      window.currentUser = data.user;

      // Update UI
      document.getElementById('username').textContent = fullName;
      document.getElementById('handle').textContent = '@' + (window.currentUser.username || 'user' + window.currentUser.telegram_id);
      document.getElementById('balance').textContent = (data.balance || 0).toFixed(2);

      const avatar = document.getElementById('avatar');
      if (window.currentUser.photo_url) {
        avatar.innerHTML = `<img src="${window.currentUser.photo_url}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
      } else {
        avatar.textContent = fullName.charAt(0).toUpperCase();
      }

      window.addLog('✅ Пользователь загружен', 'success');
    } else if (response.status === 404) {
      // Create new user
      const createResponse = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: tgUser.id,
          username: tgUser.username || '',
          first_name: tgUser.first_name,
          last_name: tgUser.last_name || '',
          language_code: tgUser.language_code || '',
          photo_url: null,
          is_premium: tgUser.is_premium || false
        })
      });

      const createData = await createResponse.json();
      if (createData.success && createData.user) {
        window.currentUser = createData.user;
        document.getElementById('username').textContent = fullName;
        document.getElementById('handle').textContent = '@' + (window.currentUser.username || 'user' + window.currentUser.telegram_id);
        document.getElementById('balance').textContent = (createData.balance || 0).toFixed(2);
        document.getElementById('avatar').textContent = fullName.charAt(0).toUpperCase();

        window.addLog('✅ Новый пользователь создан', 'success');
      }
    }
  } catch (error) {
    window.addLog('❌ Ошибка загрузки: ' + error.message, 'error');
  }
};

// Handle deposit button
function handleDeposit() {
  window.addLog('🔘 Нажата кнопка Пополнить', 'info');

  if (!window.tg) {
    window.addLog('❌ tg не определен!', 'error');
    alert('Ошибка: Telegram WebApp не загружен');
    return;
  }

  if (window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }

  if (!window.currentUser) {
    window.tg.showAlert('Подождите, загружаем данные...');
    return;
  }

  window.tg.showAlert('Функция пополнения скоро будет доступна!');
}

// Handle withdraw button
function handleWithdraw() {
  window.addLog('🔘 Нажата кнопка Вывести', 'info');

  if (!window.tg) {
    window.addLog('❌ tg не определен!', 'error');
    alert('Ошибка: Telegram WebApp не загружен');
    return;
  }

  if (window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }

  if (!window.currentUser) {
    window.tg.showAlert('Подождите, загружаем данные...');
    return;
  }

  window.tg.showAlert('Функция вывода скоро будет доступна!');
}

// Navigation handler
function handleNav(event, section) {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('light');
  }

  // Update tabs
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  event.currentTarget.classList.add('active');

  // Update screens
  document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
  document.getElementById(section + '-screen').classList.add('active');
}

// Open dice game
function openDiceGame() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('dice-game-screen').classList.add('active');
}

// Back to games
function backToGames() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('light');
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('games-screen').classList.add('active');
}

// Select game mode
function selectMode(event, mode) {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('light');
  }
  window.selectedGameMode = mode;

  // Update button states
  document.querySelectorAll('.game-btn').forEach(btn => btn.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
}

// Play dice game
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

  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('heavy');
  }

  const playBtn = document.getElementById('play-btn');
  const diceDisplay = document.getElementById('dice-display');
  const resultDisplay = document.getElementById('result-display');

  playBtn.disabled = true;
  playBtn.textContent = 'Бросаем...';
  resultDisplay.textContent = '';

  diceDisplay.classList.add('spinning');

  try {
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
    } else if (window.selectedGameMode === 'exact') {
      const number = prompt('Введите число от 1 до 6:');
      if (!number || number < 1 || number > 6) {
        throw new Error('Неверное число!');
      }
      endpoint = '/api/games/dice/exact-number';
      body.choice = parseInt(number);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    setTimeout(() => {
      diceDisplay.classList.remove('spinning');

      if (data.success) {
        const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        diceDisplay.textContent = diceEmojis[data.result - 1] || '🎲';

        if (data.isWin) {
          resultDisplay.style.color = 'var(--accent-green)';
          resultDisplay.textContent = `🎉 Выигрыш: ${data.winAmount.toFixed(2)} USDT! (x${data.multiplier})`;
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('success');
          }
        } else {
          resultDisplay.style.color = 'var(--accent-red)';
          resultDisplay.textContent = `❌ Проигрыш. Выпало: ${data.result}`;
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('error');
          }
        }

        // Update balance
        if (data.newBalance !== undefined) {
          document.getElementById('balance').textContent = data.newBalance.toFixed(2);
        }
      } else {
        resultDisplay.style.color = 'var(--accent-red)';
        resultDisplay.textContent = '❌ ' + (data.error || 'Ошибка');
      }

      playBtn.disabled = false;
      playBtn.textContent = '🎲 Бросить кости';
    }, 1500);
  } catch (error) {
    diceDisplay.classList.remove('spinning');
    resultDisplay.style.color = 'var(--accent-red)';
    resultDisplay.textContent = '❌ Ошибка: ' + error.message;
    playBtn.disabled = false;
    playBtn.textContent = '🎲 Бросить кости';
  }
}

// Copy referral link
function copyReferralLink() {
  const linkEl = document.getElementById('referral-link');
  if (linkEl) {
    navigator.clipboard.writeText(linkEl.textContent);
    window.tg.showAlert('✅ Ссылка скопирована!');
  }
}

// Share referral link
function shareReferralLink() {
  if (window.tg) {
    const linkEl = document.getElementById('referral-link');
    if (linkEl) {
      window.tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(linkEl.textContent));
    }
  }
}

// Initialize app
(async function initApp() {
  try {
    window.addLog('✅ INLINE JS РАБОТАЕТ!', 'success');
    window.updateDebugStatus('🔄 Загрузка...', false);

    // Wait for Telegram SDK
    let attempts = 0;
    while ((!window.Telegram || !window.Telegram.WebApp) && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    if (window.Telegram && window.Telegram.WebApp) {
      window.tg = window.Telegram.WebApp;
      window.tg.ready();
      window.tg.expand();
      window.addLog('✅ Telegram SDK загружен', 'success');

      // Load user data
      await window.loadUserData();

      window.updateDebugStatus('✅ Готово!', false);
      setTimeout(() => {
        const debugEl = document.getElementById('debug-status');
        if (debugEl) debugEl.style.display = 'none';
      }, 3000);
    } else {
      window.addLog('❌ Telegram SDK не загружен', 'error');
      window.updateDebugStatus('❌ Telegram SDK не загружен', true);
    }
  } catch (error) {
    window.addLog('❌ Ошибка инициализации: ' + error.message, 'error');
    window.updateDebugStatus('❌ Ошибка: ' + error.message, true);
  }
})();

console.log('✅ App.js загружен полностью');
