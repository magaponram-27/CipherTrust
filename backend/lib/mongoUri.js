function encodeCredential(value) {
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  return encodeURIComponent(decoded);
}

function normalizeMongoUri(uri) {
  if (typeof uri !== 'string') return uri;

  const protocolEnd = uri.indexOf('://');
  if (protocolEnd === -1) return uri;

  const protocol = uri.slice(0, protocolEnd + 3);
  if (!/^mongodb(?:\+srv)?:\/\//i.test(protocol)) return uri;

  const authority = uri.slice(protocol.length);
  const atIndex = authority.lastIndexOf('@');
  if (atIndex === -1) return uri;

  const credentials = authority.slice(0, atIndex);
  const separatorIndex = credentials.indexOf(':');
  const hostAndPath = authority.slice(atIndex + 1);
  const username = separatorIndex === -1 ? credentials : credentials.slice(0, separatorIndex);
  const password = separatorIndex === -1 ? '' : credentials.slice(separatorIndex + 1);
  const encodedUsername = encodeCredential(username);

  if (separatorIndex === -1) {
    return `${protocol}${encodedUsername}@${hostAndPath}`;
  }

  return `${protocol}${encodedUsername}:${encodeCredential(password)}@${hostAndPath}`;
}

module.exports = normalizeMongoUri;
