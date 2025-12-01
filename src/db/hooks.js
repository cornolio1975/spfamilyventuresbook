import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

export function useSettings() {
    const settings = useLiveQuery(() => db.settings.toArray());
    return settings?.[0] || {};
}

export { useLiveQuery, db };
