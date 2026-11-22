export function saleSubtotalCents(sale) {
    return Math.round((Number(sale.subtotal) || 0) * 100);
}

export function groupSalesByPeriod(sales, periodLength) {
    const totals = new Map();
    for (const sale of sales) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(sale.date)) continue;
        const period = sale.date.slice(0, periodLength);
        const cents = saleSubtotalCents(sale);
        totals.set(period, (totals.get(period) ?? 0) + cents);
    }
    return totals;
}
