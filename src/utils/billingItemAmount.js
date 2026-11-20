export function hasBillableAmount(amount) {
    return Number(amount.toFixed(2)) !== 0;
}
