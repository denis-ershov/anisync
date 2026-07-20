'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { useInvalidateReleaseWatchlist } from '@/lib/releases/hooks';
import type { ReleaseCatalogItem } from '@/lib/releases/types';

type ReleasesModuleContextValue = {
  selectedItem: ReleaseCatalogItem | null;
  openDetail: (item: ReleaseCatalogItem) => void;
  closeDetail: () => void;
  notifyWatchlistChanged: () => void;
};

const ReleasesModuleContext = createContext<ReleasesModuleContextValue | null>(null);

export function ReleasesModuleProvider({ children }: { children: React.ReactNode }) {
  const [selectedItem, setSelectedItem] = useState<ReleaseCatalogItem | null>(null);
  const invalidateWatchlist = useInvalidateReleaseWatchlist();

  const openDetail = useCallback((item: ReleaseCatalogItem) => {
    setSelectedItem(item);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const notifyWatchlistChanged = useCallback(() => {
    invalidateWatchlist();
  }, [invalidateWatchlist]);

  const value = useMemo(
    () => ({
      selectedItem,
      openDetail,
      closeDetail,
      notifyWatchlistChanged,
    }),
    [closeDetail, notifyWatchlistChanged, openDetail, selectedItem]
  );

  return <ReleasesModuleContext.Provider value={value}>{children}</ReleasesModuleContext.Provider>;
}

export function useReleasesModule() {
  const context = useContext(ReleasesModuleContext);
  if (!context) {
    throw new Error('useReleasesModule must be used within ReleasesModuleProvider');
  }

  return context;
}
