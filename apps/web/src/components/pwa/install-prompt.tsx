'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const VISIT_COUNT_KEY = 'anisync:pwa:auth-visits';
const DISMISS_KEY = 'anisync:pwa:install-dismissed';
const SESSION_KEY = 'anisync:pwa:session-counted';
const MIN_VISITS_BEFORE_PROMPT = 2;
const SNOOZE_DAYS = 7;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isDismissed() {
  const value = localStorage.getItem(DISMISS_KEY);
  if (!value) return false;
  if (value === 'permanent') return true;
  const snoozeUntil = Date.parse(value);
  return Number.isFinite(snoozeUntil) && Date.now() < snoozeUntil;
}

function bumpAuthenticatedVisitCount() {
  if (sessionStorage.getItem(SESSION_KEY)) return;
  sessionStorage.setItem(SESSION_KEY, '1');
  const current = Number.parseInt(localStorage.getItem(VISIT_COUNT_KEY) ?? '0', 10);
  localStorage.setItem(VISIT_COUNT_KEY, String(Number.isFinite(current) ? current + 1 : 1));
}

function getAuthenticatedVisitCount() {
  const current = Number.parseInt(localStorage.getItem(VISIT_COUNT_KEY) ?? '0', 10);
  return Number.isFinite(current) ? current : 0;
}

export function PwaInstallPrompt() {
  const t = useTranslations('Pwa');
  const { user, isLoading } = useAuth();
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [visible, setVisible] = useState(false);

  const evaluateVisibility = useCallback(() => {
    if (isLoading || !user) {
      setVisible(false);
      return;
    }

    if (isStandaloneDisplayMode() || isDismissed()) {
      setVisible(false);
      return;
    }

    if (!deferredPromptRef.current) {
      setVisible(false);
      return;
    }

    bumpAuthenticatedVisitCount();
    setVisible(getAuthenticatedVisitCount() >= MIN_VISITS_BEFORE_PROMPT);
  }, [isLoading, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setCanPrompt(true);
      evaluateVisibility();
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setCanPrompt(false);
      setVisible(false);
      localStorage.setItem(DISMISS_KEY, 'permanent');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [evaluateVisibility]);

  useEffect(() => {
    evaluateVisibility();
  }, [evaluateVisibility, canPrompt]);

  const handleInstall = async () => {
    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) return;

    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;

    deferredPromptRef.current = null;
    setCanPrompt(false);
    setVisible(false);

    if (outcome === 'accepted') {
      localStorage.setItem(DISMISS_KEY, 'permanent');
    }
  };

  const handleDismiss = (permanent: boolean) => {
    if (permanent) {
      localStorage.setItem(DISMISS_KEY, 'permanent');
    } else {
      const snoozeUntil = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(DISMISS_KEY, String(snoozeUntil));
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-description"
      className={cn(
        'fixed inset-x-4 z-[60] rounded-xl border border-border/80 bg-card/95 p-4 shadow-lg backdrop-blur',
        'bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 md:left-auto md:right-6 md:max-w-sm md:inset-x-auto'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Download className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p id="pwa-install-title" className="font-medium leading-tight">
            {t('installTitle')}
          </p>
          <p id="pwa-install-description" className="mt-1 text-sm text-muted-foreground">
            {t('installDescription')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={handleInstall}>
              {t('installAction')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleDismiss(false)}>
              {t('installLater')}
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => handleDismiss(true)}
          aria-label={t('installDismiss')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
