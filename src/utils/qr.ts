import QRCode from "qrcode";

export class QRHelper {
  static async generatePaymentQR(address: string, amount: number): Promise<string> {
    const paymentData = `tron:${address}?amount=${amount}&token=USDT`;
    
    const qrDataUrl = await QRCode.toDataURL(paymentData, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 300,
      margin: 2,
    });

    return qrDataUrl;
  }

  static async generateAddressQR(address: string): Promise<string> {
    const qrDataUrl = await QRCode.toDataURL(address, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 300,
      margin: 2,
    });

    return qrDataUrl;
  }
}
