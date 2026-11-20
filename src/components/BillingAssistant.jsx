import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import billingCodes from '../data/billingCodes.json';
import { parseBillingDraft } from '../utils/parseBillingDraft';

export default function BillingAssistant({ customers, products, open, hasItems, onApply }) {
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [applied, setApplied] = useState(false);
    const ready = Boolean(customers && products);

    const prepareBill = (event) => {
        event.preventDefault();
        setError('');
        setApplied(false);
        try {
            onApply(parseBillingDraft(input, customers, products, billingCodes));
            setApplied(true);
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
            <form onSubmit={prepareBill} className="mt-4 space-y-3">
                <label htmlFor="billing-shorthand" className="block text-sm font-medium text-gray-700">
                    Bill shorthand
                </label>
                <p id="billing-format" className="text-sm text-gray-600">
                    Enter the date and customer code on separate lines. Use one line per item with its code, quantity, unit and price in RM. Add Bal on the last line if there is a previous balance.
                </p>
                <textarea
                    id="billing-shorthand"
                    aria-describedby="billing-format"
                    rows={6}
                    value={input}
                    onChange={(event) => {
                        setInput(event.target.value);
                        setError('');
                        setApplied(false);
                    }}
                    placeholder={'Date 01/01/2026\nHPL\nAPH 2kg 8.00\nATH 1pc 6.00\nBal 0'}
                    className="w-full rounded-md border border-gray-300 p-3 font-mono text-sm"
                />
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                {applied && <p role="status" className="text-sm text-green-700">Bill details filled in. Review the invoice and select Save to record the sale.</p>}
                <button
                    type="submit"
                    disabled={!ready || !input.trim()}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                    {hasItems ? 'Replace invoice draft' : 'Prepare invoice'}
                </button>
                {!ready && <p role="status" className="text-sm text-gray-600">Loading customers and products…</p>}
            </form>
        </details>
    );
}
