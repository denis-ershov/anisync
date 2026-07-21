export type TorrentWatchlistPreferences = {
  targetSeason: number | null;
  preferredQuality: string | null;
  preferredAudio: string | null;
  maxReleasesCount: number | null;
  checkInterval: number | null;
  notifyOnce: boolean;
  pinnedReleaseKey: string | null;
  pinnedReleaseTitle: string | null;
};

export type TorrentWatchlistMetadata = {
  title: string;
  originalTitle: string | null;
  year: string | null;
  genre: string | null;
  posterUrl: string | null;
};

export type TorrentWatchlistUpdateInput = Partial<
  Omit<TorrentWatchlistPreferences, 'pinnedReleaseKey' | 'pinnedReleaseTitle'>
> &
  Partial<TorrentWatchlistMetadata>;

export type TorrentWatchlistItem = TorrentWatchlistPreferences & {
  id: number;
  imdbId: string;
  title: string;
  originalTitle: string | null;
  type: 'movie' | 'tv' | string;
  enabled: boolean;
  posterUrl: string | null;
  year: string | null;
  genre: string | null;
  rating: number | null;
  releasesCount: number;
  lastChecked: string | null;
  latestRelease: {
    title: string;
    quality: string | null;
    createdAt: string | null;
    currentEpisode: number | null;
    totalEpisodes: number | null;
  } | null;
};

export type TorrentReleaseItem = {
  title: string;
  quality: string | null;
  size: string | null;
  seeders: number | null;
  tracker: string | null;
  createdAt: string | null;
  lastUpdate: string | null;
};

export type TorrentReleaseCandidate = {
  releaseKey: string;
  aliases: string[];
  title: string;
  quality: string | null;
  size: number | null;
  seeders: number | null;
  tracker: string | null;
  pinned: boolean;
  magnetUrl?: string | null;
  downloadUrl?: string | null;
  infoUrl?: string | null;
};

export type TorrentHealthSnapshot = {
  dbOk: boolean;
  prowlarrOk: boolean | null;
  telegramOk: boolean | null;
  prowlarrUrl: string | null;
  telegramUsername: string | null;
  totalItems: number | null;
  enabledItems: number | null;
  lastWatcherRun: string | null;
};
