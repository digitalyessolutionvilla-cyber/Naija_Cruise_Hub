import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { isAdminEmail } from '@/lib/admin';

export function AdminPage() {
    const { user, loading, signOut } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (loading) return;

        if (!user) {
            navigate('/auth?next=/admin', { replace: true });
            return;
        }

        if (!isAdminEmail(user.email)) {
            navigate('/home', { replace: true });
        }
    }, [loading, user, navigate]);

    if (loading || !user) {
        return (
            <div className="min-h-screen grid place-items-center bg-background text-foreground">
                <p>Checking admin access...</p>
            </div>
        );
    }

    if (!isAdminEmail(user.email)) {
        return null;
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            <div className="mx-auto max-w-4xl space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                    <Button
                        variant="outline"
                        onClick={async () => {
                            await signOut();
                            navigate('/auth', { replace: true });
                        }}
                    >
                        Sign Out
                    </Button>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-sm text-muted-foreground">Signed in as admin</p>
                    <p className="mt-1 text-lg font-semibold">{user.email}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-card p-5">
                        <h2 className="font-semibold">Quick Access</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Use the app menu to manage users, chats, posts, and moderation tools as this dashboard grows.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-5">
                        <h2 className="font-semibold">Status</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Admin route and credential-based access are active.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
