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
            customer: customerNames.get(String(sale.customerId)) || 'Unknown Customer',
            qty: item.qty,
            unit: item.unit,
            price: Number(item.price) || 0,
            amount: saleLineAmount(item),
        }] : []
    ));
}
