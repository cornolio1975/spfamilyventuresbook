import { formatRinggit } from '../utils/formatRinggit';
import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import VendorPaymentDialog from '../components/VendorPaymentDialog';
import { formatDateShort } from '../utils/dateUtils';
import { vendorBalancesCents } from '../utils/vendorBalances';
import { Plus, Edit, Trash2, Upload, Download, Search, Phone, Mail, MapPin } from 'lucide-react';

export default function Vendors() {
    const vendors = useLiveQuery(() => db.vendors.toArray());
    const ledger = useLiveQuery(() => db.transaction('r', db.vendor_purchases, db.vendor_payments, async () => ({
        bills: await db.vendor_purchases.toArray(),
        payments: await db.vendor_payments.toArray()
    })));
    const [paymentDialog, setPaymentDialog] = useState(null);
    const [notice, setNotice] = useState('');
    const [actionError, setActionError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef(null);

    // Form State
    const [formData, setFormData] = useState({ name: '', contact: '', email: '', address: '' });

    const handleOpenModal = (vendor = null) => {
        if (vendor) {
            setEditingVendor(vendor);
            setFormData({
                name: vendor.name,
                contact: vendor.contact,
                email: vendor.email || '',
                address: vendor.address || ''
            });
        } else {
            setEditingVendor(null);
            setFormData({ name: '', contact: '', email: '', address: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingVendor(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingVendor) {
                await db.vendors.update(editingVendor.id, formData);
            } else {
                await db.vendors.add(formData);
            }
            handleCloseModal();
        } catch (error) {
            console.error('Failed to save vendor:', error);
            alert('Error saving vendor');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this vendor profile?')) return;
        setNotice('');
        setActionError('');
        try {
            await db.transaction('rw', db.vendors, db.vendor_purchases, db.vendor_payments, async () => {
                const linked = record => String(record.vendorId) === String(id);
                const [bill, payment] = await Promise.all([
                    db.vendor_purchases.filter(linked).first(),
                    db.vendor_payments.filter(linked).first()
                ]);
                if (bill || payment) throw new Error('This vendor has linked bills or payments. Its profile is needed for those records.');
                await db.vendors.delete(id);
            });
            setNotice('Vendor deleted.');
        } catch (error) {
            setActionError(error.message);
        }
    };

    const handleExport = () => {
        const dataStr = JSON.stringify(vendors, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'vendors_backup.json';
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
                    await db.vendors.bulkPut(data);
                    alert('Vendors imported successfully!');
                } else {
                    alert('Invalid file format');
                }
            } catch (error) {
                console.error('Import failed:', error);
                alert('Failed to import vendors');
            }
        };
        reader.readAsText(file);
        e.target.value = null; // Reset input
    };

    const filteredVendors = vendors?.filter(v =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(v.contact ?? '').includes(searchTerm)
    ) || [];
    const balances = ledger && vendorBalancesCents(ledger.bills, ledger.payments, formatDateShort(new Date()));
    const totalOutstanding = balances && [...balances.values()].reduce((sum, cents) => sum + Math.max(0, cents), 0);
    const dialogVendor = vendors?.find(vendor => vendor.id === paymentDialog?.vendorId);
    const openPaymentDialog = (vendorId, mode) => {
        setNotice('');
        setActionError('');
        setPaymentDialog({ vendorId, mode });
    };

    return (
        <div className="p-4 pb-24 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Vendors</h1>
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
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
                    >
                        <Plus size={18} /> Add Vendor
                    </button>
                </div>
            </div>

            <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-800">Total Vendor Outstanding</p>
                <p className="text-2xl font-bold text-blue-950">
                    {balances ? formatRinggit(totalOutstanding / 100) : 'Loading…'}
                </p>
            </div>
            {notice && <p role="status" className="mb-4 text-sm text-green-700">{notice}</p>}
            {actionError && <p role="alert" className="mb-4 text-sm text-red-700">{actionError}</p>}

            {/* Search */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Search vendors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>

            {/* Vendor List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVendors.map(vendor => (
                    <div key={vendor.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold text-lg text-gray-800">{vendor.name}</h3>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => handleOpenModal(vendor)}
                                    aria-label={`Edit profile for ${vendor.name}`}
                                    title="Edit profile"
                                    className="text-blue-600 hover:text-blue-800 p-1"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(vendor.id)}
                                    aria-label={`Delete ${vendor.name}`}
                                    title="Delete vendor"
                                    className="text-red-600 hover:text-red-800 p-1"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <Phone size={14} className="text-gray-400" />
                                <span>{vendor.contact}</span>
                            </div>
                            {vendor.email && (
                                <div className="flex items-center gap-2">
                                    <Mail size={14} className="text-gray-400" />
                                    <span>{vendor.email}</span>
                                </div>
                            )}
                            {vendor.address && (
                                <div className="flex items-start gap-2">
                                    <MapPin size={14} className="text-gray-400 mt-1" />
                                    <span className="flex-1">{vendor.address}</span>
                                </div>
                            )}
                        </div>
                        <dl className="mt-3 flex justify-between gap-2 border-t pt-3 text-sm">
                            <dt>Outstanding</dt>
                            <dd className="font-bold text-gray-900">
                                {balances ? formatRinggit((balances.get(String(vendor.id)) ?? 0) / 100) : 'Loading…'}
                            </dd>
                        </dl>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" disabled={!ledger} onClick={() => openPaymentDialog(vendor.id, 'payment')}
                                className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                                Record Payment
                            </button>
                            <button type="button" disabled={!ledger} onClick={() => openPaymentDialog(vendor.id, 'history')}
                                className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-800 disabled:opacity-50">
                                Payment History
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filteredVendors.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    No vendors found. Add one to get started.
                </div>
            )}

            {dialogVendor && ledger && (
                <VendorPaymentDialog
                    vendor={dialogVendor}
                    mode={paymentDialog.mode}
                    bills={ledger.bills.filter(bill => String(bill.vendorId) === String(dialogVendor.id))}
                    payments={ledger.payments.filter(payment => String(payment.vendorId) === String(dialogVendor.id))}
                    onClose={(message = '') => {
                        setPaymentDialog(null);
                        setNotice(message);
                    }}
                />
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold mb-4">{editingVendor ? 'Edit Vendor' : 'Add Vendor'}</h2>
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
        </div>
    );
}
