const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function preferredCode(name) {
    const words = String(name ?? '').normalize('NFD').replace(/\p{M}/gu, '')
        .toUpperCase().match(/[A-Z]+/g) ?? [];
    const initials = words.map(word => word[0]).join('');
    return (initials + words.join('').slice(1)).slice(0, 3).padEnd(3, 'X');
}

export function vendorCodeRows(vendors) {
    const used = new Set();
    const sorted = [...vendors].sort((a, b) =>
        String(a.id).localeCompare(String(b.id), 'en', { numeric: true }) ||
        String(a.id).localeCompare(String(b.id), 'en')
    );
    const rows = sorted.map(vendor => {
        const preferred = preferredCode(vendor.name);
        const code = used.has(preferred) ? null : preferred;
        if (code) used.add(code);
        return { vendor, preferred, code };
    });

    for (const row of rows) {
        if (row.code) continue;
        const prefix = row.preferred.slice(0, 2);
        const candidates = [...alphabet].map(letter => prefix + letter);
        row.code = candidates.find(code => !used.has(code));
        for (let index = 0; !row.code && index < 26 ** 3; index++) {
            const code = alphabet[Math.floor(index / 676)] + alphabet[Math.floor(index / 26) % 26] + alphabet[index % 26];
            if (!used.has(code)) row.code = code;
        }
        if (row.code) used.add(row.code);
    }

    return rows.filter(row => row.code);
}

export function resolveVendorCode(code, vendors) {
    if (code.startsWith('V-')) {
        return vendors.find(vendor => `V-${String(vendor.id).padStart(3, '0')}`.toUpperCase() === code);
    }
    return vendorCodeRows(vendors).find(row => row.code === code)?.vendor;
}
