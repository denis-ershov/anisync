'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { ReleaseScheduleItem } from '@/components/releases/release-schedule-item';
import { Skeleton } from '@/components/ui/skeleton';
import { useReleaseWatchlist } from '@/lib/releases/hooks';
import { buildWeekSchedule, formatShortDate } from '@/lib/releases/utils';
import { cn } from '@/lib/utils';

const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function ReleasesDashboardView() {
  const locale = useLocale();
  const t = useTranslations('Releases');
  const lang = locale === 'ru' ? 'ru' : 'en';

  const { data: items = [], isLoading, error } = useReleaseWatchlist(lang);

  const schedule = useMemo(() => buildWeekSchedule(items), [items]);
  const errorMessage = error instanceof Error ? error.message : error ? t('errors.loadFailed') : null;

  if (isLoading) {
    return (
      <div className="container space-y-4 px-4 py-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container space-y-4 px-4 py-4">
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      <section className="rounded-xl border bg-card/60 p-4">
        <h2 className="text-base font-semibold">{t('dashboard.todayTitle')}</h2>
        <p className="text-sm text-muted-foreground">{formatShortDate(schedule.days[0]?.dateKey ?? '', locale)}</p>
        {schedule.todayItems.length === 0 ? (
          <p className="pt-4 text-sm text-muted-foreground">{t('dashboard.emptyToday')}</p>
        ) : (
          <div className="mt-4 space-y-2">
            {schedule.todayItems.map((item) => (
              <ReleaseScheduleItem key={item.id} item={item} dateKey={schedule.days[0]?.dateKey ?? ''} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t('dashboard.weekTitle')}</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {schedule.days.map((day) => (
            <div
              key={day.dateKey}
              className={cn(
                'rounded-xl border bg-card/40 p-4',
                day.isToday && 'border-primary/40 bg-primary/5'
              )}
            >
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {day.isToday ? t('dashboard.today') : t(`dashboard.weekdays.${weekdayKeys[day.weekday]}`)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatShortDate(day.dateKey, locale)}</p>
                </div>
                <span className="text-xs text-muted-foreground">{day.items.length}</span>
              </div>

              {day.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('dashboard.emptyDay')}</p>
              ) : (
                <div className="space-y-2">
                  {day.items.map((item) => (
                    <ReleaseScheduleItem key={item.id} item={item} dateKey={day.dateKey} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
