'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { IntegrationServiceName } from '@/lib/integrations/provider-types';

interface ConnectedService {
  serviceName: IntegrationServiceName;
  username?: string | null;
}

interface SearchHit {
  externalAnimeId: string;
  malId: number | null;
  titleDefault: string;
  titleEnglish: string | null;
  titleJapanese: string | null;
  titleRussian: string | null;
  kind: string | null;
  score: number | null;
  status: string | null;
  episodes: number | null;
  coverImage: string | null;
  season: string | null;
  airedOn: string | null;
}

interface AddAnimeDialogProps {
  primaryService?: IntegrationServiceName | null;
  onAdded?: () => void;
}

const SERVICE_LABELS: Record<IntegrationServiceName, string> = {
  shikimori: 'Shikimori',
  myanimelist: 'MyAnimeList',
  anilist: 'AniList',
};

function displayTitle(hit: SearchHit, localeHint?: string) {
  if (localeHint === 'ru' && hit.titleRussian) {
    return hit.titleRussian;
  }
  return hit.titleRussian || hit.titleEnglish || hit.titleDefault;
}

export function AddAnimeDialog({ primaryService, onAdded }: AddAnimeDialogProps) {
  const t = useTranslations('AddAnime');
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<ConnectedService[]>([]);
  const [service, setService] = useState<IntegrationServiceName | ''>('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/user/integrations', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        const connected = (data.integrations || [])
          .filter((item: { accessToken?: string | null; serviceName: string }) => Boolean(item.accessToken))
          .map((item: { serviceName: IntegrationServiceName; username?: string | null }) => ({
            serviceName: item.serviceName,
            username: item.username,
          }));

        if (cancelled) {
          return;
        }
        setServices(connected);
        const settingsPrimary = data.settings?.primaryService as IntegrationServiceName | undefined;
        const preferred =
          (primaryService && connected.some((s: ConnectedService) => s.serviceName === primaryService)
            ? primaryService
            : null) ||
          (settingsPrimary && connected.some((s: ConnectedService) => s.serviceName === settingsPrimary)
            ? settingsPrimary
            : null) ||
          connected[0]?.serviceName ||
          '';
        setService(preferred);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, primaryService]);

  useEffect(() => {
    if (!open || !service || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const handle = window.setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q: query.trim(),
          service,
          limit: '20',
        });
        const response = await fetch(`/api/user/anime/search?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.message || t('searchError'));
          setResults([]);
          return;
        }
        setResults(data.results || []);
      } catch {
        setError(t('searchError'));
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(handle);
  }, [open, service, query, t]);

  const handleAdd = useCallback(
    async (hit: SearchHit) => {
      if (!service) {
        return;
      }
      setAddingId(hit.externalAnimeId);
      setError(null);
      setSuccess(null);
      try {
        const response = await fetch('/api/user/library', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service,
            externalAnimeId: hit.externalAnimeId,
            watchStatus: 'planned',
            watchedEpisodes: 0,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.message || t('addError'));
          return;
        }
        setSuccess(t('addSuccess'));
        onAdded?.();
      } catch {
        setError(t('addError'));
      } finally {
        setAddingId(null);
      }
    },
    [service, onAdded, t]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
          setResults([]);
          setError(null);
          setSuccess(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {t('button')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] w-[min(100vw-1rem,32rem)] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="add-anime-service">
              {t('service')}
            </label>
            <Select
              value={service || undefined}
              onValueChange={(value) => setService(value as IntegrationServiceName)}
            >
              <SelectTrigger id="add-anime-service">
                <SelectValue placeholder={t('servicePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {services.map((item) => (
                  <SelectItem key={item.serviceName} value={item.serviceName}>
                    {SERVICE_LABELS[item.serviceName]}
                    {item.username ? ` (@${item.username})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="add-anime-query">
              {t('search')}
            </label>
            <Input
              id="add-anime-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              disabled={!service}
              autoComplete="off"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}

          <div className="max-h-[min(50vh,22rem)] space-y-2 overflow-y-auto pr-1">
            {searching && (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('searching')}</p>
            )}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('noResults')}</p>
            )}
            {results.map((hit) => {
              const title = displayTitle(hit);
              const meta = [hit.kind, hit.episodes != null ? `${hit.episodes} ep` : null, hit.score != null ? String(hit.score) : null]
                .filter(Boolean)
                .join(' · ');
              return (
                <div
                  key={hit.externalAnimeId}
                  className="flex items-center gap-3 rounded-md border p-2"
                >
                  <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-muted">
                    {hit.coverImage ? (
                      <Image
                        src={hit.coverImage}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="40px"
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{title}</div>
                    {meta ? <div className="truncate text-xs text-muted-foreground">{meta}</div> : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={addingId === hit.externalAnimeId}
                    onClick={() => handleAdd(hit)}
                  >
                    {addingId === hit.externalAnimeId ? t('adding') : t('add')}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
