import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Trash2, Flag } from 'lucide-react';
import type { Post } from '@/types';
import { AvatarDisplay } from '@/components/profile/AvatarDisplay';
import { LevelBadge } from '@/components/profile/XPBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { usePosts } from '@/hooks/usePosts';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { CommentsSheet } from './CommentsSheet';
import { ShareSheet } from './ShareSheet';
import { supabase } from '@/integrations/supabase/client';

interface PostCardProps {
  post: Post;
  isLiked?: boolean;
  className?: string;
  onDeleted?: (postId: string) => void;
}

const typeStyles: Record<string, { border: string; badge: string; label: string }> = {
  confession: { border: 'border-l-4 border-l-neon-pink', badge: 'bg-neon-pink/15 text-neon-pink border-neon-pink/20', label: 'Confession' },
  poll:       { border: 'border-l-4 border-l-neon-blue', badge: 'bg-neon-blue/15 text-neon-blue border-neon-blue/20',   label: 'Poll' },
  question:   { border: 'border-l-4 border-l-neon-gold', badge: 'bg-neon-gold/15 text-neon-gold border-neon-gold/20',   label: 'Question' },
  meme:       { border: 'border-l-4 border-l-neon-green', badge: 'bg-neon-green/15 text-neon-green border-neon-green/20', label: 'Meme' },
  text:       { border: '', badge: '', label: '' },
};

export function PostCard({ post, isLiked = false, className, onDeleted }: PostCardProps) {
  const { user } = useAuth();
  const { likePost } = usePosts();
  const [liked, setLiked] = useState(isLiked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [bookmarked, setBookmarked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const isOwn = user?.id === post.user_id;

  const handleLike = async () => {
    if (!user) { toast.error('Sign in to like posts'); return; }
    if (liking) return;
    setLiking(true);
    const nowLiked = !liked;
    setLiked(nowLiked);
    setLikesCount(prev => prev + (nowLiked ? 1 : -1));
    const result = await likePost(post.id);
    if (result !== nowLiked) {
      setLiked(!nowLiked);
      setLikesCount(prev => prev + (!nowLiked ? 1 : -1));
    }
    setLiking(false);
  };

  const handleDelete = async () => {
    if (!isOwn) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (error) {
      toast.error('Failed to delete post');
    } else {
      toast.success('Post deleted');
      onDeleted?.(post.id);
    }
  };

  const handleReport = () => {
    toast.success('Report submitted. Our team will review this post.');
  };

  const style = typeStyles[post.type] || typeStyles.text;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <>
      <div className={cn(
        'glass rounded-2xl p-4 space-y-3 card-elevated',
        style.border,
        className
      )}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {post.is_anonymous ? (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground flex-shrink-0">
                ?
              </div>
            ) : (
              post.profile && (
                <AvatarDisplay avatarId={post.profile.avatar_id || 'av1'} size="md" />
              )
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">
                  {post.is_anonymous ? 'Anonymous' : `@${post.profile?.username || 'user'}`}
                </span>
                {!post.is_anonymous && post.profile?.level && (
                  <LevelBadge level={post.profile.level} />
                )}
              </div>
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {style.label && (
              <Badge variant="outline" className={cn('text-xs', style.badge)}>
                {style.label}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {isOwn ? (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive gap-2"
                    onClick={handleDelete}
                  >
                    <Trash2 className="w-4 h-4" /> Delete Post
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem className="gap-2 text-muted-foreground" onClick={handleReport}>
                    <Flag className="w-4 h-4" /> Report Post
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <p className="text-sm leading-relaxed">{post.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-1 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-1.5 h-8 text-xs transition-smooth', liked ? 'text-neon-pink' : 'text-muted-foreground')}
            onClick={handleLike}
            disabled={liking}
          >
            <Heart className={cn('w-4 h-4 transition-transform', liked && 'fill-current scale-110')} />
            {likesCount > 0 && <span>{likesCount}</span>}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-primary"
            onClick={() => setShowComments(true)}
          >
            <MessageCircle className="w-4 h-4" />
            {commentsCount > 0 && <span>{commentsCount}</span>}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-primary"
            onClick={() => setShowShare(true)}
          >
            <Share2 className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn('ml-auto h-8 text-xs', bookmarked ? 'text-neon-gold' : 'text-muted-foreground')}
            onClick={() => {
              setBookmarked(p => !p);
              toast.success(bookmarked ? 'Removed from saved' : 'Post saved!');
            }}
          >
            <Bookmark className={cn('w-4 h-4', bookmarked && 'fill-current')} />
          </Button>
        </div>
      </div>

      <CommentsSheet
        postId={post.id}
        commentCount={commentsCount}
        open={showComments}
        onClose={() => setShowComments(false)}
        onCommentAdded={() => setCommentsCount(p => p + 1)}
      />

      <ShareSheet
        postId={post.id}
        content={post.content}
        open={showShare}
        onClose={() => setShowShare(false)}
      />
    </>
  );
}
