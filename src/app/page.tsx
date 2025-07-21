'use client';

import { Tv2 } from 'lucide-react';
import LanguageChanger from '@/components/language-changer';
import LoginClientPage from './login-client-page';
import { useParams } from 'next/navigation';

export default function LoginPage() {
  const params = useParams();
  const locale = params.locale as string;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="absolute top-4 right-4">
        <LanguageChanger locale={locale} />
      </div>
      <div className="flex flex-col items-center justify-center text-center max-w-md">
        <div className="mb-8">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-4 border-2 border-primary/20">
            <Tv2 className="w-12 h-12 text-primary" />
          </div>
        </div>
        <LoginClientPage />
      </div>
      <footer className="absolute bottom-4 text-center text-sm text-muted-foreground">
        <p>Sync and discover your next favorite anime.</p>
      </footer>
    </main>
  );
}
