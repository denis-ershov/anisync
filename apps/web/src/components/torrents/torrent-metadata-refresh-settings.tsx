'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  FileText,
  Film,
  Image as ImageIcon,
  RefreshCw,
  SlidersHorizontal,
  Star,
  Tags,
} from 'lucide-react';

import { useAuth } from '@/contexts/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  torrentMetadataRefreshFields,
  type TorrentMetadataRefreshField,
} from '@/lib/types';

const FIELD_ICONS: Record<
  TorrentMetadataRefreshField,
  React.ComponentType<{ className?: string }>
> = {
  posters: ImageIcon,
  ratings: Star,
  genres: Tags,
  plot: FileText,
  details: Film,
  episodes: Calendar,
};

export function TorrentMetadataRefreshSettings() {
  const t = useTranslations('Torrents');
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const autoRefresh = user?.settings?.autoRefreshTorrentMetadata ?? false;
  const initialFields =
    user?.settings?.torrentMetadataRefreshFields ?? [...torrentMetadataRefreshFields];

  const [isOpen, setIsOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<TorrentMetadataRefreshField[]>(initialFields);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user?.settings?.torrentMetadataRefreshFields) {
      setSelectedFields(user.settings.torrentMetadataRefreshFields);
    }
  }, [user?.settings?.torrentMetadataRefreshFields]);

  const handleToggleAutoRefresh = async (checked: boolean) => {
    if (!user) return;
    setIsUpdating(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoRefreshTorrentMetadata: checked }),
      });
      if (!res.ok) {
        throw new Error('Failed to update settings');
      }
      const data = await res.json();
      updateUser({
        ...user,
        settings: {
          ...user.settings,
          autoRefreshTorrentMetadata: checked,
          ...(data.settings ?? {}),
        },
      });
    } catch {
      toast({
        title: t('errors.actionFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const saveFields = async (nextFields: TorrentMetadataRefreshField[]) => {
    if (!user) return;
    setIsUpdating(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ torrentMetadataRefreshFields: nextFields }),
      });
      if (!res.ok) {
        throw new Error('Failed to update fields');
      }
      const data = await res.json();
      updateUser({
        ...user,
        settings: {
          ...user.settings,
          torrentMetadataRefreshFields: nextFields,
          ...(data.settings ?? {}),
        },
      });
    } catch {
      setSelectedFields(
        user.settings?.torrentMetadataRefreshFields ?? [...torrentMetadataRefreshFields]
      );
      toast({
        title: t('errors.actionFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleField = async (field: TorrentMetadataRefreshField) => {
    const isSelected = selectedFields.includes(field);
    const nextFields = isSelected
      ? selectedFields.filter((f) => f !== field)
      : [...selectedFields, field];

    setSelectedFields(nextFields);
    await saveFields(nextFields);
  };

  const handleSelectAll = async () => {
    const nextFields = [...torrentMetadataRefreshFields];
    setSelectedFields(nextFields);
    await saveFields(nextFields);
  };

  const handleDeselectAll = async () => {
    const nextFields: TorrentMetadataRefreshField[] = [];
    setSelectedFields(nextFields);
    await saveFields(nextFields);
  };

  const totalFields = torrentMetadataRefreshFields.length;
  const selectedCount = selectedFields.length;

  return (
    <div className="rounded-xl border border-border/70 bg-card/40 backdrop-blur-sm transition-all hover:border-border">
      {/* Верхняя строка управления */}
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RefreshCw className="h-4 w-4" aria-hidden />
          </div>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <Label
                htmlFor="auto-refresh-switch"
                className="text-sm font-medium cursor-pointer"
              >
                {t('autoRefresh')}
              </Label>
              <Badge
                variant={selectedCount === 0 ? 'destructive' : 'secondary'}
                className="h-5 px-1.5 text-[11px] font-normal"
              >
                {t('metadataFields.activeCount', {
                  selected: selectedCount,
                  total: totalFields,
                })}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t('autoRefreshHint')}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 sm:pt-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen((prev) => !prev)}
            className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            aria-expanded={isOpen}
            aria-label={isOpen ? t('metadataFields.hideConfigure') : t('metadataFields.configure')}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            <span>{isOpen ? t('metadataFields.hideConfigure') : t('metadataFields.configure')}</span>
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform duration-200', isOpen && 'rotate-180')}
              aria-hidden
            />
          </Button>

          <Switch
            id="auto-refresh-switch"
            checked={autoRefresh}
            disabled={isUpdating || !user}
            onCheckedChange={handleToggleAutoRefresh}
            aria-label={t('autoRefresh')}
          />
        </div>
      </div>

      {/* Раскрывающаяся панель настройки полей */}
      {isOpen && (
        <div className="border-t border-border/50 bg-muted/20 p-3 sm:p-4 space-y-3.5 transition-all animate-in fade-in-50 duration-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('metadataFields.title')}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={isUpdating || selectedCount === totalFields}
                className="h-7 px-2 text-xs"
              >
                {t('metadataFields.selectAll')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeselectAll}
                disabled={isUpdating || selectedCount === 0}
                className="h-7 px-2 text-xs"
              >
                {t('metadataFields.deselectAll')}
              </Button>
            </div>
          </div>

          {selectedCount === 0 && (
            <div
              className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-500 dark:text-amber-400"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span>{t('metadataFields.noneSelectedWarning')}</span>
            </div>
          )}

          {/* Сетка категорий */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {torrentMetadataRefreshFields.map((field) => {
              const Icon = FIELD_ICONS[field];
              const isSelected = selectedFields.includes(field);
              const fieldId = `metadata-field-${field}`;

              return (
                <label
                  key={field}
                  htmlFor={fieldId}
                  className={cn(
                    'group relative flex items-start gap-3 rounded-lg border p-3 cursor-pointer select-none transition-all',
                    'min-h-[52px]', // доступная область нажатия >= 44px
                    isSelected
                      ? 'border-primary/50 bg-primary/5 shadow-xs'
                      : 'border-border/60 bg-card/40 hover:border-border hover:bg-card/70 text-muted-foreground',
                    isUpdating && 'opacity-60 pointer-events-none'
                  )}
                >
                  <Checkbox
                    id={fieldId}
                    checked={isSelected}
                    onCheckedChange={() => handleToggleField(field)}
                    disabled={isUpdating}
                    className="mt-0.5"
                    aria-label={t(`metadataFields.${field}`)}
                  />

                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <Icon className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
                      <span>{t(`metadataFields.${field}`)}</span>
                    </div>
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      {t(`metadataFields.${field}Hint`)}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
