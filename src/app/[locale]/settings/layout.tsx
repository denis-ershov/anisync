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
    title: "integrations",
    href: "/settings/integrations",
  },
];

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default async function SettingsLayout({ children }: SettingsLayoutProps) {
  const t = await getTranslations('SettingsLayout');

  const translatedNavItems = sidebarNavItems.map(item => ({
    ...item,
    title: t(`nav.${item.title}`)
  }));

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 space-y-8">
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
