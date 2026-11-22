const ringgitNumber = new Intl.NumberFormat('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
});

export function formatRinggit(amount) {
    return `RM ${ringgitNumber.format(amount)}`;
}
