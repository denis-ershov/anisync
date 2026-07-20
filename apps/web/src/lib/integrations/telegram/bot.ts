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

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (input.photoUrl) {
        const response = await fetch(`${base}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetChat,
            photo: input.photoUrl,
            caption: input.text,
            parse_mode: 'HTML',
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (response.ok) {
          return true;
        }
        // fallback to text if photo fails
      }

      const response = await fetch(`${base}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChat,
          text: input.text,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }

  return false;
}

export function formatTorrentNotification(input: {
  title: string;
  releaseTitle: string;
  quality?: string | null;
  size?: number | null;
  seeders?: number | null;
  imdbId: string;
  changeType?: 'new' | 'update' | 'new_episode';
}): string {
  const changeLabel =
    input.changeType === 'new_episode'
      ? 'Новые серии'
      : input.changeType === 'update'
        ? 'Обновление раздачи'
        : 'Новая раздача';

  const lines = [
    `<b>${changeLabel}</b>`,
    input.title,
    `<code>${input.releaseTitle}</code>`,
  ];
  if (input.quality) {
    lines.push(`Качество: ${input.quality}`);
  }
  if (input.seeders != null) {
    lines.push(`Сиды: ${input.seeders}`);
  }
  if (input.size != null) {
    const gb = Number(input.size) / 1024 ** 3;
    if (Number.isFinite(gb) && gb > 0) {
      lines.push(`Размер: ${gb.toFixed(2)} GB`);
    }
  }
  lines.push(`https://www.imdb.com/title/${input.imdbId}/`);
  return lines.join('\n');
}
