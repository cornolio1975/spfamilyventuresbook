import { db } from './config';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

// Push a local change to Cloud
export const pushToCloud = async (collectionName, data) => {
    try {
        // Use the ID as the document ID to ensure consistency
        const docRef = doc(db, collectionName, String(data.id));
        await setDoc(docRef, data);
        console.log(`Pushed ${collectionName}/${data.id} to Cloud.`);
    } catch (error) {
        console.error(`Failed to push to cloud:`, error);
    }
};

// Push a local deletion to Cloud
export const deleteFromCloud = async (collectionName, id) => {
    try {
        await deleteDoc(doc(db, collectionName, String(id)));
        console.log(`Deleted ${collectionName}/${id} from Cloud.`);
    } catch (error) {
        console.error(`Failed to delete from cloud:`, error);
    }
};
