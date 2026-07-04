import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export function useAdmin() {
    const getMyRole = useCallback(async () => {
        const { data, error } = await sb.rpc('admin_get_my_role');
        if (error) throw error;
        return data as { is_admin: boolean; role: string | null };
    }, []);

    const getDashboardMetrics = useCallback(async () => {
        const { data, error } = await sb.rpc('admin_get_dashboard_metrics');
        if (error) throw error;
        return data as Record<string, number>;
    }, []);

    const getGrowthCharts = useCallback(async (days = 30) => {
        const { data, error } = await sb.rpc('admin_get_growth_charts', { p_days: days });
        if (error) throw error;
        return data as Record<string, unknown>;
    }, []);

    const getUsers = useCallback(async (query = '', limit = 20, offset = 0) => {
        const { data, error } = await sb.rpc('admin_get_users', {
            p_query: query,
            p_limit: limit,
            p_offset: offset,
        });
        if (error) throw error;
        return (data ?? []) as Array<Record<string, any>>;
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
        if (error) throw error;
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
        if (error) throw error;
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
        if (error) throw error;
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
        if (error) throw error;
        return (data ?? []) as Array<Record<string, any>>;
    }, []);

    const getRevenueSummary = useCallback(async () => {
        const { data, error } = await sb.rpc('admin_get_revenue_summary');
        if (error) throw error;
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
