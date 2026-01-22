// Telegram WebApp initialization
console.log('🚀 App.js загружается...');

// Global state
window.currentUser = null;
window.selectedGameMode = null;
window.userDataFromUrl = null;

// Debug logging to screen
let logsVisible = true;

function debugLog(message, type = 'info') {
  // Пишем в консоль
  console.log(message);

  // Пишем на экран
  const logsContent = document.getElementById('debug-logs-content');
  if (logsContent) {
    const logEntry = document.createElement('div');
    logEntry.className = `debug-log-entry debug-log-${type}`;
    logEntry.textContent = message;
    logsContent.appendChild(logEntry);

    // Скроллим вниз
    logsContent.scrollTop = logsContent.scrollHeight;
  }
}

function toggleLogs() {
  const logsContent = document.getElementById('debug-logs-content');
  const toggleBtn = document.querySelector('.debug-toggle');

  logsVisible = !logsVisible;

  if (logsVisible) {
    logsContent.style.display = 'block';
    toggleBtn.textContent = 'Скрыть';
  } else {
    logsContent.style.display = 'none';
    toggleBtn.textContent = 'Показать';
  }
}

window.toggleLogs = toggleLogs;

// Initialize Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
  window.tg = window.Telegram.WebApp;
  window.tg.ready();
  window.tg.expand();
  debugLog('✅ Telegram WebApp ready', 'success');
} else {
  debugLog('❌ Telegram WebApp not found', 'error');
}

// Get telegram_id from Telegram SDK or URL
function getTelegramId() {
  debugLog('═══════════════════════════════════════');
  debugLog('🔍 ДИАГНОСТИКА: Ищу telegram_id');
  debugLog('═══════════════════════════════════════');

  // ПРИОРИТЕТ 1: Telegram SDK (ПРАВИЛЬНЫЙ способ для web_app кнопок)
  debugLog('1️⃣ Проверяю Telegram SDK...');
  debugLog('  window.tg существует: ' + (!!window.tg));

  if (window.tg) {
    debugLog('  initDataUnsafe: ' + JSON.stringify(window.tg.initDataUnsafe));

    if (window.tg.initDataUnsafe) {
      debugLog('  user: ' + JSON.stringify(window.tg.initDataUnsafe.user));

      if (window.tg.initDataUnsafe.user) {
        const tgId = window.tg.initDataUnsafe.user.id;
        debugLog('✅ НАЙДЕН ID из SDK: ' + tgId, 'success');
        debugLog('═══════════════════════════════════════');
        return tgId;
      }
    }
  }

  debugLog('❌ SDK не содержит данных', 'error');

  // ПРИОРИТЕТ 2: URL параметры (fallback, если открыто напрямую)
  debugLog('2️⃣ Проверяю URL параметры...');
  debugLog('  URL: ' + window.location.href);

  const params = new URLSearchParams(window.location.search);
  const tgIdFromUrl = params.get('tg_id');

  if (tgIdFromUrl) {
    debugLog('✅ НАЙДЕН ID из URL: ' + tgIdFromUrl, 'success');
    debugLog('═══════════════════════════════════════');
    return parseInt(tgIdFromUrl);
  }

  debugLog('❌ URL не содержит tg_id', 'error');
  debugLog('🚨 ID НЕ НАЙДЕН!', 'error');
  debugLog('═══════════════════════════════════════');
  return null;
}

