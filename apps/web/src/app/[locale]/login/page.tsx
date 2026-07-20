import { LoginForm } from "@/components/auth/login-form";
import { LoginMessage } from "@/components/auth/login-message";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

export default async function LoginPage() {
  const t = await getTranslations('Auth');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            {t('welcomeBack')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('loginSubtitle')}
          </p>
        </div>
        <Suspense fallback={null}>
          <LoginMessage />
        </Suspense>
        <LoginForm />
        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground">
            {t('noAccount')}{' '}
            <a href="/register" className="text-primary hover:underline">
              {t('signUp')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
