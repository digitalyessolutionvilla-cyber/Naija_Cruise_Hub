import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatNairaAmount } from '@/lib/wallet';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { toast } from 'sonner';
import {
    CheckCircle2,
    Clock3,
    Gift,
    Heart,
    ImagePlus,
    Megaphone,
    MessageCircle,
    MousePointerClick,
    PenLine,
    PlayCircle,
    Star,
    UserPlus,
    Users,
    Wallet,
    CalendarDays,
    TrendingUp,
} from 'lucide-react';

const sb = supabase as any;

type TaskItem = {
    task_key: string;
    title: string;
    description: string;
    category: string;
    reward_coins: number;
    target_count: number;
    current_count: number;
    claimable: boolean;
    claimed: boolean;
    reset_period: 'once' | 'daily' | 'weekly';
    time_remaining_seconds: number | null;
    scope_key: string;
};

type TaskDefinition = {
    task_key: string;
    title: string;
    description: string;
    category: string;
    reward_coins: number;
    target_count: number;
    reset_period: 'once' | 'daily' | 'weekly';
    icon: typeof Star;
};

const TASK_DEFINITIONS: TaskDefinition[] = [
    {
        task_key: 'daily_login',
        title: 'Daily Login Reward',
        description: 'Open CruiseHub every day and claim your login bonus.',
        category: 'Daily',
        reward_coins: 10,
        target_count: 1,
        reset_period: 'daily',
        icon: CalendarDays,
    },
    {
        task_key: 'create_engaging_posts',
        title: 'Create Engaging Posts',
        description: 'Publish high-quality posts that keep the feed active.',
        category: 'Content',
        reward_coins: 50,
        target_count: 3,
        reset_period: 'once',
        icon: PenLine,
    },
    {
        task_key: 'upload_memes',
        title: 'Upload Memes',
        description: 'Share funny or viral memes with the community.',
        category: 'Content',
        reward_coins: 40,
        target_count: 3,
        reset_period: 'once',
        icon: ImagePlus,
    },
    {
        task_key: 'upload_reels',
        title: 'Upload Reels',
        description: 'Post short-form video content to earn bonus coins.',
        category: 'Content',
        reward_coins: 50,
        target_count: 3,
        reset_period: 'once',
        icon: PlayCircle,
    },
    {
        task_key: 'comment_on_posts',
        title: 'Comment on Posts',
        description: 'Join conversations with useful or thoughtful comments.',
        category: 'Community',
        reward_coins: 20,
        target_count: 5,
        reset_period: 'once',
        icon: MessageCircle,
    },
    {
        task_key: 'like_and_share_posts',
        title: 'Like and Share Posts',
        description: 'React to posts and share them to support creators.',
        category: 'Community',
        reward_coins: 25,
        target_count: 10,
        reset_period: 'once',
        icon: Heart,
    },
    {
        task_key: 'join_chat_rooms',
        title: 'Join Chat Rooms',
        description: 'Become part of active conversations across the platform.',
        category: 'Community',
        reward_coins: 30,
        target_count: 3,
        reset_period: 'once',
        icon: Users,
    },
    {
        task_key: 'invite_friends',
        title: 'Invite Friends',
        description: 'Bring new users into CruiseHub and earn referral rewards.',
        category: 'Growth',
        reward_coins: 100,
        target_count: 1,
        reset_period: 'once',
        icon: UserPlus,
    },
    {
        task_key: 'complete_profile',
        title: 'Complete Profile',
        description: 'Finish your profile to unlock profile completion rewards.',
        category: 'Setup',
        reward_coins: 25,
        target_count: 1,
        reset_period: 'once',
        icon: Gift,
    },
    {
        task_key: 'community_events',
        title: 'Participate in Community Events',
        description: 'Attend or participate in platform community events and campaigns.',
        category: 'Events',
        reward_coins: 75,
        target_count: 1,
        reset_period: 'once',
        icon: Megaphone,
    },
    {
        task_key: 'rewarded_ads',
        title: 'View Rewarded Advertisements',
        description: 'Watch rewarded ads to earn extra Cruise Coins.',
        category: 'Monetization',
        reward_coins: 15,
        target_count: 3,
        reset_period: 'daily',
        icon: Wallet,
    },
    {
        task_key: 'daily_challenge',
        title: 'Complete Daily Challenge',
        description: 'Finish the day’s challenge bundle to claim a bonus reward.',
        category: 'Challenges',
        reward_coins: 75,
        target_count: 3,
        reset_period: 'daily',
        icon: TrendingUp,
    },
    {
        task_key: 'weekly_challenge',
        title: 'Complete Weekly Challenge',
        description: 'Hit the weekly milestone for a bigger Cruise Coin payout.',
        category: 'Challenges',
        reward_coins: 250,
        target_count: 7,
        reset_period: 'weekly',
        icon: Clock3,
    },
    {
        task_key: 'sponsored_campaigns',
        title: 'Platform-Sponsored Campaigns',
        description: 'Participate in special campaigns and sponsored platform events.',
        category: 'Campaigns',
        reward_coins: 100,
        target_count: 1,
        reset_period: 'once',
        icon: Star,
    },
];

