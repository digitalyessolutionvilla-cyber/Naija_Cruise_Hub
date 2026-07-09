import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/types';
import { isDefaultAdminCredential } from '@/lib/admin';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    username: string,
    metadata?: { country?: string; state?: string; gender?: string; avatar_id?: string }
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const INVITE_CODE_STORAGE_KEY = 'cruisehub_invite_code';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      setProfile(null);
      return;
    }
    if (data) {
      setProfile(data as unknown as Profile);
      return;
    }
    setProfile(null);
  }, []);

  const claimDailyLogin = useCallback(async (userId: string) => {
    const { error } = await supabase.rpc('claim_daily_login', { p_user_id: userId });
    if (error) return;
    // Refresh profile to get updated XP/streak
    await fetchProfile(userId);
  }, [fetchProfile]);

  const claimInviteReward = useCallback(async () => {
    const inviteCode = localStorage.getItem(INVITE_CODE_STORAGE_KEY);
    if (!inviteCode) return;

    const sb = supabase as any;
    const { error } = await sb.rpc('claim_invite_reward', {
      p_invite_code: inviteCode,
    });

    if (!error) {
      localStorage.removeItem(INVITE_CODE_STORAGE_KEY);
      return;
    }

    const msg = (error.message || '').toLowerCase();
    if (
      msg.includes('already claimed') ||
      msg.includes('cannot claim your own') ||
      msg.includes('invalid invite') ||
      msg.includes('inviter not found')
    ) {
      localStorage.removeItem(INVITE_CODE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          setTimeout(() => {
            void (async () => {
              try {
                await fetchProfile(newSession.user.id);
                if (event === 'SIGNED_IN') {
                  await claimDailyLogin(newSession.user.id);
                  await claimInviteReward();
                }
              } catch {
                // Keep auth usable even when optional post-login tasks fail.
              }
            })();
          }, 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        try {
          await fetchProfile(s.user.id);
        } catch {
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, claimDailyLogin, claimInviteReward]);

  useEffect(() => {
    if (!user) return;

    let isActive = true;
    const markOnline = async () => {
      if (!isActive) return;
      await supabase
        .from('profiles')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    };

    const markOffline = async () => {
      await supabase
        .from('profiles')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    };

    void markOnline();

    const interval = setInterval(() => {
      void markOnline();
    }, 20000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void markOnline();
      } else {
        void markOffline();
      }
    };

    const handleBeforeUnload = () => {
      void markOffline();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isActive = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      void markOffline();
    };
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const signUp = async (
    email: string,
    password: string,
    username: string,
    metadata?: { country?: string; state?: string; gender?: string; avatar_id?: string }
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          country: metadata?.country,
          state: metadata?.state,
          gender: metadata?.gender,
          avatar_id: metadata?.avatar_id,
        },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    let { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });

    // Allow bootstrap of a default admin account if it does not exist yet.
    if (error && isDefaultAdminCredential(normalizedEmail, normalizedPassword)) {
      const { error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: normalizedPassword,
        options: {
          data: { username: 'CruiseHubAdmin' },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signUpError && !/already|registered|exists/i.test(signUpError.message)) {
        return { error: signUpError as Error | null };
      }

      const retry = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });
      error = retry.error;
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (user) {
      await supabase
        .from('profiles')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    }
    await supabase.auth.signOut();
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };
    const { error } = await supabase
      .from('profiles')
      .update(data as Record<string, unknown>)
      .eq('id', user.id);
    if (!error) {
      setProfile(prev => prev ? { ...prev, ...data } : null);
    }
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      signUp, signIn, signOut, updateProfile, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
