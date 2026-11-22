import { formatRinggit } from '../utils/formatRinggit';

export default function ReportSalesBars({ title, rows, emptyMessage, renderLabel, formatAmount = formatRinggit }) {
    const min = rows?.reduce((limit, row) => Math.min(limit, row.amount), 0) ?? 0;
    const max = rows?.reduce((limit, row) => Math.max(limit, row.amount), 0) ?? 0;
    const range = max - min || 1;
    const zero = -min / range * 100;

    return (
        <section aria-label={title} className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
            <h2 className="text-lg font-bold text-gray-800">{title}</h2>
            {!rows?.length ? (
                <p role="status" className="mt-3 text-sm text-gray-600">{rows ? emptyMessage : 'Loading sales…'}</p>
            ) : (
                <ul className="mt-4 space-y-4">
                    {rows.map(row => (
                        <li key={row.id}>
                            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                                <span className="min-w-0 break-words">{renderLabel ? renderLabel(row) : row.name}</span>
                                <span className="shrink-0 font-semibold tabular-nums">{formatAmount(row.amount)}</span>
                            </div>
                            <div aria-hidden="true" className="relative h-3 overflow-hidden rounded bg-gray-100">
                                <div className="absolute inset-y-0 w-px bg-gray-400" style={{ left: `${zero}%` }} />
                                <div className={`absolute inset-y-0 rounded-sm ${row.amount < 0 ? 'bg-rose-600' : 'bg-blue-600'}`}
                                    style={{ left: `${(Math.min(row.amount, 0) - min) / range * 100}%`, width: `${Math.abs(row.amount) / range * 100}%` }} />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
