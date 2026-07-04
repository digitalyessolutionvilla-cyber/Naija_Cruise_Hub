import { cn } from '@/lib/utils';
import { LEVELS, getLevelFromXP, getNextLevelXP, type UserLevel } from '@/types';

interface XPBarProps {
  xp: number;
  level: UserLevel;
  className?: string;
  showLabel?: boolean;
}

export function XPBar({ xp, level, className, showLabel = true }: XPBarProps) {
  const currentLevelConfig = LEVELS.find(l => l.name === level) || LEVELS[0];
  const nextLevelXP = getNextLevelXP(xp);
  const currentMinXP = currentLevelConfig.minXP;

  const progress = nextLevelXP > currentMinXP
    ? Math.min(100, ((xp - currentMinXP) / (nextLevelXP - currentMinXP)) * 100)
    : 100;

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs">
          <span className={cn('font-semibold', currentLevelConfig.color)}>{level}</span>
          {nextLevelXP > xp && (
            <span className="text-muted-foreground">{xp.toLocaleString()} / {nextLevelXP.toLocaleString()} XP</span>
          )}
        </div>
      )}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progress}%`, background: 'var(--gradient-primary)' }}
        />
      </div>
    </div>
  );
}

interface LevelBadgeProps {
  level: UserLevel;
  className?: string;
}

export function LevelBadge({ level, className }: LevelBadgeProps) {
  const levelConfig = LEVELS.find(l => l.name === level) || LEVELS[0];

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
      levelConfig.badge,
      levelConfig.color,
      'border-current/20',
      className
    )}>
      {level}
    </span>
  );
}
