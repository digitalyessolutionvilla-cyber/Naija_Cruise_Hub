import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Hash, Search } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { TopBar } from '@/components/layout/TopBar';
import { RoomCard } from '@/components/chat/RoomCard';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { ChatRoom } from '@/types';
import { cn } from '@/lib/utils';

const CATEGORIES = ['All', 'General', 'City', 'Education', 'Social', 'Entertainment', 'Sports', 'Technology', 'Lifestyle', 'Business'];

export function ChatRoomsPage() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchRooms = async () => {
      const { data } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('is_active', true)
        .order('member_count', { ascending: false });
      if (data) setRooms(data as ChatRoom[]);
      setLoading(false);
    };
    fetchRooms();
  }, []);

  const filtered = rooms.filter(room => {
    const matchCat = activeCategory === 'All' || room.category === activeCategory;
    const matchSearch = room.name.toLowerCase().includes(search.toLowerCase()) ||
      (room.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
    return matchCat && matchSearch;
  });

  return (
    <AppLayout>
      <TopBar title="Chat Rooms" showSearch={false} />
      <div className="max-w-3xl mx-auto w-full p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search rooms..."
            className="pl-9 bg-muted/50 border-transparent focus:border-primary"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Category filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-smooth',
                activeCategory === cat
                  ? 'gradient-primary text-white shadow-glow-purple'
                  : 'glass text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Hash className="w-4 h-4" />
          <span>{filtered.length} rooms found</span>
        </div>

        {/* Rooms list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="glass rounded-2xl h-20 animate-shimmer" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((room, i) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <RoomCard room={room} />
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Hash className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No rooms found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