// Load user data from API
window.loadUserData = async function() {
  debugLog('═══════════════════════════════════════');
  debugLog('🚀 ЗАГРУЗКА ПРОФИЛЯ');
  debugLog('═══════════════════════════════════════');
  debugLog('📍 URL: ' + window.location.href.substring(0, 60) + '...');

  // Получаем telegram_id из URL или SDK
  const telegramId = getTelegramId();

  if (!telegramId) {
    debugLog('❌ НЕ МОГУ ЗАГРУЗИТЬ: нет telegram_id!', 'error');
    debugLog('💡 Проверь настройки бота и BotFather', 'error');
    document.getElementById('username').textContent = 'Ошибка загрузки';
    document.getElementById('handle').textContent = 'Нет telegram_id';
    return;
  }

  debugLog('═══════════════════════════════════════');
  debugLog('📡 Загружаю данные из БД...');

  try {
    // Загружаем пользователя из БД по telegram_id
    const response = await fetch(`/api/user/telegram/${telegramId}`);

    if (response.ok) {
      const data = await response.json();
      window.currentUser = data.user;
      debugLog('✅ Пользователь загружен из БД');
      debugLog('📊 Данные пользователя: ' + JSON.stringify(data.user));
      console.log('💰 Баланс:', data.balance);

      // Формируем полное имя
      const fullName = window.currentUser.first_name + (window.currentUser.last_name ? ' ' + window.currentUser.last_name : '');

      // Обновляем UI
      document.getElementById('username').textContent = fullName;
      document.getElementById('handle').textContent = '@' + (window.currentUser.username || 'user' + window.currentUser.telegram_id);
      document.getElementById('balance').textContent = (data.balance || 0).toFixed(2);

      // Обновляем аватар
      debugLog('───────────────────────────────────────');
      debugLog('🖼️ ОБРАБОТКА АВАТАРА');
      debugLog('───────────────────────────────────────');

      const avatar = document.getElementById('avatar');

      // ОПРЕДЕЛЯЕМ ИСТОЧНИК ФОТО
      debugLog('🔍 Проверяю источники photo_url:');
      debugLog('');

      let photoUrl = null;
      let photoSource = null;

      // ПРИОРИТЕТ 1: Telegram SDK (может передавать photo_url!)
      debugLog('1️⃣ Проверяю Telegram SDK...');
      if (window.tg && window.tg.initDataUnsafe && window.tg.initDataUnsafe.user) {
        const sdkPhotoUrl = window.tg.initDataUnsafe.user.photo_url;
        debugLog('   SDK user.photo_url: ' + (sdkPhotoUrl || 'НЕТ'));

        if (sdkPhotoUrl) {
          photoUrl = sdkPhotoUrl;
          photoSource = 'Telegram SDK';
          debugLog('   ✅ НАЙДЕН в SDK!', 'success');
        } else {
          debugLog('   ❌ В SDK нет photo_url');
        }
      } else {
        debugLog('   ❌ SDK недоступен');
      }

      debugLog('');

      // ПРИОРИТЕТ 2: База данных
      debugLog('2️⃣ Проверяю БД...');
      const dbPhotoUrl = window.currentUser.photo_url;
      debugLog('   БД photo_url: ' + (dbPhotoUrl || 'NULL'));

      if (!photoUrl && dbPhotoUrl) {
        photoUrl = dbPhotoUrl;
        photoSource = 'База данных';
        debugLog('   ✅ Использую фото из БД', 'success');
      } else if (!photoUrl && !dbPhotoUrl) {
        debugLog('   ❌ В БД тоже NULL');
      } else if (photoUrl && dbPhotoUrl) {
        debugLog('   ℹ️ В БД есть, но использую SDK (приоритет)');
      } else if (photoUrl && !dbPhotoUrl) {
        debugLog('   ℹ️ В БД нет, но есть в SDK');
      }

      debugLog('');
      debugLog('═══════════════════════════════════════');
      debugLog('📷 ИТОГОВЫЙ РЕЗУЛЬТАТ:');
      debugLog('═══════════════════════════════════════');

      if (photoUrl) {
        debugLog('✅ Photo URL НАЙДЕН!', 'success');
        debugLog('📍 Источник: ' + photoSource, 'success');
        debugLog('📎 URL: ' + photoUrl.substring(0, 80) + (photoUrl.length > 80 ? '...' : ''));
        debugLog('⏳ Загружаю изображение...');
        debugLog('');

        const img = new Image();
        img.onload = function() {
          debugLog('✅ Аватар успешно загружен!', 'success');
          debugLog('🎨 Отображаю аватар в профиле');
          avatar.innerHTML = `<img src="${photoUrl}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        };
        img.onerror = function() {
          debugLog('❌ ОШИБКА загрузки аватара!', 'error');
          debugLog('⚠️ Возможные причины:', 'error');
          debugLog('  1. Неверный URL', 'error');
          debugLog('  2. Файл удалён', 'error');
          debugLog('  3. Проблемы с сетью', 'error');
          debugLog('  4. CORS блокировка', 'error');
          debugLog('💡 Показываю инициал вместо фото');
          avatar.textContent = fullName.charAt(0).toUpperCase();
        };
        img.src = photoUrl;
      } else {
        debugLog('❌ Photo URL НЕ НАЙДЕН ни в одном источнике!', 'error');
        debugLog('');
        debugLog('📌 Что проверили:', 'warning');
        debugLog('  1. Telegram SDK → ' + (window.tg && window.tg.initDataUnsafe && window.tg.initDataUnsafe.user ? 'доступен, но photo_url пустой' : 'недоступен'));
        debugLog('  2. База данных → photo_url = NULL');
        debugLog('');
        debugLog('💡 Решения:', 'warning');
        debugLog('  1. Убедись что у тебя есть фото в Telegram');
        debugLog('  2. Отправь /start боту чтобы бот получил фото');
        debugLog('  3. Проверь права бота (getUserProfilePhotos)');
        debugLog('');
        debugLog('🔤 Показываю инициал: ' + fullName.charAt(0).toUpperCase());
        avatar.textContent = fullName.charAt(0).toUpperCase();
      }

      debugLog('───────────────────────────────────────');
      debugLog('✅ Профиль отображён в UI', 'success');

      // Load user stats and referral data
      debugLog('📊 Загружаю статистику пользователя...');
      loadUserStats();
      debugLog('👥 Загружаю реферальные данные...');
      loadReferralStats();
    } else if (response.status === 404) {
      debugLog('⚠️ Пользователь НЕ найден в БД!', 'warning');
      debugLog('🆕 Создаю нового пользователя...');

      // Берем данные из Telegram SDK для создания пользователя
      let userData = {
        telegram_id: telegramId,
        first_name: 'User',
        username: '',
        last_name: '',
        language_code: '',
        photo_url: null,
        is_premium: false
      };

      if (window.tg && window.tg.initDataUnsafe && window.tg.initDataUnsafe.user) {
        const tgUser = window.tg.initDataUnsafe.user;
        debugLog('📱 Данные из SDK: ' + JSON.stringify(tgUser));
        debugLog('🖼️ SDK photo_url: ' + (tgUser.photo_url || 'НЕТ'));

        if (tgUser.photo_url) {
          debugLog('✅ SDK ПЕРЕДАЁТ photo_url!', 'success');
        } else {
          debugLog('⚠️ В SDK нет photo_url', 'warning');
          debugLog('📷 Бот получит фото при /start', 'info');
        }

        userData = {
          telegram_id: telegramId,
          username: tgUser.username || '',
          first_name: tgUser.first_name || 'User',
          last_name: tgUser.last_name || '',
          language_code: tgUser.language_code || '',
          photo_url: tgUser.photo_url || null, // БЕРЁМ из SDK если есть!
          is_premium: tgUser.is_premium || false
        };
      } else {
        debugLog('⚠️ SDK недоступен, минимальные данные', 'warning');
      }

      const createResponse = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      const createData = await createResponse.json();
      if (createData.success && createData.user) {
        window.currentUser = createData.user;
        debugLog('✅ Новый пользователь создан в БД!', 'success');

        // Формируем полное имя
        const fullName = window.currentUser.first_name + (window.currentUser.last_name ? ' ' + window.currentUser.last_name : '');

        // Обновляем UI
        document.getElementById('username').textContent = fullName;
        document.getElementById('handle').textContent = '@' + (window.currentUser.username || 'user' + window.currentUser.telegram_id);
        document.getElementById('balance').textContent = (createData.balance || 0).toFixed(2);

        // Обновляем аватар
        debugLog('───────────────────────────────────────');
        debugLog('🖼️ ОБРАБОТКА АВАТАРА (новый юзер)');
        debugLog('───────────────────────────────────────');

        const avatar = document.getElementById('avatar');

        // ОПРЕДЕЛЯЕМ ИСТОЧНИК ФОТО (также как для существующего юзера)
        debugLog('🔍 Проверяю источники photo_url:');
        debugLog('');

        let photoUrl = null;
        let photoSource = null;

        // ПРИОРИТЕТ 1: Telegram SDK
        debugLog('1️⃣ Проверяю Telegram SDK...');
        if (window.tg && window.tg.initDataUnsafe && window.tg.initDataUnsafe.user) {
          const sdkPhotoUrl = window.tg.initDataUnsafe.user.photo_url;
          debugLog('   SDK user.photo_url: ' + (sdkPhotoUrl || 'НЕТ'));

          if (sdkPhotoUrl) {
            photoUrl = sdkPhotoUrl;
            photoSource = 'Telegram SDK';
            debugLog('   ✅ НАЙДЕН в SDK!', 'success');
          } else {
            debugLog('   ❌ В SDK нет photo_url');
          }
        } else {
          debugLog('   ❌ SDK недоступен');
        }

        debugLog('');

        // ПРИОРИТЕТ 2: База данных (только что созданный)
        debugLog('2️⃣ Проверяю БД (только что создали)...');
        const dbPhotoUrl = window.currentUser.photo_url;
        debugLog('   БД photo_url: ' + (dbPhotoUrl || 'NULL'));

        if (!photoUrl && dbPhotoUrl) {
          photoUrl = dbPhotoUrl;
          photoSource = 'База данных';
          debugLog('   ✅ Использую из БД', 'success');
        } else if (!photoUrl && !dbPhotoUrl) {
          debugLog('   ❌ В БД тоже NULL');
        } else if (photoUrl && !dbPhotoUrl) {
          debugLog('   ℹ️ В БД нет, использую SDK');
        }

        debugLog('');
        debugLog('═══════════════════════════════════════');
        debugLog('📷 ИТОГОВЫЙ РЕЗУЛЬТАТ:');
        debugLog('═══════════════════════════════════════');

        if (photoUrl) {
          debugLog('✅ Photo URL НАЙДЕН!', 'success');
          debugLog('📍 Источник: ' + photoSource, 'success');
          debugLog('📎 URL: ' + photoUrl.substring(0, 80) + (photoUrl.length > 80 ? '...' : ''));
          debugLog('⏳ Загружаю изображение...');
          debugLog('');

          const img = new Image();
          img.onload = function() {
            debugLog('✅ Аватар загружен!', 'success');
            debugLog('🎨 Отображаю в профиле');
            avatar.innerHTML = `<img src="${photoUrl}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
          };
          img.onerror = function() {
            debugLog('❌ Ошибка загрузки!', 'error');
            debugLog('💡 Показываю инициал');
            avatar.textContent = fullName.charAt(0).toUpperCase();
          };
          img.src = photoUrl;
        } else {
          debugLog('❌ Photo URL НЕ НАЙДЕН!', 'warning');
          debugLog('💡 Это нормально для нового юзера', 'info');
          debugLog('📷 Бот получит фото при следующем /start', 'info');
          debugLog('🔤 Показываю инициал: ' + fullName.charAt(0).toUpperCase());
          avatar.textContent = fullName.charAt(0).toUpperCase();
        }

        debugLog('───────────────────────────────────────');
        debugLog('✅ Профиль нового юзера готов!', 'success');

        // Load user stats and referral data for new user
        debugLog('📊 Загружаю статистику пользователя...');
        loadUserStats();
        debugLog('👥 Загружаю реферальные данные...');
        loadReferralStats();
      }
    }
  } catch (error) {
    debugLog('═══════════════════════════════════════');
    debugLog('❌ КРИТИЧЕСКАЯ ОШИБКА!', 'error');
    debugLog('═══════════════════════════════════════');
    debugLog('📛 Ошибка: ' + error.message, 'error');
    debugLog('🔍 Стек: ' + (error.stack || 'нет').substring(0, 100), 'error');
    debugLog('💡 Проверь:', 'error');
    debugLog('  1. Работает ли сервер?', 'error');
    debugLog('  2. Правильный ли API endpoint?', 'error');
    debugLog('  3. Есть ли интернет?', 'error');
    debugLog('═══════════════════════════════════════');

    document.getElementById('username').textContent = 'Ошибка загрузки';
    document.getElementById('handle').textContent = error.message;
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

  // Запрашиваем сумму пополнения
  const depositAmountStr = prompt('💰 Введите сумму пополнения в USDT (минимум 1):\n\n💳 Оплата через CryptoBot');

  if (!depositAmountStr) return;

  const depositAmount = parseFloat(depositAmountStr);

  if (isNaN(depositAmount) || depositAmount < 1) {
    window.tg.showAlert('❌ Минимальная сумма пополнения: 1 USDT');
    return;
  }

  try {
    // Показываем индикатор загрузки
    if (window.tg.MainButton) {
      window.tg.MainButton.setText('Создание счета...').show();
      if (window.tg.MainButton.showProgress) {
        window.tg.MainButton.showProgress();
      }
    }

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

    if (window.tg.MainButton) {
      if (window.tg.MainButton.hideProgress) {
        window.tg.MainButton.hideProgress();
      }
      window.tg.MainButton.hide();
    }

    if (data.success && data.invoice_url) {
      // Открываем страницу оплаты CryptoBot внутри Telegram
      window.tg.openTelegramLink(data.invoice_url);
    } else {
      window.tg.showAlert('❌ Ошибка создания счета:\n\n' + (data.error || 'Не удалось создать счет'));
      console.error('Create invoice error:', data);
    }
  } catch (error) {
    if (window.tg.MainButton) {
      if (window.tg.MainButton.hideProgress) {
        window.tg.MainButton.hideProgress();
      }
      window.tg.MainButton.hide();
    }
    window.tg.showAlert('❌ Ошибка при создании счета');
    console.error('Deposit error:', error);
  }
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
  const withdrawAmountStr = prompt(`💸 Введите сумму для вывода в USDT (минимум 10):\n\n💰 Ваш баланс: ${currentBalance.toFixed(2)} USDT\n\n⚡️ Вывод через @send бота`);

  if (!withdrawAmountStr) return;

  const amount = parseFloat(withdrawAmountStr);

  if (isNaN(amount) || amount < 10) {
    window.tg.showAlert('❌ Минимальная сумма вывода: 10 USDT');
    return;
  }

  if (amount > currentBalance) {
    window.tg.showAlert('❌ Недостаточно средств!\n\nЗапрошено: ' + amount.toFixed(2) + ' USDT\nДоступно: ' + currentBalance.toFixed(2) + ' USDT');
    return;
  }

  try {
    // Показываем индикатор загрузки
    if (window.tg.MainButton) {
      window.tg.MainButton.setText('Создание заявки...').show();
      if (window.tg.MainButton.showProgress) {
        window.tg.MainButton.showProgress();
      }
    }

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

    if (window.tg.MainButton) {
      if (window.tg.MainButton.hideProgress) {
        window.tg.MainButton.hideProgress();
      }
      window.tg.MainButton.hide();
    }

    if (data.success) {
      // Обновляем баланс на экране
      document.getElementById('balance').textContent = (data.newBalance || 0).toFixed(2);
      window.tg.showAlert('✅ Заявка на вывод создана!\n\n💰 Сумма: ' + amount.toFixed(2) + ' USDT\n\n⏳ Админ обработает заявку и отправит средства через @send бота в ближайшее время.\n\n🆔 Ваш Telegram ID: ' + window.currentUser.telegram_id);
    } else {
      window.tg.showAlert('❌ Ошибка создания заявки:\n\n' + (data.error || 'Не удалось создать заявку'));
      console.error('Withdraw error:', data);
    }
  } catch (error) {
    if (window.tg.MainButton) {
      if (window.tg.MainButton.hideProgress) {
        window.tg.MainButton.hideProgress();
      }
      window.tg.MainButton.hide();
    }
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

  // Reload data when switching to specific screens
  if (section === 'referral') {
    console.log('👥 Opening referral screen, reloading data...');
    loadReferralStats();
  } else if (section === 'profile') {
    console.log('📊 Opening profile screen, reloading stats...');
    loadUserStats();
  } else if (section === 'admin') {
    console.log('⚙️ Opening admin screen, loading stats...');
    // Вызываем showAdminSection для правильной инициализации
    showAdminSection('stats');
  }
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

  // Инициализировать превью кубиков на карточках
  initDicePreviews();

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('dice-game-screen').classList.add('active');
}

// Инициализировать превью кубиков на карточках режимов
function initDicePreviews() {
  const previews = document.querySelectorAll('.dice-mode-preview');

  previews.forEach(preview => {
    // Очистить контейнер
    preview.innerHTML = '';

    // Загрузить анимацию кубика грани "4" для красоты
    if (typeof lottie !== 'undefined') {
      const anim = lottie.loadAnimation({
        container: preview,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: '/animations/Rectangular_4.json'
      });

      console.log('🎲 Превью кубика загружено для', preview.dataset.mode);
    } else {
      // Fallback - эмодзи
      preview.innerHTML = '<div style="font-size: 40px;">🎲</div>';
    }
  });
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
  // Останавливаем интервал дуэлей если он был запущен
  if (window.duelsInterval) {
    clearInterval(window.duelsInterval);
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('dice-game-screen').classList.add('active');
}

// ========== TELEGRAM-STYLE DICE ANIMATION ==========

// Анимация кубика как в Telegram - красиво крутится и останавливается СРАЗУ на нужном результате
function playTelegramStyleDiceAnimation(resultNumber, diceEmojiElement, onComplete) {
  const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  let frameCount = 0;
  const totalFrames = 25; // Количество кадров прокрутки
  let currentSpeed = 40; // Скорость прокрутки (мс)

  // Быстрая прокрутка
  const fastInterval = setInterval(() => {
    frameCount++;

    // Показываем случайные грани (эффект прокрутки)
    const randomDice = Math.floor(Math.random() * 6);
    diceEmojiElement.textContent = diceEmojis[randomDice];

    // Когда приближаемся к концу - замедляемся
    if (frameCount >= totalFrames * 0.6) {
      clearInterval(fastInterval);

      // Замедленная прокрутка перед финалом
      let slowFrames = 0;
      const maxSlowFrames = 8;
      const slowInterval = setInterval(() => {
        slowFrames++;

        // Показываем грани близкие к результату (для реалистичности)
        let nearResult = resultNumber + (Math.random() > 0.5 ? 1 : -1);
        if (nearResult < 1) nearResult = 6;
        if (nearResult > 6) nearResult = 1;
        diceEmojiElement.textContent = diceEmojis[nearResult - 1];

        if (slowFrames >= maxSlowFrames) {
          clearInterval(slowInterval);

          // ФИНАЛЬНАЯ ОСТАНОВКА на нужном результате
          setTimeout(() => {
            diceEmojiElement.textContent = diceEmojis[resultNumber - 1];
            diceEmojiElement.classList.remove('spinning');

            // Эффект "выскакивания" финального результата
            diceEmojiElement.style.transform = 'scale(1.3)';
            setTimeout(() => {
              diceEmojiElement.style.transform = 'scale(1)';
              if (onComplete) onComplete();
            }, 150);
          }, 100);
        }
      }, 100); // Медленнее в конце
    }
  }, currentSpeed);
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

  // Disable button
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

    // ПОКАЗЫВАЕМ TELEGRAM-STYLE АНИМАЦИЮ с результатом с backend!
    playTelegramStyleDiceAnimation(data.result, diceEmoji, () => {
      if (data.success) {
        // const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        // diceEmoji.textContent = diceEmojis[data.result - 1] || '🎲'; // Уже установлено в анимации

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

// ========== NEW UI: ALL-IN-ONE CARD FUNCTIONS ==========

// Глобальная переменная для хранения выборов пользователя по каждому режиму
window.diceChoices = {};

// Функция для выбора кнопки в карточке (подсветка активной кнопки)
function selectDiceChoice(button, mode, choice) {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('light');
  }

  // Сохраняем выбор для этого режима
  window.diceChoices[mode] = choice;

  // Убираем класс active со всех кнопок в этой карточке
  const card = button.closest('.dice-mode-card-full');
  const allButtons = card.querySelectorAll('.dice-choice-btn, .dice-number-btn');
  allButtons.forEach(btn => btn.classList.remove('active'));

  // Добавляем класс active к нажатой кнопке
  button.classList.add('active');
}

// Функция для игры прямо из карточки
async function playDiceFromCard(mode, multiplier) {
  if (!window.currentUser) {
    if (window.tg) {
      window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
    }
    return;
  }

  // Проверяем что пользователь выбрал вариант (кроме режимов sequence и duel)
  if (mode !== 'sequence' && mode !== 'duel' && !window.diceChoices[mode]) {
    if (window.tg) {
      window.tg.showAlert('Выберите вариант перед игрой!');
    } else {
      alert('Выберите вариант перед игрой!');
    }
    return;
  }

  // Находим input для ставки в этой карточке
  const betInput = document.querySelector(`input[data-mode="${mode}"]`);
  const betAmount = parseFloat(betInput.value);

  if (isNaN(betAmount) || betAmount <= 0) {
    if (window.tg) {
      window.tg.showAlert('Введите корректную ставку!');
    }
    return;
  }

  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('heavy');
  }

  // Находим элементы в карточке
  const card = betInput.closest('.dice-mode-card-full');
  const playBtn = card.querySelector('.dice-play-btn');
  const diceEmoji = card.querySelector('.dice-emoji-small');

  // Disable button
  playBtn.disabled = true;
  const originalText = playBtn.textContent;
  playBtn.textContent = 'Бросаем...';
  diceEmoji.classList.add('spinning');

  try {
    let endpoint = '';
    let body = {
      user_id: window.currentUser.id,
      bet_amount: betAmount
    };

    const choice = window.diceChoices[mode];

    if (mode === 'higher-lower') {
      endpoint = '/api/games/dice/higher-lower';
      body.choice = choice;
    } else if (mode === 'even-odd') {
      endpoint = '/api/games/dice/even-odd';
      body.choice = choice;
    } else if (mode === 'exact') {
      endpoint = '/api/games/dice/exact-number';
      body.choice = parseInt(choice);
    } else if (mode === '2x2') {
      endpoint = '/api/games/dice/2x2';
      body.choice = choice;
    } else if (mode === '3x3') {
      endpoint = '/api/games/dice/3x3';
      body.choice = choice;
    } else if (mode === 'sector') {
      endpoint = '/api/games/dice/sector';
      body.choice = parseInt(choice);
    } else if (mode === 'sequence') {
      endpoint = '/api/games/dice/sequence';
    } else if (mode === 'duel') {
      endpoint = '/api/games/dice/duel';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    // ПОКАЗЫВАЕМ TELEGRAM-STYLE АНИМАЦИЮ с результатом с backend!
    playTelegramStyleDiceAnimation(data.result, diceEmoji, () => {
      if (data.success) {
        // Обновляем баланс
        const newBalance = parseFloat(data.new_balance || data.balance || 0);
        document.getElementById('balance').textContent = newBalance.toFixed(2);
        document.getElementById('dice-balance-amount').textContent = newBalance.toFixed(2);

        if (data.won) {
          // Выигрыш!
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('success');
          }

          // Показываем сообщение о выигрыше
          if (window.tg) {
            window.tg.showAlert(`🎉 Выигрыш! +${data.win_amount.toFixed(2)}$`);
          } else {
            alert(`🎉 Выигрыш! +${data.win_amount.toFixed(2)}$`);
          }
        } else {
          // Проигрыш
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('error');
          }
        }
      } else {
        if (window.tg) {
          window.tg.showAlert('❌ ' + (data.error || 'Ошибка'));
        }
      }

      playBtn.disabled = false;
      playBtn.textContent = originalText;
    });
  } catch (error) {
    diceEmoji.classList.remove('spinning');
    playBtn.disabled = false;
    playBtn.textContent = originalText;

    if (window.tg) {
      window.tg.showAlert('❌ Ошибка: ' + error.message);
    }
    console.error('Dice game error:', error);
  }
}

// ========== BOWLING GAME FROM CARD ==========
async function playBowlingFromCard(mode, multiplier) {
  if (!window.currentUser) {
    if (window.tg) {
      window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
    }
    return;
  }

  const betInput = document.querySelector(`input[data-mode="bowling-${mode}"]`);
  const betAmount = parseFloat(betInput.value);

  if (isNaN(betAmount) || betAmount <= 0) {
    if (window.tg) {
      window.tg.showAlert('Введите корректную ставку!');
    }
    return;
  }

  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('heavy');
  }

  const card = betInput.closest('.dice-mode-card-full');
  const playBtn = card.querySelector('.dice-play-btn');
  const emoji = card.querySelector('.dice-emoji-small');

  playBtn.disabled = true;
  const originalText = playBtn.textContent;
  playBtn.textContent = 'Бросаем...';
  emoji.classList.add('spinning');

  try {
    const endpoint = mode === 'strike' ? '/api/games/bowling/strike' : '/api/games/bowling/duel';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: window.currentUser.id,
        bet_amount: betAmount
      })
    });

    const data = await response.json();

    playTelegramStyleDiceAnimation(data.result, emoji, () => {
      if (data.success) {
        const newBalance = parseFloat(data.new_balance || data.balance || 0);
        document.getElementById('balance').textContent = newBalance.toFixed(2);
        document.getElementById('bowling-balance-amount').textContent = newBalance.toFixed(2);

        if (data.won) {
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('success');
          }
          if (window.tg) {
            window.tg.showAlert(`🎉 Выигрыш! +${data.win_amount.toFixed(2)}$`);
          }
        } else {
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('error');
          }
        }
      } else {
        if (window.tg) {
          window.tg.showAlert('❌ ' + (data.error || 'Ошибка'));
        }
      }
      playBtn.disabled = false;
      playBtn.textContent = originalText;
    });
  } catch (error) {
    emoji.classList.remove('spinning');
    playBtn.disabled = false;
    playBtn.textContent = originalText;
    if (window.tg) {
      window.tg.showAlert('❌ Ошибка: ' + error.message);
    }
    console.error('Bowling game error:', error);
  }
}

