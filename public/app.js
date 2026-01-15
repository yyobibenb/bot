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

// Play dice game with specific mode
async function playDiceMode(choice, modeName) {
  if (!window.currentUser) {
    if (window.tg) {
      window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
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

  // Get the correct dice display element based on mode
  let diceDisplay;
  if (modeName === 'higher-lower') {
    diceDisplay = document.getElementById('dice-higher-lower-result');
  } else if (modeName === 'even-odd') {
    diceDisplay = document.getElementById('dice-even-odd-result');
  } else if (modeName === 'exact') {
    diceDisplay = document.getElementById('dice-exact-result');
  }

  if (!diceDisplay) return;

  // Add spinning animation
  diceDisplay.classList.add('spinning');

  try {
    let endpoint = '';
    let body = {
      user_id: window.currentUser.id,
      bet_amount: betAmount
    };

    if (modeName === 'higher-lower') {
      endpoint = '/api/games/dice/higher-lower';
      body.choice = choice;
    } else if (modeName === 'even-odd') {
      endpoint = '/api/games/dice/even-odd';
      body.choice = choice;
    } else if (modeName === 'exact') {
      endpoint = '/api/games/dice/exact-number';
      body.choice = parseInt(choice);
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

        // Show result message
        if (data.isWin) {
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('success');
          }
          if (window.tg) {
            window.tg.showAlert(`🎉 Выигрыш: ${data.winAmount.toFixed(2)} USDT! (x${data.multiplier})`);
          }
        } else {
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('error');
          }
          if (window.tg) {
            window.tg.showAlert(`❌ Проигрыш. Выпало: ${data.result}`);
          }
        }

        // Update balance
        if (data.newBalance !== undefined) {
          document.getElementById('balance').textContent = data.newBalance.toFixed(2);
          document.getElementById('dice-balance-amount').textContent = data.newBalance.toFixed(2);
        }
      } else {
        if (window.tg) {
          window.tg.showAlert('❌ ' + (data.error || 'Ошибка'));
        }
      }
    }, 1500);
  } catch (error) {
    diceDisplay.classList.remove('spinning');
    if (window.tg) {
      window.tg.showAlert('❌ Ошибка: ' + error.message);
    }
    console.error('Dice game error:', error);
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
