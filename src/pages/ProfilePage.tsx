import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Edit2, MessageSquare, Phone, Video,
  Share2, LogOut, Shield, Trash2, Image, MapPin,
  Crown, Coins, ChevronRight, UserPlus, EyeOff, Users,
  Hash, Copy, Check
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AvatarDisplay } from '@/components/profile/AvatarDisplay';
import { XPBar, LevelBadge } from '@/components/profile/XPBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AVATARS, getLevelNumber } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Stats { friends: number; rooms: number; posts: number; }

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string | React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  hasChevron?: boolean;
}

function SettingsRow({ icon, label, value, onClick, danger, hasChevron = true }: SettingsRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-4 hover:bg-muted/30 transition-smooth text-left"
    >
      <div className={cn('flex-shrink-0', danger ? 'text-destructive' : 'text-muted-foreground')}>{icon}</div>
      <span className={cn('flex-1 text-sm font-medium', danger ? 'text-destructive' : 'text-foreground')}>
        {label}
      </span>
      {value !== undefined && <span className="text-sm text-primary font-medium">{value}</span>}
      {hasChevron && value === undefined && <ChevronRight className="w-4 h-4 text-muted-foreground/50" />}
    </button>
  );
}

function SectionGroup({ children }: { children: React.ReactNode }) {
  return <div className="glass rounded-2xl overflow-hidden divide-y divide-border/50">{children}</div>;
}

