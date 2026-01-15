// Telegram WebApp initialization
console.log('🚀 App.js загружается...');

// Global state
window.currentUser = null;
window.selectedGameMode = null;

// Initialize Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
  window.tg = window.Telegram.WebApp;
  window.tg.ready();
  window.tg.expand();
  console.log('✅ Telegram WebApp ready');
} else {
  console.error('❌ Telegram WebApp not found');
}

// Load user data from API
window.loadUserData = async function() {
  if (!window.tg || !window.tg.initDataUnsafe || !window.tg.initDataUnsafe.user) {
    console.error('❌ Нет данных Telegram');
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

      console.log('✅ Пользователь загружен');
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

        console.log('✅ Новый пользователь создан');
      }
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки:', error);
  }
};

// Handle deposit button - CryptoBot Integration
async function handleDeposit() {
  console.log('🔘 Нажата кнопка Пополнить');

  if (!window.tg) {
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

  // Показываем popup с вводом суммы
  const amount = window.tg.showPopup({
    title: 'Пополнение баланса',
    message: 'Введите сумму в USDT:',
    buttons: [
      { id: '10', type: 'default', text: '10 USDT' },
      { id: '50', type: 'default', text: '50 USDT' },
      { id: '100', type: 'default', text: '100 USDT' },
      { id: 'custom', type: 'default', text: 'Другая сумма' },
      { type: 'cancel' }
    ]
  }, async (buttonId) => {
    if (!buttonId || buttonId === 'cancel') return;

    let depositAmount = 0;

    if (buttonId === 'custom') {
      // Запрашиваем произвольную сумму
      const customAmount = prompt('Введите сумму в USDT (минимум 1):');
      if (!customAmount) return;
      depositAmount = parseFloat(customAmount);
    } else {
      depositAmount = parseFloat(buttonId);
    }

    if (isNaN(depositAmount) || depositAmount < 1) {
      window.tg.showAlert('❌ Минимальная сумма: 1 USDT');
      return;
    }

    try {
      // Показываем индикатор загрузки
      window.tg.MainButton.setText('Создание счета...').show().showProgress();

      // Создаем инвойс через CryptoBot
      const response = await fetch('/api/crypto/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: window.currentUser.id,
          amount: depositAmount
        })
      });

      const data = await response.json();

      window.tg.MainButton.hideProgress().hide();

      if (data.success && data.invoice_url) {
        // Открываем страницу оплаты CryptoBot
        window.tg.openLink(data.invoice_url);
        window.tg.showAlert('✅ Счет создан! После оплаты баланс пополнится автоматически.');
      } else {
        window.tg.showAlert('❌ Ошибка: ' + (data.error || 'Не удалось создать счет'));
      }
    } catch (error) {
      window.tg.MainButton.hideProgress().hide();
      window.tg.showAlert('❌ Ошибка при создании счета');
      console.error('Deposit error:', error);
    }
  });
}

