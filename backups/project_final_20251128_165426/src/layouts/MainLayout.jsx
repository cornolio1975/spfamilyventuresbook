import React, { useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Users, Settings, Package } from 'lucide-react';
import clsx from 'clsx';
import { startSync } from '../firebase/sync';

export default function MainLayout() {
    const location = useLocation();

    useEffect(() => {
        // Start syncing with Firebase
        const unsubscribe = startSync();
        return () => {
            unsubscribe.then(unsub => unsub && unsub());
        };
    }, []);

    const navItems = [
        { path: '/', icon: LayoutDashboard, label: 'Sales' },
        { path: '/products', icon: Package, label: 'Products' },
        { path: '/customers', icon: Users, label: 'Customers' },
        { path: '/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <div className="flex flex-col h-screen bg-gray-50 print:h-auto print:block">
            <main className="flex-1 overflow-y-auto pb-20 print:pb-0 print:h-auto print:overflow-visible">
                <Outlet />
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 flex justify-around items-center z-50 no-print">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={clsx(
                                'flex flex-col items-center p-2 rounded-lg transition-colors',
                                isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
                            )}
                        >
                            <Icon size={24} />
                            <span className="text-xs mt-1 font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
