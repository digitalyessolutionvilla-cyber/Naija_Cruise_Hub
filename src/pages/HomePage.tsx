import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, TrendingUp, Users, Hash, FileText, Clock, Star, Image, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { TopBar } from '@/components/layout/TopBar';
import { StoriesRow } from '@/components/feed/StoriesRow';
import { PostCard } from '@/components/feed/PostCard';
import { CreatePostModal } from '@/components/feed/CreatePostModal';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePosts } from '@/hooks/usePosts';
import type { Post, ChatRoom } from '@/types';
import { XPBar, LevelBadge } from '@/components/profile/XPBar';
import { AvatarDisplay } from '@/components/profile/AvatarDisplay';
import { cn } from '@/lib/utils';

type FeedTab = 'foryou' | 'trending' | 'recent' | 'memes';

interface StoryUser {
  id: string;
  username: string;
  avatar_id: string;
  is_online: boolean;
}

interface ActiveAd {
  id: string;
  title: string;
  media_url: string;
  media_type: 'image' | 'video';
  destination_url: string | null;
  placement: string;
  display_frequency: number;
}

const TABS: { id: FeedTab; label: string; icon: typeof TrendingUp }[] = [
  { id: 'foryou', label: 'For You', icon: Star },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'memes', label: 'Memes', icon: Image },
];

const PAGE_SIZE = 10;

