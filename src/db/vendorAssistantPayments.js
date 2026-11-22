import { formatDateShort } from '../utils/dateUtils.js';
import { vendorBalancesCents } from '../utils/vendorBalances.js';

async function reviewPayment(db, draft) {
    if (draft.date > formatDateShort(new Date())) {
        throw new Error('The payment date cannot be in the future.');
    }
    const { vendorId, date } = draft;
    const sameVendor = record => String(record.vendorId) === String(vendorId);
    const [vendor, bills, payments] = await Promise.all([
        db.vendors.get(vendorId),
        db.vendor_purchases.filter(sameVendor).toArray(),
        db.vendor_payments.filter(sameVendor).toArray()
    ]);
    if (!vendor) throw new Error('This vendor is no longer in the vendor list.');

    const outstandingCents = vendorBalancesCents(bills, payments, date).get(String(vendorId)) ?? 0;
    const remainingCents = draft.remainingCents ?? outstandingCents - draft.amountCents;
    const id = `vendor-payment:${vendorId}:${date}:${remainingCents}`;

    const amountCents = outstandingCents - remainingCents;
    if (!Number.isSafeInteger(amountCents)) throw new Error('The recorded balance is invalid.');
    if (draft.amountCents !== undefined && (amountCents <= 0 || remainingCents < 0)) {
        throw new Error('Enter a payment greater than zero and within the outstanding balance for that date.');
    }
    if (payments.some(payment => payment.id === id)) return { draft, skipReason: 'This payment is already recorded.' };
    if (amountCents < 0) throw new Error('The remaining balance is above the recorded outstanding balance for that date.');
    return { draft, id, outstandingCents, amountCents, skipReason: amountCents === 0 ? 'Balance unchanged.' : null };
}

export function previewVendorPayment(db, draft) {
    return db.transaction('r', db.vendors, db.vendor_purchases, db.vendor_payments, () => reviewPayment(db, draft));
}

export function saveVendorPayment(db, preview) {
    return db.transaction('rw', db.vendors, db.vendor_purchases, db.vendor_payments, async () => {
        const payment = await reviewPayment(db, preview.draft);
        if (payment.skipReason || payment.outstandingCents !== preview.outstandingCents) {
            throw new Error('The balance or payment history changed. Review the payment again.');
        }

        await db.vendor_payments.add({
            id: payment.id,
            vendorId: payment.draft.vendorId,
            date: payment.draft.date,
            amount: payment.amountCents / 100
        });
    });
}
