'use client';

import { SerwistProvider } from '@serwist/next/react';

export function SerwistClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV === 'development'}>
      {children}
    </SerwistProvider>
  );
}
