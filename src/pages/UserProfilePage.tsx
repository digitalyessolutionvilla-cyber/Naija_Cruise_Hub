import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, UserPlus, UserCheck, ArrowLeft, Shield, Star } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { TopBar } from '@/components/layout/TopBar';
import { AvatarDisplay } from '@/components/profile/AvatarDisplay';
import { XPBar, LevelBadge } from '@/components/profile/XPBar';
import { PostCard } from '@/components/feed/PostCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, Post, UserLevel } from '@/types';
import { getLevelNumber } from '@/types';
import { toast } from 'sonner';

interface PublicProfile extends Profile {
  level: UserLevel;
}

export function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user, profile: ownProfile } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequested, setFriendRequested] = useState(false);
  const [friendLoading, setFriendLoading] = useState(false);

  // Redirect to own profile
  useEffect(() => {
    if (userId && user && userId === user.id) {
      navigate('/profile', { replace: true });
    }
  }, [userId, user, navigate]);

  useEffect(() => {
    if (!userId) return;

    const fetchAll = async () => {
      setLoading(true);
      const [{ data: profileData }, { data: postsData }, { data: friendData }, { data: requestedData }] =
        await Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).single(),
          supabase
            .from('posts')
            .select('*, profile:profiles(username, avatar_id, level)')
            .eq('user_id', userId)
            .eq('is_anonymous', false)
            .order('created_at', { ascending: false })
            .limit(20),
          user
            ? supabase
                .from('friendships')
                .select('id')
                .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`)
                .eq('status', 'accepted')
                .maybeSingle()
            : Promise.resolve({ data: null }),
          user
            ? supabase
                .from('friendships')
                .select('id')
                .eq('user_id', user.id)
                .eq('friend_id', userId)
                .eq('status', 'pending')
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

      if (profileData) setProfile(profileData as PublicProfile);
      if (postsData) setPosts(postsData as Post[]);
      setIsFriend(!!friendData);
      setFriendRequested(!!requestedData);
      setLoading(false);
    };

    fetchAll();
  }, [userId, user]);

  const handleAddFriend = async () => {
    if (!user || !userId || !profile) return;
    setFriendLoading(true);
    const { error } = await supabase
      .from('friendships')
      .insert({ user_id: user.id, friend_id: userId, status: 'pending' });
    if (!error) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'friend_request',
        title: `@${ownProfile?.username} sent you a friend request`,
        body: 'Tap to view their profile',
      });
      setFriendRequested(true);
      toast.success('Friend request sent!');
    }
    setFriendLoading(false);
  };

  const handleMessage = () => {
    if (profile) navigate(`/messages?with=${userId}`);
  };

  if (loading) {
    return (
      <AppLayout>
        <TopBar showSearch={false} />
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          <div className="h-48 bg-muted/30 rounded-2xl animate-pulse" />
          <div className="h-24 bg-muted/30 rounded-2xl animate-pulse" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <TopBar showSearch={false} />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Shield className="w-16 h-16 text-muted-foreground/30" />
          <p className="text-muted-foreground">User not found</p>
          <Button variant="ghost" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </AppLayout>
    );
  }

  const levelNumber = getLevelNumber(profile.xp);

  return (
    <AppLayout>
      <TopBar showSearch={false} />

      <div className="max-w-2xl mx-auto w-full">
        {/* Banner */}
        <div className="relative h-44 gradient-primary overflow-hidden">
          <div className="absolute inset-0 opacity-30"
            style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, hsl(var(--neon-purple)) 0%, transparent 60%), radial-gradient(circle at 70% 60%, hsl(var(--neon-pink)) 0%, transparent 60%)' }}
          />
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Online indicator */}
          {profile.is_online && (
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/30 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
              <span className="text-white text-xs font-medium">Online</span>
            </div>
          )}
        </div>

        {/* Avatar overlapping banner */}
        <div className="px-4 -mt-16 pb-4">
          <div className="flex items-end justify-between mb-3">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-background overflow-hidden">
                <AvatarDisplay avatarId={profile.avatar_id} size="xl" />
              </div>
              <div className="absolute -bottom-1 -right-1 glass rounded-full px-2 py-0.5 text-xs font-bold gradient-text border border-primary/20">
                Lv.{levelNumber}
              </div>
            </div>

            {/* Action buttons */}
            {user && user.id !== userId && (
              <div className="flex gap-2 mb-1">
                {isFriend && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={handleMessage}>
                    <MessageSquare className="w-4 h-4" /> Message
                  </Button>
                )}
                {!isFriend && !friendRequested && (
                  <Button size="sm" className="gradient-primary gap-1.5 text-white" onClick={handleAddFriend} disabled={friendLoading}>
                    <UserPlus className="w-4 h-4" /> Add Friend
                  </Button>
                )}
                {friendRequested && (
                  <Button size="sm" variant="outline" disabled className="gap-1.5 text-muted-foreground">
                    <UserCheck className="w-4 h-4" /> Requested
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* User info */}
          <div className="space-y-1 mb-4">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">@{profile.username}</h1>
              <LevelBadge level={profile.level} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Star className="w-3 h-3" />{profile.xp.toLocaleString()} XP</span>
              <span>{profile.friends_count} friends</span>
              <span>{profile.posts_count} posts</span>
            </div>
            {profile.bio && (
              <p className="text-sm text-muted-foreground mt-2">{profile.bio}</p>
            )}
          </div>

          {/* XP Bar */}
          <div className="glass rounded-xl p-3 mb-4">
            <XPBar xp={profile.xp} level={profile.level} />
          </div>

          {/* Posts */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Posts</h2>
            {posts.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No public posts yet
              </div>
            ) : (
              posts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <PostCard post={post} />
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
