export const DEFAULT_MIN_WITHDRAWAL_AMOUNT = 1000;

export const MIN_WITHDRAWAL_AMOUNT = DEFAULT_MIN_WITHDRAWAL_AMOUNT;

export function normalizeMinWithdrawalAmount(value?: number | null) {
	const parsed = Number(value ?? 0);
	if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MIN_WITHDRAWAL_AMOUNT;
	return parsed;
}
