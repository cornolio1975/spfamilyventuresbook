import { db } from '../db/hooks';
import { formatDateShort } from './dateUtils';

export const exportDatabase = async () => {
    try {
        const customers = await db.customers.toArray();
        const products = await db.products.toArray();
        const sales = await db.sales.toArray();
        const settings = await db.settings.toArray();

        const data = {
            version: 1,
            timestamp: new Date().toISOString(),
            customers,
            products,
            sales,
            settings
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `sp_sales_backup_${formatDateShort(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return { success: true, message: 'Backup exported successfully.' };
    } catch (error) {
        console.error('Export failed:', error);
        return { success: false, message: 'Failed to export backup.' };
    }
};

export const importDatabase = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (!data.customers || !data.products || !data.sales) {
                    throw new Error('Invalid backup file format.');
                }

                await db.transaction('rw', db.customers, db.products, db.sales, db.settings, async () => {
                    // We use bulkPut to update existing records and add new ones
                    // This is a "Merge" strategy. To do a full "Replace", we would clear() first.
                    // For safety, let's clear first to avoid ID conflicts if the user wants a clean restore.
                    // However, clearing might lose local data if the backup is partial.
                    // Let's stick to bulkPut for now as it's safer for "syncing" data.
                    // Actually, for a true "Restore", clearing is usually expected to match the backup state.
                    // Let's ask the user? No, let's do a safe merge (bulkPut) for now.

                    if (data.customers.length) await db.customers.bulkPut(data.customers);
                    if (data.products.length) await db.products.bulkPut(data.products);
                    if (data.sales.length) await db.sales.bulkPut(data.sales);
                    if (data.settings && data.settings.length) await db.settings.bulkPut(data.settings);
                });

                resolve({ success: true, message: 'Backup imported successfully.' });
            } catch (error) {
                console.error('Import failed:', error);
                resolve({ success: false, message: 'Failed to import backup. Invalid file.' });
            }
        };

        reader.onerror = () => {
            resolve({ success: false, message: 'Failed to read file.' });
        };

        reader.readAsText(file);
    });
};
