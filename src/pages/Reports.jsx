import React, { useState, useMemo } from 'react';
import { formatDateShort } from '../utils/dateUtils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Calendar, TrendingUp, Users, Package, DollarSign } from 'lucide-react';

export default function Reports() {
    const [dateRange, setDateRange] = useState({
        start: formatDateShort(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
        end: formatDateShort(new Date())
    });
    const [activeTab, setActiveTab] = useState('sales'); // options: 'sales', 'products', 'customers', 'daily'

    // Fetch data
    const sales = useLiveQuery(async () => {
        const results = await db.sales
            .where('date')
            .between(dateRange.start, dateRange.end, true, true)
            .toArray();
        // Sort by date descending (latest first)
        return results.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [dateRange]);

    const products = useLiveQuery(() => db.products.toArray());
    const customers = useLiveQuery(() => db.customers.toArray());
    const vendorBills = useLiveQuery(() => db.vendor_purchases.toArray());

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

    if (!stats) return <div className="p-8 text-center">Loading reports...</div>;

    return (
        <div className="p-4 max-w-6xl mx-auto pb-24">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                <TrendingUp className="text-blue-600" /> Reports & Analytics
            </h1>

            {/* Controls */}
            <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
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
                </div>

                {/* Summary Cards */}
                <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
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
            <div className="flex gap-2 mb-6 border-b">
                <button
                    onClick={() => setActiveTab('sales')}
                    className={`px-4 py-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'sales' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <DollarSign size={16} /> Sales
                </button>
                <button
                    onClick={() => setActiveTab('products')}
                    className={`px-4 py-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'products' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Package size={16} /> Products
                </button>
                <button
                    onClick={() => setActiveTab('customers')}
                    className={`px-4 py-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'customers' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Users size={16} /> Customers
                </button>
                <button
                    onClick={() => setActiveTab('daily')}
                    className={`px-4 py-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'daily' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Calendar size={16} /> Daily Summary
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
            </div>
        </div>
    );
}
