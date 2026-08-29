import type { CurrencyCode, CurrencyInfo } from "@/types/invoice";

// All arithmetic on monetary values is done in integer "minor units" (e.g. paise/cents)
// to avoid floating-point drift like 0.1 + 0.2 = 0.30000000000000004.
// Inputs/outputs at the UI boundary are plain numbers (major units) with a fixed
// number of decimals per currency.

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee", decimals: 2 },
  USD: { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
  EUR: { code: "EUR", symbol: "€", name: "Euro", decimals: 2 },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", decimals: 2 },
  AED: { code: "AED", symbol: "د.إ", name: "UAE Dirham", decimals: 2 },
  CAD: { code: "CAD", symbol: "$", name: "Canadian Dollar", decimals: 2 },
  AUD: { code: "AUD", symbol: "$", name: "Australian Dollar", decimals: 2 },
  SGD: { code: "SGD", symbol: "$", name: "Singapore Dollar", decimals: 2 },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0 },
};

export const CURRENCY_LIST = Object.values(CURRENCIES);

/** Convert a major-unit amount (e.g. 59.999) into integer minor units, rounded half-up. */
export function toMinorUnits(amount: number, currency: CurrencyCode): number {
  if (!Number.isFinite(amount)) return 0;
  const factor = 10 ** CURRENCIES[currency].decimals;
  return Math.round((amount + Number.EPSILON) * factor);
}

/** Convert integer minor units back into a major-unit number. */
export function fromMinorUnits(minor: number, currency: CurrencyCode): number {
  const factor = 10 ** CURRENCIES[currency].decimals;
  return minor / factor;
}

/** Round a major-unit amount to the currency's precision using safe minor-unit rounding. */
export function roundMoney(amount: number, currency: CurrencyCode): number {
  return fromMinorUnits(toMinorUnits(amount, currency), currency);
}

/** Multiply a major-unit amount by a plain multiplier (e.g. quantity), safely rounded. */
export function multiplyMoney(amount: number, multiplier: number, currency: CurrencyCode): number {
  const minor = toMinorUnits(amount, currency);
  return fromMinorUnits(Math.round(minor * multiplier), currency);
}

/** Apply a percentage to a major-unit amount, safely rounded. */
export function percentOf(amount: number, percent: number, currency: CurrencyCode): number {
  const minor = toMinorUnits(amount, currency);
  return fromMinorUnits(Math.round((minor * percent) / 100), currency);
}

/** Sum an array of major-unit amounts using minor-unit precision to avoid drift. */
export function sumMoney(amounts: number[], currency: CurrencyCode): number {
  const totalMinor = amounts.reduce((acc, a) => acc + toMinorUnits(a, currency), 0);
  return fromMinorUnits(totalMinor, currency);
}

export function formatMoney(amount: number, currency: CurrencyCode, opts?: { withSymbol?: boolean }): string {
  const info = CURRENCIES[currency];
  const withSymbol = opts?.withSymbol ?? true;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals,
  }).format(roundMoney(amount, currency));
  return withSymbol ? `${info.symbol}${formatted}` : formatted;
}