export function HomePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { fetchPosts, fetchLikedIds, likedIds } = usePosts();
  const [posts, setPosts] = useState<Post[]>([]);
  const [storyUsers, setStoryUsers] = useState<StoryUser[]>([]);
  const [trendingRooms, setTrendingRooms] = useState<ChatRoom[]>([]);
  const [activeTab, setActiveTab] = useState<FeedTab>('foryou');
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const [activeAd, setActiveAd] = useState<ActiveAd | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const loadPosts = useCallback(async (tab: FeedTab, pageNum = 0, append = false) => {
    if (pageNum === 0) setLoadingPosts(true);
    else setLoadingMore(true);

    let query = supabase
      .from('posts')
      .select('*')
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (tab === 'memes') {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query
        .in('type', ['meme', 'story'])
        .gte('created_at', since);
    } else if (tab === 'trending') {
      query = query
        .order('likes_count', { ascending: false })
        .order('comments_count', { ascending: false })
        .order('created_at', { ascending: false, nullsFirst: false });
    } else if (tab === 'foryou') {
      // For You: all posts, newest first for maximum visibility.
      query = query
        .order('created_at', { ascending: false, nullsFirst: false });
    } else {
      query = query.order('created_at', { ascending: false, nullsFirst: false });
    }

    if (tab !== 'foryou' && tab !== 'trending') {
      query = query.order('created_at', { ascending: false, nullsFirst: false });
    }

    const { data, error } = await query;
    if (error) {
      setLoadingPosts(false);
      setLoadingMore(false);
      return;
    }
    const fetched = (data ?? []) as Post[];

    if (append) {
      setPosts(prev => {
        const ids = new Set(prev.map(p => p.id));
        return [...prev, ...fetched.filter(p => !ids.has(p.id))];
      });
    } else {
      setPosts(fetched);
    }

    setHasMore(fetched.length === PAGE_SIZE);
    setLoadingPosts(false);
    setLoadingMore(false);
  }, []);

  // Reset on tab change
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    setNewPostsAvailable(false);
    loadPosts(activeTab, 0, false);
  }, [activeTab, loadPosts]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loadingPosts) {
        const nextPage = page + 1;
        setPage(nextPage);
        loadPosts(activeTab, nextPage, true);
      }
    }, { threshold: 0.1 });
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadingPosts, page, activeTab, loadPosts]);

  // Realtime: new posts + interaction count sync
  useEffect(() => {
    const channel = supabase
      .channel('home-posts-realtime')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'posts',
      }, (payload) => {
        const newPost = payload.new as Post;
        const isMemesTabMatch = activeTab === 'memes'
          ? ['meme', 'story'].includes(String(newPost.type)) &&
            new Date(String(newPost.created_at)).getTime() >= Date.now() - 24 * 60 * 60 * 1000
          : true;

        if (isMemesTabMatch) {
          setNewPostsAvailable(true);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'posts',
      }, (payload) => {
        const updated = payload.new as Post;
        setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'posts',
      }, (payload) => {
        const removed = payload.old as { id?: string };
        if (!removed?.id) return;
        setPosts((prev) => prev.filter((p) => p.id !== removed.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTab]);

  useEffect(() => {
    fetchLikedIds();

    supabase
      .from('profiles')
      .select('id, username, avatar_id, is_online')
      .eq('is_online', true)
      .neq('id', profile?.id || '')
      .limit(10)
      .then(({ data }) => { if (data) setStoryUsers(data as StoryUser[]); });

    supabase
      .from('chat_rooms')
      .select('*')
      .eq('is_active', true)
      .order('member_count', { ascending: false })
      .limit(3)
      .then(({ data }) => { if (data) setTrendingRooms(data as ChatRoom[]); });

    const fetchActiveAd = async () => {
      const { data } = await (supabase as any).rpc('get_active_ads', { p_placement: 'homepage_banner' });
      if (data && data.length > 0) {
        const ad = data[0] as ActiveAd;
        setActiveAd(ad);
        await (supabase as any).rpc('track_ad_event', {
          p_campaign_id: ad.id,
          p_event_type: 'impression',
          p_session_id: null,
        });
      } else {
        setActiveAd(null);
      }
    };

    fetchActiveAd();
  }, [profile?.id, fetchLikedIds]);

  const handleRefresh = () => {
    setNewPostsAvailable(false);
    setPage(0);
    loadPosts(activeTab, 0, false);
  };

  const handlePostDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  return (
    <AppLayout>
      <TopBar />

      {activeAd && (
        <div className="max-w-6xl mx-auto w-full px-4 pt-2">
          <a
            href={activeAd.destination_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl overflow-hidden border border-border bg-card"
            onClick={async () => {
              await (supabase as any).rpc('track_ad_event', {
                p_campaign_id: activeAd.id,
                p_event_type: 'click',
                p_session_id: null,
              });
            }}
          >
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
              Sponsored
            </div>
            {activeAd.media_type === 'video' ? (
              <video
                src={activeAd.media_url}
                className="w-full max-h-56 object-cover"
                controls
                muted
              />
            ) : (
              <img
                src={activeAd.media_url}
                alt={activeAd.title}
                className="w-full max-h-56 object-cover"
              />
            )}
          </a>
        </div>
      )}

      {/* New Posts Banner */}
      <AnimatePresence>
        {newPostsAvailable && (
          <motion.button
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            onClick={handleRefresh}
            className="sticky top-14 z-30 mx-auto flex items-center gap-2 mt-2 px-4 py-2 rounded-full gradient-primary text-white text-sm font-semibold shadow-glow-purple left-1/2 -translate-x-1/2 absolute"
            style={{ position: 'fixed', top: '64px', left: '50%', transform: 'translateX(-50%)' }}
          >
            <RefreshCw className="w-4 h-4" /> New posts available
          </motion.button>
        )}
      </AnimatePresence>

      <div className="flex gap-6 max-w-6xl mx-auto w-full p-4">
        {/* Main feed */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Welcome / XP banner */}
          {profile && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-4 neon-border"
            >
              <div className="flex items-center gap-3 mb-3">
                <AvatarDisplay avatarId={profile.avatar_id} size="md" isOnline={true} />
                <div>
                  <p className="font-semibold text-sm">GM, @{profile.username}!</p>
                  <div className="flex items-center gap-2">
                    <LevelBadge level={profile.level} />
                    <span className="text-xs text-muted-foreground">{profile.xp.toLocaleString()} XP</span>
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-muted-foreground">Login streak</p>
                  <p className="text-sm font-bold text-neon-gold">
                    {profile.login_streak > 0 ? `${profile.login_streak} days` : 'Start today!'}
                  </p>
                </div>
              </div>
              <XPBar xp={profile.xp} level={profile.level} showLabel={false} />
            </motion.div>
          )}

          {/* Active Cruisers */}
          {storyUsers.length > 0 && (
            <div className="glass rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                Active Cruisers
              </p>
              <StoriesRow users={storyUsers} />
            </div>
          )}

          {/* Feed Tabs */}
          <div className="flex gap-1 glass rounded-xl p-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
                    activeTab === tab.id
                      ? 'bg-primary/20 text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.id === 'memes' ? 'Memes/Story' : tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Posts */}
          {loadingPosts ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="glass rounded-2xl h-36 animate-pulse bg-muted/30" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">No posts yet</p>
              <p className="text-sm text-muted-foreground">Be the first to post something!</p>
              <button
                onClick={() => setShowCreatePost(true)}
                className="text-primary text-sm font-medium underline"
              >
                Create the first post
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.25) }}
                >
                  <PostCard
                    post={post}
                    isLiked={likedIds.has(post.id)}
                    onDeleted={handlePostDeleted}
                  />
                </motion.div>
              ))}

              {/* Infinite scroll loader */}
              <div ref={loaderRef} className="h-10 flex items-center justify-center">
                {loadingMore && (
                  <div className="flex gap-2">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                )}
                {!hasMore && posts.length > 0 && (
                  <p className="text-xs text-muted-foreground">You&apos;ve seen all posts</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar (desktop only) */}
        <div className="hidden xl:flex flex-col gap-4 w-72 flex-shrink-0">
          {/* Trending Rooms */}
          {trendingRooms.length > 0 && (
            <div className="glass rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Trending Rooms
              </p>
              {trendingRooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => navigate(`/rooms/${room.id}`)}
                  className="flex items-center gap-3 hover:bg-muted/50 rounded-xl p-2 w-full transition-smooth"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Hash className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">{room.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> {room.member_count.toLocaleString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Create post CTA */}
          <div className="glass rounded-2xl p-4 neon-border space-y-2">
            <p className="text-sm font-semibold">Share Something</p>
            <p className="text-xs text-muted-foreground">Post to the community and earn 10 XP!</p>
            <button
              onClick={() => setShowCreatePost(true)}
              className="w-full mt-2 py-2 rounded-xl gradient-primary text-white text-xs font-semibold"
            >
              Create Post
            </button>
          </div>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowCreatePost(true)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 w-14 h-14 rounded-full gradient-primary text-white shadow-glow-purple flex items-center justify-center z-30 hover:opacity-90 transition-opacity active:scale-95"
      >
        <Plus className="w-7 h-7" />
      </button>

      <CreatePostModal
        open={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onCreated={(newPost) => {
          setNewPostsAvailable(false);
          setPage(0);
          setActiveTab('foryou');
          if (newPost) {
            setPosts(prev => {
              const withoutDup = prev.filter(p => p.id !== newPost.id);
              return [newPost, ...withoutDup];
            });
          }
          loadPosts('foryou', 0, false);
        }}
      />
    </AppLayout>
  );
}
