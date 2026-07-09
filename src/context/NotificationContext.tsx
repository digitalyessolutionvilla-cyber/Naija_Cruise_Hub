import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import type { Notification } from '@/types';

type NotificationCategory =
  | 'messages'
  | 'chat_rooms'
  | 'posts'
  | 'reels'
  | 'memes'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'friend_requests'
  | 'followers'
  | 'wallet'
  | 'coins'
  | 'events'
  | 'promotions'
  | 'system';

type NotificationSettings = {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  selectedSound: string;
  soundVolume: number;
  mutedCategories: Record<NotificationCategory, boolean>;
};

const SOUND_LIBRARY = [
  'Cruise Pop',
  'Soft Drop',
  'Digital Ping',
  'Crystal Bell',
  'Afro Click',
  'Smooth Chime',
  'Light Pulse',
  'Message Pop',
  'Gentle Knock',
  'Ocean Drop',
] as const;

const DEFAULT_MUTED_CATEGORIES: Record<NotificationCategory, boolean> = {
  messages: false,
  chat_rooms: false,
  posts: false,
  reels: false,
  memes: false,
  likes: false,
  comments: false,
  shares: false,
  friend_requests: false,
  followers: false,
  wallet: false,
  coins: false,
  events: false,
  promotions: false,
  system: false,
};

const DEFAULT_SETTINGS: NotificationSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  pushEnabled: true,
  emailEnabled: false,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  selectedSound: 'Cruise Pop',
  soundVolume: 0.8,
  mutedCategories: DEFAULT_MUTED_CATEGORIES,
};

