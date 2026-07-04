import { Link2, Share2, MessageCircle, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';

interface ShareSheetProps {
  postId: string;
  content: string;
  open: boolean;
  onClose: () => void;
}

const shareOptions = [
  {
    icon: Link2,
    label: 'Copy Link',
    description: 'Copy post link to clipboard',
    color: 'text-neon-blue',
    bg: 'bg-neon-blue/10',
    action: (postId: string) => {
      navigator.clipboard.writeText(`${window.location.origin}/posts/${postId}`);
      toast.success('Link copied to clipboard!');
    },
  },
  {
    icon: MessageCircle,
    label: 'Share via DM',
    description: 'Send to a friend in a private message',
    color: 'text-neon-purple',
    bg: 'bg-neon-purple/10',
    action: (_postId: string, content: string) => {
      toast.info('Open a conversation and paste the link to share');
      navigator.clipboard.writeText(`${window.location.origin}/posts/${_postId}\n${content.slice(0, 80)}...`);
    },
  },
  {
    icon: Users,
    label: 'Share to Feed',
    description: 'Repost to your timeline',
    color: 'text-neon-green',
    bg: 'bg-neon-green/10',
    action: () => {
      toast.info('Repost feature coming soon!');
    },
  },
  {
    icon: Share2,
    label: 'More Options',
    description: 'Share via WhatsApp, Telegram, X...',
    color: 'text-neon-pink',
    bg: 'bg-neon-pink/10',
    action: (postId: string, content: string) => {
      const url = `${window.location.origin}/posts/${postId}`;
      const text = content.slice(0, 100);
      if (navigator.share) {
        navigator.share({ title: 'CruiseHub Post', text, url }).catch(() => {});
      } else {
        navigator.clipboard.writeText(url);
        toast.success('Link copied!');
      }
    },
  },
];

export function ShareSheet({ postId, content, open, onClose }: ShareSheetProps) {
  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            Share Post
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-2">
          {shareOptions.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.label}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-muted/60 transition-colors text-left"
                onClick={() => {
                  opt.action(postId, content);
                  onClose();
                }}
              >
                <div className={`w-10 h-10 rounded-xl ${opt.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${opt.color}`} />
                </div>
                <div>
                  <div className="font-semibold text-sm">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
