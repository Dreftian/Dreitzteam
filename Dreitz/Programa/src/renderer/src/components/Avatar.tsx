import type { User } from '../lib/types';

/**
 * Renders a user avatar.
 * `avatar` may be:
 *   - null/empty → gradient initial fallback
 *   - "data:..." base64 PNG/JPG → custom uploaded image
 *   - "game:<game_id>" → resolved against gameImageMap (capsule of owned game)
 *   - any URL → load directly
 */
export default function Avatar({
  user,
  size = 36,
  gameImageMap,
  className = ''
}: {
  user: Pick<User, 'username' | 'avatar'> | null;
  size?: number;
  gameImageMap?: Record<number, string>;
  className?: string;
}) {
  if (!user) return null;
  const src = resolveAvatar(user.avatar, gameImageMap);
  const initial = user.username.slice(0, 1).toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt={user.username}
        className={`rounded-full object-cover bg-bg-hover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`rounded-full bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center text-white font-bold ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </div>
  );
}

export function resolveAvatar(avatar: string | null | undefined, gameImageMap?: Record<number, string>): string | null {
  if (!avatar) return null;
  if (avatar.startsWith('data:') || avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('game:') && gameImageMap) {
    const gid = parseInt(avatar.slice(5), 10);
    return gameImageMap[gid] ?? null;
  }
  return null;
}
