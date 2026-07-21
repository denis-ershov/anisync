export {};

const port = process.env.PORT ?? '3000';
const url = `http://127.0.0.1:${port}/api/health`;

try {
  const response = await fetch(url, { signal: AbortSignal.timeout(4_000) });
  process.exit(response.ok ? 0 : 1);
} catch {
  process.exit(1);
}
