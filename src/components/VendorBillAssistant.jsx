import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { db } from '../db/db';
import { previewVendorPayment, saveVendorPayment } from '../db/vendorAssistantPayments';
import { parseVendorPayment } from '../utils/parseBillingDraft';

const formatCents = cents => `RM ${(cents / 100).toFixed(2)}`;

export default function VendorBillAssistant({ vendors }) {
    const [input, setInput] = useState('');
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const submitting = useRef(false);

    const submit = async event => {
        event.preventDefault();
        if (submitting.current || !vendors || preview?.skipReason) return;
        submitting.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            if (preview) {
                await saveVendorPayment(db, preview);
                setMessage(`Payment of ${formatCents(preview.amountCents)} recorded for ${preview.draft.vendorName}.`);
                setPreview(null);
                setInput('');
            } else {
                setPreview(await previewVendorPayment(db, parseVendorPayment(input, vendors)));
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
        <details className="mb-4 rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer font-semibold text-blue-800">
                <Sparkles aria-hidden="true" size={18} className="mr-2 inline-block align-text-bottom" />
                Bill Assistant
            </summary>
            <form onSubmit={submit} className="mt-4 space-y-3">
                <label htmlFor="vendor-payment" className="block text-sm font-medium">Vendor payment shorthand</label>
                <p id="vendor-payment-format" className="text-sm text-gray-600">
                    Enter the date, three-letter vendor code and balance still owed after payment. Find your vendor code under Vendor Codes on the dashboard.
                </p>
                <textarea
                    id="vendor-payment"
                    aria-describedby="vendor-payment-format"
                    rows={3}
                    value={input}
                    disabled={busy}
                    placeholder={'23/11/2026\nFCF\nBal 2500'}
                    className="w-full rounded-md border border-gray-300 p-3 font-mono text-sm"
                    onChange={event => {
                        setInput(event.target.value);
                        setPreview(null);
                        setError('');
                        setMessage('');
                    }}
                />
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                {message && <p role="status" className="text-sm text-green-700">{message}</p>}
                {preview && (
                    <div role="status" className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
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
                )}
                {!preview?.skipReason && (
                    <button type="submit" disabled={!vendors || busy || !input.trim()}
                        className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50">
                        {preview ? 'Confirm payment' : 'Review payment'}
                    </button>
                )}
            </form>
        </details>
    );
}
