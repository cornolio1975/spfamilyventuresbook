import { useRef, useState } from 'react';
import { formatDateShort } from '../utils/dateUtils';
import { useLiveQuery } from 'dexie-react-hooks';
import VendorBillAssistant from '../components/VendorBillAssistant';
import { db } from '../db/db';
import { saveReconciledVendorBill } from '../db/vendorAssistantPayments';
import { Plus, Search, Trash2, Edit } from 'lucide-react';

const inputClass = 'w-full rounded-md border p-2';
const roundMoney = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;
const lineAmount = (item) => roundMoney(item.qty * item.price - Number(item.discount));
const blankItem = { productId: '', memo: '', qty: 1, unit: 'Kg', price: '', discount: 0 };

function BillField({ label, children }) {
    return <label className="block text-sm font-medium">{label}{children}</label>;
}

export default function VendorBills() {
    const vendorBills = useLiveQuery(() => db.vendor_purchases.orderBy('id').reverse().toArray());
    const vendorPayments = useLiveQuery(() => db.vendor_payments.orderBy('date').reverse().toArray());
    const vendors = useLiveQuery(() => db.vendors.toArray());
    const products = useLiveQuery(() => db.products.toArray());
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState(null);
    const [editingBill, setEditingBill] = useState(null);
    const [assistantVersion, setAssistantVersion] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const saveInProgress = useRef(false);

    const getVendorName = (id) => vendors?.find(v => String(v.id) === String(id))?.name || 'Unknown Vendor';

    const handleOpenModal = (bill = null, draft = null, reconciliation = null) => {
        setEditingBill(bill);
        setFormData({
            vendorId: draft?.vendorId ?? bill?.vendorId ?? '',
            date: draft?.date ?? bill?.date ?? formatDateShort(new Date()),
            total: bill?.total ?? '',
            memo: bill?.memo ?? '',
            prevBalance: draft ? (draft.previousBalanceCents ?? 0) / 100 : (bill?.prevBalance ?? 0),
            paidAmount: bill?.paidAmount ?? 0,
            items: draft?.items ?? (bill ? (bill.items ?? []) : [{ ...blankItem }]),
            fromAssistant: Boolean(draft),
            reconciliation
        });
    };

    const handleCloseModal = () => {
        setFormData(null);
        setEditingBill(null);
    };

    const updateField = (field, value) => setFormData(data => ({ ...data, [field]: value }));
    const updateItem = (index, field, value) => setFormData(data => ({
        ...data,
        items: data.items.map((item, position) => position === index ? { ...item, [field]: value } : item)
    }));

    const isLegacy = Boolean(editingBill && !editingBill.items?.length);
    const items = formData?.items ?? [];
    const reconciliation = formData?.reconciliation;
    const subtotal = items.length
        ? roundMoney(items.reduce((sum, item) => sum + lineAmount(item), 0))
        : Number(formData?.total ?? 0);
    const grandTotal = roundMoney(subtotal + Number(formData?.prevBalance ?? 0));
    const balanceDue = roundMoney(grandTotal - Number(formData?.paidAmount ?? 0));

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (saveInProgress.current) return;
        const { vendorId, date, memo, prevBalance, paidAmount } = formData;
        const vendor = vendors?.find(record => String(record.id) === String(vendorId));
        if (!vendor || !date || (!isLegacy && !items.length)) {
            alert('Select a vendor and date, and add at least one item.');
            return;
        }
        const normalizedItems = items.map(item => ({
            ...item,
            productId: products?.find(product => String(product.id) === String(item.productId))?.id ?? item.productId,
            qty: Number(item.qty),
            price: Number(item.price),
            discount: Number(item.discount),
            total: lineAmount(item)
        }));
        if (normalizedItems.some(item => !item.productId || item.qty <= 0 || item.price < 0
            || item.discount < 0 || item.discount > item.qty * item.price + 1e-9 || !Number.isFinite(item.total))) {
            alert('Check each item, quantity, price and discount.');
            return;
        }

        const billData = {
            vendorId: vendor.id,
            date,
            memo,
            items: normalizedItems,
            subtotal,
            total: subtotal,
            prevBalance: Number(prevBalance),
            paidAmount: Number(paidAmount),
            grandTotal
        };

        saveInProgress.current = true;
        setIsSaving(true);
        try {
            if (editingBill) {
                await db.vendor_purchases.update(editingBill.id, billData);
            } else if (reconciliation) {
                await saveReconciledVendorBill(db, billData, reconciliation.outstandingCents);
            } else {
                await db.vendor_purchases.add(billData);
            }
            if (formData.fromAssistant) setAssistantVersion(version => version + 1);
            handleCloseModal();
        } catch (error) {
            console.error('Failed to save vendor bill:', error);
            alert(reconciliation ? error.message : 'Unable to save the vendor bill. Please try again.');
        } finally {
            saveInProgress.current = false;
            setIsSaving(false);
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
    }).sort((a, b) => new Date(b.date) - new Date(a.date)) || [];

    return (
        <div className="p-4 pb-24 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Vendor Bills</h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
                >
                    <Plus size={18} /> New Bill
                </button>
            </div>

            <VendorBillAssistant key={assistantVersion} vendors={vendors} products={products}
                onReviewBill={(draft, preview) => handleOpenModal(null, draft, preview)} />

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
                                    RM {Number(bill.grandTotal ?? bill.total ?? 0).toFixed(2)}
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

            {vendorPayments?.length > 0 && (
                <section className="mt-5 rounded-lg border bg-white p-4">
                    <h2 className="mb-2 font-semibold text-gray-800">Vendor Payments</h2>
                    <ul className="divide-y text-sm">
                        {vendorPayments.map(payment => (
                            <li key={payment.id} className="flex flex-wrap justify-between gap-2 py-2">
                                <span>{payment.date} · {getVendorName(payment.vendorId)}</span>
                                <strong>RM {Number(payment.amount).toFixed(2)}</strong>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {formData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div role="dialog" aria-modal="true" aria-labelledby="vendor-bill-title"
                        className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:p-6">
                        <h2 id="vendor-bill-title" className="mb-4 text-xl font-bold">{editingBill ? 'Edit Vendor Bill' : 'New Vendor Bill'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <BillField label="Date">
                                    <input type="date" required disabled={Boolean(reconciliation)} value={formData.date} onChange={e => updateField('date', e.target.value)} className={inputClass} />
                                </BillField>
                                <BillField label="Vendor">
                                    <select required disabled={Boolean(reconciliation)} value={formData.vendorId} onChange={e => updateField('vendorId', e.target.value)} className={inputClass}>
                                        <option value="">Select Vendor</option>
                                        {vendors?.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                                    </select>
                                </BillField>
                            </div>
                            <BillField label="Bill Memo">
                                <textarea rows="2" value={formData.memo} onChange={e => updateField('memo', e.target.value)} className={inputClass} />
                            </BillField>
                            {items.map((item, index) => (
                                <fieldset key={index} className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-4">
                                    <legend className="px-1 text-sm font-semibold">Item {index + 1}</legend>
                                    <div className="col-span-2">
                                        <BillField label="Item">
                                            <select required value={item.productId} onChange={e => updateItem(index, 'productId', e.target.value)} className={inputClass}>
                                                <option value="">Select Item</option>
                                                {item.productId && products && !products.some(product => String(product.id) === String(item.productId)) && (
                                                    <option value={item.productId}>Archived item #{item.productId}</option>
                                                )}
                                                {products?.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
                                            </select>
                                        </BillField>
                                    </div>
                                    <div className="col-span-2">
                                        <BillField label="Item Memo">
                                            <input value={item.memo} onChange={e => updateItem(index, 'memo', e.target.value)} className={inputClass} />
                                        </BillField>
                                    </div>
                                    <BillField label="Qty">
                                        <input type="number" required min="0" step="any" value={item.qty} onChange={e => updateItem(index, 'qty', e.target.value)} className={inputClass} />
                                    </BillField>
                                    <BillField label="Unit">
                                        <select value={item.unit} onChange={e => updateItem(index, 'unit', e.target.value)} className={inputClass}>
                                            <option value="Kg">Kg</option>
                                            <option value="Pcs">Pcs</option>
                                        </select>
                                    </BillField>
                                    <BillField label="Unit Price (RM)">
                                        <input type="number" required min="0" step="0.01" value={item.price} onChange={e => updateItem(index, 'price', e.target.value)} className={inputClass} />
                                    </BillField>
                                    <BillField label="Discount (RM)">
                                        <input type="number" min="0" step="0.01" value={item.discount} onChange={e => updateItem(index, 'discount', e.target.value)} className={inputClass} />
                                    </BillField>
                                    <button type="button" onClick={() => updateField('items', items.filter((_, position) => index !== position))}
                                        className="col-span-2 justify-self-start text-sm text-red-700">Remove item</button>
                                    <output className="col-span-2 text-right text-sm font-semibold">Total RM {lineAmount(item).toFixed(2)}</output>
                                </fieldset>
                            ))}
                            <button type="button" onClick={() => updateField('items', [...items, { ...blankItem }])}
                                className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-medium text-blue-700"><Plus size={16} /> Add Item</button>
                            {isLegacy && !items.length && (
                                <BillField label="Purchase Amount (RM)">
                                    <input type="number" required min="0" step="0.01" value={formData.total} onChange={e => updateField('total', e.target.value)} className={inputClass} />
                                </BillField>
                            )}
                            <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3">
                                <BillField label="Previous Balance (RM)">
                                    <input type="number" step="0.01" readOnly={Boolean(reconciliation)} value={formData.prevBalance} onChange={e => updateField('prevBalance', e.target.value)} className={inputClass} />
                                </BillField>
                                {reconciliation ? (
                                    <span className="text-sm font-medium">
                                        Payment Against Previous Balance
                                        <strong className="mt-2 block">RM {(reconciliation.paymentCents / 100).toFixed(2)}</strong>
                                    </span>
                                ) : (
                                    <BillField label="Amount Paid (RM)">
                                        <input type="number" min="0" step="0.01" value={formData.paidAmount} onChange={e => updateField('paidAmount', e.target.value)} className={inputClass} />
                                    </BillField>
                                )}
                                <span className="col-span-2 flex justify-between text-sm">Subtotal <strong>RM {subtotal.toFixed(2)}</strong></span>
                                <span className="col-span-2 flex justify-between font-bold">Grand Total <span>RM {grandTotal.toFixed(2)}</span></span>
                                <span className="col-span-2 flex justify-between text-sm">Balance Due <strong>RM {balanceDue.toFixed(2)}</strong></span>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" disabled={isSaving} onClick={handleCloseModal} className="rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100">Cancel</button>
                                <button type="submit" disabled={isSaving || (!isLegacy && !items.length)}
                                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">{isSaving ? 'Saving…' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
