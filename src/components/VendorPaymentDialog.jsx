import { useRef, useState } from 'react';
import { db } from '../db/db';
import { previewVendorPayment, saveVendorPayment } from '../db/vendorAssistantPayments';
import { formatDateShort } from '../utils/dateUtils';

const money = amount => `RM ${amount.toFixed(2)}`;

export default function VendorPaymentDialog({ vendor, mode, bills, payments, onClose }) {
    const today = formatDateShort(new Date());
    const [date, setDate] = useState(today);
    const [amount, setAmount] = useState('');
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const submitting = useRef(false);
    const isHistory = mode === 'history';
    const history = isHistory ? [
        ...payments.map(payment => ({ ...payment, key: `payment-${payment.id}`, source: 'Vendor payment' })),
        ...bills.filter(bill => Number(bill.paidAmount) > 0).map(bill => ({
            key: `bill-${bill.id}`, date: bill.date, amount: bill.paidAmount, source: 'Paid on bill'
        }))
    ].sort((a, b) => b.date.localeCompare(a.date)) : [];

    const resetPreview = () => {
        setPreview(null);
        setError('');
    };

    const submit = async event => {
        event.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        setBusy(true);
        setError('');
        try {
            if (preview) {
                await saveVendorPayment(db, preview);
                onClose(`Payment of ${money(preview.amountCents / 100)} recorded for ${vendor.name}.`);
            } else {
                const amountCents = Math.round(Number(amount) * 100);
                const result = await previewVendorPayment(db, { vendorId: vendor.id, date, amountCents });
                if (result.skipReason) throw new Error(result.skipReason);
                setPreview(result);
            }
        } catch (paymentError) {
            setError(paymentError.message);
            setPreview(null);
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <section role="dialog" aria-modal="true" aria-labelledby="vendor-payment-title"
                className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
                <h2 id="vendor-payment-title" className="text-xl font-bold">
                    {isHistory ? 'Payment History' : 'Record Payment'}
                </h2>
                <p className="mb-4 text-sm text-gray-600">{vendor.name}</p>
                {isHistory ? (
                    <>
                        {history.length ? <ul className="divide-y">
                            {history.map(entry => (
                                <li key={entry.key} className="flex justify-between gap-3 py-2 text-sm">
                                    <div>
                                        <p>{entry.date}</p>
                                        <p className="text-gray-600">{entry.source}</p>
                                    </div>
                                    <strong>{money(Number(entry.amount))}</strong>
                                </li>
                            ))}
                        </ul> : <p className="text-sm text-gray-600">No payments recorded.</p>}
                        <button autoFocus type="button" onClick={() => onClose()} className="mt-4 rounded-lg border px-4 py-2">Close</button>
                    </>
                ) : (
                    <form onSubmit={submit} className="space-y-4">
                        <fieldset disabled={busy} className="space-y-3">
                            <label className="block text-sm font-medium">
                                Payment date
                                <input autoFocus required type="date" max={today} value={date}
                                    onChange={event => { setDate(event.target.value); resetPreview(); }}
                                    className="mt-1 block w-full rounded-md border p-2" />
                            </label>
                            <label className="block text-sm font-medium">
                                Amount paid to vendor (RM)
                                <input required type="number" min="0.01" step="0.01" inputMode="decimal" value={amount}
                                    onChange={event => { setAmount(event.target.value); resetPreview(); }}
                                    className="mt-1 block w-full rounded-md border p-2" />
                            </label>
                        </fieldset>
                        {preview && <dl className="grid grid-cols-2 gap-2 rounded-lg bg-blue-50 p-3 text-sm" role="status">
                            <dt>Outstanding on that date</dt><dd>{money(preview.outstandingCents / 100)}</dd>
                            <dt>Remaining after payment</dt><dd>{money((preview.outstandingCents - preview.amountCents) / 100)}</dd>
                        </dl>}
                        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                        <div className="flex justify-end gap-2">
                            <button type="button" disabled={busy} onClick={() => onClose()} className="rounded-lg border px-4 py-2">Cancel</button>
                            <button type="submit" disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
                                {preview ? 'Confirm payment' : 'Review payment'}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
}
