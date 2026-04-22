import { Router } from 'expo-router';

/**
 * Safe back navigation — avoids GO_BACK not handled warning when there is
 * no previous screen in the stack (e.g. deep link / notification tap).
 * Falls back to the provided fallback route.
 */
export function safeBack(router: Router, fallback: string = '/(tabs)/(home)') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
