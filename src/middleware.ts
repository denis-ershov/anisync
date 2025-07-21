import { NextRequest, NextResponse } from 'next/server';
import i18nConfig from '../i18nConfig';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Не применять middleware к статическим переводам
  if (pathname.startsWith('/locales/')) {
    return NextResponse.next();
  }

  const locales: string[] = i18nConfig.locales;
  const defaultLocale: string = i18nConfig.defaultLocale;

  const isLocalePresent = locales.some(
    (locale: string) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (!isLocalePresent) {
    return NextResponse.redirect(
      new URL(`/${defaultLocale}${pathname === '/' ? '' : pathname}`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Все страницы, кроме api, статических файлов и locales
    '/((?!api|_next/static|_next/image|favicon.ico|icon.png|locales).*)',
  ],
};
