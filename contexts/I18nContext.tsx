import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import { initI18n, setLocale as setI18nLocale, getCurrentLocale, t } from '@/lib/i18n';

export const [I18nProvider, useI18n] = createContextHook(() => {
  const [locale, setLocaleState] = useState<'fr' | 'en'>(getCurrentLocale() as 'fr' | 'en');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => {
      setLocaleState(getCurrentLocale() as 'fr' | 'en');
      setIsReady(true);
    });
  }, []);

  const setLocale = useCallback(async (newLocale: 'fr' | 'en') => {
    await setI18nLocale(newLocale);
    setLocaleState(newLocale);
  }, []);

  const translate = useCallback((key: string, options?: object) => t(key, options), []);

  return { locale, setLocale, t: translate, isReady };
});
