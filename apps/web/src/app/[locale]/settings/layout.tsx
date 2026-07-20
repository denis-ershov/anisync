import { Header } from "@/components/header";
import { SidebarNav } from "@/components/sidebar-nav";
import { Separator } from "@/components/ui/separator";
import { getTranslations } from "next-intl/server";

const sidebarNavItems = [
  {
    title: "profile",
    href: "/settings/profile",
  },
  {
    title: "account",
    href: "/settings/account",
  },
  {
    title: "appearance",
    href: "/settings/appearance",
  },
  {
    title: "notifications",
    href: "/settings/notifications",
  },
  {
    title: "integrations",
    href: "/settings/integrations",
  },
  {
    title: "adminImport",
    href: "/settings/admin/import",
    adminOnly: true,
    legacyImport: true,
  },
];

function isLegacyOntrashImportEnabled() {
  const raw = process.env.LEGACY_ONTRASH_IMPORT_ENABLED;
  if (!raw) {
    return false;
  }
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default async function SettingsLayout({ children }: SettingsLayoutProps) {
  const t = await getTranslations('SettingsLayout');
  const { requireCurrentUser } = await import('@/lib/api/auth');
  const user = await requireCurrentUser();
  const isAdmin = user?.role === 'admin';
  const legacyImportEnabled = isLegacyOntrashImportEnabled();

  const translatedNavItems = sidebarNavItems
    .filter((item) => {
      if ('legacyImport' in item && item.legacyImport && !legacyImportEnabled) {
        return false;
      }
      if ('adminOnly' in item && item.adminOnly && !isAdmin) {
        return false;
      }
      return true;
    })
    .map((item) => ({
      href: item.href,
      title: t(`nav.${item.title}` as 'profile' | 'account' | 'appearance' | 'notifications' | 'integrations' | 'adminImport'),
    }));

  return (
    <>
      <Header />
      <div className="container mx-auto space-y-8 px-4 py-8">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Separator className="my-6" />
        <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
          <aside className="-mx-4 lg:w-1/5">
            <SidebarNav items={translatedNavItems} />
          </aside>
          <div className="flex-1 lg:max-w-4xl">{children}</div>
        </div>
      </div>
    </>
  );
}
