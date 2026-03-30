export interface AppearanceConfig {
  theme: 'Light' | 'Dark' | 'System';
  density: 'Compact' | 'Comfortable' | 'Spacious';
  glassmorphism: boolean;
  borderRadius: 'Small' | 'Medium' | 'Large';
  enableAnimations: boolean;
}

export interface TransactionSettingsConfig {
  // Basic transaction controls
  allowBackdating: boolean;
  backdatingLimitDays: number;
  allowFutureDating: boolean;
  allowPartialFulfillment: boolean;
  voidingWindowHours: number;
  enforceCreditLimit: 'None' | 'Warning' | 'Strict';
  defaultPaymentTermsDays: number;
  quotationExpiryDays: number;
  autoPrintReceipt: boolean;
  quickItemEntry: boolean;
  defaultPOSWarehouse: string;
  posDefaultCustomer: string;

  // POS specific settings
  pos: {
    showItemImages: boolean;
    enableShortcuts: boolean;
    allowReturns: boolean;
    allowDiscounts: boolean;
    gridColumns: number;
    showCategoryFilters: boolean;
    photocopyPrice: number;
    typePrintingPrice: number;
    receiptFooter: string;
  };

  // Numbering rules (dynamic by transaction type)
  numbering: Record<string, {
    prefix: string;
    padding: number;
    startNumber: number;
    resetInterval: 'Never' | 'Daily' | 'Monthly' | 'Yearly';
  }>;

  // Approval thresholds (dynamic by transaction type)
  approvalThresholds: Record<string, number>;
}

export interface IntegrationSettingsConfig {
  externalApis: Array<{
    id?: string;
    baseUrl: string;
    apiKey: string;
    enabled: boolean;
  }>;
  webhooks: Array<{
    id: string;
    url: string;
    events: string[];
    enabled: boolean;
  }>;
}

export interface InvoiceTemplatesConfig {
  engine: 'Standard' | 'Advanced' | 'Custom';
  accentColor: string;
  companyNameFontSize: number;
  [key: string]: any; // Dynamic boolean flags for template options
}

export interface GLMappingConfig {
  [key: string]: string; // Dynamic mapping of accounts
}

export interface ProductionSettingsConfig {
  autoConsumeMaterials: boolean;
  requireQAApproval: boolean;
  trackMachineDownTime: boolean;
  defaultWorkCenterId: string;
  defaultExamBomId: string;
  allowOverproduction: boolean;
  showKioskSummary: boolean;
}

export interface InventorySettingsConfig {
  valuationMethod: 'FIFO' | 'LIFO' | 'WeightedAverage' | 'StandardCost';
  allowNegativeStock: boolean;
  autoBarcode: boolean;
  trackBatches: boolean;
  defaultWarehouseId: string;
  trackSerialNumbers: boolean;
  lowStockAlerts: boolean;
}

export interface CloudSyncConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
}

export interface SecuritySettingsConfig {
  sessionTimeoutMinutes: number;
  forcePasswordChangeDays: number;
  requireTwoFactor: boolean;
  auditLogLevel: 'Minimal' | 'Standard' | 'Detailed';
  lockoutAttempts: number;
  passwordProtectionEnabled?: boolean;
  enforcePasswordComplexity?: boolean;
}

export interface VATConfig {
  enabled: boolean;
  rate: number;
  filingFrequency: 'Monthly' | 'Quarterly' | 'Annually';
  pricingMode: 'VAT' | 'MarketAdjustment';
}

export interface RoundingRulesConfig {
  method: 'Nearest' | 'Up' | 'Down' | 'Truncate';
  precision: number;
}

export interface CompanyConfig {
  // Basic company info
  companyName: string;
  tagline?: string;
  email: string;
  phone: string;
  addressLine1: string;
  city?: string;
  country?: string;
  currencySymbol: string;
  dateFormat: string;
  logo?: string;
  signature?: string;

  // Configuration sections
  appearance: AppearanceConfig;
  transactionSettings: TransactionSettingsConfig;
  integrationSettings: IntegrationSettingsConfig;
  invoiceTemplates: InvoiceTemplatesConfig;
  glMapping: GLMappingConfig;
  productionSettings: ProductionSettingsConfig;
  inventorySettings: InventorySettingsConfig;
  cloudSync: CloudSyncConfig;
  securitySettings: SecuritySettingsConfig;
  security?: {
    passwordRequired?: boolean;
    enforceComplexity?: boolean;
  };
  vat: VATConfig;
  roundingRules: RoundingRulesConfig;
  notificationSettings: {
    customerActivityNotifications: boolean;
    smsGatewayEnabled: boolean;
    emailGatewayEnabled: boolean;
  };

  // Dynamic module enablement
  enabledModules: Record<string, boolean>;

  // Backup configuration
  backupFrequency: 'Daily' | 'Weekly' | 'Monthly' | 'Never';
  backupSettings?: {
    autoBackupEnabled: boolean;
    backupFrequency: 'Daily' | 'Weekly' | 'Monthly';
    retentionCount: number;
    cloudBackupEnabled: boolean;
  };

