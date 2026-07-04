# CruiseHub — Anonymous Social Discovery Platform

## Context
Building CruiseHub from scratch: a modern anonymous social platform for Nigerian youth. Dark mode default, purple/pink neon palette, glassmorphism aesthetic. First build focuses on: Landing Page → Auth → Home Feed → Chat Rooms. Backend via Enter Cloud (Supabase).

---

## Step 0: Enable Enter Cloud
- Trigger `supabase_enable` to connect the backend
- Supabase JS client is already installed (`@supabase/supabase-js`)

---

## Step 1: Design System (`index.css` + `tailwind.config.ts`)

### CSS Variables (dark mode by default)
```css
:root (dark defaults) {
  --background: 240 10% 4%;         /* near-black */
  --foreground: 0 0% 96%;
  --card: 240 8% 8%;                /* glass card base */
  --primary: 270 91% 65%;           /* purple #8B5CF6 */
  --primary-glow: 330 100% 71%;     /* pink #F472B6 */
  --accent: 300 80% 60%;            /* vibrant magenta */
  --neon-purple: 270 91% 65%;
  --neon-pink: 330 100% 71%;
  --neon-green: 142 76% 55%;        /* online indicator */
  --glass-bg: rgba(255,255,255,0.05)
  --glass-border: rgba(255,255,255,0.1)
  --gradient-hero: linear-gradient(135deg, hsl(270,91%,20%), hsl(300,80%,15%), hsl(240,10%,4%))
  --gradient-card: linear-gradient(135deg, hsl(270,91%,65%/0.15), hsl(330,100%,71%/0.08))
  --glow-purple: 0 0 30px hsl(270 91% 65% / 0.4)
  --glow-pink: 0 0 30px hsl(330 100% 71% / 0.4)
}
```

### Tailwind Extensions
- Custom colors: `neon-purple`, `neon-pink`, `neon-green`, `glass`
- Custom animations: `pulse-glow`, `float`, `slide-up`, `fade-in`, `gradient-shift`
- Custom keyframes for animated background

### ThemeProvider
- Wrap app in `next-themes` ThemeProvider defaulting to `dark`

---

## Step 2: File Structure

```
src/
  types/index.ts                  # All shared TypeScript types
  lib/supabase.ts                 # Supabase client init
  hooks/
    useAuth.ts                    # Auth state + helpers
    useProfile.ts                 # Profile CRUD
    useRealtime.ts                # Realtime subscriptions
  context/
    AuthContext.tsx               # Auth context provider
  components/
    layout/
      AppLayout.tsx               # App shell (sidebar + bottom nav)
      BottomNav.tsx               # Mobile bottom navigation
      Sidebar.tsx                 # Desktop sidebar
      TopBar.tsx                  # Header with search, notifs, coins
    landing/
      HeroSection.tsx
      FeaturesSection.tsx
      StatsSection.tsx
    feed/
      StoriesRow.tsx
      PostCard.tsx
      PollCard.tsx
      ConfessionCard.tsx
      CreatePostButton.tsx
    chat/
      RoomCard.tsx
      ChatMessage.tsx
      ChatInput.tsx
    profile/
      AvatarDisplay.tsx
      XPBar.tsx
      LevelBadge.tsx
  pages/
    LandingPage.tsx
    AuthPage.tsx                  # Multi-step registration + login
    HomePage.tsx                  # Feed
    ChatRoomsPage.tsx             # Room category grid
    ChatRoomPage.tsx              # Individual room
    ProfilePage.tsx
    MessagesPage.tsx
    ExplorePage.tsx
    NotificationsPage.tsx
```

---

## Step 3: Supabase Schema

### Tables to create via SQL Editor:

