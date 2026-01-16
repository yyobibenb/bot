// Telegram WebApp initialization
console.log('🚀 App.js загружается...');

// Global state
window.currentUser = null;
window.selectedGameMode = null;
window.userDataFromUrl = null;

// Initialize Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
  window.tg = window.Telegram.WebApp;
  window.tg.ready();
  window.tg.expand();
  console.log('✅ Telegram WebApp ready');
} else {
  console.error('❌ Telegram WebApp not found');
}

// Parse URL parameters
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    user_id: params.get('user_id'),
    first_name: params.get('first_name'),
    last_name: params.get('last_name'),
    username: params.get('username'),
    photo_url: params.get('photo_url'),
    is_premium: params.get('is_premium') === 'true'
  };
}

// Load user data from API
window.loadUserData = async function() {
  console.log('═══════════════════════════════════════');
  console.log('🚀 Начинаю загрузку пользователя...');
  console.log('📍 Полный URL:', window.location.href);
  console.log('🔗 URL search:', window.location.search);
  console.log('═══════════════════════════════════════');

  // Сначала пробуем получить данные из URL параметров
  const urlParams = getUrlParams();
  console.log('🔍 Распарсенные URL параметры:', urlParams);
  console.log('  - user_id:', urlParams.user_id);
  console.log('  - first_name:', urlParams.first_name);
  console.log('  - photo_url:', urlParams.photo_url ? 'есть' : 'нет');

  // Если нет URL параметров, пробуем использовать Telegram SDK
  let tgUser;
  if (urlParams.user_id) {
    tgUser = {
      id: parseInt(urlParams.user_id),
      first_name: urlParams.first_name || 'User',
      last_name: urlParams.last_name || '',
      username: urlParams.username || '',
      photo_url: urlParams.photo_url || null,
      is_premium: urlParams.is_premium || false
    };
    window.userDataFromUrl = tgUser;
    console.log('✅ Данные пользователя из URL параметров:', tgUser);
  } else if (window.tg && window.tg.initDataUnsafe && window.tg.initDataUnsafe.user) {
    tgUser = window.tg.initDataUnsafe.user;
    console.log('✅ Данные пользователя из Telegram SDK:', tgUser);
  } else {
    console.error('❌ Нет данных пользователя');
    return;
  }

  const fullName = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');

  try {
    // Try to load user from database
    const response = await fetch(`/api/user/telegram/${tgUser.id}`);

    if (response.ok) {
      const data = await response.json();
      window.currentUser = data.user;
      console.log('💾 Пользователь из БД:', window.currentUser);
      console.log('💰 Баланс:', data.balance);

      // Update UI
      document.getElementById('username').textContent = fullName;
      document.getElementById('handle').textContent = '@' + (window.currentUser.username || 'user' + window.currentUser.telegram_id);
      document.getElementById('balance').textContent = (data.balance || 0).toFixed(2);

      const avatar = document.getElementById('avatar');
      // Используем photo_url из URL параметров или из базы данных
      const photoUrl = tgUser.photo_url || window.currentUser.photo_url;
      console.log('📷 Аватар URL:', photoUrl);
      if (photoUrl) {
        avatar.innerHTML = `<img src="${photoUrl}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
      } else {
        avatar.textContent = fullName.charAt(0).toUpperCase();
      }

      // Update debug info
      try {
        console.log('🔧 Обновляю debug карточку...');
        const debugTelegramId = document.getElementById('debug-telegram-id');
        const debugDataSource = document.getElementById('debug-data-source');
        const debugUrlParams = document.getElementById('debug-url-params');
        const debugPhotoStatus = document.getElementById('debug-photo-status');
        const debugFullUrl = document.getElementById('debug-full-url');

        if (debugTelegramId) debugTelegramId.textContent = tgUser.id;
        if (debugDataSource) debugDataSource.textContent = urlParams.user_id ? '✅ URL параметры' : '📱 Telegram SDK';
        if (debugUrlParams) debugUrlParams.textContent = urlParams.user_id ? '✅ Да' : '❌ Нет';
        if (debugPhotoStatus) debugPhotoStatus.textContent = photoUrl ? '✅ Есть' : '❌ Нет';
        if (debugFullUrl) debugFullUrl.textContent = window.location.href;

        console.log('✅ Debug карточка обновлена');
        console.log('  - Telegram ID:', tgUser.id);
        console.log('  - Источник:', urlParams.user_id ? 'URL параметры' : 'Telegram SDK');
        console.log('  - URL параметры есть:', !!urlParams.user_id);
        console.log('  - Полный URL:', window.location.href);
      } catch (debugError) {
        console.error('⚠️ Ошибка при обновлении debug карточки:', debugError);
      }

      console.log('✅ Пользователь загружен и отображен в UI');
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
          photo_url: tgUser.photo_url || null,
          is_premium: tgUser.is_premium || false
        })
      });

      const createData = await createResponse.json();
      if (createData.success && createData.user) {
        window.currentUser = createData.user;
        document.getElementById('username').textContent = fullName;
        document.getElementById('handle').textContent = '@' + (window.currentUser.username || 'user' + window.currentUser.telegram_id);
        document.getElementById('balance').textContent = (createData.balance || 0).toFixed(2);

        const avatar = document.getElementById('avatar');
        if (tgUser.photo_url) {
          avatar.innerHTML = `<img src="${tgUser.photo_url}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
          avatar.textContent = fullName.charAt(0).toUpperCase();
        }

        // Update debug info
        try {
          console.log('🔧 Обновляю debug карточку для нового пользователя...');
          const debugTelegramId = document.getElementById('debug-telegram-id');
          const debugDataSource = document.getElementById('debug-data-source');
          const debugUrlParams = document.getElementById('debug-url-params');
          const debugPhotoStatus = document.getElementById('debug-photo-status');
          const debugFullUrl = document.getElementById('debug-full-url');

          if (debugTelegramId) debugTelegramId.textContent = tgUser.id;
          if (debugDataSource) debugDataSource.textContent = urlParams.user_id ? '✅ URL параметры' : '📱 Telegram SDK';
          if (debugUrlParams) debugUrlParams.textContent = urlParams.user_id ? '✅ Да' : '❌ Нет';
          if (debugPhotoStatus) debugPhotoStatus.textContent = tgUser.photo_url ? '✅ Есть' : '❌ Нет';
          if (debugFullUrl) debugFullUrl.textContent = window.location.href;

          console.log('✅ Debug карточка обновлена');
          console.log('  - Telegram ID:', tgUser.id);
          console.log('  - Источник:', urlParams.user_id ? 'URL параметры' : 'Telegram SDK');
          console.log('  - URL параметры есть:', !!urlParams.user_id);
          console.log('  - Полный URL:', window.location.href);
        } catch (debugError) {
          console.error('⚠️ Ошибка при обновлении debug карточки:', debugError);
        }

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

// ========== ADMIN PANEL ==========

window.isAdmin = false;
window.currentUserForEdit = null;

// Check admin permission
async function checkAdminPermission() {
  if (!window.currentUser) {
    console.log('⚠️ Пропуск проверки админских прав - пользователь не загружен');
    return;
  }

  console.log('🔐 Проверка админских прав для user_id:', window.currentUser.id);

  try {
    const response = await fetch(`/api/admin/check?user_id=${window.currentUser.id}`);
    const data = await response.json();
    console.log('🔐 Результат проверки админа:', data);

    if (data.isAdmin) {
      window.isAdmin = true;
      // Show admin tab
      const adminTab = document.getElementById('admin-tab');
      if (adminTab) {
        adminTab.style.display = 'flex';
        console.log('✅ Админская кнопка показана');
      }
      console.log('✅ Админские права активированы для:', window.currentUser.first_name);
    } else {
      console.log('❌ Пользователь не является админом');
    }
  } catch (error) {
    console.error('❌ Ошибка проверки админских прав:', error);
  }
}

// Show admin section
function showAdminSection(section) {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('light');
  }

  // Update tabs
  document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');

  // Update sections
  document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(`admin-${section}-section`).classList.add('active');

  // Load data for section
  if (section === 'stats') {
    loadAdminStats();
  } else if (section === 'broadcast') {
    loadBroadcasts();
  }
}

// Load admin statistics
async function loadAdminStats() {
  if (!window.currentUser) {
    window.tg.showAlert('Ошибка: пользователь не загружен');
    return;
  }

  try {
    const response = await fetch(`/api/admin/stats/detailed?admin_id=${window.currentUser.id}`);
    const data = await response.json();

    if (data.success) {
      const stats = data.stats;
      document.getElementById('stat-total-users').textContent = stats.totalUsers || 0;
      document.getElementById('stat-active-users').textContent = stats.activeUsersToday || 0;
      document.getElementById('stat-total-deposits').textContent = (stats.totalDeposits || 0).toFixed(2) + ' USDT';
      document.getElementById('stat-total-withdrawals').textContent = (stats.totalWithdrawals || 0).toFixed(2) + ' USDT';
      document.getElementById('stat-total-games').textContent = stats.totalGames || 0;

      if (window.tg && window.tg.HapticFeedback) {
        window.tg.HapticFeedback.notificationOccurred('success');
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error);
    if (window.tg) {
      window.tg.showAlert('❌ Ошибка загрузки статистики');
    }
  }
}

// Load user info
async function loadUserInfo() {
  const userId = document.getElementById('user-id-input').value;

  if (!userId) {
    window.tg.showAlert('Введите ID пользователя');
    return;
  }

  if (!window.currentUser) {
    window.tg.showAlert('Ошибка: пользователь не загружен');
    return;
  }

  try {
    const response = await fetch(`/api/admin/user/${userId}?admin_id=${window.currentUser.id}`);
    const data = await response.json();

    if (data.success) {
      window.currentUserForEdit = data.user;

      // Show user info block
      document.getElementById('user-info-block').style.display = 'block';

      // Fill data
      document.getElementById('user-info-id').textContent = data.user.id;
      document.getElementById('user-info-name').textContent = data.user.first_name + (data.user.last_name ? ' ' + data.user.last_name : '');
      document.getElementById('user-info-balance').textContent = (data.balance || 0).toFixed(2) + ' USDT';
      document.getElementById('user-info-blocked').textContent = data.user.is_blocked ? '🚫 Заблокирован' : '✅ Активен';

      // Update block button
      const blockBtn = document.getElementById('block-user-btn');
      if (data.user.is_blocked) {
        blockBtn.textContent = '✅ Разблокировать';
      } else {
        blockBtn.textContent = '🚫 Заблокировать';
      }

      if (window.tg && window.tg.HapticFeedback) {
        window.tg.HapticFeedback.notificationOccurred('success');
      }
    } else {
      window.tg.showAlert('❌ Пользователь не найден');
    }
  } catch (error) {
    console.error('Ошибка загрузки пользователя:', error);
    window.tg.showAlert('❌ Ошибка загрузки');
  }
}

// Edit user balance
async function editUserBalance(operation) {
  if (!window.currentUserForEdit) {
    window.tg.showAlert('Сначала загрузите пользователя');
    return;
  }

  if (!window.currentUser) {
    window.tg.showAlert('Ошибка: пользователь не загружен');
    return;
  }

  const amount = parseFloat(document.getElementById('balance-amount-input').value);

  if (isNaN(amount) || amount <= 0) {
    window.tg.showAlert('Введите корректную сумму');
    return;
  }

  try {
    const response = await fetch(`/api/admin/user/${window.currentUserForEdit.id}/edit-balance?admin_id=${window.currentUser.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation, amount })
    });

    const data = await response.json();

    if (data.success) {
      // Update balance display
      document.getElementById('user-info-balance').textContent = (data.newBalance || 0).toFixed(2) + ' USDT';
      document.getElementById('balance-amount-input').value = '';

      window.tg.showAlert('✅ Баланс обновлен!');

      if (window.tg && window.tg.HapticFeedback) {
        window.tg.HapticFeedback.notificationOccurred('success');
      }
    } else {
      window.tg.showAlert('❌ ' + (data.error || 'Ошибка'));
    }
  } catch (error) {
    console.error('Ошибка изменения баланса:', error);
    window.tg.showAlert('❌ Ошибка');
  }
}

// Toggle block user
async function toggleBlockUser() {
  if (!window.currentUserForEdit) {
    window.tg.showAlert('Сначала загрузите пользователя');
    return;
  }

  if (!window.currentUser) {
    window.tg.showAlert('Ошибка: пользователь не загружен');
    return;
  }

  const isCurrentlyBlocked = window.currentUserForEdit.is_blocked;

  try {
    const response = await fetch(`/api/admin/user/${window.currentUserForEdit.id}/block?admin_id=${window.currentUser.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ block: !isCurrentlyBlocked })
    });

    const data = await response.json();

    if (data.success) {
      window.currentUserForEdit.is_blocked = !isCurrentlyBlocked;

      // Update display
      document.getElementById('user-info-blocked').textContent = window.currentUserForEdit.is_blocked ? '🚫 Заблокирован' : '✅ Активен';

      const blockBtn = document.getElementById('block-user-btn');
      if (window.currentUserForEdit.is_blocked) {
        blockBtn.textContent = '✅ Разблокировать';
      } else {
        blockBtn.textContent = '🚫 Заблокировать';
      }

      window.tg.showAlert(window.currentUserForEdit.is_blocked ? '✅ Пользователь заблокирован' : '✅ Пользователь разблокирован');

      if (window.tg && window.tg.HapticFeedback) {
        window.tg.HapticFeedback.notificationOccurred('success');
      }
    } else {
      window.tg.showAlert('❌ ' + (data.error || 'Ошибка'));
    }
  } catch (error) {
    console.error('Ошибка блокировки:', error);
    window.tg.showAlert('❌ Ошибка');
  }
}

// Create broadcast
async function createBroadcast() {
  const text = document.getElementById('broadcast-text').value;
  const mediaUrl = document.getElementById('broadcast-media-url').value;
  const mediaType = document.getElementById('broadcast-media-type').value;

  if (!text.trim()) {
    window.tg.showAlert('Введите текст сообщения');
    return;
  }

  if (!window.currentUser) {
    window.tg.showAlert('Ошибка: пользователь не загружен');
    return;
  }

  try {
    // Create broadcast
    const createResponse = await fetch('/api/admin/broadcast/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin_id: window.currentUser.id,
        message_text: text,
        media_url: mediaUrl || null,
        media_type: mediaType || null
      })
    });

    const createData = await createResponse.json();

    if (createData.success && createData.broadcast) {
      // Send broadcast
      const sendResponse = await fetch(`/api/admin/broadcast/${createData.broadcast.id}/send`, {
        method: 'POST'
      });

      const sendData = await sendResponse.json();

      if (sendData.success) {
        window.tg.showAlert('✅ Рассылка запущена!');

        // Clear form
        document.getElementById('broadcast-text').value = '';
        document.getElementById('broadcast-media-url').value = '';
        document.getElementById('broadcast-media-type').value = '';

        // Reload broadcasts list
        setTimeout(() => loadBroadcasts(), 1000);

        if (window.tg && window.tg.HapticFeedback) {
          window.tg.HapticFeedback.notificationOccurred('success');
        }
      } else {
        window.tg.showAlert('❌ ' + (sendData.error || 'Ошибка отправки'));
      }
    } else {
      window.tg.showAlert('❌ ' + (createData.error || 'Ошибка создания'));
    }
  } catch (error) {
    console.error('Ошибка рассылки:', error);
    window.tg.showAlert('❌ Ошибка');
  }
}

