import test from 'node:test';
import assert from 'node:assert/strict';

import { formatTorrentNotification, sendTelegramMessage } from '@/lib/integrations/telegram/bot';

type Call = { method: string; body: Record<string, unknown> };

async function captureTelegramCalls(run: () => Promise<boolean>) {
  const calls: Call[] = [];
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const method = String(url).split('/').pop() ?? '';
    calls.push({ method, body: JSON.parse(String(init?.body ?? '{}')) });
    return new Response('{"ok":true}', { status: 200 });
  }) as typeof fetch;
  try {
    const ok = await run();
    return { ok, calls };
  } finally {
    globalThis.fetch = originalFetch;
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
  }
}

const longMagnet =
  'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Movie' +
  '&tr=udp%3A%2F%2Ftracker.example.org%3A1337%2Fannounce'.repeat(30);

test('sendTelegramMessage sends photo with caption when visible text fits despite long magnet href', async () => {
  const text = formatTorrentNotification({
    title: 'Test Movie',
    releaseTitle: 'Test.Movie.2026.1080p',
    imdbId: 'tt9999999',
    plot: 'Short plot.',
    links: { magnet: longMagnet },
  });
  assert.ok(text.length > 1024, 'raw HTML should exceed caption limit for this test');

  const { ok, calls } = await captureTelegramCalls(() =>
    sendTelegramMessage({ text, chatId: '1', photoUrl: 'https://img.example/poster.jpg' })
  );

  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'sendPhoto');
  assert.equal(calls[0].body.caption, text);
});

test('sendTelegramMessage sends a single message with photo preview when visible text is too long', async () => {
  const text = `<b>${'a'.repeat(1100)}</b>`;

  const { ok, calls } = await captureTelegramCalls(() =>
    sendTelegramMessage({ text, chatId: '1', photoUrl: 'https://img.example/poster.jpg' })
  );

  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'sendMessage');
  assert.deepEqual(calls[0].body.link_preview_options, {
    url: 'https://img.example/poster.jpg',
    prefer_large_media: true,
    show_above_text: true,
  });
});
