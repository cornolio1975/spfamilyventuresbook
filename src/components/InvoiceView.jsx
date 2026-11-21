import { formatDateShort } from '../utils/dateUtils';
import { getInvoiceNumber } from '../utils/invoiceSharing';
import logo from '../assets/logo.jpg';
import poultryLogo from '../assets/poultry_logo.jpg';

export default function InvoiceView({ settings, customer, saleDate, id, items, products, prevBalance, prevBalanceMemo, subtotal, paidAmount, grandTotal }) {
    const getProductName = (id) => products?.find(p => p.id === id)?.name || 'Unknown';
    const totalDiscount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const balanceDue = grandTotal - (paidAmount || 0);

    // Calculate display ID
    const displayId = getInvoiceNumber(id, settings.invoiceStart);

    return (
        <div className="bg-white p-8 max-w-4xl mx-auto print:p-0 print:w-full print:max-w-none font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row print:flex-row justify-between items-center md:items-start print:items-start mb-8 border-b-2 border-gray-100 pb-6 gap-4">
                {/* Left Logo */}
                <div className="w-40 h-40 flex-shrink-0">
                    <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                </div>

                {/* Center Details */}
                <div className="text-center flex-1 px-4 order-first md:order-none print:order-none w-full">
                    <h1 className="text-xl font-extrabold uppercase tracking-wide text-gray-900">{settings.companyName}</h1>
                    <p className="text-sm font-bold text-gray-600">{settings.regNum}</p>
                    <p className="text-xs mt-1 text-gray-500 font-medium">{settings.desc1}</p>
                    <p className="text-xs text-gray-500 font-medium">{settings.desc2}</p>
                    <p className="text-sm font-bold mt-2 text-gray-800">{settings.contact}</p>
                </div>

                {/* Right Logo */}
                <div className="w-40 h-40 flex-shrink-0 hidden md:block print:block">
                    <img src={poultryLogo} alt="Poultry" className="w-full h-full object-contain" />
                </div>
            </div>

            {/* Bill To & Invoice Details */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
                <div className="w-full md:w-auto">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Billed To</p>
                    <h2 className="text-lg font-bold text-gray-900">{customer.name}</h2>
                    <p className="text-sm text-gray-600 max-w-[250px]">{customer.address}</p>
                    <p className="text-sm text-gray-600">{customer.contact}</p>
                </div>
                <div className="text-left md:text-right w-full md:w-auto">
                    <h1 className="text-2xl font-bold text-gray-400 uppercase mb-1">Delivery Order / Invoice</h1>
                    <p className="text-sm font-bold text-gray-600">#INV-{displayId}</p>
                    <p className="text-sm font-bold text-gray-600">Date: {formatDateShort(new Date(saleDate))}</p>
                </div>
            </div>

            {/* Items Table (Desktop & Print) */}
            <div className="hidden md:block print:!block overflow-x-auto">
                <table className="w-full mb-8 border-collapse min-w-[600px] print:!min-w-full print:!table">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-center py-3 px-2 text-sm font-bold text-gray-600 w-12">#</th>
                            <th className="text-left py-3 px-2 text-sm font-bold text-gray-600">Item</th>
                            <th className="text-center py-3 px-2 text-sm font-bold text-gray-600">Quantity</th>
                            <th className="text-right py-3 px-2 text-sm font-bold text-gray-600">Unit Price</th>
                            <th className="text-right py-3 px-2 text-sm font-bold text-gray-600">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={index} className="border-b border-gray-50">
                                <td className="text-center py-3 px-2 text-sm text-gray-600">{index + 1}</td>
                                <td className="py-3 px-2">
                                    <div className="font-bold text-gray-800">{getProductName(parseInt(item.productId))}</div>
                                    {item.memo && <div className="text-xs text-gray-500 italic mt-0.5">{item.memo}</div>}
                                    {item.discount > 0 && <div className="text-xs text-red-500 mt-0.5">Disc: -{parseFloat(item.discount).toFixed(2)}</div>}
                                </td>
                                <td className="text-center py-3 px-2 text-sm text-gray-800 font-medium">{item.qty} {item.unit}</td>
                                <td className="text-right py-3 px-2 text-sm text-gray-800">RM {parseFloat(item.price).toFixed(2)}</td>
                                <td className="text-right py-3 px-2 text-sm font-bold text-gray-800">RM {((item.qty * item.price) - (item.discount || 0)).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Items List (Mobile Only) */}
            <div className="md:hidden print:hidden space-y-4 mb-8">
                {items.map((item, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="font-bold text-gray-900">{getProductName(parseInt(item.productId))}</div>
                                {item.memo && <div className="text-xs text-gray-500 italic">{item.memo}</div>}
                            </div>
                            <div className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded border">
                                #{index + 1}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                            <div>
                                <span className="text-gray-500 text-xs block">Quantity</span>
                                <span className="font-medium">{item.qty} {item.unit}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-gray-500 text-xs block">Unit Price</span>
                                <span className="font-medium">RM {parseFloat(item.price).toFixed(2)}</span>
                            </div>
                        </div>

                        {item.discount > 0 && (
                            <div className="flex justify-between text-xs text-red-500 mb-2">
                                <span>Discount</span>
                                <span>- RM {parseFloat(item.discount).toFixed(2)}</span>
                            </div>
                        )}

                        <div className="flex justify-between items-center border-t border-gray-200 pt-2">
                            <span className="font-bold text-gray-600">Total</span>
                            <span className="font-bold text-gray-900 text-lg">
                                RM {((item.qty * item.price) - (item.discount || 0)).toFixed(2)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Totals Section */}
            <div className="flex justify-end mb-12">
                <div className="w-80">
                    <div className="flex justify-between items-center mb-2 px-2">
                        <span className="text-sm font-bold text-gray-600">Subtotal</span>
                        <span className="text-sm font-bold text-gray-800">RM {subtotal.toFixed(2)}</span>
                    </div>

                    {/* Discount Bar */}
                    <div className="flex justify-between items-center bg-green-700 text-white px-3 py-1.5 rounded-sm mb-1">
                        <span className="text-sm font-medium">Discount</span>
                        <span className="text-sm font-bold">- RM {totalDiscount.toFixed(2)}</span>
                    </div>

                    {/* Previous Balance Bar */}
                    <div className="flex justify-between items-center bg-green-700 text-white px-3 py-1.5 rounded-sm mb-2">
                        <span className="text-sm font-medium">Previous Balance {prevBalanceMemo && `(${prevBalanceMemo})`}</span>
                        <span className="text-sm font-bold">RM {parseFloat(prevBalance).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center mb-2 px-2">
                        <span className="text-sm font-bold text-gray-600">Paid</span>
                        <span className="text-sm font-bold text-gray-800">- RM {parseFloat(paidAmount || 0).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center border-t-2 border-gray-200 pt-2 px-2">
                        <span className="text-lg font-extrabold text-gray-900">Balance Due</span>
                        <span className="text-lg font-extrabold text-gray-900">RM {balanceDue.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center space-y-1">
                <p className="text-sm text-gray-600 font-medium">Thank you for your business!</p>
                <p className="text-xs text-gray-400 italic">This is a computer-generated document. No signature is required.</p>
            </div>
        </div>
    );
}
