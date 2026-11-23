import { saleSubtotalCents } from '../utils/salesTrends';
import { formatRinggit } from '../utils/formatRinggit';
import React, { useEffect, useState } from 'react';
import { vendorBalancesCents } from '../utils/vendorBalances';
import { formatDate, formatDateShort } from '../utils/dateUtils';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, useSettings } from '../db/hooks';
import { seedDatabase } from '../utils/seedData';
import {
    PlusCircle,
    Users,
    Package,
    TrendingUp,
    DollarSign,
    Calendar,
    ArrowRight,
    Database,
    Receipt,
    Sparkles,
    Send,
    Store
} from 'lucide-react';
import logo from '../assets/logo.jpg';
import poultryLogo from '../assets/poultry_logo.jpg';

const dashboardLinks = [
    { to: '/vendor-bills', label: 'Vendor Bills', icon: Receipt },
    { to: '/reports', label: 'Reports', icon: TrendingUp },
    { to: '/sales/send', label: 'Send Invoices', icon: Send },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/products', label: 'Products', icon: Package },
    { to: '/vendors', label: 'Vendors', icon: Store },
];

export default function Landing() {
    const settings = useSettings();
    const [stats, setStats] = useState({
        todaySales: 0,
        todayBills: 0,
        netProfit: 0,
        totalRevenue: 0,
        monthlySales: 0,
        monthlyNetProfit: 0,
        yearlyNetProfit: 0,
        customerCount: 0,
        productCount: 0,
        todayCollections: 0,
        todayInvoices: 0,
        totalOutstanding: 0
    });
    const [recentSales, setRecentSales] = useState([]);
    const [isSeeding, setIsSeeding] = useState(false);

    const customers = useLiveQuery(() => db.customers.toArray());
    const products = useLiveQuery(() => db.products.toArray());
    const sales = useLiveQuery(() => db.sales.toArray());
    const vendorBills = useLiveQuery(() => db.vendor_purchases.toArray());
    const vendorPayments = useLiveQuery(() => db.vendor_payments.toArray());
    const totalBillsOutstanding = vendorBills && vendorPayments
        ? [...vendorBalancesCents(vendorBills, vendorPayments, formatDateShort(new Date())).values()]
            .reduce((sum, cents) => sum + Math.max(0, cents), 0) / 100
        : null;
    const payments = useLiveQuery(() => db.payments.toArray());

    useEffect(() => {
        if (sales && customers && products && vendorBills && payments) {
            const today = formatDateShort(new Date());

            // 1. Calculate Today's Sales
            const todaySalesTotal = sales
                .filter(s => s.date === today)
                .reduce((sum, s) => sum + (parseFloat(s.subtotal) || 0), 0);

            // 2. Calculate Today's Vendor Bills
            const todayBillsTotal = vendorBills
                .filter(bill => bill.date === today)
                .reduce((sum, bill) => sum + (parseFloat(bill.total) || 0), 0);

            const todayCollectionsTotal = payments
                .filter(p => p.date === today)
                .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

            const todayInvoicesCount = sales.filter(s => s.date === today).length;

            let totalOutstandingTotal = 0;
            const totalSalesAmount = sales.reduce((sum, s) => {
                let saleAmount = s.subtotal;
                if (saleAmount === undefined || saleAmount === null) {
                    saleAmount = (parseFloat(s.grandTotal) || 0) - (parseFloat(s.prevBalance) || 0);
                }
                return sum + (parseFloat(saleAmount) || 0);
            }, 0);
            const totalPaymentsAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
            
            const initialBalancesAmount = customers.reduce((sum, c) => {
                const customerSales = sales.filter(s => String(s.customerId) === String(c.id));
                const sortedSales = [...customerSales].sort((a, b) => {
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    if (dateA - dateB !== 0) return dateA - dateB;
                    return a.id - b.id;
                });
                const firstSale = sortedSales[0];
                return sum + (firstSale ? (parseFloat(firstSale.prevBalance) || 0) : 0);
            }, 0);

            totalOutstandingTotal = totalSalesAmount + initialBalancesAmount - totalPaymentsAmount;

            // 3. Calculate Net Profit
            const netProfitTotal = todaySalesTotal - todayBillsTotal;

            const currentYear = today.slice(0, 4);
            const currentMonth = today.slice(0, 7);

            const allSalesTotal = sales
                .filter(s => s.date?.slice(0, 4) === currentYear)
                .reduce((sum, s) => sum + saleSubtotalCents(s), 0) / 100;

            const allBillsTotal = vendorBills
                .filter(bill => bill.date?.slice(0, 4) === currentYear)
                .reduce((sum, bill) => sum + (parseFloat(bill.total) || 0), 0);

            const yearlyNetProfitTotal = allSalesTotal - allBillsTotal;

            const monthlySalesTotal = sales
                .filter(s => s.date?.slice(0, 7) === currentMonth)
                .reduce((sum, s) => sum + saleSubtotalCents(s), 0) / 100;

            const monthlyBillsTotal = vendorBills
                .filter(bill => bill.date?.slice(0, 7) === currentMonth)
                .reduce((sum, bill) => sum + (parseFloat(bill.total) || 0), 0);

            const monthlyNetProfitTotal = monthlySalesTotal - monthlyBillsTotal;

            setStats({
                todaySales: todaySalesTotal,
                todayBills: todayBillsTotal,
                netProfit: netProfitTotal,
                totalRevenue: allSalesTotal,
                monthlySales: monthlySalesTotal,
                monthlyNetProfit: monthlyNetProfitTotal,
                yearlyNetProfit: yearlyNetProfitTotal,
                customerCount: customers.length,
                productCount: products.length,
                todayCollections: todayCollectionsTotal,
                todayInvoices: todayInvoicesCount,
                totalOutstanding: totalOutstandingTotal
            });

            // Get 5 most recent sales
            const sortedSales = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
            setRecentSales(sortedSales);
        }
    }, [sales, customers, products, vendorBills, payments]);

    const handleSeedData = async () => {
        if (confirm('This will populate the database with sample data. Continue?')) {
            setIsSeeding(true);
            const result = await seedDatabase();
            alert(result.message);
            setIsSeeding(false);
        }
    };

    const getCustomerName = (id) => customers?.find(c => c.id === id)?.name || 'Unknown';

    return (
        <div className="min-h-full bg-slate-50 pb-6">
            <header className="bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 text-white">
                <div className="mx-auto max-w-5xl px-4 pb-14 pt-5 sm:px-6 sm:pt-7">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <img src={logo} alt="" className="size-11 shrink-0 rounded-xl bg-white object-contain p-1 sm:size-14" />
                        <div className="min-w-0 flex-1">
                            <h1 className="text-lg font-bold leading-tight tracking-tight sm:text-2xl">{settings.companyName || 'SP Family Ventures'}</h1>
                            <p className="mt-1 text-xs text-blue-200 sm:text-sm">{formatDate(new Date())}</p>
                        </div>
                        <img src={poultryLogo} alt="" className="hidden size-14 rounded-xl bg-white object-contain p-1 md:block" />
                    </div>
                </div>
            </header>

            <nav aria-label="Dashboard shortcuts" className="relative mx-auto -mt-9 max-w-5xl px-4 sm:px-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                        <Link
                            to="/sales/new"
                            className="col-span-2 flex min-h-16 items-center gap-2.5 rounded-xl bg-blue-700 px-3 py-2.5 text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 md:col-span-1"
                        >
                            <PlusCircle size={22} className="shrink-0" aria-hidden="true" />
                            <span className="font-semibold">New Sale</span>
                            <ArrowRight size={18} className="ml-auto shrink-0" aria-hidden="true" />
                        </Link>
                        <Link
                            to="/sales"
                            className="flex min-h-16 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-sm font-semibold leading-tight text-slate-900 transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:px-3 sm:text-base"
                        >
                            <Receipt size={19} className="shrink-0 text-blue-700" aria-hidden="true" />
                            Recent Sales
                        </Link>
                        <Link
                            to="/sales/new?assistant=1"
                            className="flex min-h-16 items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-2.5 py-2.5 text-sm font-semibold leading-tight text-teal-950 transition-colors hover:bg-teal-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:px-3 sm:text-base"
                        >
                            <Sparkles size={19} className="shrink-0 text-teal-700" aria-hidden="true" />
                            Billing Assistant
                        </Link>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-slate-100 pt-2 sm:grid-cols-3 lg:grid-cols-6">
                        {dashboardLinks.map(({ to, label, icon }) => (
                            <Link
                                key={to}
                                to={to}
                                className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium leading-tight text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-blue-700"
                            >
                                {React.createElement(icon, { size: 16, className: 'shrink-0 text-slate-500', 'aria-hidden': true })}
                                {label}
                            </Link>
                        ))}
                    </div>
                </div>
            </nav>

            <section aria-labelledby="dashboard-overview" className="mx-auto mt-5 max-w-5xl px-4 sm:px-6">
                <div className="rounded-2xl bg-slate-900 p-3 text-white sm:p-5">
                    <h2 id="dashboard-overview" className="mb-3 px-1 text-base font-semibold">Business Overview</h2>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
                        {/* Box 1: Today's Sales */}
                        <div className="bg-white/10 rounded-xl p-2.5 sm:p-4 border border-white/20">
                            <div className="mb-2 flex items-center gap-1.5 sm:gap-2">
                                <div className="p-1.5 bg-green-400/20 rounded-lg">
                                    <DollarSign size={15} className="text-green-300" />
                                </div>
                                <span className="text-blue-100 text-xs font-medium sm:text-sm">Today's Sales</span>
                            </div>
                            <p className="text-base font-bold tabular-nums wrap-anywhere sm:text-xl">{formatRinggit(stats.todaySales)}</p>
                        </div>

                        {/* Box 2: Today's Collections */}
                        <div className="bg-white/10 rounded-xl p-2.5 sm:p-4 border border-white/20">
                            <div className="mb-2 flex items-center gap-1.5 sm:gap-2">
                                <div className="p-1.5 bg-blue-400/20 rounded-lg">
                                    <DollarSign size={15} className="text-blue-300" />
                                </div>
                                <span className="text-blue-100 text-xs font-medium sm:text-sm">Today's Collections</span>
                            </div>
                            <p className="text-base font-bold tabular-nums wrap-anywhere sm:text-xl text-white">{formatRinggit(stats.todayCollections)}</p>
                        </div>

                        {/* Box 3: Daily Net Profit */}
                        <div className="bg-white/10 rounded-xl p-2.5 sm:p-4 border border-white/20">
                            <div className="mb-2 flex items-center gap-1.5 sm:gap-2">
                                <div className="p-1.5 bg-green-400/20 rounded-lg">
                                    <TrendingUp size={15} className="text-green-300" />
                                </div>
                                <span className="text-blue-100 text-xs font-medium sm:text-sm">Daily Net Profit</span>
                            </div>
                            <p className={`text-base font-bold tabular-nums wrap-anywhere sm:text-xl ${stats.netProfit >= 0 ? 'text-white' : 'text-red-300'}`}>
                                {formatRinggit(stats.netProfit)}
                            </p>
                        </div>
                        
                        {/* Box 4: Total Outstanding Balance */}
                        <div className="bg-white/10 rounded-xl p-2.5 sm:p-4 border border-white/20">
                            <div className="mb-2 flex items-center gap-1.5 sm:gap-2">
                                <div className="p-1.5 bg-red-400/20 rounded-lg">
                                    <Receipt size={15} className="text-red-300" />
                                </div>
                                <span className="text-blue-100 text-xs font-medium sm:text-sm">Total Outstanding</span>
                            </div>
                            <p className={`text-base font-bold tabular-nums wrap-anywhere sm:text-xl ${stats.totalOutstanding > 0 ? 'text-red-300' : 'text-white'}`}>
                                {formatRinggit(stats.totalOutstanding)}
                            </p>
                        </div>

                        <Link to="/vendor-bills" className="block rounded-xl border border-white/20 bg-white/10 p-2.5 sm:p-4 hover:bg-white/20">
                            <div className="mb-2 flex items-center gap-1.5 sm:gap-2">
                                <div className="rounded-lg bg-amber-400/20 p-1.5">
                                    <Receipt size={15} className="text-amber-200" />
                                </div>
                                <span className="text-xs font-medium sm:text-sm text-blue-100">Total Bills Outstanding</span>
                            </div>
                            <p className="text-base font-bold tabular-nums wrap-anywhere sm:text-xl text-amber-200">
                                {totalBillsOutstanding === null ? 'Loading…' : formatRinggit(totalBillsOutstanding)}
                            </p>
                        </Link>

                        {/* Box 5: Monthly Sales */}
                        <Link to="/reports?tab=monthly-sales" className="block rounded-xl border border-white/20 bg-white/10 p-2.5 sm:p-4 hover:bg-white/20">
                            <div className="mb-2 flex items-center gap-1.5 sm:gap-2">
                                <div className="p-1.5 bg-blue-400/20 rounded-lg">
                                    <TrendingUp size={15} className="text-blue-300" />
                                </div>
                                <span className="text-blue-100 text-xs font-medium sm:text-sm">Monthly Sales</span>
                            </div>
                            <p className="text-base font-bold tabular-nums wrap-anywhere sm:text-xl">{formatRinggit(stats.monthlySales)}</p>
                        </Link>
                        
                        {/* Box 6: Monthly Net Profit */}
                        <div className="bg-white/10 rounded-xl p-2.5 sm:p-4 border border-white/20">
                            <div className="mb-2 flex items-center gap-1.5 sm:gap-2">
                                <div className="p-1.5 bg-green-400/20 rounded-lg">
                                    <TrendingUp size={15} className="text-green-300" />
                                </div>
                                <span className="text-blue-100 text-xs font-medium sm:text-sm">Monthly Net Profit</span>
                            </div>
                            <p className={`text-base font-bold tabular-nums wrap-anywhere sm:text-xl ${stats.monthlyNetProfit >= 0 ? 'text-white' : 'text-red-300'}`}>
                                {formatRinggit(stats.monthlyNetProfit)}
                            </p>
                        </div>

                        {/* Box 7: Yearly Sales / Revenue */}
                        <Link to="/reports?tab=yearly-sales" className="block rounded-xl border border-white/20 bg-white/10 p-2.5 sm:p-4 hover:bg-white/20">
                            <div className="mb-2 flex items-center gap-1.5 sm:gap-2">
                                <div className="p-1.5 bg-blue-400/20 rounded-lg">
                                    <TrendingUp size={15} className="text-blue-300" />
                                </div>
                                <span className="text-blue-100 text-xs font-medium sm:text-sm">Yearly Sales</span>
                            </div>
                            <p className="text-base font-bold tabular-nums wrap-anywhere sm:text-xl">{formatRinggit(stats.totalRevenue)}</p>
                        </Link>

                        {/* Box 8: Yearly Net Profit */}
                        <div className="bg-white/10 rounded-xl p-2.5 sm:p-4 border border-white/20">
                            <div className="mb-2 flex items-center gap-1.5 sm:gap-2">
                                <div className="p-1.5 bg-green-400/20 rounded-lg">
                                    <TrendingUp size={15} className="text-green-300" />
                                </div>
                                <span className="text-blue-100 text-xs font-medium sm:text-sm">Yearly Net Profit</span>
                            </div>
                            <p className={`text-base font-bold tabular-nums wrap-anywhere sm:text-xl ${stats.yearlyNetProfit >= 0 ? 'text-white' : 'text-red-300'}`}>
                                {formatRinggit(stats.yearlyNetProfit)}
                            </p>
                        </div>

                        {/* Box 9: Today's Vendor Bills */}
                        <div className="bg-white/10 rounded-xl p-2.5 sm:p-4 border border-white/20">
                            <div className="mb-2 flex items-center gap-1.5 sm:gap-2">
                                <div className="p-1.5 bg-orange-400/20 rounded-lg">
                                    <Receipt size={15} className="text-orange-300" />
                                </div>
                                <span className="text-blue-100 text-xs font-medium sm:text-sm">Today's Bills</span>
                            </div>
                            <p className="text-base font-bold tabular-nums wrap-anywhere sm:text-xl text-orange-200">{formatRinggit(stats.todayBills)}</p>
                        </div>

                        {/* Box 10: Today's Invoices (count) */}
                        <div className="bg-white/10 rounded-xl p-2.5 sm:p-4 border border-white/20">
                            <div className="mb-2 flex items-center gap-1.5 sm:gap-2">
                                <div className="p-1.5 bg-indigo-400/20 rounded-lg">
                                    <Calendar size={15} className="text-indigo-300" />
                                </div>
                                <span className="text-blue-100 text-xs font-medium sm:text-sm">Today's Invoices</span>
                            </div>
                            <p className="text-base font-bold tabular-nums wrap-anywhere sm:text-xl">{stats.todayInvoices}</p>
                        </div>

                        {/* Box 11: Customers */}
                        <div className="bg-white/10 rounded-xl p-2.5 sm:p-4 border border-white/20">
                            <div className="mb-2 flex items-center gap-1.5 sm:gap-2">
                                <div className="p-1.5 bg-purple-400/20 rounded-lg">
                                    <Users size={15} className="text-purple-300" />
                                </div>
                                <span className="text-blue-100 text-xs font-medium sm:text-sm">Customers</span>
                            </div>
                            <p className="text-base font-bold tabular-nums wrap-anywhere sm:text-xl">{stats.customerCount}</p>
                        </div>

                        {/* Box 12: Products */}
                        <div className="bg-white/10 rounded-xl p-2.5 sm:p-4 border border-white/20">
                            <div className="mb-2 flex items-center gap-1.5 sm:gap-2">
                                <div className="p-1.5 bg-amber-400/20 rounded-lg">
                                    <Package size={15} className="text-amber-300" />
                                </div>
                                <span className="text-blue-100 text-xs font-medium sm:text-sm">Products</span>
                            </div>
                            <p className="text-base font-bold tabular-nums wrap-anywhere sm:text-xl">{stats.productCount}</p>
                        </div>

                    </div>

                </div>
            </section>

            <div className="mx-auto mt-5 max-w-5xl px-4 sm:px-6">
                {/* Recent Activity & Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Recent Sales List */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-800">Recent Sales</h2>
                            <Link to="/sales" className="flex min-h-11 items-center gap-1 text-sm font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-700">
                                View All <ArrowRight size={16} aria-hidden="true" />
                            </Link>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {recentSales.length > 0 ? (
                                recentSales.map(sale => (
                                    <div key={sale.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                                                <Calendar size={18} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-800">{getCustomerName(sale.customerId)}</p>
                                                <p className="text-xs text-gray-500">
                                                    {formatDateShort(new Date(sale.date))}
                                                    {sale.memo && <span className="ml-2 italic text-gray-400">- {sale.memo}</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gray-800">{formatRinggit(sale.grandTotal || 0)}</p>
                                            <p className="text-xs text-gray-500">Inv #{sale.id}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-gray-500">
                                    No sales found. Start by creating a new sale!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar Actions */}
                    <div className="space-y-6">
                        {/* Empty State / Demo Data Action */}
                        {(stats.customerCount === 0 && stats.productCount === 0) && (
                            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-blue-100">
                                <h3 className="font-bold text-indigo-900 mb-2">New here?</h3>
                                <p className="text-sm text-indigo-700 mb-4">
                                    Populate your database with sample data to see how the app looks and feels.
                                </p>
                                <button
                                    onClick={handleSeedData}
                                    disabled={isSeeding}
                                    className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Database size={18} />
                                    {isSeeding ? 'Seeding...' : 'Load Sample Data'}
                                </button>
                            </div>
                        )}

                        <Link to="/settings" className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-700">
                            Company Settings <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
