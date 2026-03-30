import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { useFinance } from './FinanceContext';
import { useInventory } from './InventoryContext';
import { useProduction } from './ProductionContext';
import { useSales } from './SalesContext';
import { useProcurement } from './ProcurementContext';
import { useOrders } from './OrdersContext';
import { useExamination } from './ExaminationContext';

// Create context first before using it
const DataContext = createContext<any>(undefined);

// Re-export everything from this file to maintain compatibility with components importing from DataContext
// The actual Logic sits in the sub-contexts.
// This "God Context" aggregates the values defensively.

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <LegacyDataAggregator>{children}</LegacyDataAggregator>
    );
};

const LegacyDataAggregator: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const auth = useAuth();
    const finance = useFinance();
    const inventory = useInventory();
    const production = useProduction();
    const sales = useSales();
    const procurement = useProcurement();
    const orders = useOrders();
    const examination = useExamination();

    // Defensive initialization to prevent 'undefined' errors on filter/map/reduce
    const defaults = {
        invoices: [],
        orders: [],
        workOrders: [],
        customerPayments: [],
        expenses: [],
        sales: [],
        tasks: [],
        inventory: [],
        accounts: [],
        ledger: [],
        alerts: [],
        reminders: [],
        customers: [],
        suppliers: [],
        budgets: [],
        quotations: [],
        recurringInvoices: [],
        batches: [],
        boms: [],
        workCenters: [],
        resources: [],
        allocations: [],
        maintenanceLogs: [],
        auditLogs: [],
        interactions: [],
        shipments: [],
        goodsReceipts: [],
        warehouses: [],
        purchases: [],
        salesExchanges: [],
        reprintJobs: [],
        vatTransactions: [],
        vatReturns: [],
        marketAdjustments: [],
    };

    // Helper to merge contexts while ensuring arrays are never null/undefined
    const mergeContexts = (...contexts: any[]) => {
        const merged = { ...defaults };
        contexts.forEach(ctx => {
            if (!ctx) return;
            Object.keys(ctx).forEach(key => {
                const val = ctx[key];
                // Only overwrite if value is not null/undefined or if it's a non-array value
                if (val !== null && val !== undefined) {
                    merged[key] = val;
                }
            });
        });
        return merged;
    };

    const combinedValue = mergeContexts(auth, finance, inventory, production, sales, procurement, orders);
    const refreshAllData = async () => {
        await Promise.allSettled([
            finance.fetchFinanceData?.(),
            sales.fetchSalesData?.(),
            inventory.fetchInventoryData?.(),
            procurement.fetchProcurementData?.(),
            production.fetchProductionData?.(),
            orders.fetchOrders?.(),
            examination.loadAllData?.()
        ]);
    };

    return (
        <DataContext.Provider value={{ ...(combinedValue as any), ...examination, refreshAllData } as any}>
            {children}
        </DataContext.Provider>
    );
}

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider (Legacy Aggregator)');
    }
    return context;
};
