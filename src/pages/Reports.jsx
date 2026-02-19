import React, { useState, useMemo, useRef } from 'react';
import { formatDateShort } from '../utils/dateUtils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Calendar, TrendingUp, Users, Package, DollarSign, History, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

export default function Reports() {
    const [dateRange, setDateRange] = useState({
        start: formatDateShort(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
        end: formatDateShort(new Date())
    });
    const [activeTab, setActiveTab] = useState('sales'); // options: 'sales', 'products', 'customers', 'daily', 'history'
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const componentRef = useRef();

    // Fetch data
    const sales = useLiveQuery(async () => {
        const results = await db.sales
            .where('date')
            .between(dateRange.start, dateRange.end, true, true)
            .toArray();
        // Sort by date descending (latest first)
        return results.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [dateRange]);

    const payments = useLiveQuery(async () => {
        const results = await db.payments
            .where('date')
            .between(dateRange.start, dateRange.end, true, true)
            .toArray();
        return results;
    }, [dateRange]);

    const products = useLiveQuery(() => db.products.toArray());
    const customers = useLiveQuery(() => db.customers.toArray());
    const vendorBills = useLiveQuery(() => db.vendor_purchases.toArray());

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Customer_History_${selectedCustomer}_${dateRange.start}_${dateRange.end}`,
    });

    // Aggregation Logic
    const stats = useMemo(() => {
        if (!sales || !products || !customers) return null;

        const summary = {
            revenue: 0,
            paid: 0,
            balance: 0,
            count: sales.length
        };

        const productStats = {};
        const customerStats = {};

        sales.forEach(sale => {
            summary.revenue += sale.subtotal || 0;
            summary.paid += sale.paidAmount || 0;
            summary.balance += ((sale.grandTotal || 0) - (sale.paidAmount || 0));

            // Product Aggregation
            sale.items.forEach(item => {
                if (!productStats[item.productId]) {
                    productStats[item.productId] = {
                        id: item.productId,
                        name: products.find(p => p.id === item.productId)?.name || 'Unknown',
                        qty: 0,
                        revenue: 0,
                        unit: item.unit
                    };
                }
                productStats[item.productId].qty += parseFloat(item.qty) || 0;
                productStats[item.productId].revenue += ((item.qty * item.price) - (item.discount || 0));
            });

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
            products: Object.values(productStats).sort((a, b) => b.revenue - a.revenue),
            customers: Object.values(customerStats).sort((a, b) => b.total - a.total)
        };
    }, [sales, products, customers]);

    // Daily summary aggregation
    const dailyStats = useMemo(() => {
        if (!sales || !vendorBills) return null;
        // Helper to format date string (YYYY-MM-DD)
        const formatKey = (dateStr) => new Date(dateStr).toISOString().split('T')[0];
        const dailyMap = {};
        // Aggregate sales per day
        sales.forEach(sale => {
            const key = formatKey(sale.date);
            if (!dailyMap[key]) dailyMap[key] = { sales: 0, vendorBills: 0 };
            dailyMap[key].sales += sale.subtotal || 0;
        });
        // Aggregate vendor bills per day
        vendorBills.forEach(bill => {
            const key = formatKey(bill.date);
            if (!dailyMap[key]) dailyMap[key] = { sales: 0, vendorBills: 0 };
            dailyMap[key].vendorBills += bill.total || 0;
        });
        // Convert to array sorted by date descending
        const result = Object.entries(dailyMap).map(([date, data]) => ({
            date,
            sales: data.sales,
            vendorBills: data.vendorBills,
            netProfit: data.sales - data.vendorBills
        })).sort((a, b) => new Date(b.date) - new Date(a.date));
        return result;
    }, [sales, vendorBills]);

    // Customer History Aggregation
    const customerHistory = useMemo(() => {
        if (!selectedCustomer || !sales || !payments) return [];

        const customerSales = sales
            .filter(s => String(s.customerId) === String(selectedCustomer))
            .map(s => ({
                ...s,
                type: 'SALE',
                debit: s.grandTotal || 0,
                credit: 0
            }));

        const customerPayments = payments
            .filter(p => String(p.customerId) === String(selectedCustomer))
            .map(p => ({
                ...p,
                type: 'PAYMENT',
                debit: 0,
                credit: p.amount || 0
            }));

        const combined = [...customerSales, ...customerPayments].sort((a, b) => new Date(a.date) - new Date(b.date));

        return combined;

    }, [selectedCustomer, sales, payments]);


    if (!stats) return <div className="p-8 text-center">Loading reports...</div>;

    return (
        <div className="p-4 max-w-6xl mx-auto pb-24">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                <TrendingUp className="text-blue-600" /> Reports & Analytics
            </h1>

            {/* Controls */}
            <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
                    <div className="flex gap-4 w-full md:w-auto">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="p-2 border rounded-md text-sm w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">End Date</label>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="p-2 border rounded-md text-sm w-full"
                            />
                        </div>

                        {activeTab === 'history' && (
                            <div className="md:ml-4">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Select Customer</label>
                                <select
                                    value={selectedCustomer}
                                    onChange={(e) => setSelectedCustomer(e.target.value)}
                                    className="p-2 border rounded-md text-sm w-full min-w-[200px]"
                                >
                                    <option value="">-- Choose Customer --</option>
                                    {customers?.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {activeTab === 'history' && selectedCustomer && (
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
                        >
                            <Printer size={16} /> Print Report
                        </button>
                    )}
                </div>

                {/* Summary Cards */}
                <div className="flex gap-4 w-full overflow-x-auto pb-2 md:pb-0">
                    <div className="bg-green-50 p-3 rounded-lg border border-green-100 min-w-[120px]">
                        <p className="text-xs text-green-600 font-bold uppercase">Revenue</p>
                        <p className="text-lg font-bold text-green-900">RM {stats.summary.revenue.toFixed(2)}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 min-w-[120px]">
                        <p className="text-xs text-blue-600 font-bold uppercase">Paid</p>
                        <p className="text-lg font-bold text-blue-900">RM {stats.summary.paid.toFixed(2)}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 min-w-[120px]">
                        <p className="text-xs text-red-600 font-bold uppercase">Balance</p>
                        <p className="text-lg font-bold text-red-900">RM {stats.summary.balance.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b overflow-x-auto">
                <button
                    onClick={() => setActiveTab('sales')}
                    className={`px-4 py-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'sales' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <DollarSign size={16} /> Sales
                </button>
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
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <History size={16} /> Customer History
                </button>
            </div>

            {/* Content */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
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
                                    <th className="p-3 text-right">Total Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {stats.products.map(product => (
                                    <tr key={product.id} className="hover:bg-gray-50">
                                        <td className="p-3 font-medium">{product.name}</td>
                                        <td className="p-3 text-center">{product.qty.toFixed(2)} {product.unit}</td>
                                        <td className="p-3 text-right font-bold">RM {product.revenue.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {stats.products.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="p-8 text-center text-gray-500">No product data available.</td>
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

                {activeTab === 'history' && (
                    <div ref={componentRef} className="p-4 bg-white print:p-8">
                        {/* Print Header - Visible only when printing */}
                        <div className="hidden print:block text-center mb-8">
                            <h1 className="text-2xl font-bold uppercase tracking-wider mb-2">Transaction History</h1>
                            <div className="text-sm">
                                <p className="font-bold text-lg">{customers?.find(c => String(c.id) === String(selectedCustomer))?.name || 'Unknown Customer'}</p>
                                <p>Period: {dateRange.start} to {dateRange.end}</p>
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
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-bold border-b print:bg-white print:border-black">
                                        <tr>
                                            <th className="p-3">Date</th>
                                            <th className="p-3">Description</th>
                                            <th className="p-3 text-right">Debit (RM)</th>
                                            <th className="p-3 text-right">Credit (RM)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y print:divide-black">
                                        {customerHistory.map((item) => (
                                            <tr key={`${item.type}-${item.id}`} className="hover:bg-gray-50 print:hover:bg-white">
                                                <td className="p-3">{formatDateShort(new Date(item.date))}</td>
                                                <td className="p-3">
                                                    <span className={`font-medium ${item.type === 'SALE' ? 'text-blue-700' : 'text-green-700'} print:text-black`}>
                                                        {item.type}
                                                    </span>
                                                    {item.type === 'SALE' && ` - Invoice #${item.id}`}
                                                    {item.memo && <span className="text-gray-500 italic ml-2 print:text-gray-800">- {item.memo}</span>}
                                                </td>
                                                <td className="p-3 text-right">
                                                    {item.debit > 0 ? item.debit.toFixed(2) : '-'}
                                                </td>
                                                <td className="p-3 text-right">
                                                    {item.credit > 0 ? item.credit.toFixed(2) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Totals Row */}
                                        <tr className="bg-gray-50 font-bold border-t-2 border-gray-200 print:bg-white print:border-black">
                                            <td colSpan="2" className="p-3 text-right">Total</td>
                                            <td className="p-3 text-right">
                                                {customerHistory.reduce((sum, item) => sum + item.debit, 0).toFixed(2)}
                                            </td>
                                            <td className="p-3 text-right">
                                                {customerHistory.reduce((sum, item) => sum + item.credit, 0).toFixed(2)}
                                            </td>
                                        </tr>
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
