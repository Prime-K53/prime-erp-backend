import { JobTicket, JobTicketSettings, JobTicketStatus, JobTicketPriority } from '../types';
import { generateNextId } from '../utils/helpers';
import { localFileStorage } from './localFileStorage';

export interface JobTicketNotification {
  id: string;
  ticketId: string;
  type: 'created' | 'status_changed' | 'ready' | 'delivered';
  message: string;
  sentAt: string;
  method: 'sms' | 'whatsapp' | 'email';
  success: boolean;
}
const STORAGE_KEY = 'jobTickets';
const SETTINGS_KEY = 'jobTicketSettings';

const defaultSettings: JobTicketSettings = {
  bulkDiscounts: [
    { minQuantity: 1, maxQuantity: 99, discountPercent: 0 },
    { minQuantity: 100, maxQuantity: 499, discountPercent: 10 },
    { minQuantity: 500, maxQuantity: 999, discountPercent: 15 },
    { minQuantity: 1000, maxQuantity: Infinity, discountPercent: 20 },
  ],
  defaultRushFeePercent: 25,
  expressFeePercent: 50,
  urgentFeePercent: 100,
  enableNotifications: true,
  notifyOnReceived: true,
  notifyOnReady: true,
  notifyOnDelivered: true,
};

// Helper to get tickets from localStorage
const getStoredTickets = (): JobTicket[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Helper to save tickets to localStorage
const saveTickets = (tickets: JobTicket[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
};

// Helper to get settings
const getStoredSettings = (): JobTicketSettings => {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
};

// Helper to save settings
const saveSettings = (settings: JobTicketSettings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const jobTicketService = {
  // Get all job tickets
  getAll: async (): Promise<JobTicket[]> => {
    return getStoredTickets();
  },

  // Get a single ticket by ID
  getById: async (id: string): Promise<JobTicket | undefined> => {
    const tickets = getStoredTickets();
    return tickets.find(t => t.id === id);
  },

  // Create a new job ticket
  create: async (ticket: Partial<JobTicket>): Promise<JobTicket> => {
    const tickets = getStoredTickets();
    const settings = getStoredSettings();
    
    const newTicket: JobTicket = {
      id: generateNextId('TKT', tickets),
      ticketNumber: generateNextId('TKT', tickets),
      type: ticket.type || 'Printing',
      customerId: ticket.customerId,
      customerName: ticket.customerName || 'Walk-in',
      customerPhone: ticket.customerPhone,
      description: ticket.description || '',
      quantity: ticket.quantity || 1,
      priority: ticket.priority || 'Normal',
      status: ticket.status || 'Received',
      paperSize: ticket.paperSize || 'A4',
      paperType: ticket.paperType,
      colorMode: ticket.colorMode || 'BlackWhite',
      sides: ticket.sides || 'Single',
      finishing: ticket.finishing || {},
      unitPrice: ticket.unitPrice || 0,
      rushFee: ticket.rushFee || 0,
      finishingCost: ticket.finishingCost || 0,
      discount: ticket.discount || 0,
      subtotal: ticket.subtotal || 0,
      tax: ticket.tax || 0,
      total: ticket.total || 0,
      dateReceived: ticket.dateReceived || new Date().toISOString(),
      dueDate: ticket.dueDate,
      dueTime: ticket.dueTime,
      expectedCompletionDate: ticket.expectedCompletionDate,
      expectedCompletionTime: ticket.expectedCompletionTime,
      completedAt: ticket.completedAt,
      deliveredAt: ticket.deliveredAt,
      operatorId: ticket.operatorId,
      operatorName: ticket.operatorName,
      machineId: ticket.machineId,
      machineName: ticket.machineName,
      progressPercent: ticket.progressPercent || 0,
      attachments: ticket.attachments || [],
      notes: ticket.notes,
      internalNotes: ticket.internalNotes,
      createdBy: ticket.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Calculate pricing with bulk discount
    const pricing = jobTicketService.calculatePricing(newTicket.quantity, newTicket.unitPrice, newTicket.priority, newTicket.finishing, settings);
    newTicket.rushFee = pricing.rushFee;
    newTicket.finishingCost = pricing.finishingCost;
    newTicket.discount = pricing.discount;
    newTicket.subtotal = pricing.subtotal;
    newTicket.tax = pricing.tax;
    newTicket.total = pricing.total;
    
    tickets.push(newTicket);
    saveTickets(tickets);
    return newTicket;
  },

  // Update a job ticket
  update: async (id: string, updates: Partial<JobTicket>): Promise<JobTicket | undefined> => {
    const tickets = getStoredTickets();
    const settings = getStoredSettings();
    const index = tickets.findIndex(t => t.id === id);
    
    if (index === -1) return undefined;
    
    const updated = { ...tickets[index], ...updates, updatedAt: new Date().toISOString() };
    
    // Recalculate pricing if quantity, unitPrice, priority, or finishing changed
    if (updates.quantity || updates.unitPrice || updates.priority || updates.finishing) {
      const pricing = jobTicketService.calculatePricing(updated.quantity, updated.unitPrice, updated.priority, updated.finishing, settings);
      updated.rushFee = pricing.rushFee;
      updated.finishingCost = pricing.finishingCost;
      updated.discount = pricing.discount;
      updated.subtotal = pricing.subtotal;
      updated.tax = pricing.tax;
      updated.total = pricing.total;
    }
    
    tickets[index] = updated;
    saveTickets(tickets);
    return updated;
  },

  // Delete a job ticket
  delete: async (id: string): Promise<boolean> => {
    const tickets = getStoredTickets();
    const filtered = tickets.filter(t => t.id !== id);
    if (filtered.length === tickets.length) return false;
    saveTickets(filtered);
    return true;
  },

  // Update job ticket status
  updateStatus: async (id: string, status: JobTicketStatus): Promise<JobTicket | undefined> => {
    const tickets = getStoredTickets();
    const index = tickets.findIndex(t => t.id === id);
    
    if (index === -1) return undefined;
    
    const updates: Partial<JobTicket> = { status };
    
    if (status === 'Ready') {
      updates.completedAt = new Date().toISOString();
    } else if (status === 'Delivered') {
      updates.deliveredAt = new Date().toISOString();
    }
    
    return jobTicketService.update(id, updates);
  },

  // Update job progress
  updateProgress: async (id: string, progress: number): Promise<JobTicket | undefined> => {
    return jobTicketService.update(id, { progressPercent: Math.min(100, Math.max(0, progress)) });
  },

  // Calculate pricing
  calculatePricing: (
    quantity: number,
    unitPrice: number,
    priority: JobTicketPriority,
    finishing: JobTicket['finishing'],
    settings: JobTicketSettings
  ) => {
    const subtotal = quantity * unitPrice;
    
    // Calculate rush fee
    let rushFee = 0;
    if (priority === 'Rush') {
      rushFee = subtotal * (settings.defaultRushFeePercent / 100);
    } else if (priority === 'Express') {
      rushFee = subtotal * (settings.expressFeePercent / 100);
    } else if (priority === 'Urgent') {
      rushFee = subtotal * (settings.urgentFeePercent / 100);
    }
    
    // Calculate finishing cost
    let finishingCost = 0;
    if (finishing.staple) finishingCost += quantity * 0.50;
    if (finishing.fold) finishingCost += quantity * 0.25;
    if (finishing.collate) finishingCost += quantity * 0.20;
    if (finishing.trim) finishingCost += quantity * 0.75;
    if (finishing.punch) finishingCost += quantity * 0.30;
    if (finishing.lamination) finishingCost += quantity * 1.50;
    if (finishing.bindingType && finishing.bindingType !== 'None') {
      if (finishing.bindingType === 'Spiral') finishingCost += quantity * 2.00;
      else if (finishing.bindingType === 'Perfect') finishingCost += quantity * 5.00;
      else if (finishing.bindingType === 'Wire') finishingCost += quantity * 3.00;
      else if (finishing.bindingType === 'Tape') finishingCost += quantity * 1.50;
    }
    
    const afterRushAndFinishing = subtotal + rushFee + finishingCost;
    
    // Calculate bulk discount
    const discount = settings.bulkDiscounts.find(
      d => quantity >= d.minQuantity && quantity <= d.maxQuantity
    );
    const discountAmount = afterRushAndFinishing * ((discount?.discountPercent || 0) / 100);
    
    const afterDiscount = afterRushAndFinishing - discountAmount;
    const tax = afterDiscount * 0.15; // Assuming 15% VAT
    const total = afterDiscount + tax;
    
    return {
      rushFee: Math.round(rushFee * 100) / 100,
      finishingCost: Math.round(finishingCost * 100) / 100,
      discount: Math.round(discountAmount * 100) / 100,
      subtotal: Math.round(afterRushAndFinishing * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  },

  // Get settings
  getSettings: async (): Promise<JobTicketSettings> => {
    return getStoredSettings();
  },

  // Update settings
  updateSettings: async (updates: Partial<JobTicketSettings>): Promise<JobTicketSettings> => {
    const current = getStoredSettings();
    const updated = { ...current, ...updates };
    saveSettings(updated);
    return updated;
  },

  // Get tickets by status
  getByStatus: async (status: JobTicketStatus): Promise<JobTicket[]> => {
    const tickets = getStoredTickets();
    return tickets.filter(t => t.status === status);
  },

  // Get tickets by priority
  getByPriority: async (priority: JobTicketPriority): Promise<JobTicket[]> => {
    const tickets = getStoredTickets();
    return tickets.filter(t => t.priority === priority);
  },

  // Get overdue tickets
  getOverdue: async (): Promise<JobTicket[]> => {
    const tickets = getStoredTickets();
    const now = new Date();
    return tickets.filter(t => {
      if (t.status === 'Delivered' || t.status === 'Cancelled') return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < now;
    });
  },

  // Get tickets by customer
  getByCustomer: async (customerId: string): Promise<JobTicket[]> => {
    const tickets = getStoredTickets();
    return tickets.filter(t => t.customerId === customerId);
  },

  // File upload handling
  uploadFile: async (ticketId: string, file: File): Promise<{ id: string; name: string; url: string; type: string; size: number }> => {
    const tickets = getStoredTickets();
    const ticketIndex = tickets.findIndex(t => t.id === ticketId);

    if (ticketIndex === -1) throw new Error('Ticket not found');

    // Store file using localFileStorage
    const storedFileId = await localFileStorage.save(file);

    const fileData = {
      id: generateNextId('FILE', tickets[ticketIndex].attachments || []),
      name: file.name,
      url: storedFileId,
      fileId: storedFileId,
      type: file.type,
      size: file.size,
    };

    const ticket = tickets[ticketIndex];
    const attachments = [...(ticket.attachments || []), fileData];
    tickets[ticketIndex] = { ...ticket, attachments, updatedAt: new Date().toISOString() };
    saveTickets(tickets);

    return fileData;
  },

  // Delete file attachment
  deleteFile: async (ticketId: string, fileId: string): Promise<void> => {
    const tickets = getStoredTickets();
    const ticketIndex = tickets.findIndex(t => t.id === ticketId);

    if (ticketIndex === -1) throw new Error('Ticket not found');

    const ticket = tickets[ticketIndex];
    const attachments = (ticket.attachments || []).filter(a => a.id !== fileId);
    tickets[ticketIndex] = { ...ticket, attachments, updatedAt: new Date().toISOString() };
    saveTickets(tickets);
  },

  // Notification helpers
  getNotificationLog: (ticketId: string): JobTicketNotification[] => {
    try {
      const data = localStorage.getItem('jobTicketNotifications');
      const notifications: JobTicketNotification[] = data ? JSON.parse(data) : [];
      return notifications.filter(n => n.ticketId === ticketId);
    } catch {
      return [];
    }
  },

  saveNotification: (notification: JobTicketNotification): void => {
    try {
      const data = localStorage.getItem('jobTicketNotifications');
      const notifications: JobTicketNotification[] = data ? JSON.parse(data) : [];
      notifications.push(notification);
      localStorage.setItem('jobTicketNotifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('Failed to save notification:', error);
    }
  },

  // Send notification (simulated - integrates with existing notification service)
  sendNotification: async (
    ticketId: string,
    type: 'created' | 'status_changed' | 'ready' | 'delivered',
    method: 'sms' | 'whatsapp' | 'email',
    customerPhone?: string,
    customerEmail?: string
  ): Promise<JobTicketNotification> => {
    const tickets = getStoredTickets();
    const ticket = tickets.find(t => t.id === ticketId);

    if (!ticket) throw new Error('Ticket not found');

    const settings = getStoredSettings();
    if (!settings.enableNotifications) {
      throw new Error('Notifications are disabled');
    }

    // Check if we should send this notification
    if (type === 'ready' && !settings.notifyOnReady) {
      throw new Error('Ready notifications are disabled');
    }
    if (type === 'delivered' && !settings.notifyOnDelivered) {
      throw new Error('Delivered notifications are disabled');
    }

    // Generate message based on type
    const messages = {
      created: `Your job ${ticket.ticketNumber} has been received. Quantity: ${ticket.quantity}`,
      status_changed: `Your job ${ticket.ticketNumber} status has been updated to ${ticket.status}`,
      ready: `Your job ${ticket.ticketNumber} is ready for pickup!`,
      delivered: `Your job ${ticket.ticketNumber} has been delivered. Thank you!`,
    };

    const notification: JobTicketNotification = {
      id: generateNextId('NOTIF', []),
      ticketId,
      type,
      message: messages[type],
      sentAt: new Date().toISOString(),
      method,
      success: true, // In real implementation, would integrate with SMS/WhatsApp API
    };

    // Save notification log
    jobTicketService.saveNotification(notification);

    return notification;
  },
};
