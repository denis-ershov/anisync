'use client';

import { I18nextProvider } from 'react-i18next';
import { ReactNode, useEffect, useState } from 'react';
import initTranslations from '@/app/i18n';
import i18nSingleton from '@/app/i18n-singleton';
import { Toaster } from '@/components/ui/toaster';

type Props = {
  children: ReactNode;
  locale: string;
  namespaces: string[];
  resources: any;
};

export function TranslationsProvider({
  children,
  locale,
  namespaces,
  resources
}: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initTranslations(locale, namespaces, i18nSingleton).then(() => {
      i18nSingleton.changeLanguage(locale); // <-- Критически важно!
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, JSON.stringify(namespaces)]);

  if (!ready) return null;

  return (
    <I18nextProvider i18n={i18nSingleton}>
      {children}
      <Toaster />
    </I18nextProvider>
  );
}