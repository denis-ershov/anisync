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
  if (!token || !targetChat) {
    return false;
  }

  const base = `https://api.telegram.org/bot${token}`;

  async function post(method: string, body: Record<string, unknown>) {
    const response = await fetch(`${base}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok;
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
  itemType?: string | null;
  changeType?: 'new' | 'update' | 'new_episode';
  links?: TorrentNotificationLinks | null;
}): string {
  void input.quality;
  void input.seeders;
  void input.imdbId;

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

  if (rating) {
    info += `⭐️ IMDb: ${rating}\n`;
  }
  if (genre) {
    info += `🎭 ${genre}\n`;
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

  if (links.length) {
    info += `\n${links.join(' | ')}\n`;
  }

  return header + info;
}
