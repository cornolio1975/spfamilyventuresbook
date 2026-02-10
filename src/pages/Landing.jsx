import React, { useEffect, useState } from 'react';
import { formatDate, formatDateShort } from '../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
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
    Receipt
} from 'lucide-react';
import logo from '../assets/logo.jpg';
import poultryLogo from '../assets/poultry_logo.jpg';

export default function Landing() {
    const navigate = useNavigate();
    const settings = useSettings();
    const [stats, setStats] = useState({
        todaySales: 0,
        todayBills: 0,
        netProfit: 0,
        totalRevenue: 0,
        monthlySales: 0,
        customerCount: 0,
        productCount: 0
    });
    const [recentSales, setRecentSales] = useState([]);
    const [isSeeding, setIsSeeding] = useState(false);

    const customers = useLiveQuery(() => db.customers.toArray());
    const products = useLiveQuery(() => db.products.toArray());
    const sales = useLiveQuery(() => db.sales.toArray());
    const vendorBills = useLiveQuery(() => db.vendor_purchases.toArray());

    useEffect(() => {
        if (sales && customers && products && vendorBills) {
            const today = formatDateShort(new Date());

            // 1. Calculate Today's Sales
            const todaySalesTotal = sales
                .filter(s => s.date === today)
                .reduce((sum, s) => sum + (parseFloat(s.subtotal) || 0), 0);

            // 2. Calculate Today's Vendor Bills
            const todayBillsTotal = vendorBills
                .filter(bill => bill.date === today)
                .reduce((sum, bill) => sum + (parseFloat(bill.total) || 0), 0);

            // 3. Calculate Net Profit
            const netProfitTotal = todaySalesTotal - todayBillsTotal;

            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth();

            const allSalesTotal = sales
                .filter(s => new Date(s.date).getFullYear() === currentYear)
                .reduce((sum, s) => sum + (parseFloat(s.subtotal) || 0), 0);

            const monthlySalesTotal = sales
                .filter(s => {
                    const saleDate = new Date(s.date);
                    return saleDate.getFullYear() === currentYear && saleDate.getMonth() === currentMonth;
                })
                .reduce((sum, s) => sum + (parseFloat(s.subtotal) || 0), 0);

            setStats({
                todaySales: todaySalesTotal,
                todayBills: todayBillsTotal,
                netProfit: netProfitTotal,
                totalRevenue: allSalesTotal,
                monthlySales: monthlySalesTotal,
                customerCount: customers.length,
                productCount: products.length
            });

            // Get 5 most recent sales
            const sortedSales = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
            setRecentSales(sortedSales);
        }
    }, [sales, customers, products, vendorBills]);

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
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-8 pb-32">
                <div className="max-w-5xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-5">
                            <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl p-2 border border-white/20 shadow-xl flex items-center justify-center">
                                <img src={logo} alt="Logo" className="w-full h-full object-contain drop-shadow-md" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm">{settings.companyName || 'Welcome Back!'}</h1>
                                <p className="text-blue-100 mt-1 font-medium opacity-90">Dashboard Overview</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl p-2 border border-white/20 shadow-xl flex items-center justify-center hidden md:flex">
                                <img src={poultryLogo} alt="Poultry Logo" className="w-full h-full object-contain drop-shadow-md" />
                            </div>
                            <div className="text-right hidden md:block">
                                <p className="text-2xl font-bold">{formatDate(new Date())}</p>
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-green-400/20 rounded-lg">
                                    <DollarSign size={20} className="text-green-300" />
                                </div>
                                <span className="text-blue-100 text-sm font-medium">Today's Sales</span>
                            </div>
                            <p className="text-2xl font-bold">RM {stats.todaySales.toFixed(2)}</p>
                        </div>

                        {/* Today's Vendor Bills - Red/Orange for expense */}
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-orange-400/20 rounded-lg">
                                    <Receipt size={20} className="text-orange-300" />
                                </div>
                                <span className="text-blue-100 text-sm font-medium">Today's Vendor Bills</span>
                            </div>
                            <p className="text-2xl font-bold">RM {stats.todayBills.toFixed(2)}</p>
                        </div>

                        {/* Daily Net Profit - Green for profit */}
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-green-400/20 rounded-lg">
                                    <DollarSign size={20} className="text-green-300" />
                                </div>
                                <span className="text-blue-100 text-sm font-medium">Daily Net Profit</span>
                            </div>
                            <p className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-white' : 'text-red-300'}`}>
                                RM {stats.netProfit.toFixed(2)}
                            </p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-400/20 rounded-lg">
                                    <TrendingUp size={20} className="text-blue-300" />
                                </div>
                                <span className="text-blue-100 text-sm font-medium">Monthly Sales</span>
                            </div>
                            <p className="text-2xl font-bold">RM {stats.monthlySales.toFixed(2)}</p>
                        </div>


                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-400/20 rounded-lg">
                                    <TrendingUp size={20} className="text-blue-300" />
                                </div>
                                <span className="text-blue-100 text-sm font-medium">Total Revenue</span>
                            </div>
                            <p className="text-2xl font-bold">RM {stats.totalRevenue.toFixed(2)}</p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-purple-400/20 rounded-lg">
                                    <Users size={20} className="text-purple-300" />
                                </div>
                                <span className="text-blue-100 text-sm font-medium">Customers</span>
                            </div>
                            <p className="text-2xl font-bold">{stats.customerCount}</p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-orange-400/20 rounded-lg">
                                    <Package size={20} className="text-orange-300" />
                                </div>
                                <span className="text-blue-100 text-sm font-medium">Products</span>
                            </div>
                            <p className="text-2xl font-bold">{stats.productCount}</p>
                        </div>

                    </div>

                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-5xl mx-auto px-4 -mt-24">
                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <button
                        onClick={() => navigate('/sales/new')}
                        className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex flex-col items-center text-center group"
                    >
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                            <PlusCircle size={32} className="text-blue-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">New Sale</h3>
                        <p className="text-sm text-gray-500 mt-2">Create a new invoice for a customer</p>
                    </button>

                    <button
                        onClick={() => navigate('/customers')}
                        className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex flex-col items-center text-center group"
                    >
                        <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
                            <Users size={32} className="text-purple-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Manage Customers</h3>
                        <p className="text-sm text-gray-500 mt-2">Add or edit customer details</p>
                    </button>

                    <button
                        onClick={() => navigate('/products')}
                        className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex flex-col items-center text-center group"
                    >
                        <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-orange-100 transition-colors">
                            <Package size={32} className="text-orange-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Inventory</h3>
                        <p className="text-sm text-gray-500 mt-2">Manage products and pricing</p>
                    </button>
                </div>

                {/* Recent Activity & Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Recent Sales List */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-800">Recent Sales</h2>
                            <button onClick={() => navigate('/sales')} className="text-blue-600 text-sm font-medium hover:underline flex items-center gap-1">
                                View All <ArrowRight size={16} />
                            </button>
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
                                            <p className="font-bold text-gray-800">RM {(sale.grandTotal || 0).toFixed(2)}</p>
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

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="font-bold text-gray-800 mb-4">Quick Links</h3>
                            <div className="space-y-3">
                                <button onClick={() => navigate('/settings')} className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50 text-gray-600 font-medium text-sm transition-colors">
                                    Company Settings
                                </button>
                                <button onClick={() => navigate('/sales')} className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50 text-gray-600 font-medium text-sm transition-colors">
                                    Sales History
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
