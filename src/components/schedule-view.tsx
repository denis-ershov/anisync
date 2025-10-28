'use client';

import { useEffect, useState } from 'react';
import { AnimeCard } from "@/components/anime-card";
import { getDay, format, addDays } from "date-fns";
import { enUS, ru } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';

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
  const [animeList, setAnimeList] = useState<AnimeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dateLocale = locale === 'ru' ? ru : enUS;

  useEffect(() => {
    const fetchAnime = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/user/anime');

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}: Failed to fetch anime list`);
        }

        const data: ApiResponse = await response.json();
        setAnimeList(data.anime || []);
      } catch (err) {
        console.error('Error fetching anime:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchAnime();
  }, []);

  const getCatchingUpAnime = () => {
    const today = new Date();

    return animeList.filter(anime => {
      // Only show anime with "watching" status
      if (anime.watch_status !== 'watching') return false;

      // Show anime without next_episode_date (completed series being watched)
      if (!anime.next_episode_date) return true;

      // Or anime where next episode is more than 7 days away
      // (means it's not in the weekly schedule)
      const releaseDate = new Date(anime.next_episode_date);
      const daysUntilRelease = Math.ceil((releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      return daysUntilRelease > 7;
    });
  };

  const getWeekSchedule = () => {
    const today = new Date();
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(today, i));

    return weekDays.map((date, index) => {
      const dayOfWeek = getDay(date);
      const dayName = format(date, "EEEE", { locale: dateLocale });

      // Filter anime by release day of week
      const animesForDay = animeList.filter(anime => {
        if (!anime.next_episode_date) return false;

        const releaseDate = new Date(anime.next_episode_date);
        const releaseDayOfWeek = getDay(releaseDate);
        const releaseDateStr = format(releaseDate, 'yyyy-MM-dd');
        const checkDateStr = format(date, 'yyyy-MM-dd');

        // For "planned" status anime: only show if exact date match within the week
        if (anime.watch_status === 'planned') {
          // Only show if this is the exact release date
          return releaseDateStr === checkDateStr;
        }

        // For "watching" status anime: continue with existing logic
        // Check if this anime releases on this day of week
        if (releaseDayOfWeek !== dayOfWeek) return false;

        // For today: show if next episode is within the next 7 days on this day of week
        // This handles weekly releases
        if (index === 0) {
          const daysUntilRelease = Math.ceil((releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          // Don't show if it's more than 7 days away
          if (daysUntilRelease > 7) return false;

          // Check if this is the first episode (new anime starting)
          // First episode if: episodes_aired is 0 or 1, or aired_on date matches next_episode_date
          const isFirstEpisode = anime.episodes_aired <= 1 ||
                                (anime.aired_on && format(new Date(anime.aired_on), 'yyyy-MM-dd') === format(releaseDate, 'yyyy-MM-dd'));

          // If it's a first episode releasing in the future (not today), don't show it in "Today"
          if (isFirstEpisode && daysUntilRelease > 0) return false;

          // Show if releasing today or next week on the same day (weekly series)
          return daysUntilRelease >= 0 && daysUntilRelease <= 7;
        }

        // For other days: exact date match
        return releaseDateStr === checkDateStr;
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
            title_russian: anime.title,
            title_romaji: anime.title_en || anime.title,
            cover_image: anime.cover_image,
            genres: anime.genres?.map(g => ({ id: parseInt(g.id), name: g.name })) || [],
            watched_episodes: anime.watched_episodes,
            total_episodes: anime.episodes,
            short_description: anime.description?.substring(0, 150) || '',
            full_synopsis: anime.description || '',
            next_episode_date: anime.next_episode_date,
            release_year: anime.aired_on ? new Date(anime.aired_on).getFullYear() : new Date().getFullYear(),
            studio: anime.studios?.[0] ? { id: parseInt(anime.studios[0].id), name: anime.studios[0].name } : { id: 0, name: '' },
            rating: anime.score,
            status: anime.status as any,
            watch_status: anime.watch_status as any,
            personal_rating: anime.personal_rating,
            user_notes: '',
            user_rate_id: anime.user_rate_id,
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
