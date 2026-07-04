import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { TopBar } from '@/components/layout/TopBar';
import { AvatarDisplay } from '@/components/profile/AvatarDisplay';
import { LevelBadge } from '@/components/profile/XPBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Sparkles, Hash, UserPlus, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import type { Profile, ChatRoom } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function ExplorePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [suggestedUsers, setSuggestedUsers] = useState<Partial<Profile>[]>([]);
  const [suggestedRooms, setSuggestedRooms] = useState<ChatRoom[]>([]);
  const [friendRequests, setFriendRequests] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Fetch users (exclude self)
    supabase
      .from('profiles')
      .select('id, username, avatar_id, level, state, interests, is_online, xp')
      .neq('id', user.id)
      .order('xp', { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (data) setSuggestedUsers(data as unknown as Partial<Profile>[]);
      });

    // Rooms based on interests or just top rooms
    const interestKeywords = profile?.interests?.slice(0, 3) || [];
    let roomQuery = supabase.from('chat_rooms').select('*').eq('is_active', true);
    if (interestKeywords.length > 0) {
      roomQuery = roomQuery.ilike('category', `%${interestKeywords[0]}%`);
    }
    roomQuery
      .order('member_count', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          supabase.from('chat_rooms').select('*').eq('is_active', true)
            .order('member_count', { ascending: false }).limit(3)
            .then(({ data: d2 }) => { if (d2) setSuggestedRooms(d2 as ChatRoom[]); });
        } else {
          setSuggestedRooms(data as ChatRoom[]);
        }
      });

    // Existing friend requests
    supabase
      .from('friendships')
      .select('addressee_id')
      .eq('requester_id', user.id)
      .then(({ data }) => {
        if (data) setFriendRequests(new Set(data.map((f: { addressee_id: string }) => f.addressee_id)));
      });

    setLoading(false);
  }, [user, profile?.interests]);

  const handleAddFriend = async (targetId: string, targetUsername: string) => {
    if (!user) return;
    const { error } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: targetId,
      status: 'pending',
    });
    if (!error) {
      setFriendRequests(prev => new Set(prev).add(targetId));
      // Notify the other user
      await supabase.from('notifications').insert({
        user_id: targetId,
        type: 'friend_request',
        title: 'Friend Request',
        body: `@${profile?.username} wants to connect with you!`,
      });
      toast.success(`Friend request sent to @${targetUsername}`);
    }
  };

  const handleJoinRoom = (roomId: string) => {
    navigate(`/rooms/${roomId}`);
  };

  return (
    <AppLayout>
      <TopBar title="Explore" showSearch={false} />
      <div className="max-w-2xl mx-auto w-full p-4 space-y-6">
        {/* AI Picks */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-neon-purple" />
            <h2 className="font-bold text-sm">Rooms You May Like</h2>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="glass rounded-2xl h-16 animate-shimmer" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {suggestedRooms.map((room, i) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass rounded-2xl p-4 flex items-center gap-4 card-elevated"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Hash className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{room.name}</p>
                    <p className="text-xs text-muted-foreground">{room.description}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Users className="w-3 h-3" /> {room.member_count.toLocaleString()} members
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="flex-shrink-0 text-xs gradient-primary text-white border-0"
                    onClick={() => handleJoinRoom(room.id)}
                  >
                    Join
                  </Button>
                </motion.div>
              ))}
              {suggestedRooms.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No rooms found</p>
              )}
            </div>
          )}
        </section>

        {/* Suggested Friends */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-neon-pink" />
            <h2 className="font-bold text-sm">People You May Like</h2>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1,2,3,4,5,6].map(i => <div key={i} className="glass rounded-2xl h-48 animate-shimmer" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {suggestedUsers.map((u, i) => {
                const requested = friendRequests.has(u.id!);
                return (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass rounded-2xl p-4 flex flex-col items-center gap-3 card-elevated"
                  >
                    <AvatarDisplay avatarId={u.avatar_id || 'av1'} size="lg" isOnline={u.is_online} />
                    <div className="text-center space-y-1">
                      <p className="font-semibold text-sm truncate max-w-full">@{u.username}</p>
                      <LevelBadge level={u.level!} />
                      {u.state && <p className="text-xs text-muted-foreground">📍 {u.state}</p>}
                    </div>
                    {u.interests && u.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-center">
                        {u.interests.slice(0, 2).map(int => (
                          <span key={int} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{int}</span>
                        ))}
                      </div>
                    )}
                    <Button
                      size="sm"
                      className={cn(
                        'w-full text-xs gap-1 h-8 border-0',
                        requested
                          ? 'bg-muted text-muted-foreground cursor-default'
                          : 'gradient-primary text-white'
                      )}
                      onClick={() => !requested && handleAddFriend(u.id!, u.username!)}
                      disabled={requested}
                    >
                      {requested ? <><Check className="w-3 h-3" /> Requested</> : <><UserPlus className="w-3 h-3" /> Add Friend</>}
                    </Button>
                  </motion.div>
                );
              })}
              {suggestedUsers.length === 0 && (
                <div className="col-span-3 text-center py-8 text-muted-foreground text-sm">
                  No suggestions yet. Invite friends to CruiseHub!
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
