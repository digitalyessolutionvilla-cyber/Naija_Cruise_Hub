import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Wallet, Repeat, ArrowDownToLine } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatNairaAmount, normalizeMinWithdrawalAmount, toNairaEquivalent } from '@/lib/wallet';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { toast } from 'sonner';

const sb = supabase as any;

function isMissingRpc(error: unknown, fn: string) {
    if (!error || typeof error !== 'object') return false;
    const e = error as { code?: string; message?: string; details?: string };
    const haystack = `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase();
    return e.code === 'PGRST202' || haystack.includes(`function public.${fn}`);
}

function isMissingTable(error: unknown, table: string) {
    if (!error || typeof error !== 'object') return false;
    const e = error as { code?: string; message?: string; details?: string };
    const haystack = `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase();
    return e.code === 'PGRST205' || haystack.includes(`table 'public.${table}'`) || haystack.includes(`relation \"public.${table}\"`);
}

type WalletRow = {
    cash_balance: number;
    cruise_coin_balance: number;
    pending_balance: number;
    total_earnings: number;
    total_withdrawals: number;
};

function downloadJson(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function WalletPage() {
    const { user, profile, refreshProfile } = useAuth();
    const { rate } = useExchangeRate();
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [wallet, setWallet] = useState<WalletRow>({
        cash_balance: 0,
        cruise_coin_balance: 0,
        pending_balance: 0,
        total_earnings: 0,
        total_withdrawals: 0,
    });
    const [transactions, setTransactions] = useState<Array<Record<string, any>>>([]);
    const [minWithdrawalAmount, setMinWithdrawalAmount] = useState(1000);

    const [fundAmount, setFundAmount] = useState('');
    const [fundMethod, setFundMethod] = useState('manual');

    const [coinAmountToConvert, setCoinAmountToConvert] = useState('');

    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [bankName, setBankName] = useState('');
    const [accountName, setAccountName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');

    const coins = Number(profile?.coins ?? 0);
    const nairaEquivalent = toNairaEquivalent(coins, rate);

    const loadWallet = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        const [{ data: walletRow }, { data: txRows }, { data: settingsRow }] = await Promise.all([
            sb
                .from('user_wallets')
                .select('cash_balance, cruise_coin_balance, pending_balance, total_earnings, total_withdrawals')
                .eq('user_id', user.id)
                .maybeSingle(),
            sb
                .from('wallet_transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(80),
            sb
                .from('coin_exchange_settings')
                .select('min_withdrawal_amount')
                .eq('id', true)
                .maybeSingle(),
        ]);

        setWallet({
            cash_balance: Number(walletRow?.cash_balance ?? 0),
            cruise_coin_balance: Number(walletRow?.cruise_coin_balance ?? 0),
            pending_balance: Number(walletRow?.pending_balance ?? 0),
            total_earnings: Number(walletRow?.total_earnings ?? 0),
            total_withdrawals: Number(walletRow?.total_withdrawals ?? 0),
        });
        setTransactions(txRows ?? []);
        setMinWithdrawalAmount(normalizeMinWithdrawalAmount(settingsRow?.min_withdrawal_amount));
        setLoading(false);
    }, [user]);

    useEffect(() => {
        void loadWallet();
    }, [loadWallet]);

    const conversionHistory = useMemo(
        () => transactions.filter((tx) => tx.transaction_type === 'coin_conversion'),
        [transactions],
    );

    const runClientSideCoinConversion = useCallback(async (amount: number) => {
        if (!user) throw new Error('Unauthorized');

        const { data: settingsRow } = await sb
            .from('coin_exchange_settings')
            .select('coin_to_naira_rate, min_coin_conversion')
            .eq('id', true)
            .maybeSingle();

        const effectiveRate = Number(settingsRow?.coin_to_naira_rate ?? rate ?? 1) || 1;
        const minCoinConversion = Number(settingsRow?.min_coin_conversion ?? 1) || 1;

        if (amount < minCoinConversion) {
            throw new Error(`Minimum coin conversion is ${minCoinConversion}.`);
        }

        const currentCoins = Number(profile?.coins ?? 0);
        if (currentCoins < amount) {
            throw new Error('Insufficient Cruise Coin balance');
        }

        const convertedCash = Math.round(amount * effectiveRate * 100) / 100;
        const reference = `CNV-LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

        const { error: coinDebitError } = await sb
            .from('profiles')
            .update({ coins: Math.max(currentCoins - amount, 0) })
            .eq('id', user.id)
            .gte('coins', amount);

        if (coinDebitError) {
            throw coinDebitError;
        }

        await sb.from('user_wallets').upsert({ user_id: user.id }, { onConflict: 'user_id' });

        const { data: latestWallet, error: latestWalletError } = await sb
            .from('user_wallets')
            .select('cash_balance, total_earnings, cruise_coin_balance')
            .eq('user_id', user.id)
            .maybeSingle();

        if (latestWalletError) {
            await sb.from('profiles').update({ coins: currentCoins }).eq('id', user.id);
            throw latestWalletError;
        }

        const { error: walletCreditError } = await sb
            .from('user_wallets')
            .update({
                cash_balance: Number(latestWallet?.cash_balance ?? 0) + convertedCash,
                total_earnings: Number(latestWallet?.total_earnings ?? 0) + convertedCash,
                cruise_coin_balance: Math.max(Number(latestWallet?.cruise_coin_balance ?? currentCoins) - amount, 0),
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id);

        if (walletCreditError) {
            await sb.from('profiles').update({ coins: currentCoins }).eq('id', user.id);
            throw walletCreditError;
        }

        await sb.from('wallet_transactions').insert({
            user_id: user.id,
            transaction_type: 'coin_conversion',
            asset_type: 'cash',
            amount: convertedCash,
            status: 'completed',
            description: 'Cruise Coin converted to wallet balance',
            reference_number: reference,
            created_by: user.id,
            metadata: {
                source: 'client_side_conversion_fallback',
                coin_amount: amount,
                rate: effectiveRate,
            },
        });
    }, [profile?.coins, rate, user]);

    const handleFundWallet = async () => {
        const amount = Number(fundAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error('Enter a valid funding amount.');
            return;
        }

        setBusy(true);
        const { error } = await sb.rpc('fund_wallet', {
            p_amount: amount,
            p_payment_method: fundMethod || 'manual',
            p_reference: null,
            p_notes: null,
        });
        setBusy(false);

        if (error) {
            toast.error(error.message ?? 'Unable to fund wallet.');
            return;
        }

        setFundAmount('');
        await loadWallet();
        toast.success('Wallet funded successfully.');
    };

    const handleConvertCoins = async () => {
        const amount = Number(coinAmountToConvert);
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error('Enter a valid coin amount to convert.');
            return;
        }
        if (amount > coins) {
            toast.error('Insufficient Cruise Coins.');
            return;
        }

        setBusy(true);
        let error: any = null;

        const primary = await sb.rpc('convert_cruise_coins_to_cash', {
            p_coin_amount: amount,
        });

        if (!primary.error) {
            error = null;
        } else if (isMissingRpc(primary.error, 'convert_cruise_coins_to_cash')) {
            // Backward compatibility for databases that still use the older RPC name.
            const fallback = await sb.rpc('convert_coins_to_cash', {
                p_coin_amount: amount,
            });
            if (!fallback.error) {
                error = null;
            } else if (isMissingRpc(fallback.error, 'convert_coins_to_cash')) {
                try {
                    await runClientSideCoinConversion(amount);
                    error = null;
                } catch (clientFallbackError) {
                    if (isMissingTable(clientFallbackError, 'user_wallets') || isMissingTable(clientFallbackError, 'wallet_transactions')) {
                        error = new Error('Wallet backend tables are not deployed on the active database yet. Please apply wallet schema migrations on this project.');
                    } else {
                        error = clientFallbackError;
                    }
                }
            } else {
                error = fallback.error;
            }
        } else {
            error = primary.error;
        }
        setBusy(false);

        if (error) {
            toast.error(error.message ?? 'Unable to convert coins.');
            return;
        }

        setCoinAmountToConvert('');
        await refreshProfile();
        await loadWallet();
        toast.success('Coins converted to wallet balance.');
    };

    const handleWithdraw = async () => {
        const amount = Number(withdrawAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error('Enter a valid withdrawal amount.');
            return;
        }
        if (amount < minWithdrawalAmount) {
            toast.error(`Minimum withdrawal is ${formatNairaAmount(minWithdrawalAmount)}.`);
            return;
        }
        if (amount > wallet.cash_balance) {
            toast.error('Insufficient cash wallet balance.');
            return;
        }
        if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
            toast.error('Bank details are required.');
            return;
        }

        setBusy(true);
        const { error } = await sb.rpc('request_withdrawal', {
            p_amount: amount,
            p_payment_method: 'bank_transfer',
            p_account_details: {
                bank_name: bankName.trim(),
                account_name: accountName.trim(),
                account_number: accountNumber.trim(),
            },
            p_reason: null,
        });
        setBusy(false);

        if (error) {
            toast.error(error.message ?? 'Unable to submit withdrawal request.');
            return;
        }

        setWithdrawAmount('');
        await loadWallet();
        toast.success('Withdrawal request submitted.');
    };

    if (!user) {
        return (
            <AppLayout>
                <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">Sign in to open wallet.</div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <TopBar title="Wallet" showSearch={false} />
            <div className="mx-auto w-full max-w-6xl space-y-6 p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Wallet Dashboard</h1>
                    <Button variant="outline" onClick={() => void loadWallet()} disabled={loading || busy}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                    </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Cruise Coin Balance</p>
                        <p className="mt-1 text-2xl font-semibold text-neon-gold">{coins.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Naira Equivalent</p>
                        <p className="mt-1 text-2xl font-semibold">{formatNairaAmount(nairaEquivalent)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Cash Wallet Balance</p>
                        <p className="mt-1 text-2xl font-semibold">{formatNairaAmount(wallet.cash_balance)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Total Earnings</p>
                        <p className="mt-1 text-xl font-semibold">{formatNairaAmount(wallet.total_earnings)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Pending Earnings</p>
                        <p className="mt-1 text-xl font-semibold">{formatNairaAmount(wallet.pending_balance)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Total Withdrawals</p>
                        <p className="mt-1 text-xl font-semibold">{formatNairaAmount(wallet.total_withdrawals)}</p>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <h2 className="font-semibold">Convert Coins</h2>
                        <p className="text-xs text-muted-foreground">Convert eligible Cruise Coins to wallet balance at {formatNairaAmount(rate)} per coin.</p>
                        <Label htmlFor="convert-amount">Cruise Coins</Label>
                        <Input id="convert-amount" value={coinAmountToConvert} onChange={(e) => setCoinAmountToConvert(e.target.value)} placeholder="e.g. 100" />
                        <Button onClick={handleConvertCoins} disabled={busy || loading} className="w-full">
                            <Repeat className="mr-2 h-4 w-4" /> Convert to Wallet Balance
                        </Button>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <h2 className="font-semibold">Fund Wallet</h2>
                        <Label htmlFor="fund-amount">Amount (NGN)</Label>
                        <Input id="fund-amount" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} placeholder="e.g. 5000" />
                        <Label htmlFor="fund-method">Method</Label>
                        <Input id="fund-method" value={fundMethod} onChange={(e) => setFundMethod(e.target.value)} placeholder="manual" />
                        <Button onClick={handleFundWallet} disabled={busy || loading} className="w-full">
                            <Wallet className="mr-2 h-4 w-4" /> Fund Wallet
                        </Button>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <h2 className="font-semibold">Withdraw Funds</h2>
                        <p className="text-xs text-muted-foreground">Minimum withdrawal: {formatNairaAmount(minWithdrawalAmount)}</p>
                        <Input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="Withdrawal amount" />
                        <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" />
                        <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account name" />
                        <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number" />
                        <Button onClick={handleWithdraw} disabled={busy || loading} className="w-full">
                            <ArrowDownToLine className="mr-2 h-4 w-4" /> Withdraw Funds
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold">Transaction History</h3>
                            <Badge variant="outline">{transactions.length}</Badge>
                        </div>
                        <Separator className="mb-3" />
                        <div className="max-h-[380px] space-y-2 overflow-auto pr-1">
                            {transactions.length === 0 && <p className="text-sm text-muted-foreground">No transactions yet.</p>}
                            {transactions.map((tx) => (
                                <div key={tx.id} className="rounded-lg border border-border/60 p-3 text-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-medium">{tx.description || tx.transaction_type}</p>
                                            <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                                            <p className="text-xs text-muted-foreground">{tx.reference_number}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold">{formatNairaAmount(Number(tx.amount ?? 0))}</p>
                                            <p className="text-xs text-muted-foreground uppercase">{tx.asset_type}</p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="mt-2"
                                        onClick={() => downloadJson(`receipt-${tx.reference_number || tx.id}.json`, tx)}
                                    >
                                        <Download className="mr-2 h-3.5 w-3.5" /> Download Receipt
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold">Conversion History</h3>
                            <Badge variant="outline">{conversionHistory.length}</Badge>
                        </div>
                        <Separator className="mb-3" />
                        <div className="max-h-[380px] space-y-2 overflow-auto pr-1">
                            {conversionHistory.length === 0 && <p className="text-sm text-muted-foreground">No conversions yet.</p>}
                            {conversionHistory.map((tx) => (
                                <div key={tx.id} className="rounded-lg border border-border/60 p-3 text-sm">
                                    <p className="font-medium">{tx.description || 'Coin conversion'}</p>
                                    <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                                    <p className="text-xs text-muted-foreground">{tx.reference_number}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Coin amount: {Number(tx.metadata?.coin_amount ?? 0).toLocaleString()} | Cash credited: {formatNairaAmount(Number(tx.amount ?? 0))}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
