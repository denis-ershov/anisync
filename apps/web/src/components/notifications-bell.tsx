'use client';

import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type NotificationItem = {
  id: number;
  type: string;
  module: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

function formatRelativeTime(iso: string, locale: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return locale.startsWith('ru') ? 'только что' : 'just now';
  }
  if (minutes < 60) {
    return locale.startsWith('ru') ? `${minutes} мин` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return locale.startsWith('ru') ? `${hours} ч` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return locale.startsWith('ru') ? `${days} д` : `${days}d`;
}

export function NotificationsBell({ className }: { className?: string }) {
  const t = useTranslations('Header');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const locale =
    typeof document !== 'undefined' ? document.documentElement.lang || 'en' : 'en';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/notifications?limit=30', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as NotificationsResponse;
      setItems(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const markAllRead = async () => {
    if (unreadCount === 0 || marking) {
      return;
    }
    setMarking(true);
    try {
      const response = await fetch('/api/user/notifications', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        setUnreadCount(0);
        setItems((current) =>
          current.map((item) => ({
            ...item,
            readAt: item.readAt ?? new Date().toISOString(),
          }))
        );
      }
    } finally {
      setMarking(false);
    }
  };

  const badgeLabel =
    unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'relative h-11 w-11 min-h-11 min-w-11 cursor-pointer',
            className
          )}
          aria-label={t('notificationsAria', { count: unreadCount })}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {badgeLabel ? (
            <Badge
              variant="destructive"
              className="absolute -right-0.5 -top-0.5 h-5 min-w-5 justify-center rounded-full px-1 text-[10px] leading-none"
            >
              {badgeLabel}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="z-50 w-[min(100vw-1.5rem,22rem)] p-0"
        sideOffset={8}
      >
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-sm font-semibold">{t('notifications')}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 cursor-pointer px-2 text-xs"
            disabled={unreadCount === 0 || marking}
            onClick={() => void markAllRead()}
          >
            {t('markAllRead')}
          </Button>
        </div>
        <ScrollArea className="h-72">
          {loading && items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t('notificationsLoading')}
            </p>
          ) : null}
          {!loading && items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t('notificationsEmpty')}
            </p>
          ) : null}
          <ul className="divide-y">
            {items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  'px-3 py-3 transition-colors duration-200',
                  !item.readAt && 'bg-primary/5'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{item.title}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatRelativeTime(item.createdAt, locale)}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">
                  {item.message}
                </p>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
