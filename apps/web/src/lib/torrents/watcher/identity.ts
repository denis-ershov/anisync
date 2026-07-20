import { createHash } from 'node:crypto';

export type ProwlarrRelease = {
  title?: string;
  guid?: string;
  downloadUrl?: string;
  link?: string;
  magnetUrl?: string;
  magnet?: string;
  magnetLink?: string;
  infoHash?: string;
  info_hash?: string;
  indexer?: string;
  tracker?: string;
  size?: number | string;
  seeders?: number;
  publishDate?: string;
  imdbId?: string;
  imdb_id?: string;
  quality?: string | { resolution?: string };
  description?: string;
  overview?: string;
  summary?: string;
  indexerId?: number;
};

export function extractInfoHashFromMagnet(magnetUrl?: string | null): string | null {
  if (!magnetUrl) {
    return null;
  }

  const match = /(?:xt=urn:btih:|btih:)([^&\s]+)/i.exec(magnetUrl);
  if (!match?.[1]) {
    return null;
  }

  const infoHash = decodeURIComponent(match[1]).trim();
  if (/^[0-9a-fA-F]{40}$/.test(infoHash)) {
    return infoHash.toLowerCase();
  }
  if (/^[A-Z2-7a-z2-7]{32}$/.test(infoHash)) {
    return infoHash.toUpperCase();
  }
  return null;
}

export function normalizeReleaseIdentity(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function extractTrackerId(value: unknown, trackerName: string): string | null {
  if (value == null) {
    return null;
  }
  const rawValue = String(value).trim();
  if (!rawValue) {
    return null;
  }
  if (/^\d+$/.test(rawValue)) {
    return rawValue;
  }

  try {
    const parsed = new URL(rawValue);
    const trackerLower = (trackerName || '').toLowerCase();
    const keys =
      trackerLower.includes('rutracker')
        ? ['t']
        : trackerLower.includes('nnm')
          ? ['id', 't']
          : ['t', 'id'];

    for (const key of keys) {
      const found = parsed.searchParams.get(key);
      if (found) {
        return found.trim();
      }
    }
  } catch {
    // not a URL
  }

  const match = /[?&](?:t|id)=([^&#]+)/.exec(rawValue);
  return match?.[1] ? decodeURIComponent(match[1]).trim() : null;
}

export function buildTrackerReleaseIdentity(
  trackerName: string,
  trackerId: string | null
): string | null {
  if (!trackerId) {
    return null;
  }
  const trackerLower = (trackerName || '').toLowerCase();
  let trackerPrefix = 'tracker';
  if (trackerLower.includes('rutracker')) {
    trackerPrefix = 'rutracker';
  } else if (trackerLower.includes('nnm')) {
    trackerPrefix = 'nnmclub';
  } else {
    trackerPrefix = trackerLower.replace(/[^0-9a-z]+/g, '_').replace(/^_|_$/g, '') || 'tracker';
  }

  const safeId = String(trackerId)
    .replace(/[^0-9A-Za-z_-]+/g, '_')
    .replace(/^_|_$/g, '');
  if (!safeId) {
    return null;
  }
  return `${trackerPrefix}_${safeId}`;
}

/** Primary stable key + aliases from Prowlarr fields (no torrent download). */
export function computeReleaseIdentity(release: ProwlarrRelease): {
  primary: string | null;
  aliases: string[];
} {
  const guid = release.guid || release.downloadUrl || release.link;
  const downloadUrl = release.downloadUrl;
  const trackerName = release.indexer || release.tracker || '';
  const magnet = release.magnetUrl || release.magnet || release.magnetLink;
  const btih = extractInfoHashFromMagnet(magnet);
  const infoHashField = release.infoHash || release.info_hash;
  const trackerId =
    extractTrackerId(guid, trackerName) || extractTrackerId(downloadUrl, trackerName);
  const trackerIdentity = buildTrackerReleaseIdentity(trackerName, trackerId);

  const ordered = [btih, infoHashField, trackerIdentity, trackerId, guid, downloadUrl];
  const aliases: string[] = [];
  const seen = new Set<string>();
  let primary: string | null = null;

  for (const value of ordered) {
    const normalized = normalizeReleaseIdentity(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    aliases.push(normalized);
    if (primary == null) {
      primary = normalized;
    }
  }

  return { primary, aliases };
}

export function buildReleaseContentHash(
  size: unknown,
  title: unknown
): { contentHash: string; legacyHash: string } {
  const rawTitle = title == null ? '' : String(title);
  const normalizedTitle = rawTitle.split(/\s+/).join(' ');
  const sizeValue = size == null ? '' : String(size);

  return {
    contentHash: createHash('sha256')
      .update(`${sizeValue}:${normalizedTitle}`, 'utf8')
      .digest('hex'),
    legacyHash: createHash('sha256').update(`${size}:${title}`, 'utf8').digest('hex'),
  };
}

export function qualityLabel(release: ProwlarrRelease): string | null {
  const quality = release.quality;
  if (quality && typeof quality === 'object' && quality.resolution) {
    return String(quality.resolution);
  }
  if (typeof quality === 'string' && quality.trim()) {
    return quality;
  }
  return null;
}