function categoryFromNotificationType(type: string): NotificationCategory {
  if (type === 'message') return 'messages';
  if (type === 'chat_room') return 'chat_rooms';
  if (type === 'post') return 'posts';
  if (type === 'meme') return 'memes';
  if (type === 'reel') return 'reels';
  if (type === 'like') return 'likes';
  if (type === 'comment' || type === 'reply') return 'comments';
  if (type === 'share') return 'shares';
  if (type === 'friend_request' || type === 'friend_accepted') return 'friend_requests';
  if (type === 'follower') return 'followers';
  if (type === 'wallet' || type === 'withdrawal') return 'wallet';
  if (type === 'coin_reward' || type === 'task') return 'coins';
  if (type === 'event' || type === 'group_invite') return 'events';
  if (type === 'promo') return 'promotions';
  return 'system';
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  unreadMessagesCount: number;
  roomUnreadCounts: Record<string, number>;
  settings: NotificationSettings;
  soundLibrary: readonly string[];
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  markRoomRead: (roomId: string) => void;
  previewSound: (soundName: string) => Promise<void>;
  updateSettings: (partial: Partial<NotificationSettings>) => Promise<void>;
  toggleCategoryMuted: (category: NotificationCategory, muted: boolean) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [roomUnreadCounts, setRoomUnreadCounts] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastSoundPlayRef = useRef<Record<string, number>>({});
  const settingsSaveTimeoutRef = useRef<number | null>(null);

  const getCurrentPath = useCallback(() => `${window.location.pathname}${window.location.search}`, []);

  const isWithinQuietHours = useCallback((value: NotificationSettings) => {
    if (!value.quietHoursEnabled) return false;
    const [startH, startM] = value.quietHoursStart.split(':').map(Number);
    const [endH, endM] = value.quietHoursEnd.split(':').map(Number);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    if (startMin < endMin) {
      return nowMin >= startMin && nowMin <= endMin;
    }

    return nowMin >= startMin || nowMin <= endMin;
  }, []);

  const getAudioContext = useCallback(async () => {
    if (typeof window === 'undefined') return null;
    if (!audioContextRef.current) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audioContextRef.current = new Ctx();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback((ctx: AudioContext, frequency: number, durationMs: number, delayMs: number, volume: number, type: OscillatorType = 'sine') => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startAt = ctx.currentTime + (delayMs / 1000);
    const endAt = startAt + (durationMs / 1000);

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(endAt + 0.02);
  }, []);

  const playSoundByName = useCallback(async (soundName: string, category: NotificationCategory) => {
    const now = Date.now();
    const dedupeKey = `${soundName}:${category}`;
    if ((lastSoundPlayRef.current[dedupeKey] ?? 0) + 800 > now) return;
    lastSoundPlayRef.current[dedupeKey] = now;

    if (!settings.soundEnabled || settings.mutedCategories[category] || isWithinQuietHours(settings)) return;

    const ctx = await getAudioContext();
    if (!ctx) return;
    const baseVolume = Math.max(0.02, Math.min(1, settings.soundVolume)) * 0.09;

    switch (soundName) {
      case 'Cruise Pop':
        playTone(ctx, 740, 120, 0, baseVolume, 'triangle');
        playTone(ctx, 988, 160, 110, baseVolume, 'triangle');
        break;
      case 'Soft Drop':
        playTone(ctx, 660, 200, 0, baseVolume, 'sine');
        playTone(ctx, 520, 180, 160, baseVolume * 0.9, 'sine');
        break;
      case 'Digital Ping':
        playTone(ctx, 980, 110, 0, baseVolume, 'square');
        break;
      case 'Crystal Bell':
        playTone(ctx, 1047, 180, 0, baseVolume, 'triangle');
        playTone(ctx, 1319, 220, 80, baseVolume * 0.8, 'triangle');
        break;
      case 'Afro Click':
        playTone(ctx, 660, 80, 0, baseVolume, 'square');
        playTone(ctx, 784, 90, 90, baseVolume, 'square');
        playTone(ctx, 523, 80, 190, baseVolume * 0.9, 'square');
        break;
      case 'Smooth Chime':
        playTone(ctx, 523, 160, 0, baseVolume, 'sine');
        playTone(ctx, 659, 220, 140, baseVolume * 0.8, 'sine');
        break;
      case 'Light Pulse':
        playTone(ctx, 880, 100, 0, baseVolume, 'triangle');
        playTone(ctx, 880, 100, 160, baseVolume * 0.8, 'triangle');
        break;
      case 'Message Pop':
        playTone(ctx, 698, 130, 0, baseVolume, 'triangle');
        playTone(ctx, 988, 120, 100, baseVolume, 'triangle');
        break;
      case 'Gentle Knock':
        playTone(ctx, 330, 100, 0, baseVolume, 'square');
        playTone(ctx, 330, 100, 120, baseVolume * 0.9, 'square');
        break;
      case 'Ocean Drop':
        playTone(ctx, 587, 220, 0, baseVolume, 'sine');
        playTone(ctx, 494, 220, 170, baseVolume * 0.85, 'sine');
        break;
      default:
        playTone(ctx, 740, 130, 0, baseVolume, 'triangle');
        break;
    }

    if (settings.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate([25, 25, 20]);
    }
  }, [getAudioContext, isWithinQuietHours, playTone, settings]);

  const previewSound = useCallback(async (soundName: string) => {
    await playSoundByName(soundName, 'system');
  }, [playSoundByName]);

  const maybeShowBrowserPush = useCallback((notif: Notification) => {
    if (!settings.pushEnabled || document.visibilityState === 'visible') return;
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      // eslint-disable-next-line no-new
      new Notification(notif.title || '9JA Cruse Hub', {
        body: notif.body || undefined,
        tag: `notif-${notif.id}`,
      });
      return;
    }

    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, [settings.pushEnabled]);

  const readRoomUnreadFromStorage = useCallback((uid: string) => {
    const raw = localStorage.getItem(`room-unread:${uid}`);
    if (!raw) return {} as Record<string, number>;
    try {
      return JSON.parse(raw) as Record<string, number>;
    } catch {
      return {} as Record<string, number>;
    }
  }, []);

  const persistRoomUnreadToStorage = useCallback((uid: string, value: Record<string, number>) => {
    localStorage.setItem(`room-unread:${uid}`, JSON.stringify(value));
  }, []);

  const persistSettingsToDb = useCallback((uid: string, value: NotificationSettings) => {
    const sb = supabase as any;
    void sb.from('user_notification_settings').upsert({
      user_id: uid,
      sound_enabled: value.soundEnabled,
      vibration_enabled: value.vibrationEnabled,
      push_enabled: value.pushEnabled,
      email_enabled: value.emailEnabled,
      quiet_hours_enabled: value.quietHoursEnabled,
      quiet_hours_start: value.quietHoursStart,
      quiet_hours_end: value.quietHoursEnd,
      selected_sound: value.selectedSound,
      sound_volume: value.soundVolume,
      muted_categories: value.mutedCategories,
    }, { onConflict: 'user_id' });
  }, []);

  const scheduleSettingsPersist = useCallback((uid: string, value: NotificationSettings) => {
    if (settingsSaveTimeoutRef.current !== null) {
      window.clearTimeout(settingsSaveTimeoutRef.current);
    }

    settingsSaveTimeoutRef.current = window.setTimeout(() => {
      persistSettingsToDb(uid, value);
      settingsSaveTimeoutRef.current = null;
    }, 350);
  }, [persistSettingsToDb]);

  useEffect(() => {
    return () => {
      if (settingsSaveTimeoutRef.current !== null) {
        window.clearTimeout(settingsSaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setNotifications([]);
      setUnreadMessagesCount(0);
      setRoomUnreadCounts({});
      return;
    }

    setRoomUnreadCounts(readRoomUnreadFromStorage(userId));

    (supabase as any)
      .from('user_notification_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (!data) {
          setSettings(DEFAULT_SETTINGS);
          return;
        }

        const mergedMuted = {
          ...DEFAULT_MUTED_CATEGORIES,
          ...(data.muted_categories || {}),
        };

        setSettings({
          soundEnabled: !!data.sound_enabled,
          vibrationEnabled: !!data.vibration_enabled,
          pushEnabled: !!data.push_enabled,
          emailEnabled: !!data.email_enabled,
          quietHoursEnabled: !!data.quiet_hours_enabled,
          quietHoursStart: data.quiet_hours_start || '22:00',
          quietHoursEnd: data.quiet_hours_end || '07:00',
          selectedSound: data.selected_sound || 'Cruise Pop',
          soundVolume: Number(data.sound_volume ?? 0.8),
          mutedCategories: mergedMuted,
        });
      });

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setNotifications(data as unknown as Notification[]);
        setLoading(false);
      });

    supabase
      .from('private_messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('is_read', false)
      .then(({ count }) => {
        setUnreadMessagesCount(count ?? 0);
      });

    // Single global channel — no duplicate subscriptions
    const channel = supabase
      .channel(`notifs-ctx-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const next = payload.new as Notification;
        setNotifications(prev => {
          if (prev.some(p => p.id === next.id)) return prev;
          return [next, ...prev];
        });

        const category = categoryFromNotificationType(next.type);
        void playSoundByName(settings.selectedSound, category);
        maybeShowBrowserPush(next);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const next = payload.new as Notification;
        setNotifications(prev => prev.map(n => (n.id === next.id ? next : n)));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'private_messages',
        filter: `receiver_id=eq.${userId}`,
      }, (payload) => {
        const senderId = payload.new.sender_id as string;
        const query = new URLSearchParams(window.location.search);
        const inConversation = window.location.pathname.startsWith('/messages') && query.get('with') === senderId;
        if (!inConversation) {
          setUnreadMessagesCount(prev => prev + 1);
          void playSoundByName(settings.selectedSound, 'messages');
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'private_messages',
        filter: `receiver_id=eq.${userId}`,
      }, (payload) => {
        const oldRead = payload.old.is_read as boolean;
        const newRead = payload.new.is_read as boolean;
        if (!oldRead && newRead) {
          setUnreadMessagesCount(prev => Math.max(0, prev - 1));
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'room_messages',
      }, (payload) => {
        const row = payload.new as { room_id: string; user_id: string; content: string };
        if (row.user_id === userId) return;

        const currentPath = getCurrentPath();
        const inSameRoom = currentPath.startsWith(`/rooms/${row.room_id}`);
        if (inSameRoom) return;

        setRoomUnreadCounts(prev => {
          const next = { ...prev, [row.room_id]: (prev[row.room_id] || 0) + 1 };
          persistRoomUnreadToStorage(userId, next);
          return next;
        });

        void playSoundByName(settings.selectedSound, 'chat_rooms');
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [
    userId,
    getCurrentPath,
    maybeShowBrowserPush,
    persistRoomUnreadToStorage,
    playSoundByName,
    readRoomUnreadFromStorage,
    settings.selectedSound,
  ]);

  const markRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', userId).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, [userId]);

  const deleteNotification = useCallback(async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(async () => {
    if (!userId) return;
    await supabase.from('notifications').delete().eq('user_id', userId);
    setNotifications([]);
  }, [userId]);

  const markRoomRead = useCallback((roomId: string) => {
    if (!userId) return;
    setRoomUnreadCounts(prev => {
      if (!prev[roomId]) return prev;
      const next = { ...prev };
      delete next[roomId];
      persistRoomUnreadToStorage(userId, next);
      return next;
    });
  }, [persistRoomUnreadToStorage, userId]);

  const updateSettings = useCallback(async (partial: Partial<NotificationSettings>) => {
    if (!userId) return;
    setSettings(prev => {
      const next = {
        ...prev,
        ...partial,
        mutedCategories: {
          ...prev.mutedCategories,
          ...(partial.mutedCategories || {}),
        },
      };

      scheduleSettingsPersist(userId, next);

      return next;
    });
  }, [scheduleSettingsPersist, userId]);

  const toggleCategoryMuted = useCallback(async (category: NotificationCategory, muted: boolean) => {
    await updateSettings({
      mutedCategories: {
        [category]: muted,
      } as Record<NotificationCategory, boolean>,
    });
  }, [updateSettings]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const value = useMemo(() => ({
    notifications,
    unreadCount,
    unreadMessagesCount,
    roomUnreadCounts,
    settings,
    soundLibrary: SOUND_LIBRARY,
    loading,
    markRead,
    markAllRead,
    deleteNotification,
    clearAllNotifications,
    markRoomRead,
    previewSound,
    updateSettings,
    toggleCategoryMuted,
  }), [
    notifications,
    unreadCount,
    unreadMessagesCount,
    roomUnreadCounts,
    settings,
    loading,
    markRead,
    markAllRead,
    deleteNotification,
    clearAllNotifications,
    markRoomRead,
    previewSound,
    updateSettings,
    toggleCategoryMuted,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotificationContext() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotificationContext must be used within NotificationProvider');
  return ctx;
}
