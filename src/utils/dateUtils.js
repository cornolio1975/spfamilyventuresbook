// src/utils/dateUtils.js

/**
 * Formats a Date object to a string in Malaysian (Asia/Kuala_Lumpur) timezone.
 * Options can be passed to customize the output format.
 */
export function formatDate(date, options = {}) {
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Kuala_Lumpur',
        hour12: false,
        ...options,
    };
    return new Intl.DateTimeFormat('en-MY', defaultOptions).format(date);
}

/**
 * Formats a Date object to a short date string (YYYY-MM-DD) in Malaysian timezone.
 */
export function formatDateShort(date) {
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    const year = tzDate.getFullYear();
    const month = String(tzDate.getMonth() + 1).padStart(2, '0');
    const day = String(tzDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
