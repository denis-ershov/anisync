import { RegisterForm } from "@/components/auth/register-form";
import { getTranslations } from "next-intl/server";

export default async function RegisterPage() {
  const t = await getTranslations('Auth');
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            {t('createAccount')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('registerSubtitle')}
          </p>
        </div>
        <RegisterForm />
        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground">
            {t('haveAccount')}{' '}
            <a href="/login" className="text-primary hover:underline">
              {t('signIn')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