// ========== FOOTBALL GAME FROM CARD ==========
async function playFootballFromCard(mode, multiplier) {
  if (!window.currentUser) {
    if (window.tg) {
      window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
    }
    return;
  }

  const betInput = document.querySelector(`input[data-mode="football-${mode}"]`);
  const betAmount = parseFloat(betInput.value);

  if (isNaN(betAmount) || betAmount <= 0) {
    if (window.tg) {
      window.tg.showAlert('Введите корректную ставку!');
    }
    return;
  }

  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('heavy');
  }

  const card = betInput.closest('.dice-mode-card-full');
  const playBtn = card.querySelector('.dice-play-btn');
  const emoji = card.querySelector('.dice-emoji-small');

  playBtn.disabled = true;
  const originalText = playBtn.textContent;
  playBtn.textContent = 'Бьём...';
  emoji.classList.add('spinning');

  try {
    let endpoint = '';
    if (mode === 'goal') endpoint = '/api/games/football/goal';
    else if (mode === 'miss') endpoint = '/api/games/football/miss';
    else if (mode === 'duel') endpoint = '/api/games/football/duel';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: window.currentUser.id,
        bet_amount: betAmount
      })
    });

    const data = await response.json();

    playTelegramStyleDiceAnimation(data.result, emoji, () => {
      if (data.success) {
        const newBalance = parseFloat(data.new_balance || data.balance || 0);
        document.getElementById('balance').textContent = newBalance.toFixed(2);
        document.getElementById('football-balance-amount').textContent = newBalance.toFixed(2);

        if (data.won) {
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('success');
          }
          if (window.tg) {
            window.tg.showAlert(`⚽ Гол! +${data.win_amount.toFixed(2)}$`);
          }
        } else {
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('error');
          }
        }
      } else {
        if (window.tg) {
          window.tg.showAlert('❌ ' + (data.error || 'Ошибка'));
        }
      }
      playBtn.disabled = false;
      playBtn.textContent = originalText;
    });
  } catch (error) {
    emoji.classList.remove('spinning');
    playBtn.disabled = false;
    playBtn.textContent = originalText;
    if (window.tg) {
      window.tg.showAlert('❌ Ошибка: ' + error.message);
    }
    console.error('Football game error:', error);
  }
}

// ========== BASKETBALL GAME FROM CARD ==========
async function playBasketballFromCard(mode, multiplier) {
  if (!window.currentUser) {
    if (window.tg) {
      window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
    }
    return;
  }

  const betInput = document.querySelector(`input[data-mode="basketball-${mode}"]`);
  const betAmount = parseFloat(betInput.value);

  if (isNaN(betAmount) || betAmount <= 0) {
    if (window.tg) {
      window.tg.showAlert('Введите корректную ставку!');
    }
    return;
  }

  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('heavy');
  }

  const card = betInput.closest('.dice-mode-card-full');
  const playBtn = card.querySelector('.dice-play-btn');
  const emoji = card.querySelector('.dice-emoji-small');

  playBtn.disabled = true;
  const originalText = playBtn.textContent;
  playBtn.textContent = 'Бросаем...';
  emoji.classList.add('spinning');

  try {
    const endpoint = mode === 'goal' ? '/api/games/basketball/goal' : '/api/games/basketball/miss';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: window.currentUser.id,
        bet_amount: betAmount
      })
    });

    const data = await response.json();

    playTelegramStyleDiceAnimation(data.result, emoji, () => {
      if (data.success) {
        const newBalance = parseFloat(data.new_balance || data.balance || 0);
        document.getElementById('balance').textContent = newBalance.toFixed(2);
        document.getElementById('basketball-balance-amount').textContent = newBalance.toFixed(2);

        if (data.won) {
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('success');
          }
          if (window.tg) {
            window.tg.showAlert(`🏀 Попал! +${data.win_amount.toFixed(2)}$`);
          }
        } else {
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('error');
          }
        }
      } else {
        if (window.tg) {
          window.tg.showAlert('❌ ' + (data.error || 'Ошибка'));
        }
      }
      playBtn.disabled = false;
      playBtn.textContent = originalText;
    });
  } catch (error) {
    emoji.classList.remove('spinning');
    playBtn.disabled = false;
    playBtn.textContent = originalText;
    if (window.tg) {
      window.tg.showAlert('❌ Ошибка: ' + error.message);
    }
    console.error('Basketball game error:', error);
  }
}

// ========== DARTS GAME FROM CARD ==========
async function playDartsFromCard(mode, multiplier) {
  if (!window.currentUser) {
    if (window.tg) {
      window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
    }
    return;
  }

  const betInput = document.querySelector(`input[data-mode="darts-${mode}"]`);
  const betAmount = parseFloat(betInput.value);

  if (isNaN(betAmount) || betAmount <= 0) {
    if (window.tg) {
      window.tg.showAlert('Введите корректную ставку!');
    }
    return;
  }

  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('heavy');
  }

  const card = betInput.closest('.dice-mode-card-full');
  const playBtn = card.querySelector('.dice-play-btn');
  const emoji = card.querySelector('.dice-emoji-small');

  playBtn.disabled = true;
  const originalText = playBtn.textContent;
  playBtn.textContent = 'Бросаем...';
  emoji.classList.add('spinning');

  try {
    let endpoint = '';
    if (mode === 'red') endpoint = '/api/games/darts/red';
    else if (mode === 'white') endpoint = '/api/games/darts/white';
    else if (mode === 'center') endpoint = '/api/games/darts/center';
    else if (mode === 'miss') endpoint = '/api/games/darts/miss';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: window.currentUser.id,
        bet_amount: betAmount
      })
    });

    const data = await response.json();

    playTelegramStyleDiceAnimation(data.result, emoji, () => {
      if (data.success) {
        const newBalance = parseFloat(data.new_balance || data.balance || 0);
        document.getElementById('balance').textContent = newBalance.toFixed(2);
        document.getElementById('darts-balance-amount').textContent = newBalance.toFixed(2);

        if (data.won) {
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('success');
          }
          if (window.tg) {
            window.tg.showAlert(`🎯 Попал! +${data.win_amount.toFixed(2)}$`);
          }
        } else {
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('error');
          }
        }
      } else {
        if (window.tg) {
          window.tg.showAlert('❌ ' + (data.error || 'Ошибка'));
        }
      }
      playBtn.disabled = false;
      playBtn.textContent = originalText;
    });
  } catch (error) {
    emoji.classList.remove('spinning');
    playBtn.disabled = false;
    playBtn.textContent = originalText;
    if (window.tg) {
      window.tg.showAlert('❌ Ошибка: ' + error.message);
    }
    console.error('Darts game error:', error);
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

// ========== BOWLING GAME ==========

// Open Bowling Game
function openBowlingGame() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }

  // Update bowling screen balance and avatar
  if (window.currentUser) {
    const balance = document.getElementById('balance').textContent || '0.00';
    document.getElementById('bowling-balance-amount').textContent = balance;

    const mainAvatar = document.getElementById('avatar');
    const bowlingAvatar = document.getElementById('bowling-avatar');

    if (mainAvatar.querySelector('img')) {
      bowlingAvatar.innerHTML = mainAvatar.innerHTML;
    } else {
      bowlingAvatar.textContent = mainAvatar.textContent;
    }
  }

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('bowling-game-screen').classList.add('active');
}

// Open Bowling Play Screen
function openBowlingPlayScreen(mode, modeLabel, multiplier) {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }

  // Store selected game mode
  window.selectedBowlingMode = mode;
  window.selectedBowlingMultiplier = multiplier;

  // Update play screen title
  const modeTitle = document.getElementById('bowling-play-mode-title');
  modeTitle.textContent = `🎳 ${modeLabel} (x${multiplier})`;

  // Update balance and avatar
  if (window.currentUser) {
    const balance = document.getElementById('balance').textContent || '0.00';
    document.getElementById('bowling-play-balance-amount').textContent = balance;

    const mainAvatar = document.getElementById('avatar');
    const playAvatar = document.getElementById('bowling-play-avatar');

    if (mainAvatar.querySelector('img')) {
      playAvatar.innerHTML = mainAvatar.innerHTML;
    } else {
      playAvatar.textContent = mainAvatar.textContent;
    }
  }

  // Reset bowling emoji
  document.getElementById('bowling-emoji').textContent = '🎳';

  // Open play screen
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('bowling-play-screen').classList.add('active');
}

// Back to bowling modes
function backToBowlingModes() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('light');
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('bowling-game-screen').classList.add('active');
}

// Play bowling game
async function playBowlingGame() {
  if (!window.currentUser) {
    if (window.tg) {
      window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
    }
    return;
  }

  if (!window.selectedBowlingMode) {
    if (window.tg) {
      window.tg.showAlert('Ошибка: режим не выбран');
    }
    return;
  }

  const betAmount = parseFloat(document.getElementById('bowling-bet-input').value);
  if (isNaN(betAmount) || betAmount <= 0) {
    if (window.tg) {
      window.tg.showAlert('Введите корректную ставку!');
    }
    return;
  }

  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('heavy');
  }

  const playBtn = document.getElementById('play-bowling-btn');
  const bowlingEmoji = document.getElementById('bowling-emoji');

  // Disable button and add spinning animation
  playBtn.disabled = true;
  playBtn.textContent = 'Бросаем...';
  bowlingEmoji.classList.add('spinning');

  try {
    let endpoint = '';
    const body = {
      user_id: window.currentUser.id,
      bet_amount: betAmount
    };

    if (window.selectedBowlingMode === 'strike') {
      endpoint = '/api/games/bowling/strike';
    } else if (window.selectedBowlingMode === 'duel') {
      endpoint = '/api/games/bowling/duel';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    setTimeout(() => {
      bowlingEmoji.classList.remove('spinning');

      if (data.success) {
        // Show result with appropriate emoji
        if (window.selectedBowlingMode === 'strike') {
          const pins = data.details?.pins || data.result;
          bowlingEmoji.textContent = pins === 6 ? '🎉' : '🎳';
        } else {
          bowlingEmoji.textContent = '🎳';
        }

        // Update balance
        if (data.newBalance !== undefined) {
          document.getElementById('balance').textContent = data.newBalance.toFixed(2);
          document.getElementById('bowling-balance-amount').textContent = data.newBalance.toFixed(2);
          document.getElementById('bowling-play-balance-amount').textContent = data.newBalance.toFixed(2);
        }

        // Show result
        if (data.isWin) {
          // Win - show confetti and congratulations
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('success');
          }

          launchBowlingConfetti();

          let resultMsg = `🎉 Поздравляем! Вы выиграли ${data.winAmount.toFixed(2)} USDT!`;
          if (window.selectedBowlingMode === 'duel') {
            resultMsg += `\n\nВаш результат: ${data.details?.userPins || ''} кеглей\nКазино: ${data.details?.casinoPins || ''} кеглей`;
          } else if (window.selectedBowlingMode === 'strike') {
            resultMsg += `\n\n🎳 Страйк! Сбито все 6 кеглей!`;
          }

          if (window.tg) {
            window.tg.showAlert(resultMsg);
          }

          // Add to wins history
          addBowlingWinToHistory(data.winAmount, data.multiplier);
        } else {
          // Loss
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
    bowlingEmoji.classList.remove('spinning');
    playBtn.disabled = false;
    playBtn.textContent = 'ИГРАТЬ';

    if (window.tg) {
      window.tg.showAlert('❌ Ошибка: ' + error.message);
    }
    console.error('Bowling game error:', error);
  }
}

// Add win to bowling history
function addBowlingWinToHistory(amount, multiplier) {
  const winsList = document.getElementById('bowling-wins-list');

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

// Bowling confetti animation
function launchBowlingConfetti() {
  const canvas = document.getElementById('bowling-confetti-canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const particleCount = 150;
  const colors = ['#FFD700', '#FFA500', '#FF6347', '#4169E1', '#32CD32', '#FF69B4'];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 4 + 2,
      d: Math.random() * particleCount,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 10,
      tiltAngleIncremental: Math.random() * 0.07 + 0.05,
      tiltAngle: 0
    });
  }

  let animationFrame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p, i) => {
      ctx.beginPath();
      ctx.lineWidth = p.r / 2;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
      ctx.stroke();

      p.tiltAngle += p.tiltAngleIncremental;
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
      p.x += Math.sin(p.d);
      p.tilt = Math.sin(p.tiltAngle - i / 3) * 15;

      if (p.y > canvas.height) {
        particles.splice(i, 1);
      }
    });

    if (particles.length > 0) {
      animationFrame = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  draw();

  setTimeout(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 5000);
}

// ========== FOOTBALL GAME ==========

// Open Football Game
function openFootballGame() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }

  // Update football screen balance and avatar
  if (window.currentUser) {
    const balance = document.getElementById('balance').textContent || '0.00';
    document.getElementById('football-balance-amount').textContent = balance;

    const mainAvatar = document.getElementById('avatar');
    const footballAvatar = document.getElementById('football-avatar');

    if (mainAvatar.querySelector('img')) {
      footballAvatar.innerHTML = mainAvatar.innerHTML;
    } else {
      footballAvatar.textContent = mainAvatar.textContent;
    }
  }

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('football-game-screen').classList.add('active');
}

