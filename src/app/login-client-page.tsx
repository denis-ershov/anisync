'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { Tv2 } from 'lucide-react';

export default function LoginClientPage() {
  const { t } = useTranslation('common');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_SHIKIMORI_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_SHIKIMORI_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      console.error("Shikimori client ID or redirect URI is not configured.");
      // Optionally, show an error to the user
      return;
    }
    const scope = "user_rates";
    const authUrl = `https://shikimori.one/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
    window.location.href = authUrl;
  };

  return (
    <>
      <h1 className="text-5xl font-bold font-headline text-foreground mb-4">
        {t('welcome_title')}
      </h1>
      <p className="text-lg text-muted-foreground mb-8">
        {t('welcome_description')}
      </p>
      {isClient ? (
        <Button onClick={handleLogin} size="lg" className="font-bold">
            <Tv2 className="mr-2"/>
            {t('login_button')}
        </Button>
      ) : (
        <Button size="lg" className="font-bold" disabled>
             <Tv2 className="mr-2"/>
            {t('login_button')}
        </Button>
      )}
    </>
  );
}
