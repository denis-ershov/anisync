import {createLocalizedPathnamesNavigation} from 'next-intl/navigation';
 
export const locales = ['en', 'ru'] as const;

export const pathnames = {
  '/settings': '/settings',
  '/settings/account': '/settings/account',
  '/settings/appearance': '/settings/appearance',
  '/settings/integrations': '/settings/integrations',
  '/settings/profile': '/settings/profile',
};
 
export const {Link, redirect, usePathname, useRouter} =
  createLocalizedPathnamesNavigation({
    locales,
    pathnames: pathnames as typeof pathnames & Record<string & {}, string>
  });
