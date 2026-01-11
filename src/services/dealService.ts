import { db } from "../db/database";
import { tronHelper } from "../utils/tron";
import { CryptoHelper } from "../utils/crypto";

export class DealService {
  async createDeal(
    creatorTelegramId: string, 
    amount: number, 
    description: string, 
    counterpartyUsername: string | null = null,
    creatorRole: 'seller' | 'buyer' = 'seller'
  ) {
    const creator = await db.getUser(creatorTelegramId);
    if (!creator) {
      throw new Error("Вы не зарегистрированы в боте");
    }

    const normalizedUsername = counterpartyUsername && counterpartyUsername.trim() !== '' 
      ? counterpartyUsername.replace(/^@/, '').trim() 
      : null;

    if (!normalizedUsername) {
      throw new Error("Укажите username контрагента");
    }

    const counterparty = await db.getUserByUsername(normalizedUsername);
    if (!counterparty) {
      throw new Error(`Пользователь @${normalizedUsername} не зарегистрирован в боте. Попросите его зарегистрироваться.`);
    }

    if (counterparty.telegram_id === creatorTelegramId) {
      throw new Error("Нельзя создать сделку с самим собой");
    }

    const dealWallet = await tronHelper.createWallet();
    const dealId = CryptoHelper.generateRandomId("deal_");

    let sellerTelegramId: string;
    let sellerUsername: string;
    let buyerTelegramId: string;
    let buyerUsername: string;

    if (creatorRole === 'seller') {
      sellerTelegramId = creatorTelegramId;
      sellerUsername = creator.username;
      buyerTelegramId = counterparty.telegram_id;
      buyerUsername = counterparty.username;
    } else {
      buyerTelegramId = creatorTelegramId;
      buyerUsername = creator.username;
      sellerTelegramId = counterparty.telegram_id;
      sellerUsername = counterparty.username;
    }

    const deal = await db.createDeal({
      id: dealId,
      seller_telegram_id: sellerTelegramId,
      seller_username: sellerUsername,
      buyer_telegram_id: buyerTelegramId,
      buyer_username: buyerUsername,
      amount,
      description,
      status: "created",
      deal_wallet_address: dealWallet.address,
      encrypted_deal_private_key: CryptoHelper.encrypt(dealWallet.privateKey),
      encrypted_deal_seed: CryptoHelper.encrypt(dealWallet.seedPhrase),
      creator_role: creatorRole,
      payment_notified: false,
      buyer_confirmed_payment: false,
      arbitration_id: null,
    });

    return {
      deal,
      walletAddress: dealWallet.address,
      counterpartyUsername: normalizedUsername,
    };
  }

  async acceptDeal(dealId: string, acceptorTelegramId: string) {
    const deal = await db.getDeal(dealId);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    if (deal.status !== "created") {
      throw new Error("Сделка уже принята или завершена");
    }

    const acceptor = await db.getUser(acceptorTelegramId);
    if (!acceptor) {
      throw new Error("Вы не зарегистрированы. Зарегистрируйтесь в боте для участия в сделке.");
    }

    if (deal.creator_role === 'seller') {
      if (deal.buyer_telegram_id !== acceptorTelegramId) {
        throw new Error("Эта сделка предназначена для другого пользователя");
      }
    } else {
      if (deal.seller_telegram_id !== acceptorTelegramId) {
        throw new Error("Эта сделка предназначена для другого пользователя");
      }
    }

    await db.updateDealStatus(dealId, "awaiting_payment");
    
    const updatedDeal = await db.getDeal(dealId);
    return updatedDeal;
  }

  async confirmPayment(dealId: string, buyerTelegramId: string) {
    const deal = await db.getDeal(dealId);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    if (deal.status !== "awaiting_payment") {
      throw new Error("Сделка в неверном статусе для подтверждения оплаты");
    }

    if (deal.buyer_telegram_id !== buyerTelegramId) {
      throw new Error("Только покупатель может подтвердить оплату");
    }

    const balance = await tronHelper.getUSDTBalance(deal.deal_wallet_address);
    if (balance < deal.amount) {
      throw new Error(`Оплата ещё не поступила. Требуется: ${deal.amount} USDT, текущий баланс: ${balance.toFixed(2)} USDT`);
    }

    await db.confirmBuyerPayment(dealId);

    const updatedDeal = await db.getDeal(dealId);
    return {
      deal: updatedDeal,
      balance
    };
  }

