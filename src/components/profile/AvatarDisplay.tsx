import { cn } from '@/lib/utils';
import { AVATARS } from '@/types';

interface AvatarDisplayProps {
  avatarId: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-xl',
  xl: 'w-20 h-20 text-3xl',
};

const indicatorClasses = {
  xs: 'w-2 h-2 -bottom-0.5 -right-0.5',
  sm: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5',
  md: 'w-3 h-3 bottom-0 right-0',
  lg: 'w-3.5 h-3.5 bottom-0 right-0',
  xl: 'w-4 h-4 bottom-0.5 right-0.5',
};

export function AvatarDisplay({ avatarId, size = 'md', isOnline, className }: AvatarDisplayProps) {
  const avatar = AVATARS.find(a => a.id === avatarId) || AVATARS[0];

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <div className={cn(
        'rounded-full flex items-center justify-center bg-gradient-to-br font-medium select-none',
        avatar.gradient,
        sizeClasses[size],
      )}>
        <span>{avatar.emoji}</span>
      </div>
      {isOnline !== undefined && (
        <span className={cn(
          'absolute rounded-full border-2 border-background',
          indicatorClasses[size],
          isOnline ? 'bg-neon-green' : 'bg-muted-foreground'
        )} />
      )}
    </div>
  );
}
