import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useXP } from '@/hooks/useXP';
import type { PrivateMessage, Conversation } from '@/types';

export function useMessages(partnerId?: string) {
  const { user } = useAuth();
  const { awardXP } = useXP();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_conversations', { p_user_id: user.id });
    if (!data) { setLoading(false); return; }

    // Fetch partner profiles
    const partnerIds = (data as Conversation[]).map(c => c.partner_id);
    if (partnerIds.length === 0) { setConversations([]); setLoading(false); return; }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_id, level, is_online')
      .in('id', partnerIds);

    const profileMap = new Map((profiles || []).map((p: { id: string }) => [p.id, p]));

    setConversations((data as Conversation[]).map(c => ({
      ...c,
      unread_count: Number(c.unread_count),
      profile: profileMap.get(c.partner_id),
    })));
    setLoading(false);
  }, [user]);

  const fetchMessages = useCallback(async () => {
    if (!user || !partnerId) return;
    const { data } = await supabase
      .from('private_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(50);
    if (data) setMessages(data as unknown as PrivateMessage[]);

    // Mark incoming messages as read
    await supabase.from('private_messages')
      .update({ is_read: true })
      .eq('sender_id', partnerId)
      .eq('receiver_id', user.id)
      .eq('is_read', false);

    setLoading(false);
  }, [user, partnerId]);

  useEffect(() => {
    if (partnerId) {
      fetchMessages();
      const channel = supabase
        .channel(`dm-${user?.id}-${partnerId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'private_messages',
          filter: `receiver_id=eq.${user?.id}`,
        }, (payload) => {
          if (payload.new.sender_id === partnerId) {
            setMessages(prev => [...prev, payload.new as PrivateMessage]);
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else {
      fetchConversations();
    }
  }, [partnerId, fetchConversations, fetchMessages, user]);

  const sendMessage = useCallback(async (receiverId: string, content: string) => {
    if (!user) return;
    const { error } = await supabase.from('private_messages').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      content,
    });
    if (!error) {
      const newMsg: PrivateMessage = {
        id: crypto.randomUUID(),
        sender_id: user.id,
        receiver_id: receiverId,
        content,
        is_read: false,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, newMsg]);
      await awardXP('send_message');

      // Create notification for receiver
      await supabase.from('notifications').insert({
        user_id: receiverId,
        type: 'message',
        title: 'New Message',
        body: content.slice(0, 80),
      });
    }
  }, [user, awardXP]);

  return { conversations, messages, loading, fetchConversations, sendMessage };
}
