import { socialLinkProblem } from './social-links';

describe('socialLinkProblem', () => {
  it('accepts a valid platform link', () => {
    expect(socialLinkProblem('GitHub', 'https://github.com/probe')).toBeNull();
  });

  it('accepts a subdomain of the platform domain', () => {
    expect(socialLinkProblem('YouTube', 'https://www.youtube.com/@probe')).toBeNull();
  });

  it('rejects a non-https or relative url', () => {
    expect(socialLinkProblem('GitHub', 'http://github.com/probe')).toMatch(/absolute https/);
    expect(socialLinkProblem('GitHub', 'github.com/probe')).toMatch(/absolute https/);
  });

  it('rejects user info in the url', () => {
    expect(socialLinkProblem('GitHub', 'https://evil@github.com/probe')).toMatch(/user info/);
  });

  it('rejects a foreign host, youtu.be and twitter.com included', () => {
    expect(socialLinkProblem('YouTube', 'https://youtu.be/x')).toMatch(/youtube\.com/);
    expect(socialLinkProblem('X', 'https://twitter.com/probe')).toMatch(/x\.com/);
  });

  it('rejects a host that merely ends with the domain text', () => {
    expect(socialLinkProblem('GitHub', 'https://evilgithub.com/probe')).toMatch(/github\.com/);
  });

  it('accepts any public https host for Website', () => {
    expect(socialLinkProblem('Website', 'https://example.org/me')).toBeNull();
  });

  it('rejects localhost and ip hosts for Website', () => {
    expect(socialLinkProblem('Website', 'https://localhost/x')).toMatch(/public dns host/);
    expect(socialLinkProblem('Website', 'https://127.0.0.1/x')).toMatch(/public dns host/);
  });
});
