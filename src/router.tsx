import { LandingPage } from "./pages/LandingPage";
import { AuthPage } from "./pages/AuthPage";
import { HomePage } from "./pages/HomePage";
import { ChatRoomsPage } from "./pages/ChatRoomsPage";
import { ChatRoomPage } from "./pages/ChatRoomPage";
import { ProfilePage } from "./pages/ProfilePage";
import { UserProfilePage } from "./pages/UserProfilePage";
import { MessagesPage } from "./pages/MessagesPage";
import { ExplorePage } from "./pages/ExplorePage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { TasksRewardsPage } from "./pages/TasksRewardsPage";
import { WalletPage } from "./pages/WalletPage";
import { AdminPage } from "./pages/AdminPage";
import NotFound from "./pages/NotFound";

export const routers = [
  { path: "/", name: "landing", element: <LandingPage /> },
  { path: "/auth", name: "auth", element: <AuthPage /> },
  { path: "/home", name: "home", element: <HomePage /> },
  { path: "/rooms", name: "rooms", element: <ChatRoomsPage /> },
  { path: "/rooms/:id", name: "room", element: <ChatRoomPage /> },
  { path: "/profile", name: "profile", element: <ProfilePage /> },
  { path: "/wallet", name: "wallet", element: <WalletPage /> },
  { path: "/tasks", name: "tasks", element: <TasksRewardsPage /> },
  { path: "/profile/:userId", name: "user-profile", element: <UserProfilePage /> },
  { path: "/messages", name: "messages", element: <MessagesPage /> },
  { path: "/explore", name: "explore", element: <ExplorePage /> },
  { path: "/notifications", name: "notifications", element: <NotificationsPage /> },
  { path: "/admin", name: "admin", element: <AdminPage /> },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  { path: "*", name: "404", element: <NotFound /> },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