```sql
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_id text default 'av1',
  bio text default '',
  gender text,
  state text,
  country text default 'Nigeria',
  interests text[] default '{}',
  level text default 'Newbie',
  xp integer default 0,
  coins integer default 100,
  is_online boolean default false,
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Public profiles readable" on profiles for select using (true);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- chat_rooms (seed with categories)
create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  emoji_icon text,
  member_count integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);
alter table chat_rooms enable row level security;
create policy "Rooms public read" on chat_rooms for select using (true);

-- room_messages
create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references chat_rooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  content text not null,
  type text default 'text',
  created_at timestamptz default now()
);
alter table room_messages enable row level security;
create policy "Messages readable" on room_messages for select using (true);
create policy "Auth users can post" on room_messages for insert with check (auth.uid() = user_id);

-- posts (feed)
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text default 'text',
  content text not null,
  image_url text,
  likes_count integer default 0,
  comments_count integer default 0,
  is_anonymous boolean default false,
  created_at timestamptz default now()
);
alter table posts enable row level security;
create policy "Posts public read" on posts for select using (true);
create policy "Auth users create posts" on posts for insert with check (auth.uid() = user_id);

-- friendships
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references profiles(id) on delete cascade,
  addressee_id uuid references profiles(id) on delete cascade,
  status text default 'pending',
  created_at timestamptz default now(),
  unique(requester_id, addressee_id)
);
alter table friendships enable row level security;
create policy "Own friendships" on friendships for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "Create requests" on friendships for insert with check (auth.uid() = requester_id);

-- notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text not null,
  title text,
  body text,
  is_read boolean default false,
  created_at timestamptz default now()
);
alter table notifications enable row level security;
create policy "Own notifs" on notifications for select using (auth.uid() = user_id);
create policy "Mark read" on notifications for update using (auth.uid() = user_id);

-- Seed chat rooms
INSERT INTO chat_rooms (name, description, category, emoji_icon) VALUES
  ('General Vibes', 'Talk about anything', 'General', '💬'),
  ('Lagos Crew', 'Lagos people connect', 'City', '🌆'),
  ('Abuja Gang', 'FCT riders', 'City', '🏛️'),
  ('Students Hub', 'School talk & study', 'Education', '📚'),
  ('Relationship Talk', 'Love & connections', 'Social', '❤️'),
  ('Music Lovers', 'Afrobeats & more', 'Entertainment', '🎵'),
  ('Football Arena', 'AFCON, EPL, all things football', 'Sports', '⚽'),
  ('Tech Naija', 'Tech & startup talk', 'Technology', '💻'),
  ('Night Owls', 'Late night cruise', 'Social', '🌙'),
  ('Fashion Central', 'Style & drip', 'Lifestyle', '👗');
```

### Auth Settings in Supabase Dashboard:
- Enable Email auth
- Enable Google OAuth
- Auto-confirm emails (for dev) OR email verification

---

## Step 4: Router (`router.tsx`)
Routes:
- `/` → `LandingPage`
- `/auth` → `AuthPage` (login/register)
- `/home` → `HomePage` (protected)
- `/rooms` → `ChatRoomsPage` (protected)
- `/rooms/:id` → `ChatRoomPage` (protected)
- `/messages` → `MessagesPage` (protected)
- `/profile` → `ProfilePage` (protected)
- `/explore` → `ExplorePage` (protected)
- `/notifications` → `NotificationsPage` (protected)

---

## Step 5: Pages & Components (Detailed)

### LandingPage
- Animated gradient mesh background (CSS keyframes)
- Floating particles effect (CSS animation)
- Hero: "Cruise. Connect. Belong." tagline + CTA buttons
- Feature cards (glassmorphism): Anonymous Identity, Chat Rooms, Games, AI Matches
- Stats row: "500K+ Cruisers", "1000+ Rooms", "50+ Cities"
- Navigation header with logo + "Join Now" button

### AuthPage (multi-step)
Step 1: Choose mode (Login / Register)
Step 2 (Register): Username + Email + Password
Step 3: DOB + Gender
Step 4: State + Interests (Nigerian states + interest tags)
Step 5: Avatar selection (12 pre-made avatars grid)
- Progress bar between steps
- Animated transitions between steps using framer-motion

### HomePage
- TopBar (logo, search, notifications bell, coins display, XP badge)
- StoriesRow (horizontal scroll of active users with glow rings)
- Feed posts (infinite-scroll feel, using seeded mock posts initially)
- Post types: text, confession (blurred author), poll, question
- Floating Create Post button (FAB)
- Right sidebar (desktop): AI suggestions, trending rooms, leaderboard

