import { formatDistanceToNow } from 'date-fns';
import { RoomMessage } from '@/types';
import { AvatarDisplay } from '@/components/profile/AvatarDisplay';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: RoomMessage;
  isOwn?: boolean;
}

export function ChatMessage({ message, isOwn }: ChatMessageProps) {
  const timeAgo = formatDistanceToNow(new Date(message.created_at), { addSuffix: true });

  if (isOwn) {
    return (
      <div className="flex items-end gap-2 justify-end animate-fade-in">
        <div className="max-w-[75%] space-y-1">
          <div className="gradient-primary rounded-2xl rounded-br-md px-4 py-2.5 text-white text-sm shadow-glow-purple">
            {message.content}
          </div>
          <p className="text-[10px] text-muted-foreground text-right pr-1">{timeAgo}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 animate-fade-in">
      {message.profile && (
        <AvatarDisplay avatarId={message.profile.avatar_id} size="sm" className="flex-shrink-0 mt-0.5" />
      )}
      <div className="max-w-[75%] space-y-0.5">
        <span className="text-xs font-medium text-primary px-1">
          @{message.profile?.username || 'user'}
        </span>
        <div className="glass rounded-2xl rounded-tl-md px-4 py-2.5 text-sm">
          {message.content}
        </div>
        <p className="text-[10px] text-muted-foreground pl-1">{timeAgo}</p>
      </div>
    </div>
  );
}
