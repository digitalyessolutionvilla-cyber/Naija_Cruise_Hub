import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useXP } from '@/hooks/useXP';
import type { PrivateMessage, Conversation } from '@/types';

type MessagePermissionState = {
  kind: 'friends' | 'pending' | 'pending_limit_reached' | 'request_required';
  canSend: boolean;
  remainingIntroMessages: number | null;
};

export function useMessages(partnerId?: string) {
  const { user } = useAuth();
  const { awardXP } = useXP();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [messagePermission, setMessagePermission] = useState<MessagePermissionState>({
    kind: 'friends',
    canSend: true,
    remainingIntroMessages: null,
  });
  const [loading, setLoading] = useState(true);

  const getMessagePermission = useCallback(async (receiverId: string): Promise<MessagePermissionState> => {
    if (!user) {
      return { kind: 'request_required', canSend: false, remainingIntroMessages: 0 };
    }

    const { data: acceptedFriendship } = await supabase
      .from('friendships')
      .select('id')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${receiverId}),and(requester_id.eq.${receiverId},addressee_id.eq.${user.id})`)
      .eq('status', 'accepted')
      .maybeSingle();

    if (acceptedFriendship) {
      return { kind: 'friends', canSend: true, remainingIntroMessages: null };
    }

    const { data: pendingRequest } = await supabase
      .from('friendships')
      .select('id')
      .eq('requester_id', user.id)
      .eq('addressee_id', receiverId)
      .eq('status', 'pending')
      .maybeSingle();

    if (!pendingRequest) {
      return { kind: 'request_required', canSend: false, remainingIntroMessages: 0 };
    }

    const { count } = await supabase
      .from('private_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', user.id)
      .eq('receiver_id', receiverId);

    const sentCount = count ?? 0;
    if (sentCount >= 1) {
      return { kind: 'pending_limit_reached', canSend: false, remainingIntroMessages: 0 };
    }

    return { kind: 'pending', canSend: true, remainingIntroMessages: 1 - sentCount };
  }, [user]);

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
      void getMessagePermission(partnerId).then(setMessagePermission);
      const channel = supabase
        .channel(`dm-${user?.id}-${partnerId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'private_messages',
          filter: `receiver_id=eq.${user?.id}`,
        }, (payload) => {
          if (payload.new.sender_id === partnerId) {
            setMessages(prev => [...prev, payload.new as PrivateMessage]);
            void getMessagePermission(partnerId).then(setMessagePermission);
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else {
      fetchConversations();
    }
  }, [partnerId, fetchConversations, fetchMessages, getMessagePermission, user]);

  const sendMessage = useCallback(async (receiverId: string, content: string) => {
    if (!user) return { error: new Error('Not authenticated') };
    const permission = await getMessagePermission(receiverId);
    setMessagePermission(permission);
    if (!permission.canSend) {
      if (permission.kind === 'request_required') {
        return { error: new Error('Send a friend request first before messaging this user.') };
      }
      return { error: new Error('You can only send one message until your friend request is accepted.') };
    }

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
      const nextPermission = await getMessagePermission(receiverId);
      setMessagePermission(nextPermission);
      return { error: null };
    }
    return { error: error as Error };
  }, [user, awardXP, getMessagePermission]);

  return { conversations, messages, messagePermission, loading, fetchConversations, sendMessage };
}
