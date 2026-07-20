import { createHash } from 'node:crypto';

const MAX_TORRENT_BYTES = 10 * 1024 * 1024;
const MAX_DEPTH = 64;

type BValue = Buffer | bigint | BValue[] | Map<string, BValue>;

class BencodeReader {
  offset = 0;

  constructor(private readonly data: Buffer) {}

  parse(depth = 0): BValue {
    if (depth > MAX_DEPTH || this.offset >= this.data.length) {
      throw new Error('Invalid bencode payload');
    }
    const marker = this.data[this.offset];
    if (marker === 0x69) return this.parseInteger();
    if (marker === 0x6c) return this.parseList(depth);
    if (marker === 0x64) return this.parseDictionary(depth);
    if (marker >= 0x30 && marker <= 0x39) return this.parseBytes();
    throw new Error('Invalid bencode marker');
  }

  parseBytes(): Buffer {
    const colon = this.data.indexOf(0x3a, this.offset);
    if (colon < 0) throw new Error('Invalid bencode string');
    const rawLength = this.data.subarray(this.offset, colon).toString('ascii');
    if (!/^(0|[1-9]\d*)$/.test(rawLength)) throw new Error('Invalid bencode length');
    const length = Number(rawLength);
    const start = colon + 1;
    const end = start + length;
    if (!Number.isSafeInteger(length) || end > this.data.length) {
      throw new Error('Bencode string exceeds payload');
    }
    this.offset = end;
    return this.data.subarray(start, end);
  }

  private parseInteger(): bigint {
    const end = this.data.indexOf(0x65, ++this.offset);
    if (end < 0) throw new Error('Invalid bencode integer');
    const raw = this.data.subarray(this.offset, end).toString('ascii');
    if (!/^-?(0|[1-9]\d*)$/.test(raw)) throw new Error('Invalid bencode integer');
    this.offset = end + 1;
    return BigInt(raw);
  }

  private parseList(depth: number): BValue[] {
    const values: BValue[] = [];
    this.offset += 1;
    while (this.data[this.offset] !== 0x65) values.push(this.parse(depth + 1));
    this.offset += 1;
    return values;
  }

  private parseDictionary(depth: number): Map<string, BValue> {
    const values = new Map<string, BValue>();
    this.offset += 1;
    while (this.data[this.offset] !== 0x65) {
      const key = this.parseBytes().toString('utf8');
      values.set(key, this.parse(depth + 1));
    }
    this.offset += 1;
    return values;
  }
}

export function torrentBytesToMagnet(input: Uint8Array): string | null {
  const data = Buffer.from(input);
  if (!data.length || data.length > MAX_TORRENT_BYTES || data[0] !== 0x64) return null;

  try {
    const reader = new BencodeReader(data);
    reader.offset = 1;
    while (data[reader.offset] !== 0x65) {
      const key = reader.parseBytes().toString('utf8');
      const valueStart = reader.offset;
      const value = reader.parse(1);
      if (key !== 'info') continue;

      const infoHash = createHash('sha1')
        .update(data.subarray(valueStart, reader.offset))
        .digest('hex');
      const name =
        value instanceof Map && value.get('name') instanceof Buffer
          ? (value.get('name') as Buffer).toString('utf8')
          : null;
      return `magnet:?xt=urn:btih:${infoHash}${name ? `&dn=${encodeURIComponent(name)}` : ''}`;
    }
  } catch {
    return null;
  }
  return null;
}
