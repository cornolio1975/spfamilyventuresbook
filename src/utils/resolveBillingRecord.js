function normalizeProductName(name) {
    return name.toLowerCase().replace(/\s+/g, '').replace(/^ayam/, 'a');
}

export function resolveBillingRecord(reference, records) {
    if (typeof reference === 'number') {
        return records.find(record => record.id === reference);
    }

    const name = normalizeProductName(reference);
    return records.find(record => normalizeProductName(record.name ?? '') === name);
}
