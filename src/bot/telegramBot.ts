import TelegramBot from "node-telegram-bot-api";
import { userService } from "../services/userService";
import { dealService } from "../services/dealService";
import { QRHelper } from "../utils/qr";
import { db } from "../db/database";
import { tronHelper } from "../utils/tron";

const WELCOME_MESSAGE = `
🤖 Добро пожаловать в P2P Гарант-Бот!

Этот бот помогает проводить безопасные сделки с использованием USDT TRC20.

🔐 **Безопасность:**
   • Все приватные ключи зашифрованы в базе данных
   • PIN-код защищает доступ к ключам
   • Для каждой сделки создается отдельный кошелек

💡 **Как работают сделки:**
   1. Продавец создает сделку (сумма + описание)
   2. Создается уникальный кошелек для сделки
   3. Покупатель переводит USDT на адрес сделки
   4. После подтверждения оплаты выдается seed-фраза кошелька

📱 Откройте Mini App для работы с ботом!
`;

export class TelegramBotService {
  private bot: TelegramBot;
  private userStates: Map<string, any> = new Map();
  private usernameToChatId: Map<string, number> = new Map();
  private telegramIdToChatId: Map<string, number> = new Map();

  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: true });
    this.setupHandlers();
  }

  private setupHandlers() {
    this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
    this.bot.onText(/\/cancel/, (msg) => this.handleCancel(msg));

    this.bot.on("message", (msg) => this.handleMessage(msg));
    this.bot.on("callback_query", (query) => this.handleCallback(query));
  }
  
  private async handleCallback(query: TelegramBot.CallbackQuery) {
    const chatId = query.message?.chat.id;
    const telegramId = query.from?.id.toString();
    const data = query.data;
    
    if (!chatId || !telegramId || !data) return;
    
    await this.bot.answerCallbackQuery(query.id);
    
    if (data === "role_seller" || data === "role_buyer") {
      const role = data === "role_seller" ? "seller" : "buyer";
      const counterpartyLabel = role === "seller" ? "покупателя" : "продавца";
      
      this.userStates.set(telegramId, { action: "create_deal_counterparty", chatId, role });
      await this.bot.sendMessage(chatId, `👤 Введите Telegram username ${counterpartyLabel} (например: @username или username):`);
    }
    
    // Handle rating callbacks: rate_1_dealId, rate_2_dealId, etc
    if (data.startsWith("rate_")) {
      const parts = data.split("_");
      if (parts.length >= 3) {
        const rating = parseInt(parts[1]);
        const dealId = parts.slice(2).join("_"); // Handle deal IDs with underscores
        
        try {
          // Get deal to determine who to rate
          const deal = await db.getDeal(dealId);
          if (!deal) {
            await this.bot.sendMessage(chatId, "❌ Сделка не найдена");
            return;
          }
          
          // Only buyer can rate seller
          const isBuyer = deal.buyer_telegram_id === telegramId;
          if (!isBuyer) {
            await this.bot.sendMessage(chatId, "❌ Только покупатель может оценивать сделку");
            return;
          }
          
          // Check if already rated
          const existingRating = await db.getRatingForDeal(dealId, telegramId);
          if (existingRating) {
            await this.bot.sendMessage(chatId, "⚠️ Вы уже оценили эту сделку");
            return;
          }
          
          // Create rating
          if (!deal.seller_telegram_id) {
            await this.bot.sendMessage(chatId, "❌ Не удалось определить продавца");
            return;
          }
          await db.createRating({
            deal_id: dealId,
            reviewer_telegram_id: telegramId,
            reviewee_telegram_id: deal.seller_telegram_id,
            score: rating,
            comment: null
          });
          
          const stars = "⭐".repeat(rating) + "☆".repeat(5 - rating);
          await this.bot.sendMessage(chatId, `✅ Спасибо за вашу оценку!\n\nВаша оценка: ${stars} (${rating}/5)`);
          
          // Delete rating message if possible
          if (query.message?.message_id) {
            try {
              await this.bot.deleteMessage(chatId, query.message.message_id);
            } catch (e) {
              // Ignore if can't delete
            }
          }
        } catch (error: any) {
          await this.bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
        }
      }
    }
    
    // Skip rating
    if (data.startsWith("skip_rating_")) {
      await this.bot.sendMessage(chatId, "👍 Хорошо, вы можете оценить сделку позже в Mini App");
      if (query.message?.message_id) {
        try {
          await this.bot.deleteMessage(chatId, query.message.message_id);
        } catch (e) {
          // Ignore
        }
      }
    }
    
    // Take arbitration
    if (data.startsWith("arb_take_")) {
      const arbitrationId = parseInt(data.replace("arb_take_", ""));
      
      try {
        const isArbitrator = await db.isArbitrator(telegramId);
        if (!isArbitrator) {
          await this.bot.sendMessage(chatId, "❌ Только арбитражники могут брать споры");
          return;
        }
        
        const arbitration = await db.getArbitration(arbitrationId);
        if (!arbitration) {
          await this.bot.sendMessage(chatId, "❌ Арбитраж не найден");
          return;
        }
        
        if (arbitration.status !== 'pending') {
          await this.bot.sendMessage(chatId, "⚠️ Этот спор уже взят другим арбитражником");
          return;
        }
        
        await db.assignArbitration(arbitrationId, telegramId);
        await this.bot.sendMessage(chatId, "✅ Вы взяли этот спор! Откройте Mini App для рассмотрения.");
        
        // Delete the notification message
        if (query.message?.message_id) {
          try {
            await this.bot.deleteMessage(chatId, query.message.message_id);
          } catch (e) {
            // Ignore
          }
        }
      } catch (error: any) {
        await this.bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
      }
    }
    
    // Buyer confirms receiving goods/services
    if (data.startsWith("confirm_received_")) {
      const dealId = data.replace("confirm_received_", "");
      
      try {
        const deal = await db.getDeal(dealId);
        if (!deal) {
          await this.bot.sendMessage(chatId, "❌ Сделка не найдена");
          return;
        }
        
        if (deal.status !== 'payment_confirmed') {
          await this.bot.sendMessage(chatId, "⚠️ Сделка не в статусе ожидания подтверждения получения");
          return;
        }
        
        const isBuyer = deal.buyer_telegram_id === telegramId;
        if (!isBuyer) {
          await this.bot.sendMessage(chatId, "❌ Только покупатель может подтвердить получение");
          return;
        }
        
        await db.updateDealStatus(dealId, 'buyer_confirmed');
        
        await this.bot.sendMessage(chatId, `✅ **Получение подтверждено!**\n\n🔖 Сделка: \`${dealId}\`\n\nПродавец теперь может получить оплату (seed-фразу).`, { parse_mode: "Markdown" });
        
        // Delete the button message
        if (query.message?.message_id) {
          try {
            await this.bot.deleteMessage(chatId, query.message.message_id);
          } catch (e) {
            // Ignore
          }
        }
        
        // Notify seller
        await this.notifyBuyerConfirmedReceived(deal);
      } catch (error: any) {
        await this.bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
      }
    }
    
    // Buyer marks payment as sent (I paid)
    if (data.startsWith("i_paid_")) {
      const dealId = data.replace("i_paid_", "");
      
      try {
        const deal = await db.getDeal(dealId);
        if (!deal) {
          await this.bot.sendMessage(chatId, "❌ Сделка не найдена");
          return;
        }
        
        if (deal.status !== 'awaiting_payment') {
          await this.bot.sendMessage(chatId, "⚠️ Сделка не в статусе ожидания оплаты");
          return;
        }
        
        const isBuyer = deal.buyer_telegram_id === telegramId;
        if (!isBuyer) {
          await this.bot.sendMessage(chatId, "❌ Только покупатель может нажать эту кнопку");
          return;
        }
        
        await this.bot.sendMessage(chatId, "⏳ Проверяем баланс кошелька сделки...");
        
        // Check balance using TronScan API
        const balance = await tronHelper.getUSDTBalance(deal.deal_wallet_address);
        
        if (balance >= deal.amount) {
          await db.updateDealStatus(dealId, 'payment_confirmed');
          
          await this.bot.sendMessage(chatId, `✅ **Оплата подтверждена!**\n\n🔖 Сделка: \`${dealId}\`\n💵 Получено: ${balance} USDT\n\nТеперь подтвердите получение товара/услуги.`, { 
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "✅ Подтвердить получение", callback_data: `confirm_received_${dealId}` }]
              ]
            }
          });
          
          // Delete I paid button
          if (query.message?.message_id) {
            try {
              await this.bot.deleteMessage(chatId, query.message.message_id);
            } catch (e) {
              // Ignore
            }
          }
          
          // Notify seller
          await this.notifyPaymentConfirmed(deal, balance);
        } else {
          await this.bot.sendMessage(chatId, `⚠️ **Баланс недостаточный**\n\n💰 На кошельке: ${balance} USDT\n💵 Требуется: ${deal.amount} USDT\n\nПереведите средства и попробуйте снова.`, { parse_mode: "Markdown" });
        }
      } catch (error: any) {
        await this.bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
      }
    }
  }

  private async handleStart(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();
    const username = msg.from?.username || msg.from?.first_name || "user";
    const baseUrl = process.env.WEB_APP_URL || 
      (process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'http://localhost:5000');
    
    if (!telegramId) {
      await this.bot.sendMessage(chatId, "❌ Ошибка получения ID пользователя");
      return;
    }

    if (msg.from?.username) {
      this.usernameToChatId.set(msg.from.username, chatId);
    }
    this.telegramIdToChatId.set(telegramId, chatId);

    // Передаём данные через URL как fallback для iOS где initData часто пустой
    const webAppUrl = `${baseUrl}?tgId=${telegramId}&tgUsername=${encodeURIComponent(username)}`;

    await this.bot.sendMessage(chatId, WELCOME_MESSAGE, {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "🚀 Открыть Mini App", web_app: { url: webAppUrl } }]
        ],
        resize_keyboard: true,
      },
    });
  }


  private async handleWallet(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();
    const username = msg.from?.username || msg.from?.first_name || "user";

    if (!telegramId) return;

    try {
      const existingUser = await userService.checkUserExists(telegramId);
      
      if (!existingUser) {
        this.userStates.set(telegramId, { action: "register_pin_for_wallet", chatId, username });
        await this.bot.sendMessage(
          chatId,
          "🔐 Для просмотра кошелька необходимо создать PIN-код из 4 цифр:"
        );
        return;
      }

      const wallet = await userService.getUserWallet(telegramId);
      const qrCode = await QRHelper.generateAddressQR(wallet.address);

      await this.bot.sendPhoto(chatId, Buffer.from(qrCode.split(",")[1], "base64"), {
        caption: `
💼 **Ваш кошелек:**

📍 Адрес: \`${wallet.address}\`

💰 Баланс:
   • USDT: ${wallet.usdtBalance.toFixed(2)}
   • TRX: ${wallet.trxBalance.toFixed(4)} (для комиссий)

Отправьте USDT TRC20 на этот адрес для пополнения.
        `,
        parse_mode: "Markdown",
      });
    } catch (error: any) {
      await this.bot.sendMessage(chatId, `❌ ${error.message}`);
    }
  }

  private async handleNewDeal(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();
    const username = msg.from?.username || msg.from?.first_name || "user";

    if (!telegramId) return;

    try {
      const existingUser = await userService.checkUserExists(telegramId);
      
      if (!existingUser) {
        this.userStates.set(telegramId, { action: "register_pin_for_new_deal", chatId, username });
        await this.bot.sendMessage(
          chatId,
          "🔐 Для создания сделки необходимо создать PIN-код из 4 цифр:"
        );
        return;
      }

      this.userStates.set(telegramId, { action: "select_role", chatId });
      await this.bot.sendMessage(chatId, "🎭 Выберите вашу роль в сделке:", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📦 Я продавец", callback_data: "role_seller" },
              { text: "🛒 Я покупатель", callback_data: "role_buyer" }
            ]
          ]
        }
      });
    } catch (error: any) {
      await this.bot.sendMessage(chatId, `❌ ${error.message}`);
    }
  }

  private async handleMyDeals(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();
    const username = msg.from?.username || msg.from?.first_name || "user";

    if (!telegramId) return;

    try {
      const existingUser = await userService.checkUserExists(telegramId);
      
      if (!existingUser) {
        this.userStates.set(telegramId, { action: "register_pin_for_deals", chatId, username });
        await this.bot.sendMessage(
          chatId,
          "🔐 Для доступа к сделкам необходимо создать PIN-код из 4 цифр:"
        );
        return;
      }
      
      this.userStates.set(telegramId, { action: "verify_pin_for_deals", chatId });
      await this.bot.sendMessage(chatId, "🔐 Введите ваш PIN-код для доступа к сделкам:");
    } catch (error: any) {
      await this.bot.sendMessage(chatId, `❌ ${error.message}`);
    }
  }

  private async showDeals(chatId: number, telegramId: string) {
    try {
      const deals = await dealService.getUserDeals(telegramId);

      if (deals.length === 0) {
        await this.bot.sendMessage(chatId, "📋 У вас пока нет сделок");
        return;
      }

      const statusLabels: { [key: string]: string } = {
        created: "🆕 Создана",
        awaiting_payment: "⏳ Ожидает оплаты",
        payment_sent: "💸 Оплата отправлена",
        completed: "✅ Завершена",
        cancelled: "❌ Отменена",
      };

      let message = "📋 **Ваши сделки:**\n\n";
      for (const deal of deals) {
        const statusLabel = statusLabels[deal.status] || deal.status;
        const isSeller = deal.seller_telegram_id === telegramId;
        const counterparty = isSeller ? deal.buyer_username : deal.seller_username;

        message += `🔖 \`${deal.id}\`\n`;
        message += `   ${statusLabel}\n`;
        message += `   💰 ${deal.amount} USDT\n`;
        message += `   📝 ${deal.description}\n`;
        if (counterparty) {
          message += `   👤 @${counterparty}\n`;
        }
        message += `\n`;
      }

      message += "💡 Откройте Mini App для управления сделками";

      await this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error: any) {
      await this.bot.sendMessage(chatId, `❌ ${error.message}`);
    }
  }

  private async getCounterpartyReputation(username: string): Promise<string | null> {
    try {
      const user = await db.getUserByUsername(username);
      if (!user) {
        return null; // User not registered yet
      }
      
      const reputation = await db.getUserReputation(user.telegram_id);
      const stats = await this.getUserDealStats(user.telegram_id);
      
      let message = `📊 **Информация о @${username}:**\n\n`;
      
      // Rating
      if (reputation.ratingsCount > 0) {
        const stars = "⭐".repeat(Math.round(reputation.averageRating));
        message += `${stars} ${reputation.averageRating.toFixed(1)}/5 (${reputation.ratingsCount} отзывов)\n`;
      } else {
        message += `☆ Нет отзывов\n`;
      }
      
      // Deal stats
      message += `✅ Сделок: ${stats.completed}\n`;
      message += `💰 Объём: ${stats.volume.toFixed(0)} USDT\n`;
      
      return message;
    } catch (error) {
      console.error("Error getting counterparty reputation:", error);
      return null;
    }
  }
  
  private async getUserDealStats(telegramId: string): Promise<{ completed: number; volume: number }> {
    try {
      const deals = await dealService.getUserDeals(telegramId);
      const completedDeals = deals.filter(d => d.status === 'completed');
      const volume = completedDeals.reduce((sum, d) => sum + parseFloat(d.amount.toString()), 0);
      
      return { completed: completedDeals.length, volume };
    } catch (error) {
      return { completed: 0, volume: 0 };
    }
  }
  
  private async showWallet(chatId: number, telegramId: string) {
    try {
      const wallet = await userService.getUserWallet(telegramId);
      const qrCode = await QRHelper.generateAddressQR(wallet.address);

      await this.bot.sendPhoto(chatId, Buffer.from(qrCode.split(",")[1], "base64"), {
        caption: `
💼 **Ваш кошелек:**

📍 Адрес: \`${wallet.address}\`

💰 Баланс:
   • USDT: ${wallet.usdtBalance.toFixed(2)}
   • TRX: ${wallet.trxBalance.toFixed(4)} (для комиссий)

Отправьте USDT TRC20 на этот адрес для пополнения.
        `,
        parse_mode: "Markdown",
      });
    } catch (error: any) {
      await this.bot.sendMessage(chatId, `❌ ${error.message}`);
    }
  }

  private async handleProfile(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();
    const username = msg.from?.username || msg.from?.first_name || "user";

    if (!telegramId) return;

    try {
      const existingUser = await userService.checkUserExists(telegramId);
      
      if (!existingUser) {
        this.userStates.set(telegramId, { action: "register_pin_for_profile", chatId, username });
        await this.bot.sendMessage(
          chatId,
          "🔐 Для просмотра ключей необходимо создать PIN-код из 4 цифр:"
        );
        return;
      }
      
      // Show profile with rating first
      const reputation = await db.getUserReputation(telegramId);
      const stats = await this.getUserDealStats(telegramId);
      
      let ratingText = "";
      if (reputation.ratingsCount > 0) {
        const stars = "⭐".repeat(Math.round(reputation.averageRating));
        ratingText = `${stars} ${reputation.averageRating.toFixed(1)}/5 (${reputation.ratingsCount} отзывов)`;
      } else {
        ratingText = "☆ Нет отзывов пока";
      }
      
      const profileMsg = `
👤 **Ваш профиль**

📛 Username: @${username}

📊 **Репутация:**
${ratingText}

📈 **Статистика:**
✅ Завершённых сделок: ${stats.completed}
💰 Общий объём: ${stats.volume.toFixed(0)} USDT

🔐 Для просмотра приватных ключей введите PIN-код:
      `;
      
      await this.bot.sendMessage(chatId, profileMsg, { parse_mode: "Markdown" });
      this.userStates.set(telegramId, { action: "view_keys", chatId });
    } catch (error: any) {
      await this.bot.sendMessage(chatId, `❌ ${error.message}`);
    }
  }

  private async handleCancel(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();

    if (!telegramId) return;

    this.userStates.delete(telegramId);
    await this.bot.sendMessage(chatId, "❌ Операция отменена", {
      reply_markup: { remove_keyboard: true },
    });
  }

  private async handleMessage(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();
    const text = msg.text;

    if (!telegramId || !text) return;
    if (text.startsWith("/")) return;

    if (msg.from?.username) {
      this.usernameToChatId.set(msg.from.username, chatId);
    }
    this.telegramIdToChatId.set(telegramId, chatId);

    if (text === "🚀 Открыть Mini App") {
      return this.handleStart(msg);
    }

    const state = this.userStates.get(telegramId);
    if (!state) return;

    try {
      if (state.action === "register_pin" || state.action === "register_pin_for_deals" || state.action === "register_pin_for_profile" || state.action === "register_pin_for_wallet" || state.action === "register_pin_for_new_deal") {
        if (!/^\d{4}$/.test(text)) {
          await this.bot.sendMessage(chatId, "❌ PIN должен быть 4-значным числом. Попробуйте снова:");
          return;
        }

        const result = await userService.registerUser(telegramId, state.username, text);
        this.userStates.delete(telegramId);

        await this.bot.sendMessage(
          chatId,
          `✅ Регистрация успешна!\n\n💼 Ваш кошелек:\n\`${result.wallet.address}\`\n\n🔐 PIN-код сохранен.`,
          { parse_mode: "Markdown" },
        );

        if (state.action === "register_pin_for_deals") {
          await this.showDeals(chatId, telegramId);
        } else if (state.action === "register_pin_for_profile") {
          this.userStates.set(telegramId, { action: "view_keys", chatId });
          await this.bot.sendMessage(chatId, "🔐 Теперь введите ваш PIN-код для просмотра ключей:");
        } else if (state.action === "register_pin_for_wallet") {
          await this.showWallet(chatId, telegramId);
        } else if (state.action === "register_pin_for_new_deal") {
          this.userStates.set(telegramId, { action: "create_deal_buyer_username", chatId });
          await this.bot.sendMessage(chatId, "👤 Введите Telegram username покупателя (например: @username или username):");
        }
      } else if (state.action === "verify_pin_for_deals") {
        const isValid = await userService.verifyPin(telegramId, text);
        if (!isValid) {
          await this.bot.sendMessage(chatId, "❌ Неверный PIN-код. Попробуйте снова:");
          return;
        }
        this.userStates.delete(telegramId);
        await this.showDeals(chatId, telegramId);
      } else if (state.action === "create_deal_counterparty") {
        const counterpartyUsername = text.replace('@', '');
        
        // Show counterparty reputation
        const counterpartyRep = await this.getCounterpartyReputation(counterpartyUsername);
        if (counterpartyRep) {
          await this.bot.sendMessage(chatId, counterpartyRep, { parse_mode: "Markdown" });
        }
        
        this.userStates.set(telegramId, { 
          action: "create_deal_amount", 
          chatId, 
          counterpartyUsername,
          role: state.role 
        });
        await this.bot.sendMessage(chatId, "💵 Введите сумму сделки в USDT:");
      } else if (state.action === "create_deal_buyer_username") {
        const counterpartyUsername = text.replace('@', '');
        
        // Show counterparty reputation
        const counterpartyRep = await this.getCounterpartyReputation(counterpartyUsername);
        if (counterpartyRep) {
          await this.bot.sendMessage(chatId, counterpartyRep, { parse_mode: "Markdown" });
        }
        
        this.userStates.set(telegramId, { 
          action: "create_deal_amount", 
          chatId, 
          counterpartyUsername,
          role: 'seller'
        });
        await this.bot.sendMessage(chatId, "💵 Введите сумму сделки в USDT:");
      } else if (state.action === "create_deal_amount") {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
          await this.bot.sendMessage(chatId, "❌ Неверная сумма. Введите число больше 0:");
          return;
        }

        this.userStates.set(telegramId, { 
          action: "create_deal_description", 
          chatId, 
          amount, 
          counterpartyUsername: state.counterpartyUsername,
          role: state.role
        });
        await this.bot.sendMessage(chatId, "📝 Введите описание сделки:");
      } else if (state.action === "create_deal_description") {
        const role = state.role || 'seller';
        const { deal, walletAddress, counterpartyUsername } = await dealService.createDeal(
          telegramId,
          state.amount,
          text,
          state.counterpartyUsername,
          role
        );

        this.userStates.delete(telegramId);

        const qrCode = await QRHelper.generateAddressQR(walletAddress);

        const roleLabel = role === 'seller' ? '📦 Вы продавец' : '🛒 Вы покупатель';
        const counterpartyLabel = role === 'seller' 
          ? `👤 Покупатель: @${counterpartyUsername}` 
          : `👤 Продавец: @${counterpartyUsername}`;

        await this.bot.sendPhoto(chatId, Buffer.from(qrCode.split(",")[1], "base64"), {
          caption: `
✅ **Сделка создана!**

🔖 ID: \`${deal.id}\`
${roleLabel}
${counterpartyLabel}
💰 Сумма: ${deal.amount} USDT
📝 Описание: ${deal.description}

💼 Адрес кошелька сделки:
\`${walletAddress}\`

📨 Уведомление отправлено контрагенту @${counterpartyUsername}

⏳ Сделка начнётся когда контрагент примет её.

💡 Откройте Mini App для управления сделкой.
          `,
          parse_mode: "Markdown",
        });

        if (counterpartyUsername) {
          await this.sendDealNotification(counterpartyUsername, deal, role);
        }
      } else if (state.action === "view_keys") {
        try {
          const keys = await userService.getUserKeys(telegramId, text);
          this.userStates.delete(telegramId);

          await this.bot.sendMessage(
            chatId,
            `
🔑 **Ваш приватный ключ:**

🔐 Private Key:
\`${keys.privateKey}\`

⚠️ **ВАЖНО:** Никому не показывайте этот ключ! Сохраните его в безопасном месте.

Это сообщение будет удалено через 60 секунд.
            `,
            { parse_mode: "Markdown" },
          ).then((sentMsg) => {
            setTimeout(() => {
              this.bot.deleteMessage(chatId, sentMsg.message_id);
            }, 60000);
          });
        } catch (error: any) {
          await this.bot.sendMessage(chatId, `❌ ${error.message}`);
          this.userStates.delete(telegramId);
        }
      }
    } catch (error: any) {
      await this.bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
      this.userStates.delete(telegramId);
    }
  }

  async sendDealNotification(username: string, deal: any, creatorRole: 'seller' | 'buyer' = 'seller') {
    try {
      const chatId = this.usernameToChatId.get(username);
      
      if (!chatId) {
        console.log(`⚠️ Не удалось отправить уведомление пользователю @${username} - пользователь не взаимодействовал с ботом`);
        return false;
      }

      const yourRole = creatorRole === 'seller' ? 'покупатель' : 'продавец';
      const creatorRoleLabel = creatorRole === 'seller' ? 'Продавец' : 'Покупатель';
      
      const message = `
🔔 **Новая сделка для вас!**

👤 ${creatorRoleLabel} создал сделку с вашим участием.
🎭 Ваша роль: **${yourRole}**

🔖 ID сделки: \`${deal.id}\`
💰 Сумма: ${deal.amount} USDT
📝 Описание: ${deal.description}

💼 Адрес кошелька сделки:
\`${deal.deal_wallet_address}\`

⏳ **Что дальше:**
1. Откройте Mini App для принятия сделки
2. После принятия покупатель переводит USDT на адрес сделки
3. По подтверждению оплаты выдаётся seed-фраза кошелька

⚠️ Сделка начнётся только после вашего принятия!

💡 Откройте Mini App для управления сделкой.
      `;

      await this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
      console.log(`✅ Уведомление отправлено пользователю @${username}`);
      return true;
    } catch (error) {
      console.error(`❌ Ошибка отправки уведомления пользователю @${username}:`, error);
      return false;
    }
  }

  private paymentMonitorInterval: NodeJS.Timeout | null = null;

  start() {
    console.log("✅ Telegram бот запущен");
    this.startPaymentMonitoring();
  }

  startPaymentMonitoring() {
    console.log("💰 Запуск мониторинга платежей...");
    
    this.paymentMonitorInterval = setInterval(async () => {
      try {
        await this.checkAwaitingPayments();
      } catch (error) {
        console.error("❌ Ошибка мониторинга платежей:", error);
      }
    }, 60000);
    
    setTimeout(() => this.checkAwaitingPayments(), 10000);
  }

  async checkAwaitingPayments() {
    try {
      const deals = await dealService.getConfirmedButNotNotifiedDeals();
      
      for (const deal of deals) {
        const balance = await dealService.checkDealPayment(deal.id);
        await dealService.markPaymentNotified(deal.id);
        await this.notifyPaymentConfirmed(deal, balance?.balance || deal.amount);
      }
    } catch (error) {
      console.error("❌ Ошибка проверки платежей:", error);
    }
  }

  async notifyPaymentConfirmed(deal: any, balance: number) {
    try {
      if (deal.seller_telegram_id) {
        const sellerChatId = this.telegramIdToChatId.get(deal.seller_telegram_id);
        
        if (sellerChatId) {
          const message = `
💰 **Покупатель подтвердил оплату!**

🔖 Сделка: \`${deal.id}\`
💵 Сумма: ${deal.amount} USDT
📊 Баланс кошелька: ${balance.toFixed(2)} USDT

✅ Покупатель @${deal.buyer_username || 'неизвестен'} подтвердил отправку оплаты!

⏳ Теперь дождитесь, пока покупатель подтвердит получение товара/услуги. После этого вы сможете получить оплату.
          `;

          await this.bot.sendMessage(sellerChatId, message, { parse_mode: "Markdown" });
          console.log(`✅ Уведомление о подтверждении оплаты отправлено продавцу ${deal.seller_telegram_id}`);
        } else {
          console.log(`⚠️ Не удалось уведомить продавца ${deal.seller_telegram_id} - нет chatId`);
        }
      }
    } catch (error) {
      console.error("❌ Ошибка отправки уведомления о подтверждении платежа:", error);
    }
  }

  async notifyBuyerConfirmedReceived(deal: any) {
    try {
      if (deal.seller_telegram_id) {
        const sellerChatId = this.telegramIdToChatId.get(deal.seller_telegram_id);
        
        if (sellerChatId) {
          const message = `
✅ **Покупатель подтвердил получение!**

🔖 Сделка: \`${deal.id}\`
💵 Сумма: ${deal.amount} USDT

🎉 Покупатель @${deal.buyer_username || 'неизвестен'} подтвердил получение товара/услуги!

💰 Теперь вы можете получить оплату (seed-фразу кошелька).
          `;

          await this.bot.sendMessage(sellerChatId, message, { 
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "💰 Получить оплату", web_app: { url: this.getWebAppUrl() } }]
              ]
            }
          });
          console.log(`✅ Уведомление о подтверждении получения отправлено продавцу ${deal.seller_telegram_id}`);
        } else {
          console.log(`⚠️ Не удалось уведомить продавца ${deal.seller_telegram_id} - нет chatId`);
        }
      }
    } catch (error) {
      console.error("❌ Ошибка отправки уведомления о подтверждении получения:", error);
    }
  }

  async sendRatingRequest(dealId: string, buyerTelegramId: string, sellerUsername: string) {
    try {
      const chatId = this.telegramIdToChatId.get(buyerTelegramId);
      if (!chatId) {
        console.log(`⚠️ Не удалось отправить запрос на оценку покупателю ${buyerTelegramId} - нет chatId`);
        return false;
      }
      
      // Check if already rated
      const existingRating = await db.getRatingForDeal(dealId, buyerTelegramId);
      if (existingRating) {
        return false; // Already rated
      }
      
      const message = `
⭐ **Оцените сделку!**

🔖 Сделка \`${dealId}\` успешно завершена!

Пожалуйста, оцените продавца @${sellerUsername}:
      `;
      
      await this.bot.sendMessage(chatId, message, { 
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⭐", callback_data: `rate_1_${dealId}` },
              { text: "⭐⭐", callback_data: `rate_2_${dealId}` },
              { text: "⭐⭐⭐", callback_data: `rate_3_${dealId}` },
              { text: "⭐⭐⭐⭐", callback_data: `rate_4_${dealId}` },
              { text: "⭐⭐⭐⭐⭐", callback_data: `rate_5_${dealId}` }
            ],
            [
              { text: "Пропустить", callback_data: `skip_rating_${dealId}` }
            ]
          ]
        }
      });
      
      console.log(`✅ Запрос на оценку отправлен покупателю ${buyerTelegramId}`);
      return true;
    } catch (error) {
      console.error("❌ Ошибка отправки запроса на оценку:", error);
      return false;
    }
  }
  
  async notifyDealCreated(deal: any, counterpartyTelegramId: string) {
    try {
      const counterpartyChatId = this.telegramIdToChatId.get(counterpartyTelegramId);
      
      if (counterpartyChatId) {
        const isSeller = deal.seller_telegram_id === counterpartyTelegramId;
        const creatorUsername = isSeller ? deal.buyer_username : deal.seller_username;
        const role = isSeller ? 'продавцом' : 'покупателем';
        
        const message = `
📩 **Новая сделка для вас!**

🔖 Сделка: \`${deal.id}\`
💵 Сумма: ${deal.amount} USDT
📝 Описание: ${deal.description || 'Без описания'}
👤 Создатель: @${creatorUsername || 'неизвестен'}

Вы указаны как ${role} в этой сделке.
Откройте Mini App чтобы принять или отклонить сделку.
        `;

        await this.bot.sendMessage(counterpartyChatId, message, { 
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🚀 Открыть Mini App", web_app: { url: this.getWebAppUrl() } }]
            ]
          }
        });
        
        console.log(`📩 Уведомление о новой сделке отправлено ${counterpartyTelegramId}`);
      }
    } catch (error) {
      console.error("❌ Ошибка уведомления о создании сделки:", error);
    }
  }
  
  async notifyDealAccepted(deal: any) {
    try {
      // Notify seller that buyer accepted
      if (deal.seller_telegram_id) {
        const sellerChatId = this.telegramIdToChatId.get(deal.seller_telegram_id);
        
        if (sellerChatId) {
          const message = `
✅ **Сделка принята!**

🔖 Сделка: \`${deal.id}\`
💵 Сумма: ${deal.amount} USDT
👤 Покупатель: @${deal.buyer_username || 'неизвестен'}

💳 Ожидаем оплату от покупателя на кошелёк сделки.
          `;

          await this.bot.sendMessage(sellerChatId, message, { 
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🚀 Открыть Mini App", web_app: { url: this.getWebAppUrl() } }]
              ]
            }
          });
        }
      }
      
      // Notify buyer with "I paid" button
      if (deal.buyer_telegram_id) {
        const buyerChatId = this.telegramIdToChatId.get(deal.buyer_telegram_id);
        
        if (buyerChatId) {
          const message = `
✅ **Вы приняли сделку!**

🔖 Сделка: \`${deal.id}\`
💵 Сумма: ${deal.amount} USDT
👤 Продавец: @${deal.seller_username || 'неизвестен'}

📤 Кошелёк для оплаты: \`${deal.wallet_address}\`

💡 Переведите ${deal.amount} USDT на адрес выше и нажмите "Я оплатил" для автоматической проверки.
          `;

          await this.bot.sendMessage(buyerChatId, message, { 
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "💸 Я оплатил", callback_data: `i_paid_${deal.id}` }],
                [{ text: "🚀 Открыть Mini App", web_app: { url: this.getWebAppUrl() } }]
              ]
            }
          });
        }
      }
      
      console.log(`✅ Уведомление о принятии сделки отправлено`);
    } catch (error) {
      console.error("❌ Ошибка уведомления о принятии сделки:", error);
    }
  }
  
  async notifyDealCompleted(deal: any) {
    try {
      // Notify buyer about completion
      if (deal.buyer_telegram_id) {
        const buyerChatId = this.telegramIdToChatId.get(deal.buyer_telegram_id);
        
        if (buyerChatId) {
          const message = `
✅ **Сделка завершена!**

🔖 Сделка: \`${deal.id}\`
💵 Сумма: ${deal.amount} USDT
👤 Продавец: @${deal.seller_username || 'неизвестен'}

🔑 Seed-фраза кошелька отправлена. Откройте Mini App чтобы её получить.

⭐ Не забудьте оценить продавца!
          `;

          await this.bot.sendMessage(buyerChatId, message, { parse_mode: "Markdown" });
          
          // Send rating request after a short delay
          setTimeout(() => {
            this.sendRatingRequest(deal.id, deal.buyer_telegram_id, deal.seller_username || 'продавец');
          }, 2000);
        }
      }
      
      // Notify seller about completion
      if (deal.seller_telegram_id) {
        const sellerChatId = this.telegramIdToChatId.get(deal.seller_telegram_id);
        
        if (sellerChatId) {
          const message = `
🎉 **Сделка успешно завершена!**

🔖 Сделка: \`${deal.id}\`
💵 Сумма: ${deal.amount} USDT
👤 Покупатель: @${deal.buyer_username || 'неизвестен'}

✅ Seed-фраза передана покупателю. Сделка закрыта.
          `;

          await this.bot.sendMessage(sellerChatId, message, { parse_mode: "Markdown" });
        }
      }
    } catch (error) {
      console.error("❌ Ошибка уведомления о завершении сделки:", error);
    }
  }
  
  private getWebAppUrl(): string {
    const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
    return `https://${domain}`;
  }

  // ============= ADMIN & ARBITRATION METHODS =============
  
  async broadcastMessage(message: string): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    
    for (const [telegramId, chatId] of this.telegramIdToChatId) {
      try {
        await this.bot.sendMessage(chatId, `📢 **Объявление:**\n\n${message}`, { parse_mode: "Markdown" });
        sent++;
        await new Promise(resolve => setTimeout(resolve, 50)); // Rate limiting
      } catch (error) {
        failed++;
        console.error(`Failed to send broadcast to ${telegramId}:`, error);
      }
    }
    
    return { sent, failed };
  }
  
  async sendArbitrationNotification(arbitration: any, deal: any, arbitratorTelegramId: string) {
    try {
      const chatId = this.telegramIdToChatId.get(arbitratorTelegramId);
      if (!chatId) {
        console.log(`⚠️ Не удалось уведомить арбитражника ${arbitratorTelegramId} - нет chatId`);
        return false;
      }
      
      const requester = await db.getUser(arbitration.requested_by);
      const requesterName = requester?.username || arbitration.requested_by;
      
      const message = `
⚖️ **Новый запрос на арбитраж!**

🔖 Сделка: \`${deal.id}\`
💰 Сумма: ${deal.amount} USDT
📝 Описание: ${deal.description}

👤 Продавец: @${deal.seller_username || 'неизвестен'}
👤 Покупатель: @${deal.buyer_username || 'неизвестен'}

📨 Запросил: @${requesterName}
💬 Сообщение: ${arbitration.request_message}

🔗 Откройте Mini App для управления спором
      `;
      
      await this.bot.sendMessage(chatId, message, { 
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Взять спор", callback_data: `arb_take_${arbitration.id}` }
            ]
          ]
        }
      });
      
      console.log(`✅ Уведомление об арбитраже отправлено ${arbitratorTelegramId}`);
      return true;
    } catch (error) {
      console.error("❌ Ошибка отправки уведомления об арбитраже:", error);
      return false;
    }
  }
  
  async sendArbitrationAssigned(arbitration: any, deal: any, arbitratorId: string) {
    try {
      const chatId = this.telegramIdToChatId.get(arbitratorId);
      if (!chatId) return false;
      
      const message = `
⚖️ **Вам назначен спор!**

🔖 Сделка: \`${deal.id}\`
💰 Сумма: ${deal.amount} USDT

👤 Продавец: @${deal.seller_username || 'неизвестен'}
👤 Покупатель: @${deal.buyer_username || 'неизвестен'}

💬 Причина спора: ${arbitration.request_message}

Откройте Mini App для рассмотрения и вынесения решения.
      `;
      
      await this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
      return true;
    } catch (error) {
      console.error("❌ Ошибка уведомления о назначении:", error);
      return false;
    }
  }
  
  async sendArbitrationResolved(arbitration: any, deal: any, resolution: string) {
    try {
      const resolutionText = resolution === 'seller' 
        ? '✅ в пользу продавца' 
        : resolution === 'buyer' 
          ? '✅ в пользу покупателя'
          : '⚖️ разделение средств';
      
      // Notify seller
      if (deal.seller_telegram_id) {
        const sellerChatId = this.telegramIdToChatId.get(deal.seller_telegram_id);
        if (sellerChatId) {
          const sellerWon = resolution === 'seller';
          const sellerMsg = `
⚖️ **Решение по спору вынесено!**

🔖 Сделка: \`${deal.id}\`
💰 Сумма: ${deal.amount} USDT

📋 Решение: ${resolutionText}
${arbitration.resolution_notes ? `💬 Комментарий: ${arbitration.resolution_notes}` : ''}

${sellerWon ? '🎉 Seed-фраза кошелька будет отправлена вам!' : ''}
          `;
          await this.bot.sendMessage(sellerChatId, sellerMsg, { parse_mode: "Markdown" });
        }
      }
      
      // Notify buyer
      if (deal.buyer_telegram_id) {
        const buyerChatId = this.telegramIdToChatId.get(deal.buyer_telegram_id);
        if (buyerChatId) {
          const buyerWon = resolution === 'buyer';
          const buyerMsg = `
⚖️ **Решение по спору вынесено!**

🔖 Сделка: \`${deal.id}\`
💰 Сумма: ${deal.amount} USDT

📋 Решение: ${resolutionText}
${arbitration.resolution_notes ? `💬 Комментарий: ${arbitration.resolution_notes}` : ''}

${buyerWon ? '🎉 Seed-фраза кошелька будет отправлена вам!' : ''}
          `;
          await this.bot.sendMessage(buyerChatId, buyerMsg, { parse_mode: "Markdown" });
        }
      }
      
      return true;
    } catch (error) {
      console.error("❌ Ошибка уведомления о решении:", error);
      return false;
    }
  }
  
  async sendSeedPhraseToUser(telegramId: string, seedPhrase: string, dealId: string, resolution: string) {
    try {
      const chatId = this.telegramIdToChatId.get(telegramId);
      if (!chatId) {
        console.log(`⚠️ Не удалось отправить seed-фразу ${telegramId} - нет chatId`);
        return false;
      }
      
      const resolutionText = resolution === 'seller' ? 'в пользу продавца' : 'в пользу покупателя';
      
      const message = `
🔑 **Seed-фраза кошелька сделки**

🔖 Сделка: \`${dealId}\`
📋 Решение арбитража: ${resolutionText}

🌱 **Seed-фраза:**
\`${seedPhrase}\`

⚠️ **ВАЖНО:** 
• Сохраните эту фразу в надёжном месте
• Никому её не показывайте
• С помощью неё вы получите доступ к средствам на кошельке сделки

🔒 Это сообщение будет удалено через 5 минут.
      `;
      
      const sentMsg = await this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
      
      // Delete message after 5 minutes
      setTimeout(() => {
        try {
          this.bot.deleteMessage(chatId, sentMsg.message_id);
        } catch (e) {
          // Ignore
        }
      }, 5 * 60 * 1000);
      
      return true;
    } catch (error) {
      console.error("❌ Ошибка отправки seed-фразы:", error);
      return false;
    }
  }

  getBot() {
    return this.bot;
  }

  async getUserProfilePhoto(userId: string | number): Promise<string | null> {
    try {
      const photos = await this.bot.getUserProfilePhotos(Number(userId), { limit: 1 });
      
      if (photos.total_count > 0 && photos.photos.length > 0) {
        const photo = photos.photos[0];
        const bestQuality = photo[photo.length - 1];
        const file = await this.bot.getFile(bestQuality.file_id);
        
        if (file.file_path) {
          const token = process.env.TELEGRAM_BOT_TOKEN;
          return `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        }
      }
      
      return null;
    } catch (error) {
      console.error("❌ Ошибка получения аватара:", error);
      return null;
    }
  }
}
