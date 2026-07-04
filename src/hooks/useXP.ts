import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import type { XPReason } from '@/types';
import { toast } from 'sonner';

export function useXP() {
  const { user, refreshProfile } = useAuth();

  const awardXP = useCallback(async (reason: XPReason) => {
    if (!user) return;
    const XP_MAP: Record<XPReason, number> = {
      daily_login: 25, send_message: 5, create_post: 10,
      receive_like: 3, add_comment: 8, join_room: 2,
      invite_friend: 50, win_game: 30,
    };
    const COIN_MAP: Partial<Record<XPReason, number>> = {
      create_post: 2,
      add_comment: 1,
      send_message: 1,
      win_game: 10,
      invite_friend: 20,
    };
    const amount = XP_MAP[reason];
    const coinReward = COIN_MAP[reason] ?? 0;

    const { data, error } = await supabase.rpc('award_xp', {
      p_user_id: user.id,
      p_amount: amount,
      p_reason: reason,
    });

    if (!error && data) {
      const result = data as { leveled_up?: boolean; new_level?: string };
      if (result.leveled_up) {
        toast.success(`Level Up! You are now ${result.new_level}!`, {
          duration: 5000,
        });
      }
      if (coinReward > 0) {
        const { data: p } = await supabase
          .from('profiles')
          .select('coins')
          .eq('id', user.id)
          .maybeSingle();
        if (p) {
          await supabase
            .from('profiles')
            .update({ coins: (p.coins ?? 0) + coinReward })
            .eq('id', user.id);
        }
      }
      await refreshProfile();
      return;
    }

    // Fallback path if RPC is unavailable or blocked by permissions.
    const { data: p } = await supabase
      .from('profiles')
      .select('xp, coins')
      .eq('id', user.id)
      .maybeSingle();

    if (p) {
      await supabase
        .from('profiles')
        .update({
          xp: (p.xp ?? 0) + amount,
          coins: (p.coins ?? 0) + coinReward,
        })
        .eq('id', user.id);

      await supabase.from('xp_transactions').insert({
        user_id: user.id,
        amount,
        reason,
      });

      await refreshProfile();
    }
  }, [user, refreshProfile]);

  return { awardXP };
}