// Open Football Play Screen
function openFootballPlayScreen(mode, modeLabel, multiplier) {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }

  // Store selected game mode
  window.selectedFootballMode = mode;
  window.selectedFootballMultiplier = multiplier;

  // Update play screen title
  const modeTitle = document.getElementById('football-play-mode-title');
  modeTitle.textContent = `⚽ ${modeLabel} (x${multiplier})`;

  // Update balance and avatar
  if (window.currentUser) {
    const balance = document.getElementById('balance').textContent || '0.00';
    document.getElementById('football-play-balance-amount').textContent = balance;

    const mainAvatar = document.getElementById('avatar');
    const playAvatar = document.getElementById('football-play-avatar');

    if (mainAvatar.querySelector('img')) {
      playAvatar.innerHTML = mainAvatar.innerHTML;
    } else {
      playAvatar.textContent = mainAvatar.textContent;
    }
  }

  // Reset football emoji
  document.getElementById('football-emoji').textContent = '⚽';

  // Open play screen
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('football-play-screen').classList.add('active');
}

// Back to football modes
function backToFootballModes() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('light');
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('football-game-screen').classList.add('active');
}

// Play football game
async function playFootballGame() {
  if (!window.currentUser) {
    if (window.tg) {
      window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
    }
    return;
  }

  if (!window.selectedFootballMode) {
    if (window.tg) {
      window.tg.showAlert('Ошибка: режим не выбран');
    }
    return;
  }

  const betAmount = parseFloat(document.getElementById('football-bet-input').value);
  if (isNaN(betAmount) || betAmount <= 0) {
    if (window.tg) {
      window.tg.showAlert('Введите корректную ставку!');
    }
    return;
  }

  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('heavy');
  }

  const playBtn = document.getElementById('play-football-btn');
  const footballEmoji = document.getElementById('football-emoji');

  // Disable button and add spinning animation
  playBtn.disabled = true;
  playBtn.textContent = 'Бьём...';
  footballEmoji.classList.add('spinning');

  try {
    let endpoint = '';
    const body = {
      user_id: window.currentUser.id,
      bet_amount: betAmount
    };

    if (window.selectedFootballMode === 'goal') {
      endpoint = '/api/games/football/goal';
    } else if (window.selectedFootballMode === 'miss') {
      endpoint = '/api/games/football/miss';
    } else if (window.selectedFootballMode === 'duel') {
      endpoint = '/api/games/football/duel';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    setTimeout(() => {
      footballEmoji.classList.remove('spinning');

      if (data.success) {
        // Show result with appropriate emoji/text
        const resultNum = typeof data.result === 'number' ? data.result : parseInt(data.result);
        if (resultNum >= 4) {
          footballEmoji.textContent = '⚽🥅'; // Goal
        } else if (resultNum === 3) {
          footballEmoji.textContent = '🥅'; // Post
        } else {
          footballEmoji.textContent = '❌'; // Miss
        }

        // Update balance
        if (data.newBalance !== undefined) {
          document.getElementById('balance').textContent = data.newBalance.toFixed(2);
          document.getElementById('football-balance-amount').textContent = data.newBalance.toFixed(2);
          document.getElementById('football-play-balance-amount').textContent = data.newBalance.toFixed(2);
        }

        // Show result
        if (data.isWin) {
          // Win - show confetti and congratulations
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('success');
          }

          launchFootballConfetti();

          let resultMsg = `🎉 Поздравляем! Вы выиграли ${data.winAmount.toFixed(2)} USDT!`;
          if (window.selectedFootballMode === 'duel') {
            resultMsg += `\n\nВаш удар: ${data.details?.userKick || ''}\nКазино: ${data.details?.casinoKick || ''}`;
          } else if (window.selectedFootballMode === 'goal') {
            resultMsg += `\n\n⚽ ГОЛ!`;
          } else if (window.selectedFootballMode === 'miss') {
            resultMsg += `\n\n❌ Мимо!`;
          }

          if (window.tg) {
            window.tg.showAlert(resultMsg);
          }

          // Add to wins history
          addFootballWinToHistory(data.winAmount, data.multiplier);
        } else {
          // Loss
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
    footballEmoji.classList.remove('spinning');
    playBtn.disabled = false;
    playBtn.textContent = 'ИГРАТЬ';

    if (window.tg) {
      window.tg.showAlert('❌ Ошибка: ' + error.message);
    }
    console.error('Football game error:', error);
  }
}

// Add win to football history
function addFootballWinToHistory(amount, multiplier) {
  const winsList = document.getElementById('football-wins-list');

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

// Football confetti animation
function launchFootballConfetti() {
  const canvas = document.getElementById('football-confetti-canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const particleCount = 150;
  const colors = ['#FFD700', '#FFA500', '#FF6347', '#4169E1', '#32CD32', '#FF69B4'];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 4 + 2,
      d: Math.random() * particleCount,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 10,
      tiltAngleIncremental: Math.random() * 0.07 + 0.05,
      tiltAngle: 0
    });
  }

  let animationFrame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p, i) => {
      ctx.beginPath();
      ctx.lineWidth = p.r / 2;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
      ctx.stroke();

      p.tiltAngle += p.tiltAngleIncremental;
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
      p.x += Math.sin(p.d);
      p.tilt = Math.sin(p.tiltAngle - i / 3) * 15;

      if (p.y > canvas.height) {
        particles.splice(i, 1);
      }
    });

    if (particles.length > 0) {
      animationFrame = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  draw();

  setTimeout(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 5000);
}

// ========== BASKETBALL GAME ==========

// Open Basketball Game
function openBasketballGame() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }

  // Update basketball screen balance and avatar
  if (window.currentUser) {
    const balance = document.getElementById('balance').textContent || '0.00';
    document.getElementById('basketball-balance-amount').textContent = balance;

    const mainAvatar = document.getElementById('avatar');
    const basketballAvatar = document.getElementById('basketball-avatar');

    if (mainAvatar.querySelector('img')) {
      basketballAvatar.innerHTML = mainAvatar.innerHTML;
    } else {
      basketballAvatar.textContent = mainAvatar.textContent;
    }
  }

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('basketball-game-screen').classList.add('active');
}

// Open Basketball Play Screen
function openBasketballPlayScreen(mode, modeLabel, multiplier) {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }

  // Store selected game mode
  window.selectedBasketballMode = mode;
  window.selectedBasketballMultiplier = multiplier;

  // Update play screen title
  const modeTitle = document.getElementById('basketball-play-mode-title');
  modeTitle.textContent = `🏀 ${modeLabel} (x${multiplier})`;

  // Update balance and avatar
  if (window.currentUser) {
    const balance = document.getElementById('balance').textContent || '0.00';
    document.getElementById('basketball-play-balance-amount').textContent = balance;

    const mainAvatar = document.getElementById('avatar');
    const playAvatar = document.getElementById('basketball-play-avatar');

    if (mainAvatar.querySelector('img')) {
      playAvatar.innerHTML = mainAvatar.innerHTML;
    } else {
      playAvatar.textContent = mainAvatar.textContent;
    }
  }

  // Reset basketball emoji
  document.getElementById('basketball-emoji').textContent = '🏀';

  // Open play screen
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('basketball-play-screen').classList.add('active');
}

// Back to basketball modes
function backToBasketballModes() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('light');
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('basketball-game-screen').classList.add('active');
}

// Play basketball game
async function playBasketballGame() {
  if (!window.currentUser) {
    if (window.tg) {
      window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
    }
    return;
  }

  if (!window.selectedBasketballMode) {
    if (window.tg) {
      window.tg.showAlert('Ошибка: режим не выбран');
    }
    return;
  }

  const betAmount = parseFloat(document.getElementById('basketball-bet-input').value);
  if (isNaN(betAmount) || betAmount <= 0) {
    if (window.tg) {
      window.tg.showAlert('Введите корректную ставку!');
    }
    return;
  }

  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('heavy');
  }

  const playBtn = document.getElementById('play-basketball-btn');
  const basketballEmoji = document.getElementById('basketball-emoji');

  // Disable button and add spinning animation
  playBtn.disabled = true;
  playBtn.textContent = 'Бросаем...';
  basketballEmoji.classList.add('spinning');

  try {
    let endpoint = '';
    const body = {
      user_id: window.currentUser.id,
      bet_amount: betAmount
    };

    if (window.selectedBasketballMode === 'goal') {
      endpoint = '/api/games/basketball/goal';
    } else if (window.selectedBasketballMode === 'miss') {
      endpoint = '/api/games/basketball/miss';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    setTimeout(() => {
      basketballEmoji.classList.remove('spinning');

      if (data.success) {
        // Show result with appropriate emoji
        const resultNum = typeof data.result === 'number' ? data.result : parseInt(data.result);
        if (resultNum >= 4) {
          basketballEmoji.textContent = '🏀✨'; // Made it
        } else {
          basketballEmoji.textContent = '❌'; // Miss
        }

        // Update balance
        if (data.newBalance !== undefined) {
          document.getElementById('balance').textContent = data.newBalance.toFixed(2);
          document.getElementById('basketball-balance-amount').textContent = data.newBalance.toFixed(2);
          document.getElementById('basketball-play-balance-amount').textContent = data.newBalance.toFixed(2);
        }

        // Show result
        if (data.isWin) {
          // Win - show confetti and congratulations
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('success');
          }

          launchBasketballConfetti();

          let resultMsg = `🎉 Поздравляем! Вы выиграли ${data.winAmount.toFixed(2)} USDT!`;
          if (window.selectedBasketballMode === 'goal') {
            resultMsg += `\n\n🏀 Попал!`;
          } else if (window.selectedBasketballMode === 'miss') {
            resultMsg += `\n\n❌ Промах!`;
          }

          if (window.tg) {
            window.tg.showAlert(resultMsg);
          }

          // Add to wins history
          addBasketballWinToHistory(data.winAmount, data.multiplier);
        } else {
          // Loss
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
    basketballEmoji.classList.remove('spinning');
    playBtn.disabled = false;
    playBtn.textContent = 'ИГРАТЬ';

    if (window.tg) {
      window.tg.showAlert('❌ Ошибка: ' + error.message);
    }
    console.error('Basketball game error:', error);
  }
}

// Add win to basketball history
function addBasketballWinToHistory(amount, multiplier) {
  const winsList = document.getElementById('basketball-wins-list');

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

// Basketball confetti animation
function launchBasketballConfetti() {
  const canvas = document.getElementById('basketball-confetti-canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const particleCount = 150;
  const colors = ['#FFD700', '#FFA500', '#FF6347', '#4169E1', '#32CD32', '#FF69B4'];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 4 + 2,
      d: Math.random() * particleCount,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 10,
      tiltAngleIncremental: Math.random() * 0.07 + 0.05,
      tiltAngle: 0
    });
  }

  let animationFrame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p, i) => {
      ctx.beginPath();
      ctx.lineWidth = p.r / 2;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
      ctx.stroke();

      p.tiltAngle += p.tiltAngleIncremental;
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
      p.x += Math.sin(p.d);
      p.tilt = Math.sin(p.tiltAngle - i / 3) * 15;

      if (p.y > canvas.height) {
        particles.splice(i, 1);
      }
    });

    if (particles.length > 0) {
      animationFrame = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  draw();

  setTimeout(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 5000);
}

// ========== DARTS GAME ==========

// Open Darts Game
function openDartsGame() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }

  // Update darts screen balance and avatar
  if (window.currentUser) {
    const balance = document.getElementById('balance').textContent || '0.00';
    document.getElementById('darts-balance-amount').textContent = balance;

    const mainAvatar = document.getElementById('avatar');
    const dartsAvatar = document.getElementById('darts-avatar');

    if (mainAvatar.querySelector('img')) {
      dartsAvatar.innerHTML = mainAvatar.innerHTML;
    } else {
      dartsAvatar.textContent = mainAvatar.textContent;
    }
  }

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('darts-game-screen').classList.add('active');
}

// Open Darts Play Screen
function openDartsPlayScreen(mode, modeLabel, multiplier) {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }

  // Store selected game mode
  window.selectedDartsMode = mode;
  window.selectedDartsMultiplier = multiplier;

  // Update play screen title
  const modeTitle = document.getElementById('darts-play-mode-title');
  modeTitle.textContent = `🎯 ${modeLabel} (x${multiplier})`;

  // Update balance and avatar
  if (window.currentUser) {
    const balance = document.getElementById('balance').textContent || '0.00';
    document.getElementById('darts-play-balance-amount').textContent = balance;

    const mainAvatar = document.getElementById('avatar');
    const playAvatar = document.getElementById('darts-play-avatar');

    if (mainAvatar.querySelector('img')) {
      playAvatar.innerHTML = mainAvatar.innerHTML;
    } else {
      playAvatar.textContent = mainAvatar.textContent;
    }
  }

  // Reset darts emoji
  document.getElementById('darts-emoji').textContent = '🎯';

  // Open play screen
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('darts-play-screen').classList.add('active');
}