function formatTimeRemaining(seconds: number | null) {
    if (!seconds || seconds <= 0) return 'No timer';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m remaining`;
}

function getClaimStatus(task: TaskItem) {
    if (task.claimed) return 'Claimed';
    if (task.claimable) return 'Ready to claim';
    return 'In progress';
}

function getTaskScopeKey(resetPeriod: TaskItem['reset_period']) {
    if (resetPeriod === 'daily') return new Date().toISOString().slice(0, 10);
    if (resetPeriod === 'weekly') {
        const now = new Date();
        const startOfWeek = new Date(now);
        const day = now.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        startOfWeek.setDate(now.getDate() + diff);
        return startOfWeek.toISOString().slice(0, 10);
    }
    return 'once';
}

function getLocalClaimKey(taskKey: string, scopeKey: string) {
    return `cruisehub-reward-claimed:${taskKey}:${scopeKey}`;
}

export function TasksRewardsPage() {
    const { user, profile, refreshProfile, updateProfile } = useAuth();
    const { rate } = useExchangeRate();
    const [loading, setLoading] = useState(true);
    const [rpcUnavailable, setRpcUnavailable] = useState(false);
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [claimingTaskKey, setClaimingTaskKey] = useState<string | null>(null);
    const autoClaimedTaskKeys = useRef(new Set<string>());

    const loadTasks = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        const { data, error } = await sb.rpc('get_reward_tasks');

        if (!error && Array.isArray(data)) {
            setRpcUnavailable(false);
            setTasks(data as TaskItem[]);
            setLoading(false);
            return;
        }

        setRpcUnavailable(true);

        const [{ count: postCount }, { count: memeCount }, { count: reelCount }, { count: commentCount }, { count: likeCount }, { count: shareCount }, { count: roomCount }, { count: inviteCount }, { count: adCount }, { data: profileRow }] = await Promise.all([
            sb.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            sb.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'meme'),
            sb.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'reel'),
            sb.from('post_comments').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            sb.from('post_likes').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            sb.from('post_shares').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            sb.from('room_members').select('room_id', { count: 'exact', head: true }).eq('user_id', user.id),
            sb.from('friendships').select('id', { count: 'exact', head: true }).eq('requester_id', user.id),
            sb.from('ad_events').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            sb.from('profiles').select('username, bio, avatar_id, gender, state, interests').eq('id', user.id).maybeSingle(),
        ]);

        const profileComplete = !!profileRow && Boolean(
            profileRow.avatar_id && profileRow.bio && profileRow.gender && profileRow.state && Array.isArray(profileRow.interests) && profileRow.interests.length > 0,
        );

        const derivedCounts: Record<string, number> = {
            daily_login: 1,
            create_engaging_posts: Number(postCount ?? 0),
            upload_memes: Number(memeCount ?? 0),
            upload_reels: Number(reelCount ?? 0),
            comment_on_posts: Number(commentCount ?? 0),
            like_and_share_posts: Number(likeCount ?? 0) + Number(shareCount ?? 0),
            join_chat_rooms: Number(roomCount ?? 0),
            invite_friends: Number(inviteCount ?? 0),
            complete_profile: profileComplete ? 1 : 0,
            community_events: Number(adCount ?? 0),
            rewarded_ads: Number(adCount ?? 0),
            daily_challenge: Number(postCount ?? 0) + Number(commentCount ?? 0),
            weekly_challenge: Number(postCount ?? 0) + Number(commentCount ?? 0) + Number(roomCount ?? 0),
            sponsored_campaigns: Number(adCount ?? 0),
        };

        const fallbackTasks: TaskItem[] = TASK_DEFINITIONS.map((task) => {
            const current_count = derivedCounts[task.task_key] ?? 0;
            const scope_key = getTaskScopeKey(task.reset_period);
            const alreadyClaimed = window.localStorage.getItem(getLocalClaimKey(task.task_key, scope_key)) === '1';
            const claimable = current_count >= task.target_count;
            let time_remaining_seconds: number | null = null;
            if (task.reset_period === 'daily') {
                time_remaining_seconds = Math.max(0, Math.floor((new Date(new Date().setHours(24, 0, 0, 0)).getTime() - Date.now()) / 1000));
            } else if (task.reset_period === 'weekly') {
                const now = new Date();
                const nextMonday = new Date(now);
                const day = now.getDay();
                const diff = day === 0 ? 1 : 8 - day;
                nextMonday.setDate(now.getDate() + diff);
                nextMonday.setHours(0, 0, 0, 0);
                time_remaining_seconds = Math.max(0, Math.floor((nextMonday.getTime() - Date.now()) / 1000));
            }

            return {
                task_key: task.task_key,
                title: task.title,
                description: task.description,
                category: task.category,
                reward_coins: task.reward_coins,
                target_count: task.target_count,
                current_count: Math.min(current_count, task.target_count),
                claimable: claimable && !alreadyClaimed,
                claimed: alreadyClaimed,
                reset_period: task.reset_period,
                time_remaining_seconds,
                scope_key,
            };
        });

        setTasks(fallbackTasks);
        setLoading(false);
    }, [user]);

    useEffect(() => {
        void loadTasks();
    }, [loadTasks]);

    const groupedTasks = useMemo(() => {
        return tasks.reduce<Record<string, TaskItem[]>>((groups, task) => {
            (groups[task.category] ||= []).push(task);
            return groups;
        }, {});
    }, [tasks]);

    const handleClaim = useCallback(async (task: TaskItem) => {
        const localClaimKey = getLocalClaimKey(task.task_key, task.scope_key);

        if (window.localStorage.getItem(localClaimKey) === '1') {
            return;
        }

        if (rpcUnavailable) {
            const nextCoins = Number(profile?.coins ?? 0) + Number(task.reward_coins ?? 0);
            const { error: profileError } = await updateProfile({ coins: nextCoins });

            if (profileError) {
                toast.error(profileError.message ?? 'Unable to credit reward locally.');
                return;
            }

            window.localStorage.setItem(localClaimKey, '1');
            toast.success(`Reward claimed successfully. ${Number(task.reward_coins ?? 0).toLocaleString()} Cruise Coins credited.`);
            await refreshProfile();
            await loadTasks();
            return;
        }

        setClaimingTaskKey(task.task_key);
        const { error } = await sb.rpc('claim_reward_task', { p_task_key: task.task_key });
        setClaimingTaskKey(null);

        if (error) {
            toast.error(error.message ?? 'Unable to claim reward.');
            return;
        }

        window.localStorage.setItem(localClaimKey, '1');
        toast.success('Reward claimed successfully.');
        await refreshProfile();
        await loadTasks();
    }, [loadTasks, profile?.coins, refreshProfile, rpcUnavailable, updateProfile]);

    useEffect(() => {
        if (rpcUnavailable || !user || claimingTaskKey) return;

        const nextClaimable = tasks.find((task) => task.claimable && !task.claimed && !autoClaimedTaskKeys.current.has(task.task_key));
        if (!nextClaimable) return;

        autoClaimedTaskKeys.current.add(nextClaimable.task_key);
        void handleClaim(nextClaimable);
    }, [claimingTaskKey, handleClaim, rpcUnavailable, tasks, user]);

    if (!user) {
        return (
            <AppLayout>
                <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
                    Sign in to view your tasks.
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <TopBar title="Tasks & Rewards" showSearch={false} />
            <div className="mx-auto w-full max-w-6xl space-y-6 p-4">
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-3xl p-5 border border-border/60"
                >
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-2">
                            <Badge className="w-fit bg-neon-gold/15 text-neon-gold border-neon-gold/20">Get More</Badge>
                            <h1 className="text-3xl font-bold tracking-tight">Earn Cruise Coins with real platform activity</h1>
                            <p className="max-w-2xl text-sm text-muted-foreground">
                                Complete the tasks below to grow your balance. Every claim is tied to the live backend, and your Cruise Coins stay convertible at the current rate of {formatNairaAmount(rate)} per coin.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                                <p className="text-xs text-muted-foreground">Balance</p>
                                <p className="text-lg font-semibold text-neon-gold">{profile?.coins?.toLocaleString() ?? '0'}</p>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                                <p className="text-xs text-muted-foreground">Equivalent</p>
                                <p className="text-lg font-semibold">{formatNairaAmount(Number(profile?.coins ?? 0) * rate)}</p>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                                <p className="text-xs text-muted-foreground">Claimable</p>
                                <p className="text-lg font-semibold">{tasks.filter((task) => task.claimable).length}</p>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                                <p className="text-xs text-muted-foreground">Categories</p>
                                <p className="text-lg font-semibold">{Object.keys(groupedTasks).length}</p>
                            </div>
                        </div>
                    </div>
                </motion.section>

                {rpcUnavailable && (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                        Backend task RPCs are not available yet on this database, so this build is auto-crediting completed tasks through your profile balance until the migration is live.
                    </div>
                )}

                {loading ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {TASK_DEFINITIONS.map((task) => (
                            <div key={task.task_key} className="glass h-56 rounded-3xl animate-pulse" />
                        ))}
                    </div>
                ) : (
                    Object.entries(groupedTasks).map(([category, categoryTasks]) => (
                        <section key={category} className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-lg font-semibold">{category}</h2>
                                <Badge variant="outline">{categoryTasks.length} tasks</Badge>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {categoryTasks.map((task, index) => {
                                    const iconMap: Record<string, typeof Star> = {
                                        daily_login: CalendarDays,
                                        create_engaging_posts: PenLine,
                                        upload_memes: ImagePlus,
                                        upload_reels: PlayCircle,
                                        comment_on_posts: MessageCircle,
                                        like_and_share_posts: Heart,
                                        join_chat_rooms: Users,
                                        invite_friends: UserPlus,
                                        complete_profile: Gift,
                                        community_events: Megaphone,
                                        rewarded_ads: Wallet,
                                        daily_challenge: TrendingUp,
                                        weekly_challenge: Clock3,
                                        sponsored_campaigns: Star,
                                    };
                                    const Icon = iconMap[task.task_key] ?? Star;
                                    const progress = Math.min((task.current_count / task.target_count) * 100, 100);
                                    const status = getClaimStatus(task);
                                    return (
                                        <motion.article
                                            key={task.task_key}
                                            initial={{ opacity: 0, y: 14 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: Math.min(index * 0.05, 0.3) }}
                                            className="glass rounded-3xl border border-border/60 p-4"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                                                        <Icon className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold">{task.title}</h3>
                                                        <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                                                    </div>
                                                </div>
                                                <Badge variant={task.claimed ? 'secondary' : task.claimable ? 'default' : 'outline'}>{status}</Badge>
                                            </div>

                                            <div className="mt-4 space-y-2">
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                    <span>{task.current_count}/{task.target_count} complete</span>
                                                    <span>{formatTimeRemaining(task.time_remaining_seconds)}</span>
                                                </div>
                                                <Progress value={progress} />
                                            </div>

                                            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                                                <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                                                    <p className="text-[11px] text-muted-foreground">Reward</p>
                                                    <p className="font-semibold text-neon-gold">{task.reward_coins} Coins</p>
                                                </div>
                                                <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                                                    <p className="text-[11px] text-muted-foreground">Progress</p>
                                                    <p className="font-semibold">{Math.round(progress)}%</p>
                                                </div>
                                                <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                                                    <p className="text-[11px] text-muted-foreground">Timer</p>
                                                    <p className="font-semibold">{task.reset_period}</p>
                                                </div>
                                            </div>

                                            <Separator className="my-4" />

                                            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                                <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {task.reset_period}</span>
                                                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {status}</span>
                                            </div>

                                            <Button
                                                className="mt-4 w-full"
                                                onClick={() => void handleClaim(task)}
                                                disabled={!task.claimable || task.claimed || claimingTaskKey === task.task_key}
                                            >
                                                {task.claimed ? 'Claimed' : claimingTaskKey === task.task_key ? 'Claiming...' : 'Claim Reward'}
                                            </Button>
                                        </motion.article>
                                    );
                                })}
                            </div>
                        </section>
                    ))
                )}
            </div>
        </AppLayout>
    );
}
