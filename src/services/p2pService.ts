import { db, P2POrder, P2PDeal, P2PMessage, P2PArbitration } from "../db/database";
import { tronHelper } from "../utils/tron";
import { CryptoHelper } from "../utils/crypto";

const DEFAULT_USDT_TRANSFER_FEE_TRX = 14; // Default fallback fee
const P2P_COMMISSION_PERCENT = 0.5;

export class P2PService {
  async createOrder(
    creatorTelegramId: string,
    orderType: "buy" | "sell",
    cryptoAmount: number,
    rate: number,
    paymentDetails: string,
    minAmount: number = 10,
    maxAmount?: number
  ): Promise<P2POrder> {
    console.log(`[P2P] Creating ${orderType} order for user ${creatorTelegramId}`);
    
    const creator = await db.getUser(creatorTelegramId);
    if (!creator) {
      throw new Error("Пользователь не зарегистрирован");
    }

    if (creator.is_blocked) {
      throw new Error("Ваш аккаунт заблокирован. Создание ордеров недоступно.");
    }

    if (!paymentDetails || paymentDetails.trim() === '') {
      throw new Error("Укажите реквизиты для получения рублей");
    }

    if (cryptoAmount < 10) {
      throw new Error("Минимальная сумма ордера: 10 USDT");
    }

    if (rate <= 0) {
      throw new Error("Курс должен быть больше 0");
    }

    const fiatAmount = cryptoAmount * rate;
    const orderId = CryptoHelper.generateRandomId("p2p_order_");

    const order = await db.createP2POrder({
      id: orderId,
      creator_telegram_id: creatorTelegramId,
      creator_username: creator.username,
      order_type: orderType,
      crypto_amount: cryptoAmount,
      fiat_amount: fiatAmount,
      rate: rate,
      min_amount: minAmount,
      max_amount: maxAmount || cryptoAmount,
      payment_details: paymentDetails,
      status: "active"
    });

    console.log(`[P2P] Order created: ${orderId}, type: ${orderType}, amount: ${cryptoAmount} USDT, rate: ${rate}`);
    return order;
  }

  async getActiveOrders(orderType?: "buy" | "sell"): Promise<any[]> {
    console.log(`[P2P] Getting active orders, type filter: ${orderType || 'all'}`);
    const orders = await db.getActiveP2POrders(orderType);
    
    const ordersWithStats = await Promise.all(orders.map(async (order) => {
      const stats = await db.getP2PStats(order.creator_telegram_id);
      const isSell = order.order_type === 'sell';
      
      return {
        ...order,
        creator_success_rate: isSell ? stats.sellSuccessRate : stats.buySuccessRate,
        creator_volume: isSell ? stats.sellVolume : stats.buyVolume,
        creator_completed: isSell ? stats.sellCompleted : stats.buyCompleted
      };
    }));
    
    return ordersWithStats;
  }

  async getUserOrders(telegramId: string): Promise<P2POrder[]> {
    console.log(`[P2P] Getting orders for user ${telegramId}`);
    return await db.getUserP2POrders(telegramId);
  }

  async cancelOrder(orderId: string, telegramId: string): Promise<void> {
    console.log(`[P2P] Cancelling order ${orderId} by user ${telegramId}`);
    
    const order = await db.getP2POrder(orderId);
    if (!order) {
      throw new Error("Ордер не найден");
    }

    if (order.creator_telegram_id !== telegramId) {
      throw new Error("Вы не можете отменить чужой ордер");
    }

    if (order.status !== "active" && order.status !== "paused") {
      throw new Error("Ордер нельзя отменить в текущем статусе");
    }

    const activeDeals = await db.getActiveP2PDealsForOrder(orderId);
    if (activeDeals.length > 0) {
      throw new Error("Есть активные сделки по этому ордеру. Сначала завершите их.");
    }

    await db.updateP2POrderStatus(orderId, "cancelled");
    console.log(`[P2P] Order ${orderId} cancelled`);
  }

