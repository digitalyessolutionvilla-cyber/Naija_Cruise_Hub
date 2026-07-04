import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Users, Hash, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AvatarDisplay } from '@/components/profile/AvatarDisplay';
import { LevelBadge } from '@/components/profile/XPBar';
import { cn } from '@/lib/utils';
import type { UserLevel } from '@/types';

interface SearchUser {
  id: string;
  username: string;
  avatar_id: string;
  level: UserLevel;
  is_online: boolean;
  xp: number;
}

interface SearchRoom {
  id: string;
  name: string;
  category: string;
  member_count: number;
}

interface SearchResults {
  users: SearchUser[];
  rooms: SearchRoom[];
}

export function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ users: [], rooms: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults({ users: [], rooms: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const term = `%${q.trim()}%`;
    const [{ data: users }, { data: rooms }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, avatar_id, level, is_online, xp')
        .ilike('username', term)
        .limit(5),
      supabase
        .from('chat_rooms')
        .select('id, name, category, member_count')
        .ilike('name', term)
        .limit(3),
    ]);
    setResults({
      users: (users ?? []) as SearchUser[],
      rooms: (rooms ?? []) as SearchRoom[],
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults({ users: [], rooms: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const hasResults = results.users.length > 0 || results.rooms.length > 0;
  const showDropdown = open && (query.length >= 2);

  return (
    <div ref={containerRef} className="relative flex-1 max-w-sm">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search people, rooms..."
          className="w-full h-9 pl-9 pr-8 bg-muted/50 border border-transparent focus:border-primary rounded-lg text-sm outline-none transition-all placeholder:text-muted-foreground text-foreground"
        />
        {query && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { setQuery(''); setResults({ users: [], rooms: [] }); inputRef.current?.focus(); }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-11 left-0 right-0 glass-strong rounded-xl border border-border shadow-card z-50 overflow-hidden">
          {loading && (
            <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
          )}

          {!loading && !hasResults && query.length >= 2 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && results.users.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">People</span>
              </div>
              {results.users.map(u => (
                <button
                  key={u.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => {
                    navigate(`/profile/${u.id}`);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <AvatarDisplay avatarId={u.avatar_id || 'av1'} size="sm" isOnline={u.is_online} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">@{u.username}</span>
                      <LevelBadge level={u.level || 'Newbie'} />
                    </div>
                  </div>
                  <TrendingUp className={cn('w-3.5 h-3.5', u.is_online ? 'text-neon-green' : 'text-muted-foreground')} />
                </button>
              ))}
            </div>
          )}

          {!loading && results.rooms.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
                <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chat Rooms</span>
              </div>
              {results.rooms.map(r => (
                <button
                  key={r.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => {
                    navigate(`/rooms/${r.id}`);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Hash className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.member_count.toLocaleString()} members</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
