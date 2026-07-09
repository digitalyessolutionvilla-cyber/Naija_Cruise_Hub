import { AppLayout } from '@/components/layout/AppLayout';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useNotificationContext } from '@/context/NotificationContext';
import { Volume2 } from 'lucide-react';

const CATEGORY_OPTIONS: Array<{ key: string; label: string }> = [
    { key: 'messages', label: 'Messages' },
    { key: 'chat_rooms', label: 'Chat Rooms' },
    { key: 'posts', label: 'Posts' },
    { key: 'likes', label: 'Likes' },
    { key: 'comments', label: 'Comments' },
    { key: 'friend_requests', label: 'Friend Requests' },
    { key: 'wallet', label: 'Wallet' },
    { key: 'promotions', label: 'Promotions' },
    { key: 'system', label: 'System' },
];

export function NotificationSettingsPage() {
    const {
        settings,
        soundLibrary,
        previewSound,
        updateSettings,
        toggleCategoryMuted,
    } = useNotificationContext();

    return (
        <AppLayout>
            <TopBar title="Notification Settings" showSearch={false} />
            <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
                <div className="glass rounded-2xl p-4 space-y-3">
                    <p className="text-sm font-semibold">General Preferences</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <label className="flex items-center justify-between gap-2">Sound
                            <Switch checked={settings.soundEnabled} onCheckedChange={(value) => void updateSettings({ soundEnabled: value })} />
                        </label>
                        <label className="flex items-center justify-between gap-2">Vibration
                            <Switch checked={settings.vibrationEnabled} onCheckedChange={(value) => void updateSettings({ vibrationEnabled: value })} />
                        </label>
                        <label className="flex items-center justify-between gap-2">Push Notifications
                            <Switch checked={settings.pushEnabled} onCheckedChange={(value) => void updateSettings({ pushEnabled: value })} />
                        </label>
                        <label className="flex items-center justify-between gap-2">Email Notifications
                            <Switch checked={settings.emailEnabled} onCheckedChange={(value) => void updateSettings({ emailEnabled: value })} />
                        </label>
                    </div>
                </div>

                <div className="glass rounded-2xl p-4 space-y-3">
                    <p className="text-sm font-semibold">Sound</p>
                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Notification Sound</label>
                        <div className="flex gap-2">
                            <select
                                className="flex-1 h-10 rounded-md border border-border bg-muted/40 px-3 text-sm"
                                value={settings.selectedSound}
                                onChange={(e) => void updateSettings({ selectedSound: e.target.value })}
                            >
                                {soundLibrary.map((sound) => (
                                    <option key={sound} value={sound}>{sound}</option>
                                ))}
                            </select>
                            <Button variant="outline" onClick={() => void previewSound(settings.selectedSound)}>
                                <Volume2 className="w-4 h-4 mr-1" /> Preview
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Volume ({Math.round(settings.soundVolume * 100)}%)</label>
                        <Input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={settings.soundVolume}
                            onChange={(e) => void updateSettings({ soundVolume: Number(e.target.value) })}
                        />
                    </div>
                </div>

                <div className="glass rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">Quiet Hours</p>
                        <Switch checked={settings.quietHoursEnabled} onCheckedChange={(value) => void updateSettings({ quietHoursEnabled: value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Start</label>
                            <Input
                                type="time"
                                value={settings.quietHoursStart}
                                onChange={(e) => void updateSettings({ quietHoursStart: e.target.value })}
                                disabled={!settings.quietHoursEnabled}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">End</label>
                            <Input
                                type="time"
                                value={settings.quietHoursEnd}
                                onChange={(e) => void updateSettings({ quietHoursEnd: e.target.value })}
                                disabled={!settings.quietHoursEnabled}
                            />
                        </div>
                    </div>
                </div>

                <div className="glass rounded-2xl p-4 space-y-3">
                    <p className="text-sm font-semibold">Muted Categories</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {CATEGORY_OPTIONS.map(({ key, label }) => (
                            <label key={key} className="flex items-center justify-between gap-2 bg-muted/30 rounded-md px-3 py-2">
                                <span>{label}</span>
                                <Switch
                                    checked={Boolean(settings.mutedCategories[key as keyof typeof settings.mutedCategories])}
                                    onCheckedChange={(value) => void toggleCategoryMuted(key as any, value)}
                                />
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
