import test from 'node:test';
import assert from 'node:assert/strict';
import { containsLinks, inspectLinks } from './contentSafety.js';

test('flags known URL shorteners without fetching the destination', () => {
  const [link] = inspectLinks('Please check https://bit.ly/example');

  assert.equal(link.url, 'https://bit.ly/example');
  assert.match(link.reasons.join(' '), /hides its final destination/i);
});

test('flags brand impersonation domains', () => {
  const [link] = inspectLinks('Sign in at https://paypal.com.security-check.example/login');

  assert.match(link.reasons.join(' '), /mentions paypal/i);
});

test('flags a trusted brand domain embedded in an unrelated URL path', () => {
  const [link] = inspectLinks(
    'nobell.it/70ffb52d079109dca5664cce6f317373782/login.SkyPe.com/en/cgi-bin/verification/login/70ffb52d...'
  );

  assert.equal(link.url.startsWith('nobell.it/'), true);
  assert.match(link.reasons.join(' '), /mentions skype/i);
  assert.match(link.reasons.join(' '), /recognized domains/i);
});

test('flags links with embedded credentials and raw IP hosts', () => {
  const credentialLink = inspectLinks('https://user:pass@unknown.example/login')[0];
  const ipLink = inspectLinks('http://192.0.2.10/login')[0];

  assert.match(credentialLink.reasons.join(' '), /login credentials/i);
  assert.ok(ipLink.reasons.some((reason) => /raw IP address/i.test(reason)));
  assert.ok(ipLink.reasons.some((reason) => /HTTPS/i.test(reason)));
});

test('does not flag ordinary trusted or unknown HTTPS domains', () => {
  assert.deepEqual(inspectLinks('https://paypal.com and https://news.example.org'), []);
});

test('flags sign-in pages hosted on unrecognized domains', () => {
  const [link] = inspectLinks('https://blog.testsite.io/login');

  assert.match(link.reasons.join(' '), /sign-in or account-verification page/i);
});

test('flags dashboard pages on unrecognized domains for caution', () => {
  const [link] = inspectLinks('https://www.testsite.net/dashboard');

  assert.match(link.reasons.join(' '), /sign-in or account-verification page/i);
});

test('reports links for analysis even when no suspicious pattern is found', () => {
  assert.equal(containsLinks('https://api.example.org/products'), true);
  assert.equal(inspectLinks('https://api.example.org/products').length, 0);
  assert.equal(containsLinks('ordinary message without a link'), false);
});

test('flags a lookalike brand domain with a substituted digit', () => {
  const [link] = inspectLinks('https://paypa1.example/checkout');

  assert.match(link.reasons.join(' '), /closely resembles the paypal name/i);
});

test('flags suspicious redirects in account-related URLs', () => {
  const [link] = inspectLinks('https://random.example/login?next=https%3A%2F%2Flogin.example');

  assert.match(link.reasons.join(' '), /redirect parameter/i);
});

test('flags login paths on commonly abused top-level domains', () => {
  const [link] = inspectLinks('https://secure-login.example.zip/access');

  assert.ok(link.reasons.some((reason) => /top-level domain/i.test(reason)));
  assert.ok(link.reasons.some((reason) => /sign-in or account-verification/i.test(reason)));
});

test('warns about urgent account links even when they use HTTPS', () => {
  const [link] = inspectLinks('Your account is locked. Verify now: https://random.example/continue');

  assert.ok(link.reasons.some((reason) => /urgent account-verification language/i.test(reason)));
});

test('does not flag account pages on a recognized brand domain for path alone', () => {
  assert.deepEqual(inspectLinks('https://www.netflix.com/login'), []);
});

test('ignores malformed URLs instead of interrupting message handling', () => {
  assert.doesNotThrow(() => inspectLinks('Broken link https://'));
  assert.deepEqual(inspectLinks('Broken link https://'), []);
});

test('recognizes bare domains and flags encoded lookalike characters', () => {
  const [link] = inspectLinks('Visit https://аррӏе.com/login');

  assert.ok(link.reasons.some((reason) => /encoded characters/i.test(reason)));
});
