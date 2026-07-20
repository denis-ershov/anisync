import { RegisterForm } from "@/components/auth/register-form";
import { Link } from "@/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getTranslations } from "next-intl/server";

export default async function RegisterPage() {
  const t = await getTranslations('Auth');
  const registrationOpen = isFeatureEnabled('registration');

  if (!registrationOpen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            {t('registrationClosedTitle')}
          </h1>
          <p className="text-muted-foreground">{t('registrationClosedDescription')}</p>
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            {t('signIn')}
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            {t('createAccount')}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t('registerSubtitle')}
          </p>
        </div>
        <RegisterForm />
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t('haveAccount')}{' '}
            <Link href="/login" className="text-primary hover:underline">
              {t('signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