// Load broadcasts
async function loadBroadcasts() {
  if (!window.currentUser) {
    window.tg.showAlert('Ошибка: пользователь не загружен');
    return;
  }

  try {
    const response = await fetch(`/api/admin/broadcasts?limit=10&admin_id=${window.currentUser.id}`);
    const data = await response.json();

    if (data.success) {
      const listEl = document.getElementById('broadcasts-list');

      if (data.broadcasts.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; color: var(--text-secondary);">Нет рассылок</div>';
        return;
      }

      listEl.innerHTML = '';

      data.broadcasts.forEach(broadcast => {
        const item = document.createElement('div');
        item.className = 'stat-row';
        item.style.marginBottom = '8px';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'flex-start';

        const statusEmoji = broadcast.status === 'completed' ? '✅' : broadcast.status === 'sending' ? '📤' : '📝';

        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; width: 100%;">
            <span>${statusEmoji} ID: ${broadcast.id}</span>
            <span>${new Date(broadcast.created_at).toLocaleDateString('ru-RU')}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
            Отправлено: ${broadcast.total_sent || 0} | Прочитано: ${broadcast.total_read || 0}
          </div>
        `;

        listEl.appendChild(item);
      });
    }
  } catch (error) {
    console.error('Ошибка загрузки рассылок:', error);
  }
}

// Save RTP settings
async function saveRTPSettings() {
  if (!window.currentUser) {
    window.tg.showAlert('Ошибка: пользователь не загружен');
    return;
  }

  const games = ['dice', 'slots', 'rps', 'darts', 'football', 'basketball'];
  const gameIds = { dice: 1, slots: 2, rps: 3, darts: 4, football: 5, basketball: 6 };

  try {
    for (const game of games) {
      const rtp = parseFloat(document.getElementById(`rtp-${game}`).value);

      if (isNaN(rtp) || rtp < 50 || rtp > 100) {
        window.tg.showAlert(`❌ RTP для ${game} должен быть от 50 до 100`);
        return;
      }

      await fetch(`/api/admin/games/${gameIds[game]}/rtp?admin_id=${window.currentUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rtp })
      });
    }

    window.tg.showAlert('✅ RTP обновлен!');

    if (window.tg && window.tg.HapticFeedback) {
      window.tg.HapticFeedback.notificationOccurred('success');
    }
  } catch (error) {
    console.error('Ошибка сохранения RTP:', error);
    window.tg.showAlert('❌ Ошибка');
  }
}

