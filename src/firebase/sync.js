import { db } from './config';
import { collection, addDoc, setDoc, deleteDoc, doc, onSnapshot, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db as localDb } from '../db/hooks';

// Collections to sync
const COLLECTIONS = ['customers', 'products', 'sales', 'settings', 'vendors', 'vendor_purchases', 'payments'];

// Helper to sync a single collection from Cloud to Local
const syncCollectionToLocal = async (collectionName) => {
    const q = query(collection(db, collectionName));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const changes = snapshot.docChanges();
        if (changes.length === 0) return;

        await localDb.transaction('rw', localDb[collectionName], async () => {
            for (const change of changes) {
                const data = change.doc.data();
                // Ensure ID is preserved
                data.id = parseInt(change.doc.id) || change.doc.id;

                if (change.type === 'added' || change.type === 'modified') {
                    await localDb[collectionName].put(data);
                } else if (change.type === 'removed') {
                    await localDb[collectionName].delete(data.id);
                }
            }
        });
        console.log(`Synced ${changes.length} changes for ${collectionName} from Cloud.`);
    });
    return unsubscribe;
};

// Start listening to all collections
export const startSync = async () => {
    const unsubscribes = [];
    for (const col of COLLECTIONS) {
        const unsub = await syncCollectionToLocal(col);
        unsubscribes.push(unsub);
    }
    return () => unsubscribes.forEach(u => u());
};


