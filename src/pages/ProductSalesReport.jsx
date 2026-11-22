import ReportSalesBars from '../components/ReportSalesBars';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { db } from '../db/db';
import { getProductSaleLines, getReportDateRange, getReportSales, groupReportAmounts } from '../utils/reportSales';

const money = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' });

export default function ProductSalesReport() {
    const { productId } = useParams();
    const [searchParams] = useSearchParams();
    const dateRange = getReportDateRange(searchParams);
    const reportSearch = new URLSearchParams(searchParams);
    if (!reportSearch.has('tab')) reportSearch.set('tab', 'products');
    const products = useLiveQuery(() => db.products.toArray());
    const customers = useLiveQuery(() => db.customers.toArray());
    const sales = useLiveQuery(() => getReportSales(db.sales, dateRange), [dateRange.start, dateRange.end]);

    const product = products?.find(item => String(item.id) === productId);
    const lines = sales && customers && getProductSaleLines(sales, customers, productId);

    const customerTotals = lines && groupReportAmounts(lines.map(line => ({
        id: line.customerId, name: line.customer, amount: line.amount
    })));

    return (
        <div className="mx-auto max-w-6xl p-4 pb-24">
            <Link to={`/reports?${reportSearch}`} className="mb-4 inline-flex items-center gap-2 py-2 text-sm font-medium text-blue-700">
                <ArrowLeft size={16} aria-hidden="true" /> Back to Product Report
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">Sales by Item</h1>
            <h2 className="mt-1 text-lg font-semibold text-gray-700">{product?.name || (products && 'Unknown Product')}</h2>
            <p className="mb-5 text-sm text-gray-600">{dateRange.start} to {dateRange.end}</p>

            <div className="mb-5">
                <ReportSalesBars title="Sales by Customer" rows={customerTotals}
                    emptyMessage="No customer sales for this product in the selected period." />
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                {lines?.length ? (
                    <table className="w-full text-left text-sm">
                        <thead className="border-b bg-gray-50 text-gray-600">
                            <tr>
                                <th scope="col" className="px-3 py-3">Customer</th>
                                <th scope="col" className="px-2 py-3 text-right">Qty</th>
                                <th scope="col" className="px-2 py-3 text-right">Unit Price</th>
                                <th scope="col" className="px-3 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {lines.map(line => (
                                <tr key={line.key}>
                                    <td className="px-3 py-3">
                                        <div className="font-medium text-gray-900">{line.customer}</div>
                                        <div className="whitespace-nowrap text-xs text-gray-500">{line.date}</div>
                                    </td>
                                    <td className="whitespace-nowrap px-2 py-3 text-right">{line.qty} {line.unit}</td>
                                    <td className="whitespace-nowrap px-2 py-3 text-right">{money.format(line.price)}</td>
                                    <td className="whitespace-nowrap px-3 py-3 text-right font-medium">{money.format(line.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t bg-gray-50 font-semibold text-gray-800">
                            <tr>
                                <th scope="row" colSpan={3} className="px-3 py-3 text-right">Total Sales</th>
                                <td className="whitespace-nowrap px-3 py-3 text-right">{money.format(lines.reduce((sum, line) => sum + line.amount, 0))}</td>
                            </tr>
                        </tfoot>
                    </table>
                ) : (
                    <p role="status" className="p-8 text-center text-sm text-gray-600">
                        {lines ? 'No sales for this product in the selected period.' : 'Loading item sales…'}
                    </p>
                )}
            </div>
        </div>
    );
}
