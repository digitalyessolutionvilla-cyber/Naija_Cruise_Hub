import { useEffect } from 'react';
import { Outlet, matchPath, useLocation } from 'react-router-dom';
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
import { NotificationSettingsPage } from "./pages/NotificationSettingsPage";
import { TasksRewardsPage } from "./pages/TasksRewardsPage";
import { WalletPage } from "./pages/WalletPage";
import { AdminPage } from "./pages/AdminPage";
import NotFound from "./pages/NotFound";

const APP_NAME = '9JA Cruse Hub';

function AppTitleManager() {
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    let pageTitle = APP_NAME;

    if (matchPath({ path: '/', end: true }, location.pathname)) {
      pageTitle = `Home | ${APP_NAME}`;
    } else if (matchPath({ path: '/auth', end: true }, location.pathname)) {
      pageTitle = `${searchParams.get('mode') === 'register' ? 'Register' : 'Login'} | ${APP_NAME}`;
    } else if (matchPath({ path: '/home', end: true }, location.pathname)) {
      pageTitle = `Home | ${APP_NAME}`;
    } else if (matchPath({ path: '/explore', end: true }, location.pathname)) {
      pageTitle = `Explore | ${APP_NAME}`;
    } else if (matchPath({ path: '/rooms', end: true }, location.pathname) || matchPath({ path: '/rooms/:id', end: true }, location.pathname)) {
      pageTitle = `Chat Rooms | ${APP_NAME}`;
    } else if (matchPath({ path: '/wallet', end: true }, location.pathname)) {
      pageTitle = `Wallet | ${APP_NAME}`;
    } else if (matchPath({ path: '/profile', end: true }, location.pathname) || matchPath({ path: '/profile/:userId', end: true }, location.pathname)) {
      pageTitle = `Profile | ${APP_NAME}`;
    } else if (matchPath({ path: '/messages', end: true }, location.pathname)) {
      pageTitle = `Messages | ${APP_NAME}`;
    } else if (matchPath({ path: '/notifications', end: true }, location.pathname)) {
      pageTitle = `Notifications | ${APP_NAME}`;
    } else if (matchPath({ path: '/notification-settings', end: true }, location.pathname)) {
      pageTitle = `Notification Settings | ${APP_NAME}`;
    } else if (matchPath({ path: '/tasks', end: true }, location.pathname)) {
      pageTitle = `Tasks | ${APP_NAME}`;
    } else if (matchPath({ path: '/admin', end: true }, location.pathname)) {
      pageTitle = `Admin Dashboard | ${APP_NAME}`;
    } else if (matchPath({ path: '*', end: false }, location.pathname)) {
      pageTitle = `Page Not Found | ${APP_NAME}`;
    }

    document.title = pageTitle;
  }, [location.pathname, location.search]);

  return <Outlet />;
}

export const routers = [
  {
    path: "/",
    element: <AppTitleManager />,
    children: [
      { index: true, name: "landing", element: <LandingPage /> },
      { path: "auth", name: "auth", element: <AuthPage /> },
      { path: "home", name: "home", element: <HomePage /> },
      { path: "rooms", name: "rooms", element: <ChatRoomsPage /> },
      { path: "rooms/:id", name: "room", element: <ChatRoomPage /> },
      { path: "profile", name: "profile", element: <ProfilePage /> },
      { path: "wallet", name: "wallet", element: <WalletPage /> },
      { path: "tasks", name: "tasks", element: <TasksRewardsPage /> },
      { path: "profile/:userId", name: "user-profile", element: <UserProfilePage /> },
      { path: "messages", name: "messages", element: <MessagesPage /> },
      { path: "explore", name: "explore", element: <ExplorePage /> },
      { path: "notifications", name: "notifications", element: <NotificationsPage /> },
      { path: "notification-settings", name: "notification-settings", element: <NotificationSettingsPage /> },
      { path: "admin", name: "admin", element: <AdminPage /> },
      /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
      { path: "*", name: "404", element: <NotFound /> },
    ],
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
