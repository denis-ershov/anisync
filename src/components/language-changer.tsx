'use client';

import { useRouter, usePathname } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from './ui/button';
import { Languages } from 'lucide-react';
import i18nConfig from '../../i18nConfig';

export default function LanguageChanger({ locale }: { locale: string }) {
  const router = useRouter();
  const currentPathname = usePathname();

  const handleChange = (newLocale: string) => {
    if (locale === newLocale) return;
    let newPath = '';
    // Если текущий путь — корень
    if (currentPathname === '/' || currentPathname === `/${locale}`) {
      newPath = `/${newLocale}`;
    } else {
      // Заменяем только первую часть пути (локаль)
      const pathParts = currentPathname.split('/');
      if (i18nConfig.locales.includes(pathParts[1])) {
        pathParts[1] = newLocale;
        newPath = pathParts.join('/');
      } else {
        newPath = `/${newLocale}${currentPathname}`;
      }
    }
    router.push(newPath);
  };

  if (!currentPathname) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Languages className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleChange('en')}>
          English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleChange('ru')}>
          Русский
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
