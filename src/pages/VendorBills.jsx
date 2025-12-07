import React, { useState } from 'react';
import { formatDateShort } from '../utils/dateUtils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Search, Trash2, DollarSign, Edit } from 'lucide-react';

export default function VendorBills() {
    const vendorBills = useLiveQuery(() => db.vendor_purchases.orderBy('id').reverse().toArray());
    const vendors = useLiveQuery(() => db.vendors.toArray());
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBill, setEditingBill] = useState(null);
    const [formData, setFormData] = useState({
        vendorId: '',
        date: formatDateShort(new Date()),
        total: '',
        memo: ''
    });

    const getVendorName = (id) => {
        return vendors?.find(v => v.id === id)?.name || 'Unknown Vendor';
    };

    const handleOpenModal = (bill = null) => {
        if (bill) {
            setEditingBill(bill);
            setFormData({
                vendorId: bill.vendorId,
                date: bill.date,
                total: bill.total,
                memo: bill.memo || ''
            });
        } else {
            setEditingBill(null);
            setFormData({
                vendorId: '',
                date: formatDateShort(new Date()),
                total: '',
                memo: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingBill(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            console.log('Saving vendor bill:', formData);

            const vendorId = parseInt(formData.vendorId);
            const total = parseFloat(formData.total);

            if (!vendorId || isNaN(vendorId)) {
                alert('Please select a valid vendor.');
                return;
            }

            if (isNaN(total)) {
                alert('Please enter a valid total amount.');
                return;
            }

            if (!formData.date) {
                alert('Please select a valid date.');
                return;
            }

            const billData = {
                vendorId: vendorId,
                date: String(formData.date), // Ensure date is string
                total: total,
                memo: formData.memo
            };

            if (editingBill) {
                await db.vendor_purchases.update(editingBill.id, billData);
            } else {
                await db.vendor_purchases.add(billData);
            }
            handleCloseModal();
        } catch (error) {
            console.error('Failed to save vendor bill:', error);
            // Diagnostic check
            const dbVer = db.verno;
            const schema = db.vendor_purchases ? JSON.stringify(db.vendor_purchases.schema) : 'Table Missing';

            alert(`DEBUG INFO:\nError: ${error.name} - ${error.message}\n\nDB Version: ${dbVer}\nTable Schema: ${schema}\n\nPlease send me this screenshot!`);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this vendor bill?')) {
            await db.vendor_purchases.delete(id);
        }
    };

    const filteredBills = vendorBills?.filter(b => {
        const vendorName = getVendorName(b.vendorId).toLowerCase();
        const dateStr = formatDateShort(new Date(b.date));
        const memo = b.memo?.toLowerCase() || '';
        return vendorName.includes(searchTerm.toLowerCase()) || dateStr.includes(searchTerm) || memo.includes(searchTerm.toLowerCase());
    }) || [];

    return (
        <div className="p-4 pb-24 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Vendor Bills</h1>
                <button
                    onClick={handleOpenModal}
                    className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
                >
                    <Plus size={18} /> New Bill
                </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Search by vendor, date, or memo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>

            {/* Bills List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 font-medium text-gray-600">Date</th>
                            <th className="px-4 py-3 font-medium text-gray-600">Vendor</th>
                            <th className="px-4 py-3 font-medium text-gray-600">Memo</th>
                            <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                            <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredBills.map(bill => (
                            <tr key={bill.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm">{formatDateShort(new Date(bill.date))}</td>
                                <td className="px-4 py-3 font-medium">{getVendorName(bill.vendorId)}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 italic">{bill.memo || '-'}</td>
                                <td className="px-4 py-3 text-right font-bold text-red-600">
                                    RM {(bill.total || 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-right space-x-2">
                                    <button
                                        onClick={() => handleOpenModal(bill)}
                                        className="text-blue-600 hover:text-blue-800 p-1"
                                        title="Edit"
                                    >
                                        <Edit size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(bill.id)}
                                        className="text-red-600 hover:text-red-800 p-1"
                                        title="Delete"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredBills.length === 0 && (
                            <tr>
                                <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                                    No vendor bills found. Create a new bill to get started.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold mb-4">{editingBill ? 'Edit Vendor Bill' : 'New Vendor Bill'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                                <select
                                    required
                                    value={formData.vendorId}
                                    onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Select Vendor</option>
                                    {vendors?.map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (RM)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={formData.total}
                                        onChange={(e) => setFormData({ ...formData, total: e.target.value })}
                                        className="w-full pl-10 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Memo (Optional)</label>
                                <textarea
                                    value={formData.memo}
                                    onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows="2"
                                    placeholder="Notes or description..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
