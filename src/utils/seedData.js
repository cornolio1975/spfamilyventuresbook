import { db } from '../db/db';
import CUSTOMERS_DATA from '../data/customers.json';
import PRODUCTS_DATA from '../data/products.json';
import logoCompany from '../assets/logo_company.jpg';
import logoPoultry from '../assets/logo_poultry.jpg';

const SAMPLE_CUSTOMERS = CUSTOMERS_DATA;
const SAMPLE_PRODUCTS = PRODUCTS_DATA.map(p => ({ ...p, unit: p.unit || 'Kg' }));

const SAMPLE_SETTINGS = {
    id: 1,
    companyName: 'SP Family Venture EST Enterprise',
    regNum: '(002905563-H)',
    desc1: 'PEMBORONG AYAM HIDUP / AYAM SEGAR (PROSES)',
    desc2: 'AYAM DAGING (BROILER), AYAM KAMPUNG & AYAM TUA (TELOR)',
    contact: 'H/P (012)627-3691 (Mr.SELVA)',
    logoLeft: logoCompany,
    logoRight: logoPoultry,
    invoiceStart: 10000
};

export const seedDatabase = async () => {
    try {
        // Check if data already exists to avoid duplicates
        const customerCount = await db.customers.count();
        const productCount = await db.products.count();

        // Always update settings with defaults when seeding
        await db.settings.put(SAMPLE_SETTINGS);

        if (customerCount > 0 || productCount > 0) {
            console.log('Database already has data. Skipping seed.');
            return { success: false, message: 'Database already contains data. Settings updated.' };
        }

        // Add Customers
        await db.customers.bulkAdd(SAMPLE_CUSTOMERS);

        // Add Products
        await db.products.bulkAdd(SAMPLE_PRODUCTS);

        // Generate some random sales
        const customers = await db.customers.toArray();
        const products = await db.products.toArray();
        const sales = [];

        const today = new Date();

        // Generate sales for the past 7 days
        for (let i = 0; i < 15; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - Math.floor(Math.random() * 7));

            const customer = customers[Math.floor(Math.random() * customers.length)];
            const numItems = Math.floor(Math.random() * 3) + 1;
            const saleItems = [];
            let subtotal = 0;

            for (let j = 0; j < numItems; j++) {
                const product = products[Math.floor(Math.random() * products.length)];
                const qty = Math.floor(Math.random() * 10) + 1;
                const total = qty * product.price;

                saleItems.push({
                    productId: product.id,
                    qty: qty,
                    unit: product.unit,
                    price: product.price
                });
                subtotal += total;
            }

            sales.push({
                date: date.toISOString().split('T')[0],
                customerId: customer.id,
                items: saleItems,
                subtotal: subtotal,
                prevBalance: 0,
                memo: '',
                grandTotal: subtotal
            });
        }

        await db.sales.bulkAdd(sales);

        return { success: true, message: 'Sample data and logos added successfully!' };
    } catch (error) {
        console.error('Error seeding database:', error);
        return { success: false, message: 'Failed to seed data.' };
    }
};

export const clearDatabase = async () => {
    try {
        await db.delete();
        await db.open();
        return { success: true, message: 'Database cleared and reset.' };
    } catch (error) {
        console.error('Error clearing database:', error);
        return { success: false, message: 'Failed to clear database.' };
    }
};
