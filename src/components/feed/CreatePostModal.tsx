import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePosts } from '@/hooks/usePosts';
import { supabase } from '@/integrations/supabase/client';
import type { Post, PostType } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (post: Post | null) => void;
}

const POST_TYPES: { type: PostType; label: string; color: string; description: string }[] = [
  { type: 'text', label: 'Post', color: 'bg-primary/15 text-primary border-primary/30', description: 'Share your thoughts' },
  { type: 'confession', label: 'Confession', color: 'bg-pink-500/15 text-neon-pink border-pink-500/30', description: 'Anonymous confession' },
  { type: 'question', label: 'Question', color: 'bg-amber-500/15 text-neon-gold border-amber-500/30', description: 'Ask the community' },
  { type: 'meme', label: 'Meme', color: 'bg-green-500/15 text-neon-green border-green-500/30', description: 'Share the laughs' },
  { type: 'story', label: 'Story', color: 'bg-cyan-500/15 text-neon-blue border-cyan-500/30', description: 'Share a quick visual update' },
];

const MAX_CHARS = 280;
const MAX_MEDIA_SIZE_MB = 25;
const POST_MEDIA_BUCKET = 'post-media';

function isMediaType(type: PostType): boolean {
  return type === 'meme' || type === 'story';
}

function isSupportedFile(file: File): boolean {
  return file.type.startsWith('image/') || file.type.startsWith('video/');
}

function getExtension(file: File): string {
  const extFromName = file.name.split('.').pop()?.toLowerCase();
  if (extFromName) return extFromName;
  if (file.type.startsWith('image/')) return 'jpg';
  if (file.type.startsWith('video/')) return 'mp4';
  return 'bin';
}

export function CreatePostModal({ open, onClose, onCreated }: CreatePostModalProps) {
  const [content, setContent] = useState('');
  const [type, setType] = useState<PostType>('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { createPost } = usePosts();

  const handleMediaFileChange = (file: File | null) => {
    if (!file) {
      setMediaFile(null);
      return;
    }

    if (!isSupportedFile(file)) {
      toast.error('Please choose an image or video file.');
      return;
    }

    if (file.size > MAX_MEDIA_SIZE_MB * 1024 * 1024) {
      toast.error(`Media must be ${MAX_MEDIA_SIZE_MB}MB or less.`);
      return;
    }

    setMediaFile(file);
  };

  const uploadMediaIfNeeded = async (): Promise<string | null> => {
    if (!mediaFile) {
      return mediaUrl.trim() ? mediaUrl.trim() : null;
    }

    setUploading(true);

    const ext = getExtension(mediaFile);
    const filePath = `posts/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(POST_MEDIA_BUCKET)
      .upload(filePath, mediaFile, {
        cacheControl: '3600',
        upsert: false,
      });

    setUploading(false);

    if (uploadError) {
      throw new Error(uploadError.message || 'Upload failed');
    }

    const { data } = supabase.storage.from(POST_MEDIA_BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    const hasText = !!content.trim();
    const hasMedia = !!mediaFile || !!mediaUrl.trim();
    const requiresMediaOption = isMediaType(type);

    if (!hasText && !hasMedia) return;
    if (!requiresMediaOption && !hasText) return;

    setSubmitting(true);

    let finalMediaUrl: string | null = null;
    try {
      finalMediaUrl = requiresMediaOption ? await uploadMediaIfNeeded() : null;
    } catch (error) {
      setSubmitting(false);
      const msg = error instanceof Error ? error.message : 'Media upload failed';
      toast.error(`Media upload failed: ${msg}`);
      return;
    }

    const { error, post } = await createPost({
      content: content.trim() || (type === 'story' ? 'New story' : type === 'meme' ? 'New meme' : ''),
      type,
      is_anonymous: type === 'confession' ? true : isAnonymous,
      image_url: finalMediaUrl,
    });

    setSubmitting(false);

    if (error) {
      toast.error(`Failed to post: ${error.message || 'Try again.'}`);
    } else {
      toast.success('+10 XP earned for posting!');
      setContent('');
      setType('text');
      setMediaUrl('');
      setMediaFile(null);
      setIsAnonymous(false);
      onCreated(post ?? null);
      onClose();
    }
  };

  const remaining = MAX_CHARS - content.length;
  const activeTypeConfig = POST_TYPES.find(pt => pt.type === type)!;
  const hasText = !!content.trim();
  const hasMedia = !!mediaFile || !!mediaUrl.trim();
  const canSubmit = isMediaType(type) ? (hasText || hasMedia) : hasText;

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

          {/* Media URL / Upload for Meme/Story */}
          {isMediaType(type) && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Upload image or video (or paste URL)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*,video/*"
                  onChange={e => handleMediaFileChange(e.target.files?.[0] ?? null)}
                  className="bg-muted/30 border-border text-sm"
                />
                {mediaFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setMediaFile(null)}
                    title="Remove selected file"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {mediaFile && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{mediaFile.name}</span>
                </div>
              )}
              <Input
                value={mediaUrl}
                onChange={e => setMediaUrl(e.target.value)}
                placeholder="https://... (jpg, png, webp, mp4, webm)"
                className="bg-muted/30 border-border text-sm"
              />
            </div>
          )}

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
              disabled={submitting || uploading || !canSubmit}
              onClick={handleSubmit}
            >
              {uploading ? 'Uploading...' : submitting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
