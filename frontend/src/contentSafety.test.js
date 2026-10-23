import test from 'node:test';
import assert from 'node:assert/strict';
import {
  configureImageModelBackend,
  containsLinks,
  inspectImageSafety,
  inspectLinks
} from './contentSafety.js';

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

test('falls back to TensorFlow CPU when mobile WebGL is unavailable', async () => {
  const calls = [];
  const tensorflow = {
    async setBackend(name) {
      calls.push(name);
      if (name === 'webgl') throw new Error('WebGL is unavailable');
      return true;
    },
    async ready() {}
  };

  assert.equal(await configureImageModelBackend(tensorflow), 'cpu');
  assert.deepEqual(calls, ['webgl', 'cpu']);
});

test('classifies a reduced image and preserves safety thresholds', async () => {
  const canvas = { width: 224, height: 224 };
  let classifiedImage;
  const result = await inspectImageSafety(new Blob(), {
    prepareImage: async () => canvas,
    loadModel: async () => ({
      async classify(image) {
        classifiedImage = image;
        return [{ className: 'Porn', probability: 0.41 }];
      }
    })
  });

  assert.equal(classifiedImage, canvas);
  assert.deepEqual(result, {
    restricted: true,
    category: 'adult or sexually explicit image',
    confidence: 0.41
  });
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
});

test('reports image scan failures with the underlying reason', async () => {
  await assert.rejects(
    inspectImageSafety(new Blob(), {
      prepareImage: async () => { throw new Error('Browser could not decode HEIC'); },
      loadModel: async () => ({ classify: async () => [] })
    }),
    (error) => {
      assert.match(error.message, /could not decode HEIC/i);
      assert.match(error.message, /image was not sent or displayed/i);
      assert.equal(error.cause.message, 'Browser could not decode HEIC');
      return true;
    }
  );
});
