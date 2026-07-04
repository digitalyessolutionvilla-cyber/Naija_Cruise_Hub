# CruiseHub — Full Production Implementation

## Context
The platform currently contains mock data arrays, non-functional buttons, hardcoded numbers, and placeholder UI. This plan removes ALL mock data and replaces every feature with a real backend-connected implementation.

---

## Step 1: Database Migrations (single combined script)

### New Tables
```sql
-- post_likes: prevents double-liking, enables real like count
create table public.post_likes (
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

-- post_comments
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- private_messages
create table public.private_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id) on delete cascade,
  receiver_id uuid references profiles(id) on delete cascade,
  content text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- xp_transactions log
create table public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  amount integer not null,
  reason text not null,
  created_at timestamptz default now()
);

-- daily_logins: tracks streak
create table public.daily_logins (
  user_id uuid references profiles(id) on delete cascade,
  login_date date not null default current_date,
  primary key (user_id, login_date)
);
```

### Profile Column Additions
```sql
alter table profiles
  add column login_streak integer default 0,
  add column longest_streak integer default 0;
```

### Postgres Functions (security definer)
```sql
-- award_xp: XP + level update + level-up notification
create function public.award_xp(p_user_id uuid, p_amount integer, p_reason text)
...

-- claim_daily_login: idempotent daily reward
create function public.claim_daily_login(p_user_id uuid)
...

-- get_conversations: last message per conversation partner
create function public.get_conversations(p_user_id uuid)
returns table(partner_id uuid, last_message text, last_time timestamptz, unread_count bigint)
...
```

### Triggers
- `post_likes` INSERT/DELETE → update `posts.likes_count`
- `post_comments` INSERT/DELETE → update `posts.comments_count`

### Realtime
```sql
alter publication supabase_realtime add table public.private_messages;
alter publication supabase_realtime add table public.notifications;
```

---

## Step 2: Updated Types (`src/types/index.ts`)

- Expand `UserLevel`: add `'Social Star'` and `'Cruise King'`
- Update `LEVELS` array with correct XP thresholds (8 tiers)
- Add helper functions:
  - `getLevelFromXP(xp): UserLevel`
  - `getLevelNumber(xp): number` (1–100 computed)
  - `getNextLevelXP(xp): number`
- Add new interfaces: `PostComment`, `PrivateMessage`, `Conversation`
- Add `login_streak` / `longest_streak` to `Profile`

---

## Step 3: New Hooks

### `src/hooks/useXP.ts`
- `awardXP(reason: XPReason)` — calls `supabase.rpc('award_xp', ...)`, refreshes profile in AuthContext

### `src/hooks/usePosts.ts`
- `fetchPosts(tab: 'trending'|'recent')` — real DB query with profile join
- `fetchLikedPostIds(userId)` — loads which posts user already liked
- `likePost(postId)` / `unlikePost(postId)` — optimistic update on post_likes
- `createPost(data)` — insert + award 10 XP

### `src/hooks/useNotifications.ts`
- `fetchNotifications()` — real DB query
- `markRead(id)` / `markAllRead()` — update `is_read`
- Realtime subscription on `notifications` table

### `src/hooks/useMessages.ts`
- `fetchConversations()` — calls `supabase.rpc('get_conversations', ...)`
- `fetchMessages(partnerId)` — query private_messages for a conversation
- `sendMessage(receiverId, content)` — insert + award 5 XP
- Realtime subscription on `private_messages`

---

## Step 4: Updated AuthContext

- On successful sign-in / auth state change: call `supabase.rpc('claim_daily_login', {p_user_id: user.id})`
- Expose `loginStreak` from profile
- Expose `refreshProfile()` so hooks can trigger profile re-fetch after XP award

---

## Step 5: New Component — CreatePostModal

