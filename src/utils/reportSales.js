import { formatDateShort } from './dateUtils.js';

export function getReportDateRange(searchParams) {
    const today = formatDateShort(new Date());
    return {
        start: searchParams.get('start') ?? `${today.slice(0, 7)}-01`,
        end: searchParams.get('end') ?? today,
    };
}

export function getReportSales(sales, { start, end }) {
    if (!start || !end || start > end) return [];
    return sales.where('date').between(start, end, true, true).reverse().toArray();
}

export function saleLineAmount({ qty, price, discount }) {
    return (Number(qty) || 0) * (Number(price) || 0) - (Number(discount) || 0);
}

export function getProductSaleLines(sales, customers, productId) {
    const customerNames = new Map(customers.map(customer => [String(customer.id), customer.name]));
    return sales.flatMap(sale => (sale.items ?? []).flatMap((item, index) =>
        String(item.productId) === productId ? [{
            key: `${sale.id}-${index}`,
            date: sale.date,
            customerId: String(sale.customerId ?? ''),
            customer: customerNames.get(String(sale.customerId)) || 'Unknown Customer',
            qty: item.qty,
            unit: item.unit,
            price: Number(item.price) || 0,
            amount: saleLineAmount(item),
        }] : []
    ));
}

export function getProductChartDateRange(period, value) {
    if (period === 'yearly' && /^\d{4}$/.test(value) && value !== '0000') {
        return { start: `${value}-01-01`, end: `${value}-12-31` };
    }
    if (period === 'monthly' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
        const endOfMonth = new Date(`${value}-01T00:00:00Z`);
        endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1, 0);
        return { start: `${value}-01`, end: endOfMonth.toISOString().slice(0, 10) };
    }
    if (period === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return { start: value, end: value };
    }
    return { start: '', end: '' };
}

export function getProductChartLines(sales, products) {
    const names = new Map(products.map(product => [String(product.id), product.name]));
    return sales.flatMap(sale => (sale.items ?? []).map(item => {
        const id = String(item.productId ?? '');
        return { id, name: names.get(id) || (id ? `Unknown Product (${id})` : 'Unknown Product'), amount: saleLineAmount(item) };
    }));
}

export function groupReportAmounts(lines) {
    const totals = new Map();
    for (const { id, name, amount } of lines) {
        const entry = totals.get(id) ?? { id, name, amount: 0 };
        entry.amount += amount;
        totals.set(id, entry);
    }
    return [...totals.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}
