import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import billingCodes from '../data/billingCodes.json';
import { detectBillingEntry, parseBillingBatch, parsePaymentBatch } from '../utils/parseBillingDraft';
import { db } from '../db/db';
import { previewAssistantPayments, saveAssistantPayments } from '../db/assistantPayments';

const formatCents = (cents) => `RM ${(cents / 100).toFixed(2)}`;

export default function BillingAssistant({ customers, products, open, hasItems, isSaving, onApply, onSaveBatch }) {
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [paymentPreviews, setPaymentPreviews] = useState(null);
    const [paymentBusy, setPaymentBusy] = useState(false);
    const busy = isSaving || paymentBusy;
    const ready = Boolean(customers && products);
    const { isBatch, isPayment } = detectBillingEntry(input);
    const payable = paymentPreviews?.filter(payment => !payment.skipReason) ?? [];
    const totalCents = payable.reduce((sum, payment) => sum + payment.amountCents, 0);

    const prepareBills = async (event) => {
        event.preventDefault();
        if (!ready || busy) return;
        setError('');
        setMessage('');
        setPaymentBusy(true);
        try {
            if (paymentPreviews) {
                if (!payable.length) return;

                await saveAssistantPayments(db, paymentPreviews);
                const count = payable.length;
                const skipped = paymentPreviews.length - count;
                const savedMessage = `${count} ${count === 1 ? 'payment' : 'payments'} recorded for ${formatCents(totalCents)}.`;
                setMessage(skipped ? `${savedMessage} ${skipped} skipped.` : savedMessage);
                setInput('');
                setPaymentPreviews(null);
                return;
            }

            if (isPayment) {
                const drafts = parsePaymentBatch(input, customers, billingCodes);
                setPaymentPreviews(await previewAssistantPayments(db, drafts));
                return;
            }

            const drafts = parseBillingBatch(input, customers, products, billingCodes);
            if (drafts.length === 1) {
                onApply(drafts[0]);
                setMessage('Bill details filled in. Review the invoice and select Save to record the sale.');
                return;
            }

            const result = await onSaveBatch(drafts);
            if (!result) return;

            const { ids, skipped } = result;
            const savedMessage = ids.length === 1 ? '1 bill saved to Sales.' : `${ids.length} bills saved to Sales.`;
            const skippedMessage = skipped === 1 ? '1 duplicate skipped.' : `${skipped} duplicates skipped.`;
            setInput('');
            setMessage(skipped ? `${savedMessage} ${skippedMessage}` : savedMessage);
        } catch (draftError) {
            setPaymentPreviews(null);
            setError(draftError.message);
        } finally {
            setPaymentBusy(false);
        }
    };

    return (
        <details open={open || undefined} className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer font-semibold text-blue-800">
                <Sparkles aria-hidden="true" size={18} className="mr-2 inline-block align-text-bottom" />
                Billing Assistant
            </summary>
            <form onSubmit={prepareBills} className="mt-4 space-y-3">
                <label htmlFor="billing-shorthand" className="block text-sm font-medium text-gray-700">
                    Bill or payment shorthand
                </label>
                <p id="billing-format" className="text-sm text-gray-600">
                    Enter the date once on the first line. For payments, enter each customer code and remaining balance, for example HPL Bal 2500. For bills, enter the customer code, items and optional Bal. Put --- between customers and submit bills and payments separately.
                </p>
                <textarea
                    id="billing-shorthand"
                    aria-describedby="billing-format"
                    rows={9}
                    disabled={busy}
                    value={input}
                    onChange={(event) => {
                        setInput(event.target.value);
                        setPaymentPreviews(null);
                        setError('');
                        setMessage('');
                    }}
                    placeholder={'01/01/26\nHPL\nAPH 2kg 8.00\nBal 0\n---\nSHB\nATH 1pc 6.00\nBal 0'}
                    className="w-full rounded-md border border-gray-300 p-3 font-mono text-sm"
                />
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                {error.startsWith('Unknown Customer code') && (
                    <Link to="/vendor-bills?assistant=1" state={{ vendorPaymentInput: input }} className="inline-block text-sm font-medium text-blue-800 underline">
                        Open Bill Assistant for vendor payments
                    </Link>
                )}
                {message && <p role="status" className="text-sm text-green-700">{message}</p>}
                {paymentPreviews && (
                    <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm" role="status">
                        <p className="font-medium">Payments on {paymentPreviews[0].draft.date.split('-').reverse().join('/')}</p>
                        {paymentPreviews.map(payment => (
                            <div key={payment.draft.customerId} className="border-t border-blue-200 pt-2">
                                <p className="font-medium">{payment.draft.customerName}</p>
                                {payment.skipReason ? (
                                    <p>{payment.skipReason}</p>
                                ) : (
                                    <dl className="mt-1 grid grid-cols-2 gap-1">
                                        <dt>Outstanding on that date</dt>
                                        <dd>{formatCents(payment.outstandingCents)}</dd>
                                        <dt>Payment received</dt>
                                        <dd className="font-bold">{formatCents(payment.amountCents)}</dd>
                                        <dt>Remaining on that date</dt>
                                        <dd>{formatCents(payment.draft.remainingCents)}</dd>
                                    </dl>
                                )}
                            </div>
                        ))}
                        <p className="font-bold">{payable.length ? `Total to record ${formatCents(totalCents)}` : 'No new payments to record.'}</p>
                    </div>
                )}
                {(!paymentPreviews || payable.length > 0) && <button
                    type="submit"
                    disabled={!ready || busy || !input.trim()}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                    {paymentPreviews ? (payable.length === 1 ? 'Confirm payment' : 'Confirm payments') : isPayment ? (isBatch ? 'Review payments' : 'Review payment') : isBatch ? 'Save all bills' : hasItems ? 'Review entry' : 'Prepare entry'}
                </button>}
                {!ready && <p role="status" className="text-sm text-gray-600">Loading customers and products…</p>}
            </form>
        </details>
    );
}
