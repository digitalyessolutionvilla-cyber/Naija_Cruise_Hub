import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useXP } from '@/hooks/useXP';
import type { Post, PostType } from '@/types';

export function usePosts() {
  const { user } = useAuth();
  const { awardXP } = useXP();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const fetchPosts = useCallback(async (tab: 'trending' | 'recent' = 'recent'): Promise<Post[]> => {
    const query = supabase
      .from('posts')
      .select('*, profile:profiles(id, username, avatar_id, level, is_online)')
      .limit(30);

    if (tab === 'trending') {
      query.order('likes_count', { ascending: false });
    } else {
      query.order('created_at', { ascending: false });
    }

    const { data } = await query;
    return (data || []) as unknown as Post[];
  }, []);

  const fetchLikedIds = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', user.id);
    if (data) {
      setLikedIds(new Set(data.map((r: { post_id: string }) => r.post_id)));
    }
  }, [user]);

  const likePost = useCallback(async (postId: string): Promise<boolean> => {
    if (!user) return false;
    const isLiked = likedIds.has(postId);

    if (isLiked) {
      await supabase.from('post_likes').delete()
        .eq('post_id', postId).eq('user_id', user.id);
      setLikedIds(prev => { const s = new Set(prev); s.delete(postId); return s; });
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      setLikedIds(prev => new Set(prev).add(postId));
    }
    return !isLiked;
  }, [user, likedIds]);

  const createPost = useCallback(async (data: {
    content: string;
    type: PostType;
    is_anonymous: boolean;
  }) => {
    if (!user) return { error: new Error('Not authenticated') };
    const { error } = await supabase.from('posts').insert({
      ...data,
      user_id: user.id,
    });
    if (!error) {
      await awardXP('create_post');
    }
    return { error };
  }, [user, awardXP]);

  return { fetchPosts, fetchLikedIds, likedIds, likePost, createPost };
}
