import Dexie from 'dexie';
import { pushToCloud, deleteFromCloud } from '../firebase/sync';

export const db = new Dexie('SPFamilyVenturesDB');

db.version(1).stores({
    settings: '++id', // Singleton for company settings
    customers: '++id, name, email',
    products: '++id, name',
    sales: '++id, customerId, date',
});

// Add hooks for sync
['customers', 'products', 'sales', 'settings'].forEach(tableName => {
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
});
