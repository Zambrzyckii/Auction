import { OwnProfile as OwnProfileDto } from '../../core/api/models';

export type Relation = 'self' | 'friend' | 'incoming' | 'outgoing' | 'none';

export function relationTo(me: OwnProfileDto, userId: string): Relation {
  if (me.userId === userId) return 'self';
  if (me.friends.some((f) => f.userId === userId)) return 'friend';
  if (me.incomingFriendRequests.some((r) => r.userId === userId)) return 'incoming';
  if (me.outgoingFriendRequests.some((r) => r.userId === userId)) return 'outgoing';
  return 'none';
}

const MAX_FRIENDS = 100;
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function addFriendProblem(userId: string, me: OwnProfileDto): string | null {
  if (!GUID_RE.test(userId)) return 'Enter a player id (a GUID).';
  if (userId === me.userId) return 'You cannot befriend yourself';
  const known =
    me.friends.some((f) => f.userId === userId) ||
    me.outgoingFriendRequests.some((r) => r.userId === userId);
  if (known) return 'Friendship or a pending request already exists';
  if (me.friends.length >= MAX_FRIENDS) return `You already have ${MAX_FRIENDS} friends.`;
  return null;
}

export const AVATAR_MAX_BYTES = 2_097_152;

export const AVATAR_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];

export function avatarFileProblem(file: File): string | null {
  if (file.size > AVATAR_MAX_BYTES)
    return `Avatar file exceeds the limit of ${AVATAR_MAX_BYTES} bytes`;
  if (file.size === 0) return 'Avatar file is empty';
  if (!AVATAR_TYPES.some((a) => file.type === a))
    return 'Avatar file must be a jpeg, png or webp image';
  return null;
}
