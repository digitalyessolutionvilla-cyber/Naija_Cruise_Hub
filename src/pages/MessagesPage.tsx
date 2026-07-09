import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Search, ChevronLeft, Send, Phone, Video } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { TopBar } from '@/components/layout/TopBar';
import { AvatarDisplay } from '@/components/profile/AvatarDisplay';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useMessages } from '@/hooks/useMessages';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Conversation } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCall } from '@/context/CallContext';

type FriendProfile = {
  id: string;
  username: string;
  avatar_id: string;
  is_online: boolean;
};

function ConversationList({ conversations, loading, onSelect }: {
  conversations: Conversation[];
  loading: boolean;
  onSelect: (c: Conversation) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = conversations.filter(c =>
    c.profile?.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search messages..."
          className="pl-9 bg-muted/50 border-transparent focus:border-primary"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="glass rounded-2xl h-16 animate-shimmer" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">No conversations yet</p>
          <p className="text-xs text-muted-foreground">Connect with people in Chat Rooms to start chatting</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(conv => (
            <button
              key={conv.partner_id}
              onClick={() => onSelect(conv)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 transition-smooth text-left"
            >
              <AvatarDisplay
                avatarId={conv.profile?.avatar_id || 'av1'}
                size="md"
                isOnline={conv.profile?.is_online}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">@{conv.profile?.username || 'user'}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(conv.last_time), { addSuffix: false })}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">{conv.last_message}</span>
                  {conv.unread_count > 0 && (
                    <span className="w-5 h-5 rounded-full gradient-primary text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0 ml-2">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FriendCallList({
  friends,
  onOpenChat,
  onVoiceCall,
  onVideoCall,
}: {
  friends: FriendProfile[];
  onOpenChat: (friend: FriendProfile) => void;
  onVoiceCall: (friend: FriendProfile) => void;
  onVideoCall: (friend: FriendProfile) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Friends</h2>
        <span className="text-xs text-muted-foreground">{friends.length} available to call</span>
      </div>

      {friends.length === 0 ? (
        <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
          Add and accept friends to start voice and video calls.
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map((friend) => (
            <div key={friend.id} className="glass rounded-2xl p-3 flex items-center gap-3">
              <button className="flex items-center gap-3 flex-1 text-left" onClick={() => onOpenChat(friend)}>
                <AvatarDisplay avatarId={friend.avatar_id || 'av1'} size="md" isOnline={friend.is_online} />
                <div>
                  <p className="font-semibold text-sm">@{friend.username}</p>
                  <p className="text-xs text-muted-foreground">{friend.is_online ? 'Online' : 'Offline'}</p>
                </div>
              </button>

              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onVoiceCall(friend)}>
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onVideoCall(friend)}>
                  <Video className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatView({ partnerId, partnerProfile, onBack, onVoiceCall, onVideoCall }: {
  partnerId: string;
  partnerProfile: Partial<import('@/types').Profile> | undefined;
  onBack: () => void;
  onVoiceCall: (partnerId: string, username: string) => void;
  onVideoCall: (partnerId: string, username: string) => void;
}) {
  const { user } = useAuth();
  const { messages, sendMessage, messagePermission } = useMessages(partnerId);
  const [value, setValue] = useState('');
  const endRef = useState<HTMLDivElement | null>(null);

  const statusText = messagePermission.kind === 'friends'
    ? 'Friends • messaging unlocked'
    : messagePermission.kind === 'pending'
      ? `Pending request • ${messagePermission.remainingIntroMessages ?? 1} intro message left`
      : messagePermission.kind === 'pending_limit_reached'
        ? 'Pending request • waiting for acceptance'
        : 'Send friend request to chat';

  const statusClass = messagePermission.kind === 'friends'
    ? 'text-neon-green'
    : messagePermission.kind === 'pending'
      ? 'text-neon-gold'
      : 'text-muted-foreground';

  useEffect(() => {
    endRef[0]?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, endRef]);

  const handleSend = async () => {
    if (!value.trim()) return;
    const { error } = await sendMessage(partnerId, value.trim());
    if (error) {
      toast.error(error.message || 'Unable to send message');
      return;
    }
    setValue('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="glass-strong border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <AvatarDisplay avatarId={partnerProfile?.avatar_id || 'av1'} size="sm" isOnline={partnerProfile?.is_online} />
        <div className="flex-1">
          <p className="font-semibold text-sm">@{partnerProfile?.username || 'user'}</p>
          <p className={cn('text-xs', statusClass)}>
            {statusText}
          </p>
        </div>
        {messagePermission.kind === 'friends' && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onVoiceCall(partnerId, partnerProfile?.username || 'user')}
            >
              <Phone className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onVideoCall(partnerId, partnerProfile?.username || 'user')}
            >
              <Video className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12 text-xs text-muted-foreground">
            Start a conversation!
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex', msg.sender_id === user?.id ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[75%] px-4 py-2.5 rounded-2xl text-sm',
              msg.sender_id === user?.id
                ? 'gradient-primary text-white rounded-br-md'
                : 'glass rounded-tl-md'
            )}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={el => { if (el) endRef[1](el); }} />
      </div>

      <div className="p-4 border-t border-border flex gap-2">
        <Input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Type a message..."
          className="flex-1 bg-muted/50 border-transparent focus:border-primary"
        />
        <Button
          size="icon"
          className="gradient-primary text-white border-0"
          onClick={handleSend}
          disabled={!value.trim() || !messagePermission.canSend}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function MessagesPage() {
  const { conversations, loading, fetchConversations } = useMessages();
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [searchParams] = useSearchParams();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const { user } = useAuth();
  const { startCall } = useCall();

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (!user) return;

    const fetchFriends = async () => {
      const { data: relationships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      const friendIds = (relationships || []).map((row) =>
        row.requester_id === user.id ? row.addressee_id : row.requester_id
      );

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_id, is_online')
        .in('id', friendIds)
        .order('is_online', { ascending: false })
        .order('username', { ascending: true });

      setFriends((profiles || []) as FriendProfile[]);
    };

    void fetchFriends();
  }, [user]);

  useEffect(() => {
    const partnerId = searchParams.get('with');
    if (!partnerId || activeConv) return;

    const existing = conversations.find(c => c.partner_id === partnerId);
    if (existing) {
      setActiveConv(existing);
      return;
    }

    const openDirectChat = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, avatar_id, level, is_online')
        .eq('id', partnerId)
        .maybeSingle();

      setActiveConv({
        partner_id: partnerId,
        last_message: '',
        last_time: new Date().toISOString(),
        unread_count: 0,
        profile: profile || undefined,
      });
    };

    void openDirectChat();
  }, [searchParams, conversations, activeConv]);

  const openChatWithFriend = (friend: FriendProfile) => {
    const existing = conversations.find((c) => c.partner_id === friend.id);
    if (existing) {
      setActiveConv(existing);
      return;
    }

    setActiveConv({
      partner_id: friend.id,
      last_message: '',
      last_time: new Date().toISOString(),
      unread_count: 0,
      profile: friend,
    });
  };

  const handleVoiceCall = (partnerId: string, username: string) => {
    void startCall(partnerId, username, 'voice');
  };

  const handleVideoCall = (partnerId: string, username: string) => {
    void startCall(partnerId, username, 'video');
  };

  return (
    <AppLayout>
      {activeConv ? (
        <div className="h-screen flex flex-col max-w-2xl mx-auto w-full">
          <ChatView
            partnerId={activeConv.partner_id}
            partnerProfile={activeConv.profile}
            onBack={() => { setActiveConv(null); fetchConversations(); }}
            onVoiceCall={handleVoiceCall}
            onVideoCall={handleVideoCall}
          />
        </div>
      ) : (
        <>
          <TopBar title="Messages" showSearch={false} />
          <div className="max-w-2xl mx-auto w-full p-4 space-y-6">
            <FriendCallList
              friends={friends}
              onOpenChat={openChatWithFriend}
              onVoiceCall={(friend) => handleVoiceCall(friend.id, friend.username)}
              onVideoCall={(friend) => handleVideoCall(friend.id, friend.username)}
            />

            <ConversationList
              conversations={conversations}
              loading={loading}
              onSelect={setActiveConv}
            />
          </div>
        </>
      )}
    </AppLayout>
  );
}
