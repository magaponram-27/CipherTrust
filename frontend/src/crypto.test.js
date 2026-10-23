import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { decryptFile, encryptFile } from './crypto.js';

globalThis.crypto ||= webcrypto;

test('encrypts image bytes directly and decrypts them without changing the content', async () => {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const original = new Uint8Array([0, 1, 2, 127, 128, 255]);
  const file = new Blob([original], { type: 'image/png' });

  const encrypted = await encryptFile(file, key);
  const dataUrl = await decryptFile(encrypted.ciphertext, encrypted.iv, encrypted.fileType, key);
  const decoded = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

  assert.equal(encrypted.fileType, 'image/png');
  assert.deepEqual(decoded, Buffer.from(original));
  assert.equal(dataUrl.startsWith('data:image/png;base64,'), true);
});

test('encrypted image bytes do not contain the original image data', async () => {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const original = new Uint8Array([67, 105, 112, 104, 101, 114, 84, 114, 117, 115, 116]);
  const encrypted = await encryptFile(new Blob([original], { type: 'image/jpeg' }), key);
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');

  assert.notDeepEqual(ciphertext, Buffer.from(original));
  assert.equal(encrypted.ciphertext.includes(Buffer.from(original).toString('base64')), false);
});
