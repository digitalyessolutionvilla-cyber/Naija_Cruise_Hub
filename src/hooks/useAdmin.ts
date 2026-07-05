import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

function isMissingRpcError(error: unknown, rpcName: string) {
    if (!error || typeof error !== 'object') return false;
    const maybeError = error as { code?: string; message?: string; details?: string };
    const haystack = `${maybeError.message ?? ''} ${maybeError.details ?? ''}`.toLowerCase();
    return maybeError.code === 'PGRST202' || haystack.includes(`function public.${rpcName}`);
}

export function useAdmin() {
    const countRows = useCallback(async (table: string, applyFilters?: (query: any) => any) => {
        let query = sb.from(table).select('id', { count: 'exact', head: true });
        if (applyFilters) query = applyFilters(query);
        const { count, error } = await query;
        if (error) return 0;
        return Number(count ?? 0);
    }, []);

    const getMyRole = useCallback(async () => {
        const { data, error } = await sb.rpc('admin_get_my_role');
        if (error) throw error;
        return data as { is_admin: boolean; role: string | null };
    }, []);

    const getDashboardMetrics = useCallback(async () => {
        const { data, error } = await sb.rpc('admin_get_dashboard_metrics');
        if (!error) return data as Record<string, number>;
        if (!isMissingRpcError(error, 'admin_get_dashboard_metrics')) throw error;

        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const startWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const [
            totalUsers,
            activeToday,
            onlineUsers,
            signupsToday,
            signupsWeek,
            signupsMonth,
            totalPosts,
            totalMemes,
            totalReels,
            totalComments,
            totalLikes,
            totalChatMessages,
            activeRooms,
        ] = await Promise.all([
            countRows('profiles'),
            countRows('profiles', (q) => q.gte('last_seen', startToday)),
            countRows('profiles', (q) => q.eq('is_online', true)),
            countRows('profiles', (q) => q.gte('created_at', startToday)),
            countRows('profiles', (q) => q.gte('created_at', startWeek)),
            countRows('profiles', (q) => q.gte('created_at', startMonth)),
            countRows('posts'),
            countRows('posts', (q) => q.eq('type', 'meme')),
            countRows('posts', (q) => q.eq('type', 'reel')),
            countRows('post_comments'),
            countRows('post_likes'),
            countRows('room_messages'),
            countRows('chat_rooms', (q) => q.eq('is_active', true)),
        ]);

        return {
            total_registered_users: totalUsers,
            active_users_today: activeToday,
            online_users: onlineUsers,
            new_signups_today: signupsToday,
            new_signups_week: signupsWeek,
            new_signups_month: signupsMonth,
            total_posts: totalPosts,
            total_memes: totalMemes,
            total_reels: totalReels,
            total_comments: totalComments,
            total_shares: 0,
            total_likes: totalLikes,
            total_chat_messages: totalChatMessages,
            active_chat_rooms: activeRooms,
            daily_revenue: 0,
            monthly_revenue: 0,
            coins_in_circulation: 0,
            wallet_balances: 0,
            pending_withdrawals: 0,
            approved_withdrawals: 0,
            total_advertisements: 0,
            active_advertisements: 0,
            reported_users: 0,
            reported_posts: 0,
            banned_users: 0,
        } as Record<string, number>;
    }, [countRows]);

    const getGrowthCharts = useCallback(async (days = 30) => {
        const { data, error } = await sb.rpc('admin_get_growth_charts', { p_days: days });
        if (!error) return data as Record<string, unknown>;
        if (!isMissingRpcError(error, 'admin_get_growth_charts')) throw error;
        return {
            user_growth: [],
            revenue_trends: [],
            hourly_active_users: [],
            wallet_transactions: [],
        } as Record<string, unknown>;
    }, []);

    const getUsers = useCallback(async (query = '', limit = 20, offset = 0) => {
        const { data, error } = await sb.rpc('admin_get_users', {
            p_query: query,
            p_limit: limit,
            p_offset: offset,
        });
        if (!error) return (data ?? []) as Array<Record<string, any>>;
        if (!isMissingRpcError(error, 'admin_get_users')) throw error;

        let profilesQuery = sb
            .from('profiles')
            .select('id, username, created_at, last_seen, is_online, coins, xp, level')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (query.trim()) {
            profilesQuery = profilesQuery.ilike('username', `%${query.trim()}%`);
        }

        const { data: profileRows, error: profileError } = await profilesQuery;
        if (profileError) throw profileError;

        return (profileRows ?? []).map((row: any) => ({
            user_id: row.id,
            username: row.username,
            role: 'user',
            is_banned: false,
            is_suspended: false,
            is_verified: false,
            cash_balance: 0,
            coin_balance: Number(row.coins ?? 0),
            level: row.level,
            xp: Number(row.xp ?? 0),
            last_seen: row.last_seen,
            created_at: row.created_at,
            is_online: row.is_online,
        })) as Array<Record<string, any>>;
    }, []);

    const setUserState = useCallback(async (userId: string, action: 'verify' | 'suspend' | 'ban' | 'reactivate', reason?: string) => {
        const { data, error } = await sb.rpc('admin_set_user_state', {
            p_user_id: userId,
            p_action: action,
            p_reason: reason ?? null,
            p_suspended_until: null,
        });
        if (error) throw error;
        return data;
    }, []);

    const assignRole = useCallback(async (userId: string, role: string) => {
        const { data, error } = await sb.rpc('admin_assign_role', {
            p_user_id: userId,
            p_role: role,
        });
        if (error) throw error;
        return data;
    }, []);

    const resetUsername = useCallback(async (userId: string, newUsername: string) => {
        const { data, error } = await sb.rpc('admin_reset_username', {
            p_user_id: userId,
            p_new_username: newUsername,
        });
        if (error) throw error;
        return data;
    }, []);

    const sendResetPassword = useCallback(async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
    }, []);

    const adjustWallet = useCallback(async (
        userId: string,
        assetType: 'cash' | 'coin',
        amount: number,
        description: string,
    ) => {
        const { data, error } = await sb.rpc('admin_adjust_wallet', {
            p_user_id: userId,
            p_asset_type: assetType,
            p_amount: amount,
            p_description: description,
            p_transaction_type: null,
        });
        if (error) throw error;
        return data;
    }, []);

    const getWithdrawals = useCallback(async (status: string | null = null, limit = 50, offset = 0) => {
        const { data, error } = await sb.rpc('admin_get_withdrawals', {
            p_status: status,
            p_limit: limit,
            p_offset: offset,
        });
        if (error) {
            if (isMissingRpcError(error, 'admin_get_withdrawals')) return [] as Array<Record<string, any>>;
            throw error;
        }
        return (data ?? []) as Array<Record<string, any>>;
    }, []);

    const reviewWithdrawal = useCallback(async (withdrawalId: string, decision: 'approve' | 'reject', reason?: string) => {
        const { data, error } = await sb.rpc('admin_review_withdrawal', {
            p_withdrawal_id: withdrawalId,
            p_decision: decision,
            p_reason: reason ?? null,
        });
        if (error) throw error;
        return data;
    }, []);

    const getReports = useCallback(async (status: string | null = null, limit = 50, offset = 0) => {
        const { data, error } = await sb.rpc('admin_list_reports', {
            p_status: status,
            p_limit: limit,
            p_offset: offset,
        });
        if (error) {
            if (isMissingRpcError(error, 'admin_list_reports')) return [] as Array<Record<string, any>>;
            throw error;
        }
        return (data ?? []) as Array<Record<string, any>>;
    }, []);

    const moderateReport = useCallback(async (reportId: string, action: 'remove' | 'restore' | 'delete_permanent' | 'warn', notes?: string) => {
        const { data, error } = await sb.rpc('admin_moderate_content', {
            p_report_id: reportId,
            p_action: action,
            p_notes: notes ?? null,
        });
        if (error) throw error;
        return data;
    }, []);

    const getAds = useCallback(async () => {
        const { data, error } = await sb.rpc('admin_get_ads');
        if (error) {
            if (isMissingRpcError(error, 'admin_get_ads')) return [] as Array<Record<string, any>>;
            throw error;
        }
        return (data ?? []) as Array<Record<string, any>>;
    }, []);

    const upsertAd = useCallback(async (payload: {
        id?: string | null;
        title: string;
        media_url: string;
        media_type: 'image' | 'video';
        placement: string;
        destination_url?: string | null;
        start_at?: string | null;
        end_at?: string | null;
        display_frequency?: number;
        is_active?: boolean;
        is_paused?: boolean;
    }) => {
        const { data, error } = await sb.rpc('admin_upsert_ad_campaign', {
            p_id: payload.id ?? null,
            p_title: payload.title,
            p_media_url: payload.media_url,
            p_media_type: payload.media_type,
            p_placement: payload.placement,
            p_destination_url: payload.destination_url ?? null,
            p_start_at: payload.start_at ?? null,
            p_end_at: payload.end_at ?? null,
            p_display_frequency: payload.display_frequency ?? 1,
            p_is_active: payload.is_active ?? true,
            p_is_paused: payload.is_paused ?? false,
        });
        if (error) throw error;
        return data;
    }, []);

    const getWalletTransactions = useCallback(async (userId: string | null = null, limit = 100, offset = 0) => {
        const { data, error } = await sb.rpc('admin_get_wallet_transactions', {
            p_user_id: userId,
            p_limit: limit,
            p_offset: offset,
        });
        if (error) {
            if (isMissingRpcError(error, 'admin_get_wallet_transactions')) return [] as Array<Record<string, any>>;
            throw error;
        }
        return (data ?? []) as Array<Record<string, any>>;
    }, []);

    const getRevenueSummary = useCallback(async () => {
        const { data, error } = await sb.rpc('admin_get_revenue_summary');
        if (error) {
            if (isMissingRpcError(error, 'admin_get_revenue_summary')) {
                return {
                    daily_revenue: 0,
                    weekly_revenue: 0,
                    monthly_revenue: 0,
                    annual_revenue: 0,
                } as Record<string, number>;
            }
            throw error;
        }
        return data as Record<string, number>;
    }, []);

    return {
        getMyRole,
        getDashboardMetrics,
        getGrowthCharts,
        getUsers,
        setUserState,
        assignRole,
        resetUsername,
        sendResetPassword,
        adjustWallet,
        getWithdrawals,
        reviewWithdrawal,
        getReports,
        moderateReport,
        getAds,
        upsertAd,
        getWalletTransactions,
        getRevenueSummary,
    };
}
