'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Loader2, Pin, PinOff, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  usePinTorrentRelease,
  useTorrentReleaseCandidates,
  useUnpinTorrentRelease,
  useUpdateTorrentWatchlistItem,
} from '@/lib/torrents/hooks';
import type { TorrentWatchlistItem } from '@/lib/torrents/types';

const QUALITY_PRESETS = ['1080p', '2160p HDR', '2160p SDR', '720p', '480p'] as const;
const AUDIO_PRESETS = ['russian', 'original', 'any'] as const;

type PresetTextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  presets: readonly string[];
  getPresetLabel: (preset: string) => string;
  appendPresets?: boolean;
};

function PresetTextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  presets,
  getPresetLabel,
  appendPresets = false,
}: PresetTextFieldProps) {
  const applyPreset = (preset: string) => {
    if (appendPresets) {
      const parts = value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      const exists = parts.some((part) => part.toLowerCase() === preset.toLowerCase());
      if (!exists) {
        onChange(parts.length ? `${parts.join(', ')}, ${preset}` : preset);
      }
      return;
    }

    onChange(preset);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-1">
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          list={`${id}-presets`}
          className="min-w-0 flex-1"
        />
        <datalist id={`${id}-presets`}>
          {presets.map((preset) => (
            <option key={preset} value={preset}>
              {getPresetLabel(preset)}
            </option>
          ))}
        </datalist>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label={label}
            >
              <ChevronDown className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-w-[min(100vw-2rem,20rem)]">
            {presets.map((preset) => (
              <DropdownMenuItem key={preset} onSelect={() => applyPreset(preset)}>
                {getPresetLabel(preset)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function numericValue(value: string) {
  return value.trim() ? Number(value) : null;
}

function resetFormState(item: TorrentWatchlistItem) {
  return {
    quality: item.preferredQuality ?? '',
    audio: item.preferredAudio ?? '',
    season: item.targetSeason?.toString() ?? '',
    maxReleases: item.maxReleasesCount?.toString() ?? '',
    interval: item.checkInterval?.toString() ?? '',
    notifyOnce: item.notifyOnce,
    title: item.title,
    originalTitle: item.originalTitle ?? '',
    year: item.year ?? '',
    genre: item.genre ?? '',
    posterUrl: item.posterUrl ?? '',
  };
}

export function TorrentPreferencesDialog({ item }: { item: TorrentWatchlistItem }) {
  const t = useTranslations('Torrents.preferences');
  const [open, setOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [quality, setQuality] = useState(item.preferredQuality ?? '');
  const [audio, setAudio] = useState(item.preferredAudio ?? '');
  const [season, setSeason] = useState(item.targetSeason?.toString() ?? '');
  const [maxReleases, setMaxReleases] = useState(item.maxReleasesCount?.toString() ?? '');
  const [interval, setInterval] = useState(item.checkInterval?.toString() ?? '');
  const [notifyOnce, setNotifyOnce] = useState(item.notifyOnce);
  const [title, setTitle] = useState(item.title);
  const [originalTitle, setOriginalTitle] = useState(item.originalTitle ?? '');
  const [year, setYear] = useState(item.year ?? '');
  const [genre, setGenre] = useState(item.genre ?? '');
  const [posterUrl, setPosterUrl] = useState(item.posterUrl ?? '');
  const update = useUpdateTorrentWatchlistItem();
  const pin = usePinTorrentRelease();
  const unpin = useUnpinTorrentRelease();
  const candidates = useTorrentReleaseCandidates(item.id, open);
  const busy = update.isPending || pin.isPending || unpin.isPending;

  useEffect(() => {
    if (!open) {
      return;
    }

    const next = resetFormState(item);
    setQuality(next.quality);
    setAudio(next.audio);
    setSeason(next.season);
    setMaxReleases(next.maxReleases);
    setInterval(next.interval);
    setNotifyOnce(next.notifyOnce);
    setTitle(next.title);
    setOriginalTitle(next.originalTitle);
    setYear(next.year);
    setGenre(next.genre);
    setPosterUrl(next.posterUrl);
    setMetadataOpen(false);
  }, [open, item]);

  const qualityPresetLabel = (preset: string) => {
    switch (preset) {
      case '1080p':
        return t('qualityPreset1080p');
      case '2160p HDR':
        return t('qualityPreset2160pHdr');
      case '2160p SDR':
        return t('qualityPreset2160pSdr');
      case '720p':
        return t('qualityPreset720p');
      case '480p':
        return t('qualityPreset480p');
      default:
        return preset;
    }
  };

  const audioPresetLabel = (preset: string) => {
    switch (preset) {
      case 'russian':
        return t('audioRussian');
      case 'original':
        return t('audioOriginal');
      case 'any':
        return t('audioAny');
      default:
        return t('audioCustom');
    }
  };

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
        title: title.trim() || item.title,
        originalTitle: originalTitle.trim() || null,
        year: year.trim() || null,
        genre: genre.trim() || null,
        posterUrl: posterUrl.trim() || null,
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
          <PresetTextField
            id={`quality-${item.id}`}
            label={t('quality')}
            value={quality}
            onChange={setQuality}
            placeholder={t('qualityPlaceholder')}
            presets={QUALITY_PRESETS}
            getPresetLabel={qualityPresetLabel}
            appendPresets
          />
          <PresetTextField
            id={`audio-${item.id}`}
            label={t('audio')}
            value={audio}
            onChange={setAudio}
            placeholder={t('audioPlaceholder')}
            presets={AUDIO_PRESETS}
            getPresetLabel={audioPresetLabel}
          />
          {item.type === 'tv' ? (
            <div className="space-y-2">
              <Label htmlFor={`season-${item.id}`}>{t('season')}</Label>
              <Input
                id={`season-${item.id}`}
                type="number"
                min={1}
                max={99}
                value={season}
                onChange={(event) => setSeason(event.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`max-${item.id}`}>{t('maxReleases')}</Label>
            <Input
              id={`max-${item.id}`}
              type="number"
              min={1}
              max={50}
              value={maxReleases}
              onChange={(event) => setMaxReleases(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('huntingHint')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`interval-${item.id}`}>{t('interval')}</Label>
            <Input
              id={`interval-${item.id}`}
              type="number"
              min={1}
              max={10080}
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 self-end pb-3">
            <Checkbox
              id={`notify-${item.id}`}
              checked={notifyOnce}
              onCheckedChange={(value) => setNotifyOnce(value === true)}
            />
            <Label htmlFor={`notify-${item.id}`}>{t('notifyOnce')}</Label>
          </div>
        </div>

        <Collapsible open={metadataOpen} onOpenChange={setMetadataOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between">
              {t('metadata.editMetadata')}
              <ChevronDown
                className={`size-4 transition-transform ${metadataOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`meta-title-${item.id}`}>{t('metadata.title')}</Label>
                <Input
                  id={`meta-title-${item.id}`}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`meta-original-${item.id}`}>{t('metadata.originalTitle')}</Label>
                <Input
                  id={`meta-original-${item.id}`}
                  value={originalTitle}
                  onChange={(event) => setOriginalTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`meta-year-${item.id}`}>{t('metadata.year')}</Label>
                <Input
                  id={`meta-year-${item.id}`}
                  type="number"
                  min={1888}
                  max={2100}
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`meta-genre-${item.id}`}>{t('metadata.genre')}</Label>
                <Input
                  id={`meta-genre-${item.id}`}
                  value={genre}
                  onChange={(event) => setGenre(event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`meta-poster-${item.id}`}>{t('metadata.posterUrl')}</Label>
                <Input
                  id={`meta-poster-${item.id}`}
                  type="url"
                  value={posterUrl}
                  onChange={(event) => setPosterUrl(event.target.value)}
                  placeholder="https://"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{t('pinTitle')}</p>
              <p className="text-xs text-muted-foreground">
                {item.pinnedReleaseTitle ?? t('notPinned')}
              </p>
            </div>
            {item.pinnedReleaseKey ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => unpin.mutate(item.id)}
              >
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
                <li
                  key={candidate.releaseKey}
                  className="flex items-start justify-between gap-2 rounded-md border p-2"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium">{candidate.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[candidate.quality, candidate.tracker, candidate.seeders != null ? `${candidate.seeders} seeds` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={candidate.pinned ? 'default' : 'outline'}
                    disabled={busy || candidate.pinned}
                    onClick={() => pin.mutate({ id: item.id, candidate })}
                  >
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
