import { customerOutstandingCents } from '../utils/customerOutstanding.js';
import { formatDateShort } from '../utils/dateUtils.js';
import { billableItemsKey } from '../utils/billingItemAmount.js';

function saleKey(sale, includePreviousBalance = false) {
    const key = [sale.date, Number(sale.customerId), billableItemsKey(sale.items)];
    if (includePreviousBalance) key.push(Number(sale.prevBalance || 0));
    return JSON.stringify(key);
}

async function getOutstanding(db, { customerId, date }) {
    const customerIds = [Number(customerId), String(customerId)];
    const [sales, payments] = await Promise.all([
        db.sales.where('customerId').anyOf(customerIds).toArray(),
        db.payments.where('customerId').anyOf(customerIds).toArray()
    ]);
    if (sales.length && sales.every(sale => sale.date > date)) {
        throw new Error('Choose a date on or after the customer’s first recorded invoice to reconcile the balance.');
    }
    return {
        outstandingCents: customerOutstandingCents(sales, payments, date),
        openingBalance: sales.length ? undefined : 0
    };
}

function reconcileSale(sale, outstandingCents, previousBalanceCents) {
    if (sale.date > formatDateShort(new Date())) {
        throw new Error('A balance reconciliation cannot be dated in the future.');
    }

    const subtotalCents = Math.round(sale.subtotal * 100);
    const dueCents = previousBalanceCents + subtotalCents;
    const paymentCents = outstandingCents - previousBalanceCents;
    if (!Number.isSafeInteger(dueCents) || !Number.isSafeInteger(paymentCents) ||
        !Number.isSafeInteger(previousBalanceCents) || previousBalanceCents < 0) {
        throw new Error('Enter a valid previous balance and bill total.');
    }
    if (paymentCents < 0) {
        throw new Error(`The previous balance exceeds the customer’s recorded outstanding of RM ${(outstandingCents / 100).toFixed(2)}. Check the balance and customer history.`);
    }
    return {
        paymentCents,
        invoice: {
            ...sale,
            subtotal: subtotalCents / 100,
            prevBalance: previousBalanceCents / 100,
            grandTotal: dueCents / 100,
            paidAmount: 0
        }
    };
}

export function previewAssistantSale(db, draft) {
    return db.transaction('r', db.sales, db.payments, async () => {
        const { outstandingCents } = await getOutstanding(db, draft);
        const { paymentCents } = reconcileSale(draft, outstandingCents, draft.previousBalanceCents);
        return { outstandingCents, paymentCents };
    });
}

export function saveAssistantSales(db, sales) {
    return db.transaction('rw', db.sales, db.payments, async () => {
        const dates = [...new Set(sales.map(sale => sale.date))];
        const existing = await db.sales.where('date').anyOf(dates).toArray();
        const comparableSales = existing.filter(sale => Array.isArray(sale.items));
        const seen = new Set(comparableSales.map(sale => saleKey(sale)));
        const seenWithBalance = new Set(comparableSales.map(sale => saleKey(sale, true)));
        const ids = [];

        for (const { previousBalanceCents, expectedOutstandingCents, ...sale } of sales) {
            const key = saleKey(sale);
            if (previousBalanceCents === undefined ? seenWithBalance.has(saleKey(sale, true)) : seen.has(key)) continue;

            if (previousBalanceCents === undefined) {
                ids.push(await db.sales.add(sale));
                seenWithBalance.add(saleKey(sale, true));
            } else {
                const { outstandingCents, openingBalance } = await getOutstanding(db, sale);
                if (expectedOutstandingCents !== undefined && outstandingCents !== expectedOutstandingCents) {
                    throw new Error('The customer balance changed. Review the Billing Assistant entry again before saving.');
                }
                const { invoice, paymentCents } = reconcileSale(sale, outstandingCents, previousBalanceCents);
                if (openingBalance !== undefined) invoice.openingBalance = openingBalance;
                const id = await db.sales.add(invoice);
                seenWithBalance.add(saleKey(invoice, true));
                if (paymentCents > 0) {
                    await db.payments.add({
                        id: `assistant-sale-payment:${id}`,
                        customerId: sale.customerId,
                        date: sale.date,
                        amount: paymentCents / 100,
                        memo: `Billing Assistant invoice #${id}`
                    });
                }
                ids.push(id);
            }
            seen.add(key);
        }

        return { ids, skipped: sales.length - ids.length };
    });
}
