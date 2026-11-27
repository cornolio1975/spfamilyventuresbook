import { formatDateShort } from '../utils/dateUtils.js';
import { billableItemsKey } from '../utils/billingItemAmount.js';
import { vendorBalancesCents } from '../utils/vendorBalances.js';

async function readVendorLedger(db, { vendorId, date }) {
    const sameVendor = record => String(record.vendorId) === String(vendorId);
    const [vendor, bills, payments] = await Promise.all([
        db.vendors.get(vendorId),
        db.vendor_purchases.filter(sameVendor).toArray(),
        db.vendor_payments.filter(sameVendor).toArray()
    ]);
    if (!vendor) throw new Error('This vendor is no longer in the vendor list.');

    const outstandingCents = vendorBalancesCents(bills, payments, date).get(String(vendorId)) ?? 0;
    return { bills, payments, outstandingCents };
}

async function reviewPayment(db, draft) {
    if (draft.date > formatDateShort(new Date())) {
        throw new Error('The payment date cannot be in the future.');
    }
    const { vendorId, date } = draft;
    const { payments, outstandingCents } = await readVendorLedger(db, draft);
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

export function previewVendorPayments(db, drafts) {
    return db.transaction('r', db.vendors, db.vendor_purchases, db.vendor_payments, () =>
        Promise.all(drafts.map(async draft => {
            try {
                return await reviewPayment(db, draft);
            } catch (error) {
                throw new Error(`${draft.vendorName}: ${error.message}`, { cause: error });
            }
        }))
    );
}

export function saveVendorPayments(db, previews) {
    return db.transaction('rw', db.vendors, db.vendor_purchases, db.vendor_payments, async () => {
        for (const preview of previews) {
            if (preview.skipReason) continue;
            const payment = await reviewPayment(db, preview.draft);
            if (payment.skipReason || payment.outstandingCents !== preview.outstandingCents) {
                const name = preview.draft.vendorName;
                throw new Error(`${name ? `${name}: ` : ''}The balance or payment history changed. Review the payment again.`);
            }

            await db.vendor_payments.add({
                id: payment.id,
                vendorId: payment.draft.vendorId,
                date: payment.draft.date,
                amount: payment.amountCents / 100
            });
        }
    });
}

export function saveVendorPayment(db, preview) {
    return saveVendorPayments(db, [preview]);
}

function reviewBillBalance(draft, { bills, outstandingCents }) {
    if (draft.date > formatDateShort(new Date())) {
        throw new Error('A balance reconciliation cannot be dated in the future.');
    }
    if (bills.length && bills.every(bill => bill.date > draft.date)) {
        throw new Error('Choose a date on or after the vendor’s first recorded bill to reconcile the balance.');
    }
    const { previousBalanceCents } = draft;
    const paymentCents = outstandingCents - previousBalanceCents;
    if (!Number.isSafeInteger(paymentCents) || !Number.isSafeInteger(previousBalanceCents) || previousBalanceCents < 0) {
        throw new Error('Enter a valid previous balance.');
    }
    if (paymentCents < 0) {
        throw new Error(`The previous balance exceeds the vendor’s recorded outstanding of RM ${(outstandingCents / 100).toFixed(2)}.`);
    }
    return { outstandingCents, paymentCents };
}

export function previewVendorBillBalance(db, draft) {
    return db.transaction('r', db.vendors, db.vendor_purchases, db.vendor_payments, async () =>
        reviewBillBalance(draft, await readVendorLedger(db, draft))
    );
}

export function saveReconciledVendorBill(db, bill, expectedOutstandingCents) {
    return db.transaction('rw', db.vendors, db.vendor_purchases, db.vendor_payments, async () => {
        const ledger = await readVendorLedger(db, bill);
        const itemsKey = JSON.stringify(billableItemsKey(bill.items));
        if (ledger.bills.some(existing => existing.date === bill.date && Array.isArray(existing.items) &&
            JSON.stringify(billableItemsKey(existing.items)) === itemsKey)) {
            throw new Error('Duplicate bill. This bill is already in Vendor Bills.');
        }
        if (ledger.outstandingCents !== expectedOutstandingCents) {
            throw new Error('The vendor balance changed. Review the Bill Assistant entry again before saving.');
        }

        const previousBalanceCents = Math.round(bill.prevBalance * 100);
        const { paymentCents } = reviewBillBalance({ ...bill, previousBalanceCents }, ledger);
        if (!Number.isSafeInteger(Math.round(bill.grandTotal * 100))) {
            throw new Error('Enter a valid bill total.');
        }
        const id = await db.vendor_purchases.add({ ...bill });
        if (paymentCents > 0) {
            await db.vendor_payments.add({
                id: `assistant-vendor-bill-payment:${id}`,
                vendorId: bill.vendorId,
                date: bill.date,
                amount: paymentCents / 100,
                memo: `Bill Assistant vendor bill #${id}`
            });
        }
        return id;
    });
}
