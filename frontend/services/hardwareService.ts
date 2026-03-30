
import { Sale, CompanyConfig } from '../types';
import { buildPosReceiptDoc } from './receiptCalculationService';

// ESC/POS Command Constants
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const COMMANDS = {
  INIT: [ESC, 0x40],
  ALIGN_LEFT: [ESC, 0x61, 0],
  ALIGN_CENTER: [ESC, 0x61, 1],
  ALIGN_RIGHT: [ESC, 0x61, 2],
  BOLD_ON: [ESC, 0x45, 1],
  BOLD_OFF: [ESC, 0x45, 0],
  TEXT_NORMAL: [GS, 0x21, 0x00],
  TEXT_DOUBLE: [GS, 0x21, 0x11],
  CUT_FULL: [GS, 0x56, 0x00],
  CUT_PARTIAL: [GS, 0x56, 0x01],
  FEED_LINES: (n: number) => [ESC, 0x64, n],
};

class HardwareService {
  private device: any = null;
  private interfaceNumber: number = 0;
  private endpointOut: number = 0;
  private isConnectedState: boolean = false;

  constructor() {
    // Try to restore connection if possible (browser specific limitation often prevents auto-reconnect without gesture)
  }

  public isConnected(): boolean {
    return this.isConnectedState && !!this.device;
  }

  public getDeviceName(): string {
    return this.device ? this.device.productName || 'Unknown Device' : 'None';
  }

  public async connect() {
    if (!('usb' in navigator)) {
      console.warn("WebUSB is not supported in this browser. Please use Chrome, Edge, or Opera.");
      return false;
    }

    try {
      // Request device - this prompts the browser permission dialog
      // Filters empty to show all devices, or add vendorId for specific printers (e.g. Epson: 0x04b8)
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      await this.setupDevice(device);
      return true;
    } catch (error: any) {
      console.error("USB Connection Failed:", error);
      if (error.name === 'SecurityError' || error.message.includes('permissions policy')) {
          console.warn("USB access blocked by Permissions Policy. Ensure the environment allows 'usb'.");
      }
      return false;
    }
  }

  public async disconnect() {
    if (this.device) {
      await this.device.close();
      this.device = null;
      this.isConnectedState = false;
    }
  }

  private async setupDevice(device: any) {
    await device.open();
    
    // Find the printer interface (usually class 7)
    let interfaceFound = false;
    
    if (device.configuration === null) {
        await device.selectConfiguration(1);
    }

    for (const element of device.configuration.interfaces) {
      const alt = element.alternates[0];
      if (alt.interfaceClass === 7) { // Printer Class
        this.interfaceNumber = element.interfaceNumber;
        
        // Find OUT endpoint
        for (const endpoint of alt.endpoints) {
          if (endpoint.direction === 'out') {
            this.endpointOut = endpoint.endpointNumber;
            interfaceFound = true;
            break;
          }
        }
      }
      if (interfaceFound) break;
    }

    if (!interfaceFound) {
        // Fallback: Try first interface with an OUT endpoint if standard printer class not found
        // Many generic Chinese thermal printers use vendor-specific classes
        const alt = device.configuration.interfaces[0].alternates[0];
        this.interfaceNumber = device.configuration.interfaces[0].interfaceNumber;
        for (const endpoint of alt.endpoints) {
            if (endpoint.direction === 'out') {
                this.endpointOut = endpoint.endpointNumber;
                interfaceFound = true;
                break;
            }
        }
    }

    if (!interfaceFound) {
        await device.close();
        throw new Error("Could not find a valid printer output endpoint.");
    }

    await device.claimInterface(this.interfaceNumber);
    this.device = device;
    this.isConnectedState = true;
  }

