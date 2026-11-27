import { customerOutstandingCents } from '../utils/customerOutstanding.js';
import { formatDateShort } from '../utils/dateUtils.js';
import { hasBillableAmount } from '../utils/billingItemAmount.js';

function saleKey(sale, includePreviousBalance = false) {
    const billableItems = sale.items.filter(item => hasBillableAmount(item.qty * item.price - (item.discount || 0)));
    const items = billableItems.map(item => {
        const unit = String(item.unit ?? '').trim().toLowerCase();
        return JSON.stringify([
            Number(item.productId),
            Number(item.qty),
            unit === 'pc' ? 'pcs' : unit,
            Number(item.price),
            Number(item.discount || 0)
        ]);
    }).sort();

    const key = [sale.date, Number(sale.customerId), items];
    if (includePreviousBalance) key.push(Number(sale.prevBalance || 0));
    return JSON.stringify(key);
}

async function getPreviousBalance(db, { customerId, date }) {
    const customerIds = [Number(customerId), String(customerId)];
    const [sales, payments] = await Promise.all([
        db.sales.where('customerId').anyOf(customerIds).toArray(),
        db.payments.where('customerId').anyOf(customerIds).toArray()
    ]);
    if (sales.length && sales.every(sale => sale.date > date)) {
        throw new Error('Choose a date on or after the customer’s first recorded invoice to reconcile the balance.');
    }
    return {
        previousCents: customerOutstandingCents(sales, payments, date),
        openingBalance: sales.length ? undefined : 0
    };
}

function reconcileSale(sale, previousCents, remainingCents) {
    if (sale.date > formatDateShort(new Date())) {
        throw new Error('A balance reconciliation cannot be dated in the future.');
    }

    const dueCents = previousCents + Math.round(sale.subtotal * 100);
    const paymentCents = dueCents - remainingCents;
    if (!Number.isSafeInteger(paymentCents) || !Number.isSafeInteger(remainingCents) || remainingCents < 0) {
        throw new Error('Enter a valid remaining balance and bill total.');
    }
    if (paymentCents < 0) {
        throw new Error(`The remaining balance exceeds the RM ${(dueCents / 100).toFixed(2)} due after adding this bill. Check the balance and customer history.`);
    }
    return {
        ...sale,
        subtotal: Math.round(sale.subtotal * 100) / 100,
        prevBalance: previousCents / 100,
        grandTotal: dueCents / 100,
        paidAmount: paymentCents / 100
    };
}

export function previewAssistantSale(db, draft) {
    return db.transaction('r', db.sales, db.payments, async () => {
        const { previousCents } = await getPreviousBalance(db, draft);
        return reconcileSale(draft, previousCents, draft.remainingCents);
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

        for (const { remainingCents, expectedPreviousCents, ...sale } of sales) {
            const key = saleKey(sale);
            if (remainingCents === undefined ? seenWithBalance.has(saleKey(sale, true)) : seen.has(key)) continue;

            if (remainingCents === undefined) {
                ids.push(await db.sales.add(sale));
                seenWithBalance.add(saleKey(sale, true));
            } else {
                const { previousCents, openingBalance } = await getPreviousBalance(db, sale);
                if (expectedPreviousCents !== undefined && previousCents !== expectedPreviousCents) {
                    throw new Error('The customer balance changed. Review the Billing Assistant entry again before saving.');
                }
                const reconciled = reconcileSale(sale, previousCents, remainingCents);
                if (openingBalance !== undefined) reconciled.openingBalance = openingBalance;
                const id = await db.sales.add(reconciled);
                seenWithBalance.add(saleKey(reconciled, true));
                if (reconciled.paidAmount > 0) {
                    await db.payments.add({
                        id: `assistant-sale-payment:${id}`,
                        customerId: sale.customerId,
                        date: sale.date,
                        amount: reconciled.paidAmount,
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
