
import React, { useState, useEffect } from 'react';
import { Edit2, Search, Eye, ArrowUp, ArrowDown, ArrowRight, Ruler, AlertCircle, Copy, Trash2, CheckSquare, Square, Warehouse as WarehouseIcon, MapPin, Package, Truck, ShieldCheck } from 'lucide-react';
import { Item, Warehouse } from '../../../types';
import { usePagination } from '../../../hooks/usePagination';
import Pagination from '../../../components/Pagination';
import PreviewButton from '../../../components/PreviewButton';
import { useData } from '../../../context/DataContext';
import { useNavigate } from 'react-router-dom';

interface ItemTableProps {
    items: Item[];
    warehouses: Warehouse[];
    onEdit: (item: Item) => void;
    onView: (item: Item) => void;
    onPreview?: (item: Item) => void;
    onDuplicate: (item: Item) => void;
    onDelete: (id: string) => void;
    onBatchDelete: (ids: string[]) => void;
    initialSearch?: string;
}

export const SkeletonLoader: React.FC<{ type: 'table' | 'grid' }> = ({ type }) => {
    if (type === 'table') {
        return (
            <div className="flex flex-col bg-white/70 backdrop-blur-xl rounded-2xl shadow-sm border border-white/60 animate-pulse">
                <div className="p-3 border-b border-slate-200/60 flex gap-3 bg-slate-50/30">
                    <div className="h-10 w-full md:w-[400px] bg-slate-200 rounded-xl"></div>
                    <div className="ml-auto flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-8 w-16 bg-slate-200 rounded-lg"></div>)}
                    </div>
                </div>
                <div className="flex-1">
                    <div className="h-10 bg-slate-100/80 border-b border-slate-200/60"></div>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="h-12 border-b border-slate-100/50 flex items-center px-4 gap-4">
                            <div className="h-4 w-4 bg-slate-200 rounded"></div>
                            <div className="h-4 flex-1 bg-slate-200 rounded"></div>
                            <div className="h-4 w-[15%] bg-slate-200 rounded"></div>
                            <div className="h-4 w-[10%] bg-slate-200 rounded"></div>
                            <div className="h-4 w-[15%] bg-slate-200 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 p-1">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="glass-card p-6 rounded-2xl border border-white/60 animate-pulse">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-slate-200"></div>
                        <div className="flex-1">
                            <div className="h-4 w-24 bg-slate-200 rounded mb-2"></div>
                            <div className="h-3 w-16 bg-slate-100 rounded"></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="h-12 bg-slate-50 rounded-xl"></div>
                        <div className="h-12 bg-slate-50 rounded-xl"></div>
                    </div>
                    <div className="h-4 w-full bg-slate-100 rounded"></div>
                </div>
            ))}
        </div>
    );
};

