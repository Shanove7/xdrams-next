import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

const OTP_TTL = 5 * 60;
const SESSION_TTL = 60 * 60 * 24 * 30;
const OTP_COOLDOWN = 60;
const MAX_VERIFY_ATTEMPTS = 5;

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function redisUrl() { return env('UPSTASH_REDIS_REST_URL').replace(/\/$/, ''); }
async function redis(command) {
  const response = await fetch(redisUrl(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('UPSTASH_REDIS_REST_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store',
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error('Storage service unavailable');
  const payload = await response.json();
  if (payload.error) throw new Error('Storage service error');
  return payload.result;
}

function digest(value) {
  return createHmac('sha256', env('AUTH_SECRET')).update(value).digest('hex');
}
function phoneKey(phone) { return digest(`phone:${phone}`); }
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}
export function normalizePhone(value) {
  let phone = String(value || '').replace(/[\s().-]/g, '');
  if (/^0[1-9]\d{7,12}$/.test(phone)) phone = `+62${phone.slice(1)}`;
  else if (/^62[1-9]\d{7,12}$/.test(phone)) phone = `+${phone}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;
  return phone;
}
function otpMessage(code) {
  return `Kode verifikasi X-DRAMS kamu: ${code}. Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.`;
}

async function incrementLimit(key, limit, ttl) {
  const count = Number(await redis(['INCR', key]));
  if (count === 1) await redis(['EXPIRE', key, ttl]);
  return count > limit;
}

export async function sendOtp({ phone, ip }) {
  const hashedPhone = phoneKey(phone);
  if (await incrementLimit(`xdrams:otp:cooldown:${hashedPhone}`, 1, OTP_COOLDOWN)) {
    return { ok: false, status: 429, error: 'Tunggu 60 detik sebelum meminta kode baru.' };
  }
  if (await incrementLimit(`xdrams:otp:ip:${digest(ip).slice(0, 32)}`, 10, 3600)) {
    return { ok: false, status: 429, error: 'Terlalu banyak permintaan dari jaringan ini. Coba lagi nanti.' };
  }
  if (await incrementLimit(`xdrams:otp:phone:${hashedPhone}`, 5, 86400)) {
    return { ok: false, status: 429, error: 'Batas permintaan kode hari ini tercapai.' };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const otpHash = digest(`${phone}:${code}`);
  await redis(['SET', `xdrams:otp:challenge:${hashedPhone}`, JSON.stringify({ hash: otpHash, attempts: 0 }), 'EX', OTP_TTL]);

  const apiUrl = process.env.WAPITO_API_URL || 'https://api.wapito.com/v1/messages/text';
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('WAPITO_API_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: phone, body: otpMessage(code) }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    await redis(['DEL', `xdrams:otp:challenge:${hashedPhone}`]);
    throw new Error('WhatsApp provider could not accept the message');
  }
  // Wapito may return status=pending. This means accepted by the provider, not confirmed delivered.
  return { ok: true, providerStatus: String(payload.status || 'accepted').slice(0, 24) };
}

export async function verifyOtp({ phone, code }) {
  const hashedPhone = phoneKey(phone);
  const key = `xdrams:otp:challenge:${hashedPhone}`;
  const raw = await redis(['GET', key]);
  if (!raw) return { ok: false, status: 400, error: 'Kode kedaluwarsa atau belum diminta.' };
  let challenge;
  try { challenge = JSON.parse(raw); } catch { await redis(['DEL', key]); return { ok: false, status: 400, error: 'Kode tidak valid.' }; }
  const attempts = Number(await redis(['INCR', `xdrams:otp:attempts:${hashedPhone}`]));
  if (attempts === 1) await redis(['EXPIRE', `xdrams:otp:attempts:${hashedPhone}`, OTP_TTL]);
  if (attempts > MAX_VERIFY_ATTEMPTS) {
    await redis(['DEL', key]);
    return { ok: false, status: 429, error: 'Terlalu banyak percobaan. Minta kode baru.' };
  }
  if (!safeEqual(challenge.hash, digest(`${phone}:${code}`))) {
    return { ok: false, status: 400, error: 'Kode OTP salah.' };
  }
  await redis(['DEL', key, `xdrams:otp:attempts:${hashedPhone}`]);
  const sessionId = randomUUID();
  await redis(['SET', `xdrams:session:${sessionId}`, JSON.stringify({ phone, createdAt: Date.now() }), 'EX', SESSION_TTL]);
  const signature = digest(`session:${sessionId}`);
  return { ok: true, cookie: `${sessionId}.${signature}`, maxAge: SESSION_TTL, phone };
}

export async function readSession(cookie) {
  if (!cookie || typeof cookie !== 'string') return null;
  const [sessionId, signature, extra] = cookie.split('.');
  if (!sessionId || !signature || extra || !safeEqual(signature, digest(`session:${sessionId}`))) return null;
  const raw = await redis(['GET', `xdrams:session:${sessionId}`]);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function deleteSession(cookie) {
  if (!cookie || typeof cookie !== 'string') return;
  const [sessionId, signature, extra] = cookie.split('.');
  if (sessionId && signature && !extra && safeEqual(signature, digest(`session:${sessionId}`))) {
    await redis(['DEL', `xdrams:session:${sessionId}`]);
  }
}

export const SESSION_COOKIE = 'xdrams_session';
