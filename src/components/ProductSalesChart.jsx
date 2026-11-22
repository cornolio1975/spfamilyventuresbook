import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatDateShort } from '../utils/dateUtils';
import { getProductChartDateRange, getProductChartLines, getReportSales, groupReportAmounts, rankCustomersBySales, rankItemsByQuantity } from '../utils/reportSales';
import ReportSalesBars from './ReportSalesBars';

const periods = {
    daily: { label: 'Date', type: 'date', length: 10 },
    monthly: { label: 'Month', type: 'month', length: 7 },
    yearly: { label: 'Year', type: 'number', length: 4 },
};

const rankingLimit = 5;
const quantity = new Intl.NumberFormat('en-MY', { maximumFractionDigits: 3 });

export default function ProductSalesChart({ products, customers }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedPeriod = searchParams.get('period');
    const period = Object.hasOwn(periods, requestedPeriod) ? requestedPeriod : 'daily';
    const { label, type, length } = periods[period];
    const today = formatDateShort(new Date());
    const value = searchParams.get(period) ?? today.slice(0, length);
    const { start, end } = getProductChartDateRange(period, value);
    const result = useLiveQuery(async () => ({
        start, end, sales: await getReportSales(db.sales, { start, end })
    }), [start, end]);
    const sales = result?.start === start && result?.end === end ? result.sales : null;
    const lines = sales && products && getProductChartLines(sales, products);
    const rows = lines && groupReportAmounts(lines);
    const topCustomers = sales && customers && rankCustomersBySales(sales, customers, rankingLimit);
    const topItems = lines && rankItemsByQuantity(lines, rankingLimit);
    const detailSearch = new URLSearchParams(searchParams);
    detailSearch.set('start', start);
    detailSearch.set('end', end);

    const update = (key, nextValue) => {
        const next = new URLSearchParams(searchParams);
        next.set(key, nextValue);
        setSearchParams(next, { replace: true });
    };

    const productLink = row => row.id ? (
        <Link to={`/reports/products/${encodeURIComponent(row.id)}?${detailSearch}`}
            className="font-medium text-blue-700 underline underline-offset-2">{row.name}</Link>
    ) : row.name;

    return (
        <div className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Period
                    <select value={period} onChange={event => update('period', event.target.value)}
                        className="rounded-md border px-3 py-2 text-base">
                        <option value="daily">Daily</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    {label}
                    <input type={type} value={value} onChange={event => update(period, event.target.value)}
                        min={period === 'yearly' ? 1 : undefined} max={period === 'yearly' ? 9999 : undefined}
                        className="rounded-md border px-3 py-2 text-base" />
                </label>
            </div>
            {start ? (
                <>
                    <div className="grid items-start gap-4 md:grid-cols-2">
                        <ReportSalesBars title="Top 5 Customers by Sales" rows={topCustomers}
                            emptyMessage="No customer sales in this period." />
                        <div className="space-y-4">
                            {topItems?.length ? topItems.map(({ unit, rows: items }) => (
                                <ReportSalesBars key={unit} title={`Top 5 Items Sold (${unit || 'unit not recorded'})`}
                                    rows={items} renderLabel={productLink}
                                    formatAmount={amount => `${quantity.format(amount)}${unit ? ` ${unit}` : ''}`} />
                            )) : (
                                <ReportSalesBars title="Top 5 Items Sold" rows={topItems}
                                    emptyMessage="No item quantities sold in this period." />
                            )}
                        </div>
                    </div>
                    <ReportSalesBars title="Sales by Product" rows={rows} emptyMessage="No product sales in this period."
                        renderLabel={productLink} />
                </>
            ) : <p role="status" className="text-sm text-gray-600">Select a valid {label.toLowerCase()}.</p>}
        </div>
    );
}
