'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAddTorrentWatchlistItem } from '@/lib/torrents/hooks';

const IMDB_PATTERN = /\btt\d{7,}\b/i;

export function TorrentAddForm() {
  const t = useTranslations('Torrents');
  const [value, setValue] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const addMutation = useAddTorrentWatchlistItem();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();

    const imdbId = IMDB_PATTERN.exec(trimmed)?.[0]?.toLowerCase();
    if (!imdbId) {
      setLocalError(t('add.invalidImdb'));
      return;
    }

    setLocalError(null);

    try {
      await addMutation.mutateAsync({ imdbId, input: trimmed });
      setValue('');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : t('errors.actionFailed'));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="torrent-imdb-input" className="text-sm font-medium">
        {t('add.label')}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="torrent-imdb-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t('add.placeholder')}
          className="min-h-11 flex-1"
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" className="min-h-11 shrink-0" disabled={addMutation.isPending}>
          {addMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          <span className="ml-2">{t('add.submit')}</span>
        </Button>
      </div>
      {(localError || addMutation.error) && (
        <p className="text-sm text-destructive" role="alert">
          {localError ??
            (addMutation.error instanceof Error
              ? addMutation.error.message
              : t('errors.actionFailed'))}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('add.hint')}</p>
    </form>
  );
}