// Handle withdraw button - via @send
async function handleWithdraw() {
  console.log('🔘 Нажата кнопка Вывести');

  if (!window.tg) {
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

  // Получаем текущий баланс
  const currentBalance = parseFloat(document.getElementById('balance').textContent || '0');

  if (currentBalance < 10) {
    window.tg.showAlert('❌ Минимальная сумма вывода: 10 USDT\nВаш баланс: ' + currentBalance.toFixed(2) + ' USDT');
    return;
  }

  // Запрашиваем сумму вывода
  const withdrawAmount = prompt(`Введите сумму для вывода (минимум 10 USDT):\nВаш баланс: ${currentBalance.toFixed(2)} USDT`);

  if (!withdrawAmount) return;

  const amount = parseFloat(withdrawAmount);

  if (isNaN(amount) || amount < 10) {
    window.tg.showAlert('❌ Минимальная сумма вывода: 10 USDT');
    return;
  }

  if (amount > currentBalance) {
    window.tg.showAlert('❌ Недостаточно средств\nВаш баланс: ' + currentBalance.toFixed(2) + ' USDT');
    return;
  }

  try {
    // Показываем индикатор загрузки
    window.tg.MainButton.setText('Создание заявки...').show().showProgress();

    // Создаем заявку на вывод
    const response = await fetch('/api/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: window.currentUser.id,
        telegram_id: window.currentUser.telegram_id,
        amount: amount
      })
    });

    const data = await response.json();

    window.tg.MainButton.hideProgress().hide();

    if (data.success) {
      // Обновляем баланс на экране
      document.getElementById('balance').textContent = (data.newBalance || 0).toFixed(2);
      window.tg.showAlert('✅ Заявка на вывод создана!\n\nСумма: ' + amount + ' USDT\n\nАдмин обработает заявку и отправит средства через @send бота в ближайшее время.');
    } else {
      window.tg.showAlert('❌ Ошибка: ' + (data.error || 'Не удалось создать заявку'));
    }
  } catch (error) {
    window.tg.MainButton.hideProgress().hide();
    window.tg.showAlert('❌ Ошибка при создании заявки');
    console.error('Withdraw error:', error);
  }
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

  // Update dice screen balance and avatar
  if (window.currentUser) {
    const balance = document.getElementById('balance').textContent || '0.00';
    document.getElementById('dice-balance-amount').textContent = balance;

    const mainAvatar = document.getElementById('avatar');
    const diceAvatar = document.getElementById('dice-avatar');

    if (mainAvatar.querySelector('img')) {
      diceAvatar.innerHTML = mainAvatar.innerHTML;
    } else {
      diceAvatar.textContent = mainAvatar.textContent;
    }
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

// Open play screen with selected mode
function openPlayScreen(choice, modeName, modeLabel, multiplier) {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }

  // Store selected game mode
  window.selectedDiceChoice = choice;
  window.selectedDiceMode = modeName;
  window.selectedDiceMultiplier = multiplier;

  // Update play screen title
  const modeTitle = document.getElementById('play-mode-title');
  modeTitle.textContent = `🎲 ${modeLabel} (x${multiplier})`;

  // Update balance and avatar
  if (window.currentUser) {
    const balance = document.getElementById('balance').textContent || '0.00';
    document.getElementById('dice-play-balance-amount').textContent = balance;

    const mainAvatar = document.getElementById('avatar');
    const playAvatar = document.getElementById('dice-play-avatar');

    if (mainAvatar.querySelector('img')) {
      playAvatar.innerHTML = mainAvatar.innerHTML;
    } else {
      playAvatar.textContent = mainAvatar.textContent;
    }
  }

  // Reset dice emoji
  document.getElementById('dice-emoji').textContent = '🎲';

  // Open play screen
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('dice-play-screen').classList.add('active');
}

// Back to dice modes
function backToDiceModes() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('light');
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('dice-game-screen').classList.add('active');
}

// Play dice game
async function playDiceGame() {
  if (!window.currentUser) {
    if (window.tg) {
      window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
    }
    return;
  }

  if (!window.selectedDiceChoice || !window.selectedDiceMode) {
    if (window.tg) {
      window.tg.showAlert('Ошибка: режим не выбран');
    }
    return;
  }

  const betAmount = parseFloat(document.getElementById('bet-input').value);
  if (isNaN(betAmount) || betAmount <= 0) {
    if (window.tg) {
      window.tg.showAlert('Введите корректную ставку!');
    }
    return;
  }

  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('heavy');
  }

  const playBtn = document.getElementById('play-dice-btn');
  const diceEmoji = document.getElementById('dice-emoji');

  // Disable button and add spinning animation
  playBtn.disabled = true;
  playBtn.textContent = 'Бросаем...';
  diceEmoji.classList.add('spinning');

  try {
    let endpoint = '';
    let body = {
      user_id: window.currentUser.id,
      bet_amount: betAmount
    };

    if (window.selectedDiceMode === 'higher-lower') {
      endpoint = '/api/games/dice/higher-lower';
      body.choice = window.selectedDiceChoice;
    } else if (window.selectedDiceMode === 'even-odd') {
      endpoint = '/api/games/dice/even-odd';
      body.choice = window.selectedDiceChoice;
    } else if (window.selectedDiceMode === 'exact') {
      endpoint = '/api/games/dice/exact-number';
      body.choice = parseInt(window.selectedDiceChoice);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    setTimeout(() => {
      diceEmoji.classList.remove('spinning');

      if (data.success) {
        const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        diceEmoji.textContent = diceEmojis[data.result - 1] || '🎲';

        // Update balance
        if (data.newBalance !== undefined) {
          document.getElementById('balance').textContent = data.newBalance.toFixed(2);
          document.getElementById('dice-balance-amount').textContent = data.newBalance.toFixed(2);
          document.getElementById('dice-play-balance-amount').textContent = data.newBalance.toFixed(2);
        }

        // Show result
        if (data.isWin) {
          // Win - show confetti and congratulations
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('success');
          }

          launchConfetti();

          if (window.tg) {
            window.tg.showAlert(`🎉 Поздравляем! Вы выиграли ${data.winAmount.toFixed(2)} USDT!`);
          }

          // Add to wins history
          addWinToHistory(data.winAmount, data.multiplier);
        } else {
          // Loss - no action, just update balance silently
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.impactOccurred('medium');
          }
        }
      } else {
        if (window.tg) {
          window.tg.showAlert('❌ ' + (data.error || 'Ошибка'));
        }
      }

      playBtn.disabled = false;
      playBtn.textContent = 'ИГРАТЬ';
    }, 1500);
  } catch (error) {
    diceEmoji.classList.remove('spinning');
    playBtn.disabled = false;
    playBtn.textContent = 'ИГРАТЬ';

    if (window.tg) {
      window.tg.showAlert('❌ Ошибка: ' + error.message);
    }
    console.error('Dice game error:', error);
  }
}

