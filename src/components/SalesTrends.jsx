import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatDateShort } from '../utils/dateUtils';
import { formatRinggit } from '../utils/formatRinggit';
import { groupSalesByPeriod } from '../utils/salesTrends';

const months = new Intl.DateTimeFormat('en-MY', { month: 'short', timeZone: 'UTC' });
const compact = new Intl.NumberFormat('en-MY', { notation: 'compact', maximumFractionDigits: 1 });
const pad = number => String(number).padStart(2, '0');

function SalesChart({ title, periodLabel, points, total }) {
    const [selected, setSelected] = useState(null);
    const point = points.find(entry => entry.key === selected);
    const min = Math.min(0, ...points.map(entry => entry.cents));
    const max = Math.max(0, ...points.map(entry => entry.cents)) || (min === 0 ? 100 : 0);
    const plotHeight = 150;
    const left = 72;
    const width = Math.max(320, left + points.length * 26 + 12);
    const step = (width - left - 12) / points.length;
    const y = value => 20 + (max - value) / (max - min) * plotHeight;
    const baseline = y(0);
    const ticks = [...new Set([max, max / 2, 0, min])];

    return (
        <section className="border-b border-gray-100 p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold text-gray-800">{title}</h2>
                {total !== undefined && <p className="font-semibold text-blue-900">{formatRinggit(total / 100)}</p>}
            </div>
            <div className="mt-2 overflow-x-auto">
                <svg viewBox={`0 0 ${width} 200`} style={{ minWidth: width }} className="w-full max-w-5xl"
                    aria-label={`${title}, ${periodLabel.toLowerCase()} versus sales in ringgit`} role="img">
                    {ticks.map(tick => (
                        <g key={tick}>
                            <line x1={left} x2={width - 12} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#94a3b8' : '#e2e8f0'} />
                            <text x={left - 7} y={y(tick) + 4} textAnchor="end" fill="#475569" fontSize="10">RM {compact.format(tick / 100)}</text>
                        </g>
                    ))}
                    {points.map((entry, index) => {
                        const x = left + step * (index + 0.5);
                        return (
                            <g key={entry.key} onClick={() => setSelected(entry.key)} className="cursor-pointer">
                                <title>{entry.label} · {formatRinggit(entry.cents / 100)}</title>
                                <rect x={x - step / 2} y="15" width={step} height="180" fill="transparent" />
                                <rect x={x - step * 0.32} y={Math.min(baseline, y(entry.cents))}
                                    width={step * 0.64} height={Math.max(1, Math.abs(y(entry.cents) - baseline))}
                                    rx="2" fill={entry.key === selected ? '#1e3a8a' : entry.cents < 0 ? '#be123c' : '#2563eb'} />
                                <text x={x} y="190" textAnchor="middle" fill="#475569" fontSize="10">{entry.label}</text>
                            </g>
                        );
                    })}
                </svg>
            </div>
            {point && <p role="status" className="mt-2 text-sm text-gray-700">{point.key} · {formatRinggit(point.cents / 100)}</p>}
            <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium text-blue-800">View sales totals</summary>
                <table className="mt-2 w-full text-left">
                    <thead><tr><th scope="col" className="py-2">{periodLabel}</th><th scope="col" className="py-2 text-right">Sales</th></tr></thead>
                    <tbody className="divide-y">
                        {points.map(entry => (
                            <tr key={entry.key}><td className="py-2">{entry.label}</td><td className="py-2 text-right">{formatRinggit(entry.cents / 100)}</td></tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </section>
    );
}

export default function SalesTrends({ mode }) {
    const today = formatDateShort(new Date());
    const currentYear = today.slice(0, 4);
    const [month, setMonth] = useState(today.slice(0, 7));
    const [year, setYear] = useState(currentYear);
    const sales = useLiveQuery(() => db.sales.toArray());
    if (!sales) return <p className="p-4" role="status">Loading sales charts…</p>;

    const daily = mode === 'monthly';
    const annualTotals = groupSalesByPeriod(sales, 4);
    const years = [...new Set([currentYear, ...annualTotals.keys()])].sort();
    const periodTotals = groupSalesByPeriod(sales, daily ? 10 : 7);
    const [monthYear, monthNumber] = month.split('-').map(Number);
    const pointCount = daily ? new Date(Date.UTC(monthYear, monthNumber, 0)).getUTCDate() : 12;
    const points = Array.from({ length: pointCount }, (_, index) => {
        const prefix = daily ? month : year;
        const key = `${prefix}-${pad(index + 1)}`;
        const label = daily ? String(index + 1) : months.format(new Date(Date.UTC(2000, index, 1)));
        return { key, label, cents: periodTotals.get(key) ?? 0 };
    });
    const annualPoints = years.map(key => ({ key, label: key, cents: annualTotals.get(key) ?? 0 }));

    return (
        <div>
            <div className="border-b border-gray-100 p-4 sm:p-5">
                <label className="flex flex-wrap items-center gap-3 text-sm font-medium text-gray-700">
                    {daily ? 'Select month' : 'Select year'}
                    {daily ? (
                        <input type="month" value={month} onChange={event => event.target.value && setMonth(event.target.value)}
                            className="rounded-md border px-3 py-2" />
                    ) : (
                        <select value={year} onChange={event => setYear(event.target.value)} className="rounded-md border px-3 py-2">
                            {years.map(value => <option key={value}>{value}</option>)}
                        </select>
                    )}
                </label>
            </div>
            <SalesChart key={daily ? month : year} title={daily ? 'Sales by Date' : 'Sales by Month'}
                periodLabel={daily ? 'Day of month' : 'Month'} points={points}
                total={points.reduce((sum, entry) => sum + entry.cents, 0)} />
            {!daily && (
                <>
                    <SalesChart title="Yearly Sales Comparison" periodLabel="Year" points={annualPoints} />
                    <p className="px-4 py-3 text-sm text-gray-600">The current year shows sales recorded so far.</p>
                </>
            )}
        </div>
    );
}
