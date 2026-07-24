export const QUEUE_NAMES = {
  animeSyncPrimary: 'anime.sync.primary',
  animeSyncEntry: 'anime.sync.entry',
  animeScheduleRefresh: 'anime.schedule.refresh',
  maintenanceCleanup: 'maintenance.cleanup',
  releasesPrecompute: 'releases.precompute',
  releasesWatchlistRefresh: 'releases.watchlist.refresh',
  torrentsWatcher: 'torrents.watcher',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  processSyncJob: 'process-sync-job',
  processEntrySync: 'process-entry-sync',
  processNextEntrySync: 'process-next-entry-sync',
  /** Пакетная обработка застрявших pending в user_entry_changes. */
  processEntrySyncDrain: 'process-entry-sync-drain',
  refreshScheduleSlice: 'refresh-schedule-slice',
  runMaintenanceCleanup: 'run-maintenance-cleanup',
  precomputeReleasesCatalog: 'precompute-releases-catalog',
  refreshReleaseWatchlist: 'refresh-release-watchlist',
  runTorrentWatcherScan: 'run-torrent-watcher-scan',
} as const;
