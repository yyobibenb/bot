import { UserModel } from "../models/User";
import { BalanceModel } from "../models/Balance";
import { TransactionModel } from "../models/Transaction";

/**
 * CryptoBot API Service
 * Документация: https://help.crypt.bot/crypto-pay-api
 */
export class CryptoBotService {
  private apiKey: string;
  private apiUrl: string = "https://pay.crypt.bot/api";

  constructor() {
    this.apiKey = process.env.CRYPTOBOT_API_KEY || "";
    if (!this.apiKey) {
      console.warn("⚠️ CRYPTOBOT_API_KEY не установлен в .env");
    }
  }

  /**
   * Создать инвойс для пополнения
   */
  async createInvoice(
    userId: number,
    amount: number,
    currency: string = "USDT"
  ): Promise<{ success: boolean; invoice_url?: string; invoice_id?: number; error?: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/createInvoice`, {
        method: "POST",
        headers: {
          "Crypto-Pay-API-Token": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          asset: currency,
          amount: amount.toString(),
          description: `Пополнение баланса - User ${userId}`,
          paid_btn_name: "callback",
          paid_btn_url: process.env.WEB_APP_URL || "",
          payload: userId.toString(),
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        console.error("CryptoBot API error:", data);
        return { success: false, error: data.error?.message || "Failed to create invoice" };
      }

      return {
        success: true,
        invoice_url: data.result.pay_url,
        invoice_id: data.result.invoice_id,
      };
    } catch (error: any) {
      console.error("Error creating CryptoBot invoice:", error);
      return { success: false, error: error.message || "Failed to create invoice" };
    }
  }

  /**
   * Проверить статус инвойса
   */
  async getInvoice(invoiceId: number): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/getInvoices?invoice_ids=${invoiceId}`, {
        headers: {
          "Crypto-Pay-API-Token": this.apiKey,
        },
      });

      const data = await response.json();

      if (!data.ok) {
        console.error("CryptoBot API error:", data);
        return null;
      }

      return data.result.items[0] || null;
    } catch (error: any) {
      console.error("Error getting CryptoBot invoice:", error);
      return null;
    }
  }

  /**
   * Обработать оплату инвойса (вебхук)
   */
  async processPayment(invoiceData: any): Promise<{ success: boolean }> {
    try {
      const userId = parseInt(invoiceData.payload);
      const amount = parseFloat(invoiceData.amount);

      if (!userId || !amount) {
        console.error("Invalid invoice data:", invoiceData);
        return { success: false };
      }

      // Проверяем что инвойс оплачен
      if (invoiceData.status !== "paid") {
        return { success: false };
      }

      // Зачисляем на баланс
      await BalanceModel.addBalance(userId, amount);

      // Создаем транзакцию
      await TransactionModel.createTransaction(
        userId,
        "deposit",
        amount,
        "completed",
        invoiceData.hash
      );

      console.log(`✅ Пополнение обработано: User ${userId}, Amount ${amount} USDT`);

      return { success: true };
    } catch (error: any) {
      console.error("Error processing CryptoBot payment:", error);
      return { success: false };
    }
  }

  /**
   * Отправить средства (вывод)
   */
  async transfer(
    userId: number,
    toUserId: number,
    amount: number,
    currency: string = "USDT"
  ): Promise<{ success: boolean; transfer_id?: number; error?: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/transfer`, {
        method: "POST",
        headers: {
          "Crypto-Pay-API-Token": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: toUserId,
          asset: currency,
          amount: amount.toString(),
          spend_id: `withdrawal_${userId}_${Date.now()}`,
          comment: `Вывод средств от User ${userId}`,
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        console.error("CryptoBot transfer error:", data);
        return { success: false, error: data.error?.message || "Failed to transfer" };
      }

      return {
        success: true,
        transfer_id: data.result.transfer_id,
      };
    } catch (error: any) {
      console.error("Error making CryptoBot transfer:", error);
      return { success: false, error: error.message || "Failed to transfer" };
    }
  }

  /**
   * Получить информацию о приложении
   */
  async getMe(): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/getMe`, {
        headers: {
          "Crypto-Pay-API-Token": this.apiKey,
        },
      });

      const data = await response.json();

      if (!data.ok) {
        console.error("CryptoBot API error:", data);
        return null;
      }

      return data.result;
    } catch (error: any) {
      console.error("Error getting CryptoBot app info:", error);
      return null;
    }
  }
}

export default new CryptoBotService();
