import { NextResponse } from 'next/server';
import { home, categories, browse, search, detail, stream } from '../../../lib/dramabox.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Best-effort per-instance protection. Use a shared Redis limiter/WAF for production scale.
const requests = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 40;
const SUPPORTED_LOCALES = new Set(['in', 'en', 'es', 'pt', 'th', 'ar', 'ja', 'ko', 'fr', 'de', 'it']);

function json(body, status = 200, headers = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

function getClientKey(request) {
  // Vercel supplies these headers; the value is used only as a rate-limit bucket key.
  const realIp = request.headers.get('x-real-ip');
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (realIp || forwarded || 'unknown').slice(0, 64);
}

function isRateLimited(request) {
  const now = Date.now();
  const key = getClientKey(request);
  let entry = requests.get(key);
  if (!entry || now - entry.startedAt >= WINDOW_MS) entry = { startedAt: now, count: 0 };
  entry.count += 1;
  requests.set(key, entry);
  if (requests.size > 2_000) {
    for (const [ip, item] of requests) if (now - item.startedAt >= WINDOW_MS) requests.delete(ip);
  }
  return entry.count > MAX_REQUESTS;
}

const text = (value, max = 100) => typeof value === 'string' ? value.trim().slice(0, max) : '';
function integer(value, min, max, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}
function locale(value) {
  const candidate = text(value || 'in', 8).toLowerCase();
  return SUPPORTED_LOCALES.has(candidate) ? candidate : 'in';
}

export async function GET(request, { params }) {
  if (isRateLimited(request)) {
    return json({ success: false, error: 'Terlalu banyak permintaan. Coba lagi sebentar.' }, 429, { 'Retry-After': '60' });
  }

  const { action } = await params;
  const query = new URL(request.url).searchParams;
  const lang = locale(query.get('lang'));

  try {
    let data;
    switch (action) {
      case 'home':
        data = await home({ lang });
        break;
      case 'categories':
        data = await categories({ lang });
        break;
      case 'browse': {
        const genre = integer(query.get('genre'), 0, 100_000, 0);
        const page = integer(query.get('page'), 1, 200, 1);
        if (genre === null || page === null) return json({ success: false, error: 'Filter katalog tidak valid.' }, 400);
        data = await browse({ lang, genre, page });
        break;
      }
      case 'search': {
        const keyword = text(query.get('q'), 80);
        const page = integer(query.get('page'), 1, 200, 1);
        if (keyword.length < 2 || page === null) return json({ success: false, error: 'Masukkan kata kunci minimal 2 karakter.' }, 400);
        data = await search({ keyword, lang, page });
        break;
      }
      case 'detail': {
        const bookId = text(query.get('id'), 20);
        if (!/^\d{5,20}$/.test(bookId)) return json({ success: false, error: 'ID drama tidak valid.' }, 400);
        data = await detail({ bookId, lang });
        break;
      }
      case 'stream': {
        const bookId = text(query.get('id'), 20);
        const episode = integer(query.get('episode'), 1, 2_000, null);
        if (!/^\d{5,20}$/.test(bookId) || episode === null) return json({ success: false, error: 'Parameter episode tidak valid.' }, 400);
        data = await stream({ bookId, episode, lang, format: 'mp4' });
        break;
      }
      default:
        return json({ success: false, error: 'Endpoint tidak ditemukan.' }, 404);
    }
    return json({ success: true, data });
  } catch (error) {
    const message = String(error?.message || '');
    console.error('[X-DRAMS]', action, message.slice(0, 240));
    const blocked = message.startsWith('blocked:');
    return json({
      success: false,
      error: blocked
        ? 'Sumber sedang membatasi permintaan. Tunggu sebentar lalu coba lagi.'
        : 'Data belum tersedia dari sumber. Coba lagi beberapa saat.',
    }, blocked ? 503 : 502);
  }
}
