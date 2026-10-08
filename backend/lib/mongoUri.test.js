const test = require('node:test');
const assert = require('node:assert/strict');
const normalizeMongoUri = require('./mongoUri');

test('encodes reserved characters in MongoDB credentials', () => {
  const uri = 'mongodb+srv://ciphertrust_app:p@ss:/?#[]+@cluster0.example.net/ciphertrust';

  assert.equal(
    normalizeMongoUri(uri),
    'mongodb+srv://ciphertrust_app:p%40ss%3A%2F%3F%23%5B%5D%2B@cluster0.example.net/ciphertrust'
  );
});

test('does not double-encode percent-encoded credentials', () => {
  const uri = 'mongodb+srv://ciphertrust_app:p%40ss@cluster0.example.net/ciphertrust';

  assert.equal(normalizeMongoUri(uri), uri);
});

test('leaves MongoDB URIs without credentials unchanged', () => {
  const uri = 'mongodb+srv://cluster0.example.net/ciphertrust?retryWrites=true';

  assert.equal(normalizeMongoUri(uri), uri);
});
