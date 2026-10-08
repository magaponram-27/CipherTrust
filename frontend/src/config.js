const configuredApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const apiBaseUrl = (/^[a-z][a-z\d+.-]*:\/\//i.test(configuredApiUrl)
  ? configuredApiUrl
  : `https://${configuredApiUrl}`).replace(/\/+$/, '');
