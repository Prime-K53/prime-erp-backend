const pricingEngine = require('./examinationPricingEngine.cjs');
const batchWorkflow = require('./examinationBatchWorkflow.cjs');
const invoiceAdapter = require('./examinationInvoiceAdapter.cjs');
const repository = require('./examinationRepository.cjs');
const legacyService = require('./examinationService.cjs'); // For notifications

class ExaminationService {
  constructor(repo) {
    this.repository = repo;
  }

  async createBatch(data, userId = 'System') {
    const batch = await this.repository.createBatchRecord(data, userId);
    
    // Send notification
    await legacyService.createNotification({
      batch_id: batch.id,
      user_id: userId,
      notification_type: 'BATCH_CREATED',
      title: 'Batch Created',
      message: `Examination batch ${batch.name || batch.id} has been created.`
    });
    
    return batch;
  }

  async calculateBatch(batchId, settings, userId = 'System') {
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) throw new Error('Batch not found');
    
    batchWorkflow.assertBatchMutableForPricing(batch.status, 'calculate pricing');
    const pricingResult = pricingEngine.calculateExaminationBatchPricing(batch, settings);
    const nextStatus = batchWorkflow.resolveStatusAfterCalculation(batch.status);
    
    const updatedBatch = await this.repository.saveBatchCalculation(batchId, pricingResult, nextStatus, userId);
    
    await legacyService.createNotification({
      batch_id: batchId,
      user_id: userId,
      notification_type: 'BATCH_CALCULATED',
      title: 'Batch Calculated',
      message: `Examination batch ${batch.name || batchId} has been calculated.`
    });

    return updatedBatch;
  }

  async approveBatch(batchId, userId = 'System') {
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) throw new Error('Batch not found');
    
    batchWorkflow.assertCanApproveBatch(batch.status);
    const updatedBatch = await this.repository.saveBatchApproval(batchId, userId);
    
    await legacyService.createNotification({
      batch_id: batchId,
      user_id: userId,
      notification_type: 'BATCH_APPROVED',
      title: 'Batch Approved',
      message: `Examination batch ${batch.name || batchId} has been approved.`
    });

    return updatedBatch;
  }

  async generateInvoice(batchId, userId = 'System', options = {}) {
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) throw new Error('Batch not found');
    
    batchWorkflow.assertCanGenerateInvoice(batch.status);
    const invoicePayload = invoiceAdapter.createInvoiceFromBatch({ 
      batchData: batch, 
      idempotencyKey: options?.idempotencyKey 
    });
    
    const result = await this.repository.saveInvoice(batchId, invoicePayload, userId, options?.idempotencyKey);
    return result;
  }
}

const examinationOrchestrator = new ExaminationService(repository);

module.exports = examinationOrchestrator;
