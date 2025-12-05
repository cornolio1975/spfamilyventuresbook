import Dexie from 'dexie';
import { pushToCloud, deleteFromCloud } from '../firebase/sync';

export const db = new Dexie('SPFamilyVenturesDB');

db.version(1).stores({
    settings: '++id', // Singleton for company settings
    customers: '++id, name, email',
    products: '++id, name',
    sales: '++id, customerId, date',
    users: '++id, username', // For authentication
    vendors: '++id, name, email', // Vendor information
    vendorBills: '++id, vendorId, date', // Vendor bills
});

// Add hooks for sync
['customers', 'products', 'sales', 'settings', 'users', 'vendors', 'vendorBills'].forEach(tableName => {
    db[tableName].hook('creating', function (primKey, obj, transaction) {
        this.onsuccess = function (id) {
            pushToCloud(tableName, { ...obj, id });
        };
    });
    db[tableName].hook('updating', function (mods, primKey, obj, transaction) {
        // mods contains only modified properties. We might want the full object.
        // But pushToCloud uses setDoc which merges if we use { merge: true } or overwrites.
        // My sync.js implementation uses setDoc(docRef, data). This overwrites!
        // So we need the full object. 'obj' is the old object. We need to merge mods.
        const updatedObj = { ...obj, ...mods, id: primKey };
        pushToCloud(tableName, updatedObj);
    });
    db[tableName].hook('deleting', function (primKey, obj, transaction) {
        deleteFromCloud(tableName, primKey);
    });
});

// Pre-populate settings if empty
db.on('populate', () => {
    db.settings.add({
        companyName: 'SP FAMILY VENTURES EST ENTERPRISE',
        regNum: '(002905563-H)',
        desc1: 'PEMBORONG AYAM HIDUP / AYAM PROSES',
        desc2: 'AYAM DAGING(BROILER), AYAM KAMPUNG & AYAM TUA (TELOR)',
        contact: 'H/P (012)627-3691',
        logoLeft: null,
        logoRight: null,
    });

    // Seed default user
    db.users.add({
        username: 'svanathan75',
        password: 'sp1234' // Storing plain text for simplicity as requested, in real app use hash
    });
});

// Ensure default user exists (fix for existing databases)
db.on('ready', async () => {
    try {
        const userCount = await db.users.count();
        if (userCount === 0) {
            await db.users.add({
                username: 'svanathan75',
                password: 'sp1234'
            });
            console.log('Default user seeded via ready hook');
        }
    } catch (error) {
        console.error('Error checking/seeding users:', error);
    }
});