  async startDeal(
    orderId: string,
    takerTelegramId: string,
    amount?: number
  ): Promise<{ deal: P2PDeal; walletAddress: string }> {
    console.log(`[P2P] Starting deal for order ${orderId} by user ${takerTelegramId}`);
    
    const order = await db.getP2POrder(orderId);
    if (!order) {
      throw new Error("Ордер не найден");
    }

    if (order.status !== "active") {
      throw new Error("Ордер не активен");
    }

    if (order.creator_telegram_id === takerTelegramId) {
      throw new Error("Нельзя открыть сделку по своему ордеру");
    }

    const taker = await db.getUser(takerTelegramId);
    if (!taker) {
      throw new Error("Вы не зарегистрированы в боте");
    }

    if (taker.is_blocked) {
      throw new Error("Ваш аккаунт заблокирован. Открытие сделок недоступно.");
    }

    const cryptoAmount = amount || order.crypto_amount;
    if (cryptoAmount < order.min_amount) {
      throw new Error(`Минимальная сумма: ${order.min_amount} USDT`);
    }
    if (cryptoAmount > order.max_amount) {
      throw new Error(`Максимальная сумма: ${order.max_amount} USDT`);
    }

    const dealId = CryptoHelper.generateRandomId("p2p_deal_");
    const fiatAmount = cryptoAmount * order.rate;

    let sellerTelegramId: string;
    let sellerUsername: string;
    let buyerTelegramId: string;
    let buyerUsername: string;
    let sellerWalletAddress: string;

    if (order.order_type === "sell") {
      sellerTelegramId = order.creator_telegram_id;
      sellerUsername = order.creator_username;
      buyerTelegramId = takerTelegramId;
      buyerUsername = taker.username;
      const seller = await db.getUser(sellerTelegramId);
      if (!seller) throw new Error("Продавец не найден");
      sellerWalletAddress = seller.wallet_address;
    } else {
      buyerTelegramId = order.creator_telegram_id;
      buyerUsername = order.creator_username;
      sellerTelegramId = takerTelegramId;
      sellerUsername = taker.username;
      sellerWalletAddress = taker.wallet_address;
    }

    const seller = await db.getUser(sellerTelegramId);
    if (!seller) throw new Error("Продавец не найден");

    const sellerBalance = await tronHelper.getUSDTBalance(seller.wallet_address);
    const frozenAmount = await db.getUserFrozenAmount(sellerTelegramId);
    const availableBalance = sellerBalance - frozenAmount;

    if (availableBalance < cryptoAmount) {
      throw new Error(`У продавца недостаточно средств. Доступно: ${availableBalance.toFixed(2)} USDT (заморожено: ${frozenAmount.toFixed(2)} USDT)`);
    }

    await db.freezeUserFunds(sellerTelegramId, cryptoAmount);
    console.log(`[P2P] Frozen ${cryptoAmount} USDT for seller ${sellerTelegramId}`);

    const deal = await db.createP2PDeal({
      id: dealId,
      order_id: orderId,
      seller_telegram_id: sellerTelegramId,
      seller_username: sellerUsername,
      buyer_telegram_id: buyerTelegramId,
      buyer_username: buyerUsername,
      crypto_amount: cryptoAmount,
      fiat_amount: fiatAmount,
      rate: order.rate,
      payment_details: order.payment_details,
      deal_wallet_address: sellerWalletAddress,
      encrypted_deal_private_key: "",
      encrypted_deal_seed: "",
      status: "crypto_deposited",
      crypto_tx_hash: null,
      payment_proof_image: null
    });

    console.log(`[P2P] Deal created: ${dealId}, seller: ${sellerUsername}, buyer: ${buyerUsername}, amount: ${cryptoAmount} USDT (frozen on seller wallet)`);

    return {
      deal,
      walletAddress: sellerWalletAddress
    };
  }

  async depositCrypto(
    dealId: string,
    sellerTelegramId: string,
    pin: string
  ): Promise<{ txHash: string; fee: number }> {
    console.log(`[P2P] Depositing crypto for deal ${dealId}`);
    
    const deal = await db.getP2PDeal(dealId);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    if (deal.seller_telegram_id !== sellerTelegramId) {
      throw new Error("Только продавец может отправить криптовалюту");
    }

    if (deal.status !== "created") {
      throw new Error("Криптовалюта уже отправлена или сделка в неверном статусе");
    }

    const seller = await db.getUser(sellerTelegramId);
    if (!seller) {
      throw new Error("Пользователь не найден");
    }

    if (!CryptoHelper.verifyPin(pin, seller.pin_hash)) {
      throw new Error("Неверный PIN-код");
    }

    const sellerBalance = await tronHelper.getUSDTBalance(seller.wallet_address);
    if (sellerBalance < deal.crypto_amount) {
      throw new Error(`Недостаточно USDT. На балансе: ${sellerBalance.toFixed(2)}, нужно: ${deal.crypto_amount}`);
    }

    const trxBalance = await tronHelper.getTRXBalance(seller.wallet_address);
    if (trxBalance < USDT_TRANSFER_FEE_TRX) {
      throw new Error(`Недостаточно TRX для комиссии. На балансе: ${trxBalance.toFixed(2)} TRX, нужно: ~${USDT_TRANSFER_FEE_TRX} TRX`);
    }

    const privateKey = CryptoHelper.decrypt(seller.encrypted_private_key);
    const txHash = await tronHelper.transferUSDT(
      privateKey,
      deal.deal_wallet_address,
      deal.crypto_amount
    );

    await db.updateP2PDealStatus(dealId, "crypto_deposited", txHash);
    console.log(`[P2P] Crypto deposited for deal ${dealId}, tx: ${txHash}`);

    return {
      txHash,
      fee: USDT_TRANSFER_FEE_TRX
    };
  }

