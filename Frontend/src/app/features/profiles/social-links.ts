import { SocialPlatform } from '../../core/api/models';

export const MAX_SOCIAL_LINKS = 6;

export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  'Twitch',
  'YouTube',
  'X',
  'Instagram',
  'GitHub',
  'Steam',
  'Discord',
  'Website',
];

export const SOCIAL_DOMAINS: Readonly<Partial<Record<SocialPlatform, string>>> = {
  Twitch: 'twitch.tv',
  YouTube: 'youtube.com',
  X: 'x.com',
  Instagram: 'instagram.com',
  GitHub: 'github.com',
  Steam: 'steamcommunity.com',
  Discord: 'discord.gg',
};

export function socialLinkProblem(platform: SocialPlatform, url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `Link for ${platform} must be an absolute https url`;
  }
  if (parsed.protocol !== 'https:') {
    return `Link for ${platform} must be an absolute https url`;
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return `Link for ${platform} must not carry user info`;
  }
  const domain = SOCIAL_DOMAINS[platform];
  if (domain === undefined) {
    const host = parsed.hostname;
    if (host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':')) {
      return 'Website link must point at a public dns host';
    }
    return null;
  }
  if (parsed.hostname !== domain && !parsed.hostname.endsWith('.' + domain)) {
    return `Link for ${platform} must point at ${domain}`;
  }
  return null;
}