**`src/components/feed/CreatePostModal.tsx`**
- Radix Dialog triggered by FAB (+) button in HomePage
- Post type selector: Text | Confession | Question | Meme
- Textarea with 280 char limit counter
- Anonymous toggle (for Confession type)
- "Post" button: disabled when empty, calls `createPost()`, closes modal, toasts success
- Awards 10 XP on submit

---

## Step 6: Updated PostCard

**`src/components/feed/PostCard.tsx`**
- Accept `isLiked: boolean` prop (from parent fetching liked post IDs)
- `handleLike`: insert/delete from post_likes (no direct likes_count update — triggers handle it)
- Optimistic UI update on like/unlike
- Comment button: navigate to post detail or open comment sheet (simple approach: show count only)
- All buttons trigger real backend actions

---

## Step 7: Page Updates (Remove All Mock Data)

### `HomePage.tsx`
- Remove `MOCK_POSTS`, `MOCK_STORY_USERS`, `SUGGESTED_ROOMS`
- Use `usePosts` hook for real feed
- Stories row: query `profiles` where `is_online = true` (limit 10, exclude self)
- Right sidebar: query top 3 chat rooms from DB by `member_count`
- Daily streak: read `profile.login_streak` (real value)
- FAB: opens `CreatePostModal`
- Empty state if no posts: "Be the first to post!"

### `ChatRoomPage.tsx`
- Remove `MOCK_MESSAGES_MAP` and all hardcoded message arrays
- Only show real messages from DB + realtime
- Empty state: "No messages yet. Be the first to say something!"

### `MessagesPage.tsx`
- Remove `MOCK_CONVERSATIONS`
- Use `useMessages` hook → `fetchConversations()`
- Navigate to `/messages/:partnerId` for conversation view
- Empty state if no conversations

### `ExplorePage.tsx`
- Remove `SUGGESTED_USERS` array and `AI_PICKS` array
- Fetch real users from profiles (exclude self, exclude already-friends)
- Fetch real room suggestions (based on user interests from profile)
- "Add Friend" button: inserts into `friendships`, updates button to "Requested"
- "Join" button on rooms: navigates to room, increments member_count

### `NotificationsPage.tsx`
- Remove `MOCK_NOTIFICATIONS`
- Use `useNotifications` hook for real data
- Realtime: new notifications appear instantly
- "Mark all read" button: calls `markAllRead()` (real backend call)
- Empty state: "No notifications yet"

### `ProfilePage.tsx`
- Real stats query: COUNT from friendships, room_messages, posts tables
- `login_streak` from `profile.login_streak`
- All settings rows have real actions (Sign Out works, Share Profile copies URL, etc.)
- Stealth Mode toggle: saves to profile via `updateProfile()`
- Mute Notifications toggle: saves to profile (add `mute_notifications` column)

---

## Files to Modify
1. `supabase/migrations/` — combined migration script
2. `src/types/index.ts`
3. `src/context/AuthContext.tsx`
4. `src/hooks/useXP.ts` (new)
5. `src/hooks/usePosts.ts` (new)
6. `src/hooks/useNotifications.ts` (new)
7. `src/hooks/useMessages.ts` (new)
8. `src/components/feed/CreatePostModal.tsx` (new)
9. `src/components/feed/PostCard.tsx`
10. `src/pages/HomePage.tsx`
11. `src/pages/ChatRoomPage.tsx`
12. `src/pages/MessagesPage.tsx`
13. `src/pages/ExplorePage.tsx`
14. `src/pages/NotificationsPage.tsx`
15. `src/pages/ProfilePage.tsx`

---

## Verification
- Sign up → daily login fires, XP+coins awarded, notification created
- Create post → appears in feed, XP awarded to author
- Like post → heart fills, count updates, author gets XP
- Send room message → appears realtime for all viewers, sender gets XP
- Add friend → status changes to "Requested", notification sent
- Notifications page → shows real system/social notifications
- Messages page → shows real conversations
- Profile stats → match actual DB counts