  async getEstimatedFee(telegramId: string, recipientAddress?: string): Promise<{ 
    feeTrx: number; 
    feeUsd: number;
    hasSufficientTrx: boolean; 
    trxBalance: number;
    recipientHasUsdt: boolean;
  }> {
    console.log(`[P2P] Getting estimated fee for user ${telegramId}`);
    
    const user = await db.getUser(telegramId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    const trxBalance = await tronHelper.getTRXBalance(user.wallet_address);
    
    // Use dynamic fee calculation if recipient address is provided
    if (recipientAddress) {
      try {
        const feeEstimate = await tronHelper.estimateTransferFee(recipientAddress);
        return {
          feeTrx: feeEstimate.feeTrx,
          feeUsd: feeEstimate.feeUsd,
          hasSufficientTrx: trxBalance >= feeEstimate.feeTrx,
          trxBalance: trxBalance,
          recipientHasUsdt: feeEstimate.recipientHasUsdt
        };
      } catch (error) {
        console.error(`[P2P] Dynamic fee estimation failed, using default:`, error);
      }
    }
    
    // Fallback to default fee
    return {
      feeTrx: DEFAULT_USDT_TRANSFER_FEE_TRX,
      feeUsd: DEFAULT_USDT_TRANSFER_FEE_TRX * 0.15,
      hasSufficientTrx: trxBalance >= DEFAULT_USDT_TRANSFER_FEE_TRX,
      trxBalance: trxBalance,
      recipientHasUsdt: true
    };
  }

  async markFiatSent(dealId: string, buyerTelegramId: string): Promise<void> {
    console.log(`[P2P] Marking fiat sent for deal ${dealId}`);
    
    const deal = await db.getP2PDeal(dealId);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    if (deal.buyer_telegram_id !== buyerTelegramId) {
      throw new Error("Только покупатель может отметить отправку рублей");
    }

    if (deal.status !== "crypto_deposited") {
      throw new Error("Сначала продавец должен отправить криптовалюту на эскроу");
    }

    await db.updateP2PDealStatus(dealId, "fiat_sent");
    console.log(`[P2P] Fiat marked as sent for deal ${dealId}`);
  }

  async confirmFiatReceived(dealId: string, sellerTelegramId: string, pin: string): Promise<{ txHash: string; buyerAddress: string }> {
    console.log(`[P2P] Confirming fiat received for deal ${dealId}`);
    
    const deal = await db.getP2PDeal(dealId);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    if (deal.seller_telegram_id !== sellerTelegramId) {
      throw new Error("Только продавец может подтвердить получение рублей");
    }

    if (deal.status !== "fiat_sent") {
      throw new Error("Покупатель ещё не отметил отправку рублей");
    }

    const seller = await db.getUser(sellerTelegramId);
    if (!seller) {
      throw new Error("Продавец не найден");
    }

    if (!CryptoHelper.verifyPin(pin, seller.pin_hash)) {
      throw new Error("Неверный PIN-код");
    }

    const buyer = await db.getUser(deal.buyer_telegram_id);
    if (!buyer) {
      throw new Error("Покупатель не найден");
    }

    const trxBalance = await tronHelper.getTRXBalance(seller.wallet_address);
    if (trxBalance < USDT_TRANSFER_FEE_TRX) {
      throw new Error(`Недостаточно TRX для комиссии. На балансе: ${trxBalance.toFixed(2)} TRX, нужно: ~${USDT_TRANSFER_FEE_TRX} TRX`);
    }

    const privateKey = CryptoHelper.decrypt(seller.encrypted_private_key);
    
    console.log(`[P2P] Transferring ${deal.crypto_amount} USDT from seller ${seller.wallet_address} to buyer ${buyer.wallet_address}`);
    
    const txHash = await tronHelper.transferUSDT(
      privateKey,
      buyer.wallet_address,
      deal.crypto_amount
    );

    await db.unfreezeUserFunds(sellerTelegramId, deal.crypto_amount);
    await db.updateP2PDealStatus(dealId, "completed", txHash);
    
    console.log(`[P2P] Deal ${dealId} completed! USDT transferred to buyer. TX: ${txHash}`);

    return {
      txHash,
      buyerAddress: buyer.wallet_address
    };
  }

  async completeDeal(dealId: string, buyerTelegramId: string): Promise<{ txHash: string; message: string }> {
    console.log(`[P2P] Getting deal status ${dealId}`);
    
    const deal = await db.getP2PDeal(dealId);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    if (deal.buyer_telegram_id !== buyerTelegramId) {
      throw new Error("Только покупатель может проверить статус сделки");
    }

    if (deal.status !== "completed") {
      throw new Error("Сделка ещё не завершена. Дождитесь подтверждения от продавца.");
    }

    console.log(`[P2P] Deal ${dealId} is completed, USDT already transferred to buyer`);

    return {
      txHash: deal.crypto_tx_hash || "",
      message: "USDT успешно переведены на ваш кошелёк!"
    };
  }

  async cancelDeal(dealId: string, telegramId: string): Promise<void> {
    console.log(`[P2P] Cancelling deal ${dealId} by user ${telegramId}`);
    
    const deal = await db.getP2PDeal(dealId);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    if (deal.seller_telegram_id !== telegramId && deal.buyer_telegram_id !== telegramId) {
      throw new Error("Вы не участник этой сделки");
    }

    if (deal.status === "completed" || deal.status === "cancelled") {
      throw new Error("Сделка уже завершена или отменена");
    }

    if (deal.status !== "created" && deal.status !== "crypto_deposited") {
      throw new Error("Нельзя отменить сделку после отправки рублей. Обратитесь в арбитраж.");
    }

    await db.unfreezeUserFunds(deal.seller_telegram_id, deal.crypto_amount);
    await db.updateP2PDealStatus(dealId, "cancelled");
    console.log(`[P2P] Deal ${dealId} cancelled, ${deal.crypto_amount} USDT unfrozen for seller`);
  }

  async getDeal(dealId: string): Promise<P2PDeal | null> {
    return await db.getP2PDeal(dealId);
  }

  async getUserDeals(telegramId: string): Promise<P2PDeal[]> {
    return await db.getUserP2PDeals(telegramId);
  }

  async getDealBalance(dealId: string): Promise<{ usdtBalance: number; trxBalance: number }> {
    const deal = await db.getP2PDeal(dealId);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    const usdtBalance = await tronHelper.getUSDTBalance(deal.deal_wallet_address);
    const trxBalance = await tronHelper.getTRXBalance(deal.deal_wallet_address);

    return { usdtBalance, trxBalance };
  }

  async sendMessage(dealId: string, senderTelegramId: string, message: string): Promise<P2PMessage> {
    console.log(`[P2P] Sending message in deal ${dealId}`);
    
    const deal = await db.getP2PDeal(dealId);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    if (deal.seller_telegram_id !== senderTelegramId && deal.buyer_telegram_id !== senderTelegramId) {
      throw new Error("Вы не участник этой сделки");
    }

    if (deal.status === "completed" || deal.status === "cancelled") {
      throw new Error("Сделка завершена, чат закрыт");
    }

    const sender = await db.getUser(senderTelegramId);
    if (!sender) {
      throw new Error("Пользователь не найден");
    }

    const p2pMessage = await db.createP2PMessage({
      deal_id: dealId,
      sender_telegram_id: senderTelegramId,
      sender_username: sender.username,
      message: message.trim()
    });

    console.log(`[P2P] Message sent in deal ${dealId} by ${sender.username}`);
    return p2pMessage;
  }

  async getMessages(dealId: string, telegramId: string): Promise<P2PMessage[]> {
    const deal = await db.getP2PDeal(dealId);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    if (deal.seller_telegram_id !== telegramId && deal.buyer_telegram_id !== telegramId) {
      throw new Error("Вы не участник этой сделки");
    }

    return await db.getP2PMessages(dealId);
  }

  async updatePaymentDetails(telegramId: string, paymentDetails: string): Promise<void> {
    console.log(`[P2P] Updating payment details for user ${telegramId}`);
    
    const user = await db.getUser(telegramId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    await db.updateUserPaymentDetails(telegramId, paymentDetails);
    console.log(`[P2P] Payment details updated for user ${telegramId}`);
  }

  async getPaymentDetails(telegramId: string): Promise<string | null> {
    return await db.getUserPaymentDetails(telegramId);
  }

  async getOrder(orderId: string): Promise<P2POrder | null> {
    return await db.getP2POrder(orderId);
  }

  async requestArbitration(
    dealId: string,
    telegramId: string,
    message: string
  ): Promise<P2PArbitration> {
    console.log(`[P2P] Requesting arbitration for deal ${dealId} by user ${telegramId}`);
    
    const deal = await db.getP2PDeal(dealId);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    if (deal.seller_telegram_id !== telegramId && deal.buyer_telegram_id !== telegramId) {
      throw new Error("Вы не участник этой сделки");
    }

    if (deal.status === "completed" || deal.status === "cancelled") {
      throw new Error("Сделка уже завершена или отменена");
    }

    const existingArbitration = await db.getP2PArbitration(dealId);
    if (existingArbitration && existingArbitration.status !== "resolved" && existingArbitration.status !== "cancelled") {
      throw new Error("Арбитраж по этой сделке уже открыт");
    }

    await db.updateP2PDealStatus(dealId, "disputed");

    const arbitration = await db.createP2PArbitration({
      deal_id: dealId,
      requested_by: telegramId,
      request_message: message,
      status: "pending",
      assigned_to: null,
      resolution: null,
      resolution_notes: null
    });

    console.log(`[P2P] Arbitration created: ${arbitration.id} for deal ${dealId}`);
    return arbitration;
  }

  async getArbitration(dealId: string): Promise<P2PArbitration | null> {
    return await db.getP2PArbitration(dealId);
  }

  async getPendingArbitrations(): Promise<(P2PArbitration & { deal: P2PDeal })[]> {
    return await db.getPendingP2PArbitrations();
  }

  async assignArbitration(arbitrationId: number, arbitratorId: string): Promise<void> {
    console.log(`[P2P] Assigning arbitration ${arbitrationId} to ${arbitratorId}`);
    
    const isArbitrator = await db.isArbitrator(arbitratorId);
    if (!isArbitrator) {
      throw new Error("У вас нет прав арбитратора");
    }

    const arbitration = await db.getP2PArbitrationById(arbitrationId);
    if (!arbitration) {
      throw new Error("Арбитраж не найден");
    }

    if (arbitration.status !== "pending") {
      throw new Error("Арбитраж уже назначен или завершён");
    }

    await db.assignP2PArbitration(arbitrationId, arbitratorId);
    console.log(`[P2P] Arbitration ${arbitrationId} assigned to ${arbitratorId}`);
  }

  async resolveArbitration(
    arbitrationId: number,
    arbitratorId: string,
    resolution: "seller" | "buyer" | "split",
    notes: string,
    pin: string
  ): Promise<{ txHash?: string }> {
    console.log(`[P2P] Resolving arbitration ${arbitrationId} by ${arbitratorId}`);
    
    const isArbitrator = await db.isArbitrator(arbitratorId);
    if (!isArbitrator) {
      throw new Error("У вас нет прав арбитратора");
    }

    const arbitration = await db.getP2PArbitrationById(arbitrationId);
    if (!arbitration) {
      throw new Error("Арбитраж не найден");
    }

    if (arbitration.status === "resolved") {
      throw new Error("Арбитраж уже разрешён");
    }

    const deal = await db.getP2PDeal(arbitration.deal_id);
    if (!deal) {
      throw new Error("Сделка не найдена");
    }

    const seller = await db.getUser(deal.seller_telegram_id);
    if (!seller) {
      throw new Error("Продавец не найден");
    }

    const buyer = await db.getUser(deal.buyer_telegram_id);
    if (!buyer) {
      throw new Error("Покупатель не найден");
    }

    let txHash: string | undefined;

    if (resolution === "buyer") {
      const arbitrator = await db.getUser(arbitratorId);
      if (!arbitrator) {
        throw new Error("Арбитратор не найден");
      }
      if (!CryptoHelper.verifyPin(pin, arbitrator.pin_hash)) {
        throw new Error("Неверный PIN-код");
      }

      const privateKey = CryptoHelper.decrypt(seller.encrypted_private_key);
      txHash = await tronHelper.transferUSDT(
        privateKey,
        buyer.wallet_address,
        deal.crypto_amount
      );
      console.log(`[P2P] Arbitration resolved: USDT sent to buyer. TX: ${txHash}`);
    }

    await db.unfreezeUserFunds(deal.seller_telegram_id, deal.crypto_amount);
    await db.resolveP2PArbitration(arbitrationId, resolution, notes);
    
    const finalStatus = resolution === "buyer" ? "completed" : "cancelled";
    await db.updateP2PDealStatus(arbitration.deal_id, finalStatus, txHash || null);

    console.log(`[P2P] Arbitration ${arbitrationId} resolved: ${resolution}`);
    return { txHash };
  }
}

export const p2pService = new P2PService();
