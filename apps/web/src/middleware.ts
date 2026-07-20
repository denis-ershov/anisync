import createMiddleware from 'next-intl/middleware';
import {locales, pathnames} from './navigation';

export default createMiddleware({
  defaultLocale: 'en',
  locales,
  pathnames,
});
 
export const config = {
  // Match only routes that should have locale handling
  // Exclude: api routes, _next internals, root auth (OAuth callbacks), and any file with extension
  matcher: [
    // Match all routes except: /api/*, /_next/*, /_vercel/*, files with extensions
    // But DO match /[locale]/auth/* routes (like /en/auth/login)
    '/((?!api/|_next/|_static/|_vercel/|offline\\.html|sw\\.js|[\\w-]+\\.\\w+)(?!^auth/).*)',
  ]
};