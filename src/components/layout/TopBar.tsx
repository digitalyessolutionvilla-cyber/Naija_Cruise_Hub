import { useNavigate } from 'react-router-dom';
import { Bell, Zap, Coins } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotificationContext } from '@/context/NotificationContext';
import { AvatarDisplay } from '@/components/profile/AvatarDisplay';
import { SearchBar } from './SearchBar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrencyAmount, toLocalCurrencyEquivalent } from '@/lib/wallet';
import { useExchangeRate } from '@/hooks/useExchangeRate';

interface TopBarProps {
  title?: string;
  showSearch?: boolean;
  className?: string;
}

export function TopBar({ title, showSearch = true, className }: TopBarProps) {
  const { profile } = useAuth();
  const { unreadCount } = useNotificationContext();
  const { rate } = useExchangeRate();
  const navigate = useNavigate();

  return (
    <header className={cn(
      'sticky top-0 z-40 border-b border-border glass-strong h-14 flex items-center gap-3 px-4',
      className
    )}>
      {/* Logo / Title */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {!title && (
          <>
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center lg:hidden">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold gradient-text lg:hidden">CruiseHub</span>
          </>
        )}
        {title && <h1 className="text-base font-bold">{title}</h1>}
      </div>

      {/* Search */}
      {showSearch && <SearchBar />}

      <div className="flex items-center gap-2 ml-auto">
        {/* Coins */}
        {profile && (
          <div className="hidden sm:flex items-center gap-2 bg-neon-gold/10 text-neon-gold border border-neon-gold/20 rounded-full px-3 py-1 text-xs font-semibold">
            <Coins className="w-3.5 h-3.5" />
            <div className="flex items-center gap-2">
              <span>{profile.coins.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground">{formatCurrencyAmount(toLocalCurrencyEquivalent(Number(profile.coins ?? 0), rate, profile.country), profile.country)}</span>
            </div>
          </div>
        )}

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          onClick={() => navigate('/notifications')}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-primary rounded-full text-[10px] font-bold text-primary-foreground flex items-center justify-center leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>

        {/* Avatar */}
        {profile && (
          <button onClick={() => navigate('/profile')}>
            <AvatarDisplay avatarId={profile.avatar_id} size="sm" isOnline={true} />
          </button>
        )}
      </div>
    </header>
  );
}
