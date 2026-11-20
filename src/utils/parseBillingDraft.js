const DATE_LINE = /^date\s*:?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/i;
const ITEM_LINE = /^([a-z]{3})\s+([a-z]{3})\s+(\d+(?:\.\d+)?)\s*(kg|pcs?)\s+(?:rm\s*)?(\d+(?:\.\d{1,2})?):?$/i;

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

    if (lines.length < 2) throw new Error('Enter at least one item below the date.');

    let customer;
    const items = lines.slice(1).map(line => {
        try {
            const match = line.text.match(ITEM_LINE);
            if (!match) throw new Error('Use customer code, item code, quantity with unit, and unit price. Example: MEE APP 14kg 8.70.');

            const [, customerCode, productCode, rawQuantity, rawUnit, rawPrice] = match;
            const currentCustomer = lookupRecord(customerCode.toUpperCase(), codes.customers, customers, 'Customer');
            if (customer && currentCustomer.id !== customer.id) {
                throw new Error('Use the same customer on each line of a bill.');
            }
            customer = currentCustomer;

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

    return { date, customerId: customer.id, items };
}
