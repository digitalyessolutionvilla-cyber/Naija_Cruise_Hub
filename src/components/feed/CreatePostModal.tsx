import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePosts } from '@/hooks/usePosts';
import type { PostType } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const POST_TYPES: { type: PostType; label: string; color: string; description: string }[] = [
  { type: 'text',       label: 'Post',       color: 'bg-primary/15 text-primary border-primary/30',       description: 'Share your thoughts' },
  { type: 'confession', label: 'Confession', color: 'bg-pink-500/15 text-neon-pink border-pink-500/30',    description: 'Anonymous confession' },
  { type: 'question',   label: 'Question',   color: 'bg-amber-500/15 text-neon-gold border-amber-500/30',  description: 'Ask the community' },
  { type: 'meme',       label: 'Meme',       color: 'bg-green-500/15 text-neon-green border-green-500/30', description: 'Share the laughs' },
];

const MAX_CHARS = 280;

export function CreatePostModal({ open, onClose, onCreated }: CreatePostModalProps) {
  const [content, setContent] = useState('');
  const [type, setType] = useState<PostType>('text');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { createPost } = usePosts();

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    const { error } = await createPost({
      content: content.trim(),
      type,
      is_anonymous: type === 'confession' ? true : isAnonymous,
    });
    setSubmitting(false);
    if (error) {
      toast.error('Failed to post. Try again.');
    } else {
      toast.success('+10 XP earned for posting!');
      setContent('');
      setType('text');
      setIsAnonymous(false);
      onCreated();
      onClose();
    }
  };

  const remaining = MAX_CHARS - content.length;
  const activeTypeConfig = POST_TYPES.find(pt => pt.type === type)!;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="glass border-border max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            Create a Post
            <span className="text-xs font-normal text-muted-foreground">+10 XP</span>
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Post type selector */}
          <div className="flex gap-2 flex-wrap">
            {POST_TYPES.map(pt => (
              <button
                key={pt.type}
                onClick={() => {
                  setType(pt.type);
                  if (pt.type === 'confession') setIsAnonymous(true);
                }}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold border transition-smooth',
                  type === pt.type ? pt.color : 'bg-muted/40 text-muted-foreground border-border hover:border-primary/30'
                )}
              >
                {pt.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="space-y-1">
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value.slice(0, MAX_CHARS))}
              placeholder={activeTypeConfig.description + '...'}
              className="min-h-[120px] bg-muted/30 border-border resize-none text-sm"
              autoFocus
            />
            <div className="flex justify-end">
              <span className={cn('text-xs', remaining < 30 ? 'text-destructive' : 'text-muted-foreground')}>
                {remaining}
              </span>
            </div>
          </div>

          {/* Anonymous toggle (not for confessions — always anon) */}
          {type !== 'confession' && (
            <div className="flex items-center gap-3 bg-muted/30 rounded-xl px-4 py-3">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <Label className="text-sm font-medium cursor-pointer">Post Anonymously</Label>
                <p className="text-xs text-muted-foreground">Hide your identity from this post</p>
              </div>
              <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
            </div>
          )}

          {type === 'confession' && (
            <div className="flex items-center gap-2 text-xs text-neon-pink bg-neon-pink/10 rounded-xl px-4 py-3">
              <Lock className="w-3.5 h-3.5" />
              Confessions are always anonymous
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="flex-1 gradient-primary text-white border-0 shadow-glow-purple"
              disabled={!content.trim() || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
