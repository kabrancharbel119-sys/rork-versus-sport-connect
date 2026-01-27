/**
 * Base URL for API (auth, tRPC, etc.).
 * Returns origin only (scheme + host + port), no path, so we never hit /node_modules/... by mistake.
 */
export function getApiBaseUrl(): string {
  const raw =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_RORK_API_BASE_URL?.trim()) ?? '';

  if (!raw) return '';

  if (raw.includes('node_modules') || !/^https?:\/\//i.test(raw)) {
    return '';
  }

  try {
    const u = new URL(raw);
    return u.origin;
  } catch {
    return raw.replace(/\/+$/, '');
  }
}
