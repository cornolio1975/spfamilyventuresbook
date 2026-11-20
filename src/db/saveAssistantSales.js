function saleKey(sale) {
    const items = sale.items.map(item => {
        const unit = String(item.unit ?? '').trim().toLowerCase();
        return JSON.stringify([
            Number(item.productId),
            Number(item.qty),
            unit === 'pc' ? 'pcs' : unit,
            Number(item.price),
            Number(item.discount || 0)
        ]);
    }).sort();

    return JSON.stringify([sale.date, Number(sale.customerId), Number(sale.prevBalance || 0), items]);
}

export function saveAssistantSales(db, sales) {
    return db.transaction('rw', db.sales, async () => {
        const dates = [...new Set(sales.map(sale => sale.date))];
        const existing = await db.sales.where('date').anyOf(dates).toArray();
        const seen = new Set(existing.filter(sale => Array.isArray(sale.items)).map(saleKey));

        const newSales = sales.filter(sale => {
            const key = saleKey(sale);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        const ids = newSales.length ? await db.sales.bulkAdd(newSales, { allKeys: true }) : [];

        return { ids, skipped: sales.length - newSales.length };
    });
}
