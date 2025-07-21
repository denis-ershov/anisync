import type { Metadata } from 'next';
import './globals.css';
import { TranslationsProvider } from '@/components/i18n-provider';
import initTranslations from './i18n';
import i18nConfig from '../../i18nConfig';

export const metadata: Metadata = {
  title: 'AniSync',
  description: 'Sync and discover your next favorite anime.',
};

const i18nNamespaces = ['common'];

export default async function RootLayout(props: {
  children: React.ReactNode;
  params: { locale?: string } | Promise<{ locale?: string }>;
}) {
  const { children } = props;
  const params = await props.params;
  const locale = params?.locale || i18nConfig.defaultLocale;
  const { resources } = await initTranslations(locale, i18nNamespaces);

  return (
    <html lang={locale} className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Sofia+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen bg-background">
        <TranslationsProvider
          namespaces={i18nNamespaces}
          locale={locale}
          resources={resources}>
          {children}
        </TranslationsProvider>
      </body>
    </html>
  );
}
