import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectGeneratorMetadata } from './aiDetect.js';

test('reports known image generator metadata without claiming image authenticity', async () => {
  const file = new Blob(['generator=Stable Diffusion'], { type: 'image/png' });

  assert.deepEqual(await inspectGeneratorMetadata(file), {
    verdict: 'AI generator metadata found',
    markers: ['stable diffusion']
  });
});

test('does not treat missing generator metadata as proof an image is real', async () => {
  const file = new Blob(['ordinary image metadata'], { type: 'image/jpeg' });

  assert.deepEqual(await inspectGeneratorMetadata(file), {
    verdict: 'No known AI generator metadata found',
    markers: []
  });
});
