/**
 * Global Currency Formatter localized for Indian Rupee (INR) and other ISO currencies.
 * Uses 'en-IN' locale with standard Indian Rupee notation by default.
 */

export function formatCurrency(
  value: number,
  currencyCode: string = 'INR',
  options: Intl.NumberFormatOptions = {}
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return currencyCode === 'INR' ? '₹0' : `${currencyCode} 0`;
  }

  const normalizedCurrency = (currencyCode || 'INR').toUpperCase();
  const locale = normalizedCurrency === 'INR' ? 'en-IN' : 'en-US';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: options.maximumFractionDigits ?? (Math.abs(value) >= 100 ? 0 : 2),
      minimumFractionDigits: options.minimumFractionDigits ?? 0,
      ...options,
    }).format(value);
  } catch {
    const symbol = getCurrencySymbol(normalizedCurrency);
    return `${symbol}${Math.round(value).toLocaleString(locale)}`;
  }
}

/**
 * Compact Indian Currency Formatter (e.g., ₹80L, ₹1.2Cr, ₹50k)
 * Ideal for chart Y-axes, compact metric pills, and summary badges.
 */
export function formatCompactCurrency(
  value: number,
  currencyCode: string = 'INR'
): string {
  if (value === undefined || value === null || isNaN(value)) return '₹0';
  const normalized = (currencyCode || 'INR').toUpperCase();
  const symbol = getCurrencySymbol(normalized);
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (normalized === 'INR') {
    if (abs >= 10000000) {
      const cr = (abs / 10000000).toFixed(abs % 10000000 === 0 ? 0 : 1);
      return `${sign}${symbol}${cr}Cr`;
    }
    if (abs >= 100000) {
      const lakh = (abs / 100000).toFixed(abs % 100000 === 0 ? 0 : 1);
      return `${sign}${symbol}${lakh}L`;
    }
    if (abs >= 1000) {
      return `${sign}${symbol}${(abs / 1000).toFixed(0)}k`;
    }
    return `${sign}${symbol}${Math.round(abs)}`;
  }

  if (abs >= 1000000) {
    return `${sign}${symbol}${(abs / 1000000).toFixed(1)}M`;
  }
  if (abs >= 1000) {
    return `${sign}${symbol}${(abs / 1000).toFixed(0)}k`;
  }
  return `${sign}${symbol}${Math.round(abs)}`;
}

export function getCurrencySymbol(currencyCode: string = 'INR'): string {
  switch ((currencyCode || 'INR').toUpperCase()) {
    case 'INR':
      return '₹';
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    default:
      return '₹';
  }
}
