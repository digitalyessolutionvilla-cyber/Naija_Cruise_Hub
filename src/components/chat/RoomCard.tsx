import { ChatRoom } from '@/types';
import { Users, MessageSquare, ChevronRight, Building2, Landmark, GraduationCap, Heart, Music, Trophy, Cpu, Moon, Shirt, Star, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import type { LucideProps } from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  MessageCircle: MessageSquare,
  MessageSquare,
  Building2,
  Landmark,
  GraduationCap,
  Heart,
  Music,
  Trophy,
  Cpu,
  Moon,
  Shirt,
  Star,
  TrendingUp,
};

const categoryColors: Record<string, string> = {
  General: 'text-neon-purple',
  City: 'text-neon-blue',
  Education: 'text-neon-green',
  Social: 'text-neon-pink',
  Entertainment: 'text-neon-gold',
  Sports: 'text-neon-green',
  Technology: 'text-neon-blue',
  Lifestyle: 'text-neon-pink',
  Business: 'text-neon-gold',
};

const categoryBg: Record<string, string> = {
  General: 'bg-neon-purple/10',
  City: 'bg-neon-blue/10',
  Education: 'bg-neon-green/10',
  Social: 'bg-neon-pink/10',
  Entertainment: 'bg-neon-gold/10',
  Sports: 'bg-neon-green/10',
  Technology: 'bg-neon-blue/10',
  Lifestyle: 'bg-neon-pink/10',
  Business: 'bg-neon-gold/10',
};

function RoomIcon({ iconName, category }: { iconName: string; category: string | null }) {
  const iconColor = categoryColors[category || ''] || 'text-muted-foreground';
  const bgColor = categoryBg[category || ''] || 'bg-muted';
  const IconComponent = ICON_MAP[iconName] || MessageSquare;

  return (
    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', bgColor)}>
      <IconComponent className={cn('w-6 h-6', iconColor)} />
    </div>
  );
}

interface RoomCardProps {
  room: ChatRoom;
  className?: string;
}

export function RoomCard({ room, className }: RoomCardProps) {
  const navigate = useNavigate();
  const isActive = room.member_count > 500;

  return (
    <button
      onClick={() => navigate(`/rooms/${room.id}`)}
      className={cn(
        'glass rounded-2xl p-4 text-left w-full card-elevated group flex items-center gap-4',
        className
      )}
    >
      <RoomIcon iconName={room.emoji_icon || 'MessageSquare'} category={room.category} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-sm truncate">{room.name}</span>
          {isActive && (
            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-neon-green animate-pulse" />
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mb-2">{room.description}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {room.member_count.toLocaleString()}
          </span>
          {room.category && (
            <Badge
              variant="outline"
              className={cn(
                'text-xs py-0 h-5 border bg-transparent border-current/30',
                categoryColors[room.category] || ''
              )}
            >
              {room.category}
            </Badge>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-smooth flex-shrink-0" />
    </button>
  );
}
