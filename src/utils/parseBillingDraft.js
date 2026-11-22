import { resolveBillingRecord } from './resolveBillingRecord.js';
import { hasBillableAmount } from './billingItemAmount.js';

const DATE_LINE = /^(?:date\s*:?\s*)?(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/i;
const SEPARATOR_LINE = /^[-–—]{2,}$/;
const CUSTOMER_LINE = /^[a-z]{3}$/i;
const ITEM_LINE = /^(?:([a-z]{3})\s+)?([a-z]{3})\s+(\d+(?:\.\d+)?)\s*(kg|pcs?)\s+(?:rm\s*)?(\d+(?:\.\d{1,2})?):?$/i;
const BALANCE_LINE = /^bal(?:\s*:\s*|\s+)(?:rm\s*)?(-?\d+(?:\.\d{1,2})?)$/i;

function lookupRecord(code, aliases, records, type) {
    if (!Object.hasOwn(aliases, code)) throw new Error(`Unknown ${type} code ${code}.`);

    const record = resolveBillingRecord(aliases[code], records);
    if (!record) throw new Error(`${type} ${code} is missing from the catalog.`);
    return record;
}

export function parsePaymentDraft(input, customers, codes) {
    const [dateLine, ...lines] = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length !== 1 && !(lines.length === 2 && CUSTOMER_LINE.test(lines[0]))) return null;
    const entry = lines.join(' ');
    const match = entry.match(/^([a-z]{3})\s+(bal(?:\s|:).*)$/i);
    if (!match) return null;

    const dateMatch = dateLine.match(DATE_LINE);
    if (!dateMatch) throw new Error('Start with the payment date, for example Date 22/11/2026.');

    const balanceMatch = match[2].match(BALANCE_LINE);
    const balance = balanceMatch ? Number(balanceMatch[1]) : NaN;
    const remainingCents = Math.round(balance * 100);
    if (!Number.isSafeInteger(remainingCents) || balance < 0) {
        throw new Error('Enter a valid remaining balance of RM 0.00 or more.');
    }

    const customer = lookupRecord(match[1].toUpperCase(), codes.customers, customers, 'Customer');
    return { date: parseBillDate(dateMatch, 1, 'payment'), customerId: customer.id, customerName: customer.name, remainingCents };
}

export function parseBillingBatch(input, customers, products, codes) {
    const lines = input.split(/\r?\n/).map((line, index) => ({
        text: line.trim(),
        number: index + 1
    })).filter(line => line.text);

    const dateMatch = lines[0]?.text.match(DATE_LINE);
    if (!dateMatch) throw new Error('Start with a date such as 21/11/26 or Date 21/11/2026.');

    const date = parseBillDate(dateMatch, lines[0].number);

    const blocks = [[]];
    for (const line of lines.slice(1)) {
        if (DATE_LINE.test(line.text)) {
            throw new Error(`Line ${line.number}: Remove this date. Every bill uses the date on the first line.`);
        }

        if (SEPARATOR_LINE.test(line.text)) {
            if (!blocks.at(-1).length) throw new Error(`Line ${line.number}: Add a bill before the divider.`);
            blocks.push([]);
        } else {
            blocks.at(-1).push(line);
        }
    }
    if (!blocks.at(-1).length && blocks.length > 1) {
        throw new Error(`Line ${lines.at(-1).number}: Add a bill after the divider.`);
    }

    return blocks.map(block => parseBill(block, date, customers, products, codes));
}

function parseBillDate(dateMatch, lineNumber, type = 'bill') {
    const [, day, month, rawYear] = dateMatch;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const checkedDate = new Date(`${date}T00:00:00Z`);
    if (Number(year) === 0 || !Number.isFinite(checkedDate.getTime()) ||
        checkedDate.toISOString().slice(0, 10) !== date) {
        throw new Error(`Line ${lineNumber}: Enter a valid ${type} date.`);
    }
    return date;
}

export function parseBillingDraft(input, customers, products, codes) {
    const drafts = parseBillingBatch(input, customers, products, codes);
    if (drafts.length !== 1) throw new Error('Use one customer per bill.');
    return drafts[0];
}

function parseBill(itemLines, date, customers, products, codes) {
    const customerLine = CUSTOMER_LINE.test(itemLines[0]?.text ?? '') ? itemLines.shift() : null;
    let customer;
    if (customerLine) {
        try {
            customer = lookupRecord(customerLine.text.toUpperCase(), codes.customers, customers, 'Customer');
        } catch (error) {
            throw new Error(`Line ${customerLine.number}: ${error.message}`);
        }
    }

    const lastLine = itemLines.at(-1);
    const balanceMatch = lastLine?.text.match(BALANCE_LINE);
    const prevBalance = balanceMatch ? Number(balanceMatch[1]) : 0;
    if (balanceMatch) {
        if (!Number.isFinite(prevBalance)) throw new Error(`Line ${lastLine.number}: Enter a valid previous balance.`);
        itemLines.pop();
    }

    if (!itemLines.length) {
        const line = balanceMatch ? lastLine : customerLine;
        const message = 'Enter at least one item below the customer code.';
        throw new Error(line ? `Line ${line.number}: ${message}` : message);
    }

    const items = itemLines.flatMap(line => {
        try {
            if (/^bal(?:\s|:|$)/i.test(line.text)) throw new Error('Put one balance at the end, for example Bal 0.');
            const match = line.text.match(ITEM_LINE);
            if (!match) throw new Error('Use item code, quantity with unit, and unit price. Example: APP 14kg 8.70.');

            const [, customerCode, productCode, rawQuantity, rawUnit, rawPrice] = match;
            if (customerCode) {
                const currentCustomer = lookupRecord(customerCode.toUpperCase(), codes.customers, customers, 'Customer');
                if (customer && currentCustomer.id !== customer.id) throw new Error('Use one customer per bill.');
                customer = currentCustomer;
            }
            if (!customer || (!customerLine && !customerCode)) throw new Error('Put the customer code on its own line after the date.');

            const product = lookupRecord(productCode.toUpperCase(), codes.products, products, 'Item');
            const qty = Number(rawQuantity);
            const price = Number(rawPrice);
            const amount = qty * price;
            if (!Number.isFinite(amount)) throw new Error('Enter a valid quantity and unit price.');
            if (!hasBillableAmount(amount)) return [];

            return [{ productId: product.id, qty, unit: rawUnit.toLowerCase() === 'kg' ? 'Kg' : 'Pcs', price, discount: 0, memo: '' }];
        } catch (error) {
            throw new Error(`Line ${line.number}: ${error.message}`);
        }
    });

    if (!items.length) {
        throw new Error(`Line ${itemLines[0].number}: Include at least one item with a nonzero amount for this bill.`);
    }

    return { date, customerId: customer.id, items, prevBalance };
}
