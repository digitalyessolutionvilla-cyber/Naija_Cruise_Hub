import { NavLink } from 'react-router-dom';
import { Home, Hash, Users, MessageSquare, User, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/home', icon: Home, label: 'Home' },
  { to: '/rooms', icon: Hash, label: 'Rooms' },
  { to: '/explore', icon: Users, label: 'Explore' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/wallet', icon: Wallet, label: 'Wallet' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border glass-strong">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-smooth',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'w-10 h-6 flex items-center justify-center rounded-full transition-smooth',
                  isActive && 'bg-primary/15'
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
