import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareImageForSending } from './imageProcessing.js';

test('leaves small JPEG, PNG, and animated GIF images unchanged', async () => {
  const file = new File(['small image'], 'photo.jpg', { type: 'image/jpeg' });
  const png = new File(['small image'], 'photo.png', { type: 'image/png' });
  const gif = new File(['small image'], 'animation.gif', { type: 'image/gif' });

  assert.equal(await prepareImageForSending(file), file);
  assert.equal(await prepareImageForSending(png), png);
  assert.equal(await prepareImageForSending(gif), gif);
});

test('normalizes small WebP photos to JPEG for cross-browser delivery', async () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  let dimensions;
  globalThis.createImageBitmap = async () => ({
    width: 800,
    height: 600,
    close() {}
  });
  globalThis.document = {
    createElement() {
      const canvas = {
        width: 0,
        height: 0,
        getContext() {
          return {
            fillRect() {},
            drawImage() { dimensions = [canvas.width, canvas.height]; },
            set fillStyle(_value) {}
          };
        },
        toBlob(callback, type) {
          callback(new Blob(['prepared image'], { type }));
        }
      };
      return canvas;
    }
  };

  try {
    const file = new File(['photo'], 'camera.webp', { type: 'image/webp' });
    const prepared = await prepareImageForSending(file);

    assert.equal(prepared.type, 'image/jpeg');
    assert.equal(prepared.name, 'camera.jpg');
    assert.deepEqual(dimensions, [800, 600]);
  } finally {
    if (originalCreateImageBitmap === undefined) delete globalThis.createImageBitmap;
    else globalThis.createImageBitmap = originalCreateImageBitmap;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('converts and downsizes HEIC photos to JPEG for mobile delivery', async () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  let dimensions;
  let bitmapClosed = false;
  globalThis.createImageBitmap = async () => ({
    width: 4000,
    height: 3000,
    close() { bitmapClosed = true; }
  });
  globalThis.document = {
    createElement() {
      const canvas = {
        width: 0,
        height: 0,
        getContext() {
          return {
            fillRect() {},
            drawImage() { dimensions = [canvas.width, canvas.height]; },
            set fillStyle(_value) {}
          };
        },
        toBlob(callback, type) {
          callback(new Blob(['prepared image'], { type }));
        }
      };
      return canvas;
    }
  };

  try {
    const file = new File(['photo'], 'camera.heic', { type: 'image/heic' });
    const prepared = await prepareImageForSending(file);

    assert.equal(prepared.type, 'image/jpeg');
    assert.equal(prepared.name, 'camera.jpg');
    assert.deepEqual(dimensions, [1920, 1440]);
    assert.equal(bitmapClosed, true);
  } finally {
    if (originalCreateImageBitmap === undefined) delete globalThis.createImageBitmap;
    else globalThis.createImageBitmap = originalCreateImageBitmap;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