  async payFromWallet(dealId: string, buyerTelegramId: string, pin: string): Promise<{ txHash: string; balance: number; fee: number }> {
    const USDT_TRANSFER_FEE_TRX = 30;
    
    const deal = await db.getDeal(dealId);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    if (deal.status !== "awaiting_payment") {
      throw new Error("Сделка в неверном статусе для оплаты");
    }

    if (deal.buyer_telegram_id !== buyerTelegramId) {
      throw new Error("Только покупатель может оплатить сделку");
    }

    const buyer = await db.getUser(buyerTelegramId);
    if (!buyer) {
      throw new Error("Пользователь не найден");
    }

    const isValidPin = CryptoHelper.verifyPin(pin, buyer.pin_hash);
    if (!isValidPin) {
      throw new Error("Неверный PIN-код");
    }

    const buyerUsdtBalance = await tronHelper.getUSDTBalance(buyer.wallet_address);
    if (buyerUsdtBalance < deal.amount) {
      throw new Error(`Недостаточно USDT. На балансе: ${buyerUsdtBalance.toFixed(2)} USDT, нужно: ${deal.amount} USDT`);
    }

    const buyerTrxBalance = await tronHelper.getTRXBalance(buyer.wallet_address);
    if (buyerTrxBalance < USDT_TRANSFER_FEE_TRX) {
      throw new Error(`Недостаточно TRX для комиссии. На балансе: ${buyerTrxBalance.toFixed(2)} TRX, нужно: ~${USDT_TRANSFER_FEE_TRX} TRX`);
    }

    const privateKey = CryptoHelper.decrypt(buyer.encrypted_private_key);
    const txHash = await tronHelper.transferUSDT(
      privateKey,
      deal.deal_wallet_address,
      deal.amount
    );

    // Wait a moment for the transaction to propagate
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify the balance after transfer
    const balance = await tronHelper.getUSDTBalance(deal.deal_wallet_address);
    
    if (balance < deal.amount) {
      console.error(`[Deal] Transfer sent but balance not confirmed. TX: ${txHash}, Balance: ${balance}, Required: ${deal.amount}`);
      throw new Error(`Транзакция отправлена (TX: ${txHash.slice(0, 16)}...), но баланс ещё не обновился. Подождите и нажмите "Я оплатил" для проверки.`);
    }

    await db.confirmBuyerPayment(dealId);

    console.log(`[Deal] Buyer ${buyerTelegramId} paid ${deal.amount} USDT from wallet to deal ${dealId}, tx: ${txHash}`);

    return {
      txHash,
      balance,
      fee: USDT_TRANSFER_FEE_TRX
    };
  }

  async completeDeal(dealId: string, sellerTelegramId: string, pin: string) {
    const deal = await db.getDeal(dealId);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    if (deal.status !== "buyer_confirmed") {
      if (deal.status === "awaiting_payment") {
        throw new Error("Покупатель ещё не подтвердил оплату. Дождитесь подтверждения.");
      }
      if (deal.status === "payment_confirmed") {
        throw new Error("Покупатель ещё не подтвердил получение товара/услуги. Дождитесь подтверждения.");
      }
      throw new Error("Сделка в неверном статусе");
    }

    if (deal.seller_telegram_id !== sellerTelegramId) {
      throw new Error("Только продавец может завершить сделку и получить оплату");
    }

    const seller = await db.getUser(sellerTelegramId);
    if (!seller) {
      throw new Error("Пользователь не найден");
    }

    const isValidPin = CryptoHelper.verifyPin(pin, seller.pin_hash);
    if (!isValidPin) {
      throw new Error("Неверный PIN-код");
    }

    const balance = await tronHelper.getUSDTBalance(deal.deal_wallet_address);
    if (balance < deal.amount) {
      throw new Error(`Недостаточно средств на кошельке сделки. Требуется: ${deal.amount} USDT, доступно: ${balance} USDT`);
    }

    await db.updateDealStatus(dealId, "completed");

    const decryptedSeed = CryptoHelper.decrypt(deal.encrypted_deal_seed);
    const decryptedPrivateKey = CryptoHelper.decrypt(deal.encrypted_deal_private_key);

    return {
      deal,
      seedPhrase: decryptedSeed,
      privateKey: decryptedPrivateKey,
      walletAddress: deal.deal_wallet_address,
    };
  }

  async getDealWalletCredentials(dealId: string, telegramId: string, pin: string) {
    const deal = await db.getDeal(dealId);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    if (deal.status !== "completed") {
      throw new Error("Доступ к кошельку возможен только для завершённых сделок");
    }

    if (deal.seller_telegram_id !== telegramId) {
      throw new Error("Только продавец может получить доступ к кошельку сделки");
    }

    const seller = await db.getUser(telegramId);
    if (!seller) {
      throw new Error("Пользователь не найден");
    }

    const isValidPin = CryptoHelper.verifyPin(pin, seller.pin_hash);
    if (!isValidPin) {
      throw new Error("Неверный PIN-код");
    }

    const decryptedSeed = CryptoHelper.decrypt(deal.encrypted_deal_seed);
    const decryptedPrivateKey = CryptoHelper.decrypt(deal.encrypted_deal_private_key);

    return {
      seedPhrase: decryptedSeed,
      privateKey: decryptedPrivateKey,
      walletAddress: deal.deal_wallet_address,
    };
  }

  async checkDealPayment(dealId: string) {
    const deal = await db.getDeal(dealId);
    if (!deal) {
      return null;
    }

    if (deal.status !== "awaiting_payment") {
      return null;
    }

    const balance = await tronHelper.getUSDTBalance(deal.deal_wallet_address);
    const isPaid = balance >= deal.amount;

    return {
      deal,
      balance,
      isPaid,
      requiredAmount: deal.amount
    };
  }

  async getConfirmedButNotNotifiedDeals() {
    return await db.getConfirmedButNotNotifiedDeals();
  }

  async markPaymentNotified(dealId: string) {
    return await db.markDealPaymentNotified(dealId);
  }

  async getDealInfo(dealId: string) {
    const deal = await db.getDeal(dealId);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    const balance = await tronHelper.getUSDTBalance(deal.deal_wallet_address);

    return {
      deal,
      currentBalance: balance,
    };
  }

  async getUserDeals(telegramId: string) {
    return await db.getUserDeals(telegramId);
  }
}

export const dealService = new DealService();
