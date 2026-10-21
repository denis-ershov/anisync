import { createLogger } from '@/lib/observability/logger';

const log = createLogger('integrations:telegram');

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHref(url: string): string {
  return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const TELEGRAM_CAPTION_LIMIT = 1024;

export async function sendTelegramMessage(input: {
  text: string;
  chatId?: string | null;
  photoUrl?: string | null;
}): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const targetChat = (input.chatId || process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token) {
    log.warn('Telegram send skipped: TELEGRAM_BOT_TOKEN is not configured');
    return false;
  }
  if (!targetChat) {
    log.warn('Telegram send skipped: target chatId is missing and TELEGRAM_CHAT_ID is empty');
    return false;
  }

  const base = `https://api.telegram.org/bot${token}`;

  async function post(method: string, body: Record<string, unknown>) {
    try {
      const response = await fetch(`${base}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        log.warn(
          { method, status: response.status, body: errBody, targetChat },
          'Telegram API returned error status'
        );
        return false;
      }
      return true;
    } catch (err) {
      log.warn({ method, err, targetChat }, 'Telegram API request network error');
      return false;
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (input.photoUrl) {
        const captionFits = input.text.length <= TELEGRAM_CAPTION_LIMIT;
        if (captionFits) {
          const photoOk = await post('sendPhoto', {
            chat_id: targetChat,
            photo: input.photoUrl,
            caption: input.text,
            parse_mode: 'HTML',
          });
          if (photoOk) {
            return true;
          }
        } else {
          const photoOk = await post('sendPhoto', {
            chat_id: targetChat,
            photo: input.photoUrl,
          });
          if (photoOk) {
            const textOk = await post('sendMessage', {
              chat_id: targetChat,
              text: input.text,
              parse_mode: 'HTML',
              disable_web_page_preview: true,
            });
            if (textOk) {
              return true;
            }
          }
        }
      }

      const messageOk = await post('sendMessage', {
        chat_id: targetChat,
        text: input.text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      if (messageOk) {
        return true;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }

  return false;
}

export type TorrentNotificationLinks = {
  magnet?: string | null;
  downloadUrl?: string | null;
  directDownloadUrl?: string | null;
  infoUrl?: string | null;
};

function truncatePlot(plot: string, maxLength = 350): string {
  const clean = plot
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';
  if (clean.length <= maxLength) return clean;
  const truncated = clean.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const sliceIndex = lastSpace > maxLength * 0.7 ? lastSpace : maxLength;
  return clean.slice(0, sliceIndex).trim() + '…';
}

export function formatTorrentNotification(input: {
  title: string;
  releaseTitle: string;
  quality?: string | null;
  size?: number | null;
  seeders?: number | null;
  imdbId: string;
  year?: string | null;
  genre?: string | null;
  rating?: number | string | null;
  plot?: string | null;
  itemType?: string | null;
  changeType?: 'new' | 'update' | 'new_episode';
  links?: TorrentNotificationLinks | null;
}): string {
  void input.quality;
  void input.seeders;

  const title = escapeHtml(input.title || 'Unknown');
  const year = escapeHtml(String(input.year || '').trim());
  const genre = escapeHtml(String(input.genre || '').trim());
  const rating =
    input.rating != null && String(input.rating).trim() !== ''
      ? escapeHtml(String(input.rating).trim())
      : '';
  const typeEmoji = input.itemType === 'tv' ? '📺' : '🎬';

  let header = '🌙 <b>NightWatcher</b>\n\n';
  if (input.changeType === 'new_episode') {
    header += '🆕 <b>Новый эпизод!</b>\n\n';
  } else if (input.changeType === 'update') {
    header += '♻️ <b>Обновление раздачи!</b>\n\n';
  } else {
    header += '✨ <b>Новый релиз!</b>\n\n';
  }

  let info = `${typeEmoji} <b>${title}</b>`;
  if (year) {
    info += ` (${year})`;
  }
  info += '\n';

  const rawImdbId = String(input.imdbId || '').trim();
  const imdbUrl = /^tt\d+/i.test(rawImdbId)
    ? `https://www.imdb.com/title/${encodeURIComponent(rawImdbId)}/`
    : null;

  if (rating) {
    if (imdbUrl) {
      info += `⭐️ IMDb: <a href="${escapeHref(imdbUrl)}">${rating}</a>\n`;
    } else {
      info += `⭐️ IMDb: ${rating}\n`;
    }
  } else if (imdbUrl) {
    info += `⭐️ <a href="${escapeHref(imdbUrl)}">IMDb</a>\n`;
  }

  if (genre) {
    info += `🎭 ${genre}\n`;
  }

  const plot = truncatePlot(String(input.plot || ''));
  if (plot) {
    info += `\n📖 <i>${escapeHtml(plot)}</i>\n`;
  }

  info += `\n📥 <b>Релиз:</b>\n`;
  info += `📝 ${escapeHtml(input.releaseTitle || 'N/A')}\n`;

  if (input.size != null) {
    const sizeGb = Number(input.size) / 1024 ** 3;
    if (Number.isFinite(sizeGb) && sizeGb > 0) {
      info += `💾 Размер: ${sizeGb.toFixed(2)} GB\n`;
    }
  }

  let magnet = input.links?.magnet?.trim() || null;
  let downloadUrl = input.links?.downloadUrl?.trim() || null;
  let directDownloadUrl = input.links?.directDownloadUrl?.trim() || null;
  let infoUrl = input.links?.infoUrl?.trim() || null;

  if (directDownloadUrl && downloadUrl && directDownloadUrl === downloadUrl) {
    directDownloadUrl = null;
  }
  if (infoUrl && (infoUrl === downloadUrl || infoUrl === directDownloadUrl)) {
    infoUrl = null;
  }

  const links: string[] = [];
  if (magnet) {
    links.push(`<a href="${escapeHref(magnet)}">🧲 Magnet-ссылка</a>`);
  }
  if (downloadUrl) {
    links.push(`<a href="${escapeHref(downloadUrl)}">📥 Скачать (Prowlarr)</a>`);
  }
  if (directDownloadUrl && /^https?:\/\//i.test(directDownloadUrl)) {
    links.push(`<a href="${escapeHref(directDownloadUrl)}">💾 Прямой torrent</a>`);
  }
  if (infoUrl && /^https?:\/\//i.test(infoUrl)) {
    links.push(`<a href="${escapeHref(infoUrl)}">🔗 Страница раздачи</a>`);
  }
  if (imdbUrl) {
    links.push(`<a href="${escapeHref(imdbUrl)}">⭐️ IMDb</a>`);
  }

  if (links.length) {
    info += `\n${links.join(' | ')}\n`;
  }

  return header + info;
}
