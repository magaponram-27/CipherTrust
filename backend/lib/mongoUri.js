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
  const protocolEnd = uri.indexOf('://');
  if (protocolEnd === -1) return uri;

  const protocol = uri.slice(0, protocolEnd + 3);
  if (!/^mongodb(?:\+srv)?:\/\//i.test(protocol)) return uri;

  const authority = uri.slice(protocol.length);
  const atIndex = authority.lastIndexOf('@');
  if (atIndex === -1) return uri;

  const credentials = authority.slice(0, atIndex);
  const separatorIndex = credentials.indexOf(':');
  if (separatorIndex === -1) return uri;

  const username = credentials.slice(0, separatorIndex);
  const password = credentials.slice(separatorIndex + 1);
  const hostAndPath = authority.slice(atIndex + 1);

  return `${protocol}${encodeCredential(username)}:${encodeCredential(password)}@${hostAndPath}`;
}

module.exports = normalizeMongoUri;
