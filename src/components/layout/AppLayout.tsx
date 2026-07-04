import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background bg-mesh">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden pb-16 lg:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