  // Pricing settings (from Phase 0-1)
  pricingSettings?: {
    roundingMethod: string;
    defaultMarkup: number;
    categoryOverrides: Array<{
      category: string;
      markup: number;
      roundingMethod?: string;
    }>;
    bulkDiscounts: Array<{
      minQty: number;
      discountPercent: number;
    }>;
    seasonalAdjustments: Array<{
      startDate: string;
      endDate: string;
      adjustmentPercent: number;
      categories?: string[];
    }>;
    [key: string]: any;
  };
}

export interface SalesOrderItem {
  id: string;
  productId: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  lineTotal?: number;
}

export interface SalesOrder {
  id: string;
  quotationId?: string | null;
  customerId?: string | null;
  salesPersonId?: string | null;
  territoryId?: string | null;
  orderDate: string;
  deliveryDate?: string | null;
  status: 'Draft' | 'Confirmed' | 'Processing' | 'Shipped' | 'Completed' | 'Cancelled';
  items: SalesOrderItem[];
  subtotal: number;
  discounts?: number;
  tax?: number;
  total: number;
  notes?: string;
}

// Examination Batch Notification Types
export type NotificationType = 'BATCH_CREATED' | 'BATCH_CALCULATED' | 'BATCH_APPROVED' | 'BATCH_INVOICED' | 'DEADLINE_REMINDER';
export type NotificationPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface ExaminationBatchNotification {
  id: string;
  batch_id: string;
  user_id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  batch_details: {
    batchId: string;
    batchName: string;
    examinationDate: string;
    numberOfStudents: number;
    schoolName?: string;
    academicYear?: string;
    term?: string;
    examType?: string;
    totalAmount?: number;
    status?: string;
  };
  is_read: boolean;
  read_at: string | null;
  delivered_at: string;
  created_at: string;
  expires_at?: string;
}

export interface NotificationAuditLog {
  id: string;
  notification_id: string | null;
  user_id: string;
  action: 'CREATED' | 'DELIVERED' | 'READ' | 'DISMISSED' | 'EXPIRED' | 'FAILED';
  details_json: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// Sales Order Types
export interface SalesOrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  tax?: number;
  line_total?: number;
}

export interface SalesOrder {
  id: string;
  quotationId?: string | null;
  customerId?: string | null;
  orderDate: string;
  deliveryDate?: string | null;
  status: 'Draft' | 'Confirmed' | 'Processing' | 'Fulfilled' | 'Cancelled';
  items: SalesOrderItem[];
  subtotal: number;
  discounts: number;
  tax: number;
  total: number;
  notes?: string;
  created_by?: string;
  created_at?: string;
}

// ============================================
// PRINT JOB TICKET TYPES - For Printing Services
// ============================================

export type JobTicketType = 'Photocopy' | 'Printing' | 'Binding' | 'Scan' | 'Lamination' | 'Other';
export type JobTicketPriority = 'Normal' | 'Rush' | 'Express' | 'Urgent';
export type JobTicketStatus = 'Received' | 'Processing' | 'Ready' | 'Delivered' | 'Cancelled';

export interface JobTicketFinishing {
  staple?: boolean;
  fold?: boolean;
  collate?: boolean;
  trim?: boolean;
  punch?: boolean;
  bindingType?: 'None' | 'Spiral' | 'Perfect' | 'Wire' | 'Tape';
  lamination?: boolean;
}

export interface JobTicket {
  id: string;
  ticketNumber: string;
  type: JobTicketType;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  description: string;
  quantity: number;
  priority: JobTicketPriority;
  status: JobTicketStatus;
  paperSize?: 'A4' | 'A3' | 'A5' | 'Legal' | 'Letter' | 'Custom';
  paperType?: string;
  colorMode?: 'BlackWhite' | 'Color';
  sides?: 'Single' | 'Double';
  finishing: JobTicketFinishing;
  unitPrice: number;
  rushFee: number;
  finishingCost: number;
  discount: number;
  subtotal: number;
  tax: number;
  total: number;
  dateReceived: string;
  dueDate?: string;
  dueTime?: string;
  expectedCompletionDate?: string;
  expectedCompletionTime?: string;
  completedAt?: string;
  deliveredAt?: string;
  operatorId?: string;
  operatorName?: string;
  machineId?: string;
  machineName?: string;
  progressPercent: number;
  attachments?: Array<{ id: string; name: string; url: string; fileId?: string; type: string; size: number }>;
  notes?: string;
  internalNotes?: string;
  createdBy?: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface JobTicketBulkDiscount {
  minQuantity: number;
  maxQuantity: number;
  discountPercent: number;
}

export interface JobTicketSettings {
  bulkDiscounts: JobTicketBulkDiscount[];
  defaultRushFeePercent: number;
  expressFeePercent: number;
  urgentFeePercent: number;
  enableNotifications: boolean;
  notifyOnReceived: boolean;
  notifyOnReady: boolean;
  notifyOnDelivered: boolean;
}