// Back to darts modes
function backToDartsModes() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('light');
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('darts-game-screen').classList.add('active');
}

// Play darts game
async function playDartsGame() {
  if (!window.currentUser) {
    if (window.tg) {
      window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
    }
    return;
  }

  if (!window.selectedDartsMode) {
    if (window.tg) {
      window.tg.showAlert('Ошибка: режим не выбран');
    }
    return;
  }

  const betAmount = parseFloat(document.getElementById('darts-bet-input').value);
  if (isNaN(betAmount) || betAmount <= 0) {
    if (window.tg) {
      window.tg.showAlert('Введите корректную ставку!');
    }
    return;
  }

  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('heavy');
  }

  const playBtn = document.getElementById('play-darts-btn');
  const dartsEmoji = document.getElementById('darts-emoji');

  // Disable button and add spinning animation
  playBtn.disabled = true;
  playBtn.textContent = 'Бросаем...';
  dartsEmoji.classList.add('spinning');

  try {
    let endpoint = '';
    const body = {
      user_id: window.currentUser.id,
      bet_amount: betAmount
    };

    if (window.selectedDartsMode === 'red') {
      endpoint = '/api/games/darts/red';
    } else if (window.selectedDartsMode === 'white') {
      endpoint = '/api/games/darts/white';
    } else if (window.selectedDartsMode === 'center') {
      endpoint = '/api/games/darts/center';
    } else if (window.selectedDartsMode === 'miss') {
      endpoint = '/api/games/darts/miss';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    setTimeout(() => {
      dartsEmoji.classList.remove('spinning');

      if (data.success) {
        // Show result with appropriate emoji
        const resultNum = typeof data.result === 'number' ? data.result : parseInt(data.result);
        if (resultNum === 6) {
          dartsEmoji.textContent = '🎯🔴'; // Center/Red
        } else if (resultNum >= 2 && resultNum <= 5) {
          dartsEmoji.textContent = '🎯⚪'; // White
        } else {
          dartsEmoji.textContent = '❌'; // Miss
        }

        // Update balance
        if (data.newBalance !== undefined) {
          document.getElementById('balance').textContent = data.newBalance.toFixed(2);
          document.getElementById('darts-balance-amount').textContent = data.newBalance.toFixed(2);
          document.getElementById('darts-play-balance-amount').textContent = data.newBalance.toFixed(2);
        }

        // Show result
        if (data.isWin) {
          // Win - show confetti and congratulations
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('success');
          }

          launchDartsConfetti();

          let resultMsg = `🎉 Поздравляем! Вы выиграли ${data.winAmount.toFixed(2)} USDT!`;
          if (window.selectedDartsMode === 'red' || window.selectedDartsMode === 'center') {
            resultMsg += `\n\n🎯 В центр!`;
          } else if (window.selectedDartsMode === 'white') {
            resultMsg += `\n\n⚪ В белое!`;
          } else if (window.selectedDartsMode === 'miss') {
            resultMsg += `\n\n❌ Мимо!`;
          }

          if (window.tg) {
            window.tg.showAlert(resultMsg);
          }

          // Add to wins history
          addDartsWinToHistory(data.winAmount, data.multiplier);
        } else {
          // Loss
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
    dartsEmoji.classList.remove('spinning');
    playBtn.disabled = false;
    playBtn.textContent = 'ИГРАТЬ';

    if (window.tg) {
      window.tg.showAlert('❌ Ошибка: ' + error.message);
    }
    console.error('Darts game error:', error);
  }
}

// Add win to darts history
function addDartsWinToHistory(amount, multiplier) {
  const winsList = document.getElementById('darts-wins-list');

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

// Darts confetti animation
function launchDartsConfetti() {
  const canvas = document.getElementById('darts-confetti-canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const particleCount = 150;
  const colors = ['#FFD700', '#FFA500', '#FF6347', '#4169E1', '#32CD32', '#FF69B4'];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 4 + 2,
      d: Math.random() * particleCount,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 10,
      tiltAngleIncremental: Math.random() * 0.07 + 0.05,
      tiltAngle: 0
    });
  }

  let animationFrame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p, i) => {
      ctx.beginPath();
      ctx.lineWidth = p.r / 2;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
      ctx.stroke();

      p.tiltAngle += p.tiltAngleIncremental;
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
      p.x += Math.sin(p.d);
      p.tilt = Math.sin(p.tiltAngle - i / 3) * 15;

      if (p.y > canvas.height) {
        particles.splice(i, 1);
      }
    });

    if (particles.length > 0) {
      animationFrame = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  draw();

  setTimeout(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 5000);
}

// ========== SLOTS GAME ==========

// Open Slots Game
function openSlotsGame() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }

  // Update slots screen balance and avatar
  if (window.currentUser) {
    const balance = document.getElementById('balance').textContent || '0.00';
    document.getElementById('slots-balance-amount').textContent = balance;

    const mainAvatar = document.getElementById('avatar');
    const slotsAvatar = document.getElementById('slots-avatar');

    if (mainAvatar.querySelector('img')) {
      slotsAvatar.innerHTML = mainAvatar.innerHTML;
    } else {
      slotsAvatar.textContent = mainAvatar.textContent;
    }
  }

  // Reset slots
  document.getElementById('slot-1').textContent = '🍋';
  document.getElementById('slot-2').textContent = '🍇';
  document.getElementById('slot-3').textContent = '🍋';

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('slots-game-screen').classList.add('active');
}

// Play slots game
async function playSlotsGame() {
  if (!window.currentUser) {
    if (window.tg) {
      window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
    }
    return;
  }

  const betAmount = parseFloat(document.getElementById('slots-bet-input').value);
  if (isNaN(betAmount) || betAmount <= 0) {
    if (window.tg) {
      window.tg.showAlert('Введите корректную ставку!');
    }
    return;
  }

  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('heavy');
  }

  const playBtn = document.getElementById('play-slots-btn');
  const slot1 = document.getElementById('slot-1');
  const slot2 = document.getElementById('slot-2');
  const slot3 = document.getElementById('slot-3');

  // Disable button
  playBtn.disabled = true;
  playBtn.textContent = 'Крутим...';

  // Spinning animation
  const symbols = ['🍋', '🍇', 'BAR', '7️⃣'];
  let spinCount = 0;
  const spinInterval = setInterval(() => {
    slot1.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    slot2.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    slot3.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    spinCount++;
    if (spinCount > 15) {
      clearInterval(spinInterval);
    }
  }, 100);

  try {
    const response = await fetch('/api/games/slots/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: window.currentUser.id,
        bet_amount: betAmount
      })
    });

    const data = await response.json();

    setTimeout(() => {
      if (data.success) {
        // Show result
        slot1.textContent = data.result[0];
        slot2.textContent = data.result[1];
        slot3.textContent = data.result[2];

        // Update balance
        if (data.newBalance !== undefined) {
          document.getElementById('balance').textContent = data.newBalance.toFixed(2);
          document.getElementById('slots-balance-amount').textContent = data.newBalance.toFixed(2);
        }

        // Show result
        if (data.win) {
          // Win - show confetti and congratulations
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('success');
          }

          launchSlotsConfetti();

          const resultMsg = `🎉 Поздравляем! Вы выиграли ${data.winAmount.toFixed(2)} USDT!\n\n${data.result[0]} ${data.result[1]} ${data.result[2]}\nx${data.multiplier}`;

          if (window.tg) {
            window.tg.showAlert(resultMsg);
          }

          // Add to wins history
          addSlotsWinToHistory(data.winAmount, data.multiplier);
        } else {
          // Loss
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
      playBtn.textContent = 'КРУТИТЬ';
    }, 2000);
  } catch (error) {
    clearInterval(spinInterval);
    playBtn.disabled = false;
    playBtn.textContent = 'КРУТИТЬ';

    if (window.tg) {
      window.tg.showAlert('❌ Ошибка: ' + error.message);
    }
    console.error('Slots game error:', error);
  }
}

// Add win to slots history
function addSlotsWinToHistory(amount, multiplier) {
  const winsList = document.getElementById('slots-wins-list');

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

// Slots confetti animation
function launchSlotsConfetti() {
  const canvas = document.getElementById('slots-confetti-canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const particleCount = 150;
  const colors = ['#FFD700', '#FFA500', '#FF6347', '#4169E1', '#32CD32', '#FF69B4'];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 4 + 2,
      d: Math.random() * particleCount,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 10,
      tiltAngleIncremental: Math.random() * 0.07 + 0.05,
      tiltAngle: 0
    });
  }

  let animationFrame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p, i) => {
      ctx.beginPath();
      ctx.lineWidth = p.r / 2;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
      ctx.stroke();

      p.tiltAngle += p.tiltAngleIncremental;
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
      p.x += Math.sin(p.d);
      p.tilt = Math.sin(p.tiltAngle - i / 3) * 15;

      if (p.y > canvas.height) {
        particles.splice(i, 1);
      }
    });

    if (particles.length > 0) {
      animationFrame = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  draw();

  setTimeout(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 5000);
}

// ========== RPS GAME ==========

// Open RPS Game
function openRPSGame() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }

  // Update rps screen balance and avatar
  if (window.currentUser) {
    const balance = document.getElementById('balance').textContent || '0.00';
    document.getElementById('rps-balance-amount').textContent = balance;

    const mainAvatar = document.getElementById('avatar');
    const rpsAvatar = document.getElementById('rps-avatar');

    if (mainAvatar.querySelector('img')) {
      rpsAvatar.innerHTML = mainAvatar.innerHTML;
    } else {
      rpsAvatar.textContent = mainAvatar.textContent;
    }
  }

  // Reset choices
  window.selectedRPSChoice = null;
  document.getElementById('rps-user-choice').textContent = '❓';
  document.getElementById('rps-bot-choice').textContent = '❓';

  // Reset button states
  document.querySelectorAll('[id^="rps-btn-"]').forEach(btn => {
    btn.style.opacity = '1';
    btn.style.border = '1px solid var(--glass-border)';
  });

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('rps-game-screen').classList.add('active');
}

// Select RPS choice
function selectRPSChoice(choice) {
  window.selectedRPSChoice = choice;

  // Update UI
  const choiceEmojis = { rock: '🪨', paper: '📄', scissors: '✂️' };
  document.getElementById('rps-user-choice').textContent = choiceEmojis[choice];

  // Highlight selected button
  document.querySelectorAll('[id^="rps-btn-"]').forEach(btn => {
    btn.style.opacity = '0.5';
    btn.style.border = '1px solid var(--glass-border)';
  });
  document.getElementById(`rps-btn-${choice}`).style.opacity = '1';
  document.getElementById(`rps-btn-${choice}`).style.border = '2px solid var(--gold)';

  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('light');
  }
}

// Play RPS game
async function playRPSGame() {
  if (!window.currentUser) {
    if (window.tg) {
      window.tg.showAlert('Пожалуйста, подождите, загружаем данные...');
    }
    return;
  }

  if (!window.selectedRPSChoice) {
    if (window.tg) {
      window.tg.showAlert('Выберите: камень, бумагу или ножницы!');
    }
    return;
  }

  const betAmount = parseFloat(document.getElementById('rps-bet-input').value);
  if (isNaN(betAmount) || betAmount <= 0) {
    if (window.tg) {
      window.tg.showAlert('Введите корректную ставку!');
    }
    return;
  }

  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('heavy');
  }

  const playBtn = document.getElementById('play-rps-btn');
  const botChoiceEl = document.getElementById('rps-bot-choice');

  // Disable button
  playBtn.disabled = true;
  playBtn.textContent = 'Играем...';

  // Animate bot choice
  const choiceEmojis = { rock: '🪨', paper: '📄', scissors: '✂️' };
  let animCount = 0;
  const animInterval = setInterval(() => {
    const randomChoice = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
    botChoiceEl.textContent = choiceEmojis[randomChoice];
    animCount++;
    if (animCount > 10) {
      clearInterval(animInterval);
    }
  }, 100);

  try {
    const response = await fetch('/api/games/rps/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: window.currentUser.id,
        bet_amount: betAmount,
        choice: window.selectedRPSChoice
      })
    });

    const data = await response.json();

    setTimeout(() => {
      if (data.success) {
        // Show bot choice
        botChoiceEl.textContent = choiceEmojis[data.botChoice];

        // Update balance
        if (data.newBalance !== undefined) {
          document.getElementById('balance').textContent = data.newBalance.toFixed(2);
          document.getElementById('rps-balance-amount').textContent = data.newBalance.toFixed(2);
        }

        // Show result
        if (data.win) {
          // Win
          if (window.tg && window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('success');
          }

          launchRPSConfetti();

          const resultMsg = `🎉 Поздравляем! Вы выиграли ${data.winAmount.toFixed(2)} USDT!\n\nВы: ${choiceEmojis[data.userChoice]}\nБот: ${choiceEmojis[data.botChoice]}`;

          if (window.tg) {
            window.tg.showAlert(resultMsg);
          }

          // Add to wins history
          addRPSWinToHistory(data.winAmount, 2.76);
        } else if (data.draw) {
          // Draw
          if (window.tg) {
            window.tg.showAlert(`Ничья! Ставка возвращена.\n\nВы: ${choiceEmojis[data.userChoice]}\nБот: ${choiceEmojis[data.botChoice]}`);
          }
        } else {
          // Loss
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
    clearInterval(animInterval);
    playBtn.disabled = false;
    playBtn.textContent = 'ИГРАТЬ';

    if (window.tg) {
      window.tg.showAlert('❌ Ошибка: ' + error.message);
    }
    console.error('RPS game error:', error);
  }
}

// Add win to RPS history
function addRPSWinToHistory(amount, multiplier) {
  const winsList = document.getElementById('rps-wins-list');

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

// RPS confetti animation
function launchRPSConfetti() {
  const canvas = document.getElementById('rps-confetti-canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const particleCount = 150;
  const colors = ['#FFD700', '#FFA500', '#FF6347', '#4169E1', '#32CD32', '#FF69B4'];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 4 + 2,
      d: Math.random() * particleCount,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 10,
      tiltAngleIncremental: Math.random() * 0.07 + 0.05,
      tiltAngle: 0
    });
  }

  let animationFrame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p, i) => {
      ctx.beginPath();
      ctx.lineWidth = p.r / 2;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
      ctx.stroke();

      p.tiltAngle += p.tiltAngleIncremental;
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
      p.x += Math.sin(p.d);
      p.tilt = Math.sin(p.tiltAngle - i / 3) * 15;

      if (p.y > canvas.height) {
        particles.splice(i, 1);
      }
    });

    if (particles.length > 0) {
      animationFrame = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  draw();

  setTimeout(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 5000);
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
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.classList.remove('active');
    const buttonText = tab.textContent.toLowerCase();
    if ((section === 'stats' && buttonText.includes('статистика')) ||
        (section === 'users' && buttonText.includes('юзеры')) ||
        (section === 'control' && buttonText.includes('контроль')) ||
        (section === 'broadcast' && buttonText.includes('рассылки')) ||
        (section === 'settings' && buttonText.includes('настройки'))) {
      tab.classList.add('active');
    }
  });

  // Update sections
  document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(`admin-${section}-section`).classList.add('active');

  // Load data for section
  if (section === 'stats') {
    loadAdminStats();
  } else if (section === 'broadcast') {
    loadBroadcasts();
  } else if (section === 'control') {
    loadProfitStats();
  } else if (section === 'settings') {
    loadDuelSettings();
  }
}

