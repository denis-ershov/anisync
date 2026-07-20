'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { AlertCircle, Info } from 'lucide-react';

export function LoginMessage() {
  const searchParams = useSearchParams();
  const t = useTranslations('Auth');
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'info' | 'warning'>('info');

  useEffect(() => {
    const messageParam = searchParams.get('message');

    if (messageParam) {
      setMessage(messageParam);

      // Set message type based on the message
      if (messageParam === 'session_expired' || messageParam === 'unauthorized') {
        setMessageType('warning');
      } else {
        setMessageType('info');
      }
    }
  }, [searchParams]);

  if (!message) return null;

  const getMessageText = () => {
    switch (message) {
      case 'please_login':
        return t('pleaseLogin') || 'Please log in to continue';
      case 'session_expired':
        return t('sessionExpired') || 'Your session has expired. Please log in again.';
      case 'unauthorized':
        return t('unauthorized') || 'You need to be logged in to access this page.';
      default:
        return t('pleaseLogin') || 'Please log in to continue';
    }
  };

  return (
    <div
      className={`mb-6 p-4 rounded-lg border ${
        messageType === 'warning'
          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200'
          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {messageType === 'warning' ? (
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
        ) : (
          <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
        )}
        <p className="text-sm">{getMessageText()}</p>
      </div>
    </div>
  );
}
