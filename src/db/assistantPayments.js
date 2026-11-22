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
    if (duplicate) throw new Error('A payment for this customer, date and remaining balance was already recorded.');

    const outstandingCents = customerOutstandingCents(sales, payments, draft.date);
    const amountCents = outstandingCents - draft.remainingCents;
    if (!Number.isSafeInteger(amountCents)) throw new Error('The recorded balance is invalid.');
    if (amountCents < 0) throw new Error('The remaining balance is above the recorded outstanding balance for that date.');
    return { id, outstandingCents, amountCents };
}

export function previewAssistantPayment(db, draft) {
    return db.transaction('r', db.customers, db.sales, db.payments, () => calculatePayment(db, draft));
}

export function saveAssistantPayment(db, draft, expectedOutstandingCents) {
    return db.transaction('rw', db.customers, db.sales, db.payments, async () => {
        const { id, outstandingCents, amountCents } = await calculatePayment(db, draft);
        if (outstandingCents !== expectedOutstandingCents) {
            throw new Error('The outstanding balance changed. Review the payment again before saving.');
        }
        if (amountCents === 0) throw new Error('The balance is unchanged. No payment is due to be recorded.');

        await db.payments.add({
            id,
            customerId: draft.customerId,
            date: draft.date,
            amount: amountCents / 100,
            memo: 'Recorded through Billing Assistant'
        });
    });
}
