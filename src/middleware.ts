import createMiddleware from 'next-intl/middleware';
import {locales, pathnames} from './navigation';

export default createMiddleware({
  defaultLocale: 'en',
  locales,
  pathnames,
});
 
export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`, `sw.js`)
  // - … service worker files
  matcher: [
    // Match all pathnames except for
    // - api routes
    // - _next (Next.js internals)
    // - _vercel (Vercel internals)  
    // - auth routes (OAuth callbacks)
    // - files with an extension (e.g. .ico, .js, .json, sw.js)
    '/((?!api|auth|_next/static|_next/image|_vercel|favicon.ico|sw\\.js|.*\\..*).*)'
  ]
};