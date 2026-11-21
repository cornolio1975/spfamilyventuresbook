import React, { useState, useEffect, useRef } from 'react';
import { formatDateShort } from '../utils/dateUtils';
import { useReactToPrint } from 'react-to-print';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, useSettings } from '../db/hooks';
import { saveAssistantSales } from '../db/saveAssistantSales';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Printer, Save, ArrowLeft, Eye, Maximize, X, ChevronLeft, ChevronRight } from 'lucide-react';
import InvoiceView from '../components/InvoiceView';
import BillingAssistant from '../components/BillingAssistant';

export default function NewSale() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const settings = useSettings();
    const customers = useLiveQuery(() => db.customers.toArray());
    const products = useLiveQuery(() => db.products.toArray());

    const [saleDate, setSaleDate] = useState(formatDateShort(new Date()));
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [items, setItems] = useState([]);
    const [prevBalance, setPrevBalance] = useState(0);
    const [prevBalanceMemo, setPrevBalanceMemo] = useState('');
    const [paidAmount, setPaidAmount] = useState(0);
    const [isViewMode, setIsViewMode] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [showToolbar, setShowToolbar] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const componentRef = useRef();
    const saveInProgress = useRef(false);
    const fromBillingAssistant = useRef(false);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Invoice-${id || 'New'}`,
    });

    const [prevSaleId, setPrevSaleId] = useState(null);
    const [nextSaleId, setNextSaleId] = useState(null);

    // Load existing sale if ID is present
    useEffect(() => {
        fromBillingAssistant.current = false;
        if (id) {
            const currentId = parseInt(id);
            db.sales.get(currentId).then(sale => {
                if (sale) {
                    setSaleDate(sale.date);
                    setSelectedCustomer(sale.customerId);
                    setItems(sale.items);
                    setPrevBalance(sale.prevBalance || 0);
                    setPrevBalanceMemo(sale.memo || '');
                    setPaidAmount(sale.paidAmount || 0);
                    setIsViewMode(true);
                }
            });

            // Fetch adjacent invoices for navigation
            db.sales.where('id').below(currentId).last().then(sale => {
                setPrevSaleId(sale ? sale.id : null);
            });
            db.sales.where('id').above(currentId).first().then(sale => {
                setNextSaleId(sale ? sale.id : null);
            });
        } else {
            setSaleDate(formatDateShort(new Date()));
            setSelectedCustomer('');
            setItems([]);
            setPrevBalance(0);
            setPrevBalanceMemo('');
            setPaidAmount(0);
            setIsViewMode(false);
            setPrevSaleId(null);
            setNextSaleId(null);
        }
    }, [id]);

    const addItem = () => {
        setItems([...items, { productId: '', qty: 1, unit: 'Kg', price: 0, discount: 0, memo: '' }]);
    };

    const updateItem = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;

        // Auto-fill price if product changes
        if (field === 'productId') {
            const product = products.find(p => p.id === parseInt(value));
            if (product) {
                newItems[index].price = product.price;
            }
        }
        setItems(newItems);
    };

    const removeItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const calculateSubtotal = (saleItems = items) => {
        return saleItems.reduce((sum, item) => sum + ((item.qty * item.price) - (item.discount || 0)), 0);
    };

    const calculateGrandTotal = () => {
        return calculateSubtotal() + parseFloat(prevBalance || 0);
    };

    const applyBillingDraft = (draft) => {
        fromBillingAssistant.current = true;
        setSaleDate(draft.date);
        setSelectedCustomer(draft.customerId);
        setItems(draft.items);
        setPrevBalance(draft.prevBalance);
        setPrevBalanceMemo('');
        setPaidAmount(0);
    };

    const saveBillingBatch = async (drafts) => {
        if (saveInProgress.current) return null;
        saveInProgress.current = true;
        setIsSaving(true);
        try {
            const sales = drafts.map(draft => {
                const subtotal = Number(calculateSubtotal(draft.items).toFixed(2));
                const grandTotal = Number((subtotal + draft.prevBalance).toFixed(2));
                if (!Number.isFinite(grandTotal)) throw new Error('The bill total is too large.');
                return { ...draft, subtotal, grandTotal, paidAmount: 0, memo: '' };
            });
            return await saveAssistantSales(db, sales);
        } finally {
            saveInProgress.current = false;
            setIsSaving(false);
        }
    };

    const handleSave = async (shouldPrint = false) => {
        if (saveInProgress.current) return;
        if (!selectedCustomer) {
            alert('Please select a customer');
            return;
        }
        if (items.length === 0) {
            alert('Please add at least one item');
            return;
        }

        const saleData = {
            date: saleDate,
            customerId: parseInt(selectedCustomer),
            items: items.map(item => ({
                ...item,
                productId: parseInt(item.productId),
                qty: parseFloat(item.qty),
                price: parseFloat(item.price),
                discount: parseFloat(item.discount || 0),
                memo: item.memo || ''
            })),
            subtotal: calculateSubtotal(),
            prevBalance: parseFloat(prevBalance),
            memo: prevBalanceMemo,
            paidAmount: parseFloat(paidAmount),
            grandTotal: calculateGrandTotal()
        };

        saveInProgress.current = true;
        setIsSaving(true);
        try {
            let savedId = id ? parseInt(id) : null;
            if (savedId) {
                await db.sales.update(savedId, saleData);
                alert('Sale updated!');
            } else {
                if (fromBillingAssistant.current) {
                    const { ids } = await saveAssistantSales(db, [saleData]);
                    if (!ids.length) {
                        alert('Duplicate bill. This invoice is already in Sales.');
                        return;
                    }
                    [savedId] = ids;
                } else {
                    savedId = await db.sales.add(saleData);
                }
                // If new sale and NOT printing, navigate away
                if (!shouldPrint) {
                    navigate(`/sales/${savedId}`);
                    return;
                }
                // If new sale AND printing, navigate with print param
                if (!id) {
                    navigate(`/sales/${savedId}?print=true`);
                    return;
                }
            }

            // If we are here, we are editing an existing sale and want to print
            if (shouldPrint) {
                setIsViewMode(true);
                setIsPrinting(true);
            } else {
                setIsViewMode(true);
            }

        } catch (error) {
            console.error('Error saving sale:', error);
            alert('Failed to save sale');
        } finally {
            saveInProgress.current = false;
            setIsSaving(false);
        }
    };

    // Check for print query param on load
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('print') === 'true' && isViewMode) {
            // Remove the param to prevent printing on refresh
            window.history.replaceState({}, '', window.location.pathname);
            setIsPrinting(true);
        }
    }, [isViewMode]);

    // Trigger print when isPrinting becomes true and view is ready
    useEffect(() => {
        if (isPrinting && isViewMode) {
            // Slight delay to ensure DOM is painted
            const timer = setTimeout(() => {
                handlePrint();
                setIsPrinting(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isPrinting, isViewMode, handlePrint]);

    const getCustomer = () => customers?.find(c => c.id === parseInt(selectedCustomer)) || {};



    return (
        <div className="min-h-screen bg-gray-50 pb-24 print:bg-white print:pb-0">
            {/* Toolbar */}
            {/* Toolbar */}
            {showToolbar && (
                <div className="sticky top-0 bg-white shadow-sm p-4 flex justify-between items-center z-10 no-print">
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-full" title="Back to Dashboard">
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold">{id ? 'Invoice View' : 'New Sale'}</h1>

                        {/* Navigation Arrows */}
                        {id && (
                            <div className="flex items-center ml-2 gap-1 border-l pl-2 border-gray-200">
                                <button
                                    onClick={() => prevSaleId && navigate(`/sales/${prevSaleId}`)}
                                    disabled={!prevSaleId}
                                    className={`p-1.5 rounded-md ${!prevSaleId ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                                    title="Previous Invoice"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <button
                                    onClick={() => nextSaleId && navigate(`/sales/${nextSaleId}`)}
                                    disabled={!nextSaleId}
                                    className={`p-1.5 rounded-md ${!nextSaleId ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                                    title="Next Invoice"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {isViewMode ? (
                            <>
                                <button
                                    onClick={() => setShowToolbar(false)}
                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                    title="Screenshot Mode"
                                >
                                    <Maximize size={20} />
                                </button>
                                <button
                                    onClick={() => setIsViewMode(false)}
                                    className="px-4 py-2 text-blue-600 font-medium hover:bg-blue-50 rounded-lg"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={handlePrint}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
                                >
                                    <Printer size={18} /> Save as PDF
                                </button>
                                <button
                                    onClick={() => navigate('/sales/new')}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                    <Plus size={18} /> New Sale
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setIsViewMode(true)}
                                    className="flex items-center gap-2 px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
                                >
                                    <Eye size={18} /> Preview
                                </button>
                                <button
                                    onClick={() => handleSave(false)}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    <Save size={18} /> {isSaving ? 'Saving…' : 'Save'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Floating Exit Screenshot Mode Button */}
            {!showToolbar && (
                <button
                    onClick={() => setShowToolbar(true)}
                    className="fixed top-4 right-4 z-50 p-2 bg-gray-800 text-white rounded-full shadow-lg opacity-50 hover:opacity-100 transition-opacity no-print"
                    title="Exit Screenshot Mode"
                >
                    <X size={20} />
                </button>
            )}

            {/* Content */}
            {isViewMode ? (
                <div ref={componentRef}>
                    <InvoiceView
                        settings={settings}
                        customer={getCustomer()}
                        saleDate={saleDate}
                        id={id}
                        items={items}
                        products={products}
                        prevBalance={prevBalance}
                        prevBalanceMemo={prevBalanceMemo}
                        paidAmount={paidAmount}
                        subtotal={calculateSubtotal()}
                        grandTotal={calculateGrandTotal()}
                    />
                </div>
            ) : (
                <div className="max-w-5xl mx-auto p-4 space-y-6">
                    {!id && (
                        <BillingAssistant
                            customers={customers}
                            products={products}
                            open={searchParams.get('assistant') === '1'}
                            hasItems={items.length > 0}
                            isSaving={isSaving}
                            onApply={applyBillingDraft}
                            onSaveBatch={saveBillingBatch}
                        />
                    )}
                    {/* Sale Details Card */}
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={saleDate}
                                    onChange={(e) => setSaleDate(e.target.value)}
                                    className="w-full p-2 border rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                                <select
                                    value={selectedCustomer}
                                    onChange={(e) => setSelectedCustomer(e.target.value)}
                                    className="w-full p-2 border rounded-md"
                                >
                                    <option value="">Select Customer</option>
                                    {customers?.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Items Card */}
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h2 className="font-semibold mb-4">Items</h2>
                        <div>
                            {/* Table Header - Hidden on Mobile */}
                            <div className="hidden md:flex gap-2 border-b pb-2 mb-2 text-sm font-medium text-gray-600">
                                <div className="flex-1 min-w-[200px]">Product</div>
                                <div className="w-48">Memo</div>
                                <div className="w-20">Qty</div>
                                <div className="w-24">Unit</div>
                                <div className="w-24">Price</div>
                                <div className="w-24">Discount</div>
                                <div className="w-24 text-right">Total</div>
                                <div className="w-10"></div>
                            </div>

                            {/* Table Body */}
                            <div className="space-y-4 md:space-y-2">
                                {items.map((item, index) => (
                                    <div key={index} className="flex flex-col md:flex-row gap-3 md:gap-2 items-start border md:border-none p-4 md:p-0 rounded-lg md:rounded-none bg-gray-50 md:bg-white relative">
                                        {/* Mobile Delete Button (Top Right) */}
                                        <button
                                            onClick={() => removeItem(index)}
                                            className="absolute top-2 right-2 p-2 text-red-500 hover:bg-red-100 rounded-full md:hidden"
                                        >
                                            <Trash2 size={18} />
                                        </button>

                                        <div className="w-full md:flex-1 md:min-w-[200px]">
                                            <label className="md:hidden text-xs font-bold text-gray-500 mb-1 block">Product</label>
                                            <select
                                                value={item.productId}
                                                onChange={(e) => updateItem(index, 'productId', e.target.value)}
                                                className="w-full p-2 border rounded-md text-sm bg-white"
                                            >
                                                <option value="">Select Product</option>
                                                {products?.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-full md:w-48">
                                            <label className="md:hidden text-xs font-bold text-gray-500 mb-1 block">Memo</label>
                                            <input
                                                type="text"
                                                placeholder="Memo"
                                                value={item.memo || ''}
                                                onChange={(e) => updateItem(index, 'memo', e.target.value)}
                                                className="w-full p-2 border rounded-md text-sm"
                                            />
                                        </div>
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <div className="w-1/2 md:w-20">
                                                <label className="md:hidden text-xs font-bold text-gray-500 mb-1 block">Qty</label>
                                                <input
                                                    type="number"
                                                    value={item.qty}
                                                    onChange={(e) => updateItem(index, 'qty', e.target.value)}
                                                    className="w-full p-2 border rounded-md text-sm"
                                                />
                                            </div>
                                            <div className="w-1/2 md:w-24">
                                                <label className="md:hidden text-xs font-bold text-gray-500 mb-1 block">Unit</label>
                                                <select
                                                    value={item.unit}
                                                    onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                                    className="w-full p-2 border rounded-md text-sm bg-white"
                                                >
                                                    <option value="Kg">Kg</option>
                                                    <option value="Pcs">Pcs</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <div className="w-1/2 md:w-24">
                                                <label className="md:hidden text-xs font-bold text-gray-500 mb-1 block">Price</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={item.price}
                                                    onChange={(e) => updateItem(index, 'price', e.target.value)}
                                                    className="w-full p-2 border rounded-md text-sm"
                                                />
                                            </div>
                                            <div className="w-1/2 md:w-24">
                                                <label className="md:hidden text-xs font-bold text-gray-500 mb-1 block">Discount</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={item.discount}
                                                    onChange={(e) => updateItem(index, 'discount', e.target.value)}
                                                    className="w-full p-2 border rounded-md text-sm text-red-600"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>

                                        <div className="w-full md:w-24 md:text-right flex justify-between md:block items-center mt-2 md:mt-0 pt-2 md:pt-2 border-t md:border-none">
                                            <span className="md:hidden text-sm font-bold text-gray-600">Total:</span>
                                            <span className="font-medium text-sm">
                                                {((item.qty * item.price) - (item.discount || 0)).toFixed(2)}
                                            </span>
                                        </div>

                                        {/* Desktop Delete Button */}
                                        <div className="hidden md:flex w-10 justify-center">
                                            <button
                                                onClick={() => removeItem(index)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={addItem}
                            className="mt-4 flex items-center gap-2 text-blue-600 font-medium hover:bg-blue-50 px-3 py-2 rounded-lg"
                        >
                            <Plus size={18} /> Add Item
                        </button>
                    </div>

                    {/* Totals Card */}
                    <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="font-medium">Subtotal</span>
                            <span className="text-xl font-bold">{calculateSubtotal().toFixed(2)}</span>
                        </div>

                        <div className="border-t pt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Previous Balance</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Memo (e.g. Bal b/f)"
                                    value={prevBalanceMemo}
                                    onChange={(e) => setPrevBalanceMemo(e.target.value)}
                                    className="flex-1 p-2 border rounded-md"
                                />
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Amount"
                                    value={prevBalance}
                                    onChange={(e) => setPrevBalance(e.target.value)}
                                    className="w-32 p-2 border rounded-md text-right"
                                />
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
                            <div className="flex justify-end">
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={paidAmount}
                                    onChange={(e) => setPaidAmount(e.target.value)}
                                    className="w-32 p-2 border rounded-md text-right font-bold text-green-700"
                                />
                            </div>
                        </div>

                        <div className="flex justify-between items-center border-t pt-4 text-lg">
                            <span className="font-bold">Grand Total</span>
                            <span className="font-bold text-blue-600">RM {calculateGrandTotal().toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
