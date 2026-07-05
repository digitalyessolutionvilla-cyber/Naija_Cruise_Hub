import { NavLink, useNavigate } from 'react-router-dom';
import { Home, MessageSquare, Users, Bell, User, Zap, Coins, LogOut, Moon, Sun, Hash, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotificationContext } from '@/context/NotificationContext';
import { useOnlineStatus } from '@/hooks/useRealtime';
import { AvatarDisplay } from '@/components/profile/AvatarDisplay';
import { XPBar, LevelBadge } from '@/components/profile/XPBar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { formatCurrencyAmount, toLocalCurrencyEquivalent } from '@/lib/wallet';
import { useExchangeRate } from '@/hooks/useExchangeRate';

const navItems = [
  { to: '/home', icon: Home, label: 'Home' },
  { to: '/rooms', icon: Hash, label: 'Chat Rooms' },
  { to: '/explore', icon: Users, label: 'Explore' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/wallet', icon: Wallet, label: 'Wallet' },
  { to: '/profile', icon: User, label: 'My Profile' },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { unreadCount } = useNotificationContext();
  const { rate } = useExchangeRate();

  // Keep online status alive
  useOnlineStatus(profile?.id);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 border-r border-border bg-sidebar p-4 gap-4 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-2 px-2 py-2">
        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shadow-glow-purple">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold gradient-text">CruiseHub</span>
      </div>

      {/* Profile snippet */}
      {profile && (
        <div className="glass rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-3">
            <AvatarDisplay avatarId={profile.avatar_id} size="md" isOnline={true} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">@{profile.username}</p>
              <LevelBadge level={profile.level} />
            </div>
          </div>
          <XPBar xp={profile.xp} level={profile.level} />
          <div className="flex items-center gap-1.5 text-xs text-neon-gold font-medium">
            <Coins className="w-3.5 h-3.5" />
            <span>{profile.coins.toLocaleString()} Coins</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {formatCurrencyAmount(toLocalCurrencyEquivalent(Number(profile.coins ?? 0), rate, profile.country), profile.country)} equivalent
          </p>
        </div>
      )}

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-smooth relative',
              isActive
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {label}
            {label === 'Notifications' && unreadCount > 0 && (
              <span className="ml-auto w-5 h-5 rounded-full gradient-primary text-white text-[10px] flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <Separator />

      <div className="space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-destructive hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
