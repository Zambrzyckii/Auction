import { OwnProfile as OwnProfileDto } from '../../core/api/models';
import { AVATAR_MAX_BYTES, addFriendProblem, avatarFileProblem, relationTo } from './profile-rules';

const MY_ID = '26a451d4-dd74-4a58-859f-636aca258443';
const PLAYER_ID = 'deadbeef-1111-2222-3333-444444444444';

function me(overrides: Partial<OwnProfileDto>): OwnProfileDto {
  return {
    userId: MY_ID,
    username: 'probe1',
    isPrivate: false,
    level: 2,
    memberSince: '2026-11-01T00:00:00Z',
    avatarUrl: null,
    friends: [],
    incomingFriendRequests: [],
    outgoingFriendRequests: [],
    socialLinks: [],
    ...overrides,
  };
}

describe('relationTo', () => {
  it('says self for my own id', () => {
    expect(relationTo(me({}), MY_ID)).toBe('self');
  });

  it('says friend for a listed friend', () => {
    expect(relationTo(me({ friends: [{ userId: PLAYER_ID, username: 'alice' }] }), PLAYER_ID)).toBe(
      'friend',
    );
  });

  it('says incoming when they asked me', () => {
    const mine = me({
      incomingFriendRequests: [{ publicFriendshipId: 'fr-1', userId: PLAYER_ID, username: 'a' }],
    });
    expect(relationTo(mine, PLAYER_ID)).toBe('incoming');
  });

  it('says outgoing when I asked them', () => {
    const mine = me({
      outgoingFriendRequests: [{ publicFriendshipId: 'fr-2', userId: PLAYER_ID, username: 'a' }],
    });
    expect(relationTo(mine, PLAYER_ID)).toBe('outgoing');
  });

  it('says none for a stranger', () => {
    expect(relationTo(me({}), PLAYER_ID)).toBe('none');
  });
});

describe('addFriendProblem', () => {
  it('accepts a fresh guid', () => {
    expect(addFriendProblem(PLAYER_ID, me({}))).toBeNull();
  });

  it('rejects text that is not a guid', () => {
    expect(addFriendProblem('alice', me({}))).toMatch(/player id/i);
  });

  it('rejects my own id with the server text', () => {
    expect(addFriendProblem(MY_ID, me({}))).toBe('You cannot befriend yourself');
  });

  it('rejects an existing relation with the server text', () => {
    const existing = 'Friendship or a pending request already exists';
    expect(
      addFriendProblem(PLAYER_ID, me({ friends: [{ userId: PLAYER_ID, username: 'x' }] })),
    ).toBe(existing);
    expect(
      addFriendProblem(
        PLAYER_ID,
        me({
          outgoingFriendRequests: [{ publicFriendshipId: 'f', userId: PLAYER_ID, username: 'x' }],
        }),
      ),
    ).toBe(existing);
  });

  it('lets a crossed incoming request through for the auto-accept', () => {
    expect(
      addFriendProblem(
        PLAYER_ID,
        me({
          incomingFriendRequests: [{ publicFriendshipId: 'f', userId: PLAYER_ID, username: 'x' }],
        }),
      ),
    ).toBeNull();
  });

  it('rejects the 101st friend', () => {
    const friends = Array.from({ length: 100 }, (_, i) => ({
      userId: `user-${i}`,
      username: `u${i}`,
    }));
    expect(addFriendProblem(PLAYER_ID, me({ friends }))).toMatch(/100/);
  });
});

describe('avatarFileProblem', () => {
  it('accepts a small png', () => {
    const file = new File([new Uint8Array(16)], 'a.png', { type: 'image/png' });
    expect(avatarFileProblem(file)).toBeNull();
  });

  it('rejects an empty file', () => {
    const file = new File([], 'a.png', { type: 'image/png' });
    expect(avatarFileProblem(file)).toBe('Avatar file is empty');
  });

  it('rejects a type outside jpeg, png and webp', () => {
    const file = new File([new Uint8Array(16)], 'a.gif', { type: 'image/gif' });
    expect(avatarFileProblem(file)).toBe('Avatar file must be a jpeg, png or webp image');
  });

  it('rejects a file over the byte limit', () => {
    const file = new File([new Uint8Array(AVATAR_MAX_BYTES + 1)], 'big.png', {
      type: 'image/png',
    });
    expect(avatarFileProblem(file)).toBe(
      `Avatar file exceeds the limit of ${AVATAR_MAX_BYTES} bytes`,
    );
  });
});
