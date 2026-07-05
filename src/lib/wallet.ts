export const DEFAULT_MIN_WITHDRAWAL_AMOUNT = 1000;
export const DEFAULT_COIN_TO_NAIRA_RATE = 1;

export const MIN_WITHDRAWAL_AMOUNT = DEFAULT_MIN_WITHDRAWAL_AMOUNT;

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

export function formatNairaAmount(amount: number) {
    const parsed = Number(amount ?? 0);
    return `₦${parsed.toLocaleString('en-NG', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;
}
