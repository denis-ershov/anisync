'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimeCard } from "@/components/anime-card";
import { getDay, format, addDays } from "date-fns";
import { enUS, ru } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/auth-context';

interface AnimeData {
  id: string;
  malId?: number;
  title: string;
  title_en?: string;
  title_jp?: string;
  license_name_ru?: string;
  synonyms?: string[];
  kind?: string;
  rating?: string;
  score: number;
  status: string;
  episodes: number;
  episodes_aired: number;
  duration?: number;
  aired_on?: string;
  released_on?: string;
  season?: string;
  url?: string;
  cover_image: string;
  next_episode_date: string | null;
  is_censored?: boolean;
  genres?: Array<{
    id: string;
    name: string;
    kind?: string;
  }>;
  studios?: Array<{
    id: string;
    name: string;
    image?: string;
  }>;
  description?: string;
  description_html?: string;
  // User specific data
  watched_episodes: number;
  watch_status: string;
  personal_rating: number | null;
  user_rate_id?: string;
  source: string;
  out_of_sync?: boolean;
  sync_state?: 'pending' | 'processing' | 'synced' | 'failed' | 'local_only';
}

interface ApiResponse {
  service: string;
  anime: AnimeData[];
  count: number;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ScheduleView() {
  const locale = useLocale();
  const t = useTranslations('Home');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const [animeList, setAnimeList] = useState<AnimeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsIntegration, setNeedsIntegration] = useState(false);
  const [integrationExpired, setIntegrationExpired] = useState(false);
  const dateLocale = locale === 'ru' ? ru : enUS;

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) {
      return;
    }

    // Check auth before redirecting
    if (!user) {
      // Give a small delay to allow auth context to update after redirect
      const timeoutId = setTimeout(async () => {
        // Double-check auth via API before redirecting
        try {
          const authCheck = await fetch('/api/auth/me', { 
            credentials: 'include',
            cache: 'no-store'
          });
          
          if (!authCheck.ok) {
            router.push(`/${locale}/login?message=please_login`);
          }
        } catch (error) {
          console.error('[ScheduleView] Auth check error:', error);
          router.push(`/${locale}/login?message=please_login`);
        }
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }

    const fetchAnime = async () => {
      try {
        setLoading(true);
        setError(null);

        const query = new URLSearchParams(searchParams.toString());
        const response = await fetch(`/api/user/anime?${query.toString()}`, {
          credentials: 'include',
          cache: 'no-store'
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          // If unauthorized (401), redirect to login
          if (response.status === 401) {
            router.push(`/${locale}/login?message=session_expired`);
            return;
          }
          
          // If forbidden (403) - integration token expired, show message but don't redirect
          if (response.status === 403) {
            const errorCode = errorData.code;
            if (errorCode === 'INTEGRATION_TOKEN_EXPIRED') {
              setIntegrationExpired(true);
              setLoading(false);
              return;
            }
            // Other 403 errors
            throw new Error(errorData.message || errorData.error || 'Forbidden');
          }
          
          // 400 - No primary service configured (show integration prompt)
          if (response.status === 400) {
            if (errorData.message?.includes('primary service')) {
              setNeedsIntegration(true);
              setLoading(false);
              return;
            }
            // Other 400 errors - show error message
            throw new Error(errorData.message || errorData.error || 'Bad request');
          }
          
          // 404 might mean user/integration not found
          if (response.status === 404) {
            if (errorData.error === 'User not found') {
              router.push(`/${locale}/login?message=session_expired`);
              return;
            }
            if (errorData.error === 'Integration not found') {
              setNeedsIntegration(true);
              setLoading(false);
              return;
            }
            // Other 404 errors
            throw new Error(errorData.message || errorData.error || 'Not found');
          }

          // For any other error status, throw generic error
          throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: Failed to fetch anime list`);
        }

        const data: ApiResponse = await response.json();
        const anime = data.anime || [];
        setAnimeList(anime);
      } catch (err) {
        console.error('Error fetching anime:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchAnime();
  }, [user, authLoading, router, locale, searchParams]);

  const getCatchingUpAnime = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day

    return animeList.filter(anime => {
      // Only show anime with "watching" status (not "planned")
      if (anime.watch_status !== 'watching') return false;

      // Show anime without next_episode_date (completed series being watched or no schedule)
      if (!anime.next_episode_date) return true;

      const releaseDate = new Date(anime.next_episode_date);
      releaseDate.setHours(0, 0, 0, 0);
      const daysUntilRelease = Math.ceil((releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Show if episode already aired (negative days) or more than 7 days away
      // This means it's not in the weekly schedule
      return daysUntilRelease < 0 || daysUntilRelease > 7;
    });
  };

  const getWeekSchedule = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i);
      date.setHours(0, 0, 0, 0);
      return date;
    });

    return weekDays.map((date, index) => {
      const dayOfWeek = getDay(date);
      const dayName = format(date, "EEEE", { locale: dateLocale });

      // Filter anime by release date within the next 7 days
      const animesForDay = animeList.filter(anime => {
        // For planned anime, use aired_on if next_episode_date is not available
        // For watching anime, must have next_episode_date
        let releaseDate: Date | null = null;
        
        if (anime.next_episode_date) {
          releaseDate = new Date(anime.next_episode_date);
        } else if (anime.watch_status === 'planned' && anime.aired_on) {
          // For planned anime without next_episode_date, use aired_on (start date)
          releaseDate = new Date(anime.aired_on);
        } else {
          // No date available, skip
          return false;
        }

        releaseDate.setHours(0, 0, 0, 0);
        const releaseDateStr = format(releaseDate, 'yyyy-MM-dd');
        const checkDateStr = format(date, 'yyyy-MM-dd');
        const daysUntilRelease = Math.ceil((releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Only show anime if release date exactly matches this day in the schedule
        // and it's within 7 days from today (0-7 days)
        // For planned anime, only show if date is in the future (not past releases)
        if (anime.watch_status === 'planned' && daysUntilRelease < 0) {
          return false; // Don't show past releases for planned anime
        }
        
        return releaseDateStr === checkDateStr && daysUntilRelease >= 0 && daysUntilRelease <= 7;
      });

      let displayDay: string;
      if (index === 0) {
        displayDay = t('today');
      } else if (index === 1) {
        displayDay = t('tomorrow');
      } else {
        displayDay = capitalize(dayName);
      }

      return {
        day: displayDay,
        date: format(date, "d MMMM", { locale: dateLocale }),
        animes: animesForDay,
      };
    });
  };

  // Show loading state while checking auth or fetching data
  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Show message if integration token expired
  if (integrationExpired) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-lg border-2 border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-yellow-500/10 p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-yellow-500/10 p-4">
                  <svg className="w-16 h-16 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold">{locale === 'ru' ? 'Интеграция истекла' : 'Integration Expired'}</h2>
              <p className="text-lg text-muted-foreground">
                {locale === 'ru' 
                  ? 'Токен доступа к вашему аккаунту истек. Пожалуйста, переподключите интеграцию в настройках.'
                  : 'Your account access token has expired. Please reconnect the integration in settings.'}
              </p>
            </div>

            <div className="flex justify-center pt-4">
              <button
                onClick={() => router.push(`/${locale}/settings/integrations`)}
                className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-semibold transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {locale === 'ru' ? 'Переподключить' : 'Reconnect'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show integration prompt if no service is configured
  if (needsIntegration) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <svg className="w-16 h-16 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold">{t('welcomeTitle')}</h2>
              <p className="text-lg text-muted-foreground">
                {t('welcomeMessage')}
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                {t('supportedServices')}
              </p>
              <div className="flex justify-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-lg bg-background border-2 flex items-center justify-center">
                    <span className="font-bold text-lg">Shiki</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Shikimori</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-lg bg-background border-2 flex items-center justify-center">
                    <span className="font-bold text-lg">MAL</span>
                  </div>
                  <span className="text-xs text-muted-foreground">MyAnimeList</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-lg bg-background border-2 flex items-center justify-center">
                    <span className="font-bold text-lg">AL</span>
                  </div>
                  <span className="text-xs text-muted-foreground">AniList</span>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <button
                onClick={() => router.push(`/${locale}/settings/integrations`)}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-semibold transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {t('connectService')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="text-destructive text-lg font-semibold">Error loading anime</div>
          <div className="text-muted-foreground">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const weeklySchedule = getWeekSchedule();
  const catchingUpAnime = getCatchingUpAnime();

  const renderAnimeGrid = (animes: AnimeData[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {animes.map((anime) => (
        <AnimeCard
          key={anime.id}
          anime={{
            id: parseInt(anime.id),
            titleRussian: anime.title,
            titleRomaji: anime.title_en || anime.title,
            coverImage: anime.cover_image,
            genres: anime.genres?.map(g => ({ id: parseInt(g.id), name: g.name })) || [],
            watchedEpisodes: anime.watched_episodes,
            totalEpisodes: anime.episodes,
            shortDescription: anime.description?.substring(0, 150) || '',
            fullSynopsis: anime.description || '',
            nextEpisodeDate: anime.next_episode_date,
            releaseYear: anime.aired_on ? new Date(anime.aired_on).getFullYear() : new Date().getFullYear(),
            studio: anime.studios?.[0] ? { id: parseInt(anime.studios[0].id), name: anime.studios[0].name } : { id: 0, name: '' },
            rating: anime.score,
            status: anime.status as any,
            watchStatus: anime.watch_status as any,
            personalRating: anime.personal_rating,
            userNotes: '',
            userRateId: anime.user_rate_id,
            outOfSync: anime.out_of_sync,
            syncState: anime.sync_state,
          }}
        />
      ))}
    </div>
  );

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="space-y-12">
        {/* Weekly Schedule */}
        {weeklySchedule.map(({ day, date, animes }) => (
          <section key={day}>
            <div className="mb-6">
              <h2 className="text-3xl font-bold font-headline tracking-tight">{day}</h2>
              <p className="text-muted-foreground">{date}</p>
            </div>
            {animes.length > 0 ? (
              renderAnimeGrid(animes)
            ) : (
              <div className="flex items-center justify-center h-40 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20">
                <p className="text-muted-foreground">{t('noReleases')}</p>
              </div>
            )}
          </section>
        ))}

        {/* Catching Up Section - Always last */}
        <section>
          <div className="mb-6">
            <h2 className="text-3xl font-bold font-headline tracking-tight">{t('catchingUp')}</h2>
          </div>
          {catchingUpAnime.length > 0 ? (
            renderAnimeGrid(catchingUpAnime)
          ) : (
            <div className="flex items-center justify-center h-40 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20">
              <p className="text-muted-foreground">{t('noCatchingUp')}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
