import { useDocumentStore, DocType } from '../stores/documentStore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { mapToInvoiceData } from '../utils/pdfMapper';

/**
 * Custom hook that provides a standardized way to preview documents
 * with validation and error notifications.
 */
export const useDocumentPreview = () => {
  const { safeOpenPreview } = useDocumentStore();
  const { notify, companyConfig } = useAuth();
  const { customers } = useData();

  const handlePreview = (type: DocType, rawData: any, boms?: any[], inventory?: any[]) => {
    try {
      const originModule = String(rawData?.originModule || rawData?.origin_module || '').toLowerCase();
      const isExaminationInvoice = type === 'INVOICE' && (
        originModule === 'examination'
        || String(rawData?.documentTitle || rawData?.document_title || '').toLowerCase().includes('examination invoice')
        || String(rawData?.reference || '').toUpperCase().startsWith('EXM-BATCH-')
      );
      const effectiveType: DocType = isExaminationInvoice ? 'EXAMINATION_INVOICE' : type;

      // For subscriptions, enrich data with wallet balance from customers if available
      let enrichedData = rawData;
      if (effectiveType === 'SUBSCRIPTION' && rawData) {
        try {
          // Try to find customer in the loaded customers context first
          // Use loose comparison for ID to handle string/number mismatches
          let customer = (customers || []).find((c: any) => 
            String(c.id) === String(rawData.customerId) || c.name === rawData.customerName
          );

          // Fallback to localStorage if not found in context (e.g. if context not fully loaded)
          if (!customer) {
            const savedCustomers = localStorage.getItem('nexus_customers');
            if (savedCustomers) {
              const parsedCustomers = JSON.parse(savedCustomers);
              customer = (parsedCustomers || []).find((c: any) =>
                String(c.id) === String(rawData.customerId) || c.name === rawData.customerName
              );
            }
          }

          if (customer) {
            console.log('[useDocumentPreview] Found customer for enrichment:', customer.name, 'Wallet:', customer.walletBalance);
            enrichedData = { ...rawData, walletBalance: customer.walletBalance || customer.wallet_balance || 0 };
          } else {
             console.warn('[useDocumentPreview] Customer not found for enrichment. ID:', rawData.customerId, 'Name:', rawData.customerName);
          }
        } catch (_) { /* Wallet balance enrichment is best-effort */ }
      }

      // Map the raw domain object to the PrimeDocData schema
      const mappedData = mapToInvoiceData(enrichedData, companyConfig, effectiveType, boms, inventory);

      // Use the store's safe open method to validate and open
      const result = safeOpenPreview(effectiveType, mappedData);

      if (!result.success && result.error) {
        notify(result.error, 'error');
      }
    } catch (error: any) {
      console.error(`[useDocumentPreview] Mapping failed for ${type}:`, error);
      notify("Failed to prepare document data: " + (error.message || "Unknown error"), 'error');
    }
  };

  return { handlePreview };
};
