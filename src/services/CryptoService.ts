import TronWeb from "tronweb";
import { UserModel } from "../models/User";
import { BalanceModel } from "../models/Balance";
import { TransactionModel } from "../models/Transaction";

// USDT TRC20 Contract Address
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export class CryptoService {
  private tronWeb: TronWeb;
  private masterWallet: string;

  constructor() {
    const fullHost = "https://api.trongrid.io";
    const privateKey = process.env.TRON_PRIVATE_KEY || "";

    this.tronWeb = new TronWeb({
      fullHost,
      privateKey,
    });

    // Мастер-кошелек для сбора средств
    this.masterWallet = process.env.TRON_MASTER_WALLET || "";
  }

  /**
   * Генерация уникального адреса для пользователя
   */
  async generateDepositAddress(userId: number): Promise<string> {
    try {
      // Генерируем новый кошелек
      const account = await this.tronWeb.createAccount();

      // Сохраняем в базу
      await UserModel.updateDepositAddress(userId, account.address.base58, account.privateKey);

      return account.address.base58;
    } catch (error) {
      console.error("Error generating deposit address:", error);
      throw new Error("Failed to generate deposit address");
    }
  }

  /**
   * Получить адрес для пополнения пользователя
   */
  async getDepositAddress(userId: number): Promise<string> {
    const user = await UserModel.getUserById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Если адрес уже есть, возвращаем его
    if (user.deposit_address) {
      return user.deposit_address;
    }

    // Иначе генерируем новый
    return await this.generateDepositAddress(userId);
  }

  /**
   * Проверка баланса USDT на адресе
   */
  async checkUSDTBalance(address: string): Promise<number> {
    try {
      const contract = await this.tronWeb.contract().at(USDT_CONTRACT);
      const balance = await contract.balanceOf(address).call();

      // USDT has 6 decimals
      return Number(balance) / 1e6;
    } catch (error) {
      console.error("Error checking USDT balance:", error);
      return 0;
    }
  }

  /**
   * Проверка TRX баланса (для оплаты комиссий)
   */
  async checkTRXBalance(address: string): Promise<number> {
    try {
      const balance = await this.tronWeb.trx.getBalance(address);
      return balance / 1e6; // Convert from SUN to TRX
    } catch (error) {
      console.error("Error checking TRX balance:", error);
      return 0;
    }
  }

  /**
   * Перевод USDT с адреса пользователя на мастер-кошелек
   */
  async sweepUSDT(userId: number, amount: number): Promise<string> {
    try {
      const user = await UserModel.getUserById(userId);
      if (!user || !user.deposit_address || !user.deposit_private_key) {
        throw new Error("User deposit address not found");
      }

      // Создаем временный TronWeb с ключом пользователя
      const userTronWeb = new TronWeb({
        fullHost: "https://api.trongrid.io",
        privateKey: user.deposit_private_key,
      });

      const contract = await userTronWeb.contract().at(USDT_CONTRACT);

      // Переводим USDT (amount in USDT, contract expects 6 decimals)
      const tx = await contract.transfer(
        this.masterWallet,
        Math.floor(amount * 1e6)
      ).send();

      return tx;
    } catch (error) {
      console.error("Error sweeping USDT:", error);
      throw new Error("Failed to sweep USDT");
    }
  }

  /**
   * Проверка новых депозитов для пользователя
   */
  async checkDeposit(userId: number): Promise<{ found: boolean; amount: number }> {
    try {
      const user = await UserModel.getUserById(userId);
      if (!user || !user.deposit_address) {
        return { found: false, amount: 0 };
      }

      const balance = await this.checkUSDTBalance(user.deposit_address);

      if (balance > 0) {
        return { found: true, amount: balance };
      }

      return { found: false, amount: 0 };
    } catch (error) {
      console.error("Error checking deposit:", error);
      return { found: false, amount: 0 };
    }
  }

  /**
   * Обработка депозита - зачисление на баланс
   */
  async processDeposit(userId: number): Promise<{ success: boolean; amount: number }> {
    try {
      const depositCheck = await this.checkDeposit(userId);

      if (!depositCheck.found || depositCheck.amount === 0) {
        return { success: false, amount: 0 };
      }

      const amount = depositCheck.amount;

      // Проверяем есть ли TRX для комиссии (минимум 5 TRX)
      const user = await UserModel.getUserById(userId);
      if (!user || !user.deposit_address) {
        return { success: false, amount: 0 };
      }

      const trxBalance = await this.checkTRXBalance(user.deposit_address);
      if (trxBalance < 5) {
        // Отправляем TRX для комиссии с мастер-кошелька
        await this.sendTRXForFee(user.deposit_address, 10);

        // Ждем подтверждения
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Переводим USDT на мастер-кошелек
      await this.sweepUSDT(userId, amount);

      // Зачисляем на баланс пользователя
      await BalanceModel.addBalance(userId, amount);

      // Создаем запись о транзакции
      await TransactionModel.createTransaction(
        userId,
        "deposit",
        amount,
        "completed",
        user.deposit_address
      );

      return { success: true, amount };
    } catch (error) {
      console.error("Error processing deposit:", error);
      return { success: false, amount: 0 };
    }
  }

  /**
   * Отправка TRX для оплаты комиссий
   */
  async sendTRXForFee(toAddress: string, amount: number): Promise<string> {
    try {
      const tx = await this.tronWeb.trx.sendTransaction(
        toAddress,
        Math.floor(amount * 1e6) // Convert TRX to SUN
      );
      return tx.txid;
    } catch (error) {
      console.error("Error sending TRX for fee:", error);
      throw new Error("Failed to send TRX");
    }
  }

  /**
   * Вывод USDT пользователю
   */
  async withdrawUSDT(
    userId: number,
    toAddress: string,
    amount: number
  ): Promise<{ success: boolean; txid?: string; error?: string }> {
    try {
      // Проверяем баланс пользователя
      const balance = await BalanceModel.getBalance(userId);
      if (!balance || balance.balance < amount) {
        return { success: false, error: "Insufficient balance" };
      }

      // Проверяем минимальную сумму вывода
      const minWithdrawal = 10; // $10 minimum
      if (amount < minWithdrawal) {
        return { success: false, error: `Minimum withdrawal is ${minWithdrawal} USDT` };
      }

      // Создаем заявку на вывод (статус pending)
      const transaction = await TransactionModel.createTransaction(
        userId,
        "withdrawal",
        amount,
        "pending",
        toAddress
      );

      // Если сумма >= $10, требуется модерация
      if (amount >= 10) {
        return {
          success: true,
          error: "Withdrawal request created. Waiting for moderation.",
        };
      }

      // Иначе выводим автоматически
      const contract = await this.tronWeb.contract().at(USDT_CONTRACT);
      const tx = await contract.transfer(
        toAddress,
        Math.floor(amount * 1e6)
      ).send();

      // Обновляем статус транзакции
      await TransactionModel.updateTransactionStatus(transaction.id, "completed", tx);

      // Вычитаем с баланса
      await BalanceModel.subtractBalance(userId, amount);

      return { success: true, txid: tx };
    } catch (error: any) {
      console.error("Error withdrawing USDT:", error);
      return { success: false, error: error.message || "Failed to withdraw" };
    }
  }

  /**
   * Одобрение вывода модератором
   */
  async approveWithdrawal(
    transactionId: number,
    moderatorId: number
  ): Promise<{ success: boolean; txid?: string; error?: string }> {
    try {
      const transaction = await TransactionModel.getTransactionById(transactionId);

      if (!transaction || transaction.type !== "withdrawal") {
        return { success: false, error: "Transaction not found" };
      }

      if (transaction.status !== "pending") {
        return { success: false, error: "Transaction already processed" };
      }

      // Выполняем вывод
      const contract = await this.tronWeb.contract().at(USDT_CONTRACT);
      const tx = await contract.transfer(
        transaction.crypto_address,
        Math.floor(transaction.amount * 1e6)
      ).send();

      // Обновляем транзакцию
      await TransactionModel.updateTransactionStatus(
        transactionId,
        "completed",
        tx,
        moderatorId
      );

      // Вычитаем с баланса пользователя
      await BalanceModel.subtractBalance(transaction.user_id, transaction.amount);

      return { success: true, txid: tx };
    } catch (error: any) {
      console.error("Error approving withdrawal:", error);
      return { success: false, error: error.message || "Failed to approve" };
    }
  }

  /**
   * Отклонение вывода модератором
   */
  async rejectWithdrawal(
    transactionId: number,
    moderatorId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const transaction = await TransactionModel.getTransactionById(transactionId);

      if (!transaction || transaction.type !== "withdrawal") {
        return { success: false, error: "Transaction not found" };
      }

      if (transaction.status !== "pending") {
        return { success: false, error: "Transaction already processed" };
      }

      // Обновляем статус
      await TransactionModel.updateTransactionStatus(
        transactionId,
        "rejected",
        undefined,
        moderatorId
      );

      return { success: true };
    } catch (error: any) {
      console.error("Error rejecting withdrawal:", error);
      return { success: false, error: error.message || "Failed to reject" };
    }
  }

  /**
   * Получить список ожидающих выводов
   */
  async getPendingWithdrawals(): Promise<any[]> {
    try {
      return await TransactionModel.getPendingWithdrawals();
    } catch (error) {
      console.error("Error getting pending withdrawals:", error);
      return [];
    }
  }
}

export default new CryptoService();
