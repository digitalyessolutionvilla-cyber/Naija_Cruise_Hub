export const DEFAULT_MIN_WITHDRAWAL_AMOUNT = 1000;
export const DEFAULT_COIN_TO_NAIRA_RATE = 1;

export const MIN_WITHDRAWAL_AMOUNT = DEFAULT_MIN_WITHDRAWAL_AMOUNT;

type CurrencyMeta = {
    code: string;
    locale: string;
    ngnFx: number;
};

const COUNTRY_CURRENCY: Record<string, CurrencyMeta> = {
    Nigeria: { code: 'NGN', locale: 'en-NG', ngnFx: 1 },
    Ghana: { code: 'GHS', locale: 'en-GH', ngnFx: 0.0097 },
    Kenya: { code: 'KES', locale: 'en-KE', ngnFx: 0.086 },
    'South Africa': { code: 'ZAR', locale: 'en-ZA', ngnFx: 0.012 },
    'United States': { code: 'USD', locale: 'en-US', ngnFx: 0.00066 },
    'United Kingdom': { code: 'GBP', locale: 'en-GB', ngnFx: 0.00052 },
    Canada: { code: 'CAD', locale: 'en-CA', ngnFx: 0.0009 },
    India: { code: 'INR', locale: 'en-IN', ngnFx: 0.055 },
};

export function getCurrencyMeta(country?: string | null): CurrencyMeta {
    const normalized = (country ?? 'Nigeria').trim();
    return COUNTRY_CURRENCY[normalized] ?? COUNTRY_CURRENCY.Nigeria;
}

export function getCurrencyCode(country?: string | null) {
    return getCurrencyMeta(country).code;
}

export function normalizeMinWithdrawalAmount(value?: number | null) {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MIN_WITHDRAWAL_AMOUNT;
    return parsed;
}

export function normalizeCoinToNairaRate(value?: number | null) {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_COIN_TO_NAIRA_RATE;
    return parsed;
}

export function toNairaEquivalent(coins: number, rate: number) {
    const parsedCoins = Number(coins ?? 0);
    const parsedRate = normalizeCoinToNairaRate(rate);
    if (!Number.isFinite(parsedCoins) || parsedCoins <= 0) return 0;
    return parsedCoins * parsedRate;
}

export function convertFromNaira(amount: number, country?: string | null) {
    const parsedAmount = Number(amount ?? 0);
    if (!Number.isFinite(parsedAmount)) return 0;
    return parsedAmount * getCurrencyMeta(country).ngnFx;
}

export function toLocalCurrencyEquivalent(coins: number, rate: number, country?: string | null) {
    return convertFromNaira(toNairaEquivalent(coins, rate), country);
}

export function formatCurrencyAmount(amount: number, country?: string | null) {
    const parsed = Number(amount ?? 0);
    const { code, locale } = getCurrencyMeta(country);
    return parsed.toLocaleString(locale, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

export function formatNairaAmount(amount: number) {
    return formatCurrencyAmount(amount, 'Nigeria');
}
