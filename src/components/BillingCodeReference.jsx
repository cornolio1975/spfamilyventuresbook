import { useRef, useState } from 'react';
import { Package, Users } from 'lucide-react';
import { db, useLiveQuery } from '../db/hooks';
import billingCodes from '../data/billingCodes.json';

const catalogs = [
    { key: 'customers', label: 'Customer Codes', column: 'Customer', icon: Users },
    { key: 'products', label: 'Item Codes', column: 'Item', icon: Package },
];

function CodeList({ catalog }) {
    const [search, setSearch] = useState('');
    const records = useLiveQuery(() => db[catalog.key].toArray(), [catalog.key]);

    const namesById = new Map(records?.map(({ id, name }) => [id, name]));
    const query = search.trim().toLowerCase();
    const rows = Object.entries(billingCodes[catalog.key])
        .map(([code, id]) => ({ code, name: namesById.get(id) }))
        .filter(({ code, name }) => name && `${code} ${name}`.toLowerCase().includes(query))
        .sort((a, b) => a.code.localeCompare(b.code));

    return (
        <>
            <label className="mb-3 block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Search by code or name</span>
                <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
                />
            </label>
            {records && rows.length > 0 ? (
                <div className="max-h-[50vh] overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-gray-100 text-gray-700">
                            <tr>
                                <th scope="col" className="px-3 py-2">Code</th>
                                <th scope="col" className="px-3 py-2">{catalog.column}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map(({ code, name }) => (
                                <tr key={code}>
                                    <td className="px-3 py-2 font-mono font-semibold text-blue-800">{code}</td>
                                    <td className="px-3 py-2 text-gray-800">{name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p role="status" className="py-2 text-sm text-gray-600">
                    {records ? 'No matching codes.' : 'Loading codes…'}
                </p>
            )}
        </>
    );
}

export default function BillingCodeReference() {
    const dialog = useRef(null);
    const [catalog, setCatalog] = useState(null);

    return (
        <header className="no-print flex shrink-0 flex-wrap justify-end gap-2 border-b border-gray-200 bg-white px-3 py-2 sm:px-4">
            {catalogs.map((entry) => {
                const Icon = entry.icon;
                return (
                    <button
                        key={entry.key}
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => {
                            setCatalog(entry);
                            dialog.current.showModal();
                        }}
                        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
                    >
                        <Icon aria-hidden="true" size={16} />
                        {entry.label}
                    </button>
                );
            })}
            <dialog
                ref={dialog}
                aria-labelledby="billing-code-title"
                onClose={() => setCatalog(null)}
                className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border-0 bg-white p-4 shadow-xl backdrop:bg-gray-900/50 sm:p-6"
            >
                <div className="mb-3 flex items-center justify-between gap-4">
                    <h2 id="billing-code-title" className="text-lg font-semibold text-gray-900">{catalog?.label}</h2>
                    <form method="dialog">
                        <button className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                            Close
                        </button>
                    </form>
                </div>
                {catalog && <CodeList key={catalog.key} catalog={catalog} />}
            </dialog>
        </header>
    );
}