// Add win to history
function addWinToHistory(amount, multiplier) {
  const winsList = document.getElementById('wins-list');

  // Remove empty message if exists
  const emptyMsg = winsList.querySelector('.wins-empty');
  if (emptyMsg) {
    emptyMsg.remove();
  }

  // Create new win item
  const winItem = document.createElement('div');
  winItem.className = 'win-item';

  const now = new Date();
  const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  winItem.innerHTML = `
    <div class="win-item-amount">+ ${amount.toFixed(2)}$ (x${multiplier})</div>
    <div class="win-item-time">${timeStr}</div>
  `;

  // Add to top of list
  winsList.insertBefore(winItem, winsList.firstChild);
}

// Confetti animation
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const confetti = [];
  const confettiCount = 150;
  const colors = ['#18E29A', '#F5C76A', '#EF4444', '#60A5FA', '#F472B6'];

  // Create confetti particles
  for (let i = 0; i < confettiCount; i++) {
    confetti.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: Math.random() * 10 + 5,
      speedY: Math.random() * 3 + 2,
      speedX: Math.random() * 3 - 1.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 10 - 5
    });
  }

  function drawConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let stillVisible = false;

    confetti.forEach((particle) => {
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation * Math.PI / 180);
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      ctx.restore();

      particle.y += particle.speedY;
      particle.x += particle.speedX;
      particle.rotation += particle.rotationSpeed;

      if (particle.y < canvas.height) {
        stillVisible = true;
      }
    });

    if (stillVisible) {
      requestAnimationFrame(drawConfetti);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  drawConfetti();
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

// ========== NEW GAMES ==========

// Open Slots Game
function openSlotsGame() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }
  window.tg.showAlert('🎰 Слоты скоро будут доступны!\nИгра находится в разработке.');
}

// Open Rock-Paper-Scissors Game
function openRPSGame() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }
  window.tg.showAlert('🪨 Камень-Ножницы-Бумага скоро будут доступны!\nИгра находится в разработке.');
}

// Open Darts Game
function openDartsGame() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }
  window.tg.showAlert('🎯 Дартс скоро будет доступен!\nИгра находится в разработке.');
}

// Open Football Game
function openFootballGame() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }
  window.tg.showAlert('⚽ Футбол скоро будет доступен!\nИгра находится в разработке.');
}

// Open Basketball Game
function openBasketballGame() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }
  window.tg.showAlert('🏀 Баскетбол скоро будет доступен!\nИгра находится в разработке.');
}

// Initialize app
(async function initApp() {
  try {
    console.log('✅ Инициализация приложения');

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
      console.log('✅ Telegram SDK загружен');

      // Load user data
      await window.loadUserData();
      console.log('✅ Приложение готово');
    } else {
      console.error('❌ Telegram SDK не загружен');
    }
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);
  }
})();

console.log('✅ App.js загружен полностью');