### ChatRoomsPage
- Category filter tabs (All, General, City, Education, Entertainment...)
- Room cards grid: name, description, member count, activity indicator
- Glassmorphism cards with hover glow effect
- "Active Now" badge on rooms with recent activity

### ChatRoomPage
- Room header: name, member count, category
- Message list with user avatars, usernames, timestamps
- Realtime via Supabase realtime subscriptions
- ChatInput: text + emoji picker placeholder + send button
- Pinned message section (if any)

### ProfilePage
- Avatar with animated ring
- Username, level badge, online status
- XP progress bar with level labels
- Coins display
- Interests tags
- Bio
- Stats: Friends, Rooms Joined, Posts

---

## Step 6: Key Hooks

### `useAuth.ts`
- `signUp(email, password)` → creates auth user + profile row
- `signIn(email, password)`
- `signOut()`
- `user` state, `loading` state
- `AuthContext` with `useAuth()` hook

### `useProfile.ts`
- `getProfile(userId)`
- `updateProfile(data)`
- `updateXP(amount)` 
- Current user's profile state

### `useRealtime.ts`
- Subscribe to `room_messages` for specific room_id
- Subscribe to `notifications` for current user
- Cleanup on unmount

---

## Step 7: Avatar System
12 built-in avatars using colorful geometric SVG avatars rendered via CSS (no image uploads needed). Each has a unique gradient background + emoji/icon combination. Stored as `avatar_id` (av1–av12).

---

## Step 8: Navigation
### BottomNav (mobile, fixed bottom)
Icons: Home, Rooms, Create, Messages, Profile

### Sidebar (desktop, fixed left)
Full labels with icons, active state with neon highlight.

### TopBar
- CruiseHub logo (neon purple text)
- Search input
- Notification bell (with badge count)
- Coin display (coin icon + count)
- Avatar mini (click → profile)

---

## Files to Create/Modify
1. `src/index.css` — full redesign with CruiseHub tokens
2. `tailwind.config.ts` — extended colors + animations
3. `src/main.tsx` — add ThemeProvider
4. `src/router.tsx` — all routes
5. `src/lib/supabase.ts` — client
6. `src/types/index.ts` — shared types
7. `src/context/AuthContext.tsx`
8. `src/hooks/useAuth.ts`
9. `src/hooks/useProfile.ts`
10. `src/hooks/useRealtime.ts`
11. `src/components/layout/AppLayout.tsx`
12. `src/components/layout/BottomNav.tsx`
13. `src/components/layout/Sidebar.tsx`
14. `src/components/layout/TopBar.tsx`
15. `src/components/feed/StoriesRow.tsx`
16. `src/components/feed/PostCard.tsx`
17. `src/components/feed/PollCard.tsx`
18. `src/components/profile/AvatarDisplay.tsx`
19. `src/components/profile/XPBar.tsx`
20. `src/components/profile/LevelBadge.tsx`
21. `src/components/chat/RoomCard.tsx`
22. `src/components/chat/ChatMessage.tsx`
23. `src/components/chat/ChatInput.tsx`
24. `src/pages/LandingPage.tsx`
25. `src/pages/AuthPage.tsx`
26. `src/pages/HomePage.tsx`
27. `src/pages/ChatRoomsPage.tsx`
28. `src/pages/ChatRoomPage.tsx`
29. `src/pages/ProfilePage.tsx`
30. `src/pages/MessagesPage.tsx`
31. `src/pages/ExplorePage.tsx`
32. `src/pages/NotificationsPage.tsx`

---

## Verification
1. Landing page loads with animated gradient and glassmorphism cards
2. Register flow completes all 5 steps, creates Supabase auth user + profile row
3. Login redirects to Home Feed with user's avatar/XP visible
4. Home feed shows posts (initially seeded/mock, then from DB)
5. Chat Rooms grid loads from Supabase, clicking a room opens message view
6. Realtime messages appear without refresh in Chat Room
7. Mobile bottom nav and desktop sidebar both work
8. Dark mode is default; light mode toggle works