// Load admin statistics
async function loadAdminStats() {
  if (!window.currentUser) {
    console.error('❌ loadAdminStats: Пользователь не загружен');
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
    console.error('❌ Ошибка загрузки статистики:', error);
  }
}

// Load user info
async function loadUserInfo() {
  const userId = document.getElementById('user-id-input').value;

  console.log('🔍 loadUserInfo вызван, userId:', userId);
  console.log('👤 window.currentUser:', window.currentUser);

  if (!userId) {
    if (window.tg) {
      window.tg.showAlert('Введите ID пользователя');
    } else {
      alert('Введите ID пользователя');
    }
    return;
  }

  if (!window.currentUser) {
    console.error('❌ window.currentUser не загружен!');
    if (window.tg) {
      window.tg.showAlert('Ошибка: пользователь не загружен');
    } else {
      alert('Ошибка: пользователь не загружен');
    }
    return;
  }

  try {
    const url = `/api/admin/user/${userId}?admin_id=${window.currentUser.id}`;
    console.log('📡 Отправка запроса:', url);

    const response = await fetch(url);
    console.log('📥 Получен ответ, status:', response.status);

    const data = await response.json();
    console.log('📦 Данные ответа:', data);

    if (data.success) {
      window.currentUserForEdit = data.user;

      // Show user info block
      document.getElementById('user-info-block').style.display = 'block';

      // Fill basic data
      document.getElementById('user-info-id').textContent = data.user.id;
      document.getElementById('user-info-telegram-id').textContent = data.user.telegram_id || '-';
      document.getElementById('user-info-name').textContent = data.user.first_name + (data.user.last_name ? ' ' + data.user.last_name : '');
      document.getElementById('user-info-username').textContent = data.user.username ? '@' + data.user.username : '-';
      document.getElementById('user-info-balance').textContent = (data.balance || 0).toFixed(2) + ' USDT';
      document.getElementById('user-info-blocked').textContent = data.user.is_blocked ? '🚫 Заблокирован' : '✅ Активен';

      // Format dates
      if (data.user.created_at) {
        const createdDate = new Date(data.user.created_at);
        document.getElementById('user-info-created').textContent = createdDate.toLocaleDateString('ru-RU') + ' ' + createdDate.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
      } else {
        document.getElementById('user-info-created').textContent = '-';
      }

      if (data.user.last_active) {
        const lastActiveDate = new Date(data.user.last_active);
        document.getElementById('user-info-last-active').textContent = lastActiveDate.toLocaleDateString('ru-RU') + ' ' + lastActiveDate.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
      } else {
        document.getElementById('user-info-last-active').textContent = '-';
      }

      // Fill game stats
      const gamesCount = data.stats?.games_count || 0;
      const winsCount = data.stats?.wins_count || 0;
      const totalBets = data.stats?.total_bets || 0;
      const totalWins = data.stats?.total_wins || 0;
      const profit = totalWins - totalBets;

      document.getElementById('user-info-games-count').textContent = gamesCount;
      document.getElementById('user-info-wins-count').textContent = winsCount;
      document.getElementById('user-info-total-bets').textContent = totalBets.toFixed(2) + ' USDT';
      document.getElementById('user-info-total-wins').textContent = totalWins.toFixed(2) + ' USDT';

      const profitEl = document.getElementById('user-info-profit');
      profitEl.textContent = (profit >= 0 ? '+' : '') + profit.toFixed(2) + ' USDT';
      profitEl.style.color = profit >= 0 ? 'var(--emerald)' : 'var(--error)';

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
      const errorMsg = data.error || 'Пользователь не найден';
      console.error('❌ Ошибка от API:', errorMsg);
      if (window.tg) {
        window.tg.showAlert('❌ ' + errorMsg);
      } else {
        alert('❌ ' + errorMsg);
      }
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки пользователя:', error);
    if (window.tg) {
      window.tg.showAlert('❌ Ошибка загрузки: ' + error.message);
    } else {
      alert('❌ Ошибка загрузки: ' + error.message);
    }
  }
}

// Edit user balance
async function editUserBalance(operation) {
  console.log('💰 editUserBalance вызван, operation:', operation);

  if (!window.currentUserForEdit) {
    console.error('❌ window.currentUserForEdit не загружен');
    window.tg.showAlert('Сначала загрузите пользователя');
    return;
  }

  if (!window.currentUser) {
    console.error('❌ window.currentUser не загружен');
    window.tg.showAlert('Ошибка: пользователь не загружен');
    return;
  }

  const amount = parseFloat(document.getElementById('balance-amount-input').value);
  console.log('💵 Сумма:', amount);

  if (isNaN(amount) || amount <= 0) {
    console.error('❌ Некорректная сумма:', amount);
    window.tg.showAlert('Введите корректную сумму');
    return;
  }

  try {
    const payload = {
      admin_id: window.currentUser.id,
      operation,
      amount
    };
    console.log('📤 Отправка запроса edit-balance:', payload);

    const response = await fetch(`/api/admin/user/${window.currentUserForEdit.id}/edit-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('📥 Ответ получен, status:', response.status);
    const data = await response.json();
    console.log('📦 Данные ответа:', data);

    if (data.success) {
      // Update balance display
      document.getElementById('user-info-balance').textContent = (data.newBalance || 0).toFixed(2) + ' USDT';
      document.getElementById('balance-amount-input').value = '';

      window.tg.showAlert('✅ Баланс обновлен!');

      if (window.tg && window.tg.HapticFeedback) {
        window.tg.HapticFeedback.notificationOccurred('success');
      }
    } else {
      const errorMsg = data.error || 'Ошибка';
      console.error('❌ Ошибка от API:', errorMsg);
      window.tg.showAlert('❌ ' + errorMsg);
    }
  } catch (error) {
    console.error('❌ Ошибка изменения баланса:', error);
    window.tg.showAlert('❌ Ошибка: ' + error.message);
  }
}

// Toggle block user
async function toggleBlockUser() {
  console.log('🚫 toggleBlockUser вызван');

  if (!window.currentUserForEdit) {
    console.error('❌ window.currentUserForEdit не загружен');
    window.tg.showAlert('Сначала загрузите пользователя');
    return;
  }

  if (!window.currentUser) {
    console.error('❌ window.currentUser не загружен');
    window.tg.showAlert('Ошибка: пользователь не загружен');
    return;
  }

  const isCurrentlyBlocked = window.currentUserForEdit.is_blocked;
  console.log('📊 Текущий статус блокировки:', isCurrentlyBlocked);

  try {
    const payload = {
      admin_id: window.currentUser.id,
      is_blocked: !isCurrentlyBlocked
    };
    console.log('📤 Отправка запроса block:', payload);

    const response = await fetch(`/api/admin/user/${window.currentUserForEdit.id}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('📥 Ответ получен, status:', response.status);
    const data = await response.json();
    console.log('📦 Данные ответа:', data);

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
      const errorMsg = data.error || 'Ошибка';
      console.error('❌ Ошибка от API:', errorMsg);
      window.tg.showAlert('❌ ' + errorMsg);
    }
  } catch (error) {
    console.error('❌ Ошибка блокировки:', error);
    window.tg.showAlert('❌ Ошибка: ' + error.message);
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

// Load duel settings
async function loadDuelSettings() {
  if (!window.currentUser) return;

  try {
    const response = await fetch('/api/admin/duel-settings?admin_id=' + window.currentUser.id);
    const data = await response.json();

    if (data.success) {
      document.getElementById('duel-commission-rate').value = data.commission_rate || 9;
      document.getElementById('duel-guaranteed-win-user-id').value = data.guaranteed_win_user_id || 0;
    }
  } catch (error) {
    console.error('Error loading duel settings:', error);
  }
}

// Save duel settings
async function saveDuelSettings() {
  if (!window.currentUser) {
    window.tg.showAlert('Ошибка: пользователь не загружен');
    return;
  }

  const commissionRate = parseFloat(document.getElementById('duel-commission-rate').value);
  const guaranteedWinUserId = parseInt(document.getElementById('duel-guaranteed-win-user-id').value) || 0;

  if (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 50) {
    window.tg.showAlert('❌ Комиссия должна быть от 0 до 50%');
    return;
  }

  try {
    await fetch('/api/admin/duel-settings/commission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: window.currentUser.id, commission_rate: commissionRate })
    });

    await fetch('/api/admin/duel-settings/guaranteed-win', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: window.currentUser.id, user_id: guaranteedWinUserId })
    });

    window.tg.showAlert('✅ Настройки дуэлей сохранены!');

    if (window.tg && window.tg.HapticFeedback) {
      window.tg.HapticFeedback.notificationOccurred('success');
    }
  } catch (error) {
    console.error('Error saving duel settings:', error);
    window.tg.showAlert('❌ Ошибка сохранения');
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

// ========== GAME CONTROL FUNCTIONS ==========

// Toggle force results
function toggleForceResults() {
  const enabled = document.getElementById('force-results-enabled').checked;
  const settingsDiv = document.getElementById('force-settings');

  if (enabled) {
    settingsDiv.style.display = 'block';
    if (window.tg && window.tg.HapticFeedback) {
      window.tg.HapticFeedback.notificationOccurred('success');
    }
  } else {
    settingsDiv.style.display = 'none';
    if (window.tg && window.tg.HapticFeedback) {
      window.tg.HapticFeedback.notificationOccurred('warning');
    }
  }
}

// Update force loss display
function updateForceLossDisplay(value) {
  document.getElementById('force-loss-display').textContent = value;
}

// Save force settings
async function saveForceSettings() {
  if (!window.currentUser || !window.isAdmin) {
    if (window.tg) {
      window.tg.showAlert('❌ Нет прав администратора');
    }
    return;
  }

  const enabled = document.getElementById('force-results-enabled').checked;
  const lossRate = document.getElementById('force-loss-rate').value;

  const games = {
    dice: document.getElementById('force-dice').checked,
    bowling: document.getElementById('force-bowling').checked,
    football: document.getElementById('force-football').checked,
    basketball: document.getElementById('force-basketball').checked,
    darts: document.getElementById('force-darts').checked,
    slots: document.getElementById('force-slots').checked,
    rps: document.getElementById('force-rps').checked
  };

  try {
    // Save to settings
    await fetch('/api/admin/settings/force_results_enabled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin_id: window.currentUser.id,
        value: enabled ? '1' : '0'
      })
    });

    await fetch('/api/admin/settings/force_loss_rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin_id: window.currentUser.id,
        value: lossRate
      })
    });

    await fetch('/api/admin/settings/force_games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin_id: window.currentUser.id,
        value: JSON.stringify(games)
      })
    });

    if (window.tg) {
      window.tg.showAlert(`✅ Настройки сохранены!\n\nФорсирование: ${enabled ? 'Включено' : 'Выключено'}\nПроцент проигрышей: ${lossRate}%`);
    }

    if (window.tg && window.tg.HapticFeedback) {
      window.tg.HapticFeedback.notificationOccurred('success');
    }
  } catch (error) {
    console.error('Error saving force settings:', error);
    if (window.tg) {
      window.tg.showAlert('❌ Ошибка сохранения настроек');
    }
  }
}

