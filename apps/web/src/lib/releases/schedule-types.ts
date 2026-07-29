export type ReleaseScheduleSource = 'tmdb' | 'tvmaze' | 'watchmode' | 'trakt';

export type ReleaseScheduleSlot = {
  calendarDate: string;
  instant?: string | null;
  season?: number | null;
  episode?: number | null;
  source: ReleaseScheduleSource;
};

export type ReleaseContentType = 'movie' | 'show';