export function ProfilePage() {
  const { profile, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ friends: 0, rooms: 0, posts: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!profile) return;
    // Fetch real stats
    Promise.all([
      supabase.from('friendships').select('id', { count: 'exact', head: true })
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
        .eq('status', 'accepted'),
      supabase.from('room_messages').select('room_id', { count: 'exact', head: true })
        .eq('user_id', profile.id),
      supabase.from('posts').select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id),
    ]).then(([{ count: f }, { count: r }, { count: p }]) => {
      setStats({ friends: f || 0, rooms: r || 0, posts: p || 0 });
    });
  }, [profile]);

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-muted-foreground animate-pulse">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  const avatar = AVATARS.find(a => a.id === profile.avatar_id) || AVATARS[0];
  const levelNum = getLevelNumber(profile.xp);
  const joinedDate = new Date(profile.created_at || Date.now())
    .toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(`@${profile.username}`);
    setCopied(true);
    toast.success('Username copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleStealth = async (val: boolean) => {
    await updateProfile({ stealth_mode: val });
    toast.success(val ? 'Stealth mode on' : 'Stealth mode off');
  };

  const handleToggleMute = async (val: boolean) => {
    await updateProfile({ mute_notifications: val });
    toast.success(val ? 'Notifications muted' : 'Notifications enabled');
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto w-full">
        {/* Hero Banner */}
        <div className="relative">
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 z-20 w-9 h-9 rounded-full glass flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full glass flex items-center justify-center">
            <Edit2 className="w-4 h-4" />
          </button>

          {/* Avatar banner */}
          <div className={`relative w-full h-64 sm:h-72 bg-gradient-to-br ${avatar.gradient} flex items-center justify-center overflow-hidden`}>
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-4 left-8 w-24 h-24 rounded-full bg-white/20 blur-2xl" />
              <div className="absolute bottom-8 right-12 w-32 h-32 rounded-full bg-white/15 blur-3xl" />
            </div>
            <div className="relative z-10">
              <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br ${avatar.gradient} flex items-center justify-center text-7xl sm:text-8xl shadow-2xl border-4 border-white/20`}>
                {avatar.emoji}
              </div>
              <span className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-neon-green border-2 border-background shadow-md" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
          </div>

          {/* Username & info */}
          <div className="px-4 pb-4 -mt-2 relative z-10">
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-2xl font-bold leading-tight">@{profile.username}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <LevelBadge level={profile.level} />
                  <span className="text-xs font-medium text-muted-foreground">Lv.{levelNum}</span>
                  <span className="flex items-center gap-1 text-xs text-neon-green font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                    Online
                  </span>
                  {profile.state && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" /> {profile.state}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {profile.bio && <p className="text-sm text-muted-foreground mt-1.5 italic">"{profile.bio}"</p>}
            <p className="text-xs text-muted-foreground mt-1">Joined {joinedDate}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-4 pb-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: MessageSquare, label: 'Message', action: () => navigate('/messages') },
              { icon: Phone, label: 'Voice', action: () => toast.info('Voice calls coming soon!') },
              { icon: Video, label: 'Video', action: () => toast.info('Video calls coming soon!') },
            ].map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                onClick={action}
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl glass hover:bg-primary/10 transition-smooth group"
              >
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-smooth">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs font-medium text-primary">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* XP & Coins */}
        <div className="px-4 pb-4 space-y-3">
          <div className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Level Progress — Lv.{levelNum}</span>
              <span className="text-xs text-muted-foreground">{profile.xp.toLocaleString()} XP</span>
            </div>
            <XPBar xp={profile.xp} level={profile.level} />
          </div>

          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-neon-gold/10 flex items-center justify-center">
              <Coins className="w-6 h-6 text-neon-gold" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Cruise Coins</p>
              <p className="text-xl font-bold text-neon-gold">{profile.coins.toLocaleString()}</p>
            </div>
            <Button size="sm" className="gradient-primary text-white border-0 text-xs">
              Get More
            </Button>
          </div>

          {/* Streak */}
          {profile.login_streak > 0 && (
            <div className="glass rounded-2xl p-4 flex items-center gap-3">
              <div className="text-2xl">🔥</div>
              <div>
                <p className="text-sm font-semibold">{profile.login_streak} Day Streak</p>
                <p className="text-xs text-muted-foreground">Best: {profile.longest_streak} days</p>
              </div>
              <Badge className="ml-auto bg-neon-gold/15 text-neon-gold border-neon-gold/20">Active</Badge>
            </div>
          )}
        </div>

        {/* Cruise ID */}
        <div className="px-4 pb-4">
          <SectionGroup>
            <button
              onClick={handleCopyId}
              className="w-full flex items-center gap-4 px-4 py-4 hover:bg-muted/30 transition-smooth"
            >
              <div className="flex-1 text-left">
                <p className="text-base font-semibold">@{profile.username}</p>
                <p className="text-xs text-primary mt-0.5">Cruise ID — tap to copy</p>
              </div>
              {copied ? <Check className="w-4 h-4 text-neon-green" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
            </button>
          </SectionGroup>
        </div>

        {/* Interests */}
        {profile.interests && profile.interests.length > 0 && (
          <div className="px-4 pb-4">
            <SectionGroup>
              <div className="px-4 py-4 space-y-3">
                <p className="text-sm font-semibold">Interests</p>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map(interest => (
                    <Badge key={interest} variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
            </SectionGroup>
          </div>
        )}

        {/* Stats */}
        <div className="px-4 pb-4">
          <SectionGroup>
            <SettingsRow icon={<Users className="w-5 h-5" />} label="Friends" value={String(stats.friends)} onClick={() => {}} hasChevron={false} />
            <SettingsRow icon={<Hash className="w-5 h-5" />} label="Messages Sent" value={String(stats.rooms)} onClick={() => {}} hasChevron={false} />
            <SettingsRow icon={<Image className="w-5 h-5" />} label="Posts" value={String(stats.posts)} onClick={() => {}} hasChevron={false} />
          </SectionGroup>
        </div>

        {/* Settings */}
        <div className="px-4 pb-4">
          <SectionGroup>
            <SettingsRow icon={<UserPlus className="w-5 h-5" />} label="Invite Friends" onClick={() => { navigator.clipboard.writeText(window.location.origin); toast.success('Link copied!'); }} />
            <div className="w-full flex items-center gap-4 px-4 py-4">
              <EyeOff className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  Stealth Mode
                  <Crown className="w-3.5 h-3.5 text-neon-gold" />
                </p>
                <p className="text-xs text-muted-foreground">Hide your online status</p>
              </div>
              <Switch checked={profile.stealth_mode} onCheckedChange={handleToggleStealth} />
            </div>
            <div className="w-full flex items-center gap-4 px-4 py-4">
              <MessageSquare className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Mute Notifications</p>
              </div>
              <Switch checked={profile.mute_notifications} onCheckedChange={handleToggleMute} />
            </div>
            <SettingsRow icon={<Share2 className="w-5 h-5" />} label="Share Profile" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Profile link copied!'); }} />
          </SectionGroup>
        </div>

        {/* Danger Zone */}
        <div className="px-4 pb-24 lg:pb-8">
          <SectionGroup>
            <SettingsRow icon={<Shield className="w-5 h-5" />} label="Privacy Settings" onClick={() => {}} />
            <SettingsRow icon={<LogOut className="w-5 h-5" />} label="Sign Out" danger onClick={handleSignOut} />
          </SectionGroup>
        </div>
      </div>
    </AppLayout>
  );
}
