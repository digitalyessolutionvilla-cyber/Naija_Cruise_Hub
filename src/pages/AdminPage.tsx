import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type TabKey =
    | 'overview'
    | 'users'
    | 'moderation'
    | 'wallets'
    | 'withdrawals'
    | 'ads'
    | 'analytics';

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'users', label: 'Users' },
    { key: 'moderation', label: 'Moderation' },
    { key: 'wallets', label: 'Wallets' },
    { key: 'withdrawals', label: 'Withdrawals' },
    { key: 'ads', label: 'Advertisements' },
    { key: 'analytics', label: 'Analytics' },
];

const ADMIN_ROLES = [
    'super_admin',
    'finance_manager',
    'community_manager',
    'moderator',
    'advertisement_manager',
    'customer_support',
];

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
    if (!rows.length) {
        toast.info('No rows to export.');
        return;
    }

    const headers = Object.keys(rows[0]);
    const csvLines = [headers.join(',')];
    for (const row of rows) {
        const values = headers.map((header) => {
            const raw = row[header] == null ? '' : String(row[header]);
            const escaped = raw.replaceAll('"', '""');
            return `"${escaped}"`;
        });
        csvLines.push(values.join(','));
    }

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

export function AdminPage() {
    const { user, loading, signOut } = useAuth();
    const admin = useAdmin();
    const navigate = useNavigate();

    const [authReady, setAuthReady] = useState(false);
    const [myRole, setMyRole] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabKey>('overview');
    const [busy, setBusy] = useState(false);

    const [metrics, setMetrics] = useState<Record<string, number>>({});
    const [charts, setCharts] = useState<Record<string, any>>({});
    const [revenueSummary, setRevenueSummary] = useState<Record<string, number>>({});

    const [users, setUsers] = useState<Array<Record<string, any>>>([]);
    const [userSearch, setUserSearch] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [roleValue, setRoleValue] = useState<string>('moderator');
    const [newUsername, setNewUsername] = useState('');
    const [adjustAmount, setAdjustAmount] = useState('0');
    const [adjustAsset, setAdjustAsset] = useState<'cash' | 'coin'>('cash');
    const [adjustDescription, setAdjustDescription] = useState('Manual admin adjustment');

    const [withdrawals, setWithdrawals] = useState<Array<Record<string, any>>>([]);
    const [reports, setReports] = useState<Array<Record<string, any>>>([]);
    const [walletTx, setWalletTx] = useState<Array<Record<string, any>>>([]);
    const [ads, setAds] = useState<Array<Record<string, any>>>([]);
    const [adForm, setAdForm] = useState({
        title: '',
        media_url: '',
        media_type: 'image' as 'image' | 'video',
        placement: 'homepage_banner',
        destination_url: '',
        start_at: '',
        end_at: '',
        display_frequency: 1,
    });

    const loadOverview = useCallback(async () => {
        const [m, c, r] = await Promise.all([
            admin.getDashboardMetrics(),
            admin.getGrowthCharts(30),
            admin.getRevenueSummary(),
        ]);
        setMetrics(m);
        setCharts(c as Record<string, any>);
        setRevenueSummary(r);
    }, [admin]);

    const loadUsers = useCallback(async () => {
        const rows = await admin.getUsers(userSearch, 40, 0);
        setUsers(rows);
        if (!selectedUserId && rows.length) {
            setSelectedUserId(rows[0].user_id);
            setRoleValue(rows[0].role ?? 'moderator');
        }
    }, [admin, selectedUserId, userSearch]);

    const loadModeration = useCallback(async () => {
        const rows = await admin.getReports('pending', 60, 0);
        setReports(rows);
    }, [admin]);

    const loadWallets = useCallback(async () => {
        const rows = await admin.getWalletTransactions(selectedUserId || null, 80, 0);
        setWalletTx(rows);
    }, [admin, selectedUserId]);

    const loadWithdrawals = useCallback(async () => {
        const rows = await admin.getWithdrawals(null, 80, 0);
        setWithdrawals(rows);
    }, [admin]);

    const loadAds = useCallback(async () => {
        const rows = await admin.getAds();
        setAds(rows);
    }, [admin]);

    const refreshAll = useCallback(async () => {
        setBusy(true);
        try {
            await Promise.all([
                loadOverview(),
                loadUsers(),
                loadModeration(),
                loadWallets(),
                loadWithdrawals(),
                loadAds(),
            ]);
        } finally {
            setBusy(false);
        }
    }, [loadAds, loadModeration, loadOverview, loadUsers, loadWallets, loadWithdrawals]);

    useEffect(() => {
        if (loading) return;

        if (!user) {
            navigate('/auth?next=/admin', { replace: true });
            return;
        }

        let mounted = true;
        (async () => {
            try {
                const roleInfo = await admin.getMyRole();
                if (!mounted) return;
                if (!roleInfo?.is_admin) {
                    toast.error('You do not have admin access.');
                    navigate('/home', { replace: true });
                    return;
                }
                setMyRole(roleInfo.role ?? 'admin');
                setAuthReady(true);
            } catch {
                if (!mounted) return;
                toast.error('Unable to verify admin access.');
                navigate('/home', { replace: true });
            }
        })();

        return () => {
            mounted = false;
        };
    }, [admin, loading, navigate, user]);

    useEffect(() => {
        if (!authReady) return;
        refreshAll().catch((error) => {
            toast.error(error.message ?? 'Failed to load admin data.');
        });

        const timer = window.setInterval(() => {
            refreshAll().catch(() => {
                // Silent background refresh error.
            });
        }, 20000);

        return () => {
            window.clearInterval(timer);
        };
    }, [authReady, refreshAll]);

    const selectedUser = useMemo(
        () => users.find((row) => row.user_id === selectedUserId),
        [users, selectedUserId],
    );

    const overviewCards = useMemo(() => {
        return [
            ['Total Registered Users', metrics.total_registered_users],
            ['Active Users Today', metrics.active_users_today],
            ['Online Users', metrics.online_users],
            ['New Signups Today', metrics.new_signups_today],
            ['New Signups Week', metrics.new_signups_week],
            ['New Signups Month', metrics.new_signups_month],
            ['Total Posts', metrics.total_posts],
            ['Total Memes', metrics.total_memes],
            ['Total Reels', metrics.total_reels],
            ['Total Comments', metrics.total_comments],
            ['Total Shares', metrics.total_shares],
            ['Total Likes', metrics.total_likes],
            ['Total Chat Messages', metrics.total_chat_messages],
            ['Active Chat Rooms', metrics.active_chat_rooms],
            ['Daily Revenue', metrics.daily_revenue],
            ['Monthly Revenue', metrics.monthly_revenue],
            ['Cruise Coins in Circulation', metrics.coins_in_circulation],
            ['Wallet Balances', metrics.wallet_balances],
            ['Pending Withdrawals', metrics.pending_withdrawals],
            ['Approved Withdrawals', metrics.approved_withdrawals],
            ['Total Advertisements', metrics.total_advertisements],
            ['Active Advertisements', metrics.active_advertisements],
            ['Reported Users', metrics.reported_users],
            ['Reported Posts', metrics.reported_posts],
            ['Banned Users', metrics.banned_users],
        ] as Array<[string, number]>;
    }, [metrics]);

    if (loading || !authReady || !user) {
        return (
            <div className="min-h-screen grid place-items-center bg-background text-foreground">
                <p>Loading secure admin workspace...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            <div className="mx-auto max-w-7xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold">CruiseHub CMS</h1>
                        <p className="text-sm text-muted-foreground">
                            Role: {myRole ?? 'admin'} | Live data updates every 20 seconds
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => refreshAll()} disabled={busy}>
                            {busy ? 'Refreshing...' : 'Refresh Now'}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={async () => {
                                await signOut();
                                navigate('/auth', { replace: true });
                            }}
                        >
                            Sign Out
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {TAB_ITEMS.map((tab) => (
                        <Button
                            key={tab.key}
                            size="sm"
                            variant={activeTab === tab.key ? 'default' : 'outline'}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                        </Button>
                    ))}
                </div>

                {activeTab === 'overview' && (
                    <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {overviewCards.map(([label, value]) => (
                                <div key={label} className="rounded-xl border border-border bg-card p-3">
                                    <p className="text-xs text-muted-foreground">{label}</p>
                                    <p className="mt-1 text-xl font-semibold">{Number(value ?? 0).toLocaleString()}</p>
                                </div>
                            ))}
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-xl border border-border bg-card p-4">
                                <h3 className="font-semibold">Revenue Summary</h3>
                                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                    <div>Daily: {Number(revenueSummary.daily_revenue ?? 0).toLocaleString()}</div>
                                    <div>Weekly: {Number(revenueSummary.weekly_revenue ?? 0).toLocaleString()}</div>
                                    <div>Monthly: {Number(revenueSummary.monthly_revenue ?? 0).toLocaleString()}</div>
                                    <div>Annual: {Number(revenueSummary.annual_revenue ?? 0).toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-border bg-card p-4">
                                <h3 className="font-semibold">Chart Samples (Raw)</h3>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    User growth points: {(charts.user_growth ?? []).length} | Revenue points: {(charts.revenue_trends ?? []).length}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Hourly active points: {(charts.hourly_active_users ?? []).length} | Wallet tx points: {(charts.wallet_transactions ?? []).length}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="grid gap-4 lg:grid-cols-3">
                        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
                            <div className="mb-3 flex items-center gap-2">
                                <Input
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    placeholder="Search username or user id"
                                />
                                <Button variant="outline" onClick={() => loadUsers()}>Search</Button>
                            </div>
                            <div className="max-h-[420px] overflow-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-muted-foreground">
                                            <th className="p-2">User</th>
                                            <th className="p-2">Role</th>
                                            <th className="p-2">Status</th>
                                            <th className="p-2">Wallet</th>
                                            <th className="p-2">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((row) => (
                                            <tr key={row.user_id} className="border-t border-border/60">
                                                <td className="p-2">
                                                    <div className="font-medium">{row.username}</div>
                                                    <div className="text-xs text-muted-foreground">{row.user_id}</div>
                                                </td>
                                                <td className="p-2 text-xs">{row.role ?? 'user'}</td>
                                                <td className="p-2 text-xs">
                                                    {row.is_banned ? 'Banned' : row.is_suspended ? 'Suspended' : 'Active'}
                                                    {row.is_verified ? ' | Verified' : ''}
                                                </td>
                                                <td className="p-2 text-xs">Cash {Number(row.cash_balance).toFixed(2)} | Coin {Number(row.coin_balance).toFixed(2)}</td>
                                                <td className="p-2">
                                                    <Button size="sm" variant="outline" onClick={() => {
                                                        setSelectedUserId(row.user_id);
                                                        setRoleValue(row.role ?? 'moderator');
                                                        setNewUsername(row.username ?? '');
                                                    }}>
                                                        Select
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                            <h3 className="font-semibold">User Controls</h3>
                            <p className="text-xs text-muted-foreground break-all">Selected: {selectedUserId || 'none'}</p>

                            <div className="grid grid-cols-2 gap-2">
                                <Button size="sm" variant="outline" disabled={!selectedUserId} onClick={async () => {
                                    await admin.setUserState(selectedUserId, 'verify');
                                    toast.success('User verified.');
                                    await loadUsers();
                                }}>Verify</Button>
                                <Button size="sm" variant="outline" disabled={!selectedUserId} onClick={async () => {
                                    await admin.setUserState(selectedUserId, 'suspend', 'Suspended by admin');
                                    toast.success('User suspended.');
                                    await loadUsers();
                                }}>Suspend</Button>
                                <Button size="sm" variant="outline" disabled={!selectedUserId} onClick={async () => {
                                    await admin.setUserState(selectedUserId, 'ban', 'Banned by admin');
                                    toast.success('User banned.');
                                    await loadUsers();
                                }}>Ban</Button>
                                <Button size="sm" variant="outline" disabled={!selectedUserId} onClick={async () => {
                                    await admin.setUserState(selectedUserId, 'reactivate');
                                    toast.success('User reactivated.');
                                    await loadUsers();
                                }}>Reactivate</Button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-muted-foreground">Assign role</label>
                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={roleValue}
                                    onChange={(e) => setRoleValue(e.target.value)}
                                >
                                    {ADMIN_ROLES.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                                <Button size="sm" variant="outline" disabled={!selectedUserId} onClick={async () => {
                                    await admin.assignRole(selectedUserId, roleValue);
                                    toast.success('Role assigned.');
                                    await loadUsers();
                                }}>Save Role</Button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-muted-foreground">Reset username</label>
                                <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="new_username" />
                                <Button size="sm" variant="outline" disabled={!selectedUserId || !newUsername.trim()} onClick={async () => {
                                    await admin.resetUsername(selectedUserId, newUsername.trim());
                                    toast.success('Username reset.');
                                    await loadUsers();
                                }}>Update Username</Button>
                            </div>

                            <Button size="sm" variant="outline" disabled={!selectedUser?.username} onClick={async () => {
                                const email = prompt('Enter user email for password reset link:');
                                if (!email) return;
                                await admin.sendResetPassword(email);
                                toast.success('Password reset email sent.');
                            }}>Reset Password (Email Link)</Button>
                        </div>
                    </div>
                )}

                {activeTab === 'moderation' && (
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold">Content Reports</h3>
                            <Button variant="outline" size="sm" onClick={() => downloadCsv('content-reports.csv', reports)}>Export CSV</Button>
                        </div>
                        <div className="max-h-[500px] overflow-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-muted-foreground">
                                        <th className="p-2">Type</th>
                                        <th className="p-2">Target</th>
                                        <th className="p-2">Reason</th>
                                        <th className="p-2">Status</th>
                                        <th className="p-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((row) => (
                                        <tr key={row.id} className="border-t border-border/60">
                                            <td className="p-2">{row.target_type}</td>
                                            <td className="p-2 text-xs break-all">{row.target_id}</td>
                                            <td className="p-2 text-xs">{row.reason}</td>
                                            <td className="p-2 text-xs">{row.status}</td>
                                            <td className="p-2">
                                                <div className="flex flex-wrap gap-1">
                                                    <Button size="sm" variant="outline" onClick={async () => {
                                                        await admin.moderateReport(row.id, 'remove', 'Removed by moderator');
                                                        toast.success('Content removed.');
                                                        await loadModeration();
                                                    }}>Remove</Button>
                                                    <Button size="sm" variant="outline" onClick={async () => {
                                                        await admin.moderateReport(row.id, 'restore', 'Restored by moderator');
                                                        toast.success('Content restored.');
                                                        await loadModeration();
                                                    }}>Restore</Button>
                                                    <Button size="sm" variant="outline" onClick={async () => {
                                                        await admin.moderateReport(row.id, 'warn', 'User warned');
                                                        toast.success('Warning logged.');
                                                        await loadModeration();
                                                    }}>Warn</Button>
                                                    <Button size="sm" variant="outline" onClick={async () => {
                                                        await admin.moderateReport(row.id, 'delete_permanent', 'Illegal or abusive content');
                                                        toast.success('Content permanently deleted.');
                                                        await loadModeration();
                                                    }}>Delete</Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'wallets' && (
                    <div className="grid gap-4 lg:grid-cols-3">
                        <div className="rounded-xl border border-border bg-card p-4 space-y-2 lg:col-span-1">
                            <h3 className="font-semibold">Manual Wallet Controls</h3>
                            <p className="text-xs text-muted-foreground break-all">Selected user: {selectedUserId || 'none'}</p>
                            <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={adjustAsset}
                                onChange={(e) => setAdjustAsset(e.target.value as 'cash' | 'coin')}
                            >
                                <option value="cash">Cash</option>
                                <option value="coin">Coin</option>
                            </select>
                            <Input value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="Amount (+ credit, - debit)" />
                            <Input value={adjustDescription} onChange={(e) => setAdjustDescription(e.target.value)} placeholder="Description" />
                            <Button variant="outline" disabled={!selectedUserId} onClick={async () => {
                                if (!confirm('Confirm wallet financial adjustment?')) return;
                                await admin.adjustWallet(selectedUserId, adjustAsset, Number(adjustAmount), adjustDescription);
                                toast.success('Wallet adjusted and audit logged.');
                                await loadWallets();
                                await loadUsers();
                            }}>Apply Adjustment</Button>
                        </div>

                        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="font-semibold">Wallet Transaction History</h3>
                                <Button size="sm" variant="outline" onClick={() => downloadCsv('wallet-transactions.csv', walletTx)}>Export CSV</Button>
                            </div>
                            <div className="max-h-[500px] overflow-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-muted-foreground">
                                            <th className="p-2">Date</th>
                                            <th className="p-2">User</th>
                                            <th className="p-2">Type</th>
                                            <th className="p-2">Asset</th>
                                            <th className="p-2">Amount</th>
                                            <th className="p-2">Ref</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {walletTx.map((row) => (
                                            <tr key={row.id} className="border-t border-border/60">
                                                <td className="p-2 text-xs">{new Date(row.created_at).toLocaleString()}</td>
                                                <td className="p-2">{row.username}</td>
                                                <td className="p-2">{row.transaction_type}</td>
                                                <td className="p-2">{row.asset_type}</td>
                                                <td className="p-2">{row.amount}</td>
                                                <td className="p-2 text-xs">{row.reference_number}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'withdrawals' && (
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold">Withdrawal Queue</h3>
                            <Button size="sm" variant="outline" onClick={() => downloadCsv('withdrawals.csv', withdrawals)}>Export CSV</Button>
                        </div>
                        <div className="max-h-[500px] overflow-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-muted-foreground">
                                        <th className="p-2">Date</th>
                                        <th className="p-2">User</th>
                                        <th className="p-2">Amount</th>
                                        <th className="p-2">Status</th>
                                        <th className="p-2">Method</th>
                                        <th className="p-2">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {withdrawals.map((row) => (
                                        <tr key={row.id} className="border-t border-border/60">
                                            <td className="p-2 text-xs">{new Date(row.created_at).toLocaleString()}</td>
                                            <td className="p-2">{row.username}</td>
                                            <td className="p-2">{row.amount}</td>
                                            <td className="p-2">{row.status}</td>
                                            <td className="p-2 text-xs">{row.payment_method || 'n/a'}</td>
                                            <td className="p-2">
                                                <div className="flex flex-wrap gap-1">
                                                    <Button size="sm" variant="outline" disabled={row.status !== 'pending'} onClick={async () => {
                                                        if (!confirm('Approve and mark as paid?')) return;
                                                        await admin.reviewWithdrawal(row.id, 'approve', 'Approved by admin');
                                                        toast.success('Withdrawal approved and paid.');
                                                        await loadWithdrawals();
                                                    }}>Approve</Button>
                                                    <Button size="sm" variant="outline" disabled={row.status !== 'pending'} onClick={async () => {
                                                        const reason = prompt('Rejection reason:') ?? 'Rejected by admin';
                                                        await admin.reviewWithdrawal(row.id, 'reject', reason);
                                                        toast.success('Withdrawal rejected.');
                                                        await loadWithdrawals();
                                                    }}>Reject</Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'ads' && (
                    <div className="grid gap-4 lg:grid-cols-3">
                        <div className="rounded-xl border border-border bg-card p-4 space-y-2 lg:col-span-1">
                            <h3 className="font-semibold">Create Advertisement</h3>
                            <Input placeholder="Title" value={adForm.title} onChange={(e) => setAdForm((v) => ({ ...v, title: e.target.value }))} />
                            <Input placeholder="Media URL" value={adForm.media_url} onChange={(e) => setAdForm((v) => ({ ...v, media_url: e.target.value }))} />
                            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={adForm.media_type} onChange={(e) => setAdForm((v) => ({ ...v, media_type: e.target.value as 'image' | 'video' }))}>
                                <option value="image">Image</option>
                                <option value="video">Video</option>
                            </select>
                            <Input placeholder="Placement" value={adForm.placement} onChange={(e) => setAdForm((v) => ({ ...v, placement: e.target.value }))} />
                            <Input placeholder="Destination URL" value={adForm.destination_url} onChange={(e) => setAdForm((v) => ({ ...v, destination_url: e.target.value }))} />
                            <Input placeholder="Start (ISO)" value={adForm.start_at} onChange={(e) => setAdForm((v) => ({ ...v, start_at: e.target.value }))} />
                            <Input placeholder="End (ISO)" value={adForm.end_at} onChange={(e) => setAdForm((v) => ({ ...v, end_at: e.target.value }))} />
                            <Input placeholder="Display Frequency" value={String(adForm.display_frequency)} onChange={(e) => setAdForm((v) => ({ ...v, display_frequency: Number(e.target.value) || 1 }))} />
                            <Button variant="outline" onClick={async () => {
                                await admin.upsertAd({
                                    id: null,
                                    title: adForm.title,
                                    media_url: adForm.media_url,
                                    media_type: adForm.media_type,
                                    placement: adForm.placement,
                                    destination_url: adForm.destination_url || null,
                                    start_at: adForm.start_at || null,
                                    end_at: adForm.end_at || null,
                                    display_frequency: adForm.display_frequency,
                                    is_active: true,
                                    is_paused: false,
                                });
                                toast.success('Advertisement saved.');
                                await loadAds();
                            }}>Save Campaign</Button>
                        </div>

                        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="font-semibold">Advertisement Performance</h3>
                                <Button size="sm" variant="outline" onClick={() => downloadCsv('ads-performance.csv', ads)}>Export CSV</Button>
                            </div>
                            <div className="max-h-[500px] overflow-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-muted-foreground">
                                            <th className="p-2">Campaign</th>
                                            <th className="p-2">Placement</th>
                                            <th className="p-2">Impressions</th>
                                            <th className="p-2">Clicks</th>
                                            <th className="p-2">CTR</th>
                                            <th className="p-2">State</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ads.map((row) => (
                                            <tr key={row.id} className="border-t border-border/60">
                                                <td className="p-2">{row.title}</td>
                                                <td className="p-2">{row.placement}</td>
                                                <td className="p-2">{row.impressions}</td>
                                                <td className="p-2">{row.clicks}</td>
                                                <td className="p-2">{row.ctr}%</td>
                                                <td className="p-2 text-xs">{row.is_active ? (row.is_paused ? 'Paused' : 'Active') : 'Inactive'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <h3 className="font-semibold">Analytics Export and Trends</h3>
                        <p className="text-sm text-muted-foreground">
                            Includes user growth, daily traffic, hourly active users, revenue trends, advertisement performance,
                            coin circulation, and wallet transaction volumes from backend RPC analytics.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => downloadCsv('user-growth.csv', charts.user_growth ?? [])}>Export User Growth</Button>
                            <Button variant="outline" onClick={() => downloadCsv('daily-traffic.csv', charts.daily_traffic ?? [])}>Export Traffic</Button>
                            <Button variant="outline" onClick={() => downloadCsv('hourly-active-users.csv', charts.hourly_active_users ?? [])}>Export Hourly Active</Button>
                            <Button variant="outline" onClick={() => downloadCsv('revenue-trends.csv', charts.revenue_trends ?? [])}>Export Revenue Trends</Button>
                            <Button variant="outline" onClick={() => downloadCsv('ad-performance.csv', charts.advertisement_performance ?? [])}>Export Ad Performance</Button>
                            <Button variant="outline" onClick={() => downloadCsv('coin-circulation.csv', charts.coin_circulation ?? [])}>Export Coin Circulation</Button>
                            <Button variant="outline" onClick={() => downloadCsv('wallet-tx-trends.csv', charts.wallet_transactions ?? [])}>Export Wallet TX</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
