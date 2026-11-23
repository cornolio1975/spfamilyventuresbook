import { useLocation, useSearchParams } from 'react-router-dom';
import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { db } from '../db/db';
import { previewVendorPayments, saveVendorPayments } from '../db/vendorAssistantPayments';
import { hasVendorBillItems, parseVendorBillDraft, parseVendorPayments } from '../utils/parseBillingDraft';
import billingCodes from '../data/billingCodes.json';

import { formatRinggit } from '../utils/formatRinggit';

const formatCents = cents => formatRinggit(cents / 100);

export default function VendorBillAssistant({ vendors, products, onReviewBill }) {
    const [params] = useSearchParams();
    const { state } = useLocation();
    const [input, setInput] = useState(state?.vendorPaymentInput ?? '');
    const [previews, setPreviews] = useState(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const submitting = useRef(false);

    const isItemizedBill = hasVendorBillItems(input);
    const ready = vendors && (!isItemizedBill || products);
    const payable = previews?.filter(payment => !payment.skipReason) ?? [];
    const totalCents = payable.reduce((sum, payment) => sum + payment.amountCents, 0);

    const submit = async event => {
        event.preventDefault();
        if (submitting.current || !ready || (previews && !payable.length)) return;
        submitting.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            if (previews) {
                await saveVendorPayments(db, payable);
                setMessage(`Recorded ${payable.length} ${payable.length === 1 ? 'payment' : 'payments'} totalling ${formatCents(totalCents)}.`);
                setPreviews(null);
                setInput('');
            } else if (isItemizedBill) {
                onReviewBill(parseVendorBillDraft(input, vendors, products, billingCodes));
            } else {
                setPreviews(await previewVendorPayments(db, parseVendorPayments(input, vendors)));
            }
        } catch (reviewError) {
            setError(reviewError.message);
            setPreviews(null);
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    };

    return (
        <details open={params.get('assistant') === '1' || undefined} className="mb-4 rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer font-semibold text-blue-800">
                <Sparkles aria-hidden="true" size={18} className="mr-2 inline-block align-text-bottom" />
                Bill Assistant
            </summary>
            <form onSubmit={submit} className="mt-4 space-y-3">
                <label htmlFor="vendor-payment" className="block text-sm font-medium">Vendor bill or payment shorthand</label>
                <p id="vendor-payment-format" className="text-sm text-gray-600">
                    Enter the date and vendor code on separate lines. For a new bill, add item lines such as APP 21kg 7. For a payment, enter the remaining balance, such as Bal 2500. Separate multiple vendor payments with ---.
                </p>
                <textarea
                    id="vendor-payment"
                    aria-describedby="vendor-payment-format"
                    rows={7}
                    value={input}
                    disabled={busy}
                    placeholder={'23/11/2026\nSPF\nAPP 21kg 7'}
                    className="w-full rounded-md border border-gray-300 p-3 font-mono text-base"
                    onChange={event => {
                        setInput(event.target.value);
                        setPreviews(null);
                        setError('');
                        setMessage('');
                    }}
                />
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                {message && <p role="status" className="text-sm text-green-700">{message}</p>}
                {previews?.map(preview => (
                    <div key={preview.draft.vendorId} className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
                        <p className="font-medium">{preview.draft.vendorName} · {preview.draft.date}</p>
                        {preview.skipReason ? <p>{preview.skipReason}</p> : (
                            <dl className="mt-1 grid grid-cols-2 gap-1">
                                <dt>Outstanding on that date</dt>
                                <dd>{formatCents(preview.outstandingCents)}</dd>
                                <dt>Payment made</dt>
                                <dd className="font-bold">{formatCents(preview.amountCents)}</dd>
                                <dt>Remaining balance</dt>
                                <dd>{formatCents(preview.draft.remainingCents)}</dd>
                            </dl>
                        )}
                    </div>
                ))}
                {previews && payable.length > 0 && <p className="font-semibold">Total to record {formatCents(totalCents)}</p>}
                {!(previews && !payable.length) && (
                    <button type="submit" disabled={!ready || busy || !input.trim()}
                        className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50">
                        {previews ? (payable.length === 1 ? 'Confirm payment' : 'Confirm payments') : isItemizedBill ? 'Review bill' : 'Review payments'}
                    </button>
                )}
            </form>
        </details>
    );
}
