import type { ProwlarrRelease } from '@/lib/torrents/watcher/identity';
import { extractInfoHashFromMagnet } from '@/lib/torrents/watcher/identity';

export type ResolvedReleaseLinks = {
  magnet: string | null;
  downloadUrl: string | null;
  infoUrl: string | null;
};

/** Публичный base Prowlarr для ссылок в Telegram (телефон вне Docker-сети). */
export function prowlarrPublicBaseUrl(): string | null {
  const publicBase = (process.env.PROWLARR_PUBLIC_URL || '').trim().replace(/\/$/, '');
  const internalBase = (process.env.PROWLARR_URL || '').trim().replace(/\/$/, '');
  return publicBase || internalBase || null;
}

export function rewriteProwlarrPublicUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  const publicBase = (process.env.PROWLARR_PUBLIC_URL || '').trim().replace(/\/$/, '');
  const internalBase = (process.env.PROWLARR_URL || '').trim().replace(/\/$/, '');
  if (!publicBase || !internalBase || publicBase === internalBase) {
    return url;
  }
  if (url.startsWith(internalBase)) {
    return publicBase + url.slice(internalBase.length);
  }
  return url;
}

function normalizeMagnet(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const value = String(raw).trim();
  if (value.startsWith('magnet:')) {
    return value;
  }
  const match = /magnet:\?[^\s<>"]+/i.exec(value);
  return match?.[0]?.trim() ?? null;
}

export function resolveReleaseLinks(release: ProwlarrRelease): ResolvedReleaseLinks {
  let magnet = normalizeMagnet(release.magnetUrl || release.magnet || release.magnetLink);

  if (!magnet) {
    const infoHash = release.infoHash || release.info_hash;
    if (infoHash) {
      const hash = String(infoHash).trim();
      if (/^[0-9a-fA-F]{40}$/.test(hash) || /^[A-Z2-7a-z2-7]{32}$/.test(hash)) {
        magnet = `magnet:?xt=urn:btih:${hash}`;
      }
    }
  }

  if (magnet && !extractInfoHashFromMagnet(magnet) && !magnet.startsWith('magnet:')) {
    magnet = null;
  }

  const downloadUrl = rewriteProwlarrPublicUrl(
    release.downloadUrl && /^https?:\/\//i.test(release.downloadUrl) ? release.downloadUrl : null
  );

  const guidOrLink = release.guid || release.link;
  let infoUrl: string | null = null;
  if (guidOrLink && /^https?:\/\//i.test(String(guidOrLink))) {
    infoUrl = String(guidOrLink).trim();
  }

  if (infoUrl && (infoUrl === downloadUrl || infoUrl === magnet)) {
    infoUrl = null;
  }

  return { magnet, downloadUrl, infoUrl };
}
