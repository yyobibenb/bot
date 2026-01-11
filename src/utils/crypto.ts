import crypto from "crypto";

export class CryptoHelper {
  private static getEncryptionKey(): Buffer {
    if (!process.env.SESSION_SECRET) {
      throw new Error("SESSION_SECRET не установлен");
    }
    return crypto.scryptSync(process.env.SESSION_SECRET, "salt", 32);
  }

  static encrypt(text: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    return iv.toString("hex") + ":" + encrypted;
  }

  static decrypt(encryptedText: string): string {
    const key = this.getEncryptionKey();
    const parts = encryptedText.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  }

  static hashPin(pin: string): string {
    return crypto.createHash("sha256").update(pin).digest("hex");
  }

  static verifyPin(pin: string, hash: string): boolean {
    return this.hashPin(pin) === hash;
  }

  static generateRandomId(prefix: string = ""): string {
    return `${prefix}${crypto.randomBytes(16).toString("hex")}`;
  }

  static verifyTelegramWebAppData(initData: string, botToken: string, maxAge: number = 3600): boolean {
    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      const authDate = urlParams.get('auth_date');
      
      if (!hash || !authDate) {
        return false;
      }

      const authTimestamp = parseInt(authDate, 10);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      if (currentTimestamp - authTimestamp > maxAge) {
        console.warn('Telegram WebApp data is too old');
        return false;
      }

      urlParams.delete('hash');
      
      const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      return calculatedHash === hash;
    } catch (error) {
      console.error('Error verifying Telegram WebApp data:', error);
      return false;
    }
  }
}
