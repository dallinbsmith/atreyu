import { expect } from '@esm-bundle/chai';
import { ALLOWED_EMBED_HOSTS, isAllowedEmbedHost } from '../../../scripts/utils/security/embed-allowlist.js';

describe('isAllowedEmbedHost', () => {
  it('allows every host currently in the allowlist', () => {
    ALLOWED_EMBED_HOSTS.forEach((host) => {
      expect(isAllowedEmbedHost(`https://${host}/watch?v=abc123`)).to.be.true;
    });
  });

  it('rejects a host that is not on the allowlist', () => {
    expect(isAllowedEmbedHost('https://evil.example.com/embed')).to.be.false;
  });

  it('rejects a lookalike host that merely contains an allowed hostname as a substring', () => {
    // Guards against a naive .includes()-style check, which this exact
    // hostname-exact-match implementation is meant to avoid.
    expect(isAllowedEmbedHost('https://www.youtube.com.evil.example.com/watch')).to.be.false;
    expect(isAllowedEmbedHost('https://notwww.youtube.com/watch')).to.be.false;
  });

  it('checks hostname only, independent of scheme', () => {
    expect(isAllowedEmbedHost('http://player.vimeo.com/video/1')).to.be.true;
  });

  it('returns false — not a thrown error — for a malformed URL', () => {
    expect(() => isAllowedEmbedHost('not a url')).to.not.throw();
    expect(isAllowedEmbedHost('not a url')).to.be.false;
  });

  it('returns false for an empty string', () => {
    expect(isAllowedEmbedHost('')).to.be.false;
  });
});
