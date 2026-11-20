const DATE_LINE = /^date\s*:?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/i;
const CUSTOMER_LINE = /^[a-z]{3}$/i;
const ITEM_LINE = /^(?:([a-z]{3})\s+)?([a-z]{3})\s+(\d+(?:\.\d+)?)\s*(kg|pcs?)\s+(?:rm\s*)?(\d+(?:\.\d{1,2})?):?$/i;
const BALANCE_LINE = /^bal(?:\s*:\s*|\s+)(?:rm\s*)?(-?\d+(?:\.\d{1,2})?)$/i;

function lookupRecord(code, aliases, records, type) {
    if (!Object.hasOwn(aliases, code)) throw new Error(`Unknown ${type} code ${code}.`);

    const record = records.find(entry => entry.id === aliases[code]);
    if (!record) throw new Error(`${type} ${code} is missing from the catalog.`);
    return record;
}

export function parseBillingDraft(input, customers, products, codes) {
    const lines = input.split(/\r?\n/).map((line, index) => ({
        text: line.trim(),
        number: index + 1
    })).filter(line => line.text);

    const dateMatch = lines[0]?.text.match(DATE_LINE);
    if (!dateMatch) throw new Error('Start with a date in DD/MM/YYYY format, such as Date 21/11/2026.');

    const [, day, month, year] = dateMatch;
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const checkedDate = new Date(`${date}T00:00:00Z`);
    if (Number(year) === 0 || !Number.isFinite(checkedDate.getTime()) ||
        checkedDate.toISOString().slice(0, 10) !== date) {
        throw new Error('Enter a valid bill date.');
    }

    const itemLines = lines.slice(1);
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

    if (!itemLines.length) throw new Error('Enter at least one item below the customer code.');

    const items = itemLines.map(line => {
        try {
            if (/^bal(?:\s|:|$)/i.test(line.text)) throw new Error('Put one balance at the end, for example Bal 2780.');
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
            if (!(qty > 0) || !Number.isFinite(qty * price) || !Number.isFinite(qty)) {
                throw new Error('Enter a positive quantity and a valid unit price.');
            }

            return { productId: product.id, qty, unit: rawUnit.toLowerCase() === 'kg' ? 'Kg' : 'Pcs', price, discount: 0, memo: '' };
        } catch (error) {
            throw new Error(`Line ${line.number}: ${error.message}`);
        }
    });

    return { date, customerId: customer.id, items, prevBalance };
}
