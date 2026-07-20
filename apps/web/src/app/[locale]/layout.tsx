import type {Metadata, Viewport} from 'next';
import '../globals.css';
import { Toaster } from "@/components/ui/toaster";
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import { AuthProvider } from '@/contexts/auth-context';
import { QueryProvider } from '@/components/providers/query-provider';
import { SerwistClientProvider } from '@/components/providers/serwist-provider';
import { PwaInstallPrompt } from '@/components/pwa/install-prompt';

export const metadata: Metadata = {
  applicationName: 'AniSync',
  title: 'AniSync',
  description: 'Your personal anime schedule and recommendation hub.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AniSync',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    apple: '/icons/icon-192.png',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#09090f',
};

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}>) {
  const {locale} = await params;
  const messages = await getMessages();
  return (
    <html lang={locale} className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Sofia+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SerwistClientProvider>
            <QueryProvider>
              <AuthProvider>
                {children}
                <PwaInstallPrompt />
                <Toaster />
              </AuthProvider>
            </QueryProvider>
          </SerwistClientProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
