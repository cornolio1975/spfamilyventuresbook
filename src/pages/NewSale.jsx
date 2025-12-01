import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, useSettings } from '../db/hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Printer, Save, ArrowLeft, Eye, Maximize, X } from 'lucide-react';


const InvoiceView = ({ settings, customer, saleDate, id, items, products, prevBalance, prevBalanceMemo, subtotal, paidAmount, grandTotal }) => {
    const getProductName = (id) => products?.find(p => p.id === id)?.name || 'Unknown';
    const totalDiscount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const balanceDue = grandTotal - (paidAmount || 0);

    // Calculate display ID
    const startNum = parseInt(settings.invoiceStart) || 10000;
    const displayId = id ? (startNum + (parseInt(id) - 1)) : 'NEW';

    return (
        <div className="bg-white p-8 max-w-4xl mx-auto print:p-0 print:w-full print:max-w-none font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row print:flex-row justify-between items-center md:items-start print:items-start mb-8 border-b-2 border-gray-100 pb-6 gap-4">
                {/* Left Logo */}
                <div className="w-40 h-40 flex-shrink-0">
                    {settings.logoLeft && <img src={settings.logoLeft} alt="Logo" className="w-full h-full object-contain" />}
                </div>

                {/* Center Details */}
                <div className="text-center flex-1 px-4 order-first md:order-none print:order-none w-full">
                    <h1 className="text-xl font-extrabold uppercase tracking-wide text-gray-900">{settings.companyName}</h1>
                    <p className="text-sm font-bold text-gray-600">{settings.regNum}</p>
                    <p className="text-xs mt-1 text-gray-500 font-medium">{settings.desc1}</p>
                    <p className="text-xs text-gray-500 font-medium">{settings.desc2}</p>
                    <p className="text-sm font-bold mt-2 text-gray-800">{settings.contact}</p>
                </div>

                {/* Right Logo */}
                <div className="w-40 h-40 flex-shrink-0 hidden md:block print:block">
                    {settings.logoRight && <img src={settings.logoRight} alt="Poultry" className="w-full h-full object-contain" />}
                </div>
            </div>

            {/* Bill To & Invoice Details */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
                <div className="w-full md:w-auto">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Billed To</p>
                    <h2 className="text-lg font-bold text-gray-900">{customer.name}</h2>
                    <p className="text-sm text-gray-600 max-w-[250px]">{customer.address}</p>
                    <p className="text-sm text-gray-600">{customer.contact}</p>
                </div>
                <div className="text-left md:text-right w-full md:w-auto">
                    <h1 className="text-2xl font-bold text-gray-400 uppercase mb-1">Delivery Order / Invoice</h1>
                    <p className="text-sm font-bold text-gray-600">#INV-{displayId}</p>
                    <p className="text-sm font-bold text-gray-600">Date: {new Date(saleDate).toLocaleDateString('en-GB')}</p>
                </div>
            </div>

            {/* Items Table (Desktop & Print) */}
            <div className="hidden md:block print:!block overflow-x-auto">
                <table className="w-full mb-8 border-collapse min-w-[600px] print:!min-w-full print:!table">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-center py-3 px-2 text-sm font-bold text-gray-600 w-12">#</th>
                            <th className="text-left py-3 px-2 text-sm font-bold text-gray-600">Item</th>
                            <th className="text-center py-3 px-2 text-sm font-bold text-gray-600">Quantity</th>
                            <th className="text-right py-3 px-2 text-sm font-bold text-gray-600">Unit Price</th>
                            <th className="text-right py-3 px-2 text-sm font-bold text-gray-600">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={index} className="border-b border-gray-50">
                                <td className="text-center py-3 px-2 text-sm text-gray-600">{index + 1}</td>
                                <td className="py-3 px-2">
                                    <div className="font-bold text-gray-800">{getProductName(parseInt(item.productId))}</div>
                                    {item.memo && <div className="text-xs text-gray-500 italic mt-0.5">{item.memo}</div>}
                                    {item.discount > 0 && <div className="text-xs text-red-500 mt-0.5">Disc: -{parseFloat(item.discount).toFixed(2)}</div>}
                                </td>
                                <td className="text-center py-3 px-2 text-sm text-gray-800 font-medium">{item.qty} {item.unit}</td>
                                <td className="text-right py-3 px-2 text-sm text-gray-800">RM {parseFloat(item.price).toFixed(2)}</td>
                                <td className="text-right py-3 px-2 text-sm font-bold text-gray-800">RM {((item.qty * item.price) - (item.discount || 0)).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Items List (Mobile Only) */}
            <div className="md:hidden print:hidden space-y-4 mb-8">
                {items.map((item, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="font-bold text-gray-900">{getProductName(parseInt(item.productId))}</div>
                                {item.memo && <div className="text-xs text-gray-500 italic">{item.memo}</div>}
                            </div>
                            <div className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded border">
                                #{index + 1}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                            <div>
                                <span className="text-gray-500 text-xs block">Quantity</span>
                                <span className="font-medium">{item.qty} {item.unit}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-gray-500 text-xs block">Unit Price</span>
                                <span className="font-medium">RM {parseFloat(item.price).toFixed(2)}</span>
                            </div>
                        </div>

                        {item.discount > 0 && (
                            <div className="flex justify-between text-xs text-red-500 mb-2">
                                <span>Discount</span>
                                <span>- RM {parseFloat(item.discount).toFixed(2)}</span>
                            </div>
                        )}

                        <div className="flex justify-between items-center border-t border-gray-200 pt-2">
                            <span className="font-bold text-gray-600">Total</span>
                            <span className="font-bold text-gray-900 text-lg">
                                RM {((item.qty * item.price) - (item.discount || 0)).toFixed(2)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Totals Section */}
            <div className="flex justify-end mb-12">
                <div className="w-80">
                    <div className="flex justify-between items-center mb-2 px-2">
                        <span className="text-sm font-bold text-gray-600">Subtotal</span>
                        <span className="text-sm font-bold text-gray-800">RM {subtotal.toFixed(2)}</span>
                    </div>

                    {/* Discount Bar */}
                    <div className="flex justify-between items-center bg-green-700 text-white px-3 py-1.5 rounded-sm mb-1">
                        <span className="text-sm font-medium">Discount</span>
                        <span className="text-sm font-bold">- RM {totalDiscount.toFixed(2)}</span>
                    </div>

                    {/* Previous Balance Bar */}
                    <div className="flex justify-between items-center bg-green-700 text-white px-3 py-1.5 rounded-sm mb-2">
                        <span className="text-sm font-medium">Previous Balance {prevBalanceMemo && `(${prevBalanceMemo})`}</span>
                        <span className="text-sm font-bold">RM {parseFloat(prevBalance).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center mb-2 px-2">
                        <span className="text-sm font-bold text-gray-600">Paid</span>
                        <span className="text-sm font-bold text-gray-800">- RM {parseFloat(paidAmount || 0).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center border-t-2 border-gray-200 pt-2 px-2">
                        <span className="text-lg font-extrabold text-gray-900">Balance Due</span>
                        <span className="text-lg font-extrabold text-gray-900">RM {balanceDue.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center space-y-1">
                <p className="text-sm text-gray-600 font-medium">Thank you for your business!</p>
                <p className="text-xs text-gray-400 italic">This is a computer-generated document. No signature is required.</p>
            </div>
        </div>
    );
};

export default function NewSale() {
    const { id } = useParams();
    const navigate = useNavigate();
    const settings = useSettings();
    const customers = useLiveQuery(() => db.customers.toArray());
    const products = useLiveQuery(() => db.products.toArray());

    const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [items, setItems] = useState([]);
    const [prevBalance, setPrevBalance] = useState(0);
    const [prevBalanceMemo, setPrevBalanceMemo] = useState('');
    const [paidAmount, setPaidAmount] = useState(0);
    const [isViewMode, setIsViewMode] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [showToolbar, setShowToolbar] = useState(true);
    const componentRef = useRef();

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Invoice-${id || 'New'}`,
    });

    // Load existing sale if ID is present
    useEffect(() => {
        if (id) {
            db.sales.get(parseInt(id)).then(sale => {
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

    const calculateSubtotal = () => {
        return items.reduce((sum, item) => sum + ((item.qty * item.price) - (item.discount || 0)), 0);
    };

    const calculateGrandTotal = () => {
        return calculateSubtotal() + parseFloat(prevBalance || 0);
    };

    const handleSave = async (shouldPrint = false) => {
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

        try {
            let savedId = id ? parseInt(id) : null;
            if (savedId) {
                await db.sales.update(savedId, saleData);
                alert('Sale updated!');
            } else {
                savedId = await db.sales.add(saleData);
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
    }, [isPrinting, isViewMode]);

    const getProductName = (id) => products?.find(p => p.id === id)?.name || 'Unknown';
    const getCustomer = () => customers?.find(c => c.id === parseInt(selectedCustomer)) || {};



    return (
        <div className="min-h-screen bg-gray-50 pb-24 print:bg-white print:pb-0">
            {/* Toolbar */}
            {/* Toolbar */}
            {showToolbar && (
                <div className="sticky top-0 bg-white shadow-sm p-4 flex justify-between items-center z-10 no-print">
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-full">
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold">{id ? 'Invoice View' : 'New Sale'}</h1>
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
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    <Save size={18} /> Save
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
