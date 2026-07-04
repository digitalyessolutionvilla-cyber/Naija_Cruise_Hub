import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Users, MoreVertical, MessageSquare,
  Building2, Landmark, GraduationCap, Heart, Music,
  Trophy, Cpu, Moon, Shirt, Star, TrendingUp
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useRoomMessages } from '@/hooks/useRealtime';
import { useXP } from '@/hooks/useXP';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import type { ChatRoom } from '@/types';
import type { LucideProps } from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  MessageCircle: MessageSquare, MessageSquare, Building2, Landmark,
  GraduationCap, Heart, Music, Trophy, Cpu, Moon, Shirt, Star, TrendingUp,
};

function RoomIcon({ iconName }: { iconName: string }) {
  const IconComp = ICON_MAP[iconName] || MessageSquare;
  return <IconComp className="w-5 h-5" />;
}

export function ChatRoomPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { awardXP } = useXP();
  const { messages, loading } = useRoomMessages(id);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from('chat_rooms').select('*').eq('id', id).maybeSingle()
      .then(({ data }) => { if (data) setRoom(data as ChatRoom); });

    // Award XP for joining a room (once per session)
    if (user) awardXP('join_room');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (content: string) => {
    if (!user || !id) return;
    await supabase.from('room_messages').insert({
      room_id: id,
      user_id: user.id,
      content,
      type: 'text',
    });
    await awardXP('send_message');
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-0px)] max-h-screen">
        {/* Header */}
        <div className="glass-strong border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/rooms')}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          {room && (
            <>
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                <RoomIcon iconName={room.emoji_icon || 'MessageSquare'} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-sm">{room.name}</h1>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                  <Users className="w-3 h-3" />
                  <span>{room.member_count.toLocaleString()} members</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="text-center py-8 text-xs text-muted-foreground">Loading messages...</div>
          )}
          {!loading && messages.length === 0 && (
            <div className="text-center py-16 space-y-2">
              <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground">Be the first to say something!</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.2) }}
            >
              <ChatMessage message={msg} isOwn={msg.user_id === user?.id} />
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border flex-shrink-0">
          {user ? (
            <ChatInput
              onSend={handleSend}
              placeholder={`Message ${room?.name || 'room'}...`}
            />
          ) : (
            <div className="text-center py-3 text-sm text-muted-foreground">
              <button className="text-primary underline" onClick={() => navigate('/auth')}>
                Sign in
              </button>{' '}to join the conversation
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
