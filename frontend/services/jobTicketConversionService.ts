import { dbService } from './db';
import { generateNextId } from '../utils/helpers';
import { workflowService } from './workflowService';

type SourceType = 'quotation' | 'examination_batch';

type ConversionOptions = {
  requestedBy?: string;
  requesterRole?: string;
  force?: boolean;
};

type ConversionResult = {
  success: boolean;
  sourceType: SourceType;
  sourceId: string;
  jobTicketId: string;
  message: string;
  workflowStarted: boolean;
};

const nowIso = () => new Date().toISOString();

const toSafeString = (value: any) => String(value || '').trim();
const toSafeNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const createAuditLog = (params: {
  sourceType: SourceType;
  sourceId: string;
  jobTicketId: string;
  requestedBy: string;
  requesterRole: string;
  details: string;
}) => ({
  id: `LOG-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  date: nowIso(),
  action: 'CREATE',
  entityType: 'JobTicketConversion',
  entityId: params.jobTicketId,
  details: params.details,
  userId: params.requestedBy,
  userRole: params.requesterRole,
  newValue: {
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    jobTicketId: params.jobTicketId
  }
});

const getLockId = (sourceType: SourceType, sourceId: string) => `CONV-${sourceType}-${sourceId}`;

const validateQuotationForConversion = (quotation: any) => {
  const errors: string[] = [];
  if (!toSafeString(quotation?.id)) errors.push('Quotation ID is required');
  if (!toSafeString(quotation?.customerName)) errors.push('Customer name is required');
  if (!Array.isArray(quotation?.items) || quotation.items.length === 0) errors.push('At least one quotation item is required');
  const quotationType = toSafeString(quotation?.quotationType || 'General').toLowerCase();
  if (quotationType !== 'general') errors.push('Only General quotations can be converted through this conversion flow');
  if (toSafeString(quotation?.status).toLowerCase() === 'converted') errors.push('Quotation already converted');
  if (toSafeString((quotation as any)?.convertedJobTicketId)) errors.push('Quotation already linked to a job ticket');
  return errors;
};

const validateBatchForConversion = (batch: any) => {
  const errors: string[] = [];
  if (!toSafeString(batch?.id)) errors.push('Batch ID is required');
  if (!toSafeString(batch?.name)) errors.push('Batch name is required');
  if (!Array.isArray(batch?.classes) || batch.classes.length === 0) errors.push('At least one class is required');
  if (toSafeString(batch?.status).toLowerCase() === 'cancelled') errors.push('Cancelled batch cannot be converted');
  if (toSafeString((batch as any)?.convertedJobTicketId)) errors.push('Batch already linked to a job ticket');
  return errors;
};

const mapQuotationToJobTicket = (quotation: any, jobTicketId: string) => {
  const firstItem = Array.isArray(quotation.items) && quotation.items.length > 0 ? quotation.items[0] : {};
  const totalQuantity = (quotation.items || []).reduce((sum: number, item: any) => sum + toSafeNumber(item.quantity, 0), 0) || 1;
  return {
    id: jobTicketId,
    status: 'Scheduled',
    sourceType: 'quotation',
    sourceId: quotation.id,
    customerId: quotation.customerId || undefined,
    customerName: quotation.customerName,
    productId: firstItem?.id || firstItem?.productId || '',
    productName: firstItem?.name || firstItem?.description || `Quotation ${quotation.id}`,
    quantityPlanned: totalQuantity,
    quantityCompleted: 0,
    dueDate: quotation.validUntil || nowIso(),
    startDate: nowIso(),
    notes: `Generated from quotation ${quotation.id}`,
    logs: [],
    priority: 'Normal',
    items: (quotation.items || []).map((item: any) => ({
      id: item.id || item.productId || `ITEM-${Math.random().toString(36).slice(2, 8)}`,
      desc: item.name || item.description || 'Item',
      qty: toSafeNumber(item.quantity, 1),
      price: toSafeNumber(item.price, 0),
      total: toSafeNumber(item.quantity, 1) * toSafeNumber(item.price, 0)
    }))
  };
};

const mapBatchToJobTicket = (batch: any, jobTicketId: string) => {
  const classes = Array.isArray(batch.classes) ? batch.classes : [];
  const totalLearners = classes.reduce((sum: number, cls: any) => {
    const learners = toSafeNumber(cls.learners ?? cls.student_count ?? cls.number_of_learners, 0);
    return sum + learners;
  }, 0);

  return {
    id: jobTicketId,
    status: 'Scheduled',
    sourceType: 'examination_batch',
    sourceId: batch.id,
    customerId: batch.school_id || batch.customer_id || undefined,
    customerName: batch.school_name || batch.customer_name || batch.name,
    productId: batch.id,
    productName: batch.name,
    quantityPlanned: Math.max(1, totalLearners || classes.length),
    quantityCompleted: 0,
    dueDate: batch.examination_date || batch.due_date || nowIso(),
    startDate: nowIso(),
    priority: batch.priority || 'Normal',
    notes: `Generated from examination batch ${batch.id}`,
    logs: [],
    examinationMeta: {
      academicYear: batch.academic_year,
      term: batch.term,
      examType: batch.exam_type,
      classCount: classes.length
    },
    items: classes.map((cls: any, index: number) => ({
      id: cls.id || `CLS-${index + 1}`,
      desc: cls.class_name || cls.name || `Class ${index + 1}`,
      qty: toSafeNumber(cls.learners ?? cls.student_count ?? cls.number_of_learners, 0) || 1,
      price: toSafeNumber(cls.fee_per_learner ?? cls.price_per_learner ?? 0, 0),
      total: (toSafeNumber(cls.learners ?? cls.student_count ?? cls.number_of_learners, 0) || 1) * toSafeNumber(cls.fee_per_learner ?? cls.price_per_learner ?? 0, 0)
    }))
  };
};

const startWorkflowForTicket = async (jobTicketId: string, requestedBy: string, sourceType: SourceType, sourceId: string) => {
  try {
    await workflowService.initialize();
    const definitions = workflowService.getActiveDefinitions('work_order');
    if (!definitions.length) return false;
    await workflowService.startWorkflow(
      definitions[0].id,
      'work_order',
      jobTicketId,
      requestedBy,
      {
        reference: jobTicketId,
        sourceType,
        sourceId,
        requesterName: requestedBy
      }
    );
    return true;
  } catch {
    return false;
  }
};

const convertQuotationToJobTicket = async (quotationId: string, options: ConversionOptions = {}): Promise<ConversionResult> => {
  const requestedBy = toSafeString(options.requestedBy) || 'system';
  const requesterRole = toSafeString(options.requesterRole) || 'System';
  const force = Boolean(options.force);

  const conversion = await dbService.executeAtomicOperation(
    ['quotations', 'workOrders', 'auditLogs', 'idempotencyKeys'],
    async (tx) => {
      const quotationStore = tx.objectStore('quotations');
      const workOrderStore = tx.objectStore('workOrders');
      const auditLogStore = tx.objectStore('auditLogs');
      const idempotencyStore = tx.objectStore('idempotencyKeys');

      const quotation = await quotationStore.get(quotationId);
      if (!quotation) {
        throw new Error('Quotation not found');
      }

      const validationErrors = validateQuotationForConversion(quotation);
      if (!force && validationErrors.length > 0) {
        throw new Error(validationErrors.join('; '));
      }

      const lockId = getLockId('quotation', quotationId);
      const existingLock = await idempotencyStore.get(lockId);
      if (existingLock && !force) {
        throw new Error('Conversion already in progress or completed for this quotation');
      }

      await idempotencyStore.put({
        id: lockId,
        scope: 'job_ticket_conversion',
        sourceId: quotationId,
        createdAt: nowIso(),
        metadata: { sourceType: 'quotation', requestedBy }
      });

      const existingWorkOrders = await workOrderStore.getAll();
      const jobTicketId = generateNextId('WO', existingWorkOrders || []);
      const workOrder = mapQuotationToJobTicket(quotation, jobTicketId);

      const updatedQuotation = {
        ...quotation,
        status: 'Converted',
        conversionStatus: 'Converted',
        convertedJobTicketId: jobTicketId,
        convertedAt: nowIso()
      };

      await workOrderStore.put(workOrder);
      await quotationStore.put(updatedQuotation);

      const auditEntry = createAuditLog({
        sourceType: 'quotation',
        sourceId: quotationId,
        jobTicketId,
        requestedBy,
        requesterRole,
        details: `Quotation ${quotationId} converted to job ticket ${jobTicketId}`
      });
      await auditLogStore.put(auditEntry);

      return { jobTicketId, sourceId: quotationId, sourceType: 'quotation' as const };
    }
  );

  const workflowStarted = await startWorkflowForTicket(conversion.jobTicketId, requestedBy, 'quotation', quotationId);
  return {
    success: true,
    sourceType: 'quotation',
    sourceId: conversion.sourceId,
    jobTicketId: conversion.jobTicketId,
    message: `Quotation ${quotationId} converted successfully`,
    workflowStarted
  };
};

const convertExaminationBatchToJobTicket = async (batchId: string, options: ConversionOptions = {}): Promise<ConversionResult> => {
  const requestedBy = toSafeString(options.requestedBy) || 'system';
  const requesterRole = toSafeString(options.requesterRole) || 'System';
  const force = Boolean(options.force);

  const conversion = await dbService.executeAtomicOperation(
    ['examinationBatches', 'workOrders', 'auditLogs', 'idempotencyKeys'],
    async (tx) => {
      const batchStore = tx.objectStore('examinationBatches');
      const workOrderStore = tx.objectStore('workOrders');
      const auditLogStore = tx.objectStore('auditLogs');
      const idempotencyStore = tx.objectStore('idempotencyKeys');

      const batch = await batchStore.get(batchId);
      if (!batch) {
        throw new Error('Examination batch not found');
      }

      const validationErrors = validateBatchForConversion(batch);
      if (!force && validationErrors.length > 0) {
        throw new Error(validationErrors.join('; '));
      }

      const lockId = getLockId('examination_batch', batchId);
      const existingLock = await idempotencyStore.get(lockId);
      if (existingLock && !force) {
        throw new Error('Conversion already in progress or completed for this batch');
      }

      await idempotencyStore.put({
        id: lockId,
        scope: 'job_ticket_conversion',
        sourceId: batchId,
        createdAt: nowIso(),
        metadata: { sourceType: 'examination_batch', requestedBy }
      });

      const existingWorkOrders = await workOrderStore.getAll();
      const jobTicketId = generateNextId('WO', existingWorkOrders || []);
      const workOrder = mapBatchToJobTicket(batch, jobTicketId);

      const updatedBatch = {
        ...batch,
        conversionStatus: 'Converted',
        convertedJobTicketId: jobTicketId,
        convertedAt: nowIso()
      };

      await workOrderStore.put(workOrder);
      await batchStore.put(updatedBatch);

      const auditEntry = createAuditLog({
        sourceType: 'examination_batch',
        sourceId: batchId,
        jobTicketId,
        requestedBy,
        requesterRole,
        details: `Examination batch ${batchId} converted to job ticket ${jobTicketId}`
      });
      await auditLogStore.put(auditEntry);

      return { jobTicketId, sourceId: batchId, sourceType: 'examination_batch' as const };
    }
  );

  const workflowStarted = await startWorkflowForTicket(conversion.jobTicketId, requestedBy, 'examination_batch', batchId);
  return {
    success: true,
    sourceType: 'examination_batch',
    sourceId: conversion.sourceId,
    jobTicketId: conversion.jobTicketId,
    message: `Examination batch ${batchId} converted successfully`,
    workflowStarted
  };
};

export const jobTicketConversionService = {
  convertQuotationToJobTicket,
  convertExaminationBatchToJobTicket
};

export type { ConversionOptions, ConversionResult, SourceType };
