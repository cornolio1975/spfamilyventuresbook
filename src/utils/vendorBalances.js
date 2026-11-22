const toCents = amount => Math.round((Number(amount) || 0) * 100);

export function vendorBalancesCents(bills, payments, throughDate) {
    const balances = new Map();
    const sortedBills = [...bills].sort((a, b) =>
        a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
    );
    for (const bill of sortedBills) {
        if (bill.date > throughDate) break;
        const key = String(bill.vendorId);
        const previous = balances.get(key) ?? toCents(bill.prevBalance);
        const subtotal = bill.subtotal ?? bill.total;
        const purchases = subtotal == null
            ? toCents(bill.grandTotal) - toCents(bill.prevBalance)
            : toCents(subtotal);
        balances.set(key, previous + purchases - toCents(bill.paidAmount));
    }

    for (const payment of payments) {
        if (payment.date > throughDate) continue;
        const key = String(payment.vendorId);
        balances.set(key, (balances.get(key) ?? 0) - toCents(payment.amount));
    }
    return balances;
}
