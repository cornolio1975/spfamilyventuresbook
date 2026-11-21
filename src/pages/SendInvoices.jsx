import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import InvoiceView from '../components/InvoiceView';
import InvoiceFitDialog from '../components/InvoiceFitDialog';
import { db, useLiveQuery, useSettings } from '../db/hooks';
import { formatDateShort } from '../utils/dateUtils';
import { getInvoiceAmounts, getInvoiceNumber, getWhatsAppNumber } from '../utils/invoiceSharing';

const selectClass = 'w-full rounded-md border border-gray-300 bg-white p-2 text-base';
const actionClass = 'inline-flex items-center rounded-lg border px-4 py-2 text-sm font-semibold';

function InvoiceDelivery({ sale, customer, products, settings }) {
    const invoiceRef = useRef(null);
    const mounted = useRef(false);
    const [isFitOpen, setIsFitOpen] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
        if (imageUrl) return () => URL.revokeObjectURL(imageUrl);
    }, [imageUrl]);

    const invoiceNumber = `INV-${getInvoiceNumber(sale.id, settings.invoiceStart)}`;
    const { subtotal, prevBalance, paidAmount, grandTotal, balanceDue } = getInvoiceAmounts(sale);
    const phone = getWhatsAppNumber(customer.contact);
    const chatUrl = phone ? `https://wa.me/${phone}` : null;
    const message = [
        `Hello ${customer.name}, here is the summary for invoice ${invoiceNumber} dated ${sale.date}.`,
        `Grand total: RM ${grandTotal.toFixed(2)}`,
        `Amount paid: RM ${paidAmount.toFixed(2)}`,
        `Balance due: RM ${balanceDue.toFixed(2)}`,
        'Thank you.'
    ].join('\n');

    const prepareImage = async () => {
        const invoice = invoiceRef.current;
        setIsCapturing(true);
        setError('');
        try {
            const { default: html2canvas } = await import('html2canvas-pro');
            if (document.fonts) await document.fonts.ready;
            await Promise.all([...invoice.querySelectorAll('img')].map(img => img.decode()));
            if (!mounted.current) return;
            const canvas = await html2canvas(invoice, { backgroundColor: '#ffffff', scale: 2 });
            const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!png) throw new Error('Canvas encoding failed');
            if (mounted.current) setImageUrl(URL.createObjectURL(png));
        } catch {
            if (mounted.current) setError('Could not create the invoice image. Try again.');
        } finally {
            if (mounted.current) setIsCapturing(false);
        }
    };

    const invoice = (
        <InvoiceView settings={settings} customer={customer} saleDate={sale.date} id={sale.id}
            items={sale.items ?? []} products={products} prevBalance={prevBalance}
            prevBalanceMemo={sale.memo} subtotal={subtotal} paidAmount={paidAmount} grandTotal={grandTotal} />
    );

    return (
        <section className="space-y-4">
            <div className="rounded-lg border bg-white p-4">
                <h2 className="font-semibold">{invoiceNumber} · {customer.name}</h2>
                {chatUrl ? (
                    <>
                        <p className="mt-1 text-sm text-gray-700">WhatsApp +{phone} · Balance due RM {balanceDue.toFixed(2)}</p>
                        <p className="mt-2 text-sm text-gray-600">Download the invoice image and attach it in the customer’s WhatsApp chat. Then send the prefilled balance message separately.</p>
                    </>
                ) : (
                    <p role="status" className="mt-1 text-sm text-red-700">Add a valid WhatsApp number under Customers for {customer.name}.</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setIsFitOpen(true)} className={`${actionClass} border-gray-300 text-gray-800`}>
                        Fit Full Invoice
                    </button>
                    {imageUrl ? (
                        <a href={imageUrl} download={`${invoiceNumber}.png`} className={`${actionClass} border-blue-700 text-blue-800`}>Download Invoice Image</a>
                    ) : (
                        <button type="button" onClick={prepareImage} disabled={isCapturing} className={`${actionClass} border-blue-700 text-blue-800 disabled:opacity-50`}>
                            {isCapturing ? 'Creating Image…' : 'Create Invoice Image'}
                        </button>
                    )}
                    {chatUrl && (
                        <>
                            <a href={chatUrl} target="_blank" rel="noopener noreferrer" className={`${actionClass} border-green-700 text-green-800`}>Open WhatsApp Chat</a>
                            <a href={`${chatUrl}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"
                                className={`${actionClass} border-green-700 bg-green-700 text-white`}>Send Balance Message</a>
                        </>
                    )}
                </div>
                {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
            </div>
            {isFitOpen && (
                <InvoiceFitDialog onClose={() => setIsFitOpen(false)}>{invoice}</InvoiceFitDialog>
            )}
            <div className="overflow-hidden rounded-lg border bg-white">
                <div ref={invoiceRef}>
                    {invoice}
                </div>
            </div>
        </section>
    );
}

export default function SendInvoices() {
    const [date, setDate] = useState(() => formatDateShort(new Date()));
    const [customerId, setCustomerId] = useState('');
    const [saleId, setSaleId] = useState('');
    const customers = useLiveQuery(() => db.customers.toArray());
    const products = useLiveQuery(() => db.products.toArray());
    const settings = useSettings();
    const results = useLiveQuery(async () => ({
        date,
        invoices: date ? await db.sales.where('date').equals(date).toArray() : []
    }), [date]);

    const invoices = results?.date === date ? results.invoices : undefined;
    const customerIds = new Set(invoices?.map(sale => String(sale.customerId)));
    const matchingCustomers = customers?.filter(customer => customerIds.has(String(customer.id)))
        .sort((a, b) => a.name.localeCompare(b.name));
    const customer = matchingCustomers?.find(entry => String(entry.id) === customerId);
    const customerInvoices = invoices?.filter(sale => String(sale.customerId) === customerId) ?? [];
    const sale = customerInvoices.length === 1 ? customerInvoices[0] : customerInvoices.find(entry => String(entry.id) === saleId);

    return (
        <main className="mx-auto max-w-5xl space-y-4 p-4 pb-24">
            <Link to="/sales" className="inline-flex items-center gap-2 text-sm font-medium text-blue-800"><ArrowLeft size={16} /> Sales</Link>
            <h1 className="text-2xl font-bold text-gray-900">Send Invoices</h1>
            <div className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-3">
                <label className="text-sm font-medium">
                    Invoice Date
                    <input type="date" value={date} className={selectClass} onChange={event => {
                        setDate(event.target.value);
                        setCustomerId('');
                        setSaleId('');
                    }} />
                </label>
                <label className="text-sm font-medium">
                    Customer
                    <select className={selectClass} value={customerId} disabled={!matchingCustomers?.length} onChange={event => {
                        setCustomerId(event.target.value);
                        setSaleId('');
                    }}>
                        <option value="">Select Customer</option>
                        {matchingCustomers?.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                    </select>
                </label>
                {customerInvoices.length > 1 && (
                    <label className="text-sm font-medium">
                        Invoice
                        <select className={selectClass} value={saleId} onChange={event => setSaleId(event.target.value)}>
                            <option value="">Select Invoice</option>
                            {customerInvoices.map(entry => (
                                <option key={entry.id} value={entry.id}>
                                    INV-{getInvoiceNumber(entry.id, settings.invoiceStart)} · RM {getInvoiceAmounts(entry).balanceDue.toFixed(2)} due
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>
            {date && invoices && customers && !matchingCustomers.length && (
                <p role="status" className="text-sm text-gray-600">No invoices with a saved customer for this date.</p>
            )}
            {sale && customer && products && (
                <InvoiceDelivery key={sale.id} sale={sale} customer={customer} products={products} settings={settings} />
            )}
        </main>
    );
}
