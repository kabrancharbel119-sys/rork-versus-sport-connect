/**
 * Crash reporting : envoi des erreurs à Sentry si EXPO_PUBLIC_SENTRY_DSN est défini.
 * Sans DSN, reportError est un no-op (l'app fonctionne normalement).
 */
const dsn =
  typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_SENTRY_DSN : undefined;

let sentryCaptureException: ((err: unknown) => void) | null = null;

function init() {
  if (!dsn || sentryCaptureException !== null) return;
  try {
    // Optionnel : si @sentry/react-native n'est pas installé, on reste en no-op
    const Sentry = require("@sentry/react-native").default;
    if (Sentry && typeof Sentry.init === "function") {
      Sentry.init({
        dsn,
        enableInExpoDevelopment: false,
        debug: false,
        tracesSampleRate: 0.2,
      });
      sentryCaptureException = (err: unknown) => {
        Sentry.captureException(err);
      };
    }
  } catch {
    sentryCaptureException = null;
  }
}

/** À appeler au démarrage de l'app (ex. dans _layout). */
export function initCrashReporting(): void {
  init();
}

/** Envoie une erreur à Sentry si configuré. À appeler depuis ErrorBoundary, etc. */
export function reportError(error: unknown): void {
  if (sentryCaptureException) {
    try {
      sentryCaptureException(error);
    } catch {
      // ignore
    }
  }
}
