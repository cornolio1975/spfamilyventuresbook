import { customerOutstandingCents } from '../utils/customerOutstanding.js';
import { formatDateShort } from '../utils/dateUtils.js';

async function calculatePayment(db, draft) {
    if (draft.date > formatDateShort(new Date())) {
        throw new Error('The payment date cannot be in the future.');
    }

    const id = `assistant-payment:${draft.customerId}:${draft.date}:${draft.remainingCents}`;
    const customerIds = [...new Set([draft.customerId, String(draft.customerId), Number(draft.customerId)])]
        .filter(key => typeof key === 'string' || Number.isFinite(key));
    const [customer, duplicate, sales, payments] = await Promise.all([
        db.customers.get(draft.customerId),
        db.payments.get(id),
        db.sales.where('customerId').anyOf(customerIds).toArray(),
        db.payments.where('customerId').anyOf(customerIds).toArray()
    ]);
    if (!customer) throw new Error('This customer is no longer in the customer list.');
    if (duplicate) return { id, amountCents: 0, skipReason: 'Already recorded' };

    const outstandingCents = customerOutstandingCents(sales, payments, draft.date);
    const amountCents = outstandingCents - draft.remainingCents;
    if (!Number.isSafeInteger(amountCents)) throw new Error('The recorded balance is invalid.');
    if (amountCents < 0) throw new Error('The remaining balance is above the recorded outstanding balance for that date.');
    return { id, outstandingCents, amountCents, skipReason: amountCents === 0 ? 'Balance unchanged' : null };
}

async function reviewPayment(db, draft) {
    try {
        return { ...await calculatePayment(db, draft), draft };
    } catch (error) {
        throw new Error(`${draft.customerName}: ${error.message}`, { cause: error });
    }
}

export function previewAssistantPayments(db, drafts) {
    return db.transaction('r', db.customers, db.sales, db.payments, () =>
        Promise.all(drafts.map(draft => reviewPayment(db, draft)))
    );
}

export function saveAssistantPayments(db, previews) {
    return db.transaction('rw', db.customers, db.sales, db.payments, async () => {
        const records = [];
        for (const preview of previews) {
            if (preview.skipReason) continue;
            const { draft, id, outstandingCents, amountCents, skipReason } = await reviewPayment(db, preview.draft);
            if (skipReason || outstandingCents !== preview.outstandingCents) {
                throw new Error(`${draft.customerName}: The balance or payment history changed. Review the batch again before saving.`);
            }

            records.push({
                id,
                customerId: draft.customerId,
                date: draft.date,
                amount: amountCents / 100,
                memo: 'Recorded through Billing Assistant'
            });
        }
        await db.payments.bulkAdd(records);
    });
}
