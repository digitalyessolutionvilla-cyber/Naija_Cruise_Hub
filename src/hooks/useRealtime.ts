import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RoomMessage, Profile } from '@/types';

export function useRoomMessages(roomId: string | undefined) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!roomId) return;
    const { data } = await supabase
      .from('room_messages')
      .select('*, profile:profiles(id, username, avatar_id, level)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(50);
    if (data) setMessages(data as unknown as RoomMessage[]);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    fetchMessages();

    if (!roomId) return;
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'room_messages',
        filter: `room_id=eq.${roomId}`,
      }, async (payload) => {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username, avatar_id, level')
          .eq('id', payload.new.user_id)
          .maybeSingle();
        const newMsg = { ...payload.new, profile: profileData } as unknown as RoomMessage;
        setMessages(prev => [...prev, newMsg]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, fetchMessages]);

  return { messages, loading };
}

export function useOnlineStatus(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', userId);
    const interval = setInterval(() => {
      supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId);
    }, 30000);
    return () => {
      clearInterval(interval);
      supabase.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', userId);
    };
  }, [userId]);
}