// Load profit stats
async function loadProfitStats() {
  if (!window.currentUser || !window.isAdmin) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/stats/detailed?admin_id=${window.currentUser.id}`);
    const data = await response.json();

    if (data.success) {
      // Calculate profit
      const totalBets = data.stats.total_game_revenue || 0;
      const totalWins = data.stats.total_game_payouts || 0;
      const profit = totalBets - totalWins;

      document.getElementById('profit-bets-today').textContent = `${totalBets.toFixed(2)} USDT`;
      document.getElementById('profit-wins-today').textContent = `${totalWins.toFixed(2)} USDT`;
      document.getElementById('profit-total-today').textContent = `${profit.toFixed(2)} USDT`;
      document.getElementById('profit-total-today').style.color = profit >= 0 ? 'var(--emerald)' : 'var(--accent-red)';
    }
  } catch (error) {
    console.error('Error loading profit stats:', error);
  }
}

// ============================================
// FULLSCREEN GAME OVERLAY
// ============================================

// Состояние fullscreen overlay
window.fullscreenState = {
  game: null,
  mode: null,
  title: null,
  multiplier: null,
  selectedChoice: null,
  lottieAnimation: null
};

// Конфигурация режимов игры
const gameModeConfig = {
  dice: {
    'higher-lower': {
      choices: [
        { value: 'higher', label: 'Больше 3', coef: 'x1.89' },
        { value: 'lower', label: 'Меньше 4', coef: 'x1.89' }
      ],
      layout: 'list'
    },
    'even-odd': {
      choices: [
        { value: 'even', label: 'Четное', coef: 'x1.9' },
        { value: 'odd', label: 'Нечетное', coef: 'x1.9' }
      ],
      layout: 'list'
    },
    'exact': {
      choices: [
        { value: 1, label: '1', coef: 'x5.5' },
        { value: 2, label: '2', coef: 'x5.5' },
        { value: 3, label: '3', coef: 'x5.5' },
        { value: 4, label: '4', coef: 'x5.5' },
        { value: 5, label: '5', coef: 'x5.5' },
        { value: 6, label: '6', coef: 'x5.5' }
      ],
      layout: 'grid'
    },
    '2x2': {
      choices: [
        { value: 'higher', label: 'Больше 2X', coef: 'x3.68' },
        { value: 'lower', label: 'Меньше 2X', coef: 'x3.68' }
      ],
      layout: 'list'
    },
    '3x3': {
      choices: [
        { value: 'higher', label: 'Больше 3X', coef: 'x5.52' },
        { value: 'lower', label: 'Меньше 3X', coef: 'x5.52' }
      ],
      layout: 'list'
    },
    'sector': {
      choices: [
        { value: 1, label: '1-2', coef: 'x2.76' },
        { value: 2, label: '3-4', coef: 'x2.76' },
        { value: 3, label: '5-6', coef: 'x2.76' }
      ],
      layout: 'grid'
    },
    'sequence': {
      choices: [], // Нет выбора для sequence
      layout: 'none',
      description: 'Угадай 3 числа подряд'
    },
    'duel': {
      choices: [], // Нет выбора для duel
      layout: 'none',
      description: 'Дуэль кубиков с казино'
    }
  },
  darts: {
    'red': {
      choices: [],
      layout: 'none',
      description: 'Попади в центр (результат 6)'
    },
    'white': {
      choices: [],
      layout: 'none',
      description: 'Попади в белое (результат 2-5)'
    },
    'center': {
      choices: [],
      layout: 'none',
      description: 'Попади в середину (результат 6)'
    },
    'miss': {
      choices: [],
      layout: 'none',
      description: 'Промахнись (результат 1)'
    }
  }
};

// Lottie анимации URLs (локальные файлы из TGS)
const lottieAnimations = {
  dice: {
    default: '/animations/Rectangular_4.json', // Для показа перед броском
    faces: [
      null, // индекс 0 не используется
      '/animations/Rectangular_1.json', // грань 1
      '/animations/Rectangular_2.json', // грань 2
      '/animations/Rectangular_3.json', // грань 3
      '/animations/Rectangular_4.json', // грань 4
      '/animations/Rectangular_5.json', // грань 5
      '/animations/Rectangular_6.json'  // грань 6
    ]
  },
  bowling: '/animations/bowling.json',
  football: '/animations/football.json',
  basketball: '/animations/basketball.json',
  darts: {
    default: '/animations/darts-v4-5.json', // Для показа перед броском (белый)
    results: [
      null, // индекс 0 не используется
      '/animations/darts-v4-miss 2.json', // результат 1 - мимо
      '/animations/darts-v4-miss 2.json', // результат 2 - белое (мимо 2)
      '/animations/darts-v4-5.json',      // результат 3 - белое
      '/animations/darts-v4-4.json',      // результат 4 - красный
      '/animations/darts-v4-5.json',      // результат 5 - белый
      '/animations/centr.json'            // результат 6 - центр
    ]
  }
};

// Открыть fullscreen режим
function openFullscreenMode(game, mode, title, multiplier) {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('medium');
  }

  // Сохранить состояние
  window.fullscreenState.game = game;
  window.fullscreenState.mode = mode;
  window.fullscreenState.title = title;
  window.fullscreenState.multiplier = multiplier;
  window.fullscreenState.selectedChoice = null;

  // Установить заголовок и multiplier
  document.getElementById('fullscreen-title').textContent = title;
  document.getElementById('fullscreen-multiplier').textContent = `x${multiplier}`;

  // Получить конфигурацию режима
  const config = gameModeConfig[game][mode];

  // Создать кнопки выбора
  const choicesContainer = document.getElementById('fullscreen-choices');
  choicesContainer.innerHTML = '';

  if (config.layout === 'list') {
    choicesContainer.classList.remove('grid');
    config.choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'fullscreen-choice-btn';
      btn.onclick = () => selectFullscreenChoice(choice.value);
      btn.innerHTML = `
        <span class="fullscreen-choice-btn-label">${choice.label}</span>
        <span class="fullscreen-choice-btn-coef">${choice.coef}</span>
      `;
      choicesContainer.appendChild(btn);
    });
  } else if (config.layout === 'grid') {
    choicesContainer.classList.add('grid');
    config.choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'fullscreen-choice-btn';
      btn.onclick = () => selectFullscreenChoice(choice.value);
      btn.textContent = choice.label;
      choicesContainer.appendChild(btn);
    });
  } else if (config.layout === 'none') {
    // Показать описание если есть
    if (config.description) {
      const desc = document.createElement('div');
      desc.style.textAlign = 'center';
      desc.style.fontSize = '16px';
      desc.style.color = 'var(--text-secondary)';
      desc.style.marginBottom = '20px';
      desc.textContent = config.description;
      choicesContainer.appendChild(desc);
    }
  }

  // Инициализировать Lottie анимацию
  initLottieAnimation(game);

  // Показать overlay
  const overlay = document.getElementById('fullscreen-overlay');
  overlay.style.display = 'flex';
  setTimeout(() => {
    overlay.classList.add('active');
  }, 10);
}

// Закрыть fullscreen режим
function closeFullscreenMode() {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('light');
  }

  const overlay = document.getElementById('fullscreen-overlay');
  overlay.classList.remove('active');

  setTimeout(() => {
    overlay.style.display = 'none';

    // Очистить Lottie анимацию
    if (window.fullscreenState.lottieAnimation) {
      window.fullscreenState.lottieAnimation.destroy();
      window.fullscreenState.lottieAnimation = null;
    }

    // Сбросить состояние
    window.fullscreenState = {
      game: null,
      mode: null,
      title: null,
      multiplier: null,
      selectedChoice: null,
      lottieAnimation: null
    };
  }, 300);
}

// Выбрать опцию
function selectFullscreenChoice(value) {
  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('light');
  }

  window.fullscreenState.selectedChoice = value;

  // Обновить визуально активную кнопку
  const buttons = document.querySelectorAll('.fullscreen-choice-btn');
  buttons.forEach((btn, index) => {
    btn.classList.remove('active');
  });

  // Найти и активировать выбранную кнопку
  const config = gameModeConfig[window.fullscreenState.game][window.fullscreenState.mode];
  const choiceIndex = config.choices.findIndex(c => c.value === value);
  if (choiceIndex !== -1 && buttons[choiceIndex]) {
    buttons[choiceIndex].classList.add('active');
  }
}

// Начать игру из fullscreen
async function playFromFullscreen() {
  const { game, mode, multiplier, selectedChoice } = window.fullscreenState;
  const betAmount = parseFloat(document.getElementById('fullscreen-bet-input').value);

  // Валидация
  if (!betAmount || betAmount <= 0) {
    if (window.tg) {
      window.tg.showAlert('Введите корректную ставку!');
    } else {
      alert('Введите корректную ставку!');
    }
    return;
  }

  // Проверка выбора (если требуется)
  const config = gameModeConfig[game][mode];
  if (config.layout !== 'none' && !selectedChoice) {
    if (window.tg) {
      window.tg.showAlert('Выберите вариант!');
    } else {
      alert('Выберите вариант!');
    }
    return;
  }

  if (window.tg && window.tg.HapticFeedback) {
    window.tg.HapticFeedback.impactOccurred('heavy');
  }

  // Отключить кнопку
  const playBtn = document.getElementById('fullscreen-play-btn');
  playBtn.disabled = true;
  playBtn.textContent = 'ИГРАЕМ...';

  try {
    // Маппинг режимов на API endpoints
    let endpoint;
    if (game === 'dice') {
      const apiEndpoints = {
        'higher-lower': '/api/games/dice/higher-lower',
        'even-odd': '/api/games/dice/even-odd',
        'exact': '/api/games/dice/exact-number',
        '2x2': '/api/games/dice/double',
        '3x3': '/api/games/dice/triple',
        'sector': '/api/games/dice/sector',
        'sequence': '/api/games/dice/sequence',
        'duel': '/api/games/dice/duel'
      };
      endpoint = apiEndpoints[mode];
    } else if (game === 'darts') {
      const apiEndpoints = {
        'red': '/api/games/darts/red',
        'white': '/api/games/darts/white',
        'center': '/api/games/darts/center',
        'miss': '/api/games/darts/miss'
      };
      endpoint = apiEndpoints[mode];
    }

    if (!endpoint) {
      throw new Error('Неизвестный режим игры');
    }

    // Подготовить данные запроса
    const requestBody = {
      user_id: window.currentUser.id,
      bet_amount: betAmount
    };

    // Добавить choice если нужно
    if (selectedChoice !== null && selectedChoice !== undefined) {
      requestBody.choice = selectedChoice;
    }

    console.log('🎲 Запрос к API:', endpoint, requestBody);

    // Вызов API
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    console.log('📥 Результат от API:', data);

    if (!data.success) {
      throw new Error(data.error || 'Ошибка при игре');
    }

    // Получили результат - показываем анимацию с этим числом
    const diceResult = data.result; // 1-6 для кубика
    console.log('🎯 Выпало число:', diceResult);

    // Показать результат в анимации
    await showDiceResult(diceResult, data.isWin);

    // Обновить баланс
    if (data.newBalance !== undefined) {
      document.getElementById('balance').textContent = data.newBalance.toFixed(2);
    }

    // Закрыть overlay
    setTimeout(() => {
      closeFullscreenMode();

      // Показать результат
      const resultMessage = data.isWin
        ? `🎉 ВЫИГРЫШ!\n\n🎲 Выпало: ${diceResult}\n💰 Выигрыш: ${data.winAmount.toFixed(2)} USDT\n💵 Баланс: ${data.newBalance.toFixed(2)} USDT`
        : `😔 ПРОИГРЫШ\n\n🎲 Выпало: ${diceResult}\n💸 Проиграно: ${betAmount.toFixed(2)} USDT\n💵 Баланс: ${data.newBalance.toFixed(2)} USDT`;

      if (window.tg) {
        window.tg.showAlert(resultMessage);
      } else {
        alert(resultMessage);
      }
    }, 1000);

  } catch (error) {
    console.error('❌ Ошибка при игре:', error);

    // Остановить анимацию
    if (window.fullscreenState.lottieAnimation) {
      window.fullscreenState.lottieAnimation.stop();
    }

    if (window.tg) {
      window.tg.showAlert('❌ Ошибка: ' + (error.message || 'Не удалось сыграть'));
    } else {
      alert('Ошибка: ' + (error.message || 'Не удалось сыграть'));
    }
  } finally {
    playBtn.disabled = false;
    playBtn.textContent = 'ИГРАТЬ';
  }
}

// Показать результат кубика в анимации
async function showDiceResult(result, isWin) {
  return new Promise((resolve) => {
    const container = document.getElementById('fullscreen-lottie');

    // Уничтожаем текущую анимацию
    if (window.fullscreenState.lottieAnimation) {
      window.fullscreenState.lottieAnimation.destroy();
      window.fullscreenState.lottieAnimation = null;
    }

    // Загружаем анимацию нужной грани/результата
    const game = window.fullscreenState.game;
    const animationConfig = lottieAnimations[game];

    // Поддержка как faces (для dice), так и results (для darts и других)
    const animationArray = animationConfig?.faces || animationConfig?.results;
    if (animationConfig && animationArray && animationArray[result]) {
      const faceAnimationUrl = animationArray[result];
      console.log(`🎬 Загружаем анимацию результата ${result}: ${faceAnimationUrl}`);

      // Очистить контейнер
      container.innerHTML = '';

      // Загрузить и показать анимацию нужной грани
      if (typeof lottie !== 'undefined') {
        const anim = lottie.loadAnimation({
          container: container,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: faceAnimationUrl
        });

        window.fullscreenState.lottieAnimation = anim;

        // Добавляем эффект (увеличение для выигрыша)
        if (isWin) {
          container.style.transform = 'scale(1.2)';
          container.style.transition = 'transform 0.3s ease';
          setTimeout(() => {
            container.style.transform = 'scale(1)';
          }, 300);
        }

        console.log(`✅ Анимация грани ${result} загружена и запущена`);
        setTimeout(resolve, 2000);
      } else {
        // Fallback если lottie не загружен
        showDiceFallback(result, container);
        setTimeout(resolve, 1500);
      }
    } else {
      // Fallback - показываем эмодзи с числом
      showDiceFallback(result, container);
      setTimeout(resolve, 1500);
    }
  });
}

// Fallback отображение кубика эмодзи
function showDiceFallback(result, container) {
  const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  container.innerHTML = `<div style="font-size: 120px; animation: bounce 0.5s ease;">${diceEmojis[result] || '🎲'}</div>`;
  console.log(`📦 Fallback: показываем эмодзи для грани ${result}`);
}

// Инициализировать Lottie анимацию
function initLottieAnimation(game) {
  const container = document.getElementById('fullscreen-lottie');
  container.innerHTML = ''; // Очистить контейнер

  // Уничтожить предыдущую анимацию если есть
  if (window.fullscreenState.lottieAnimation) {
    window.fullscreenState.lottieAnimation.destroy();
  }

  // Получить URL анимации
  const animationConfig = lottieAnimations[game];
  let animationUrl;

  // Для кубиков используем анимацию по умолчанию (крутящийся кубик)
  if (animationConfig && animationConfig.default) {
    animationUrl = animationConfig.default;
  } else if (typeof animationConfig === 'string') {
    animationUrl = animationConfig;
  }

  if (animationUrl && typeof lottie !== 'undefined') {
    console.log(`🎬 Загружаем начальную анимацию: ${animationUrl}`);
    window.fullscreenState.lottieAnimation = lottie.loadAnimation({
      container: container,
      renderer: 'svg',
      loop: false, // Прокручивается 1 раз при входе
      autoplay: true,
      path: animationUrl
    });
  } else {
    // Fallback - показать эмодзи
    container.innerHTML = '<div style="font-size: 120px;">🎲</div>';
  }
}

// ============================================
// USER STATS FUNCTIONS
// ============================================

// Load user statistics
async function loadUserStats() {
  if (!window.currentUser) {
    console.error('❌ Cannot load stats: currentUser not loaded');
    return;
  }

  try {
    console.log('📊 Loading user stats...');
    const response = await fetch(`/api/user/${window.currentUser.id}/stats`);
    const data = await response.json();

    if (data.success) {
      console.log('✅ User stats loaded:', data);

      // Days with bot
      const daysText = data.daysWithBot === 1
        ? 'Ты с Jokery уже 1 день'
        : `Ты с Jokery уже ${data.daysWithBot} ${getDaysWord(data.daysWithBot)}`;
      document.getElementById('days-with-bot').textContent = daysText;

      // Top game
      const topGame = data.stats.favorite_game_name
        ? `${data.stats.favorite_game_name} [${data.stats.total_games}]`
        : '-';
      document.getElementById('top-game').textContent = topGame;

      // Total games
      document.getElementById('total-games').textContent = data.stats.total_games || 0;

      // Total bets
      document.getElementById('total-bets').textContent = (data.stats.total_bet_amount || 0).toFixed(2) + '$';

      // Biggest win
      const biggestWin = (data.stats.biggest_win || 0).toFixed(2) + '$';
      document.getElementById('biggest-win').textContent = biggestWin;
    } else {
      console.error('Failed to load user stats:', data.error);
    }
  } catch (error) {
    console.error('Error loading user stats:', error);
  }
}

// Helper function to get correct word form for days
function getDaysWord(days) {
  const lastDigit = days % 10;
  const lastTwoDigits = days % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return 'дней';
  }

  if (lastDigit === 1) {
    return 'день';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'дня';
  }

  return 'дней';
}

// ============================================
// REFERRAL FUNCTIONS
// ============================================

// Load referral stats
async function loadReferralStats() {
  if (!window.currentUser) {
    console.error('❌ Cannot load referrals: currentUser not loaded');
    return;
  }

  try {
    console.log('👥 Loading referral stats...');
    const response = await fetch(`/api/referrals/${window.currentUser.id}`);
    const data = await response.json();

    if (data.success) {
      console.log('✅ Referral stats loaded:', data);

      // Update referral link
      document.getElementById('referral-link').textContent = data.referralLink;

      // Update stats
      document.getElementById('referral-count').textContent = data.stats.total_referrals || 0;
      document.getElementById('referral-earned').textContent = (data.stats.total_earned || 0).toFixed(2);

      // Update referrals list
      const listElement = document.getElementById('referrals-list');
      if (data.stats.referrals && data.stats.referrals.length > 0) {
        let html = '';
        data.stats.referrals.forEach(ref => {
          html += `
            <div class="stat-row" style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <div>
                <div style="font-weight: 500;">${ref.first_name}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                  ${ref.username ? '@' + ref.username : 'ID: ' + ref.user_id}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="color: var(--emerald); font-weight: 500;">${ref.total_deposited.toFixed(2)}$</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                  ${new Date(ref.created_at).toLocaleDateString('ru-RU')}
                </div>
              </div>
            </div>
          `;
        });
        listElement.innerHTML = html;
      } else {
        listElement.innerHTML = `
          <div style="text-align: center; color: var(--text-secondary); padding: 20px 0;">
            Пока никого не пригласил
          </div>
        `;
      }
    } else {
      console.error('Failed to load referral stats:', data.error);
    }
  } catch (error) {
    console.error('Error loading referral stats:', error);
  }
}

// Copy referral link to clipboard
function copyReferralLink() {
  const link = document.getElementById('referral-link').textContent;

  if (link && link !== 'Загрузка...') {
    // Try to copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        if (window.tg) {
          window.tg.showAlert('✅ Ссылка скопирована!');
          if (window.tg.HapticFeedback) {
            window.tg.HapticFeedback.notificationOccurred('success');
          }
        } else {
          alert('✅ Ссылка скопирована!');
        }
      }).catch(err => {
        console.error('Failed to copy:', err);
        if (window.tg) {
          window.tg.showAlert('❌ Не удалось скопировать');
        }
      });
    } else {
      // Fallback for older browsers
      if (window.tg) {
        window.tg.showAlert('Ссылка: ' + link);
      } else {
        alert('Ссылка: ' + link);
      }
    }
  }
}

// Share referral link
function shareReferralLink() {
  const link = document.getElementById('referral-link').textContent;

  if (link && link !== 'Загрузка...') {
    const text = `🎰 Присоединяйся к Jokery Casino!\n\n💰 Играй и выигрывай реальные деньги\n🎁 Бонусы для новых игроков\n\n${link}`;

    if (window.tg && window.tg.openTelegramLink) {
      // Open Telegram share dialog
      window.tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('🎰 Присоединяйся к Jokery Casino!')}`);
    } else {
      // Fallback - copy to clipboard
      copyReferralLink();
    }
  }
}