  public async printPosReceipt(receipt: {
    receiptNumber: string;
    date: string;
    cashierName: string;
    customerName?: string;
    items: { desc: string; qty: number; price: number; total: number }[];
    subtotal: number;
    discount: number;
    tax: number;
    totalAmount: number;
    paymentMethod: string;
    amountTendered: number;
    changeGiven: number;
    payments?: { method: string; amount: number; accountId?: string }[];
    footerMessage?: string;
  }, config: CompanyConfig) {
    if (!this.isConnected()) return;

    const encoder = new TextEncoder();
    const data: number[] = [];

    const add = (bytes: number[]) => data.push(...bytes);
    const text = (str: string) => {
        // Sanitize non-ascii if needed or use encoding library. 
        // For simplicity, we assume basic ASCII/UTF-8 support in modern printers.
        const bytes = encoder.encode(str);
        bytes.forEach(b => data.push(b));
    };
    const line = (str: string) => { text(str); add([LF]); };

    // --- Build Receipt ---
    
    // Init
    add(COMMANDS.INIT);

    // Header
    add(COMMANDS.ALIGN_CENTER);
    add(COMMANDS.BOLD_ON);
    add(COMMANDS.TEXT_DOUBLE); // Larger text for Company Name
    line(config.companyName);
    add(COMMANDS.TEXT_NORMAL);
    add(COMMANDS.BOLD_OFF);
    
    if (config.addressLine1) line(config.addressLine1);
    if (config.phone) line(`Tel: ${config.phone}`);
    add(COMMANDS.FEED_LINES(1));

    // Meta
    add(COMMANDS.ALIGN_LEFT);
    line(`Date: ${receipt.date}`);
    line(`Receipt #: ${receipt.receiptNumber}`);
    line(`Cashier: ${receipt.cashierName}`);
    if (receipt.customerName) line(`Customer: ${receipt.customerName}`);
    line("--------------------------------");

    // Items
    receipt.items.forEach(item => {
        // Name
        add(COMMANDS.ALIGN_LEFT);
        const descLines = String(item.desc || 'Item').split('\n');
        descLines.forEach((descLine, index) => {
          if (index === 0) {
            line(descLine);
            return;
          }
          line(`  ${descLine}`);
        });
        
        // Qty x Price = Total (Right Aligned manually via spaces or tabs if printer supports)
        // Simple approach: Line 2 with details
        const qtyPrice = `${item.qty} x ${config.currencySymbol}${item.price.toFixed(2)}`;
        const total = `${config.currencySymbol}${item.total.toFixed(2)}`;
        
        // Naive spacing logic (assuming 32 char width for standard 58mm, or 48 for 80mm)
        // For simplicity, we just print them on one line separated by space
        line(`${qtyPrice}   = ${total}`);
    });
    
    line("--------------------------------");

    // Totals
    add(COMMANDS.ALIGN_RIGHT);
    line(`Subtotal: ${config.currencySymbol}${receipt.subtotal.toFixed(2)}`);
    if (receipt.discount > 0) {
      line(`Discount: -${config.currencySymbol}${receipt.discount.toFixed(2)}`);
    }
    if (receipt.tax > 0) {
      line(`Tax: ${config.currencySymbol}${receipt.tax.toFixed(2)}`);
    }
    add(COMMANDS.BOLD_ON);
    line(`TOTAL: ${config.currencySymbol}${receipt.totalAmount.toFixed(2)}`);
    add(COMMANDS.BOLD_OFF);
    
    add(COMMANDS.ALIGN_LEFT);
    line(`Method: ${receipt.paymentMethod}`);
    if (receipt.payments && receipt.payments.length > 0) {
      receipt.payments.forEach(split => {
        line(`  ${split.method}: ${config.currencySymbol}${split.amount.toFixed(2)}`);
      });
    }
    line(`Tendered: ${config.currencySymbol}${receipt.amountTendered.toFixed(2)}`);
    line(`Change: ${config.currencySymbol}${receipt.changeGiven.toFixed(2)}`);
    
    // Footer
    add(COMMANDS.FEED_LINES(1));
    add(COMMANDS.ALIGN_CENTER);
    line("Thank you for your business!");
    const footerMessage =
      receipt.footerMessage ||
      config.transactionSettings?.pos?.receiptFooter ||
      config.footer?.receiptFooter;
    if (footerMessage) {
        line(footerMessage);
    }

    // Cut
    add(COMMANDS.FEED_LINES(4)); // Feed to cutter
    add(COMMANDS.CUT_FULL);

    // Send Data
    const buffer = new Uint8Array(data);
    await this.device.transferOut(this.endpointOut, buffer);
  }

  public async printReceipt(sale: Sale, config: CompanyConfig) {
    const receipt = buildPosReceiptDoc({
      sale,
      cashierName: sale.cashierId || 'Cashier',
      customerName: sale.customerName || 'Walk-in Customer',
      footerMessage: config.transactionSettings?.pos?.receiptFooter || config.footer?.receiptFooter
    });
    await this.printPosReceipt(receipt, config);
  }
}

export const hardwareService = new HardwareService();
