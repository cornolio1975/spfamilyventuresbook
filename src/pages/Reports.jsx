import SalesTrends from '../components/SalesTrends';
import { customerOutstandingCents } from '../utils/customerOutstanding';
import React, { useState, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getReportDateRange, getReportSales, saleLineAmount } from '../utils/reportSales';
import { formatDateShort } from '../utils/dateUtils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Calendar, TrendingUp, Users, Package, DollarSign, History, Printer, ShoppingBag } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

const purchaseAmount = (bill) => Number(bill.subtotal ?? bill.total) || 0;
const formatQuantities = (quantities) => Object.entries(quantities)
    .map(([unit, qty]) => `${qty.toFixed(2)} ${unit}`.trim())
    .join(' / ') || '—';

export default function Reports() {
    const [searchParams, setSearchParams] = useSearchParams();
    const dateRange = getReportDateRange(searchParams);
    const activeTab = searchParams.get('tab') || 'sales';
    const showTrends = activeTab === 'monthly-sales' || activeTab === 'yearly-sales';
    const setActiveTab = (tab) => updateReportFilter('tab', tab);
    const updateReportFilter = (key, value) => {
        const next = new URLSearchParams(searchParams);
        next.set(key, value);
        setSearchParams(next, { replace: true });
    };
    const productReportSearch = new URLSearchParams({ tab: 'products', ...dateRange }).toString();
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [selectedVendor, setSelectedVendor] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    const componentRef = useRef();

    // Fetch data
    const sales = useLiveQuery(() => getReportSales(db.sales, dateRange), [dateRange.start, dateRange.end]);

    const collections = useLiveQuery(async () => {
        const entries = await db.payments.where('date').between(dateRange.start, dateRange.end, true, true).toArray();
        return entries.reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
    }, [dateRange.start, dateRange.end]);

    const products = useLiveQuery(() => db.products.toArray());
    const customers = useLiveQuery(() => db.customers.toArray());
    const vendors = useLiveQuery(() => db.vendors.toArray());
    const vendorBills = useLiveQuery(() => db.vendor_purchases.toArray());

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Customer_History_${selectedCustomer}_${dateRange.start}_${dateRange.end}`,
    });

    const purchasesInRange = useMemo(() => vendorBills?.filter(
        bill => bill.date >= dateRange.start && bill.date <= dateRange.end
    ), [vendorBills, dateRange.start, dateRange.end]);

    // Aggregation Logic
    const stats = useMemo(() => {
        if (!sales || !products || !customers || !purchasesInRange) return null;

        const summary = {
            revenue: 0,
            paid: 0,
            balance: 0,
            count: sales.length
        };

        const productStats = new Map();
        const getProductStats = (id) => {
            const key = String(id);
            if (!productStats.has(key)) {
                productStats.set(key, {
                    id: key,
                    name: products.find(product => String(product.id) === key)?.name || 'Unknown',
                    sold: {},
                    bought: {},
                    revenue: 0
                });
            }
            return productStats.get(key);
        };

        for (const bill of purchasesInRange) {
            for (const item of bill.items ?? []) {
                const { bought } = getProductStats(item.productId);
                bought[item.unit] = (bought[item.unit] || 0) + (Number(item.qty) || 0);
            }
        }
        const customerStats = {};

        sales.forEach(sale => {
            summary.revenue += sale.subtotal || 0;
            summary.paid += sale.paidAmount || 0;
            summary.balance += ((sale.grandTotal || 0) - (sale.paidAmount || 0));

            for (const item of sale.items ?? []) {
                const product = getProductStats(item.productId);
                product.sold[item.unit] = (product.sold[item.unit] || 0) + (Number(item.qty) || 0);
                product.revenue += saleLineAmount(item);
            }

            // Customer Aggregation
            if (!customerStats[sale.customerId]) {
                customerStats[sale.customerId] = {
                    id: sale.customerId,
                    name: customers.find(c => c.id === sale.customerId)?.name || 'Unknown',
                    count: 0,
                    total: 0
                };
            }
            customerStats[sale.customerId].count += 1;
            customerStats[sale.customerId].total += sale.subtotal || 0;
        });

        return {
            summary,
            products: [...productStats.values()].sort((a, b) => b.revenue - a.revenue),
            customers: Object.values(customerStats).sort((a, b) => b.total - a.total)
        };
    }, [sales, products, customers, purchasesInRange]);

    // Daily summary aggregation
    const dailyStats = useMemo(() => {
        if (!sales || !purchasesInRange) return null;
        const dailyMap = new Map();
        const getDay = (date) => {
            if (!dailyMap.has(date)) dailyMap.set(date, { date, sales: 0, vendorBills: 0 });
            return dailyMap.get(date);
        };
        for (const sale of sales) {
            getDay(sale.date).sales += Number(sale.subtotal) || 0;
        }
        for (const bill of purchasesInRange) {
            getDay(bill.date).vendorBills += purchaseAmount(bill);
        }
        return [...dailyMap.values()]
            .map(day => ({ ...day, netProfit: day.sales - day.vendorBills }))
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [sales, purchasesInRange]);

    // Fetch specific customer data for Balance Calculation (All Time) & History (Filtered)
    const customerRecords = useLiveQuery(async () => {
        if (!selectedCustomer) return { sales: [], payments: [] };
        const id = parseInt(selectedCustomer);
        const [allSales, allPayments] = await Promise.all([
            db.sales.where('customerId').equals(id).toArray(),
            db.payments.where('customerId').equals(id).toArray()
        ]);
        return { sales: allSales, payments: allPayments };
    }, [selectedCustomer]);

    // Calculate All-Time Outstanding Balance
    const currentOutstanding = useMemo(() => {
        if (!customerRecords || !customerRecords.sales) return 0;

        const { sales: allSales, payments: allPayments } = customerRecords;

        return customerOutstandingCents(allSales, allPayments) / 100;
    }, [customerRecords]);

    // Filter History for Display based on Date Range
    const customerHistory = useMemo(() => {
        if (!customerRecords) return [];

        const { sales: allSales, payments: allPayments } = customerRecords;

        // Filter by date range
        const filteredSales = allSales.filter(s => s.date >= dateRange.start && s.date <= dateRange.end);
        const filteredPayments = allPayments.filter(p => p.date >= dateRange.start && p.date <= dateRange.end);

        const mappedSales = filteredSales.map(s => {
            let amount = parseFloat(s.subtotal);
            if (isNaN(amount)) {
                amount = (parseFloat(s.grandTotal) || 0) - (parseFloat(s.prevBalance) || 0);
            }
            return {
                ...s,
                type: 'SALE',
                description: `Invoice #${s.id}`,
                amount: amount,
                debit: amount,
                credit: 0,
                dateObj: new Date(s.date)
            };
        });

        const mappedPayments = filteredPayments.map(p => ({
            ...p,
            type: 'PAYMENT',
            description: p.memo || '-',
            amount: p.amount || 0,
            debit: 0,
            credit: p.amount || 0,
            dateObj: new Date(p.date)
        }));

        return [...mappedSales, [...mappedPayments]].flat().sort((a, b) => b.dateObj - a.dateObj);

    }, [customerRecords, dateRange]);

    const filteredVendorBills = useMemo(() => (purchasesInRange ?? [])
        .filter(bill => !selectedVendor || String(bill.vendorId) === String(selectedVendor))
        .sort((a, b) => b.date.localeCompare(a.date)), [purchasesInRange, selectedVendor]);

    const totalVendorBills = filteredVendorBills.reduce((sum, bill) => sum + purchaseAmount(bill), 0);
    const totalBillsForNetProfit = purchasesInRange?.reduce((sum, bill) => sum + purchaseAmount(bill), 0) ?? 0;

    const getProductName = (id) => {
        return products?.find(p => p.id === id)?.name || 'Unknown Product';
    };


    if (!stats && !showTrends) return <div className="p-8 text-center">Loading reports...</div>;

    return (
        <div className="p-4 max-w-6xl mx-auto pb-24">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                <TrendingUp className="text-blue-600" /> Reports & Analytics
            </h1>

            {/* Controls */}
            {!showTrends && <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
                    <div className="flex gap-4 w-full md:w-auto">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => updateReportFilter('start', e.target.value)}
                                className="p-2 border rounded-md text-sm w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">End Date</label>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => updateReportFilter('end', e.target.value)}
                                className="p-2 border rounded-md text-sm w-full"
                            />
                        </div>

                        {activeTab === 'history' && (
                            <div className="md:ml-4">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Select Customer</label>
                                <select
                                    value={selectedCustomer}
                                    onChange={(e) => {
                                        setSelectedCustomer(e.target.value);
                                        // Reset details view when changing customer
                                        setShowDetails(false);
                                    }}
                                    className="p-2 border rounded-md text-sm w-full min-w-[200px]"
                                >
                                    <option value="">-- Choose Customer --</option>
                                    {customers?.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {activeTab === 'vendor-bills' && (
                            <div className="md:ml-4">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Select Vendor</label>
                                <select
                                    value={selectedVendor}
                                    onChange={(e) => setSelectedVendor(e.target.value)}
                                    className="p-2 border rounded-md text-sm w-full min-w-[200px]"
                                >
                                    <option value="">-- All Vendors --</option>
                                    {vendors?.map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {activeTab === 'history' && selectedCustomer && (
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={showDetails}
                                    onChange={(e) => setShowDetails(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                />
                                Show Details
                            </label>
                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
                            >
                                <Printer size={16} /> Print Report
                            </button>
                        </div>
                    )}
                </div>

                {/* Summary Cards (Only show for non-history tabs or keep as is? Keeping for now) */}
                {activeTab !== 'history' && (
                    <div className="flex gap-4 w-full overflow-x-auto pb-2 md:pb-0">
                        <div className="bg-green-50 p-3 rounded-lg border border-green-100 min-w-[120px]">
                            <p className="text-xs text-green-600 font-bold uppercase">Revenue</p>
                            <p className="text-lg font-bold text-green-900">RM {stats.summary.revenue.toFixed(2)}</p>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 min-w-[120px]">
                            <p className="text-xs text-purple-600 font-bold uppercase">Net Profit</p>
                            <p className="text-lg font-bold text-purple-900">RM {(stats.summary.revenue - totalBillsForNetProfit).toFixed(2)}</p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 min-w-[120px]">
                            <p className="text-xs text-blue-600 font-bold uppercase">Paid</p>
                            <p className="text-lg font-bold text-blue-900">RM {stats.summary.paid.toFixed(2)}</p>
                        </div>
                        <div className="bg-teal-50 p-3 rounded-lg border border-teal-100 min-w-[140px]">
                            <p className="text-xs text-teal-700 font-bold uppercase">Payments Received</p>
                            <p className="text-lg font-bold text-teal-900">{collections === undefined ? '—' : `RM ${collections.toFixed(2)}`}</p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 min-w-[120px]">
                            <p className="text-xs text-red-600 font-bold uppercase">Balance</p>
                            <p className="text-lg font-bold text-red-900">RM {stats.summary.balance.toFixed(2)}</p>
                        </div>
                    </div>
                )}
            </div>}

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b overflow-x-auto">
                <button
                    onClick={() => setActiveTab('sales')}
                    className={`px-4 py-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'sales' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <DollarSign size={16} /> Sales
                </button>
                {[['monthly-sales', 'Monthly Sales'], ['yearly-sales', 'Yearly Sales']].map(([tab, label]) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        aria-pressed={activeTab === tab}
                        className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium ${activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        <TrendingUp size={16} /> {label}
                    </button>
                ))}
                <button
                    onClick={() => setActiveTab('products')}
                    className={`px-4 py-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'products' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Package size={16} /> Products
                </button>
                <button
                    onClick={() => setActiveTab('customers')}
                    className={`px-4 py-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'customers' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Users size={16} /> Customers
                </button>
                <button
                    onClick={() => setActiveTab('daily')}
                    className={`px-4 py-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'daily' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Calendar size={16} /> Daily Summary
                </button>
                <button
                    onClick={() => setActiveTab('vendor-bills')}
                    className={`px-4 py-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'vendor-bills' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <ShoppingBag size={16} /> Vendor Bills
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <History size={16} /> Customer History
                </button>
            </div>

            {/* Content */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {showTrends && <SalesTrends mode={activeTab === 'monthly-sales' ? 'monthly' : 'yearly'} />}
                {activeTab === 'sales' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                                <tr>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Customer</th>
                                    <th className="p-3 text-right">Total</th>
                                    <th className="p-3 text-right">Paid</th>
                                    <th className="p-3 text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {sales.map(sale => (
                                    <tr key={sale.id} className="hover:bg-gray-50">
                                        <td className="p-3">{formatDateShort(new Date(sale.date))}</td>
                                        <td className="p-3 font-medium">
                                            {customers?.find(c => c.id === sale.customerId)?.name || 'Unknown'}
                                        </td>
                                        <td className="p-3 text-right font-bold">RM {(sale.grandTotal || 0).toFixed(2)}</td>
                                        <td className="p-3 text-right text-green-600">RM {(sale.paidAmount || 0).toFixed(2)}</td>
                                        <td className="p-3 text-right text-red-600">RM {((sale.grandTotal || 0) - (sale.paidAmount || 0)).toFixed(2)}</td>
                                    </tr>
                                ))}
                                {sales.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center text-gray-500">No sales found in this period.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                {activeTab === 'daily' && dailyStats && (
                    <div className="overflow-x-auto mt-6">
                        <p className="mb-3 text-sm text-gray-600">Daily net profit is sales minus vendor purchases recorded on the same date.</p>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                                <tr>
                                    <th className="p-3">Date</th>
                                    <th className="p-3 text-right">Vendor Bills (RM)</th>
                                    <th className="p-3 text-right">Sales (RM)</th>
                                    <th className="p-3 text-right">Net Profit (RM)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {dailyStats.map(day => (
                                    <tr key={day.date} className="hover:bg-gray-50">
                                        <td className="p-3">{day.date}</td>
                                        <td className="p-3 text-right">RM {day.vendorBills.toFixed(2)}</td>
                                        <td className="p-3 text-right">RM {day.sales.toFixed(2)}</td>
                                        <td className="p-3 text-right font-bold text-green-700">RM {day.netProfit.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {dailyStats.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="p-8 text-center text-gray-500">No data for selected date range.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'products' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                                <tr>
                                    <th className="p-3">Product Name</th>
                                    <th className="p-3 text-center">Units Sold</th>
                                    <th className="p-3 text-center">Units Bought</th>
                                    <th className="p-3 text-right">Total Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {stats.products.map(product => (
                                    <tr key={product.id} className="hover:bg-gray-50">
                                        <td className="p-3 font-medium">
                                            <Link
                                                to={`/reports/products/${encodeURIComponent(product.id)}?${productReportSearch}`}
                                                className="inline-block py-1 text-blue-700 underline underline-offset-2 hover:text-blue-900"
                                            >
                                                {product.name}
                                            </Link>
                                        </td>
                                        <td className="p-3 text-center">{formatQuantities(product.sold)}</td>
                                        <td className="p-3 text-center">{formatQuantities(product.bought)}</td>
                                        <td className="p-3 text-right font-bold">RM {product.revenue.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {stats.products.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="p-8 text-center text-gray-500">No product data available.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'customers' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                                <tr>
                                    <th className="p-3">Customer Name</th>
                                    <th className="p-3 text-center">Orders</th>
                                    <th className="p-3 text-right">Total Spent</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {stats.customers.map(customer => (
                                    <tr key={customer.id} className="hover:bg-gray-50">
                                        <td className="p-3 font-medium">{customer.name}</td>
                                        <td className="p-3 text-center">{customer.count}</td>
                                        <td className="p-3 text-right font-bold">RM {customer.total.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {stats.customers.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="p-8 text-center text-gray-500">No customer data available.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'vendor-bills' && (
                    <div className="overflow-x-auto">
                        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-700">Vendor Bills List</h3>
                            <p className="font-bold text-lg text-red-600">Total: RM {totalVendorBills.toFixed(2)}</p>
                        </div>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                                <tr>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Vendor</th>
                                    <th className="p-3">Reference / Memo</th>
                                    <th className="p-3 text-right">Amount (RM)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredVendorBills.map(bill => (
                                    <tr key={bill.id} className="hover:bg-gray-50">
                                        <td className="p-3">{formatDateShort(new Date(bill.date))}</td>
                                        <td className="p-3 font-medium">
                                            {vendors?.find(v => String(v.id) === String(bill.vendorId))?.name || 'Unknown'}
                                        </td>
                                        <td className="p-3 text-gray-600">{bill.memo || '-'}</td>
                                        <td className="p-3 text-right font-bold text-red-600">{purchaseAmount(bill).toFixed(2)}</td>
                                    </tr>
                                ))}
                                {filteredVendorBills.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="p-8 text-center text-gray-500">No vendor bills found in this period.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div ref={componentRef} className="p-4 bg-white print:p-8">
                        {/* Print Header */}
                        <div className="hidden print:block mb-8">
                            <h1 className="text-2xl font-bold uppercase tracking-wider mb-4 text-center">Transaction History</h1>
                            <h2 className="text-xl font-bold mb-2">{customers?.find(c => String(c.id) === String(selectedCustomer))?.name || 'Unknown Customer'}</h2>

                            <div className="flex justify-between items-end border-b-2 border-black pb-4">
                                <div className="text-sm">
                                    <p className="text-gray-600">Period:</p>
                                    <p className="font-semibold">{formatDateShort(new Date(dateRange.start))} to {formatDateShort(new Date(dateRange.end))}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-gray-600 text-sm">Current Outstanding</p>
                                    <p className="text-2xl font-bold">RM {currentOutstanding.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        {/* On-screen Header for Context (Simplified) */}
                        <div className="print:hidden mb-4 p-4 bg-gray-50 rounded-lg border flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg">{customers?.find(c => String(c.id) === String(selectedCustomer))?.name || 'Unknown Customer'}</h3>
                                <p className="text-sm text-gray-500">{dateRange.start} to {dateRange.end}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-500 uppercase font-bold">Current Outstanding</p>
                                <p className={`text-xl font-bold ${currentOutstanding > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                    RM {currentOutstanding.toFixed(2)}
                                </p>
                            </div>
                        </div>

                        {!selectedCustomer ? (
                            <div className="p-12 text-center text-gray-400">
                                <History size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Select a customer to view their transaction history.</p>
                            </div>
                        ) : customerHistory.length === 0 ? (
                            <div className="p-12 text-center text-gray-400">
                                <p>No transactions found for this customer in the selected period.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-300 print:bg-white print:border-black">
                                        <tr>
                                            <th className="p-3 border-b border-gray-300">Date</th>
                                            <th className="p-3 border-b border-gray-300">Type</th>
                                            <th className="p-3 border-b border-gray-300 w-1/3">Reference / Memo</th>
                                            <th className="p-3 border-b border-gray-300 text-right">Amount (RM)</th>
                                            <th className="p-3 border-b border-gray-300 text-center print:hidden">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 print:divide-gray-300">
                                        {customerHistory.map((item) => (
                                            <React.Fragment key={`${item.type}-${item.id}`}>
                                                <tr className={`hover:bg-gray-50 print:hover:bg-white ${showDetails ? 'bg-gray-50/50' : ''}`}>
                                                    <td className="p-3 align-top whitespace-nowrap">{formatDateShort(item.dateObj)}</td>
                                                    <td className="p-3 align-top">
                                                        <span className={`font-bold text-xs px-2 py-1 rounded print:border print:px-1 print:py-0 ${item.type === 'SALE' ? 'bg-blue-100 text-blue-700 print:text-black print:bg-transparent' : 'bg-green-100 text-green-700 print:text-black print:bg-transparent'}`}>
                                                            {item.type}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 align-top">
                                                        <div className="font-medium text-gray-900">{item.description}</div>
                                                        {item.type === 'SALE' && item.memo && !showDetails && <div className="text-gray-500 italic text-xs mt-1">{item.memo}</div>}
                                                    </td>
                                                    <td className="p-3 align-top text-right font-medium">
                                                        {item.amount.toFixed(2)}
                                                    </td>
                                                    <td className="p-3 align-top text-center print:hidden">
                                                        {/* Actions placeholder */}
                                                    </td>
                                                </tr>
                                                {/* Detailed View Row */}
                                                {showDetails && (
                                                    <tr className="print:border-b-0">
                                                        <td colSpan="5" className="p-0 border-b-0">
                                                            <div className="pl-12 pr-4 pb-4 pt-1 bg-gray-50/30 print:bg-white print:pl-8">
                                                                {item.type === 'SALE' && item.items && (
                                                                    <table className="w-full text-xs bg-white border rounded print:border-gray-300">
                                                                        <thead className="bg-gray-50 text-gray-600 print:bg-gray-100">
                                                                            <tr>
                                                                                <th className="p-2 text-left">Product</th>
                                                                                <th className="p-2 text-center">Qty</th>
                                                                                <th className="p-2 text-right">Price</th>
                                                                                <th className="p-2 text-right">Total</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y">
                                                                            {item.items.map((lineItem, idx) => (
                                                                                <tr key={idx}>
                                                                                    <td className="p-2 font-medium">{getProductName(lineItem.productId)}</td>
                                                                                    <td className="p-2 text-center">{lineItem.qty} {lineItem.unit}</td>
                                                                                    <td className="p-2 text-right">{lineItem.price.toFixed(2)}</td>
                                                                                    <td className="p-2 text-right font-semibold">
                                                                                        {((lineItem.qty * lineItem.price) - (lineItem.discount || 0)).toFixed(2)}
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                            {item.memo && (
                                                                                <tr>
                                                                                    <td colSpan="4" className="p-2 text-gray-500 italic border-t">
                                                                                        Note: {item.memo}
                                                                                    </td>
                                                                                </tr>
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                )}
                                                                {item.type === 'PAYMENT' && item.memo && (
                                                                    <div className="p-2 bg-white border rounded text-xs text-gray-600 italic print:border-gray-300">
                                                                        Memo: {item.memo}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
