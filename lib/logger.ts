/**
 * Logger centralisé : en production, n’affiche pas les logs de debug/info
 * pour éviter fuites et bruit. En __DEV__, tout est affiché.
 */
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

function safeStringify(obj: unknown): string {
  try {
    return typeof obj === 'string' ? obj : JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

export const logger = {
  debug(tag: string, ...args: unknown[]) {
    if (isDev) {
      const msg = args.length ? args.map(a => (typeof a === 'object' ? safeStringify(a) : a)).join(' ') : '';
      console.log(`[${tag}]`, msg || '');
    }
  },
  info(tag: string, ...args: unknown[]) {
    if (isDev) {
      const msg = args.length ? args.map(a => (typeof a === 'object' ? safeStringify(a) : a)).join(' ') : '';
      console.log(`[${tag}]`, msg || '');
    }
  },
  warn(tag: string, ...args: unknown[]) {
    const msg = args.length ? args.map(a => (typeof a === 'object' ? safeStringify(a) : a)).join(' ') : '';
    console.warn(`[${tag}]`, msg || '');
  },
  error(tag: string, ...args: unknown[]) {
    const msg = args.length ? args.map(a => (typeof a === 'object' ? safeStringify(a) : a)).join(' ') : '';
    console.error(`[${tag}]`, msg || '');
  },
};
