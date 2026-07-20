'use client';

import { useState } from 'react';
import { Loader2, Pin, PinOff, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  usePinTorrentRelease,
  useTorrentReleaseCandidates,
  useUnpinTorrentRelease,
  useUpdateTorrentWatchlistItem,
} from '@/lib/torrents/hooks';
import type { TorrentWatchlistItem } from '@/lib/torrents/types';

function numericValue(value: string) {
  return value.trim() ? Number(value) : null;
}

export function TorrentPreferencesDialog({ item }: { item: TorrentWatchlistItem }) {
  const t = useTranslations('Torrents.preferences');
  const [open, setOpen] = useState(false);
  const [quality, setQuality] = useState(item.preferredQuality ?? '');
  const [audio, setAudio] = useState(item.preferredAudio ?? '');
  const [season, setSeason] = useState(item.targetSeason?.toString() ?? '');
  const [maxReleases, setMaxReleases] = useState(item.maxReleasesCount?.toString() ?? '');
  const [interval, setInterval] = useState(item.checkInterval?.toString() ?? '');
  const [notifyOnce, setNotifyOnce] = useState(item.notifyOnce);
  const update = useUpdateTorrentWatchlistItem();
  const pin = usePinTorrentRelease();
  const unpin = useUnpinTorrentRelease();
  const candidates = useTorrentReleaseCandidates(item.id, open);
  const busy = update.isPending || pin.isPending || unpin.isPending;

  const save = async () => {
    await update.mutateAsync({
      id: item.id,
      input: {
        preferredQuality: quality.trim() || null,
        preferredAudio: audio.trim() || null,
        targetSeason: numericValue(season),
        maxReleasesCount: numericValue(maxReleases),
        checkInterval: numericValue(interval),
        notifyOnce,
      },
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11 flex-1 sm:flex-none">
          <Settings2 className="size-4" aria-hidden />
          <span className="ml-2">{t('action')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title', { title: item.title })}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`quality-${item.id}`}>{t('quality')}</Label>
            <Input id={`quality-${item.id}`} value={quality} onChange={(e) => setQuality(e.target.value)} placeholder="1080p" />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`audio-${item.id}`}>{t('audio')}</Label>
            <Input id={`audio-${item.id}`} value={audio} onChange={(e) => setAudio(e.target.value)} placeholder="LostFilm" />
          </div>
          {item.type === 'tv' ? (
            <div className="space-y-2">
              <Label htmlFor={`season-${item.id}`}>{t('season')}</Label>
              <Input id={`season-${item.id}`} type="number" min={1} max={99} value={season} onChange={(e) => setSeason(e.target.value)} />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`max-${item.id}`}>{t('maxReleases')}</Label>
            <Input id={`max-${item.id}`} type="number" min={1} max={50} value={maxReleases} onChange={(e) => setMaxReleases(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t('huntingHint')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`interval-${item.id}`}>{t('interval')}</Label>
            <Input id={`interval-${item.id}`} type="number" min={1} max={10080} value={interval} onChange={(e) => setInterval(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 self-end pb-3">
            <Checkbox id={`notify-${item.id}`} checked={notifyOnce} onCheckedChange={(value) => setNotifyOnce(value === true)} />
            <Label htmlFor={`notify-${item.id}`}>{t('notifyOnce')}</Label>
          </div>
        </div>

        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{t('pinTitle')}</p>
              <p className="text-xs text-muted-foreground">
                {item.pinnedReleaseTitle ?? t('notPinned')}
              </p>
            </div>
            {item.pinnedReleaseKey ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => unpin.mutate(item.id)}>
                <PinOff className="mr-2 size-4" /> {t('unpin')}
              </Button>
            ) : null}
          </div>
          {candidates.isLoading ? (
            <Loader2 className="size-5 animate-spin" aria-label={t('loading')} />
          ) : candidates.error ? (
            <p className="text-sm text-destructive">{t('candidatesError')}</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {candidates.data?.map((candidate) => (
                <li key={candidate.releaseKey} className="flex items-start justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium">{candidate.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[candidate.quality, candidate.tracker, candidate.seeders != null ? `${candidate.seeders} seeds` : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Button size="sm" variant={candidate.pinned ? 'default' : 'outline'} disabled={busy || candidate.pinned} onClick={() => pin.mutate({ id: item.id, candidate })}>
                    <Pin className="size-4" />
                    <span className="sr-only">{t('pin')}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={save} disabled={busy}>
            {update.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
