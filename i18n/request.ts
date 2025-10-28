import {notFound} from 'next/navigation';
import {getRequestConfig} from 'next-intl/server';
 
export default getRequestConfig(async ({requestLocale}) => {
  // Validate that the incoming `locale` parameter is valid
  const locale = await requestLocale;
  
  // If no locale is provided, use default locale
  if (!locale) {
    return {
      locale: 'en',
      messages: (await import(`../messages/en.json`)).default
    };
  }
  
  if (!['en', 'ru'].includes(locale as any)) {
    notFound();
  }
 
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
