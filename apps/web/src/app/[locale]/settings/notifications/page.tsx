'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { NotificationPreferences } from '@/lib/types';

export default function NotificationsSettingsPage() {
  const t = useTranslations('SettingsNotifications');
  const { toast } = useToast();

  const [prefs, setPrefs] = useState<NotificationPreferences>({
    inApp: true,
    telegram: false,
    email: false,
    telegramChatId: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/user/settings');
      if (!response.ok) {
        throw new Error('Failed to load');
      }
      const data = await response.json();
      const np = data.settings?.notificationPreferences ?? {};
      setPrefs({
        inApp: np.inApp ?? true,
        telegram: np.telegram ?? false,
        email: np.email ?? false,
        telegramChatId: np.telegramChatId ?? '',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: t('loadError'),
        description: t('loadErrorDescription'),
      });
    } finally {
      setIsLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveSettings() {
    setIsSaving(true);
    try {
      const chatId = (prefs.telegramChatId || '').trim() || null;
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationPreferences: {
            inApp: prefs.inApp ?? true,
            telegram: Boolean(prefs.telegram && chatId),
            email: prefs.email ?? false,
            telegramChatId: chatId,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      const result = await response.json();
      const np = result.settings?.notificationPreferences ?? {};
      setPrefs({
        inApp: np.inApp ?? true,
        telegram: np.telegram ?? false,
        email: np.email ?? false,
        telegramChatId: np.telegramChatId ?? '',
      });

      toast({
        title: t('saved'),
        description: t('savedDescription'),
      });
    } catch {
      toast({
        variant: 'destructive',
        title: t('saveError'),
        description: t('saveErrorDescription'),
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('channelsTitle')}</CardTitle>
          <CardDescription>{t('channelsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex min-h-11 items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="in-app">{t('inApp')}</Label>
              <p className="text-sm text-muted-foreground">{t('inAppDescription')}</p>
            </div>
            <Switch
              id="in-app"
              checked={Boolean(prefs.inApp)}
              onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, inApp: checked }))}
            />
          </div>

          <div className="flex min-h-11 items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="telegram-enabled">{t('telegram')}</Label>
              <p className="text-sm text-muted-foreground">{t('telegramDescription')}</p>
            </div>
            <Switch
              id="telegram-enabled"
              checked={Boolean(prefs.telegram)}
              onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, telegram: checked }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telegram-chat-id">{t('telegramChatId')}</Label>
            <Input
              id="telegram-chat-id"
              className="min-h-11"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t('telegramChatIdPlaceholder')}
              value={prefs.telegramChatId ?? ''}
              onChange={(event) =>
                setPrefs((prev) => ({ ...prev, telegramChatId: event.target.value }))
              }
            />
            <p className="text-sm text-muted-foreground">{t('telegramChatIdHint')}</p>
          </div>

          <Button
            type="button"
            className="min-h-11 cursor-pointer"
            disabled={isSaving}
            onClick={() => void saveSettings()}
          >
            {isSaving ? t('saving') : t('save')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
