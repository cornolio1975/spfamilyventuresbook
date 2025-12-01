import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Search, FileText, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Sales() {
    const sales = useLiveQuery(() => db.sales.reverse().toArray());
    const customers = useLiveQuery(() => db.customers.toArray());
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const getCustomerName = (id) => {
        return customers?.find(c => c.id === id)?.name || 'Unknown Customer';
    };

    const calculateTotalDiscount = (items) => {
        return items?.reduce((sum, item) => sum + (item.discount || 0), 0) || 0;
    };

    const filteredSales = sales?.filter(s => {
        const customerName = getCustomerName(s.customerId).toLowerCase();
        const dateStr = new Date(s.date).toLocaleDateString();
        const memo = s.memo?.toLowerCase() || '';
        return customerName.includes(searchTerm.toLowerCase()) || dateStr.includes(searchTerm) || memo.includes(searchTerm.toLowerCase());
    }) || [];

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this sale record?')) {
            await db.sales.delete(id);
        }
    };

    return (
        <div className="p-4 pb-24 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Sales Dashboard</h1>
                <Link
                    to="/sales/new"
                    className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
                >
                    <Plus size={18} /> New Sale
                </Link>
            </div>

            {/* Search */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Search by customer, date, or memo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>

            {/* Sales List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
                <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 font-medium text-gray-600">Date</th>
                            <th className="px-4 py-3 font-medium text-gray-600">Customer</th>
                            <th className="px-4 py-3 font-medium text-gray-600">Memo</th>
                            <th className="px-4 py-3 font-medium text-gray-600 text-right">Discount</th>
                            <th className="px-4 py-3 font-medium text-gray-600 text-right">Grand Total</th>
                            <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredSales.map(sale => (
                            <tr key={sale.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm">{new Date(sale.date).toLocaleDateString()}</td>
                                <td className="px-4 py-3 font-medium">{getCustomerName(sale.customerId)}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 italic">{sale.memo || '-'}</td>
                                <td className="px-4 py-3 text-right text-red-500 text-sm">
                                    {calculateTotalDiscount(sale.items) > 0 ? `RM ${calculateTotalDiscount(sale.items).toFixed(2)}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-green-600">
                                    RM {sale.grandTotal?.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-right space-x-2">
                                    <button
                                        onClick={() => navigate(`/sales/${sale.id}`)}
                                        className="text-blue-600 hover:text-blue-800 p-1"
                                        title="View Invoice"
                                    >
                                        <FileText size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(sale.id)}
                                        className="text-red-600 hover:text-red-800 p-1"
                                        title="Delete"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredSales.length === 0 && (
                            <tr>
                                <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                                    No sales found. Create a new sale to get started.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
