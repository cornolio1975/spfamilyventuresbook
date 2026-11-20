import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import billingCodes from '../data/billingCodes.json';
import { parseBillingBatch } from '../utils/parseBillingDraft';

export default function BillingAssistant({ customers, products, open, hasItems, isSaving, onApply, onSaveBatch }) {
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const ready = Boolean(customers && products);
    const isBatch = input.split(/\r?\n/).some(line => /^[-–—]{2,}$/.test(line.trim()));

    const prepareBills = async (event) => {
        event.preventDefault();
        if (!ready || isSaving) return;
        setError('');
        setMessage('');
        try {
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
            setError(draftError.message);
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
                    Bill shorthand
                </label>
                <p id="billing-format" className="text-sm text-gray-600">
                    Enter the date once on the first line. For each bill, enter the customer code, items and optional Bal. Put --- between bills. All bills use the first date.
                </p>
                <textarea
                    id="billing-shorthand"
                    aria-describedby="billing-format"
                    rows={9}
                    disabled={isSaving}
                    value={input}
                    onChange={(event) => {
                        setInput(event.target.value);
                        setError('');
                        setMessage('');
                    }}
                    placeholder={'01/01/26\nHPL\nAPH 2kg 8.00\nBal 0\n---\nSHB\nATH 1pc 6.00\nBal 0'}
                    className="w-full rounded-md border border-gray-300 p-3 font-mono text-sm"
                />
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                {message && <p role="status" className="text-sm text-green-700">{message}</p>}
                <button
                    type="submit"
                    disabled={!ready || isSaving || !input.trim()}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                    {isBatch ? 'Save all bills' : hasItems ? 'Replace invoice draft' : 'Prepare invoice'}
                </button>
                {!ready && <p role="status" className="text-sm text-gray-600">Loading customers and products…</p>}
            </form>
        </details>
    );
}
