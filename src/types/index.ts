export type UserLevel =
  | 'Newbie'
  | 'Cruiser'
  | 'Explorer'
  | 'Social Star'
  | 'Influencer'
  | 'Legend'
  | 'Celebrity'
  | 'Cruise King';

export type PostType = 'text' | 'confession' | 'poll' | 'meme' | 'story' | 'question';
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';
export type NotificationType = 'message' | 'friend_request' | 'like' | 'comment' | 'system';

export type XPReason =
  | 'daily_login'
  | 'send_message'
  | 'create_post'
  | 'receive_like'
  | 'add_comment'
  | 'join_room'
  | 'invite_friend'
  | 'win_game';

export interface Profile {
  id: string;
  username: string;
  avatar_id: string;
  bio: string;
  gender: string | null;
  state: string | null;
  country: string;
  interests: string[];
  level: UserLevel;
  xp: number;
  coins: number;
  is_online: boolean;
  last_seen: string;
  created_at: string;
  login_streak: number;
  longest_streak: number;
  mute_notifications: boolean;
  stealth_mode: boolean;
  posts_count: number;
  friends_count: number;
}

export interface ChatRoom {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  emoji_icon: string | null;
  member_count: number;
  is_active: boolean;
  created_at: string;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  type: string;
  created_at: string;
  profile?: Partial<Profile>;
}

export interface Post {
  id: string;
  user_id: string;
  type: PostType;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  is_anonymous: boolean;
  created_at: string;
  profile?: Partial<Profile>;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Partial<Profile>;
}

export interface PrivateMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  partner_id: string;
  last_message: string;
  last_time: string;
  unread_count: number;
  profile?: Partial<Profile>;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string | null;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

// ── Level System ──────────────────────────────────────────
export const LEVELS: { name: UserLevel; minXP: number; color: string; badge: string }[] = [
  { name: 'Newbie', minXP: 0, color: 'text-muted-foreground', badge: 'bg-muted/60' },
  { name: 'Cruiser', minXP: 500, color: 'text-blue-400', badge: 'bg-blue-500/15' },
  { name: 'Explorer', minXP: 2000, color: 'text-green-400', badge: 'bg-green-500/15' },
  { name: 'Social Star', minXP: 5000, color: 'text-cyan-400', badge: 'bg-cyan-500/15' },
  { name: 'Influencer', minXP: 15000, color: 'text-yellow-400', badge: 'bg-yellow-500/15' },
  { name: 'Legend', minXP: 35000, color: 'text-orange-400', badge: 'bg-orange-500/15' },
  { name: 'Celebrity', minXP: 75000, color: 'text-neon-pink', badge: 'bg-pink-500/15' },
  { name: 'Cruise King', minXP: 150000, color: 'text-neon-gold', badge: 'bg-amber-500/15' },
];

export function getLevelFromXP(xp: number): UserLevel {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return LEVELS[i].name;
  }
  return 'Newbie';
}

export function getLevelNumber(xp: number): number {
  // 1–100: each level needs progressively more XP
  return Math.min(100, Math.floor(Math.sqrt(xp / 15)) + 1);
}

export function getNextLevelXP(xp: number): number {
  const current = getLevelFromXP(xp);
  const idx = LEVELS.findIndex(l => l.name === current);
  return LEVELS[idx + 1]?.minXP ?? xp;
}

export const XP_REWARDS: Record<XPReason, number> = {
  daily_login: 25,
  send_message: 5,
  create_post: 10,
  receive_like: 3,
  add_comment: 8,
  join_room: 2,
  invite_friend: 50,
  win_game: 30,
};

// ── Avatars ───────────────────────────────────────────────
export const AVATARS = [
  { id: 'av1', gradient: 'from-purple-500 to-pink-500', emoji: '😎' },
  { id: 'av2', gradient: 'from-blue-500 to-cyan-500', emoji: '🤩' },
  { id: 'av3', gradient: 'from-green-500 to-emerald-500', emoji: '😄' },
  { id: 'av4', gradient: 'from-orange-500 to-red-500', emoji: '🔥' },
  { id: 'av5', gradient: 'from-pink-500 to-rose-500', emoji: '💖' },
  { id: 'av6', gradient: 'from-indigo-500 to-purple-500', emoji: '👑' },
  { id: 'av7', gradient: 'from-yellow-500 to-orange-500', emoji: '⚡' },
  { id: 'av8', gradient: 'from-teal-500 to-green-500', emoji: '🎯' },
  { id: 'av9', gradient: 'from-red-500 to-pink-500', emoji: '🎭' },
  { id: 'av10', gradient: 'from-cyan-500 to-blue-500', emoji: '🚀' },
  { id: 'av11', gradient: 'from-violet-500 to-indigo-500', emoji: '💎' },
  { id: 'av12', gradient: 'from-amber-500 to-yellow-500', emoji: '🌟' },
];

export const INTERESTS = [
  'Music', 'Football', 'Movies', 'Tech', 'Gaming', 'Fashion',
  'Business', 'Relationships', 'Travel', 'Food', 'Art', 'Fitness',
  'Crypto', 'Politics', 'Comedy', 'Books', 'Photography', 'Dance',
];

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti',
  'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
  'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
  'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
];

export const COUNTRY_STATE_OPTIONS: Record<string, string[]> = {
  Nigeria: NIGERIAN_STATES,
  Ghana: ['Ashanti', 'Greater Accra', 'Central', 'Eastern', 'Northern', 'Western', 'Volta', 'Oti', 'Bono', 'Ahafo'],
  Kenya: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu', 'Uasin Gishu', 'Machakos', 'Meru', 'Kakamega', 'Nyeri'],
  'South Africa': ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West', 'Free State', 'Northern Cape'],
  'United States': ['California', 'Texas', 'Florida', 'New York', 'Georgia', 'Virginia', 'Illinois', 'Washington', 'New Jersey', 'Massachusetts'],
  'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  Canada: ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan', 'Nova Scotia', 'New Brunswick'],
  India: ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Uttar Pradesh', 'West Bengal', 'Rajasthan', 'Punjab', 'Kerala'],
};

export const COUNTRY_OPTIONS = Object.keys(COUNTRY_STATE_OPTIONS);
