import { useNavigate } from 'react-router-dom';
import { AvatarDisplay } from '@/components/profile/AvatarDisplay';

interface StoryUser {
  id: string;
  username: string;
  avatar_id: string;
  is_online: boolean;
}

interface StoriesRowProps {
  users: StoryUser[];
}

const ringGradients = [
  'from-purple-500 via-pink-500 to-orange-400',
  'from-blue-500 via-cyan-400 to-green-400',
  'from-pink-500 via-red-400 to-orange-400',
  'from-green-400 via-emerald-500 to-teal-500',
  'from-yellow-400 via-orange-400 to-red-500',
];

export function StoriesRow({ users }: StoriesRowProps) {
  const navigate = useNavigate();
  const displayUsers = users.slice(0, 10);

  if (displayUsers.length === 0) return null;

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide px-1">
      {displayUsers.map((user, i) => (
        <button
          key={user.id}
          className="flex flex-col items-center gap-1.5 flex-shrink-0 group active:scale-95 transition-transform"
          onClick={() => navigate(`/profile/${user.id}`)}
          title={`@${user.username}`}
        >
          {/* Story ring */}
          <div className={`p-0.5 rounded-full bg-gradient-to-br ${ringGradients[i % ringGradients.length]}`}>
            <div className="p-0.5 rounded-full bg-background">
              <AvatarDisplay avatarId={user.avatar_id} size="lg" isOnline={user.is_online} />
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground group-hover:text-foreground truncate max-w-[56px] font-medium transition-colors">
            @{user.username.slice(0, 8)}
          </span>
        </button>
      ))}
    </div>
  );
}
