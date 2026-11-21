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
        <div className="bg-white p-3 md:p-8 max-w-4xl mx-auto print:p-0 print:w-full print:max-w-none font-sans">
            {/* Header */}
            <div className="flex justify-between gap-2 items-center md:items-start print:items-start mb-3 md:mb-8 border-b-2 border-gray-100 pb-2 md:pb-6 gap-2 md:gap-4">
                {/* Left Logo */}
                <div className="size-11 md:size-40 print:size-40 flex-shrink-0">
                    <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                </div>

                {/* Center Details */}
                <div className="text-center flex-1 min-w-0 md:px-4 print:px-4">
                    <h1 className="text-sm md:text-xl print:text-xl font-extrabold uppercase tracking-wide text-gray-900">{settings.companyName}</h1>
                    <p className="text-sm font-bold text-gray-600">{settings.regNum}</p>
                    <p className="text-xs mt-1 text-gray-500 font-medium">{settings.desc1}</p>
                    <p className="text-xs text-gray-500 font-medium">{settings.desc2}</p>
                    <p className="text-xs md:text-sm print:text-sm font-bold mt-1 md:mt-2 text-gray-800">{settings.contact}</p>
                </div>

                {/* Right Logo */}
                <div className="size-11 md:size-40 print:size-40 flex-shrink-0 hidden md:block print:block">
                    <img src={poultryLogo} alt="Poultry" className="w-full h-full object-contain" />
                </div>
            </div>

            {/* Bill To & Invoice Details */}
            <div className="grid grid-cols-2 items-start md:items-end mb-3 md:mb-8 gap-2 md:gap-6">
                <div className="w-full md:w-auto">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Billed To</p>
                    <h2 className="text-sm md:text-lg print:text-lg font-bold text-gray-900">{customer.name}</h2>
                    <p className="text-sm text-gray-600 max-w-[250px]">{customer.address}</p>
                    <p className="text-sm text-gray-600">{customer.contact}</p>
                </div>
                <div className="text-right min-w-0">
                    <h1 className="text-sm md:text-2xl print:text-2xl font-bold text-gray-600 uppercase mb-1">Delivery Order / Invoice</h1>
                    <p className="text-sm font-bold text-gray-600">#INV-{displayId}</p>
                    <p className="text-sm font-bold text-gray-600">Date: {formatDateShort(new Date(saleDate))}</p>
                </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full mb-3 md:mb-8 border-collapse text-xs md:text-sm print:text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-center py-1 px-1 md:py-3 md:px-2 print:py-3 print:px-2 font-bold text-gray-600 md:w-12">#</th>
                            <th className="text-left py-1 px-1 md:py-3 md:px-2 print:py-3 print:px-2 font-bold text-gray-600">Item</th>
                            <th className="text-center py-1 px-1 md:py-3 md:px-2 print:py-3 print:px-2 font-bold text-gray-600">Qty</th>
                            <th className="text-right py-1 px-1 md:py-3 md:px-2 print:py-3 print:px-2 font-bold text-gray-600">Unit Price</th>
                            <th className="text-right py-1 px-1 md:py-3 md:px-2 print:py-3 print:px-2 font-bold text-gray-600">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={index} className="border-b border-gray-50">
                                <td className="text-center py-1 px-1 md:py-3 md:px-2 print:py-3 print:px-2 text-gray-600">{index + 1}</td>
                                <td className="py-1 px-1 md:py-3 md:px-2 print:py-3 print:px-2">
                                    <div className="font-bold text-gray-800">{getProductName(parseInt(item.productId))}</div>
                                    {item.memo && <div className="text-xs text-gray-500 italic mt-0.5">{item.memo}</div>}
                                    {item.discount > 0 && <div className="text-xs text-red-500 mt-0.5">Disc: -{parseFloat(item.discount).toFixed(2)}</div>}
                                </td>
                                <td className="text-center py-1 px-1 md:py-3 md:px-2 print:py-3 print:px-2 text-gray-800 font-medium">{item.qty} {item.unit}</td>
                                <td className="text-right py-1 px-1 md:py-3 md:px-2 print:py-3 print:px-2 text-gray-800">RM {parseFloat(item.price).toFixed(2)}</td>
                                <td className="text-right py-1 px-1 md:py-3 md:px-2 print:py-3 print:px-2 font-bold text-gray-800">RM {((item.qty * item.price) - (item.discount || 0)).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totals Section */}
            <div className="flex justify-end mb-3 md:mb-12">
                <div className="w-full max-w-80">
                    <div className="flex justify-between gap-2 items-center mb-2 px-2">
                        <span className="text-sm font-bold text-gray-600">Subtotal</span>
                        <span className="text-sm font-bold text-gray-800">RM {subtotal.toFixed(2)}</span>
                    </div>

                    {/* Discount Bar */}
                    <div className="flex justify-between gap-2 items-center bg-green-700 text-white px-3 py-1.5 rounded-sm mb-1">
                        <span className="text-sm font-medium">Discount</span>
                        <span className="text-sm font-bold">- RM {totalDiscount.toFixed(2)}</span>
                    </div>

                    {/* Previous Balance Bar */}
                    <div className="flex justify-between gap-2 items-center bg-green-700 text-white px-3 py-1.5 rounded-sm mb-2">
                        <span className="text-sm font-medium">Previous Balance {prevBalanceMemo && `(${prevBalanceMemo})`}</span>
                        <span className="text-sm font-bold whitespace-nowrap">RM {parseFloat(prevBalance).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between gap-2 items-center mb-2 px-2">
                        <span className="text-sm font-bold text-gray-600">Paid</span>
                        <span className="text-sm font-bold text-gray-800">- RM {parseFloat(paidAmount || 0).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between gap-2 items-center border-t-2 border-gray-200 pt-2 px-2">
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
