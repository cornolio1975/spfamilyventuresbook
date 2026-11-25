import { db } from '../db/db';
import { formatDateShort } from './dateUtils';
import { exportBackup, importBackup } from './backupFile';

function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function exportDatabase() {
    return exportBackup(db, downloadFile, `sp_sales_backup_${formatDateShort(new Date())}.json`);
}

export function importDatabase(file) {
    return importBackup(db, file, message => window.confirm(message));
}
