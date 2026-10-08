const encoder = new TextEncoder();
const decoder = new TextDecoder();
function identityStorageKey(username) {
  return `ciphertrust.identity.v1.${username.toLowerCase()}`;
}

function toBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
  }
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function deriveKey(password, username) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode(`ciphertrust_${username.toLowerCase()}`), iterations: 100_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptMessage(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
  return { ciphertext: toBase64(new Uint8Array(encrypted)), iv: toBase64(iv) };
}

export async function decryptMessage(ciphertextB64, ivB64, key) {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivB64) },
      key,
      fromBase64(ciphertextB64)
    );
    return decoder.decode(decrypted);
  } catch {
    return '[Decryption failed]';
  }
}

export async function encryptFile(file, key) {
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const dataUrl = `data:${file.type || 'application/octet-stream'};base64,${toBase64(fileBytes)}`;
  return encryptMessage(dataUrl, key);
}

export async function createOrUnlockIdentity(vaultKey, username, registeredPublicKey = '') {
  const storageKey = identityStorageKey(username);
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    let privateKey;
    let record;
    try {
      record = JSON.parse(stored);
      const privateBytes = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromBase64(record.iv) },
        vaultKey,
        fromBase64(record.privateKey)
      );
      privateKey = await crypto.subtle.importKey(
        'pkcs8',
        privateBytes,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey']
      );
    } catch {
      throw new Error('Could not unlock this device identity. Check your password and use the browser profile where this account was set up.');
    }
    if (registeredPublicKey && record.publicKey !== registeredPublicKey) {
      throw new Error('This browser identity does not match the account’s registered encryption key. Sign in from the browser profile where the account was originally set up.');
    }
    return { privateKey, publicKey: record.publicKey };
  }

  if (registeredPublicKey) {
    throw new Error('This account already has an encryption identity, but it is not saved in this browser. Sign in from the original browser profile and app address. Do not clear its saved site data; without that identity, old messages cannot be recovered.');
  }

  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const privateBytes = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedPrivate = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vaultKey, privateBytes);
  localStorage.setItem(storageKey, JSON.stringify({
    publicKey: JSON.stringify(publicJwk),
    privateKey: toBase64(new Uint8Array(encryptedPrivate)),
    iv: toBase64(iv)
  }));
  return { privateKey: pair.privateKey, publicKey: JSON.stringify(publicJwk) };
}

export async function deriveConversationKey(privateKey, peerPublicKey) {
  const jwk = JSON.parse(peerPublicKey);
  const publicKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
