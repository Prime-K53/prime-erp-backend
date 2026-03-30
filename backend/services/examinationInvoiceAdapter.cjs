const EXAMINATION_INVOICE_ORIGIN = 'examination';

const buildExaminationLogicalInvoiceNumber = (invoiceId, dateValue = new Date().toISOString()) => {
  const date = new Date(dateValue);
  const year = Number.isFinite(date.getTime()) ? date.getUTCFullYear() : new Date().getUTCFullYear();
  const numericId = Math.max(0, Math.floor(Number(invoiceId) || 0));
  return `EXM-${year}-${String(numericId).padStart(6, '0')}`;
};

const toNumericValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const pickPositiveNumber = (...values) => {
  for (const value of values) {
    const numeric = toNumericValue(value);
    if (numeric !== null && numeric > 0) return numeric;
  }
  return null;
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const sanitizeSkuToken = (value, fallback = 'EXM') => {
  const token = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return token || fallback;
};

const buildLineItems = (batch) => {
  const classes = Array.isArray(batch?.classes) ? batch.classes : [];
  if (classes.length === 0) {
    const totalAmount = pickPositiveNumber(batch?.total_amount, 0) ?? 0;
    const fallbackId = String(batch?.id || 'batch');
    return [
      {
        id: `EXM-LINE-${fallbackId}`,
        itemId: `EXM-LINE-${fallbackId}`,
        name: `${String(batch?.name || 'Examination Batch')} Printing`,
        sku: sanitizeSkuToken(`EXM-${batch?.id}`),
        description: `Examination batch ${String(batch?.name || batch?.id || '').trim()}`,
        category: 'Examination',
        type: 'Service',
        unit: 'job',
        minStockLevel: 0,
        stock: 0,
        reserved: 0,
        price: totalAmount,
        cost: totalAmount,
        quantity: 1,
        total: totalAmount
      }
    ];
  }

  return classes.map((cls, index) => {
    const learners = Math.max(0, Math.floor(toNumericValue(cls?.number_of_learners) ?? 0));
    const finalFeePerLearner = toNumericValue(cls?.final_fee_per_learner);
    const liveTotalPreview = toNumericValue(cls?.live_total_preview);

    if (finalFeePerLearner === null || finalFeePerLearner === undefined) {
      throw new Error(`Class "${cls?.class_name || cls?.id}": final_fee_per_learner is not populated. Please sync pricing settings before generating invoice.`);
    }
    if (liveTotalPreview === null || liveTotalPreview === undefined) {
      throw new Error(`Class "${cls?.class_name || cls?.id}": live_total_preview is not populated. Please sync pricing settings before generating invoice.`);
    }

    const className = String(cls?.class_name || `Class ${index + 1}`).trim() || `Class ${index + 1}`;
    const subjectCount = Array.isArray(cls?.subjects) ? cls.subjects.length : 0;
    const lineId = `EXM-LINE-${String(batch?.id || 'batch')}-${String(cls?.id || index + 1)}`;

    return {
      id: lineId,
      itemId: lineId,
      name: `${className} Examination Service`,
      sku: sanitizeSkuToken(`EXM-${batch?.id}-${className}`),
      description: `${subjectCount} subject${subjectCount === 1 ? '' : 's'} (${String(batch?.exam_type || 'Examination')})`,
      category: 'Examination',
      type: 'Service',
      unit: 'learner',
      minStockLevel: 0,
      stock: 0,
      reserved: 0,
      price: finalFeePerLearner,
      cost: finalFeePerLearner,
      quantity: Math.max(1, learners),
      total: liveTotalPreview
    };
  });
};

const createInvoiceFromBatch = ({ batchData, idempotencyKey }) => {
  const batch = batchData || {};
  const normalizedIdempotencyKey = String(
    idempotencyKey
    || `EXAM-BATCH-${String(batch?.id || '')}`
  ).trim();
  const lineItems = buildLineItems(batch);
  const batchTotalAmount = roundMoney(
    lineItems.reduce((sum, lineItem) => sum + (toNumericValue(lineItem?.total) ?? 0), 0)
  );
  const dueDateIso = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString();
  const invoiceNote = `Generated from examination batch ${batch?.name || batch?.id}`;

  return {
    idempotencyKey: normalizedIdempotencyKey,
    lineItems,
    batchTotalAmount,
    dueDateIso,
    invoiceNote,
    documentTitle: 'Examination Invoice',
    currency: String(batch?.currency || 'MWK'),
    originModule: EXAMINATION_INVOICE_ORIGIN,
    originBatchId: String(batch?.id || '')
  };
};

module.exports = {
  EXAMINATION_INVOICE_ORIGIN,
  buildExaminationLogicalInvoiceNumber,
  createInvoiceFromBatch
};
