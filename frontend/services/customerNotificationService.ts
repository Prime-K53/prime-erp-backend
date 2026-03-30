
import { generateAIResponse } from './geminiService';
import { dbService } from './db';
import { CompanyConfig, Customer } from '../types';

export type NotificationActivityType =
  | 'QUOTATION'
  | 'SALES_ORDER'
  | 'INVOICE'
  | 'EXAMINATION_INVOICE'
  | 'EXAM_BATCH'
  | 'PAYMENT'
  | 'RECEIPT';

export interface NotificationLog {
  id: string;
  type: NotificationActivityType;
  entityId: string;
  customerName: string;
  phoneNumber: string;
  message: string;
  timestamp: string;
  status: 'sent' | 'failed' | 'cancelled';
}

const getCompanyConfig = (): CompanyConfig | null => {
  const saved = localStorage.getItem('nexus_company_config');
  return saved ? JSON.parse(saved) : null;
};

const DEFAULT_TEMPLATES: Record<NotificationActivityType, string> = {
  QUOTATION: "Hello {customerName}, your quotation {id} for {amount} is ready. Thank you for choosing {companyName}!",
  SALES_ORDER: "Hello {customerName}, your sales order {id} for {amount} has been created. Thank you for choosing {companyName}!",
  INVOICE: "Hello {customerName}, your invoice {id} for {amount} has been generated. Due date: {dueDate}. Regards, {companyName}.",
  EXAMINATION_INVOICE: "Hello {customerName}, your service invoice {id} for {amount} has been generated. Due date: {dueDate}. Regards, {companyName}.",
  EXAM_BATCH: "Hello {customerName}, your examination batch {id} has been approved. Total candidates: {count}. {companyName}.",
  PAYMENT: "Hello {customerName}, we have received your payment of {amount} for {id}. Thank you for your business! {companyName}.",
  RECEIPT: "Hello {customerName}, your receipt {id} for {amount} has been issued. Thank you for your business! {companyName}."
};

const ACTIVITY_LABELS: Record<NotificationActivityType, string> = {
  QUOTATION: 'quotation',
  SALES_ORDER: 'sales order',
  INVOICE: 'invoice',
  EXAMINATION_INVOICE: 'service invoice',
  EXAM_BATCH: 'examination batch',
  PAYMENT: 'payment receipt',
  RECEIPT: 'payment receipt'
};

/**
 * AI-powered template generator
 */
const generateDynamicTemplate = async (
  type: NotificationActivityType,
  data: any,
  config: CompanyConfig
): Promise<string> => {
  if (!navigator.onLine) {
    return replacePlaceholders(DEFAULT_TEMPLATES[type], data, config);
  }

  const prompt = `Generate a professional, appreciative, and business-encouraging SMS/WhatsApp message for a customer.
  Activity: ${type}
  Customer: ${data.customerName}
  Details: ${JSON.stringify(data)}
  Company: ${config.companyName}
  Tone: Professional, Friendly, Concise.
  Max length: 160 characters.
  Return ONLY the message text.`;

  try {
    const aiMessage = await generateAIResponse(prompt, "You are a professional customer relations assistant.");
    return aiMessage.trim() || replacePlaceholders(DEFAULT_TEMPLATES[type], data, config);
  } catch (error) {
    console.error("AI template generation failed:", error);
    return replacePlaceholders(DEFAULT_TEMPLATES[type], data, config);
  }
};

const replacePlaceholders = (template: string, data: any, config: CompanyConfig): string => {
  return template
    .replace(/{customerName}/g, data.customerName || 'Valued Customer')
    .replace(/{id}/g, data.id || '')
    .replace(/{amount}/g, data.amount || '')
    .replace(/{dueDate}/g, data.dueDate || '')
    .replace(/{count}/g, data.count || '')
    .replace(/{companyName}/g, config.companyName);
};

const sanitizePhoneNumber = (phoneNumber: string): string => {
  const digitsOnly = String(phoneNumber || '').replace(/[^\d]/g, '');
  return digitsOnly || String(phoneNumber || '').replace(/\s+/g, '');
};

/**
 * Rate limiting check (e.g., max 1 notification per entity per 5 minutes)
 */
const checkRateLimit = async (type: NotificationActivityType, entityId: string): Promise<boolean> => {
  try {
    const logs = await dbService.getAll<NotificationLog>('customerNotificationLogs');
    const recent = logs.find(l => 
      l.type === type && 
      l.entityId === entityId && 
      (Date.now() - new Date(l.timestamp).getTime() < 5 * 60 * 1000)
    );
    return !recent;
  } catch {
    return true;
  }
};

export const customerNotificationService = {
  /**
   * Main trigger for customer notifications
   */
  async triggerNotification(
    type: NotificationActivityType,
    data: {
      id: string;
      customerName: string;
      phoneNumber?: string;
      amount?: string;
      dueDate?: string;
      count?: number;
      [key: string]: any;
    }
  ) {
    const config = getCompanyConfig();
    if (!config?.notificationSettings?.customerActivityNotifications) {
      console.log(`[Notification] System disabled for ${type}`);
      return;
    }

    if (!data.phoneNumber) {
      console.warn(`[Notification] No phone number for ${data.customerName}`);
      return;
    }

    const canProceed = await checkRateLimit(type, data.id);
    if (!canProceed) {
      console.warn(`[Notification] Rate limit exceeded for ${type} ${data.id}`);
      return;
    }

    const message = await generateDynamicTemplate(type, data, config);

    const logEntryBase: Omit<NotificationLog, 'status'> = {
      id: `NOTIF-LOG-${Date.now()}`,
      type,
      entityId: data.id,
      customerName: data.customerName,
      phoneNumber: data.phoneNumber,
      message,
      timestamp: new Date().toISOString()
    };

    const shouldSend = window.confirm(
      `Send ${ACTIVITY_LABELS[type]} notification to ${data.customerName} now?\n\n${message}`
    );

    if (!shouldSend) {
      await dbService.put('customerNotificationLogs', {
        ...logEntryBase,
        status: 'cancelled'
      });
      console.log(`[Notification] Cancelled ${type} for ${data.customerName}`);
      return;
    }

    try {
      await dbService.put('customerNotificationLogs', {
        ...logEntryBase,
        status: 'sent'
      });

      // Open messaging app
      const encodedMsg = encodeURIComponent(message);
      const phone = sanitizePhoneNumber(data.phoneNumber);

      // WhatsApp priority, fallback to SMS
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      let url = `https://wa.me/${phone}?text=${encodedMsg}`;

      if (!isMobile) {
        // For web, use WA Web
        url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodedMsg}`;
      }
      
      // Fallback mechanism: if WA fails, user can try SMS
      // Since we can't reliably detect if WA is installed, we provide a clean way to trigger.
      window.open(url, '_blank');
      
      console.log(`[Notification] Triggered ${type} for ${data.customerName}`);
    } catch (error) {
      console.error(`[Notification] Failed to process ${type}:`, error);
      await dbService.put('customerNotificationLogs', { ...logEntryBase, status: 'failed' });
    }
  },

  async getLogs(): Promise<NotificationLog[]> {
    return await dbService.getAll<NotificationLog>('customerNotificationLogs');
  }
};
