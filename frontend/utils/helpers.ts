
import { Item, CompanyConfig } from '../types';

const normalizeNumberingKey = (type: string) => String(type || '').trim().toLowerCase();
const isInvoiceNumberingType = (type: string) => {
  const normalized = normalizeNumberingKey(type);
  return normalized === 'invoice' || normalized.startsWith('inv') || normalized.includes('invoice');
};

const resolveNumberingRules = (type: string, config?: CompanyConfig) => {
  const cfg = config || getCompanyConfig();
  const rules = cfg?.transactionSettings?.numbering as any;
  const normalized = normalizeNumberingKey(type);
  const directRule = rules ? (rules[normalized] || rules[type]) : undefined;
  const invoiceRule = rules ? (rules.invoice || rules.inv) : undefined;
  return { rules, directRule, invoiceRule };
};

const resolveNumberingPadding = (type: string, config?: CompanyConfig) => {
  const { directRule, invoiceRule } = resolveNumberingRules(type, config);
  let padding = directRule?.padding;
  if (padding == null && isInvoiceNumberingType(type)) {
    padding = invoiceRule?.padding;
  }
  if (padding == null) {
    if (isInvoiceNumberingType(type)) {
      throw new Error('Missing invoice padding configuration.');
    }
    return 4;
  }
  const parsed = Number(padding);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    if (isInvoiceNumberingType(type)) {
      throw new Error('Invalid invoice padding configuration.');
    }
    return 4;
  }
  return parsed;
};

export const assertInvoiceNumberFormat = (id: string, config?: CompanyConfig, type: string = 'invoice') => {
  const padding = resolveNumberingPadding(type, config);
  const match = String(id || '').match(/(\d+)$/);
  if (!match) {
    throw new Error(`Invoice number must end with ${padding} digits.`);
  }
  if (match[1].length !== padding) {
    throw new Error(`Invoice number must be ${padding} digits.`);
  }
  return true;
};

