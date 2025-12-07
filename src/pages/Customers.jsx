import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatDateShort } from '../utils/dateUtils';
import { Plus, Edit, Trash2, Upload, Download, Search, Phone, Mail, MapPin, DollarSign, Wallet } from 'lucide-react';

export default function Customers() {
    const customers = useLiveQuery(() => db.customers.toArray());
    const sales = useLiveQuery(() => db.sales.toArray());
    const payments = useLiveQuery(() => db.payments.toArray());

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef(null);

    // Form State
    const [formData, setFormData] = useState({ name: '', contact: '', email: '', address: '' });
    const [paymentData, setPaymentData] = useState({
        customerId: '',
        date: formatDateShort(new Date()),
        amount: '',
        memo: ''
    });

    const handleOpenModal = (customer = null) => {
        if (customer) {
            setEditingCustomer(customer);
            setFormData({
                name: customer.name,
                contact: customer.contact,
                email: customer.email || '',
                address: customer.address || ''
            });
        } else {
            setEditingCustomer(null);
            setFormData({ name: '', contact: '', email: '', address: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCustomer(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingCustomer) {
                await db.customers.update(editingCustomer.id, formData);
            } else {
                await db.customers.add(formData);
            }
            handleCloseModal();
        } catch (error) {
            console.error('Failed to save customer:', error);
            alert('Error saving customer');
        }
    };

    const handleOpenPaymentModal = () => {
        setPaymentData({
            customerId: '',
            date: formatDateShort(new Date()),
            amount: '',
            memo: ''
        });
        setIsPaymentModalOpen(true);
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        try {
            const amount = parseFloat(paymentData.amount);
            if (!paymentData.customerId) {
                alert('Please select a customer');
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                alert('Please enter a valid amount');
                return;
            }

            // Save customerId as is (string or number matches the ID type)
            // But we must ensure it matches the customer.id type.
            // For now, let's rely on flexible comparison in view, but try to keep it clean in DB.
            // If customer.id is number, we should ideally save number.
            // Let's find the customer object to get the real ID type
            const customer = customers.find(c => String(c.id) === String(paymentData.customerId));
            const realId = customer ? customer.id : paymentData.customerId;

            await db.payments.add({
                customerId: realId,
                date: paymentData.date,
                amount: amount,
                memo: paymentData.memo
            });
            setIsPaymentModalOpen(false);
            alert('Payment recorded successfully!');
        } catch (error) {
            console.error('Failed to save payment:', error);
            alert(`Error saving payment: ${error.message}`);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this customer?')) {
            await db.customers.delete(id);
        }
    };

    const handleExport = () => {
        const dataStr = JSON.stringify(customers, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'customers_backup.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    await db.customers.bulkPut(data);
                    alert('Customers imported successfully!');
                } else {
                    alert('Invalid file format');
                }
            } catch (error) {
                console.error('Import failed:', error);
                alert('Failed to import customers');
            }
        };
        reader.readAsText(file);
        e.target.value = null; // Reset input
    };

    const calculateOutstanding = (customerId) => {
        if (!sales || !payments) return 0;

        const customerSales = sales.filter(s => String(s.customerId) === String(customerId));
        const customerPayments = payments.filter(p => String(p.customerId) === String(customerId));

        const totalSales = customerSales.reduce((sum, s) => sum + (parseFloat(s.grandTotal) || 0), 0);
        const totalPayments = customerPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

        return totalSales - totalPayments;
    };

    const filteredCustomers = customers?.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.contact.includes(searchTerm)
    ) || [];

    return (
        <div className="p-4 pb-24 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => fileInputRef.current.click()}
                        className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                        <Upload size={16} /> Import
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".json"
                        onChange={handleImport}
                    />
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                        <Download size={16} /> Export
                    </button>
                    <button
                        onClick={handleOpenPaymentModal}
                        className="flex items-center gap-1 px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                    >
                        <Wallet size={16} /> Receive Payment
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
                    >
                        <Plus size={18} /> Add Customer
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Search customers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>

            {/* Customer List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCustomers.map(customer => (
                    <div key={customer.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold text-lg text-gray-800">{customer.name}</h3>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => handleOpenModal(customer)}
                                    className="text-blue-600 hover:text-blue-800 p-1"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(customer.id)}
                                    className="text-red-600 hover:text-red-800 p-1"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <Phone size={14} className="text-gray-400" />
                                <span>{customer.contact}</span>
                            </div>
                            {customer.email && (
                                <div className="flex items-center gap-2">
                                    <Mail size={14} className="text-gray-400" />
                                    <span>{customer.email}</span>
                                </div>
                            )}
                            {customer.address && (
                                <div className="flex items-start gap-2">
                                    <MapPin size={14} className="text-gray-400 mt-1" />
                                    <span className="flex-1">{customer.address}</span>
                                </div>
                            )}
                            <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between items-center">
                                <span className="text-xs font-medium text-gray-500">Outstanding:</span>
                                <span className={`font-bold ${calculateOutstanding(customer.id) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                    RM {calculateOutstanding(customer.id).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredCustomers.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    No customers found. Add one to get started.
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold mb-4">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contact No.</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.contact}
                                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Address (Optional)</label>
                                <textarea
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows="3"
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

            {/* Payment Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center gap-2 mb-4 text-green-700">
                            <Wallet size={24} />
                            <h2 className="text-xl font-bold">Receive Payment</h2>
                        </div>
                        <form onSubmit={handlePaymentSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                                <select
                                    required
                                    value={paymentData.customerId}
                                    onChange={(e) => setPaymentData({ ...paymentData, customerId: e.target.value })}
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Select Customer</option>
                                    {customers?.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} (Outstanding: RM {calculateOutstanding(c.id).toFixed(2)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <input
                                    type="date"
                                    required
                                    value={paymentData.date}
                                    onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (RM)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={paymentData.amount}
                                        onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                                        className="w-full pl-10 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Memo (Optional)</label>
                                <textarea
                                    value={paymentData.memo}
                                    onChange={(e) => setPaymentData({ ...paymentData, memo: e.target.value })}
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows="2"
                                    placeholder="Payment method, ref no, etc."
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsPaymentModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                    Save Payment
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
