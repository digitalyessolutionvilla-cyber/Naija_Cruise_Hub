import { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Send, Trash2, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { AvatarDisplay } from '@/components/profile/AvatarDisplay';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: {
    username: string;
    avatar_id: string;
  } | null;
}

interface CommentsSheetProps {
  postId: string;
  commentCount: number;
  open: boolean;
  onClose: () => void;
  onCommentAdded?: () => void;
}

export function CommentsSheet({ postId, commentCount, open, onClose, onCommentAdded }: CommentsSheetProps) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !postId) return;
    setLoading(true);
    supabase
      .from('post_comments')
      .select('*, profile:profiles(username, avatar_id)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setComments(data as unknown as Comment[]);
        setLoading(false);
        setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
      });
  }, [open, postId]);

  const handleSend = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: postId, user_id: user.id, content: text.trim() })
      .select('*, profile:profiles(username, avatar_id)')
      .single();

    if (error) {
      toast.error('Failed to post comment');
    } else {
      setComments(prev => [...prev, data as unknown as Comment]);
      setText('');
      onCommentAdded?.();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
    setSending(false);
  };

  const handleDelete = async (commentId: string) => {
    await supabase.from('post_comments').delete().eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="h-[75vh] flex flex-col p-0 rounded-t-2xl">
        <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="w-4 h-4 text-primary" />
            {commentCount} Comments
          </SheetTitle>
        </SheetHeader>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted rounded w-24" />
                    <div className="h-4 bg-muted rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && comments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageCircle className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No comments yet. Be the first!</p>
            </div>
          )}

          {comments.map(comment => (
            <div key={comment.id} className="flex gap-3 group">
              <AvatarDisplay avatarId={comment.profile?.avatar_id || 'av1'} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="glass rounded-xl px-3 py-2">
                  <span className="text-xs font-semibold text-primary">@{comment.profile?.username || 'user'}</span>
                  <p className="text-sm mt-0.5 leading-relaxed">{comment.content}</p>
                </div>
                <div className="flex items-center gap-3 mt-1 px-1">
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                  {user?.id === comment.user_id && (
                    <button
                      className="text-[11px] text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                      onClick={() => handleDelete(comment.id)}
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {user ? (
          <div className="flex-shrink-0 px-4 py-3 border-t border-border flex gap-3 items-center">
            <AvatarDisplay avatarId={profile?.avatar_id || 'av1'} size="sm" />
            <div className="flex-1 flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Add a comment..."
                className="flex-1 h-9 px-3 bg-muted/60 rounded-full text-sm outline-none border border-transparent focus:border-primary transition-all"
              />
              <Button
                size="icon"
                className={cn('h-9 w-9 rounded-full transition-all', text.trim() ? 'gradient-primary' : 'bg-muted text-muted-foreground')}
                onClick={handleSend}
                disabled={!text.trim() || sending}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-shrink-0 px-4 py-3 border-t border-border text-center text-sm text-muted-foreground">
            Sign in to comment
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