// Save global settings
async function saveGlobalSettings() {
  if (!window.currentUser) {
    window.tg.showAlert('Ошибка: пользователь не загружен');
    return;
  }

  const minDeposit = parseFloat(document.getElementById('setting-min-deposit').value);
  const minWithdrawal = parseFloat(document.getElementById('setting-min-withdrawal').value);
  const minBet = parseFloat(document.getElementById('setting-min-bet').value);

  if (isNaN(minDeposit) || isNaN(minWithdrawal) || isNaN(minBet)) {
    window.tg.showAlert('❌ Введите корректные значения');
    return;
  }

  try {
    await fetch(`/api/admin/settings/min_deposit?admin_id=${window.currentUser.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: minDeposit.toString() })
    });

    await fetch(`/api/admin/settings/min_withdrawal?admin_id=${window.currentUser.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: minWithdrawal.toString() })
    });

    await fetch(`/api/admin/settings/min_bet?admin_id=${window.currentUser.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: minBet.toString() })
    });

    window.tg.showAlert('✅ Настройки сохранены!');

    if (window.tg && window.tg.HapticFeedback) {
      window.tg.HapticFeedback.notificationOccurred('success');
    }
  } catch (error) {
    console.error('Ошибка сохранения настроек:', error);
    window.tg.showAlert('❌ Ошибка');
  }
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

      // Check admin permissions
      await checkAdminPermission();
    } else {
      console.error('❌ Telegram SDK не загружен');
    }
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);
  }
})();

console.log('✅ App.js загружен полностью');

// Debug функция для проверки статуса пользователя
window.checkMyStatus = function() {
  console.log('=== 📊 СТАТУС ПОЛЬЗОВАТЕЛЯ ===');
  console.log('URL параметры:', getUrlParams());
  console.log('Данные из URL:', window.userDataFromUrl);
  console.log('Текущий пользователь:', window.currentUser);
  console.log('Является админом:', window.isAdmin);
  console.log('==============================');

  if (!window.currentUser) {
    console.warn('⚠️ Пользователь не загружен! Попробуйте перезагрузить страницу.');
  } else {
    console.log(`👤 ID: ${window.currentUser.id}`);
    console.log(`📱 Telegram ID: ${window.currentUser.telegram_id}`);
    console.log(`👨 Имя: ${window.currentUser.first_name}`);
    console.log(`🔐 Админ: ${window.isAdmin ? 'ДА ✅' : 'НЕТ ❌'}`);
  }
};
