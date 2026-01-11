import { db } from "../db/database";
import { tronHelper } from "../utils/tron";
import { CryptoHelper } from "../utils/crypto";

export class UserService {
  async checkUserExists(telegramId: string): Promise<boolean> {
    const user = await db.getUser(telegramId);
    return user !== null;
  }

  async registerUser(telegramId: string, username: string, pin: string) {
    const existingUser = await db.getUser(telegramId);
    if (existingUser) {
      throw new Error("Пользователь уже зарегистрирован");
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      throw new Error("PIN должен быть 4-значным числом");
    }

    const wallet = await tronHelper.createWallet();
    
    const user = await db.createUser({
      telegram_id: telegramId,
      username,
      wallet_address: wallet.address,
      encrypted_private_key: CryptoHelper.encrypt(wallet.privateKey),
      encrypted_seed_phrase: CryptoHelper.encrypt(wallet.seedPhrase),
      pin_hash: CryptoHelper.hashPin(pin),
    });

    return {
      user,
      wallet: {
        address: wallet.address,
      },
    };
  }

  async verifyPin(telegramId: string, pin: string): Promise<boolean> {
    const user = await db.getUser(telegramId);
    if (!user) {
      return false;
    }
    return CryptoHelper.verifyPin(pin, user.pin_hash);
  }

  async getUserWallet(telegramId: string) {
    const user = await db.getUser(telegramId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    const usdtBalance = await tronHelper.getUSDTBalance(user.wallet_address);
    const trxBalance = await tronHelper.getTRXBalance(user.wallet_address);

    return {
      address: user.wallet_address,
      usdtBalance,
      trxBalance,
    };
  }

  async getUserKeys(telegramId: string, pin: string) {
    const user = await db.getUser(telegramId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    if (!CryptoHelper.verifyPin(pin, user.pin_hash)) {
      throw new Error("Неверный PIN-код");
    }

    return {
      privateKey: CryptoHelper.decrypt(user.encrypted_private_key),
      seedPhrase: CryptoHelper.decrypt(user.encrypted_seed_phrase),
    };
  }

  async getPrivateKey(telegramId: string, pin: string): Promise<string> {
    const keys = await this.getUserKeys(telegramId, pin);
    return keys.privateKey;
  }

  async getSeedPhrase(telegramId: string, pin: string): Promise<string> {
    const keys = await this.getUserKeys(telegramId, pin);
    return keys.seedPhrase;
  }

  async getUserStats(telegramId: string) {
    const user = await db.getUser(telegramId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    // Get P2P deals for statistics
    const p2pDeals = await db.getUserP2PDeals(telegramId);
    
    // Active P2P deals
    const activeDeals = p2pDeals.filter(d => 
      d.status === 'created' || d.status === 'crypto_deposited' || d.status === 'fiat_sent'
    ).length;
    
    // Completed P2P deals
    const completedP2PDeals = p2pDeals.filter(d => d.status === 'completed');
    const completedDeals = completedP2PDeals.length;
    
    // P2P Sales count (where user was seller) - количество продаж
    const p2pSalesCount = completedP2PDeals
      .filter(d => d.seller_telegram_id === telegramId)
      .length;
    
    // P2P Buys count (where user was buyer) - количество покупок
    const p2pBuysCount = completedP2PDeals
      .filter(d => d.buyer_telegram_id === telegramId)
      .length;
    
    // Total USDT sold in P2P
    const totalSalesUsdt = completedP2PDeals
      .filter(d => d.seller_telegram_id === telegramId)
      .reduce((sum, d) => sum + parseFloat(String(d.crypto_amount)), 0);
    
    // Total USDT bought in P2P  
    const totalBuysUsdt = completedP2PDeals
      .filter(d => d.buyer_telegram_id === telegramId)
      .reduce((sum, d) => sum + parseFloat(String(d.crypto_amount)), 0);

    const registrationDate = user.created_at 
      ? new Date(user.created_at).toLocaleDateString('ru-RU')
      : '-';

    return {
      activeDeals,
      completedDeals,
      totalSalesUsdt,
      totalBuysUsdt,
      p2pSalesCount,
      p2pBuysCount,
      registrationDate
    };
  }

  async changePin(telegramId: string, oldPin: string, newPin: string): Promise<void> {
    const user = await db.getUser(telegramId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    if (!CryptoHelper.verifyPin(oldPin, user.pin_hash)) {
      throw new Error("Неверный текущий PIN-код");
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      throw new Error("Новый PIN должен быть 4-значным числом");
    }

    const newPinHash = CryptoHelper.hashPin(newPin);
    await db.updateUserPin(telegramId, newPinHash);
  }

  async canWithdraw(telegramId: string): Promise<{ canWithdraw: boolean; reason?: string; activeDeals?: { regular: number; p2p: number }; frozenAmount?: number; infoMessage?: string }> {
    const activeDeals = await db.getActiveDealsCount(telegramId);
    const frozenAmount = await db.getUserFrozenAmount(telegramId);

    let infoMessage = undefined;
    if (frozenAmount > 0) {
      infoMessage = `Заморожено ${frozenAmount.toFixed(2)} USDT в P2P сделках. Эта сумма недоступна для вывода.`;
    }

    return { 
      canWithdraw: true, 
      activeDeals,
      frozenAmount,
      infoMessage
    };
  }

  async withdrawUSDT(telegramId: string, toAddress: string, amount: number, pin: string): Promise<{ txHash: string; fee: number }> {
    const user = await db.getUser(telegramId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    if (!CryptoHelper.verifyPin(pin, user.pin_hash)) {
      throw new Error("Неверный PIN-код");
    }

    const balance = await tronHelper.getUSDTBalance(user.wallet_address);
    const frozenAmount = await db.getUserFrozenAmount(telegramId);
    const availableBalance = balance - frozenAmount;

    if (amount <= 0) {
      throw new Error("Сумма должна быть больше 0");
    }

    if (amount > availableBalance) {
      throw new Error(`Недостаточно средств. Доступно: ${availableBalance.toFixed(2)} USDT (заморожено в P2P: ${frozenAmount.toFixed(2)} USDT)`);
    }

    if (!toAddress || toAddress.length < 30) {
      throw new Error("Неверный адрес получателя");
    }

    const feeEstimate = await tronHelper.estimateTransferFee(toAddress);
    const requiredTrx = feeEstimate.feeTrx;

    const trxBalance = await tronHelper.getTRXBalance(user.wallet_address);
    if (trxBalance < requiredTrx) {
      throw new Error(`Недостаточно TRX для комиссии. На балансе: ${trxBalance.toFixed(2)} TRX, нужно: ~${requiredTrx.toFixed(2)} TRX`);
    }

    const privateKey = CryptoHelper.decrypt(user.encrypted_private_key);
    const txHash = await tronHelper.transferUSDT(privateKey, toAddress, amount);

    console.log(`[Withdraw] User ${telegramId} withdrew ${amount} USDT to ${toAddress}, tx: ${txHash}`);

    return {
      txHash,
      fee: requiredTrx
    };
  }

  async getAvailableBalance(telegramId: string): Promise<{ balance: number; frozen: number; available: number; trxBalance: number }> {
    const user = await db.getUser(telegramId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    const balance = await tronHelper.getUSDTBalance(user.wallet_address);
    const trxBalance = await tronHelper.getTRXBalance(user.wallet_address);
    const frozen = await db.getUserFrozenAmount(telegramId);
    
    return {
      balance,
      frozen,
      available: Math.max(0, balance - frozen),
      trxBalance
    };
  }
}

export const userService = new UserService();