export const generateNextId = (type: string, collection: any[], config?: CompanyConfig) => {
  let prefix = type;
  let startNumber = 1;
  let resetInterval = 'Never';
  const { directRule } = resolveNumberingRules(type, config);
  const padding = resolveNumberingPadding(type, config);

  if (directRule) {
    prefix = directRule.prefix || type;
    startNumber = directRule.startNumber || 1;
    resetInterval = directRule.resetInterval || 'Never';
  }

  if (!collection || collection.length === 0) {
    const nextId = `${prefix}-${String(startNumber).padStart(padding, '0')}`;
    if (isInvoiceNumberingType(type)) {
      assertInvoiceNumberFormat(nextId, config, type);
    }
    return nextId;
  }

  // Handle Reset Intervals (Monthly, Yearly)
  let filteredCollection = collection;
  if (resetInterval !== 'Never') {
    const now = new Date();
    filteredCollection = collection.filter(item => {
      if (!item.date) return false;
      const itemDate = new Date(item.date);
      if (resetInterval === 'Monthly') {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      }
      if (resetInterval === 'Yearly') {
        return itemDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }

  if (filteredCollection.length === 0) {
    const nextId = `${prefix}-${String(startNumber).padStart(padding, '0')}`;
    if (isInvoiceNumberingType(type)) {
      assertInvoiceNumberFormat(nextId, config, type);
    }
    return nextId;
  }

  const maxId = filteredCollection.reduce((max, item) => {
    if (!item.id) return max;
    // Handle different ID formats
    if (typeof item.id !== 'string') return max;
    
    // Extract the numeric part from the end of the ID
    const match = item.id.match(/(\d+)$/);
    const num = match ? parseInt(match[1]) : 0;
    return !isNaN(num) ? Math.max(max, num) : max;
  }, 0);

  const nextNum = Math.max(maxId + 1, startNumber);
  const nextId = `${prefix}-${String(nextNum).padStart(padding, '0')}`;
  if (isInvoiceNumberingType(type)) {
    assertInvoiceNumberFormat(nextId, config, type);
  }
  return nextId;
};

export const generateSku = (category: string, collection: any[]) => {
  if (!category) return '';
  const prefix = category.substring(0, 3).toUpperCase();
  const matchingItems = collection.filter(item =>
    item.sku && item.sku.startsWith(prefix + '-')
  );
  let maxNum = 0;
  matchingItems.forEach(item => {
    const parts = item.sku.split('-');
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  });
  return `${prefix}-${String(maxNum + 1).padStart(4, '0')}`;
};

export const parseTemplate = (template: string, variables: Record<string, any>): string => {
  return template.replace(/{{(\w+)}}/g, (_, key) => {
    return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
  });
};

export const generateAccountNumber = (): string => {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
};

/**
 * Helper to get dynamic config from CompanyConfig (mirrored from transactionService)
 */
const getCompanyConfig = (): CompanyConfig | null => {
  const saved = localStorage.getItem('nexus_company_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse company config", e);
    }
  }
  return null;
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num || 0);
};

/**
 * Standard financial rounding based on CompanyConfig rules.
 */
export const roundFinancial = (amount: number, config?: CompanyConfig): number => {
  const cfg = config || getCompanyConfig();
  const rules = cfg?.roundingRules || { method: 'Nearest', precision: 2 };

  const precision = rules.precision ?? 2;
  const factor = Math.pow(10, precision);
  let rounded: number;

  switch (rules.method) {
    case 'Up':
      rounded = Math.ceil(amount * factor) / factor;
      break;
    case 'Down':
      rounded = Math.floor(amount * factor) / factor;
      break;
    case 'Nearest':
    default:
      rounded = Math.round((amount + Number.EPSILON) * factor) / factor;
      break;
  }

  return rounded;
};

/**
 * Standard currency rounding to 2 decimal places.
 */
export const roundToCurrency = (amount: number): number => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

/**
 * Calculates the total valuation of a stock collection
 */
export const calculateInventoryValuation = (items: Item[]): number => {
  return items.reduce((sum, item) => sum + ((item.stock || 0) * (item.cost || 0)), 0);
};

export const formatPaymentTerm = (term: string): string => {
  if (!term) return 'Due on Receipt';
  const days = parsePaymentTerms(term);
  if (days === 0) {
    if (term.toLowerCase().includes('receipt') || term.toLowerCase().includes('cod') || term.toLowerCase().includes('immediate')) return term;
    return 'Due on Receipt';
  }
  return `${days} days`;
};

export const parsePaymentTerms = (terms: string): number => {
  if (!terms) return 0;
  // Handle "Net X" format
  const netMatch = terms.match(/Net\s*(\d+)/i);
  if (netMatch) return parseInt(netMatch[1]);

  // Handle "X days" format
  const daysMatch = terms.match(/(\d+)\s*days/i);
  if (daysMatch) return parseInt(daysMatch[1]);

  // Default common terms
  switch (terms.toLowerCase()) {
    case 'due on receipt': return 0;
    case 'cod': return 0;
    case 'end of month': {
      const d = new Date();
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return Math.max(0, Math.ceil((lastDay.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
    }
    default: return 0;
  }
};

export const calculateDueDate = (date: string | Date, terms: string): string => {
  const baseDate = new Date(date);
  const days = parsePaymentTerms(terms);
  const dueDate = new Date(baseDate);
  dueDate.setDate(baseDate.getDate() + days);
  return dueDate.toISOString().split('T')[0];
};

export const DEFAULT_PAYMENT_TERMS: Record<string, string> = {
  'Individual': 'Net 7',
  'School Account': 'Net 365',
  'Institution': 'Net 30',
  'Government': 'Net 7',
  'Examination Account': 'Net 30'
};

export type PaymentTransactionType = 'invoice' | 'order' | 'quotation' | 'recurring' | 'other';

const SUB_ACCOUNT_PAYMENT_TERMS = 'Net 30';
const QUOTATION_PAYMENT_TERMS = 'Net 7';
const FALLBACK_MAIN_ACCOUNT_PAYMENT_TERMS = 'Net 30';
const MANAGED_PAYMENT_TERMS = new Set(
  [...Object.values(DEFAULT_PAYMENT_TERMS), FALLBACK_MAIN_ACCOUNT_PAYMENT_TERMS, 'Due on Receipt']
    .map((term) => String(term || '').trim().toLowerCase())
);

export const isSubAccountSelection = (subAccountName?: string | null): boolean => {
  const normalized = String(subAccountName || '').trim().toLowerCase();
  return Boolean(normalized) && normalized !== 'main' && normalized !== 'main account';
};

export const getDefaultPaymentTermsForSegment = (segment?: string | null): string => {
  const normalizedSegment = String(segment || '').trim();
  return DEFAULT_PAYMENT_TERMS[normalizedSegment] || FALLBACK_MAIN_ACCOUNT_PAYMENT_TERMS;
};

export const hasCustomPaymentTerms = (customer?: { paymentTerms?: string } | null): boolean => {
  const raw = String(customer?.paymentTerms || '').trim();
  if (!raw) return false;
  return !MANAGED_PAYMENT_TERMS.has(raw.toLowerCase());
};

export const resolveCustomerPaymentTerms = ({
  customer,
  subAccountName,
  transactionType = 'invoice',
  preserveCustomTerms = true
}: {
  customer?: { segment?: string; paymentTerms?: string } | null;
  subAccountName?: string | null;
  transactionType?: PaymentTransactionType;
  preserveCustomTerms?: boolean;
}): string => {
  if (transactionType === 'quotation') {
    return QUOTATION_PAYMENT_TERMS;
  }

  if (isSubAccountSelection(subAccountName)) {
    return SUB_ACCOUNT_PAYMENT_TERMS;
  }

  if (preserveCustomTerms && hasCustomPaymentTerms(customer)) {
    return String(customer?.paymentTerms || '').trim();
  }

  return getDefaultPaymentTermsForSegment(customer?.segment);
};

export const resolveCustomerPaymentPolicy = ({
  customer,
  subAccountName,
  transactionType = 'invoice',
  issuedDate,
  preserveCustomTerms = true
}: {
  customer?: { segment?: string; paymentTerms?: string } | null;
  subAccountName?: string | null;
  transactionType?: PaymentTransactionType;
  issuedDate: string | Date;
  preserveCustomTerms?: boolean;
}): { paymentTerms: string; dueDate: string } => {
  const paymentTerms = resolveCustomerPaymentTerms({
    customer,
    subAccountName,
    transactionType,
    preserveCustomTerms
  });

  return {
    paymentTerms,
    dueDate: calculateDueDate(issuedDate, paymentTerms)
  };
};

export const getPaymentTermsForCustomer = (
  customer: { segment?: string; paymentTerms?: string },
  subAccountName?: string
): string => resolveCustomerPaymentTerms({
  customer,
  subAccountName,
  transactionType: 'invoice',
  preserveCustomTerms: true
});

export const getFontStack = (font?: string) => {
  switch (font) {
    case 'Roboto': return '"Roboto", "Helvetica Neue", Helvetica, Arial, sans-serif';
    case 'Playfair Display': return '"Playfair Display", Georgia, serif';
    case 'JetBrains Mono': return '"JetBrains Mono", "Courier New", monospace';
    case 'Montserrat': return '"Montserrat", sans-serif';
    case 'Comic Sans MS': return '"Comic Sans MS", "Comic Sans", cursive';
    case 'Century Gothic': return '"Century Gothic", CenturyGothic, AppleGothic, sans-serif';
    case 'Courier New': return 'Courier, monospace';
    case 'Georgia': return 'Georgia, serif';
    case 'Helvetica': return '"Helvetica Neue", Helvetica, Arial, sans-serif';
    default: return '"Inter", sans-serif';
  }
};

/**
 * Utility to download a blob and revoke its URL after a delay
 */
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Revoke after a delay to ensure the browser has started the download
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000); // 1 second is safe for most browsers
};

/**
 * Utility to export data to CSV and trigger download
 */
export const exportToCSV = (filename: string, data: any[]) => {
  if (!data || !data.length) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(fieldName => {
        const value = row[fieldName];
        const strValue = value === null || value === undefined ? '' : String(value);
        // Escape quotes and wrap in quotes if contains comma
        const escaped = strValue.replace(/"/g, '""');
        return escaped.includes(',') ? `"${escaped}"` : escaped;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
};