// ========================================
// DICE DUELS (PVP) FUNCTIONS
// ========================================

// Открыть экран дуэлей
async function openDuelScreen() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('dice-duel-screen').classList.add('active');

  const balance = parseFloat(document.getElementById('balance').textContent);
  document.getElementById('dice-duel-balance-amount').textContent = balance.toFixed(2);

  const avatar = document.getElementById('avatar').textContent;
  document.getElementById('dice-duel-avatar').textContent = avatar;

  await loadDuelsList();

  if (window.duelsInterval) {
    clearInterval(window.duelsInterval);
  }
  window.duelsInterval = setInterval(loadDuelsList, 3000);
}

// Загрузить список дуэлей
async function loadDuelsList() {
  try {
    const response = await fetch('/api/games/dice/duel/list');
    const data = await response.json();

    const duelsList = document.getElementById('duels-list');

    if (!data.success || !data.duels || data.duels.length === 0) {
      duelsList.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px 20px;">Нет активных дуэлей. Создайте первую! 🎲</div>';
      return;
    }

    duelsList.innerHTML = data.duels.map(duel => {
      const createdDate = new Date(duel.created_at);
      const timeAgo = getTimeAgo(createdDate);
      const isOwnDuel = duel.creator_id === window.currentUser.id;

      return '<div class="duel-card"><div class="duel-card-header"><div class="duel-creator-name">' +
        duel.creator_name +
        (isOwnDuel ? ' <span style="color: var(--emerald); font-size: 12px;">(Ваша)</span>' : '') +
        '</div><div class="duel-bet-amount">' + duel.bet_amount.toFixed(2) + ' USDT</div></div>' +
        '<div class="duel-card-footer"><div class="duel-time">' + timeAgo + '</div>' +
        (isOwnDuel
          ? '<button class="btn secondary" onclick="cancelDuel(' + duel.id + ')" style="margin: 0; padding: 8px 16px; font-size: 13px;">Отменить</button>'
          : '<button class="duel-join-btn" onclick="joinDuel(' + duel.id + ', ' + duel.bet_amount + ')">Присоединиться ⚔️</button>') +
        '</div></div>';
    }).join('');
  } catch (error) {
    console.error('Error loading duels:', error);
    document.getElementById('duels-list').innerHTML = '<div style="text-align: center; color: #EF4444; padding: 40px 20px;">Ошибка загрузки дуэлей</div>';
  }
}

// Создать дуэль
async function createDuel() {
  try {
    const betInput = document.getElementById('duel-bet-input');
    const betAmount = parseFloat(betInput.value);

    if (!betAmount || betAmount < 1) {
      window.tg.showAlert('Минимальная ставка 1 USDT');
      return;
    }

    const balance = parseFloat(document.getElementById('balance').textContent);
    if (betAmount > balance) {
      window.tg.showAlert('Недостаточно средств');
      return;
    }

    const response = await fetch('/api/games/dice/duel/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: window.currentUser.id, bet_amount: betAmount })
    });

    const data = await response.json();

    if (data.success) {
      betInput.value = '';
      await loadUserInfo();
      const newBalance = parseFloat(document.getElementById('balance').textContent);
      document.getElementById('dice-duel-balance-amount').textContent = newBalance.toFixed(2);
      await loadDuelsList();
      window.tg.showAlert('Дуэль создана! Ожидайте противника...');
    } else {
      window.tg.showAlert(data.error || 'Ошибка создания дуэли');
    }
  } catch (error) {
    console.error('Error creating duel:', error);
    window.tg.showAlert('Ошибка создания дуэли');
  }
}

// Присоединиться к дуэли
async function joinDuel(duelId, betAmount) {
  try {
    const balance = parseFloat(document.getElementById('balance').textContent);
    if (betAmount > balance) {
      window.tg.showAlert('Недостаточно средств');
      return;
    }

    const response = await fetch('/api/games/dice/duel/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duel_id: duelId, user_id: window.currentUser.id })
    });

    const data = await response.json();

    if (data.success) {
      if (window.duelsInterval) {
        clearInterval(window.duelsInterval);
      }
      await loadUserInfo();
      showDuelResult(data);
    } else {
      window.tg.showAlert(data.error || 'Ошибка присоединения к дуэли');
    }
  } catch (error) {
    console.error('Error joining duel:', error);
    window.tg.showAlert('Ошибка присоединения к дуэли');
  }
}

// Отменить дуэль
async function cancelDuel(duelId) {
  try {
    const response = await fetch('/api/games/dice/duel/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duel_id: duelId, user_id: window.currentUser.id })
    });

    const data = await response.json();

    if (data.success) {
      await loadUserInfo();
      const newBalance = parseFloat(document.getElementById('balance').textContent);
      document.getElementById('dice-duel-balance-amount').textContent = newBalance.toFixed(2);
      await loadDuelsList();
      window.tg.showAlert('Дуэль отменена, ставка возвращена');
    } else {
      window.tg.showAlert(data.error || 'Ошибка отмены дуэли');
    }
  } catch (error) {
    console.error('Error cancelling duel:', error);
    window.tg.showAlert('Ошибка отмены дуэли');
  }
}

// Показать результат дуэли
function showDuelResult(data) {
  const isWin = data.winnerId === window.currentUser.id;
  const isDraw = data.winnerId === 0;

  const overlay = document.createElement('div');
  overlay.className = 'duel-result-overlay';
  overlay.innerHTML = '<div class="duel-result-card"><div class="duel-result-title">' +
    (isDraw ? '🤝 Ничья!' : (isWin ? '🎉 Победа!' : '😔 Поражение')) +
    '</div><div class="duel-result-players"><div class="duel-result-player"><div class="duel-result-dice">' +
    getDiceEmoji(data.creatorRoll) + '</div><div class="duel-result-player-name">Создатель</div>' +
    '<div style="font-size: 24px; font-weight: 700; color: var(--text-primary);">' + data.creatorRoll + '</div></div>' +
    '<div class="duel-result-vs">VS</div><div class="duel-result-player"><div class="duel-result-dice">' +
    getDiceEmoji(data.opponentRoll) + '</div><div class="duel-result-player-name">Вы</div>' +
    '<div style="font-size: 24px; font-weight: 700; color: var(--text-primary);">' + data.opponentRoll + '</div></div></div>' +
    (!isDraw ? ('<div class="duel-result-winner ' + (isWin ? 'win' : 'loss') + '">' +
      (isWin ? 'Вы выиграли!' : 'Вы проиграли') + '</div>' +
      (isWin ? '<div class="duel-result-amount">+' + data.winAmount.toFixed(2) + ' USDT</div>' : ''))
    : '<div class="duel-result-winner" style="color: var(--text-secondary);">Ставки возвращены</div>') +
    '<div style="text-align: center; font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Комиссия казино: ' +
    data.commission.toFixed(2) + ' USDT</div>' +
    '<button class="duel-result-close-btn" onclick="closeDuelResult()">Закрыть</button></div>';

  document.body.appendChild(overlay);
}

// Закрыть результат дуэли
function closeDuelResult() {
  const overlay = document.querySelector('.duel-result-overlay');
  if (overlay) {
    overlay.remove();
  }
  loadDuelsList();
  if (window.duelsInterval) {
    clearInterval(window.duelsInterval);
  }
  window.duelsInterval = setInterval(loadDuelsList, 3000);
}

// Получить эмодзи кубика
function getDiceEmoji(number) {
  const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  return diceEmojis[number] || '🎲';
}

// Получить время назад
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'только что';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + ' мин назад';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + ' ч назад';
  const days = Math.floor(hours / 24);
  return days + ' д назад';
}

// Экспортировать функции в глобальную область
window.openFullscreenMode = openFullscreenMode;
window.closeFullscreenMode = closeFullscreenMode;
window.selectFullscreenChoice = selectFullscreenChoice;
window.loadUserStats = loadUserStats;
window.loadReferralStats = loadReferralStats;
window.copyReferralLink = copyReferralLink;
window.shareReferralLink = shareReferralLink;
window.playFromFullscreen = playFromFullscreen;
window.openDuelScreen = openDuelScreen;
window.createDuel = createDuel;
window.joinDuel = joinDuel;
window.cancelDuel = cancelDuel;
window.closeDuelResult = closeDuelResult;
