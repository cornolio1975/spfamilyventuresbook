export function hasBillableAmount(amount) {
    return Number(amount.toFixed(2)) !== 0;
}

export function billableItemsKey(items) {
    const billableItems = items.filter(item => hasBillableAmount(item.qty * item.price - (item.discount || 0)));
    return billableItems.map(item => {
        const unit = String(item.unit ?? '').trim().toLowerCase();
        return JSON.stringify([
            Number(item.productId),
            Number(item.qty),
            unit === 'pc' ? 'pcs' : unit,
            Number(item.price),
            Number(item.discount || 0)
        ]);
    }).sort();
}
