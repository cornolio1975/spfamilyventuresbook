export function getInvoiceNumber(id, invoiceStart) {
    const start = parseInt(invoiceStart, 10) || 10000;
    return id ? start + (parseInt(id, 10) - 1) : 'NEW';
}

export function getWhatsAppNumber(contact) {
    const raw = String(contact ?? '').trim();
    if (!/^\+?[\d\s().-]+$/.test(raw)) return null;

    let number = raw.replace(/\D/g, '');
    if (number.startsWith('00')) {
        number = number.slice(2);
    } else if (number.startsWith('0') && !raw.startsWith('+')) {
        number = `60${number.slice(1)}`;
    }

    if (number.startsWith('60') && !/^60[1-9]\d{7,9}$/.test(number)) return null;
    if (!number.startsWith('60') && !raw.startsWith('+') && !raw.startsWith('00')) return null;
    return /^[1-9]\d{7,14}$/.test(number) ? number : null;
}

export function getInvoiceAmounts(sale) {
    const items = sale.items ?? [];
    const lineSubtotal = items.reduce((sum, item) => sum + item.qty * item.price - (Number(item.discount) || 0), 0);
    const subtotal = Number(sale.subtotal ?? lineSubtotal);
    const prevBalance = Number(sale.prevBalance ?? 0);
    const paidAmount = Number(sale.paidAmount ?? 0);
    const grandTotal = Number(sale.grandTotal ?? subtotal + prevBalance);
    return { subtotal, prevBalance, paidAmount, grandTotal, balanceDue: grandTotal - paidAmount };
}
