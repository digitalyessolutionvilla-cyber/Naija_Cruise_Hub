import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { TopBar } from '@/components/layout/TopBar';
import { Bell, Heart, MessageSquare, UserPlus, Zap, Star, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotificationContext } from '@/context/NotificationContext';
import type { NotificationType } from '@/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const ICON_MAP: Record<NotificationType, { icon: typeof Bell; iconColor: string; iconBg: string }> = {
  like:           { icon: Heart,          iconColor: 'text-neon-pink',   iconBg: 'bg-neon-pink/10' },
  friend_request: { icon: UserPlus,       iconColor: 'text-neon-purple', iconBg: 'bg-neon-purple/10' },
  comment:        { icon: MessageSquare,  iconColor: 'text-neon-blue',   iconBg: 'bg-neon-blue/10' },
  message:        { icon: MessageSquare,  iconColor: 'text-neon-blue',   iconBg: 'bg-neon-blue/10' },
  system:         { icon: Zap,            iconColor: 'text-neon-gold',   iconBg: 'bg-neon-gold/10' },
};

export function NotificationsPage() {
  const { notifications, loading, unreadCount, markRead, markAllRead } = useNotificationContext();

  return (
    <AppLayout>
      <TopBar title="Notifications" showSearch={false} />
      <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </span>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={markAllRead}>
              <Check className="w-3 h-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-2">
            {[1,2,3,4].map(i => <div key={i} className="glass rounded-2xl h-16 animate-shimmer" />)}
          </div>
        )}

        {/* Empty */}
        {!loading && notifications.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">No notifications yet</p>
            <p className="text-xs text-muted-foreground">Interact with people to get notified</p>
          </div>
        )}

        {/* Notifications list */}
        <div className="space-y-2">
          {notifications.map((notif, i) => {
            const config = ICON_MAP[notif.type] || ICON_MAP.system;
            const Icon = config.icon;
            const timeAgo = formatDistanceToNow(new Date(notif.created_at), { addSuffix: true });

            return (
              <motion.button
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                onClick={() => !notif.is_read && markRead(notif.id)}
                className={cn(
                  'w-full glass rounded-2xl p-4 flex items-start gap-3 transition-smooth text-left hover:bg-muted/20',
                  !notif.is_read && 'neon-border'
                )}
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', config.iconBg)}>
                  <Icon className={cn('w-5 h-5', config.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-sm', !notif.is_read ? 'font-semibold' : 'font-medium text-foreground/80')}>
                      {notif.title}
                    </p>
                    {!notif.is_read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                  </div>
                  {notif.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
