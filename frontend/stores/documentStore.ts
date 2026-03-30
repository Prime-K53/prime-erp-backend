import { create } from 'zustand';
import { PrimeDocData, FinancialDocSchema, LogisticsDocSchema, ReceiptSchema, SupplierPaymentSchema, PosReceiptSchema, StatementSchema, FiscalReportSchema, SalesExchangeSchema, SubscriptionDocSchema, ExaminationInvoiceSchema } from '../views/shared/components/PDF/schemas';

export type DocType = 'INVOICE' | 'EXAMINATION_INVOICE' | 'PO' | 'WORK_ORDER' | 'DELIVERY_NOTE' | 'QUOTATION' | 'RECEIPT' | 'SUPPLIER_PAYMENT' | 'POS_RECEIPT' | 'ACCOUNT_STATEMENT' | 'ACCOUNT_STATEMENT_SUMMARY' | 'FISCAL_REPORT' | 'SALES_EXCHANGE' | 'SALES_ORDER' | 'SUBSCRIPTION' | 'ORDER';

export interface FilePreviewDescriptor {
  downloadUrl?: string;
  fileId?: string;
  fileName: string;
  mimeType?: string;
  publicUrl?: string;
  sourceUrl?: string;
  title?: string;
}

interface DocumentState {
  isOpen: boolean;
  type: DocType;
  data: PrimeDocData | null;
  filePreview: FilePreviewDescriptor | null;
  /**
   * Validates raw data against Zod schemas before opening preview.
   * Useful for data coming from external sources or raw API responses.
   */
  safeOpenPreview: (type: DocType, rawData: any) => { success: boolean; error?: string };
  openFilePreview: (file: FilePreviewDescriptor) => void;
  closePreview: () => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  isOpen: false,
  type: 'INVOICE',
  data: null,
  filePreview: null,

  safeOpenPreview: (type, rawData) => {
    let schema: any = LogisticsDocSchema;

    if (type === 'INVOICE' || type === 'PO' || type === 'QUOTATION' || type === 'SALES_ORDER' || type === 'ORDER') {
      schema = FinancialDocSchema;
    } else if (type === 'EXAMINATION_INVOICE') {
      schema = ExaminationInvoiceSchema;
    } else if (type === 'SUBSCRIPTION') {
      schema = SubscriptionDocSchema;
    } else if (type === 'RECEIPT') {
      schema = ReceiptSchema;
    } else if (type === 'SUPPLIER_PAYMENT') {
      schema = SupplierPaymentSchema;
    } else if (type === 'POS_RECEIPT') {
      schema = PosReceiptSchema;
    } else if (type === 'ACCOUNT_STATEMENT' || type === 'ACCOUNT_STATEMENT_SUMMARY') {
      schema = StatementSchema;
    } else if (type === 'FISCAL_REPORT') {
      schema = FiscalReportSchema;
    } else if (type === 'SALES_EXCHANGE') {
      schema = SalesExchangeSchema;
    }
    const result = schema.safeParse(rawData);

    if (result.success) {
      set({ isOpen: true, type, data: result.data, filePreview: null });
      return { success: true };
    } else {
      console.error(`[DocumentStore] Invalid ${type} data:`, result.error.format());
      return {
        success: false,
        error: "Missing or invalid document data fields."
      };
    }
  },

  openFilePreview: (file) => set({ isOpen: true, data: null, filePreview: file }),

  closePreview: () => set({ isOpen: false, data: null, filePreview: null }),
}));
