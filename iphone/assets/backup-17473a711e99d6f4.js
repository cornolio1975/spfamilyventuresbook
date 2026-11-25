const collections = [
    'customers', 'products', 'sales', 'settings',
    'vendors', 'vendor_purchases', 'payments', 'vendor_payments',
];
const legacyCollections = collections.slice(0, 4);
const labels = [
    'Customers', 'Products', 'Sales', 'Company settings',
    'Vendors', 'Vendor bills', 'Customer payments', 'Vendor payments',
];

function describeTables(data) {
    return collections.map((name, index) =>
        `${labels[index]}: ${data[name]?.length ?? 'missing'}`).join('\n');
}

function sortKeys(value) {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])]));
    }
    return value;
}

async function checksum(data) {
    const bytes = new TextEncoder().encode(JSON.stringify(sortKeys(data)));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function readBackup(data) {
    if (!data || ![1, 2].includes(data.version)) throw new Error('Unsupported backup format.');

    const names = data.version === 2 ? collections : legacyCollections;
    for (const name of names) {
        const rows = data[name];
        if (data.version === 1 && name === 'settings' && rows === undefined) continue;
        if (!Array.isArray(rows)) throw new Error(`Missing or invalid table: ${name}.`);
        const ids = new Set();
        for (const row of rows) {
            const id = row?.id;
            if (!row || Array.isArray(row) ||
                !(Number.isSafeInteger(id) || (typeof id === 'string' && id.trim())) ||
                (typeof id === 'string' && id.includes('/')) || ids.has(String(id))) {
                throw new Error(`Invalid or duplicate record ID in ${name}.`);
            }
            ids.add(String(id));
        }
    }

    if (data.version === 2 && data.sha256 !== undefined) {
        const { sha256, ...payload } = data;
        if (await checksum(payload) !== sha256) throw new Error('Backup checksum does not match.');
    }
    return names.filter(name => data[name] !== undefined);
}

export async function exportBackup(db, saveFile, filename) {
    try {
        const tables = collections.map(name => db.table(name));
        const rows = await db.transaction('r', tables, () => Promise.all(tables.map(table => table.toArray())));
        const data = JSON.parse(JSON.stringify({
            version: 2,
            timestamp: new Date().toISOString(),
            ...Object.fromEntries(collections.map((name, index) => [name, rows[index]])),
        }));
        data.sha256 = await checksum(data);
        const file = JSON.stringify(data, null, 2);
        await readBackup(JSON.parse(file));

        await saveFile(new Blob([file], { type: 'application/json' }), filename);

        return {
            success: true,
            message: `Verified backup generated.\n\n${describeTables(data)}\n\nCheck that the file is saved before importing it on another device.`,
        };
    } catch (error) {
        console.error('Export failed:', error);
        return { success: false, message: 'Failed to export and verify the backup.' };
    }
}

export async function importBackup(db, file, confirmImport) {
    try {
        const data = JSON.parse(await file.text());
        const names = await readBackup(data);
        const warning = data.version === 1
            ? '\n\nThis is a partial backup. Missing tables must be exported from the original app to recover their records.'
            : data.sha256 === undefined
                ? '\n\nThis older file has no checksum. All eight tables are present.'
                : '\n\nThe file checksum matches.';
        if (!confirmImport(`Import missing records from this file?\n\n${describeTables(data)}${warning}\n\nIf an existing business record differs, the import will stop.`)) {
            return { success: false, message: 'Import cancelled.' };
        }

        let added = 0;
        let skipped = 0;
        let keptSettings = 0;
        await db.transaction('rw', names.map(name => db.table(name)), async () => {
            for (const name of names) {
                const table = db.table(name);
                for (const row of data[name]) {
                    const alternateId = typeof row.id === 'number' ? String(row.id) : Number(row.id);
                    const existing = await table.get(row.id) ??
                        (String(alternateId) === String(row.id) ? await table.get(alternateId) : undefined);
                    if (existing === undefined) {
                        await table.add(row);
                        added++;
                    } else if (JSON.stringify(sortKeys(existing)) === JSON.stringify(sortKeys(row))) {
                        skipped++;
                    } else if (name === 'settings') {
                        keptSettings++;
                    } else {
                        throw new Error(`Record ${row.id} in ${name} differs from the current data.`);
                    }
                }
            }
        });
        const legacyNote = data.version === 1 ? ' The file was partial.' : '';
        const settingsNote = keptSettings ? ' Existing company settings were kept.' : '';
        return { success: true, message: `Imported ${added} records on this device. ${skipped} already matched.${legacyNote}${settingsNote}` };
    } catch (error) {
        console.error('Import failed:', error);
        return { success: false, message: `Import stopped. No records were changed. ${error.message}` };
    }
}
