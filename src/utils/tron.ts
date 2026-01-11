import * as bip39 from "bip39";
import { createRequire } from "module";
import axios from "axios";

const require = createRequire(import.meta.url);
const { TronWeb } = require("tronweb");

export interface TronWallet {
  address: string;
  privateKey: string;
  seedPhrase: string;
}

export class TronHelper {
  private tronWeb: any;
  private usdtContractAddress: string;

  constructor() {
    this.tronWeb = new TronWeb({
      fullHost: "https://api.trongrid.io",
      headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY || "" },
    });

    this.usdtContractAddress = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
  }

  async createWallet(): Promise<TronWallet> {
    const seedPhrase = bip39.generateMnemonic();
    
    try {
      const account = await TronWeb.fromMnemonic(seedPhrase);
      
      return {
        address: account.address,
        privateKey: account.privateKey.replace(/^0x/, ''),
        seedPhrase: seedPhrase,
      };
    } catch (error) {
      console.log('[TronHelper] fromMnemonic failed, using createAccount with seed as reference');
      const account = await this.tronWeb.createAccount();
      
      return {
        address: account.address.base58,
        privateKey: account.privateKey,
        seedPhrase: seedPhrase,
      };
    }
  }

  async getUSDTBalance(address: string): Promise<number> {
    try {
      console.log(`[TronHelper] Getting USDT balance for address: ${address}`);
      
      const balance = await this.getUSDTBalanceFromTronScan(address);
      if (balance !== null) {
        console.log(`[TronHelper] TronScan balance: ${balance} USDT`);
        return balance;
      }
      
      console.log(`[TronHelper] TronScan failed, trying TronGrid contract call...`);
      return await this.getUSDTBalanceFromContract(address);
    } catch (error) {
      console.error("Ошибка при получении баланса USDT:", error);
      return 0;
    }
  }

  private async getUSDTBalanceFromTronScan(address: string): Promise<number | null> {
    try {
      console.log(`[TronHelper] Fetching from TronScan API: ${address}`);
      
      const response = await axios.get('https://apilist.tronscan.org/api/account', {
        params: {
          address: address,
          includeToken: true
        },
        headers: {
          'accept': 'application/json'
        },
        timeout: 10000
      });
      
      console.log(`[TronHelper] TronScan response status: ${response.status}`);
      
      const data = response.data;
      
      if (data.trc20token_balances && Array.isArray(data.trc20token_balances)) {
        console.log(`[TronHelper] Found ${data.trc20token_balances.length} TRC20 tokens`);
        
        const usdtToken = data.trc20token_balances.find(
          (token: any) => 
            token.tokenId === this.usdtContractAddress ||
            token.tokenAbbr === 'USDT' || 
            token.tokenName === 'Tether USD'
        );
        
        if (usdtToken) {
          const rawBalance = parseFloat(usdtToken.balance || '0');
          const decimals = usdtToken.tokenDecimal || 6;
          const balance = rawBalance / Math.pow(10, decimals);
          console.log(`[TronHelper] Found USDT: raw=${rawBalance}, decimals=${decimals}, balance=${balance}`);
          return balance;
        }
      }
      
      if (data.withPriceTokens && Array.isArray(data.withPriceTokens)) {
        const usdtToken = data.withPriceTokens.find(
          (token: any) => 
            token.tokenId === this.usdtContractAddress ||
            token.tokenAbbr === 'USDT'
        );
        
        if (usdtToken) {
          const balance = parseFloat(usdtToken.amount || '0');
          console.log(`[TronHelper] Found USDT in withPriceTokens: ${balance}`);
          return balance;
        }
      }
      
      console.log(`[TronHelper] No USDT found in TronScan, will try contract call`);
      return null;
    } catch (error: any) {
      console.error(`[TronHelper] TronScan API error:`, error.message);
      return null;
    }
  }

  private async getUSDTBalanceFromContract(address: string): Promise<number> {
    try {
      const contract = await this.tronWeb.contract().at(this.usdtContractAddress);
      const balance = await contract.balanceOf(address).call();
      
      console.log(`[TronHelper] Contract raw balance:`, balance, `Type: ${typeof balance}`);
      
      let balanceNumber: number;
      
      if (typeof balance === 'bigint') {
        balanceNumber = Number(balance) / 1e6;
      } else if (typeof balance === 'number') {
        balanceNumber = balance / 1e6;
      } else if (typeof balance === 'string') {
        balanceNumber = parseFloat(balance) / 1e6;
      } else if (balance && typeof balance === 'object') {
        if (balance._isBigNumber || balance.isBigNumber) {
          balanceNumber = parseFloat(balance.toString()) / 1e6;
        } else if (typeof balance.toNumber === 'function') {
          try {
            balanceNumber = balance.toNumber() / 1e6;
          } catch {
            balanceNumber = parseFloat(balance.toString()) / 1e6;
          }
        } else if (typeof balance.toString === 'function') {
          balanceNumber = parseFloat(balance.toString()) / 1e6;
        } else {
          console.error("[TronHelper] Unknown balance object:", JSON.stringify(balance));
          balanceNumber = 0;
        }
      } else {
        console.error("[TronHelper] Unknown balance type:", typeof balance);
        balanceNumber = 0;
      }
      
      console.log(`[TronHelper] Contract balance: ${balanceNumber} USDT`);
      return balanceNumber;
    } catch (error) {
      console.error("[TronHelper] Contract call error:", error);
      return 0;
    }
  }

  async getTRXBalance(address: string): Promise<number> {
    try {
      const balance = await this.tronWeb.trx.getBalance(address);
      return balance / 1e6;
    } catch (error) {
      console.error("Ошибка при получении баланса TRX:", error);
      return 0;
    }
  }

  async transferUSDT(
    privateKey: string,
    toAddress: string,
    amount: number,
  ): Promise<string> {
    try {
      this.tronWeb.setPrivateKey(privateKey);
      const contract = await this.tronWeb.contract().at(this.usdtContractAddress);
      const amountInSun = Math.floor(amount * 1e6);

      const tx = await contract.transfer(toAddress, amountInSun).send({
        feeLimit: 100_000_000,
        callValue: 0,
        shouldPollResponse: true,
      });

      return tx;
    } catch (error) {
      console.error("Ошибка при переводе USDT:", error);
      throw error;
    }
  }

  isValidAddress(address: string): boolean {
    return this.tronWeb.isAddress(address);
  }

  private energyPriceCache: { price: number; timestamp: number } | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  async getEnergyPriceFromTronGrid(): Promise<number> {
    try {
      // Check cache first
      if (this.energyPriceCache && Date.now() - this.energyPriceCache.timestamp < this.CACHE_DURATION) {
        console.log(`[TronHelper] Using cached energy price: ${this.energyPriceCache.price} TRX per energy`);
        return this.energyPriceCache.price;
      }

      console.log('[TronHelper] Fetching energy price from TronGrid...');
      const response = await axios.post('https://api.trongrid.io/wallet/getchainparameters', {}, {
        headers: {
          'Content-Type': 'application/json',
          'TRON-PRO-API-KEY': process.env.TRON_API_KEY || ''
        },
        timeout: 10000
      });
      
      if (response.data && response.data.chainParameter) {
        const params = response.data.chainParameter;
        const sunPerEnergy = params.find((p: any) => p.key === 'getEnergyFee');
        if (sunPerEnergy && sunPerEnergy.value) {
          const trxPerEnergy = sunPerEnergy.value / 1e6;
          console.log(`[TronHelper] Energy price from TronGrid: ${trxPerEnergy} TRX per energy (${sunPerEnergy.value} sun)`);
          
          // Cache the result
          this.energyPriceCache = { price: trxPerEnergy, timestamp: Date.now() };
          
          return trxPerEnergy;
        }
      }
      
      console.log('[TronHelper] Could not parse energy price from TronGrid response, using default');
      return 0.00042;
    } catch (error: any) {
      console.error('[TronHelper] Failed to get energy price from TronGrid:', error.message || error);
      return 0.00042;
    }
  }

  async estimateTransferFee(recipientAddress: string): Promise<{
    feeTrx: number;
    feeUsd: number;
    energyRequired: number;
    recipientHasUsdt: boolean;
    trxPriceUsd: number;
  }> {
    try {
      console.log(`[TronHelper] Estimating fee for transfer to: ${recipientAddress}`);
      
      const recipientUsdtBalance = await this.getUSDTBalance(recipientAddress);
      const recipientHasUsdt = recipientUsdtBalance > 0;
      
      const ENERGY_ACTIVE_WALLET = 65000;
      const ENERGY_EMPTY_WALLET = 130000;
      const energyRequired = recipientHasUsdt ? ENERGY_ACTIVE_WALLET : ENERGY_EMPTY_WALLET;
      
      const energyPrice = await this.getEnergyPriceFromTronGrid();
      
      const BANDWIDTH_COST = 0.35;
      
      const energyCost = energyRequired * energyPrice;
      const feeTrx = energyCost + BANDWIDTH_COST;
      
      const trxPriceUsd = await this.getTrxPriceUsd();
      const feeUsd = feeTrx * trxPriceUsd;
      
      console.log(`[TronHelper] Fee estimate: ${feeTrx.toFixed(2)} TRX ($${feeUsd.toFixed(2)}), recipient has USDT: ${recipientHasUsdt}, energy: ${energyRequired}, energyPrice: ${energyPrice}`);
      
      return {
        feeTrx: Math.round(feeTrx * 100) / 100,
        feeUsd: Math.round(feeUsd * 100) / 100,
        energyRequired,
        recipientHasUsdt,
        trxPriceUsd
      };
    } catch (error) {
      console.error('[TronHelper] Fee estimation error:', error);
      return {
        feeTrx: 28,
        feeUsd: 4.20,
        energyRequired: 65000,
        recipientHasUsdt: true,
        trxPriceUsd: 0.15
      };
    }
  }

  // Get current TRX price in USD from CoinGecko API
  async getTrxPriceUsd(): Promise<number> {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: 'tron',
          vs_currencies: 'usd'
        },
        timeout: 5000
      });
      
      const price = response.data?.tron?.usd || 0.15;
      console.log(`[TronHelper] Current TRX price: $${price}`);
      return price;
    } catch (error) {
      console.error('[TronHelper] Failed to get TRX price, using default:', error);
      return 0.15; // Default fallback price
    }
  }
}

export const tronHelper = new TronHelper();
