import { describe, it, expect } from 'vitest';
import { assertInvoiceNumberFormat, generateNextId } from '../../utils/helpers';
import { CompanyConfig } from '../../types';

const buildConfig = (padding: number): CompanyConfig => ({
  transactionSettings: {
    numbering: {
      invoice: {
        prefix: 'INV',
        startNumber: 1,
        padding
      }
    }
  }
} as CompanyConfig);

describe('invoice numbering padding', () => {
  it('pads invoice numbers to configured length', () => {
    const config = buildConfig(5);
    const first = generateNextId('invoice', [], config);
    const second = generateNextId('invoice', [{ id: first, date: '2026-01-01' }], config);
    expect(first).toBe('INV-00001');
    expect(second).toBe('INV-00002');
  });

  it('throws when padding is missing', () => {
    const config = {
      transactionSettings: {
        numbering: {
          invoice: { prefix: 'INV', startNumber: 1 }
        }
      }
    } as CompanyConfig;
    expect(() => generateNextId('invoice', [], config)).toThrow();
  });

  it('throws when padding is invalid', () => {
    const config = buildConfig(0);
    expect(() => generateNextId('invoice', [], config)).toThrow();
  });

  it('validates invoice number format against padding', () => {
    const config = buildConfig(3);
    expect(() => assertInvoiceNumberFormat('INV-001', config, 'invoice')).not.toThrow();
    expect(() => assertInvoiceNumberFormat('INV-01', config, 'invoice')).toThrow();
  });
});
