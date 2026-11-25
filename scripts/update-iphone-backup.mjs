// Update the backup handlers in the published iPhone build while preserving its database and offline shell.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = process.argv[2];
if (!directory) throw new Error('Pass the published iphone directory.');
const indexPath = join(directory, 'index.html');
const workerPath = join(directory, 'sw.js');
const [index, worker, backup] = await Promise.all([
    readFile(indexPath, 'utf8'),
    readFile(workerPath, 'utf8'),
    readFile(new URL('../src/utils/backupFile.js', import.meta.url), 'utf8'),
]);
const entry = index.match(/src="\.\/assets\/(index-[\w-]+\.js)"/)?.[1];
if (!entry) throw new Error('Could not locate the published iPhone entry point.');

const bundle = await readFile(join(directory, 'assets', entry), 'utf8');
const start = bundle.indexOf('async function Oj(');
const end = bundle.indexOf('function Mj(', start);
if (start < 0 || end < 0 || !bundle.slice(start, end).includes('Backup imported successfully.')) {
    throw new Error('The published iPhone backup handlers have changed. Review the integration before deploying.');
}

const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const backupName = `backup-${hash(backup)}.js`;
const updatedBundle = `import { exportBackup, importBackup } from "./${backupName}";\n` +
    bundle.slice(0, start) +
    'async function Oj(){return exportBackup(Y,rl,`sp_familybook_backup_${Le(new Date)}.json`)}' +
    'async function Dj(file){return importBackup(Y,file,message=>window.confirm(message))}' +
    bundle.slice(end);
const oldHandler = 'if(U.target.files?.[0]&&confirm("This will merge the backup data with your current data. Continue?")){const M=await Dj(U.target.files[0]);alert(M.message),M.success&&window.location.reload()}';
if (!updatedBundle.includes(oldHandler) || !worker.includes(`"assets/${entry}"`)) {
    throw new Error('Could not locate the iPhone import control or offline asset list.');
}
const client = updatedBundle.replace(oldHandler, 'const file=U.target.files?.[0];U.target.value="";if(file){const result=await Dj(file);alert(result.message)}');
const clientName = `index-${hash(client)}.js`;
await Promise.all([
    writeFile(join(directory, 'assets', backupName), backup),
    writeFile(join(directory, 'assets', clientName), client),
    writeFile(indexPath, index.replace(entry, clientName)),
    writeFile(workerPath, worker
        .replace(`"assets/${entry}"`, `"assets/${clientName}","assets/${backupName}"`)
        .replace(/const cacheName = prefix \+ '[a-f0-9]+'/, `const cacheName = prefix + '${hash(client+backup)}'`)),
]);
