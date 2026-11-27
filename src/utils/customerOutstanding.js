const toCents = (amount) => Math.round((parseFloat(amount) || 0) * 100);

export function customerOutstandingCents(sales, payments, throughDate) {
    const eligibleSales = sales.filter(sale => !throughDate || sale.date <= throughDate);
    const eligiblePayments = payments.filter(payment => !throughDate || payment.date <= throughDate);
    const firstSale = [...eligibleSales].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)[0];
    const openingCents = toCents(firstSale?.openingBalance ?? firstSale?.prevBalance);
    const salesCents = eligibleSales.reduce((sum, sale) => {
        const subtotal = sale.subtotal == null
            ? toCents(sale.grandTotal) - toCents(sale.prevBalance)
            : toCents(sale.subtotal);
        return sum + subtotal;
    }, 0);
    const paymentCents = eligiblePayments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
    return openingCents + salesCents - paymentCents;
}