export const ItemTable: React.FC<ItemTableProps> = ({
    items,
    warehouses,
    onEdit,
    onView,
    onPreview,
    onDuplicate,
    onDelete,
    onBatchDelete,
    initialSearch = ''
}) => {
    const { companyConfig, triggerReplenishment, notify } = useData();
    const navigate = useNavigate();
    const currency = companyConfig.currencySymbol;

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'All' | 'Material' | 'Product' | 'Service' | 'Stationery'>('All');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [sortField, setSortField] = useState<keyof Item | 'category'>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    useEffect(() => { if (initialSearch) setSearchTerm(initialSearch); }, [initialSearch]);

    const handleSmartReplenish = async (item: Item) => {
        try {
            await triggerReplenishment(item.id);
            navigate('/purchases');
        } catch (e) {
            // Error handled in context
        }
    };

    const handleSort = (field: keyof Item | 'category') => {
        if (sortField === field) { setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); } else { setSortField(field); setSortDirection('asc'); }
    };

    const handleToggleSelect = (id: string) => {
        const item = items.find(i => i.id === id);
        if (item?.isProtected) {
            notify('warning', 'Protected items cannot be selected for deletion');
            return;
        }
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };
    const handleSelectAll = () => {
        const selectableItems = currentItems.filter(i => !i.isProtected);
        setSelectedIds(selectedIds.length === selectableItems.length ? [] : selectableItems.map(i => i.id));
    };

    const handleToggleExpand = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setExpandedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const filteredItems = items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.sku.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'All' || item.type === filterType;
        return matchesSearch && matchesType;
    }).sort((a, b) => {
        let valA = a[sortField as keyof Item];
        let valB = b[sortField as keyof Item];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const itemsPerPage = 50;
    const { currentItems, currentPage, maxPage, totalItems, next, prev } = usePagination(filteredItems, itemsPerPage);

    const renderSortIcon = (field: keyof Item | 'category') => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? <ArrowUp size={10} className="inline ml-1" /> : <ArrowDown size={10} className="inline ml-1" />;
    };

    return (
        <div className="flex flex-col bg-white/70 backdrop-blur-xl rounded-2xl shadow-sm border border-white/60">
            <div className="p-3 border-b border-slate-200/60 flex gap-3 flex-wrap items-center bg-slate-50/30">
                <div className="relative flex-1 md:w-[400px] min-w-[250px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search items..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none text-[13px] bg-white/80 backdrop-blur h-10 font-normal"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                {selectedIds.length > 0 && (
                    <button
                        onClick={() => { onBatchDelete(selectedIds); setSelectedIds([]); }}
                        className="flex items-center gap-1 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[13px] font-medium hover:bg-red-100 transition-colors"
                    >
                        <Trash2 size={14} /> Delete ({selectedIds.length})
                    </button>
                )}

                <div className="flex items-center gap-1 overflow-x-auto ml-auto bg-white/50 p-1 rounded-xl border border-white/60">
                    {['All', 'Product', 'Material', 'Stationery', 'Service'].map(type => (
                        <button key={type} onClick={() => setFilterType(type as any)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap uppercase tracking-tight ${filterType === type ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-white/80'}`}>{type}</button>
                    ))}
                </div>
            </div>
            <div>
                <table className="w-full text-left table-fixed">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/60 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="table-header px-4 py-2 w-12 text-center">
                                <button onClick={handleSelectAll} className="text-slate-400 hover:text-slate-600">
                                    {selectedIds.length > 0 && selectedIds.length === currentItems.length ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                                </button>
                            </th>
                            <th className="table-header px-4 py-2 w-1/3 cursor-pointer hover:text-blue-600" onClick={() => handleSort('name')}>Name {renderSortIcon('name')}</th>
                            <th className="table-header px-4 py-2 w-[15%] cursor-pointer hover:text-blue-600" onClick={() => handleSort('sku')}>SKU {renderSortIcon('sku')}</th>
                            <th className="table-header px-4 py-2 w-[10%] cursor-pointer hover:text-blue-600 text-center" onClick={() => handleSort('stock')}>Stock {renderSortIcon('stock')}</th>
                            <th className="table-header px-4 py-2 w-[15%] text-right cursor-pointer hover:text-blue-600" onClick={() => handleSort('price')}>Price {renderSortIcon('price')}</th>
                            <th className="table-header px-4 py-2 w-[15%] text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                        {currentItems.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-20 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 shadow-inner">
                                            <Package size={32} strokeWidth={1.5} />
                                        </div>
                                        <div>
                                            <p className="text-slate-900 font-bold text-[13px]">No items found</p>
                                            <p className="text-[10px] font-bold uppercase tracking-tight">Try adjusting your search or filter</p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ) : currentItems.map(item => {
                            const isLowStock = item.stock <= item.minStockLevel;
                            const isSelected = selectedIds.includes(item.id);
                            const isExpanded = expandedIds.includes(item.id);
                            const hasVariants = item.isVariantParent && item.variants && item.variants.length > 0;

                            return (
                                <React.Fragment key={`${item.id}-${item.sku}`}>
                                    <tr className={`transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/50'} ${isExpanded ? 'bg-slate-50' : ''} ${item.isProtected ? 'opacity-95' : ''}`} onClick={() => onView(item)}>
                                        <td className="table-body-cell text-center" onClick={(e) => { e.stopPropagation(); handleToggleSelect(item.id); }}>
                                            {item.isProtected ? (
                                                <ShieldCheck size={16} className="text-slate-400 mx-auto" title="System Protected Item" />
                                            ) : (
                                                isSelected ? <CheckSquare size={16} className="text-blue-600 mx-auto" /> : <Square size={16} className="text-slate-300 mx-auto hover:text-slate-500" />
                                            )}
                                        </td>
                                        <td className="table-body-cell font-medium text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                                            <div className="flex items-center gap-2">
                                                {item.isProtected && <ShieldCheck size={12} className="text-blue-500 shrink-0" />}
                                                {hasVariants && (
                                                    <button
                                                        onClick={(e) => handleToggleExpand(e, item.id)}
                                                        className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-400"
                                                    >
                                                        {isExpanded ? <ArrowDown size={12} /> : <ArrowRight size={12} />}
                                                    </button>
                                                )}
                                                <div className="truncate">
                                                    {item.name}
                                                    {hasVariants && <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-md border border-blue-100 uppercase tracking-tight">Variants: {item.variants?.length}</span>}
                                                    {item.isLargeFormat && <div className="text-[10px] text-indigo-500 flex items-center gap-1 mt-0.5 font-bold uppercase tracking-tight"><Ruler size={10} /> Roll: {item.rollWidth}cm</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="table-body-cell text-slate-500 font-mono truncate">{item.sku}</td>
                                        <td className="table-body-cell text-center">
                                            {item.type === 'Service' ? <span className="text-slate-300 font-normal">-</span> : (
                                                <div className="flex flex-col items-center">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`${isLowStock ? 'text-red-600 font-bold' : 'font-bold text-slate-600'} finance-nums`}>{item.stock.toLocaleString()}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{item.unit}</span>
                                                        {isLowStock && <AlertCircle size={14} className="text-red-500" />}
                                                    </div>
                                                    {item.type === 'Material' && item.purchaseUnit && item.conversionRate && (
                                                        <span className="text-[10px] text-slate-400 font-bold italic finance-nums uppercase tracking-tight">
                                                            ≈ {(item.stock / item.conversionRate).toFixed(1)} {item.purchaseUnit}s
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className={`table-body-cell text-right finance-nums ${item.type === 'Material' ? 'text-red-600 font-bold' : 'text-slate-700 font-semibold'}`}>
                                            {currency}{(item.type === 'Material' ? item.cost : item.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="table-body-cell text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {isLowStock && item.type !== 'Service' && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleSmartReplenish(item); }} className="p-1.5 text-emerald-600 hover:text-emerald-700 bg-emerald-50 border border-emerald-100 rounded shadow-sm" title="Smart Replenish">
                                                        <Truck size={16} />
                                                    </button>
                                                )}
                                                <PreviewButton
                                                    documentId={item.uuid || item.id}
                                                    documentType="InventoryItem"
                                                    payload={item}
                                                    onPreviewReady={(model) => onPreview && onPreview(model)}
                                                    title="Preview Document"
                                                />
                                                <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="p-1.5 text-slate-400 hover:text-amber-600 bg-white border border-slate-100 rounded shadow-sm" title="Edit"><Edit2 size={16} /></button>
                                                {!item.isProtected && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 bg-white border border-slate-100 rounded shadow-sm"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    {isExpanded && hasVariants && item.variants?.map((variant, vIdx) => (
                                        <tr key={`${variant.id}-${vIdx}`} className="bg-slate-50/50 border-l-4 border-blue-500/30 group/variant hover:bg-blue-50/20 transition-colors">
                                            <td className="table-body-cell"></td>
                                            <td className="table-body-cell pl-8">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                                    <span className="font-bold text-slate-600">{variant.name}</span>
                                                    <div className="flex gap-1">
                                                        {Object.entries(variant.attributes).map(([k, v]) => (
                                                            <span key={k} className="text-[10px] bg-slate-200 text-slate-500 px-1 py-0.5 rounded uppercase font-bold tracking-tight">{k}: {v}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="table-body-cell font-mono text-slate-400">{variant.sku}</td>
                                            <td className="table-body-cell text-center finance-nums font-bold text-slate-600">
                                                {variant.stock.toLocaleString()} <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{item.unit}</span>
                                            </td>
                                            <td className={`table-body-cell text-right finance-nums font-bold ${item.type === 'Material' ? 'text-red-600' : 'text-blue-600'}`}>
                                                {currency}{(item.type === 'Material' ? variant.cost : variant.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="table-body-cell text-right">
                                                <div className="flex justify-end gap-1.5 opacity-0 group-hover/variant:opacity-100 transition-opacity">
                                                    <PreviewButton
                                                        documentId={variant.uuid || variant.id}
                                                        documentType="InventoryItemVariant"
                                                        payload={{ ...item, ...variant, isVariant: true }}
                                                        onPreviewReady={(model) => onPreview && onPreview(model)}
                                                        title="Preview Document"
                                                        iconSize={14}
                                                    />
                                                    <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="p-1 text-slate-400 hover:text-amber-600" title="Edit Variant"><Edit2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            <Pagination currentPage={currentPage} maxPage={maxPage} totalItems={totalItems} itemsPerPage={itemsPerPage} onNext={next} onPrev={prev} />
        </div>
    );
};

export const WarehouseGrid: React.FC<{ warehouses: Warehouse[]; inventory: Item[]; }> = ({ warehouses, inventory }) => {
    if (warehouses.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-slate-400 bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 mb-4">
                    <WarehouseIcon size={40} strokeWidth={1.5} />
                </div>
                <h3 className="text-slate-900 font-semibold text-lg">No Warehouses Defined</h3>
                <p className="text-sm max-w-xs text-center mt-1">Add a warehouse to start tracking stock across multiple locations.</p>
            </div>
        );
    }
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 p-1">
            {warehouses.map(wh => {
                const stockCount = inventory.reduce((sum, item) => { const loc = item.locationStock?.find(l => l.warehouseId === wh.id); return sum + (loc ? loc.quantity : 0); }, 0);
                const distinctItems = inventory.filter(i => i.locationStock?.some(l => l.warehouseId === wh.id && l.quantity > 0)).length;
                return (
                    <div key={wh.id} className="glass-card p-6 rounded-2xl hover:shadow-float transition-all duration-300 group border border-white/60">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm">
                                    <WarehouseIcon size={24} />
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-semibold text-slate-800">{wh.name}</h3>
                                    <p className="text-[10px] text-slate-400 font-mono uppercase font-normal">{wh.id}</p>
                                </div>
                            </div>
                            <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold border border-slate-200 uppercase tracking-widest">{wh.type}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="p-3 bg-slate-50/50 rounded-xl text-center border border-slate-100">
                                <div className="text-[13px] font-bold text-slate-800 finance-nums">{stockCount.toLocaleString()}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Units</div>
                            </div>
                            <div className="p-3 bg-slate-50/50 rounded-xl text-center border border-slate-100">
                                <div className="text-[13px] font-bold text-slate-800 finance-nums">{distinctItems.toLocaleString()}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">SKUs</div>
                            </div>
                        </div>
                        <div className="text-[12.5px] text-slate-400 border-t border-slate-100 pt-4 flex items-center gap-2 font-normal">
                            <MapPin size={14} /> <span className="font-medium text-slate-600">{wh.location}</span>
                        </div>
                    </div>
                )
            })}
        </div>
    );
};
